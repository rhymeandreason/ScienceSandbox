/* =========================================================
   ScienceSandbox — kit.js
   Tiny shared helpers. Load as a normal (blocking) script in
   <head>, before an app's own inline script, so these globals
   exist when the app runs:
     <script src=".../kit/kit.js"></script>
   ========================================================= */

/* querySelector shorthands */
function $(sel, root = document) { return root.querySelector(sel); }
function $$(sel, root = document) { return [...root.querySelectorAll(sel)]; }

/* create an element: el('div', 'my-class', '<b>hi</b>') */
function el(tag, cls, html) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
}

/* transient message at the bottom of the screen; creates #toast if missing */
function toast(msg, ms = 1900) {
  let t = document.getElementById('toast');
  if (!t) { t = el('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), ms);
}

/* re-trigger a CSS animation class on an element (force reflow) */
function replay(node, cls) {
  node.classList.remove(cls);
  void node.offsetWidth;
  node.classList.add(cls);
}

/* a little label that floats up and fades out from (x, y) in the viewport */
function floatUp(x, y, html, cls = '') {
  const f = el('div', 'kit-floater ' + cls, html);
  Object.assign(f.style, {
    position: 'fixed', left: x + 'px', top: y + 'px',
    pointerEvents: 'none', zIndex: 60, fontWeight: 700,
    animation: 'kit-float 1s ease forwards',
  });
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 1000);
}

/* =========================================================
   kitChart — a tiny theme-aware SVG line chart for the
   slider-driven "watch the curve" apps. Draws axes, a light
   grid, one or more curves, and an optional moving marker dot.
   Colors come from theme tokens; nothing is hard-coded.

     const chart = kitChart($('#plot'), {
       xRange: [0, 100], yRange: [0, 1],
       xLabel: 'temperature (°C)', yLabel: 'rate',
       xTicks: 5, yTicks: 4,
     });
     chart.setCurve(pointsArray);          // [[x,y], ...] in data coords
     chart.setMarker(x, y, 'label');       // moving dot; omit to hide

   All drawing uses a fixed 480×260 viewBox scaled to the
   container width, so it stays crisp at any size.
   ========================================================= */
function kitChart(container, opts = {}) {
  const o = Object.assign({
    xRange: [0, 1], yRange: [0, 1],
    xLabel: '', yLabel: '',
    xTicks: 5, yTicks: 4,
    xFmt: (v) => `${+v.toFixed(2)}`,
    yFmt: (v) => `${+v.toFixed(2)}`,
    color: 'var(--chart-line, var(--accent-strong, #e0863c))',
    fill: true,
  }, opts);

  const W = 480, H = 260, PL = 46, PR = 16, PT = 14, PB = 36;
  const NS = 'http://www.w3.org/2000/svg';
  const svgEl = (tag, attrs) => {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  };

  const sx = (x) => PL + (x - o.xRange[0]) / (o.xRange[1] - o.xRange[0]) * (W - PL - PR);
  const sy = (y) => (H - PB) - (y - o.yRange[0]) / (o.yRange[1] - o.yRange[0]) * (H - PT - PB);

  const svg = svgEl('svg', {
    viewBox: `0 0 ${W} ${H}`, class: 'kit-chart',
    preserveAspectRatio: 'xMidYMid meet',
  });
  svg.style.width = '100%';
  svg.style.height = 'auto';
  svg.style.display = 'block';
  svg.style.fontFamily = 'var(--font-hand, sans-serif)';

  // grid + ticks
  const grid = svgEl('g', {});
  for (let i = 0; i <= o.yTicks; i++) {
    const y = o.yRange[0] + (o.yRange[1] - o.yRange[0]) * i / o.yTicks;
    grid.appendChild(svgEl('line', {
      x1: PL, y1: sy(y), x2: W - PR, y2: sy(y),
      stroke: 'var(--stitch, #ccc)', 'stroke-width': 1, opacity: i === 0 ? 0.9 : 0.35,
    }));
    const lbl = svgEl('text', {
      x: PL - 8, y: sy(y) + 4, 'text-anchor': 'end',
      'font-size': 12, fill: 'var(--ink-soft, #888)',
    });
    lbl.textContent = o.yFmt(y);
    grid.appendChild(lbl);
  }
  for (let i = 0; i <= o.xTicks; i++) {
    const x = o.xRange[0] + (o.xRange[1] - o.xRange[0]) * i / o.xTicks;
    grid.appendChild(svgEl('line', {
      x1: sx(x), y1: PT, x2: sx(x), y2: H - PB,
      stroke: 'var(--stitch, #ccc)', 'stroke-width': 1, opacity: i === 0 ? 0.9 : 0.2,
    }));
    const lbl = svgEl('text', {
      x: sx(x), y: H - PB + 18, 'text-anchor': 'middle',
      'font-size': 12, fill: 'var(--ink-soft, #888)',
    });
    lbl.textContent = o.xFmt(x);
    grid.appendChild(lbl);
  }
  svg.appendChild(grid);

  // axis labels
  if (o.xLabel) {
    const t = svgEl('text', {
      x: (PL + W - PR) / 2, y: H - 4, 'text-anchor': 'middle',
      'font-size': 13, fill: 'var(--ink, #444)',
    });
    t.textContent = o.xLabel;
    svg.appendChild(t);
  }
  if (o.yLabel) {
    const t = svgEl('text', {
      x: 12, y: (PT + H - PB) / 2, 'text-anchor': 'middle',
      'font-size': 13, fill: 'var(--ink, #444)',
      transform: `rotate(-90 12 ${(PT + H - PB) / 2})`,
    });
    t.textContent = o.yLabel;
    svg.appendChild(t);
  }

  const area = svgEl('path', { fill: o.color, opacity: 0.14, d: '' });
  const line = svgEl('path', {
    fill: 'none', stroke: o.color, 'stroke-width': 3,
    'stroke-linejoin': 'round', 'stroke-linecap': 'round', d: '',
  });
  if (o.fill) svg.appendChild(area);
  svg.appendChild(line);

  const marker = svgEl('g', { opacity: 0 });
  const mLine = svgEl('line', {
    stroke: o.color, 'stroke-width': 1.5, 'stroke-dasharray': '3 3', opacity: 0.6,
  });
  const mDot = svgEl('circle', {
    r: 6, fill: 'var(--surface, #fff)', stroke: o.color, 'stroke-width': 3,
  });
  const mLbl = svgEl('text', {
    'font-size': 13, 'font-weight': 700, 'text-anchor': 'middle',
    fill: 'var(--ink, #444)',
  });
  marker.append(mLine, mDot, mLbl);
  svg.appendChild(marker);

  container.appendChild(svg);

  function setCurve(points) {
    if (!points || !points.length) { line.setAttribute('d', ''); area.setAttribute('d', ''); return; }
    const d = points.map((p, i) => `${i ? 'L' : 'M'}${sx(p[0]).toFixed(1)} ${sy(p[1]).toFixed(1)}`).join(' ');
    line.setAttribute('d', d);
    const first = sx(points[0][0]).toFixed(1), last = sx(points[points.length - 1][0]).toFixed(1);
    area.setAttribute('d', `${d} L${last} ${sy(o.yRange[0])} L${first} ${sy(o.yRange[0])} Z`);
  }

  function setMarker(x, y, label) {
    if (x == null) { marker.setAttribute('opacity', 0); return; }
    marker.setAttribute('opacity', 1);
    const px = sx(x), py = sy(y);
    mLine.setAttribute('x1', px); mLine.setAttribute('y1', py);
    mLine.setAttribute('x2', px); mLine.setAttribute('y2', H - PB);
    mDot.setAttribute('cx', px); mDot.setAttribute('cy', py);
    mLbl.setAttribute('x', px);
    mLbl.setAttribute('y', py - 12);
    mLbl.textContent = label || '';
  }

  return { el: svg, setCurve, setMarker };
}
