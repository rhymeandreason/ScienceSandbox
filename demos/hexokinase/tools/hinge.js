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

const CUT = 2.0;        // angstroms; a residue further than this is "moved"
const MIN_CORE = 60;    // below this the decomposition has not found a lobe

function decompose(A, B) {
  // A, B are equal-length paired Ca arrays.
  let core = A.map((_, i) => i);
  let last = -1, iter = 0;
  let fit = null;
  while (core.length !== last && core.length >= MIN_CORE && iter++ < 50) {
    last = core.length;
    fit = superpose(core.map(i => A[i]), core.map(i => B[i]));
    const moved = fit.apply(A);
    const next = [];
    for (let i = 0; i < A.length; i++) if (dist(moved[i], B[i]) < CUT) next.push(i);
    core = next;
  }
  const coreSet = new Set(core);
  const rest = A.map((_, i) => i).filter(i => !coreSet.has(i));
  return { core, rest, fit, iter };
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

  const whole = superpose(PA, PB);
  console.log(`  whole-molecule superposition RMSD  ${whole.rmsd.toFixed(2)} A`);

  const { core, rest, fit } = decompose(PA, PB);
  if (!fit || core.length < MIN_CORE) {
    console.log('  no two-lobe decomposition converged -- not a hinge pair');
    continue;
  }
  console.log(`  large lobe ${core.length} res, RMSD ${fit.rmsd.toFixed(2)} A   ${JSON.stringify(runs(core, PA))}`);
  console.log(`  small lobe ${rest.length} res                        ${JSON.stringify(runs(rest, PA))}`);

  if (rest.length < 20) {
    console.log('  small lobe too small to be a domain -- the difference is local, not a closure');
    continue;
  }
  // The hinge: how the small lobe alone must rotate, once the large lobe is fixed.
  const small = superpose(rest.map(i => PA[i]), rest.map(i => PB[i]));
  const movedAll = fit.apply(PA);
  let maxd = 0;
  for (const i of rest) maxd = Math.max(maxd, dist(movedAll[i], PB[i]));
  console.log(`  HINGE ANGLE  ${small.angle.toFixed(1)} deg`);
  console.log(`  small lobe internal RMSD after its own fit  ${small.rmsd.toFixed(2)} A  (rigid if small)`);
  console.log(`  furthest small-lobe atom travels  ${maxd.toFixed(1)} A`);
}
console.log('='.repeat(72));
