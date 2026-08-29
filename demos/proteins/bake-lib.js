#!/usr/bin/env node
/* =============================================================================
 *  proteins/bake-lib.js — reading a deposition, for every protein's baker
 * =============================================================================
 *  Node only, offline, no dependencies but `folding/folding.js`. Three bakers
 *  and `tools/bake-trace.js` had grown their own copy of this; two of them were
 *  byte-identical, which is where a rule starts to drift. The rules here are
 *  the ones a drifted copy breaks invisibly:
 *
 *  · ONE COPY PER RESIDUE. An altLoc other than blank or 'A' is a second
 *    position for an atom already counted. Two copies of a residue put two
 *    points in the trace and the ribbon splines through both.
 *  · SECONDARY STRUCTURE IS READ, NEVER DETECTED. HELIX and SHEET are the
 *    depositors' assignment; a geometric guess is a claim about the structure
 *    nothing in the repo checks, and on a page about folding it invents the
 *    lesson. A file with no records bakes as all coil and SAYS so in `ssFrom`,
 *    so it draws as a visible worm rather than a silent wrong.
 *  · SS IS INDEXED BY RESIDUE NUMBER, never by position in the array. A chain
 *    with an unmodelled loop slides every letter after the gap onto the wrong
 *    residue otherwise.
 *  · `nums` RIDES ALONG WITH `first`. They are what let a consumer break the
 *    ribbon where the chain breaks; without them an unmodelled loop is drawn
 *    as a smooth band across coordinates nobody measured, which at ribbon
 *    width is indistinguishable from data.
 *  · COORDINATES COME OUT CENTRED, at 0.01 A. A card frames what it is given
 *    and a crystal's origin is nowhere near the molecule.
 *
 *  WHAT IS NOT HERE, and must not move here: which entries a bench shows, what
 *  they claim, and whatever that protein is about — prion's residue overlap,
 *  rnase's ligand and disulfide meta, myoglobin's pocket and its superposition.
 *  This file answers "what does the file say"; a baker answers "what is this
 *  protein for", and the second question is the one with a human in it.
 *
 *  Each baker composes its OWN output object, in its own key order, from
 *  `assemble` and `frameOf`. That is deliberate: the bakes are committed
 *  artefacts and a shared writer would reorder every one of them the day it
 *  changed its mind about a key.
 *
 *  Used by: proteins/rnase/tools/prep.js, proteins/myoglobin/tools/prep.js,
 *  tools/bake-trace.js.
 *
 *  ONE BAKER DELIBERATELY DOES NOT USE IT: `hemoglobin/tools/` feeds the
 *  folding trajectory and is a pipeline of its own. `proteins/prion/tools/`
 *  writes traces like the rest now, but through `PrionLib` rather than through
 *  this file — its sources are already cut and aligned to each other by that
 *  library, and re-reading them here would be a second parse of files a
 *  library in the repo already owns. The RULES above still hold there; it is
 *  the code that differs.
 * ============================================================================= */
'use strict';

const path = require('path');
const FoldLib = require(path.join(__dirname, '..', 'folding', 'folding.js'));

/* 0.01 A, finer than any deposited coordinate is meaningful to. */
const r2 = v => Math.round(v * 100) / 100;

const xyz = line => [+line.slice(30, 38), +line.slice(38, 46), +line.slice(46, 54)];

/* Everything up to the first ENDMDL, or the whole file when there are no
   MODEL records. An X-ray file passes through untouched, and an NMR
   deposition yields model 1 — a baker that skips this bakes twenty
   interleaved copies of one chain and finds out from the render. */
function modelOne(text) {
  const i = text.indexOf('\nENDMDL');
  return i < 0 ? text : text.slice(0, i);
}

/* THE MODIFIED RESIDUES A FILE DECLARES, off its own MODRES records, as a Set
   of residue names. Not a list this repo keeps: which names are modified
   residues is a fact each entry states about itself, and a hardcoded list is
   the thing that silently misses the next one.

   IT MATTERS BECAUSE A MODIFIED RESIDUE IS A HETATM. Hydroxyproline is the
   case that forced this: collagen is one residue in three, and every one of
   them is deposited as HETATM, so an ATOM-only trace drops a third of the
   chain and splines the ribbon across the holes. Nothing about the render says
   so — it looks like a protein with a lot of disorder. */
function modResidues(text) {
  const out = new Set();
  for (const line of text.split('\n'))
    if (line.startsWith('MODRES')) out.add(line.slice(12, 15).trim());
  return out;
}

/* CA per chain, in file order. `only` is a Set of chain ids, or null for
   every chain in the file. A chain with no id is keyed '_'.

   `mod` is a Set from modResidues: pass it and a HETATM CA of a declared
   modified residue counts as part of the chain. OPT-IN, because it changes
   what a trace CONTAINS and every bake in the repo is a committed artefact —
   a baker asks for it, and says why. */
function caTrace(text, only, mod) {
  const chains = new Map();
  for (const line of text.split('\n')) {
    const het = mod && line.startsWith('HETATM') && mod.has(line.slice(17, 20).trim());
    if (!line.startsWith('ATOM') && !het) continue;
    if (line.slice(12, 16).trim() !== 'CA') continue;
    const alt = line[16];
    if (alt !== ' ' && alt !== 'A') continue;
    const id = line[21] === ' ' ? '_' : line[21];
    if (only && !only.has(id)) continue;
    if (!chains.has(id)) chains.set(id, []);
    const p = xyz(line);
    chains.get(id).push({ num: parseInt(line.slice(22, 26), 10),
                          x: p[0], y: p[1], z: p[2] });
  }
  return chains;
}

/* The depositors' own assignment, as {chain, from, to} ranges. */
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

const ssFrom = R => (R.H.length || R.E.length) ? 'deposited' : 'none';

/* The length the entry SAYS each chain is, off its own SEQRES. Never a
   constant typed by a baker: it is construct-relative, it differs between
   entries of the same protein, and that difference is a fact about what was
   expressed. Completeness is measured against this and nothing else. */
function declared(text) {
  const out = {};
  for (const line of text.split('\n')) {
    if (!line.startsWith('SEQRES')) continue;
    const c = line[11] === ' ' ? '_' : line[11];
    if (!(c in out)) out[c] = parseInt(line.slice(13, 17), 10);
  }
  return out;
}

/* SSBOND pairs as "26-84", restricted to chains being drawn. */
function disulfides(text, only) {
  const out = [];
  for (const line of text.split('\n')) {
    if (!line.startsWith('SSBOND')) continue;
    if (only && !(only.has(line[15]) && only.has(line[29]))) continue;
    out.push(line.slice(17, 21).trim() + '-' + line.slice(31, 35).trim());
  }
  return out;
}

/* HETATM residue names other than water, counted by how many COPIES are
   present — keyed by chain and residue number, because the same name
   appearing forty times is one ligand modelled forty times or forty
   ligands, and only the key can tell them apart. Chain-filtered with the
   trace: an unfiltered count describes a structure that is not on screen. */
function ligands(text, only, mod) {
  const seen = new Map();
  for (const line of text.split('\n')) {
    if (!line.startsWith('HETATM')) continue;
    const name = line.slice(17, 20).trim();
    if (name === 'HOH') continue;
    /* A declared modified residue is part of the CHAIN, not something bound to
       it. Hydroxyproline listed as a ligand ×30 would describe collagen as
       carrying thirty passengers. Same Set caTrace was given, or nothing. */
    if (mod && mod.has(name)) continue;
    if (only && !only.has(line[21])) continue;
    seen.set(name + '|' + line[21] + line.slice(22, 27), name);
  }
  const n = new Map();
  for (const name of seen.values()) n.set(name, (n.get(name) || 0) + 1);
  return [...n].map(([name, k]) => k > 1 ? `${name} ×${k}` : name);
}

/* The first line of a record type, minus its tag. */
const line1 = (text, tag) =>
  (text.split('\n').find(l => l.startsWith(tag)) || '').slice(10).trim();

const method = text => (line1(text, 'EXPDTA') || 'unknown').toLowerCase();

const models = text => (text.match(/^MODEL /gm) || []).length;

/* Resolution in ångströms, or null. REMARK 2 is where it lives, and an NMR
   entry writes NOT APPLICABLE there — which is a fact about the method and
   must come back as null rather than as a number nobody measured. */
function resolution(text) {
  const line = text.split('\n').find(l => l.startsWith('REMARK   2 RESOLUTION'));
  if (!line) return null;
  const m = line.match(/(\d+\.?\d*)\s*ANGSTROM/);
  return m ? +m[1] : null;
}

/* Every chain id that has coordinates, whatever the trace kept. */
const chainCount = text =>
  new Set(text.split('\n').filter(l => l.startsWith('ATOM')).map(l => l[21])).size;

/* The chains the ENTRY declares, off its COMPND `CHAIN:` lines — which is a
   different question from how many are in the file in front of you, and the
   one a bench answers with "1 of 10 chains, a subunit of the fibril". It is
   readable from a reduced file only if the COMPND lines were carried into it,
   which is why the prion baker carries them. Returns 0 when there are none,
   and a caller should fall back to counting coordinates. */
function chainsDeclared(text) {
  const ids = new Set();
  for (const line of text.split('\n')) {
    if (!line.startsWith('COMPND')) continue;
    const m = line.match(/CHAIN:\s*(.+?);?\s*$/);
    if (!m) continue;
    for (const id of m[1].split(',')) if (id.trim()) ids.add(id.trim());
  }
  return ids.size;
}

/* EC NUMBERS off the entry's own COMPND records, in file order and without
   duplicates — the classification of the REACTION, which is the fact that says
   an entry is an enzyme at all.

   A LIST, because a COMPND block describes every molecule in the entry and
   more than one of them can be an enzyme: 1DFJ is ribonuclease A held by an
   inhibitor, and only one half of it has a number. A single field would have
   to pick, and picking is a decision this reader has no business making.

   IT CLASSIFIES THE REACTION, NOT THE PROTEIN. Two enzymes with no shared
   ancestry and no shared fold carry the same number if they do the same
   chemistry, so it answers "what reaction is this" and is never evidence
   about a structure. */
function ecNumbers(text) {
  const out = [];
  for (const line of text.split('\n')) {
    if (!line.startsWith('COMPND')) continue;
    const m = line.match(/\bEC:\s*([\d.\-,\s]+?);?\s*$/);
    if (!m) continue;
    for (const ec of m[1].split(',')) {
      const v = ec.trim();
      if (v && !out.includes(v)) out.push(v);
    }
  }
  return out;
}

/* The seven top-level classes, for a page that wants to say what a number
   means. Here rather than in a page because it is a fact about the EC scheme
   and every reader of it would otherwise keep a copy. */
const EC_CLASS = [null,
  ['oxidoreductase', 'moving electrons'],
  ['transferase', 'moving a group from one molecule to another'],
  ['hydrolase', 'cutting a bond with water'],
  ['lyase', 'cutting without water, or adding across a double bond'],
  ['isomerase', 'rearranging one molecule'],
  ['ligase', 'joining two, paying with ATP'],
  ['translocase', 'moving something across a membrane']];

/* The provenance lines a reduced file has to carry to stay self-describing:
   what experiment produced it, how sharp it is, and which chains the entry
   has. Without them a cut-down PDB cannot answer the questions the registry
   indexes it on, and the answers have to be remembered somewhere else. */
const provenance = text => text.split('\n')
  .filter(l => l.startsWith('EXPDTA') || l.startsWith('REMARK   2 RESOLUTION') ||
               (l.startsWith('COMPND') && /CHAIN:/.test(l)));

/* ---------------------------------------------------------------- assemble
 *
 *  The trace shape every consumer reads — kit/proteinbox.js among them —
 *  built from what caTrace and ssRanges returned.
 *
 *    chains   the Map caTrace gave back
 *    R        the ssRanges result
 *    centre   [x,y,z] to subtract; omit and it is solved over every kept CA
 *
 *  Returns {order, chains, radius, centre}. `centre` comes back because a
 *  caller with a second object in the same frame — a heme, a ligand, a
 *  surface — has to move it by exactly this vector or it lands at the origin
 *  with the protein somewhere else.
 *
 *  THE COUNTS COME FROM THE RECORDS, never from the letters: adjacent helices
 *  touch, so eight HELIX records read as six runs of H once they are stamped
 *  onto residues. A page saying "eight helices" has to say it from `helices`.
 */
function assemble(chains, R, centre) {
  let c = centre;
  if (!c) {
    let cx = 0, cy = 0, cz = 0, n = 0;
    for (const res of chains.values())
      for (const r of res) { cx += r.x; cy += r.y; cz += r.z; n++; }
    c = [cx / n, cy / n, cz / n];
  }

  const out = { order: [], chains: {}, radius: 0, centre: c.map(r2) };
  for (const [id, res] of chains) {
    const ss = res.map(r => {
      for (const h of R.H) if (h.chain === id && r.num >= h.from && r.num <= h.to) return 'H';
      for (const e of R.E) if (e.chain === id && r.num >= e.from && r.num <= e.to) return 'E';
      return 'C';
    }).join('');
    out.order.push(id);
    out.chains[id] = {
      first: res[0].num,
      nums: res.map(r => r.num),
      helices: R.H.filter(h => h.chain === id).length,
      strands: R.E.filter(e => e.chain === id).length,
      CA: res.map(r => {
        const p = [r2(r.x - c[0]), r2(r.y - c[1]), r2(r.z - c[2])];
        out.radius = Math.max(out.radius, Math.hypot(p[0], p[1], p[2]));
        return p;
      }),
      ss,
    };
  }
  out.radius = r2(out.radius);
  return out;
}

/* ------------------------------------------------------------------ frameOf
 *
 *  The presentation frame, solved and only when the shape earns it.
 *
 *  A deposited frame is a crystal's or an EM box's, so there is nothing in it
 *  worth preserving; what a reader needs is the structure's own axes, longest
 *  across the frame and shortest into the screen. `worth:false` means the
 *  three extents are too close to tell apart — a globular domain, whose
 *  solved basis would flip between rebakes — and then no view is written, the
 *  bake opens in the deposited frame, and a human picks one.
 *
 *  Returns {view?, extents, frame}. FoldLib.viewBasis carries the handedness
 *  guard: a basis assembled by hand mirrors the protein half the time, and
 *  nothing downstream can see it.
 */
function frameOf(points) {
  const V = FoldLib.viewBasis(points);
  const out = { extents: V.ext.map(r2), frame: V.worth ? 'computed' : 'deposited' };
  if (V.worth) out.view = V.R.map(ax => ax.map(r2));
  return out;
}

/* ------------------------------------------------------------------ viewFor
 *
 *  THE BASIS A BAKE SHOULD WEAR, and the one place that decides between a
 *  human's answer and a solved one.
 *
 *  A HUMAN'S BASIS WINS AND IS READ FROM THE REGISTRY. `view: {by:'human',
 *  basis}` beside every other decision about that protein is the only place
 *  one is written: a baker that solved over it would undo the choice on the
 *  next re-bake with the picture still looking like a protein, and a page that
 *  applied one after the fetch would turn the bench without turning the
 *  gallery card that reads the same file.
 *
 *  Everything else falls back to whatever the baker worked out — `frameOf` for
 *  most, `FoldLib.basisFrom` where a field has a convention about which axis
 *  stands up. Pass that as `fallback` and it is returned untouched.
 *
 *  `frame` is the WORD THE PANEL PRINTS, so it is fixed here rather than per
 *  baker: `custom view` is a human's, `computed` is solved, `deposited` is the
 *  file left alone. Three bakers spelling the third state three ways is how a
 *  reader stops being able to tell which they are looking at.
 *
 *  The human path is what `check-proteins.js` then enforces against the bake.
 */
function viewFor(p, fallback) {
  const picked = p && p.view && p.view.by === 'human' && p.view.basis;
  if (picked) return { view: picked, frame: 'custom view' };
  const f = fallback || {};
  return { view: f.view || null, frame: f.view ? (f.frame || 'computed') : 'deposited' };
}

/* Chain breaks, counted off the numbers a bake carries — for a baker's own
   console line and for a panel that reports segments. */
const breaks = trace => trace.order.reduce((k, id) => k + trace.chains[id].nums
  .filter((v, i, a) => i && v !== a[i - 1] + 1).length, 0);

module.exports = {
  r2, xyz, modelOne, caTrace, ssRanges, ssFrom, declared, disulfides, ligands,
  line1, method, models, resolution, chainCount, chainsDeclared, provenance,
  modResidues,
  ecNumbers, EC_CLASS,
  assemble, frameOf, viewFor, breaks,
};
