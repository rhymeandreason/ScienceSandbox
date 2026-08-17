/* =============================================================================
 *  membrane/pump.js — the Post-Albers cycle as a function of time.
 * =============================================================================
 *  NO THREE, NO DOM, NO GEOMETRY. This is the pump's BEHAVIOUR: given a time,
 *  what are the gates doing, where is each ion, and has the phosphate moved.
 *  parts.js turns that into a shape and the page turns it into a picture;
 *  neither of them decides anything about the mechanism.
 *
 *  The split is not tidiness. Because this file is pure arithmetic it runs in
 *  node, which means the one claim the whole lesson rests on — that the pump
 *  is NEVER open at both ends — is checkable by a machine instead of by me
 *  looking at a screenshot. check-pump.js does exactly that, over the whole
 *  cycle at fine resolution. parts.js cannot be checked that way because it
 *  reaches for THREE at module scope, and that is a real difference in how
 *  much the two files can be trusted.
 *
 * -----------------------------------------------------------------------------
 *  THE CYCLE, AND WHAT IS SIMPLIFIED
 * -----------------------------------------------------------------------------
 *  Eight phases, in a loop:
 *
 *    1 load-Na       inward-open. Three Na+ come in from the cytoplasm.
 *    2 occlude-Na    ATP's terminal phosphate moves ONTO the pump. Gates shut.
 *    3 open-out      outward-open, carrying the phosphate.
 *    4 release-Na    three Na+ leave, to the outside.
 *    5 load-K        two K+ come in from the outside.
 *    6 occlude-K     the phosphate leaves. Gates shut.
 *    7 open-in       inward-open again.
 *    8 release-K     two K+ leave, into the cytoplasm.
 *
 *  THE STOICHIOMETRY IS REAL: 3 Na+ out, 2 K+ in, 1 ATP. Three charges out
 *  against two in is why the pump is electrogenic and why the cell interior
 *  sits negative — a fact this lesson will want later and must not contradict
 *  now, so the counts are not roundable.
 *
 *  WHAT IS COMPRESSED. The real cycle distinguishes E1P from E2P and has ADP
 *  leave between them; here phosphorylation and the conformational change are
 *  one beat, because "the phosphate arrives and the pump turns inside out" is
 *  the causal story and the intermediate is not a Bio 101 fact. The 2022
 *  structures we baked (7E1Z, 7E20) are the two ENDS of this and there is no
 *  E2P among them, so nothing here is claiming structural support for the
 *  middle — see bake-pump.js's note on the same gap.
 *
 *  WHAT IS NOT COMPRESSED, because it is the point:
 *
 *    · GATES NEVER BOTH OPEN. Every transition between an open state and its
 *      opposite passes through a shut one. This is enforced by the phase table
 *      having occlusion phases at all, and asserted by selfTest().
 *    · THE ION IS COMMITTED BEFORE THE PUMP TURNS. Loading finishes before
 *      occlusion starts, so the student never sees an ion drift in while the
 *      far side is open — which would be a leak, and would silently teach that
 *      the pump is a hole with a preference.
 *
 * -----------------------------------------------------------------------------
 *  COORDINATES
 * -----------------------------------------------------------------------------
 *  Ion position is `u`, normalised: -1 at the cytoplasmic mouth, 0 at the
 *  binding site, +1 at the outer mouth. The page multiplies by the
 *  transporter's half-height. Nothing here knows an angstrom, which is why
 *  changing the protein's size cannot break the choreography.
 *
 *  Loaded plain; exposes window.Pump, and module.exports for the checker.
 * ========================================================================== */
(function (global) {
  'use strict';

  const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
  const smooth = t => { t = clamp01(t); return t * t * (3 - 2 * t); };
  const mix = (a, b, t) => a + (b - a) * t;

  /* Phase table. `w` is relative duration — the loop is normalised by their
     sum, so retiming one beat cannot silently shorten another. */
  const PHASES = [
    { id:'load-na',    w:1.4, label:'3 Na⁺ bind',
      caption:'Inward-open. Three sodium ions load from inside the cell.' },
    { id:'occlude-na', w:1.0, label:'ATP → phosphate on the pump',
      caption:'ATP hands its end phosphate to the pump. Both gates shut: the ' +
              'sodium is committed, and nothing can slip back.' },
    { id:'open-out',   w:0.9, label:'turns outward',
      caption:'Carrying the phosphate, the pump opens the other way.' },
    { id:'release-na', w:1.1, label:'3 Na⁺ leave',
      caption:'The site no longer holds sodium tightly. Three Na⁺ go out.' },
    { id:'load-k',     w:1.1, label:'2 K⁺ bind',
      caption:'The same site, reshaped, now prefers the bigger ion. Two K⁺ load.' },
    { id:'occlude-k',  w:1.0, label:'phosphate leaves',
      caption:'The phosphate comes off. Both gates shut again.' },
    { id:'open-in',    w:0.9, label:'turns inward',
      caption:'The pump returns to facing the cytoplasm.' },
    { id:'release-k',  w:1.1, label:'2 K⁺ enter the cell',
      caption:'Two potassium ions are released inside. One ATP spent: ' +
              'three charges out, two in.' },
  ];

  const TOTAL = PHASES.reduce((s, p) => s + p.w, 0);

  /* Cumulative bounds, so at() can locate a time without scanning. */
  const BOUNDS = (() => {
    const b = []; let acc = 0;
    for (const p of PHASES) { b.push([acc / TOTAL, (acc + p.w) / TOTAL, p]); acc += p.w; }
    return b;
  })();

  function locate(t) {
    const p = ((t % 1) + 1) % 1;
    for (const [lo, hi, ph] of BOUNDS)
      if (p >= lo && p < hi) return { phase: ph, k: (p - lo) / (hi - lo), p };
    const last = BOUNDS[BOUNDS.length - 1];
    return { phase: last[2], k: 1, p };
  }

  /* Gate values per phase. Written as explicit endpoints rather than derived,
     because the ONE invariant worth protecting is easier to read than to
     infer: no row here has both gates open, and no row interpolates between
     two open states. */
  function gatesOf(id, k) {
    switch (id) {
      case 'load-na':    return { top:0, bottom:1 };
      case 'occlude-na': return { top:0, bottom:1 - smooth(k) };
      case 'open-out':   return { top:smooth(k), bottom:0 };
      case 'release-na': return { top:1, bottom:0 };
      case 'load-k':     return { top:1, bottom:0 };
      case 'occlude-k':  return { top:1 - smooth(k), bottom:0 };
      case 'open-in':    return { top:0, bottom:smooth(k) };
      case 'release-k':  return { top:0, bottom:1 };
    }
    throw new Error('pump: unknown phase ' + id);
  }

  /* Where the ions are. Each returns a list of { species, u, alpha }.
     `alpha` is how present the ion is — ions fade in at a mouth rather than
     appearing, because an ion that pops into existence at the pump's lip
     reads as being MADE there. */
  function cargoOf(id, k) {
    const out = [];
    const NA = 3, K = 2;
    /* Ions are spread slightly around the site so three of them are three
       objects rather than one lump. Purely cosmetic, and the spread is in
       `u` so it stays proportional if the protein resizes. */
    const spread = i => (i - 1) * 0.06;

    const na = (u, a) => { for (let i = 0; i < NA; i++) out.push({ species:'NA', u:u + spread(i), alpha:a }); };
    const k2 = (u, a) => { for (let i = 0; i < K;  i++) out.push({ species:'K',  u:u + (i - .5) * 0.09, alpha:a }); };

    switch (id) {
      /* Loading: in from the mouth to the site, fading up over the first
         third so they arrive rather than materialise. */
      case 'load-na':    na(mix(-1, 0, smooth(k)), clamp01(k * 3)); break;
      case 'occlude-na': na(0, 1); break;
      case 'open-out':   na(0, 1); break;
      case 'release-na': na(mix(0, 1, smooth(k)), clamp01((1 - k) * 2.2)); break;
      case 'load-k':     k2(mix(1, 0, smooth(k)), clamp01(k * 3)); break;
      case 'occlude-k':  k2(0, 1); break;
      case 'open-in':    k2(0, 1); break;
      case 'release-k':  k2(mix(0, -1, smooth(k)), clamp01((1 - k) * 2.2)); break;
    }
    return out;
  }

  /* The phosphate. `transfer` runs 0→1 across occlude-na (ATP → pump) and
     1→0 across occlude-k (pump → Pi, released). `on` is whether the pump is
     carrying it, which is what makes the outward-facing half of the cycle
     the PHOSPHORYLATED half — the causal link the lesson is making. */
  function phosphoOf(id, k) {
    switch (id) {
      case 'load-na':    return { transfer:0, on:false, atp:'charged' };
      case 'occlude-na': return { transfer:smooth(k), on:smooth(k) > .5, atp:smooth(k) > .5 ? 'discharged' : 'charged' };
      case 'open-out':
      case 'release-na':
      case 'load-k':     return { transfer:1, on:true, atp:'discharged' };
      case 'occlude-k':  return { transfer:1 - smooth(k), on:smooth(k) < .5, atp:'discharged' };
      case 'open-in':
      case 'release-k':  return { transfer:0, on:false, atp:'discharged' };
    }
    throw new Error('pump: unknown phase ' + id);
  }

  /* at(t) — t counts CYCLES, not seconds. A page divides by whatever period
     it wants, which is also how a scrubber and an autoplay share one path. */
  function at(t) {
    const { phase, k, p } = locate(t);
    return {
      t: p, phase: phase.id, label: phase.label, caption: phase.caption,
      gates: gatesOf(phase.id, k),
      cargo: cargoOf(phase.id, k),
      phosphate: phosphoOf(phase.id, k),
      /* Whole ATP spent per completed cycle — the ledger the lesson closes
         on, and the number that connects this page to glycolysis. */
      atpPerCycle: 1, naPerCycle: 3, kPerCycle: 2,
    };
  }

  /* selfTest() — the invariant, checked rather than asserted in prose.
     Returns { ok, failures }. check-pump.js runs it; so can a page. */
  function selfTest(steps) {
    const N = steps || 4000, failures = [];
    const OPEN = 0.15;          // anything above this counts as a way through

    for (let i = 0; i < N; i++) {
      const t = i / N, s = at(t);
      const { top, bottom } = s.gates;

      if (top > OPEN && bottom > OPEN)
        failures.push(`t=${t.toFixed(4)} (${s.phase}): BOTH gates open — ` +
                      `top ${top.toFixed(2)}, bottom ${bottom.toFixed(2)}. ` +
                      `That is a leak, not a pump.`);

      /* An ion must never be past a shut gate. `u` beyond ±1 is outside the
         protein entirely, which is fine; between the site and a CLOSED mouth
         is not — it would be an ion inside solid protein. */
      for (const c of s.cargo) {
        if (c.alpha < .02) continue;
        if (c.u > 0.25 && top <= OPEN)
          failures.push(`t=${t.toFixed(4)} (${s.phase}): ${c.species} at u=${c.u.toFixed(2)} ` +
                        `with the outer gate shut (${top.toFixed(2)}).`);
        if (c.u < -0.25 && bottom <= OPEN)
          failures.push(`t=${t.toFixed(4)} (${s.phase}): ${c.species} at u=${c.u.toFixed(2)} ` +
                        `with the inner gate shut (${bottom.toFixed(2)}).`);
      }
    }

    /* Continuity across the loop seam and every phase boundary: a jump in a
       gate value is a pop on screen, and at a boundary it is easy to write
       and impossible to see in a still. */
    for (let i = 0; i <= PHASES.length; i++) {
      const t = (BOUNDS[i % PHASES.length] || BOUNDS[0])[0];
      const a = at(t - 1e-6).gates, b = at(t + 1e-6).gates;
      if (Math.abs(a.top - b.top) > .02 || Math.abs(a.bottom - b.bottom) > .02)
        failures.push(`phase boundary at t=${t.toFixed(4)}: gates jump ` +
                      `(${a.top.toFixed(2)},${a.bottom.toFixed(2)}) -> ` +
                      `(${b.top.toFixed(2)},${b.bottom.toFixed(2)}).`);
    }

    return { ok: failures.length === 0, failures, steps: N };
  }

  global.Pump = { at, selfTest, PHASES, TOTAL };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.Pump;
})(typeof window !== 'undefined' ? window : globalThis);
