/* =============================================================================
 *  energy/energy.js — free energy on a vertical axis, and nothing else on it.
 *
 *  WHAT IT DRAWS. Two readings of one reaction, as two tabs of one card:
 *
 *    CURVE  the reaction coordinate. Start height, end height, a barrier
 *           between. Where a second reaction (or a pulled-away product) changes
 *           the outcome, a second trace shares the start and ends elsewhere,
 *           so "coupling flips the direction" is SEEN rather than inferred.
 *    PAIR   the two-arrow figure. The coupled arrow always runs opposite the
 *           main one: uphill happens because something steeper runs downhill
 *           beside it, and downhill is worth having because it pushes something
 *           uphill. Only a pathway step has that second reaction to draw.
 *
 *  THE ONE RULE, and the checker exists for it: THE AXIS HAS NO SCALE, so every
 *  height is a SIGN and never a magnitude. A pathway page holds no per-step ΔG°′
 *  it can source, and a trace proportioned to a number it does not have asserts
 *  one. Published magnitudes are coupling/coupling.js's subject, drawn on its
 *  own axis with its own audit; keep the two apart, because a card that mixes
 *  sourced and invented heights looks equally authoritative doing both.
 *
 *  EVERY y COMES FROM THE SPEC. No height is typed against a named step. A step
 *  declares which SHAPE it is and `levels()` returns the four numbers:
 *
 *    up        uphill on its own; the second trace is what makes it go
 *    shallow   barely downhill — drawn around the middle, not hung off the top,
 *              because on an unscaled axis position says nothing and only slope
 *              does. Starting a −3 kJ/mol step where a −33 one starts leaves the
 *              bottom two thirds empty and the eye reads height instead.
 *    pull      it goes because the product is removed, not because anything was
 *              spent — so the coupled trace clears the climb without ending
 *              below where it started
 *    (plain)   a real drop, part of it banked into a carrier
 *
 *  THE BARRIER IS AN INPUT, not decoration. A pathway lesson passes the shared
 *  default and means nothing by it: the ends are its claim and the hump is only
 *  there because the mass-action modal already said a molecule must climb
 *  something. An ENZYME lesson is the mirror image — the ends are pinned (an
 *  enzyme changes neither ΔG) and the barrier is the entire claim. Both read
 *  `spec.barrier`, and `spec.at` overrides the four levels outright for a host
 *  whose shape none of the flags above describe.
 *
 *  Loads as a plain script, no THREE, no scene. Needs energy.css.
 *  See energy-test.html for the smallest working host.
 * ========================================================================== */
'use strict';

(function (root) {

/* ---- THE LADDER ---------------------------------------------------------
 * Four rungs in viewBox units, and a card is 300x152. `peak` is a DEPTH above
 * whichever rung is highest, not a rung itself — a barrier measured from an end
 * moves when the end does, and then lowering a product raises its barrier.
 */
const Y = { hi:34, mid:76, lo:120 };
const BARRIER = 22;
// A shallow step's whole drop, centred on `mid` rather than measured from an
// end: moving it down must not also make it fall further.
const SHALLOW_DROP = 26;
// What the second trace buys. `up` steps clear the climb; a pulled step only
// stops the climb being a wall, so it does not end below where it started.
const COUPLED_GAIN = 16, PULL_GAIN = 8;

/* The four heights, pure and exported so check-energy.js runs THIS rather than
 * a copy of it. `at` is the escape hatch a non-pathway host uses. */
function levels(c) {
  // `barrierAlone` defaults to the same hump: one barrier is the pathway case,
  // and a second one has to be asked for.
  const bars = { barrier: c.barrier ?? BARRIER,
                 barrierAlone: c.barrierAlone ?? c.barrier ?? BARRIER };
  if (c.at) return Object.assign(bars, c.at);
  const shal = SHALLOW_DROP / 2;
  const start    = c.up ? Y.lo : (c.shallow ? Y.mid - shal : Y.hi);
  const endAlone = c.up ? Y.mid : (c.shallow ? Y.mid + shal : Y.lo);
  const endWith  = c.up ? (c.pull ? Y.lo - PULL_GAIN : Y.lo + COUPLED_GAIN)
                        : (c.shallow ? Y.mid - shal + COUPLED_GAIN : Y.mid);
  return Object.assign({ start, endAlone, endWith }, bars);
}

/* Which of the two ends the second trace reaches IS the verdict, so it is
 * measured off the drawing rather than restated. y grows DOWNWARD and free
 * energy grows upward, so a trace that ends at a larger y ends lower. */
const BETTER = (L, up) => up ? L.endWith > L.endAlone : L.endWith < L.endAlone;

/* The carrier tints the coupled half. 'p' phosphate, 'n' NAD, 'f' FAD — the
 * page's own tokens, resolved in energy.css so a caption and the trace beside
 * it cannot name different colours. */
const toneOf = t => (t === 'n' || t === 'f') ? t : 'p';

// Only a '+' against the preceding character is a CHARGE (NAD+). Spaced, it is
// arithmetic (G3P + Pi) and stays on the baseline — superscript it and "G3P
// plus Pi" reads as a cation.
const sup = t => String(t)
  .replace(/(\S)\+/g, '$1<tspan baseline-shift="super" font-size="9">+</tspan>')
  .replace(/Pi\b/, 'P<tspan baseline-shift="sub" font-size="9">i</tspan>');

// The axis is a hint, not a scale: a line, an arrowhead and a word. Drawn by
// the module so no host can add ticks to it.
const AXIS = `<text class="ax" transform="translate(12,88) rotate(-90)">free energy</text>
    <path class="axl" d="M22,134 L22,22"/><path class="axh" d="M22,15 l4.5,10 h-9 z"/>`;

// One trace shape, both ends free. Flat in, over the hump, flat out.
const trace = (y0, y1, peak) =>
  `M34,${y0} H88 C120,${y0} 126,${peak} 150,${peak}`
  + ` C174,${peak} 180,${y1} 212,${y1} H266`;

/* ---- THE CURVE ----------------------------------------------------------
 * `alone` is the reaction by itself, `with` is it in the cell. They share a
 * start and a peak, so they are superimposed for the whole climb and whichever
 * is drawn second is what you see — DASHED ON TOP, because dashed over solid
 * reads as both. The other order hides one and the figure looks like a single
 * curve that forks.
 *
 * TWO PEDAGOGICAL EXAGGERATIONS, both in that shared climb, and neither is an
 * oversight (SCIENCE.md: an exaggeration stays explicit in a comment):
 *
 *  1. THEY DO NOT REALLY START AT THE SAME HEIGHT. Glucose + ATP is not the
 *     same free energy as glucose alone, so a coupled step's two traces begin
 *     at different places. Drawn apart, there is nothing left to compare: the
 *     figure's entire job is that ONE thing differs between the two readings,
 *     which is where the reaction ends up.
 *
 *  2. THEY DO NOT REALLY SHARE A TRANSITION STATE. They are different
 *     reactions, with different enzymes and different barriers.
 *
 * The second one is drawn shared for a reason worth keeping. On an axis with no
 * scale, two humps of different heights are a claim about RATE — and coupling
 * changes NEITHER barrier, exactly as an enzyme changes
 * neither ΔG. Peaking them separately would trade a hidden approximation for a
 * visible false claim, and one this repo argues against twice over
 * (coupling/coupling.js's claim 3, and massaction/, whose subject the barrier
 * is). check-energy.js asserts the shared peak so a later tidy-up cannot
 * quietly introduce it.
 *
 * `barrierAlone` IS THE ONE CASE THAT MAY DIFFER, and it inverts the argument
 * rather than escaping it. Ask for a second barrier and the two humps are the
 * subject: same reaction, same ends, one of them catalysed. Nothing about where
 * the reaction ends up moves, which is what makes the different heights a claim
 * about rate and a true one. A pathway must never declare it — asserted, since
 * that is where the false version would appear.
 */
/* WHERE A LABEL SITS. There is no room to the RIGHT of a trace running to
 * x=266, so a label goes over or under the end it names. Above by default; the
 * LOWER of the two goes BELOW its own trace, and both reasons are collisions
 * the shapes produce on their own:
 *
 *   · a `shallow` step's ends are 10px apart at a 10px font, so two labels
 *     stacked above them overlap each other
 *   · a `pull` step's label is a phrase, not a word, and a long one placed
 *     above the lower trace runs back across that trace's own descent
 *
 * FLOOR, because the card ends at 152 and the axis foot at 134: an `up` step's
 * coupled trace lands too low to put anything under it, so it keeps the default.
 */
const BELOW = 13, ABOVE = 7, FLOOR = 138;
const labelY = (y, lower) => (lower && y + BELOW <= FLOOR) ? y + BELOW : y - ABOVE;

function curve(c) {
  const L = levels(c);
  const twoBarriers = c.barrierAlone != null;
  // ONE peak for both traces by default, measured above whichever end sits
  // highest — see the note above. Above the HIGHEST end so that every trace
  // climbs before it falls, including the uphill one, whose product is the top
  // of its own curve. With a second barrier asked for, each trace is measured
  // above its own highest point instead, and the two humps are the point.
  const top = Math.min(L.start, L.endAlone, L.endWith);
  const peakWith  = (twoBarriers ? Math.min(L.start, L.endWith)  : top) - L.barrier;
  const peakAlone = (twoBarriers ? Math.min(L.start, L.endAlone) : top) - L.barrierAlone;
  const withLabel = c.withLabel
    || (c.pull ? `with ${c.pullName} taken away` : `with ${c.up ? c.cin : c.cout}`);
  // ?? not ||, so a host can pass '' for a trace it does not want named — the
  // enzyme figure labels the reaction once, not once per barrier.
  const aloneLabel = c.aloneLabel ?? 'on its own';
  // y grows downward, so the larger end is the lower trace.
  const aloneLower = L.endAlone > L.endWith;
  const text = (cls, y, lower, label) => label
    ? `<text class="et ${cls}" x="266" y="${labelY(y, lower)}" text-anchor="end">${label}</text>`
    : '';
  return `<svg class="cpl ${toneOf(c.tone)}" viewBox="0 0 300 152" role="img"
      aria-label="${twoBarriers
        ? `${c.from} to ${c.to}: one reaction drawn with two barriers. ${withLabel}
           climbs the lower one; both traces start and end in the same place, so
           nothing about the energy of the reaction has changed`
        : `${c.from} to ${c.to}: on its own the step runs ${c.up?'uphill':'downhill'};
           ${withLabel} it runs ${BETTER(L,c.up) ? (c.up?'downhill':'less far down') : 'no further'}`}">
    ${AXIS}
    <path class="rc with"  d="${trace(L.start, L.endWith, peakWith)}"/>
    <path class="rc alone" d="${trace(L.start, L.endAlone, peakAlone)}"/>
    ${text('alone', L.endAlone, aloneLower, aloneLabel)}
    ${text('with', L.endWith, !aloneLower, withLabel)}
  </svg>`;
}

/* ONE TRACE, for a reaction with nothing beside it. Not a special case of the
 * above with a trace missing — a blank figure would make "energy curve" look
 * like a property of coupled steps rather than of every reaction.
 *
 * THE HEIGHTS ARE READ OFF THE CLAIM: `drop` is the host's own irreversibility
 * flag, so neither end is typed against a particular step. A level trace under
 * a caption reading "steeply downhill" is the picture contradicting the words.
 */
function solo(c) {
  const drop = !!c.drop;
  const L = c.at || { start: drop?Y.hi:Y.mid, endAlone: drop?Y.lo:Y.mid };
  const peak = Math.min(L.start, L.endAlone) - (c.barrier ?? BARRIER);
  return `<svg class="cpl" viewBox="0 0 300 152" role="img"
      aria-label="${c.from} to ${c.to}: ${drop
        ? 'the product sits well below the substrate'
        : 'substrate and product sit at nearly the same free energy'},
        with a barrier between them">
    ${AXIS}
    <path class="rc solo" d="${trace(L.start, L.endAlone, peak)}"/>
    <text class="et alone" x="34"  y="${L.start+18}">${c.from}</text>
    <text class="et alone" x="266" y="${L.endAlone+18}" text-anchor="end">${c.to}</text>
  </svg>`;
}

/* ---- THE PAIR -----------------------------------------------------------
 * Vertical position is free energy here too, which is why there is no axis to
 * read. Higher-energy species on top: the product if the step is uphill, the
 * substrate if it is downhill, and the carrier's charged form (ATP, NADH)
 * always. Both curve directions are written out — same shape, only the
 * arrowhead end differs, explicit rather than derived by string surgery.
 */
const CURVE_DOWN = 'M176,42 C126,48 90,58 90,74 C90,90 126,100 176,106';
const CURVE_UP   = 'M176,106 C126,100 90,90 90,74 C90,58 126,48 176,42';
function pair(c) {
  const topMain = c.up ? c.to  : c.from, botMain = c.up ? c.from : c.to;
  const topCpl  = c.up ? c.cin : c.cout, botCpl  = c.up ? c.cout : c.cin;
  return `<svg class="cpl ${toneOf(c.tone)}" viewBox="0 0 300 152" role="img"
      aria-label="${c.from} to ${c.to} runs ${c.up?'uphill':'downhill'}; coupled to ${c.cin} becoming ${c.cout}, which runs the opposite way">
    ${AXIS}
    <text class="cm" x="66" y="16" text-anchor="middle">${sup(topMain)}</text>
    <path class="ml" d="${c.up ? 'M66,116 L66,34' : 'M66,30 L66,112'}"/>
    <path class="mh" d="${c.up ? 'M66,24 l6.5,13 h-13 z' : 'M66,122 l6.5,-13 h-13 z'}"/>
    <text class="cm" x="66" y="147" text-anchor="middle">${sup(botMain)}</text>
    <path class="cl" d="${c.up ? CURVE_DOWN : CURVE_UP}"/>
    <path class="ch" d="${(c.up ? 'M176,106' : 'M176,42')} l-11,-4.5 v9 z"/>
    <text class="cs" x="186" y="46">${sup(topCpl)}</text>
    <text class="cs" x="186" y="110">${sup(botCpl)}</text>
  </svg>`;
}

/* ---- THE TAB STRIP ------------------------------------------------------
 * Two views of one reaction, so the control belongs to the module that draws
 * both. The host stores the selection (its card is rebuilt from scratch every
 * refresh, so a DOM-stored one would reset with it) and reads `data-figtab`.
 * A host with only the curve draws no strip: a single tab is a control that
 * does nothing.
 */
const TABS = [['curve','Energy curve'], ['pair','Coupling']];
const tabs = active => `<div class="ftabs">`
  + TABS.map(([k,label]) =>
      `<button data-figtab="${k}"${active===k?' class="on"':''}>${label}</button>`).join('')
  + `</div>`;

root.Energy = { curve, solo, pair, tabs, levels, Y, BARRIER, TABS, sup };

})(typeof window !== 'undefined' ? window : globalThis);

if (typeof module !== 'undefined' && module.exports) module.exports = globalThis.Energy;
