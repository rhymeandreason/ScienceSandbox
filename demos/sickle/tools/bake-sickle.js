#!/usr/bin/env node
/* =====================================================================
 *  bake-sickle.js — the two tetramers sickle-lab.html docks together.
 *
 *  THE LESSON THIS FILE SERVES. Haemoglobin S folds correctly. Its
 *  sequence is right but for one residue, its fold is right, its oxygen
 *  binding is right. What changes is that beta6 stops being glutamate —
 *  charged, happy in water — and becomes valine, which is not. One
 *  greasy patch appears on a surface that was uniformly polar, and greasy
 *  patches find each other. Everything this baker writes exists to let a
 *  student see that and nothing else.
 *
 *  So: NO fibre, NO oxygen, NO folding. Two copies of a finished
 *  tetramer, the patch, the pocket it lands in, and the pose the crystal
 *  says it lands in.
 *
 *  WHY 2HHB FOR THE MOLECULE AND 2HBS FOR THE POSE. Polymerisation is a
 *  T-state phenomenon — oxygenated haemoglobin S does not stack — and
 *  2HHB is deoxy T at 1.74 A, the same structure the folding lesson
 *  already ships. 2HBS is the HbS fibre, and what it uniquely carries is
 *  the DONOR-ACCEPTOR GEOMETRY: which beta6 valine sits in which
 *  partner's hydrophobic pocket, at what distance and what angle. That
 *  contact is the answer key. Deriving it from anything other than a
 *  measured structure would make the score a number this repo invented,
 *  and CLAUDE.md is explicit that a number on screen is a claim something
 *  has to check.
 *
 *  ONE RESIDUE IS NOT BAKED. Glu6 and Val6 are BOTH grafted in the page
 *  from residues.js, onto residue 6's own deposited N-CA-C frame, which
 *  is why this file writes that frame rather than either side chain. The
 *  mutation toggle is then a graft swap on identical backbone — the
 *  shape barely moves and the chemistry changes completely, which is the
 *  whole point and would be quietly undermined if the two states came
 *  from two different structures with two different backbones.
 *
 *  Valine is SMALLER than glutamate. Nothing here should make it look
 *  like a knob appearing.
 *
 *  Run:  node sickle/tools/bake-sickle.js      (offline)
 *  Checked by: sickle/tools/check-sickle.js
 * ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const { extract } = require('../../hemoglobin/tools/chain.js');

const HERE = path.join(__dirname, '..');
const DATA = path.join(__dirname, '..', '..', 'hemoglobin', 'data');
const HB = path.join(DATA, '2HHB.pdb');
const HBS = path.join(DATA, '2HBS.pdb');
const OUT = path.join(HERE, 'data', 'sickle.json');

/* ------------------------------------------------------------ the answer key
 *
 *  2HBS holds TWO tetramers in one asymmetric unit — ABCD and EFGH — and
 *  the fibre contact is between them, not across a symmetry operation:
 *  chain H's Val6 sits in chain B's pocket, 5.1 A from Leu88's CD1. Every
 *  other beta6/pocket pairing in the file is 30-80 A apart, so the contact
 *  is not one of several candidates that had to be chosen between. That is
 *  what makes DONOR and ACCEPTOR measured roles rather than assigned ones.
 *
 *  The page draws ONE tetramer (2HHB) twice, so what it needs is the rigid
 *  motion carrying the acceptor copy onto the donor copy. Superpose 2HHB
 *  onto 2HBS's ABCD, superpose it onto EFGH, and compose one with the
 *  inverse of the other. Both superpositions are Kabsch on matched Ca, and
 *  their RMSDs are written out: HbS and HbA differ by one residue, so a
 *  fit that is not tight means the correspondence is wrong, not that the
 *  molecules differ.
 */
const ACCEPTOR = ['A', 'B', 'C', 'D'];      // 2HBS chains our tetramer lands on
const DONOR    = ['E', 'F', 'G', 'H'];      // ...and the copy that docks into it
const DONOR_BETA = 'H', ACCEPTOR_BETA = 'B';   // the beta6 and the pocket that meet

/* 2HHB is two alpha (A, C) and two beta (B, D). Only the beta chains
   matter to this lesson: beta6 is the mutation and beta85/beta88 line
   the pocket. The alphas are drawn because a tetramer is what a student
   should see, not because anything happens on them. */
const KIND = { A: 'alpha', B: 'beta', C: 'alpha', D: 'beta' };

/* The acceptor pocket. Phe85 and Leu88 of the PARTNER beta chain are the
   two residues the donor valine actually touches in the fibre — the
   contact every HbS paper draws. Their side chains are deposited, so
   they come out of the crystal rather than off a graft. */
const POCKET = [85, 88];

const r2 = v => Math.round(v * 100) / 100;
const { mean } = require('../../proteins/bake-lib.js');

/* Backbone atoms are backbone. A hydrophobicity colour is a claim about
   the SIDE CHAIN, so the sphere it paints sits at the side chain's own
   centroid — for glycine, which has none, at CA. */
const BACKBONE = new Set(['N', 'CA', 'C', 'O', 'OXT']);

function residuesOf(raw, id) {
  const ex = extract(raw, id);
  const out = [];
  for (const res of ex.residues) {
    if (!res.atoms.CA) throw new Error(`chain ${id} residue ${res.num} has no CA`);
    const side = Object.entries(res.atoms)
      .filter(([n]) => !BACKBONE.has(n) && n !== 'H')
      .map(([, p]) => p);
    out.push({
      num: res.num,
      name: res.name,
      CA: res.atoms.CA.map(r2),
      side: (side.length ? mean(side) : res.atoms.CA).map(r2),
    });
  }
  return {
    kind: KIND[id],
    first: ex.residues[0].num,
    res: out,
    ss: ex.residues.map(r =>
      ex.helices.some(([a, b]) => a <= r.num && r.num <= b) ? 'H' : 'C').join(''),
    helices: ex.helices.length,
  };
}

/* Residue 6's deposited backbone frame, which the page grafts both GLU
   and VAL onto. Three atoms, and ResidueLib.graft does the rest. */
function frame6(raw, id) {
  const res = extract(raw, id).residues.find(r => r.num === 6);
  if (!res) throw new Error(`chain ${id} has no residue 6`);
  for (const n of ['N', 'CA', 'C'])
    if (!res.atoms[n]) throw new Error(`chain ${id} residue 6 has no ${n}`);
  return {
    deposited: res.name,                        // GLU — the wild type
    N: res.atoms.N.map(r2),
    CA: res.atoms.CA.map(r2),
    C: res.atoms.C.map(r2),
  };
}

/* Phe85 and Leu88 with their real atoms and bonds, for the close-up.
   Everything else on the page is a sphere per residue; the pocket is the
   one place where a student should see the actual greasy rings. */
function pocketOf(raw, id) {
  const ex = extract(raw, id);
  const out = [];
  for (const num of POCKET) {
    const res = ex.residues.find(r => r.num === num);
    if (!res) throw new Error(`chain ${id} has no residue ${num}`);
    out.push({
      num, name: res.name,
      atoms: Object.entries(res.atoms)
        .filter(([n]) => n !== 'H')
        .map(([n, p]) => ({ name: n, el: n[0], p: p.map(r2) })),
    });
  }
  return out;
}

/* KABSCH, JACOBI AND THE REFLECTION TRAP ARE proteins/bake-lib.js's. They
   were written here and moved when the sixth baker under proteins/ reached
   across the repo for them; re-exported below so this folder's other scripts
   and check-sickle.js still take them from where they always did. */
const { kabsch, mul, det } = require('../../proteins/bake-lib.js');


/* Matched Ca between our tetramer and one of 2HBS's, by chain role and
   residue number. Anything present in only one file is dropped rather than
   guessed at — 2HBS is 2.05 A and models a few residues 2HHB does not. */
function matched(hbRes, hbsRaw, ids) {
  const P = [], Q = [];
  ids.forEach((id, k) => {
    const src = 'ABCD'[k];
    const byNum = new Map();
    for (const r of extract(hbsRaw, id).residues)
      if (r.atoms.CA) byNum.set(r.num, r.atoms.CA);
    for (const r of extract(hbRes, src).residues) {
      if (!r.atoms.CA || !byNum.has(r.num)) continue;
      P.push(r.atoms.CA); Q.push(byNum.get(r.num));
    }
  });
  return { P, Q };
}

/* ------------------------------------------------- how much surface is buried
 *
 *  The page's live readout is a RELATIVE score — how much of the real
 *  contact the student has found — because the honest absolute measure is
 *  solvent-accessible surface area, and SASA over both tetramers is ~9000
 *  atoms a frame. Nothing that answers in 16 ms is the real quantity, and a
 *  fast lookalike presented in angstroms squared would be a made-up number
 *  wearing a unit.
 *
 *  So the Angstrom-squared figure is measured ONCE, here, and appears in the
 *  page as a stated fact about the real contact rather than as a dial. It is
 *  measured on 2HBS itself — the deposited pose IS its two tetramers, so no
 *  transform is involved and nothing this file computed can bias it.
 *
 *  Shrake-Rupley: roll a 1.4 A probe, count how much of each atom's expanded
 *  sphere stays clear. Buried = (donor alone + acceptor alone) - (the two
 *  together), over NONPOLAR side-chain atoms only, which is the surface the
 *  lesson is about. Carbon and sulfur count as nonpolar; N and O do not; and
 *  backbone is excluded because the claim is about side chains.
 */
const VDW = { C: 1.70, N: 1.55, O: 1.52, S: 1.80, FE: 1.80, H: 1.20 };
const PROBE = 1.4, NSPHERE = 256;

const spherePoints = (() => {
  const pts = [], phi = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < NSPHERE; i++) {
    const y = 1 - (i / (NSPHERE - 1)) * 2, r = Math.sqrt(Math.max(0, 1 - y * y));
    pts.push([Math.cos(phi * i) * r, y, Math.sin(phi * i) * r]);
  }
  return pts;
})();

/* atoms: [{p, r, nonpolar}] — returns total nonpolar area, A^2. */
function sasaNonpolar(atoms) {
  const CELL = 8;
  const grid = new Map();
  const key = p => `${Math.floor(p[0] / CELL)},${Math.floor(p[1] / CELL)},${Math.floor(p[2] / CELL)}`;
  atoms.forEach((a, i) => {
    const k = key(a.p);
    (grid.get(k) || grid.set(k, []).get(k)).push(i);
  });

  let total = 0;
  for (let i = 0; i < atoms.length; i++) {
    const a = atoms[i];
    if (!a.nonpolar) continue;
    const R = a.r + PROBE;

    const near = [];
    const [cx, cy, cz] = a.p.map(v => Math.floor(v / CELL));
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++)
      for (const j of grid.get(`${cx + dx},${cy + dy},${cz + dz}`) || []) {
        if (j === i) continue;
        const b = atoms[j], lim = R + b.r + PROBE;
        const d2 = (a.p[0] - b.p[0]) ** 2 + (a.p[1] - b.p[1]) ** 2 + (a.p[2] - b.p[2]) ** 2;
        if (d2 < lim * lim) near.push({ p: b.p, rr: (b.r + PROBE) ** 2 });
      }

    let clear = 0;
    for (const s of spherePoints) {
      const q = [a.p[0] + s[0] * R, a.p[1] + s[1] * R, a.p[2] + s[2] * R];
      let hit = false;
      for (const b of near) {
        const d2 = (q[0] - b.p[0]) ** 2 + (q[1] - b.p[1]) ** 2 + (q[2] - b.p[2]) ** 2;
        if (d2 < b.rr) { hit = true; break; }
      }
      if (!hit) clear++;
    }
    total += 4 * Math.PI * R * R * clear / NSPHERE;
  }
  return total;
}

/* Side-chain heavy atoms of the given 2HBS chains, tagged polar or not. */
function sideAtoms(raw, ids) {
  const out = [];
  for (const id of ids)
    for (const res of extract(raw, id).residues)
      for (const [name, p] of Object.entries(res.atoms)) {
        if (BACKBONE.has(name) || name === 'H') continue;
        const el = (name.match(/^[A-Z]{1,2}/) || ['C'])[0].replace(/[0-9]/g, '');
        const e = VDW[el] ? el : el[0];
        out.push({ p, r: VDW[e] || 1.7, nonpolar: e === 'C' || e === 'S' });
      }
  return out;
}

/* ------------------------------------------------------- who is on the surface
 *
 *  The page first drew a sphere for every residue, all 574 of them, coloured
 *  by hydrophobicity. It read as confetti, and worse, it read as a WRONG
 *  claim: an even speckle of orange and blue over the whole particle, when
 *  the actual fact about a folded protein is that it buries its greasy
 *  residues and turns a mostly polar face to the water. The Val6 patch cannot
 *  be the odd thing out on a surface that is already covered in orange.
 *
 *  So exposure is measured here, per residue, as side-chain SASA relative to
 *  that residue type free in solution, and the page draws only the residues
 *  that are actually on the outside. The 25% cutoff is the usual one in the
 *  literature for calling a residue exposed; the page owns the threshold, so
 *  the number shipped is the ratio itself.
 *
 *  GLYCINE HAS NO SIDE CHAIN, so its ratio is meaningless and it is given 0.
 *  It is drawn at CA like everything else and is very nearly colourless on
 *  the Kyte-Doolittle scale, so nothing hangs on it.
 */
function exposure(raw, ids) {
  /* CONTEXT IS THE WHOLE TETRAMER, not the chain. A residue sitting in an
     alpha1-beta1 interface is buried by the chain next to it, and measuring
     it against its own chain alone would call it exposed — putting colour on
     the outside of the model where there is no outside. */
  const atoms = [], spans = [];
  for (const id of ids)
    for (const res of extract(raw, id).residues) {
      const start = atoms.length;
      for (const [name, p] of Object.entries(res.atoms)) {
        if (name === 'H') continue;
        const el = (name.match(/^[A-Z]/) || ['C'])[0];
        atoms.push({ p, r: VDW[el] || 1.7, nonpolar: false, side: !BACKBONE.has(name) });
      }
      spans.push({ id, res, start, end: atoms.length });
    }

  /* Marking only ONE residue's side chain as "nonpolar" makes sasaNonpolar
     return that residue's area and nothing else, with every other atom still
     present as an occluder. The reference is the same atoms with no
     occluders, so the ratio is free-in-solution to in-the-protein. */
  const ref = {};
  const out = {};
  for (const { id, res, start, end } of spans) {
    const mine = [];
    for (let i = start; i < end; i++) if (atoms[i].side) mine.push(i);
    (out[id] || (out[id] = []));
    if (!mine.length) { out[id].push({ num: res.num, rel: 0 }); continue; }

    for (const i of mine) atoms[i].nonpolar = true;
    const inPlace = sasaNonpolar(atoms);
    for (const i of mine) atoms[i].nonpolar = false;

    if (ref[res.name] == null)
      ref[res.name] = sasaNonpolar(mine.map(i => ({ ...atoms[i], nonpolar: true })));
    out[id].push({ num: res.num,
      rel: Math.min(1, Math.round(inPlace / (ref[res.name] || 1) * 100) / 100) });
  }
  return out;
}

function buriedNonpolar(raw) {
  const A = sideAtoms(raw, ACCEPTOR), D = sideAtoms(raw, DONOR);
  const apart = sasaNonpolar(A) + sasaNonpolar(D);
  const together = sasaNonpolar(A.concat(D));
  return apart - together;
}

function bake() {
  const raw = fs.readFileSync(HB, 'utf8');
  const chains = {};
  for (const id of Object.keys(KIND)) chains[id] = residuesOf(raw, id);

  /* Relative side-chain exposure, so the page can draw the OUTSIDE of the
     protein rather than a speckle through its whole volume. */
  const exp = exposure(raw, Object.keys(KIND));
  for (const [id, c] of Object.entries(chains)) {
    const by = new Map(exp[id].map(e => [e.num, e.rel]));
    for (const r of c.res) r.rel = by.get(r.num) ?? 0;
  }

  /* Centre on the tetramer so the page never hand-picks an offset. The
     shift is written down because the docking transform below has to be
     expressed in the same frame. */
  const all = [];
  for (const c of Object.values(chains)) for (const r of c.res) all.push(r.CA);
  const centre = mean(all).map(r2);
  for (const c of Object.values(chains))
    for (const r of c.res) {
      r.CA = r.CA.map((v, k) => r2(v - centre[k]));
      r.side = r.side.map((v, k) => r2(v - centre[k]));
    }

  const shift = p => p.map((v, k) => r2(v - centre[k]));
  const beta6 = {}, pocket = {};
  for (const id of ['B', 'D']) {
    const f = frame6(raw, id);
    beta6[id] = { deposited: f.deposited, N: shift(f.N), CA: shift(f.CA), C: shift(f.C) };
    pocket[id] = pocketOf(raw, id).map(r => ({
      ...r, atoms: r.atoms.map(a => ({ ...a, p: shift(a.p) })),
    }));
  }

  /* ---- the docked pose, in the same centred frame the page draws in.
     Ta takes our tetramer onto 2HBS's acceptor, Td onto its donor; the
     motion the page needs is Ta^-1 . Td, re-expressed about `centre`. */
  const hbs = fs.readFileSync(HBS, 'utf8');
  const fitA = (() => { const m = matched(raw, hbs, ACCEPTOR); return kabsch(m.P, m.Q); })();
  const fitD = (() => { const m = matched(raw, hbs, DONOR);    return kabsch(m.P, m.Q); })();

  const RaT = [0, 1, 2].map(i => [0, 1, 2].map(j => fitA.R[j][i]));
  const R = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++)
    for (let k = 0; k < 3; k++) R[i][j] += RaT[i][k] * fitD.R[k][j];
  const b = mul(RaT, fitD.t.map((v, k) => v - fitA.t[k]));
  const t = mul(R, centre).map((v, k) => v + b[k] - centre[k]);

  if (Math.abs(det(R) - 1) > 1e-6)
    throw new Error(`docking transform has determinant ${det(R)} — it mirrors the molecule`);

  /* The contact this whole page is about, re-measured through the transform
     that will actually be applied in the browser: the donor beta's Val6
     against the acceptor beta's pocket. If the composition above is wrong
     this number is 30 A and the bake stops, rather than shipping a page
     whose answer key is somewhere out in the solvent. */
  const dock = p => mul(R, p).map((v, k) => v + t[k]);
  const donorBeta = 'ABCD'[DONOR.indexOf(DONOR_BETA)];        // our chain playing H
  const accBeta   = 'ABCD'[ACCEPTOR.indexOf(ACCEPTOR_BETA)];  // ...and the one playing B

  const d6 = dock(beta6[donorBeta].CA);
  const pocketCentre = mean(pocket[accBeta].flatMap(r => r.atoms.map(a => a.p)));
  const reach = Math.hypot(...d6.map((v, k) => v - pocketCentre[k]));
  if (reach > 12)
    throw new Error(`docked beta6 CA is ${reach.toFixed(1)} A from the pocket — ` +
                    `the transform is wrong, not the chemistry`);

  /* ---------------------------------------------- the interface, atom by atom
   *
   *  WHY THIS BLOCK EXISTS, since it is the expensive one. The page first
   *  scored the drag on side-chain CENTROIDS, one sphere per residue, which
   *  is what it draws. Measured against the crystal that score does not just
   *  miss — the deposited pose is not its maximum, and not even a local
   *  maximum: a 0.05 rad twist beat it. Centroids cannot tell burial from
   *  interpenetration, because two residues whose centroids sit a comfortable
   *  4.5 A apart can have their actual atoms straight through each other.
   *
   *  There is a second reason, and it is chemistry rather than resolution:
   *  the fibre contact is SMALL AND SPECIFIC. Two haemoglobin tetramers have
   *  greasier faces available than this one, and a score that rewards contact
   *  anywhere prefers them — correctly. The fibre picks this contact because
   *  of the geometry the fibre is in, not because it is the stickiest spot.
   *
   *  So the score runs on real atoms, and only over the residues that can
   *  reach across the contact. Everything outside NEAR is drawn but never
   *  scored, which is what keeps a live readout affordable.
   */
  const NEAR = 16;                    // A from the contact centre
  const contactCentre = mean([dock(beta6[donorBeta].CA), pocketCentre]);
  const interfaceAtoms = (id, transform) => {
    const out = [];
    for (const res of extract(raw, id).residues) {
      const ca = shift(res.atoms.CA);
      const at = transform ? dock(ca) : ca;
      if (Math.hypot(...at.map((v, k) => v - contactCentre[k])) > NEAR) continue;
      for (const [name, p] of Object.entries(res.atoms)) {
        if (name === 'H') continue;
        const el = (name.match(/^[A-Z]/) || ['C'])[0];
        out.push({ res: res.num, ch: id, name: res.name, atom: name, el,
                   p: shift(p).map(r2) });
      }
    }
    return out;
  };
  const iface = {
    donor:    Object.keys(KIND).flatMap(id => interfaceAtoms(id, true)),
    acceptor: Object.keys(KIND).flatMap(id => interfaceAtoms(id, false)),
    near: NEAR, centre: contactCentre.map(r2),
  };

  return {
    source: '2HHB', method: 'X-ray 1.74 A, deoxy T-state',
    iface,
    note: 'one HbS tetramer, centred on its own Ca centroid. Deoxy because ' +
          'polymerisation is a T-state phenomenon. beta6 is a BACKBONE FRAME, ' +
          'not a side chain: the page grafts GLU or VAL onto it from residues.js.',
    centre, chains, beta6, pocket, pocketResidues: POCKET,
    dock: {
      src: '2HBS', method: 'X-ray 2.05 A, deoxy HbS',
      note: 'rigid motion carrying the acceptor copy onto the donor copy, from ' +
            "2HBS's own two tetramers. Donor beta6 is chain " + donorBeta +
            ', the pocket it enters is chain ' + accBeta + '.',
      donorBeta, acceptorBeta: accBeta,
      R: R.map(r => r.map(v => Math.round(v * 1e6) / 1e6)),
      t: t.map(r2),
      rmsd: { acceptor: r2(fitA.rmsd), donor: r2(fitD.rmsd) },
      reach: r2(reach),
      buriedNonpolar: Math.round(buriedNonpolar(hbs)),   // A^2, measured on 2HBS
      probe: PROBE, spherePoints: NSPHERE,
    },
  };
}

if (require.main === module) {
  const data = bake();
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(data));
  const n = Object.values(data.chains).reduce((s, c) => s + c.res.length, 0);
  console.log(`sickle.json  ${n} residues, 4 chains, ` +
              `${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`);
}

module.exports = {
  bake, POCKET, KIND, ACCEPTOR, DONOR,
  kabsch, det, mul, sasaNonpolar, sideAtoms, buriedNonpolar, VDW, PROBE,
};
