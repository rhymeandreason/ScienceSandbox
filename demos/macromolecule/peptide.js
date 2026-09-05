/* =============================================================================
 *  macromolecule/peptide.js — where the next residue has to sit
 * =============================================================================
 *  A peptide bond is a condensation: the carboxyl keeps its C and loses –OH,
 *  the amino keeps its N and loses one H, and the two halves leave as one
 *  water. This file answers the only question a page cannot answer for itself
 *  — given a residue on stage, WHERE does the next one go — and it answers in
 *  a rigid transform, placing nothing.
 *
 *  SIX NUMBERS, AND WHERE EACH ONE COMES FROM. Typing a rotation puts ω
 *  wherever it landed, and ω is the difference between a real backbone and a
 *  shape no ribosome makes. So none of the six is typed:
 *
 *    · three — the N's position. The amide nitrogen goes exactly where the
 *      departing hydroxyl oxygen was: on the ray out of the carboxyl carbon
 *      through that oxygen, at the peptide bond's own length. The direction is
 *      read off the host's atoms; only the length is a constant (CN below).
 *    · two — the N's facing. The bond being made replaces the N–H that leaves,
 *      so the guest turns until its departing H points back at the carboxyl
 *      carbon. Read off the guest's own atoms.
 *    · one — ω, the turn about the new bond, which nothing above constrains.
 *      This is the one fact that has to be asserted rather than derived, and it
 *      is asserted trans (OMEGA): the two α-carbons end up on opposite sides.
 *      Trans is what essentially every peptide bond in a protein is, because
 *      cis puts the two side chains into each other.
 *
 *  WHICH ATOMS ARE INVOLVED IS READ FROM `condense:`, never counted off the
 *  formula. A spec that renumbers cannot quietly start bonding the wrong atoms:
 *  check-molecules.js already asserts that each role names a real group and
 *  that the two roles together shed exactly one water.
 *
 *  THE α-CARBON IS FOUND, NOT INDEXED. It is the one heavy atom bonded to both
 *  the amino N and the carboxyl C. The library's fixed backbone order does put
 *  it at 3, but ω is measured against it and a spec built some other way would
 *  read a silently wrong torsion.
 *
 *  ÅNGSTRÖMS IN, ÅNGSTRÖMS OUT. No THREE, no scene, no page state, so
 *  check-macromolecule.js runs the whole file in Node.
 * ========================================================================== */
(function(global){
  'use strict';

  // The amide C–N. Shorter than a single C–N (1.47 Å) because the bond has
  // partial double character, which is also why the unit is planar and why ω
  // is a constant here instead of a free rotor.
  const CN = 1.33;
  const OMEGA = Math.PI;              // trans

  const sub = (a,b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
  const add = (a,b) => [a[0]+b[0], a[1]+b[1], a[2]+b[2]];
  const mul = (a,s) => [a[0]*s, a[1]*s, a[2]*s];
  const dot = (a,b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
  const cross = (a,b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
  const len = a => Math.hypot(a[0], a[1], a[2]);
  const unit = a => { const L = len(a); return L ? mul(a, 1/L) : [0,0,0]; };

  // q as [x,y,z,w], the same order THREE uses, so a page can hand one straight
  // to a Quaternion without reordering.
  function qrot(q, v){
    const [x,y,z,w] = q;
    const tx = 2*(y*v[2] - z*v[1]), ty = 2*(z*v[0] - x*v[2]), tz = 2*(x*v[1] - y*v[0]);
    return [v[0] + w*tx + y*tz - z*ty,
            v[1] + w*ty + z*tx - x*tz,
            v[2] + w*tz + x*ty - y*tx];
  }
  const qmul = (a,b) => [
    a[3]*b[0] + a[0]*b[3] + a[1]*b[2] - a[2]*b[1],
    a[3]*b[1] - a[0]*b[2] + a[1]*b[3] + a[2]*b[0],
    a[3]*b[2] + a[0]*b[1] - a[1]*b[0] + a[2]*b[3],
    a[3]*b[3] - a[0]*b[0] - a[1]*b[1] - a[2]*b[2]];
  const qAxis = (axis, ang) => {
    const u = unit(axis), s = Math.sin(ang/2);
    return [u[0]*s, u[1]*s, u[2]*s, Math.cos(ang/2)];
  };
  /* The shortest rotation taking unit vector `a` onto unit vector `b`. The
   * antiparallel case has no shortest rotation — every half-turn about an axis
   * perpendicular to `a` works — so one perpendicular is picked deliberately
   * rather than left to a cross product that has gone to zero. */
  function qFromTo(a, b){
    const d = dot(a, b);
    if(d > 0.999999) return [0,0,0,1];
    if(d < -0.999999){
      const perp = Math.abs(a[0]) < 0.9 ? [1,0,0] : [0,1,0];
      return qAxis(unit(cross(a, perp)), Math.PI);
    }
    const c = cross(a, b);
    return [c[0], c[1], c[2], 1 + d];        // normalised below
  }
  const qnorm = q => { const L = Math.hypot(q[0],q[1],q[2],q[3]);
                       return [q[0]/L, q[1]/L, q[2]/L, q[3]/L]; };

  /* Dihedral a-b-c-d, signed, in radians, IUPAC sign: turning d about the b→c
   * axis by +θ (right hand along b→c) raises the result by θ. The bare atan2
   * of the two normals comes out with the opposite sign, so it is negated here
   * rather than at the call site — ω is a published quantity, and a torsion
   * that reads backwards is a number that compares wrong against every table. */
  function torsion(a, b, c, d){
    const b1 = sub(b,a), b2 = sub(c,b), b3 = sub(d,c);
    const n1 = cross(b1,b2), n2 = cross(b2,b3), m = cross(n1, unit(b2));
    return -Math.atan2(dot(m,n2), dot(n1,n2));
  }

  /* ---- the roles, out of the spec's own `condense:` block ------------------
   * The reading and the spec surgery are macromolecule/spec.js's: one
   * condensation is one reaction whichever class it happens to, and a second
   * copy of "which atoms left and what do the indices become" is the drift this
   * whole folder exists to avoid. */
  const Spec = (typeof require === 'function' && typeof module === 'object')
    ? require('./spec.js') : global.MacroSpec;
  const { role, free, bondedTo, strip } = Spec;

  // Every amino acid declares both halves of the reaction, so one predicate
  // covers "can this be a residue at all".
  const isResidue = spec => !!(role(spec,'carboxyl') && role(spec,'amino'));

  /* The α-carbon: the heavy atom bonded to both backbone termini. Found rather
   * than indexed — see the header. */
  function alphaOf(spec){
    const n = role(spec,'amino').keep, c = role(spec,'carboxyl').keep;
    const near = new Set(bondedTo(spec, c));
    const hit = bondedTo(spec, n).filter(i => near.has(i) && spec.atoms[i].el !== 'H');
    return hit.length === 1 ? hit[0] : -1;
  }

  /* ---- the pose ------------------------------------------------------------
   * Where `guest` must sit for its amino N to bond to `host`'s carboxyl C,
   * with the host at the origin unrotated. A page composes the answer with the
   * host's live transform: a peptide bond is a relationship between two
   * molecules, not a place on stage.
   *
   * Returns { pos, quat, bondAt, waterAt } — the last two so the page can put
   * the flare on the bond and the water where the leaving atoms met, rather
   * than at a transform origin that is in the middle of nothing.
   */
  function pose(host, guest){
    const hc = free(host,'carboxyl'), ga = free(guest,'amino');
    if(!hc || !ga) return null;
    const P = (s,i) => s.atoms[i].pos;

    const C  = P(host, hc.keep);
    const O  = P(host, hc.leaves[0]);          // the hydroxyl O that departs
    const dir = unit(sub(O, C));               // C → where the N is going
    const Nat = add(C, mul(dir, CN));

    // Turn the guest so its departing N–H points back down the new bond.
    const N  = P(guest, ga.keep);
    const H  = P(guest, ga.leaves[0]);
    let q = qnorm(qFromTo(unit(sub(H, N)), mul(dir, -1)));

    // Place it, then read ω off where that landed and spin about the C–N axis
    // until it is trans. Measured, not assumed: qFromTo picks the shortest
    // rotation, and which ω that happens to give depends on the conformer.
    const put = (qq, p) => add(qrot(qq, sub(p, N)), Nat);
    const CAh = P(host, alphaOf(host));
    const CAg = i => put(q, P(guest, i));
    const w = torsion(CAh, C, Nat, CAg(alphaOf(guest)));
    q = qnorm(qmul(qAxis(dir, OMEGA - w), q));

    const pos = sub(Nat, qrot(q, N));          // where the guest's ORIGIN goes
    return {
      pos, quat:q,
      clash: clashOf(host, guest, q, pos),
      bondAt: mul(add(C, Nat), 0.5),
      // The water assembles between the two groups that gave it up: the host's
      // –OH and the guest's H, which is where a student is looking.
      waterAt: mul(add(O, add(qrot(q, sub(H, N)), Nat)), 0.5),
      omega: torsion(CAh, C, Nat, add(qrot(q, sub(P(guest, alphaOf(guest)), N)), Nat)),
    };
  }

  /* The closest non-bonded approach between the two residues in the solved
   * pose, or null if nothing is closer than CLASH. Atoms that leave are exempt
   * — they are gone by the time the pose exists — and so is the new C–N pair.
   *
   * A CLASH IS NOT "THESE TWO CANNOT BOND". Every pair of amino acids forms a
   * peptide bond; what clashes here is two RIGID conformers, and a real chain
   * relieves it by turning φ and ψ, which nothing in this file moves. Proline
   * is the residue it happens to: its ring holds the α-carbon's neighbours in
   * place, so it is reported for most partners. A page that shows the number
   * is showing the cost of drawing residues rigidly, and must not narrate it
   * as chemistry refusing.
   *
   * 1.6 Å is under any real H···H contact (2.2 Å van der Waals) and above the
   * ~1.5 Å the correct poses come out at, so it separates a drawing problem
   * from a snug fit rather than flagging every join. */
  const CLASH = 1.6;
  function clashOf(host, guest, q, pos){
    const hc = role(host,'carboxyl'), ga = role(guest,'amino');
    const gone = { h:new Set(hc.leaves), g:new Set(ga.leaves) };
    let min = Infinity, at = null;
    for(let i = 0; i < host.atoms.length; i++){
      if(gone.h.has(i)) continue;
      for(let j = 0; j < guest.atoms.length; j++){
        if(gone.g.has(j) || (i === hc.keep && j === ga.keep)) continue;
        const g2 = add(qrot(q, guest.atoms[j].pos), pos);
        const d = len(sub(host.atoms[i].pos, g2));
        if(d < min){ min = d; at = [i, j]; }
      }
    }
    return min < CLASH ? { dist:min, atoms:at } : null;
  }

  /* What the two residues become, in the peptide bond's own roles. The C-N
   * bond is BETWEEN them and belongs to whatever draws the chain. */
  const react = (host, guest) => Spec.react(host, guest, 'carboxyl', 'amino');

  const API = { pose, isResidue, free, role, alphaOf, torsion, clashOf,
                strip, react, CN, OMEGA, CLASH };
  if(typeof module === 'object' && module.exports) module.exports = API;
  global.Peptide = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
