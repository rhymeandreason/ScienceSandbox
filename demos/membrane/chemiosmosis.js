/* =============================================================================
 *  membrane/chemiosmosis.js — the proton circuit, as arithmetic.
 * =============================================================================
 *  NO THREE, NO DOM. Same split as pump.js: this file decides what the proton
 *  gradient IS and what the synthase is allowed to do with it, membrane.js
 *  draws the result, and check-chemiosmosis.js runs this in node.
 *
 *  Respiration and photosynthesis are one picture with one parameter flipped.
 *  Something with energy to spend pumps protons across a membrane; ATP
 *  synthase lets them back down and makes ATP on the way. The sim's own words
 *  are `inside` (−y) and `outside` (+y) always; a CONTEXT only renames them:
 *
 *      mitochondrion   outside = intermembrane space, inside = matrix
 *      thylakoid       outside = lumen,               inside = stroma
 *
 *  Both pump inside → outside, so the physics never moves; which real space
 *  is "inside" is the context. The thylakoid pumps into the lumen and the
 *  mitochondrion out of the matrix, and those are the same direction here.
 *
 *  STOICHIOMETRY. A c-ring turn is one full rotation of the rotor and makes
 *  ATP_PER_TURN ATP for PROTONS_PER_TURN protons. Mammalian F1Fo has a c8
 *  ring: 8 H⁺ per 3 ATP, so ~2.7 H⁺ per ATP. Drawn as 9 per 3, because a
 *  third of a turn has to be a whole number of protons for a student to see
 *  the ratio at all. Declared, not hidden — a page may print it.
 *
 *  pH IS EXAGGERATED and in one number. A drawn proton stands for a great
 *  many, so PROTONS_PER_PH says how many drawn ones make a pH unit. Without
 *  it a dozen particles would read as six pH units.
 * ========================================================================== */
(function (global) {
  'use strict';

  const PROTONS_PER_TURN = 9;
  const ATP_PER_TURN = 3;
  const PROTONS_PER_ATP = PROTONS_PER_TURN / ATP_PER_TURN;
  const PROTONS_PER_PH = 24;      // drawn protons per pH unit (exaggeration)
  const PH_REF = 7.0;             // both sides start here, before any pumping
  const MV_PER_PH = 61;           // Nernst at 37 C, the same 61 membrane.js uses

  const CONTEXTS = {
    plasma:        { outside: 'outside the cell',     inside: 'inside the cell', head: 0xe0705c, tail: 0xf0c98a },
    mitochondrion: { outside: 'intermembrane space',  inside: 'the matrix',      head: 0xc9739b, tail: 0xe8b6cd },
    thylakoid:     { outside: 'the lumen',            inside: 'the stroma',      head: 0x5f9e6b, tail: 0xbcd9a6 },
  };
  const sideName = (context, side) => (CONTEXTS[context] || CONTEXTS.plasma)[side];

  /* pH from a headcount, and the proton-motive force from both terms.
     `mV` is the inside relative to the outside, membrane.js's own sign, so
     pumping protons OUT makes it negative and the electrical term is −mV:
     positive pmf means protons want to come back in. */
  function protonState(counts, mV, ref) {
    const n = ref == null ? (counts.inside + counts.outside) / 2 : ref;
    const pH = {
      inside:  PH_REF - (counts.inside  - n) / PROTONS_PER_PH,
      outside: PH_REF - (counts.outside - n) / PROTONS_PER_PH,
    };
    const dpH = pH.inside - pH.outside;
    return { pH, dpH, dPsi: mV, pmf: -mV + MV_PER_PH * dpH };
  }

  /* THE SYNTHASE NEVER RUNS UPHILL. It is a turbine, not a pump: with the
     gradient gone the rotor stops on its own, which is the whole lesson in
     one picture. `slack` is the headcount difference below which the two
     sides count as equal, so a one-particle wobble is not a direction. */
  function synthaseDirection(counts, mV, opts = {}) {
    const slack = opts.slack == null ? 1 : opts.slack;
    const s = protonState(counts, mV, opts.ref);
    if (counts.outside - counts.inside <= slack && s.pmf <= 0) return 0;
    if (s.pmf <= 0) return 0;
    return -1;                    // outside → inside, the only way it turns
  }

  /* The rotor: protons in, angle and ATP out. One place, so the animation and
     the count cannot disagree. */
  function rotor() {
    let protons = 0, atp = 0, angle = 0;
    return {
      pass(n = 1) {
        protons += n;
        angle = (protons / PROTONS_PER_TURN) * Math.PI * 2;
        const made = Math.floor(protons * ATP_PER_TURN / PROTONS_PER_TURN) - atp;
        atp += made;
        return made;
      },
      reset() { protons = atp = angle = 0; },
      get protons() { return protons; },
      get atp() { return atp; },
      get angle() { return angle; },
    };
  }

  /* The complex pumps only while it is fed. `fuel` is 'NADH' (respiration),
     'light' (photosynthesis) or null; `fuelRate` 0..1 is the page's slider —
     an oxygen switch or a light dimmer — and it scales the turn rate, never
     the stoichiometry. */
  const FUELS = { NADH: 1, light: 1, FADH2: 0.6 };
  const complexRate = (fuel, fuelRate) =>
    !fuel || !FUELS[fuel] ? 0 : FUELS[fuel] * Math.max(0, Math.min(1, fuelRate == null ? 1 : fuelRate));

  const API = { PROTONS_PER_TURN, ATP_PER_TURN, PROTONS_PER_ATP, PROTONS_PER_PH, PH_REF, MV_PER_PH,
                CONTEXTS, sideName, protonState, synthaseDirection, rotor, FUELS, complexRate };
  global.Chemiosmosis = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
