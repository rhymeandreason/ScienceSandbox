#!/usr/bin/env node
/* =====================================================================
 *  check-sickle.js — the assertions behind sickle.json and SickleLib.
 *
 *  Run:  node sickle/tools/check-sickle.js        (offline, ~2 s)
 *
 * ---------------------------------------------------------------------
 *
 *  WHAT IS ACTUALLY AT RISK HERE, in the order it would hurt:
 *
 *  1. THE DOCKED POSE. It is a composition of two Kabsch fits, and a
 *     composition is exactly the kind of thing that can come out looking
 *     plausible and be wrong — mirrored, or inverted, or built from the
 *     wrong pair of chains. A mirrored tetramer is invisible in a
 *     screenshot and is the failure MolecularGeometry.md 1.3 exists for.
 *
 *  2. THE SCORE'S DENOMINATOR. score() is expressed as a fraction OF the
 *     deposited pose, so that pose has to be where the score peaks. If it
 *     is not, then "100%" names something that is not the contact — and
 *     anything reading SickleLib is measuring against the wrong target.
 *
 *  3. THE MUTATION. The claim is that the backbone does not move. If a
 *     graft ever shifted N/CA/C, the data would carry exactly the
 *     misfolding story sickle cell is not.
 *
 *  It re-bakes and compares, so a hand-edited sickle.json fails.
 * ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

require('../../residues.js');                      // sets global.ResidueLib
const SickleLib = require('../sickle.js');
const B = require('./bake-sickle.js');

const DATA = path.join(__dirname, '..', 'data', 'sickle.json');

let fails = 0, ran = 0;
const ok = (cond, msg) => {
  ran++;
  if (cond) return;
  fails++;
  console.log(`  FAIL  ${msg}`);
};
const near = (a, b, tol, msg) => ok(Math.abs(a - b) <= tol,
  `${msg} — got ${a}, expected ${b} +-${tol}`);

const D = JSON.parse(fs.readFileSync(DATA, 'utf8'));

/* ------------------------------------------------------------- 1. staleness */
{
  const fresh = B.bake();
  ok(JSON.stringify(fresh) === JSON.stringify(D),
    'sickle.json is stale — re-run node sickle/tools/bake-sickle.js');
}

/* ------------------------------------------------------- 2. the docked pose */
{
  const R = D.dock.R;
  const det = B.det(R);
  near(det, 1, 1e-6, 'docking rotation determinant (a -1 MIRRORS the tetramer)');

  /* Orthonormal: rows of a rotation are unit and mutually perpendicular.
     A composition of two fits drifts here before it drifts anywhere visible. */
  for (let i = 0; i < 3; i++) {
    near(Math.hypot(...R[i]), 1, 1e-5, `docking rotation row ${i} is a unit vector`);
    for (let j = i + 1; j < 3; j++)
      near(R[i][0] * R[j][0] + R[i][1] * R[j][1] + R[i][2] * R[j][2], 0, 1e-5,
        `docking rotation rows ${i},${j} are perpendicular`);
  }

  /* The superpositions are onto the SAME molecule bar one residue, so a
     loose fit means the chain correspondence is wrong, not that HbS differs
     from HbA. Anything above about 1 A is not a fit, it is a coincidence. */
  ok(D.dock.rmsd.acceptor < 1.0, `acceptor superposition RMSD ${D.dock.rmsd.acceptor} A`);
  ok(D.dock.rmsd.donor < 1.0, `donor superposition RMSD ${D.dock.rmsd.donor} A`);

  /* And the contact itself: beta6 has to land IN the pocket. */
  ok(D.dock.reach < 8, `docked beta6 is ${D.dock.reach} A from the pocket centre`);
  ok(D.pocketResidues.join() === '85,88', 'the pocket is Phe85 + Leu88');
  ok(D.pocket[D.dock.acceptorBeta].map(r => r.name).join() === 'PHE,LEU',
    'the pocket residues really are phenylalanine and leucine');
}

/* --------------------------------------- 3. the deposited pose is the answer */
{
  const dch = D.dock.donorBeta;
  const atomsFor = type => SickleLib.mutate(
    D.iface.donor, dch, type, D.beta6[dch], ResidueLib.graft);
  const at = (type, R, t) => SickleLib.score(atomsFor(type), D.iface.acceptor, R, t).raw;

  const base = at('VAL', D.dock.R, D.dock.t);
  ok(base > 0, `the deposited pose scores ${base.toFixed(1)} — it must be positive`);

  /* THE CENTRAL CLAIM. Search rotations and translations around the crystal
     pose; nothing should beat it by more than TOL. It is not zero, and
     pretending it could be would be the dishonest version of this check: the
     score is a coarse function and the two structures were measured at
     different resolutions, so the true optimum sits a whisker off. What must
     not happen is some OTHER pose winning outright. */
  const TOL = 0.03;                       // 3%
  const rot = (ax, th) => {
    const c = Math.cos(th), s = Math.sin(th);
    return ax === 0 ? [[1, 0, 0], [0, c, -s], [0, s, c]]
      : ax === 1 ? [[c, 0, s], [0, 1, 0], [-s, 0, c]]
        : [[c, -s, 0], [s, c, 0], [0, 0, 1]];
  };
  const mm = (A, C) => A.map(r => [0, 1, 2].map(j =>
    r[0] * C[0][j] + r[1] * C[1][j] + r[2] * C[2][j]));

  let best = base, where = 'the deposited pose';
  for (const ax of [0, 1, 2])
    for (const th of [-.4, -.3, -.2, -.1, -.05, -.02, .02, .05, .1, .2, .3, .4]) {
      const v = at('VAL', mm(rot(ax, th), D.dock.R), D.dock.t);
      if (v > best) { best = v; where = `rotation ${th} about axis ${ax}`; }
    }
  for (const k of [0, 1, 2])
    for (const dv of [-10, -8, -6, -4, -3, -2, -1, -.5, -.25, .25, .5, 1, 2, 3, 4, 6, 8, 10]) {
      const t2 = D.dock.t.slice(); t2[k] += dv;
      const v = at('VAL', D.dock.R, t2);
      if (v > best) { best = v; where = `${dv} A along axis ${k}`; }
    }
  ok(best <= base * (1 + TOL),
    `${where} beats the crystal pose by ${((best / base - 1) * 100).toFixed(1)}% ` +
    `(tolerance ${TOL * 100}%) — the deposited pose is not the score's maximum`);

  /* THE LESSON, AS A NUMBER. Same pose, same backbone, one side chain: the
     sickle state must stick markedly better than the normal one. If this ever
     came out close, the data would be asserting a difference the score
     cannot actually measure. */
  const glu = at('GLU', D.dock.R, D.dock.t);
  ok(base > glu * 1.4,
    `valine scores ${base.toFixed(1)} and glutamate ${glu.toFixed(1)} at the same ` +
    `pose — the mutation must make a large difference, not a marginal one`);
}

/* ------------------------------------------------------- 4. the mutation */
{
  const dch = D.dock.donorBeta;
  const f = D.beta6[dch];
  ok(f.deposited === 'GLU', `beta6 in 2HHB is ${f.deposited} — normal haemoglobin`);

  const val = ResidueLib.graft('VAL', f.N, f.CA, f.C);
  const glu = ResidueLib.graft('GLU', f.N, f.CA, f.C);
  ok(val.map(a => a.name).join() === 'CB,CG1,CG2', 'valine grafts CB + two methyls');
  ok(glu.map(a => a.name).join() === 'CB,CG,CD,OE1,OE2', 'glutamate grafts through OE2');

  /* VALINE IS SMALLER. The page must never grow a bump on the toggle: that
     is the misfolding story it exists to contradict. Measured as the furthest
     side-chain atom from CA. */
  const reach = side => Math.max(...side.map(a =>
    Math.hypot(a.p[0] - f.CA[0], a.p[1] - f.CA[1], a.p[2] - f.CA[2])));
  ok(reach(val) < reach(glu),
    `valine reaches ${reach(val).toFixed(2)} A from CA and glutamate ` +
    `${reach(glu).toFixed(2)} — valine is the SMALLER residue`);

  /* Both states share the backbone exactly — the graft may not move it. */
  const bb = SickleLib.mutate(D.iface.donor, dch, 'VAL', f, ResidueLib.graft)
    .filter(a => a.res === 6 && a.ch === dch && ['N', 'CA', 'C', 'O'].includes(a.atom));
  ok(bb.length === 4, `residue 6 keeps all four backbone atoms (got ${bb.length})`);
  const dep = D.iface.donor.filter(a =>
    a.res === 6 && a.ch === dch && ['N', 'CA', 'C', 'O'].includes(a.atom));
  for (const a of bb) {
    const d0 = dep.find(x => x.atom === a.atom);
    ok(d0 && a.p.every((v, k) => v === d0.p[k]),
      `residue 6 ${a.atom} is untouched by the graft`);
  }

  /* Kyte-Doolittle, and the swing the whole lesson rests on. */
  near(SickleLib.hydro('GLU'), -3.5, 1e-9, 'Kyte-Doolittle for glutamate');
  near(SickleLib.hydro('VAL'), 4.2, 1e-9, 'Kyte-Doolittle for valine');
  ok(SickleLib.colour('VAL') !== SickleLib.colour('GLU'),
    'the two states are different colours');
}

/* --------------------------------------------------- 5. surface and exposure */
{
  const all = [];
  for (const c of Object.values(D.chains)) for (const r of c.res) all.push(r);
  ok(all.length === 574, `the tetramer is 574 residues (got ${all.length})`);
  ok(all.every(r => r.rel >= 0 && r.rel <= 1), 'every exposure ratio is in 0..1');

  /* Relative SASA above which a residue counts as facing water. It used
     to be lifted out of sickle-lab.html's source so the page and the
     checker could not drift; with the page gone this checker OWNS the
     number, and a page that adopts one again must read it from here or
     have this read it from there. Two independent 0.25s is the failure
     that lifting it existed to prevent.

     0.25 is the usual cutoff and nothing below depends on it finely —
     the polar-vs-greasy claims hold across 0.15 to 0.40, which is what
     makes them claims about the protein rather than about the cutoff. */
  const EXPOSED = 0.25;

  const exp = all.filter(r => r.rel >= EXPOSED);
  const greasy = exp.filter(r => SickleLib.hydro(r.name) > 0);

  /* THE CLAIM THE COLOURING MAKES: a folded protein shows water a mostly
     polar face and buries its greasy residues. If this ever inverted, the
     page would be teaching the opposite of the truth while looking fine. */
  ok(greasy.length < exp.length / 2,
    `${greasy.length} of ${exp.length} exposed residues are greasy — the surface ` +
    `must be mostly polar`);
  const buriedGreasy = all.filter(r => r.rel < EXPOSED && SickleLib.hydro(r.name) > 0);
  ok(buriedGreasy.length > greasy.length,
    `${buriedGreasy.length} greasy residues buried vs ${greasy.length} exposed — ` +
    `the hydrophobic core must be the bigger population`);

  /* beta6 is a SURFACE residue. If it were buried, no amount of mutation
     would matter and the lesson would be false. */
  for (const id of ['B', 'D']) {
    const r6 = D.chains[id].res.find(r => r.num === 6);
    ok(r6.rel >= EXPOSED, `chain ${id} residue 6 is on the surface (rel ${r6.rel})`);
  }
}

/* --------------------------------------------------------- 6. buried area */
{
  ok(D.dock.buriedNonpolar > 100 && D.dock.buriedNonpolar < 5000,
    `buried nonpolar area ${D.dock.buriedNonpolar} A^2 is not a plausible interface`);

  /* The SASA machinery itself, against the one case with a closed form: an
     isolated sphere is 4*pi*r^2. If this drifts, the angstroms in the panel
     are decoration. */
  const lone = B.sasaNonpolar([{ p: [0, 0, 0], r: 1.70, nonpolar: true }]);
  near(lone, 4 * Math.PI * (1.70 + B.PROBE) ** 2, 0.6, 'SASA of one carbon');

  /* Two carbons at a bond length: the analytic two-sphere lens. */
  const two = B.sasaNonpolar([{ p: [0, 0, 0], r: 1.7, nonpolar: true },
  { p: [1.54, 0, 0], r: 1.7, nonpolar: true }]);
  const Rp = 1.7 + B.PROBE, h = Rp - 1.54 / 2;
  near(two, 2 * (4 * Math.PI * Rp * Rp - 2 * Math.PI * Rp * h), 1.5,
    'SASA of two bonded carbons vs the analytic lens');
}

/* ------------------------------- 7. the patch and the pocket are apart */
/*  THE PATCH AND THE POCKET ARE NOT NEIGHBOURS. Both sit on one
    molecule, which invites exactly one wrong reading: that this valine
    goes into that pocket. It does not — it goes into the equivalent
    pocket on the NEXT tetramer, and this pocket takes a valine from a
    third. Within one molecule they are ~25 A apart and never touch.

    This survived the page's deletion because it is a fact about the
    STRUCTURE, not about any drawing of it: it is what makes "the
    contact is between molecules" a measured statement, and any future
    page that draws both marks on one tetramer inherits the same trap.
    An early draft called the pocket "a few residues away", which was
    wrong twice over: 79 apart in sequence, 25 A apart in space. */
{
  const pc = D.pocket.B.flatMap(r => r.atoms);
  const c = [0, 1, 2].map(k => pc.reduce((s, a) => s + a.p[k], 0) / pc.length);
  const apart = Math.hypot(...c.map((v, k) => v - D.beta6.B.CA[k]));
  ok(apart > 15,
    `beta6 and its own molecule's pocket are ${apart.toFixed(1)} A apart — if ` +
    `this ever became small, the "different molecule" claim breaks`);
  ok(apart > D.dock.reach * 3,
    `the within-molecule gap (${apart.toFixed(1)} A) must dwarf the across-contact ` +
    `distance (${D.dock.reach} A) — that contrast is the lesson`);
}

console.log(fails
  ? `\ncheck-sickle: ${fails} FAILED of ${ran}`
  : `check-sickle: ${ran} assertions passed`);
process.exit(fails ? 1 : 0);
