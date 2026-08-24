#!/usr/bin/env node
/* =====================================================================
 *  check-diffusion.js — the physics behind diffusion.js
 *
 *  WHY THIS EXISTS. The module makes three claims, and every one of them is a
 *  property of a random process rather than of anything drawn — which means
 *  the page looks exactly the same whether they hold or not. A biased walk
 *  still looks like dots wandering. A walk with the wrong step law still
 *  spreads out. A size-to-rate law with the ratio backwards still shows one
 *  colour ahead of the other.
 *
 *    1. THE WALK IS UNBIASED. Nothing reads the concentration; net movement
 *       is a consequence of how many are where, not a term in the model.
 *    2. SIZE SETS THE RATE, by Stokes–Einstein and nothing else.
 *    3. SPREAD GOES AS √t — mean square displacement linear in time.
 *
 *  AND ONE EXTERNAL CHECK, which is rarer and worth more than the other three
 *  put together: radiusOf() is a PROXY for the Stokes radius, invented here
 *  because a hydrodynamic radius cannot be derived from coordinates. Proxies
 *  drift. So it is measured against four published aqueous diffusion
 *  coefficients — the only numbers in this module's subject that exist
 *  outside this repo. If somebody retunes PALETTE.radii for a 3D page (its
 *  actual job, with no idea this file exists), that shows up here as a
 *  chemistry error rather than as nothing at all.
 *
 *  HOW. Requires diffusion.js and drives the REAL advance(), the same function
 *  the canvas calls, on synthetic particle arrays. It never reimplements the
 *  walk: a checker holding its own copy of the model agrees with itself
 *  forever and with the page never.
 *
 *  Run:  node diffusion/check-diffusion.js
 * ===================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

/* SEEDED — see check-massaction.js's note for the argument. This one settles
 * random walks, where the scatter is worse: a tolerance loose enough to survive
 * an unseeded run is loose enough to pass a broken model. Installed before
 * diffusion.js loads, because gauss() closes over Math.random at call time. */
let _s0 = 0x9e3779b9, _s1 = 0x243f6a88, _s2 = 0xb7e15162, _s3 = 0xdeadbeef;
Math.random = function () {
  const t = _s1 << 9;
  _s2 ^= _s0; _s3 ^= _s1; _s1 ^= _s2; _s0 ^= _s3; _s2 ^= t;
  _s3 = (_s3 << 11) | (_s3 >>> 21);
  return ((_s0 + _s3) >>> 0) / 4294967296;
};

const HERE = __dirname;
const src = fs.readFileSync(path.join(HERE, 'diffusion.js'), 'utf8');
const MolLib = require('../lib/lib-node.js');
globalThis.MolLib = MolLib;                     // radiusOf reads PALETTE through it
const D = require(path.join(HERE, 'diffusion.js'));
const { advance, radiusOf, diffusionOf, spreadOf, spreadSVG, gauss, PLOT } = D;
const M = MolLib.MOLECULES;

let fails = 0, checks = 0;
function ok(cond, what, detail) {
  checks++;
  if (cond) { console.log(`  ok    ${what}${detail ? '   ' + detail : ''}`); }
  else { fails++; console.log(`  FAIL  ${what}${detail ? '   ' + detail : ''}`); }
}

/* THE ÅNGSTRÖM SPEC, by name. A page picks its scale family by which domain
 * file it loads; lib-node.js loads them ALL, so under Node `MOLECULES.water` is
 * mol-solvation's display-unit water and the ångström one is suffixed. Naming
 * it explicitly here is the same decision diffusion-test.html makes with a
 * <script> tag — and getting it wrong is precisely what §5 asserts is fatal. */
const ang = k => M[`${k} [mol-small.js]`] || M[k];

/* A free particle: no wall ever reached, so every claim about the WALK is
 * about the walk. x sits mid-way along an effectively endless axis; y CANNOT
 * be made endless — the module normalises it to 0..1 by construction — so
 * instead D is scaled right down and the spread never gets near an edge. That
 * costs nothing: D_REF is a legibility knob set so a box evens out in about
 * ten seconds, and every claim below is a ratio it cancels out of. */
const D_TEST = 1e-5;
const free = (n, d) => Array.from({ length: n }, () =>
  ({ d, x: 5e5, y: 0.5, x0: 5e5, y0: 0.5, trail: [] }));
const run = (parts, dt, steps, aspect = 1e6) => {
  const c = [0, 0];
  for (let i = 0; i < steps; i++) {
    const got = advance(parts, dt, aspect); c[0] += got[0]; c[1] += got[1];
  }
  return c;
};

console.log('diffusion model — diffusion.js\n');

/* ---- 1. the walk is unbiased ------------------------------------------ */
/* THE CENTRAL CLAIM, and the one a plausible bug hides best. Add a hair of
 * drift and the box still evens out, still counts crossings, still plots a
 * curve — it just does it because something pushed, which is the exact belief
 * this module exists to remove. Mean displacement must be zero to within the
 * standard error of the mean, which for N walkers of RMS spread s is s/√N. */
{
  const N = 40000, d = D_TEST, dt = 1 / 60, steps = 600;
  const parts = free(N, d);
  run(parts, dt, steps);
  const mx = parts.reduce((q, p) => q + (p.x - p.x0), 0) / N;
  const my = parts.reduce((q, p) => q + (p.y - p.y0), 0) / N;
  const s = spreadOf(parts), se = s / Math.sqrt(N);
  ok(Math.abs(mx) < 3 * se && Math.abs(my) < 3 * se,
     'the walk has no preferred direction',
     `mean drift (${mx.toExponential(2)}, ${my.toExponential(2)}) vs 3·SE ${(3*se).toExponential(2)}`);
  // And it is isotropic: a step scaled per-axis (the bug you get from working
  // in fractions of width and height) drifts nowhere but spreads oval.
  const vx = parts.reduce((q, p) => q + (p.x - p.x0) ** 2, 0) / N;
  const vy = parts.reduce((q, p) => q + (p.y - p.y0) ** 2, 0) / N;
  ok(Math.abs(vx / vy - 1) < 0.05, 'and spreads the same distance in both axes',
     `x/y variance ${(vx / vy).toFixed(3)}`);
}

/* ---- 2. mean square displacement is linear in time --------------------- */
/* √t IS THE LESSON, and it is exactly the claim the spread plot draws. Stated
 * as MSD rather than RMS because linear-in-t is a test with no square roots
 * in it to hide a power of 1.4 inside. ⟨r²⟩ = 4·D·t in two dimensions. */
{
  const N = 20000, d = D_TEST, dt = 1 / 60;
  const parts = free(N, d);
  const msd = () => parts.reduce((q, p) =>
    q + (p.x - p.x0) ** 2 + (p.y - p.y0) ** 2, 0) / N;
  const at = {};
  let now = 0;
  for (const T of [1, 2, 4, 8]) {
    run(parts, dt, Math.round((T - now) / dt));
    now = T; at[T] = msd();
  }
  ok(Math.abs(at[2] / at[1] - 2) < 0.06 && Math.abs(at[4] / at[2] - 2) < 0.06
     && Math.abs(at[8] / at[4] - 2) < 0.06,
     'mean square displacement doubles when the time doubles — spread goes as √t',
     `ratios ${(at[2]/at[1]).toFixed(3)} ${(at[4]/at[2]).toFixed(3)} ${(at[8]/at[4]).toFixed(3)}`);
  // The constant, not just the shape: ⟨r²⟩ = 4Dt is what makes D mean anything.
  ok(Math.abs(at[4] / (4 * d * 4) - 1) < 0.04,
     'and the constant is 4·D·t, so D is a diffusion coefficient',
     `${at[4].toFixed(4)} vs ${(4 * d * 4).toFixed(4)}`);
  // Four times the time for twice the distance — the sentence the module puts
  // on screen, tested as the sentence rather than as its algebra.
  ok(Math.abs(Math.sqrt(at[4] / at[1]) - 2) < 0.03,
     'twice as far takes four times as long, as the readout says',
     `√(MSD₄/MSD₁) = ${Math.sqrt(at[4] / at[1]).toFixed(3)}`);
}

/* ---- 3. size sets the rate, and only size ----------------------------- */
ok(Math.abs(diffusionOf(2) * 2 - diffusionOf(4) * 4) < 1e-12,
   'D is inversely proportional to radius — Stokes–Einstein, nothing else');
{
  // Not the formula but the WALK: two radii through the real advance().
  const dt = 1 / 60, N = 20000;
  // Scaled by the same factor, so the RATIO under test is untouched.
  const f = D_TEST / diffusionOf(2);
  const small = free(N, diffusionOf(2) * f), big = free(N, diffusionOf(6) * f);
  run(small, dt, 240); run(big, dt, 240);
  ok(Math.abs((spreadOf(small) / spreadOf(big)) - Math.sqrt(3)) < 0.05,
     'a molecule 3× the radius spreads √3× slower, measured through advance()',
     `${(spreadOf(small) / spreadOf(big)).toFixed(3)} vs ${Math.sqrt(3).toFixed(3)}`);
}

/* ---- 4. THE EXTERNAL CHECK: radiusOf against published D --------------- */
/* Aqueous diffusion coefficients at 25 °C, ×10⁻⁹ m² s⁻¹. These are the only
 * numbers here that come from outside this repo, and they are what stops
 * radiusOf being a formula that agrees with itself.
 *   water 2.3 · CO₂ 1.9 · ethanol 1.24 · glucose 0.67
 * (CRC Handbook / Cussler, Diffusion, 3rd ed., table 5.2-1 — round figures,
 * which is why the tolerance is 25% and not 5%.)
 *
 * 25% IS NOT SLACK, it is the honest width of a one-parameter proxy: a Stokes
 * radius is a hydrodynamic measurement, this is a radius of gyration plus a
 * mean display radius, and getting four molecules across a 3.4× range inside
 * a quarter is more than the module needs to claim. What it catches is the
 * failure that matters — a proxy that stops tracking size at all. */
{
  const LIT = { water: 2.3, co2: 1.9, ethanol: 1.24, glucose: 0.67 };
  const rw = radiusOf(ang('water'));
  let worst = 0, worstName = '';
  console.log('  ---- radiusOf against published aqueous D (25 °C) ----');
  for (const [k, lit] of Object.entries(LIT)) {
    const r = radiusOf(ang(k));
    const rel = diffusionOf(r) / diffusionOf(rw);
    const err = rel / (lit / LIT.water) - 1;
    console.log(`        ${k.padEnd(9)} r=${r.toFixed(2)} Å  D/D_water `
      + `${rel.toFixed(2)} vs ${(lit / LIT.water).toFixed(2)} `
      + `(${err >= 0 ? '+' : ''}${(err * 100).toFixed(0)}%)`);
    if (Math.abs(err) > Math.abs(worst)) { worst = err; worstName = k; }
  }
  ok(Math.abs(worst) < 0.25,
     'every predicted diffusion ratio is within 25% of the measured one',
     `worst ${worstName} ${worst >= 0 ? '+' : ''}${(worst * 100).toFixed(0)}%`);
  // Water's ABSOLUTE radius is the one the proxy can be pinned on: the Stokes
  // radius of water is ~1.9 Å, and the module's R_REF is written down as its
  // reference. If these part company the reference is a stale typed number.
  ok(Math.abs(rw - D.R_REF) < 0.01,
     'R_REF is water, computed — not a number that outlived the function',
     `${rw.toFixed(2)} Å`);
  ok(Math.abs(rw - 1.9) < 0.4, 'and it lands on water\'s measured Stokes radius',
     `${rw.toFixed(2)} Å vs ~1.9 Å`);
  // Ordering, which no tolerance can excuse.
  const order = ['water', 'co2', 'ethanol', 'glucose'];
  ok(order.every((k, i) => i === 0 || radiusOf(ang(k)) > radiusOf(ang(order[i - 1]))),
     'and the four are in size order, which no tolerance forgives');
}

/* ---- 5. scale families cannot be mixed -------------------------------- */
/* mol-solvation.js and mol-small.js define the SAME KEYS at two scales
 * (MolecularGeometry.md §1). A page that loads the display-unit set would
 * compare a stylised water against a measured glucose and read the difference
 * as chemistry. The module throws instead — asserted, because it is a guard
 * that only fires on a page nobody has written yet. */
{
  let threw = false;
  try { radiusOf({ name: 'fake', units: 'scene', atoms: [{ el: 'O', pos: [0, 0, 0] }] }); }
  catch (e) { threw = /scale famil|ångström|angstrom/i.test(e.message); }
  ok(threw, 'a display-units spec is refused, not silently mis-measured');
  // Both families exist in the registry, they define the same keys, and only
  // one of them can be measured. That is the trap the throw above exists for.
  ok(M.water && M.water.units === 'scene' && ang('water').units === 'angstrom',
     'both families are present and only the ångström one is measurable');
  // The SCRIPT TAGS, not the prose — the bench's own comment names
  // mol-solvation.js as the file it must not load, and a naive text search
  // reads that warning as the mistake it warns about.
  const bench = fs.readFileSync(path.join(HERE, 'diffusion-test.html'), 'utf8');
  const loads = [...bench.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);
  ok(loads.some(f => /mol-small\.js$/.test(f)) && !loads.some(f => /mol-solvation\.js$/.test(f)),
     'and the bench loads mol-small.js, not mol-solvation.js', loads.join(' '));
}

/* ---- 6. nothing in the model reads the concentration ------------------- */
/* THE CLAIM THE WHOLE MODULE IS FOR, as a structural fact rather than a
 * number: advance() sees one particle at a time and knows nothing about how
 * many are where. The moment it takes a count, "molecules spread out because
 * they are crowded" becomes true by construction and teaches the opposite of
 * what it looks like. */
{
  const body = src.slice(src.indexOf('function advance('),
                         src.indexOf('/* RMS displacement'));
  ok(!/\.length|filter|count|conc|gradient|mid\s*-\s*p\.x/.test(
       body.replace(/parts\.length/g, '').replace(/^.*\/\/.*$/gm, '')),
     'advance() never counts anything — no term reads the gradient');
  ok(/for \(const p of parts\)/.test(body),
     'it walks each particle independently');
}

/* ---- 7. a lopsided box evens out, and keeps crossing ------------------ */
/* The emergent half: with the model blind to concentration, the net flux has
 * to come out of the geometry alone. Both halves are tested, because the
 * second is the one students disbelieve — at equilibrium the traffic does not
 * stop, it balances. */
{
  const dt = 1 / 60, A = 2, d = 0.02;
  const parts = [];
  for (let i = 0; i < 600; i++) {
    const x = Math.random() * A * 0.46, y = Math.random();
    parts.push({ d, x, y, x0: x, y0: y, trail: [] });
  }
  const early = run(parts, dt, 120, A);       // first 2 s, still lopsided
  // THE NET, NOT THE RAW COUNTS. Raw crossings are dominated by particles
  // sitting ON the line re-crossing it a dozen times, so even during strong
  // transport the two tallies look close — 269 against 217 here. The
  // DIFFERENCE is the transport, and it is exactly the number of particles
  // that changed sides, which is worth asserting as conservation: nothing
  // appears or vanishes at the line.
  const netEarly = early[0] - early[1];
  const rightNow = parts.filter(p => p.x >= A / 2).length;
  ok(netEarly > 30, 'from a lopsided start there is a real net flux to the empty side',
     `net ${netEarly} of ${early[0] + early[1]} crossings`);
  ok(rightNow === netEarly,
     'and the net crossing IS the population that changed sides — nothing leaks',
     `${rightNow} now on the right`);
  run(parts, dt, 3000, A);                     // 50 s — well mixed
  const late = run(parts, dt, 600, A);         // then 10 s of settled traffic
  const right = parts.filter(p => p.x >= A / 2).length;
  ok(Math.abs(right / parts.length - 0.5) < 0.05,
     'it settles even', `${(right / parts.length * 100).toFixed(1)}% on the right`);
  ok(late[0] > 200 && late[1] > 200,
     'and BOTH directions are still running there — the counters cannot read zero',
     `${late[0]} right, ${late[1]} left in 10 s`);
  const netLate = Math.abs(late[0] - late[1]);
  ok(netLate < (late[0] + late[1]) * 0.1,
     'with the two directions balanced, which is what "evened out" means',
     `net ${late[0] - late[1]} of ${late[0] + late[1]}`);
  // The two states differ in the NET as a share of the traffic, not in the
  // traffic — which is the whole distinction the net bar has to draw.
  ok(netLate / (late[0] + late[1]) < netEarly / (early[0] + early[1]) / 5,
     'a settled box and a spreading one differ in the net, not in the traffic',
     `${(netLate/(late[0]+late[1])*100).toFixed(1)}% vs `
     + `${(netEarly/(early[0]+early[1])*100).toFixed(1)}% of crossings`);
}

/* ---- 7b. the net bar cannot claim more than it knows -------------------- */
/* THE SENTENCE AND THE ARROW, both pinned. Two bugs were found here in the
 * browser and neither is visible from the model:
 *
 *   · "evened out — still crossing both ways" appeared half a second after
 *     load off a SINGLE crossing — one event spikes its own exponential
 *     average past the busy floor, and a test on |net| alone cannot tell that
 *     from balance. That sentence is the second lesson in one line.
 *   · The arrow read "net moving left" at a box holding 80 left and 30 right,
 *     because the direction came off the traffic, which is noisy. With a
 *     gradient the flux is DOWN it by construction, so the population names
 *     the direction and the traffic only votes once the split is even.
 */
{
  const { netReading, BUSY_EPS: BE } = D;
  const r = (f, b, l, ri) => netReading(f, b, l, ri);
  ok(r(1 / 0.9, 0, 40, 40).state === 'quiet',
     'one crossing in one direction does NOT read as "crossing both ways"');
  ok(r(0, 0, 40, 40).state === 'quiet', 'a silent box reads quiet, not balanced');
  ok(r(20, 19.5, 40, 40).state === 'even',
     'busy both ways with an even split reads evened out');
  ok(r(20, 2, 40, 40).state === 'net', 'busy in one direction reads as a net direction');
  ok(r(BE * 1.01, BE * 1.01, 40, 40).state === 'even'
     && r(BE * 0.9, BE * 0.9, 40, 40).state === 'quiet',
     'and the floor is the busy threshold in EACH direction, not their sum');
  // The population term — the 55/25 case, where the traffic looks balanced
  // because most crossings are the same few particles re-crossing the line.
  ok(r(20, 19.5, 55, 25).state === 'net',
     'a box still 55/25 is NOT evened out, however balanced the traffic looks');
  // The direction term — down the gradient, whatever this frame's traffic did.
  ok(r(19.5, 20, 80, 30).dir === 1,
     'a fuller left side means net movement RIGHT, even when the traffic says otherwise',
     `dir ${r(19.5, 20, 80, 30).dir}`);
  ok(r(20, 19.5, 30, 80).dir === -1, 'and the mirror image points the other way');
  ok(r(20, 19.5, 40, 40).dir === 0, 'an evened-out box points nowhere');
  // Only once the gradient is gone does the traffic get to name a direction.
  ok(r(30, 20, 41, 40).dir === 1 && r(20, 30, 41, 40).dir === -1,
     'with the split even, the traffic decides');
}

/* ---- 7c. size sets the rate, not the destination ----------------------- */
/* THE MISREADING THIS PREVENTS. Watching two species even out at different
 * speeds, the obvious conclusion is that the slow one ends up less spread —
 * that big molecules somehow settle lopsided. They do not: D is a rate and the
 * equilibrium is a counting argument that has no D in it. Both species must
 * finish at the same even split, and only the time taken differs. The test
 * bench says this in words; here it is as a measurement. */
{
  const dt = 1 / 60, A = 2;
  const mk = d => {
    const p = [];
    for (let i = 0; i < 400; i++) {
      const x = Math.random() * A * 0.46, y = Math.random();
      p.push({ d, x, y, x0: x, y0: y, trail: [] });
    }
    return p;
  };
  const fast = mk(diffusionOf(radiusOf(ang('water'))));
  const slow = mk(diffusionOf(radiusOf(ang('glucose'))));
  const across = p => p.filter(q => q.x >= A / 2).length / p.length;
  run(fast, dt, 600, A); run(slow, dt, 600, A);          // 10 s
  ok(across(fast) > across(slow) * 1.5,
     'ten seconds in, the small molecule is well ahead',
     `${(across(fast)*100).toFixed(0)}% vs ${(across(slow)*100).toFixed(0)}% across`);
  run(fast, dt, 12000, A); run(slow, dt, 12000, A);      // 200 s more
  ok(Math.abs(across(fast) - 0.5) < 0.05 && Math.abs(across(slow) - 0.5) < 0.05,
     'and long after, BOTH are even — size sets the rate, never the destination',
     `${(across(fast)*100).toFixed(0)}% vs ${(across(slow)*100).toFixed(0)}%`);
}

/* ---- 8. the drawing agrees with the model ----------------------------- */
/* spreadSVG makes a geometric claim — the dashed reference IS √t, anchored to
 * the first sample and never fitted to the rest. A fit would absorb any error
 * into its own constant and draw agreement whatever the model did. So the
 * path is built and measured. */
{
  const tMax = 24, rMax = 1;
  const k = 0.1;
  const samples = [];
  for (let i = 1; i <= 20; i++) { const t = i * 1.2; samples.push({ t, r: k * Math.sqrt(t) }); }
  const svg = spreadSVG(samples, tMax, rMax);
  const ref = (svg.match(/class="ref" points="([^"]+)"/) || [])[1];
  const meas = (svg.match(/class="meas" points="([^"]+)"/) || [])[1];
  ok(!!(ref && meas), 'the plot draws a measured line and a reference');
  if (ref && meas) {
    const pt = s => s.trim().split(/\s+/).map(p => p.split(',').map(Number));
    const R = pt(ref), Ms = pt(meas);
    // The reference must BE √t in plot space: y for t=4T is the same distance
    // above the axis as 2× y for t=T.
    const yOf = t => {
      const x = PLOT.x0 + (PLOT.x1 - PLOT.x0) * (t / tMax);
      const near = R.reduce((a, b) => Math.abs(b[0] - x) < Math.abs(a[0] - x) ? b : a);
      return PLOT.y1 - near[1];
    };
    ok(Math.abs(yOf(16) / yOf(4) - 2) < 0.02,
       'the reference is √t — four times the time, twice the height',
       `${(yOf(16) / yOf(4)).toFixed(3)}`);
    // A perfect √t input must land ON the reference, or the two are drawn in
    // different spaces and every future departure is meaningless.
    const off = Ms.reduce((m, p) => {
      const near = R.reduce((a, b) => Math.abs(b[0] - p[0]) < Math.abs(a[0] - p[0]) ? b : a);
      return Math.max(m, Math.abs(near[1] - p[1]));
    }, 0);
    ok(off < 1.0, 'and a perfect √t measurement lies on top of it',
       `worst gap ${off.toFixed(2)}px`);
    // Anchored, not fitted: scale the whole measurement and the reference must
    // follow it rather than staying put.
    const svg2 = spreadSVG(samples.map(s => ({ t: s.t, r: s.r * 1.5 })), tMax, rMax);
    const R2 = pt((svg2.match(/class="ref" points="([^"]+)"/) || [])[1]);
    ok(Math.abs((PLOT.y1 - R2[12][1]) / (PLOT.y1 - R[12][1]) - 1.5) < 0.02,
       'the reference is anchored to the first sample, not fitted to all of them');
  }
}

/* ---- 9. it is diffusion, not osmosis ---------------------------------- */
/* THE SCOPE LINE, kept by an assertion rather than by memory. The membrane
 * lesson is a separate page (LESSONS-ROADMAP §2) and this module stops one
 * step short on purpose: the line at the middle is imaginary. If a barrier
 * ever grows here it must be a decision somebody makes on purpose, not a
 * feature that arrives because it was easy. */
ok(!/membrane|barrier\s*=|impermeab|osmo|semiperm/i.test(
     src.replace(/^\s*\*.*$/gm, '').replace(/\/\/.*$/gm, '')),
   'no membrane has grown into the module — that is the next lesson, not this one');
ok(/counting line/i.test(src), 'and the line is documented as a counting line');

console.log('');
if (fails) {
  console.log(`FAIL: ${fails} of ${checks} checks failed.`);
  process.exit(1);
}
console.log(`PASS: ${checks} checks — the diffusion model teaches what it claims.`);
