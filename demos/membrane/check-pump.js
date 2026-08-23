#!/usr/bin/env node
/* =====================================================================
 *  check-pump.js — the pump is never open at both ends.
 *
 *  That sentence is the lesson's central claim, it is what makes a pump
 *  different from a hole, and until this file existed the only thing
 *  checking it was me looking at screenshots. pump.js is deliberately
 *  free of THREE so this can run offline with no dependencies.
 *
 *  Run:  node membrane/check-pump.js
 * ===================================================================== */
'use strict';

const Pump = require('./pump.js');

let bad = 0;
const fail = m => { console.error('  FAIL  ' + m); bad++; };
// PRINTS, and only prints. Most checkers in this repo spell `ok` the other way
// round — ok(cond, what) — so a check written that way here would hand a
// CONDITION to a message parameter and pass forever while asserting nothing.
// Refuse the second argument rather than swallow it; use `is` below.
const ok   = (m, ...extra) => { if(extra.length) throw new Error(
  'ok() takes a message, not a condition — use is(cond, msg)'); console.log('  ok    ' + m); };
const is   = (cond, m) => cond ? ok(m) : fail(m);

/* ---- 1. the invariant, over the whole cycle ---- */
console.log('== 1. gates, cargo and continuity over the cycle');
const r = Pump.selfTest(4000);
if (r.ok) ok(`${r.steps} samples: gates never both open, no ion past a shut gate, no jumps`);
else {
  /* Print a few rather than four thousand — the first failures are the
     informative ones and the rest are the same frame repeated. */
  r.failures.slice(0, 8).forEach(fail);
  if (r.failures.length > 8) console.error(`  ... and ${r.failures.length - 8} more`);
  bad++;
}

/* ---- 2. every phase is reachable and named ---- */
console.log('\n== 2. phases');
const seen = new Set();
for (let i = 0; i < 2000; i++) seen.add(Pump.at(i / 2000).phase);
for (const p of Pump.PHASES) {
  if (!seen.has(p.id)) fail(`phase ${p.id} is never reached — its weight is ${p.w}`);
}
if (seen.size === Pump.PHASES.length)
  ok(`${Pump.PHASES.length} phases, all reachable`);
if (seen.size > Pump.PHASES.length)
  fail(`at() returned ${seen.size} distinct phases for ${Pump.PHASES.length} defined`);

/* ---- 3. the stoichiometry, counted rather than declared ----
   3 Na out and 2 K in is why the pump is electrogenic. A caption saying
   so while the animation moves two sodiums would be a page contradicting
   itself, so the counts come from the cargo lists. */
console.log('\n== 3. stoichiometry');
function peakCount(species, phase) {
  let best = 0;
  for (let i = 0; i < 2000; i++) {
    const s = Pump.at(i / 2000);
    if (s.phase !== phase) continue;
    best = Math.max(best, s.cargo.filter(c => c.species === species && c.alpha > .5).length);
  }
  return best;
}
const na = peakCount('NA', 'occlude-na'), k = peakCount('K', 'occlude-k');
if (na === 3) ok('3 Na⁺ carried outward'); else fail(`expected 3 Na⁺ occluded, saw ${na}`);
if (k === 2)  ok('2 K⁺ carried inward');   else fail(`expected 2 K⁺ occluded, saw ${k}`);

const s0 = Pump.at(0);
if (s0.atpPerCycle === 1) ok('1 ATP per cycle');
else fail(`atpPerCycle is ${s0.atpPerCycle}`);
if (s0.naPerCycle === na && s0.kPerCycle === k)
  ok('the declared ledger matches what the animation moves');
else fail(`ledger says ${s0.naPerCycle} Na / ${s0.kPerCycle} K, animation moves ${na} / ${k}`);

/* ---- 4. the phosphate is on for exactly the outward-facing half ----
   The causal claim: phosphorylation is what turns the pump outward. If
   the pump were ever outward-open WITHOUT the phosphate, the animation
   would be showing the conformational change happening for free. */
console.log('\n== 4. phosphate and conformation');
let outwardWithout = 0, inwardWith = 0;
for (let i = 0; i < 4000; i++) {
  const s = Pump.at(i / 4000);
  if (s.gates.top > .8 && !s.phosphate.on) outwardWithout++;
  if (s.gates.bottom > .8 && s.phosphate.on) inwardWith++;
}
if (!outwardWithout) ok('never outward-open without the phosphate');
else fail(`${outwardWithout} samples outward-open with no phosphate on the pump`);
if (!inwardWith) ok('never inward-open while carrying it');
else fail(`${inwardWith} samples inward-open while phosphorylated`);

console.log(bad ? `\nFAIL: ${bad} problem(s)` : '\nPASS: the pump is a pump');
process.exit(bad ? 1 : 0);
