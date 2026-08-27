/* =====================================================================
 *  prion.js — the helix-to-sheet morph for the prion page.
 *
 *  Page-specific by design (CLAUDE.md, "share the plumbing, not the
 *  physics"). folding/folding.js folds an extended chain toward ONE
 *  deposited target by relaxation; this file does something else — it
 *  carries a chain between TWO deposited structures of the same sequence.
 *  Neither is a special case of the other, and merging them would give a
 *  module whose header has to explain which half applies.
 *
 *  Real angstroms throughout. Renders nothing, knows about no viewer, so
 *  every number here is checkable in Node.
 *
 * ---------------------------------------------------------------------
 *  WHAT THE ANIMATION CLAIMS, AND WHAT IT DOES NOT
 * ---------------------------------------------------------------------
 *  CLAIMED. Residues 170-228 of human PrP are one sequence (prep.js
 *  asserts that residue by residue across the two files) and they hold two
 *  different shapes: three helices in 1QLZ, four beta strands in 6LNI. The
 *  covalent chain is the same chain in both, and the Cys179-Cys214
 *  disulfide is present in both. Every one of those is read from deposited
 *  records or deposited coordinates.
 *
 *  NOT CLAIMED: THE PATH. Real conversion is templated — it needs a seed,
 *  it happens on the surface of an existing fibril, and the intermediates
 *  have never been imaged. A lone molecule smoothly rearranging is not
 *  what happens, and the page must say so where a student can read it.
 *  What this file offers instead is a legitimate weaker statement: the two
 *  shapes are reachable from each other WITHOUT BREAKING ANYTHING, and
 *  that is a fact about the chain rather than a guess about the mechanism.
 *
 *  WHICH IS WHY THE MORPH IS IN INTERNAL COORDINATES AND NOT IN SPACE.
 *  Interpolating Cartesian positions is the obvious implementation and it
 *  destroys the claim: atoms take straight-line shortcuts through each
 *  other, bonds stretch to whatever length the midpoint needs, and the
 *  in-between frames are not conformations of a polypeptide at all. A
 *  student watching one learns that a protein can pass through itself.
 *
 *  So every atom is placed by NeRF from a bond length, a bond angle and a
 *  dihedral, and it is those three that interpolate. A bond that is 1.33 A
 *  at both ends is 1.33 A throughout, because it is never a position being
 *  averaged — it is a length being carried. Bond lengths and angles are
 *  MEASURED from each structure rather than idealised, which costs nothing
 *  (they differ by hundredths) and buys an exact property: at t=0 the
 *  rebuild reproduces 1QLZ and at t=1 it reproduces 6LNI, to float
 *  precision. check-prion.js asserts both, and asserts that no bond
 *  changes length by more than 0.02 A anywhere in between.
 *
 *  The path is still not physical. It is monotonic, it has no thermal
 *  motion, and it does not avoid steric clash — clash is REPORTED by
 *  clashes() rather than fixed, so the bench can show where the honest
 *  gaps are instead of hiding them under a relaxation nobody checks.
 *
 *  1QLZ IS AN NMR ENSEMBLE and this uses model 1 (prep.js). 6LNI IS A
 *  RECOMBINANT FIBRIL, not brain-derived PrP-Sc; the ex vivo RML and GSS
 *  structures have different folds. The page shows one amyloid form of
 *  this sequence, not the infectious agent.
 * ===================================================================== */
'use strict';

const PrionLib = (function () {

  const v3 = {
    sub: (a, b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]],
    add: (a, b) => [a[0]+b[0], a[1]+b[1], a[2]+b[2]],
    mul: (a, s) => [a[0]*s, a[1]*s, a[2]*s],
    dot: (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2],
    cross: (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]],
    len: a => Math.hypot(a[0], a[1], a[2]),
    norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0]/l, a[1]/l, a[2]/l]; },
    dist: (a, b) => Math.hypot(a[0]-b[0], a[1]-b[1], a[2]-b[2]),
  };

  const DEG = 180 / Math.PI;

  /* ---------------- 1. read a trimmed structure ---------------- */

  /* parse(pdbText) -> { residues, helices, sheets }
       residues [{ num, name, atoms:{ N, CA, C, O, CB, SG, ... } }] sorted
       helices  [[lo, hi]] from HELIX records
       sheets   [[lo, hi]] from SHEET records, this chain's own strands only

     prep.js has already reduced the file to one chain over one residue
     range, so there is no chain column to honour here. Side-chain atoms
     are kept — the Cys sulfurs are the disulfide, and the disulfide is
     the thing that has to survive the morph. */
  function parse(pdbText) {
    const byRes = new Map();
    const helices = [], sheets = [];

    for (const line of pdbText.split('\n')) {
      if (line.startsWith('HELIX')) {
        helices.push([parseInt(line.slice(21, 25), 10), parseInt(line.slice(33, 37), 10)]);
        continue;
      }
      if (line.startsWith('SHEET')) {
        /* Columns 23-26 start / 34-37 end. A SHEET record in a fibril file
           names one strand of one rung; the neighbours it lists are the
           SAME strand on the chain above, which is act 4's subject and not
           a second strand of this one. Deduped below. */
        sheets.push([parseInt(line.slice(22, 26), 10), parseInt(line.slice(33, 37), 10)]);
        continue;
      }
      if (!line.startsWith('ATOM')) continue;
      const alt = line[16];
      if (alt !== ' ' && alt !== 'A') continue;
      const num = parseInt(line.slice(22, 26), 10);
      const name = line.slice(12, 16).trim();
      const pos = [+line.slice(30, 38), +line.slice(38, 46), +line.slice(46, 54)];
      if (!pos.every(Number.isFinite)) continue;
      if (!byRes.has(num)) byRes.set(num, { num, name: line.slice(17, 20).trim(), atoms: {} });
      byRes.get(num).atoms[name] = pos;
    }

    const residues = [...byRes.values()].sort((a, b) => a.num - b.num);
    return { residues, helices: dedupe(helices), sheets: dedupe(sheets) };
  }

  function dedupe(ranges) {
    const seen = new Set(), out = [];
    for (const r of ranges) {
      const k = r[0] + ':' + r[1];
      if (seen.has(k)) continue;
      seen.add(k); out.push(r);
    }
    return out.sort((a, b) => a[0] - b[0]);
  }

  /* ss(n, first, ranges, code) — one letter per residue, 'C' elsewhere.
     Same shape as RibbonLib.assign, deliberately: the bench feeds one of
     these straight to the ribbon, and two conventions for the same array
     is how a helix ends up drawn where the records do not put one. */
  function ss(n, first, ranges, code) {
    const out = new Array(n).fill('C');
    for (const [lo, hi] of ranges)
      for (let r = lo; r <= hi; r++) {
        const i = r - first;
        if (i >= 0 && i < n) out[i] = code;
      }
    return out;
  }

  /* ---------------- 2. the chain as internal coordinates ---------------- */

  /* The backbone atom order the morph walks. O and H hang off the chain
     rather than continuing it, so they are placed from their residue's own
     N-CA-C and never become somebody's parent. */
  const TRACE = ['N', 'CA', 'C'];

  function dihedral(a, b, c, d) {
    const b1 = v3.sub(b, a), b2 = v3.sub(c, b), b3 = v3.sub(d, c);
    const n1 = v3.cross(b1, b2), n2 = v3.cross(b2, b3);
    const m = v3.cross(n1, v3.norm(b2));
    return Math.atan2(v3.dot(m, n2), v3.dot(n1, n2)) * DEG;
  }

  function angle(a, b, c) {
    const u = v3.norm(v3.sub(a, b)), w = v3.norm(v3.sub(c, b));
    return Math.acos(Math.max(-1, Math.min(1, v3.dot(u, w)))) * DEG;
  }

  /* internals(residues) -> { atoms, ic, sidechains }
       atoms  [{ res, name }] the N-CA-C trace, in chain order
       ic     [{ len, ang, dih }] parallel to atoms; the first three
              entries are the seed and carry only what they can measure
       sidechains  per residue, every non-trace atom in the LOCAL frame of
              its own N-CA-C. A side chain is carried rigidly, so its
              internal shape is whatever the structure said it was — this
              file changes backbone conformation and nothing else.

     MEASURED, NOT IDEALISED. See the header: this is what makes t=0 and
     t=1 exact rather than approximate. */
  function internals(residues) {
    const atoms = [], P = [];
    for (const r of residues)
      for (const nm of TRACE) {
        if (r.atoms[nm] == null) throw new Error(`residue ${r.num} is missing ${nm}`);
        atoms.push({ res: r.num, name: nm });
        P.push(r.atoms[nm]);
      }

    const ic = P.map((p, i) => ({
      len: i >= 1 ? v3.dist(P[i - 1], p) : 0,
      ang: i >= 2 ? angle(P[i - 2], P[i - 1], p) : 0,
      dih: i >= 3 ? dihedral(P[i - 3], P[i - 2], P[i - 1], p) : 0,
    }));

    return { atoms, ic, sidechains: residues.map(sideInternals),
             seed: [P[0], P[1], P[2]] };
  }

  /* sideInternals(residue) -> [{ name, p, g, gg, len, ang, dih }]
     A side chain as internal coordinates against its own backbone, in an
     order where every atom's three parents are already placed.

     WHY NOT RIGID. Carrying a side chain rigidly on its N-CA-C frame is
     what folding/folding.js does, and there it is right: nothing in that
     lesson asks a side chain to change shape, and the three phenylalanines
     it draws genuinely do not. Here one side chain does the opposite of
     nothing. Cys179 and Cys214 hold a disulfide in BOTH structures, and
     the two sulfurs are 2.02 A apart in 1QLZ and 2.03 A in 6LNI while the
     backbone between them rearranges completely. Rigid side chains make
     that bond end the morph 5.9 A long — the page's central image, the one
     bond that survives, drawn snapping open.

     So chi rotates like phi and psi do, and for the same reason: an angle
     is the thing that changes, a bond length is the thing that must not.

     Bonds are inferred by distance, safe on a deposited structure and the
     same shortcut folding.js takes, which avoids a topology table for
     twenty residue types to serve what is really one bond. */
  function sideInternals(r) {
    const A = r.atoms;
    const placed = ['N', 'CA', 'C'];
    const parent = { CA: ['N', 'C'], N: [], C: [] };
    const side = Object.keys(A).filter(nm => !TRACE.includes(nm) && nm !== 'OXT');

    /* BFS out from CA, so a parent is always placed before its child. */
    const order = [], p = {};
    let frontier = ['CA'];
    const seen = new Set(['N', 'CA', 'C']);
    while (frontier.length) {
      const next = [];
      for (const from of frontier)
        for (const nm of side) {
          if (seen.has(nm)) continue;
          if (v3.dist(A[from], A[nm]) > 1.95) continue;
          seen.add(nm); p[nm] = from; order.push(nm); next.push(nm);
        }
      frontier = next;
    }

    /* An atom BFS never reached is bonded to nothing within 1.95 A — a
       modelled water, an ion, or a genuinely broken residue. Dropping it
       is better than placing it from a parent it does not have. */
    return order.map(nm => {
      const g = p[nm] === 'CA' ? 'N' : p[p[nm]];
      const gg = g === 'N' ? 'C' : (p[g] === 'CA' ? 'N' : p[g]) || 'C';
      return {
        name: nm, p: p[nm], g, gg,
        len: v3.dist(A[p[nm]], A[nm]),
        ang: angle(A[g], A[p[nm]], A[nm]),
        dih: dihedral(A[gg], A[g], A[p[nm]], A[nm]),
      };
    });
  }

  function frameOf(N, CA, C) {
    const e1 = v3.norm(v3.sub(C, N));
    let e2 = v3.sub(CA, N);
    e2 = v3.norm(v3.sub(e2, v3.mul(e1, v3.dot(e2, e1))));
    return { o: CA, e1, e2, e3: v3.cross(e1, e2) };
  }
  const toLocal = (F, p) => {
    const d = v3.sub(p, F.o);
    return [v3.dot(d, F.e1), v3.dot(d, F.e2), v3.dot(d, F.e3)];
  };
  const toWorld = (F, l) => v3.add(F.o,
    v3.add(v3.mul(F.e1, l[0]), v3.add(v3.mul(F.e2, l[1]), v3.mul(F.e3, l[2]))));

  /* place(A, B, C, len, ang, dih) — NeRF: put D at a given bond length
     from C, angle B-C-D, dihedral A-B-C-D.

     THE DIHEDRAL HERE IS IUPAC, AND folding/folding.js's `place` IS NOT.
     The two constructions are otherwise identical, but that file's frame
     is built left-handed, so feeding it a measured dihedral places the
     atom in the mirror position — 0.41 A out on a peptide bond, growing
     without limit along a chain because each error is the next atom's
     parent. It went unnoticed there because nothing ever measures a
     dihedral to feed back in: the extended state is built from CONSTANTS
     and then relaxed toward deposited coordinates, so a sign error in the
     start state is something the solver quietly folds away.

     This file cannot do that. It measures internal coordinates off one
     structure and rebuilds them, so the round trip has to be exact or
     every frame is a mirrored protein. Hence the negation, and hence
     check-prion.js asserting the round trip closes to 1e-9. */
  function place(A, B, C, len, angDeg, dihDeg) {
    const ang = angDeg / DEG, dih = -dihDeg / DEG;
    const bc = v3.norm(v3.sub(C, B));
    let n = v3.cross(v3.sub(B, A), bc);
    if (v3.len(n) < 1e-6) n = v3.cross(bc, [bc[0] + 1, bc[1], bc[2]]);
    n = v3.norm(n);
    const m = v3.cross(n, bc);
    const d = [-len * Math.cos(ang), len * Math.sin(ang) * Math.cos(dih),
                len * Math.sin(ang) * Math.sin(dih)];
    return [
      C[0] + d[0]*bc[0] + d[1]*m[0] + d[2]*n[0],
      C[1] + d[0]*bc[1] + d[1]*m[1] + d[2]*n[1],
      C[2] + d[0]*bc[2] + d[1]*m[2] + d[2]*n[2],
    ];
  }

  /* rebuild(shape, ic, seed) -> { P, residues }
     P is parallel to shape.atoms; residues carries the side chains back
     out on their new frames, so a caller can draw the disulfide. */
  function rebuild(shape, ic, seed) {
    const P = new Array(shape.atoms.length);
    P[0] = seed[0].slice(); P[1] = seed[1].slice(); P[2] = seed[2].slice();
    for (let i = 3; i < P.length; i++)
      P[i] = place(P[i - 3], P[i - 2], P[i - 1], ic[i].len, ic[i].ang, ic[i].dih);

    const residues = [];
    for (let k = 0; k * 3 < P.length; k++) {
      const N = P[k*3], CA = P[k*3 + 1], C = P[k*3 + 2];
      const atoms = { N, CA, C };
      for (const s of shape.sidechains[k]) {
        const gg = atoms[s.gg], g = atoms[s.g], pa = atoms[s.p];
        if (!gg || !g || !pa) continue;
        atoms[s.name] = place(gg, g, pa, s.len, s.ang, s.dih);
      }
      residues.push({ num: shape.atoms[k*3].res, atoms });
    }
    return { P, residues };
  }

  /* ---------------- 3. the morph ---------------- */

  /* Shortest angular path. Interpolating -179 to 179 the long way spins a
     residue almost all the way round and reads on screen as a snap; the
     two angles are two degrees apart and the chain should move two
     degrees. */
  function lerpAngle(a, b, t) {
    let d = (b - a) % 360;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return a + d * t;
  }

  const smoothstep = t => t * t * (3 - 2 * t);

  /* morph(native, fibril, opts) -> { frames, ts, at(t), shape, meta }
     `native` and `fibril` are parse() results over the SAME residues —
     asserted, because a silent off-by-one would interpolate residue 171's
     conformation onto residue 170 and every frame would still look like a
     protein. */
  function morph(native, fibril, opts) {
    const o = Object.assign({ frames: 120, ease: true, hold: true }, opts || {});

    const a = native.residues, b = fibril.residues;
    if (a.length !== b.length)
      throw new Error(`residue counts differ: ${a.length} vs ${b.length}`);
    a.forEach((r, i) => {
      if (r.num !== b[i].num)
        throw new Error(`residue ${i} is ${r.num} in native, ${b[i].num} in fibril`);
    });

    const A = internals(a), B = internals(b);

    /* The disulfide's direction at each end, for the closure target. Read
       off the deposited sulfurs, so a structure that does not model them
       simply turns the constraint off rather than aiming at a guess. */
    const sgDir = R => {
      const x = R.find(r => r.num === 179), y = R.find(r => r.num === 214);
      return (x && y && x.atoms.SG && y.atoms.SG)
        ? v3.norm(v3.sub(y.atoms.SG, x.atoms.SG)) : null;
    };
    const ssDir = { a: sgDir(a), b: sgDir(b) };

    /* THE TARGET LENGTH IS THE DEPOSITED ONE, INTERPOLATED — not a
       textbook 2.05 A. 1QLZ models this bond at 2.016 A and 6LNI at 2.030,
       and aiming at any third number means the constraint is unsatisfied
       at BOTH ends: CCD then "corrects" the endpoint frames toward a
       length neither structure has, and t=0 stops being 1QLZ. It cost 0.04
       A at the native end and 2.5 A at the fibril end before this line
       existed, which is a morph that no longer arrives. */
    const sgLen = R => {
      const x = R.find(r => r.num === 179), y = R.find(r => r.num === 214);
      return (x && y && x.atoms.SG && y.atoms.SG) ? v3.dist(x.atoms.SG, y.atoms.SG) : null;
    };
    const ssLen = { a: sgLen(a), b: sgLen(b) };
    if (!ssDir.a || !ssDir.b || !ssLen.a) o.hold = false;

    /* The seed. The rebuild grows outward from three atoms, so where those
       three sit decides where the whole chain sits — interpolating the
       seed as raw positions would translate and rotate the molecule across
       the stage while it folded, which is motion the student would read as
       part of the mechanism. It is held at the native's first residue
       instead, so the N-terminus stays put and everything downstream moves
       relative to it. The page is free to re-frame the camera; that is a
       viewing decision and it does not belong in the trajectory. */
    const seed = A.seed;

    const ic = A.ic.map(x => ({ len: x.len, ang: x.ang, dih: x.dih }));

    /* The mutable shape at() writes into, and the fibril's side chains
       matched to it by name. A side chain's BFS order is a property of the
       structure, so the two files can list the same atoms in a different
       order; matching by index would rotate one atom's chi onto another's
       and the residue would come apart while every bond length stayed
       right. */
    const shape = {
      atoms: A.atoms,
      sidechains: A.sidechains.map(list => list.map(x => Object.assign({}, x))),
    };
    const pairs = A.sidechains.map((list, k) => {
      const by = new Map(B.sidechains[k].map(x => [x.name, x]));
      return list.map(x => by.get(x.name) || null);
    });

    const at = t => {
      const u = o.ease ? smoothstep(Math.max(0, Math.min(1, t))) : t;
      for (let i = 0; i < ic.length; i++) {
        ic[i].len = A.ic[i].len + (B.ic[i].len - A.ic[i].len) * u;
        ic[i].ang = lerpAngle(A.ic[i].ang, B.ic[i].ang, u);
        ic[i].dih = lerpAngle(A.ic[i].dih, B.ic[i].dih, u);
      }
      /* Side chains interpolate on the same terms as the backbone.
         `pairs` matched them up once, by name, so an atom modelled in only
         one of the two files is not here to be interpolated toward
         nothing. */
      for (let k = 0; k < shape.sidechains.length; k++) {
        const dst = shape.sidechains[k], src = pairs[k];
        for (let j = 0; j < dst.length; j++) {
          const q = src[j];
          if (!q) continue;
          dst[j].len = A.sidechains[k][j].len + (q.len - A.sidechains[k][j].len) * u;
          dst[j].ang = lerpAngle(A.sidechains[k][j].ang, q.ang, u);
          dst[j].dih = lerpAngle(A.sidechains[k][j].dih, q.dih, u);
        }
      }
      if (!o.hold) return rebuild(shape, ic, seed);

      /* The S-S direction is interpolated too, so the closed bond points
         the way 6LNI points it rather than wherever the loop happened to
         leave it. See ccd()'s "the target is a point, not a distance". */
      const dir = [0, 1, 2].map(i => ssDir.a[i] + (ssDir.b[i] - ssDir.a[i]) * u);
      const length = ssLen.a + (ssLen.b - ssLen.a) * u;
      return ccd(shape, ic, seed,
                 Object.assign({ dir, length }, o.hold === true ? {} : o.hold));
    };

    const ts = [];
    for (let k = 0; k < o.frames; k++) ts.push(k / (o.frames - 1));

    return {
      at, ts, frames: o.frames, shape: A,
      first: a[0].num, count: a.length,
      meta: { helices: native.helices, sheets: fibril.sheets },
    };
  }

  /* ---------------- 3b. holding the disulfide shut ---------------- */

  /* THE PROBLEM THIS SOLVES. Interpolating every torsion independently is
     the honest starting point — it keeps every bond length and moves only
     the things that can move — and it opens the Cys179-Cys214 disulfide to
     25 A halfway through. Both endpoints model that bond at 2.0 A, so the
     morph is drawing a covalent bond breaking and re-forming, which is a
     claim about the chemistry that neither deposition supports and that
     the page would be making by accident.
     
     A disulfide is a real constraint, so enforcing it makes the path MORE
     physical rather than less. That is the whole justification: this is not
     smoothing the animation, it is removing a mechanism the interpolation
     invented.

     CCD (cyclic coordinate descent) is the standard loop-closure method —
     take each rotatable torsion in turn, and rotate it by the angle that
     best moves the end point toward its target. It converges fast, it
     needs no derivatives, and it is naturally minimal: every pass makes the
     smallest change to one torsion that helps, so the closed path stays
     close to the interpolated one instead of finding some unrelated
     conformation that happens to satisfy the bond.

     ONLY THE TORSIONS BETWEEN THE TWO CYSTEINES MOVE. Residues 180-213 sit
     between 179 and 214 on the chain, so rotating them changes where SG214
     is RELATIVE TO SG179 — which is the distance being fixed. Rotating
     anything outside that span swings both sulfurs together and cannot
     close the gap; it would only drag the rest of the protein around to no
     purpose. The helices outside the loop keep exactly the conformation the
     interpolation gave them.

     THE TARGET IS A POINT, NOT A DISTANCE. Aiming at "2.05 A from SG179 in
     whatever direction it currently lies" is degenerate — the target moves
     with the thing chasing it. So the S-S direction is interpolated between
     the two structures' own, and the target is the point that direction
     picks out. The bond arrives pointing the way 6LNI has it pointing.

     WHAT THIS DOES NOT FIX, AND MUST NOT BE READ AS FIXING. The morph
     still passes the chain through itself in the middle: 72 clashing pairs
     at worst, some as close as 0.2 A, which is two atoms in one place. The
     unconstrained path already did this (43 pairs at t=0.25) — closure did
     not cause it, it concentrated it, because the loop now has less room.

     CCD has no idea sterics exist; it knows one distance. Fixing this
     needs a repulsion term, and that is a relaxation rather than a closure
     — which is what folding/folding.js's Folder already is. Growing a
     second physics solver in this file to avoid reusing that one would be
     the wrong trade. Until then clashes() reports it and the bench shows
     it, so nobody has to take the animation's word for the middle. */

  function ccd(shape, ic, seed, opts) {
    const o = Object.assign({ residues: [179, 214], length: null,
                              passes: 60, tol: 0.01, dir: null,
                              maxStep: 2 }, opts || {});
    if (o.length == null) return rebuild(shape, ic, seed);

    const idx = {};
    shape.atoms.forEach((a, i) => {
      if (a.name === 'CA') idx[a.res] = i;
    });
    const [lo, hi] = o.residues;

    /* The rotatable set: phi and psi of every residue strictly between the
       two cysteines. In the trace's N-CA-C order, residue m's phi is the
       dihedral ending at its own C and its psi is the one ending at the
       next residue's N. omega is left alone — the peptide bond is planar,
       and rotating it is not a conformational change a protein makes. */
    const axes = [];
    for (let i = 0; i < shape.atoms.length; i++) {
      const a = shape.atoms[i];
      if (a.res <= lo || a.res >= hi) continue;
      if (a.name === 'C' || a.name === 'N') axes.push(i);
    }

    const sgOf = (built, res) => {
      const r = built.residues.find(x => x.num === res);
      return r && r.atoms.SG;
    };

    let built = rebuild(shape, ic, seed);
    let A = sgOf(built, lo), B = sgOf(built, hi);
    if (!A || !B) return built;                    // no sulfurs: nothing to hold

    for (let pass = 0; pass < o.passes; pass++) {
      if (Math.abs(v3.dist(A, B) - o.length) < o.tol) break;

      const dir = o.dir ? v3.norm(o.dir) : v3.norm(v3.sub(B, A));
      const T = v3.add(A, v3.mul(dir, o.length));

      for (const k of axes) {
        if (k < 2) continue;
        const O = built.P[k - 2];
        const n = v3.norm(v3.sub(built.P[k - 1], O));

        /* Component of each point perpendicular to the axis. A point on the
           axis cannot be moved by rotating about it, and its perpendicular
           component is zero — skipped rather than normalised into a NaN. */
        const perp = p => {
          const d = v3.sub(p, O);
          return v3.sub(d, v3.mul(n, v3.dot(d, n)));
        };
        const r = perp(B), t = perp(T);
        if (v3.len(r) < 1e-6 || v3.len(t) < 1e-6) continue;

        const ru = v3.norm(r), tu = v3.norm(t);
        const theta = Math.atan2(v3.dot(v3.cross(ru, tu), n),
                                 Math.max(-1, Math.min(1, v3.dot(ru, tu)))) * DEG;

        /* SUBTRACTED, NOT ADDED. theta is measured in the right-handed
           sense about the axis, and place() negates its dihedral to be
           IUPAC (see its header), so the two run opposite ways. Adding
           makes every pass rotate away from the target: the disulfide
           settles around 110 A instead of 2, which is the signature to
           look for if this ever flips back.

           The step is capped because an unbounded CCD pass will happily
           swing one torsion 170 degrees to close the loop — that fixes the
           bond and throws the residue somewhere the interpolation never
           went. Many small passes spread the same correction over more
           torsions, which is both closer to the interpolated path and
           measurably less self-intersecting: 60 passes at 2 degrees peak
           at 72 clashing pairs where 12 at 12 degrees peak at 113. The
           numbers are from a sweep, not from taste. */
        const step = Math.max(-o.maxStep, Math.min(o.maxStep, theta));
        ic[k].dih -= step;

        built = rebuild(shape, ic, seed);
        A = sgOf(built, lo); B = sgOf(built, hi);
      }
    }
    return built;
  }

  /* ---------------- 4. what the bench has to be able to see ---------------- */

  /* ca(built) -> [[x,y,z]] one per residue, ready for RibbonLib. */
  const ca = built => built.residues.map(r => r.atoms.CA);

  /* bondLengths(built) -> [len] every covalent trace bond, in order.
     The morph's own honesty check: these must not move. */
  function bondLengths(built) {
    const out = [];
    for (let i = 1; i < built.P.length; i++) out.push(v3.dist(built.P[i - 1], built.P[i]));
    return out;
  }

  /* disulfide(built, x, y) -> S-S distance, or null if either Cys has no
     SG in the deposited file. 2.05 A is a disulfide; anything past about
     2.5 is a bond the morph has pulled apart, and the bench plots it
     rather than the page asserting it never happens. */
  function disulfide(built, x, y) {
    const rx = built.residues.find(r => r.num === x);
    const ry = built.residues.find(r => r.num === y);
    if (!rx || !ry || !rx.atoms.SG || !ry.atoms.SG) return null;
    return v3.dist(rx.atoms.SG, ry.atoms.SG);
  }

  /* clashes(built, cutoff) -> [{ i, j, d }] non-bonded trace atoms closer
     than cutoff. REPORTED, NOT FIXED — see the header. |i-j| < 3 is
     skipped: those are close because the chain is covalent. */
  function clashes(built, cutoff) {
    const c = cutoff || 2.4, P = built.P, out = [];
    for (let i = 0; i < P.length; i++)
      for (let j = i + 3; j < P.length; j++) {
        const d = v3.dist(P[i], P[j]);
        if (d < c) out.push({ i, j, d });
      }
    return out;
  }

  /* rmsd(built, residues, fit) -> A, against a deposited structure.

     TWO MEASUREMENTS, AND THE DIFFERENCE BETWEEN THEM MATTERS.

     Unfitted is the right test at t=0: the morph holds the native's own
     seed, so the rebuild and the deposited file are already in one frame,
     and a superposition there would hide exactly the drift a student would
     see on screen. It must be 0.

     Fitted is the only honest test at t=1. The trajectory never moves the
     N-terminus, so the chain ARRIVES at the fibril conformation without
     arriving at the fibril's coordinates — 6LNI sits some 380 A away in
     its own map. That distance is bookkeeping, not error, and comparing
     shapes means removing it. `fit` runs Kabsch first. */
  function rmsd(built, residues, fit) {
    const X = [], Y = [];
    built.residues.forEach((r, k) => {
      for (const nm of TRACE) {
        const q = residues[k].atoms[nm];
        if (!q) continue;
        X.push(r.atoms[nm]); Y.push(q);
      }
    });
    const P0 = fit ? kabsch(X, Y) : X;
    let s = 0;
    for (let i = 0; i < P0.length; i++) {
      const d = v3.sub(P0[i], Y[i]);
      s += v3.dot(d, d);
    }
    return Math.sqrt(s / P0.length);
  }

  /* kabsch(X, Y) -> X rotated and translated onto Y. Jacobi eigen-solve on
     the 3x3 covariance rather than a full SVD: at this size the two agree
     to float precision and this needs no linear-algebra dependency, which
     is what keeps every checker in this repo a bare `node <path>`. */
  function kabsch(X, Y) {
    const cx = mean(X), cy = mean(Y);
    const A = X.map(p => v3.sub(p, cx)), B = Y.map(p => v3.sub(p, cy));

    const H = [[0,0,0],[0,0,0],[0,0,0]];
    for (let i = 0; i < A.length; i++)
      for (let a = 0; a < 3; a++)
        for (let b = 0; b < 3; b++) H[a][b] += A[i][a] * B[i][b];

    /* R = (H^T H)^(-1/2) H^T, built from the eigen-decomposition of the
       symmetric H^T H. */
    const S = [[0,0,0],[0,0,0],[0,0,0]];
    for (let a = 0; a < 3; a++)
      for (let b = 0; b < 3; b++)
        for (let c = 0; c < 3; c++) S[a][b] += H[c][a] * H[c][b];

    const { vec, val } = jacobi(S);
    const inv = [[0,0,0],[0,0,0],[0,0,0]];
    for (let a = 0; a < 3; a++)
      for (let b = 0; b < 3; b++)
        for (let k = 0; k < 3; k++)
          inv[a][b] += vec[a][k] * vec[b][k] / Math.sqrt(Math.max(val[k], 1e-12));

    const R = [[0,0,0],[0,0,0],[0,0,0]];
    for (let a = 0; a < 3; a++)
      for (let b = 0; b < 3; b++)
        for (let k = 0; k < 3; k++) R[a][b] += inv[a][k] * H[b][k];

    return A.map(p => v3.add(cy, [
      R[0][0]*p[0] + R[0][1]*p[1] + R[0][2]*p[2],
      R[1][0]*p[0] + R[1][1]*p[1] + R[1][2]*p[2],
      R[2][0]*p[0] + R[2][1]*p[1] + R[2][2]*p[2],
    ]));
  }

  function mean(P) {
    const c = [0, 0, 0];
    for (const p of P) { c[0] += p[0]; c[1] += p[1]; c[2] += p[2]; }
    return v3.mul(c, 1 / P.length);
  }

  /* Cyclic Jacobi on a symmetric 3x3. */
  function jacobi(M) {
    const a = M.map(r => r.slice());
    let v = [[1,0,0],[0,1,0],[0,0,1]];
    for (let sweep = 0; sweep < 60; sweep++) {
      let off = 0;
      for (let p = 0; p < 3; p++) for (let q = p + 1; q < 3; q++) off += a[p][q] * a[p][q];
      if (off < 1e-20) break;
      for (let p = 0; p < 3; p++)
        for (let q = p + 1; q < 3; q++) {
          if (Math.abs(a[p][q]) < 1e-18) continue;
          const th = (a[q][q] - a[p][p]) / (2 * a[p][q]);
          const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1));
          const c = 1 / Math.sqrt(t * t + 1), s = t * c;
          for (let k = 0; k < 3; k++) {
            const akp = a[k][p], akq = a[k][q];
            a[k][p] = c * akp - s * akq; a[k][q] = s * akp + c * akq;
          }
          for (let k = 0; k < 3; k++) {
            const apk = a[p][k], aqk = a[q][k];
            a[p][k] = c * apk - s * aqk; a[q][k] = s * apk + c * aqk;
          }
          for (let k = 0; k < 3; k++) {
            const vkp = v[k][p], vkq = v[k][q];
            v[k][p] = c * vkp - s * vkq; v[k][q] = s * vkp + c * vkq;
          }
        }
    }
    return { vec: v, val: [a[0][0], a[1][1], a[2][2]] };
  }

  /* ------------------------------------------------------------------ trace
   *
   *  Reduced PDB text -> the shape kit/proteinbox.js draws, the same one
   *  tools/bake-trace.js writes: {order, chains:{first, nums, CA, ss}}.
   *
   *  It lives here rather than on a page because it is a PARSE, and the two
   *  traps in it are the kind that ship looking fine:
   *
   *  CHAIN-AWARE FIRST. `parse` keys residues by number alone, which is right
   *  for one chain and silently wrong for ten — chain B's residue 180
   *  overwrites chain A's, and a ten-rung stack comes back as one rung wearing
   *  the last chain's coordinates. So the chains are separated before parse
   *  ever sees them, and each carries the file's own HELIX/SHEET records,
   *  because every rung is the same conformation.
   *
   *  BOTH RECORD TYPES. A native PrP has three helices AND a two-strand sheet,
   *  so assigning only helices would draw the native β-sheet as coil — and
   *  that sheet is exactly what the fibril claims to extend.
   *
   *  Two readers now: the bench, and the gallery card. A second copy of this
   *  in a page is how the chain-aware rule gets lost. */
  function trace(text, lib) {
    const recs = [], byChain = new Map();
    for (const line of text.split('\n')) {
      if (line.startsWith('SHEET') || line.startsWith('HELIX')) { recs.push(line); continue; }
      if (!line.startsWith('ATOM')) continue;
      const c = line[21];
      if (!byChain.has(c)) byChain.set(c, []);
      byChain.get(c).push(line);
    }

    const out = { order: [], chains: {} };
    for (const [c, atoms] of [...byChain.entries()].sort()) {
      const p = parse(recs.concat(atoms).join('\n'));
      const R = p.residues.filter(r => r.atoms.CA);
      if (!R.length) continue;
      const n = R.length, first = R[0].num;
      const letters = ss(n, first, p.helices, 'H');
      const e = ss(n, first, p.sheets, 'E');
      for (let i = 0; i < n; i++) if (e[i] === 'E') letters[i] = 'E';
      out.order.push(c);
      out.chains[c] = {
        first, nums: R.map(r => r.num), CA: R.map(r => r.atoms.CA),
        ss: letters.join(''), helices: p.helices.length, strands: p.sheets.length,
        parsed: p,
      };
    }
    frame(out, lib);
    return out;
  }

  /* ---------------------------------------------------------- the frame
   *
   *  WHICH WAY THE STRUCTURE FACES, solved once here so every consumer gets
   *  the same answer. It used to live on the bench, and the gallery drew the
   *  same file in the deposited frame because it had no copy of this — the
   *  same protein, two orientations, and nothing on either page saying why.
   *
   *  THE STACKING AXIS IS MEASURED, NOT CHOSEN. A fibril is chains repeating
   *  at a fixed step, so the axis is the direction from one rung's centre to
   *  the next, taken from CONSECUTIVE pairs and only where the step is short:
   *  6LNI holds two protofibrils 75 A apart, and averaging every pair or
   *  fitting a line through all ten centroids finds that gap instead of the
   *  fibril. Signs are aligned to the first step before averaging, or a chain
   *  order that runs down one protofibril and back up the other cancels to
   *  nothing and reports a fibril with no axis.
   *
   *  PCA CANNOT FIND IT, which is why this exists at all: the longest
   *  direction in that box is the gap between the protofibrils, a fact about
   *  what was deposited rather than about the fibril. The field draws a fibril
   *  with its axis vertical, so a measured axis goes upright and a monomer
   *  falls back to its own solved basis.
   *
   *  NEEDS FoldLib, and takes it rather than requiring it: a browser has it as
   *  a global, the prion baker passes the module in, and a caller with neither
   *  gets no frame and `frame: 'deposited'` instead of a throw. check-prion.js
   *  is that caller — its geometry assertions do not care which way the
   *  structure faces, and a parse should not gain a hard dependency on a
   *  library it does not own. */
  function stackAxis(t) {
    const NEAR = 8;                      // A; a rung step is 4.9
    const centre = cid => {
      const P = t.chains[cid].CA;
      return [0, 1, 2].map(k => P.reduce((s, p) => s + p[k], 0) / P.length);
    };
    const C = t.order.map(centre);
    const steps = [];
    for (let i = 1; i < C.length; i++) {
      const d = [0, 1, 2].map(k => C[i][k] - C[i - 1][k]);
      const L = Math.hypot(...d);
      if (L < NEAR) steps.push(d.map(v => v / L));
    }
    if (steps.length < 3) return null;
    const ref = steps[0], sum = [0, 0, 0];
    for (const d of steps) {
      const sign = d[0] * ref[0] + d[1] * ref[1] + d[2] * ref[2] < 0 ? -1 : 1;
      for (let k = 0; k < 3; k++) sum[k] += sign * d[k];
    }
    const L = Math.hypot(...sum);
    return { dir: sum.map(v => v / L), steps: steps.length };
  }

  function frame(t, lib) {
    const F = lib || (typeof FoldLib !== 'undefined' ? FoldLib
            : (typeof globalThis !== 'undefined' && globalThis.FoldLib) || null);
    if (!F) { t.frame = 'deposited'; return t; }

    /* Solved over EVERY chain, not the first: the stack's axis is a fact about
       ten rungs, and a basis solved off one of them would face the reader with
       that rung's shape and leave the stacking direction wherever it fell. */
    const all = [];
    for (const cid of t.order) all.push(...t.chains[cid].CA);
    const V = F.viewBasis(all);
    const axis = stackAxis(t);
    if (axis) { t.view = F.basisFrom(axis.dir, V.R[0]); t.frame = 'fibril convention'; }
    else if (V.worth) { t.view = V.R; t.frame = 'computed'; }
    else t.frame = 'deposited';
    return t;
  }

  return { parse, trace, frame, stackAxis, ss, internals, rebuild, morph, ca,
           bondLengths, disulfide, clashes, rmsd, kabsch, ccd,
           _v3: v3, _place: place, _dihedral: dihedral, _lerpAngle: lerpAngle };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = PrionLib;
