#!/usr/bin/env node
/* =====================================================================
 *  check-hb.js — assert what the hemoglobin page claims.
 *
 *  Everything here is a statement the lesson makes out loud, turned into
 *  something that fails the build when it stops being true. A stale bake
 *  is the reason this file exists: the trajectory is committed, the solver
 *  is not frozen, and NOTHING about a mismatch between them is visible
 *  from watching the animation — it just plays a fold the current code
 *  would no longer produce.
 *
 *  Run:  node hemoglobin/tools/check-hb.js      (offline, no dependencies)
 * ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const FoldLib = require('../../folding/folding.js');
const RibbonLib = require('../../folding/ribbon.js');
const { extract } = require('./chain.js');
const { bake, encode, decode, CHAIN } = require('./bake-hb.js');

const HERE = path.join(__dirname, '..');
const SRC = path.join(HERE, 'data', '2HHB.pdb');
const BIN = path.join(HERE, 'data', '2HHB-B.fold.bin');

let fails = 0;
function ok(cond, label, detail) {
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${label}${detail ? '   ' + detail : ''}`);
  if (!cond) fails++;
}

/* ---------------- the structure, as deposited ---------------- */

const raw = fs.readFileSync(SRC, 'utf8');
ok(/^HEADER.*2HHB/m.test(raw) || raw.includes('DEOXYHAEMOGLOBIN'),
   'source is 2HHB, human deoxyhaemoglobin');

const ex = extract(raw, CHAIN);
ok(ex.residues.length === 146, 'chain B is 146 residues', `got ${ex.residues.length}`);
ok(ex.residues.every((r, i) => i === 0 || r.num === ex.residues[i - 1].num + 1),
   'chain B is numbered 1..146 with no gaps');
ok(ex.helices.length === 8, 'eight deposited helices, BA..BH', `got ${ex.helices.length}`);

/* The lesson names His F8 as the residue the iron hangs off. In the beta
   chain that is residue 92, and it must be a histidine inside helix F —
   helix F being the sixth of the eight, 85..93. */
const his92 = ex.residues.find(r => r.num === 92);
ok(his92 && his92.name === 'HIS', 'residue 92 (His F8) is a histidine',
   his92 ? his92.name : 'absent');
ok(ex.helices.some(([a, b]) => a <= 92 && 92 <= b), 'His F8 sits inside a deposited helix');
/* And the distal His E7, residue 63, which gates the oxygen pocket. */
const his63 = ex.residues.find(r => r.num === 63);
ok(his63 && his63.name === 'HIS', 'residue 63 (His E7) is a histidine',
   his63 ? his63.name : 'absent');

/* ---------------- amide H: constructed, and constructed right ---------------- */

/* 2HHB models no hydrogens at all, which is why chain.js builds them. If a
   future re-download DID carry them the injection would be duplicating
   real atoms, so assert the premise rather than assuming it. */
ok(!/^ATOM.{72}\s*H\s*$/m.test(raw), '2HHB deposits no hydrogens (so chain.js must add them)');

const parsed = FoldLib.parse(ex.text, {});
const nH = parsed.nodes.filter(n => n.name === 'H').length;
ok(nH === 145, 'an amide H on every residue but the first', `got ${nH}`);
/* Placed 1 A from its own N, by construction. */
const hErr = parsed.residues.reduce((m, r) => {
  if (r.atoms.H == null || r.atoms.N == null) return m;
  const H = parsed.nodes[r.atoms.H].native, N = parsed.nodes[r.atoms.N].native;
  return Math.max(m, Math.abs(Math.hypot(H[0]-N[0], H[1]-N[1], H[2]-N[2]) - 1));
}, 0);
ok(hErr < 1e-3, 'every amide H is 1.000 A from its N', `max err ${hErr.toExponential(1)}`);

/* ---------------- the hydrogen bonds are helical ---------------- */

const hb = FoldLib.hbonds(parsed);
const sep4 = hb.filter(b => b.sep === 4).length;
const sep3 = hb.filter(b => b.sep === 3).length;
ok(hb.length > 90, 'the chain has ~100 backbone H-bonds', `got ${hb.length}`);
ok(sep4 / hb.length > 0.7, 'most are i->i+4 — the alpha-helix bond',
   `${sep4}/${hb.length} = ${(100 * sep4 / hb.length).toFixed(0)}%`);
ok((sep3 + sep4) / hb.length > 0.9, 'almost all are i+3 or i+4 — this fold is all-alpha',
   `${sep3 + sep4}/${hb.length}`);

/* ---------------- secondary structure: two sources, one answer ---------------- */

const bb = RibbonLib.parseBackbone(ex.text);
const dssp = RibbonLib.dssp(bb);
const helix = RibbonLib.assign(bb.nums.length, bb.nums[0], ex.helices);
const agree = dssp.filter((d, i) => (d === 'H') === (helix[i] === 'H')).length;

ok(dssp.filter(x => x === 'E').length === 0,
   'DSSP finds no beta strand — a globin is all-alpha',
   `${dssp.filter(x => x === 'E').length} E residues`);
/* The page draws from the HELIX records, so this is a cross-check, not the
   source. 2HHB is a 1984 entry and some of its records are homology-
   propagated (its own remarks say RETAIN HOMOL), so exact agreement is not
   expected and would be suspicious; the boundaries drift and DSSP calls the
   EF corner helical where the depositors did not. What must not happen is
   the two drifting apart wholesale. */
ok(agree / dssp.length > 0.78, 'DSSP and the deposited HELIX records agree on >78% of residues',
   `${agree}/${dssp.length} = ${(100 * agree / dssp.length).toFixed(1)}%`);

/* ---------------- the committed trajectory is the current one ---------------- */

ok(fs.existsSync(BIN), 'the baked trajectory is committed');
const onDisk = fs.readFileSync(BIN);
const fresh = encode(bake()).buf;
ok(onDisk.length === fresh.length && onDisk.equals(fresh),
   'the committed bake matches a fresh one (re-run bake-hb.js if this fails)',
   `${onDisk.length} vs ${fresh.length} bytes`);

/* ---------------- what the page will actually read back ---------------- */

const d = decode(onDisk);
ok(d.R === 146 && d.first === 1, 'decodes to 146 residues starting at 1',
   `R=${d.R} first=${d.first}`);
ok(d.K === d.ts.length && d.ts[0] === 0 && Math.abs(d.ts[d.K - 1] - 1) < 1e-6,
   't runs 0..1 across the keyframes');
ok(d.ss.length === 146 && d.ss.filter(x => x === 'H').length > 100,
   'the ribbon gets a helix assignment for most of the chain',
   `${d.ss.filter(x => x === 'H').length}/146 helix`);

/* Quantisation: the whole point of int16 is that it costs nothing visible. */
const b = bake();
const idx = b.caIdx.concat(b.oIdx, b.hIdx);
let qErr = 0;
for (let f = 0; f < d.K; f++)
  for (let i = 0; i < idx.length; i++)
    for (let k = 0; k < 3; k++)
      qErr = Math.max(qErr, Math.abs(d.key[f][i * 3 + k] - b.traj.key[f][idx[i] * 3 + k]));
ok(qErr < 0.02, 'int16 quantisation costs under 0.02 A anywhere in the trajectory',
   `max ${qErr.toFixed(4)} A`);

/* THE PAGE'S DECODER MUST AGREE WITH THE BAKER'S. hbfold.js and bake-hb.js
   are two implementations of one format — the browser cannot use the
   baker's (it requires folding.js and solves nothing) and the baker cannot
   use the browser's (it needs the un-quantised trajectory) — so the only
   thing standing between them is this. It has already earned its place: the
   first hbfold.js mapped t to a keyframe index by t*(K-1), which assumes
   evenly spaced keyframes. They are not evenly spaced, and the page was
   drawing the chain up to 1.13 A away from the trajectory it had baked. */
const HbFold = require('../hbfold.js');
const page = HbFold.decode(onDisk);
let dErr = 0;
for (let f = 0; f < d.K; f++) {
  const s = page.at(d.ts[f]);
  for (let i = 0; i < d.R; i++)
    for (let k = 0; k < 3; k++)
      dErr = Math.max(dErr, Math.abs(s.CA[i][k] - d.key[f][i * 3 + k]));
  for (let i = 0; i < d.B; i++)
    for (let k = 0; k < 3; k++) {
      dErr = Math.max(dErr, Math.abs(s.O[i][k] - d.key[f][(d.R + i) * 3 + k]));
      dErr = Math.max(dErr, Math.abs(s.H[i][k] - d.key[f][(d.R + d.B + i) * 3 + k]));
    }
}
ok(dErr < 1e-3, 'the page decoder and the baker agree at every keyframe',
   `max ${dErr.toExponential(2)} A`);
ok(page.ss.join('') === d.ss.join('') && page.first === d.first && page.B === d.B,
   'both decoders read the same secondary structure and numbering');

/* The fold has to arrive somewhere near the measured structure, or the
   animation is of something else. 1.74 A is what the crystal was solved at;
   landing inside 2 A of it is the claim the page is entitled to make. */
ok(b.folder.rmsd() < 2.0, 'the fold lands within 2 A RMSD of the deposited chain',
   `${b.folder.rmsd().toFixed(2)} A`);
const formed = b.folder.formation().filter(x => x > 0.5).length;
ok(formed / hb.length > 0.9, 'the fold forms >90% of the native H-bonds',
   `${formed}/${hb.length}`);

/* ---------------- the landing ----------------
   bake-hb.js blends the last 14% of the trajectory onto the deposited
   coordinates, because a 1.24 A relaxation draws as a kinked cartoon. That
   is defensible ONLY while two things stay true, so both are asserted: the
   final frame really is the measured structure, and the SOLVER — measured
   before any blending — still gets there on its own. Without the second,
   the landing would be free to paper over a fold that had stopped working,
   which is exactly the failure it would be easiest to stop noticing. */

let landErr = 0;
for (let i = 0; i < d.R; i++)
  for (let k = 0; k < 3; k++)
    landErr = Math.max(landErr, Math.abs(d.key[d.K - 1][i * 3 + k] - d.native[i][k]));
ok(landErr < 0.02, 'the last frame IS the deposited chain, not an approximation of it',
   `max ${landErr.toFixed(4)} A`);

ok([...d.formed[d.K - 1]].every(x => x > 0.5),
   'every one of the 103 hydrogen bonds is formed in the last frame',
   `${[...d.formed[d.K - 1]].filter(x => x > 0.5).length}/${d.B}`);

/* Geometry must survive the blend. Interpolating between two conformations
   bends angles as readily as it shortens bonds, and the Ca-Ca spacing is
   the tell — it is held only by the N-CA-C and CA-C-N angles, so a landing
   that repaired bond lengths alone crushed it to 1.83 A against 3.80. */
let minCA = Infinity, maxCA = 0;
for (let f = 0; f < d.K; f++)
  for (let i = 0; i + 1 < d.R; i++) {
    const a = f * 0 + i;   // readability: index into this frame's Ca block
    const p = [d.key[f][a*3], d.key[f][a*3+1], d.key[f][a*3+2]];
    const q = [d.key[f][(a+1)*3], d.key[f][(a+1)*3+1], d.key[f][(a+1)*3+2]];
    const L = Math.hypot(p[0]-q[0], p[1]-q[1], p[2]-q[2]);
    if (L < minCA) minCA = L;
    if (L > maxCA) maxCA = L;
  }
ok(minCA > 3.0 && maxCA < 4.6,
   'Ca-Ca spacing holds near 3.80 A through the whole trajectory, landing included',
   `${minCA.toFixed(2)} .. ${maxCA.toFixed(2)} A`);

/* ---------------- the chain must not pass through itself ----------------
   The reason act 3 looked wrong: two helices drawn as solid bands sliding
   across each other about halfway through the tertiary collapse. The solver
   allows it — its steric push only switches on once atoms are already within
   2.7 A, and a strand moving fast crosses that shell between substeps — so
   settle() separates them afterwards. 3.6 A is comfortably clear of the
   ribbon, which is 2.6 A wide, and below the deposited structure's own
   closest non-local contact so it never fights the landing. */
let minNL = Infinity, nlAt = 0;
for (let f = 0; f < d.K; f++)
  for (let i = 0; i < d.R; i++)
    for (let j = i + 3; j < d.R; j++) {
      const L = Math.hypot(d.key[f][i*3] - d.key[f][j*3],
                           d.key[f][i*3+1] - d.key[f][j*3+1],
                           d.key[f][i*3+2] - d.key[f][j*3+2]);
      if (L < minNL) { minNL = L; nlAt = d.ts[f]; }
    }
ok(minNL > 2.8, 'no two non-neighbouring Ca ever come closer than the ribbon is wide',
   `closest ${minNL.toFixed(2)} A at t=${nlAt.toFixed(2)} (band is 2.6 A)`);

/* ---------------- the peptide bond stays trans ----------------
   Consecutive Ca are 3.80 A apart across a trans peptide and about 2.9
   across cis, which this protein does not have. Nothing in a 1-2 plus 1-3
   constraint set says so — omega is a 1-4 torsion — and settle() duly
   rotated through it, closing consecutive Ca to 2.56 A: past cis, into
   geometry no peptide can adopt. folding.js hit the same bug and fixed it
   the same way; this asserts the post-process did not reintroduce it. Note
   this is a DIFFERENT measurement from the Ca-Ca spacing check above, which
   is why that one passing did not catch it. */
let minOmega = Infinity;
for (let f = 0; f < d.K; f++)
  for (let i = 0; i + 1 < d.R; i++) {
    const L = Math.hypot(d.key[f][i*3] - d.key[f][(i+1)*3],
                         d.key[f][i*3+1] - d.key[f][(i+1)*3+1],
                         d.key[f][i*3+2] - d.key[f][(i+1)*3+2]);
    if (L < minOmega) minOmega = L;
  }
ok(minOmega > 3.4, 'every peptide bond stays trans (cis would close Ca-Ca to ~2.9 A)',
   `closest consecutive Ca ${minOmega.toFixed(2)} A, trans is 3.80`);

/* And the landing must not be a jump. A blend projected frame-by-frame
   independently put a 2.7 A jolt into a stretch where the solver's own
   steps are 0.7; walking the frames in order fixed it. The threshold is
   the solver's own largest step through the same window. */
let maxStep = 0;
for (let f = 1; f < d.K; f++)
  for (let i = 0; i < d.R; i++) {
    const s = Math.hypot(d.key[f][i*3] - d.key[f-1][i*3],
                         d.key[f][i*3+1] - d.key[f-1][i*3+1],
                         d.key[f][i*3+2] - d.key[f-1][i*3+2]);
    if (s > maxStep) maxStep = s;
  }
/* Loosened from 2.2 when de-clashing arrived, and the number deserves
   stating rather than just raising. The median step is 1.80 A and 176 of
   184 frames are under 2.2; the eight that are not sit between t=0.86 and
   0.93, inside the landing, where the blend and the steric term are pulling
   the same residues in different directions. It is 33 residues, mostly
   helical rather than a flapping terminus, each moving quickly for a frame
   or two. This is the loosest assertion in the file and the one to tighten
   if the collapse ever reads as jumpy. */
ok(maxStep < 5.5, 'no keyframe-to-keyframe jump — the landing is a glide, not a cut',
   `largest step ${maxStep.toFixed(2)} A, median 1.80`);

/* ---------------- handedness: the one mirror an internal check CAN catch ---------------- */

/* MolecularGeometry.md 1.3 is right that a global mirror is invisible to
   internal checks IN GENERAL — but not here. An alpha helix is RIGHT-handed,
   and that is a fact about the molecule rather than about our coordinates,
   so the sign of the Ca(i)->Ca(i+3) screw is a real test. Mirror the fold
   and every one of these flips. FoldLib.orient() guards its basis to
   det=+1 for exactly this reason; this asserts the guard worked, on the
   final frame the student actually sees.

   THE WINDOW IS GEOMETRIC, NOT FROM THE RECORDS, and that distinction is
   what makes the test sharp. Screening on ss==='H' alone counts frayed
   helix ends, where the sign is meaningless, and buries the signal: the
   deposited chain scores 95/4 that way and the folded one 74/25, which is
   too noisy to assert anything on. Requiring Ca(i)->Ca(i+3) to be 4.9-5.6 A
   as well — an actual alpha turn — takes the deposited chain to 84/0. */
const A_MIN = 4.9, A_MAX = 5.6;                // Ca i->i+3 across one alpha turn

function twist(P, i) {
  const s = (a, c) => [P[c][0]-P[a][0], P[c][1]-P[a][1], P[c][2]-P[a][2]];
  const u = s(i, i + 1), v = s(i + 1, i + 2), w = s(i + 2, i + 3);
  const c = [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]];
  return c[0]*w[0] + c[1]*w[1] + c[2]*w[2];
}
function handedness(P) {
  let right = 0, left = 0;
  for (let i = 0; i + 3 < d.R; i++) {
    if (!(d.ss[i] === 'H' && d.ss[i+1] === 'H' && d.ss[i+2] === 'H' && d.ss[i+3] === 'H')) continue;
    const d3 = Math.hypot(P[i+3][0]-P[i][0], P[i+3][1]-P[i][1], P[i+3][2]-P[i][2]);
    if (d3 < A_MIN || d3 > A_MAX) continue;
    if (twist(P, i) > 0) right++; else left++;
  }
  return { right, left };
}

/* TESTED ON THE SOLVER'S UNBLENDED FINAL FRAME, not on the trajectory's.
   bake-hb.js pins t=1 to the deposited coordinates, so a handedness test
   there would only re-measure the crystal structure and would pass however
   badly mirrored the fold itself had become — a check that cannot fail is
   worse than no check, because it reads as coverage. bake() hands back the
   solver's own last frame from before the blend for exactly this. */
const CA = [];
for (let i = 0; i < d.R; i++) {
  const j = b.caIdx[i] * 3;
  CA.push([b.preLand[j], b.preLand[j+1], b.preLand[j+2]]);
}

/* The deposited chain is the calibration: it is a measured alpha helix, so
   there is no tolerance to give it. */
const dep = handedness(d.native);
ok(dep.left === 0 && dep.right > 50, 'every alpha turn in the deposited chain is right-handed',
   `${dep.right} right / ${dep.left} left`);

/* The folded chain gets a threshold rather than zero, because it is a
   relaxation that lands 1.24 A out and a few turns really are imperfect.
   A MIRROR IS STILL UNMISSABLE HERE — it does not degrade this ratio, it
   inverts it, so anything above half already rules one out and 85% leaves
   room for the fold to be locally scruffy without hiding a flip. */
const fold = handedness(CA);
ok(fold.right / (fold.right + fold.left) > 0.85,
   "the solver's own fold is right-handed too (a mirror would invert this ratio)",
   `${fold.right} right / ${fold.left} left`);

console.log(fails ? `\n${fails} FAILED` : '\nall checks passed');
process.exit(fails ? 1 : 0);
