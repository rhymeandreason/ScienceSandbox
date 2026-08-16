/* =====================================================================
 *  mol-lipids.js — the membrane set (family B, real ångströms)
 * =====================================================================
 *  glycerol, so far. The phospholipid this file exists for is NOT here
 *  yet, and the reason is written down at the bottom rather than left
 *  for whoever tries next.
 *
 *  FAMILY B. Loads beside mol-small.js and mol-glycolysis.js, never
 *  beside mol-solvation.js — the membrane page compares a water against
 *  a lipid tail, and that comparison only means anything inside one
 *  scale family (molecules.js's header, MolecularGeometry.md §1).
 *
 *  CONSTRUCTED, NOT TYPED — MolecularGeometry.md §1.2 path 4, the same
 *  argument palmitate makes. Every position comes out of the geometry
 *  helpers below; a tetrahedral centre is built from the bonds it
 *  already has, never placed by eye. The first draft of this file WAS
 *  typed and it put three methyls around a nitrogen at 80° and 120°
 *  instead of 109.5° — angles that look plausible in a coordinate list
 *  and are visibly wrong the moment they render. check-molecules.js
 *  prints every angle for exactly this reason.
 * ===================================================================== */
(function(global){
  'use strict';
  const SELFNAME = 'mol-lipids.js';
  const Lib = global.MolLib
    || (typeof require === 'function' ? require('./molecules.js').MolLib : null);
  if (!Lib) throw new Error(SELFNAME + ': molecules.js must be loaded first');
  const { register } = Lib;

  /* ---------- the numbers every coordinate below is derived from ------ */
  const CC = 1.54,          // C–C single
        CO = 1.43;          // C–O alcohol / ester
  const TET = 109.47 * Math.PI / 180;

  const V = {
    add:(a,b)=>[a[0]+b[0], a[1]+b[1], a[2]+b[2]],
    mul:(a,s)=>[a[0]*s, a[1]*s, a[2]*s],
    len:a=>Math.hypot(a[0], a[1], a[2]),
    norm:a=>V.mul(a, 1/V.len(a)),
    cross:(a,b)=>[a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]],
  };
  const at = (p, dir, L) => V.add(p, V.mul(V.norm(dir), L));

  /* THE ZIGZAG, and why it needs no angle argument. Walking a chain with
   * a fixed lateral component and alternating its sign puts every
   * interior angle at exactly 109.47° WHATEVER the bond lengths are: the
   * two directions are (±s,−c,0), and the angle between the reversed
   * first and the second is acos(s²−c²), which is the tetrahedral angle
   * when s and c are sin/cos of half its supplement. */
  const S = Math.sin((Math.PI - TET) / 2), C = Math.cos((Math.PI - TET) / 2);
  function zigzag(start, lengths, sign) {
    const out = []; let p = start.slice(), s = sign;
    for (const L of lengths) { const q = at(p, [s * S, -C, 0], L); out.push(q); p = q; s = -s; }
    return out;
  }
  /* The two remaining tetrahedral directions at a centre with two bonds:
   * bisect away from the pair, then split by half the tetrahedral angle
   * along their common normal. */
  function tetra2(d1, d2) {
    const bis = V.norm(V.mul(V.add(V.norm(d1), V.norm(d2)), -1));
    const perp = V.norm(V.cross(d1, d2));
    const c = Math.cos(TET / 2), s = Math.sin(TET / 2);
    return [ V.norm(V.add(V.mul(bis, c), V.mul(perp, s))),
             V.norm(V.add(V.mul(bis, c), V.mul(perp, -s))) ];
  }
  /* The three remaining at a centre with one bond: a tripod at the
   * tetrahedral angle FROM THAT BOND — not from its supplement, which is
   * the way to get every branch at 70.5° and have it look fine until
   * check-molecules.js prints the angles. */
  function tetra3(d1) {
    const u = V.norm(d1);
    const t = Math.abs(u[0]) < 0.9 ? [1,0,0] : [0,1,0];
    const e1 = V.norm(V.cross(u, t)), e2 = V.cross(u, e1);
    const c = Math.cos(TET), s = Math.sin(TET);
    return [0,1,2].map(k => {
      const a = k * 2 * Math.PI / 3;
      return V.norm(V.add(V.mul(u, c),
        V.add(V.mul(e1, s * Math.cos(a)), V.mul(e2, s * Math.sin(a)))));
    });
  }

  register({
    // — GLYCEROL. Three carbons, three hydroxyls. Tier 1 prop
    //   (MolecularGeometry.md §1.4): correct shape and polarity is the
    //   whole ask, and it is compared against nothing. It earns its
    //   place by answering "what is a phospholipid made of" — the
    //   backbone is invisible inside the assembled lipid, so the pieces
    //   have to be shown beside it.
    glycerol: (() => {
      const c = [[0, CC * C, 0]];                          // C1
      zigzag(c[0], [CC, CC], -1).forEach(p => c.push(p));  // C2, C3
      // Both end carbons are TERMINAL — one bond each, so their hydroxyls
      // go on tetra3 directions. Continuing the zigzag instead is wrong
      // at a chain END: the alternating sign is only anti to the PREVIOUS
      // bond when there is one, and off the last atom it lands at 70° or
      // 180°. Both of those shipped in a draft of this file.
      const back = (from, to) => [c[to][0]-c[from][0], c[to][1]-c[from][1], c[to][2]-c[from][2]];
      const o1 = at(c[0], tetra3(back(0,1))[0], CO);
      const o3 = at(c[2], tetra3(back(2,1))[0], CO);
      const o2 = at(c[1], tetra2(back(1,0), back(1,2))[0], CO);
      const r = v => v.map(x => +x.toFixed(4));
      return {
        name:'Glycerol', formula:'C₃H₈O₃', charge:0, class:'lipid',
        // United-atom, like palmitate: a CH₂ is one carbon sphere, and
        // the formula states the hydrogens (MolecularGeometry.md §1.3b —
        // H is a drawing decision, the formula's count is a chemical one).
        atoms:[ {el:'C',pos:r(c[0])}, {el:'C',pos:r(c[1])}, {el:'C',pos:r(c[2])},
                {el:'O',pos:r(o1)},   {el:'O',pos:r(o2)},   {el:'O',pos:r(o3)} ],
        names:['C1','C2','C3','O1','O2','O3'],
        bonds:[ [0,1],[1,2],[0,3],[1,4],[2,5] ],
        units:'angstrom',
        src:{ path:'built', charge:0,
              method:'all-anti C3 backbone, tetrahedral 109.47° from existing bonds, united-atom' },
        groups:[
          { key:'backbone', label:'Three-carbon backbone', formula:'C₃', atoms:[0,1,2],
            note:'The hook everything else hangs off. Two hydroxyls take fatty acid tails; the third takes the phosphate.' },
          { key:'hydroxyls', label:'Three hydroxyls', formula:'–OH ×3', atoms:[3,4,5],
            note:'Polar, and all three get used — which is why glycerol dissolves in water and the lipid it becomes does not.' },
        ],
      };
    })(),
  }, SELFNAME);

  /* =====================================================================
   *  THE PHOSPHOLIPID, and why it is not in this file yet
   * =====================================================================
   *  It was built, it passed every chemical check, and its POSE was
   *  unusable — so it is held rather than shipped. Writing down where it
   *  stopped, because the next attempt will hit the same wall.
   *
   *  WHAT WORKED. Dipalmitoyl-PC, C₄₀H₈₀NO₈P, net charge 0 from +1 on a
   *  quaternary choline nitrogen and −1 on a phosphate oxygen (a
   *  zwitterion, and NOT a simplification — that is the molecule at every
   *  pH a cell sees, and the head being charged is the whole reason it
   *  faces water). Built as one backbone walk from the nitrogen down to
   *  glycerol C1 with branches hung off it, every angle exact: 109.47° at
   *  the choline nitrogen, the phosphate and the whole backbone, 120° at
   *  both sp² ester carbonyls, all-anti acyl chains, 16-carbon palmitoyl
   *  tails so a student meets the same chain palmitate already draws.
   *
   *  WHAT DID NOT. The two chains hang off ADJACENT glycerol carbons
   *  1.54 Å apart, so two all-anti rods descending from them sit ~1.9 Å
   *  apart — inside each other's van der Waals radius (a C···C contact is
   *  3.4–4.0 Å; chains in a gel-phase bilayer sit 4.5–5.0 Å apart).
   *  check-molecules.js catches it as a NON-BONDED overlap, which is
   *  exactly the class of error a bond-and-angle audit misses and the
   *  reason that check exists.
   *
   *  FOUR FIXES TRIED, all rejected, with the measurements:
   *    · branch selection at the esters — no effect at all. The spacing
   *      is set by the two attachment points, not by which tetrahedral
   *      branch the chains leave on.
   *    · a torsion about the CG2–OE2 bond scanned for maximum clearance
   *      — reaches 4.9 Å by swinging the chain 64° off parallel and 11 Å
   *      out of plane. A V, not a lipid.
   *    · the same torsion scanned for clearance-THEN-parallelism — no
   *      angle satisfies both. Rigid all-anti rods have too few degrees
   *      of freedom; a real chain uses gauche kinks this construction
   *      does not model.
   *    · an in-plane sideways step before the descent, which IS what a
   *      real sn-2 chain does — best result: tips 4.5 Å apart, 10.8°
   *      splay, molecule still flat. It moves the clash rather than
   *      removing it (OD2···CB3 at −0.16).
   *
   *  WHAT TO TRY NEXT, and it is the inverse of all of the above: build
   *  the two chains FIRST, as parallel rods at the measured 4.5 Å
   *  spacing, then solve the ester linkage back to glycerol. Every
   *  attempt here started at the head and let the tails fall where the
   *  construction put them, which is what made the spacing an OUTPUT
   *  instead of an input. The linkage has the torsional freedom to
   *  absorb the offset; two rigid chains do not.
   * ===================================================================== */
})(this);
