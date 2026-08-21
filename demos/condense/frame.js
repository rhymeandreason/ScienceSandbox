/* =============================================================================
 *  condense/frame.js — the rigid transform that poses a reactant on its product
 * =============================================================================
 *  Plain arrays, no THREE, no MolLib: browser global `CondenseFrame` and a Node
 *  export, so `check-condense.js` asserts the SAME code condense-drag.js poses
 *  with rather than a second copy of the arithmetic.
 *
 *  Three points fix a rigid body. Both residues of maltose and cellobiose are
 *  built by the same ringPyranose() as glucose itself, in the same call order,
 *  so a bench glucose and a product residue are not merely similar — they are
 *  the same coordinates in a different frame. That makes this an exact
 *  transform, and the checker holds it to that: it measures every mapped atom,
 *  not just the three the frame was built from, and fails on a deviation a fit
 *  would happily absorb.
 *
 *  Why that matters: α- and β-1,4 differ by nothing a bond length, a bond angle
 *  or a render can see (MolecularGeometry.md §1.3). A pose that were merely
 *  close would let the page draw maltose and call it cellobiose with every
 *  visible number still correct.
 * ========================================================================== */
(function(global){
  'use strict';

  const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
  const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
  const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const len=a=>Math.sqrt(dot(a,a));
  const unit=a=>{ const l=len(a); return l ? [a[0]/l,a[1]/l,a[2]/l] : [0,0,0]; };
  const scale=(a,k)=>[a[0]*k,a[1]*k,a[2]*k];

  // Column-major basis [x y z] as a flat 9, from three points.
  function basis(p1,p2,p3){
    const x=unit(sub(p2,p1));
    const z=unit(cross(x, sub(p3,p1)));
    const y=cross(z,x);
    return [x,y,z];
  }
  // Rotation taking frame `from` onto frame `to`: to * fromᵀ.
  function rotation(from,to){
    const r=[[0,0,0],[0,0,0],[0,0,0]];
    for(let i=0;i<3;i++) for(let j=0;j<3;j++)
      r[i][j]= to[0][i]*from[0][j] + to[1][i]*from[1][j] + to[2][i]*from[2][j];
    return r;
  }
  const rot=(r,v)=>[dot(r[0],v), dot(r[1],v), dot(r[2],v)];

  /* The transform putting triad `from` (three [x,y,z]) onto triad `to`.
   * Returns { r, o, t } — rotate about `o`, then translate to `t`, which is the
   * order condense-drag.js applies its matrices in. */
  function match(from,to){
    return { r:rotation(basis(from[0],from[1],from[2]), basis(to[0],to[1],to[2])),
             o:from[0], t:to[0] };
  }
  function apply(m,p){ return add(rot(m.r, sub(p, m.o)), m.t); }

  const API={ basis, rotation, match, apply, sub, add, len, unit, scale, dot, cross };
  if(typeof module!=='undefined' && module.exports) module.exports=API;
  else global.CondenseFrame=API;
})(this);
