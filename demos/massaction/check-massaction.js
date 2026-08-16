#!/usr/bin/env node
/* =====================================================================
 *  check-massaction.js — the physics behind massaction.js
 *
 *  WHY THIS EXISTS. The demo makes two claims a student is meant to take
 *  away, and both are properties of two numbers rather than of anything drawn:
 *
 *    1. A flat step settles EVEN, with both directions still running.
 *    2. A drop step runs essentially to completion, and the reverse is rare
 *       because it is steeply rarer to find a big energy — not because the
 *       enzyme refuses.
 *
 *  Neither is visible from the page. `ea` is tuned for legibility (it is the
 *  number that makes about half of arrivals react, which a demo needs and
 *  chemistry does not care about), so it is exactly the kind of constant
 *  somebody retunes — and retuning it far enough would stop the flat step
 *  settling at 1:1 while everything still looked fine. MolecularGeometry.md
 *  §1.4 rule 2 in its general form: a claim ships with the assertion that
 *  checks it.
 *
 *  HOW. massaction.js is a plain script that touches no DOM until create() is
 *  called, so this REQUIRES it and runs the real constants and the real curve
 *  builder. It never reimplements them: a checker holding its own copy of the
 *  numbers agrees with itself forever and with the page never.
 *
 *  The SCENARIOS are not the module's — a host page owns which reaction it
 *  runs — so the drop values are lifted out of glycolysis-lab.html's
 *  MASS_STEPS. That split is deliberate and this checker enforces both halves:
 *  a shared `ea` and per-page ΔE.
 *
 *  Run:  node massaction/check-massaction.js
 * ===================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

/* SEEDED, so the verdict is the same every run. This checker samples millions
 * of random energies and settles two populations, and with Math.random() the
 * equilibrium count is binomial — at a few hundred molecules that is a couple
 * of percent of scatter, which put a tolerance somebody would have to widen
 * until it stopped catching anything. A checker that fails one run in twenty
 * does not teach care, it teaches --no-verify. So the RNG is a fixed-seed
 * xorshift128 installed over Math.random for the duration: same numbers, same
 * answer, and a failure means the MODEL changed.
 *
 * Installed BEFORE massaction.js loads, because its sampleE closes over
 * Math.random at call time — but the ordering is the kind of thing that breaks
 * silently, so it stays at the top with this note. */
let _s0 = 0x9e3779b9, _s1 = 0x243f6a88, _s2 = 0xb7e15162, _s3 = 0xdeadbeef;
Math.random = function () {
  const t = _s1 << 9;
  _s2 ^= _s0; _s3 ^= _s1; _s1 ^= _s2; _s0 ^= _s3; _s2 ^= t;
  _s3 = (_s3 << 11) | (_s3 >>> 21);
  return ((_s0 + _s3) >>> 0) / 4294967296;
};

const HERE = __dirname;
const MODULE = path.join(HERE, 'massaction.js');
const PAGE = path.join(HERE, '..', 'glycolysis-lab.html');
const src = fs.readFileSync(MODULE, 'utf8');
const html = fs.readFileSync(PAGE, 'utf8');

const MA = require(MODULE);
const { sampleE, curveSVG, epx, EA_DEFAULT, CURVE_H } = MA;
const EA = EA_DEFAULT;

let fails = 0, checks = 0;
function ok(cond, what, detail) {
  checks++;
  if (cond) { console.log(`  ok    ${what}${detail ? '   ' + detail : ''}`); }
  else { fails++; console.log(`  FAIL  ${what}${detail ? '   ' + detail : ''}`); }
}

/* ---- the host page's scenarios ---------------------------------------- */
/* Lifted, not copied: the numbers this audits are glycolysis-lab.html's own
 * choice of reaction, and a second copy here would agree with itself forever. */
const mSteps = html.match(/const MASS_STEPS=\[[\s\S]*?\n\];/);
if (!mSteps) {
  console.error('FAIL: glycolysis-lab.html no longer has a MASS_STEPS list.');
  process.exit(1);
}
const STEPS_DEFAULT = new Function(mSteps[0] + '\n return MASS_STEPS;')();
const DROP = Object.fromEntries(STEPS_DEFAULT.map(s => [s.key, s.drop]));
const NAMES = Object.fromEntries(STEPS_DEFAULT.map(s => [s.key, s.species]));

console.log('mass-action model — massaction.js, driven by glycolysis-lab.html');
console.log(`  ea = ${EA} kT · flat ΔE = ${DROP.flat} · drop ΔE = ${DROP.drop.toFixed(4)} kT\n`);

ok(DROP.flat !== undefined && DROP.drop !== undefined,
   'the page still runs a flat scenario and a drop scenario');

/* ---- 1. the sampler is the distribution the lesson depends on ---------- */
/* Every claim below rests on energies being EXPONENTIAL — that is what makes
 * a taller barrier exponentially rarer to clear rather than proportionally
 * rarer, which is the one idea the drop scenario exists to land. A uniform
 * sampler would still "work" and would teach the opposite. */
const N = 2e6;
let sum = 0;
const tail = { 0.6: 0, 2: 0, 5.9: 0 };
for (let i = 0; i < N; i++) {
  const e = sampleE();
  sum += e;
  for (const x of Object.keys(tail)) if (e >= +x) tail[x]++;
}
ok(Math.abs(sum / N - 1) < 0.01, 'energies average one kT', `mean ${(sum / N).toFixed(4)}`);
for (const x of Object.keys(tail)) {
  const got = tail[x] / N, want = Math.exp(-x);
  ok(Math.abs(got - want) < Math.max(1e-4, want * 0.05),
     `P(E >= ${x}) is exp(-${x})`, `${got.toExponential(3)} vs ${want.toExponential(3)}`);
}

/* ---- 2. ea is legible, and SHARED ------------------------------------- */
const fwd = Math.exp(-EA);
ok(fwd > 0.40 && fwd < 0.70,
   'about half of arrivals react going forward',
   `${(fwd * 100).toFixed(1)}%`);

/* The catalyst rule, as a structural fact rather than a number: the reaction
 * test must add the scenario's drop to a barrier that is otherwise the SAME
 * both ways. An enzyme lowers the barrier in both directions at once, so a
 * model with two independent barriers could express a catalyst that shifts an
 * equilibrium — which no catalyst can do. This is the assertion the module's
 * comment claims, and it is the one the enzymes page's slider will lean on. */
ok(/p\.e\s*>=\s*ea\s*\+\s*\(p\.t\s*===\s*0\s*\?\s*0\s*:\s*drop\)/.test(src),
   'one ea for both directions, drop added only going back');
ok(!/EA_FWD|EA_BACK|EA_REV|eaFwd|eaBack/.test(src),
   'no second, direction-specific barrier has crept in');

/* And the host page does not quietly own a barrier of its own — `ea` is the
 * module's to define so the two pages cannot drift apart. */
ok(!/\bea\s*[:=]/.test(mSteps[0]),
   'glycolysis-lab does not set its own ea — it takes the module default');

/* ---- 3. the flat step is flat ----------------------------------------- */
ok(DROP.flat === 0, 'the flat step adds nothing to the reverse barrier');

/* ---- 4. the drop step's reverse is the documented 1-in-200 ------------- */
const ratio = Math.exp(-DROP.drop);
ok(Math.abs(1 / ratio - 200) < 1,
   'the drop step reverses about 1 encounter in 200',
   `1 in ${(1 / ratio).toFixed(1)}`);

/* ---- 5. where it actually lands, which is what a student sees ---------- */
/* A well-mixed run using ONLY the module's constants and sampler: N molecules,
 * each repeatedly meeting an enzyme, converting when it clears the barrier it
 * faces. No positions — this asks where the populations settle, not how they
 * move, and the module's own step() adds nothing to that question except the
 * collision frequency that mass action already accounts for. */
function settle(mode, n = 4000, rounds = 400000) {
  const drop = DROP[mode];
  let t = new Array(n).fill(0);          // everything starts as the substrate
  let back = 0;
  for (let r = 0; r < rounds; r++) {
    const i = (Math.random() * n) | 0;
    if (sampleE() >= EA + (t[i] === 0 ? 0 : drop)) {
      if (t[i] === 1) back++;
      t[i] = 1 - t[i];
    }
  }
  return { product: t.filter(x => x === 1).length / n, back };
}
const flat = settle('flat');
ok(Math.abs(flat.product - 0.5) < 0.03,
   'the flat step settles even',
   `${(flat.product * 100).toFixed(1)}% product`);
ok(flat.back > 10000,
   'and the reverse is still running there — the counter cannot read zero',
   `${flat.back} reverse conversions`);

const drop = settle('drop');
ok(drop.product > 0.97,
   'the drop step runs to completion',
   `${(drop.product * 100).toFixed(1)}% product`);
ok(drop.back < flat.back / 20,
   'with the reverse overwhelmed but NOT forbidden',
   `${drop.back} reverse vs ${flat.back} on the flat step`);

/* ---- 6. the number on screen is computed, not typed -------------------- */
/* CLAUDE.md: a number in user-facing text must read from the data at render
 * time. The curve prints ΔE, and a typed 5.3 would survive any retune of the
 * scenario and silently start lying. */
ok(/\+\$\{drop\.toFixed\(1\)\}\s*kT/.test(src),
   'the module computes the kT it prints from the scenario');
const shown = DROP.drop.toFixed(1);
ok(!new RegExp(`\\+${shown}\\s*kT`).test(html) && !new RegExp(`\\+${shown}\\s*kT`).test(src),
   `and nothing types "+${shown} kT" as a literal in the module or the page`);

/* ---- 7. the DRAWING agrees with the model ----------------------------- */
/* The reaction-coordinate curve makes geometric claims — the hump IS ea, the
 * climb back IS ea + drop, and the hump is the SAME height on every scenario
 * because the enzyme is the same. Those are exactly as breakable as the
 * numbers, and more tempting to break: somebody nudges a control point to make
 * the curve prettier and the picture quietly stops matching the physics it is
 * drawn from. curveSVG is pure and exported for exactly this — it is called
 * here, and the path it emits is measured. */
const maxDrop = Math.max(...Object.values(DROP));
const EPX = epx(EA, maxDrop);
ok(Math.abs(EPX * (EA + maxDrop) - CURVE_H) < 1e-9,
   'one scale for every scenario, fixed at the deepest span',
   `${EPX.toFixed(2)} px/kT`);

// M26,<sub> H68 C…,…,<peak> C…,…,<prod> H196
const RC = /M[\d.]+,([\d.]+) H[\d.]+ C[\d.-]+,[\d.-]+ [\d.-]+,[\d.-]+ [\d.-]+,([\d.-]+) C[\d.-]+,[\d.-]+ [\d.-]+,[\d.-]+ [\d.-]+,([\d.-]+) H/;
const measure = m => {
  const painted = curveSVG(EA, DROP[m], NAMES[m], maxDrop);
  const d = (painted.match(/class="rc" d="([^"]+)"/) || [])[1] || '';
  const g = d.replace(/\s+/g, ' ').match(RC);
  if (!g) return null;
  const [sub, peak, prod] = [+g[1], +g[2], +g[3]];
  return { sub, peak, prod,
           hump: sub - peak,          // y grows downward
           fall: prod - sub,
           climb: prod - peak,
           kT: (painted.match(/\+([\d.]+) kT/) || [])[1] };
};
const gF = measure('flat'), gD = measure('drop');
ok(!!(gF && gD), 'both scenarios draw a reaction coordinate');

if (gF && gD) {
  const near = (a, b, t = 0.02) => Math.abs(a - b) < t;
  ok(near(gF.hump, EA * EPX),
     'the flat hump is ea tall', `${gF.hump.toFixed(2)}px vs ${(EA*EPX).toFixed(2)}px`);
  ok(near(gD.hump, EA * EPX),
     'the drop hump is ea tall', `${gD.hump.toFixed(2)}px`);
  ok(near(gF.hump, gD.hump),
     'and the two humps are the SAME — one enzyme, one barrier');
  ok(near(gF.fall, 0),
     'the flat step ends where it started', `${gF.fall.toFixed(2)}px`);
  ok(near(gD.fall, DROP.drop * EPX),
     'the drop falls by its ΔE', `${gD.fall.toFixed(2)}px vs ${(DROP.drop*EPX).toFixed(2)}px`);
  ok(near(gD.climb, (EA + DROP.drop) * EPX),
     'and climbing back is ea + ΔE — the same peak, from lower down',
     `${gD.climb.toFixed(2)}px vs ${((EA+DROP.drop)*EPX).toFixed(2)}px`);
  ok(gD.kT === DROP.drop.toFixed(1),
     'the sentence prints the ΔE the curve draws', `+${gD.kT} kT`);
}

/* ---- 8. a LOWER barrier does not move the equilibrium ------------------ */
/* The enzymes page's entire interaction, asserted before that page exists —
 * because the moment `ea` becomes a slider, a model that got this wrong would
 * teach the single most common misconception about catalysts. Halve the
 * barrier: both directions speed up, the settled split does not move. */
const HALF = EA / 2;
function settleAt(ea, mode, n = 4000, rounds = 400000) {
  const d = DROP[mode];
  let t = new Array(n).fill(0), fwd = 0, back = 0;
  for (let r = 0; r < rounds; r++) {
    const i = (Math.random() * n) | 0;
    if (sampleE() >= ea + (t[i] === 0 ? 0 : d)) {
      if (t[i] === 1) back++; else fwd++;
      t[i] = 1 - t[i];
    }
  }
  return { product: t.filter(x => x === 1).length / n, fwd, back };
}
const slow = settleAt(EA, 'flat'), fast = settleAt(HALF, 'flat');
ok(Math.abs(fast.product - slow.product) < 0.03,
   'halving the barrier leaves the flat step settled where it was',
   `${(slow.product*100).toFixed(1)}% → ${(fast.product*100).toFixed(1)}%`);
ok(fast.fwd + fast.back > (slow.fwd + slow.back) * 1.2,
   'while BOTH directions get busier — a catalyst speeds, it does not shift',
   `${slow.fwd + slow.back} → ${fast.fwd + fast.back} conversions`);
// And the drawing has to follow the slider, or the picture stops being the model.
const lowHump = (() => {
  const d = (curveSVG(HALF, DROP.drop, NAMES.drop, maxDrop)
              .match(/class="rc" d="([^"]+)"/) || [])[1] || '';
  const g = d.replace(/\s+/g, ' ').match(RC);
  return g ? +g[1] - +g[2] : NaN;
})();
ok(Math.abs(lowHump - HALF * epx(HALF, maxDrop)) < 0.02,
   'and the drawn hump shrinks with it', `${lowHump.toFixed(2)}px`);

/* ---- 9. the demo opens wearing the step it was opened from ------------- */
/* THE CORRELATION IS THE FEATURE, and it is invisible from either side alone.
 * The verdict on the stage reads off `rev`; the tab that opens reads off `rev`;
 * nothing makes them the same reading except that both were written that way.
 * Land on the flat tab under an "Irreversible in the cell" heading and the page
 * contradicts itself in two places the student sees at once.
 *
 * So: run the page's own massScenarios() over the page's own STEPS, and check
 * every step gets the tab its verdict promises, carrying its own molecules. */
const mStepsData = html.match(/const STEPS=\[[\s\S]*?\n\];/);
const mSpeciesAt = html.match(/const speciesAt=[^\n]+;/);
const mGen = html.match(/function massScenarios\(st\)\{[\s\S]*?\n\}/);
ok(!!(mStepsData && mSpeciesAt && mGen),
   'the page still has STEPS, speciesAt and massScenarios to run');

if (mStepsData && mSpeciesAt && mGen) {
  const M = require('../lib-node.js').MOLECULES;
  const { STEPS, speciesAt, massScenarios } = new Function('M', 'MASS_STEPS',
    mStepsData[0] + mSpeciesAt[0] + mGen[0] +
    '\n return { STEPS, speciesAt, massScenarios };'
  )(M, STEPS_DEFAULT);

  let wrongTab = 0, notMine = 0, unnamed = 0, fellBack = [];
  for (const st of STEPS) {
    const mine = st.rev === false ? 'drop' : 'flat';
    const list = massScenarios(st);
    const sc = list.find(s => s.key === mine);
    // The default pair is returned verbatim when a step cannot be drawn as
    // A ⇄ B; that is a legitimate outcome, not a failure — but it must be the
    // WHOLE list, so nobody gets half-tailored copy.
    if (list.every((s, k) => s === STEPS_DEFAULT[k])) { fellBack.push(st.n); continue; }
    if (!sc) { wrongTab++; continue; }
    // the tailored one is this step's, and the other is untouched
    if (sc === STEPS_DEFAULT.find(s => s.key === mine)) notMine++;
    const sub = (m => m.short || m.name)(M[speciesAt(STEPS.indexOf(st))[0]]);
    const prd = (m => m.short || m.name)(M[st.species[0]]);
    if (sc.species[0] !== sub || sc.species[1] !== prd) wrongTab++;
    // the prose has to name the step, or "matching copy" is decoration
    if (!sc.text.includes(`Step ${st.n}`) || !sc.title.includes(`step ${st.n}`)) unnamed++;
  }
  ok(wrongTab === 0, 'every step tailors the tab its own verdict names',
     `${STEPS.length - fellBack.length} steps tailored, ${fellBack.length} fall back (${fellBack.join(', ')})`);
  ok(notMine === 0, 'and none of them silently kept the canonical example');
  ok(unnamed === 0, 'the copy names the step it was opened from');
  // A step that splits or merges lanes CANNOT be drawn as A ⇄ B — the counters
  // would assert a stoichiometry the model does not have. Aldolase is the one.
  ok(fellBack.length > 0 && fellBack.every(n => {
       const st = STEPS.find(s => s.n === n);
       return st.species.length !== speciesAt(STEPS.indexOf(st)).length;
     }),
     'the fallbacks are exactly the steps that change the lane count');

  // And the door has to hand the step over, or none of the above is reachable.
  ok(/Mass\.show\(i===''\?null:STEPS\[\+i\]\)/.test(html),
     'the link passes its step to Mass.show');
  ok(/sim\.setScenario\(st\s*&&\s*st\.rev===false\s*\?\s*'drop'\s*:\s*'flat'\)/.test(html),
     'and Mass.show opens the tab that step\'s rev flag names');
}

console.log('');
if (fails) {
  console.log(`FAIL: ${fails} of ${checks} checks failed.`);
  process.exit(1);
}
console.log(`PASS: ${checks} checks — the mass-action demo teaches what it claims.`);
