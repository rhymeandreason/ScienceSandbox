/* =============================================================================
 *  cell/cutaway.js — a cell cut open, with its organelles, as one box
 * =============================================================================
 *  The textbook cutaway (a bowl of cytoplasm with a nucleus, mitochondria, ER,
 *  Golgi, centrioles, vesicles) built procedurally from noise, on r128 and
 *  kit/card-stage.js. Ported from an ES-module Three 0.169 prototype; the
 *  simplex noise, the shell builder and the profile sweep it needed are
 *  inlined here because nothing else in the repo wants them yet.
 *
 *      Cutaway.create(THREE, root, camera, opts)   the model: root is yours
 *      Cutaway.mount(el, params)                   one box, one handle
 *
 *  mount adds hover (an organelle brightens), click (the camera flies to
 *  it; empty space or double-click flies home) and a slow turn that pauses
 *  while the reader drags. flyTo/home are in Stage's own theta/phi/r.
 *
 *  PROP TIER, AND NOT A SCALE. Nothing here is measured and the scene unit
 *  is not a micrometre: organelle sizes are a diagram's, chosen so every
 *  one reads from the home view. A page must not put a number beside it.
 *
 *  THE SHELL BUILDER is the one idea worth keeping. buildShell takes any
 *  parametric surface S(u,w), keeps w up to a per-u cut, offsets an inner
 *  wall along the finite-difference normal and closes the two with a
 *  rounded lip, so a cut organelle has real membrane thickness instead of
 *  a clipped single surface. Outer, lip and inner are vertex colours, which
 *  is why the materials carry no `color`.
 *
 *  COLOURS ARE TYPED AS sRGB AND CONVERTED. r128 has no colour management:
 *  a hex string lands in the material as linear, and with sRGBEncoding on
 *  the renderer it draws paler than typed. Every colour here goes through
 *  col(), including the vertex colours, so the hex is what shows.
 * ========================================================================== */
(function (global) {
  'use strict';

  const PI = Math.PI;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

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

  /* ---- the model ----------------------------------------------------- */

  const DEFAULTS = { seed: 1234, tilt: 0.32 };

  function create(THREE, root, camera, opts = {}) {
    const P = Object.assign({}, DEFAULTS, opts);
    const noise = makeNoise(7);
    const rand = seededRandom(P.seed);
    const rr = (a, b) => a + (b - a) * rand();
    const V3 = THREE.Vector3;
    const col = hex => new THREE.Color(hex).convertSRGBToLinear();
    const mat = o => {
      const m = new THREE.MeshPhysicalMaterial(Object.assign({ roughness: 0.5, clearcoat: 0.2, clearcoatRoughness: 0.4 }, o));
      if (o.color) m.color = col(o.color);
      if (o.emissive) m.emissive = col(o.emissive);
      return m;
    };
    const organelles = [], occupied = [];      // occupied: spheres the speckles avoid
    const register = (obj, name) => { obj.userData.organelle = name; organelles.push(obj); return obj; };
    const dirUW = (u, w) => new V3(Math.sin(w) * Math.cos(u), -Math.cos(w), Math.sin(w) * Math.sin(u));

    const cell = new THREE.Group();
    cell.rotation.x = P.tilt;                   // the opening leans toward the reader
    root.add(cell);

    /* cell body: a flattened, noise-deformed sphere cut on a wavy line */
    const R = 10, TH = 0.55, YS = 0.72;
    const cellRadius = d => R * (1 + 0.055 * noise.fbm(d.x * 1.4 + 3.1, d.y * 1.4 + 1.7, d.z * 1.4, 3)
      + 0.05 * noise.noise3(d.x * 0.6 + 9, d.y * 0.6, d.z * 0.6));
    const innerR = d => cellRadius(d) - TH;
    const cellS = (u, w) => { const d = dirUW(u, w); const p = d.clone().multiplyScalar(cellRadius(d)); p.y *= YS; return p; };
    const cellCut = u => PI * 0.56 + 0.06 * Math.sin(2 * u + 1) + 0.035 * Math.sin(5 * u + 2.3)
      + 0.05 * noise.noise3(Math.cos(u) * 1.5, Math.sin(u) * 1.5, 2);
    {
      const g = buildShell(THREE, {
        S: cellS, uRange: [0, 2 * PI], wRange: u => [0, cellCut(u)], uSeg: 200, uPeriodic: true,
        thickness: TH, segs: { outer: 70, rim: 12, inner: 70 },
        colors: { outer: col('#ee8e84'), inner: col('#a8132a'), rim: col('#f4b0a6') },
      });
      const mesh = new THREE.Mesh(g, mat({ vertexColors: true, roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.25, emissive: '#3a0008', emissiveIntensity: 0.3 }));
      mesh.castShadow = mesh.receiveShadow = true;
      cell.add(mesh);
    }
    const unsq = p => new V3(p.x, p.y / YS, p.z);
    const insideCell = (p, margin = 0) => { const q = unsq(p); return q.length() < innerR(q.clone().normalize()) - margin; };
    const clampToCell = (p, margin) => {
      const q = unsq(p), lim = innerR(q.clone().normalize()) - margin;
      if (q.length() > lim) { q.setLength(lim); p.set(q.x, q.y * YS, q.z); }
      return p;
    };
    const floorY = (x, z) => {
      let y = -(R - TH);
      for (let i = 0; i < 4; i++) { const ri = innerR(new V3(x, y, z).normalize()); y = -Math.sqrt(Math.max(0.01, ri * ri - x * x - z * z)); }
      return y * YS;
    };

    /* nucleus: a cut sphere with nucleolus, chromatin and pore rings */
    const nucleus = new THREE.Group();
    nucleus.position.set(1.6, -2.3, -1.4);
    nucleus.rotation.set(0.55, 0.25, 0);
    cell.add(register(nucleus, 'nucleus'));
    const Rn = 3.6;
    const nucRadius = d => Rn * (1 + 0.03 * noise.fbm(d.x * 2 + 7, d.y * 2, d.z * 2, 2));
    const nucS = (u, w) => { const d = dirUW(u, w); return d.multiplyScalar(nucRadius(d)); };
    const nucCut = u => PI * 0.6 + 0.03 * Math.sin(3 * u + 0.5) + 0.02 * Math.sin(7 * u);
    let nucleolus;
    {
      const g = buildShell(THREE, {
        S: nucS, uRange: [0, 2 * PI], wRange: u => [0, nucCut(u)], uSeg: 128, uPeriodic: true,
        thickness: 0.22, segs: { outer: 48, rim: 8, inner: 48 },
        colors: { outer: col('#3f6cb5'), inner: col('#4a78c0'), rim: col('#9cb9e6') },
      });
      const mesh = new THREE.Mesh(g, mat({ vertexColors: true, roughness: 0.4, clearcoat: 0.5 }));
      mesh.castShadow = mesh.receiveShadow = true;
      nucleus.add(mesh);

      const ng = displace(new THREE.SphereGeometry(1.05, 48, 32), (x, y, z) => {
        const k = 1 + 0.06 * noise.fbm(x * 2.2 + 1, y * 2.2, z * 2.2, 2); return [x * k, y * k, z * k];
      });
      nucleolus = new THREE.Mesh(ng, mat({ color: '#f6b64a', emissive: '#ff8a12', emissiveIntensity: 0.45, roughness: 0.55, clearcoat: 0.2 }));
      nucleolus.position.set(0.35, -0.75, 0.25);
      nucleolus.castShadow = true;
      nucleus.add(nucleolus);

      const chromMat = mat({ color: '#3d64a8', roughness: 0.6, clearcoat: 0 });
      for (let i = 0; i < 3; i++) {
        const pts = [];
        for (let j = 0; j < 5; j++) pts.push(new V3(rr(-1, 1), rr(-1, 0.3), rr(-1, 1)).normalize().multiplyScalar(rr(0.6, Rn - 0.6)));
        const t = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.6), 48, 0.05, 6, false), chromMat);
        t.castShadow = true;
        nucleus.add(t);
      }
      const poreGeo = new THREE.TorusGeometry(0.2, 0.07, 8, 18);
      const poreMat = mat({ color: '#274a8f', roughness: 0.55, clearcoat: 0 });
      for (let i = 0; i < 60; i++) {
        const u = rr(0, 2 * PI), w = rr(0.12 * PI, nucCut(u) - 0.06 * PI);
        const p = nucS(u, w), n = surfaceNormal(THREE, nucS, new V3(), u, w);
        const pore = new THREE.Mesh(poreGeo, poreMat);
        pore.position.copy(p).addScaledVector(n, 0.03);
        pore.lookAt(p.clone().add(n));
        nucleus.add(pore);
      }
    }
    const nucPos = nucleus.position.clone();

    /* mitochondria: a half capsule with cristae ribbons under the cut */
    function makeMito() {
      const g = new THREE.Group();
      const r = 0.55, L = 0.95, th = 0.09, cap = PI * r / 2, total = PI * r + 2 * L;
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
        colors: { outer: col('#e0552f'), inner: col('#e2775b'), rim: col('#f4b8a4') },
      }), mat({ vertexColors: true, roughness: 0.42, clearcoat: 0.5 }));
      shell.castShadow = shell.receiveShadow = true;
      g.add(shell);
      const profile = roundedRectProfile(THREE, 0.1, 0.5, 0.045, col('#f2a3ae'), col('#fff6f7'));
      const cristaMat = mat({ vertexColors: true, roughness: 0.5, clearcoat: 0.3, side: THREE.DoubleSide });
      const n = 7, h = 0.5;
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
        const m = new THREE.Mesh(sweepProfile(THREE, pts, profile, { scales }), cristaMat);
        m.castShadow = true;
        g.add(m);
      }
      return register(g, 'mitochondrion');
    }
    for (const s of [
      { x: -3.0, z: 4.6, ry: 0.35, rx: 0.25 }, { x: 2.4, z: 5.2, ry: -0.6, rx: 0.3 }, { x: 6.2, z: 2.4, ry: 1.25, rx: 0.2 },
      { x: -6.3, z: -3.6, ry: 0.95, rx: 0.15 }, { x: 6.8, z: -3.2, ry: -1.1, rx: 0.1 },
    ]) {
      const m = makeMito();
      m.position.set(s.x, Math.max(floorY(s.x, s.z) + 0.8, -4.2 + rr(-0.6, 0.6)), s.z);
      m.rotation.set(s.rx, s.ry, 0);
      cell.add(m);
      occupied.push({ p: m.position.clone(), r: 1.6 });
    }

    /* Golgi: a stack of curved, ragged-edged discs with vesicles */
    {
      const g = new THREE.Group();
      const gm = mat({ color: '#7c85cf', roughness: 0.45, clearcoat: 0.5 });
      const n = 7;
      for (let i = 0; i < n; i++) {
        const rx = 1.15 + 0.7 * Math.sin(PI * i / (n - 1)) + rr(-0.08, 0.08), rz = rx * 0.78;
        const geo = displace(new THREE.SphereGeometry(1, 72, 24), (x, y, z) => {
          const ang = Math.atan2(z, x);
          const edge = 1 + 0.11 * noise.noise3(Math.cos(ang) * 2.2 + i * 3.7, Math.sin(ang) * 2.2, i * 0.9);
          const X = x * rx * edge, Z = z * rz * edge;
          return [X, y * 0.075 + 0.11 * (X * X + Z * Z), Z];
        });
        const m = new THREE.Mesh(geo, gm);
        m.position.y = i * 0.3;
        m.castShadow = m.receiveShadow = true;
        g.add(m);
      }
      const vm = mat({ color: '#8b93da', roughness: 0.4, clearcoat: 0.6 });
      for (let i = 0; i < 8; i++) {
        const ang = rr(0, 2 * PI), rad = rr(1.9, 2.5);
        const v = new THREE.Mesh(new THREE.SphereGeometry(rr(0.1, 0.22), 16, 12), vm);
        v.position.set(Math.cos(ang) * rad, rr(-0.3, n * 0.3 + 0.3), Math.sin(ang) * rad * 0.8);
        v.castShadow = true;
        g.add(v);
      }
      g.position.set(-6.2, -3.4, 0.6);
      g.rotation.set(0.15, 0.35, -1.45);
      cell.add(register(g, 'golgi'));
      occupied.push({ p: g.position.clone(), r: 2.6 });
    }

    /* rough ER: ribbons around the nucleus, ribosomes on their edges */
    const riboPositions = [];
    {
      const er = new THREE.Group();
      const profile = roundedRectProfile(THREE, 0.18, 0.62, 0.07, col('#d9426d'), col('#f6c0ce'));
      const erMat = mat({ vertexColors: true, roughness: 0.45, clearcoat: 0.5, side: THREE.DoubleSide });
      for (const arc of [{ a0: -0.38 * PI, a1: 0.58 * PI, count: 4 }, { a0: 0.80 * PI, a1: 1.22 * PI, count: 3 }])
        for (let k = 0; k < arc.count; k++) {
          const rk = Rn + 0.75 + k * 0.6, y0 = -3.3 + 0.12 * k;
          const a0 = arc.a0 + rr(0, 0.12), a1 = arc.a1 - rr(0, 0.12), steps = Math.ceil((a1 - a0) / 0.035);
          const pts = [];
          for (let s = 0; s <= steps; s++) {
            const a = a0 + (a1 - a0) * s / steps;
            const rad = rk + 0.28 * Math.sin(a * 9 + k * 1.7) + 0.2 * noise.noise3(Math.cos(a) * 3, Math.sin(a) * 3, k * 2.1);
            const y = y0 + 0.28 * Math.sin(a * 4 + k * 0.9) + 0.15 * noise.noise3(a * 2, k, 5);
            pts.push(clampToCell(new V3(nucPos.x + Math.cos(a) * rad, y, nucPos.z + Math.sin(a) * rad), 0.7));
          }
          const m = new THREE.Mesh(sweepProfile(THREE, pts, profile), erMat);
          m.castShadow = m.receiveShadow = true;
          er.add(m);
          for (let s = 0; s < pts.length; s += 2) {
            const T = pts[Math.min(s + 1, pts.length - 1)].clone().sub(pts[Math.max(s - 1, 0)]).normalize();
            const side = new V3().crossVectors(T, new V3(0, 1, 0)).normalize();
            for (let c = 0, cnt = rand() < 0.6 ? 1 : 2; c < cnt; c++)
              riboPositions.push(pts[s].clone().addScaledVector(side, rand() > 0.5 ? 0.11 : -0.11).add(new V3(0, rr(-0.28, 0.33), 0)));
          }
        }
      cell.add(register(er, 'er'));
    }

    /* centrosome: two centrioles of nine triplets, microtubules out */
    {
      const c = new THREE.Group();
      const cm = mat({ color: '#6fbe62', roughness: 0.5, clearcoat: 0.3 });
      const tube = new THREE.CylinderGeometry(0.035, 0.035, 0.85, 8);
      const centriole = () => {
        const g = new THREE.Group();
        for (let i = 0; i < 9; i++) for (let j = 0; j < 3; j++) {
          const m = new THREE.Mesh(tube, cm), a = (i / 9) * 2 * PI + j * 0.16, ra = 0.2 + j * 0.06;
          m.position.set(Math.cos(a) * ra, 0, Math.sin(a) * ra);
          m.castShadow = true;
          g.add(m);
        }
        return g;
      };
      const c2 = centriole();
      c2.rotation.z = PI / 2;
      c2.position.set(0.45, -0.6, 0.1);
      c.add(centriole(), c2);
      const mtMat = mat({ color: '#8bd07c', roughness: 0.55, clearcoat: 0.1 });
      for (let i = 0; i < 6; i++) {
        const dir = new V3(rr(-1, 0.4), rr(-0.8, 0.2), rr(-0.3, 1)).normalize(), len = rr(1.6, 3.2);
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, len, 6), mtMat);
        m.position.copy(dir).multiplyScalar(len / 2 + 0.4);
        m.quaternion.setFromUnitVectors(new V3(0, 1, 0), dir);
        m.castShadow = true;
        c.add(m);
      }
      c.position.set(-3.3, -2.2, -4.6);
      c.rotation.set(0.4, 0.3, 0.5);
      cell.add(register(c, 'centrosome'));
      occupied.push({ p: c.position.clone(), r: 1.6 });
    }

    /* vesicles, lysosomes, peroxisomes: spheres that keep out of everything */
    {
      const palette = [
        { c: '#f08a3c', e: '#ff5a00', ei: 0.25 }, { c: '#f5a25a' }, { c: '#ec6f95' }, { c: '#6fa1dc' },
        { c: '#98a4e2' }, { c: '#f6c453', e: '#ff9a00', ei: 0.2 }, { c: '#d94f6a' },
      ];
      const placed = [];
      for (let count = 0, tries = 0; count < 18 && tries < 4000; tries++) {
        const d = new V3(rr(-1, 1), rr(-1, -0.15), rr(-1, 1)).normalize();
        const p = d.multiplyScalar(innerR(d) * rr(0.35, 0.92)), rad = rr(0.22, 0.5);
        if (p.y > 0.4 || !insideCell(p, rad + 0.3)) continue;
        if (p.distanceTo(nucPos) < Rn + 0.9 + rad) continue;
        if (placed.some(q => q.distanceTo(p) < 1.4 + rad)) continue;
        if (occupied.some(o => o.p.distanceTo(p) < o.r + rad + 0.3)) continue;
        placed.push(p);
        const pal = palette[Math.floor(rand() * palette.length)], seedK = count;
        const geo = displace(new THREE.SphereGeometry(rad, 32, 24), (x, y, z) => {
          const k = 1 + 0.05 * noise.noise3(x * 4 + seedK, y * 4, z * 4); return [x * k, y * k, z * k];
        });
        const m = new THREE.Mesh(geo, mat({ color: pal.c, emissive: pal.e || '#000000', emissiveIntensity: pal.ei || 0, roughness: 0.35, clearcoat: 0.7 }));
        m.position.copy(p);
        m.castShadow = m.receiveShadow = true;
        cell.add(register(m, 'vesicle'));
        occupied.push({ p: p.clone(), r: rad + 0.1 });
        count++;
      }
    }

    /* free ribosomes: one instanced mesh for the cytoplasm speckle and the ER's studs */
    {
      const N = 1500;
      const inst = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 6, 5),
        new THREE.MeshStandardMaterial({ color: col('#7c1030'), roughness: 0.6 }), N + riboPositions.length);
      const dummy = new THREE.Object3D();
      let i = 0;
      for (let tries = 0; i < N && tries < N * 10; tries++) {
        const d = new V3(rr(-1, 1), rr(-1, 1), rr(-1, 1)).normalize();
        const p = d.multiplyScalar(innerR(d) * Math.cbrt(rand()) * 0.97);
        if (p.y > 0.8 || !insideCell(p, 0.1)) continue;
        if (p.distanceTo(nucPos) < Rn + 0.25) continue;
        if (occupied.some(o => o.p.distanceTo(p) < o.r)) continue;
        dummy.position.copy(p); dummy.scale.setScalar(rr(0.6, 1.4)); dummy.updateMatrix();
        inst.setMatrixAt(i++, dummy.matrix);
      }
      for (const q of riboPositions) { dummy.position.copy(q); dummy.scale.setScalar(1.15); dummy.updateMatrix(); inst.setMatrixAt(i++, dummy.matrix); }
      inst.count = i;
      cell.add(inst);
    }

    /* ---- hover, and the per-frame motion ---- */
    const raycaster = new THREE.Raycaster();
    const rootOf = o => { while (o && !o.userData.organelle) o = o.parent; return o; };
    let hovered = null;
    const setHighlight = (org, on) => org.traverse(o => {
      if (!o.isMesh || !o.material || !o.material.emissive) return;
      const m = o.material;
      if (!m.userData.baseEmissive) { m.userData.baseEmissive = m.emissive.clone(); m.userData.baseIntensity = m.emissiveIntensity; }
      if (on) { m.emissive.set(0xffffff); m.emissiveIntensity = 0.13; }
      else { m.emissive.copy(m.userData.baseEmissive); m.emissiveIntensity = m.userData.baseIntensity; }
    });
    // ndc is {x,y} in clip space or null; returns the organelle root under it.
    function pick(ndc) {
      if (!ndc) return null;
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(organelles, true);
      return hits.length ? rootOf(hits[0].object) : null;
    }
    function hover(ndc) {
      const r = pick(ndc);
      if (r === hovered) return hovered;
      if (hovered) setHighlight(hovered, false);
      hovered = r;
      if (hovered) setHighlight(hovered, true);
      return hovered;
    }
    const bob = organelles.filter(o => o.userData.organelle !== 'nucleus' && o.userData.organelle !== 'er')
      .map(o => ({ o, base: o.position.y, phase: rr(0, 2 * PI), amp: rr(0.03, 0.07), speed: rr(0.5, 0.9) }));
    let t = 0;
    function step(dt) {
      t += dt;
      for (const b of bob) b.o.position.y = b.base + Math.sin(t * b.speed + b.phase) * b.amp;
      nucleolus.material.emissiveIntensity = 0.4 + 0.12 * Math.sin(t * 1.3);
    }
    // World-space bounding sphere of an organelle, for a camera flight.
    function bounds(org) {
      root.updateMatrixWorld(true);
      return new THREE.Box3().setFromObject(org).getBoundingSphere(new THREE.Sphere());
    }

    return { group: cell, organelles, step, pick, hover, bounds, get hovered() { return hovered; } };
  }

  /* ---- one box ------------------------------------------------------- */

  const HOME = { pos: [2, 13, 28], target: [0, -1.5, 0] };

  function mount(el, params = {}) {
    if (!global.CardStage) throw new Error('cell/cutaway.js: load kit/card-stage.js first');
    const THREE = global.THREE, V3 = THREE.Vector3;
    const orbitOf = (pos, target) => {
      const v = new V3().fromArray(pos).sub(new V3().fromArray(target)), r = v.length();
      return { r, phi: Math.acos(clamp(v.y / r, -1, 1)), theta: Math.atan2(v.x, v.z) };
    };
    const home = { pos: params.pos || HOME.pos, target: params.target || HOME.target };
    let sim = null, lastTouch = 0;
    const touched = () => { lastTouch = performance.now(); };
    const box = global.CardStage.create({
      mount: el,
      cam: orbitOf(home.pos, home.target),
      stage: Object.assign({ phiMin: 0.15, phiMax: 2.9, rMin: 3, rMax: 70, onDrag: touched, onZoom: touched }, params.stage || {}),
      step: dt => { if (!sim) return; flyStep(dt); sim.step(dt); sim.hover(ndc); turn(dt); },
      viewOffset: params.viewOffset,
    });
    box.cam.target.fromArray(home.target);
    // Stage's lights ride the camera and cast nothing; this scene wants a
    // fixed sun with shadows into the bowl, so those are dimmed and one is added.
    box.renderer.outputEncoding = THREE.sRGBEncoding;
    box.renderer.shadowMap.enabled = true;
    box.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    for (const o of box.camera.children) if (o.isLight) o.intensity *= 0.3;
    for (const o of box.scene.children) if (o.isAmbientLight) o.intensity = 0.25;
    box.scene.add(new THREE.HemisphereLight(0xffffff, 0xd9a39c, 0.3));
    const key = new THREE.DirectionalLight(0xfff4ea, 1.4);
    key.position.set(14, 22, 16);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = key.shadow.camera.bottom = -18;
    key.shadow.camera.right = key.shadow.camera.top = 18;
    key.shadow.camera.near = 1; key.shadow.camera.far = 80;
    key.shadow.bias = -0.0006;
    key.shadow.normalBias = 0.03;
    box.scene.add(key, key.target);
    const fill = new THREE.DirectionalLight(0xdbe6ff, 0.45);
    fill.position.set(-14, 6, -10);
    box.scene.add(fill, fill.target);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ opacity: 0.16 }));
    floor.rotation.x = -PI / 2; floor.position.y = -11.5; floor.receiveShadow = true;
    box.scene.add(floor);

    /* camera flights, in Stage's turntable terms (as tree.js) */
    const fly = { active: false, t: 0, dur: 1.4, a: null, b: null, t0: new V3(), t1: new V3() };
    function flyTo(pos, target, dur = 1.4) {
      const c = box.cam;
      fly.a = { theta: c.theta, phi: c.phi, r: c.r }; fly.t0.copy(c.target);
      fly.b = orbitOf(pos, target); fly.t1.fromArray(target);
      let d = fly.b.theta - fly.a.theta;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      fly.b.theta = fly.a.theta + d;
      fly.t = 0; fly.dur = dur; fly.active = true;
    }
    function flyStep(dt) {
      if (!fly.active) return;
      fly.t += dt / fly.dur;
      const k = easeInOut(Math.min(fly.t, 1)), c = box.cam;
      c.theta = lerp(fly.a.theta, fly.b.theta, k);
      c.phi = lerp(fly.a.phi, fly.b.phi, k);
      c.r = lerp(fly.a.r, fly.b.r, k);
      c.target.lerpVectors(fly.t0, fly.t1, k);
      if (fly.t >= 1) fly.active = false;
    }
    const goHome = () => flyTo(home.pos, home.target);
    function focusOn(org) {
      const s = sim.bounds(org), dist = Math.max(s.radius * 2.6, 3.5);
      const dir = box.camera.position.clone().sub(s.center).normalize();
      flyTo(s.center.clone().addScaledVector(dir, dist).toArray(), s.center.toArray());
    }
    // A slow turn that yields to the reader for five seconds after any touch.
    function turn(dt) {
      if (fly.active || params.autoRotate === false || performance.now() - lastTouch < 5000) return;
      box.cam.theta += dt * 0.09;
    }

    /* pointer: hover lights, a still click flies, a drag is Stage's */
    let ndc = null, down = null;
    const canvas = box.canvas;
    const toNdc = e => {
      const r = canvas.getBoundingClientRect();
      return { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -((e.clientY - r.top) / r.height) * 2 + 1 };
    };
    canvas.addEventListener('pointermove', e => { ndc = toNdc(e); canvas.style.cursor = sim && sim.pick(ndc) ? 'pointer' : 'grab'; });
    canvas.addEventListener('pointerleave', () => { ndc = null; });
    canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; fly.active = false; touched(); });
    canvas.addEventListener('pointerup', e => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
      const hit = sim.pick(toNdc(e));
      if (hit) focusOn(hit); else goHome();
    });
    canvas.addEventListener('dblclick', goHome);

    sim = create(THREE, box.root, box.camera, params);
    box.pump();
    return {
      sim, box, flyTo, home: goHome, focusOn,
      start: box.start, stop: box.stop, pump: box.pump,
      destroy: box.destroy,
    };
  }

  global.Cutaway = { create, mount, DEFAULTS, HOME, buildShell, sweepProfile, makeNoise };
})(typeof globalThis !== 'undefined' ? globalThis : this);
