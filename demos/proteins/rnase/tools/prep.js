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

/* id, chains to draw (null = every chain), and the one judgement in the
   file: what the reader is looking at. Kept beside the data it describes
   rather than in the panel, where nothing could check it against the
   structure it labels. */
const VIEWS = [
  { id: '1FS3', chains: null, kind: 'fold',
    claim: 'Bovine pancreatic RNase A, wild type, nothing bound.',
    prov: 'X-ray at 1.4 A. The reference fold: three helices over a long curled sheet, four disulfides.' },
  { id: '2AAS', chains: null, kind: 'fold', model: 1,
    claim: 'The same protein in solution, by NMR.',
    prov: '32 deposited models; this is model 1, and it is not more real than model 12. The crystal fold and the solution fold agree.' },
  { id: '1RUV', chains: null, kind: 'act',
    claim: 'Uridine vanadate in the active site — the transition state, held still.',
    prov: 'X-ray at 1.25 A. Vanadium fakes the five-coordinate phosphorus RNA passes through, so the enzyme cannot finish the reaction and will not let go.' },
  { id: '1RNU', chains: null, kind: 'cut',
    claim: 'RNase S: one backbone bond cut, and the protein still works.',
    prov: 'Subtilisin cuts between residues 20 and 21. The 20-residue S-peptide stays bound to the S-protein and the pair is active. Residues 16-23 are unmodelled, so the gap drawn is wider than the cut.' },
  { id: '1A2W', chains: 'A,B', kind: 'swap',
    claim: 'Two molecules, each folded around the other’s C-terminal strand.',
    prov: 'Domain swapping: the same contacts as the monomer, made between chains instead of within one. The hinge is the loop around 112-115.' },
  { id: '1F0V', chains: 'A,B', kind: 'swap',
    claim: 'The other swap: the N-terminal helix traded instead.',
    prov: 'Chains A and B of a deposition holding two dimers, with a CpG dinucleotide bound on chains M-P, which the bench does not draw. One protein, two different ways to come apart and re-fold as a pair.' },
  { id: '1DFJ', chains: null, kind: 'bound',
    claim: 'RNase A held by ribonuclease inhibitor, the protein that keeps it off your own RNA.',
    prov: 'A 456-residue leucine-rich horseshoe closing on a 124-residue enzyme. One of the tightest protein-protein complexes known.' },
];

/* ---- baking one view ------------------------------------------------
 *
 *  Reading the file is proteins/bake-lib.js: the altloc rule, the ss ranges,
 *  SEQRES, SSBOND, HETATM, the centring and the frame. What is left here is
 *  what makes this RNase A's baker rather than a protein's — the view table
 *  above, and the meta block the panel prints.
 */

function bake(v) {
  const raw = fs.readFileSync(path.join(SRC, v.id + '.pdb'), 'utf8');
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

  const out = { source: v.id + '.pdb', ssFrom: Bake.ssFrom(R), centre: T.centre,
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
  out.meta = {
    entry: v.id, kind: v.kind, claim: v.claim, prov: v.prov,
    title: Bake.line1(text, 'TITLE'),
    method: Bake.method(text),
    models: Bake.models(raw),
    chainsInFile: Bake.chainCount(text),
    chainsDrawn: out.order.length,
    /* Per drawn chain: modelled residues against what SEQRES declares. The
       panel phrases completeness off this pair, never off a length typed
       anywhere. */
    counts: out.order.map(id => ({ chain: id, modelled: out.chains[id].nums.length,
                                   declared: decl[id] === undefined ? null : decl[id] })),
    /* The four disulfides are why Anfinsen could pull the protein apart and
       watch it come back: eight cysteines pair 105 ways, and it finds the one
       right pairing on its own. Read off SSBOND, not counted from cysteines. */
    ss: Bake.disulfides(text, only),
    ligands: Bake.ligands(text, only),
  };
  return out;
}

function main() {
  const manifest = {};
  for (const v of VIEWS) {
    const out = bake(v);
    const file = `rnase-${v.id}.json`;
    fs.writeFileSync(path.join(DATA, file), JSON.stringify(out));
    manifest[v.id] = Object.assign({ file, frame: out.frame,
                                     extents: out.extents }, out.meta);
    const kb = (fs.statSync(path.join(DATA, file)).size / 1024).toFixed(0);
    const breaks = Bake.breaks(out);
    const res = out.meta.counts.reduce((k, c) => k + c.modelled, 0);
    console.log(`${v.id}  ${out.order.length} chain(s), ${res} residues` +
      (breaks ? `, ${breaks} break(s)` : '') +
      `, ss ${out.ssFrom}, ${out.extents.join(' × ')} A, ` +
      `${out.meta.ss.length} SS, ligands [${out.meta.ligands.join(' ')}], ` +
      `view ${out.frame}, ${kb} KB`);
  }
  fs.writeFileSync(path.join(DATA, 'rnase-views.json'),
                   JSON.stringify(manifest, null, 1) + '\n');
  console.log(`manifest  rnase-views.json  ${Object.keys(manifest).length} views`);
}

if (require.main === module) main();
module.exports = { bake, VIEWS };
