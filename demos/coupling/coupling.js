/* =============================================================================
 *  coupling.js — how a reaction that will not go, goes.
 *
 *  WHAT IT TEACHES. Three things, and the second is the one that decides
 *  whether a student actually understands ATP:
 *
 *    1. ΔG ADDS. Couple an uphill reaction to a downhill one and the number
 *       that decides is the SUM. Nothing else: not how big either half is, not
 *       which enzyme, not how fast.
 *    2. COUPLING NEEDS A SHARED INTERMEDIATE. This is the whole thing, and no
 *       textbook figure shows it, because the figure is two arrows side by
 *       side and two arrows side by side are exactly what does NOT work. ATP
 *       does not "give energy to" glucose. Its terminal phosphate is
 *       TRANSFERRED onto glucose, and that one molecule being part of both
 *       half-reactions is what lets their ΔG add. Run the two in the same
 *       beaker with nothing in common and the favourable one simply runs while
 *       the unfavourable one simply doesn't — which the toggle here does.
 *    3. THE ENZYME IS NOT IN IT. Hexokinase changes neither ΔG. It changes the
 *       barrier, which is massaction.js's subject and asserted there.
 *
 *  MAGNITUDES, DELIBERATELY — and this is where it parts company with
 *  glycolysis-lab.html, which draws the same coupling as arrows with NO
 *  numbers on purpose (see its coupleCurve: "the figure claims a SIGN only —
 *  to scale it would assert ΔG the page cannot source"). That was right for a
 *  page whose subject is the pathway. Here the arithmetic IS the subject, so
 *  the numbers have to be real, and every one of them is a published standard
 *  free-energy change carried on the scenario with its source. check-coupling.js
 *  audits them against the values and audits that the drawing adds up.
 *
 *  ΔG°′ vs ΔG. Every number here is a STANDARD value — 1 M, pH 7, 25 °C —
 *  which is what a textbook quotes and what a student will meet. Real cellular
 *  ATP hydrolysis is nearer −50 kJ/mol because the cell holds ATP far from
 *  equilibrium. The scenarios say so where it matters; the arithmetic is
 *  identical either way, which is the point.
 *
 *  Loads as a plain script. Needs coupling.css and the Phosphor bold icon font.
 *  See coupling-test.html for the smallest working host.
 * ========================================================================== */
'use strict';

(function (root) {

/* ---- THE ARITHMETIC, and it is the whole model ---------------------------
 * Pure, tiny, and exported so check-coupling.js runs THIS rather than a copy.
 * `shared` is not decoration: with no shared intermediate the two reactions
 * are independent, their ΔG do not combine, and the uphill one is decided by
 * its own sign alone.
 */
function verdict(dgUp, dgDown, shared) {
  const total = shared ? dgUp + dgDown : dgUp;
  return { total: +total.toFixed(2), runs: total < 0, coupled: !!shared };
}

/* Spontaneity is a SIGN, and the threshold is exactly zero. Named rather than
 * inlined because "< 0" appears in the verdict, the colouring and the label,
 * and three copies of a rule is how two of them drift. */
const RUNS = t => t < 0;

/* ---- THE LADDER ---------------------------------------------------------
 * Free energy on a vertical axis: each reaction is an arrow whose LENGTH is
 * its |ΔG| at a shared scale, so the coupled arrow is visibly the two others
 * laid end to end. That is the claim — the picture is the addition.
 *
 * ONE SCALE FOR ALL THREE ARROWS, fixed by the biggest |ΔG| on screen. Scaling
 * each arrow to its own box would draw a +13.8 and a −30.5 the same length and
 * say, wrongly, that they cancel.
 *
 * Pure, and separated from the DOM for the same reason massaction's curveSVG
 * and diffusion's spreadSVG are: it makes a geometric claim, so the checker
 * measures the path it returns rather than trusting it.
 */
const PLOT = { w: 300, h: 190, x0: 34, top: 16, bot: 156, lanes: [72, 150, 236] };

/* EVERY ENERGY LEVEL THE FIGURE WILL DRAW, so the axis can be fitted to them.
 * A lone arrow spans 0→ΔG; the stacked pair spans 0→up→up+down, and its middle
 * level is the tallest thing on screen whenever the uphill half is drawn
 * first. Collected rather than assumed: the zero line was pinned to the bottom
 * of the box in the first version, which is only right if nothing ever points
 * downward — and the whole subject here is a reaction that does. */
function levelsOf(steps) {
  const v = [0];
  for (const s of steps) {
    if (s.stack) { v.push(s.stack[0], s.stack[0] + s.stack[1]); }
    else v.push(s.dg);
  }
  return { lo: Math.min(...v), hi: Math.max(...v) };
}
const pxPerKJ = span => (PLOT.bot - PLOT.top) / Math.max(span, 1);

function ladderSVG(steps) {
  const { lo, hi } = levelsOf(steps);
  const k = pxPerKJ(hi - lo);
  // y GROWS DOWNWARD, so a higher energy is a smaller y. One mapping, used by
  // the baseline and by every segment end — two of them would drift.
  const y = v => PLOT.bot - (v - lo) * k;
  const zero = y(0);

  const seg = (x, fromV, dg, cls, head) => {
    const y1 = y(fromV), y2 = y(fromV + dg);
    const up = dg > 0;
    const arrow = head
      ? `<path class="cp-head" d="M${x},${y2} ${up ? 'l5.5,11 h-11 z' : 'l5.5,-11 h-11 z'}"/>`
      : '';
    return { v: fromV + dg,
             svg: `<path class="cp-shaft ${cls}" d="M${x},${y1} L${x},${y2}"/>` + arrow };
  };

  let out = '';
  steps.forEach((st, i) => {
    const x = PLOT.lanes[i];
    const label = `<text class="cp-lb" x="${x}" y="${PLOT.h - 4}" text-anchor="middle">${st.label}</text>`;
    if (st.stack) {
      /* THE COUPLED LANE IS DRAWN AS THE ADDITION, not as a third
       * independent arrow. The first version drew all three from the same
       * baseline, and the picture stopped being the sum — you could only
       * see that it added by reading the arithmetic underneath, which is
       * the thing the figure was supposed to save you. Here the uphill
       * segment climbs from zero and the downhill one continues from ITS
       * TIP, so where the pair finishes IS the total, and a dashed rule
       * carries that level back to the axis. */
      const a = seg(x, 0, st.stack[0], 'up', false);
      const b = seg(x, a.v, st.stack[1], 'down', true);
      out += `<g class="cp-arrow net">${a.svg}${b.svg}`
        + `<path class="cp-level" d="M${PLOT.x0},${y(b.v)} H${x + 30}"/>`
        + `<text class="cp-dg" x="${x + 12}" y="${y(b.v) + (b.v < 0 ? 14 : -7)}">`
        + `${st.dg > 0 ? '+' : ''}${st.dg.toFixed(1)}</text>`
        + label + `</g>`;
    } else {
      const a = seg(x, 0, st.dg, st.cls, true);
      out += `<g class="cp-arrow ${st.cls}">${a.svg}`
        + `<text class="cp-dg" x="${x + 12}" y="${(zero + y(a.v)) / 2 + 4}">`
        + `${st.dg > 0 ? '+' : ''}${st.dg.toFixed(1)}</text>`
        + label + `</g>`;
    }
  });

  return `<svg viewBox="0 0 ${PLOT.w} ${PLOT.h}" role="img"
      aria-label="Free-energy change of each reaction as an arrow: `
      + steps.map(s => `${s.label} ${s.dg > 0 ? 'plus' : 'minus'} ${Math.abs(s.dg)}`).join(', ')
      + `">
    <text class="cp-ax" transform="translate(12,100) rotate(-90)">free energy</text>
    <path class="cp-axl" d="M${PLOT.x0},${PLOT.top} V${PLOT.bot}"/>
    <path class="cp-zero" d="M${PLOT.x0},${zero} H${PLOT.w - 10}"/>
    <text class="cp-ax" x="${PLOT.w - 8}" y="${zero - 4}" text-anchor="end">0</text>
    ${out}
  </svg>`;
}

const BLURB = `Each arrow is one reaction's <b>free-energy change</b>. Down is
  downhill — it happens on its own. Up is uphill, and it does not. The third
  arrow is the other two <b>added together</b>.`;

/* ---- ONE MOUNT ----------------------------------------------------------
 * opts:
 *   host       element to fill
 *   scenarios  [{ key, tab, title, text, up, down, shared, note }] where
 *              `up` and `down` are { label, dg, formula, src } and `shared`
 *              names the group that moves between them — the thing that makes
 *              the two ONE reaction rather than two.
 *   range      [min,max] for the uphill slider, kJ/mol. Omit to pin it.
 *   kicker     term over the title. Default 'Energy coupling'.
 */
function create(opts) {
  const host = opts.host;
  const scenarios = opts.scenarios;
  const range = opts.range || null;

  host.classList.add('coupling');
  host.innerHTML =
     (scenarios.length > 1
        ? `<div class="cp-tabs" role="tablist">` + scenarios.map((s, i) =>
            `<button class="${i ? '' : 'on'}" role="tab" data-key="${s.key}"
                     aria-selected="${i ? 'false' : 'true'}">${s.tab}</button>`).join('')
          + `</div>` : '')
    + `<div class="cp-kick">${opts.kicker || 'Energy coupling'}</div>`
    + `<h2 class="cp-title"></h2>`
    + `<p class="cp-sub">${opts.blurb || BLURB}</p>`
    + `<div class="cp-fig"></div>`
    + `<div class="cp-verdict"><i class="ph-bold ph-x-circle"></i><span></span></div>`
    + `<div class="cp-sum"></div>`
    + (range ? `<label class="cp-slider"><span>Uphill reaction ΔG°′</span>`
             // STEP 0.1, NOT 0.5, and it is a correctness fix rather than a
             // feel one: the scenario's published ΔG has to be a value the
             // slider can actually hold. At 0.5 the hexokinase +13.8 snapped
             // to +14.0 on load, so the page opened showing a number that is
             // not the one it cites. check-coupling.js asserts it.
             + `<input type="range" min="${range[0]}" max="${range[1]}" step="0.1">`
             + `<b class="cp-dgval"></b></label>` : '')
    + `<label class="cp-share"><input type="checkbox" checked>`
    + `<span class="cp-sharelb"></span></label>`
    + `<p class="cp-text"></p>`;

  const q = s => host.querySelector(s);
  const ui = { fig:q('.cp-fig'), verdict:q('.cp-verdict'), vi:q('.cp-verdict i'),
               vs:q('.cp-verdict span'), sum:q('.cp-sum'), title:q('.cp-title'),
               text:q('.cp-text'), share:q('.cp-share input'),
               shareLb:q('.cp-sharelb'), slider:q('.cp-slider input'),
               dgval:q('.cp-dgval') };

  let sc = scenarios[0], dgUp = sc.up.dg;

  function draw() {
    const shared = ui.share.checked;
    const v = verdict(dgUp, sc.down.dg, shared);
    // The scale spans the biggest single arrow, so nothing is clipped and all
    // three stay comparable.
    ui.fig.innerHTML = ladderSVG([
      { label: sc.up.label,   dg: dgUp,         cls: 'up' },
      { label: sc.down.label, dg: sc.down.dg,   cls: 'down' },
      shared ? { label:'coupled', dg:v.total, cls:'net', stack:[dgUp, sc.down.dg] }
             : { label:'no link',  dg:dgUp,    cls:'net' },
    ]);

    // THE SUM, WRITTEN OUT, because the picture shows that it adds and only
    // the arithmetic shows what it adds to.
    ui.sum.innerHTML = shared
      ? `<b>${dgUp > 0 ? '+' : ''}${dgUp.toFixed(1)}</b> + <b>${sc.down.dg.toFixed(1)}</b>`
        + ` = <b class="cp-tot">${v.total > 0 ? '+' : ''}${v.total.toFixed(1)}</b> kJ/mol`
      : `No shared intermediate, so nothing adds: the uphill reaction is left`
        + ` with its own <b>${dgUp > 0 ? '+' : ''}${dgUp.toFixed(1)}</b> kJ/mol.`;

    const runs = RUNS(shared ? v.total : dgUp);
    const icon = runs ? 'ph-check-circle' : 'ph-x-circle';
    if (ui.vi.dataset.icon !== icon) { ui.vi.className = 'ph-bold ' + icon; ui.vi.dataset.icon = icon; }
    ui.vs.textContent = runs ? 'this reaction runs' : 'this reaction does not run';
    ui.verdict.classList.toggle('go', runs);
    ui.shareLb.innerHTML = shared
      ? `<b>${sc.shared}</b> is transferred from one to the other — one reaction, so the two ΔG add.`
      : `Same beaker, nothing transferred. Untick and they are just two reactions that ignore each other.`;
    if (ui.dgval) ui.dgval.textContent = `${dgUp > 0 ? '+' : ''}${dgUp.toFixed(1)} kJ/mol`;
  }

  function setScenario(key) {
    sc = scenarios.find(s => s.key === key) || scenarios[0];
    host.querySelectorAll('.cp-tabs button').forEach(b => {
      const on = b.dataset.key === sc.key;
      b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on));
    });
    dgUp = sc.up.dg;
    if (ui.slider) ui.slider.value = String(dgUp);
    ui.title.textContent = sc.title;
    ui.text.innerHTML = sc.text;
    ui.share.checked = true;
    draw();
  }

  host.querySelectorAll('.cp-tabs button')
      .forEach(b => b.onclick = () => setScenario(b.dataset.key));
  ui.share.onchange = draw;
  if (ui.slider) ui.slider.oninput = e => { dgUp = +e.target.value; draw(); };

  setScenario(sc.key);
  return { el: host, setScenario, draw,
           scenario: () => sc, dgUp: () => dgUp,
           setDgUp: v => { dgUp = v; if (ui.slider) ui.slider.value = String(v); draw(); },
           setShared: b => { ui.share.checked = b; draw(); } };
}

root.Coupling = { create, verdict, ladderSVG, levelsOf, pxPerKJ, RUNS, PLOT };

})(typeof window !== 'undefined' ? window : globalThis);

if (typeof module !== 'undefined' && module.exports) {
  module.exports = (typeof window !== 'undefined' ? window : globalThis).Coupling;
}
