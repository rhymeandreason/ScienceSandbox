#!/usr/bin/env node
/* =====================================================================
 *  prep.js — four antibody depositions down to what the bench draws,
 *  plus the counts its panel prints.
 *
 *  Run:  node proteins/antibody/tools/prep.js   (offline, no dependencies)
 *
 *  UNDER REVIEW. Nothing is in proteins/proteins.js yet, so the view
 *  table is CANDIDATES below rather than the registry's `variants`, and
 *  this script writes no `read` block back. Both change at step 5 of
 *  docs/AddingAProtein.md, once a human has said which of these earn a
 *  place.
 *
 *  WHAT AN ANTIBODY IS, for the bench to argue with: two heavy chains
 *  and two light chains, disulfide-bonded into a Y. Every arm ends in a
 *  variable domain pair that does the recognising; everything else is
 *  constant. The whole 1300-residue object is built from ONE fold —
 *  the immunoglobulin domain, a sandwich of two beta sheets pinned by
 *  an internal disulfide — repeated twelve times.
 *
 *  THE FOUR:
 *
 *    1IGT  intact mouse IgG2a, the whole Y. Every one of its 1316
 *          residues is modelled, which no other intact IgG manages.
 *          The default: this is the picture of an antibody.
 *    1HZH  intact human IgG1 b12, an HIV-neutralising antibody. Human,
 *          and asymmetric — one Fab arm is much better ordered than
 *          the other, and its heavy chain K has the only two real
 *          chain breaks on this bench.
 *    3HFM  a Fab gripping hen lysozyme. The recognition event itself,
 *          and against a protein this repo already holds.
 *  1REI WAS BAKED AND DROPPED, and the reason is a measurement rather than
 *  a preference. It is a Bence-Jones dimer — two light-chain variable domains
 *  at 2.0 A, the sharpest file looked at here — and it was on this bench as
 *  the immunoglobulin fold with nothing else attached. Fitted against 3HFM's
 *  real pair, its chain A is a light V domain (55% identical, 0.57 A) and its
 *  chain B is a light V domain being asked to stand in for a HEAVY one: 33%
 *  identical, 3.45 A. The pairing geometry survives that (the dimer fits the
 *  real VH/VL pair at 2.98 A), so the arrangement is honest and the second
 *  domain is not. 3HFM already carries a genuine VH/VL pair with the antigen
 *  in it, so the one thing 1REI added beyond that view is the one thing it
 *  does wrong. Re-add it to CANDIDATES to see it again; the file is still in
 *  data/src/.
 *
 *  THE NUMBERING TRAP, AND IT IS THE WHOLE REASON THIS BAKER IS NOT
 *  RNASE'S. Antibody files are numbered by convention (Kabat/EU), not
 *  sequentially: heavy chains carry insertion codes (52A, 82A/B/C,
 *  100A..100K) and skip whole runs of numbers where a loop is shorter
 *  than the convention allows for. 1IGT's heavy chain models 444
 *  residues over the range 1-474 with THIRTY numbering jumps in it,
 *  and every one of those jumps is 3.8 A across — an ordinary peptide
 *  bond. kit/proteinbox.js breaks the ribbon wherever `nums` jumps, so
 *  baked as deposited an intact IgG draws as sixty pieces of confetti
 *  and it looks like a badly disordered structure rather than a bug.
 *
 *  So `nums` is RENUMBERED for drawing, from the geometry: consecutive
 *  unless the Ca-Ca distance says otherwise. A peptide bond is 3.8 A
 *  (2.9 A before a cis proline), so anything past BREAK below is a
 *  real gap and gets a jump; everything else is chain. Done AFTER
 *  Bake.assemble, because assemble reads HELIX and SHEET against the
 *  file's own numbering and renumbering first would put the secondary
 *  structure on the wrong residues. The file's numbering is not lost —
 *  `meta.counts[].span` prints it, and it is what the literature and
 *  the RCSB entry use.
 *
 *  ONE FOLD, COUNTED RATHER THAN CLAIMED. An immunoglobulin domain is
 *  pinned by one internal disulfide spanning 55-80 residues, so the
 *  domains in a chain are countable off SSBOND: 4 in a heavy chain, 2
 *  in a light chain, 1 in an isolated V domain. The span filter is not
 *  decoration — 3HFM's third chain is lysozyme, which carries four
 *  intrachain disulfides of its own (spans 121, 85, 16, 18) and would
 *  otherwise be reported as a four-domain immunoglobulin. Each chain's
 *  ROLE is then read off that count, never typed, and the totals are
 *  asserted per candidate.
 *
 *  THE GLYCAN IS DRAWN, on the intact views. Both Fc heavy chains carry
 *  a branched sugar tree on one asparagine in CH2, deposited as its own
 *  chain of HETATMs. It is a third of the mass difference between an
 *  antibody and a bare protein, it is where the Fc's effector functions
 *  are tuned, and on a ribbon it is invisible. Baked as a pocket in the
 *  myoglobin shape, centred by the trace's own vector. Connectivity is
 *  the file's LINK and CONECT records; a distance cutoff wide enough
 *  for a glycosidic bond also draws every pyranose's diagonals.
 *
 *  WHICH ASPARAGINE IT HANGS OFF IS FOUND, NOT TYPED. 1IGT says so in a
 *  LINK record and 1HZH does not, so the anchor is the nearest ND2 to
 *  the reducing-end C1 and the baker asserts it landed on an ASN.
 *
 *  SOURCES, for a re-run from scratch. The raw files live in data/src/
 *  and are 2.6 MB against what this bakes out of them:
 *
 *    for id in 1IGT 1HZH 3HFM 1REI; do
 *      curl -o proteins/antibody/data/src/$id.pdb \
 *        https://files.rcsb.org/download/$id.pdb
 *    done
 *
 *  EVERY NUMBER THE PANEL PRINTS IS COUNTED HERE, off the file.
 * ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const Bake = require('../../bake-lib.js');

const HERE = path.join(__dirname, '..');
const SRC = path.join(HERE, 'data', 'src');
const DATA = path.join(HERE, 'data');

/* Longest Ca-Ca step that is still a peptide bond. 3.8 A trans, 2.9 A cis;
   the real gaps on this bench are 10.9 and 11.6 A, so nothing is close to
   the line. */
const BREAK = 5.0;

/* An immunoglobulin domain's internal disulfide, in residues between the two
   cysteines. Every one on this bench measures 60-70; lysozyme's four measure
   121, 85, 16 and 18. */
const IG_SPAN = [55, 80];

/* UNDER REVIEW: this is the registry's `variants` in waiting. `subject` names
   the chains the frame is solved on, which is not always everything drawn —
   3HFM's longest axis belongs to the Fab, and solving over the antigen too
   would lay the arm across the screen and stand the lysozyme up. `expect` is
   the domain count per role, asserted against what SSBOND says. */
const CANDIDATES = [
  { id: '1IGT', chains: 'A,B,C,D', subject: 'A,B,C,D', glycan: 'E,F', default: true,
    expect: { heavy: 4, light: 2 },
    purpose: 'the whole Y, every residue modelled' },
  { id: '1HZH', chains: 'H,K,L,M', subject: 'H,K,L,M', glycan: 'A,B',
    expect: { heavy: 4, light: 2 },
    purpose: 'a human antibody, and an asymmetric one' },
  /* A Fab is a WHOLE light chain and the first half of a heavy one, so the
     heavy expects 2 rather than 4 here — the arm is cut off the antibody at
     the hinge. `other` is the lysozyme, and it expects zero Ig domains, which
     is the assertion that the span filter is doing its job. */
  { id: '3HFM', chains: 'L,H,Y', subject: 'L,H', partner: 'Y',
    expect: { heavy: 2, light: 2, other: 0 },
    purpose: 'a Fab holding its antigen' },
  /* NOT A DEPOSITION. The mouse Fc and the human Fc in one frame, fitted, so
     the question "is a mouse antibody the same protein as ours" is answered by
     two ribbons lying on top of each other rather than by a sentence. `pair`
     is what makes a candidate a comparison: two entries, the second fitted
     onto the first, and the per-domain identity measured. */
  { id: 'FC', pair: [{ id: '1IGT', chains: 'B,D' }, { id: '1HZH', chains: 'H,K' }],
    purpose: 'mouse against human, the stem only' },
];

const xyz = Bake.xyz, r2 = Bake.r2;
const elOf = l => (l.slice(76, 78).trim() || l.slice(12, 14).trim()).toUpperCase();
const near = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/* ---- disulfides, and the fold they count ---------------------------- */

/* SSBOND split into the two things it says. Within one chain a bond pins a
   domain shut; between chains it is the architecture — the hinge that holds
   the two heavy chains together, and the one bond that ties each light chain
   to its heavy. Both are read, neither is counted from cysteines. */
function bonds(text, only) {
  const intra = new Map(), inter = [];
  for (const l of text.split('\n')) {
    if (!l.startsWith('SSBOND')) continue;
    const c1 = l[15], n1 = parseInt(l.slice(17, 21), 10);
    const c2 = l[29], n2 = parseInt(l.slice(31, 35), 10);
    if (only && !(only.has(c1) && only.has(c2))) continue;
    if (c1 === c2) {
      if (!intra.has(c1)) intra.set(c1, []);
      intra.get(c1).push([n1, n2]);
    } else inter.push({ a: c1 + n1, b: c2 + n2, chains: [c1, c2] });
  }
  return { intra, inter };
}

/* How many immunoglobulin domains a chain is, by the disulfide that pins each
   one. The span filter is what stops lysozyme being read as an antibody. */
const igCount = pairs =>
  (pairs || []).filter(([a, b]) => {
    const s = Math.abs(b - a);
    return s >= IG_SPAN[0] && s <= IG_SPAN[1];
  }).length;

/* WHICH CHAIN IS WHICH, off the file's own COMPND, never typed — the same
   rule the nucleosome baker uses to say which chain is which histone.

   NEITHER RECORD ANSWERS THIS ALONE, which is why both are read. The domain
   count is a measurement and it is decisive for an intact antibody (4 heavy,
   2 light), but a Fab's heavy chain is truncated to VH+CH1 and counts two,
   exactly like the light chain beside it — 3HFM is that case. COMPND names
   them there, and does not in 1IGT, whose two molecules carry one name. So
   COMPND decides where it says a word, the count decides otherwise, and the
   bake records which of the two answered. */
function compndRoles(text) {
  const out = new Map();
  let name = null, ids = [];
  const flush = () => {
    if (!name) return;
    const u = name.toUpperCase();
    const role = /\bHEAVY\b/.test(u) ? 'heavy' : /\bLIGHT\b/.test(u) ? 'light' : null;
    for (const id of ids) out.set(id, { name, role });
    name = null; ids = [];
  };
  for (const l of text.split('\n')) {
    if (!l.startsWith('COMPND')) continue;
    const t = l.slice(10).trim().replace(/;$/, '');
    if (/^MOL_ID:/.test(t)) flush();
    else if (/^MOLECULE:/.test(t)) name = t.slice(9).trim();
    else if (/^CHAIN:/.test(t)) ids = t.slice(6).split(',').map(s => s.trim());
  }
  flush();
  return out;
}

/* The fallback where COMPND names no role: four domains is a heavy chain, two
   a light one, one an isolated variable domain, none a chain that is not an
   immunoglobulin at all — which on this bench is lysozyme. */
function roleOf(n) {
  return n >= 3 ? 'heavy' : n === 2 ? 'light' : n === 1 ? 'variable' : 'other';
}

/* ---- the glycan ------------------------------------------------------ */

const SUGARS = new Set(['NAG', 'BMA', 'MAN', 'GAL', 'FUC', 'FUL', 'SIA', 'NDG']);

/* One branched sugar tree per named chain, plus the asparagine it hangs off.
   Flat atoms + bonds in the shape kit/proteinbox.js takes, in the structure's
   own coordinates; the caller shifts them by the trace's centre. */
function glycan(text, ids) {
  const lines = text.split('\n');
  const atoms = [], bySerial = new Map(), byKey = new Map();
  const keep = (line, group) => {
    const alt = line[16];
    if (alt !== ' ' && alt !== 'A') return;
    const i = atoms.length;
    bySerial.set(+line.slice(6, 11), i);
    byKey.set(line.slice(12, 27), i);      // name + resname + chain + seq
    atoms.push({ name: line.slice(12, 16).trim(), el: elOf(line),
                 res: line.slice(17, 20).trim(), group,
                 num: parseInt(line.slice(22, 26), 10), p: xyz(line) });
  };

  for (const line of lines) {
    if (!line.startsWith('HETATM')) continue;
    if (!ids.has(line[21])) continue;
    if (!SUGARS.has(line.slice(17, 20).trim())) continue;
    keep(line, 'sugar');
  }
  if (!atoms.length) throw new Error('no sugar atoms on chains ' + [...ids].join(','));

  /* THE ANCHOR RESIDUE IS FOUND. 1IGT declares the ASN-NAG link and 1HZH does
     not, so neither file's records are trusted for it: take each tree's
     reducing-end C1 and look for the nearest side-chain ND2. Asserted, because
     a glycan drawn hanging off the wrong residue looks entirely plausible. */
  const roots = atoms.filter(a => a.name === 'C1' && a.num === 1);
  const anchors = [];
  for (const root of roots) {
    let best = null;
    for (const line of lines) {
      if (!line.startsWith('ATOM')) continue;
      if (line.slice(12, 16).trim() !== 'ND2') continue;
      const d = near(root.p, xyz(line));
      if (!best || d < best.d) best = { d, line };
    }
    /* Loose, and the measured distance is carried out rather than rounded
       off: an N-glycosidic bond is 1.47 A, 1IGT deposits it at 1.47, and
       1HZH's two are 2.64 and 2.45 — long enough that the file is telling
       you what a 2.7 A map knows about a sugar, and short enough that
       nothing else is a candidate. The panel prints it. */
    if (!best || best.d > 3.0)
      throw new Error('glycan root has no ND2 within 3 A (nearest ' +
        (best ? best.d.toFixed(2) : 'none') + ')');
    const res = best.line.slice(17, 20).trim();
    if (res !== 'ASN')
      throw new Error('glycan anchors on ' + res + ', expected ASN');
    const chain = best.line[21], num = parseInt(best.line.slice(22, 26), 10);
    anchors.push({ chain, num, d: r2(best.d) });
    /* The whole asparagine side chain, so the linkage reads as a bond into a
       residue rather than as a sugar floating beside the ribbon. */
    for (const line of lines) {
      if (!line.startsWith('ATOM')) continue;
      if (line[21] !== chain) continue;
      if (parseInt(line.slice(22, 26), 10) !== num) continue;
      const nm = line.slice(12, 16).trim();
      if (nm === 'N' || nm === 'C' || nm === 'O') continue;
      keep(line, 'anchor');
    }
  }

  const out = [], seen = new Set();
  const add = (i, j) => {
    const lo = Math.min(i, j), hi = Math.max(i, j);
    if (lo === hi || seen.has(lo + ':' + hi)) return;
    seen.add(lo + ':' + hi); out.push([lo, hi]);
  };
  /* Deposited connectivity both ways round: LINK carries the glycosidic bonds
     BETWEEN residues (and the ASN-NAG one where a file states it), CONECT the
     rest. A distance cutoff wide enough for either also fills each pyranose in
     with its own diagonals. */
  for (const line of lines) {
    if (line.startsWith('LINK')) {
      const a = byKey.get(line.slice(12, 27)), b = byKey.get(line.slice(42, 57));
      if (a !== undefined && b !== undefined) add(a, b);
    } else if (line.startsWith('CONECT')) {
      const a = bySerial.get(+line.slice(6, 11));
      if (a === undefined) continue;
      for (let c = 11; c + 5 <= line.length; c += 5) {
        const f = line.slice(c, c + 5).trim();
        if (!f) continue;
        const b = bySerial.get(+f);
        if (b !== undefined) add(a, b);
      }
    }
  }
  /* Inside one residue only, where nothing else is near enough to be wrong
     about — a ring's diagonals are 2.4 A and its bonds 1.4 A. */
  for (let i = 0; i < atoms.length; i++)
    for (let j = i + 1; j < atoms.length; j++) {
      const A = atoms[i], B = atoms[j];
      if (A.group !== B.group || A.num !== B.num || A.res !== B.res) continue;
      if (near(A.p, B.p) < 1.75) add(i, j);
    }
  return { atoms, bonds: out, anchors };
}

/* ---- the Fc, and the species comparison ------------------------------
 *
 *  WHERE THE Fc STARTS IS DERIVED, not typed. The hinge is the set of
 *  disulfides running between the two heavy chains, so the first residue past
 *  the last of them is the first residue of the Fc — and each file answers for
 *  itself, which matters because the mouse IgG2a hinge has three of those
 *  bonds and the human IgG1 hinge has one.
 *
 *  THE DOMAIN BOUNDARY INSIDE IT IS DERIVED THE SAME WAY, off the two Ig
 *  disulfides past the hinge: CH2's closes at one residue, CH3's opens at
 *  another, and the split is halfway between. Typing 345 would be a number
 *  nothing checks, and both files happen to be EU-numbered so it would look
 *  right in exactly the two cases tested.
 */
function fcSplit(text, heavy) {
  const SS = bonds(text, null);
  const hinge = SS.inter.filter(b => heavy.has(b.chains[0]) && heavy.has(b.chains[1]));
  if (!hinge.length) throw new Error('no heavy-heavy disulfide: cannot find the hinge');
  const from = Math.max(...hinge.map(b => Math.max(+b.a.slice(1), +b.b.slice(1)))) + 1;
  const one = [...heavy][0];
  const past = (SS.intra.get(one) || [])
    .filter(([a, b]) => Math.abs(b - a) >= IG_SPAN[0] && Math.abs(b - a) <= IG_SPAN[1] && a > from)
    .sort((x, y) => x[0] - y[0]);
  if (past.length !== 2)
    throw new Error(`chain ${one}: ${past.length} Ig domains past the hinge, expected 2`);
  return { from, mid: Math.round((past[0][1] + past[1][0]) / 2),
           to: Infinity, hinge: hinge.length };
}

const AA = { ALA:'A', ARG:'R', ASN:'N', ASP:'D', CYS:'C', GLN:'Q', GLU:'E', GLY:'G',
             HIS:'H', ILE:'I', LEU:'L', LYS:'K', MET:'M', PHE:'F', PRO:'P', SER:'S',
             THR:'T', TRP:'W', TYR:'Y', VAL:'V' };

/* One letter and one point per residue, under caTrace's own altloc rule, so a
   sequence and the coordinates it aligns cannot come out different lengths. */
function caSeq(text, chain, from, to) {
  const out = [];
  for (const l of text.split('\n')) {
    if (!l.startsWith('ATOM') || l.slice(12, 16).trim() !== 'CA') continue;
    const a = l[16];
    if (a !== ' ' && a !== 'A') continue;
    if (l[21] !== chain) continue;
    const n = parseInt(l.slice(22, 26), 10);
    if (n < from || n > to) continue;
    out.push({ s: AA[l.slice(17, 20).trim()] || 'X', n, p: xyz(l) });
  }
  return out;
}

/* NEEDLEMAN-WUNSCH, global, flat gap penalty — the same one lysozyme's baker
   uses, and for the same reason: these two chains are homologous and NOT
   co-numbered in their variable halves, so aligning by residue number would
   compare residues that are not each other. It is checked by what comes out of
   it rather than trusted: the identity, the pair count and the RMSD are all
   printed, and a bad alignment shows up in every one of them. */
function align(a, b, gap = -2) {
  const n = a.length, m = b.length;
  const S = Array.from({ length: n + 1 }, () => new Float64Array(m + 1));
  const P = Array.from({ length: n + 1 }, () => new Int8Array(m + 1));
  for (let i = 1; i <= n; i++) { S[i][0] = i * gap; P[i][0] = 1; }
  for (let j = 1; j <= m; j++) { S[0][j] = j * gap; P[0][j] = 2; }
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
    const d = S[i - 1][j - 1] + (a[i - 1].s === b[j - 1].s ? 1 : -1);
    const u = S[i - 1][j] + gap, l = S[i][j - 1] + gap;
    if (d >= u && d >= l) { S[i][j] = d; P[i][j] = 0; }
    else if (u >= l) { S[i][j] = u; P[i][j] = 1; }
    else { S[i][j] = l; P[i][j] = 2; }
  }
  const pairs = [];
  let i = n, j = m, same = 0;
  while (i > 0 || j > 0) {
    const p = i === 0 ? 2 : j === 0 ? 1 : P[i][j];
    if (p === 0) { pairs.push([i - 1, j - 1]); if (a[i - 1].s === b[j - 1].s) same++; i--; j--; }
    else if (p === 1) i--;
    else j--;
  }
  pairs.reverse();
  return { pairs, identity: pairs.length ? same / pairs.length : 0 };
}

/* ---- the interface --------------------------------------------------
 *
 *  WHICH RESIDUES ARE ACTUALLY TOUCHING, where a candidate draws a partner
 *  chain. A complex is the one thing on this bench where the picture makes a
 *  claim about a CONTACT, and "the tips of both chains grip it" is exactly the
 *  sentence that sounds right, gets written from memory, and turns out to be
 *  half a Fab doing the work. So it is measured: heavy-atom pairs under CUT,
 *  counted per side.
 *
 *  4.0 A is a van der Waals contact rather than a hydrogen bond — the question
 *  here is what is in touch, not what is bonded, and a 3.2 A cutoff would drop
 *  most of an interface that is mostly packing.
 */
const CUT = 4.0;

function interface_(text, sub, partner) {
  const at = [];
  for (const l of text.split('\n')) {
    if (!l.startsWith('ATOM')) continue;
    const a = l[16];
    if (a !== ' ' && a !== 'A') continue;
    const c = l[21];
    if (!sub.has(c) && !partner.has(c)) continue;
    at.push({ c, n: parseInt(l.slice(22, 26), 10), r: l.slice(17, 20).trim(), p: xyz(l) });
  }
  const P = at.filter(a => partner.has(a.c)), S = at.filter(a => sub.has(a.c));
  /* Keyed by chain AND number: two chains numbered from 1 would otherwise
     merge, which is the same bug caTrace's chain-aware parse exists for. */
  const epi = new Map(), para = new Map();
  for (const y of P) for (const x of S) {
    if (near(y.p, x.p) > CUT) continue;
    const k = y.c + y.n;
    if (!epi.has(k)) epi.set(k, { res: `${y.r}${y.n}`, by: new Set() });
    epi.get(k).by.add(x.c);
    para.set(x.c + x.n, { chain: x.c, res: `${x.r}${x.n}` });
  }
  const bySide = {};
  for (const v of para.values()) bySide[v.chain] = (bySide[v.chain] || 0) + 1;
  return {
    cut: CUT,
    /* WHICH CHAINS ARE ON THE FAR SIDE, so a consumer can name them. A chain
       with no Ig domains is only "not an immunoglobulin"; a chain with no Ig
       domains that is in CONTACT with the antibody is an antigen, and it is
       this list that carries the difference. */
    partner: [...partner],
    epitope: [...epi.values()].map(e => e.res),
    /* THE HALF OF IT THAT IS THE POINT: residues the antigen touches with BOTH
       antibody chains at once. If this is zero the site is one chain's and the
       page must not say the pair makes it. */
    shared: [...epi.values()].filter(e => e.by.size > 1).map(e => e.res),
    contacts: bySide,
  };
}

/* ---- renumbering ------------------------------------------------------
 *
 *  See the header. `nums` decides where kit/proteinbox.js breaks the ribbon,
 *  and an antibody file's numbering is a convention rather than a count, so
 *  the drawing numbers are derived from the coordinates instead: +1 across a
 *  peptide bond, +2 across anything longer. Returns what it changed, so the
 *  page can say the numbers it shows are not the file's.
 */
function renumber(chain) {
  const nums = [];
  let n = 0, gaps = 0;
  for (let i = 0; i < chain.CA.length; i++) {
    if (i) n += near(chain.CA[i - 1], chain.CA[i]) > BREAK ? (gaps++, 2) : 1;
    nums.push(n + 1);
  }
  const jumps = chain.nums.filter((v, i, a) => i && v !== a[i - 1] + 1).length;
  chain.nums = nums;
  chain.first = 1;
  return { gaps, spurious: jumps - gaps };
}

/* ---- the paired view -------------------------------------------------
 *
 *  TWO ENTRIES, ONE FRAME. The second Fc is fitted onto the first and both are
 *  centred on the FIRST's centroid — centring each on its own would slide them
 *  back apart by the distance their centroids differ by, undoing most of the
 *  fit just made.
 *
 *  WHAT IS COMPARED IS NOT WHAT IS FITTED. The superposition is over both
 *  heavy chains at once, so the picture shows two Fc dimers lying on each
 *  other; the identity is measured PER DOMAIN, because a whole-Fc number would
 *  average CH2 and CH3 into one figure that describes neither.
 *
 *  AND THE COMPARISON STOPS AT THE STEM ON PURPOSE. These are two different
 *  antibodies — one raised against a lymphoma antigen, one against HIV — so
 *  their variable domains differ because their JOBS differ, and putting a
 *  V-domain identity beside a constant one invites the reader to call that a
 *  species difference. It is not, and the honest version of that comparison
 *  needs the same specificity in two species, which is not deposited.
 */
function bakePair(v) {
  const parts = v.pair.map(p => {
    const text = fs.readFileSync(path.join(SRC, p.id + '.pdb'), 'utf8');
    const only = new Set(p.chains.split(','));
    const cut = fcSplit(text, only);
    return { id: p.id, text, only, chains: p.chains.split(','), cut };
  });
  const [A, Bp] = parts;

  /* THE FIT, over both heavy chains at once and by ALIGNMENT rather than by
     residue number: the two files agree on EU numbering here, but a fit that
     depends on that agreement breaks silently the day an entry is swapped for
     one that numbers differently. */
  const seqs = parts.map(p => p.chains.map(c => caSeq(p.text, c, p.cut.from, p.cut.to)));
  const P = [], Q = [];
  let same = 0, n = 0;
  for (let k = 0; k < 2; k++) {
    const al = align(seqs[1][k], seqs[0][k]);
    for (const [i, j] of al.pairs) { P.push(seqs[1][k][i].p); Q.push(seqs[0][k][j].p); }
    same += al.identity * al.pairs.length; n += al.pairs.length;
  }
  const k = Bake.kabsch(P, Q);
  const put = p => Bake.mul(k.R, p).map((x, i) => x + k.t[i]);

  /* PER DOMAIN, split at the boundary each file derived for itself. */
  const compare = [];
  for (const [name, lo, hi] of [['CH2', 'from', 'mid'], ['CH3', 'mid', 'to']]) {
    const a = caSeq(A.text, A.chains[0], A.cut[lo], A.cut[hi]);
    const b = caSeq(Bp.text, Bp.chains[0], Bp.cut[lo], Bp.cut[hi]);
    const al = align(a, b);
    const f = Bake.kabsch(al.pairs.map(([i]) => a[i].p), al.pairs.map(([, j]) => b[j].p));
    compare.push({ domain: name, identity: +(100 * al.identity).toFixed(0),
                   rmsd: +f.rmsd.toFixed(2), n: al.pairs.length });
  }

  /* Chain ids are already distinct across the two entries (B,D and H,K), which
     is what lets them share one bake. A collision would need renaming, and
     that would have to be visible in the panel. */
  const seen = new Set(), traced = new Map();
  const R = { H: [], E: [] };
  const species = {};
  for (const p of parts) {
    const t = Bake.caTrace(p.text, p.only);
    const r = Bake.ssRanges(p.text);
    R.H.push(...r.H); R.E.push(...r.E);
    for (const [id, res] of t) {
      if (seen.has(id)) throw new Error('chain id ' + id + ' is in both entries');
      seen.add(id);
      species[id] = p.id;
      traced.set(id, res.filter(x => x.num >= p.cut.from)
        .map(x => {
          const q = p === A ? [x.x, x.y, x.z] : put([x.x, x.y, x.z]);
          return { num: x.num, x: q[0], y: q[1], z: q[2] };
        }));
    }
  }

  /* The reference's centre for everything, for the reason in the header. */
  let cx = 0, cy = 0, cz = 0, m = 0;
  for (const id of A.chains) for (const r of traced.get(id)) { cx += r.x; cy += r.y; cz += r.z; m++; }
  const centre = [cx / m, cy / m, cz / m];

  const T = Bake.assemble(traced, R, centre);
  const out = { source: parts.map(p => p.id + '.pdb').join(' + '), ssFrom: Bake.ssFrom(R),
                centre: T.centre, order: T.order, chains: T.chains, radius: T.radius };

  const spans = {}, fixed = {};
  for (const id of out.order) {
    const c = out.chains[id];
    spans[id] = `${c.first}–${c.nums[c.nums.length - 1]}`;
    fixed[id] = renumber(c);
  }

  /* Solved over the REFERENCE only. Over both it would be solved on a shape
     that is two copies of one thing, which is the same axes plus the residual
     of the fit — a measurement of the superposition rather than of the Fc. */
  const pts = [];
  for (const id of A.chains) for (const p of out.chains[id].CA) pts.push(p);
  const F = Bake.frameOf(pts);
  if (F.view) out.view = F.view;
  out.extents = F.extents;
  out.frame = F.frame;

  const decl = {};
  for (const p of parts) Object.assign(decl, Bake.declared(p.text));
  out.meta = {
    entry: parts.map(p => p.id).join(' + '), entries: parts.map(p => p.id),
    chainsDrawn: out.order.length,
    method: parts.map(p => Bake.method(p.text)).join(' / '),
    resolution: null,
    resolutions: parts.map(p => ({ entry: p.id, res: Bake.resolution(p.text) })),
    title: parts.map(p => Bake.line1(p.text, 'TITLE')).join(' | '),
    models: 1,
    chainsInFile: parts.reduce((s, p) => s + Bake.chainCount(p.text), 0),
    counts: out.order.map(id => ({ chain: id, modelled: out.chains[id].nums.length,
                                   declared: null, span: spans[id] })),
    /* Every chain here is a heavy chain by construction — the Fc IS the heavy
       chains — so the palette this view needs is the one thing the others do
       not have: which SPECIES a chain came from. */
    roles: Object.fromEntries(out.order.map(id => ({ id }))
      .map(({ id }) => [id, { domains: 2, role: 'heavy', from: 'the Fc split',
                              name: species[id] }])),
    palette: 'species',
    species,
    igDomains: out.order.length * 2,
    renumbered: fixed,
    ss: [], inter: [], hinge: null,
    hinges: parts.map(p => ({ entry: p.id, bonds: p.cut.hinge })),
    ligands: [],
    interface: null,
    /* THE MEASUREMENT THIS VIEW EXISTS FOR. */
    fit: { on: A.id, rmsd: +k.rmsd.toFixed(2), n, identity: +(100 * same / n).toFixed(0) },
    compare,
    fcFrom: parts.map(p => ({ entry: p.id, from: p.cut.from, mid: p.cut.mid })),
    glycan: null, ec: null,
  };
  return out;
}

/* ---- one view -------------------------------------------------------- */

function bake(v) {
  const text = fs.readFileSync(path.join(SRC, v.id + '.pdb'), 'utf8');
  const only = new Set(v.chains.split(','));

  const traced = Bake.caTrace(text, only);
  if (!traced.size) throw new Error(v.id + ': no CA atoms on those chains');
  const R = Bake.ssRanges(text);
  const T = Bake.assemble(traced, R);          // ss read against the FILE's numbering

  const out = { source: v.id + '.pdb', ssFrom: Bake.ssFrom(R), centre: T.centre,
                order: T.order, chains: T.chains, radius: T.radius };

  const SS = bonds(text, only);
  const spans = {}, fixed = {};
  for (const id of out.order) {
    const c = out.chains[id];
    spans[id] = `${c.first}–${c.nums[c.nums.length - 1]}`;   // before renumbering
    fixed[id] = renumber(c);
  }

  /* THE FRAME IS SOLVED ON THE SUBJECT. 3HFM draws its antigen and is not
     about it: over all three chains the longest axis is still the Fab's, but
     the roll is not, and the lysozyme ends up behind the arm instead of on the
     end of it. Where a candidate names no subject, everything drawn is it. */
  const sub = new Set((v.subject || v.chains).split(','));
  const pts = [];
  for (const id of out.order) if (sub.has(id)) for (const p of out.chains[id].CA) pts.push(p);
  const F = Bake.frameOf(pts);
  if (F.view) out.view = F.view;
  out.extents = F.extents;
  out.frame = F.frame;

  /* One centre for the trace and the sugar alike: a glycan centred on itself
     sits at the origin with the antibody around it somewhere else, which reads
     as a bug in the ribbon. */
  let gly = null;
  if (v.glycan) {
    gly = glycan(text, new Set(v.glycan.split(',')));
    const c = T.centre;
    out.pocket = {
      atoms: gly.atoms.map(a => ({ name: a.name, el: a.el, res: a.res, group: a.group,
                                   p: a.p.map((x, k) => r2(x - c[k])) })),
      bonds: gly.bonds,
    };
  }

  const decl = Bake.declared(text);
  const named = compndRoles(text);
  const roles = {};
  for (const id of out.order) {
    const n = igCount(SS.intra.get(id));
    const c = named.get(id);
    roles[id] = { domains: n, role: (c && c.role) || roleOf(n),
                  from: c && c.role ? 'COMPND' : 'domain count',
                  name: c ? c.name : null };
  }
  /* ASSERTED PER CANDIDATE, because the whole architecture claim rests on it:
     if a chain the bench calls heavy stops counting four domains, the fold
     count in the panel is wrong and nothing about the render says so. */
  for (const [role, want] of Object.entries(v.expect)) {
    const got = Object.values(roles).filter(r => r.role === role);
    if (!got.length) throw new Error(`${v.id}: no ${role} chain found`);
    for (const r of got) if (r.domains !== want)
      throw new Error(`${v.id}: ${role} chain has ${r.domains} Ig domains, expected ${want}`);
  }

  out.meta = {
    entry: v.id, chainsDrawn: out.order.length,
    method: Bake.method(text), resolution: Bake.resolution(text),
    title: Bake.line1(text, 'TITLE'), models: Bake.models(text),
    chainsInFile: Bake.chainCount(text),
    counts: out.order.map(id => ({ chain: id, modelled: out.chains[id].nums.length,
                                   declared: decl[id] === undefined ? null : decl[id],
                                   span: spans[id] })),
    roles,
    /* The fold, totalled over the chains that have it. `other` chains are
       excluded by having no Ig domains at all rather than by being named. */
    igDomains: Object.values(roles).reduce((k, r) => k + r.domains, 0),
    /* WHAT THE RENUMBERING DID, so the page can print it instead of hiding it.
       `spurious` is how many ribbon breaks the deposited numbering would have
       drawn that are not breaks in the chain. */
    renumbered: fixed,
    ss: Bake.disulfides(text, only),
    /* The architecture: which disulfides run between chains, and so what holds
       the Y together. The hinge is the heavy-heavy set. */
    inter: SS.inter.map(b => `${b.a}–${b.b}`),
    hinge: SS.inter.filter(b => roles[b.chains[0]] && roles[b.chains[1]] &&
      roles[b.chains[0]].role === 'heavy' && roles[b.chains[1]].role === 'heavy').length,
    ligands: Bake.ligands(text, null),
    interface: v.partner ? interface_(text, sub, new Set(v.partner.split(','))) : null,
    glycan: gly ? { chains: v.glycan, residues: new Set(gly.atoms
        .filter(a => a.group === 'sugar').map(a => a.res + a.num)).size,
      rings: gly.atoms.filter(a => a.group === 'sugar' && a.name === 'C1').length,
      anchors: gly.anchors.map(a => `${a.chain} Asn${a.num}`),
      link: gly.anchors.map(a => a.d) } : null,
    ec: Bake.ecNumbers(text)[0] || null,
  };
  return out;
}

function main() {
  fs.mkdirSync(DATA, { recursive: true });
  for (const v of CANDIDATES) {
    const out = v.pair ? bakePair(v) : bake(v);
    const file = `ab-${v.id}.json`;
    fs.writeFileSync(path.join(DATA, file), JSON.stringify(out));
    const m = out.meta;
    if (v.pair) {
      const kb0 = (fs.statSync(path.join(DATA, file)).size / 1024).toFixed(0);
      console.log(`${v.id}    ${out.order.length} chains, fitted on ${m.fit.on}, ` +
        `RMSD ${m.fit.rmsd} A over ${m.fit.n} pairs, ${m.fit.identity}% identical, ` +
        m.compare.map(c => `${c.domain} ${c.identity}%/${c.rmsd}A`).join(' ') + ', ' +
        `${out.extents.join(' × ')} A, view ${out.frame}, ${kb0} KB`);
      continue;
    }
    const kb = (fs.statSync(path.join(DATA, file)).size / 1024).toFixed(0);
    const res = m.counts.reduce((k, c) => k + c.modelled, 0);
    const fake = Object.values(m.renumbered).reduce((k, f) => k + f.spurious, 0);
    const real = Object.values(m.renumbered).reduce((k, f) => k + f.gaps, 0);
    console.log(`${v.id}  ${out.order.length} chains, ${res} residues, ` +
      `${m.igDomains} Ig domains (${out.order.map(c => c + ':' + m.roles[c].role[0]).join(' ')}), ` +
      `${real} real gap(s), ${fake} numbering jump(s) ignored, ` +
      `${m.ss.length} SS (${m.inter.length} inter, hinge ${m.hinge}), ` +
      (m.glycan ? `glycan ${m.glycan.rings} rings on ${m.glycan.anchors.join(' + ')}, ` : '') +
      (m.interface ? `interface ${m.interface.epitope.length} residues, ` +
        Object.entries(m.interface.contacts).map(([c, n]) => c + ':' + n).join(' ') +
        `, ${m.interface.shared.length} shared, ` : '') +
      `${out.extents.join(' × ')} A, view ${out.frame}, ${kb} KB`);
  }
}

if (require.main === module) main();
module.exports = { bake, CANDIDATES };
