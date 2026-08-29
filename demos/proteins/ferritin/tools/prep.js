#!/usr/bin/env node
/* =====================================================================
 *  prep.js — ferritin, at the two scales it exists at: one subunit, and
 *  the 24-subunit ball they build.
 *
 *  Run:  node proteins/ferritin/tools/prep.js   (offline, no deps)
 *
 *  REVIEWED. The view table was a CANDIDATES block here while it was under
 *  review; all three were kept, so it now lives in proteins/proteins.js with
 *  every other decision about this protein and this file READS it. What is
 *  still the baker's is which FILE each variant reads and what its pocket is
 *  made of.
 *
 *  THE ONE THING THIS FILE IS ABOUT: the biological assembly is not what
 *  1FHA.pdb holds. The asymmetric unit is ONE 183-residue chain, and the
 *  cage is assembly 1 — the same chain 24 times, deposited as 24 MODELS.
 *  Take bake-lib's modelOne on that file and you bake a twenty-fourth of
 *  an iron ball, which renders as a perfectly good four-helix bundle and
 *  says nothing about the ball. So the assembly is merged CHAIN-AWARE:
 *  model n becomes chain n, because caTrace keys residues by chain and 24
 *  models of residue 27 under one id is one chain wearing the last
 *  model's coordinates.
 *
 *  THE HELIX RECORDS ARE THE ASYMMETRIC UNIT'S, replicated onto every
 *  chain. That is not detection: all 24 copies are the same deposited
 *  chain under a symmetry operator, so chain A's assignment IS chain X's.
 *
 *  SOURCES, for a re-run:
 *    https://files.rcsb.org/download/1FHA.pdb      asymmetric unit, 1 chain
 *    https://files.rcsb.org/download/1FHA.pdb1.gz  assembly 1, 24 models
 * ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const Bake = require('../../bake-lib.js');

const DATA = path.join(__dirname, '..', 'data');
/* THE DEPOSITIONS ARE NOT COMMITTED — 2.5 MB of assembly against a 106 KB
   bake — so a fresh checkout re-runs this after two curls rather than finding
   out from a stack trace. data/.gitignore names the same two files. */
const SRC = {
  '1FHA.pdb':  'https://files.rcsb.org/download/1FHA.pdb',
  '1FHA.pdb1': 'https://files.rcsb.org/download/1FHA.pdb1.gz  (then gunzip)',
};
function read(f) {
  const at = path.join(DATA, f);
  if (!fs.existsSync(at))
    throw new Error(`${f} is not in data/ — curl -o proteins/ferritin/data/${f} ${SRC[f]}`);
  return fs.readFileSync(at, 'utf8');
}

/* THE VIEW TABLE IS proteins/proteins.js, like every other protein here. Which
   FILE a variant reads is part of what it is, and the registry says so with
   `assembly`; the asymmetric unit is one chain and the cage is 24 models of
   it, so the two cannot share a source name. */
const REG = require('../../proteins.js');
const IO = require('../../tools/registry-io.js');
const ME = REG.byKey('ferritin');
const VIEWS = ME.variants;
const fileOf = v => v.assembly ? v.source.id + '.pdb1' : v.source.id + '.pdb';

/* THE FERROXIDASE SITE is the registry's `pocket`, as the file itself draws
   it. The Fe CONECTs to Glu27 OE1, Glu62 OE1 and His65 ND1 — site A of the
   di-iron centre, with only one of the two irons modelled. Glu61 and Tyr34
   are listed there and carry no bond to the metal, which is a thing to SEE
   rather than a gap.

   The two Ca are crystallisation, at 0.5 and 0.33 occupancy, and are not in
   the site. They stay in `meta.ligands` and out of the picture. */
const CHAIN = 'A';

const elOf = l => (l.slice(76, 78).trim() || l.slice(12, 14).trim()).toUpperCase();

/* ---- the assembly, merged chain-aware -------------------------------
 *
 *  Every model becomes its own chain id, and its HETATM iron with it.
 *  Returns the rewritten text, so everything downstream is reading a
 *  perfectly ordinary multi-chain PDB.
 */
const ID = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
function merge(text) {
  const out = [];
  let n = -1;
  for (const line of text.split('\n')) {
    if (line.startsWith('MODEL')) { n++; continue; }
    if (!line.startsWith('ATOM') && !line.startsWith('HETATM')) continue;
    if (n < 0) continue;
    if (n >= ID.length) throw new Error(`${n + 1} models, only ${ID.length} chain ids`);
    out.push(line.slice(0, 21) + ID[n] + line.slice(22));
  }
  if (n < 1) throw new Error('assembly file holds no MODEL records — wrong file?');
  return { text: out.join('\n'), models: n + 1 };
}

/* ---- the pocket ------------------------------------------------------
 *
 *  NOT CENTRED HERE. It is moved by the trace's own centre vector, unrounded,
 *  or it lands at the origin with the protein around it somewhere else.
 */
function ferroxidase(text, want) {
  const lines = text.split('\n');
  const atoms = [], bySerial = new Map();
  const keep = (line, group) => {
    const alt = line[16];
    if (alt !== ' ' && alt !== 'A') return;
    bySerial.set(+line.slice(6, 11), atoms.length);
    atoms.push({ name: line.slice(12, 16).trim(), el: elOf(line),
                 res: line.slice(17, 20).trim(), num: parseInt(line.slice(22, 26), 10),
                 group, p: Bake.xyz(line) });
  };
  for (const line of lines) {
    if (line[21] !== CHAIN) continue;
    if (line.startsWith('HETATM')) {
      if (line.slice(17, 20).trim() !== want.metal) continue;
      keep(line, 'metal');
    } else if (line.startsWith('ATOM')) {
      if (!want.res.includes(parseInt(line.slice(22, 26), 10))) continue;
      /* Side chain only. The backbone is already drawn, as ribbon. */
      const name = line.slice(12, 16).trim();
      if (name === 'N' || name === 'C' || name === 'O') continue;
      keep(line, 'side');
    }
  }
  if (!atoms.some(a => a.group === 'metal')) return null;

  const bonds = [], seen = new Set();
  const add = (i, j) => {
    const lo = Math.min(i, j), hi = Math.max(i, j);
    if (lo === hi || seen.has(lo + ':' + hi)) return;
    seen.add(lo + ':' + hi); bonds.push([lo, hi]);
  };
  /* THE COORDINATION COMES OFF CONECT, never off a distance cutoff. A cutoff
     wide enough for a 2.2 A Fe-O also invents bonds across the site. Waters
     are CONECTed to this iron too and are simply not in bySerial. */
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
  /* Side chains are ATOM lines and have no CONECT, so their internal bonds
     come from distance INSIDE one residue, where nothing else is near enough
     to be wrong about. The metal is excluded from this pass entirely. */
  const near = (a, b) => Math.hypot(a.p[0] - b.p[0], a.p[1] - b.p[1], a.p[2] - b.p[2]);
  for (let i = 0; i < atoms.length; i++)
    for (let j = i + 1; j < atoms.length; j++) {
      const A = atoms[i], B = atoms[j];
      if (A.group !== 'side' || B.group !== 'side' || A.num !== B.num) continue;
      if (near(A, B) < 1.9) add(i, j);
    }
  return { atoms, bonds };
}

/* Every iron in the merged assembly, one per subunit, as a pocket with no
   bonds: 24 points saying where the metal enters a shell of protein. */
function irons(text) {
  const atoms = [];
  for (const line of text.split('\n')) {
    if (!line.startsWith('HETATM')) continue;
    if (line.slice(17, 20).trim() !== 'FE') continue;
    atoms.push({ name: 'FE', el: 'FE', res: 'FE', num: parseInt(line.slice(22, 26), 10),
                 group: 'metal', p: Bake.xyz(line) });
  }
  return atoms.length ? { atoms, bonds: [] } : null;
}

/* ---- one candidate --------------------------------------------------- */

function bake(v) {
  const raw = read(fileOf(v));
  /* modelOne is what a single-model x-ray file wants and what the assembly
     must NOT get. Which one this is, is the candidate's own declaration. */
  const M = v.assembly ? merge(raw) : { text: Bake.modelOne(raw), models: 1 };
  const text = M.text;

  const chains = Bake.caTrace(text);
  if (!chains.size) throw new Error(v.id + ': no CA atoms');

  /* THE ASSEMBLY CARRIES NO PER-CHAIN HELIX RECORDS — it is one chain under
     24 symmetry operators — so the asymmetric unit's assignment is replicated
     onto every chain. Read, not detected: it is the same deposited chain. */
  const R0 = Bake.ssRanges(raw);
  const R = { H: [], E: [] };
  for (const id of chains.keys()) {
    for (const h of R0.H) R.H.push({ ...h, chain: id });
    for (const e of R0.E) R.E.push({ ...e, chain: id });
  }

  const T = Bake.assemble(chains, R);
  const c = T.centre;                       /* rounded, and the pocket needs it */
  const shift = p => [Bake.r2(p[0] - c[0]), Bake.r2(p[1] - c[1]), Bake.r2(p[2] - c[2])];

  const out = { source: fileOf(v), ssFrom: Bake.ssFrom(R0), centre: T.centre,
                order: T.order, chains: T.chains, radius: T.radius };

  const site = v.pocket === 'irons' ? irons(text)
             : v.pocket ? ferroxidase(text, v.pocket) : null;
  if (site) out.pocket = {
    atoms: site.atoms.map(a => ({ name: a.name, el: a.el, res: a.res,
                                  group: a.group, p: shift(a.p) })),
    bonds: site.bonds,
  };

  /* A SOLVED BASIS OR NONE, and the shape decides. The bundle is elongated
     enough to have axes; the cage is a sphere and its three extents are the
     same number, so frameOf writes no view and the bake opens deposited until
     a human turns it and pastes one in. Nothing is chosen in a registry yet —
     this protein is not in one. */
  const all = [];
  for (const id of out.order) for (const p of out.chains[id].CA) all.push(p);
  const F = Bake.frameOf(all);
  /* `Bake.viewFor` decides between a basis chosen in the registry and the
     solved one, and names the result. Nobody has chosen for ferritin — the
     cage's three extents are equal and the deposited frame was reviewed and
     kept — so this is the solved answer for the subunit views and `deposited`
     for the cage. The extents are still solved either way: they are a
     measurement of the shape, and the panel prints them. */
  const V = Bake.viewFor(ME, F);
  if (V.view) out.view = V.view;
  out.extents = F.extents;
  out.frame = V.frame;

  const decl = Bake.declared(raw);
  out.meta = {
    entry: v.source.id, view: v.id, purpose: v.purpose,
    method: Bake.method(raw), resolution: Bake.resolution(raw),
    title: Bake.line1(raw, 'TITLE'),
    models: Bake.models(raw), assemblyModels: M.models,
    chainsInFile: Bake.chainCount(text), chainsDrawn: out.order.length,
    counts: out.order.map(id => ({ chain: id, modelled: out.chains[id].nums.length,
                                   declared: decl.A === undefined ? null : decl.A })),
    ss: Bake.disulfides(raw),
    ligands: Bake.ligands(text),
    pocket: out.pocket ? { atoms: out.pocket.atoms.length,
                           bonds: out.pocket.bonds.length,
                           residues: [...new Set(site.atoms.filter(a => a.group === 'side')
                             .map(a => a.res + a.num))] } : null,
  };
  out.read = {
    method: Bake.method(raw),
    chainsInFile: Bake.chainCount(text),
    residues: out.meta.counts.reduce((k, c2) => k + c2.modelled, 0),
    declared: out.meta.counts.reduce((k, c2) => k + (c2.declared || 0), 0) || null,
    ec: Bake.ecNumbers(raw)[0] || null,
    baked: `ferritin-${v.id}.json`,
  };
  return out;
}

function main() {
  const blocks = {};
  for (const v of VIEWS) {
    const out = bake(v);
    const file = out.read.baked;
    const { read: r, ...bakeOut } = out;
    fs.writeFileSync(path.join(DATA, file), JSON.stringify(bakeOut));
    blocks[v.id] = r;
    const kb = (fs.statSync(path.join(DATA, file)).size / 1024).toFixed(0);
    console.log(`${v.id.padEnd(8)} ${out.order.length} chain(s), ${r.residues} of ` +
      `${r.declared} residues` +
      (Bake.breaks(out) ? `, ${Bake.breaks(out)} break(s)` : '') +
      `, ss ${out.ssFrom}, ${out.extents.join(' × ')} A, ` +
      `ligands [${out.meta.ligands.join(' ')}], ` +
      `pocket ${out.meta.pocket ? out.meta.pocket.atoms + ' atoms/' +
                                  out.meta.pocket.bonds + ' bonds' : 'none'}, ` +
      `view ${out.frame}, ${kb} KB`);
  }
  const touched = IO.write('ferritin', blocks);
  console.log(`registry  proteins.js  ${touched.length} variants updated`);
}

if (require.main === module) main();
module.exports = { VIEWS, bake, ferroxidase, merge };
