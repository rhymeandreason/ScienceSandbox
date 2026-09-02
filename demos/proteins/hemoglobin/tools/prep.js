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
 *          glutamate replaced by valine, and TWO tetramers in the
 *          asymmetric unit because the thing it was deposited to show is
 *          the contact between them.
 *
 *  BOTH TETRAMERS OF 2HBS, AND THAT IS THE POINT. The lateral contact is
 *  beta6 valine of one tetramer packing into a hydrophobic pocket on a
 *  beta chain of the next. Bake one tetramer and the mutation is a side
 *  chain pointing at empty space — which is exactly what it looks like in
 *  2HHB as well, so the bench would draw two files and show no difference
 *  it was built to show. This baker MEASURES that contact rather than
 *  asserting it, and prints the pair and the distance it found.
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

const HERE = path.join(__dirname, '..');
const DATA = path.join(HERE, 'data');
const ROOT = path.join(HERE, '..', '..');

const REG = require('../../proteins.js');
const IO = require('../../tools/registry-io.js');
const ME = REG.byKey('hemoglobin');
const VIEWS = ME.variants;

/* WHICH RESIDUE HOLDS THE IRON IS A PROPERTY OF THE PROTEIN, not of a
   variant, so it lives here and not in the registry: the alpha chain puts
   its proximal histidine at 87 and its distal at 58, the beta chain at 92
   and 63. Which chains are alpha and which are beta IS per variant — 2HBS
   has twice as many — and comes off the entry, which takes it from the
   file's own COMPND record. */
const SITE = { alpha: { prox: 87, dist: 58 }, beta: { prox: 92, dist: 63 } };

/* THE SICKLE POSITION AND THE POCKET IT LANDS IN. Beta6 is glutamate in
   2HHB and valine in 2HBS — one residue, one disease, and the reason both
   files are here. Phe85 and Leu88 are the acceptor pocket on the partner
   beta chain; they are named rather than found because a search for
   "whatever is near beta6" in a file with eight chains answers with
   crystal packing as readily as with the contact. Whether the contact is
   THERE is still measured. */
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

/* ---- the contact ------------------------------------------------------

   The closest approach between a beta6 side chain and an acceptor residue
   on a DIFFERENT beta chain. Measured, not declared: in 2HHB it comes back
   at ~25 A, which is the honest way to say that the healthy tetramer makes
   no such contact, and in 2HBS it comes back under 4 A between the two
   tetramers of the asymmetric unit. A number either way beats a sentence
   that is only true of one of the files. */
function contact(site) {
  const from = site.atoms.filter(a => a.group === 'mutation' && a.el === 'C'
                                      && a.name !== 'CA');
  const to = site.atoms.filter(a => a.group === 'acceptor');
  let best = null;
  for (const f of from) for (const t of to) {
    if (f.chain === t.chain) continue;
    const d = dist(f.p, t.p);
    if (!best || d < best.d) best = { d, f, t };
  }
  if (!best) return null;
  return { d: +best.d.toFixed(2),
           from: `${best.f.res}${best.f.num}${best.f.chain}.${best.f.name}`,
           to: `${best.t.res}${best.t.num}${best.t.chain}.${best.t.name}` };
}

/* ---- one view --------------------------------------------------------- */

function bake(v) {
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

  /* ONE CENTRE FOR BOTH. The trace decides it — the ribbon is what the box
     frames — and the pocket is moved by the same vector so every iron stays
     where the protein put it. Solved here rather than left to `assemble`
     because the pocket needs the unrounded one; the trace's own copy is
     rounded to 0.01 A on the way out. */
  const all = [...traced.values()].flat();
  const c = [0, 1, 2].map(k => all.reduce((s, r) => s + [r.x, r.y, r.z][k], 0) / all.length);
  const shift = p => p.map((val, k) => r2(val - c[k]));

  const T = Bake.assemble(traced, R, c);
  const out = {
    source: v.source.id + '.pdb', ssFrom: Bake.ssFrom(R),
    centre: T.centre, order: T.order, chains: T.chains, radius: T.radius,
  };
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
    contact: contact(site),
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
  for (const v of VIEWS) {
    const out = bake(v);
    const { read, ...bakeOut } = out;
    fs.writeFileSync(path.join(DATA, read.baked), JSON.stringify(bakeOut));
    const m = out.meta, kb = (fs.statSync(path.join(DATA, read.baked)).size / 1024).toFixed(0);
    blocks[v.id] = read;
    console.log(`${v.id.padEnd(6)} ${read.residues} residues in ${m.counts.length} chains ` +
      `(${m.tetramers} tetramer${m.tetramers > 1 ? 's' : ''}), ${m.helices} helices, ` +
      `${m.strands} strands, ${m.hemes} hemes / ${m.irons} irons, ` +
      `beta6 ${m.beta6.join('+')}, ` +
      (m.contact ? `closest beta6 to acceptor ${m.contact.d} A ` +
                   `(${m.contact.from} - ${m.contact.to})` : 'no acceptor pair') +
      `, ${kb} KB`);
  }
  const touched = IO.write('hemoglobin', blocks);
  console.log(`registry proteins.js  ${touched.length} variants updated`);
}

if (require.main === module) main();
module.exports = { pocket, contact, bake };
