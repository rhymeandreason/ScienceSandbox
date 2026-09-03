import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { createTree } from './tree.js';
import { ParticleFlow } from './particles.js';
import { Piles } from './piles.js';
import { Tweens, easeInOut, lerp } from './util.js';
import { steps } from './steps.js';

/* ------------------------------------------------------------------ renderer */
const sceneEl = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
sceneEl.appendChild(renderer.domElement);

const labelRenderer = new CSS2DRenderer({ element: document.getElementById('labels') });
labelRenderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(36, window.innerWidth / window.innerHeight, 0.1, 400);
camera.position.set(21, 9.5, 28);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = false;
controls.minDistance = 2.5;
controls.maxDistance = 80;
controls.maxPolarAngle = Math.PI / 2 - 0.02;
controls.target.set(0, 6, 0);

const tweens = new Tweens();

/* ------------------------------------------------------------------ lights */
const hemi = new THREE.HemisphereLight(0xe9eef6, 0xb9a98c, 0.95);
const sun = new THREE.DirectionalLight(0xfff1dc, 2.2);
sun.position.set(-6, 24, -14);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 90 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
scene.add(hemi, sun, sun.target);

const sunDisc = new THREE.Mesh(
  new THREE.SphereGeometry(1.9, 32, 20),
  new THREE.MeshBasicMaterial({ color: 0xf3c04a, transparent: true, opacity: 1 })
);
sunDisc.position.set(-16, 24, -34);
scene.add(sunDisc);

/* ------------------------------------------------------------------ ground */
function radialAlpha() {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(256, 256, 0, 256, 256, 256);
  grad.addColorStop(0, '#fff'); grad.addColorStop(0.6, '#fff'); grad.addColorStop(1, '#000');
  g.fillStyle = grad; g.fillRect(0, 0, 512, 512);
  return new THREE.CanvasTexture(c);
}
const groundMat = new THREE.MeshStandardMaterial({ color: 0xe6e1d4, roughness: 1, transparent: true, alphaMap: radialAlpha() });
const ground = new THREE.Mesh(new THREE.CircleGeometry(70, 96), groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const soilMat = new THREE.MeshStandardMaterial({ color: 0x7d5f44, roughness: 1 });
const soil = new THREE.Mesh(new THREE.CircleGeometry(2.9, 64), soilMat);
soil.rotation.x = -Math.PI / 2;
soil.position.y = 0.02;
soil.receiveShadow = true;
scene.add(soil);

/* ------------------------------------------------------------------ actors */
const tree = createTree({ trunkLen: 5, radius: 0.55, depth: 4, seed: 11 });
scene.add(tree.group);

// human figure for scale (1 world unit ≈ 1.9 m, so ≈0.95 units tall)
const person = new THREE.Group();
const personMat = new THREE.MeshStandardMaterial({ color: 0x2a2c31, roughness: 0.8 });
const bodyMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.45, 4, 10), personMat);
bodyMesh.position.y = 0.5;
const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), personMat);
head.position.y = 0.87;
bodyMesh.castShadow = head.castShadow = true;
person.add(bodyMesh, head);
person.position.set(5.2, 0, 3.4);
scene.add(person);

// Van Helmont's pot
const pot = new THREE.Group();
const potMat = new THREE.MeshStandardMaterial({ color: 0xb8683f, roughness: 0.85 });
const potBody = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 0.72, 1.1, 40), potMat);
potBody.position.y = 0.55;
const rim = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.07, 12, 48), potMat);
rim.rotation.x = Math.PI / 2; rim.position.y = 1.1;
const potSoil = new THREE.Mesh(new THREE.CircleGeometry(0.97, 48), new THREE.MeshStandardMaterial({ color: 0x4a382a, roughness: 1 }));
potSoil.rotation.x = -Math.PI / 2; potSoil.position.y = 1.1 + 0.001;
potBody.castShadow = rim.castShadow = true;
potBody.receiveShadow = true;
const sapling = createTree({ trunkLen: 1.3, radius: 0.08, depth: 3, seed: 5, leafSize: 0.17, leavesPerTip: 3 });
sapling.group.position.y = 1.1;
pot.add(potBody, rim, potSoil, sapling.group);
pot.visible = false;
scene.add(pot);

/* ------------------------------------------------------------------ particle flows */
const V3 = () => new THREE.Vector3();
const _c = V3();

function co2Path() {
  const c = tree.canopyCenterWorld(_c), r = tree.canopyRadiusWorld();
  const a = Math.random() * Math.PI * 2, el = Math.random() * 0.9 - 0.25;
  const start = new THREE.Vector3(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el))
    .multiplyScalar(r * 1.7 + Math.random() * r * 1.6).add(c);
  const end = tree.randomLeafWorld(V3());
  const mid = start.clone().lerp(end, 0.5).add(new THREE.Vector3((Math.random() - 0.5) * 2, 0.8 + Math.random(), (Math.random() - 0.5) * 2));
  return new THREE.CatmullRomCurve3([start, mid, end]);
}
function o2Path() {
  const c = tree.canopyCenterWorld(_c);
  const start = tree.randomLeafWorld(V3());
  const dir = start.clone().sub(c).normalize();
  const end = start.clone().addScaledVector(dir, 2.5 + Math.random() * 2.5).add(new THREE.Vector3(0, 3 + Math.random() * 2.5, 0));
  const mid = start.clone().lerp(end, 0.5).add(new THREE.Vector3((Math.random() - 0.5) * 1.5, 0, (Math.random() - 0.5) * 1.5));
  return new THREE.CatmullRomCurve3([start, mid, end]);
}
function sapPath() {
  const s = tree.group.scale.x;
  const a = Math.random() * Math.PI * 2;
  const rr = (1.1 + Math.random() * 1.5) * s;
  const start = new THREE.Vector3(Math.cos(a) * rr, 0.06, Math.sin(a) * rr);
  const p1 = tree.trunkPointWorld(0.02, a, V3());
  const p2 = tree.trunkPointWorld(0.55, a, V3());
  const p3 = tree.trunkPointWorld(1.0, a, V3());
  const end = tree.randomLeafWorld(V3());
  return new THREE.CatmullRomCurve3([start, p1, p2, p3, end]);
}
function driftPath() {
  const a = Math.random() * Math.PI * 2, rr = 1.2 + Math.random() * 4.5;
  const start = new THREE.Vector3(Math.cos(a) * rr, 1.4 + Math.random() * 5, Math.sin(a) * rr);
  const end = start.clone().add(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(2.5));
  const mid = start.clone().lerp(end, 0.5).add(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5));
  return new THREE.CatmullRomCurve3([start, mid, end]);
}

const flows = {
  co2:      new ParticleFlow({ count: 110, color: 0x3b4252, size: 0.14, speed: [0.14, 0.26], makePath: co2Path }),
  o2:       new ParticleFlow({ count: 70,  color: 0x9dd2ea, size: 0.12, speed: [0.14, 0.24], makePath: o2Path, emissive: 0.35 }),
  h2o:      new ParticleFlow({ count: 60,  color: 0x2f6fb5, size: 0.11, speed: [0.10, 0.18], makePath: sapPath }),
  minerals: new ParticleFlow({ count: 10,  color: 0xb0702e, size: 0.09, speed: [0.10, 0.18], makePath: sapPath }),
  ambient:  new ParticleFlow({ count: 150, color: 0x3b4252, size: 0.04, speed: [0.05, 0.1], makePath: driftPath, emissive: 0 }),
};
Object.values(flows).forEach(f => scene.add(f.mesh));

const piles = new Piles({ scene, tree, count: 200, z: 11 });

/* ------------------------------------------------------------------ environment state */
const DAY = { ground: new THREE.Color(0xe6e1d4), soil: new THREE.Color(0x7d5f44) };
const NIGHT = { ground: new THREE.Color(0x343846), soil: new THREE.Color(0x2b2420) };
let daylight = 1;
function applyDaylight(v) {
  daylight = v;
  sun.intensity = lerp(0.2, 2.2, v);
  hemi.intensity = lerp(0.35, 0.95, v);
  groundMat.color.lerpColors(NIGHT.ground, DAY.ground, v);
  soilMat.color.lerpColors(NIGHT.soil, DAY.soil, v);
  sunDisc.material.opacity = v;
  sunDisc.visible = v > 0.02;
}
function setDaylight(target) {
  document.body.classList.toggle('is-night', target < 0.5);
  tweens.to(daylight, target, 1.2, applyDaylight, { key: 'day' });
}

let treeOpacity = 1;
function setTreeOpacity(target, dur = 0.9) {
  tweens.to(treeOpacity, target, dur, v => { treeOpacity = v; tree.setOpacity(v); }, { key: 'ghost' });
}

function showPotScene(on) {
  pot.visible = on;
  tree.group.visible = !on;
  person.visible = !on;
  soil.visible = !on;
}

function flowsOff() { for (const f of Object.values(flows)) f.setIntensity(0); }

/* ------------------------------------------------------------------ camera flights */
const fly = { active: false, t: 0, dur: 1.5, p0: V3(), p1: V3(), t0: V3(), t1: V3() };
function flyTo(pos, target, dur = 1.6) {
  fly.p0.copy(camera.position); fly.t0.copy(controls.target);
  fly.p1.fromArray(pos); fly.t1.fromArray(target);
  fly.t = 0; fly.dur = dur; fly.active = true;
}
renderer.domElement.addEventListener('pointerdown', () => {
  fly.active = false;
  document.getElementById('hint').classList.add('is-faded');
});

/* ------------------------------------------------------------------ lesson UI */
const els = {
  eyebrow: document.getElementById('eyebrow'),
  title: document.getElementById('title'),
  body: document.getElementById('body'),
  controls: document.getElementById('controls'),
  scroll: document.getElementById('panel-scroll'),
  back: document.getElementById('back'),
  next: document.getElementById('next'),
  count: document.getElementById('step-count'),
  progress: document.getElementById('progress'),
};

const ui = {
  controls(html) { els.controls.innerHTML = html; },
  q(sel) { return els.controls.querySelector(sel); },
  qa(sel) { return [...els.controls.querySelectorAll(sel)]; },
  show(el) { if (!el) return; el.classList.remove('is-hidden'); el.classList.add('rise'); },
  hide(el) { if (el) el.classList.add('is-hidden'); },
  setNext(label, visible = true) { els.next.textContent = label; els.next.classList.toggle('is-hidden', !visible); },
  range(input, onChange) {
    const paint = () => input.style.setProperty('--p', `${((input.value - input.min) / (input.max - input.min)) * 100}%`);
    input.addEventListener('input', () => { paint(); onChange(+input.value); });
    paint();
    onChange(+input.value);
  },
};

const ctx = {
  ui, tree, sapling, flows, piles, tweens,
  setDaylight, setTreeOpacity, showPotScene, flowsOff, flyTo,
  state: { guess: null, grown: false, year: 0, diameter: 60, flows: { co2: true, h2o: false, o2: false }, sunOn: true },
  goTo: i => goTo(i),
};

let current = -1;
steps.forEach((s, i) => {
  const b = document.createElement('button');
  b.setAttribute('aria-label', `Step ${i + 1}: ${s.title}`);
  b.addEventListener('click', () => goTo(i));
  els.progress.appendChild(b);
});

function goTo(i) {
  if (i < 0 || i >= steps.length || i === current) return;
  if (current >= 0) steps[current].onExit?.(ctx);
  current = i;
  const step = steps[i];

  els.scroll.classList.remove('swap');
  void els.scroll.offsetWidth;                 // restart the entrance animation
  els.scroll.classList.add('swap');
  els.scroll.scrollTop = 0;

  els.eyebrow.textContent = step.eyebrow;
  els.title.textContent = step.title;
  els.body.innerHTML = typeof step.body === 'function' ? step.body(ctx) : step.body;
  els.controls.innerHTML = '';
  ui.setNext(step.nextLabel || 'Next', i < steps.length - 1);
  els.back.disabled = i === 0;
  els.count.textContent = `${i + 1} / ${steps.length}`;
  [...els.progress.children].forEach((b, k) => {
    b.classList.toggle('is-current', k === i);
    b.classList.toggle('is-done', k < i);
  });

  const cam = (window.innerWidth <= 760 && step.cameraPortrait) || step.camera;
  if (cam) flyTo(cam.pos, cam.target);
  step.onEnter(ctx);
}
els.next.addEventListener('click', () => goTo(current + 1));
els.back.addEventListener('click', () => goTo(current - 1));
window.addEventListener('keydown', e => {
  if (e.target.matches('input, textarea')) return;
  if (e.key === 'ArrowRight') { if (!els.next.classList.contains('is-hidden')) goTo(current + 1); }
  if (e.key === 'ArrowLeft') goTo(current - 1);
});

/* ------------------------------------------------------------------ loop */
// Shift the projection so the scene is centred in the space the panel leaves free.
const panelEl = document.getElementById('panel');
function layout() {
  const W = window.innerWidth, H = window.innerHeight;
  camera.aspect = W / H;
  camera.fov = Math.min(72, 36 * Math.max(1, 1.35 / camera.aspect));   // widen on portrait screens
  const r = panelEl.getBoundingClientRect();
  if (W > 760) camera.setViewOffset(W, H, -Math.round(r.right / 2), 0, W, H);
  else camera.setViewOffset(W, H, 0, Math.round(r.height / 2), W, H);
  camera.updateProjectionMatrix();
  renderer.setSize(W, H);
  labelRenderer.setSize(W, H);
}
window.addEventListener('resize', layout);
layout();

const clock = new THREE.Clock();
function tick(dt) {
  tweens.update(dt);
  for (const f of Object.values(flows)) f.update(dt);
  piles.update(dt);

  if (fly.active) {
    fly.t += dt / fly.dur;
    const k = easeInOut(Math.min(fly.t, 1));
    camera.position.lerpVectors(fly.p0, fly.p1, k);
    controls.target.lerpVectors(fly.t0, fly.t1, k);
    if (fly.t >= 1) fly.active = false;
  }
  controls.update();
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
}
function frame() {
  tick(Math.min(clock.getDelta(), 0.05));
  requestAnimationFrame(frame);
}
// debug hook: advance simulated time when the tab is throttled
ctx.advance = (seconds, n = 40) => { for (let i = 0; i < n; i++) tick(seconds / n); };
window.__lesson = ctx;
goTo(0);
frame();
