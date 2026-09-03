import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { clamp, easeOut, lerp } from './util.js';

export const CATS = [
  { key: 'air',   name: 'From the air',  color: 0x3b4252, css: 'var(--air)',   x: -5.4 },
  { key: 'water', name: 'From water',    color: 0x2f6fb5, css: 'var(--water)', x: 0 },
  { key: 'soil',  name: 'From the soil', color: 0xb0702e, css: 'var(--soil)',  x: 5.4 },
];
export const SHARES = {
  dry:   { air: 93, water: 6,  soil: 1 },
  fresh: { air: 46, water: 53, soil: 1 },
};
export const PCT = {
  dry:   { air: '93%', water: '6%',  soil: '≈1%' },
  fresh: { air: '46%', water: '53%', soil: '<1%' },
};
export const SUB = {
  dry:   { air: 'carbon dioxide', water: 'hydrogen atoms', soil: 'minerals' },
  fresh: { air: 'carbon dioxide', water: 'sap, plus hydrogen', soil: 'minerals' },
};

const DUR = 1.25;
const STEP = 0.36;

/** 200 cubes that fly out of the tree and stack into labelled piles by origin. */
export class Piles {
  constructor({ scene, tree, count = 200, z = 8 }) {
    this.tree = tree; this.count = count; this.z = z;
    const geo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.6, color: 0xffffff });
    this.mesh = new THREE.InstancedMesh(geo, mat, count);
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    scene.add(this.mesh);

    this.cubes = Array.from({ length: count }, () => ({
      from: new THREE.Vector3(), to: new THREE.Vector3(), pos: new THREE.Vector3(),
      rot0: new THREE.Euler(Math.random() * 3, Math.random() * 3, Math.random() * 3),
      s0: 0, s1: 0, s: 0, delay: 0, t: 99, placed: false,
    }));
    this.labels = CATS.map(cat => {
      const div = document.createElement('div');
      div.className = 'pile-label';
      div.innerHTML = `<span class="pile-pct"></span><span class="pile-name">${cat.name}</span><span class="pile-sub"></span>`;
      const o = new CSS2DObject(div);
      o.visible = false;
      scene.add(o);
      return o;
    });
    this.exploded = false;
    this.mode = 'dry';
    this._d = new THREE.Object3D();
    this._c = new THREE.Color();
    this._tmp = new THREE.Vector3();
  }

  counts(mode) {
    const s = SHARES[mode];
    const c = { air: Math.round(s.air / 100 * this.count), soil: Math.max(1, Math.round(s.soil / 100 * this.count)) };
    c.water = this.count - c.air - c.soil;
    return c;
  }
  _stack(cat, i, n, out) {
    const w = Math.max(2, Math.round(Math.cbrt(n) * 1.3));
    const layer = Math.floor(i / (w * w)), r = i % (w * w), row = Math.floor(r / w), col = r % w;
    return out.set(cat.x + (col - (w - 1) / 2) * STEP, 0.15 + layer * STEP, this.z + (row - (w - 1) / 2) * STEP);
  }
  _stackHeight(n) { const w = Math.max(2, Math.round(Math.cbrt(n) * 1.3)); return Math.ceil(n / (w * w)) * STEP; }

  explode(mode = 'dry') {
    const wasExploded = this.exploded;
    this.mode = mode; this.exploded = true; this.mesh.visible = true;
    const counts = this.counts(mode);
    const idx = { air: 0, water: 0, soil: 0 };
    let i = 0;
    for (const cat of CATS) {
      const n = counts[cat.key];
      for (let k = 0; k < n; k++, i++) {
        const c = this.cubes[i];
        this._stack(cat, idx[cat.key]++, n, this._tmp);
        const changed = !wasExploded || this._tmp.distanceToSquared(c.to) > 1e-6;
        if (wasExploded) { c.from.copy(c.pos); c.s0 = 1; } else { this.tree.samplePointWorld(c.from); c.s0 = 0; }
        c.to.copy(this._tmp);
        c.s1 = 1;
        c.delay = wasExploded ? Math.random() * 0.35 : (i / this.count) * 0.9;
        c.t = changed ? 0 : 99;
        this.mesh.setColorAt(i, this._c.setHex(cat.color));
      }
    }
    this.mesh.instanceColor.needsUpdate = true;
    CATS.forEach((cat, k) => {
      const label = this.labels[k];
      label.position.set(cat.x, this._stackHeight(counts[cat.key]) + 1.3, this.z);
      label.element.querySelector('.pile-pct').textContent = PCT[mode][cat.key];
      label.element.querySelector('.pile-sub').textContent = SUB[mode][cat.key];
      label.visible = true;
    });
  }

  gather() {
    if (!this.exploded) return;
    this.exploded = false;
    for (const c of this.cubes) {
      c.from.copy(c.pos); this.tree.samplePointWorld(c.to);
      c.s0 = c.s; c.s1 = 0; c.delay = Math.random() * 0.4; c.t = 0;
    }
    this.labels.forEach(l => (l.visible = false));
  }

  update(dt) {
    if (!this.mesh.visible) return;
    let active = false;
    const d = this._d;
    for (let i = 0; i < this.count; i++) {
      const c = this.cubes[i];
      if (c.t < c.delay + DUR) { c.t += dt; active = true; }
      const k = easeOut(clamp((c.t - c.delay) / DUR, 0, 1));
      c.pos.lerpVectors(c.from, c.to, k);
      c.pos.y += Math.sin(Math.PI * k) * 1.6;
      c.s = lerp(c.s0, c.s1, k);
      d.position.copy(c.pos);
      d.rotation.set(c.rot0.x * (1 - k), c.rot0.y * (1 - k) + k * (1 - k) * 5, c.rot0.z * (1 - k));
      d.scale.setScalar(Math.max(c.s, 1e-4));
      d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (!active && !this.exploded) this.mesh.visible = false;
  }
}
