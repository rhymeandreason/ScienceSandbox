/* =============================================================================
 *  massaction.js — a box of molecules, an enzyme with no preference, and a
 *  counter proving both directions run at once.
 *
 *  WHAT IT TEACHES. Two things a student is meant to take away, and neither is
 *  a property of anything drawn — both are properties of two numbers:
 *
 *    1. A flat step settles EVEN, with both directions still running. It did
 *       not stop; the traffic evened out.
 *    2. A downhill step runs essentially to completion, and the reverse is rare
 *       because a big energy is steeply rarer to find — not because the enzyme
 *       refuses to run it.
 *
 *  WHY IT IS A MODULE. It was page-local JS inside glycolysis-lab.html, which
 *  was right while glycolysis was its only host. The enzymes page needs the
 *  same physics with `ea` as a slider (lower the barrier, watch the rate move
 *  while ΔE does not), and a second copy of a legibility-tuned constant is
 *  precisely what a checker cannot see. LESSONS-ROADMAP.md §1.
 *
 *  WHAT IT OWNS vs WHAT THE PAGE OWNS — CLAUDE.md's "share the plumbing, not
 *  the physics" split, one level down:
 *
 *    module — the thermal distribution, the barrier test, the particle box,
 *             the counters, the reaction-coordinate curve, and every piece of
 *             DOM inside its own root.
 *    page   — WHICH reaction (species names, ΔE, prose), and the chrome around
 *             it. Glycolysis puts it in a modal; the enzymes page will put it
 *             in a panel beside a slider. Neither is this file's business.
 *
 *  NO MolLib, NO Three.js, NO spec. The dots stand for POPULATIONS; drawing
 *  them as molecules would make a geometry claim nothing backs.
 *
 *  Its claims are asserted by massaction/check-massaction.js, which lifts these
 *  constants rather than copying them. `ea` especially: it is a legibility knob
 *  (it makes about half of arrivals react), so it is exactly the number
 *  somebody retunes, and retuning it far enough stops a flat step settling 1:1
 *  while everything still looks fine.
 *
 *  Loads as a plain script; needs massaction.css and the Phosphor bold icon
 *  font. See massaction-test.html for the smallest working host.
 * ========================================================================== */
'use strict';

(function (root) {

/* ---- ENERGY, IN UNITS OF kT ---------------------------------------------
 * Each molecule carries an energy, re-drawn from random jostling; a reaction
 * happens when the arrival holds enough to clear the barrier. Two consequences
 * fall out rather than being declared:
 *   · Energies are exponentially distributed, so a barrier twice as tall is
 *     exponentially rarer to clear, not half as often cleared. That steepness
 *     is why "a bit further downhill" becomes "essentially never".
 *   · A CATALYST CANNOT CHANGE THE EQUILIBRIUM. `ea` is the same in both
 *     directions; the only asymmetry is the scenario's `drop`, which belongs to
 *     the reaction, not to the enzyme. Lowering `ea` speeds both ways at once.
 *
 * P(E >= x) = exp(-x) for an exponential with mean kT: exp(-0.6) = 0.55 per
 * forward encounter, and a drop of ln(200) makes the reverse 1/200 of that.
 */
const EA_DEFAULT = 0.6;                 // barrier, both directions

// One draw from the thermal distribution: exponential, mean 1 kT. Most near
// the bottom, a few far up the tail — the fact a downhill step turns on, so it
// is sampled rather than approximated.
const sampleE = () => -Math.log(1 - Math.random());

const COL = ['#4f5bd5', '#a855f7'];     // substrate, product

const N0 = 54, R = 5.5;
// Five enzyme copies, not one: a single central site reads as a GATE, which is
// the one thing this is not. The enzyme is dissolved in the same solution.
const SITES = [[.22,.30],[.50,.62],[.78,.28],[.36,.76],[.68,.84]], SITE_R = 30;
// Re-jostle interval. Real collisions are far more frequent; at 60fps a truly
// fast redraw is a flicker, and the point is to SEE a dot hot for a moment.
const KICK = [0.30, 0.85];
const VSPD = 34;                        // px/s at one kT — speed is sqrt(E)
// How long a bound molecule sits before it turns. Catalysis is not instant, and
// a dot recolouring on contact gives nothing to see — the pause IS the event.
const BOUND = 0.34;

// Printed numbers resample once a second to stay readable; the ARROW cannot
// wait a second, and a per-frame count is 0 or 1. So it runs off its own
// exponential average — same events, smoothed over TAU, not bucketed.
const TAU = 0.9;
// Below this many net conversions/s, call it balanced: at equilibrium the
// difference is jitter around zero, and an arrow flickering left and right says
// the opposite of what is happening.
const NET_EPS = 1.6;
// "NOTHING LEFT TO CONVERT" IS ABOUT THE POPULATION, NOT THE RATE. A flat step
// at equilibrium and a downhill step run to completion both net zero, and
// calling both "balanced" collapses the distinction this demo exists to draw.
// Low throughput is the tempting test but only guesses how busy this box is and
// flickers on any dip. The real condition: one side has RUN OUT — something a
// flat step parked at 27/27 can never satisfy. So one species below this share
// of the total, AND near-zero traffic to confirm it.
const SPENT_FRAC = 0.06, BUSY_EPS = 1.2;
// The average starts at zero on every open, reset and tab switch, so without
// this the bar announces "nothing left to convert" during the one second the
// reaction is most obviously going.
const WARMUP = 1.4;

const rnd = (a, b) => a + Math.random() * (b - a);

/* ---- THE REACTION COORDINATE --------------------------------------------
 * Drawn, not described. Two levels alone left the barrier invisible — nothing
 * to climb. With the hump, "the reverse barrier is EA + ΔE" is the SAME peak
 * from a lower start: visible, not algebra.
 *
 * ONE SCALE FOR EVERY SCENARIO, fixed at the biggest span any of them needs.
 * `ea` is the same number on all of them, so its hump must be the same height
 * on all of them; auto-fitting each scenario would draw a flat step's barrier
 * as tall as a drop step's and say, wrongly, that they differ. Cost: the flat
 * step is a small bump in a big box, which is exactly what it is.
 *
 * Pure, and separated from the DOM on purpose: this is the piece of drawing
 * that makes geometric CLAIMS (the hump IS ea, the climb back IS ea + drop),
 * so the checker calls it directly and measures the path it returns.
 */
const CURVE_H = 88;                     // px of plot height, whatever the span
const epx = (ea, maxDrop) => CURVE_H / (ea + maxDrop);   // px per kT

function curveSVG(ea, drop, names, maxDrop) {
  const EPX = epx(ea, maxDrop);
  // Product taken as zero: only differences mean anything.
  const ePk = ea + drop, span = ePk * EPX, top = 12 + (CURVE_H - span) / 2;
  const y = e => top + (ePk - e) * EPX;
  const ySub = y(drop), yPk = y(ePk), yPrd = y(0);
  const gap = drop === 0 ? '' :
     `<path class="gap" d="M68,${ySub} H186"/>`
    +`<path class="gaparr" d="M180,${ySub+3} V${yPrd-3}"/>`
    +`<path class="gaparr" d="M180,${ySub} l3.2,6.6 h-6.4 z" fill="var(--ink)" stroke="none"/>`
    +`<path class="gaparr" d="M180,${yPrd} l3.2,-6.6 h-6.4 z" fill="var(--ink)" stroke="none"/>`;
  return `<svg viewBox="0 0 210 122" role="img" aria-label="Reaction coordinate: ${names[0]}`
    +` climbs a barrier and falls to ${names[1]}`
    +`${drop === 0 ? ', which sits at the same energy' : ', which sits far lower'}">`
    +`<text class="ax" transform="translate(9,74) rotate(-90)">energy</text>`
    +`<path class="axl" d="M17,10 V112"/>`
    + gap
    // the hump: level in, up and over the peak, down and level out
    +`<path class="rc" d="M26,${ySub} H68`
      +` C84,${ySub} 90,${yPk} 106,${yPk}`
      +` C122,${yPk} 128,${yPrd} 144,${yPrd} H196"/>`
    +`<text class="lb" x="40" y="${ySub-7}" fill="${COL[0]}">${names[0]}</text>`
    +`<text class="lb" x="182" y="${yPrd-7}" text-anchor="end" fill="${COL[1]}">${names[1]}</text>`
    +`<text class="ea" x="106" y="${yPk-8}" text-anchor="middle">E<tspan dy="2.5" font-size="7">A</tspan></text>`
    +`</svg>`
    + (drop === 0
        ? `<span>Same peak from both sides — <b>nothing extra</b> to go back.</span>`
        : `<span>Going back means climbing to the same peak from lower down:
           an extra <b>+${drop.toFixed(1)} kT</b>.</span>`);
}

const BLURB = `Each dot is one molecule. A dot's <b>speed is its energy</b>,
  determined randomly. A dot <b>glows where it has enough energy to react</b>.
  When a glowing dot drifts through an enzyme, it <b>converts (flips
  colour)</b>.`;

/* ---- ONE SIMULATION -----------------------------------------------------
 * opts:
 *   host       element to fill. Everything below lives inside it.
 *   scenarios  [{ key, tab, title, species:[A,B], drop, text }] — one or more.
 *              `drop` is how much further downhill the product sits, in kT.
 *              More than one renders a tab strip; they are the subject, not a
 *              setting, so they are tabs and not a toggle under the canvas.
 *   kicker     the term over the title. Default 'Mass action' — a student
 *              should leave with the name; they meet it again in enzyme
 *              kinetics and every equilibrium problem after.
 *   blurb      the how-to-read paragraph. Default above.
 *   ea         a number (fixed barrier), or {min,max,value,label} to render a
 *              slider — the enzymes page's whole interaction.
 *
 * returns { el, start, stop, setScenario, scenario, setEA, ea }
 */
function create(opts) {
  const host = opts.host;
  const scenarios = opts.scenarios;
  const eaOpt = opts.ea == null ? EA_DEFAULT : opts.ea;
  const eaSlider = typeof eaOpt === 'object' ? eaOpt : null;
  let ea = eaSlider ? eaSlider.value : eaOpt;
  // The curve's scale is fixed by the DEEPEST scenario, so switching tabs never
  // rescales the axis under the student.
  const maxDrop = Math.max(...scenarios.map(s => s.drop));

  host.classList.add('massaction');
  host.innerHTML =
     (scenarios.length > 1
        ? `<div class="ma-tabs" role="tablist">` + scenarios.map((s, i) =>
            `<button class="${i ? '' : 'on'}" role="tab" data-key="${s.key}"
                     aria-selected="${i ? 'false' : 'true'}">${s.tab}</button>`).join('')
          + `</div>`
        : '')
    + `<div class="ma-kick">${opts.kicker || 'Mass action'}</div>`
    + `<h2 class="ma-title"></h2>`
    + `<p class="ma-sub">${opts.blurb || BLURB}</p>`
    + `<canvas class="ma-canvas"></canvas>`
    + `<div class="ma-row">`
    +   `<div class="ma-spec"><span class="ma-dot" style="background:${COL[0]}"></span>`
    +     `<span class="ma-nm ma-nmA"></span><span class="ma-ct ma-ctA">0</span></div>`
    +   `<div class="ma-rate"><span>forward <b class="ma-rf">0</b>/s</span>`
    +     `<span>backward <b class="ma-rb">0</b>/s</span></div>`
    +   `<div class="ma-spec"><span class="ma-dot" style="background:${COL[1]}"></span>`
    +     `<span class="ma-nm ma-nmB"></span><span class="ma-ct ma-ctB">0</span></div>`
    + `</div>`
    + `<div class="ma-net"><i class="ph-bold ph-pause"></i><span></span></div>`
    + `<div class="ma-eq"></div>`
    + (eaSlider
        ? `<label class="ma-slider">`
          + `<span>${eaSlider.label || 'Barrier E<sub>A</sub>'}</span>`
          + `<input type="range" min="${eaSlider.min}" max="${eaSlider.max}"`
          +   ` step="0.05" value="${ea}">`
          + `<b class="ma-eaval"></b>`
          + `</label>`
        : '')
    + `<div class="ma-ctl">`
    +   `<button class="ma-addA pill pill--ghost">Add 15 <span class="ma-lbA"></span></button>`
    +   `<button class="ma-addB pill pill--ghost">Add 15 <span class="ma-lbB"></span></button>`
    +   `<button class="ma-reset pill pill--ghost">Reset</button>`
    + `</div>`
    + `<p class="ma-text"></p>`;

  const q = s => host.querySelector(s);
  const cv = q('.ma-canvas'), ctx = cv.getContext('2d');
  const ui = { A:q('.ma-ctA'), B:q('.ma-ctB'), nA:q('.ma-nmA'), nB:q('.ma-nmB'),
               rf:q('.ma-rf'), rb:q('.ma-rb'), bA:q('.ma-lbA'), bB:q('.ma-lbB'),
               title:q('.ma-title'), net:q('.ma-net'), ar:q('.ma-net i'),
               lb:q('.ma-net span'), eq:q('.ma-eq'), text:q('.ma-text'),
               eaval:q('.ma-eaval') };

  let parts = [], sc = scenarios[0], running = false, raf = 0, last = 0;
  let hits = [0, 0];                    // conversions this second, [forward, back]
  let rate = [0, 0], acc = 0;
  let ema = [0, 0], age = 0;

  function spawn(type, n) {
    for (let i = 0; i < n; i++) {
      parts.push({ t: type, x: rnd(.06, .94), y: rnd(.08, .92),
                   dir: rnd(0, Math.PI * 2), e: sampleE(),
                   kick: rnd(KICK[0], KICK[1]), site: -1, bound: 0, will: false });
    }
  }
  function reset() {
    // START LOPSIDED: an even start settles instantly and shows nothing.
    parts = []; spawn(0, N0); hits = [0, 0]; rate = [0, 0]; acc = 0; ema = [0, 0]; age = 0;
  }

  function step(dt, w, h) {
    const drop = sc.drop;
    parts.forEach(p => {
      // BOUND: held by the enzyme, not moving. Turns when the clock runs out.
      if (p.bound > 0) {
        p.bound -= dt;
        if (p.bound <= 0) {
          if (p.will) { hits[p.t]++; ema[p.t] += 1 / TAU; p.t = 1 - p.t; p.will = false; }
        }
        return;
      }
      // RE-JOSTLED: new energy from the bath, DIRECTION left alone — re-aiming
      // every kick is a true random walk and reads as jitter; speed is the
      // quantity this demo needs legible.
      p.kick -= dt;
      if (p.kick <= 0) { p.e = sampleE(); p.kick = rnd(KICK[0], KICK[1]); }
      const sp = VSPD * Math.sqrt(p.e);
      p.x += Math.cos(p.dir) * sp * dt / w; p.y += Math.sin(p.dir) * sp * dt / h;
      if (p.x < .03) { p.x = .03; p.dir = Math.PI - p.dir; }
      if (p.x > .97) { p.x = .97; p.dir = Math.PI - p.dir; }
      if (p.y < .05) { p.y = .05; p.dir = -p.dir; }
      if (p.y > .95) { p.y = .95; p.dir = -p.dir; }
      // A COLLISION IS THE ONLY THING THAT CONVERTS ANYTHING — nothing here
      // reads the counts. The counts win because a crowded species collides
      // more often; consulting the totals would make that a lie.
      let now = -1;
      for (let i = 0; i < SITES.length; i++) {
        const dx = (p.x - SITES[i][0]) * w, dy = (p.y - SITES[i][1]) * h;
        if (dx * dx + dy * dy < SITE_R * SITE_R) { now = i; break; }
      }
      // Decided ONCE, on arrival, by the energy held — not by a dice roll.
      // Forward must clear ea; back, ea plus everything the reaction released.
      // Most arrivals do neither and drift through, which is worth seeing.
      if (now >= 0 && now !== p.site && p.e >= ea + (p.t === 0 ? 0 : drop)) {
        p.bound = BOUND; p.will = true;
      }
      p.site = now;
    });
  }

  function draw(w, h) {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(58,52,44,.055)'; ctx.strokeStyle = 'rgba(58,52,44,.16)';
    ctx.lineWidth = 1.5;
    SITES.forEach(s => { ctx.beginPath();
      ctx.arc(s[0] * w, s[1] * h, SITE_R, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); });
    ctx.font = '600 9px system-ui,sans-serif'; ctx.fillStyle = 'rgba(58,52,44,.42)';
    ctx.textAlign = 'center';
    SITES.forEach(s => ctx.fillText('enzyme', s[0] * w, s[1] * h + SITE_R + 11));
    const drop = sc.drop;
    parts.forEach(p => {
      // TWO CHANNELS
      //   speed — how much energy this molecule has, plainly
      //   glow  — whether that is ENOUGH, measured against the barrier IT faces,
      //           which is ea forward and ea+drop back
      // Glow means exactly one thing — this one reacts if it reaches an enzyme
      // — so on a drop scenario blue glows constantly and violet almost never.
      // That contrast IS the lesson, visible without reading anything.
      const over = p.e / (ea + (p.t === 0 ? 0 : drop));
      if (over >= 1) {
        const hot = Math.min(1, (over - 1) / 1.2);
        ctx.beginPath(); ctx.arc(p.x * w, p.y * h, R + 2.5 + hot * 4.5, 0, Math.PI * 2);
        ctx.fillStyle = COL[p.t]; ctx.globalAlpha = 0.18 + 0.24 * hot; ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.beginPath(); ctx.arc(p.x * w, p.y * h, R, 0, Math.PI * 2);
      ctx.fillStyle = COL[p.t]; ctx.fill();
      // a closing ring while held, so the pause reads as an event, not a stall
      if (p.bound > 0) {
        const k = 1 - p.bound / BOUND;
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, R + 4.5, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2);
        ctx.strokeStyle = COL[1 - p.t]; ctx.lineWidth = 2.2; ctx.stroke();
      }
    });
  }

  function drawUI() {
    const a = parts.filter(p => p.t === 0).length;
    ui.A.textContent = a; ui.B.textContent = parts.length - a;
    ui.rf.textContent = rate[0].toFixed(1); ui.rb.textContent = rate[1].toFixed(1);
    // FOUR TESTS, AND THE ORDER MATTERS.
    //   any   — is anything happening at all
    //   both  — is EACH direction running, what "both ways at once" claims.
    //           Testing only |net| said it of a drop step's tail, where forward
    //           fades to zero and backward never ran: the gap closes and a
    //           one-way reaction gets called balanced.
    //   spent — one species has run out (population, not rate — SPENT_FRAC)
    const net = ema[0] - ema[1], busy = ema[0] + ema[1];
    const any   = busy >= BUSY_EPS;
    const both  = Math.min(ema[0], ema[1]) >= BUSY_EPS;
    const big   = Math.abs(net) >= NET_EPS;
    const spent = parts.length
      ? Math.min(a, parts.length - a) / parts.length < SPENT_FRAC : false;
    const state = (!any && spent && age > WARMUP) ? 'spent'
                : !any                            ? 'quiet'   // warm-up, or a lull
                : (both && !big)                  ? 'balanced'
                : 'net';
    const icon = state === 'spent' ? 'ph-pause'
               : state === 'net'   ? (net > 0 ? 'ph-arrow-right' : 'ph-arrow-left')
               : 'ph-arrows-left-right';
    // Only touch className when it changes — rewriting every frame makes the
    // icon font re-resolve 60×/s.
    if (ui.ar.dataset.icon !== icon) {
      ui.ar.className = 'ph-bold ' + icon; ui.ar.dataset.icon = icon;
    }
    ui.lb.textContent = state === 'spent'    ? 'nothing left to convert'
                      : state === 'balanced' ? 'balanced — both ways at once'
                      : state === 'quiet'    ? 'balanced'
                      : (net > 0 ? 'net forward' : 'net backward');
    const hot = state === 'net';
    const k = hot ? Math.min(1, Math.abs(net) / 9) : 0;
    const col = hot ? COL[net > 0 ? 1 : 0] : 'var(--muted)';
    ui.ar.style.color = col; ui.lb.style.color = col;
    ui.ar.style.transform = `scale(${(0.92 + 0.3 * k).toFixed(2)})`;
    ui.net.style.background = !hot ? 'rgba(58,52,44,.05)'
      : (net > 0 ? 'rgba(168,85,247,' : 'rgba(79,91,213,') + (0.06 + 0.12 * k).toFixed(2) + ')';
    ui.net.style.borderColor = !hot ? 'rgba(58,52,44,.14)'
      : (net > 0 ? 'rgba(168,85,247,' : 'rgba(79,91,213,') + (0.25 + 0.35 * k).toFixed(2) + ')';
  }

  function drawEq() {
    ui.eq.innerHTML = curveSVG(ea, sc.drop, sc.species, maxDrop);
  }

  function setScenario(key) {
    sc = scenarios.find(s => s.key === key) || scenarios[0];
    host.querySelectorAll('.ma-tabs button').forEach(b => {
      const on = b.dataset.key === sc.key;
      b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on));
    });
    ui.title.textContent = sc.title;
    drawEq();
    ui.nA.textContent = ui.bA.textContent = sc.species[0];
    ui.nB.textContent = ui.bB.textContent = sc.species[1];
    ui.text.innerHTML = sc.text;
    reset();       // each scenario starts lopsided, or there is nothing to watch
  }

  function setEA(v) {
    ea = v;
    if (ui.eaval) ui.eaval.textContent = v.toFixed(2) + ' kT';
    drawEq();      // the hump is ea tall — the picture has to move with it
  }

  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0); last = now;
    const w = cv.clientWidth, h = cv.clientHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    }
    ctx.setTransform(cv.width / w, 0, 0, cv.width / w, 0, 0);
    step(dt, w, h); draw(w, h);
    const d = Math.exp(-dt / TAU); ema[0] *= d; ema[1] *= d; age += dt;
    // conversions/second, resampled once a second so the number is readable
    acc += dt;
    if (acc >= 1) { rate = [hits[0] / acc, hits[1] / acc]; hits = [0, 0]; acc = 0; }
    drawUI();
    raf = requestAnimationFrame(frame);
  }

  function start() {
    running = true; last = performance.now();
    setScenario(sc.key);       // setScenario resets
    drawUI();                  // paint a real state, not the markup placeholder
    raf = requestAnimationFrame(frame);
  }
  function stop() { running = false; cancelAnimationFrame(raf); }

  host.querySelectorAll('.ma-tabs button')
      .forEach(b => b.onclick = () => setScenario(b.dataset.key));
  q('.ma-addA').onclick = () => spawn(0, 15);
  q('.ma-addB').onclick = () => spawn(1, 15);
  q('.ma-reset').onclick = reset;
  if (eaSlider) q('.ma-slider input').oninput = e => setEA(+e.target.value);

  setEA(ea);
  setScenario(sc.key);

  return { el: host, start, stop, setScenario, setEA,
           scenario: () => sc, ea: () => ea };
}

root.MassAction = { create, curveSVG, sampleE, epx,
                    EA_DEFAULT, COL, CURVE_H, SITES, SITE_R, N0,
                    KICK, VSPD, BOUND, TAU, NET_EPS, SPENT_FRAC, BUSY_EPS, WARMUP };

})(typeof window !== 'undefined' ? window : globalThis);

/* The checker runs under Node, where there is no <script> tag — but nothing
 * above touches the DOM until create() is called, so the file loads either way
 * and the constants come from one place. */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = (typeof window !== 'undefined' ? window : globalThis).MassAction;
}
