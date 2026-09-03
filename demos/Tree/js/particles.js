import * as THREE from 'three';
import { clamp } from './util.js';

/**
 * A stream of small spheres travelling along per-particle curves.
 * `makePath()` returns a THREE.Curve; particles respawn with a fresh path when they finish.
 * `setIntensity(0..1)` fades the stream in/out smoothly.
 */
export class ParticleFlow {
  constructor({ count = 60, color = 0x333333, size = 0.12, speed = [0.12, 0.25], makePath, emissive = 0.15 }) {
    this.count = count;
    this.size = size;
    this.speed = speed;
    this.makePath = makePath;
    const geo = new THREE.SphereGeometry(1, 10, 8);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.55, emissive: color, emissiveIntensity: emissive });
    this.mesh = new THREE.InstancedMesh(geo, mat, count);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.particles = Array.from({ length: count }, () => ({
      t: Math.random(),
      speed: speed[0] + Math.random() * (speed[1] - speed[0]),
      rank: Math.random(),
      curve: null,
    }));
    this.intensity = 0;
    this.level = 0;
    this._dummy = new THREE.Object3D();
    this._v = new THREE.Vector3();
  }

  setIntensity(v) { this.intensity = clamp(v, 0, 1); }

  update(dt) {
    if (this.level < 0.002 && this.intensity < 0.002) { this.mesh.visible = false; return; }
    this.level += (this.intensity - this.level) * Math.min(1, dt * 2.5);
    if (this.intensity === 0 && this.level < 0.002) this.level = 0;
    this.mesh.visible = true;

    const d = this._dummy, v = this._v;
    for (let i = 0; i < this.count; i++) {
      const p = this.particles[i];
      if (!p.curve) p.curve = this.makePath();
      p.t += dt * p.speed;
      if (p.t >= 1) { p.t -= 1; p.curve = this.makePath(); }
      const vis = clamp((this.level * 1.12 - p.rank) * 8, 0, 1);
      p.curve.getPoint(p.t, v);
      d.position.copy(v);
      d.scale.setScalar(Math.max(this.size * Math.sin(Math.PI * p.t) * vis, 1e-4));
      d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
