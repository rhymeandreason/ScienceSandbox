#!/usr/bin/env node
/* =====================================================================
 *  bake-fibre.js — 2HBS -> sickle/data/fibre.json
 *
 *  WHAT THE HbS FIBRE IS MADE OF, and which parts of it this file can
 *  honestly claim.
 *
 *  The fibre is 14 strands. They are not 14 independent things: they are
 *  seven DOUBLE strands, and the double strand is the unit that deoxy-HbS
 *  crystallises as. 2HBS is that crystal, so the double strand is not a
 *  model here — it is measured, and this baker measures it:
 *
 *    - 2HBS is P 2(1) with TWO tetramers in the asymmetric unit, A-D and
 *      E-H. Those two are the lateral pair: beta6 of chain H sits in the
 *      Phe85/Leu88 pocket of chain B at 3.95 A.
 *    - The pair repeats along the crystallographic a axis, 63.344 A: under
 *      -a, beta6 of chain D reaches the pocket of chain F at 4.10 A.
 *
 *  So one translation and one rigid motion generate an arbitrarily long
 *  double strand, and BOTH come out of the file rather than out of a paper.
 *  Every number this baker writes is in that category.
 *
 *  WHAT IT DOES NOT WRITE, on purpose: how the seven double strands are
 *  arranged into a fibre, and how fast that assembly twists. Those come from
 *  electron-microscope reconstructions, not from this crystal, and nothing
 *  here can check them — so they stay in the page as named, adjustable
 *  parameters with their provenance on screen, rather than being laundered
 *  into a data file that looks measured.
 *
 *  Run:  node sickle/tools/bake-fibre.js
 * ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const RibbonLib = require('../../folding/ribbon.js');

const SRC = path.join(__dirname, '../../hemoglobin/data/2HBS.pdb');
const OUT = path.join(__dirname, '../data/fibre.json');

const T1 = ['A', 'B', 'C', 'D'];         // first tetramer of the asymmetric unit
const T2 = ['E', 'F', 'G', 'H'];         // second — the lateral partner
const POCKET = [85, 88];                 // Phe85 / Leu88
const r3 = v => Math.round(v * 1000) / 1000;
const r2 = v => Math.round(v * 100) / 100;

/* ------------------------------------------------------------- parsing */
const lines = fs.readFileSync(SRC, 'utf8').split('\n');

const chains = {};                       // id -> { res: Map(num -> {name, atoms}) }
for (const l of lines) {
  if (!l.startsWith('ATOM')) continue;
  const id = l[21], num = +l.slice(22, 26);
  const name = l.slice(12, 16).trim(), resName = l.slice(17, 20).trim();
  const alt = l[16];
  if (alt !== ' ' && alt !== 'A') continue;      // one conformer only
  const c = (chains[id] = chains[id] || { res: new Map() });
  if (!c.res.has(num)) c.res.set(num, { num, name: resName, atoms: {} });
  c.res.get(num).atoms[name] = [+l.slice(30, 38), +l.slice(38, 46), +l.slice(46, 54)];
}

/* Secondary structure from the file's own HELIX records. 2HBS deposits 64 of
   them, which is the author's assignment for this structure — preferred over
   re-deriving it, and RibbonLib.assign turns ranges into the per-residue
   string the ribbon and tube builders both take. */
const helices = {};
for (const l of lines) {
  if (!l.startsWith('HELIX')) continue;
  const id = l[19];
  (helices[id] = helices[id] || []).push([+l.slice(21, 25), +l.slice(33, 37)]);
}

function chainData(id) {
  const res = [...chains[id].res.values()].sort((a, b) => a.num - b.num);
  const first = res[0].num;
  return {
    id,
    first,
    kind: res.length > 143 ? 'beta' : 'alpha',
    CA: res.map(r => r.atoms.CA),
    ss: RibbonLib.assign(res.length, first, helices[id] || []).join(''),
    res,
  };
}

const all = {};
for (const id of [...T1, ...T2]) all[id] = chainData(id);

/* --------------------------------------------------- the two operations */
/* The cell, straight off CRYST1. Only `a` is needed — it is the strand's
   axial repeat — but the whole cell is recorded so the claim is checkable. */
const cryst = lines.find(l => l.startsWith('CRYST1'));
const cell = {
  a: +cryst.slice(6, 15), b: +cryst.slice(15, 24), c: +cryst.slice(24, 33),
  alpha: +cryst.slice(33, 40), beta: +cryst.slice(40, 47), gamma: +cryst.slice(47, 54),
  group: cryst.slice(55, 66).trim(),
};
/* a lies along x in the PDB convention for a monoclinic cell with b unique,
   so the axial repeat is a pure x translation. Asserted below rather than
   assumed. */
const axial = [cell.a, 0, 0];

/* Kabsch: the rigid motion carrying tetramer 1 onto tetramer 2, from their
   equivalent CA. This is the LATERAL operation — the one that makes a single
   strand into a double strand.

   Borrowed from bake-sickle.js rather than rewritten. The first version here
   had its own 3x3 SVD and fitted the same two tetramers at 3.85 A rmsd,
   which is nonsense for two copies of one molecule — a superposition that
   is merely wrong still returns a plausible-looking matrix, so the rmsd is
   the only thing that catches it. bake-sickle's is already exercised by
   check-sickle.js, including the assertion that it returns a rotation and
   not a mirror. */
const { kabsch } = require('./bake-sickle.js');

const apply = (R, t, p) => [
  R[0][0] * p[0] + R[0][1] * p[1] + R[0][2] * p[2] + t[0],
  R[1][0] * p[0] + R[1][1] * p[1] + R[1][2] * p[2] + t[1],
  R[2][0] * p[0] + R[2][1] * p[1] + R[2][2] * p[2] + t[2]];

/* Pair the tetramers chain-for-chain: A<->E, B<->F, C<->G, D<->H. */
const P = [], Q = [];
for (let i = 0; i < 4; i++) {
  const p = all[T1[i]], q = all[T2[i]];
  const n = Math.min(p.CA.length, q.CA.length);
  for (let r = 0; r < n; r++) { P.push(p.CA[r]); Q.push(q.CA[r]); }
}
const pair = kabsch(P, Q);
let rmsd = 0;
for (let i = 0; i < P.length; i++) {
  const m = apply(pair.R, pair.t, P[i]);
  rmsd += (m[0] - Q[i][0]) ** 2 + (m[1] - Q[i][1]) ** 2 + (m[2] - Q[i][2]) ** 2;
}
rmsd = Math.sqrt(rmsd / P.length);

/* ------------------------------------------------------- the contacts */
const sideAtoms = (chId, nums) =>
  [...chains[chId].res.values()]
    .filter(r => nums.includes(r.num))
    .flatMap(r => Object.entries(r.atoms)
      .filter(([n]) => n !== 'N' && n !== 'C' && n !== 'O' && n !== 'CA')
      .map(([, p]) => p));

const minDist = (A, B) => {
  let m = Infinity, pa = null, pb = null;
  for (const a of A) for (const b of B) {
    const d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    if (d < m) { m = d; pa = a; pb = b; }
  }
  return { d: m, a: pa, b: pb };
};

const shift = (p, v, k) => [p[0] + v[0] * k, p[1] + v[1] * k, p[2] + v[2] * k];

/* WHICH beta6 AND WHICH POCKET ARE ACTUALLY USED — the full scan, because
   the answer turns out to be "half of them" and that is not guessable.

   A tetramer has two beta chains, so a naive reading gives it two patches
   and two pockets. The crystal says otherwise: sweeping every P2(1)
   operation across +-1 unit cell in all three directions turns up exactly
   two beta6 -> Phe85/Leu88 contacts in the whole lattice, and they do not
   involve all four beta chains. Chains D and H donate; chains B and F
   receive; nothing donates AND receives.

   That asymmetry is why the assembly is a strand rather than a clump: one
   way in and one way out per molecule gives a line, where two of each would
   branch. Recorded per chain so the page can draw the idle sites
   differently instead of implying all four are working. */
const symOps = [
  p => p,                                                  // x, y, z
  p => [-p[0], p[1] + 92.8405, -p[2]],                     // REMARK 290 op 2
];
const cellVecs = (() => {
  const rad = cell.beta * Math.PI / 180;
  return [[cell.a, 0, 0], [0, cell.b, 0],
          [cell.c * Math.cos(rad), 0, cell.c * Math.sin(rad)]];
})();

const CONTACT_CUT = 6.0;                 // A between side-chain heavy atoms
const betaIds = [...T1, ...T2].filter(id => all[id].kind === 'beta');
const donors = new Set(), acceptors = new Set();
const links = [];
for (let op = 0; op < symOps.length; op++)
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) {
    const move = p => {
      const q = symOps[op](p);
      return [0, 1, 2].map(x =>
        q[x] + cellVecs[0][x] * i + cellVecs[1][x] * j + cellVecs[2][x] * k);
    };
    const identity = op === 0 && !i && !j && !k;
    for (const d of betaIds) for (const acc of betaIds) {
      if (identity && d === acc) continue;
      const m = minDist(sideAtoms(d, [6]), sideAtoms(acc, POCKET).map(move));
      if (m.d >= CONTACT_CUT) continue;
      donors.add(d); acceptors.add(acc);
      links.push({ donor: d, acceptor: acc, op, cell: [i, j, k], d: r2(m.d) });
    }
  }

/* The lateral contact, inside the asymmetric unit. */
const lateral = minDist(sideAtoms('H', [6]), sideAtoms('B', POCKET));
/* The axial one, to the neighbouring cell along -a. */
const axialContact = minDist(sideAtoms('D', [6]),
                             sideAtoms('F', POCKET).map(p => shift(p, axial, -1)));

/* --------------------------------------------------------- the output */
/* Centre on tetramer 1's own CA centroid, so the page's repeating body sits
   at the origin and every transform below is expressed about it. */
const centre = [0, 0, 0];
let nCA = 0;
for (const id of T1) for (const p of all[id].CA) { for (let k = 0; k < 3; k++) centre[k] += p[k]; nCA++; }
for (let k = 0; k < 3; k++) centre[k] /= nCA;
const sub = p => p.map((v, k) => r2(v - centre[k]));

/* A rigid motion expressed about the centred origin: p -> R(p + c) + t - c. */
const tCentred = [0, 0, 0];
for (let r = 0; r < 3; r++)
  tCentred[r] = r3(pair.R[r][0] * centre[0] + pair.R[r][1] * centre[1] + pair.R[r][2] * centre[2]
                   + pair.t[r] - centre[r]);

const out = {
  src: '2HBS',
  method: 'X-ray 2.05 A, deoxy haemoglobin S',
  note: 'The DOUBLE STRAND, measured. Tetramer 1 (A-D) is the body; `pair` ' +
        'places tetramer 2 (E-H) beside it; `axial` repeats the pair along ' +
        'the crystallographic a axis. How seven double strands assemble into ' +
        'the 14-strand fibre, and how fast that twists, are NOT here — they ' +
        'come from EM reconstructions, not from this crystal, and the page ' +
        'carries them as stated parameters instead.',
  cell,
  /* The centroid that was subtracted, so anything else baked for this page
     can land in the identical frame. bake-fibre-surface.js reads it — a
     surface half an angstrom out of register with its own tube would read
     as a bug in the surface code rather than as two different centres. */
  centre: centre.map(r3),
  axial: axial.map(r3),
  pair: { R: pair.R.map(r => r.map(r3)), t: tCentred, rmsd: r3(rmsd) },
  contacts: {
    lateral: { donor: 'H', acceptor: 'B', residues: POCKET, d: r2(lateral.d) },
    axial: { donor: 'D', acceptor: 'F', residues: POCKET, op: '-a', d: r2(axialContact.d) },
  },
  chains: T1.map(id => ({
    id,
    kind: all[id].kind,
    first: all[id].first,
    ss: all[id].ss,
    CA: all[id].CA.map(sub),
  })),
  /* beta6 and the pocket, per beta chain of the body, so the page can mark
     both ends of the contact without re-deriving where they are. */
  /* Every contact found, so the two the page quotes can be checked against
     the whole lattice rather than taken on trust. */
  links,
  marks: T1.filter(id => all[id].kind === 'beta').map(id => {
    /* A T1 chain's partner in T2, under the same A<->E, B<->F, C<->G, D<->H
       pairing the lateral fit used. A chain counts as working if either copy
       of it does, since the two are the same chain of the same molecule. */
    const partner = T2[T1.indexOf(id)];
    return {
      chain: id,
      beta6: sub(chains[id].res.get(6).atoms.CA),
      pocket: sub(POCKET.map(n => chains[id].res.get(n).atoms.CA)
        .reduce((a, p) => [a[0] + p[0] / 2, a[1] + p[1] / 2, a[2] + p[2] / 2], [0, 0, 0])),
      donates: donors.has(id) || donors.has(partner),
      receives: acceptors.has(id) || acceptors.has(partner),
    };
  }),
};

fs.writeFileSync(OUT, JSON.stringify(out));
const kb = (fs.statSync(OUT).size / 1024).toFixed(0);

console.log('2HBS ' + cell.group + '  a=' + cell.a + '  b=' + cell.b + '  c=' + cell.c);
console.log('lateral contact  beta6 ' + out.contacts.lateral.donor +
            ' -> pocket ' + out.contacts.lateral.acceptor + '   ' + out.contacts.lateral.d + ' A');
console.log('axial contact    beta6 ' + out.contacts.axial.donor +
            ' -> pocket ' + out.contacts.axial.acceptor + ' (-a) ' + out.contacts.axial.d + ' A');
console.log('pair transform   rmsd ' + out.pair.rmsd + ' A over ' + P.length + ' CA');
console.log('full lattice scan (' + symOps.length + ' ops x 27 cells): ' +
            links.length + ' beta6->pocket contacts under ' + CONTACT_CUT + ' A');
console.log('  donate: ' + [...donors].join(',') + '   receive: ' + [...acceptors].join(',') +
            '   idle beta6: ' + betaIds.filter(c => !donors.has(c)).join(','));
for (const m of out.marks)
  console.log('  chain ' + m.chain + '  beta6 ' + (m.donates ? 'DONATES' : 'idle   ') +
              '   pocket ' + (m.receives ? 'RECEIVES' : 'idle'));
console.log('axial repeat     ' + cell.a + ' A');
console.log('wrote ' + path.relative(process.cwd(), OUT) + '  (' + kb + ' KB)');
