import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { makeNoise, seededRandom } from './noise.js';
import { buildShell, surfaceNormal, sweepProfile, roundedRectProfile, displace } from './geom.js';

const noise = makeNoise(7);
const rand = seededRandom(1234);
const rr = (a, b) => a + (b - a) * rand();
const PI = Math.PI;

// ---------- renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 0.85;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#f5f2ef');
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 200);
const HOME_POS = new THREE.Vector3(2, 13, 28);
const HOME_TARGET = new THREE.Vector3(0, -1.5, 0);
camera.position.copy(HOME_POS);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(HOME_TARGET);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 3;
controls.maxDistance = 70;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.5;

// ---------- lights ----------
scene.add(new THREE.HemisphereLight('#ffffff', '#d9a39c', 0.3));
const key = new THREE.DirectionalLight('#fff4ea', 1.5);
key.position.set(14, 22, 16);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = key.shadow.camera.bottom = -18;
key.shadow.camera.right = key.shadow.camera.top = 18;
key.shadow.camera.near = 1; key.shadow.camera.far = 80;
key.shadow.bias = -0.0006;
key.shadow.normalBias = 0.03;
key.shadow.radius = 4;
scene.add(key);
const fill = new THREE.DirectionalLight('#dbe6ff', 0.45);
fill.position.set(-14, 6, -10);
scene.add(fill);

// contact shadow
{
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ opacity: 0.16 }));
  floor.rotation.x = -PI / 2; floor.position.y = -11.5; floor.receiveShadow = true;
  scene.add(floor);
}

const mat = (opts) => new THREE.MeshPhysicalMaterial({
  roughness: 0.5, clearcoat: 0.2, clearcoatRoughness: 0.4, envMapIntensity: 0.16, ...opts,
});
const organelles = [];
const occupied = []; // { p, r } spheres in cell space that speckles must avoid
const registerOrganelle = (obj, name) => { obj.userData.organelle = name; organelles.push(obj); return obj; };
const dirUW = (u, w) => new THREE.Vector3(Math.sin(w) * Math.cos(u), -Math.cos(w), Math.sin(w) * Math.sin(u));

// ---------- cell body ----------
const cell = new THREE.Group();
cell.rotation.x = 0.32;
scene.add(cell);

const R = 10, TH = 0.55, YS = 0.72;
const cellRadius = (d) => R * (1
  + 0.055 * noise.fbm(d.x * 1.4 + 3.1, d.y * 1.4 + 1.7, d.z * 1.4, 3)
  + 0.05 * noise.noise3(d.x * 0.6 + 9, d.y * 0.6, d.z * 0.6));
const innerR = (d) => cellRadius(d) - TH;
const cellS = (u, w) => { const d = dirUW(u, w); const p = d.clone().multiplyScalar(cellRadius(d)); p.y *= YS; return p; };
const cellCut = (u) => PI * 0.56 + 0.06 * Math.sin(2 * u + 1.0) + 0.035 * Math.sin(5 * u + 2.3)
  + 0.05 * noise.noise3(Math.cos(u) * 1.5, Math.sin(u) * 1.5, 2.0);

{
  const g = buildShell({
    S: cellS, uRange: [0, 2 * PI], wRange: (u) => [0, cellCut(u)], uSeg: 200, uPeriodic: true,
    rimStart: false, rimEnd: true, thickness: TH,
    segs: { outer: 70, rim: 12, inner: 70 },
    colors: { outer: '#ee8e84', inner: '#a8132a', rim: '#f4b0a6' },
  });
  const m = mat({ vertexColors: true, roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.25, emissive: '#3a0008', emissiveIntensity: 0.3 });
  const mesh = new THREE.Mesh(g, m);
  mesh.castShadow = true; mesh.receiveShadow = true;
  cell.add(mesh);
}

// point inside the cell's inner cavity?
const unsq = (p) => new THREE.Vector3(p.x, p.y / YS, p.z);
const insideCell = (p, margin = 0) => { const q = unsq(p); const d = q.clone().normalize(); return q.length() < innerR(d) - margin; };
// clamp a point to the cavity
const clampToCell = (p, margin) => { const q = unsq(p); const d = q.clone().normalize(); const lim = innerR(d) - margin; if (q.length() > lim) { q.setLength(lim); p.set(q.x, q.y * YS, q.z); } return p; };
// y of inner wall under (x,z)
const floorY = (x, z) => {
  let y = -(R - TH);
  for (let i = 0; i < 4; i++) {
    const d = new THREE.Vector3(x, y, z).normalize();
    const ri = innerR(d);
    y = -Math.sqrt(Math.max(0.01, ri * ri - x * x - z * z));
  }
  return y * YS;
};

// ---------- nucleus ----------
const nucleus = new THREE.Group();
nucleus.position.set(1.6, -2.3, -1.4);
nucleus.rotation.set(0.55, 0.25, 0);
cell.add(registerOrganelle(nucleus, 'nucleus'));
const Rn = 3.6, THn = 0.22;
const nucRadius = (d) => Rn * (1 + 0.03 * noise.fbm(d.x * 2 + 7, d.y * 2, d.z * 2, 2));
const nucS = (u, w) => { const d = dirUW(u, w); return d.multiplyScalar(nucRadius(d)); };
const nucCut = (u) => PI * 0.6 + 0.03 * Math.sin(3 * u + 0.5) + 0.02 * Math.sin(7 * u);
{
  const g = buildShell({
    S: nucS, uRange: [0, 2 * PI], wRange: (u) => [0, nucCut(u)], uSeg: 128, uPeriodic: true,
    rimStart: false, rimEnd: true, thickness: THn,
    segs: { outer: 48, rim: 8, inner: 48 },
    colors: { outer: '#3f6cb5', inner: '#4a78c0', rim: '#9cb9e6' },
  });
  const mesh = new THREE.Mesh(g, mat({ vertexColors: true, roughness: 0.4, clearcoat: 0.5 }));
  mesh.castShadow = true; mesh.receiveShadow = true;
  nucleus.add(mesh);

  // nucleolus
  const ng = displace(new THREE.SphereGeometry(1.05, 48, 32), (x, y, z) => {
    const k = 1 + 0.06 * noise.fbm(x * 2.2 + 1, y * 2.2, z * 2.2, 2);
    return [x * k, y * k, z * k];
  });
  const nucleolus = new THREE.Mesh(ng, mat({ color: '#f6b64a', emissive: '#ff8a12', emissiveIntensity: 0.45, roughness: 0.55, clearcoat: 0.2 }));
  nucleolus.position.set(0.35, -0.75, 0.25);
  nucleolus.castShadow = true;
  nucleus.add(nucleolus);
  nucleus.userData.nucleolus = nucleolus;

  // chromatin strands
  const chromMat = mat({ color: '#3d64a8', roughness: 0.6, clearcoat: 0 });
  for (let i = 0; i < 3; i++) {
    const pts = [];
    for (let j = 0; j < 5; j++) {
      const d = new THREE.Vector3(rr(-1, 1), rr(-1, 0.3), rr(-1, 1)).normalize();
      pts.push(d.multiplyScalar(rr(0.6, Rn - 0.6)));
    }
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.6);
    const t = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.05, 6, false), chromMat);
    t.castShadow = true;
    nucleus.add(t);
  }

  // nuclear pores
  const poreGeo = new THREE.TorusGeometry(0.2, 0.07, 8, 18);
  const poreMat = mat({ color: '#274a8f', roughness: 0.55, clearcoat: 0 });
  for (let i = 0; i < 60; i++) {
    const u = rr(0, 2 * PI);
    const w = rr(0.12 * PI, nucCut(u) - 0.06 * PI);
    const p = nucS(u, w);
    const n = surfaceNormal(nucS, new THREE.Vector3(), u, w);
    const pore = new THREE.Mesh(poreGeo, poreMat);
    pore.position.copy(p).addScaledVector(n, 0.03);
    pore.lookAt(p.clone().add(n));
    nucleus.add(pore);
  }
}
const nucleusWorldInCell = nucleus.position.clone();

// ---------- mitochondria ----------
function makeMito() {
  const g = new THREE.Group();
  const r = 0.55, L = 0.95, th = 0.09;
  const cap = PI * r / 2, total = PI * r + 2 * L;
  const prof = (u) => {
    const s = u * total;
    if (s < cap) { const a = -PI / 2 + s / r; return [-L + r * Math.sin(a), r * Math.cos(a)]; }
    if (s < cap + 2 * L) return [-L + (s - cap), r];
    const a = (s - cap - 2 * L) / r; return [L + r * Math.sin(a), r * Math.cos(a)];
  };
  const S = (u, w) => {
    const [x, rho] = prof(u);
    const bump = 1 + 0.05 * noise.noise3(x * 2.5, Math.cos(w) * 1.5, Math.sin(w) * 1.5 + 4.2);
    return new THREE.Vector3(x, -rho * bump * Math.sin(w), rho * bump * Math.cos(w));
  };
  const shellGeo = buildShell({
    S, uRange: [0, 1], wRange: () => [0, PI], uSeg: 72, uPeriodic: false,
    rimStart: true, rimEnd: true, thickness: th,
    segs: { outer: 40, rim: 7, inner: 40 },
    colors: { outer: '#e0552f', inner: '#e2775b', rim: '#f4b8a4' },
  });
  const shell = new THREE.Mesh(shellGeo, mat({ vertexColors: true, roughness: 0.42, clearcoat: 0.5 }));
  shell.castShadow = true; shell.receiveShadow = true;
  g.add(shell);

  // cristae
  const profile = roundedRectProfile(0.1, 0.5, 0.045, '#f2a3ae', '#fff6f7');
  const cristaMat = mat({ vertexColors: true, roughness: 0.5, clearcoat: 0.3, side: THREE.DoubleSide });
  const n = 7;
  for (let i = 0; i < n; i++) {
    const xi = -L * 0.9 + (i / (n - 1)) * 1.8 * L + rr(-0.05, 0.05);
    const ax = Math.abs(xi);
    const rho = ax <= L ? r : Math.sqrt(Math.max(0, r * r - (ax - L) * (ax - L)));
    const ri = rho - th - 0.05;
    const pts = [], scales = [];
    const h = 0.5;
    const steps = 16;
    for (let k = 0; k <= steps; k++) {
      const z = (-0.9 + 1.8 * k / steps) * ri;
      const x = xi + 0.09 * Math.sin(z * 7 + i * 1.3);
      const depth = Math.sqrt(Math.max(0, ri * ri - z * z));
      const sy = Math.min(1, Math.max(0.15, (depth - 0.04) / h));
      pts.push(new THREE.Vector3(x, -0.05 - (h * sy) / 2, z));
      scales.push([1, sy]);
    }
    const geo = sweepProfile(pts, profile, { scales, caps: true });
    const m = new THREE.Mesh(geo, cristaMat);
    m.castShadow = true;
    g.add(m);
  }
  return registerOrganelle(g, 'mitochondrion');
}

const mitoSpecs = [
  { x: -3.0, z: 4.6, ry: 0.35, rx: 0.25 },
  { x: 2.4, z: 5.2, ry: -0.6, rx: 0.3 },
  { x: 6.2, z: 2.4, ry: 1.25, rx: 0.2 },
  { x: -6.3, z: -3.6, ry: 0.95, rx: 0.15 },
  { x: 6.8, z: -3.2, ry: -1.1, rx: 0.1 },
];
for (const s of mitoSpecs) {
  const m = makeMito();
  m.position.set(s.x, Math.max(floorY(s.x, s.z) + 0.8, -4.2 + rr(-0.6, 0.6)), s.z);
  m.rotation.set(s.rx, s.ry, 0);
  cell.add(m);
  occupied.push({ p: m.position.clone(), r: 1.6 });
}

// ---------- Golgi apparatus ----------
function makeGolgi() {
  const g = new THREE.Group();
  const gm = mat({ color: '#7c85cf', roughness: 0.45, clearcoat: 0.5 });
  const n = 7;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const rx = 1.15 + 0.7 * Math.sin(PI * t) + rr(-0.08, 0.08);
    const rz = rx * 0.78;
    const geo = displace(new THREE.SphereGeometry(1, 72, 24), (x, y, z) => {
      const ang = Math.atan2(z, x);
      const edge = 1 + 0.11 * noise.noise3(Math.cos(ang) * 2.2 + i * 3.7, Math.sin(ang) * 2.2, i * 0.9);
      const X = x * rx * edge, Z = z * rz * edge;
      const Y = y * 0.075 + 0.11 * (X * X + Z * Z);
      return [X, Y, Z];
    });
    const m = new THREE.Mesh(geo, gm);
    m.position.y = i * 0.3;
    m.castShadow = true; m.receiveShadow = true;
    g.add(m);
  }
  const vm = mat({ color: '#8b93da', roughness: 0.4, clearcoat: 0.6 });
  for (let i = 0; i < 8; i++) {
    const ang = rr(0, 2 * PI);
    const rad = rr(1.9, 2.5);
    const v = new THREE.Mesh(new THREE.SphereGeometry(rr(0.1, 0.22), 16, 12), vm);
    v.position.set(Math.cos(ang) * rad, rr(-0.3, n * 0.3 + 0.3), Math.sin(ang) * rad * 0.8);
    v.castShadow = true;
    g.add(v);
  }
  return registerOrganelle(g, 'golgi');
}
{
  const golgi = makeGolgi();
  golgi.position.set(-6.2, -3.4, 0.6);
  occupied.push({ p: golgi.position.clone(), r: 2.6 });
  golgi.rotation.set(0.15, 0.35, -1.45);
  cell.add(golgi);
}

// ---------- endoplasmic reticulum ----------
const riboPositions = [];
{
  const er = new THREE.Group();
  const profile = roundedRectProfile(0.18, 0.62, 0.07, '#d9426d', '#f6c0ce');
  const erMat = mat({ vertexColors: true, roughness: 0.45, clearcoat: 0.5, side: THREE.DoubleSide });
  const nc = nucleusWorldInCell;
  const arcs = [
    { a0: -0.38 * PI, a1: 0.58 * PI, count: 4 },
    { a0: 0.80 * PI, a1: 1.22 * PI, count: 3 },
  ];
  for (const arc of arcs) {
    for (let k = 0; k < arc.count; k++) {
      const rk = Rn + 0.75 + k * 0.6;
      const y0 = -3.3 + 0.12 * k;
      const a0 = arc.a0 + rr(0, 0.12), a1 = arc.a1 - rr(0, 0.12);
      const steps = Math.ceil((a1 - a0) / 0.035);
      const pts = [];
      for (let s = 0; s <= steps; s++) {
        const a = a0 + (a1 - a0) * s / steps;
        const rad = rk + 0.28 * Math.sin(a * 9 + k * 1.7) + 0.2 * noise.noise3(Math.cos(a) * 3, Math.sin(a) * 3, k * 2.1);
        const y = y0 + 0.28 * Math.sin(a * 4 + k * 0.9) + 0.15 * noise.noise3(a * 2, k, 5);
        const p = new THREE.Vector3(nc.x + Math.cos(a) * rad, y, nc.z + Math.sin(a) * rad);
        pts.push(clampToCell(p, 0.7));
      }
      const geo = sweepProfile(pts, profile, { caps: true });
      const m = new THREE.Mesh(geo, erMat);
      m.castShadow = true; m.receiveShadow = true;
      er.add(m);
      // ribosomes studding the ER
      for (let s = 0; s < pts.length; s += 2) {
        const p = pts[s];
        const T = pts[Math.min(s + 1, pts.length - 1)].clone().sub(pts[Math.max(s - 1, 0)]).normalize();
        const side = new THREE.Vector3().crossVectors(T, new THREE.Vector3(0, 1, 0)).normalize();
        const cnt = rand() < 0.6 ? 1 : 2;
        for (let c = 0; c < cnt; c++) {
          const q = p.clone().addScaledVector(side, rr(-1, 1) > 0 ? 0.11 : -0.11).add(new THREE.Vector3(0, rr(-0.28, 0.33), 0));
          riboPositions.push(q);
        }
      }
    }
  }
  cell.add(registerOrganelle(er, 'er'));
}

// ---------- centrioles + microtubules ----------
{
  const c = new THREE.Group();
  const cm = mat({ color: '#6fbe62', roughness: 0.5, clearcoat: 0.3 });
  const makeCentriole = () => {
    const g = new THREE.Group();
    const tube = new THREE.CylinderGeometry(0.035, 0.035, 0.85, 8);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * 2 * PI;
      for (let j = 0; j < 3; j++) {
        const m = new THREE.Mesh(tube, cm);
        const ra = 0.2 + j * 0.06;
        const aa = a + j * 0.16;
        m.position.set(Math.cos(aa) * ra, 0, Math.sin(aa) * ra);
        m.castShadow = true;
        g.add(m);
      }
    }
    return g;
  };
  const c1 = makeCentriole();
  const c2 = makeCentriole();
  c2.rotation.z = PI / 2;
  c2.position.set(0.45, -0.6, 0.1);
  c.add(c1, c2);
  // microtubules radiating out
  const mtMat = mat({ color: '#8bd07c', roughness: 0.55, clearcoat: 0.1 });
  for (let i = 0; i < 6; i++) {
    const dir = new THREE.Vector3(rr(-1, 0.4), rr(-0.8, 0.2), rr(-0.3, 1)).normalize();
    const len = rr(1.6, 3.2);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, len, 6), mtMat);
    m.position.copy(dir).multiplyScalar(len / 2 + 0.4);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    m.castShadow = true;
    c.add(m);
  }
  c.position.set(-3.3, -2.2, -4.6);
  c.rotation.set(0.4, 0.3, 0.5);
  cell.add(registerOrganelle(c, 'centrosome'));
}

// ---------- vesicles / lysosomes / peroxisomes ----------
{
  const palette = [
    { c: '#f08a3c', e: '#ff5a00', ei: 0.25 }, { c: '#f5a25a', e: '#000000', ei: 0 },
    { c: '#ec6f95', e: '#000000', ei: 0 }, { c: '#6fa1dc', e: '#000000', ei: 0 },
    { c: '#98a4e2', e: '#000000', ei: 0 }, { c: '#f6c453', e: '#ff9a00', ei: 0.2 },
    { c: '#d94f6a', e: '#000000', ei: 0 },
  ];
  const placed = [];
  occupied.push({ p: new THREE.Vector3(-3.3, -2.2, -4.6), r: 1.6 });
  let tries = 0, count = 0;
  while (count < 18 && tries++ < 4000) {
    const d = new THREE.Vector3(rr(-1, 1), rr(-1, -0.15), rr(-1, 1)).normalize();
    const p = d.multiplyScalar(innerR(d) * rr(0.35, 0.92));
    const rad = rr(0.22, 0.5);
    if (p.y > 0.4) continue;
    if (!insideCell(p, rad + 0.3)) continue;
    if (p.distanceTo(nucleusWorldInCell) < Rn + 0.9 + rad) continue;
    if (placed.some(q => q.distanceTo(p) < 1.4 + rad)) continue;
    if (occupied.some(o => o.p.distanceTo(p) < o.r + rad + 0.3)) continue;
    placed.push(p);
    const pal = palette[Math.floor(rand() * palette.length)];
    const geo = displace(new THREE.SphereGeometry(rad, 32, 24), (x, y, z) => {
      const k = 1 + 0.05 * noise.noise3(x * 4 + count, y * 4, z * 4);
      return [x * k, y * k, z * k];
    });
    const m = new THREE.Mesh(geo, mat({ color: pal.c, emissive: pal.e, emissiveIntensity: pal.ei, roughness: 0.35, clearcoat: 0.7 }));
    m.position.copy(p);
    m.castShadow = true; m.receiveShadow = true;
    cell.add(registerOrganelle(m, 'vesicle'));
    occupied.push({ p: p.clone(), r: rad + 0.1 });
    count++;
  }
}

// ---------- free ribosomes / cytoplasm speckles ----------
{
  const N = 1500;
  const geo = new THREE.SphereGeometry(0.06, 6, 5);
  const m = new THREE.MeshStandardMaterial({ color: '#7c1030', roughness: 0.6 });
  const inst = new THREE.InstancedMesh(geo, m, N + riboPositions.length);
  const dummy = new THREE.Object3D();
  let i = 0;
  let tries = 0;
  while (i < N && tries++ < N * 10) {
    const d = new THREE.Vector3(rr(-1, 1), rr(-1, 1), rr(-1, 1)).normalize();
    const p = d.multiplyScalar(innerR(d) * Math.cbrt(rand()) * 0.97);
    if (p.y > 0.8) continue;
    if (p.distanceTo(nucleusWorldInCell) < Rn + 0.25) continue;
    if (!insideCell(p, 0.1)) continue;
    if (occupied.some(o => o.p.distanceTo(p) < o.r)) continue;
    dummy.position.copy(p);
    const s = rr(0.6, 1.4);
    dummy.scale.setScalar(s);
    dummy.updateMatrix();
    inst.setMatrixAt(i++, dummy.matrix);
  }
  for (const q of riboPositions) {
    dummy.position.copy(q); dummy.scale.setScalar(1.15); dummy.updateMatrix();
    inst.setMatrixAt(i++, dummy.matrix);
  }
  inst.count = i;
  cell.add(inst);
}

// ---------- interaction ----------
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(-2, -2);
let hovered = null;
const rootOf = (obj) => { let o = obj; while (o && !o.userData.organelle) o = o.parent; return o; };
const setHighlight = (root, on) => {
  root.traverse((o) => {
    if (!o.isMesh || !o.material || !o.material.emissive) return;
    const m = o.material;
    if (!m.userData.baseEmissive) { m.userData.baseEmissive = m.emissive.clone(); m.userData.baseIntensity = m.emissiveIntensity; }
    if (on) { m.emissive.set('#ffffff'); m.emissiveIntensity = 0.13; }
    else { m.emissive.copy(m.userData.baseEmissive); m.emissiveIntensity = m.userData.baseIntensity; }
  });
};

const focus = { active: false, pos: new THREE.Vector3(), target: new THREE.Vector3() };
const focusOn = (root) => {
  const box = new THREE.Box3().setFromObject(root);
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const dist = Math.max(sphere.radius * 2.6, 3.5);
  const dir = camera.position.clone().sub(sphere.center).normalize();
  focus.target.copy(sphere.center);
  focus.pos.copy(sphere.center).addScaledVector(dir, dist);
  focus.active = true;
};
const goHome = () => { focus.target.copy(HOME_TARGET); focus.pos.copy(HOME_POS); focus.active = true; };

let downX = 0, downY = 0, lastInteraction = 0;
renderer.domElement.addEventListener('pointerdown', (e) => { downX = e.clientX; downY = e.clientY; focus.active = false; });
renderer.domElement.addEventListener('pointermove', (e) => {
  pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
});
renderer.domElement.addEventListener('pointerup', (e) => {
  if (Math.hypot(e.clientX - downX, e.clientY - downY) > 5) return;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(organelles, true);
  if (hits.length) focusOn(rootOf(hits[0].object)); else goHome();
});
renderer.domElement.addEventListener('dblclick', goHome);
controls.addEventListener('start', () => { controls.autoRotate = false; lastInteraction = performance.now(); });
controls.addEventListener('end', () => { lastInteraction = performance.now(); });

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---------- animate ----------
const clock = new THREE.Clock();
const bob = organelles.filter(o => o.userData.organelle !== 'nucleus' && o.userData.organelle !== 'er')
  .map(o => ({ o, base: o.position.y, phase: rr(0, 2 * PI), amp: rr(0.03, 0.07), speed: rr(0.5, 0.9) }));

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  for (const b of bob) b.o.position.y = b.base + Math.sin(t * b.speed + b.phase) * b.amp;
  nucleus.userData.nucleolus.material.emissiveIntensity = 0.4 + 0.12 * Math.sin(t * 1.3);

  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(organelles, true);
  const root = hits.length ? rootOf(hits[0].object) : null;
  if (root !== hovered) {
    if (hovered) setHighlight(hovered, false);
    hovered = root;
    if (hovered) setHighlight(hovered, true);
    renderer.domElement.style.cursor = hovered ? 'pointer' : 'grab';
  }

  if (focus.active) {
    const k = 1 - Math.exp(-dt * 3.5);
    camera.position.lerp(focus.pos, k);
    controls.target.lerp(focus.target, k);
    if (camera.position.distanceTo(focus.pos) < 0.02) focus.active = false;
  }
  if (!controls.autoRotate && performance.now() - lastInteraction > 5000) controls.autoRotate = true;
  controls.update();
  renderer.render(scene, camera);
}
animate();

