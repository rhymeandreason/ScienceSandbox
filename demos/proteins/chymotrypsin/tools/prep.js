#!/usr/bin/env node
/* =====================================================================
 *  prep.js — chymotrypsinogen and alpha-chymotrypsin, for the bench.
 *
 *  Run:  node proteins/chymotrypsin/tools/prep.js   (offline, no deps)
 *
 *  Sources, gitignored like every other deposition:
 *    cd proteins/chymotrypsin/data/src
 *    curl -O https://files.rcsb.org/download/2CGA.pdb
 *    curl -O https://files.rcsb.org/download/4CHA.pdb
 *
 *  REVIEWED AND REGISTERED, so which entries, which chains and which one
 *  opens are proteins/proteins.js's answers and this file READS them. Both
 *  candidates survived. SITES below stays here and is not registry
 *  material: which residues make a site is this protein's own fact, the
 *  way myoglobin's pocket table is.
 *
 *  WHAT THIS PAIR IS FOR. One protein, before and after it is switched on
 *  by being cut. 2CGA is chymotrypsinogen: a single chain of 245, folded,
 *  inert. 4CHA is the same molecule after trypsin cuts 15-16 and
 *  chymotrypsin then excises the dipeptides 14-15 and 147-148 — three
 *  chains of 13 / 131 / 97, held together by the disulfides that were
 *  already there. The activation is legible as the CHAIN COUNT, which is
 *  why this bench colours by chain rather than by secondary structure.
 *
 *  THE NUMBERING IS SHARED, WHICH IS RARE AND IS WHAT MAKES THE PAIR
 *  CHEAP. Both entries number in chymotrypsinogen numbering, so residue
 *  57 is His57 in both files and the superposition is a match on residue
 *  number rather than a sequence alignment. It also means the cut sites
 *  are readable off the chain spans directly: 4CHA jumps 11 -> 16 and
 *  146 -> 149, and those four missing residues are the two cuts.
 *
 *  THE CATALYTIC TRIAD IS ALREADY ASSEMBLED IN THE ZYMOGEN, which is the
 *  fact this bench exists to show and the reason both views carry the
 *  same pocket. His57-Asp102-Ser195 sit together in 2CGA in almost the
 *  arrangement they have in the enzyme; what the cut builds is elsewhere,
 *  and the second SITE below draws it — Ile16's new alpha-amino group
 *  swinging in to salt-bridge Asp194, which is what forms the substrate
 *  pocket and the oxyanion hole. A bench that drew only the triad would
 *  make activation look like nothing happened.
 * ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const Bake = require('../../bake-lib.js');
const { kabsch, mul } = Bake;

const HERE = path.join(__dirname, '..');
const SRC = path.join(HERE, 'data', 'src');
const DATA = path.join(HERE, 'data');

const r2 = Bake.r2, xyz = Bake.xyz;
const elOf = l => (l.slice(76, 78).trim() || l.slice(12, 14).trim()).toUpperCase();

/* ---- the candidates -------------------------------------------------
 *
 *  TWO STRUCTURES AND TWO SITES, WHICH ARE DIFFERENT KINDS OF THING and
 *  are kept on separate axes for that reason. The structures are states
 *  in TIME — before the cut and after it. The sites are places to POINT,
 *  and switching between them moves nothing.
 *
 *  An earlier table had three flat candidates, `zymogen` / `active` /
 *  `switch`, and it read as a three-step mechanism that the depositions
 *  do not contain: the last two were one file drawn twice. Nothing
 *  happens between them, and no structure of an intermediate exists,
 *  because the salt bridge below forms as a consequence of the cut
 *  rather than as a step after it.
 *
 *  SO EVERY STRUCTURE CARRIES EVERY SITE, and the second one is the
 *  reason that is worth the bytes rather than a symmetry for its own
 *  sake: Ile16's nitrogen is 18.32 A from Asp194 in the zymogen and
 *  2.85 A in the enzyme. Drawing the site on the uncut structure is not
 *  an empty pocket, it is the measurement.
 */
const SITES = {
  triad: {
    label: 'catalytic triad',
    /* The proton relay itself, and the distance the panel prints. */
    residues: [{ res: 57, group: 'his' }, { res: 102, group: 'asp' },
               { res: 195, group: 'ser' }],
    /* NAMED ATOMS, NOT NEAREST-ANYTHING. A closest-approach over whole side
       chains picks a different pair of atoms on each structure, and then the
       row means one thing on one view and something else on the other. This
       is the hydroxyl and the imidazole nitrogens: the proton's actual path. */
    contact: [{ group: 'ser', names: ['OG'] },
              { group: 'his', names: ['ND1', 'NE2'] }] },
  newterm: {
    label: 'new N-terminus',
    /* Ile16 asks for its backbone N, which every other residue here is
       denied: that nitrogen is the whole point of the site, since it is
       not a free alpha-amino group until the chain is cut in front of
       it. In the zymogen it is an ordinary amide bonded to residue 15,
       and the distance below says where it is instead. */
    residues: [{ res: 16, group: 'ile', backbone: true },
               { res: 194, group: 'asp' }],
    contact: [{ group: 'ile', names: ['N'] },
              { group: 'asp', names: ['OD1', 'OD2'] }] },
};

/* THE STRUCTURES ARE THE REGISTRY'S, like every other protein here. The
   reference is `fit.on` rather than a flag in this file — one decision, one
   place, and re-ordering the variants cannot silently re-aim the bench. */
const REG = require('../../proteins.js');
const IO = require('../../tools/registry-io.js');
const ME = REG.byKey('chymotrypsin');
const REF = ME.fit.on;
const STRUCTURES = ME.variants.map(v => ({
  id: v.id, entry: v.source.id, chains: v.chains, purpose: v.purpose,
  default: !!v.default, fit: v.id === REF ? false : true,
}));

const read = id => fs.readFileSync(path.join(SRC, id + '.pdb'), 'utf8');

/* ---- the pocket ------------------------------------------------------
 *
 *  A few named residues' side chains, one flat atom list plus bonds, in
 *  the file's own coordinates — the caller shifts them by the same vector
 *  as the trace, because a pocket centred on itself sits at the origin
 *  with the protein somewhere else and that reads as a bug in the ribbon.
 *
 *  CHAIN-AWARE, WHICH IS NOT OPTIONAL HERE. The triad is spread over two
 *  chains in 4CHA — His57 and Asp102 on B, Ser195 on C — so a lookup by
 *  residue number alone would collect the second copy of the molecule
 *  (chains E/F/G) as well and draw the triad twice, 30 A apart.
 *
 *  NO CONECT PASS, BECAUSE THERE IS NOTHING TO CONNECT. Every atom here
 *  is an ATOM line; the only HETATM in either file is water. Bonds come
 *  from distance INSIDE one residue, where nothing else is near enough to
 *  be wrong about, at the same 1.9 A cutoff myoglobin's histidines use.
 */
function pocket(text, only, want) {
  const byRes = new Map(want.map(w => [w.res, w]));
  const atoms = [];
  for (const line of text.split('\n')) {
    if (!line.startsWith('ATOM')) continue;
    if (!only.has(line[21])) continue;
    const alt = line[16];
    if (alt !== ' ' && alt !== 'A') continue;
    const num = parseInt(line.slice(22, 26), 10);
    const w = byRes.get(num);
    if (!w) continue;
    const name = line.slice(12, 16).trim();
    /* Side chain only, CB kept as the stub saying which way the residue is
       attached — the ribbon already draws the backbone. Ile16 is the
       exception and asks for its backbone N: that nitrogen is the whole
       point of the view, since it does not exist as a free alpha-amino
       group until the chain is cut in front of it. */
    /* Side chain only, CB kept as the stub that says which way the residue
       hangs off the chain. CA goes too, unlike myoglobin's pocket: here it
       would put a ball directly on top of a ribbon that already draws it,
       and it would win the closest-approach above on the uncut structure,
       where the real answer is a carboxylate 18 A away. The residue that
       asked for its backbone keeps N and CA, because the bond between them
       is the thing being drawn. */
    if (!w.backbone && (name === 'N' || name === 'CA' || name === 'C' || name === 'O')) continue;
    if (w.backbone && (name === 'C' || name === 'O')) continue;
    atoms.push({ name, el: elOf(line), res: line.slice(17, 20).trim(),
                 group: w.group, num, p: xyz(line) });
  }
  if (!atoms.length) return null;

  const bonds = [];
  const near = (a, b) => Math.hypot(a.p[0] - b.p[0], a.p[1] - b.p[1], a.p[2] - b.p[2]);
  for (let i = 0; i < atoms.length; i++)
    for (let j = i + 1; j < atoms.length; j++)
      if (atoms[i].num === atoms[j].num && near(atoms[i], atoms[j]) < 1.9)
        bonds.push([i, j]);
  return { atoms, bonds };
}

/* The gap each pocket is about, measured rather than asserted: the closest
   approach between two of its groups. Ser195 OG to His57 NE2 is the proton
   the triad moves; Ile16 N to Asp194 OD is the salt bridge. A number that
   comes out at 8 A is the view saying the thing it claims is not there. */
function contact(site, a, b) {
  if (!site) return null;
  const pick = w => site.atoms.filter(x => x.group === w.group && w.names.includes(x.name));
  const A = pick(a), B = pick(b);
  if (!A.length || !B.length) return null;
  let best = null;
  for (const p of A) for (const q of B) {
    const d = Math.hypot(p.p[0] - q.p[0], p.p[1] - q.p[1], p.p[2] - q.p[2]);
    if (!best || d < best.d) best = { d, from: `${p.res}${p.num} ${p.name}`,
                                      to: `${q.res}${q.num} ${q.name}` };
  }
  return best && { ...best, d: r2(best.d) };
}

/* ---- the superposition -----------------------------------------------
 *
 *  MATCHED ON RESIDUE NUMBER, which is legitimate here and almost nowhere
 *  else: both entries use chymotrypsinogen numbering, so number 57 is the
 *  same residue in both files. Over the whole molecule rather than a
 *  domain, because nothing hinges — the fold is the same fold, and what
 *  the pair is about is a chain being severed inside it.
 */
function fitOnto(from, onto) {
  const key = r => r.chain + ':' + r.num;
  const map = new Map(onto.map(r => [String(r.num), r]));
  const P = [], Q = [];
  for (const r of from) {
    const m = map.get(String(r.num));
    if (m) { P.push(r.p); Q.push(m.p); }
  }
  if (P.length < 3) throw new Error('fit: only ' + P.length + ' matched residues');
  const k = kabsch(P, Q);
  return { R: k.R, t: k.t, rmsd: r2(k.rmsd), n: P.length, key };
}

const apply = (fit, p) => mul(fit.R, p).map((v, i) => v + fit.t[i]);

/* ---- one candidate ---------------------------------------------------- */

function bake(v, ctx) {
  const text = read(v.entry);
  const only = new Set(v.chains.split(','));

  const traced = Bake.caTrace(text, only);
  if (!traced.size) throw new Error(v.id + ': no CA on chains ' + v.chains);
  /* Into {num, p} so the fit can move them before the trace is assembled
     and rounded. Chain id rides along: it is what keeps the two copies of
     the molecule in 4CHA apart. */
  const res = [];
  for (const [cid, list] of traced)
    for (const r of list) res.push({ chain: cid, num: r.num, p: [r.x, r.y, r.z] });

  /* EVERY SITE ON EVERY STRUCTURE. They are all moved by the one fit and
     the one centre below, so a reader switching site under an unchanged
     camera sees the balls swap and the ribbon hold perfectly still. */
  const sites = {};
  for (const [key, S] of Object.entries(SITES)) {
    const site = pocket(text, only, S.residues);
    if (site) sites[key] = site;
  }

  /* SUPERPOSE BEFORE CENTRING, in the crystal's own coordinates: the fit is
     a rotation about the reference's origin, and centring first would fit
     the two centroids to each other instead. Trace and pocket alike — they
     are one object. */
  let fit = null;
  if (ctx.ref) {
    fit = fitOnto(res, ctx.ref);
    for (const r of res) r.p = apply(fit, r.p);
    for (const site of Object.values(sites))
      for (const a of site.atoms) a.p = apply(fit, a.p);
  } else {
    ctx.ref = res.map(r => ({ num: r.num, p: r.p.slice() }));
  }

  /* ONE CENTRE FOR ALL THREE, the reference's. Centring each view on its own
     centroid would slide back apart most of the fit just made — and 4CHA's
     centroid is not 2CGA's, because four residues of it are gone. */
  if (!ctx.centre)
    ctx.centre = [0, 1, 2].map(k => res.reduce((s, r) => s + r.p[k], 0) / res.length);
  const c = ctx.centre;
  const shift = p => p.map((val, k) => r2(val - c[k]));

  const chains = new Map();
  for (const r of res) {
    if (!chains.has(r.chain)) chains.set(r.chain, []);
    chains.get(r.chain).push({ num: r.num, x: r.p[0], y: r.p[1], z: r.p[2] });
  }
  const R = Bake.ssRanges(text);
  const T = Bake.assemble(chains, R, c);

  const out = { source: v.entry + '.pdb', ssFrom: Bake.ssFrom(R), centre: T.centre,
                order: T.order, chains: T.chains, radius: T.radius };

  /* KEYED BY SITE, because the page picks one at draw time. `pocket` in the
     singular is what kit/proteinbox.js's setPocket takes, and the page hands
     it one of these — the box has no opinion about there being more than one
     and must not acquire one. */
  out.pockets = {};
  for (const [key, site] of Object.entries(sites))
    out.pockets[key] = {
      atoms: site.atoms.map(a => ({ name: a.name, el: a.el, res: a.res,
                                    group: a.group, p: shift(a.p) })),
      bonds: site.bonds,
    };

  /* ONE BASIS, WORN BY BOTH — they share a frame, so a basis per structure
     would turn the molecule on every switch and hide the cut inside the
     rotation.

     WHOSE BASIS IS THE REGISTRY'S ANSWER. The solver had none to give: two
     barrels at 44 x 39 x 37 are close enough that a solved basis flips
     between re-bakes. So a human turned it on the bench, pressed `copy this
     view`, and it lives in proteins.js — `Bake.viewFor` then writes NO view
     here and the frame reads `chosen in the registry`. The extents are still
     solved: they are a measurement of the shape and the panel prints them. */
  const all = [];
  for (const id of out.order) for (const p of out.chains[id].CA) all.push(p);
  if (!ctx.frame) {
    const F = Bake.frameOf(all);
    ctx.frame = Bake.viewFor(ME, F);
    ctx.extents = F.extents;
  }
  if (ctx.frame.view) out.view = ctx.frame.view;
  out.extents = ctx.extents;
  out.frame = ctx.frame.frame;

  const decl = Bake.declared(text);
  out.meta = {
    entry: v.entry, view: v.id, chainsDrawn: out.order.length,
    method: Bake.method(text), resolution: Bake.resolution(text),
    title: Bake.line1(text, 'TITLE'), models: Bake.models(text),
    chainsInFile: Bake.chainCount(text),
    counts: out.order.map(id => ({ chain: id, modelled: out.chains[id].nums.length,
                                   declared: decl[id] === undefined ? null : decl[id] })),
    /* The disulfides are the reason three chains are one molecule, so they
       are counted here and the panel prints how many cross a chain boundary
       — that number is 0 in the zymogen and 2 in the enzyme, off the same
       records, and it is the pair's second measurement after the chain
       count itself. */
    ss: Bake.disulfides(text, only),
    ssCross: crossChain(text, only),
    ligands: Bake.ligands(text, only),
    fitOn: fit ? ctx.refEntry : null,
    fitOnWhat: fit ? `${fit.n} residues matched by number` : null,
    fitRmsd: fit ? fit.rmsd : null,
    /* WHAT EACH SITE CLAIMS, measured through the same coordinates it is
       drawn from, on both structures. The triad's number barely moves
       between them and the salt bridge's goes from 18 A to 3 — that pair of
       comparisons IS this bench, and neither half is typed anywhere. */
    contacts: Object.fromEntries(Object.entries(sites).map(([key, site]) =>
      [key, contact(site, ...SITES[key].contact)])),
  };
  /* THE VARIANT, NOT THE ENTRY. `fit.on` in the registry names a variant id
     and check-proteins.js holds the two level, so baking the PDB code here
     fails the pair against a reference that reads as a different thing. */
  if (!ctx.refEntry) ctx.refEntry = v.id;

  out.read = {
    method: Bake.method(text),
    chainsInFile: Bake.chainCount(text),
    residues: out.meta.counts.reduce((k, x) => k + x.modelled, 0),
    declared: out.meta.counts.every(x => x.declared !== null)
      ? out.meta.counts.reduce((k, x) => k + x.declared, 0) : null,
    ec: Bake.ecNumbers(text)[0] || null,
    baked: `chymotrypsin-${v.id}.json`,
  };
  return out;
}

/* SSBOND records whose two ends are on different chains. Both ends must be
   drawn, or the count describes a structure that is not on screen. */
function crossChain(text, only) {
  let n = 0;
  for (const line of text.split('\n')) {
    if (!line.startsWith('SSBOND')) continue;
    if (!(only.has(line[15]) && only.has(line[29]))) continue;
    if (line[15] !== line[29]) n++;
  }
  return n;
}

function main() {
  fs.mkdirSync(DATA, { recursive: true });
  /* The reference first, so it sets the frame and the centre the others
     wear. `fit:false` marks it; sorting on that rather than on position
     means re-ordering the table cannot silently re-aim the bench. */
  const order = [...STRUCTURES].sort((a, b) => (a.fit === false ? -1 : 0) -
                                                (b.fit === false ? -1 : 0));
  const ctx = { ref: null, refEntry: null, centre: null, frame: null };
  const index = [];
  for (const v of order) {
    const out = bake(v, ctx);
    const { read: r, ...bakeOut } = out;
    fs.writeFileSync(path.join(DATA, r.baked), JSON.stringify(bakeOut));
    index.push({ id: v.id, entry: v.entry, chains: v.chains, purpose: v.purpose,
                 default: !!v.default, baked: r.baked, read: r });
    const kb = (fs.statSync(path.join(DATA, r.baked)).size / 1024).toFixed(0);
    const cn = out.meta.contacts;
    console.log(`${v.id.padEnd(8)} ${v.entry} chains ${v.chains}, ` +
      `${r.residues}${r.declared ? ' of ' + r.declared : ''} residues` +
      (Bake.breaks(out) ? `, ${Bake.breaks(out)} break(s)` : '') +
      `, ss ${out.ssFrom}, ${out.extents.join(' × ')} A` +
      `, S-S ${out.meta.ss.length} (${out.meta.ssCross} cross-chain)` +
      Object.entries(cn).map(([k, c]) => c ? `, ${k} ${c.from}–${c.to} ${c.d} A` : '').join('') +
      (out.meta.fitOn ? `, fitted ${out.meta.fitRmsd} A` : ', reference') +
      `, view ${out.frame}, ${kb} KB`);
  }
  /* THE BENCH READS THIS, not a second copy of the table. While the protein
     is under review the candidate list only exists here, and a page with its
     own copy is the thing that goes stale the first time one is dropped. */
  const touched = IO.write('chymotrypsin', Object.fromEntries(
    index.map(v => [v.id, v.read])));
  console.log(`registry  proteins.js  ${touched.length} variants updated`);

  /* THE TWO AXES, WRITTEN OUT FOR THE PAGE. The structures are the
     registry's, copied out so the bench does not have to load it; `sites`
     carries only the label and the order they are offered in, because which
     residues make one is decided here and a page that knew would be a second
     opinion about it. */
  fs.writeFileSync(path.join(DATA, 'candidates.json'), JSON.stringify({
    structures: index,
    sites: Object.entries(SITES).map(([id, S]) => ({ id, label: S.label })),
  }, null, 1));
  console.log(`candidates.json  ${index.length} structures x ` +
              `${Object.keys(SITES).length} sites`);
}

if (require.main === module) main();
module.exports = { bake, pocket, SITES };
