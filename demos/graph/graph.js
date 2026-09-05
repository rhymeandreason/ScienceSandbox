/* =============================================================================
 *  graph/graph.js - the plot component: lab data on paper
 * =============================================================================
 *  Observable Plot (UMD, global `Plot`) under a SEMANTIC layer. A caller says
 *  what the graph MEANS - scatter of rate against light, fit a line, error bars
 *  from the spread - and never touches a mark, a scale, a tick count or a
 *  colour. That is the whole point: this module is written to be driven by a
 *  generated page, and a rule the generator keeps breaking is fixed here, not
 *  by rewording its prompt.
 *
 *      <script src="https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js"></script>
 *      <script src="https://cdn.jsdelivr.net/npm/@observablehq/plot@0.6.16/dist/plot.umd.min.js"></script>
 *      (the UMD bundle does NOT carry d3; it reads the global, so d3 goes first)
 *      <link rel="stylesheet" href="../graph/graph.css">
 *      <script src="../graph/graph.js"></script>
 *
 *      Graph.mount(el, params)     one box, one handle, same contract as the
 *                                  3D components: set / state / on / destroy
 *
 *  Params:
 *      kind     'scatter' | 'line' | 'bar' | 'histogram' | 'box'
 *      data     array of plain row objects (Graph.csv turns a CSV into these)
 *      x, y     {field, label, unit, domain, zero, log, ticks, tickFormat}
 *               `label` is what the axis says; `unit` is appended in parens,
 *               so no caller writes "Time (min)" by hand and gets the spacing
 *               wrong. `field` alone is enough; the label falls back to a
 *               de-slugged field name.
 *      color    a field name to split into series. Draws the legend itself.
 *      mean     collapse repeat measurements at each x to their mean
 *      error    'sd' | 'sem' | a field holding the plus/minus value. Draws
 *               error bars, and implies mean for the two computed ones: a
 *               spread bar on a single reading is a lie about the data.
 *      fit      'linear' | 'none'. Draws the least-squares line and puts
 *               slope, intercept, r2 and xIntercept in state(). The line is
 *               drawn from OUR numbers, so the annotation and the stroke
 *               cannot disagree.
 *      ci       0..1 confidence band around the fit, or 0 for none
 *      xIntercept  true drops a marked rule where the fit crosses y = 0.
 *               The isotonic point of an osmosis lab is exactly this.
 *      zeroLine a heavier rule at y = 0 when the data crosses it
 *      ref      [{y|x, label}] reference lines: a known value, a control
 *      title, caption, height, legend, tip, sort
 *
 *  set() re-renders. Nothing here animates: a graph that tweens between two
 *  datasets is showing a third that was never measured.
 *
 *  state(): {n, kind, x:{min,max}, y:{min,max}, series:[names], rows:[drawn],
 *            fit:{slope,intercept,r2,xIntercept,n} | null}
 *  Events: 'render' (state)
 *
 *  Colours come from css/kodo.css at mount, so a caption naming a series and
 *  the dots it names cannot drift. The series ramp lives HERE and nowhere
 *  else; it is published as --graph-s1 ... --graph-s6 for that caption.
 * ========================================================================== */
(function (global) {
  'use strict';

  /* ---- the series ramp -----------------------------------------------------
     Eight, ordered so the first two are the common case (a treatment and its
     control) and read apart in greyscale as well as in colour. Eight because a
     class splits into eight lab groups and every group has to be findable in
     the legend; past that a graph is showing too much and wants splitting,
     not a ninth hue. */
  const SERIES = ['#2f7ee0', '#e5533a', '#2f7d5c', '#ef8b17',
                  '#7a5ea8', '#0f8b9e', '#b23a70', '#6b7c3a'];

  /* Read from the BODY, not the root: lesson-shell.css declares its palette on
     `body.lshell-page` and shadows the site sheet's there. Each call takes the
     first name that resolves, so one graph is right on both shells. */
  function token(names, fallback) {
    const cs = getComputedStyle(document.body || document.documentElement);
    for (const n of [].concat(names)) {
      const v = cs.getPropertyValue(n).trim();
      if (v) return v;
    }
    return fallback;
  }

  SERIES.forEach((c, i) => document.documentElement.style.setProperty('--graph-s' + (i + 1), c));

  /* ---- data ---------------------------------------------------------------- */

  /* Quoted fields, embedded commas, doubled quotes. Numeric-looking columns
     become numbers, because a scale built over the string "0.4" sorts it next
     to "0.05" and the axis comes out nonsense. */
  function csv(text) {
    const rows = [];
    let field = '', row = [], quoted = false;
    text = text.replace(/\r\n?/g, '\n');
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quoted) {
        if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false; }
        else field += c;
      } else if (c === '"') quoted = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else field += c;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    if (!rows.length) return [];
    const head = rows.shift().map(h => h.trim());
    return rows.filter(r => r.some(v => v.trim() !== '')).map(r => {
      const o = {};
      head.forEach((h, i) => {
        const raw = (r[i] == null ? '' : r[i]).trim();
        o[h] = raw !== '' && raw !== '-' && !Number.isNaN(Number(raw)) ? Number(raw) : raw;
      });
      return o;
    });
  }

  function load(url) { return fetch(url).then(r => r.text()).then(csv); }

  /* ---- statistics ---------------------------------------------------------- */

  function mean(a) { return a.reduce((s, v) => s + v, 0) / a.length; }
  function sd(a) {
    if (a.length < 2) return 0;
    const m = mean(a);
    return Math.sqrt(a.reduce((s, v) => s + (v - m) * (v - m), 0) / (a.length - 1));
  }

  /* Least squares returned as numbers rather than drawn, so the caller reads
     the same slope the line has. The x-intercept comes free, which is the
     reading a dilution series is actually for. */
  function leastSquares(pts) {
    const n = pts.length;
    if (n < 2) return null;
    const mx = mean(pts.map(p => p.x)), my = mean(pts.map(p => p.y));
    let sxy = 0, sxx = 0, syy = 0;
    for (const p of pts) {
      const dx = p.x - mx, dy = p.y - my;
      sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
    }
    if (!sxx) return null;
    const slope = sxy / sxx;
    const intercept = my - slope * mx;
    return {
      slope, intercept, n,
      r2: syy ? (sxy * sxy) / (sxx * syy) : 1,
      xIntercept: slope ? -intercept / slope : null,
    };
  }

  /* ---- labels -------------------------------------------------------------- */

  function deslug(s) {
    return String(s).replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/^./, c => c.toUpperCase());
  }
  function axisLabel(spec) {
    if (spec.label === null) return null;
    const base = spec.label || deslug(spec.field || '');
    return spec.unit ? base + ' (' + spec.unit + ')' : base;
  }
  function fmt(v, digits) {
    if (v == null || !isFinite(v)) return '--';
    const a = Math.abs(v);
    const d = digits != null ? digits : (a >= 100 ? 0 : a >= 10 ? 1 : a >= 1 ? 2 : 3);
    return v.toFixed(d);
  }

  /* ---- the component ------------------------------------------------------- */

  const DEFAULTS = {
    kind: 'scatter', data: [], x: {}, y: {},
    color: null, mean: false, error: null, fit: 'none', ci: 0,
    xIntercept: false, zeroLine: true, ref: [],
    title: null, caption: null, height: null, legend: true, tip: true, sort: null,
  };

  function mount(el, params) {
    if (typeof Plot === 'undefined') throw new Error('graph.js needs Observable Plot loaded first');
    const P = Object.assign({}, DEFAULTS, params || {});
    P.x = Object.assign({}, params && params.x);
    P.y = Object.assign({}, params && params.y);

    const wrap = document.createElement('div');
    wrap.className = 'graph';
    el.appendChild(wrap);

    const listeners = {};
    let last = null;
    function emit(name, v) { (listeners[name] || []).forEach(f => f(v)); }

    /* The rows actually drawn, after any mean/spread collapsing. state()
       carries them, so a readout beside the graph reads the numbers the marks
       were built from rather than making a second pass over the raw data. */
    function prepare() {
      const xf = P.x.field, yf = P.y.field, cf = P.color;
      let rows = (P.data || []).filter(d => d && (!yf || (d[yf] != null && d[yf] !== '')));
      if (xf) rows = rows.filter(d => d[xf] != null && d[xf] !== '');

      const spread = P.error === 'sd' || P.error === 'sem';
      if (!(P.mean || spread) || P.kind === 'histogram' || P.kind === 'box') return rows;

      const groups = new Map();
      for (const d of rows) {
        const k = (cf ? d[cf] + ' ' : '') + d[xf];
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(d);
      }
      return [...groups.values()].map(g => {
        const vals = g.map(d => +d[yf]);
        const row = Object.assign({}, g[0]);
        row[yf] = mean(vals);
        row.n = vals.length;
        row.sd = sd(vals);
        row.sem = vals.length > 1 ? row.sd / Math.sqrt(vals.length) : 0;
        return row;
      });
    }

    function render() {
      const xf = P.x.field, yf = P.y.field, cf = P.color;
      const rows = prepare();
      const ink = token(['--ink', '--text-strong'], '#2b2723');
      const dim = token(['--text-dim', '--ink-dim'], '#5a5346');
      const hair = token(['--line', '--border-hair'], '#d8cfbf');
      const paper = token(['--panel', '--surface-card'], '#fffdf7');
      const font = token('--font-ui', 'system-ui, sans-serif');

      const errField = P.error === 'sd' ? 'sd' : P.error === 'sem' ? 'sem' : P.error;
      const tip = P.tip ? { fontSize: 12 } : undefined;
      const marks = [];

      const yVals = yf ? rows.map(d => +d[yf]).filter(isFinite) : [];
      const crossesZero = yVals.length && Math.min(...yVals) < 0 && Math.max(...yVals) > 0;

      if (P.zeroLine && crossesZero) {
        marks.push(Plot.ruleY([0], { stroke: ink, strokeWidth: 1.25, strokeOpacity: 0.5 }));
      } else if (P.kind === 'bar' || P.kind === 'histogram') {
        marks.push(Plot.ruleY([0], { stroke: hair }));
      }

      const bars = () => Plot.ruleY(rows, {
        x: xf,
        y1: d => +d[yf] - +(d[errField] || 0),
        y2: d => +d[yf] + +(d[errField] || 0),
        stroke: cf || ink, strokeOpacity: 0.55, strokeWidth: 1.5,
      });

      if (P.kind === 'scatter') {
        if (errField) marks.push(bars());
        marks.push(Plot.dot(rows, {
          x: xf, y: yf, r: 4.2, strokeWidth: 1.6, fill: paper,
          stroke: cf || SERIES[0], tip,
        }));
      } else if (P.kind === 'line') {
        marks.push(Plot.line(rows, {
          x: xf, y: yf, strokeWidth: 2, curve: 'catmull-rom', sort: xf,
          stroke: cf || SERIES[0],
        }));
        if (errField) marks.push(bars());
        marks.push(Plot.dot(rows, {
          x: xf, y: yf, r: 3.4, fill: paper, strokeWidth: 1.6,
          stroke: cf || SERIES[0], tip,
        }));
      } else if (P.kind === 'bar') {
        marks.push(Plot.barY(rows, {
          x: xf, y: yf, fill: cf || SERIES[0], fillOpacity: 0.9, tip,
          sort: P.sort === 'value' ? { x: '-y' } : undefined,
        }));
        if (errField) marks.push(bars());
      } else if (P.kind === 'histogram') {
        marks.push(Plot.rectY(rows, Plot.binX({ y: 'count' }, {
          x: xf, thresholds: P.x.ticks || 'scott', fill: cf || SERIES[0], fillOpacity: 0.85, tip,
        })));
      } else if (P.kind === 'box') {
        marks.push(Plot.boxY(rows, { x: xf, y: yf, fill: cf || SERIES[0], stroke: ink, strokeWidth: 1.2 }));
      }

      /* the fit, drawn from the numbers state() reports */
      let f = null;
      if (P.fit === 'linear' && xf && yf) {
        const pts = rows.map(d => ({ x: +d[xf], y: +d[yf] })).filter(p => isFinite(p.x) && isFinite(p.y));
        f = leastSquares(pts);
        if (f) {
          if (P.ci) marks.push(Plot.linearRegressionY(rows, {
            x: xf, y: yf, ci: P.ci, stroke: 'none', fill: ink, fillOpacity: 0.07,
          }));
          const xs = pts.map(p => p.x);
          const x0 = Math.min(...xs), x1 = Math.max(...xs);
          marks.push(Plot.line(
            [{ x: x0, y: f.slope * x0 + f.intercept }, { x: x1, y: f.slope * x1 + f.intercept }],
            { x: 'x', y: 'y', stroke: ink, strokeWidth: 1.5, strokeDasharray: '5 4' }));
          if (P.xIntercept && f.xIntercept != null && f.xIntercept >= x0 && f.xIntercept <= x1) {
            marks.push(Plot.ruleX([f.xIntercept], { stroke: SERIES[1], strokeWidth: 1.5 }));
            marks.push(Plot.dot([{ x: f.xIntercept }], { x: 'x', y: () => 0, r: 5, fill: SERIES[1] }));
            marks.push(Plot.text([{ x: f.xIntercept }], {
              x: 'x', y: () => 0, text: () => fmt(f.xIntercept), dy: -12, dx: 8,
              fill: SERIES[1], fontWeight: 600, textAnchor: 'start',
            }));
          }
        }
      }

      for (const r of (P.ref || [])) {
        const along = r.y != null;
        marks.push(along
          ? Plot.ruleY([r.y], { stroke: dim, strokeDasharray: '3 3' })
          : Plot.ruleX([r.x], { stroke: dim, strokeDasharray: '3 3' }));
        if (r.label) marks.push(Plot.text([r], {
          x: along ? undefined : 'x', y: along ? 'y' : undefined,
          frameAnchor: along ? 'right' : 'top',
          text: () => r.label, fill: dim, dy: along ? -6 : 4, dx: -4, textAnchor: 'end',
        }));
      }

      /* A dilution series was mixed at six concentrations, so the axis has six
         ticks. Left to a pixel count Plot rules 0.05 M steps across a 0-1 axis
         and rotates the labels to fit, which reads as continuous sampling that
         nobody did. Only when the levels are few enough to label. */
      const levels = xf ? [...new Set(rows.map(d => +d[xf]).filter(isFinite))].sort((a, b) => a - b) : [];
      const w = wrap.clientWidth || 640;
      const xTicks = P.kind === 'histogram' ? undefined
        : (levels.length && levels.length <= 12) ? levels
        : Math.max(3, Math.round(w / 64));
      /* Capped, not just proportional. A graph that grows with a wide column
         gets to 580px tall, which is taller than the reading it carries and
         pushes the caption off the screen the marks are on. */
      const h = P.height || Math.min(400, Math.max(240, Math.round(w * 0.58)));
      const fig = Plot.plot({
        marks,
        width: w, height: h,
        marginLeft: 60, marginBottom: 48, marginTop: 16, marginRight: 20,
        style: { background: 'transparent', color: ink, fontFamily: font, fontSize: '12px' },
        /* labelArrow: Plot ends an axis label with an arrow by default. It is
           telling the reader which way the value increases, which a Bio 101
           axis with a named quantity and a unit has already said.

           Ticks: Plot's default count is a function of pixels alone, and at
           these box sizes it lands on a rung every 12px. One label per ~64px
           across and ~52px down is the density a printed lab graph uses. */
        x: {
          label: axisLabel(P.x), labelAnchor: 'center', labelOffset: 40, labelArrow: 'none',
          grid: false, nice: true, domain: P.x.domain, type: P.x.log ? 'log' : undefined,
          ticks: P.x.ticks != null ? P.x.ticks : xTicks,
          tickFormat: P.x.tickFormat,
        },
        y: {
          label: axisLabel(P.y), labelAnchor: 'center', labelOffset: 48, labelArrow: 'none',
          grid: true, nice: true, domain: P.y.domain, type: P.y.log ? 'log' : undefined,
          zero: P.y.zero != null ? P.y.zero : (P.kind === 'bar' || P.kind === 'histogram'),
          ticks: P.y.ticks != null ? P.y.ticks : Math.max(3, Math.round(h / 52)),
          tickFormat: P.y.tickFormat,
        },
        color: cf ? { legend: P.legend, range: SERIES, label: deslug(cf) } : undefined,
        caption: P.caption || undefined,
      });

      wrap.textContent = '';
      if (P.title) {
        const h = document.createElement('div');
        h.className = 'graph-title';
        h.textContent = P.title;
        wrap.appendChild(h);
      }
      wrap.appendChild(fig);

      const xVals = xf ? rows.map(d => +d[xf]).filter(isFinite) : [];
      last = {
        kind: P.kind, n: rows.length, rows, fit: f,
        x: xVals.length ? { min: Math.min(...xVals), max: Math.max(...xVals) } : null,
        y: yVals.length ? { min: Math.min(...yVals), max: Math.max(...yVals) } : null,
        series: cf ? [...new Set(rows.map(d => d[cf]))] : [],
      };
      emit('render', last);
      return last;
    }

    /* One render per frame however many resize events arrive; Safari fires a
       burst of them while a flex parent settles. */
    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(render);
    });
    ro.observe(wrap);
    render();

    return {
      el: wrap,
      set(next) {
        for (const k in next) {
          if ((k === 'x' || k === 'y') && next[k]) Object.assign(P[k], next[k]);
          else P[k] = next[k];
        }
        render();
        return this;
      },
      state: () => last,
      on(name, fn) {
        (listeners[name] = listeners[name] || []).push(fn);
        return () => { listeners[name] = listeners[name].filter(f => f !== fn); };
      },
      render,
      destroy() { ro.disconnect(); cancelAnimationFrame(raf); wrap.remove(); },
    };
  }

  global.Graph = { mount, csv, load, leastSquares, mean, sd, fmt, deslug, SERIES, DEFAULTS };
  /* Scale (kit/scale.js): a graph is not in the world. It declares no unit and
     sits on no rung of the ladder; its axes carry their own. */
})(window);
