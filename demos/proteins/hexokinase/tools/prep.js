#!/usr/bin/env node
/* =====================================================================
 *  prep.js — the two hexokinase endpoints as static ribbons, for the
 *  gallery card and for anything that wants the molecule rather than
 *  the motion.
 *
 *  Run:  node proteins/hexokinase/tools/prep.js   (offline, no deps)
 *
 *  WHY THIS EXISTS BESIDE A BAKER THAT ALREADY READS THESE FILES.
 *  hexokinase/tools/bake-closure.js writes a TRAJECTORY: 41 frames of
 *  the 467 residues that align between the two entries, in HXM2, which
 *  is a format for one page. A card wants one still of one deposition
 *  in kit/proteinbox.js's shape, and the registry wants the counts that
 *  come off the whole file — the chain SEQRES declares, the EC on
 *  COMPND, the residues actually modelled. The trajectory can answer
 *  none of those: it holds the paired subset and has thrown the rest
 *  away by the time it is written.
 *
 *  THE PDBs ARE NOT COPIED. They live in hexokinase/data/ with the
 *  closure baker that pulled them, and this reads across. Two copies of
 *  a deposition is two things to keep in step, and the one that goes
 *  stale is the one nothing is run against.
 *
 *  WHERE THE CLOSED FORM SITS IS NOT DECIDED HERE. 3B8A is superposed
 *  onto 1IG8 on LOBE 1, the large one, so flipping between the two
 *  cards shows the small lobe swinging and not the crystallographers'
 *  two choices of origin. Which residues are lobe 1 is a consensus
 *  bake-closure.js solves, so it is READ BACK out of HK.closure.bin
 *  rather than solved a second time — a drifted copy of that consensus
 *  would put the card and the animation in different frames, and both
 *  would look correct.
 * ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const Bake = require('../../bake-lib.js');
const { readCA, align, superpose } = require('../../../hexokinase/tools/pdbio.js');

const HERE = path.join(__dirname, '..');
const SRC = path.join(__dirname, '..', '..', '..', 'hexokinase', 'data');
const DATA = path.join(HERE, 'data');
const CLOSURE = path.join(SRC, 'HK.closure.bin');

/* THE VIEW TABLE IS proteins/proteins.js, like every other protein here. */
const REG = require('../../proteins.js');
const IO = require('../../tools/registry-io.js');
const ME = REG.byKey('hexokinase');
const VIEWS = ME.variants;
const OPEN = ME.fit.on;

const read = id => fs.readFileSync(path.join(SRC, id + '.pdb'), 'utf8');

/* ---- lobe 1, read back out of the trajectory ------------------------
 *
 *  HXM2's header is magic, frames, N, then N residue numbers and N lobe
 *  bytes. The numbers are the OPEN entry's, in the order the alignment
 *  paired them, which is the order this file re-derives below — so the
 *  numbers are also the check that the two agree.
 */
function lobeOne() {
  const buf = fs.readFileSync(CLOSURE);
  if (buf.toString('latin1', 0, 4) !== 'HXM2')
    throw new Error('HK.closure.bin is not HXM2 — re-run bake-closure.js');
  const N = buf.readUInt16LE(6);
  const nums = [], lobes = [];
  for (let i = 0; i < N; i++) nums.push(buf.readUInt16LE(8 + i * 2));
  for (let i = 0; i < N; i++) lobes.push(buf.readUInt8(8 + N * 2 + i));
  return { N, nums, lobes };
}

/* ---- the transform that puts the closed form in the open one's frame */
function closureFit() {
  const A = readCA(read(OPEN));
  const B = readCA(read(VIEWS.find(v => v.id !== OPEN).id));
  const pairs = align(A.seq, B.seq).pairs;
  const L = lobeOne();
  if (pairs.length !== L.N)
    throw new Error(`alignment gives ${pairs.length} pairs, trajectory holds ${L.N}`);

  const PA = pairs.map(([i]) => A.ca[i]);
  const PB = pairs.map(([, j]) => B.ca[j]);
  /* The trajectory's residue numbers against this alignment's. If these
     disagree the lobe bytes are being read onto the wrong residues, and
     the render would be a plausible protein in the wrong frame. */
  for (let i = 0; i < L.N; i++)
    if (PA[i].n !== L.nums[i])
      throw new Error(`pair ${i}: trajectory says residue ${L.nums[i]}, alignment says ${PA[i].n}`);

  const on = [], two = [];
  for (let i = 0; i < L.N; i++) {
    if (L.lobes[i] === 1) on.push(i);
    else if (L.lobes[i] === 2) two.push(i);
  }
  const fit = superpose(on.map(i => PB[i]), on.map(i => PA[i]));

  /* THE HINGE IS WHAT IS LEFT OVER. With lobe 1 held still, the rotation that
     would still bring lobe 2 into place IS the closure — the same measurement
     bake-closure.js prints, made here on the same residues so the bench and
     the animation cannot quote two different angles. It is an approximation
     for a reason the registry states: these are two isozymes, so the angle is
     closure plus whatever PI and PII differ by. */
  const TB = fit.apply(PB);
  const hinge = superpose(two.map(i => TB[i]), two.map(i => PA[i]));

  /* How far each paired residue actually moved, once lobe 1 is superposed.
     The mean per lobe is the claim the bench makes in one row: one lobe holds
     still, the other swings. */
  const shift = i => Math.hypot(TB[i].x - PA[i].x, TB[i].y - PA[i].y, TB[i].z - PA[i].z);
  const rms = ix => Math.sqrt(ix.reduce((k, i) => k + shift(i) * shift(i), 0) / ix.length);
  let far = 0;
  for (let i = 0; i < L.N; i++) if (shift(i) > shift(far)) far = i;

  const motion = {
    onto: OPEN,
    paired: L.N,
    hingeDeg: Bake.r2(hinge.angle),
    lobe1: { residues: on.length, rms: Bake.r2(rms(on)) },
    lobe2: { residues: two.length, rms: Bake.r2(rms(two)) },
    furthest: { residue: PA[far].n, moved: Bake.r2(shift(far)) },
  };
  return { fit, on: on.length, paired: L.N, motion };
}

/* ---- baking one endpoint -------------------------------------------- */

function bake(v, ctx) {
  const text = read(v.source.id);
  const only = new Set(v.chains.split(','));

  let chains = Bake.caTrace(text, only);
  if (!chains.size) throw new Error(v.id + ': no CA atoms on chain ' + v.chains);

  /* The closed entry moves; the reference does not. Whole chain, by the
     transform solved on lobe 1 alone — fitting on everything would split
     the 18.6 degrees across both lobes and read as the protein writhing
     rather than as a mouth shutting. */
  const fitted = v.id !== OPEN;
  if (fitted)
    chains = new Map([...chains].map(([id, res]) => [id, ctx.fit.apply(res)]));

  const R = Bake.ssRanges(text);
  /* BOTH CENTRED ON THE OPEN FORM'S CENTROID. Re-centring each on itself
     would slide back apart most of the superposition just made, which is
     the whole of what the pair is for. */
  const T = Bake.assemble(chains, R, ctx.centre);
  if (!ctx.centre) ctx.centre = T.centre;

  const out = { source: v.source.id + '.pdb', ssFrom: Bake.ssFrom(R), centre: T.centre,
                order: T.order, chains: T.chains, radius: T.radius };

  /* ONE BASIS, WORN BY BOTH — they share a frame, so a basis per entry
     would turn the molecule on every switch and hide the closure inside
     the rotation.

     WHOSE BASIS IS THE REGISTRY'S ANSWER, not this script's. A solved
     one is right wherever the shape has axes worth solving, and wrong
     here: the two lobes give a confident long axis that puts the cleft
     edge-on, where 18.58 degrees looks like nothing. So a human picked
     one with the bench's `copy this view`, it is recorded beside every
     other decision about this protein, and the baker READS it. Solving
     over it is how a re-bake would quietly undo the choice, with the
     picture still looking like a protein. */
  const all = [];
  for (const id of out.order) for (const p of out.chains[id].CA) all.push(p);
  const F = Bake.frameOf(all);
  /* `Bake.viewFor` decides between the registry's hand-picked basis and the
     solved one, and names the result. The extents are still solved: they are a
     measurement of the shape and the panel prints them. */
  if (!ctx.picked) ctx.picked = Bake.viewFor(ME, F);
  if (ctx.picked.view) out.view = ctx.picked.view;
  out.extents = F.extents;
  out.frame = ctx.picked.frame;

  const decl = Bake.declared(text);
  out.meta = {
    entry: v.source.id, chainsDrawn: out.order.length,
    method: Bake.method(text), resolution: Bake.resolution(text),
    title: Bake.line1(text, 'TITLE'), models: Bake.models(text),
    chainsInFile: Bake.chainCount(text),
    counts: out.order.map(id => ({ chain: id, modelled: out.chains[id].nums.length,
                                   declared: decl[id] === undefined ? null : decl[id] })),
    ss: Bake.disulfides(text, only),
    ligands: Bake.ligands(text, only),
    /* The reference is fitted onto nothing and says so by omission — the
       checker reads exactly this pair of cases. The residual is a fact
       about one structure's relation to another, so it lives here rather
       than in an index of the collection. */
    fitOn: fitted ? OPEN : null,
    fitOnWhat: fitted ? `lobe 1, ${ctx.on} of ${ctx.paired} paired residues` : null,
    fitRmsd: fitted ? Bake.r2(ctx.fit.rmsd) : null,
    /* THE CLOSURE ITSELF, on the file that moved. It is a fact about this
       structure's relation to the other one, so it rides in the bake beside
       the coordinates it describes and never in the index. */
    motion: fitted ? ctx.motion : null,
  };
  out.read = {
    method: Bake.method(text),
    chainsInFile: Bake.chainCount(text),
    residues: out.meta.counts.reduce((k, c) => k + c.modelled, 0),
    declared: out.meta.counts.every(c => c.declared !== null)
      ? out.meta.counts.reduce((k, c) => k + c.declared, 0) : null,
    ec: Bake.ecNumbers(text)[0] || null,
    baked: `hexokinase-${v.id}.json`,
  };
  return out;
}

function main() {
  const { fit, on, paired, motion } = closureFit();
  console.log(`fit  3B8A onto ${OPEN} on lobe 1: ${on} of ${paired} paired residues, ` +
              `${fit.rmsd.toFixed(2)} A rmsd`);
  console.log(`hinge  ${motion.hingeDeg} deg  ` +
              `lobe 1 ${motion.lobe1.residues} res moves ${motion.lobe1.rms} A rms, ` +
              `lobe 2 ${motion.lobe2.residues} res moves ${motion.lobe2.rms} A  ` +
              `(furthest: residue ${motion.furthest.residue}, ${motion.furthest.moved} A)`);

  /* The reference first, so it sets the centre and the basis the other wears. */
  const order = [...VIEWS].sort((a, b) => (a.id === OPEN ? -1 : 0) - (b.id === OPEN ? -1 : 0));
  const ctx = { fit, on, paired, motion, centre: null, picked: null };
  const blocks = {};
  for (const v of order) {
    const out = bake(v, ctx);
    const file = out.read.baked;
    const { read: r, ...bakeOut } = out;
    fs.writeFileSync(path.join(DATA, file), JSON.stringify(bakeOut));
    blocks[v.id] = r;
    const kb = (fs.statSync(path.join(DATA, file)).size / 1024).toFixed(0);
    console.log(`${v.id}  chain ${v.chains}, ${r.residues} of ${r.declared} residues` +
      (Bake.breaks(out) ? `, ${Bake.breaks(out)} break(s)` : '') +
      `, ss ${out.ssFrom}, ${out.extents.join(' × ')} A, ` +
      `ligands [${out.meta.ligands.join(' ')}], view ${out.frame}, ` +
      (out.meta.fitOn ? `fitted (${out.meta.fitRmsd} A)` : 'reference') + `, ${kb} KB`);
  }
  const touched = IO.write('hexokinase', blocks);
  console.log(`registry  proteins.js  ${touched.length} variants updated`);
}

if (require.main === module) main();
module.exports = { bake, VIEWS };
