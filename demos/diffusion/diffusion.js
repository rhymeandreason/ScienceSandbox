/* =============================================================================
 *  diffusion.js — a box of molecules that nothing is pushing.
 *
 *  WHAT IT TEACHES. Three things, and the third is the one no textbook figure
 *  shows:
 *
 *    1. NOTHING KNOWS THE GRADIENT. Every molecule walks at random; no term in
 *       here reads the concentration. A crowd spreads out because there are
 *       more molecules on the crowded side to wander off it, not because
 *       anything is pushed, pulled, or "wants" to even out.
 *    2. IT NEVER STOPS. Once the box is even, molecules keep crossing the line
 *       in both directions at the same rate. The counters say so — the same
 *       move massaction.js makes for a reaction at equilibrium, and the same
 *       misconception ("it evened out, so it stopped").
 *    3. DISTANCE GOES AS THE SQUARE ROOT OF TIME. Four times as long to get
 *       twice as far. This is why diffusion is instant across a cell and
 *       useless across a room, and it is the whole answer to "why are cells
 *       small" — measured live here, not asserted.
 *
 *  WHAT IT IS NOT. There is no membrane and no barrier. A wall that some
 *  molecules cross and others do not is osmosis, which is the membrane
 *  lesson's subject (LESSONS-ROADMAP §2); this module deliberately stops one
 *  step short, so that page can put a wall down the middle of a box whose
 *  behaviour the student already trusts. The line drawn here is a COUNTING
 *  line — imaginary, crossed freely, present only so both directions can be
 *  counted.
 *
 *  DOTS, NOT MOLECULES — the massaction.js paradigm. A circle here makes NO
 *  geometry claim: no shape, no bonds, no orientation. What IS honest is the
 *  relative SIZE, which is read from the spec's own coordinates (radiusOf
 *  below), and the rate that follows from it. Colour is a label the host
 *  chooses, because nothing about a molecule's identity is a colour.
 *
 *  Its claims are asserted by diffusion/check-diffusion.js, which requires this
 *  file and drives advance() directly — including against three measured
 *  diffusion coefficients, the only external numbers this module can be
 *  checked against.
 *
 *  Loads as a plain script after palette.js + molecules.js (it reads
 *  MolLib.MOLECULES and MolLib.PALETTE to size a dot). Needs diffusion.css.
 *  See diffusion-test.html for the smallest working host.
 * ========================================================================== */
'use strict';

(function (root) {

/* ---- HOW BIG IS A MOLECULE ----------------------------------------------
 * Radius of gyration from the spec's own atom coordinates, plus the mean
 * display radius of its atoms — the first term is the spread of the mass, the
 * second stops a three-atom molecule reading as a point.
 *
 * A PROXY, and it says so. The honest quantity for diffusion is the Stokes
 * radius, which is a hydrodynamic measurement and not derivable from
 * coordinates. What makes this one usable is that it can be CHECKED: it puts
 * water at 1.97 Å (the measured Stokes radius of water is ~1.9 Å) and predicts
 * the three D ratios this repo has literature values for to within 15%. That
 * assertion lives in check-diffusion.js, so retuning PALETTE.radii — which is
 * a legibility knob for 3D pages and has no idea this file exists — cannot
 * quietly break the size-to-rate claim.
 *
 * ÅNGSTRÖM SPECS ONLY. A `units:'scene'` spec is drawn at display scale, a
 * different scale FAMILY (MolecularGeometry.md §1), and mixing the two here
 * would compare a stylised water against a measured glucose and call the
 * difference chemistry. mol-small.js exists precisely so the small molecules
 * are available in ångström; load that, not mol-solvation.js.
 */
function radiusOf(spec) {
  if (!spec || !spec.atoms || !spec.atoms.length) throw new Error('radiusOf: no atoms');
  if (spec.units && spec.units !== 'angstrom') {
    throw new Error(`radiusOf: "${spec.name}" is ${spec.units} units, not ångström — `
      + `size across scale families is not a comparison. See mol-small.js.`);
  }
  const P = root.MolLib ? root.MolLib.PALETTE : root.MolPalette;
  const a = spec.atoms, n = a.length;
  const c = [0, 0, 0];
  a.forEach(t => t.pos.forEach((v, i) => c[i] += v));
  c.forEach((v, i) => c[i] = v / n);
  let sq = 0, rad = 0;
  a.forEach(t => {
    sq += t.pos.reduce((s, v, i) => s + (v - c[i]) * (v - c[i]), 0);
    rad += (P.radii[t.el] != null ? P.radii[t.el] : 0.8);
  });
  return Math.sqrt(sq / n) + rad / n;
}

/* ---- HOW FAST DOES IT WALK ----------------------------------------------
 * Stokes–Einstein: D = kT / 6πηR, so at one temperature in one solvent
 * D ∝ 1/R and nothing else. That is the entire size-to-rate law, and it is
 * why a module that gets the radii roughly right gets the rates roughly right
 * for free.
 *
 * D_REF is a LEGIBILITY KNOB, exactly like massaction's `ea`: it sets how long
 * the box takes to even out, and it carries no units a student should read.
 * Only the RATIOS between species mean anything, and the ratios do not depend
 * on it at all.
 *
 * SET FROM THE TIME, not by eye. Evening out means an RMS x-displacement of
 * about half the box, and ⟨x²⟩ = 2·D·t, so t ≈ (w/2)² / 2D. At w ≈ 2.2 box
 * units that is ~12 s for water at the value below, and about three times that
 * for glucose — long enough to watch, short enough to sit through twice. The
 * first version of this constant was a third of it and took a minute, which is
 * a demo nobody reaches the end of.
 */
const R_REF = 1.97;          // ångström — water, by radiusOf above
const D_REF = 0.050;         // box-widths² per second, for a molecule of R_REF
const diffusionOf = radius => D_REF * (R_REF / radius);

/* One Gaussian sample, Box–Muller. NOT a fixed-length step in a random
 * direction: a real walk's step lengths are distributed, and per-axis normals
 * are what make the displacement after many steps exactly normal — which is
 * the √t law this module exists to show, rather than an approximation of it. */
function gauss() {
  let u = 0; while (u === 0) u = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random());
}

/* ---- THE WALK -----------------------------------------------------------
 * Pure over the array it is handed, so check-diffusion.js drives THIS, not a
 * reimplementation of it. Positions are in BOX UNITS: y runs 0..1 and x runs
 * 0..aspect, so a step is the same size in both directions. Working in
 * fractions of width and height instead would make every walk anisotropic —
 * a bias invisible on screen and fatal to every claim here.
 *
 * MSD per axis is 2·D·dt, so in two dimensions ⟨r²⟩ = 4·D·t. The counting line
 * sits at x = aspect/2; a particle whose x crosses it is counted, by direction.
 * Walls REFLECT rather than clamp — clamping parks particles on the edge and
 * quietly builds a rim of density that looks like a result.
 */
function advance(parts, dt, aspect) {
  const crossed = [0, 0];                 // [left→right, right→left]
  const mid = aspect / 2;
  for (const p of parts) {
    const s = Math.sqrt(2 * p.d * dt);
    const was = p.x;
    p.x += gauss() * s;
    p.y += gauss() * s;
    // Reflect, repeatedly: one bounce is not enough if a step overshoots the
    // far wall, which a Gaussian tail will eventually do.
    for (let g = 0; g < 4; g++) {
      if (p.x < 0) p.x = -p.x; else if (p.x > aspect) p.x = 2 * aspect - p.x; else break;
    }
    for (let g = 0; g < 4; g++) {
      if (p.y < 0) p.y = -p.y; else if (p.y > 1) p.y = 2 - p.y; else break;
    }
    if (was < mid && p.x >= mid) crossed[0]++;
    else if (was >= mid && p.x < mid) crossed[1]++;
  }
  return crossed;
}

/* RMS displacement from where each particle started. The number the spread
 * plot draws, and the one the √t claim is about. */
const spreadOf = parts => Math.sqrt(
  parts.reduce((q, p) => q + (p.x - p.x0) * (p.x - p.x0) + (p.y - p.y0) * (p.y - p.y0), 0)
  / (parts.length || 1));

/* ---- THE SPREAD PLOT ----------------------------------------------------
 * MEASURED, NOT DRAWN. Every textbook states √t and shows nothing; this plots
 * the box's own RMS displacement as it accumulates, against a √t reference
 * anchored to the first sample. If the model were wrong the two would part on
 * screen, which is the only honest way to make a claim like this.
 *
 * IT WILL FLATTEN, and that is not a bug to hide: once the crowd reaches the
 * walls there is nowhere further to go, so the measured curve peels below √t.
 * A student who notices has understood that the box, not the physics, ended
 * it. The reference keeps climbing so the departure is visible.
 *
 * Pure, and separated from the DOM for the same reason massaction's curveSVG
 * is: it makes a geometric claim, so the checker measures the path it returns.
 */
const PLOT = { w: 210, h: 96, x0: 26, y0: 8, x1: 200, y1: 78 };
function spreadSVG(samples, tMax, rMax) {
  const P = PLOT;
  const sx = t => P.x0 + (P.x1 - P.x0) * Math.min(1, t / tMax);
  const sy = r => P.y1 - (P.y1 - P.y0) * Math.min(1, r / rMax);
  // The reference is anchored to the FIRST sample, not fitted to all of them —
  // a fit would quietly absorb any error into its own constant and always look
  // like agreement.
  const a = samples.length ? samples[0] : null;
  const k = a && a.t > 0 ? a.r / Math.sqrt(a.t) : 0;
  let ref = '';
  if (k > 0) {
    const pts = [];
    for (let i = 0; i <= 24; i++) {
      const t = tMax * i / 24;
      pts.push(`${sx(t).toFixed(2)},${sy(k * Math.sqrt(t)).toFixed(2)}`);
    }
    ref = `<polyline class="ref" points="${pts.join(' ')}"/>`;
  }
  const meas = samples.length
    ? `<polyline class="meas" points="${samples.map(s =>
        `${sx(s.t).toFixed(2)},${sy(s.r).toFixed(2)}`).join(' ')}"/>`
    : '';
  return `<svg viewBox="0 0 ${P.w} ${P.h}" role="img"
      aria-label="Measured spread against time, with a square-root-of-time
        reference: the crowd covers twice the distance in four times the time">
    <text class="ax" transform="translate(8,58) rotate(-90)">spread</text>
    <text class="ax" x="${P.x0}" y="${P.h - 2}">time</text>
    <path class="axl" d="M${P.x0},${P.y0} V${P.y1} H${P.x1}"/>
    ${ref}${meas}
  </svg>`;
}

/* ---- ONE SIMULATION -----------------------------------------------------
 * opts:
 *   host       element to fill. Everything below lives inside it.
 *   scenarios  [{ key, tab, title, text, species, trails }] — one or more.
 *              species: [{ mol, label, color, n, start }] where `mol` is a
 *              MolLib key (its SIZE is read from the spec), `start` is
 *              'left' | 'centre' | 'spread', and `color` is the host's label
 *              for it — see the header on why colour is not the molecule's.
 *   kicker     the term over the title. Default 'Diffusion'.
 *   blurb      the how-to-read paragraph.
 *
 * returns { el, start, stop, setScenario, scenario }
 */
const BLURB = `Each dot is one molecule, and <b>nothing is pushing it</b> — every
  dot takes a random step, then another, forever. The dashed line is not a
  barrier; it is only there so both directions can be counted.`;

const N_ADD = 15;              // one "Add" click, matching massaction's
const SAMPLE = 0.25;           // seconds between spread-plot samples
const TAU = 0.9;               // smoothing for the net arrow, as massaction
const NET_EPS = 1.4, BUSY_EPS = 1.0;
const TRAIL = 60;              // remembered positions, when a scenario asks

/* WHAT THE NET BAR IS ALLOWED TO SAY. Pure, and exported, because the sentence
 * it picks is the one claim on screen a student is most likely to take at face
 * value — "evened out — still crossing both ways" is the whole second lesson,
 * and it must not appear until it is true.
 *   quiet — too little traffic to say anything (warm-up, or a lull)
 *   net   — one direction is clearly winning
 *   even  — EACH direction is busy, the difference is small, AND the two sides
 *           actually hold the same amount
 *
 * TWO TESTS THE OBVIOUS VERSION FAILS.
 *
 * `both`, on the traffic: on |net| alone, ONE crossing in the first half second
 * reads as "still crossing both ways", because a single event spikes its own
 * exponential average past the floor.
 *
 * `imbal`, on the POPULATION: raw crossings are dominated by particles sitting
 * ON the line and re-crossing it repeatedly, so the two tallies stay close even
 * while real transport is happening — 55 against 25 in the box, with the
 * crossing counters near-equal, and the bar said "evened out". Traffic alone
 * genuinely cannot see that; the split can. Same lesson as massaction.js's
 * "nothing left to convert", which is about the population for the same reason.
 */
const IMBAL_EPS = 0.12;        // share of the total, |left−right| / total

/* Returns { state, dir } — dir is +1 right, -1 left, 0 when there is no
 * direction to name.
 *
 * WHICH SIGNAL NAMES THE DIRECTION, and this is the part that was wrong first:
 * the traffic is NOISY and the population is not. A single frame's crossings
 * can favour either side by chance, and reading the arrow off them pointed
 * "net moving left" at a box holding 80 on the left and 30 on the right. So
 * while a real gradient exists the POPULATION names the direction, because
 * with a gradient the flux is down it — always, by construction, since that is
 * the only thing an unbiased walk can do. Traffic only gets a vote once the
 * split is near even, where there is no gradient left to argue with it. */
function netReading(fwd, back, left, right) {
  const total = left + right;
  const imbal = total ? Math.abs(left - right) / total : 0;
  const gradient = imbal > IMBAL_EPS;
  const traffic = fwd - back;
  if (fwd + back < BUSY_EPS) return { state: 'quiet', dir: 0 };
  if (gradient) return { state: 'net', dir: left > right ? 1 : -1 };
  if (Math.abs(traffic) >= NET_EPS) return { state: 'net', dir: traffic > 0 ? 1 : -1 };
  return { state: Math.min(fwd, back) >= BUSY_EPS ? 'even' : 'quiet', dir: 0 };
}

function create(opts) {
  const host = opts.host;
  const scenarios = opts.scenarios;
  const MOL = root.MolLib.MOLECULES;

  host.classList.add('diffusion');
  host.innerHTML =
     (scenarios.length > 1
        ? `<div class="df-tabs" role="tablist">` + scenarios.map((s, i) =>
            `<button class="${i ? '' : 'on'}" role="tab" data-key="${s.key}"
                     aria-selected="${i ? 'false' : 'true'}">${s.tab}</button>`).join('')
          + `</div>`
        : '')
    + `<div class="df-kick">${opts.kicker || 'Diffusion'}</div>`
    + `<h2 class="df-title"></h2>`
    + `<p class="df-sub">${opts.blurb || BLURB}</p>`
    + `<canvas class="df-canvas"></canvas>`
    + `<div class="df-row">`
    +   `<div class="df-side df-left"><span class="df-lb">Left</span>`
    +     `<div class="df-tally"></div></div>`
    +   `<div class="df-rate"><span>crossing right <b class="df-cr">0</b>/s</span>`
    +     `<span>crossing left <b class="df-cl">0</b>/s</span></div>`
    +   `<div class="df-side df-right"><span class="df-lb">Right</span>`
    +     `<div class="df-tally"></div></div>`
    + `</div>`
    + `<div class="df-net"><i class="ph-bold ph-arrows-left-right"></i><span></span></div>`
    + `<div class="df-fig">`
    +   `<div class="df-plot"></div>`
    +   `<div class="df-read"><span>Twice as far takes <b>four times</b> as long.`
    +     ` Spread <b class="df-sp">0.00</b> after <b class="df-t">0.0</b> s.</span></div>`
    + `</div>`
    + `<div class="df-ctl"></div>`
    + `<p class="df-text"></p>`;

  const q = s => host.querySelector(s);
  const cv = q('.df-canvas'), ctx = cv.getContext('2d');
  const ui = { cr:q('.df-cr'), cl:q('.df-cl'), net:q('.df-net'),
               ar:q('.df-net i'), lb:q('.df-net span'),
               left:q('.df-left .df-tally'), right:q('.df-right .df-tally'),
               plot:q('.df-plot'), sp:q('.df-sp'), t:q('.df-t'),
               title:q('.df-title'), text:q('.df-text'), ctl:q('.df-ctl') };

  let parts = [], sc = scenarios[0], running = false, raf = 0, last = 0;
  let aspect = 2, hits = [0, 0], rate = [0, 0], acc = 0;
  let ema = [0, 0], clock = 0, samples = [], nextSample = 0;

  const specOf = s => MOL[s.mol];
  // Drawn radius is the molecule's real relative size — but a dot one ångström
  // across is invisible and one glucose across fills the box, so the family is
  // scaled AS A WHOLE and never per species. The ratios survive, which is the
  // only part that is a claim. Set so water lands near 2.6px: glucose is 3×
  // that, and 3× radius is 9× area — a big molecule is supposed to look big,
  // but past this it stops being a crowd and becomes a smear.
  const DOT = 1.3;                       // px per ångström of radiusOf
  const dotR = s => Math.max(2, radiusOf(specOf(s)) * DOT);

  function spawn(sp, n, start) {
    const d = diffusionOf(radiusOf(specOf(sp)));
    for (let i = 0; i < n; i++) {
      const x = start === 'left'   ? Math.random() * aspect * 0.46
              : start === 'centre' ? aspect / 2 + (Math.random() - 0.5) * 0.02
              :                      Math.random() * aspect;
      const y = start === 'centre' ? 0.5 + (Math.random() - 0.5) * 0.02
                                   : 0.04 + Math.random() * 0.92;
      parts.push({ sp, d, x, y, x0:x, y0:y, trail: [] });
    }
  }
  function reset() {
    parts = []; hits = [0, 0]; rate = [0, 0]; acc = 0; ema = [0, 0];
    clock = 0; samples = []; nextSample = 0;
    sc.species.forEach(s => spawn(s, s.n, s.start));
    drawPlot();
  }

  function draw(w, h) {
    ctx.clearRect(0, 0, w, h);
    // the counting line: dashed, and labelled, because a solid line down the
    // middle of a box of molecules is read as a wall by every student alive
    const mx = w / 2;
    ctx.save();
    ctx.setLineDash([5, 5]); ctx.strokeStyle = 'rgba(58,52,44,.30)'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(mx, 0); ctx.lineTo(mx, h); ctx.stroke();
    ctx.restore();
    ctx.font = '600 9px system-ui,sans-serif'; ctx.fillStyle = 'rgba(58,52,44,.42)';
    ctx.textAlign = 'center';
    ctx.fillText('counting line — not a barrier', mx, h - 7);

    const px = v => v * h;               // box units are y-normalised
    if (sc.trails) {
      parts.forEach(p => {
        if (p.trail.length < 2) return;
        ctx.beginPath();
        p.trail.forEach((t, i) => i ? ctx.lineTo(px(t[0]), px(t[1]))
                                    : ctx.moveTo(px(t[0]), px(t[1])));
        ctx.strokeStyle = p.sp.color; ctx.globalAlpha = 0.28; ctx.lineWidth = 1.2;
        ctx.stroke(); ctx.globalAlpha = 1;
      });
    }
    // BIGGEST FIRST, so a small fast species is never buried under a large slow
    // one — which is exactly the pair the size scenario puts in the same box,
    // and burying the water there would hide the result.
    const order = sc.species.slice().sort((a, b) => dotR(b) - dotR(a));
    order.forEach(s => parts.forEach(p => {
      if (p.sp !== s) return;
      ctx.beginPath(); ctx.arc(px(p.x), px(p.y), dotR(s), 0, Math.PI * 2);
      ctx.fillStyle = s.color; ctx.fill();
    }));
  }

  function drawTally() {
    const mid = aspect / 2;
    const side = which => sc.species.map(s => {
      const n = parts.filter(p => p.sp === s && (which === 'L' ? p.x < mid : p.x >= mid)).length;
      return `<span class="df-sn"><i style="background:${s.color}"></i>`
           + `${s.label}<b>${n}</b></span>`;
    }).join('');
    ui.left.innerHTML = side('L'); ui.right.innerHTML = side('R');
  }

  function drawNet() {
    ui.cr.textContent = rate[0].toFixed(1); ui.cl.textContent = rate[1].toFixed(1);
    // What the bar is allowed to say, and which way it points, are netReading's
    // to decide — see its header for why neither is a one-line test.
    const mid = aspect / 2;
    const left = parts.filter(p => p.x < mid).length, right = parts.length - left;
    const { state, dir } = netReading(ema[0], ema[1], left, right);
    const icon = state === 'net' ? (dir > 0 ? 'ph-arrow-right' : 'ph-arrow-left')
                                 : 'ph-arrows-left-right';
    if (ui.ar.dataset.icon !== icon) { ui.ar.className = 'ph-bold ' + icon; ui.ar.dataset.icon = icon; }
    ui.lb.textContent = state === 'net' ? (dir > 0 ? 'net moving right' : 'net moving left')
                      : state === 'even' ? 'evened out — still crossing both ways'
                      : 'settling';
    // Weight tracks how far from even the box is, so the arrow fades as the
    // gradient does rather than snapping off at a threshold.
    const hot = state === 'net';
    const k = hot && parts.length ? Math.min(1, Math.abs(left - right) / parts.length * 2) : 0;
    const col = hot ? '#4f5bd5' : 'var(--muted)';
    ui.ar.style.color = col; ui.lb.style.color = col;
    ui.ar.style.transform = `scale(${(0.92 + 0.3 * k).toFixed(2)})`;
    ui.net.style.background = hot ? `rgba(79,91,213,${(0.06 + 0.12 * k).toFixed(2)})`
                                  : 'rgba(58,52,44,.05)';
    ui.net.style.borderColor = hot ? `rgba(79,91,213,${(0.25 + 0.35 * k).toFixed(2)})`
                                   : 'rgba(58,52,44,.14)';
  }

  function drawPlot() {
    // Axes fixed from the start so the curve GROWS into them: rescaling as
    // samples arrive makes every shape look like the same shape.
    ui.plot.innerHTML = spreadSVG(samples, 24, aspect / 2);
    ui.sp.textContent = spreadOf(parts).toFixed(2);
    ui.t.textContent = clock.toFixed(1);
  }

  function setScenario(key) {
    sc = scenarios.find(s => s.key === key) || scenarios[0];
    host.querySelectorAll('.df-tabs button').forEach(b => {
      const on = b.dataset.key === sc.key;
      b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on));
    });
    ui.title.textContent = sc.title;
    ui.text.innerHTML = sc.text;
    ui.ctl.innerHTML = sc.species.map((s, i) =>
        `<button data-add="${i}">Add ${N_ADD} ${s.label}</button>`).join('')
      + `<button data-reset>Reset</button>`;
    reset();
  }

  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0); last = now;
    tick(dt);
    raf = requestAnimationFrame(frame);
  }

  /* ONE STEP, AND EVERYTHING THAT FOLLOWS FROM IT — split out of the rAF loop
   * so the sim can be driven without one. A backgrounded tab throttles
   * requestAnimationFrame to roughly one frame a second (CLAUDE.md's first
   * browser gotcha), which makes a box that evens out in fifteen seconds
   * impossible to inspect; and the counters and the spread plot are updated
   * HERE, so driving advance() from outside instead leaves the numbers frozen
   * while the dots move — a state that looks exactly like a broken sim. */
  function tick(dt) {
    const w = cv.clientWidth, h = cv.clientHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    }
    ctx.setTransform(cv.width / w, 0, 0, cv.width / w, 0, 0);
    aspect = w / h;

    const c = advance(parts, dt, aspect);
    hits[0] += c[0]; hits[1] += c[1];
    ema[0] += c[0] / TAU; ema[1] += c[1] / TAU;
    const decay = Math.exp(-dt / TAU); ema[0] *= decay; ema[1] *= decay;
    clock += dt;
    if (sc.trails) parts.forEach(p => {
      p.trail.push([p.x, p.y]); if (p.trail.length > TRAIL) p.trail.shift();
    });
    if (clock >= nextSample) {
      samples.push({ t: clock, r: spreadOf(parts) }); nextSample += SAMPLE;
      drawPlot();
    }
    acc += dt;
    if (acc >= 1) { rate = [hits[0] / acc, hits[1] / acc]; hits = [0, 0]; acc = 0; }
    draw(w, h); drawTally(); drawNet();
  }

  function start() {
    running = true; last = performance.now();
    aspect = (cv.clientWidth || 2) / (cv.clientHeight || 1);
    setScenario(sc.key);
    drawTally(); drawNet();
    raf = requestAnimationFrame(frame);
  }
  function stop() { running = false; cancelAnimationFrame(raf); }

  host.querySelectorAll('.df-tabs button')
      .forEach(b => b.onclick = () => setScenario(b.dataset.key));
  ui.ctl.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-reset')) return reset();
    const s = sc.species[+b.dataset.add];
    // Added where that species STARTED, so "add more" is a bigger gradient and
    // not a second, quietly even, population.
    spawn(s, N_ADD, s.start);
  });

  setScenario(sc.key);
  return { el: host, start, stop, tick, setScenario, scenario: () => sc,
           parts: () => parts, clock: () => clock };
}

root.Diffusion = { create, advance, radiusOf, diffusionOf, spreadOf, spreadSVG,
                   netReading, gauss, R_REF, D_REF, PLOT, SAMPLE, N_ADD,
                   BUSY_EPS, NET_EPS, IMBAL_EPS };

})(typeof window !== 'undefined' ? window : globalThis);

/* Under Node there is no <script> tag, and nothing above touches the DOM until
 * create() is called — so the checker requires this file and drives the real
 * advance(). MolLib has to be loaded first either way. */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = (typeof window !== 'undefined' ? window : globalThis).Diffusion;
}
