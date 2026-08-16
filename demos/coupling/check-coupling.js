#!/usr/bin/env node
/* =====================================================================
 *  check-coupling.js — the arithmetic behind coupling.js
 *
 *  WHY THIS EXISTS. This module's whole subject is a sum, and a sum is the
 *  easiest thing in the world to draw wrong while every number on screen is
 *  right. Three claims, none visible from the page:
 *
 *    1. ΔG ADDS, and the SIGN of the total is the verdict — not the size of
 *       either half, not which is bigger.
 *    2. NO SHARED INTERMEDIATE, NO COUPLING. With nothing transferred the two
 *       reactions are independent and the uphill one is decided by its own
 *       sign alone. This is the claim the module exists for and the one a
 *       "helpful" refactor would quietly optimise away, because on the
 *       standard scenarios it changes only a label.
 *    3. THE PICTURE IS THE ADDITION. The coupled arrow has to be exactly as
 *       long as the other two differ, at one shared scale. An arrow scaled to
 *       its own lane would draw +13.8 and −30.5 the same length and say they
 *       cancel.
 *
 *  AND THE EXTERNAL CHECK, which is worth more than the other three: the ΔG°′
 *  values are published numbers, so they are audited against the textbook
 *  ones. A module that adds correctly and starts from a wrong −7.3 teaches a
 *  wrong answer confidently.
 *
 *  Run:  node coupling/check-coupling.js
 * ===================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const HERE = __dirname;
const src = fs.readFileSync(path.join(HERE, 'coupling.js'), 'utf8');
const bench = fs.readFileSync(path.join(HERE, 'coupling-test.html'), 'utf8');
const C = require(path.join(HERE, 'coupling.js'));
const { verdict, ladderSVG, levelsOf, pxPerKJ, RUNS, PLOT } = C;

let fails = 0, checks = 0;
function ok(cond, what, detail) {
  checks++;
  if (cond) { console.log(`  ok    ${what}${detail ? '   ' + detail : ''}`); }
  else { fails++; console.log(`  FAIL  ${what}${detail ? '   ' + detail : ''}`); }
}

console.log('coupling model — coupling.js\n');

/* ---- 1. ΔG adds, and the sign is the verdict -------------------------- */
{
  const v = verdict(13.8, -30.5, true);
  ok(Math.abs(v.total + 16.7) < 1e-9, 'the two ΔG add', `${v.total} kJ/mol`);
  ok(v.runs === true, 'and a negative total runs');
  ok(verdict(40, -30.5, true).runs === false,
     'an uphill reaction too big for ATP does NOT run',
     `${verdict(40, -30.5, true).total} kJ/mol`);
  // The threshold is exactly zero, and it is one rule rather than three
  // copies — the verdict, the colouring and the label all read RUNS().
  ok(RUNS(-0.01) && !RUNS(0) && !RUNS(0.01),
     'spontaneity is strictly ΔG < 0, and zero does not run');
  ok(verdict(30.5, -30.5, true).runs === false,
     'exactly break-even does not run either');
  // Order cannot matter: addition is commutative and so is the model.
  ok(verdict(13.8, -30.5, true).total === verdict(-30.5, 13.8, true).total,
     'which reaction is called "up" changes nothing');
}

/* ---- 2. no shared intermediate, no coupling --------------------------- */
/* THE CLAIM THE MODULE IS FOR. On every scenario the bench ships, unticking
 * the box changes the verdict — so if this ever silently stopped gating, the
 * page would still look right on the numbers and would be teaching that
 * energy leaks between neighbouring reactions. */
{
  ok(verdict(13.8, -30.5, false).total === 13.8,
     'with nothing shared, the downhill reaction contributes NOTHING');
  ok(verdict(13.8, -30.5, false).runs === false,
     'so the uphill reaction still does not run, however much is released beside it');
  ok(verdict(13.8, -30.5, false).coupled === false
     && verdict(13.8, -30.5, true).coupled === true,
     'and the model says which case it is, rather than leaving it implied');
  // A downhill reaction needs no help and must not appear to lose any.
  ok(verdict(-61.9, 30.5, false).runs === true,
     'an already-downhill reaction runs with or without a partner');
  // Structural: the gate is a real branch, not a label.
  ok(/shared\s*\?\s*dgUp\s*\+\s*dgDown\s*:\s*dgUp/.test(src),
     'the sum itself is gated on `shared` — not just the caption');
}

/* ---- 3. the published numbers ----------------------------------------- */
/* Standard ΔG°′, 1 M / pH 7 / 25 °C (Lehninger, Principles of Biochemistry,
 * table 13-6). Lifted from the BENCH, because the numbers belong to the host
 * page — the module only adds them up, and a copy of them here would agree
 * with itself forever. */
{
  // Matched on the bench's own identifiers rather than on the labels: a
  // label is prose containing →, + and parentheses, and building a regex out
  // of one is how three of these came back NaN and passed as "0 difference"
  // would have. An identifier is a token.
  const num = re => { const m = bench.match(re); return m ? +m[1] : NaN; };
  const atp = num(/ATP_HYD\s*=\s*\{[\s\S]*?dg:\s*([+-]?[\d.]+)/);
  const glc = num(/up:\s*\{\s*label:'glucose[\s\S]*?dg:\s*([+-]?[\d.]+)/);
  const pep = num(/label:'PEP[\s\S]*?dg:\s*([+-]?[\d.]+)/);
  ok(Number.isFinite(atp) && Number.isFinite(glc) && Number.isFinite(pep),
     'all three ΔG lift cleanly from the bench',
     `${atp} / ${glc} / ${pep}`);
  console.log(`  ---- ΔG°′ lifted from the bench ----`);
  console.log(`        ATP hydrolysis ${atp}   glucose+Pi ${glc}   PEP→pyruvate ${pep} kJ/mol`);
  ok(Math.abs(atp + 30.5) < 0.6, 'ATP hydrolysis is the published −30.5 kJ/mol', `${atp}`);
  ok(Math.abs(glc - 13.8) < 0.6, 'phosphorylating glucose is the published +13.8', `${glc}`);
  ok(Math.abs(pep + 61.9) < 0.6, 'PEP → pyruvate is the published −61.9', `${pep}`);
  // And the two worked examples come out at the textbook totals.
  ok(Math.abs(verdict(glc, atp, true).total + 16.7) < 0.6,
     'hexokinase totals the textbook −16.7 kJ/mol', `${verdict(glc, atp, true).total}`);
  ok(Math.abs(verdict(-atp, pep, true).total + 31.4) < 0.6,
     'pyruvate kinase totals the textbook −31.4 kJ/mol', `${verdict(-atp, pep, true).total}`);
  // Making ATP must cost exactly what hydrolysing it releases, or the module
  // is quietly claiming a free lunch somewhere.
  ok(/dg:\+30\.5/.test(bench.replace(/\s/g, '')),
     'making ATP costs exactly what hydrolysing it releases');
}

/* ---- 4. the drawing IS the addition ----------------------------------- */
/* ladderSVG makes a geometric claim, and it is the module's whole reason to be
 * a picture: the coupled lane is not a third arrow, it is the uphill segment
 * with the downhill one continuing from its TIP, so where the pair finishes is
 * the total. Two versions of this were wrong in ways every number survived —
 * all three drawn from a common baseline (the figure stopped adding), and the
 * sign inverted (uphill drawn downward, every LENGTH still correct). Both are
 * pinned below, which is why the direction and the levels are checked and not
 * just the lengths. */
{
  const steps = [ { label:'up', dg:13.8, cls:'up' },
                  { label:'down', dg:-30.5, cls:'down' },
                  { label:'coupled', dg:-16.7, cls:'net', stack:[13.8, -30.5] } ];
  const { lo, hi } = levelsOf(steps);
  ok(lo === -30.5 && hi === 13.8,
     'the axis is fitted to every level the figure will draw',
     `${lo} … ${hi} kJ/mol`);
  const k = pxPerKJ(hi - lo);
  const y = v => PLOT.bot - (v - lo) * k;
  const svg = ladderSVG(steps);
  const SHAFT = /class="cp-shaft[^"]*" d="M[\d.]+,([\d.-]+) L[\d.]+,([\d.-]+)"/g;
  const sh = [...svg.matchAll(SHAFT)]
    .map(m => ({ from:+m[1], to:+m[2], len: Math.abs(+m[2] - +m[1]) }));
  ok(sh.length === 4, 'four segments: two lone arrows and the stacked pair', `${sh.length}`);

  // LENGTHS, at one shared scale.
  ok(Math.abs(sh[0].len - 13.8 * k) < 0.01 && Math.abs(sh[1].len - 30.5 * k) < 0.01,
     'each lone arrow is |ΔG| long at the shared scale',
     `${sh[0].len.toFixed(1)}px ${sh[1].len.toFixed(1)}px`);

  // DIRECTION. y grows downward, so a positive ΔG must DECREASE y. This is the
  // check that caught the inverted build; a length test cannot.
  ok(sh[0].to < sh[0].from, 'the uphill arrow climbs');
  ok(sh[1].to > sh[1].from, 'the downhill arrow falls');

  // LEVELS. Both lone arrows leave zero; the stack's second segment leaves the
  // first one's tip, and the pair finishes exactly at the total.
  ok(Math.abs(sh[0].from - y(0)) < 0.01 && Math.abs(sh[1].from - y(0)) < 0.01,
     'both lone arrows start from the zero line');
  ok(Math.abs(sh[2].to - sh[3].from) < 1e-9,
     'the downhill segment starts where the uphill one ended, not at zero');
  ok(Math.abs(sh[3].to - y(-16.7)) < 0.02,
     'and the pair finishes at the total — the picture IS the sum',
     `${sh[3].to.toFixed(1)} vs ${y(-16.7).toFixed(1)}`);
  ok(sh[3].to > y(0),
     'a negative total finishes BELOW zero, where a spontaneous reaction belongs');

  // Everything stays inside the box, which the first refit did not.
  ok(sh.every(s => Math.min(s.from, s.to) >= PLOT.top - 0.01
                && Math.max(s.from, s.to) <= PLOT.bot + 0.01),
     'nothing is drawn outside the plot',
     `${Math.min(...sh.map(s=>Math.min(s.from,s.to))).toFixed(0)}…`
     + `${Math.max(...sh.map(s=>Math.max(s.from,s.to))).toFixed(0)}`);

  // With no shared intermediate there is no stack, and the lane must redraw
  // the uphill reaction unchanged rather than a total that does not apply.
  const solo = ladderSVG([steps[0], steps[1], { label:'no link', dg:13.8, cls:'net' }]);
  const ss = [...solo.matchAll(SHAFT)].map(m => Math.abs(+m[2] - +m[1]));
  ok(ss.length === 3 && Math.abs(ss[2] - ss[0]) < 0.01,
     'unlinked, the third lane is the uphill reaction again and nothing else');
}

/* ---- 4b. the slider can hold the number the page cites ----------------- */
/* Found in the browser: the hexokinase scenario opens at its published
 * +13.8 kJ/mol, the slider's step was 0.5, and the input rounded it to +14.0
 * — so the figure and the sum both showed a value the citation underneath
 * them contradicted. CLAUDE.md's rule is that a number in user-facing text is
 * read from the data; this is the same rule one layer down, where the WIDGET
 * has to be able to represent what the data says. */
{
  const step = +(src.match(/step="([\d.]+)"/) || [])[1];
  const start = +(bench.match(/up:\s*\{\s*label:'glucose[\s\S]*?dg:\s*([+-]?[\d.]+)/) || [])[1];
  const min = +(bench.match(/range:\s*\[\s*(-?[\d.]+)/) || [])[1];
  ok(Number.isFinite(step) && Number.isFinite(start) && Number.isFinite(min),
     'the slider step and the scenario start both lift', `step ${step}, start ${start}, min ${min}`);
  const k = (start - min) / step;
  ok(Math.abs(k - Math.round(k)) < 1e-9,
     'the published ΔG lands exactly on a slider stop — the page cannot open on a rounded number',
     `(${start} − ${min}) / ${step} = ${k}`);
}

/* ---- 5. the module claims nothing about SPEED -------------------------- */
/* ΔG says whether, never how fast. That distinction is massaction.js's whole
 * subject, and the fastest way to undo it here is a caption calling a
 * favourable reaction "fast" or an unfavourable one "slow". Asserted because
 * it is a prose failure nothing else in this repo can catch. */
{
  const prose = (src + bench).replace(/^\s*\*.*$/gm, '');
  ok(!/\b(fast|faster|quick|slow|slower|rate of)\b/i.test(
       prose.replace(/massaction[^\n]*/g, '')),
     'nothing here calls a favourable reaction fast — ΔG is whether, not how fast');
  ok(/does not run|runs/.test(src),
     'the verdict is phrased as runs / does not run');
}

console.log('');
if (fails) {
  console.log(`FAIL: ${fails} of ${checks} checks failed.`);
  process.exit(1);
}
console.log(`PASS: ${checks} checks — the coupling model teaches what it claims.`);
