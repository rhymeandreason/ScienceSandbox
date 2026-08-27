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
const FoldLib = require('../../../folding/folding.js');

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

/* ---- reading the file ---------------------------------------------- */

/* Everything up to the first ENDMDL, or the whole file when there are no
   MODEL records. An X-ray file passes through untouched. */
function modelOne(text) {
  const i = text.indexOf('\nENDMDL');
  return i < 0 ? text : text.slice(0, i);
}

function caTrace(text, only) {
  const chains = new Map();
  for (const line of text.split('\n')) {
    if (!line.startsWith('ATOM')) continue;
    if (line.slice(12, 16).trim() !== 'CA') continue;
    const alt = line[16];
    if (alt !== ' ' && alt !== 'A') continue;   // one copy per residue
    const id = line[21] === ' ' ? '_' : line[21];
    if (only && !only.has(id)) continue;
    if (!chains.has(id)) chains.set(id, []);
    chains.get(id).push({ num: parseInt(line.slice(22, 26), 10),
                          x: +line.slice(30, 38), y: +line.slice(38, 46),
                          z: +line.slice(46, 54) });
  }
  return chains;
}

function ssRanges(text) {
  const H = [], E = [];
  for (const line of text.split('\n')) {
    if (line.startsWith('HELIX ')) {
      H.push({ chain: line[19], from: parseInt(line.slice(21, 25), 10),
               to: parseInt(line.slice(33, 37), 10) });
    } else if (line.startsWith('SHEET ')) {
      E.push({ chain: line[21], from: parseInt(line.slice(22, 26), 10),
               to: parseInt(line.slice(33, 37), 10) });
    }
  }
  return { H, E };
}

/* SEQRES per chain: the length the entry says the molecule is. Not a 124
   typed here — that would be this script deciding what RNase A is, and
   1DFJ's inhibitor chain declares 457. */
function declared(text) {
  const out = {};
  for (const line of text.split('\n')) {
    if (!line.startsWith('SEQRES')) continue;
    const c = line[11] === ' ' ? '_' : line[11];
    if (!(c in out)) out[c] = parseInt(line.slice(13, 17), 10);
  }
  return out;
}

/* SSBOND records, as "26-84". The four of RNase A are why Anfinsen could
   pull the protein apart and watch it come back: eight cysteines pair 105
   ways, and it finds the one right pairing on its own. */
function disulfides(text, only) {
  const out = [];
  for (const line of text.split('\n')) {
    if (!line.startsWith('SSBOND')) continue;
    const c1 = line[15], c2 = line[29];
    if (only && !(only.has(c1) && only.has(c2))) continue;
    out.push(line.slice(17, 21).trim() + '-' + line.slice(31, 35).trim());
  }
  return out;
}

/* HETATM residue names other than water, counted by how many copies are
   present. A ligand is what says whether the structure was caught working
   or sitting still. */
function ligands(text, only) {
  const seen = new Map();
  for (const line of text.split('\n')) {
    if (!line.startsWith('HETATM')) continue;
    const name = line.slice(17, 20).trim();
    if (name === 'HOH') continue;
    /* Chain-filtered with the trace: 1F0V's 24 glycerols belong to four
       chains and only two are drawn, so an unfiltered count would describe
       a structure that is not on screen. */
    if (only && !only.has(line[21])) continue;
    seen.set(name + '|' + line[21] + line.slice(22, 27), name);
  }
  const n = new Map();
  for (const name of seen.values()) n.set(name, (n.get(name) || 0) + 1);
  return [...n].map(([name, k]) => k > 1 ? `${name} ×${k}` : name);
}

const line1 = (text, tag) =>
  (text.split('\n').find(l => l.startsWith(tag)) || '').slice(10).trim();

/* ---- baking one view ------------------------------------------------ */

const r2 = v => Math.round(v * 100) / 100;

function bake(v) {
  const raw = fs.readFileSync(path.join(SRC, v.id + '.pdb'), 'utf8');
  const text = v.model ? modelOne(raw) : raw;
  const only = v.chains ? new Set(v.chains.split(',')) : null;

  const chains = caTrace(text, only);
  if (!chains.size) throw new Error(v.id + ': no CA atoms on those chains');
  const R = ssRanges(text);
  const ssFrom = (R.H.length || R.E.length) ? 'deposited' : 'none';

  /* Centred on the CA the bench draws, because a box frames what it is
     given and the crystal's origin is nowhere near the molecule. */
  let cx = 0, cy = 0, cz = 0, n = 0;
  for (const res of chains.values()) for (const r of res) { cx += r.x; cy += r.y; cz += r.z; n++; }
  cx /= n; cy /= n; cz /= n;

  const out = { source: v.id + '.pdb', ssFrom, centre: [r2(cx), r2(cy), r2(cz)],
                order: [], chains: {} };
  let radius = 0;
  for (const [id, res] of chains) {
    /* Indexed by residue NUMBER, never by array position: 1RNU skips
       16-23, and a letter list walked by position would slide every
       assignment after the gap onto the wrong residue. */
    const ss = res.map(r => {
      for (const h of R.H) if (h.chain === id && r.num >= h.from && r.num <= h.to) return 'H';
      for (const e of R.E) if (e.chain === id && r.num >= e.from && r.num <= e.to) return 'E';
      return 'C';
    }).join('');
    out.order.push(id);
    out.chains[id] = {
      first: res[0].num,
      /* Every residue number, so the box breaks the ribbon where the chain
         breaks. Without them 1RNU's cut reads as a smooth band across
         eight residues nobody measured. */
      nums: res.map(r => r.num),
      helices: R.H.filter(h => h.chain === id).length,
      strands: R.E.filter(e => e.chain === id).length,
      CA: res.map(r => {
        const p = [r2(r.x - cx), r2(r.y - cy), r2(r.z - cz)];
        radius = Math.max(radius, Math.hypot(p[0], p[1], p[2]));
        return p;
      }),
      ss,
    };
  }
  out.radius = r2(radius);

  /* THE FRAME, solved only when the shape earns it. RNase A is a kidney
     bean: its three extents are close enough that a solved basis would
     flip between rebakes, so `worth:false` writes no view, the bench opens
     in the deposited frame, and a human picks one with the page's "copy
     this view" button. The dimers and the complex are longer than they are
     wide and may earn one. */
  const all = [];
  for (const id of out.order) for (const p of out.chains[id].CA) all.push(p);
  const V = FoldLib.viewBasis(all);
  if (V.worth) out.view = V.R.map(ax => ax.map(r2));
  out.extents = V.ext.map(r2);
  out.frame = V.worth ? 'computed' : 'deposited';

  const decl = declared(text);
  out.meta = {
    entry: v.id, kind: v.kind, claim: v.claim, prov: v.prov,
    title: line1(text, 'TITLE'),
    method: (line1(text, 'EXPDTA') || 'unknown').toLowerCase(),
    models: (raw.match(/^MODEL /gm) || []).length,
    chainsInFile: new Set(text.split('\n').filter(l => l.startsWith('ATOM'))
      .map(l => l[21])).size,
    chainsDrawn: out.order.length,
    /* Per drawn chain: modelled residues against what SEQRES declares.
       The panel phrases completeness off this pair, never off a length
       typed anywhere. */
    counts: out.order.map(id => ({ chain: id, modelled: out.chains[id].nums.length,
                                   declared: decl[id] === undefined ? null : decl[id] })),
    ss: disulfides(text, only),
    ligands: ligands(text, only),
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
    const breaks = out.order.reduce((k, id) => k + out.chains[id].nums
      .filter((x, i, a) => i && x !== a[i - 1] + 1).length, 0);
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
module.exports = { modelOne, caTrace, ssRanges, declared, disulfides, ligands, bake };
