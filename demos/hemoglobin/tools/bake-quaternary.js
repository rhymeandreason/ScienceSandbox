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
 *  It also writes the four heme irons. They are one atom each and they
 *  are the reason the protein exists — the pocket the tertiary act builds
 *  is where this atom sits — so the page can finish on the thing the
 *  whole structure is for.
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

/* ------------------------------------------------ what holds an interface
 *
 *  MEASURED FIRST, DRAWN SECOND, and the measurement is the reason the
 *  page draws what it draws. At the alpha1-beta1 interface of 2HHB about
 *  thirty residues are in contact and only EIGHT hydrogen bonds hold them.
 *  Everything else is hydrophobic packing — which is not a bond, has no
 *  endpoints, and must not be drawn as though it had: an earlier version
 *  marked all thirty contact residues and so claimed thirty interactions
 *  that do not exist.
 *
 *  So two different things come out of here, deliberately unlike each
 *  other:
 *
 *    contact   COUNTS ONLY. How big the patch is, per interface. This is
 *              what makes the arrival order a measured statement (A-B is
 *              72 Ca contacts, C-B is 43), and it is quoted in the panel.
 *              No coordinates, because nothing draws it — the packing is
 *              named in words and left undrawn.
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
  const folded = traceOf(raw, CHAIN, R).CA;
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
    `${Object.keys(data.iron).length} irons, ` +
    `${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`);
}
