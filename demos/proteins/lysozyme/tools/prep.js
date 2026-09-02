#!/usr/bin/env node
/* =====================================================================
 *  prep.js — five lysozyme depositions down to what the bench draws,
 *  plus the one measurement the bench exists to settle.
 *
 *  Run:  node proteins/lysozyme/tools/prep.js    (offline, no dependencies)
 *
 *  UNDER REVIEW. Nothing is in proteins/proteins.js yet, so the view
 *  table is CANDIDATES below rather than the registry's `variants`, and
 *  this script writes no `read` block back. Both change at step 5 of
 *  docs/AddingAProtein.md, once a human has said which of these earn a
 *  place.
 *
 *  THE QUESTION THIS BAKE ANSWERS. Lysozyme's disease story is
 *  hereditary systemic amyloidosis: I56T and D67H deposit as fibrils in
 *  liver and kidney. The mechanism is a loss of stability, not a wrong
 *  fold — the variants are natively folded and reported to look very
 *  nearly like wild type in the crystal. So a bench that draws three
 *  ribbons risks drawing three identical pictures and letting a reader
 *  believe they show the disease. Every variant is therefore superposed
 *  on 1REX and its per-residue Ca deviation measured and written into
 *  the bake: the page prints what the crystals actually differ by, and
 *  if that is nothing it says so.
 *
 *  THE THREE:
 *
 *    1LZ1  human native, empty cleft. The apo half of the pair, what
 *          the bench opens on, and what everything is fitted onto.
 *    1LZS  the same protein with a four-ring NAG chain in the cleft.
 *          The holo half — and a controlled one, because it and 1LZ1
 *          agree on species, numbering and every letter of the ss
 *          assignment, so the sugar is the only thing that differs.
 *    1REX  human native again, by another group. NOT DRAWN — it is
 *          baked only to measure what two crystals of the same empty
 *          protein differ by, which is the scale 1LZS is read on. The
 *          answer is 0.12 A and no residue past 1 A, and it rides in
 *          every bake's `meta.baseline`.
 *
 *  THE DISEASE VARIANTS WERE BAKED AND DROPPED, and the reason is a
 *  measurement rather than a preference. Hereditary systemic
 *  amyloidosis is caused by point substitutions in this protein, and
 *  1LOZ (I56T) and 1LYY (D67H) were on this bench through review. What
 *  the fit found: I56T is 0.23 A from wild type with nothing past 0.75
 *  A, against a same-protein baseline of 0.12 A — invisible. D67H is
 *  1.92 A with two loops hanging 9.7 A out — extremely visible. Both
 *  cause the same illness by the same route, a loss of stability that
 *  lets the protein transiently unfold, so the structural difference
 *  does not track the disease and a reader shown both ribbons would
 *  conclude that it does. That, plus how rare the disease is, is why
 *  the page carries one sentence saying it exists instead of two views
 *  implying something false about it. Re-add them to CANDIDATES to see
 *  it again; the files are still in data/src/.
 *
 *  ONE ASSIGNMENT, ALMOST. SECONDARY STRUCTURE IS READ, NEVER
 *  DETECTED, so it is the depositors' and not a property of the
 *  molecule: 1LZ1 and 1LZS record 5 helices and 5 strands, 1REX records
 *  8 and 2, over coordinates that agree to 0.12 A. The pair the bench
 *  is about shares an assignment exactly, so nothing but the sugar
 *  changes between them; 1REX is the only view that crosses the
 *  boundary, and it says so.
 *
 *  The disagreement runs in BOTH directions, which is what makes it a
 *  convention rather than one group seeing less. 1LZ1 calls 1-3 against
 *  38-40 a sheet and adds 59-61 to the beta domain, and every one of
 *  those residues has a partner at 4.3-5.4 A in 1REX's own coordinates;
 *  1REX in exchange annotates three short 3-10 helices (20-22, 105-108,
 *  122-124) that 1LZ1 leaves as coil. 1LZ1's assignment is not even an
 *  independent reading of the human protein — it matches hen lysozyme's
 *  element for element, offset by a residue or two, from the same
 *  crystallographic lineage.
 *
 *  THE FIT IS ON THE Ca TRACE, matched by a Needleman-Wunsch alignment
 *  of the two sequences rather than by residue number. Four of the five
 *  files share a numbering and would align trivially; 1HEW does not —
 *  hen and human lysozyme are homologous but not co-numbered, and
 *  residue 52 of one is not residue 52 of the other. Aligning first
 *  costs forty lines and makes the human-hen comparison a measurement
 *  instead of a refusal. The identity and the pair count are printed
 *  with the residual, so a fit made on a bad alignment is visible.
 *
 *  THE POCKET is the catalytic pair and whatever is in the cleft. The
 *  residue NUMBERS differ by species and are named per candidate, never
 *  assumed — human puts the aspartate at 53 and hen at 52 — and the
 *  baker asserts the residue it found is the residue that was asked
 *  for, because a number off by one draws a threonine and calls it the
 *  catalytic aspartate. 1HEW's three NAG rings come with it; the four
 *  human entries have an empty cleft, and that absence is half of the
 *  comparison rather than a gap.
 *
 *  SOURCES, for a re-run from scratch. The raw files live in data/src/
 *  and are 590 KB against the ~110 KB this bakes out of them:
 *
 *    for id in 1LZ1 1LZS 1REX; do
 *      curl -o proteins/lysozyme/data/src/$id.pdb \
 *        https://files.rcsb.org/download/$id.pdb
 *    done
 *
 *  EVERY NUMBER THE PANEL PRINTS IS COUNTED HERE, off the file: the
 *  declared length from SEQRES, the disulfides from SSBOND, the ligands
 *  from HETATM, the deviations from the coordinates after the fit.
 * ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const Bake = require('../../bake-lib.js');
const { kabsch, mul } = Bake;

const HERE = path.join(__dirname, '..');
const SRC = path.join(HERE, 'data', 'src');
const DATA = path.join(HERE, 'data');

/* THE VIEW TABLE IS proteins/proteins.js, with every other protein's. What
   each entry is, which chain is drawn, which residues make the site and what
   the collection says it is FOR all live there now; this file turns that into
   files under data/ and writes the counted half back.

   WHAT DID NOT MOVE THERE, and the reason is the registry's own rule that
   every entry in it is something a reader can open. 1REX is a second crystal
   of the same empty protein by another group, fitted here to measure what two
   crystals of one molecule differ by. It is a measurement input rather than a
   selection: no bake of its own is written because nothing loads one, and it
   would be an entry on the gallery that opens nothing. So it stays here. */
const REG = require('../../proteins.js');
const IO = require('../../tools/registry-io.js');
const ME = REG.byKey('lysozyme');
const VIEWS = ME.variants;
const REF = ME.fit.on;

/* NOT A VARIANT, AND NOT DRAWN. Fitted onto the reference like everything
   else, purely so `meta.baseline` can say what two crystals differ by — the
   scale every other figure on the bench is read on. */
const BASELINE = { id: '1REX', chains: 'A', pocket: { acid: 35, base: 53 },
                   baselineOnly: true };

const r2 = Bake.r2, xyz = Bake.xyz;
const elOf = l => (l.slice(76, 78).trim() || l.slice(12, 14).trim()).toUpperCase();

/* ---- sequence, for the alignment the fit needs ----------------------- */

/* One letter per Ca, in trace order, under the same altloc rule caTrace
   applies — so the sequence and the coordinates it aligns cannot come out
   different lengths. */
const AA = { ALA:'A', ARG:'R', ASN:'N', ASP:'D', CYS:'C', GLN:'Q', GLU:'E',
             GLY:'G', HIS:'H', ILE:'I', LEU:'L', LYS:'K', MET:'M', PHE:'F',
             PRO:'P', SER:'S', THR:'T', TRP:'W', TYR:'Y', VAL:'V' };

function caSeq(text, chain) {
  const out = [];
  for (const line of text.split('\n')) {
    if (!line.startsWith('ATOM')) continue;
    if (line.slice(12, 16).trim() !== 'CA') continue;
    const alt = line[16];
    if (alt !== ' ' && alt !== 'A') continue;
    if (line[21] !== chain) continue;
    out.push(AA[line.slice(17, 20).trim()] || 'X');
  }
  return out;
}

/* NEEDLEMAN-WUNSCH, global, flat gap penalty. Enough for two sequences
   that are 60% identical over 130 residues with at most a couple of
   indels; it is checked by what comes out of it, not trusted — the
   identity, the pair count and the RMSD are all printed, and a bad
   alignment shows up in every one of them. Returns index pairs into the
   two traces. */
function align(a, b, gap = -2) {
  const n = a.length, m = b.length;
  const S = Array.from({ length: n + 1 }, () => new Float64Array(m + 1));
  const P = Array.from({ length: n + 1 }, () => new Int8Array(m + 1));
  for (let i = 1; i <= n; i++) { S[i][0] = i * gap; P[i][0] = 1; }
  for (let j = 1; j <= m; j++) { S[0][j] = j * gap; P[0][j] = 2; }
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
    const d = S[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 1 : -1);
    const u = S[i - 1][j] + gap, l = S[i][j - 1] + gap;
    if (d >= u && d >= l) { S[i][j] = d; P[i][j] = 0; }
    else if (u >= l) { S[i][j] = u; P[i][j] = 1; }
    else { S[i][j] = l; P[i][j] = 2; }
  }
  const pairs = [];
  let i = n, j = m, same = 0;
  while (i > 0 || j > 0) {
    const p = i === 0 ? 2 : j === 0 ? 1 : P[i][j];
    if (p === 0) { pairs.push([i - 1, j - 1]); if (a[i - 1] === b[j - 1]) same++; i--; j--; }
    else if (p === 1) i--;
    else j--;
  }
  pairs.reverse();
  return { pairs, identity: pairs.length ? same / pairs.length : 0 };
}

/* ---- the pocket ------------------------------------------------------ */

/* The catalytic pair, and whatever is sitting in the cleft. One chain's
   worth as a flat atom list plus bonds, in the same shape myoglobin's
   baker writes, so kit/proteinbox.js draws it with no new branch.

   NOT CENTRED HERE. The trace decides the centre and the pocket is moved
   by the same vector, because a pocket centred on itself sits at the
   origin with the protein around it somewhere else, and that reads as a
   bug in the ribbon rather than as a bug in the bake. */
function pocket(text, v) {
  const lines = text.split('\n');
  const atoms = [], bySerial = new Map();
  const keep = (line, group) => {
    const alt = line[16];
    if (alt !== ' ' && alt !== 'A') return;
    bySerial.set(+line.slice(6, 11), atoms.length);
    atoms.push({ name: line.slice(12, 16).trim(), el: elOf(line),
                 res: line.slice(17, 20).trim(), group, p: xyz(line) });
  };
  /* What was actually found at the numbers the candidate named. A pair
     off by one draws the neighbouring residue and looks entirely
     plausible; 1REX has a threonine at 52, one place from the aspartate
     hen numbers there. */
  const found = {};

  for (const line of lines) {
    if (line.startsWith('HETATM')) {
      if (!v.sugar || line[21] !== v.sugar) continue;
      if (line.slice(17, 20).trim() !== 'NAG') continue;
      keep(line, 'sugar');
    } else if (line.startsWith('ATOM')) {
      if (line[21] !== v.chains) continue;
      const num = parseInt(line.slice(22, 26), 10);
      const which = num === v.pocket.acid ? 'acid' : num === v.pocket.base ? 'base' : null;
      if (!which) continue;
      found[which] = line.slice(17, 20).trim();
      /* Side chain only; CB stays as the stub saying which way the residue
         is attached. Backbone here would be ball-and-stick inside a ribbon
         that already draws it. */
      const name = line.slice(12, 16).trim();
      if (name === 'N' || name === 'C' || name === 'O') continue;
      keep(line, which);
    }
  }
  /* Asserted, not hoped for: the general acid is a glutamate and the
     nucleophile an aspartate in every lysozyme, so anything else at those
     numbers means the numbering is not what the candidate claims. */
  if (found.acid !== 'GLU')
    throw new Error(`${v.id}: residue ${v.pocket.acid} is ${found.acid}, expected GLU`);
  if (found.base !== 'ASP')
    throw new Error(`${v.id}: residue ${v.pocket.base} is ${found.base}, expected ASP`);

  const bonds = [], seen = new Set();
  const add = (i, j) => {
    const lo = Math.min(i, j), hi = Math.max(i, j);
    if (lo === hi || seen.has(lo + ':' + hi)) return;
    seen.add(lo + ':' + hi); bonds.push([lo, hi]);
  };
  /* Deposited connectivity for the sugar — the glycosidic bonds BETWEEN the
     three rings are the whole point of drawing a trisaccharide rather than
     three sugars, and a distance cutoff wide enough to catch them also
     fills each pyranose in with its diagonals. */
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
  /* The two side chains are ATOM records with no CONECT of their own, so
     their internal bonds come from distance, inside one residue where
     nothing else is near enough to be wrong about. */
  const near = (a, b) => Math.hypot(a.p[0] - b.p[0], a.p[1] - b.p[1], a.p[2] - b.p[2]);
  for (let i = 0; i < atoms.length; i++)
    for (let j = i + 1; j < atoms.length; j++) {
      const A = atoms[i], B = atoms[j];
      if (A.group !== B.group) continue;
      if (A.group === 'sugar') continue;
      if (near(A, B) < 1.9) add(i, j);
    }
  return { atoms, bonds, found };
}

/* ---- one view -------------------------------------------------------- */

function bake(v, ref) {
  const id = v.source ? v.source.id : v.id;
  const text = fs.readFileSync(path.join(SRC, id + '.pdb'), 'utf8');
  const chain = v.chains;
  const R = Bake.ssRanges(text);

  const traced = Bake.caTrace(text, new Set([chain]));
  if (!traced.size) throw new Error(v.id + ': no CA on chain ' + chain);
  const res = traced.get(chain).map(r => ({ num: r.num, p: [r.x, r.y, r.z] }));
  const seq = caSeq(text, chain);
  if (seq.length !== res.length)
    throw new Error(v.id + ': sequence and trace disagree on length');

  const site = pocket(text, v);

  /* SUPERPOSE BEFORE CENTRING, in the crystal's own coordinates: the fit is
     a rotation about the reference's origin, and centring first would fit
     the two centroids to each other instead. Applied to the trace and the
     pocket alike, which are one object. */
  let fit = null, dev = null;
  if (ref) {
    const A = align(seq, ref.seq);
    const P = A.pairs.map(([i]) => res[i].p);
    const Q = A.pairs.map(([, j]) => ref.ca[j]);
    const k = kabsch(P, Q);
    const put = p => mul(k.R, p).map((x, i) => x + k.t[i]);
    for (const a of site.atoms) a.p = put(a.p);
    for (const r of res) r.p = put(r.p);
    fit = { rmsd: k.rmsd, n: P.length, identity: A.identity };

    /* THE MEASUREMENT THE BENCH IS FOR: where, and by how much, this
       structure actually differs from wild type once the two are in one
       frame. Per aligned pair, so it is a distance between residues that
       correspond rather than between residues that share a number. */
    const each = A.pairs.map(([i, j]) => ({
      num: res[i].num,
      d: Math.hypot(res[i].p[0] - ref.ca[j][0], res[i].p[1] - ref.ca[j][1],
                    res[i].p[2] - ref.ca[j][2]),
    }));
    const worst = each.slice().sort((a, b) => b.d - a.d).slice(0, 6);
    dev = {
      rmsd: +k.rmsd.toFixed(2),
      max: +worst[0].d.toFixed(2),
      /* How much of the chain moves further than the coordinate error of
         these files is worth arguing about. Reported as a count at a stated
         cutoff rather than as a verdict. */
      over1: each.filter(e => e.d > 1).length,
      of: each.length,
      worst: worst.map(e => ({ num: e.num, d: +e.d.toFixed(2) })),
    };
  }

  /* One centre for the trace and its pocket, and the REFERENCE's centre for
     every fitted view — centring each on its own centroid would slide the
     structures back apart by the half-angstrom their centroids differ by,
     undoing most of the fit just made. */
  const c = ref ? ref.centre
    : [0, 1, 2].map(k => res.reduce((s, r) => s + r.p[k], 0) / res.length);
  const shift = p => p.map((x, k) => r2(x - c[k]));

  const T = Bake.assemble(new Map([[chain, res.map(r => ({ num: r.num, x: r.p[0],
                                                           y: r.p[1], z: r.p[2] }))]]),
                          R, c);

  const out = { source: id + '.pdb', ssFrom: Bake.ssFrom(R), centre: T.centre,
                order: T.order, chains: T.chains, radius: T.radius };
  out.centreRaw = c;
  out.pocket = {
    atoms: site.atoms.map(a => ({ name: a.name, el: a.el, res: a.res,
                                  group: a.group, p: shift(a.p) })),
    bonds: site.bonds,
  };

  /* ONE FRAME, ONE BASIS. A fitted view must WEAR the reference's basis and
     never solve its own. Lysozyme is a kidney bean whose three extents are
     within a factor of two, so the solved axes are near-degenerate and their
     signs are decided by noise: 1LYY came out with two of its three flipped
     against the other four, which turns the molecule 180 degrees on the one
     view whose entire subject is a loop that moved. A reader flipping to it
     would have seen the protein spin and been unable to say what of that was
     the mutation. The extents are still each view's own — they are a
     measurement of that structure and the panel prints them. */
  const F = Bake.frameOf(out.chains[chain].CA);
  /* A CHOSEN BASIS IS THE REGISTRY'S AND IS NEVER BAKED — `viewFor` writes no
     view where a human has picked one, so `frame` reads 'chosen in the
     registry' and kit/proteinbox.js reads the basis at draw time. What is left
     here is the fallback for a frame nobody has aimed: the reference's solved
     basis, worn by every fitted view rather than each solving its own, because
     this molecule's extents are near-degenerate and the signs of a solved
     basis flip between re-bakes. */
  const V = Bake.viewFor(ME, F, v);
  out.view = V.view !== undefined ? V.view : (ref ? ref.view : F.view);
  out.extents = F.extents;
  out.frame = V.frame;

  const decl = Bake.declared(text);
  out.meta = {
    entry: id, chain, chainsDrawn: out.order.length,
    method: Bake.method(text), resolution: Bake.resolution(text),
    title: Bake.line1(text, 'TITLE'), models: Bake.models(text),
    chainsInFile: Bake.chainCount(text),
    helices: out.chains[chain].helices, strands: out.chains[chain].strands,
    counts: [{ chain, modelled: res.length,
               declared: decl[chain] === undefined ? null : decl[chain] }],
    /* Four disulfides hold this fold together and they are why boiling an
       egg white does not finish lysozyme off. Read off SSBOND, never counted
       from cysteines. */
    ss: Bake.disulfides(text, new Set([chain])),
    /* Every HETATM the file carries, whether or not the pocket kept it —
       what is in the cleft is a claim, and the ligand row has to be able to
       disagree with it. */
    ligands: Bake.ligands(text, null),
    cat: { acid: v.pocket.acid, base: v.pocket.base,
           names: `${site.found.acid}${v.pocket.acid} / ${site.found.base}${v.pocket.base}` },
    /* Rings, counted as anomeric carbons rather than as residue names: three
       NAG residues under one chain id are three rings, and `new Set` of the
       name would report one. */
    sugarRings: site.atoms.filter(a => a.group === 'sugar' && a.name === 'C1').length,
    fitOn: ref ? REF : null,
    fitAtoms: fit ? fit.n : null,
    fitIdentity: fit ? +(100 * fit.identity).toFixed(0) : null,
    dev,
  };
  out.read = {
    method: Bake.method(text),
    chainsInFile: Bake.chainCount(text),
    residues: res.length,
    declared: out.meta.counts[0].declared,
    ec: Bake.ecNumbers(text)[0] || null,
    baked: `lz-${id}.json`,
  };
  return out;
}

function main() {
  fs.mkdirSync(DATA, { recursive: true });

  /* TWO PASSES. The reference is baked first in its own frame, centred on
     its own trace; every other view is fitted onto that already-centred
     copy, so the fit and the centring are one step. */
  const refCand = VIEWS.find(v => v.id === REF);
  const refOut = bake(refCand, null);
  const ref = { seq: caSeq(fs.readFileSync(path.join(SRC, REF + '.pdb'), 'utf8'),
                           refCand.chains),
                ca: refOut.chains[refCand.chains].CA, centre: [0, 0, 0],
                view: refOut.view };

  const baked = VIEWS.concat([BASELINE])
    .map(v => ({ v, out: v.id === REF ? refOut : bake(v, ref) }));

  /* THE SCALE EVERY OTHER NUMBER IS READ ON, measured rather than asserted:
     the baseline candidate is the same protein as the reference, empty, from
     another group, so what it differs by is what two crystals differ by. It
     goes into EVERY bake rather than being looked up across views, so a page
     showing one structure has the scale for the figure it is printing without
     depending on which fetches have landed. */
  const base = baked.find(b => b.v.baselineOnly);
  if (!base) throw new Error('no baselineOnly candidate: nothing calibrates the fit');
  const baseline = { entry: base.v.id, rmsd: base.out.meta.dev.rmsd,
                     over1: base.out.meta.dev.over1, of: base.out.meta.dev.of,
                     max: base.out.meta.dev.max };
  for (const b of baked) b.out.meta.baseline = baseline;

  const blocks = {};
  for (const { v, out } of baked) {
    const m = out.meta;
    if (v.baselineOnly) {
      console.log(`${v.id}  baseline only, not written: ${m.dev.rmsd} Å over ` +
        `${m.dev.of} residues, ${m.dev.over1} past 1 Å, worst ${m.dev.max} Å`);
      continue;
    }
    const { read, ...bakeOut } = out;
    fs.writeFileSync(path.join(DATA, read.baked), JSON.stringify(bakeOut));
    blocks[v.id] = read;
    const kb = (fs.statSync(path.join(DATA, read.baked)).size / 1024).toFixed(0);
    console.log(`${v.id}  ${read.residues}/${read.declared} res, ` +
      `${m.helices}H ${m.strands}E, ${m.ss.length} SS, ${m.cat.names}, ` +
      `sugar ${m.sugarRings} rings, ` +
      (m.dev ? `fit ${m.dev.rmsd} Å over ${m.fitAtoms} pairs (${m.fitIdentity}% id), ` +
               `max ${m.dev.max} Å at ${m.dev.worst[0].num}, ` +
               `${m.dev.over1}/${m.dev.of} past 1 Å`
             : 'reference frame') +
      `, view ${out.frame}, ${kb} KB`);
  }
  /* The counted half goes back into proteins.js, where a card reads it. The
     said half of that file is untouched by this write. */
  const touched = IO.write('lysozyme', blocks);
  console.log(`registry  proteins.js  ${touched.length} variants updated`);
}

if (require.main === module) main();
module.exports = { bake, pocket, align, VIEWS };
