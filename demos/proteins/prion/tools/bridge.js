#!/usr/bin/env node
/* =====================================================================
 *  bridge.js — fill residues one structure resolved and the other did not.
 *
 *  THE PROBLEM. 7LNA orders residues 95-227 but models nothing for
 *  194-196: three residues in the middle of the range this page draws.
 *  1B10 has them. So the pair is 100 residues with a three-residue hole in
 *  the middle of it, and every option for that hole is worse than it
 *  sounds:
 *
 *    · drop to the largest unbroken run  — loses 125-193 or 197-227,
 *      which is either helix 1 and the native sheet or the whole of
 *      helix 3. Half the point of moving to this pair.
 *    · morph the two runs separately     — each run is rebuilt from its
 *      own seed, so they arrive with the right shapes in the wrong places
 *      relative to each other. The rendering assembles into nothing.
 *    · copy 1B10's coordinates in        — a chain break at both ends,
 *      because the native's linker does not join the fibril's segments.
 *      The peptide bonds either side come out wrong and stay wrong, and
 *      the morph's one hard guarantee is that bond lengths do not move.
 *
 *  WHAT THIS DOES INSTEAD. The three residues are built at ideal backbone
 *  geometry (Engh & Huber, via FoldLib.IDEAL) and their torsions are
 *  SOLVED so the resolved segment downstream lands on its own deposited
 *  coordinates. Eight dihedrals are free — phi and psi of 194, 195, 196,
 *  plus the two the gap makes unmeasurable on either side (psi of 193 is
 *  reachable, phi of 197 is not, because both reference an atom nobody
 *  modelled). The omegas stay at 180: a peptide bond is planar, and
 *  rotating one to close a loop is buying geometry with chemistry.
 *
 *  IT IS A CLOSURE, NOT A MEASUREMENT, AND THE PAGE HAS TO SAY SO. Nobody
 *  knows what those three residues do. What is claimed here is only that
 *  they CAN join the two resolved segments without strain — which is a
 *  fact about chain geometry, and it is the same fact that makes the hole
 *  bridgeable at all: C(193) to N(197) is 10.0 A across four peptide
 *  steps, well inside what three residues reach.
 *
 *  Run through prep.js, not directly.
 * ===================================================================== */
'use strict';

const P = require('../prion.js');
const FoldLib = require('../../../folding/folding.js');
const v3 = P._v3;
const I = FoldLib.IDEAL;

/* WHAT A GAP MAKES UNKNOWABLE IS DECIDED PER ATOM, NOT PER RESIDUE.

   An entry in the trace holds a bond length (atoms i-1, i), a bond angle
   (i-2, i-1, i) and a dihedral (i-3 ... i). Each is measurable exactly
   when every atom it references was modelled — so the question is never
   "is this residue in the gap", it is "does this quantity reach into it".

   The difference is not academic. phi of residue 197 reaches back to C of
   196, which nobody modelled, so it is unknown even though 197 itself is
   fully resolved. Deciding by residue number leaves it measured — at a
   value read off placeholder coordinates — and the solve then has seven
   free torsions where it needs eight, cannot close, and settles 14 A from
   the target with nothing to say it failed except the number. */
function classify(atoms, gap) {
  const isGap = i => i >= 0 && gap.has(atoms[i].res);
  return atoms.map((a, i) => ({
    len: !isGap(i - 1) && !isGap(i),
    ang: !isGap(i - 2) && !isGap(i - 1) && !isGap(i),
    dih: !isGap(i - 3) && !isGap(i - 2) && !isGap(i - 1) && !isGap(i),
    omega: a.name === 'CA',
  }));
}

/* bridge(residues, gapNums, opts) -> residues, with the gap filled.

   `residues` is the deposited list with the gap simply absent. The gap
   residues are inserted with placeholder coordinates, measured into
   internal coordinates like everything else, and then the entries the gap
   touches are overwritten with ideal geometry before the solve. Reusing
   internals() this way keeps ONE code path building the trace — a second
   hand-rolled one would be the obvious place for the two to drift. */
function bridge(residues, gapNums, opts) {
  const o = Object.assign({ sweeps: 60, coarse: 15, tol: 1e-4 }, opts || {});
  const gap = new Set(gapNums);
  const byNum = new Map(residues.map(r => [r.num, r]));

  const lo = residues[0].num, hi = residues[residues.length - 1].num;
  const full = [];
  for (let n = lo; n <= hi; n++) {
    if (byNum.has(n)) { full.push(byNum.get(n)); continue; }
    if (!gap.has(n)) throw new Error(`residue ${n} is missing and was not declared a gap`);
    /* Placeholder positions, thrown away by the first rebuild. They only
       have to be distinct and non-collinear so the dihedral measurement
       they feed does not divide by zero. */
    const k = n - lo;
    full.push({ num: n, name: 'UNK', atoms: {
      N:  [k * 3.0, 0, 0], CA: [k * 3.0 + 1.4, 0.6, 0], C: [k * 3.0 + 2.2, 0, 0.7],
    }});
  }

  const shape = P.internals(full);
  const ic = shape.ic.map(x => ({ len: x.len, ang: x.ang, dih: x.dih }));

  /* Ideal backbone geometry for exactly the quantities the gap put out of
     reach, and the deposited value for everything else. A bond inside a
     resolved residue stays measured even where its residue sits next to
     the hole. */
  const known = classify(shape.atoms, gap);
  shape.atoms.forEach((a, i) => {
    const k = known[i];
    if (!k.len) ic[i].len = a.name === 'N' ? I.C_N : a.name === 'CA' ? I.N_CA : I.CA_C;
    if (!k.ang) ic[i].ang = a.name === 'N' ? I.ang_CA_C_N
                          : a.name === 'CA' ? I.ang_C_N_CA : I.ang_N_CA_C;
    if (!k.dih && k.omega) ic[i].dih = I.omega;
  });

  /* The target: every resolved trace atom AFTER the gap, at the
     coordinates 7LNA gives it. The rebuild is seeded on the first
     residue's own deposited atoms, so everything before the gap already
     sits exactly on the deposited structure and the only thing the solve
     can move is what comes after. */
  const last = Math.max(...gapNums);
  const targets = [];
  shape.atoms.forEach((a, i) => {
    if (a.res <= last) return;
    const r = byNum.get(a.res);
    if (r && r.atoms[a.name]) targets.push({ i, p: r.atoms[a.name] });
  });

  const cost = () => {
    const built = P.rebuild(shape, ic, shape.seed);
    let s = 0;
    for (const t of targets) {
      const d = v3.sub(built.P[t.i], t.p);
      s += v3.dot(d, d);
    }
    return Math.sqrt(s / targets.length);
  };

  /* Coordinate descent: each dihedral in turn, a coarse scan of the whole
     circle then a bisection refine. Eight variables and a cheap objective,
     so there is no reason to be clever — and a full scan cannot be trapped
     by the local minimum a gradient step would walk into. */
  const free = known.map((k, i) => (!k.dih && !k.omega) ? i : -1).filter(i => i >= 0);
  let best = cost();
  for (let sweep = 0; sweep < o.sweeps; sweep++) {
    const before = best;
    for (const k of free) {
      const keep = ic[k].dih;
      let bestAng = keep;
      for (let a = -180; a < 180; a += o.coarse) {
        ic[k].dih = a;
        const c = cost();
        if (c < best) { best = c; bestAng = a; }
      }
      let step = o.coarse / 2;
      while (step > 0.05) {
        for (const s of [bestAng - step, bestAng + step]) {
          ic[k].dih = s;
          const c = cost();
          if (c < best) { best = c; bestAng = s; }
        }
        step /= 2;
      }
      ic[k].dih = bestAng;
    }
    if (before - best < o.tol) break;
  }

  const built = P.rebuild(shape, ic, shape.seed);

  /* Hand back a residue list in the same shape parse() produces, so the
     caller cannot tell a bridged structure from a deposited one by its
     type — only by the report, and by the page saying which residues
     these are. */
  const out = built.residues.map(r => ({
    num: r.num, name: byNum.has(r.num) ? byNum.get(r.num).name : 'UNK',
    atoms: r.atoms, bridged: gap.has(r.num),
  }));
  return { residues: out, rmsd: best, free: free.length };
}

module.exports = { bridge };
