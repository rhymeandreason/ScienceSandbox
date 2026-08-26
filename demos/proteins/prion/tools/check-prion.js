#!/usr/bin/env node
/* =====================================================================
 *  check-prion.js — the assertions behind the helix-to-sheet morph.
 *
 *  Every claim prion.js makes about the geometry is
 *  here, because each of them fails INVISIBLY. A mirrored rebuild is still
 *  a protein-shaped object; a stretched bond is hidden under the ribbon;
 *  a morph that lands near the fibril instead of on it looks like a morph
 *  that landed. The only way to know is to measure.
 *
 *  Run:  node prion/tools/check-prion.js     (offline, no dependencies)
 * ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const P = require('../prion.js');
const v3 = P._v3;

const DATA = path.join(__dirname, '..', 'data');
let failed = 0;

function ok(name, pass, detail) {
  console.log(`${pass ? '  ok  ' : 'FAIL  '}${name}${detail ? '   ' + detail : ''}`);
  if (!pass) failed++;
}
const near = (a, b, tol) => Math.abs(a - b) <= tol;

/* ---- 1. the rebuild is its own inverse ---------------------------------
   prion.js's place() negates the dihedral because folding/folding.js's
   frame is left-handed (that file's header carries the argument). If the
   negation is ever "tidied away", this is what catches it: the round trip
   opens to 0.4 A on a single peptide bond and to nonsense along a chain. */
{
  const A = [0.3, 1.2, -0.7], B = [1.5, 1.0, 0.2], C = [2.1, 2.3, 0.9], D = [3.4, 2.0, 1.6];
  const len = v3.dist(C, D);
  const u = v3.norm(v3.sub(B, C)), w = v3.norm(v3.sub(D, C));
  const ang = Math.acos(v3.dot(u, w)) * 180 / Math.PI;
  const back = P._place(A, B, C, len, ang, P._dihedral(A, B, C, D));
  ok('NeRF round trip is IUPAC', v3.dist(D, back) < 1e-9,
     v3.dist(D, back).toExponential(1) + ' A');
}

/* ---- 2. the shortest angular path ---- */
ok('lerpAngle takes the short way', near(P._lerpAngle(-179, 179, 0.5), -180, 1e-9),
   P._lerpAngle(-179, 179, 0.5).toFixed(1) + ' deg');

const nat = P.parse(fs.readFileSync(path.join(DATA, 'prp-native.pdb'), 'utf8'));
const fib = P.parse(fs.readFileSync(path.join(DATA, 'prp-fibril.pdb'), 'utf8'));
const mor = P.morph(nat, fib, { frames: 120 });

/* ---- 3. the endpoints are the deposited structures ----------------------
   Unfitted at t=0 and Kabsch-fitted at t=1; rmsd()'s header says why the
   two tests differ, and it is not a convenience. */
{
  const a = mor.at(0), b = mor.at(1);
  ok('t=0 IS 1QLZ', P.rmsd(a, nat.residues) < 1e-6,
     P.rmsd(a, nat.residues).toExponential(1) + ' A, unfitted');
  ok('t=1 IS 6LNI', P.rmsd(b, fib.residues, true) < 0.01,
     P.rmsd(b, fib.residues, true).toFixed(4) + ' A, fitted');
}

/* ---- 4. no bond changes length, anywhere -------------------------------
   THE CENTRAL CLAIM OF THE MORPH. If this fails the animation is showing a
   chain that stretches, which is the exact thing a Cartesian interpolation
   would have done and the whole reason the morph is in torsion space. */
{
  const L0 = P.bondLengths(mor.at(0)), L1 = P.bondLengths(mor.at(1));
  let worst = 0, where = -1;
  for (let k = 0; k <= 40; k++) {
    const L = P.bondLengths(mor.at(k / 40));
    for (let i = 0; i < L.length; i++) {
      /* A bond is allowed to be anywhere between what the two structures
         measured it at, and no further. Both files are experimental, so the
         two disagree by hundredths; the tolerance is that disagreement plus
         float slack, not a number chosen to make the test pass. */
      const lo = Math.min(L0[i], L1[i]) - 1e-6, hi = Math.max(L0[i], L1[i]) + 1e-6;
      const err = Math.max(lo - L[i], L[i] - hi, 0);
      if (err > worst) { worst = err; where = i; }
    }
  }
  ok('no bond stretches', worst < 1e-6,
     `worst ${worst.toExponential(1)} A at trace bond ${where}`);
}

/* ---- 5. the disulfide never opens -------------------------------------
   The page's central image, and the reason ccd() exists. 1QLZ models this
   bond at 2.016 A and 6LNI at 2.030; the constraint targets the
   interpolation of those two, so every frame in between must sit inside
   that range plus the closure tolerance.

   The endpoints alone are not the test. Without ccd() they both pass while
   the middle of the trajectory opens the bond to 25 A — a covalent bond
   drawn breaking and re-forming, which neither deposition supports. */
{
  let worst = 0, at = 0;
  for (let k = 0; k <= 40; k++) {
    const d = P.disulfide(mor.at(k / 40), 179, 214);
    const err = Math.max(2.016 - d, d - 2.030, 0);
    if (err > worst) { worst = err; at = k / 40; }
  }
  ok('S-S 179-214 never opens', worst < 0.05,
     `worst ${worst.toFixed(3)} A outside the deposited range, at t=${at.toFixed(2)}`);

  /* And the unconstrained path is asserted to FAIL, so a change that
     silently turns the constraint off cannot pass this file. */
  const loose = P.morph(nat, fib, { frames: 40, hold: false });
  let open = 0;
  for (let k = 0; k <= 40; k++) open = Math.max(open, P.disulfide(loose.at(k / 40), 179, 214));
  ok('...and would without the constraint', open > 20, `opens to ${open.toFixed(1)} A unheld`);
}

/* ---- 6. one sequence, two secondary structures -------------------------
   The lesson itself, asserted from the two files' own records rather than
   from anything this repository decided. The helices are 1QLZ's HELIX
   lines, the strands are 6LNI's SHEET lines, and the question is which
   residues each of them covers.

   THE ANSWER IS NOT "ALL OF THEM", AND THE REMAINDER IS WORTH TEACHING.
   Of the 59 residues in the core:

     25  helix in 1QLZ AND strand in 6LNI — the conversion, literally
     26  helix in 1QLZ, coil in 6LNI      — helix that unwinds to nothing
      4  coil in 1QLZ, strand in 6LNI     — 172, and 197-199
      4  coil in both                     — 170-171, 195-196

   Those four are not noise and they are not a bug. 172 is the residue
   immediately before helix H2 starts, and 197-199 sit in the native's
   H2-to-H3 linker. Both are places where the fibril's strand runs one turn
   PAST where the native's helix stopped, which is what "the sheet is
   longer than the helix was" looks like in records. The exact set is
   asserted rather than a count, so swapping either file for another
   deposition trips this rather than quietly shifting the story. */
{
  const H = P.ss(mor.count, mor.first, mor.meta.helices, 'H');
  const E = P.ss(mor.count, mor.first, mor.meta.sheets, 'E');
  const pick = f => H.map((_, i) => mor.first + i).filter((_, i) => f(H[i], E[i]));

  const both = pick((h, e) => h === 'H' && e === 'E');
  const eOnly = pick((h, e) => h !== 'H' && e === 'E');

  ok('helix becomes strand', both.length === 25,
     `${both.length} residues are H in 1QLZ and E in 6LNI`);
  ok('strand from native coil is the four known edges',
     eOnly.join(',') === '172,197,198,199', eOnly.join(', '));
}

/* ---- 7. what the morph does NOT do -------------------------------------
   Not a pass/fail. These are the numbers the bench exists to show, printed
   so a change to the interpolation cannot quietly alter them. The midpoint
   disulfide is the known open problem: prion.js reports clash and strain
   rather than relaxing them away, and until a constrained pass exists this
   line is how big the gap is. */
{
  console.log('\n  self-intersection (reported, not asserted — see ccd()\'s header)');
  let worst = 0, closest = 9, at = 0;
  for (let k = 0; k <= 40; k++) {
    const c = P.clashes(mor.at(k / 40));
    if (c.length > worst) { worst = c.length; at = k / 40; }
    for (const x of c) closest = Math.min(closest, x.d);
  }
  console.log(`    worst ${worst} clashing pairs at t=${at.toFixed(2)},` +
              ` closest approach ${closest.toFixed(2)} A`);
  console.log('    the path still passes the chain through itself in the middle.');
  console.log('    needs a repulsion term, which is a relaxation, not a closure.');
}

console.log(failed ? `\n${failed} FAILED` : '\nall assertions pass');
process.exit(failed ? 1 : 0);
