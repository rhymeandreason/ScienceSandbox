#!/usr/bin/env node
/* =====================================================================
 *  check-massaction.js — the physics behind glycolysis-lab's mass-action modal
 *
 *  WHY THIS EXISTS. The modal makes two claims a student is meant to take
 *  away, and both are properties of two numbers rather than of anything drawn:
 *
 *    1. A flat step settles EVEN, with both directions still running.
 *    2. A drop step runs essentially to completion, and the reverse is rare
 *       because it is steeply rarer to find a big energy — not because the
 *       enzyme refuses.
 *
 *  Neither is visible from the page. `EA` is tuned for legibility (it is the
 *  number that makes about half of arrivals react, which a demo needs and
 *  chemistry does not care about), so it is exactly the kind of constant
 *  somebody retunes — and retuning it far enough would stop the flat step
 *  settling at 1:1 while everything still looked fine. MolecularGeometry.md
 *  §1.4 rule 2 in its general form: a claim ships with the assertion that
 *  checks it.
 *
 *  HOW. The model lives inside glycolysis-lab.html as page-local JS, so this
 *  lifts the constants and the sampler out of the file and runs them — the same
 *  trick hemoglobin/tools/check-hb.js uses on that page's flat-chain generator.
 *  It never reimplements them: a checker holding its own copy of the numbers
 *  agrees with itself forever and with the page never.
 *
 *  Run:  node tools/check-massaction.js
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
 * answer, and a failure means the MODEL changed. */
let _s0 = 0x9e3779b9, _s1 = 0x243f6a88, _s2 = 0xb7e15162, _s3 = 0xdeadbeef;
Math.random = function () {
  const t = _s1 << 9;
  _s2 ^= _s0; _s3 ^= _s1; _s1 ^= _s2; _s0 ^= _s3; _s2 ^= t;
  _s3 = (_s3 << 11) | (_s3 >>> 21);
  return ((_s0 + _s3) >>> 0) / 4294967296;
};

const PAGE = path.join(__dirname, '..', 'glycolysis-lab.html');
const html = fs.readFileSync(PAGE, 'utf8');

let fails = 0, checks = 0;
function ok(cond, what, detail) {
  checks++;
  if (cond) { console.log(`  ok    ${what}${detail ? '   ' + detail : ''}`); }
  else { fails++; console.log(`  FAIL  ${what}${detail ? '   ' + detail : ''}`); }
}

/* ---- lift the model out of the page ----------------------------------- */
const from = html.indexOf('  const EA=0.6;');
const to = html.indexOf('const VSPD=');
if (from < 0 || to < from) {
  console.error('FAIL: glycolysis-lab.html no longer has the barrier block this checks.');
  console.error('      (looked for `const EA=0.6;` … `const VSPD=`)');
  process.exit(1);
}
const consts = html.slice(from, html.indexOf('\n', to) + 1);

const mSample = html.match(/const sampleE=\(\)=>[^;]+;/);
if (!mSample) {
  console.error('FAIL: could not find sampleE() in glycolysis-lab.html.');
  process.exit(1);
}

const model = new Function(
  consts + '\n' + mSample[0] +
  '\n return { EA, DROP, sampleE };'
)();
const { EA, DROP, sampleE } = model;

console.log('mass-action model, lifted from glycolysis-lab.html');
console.log(`  EA = ${EA} kT · DROP.flat = ${DROP.flat} · DROP.drop = ${DROP.drop.toFixed(4)} kT\n`);

/* ---- 1. the sampler is the distribution the lesson depends on ---------- */
/* Every claim below rests on energies being EXPONENTIAL — that is what makes
 * a taller barrier exponentially rarer to clear rather than proportionally
 * rarer, which is the one idea the drop tab exists to land. A uniform sampler
 * would still "work" and would teach the opposite. */
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

/* ---- 2. EA is legible, and SHARED ------------------------------------- */
const fwd = Math.exp(-EA);
ok(fwd > 0.40 && fwd < 0.70,
   'about half of arrivals react going forward',
   `${(fwd * 100).toFixed(1)}%`);

/* The catalyst rule, as a structural fact rather than a number: the reaction
 * test must add DROP to a barrier that is otherwise the SAME both ways. An
 * enzyme lowers the barrier in both directions at once, so a model with two
 * independent EAs could express a catalyst that shifts an equilibrium — which
 * no catalyst can do. This is the assertion the page's comment claims. */
ok(/p\.e\s*>=\s*EA\s*\+\s*\(p\.t===0\?0:drop\)/.test(html),
   'one EA for both directions, DROP added only going back');
ok(!/EA_FWD|EA_BACK|EA_REV/.test(html),
   'no second, direction-specific barrier has crept in');

/* ---- 3. the flat step is flat ----------------------------------------- */
ok(DROP.flat === 0, 'the flat step adds nothing to the reverse barrier');

/* ---- 4. the drop step's reverse is the documented 1-in-200 ------------- */
const ratio = Math.exp(-DROP.drop);
ok(Math.abs(1 / ratio - 200) < 1,
   'the drop step reverses about 1 encounter in 200',
   `1 in ${(1 / ratio).toFixed(1)}`);

/* ---- 5. where it actually lands, which is what a student sees ---------- */
/* A well-mixed run using ONLY the lifted constants and sampler: N molecules,
 * each repeatedly meeting an enzyme, converting when it clears the barrier it
 * faces. No positions — this asks where the populations settle, not how they
 * move, and the page's own step() adds nothing to that question except the
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
 * time. The modal prints ΔE, and a typed 5.3 would survive any retune of
 * DROP and silently start lying. */
ok(/\+\$\{d\.toFixed\(1\)\}\s*kT/.test(html),
   'the modal computes the kT it prints from DROP');
const shown = DROP.drop.toFixed(1);
ok(!new RegExp(`\\+${shown}\\s*kT`).test(html),
   `and nothing types "+${shown} kT" as a literal anywhere`);

/* ---- 7. the DRAWING agrees with the model ----------------------------- */
/* The reaction-coordinate curve makes geometric claims — the hump IS EA, the
 * climb back IS EA + DROP, and the hump is the SAME height on both tabs
 * because the enzyme is the same. Those are exactly as breakable as the
 * numbers, and more tempting to break: somebody nudges a control point to
 * make the curve prettier and the picture quietly stops matching the physics
 * it is drawn from. So the page's own drawEq is lifted and run, and the path
 * it emits is measured. */
const mEpx = html.match(/const EPX = [^;]+;/);
const dFrom = html.indexOf('  function drawEq(m){');
const dTo = html.indexOf('  function setMode(m){');
const mCol = html.match(/const COL=\[[^\]]+\];/);
const mSpc = html.match(/const SPECIES=\{[^}]+\};/);
ok(!!(mEpx && mCol && mSpc && dFrom > 0 && dTo > dFrom),
   'the page still has a drawEq to measure');

if (mEpx && mCol && mSpc && dFrom > 0 && dTo > dFrom) {
  let painted = '';
  const ui = { eq: { set innerHTML(v) { painted = v; } } };
  const draw = new Function('ui', 'EA', 'DROP',
    mCol[0] + mSpc[0] + mEpx[0] + html.slice(dFrom, dTo) + '\n return drawEq;'
  )(ui, EA, DROP);

  const EPX = new Function('EA', 'DROP', mEpx[0] + '\n return EPX;')(EA, DROP);

  // M26,<sub> H68 C…,…,<peak> C…,…,<prod> H196
  const RC = /M[\d.]+,([\d.]+) H[\d.]+ C[\d.-]+,[\d.-]+ [\d.-]+,[\d.-]+ [\d.-]+,([\d.-]+) C[\d.-]+,[\d.-]+ [\d.-]+,[\d.-]+ [\d.-]+,([\d.-]+) H/;
  const measure = m => {
    draw(m);
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
  ok(!!(gF && gD), 'both tabs draw a reaction coordinate');

  if (gF && gD) {
    const near = (a, b, t = 0.02) => Math.abs(a - b) < t;
    ok(near(gF.hump, EA * EPX),
       'the flat hump is EA tall', `${gF.hump.toFixed(2)}px vs ${(EA*EPX).toFixed(2)}px`);
    ok(near(gD.hump, EA * EPX),
       'the drop hump is EA tall', `${gD.hump.toFixed(2)}px`);
    ok(near(gF.hump, gD.hump),
       'and the two humps are the SAME — one enzyme, one barrier');
    ok(near(gF.fall, 0),
       'the flat step ends where it started', `${gF.fall.toFixed(2)}px`);
    ok(near(gD.fall, DROP.drop * EPX),
       'the drop falls by DROP', `${gD.fall.toFixed(2)}px vs ${(DROP.drop*EPX).toFixed(2)}px`);
    ok(near(gD.climb, (EA + DROP.drop) * EPX),
       'and climbing back is EA + DROP — the same peak, from lower down',
       `${gD.climb.toFixed(2)}px vs ${((EA+DROP.drop)*EPX).toFixed(2)}px`);
    ok(gD.kT === DROP.drop.toFixed(1),
       'the sentence prints the DROP the curve draws', `+${gD.kT} kT`);
  }
}

console.log('');
if (fails) {
  console.log(`FAIL: ${fails} of ${checks} checks failed.`);
  process.exit(1);
}
console.log(`PASS: ${checks} checks — the mass-action modal teaches what it claims.`);
