#!/usr/bin/env node
/* =============================================================================
 *  proteins/polymerase/tools/prep.js — Taq polymerase open and closed
 * =============================================================================
 *    node proteins/polymerase/tools/prep.js
 *
 *  writes proteins/polymerase/data/polymerase-<ID>.json, one per registered
 *  variant.
 *
 *  REGISTERED. Which entries exist, what each is for, which one opens the
 *  bench and the chosen rotation are proteins/nucleic-acids.js's — that index
 *  and not proteins.js, because the line between them is the BAKE and these
 *  carry nucleic chains. What stays here is how to READ each file, which is
 *  nobody else's business: which chain is the primer, what counts as being in
 *  the site, and which fit each entry earns.
 *
 *  Klentaq — the large fragment of Taq DNA polymerase I, the polymerase half
 *  with the 5'-3' exonuclease cut off — caught twice on one primer/template:
 *  4KTQ with the site empty, 3KTQ with a ddCTP and two magnesiums in it. One
 *  construct, one DNA, 2.5 and 2.3 A. The fingers close between them.
 *
 *  THE PRIMER CANNOT BE EXTENDED, AND THAT IS THE EXPERIMENT. Chain B ends in
 *  DOC, 2',3'-dideoxycytidine: no 3'-OH, so the chemistry it is caught in the
 *  middle of cannot happen and the closed complex sits still long enough to
 *  crystallise. DOC is a HETATM, so `modResidues` is passed to naTrace and the
 *  primer keeps its last residue — without it the ladder is one rung short at
 *  exactly the end the whole bench is about.
 *
 *  THE FIT IS ON THE DNA, NOT ON THE PROTEIN, and that is the one real
 *  decision here. Superposing the two Ca traces spreads a domain motion over
 *  the whole chain and moves the duplex under it, so the fingers appear to
 *  half-close while the DNA drifts. Fitting on the duplex's phosphates instead
 *  — matched by chain and residue number, which correspond between these two
 *  files — nails the substrate in place and lets the protein move around it,
 *  which is the claim. The Ca RMSD that comes out AFTER that fit is therefore
 *  a measurement of the domain motion rather than a fit residual, and the
 *  bake carries both numbers under different names so the panel cannot
 *  confuse them.
 *
 *  ONE CENTRE AND ONE BASIS, SOLVED ON THE REFERENCE. Both are computed from
 *  4KTQ and handed to every view, which is only legitimate because the views
 *  are already superposed: re-solving either per file would re-centre and
 *  re-aim the thing that just got fitted, sliding most of the fit back apart.
 *  The mixed-file trap zif268 documents applies inside a single view too —
 *  protein and duplex take the SAME centre, solved over both.
 *
 *  THE CLOSED STRUCTURE HAS A POCKET AND THE OPEN ONE DELIBERATELY HAS NONE.
 *  An absent pocket is half of this comparison, so `pocket: null` is baked and
 *  printed rather than skipped. Connectivity is the file's CONECT records; a
 *  distance cutoff wide enough for the ~2.1 A Mg-O coordination also draws the
 *  triphosphate's own diagonals.
 * ============================================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const Bake = require(path.join(__dirname, '..', '..', 'bake-lib.js'));
const FoldLib = require(path.join(__dirname, '..', '..', '..', 'folding', 'folding.js'));
const REG = require(path.join(__dirname, '..', '..', 'nucleic-acids.js'));

/* THE ENTRY THIS BAKER SERVES. Which structures exist, what each is FOR and
   which one is the default are the registry's answers now, not this file's —
   that is what step 6 of AddingAProtein.md moves. What stays here is how to
   READ each one, which is nobody else's business. */
const ENTRY = REG.byKey('polymerase');
if (!ENTRY) throw new Error('no `polymerase` in proteins/nucleic-acids.js');

const HERE = path.join(__dirname, '..', 'data');
const SRC = path.join(HERE, 'src');

/* WHAT IS BEING PROPOSED, one row each. `pocket` is the HETATM names that are
   the subject of the site; everything else in the file is cargo. `primer` and
   `template` name the two strands by role, which is what the role fit below
   needs and what no PDB record states.

   `fitBy` IS THE WHOLE REASON THIS TABLE HAS A THIRD ROW. The two Klentaq
   entries are one construct on one DNA, so their strands correspond residue
   by residue and the fit is keyed on the numbers. T7 is a different enzyme
   carrying a different sequence with different numbering, and there is no
   pointwise correspondence anywhere in the file — but both files hold a
   primer/template duplex with its 3' end in a polymerase site, and THAT
   corresponds. So it is fitted by role, counting back from the growing end. */
const HOW = {
  '4KTQ': { ref: true, primer: 'B', template: 'C', pocket: [] },
  '3KTQ': { primer: 'B', template: 'C', fitBy: 'num', pocket: ['DCT', 'MG'] },
  '1T7P': { primer: 'P', template: 'T', fitBy: 'role', pocket: ['DG3', 'MG'],
            /* Chain B is the host's protein, not the phage's — the one thing
               a reader will ask about the picture. */
            chains: { A: 'T7 polymerase (gp5)',
                      B: 'thioredoxin, borrowed from E. coli' } },
};

/* THE REFERENCE IS BAKED FIRST, WHICHEVER ORDER THE REGISTRY LISTS THEM IN.
   The registry's order is the reader's — 1T7P opens the bench because it is
   the default — and the superposition's order is the fit's. Reading one off
   the other would mean the day someone reorders the variants for a reader,
   every other view silently fits onto a different structure. */
const CANDIDATES = (() => {
  const rows = ENTRY.variants.map(v => Object.assign(
    { id: v.id, what: v.label, purpose: v.purpose }, HOW[v.id]));
  const missing = rows.filter(r => !HOW[r.id]);
  if (missing.length)
    throw new Error('no read instructions for ' + missing.map(r => r.id).join(', '));
  return rows.sort((a, b) => (b.ref ? 1 : 0) - (a.ref ? 1 : 0));
})();

const REF = CANDIDATES.find(c => c.ref).id;

/* How many phosphates a role fit uses, counting back from the growing end. */
const ROLE_N = 10;
const elOf = l => (l.slice(76, 78).trim() || l.slice(12, 14).trim()).toUpperCase();

/* ---- superposition ----------------------------------------------------- */

/* Every phosphate in the file, keyed chain+number. The 5' residue of a strand
   has no P and simply does not appear on either side, so the match stays
   pointwise without a special case. */
function phosphates(text, na) {
  const out = new Map();
  for (const line of text.split('\n')) {
    if (!line.startsWith('ATOM') && !line.startsWith('HETATM')) continue;
    if (line.slice(12, 16).trim() !== 'P') continue;
    const alt = line[16];
    if (alt !== ' ' && alt !== 'A') continue;
    if (!na.has(line[21])) continue;
    out.set(line[21] + parseInt(line.slice(22, 26), 10), Bake.xyz(line));
  }
  return out;
}

/* THE SAME DUPLEX IN TWO UNRELATED FILES, matched by role instead of number.
   Both hold a primer annealed to a template with the primer's 3' end in a
   polymerase site, so counting phosphates back from that end lines the two
   duplexes up: position 1 is the growing end in both, whatever it is called
   and whatever base it is. Ten is enough to fix a duplex in space and short
   enough to stay inside the enzyme's grip, where the two structures actually
   have the same thing to say. The residual is baked, because a role match is
   an assumption and its residual is the evidence for it. */
function fromGrowingEnd(dna, primer, n) {
  const res = dna.get(primer);
  if (!res) throw new Error('no primer chain ' + primer);
  return res.slice().reverse().slice(0, n).map(r => r.P);
}

/* The whole file moved. Rewriting the coordinate columns rather than
   transforming each reader's output means the trace, the pairs, the pocket and
   the extents cannot end up in different frames — there is one frame because
   there is one set of coordinates. */
function moveText(text, R, t) {
  const f = v => v.toFixed(3).padStart(8);
  return text.split('\n').map(line => {
    if (!line.startsWith('ATOM') && !line.startsWith('HETATM')) return line;
    const q = Bake.mul(R, Bake.xyz(line)).map((v, k) => v + t[k]);
    return line.slice(0, 30) + f(q[0]) + f(q[1]) + f(q[2]) + line.slice(54);
  }).join('\n');
}

/* ---- the pocket -------------------------------------------------------- */

/* The incoming nucleotide and its metals, as a flat atom list plus bonds, in
   the file's own frame. Centred later with the trace, by the same vector. */
function pocket(text, want) {
  if (!want.length) return null;
  const keep = new Set(want);
  const lines = text.split('\n');
  const atoms = [], bySerial = new Map();

  for (const line of lines) {
    if (!line.startsWith('HETATM')) continue;
    const res = line.slice(17, 20).trim();
    if (!keep.has(res)) continue;
    const alt = line[16];
    if (alt !== ' ' && alt !== 'A') continue;
    bySerial.set(+line.slice(6, 11), atoms.length);
    atoms.push({ name: line.slice(12, 16).trim(), el: elOf(line), res, p: Bake.xyz(line) });
  }
  if (!atoms.length) return null;

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
  return { atoms, bonds };
}

/* ---- one view ---------------------------------------------------------- */

function read(cand) {
  const raw = Bake.modelOne(fs.readFileSync(path.join(SRC, cand.id + '.pdb'), 'utf8'));
  const kinds = Bake.chainKinds(raw);
  const aa = [...kinds].filter(([, k]) => k === 'aa').map(([id]) => id);
  const na = new Set([...kinds].filter(([, k]) => k === 'na').map(([id]) => id));
  if (!aa.length || !na.size)
    throw new Error(cand.id + ': expected protein and nucleic; got '
      + [...kinds].map(x => x.join('=')).join(' '));
  return { raw, aa, na: [...na], naSet: na, kinds };
}

function bake(cand, ref) {
  const F = read(cand);
  const mod = Bake.modResidues(F.raw);

  /* The fit, and the two residuals it produces. `fit` is how well the DNA
     matched; `motion` is how far the protein is from the reference AFTER
     that — the number this bench exists to show. */
  let text = F.raw, fit = null, motion = null;
  if (ref) {
    const byRole = cand.fitBy === 'role';
    let k, atoms, how;
    if (byRole) {
      const mine = Bake.naTrace(F.raw, F.naSet, mod);
      const n = Math.min(ROLE_N,
        mine.get(cand.primer).length, ref.primer.length);
      k = Bake.kabsch(fromGrowingEnd(mine, cand.primer, n), ref.primer.slice(0, n));
      atoms = n;
      how = 'the primer\'s last ' + n + ' phosphates, counted back from the '
          + 'growing end — these two entries share no numbering and no '
          + 'sequence, so nothing here is matched by name';
    } else {
      const A = phosphates(F.raw, F.naSet), B = ref.P;
      const keys = [...A.keys()].filter(x => B.has(x));
      if (keys.length < 8) throw new Error(cand.id + ': only ' + keys.length + ' shared phosphates');
      k = Bake.kabsch(keys.map(x => A.get(x)), keys.map(x => B.get(x)));
      atoms = keys.length;
      how = 'every phosphate the two files share by chain and residue number';
    }
    if (Bake.det(k.R) < 0) throw new Error(cand.id + ': kabsch returned a reflection');
    text = moveText(F.raw, k.R, k.t);
    fit = { on: ref.id, atoms, rmsd: Bake.r2(k.rmsd), by: byRole ? 'role' : 'number', how };

    const mine = Bake.caTrace(text, new Set(F.aa));
    const P = [], Q = [];
    for (const [id, res] of mine) {
      const other = ref.CA.get(id);
      if (!other) continue;
      for (const r of res) {
        const o = other.get(r.num);
        if (o) { P.push([r.x, r.y, r.z]); Q.push(o); }
      }
    }
    let sd = 0, worst = { d: -1, i: 0 };
    for (let i = 0; i < P.length; i++) {
      const d = Math.hypot(P[i][0] - Q[i][0], P[i][1] - Q[i][1], P[i][2] - Q[i][2]);
      sd += d * d;
      if (d > worst.d) worst = { d, i };
    }
    /* Which residue moved most, read back off the same walk rather than
       remembered — a typed residue number is a claim nothing checks. */
    let i = 0, worstNum = null;
    for (const [id, res] of mine) {
      const other = ref.CA.get(id);
      if (!other) continue;
      for (const r of res) if (other.get(r.num)) { if (i === worst.i) worstNum = id + r.num; i++; }
    }
    /* A NUMBER THAT NEEDS AN ALIGNMENT NOBODY HAS IS NULL, NOT COMPUTED.
       A Ca RMSD between two states of ONE construct is a domain motion; the
       same arithmetic between Klentaq and T7 is residue 500 of one protein
       against residue 500 of another, which is not a comparison at all — and
       it would print as a large number that a reader would take for a large
       movement. The two enzymes are compared by looking at them. */
    motion = byRole ? null
      : { pairs: P.length, rmsd: Bake.r2(Math.sqrt(sd / P.length)),
          max: Bake.r2(worst.d), at: worstNum };
  }

  const prot = Bake.caTrace(text, new Set(F.aa));
  const dna = Bake.naTrace(text, F.naSet, mod);
  const R = Bake.ssRanges(text);

  /* ONE CENTRE OVER BOTH POLYMERS — zif268's trap. Solved on the reference
     and handed to every view, since the views are already superposed. */
  let centre = ref && ref.centre;
  if (!centre) {
    const all = [];
    for (const res of prot.values()) for (const r of res) all.push([r.x, r.y, r.z]);
    for (const res of dna.values()) for (const r of res) all.push(r.P);
    centre = [0, 1, 2].map(k => all.reduce((s, p) => s + p[k], 0) / all.length);
  }

  const P = Bake.assemble(prot, R, centre);
  const D = Bake.assembleNA(dna, centre);
  const hb = Bake.hbFor(Bake.resolution(text));
  const pairs = Bake.centrePairs(Bake.basePairs(dna, { hb }), centre);

  /* THE DUPLEX'S OWN AXIS, the same convention proteins/dna and
     proteins/zif268 use, solved once on the reference. */
  let B = ref && ref.view;
  if (!B) {
    const mid = p => {
      const a = dna.get(p.a[0]).find(r => r.num === p.a[1]);
      const b = dna.get(p.b[0]).find(r => r.num === p.b[1]);
      return [0, 1, 2].map(k => (a.Bc[k] + b.Bc[k]) / 2);
    };
    const pr = Bake.basePairs(dna, { hb });
    const m0 = mid(pr[0]), m1 = mid(pr[pr.length - 1]);
    const axis = [0, 1, 2].map(k => m1[k] - m0[k]);
    const up = [0, 1, 2].map(k => dna.get(F.na[0])[0].Bc[k] - m0[k]);
    B = FoldLib.basisFrom(up, axis);
  }

  const site = pocket(text, cand.pocket);

  /* THE PAIR THE POCKET MAKES WITH THE TEMPLATE, measured rather than
     asserted. The claim this bench most wants to make is that the incoming
     nucleotide is reading a base — so it is checked the way `basePairs` checks
     every other rung, purine N1 to pyrimidine N3, across a boundary that
     function cannot cross because one side is a HETATM and not a chain.
     Reported as a distance and the residue it is to, or null. */
  const templating = (() => {
    if (!site) return null;
    /* THE INCOMING NUCLEOTIDE IS WHICHEVER POCKET RESIDUE IS NOT A METAL, and
       its Watson-Crick edge atom is asked of its ATOMS rather than of its
       name: N9 present means purine, whose edge is N1, and a pyrimidine's is
       N3. Klentaq's ddCTP is a pyrimidine and T7's ddGTP a purine, so a test
       written for one of them silently reports "no pair" for the other. */
    const res = [...new Set(site.atoms.map(a => a.res))]
      .find(r => site.atoms.some(a => a.res === r && a.el !== a.res));
    if (!res) return null;
    const mine = site.atoms.filter(a => a.res === res);
    const purine = mine.some(a => a.name === 'N9');
    const n3 = mine.find(a => a.name === (purine ? 'N1' : 'N3'));
    if (!n3) return null;
    const paired = new Set();
    for (const p of Bake.basePairs(dna, { hb }))
      { paired.add(p.a.join('')); paired.add(p.b.join('')); }
    let best = null;
    for (const [id, res] of dna) for (const r of res) {
      if (paired.has(id + r.num) || !r.edge) continue;
      const d = Math.hypot(r.edge[0] - n3.p[0], r.edge[1] - n3.p[1], r.edge[2] - n3.p[2]);
      if (!best || d < best.d) best = { d, at: id + r.num, base: r.base };
    }
    if (!best || best.d > hb) return null;
    return { at: best.at, base: best.base, d: Bake.r2(best.d), of: res,
             how: 'purine N1 to pyrimidine N3, within the ' + hb
                + ' A this file\'s resolution earns' };
  })();
  const chains = Object.assign({}, P.chains, D.chains);
  const order = [...F.aa, ...F.na];

  /* THE EXTENTS, IN THE VIEW BASIS. Framing is not computed here: the box
     solves its own centre and per-axis half-widths off the points it actually
     drew (kit/proteinbox.js's solveStill), which is also what handles a bake
     whose centre the protein wins against the DNA. This is for the panel. */
  const proj = [];
  for (const id of F.aa) for (const p of P.chains[id].CA) proj.push(p);
  for (const id of F.na) for (const p of D.chains[id].P) proj.push(p);
  if (site) for (const a of site.atoms) proj.push([0, 1, 2].map(k => a.p[k] - centre[k]));
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const p of proj) for (let k = 0; k < 3; k++) {
    const v = B[k][0] * p[0] + B[k][1] * p[1] + B[k][2] * p[2];
    if (v < lo[k]) lo[k] = v;
    if (v > hi[k]) hi[k] = v;
  }
  const ext = hi.map((h, k) => Bake.r2(h - lo[k]));

  const declared = Bake.declared(text);
  const V = Bake.viewFor(ENTRY, { view: B.map(ax => ax.map(Bake.r2)),
                                  frame: 'computed' },
                         REG.variantOf(ENTRY, cand.id), REG);
  const out = {
    source: cand.id + '.pdb',
    entry: cand.id,
    what: cand.what,
    purpose: cand.purpose,
    method: Bake.method(text),
    resolution: Bake.resolution(text),
    ssFrom: Bake.ssFrom(R),
    pairsFrom: 'geometry — Watson-Crick (N1...N3), wobble (N1...O2 + O6...N3), '
             + 'C1\'-C1\' 8.4-12.6 A, N...N within ' + hb + ' A',
    centre: P.centre,
    order,
    chains,
    pairs,
    pocket: site && {
      of: cand.pocket.join(' + '),
      atoms: site.atoms.map(a => ({ el: a.el, res: a.res, name: a.name,
        p: [0, 1, 2].map(k => Bake.r2(a.p[k] - centre[k])) })),
      bonds: site.bonds,
    },
    primer: cand.primer,
    template: cand.template,
    chainLabels: cand.chains || null,
    templating,
    fit,
    motion,
    radius: Math.max(P.radius, D.radius),
    extents: ext,
    /* WHERE THE ROTATION COMES FROM, resolved by bake-lib rather than decided
       here. A CHOSEN basis is not baked: it lives in nucleic-acids.js and
       kit/proteinbox.js reads it at draw time, so re-aiming this structure is
       an edit and a reload instead of a re-bake that rewrites files whose
       coordinates did not change. So while the registry holds one, `view` is
       null and `frame` says so; the day it does not, the solved duplex axis
       below stands and the same field says that instead. Passing the nucleic
       index because that is the one these bakes are in. */
    view: V.view,
    frame: V.frame + (V.view
      ? cand.ref ? ' — the duplex\'s helix axis across the page'
                 : ' — the reference\'s, carried by the fit'
      : ''),
    /* EVERY FIGURE THE PANEL PRINTS, counted here so a re-bake re-counts it. */
    meta: {
      declared,
      ec: Bake.ecNumbers(text),
      ligands: Bake.ligands(text, null, mod),
      modres: [...mod],
      models: Bake.models(F.raw),
      hb,
    },
  };

  return { out, prot, dna, aa: F.aa, na: F.na, view: B, centre, text, declared };
}

/* ---- run --------------------------------------------------------------- */

fs.mkdirSync(HERE, { recursive: true });

let ref = null;
for (const cand of CANDIDATES) {
  const B = bake(cand, ref);
  if (cand.id === REF) {
    const CA = new Map();
    for (const [id, res] of B.prot) CA.set(id, new Map(res.map(r => [r.num, [r.x, r.y, r.z]])));
    ref = { id: cand.id, P: phosphates(B.text, new Set(B.na)), CA,
            centre: B.centre, view: B.view,
            /* For a role fit: the reference's own primer, 3' end first. */
            primer: fromGrowingEnd(B.dna, cand.primer, ROLE_N) };
  }

  const dst = path.join(HERE, 'polymerase-' + cand.id + '.json');
  fs.writeFileSync(dst, JSON.stringify(B.out));

  const o = B.out;
  console.log(dst);
  console.log('  ' + o.extents.join(' x ') + ' A, radius ' + o.radius + ' A, '
    + (fs.statSync(dst).size / 1024).toFixed(1) + ' KB');
  for (const id of B.aa) {
    const c = o.chains[id];
    console.log('  protein ' + id + '  ' + c.nums.length + '/' + B.declared[id]
      + ' residues ' + c.first + '-' + c.nums[c.nums.length - 1] + ', '
      + c.helices + ' helices, ' + c.strands + ' strands, ss ' + o.ssFrom);
  }
  for (const id of B.na)
    console.log('  DNA     ' + id + '  ' + o.chains[id].seq
      + '  ' + o.chains[id].first + '-' + o.chains[id].nums.slice(-1)[0]
      + (o.chains[id].mods.length
        ? '  mod ' + o.chains[id].mods.map(m => m.name + m.num).join(',') : ''));
  console.log('  ' + o.pairs.length + ' base pairs, ligands: '
    + (o.meta.ligands.join(', ') || 'none'));
  if (o.templating)
    console.log('  templating base: ' + o.templating.base + ' ' + o.templating.at
      + ', ' + o.templating.d + ' A to the incoming base (' + o.templating.how + ')');
  console.log('  pocket: ' + (o.pocket
    ? o.pocket.of + ', ' + o.pocket.atoms.length + ' atoms, ' + o.pocket.bonds.length + ' bonds'
    : 'none — the empty site is the measurement'));
  if (o.fit)
    console.log('  fit on ' + o.fit.on + ' by ' + o.fit.by + ': ' + o.fit.atoms
      + ' atoms, ' + o.fit.rmsd + ' A'
      + (o.motion ? '  |  Ca after fit: ' + o.motion.rmsd + ' A over '
          + o.motion.pairs + ', max ' + o.motion.max + ' A at ' + o.motion.at
        : '  |  Ca RMSD not computed — a different construct'));
  console.log('  breaks: ' + Bake.breaks({ order: B.aa, chains: o.chains }));
}
