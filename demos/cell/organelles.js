/* =============================================================================
 *  cell/organelles.js — the organelles both cells are built from
 * =============================================================================
 *  Every organelle either cell is built from, and the geometry primitives
 *  that make them. A host calls the ones its cell has.
 *
 *  THE FOUR IN BOTH CELLS — nucleus, mitochondrion, Golgi, rough ER — are
 *  ONE geometry, not two that resemble each other. They are homologous:
 *  same origin, same job, same ultrastructure, and a student who meets a
 *  mitochondrion in an animal cell has to meet the same object in a plant.
 *  Only arrangement differs, and arrangement is the host's. A plant Golgi is
 *  many scattered stacks and an animal Golgi one perinuclear ribbon —
 *  because the geometry is identical, that difference is what the eye lands
 *  on, which is the whole reason not to redraw it.
 *
 *  THE PLASTIDS AND THE VACUOLE are plant-only and live here anyway, so all
 *  organelle geometry is in one file and a comparison page can call both
 *  sets. A plastid is built by the SAME shell code as the mitochondrion:
 *  both are endosymbionts, two membranes with a folded internal membrane,
 *  and that kinship is said in the construction rather than in the colour.
 *
 *      CellOrganelles.kit(THREE, { seed })   one seeded stream, four builders
 *
 *  A KIT, NOT FREE FUNCTIONS, because every builder draws from one seeded
 *  random stream in call order. Two kits with the same seed give the same
 *  cell; the same kit called in a different order gives a different one.
 *  That is why a host builds in a fixed order and why adding a call in the
 *  middle reshuffles everything after it.
 *
 *  EACH BUILDER RETURNS A BARE GROUP at the origin, unrotated and
 *  unregistered. Where an organelle sits, what it is called, and whether it
 *  is pickable are the host's business — that is the whole line between this
 *  file and the two cells, and it is what lets a plant cell put a solver
 *  between the builder and the scene.
 *
 *  ORGANELLE COLOURS COME FROM palette.js, never from here or from a host.
 *  One organelle, one colour, wherever it is drawn.
 *
 *  THE SHELL BUILDER is the one idea worth keeping. buildShell takes any
 *  parametric surface S(u,w), keeps w up to a per-u cut, offsets an inner
 *  wall along the finite-difference normal and closes the two with a
 *  rounded lip, so a cut organelle has real membrane thickness instead of
 *  a clipped single surface. It is why these read as cut objects rather
 *  than as silhouettes, and why a lesson can fly inside one. Outer, lip and
 *  inner are vertex colours, which is why the materials carry no `color`.
 *
 *  COLOURS ARE TYPED AS sRGB AND CONVERTED. r128 has no colour management:
 *  a hex string lands in the material as linear, and with sRGBEncoding on
 *  the renderer it draws paler than typed. Every colour goes through col().
 * ========================================================================== */
(function (global) {
  'use strict';

  const PI = Math.PI;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ---- seeded random + simplex noise --------------------------------- */

  function seededRandom(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeNoise(seed) {
    const grad3 = [1,1,0,-1,1,0,1,-1,0,-1,-1,0,1,0,1,-1,0,1,1,0,-1,-1,0,-1,0,1,1,0,-1,1,0,1,-1,0,-1,-1];
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    const rnd = seededRandom(seed || 1);
    for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
    const perm = new Uint8Array(512), pm12 = new Uint8Array(512);
    for (let i = 0; i < 512; i++) { perm[i] = p[i & 255]; pm12[i] = perm[i] % 12; }
    const F3 = 1 / 3, G3 = 1 / 6;
    function noise3(xin, yin, zin) {
      const s = (xin + yin + zin) * F3;
      const i = Math.floor(xin + s), j = Math.floor(yin + s), k = Math.floor(zin + s);
      const t = (i + j + k) * G3;
      const x0 = xin - (i - t), y0 = yin - (j - t), z0 = zin - (k - t);
      let i1, j1, k1, i2, j2, k2;
      if (x0 >= y0) {
        if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
        else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
        else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
      } else {
        if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
        else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
        else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
      }
      const xs = [x0, x0 - i1 + G3, x0 - i2 + 2 * G3, x0 - 1 + 3 * G3];
      const ys = [y0, y0 - j1 + G3, y0 - j2 + 2 * G3, y0 - 1 + 3 * G3];
      const zs = [z0, z0 - k1 + G3, z0 - k2 + 2 * G3, z0 - 1 + 3 * G3];
      const ii = i & 255, jj = j & 255, kk = k & 255;
      const gi = [
        pm12[ii + perm[jj + perm[kk]]] * 3,
        pm12[ii + i1 + perm[jj + j1 + perm[kk + k1]]] * 3,
        pm12[ii + i2 + perm[jj + j2 + perm[kk + k2]]] * 3,
        pm12[ii + 1 + perm[jj + 1 + perm[kk + 1]]] * 3,
      ];
      let n = 0;
      for (let c = 0; c < 4; c++) {
        let t0 = 0.6 - xs[c] * xs[c] - ys[c] * ys[c] - zs[c] * zs[c];
        if (t0 > 0) { t0 *= t0; n += t0 * t0 * (grad3[gi[c]] * xs[c] + grad3[gi[c] + 1] * ys[c] + grad3[gi[c] + 2] * zs[c]); }
      }
      return 32 * n;
    }
    function fbm(x, y, z, oct = 3) {
      let a = 0.5, f = 1, sum = 0, norm = 0;
      for (let o = 0; o < oct; o++) { sum += a * noise3(x * f, y * f, z * f); norm += a; a *= 0.5; f *= 2.03; }
      return sum / norm;
    }
    return { noise3, fbm };
  }

  /* ---- geometry ------------------------------------------------------ */

  function surfaceNormal(THREE, S, center, u, w, eps = 1e-3) {
    const su = S(u + eps, w).sub(S(u - eps, w));
    const sw = S(u, w + eps).sub(S(u, w - eps));
    const n = new THREE.Vector3().crossVectors(su, sw);
    const radial = S(u, w).sub(center);
    if (n.lengthSq() < 1e-10) n.copy(radial);       // a pole: no tangent frame
    if (n.dot(radial) < 0) n.negate();
    return n.normalize();
  }

  // Hollow shell around S(u,w), cut at w = wRange(u)[1] (and [0] if rimStart),
  // closed by a rounded lip of the given thickness. See the header.
  function buildShell(THREE, o) {
    const { S, uRange, wRange, uSeg, uPeriodic, thickness, colors } = o;
    const center = o.center || new THREE.Vector3();
    const rimStart = !!o.rimStart, segs = o.segs || { outer: 40, rim: 8, inner: 40 };
    const cOuter = colors.outer, cInner = colors.inner, cRim = colors.rim;
    const tPeriodic = rimStart;

    const rows = [];
    const push = (kind, n, end) => { for (let i = 0; i < n + (end ? 1 : 0); i++) rows.push({ kind, s: i / n }); };
    push('outer', segs.outer, false);
    push('rimEnd', segs.rim, false);
    push('inner', segs.inner, !tPeriodic);
    if (rimStart) push('rimStart', segs.rim, false);

    const cols = uPeriodic ? uSeg : uSeg + 1, nRows = rows.length;
    const pos = new Float32Array(cols * nRows * 3), col = new Float32Array(cols * nRows * 3);
    const c = new THREE.Color(), eps = 1e-3;
    for (let r = 0; r < nRows; r++) {
      const { kind, s } = rows[r];
      for (let i = 0; i < cols; i++) {
        const u = uRange[0] + (i / uSeg) * (uRange[1] - uRange[0]);
        const [ws, we] = wRange(u);
        let P;
        if (kind === 'outer') {
          P = S(u, ws + s * (we - ws));
          c.copy(cOuter);
          if (s > 0.85) c.lerp(cRim, (s - 0.85) / 0.15);
          if (rimStart && s < 0.15) c.lerp(cRim, 1 - s / 0.15);
        } else if (kind === 'inner') {
          const w = we - s * (we - ws);
          P = S(u, w).addScaledVector(surfaceNormal(THREE, S, center, u, w, eps), -thickness);
          c.copy(cInner);
          if (s < 0.15) c.lerp(cRim, 1 - s / 0.15);
          if (rimStart && s > 0.85) c.lerp(cRim, (s - 0.85) / 0.15);
        } else {
          const w = kind === 'rimEnd' ? we : ws;
          const O = S(u, w), N = surfaceNormal(THREE, S, center, u, w, eps);
          const I = O.clone().addScaledVector(N, -thickness);
          const T = S(u, w + eps).sub(S(u, w - eps)).normalize();
          const bulge = thickness * 0.5 * Math.sin(PI * s);
          P = kind === 'rimEnd' ? O.lerp(I, s).addScaledVector(T, bulge) : I.lerp(O, s).addScaledVector(T, -bulge);
          c.copy(cRim);
        }
        const k = (r * cols + i) * 3;
        pos[k] = P.x; pos[k + 1] = P.y; pos[k + 2] = P.z;
        col[k] = c.r; col[k + 1] = c.g; col[k + 2] = c.b;
      }
    }
    const idx = [];
    const at = (i, r) => ((r % nRows) * cols) + (i % cols);
    for (let r = 0; r < (tPeriodic ? nRows : nRows - 1); r++)
      for (let i = 0; i < uSeg; i++) idx.push(at(i, r), at(i + 1, r), at(i, r + 1), at(i + 1, r), at(i + 1, r + 1), at(i, r + 1));
    // Outward winding on the outer surface, whichever way S happens to turn.
    {
      const r = Math.floor(segs.outer / 2), i = Math.floor(uSeg / 4);
      const a = new THREE.Vector3().fromArray(pos, at(i, r) * 3);
      const b = new THREE.Vector3().fromArray(pos, at(i + 1, r) * 3).sub(a);
      const d = new THREE.Vector3().fromArray(pos, at(i, r + 1) * 3).sub(a);
      if (b.cross(d).dot(a.sub(center)) < 0)
        for (let t = 0; t < idx.length; t += 3) { const tmp = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = tmp; }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  // Closed rounded-rectangle profile; top edge gets its own colour so a cut
  // membrane reads as a pale lip on a coloured wall.
  function roundedRectProfile(THREE, w, h, r, colorSide, colorTop, cornerSeg = 4) {
    const pts = [];
    const corners = [[w / 2 - r, h / 2 - r, 0], [-w / 2 + r, h / 2 - r, PI / 2], [-w / 2 + r, -h / 2 + r, PI], [w / 2 - r, -h / 2 + r, 3 * PI / 2]];
    for (const [cx, cy, a0] of corners)
      for (let i = 0; i <= cornerSeg; i++) {
        const a = a0 + (i / cornerSeg) * (PI / 2);
        const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
        pts.push({ x, y, color: y >= h / 2 - r * 1.001 ? colorTop : colorSide });
      }
    return pts;
  }

  // Sweep a closed profile along a polyline; x is side, y is up (kept against `up`).
  function sweepProfile(THREE, points, profile, opts = {}) {
    const up = opts.up || new THREE.Vector3(0, 1, 0), scales = opts.scales || null;
    const n = points.length, m = profile.length;
    const pos = [], col = [], idx = [], frames = [];
    const T = new THREE.Vector3(), side = new THREE.Vector3(), upv = new THREE.Vector3(), v = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      T.subVectors(points[Math.min(i + 1, n - 1)], points[Math.max(i - 1, 0)]).normalize();
      side.crossVectors(T, up);
      if (side.lengthSq() < 1e-8) side.crossVectors(T, new THREE.Vector3(1, 0, 0));
      side.normalize();
      upv.crossVectors(side, T).normalize();
      frames.push([side.clone(), upv.clone()]);
      const [sx, sy] = scales ? scales[i] : [1, 1];
      for (const pr of profile) {
        v.copy(points[i]).addScaledVector(side, pr.x * sx).addScaledVector(upv, pr.y * sy);
        pos.push(v.x, v.y, v.z); col.push(pr.color.r, pr.color.g, pr.color.b);
      }
    }
    for (let i = 0; i < n - 1; i++)
      for (let j = 0; j < m; j++) {
        const a = i * m + j, b = i * m + (j + 1) % m, c = (i + 1) * m + (j + 1) % m, d = (i + 1) * m + j;
        idx.push(a, b, c, a, c, d);
      }
    for (const end of [0, n - 1]) {                    // caps: a fan on the end profile
      const base = pos.length / 3, [sx, sy] = scales ? scales[end] : [1, 1], [sd, uv] = frames[end];
      pos.push(points[end].x, points[end].y, points[end].z);
      col.push(profile[0].color.r, profile[0].color.g, profile[0].color.b);
      for (const pr of profile) {
        v.copy(points[end]).addScaledVector(sd, pr.x * sx).addScaledVector(uv, pr.y * sy);
        pos.push(v.x, v.y, v.z); col.push(pr.color.r, pr.color.g, pr.color.b);
      }
      for (let j = 0; j < m; j++) idx.push(base, base + 1 + j, base + 1 + (j + 1) % m);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  function displace(geometry, fn) {
    const p = geometry.attributes.position;
    for (let i = 0; i < p.count; i++) { const [x, y, z] = fn(p.getX(i), p.getY(i), p.getZ(i)); p.setXYZ(i, x, y, z); }
    p.needsUpdate = true;
    geometry.computeVertexNormals();
    return geometry;
  }
  /* ---- the kit ------------------------------------------------------- */

  const KIT_DEFAULTS = { seed: 1234 };

  function kit(THREE, opts = {}) {
    const P = Object.assign({}, KIT_DEFAULTS, opts);
    const noise = makeNoise(7);            // shape noise: fixed, so every cell has the same grain
    const rand = seededRandom(P.seed);
    const rr = (a, b) => a + (b - a) * rand();
    const V3 = THREE.Vector3;
    const col = hex => new THREE.Color(hex).convertSRGBToLinear();
    const ORG = global.MolLib.PALETTE.organelles;
    const shellOf = o => ({ outer: col(o.outer), inner: col(o.inner), rim: col(o.rim) });
    const mat = o => {
      const m = new THREE.MeshPhysicalMaterial(Object.assign({ roughness: 0.5, clearcoat: 0.2, clearcoatRoughness: 0.4 }, o));
      if (o.color) m.color = col(o.color);
      if (o.emissive) m.emissive = col(o.emissive);
      return m;
    };
    const dirUW = (u, w) => new V3(Math.sin(w) * Math.cos(u), -Math.cos(w), Math.sin(w) * Math.sin(u));

    /* nucleus: a cut sphere with nucleolus, chromatin and pore rings. The
       envelope is TWO membranes with a lumen between them, which is what the
       shell's thickness is; that lumen is continuous with the ER's, which is
       why roughER is handed this builder's R and hugs it. */
    function nucleus(o = {}) {
      const R = o.R || 3.6, th = o.thickness || 0.22;
      const g = new THREE.Group();
      const radius = d => R * (1 + 0.03 * noise.fbm(d.x * 2 + 7, d.y * 2, d.z * 2, 2));
      const S = (u, w) => { const d = dirUW(u, w); return d.multiplyScalar(radius(d)); };
      const cut = u => PI * 0.6 + 0.03 * Math.sin(3 * u + 0.5) + 0.02 * Math.sin(7 * u);

      const shell = new THREE.Mesh(buildShell(THREE, {
        S, uRange: [0, 2 * PI], wRange: u => [0, cut(u)], uSeg: 128, uPeriodic: true,
        thickness: th, segs: { outer: 48, rim: 8, inner: 48 },
        colors: shellOf(ORG.nucleus),
      }), mat({ vertexColors: true, roughness: 0.4, clearcoat: 0.5 }));
      g.add(shell);

      // Parts scale with the envelope. A nucleus built smaller than the
      // animal cell's 3.6 otherwise keeps full-size pores and reads as a
      // blackberry; k is 1 at 3.6, so that cell is untouched.
      const k = R / 3.6;
      const ng = displace(new THREE.SphereGeometry(1.05 * k, 48, 32), (x, y, z) => {
        const k = 1 + 0.06 * noise.fbm(x * 2.2 + 1, y * 2.2, z * 2.2, 2); return [x * k, y * k, z * k];
      });
      const nucleolus = new THREE.Mesh(ng, mat({ color: ORG.nucleus.nucleolus, emissive: '#ff8a12', emissiveIntensity: 0.45, roughness: 0.55, clearcoat: 0.2 }));
      nucleolus.position.set(0.35 * k, -0.75 * k, 0.25 * k);
      g.add(nucleolus);

      const chromMat = mat({ color: ORG.nucleus.chromatin, roughness: 0.6, clearcoat: 0 });
      for (let i = 0; i < (o.chromatin || 3); i++) {
        const pts = [];
        for (let j = 0; j < 5; j++) pts.push(new V3(rr(-1, 1), rr(-1, 0.3), rr(-1, 1)).normalize().multiplyScalar(rr(0.6, R - 0.6)));
        const t = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.6), 48, 0.05 * k, 6, false), chromMat);
        g.add(t);
      }
      const poreGeo = new THREE.TorusGeometry(0.2 * k, 0.07 * k, 8, 18);
      const poreMat = mat({ color: ORG.nucleus.pore, roughness: 0.55, clearcoat: 0 });
      for (let i = 0; i < (o.pores === undefined ? 60 : o.pores); i++) {
        const u = rr(0, 2 * PI), w = rr(0.12 * PI, cut(u) - 0.06 * PI);
        const p = S(u, w), n = surfaceNormal(THREE, S, new V3(), u, w);
        const pore = new THREE.Mesh(poreGeo, poreMat);
        pore.position.copy(p).addScaledVector(n, 0.03 * k);
        pore.lookAt(p.clone().add(n));
        g.add(pore);
      }
      g.userData.parts = { shell, nucleolus };
      g.userData.surface = { R, S, cut };
      return g;
    }

    /* mitochondrion: a half capsule with cristae ribbons under the cut. The
       cristae are swept folds of the INNER membrane, not discs laid inside a
       bag — the fold is the surface area, and the surface area is the point. */
    function mitochondrion(o = {}) {
      const g = new THREE.Group();
      const r = o.r || 0.55, L = o.L || 0.95, th = o.thickness || 0.09;
      const cap = PI * r / 2, total = PI * r + 2 * L;
      const prof = u => {
        const s = u * total;
        if (s < cap) { const a = -PI / 2 + s / r; return [-L + r * Math.sin(a), r * Math.cos(a)]; }
        if (s < cap + 2 * L) return [-L + (s - cap), r];
        const a = (s - cap - 2 * L) / r; return [L + r * Math.sin(a), r * Math.cos(a)];
      };
      const S = (u, w) => {
        const [x, rho] = prof(u);
        const bump = 1 + 0.05 * noise.noise3(x * 2.5, Math.cos(w) * 1.5, Math.sin(w) * 1.5 + 4.2);
        return new V3(x, -rho * bump * Math.sin(w), rho * bump * Math.cos(w));
      };
      const shell = new THREE.Mesh(buildShell(THREE, {
        S, uRange: [0, 1], wRange: () => [0, PI], uSeg: 72, uPeriodic: false, rimStart: true,
        thickness: th, segs: { outer: 40, rim: 7, inner: 40 },
        colors: shellOf(ORG.mitochondrion),
      }), mat({ vertexColors: true, roughness: 0.42, clearcoat: 0.5 }));
      g.add(shell);
      const profile = roundedRectProfile(THREE, 0.1, 0.5, 0.045, col(ORG.mitochondrion.cristaSide), col(ORG.mitochondrion.cristaTop));
      const cristaMat = mat({ vertexColors: true, roughness: 0.5, clearcoat: 0.3, side: THREE.DoubleSide });
      const n = o.cristae || 7, h = 0.5;
      for (let i = 0; i < n; i++) {
        const xi = -L * 0.9 + (i / (n - 1)) * 1.8 * L + rr(-0.05, 0.05), ax = Math.abs(xi);
        const rho = ax <= L ? r : Math.sqrt(Math.max(0, r * r - (ax - L) * (ax - L)));
        const ri = rho - th - 0.05, pts = [], scales = [];
        for (let k = 0; k <= 16; k++) {
          const z = (-0.9 + 1.8 * k / 16) * ri;
          const depth = Math.sqrt(Math.max(0, ri * ri - z * z));
          const sy = clamp((depth - 0.04) / h, 0.15, 1);      // shorter where the wall is nearer
          pts.push(new V3(xi + 0.09 * Math.sin(z * 7 + i * 1.3), -0.05 - h * sy / 2, z));
          scales.push([1, sy]);
        }
        g.add(new THREE.Mesh(sweepProfile(THREE, pts, profile, { scales }), cristaMat));
      }
      g.userData.parts = { shell };
      return g;
    }

    /* Golgi: a stack of curved, ragged-edged discs with vesicles. A plant
       cell has many of these scattered and an animal cell one ribbon by the
       nucleus; that difference is the host's placement, not this geometry.
       `spacing` exists because a stack only reads AS a stack when the gap is
       big enough for the eye to separate the cisternae at the size it is
       drawn — under about a tenth of the disc's width they merge into one
       lump, and a Golgi that is a lump is indistinguishable from a vesicle. */
    function golgi(o = {}) {
      const g = new THREE.Group();
      const gm = mat({ color: ORG.golgi.outer, roughness: 0.45, clearcoat: 0.5 });
      const n = o.cisternae || 7, gap = o.spacing || 0.3;
      for (let i = 0; i < n; i++) {
        const rx = 1.15 + 0.7 * Math.sin(PI * i / (n - 1)) + rr(-0.08, 0.08), rz = rx * 0.78;
        const geo = displace(new THREE.SphereGeometry(1, 72, 24), (x, y, z) => {
          const ang = Math.atan2(z, x);
          const edge = 1 + 0.11 * noise.noise3(Math.cos(ang) * 2.2 + i * 3.7, Math.sin(ang) * 2.2, i * 0.9);
          const X = x * rx * edge, Z = z * rz * edge;
          return [X, y * 0.075 + 0.11 * (X * X + Z * Z), Z];
        });
        const m = new THREE.Mesh(geo, gm);
        m.position.y = i * gap;
        g.add(m);
      }
      const vm = mat({ color: ORG.golgi.vesicle, roughness: 0.4, clearcoat: 0.6 });
      for (let i = 0; i < (o.vesicles === undefined ? 8 : o.vesicles); i++) {
        const ang = rr(0, 2 * PI), rad = rr(1.9, 2.5);
        const v = new THREE.Mesh(new THREE.SphereGeometry(rr(0.1, 0.22), 16, 12), vm);
        v.position.set(Math.cos(ang) * rad, rr(-0.3, n * gap + 0.3), Math.sin(ang) * rad * 0.8);
        g.add(v);
      }
      return g;
    }

    /* rough ER: ribbons around the nucleus, ribosomes on their edges.
       BUILT IN THE HOST'S SPACE, not at the origin, because it is the one
       organelle whose shape is not its own: it wraps a particular nucleus at
       `center` and stops at whatever boundary `clamp` enforces — a plasma
       membrane in one cell, a wall in the other. `clamp` gets a point and
       returns it, moved inside if it has to be. Returns the group and the
       ribosome positions, which the host feeds to its own instanced mesh so
       the studs and the cytoplasm speckle stay one draw call. */
    function roughER(o = {}) {
      const Rn = o.Rn || 3.6, center = o.center || new V3(), y0base = o.y0 === undefined ? -3.3 : o.y0;
      const clampTo = o.clamp || (p => p);
      const arcs = o.arcs || [{ a0: -0.38 * PI, a1: 0.58 * PI, count: 4 }, { a0: 0.80 * PI, a1: 1.22 * PI, count: 3 }];
      const group = new THREE.Group(), ribosomes = [];
      const profile = roundedRectProfile(THREE, 0.18, 0.62, 0.07, col(ORG.er.side), col(ORG.er.top));
      const erMat = mat({ vertexColors: true, roughness: 0.45, clearcoat: 0.5, side: THREE.DoubleSide });
      for (const arc of arcs)
        for (let k = 0; k < arc.count; k++) {
          const rk = Rn + 0.75 + k * 0.6, y0 = y0base + 0.12 * k;
          const a0 = arc.a0 + rr(0, 0.12), a1 = arc.a1 - rr(0, 0.12), steps = Math.ceil((a1 - a0) / 0.035);
          const pts = [];
          for (let s = 0; s <= steps; s++) {
            const a = a0 + (a1 - a0) * s / steps;
            const rad = rk + 0.28 * Math.sin(a * 9 + k * 1.7) + 0.2 * noise.noise3(Math.cos(a) * 3, Math.sin(a) * 3, k * 2.1);
            const y = y0 + 0.28 * Math.sin(a * 4 + k * 0.9) + 0.15 * noise.noise3(a * 2, k, 5);
            pts.push(clampTo(new V3(center.x + Math.cos(a) * rad, y, center.z + Math.sin(a) * rad)));
          }
          group.add(new THREE.Mesh(sweepProfile(THREE, pts, profile), erMat));
          for (let s = 0; s < pts.length; s += 2) {
            const T = pts[Math.min(s + 1, pts.length - 1)].clone().sub(pts[Math.max(s - 1, 0)]).normalize();
            const side = new V3().crossVectors(T, new V3(0, 1, 0)).normalize();
            for (let c = 0, cnt = rand() < 0.6 ? 1 : 2; c < cnt; c++)
              ribosomes.push(pts[s].clone().addScaledVector(side, rand() > 0.5 ? 0.11 : -0.11).add(new V3(0, rr(-0.28, 0.33), 0)));
          }
        }
      return { group, ribosomes };
    }


    /* A filled cut face for the boundary S(u, cut(u)): a fan from the centre
       out to the rim, inset so it sits just inside the shell's inner wall.
       An organelle that is FULL of something needs one, or the cut reads as
       a tube rather than as a cross-section through a liquid. */
    function cutCap(S, cut, uSeg, rings, inset) {
      const pos = [], idx = [], c = new V3();
      const rim = [];
      for (let i = 0; i < uSeg; i++) {
        const u = (i / uSeg) * 2 * PI;
        rim.push(S(u, cut(u)).multiplyScalar(1 - inset));
        c.add(rim[i]);
      }
      c.multiplyScalar(1 / uSeg);
      for (let r = 0; r <= rings; r++) {
        const t = r / rings;
        for (let i = 0; i < uSeg; i++) {
          const p = c.clone().lerp(rim[i], t);
          pos.push(p.x, p.y, p.z);
        }
      }
      for (let r = 0; r < rings; r++)
        for (let i = 0; i < uSeg; i++) {
          const a = r * uSeg + i, b = r * uSeg + (i + 1) % uSeg;
          idx.push(a, b, a + uSeg, b, b + uSeg, a + uSeg);
        }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      return g;
    }

    /* ---- plastids ------------------------------------------------------
       A plastid is the OTHER endosymbiont, and it is built by the same shell
       code as the mitochondrion on purpose: two membranes with a lumen
       between them, and a folded internal membrane doing the work. That
       kinship is drawn, not coloured — hue is spent on identity, so a
       chloroplast is green and a mitochondrion orange, and what says they
       are the same kind of thing is that they are the same construction.
       chloroplast and amyloplast run through the SAME builder for the same
       reason, and differ in their envelope colour and their contents:
       thylakoid stacks, or starch. They are one organelle in two states, and
       the shared construction is what says so. */

    function plastidShell(o, colors) {
      const a = o.a || 2.3, b = o.b || 1.05, c = o.c || 1.5, th = o.thickness || 0.075;
      const radius = d => 1 + 0.035 * noise.fbm(d.x * 2.2 + 5, d.y * 2.2 + 2, d.z * 2.2, 2);
      const S = (u, w) => { const d = dirUW(u, w); const k = radius(d); return new V3(d.x * a * k, d.y * b * k, d.z * c * k); };
      const cut = u => PI * 0.58 + 0.03 * Math.sin(2 * u + 1.1) + 0.02 * Math.sin(5 * u);
      const mesh = new THREE.Mesh(buildShell(THREE, {
        S, uRange: [0, 2 * PI], wRange: u => [0, cut(u)], uSeg: 120, uPeriodic: true,
        thickness: th, segs: { outer: 44, rim: 8, inner: 44 },
        colors: shellOf(colors),
      }), mat({ vertexColors: true, roughness: 0.44, clearcoat: 0.45 }));
      return { mesh, a, b, c, th };
    }

    /* chloroplast: grana are STACKS of thylakoid discs, joined by lamellae.
       Drawn as stacks and not as a green fill because the stacking is the
       surface area, and the surface area is where the light reactions run. */
    function chloroplast(o = {}) {
      const g = new THREE.Group();
      const { mesh, a, b, c, th } = plastidShell(o, ORG.chloroplast);
      g.add(mesh);
      const thyMat = mat({ color: ORG.chloroplast.thylakoid, roughness: 0.5, clearcoat: 0.3 });
      const lamMat = mat({ color: ORG.chloroplast.stroma, roughness: 0.6, clearcoat: 0.1 });
      const disc = new THREE.CylinderGeometry(1, 1, 1, 20);
      const grana = o.grana || 7, ry = b - th - 0.12;
      const slots = [];
      for (let i = 0; i < grana; i++) {
        const t = grana === 1 ? 0.5 : i / (grana - 1);
        slots.push([(-0.62 + 1.24 * t) * (a - th) + rr(-0.08, 0.08), rr(-0.42, 0.42) * (c - th)]);
      }
      for (const [x, z] of slots) {
        const stack = new THREE.Group();
        const n = 4 + (rand() < 0.5 ? 1 : 0), rad = (0.26 + rr(0, 0.07)) * a;
        for (let i = 0; i < n; i++) {
          const d = new THREE.Mesh(disc, thyMat);
          d.scale.set(rad, 0.075 * b, rad);
          d.position.y = (i - (n - 1) / 2) * 0.115 * b;
          stack.add(d);
        }
        stack.position.set(x, -0.34 * b + rr(-0.06, 0.06) * b, z);
        stack.rotation.set(rr(-0.25, 0.25), rand() * PI, rr(-0.25, 0.25));
        g.add(stack);
      }
      // stroma lamellae: flat sheets running between the grana
      // Lamellae stay well inside the envelope: a sheet sized off the outer
      // ellipsoid pokes through the cut wall and reads as a bright shard.
      for (let i = 0; i < (o.lamellae === undefined ? 3 : o.lamellae); i++) {
        const sheet = new THREE.Mesh(disc, lamMat);
        sheet.scale.set((a - th) * 0.42, 0.02 * b, (a - th) * 0.42);
        sheet.position.set(rr(-0.18, 0.18) * a, -0.5 * b + i * 0.16 * b, rr(-0.14, 0.14) * c);
        sheet.rotation.set(rr(-0.1, 0.1), rand() * PI, rr(-0.1, 0.1));
        g.add(sheet);
      }
      g.userData.parts = { shell: mesh };
      return g;
    }

    /* amyloplast: the same envelope, filled with starch grains instead.
       A grain grows in layers around an off-centre hilum, which is why it is
       drawn as rings around a point that is not the middle. */
    function amyloplast(o = {}) {
      const g = new THREE.Group();
      const { mesh, a, b, c, th } = plastidShell(Object.assign({ a: 2.0, b: 1.35, c: 1.55 }, o), ORG.amyloplast);
      g.add(mesh);
      const grainMat = mat({ color: ORG.amyloplast.starch, roughness: 0.42, clearcoat: 0.35 });
      const ringMat = mat({ color: ORG.amyloplast.hilum, roughness: 0.55, clearcoat: 0.1 });
      const n = o.grains || 1;
      for (let i = 0; i < n; i++) {
        const x = n > 1 ? (i - (n - 1) / 2) * 0.9 * (a - th) : 0;
        const gr = new THREE.Group();
        const R0 = (n > 1 ? 0.52 : 0.78) * Math.min(a - th, c - th);
        const shape = (m, k) => {
          const e = new THREE.Mesh(displace(new THREE.SphereGeometry(1, 28, 20), (px, py, pz) => {
            const d = 1 + 0.05 * noise.noise3(px * 3 + i * 4.1, py * 3, pz * 3); return [px * d, py * d, pz * d];
          }), m);
          e.scale.set(R0 * k, R0 * k * 0.82, R0 * k * 0.9);
          return e;
        };
        gr.add(shape(grainMat, 1));
        // growth rings around an off-centre hilum
        const off = new V3(0.30 * R0, 0.20 * R0, 0.12 * R0);
        for (const k of [0.66, 0.40]) {
          const r = shape(k === 0.40 ? grainMat : ringMat, k);
          r.position.copy(off).multiplyScalar(1 - k);
          gr.add(r);
        }
        const hil = shape(ringMat, 0.17);
        hil.position.copy(off);
        gr.add(hil);
        gr.position.set(x, -0.1 * b, rr(-0.12, 0.12) * c);
        gr.rotation.y = rand() * PI;
        g.add(gr);
      }
      g.userData.parts = { shell: mesh };
      return g;
    }

    /* central vacuole: one shell, a tonoplast, and sap. The plant cell drives
       its size directly — that swelling is the turgor lesson — so this takes
       a radius and nothing about state. */
    function vacuole(o = {}) {
      const g = new THREE.Group();
      const R = o.R || 4.2, sx = o.sx === undefined ? 1.25 : o.sx, sy = o.sy === undefined ? 0.62 : o.sy, sz = o.sz === undefined ? 0.98 : o.sz;
      const radius = d => R * (1 + 0.055 * noise.fbm(d.x * 1.6 + 11, d.y * 1.6, d.z * 1.6, 3));
      const S = (u, w) => { const d = dirUW(u, w); const k = radius(d); return new V3(d.x * k * sx, d.y * k * sy, d.z * k * sz); };
      const cut = u => PI * 0.6 + 0.04 * Math.sin(3 * u + 2) + 0.025 * Math.sin(6 * u);
      const shell = new THREE.Mesh(buildShell(THREE, {
        S, uRange: [0, 2 * PI], wRange: u => [0, cut(u)], uSeg: 140, uPeriodic: true,
        thickness: o.thickness || 0.14, segs: { outer: 50, rim: 8, inner: 50 },
        colors: shellOf(ORG.vacuole),
      }), mat({ vertexColors: true, roughness: 0.22, clearcoat: 0.8, clearcoatRoughness: 0.15 }));
      g.add(shell);
      // The sap: the shell again, one step in, PLUS a filled cut face. The
      // face is what makes the vacuole read as full rather than as a tube,
      // and a central vacuole that reads as empty is the wrong lesson.
      // Translucent, because a vacuole is mostly water and the cytoplasm
      // behind it should show through. Opaque sap reads as a solid bead and
      // hides that the cell is one continuous space around it.
      const sapMat = mat({ color: ORG.vacuole.sap, roughness: 0.35, clearcoat: 0.5, transparent: true, opacity: 0.7 });
      const sap = new THREE.Mesh(shell.geometry, sapMat);
      sap.scale.setScalar(0.955);
      g.add(sap);
      const face = new THREE.Mesh(cutCap(S, cut, 140, 6, 0.055), sapMat);
      g.add(face);
      g.userData.parts = { shell, sap };
      return g;
    }

    return { rand, rr, noise, col, mat, shellOf, dirUW, ORG,
             nucleus, mitochondrion, golgi, roughER, chloroplast, amyloplast, vacuole };
  }

  global.CellOrganelles = {
    kit, seededRandom, makeNoise, surfaceNormal, buildShell, roundedRectProfile, sweepProfile, displace,
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
