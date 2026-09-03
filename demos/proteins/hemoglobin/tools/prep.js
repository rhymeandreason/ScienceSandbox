#!/usr/bin/env node
/* =====================================================================
 *  prep.js — haemoglobin for the gallery: the tetramer, its four irons,
 *  and the one residue that makes sickle-cell disease.
 *
 *  Run:  node proteins/hemoglobin/tools/prep.js   (offline, no dependencies)
 *
 *  WHAT THIS BAKER IS NOT. `hemoglobin/tools/` is the other one, and it
 *  is still there: it feeds hemoglobin-lab's folding trajectory, the
 *  quaternary placement and two SES surfaces, in formats built for that
 *  lesson and on that lesson's schedule. Nothing here writes into that
 *  folder or reads anything out of it but the two deposited files, which
 *  are the same two RCSB entries either baker would download.
 *
 *  This one answers the gallery's question instead — what do we hold —
 *  and it answers it the way the other sixteen proteins do, so a card
 *  and a bench take one path and `check-proteins.js` can verify it.
 *
 *  THE TWO, and each is one question:
 *
 *    2HHB  Fermi and Perutz's deoxy haemoglobin at 1.74 A. One tetramer:
 *          two alpha chains, two beta, four hemes, four irons. What the
 *          molecule IS.
 *    2HBS  deoxy haemoglobin S at 2.05 A. The same fold with beta6
 *          glutamate replaced by valine. Tetramer 1 of the two in the
 *          asymmetric unit.
 *
 *  ONE TETRAMER OF 2HBS, THE SAME FOUR CHAINS bake-hbs.js TAKES. The file
 *  holds two because what it was deposited to show is the lateral contact
 *  between them — but a contact is a claim about two molecules and this
 *  bench draws one. Baking both put 116 A of structure on a stage showing
 *  2HHB's 60, so a click between the two halved the molecule: a framing
 *  artefact that reads as a difference in the protein. The contact is
 *  sickle/fibre-test.html's, and it draws surfaces because that is what a
 *  contact is a claim about.
 *
 *  2HBS IS SUPERPOSED ONTO 2HHB, AND IT HAS TO BE. Two crystals are two
 *  arbitrary orientations: toggle them raw and the whole molecule turns,
 *  which is large, dramatic and meaningless, and the one substituted
 *  residue is invisible underneath it. The fit is Kabsch on the
 *  alpha-carbons the two files share, matched by chain and residue number
 *  — hemoglobin is one numbering across both, unlike the myoglobin bench
 *  where the reference had to be the heme.
 *
 *  THE ANSWER IS THAT THEY LOOK THE SAME, and that is the lesson rather
 *  than a negative result. bake-hbs.js reached 0.585 A over the matched
 *  alpha-carbons for surface-test; this baker re-derives it by a different
 *  route and prints what it gets, so a disagreement between two
 *  independent fits of the same two files would be visible. Sickle-cell
 *  disease is not a misshapen protein: the fold is fine, and what changed
 *  is one patch of surface chemistry.
 *
 *  SECONDARY STRUCTURE IS READ off each file's HELIX records. Haemoglobin
 *  is all helix and no sheet — a claim these files make and this script
 *  repeats rather than deriving.
 *
 *  SOURCES. Both depositions are already committed under hemoglobin/data/
 *  for the lesson, so they are read from there and not downloaded twice.
 *  The bakes go in proteins/hemoglobin/data/, which is where this
 *  registry's checker looks.
 *
 *  CONNECTIVITY IS DEPOSITED, NEVER INFERRED, for anything off a HETATM:
 *  both files CONECT their hemes, and a distance cutoff wide enough for
 *  the 2.0 A Fe-N coordination also catches the 1,3 neighbours across the
 *  pyrroles and draws the ring with its diagonals filled in. Side chains
 *  are ATOM records with no CONECT of their own, so their internal bonds
 *  are the one thing here solved by distance — inside a single residue,
 *  where there is nothing else close enough to be wrong about.
 * ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const Bake = require('../../bake-lib.js');
const { kabsch, mul } = Bake;

const HERE = path.join(__dirname, '..');
const DATA = path.join(HERE, 'data');
const ROOT = path.join(HERE, '..', '..');

const REG = require('../../proteins.js');
const IO = require('../../tools/registry-io.js');
const ME = REG.byKey('hemoglobin');
const VIEWS = ME.variants;
const REF = ME.fit.on;

/* WHICH RESIDUE HOLDS THE IRON IS A PROPERTY OF THE PROTEIN, not of a
   variant, so it lives here and not in the registry: the alpha chain puts
   its proximal histidine at 87 and its distal at 58, the beta chain at 92
   and 63. Which chains are alpha and which are beta IS per variant — 2HBS
   has twice as many — and comes off the entry, which takes it from the
   file's own COMPND record. */
const SITE = { alpha: { prox: 87, dist: 58 }, beta: { prox: 92, dist: 63 } };

/* THE SICKLE POSITION AND THE POCKET IT WOULD LAND IN. Beta6 is glutamate
   in 2HHB and valine in 2HBS — one residue, one disease, and the reason
   both files are here. Phe85 and Leu88 are the hydrophobic pocket the
   valine docks into, drawn so a reader can see where it is going; within a
   SINGLE tetramer it never gets there, because the pocket it reaches is on
   the next molecule. That is the fibre, and the fibre is fibre-test's. */
const MUT = 6;
const ACCEPTOR = [85, 88];

const r2 = Bake.r2, xyz = Bake.xyz;
const elOf = l => (l.slice(76, 78).trim() || l.slice(12, 14).trim()).toUpperCase();
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const split = s => (s || '').split(',').map(x => x.trim()).filter(Boolean);

/* ---- the pocket -------------------------------------------------------

   Every heme in the file, the iron in it, and the two histidines that
   hold each one — plus beta6 and the pocket it packs against, which is
   what makes these two files a pair rather than two proteins.

   COORDINATES ARE NOT CENTRED HERE. They are centred with the trace, by
   the same vector, because the page draws both in one frame and a pocket
   centred on itself would sit at the origin with the protein around it
   somewhere else — the failure that reads as a bug in the ribbon. */
function pocket(text, kindOf) {
  const lines = text.split('\n');
  const atoms = [], bySerial = new Map();
  const keep = (line, group) => {
    const alt = line[16];
    if (alt !== ' ' && alt !== 'A') return;
    bySerial.set(+line.slice(6, 11), atoms.length);
    atoms.push({ name: line.slice(12, 16).trim(), el: elOf(line),
                 res: line.slice(17, 20).trim(), chain: line[21],
                 num: parseInt(line.slice(22, 26), 10), group, p: xyz(line) });
  };

  for (const line of lines) {
    const chain = line[21];
    const kind = kindOf[chain];
    if (!kind) continue;
    if (line.startsWith('HETATM')) {
      /* HEM only. Both files carry ordered water and 2HHB a phosphate; a
         card that drew either would be drawing the crystal, not the
         protein. */
      if (line.slice(17, 20).trim() !== 'HEM') continue;
      keep(line, 'heme');
    } else if (line.startsWith('ATOM')) {
      const num = parseInt(line.slice(22, 26), 10);
      const s = SITE[kind];
      let group = null;
      if (num === s.prox) group = 'proximal';
      else if (num === s.dist) group = 'distal';
      else if (kind === 'beta' && num === MUT) group = 'mutation';
      else if (kind === 'beta' && ACCEPTOR.includes(num)) group = 'acceptor';
      if (!group) continue;
      /* Side chain only, with CB kept as the stub that says which way the
         residue is attached. Backbone drawn here would be four atoms of
         ball-and-stick sitting inside a ribbon that already draws them. */
      const name = line.slice(12, 16).trim();
      if (name === 'N' || name === 'C' || name === 'O') continue;
      keep(line, group);
    }
  }

  /* Deposited connectivity first, for every pair whose ends are both kept.
     This KEEPS the cross-residue ones: the Fe-NE2 bond to the proximal
     histidine is the stick that says the iron is held by the protein
     rather than sitting in a hole. */
  const bonds = [], seen = new Set();
  const add = (i, j) => {
    const lo = Math.min(i, j), hi = Math.max(i, j);
    if (lo === hi || seen.has(lo + ':' + hi)) return;
    seen.add(lo + ':' + hi); bonds.push([lo, hi]);
  };
  for (const line of lines) {
    if (!line.startsWith('CONECT')) continue;
    const a = bySerial.get(+line.slice(6, 11));
    if (a === undefined) continue;
    for (let c = 11; c + 5 <= line.length; c += 5) {
      const f = line.slice(c, c + 5).trim();
      if (!f) continue;
      const b = bySerial.get(+f);
      if (b !== undefined) add(a, b);
    }
  }

  /* The side chains have no CONECT records, so their internal bonds come
     from distance — within ONE residue of one chain, where nothing else is
     near enough to be wrong about. 1.9 A is longer than any C-C or C-N in
     a side chain and shorter than the 2.0 A Fe-N it must not invent, which
     is why the heme group is excluded from this pass entirely. */
  for (let i = 0; i < atoms.length; i++) {
    for (let j = i + 1; j < atoms.length; j++) {
      const A = atoms[i], B = atoms[j];
      if (A.group === 'heme' || B.group === 'heme') continue;
      if (A.chain !== B.chain || A.num !== B.num) continue;
      if (dist(A.p, B.p) < 1.9) add(i, j);
    }
  }
  return { atoms, bonds };
}

/* ---- one view --------------------------------------------------------- */

/* Matched alpha-carbons between two structures, by chain id and residue
   number. Both files are human haemoglobin under one numbering, so a number
   means the same residue in each — which is what makes this a match rather
   than a guess, and what the myoglobin bench could NOT do across a whale and
   a beta chain. Anything modelled in only one file drops out, and the count
   is printed so a fit made on too few is visible rather than silent. */
function matchCA(a, b) {
  const P = [], Q = [];
  for (const [id, res] of a) {
    const ref = b.get(id);
    if (!ref) continue;
    const byNum = new Map(ref.map(r => [r.num, r]));
    for (const r of res) {
      const q = byNum.get(r.num);
      if (q) { P.push([r.x, r.y, r.z]); Q.push([q.x, q.y, q.z]); }
    }
  }
  return { P, Q };
}

function bake(v, ref) {
  const text = fs.readFileSync(path.join(ROOT, v.source.path), 'utf8');
  const chains = split(v.chains);
  const kindOf = {};
  for (const c of split(v.alpha)) kindOf[c] = 'alpha';
  for (const c of split(v.beta)) kindOf[c] = 'beta';
  for (const c of chains)
    if (!kindOf[c]) throw new Error(`${v.id}: chain ${c} is neither alpha nor beta`);

  const R = Bake.ssRanges(text);
  const traced = Bake.caTrace(text, new Set(chains));
  for (const c of chains)
    if (!traced.has(c)) throw new Error(`${v.id}: no CA on chain ${c}`);

  const site = pocket(text, kindOf);

  /* SUPERPOSE BEFORE CENTRING, in the crystal's own coordinates, because the
     fit is a rotation about the reference's origin and centring first would
     fit the two centroids to each other instead. Applied to the trace and the
     pocket alike — they are one object, and a pocket left behind by the
     rotation would sit outside the ribbon it belongs in. */
  let fit = null;
  if (ref) {
    const { P, Q } = matchCA(traced, ref.ca);
    if (P.length >= 3) {
      const k = kabsch(P, Q);
      fit = { rmsd: k.rmsd, n: P.length };
      const put = p => mul(k.R, p).map((x, i) => x + k.t[i]);
      for (const res of traced.values())
        for (const r of res) { const p = put([r.x, r.y, r.z]); r.x = p[0]; r.y = p[1]; r.z = p[2]; }
      for (const a of site.atoms) a.p = put(a.p);
    }
  }

  /* ONE CENTRE FOR BOTH, AND ONE CENTRE FOR BOTH FILES. The trace decides it
     — the ribbon is what the box frames — and the pocket is moved by the same
     vector so every iron stays where the protein put it. The REFERENCE's
     centre is what a superposed view then uses: centring on its own centroid
     would undo most of the fit that was just made. Solved here rather than
     left to `assemble` because the pocket needs the unrounded one; the
     trace's own copy is rounded to 0.01 A on the way out. */
  const all = [...traced.values()].flat();
  const c = ref ? ref.centre
    : [0, 1, 2].map(k => all.reduce((s, r) => s + [r.x, r.y, r.z][k], 0) / all.length);
  const shift = p => p.map((val, k) => r2(val - c[k]));

  const T = Bake.assemble(traced, R, c);
  const out = {
    source: v.source.id + '.pdb', ssFrom: Bake.ssFrom(R),
    centre: T.centre, order: T.order, chains: T.chains, radius: T.radius,
  };
  out.centreRaw = c;                     // for the next view to be moved by
  out.pocket = {
    atoms: site.atoms.map(a => ({ name: a.name, el: a.el, res: a.res,
                                  chain: a.chain, num: a.num, group: a.group,
                                  p: shift(a.p) })),
    bonds: site.bonds,
  };

  /* A tetramer is round enough that a solved basis would flip between
     re-bakes, so `frameOf` reports `worth:false` and no view is written —
     the bench opens in the deposited frame until a human turns it and
     pastes a basis into the registry. The extents are still solved, because
     they are a measurement of the shape and the panel prints them. */
  const F = Bake.frameOf(chains.flatMap(id => out.chains[id].CA));
  const V = Bake.viewFor(ME, F);
  out.view = V.view;
  out.extents = F.extents;
  out.frame = V.frame;

  const decl = Bake.declared(text);
  const hemes = new Set(site.atoms.filter(a => a.group === 'heme')
                                  .map(a => a.chain + ':' + a.num));
  const modelled = chains.reduce((s, id) => s + out.chains[id].nums.length, 0);
  const declared = chains.reduce((s, id) => s + (decl[id] || 0), 0);

  out.meta = {
    entry: v.source.id, view: v.id,
    method: Bake.method(text), resolution: Bake.resolution(text),
    title: Bake.line1(text, 'TITLE'), chainsInFile: Bake.chainCount(text),
    /* Tetramers, counted rather than typed: 2HBS's eight chains are two of
       them, and "two tetramers" is the fact the contact below depends on. */
    tetramers: chains.length / 4,
    alpha: split(v.alpha), beta: split(v.beta),
    helices: chains.reduce((s, id) => s + out.chains[id].helices, 0),
    strands: chains.reduce((s, id) => s + out.chains[id].strands, 0),
    counts: chains.map(id => ({ chain: id, kind: kindOf[id],
                                modelled: out.chains[id].nums.length,
                                declared: decl[id] === undefined ? null : decl[id] })),
    /* Counted off the kept atoms, so a heme dropped by the altloc rule
       cannot leave the panel claiming one that is not drawn. */
    hemes: hemes.size,
    irons: site.atoms.filter(a => a.el === 'FE').length,
    /* Beta6, read from the file rather than named: it is GLU in 2HHB and
       VAL in 2HBS, and typing either would put the whole subject of this
       pair in a string nothing checks. */
    beta6: [...new Set(site.atoms.filter(a => a.group === 'mutation')
                                 .map(a => a.res))],
    /* WHAT THE COMPARISON COST, and the number the panel leads on. A fit
       this tight IS the claim — two crystals of a protein one residue
       apart, and the backbones land on each other. */
    fitOn: ref ? REF : null,
    fitAtoms: fit ? fit.n : null,
    fitRmsd: fit ? +fit.rmsd.toFixed(3) : null,
  };

  out.read = {
    method: Bake.method(text),
    chainsInFile: Bake.chainCount(text),
    residues: modelled,
    declared: declared || null,
    /* Null for both: haemoglobin carries oxygen and catalyses nothing,
       which is a fact worth having in the index rather than an absence. */
    ec: Bake.ecNumbers(text)[0] || null,
    baked: `hb-${v.id}.json`,
  };
  return out;
}

function main() {
  const blocks = {};

  /* TWO PASSES. The reference is baked first, in its own frame and centred on
     its own trace; the other view is then fitted onto that copy in the
     crystal's coordinates and moved by the SAME centre, so the fit and the
     centring are one step rather than two that partly undo each other. */
  const refView = VIEWS.find(v => v.id === REF);
  const refOut = bake(refView, null);
  const refCA = Bake.caTrace(fs.readFileSync(path.join(ROOT, refView.source.path), 'utf8'),
                             new Set(split(refView.chains)));
  const ref = { ca: refCA, centre: refOut.centreRaw };

  for (const v of VIEWS) {
    const out = v.id === REF ? refOut : bake(v, ref);
    const { read, centreRaw, ...bakeOut } = out;
    fs.writeFileSync(path.join(DATA, read.baked), JSON.stringify(bakeOut));
    const m = out.meta, kb = (fs.statSync(path.join(DATA, read.baked)).size / 1024).toFixed(0);
    blocks[v.id] = read;
    console.log(`${v.id.padEnd(6)} ${read.residues} residues in ${m.counts.length} chains, ` +
      `${m.helices} helices, ${m.strands} strands, ` +
      `${m.hemes} hemes / ${m.irons} irons, beta6 ${m.beta6.join('+')}, ` +
      (m.fitOn ? `fit on ${m.fitOn} ${m.fitRmsd} A over ${m.fitAtoms} Ca`
               : 'reference frame') + `, ${kb} KB`);
  }
  const touched = IO.write('hemoglobin', blocks);
  console.log(`registry proteins.js  ${touched.length} variants updated`);
}

if (require.main === module) main();
module.exports = { pocket, bake };
