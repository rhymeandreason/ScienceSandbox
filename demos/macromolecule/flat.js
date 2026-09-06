/* =============================================================================
 *  macromolecule/flat.js — the tabletop a fat is built on, and the pose there
 * =============================================================================
 *  THE GESTURE IS FLAT AND THE MOLECULE IS NOT, and for a fat those two cannot
 *  be reconciled by aiming better. Glycerol's three hydroxyls point into three
 *  different directions in space, so two of the three esters want the tail
 *  fifteen units out of the z = 0 plane the pointer works on: a student dragging
 *  on the tabletop can never arrive. molecule-builder.html met the same wall and
 *  answered it the same way — BUILD IN THE DIAGRAM, THEN LOOK AT THE MOLECULE.
 *
 *  So this file is the flat half of the fat card: the layout the pieces are
 *  dragged in, and the ester construction restricted to that layout. The real
 *  one in ester.js is untouched, because it is what the reveal morphs TO.
 *
 *  ONLY GLYCEROL NEEDS FLATTENING. Both fatty acids are already idealised
 *  all-anti zigzags at z = 0 (mol-lipids.js), so `spec` hands them back
 *  unchanged rather than laying out a molecule that is already lying down.
 *
 *  THE LAYOUT IS BAKED, THE HYDROGENS ARE NOT. `flat2d` is RDKit's depiction,
 *  heavy atoms only (tools/bake-flat2d.js), which is right for a diagram and
 *  wrong here by exactly three atoms: an esterification is DEFINED by the
 *  hydroxyl H that leaves, and a layout without them has nothing to react. Each
 *  one is placed here, in the plane, at 120° off its own C–O bond and on the
 *  side away from the rest of the molecule — the angle a diagram draws and the
 *  side it puts it on. The real angle is 104.5° and it is asserted in the 3D
 *  spec, which is where an angle claim belongs.
 *
 *  WHAT THE FLAT POSE KEEPS. Everything ester.js measures: the carbon lands
 *  where the H was, at the same 1.34 Å, with the acid turned until its departing
 *  oxygen points back down the new bond and the carbonyl syn to the alcohol's
 *  carbon. Z is reachable exactly in a plane — a torsion there is 0 or 180 — so
 *  the flat build asserts the same configuration the round one does rather than
 *  a flattened approximation of it.
 *
 *  WHAT IT GIVES UP, and the page must say so: the C–O–C angles are the
 *  drawing's, not the molecule's, and glycerol's backbone is a flat zigzag
 *  rather than a real sp3 chain. That is the whole content of the reveal.
 *
 *  Ångströms in, ångströms out. No THREE, Node-loadable.
 * ========================================================================== */
(function(global){
  'use strict';

  const req = p => (typeof require === 'function' ? require(p) : null);
  const Spec  = global.MacroSpec || req('./spec.js');
  const Ester = global.Ester     || req('./ester.js');

  const sub = (a,b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
  const add = (a,b) => [a[0]+b[0], a[1]+b[1], a[2]+b[2]];
  const mul = (a,s) => [a[0]*s, a[1]*s, a[2]*s];
  const len = a => Math.hypot(a[0], a[1], a[2]);
  const unit = a => { const L = len(a); return L ? mul(a, 1/L) : [0,0,0]; };
  const qmul = (a,b) => [
    a[3]*b[0] + a[0]*b[3] + a[1]*b[2] - a[2]*b[1],
    a[3]*b[1] - a[0]*b[2] + a[1]*b[3] + a[2]*b[0],
    a[3]*b[2] + a[0]*b[1] - a[1]*b[0] + a[2]*b[3],
    a[3]*b[3] - a[0]*b[0] - a[1]*b[1] - a[2]*b[2]];
  const qAxis = (axis, ang) => {
    const u = unit(axis), s = Math.sin(ang/2);
    return [u[0]*s, u[1]*s, u[2]*s, Math.cos(ang/2)];
  };
  function qrot(q, v){
    const [x,y,z,w] = q;
    const tx = 2*(y*v[2] - z*v[1]), ty = 2*(z*v[0] - x*v[2]), tz = 2*(x*v[1] - y*v[0]);
    return [v[0] + w*tx + y*tz - z*ty,
            v[1] + w*ty + z*tx - x*tz,
            v[2] + w*tz + x*ty - y*tx];
  }

  const FLAT_EPS = 1e-6;
  const isFlat = spec => spec.atoms.every(a => Math.abs(a.pos[2]) < FLAT_EPS);

  const bondedTo = (spec, i) => (spec.bonds || [])
    .filter(b => b[0] === i || b[1] === i)
    .map(b => b[0] === i ? b[1] : b[0]);

  /* The same atoms, laid out flat. A spec already in the plane comes back as
   * itself — including the same object, so a page can test identity to find out
   * whether anything moved. */
  function spec(s){
    if(isFlat(s)) return s;
    const F = s.flat2d;
    // A molecule with no layout must fail VISIBLY. Dropping it into the plane by
    // zeroing z would fold the two hydroxyls that point out of the page onto the
    // backbone and still render.
    if(!F || !F.length) return null;

    let k = 0;
    const flatIdx = s.atoms.map(a => a.el === 'H' ? -1 : k++);
    if(k !== F.length) return null;

    const pos = s.atoms.map((a,i) =>
      a.el === 'H' ? null : [F[flatIdx[i]][0], F[flatIdx[i]][1], 0]);

    // Centre of the heavy atoms, which is the "rest of the molecule" each H is
    // placed away from.
    const heavy = pos.filter(Boolean);
    const mid = mul(heavy.reduce(add, [0,0,0]), 1/heavy.length);

    for(let i = 0; i < s.atoms.length; i++){
      if(s.atoms[i].el !== 'H') continue;
      const o = bondedTo(s, i).find(j => s.atoms[j].el !== 'H');
      if(o == null || !pos[o]) return null;
      const c = bondedTo(s, o).find(j => j !== i && s.atoms[j].el !== 'H');
      if(c == null || !pos[c]) return null;
      // The H–O bond keeps its real length; only the direction is the drawing's.
      const L = len(sub(s.atoms[i].pos, s.atoms[o].pos));
      const back = unit(sub(pos[c], pos[o]));       // O → its carbon, in the plane
      // 120° either side of that bond. Whichever lands farther from the middle
      // of the molecule is the side a diagram draws it on, and the side that
      // leaves the ester room to be built.
      const cand = [Math.PI*2/3, -Math.PI*2/3].map(t => add(pos[o], mul(
        [back[0]*Math.cos(t) - back[1]*Math.sin(t),
         back[0]*Math.sin(t) + back[1]*Math.cos(t), 0], L)));
      pos[i] = len(sub(cand[0], mid)) > len(sub(cand[1], mid)) ? cand[0] : cand[1];
    }
    return { ...s, atoms: s.atoms.map((a,i) => ({ el:a.el, pos:pos[i] })), flatBuilt:true };
  }

  /* Where `acid` must sit for its carbonyl carbon to bond to `host`'s hydroxyl
   * oxygen WITHOUT EITHER LEAVING THE PLANE. Same shape as Ester.pose, so the
   * page's latch cannot tell the two apart, and the same six numbers — three of
   * which are now zero by construction. */
  function pose(host, acid, slot){
    const ha = Spec.free(host, slot), ga = Spec.free(acid, 'carboxyl');
    if(!ha || !ga) return null;
    if(!isFlat(host) || !isFlat(acid)) return null;
    const P = (s,i) => s.atoms[i].pos;

    const O = P(host, ha.keep);                    // the alcohol O — it STAYS
    const H = P(host, ha.leaves[0]);               // and its H, which goes
    const dir = unit(sub(H, O));
    const Cat = add(O, mul(dir, Ester.CO));

    // Turn the acid IN THE PLANE until its departing hydroxyl points back down
    // the new bond. One rotation about z, and a z rotation is the only one that
    // leaves a flat molecule flat.
    const C = P(acid, ga.keep), Ol = P(acid, ga.leaves[0]);
    const from = unit(sub(Ol, C)), to = mul(dir, -1);
    const ang = Math.atan2(from[0]*to[1] - from[1]*to[0], from[0]*to[0] + from[1]*to[1]);
    let q = qAxis([0,0,1], ang);

    // Z, measured rather than assumed, exactly as ester.js does it. In a plane
    // the torsion can only be 0 or 180, so the correction is the half turn about
    // the new bond — which is in the plane, and therefore keeps the acid in it.
    const put = (qq, p) => add(qrot(qq, sub(p, C)), Cat);
    const Ca  = P(host, Ester.alkylC(host, ha.keep));
    const oIx = Ester.carbonylO(acid, ga.keep, ga.leaves);
    if(Math.abs(Ester.torsion(Ca, O, Cat, put(q, P(acid, oIx)))) > Math.PI/2)
      q = qmul(qAxis(dir, Math.PI), q);

    return {
      pos: sub(Cat, qrot(q, C)), quat: q, slot,
      at: C,                                     // the bonding atom, acid frame

      bondAt: mul(add(O, Cat), 0.5),
      waterAt: mul(add(H, put(q, Ol)), 0.5),
      twist: Ester.torsion(Ca, O, Cat, put(q, P(acid, oIx))),
      clash: null,
    };
  }

  const API = { spec, pose, isFlat };
  if(typeof module === 'object' && module.exports) module.exports = API;
  global.MacroFlat = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
