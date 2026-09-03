export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = t => 1 - Math.pow(1 - t, 3);
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/** Tiny scalar tween manager. `key` replaces any running tween with the same key. */
export class Tweens {
  constructor() { this.list = []; }
  to(from, to, dur, onUpdate, { ease = easeInOut, key = null, onDone = null } = {}) {
    if (key) this.list = this.list.filter(t => t.key !== key);
    const tw = { from, to, dur, t: 0, onUpdate, ease, key, onDone, done: false };
    this.list.push(tw);
    onUpdate(from);
    return tw;
  }
  update(dt) {
    for (const tw of this.list) {
      tw.t += dt;
      const k = clamp(tw.t / tw.dur, 0, 1);
      tw.onUpdate(lerp(tw.from, tw.to, tw.ease(k)));
      if (k >= 1) { tw.done = true; tw.onDone?.(); }
    }
    this.list = this.list.filter(t => !t.done);
  }
}
