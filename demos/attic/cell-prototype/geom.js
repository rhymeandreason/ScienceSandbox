import * as THREE from 'three';

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();

// Outward-pointing normal of parametric surface S(u,w) via finite differences.
export function surfaceNormal(S, center, u, w, eps = 1e-3) {
  const su = S(u + eps, w).sub(S(u - eps, w));
  const sw = S(u, w + eps).sub(S(u, w - eps));
  const n = new THREE.Vector3().crossVectors(su, sw);
  const radial = S(u, w).sub(center);
  if (n.lengthSq() < 1e-10) n.copy(radial);
  if (n.dot(radial) < 0) n.negate();
  return n.normalize();
}

/**
 * Build a closed, hollow shell with thickness around parametric surface S(u,w),
 * cut at w = wRange(u)[1] (and optionally w = wRange(u)[0]) with a rounded rim.
 * Vertex colours distinguish outer / rim / inner surfaces.
 */
export function buildShell({
  S, center = new THREE.Vector3(), uRange, wRange, uSeg, uPeriodic,
  rimStart = false, rimEnd = true, thickness,
  segs = { outer: 40, rim: 8, inner: 40 }, colors,
}) {
  const cOuter = new THREE.Color(colors.outer);
  const cInner = new THREE.Color(colors.inner);
  const cRim = new THREE.Color(colors.rim);
  const tPeriodic = rimStart && rimEnd;

  const rows = [];
  const push = (kind, n, end) => { for (let i = 0; i < n + (end ? 1 : 0); i++) rows.push({ kind, s: i / n }); };
  push('outer', segs.outer, false);
  push('rimEnd', segs.rim, false);
  push('inner', segs.inner, !tPeriodic);
  if (rimStart) push('rimStart', segs.rim, false);

  const cols = uPeriodic ? uSeg : uSeg + 1;
  const nRows = rows.length;
  const pos = new Float32Array(cols * nRows * 3);
  const col = new Float32Array(cols * nRows * 3);
  const tmpC = new THREE.Color();
  const eps = 1e-3;

  for (let r = 0; r < nRows; r++) {
    const { kind, s } = rows[r];
    for (let i = 0; i < cols; i++) {
      const u = uRange[0] + (i / uSeg) * (uRange[1] - uRange[0]);
      const [ws, we] = wRange(u);
      let P;
      if (kind === 'outer') {
        const w = ws + s * (we - ws);
        P = S(u, w);
        tmpC.copy(cOuter);
        if (s > 0.85) tmpC.lerp(cRim, (s - 0.85) / 0.15);
        if (rimStart && s < 0.15) tmpC.lerp(cRim, 1 - s / 0.15);
      } else if (kind === 'inner') {
        const w = we - s * (we - ws);
        const N = surfaceNormal(S, center, u, w, eps);
        P = S(u, w).addScaledVector(N, -thickness);
        tmpC.copy(cInner);
        if (s < 0.15) tmpC.lerp(cRim, 1 - s / 0.15);
        if (rimStart && s > 0.85) tmpC.lerp(cRim, (s - 0.85) / 0.15);
      } else if (kind === 'rimEnd') {
        const O = S(u, we);
        const N = surfaceNormal(S, center, u, we, eps);
        const I = O.clone().addScaledVector(N, -thickness);
        const T = S(u, we + eps).sub(S(u, we - eps)).normalize();
        P = O.lerp(I, s).addScaledVector(T, thickness * 0.5 * Math.sin(Math.PI * s));
        tmpC.copy(cRim);
      } else {
        const O = S(u, ws);
        const N = surfaceNormal(S, center, u, ws, eps);
        const I = O.clone().addScaledVector(N, -thickness);
        const T = S(u, ws + eps).sub(S(u, ws - eps)).normalize();
        P = I.lerp(O, s).addScaledVector(T, -thickness * 0.5 * Math.sin(Math.PI * s));
        tmpC.copy(cRim);
      }
      const k = (r * cols + i) * 3;
      pos[k] = P.x; pos[k + 1] = P.y; pos[k + 2] = P.z;
      col[k] = tmpC.r; col[k + 1] = tmpC.g; col[k + 2] = tmpC.b;
    }
  }

  const idx = [];
  const at = (i, r) => ((r % nRows) * cols) + (i % cols);
  const rowLimit = tPeriodic ? nRows : nRows - 1;
  const colLimit = uPeriodic ? uSeg : uSeg;
  for (let r = 0; r < rowLimit; r++) {
    for (let i = 0; i < colLimit; i++) {
      const a = at(i, r), b = at(i + 1, r), c = at(i + 1, r + 1), d = at(i, r + 1);
      idx.push(a, b, d, b, c, d);
    }
  }

  // Ensure outward winding on the outer surface.
  {
    const r = Math.floor(segs.outer / 2), i = Math.floor(uSeg / 4);
    const a = at(i, r), b = at(i + 1, r), d = at(i, r + 1);
    _a.fromArray(pos, a * 3); _b.fromArray(pos, b * 3).sub(_a); _c.fromArray(pos, d * 3).sub(_a);
    const n = _b.cross(_c);
    if (n.dot(_a.sub(center)) < 0) {
      for (let t = 0; t < idx.length; t += 3) { const tmp = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = tmp; }
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Closed 2D profile of a rounded rectangle, with per-point colours (top / sides / bottom). */
export function roundedRectProfile(w, h, r, colorSide, colorTop, colorBottom = colorSide, cornerSeg = 4) {
  const pts = [];
  const cs = new THREE.Color(colorSide), ct = new THREE.Color(colorTop), cb = new THREE.Color(colorBottom);
  const corners = [
    [w / 2 - r, h / 2 - r, 0], [-w / 2 + r, h / 2 - r, Math.PI / 2],
    [-w / 2 + r, -h / 2 + r, Math.PI], [w / 2 - r, -h / 2 + r, 3 * Math.PI / 2],
  ];
  for (const [cx, cy, a0] of corners) {
    for (let i = 0; i <= cornerSeg; i++) {
      const a = a0 + (i / cornerSeg) * (Math.PI / 2);
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      const color = y >= h / 2 - r * 1.001 ? ct : (y <= -h / 2 + r * 1.001 ? cb : cs);
      pts.push({ x, y, color });
    }
  }
  return pts;
}

/**
 * Sweep a closed profile along a polyline. Profile x = side, y = up (projected against `up`).
 * scales: optional per-point [sx, sy].
 */
export function sweepProfile(points, profile, { up = new THREE.Vector3(0, 1, 0), scales = null, caps = true, capColor = null } = {}) {
  const n = points.length, m = profile.length;
  const pos = [], col = [], idx = [];
  const T = new THREE.Vector3(), side = new THREE.Vector3(), upv = new THREE.Vector3(), v = new THREE.Vector3();
  const frames = [];
  for (let i = 0; i < n; i++) {
    T.subVectors(points[Math.min(i + 1, n - 1)], points[Math.max(i - 1, 0)]).normalize();
    side.crossVectors(T, up);
    if (side.lengthSq() < 1e-8) side.crossVectors(T, new THREE.Vector3(1, 0, 0));
    side.normalize();
    upv.crossVectors(side, T).normalize();
    frames.push([side.clone(), upv.clone()]);
    const [sx, sy] = scales ? scales[i] : [1, 1];
    for (let j = 0; j < m; j++) {
      const pr = profile[j];
      v.copy(points[i]).addScaledVector(side, pr.x * sx).addScaledVector(upv, pr.y * sy);
      pos.push(v.x, v.y, v.z);
      col.push(pr.color.r, pr.color.g, pr.color.b);
    }
  }
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < m; j++) {
      const a = i * m + j, b = i * m + (j + 1) % m, c = (i + 1) * m + (j + 1) % m, d = (i + 1) * m + j;
      idx.push(a, b, c, a, c, d);
    }
  }
  if (caps) {
    const cc = capColor ? new THREE.Color(capColor) : null;
    for (const end of [0, n - 1]) {
      const base = pos.length / 3;
      const [sx, sy] = scales ? scales[end] : [1, 1];
      const [sd, uv] = frames[end];
      pos.push(points[end].x, points[end].y, points[end].z);
      const c0 = cc || profile[0].color;
      col.push(c0.r, c0.g, c0.b);
      for (let j = 0; j < m; j++) {
        const pr = profile[j];
        v.copy(points[end]).addScaledVector(sd, pr.x * sx).addScaledVector(uv, pr.y * sy);
        pos.push(v.x, v.y, v.z);
        const c = cc || pr.color;
        col.push(c.r, c.g, c.b);
      }
      for (let j = 0; j < m; j++) idx.push(base, base + 1 + j, base + 1 + (j + 1) % m);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Displace a geometry's vertices with a callback (x,y,z,index) -> [x,y,z]. */
export function displace(geometry, fn) {
  const p = geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const [x, y, z] = fn(p.getX(i), p.getY(i), p.getZ(i), i);
    p.setXYZ(i, x, y, z);
  }
  p.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}
