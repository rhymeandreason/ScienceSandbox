#!/usr/bin/env node
/* =====================================================================
 *  check-ribbon.js — RibbonLib's frame, on geometry it builds itself.
 *
 *  Split out of folding/tools/check-folding.js when ribbon.js moved to kit/.
 *  That file audits attic/folding-lab.html's spoken claims, and the ribbon
 *  assertions had ridden along in it since the ribbon was that page's. It is
 *  now drawn by nine folders and no lesson, so a checker gated on folding/
 *  was guarding a shared module from behind a page in the attic.
 *
 *  WHAT IS NOT HERE. RibbonLib.HP35_HELICES and HP35_OFFSET stay in
 *  check-folding.js: they are villin numbering checked against 1VII's HELIX
 *  records, so they need that file and villin.js, and their only consumer is
 *  attic/folding-lab-ribbon.html.
 *
 *  Every subject below is built from arithmetic — an ideal alpha helix (100
 *  deg per residue, 1.5 A rise, 2.3 A radius) and an ideal pleated strand.
 *  That is deliberate: these are claims about the FRAME, and a deposited
 *  structure would let a real bug hide inside real noise.
 *
 *  build() is not called. It needs THREE and this runs in bare Node, so what
 *  is asserted is the frame it builds on and the constants it reads; the
 *  shapes themselves are the human's job in kit/ribbon-test.html.
 *
 *  Run:  node kit/check-ribbon.js      (offline, no dependencies)
 * ===================================================================== */
'use strict';

const path = require('path');
const Ribbon = require(path.join(__dirname, 'ribbon.js'));

let failures = 0;
const fail = (what, msg) => { console.log(`  FAIL  ${what}: ${msg}`); failures++; };
const ok   = msg => console.log(`  ok    ${msg}`);

console.log('ribbon.js\n---------');

/* An ideal alpha helix: 100 deg per residue, 1.5 A rise, 2.3 A radius, on z.
   The retention arithmetic below is derived for exactly this geometry. */
const P = [];
for (let i = 0; i < 24; i++) {
  const a = i * 100 * Math.PI / 180;
  P.push([2.3 * Math.cos(a), 2.3 * Math.sin(a), i * 1.5]);
}
const ss = new Array(24).fill('H');

/* build()'s default weight. One constant because three assertions read it,
   and a default that drifted away from the geometry they measure would leave
   all three passing about a setting no page uses. */
const SMOOTH_W = 0.20;

/* ---- smoothing: regularised, not collapsed -------------------------- */
/* Must stay between "does nothing" and "collapses the helix onto its axis".
   Both failure modes are invisible in a diff and obvious only on screen, and
   one of them shipped: 2 passes at 0.45 took an ideal helix from 2.30 A
   off-axis to 0.51 A, which is the flat "rocket" style rather than a coil. */
const radiusOf = arr => arr.slice(4, 20)
  .reduce((s, p) => s + Math.hypot(p[0], p[1]), 0) / 16;
const before = radiusOf(P), after = radiusOf(Ribbon.smooth(P, ss, 1, SMOOTH_W));
const keep = after / before;
if (keep < 0.40)
  fail('smoothing', `collapses the helix to ${(keep*100).toFixed(0)}% of its radius ` +
       `(${after.toFixed(2)} A) — that is the flat "rocket" style, not a coil`);
else if (keep > 0.80)
  fail('smoothing', `only removes ${((1-keep)*100).toFixed(0)}% of the helix radius — ` +
       `too weak to stop the per-residue lurch`);
else
  ok(`smoothing keeps ${(keep*100).toFixed(0)}% of an ideal helix's radius ` +
     `(${before.toFixed(2)} -> ${after.toFixed(2)} A) — regularised, not collapsed`);

/* Coil comes through untouched: a loop's wiggle is its shape. */
{
  const coil = Ribbon.smooth(P, new Array(24).fill('C'), 1, SMOOTH_W);
  const moved = Math.max(...P.map((p, i) =>
    Math.hypot(p[0]-coil[i][0], p[1]-coil[i][1], p[2]-coil[i][2])));
  if (moved > 1e-9) fail('smoothing', `moves coil residues by up to ${moved.toFixed(3)} A`);
  else ok('coil guide points are left exactly where they are');
}

/* ---- the band lies ON the cylinder, not edge-first ------------------ */
/* ribbon.js puts the band's WIDTH along frames()'s `t x n` and its thickness
   along `n`, so `n` is the flat face's normal and must point radially. Then
   the width runs along the axis and the band wraps the cylinder.

   THIS SHIPPED WRONG AND LOOKED MERELY UGLY. frames() built `n` as
   (a-b) x (c-b) — the binormal, perpendicular to the osculating plane rather
   than lying in it. On an ideal helix that is 0.00 radial and 0.83 axial: the
   ribbon rotated a quarter turn about its own path, winding edge-first as a
   corkscrew ramp. Nothing else was wrong, which is why it read as a styling
   problem and drew two rounds of tuning the widths instead.

   The two dot products are the entire difference between the correct frame
   and that one, so they are cheap insurance against a `+` being "simplified"
   back into a `x`. The width axis cannot reach 1.0: `side` is perpendicular
   to the tangent, and an alpha helix's tangent is tilted ~34 deg off
   circumferential by its own rise, so the band leans by the pitch angle.
   That lean is real. */
const cross3 = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const unit = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0]/l, a[1]/l, a[2]/l]; };
const F = Ribbon.frames(P, Ribbon.smooth(P, ss, 1, SMOOTH_W), ss);
{
  let radial = 0, axial = 0, m = 0;
  for (let i = 4; i < 20; i++, m++) {
    const rad = unit([P[i][0], P[i][1], 0]);          // outward, helix on z
    radial += Math.abs(F[i].n[0]*rad[0] + F[i].n[1]*rad[1] + F[i].n[2]*rad[2]);
    axial  += Math.abs(unit(cross3(F[i].t, F[i].n))[2]);
  }
  radial /= m; axial /= m;
  if (radial < 0.95)
    fail('frame', `the flat face's normal is only ${radial.toFixed(2)} radial on an ideal ` +
         `helix — the band is not lying on the cylinder. A binormal (a cross product of the two ` +
         `Ca vectors) instead of the bisector scores 0.00 here and winds the ribbon edge-first`);
  else if (axial < 0.55)
    fail('frame', `the band's width axis is only ${axial.toFixed(2)} along the helix axis — ` +
         `it should lean off it by the pitch angle and no more`);
  else
    ok(`the band lies on the helix cylinder: face normal ${radial.toFixed(2)} radial, ` +
       `width axis ${axial.toFixed(2)} along the axis (the rest is the pitch lean)`);
}

/* ---- the frame ROTATES, it does not alternate ----------------------- */
/* The dot products above are averages of absolute values, so they are blind
   to a frame that flips sign every residue: |n . radial| is 1.00 whether the
   normal points in or out. That is exactly the state ribbon.js shipped in.
   frames() carried the usual sign-continuity guard, `if (dot(n, prev) < 0)
   n = -n`, which assumes a frame turns less than 90 degrees per step and so
   treats any reversal as spurious. An alpha helix turns 100 degrees per
   residue. The guard fired on every one, the frame alternated instead of
   rotating, and each turn of the band flared open and shut like a cone.

   So measure the SIGNED step: consecutive frames must differ by the helix's
   own 100 degrees. A reinstated flip gives 180 - 100 = 80 and fails here,
   which is the only number that separates the two. */
{
  let worst = 0;
  for (let i = 5; i < 19; i++) {
    const d = F[i].n[0]*F[i+1].n[0] + F[i].n[1]*F[i+1].n[1] + F[i].n[2]*F[i+1].n[2];
    const deg = Math.acos(Math.max(-1, Math.min(1, d))) * 180 / Math.PI;
    worst = Math.max(worst, Math.abs(deg - 100));
  }
  if (worst > 5)
    fail('frame', `consecutive frames differ by up to ${(100+worst).toFixed(0)} deg on an ` +
         `ideal helix instead of its own 100 deg — the frame is alternating, not rotating. ` +
         `80 deg means a sign-continuity flip is back in frames()`);
  else
    ok(`the frame rotates with the helix — 100 deg per residue (worst error ${worst.toFixed(1)} deg), not alternating`);
}

/* ---- a strand lies flat and does not roll --------------------------- */
/* The mirror of the cylinder test, and it exists because the two want
   OPPOSITE treatment from the same line of code. A helix's frame must be free
   to turn 100 degrees per residue; a strand's must not turn at all. Pinning
   only one is what let ribbon.js ship first with the guard on everywhere
   (helices in cups) and then off everywhere (strands rolling).

   A strand is PLEATED — Ca alternating ~0.9 A either side of its mean plane —
   so the raw bisector genuinely reverses every residue, exactly 180 degrees.
   Two things must hold for the band to read flat: the smoothing must
   annihilate the pleat (|1 - 2w| = 0 at w = 0.5), and the frame must not
   inherit its alternation. */
{
  const Pe = [], sse = [];
  for (let i = 0; i < 14; i++) { Pe.push([3.3*i, 0, (i % 2 ? 1 : -1) * 0.9]); sse.push('E'); }
  const flat = Ribbon.smooth(Pe, sse, 1, Ribbon.SMOOTH_W);
  const pleat = Math.max(...flat.slice(2, 12).map(p => Math.abs(p[2])));
  if (pleat > 0.05)
    fail('strand', `smoothing leaves ${pleat.toFixed(2)} A of the 0.90 A pleat — the band ` +
         `will read as a row of bumps rather than a flat strand (needs w = 0.5 for E, ` +
         `not the helix's ${Ribbon.SMOOTH_W.H})`);
  else {
    const Fe = Ribbon.frames(Pe, flat, sse);
    let worst = 0;
    for (let i = 3; i < 11; i++) {
      const d = Fe[i].n[0]*Fe[i+1].n[0] + Fe[i].n[1]*Fe[i+1].n[1] + Fe[i].n[2]*Fe[i+1].n[2];
      worst = Math.max(worst, Math.acos(Math.max(-1, Math.min(1, d))) * 180 / Math.PI);
    }
    if (worst > 25)
      fail('strand', `a strand's frame turns up to ${worst.toFixed(0)} deg per residue — ` +
           `near 180 means the pleat's alternating bisector is being inherited and the band ` +
           `rolls along its length. Sign continuity must run on E (it must NOT on H)`);
    else
      ok(`beta strand lies flat: pleat smoothed to ${pleat.toFixed(2)} A, frame turns at most ` +
         `${worst.toFixed(0)} deg per residue — no roll`);
  }
}

/* ---- a strand is still an arrow ------------------------------------- */
/* Constants only: build() needs THREE, so the shape itself was verified in
   the browser (body flat at 1.60, a step to 2.45 on the last residue, then a
   straight taper to the point). What is asserted here is the ordering that
   makes an arrow possible at all, and it is exactly what a well-meaning
   simplification would break — the strand shipped once with no arrowhead and
   E only 1.23x H, which is invisible on screen and left a sheet reading as a
   pile of loose bands.

   The arrowhead is not decoration: it is the only thing on a cartoon that
   says which way a strand RUNS, which is what makes a sheet parallel or
   antiparallel. */
{
  const PR = Ribbon.PROFILE, A = Ribbon.ARROW;
  if (!A || !(A.head > 0))
    fail('arrow', 'RibbonLib.ARROW is gone — beta strands have no arrowhead, so a sheet ' +
         'shows neither its direction nor which bands are strands');
  else if (!(A.head > PR.E[0] * 1.3))
    fail('arrow', `arrow head ${A.head} is not meaningfully wider than the strand body ` +
         `${PR.E[0]} — the barb will not read as a point`);
  /* Was `A.tip < PR.C[0] * 1.5`, i.e. under 0.48, which a tip of 0.30 passed
     while still cutting a 0.6 A stub across the end of a 4.9 A barb — visibly
     a snipped-off arrow. A point is a point: the only defensible number here
     is zero, give or take rounding. */
  else if (!(A.tip <= 0.02))
    fail('arrow', `arrow tip is ${A.tip} A, not a point — that leaves a ${(A.tip*2).toFixed(2)} A ` +
         `stub across the end of a ${(A.head*2).toFixed(2)} A barb, which reads as a blunt flag`);
  else if (!(PR.E[0] > PR.H[0]))
    fail('arrow', `strand body ${PR.E[0]} is not wider than a helix ${PR.H[0]}`);
  /* ARROW.length is in ANGSTROMS along the curve, not residues, and that
     distinction is the whole point of it. Sized in residues the head came out
     a different physical size on every strand — longest on exactly the
     strands whose ends curve most, because the spline stretches through a
     turn — which is what made some read as long darts. An arrowhead is a
     glyph and should be one size everywhere. */
  else if (!(A.length > 0))
    fail('arrow', 'ARROW.length is gone — a head sized in residues is a different ' +
         'physical size on every strand, longest where the strand curves most');
  else if (!(A.length > A.head * 1.8 && A.length < A.head * 4))
    fail('arrow', `arrow head is ${A.length} A long against a ${(A.head*2).toFixed(2)} A barb ` +
         `— outside the 1.8x-4x half-barb range that reads as an arrowhead`);
  else
    ok(`beta strands are arrows: body ${PR.E[0]} vs helix ${PR.H[0]}, barb ${A.head} ` +
       `(${(A.head/PR.E[0]).toFixed(1)}x the body), tapering to ${A.tip}`);
}

if (failures) { console.log(`\nFAIL: ${failures} assertion(s) failed`); process.exit(1); }
console.log('\nPASS: the ribbon frame lies on a helix, rotates with it, and leaves a strand flat and pointed');
