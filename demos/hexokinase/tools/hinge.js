/* =====================================================================
 *  hinge.js — is there a domain closure here big enough to animate?
 *
 *  The question this folder exists to answer before any baking. A blob
 *  is the honest drawing of an enzyme that barely moves; a hinge is only
 *  worth a page if the hinge is real. So: measure the angle, in degrees,
 *  off the deposited coordinates of a candidate pair.
 *
 *  METHOD. Domain decomposition without being told where the lobes are.
 *  Superpose the whole aligned trace, drop whatever moved most, superpose
 *  again on what is left, and repeat. The set that survives is the lobe
 *  that dominates the fit -- the LARGE lobe -- and it converges because a
 *  two-lobe hinge has exactly one such set. What was dropped is then the
 *  small lobe, and its own best-fit rotation, measured AFTER the large
 *  lobe is aligned, is the hinge angle.
 *
 *  Nothing here is told which residues belong to which lobe. That is the
 *  point: a hand-drawn lobe boundary would let the answer be assumed.
 *
 *  Run:  node hexokinase/tools/hinge.js
 * ===================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { readCA, align, superpose, dist, rg } = require('./pdbio.js');

const DATA = path.join(__dirname, '..', 'data');
const load = id => {
  const s = readCA(fs.readFileSync(path.join(DATA, id + '.pdb'), 'utf8'));
  s.id = id;
  s.ligands = [...s.het.keys()].filter(l => l !== 'SO4' && l !== 'HOH');
  return s;
};

/* The pairs worth testing, and why each one is here. */
const PAIRS = [
  ['1IG8', '2YHX', 'PII apo -> PII + OTG   (same isozyme; the only one)'],
  ['1IG8', '3B8A', 'PII apo -> PI + glucose (cross-isozyme; the 2008 comparison)'],
  ['1HKG', '3B8A', 'PI apo? -> PI + glucose (1HKG has no ligand record)'],
  ['1HKG', '2YHX', 'the textbook pair, measured'],
];

const INLIER = 1.5;     // angstroms; within this of its partner after a fit
const MIN_LOBE = 60;    // fewer residues than this is not a domain
const SEED_K = 30;      // residues in a seed patch
const RIGID = 1.0;      // a lobe must fit ITSELF below this, or it is not one

/* Find the largest set of residues that move together, by consensus.
 *
 * Seeding on a shrinking global cutoff (what this did first) does not
 * work: with a 2.8 A whole-molecule RMSD the survivors of a cutoff are
 * whichever residues happen to land near their partners, scattered over
 * the whole chain, and the "rotation" of a scatter is a number with no
 * meaning. It reported 70-180 degree hinges on every pair, including
 * pairs that cannot hinge.
 *
 * So seed LOCALLY instead. A spatial patch around one residue is almost
 * certainly inside a single domain, so the transform that fits the patch
 * is that domain's transform, and the residues it carries into place are
 * that domain. Every residue gets a turn as the seed and the largest
 * consensus wins -- deterministic, no sampling.
 */
function consensus(A, B, pool) {
  let best = null;
  for (const s of pool) {
    const near = [...pool]
      .sort((i, j) => dist(A[s], A[i]) - dist(A[s], A[j]))
      .slice(0, SEED_K);
    if (near.length < 12) continue;
    let set = near, last = -1, iter = 0;
    while (set.length !== last && iter++ < 20) {
      last = set.length;
      const fit = superpose(set.map(i => A[i]), set.map(i => B[i]));
      const moved = fit.apply(A);
      set = pool.filter(i => dist(moved[i], B[i]) < INLIER);
      if (set.length < 12) break;
    }
    if (set.length >= 12 && (!best || set.length > best.length)) best = set;
  }
  return best || [];
}

function decompose(A, B) {
  const all = A.map((_, i) => i);
  const lobe1 = consensus(A, B, all);
  const used = new Set(lobe1);
  const lobe2 = consensus(A, B, all.filter(i => !used.has(i)));
  return { lobe1, lobe2 };
}

/* A lobe is only a lobe if it is internally rigid: fit it to its own
 * partner and the residual must be small. This is a PRECONDITION, not a
 * diagnostic printed after the fact -- an angle measured on a non-rigid
 * set is the exact mistake this file made the first time. */
function rigidity(idx, A, B) {
  const fit = superpose(idx.map(i => A[i]), idx.map(i => B[i]));
  return { fit, rigid: fit.rmsd < RIGID };
}

function runs(idx, ca) {
  // Contiguous residue-number ranges, so the lobes can be named.
  const out = [];
  for (let k = 0; k < idx.length; k++) {
    const start = ca[idx[k]].n;
    while (k + 1 < idx.length && idx[k + 1] === idx[k] + 1) k++;
    out.push([start, ca[idx[k]].n]);
  }
  return out.filter(([a, b]) => b - a >= 8);   // ignore scatter
}

for (const [idA, idB, note] of PAIRS) {
  const A = load(idA), B = load(idB);
  const al = align(A.seq, B.seq);
  const PA = al.pairs.map(([i]) => A.ca[i]);
  const PB = al.pairs.map(([, j]) => B.ca[j]);

  console.log('='.repeat(72));
  console.log(`${idA} -> ${idB}    ${note}`);
  console.log(`  ${idA}: ${A.ca.length} res, ${A.res} A, ${A.ligands.length ? A.ligands.join('+') : 'apo'}   Rg ${rg(A.ca).toFixed(2)}`);
  console.log(`  ${idB}: ${B.ca.length} res, ${B.res} A, ${B.ligands.length ? B.ligands.join('+') : 'apo'}   Rg ${rg(B.ca).toFixed(2)}`);
  console.log(`  alignment: ${al.aligned} paired, ${(al.identity * 100).toFixed(1)}% identical`);

  if (A.unk || B.unk) {
    console.log(`  UNSEQUENCED: ${idA} has ${A.unk} UNK, ${idB} has ${B.unk}.`);
    console.log('  No residue-level correspondence the file itself asserts. Not a morph pair.');
    continue;
  }

  const whole = superpose(PA, PB);
  console.log(`  whole-molecule superposition RMSD  ${whole.rmsd.toFixed(2)} A`);

  const { lobe1, lobe2 } = decompose(PA, PB);
  if (lobe1.length < MIN_LOBE) {
    console.log(`  largest set moving together is only ${lobe1.length} res -- no domain here`);
    continue;
  }
  const r1 = rigidity(lobe1, PA, PB);
  console.log(`  lobe 1  ${lobe1.length} res, self-fit ${r1.fit.rmsd.toFixed(2)} A ${r1.rigid ? 'RIGID' : 'NOT RIGID'}`);
  console.log(`          ${JSON.stringify(runs(lobe1, PA))}`);

  if (lobe2.length < MIN_LOBE) {
    console.log(`  second lobe only ${lobe2.length} res -- one rigid body plus scatter, not a hinge`);
    continue;
  }
  const r2 = rigidity(lobe2, PA, PB);
  console.log(`  lobe 2  ${lobe2.length} res, self-fit ${r2.fit.rmsd.toFixed(2)} A ${r2.rigid ? 'RIGID' : 'NOT RIGID'}`);
  console.log(`          ${JSON.stringify(runs(lobe2, PA))}`);

  const covered = ((lobe1.length + lobe2.length) / PA.length * 100).toFixed(0);
  console.log(`  the two lobes account for ${covered}% of the chain`);

  if (!r1.rigid || !r2.rigid) {
    console.log('  NO ANGLE REPORTED: a rotation measured on a non-rigid set means nothing.');
    continue;
  }
  // The hinge: how lobe 2 must still rotate once lobe 1 is superposed.
  const onLobe1 = r1.fit.apply(PA);
  const hinge = superpose(lobe2.map(i => onLobe1[i]), lobe2.map(i => PB[i]));
  let maxd = 0;
  for (const i of lobe2) maxd = Math.max(maxd, dist(onLobe1[i], PB[i]));
  console.log(`  HINGE ANGLE  ${hinge.angle.toFixed(1)} deg`);
  console.log(`  furthest lobe-2 Ca travels  ${maxd.toFixed(1)} A`);
}
console.log('='.repeat(72));
