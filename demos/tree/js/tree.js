import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { smoothstep } from './util.js';

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Procedural stylised tree: one merged bark mesh + an instanced canopy of leaf blobs.
 * Everything is expressed in the tree group's local space (base of trunk at origin).
 */
export function createTree({
  trunkLen = 5, radius = 0.55, depth = 4, seed = 1,
  leafSize = 0.45, leavesPerTip = 4,
  leafColor = 0x4f8a3c, barkColor = 0x6b4f3a,
} = {}) {
  const rng = mulberry32(seed);
  const group = new THREE.Group();
  const barkMat = new THREE.MeshStandardMaterial({ color: barkColor, roughness: 0.95 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 });

  // --- build branch hierarchy, then bake it into one geometry ---
  const scaffold = new THREE.Group();
  group.add(scaffold);
  const tips = [];
  const parts = [];

  function branch(parent, len, r, level) {
    const geo = new THREE.CylinderGeometry(r * 0.62, r, len, level === 0 ? 12 : 7, 1);
    geo.translate(0, len / 2, 0);
    const m = new THREE.Mesh(geo);
    parent.add(m);
    parts.push(m);
    if (level >= depth) { tips.push({ obj: m, len }); return; }

    const n = level === 0 ? 3 : (rng() < 0.55 ? 2 : 3);
    const spin = rng() * Math.PI * 2;
    for (let i = 0; i < n; i++) {
      const pivot = new THREE.Object3D();
      pivot.rotation.order = 'YZX';
      pivot.position.y = len * (level === 0 ? 0.92 : 0.72 + rng() * 0.26);
      pivot.rotation.y = spin + i * (Math.PI * 2 / n) + (rng() - 0.5) * 0.7;
      pivot.rotation.z = 0.42 + rng() * 0.45;
      m.add(pivot);
      branch(pivot, len * (0.62 + rng() * 0.12), r * 0.62, level + 1);
    }
    if (level < depth - 1 && rng() < 0.75) {           // continuation, keeps a leader
      const p = new THREE.Object3D();
      p.rotation.order = 'YZX';
      p.position.y = len * 0.98;
      p.rotation.y = rng() * Math.PI * 2;
      p.rotation.z = (rng() - 0.5) * 0.35;
      m.add(p);
      branch(p, len * 0.7, r * 0.62, level + 1);
    }
  }
  branch(scaffold, trunkLen, radius, 0);
  group.updateMatrixWorld(true);

  const merged = mergeGeometries(parts.map(m => m.geometry.clone().applyMatrix4(m.matrixWorld)));
  parts.forEach(m => m.geometry.dispose());
  const wood = new THREE.Mesh(merged, barkMat);
  wood.castShadow = true;
  wood.receiveShadow = true;

  // --- canopy ---
  const leafBase = [];
  const leafPositions = [];
  const tipV = new THREE.Vector3();
  for (const { obj, len } of tips) {
    obj.localToWorld(tipV.set(0, len, 0));
    for (let k = 0; k < leavesPerTip; k++) {
      const p = tipV.clone().add(new THREE.Vector3(rng() - 0.5, rng() - 0.35, rng() - 0.5).multiplyScalar(len * 1.1));
      leafBase.push({ pos: p, s: leafSize * (0.7 + rng() * 0.7), rot: new THREE.Euler(rng() * 3, rng() * 3, rng() * 3) });
      leafPositions.push(p);
    }
  }
  group.remove(scaffold);

  const leaves = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), leafMat, leafBase.length);
  leaves.castShadow = true;
  leaves.receiveShadow = true;
  const c = new THREE.Color(), base = new THREE.Color(leafColor);
  leafBase.forEach((l, i) => {
    c.copy(base).offsetHSL((rng() - 0.5) * 0.05, (rng() - 0.5) * 0.15, (rng() - 0.5) * 0.14);
    leaves.setColorAt(i, c);
  });
  leaves.instanceColor.needsUpdate = true;
  group.add(wood, leaves);

  const canopyCenter = leafPositions.reduce((a, p) => a.add(p), new THREE.Vector3()).divideScalar(leafPositions.length);
  const canopyRadius = Math.sqrt(leafPositions.reduce((a, p) => a + p.distanceToSquared(canopyCenter), 0) / leafPositions.length) * 1.4;

  // --- runtime API ---
  const dummy = new THREE.Object3D();
  function applyLeaves(lf) {
    leafBase.forEach((l, i) => {
      dummy.position.copy(l.pos);
      dummy.rotation.copy(l.rot);
      dummy.scale.setScalar(Math.max(l.s * lf, 1e-4));
      dummy.updateMatrix();
      leaves.setMatrixAt(i, dummy.matrix);
    });
    leaves.instanceMatrix.needsUpdate = true;
  }
  let growth = 1;
  let leafFactor = -1;
  function setGrowth(g) {
    growth = g;
    group.scale.setScalar(Math.max(g, 1e-3));
    const lf = smoothstep(0.3, 0.95, g);
    if (Math.abs(lf - leafFactor) > 1e-4) { leafFactor = lf; applyLeaves(lf); }
    leaves.visible = lf > 0.002;
  }
  setGrowth(1);

  function setOpacity(o) {
    for (const m of [barkMat, leafMat]) {
      const transparent = o < 0.999;
      if (m.transparent !== transparent) { m.transparent = transparent; m.needsUpdate = true; } // OPAQUE define is baked into the program
      m.opacity = o;
      m.depthWrite = !transparent;
    }
    wood.castShadow = leaves.castShadow = o > 0.5;
  }

  const api = {
    group, wood, leaves, trunkLen, radius, leafPositions,
    setGrowth, setOpacity,
    getGrowth: () => growth,
    canopyCenterWorld: out => group.localToWorld(out.copy(canopyCenter)),
    canopyRadiusWorld: () => canopyRadius * group.scale.x,
    randomLeafWorld: out => group.localToWorld(out.copy(leafPositions[(Math.random() * leafPositions.length) | 0])),
    /** point on the trunk surface at height fraction t (0..1) and angle a */
    trunkPointWorld: (t, a, out) => {
      const r = radius * (1 - 0.38 * t) * 1.18;
      return group.localToWorld(out.set(Math.cos(a) * r, t * trunkLen, Math.sin(a) * r));
    },
    /** random point "inside" the tree (leaf or trunk) in world space */
    samplePointWorld: out => {
      if (Math.random() < 0.72) return api.randomLeafWorld(out);
      const a = Math.random() * Math.PI * 2, rr = Math.random() * radius * 0.6;
      return group.localToWorld(out.set(Math.cos(a) * rr, Math.random() * trunkLen * 1.2, Math.sin(a) * rr));
    },
  };
  return api;
}
