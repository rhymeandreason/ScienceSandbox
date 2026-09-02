#!/usr/bin/env node
/* =====================================================================
 *  prep.js — rubisco: the activation switch, and the whole particle.
 *
 *  Run:  node proteins/rubisco/tools/prep.js    (offline, no dependencies)
 *
 *  WHAT THIS PROTEIN IS. Rubisco fixes the carbon in every sugar on
 *  Earth, badly and in enormous quantity: it is the most abundant
 *  protein there is. The plant enzyme is L8S8 — eight large subunits
 *  that hold the active sites, eight small ones that do not — and it
 *  will not work until it has been ACTIVATED, which is CO2 adding onto
 *  Lys201 as a carbamate and Mg2+ then clamping onto that carbamate.
 *  The CO2 that switches the enzyme on is not the CO2 it fixes.
 *
 *  SO THE TWO SPINACH ENTRIES ARE ONE SWITCH, AND A CHECKER CAN SEE IT.
 *  8RUC declares KCX — carbamylated lysine — in MODRES and carries four
 *  of them, one per large chain in the file, with an Mg beside each.
 *  1RCX declares no MODRES at all and has plain LYS at 201 and no
 *  magnesium anywhere. Same protein, same numbering, one residue
 *  different, and that residue is the whole of the activation.
 *
 *  THE THREE, and review kept all of them:
 *
 *    1RCX-site   non-activated, one L+S pair. Lys201 bare, RuBP already
 *                sitting in the site, no Mg. The substrate is in the
 *                mouth of an enzyme that cannot yet act on it.
 *    8RUC-site   activated, one L+S pair. KCX201, Mg on the carbamate,
 *                and CAP — 2-carboxyarabinitol bisphosphate, the shape
 *                of the reaction's six-carbon intermediate, which is why
 *                this file is sharp: the analogue does not react.
 *    1RCX-L8S8   the whole hexadecamer, all sixteen chains, coloured
 *                large against small. The asymmetric unit IS the
 *                biological assembly here, so no symmetry is applied.
 *
 *  A MODIFIED RESIDUE IS A HETATM, so KCX201 is passed to caTrace
 *  through `Bake.modResidues` — without it 8RUC's large chain bakes with
 *  a hole exactly where the subject is, and the ribbon splines smoothly
 *  over it.
 *
 *  THE TWO SITE VIEWS ARE FITTED so they can be flipped. Kabsch on the
 *  large subunit's Ca, matched by residue number — the two entries are
 *  the same spinach protein numbered the same way, so the match is real
 *  and not a guess — with the residual over the site's own atoms printed
 *  beside it, because the site is what the bench is about. L8S8 is a
 *  different object at a different scale and keeps its own frame.
 *
 *  SOURCES, ~5 MB, gitignored. Re-fetch with:
 *    for id in 1RCX 8RUC; do
 *      curl -o proteins/rubisco/data/src/$id.pdb \
 *        https://files.rcsb.org/download/$id.pdb
 *    done
 * ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const Bake = require('../../bake-lib.js');
const { kabsch, mul } = Bake;

const HERE = path.join(__dirname, '..');
const SRC = path.join(HERE, 'data', 'src');
const DATA = path.join(HERE, 'data');

/* THE VIEW TABLE IS proteins/proteins.js, like every other protein here.
   Review kept all three candidates, so the table moved into the registry's
   `variants` and this file reads it back: which entries, which chains, which
   chain is the SUBJECT, and which residues make the site. What stays here is
   what a rubisco bake IS — the site, the superposition, and the numbers only
   those can give. */
const REG = require('../../proteins.js');
const IO = require('../../tools/registry-io.js');
const ME = REG.byKey('rubisco');
const VIEWS = ME.variants;

/* The reference the other site view is fitted onto: the non-activated one,
   because activation is a change FROM it. It is also the file L8S8 comes out
   of, so the assembly and the pair share a deposition. The registry says so,
   and `fit.among` there is what excuses the particle from the fit. */
const REF = ME.fit.on;

/* WHICH RESIDUES MAKE THE SITE IS THE REGISTRY'S, per variant: 201 is the
   switch — LYS in one file, KCX in the other — and 203/204 are the two
   carboxylates that hold the metal with it. What can be bound to it is here,
   because it is a fact about this protein's chemistry rather than about one
   view: the metal, the substrate, and the analogue that stands in for the
   intermediate. */
const CARGO = new Set(['MG', 'CAP', 'RUB']);

const r2 = Bake.r2, xyz = Bake.xyz;
const elOf = l => (l.slice(76, 78).trim() || l.slice(12, 14).trim()).toUpperCase();
const read = id => fs.readFileSync(path.join(SRC, id + '.pdb'), 'utf8');

/* ---- the site --------------------------------------------------------

   The switch residue, the two carboxylates beside it, the magnesium if there
   is one, and the sugar in the mouth — one chain's worth, as a flat atom list
   plus bonds. NOT CENTRED HERE: the trace's centre is applied to it by the
   same vector, or the site sits at the origin with the protein around it
   somewhere else. */
function pocket(text, chain, want) {
  const lines = text.split('\n');
  const atoms = [], bySerial = new Map();
  const keep = (line, group) => {
    const alt = line[16];
    if (alt !== ' ' && alt !== 'A') return;
    bySerial.set(+line.slice(6, 11), atoms.length);
    atoms.push({ name: line.slice(12, 16).trim(), el: elOf(line),
                 res: line.slice(17, 20).trim(),
                 num: parseInt(line.slice(22, 26), 10), group, p: xyz(line) });
  };

  for (const line of lines) {
    const rec = line.startsWith('HETATM') ? 'HETATM' : line.startsWith('ATOM') ? 'ATOM' : null;
    if (!rec || line[21] !== chain) continue;
    const name3 = line.slice(17, 20).trim();
    const num = parseInt(line.slice(22, 26), 10);
    if (CARGO.has(name3)) { keep(line, name3 === 'MG' ? 'metal' : 'bound'); continue; }
    if (num !== want.switch && !want.grip.includes(num)) continue;
    /* KCX 201 is a HETATM and still a residue of the chain; the plain LYS at
       the same number is an ATOM. Both are the switch. */
    const atom = line.slice(12, 16).trim();
    /* Side chain only. The backbone is already drawn, as ribbon. KCX keeps
       its carbamate — OQ1, OQ2, CX — which is the entire difference. */
    if (atom === 'N' || atom === 'C' || atom === 'O') continue;
    keep(line, num === want.switch ? 'switch' : 'grip');
  }
  if (!atoms.length) return null;

  const bonds = [], seen = new Set();
  const add = (i, j) => {
    const lo = Math.min(i, j), hi = Math.max(i, j);
    if (lo === hi || seen.has(lo + ':' + hi)) return;
    seen.add(lo + ':' + hi); bonds.push([lo, hi]);
  };
  /* DEPOSITED CONNECTIVITY for everything HETATM: both entries CONECT their
     sugar and their modified residue. A distance cutoff wide enough for the
     2.1 A Mg-O coordination also draws the ring's diagonals. */
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
  /* The ATOM side chains carry no CONECT of their own, so their internal
     bonds come from distance — inside one residue, where nothing else is
     close enough to be wrong about. The magnesium is excluded from this pass
     entirely: 2.1 A coordination is longer than any bond it must invent. */
  const near = (a, b) => Math.hypot(a.p[0] - b.p[0], a.p[1] - b.p[1], a.p[2] - b.p[2]);
  for (let i = 0; i < atoms.length; i++) for (let j = i + 1; j < atoms.length; j++) {
    const A = atoms[i], B = atoms[j];
    if (A.el === 'MG' || B.el === 'MG') continue;
    if (A.num !== B.num || A.group === 'bound') continue;
    if (near(A, B) < 1.9) add(i, j);
  }
  return { atoms, bonds };
}

/* Matched Ca pairs by residue number, between two chains of the same
   protein. Both entries are spinach rbcL numbered 9-475, so a number means
   the same residue in each; the count is printed so a fit made on too few is
   visible rather than silent. */
function matchByNum(a, b) {
  const idx = new Map(b.map(r => [r.num, r.p]));
  const P = [], Q = [];
  for (const r of a) { const q = idx.get(r.num); if (q) { P.push(r.p); Q.push(q); } }
  return { P, Q };
}

function bake(v, ref) {
  const text = read(v.source.id);
  const only = new Set(v.chains.split(','));
  const mod = Bake.modResidues(text);
  const R = Bake.ssRanges(text);

  const traced = Bake.caTrace(text, only, mod);
  if (!traced.size) throw new Error(v.id + ': no CA on chains ' + v.chains);
  /* Back into {num, p} while the fit happens, which is before the trace is
     assembled and centred. */
  const chains = new Map([...traced].map(([id, res]) =>
    [id, res.map(r => ({ num: r.num, p: [r.x, r.y, r.z] }))]));

  const site = v.site ? pocket(text, v.subject, v.site) : null;

  /* SUPERPOSE BEFORE CENTRING, in the crystal's own coordinates: the fit is a
     rotation about the reference's origin, and centring first would fit the
     two centroids to each other instead. */
  let fit = null;
  if (ref) {
    const { P, Q } = matchByNum(chains.get(v.subject), ref.ca);
    if (P.length < 3) throw new Error(v.id + ': only ' + P.length + ' residues matched');
    const k = kabsch(P, Q);
    const put = p => mul(k.R, p).map((x, i) => x + k.t[i]);
    for (const res of chains.values()) for (const r of res) r.p = put(r.p);
    if (site) for (const a of site.atoms) a.p = put(a.p);
    fit = { rmsd: k.rmsd, n: P.length };
  }

  /* ONE CENTRE FOR THE PAIR, so the fit just made is not slid back apart by
     re-centring. L8S8 is a different object at a different scale and centres
     on itself. */
  const c = ref ? ref.centre : (() => {
    let s = [0, 0, 0], n = 0;
    for (const res of chains.values()) for (const r of res) { s = s.map((x, k2) => x + r.p[k2]); n++; }
    return s.map(x => x / n);
  })();
  const shift = p => p.map((x, k) => r2(x - c[k]));

  const T = Bake.assemble(new Map([...chains].map(([id, res]) =>
    [id, res.map(r => ({ num: r.num, x: r.p[0], y: r.p[1], z: r.p[2] }))])), R, c);

  const out = { source: v.source.id + '.pdb', ssFrom: Bake.ssFrom(R), centre: T.centre,
                order: T.order, chains: T.chains, radius: T.radius };
  out.centreRaw = c;
  if (site) out.pocket = {
    atoms: site.atoms.map(a => ({ name: a.name, el: a.el, res: a.res, num: a.num,
                                  group: a.group, p: shift(a.p) })),
    bonds: site.bonds,
  };

  /* THE ROTATION IS THE REGISTRY'S WHERE A HUMAN HAS PICKED ONE FOR THIS
     VIEW'S FRAME, and then no view is baked at all — `Bake.viewFor` says so and
     names the result, so a re-aim is an edit and a reload rather than a re-bake
     of coordinates that did not change. The particle has a chosen basis and the
     site pair does not, which is why the variant goes in: the answer differs
     between two views of one protein. The fallback under it is the solved basis, and the two
     site views wear the REFERENCE's: they share a frame, and a basis each
     would turn the molecule on every switch and hide the carbamate inside the
     rotation. The extents are solved either way — they are a measurement of
     the shape and the panel prints them. */
  const all = [];
  for (const id of out.order) for (const p of out.chains[id].CA) all.push(p);
  const F = Bake.frameOf(all);
  const V = Bake.viewFor(ME, ref && ref.view ? { view: ref.view, frame: ref.frame } : F, v);
  if (V.view) out.view = V.view;
  out.frame = V.frame;
  out.extents = F.extents;

  const decl = Bake.declared(text);
  const kcx = (text.match(/^HETATM.{11}KCX/gm) || []).length;
  out.meta = {
    entry: v.source.id, view: v.id, purpose: v.purpose,
    chainsDrawn: out.order.length, subject: v.subject,
    method: Bake.method(text), resolution: Bake.resolution(text),
    title: Bake.line1(text, 'TITLE'), models: Bake.models(text),
    chainsInFile: Bake.chainCount(text),
    counts: out.order.map(id => ({ chain: id, modelled: out.chains[id].nums.length,
                                   declared: decl[id] === undefined ? null : decl[id] })),
    /* THE ACTIVATION, COUNTED OFF THE FILE rather than asserted: the modified
       residues the entry declares, and how many carbamylated lysines it
       actually holds. 1RCX declares none and holds none. */
    modres: [...mod],
    kcxAtoms: kcx,
    ligands: Bake.ligands(text, only, mod),
    ss: Bake.disulfides(text, only),
    site: site ? siteFacts(site) : null,
    fitOn: ref ? REF : null,
    fitResidues: fit ? fit.n : null,
    fitRmsd: fit ? +fit.rmsd.toFixed(2) : null,
  };
  out.read = {
    method: Bake.method(text),
    chainsInFile: Bake.chainCount(text),
    residues: out.meta.counts.reduce((k, x) => k + x.modelled, 0),
    declared: out.meta.counts.every(x => x.declared !== null)
      ? out.meta.counts.reduce((k, x) => k + x.declared, 0) : null,
    ec: Bake.ecNumbers(text)[0] || null,
    baked: `rubisco-${v.id}.json`,
  };
  return out;
}

/* WHAT THE SITE MEASURES, off the atoms just read. The switch residue's name
   is the claim the whole bench makes, so it is reported rather than typed;
   the magnesium distances are what "clamped on the carbamate" MEANS, in
   ångströms, and they come back null where there is no metal — which is the
   non-activated view's entire point and not a missing number. */
function siteFacts(site) {
  const d = (a, b) => Math.hypot(a.p[0] - b.p[0], a.p[1] - b.p[1], a.p[2] - b.p[2]);
  const sw = site.atoms.filter(a => a.group === 'switch');
  const mg = site.atoms.find(a => a.el === 'MG') || null;
  const bound = [...new Set(site.atoms.filter(a => a.group === 'bound').map(a => a.res))];
  const nearest = group => {
    if (!mg) return null;
    const set = site.atoms.filter(a => a.group === group && a.el === 'O');
    return set.length ? +Math.min(...set.map(a => d(mg, a))).toFixed(2) : null;
  };
  return {
    residue: sw.length ? sw[0].res : null,
    carbamate: sw.some(a => a.name === 'OQ1' || a.name === 'OQ2'),
    atoms: site.atoms.length,
    bonds: site.bonds.length,
    magnesium: !!mg,
    mgToSwitch: nearest('switch'),
    mgToGrip: nearest('grip'),
    mgToBound: nearest('bound'),
    bound: bound.length ? bound : null,
  };
}

function main() {
  const refCand = VIEWS.find(v => v.id === REF);
  const refOut = bake(refCand, null);
  const ref = {
    centre: refOut.centreRaw, view: refOut.view || null, frame: refOut.frame,
    ca: refOut.chains[refCand.subject].nums.map((n, i) =>
      ({ num: n, p: refOut.chains[refCand.subject].CA[i] })),
  };
  /* The reference's own Ca are already centred, so the fit onto them lands in
     the centred frame and `ref.centre` is then zero for everyone after it. */
  const refCentre = ref.centre;
  ref.centre = [0, 0, 0];

  const blocks = {};
  for (const v of VIEWS) {
    /* L8S8 is not fitted: it is the same file as the reference at a different
       scale, and a fit of sixteen chains onto one would be meaningless. */
    const out = v.id === REF ? refOut : bake(v, v.site ? ref : null);
    const { read: r, ...bakeOut } = out;
    delete bakeOut.centreRaw;
    fs.writeFileSync(path.join(DATA, r.baked), JSON.stringify(bakeOut));
    blocks[v.id] = r;
    const m = out.meta, kb = (fs.statSync(path.join(DATA, r.baked)).size / 1024).toFixed(0);
    console.log(`${v.id.padEnd(11)} ${m.chainsDrawn} chains, ${r.residues} residues` +
      (Bake.breaks(out) ? `, ${Bake.breaks(out)} break(s)` : '') +
      `, ss ${out.ssFrom}, ${out.extents.join(' × ')} A` +
      `, ligands [${m.ligands.join(' ')}]` +
      (m.site ? `, site ${m.site.residue}201 ${m.site.carbamate ? 'carbamylated' : 'bare'}` +
        `, Mg ${m.site.magnesium ? m.site.mgToSwitch + ' A to the carbamate' : 'absent'}` : '') +
      `, view ${out.frame}` +
      (m.fitOn ? `, fit ${m.fitRmsd} A over ${m.fitResidues}` : '') + `, ${kb} KB`);
  }
  console.log(`centre  reference centroid ${refCentre.map(x => x.toFixed(1)).join(', ')}`);
  const touched = IO.write('rubisco', blocks);
  console.log(`registry  proteins.js  ${touched.length} variants updated`);
}

if (require.main === module) main();
module.exports = { bake, pocket, VIEWS };
