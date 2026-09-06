/* =============================================================================
 *  macromolecule/ester.js — where the next fatty acid has to sit
 * =============================================================================
 *  An ester is a condensation like the other two: an acid's –OH meets an
 *  alcohol's –H, one water leaves. The construction is peptide.js's, and it is
 *  worth saying exactly how it differs, because the difference is the thing
 *  that renders perfectly when you get it wrong.
 *
 *  THE BRIDGE OXYGEN IS THE ALCOHOL'S. The acid gives up its whole hydroxyl
 *  and keeps only the carbonyl carbon; glycerol gives up one hydrogen and
 *  keeps the oxygen. That is the opposite of a glycosidic bond, where the
 *  donor keeps its anomeric O, and taking it the wrong way round builds the
 *  bond one atom out — a C–O–C that is a real ester of a molecule nobody
 *  asked for. `condense:` says which is which and this file never counts it
 *  off the formula.
 *
 *  SIX NUMBERS, AND WHERE EACH COMES FROM. None is typed:
 *
 *    · three — the carbonyl carbon's position. It goes exactly where the
 *      departing hydroxyl hydrogen was: on the ray out of glycerol's oxygen
 *      through that H, at the ester bond's own length (CO below). Direction
 *      read off the host's atoms; only the length is a constant.
 *    · two — the acid's facing. The bond being made replaces the C–O(H) that
 *      leaves, so the acid turns until its departing oxygen points back at
 *      the alcohol's oxygen.
 *    · one — the turn about the new bond, which nothing above constrains.
 *      Asserted Z (ZTOR): the carbonyl oxygen syn to the alcohol's carbon.
 *      Essentially every ester in a fat is Z; the E form is a few kcal up and
 *      is what you get by accident if this is left free.
 *
 *  THERE IS NO CHAIN HERE, AND THAT IS THE LESSON. Glycerol declares three
 *  roles and no acceptor of its own, so nothing can bond to a fatty acid once
 *  it has landed. The reaction stops at three because the molecule runs out of
 *  hydroxyls, not because this file says so. A fat is not a polymer.
 *
 *  Ångströms in, ångströms out. No THREE, Node-loadable.
 * ========================================================================== */
(function(global){
  'use strict';

  const req = p => (typeof require === 'function' ? require(p) : null);
  const Spec = global.MacroSpec || req('./spec.js');

  // The ester C–O to the alkyl oxygen. Shorter than the 1.43 Å alcohol C–O it
  // replaces, because the carbonyl next to it pulls the lone pair into
  // conjugation — the same partial double character that makes the group
  // planar and makes ZTOR a constant rather than a free rotor.
  const CO = 1.34;
  const ZTOR = 0;                     // Z: carbonyl O syn to the alcohol's carbon

  const sub = (a,b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
  const add = (a,b) => [a[0]+b[0], a[1]+b[1], a[2]+b[2]];
  const mul = (a,s) => [a[0]*s, a[1]*s, a[2]*s];
  const dot = (a,b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
  const cross = (a,b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
  const len = a => Math.hypot(a[0], a[1], a[2]);
  const unit = a => { const L = len(a); return L ? mul(a, 1/L) : [0,0,0]; };

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
  const qnorm = q => { const L = Math.hypot(q[0],q[1],q[2],q[3]);
                       return [q[0]/L, q[1]/L, q[2]/L, q[3]/L]; };
  function qFromTo(a, b){
    const d = dot(a, b);
    if(d > 0.999999) return [0,0,0,1];
    if(d < -0.999999){
      const perp = Math.abs(a[0]) < 0.9 ? [1,0,0] : [0,1,0];
      return qAxis(unit(cross(a, perp)), Math.PI);
    }
    const c = cross(a, b);
    return qnorm([c[0], c[1], c[2], 1 + d]);
  }
  // IUPAC sign, matching peptide.js's — turning d about the b→c axis by +θ
  // raises the result by θ.
  function torsion(a, b, c, d){
    const b1 = sub(b,a), b2 = sub(c,b), b3 = sub(d,c);
    const n1 = cross(b1,b2), n2 = cross(b2,b3), m = cross(n1, unit(b2));
    return -Math.atan2(dot(m,n2), dot(n1,n2));
  }

  const bondedTo = (spec, i) => (spec.bonds || [])
    .filter(b => b[0] === i || b[1] === i)
    .map(b => b[0] === i ? b[1] : b[0]);

  /* The carbon an alcohol's oxygen hangs off, and the carbonyl oxygen an
   * acid's carbon carries. Both FOUND from the bonds — the torsion is measured
   * against them, and an index typed here would report a real angle for the
   * wrong pair of atoms. */
  const alkylC = (spec, o) => bondedTo(spec, o).find(i => spec.atoms[i].el === 'C');
  function carbonylO(spec, c, gone){
    const drop = new Set(gone);
    return bondedTo(spec, c).find(i => spec.atoms[i].el === 'O' && !drop.has(i));
  }

  /* Where `acid` must sit for its carbonyl carbon to bond to `host`'s hydroxyl
   * oxygen, with the host at the origin unrotated. `slot` names which of
   * glycerol's three roles is being filled; a page walks them itself, because
   * which one is free is a question about the molecule on stage.
   *
   * Returns the same shape peptide.js and glycosidic.js do, so plane.js cannot
   * tell the three latches apart. */
  function pose(host, acid, slot){
    const ha = Spec.free(host, slot), ga = Spec.free(acid, 'carboxyl');
    if(!ha || !ga) return null;
    const P = (s,i) => s.atoms[i].pos;

    const O = P(host, ha.keep);                  // the alcohol O — it STAYS
    const H = P(host, ha.leaves[0]);             // and its H, which goes
    const dir = unit(sub(H, O));                 // O → where the carbon lands
    const Cat = add(O, mul(dir, CO));

    // Turn the acid so its departing hydroxyl O points back down the new bond.
    const C  = P(acid, ga.keep);
    const Ol = P(acid, ga.leaves[0]);
    let q = qFromTo(unit(sub(Ol, C)), mul(dir, -1));

    // Place it, then read the twist off where that landed and spin about the
    // new bond until the carbonyl is Z. Measured, not assumed: qFromTo takes
    // the shortest rotation, and which twist that gives depends on the build.
    const put = (qq, p) => add(qrot(qq, sub(p, C)), Cat);
    const Ca  = P(host, alkylC(host, ha.keep));
    const oIx = carbonylO(acid, ga.keep, ga.leaves);
    const t   = torsion(Ca, O, Cat, put(q, P(acid, oIx)));
    q = qnorm(qmul(qAxis(dir, ZTOR - t), q));

    const pos = sub(Cat, qrot(q, C));            // where the acid's ORIGIN goes
    return {
      pos, quat:q, slot,
      // The bonding atom in the ACID'S OWN frame. A latch that measures the
      // origin instead measures a point that is nowhere near the reaction —
      // palmitate's is eight ångströms down its own chain — so a tail held
      // exactly on the hydroxyl reads as far away the moment it is turned.
      at: C,
      bondAt: mul(add(O, Cat), 0.5),
      // The water assembles between the two groups that gave it up: the
      // alcohol's H and the acid's whole hydroxyl.
      waterAt: mul(add(H, add(qrot(q, sub(Ol, C)), Cat)), 0.5),
      twist: torsion(Ca, O, Cat, add(qrot(q, sub(P(acid, oIx), C)), Cat)),
      clash: null,
    };
  }

  /* Which of the host's slots are still free, in order. A page asks this
   * rather than hard-coding three: the answer is a fact about the molecule on
   * stage, and it is also what makes the reaction stop. */
  const slots = host => ['sn1','sn2','sn3'].filter(k => Spec.free(host, k));

  const react = (host, acid, slot) => Spec.react(host, acid, slot, 'carboxyl');

  const API = { pose, slots, react, torsion, alkylC, carbonylO, CO, ZTOR };
  if(typeof module === 'object' && module.exports) module.exports = API;
  global.Ester = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
