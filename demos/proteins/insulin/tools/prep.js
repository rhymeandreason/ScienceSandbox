#!/usr/bin/env node
/* =====================================================================
 *  prep.js — six insulin depositions down to what the bench draws.
 *
 *  Run:  node proteins/insulin/tools/prep.js   (offline, no dependencies)
 *
 *  UNDER REVIEW, SO THE VIEW TABLE IS HERE. Every other baker in
 *  proteins/ opens the registry, because its protein has been selected.
 *  Nothing about insulin has been decided yet, so CANDIDATES below is
 *  the table, and it moves into proteins/proteins.js `variants` the day
 *  a human looks at the bench and says which of these earn a place.
 *
 *  WHAT THIS PROTEIN IS. A hormone that is cut out of a bigger chain.
 *  Mature insulin is two peptides, A of 21 and B of 30, held together
 *  by two disulfides with a third inside A — and they were one chain,
 *  proinsulin, until a protease cut the 35-residue C-peptide out of the
 *  middle. So the bench's job is to put the precursor and the product
 *  in one frame, and then to show what the product does when it is put
 *  away: six copies around two zincs.
 *
 *  SOURCES, for a re-run from scratch:
 *
 *    for id in 1MSO 4INS 3I40 2KQP; do
 *      curl -o proteins/insulin/data/src/$id.pdb \
 *        https://files.rcsb.org/download/$id.pdb
 *    done
 *    curl -o proteins/insulin/data/src/1MSO.pdb1 \
 *      https://files.rcsb.org/download/1MSO.pdb1
 *
 *  THE HEXAMER IS DEPOSITED AS MODELS. 1MSO's asymmetric unit is two AB
 *  units; assembly 1 is three MODELs of that same unit, twelve chains,
 *  six insulins. `Bake.modelOne` would take a third of it and render a
 *  perfectly convincing dimer that says nothing about storage, so the
 *  assembly is merged chain-aware here and the copies are renamed A..L.
 *  Its two zincs are on the three-fold axis, so each is deposited three
 *  times at one position and deduplicated by coordinate.
 *
 *  EVERY VIEW IS SUPERPOSED ONTO ONE AB UNIT. A deposition's frame is
 *  its crystal's, so six files are six arbitrary rotations and flipping
 *  between them would turn the molecule instead of showing the change.
 *  The fit is on the reference's own A and B chains, matched by residue
 *  number, which is exactly the correspondence proinsulin also has:
 *  its residues 1-30 ARE the B chain and 66-86 ARE the A chain, so the
 *  precursor lands with the hormone inside it superposed and only the
 *  C-peptide sticking out.
 * ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const Bake = require('../../bake-lib.js');
const { superpose } = require('../../../hexokinase/tools/pdbio.js');

const HERE = path.join(__dirname, '..');
const SRC = path.join(HERE, 'data', 'src');
const DATA = path.join(HERE, 'data');

/* ---- the candidates, while this protein is under review --------------
 *
 *  `file` is what is read; `chains` is what is drawn, or null for all of
 *  them. `assembly` merges every MODEL rather than taking the first.
 */
const CANDIDATES = [
  { id: '3I40', file: '3I40.pdb', chains: 'A,B', ref: true,
    purpose: 'the hormone itself: two chains, three disulfides' },
  { id: '1MSO', file: '1MSO.pdb', chains: null,
    purpose: 'human at 1.0 A — two AB units, and the B-chain sheet that pairs them' },
  { id: 'hexamer', file: '1MSO.pdb1', header: '1MSO.pdb', assembly: true, chains: null, zinc: true,
    purpose: 'the storage form: six insulins around two zincs' },
  { id: '2KQP', file: '2KQP.pdb', chains: null, model: true, proinsulin: true,
    purpose: 'before the cut: one chain, with the C-peptide still in it' },
  { id: '4INS', file: '4INS.pdb', chains: null,
    purpose: 'pig, the insulin diabetics were injected with for sixty years' },
];

const read = f => fs.readFileSync(path.join(SRC, f), 'utf8');

/* ---- reading one candidate ------------------------------------------
 *
 *  Everything about the PDB itself is proteins/bake-lib.js — the altloc
 *  rule, ss read rather than detected, SEQRES, SSBOND, HETATM, the
 *  centring. What is here is what makes this insulin's baker: the
 *  assembly merge, the A/B chain roles, and the one superposition.
 */

/* MODELS MERGED CHAIN-AWARE, renamed so no copy overwrites another. A
   parse keyed on chain id alone gives back four chains wearing the last
   model's coordinates, and it renders as a clean dimer. */
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
function assembly(text, only) {
  const bodies = text.split(/^MODEL /m).slice(1);
  if (!bodies.length) throw new Error('no MODEL records: not an assembly file');
  const chains = new Map(), R = { H: [], E: [] }, ss = Bake.ssRanges(text);
  const rename = new Map();               // "model:chain" -> new id
  bodies.forEach((body, m) => {
    for (const [id, res] of Bake.caTrace(body, only)) {
      const to = LETTERS[chains.size];
      rename.set(m + ':' + id, to);
      chains.set(to, res);
      for (const h of ss.H) if (h.chain === id) R.H.push({ ...h, chain: to });
      for (const e of ss.E) if (e.chain === id) R.E.push({ ...e, chain: to });
    }
  });
  return { chains, R, rename, models: bodies.length };
}

/* WHICH CHAIN IS THE A CHAIN, off SEQRES rather than off the letter. The
   file's own declaration is 21 for A and 30 for B, and the ids that carry
   them differ between entries and between models of an assembly. */
function roles(text) {
  const decl = Bake.declared(text), out = {};
  for (const id in decl) out[id] = decl[id] === 21 ? 'A' : decl[id] === 30 ? 'B' : null;
  return out;
}

/* ---- the superposition -----------------------------------------------
 *
 *  Onto the reference's A and B chains, matched by residue number.
 *  Proinsulin has no A and B chains to match: it is one chain of 86, and
 *  the correspondence is the cut itself, which is why it is written out
 *  rather than searched for. B1-30 are residues 1-30 and A1-21 are 66-86;
 *  everything between is the C-peptide, which is fitted onto nothing
 *  because it has no counterpart in the mature hormone at all.
 */
const CUT = { B: 0, A: 65 };              // proinsulin offset per chain role

function pairsFor(chains, role, refCA) {
  const out = { mob: [], ref: [] };
  const byNum = r => { const m = new Map(); for (const p of r) m.set(p.num, p); return m; };
  for (const k of ['A', 'B']) {
    const R = byNum(refCA[k]);
    /* One chain per role: the first, since a dimer's second copy is the
       same molecule again and pairing both would weight the fit by how
       many copies the crystal happened to hold. */
    const id = Object.keys(role).find(c => role[c] === k);
    if (id === undefined) continue;
    for (const p of chains.get(id) || [])
      if (R.has(p.num)) { out.mob.push(p); out.ref.push(R.get(p.num)); }
  }
  return out;
}

function proinsulinPairs(res, refCA) {
  const out = { mob: [], ref: [] };
  for (const k of ['A', 'B']) {
    const R = new Map(refCA[k].map(p => [p.num, p]));
    for (const p of res) {
      const n = p.num - CUT[k];
      if (n < 1 || !R.has(n)) continue;
      /* B is 1-30 and A is 66-86, so the two windows do not overlap and a
         residue can only satisfy one of them. Guard it anyway: an entry
         numbered differently would otherwise fit the same residue twice
         and the rmsd would come out flattering. */
      if (k === 'B' && p.num > 30) continue;
      if (k === 'A' && p.num <= 65) continue;
      out.mob.push(p); out.ref.push(R.get(n));
    }
  }
  return out;
}

/* THE DISULFIDES, LABELLED BY CHAIN ROLE. bake-lib's `disulfides` returns
   residue numbers alone, which is right for a protein whose chains are copies
   of one thing and useless here: insulin's three bonds are A6-A11 inside the A
   chain and A7-B7 and A20-B19 holding the two chains together, and "7-7" says
   none of that. Deduplicated, because a file holding two or six copies of the
   hormone lists the same three bonds again per copy. */
function ssPairs(text, role, only) {
  const seen = new Set();
  for (const line of text.split('\n')) {
    if (!line.startsWith('SSBOND')) continue;
    const c1 = line[15], c2 = line[29];
    if (only && !(only.has(c1) && only.has(c2))) continue;
    seen.add(`${role[c1] || c1}${line.slice(17, 21).trim()}\u2013` +
             `${role[c2] || c2}${line.slice(31, 35).trim()}`);
  }
  return [...seen];
}

/* ---- the zinc site ---------------------------------------------------
 *
 *  Two zincs on the hexamer's three-fold axis, each held by three His B10.
 *  A pocket, in kit/proteinbox.js's shape, in the trace's frame and moved
 *  by the trace's centre — a pocket centred on itself sits at the origin
 *  with the protein around it somewhere else.
 *
 *  THE COORDINATION BONDS ARE MEASURED, because the file CONECTs none of
 *  them: a Zn-NE2/ND1 bond is ~2.1 A and nothing else in the picture comes
 *  within 2.6 A of a zinc, so the cutoff is narrow and named. The
 *  histidines' own bonds are the same 1.9 A rule myoglobin uses, inside
 *  one residue where nothing else is close enough to be wrong about.
 */
const elOf = l => (l.slice(76, 78).trim() || l.slice(12, 14).trim()).toUpperCase();

function zincSite(text, role) {
  const atoms = [], zseen = new Set();
  /* NO HYDROGENS. 1MSO is 1.0 A and rides them, which no ribbon-scale
     ball-and-stick in this repo draws — and they would double the atom count
     and treble the sticks around a site whose subject is four heavy atoms. */
  const keep = (line, group) => elOf(line) === 'H' || atoms.push({
    name: line.slice(12, 16).trim(), el: elOf(line), res: line.slice(17, 20).trim(),
    group, p: Bake.xyz(line) });

  for (const line of text.split('\n')) {
    const alt = line[16];
    if (alt !== ' ' && alt !== 'A') continue;
    if (line.startsWith('HETATM') && line.slice(17, 20).trim() === 'ZN') {
      /* Deposited once per symmetry copy at one position: three coincident
         zincs would draw as one ball and be counted as three. */
      const key = Bake.xyz(line).map(v => Math.round(v * 10)).join(',');
      if (zseen.has(key)) continue;
      zseen.add(key);
      keep(line, 'zinc');
    } else if (line.startsWith('ATOM') && parseInt(line.slice(22, 26), 10) === 10
               && role[line[21]] === 'B') {
      const name = line.slice(12, 16).trim();
      if (name === 'N' || name === 'C' || name === 'O') continue;   // ribbon draws these
      keep(line, 'his');
    }
  }

  const bonds = [], seen = new Set();
  const near = (a, b) => Math.hypot(a.p[0] - b.p[0], a.p[1] - b.p[1], a.p[2] - b.p[2]);
  const add = (i, j) => { const k = Math.min(i, j) + ':' + Math.max(i, j);
                          if (i !== j && !seen.has(k)) { seen.add(k); bonds.push([i, j]); } };
  for (let i = 0; i < atoms.length; i++) for (let j = i + 1; j < atoms.length; j++) {
    const A = atoms[i], B = atoms[j], d = near(A, B);
    if (A.group === 'his' && B.group === 'his' && d < 1.9) add(i, j);
    if (A.group !== B.group && d < 2.6) add(i, j);        // Zn-N coordination
  }
  return { atoms, bonds, zincs: zseen.size };
}

/* ---- one view -------------------------------------------------------- */

function bake(v, ctx) {
  const raw = read(v.file);
  /* AN ASSEMBLY FILE IS NOT SELF-DESCRIBING. 1MSO.pdb1 has no REMARK 2, no
     EXPDTA and an entry id of XXXX — every fact about the EXPERIMENT is in the
     deposition it was generated from, so provenance is read there and only the
     coordinates come from the file in front of us. */
  const head = v.header ? read(v.header) : raw;
  const text = v.model ? Bake.modelOne(raw) : raw;
  const only = v.chains ? new Set(v.chains.split(',')) : null;

  let chains, R, role = roles(raw), merged = null;
  if (v.assembly) {
    merged = assembly(text, only);
    chains = merged.chains; R = merged.R;
    /* Roles follow the renamed chains, so the zinc site and the counts read
       the same ids the trace does. */
    const was = role; role = {};
    for (const [key, to] of merged.rename) role[to] = was[key.split(':')[1]];
  } else {
    chains = Bake.caTrace(text, only);
    R = Bake.ssRanges(text);
  }
  if (!chains.size) throw new Error(v.id + ': no CA atoms on those chains');

  /* THE REFERENCE SETS THE FRAME AND IS FITTED ONTO NOTHING. */
  let fit = null, pairs = 0;
  if (v.ref) {
    ctx.refCA = { A: [], B: [] };
    /* First chain per role. A reference deposited as a dimer holds each role
       twice, and the second copy is the same molecule again. */
    for (const [id, res] of chains)
      if (role[id] && !ctx.refCA[role[id]].length) ctx.refCA[role[id]] = res;
  } else {
    const p = v.proinsulin ? proinsulinPairs([...chains.values()][0], ctx.refCA)
                           : pairsFor(chains, role, ctx.refCA);
    if (p.mob.length < 20) throw new Error(`${v.id}: only ${p.mob.length} residues pair`);
    fit = superpose(p.mob, p.ref);
    pairs = p.mob.length;
    for (const [id, res] of chains) chains.set(id, fit.apply(res));
  }

  /* ALL CENTRED ON THE REFERENCE'S CENTRE. Re-centring each on itself would
     slide back apart most of the fit just made: the hexamer would put its own
     middle where the monomer's is, and the monomer would stop being one of
     the six. */
  const T = Bake.assemble(chains, R, ctx.centre);
  if (!ctx.centre) ctx.centre = T.centre;

  const out = { source: v.file, ssFrom: Bake.ssFrom(R), centre: T.centre,
                order: T.order, chains: T.chains, radius: T.radius };

  if (v.zinc) {
    const site = zincSite(text, role);
    if (fit) site.atoms = site.atoms.map(a => {
      const q = fit.apply([{ x: a.p[0], y: a.p[1], z: a.p[2] }])[0];
      return { ...a, p: [q.x, q.y, q.z] };
    });
    out.pocket = { atoms: site.atoms.map(a => ({ ...a,
                     p: a.p.map((c, i) => Bake.r2(c - ctx.centre[i])) })),
                   bonds: site.bonds };
    out.zincs = site.zincs;
  }

  /* ONE BASIS, WORN BY EVERY VIEW. They share a frame, so a basis per entry
     would turn the molecule on each switch and hide the difference inside the
     rotation. Solved on the reference; the extents stay per view, because they
     are a measurement of that shape and the panel prints them. */
  const all = [];
  for (const id of out.order) for (const p of out.chains[id].CA) all.push(p);
  const F = Bake.frameOf(all);
  if (!ctx.picked) ctx.picked = Bake.viewFor(null, F);
  if (ctx.picked.view) out.view = ctx.picked.view;
  out.extents = F.extents;
  out.frame = ctx.picked.frame;

  /* WHICH CHAINS ARE ONE HORMONE. An A chain and the B chain deposited after
     it are one insulin held by two disulfides; twelve chains are six of them.
     Here rather than on the page for the reason the chain roles are: it is a
     claim about the structure, read off SEQRES lengths in file order. */
  const units = {};
  let unit = -1;
  for (const id of T.order) {
    if (role[id] === 'A' || unit < 0) unit++;
    units[id] = unit;
  }

  const decl = Bake.declared(head);
  const declOf = id => {
    if (!merged) return decl[id] === undefined ? null : decl[id];
    const was = [...merged.rename].find(([, to]) => to === id);
    const src = was && was[0].split(':')[1];
    return decl[src] === undefined ? null : decl[src];
  };
  out.meta = {
    entry: v.id === 'hexamer' ? '1MSO' : v.id,
    purpose: v.purpose, chainsDrawn: out.order.length,
    method: Bake.method(head), resolution: Bake.resolution(head),
    title: Bake.line1(head, 'TITLE'), models: Bake.models(raw),
    chainsInFile: Bake.chainCount(text),
    assembly: !!v.assembly,
    units, unitCount: unit + 1,
    counts: out.order.map(id => ({ chain: id, role: role[id] || null,
                                   modelled: out.chains[id].nums.length,
                                   declared: declOf(id) })),
    /* Three per insulin: A6-A11 inside the A chain, and A7-B7 and A20-B19
       holding the two chains together. Read off SSBOND, never counted from
       cysteines. */
    ss: Bake.disulfides(text, only),
    /* THE ASSEMBLY'S SSBOND RECORDS DESCRIBE ITS ASYMMETRIC UNIT, and the
       file then repeats that unit once per model. Six records under twelve
       chains would read as a hexamer held by six bonds instead of eighteen. */
    ssTotal: Bake.disulfides(text, only).length * (v.assembly ? merged.models : 1),
    ssPairs: ssPairs(text, v.assembly ? roles(head) : role, only),
    ligands: Bake.ligands(text, only),
    fitOn: v.ref ? null : ctx.ref,
    fitOnWhat: v.ref ? null : `${pairs} residues of the A and B chains`,
    fitRmsd: fit ? Bake.r2(fit.rmsd) : null,
    /* WHAT THE CUT TAKES OUT, counted rather than quoted: the precursor's
       chain minus the residues that pair with the hormone. */
    cPeptide: v.proinsulin
      ? out.chains[out.order[0]].nums.length - pairs : null,
  };
  out.read = {
    method: Bake.method(head),
    chainsInFile: Bake.chainCount(text),
    residues: out.meta.counts.reduce((k, c) => k + c.modelled, 0),
    declared: out.meta.counts.every(c => c.declared !== null)
      ? out.meta.counts.reduce((k, c) => k + c.declared, 0) : null,
    /* A hormone classifies no reaction, so this is null everywhere and is
       kept only so the block has the shape every other protein's has. */
    ec: Bake.ecNumbers(head)[0] || null,
    baked: `insulin-${v.id}.json`,
  };
  return out;
}

function main() {
  const order = [...CANDIDATES].sort((a, b) => (b.ref ? 1 : 0) - (a.ref ? 1 : 0));
  const ctx = { centre: null, picked: null, refCA: null, ref: order[0].id };
  for (const v of order) {
    const out = bake(v, ctx);
    const file = out.read.baked;
    const { read: r, ...bakeOut } = out;
    fs.writeFileSync(path.join(DATA, file), JSON.stringify(bakeOut));
    const kb = (fs.statSync(path.join(DATA, file)).size / 1024).toFixed(0);
    console.log(`${v.id.padEnd(8)} ${out.order.length} chain(s), ${r.residues} of ` +
      `${r.declared} residues` +
      (Bake.breaks(out) ? `, ${Bake.breaks(out)} break(s)` : '') +
      `, ss ${out.ssFrom}, ${out.extents.join(' × ')} A, ` +
      `${out.meta.ss.length} SS, ligands [${out.meta.ligands.join(' ')}]` +
      (out.pocket ? `, pocket ${out.pocket.atoms.length} atoms / ${out.zincs} Zn` : '') +
      `, view ${out.frame}, ` +
      (out.meta.fitOn ? `fitted ${out.meta.fitRmsd} A on ${out.meta.fitOnWhat}` : 'reference') +
      `, ${kb} KB`);
  }
  console.log('\nUNDER REVIEW: nothing written to proteins/proteins.js yet.');
}

if (require.main === module) main();
module.exports = { bake, CANDIDATES };
