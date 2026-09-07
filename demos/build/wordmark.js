/* wordmark.js — the animated "build" / "building…" wordmark on the builder's
   first screen. Ported from the Full sequence B study: parts drop in from
   above, left to right; when a request goes out the word slides left, "ing…"
   stacks onto the end, and the dots bounce while the discs step through the
   palette.

   The word is always composed as "building~" and the tail is simply not shown
   until it stacks in, so nothing is re-laid-out mid-animation: the five letters
   of "build" rest under a translate that centres them, and the slide is that
   translate coming off.

   Wordmark.mount(el) -> { build, building, resolve, reset, destroy } */
(() => {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const S = 14, R = 23, DISC = 30, HOLE = 16, GAP = 12;
  const ELASTIC = 'cubic-bezier(0.34, 1.56, 0.64, 1)';
  const SOFT = 'cubic-bezier(0.22, 1, 0.36, 1)';
  const IN = 'cubic-bezier(0.5, 0, 1, 1)';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // stem: (cx, cy, h) · ring: (cx, cy) · arc: (cx, cy, a0, a1) · dot: (cx, cy)
  const stem = (cx, cy, h) => ({ k: 'stem', cx, cy, h });
  const ring = (cx, cy) => ({ k: 'ring', cx, cy });
  const arc = (cx, cy, a0, a1) => ({ k: 'arc', cx, cy, a0, a1 });
  const dot = (cx, cy) => ({ k: 'dot', cx, cy });
  const GLYPH = {
    b: { w: 60, prims: [stem(7, 50, 100), ring(30, 70)] },
    u: { w: 60, prims: [stem(7, 55, 30), arc(30, 70, 0, Math.PI), stem(53, 70, 60)] },
    i: { w: 14, prims: [stem(7, 70, 60), dot(7, 14)] },
    l: { w: 14, prims: [stem(7, 50, 100)] },
    d: { w: 60, prims: [ring(30, 70), stem(53, 50, 100)] },
    n: { w: 60, prims: [stem(7, 70, 60), arc(30, 70, Math.PI, 2 * Math.PI), stem(53, 85, 30)] },
    g: { w: 60, prims: [ring(30, 70), stem(53, 75, 70), arc(30, 110, 0, 0.8 * Math.PI)] },
    '~': { w: 70, prims: [dot(7, 93), dot(35, 93), dot(63, 93)] },   // the ellipsis
  };
  const compose = word => {
    let x = 0; const letters = [];
    for (const ch of word) { const g = GLYPH[ch]; letters.push({ ch, x, w: g.w, prims: g.prims }); x += g.w + GAP; }
    return { letters, width: x - GAP };
  };
  const el = (tag, attrs = {}, parent) => {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (parent) parent.appendChild(n);
    return n;
  };
  const arcPath = a => {
    const p = t => [R * Math.cos(t), R * Math.sin(t)];
    const [x0, y0] = p(a.a0), [x1, y1] = p(a.a1), large = a.a1 - a.a0 > Math.PI ? 1 : 0;
    return `M ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1}`;
  };
  const T = (x, y) => `translate(${x}px, ${y}px)`;
  const tf = (...parts) => parts.filter(x => x && x !== 'none').join(' ') || 'none';

  function mount(host) {
    const word = 'building~';
    const { letters, width } = compose(word);
    // The five disc colours are the stylesheet's, so the page keeps one source.
    const cs = getComputedStyle(host);
    const COLORS = [1, 2, 3, 4, 5].map(i => cs.getPropertyValue(`--wm-disc-${i}`).trim()).filter(Boolean);

    const svg = el('svg', { viewBox: `-30 -24 ${width + 60} 176`, 'aria-hidden': 'true' }, host);
    const prims = []; let ri = 0;
    letters.forEach((L, li) => {
      const g = el('g', {}, svg);
      L.prims.forEach(p => {
        const ax = L.x + p.cx, ay = p.cy;
        const home = el('g', { transform: `translate(${ax} ${ay})` }, g);
        let s, disc;
        if (p.k === 'ring') {
          const color = COLORS[ri++ % COLORS.length];
          s = el('g', { class: 'prim' }, home);
          disc = el('circle', { class: 'disc', r: DISC, fill: color }, s);
          el('circle', { class: 'hole', r: HOLE }, s);
          prims.push({ el: s, disc, hole: s.lastChild, color, kind: p.k, li, ax, ay, ch: L.ch });
          return;
        }
        if (p.k === 'stem') s = el('rect', { class: 'prim stem', x: -S / 2, y: -p.h / 2, width: S, height: p.h }, home);
        else if (p.k === 'arc') s = el('path', { class: 'prim arc', d: arcPath(p) }, home);
        else s = el('circle', { class: 'prim dot', r: S / 2 }, home);
        prims.push({ el: s, kind: p.k, li, ax, ay, ch: L.ch });
      });
    });

    const head = prims.filter(p => p.li < 5);          // build
    const tail = prims.filter(p => p.li >= 5);         // ing…
    const dots = tail.filter(p => p.ch === '~');
    const rings = prims.filter(p => p.kind === 'ring');
    const shift = (width - compose('build').width) / 2;
    const pre = T(shift, 0);

    let anims = [], state = 'idle';
    const track = a => { anims.push(a); return a; };
    const stop = () => { anims.forEach(a => { try { a.cancel(); } catch { /* already gone */ } }); anims = []; };
    const timeline = (elm, D, frames, delay = 0, extra = {}) => {
      const kf = frames.map(f => {
        const o = { offset: Math.min(1, Math.max(0, f.t / D)) };
        for (const k of ['transform', 'opacity', 'fill']) if (f[k] !== undefined) o[k] = f[k];
        if (f.easing) o.easing = f.easing;
        return o;
      });
      return track(elm.animate(kf, Object.assign({ duration: D, delay, fill: 'both', easing: 'linear' }, extra)));
    };
    // A ring lands shut and is punched open once it has settled.
    const closed = r => timeline(r.hole, 10, [{ t: 0, transform: 'scale(0)' }, { t: 10, transform: 'scale(0)' }]);
    const punch = (r, delay) => timeline(r.hole, 650, [{ t: 0, transform: 'scale(0)', easing: ELASTIC }, { t: 650, transform: 'scale(1)' }], delay);
    const hide = list => list.forEach(p => timeline(p.el, 10, [{ t: 0, opacity: 0 }, { t: 10, opacity: 0 }]));

    // Parts drop in from above, left to right, each landing at rest(p).
    function stackIn(list, t0, rest = () => '', step = 170) {
      const order = [...list].sort((a, b) => a.ax - b.ax);
      let end = t0;
      order.forEach((p, i) => {
        const d = t0 + i * step, r = rest(p) || '';
        if (p.kind === 'ring') {
          timeline(p.el, 1500, [
            { t: 0, transform: tf(r, T(0, -230)), opacity: 0 }, { t: 30, transform: tf(r, T(0, -230)), opacity: 1, easing: IN },
            { t: 520, transform: tf(r, 'translateY(9px) scale(1.25, 0.75)'), easing: 'ease-out' }, { t: 700, transform: tf(r, T(0, -50)), easing: IN },
            { t: 880, transform: tf(r, 'translateY(4px) scale(1.1, 0.9)'), easing: 'ease-out' }, { t: 1000, transform: tf(r, T(0, -12)), easing: IN },
            { t: 1120, transform: tf(r) }, { t: 1500, transform: tf(r) },
          ], d);
          closed(p); punch(p, d + 1300);
          end = Math.max(end, d + 1950);
        } else {
          const spin = p.kind === 'arc' ? 90 : 0;
          timeline(p.el, 900, [
            { t: 0, transform: tf(r, `${T(0, -230)} rotate(${spin}deg)`), opacity: 0 }, { t: 30, transform: tf(r, `${T(0, -230)} rotate(${spin}deg)`), opacity: 1, easing: IN },
            { t: 480, transform: tf(r, 'translateY(6px) scale(1.06, 0.94)'), easing: ELASTIC }, { t: 900, transform: tf(r) },
          ], d);
          end = Math.max(end, d + 900);
        }
      });
      return end;
    }

    // The loop: dots bounce in turn, discs step through the palette. It runs
    // until something cancels it, since a build has no length known in advance.
    function loop(start) {
      const period = 1300;
      dots.forEach((d, k) => timeline(d.el, period, [
        { t: 0, transform: 'none', easing: 'ease-out' },
        { t: period * 0.18, transform: 'translateY(-16px)', easing: 'ease-in' },
        { t: period * 0.36, transform: 'none' }, { t: period, transform: 'none' },
      ], start + k * 160, { iterations: Infinity }));
      const cyc = 3200, n = COLORS.length;
      rings.forEach((r, i) => {
        const idx = COLORS.indexOf(r.color), frames = [];
        for (let k = 0; k <= n; k++) {
          const c = COLORS[(idx + k) % n];
          frames.push({ t: k * cyc, fill: c });
          if (k < n) frames.push({ t: k * cyc + cyc - 300, fill: c });
        }
        timeline(r.disc, cyc * n, frames, start + i * 400, { iterations: Infinity });
        timeline(r.el, cyc, [
          { t: 0, transform: 'none' }, { t: cyc - 300, transform: 'none', easing: ELASTIC },
          { t: cyc - 120, transform: 'scale(1.1)', easing: 'ease-out' }, { t: cyc, transform: 'none' },
        ], start + i * 400, { iterations: Infinity });
      });
    }

    // Reduced motion: the word is simply there, in its two forms.
    const still = full => {
      stop();
      head.forEach(p => timeline(p.el, 10, [{ t: 0, transform: full ? 'none' : pre, opacity: 1 }, { t: 10, transform: full ? 'none' : pre, opacity: 1 }]));
      full ? tail.forEach(p => timeline(p.el, 10, [{ t: 0, opacity: 1 }, { t: 10, opacity: 1 }])) : hide(tail);
    };

    const api = {
      // Page load: "build" stacks in and holds, centred.
      build() {
        state = 'build';
        if (reduce) return still(false);
        stop(); hide(tail);
        stackIn(head, 200, () => pre);
      },
      // A request went out: the word slides left, "ing…" stacks on, then loops.
      building() {
        if (state === 'building') return;
        state = 'building';
        if (reduce) return still(true);
        stop();
        head.forEach(p => timeline(p.el, 900, [{ t: 0, transform: pre, easing: SOFT }, { t: 900, transform: 'none' }], 0));
        rings.filter(r => r.li < 5).forEach(r => timeline(r.hole, 10, [{ t: 0, transform: 'scale(1)' }, { t: 10, transform: 'scale(1)' }]));
        const end = stackIn(tail, 700, () => '', 150);
        loop(end + 200);
      },
      // The app arrived: the discs sweep to one colour from the left.
      resolve() {
        if (state !== 'building' || reduce) return;
        state = 'done';
        const ink = cs.getPropertyValue('--wm-ink').trim() || '#14213D';
        rings.forEach(r => {
          const cur = getComputedStyle(r.disc).fill, d = Math.abs(r.ax) * 2.2;
          timeline(r.disc, 2400, [{ t: 0, fill: cur }, { t: d, fill: cur }, { t: d + 400, fill: ink }, { t: 2400, fill: ink }], 0, { fill: 'forwards' });
        });
      },
      // A request failed and the first screen stays: back to the held word.
      reset() { if (state !== 'build') api.build(); },
      destroy() { stop(); host.innerHTML = ''; },
    };
    return api;
  }

  window.Wordmark = { mount };
})();
