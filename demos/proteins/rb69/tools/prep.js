#!/usr/bin/env node
/* =============================================================================
 *  proteins/rb69/tools/prep.js — RB69 gp43: empty, copying, proofreading
 * =============================================================================
 *    node proteins/rb69/tools/prep.js
 *
 *  writes proteins/rb69/data/rb69-<ID>.json, one per CANDIDATES row.
 *
 *  UNDER REVIEW: the candidates live here, not in a registry. AddingAProtein.md
 *  step 6 is what moves them into proteins/nucleic-acids.js.
 *
 *  RB69 gp43 is a B-family polymerase — the family human pol α, δ and ε belong
 *  to — deposited three times as one 903-residue construct: apo, copying, and
 *  proofreading. That is the whole reason to prefer it over Taq for a
 *  replication lesson. Taq is pol I, a repair and Okazaki-processing enzyme
 *  famous for PCR; this is a replicative polymerase caught doing both of its
 *  jobs with the same residue numbering in every file.
 *
 *  THE THIRD STRUCTURE IS THE LESSON. 1IG9 has the primer's 3' end in the
 *  polymerase site with an incoming dTTP against it; 1CLQ has the same enzyme
 *  with the primer end pulled out and fed into the exonuclease site, a second
 *  active site 30-odd angstroms away. Proofreading as a position, not a
 *  caption. The distance is measured here and printed there.
 *
 *  THE FIT IS ON THE PROTEIN, WHICH IS THE OPPOSITE OF proteins/polymerase.
 *  There the DNA was the fixed thing and the fingers closed on it; here the
 *  protein is the fixed frame and the DNA is what travels between two sites.
 *  Fit on the substrate and the two sites would move instead, which is exactly
 *  backwards from the claim.
 *
 *  AND IT IS A CORE FIT, NOT A GLOBAL ONE, BECAUSE THE GLOBAL NUMBER IS A
 *  LIE IN BOTH DIRECTIONS. All 901 shared Ca superpose at 6.5 A, which reads
 *  as two different proteins; the same pair trimmed to the part that does not
 *  move superposes at 1.2 A over ~670 residues, which reads as one protein
 *  with a domain swung across it. Neither number alone is the story, so both
 *  are baked and the panel prints both. The core is found by refitting with
 *  outliers dropped at twice the current RMSD until it stops changing — a
 *  measurement, so nothing here has to name a domain or quote a boundary from
 *  a paper.
 *
 *  1CLQ'S TEMPLATE STRAND IS NUMBERED BACKWARDS, 12 down to 1, and that is
 *  invisible until it renders. Every `runs()` in this repo splits a chain
 *  where the numbers stop ascending, so the strand comes out as twelve
 *  separate one-residue stubs with no backbone between them — a duplex drawn
 *  as a row of crumbs. The residues are reversed here so the numbers ascend;
 *  the polyline is identical either way, and `reversed` records that it was
 *  done rather than leaving a silent disagreement with the deposition.
 *
 *  THE POCKET IS WHATEVER IS WITHIN `SITE_R` OF THE GROWING END, which is the
 *  only definition of "in the site" this file can state without quoting
 *  residue numbers out of a paper. It picks up the incoming dTTP and three
 *  calciums in 1IG9 and one calcium in 1CLQ; it correctly leaves out 1CLQ's
 *  GDP at 61 A and 1IH7's GMP, which lands 34 A from where an incoming
 *  nucleotide sits and is therefore crystallisation cargo rather than a
 *  ligand in the site. Connectivity is the file's CONECT records; a distance
 *  cutoff wide enough for metal coordination also draws a triphosphate's own
 *  diagonals.
 *
 *  THE METALS ARE CALCIUM AND THE PRIMER IS DIDEOXY-TERMINATED. Both are how
 *  the experiment stops the reaction it is a picture of: Ca sits where Mg
 *  belongs and does not catalyse, and 1IG9's primer has no 3'-OH to extend.
 *  Two independent stalls, and neither is a fact about the enzyme.
 * ============================================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const Bake = require(path.join(__dirname, '..', '..', 'bake-lib.js'));

const HERE = path.join(__dirname, '..', 'data');
const SRC = path.join(HERE, 'src');

/* Within this of the primer's 3'-terminal C1', a HETATM group is in the site.
   15 A is a sphere around the growing end wide enough to hold an incoming
   nucleotide and its metals and narrow enough to exclude the far one in each
   file — checked against the measured distances, which the bake prints. */
const SITE_R = 15;

/* WHAT IS BEING PROPOSED. `primer` is the subject strand: the one whose 3' end
   is the growing end, which is what every measurement here is anchored to.
   1IG9's own COMPND names it; 1CLQ's does not, so `expect` asserts the thing
   that identifies it — in an editing complex the growing end is frayed out of
   the duplex, and if that stops being true the chain assignment is wrong. */
const CANDIDATES = [
  { id: '1IG9', ref: true,
    what: 'RB69 gp43, polymerising ternary complex',
    purpose: 'copying — the primer end in the polymerase site, dTTP against the template',
    primer: 'P', template: 'T',
    expect: { pairedEnd: true, inSite: 'TTP' } },
  { id: '1CLQ',
    what: 'RB69 gp43, editing complex',
    purpose: 'proofreading — the same primer end pulled into the exonuclease site',
    primer: 'E', template: 'D',
    expect: { pairedEnd: false } },
  { id: '1IH7',
    what: 'RB69 gp43, apo',
    purpose: 'the empty hand — no DNA, and the shape it holds without one',
    primer: null, template: null,
    expect: {} },
];

const REF = CANDIDATES.find(c => c.ref).id;
const elOf = l => (l.slice(76, 78).trim() || l.slice(12, 14).trim()).toUpperCase();
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/* ---- superposition ----------------------------------------------------- */

const caMap = text => {
  const m = new Map();
  for (const [, res] of Bake.caTrace(text, null))
    for (const r of res) m.set(r.num, [r.x, r.y, r.z]);
  return m;
};

/* THE PART THAT DID NOT MOVE, found rather than named. Fit everything, drop
   whatever is beyond twice the current RMSD, refit, until the set stops
   shrinking. It returns the transform, the core it used and both residuals,
   because the DIFFERENCE between them is the domain motion. */
function coreFit(C, R) {
  let keys = [...C.keys()].filter(k => R.has(k));
  const global = Bake.kabsch(keys.map(x => C.get(x)), keys.map(x => R.get(x)));
  let k = global;
  for (let i = 0; i < 8; i++) {
    k = Bake.kabsch(keys.map(x => C.get(x)), keys.map(x => R.get(x)));
    const d = keys.map(x => dist(Bake.mul(k.R, C.get(x)).map((v, j) => v + k.t[j]), R.get(x)));
    const cut = Math.max(1.5, 2 * Math.sqrt(d.reduce((s, v) => s + v * v, 0) / d.length));
    const next = keys.filter((_, j) => d[j] < cut);
    if (next.length === keys.length || next.length < 100) break;
    keys = next;
  }
  if (Bake.det(k.R) < 0) throw new Error('coreFit: kabsch returned a reflection');
  return { k, core: keys.length, all: [...C.keys()].filter(x => R.has(x)).length,
           coreRmsd: Bake.r2(k.rmsd), allRmsd: Bake.r2(global.rmsd) };
}

const moveText = (text, R, t) => {
  const f = v => v.toFixed(3).padStart(8);
  return text.split('\n').map(line => {
    if (!line.startsWith('ATOM') && !line.startsWith('HETATM')) return line;
    const q = Bake.mul(R, Bake.xyz(line)).map((v, k) => v + t[k]);
    return line.slice(0, 30) + f(q[0]) + f(q[1]) + f(q[2]) + line.slice(54);
  }).join('\n');
};

/* ---- the site ---------------------------------------------------------- */

/* Every HETATM group whose centroid is within SITE_R of the growing end, as a
   flat atom list plus CONECT bonds. Returns null where there is no DNA to
   anchor to, which is the apo structure's whole point. */
function site(text, anchor, mod) {
  if (!anchor) return null;
  const lines = text.split('\n');
  const groups = new Map();
  for (const line of lines) {
    if (!line.startsWith('HETATM')) continue;
    const name = line.slice(17, 20).trim();
    if (name === 'HOH' || (mod && mod.has(name))) continue;
    const alt = line[16];
    if (alt !== ' ' && alt !== 'A') continue;
    const key = name + '|' + line[21] + line.slice(22, 27);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(line);
  }

  const atoms = [], bySerial = new Map(), kept = [], out = [];
  for (const [key, ls] of groups) {
    const pts = ls.map(Bake.xyz);
    const c = [0, 1, 2].map(i => pts.reduce((s, p) => s + p[i], 0) / pts.length);
    const d = dist(c, anchor);
    const name = key.split('|')[0];
    (d <= SITE_R ? kept : out).push({ name, d: Bake.r2(d) });
    if (d > SITE_R) continue;
    for (const line of ls) {
      bySerial.set(+line.slice(6, 11), atoms.length);
      atoms.push({ name: line.slice(12, 16).trim(), el: elOf(line),
                   res: name, p: Bake.xyz(line) });
    }
  }
  if (!atoms.length) return { atoms: [], bonds: [], kept, out };

  const bonds = [], seen = new Set();
  for (const line of lines) {
    if (!line.startsWith('CONECT')) continue;
    const a = bySerial.get(+line.slice(6, 11));
    if (a === undefined) continue;
    for (let c = 11; c + 5 <= line.length; c += 5) {
      const f = line.slice(c, c + 5).trim();
      if (!f) continue;
      const b = bySerial.get(+f);
      if (b === undefined || b === a) continue;
      const key = Math.min(a, b) + ':' + Math.max(a, b);
      if (seen.has(key)) continue;
      seen.add(key); bonds.push([Math.min(a, b), Math.max(a, b)]);
    }
  }
  return { atoms, bonds, kept, out };
}

/* ---- one view ---------------------------------------------------------- */

function bake(cand, ref) {
  const raw = Bake.modelOne(fs.readFileSync(path.join(SRC, cand.id + '.pdb'), 'utf8'));
  const mod = Bake.modResidues(raw);
  const kinds = Bake.chainKinds(raw);
  const aa = [...kinds].filter(([, k]) => k === 'aa').map(([id]) => id);
  const naIds = [...kinds].filter(([, k]) => k === 'na').map(([id]) => id);
  const naSet = new Set(naIds);

  let text = raw, fit = null;
  if (ref) {
    const f = coreFit(caMap(raw), ref.CA);
    text = moveText(raw, f.k.R, f.k.t);
    fit = { on: ref.id, of: 'Ca', all: f.all, allRmsd: f.allRmsd,
            core: f.core, coreRmsd: f.coreRmsd };
  }

  const prot = Bake.caTrace(text, new Set(aa));
  const dna = naIds.length ? Bake.naTrace(text, naSet, mod) : new Map();
  const R = Bake.ssRanges(text);

  /* A STRAND NUMBERED BACKWARDS, put the right way round — see the header.
     Recorded per chain so the panel can say it happened. */
  const reversed = [];
  for (const [id, res] of dna)
    if (res.length > 1 && res[res.length - 1].num < res[0].num) {
      res.reverse();
      reversed.push(id);
    }

  /* THE GROWING END, which every measurement in this bake is anchored to. */
  const primer = cand.primer && dna.get(cand.primer);
  if (cand.primer && !primer) throw new Error(cand.id + ': no chain ' + cand.primer);
  const end = primer && primer[primer.length - 1];

  const hb = Bake.hbFor(Bake.resolution(text));
  const rawPairs = naIds.length ? Bake.basePairs(dna, { hb }) : [];

  /* THE ASSERTIONS EACH CANDIDATE SHIPS WITH. Both are the claim that decides
     which strand is the primer, so a file that stops satisfying them is a
     chain assignment that has silently gone wrong rather than a warning. */
  if (end && cand.expect.pairedEnd !== undefined) {
    const paired = new Set();
    for (const p of rawPairs) { paired.add(p.a.join('')); paired.add(p.b.join('')); }
    const is = paired.has(cand.primer + end.num);
    if (is !== cand.expect.pairedEnd)
      throw new Error(cand.id + ': primer 3\' end ' + cand.primer + end.num + ' is '
        + (is ? 'paired' : 'unpaired') + ', expected the opposite');
  }

  const s = site(text, end && end.C1, mod);
  if (cand.expect.inSite && !(s && s.kept.some(x => x.name === cand.expect.inSite)))
    throw new Error(cand.id + ': expected ' + cand.expect.inSite + ' within '
      + SITE_R + ' A of the growing end; found '
      + (s ? s.kept.map(x => x.name).join(', ') || 'nothing' : 'no site'));

  /* ONE CENTRE OVER EVERYTHING DRAWN, and one basis, both solved on the
     reference and handed to every view — legitimate only because the views
     are superposed first. Re-solving either per file would undo the fit. */
  let centre = ref && ref.centre;
  if (!centre) {
    const all = [];
    for (const res of prot.values()) for (const r of res) all.push([r.x, r.y, r.z]);
    for (const res of dna.values()) for (const r of res) all.push(r.P);
    centre = [0, 1, 2].map(k => all.reduce((s, p) => s + p[k], 0) / all.length);
  }

  const P = Bake.assemble(prot, R, centre);
  const D = naIds.length ? Bake.assembleNA(dna, centre) : { chains: {}, radius: 0 };
  const pairs = Bake.centrePairs(rawPairs, centre);

  /* THE FRAME IS SOLVED ON THE PROTEIN, which is the subject: the DNA is what
     moves through it, so letting a duplex 30 A long vote on the axes of a 903
     residue enzyme would aim the bench at the passenger. */
  let F = ref && ref.frame;
  if (!F) F = Bake.frameOf(aa.flatMap(id => P.chains[id].CA));
  const B = F.view;

  const chains = Object.assign({}, P.chains, D.chains);
  const order = [...aa, ...naIds];

  /* HOW FAR THE GROWING END IS FROM WHERE THE REFERENCE HOLDS IT. Feature to
     feature, not atom to atom: these files carry different sequences and
     different numbering, so nothing matches pointwise and an RMSD would be
     meaningless. What corresponds is the ROLE — the 3'-terminal nucleotide of
     the primer — and that is a position both structures have. */
  const moved = ref && ref.end && end ? {
    from: ref.end.name, to: cand.primer + end.num,
    C1: Bake.r2(dist(ref.end.C1, end.C1)),
    P: Bake.r2(dist(ref.end.P, end.P)),
    how: 'the primer\'s 3\'-terminal nucleotide, in ' + ref.id + '\'s frame — '
       + 'matched by role, since the two entries carry different sequences',
  } : null;

  const pts = [];
  for (const id of aa) for (const p of P.chains[id].CA) pts.push(p);
  for (const id of naIds) for (const p of D.chains[id].P) pts.push(p);
  if (s) for (const a of s.atoms) pts.push([0, 1, 2].map(k => a.p[k] - centre[k]));
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const p of pts) for (let k = 0; k < 3; k++) {
    const v = B ? B[k][0] * p[0] + B[k][1] * p[1] + B[k][2] * p[2] : p[k];
    if (v < lo[k]) lo[k] = v;
    if (v > hi[k]) hi[k] = v;
  }

  const declared = Bake.declared(text);
  const out = {
    source: cand.id + '.pdb',
    entry: cand.id,
    what: cand.what,
    purpose: cand.purpose,
    method: Bake.method(text),
    resolution: Bake.resolution(text),
    ssFrom: Bake.ssFrom(R),
    pairsFrom: naIds.length
      ? 'geometry — Watson-Crick (N1...N3), wobble (N1...O2 + O6...N3), '
        + 'C1\'-C1\' 8.4-12.6 A, N...N within ' + hb + ' A'
      : null,
    centre: P.centre,
    order,
    chains,
    pairs,
    primer: cand.primer,
    template: cand.template,
    reversed,
    pocket: s && s.atoms.length ? {
      of: [...new Set(s.kept.map(x => x.name))].join(' + '),
      within: SITE_R,
      kept: s.kept,
      out: s.out,
      atoms: s.atoms.map(a => ({ el: a.el, res: a.res, name: a.name,
        p: [0, 1, 2].map(k => Bake.r2(a.p[k] - centre[k])) })),
      bonds: s.bonds,
    } : null,
    fit,
    moved,
    radius: Math.max(P.radius, D.radius),
    extents: hi.map((h, k) => Bake.r2(h - lo[k])),
    view: B || null,
    frame: cand.ref ? F.frame : 'the reference\'s, carried by the fit',
    meta: {
      declared,
      ec: Bake.ecNumbers(text),
      ligands: Bake.ligands(text, null, mod),
      modres: [...mod],
      models: Bake.models(raw),
      hb,
    },
  };

  return { out, prot, aa, na: naIds, centre, frame: F, end: end && {
    name: cand.primer + end.num, C1: end.C1, P: end.P }, text, declared };
}

/* ---- run --------------------------------------------------------------- */

fs.mkdirSync(HERE, { recursive: true });

let ref = null;
for (const cand of CANDIDATES) {
  const Bk = bake(cand, ref);
  if (cand.id === REF)
    ref = { id: cand.id, CA: caMap(Bk.text), centre: Bk.centre,
            frame: Bk.frame, end: Bk.end };

  const dst = path.join(HERE, 'rb69-' + cand.id + '.json');
  fs.writeFileSync(dst, JSON.stringify(Bk.out));

  const o = Bk.out;
  console.log(dst);
  console.log('  ' + o.extents.join(' x ') + ' A, radius ' + o.radius + ' A, '
    + (fs.statSync(dst).size / 1024).toFixed(1) + ' KB');
  for (const id of Bk.aa) {
    const c = o.chains[id];
    console.log('  protein ' + id + '  ' + c.nums.length + '/' + Bk.declared[id]
      + ' residues ' + c.first + '-' + c.nums[c.nums.length - 1] + ', '
      + c.helices + ' helices, ' + c.strands + ' strands, ss ' + o.ssFrom);
  }
  for (const id of Bk.na)
    console.log('  DNA     ' + id + '  ' + o.chains[id].seq
      + '  ' + o.chains[id].first + '-' + o.chains[id].nums.slice(-1)[0]
      + (id === o.primer ? '  [primer]' : id === o.template ? '  [template]' : '')
      + (o.reversed.includes(id) ? '  REVERSED (deposited descending)' : '')
      + (o.chains[id].mods.length
        ? '  mod ' + o.chains[id].mods.map(m => m.name + m.num).join(',') : ''));
  if (Bk.na.length) console.log('  ' + o.pairs.length + ' base pairs');
  console.log('  in the site (' + SITE_R + ' A of the growing end): '
    + (o.pocket ? o.pocket.of + ' — ' + o.pocket.atoms.length + ' atoms, '
        + o.pocket.bonds.length + ' bonds'
      : Bk.end ? 'nothing' : 'no DNA, so no anchor'));
  if (o.pocket && o.pocket.out.length)
    console.log('    excluded: ' + o.pocket.out.map(x => x.name + ' ' + x.d + ' A').join(', '));
  if (o.fit)
    console.log('  fit on ' + o.fit.on + ': ' + o.fit.allRmsd + ' A over all '
      + o.fit.all + ' Ca, ' + o.fit.coreRmsd + ' A over the ' + o.fit.core
      + ' that do not move');
  if (o.moved)
    console.log('  growing end ' + o.moved.from + ' -> ' + o.moved.to + ': '
      + o.moved.C1 + ' A (C1\'), ' + o.moved.P + ' A (P)');
  console.log('  breaks: ' + Bake.breaks({ order: o.order, chains: o.chains }));
}
