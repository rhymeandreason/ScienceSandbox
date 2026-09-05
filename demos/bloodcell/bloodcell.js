/* =============================================================================
 *  bloodcell/bloodcell.js — one red cell, discocyte to sickle, cut open
 * =============================================================================
 *  Classic script after scene.js + kit/card-stage.js. Exposes window.BloodCell.
 *
 *      const C = BloodCell.mount(el, { viewOffset });
 *      C.set({ sickle: 1, cut: 0.5 });   C.state();   C.destroy();
 *
 *  ONE SURFACE, BUILT ONCE, MOVED EVERY FRAME. Every behaviour here —
 *  sickling, the creases, the cut — is a deformation or a re-index of a grid
 *  allocated at mount: (K+1)x J vertices for the outer membrane and the same
 *  again for the inner face. Nothing calls new BufferGeometry after that.
 *  Rebuilding is what would make a morph cost more than the morph.
 *
 *  THE PARAMETRIC GRID. A cross-section of a red cell through its axis is one
 *  open curve from the top dimple, out around the rim, to the bottom dimple.
 *  Revolve it and the grid is a sphere's: k is the polar step along that
 *  profile (poles at k=0 and k=K), j the spoke. That gives three things a
 *  radius-keyed height field would not: an even sampling of the rim, where all
 *  the curvature is; poles that are single points, so no seam at the dimple;
 *  and a CUT that is just a range of spokes withheld from the index buffer.
 *
 *  THE CUT SHOWS MEMBRANE THICKNESS, so the cell is a shell and not a bag: the
 *  inner surface is the profile offset inward in profile space (2D, exact)
 *  rather than along a 3D normal, and the boundary of the removed wedge is
 *  bridged by a ribbon between the two. The `membrane` default is ~0.16 µm —
 *  twenty times the real bilayer, which at true scale is a quarter of one
 *  pixel. Deliberate exaggeration; the geometry is otherwise measured.
 *
 *  THE WARP IS THE WHOLE MODEL. `warp()` maps a point of the resting disc to
 *  its sickled position, and EVERYTHING passes through it: both membrane
 *  surfaces, the cut ribbon, and every haemoglobin bead. That is what keeps
 *  the contents inside the cell for free — no clamping, no collision — and it
 *  is why the fibres follow the crescent without knowing about it.
 *
 *  Shape sources: Evans & Fung's profile for the discocyte (7.8 µm across,
 *  2.4 µm at the rim, 0.8 in the dimple). The sickle is a caricature of the
 *  deoxygenated cell, not a measured one: HbS polymer bundles the cell into a
 *  boat with drawn-out horns, and the beads become those bundles. It is drawn
 *  from `seed`, and no two seeds give the same cell — see `makeShape`.
 *
 *  BUDGET: ~6 ms a frame WHILE MORPHING (19k vertices warped, their normals,
 *  2000 instanced beads, the cut ribbon, and the render), and a render alone
 *  once it settles — nothing recomputes unless a parameter moved. Most of it
 *  is the trigonometry a vertex costs; the irregularity is what it buys.
 * ========================================================================== */
(function (global) {
  'use strict';

  const R0 = 3.91;      // µm — disc radius
  const AMP = 1.945;    // µm — scales the profile to a 2.4 µm rim, 0.8 µm dimple

  const K = 72;         // profile samples, pole to pole
  const J = 96;         // spokes; also the cut's angular resolution (3.75°)

  const DEFAULTS = {
    sickle: 0,          // 0 discocyte · 1 sickled
    cut: 0,             // whole (0) or halved (1); between is the opening, not a state
    /* WHICH HALF IS REMOVED, in turns, and 0 is the one the sickle needs: it
       takes the near side away and cuts the cell along its length, so the
       opening runs tip to tip and the fibres are seen end-on to end-on. A
       crosswise cut of a crescent shows a sliver and hides the polymer, which
       is the whole reason the cell has that shape. On the disc the same plane
       is the classic cross-section through both dimples. */
    cutTurn: 0,
    membrane: 0.1,      // thick enough to see, and no more than that (see header)
    hb: true,           // the haemoglobin inside
    hbCount: 2000,
    autoRotate: false,
    seed: 7,
  };

  const COL = {
    outer: 0xb42d1b, outerSickle: 0xcf3419,
    inner: 0x7d1c10,
    edge: 0xe08268,                 // the cut face: lighter, so thickness reads
    hb: 0xc9c469, hbFibre: 0xd6d074,
  };

  /* ---- the resting profile ---------------------------------------------- */

  const g = r => 0.207 + 2.003 * r * r - 1.123 * r * r * r * r;

  /* Outer profile in (r, y), plus the same curve offset inward by t. Offsetting
     in profile space and then revolving is exact for a surface of revolution;
     offsetting the 3D vertices along their normals is not, and pinches in the
     dimple where the curvature is highest. Poles are forced onto the axis:
     the finite-difference normal there is a few nanometres off vertical, which
     is enough to open a hole in the inner surface at the dimple. */
  function profile(t) {
    const pr = new Float64Array(K + 1), py = new Float64Array(K + 1);
    const ir = new Float64Array(K + 1), iy = new Float64Array(K + 1);
    for (let k = 0; k <= K; k++) {
      const f = Math.PI * k / K, rho = Math.sin(f);
      pr[k] = R0 * rho;
      py[k] = AMP * Math.cos(f) * g(rho);
    }
    for (let k = 0; k <= K; k++) {
      let nr, ny;
      if (k === 0) { nr = 0; ny = 1; }
      else if (k === K) { nr = 0; ny = -1; }
      else {
        const dr = pr[k + 1] - pr[k - 1], dy = py[k + 1] - py[k - 1];
        const L = Math.hypot(dr, dy) || 1;
        nr = -dy / L; ny = dr / L;             // outward: tangent turned +90°
      }
      ir[k] = Math.max(0, pr[k] - t * nr);
      iy[k] = py[k] - t * ny;
    }
    return { pr, py, ir, iy };
  }

  /* Half-height of the lumen at radius r, for placing beads inside it. */
  function lumenY(prof, r) {
    const { ir, iy } = prof;
    const h = K >> 1;                          // k=0..h is the top half, ir rising
    if (r >= ir[h]) return 0;
    let k = 0;
    while (k < h && ir[k + 1] < r) k++;
    const span = ir[k + 1] - ir[k];
    const u = span > 1e-9 ? (r - ir[k]) / span : 0;
    return Math.max(0, iy[k] + (iy[k + 1] - iy[k]) * u);
  }

  /* A table of that half-height, because every bead asks for it every frame. */
  function lumenTable(prof) {
    const N = 192, t = new Float32Array(N + 1);
    for (let i = 0; i <= N; i++) t[i] = lumenY(prof, R0 * i / N);
    return t;
  }
  function lumenAt(tab, r) {
    const N = tab.length - 1, u = r / R0 * N;
    if (u <= 0) return tab[0];
    if (u >= N) return 0;
    const i = u | 0;
    return tab[i] + (tab[i + 1] - tab[i]) * (u - i);
  }

  /* ---- the deformation --------------------------------------------------- */

  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  function rng(seed) { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }

  /* THE SHAPE OF ONE PARTICULAR CELL. A sickled cell is not a lens with two
     matching points: the two ends are different lengths and different
     thicknesses, one of them hooks, the outline is uneven down its sides, and
     the folds are wherever the polymer happened to bundle. All of that is
     drawn once per seed and then held fixed, so a cell keeps its own face
     across a morph and `seed` is what asks for another one.

     Every coefficient is a smooth field, never a per-vertex jitter: the same
     numbers deform the outer surface, the inner surface and the haemoglobin,
     and noise applied per vertex would tear the three apart. */
  function makeShape(seed) {
    const R = rng(seed), pick = (lo, hi) => lo + R() * (hi - lo);
    const cr = new Float64Array(16);
    for (let i = 0; i < 4; i++) {
      cr[i * 4] = pick(0.05, 0.14);          // amplitude, µm
      cr[i * 4 + 1] = pick(-2.6, 2.6);       // across the width
      cr[i * 4 + 2] = pick(-1.4, 1.4);       // along the length
      cr[i * 4 + 3] = R() * 6.283;
    }
    /* THE RIM'S OWN POINTS. A sickled cell is not a lens with a spike at each
       end: the polymer pushes the rim out wherever a bundle reaches it, so the
       edge carries several points of different sizes and the two ends are only
       the largest of them. Each is a narrow bump on the rim angle, pushed out
       and lifted; the compact support is what makes it a POINT rather than one
       more term in a smooth outline. */
    const NS = 3 + ((R() * 4) | 0);          // 3-6 of them
    const sp = new Float64Array(NS * 4);
    for (let i = 0; i < NS; i++) {
      sp[i * 4] = R() * 6.283;               // where on the rim
      sp[i * 4 + 1] = pick(0.22, 0.44);      // half-width, radians
      sp[i * 4 + 2] = pick(0.30, 0.85);      // how far out, µm
      sp[i * 4 + 3] = pick(-0.45, 0.45);     // and how far up
    }
    return {
      taper: [pick(0.34, 0.52), pick(0.34, 0.52)],
      pull:  [pick(0.20, 0.42), pick(0.20, 0.42)],
      thin:  [pick(0.65, 0.88), pick(0.65, 0.88)],
      hook:  [pick(-0.7, 0.7), pick(-0.7, 0.7)],
      wA1: pick(0.06, 0.15), wF1: pick(0.30, 0.60), wP1: R() * 6.283,
      wA2: pick(0.03, 0.09), wF2: pick(0.9, 1.5), wP2: R() * 6.283,
      swayA: pick(-0.55, 0.55), swayF: pick(0.25, 0.55), swayP: R() * 6.283,
      kap: pick(0.095, 0.135),
      cr, sp,
    };
  }

  /* Resting disc (XZ plane, y the thickness axis) to sickled cell, under one
     cell's own coefficients. Order matters: everything that shapes the flat
     sheet happens first, and the bend that makes the boat happens last, on the
     arc-length coordinate x. The trough and the folds are added to y ALONE and
     identically to both surfaces, so they bend the sheet without thinning it. */
  function warp(x, y, z, m, S, o) {
    if (m <= 0.0005) { o[0] = x; o[1] = y; o[2] = z; o[3] = 1; return o; }
    const bx = x, bz = z;

    const sx = 1 + 0.34 * m;
    x *= sx;
    const a = Math.min(1, Math.abs(x) / (R0 * sx));
    const e = x >= 0 ? 0 : 1;                  // which end: they are not alike

    // Narrower, and uneven down its length rather than a clean ellipse.
    const wob = 1 + m * (S.wA1 * Math.sin(S.wF1 * bx + S.wP1)
                       + S.wA2 * Math.sin(S.wF2 * bx + S.wP2));
    z *= (1 - 0.34 * m) * wob;
    let ysc = 1 - 0.22 * m;                    // how much this place has thinned
    y *= ysc;

    // The horns. The taper is held to the outer third — a squeeze that reaches
    // the middle draws a lens — and each end gets its own length, thinness and
    // sideways hook.
    const tip = smooth(S.taper[e], 1.0, a);
    x += m * S.pull[e] * R0 * tip * Math.sign(x);
    ysc *= 1 - m * S.thin[e] * tip;
    y *= 1 - m * S.thin[e] * tip;
    z = z * (1 - m * 0.70 * tip) + m * S.hook[e] * tip;

    // The long axis is not a straight line in plan either.
    z += m * S.swayA * Math.sin(S.swayF * bx + S.swayP);

    // The rim's points, on the RESTING angle so each one keeps its spoke.
    const rho = Math.hypot(bx, bz) / R0;
    const rim = smooth(0.58, 1.0, rho);
    if (rim > 0) {
      const th = Math.atan2(bz, bx), sp = S.sp;
      let out = 0, up = 0;
      for (let i = 0; i < sp.length; i += 4) {
        let d = th - sp[i];
        if (d > Math.PI) d -= 6.28318; else if (d < -Math.PI) d += 6.28318;
        const u = d / sp[i + 1];
        if (u <= -1 || u >= 1) continue;
        const b = (1 - u * u) * (1 - u * u);   // compact, so the point stays a point
        out += b * sp[i + 2]; up += b * sp[i + 3];
      }
      if (out || up) {
        const k = m * rim;
        x += k * out * Math.cos(th);
        z += k * out * Math.sin(th);
        y += k * up;
      }
    }

    // The trough across the width, and the folds the polymer leaves.
    const env = 1 - a * a, cr = S.cr;
    let d = 0.075 * z * z;
    for (let i = 0; i < 16; i += 4) d += env * cr[i] * Math.sin(cr[i + 1] * bz + cr[i + 2] * bx + cr[i + 3]);
    y += m * d;

    // The boat: the long axis bends OUT of the disc's plane, lifting both
    // tips, and the trough above runs along the keel. Bending it within the
    // plane instead draws a banana in plan view, which is the same curvature
    // read as a different cell.
    const kap = m * S.kap;                     // ~70-100° of arc at m=1
    if (kap > 1e-6) {
      const Rb = 1 / kap, ang = x * kap, rr = Rb - y;
      x = rr * Math.sin(ang);
      y = Rb - rr * Math.cos(ang);
    }
    o[0] = x; o[1] = y; o[2] = z; o[3] = ysc; return o;
  }

  /* ---- haemoglobin ------------------------------------------------------- */

  /* Two resting layouts for the same beads, in DISC space: a free cloud, and
     the bundles HbS forms when it polymerises. The morph lerps between them and
     the warp carries the result into the crescent, so a fibre curves with the
     cell without being told the cell curved. */
  function beads(n, prof, seed) {
    const R = rng(seed);
    const free = new Float32Array(n * 3), fib = new Float32Array(n * 3);
    const rad = new Float32Array(n), lag = new Float32Array(n);

    for (let i = 0; i < n; i++) {
      let r, y;
      /* The margin is RADIAL, and it is the one the vertical clamp cannot
         give: at the rim the membrane's normal points outward, so a bead with
         room above it can still have none in front of it — and the spikes
         stretch that gap further. Kept a third of a micron short of the inner
         rim. */
      do { r = R0 * 0.87 * Math.sqrt(R()); y = lumenY(prof, r); } while (y < 0.05);
      const th = R() * Math.PI * 2;
      free[i * 3] = r * Math.cos(th);
      free[i * 3 + 1] = (R() * 2 - 1) * (y - 0.03);
      free[i * 3 + 2] = r * Math.sin(th);
      rad[i] = 0.048 + R() * 0.026;
      lag[i] = R() * 0.35;
    }

    const F = 16, per = Math.ceil(n / F);
    for (let f = 0; f < F; f++) {
      const z0 = (R() * 2 - 1) * R0 * 0.66;
      const yf = (R() * 2 - 1) * 0.72;
      const ph = R() * 6.28, wob = 0.06 + R() * 0.10;
      for (let q = 0; q < per; q++) {
        const i = f * per + q; if (i >= n) break;
        const s = per > 1 ? (q / (per - 1)) * 2 - 1 : 0;
        const z = z0 + wob * Math.sin(3.2 * s + ph);
        const xm = Math.sqrt(Math.max(0, (R0 * 0.87) ** 2 - z * z));
        const x = s * xm;
        fib[i * 3] = x;
        fib[i * 3 + 1] = yf * lumenY(prof, Math.hypot(x, z));
        fib[i * 3 + 2] = z;
      }
    }
    return { free, fib, rad, lag };
  }

  /* ---- the cell ---------------------------------------------------------- */

  function create(THREE, root, params) {
    const P = Object.assign({}, DEFAULTS, params);
    const NV = (K + 1) * J;

    const geoOut = new THREE.BufferGeometry();
    const geoIn = new THREE.BufferGeometry();
    const posOut = new Float32Array(NV * 3), norOut = new Float32Array(NV * 3);
    const posIn = new Float32Array(NV * 3), norIn = new Float32Array(NV * 3);
    geoOut.setAttribute('position', new THREE.BufferAttribute(posOut, 3));
    geoOut.setAttribute('normal', new THREE.BufferAttribute(norOut, 3));
    geoIn.setAttribute('position', new THREE.BufferAttribute(posIn, 3));
    geoIn.setAttribute('normal', new THREE.BufferAttribute(norIn, 3));
    const idxOut = new Uint32Array(K * J * 6), idxIn = new Uint32Array(K * J * 6);
    geoOut.setIndex(new THREE.BufferAttribute(idxOut, 1));
    geoIn.setIndex(new THREE.BufferAttribute(idxIn, 1));

    // The cut face: a ribbon between the two surfaces, all the way round the
    // boundary of the removed wedge. The loop runs down one spoke and back up
    // the other; the two meet AT the poles, so it closes.
    const LP = 2 * (K + 1);
    const geoEdge = new THREE.BufferGeometry();
    const posEdge = new Float32Array(LP * 2 * 3);
    geoEdge.setAttribute('position', new THREE.BufferAttribute(posEdge, 3));
    const idxEdge = new Uint32Array(LP * 6);
    for (let l = 0; l < LP; l++) {
      const m = (l + 1) % LP, o = l * 6;
      idxEdge[o] = l; idxEdge[o + 1] = LP + l; idxEdge[o + 2] = m;
      idxEdge[o + 3] = m; idxEdge[o + 4] = LP + l; idxEdge[o + 5] = LP + m;
    }
    geoEdge.setIndex(new THREE.BufferAttribute(idxEdge, 1));

    const matOut = new THREE.MeshPhysicalMaterial({
      color: COL.outer, roughness: 0.46, metalness: 0.0,
      clearcoat: 0.5, clearcoatRoughness: 0.36,
    });
    const matIn = new THREE.MeshStandardMaterial({ color: COL.inner, roughness: 0.85, metalness: 0 });
    const matEdge = new THREE.MeshStandardMaterial({ color: COL.edge, roughness: 0.6, side: THREE.DoubleSide });

    const meshOut = new THREE.Mesh(geoOut, matOut);
    const meshIn = new THREE.Mesh(geoIn, matIn);
    const meshEdge = new THREE.Mesh(geoEdge, matEdge);
    meshOut.frustumCulled = false; meshIn.frustumCulled = false; meshEdge.frustumCulled = false;

    const grp = new THREE.Group();
    grp.add(meshOut, meshIn, meshEdge);
    root.add(grp);

    const hbGeo = new THREE.IcosahedronGeometry(1, 0);
    const hbMat = new THREE.MeshStandardMaterial({ color: COL.hb, roughness: 0.5, metalness: 0, flatShading: true });
    const hb = new THREE.InstancedMesh(hbGeo, hbMat, P.hbCount);
    hb.frustumCulled = false;
    hb.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    grp.add(hb);

    const cosT = new Float32Array(J), sinT = new Float32Array(J);
    for (let j = 0; j < J; j++) { const t = 2 * Math.PI * j / J; cosT[j] = Math.cos(t); sinT[j] = Math.sin(t); }

    let prof = profile(P.membrane);
    let lut = lumenTable(prof);
    let shape = makeShape(P.seed);
    let bd = beads(P.hbCount, prof, P.seed);
    const dummy = new THREE.Object3D();
    const o3 = [0, 0, 0, 1];
    let dirty = true;

    /* -- the index buffer, rewritten only when the wedge moves -- */
    let cutA = 0, cutN = 0;
    function reindex() {
      cutN = Math.round(Math.min(1, Math.max(0, P.cut)) * J * 0.5);
      cutA = ((Math.round(P.cutTurn * J) % J) + J) % J;
      let n = 0;
      for (let j = 0; j < J; j++) {
        if (((j - cutA + J) % J) < cutN) continue;        // withheld: the wedge
        const j2 = (j + 1) % J;
        for (let k = 0; k < K; k++) {
          const a = k * J + j, b = k * J + j2, c = (k + 1) * J + j, d = (k + 1) * J + j2;
          // Outward winding: (k,j) → (k,j+1) → (k+1,j).
          idxOut[n] = a; idxOut[n + 1] = b; idxOut[n + 2] = c;
          idxOut[n + 3] = b; idxOut[n + 4] = d; idxOut[n + 5] = c;
          idxIn[n] = a; idxIn[n + 1] = c; idxIn[n + 2] = b;     // reversed: faces the lumen
          idxIn[n + 3] = b; idxIn[n + 4] = c; idxIn[n + 5] = d;
          n += 6;
        }
      }
      geoOut.setDrawRange(0, n); geoIn.setDrawRange(0, n);
      geoOut.index.needsUpdate = true; geoIn.index.needsUpdate = true;
      meshIn.visible = meshEdge.visible = cutN > 0;
      dirty = true;
    }

    /* -- every vertex, every bead, through one warp -- */
    function apply() {
      const m = P.sickle, { pr, py, ir, iy } = prof;
      for (let k = 0; k <= K; k++) {
        const rO = pr[k], yO = py[k], rI = ir[k], yI = iy[k];
        for (let j = 0; j < J; j++) {
          const o = (k * J + j) * 3, c = cosT[j], s = sinT[j];
          warp(rO * c, yO, rO * s, m, shape, o3);
          posOut[o] = o3[0]; posOut[o + 1] = o3[1]; posOut[o + 2] = o3[2];
          warp(rI * c, yI, rI * s, m, shape, o3);
          posIn[o] = o3[0]; posIn[o + 1] = o3[1]; posIn[o + 2] = o3[2];
        }
      }
      gridNormals(posOut, norOut, 1);
      gridNormals(posIn, norIn, -1);
      geoOut.attributes.position.needsUpdate = geoOut.attributes.normal.needsUpdate = true;
      geoIn.attributes.position.needsUpdate = geoIn.attributes.normal.needsUpdate = true;

      if (cutN > 0) edge();
      if (hb.visible) instances(m);
    }

    /* Normals from the grid itself: one cross product per vertex, against
       three.js's face-accumulate over 41k triangles. `sign` flips them for the
       inner surface, which has to be lit from inside the lumen. The poles have
       no j-neighbours to difference, so they take the next ring's. */
    function gridNormals(pos, nor, sign) {
      for (let k = 0; k <= K; k++) {
        if (k === 0 || k === K) continue;
        for (let j = 0; j < J; j++) {
          const o = (k * J + j) * 3;
          const a = ((k - 1) * J + j) * 3, b = ((k + 1) * J + j) * 3;
          const c = (k * J + (j + J - 1) % J) * 3, d = (k * J + (j + 1) % J) * 3;
          const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
          const vx = pos[d] - pos[c], vy = pos[d + 1] - pos[c + 1], vz = pos[d + 2] - pos[c + 2];
          let nx = vy * uz - vz * uy, ny = vz * ux - vx * uz, nz = vx * uy - vy * ux;
          const L = Math.hypot(nx, ny, nz) || 1;
          nor[o] = sign * nx / L; nor[o + 1] = sign * ny / L; nor[o + 2] = sign * nz / L;
        }
      }
      for (let j = 0; j < J; j++) {
        const p0 = j * 3, p1 = (J + j) * 3, q0 = (K * J + j) * 3, q1 = ((K - 1) * J + j) * 3;
        nor[p0] = nor[p1]; nor[p0 + 1] = nor[p1 + 1]; nor[p0 + 2] = nor[p1 + 2];
        nor[q0] = nor[q1]; nor[q0 + 1] = nor[q1 + 1]; nor[q0 + 2] = nor[q1 + 2];
      }
    }

    function edge() {
      const jB = (cutA + cutN) % J;
      for (let l = 0; l < LP; l++) {
        const top = l <= K;
        const k = top ? l : (2 * K + 1 - l);
        const j = top ? jB : cutA;
        const src = (k * J + j) * 3, o = l * 3;
        posEdge[o] = posOut[src]; posEdge[o + 1] = posOut[src + 1]; posEdge[o + 2] = posOut[src + 2];
        const p = (LP + l) * 3;
        posEdge[p] = posIn[src]; posEdge[p + 1] = posIn[src + 1]; posEdge[p + 2] = posIn[src + 2];
      }
      geoEdge.attributes.position.needsUpdate = true;
      geoEdge.computeVertexNormals();          // 292 vertices; cheaper than caring
    }

    function instances(m) {
      const n = P.hbCount, TAU = Math.PI * 2;
      for (let i = 0; i < n; i++) {
        const o = i * 3;
        // Each bead starts moving at its own moment, so the cloud gathers into
        // fibres in a wave rather than as one rigid slide.
        const u = smooth(bd.lag[i], bd.lag[i] + 0.65, m);
        const x = bd.free[o] + (bd.fib[o] - bd.free[o]) * u;
        let y = bd.free[o + 1] + (bd.fib[o + 1] - bd.free[o + 1]) * u;
        const z = bd.free[o + 2] + (bd.fib[o + 2] - bd.free[o + 2]) * u;
        /* BOTH ENDS OF THAT LERP ARE INSIDE THE CELL AND THE PATH BETWEEN THEM
           IS NOT: the lumen is a quarter of a micron deep over the dimple and
           four times that at the rim, so a bead crossing the middle surfaces
           straight through the membrane. Held under the ceiling at its own
           radius instead. The warp is what keeps it inside thereafter. */
        const cap = lumenAt(lut, Math.hypot(x, z)) - bd.rad[i];
        if (cap <= 0) y = 0; else if (y > cap) y = cap; else if (y < -cap) y = -cap;
        // Hidden with the wedge it sits in, tested on the RESTING angle so the
        // test matches the spokes the index buffer withheld.
        let hide = false;
        if (cutN > 0) {
          let th = Math.atan2(z, x); if (th < 0) th += TAU;
          const j = Math.floor(th / TAU * J) % J;
          hide = ((j - cutA + J) % J) < cutN;
        }
        warp(x, y, z, m, shape, o3);
        dummy.position.set(o3[0], o3[1], o3[2]);
        dummy.scale.setScalar(hide ? 0 : bd.rad[i]);
        dummy.updateMatrix();
        hb.setMatrixAt(i, dummy.matrix);
      }
      hb.instanceMatrix.needsUpdate = true;
      hbMat.color.setHex(COL.hb).lerp(cSickleHb, m);
    }

    const cSickle = new THREE.Color(COL.outerSickle), cSickleHb = new THREE.Color(COL.hbFibre);
    function paint() { matOut.color.setHex(COL.outer).lerp(cSickle, P.sickle); }

    reindex(); apply(); paint();

    return {
      group: grp,
      set(next) {
        let re = false, rebuild = false;
        for (const k in next) {
          if (P[k] === next[k]) continue;
          if (k === 'cut' || k === 'cutTurn') re = true;
          if (k === 'membrane') rebuild = true;
          if (k === 'seed') rebuild = true;
          P[k] = next[k];
        }
        if (rebuild) { prof = profile(P.membrane); lut = lumenTable(prof); shape = makeShape(P.seed); bd = beads(P.hbCount, prof, P.seed); }
        hb.visible = !!P.hb;
        if (re) reindex();
        dirty = true;
      },
      step(dt) {
        if (P.autoRotate) { grp.rotation.y += dt * 0.35; }
        if (!dirty) return;
        dirty = false;
        apply(); paint();
      },
      touch() { dirty = true; },
      params: P,
      dispose() {
        root.remove(grp);
        geoOut.dispose(); geoIn.dispose(); geoEdge.dispose(); hbGeo.dispose();
        matOut.dispose(); matIn.dispose(); matEdge.dispose(); hbMat.dispose();
      },
    };
  }

  /* ---- mount ------------------------------------------------------------- */

  function mount(el, params = {}) {
    if (!global.CardStage) throw new Error('bloodcell.js: load kit/card-stage.js first');
    let cell = null;
    const listeners = {};
    const emit = (ev, ...a) => (listeners[ev] || []).forEach(f => f(...a));

    const box = global.CardStage.create({
      mount: el,
      cam: params.cam || { theta: 0.35, phi: 0.95, r: 16 },   // square onto the cut face
      stage: Object.assign({ rMin: 7, rMax: 48, phiMin: 0.12, phiMax: 3.02 }, params.stage || {}),
      step: dt => { if (cell) { cell.step(dt); tw.update(dt); emit('frame', api.state(), dt); } },
      viewOffset: params.viewOffset,
    });

    /* NO SHADOW MAPS ANYWHERE. A cast shadow on a form this smooth is a hard
       black crescent, and softening one costs a fill that flattens the dimple
       — the one feature the discocyte is here to show. Form comes from the
       normals. Stage's ambient is dropped and a hemisphere takes over, because
       an ambient this high leaves the cut face the same value as the outside.
       Key and rim ride the camera, Stage's own rule: orbiting then reads as
       turning the cell under a fixed lamp. */
    box.scene.traverse(o => {
      if (o.isAmbientLight) o.intensity = 0.26;
      else if (o.isDirectionalLight) o.intensity *= 0.55;
    });
    box.scene.add(new THREE.HemisphereLight(0xdfe9ff, 0x2a1414, 0.55));
    const key = new THREE.DirectionalLight(0xfff2e8, 0.70); key.position.set(-4, 5, 6);
    const rim = new THREE.DirectionalLight(0xbfd4ff, 0.5); rim.position.set(3, 2, -7);
    const under = new THREE.DirectionalLight(0xffd9c8, 0.28); under.position.set(2, -6, 2);
    box.camera.add(key, key.target, rim, rim.target, under, under.target);

    cell = create(THREE, box.root, params);
    const tw = global.CardStage.tweens();

    const api = {
      set(next, opts = {}) {
        const glide = opts.snap ? 0 : (opts.seconds === undefined ? 0.9 : opts.seconds);
        for (const k of ['sickle', 'cut']) {
          if (next[k] === undefined) continue;
          const from = cell.params[k], to = next[k];
          if (glide > 0 && from !== to) {
            tw.to(from, to, glide, v => { cell.set({ [k]: v }); }, { key: k, ease: 'smooth' });
          } else { tw.cancel(k); cell.set({ [k]: to }); }
          delete next[k];
        }
        cell.set(next);
        return api;
      },
      state() { return Object.assign({}, cell.params); },
      on(ev, fn) { (listeners[ev] || (listeners[ev] = [])).push(fn); return api; },
      show(name, on) { if (name === 'hb') cell.set({ hb: !!on }); return api; },
      box,
      destroy() { cell.dispose(); box.destroy(); },
    };
    return api;
  }

  global.BloodCell = { mount, create, DEFAULTS, R0 };
})(window);
