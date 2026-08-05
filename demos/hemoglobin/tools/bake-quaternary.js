#!/usr/bin/env node
/* =====================================================================
 *  bake-quaternary.js — the OTHER three chains, in the folding chain's
 *  own frame.
 *
 *  Level 4 is not more folding. The three chains this file writes are
 *  DEPOSITED and STATIC — they are placed, not solved — and that is the
 *  whole scientific claim of the act: a tetramer is four finished
 *  tertiary structures held against each other, so the only honest way to
 *  add them is to put the crystal's own coordinates where the crystal
 *  puts them.
 *
 *  THE ONE THING THAT IS EASY TO GET WRONG. hemoglobin-lab.html plays a
 *  trajectory whose coordinates have been rotated by FoldLib.orient() —
 *  a change of basis solved from chain B's extended conformation, so it
 *  is a property of the BAKE and not of the file. Chains A, C and D come
 *  straight off 2HHB in the crystal's frame, and dropping them into the
 *  page unrotated puts the tetramer in a different orientation from the
 *  chain it is supposed to be assembling around: still four subunits,
 *  arranged wrongly, which looks like a design choice rather than a bug.
 *
 *  So this file re-derives orient()'s rotation exactly the way
 *  bake-unfold.js does (parse chain B, orient it, read parsed.orientation)
 *  and applies that same matrix to everything it writes. check-hb.js
 *  asserts that chain B taken through THIS path reproduces the `native`
 *  block of the committed trajectory to within quantisation, which is
 *  what makes "same frame" a checked statement rather than a comment.
 *
 *  IT ALSO WRITES THE INTERFACES — see "what holds an interface" below for
 *  the measurement and for why a contact patch and a hydrogen bond come out
 *  of here as two different kinds of thing.
 *
 *  The arrival order is checkable because of it. alpha1-beta1
 *  (A against B) is the larger, tighter interface and the one that forms
 *  first; alpha1-beta2 (C against B) is the smaller one that slides during
 *  the T->R switch. check-hb.js asserts A-B is the bigger of the two, so
 *  the arrival order is a measured statement rather than a staging choice.
 *
 *  It also writes the four hemes — 43 heavy atoms and their deposited
 *  connectivity each, plus the iron on its own for the code that only wants
 *  the centre. They are the reason the protein exists: the pocket the
 *  tertiary act builds is where the iron sits, so the page can finish on
 *  the thing the whole structure is for. See "the whole heme" below for why
 *  the bonds come from CONECT rather than from a distance cutoff.
 *
 *  JSON, not a binary. Three Ca traces is ~430 points; the trajectory is
 *  185 keyframes of 352 and had to be quantised. 90 KB of text needs no
 *  format, no decoder and no second copy of one to keep in step.
 *
 *  Run:  node hemoglobin/tools/bake-quaternary.js     (offline)
 * ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const FoldLib = require('../../folding/folding.js');
const { extract } = require('./chain.js');
const { CHAIN } = require('./bake-hb.js');

const HERE = path.join(__dirname, '..');
const SRC = path.join(HERE, 'data', '2HHB.pdb');
const OUT = path.join(HERE, 'data', '2HHB-quaternary.json');

/* 2HHB is two alpha (A, C) and two beta (B, D). The page folds B, so the
   other three arrive in the order that tells the story: A first, because
   A+B is the alpha1-beta1 dimer that forms first and holds tightest;
   then C and D, the second dimer, which is the pair that slides during
   the T->R switch. */
const OTHERS = [
  { id: 'A', kind: 'alpha' },
  { id: 'C', kind: 'alpha' },
  { id: 'D', kind: 'beta'  },
];

function rotation() {
  const parsed = FoldLib.parse(extract(fs.readFileSync(SRC, 'utf8'), CHAIN).text, {});
  FoldLib.orient(parsed);
  return parsed.orientation;               // rows of a det=+1 rotation matrix
}

const apply = (R, p) => R.map(ax => ax[0] * p[0] + ax[1] * p[1] + ax[2] * p[2]);
const r2 = v => Math.round(v * 100) / 100;

/* One chain's Ca trace plus a secondary-structure string, both from the
   deposited file: the coordinates from its ATOM records, the helices from
   its own HELIX records. No DSSP and no heuristic — this is an X-ray
   structure and the crystallographers' assignment is the measurement. */
function traceOf(raw, id, R) {
  const ex = extract(raw, id);
  const CA = [], ss = [];
  for (const res of ex.residues) {
    if (!res.atoms.CA) throw new Error(`chain ${id} residue ${res.num} has no CA`);
    CA.push(apply(R, res.atoms.CA).map(r2));
    ss.push(ex.helices.some(([a, b]) => a <= res.num && res.num <= b) ? 'H' : 'C');
  }
  return { first: ex.residues[0].num, CA, ss: ss.join(''), helices: ex.helices.length };
}

/* The heme iron of each chain — HETATM, resname HEM, atom name FE. */
function irons(raw, R) {
  const out = {};
  for (const line of raw.split('\n')) {
    if (!line.startsWith('HETATM')) continue;
    if (line.slice(17, 20).trim() !== 'HEM') continue;
    if (line.slice(12, 16).trim() !== 'FE') continue;
    out[line[21]] = apply(R, [+line.slice(30, 38), +line.slice(38, 46),
                              +line.slice(46, 54)]).map(r2);
  }
  return out;
}

/* ---------------------------------------------------------- the whole heme
 *
 *  Protoporphyrin IX is what makes the iron a POCKET rather than a sphere
 *  in space: a flat ring of four pyrroles whose four nitrogens hold the Fe
 *  in the middle, two vinyls on one side and two propionate arms on the
 *  other. Drawn ball-and-stick it reads the way every published haemoglobin
 *  figure draws it, and it is the one place on this page where atoms are
 *  individually visible — the backbone is a ribbon precisely because 146
 *  residues of ball-and-stick is confetti, and 43 atoms is not.
 *
 *  CONNECTIVITY IS DEPOSITED, NOT INFERRED. 2HHB carries CONECT records for
 *  every heme atom, so the bond list here is the crystallographers', not a
 *  distance cutoff. That matters more than it looks: a cutoff
 *  wide enough for the 2.0 A Fe-N coordination bonds also catches
 *  1,3 neighbours across the pyrroles and draws a ring with its diagonals
 *  filled in. Bond ORDERS are not deposited and are not read — the ring is
 *  drawn as single sticks, which is the usual convention for a delocalised
 *  aromatic macrocycle and avoids claiming a particular Kekule structure.
 *
 *  The four Fe-NE2 bonds to His F8 are CONECT'd too, but their partner is a
 *  protein atom, not a heme atom, so they fall outside this residue and are
 *  dropped. The proximal histidine is a separate lesson and this page draws
 *  no side chains.
 */
function hemes(raw, R) {
  const lines = raw.split('\n');
  const bySerial = new Map();               // serial -> {chain, i}
  const out = {};

  for (const line of lines) {
    if (!line.startsWith('HETATM')) continue;
    if (line.slice(17, 20).trim() !== 'HEM') continue;
    const alt = line[16];
    if (alt !== ' ' && alt !== 'A') continue;
    const ch = line[21];
    const h = out[ch] || (out[ch] = { atoms: [], bonds: [] });
    bySerial.set(+line.slice(6, 11), { chain: ch, i: h.atoms.length });
    h.atoms.push({
      name: line.slice(12, 16).trim(),
      el: line.slice(76, 78).trim() || line.slice(12, 14).trim(),
      p: apply(R, [+line.slice(30, 38), +line.slice(38, 46),
                   +line.slice(46, 54)]).map(r2),
    });
  }

  /* CONECT is symmetric in the file, so keep each pair once (i < j) and
     keep only pairs whose ends are both in the same heme. */
  const seen = new Set();
  for (const line of lines) {
    if (!line.startsWith('CONECT')) continue;
    const a = bySerial.get(+line.slice(6, 11));
    if (!a) continue;
    for (let c = 11; c + 5 <= line.length; c += 5) {
      const field = line.slice(c, c + 5).trim();
      if (!field) continue;
      const b = bySerial.get(+field);
      if (!b || b.chain !== a.chain) continue;      // His NE2 and the like
      const lo = Math.min(a.i, b.i), hi = Math.max(a.i, b.i);
      const key = `${a.chain}:${lo}:${hi}`;
      if (lo === hi || seen.has(key)) continue;
      seen.add(key);
      out[a.chain].bonds.push([lo, hi]);
    }
  }

  for (const [ch, h] of Object.entries(out)) {
    if (h.atoms.length !== 43)
      throw new Error(`heme ${ch} has ${h.atoms.length} heavy atoms, expected 43`);
    if (!h.atoms.some(a => a.name === 'FE'))
      throw new Error(`heme ${ch} has no FE`);
    h.bonds.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
  }
  return out;
}

/* -------------------------------------------------- where the oxygen goes
 *
 *  Nothing is drawn at the site — the page's callout names the IRON, since
 *  that is what oxygen binds — but the site is computed anyway, because its
 *  two assertions in check-hb.js are the only thing establishing that the
 *  heme sits the right way round in its pocket. Derived from the structure,
 *  never nudged into place by eye.
 *
 *  The iron sits in the middle of the porphyrin with two axial sites, one
 *  each side of the ring plane. One is taken: His F8's NE2, the proximal
 *  histidine, the covalent link holding the heme to the protein. Oxygen
 *  binds the OTHER one, the distal site. So the construction is exact —
 *  the ring normal, signed to point AWAY from the proximal histidine, 1.8 A
 *  out, which is where an Fe-O2 bond puts the first oxygen.
 *
 *  THE SITE IS EMPTY IN THIS FILE AND THAT IS THE POINT. 2HHB is
 *  DEOXYhaemoglobin — the T state, no oxygen bound anywhere in it — so
 *  there is no atom here to point at and the label points at a vacancy.
 *  That is honest and it is the better lesson: the pocket the tertiary act
 *  spent its whole run building is a waiting space, and what the student is
 *  looking at is a molecule that has not picked up its oxygen yet.
 *
 *  The normal comes from the two N-N diagonals of the pyrrole nitrogens,
 *  which are square to a fraction of a degree, rather than a plane fit —
 *  a cross product of two diagonals of a square IS its normal, and it
 *  needs no eigenvectors to say so.
 */
const O2_DIST = 1.8;         // A, an Fe-O2 bond

function o2Site(h) {
  const at = n => h.atoms.find(a => a.name === n);
  const P = n => at(n).p;
  const [NA, NB, NC, ND, FE] = ['NA','NB','NC','ND','FE'].map(P);
  const sub = (a, b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
  const cross = (u, v) => [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]];
  const dot = (u, v) => u[0]*v[0] + u[1]*v[1] + u[2]*v[2];

  let n = cross(sub(NC, NA), sub(ND, NB));
  const L = Math.hypot(n[0], n[1], n[2]);
  n = n.map(c => c / L);

  /* Signed away from the proximal histidine. h.prox is its NE2, already in
     the same frame; without it there is no way to tell the two axial sites
     apart and the label could land on the side the protein occupies. */
  if (!h.prox) throw new Error('no proximal NE2 — cannot tell the distal side from the proximal one');
  if (dot(n, sub(h.prox, FE)) > 0) n = n.map(c => -c);

  return FE.map((c, i) => r2(c + n[i] * O2_DIST));
}

/* His F8's NE2, per chain: the nitrogen within bonding range of that
   chain's iron. Found by distance rather than by residue number because F8
   is a helix-position name and the two chain types number it differently
   (87 in alpha, 92 in beta) — the bond is the same fact in both. */
function proximalNE2(raw, R) {
  const out = {};
  const fe = irons(raw, R);
  for (const line of raw.split('\n')) {
    if (!line.startsWith('ATOM')) continue;
    if (line.slice(17, 20).trim() !== 'HIS') continue;
    if (line.slice(12, 16).trim() !== 'NE2') continue;
    const ch = line[21];
    if (!fe[ch]) continue;
    const p = apply(R, [+line.slice(30, 38), +line.slice(38, 46), +line.slice(46, 54)]);
    const d = Math.hypot(p[0]-fe[ch][0], p[1]-fe[ch][1], p[2]-fe[ch][2]);
    if (d < 2.6 && (!out[ch] || d < out[ch].d)) out[ch] = { p: p.map(r2), d, num: +line.slice(22, 26) };
  }
  return out;
}

/* Everything the callouts need, added to each heme: the proximal NE2 that
   defines which side is which, the empty distal site, and the ring's own
   centre — which is the iron, but named so a label reading "Heme group"
   can point at the group rather than at the metal. */
function withSites(hs, prox) {
  for (const [ch, h] of Object.entries(hs)) {
    if (!prox[ch]) throw new Error(`chain ${ch}'s heme has no proximal histidine within 2.6 A`);
    h.prox = prox[ch].p;
    h.proxRes = prox[ch].num;
    h.o2 = o2Site(h);
  }
  return hs;
}

/* ------------------------------------------------ what holds an interface
 *
 *  MEASURED FIRST, DRAWN SECOND, and the measurement is the reason the
 *  page draws what it draws. At the alpha1-beta1 interface of 2HHB about
 *  thirty residues are in contact and only EIGHT hydrogen bonds hold them.
 *  Everything else is hydrophobic packing — which is not a bond, has no
 *  endpoints, and must not be drawn as though it had. Marking all thirty
 *  contact residues would claim thirty interactions that do not exist.
 *
 *  So two different things come out of here, deliberately unlike each
 *  other:
 *
 *    contact   COUNTS ONLY. How big the patch is, per interface. This is
 *              what makes the arrival order a measured statement rather
 *              than a staging choice: A-B is 72 Ca contacts, C-B is 43, so
 *              A lands first. No coordinates, because nothing draws it —
 *              the packing is left undrawn.
 *
 *    bonds     COORDINATES. The individual hydrogen bonds across the new
 *              interface, donor/acceptor heavy atoms, which the page draws
 *              as dashes in the same ink as the backbone H-bonds because
 *              they are the same kind of bond doing the same job one level
 *              up.
 *
 *  DISTANCE ONLY, NO ANGLE. 2HHB models no hydrogens, and unlike the
 *  backbone case (chain.js builds the amide H from the preceding C=O)
 *  a side-chain donor's H cannot be placed without knowing its rotamer.
 *  So the test is N/O to N/O within POLAR A, which is the standard
 *  heavy-atom criterion and is what a structure paper reports. It cannot
 *  distinguish donor from acceptor, and it does not need to: the page
 *  draws an undirected dash.
 */
const CONTACT = 8.5;    // Ca-Ca, a residue-level "these two touch"
const POLAR   = 3.4;    // N/O to N/O, the heavy-atom hydrogen-bond criterion

/* contactCount(arriving, present) -> { self, other }
   How many residues on each side of the new interface are in contact.
   Deduplicated: a residue touching two chains at once is one residue. */
function contactCount(arriving, present) {
  let self = 0; const seen = new Set();
  for (const a of arriving) {
    let touching = false;
    for (const P of present) for (const b of P) {
      if (Math.hypot(a[0]-b[0], a[1]-b[1], a[2]-b[2]) > CONTACT) continue;
      touching = true;
      seen.add(b.join(','));
    }
    if (touching) self++;
  }
  return { self, other: seen.size };
}

/* Every N and O of a chain, with the residue it belongs to, for the polar
   test. Altlocs are already filtered by extract(). */
function polarAtoms(raw, id, R) {
  const ex = extract(raw, id);
  const out = [];
  for (const res of ex.residues)
    for (const [name, xyz] of Object.entries(res.atoms)) {
      if (name[0] !== 'N' && name[0] !== 'O') continue;   // PDB names start with the element
      if (name === 'H') continue;
      out.push({ res: res.name, num: res.num, name, p: apply(R, xyz) });
    }
  return out;
}

/* bondsOf(arriving, present) -> [{ self:[x,y,z], other:[x,y,z], label }]
   `self` is on the arriving chain and moves with it; `other` is already
   in place. One entry per atom pair, so a bifurcated bond appears twice —
   which is what it is. */
function bondsOf(arriving, present) {
  const out = [];
  for (const a of arriving) for (const b of present) {
    const d = Math.hypot(a.p[0]-b.p[0], a.p[1]-b.p[1], a.p[2]-b.p[2]);
    if (d > POLAR) continue;
    out.push({ self: a.p.map(r2), other: b.p.map(r2),
               label: `${a.res}${a.num} ${a.name} - ${b.res}${b.num} ${b.name}`,
               d: r2(d) });
  }
  return out;
}

function bakeQuaternary() {
  const raw = fs.readFileSync(SRC, 'utf8');
  const R = rotation();
  const chains = {};
  for (const c of OTHERS) chains[c.id] = Object.assign({ kind: c.kind }, traceOf(raw, c.id, R));

  /* Interfaces, in arrival order: each chain against everything on screen
     when it lands. The folded chain is always there. */
  const foldedTr = traceOf(raw, CHAIN, R);
  const folded = foldedTr.CA;
  const present = [folded];
  const presentPolar = [polarAtoms(raw, CHAIN, R)];
  for (const c of OTHERS) {
    chains[c.id].contact = contactCount(chains[c.id].CA, present);
    const mine = polarAtoms(raw, c.id, R);
    chains[c.id].bonds = bondsOf(mine, [].concat(...presentPolar));
    present.push(chains[c.id].CA);
    presentPolar.push(mine);
  }

  return {
    source: '2HHB', method: 'X-ray 1.74 A',
    folded: CHAIN,                       // the chain the page folds; not repeated here
    note: 'deposited Ca traces of the other three chains, rotated into the ' +
          'folding chain\'s frame by FoldLib.orient(). Static: placed, not solved.',
    order: OTHERS.map(c => c.id),
    chains,
    contactRadius: CONTACT, polarRadius: POLAR,
    iron: irons(raw, R),
    heme: withSites(hemes(raw, R), proximalNE2(raw, R)),
    /* The folded chain's HELIX-record count. The page says "eight helices"
       out loud and must pull that number rather than hold a copy of it, and
       it cannot derive it from the trajectory's own `ss`: adjacent helices
       with no coil between them merge into one run there, which counts 5.
       Eight is a property of the deposited HELIX records, so it comes from
       the same place they do. */
    foldedHelices: foldedTr.helices,
    foldedTrace: folded,                      // for check-hb.js only
  };
}

module.exports = { bakeQuaternary, OTHERS };

if (require.main === module) {
  const data = bakeQuaternary();
  fs.writeFileSync(OUT, JSON.stringify(data));
  const n = Object.values(data.chains).reduce((s, c) => s + c.CA.length, 0);
  console.log(`wrote ${path.relative(process.cwd(), OUT)} — ` +
    `${Object.keys(data.chains).length} chains, ${n} residues, ` +
    `${Object.keys(data.heme).length} hemes ` +
    `(${Object.values(data.heme)[0].atoms.length} atoms, ` +
    `${Object.values(data.heme)[0].bonds.length} bonds each), ` +
    `${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`);
}
