#!/usr/bin/env node
/* =====================================================================
 *  prep.js — the seven ribonuclease depositions down to what the bench
 *  draws, plus the handful of facts its panel prints.
 *
 *  Run:  node proteins/rnase/tools/prep.js     (offline, no dependencies)
 *
 *  WHAT A VIEW IS. One JSON per structure, in tools/bake-trace.js's shape
 *  — {order, chains:{first, nums, CA, ss, helices, strands}} — so
 *  kit/proteinbox.js draws it with no page-side parsing at all. Baked
 *  rather than parsed at runtime because parsing decides which altloc,
 *  which chain, and whether secondary structure is READ or DETECTED. It
 *  is read here, off each file's own HELIX and SHEET records: RNase A is
 *  the protein people learn folding on, and detecting its sheet would be
 *  inventing the claim.
 *
 *  WHY THESE SEVEN. RNase A is 124 residues and every entry models all
 *  124, so nothing here is a fragment and completeness is not the
 *  question. What differs between the files is what the molecule is
 *  DOING, and each view is one answer:
 *
 *    1FS3  wild type at 1.4 A, nothing bound. The fold by itself.
 *    2AAS  the same fold in solution, NMR. 32 models; model 1 is baked.
 *    1RUV  uridine vanadate in the active site — the transition state,
 *          frozen. Same ribbon as 1FS3, which is the point: catalysis
 *          moves side chains, not the backbone.
 *    1RNU  RNase S. Subtilisin cuts one bond, 20-21, and the two pieces
 *          stay bound and stay active. Residues 16-23 go unmodelled, so
 *          the break the ribbon shows is wider than the cut.
 *    1A2W  C-terminal domain-swapped dimer: two chains, each wearing the
 *          other's last strand.
 *    1F0V  N-terminal swapped dimer, the other swap, with a CpG bound.
 *          Chains A and B only — the deposition holds two dimers.
 *    1DFJ  RNase A caught by ribonuclease inhibitor, a 456-residue
 *          horseshoe. The size ratio is the whole picture.
 *
 *  SOURCES, for a re-run from scratch. The raw files live in data/src/
 *  and are 4.6 MB against the ~130 KB this bakes out of them:
 *
 *    for id in 1FS3 2AAS 1RUV 1RNU 1A2W 1F0V 1DFJ; do
 *      curl -o proteins/rnase/data/src/$id.pdb \
 *        https://files.rcsb.org/download/$id.pdb
 *    done
 *
 *  EVERY NUMBER THE PANEL PRINTS IS COUNTED HERE, off the file: the
 *  declared length from SEQRES, the disulfides from SSBOND, the ligands
 *  from HETATM. A number typed into the page is a claim nothing checks,
 *  and a re-bake falsifies it silently.
 * ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const Bake = require('../../bake-lib.js');

const HERE = path.join(__dirname, '..');
const SRC = path.join(HERE, 'data', 'src');
const DATA = path.join(HERE, 'data');

/* THE VIEW TABLE IS proteins/proteins.js. What each entry is, which chains
   are drawn, and what the bench claims about it live there with every other
   protein's; this file turns that into files under data/ and writes the
   counted half back. `said` is the human's and is read here; `read` is this
   script's and is written at the end of main().

   Not 7RSA, though it is the entry everyone cites for RNase A at 1.26 A: it
   carries no SSBOND records at all, so a bench built on it prints "no
   disulfides" for the protein whose four disulfides are the whole of the
   Anfinsen story. 1FS3 is the wild type with them. */
const REG = require('../../proteins.js');
const IO = require('../../tools/registry-io.js');
const ME = REG.byKey('rnase');
const VIEWS = ME.variants;

/* ---- baking one view ------------------------------------------------
 *
 *  Reading the file is proteins/bake-lib.js: the altloc rule, the ss ranges,
 *  SEQRES, SSBOND, HETATM, the centring and the frame. What is left here is
 *  what makes this RNase A's baker rather than a protein's — the view table
 *  above, and the meta block the panel prints.
 */

function bake(v) {
  const raw = fs.readFileSync(path.join(SRC, v.source.id + '.pdb'), 'utf8');
  const text = v.model ? Bake.modelOne(raw) : raw;
  const only = v.chains ? new Set(v.chains.split(',')) : null;

  const chains = Bake.caTrace(text, only);
  if (!chains.size) throw new Error(v.id + ': no CA atoms on those chains');
  const R = Bake.ssRanges(text);

  /* Centred over every chain drawn — the default, since nothing here is
     being fitted to anything else. 1RNU's gap at 16-23 is carried in `nums`,
     which is what lets the box break the ribbon there instead of splining a
     smooth band across eight residues nobody measured. */
  const T = Bake.assemble(chains, R);

  const out = { source: v.source.id + '.pdb', ssFrom: Bake.ssFrom(R), centre: T.centre,
                order: T.order, chains: T.chains, radius: T.radius };

  /* RNase A is a kidney bean and its three extents are close enough that a
     solved basis would flip between rebakes; frameOf writes no view for one,
     and a human picks it with the page's "copy this view". The dimers and the
     complex are longer than they are wide and do earn one. */
  const all = [];
  for (const id of out.order) for (const p of out.chains[id].CA) all.push(p);
  const F = Bake.frameOf(all);
  if (F.view) out.view = F.view;
  out.extents = F.extents;
  out.frame = F.frame;

  const decl = Bake.declared(text);
  /* What the bake carries for the page to draw with, and what goes back to
     the registry for a card to read, are the same numbers counted once. */
  out.meta = {
    entry: v.source.id, chainsDrawn: out.order.length,
    method: Bake.method(text), resolution: Bake.resolution(text),
    title: Bake.line1(text, 'TITLE'), models: Bake.models(raw),
    chainsInFile: Bake.chainCount(text),
    counts: out.order.map(id => ({ chain: id, modelled: out.chains[id].nums.length,
                                   declared: decl[id] === undefined ? null : decl[id] })),
    /* The four disulfides are why Anfinsen could pull the protein apart and
       watch it come back: eight cysteines pair 105 ways, and it finds the one
       right pairing on its own. Read off SSBOND, not counted from cysteines. */
    ss: Bake.disulfides(text, only),
    ligands: Bake.ligands(text, only),
  };
  /* THE REGISTRY'S HALF is deliberately five fields: what the collection is
     indexed and compared on. Everything else a panel wants is in the bake
     beside the coordinates it describes — resolution, title, the model count,
     the ligands — because that is where a reader of one structure looks, and
     an index that carried it all would be a second copy of every bake. */
  out.read = {
    method: Bake.method(text),
    chainsInFile: Bake.chainCount(text),
    residues: out.meta.counts.reduce((k, c) => k + c.modelled, 0),
    declared: out.meta.counts.every(c => c.declared !== null)
      ? out.meta.counts.reduce((k, c) => k + c.declared, 0) : null,
    baked: `rnase-${v.id}.json`,
  };
  return out;
}

function main() {
  const blocks = {};
  for (const v of VIEWS) {
    const out = bake(v);
    const file = out.read.baked;
    const { read, ...bakeOut } = out;
    fs.writeFileSync(path.join(DATA, file), JSON.stringify(bakeOut));
    blocks[v.id] = read;
    const kb = (fs.statSync(path.join(DATA, file)).size / 1024).toFixed(0);
    console.log(`${v.id}  ${out.order.length} chain(s), ${read.residues} residues` +
      (Bake.breaks(out) ? `, ${Bake.breaks(out)} break(s)` : '') +
      `, ss ${out.ssFrom}, ${out.extents.join(' × ')} A, ` +
      `${out.meta.ss.length} SS, ligands [${out.meta.ligands.join(' ')}], ` +
      `view ${out.frame}, ${kb} KB`);
  }
  /* The counted half goes back into proteins.js, where a card reads it. The
     said half of that file is untouched by this write. */
  const touched = IO.write('rnase', blocks);
  console.log(`registry  proteins.js  ${touched.length} variants updated`);
}

if (require.main === module) main();
module.exports = { bake, VIEWS };
