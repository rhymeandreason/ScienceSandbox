#!/usr/bin/env node
/* =====================================================================
 *  bake-hbs.js — sickle haemoglobin, baked to sit ON TOP of the normal one.
 *
 *  2HBS tetramer 1 (chains A-D)  ->  hemoglobin/data/2HBS-T1-quaternary.json
 *                                    hemoglobin/data/2HBS-T1.surf.bin
 *
 *  This exists so surface-test.html can A/B one molecule against the other.
 *  Everything about it is in service of making that comparison HONEST,
 *  which turns out to be three separate problems.
 *
 * ---------------------------------------------------------------------
 *  1. THE FRAME, AND WHY IT IS NOT BAKED IN
 * ---------------------------------------------------------------------
 *  2HHB's files are rotated into the frame FoldLib.orient() solved from
 *  chain B. 2HBS knows nothing about that frame — it is a different
 *  crystal, in a different setting, and its tetramer 1 sits wherever the
 *  crystallographers' cell put it. Toggle the two meshes raw and you see
 *  a large, dramatic, entirely meaningless difference: the molecule has
 *  moved and turned, and the one-residue substitution you were looking
 *  for is invisible underneath that.
 *
 *  So a rigid motion is needed. It is NOT applied to the coordinates
 *  here. This file writes 2HBS in 2HBS's own frame and stores the motion
 *  as an `align` field — {R, t, rmsd} — which the page applies as a group
 *  transform at draw time.
 *
 *  That is deliberate and it is the repo's preference for view rotations
 *  generally. A baked-in rotation is a fact about the bake that nothing
 *  downstream can see or undo: bake-quaternary.js's header comment is a
 *  long warning about exactly that trap, paid for once already. An
 *  additive field is inspectable (it is four numbers in a JSON you can
 *  read), reversible (drop the group transform and you have the crystal
 *  back), and it keeps the deposited coordinates deposited.
 *
 *  NOTHING 2HHB OWNS IS TOUCHED. hemoglobin-lab.html and its folding
 *  trajectory read the same three files they always did, unchanged.
 *
 * ---------------------------------------------------------------------
 *  2. THE GRID MUST MATCH, OR THE COMPARISON IS OF GRIDS
 * ---------------------------------------------------------------------
 *  sickle/data/2HBS-T1.surf.bin already exists and is the same tetramer —
 *  but it is baked at 1.1 A spacing, because it gets instanced 420 times
 *  in a fibre. 2HHB's is 0.7 A. Flip between a 0.7 mesh and a 1.1 mesh
 *  and you are looking at marching-cubes resolution, not at chemistry:
 *  the coarser skin is visibly smoother, its area reads ~4% low, and
 *  every one of those differences would be read as "so THAT is what the
 *  mutation does".
 *
 *  Hence a second bake of the same atoms at 0.7, written somewhere else.
 *  The two files are not redundant; they answer different questions and
 *  the fibre one must stay coarse.
 *
 * ---------------------------------------------------------------------
 *  3. WHAT THE ANSWER ACTUALLY IS
 * ---------------------------------------------------------------------
 *  HbA and HbS differ by one residue per beta chain: beta6 Glu -> Val.
 *  Two atoms' worth of side chain, on the surface, out of ~4550. The
 *  RMSD this file prints is the honest statement of what a student will
 *  see when they toggle — and it is a fraction of an angstrom, which
 *  means the correct outcome of the experiment is "they look the same".
 *
 *  That is not a negative result. It is the lesson: sickle-cell disease
 *  is not a misshapen protein. The fold is fine. What changed is one
 *  patch of surface chemistry — a charged glutamate swapped for a greasy
 *  valine — which is why the `hydro` and `beta6` colour modes on the
 *  page are where the difference lives, and the silhouette is not.
 *
 *  Run:  node hemoglobin/tools/bake-hbs.js [--spacing 0.7]
 * ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const SES = require('../../tools/ses.js');
const { extract } = require('./chain.js');
const { kabsch } = require('../../sickle/tools/bake-sickle.js');
const { bakeQuaternary, IDENTITY, rotation, apply } = require('./bake-quaternary.js');
const { readAtoms, tagResidues, encode } = require('./bake-surface.js');

const HERE = path.join(__dirname, '..');
const HBA = path.join(HERE, 'data', '2HHB.pdb');
const HBS = path.join(HERE, 'data', '2HBS.pdb');
const OUT_Q = path.join(HERE, 'data', '2HBS-T1-quaternary.json');
const OUT_S = path.join(HERE, 'data', '2HBS-T1.surf.bin');

/* Match hemoglobin/data/2HHB.surf.bin exactly — see "the grid must match". */
const SPACING = 0.7;

/* 2HBS's asymmetric unit is TWO tetramers, A-D and E-H. Tetramer 1 is the
   one sickle/ already treats as the fibre's repeating body, so using it
   here keeps one tetramer meaning one thing across the repo.

   Chain roles are the same as 2HHB's: A and C alpha, B and D beta, and B
   is the beta chain the page folds. That is not a coincidence to rely on
   blindly, so it is asserted below rather than assumed. */
const FOLDED = 'B';
const OTHERS = [
  { id: 'A', kind: 'alpha' },
  { id: 'C', kind: 'alpha' },
  { id: 'D', kind: 'beta'  },
];
const T1 = new Set([FOLDED, ...OTHERS.map(c => c.id)]);

/* ------------------------------------------------------------------ *
 *  the alignment
 * ------------------------------------------------------------------ *
 *  Matched CA, by chain letter and residue number, 2HBS -> 2HHB-in-its-
 *  oriented-frame. Chain letters line up because the two entries use the
 *  same convention; residue numbers are matched rather than zipped
 *  positionally, because 2.05 A 2HBS models a handful of residues that
 *  1.74 A 2HHB does not and a positional zip would silently shift the
 *  register by one for the rest of the chain.
 *
 *  CA only. Including side chains would let beta6's own substitution pull
 *  on the very fit whose job is to make that substitution visible.
 */
function alignment() {
  const rawA = fs.readFileSync(HBA, 'utf8');
  const rawS = fs.readFileSync(HBS, 'utf8');
  const R = rotation();                       // 2HHB's baked frame

  const P = [], Q = [];
  for (const id of [FOLDED, ...OTHERS.map(c => c.id)]) {
    const a = new Map(), s = new Map();
    for (const res of extract(rawA, id).residues) if (res.atoms.CA) a.set(res.num, res.atoms.CA);
    for (const res of extract(rawS, id).residues) if (res.atoms.CA) s.set(res.num, res.atoms.CA);
    for (const [num, ca] of s) {
      if (!a.has(num)) continue;
      P.push(ca);                             // 2HBS, crystal frame
      Q.push(apply(R, a.get(num)));           // 2HHB, page frame
    }
  }
  if (P.length < 500) throw new Error(`only ${P.length} matched CA — chain letters may not correspond`);

  const fit = kabsch(P, Q);
  return { R: fit.R, t: fit.t, rmsd: fit.rmsd, n: P.length };
}

/* ------------------------------------------------------------------ *
 *  beta6 — the substitution itself, read out rather than typed
 * ------------------------------------------------------------------ */
function beta6(raw, chains) {
  const out = {};
  for (const id of chains) {
    const res = extract(raw, id).residues.find(r => r.num === 6);
    if (!res) throw new Error(`chain ${id} has no residue 6`);
    out[id] = res.name;
  }
  return out;
}

/* ------------------------------------------------------------------ */

function main() {
  const argS = process.argv.indexOf('--spacing');
  const spacing = argS > 0 ? +process.argv[argS + 1] : SPACING;

  const rawS = fs.readFileSync(HBS, 'utf8');
  const rawA = fs.readFileSync(HBA, 'utf8');

  /* The claim the whole page rests on, checked before anything is written:
     the two beta chains carry VAL at 6 in 2HBS and GLU at 6 in 2HHB. If
     that is not true, either the chain letters do not correspond or the
     wrong file is on disk, and every difference downstream is spurious. */
  const s6 = beta6(rawS, ['B', 'D']), a6 = beta6(rawA, ['B', 'D']);
  for (const id of ['B', 'D']) {
    if (s6[id] !== 'VAL') throw new Error(`2HBS chain ${id} residue 6 is ${s6[id]}, expected VAL`);
    if (a6[id] !== 'GLU') throw new Error(`2HHB chain ${id} residue 6 is ${a6[id]}, expected GLU`);
  }
  console.log(`beta6:  2HHB B/D = ${a6.B}  ->  2HBS B/D = ${s6.B}`);

  const align = alignment();
  console.log(`align:  ${align.n} matched CA, rmsd ${align.rmsd.toFixed(2)} A ` +
              `(2HBS tetramer 1 -> 2HHB's oriented frame)`);
  if (align.rmsd > 1.5)
    throw new Error(`rmsd ${align.rmsd.toFixed(2)} A is too large for two copies of ` +
                    `the same protein — the match is probably mis-registered`);

  const r4 = v => Math.round(v * 10000) / 10000;
  const alignField = {
    R: align.R.map(row => row.map(r4)), t: align.t.map(r4),
    rmsd: +align.rmsd.toFixed(3), n: align.n,
    note: 'ADDITIVE. Applied by the page as a group transform (y = R x + t), ' +
          'never baked into the coordinates below. Carries 2HBS tetramer 1 ' +
          'from its own crystal frame onto 2HHB as hemoglobin/data holds it.',
  };

  /* ---- 1. the ribbon ---- */
  const quat = bakeQuaternary({
    src: HBS, folded: FOLDED, others: OTHERS, R: IDENTITY,
    meta: {
      source: '2HBS', method: 'X-ray 2.05 A, deoxy HbS',
      note: 'tetramer 1 (A-D) of 2HBS in the CRYSTAL\'S OWN frame. The ' +
            'rotation onto 2HHB is the additive `align` field, not baked in.',
      align: alignField,
      beta6: s6,
    },
  });
  fs.writeFileSync(OUT_Q, JSON.stringify(quat));
  console.log(`ribbon: ${Object.keys(quat.chains).length} placed chains, ` +
              `${Object.keys(quat.heme).length} hemes, ` +
              `${(fs.statSync(OUT_Q).size / 1024).toFixed(0)} KB  -> ` +
              ` ${path.relative(process.cwd(), OUT_Q)}`);

  /* ---- 2. the surface ---- */
  const { atoms, residues, skipped } = readAtoms(rawS, IDENTITY);
  const keep = atoms.filter(a => T1.has(residues[a.res].chain));
  console.log(`surf:   ${keep.length} atoms over ${new Set(keep.map(a => a.res)).size} residues ` +
              `(chains ${[...T1].sort().join('')}); ` +
              `excluded het ${[...skipped].map(([k, v]) => `${k} x${v}`).join(', ') || 'none'}`);

  const t0 = Date.now();
  const mesh = SES.build(keep, { spacing, probe: SES.PROBE });
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  const { volume, area } = SES.measure(mesh);
  const wt = SES.watertight(mesh);
  console.log(`        grid ${mesh.dims.join(' x ')} at ${spacing} A  ->  ` +
              `${mesh.nVert} verts, ${mesh.nTri} tris in ${secs}s`);
  console.log(`        area ${area.toFixed(0)} A^2, volume ${volume.toFixed(0)} A^3`);
  if (!wt.ok) throw new Error(`mesh is not closed: ${wt.bad} unpaired edges`);
  if (volume <= 0) throw new Error('mesh is inside out');

  const resIdx = tagResidues(mesh, keep);
  const buf = encode(mesh, resIdx, residues, {
    source: '2HBS',
    spacing, probe: SES.PROBE, radii: 'Bondi 1964 (N: Rowland & Taylor 1996)',
    atoms: keep.length, area: +area.toFixed(1), volume: +volume.toFixed(1),
    chains: [...T1].sort().join(''),
    align: alignField,
    note: 'tetramer 1 (A-D) of 2HBS in the crystal\'s own frame, at the SAME ' +
          '0.7 A grid as 2HHB.surf.bin so the two can be compared. ' +
          'sickle/data/2HBS-T1.surf.bin is the same atoms at 1.1 A for the ' +
          'fibre, and is not interchangeable with this.',
  });
  fs.writeFileSync(OUT_S, buf);
  console.log(`        wrote ${path.relative(process.cwd(), OUT_S)}  ` +
              `${(buf.length / 1024).toFixed(0)} KB`);
}

if (require.main === module) main();
module.exports = { alignment, FOLDED, OTHERS, T1 };
