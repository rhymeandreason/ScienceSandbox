#!/usr/bin/env node
/* =====================================================================
 *  prep.js — cut the two deposited files down to the pair that can morph.
 *
 *  The lesson's claim needs exactly one thing from the PDB: the SAME
 *  residues, in two structures, with different secondary structure. That
 *  is residues 170-228 — 1QLZ models 125-228 and 6LNI's fibril core runs
 *  170-229, so the overlap is where the comparison is legitimate and
 *  everywhere else is one file talking about residues the other never saw.
 *
 *  WHAT GETS DROPPED, AND WHY IT IS NOT A LOSS.
 *
 *  1QLZ AS DEPOSITED IS 20 NMR MODELS, 2.7 MB, and what is committed here
 *  is `1QLZ-model1.pdb` — the header records plus model 1, 141 KB. The
 *  name says so because the file is not 1QLZ and a reader who assumed it
 *  was would be wrong about the most important thing in it: the native
 *  state of PrP is an ENSEMBLE, and this is one member of it. The other 19
 *  are 2.6 MB of conformations nothing here reads.
 *
 *  A trajectory has to start from a single conformation whichever way you
 *  choose it, so the reduction costs the animation nothing. It costs the
 *  CLAIM something, and the page has to carry that: "the native fold" is a
 *  family of structures that agree about the helices and disagree about
 *  the loops, and model 1 is not more real than model 12.
 *
 *  modelOne() stays even though the committed file has one model. It is
 *  three lines, and it is what lets someone re-run this against a fresh
 *  download from the PDB without discovering the hard way that they baked
 *  twenty interleaved copies of the same chain.
 *
 *  6LNI is ten chains: two protofibrils of five layers each. Chain A is
 *  one rung, and one rung is what act 3 morphs INTO. The other nine are
 *  act 4's whole subject, so they are kept in a separate stack file rather
 *  than thrown away — the stack is the reason the conversion spreads, and
 *  cutting it here would delete the point of the lesson to save 500 KB.
 *
 *  ALTLOCS: blank or 'A' only, matching hemoglobin/tools/chain.js. A
 *  residue modelled twice contributes once, or the residue index and the
 *  torsion list stop lining up.
 *
 *  SOURCES, for a re-run from scratch:
 *    https://files.rcsb.org/download/1QLZ.pdb    (NMR, human PrP 125-228)
 *    https://files.rcsb.org/download/6LNI.pdb    (cryo-EM, recombinant fibril)
 *
 *  Run:  node prion/tools/prep.js      (offline, no dependencies)
 * ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const Bake = require('../../bake-lib.js');

const DATA = path.join(__dirname, '..', 'data');

/* The overlap. Not a tuning knob: it is 1QLZ's last residue against
   6LNI's first, and it is asserted below rather than trusted. */
const LO = 170, HI = 228;

/* modelOne(text) — everything up to the first ENDMDL, or the whole file if
   there are no MODEL records. An X-ray file passes through untouched. */
function modelOne(text) {
  const end = text.indexOf('\nENDMDL');
  return end === -1 ? text : text.slice(0, end + 1);
}

/* chainSlice(text, chainId, lo, hi) — ATOM records for one chain inside a
   residue range, in file order. */
function chainSlice(text, chainId, lo, hi) {
  const out = [];
  for (const line of text.split('\n')) {
    if (!line.startsWith('ATOM')) continue;
    if (line[21] !== chainId) continue;
    const alt = line[16];
    if (alt !== ' ' && alt !== 'A') continue;
    const num = parseInt(line.slice(22, 26), 10);
    if (num < lo || num > hi) continue;
    out.push(line);
  }
  return out;
}

/* records(text, tag, chainId) — HELIX or SHEET lines for one chain. The
   secondary structure is READ, never detected: CLAUDE.md's rule, and here
   it is also the entire lesson, so a heuristic would be inventing the
   thing the page claims to have measured. */
function records(text, tag, chainId) {
  const col = tag === 'HELIX' ? 19 : 21;
  return text.split('\n').filter(l => l.startsWith(tag) && l[col] === chainId);
}

/* seqres(text, chainId) — the chain's SEQRES lines, and with them the length
   of the molecule the deposition SAYS it is. That is the honest denominator
   for "how much of this protein is modelled": it is the construct's own
   declared sequence, so a page can report 104 of 210 without this script
   inventing what full-length PrP means. Note it is construct-relative and
   differs between entries — the human files declare 210, the hamster ones the
   bench used to carry declared 142
   142 — which is a fact about what was expressed, not about the protein. */
function seqres(text, chainId) {
  return text.split('\n').filter(l => l.startsWith('SEQRES') && l[11] === chainId);
}

function resNums(lines) {
  const s = new Set();
  for (const l of lines) s.add(parseInt(l.slice(22, 26), 10));
  return [...s].sort((a, b) => a - b);
}

function bakeEnsemble(ens, nat, helix, write) {
  const ID = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const models = [];
  let cur = null;
  for (const line of ens.split('\n')) {
    if (line.startsWith('MODEL')) { cur = []; continue; }
    if (line.startsWith('ENDMDL')) { if (cur) models.push(cur); cur = null; continue; }
    if (!cur || !line.startsWith('ATOM')) continue;
    if (line.slice(12, 16) !== ' CA ' || line[21] !== 'A') continue;
    const alt = line[16];
    if (alt !== ' ' && alt !== 'A') continue;
    cur.push(line);
  }
  if (models.length > ID.length) {
    throw new Error(`${models.length} models, only ${ID.length} chain ids`);
  }
  const ensLines = models.flatMap((m, i) =>
    m.map(l => l.slice(0, 21) + ID[i] + l.slice(22)));
  /* The native's OWN sheet records, not the fibril's `sheet` above: PrP-C
     has a two-strand sheet at 128-131/161-164, and it is the thing the
     fibril claims to extend, so drawing it as coil here would hide the
     one piece of β the native already has. */
  const natSheet = records(nat, 'SHEET', 'A');
  const nEns = write('prp-view-ensemble.pdb', helix.concat(natSheet, ensLines));
  console.log(`ensemble    prp-view-ensemble.pdb  ${nEns} lines, ${models.length} models as chains, CA only`);
}

function main() {
  const nat = modelOne(fs.readFileSync(path.join(DATA, '1QLZ-model1.pdb'), 'utf8'));
  const fib = fs.readFileSync(path.join(DATA, '6LNI.pdb'), 'utf8');

  const natA = chainSlice(nat, 'A', LO, HI);
  const fibA = chainSlice(fib, 'A', LO, HI);

  const nNums = resNums(natA), fNums = resNums(fibA);
  const same = nNums.length === fNums.length && nNums.every((n, i) => n === fNums[i]);
  if (!same) {
    throw new Error(`residue ranges differ: native ${nNums[0]}-${nNums[nNums.length-1]}` +
                    ` (${nNums.length}) vs fibril ${fNums[0]}-${fNums[fNums.length-1]} (${fNums.length})`);
  }

  /* Same residue NUMBERS is not yet the same PROTEIN. Both files are human
     PrP, but the morph is only meaningful if it is one sequence changing
     shape, so the sequences are compared residue by residue and a mismatch
     stops the bake. 6LNI is wild-type; 7DWV (E196K) would fail here, which
     is the check doing its job rather than an obstacle. */
  const seqOf = lines => {
    const m = new Map();
    for (const l of lines) m.set(parseInt(l.slice(22, 26), 10), l.slice(17, 20).trim());
    return m;
  };
  const sn = seqOf(natA), sf = seqOf(fibA);
  const diff = nNums.filter(n => sn.get(n) !== sf.get(n));
  if (diff.length) {
    throw new Error('sequence differs at ' +
      diff.map(n => `${n} ${sn.get(n)}/${sf.get(n)}`).join(', '));
  }

  const helix = records(nat, 'HELIX', 'A');
  const sheet = records(fib, 'SHEET', 'A');

  const write = (name, lines) => {
    fs.writeFileSync(path.join(DATA, name), lines.join('\n') + '\nEND\n');
    return lines.length;
  };

  const nNat = write('prp-native.pdb', helix.concat(natA));

  /* ---- the four deposited structures, whole, for looking at ----

     Nothing here morphs. These exist so the two candidate PAIRS can be put
     beside each other as ribbons, which is a comparison the trajectory
     cannot make: the morph draws 170-228 of one pair, and the question of
     which pair the lesson should use is a question about the residues it
     leaves out.

     Chain A only, and the file's own HELIX and SHEET records ride along.
     A fibril chain has no helix records because it has no helices — that
     absence is the structure, and detecting secondary structure here
     instead of reading it would be inventing the lesson's own claim. */
  const VIEWS = [
    ['prp-view-1QLZ.pdb', nat, 'human native   1QLZ'],
    ['prp-view-6LNI.pdb', fib, 'human fibril   6LNI'],
  ];
  const views = VIEWS.map(([name, text, label]) => {
    const atoms = chainSlice(text, 'A', -Infinity, Infinity);
    const h = records(text, 'HELIX', 'A'), e = records(text, 'SHEET', 'A');
    const q = seqres(text, 'A');
    const nums = resNums(atoms);
    /* EXPDTA, REMARK 2 and the COMPND chain list ride along with the cut, so
       the view file can still answer what it is: which experiment, how sharp,
       how many chains the entry has. Everything the registry indexes this
       variant on is then IN the file it names, which is the invariant — the
       registry prints a few convenience lines, it does not hold facts the
       bake cannot produce. */
    write(name, Bake.provenance(text).concat(q, h, e, atoms));
    return `view        ${name}  ${label}  ${nums[0]}-${nums[nums.length-1]}` +
           `  ${nums.length} residues, ${h.length} HELIX, ${e.length} SHEET`;
  });
  const nFib = write('prp-fibril.pdb', sheet.concat(fibA));

  /* The stack: every chain, same range, for act 4. */
  const chains = [...new Set(fib.split('\n')
    .filter(l => l.startsWith('ATOM')).map(l => l[21]))].sort();
  const stack = chains.flatMap(c => chainSlice(fib, c, LO, HI));
  const nStk = write('prp-stack.pdb', stack);

  /* The same ten chains at their FULL modelled range, with chain A's SHEET
     records riding along. Every rung is the same conformation, so one
     chain's strand assignment is every chain's — the page prepends these
     to each chain it parses.

     This is the file that answers what a single rung cannot: a fibril
     monomer is flat and open because its β-sheet partners are the copies
     above and below it, and a lesson that only ever draws chain A is
     showing the reason for the shape with the reason cropped out. */
  const stackFull = chains.flatMap(c => chainSlice(fib, c, -Infinity, Infinity));
  const nStkF = write('prp-view-stack.pdb',
                      Bake.provenance(fib).concat(seqres(fib, 'A'), sheet, stackFull));

  /* ---- the native ENSEMBLE ----

     THE COUNTERPART TO THE STACK, AND THE OPPOSITE CLAIM. A fibril's ten
     chains are ten molecules that agree exactly; an NMR entry's twenty
     models are ONE molecule that is genuinely mobile, all fitting the same
     restraints. Drawn together, the helices land on top of each other and
     the loops and the N-terminal tail fan out — which is the native state
     saying it is a family, not a structure.

     There is no stack view for 1QLZ and there must not be. PrP-C is a
     soluble monomer; assembling one would be inventing the very thing the
     fibril is.

     CA ONLY. The ribbon is the only consumer and the deposited file is 2.7
     MB of twenty full copies, most of it side chains nothing here draws.

     EACH MODEL BECOMES A CHAIN, A..T, so the page's byChain() splitter
     handles the ensemble and the stack with the same code — twenty
     conformations of one chain and ten copies of one conformation are the
     same shape of file once the label moves.

     NOT REFITTED. The deposition is already superimposed: measured against
     model 1 with no fitting, the helix core sits at 0.8 A mean and the
     tail below 130 at 1.7 A, so the spread on screen is the ensemble's own
     and not an artefact of an alignment this script chose. */
  /* OPTIONAL, AND UNCOMMITTED. The 20-model deposition is 2.7 MB against the
     169 KB this bakes out of it, and no page draws the ensemble today — the
     spread it shows is 0.81 A across the helix core, which is a tight
     ensemble and a furry copy of a structure already on screen. The code
     stays because the measurement was worth making and the next protein may
     have an ensemble worth drawing; the file does not.

       curl -o proteins/prion/data/1QLZ.pdb https://files.rcsb.org/download/1QLZ.pdb */
  /* ---- back to the registry ----

     What the page would otherwise TYPE. Species, method and chain count are
     read out of each source file; the state/form reading and the provenance
     are judgements, and they live in proteins/proteins.js with every other
     protein's rather than in a panel where nothing could check them against
     the file they describe.

     STATE IS NOT PROVENANCE, and conflating them is the trap the registry's
     prose exists to avoid. 6LNI is the disease FOLD grown in a test tube from
     recombinant protein, and every view here is that. Disease MATERIAL — a
     fibril pulled out of an infected brain — is a different provenance and
     this bench no longer carries one: the hamster 7LNA that did was dropped
     with the rest of the hamster pair. A page labelling an in vitro fibril
     "disease" without saying which it is overclaims on behalf of the easier
     file, which is why the registry's prov line says it out loud. */
  const IO = require('../../tools/registry-io.js');
  const REG = require('../../proteins.js');
  const ME = REG.byKey('prion');

  const expdta = t => (t.split('\n').find(l => l.startsWith('EXPDTA')) || '')
    .slice(10).trim().toLowerCase() || 'unknown';
  const chainCount = t => new Set(t.split('\n')
    .filter(l => l.startsWith('ATOM')).map(l => l[21])).size;
  const caCount = t => t.split('\n')
    .filter(l => l.startsWith('ATOM') && l.slice(12, 16).trim() === 'CA').length;

  /* The length the entry declares, off chain A's first SEQRES line. The
     registry compares residues against it, so it is read here rather than
     left for a page to work out from a file it would have to fetch. */
  const declaredOf = t => {
    const l = t.split('\n').find(x => x.startsWith('SEQRES') && x[11] === 'A');
    return l ? parseInt(l.slice(13, 17), 10) : null;
  };

  /* ---- the bakes ----

     JSON, like every other protein. The views were reduced PDB text while the
     unfold animation was the point and the page needed whole residues to morph
     between; that animation is gone, so what is left is a ribbon, and a ribbon
     wants the trace shape kit/proteinbox.js reads. `PrionLib.trace` is the
     chain-aware parse and `PrionLib.frame` the solved orientation, both used
     here exactly as the pages used to call them at load — which is what makes
     this a move rather than a rewrite.

     THE SOURCES STAY. prion.js's morph and CCD need whole residues, and
     check-prion.js reads prp-native.pdb and prp-fibril.pdb for the geometry
     assertions. Only the three cut VIEWS become JSON. */
  const PrionLib = require('../prion.js');
  const FoldLib = require('../../../folding/folding.js');

  const blocks = {};
  const bakeView = (id, text, drawn) => {
    const t = PrionLib.trace(text, FoldLib);
    /* The chains carry their parse for the morph code; a bake carries only
       what a ribbon needs, so it goes before the file is written. */
    for (const cid of t.order) delete t.chains[cid].parsed;

    let radius = 0;
    for (const cid of t.order)
      for (const p of t.chains[cid].CA) radius = Math.max(radius, Math.hypot(...p));

    t.source = id + '.pdb';
    t.ssFrom = 'deposited';
    t.radius = Math.round(radius * 100) / 100;
    t.meta = {
      entry: REG.variantOf(ME, id).source.id,
      method: expdta(text), resolution: Bake.resolution(text),
      chainsInFile: Bake.chainsDeclared(text),
      chainsDrawn: t.order.length,
      counts: t.order.map(cid => ({ chain: cid, modelled: t.chains[cid].nums.length,
                                    declared: declaredOf(text) })),
    };
    const file = `prp-${id}.json`;
    fs.writeFileSync(path.join(DATA, file), JSON.stringify(t));
    /* BOTH NUMBERS COUNT THE SAME THING: every chain the bake draws. SEQRES
       is per chain, so the stack's ten rungs declare 210 each and 2100 in
       total — and an index holding 600 modelled against 210 declared would be
       comparing ten chains with one. The panel still phrases completeness per
       chain, off the bake's own counts, because a rung is what a reader is
       looking at. */
    blocks[id] = { method: t.meta.method, chainsInFile: t.meta.chainsInFile,
                   residues: t.meta.counts.reduce((k, c) => k + c.modelled, 0),
                   declared: t.meta.counts.reduce((k, c) => k + c.declared, 0),
                   baked: file };
    const kb = (fs.statSync(path.join(DATA, file)).size / 1024).toFixed(0);
    console.log(`bake        ${file}  ${t.order.length} chain(s), ` +
      `${blocks[id].residues} residues, frame ${t.frame}, ${kb} KB`);
    return t;
  };

  /* NOT CENTRED, and that is the one difference from the other bakers. The
     views come out of files this script already aligned to each other for the
     morph, and re-centring each on its own centroid now would undo that; the
     box centres what it is given anyway. */
  for (const [name, text] of VIEWS) {
    const id = name.slice('prp-view-'.length, -'.pdb'.length);
    if (!REG.variantOf(ME, id)) continue;
    bakeView(id, fs.readFileSync(path.join(DATA, name), 'utf8'));
  }
  bakeView('stack', fs.readFileSync(path.join(DATA, 'prp-view-stack.pdb'), 'utf8'));

  const touched = IO.write('prion', blocks);
  console.log(`registry    proteins.js  ${touched.length} variants updated`);

  console.log(`core        ${nNums[0]}-${nNums[nNums.length - 1]}  ${nNums.length} residues, sequence identical`);
  console.log(`native      prp-native.pdb  ${nNat} lines, ${helix.length} HELIX records`);
  views.forEach(l => console.log(l));
  console.log(`fibril      prp-fibril.pdb  ${nFib} lines, ${sheet.length} SHEET records`);
  console.log(`stack       prp-stack.pdb   ${nStk} lines, ${chains.length} chains ${chains.join('')}`);
  console.log(`stack view  prp-view-stack.pdb  ${nStkF} lines, ${chains.length} chains, ${sheet.length} SHEET`);

  const ensPath = path.join(DATA, '1QLZ.pdb');
  if (fs.existsSync(ensPath)) bakeEnsemble(fs.readFileSync(ensPath, 'utf8'), nat, helix, write);
  else console.log('ensemble    skipped, no data/1QLZ.pdb (see prep.js for the curl)');

}

if (require.main === module) main();
module.exports = { LO, HI, modelOne, chainSlice, records };
