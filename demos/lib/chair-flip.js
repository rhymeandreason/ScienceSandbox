/* =============================================================================
 *  chair-flip.js — the ring flip, and why glucose is the sugar life runs on
 * =============================================================================
 *  Plain arrays: no THREE, no Stage. Browser global `ChairFlip` and a Node
 *  export, so chair/check-chair.js asserts the same code the page animates.
 *  Needs kit/molgraph.js (ring finding, branch walking), which loads in both.
 *
 *  WHAT THIS IS. The hexagon a textbook draws is a lie: a pyranose ring is a
 *  CHAIR, and a chair can flip into the other chair. Every substituent that was
 *  equatorial becomes axial and every axial one becomes equatorial. It is the
 *  one thing everybody does with a physical model kit, and it carries the best
 *  fact in the topic — in glucose's favoured chair every bulky group is
 *  equatorial, which no other aldohexose manages, and that is why glucose is
 *  the sugar life runs on.
 *
 *  A FLIP IS A CONFORMATION, NOT A CONFIGURATION, and everything here exists to
 *  keep that true. No bond breaks and no stereocentre changes: β-D-glucose in
 *  either chair is still β-D-glucose. The trap is that the obvious way to write
 *  it — reflect the molecule through the ring's mean plane — produces the
 *  ENANTIOMER, with every bond length, every angle and every rendered pixel
 *  identical. mol-krebs.js records that exact failure happening in this repo
 *  once already, caught only by a network checker.
 *
 *  So the flip is built as a PROPER ROTATION per atom and never as a
 *  reflection:
 *
 *    1. The ring's own pucker is inverted — each ring atom's displacement along
 *       the mean-plane normal is negated, leaving its in-plane position alone.
 *       That is what turns one chair into the other.
 *    2. Every substituent is then carried across in a LOCAL FRAME. Each ring
 *       carbon gets a right-handed frame built from its two ring neighbours, by
 *       one fixed recipe, in the old geometry and again in the new one. A
 *       substituent's coordinates in that frame are unchanged, so the transform
 *       between them is `F_new · F_oldᵀ` — a product of two right-handed bases,
 *       therefore determinant +1, therefore a rotation. A mirror cannot come out
 *       of it by construction, not by inspection afterwards.
 *    3. Whole branches move together (C6's arm, each hydroxyl's hydrogen), found
 *       through the graph, so nothing is left behind pointing at where its
 *       carbon used to be.
 *
 *  chair/check-chair.js measures the signed volume at every stereocentre before and
 *  after and fails on any sign change, which is the assertion that makes step 2
 *  a claim rather than a hope.
 *
 *  Usage:
 *    const out = ChairFlip.flip(spec);     // → {pos, ring, axial, equatorial}
 *    ChairFlip.tilts(spec, out.pos, ring); // → per-substituent angle to the ring
 * ========================================================================== */
(function(global){
  'use strict';

  const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
  const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
  const mul=(a,k)=>[a[0]*k,a[1]*k,a[2]*k];
  const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
  const len=a=>Math.sqrt(dot(a,a));
  const unit=a=>{ const l=len(a); return l ? [a[0]/l,a[1]/l,a[2]/l] : [0,0,0]; };

  const graph = () => global.MolGraph
    || (typeof require==='function' ? require('../kit/molgraph.js').MolGraph : null);

  function adjacency(spec){
    const a={};
    (spec.bonds||[]).forEach(([i,j])=>{ (a[i]=a[i]||[]).push(j); (a[j]=a[j]||[]).push(i); });
    return a;
  }

  // The six-membered ring, or the largest one there is.
  function ringOf(spec){
    const G=graph();
    const rings=(G&&G.rings(spec))||[];
    return rings.find(r=>r.length===6) || rings.sort((a,b)=>b.length-a.length)[0] || null;
  }

  // Newell's normal + centroid: the ring's own mean plane, which is what "above"
  // and "below" mean for a pucker.
  function plane(pos, ring){
    const c=ring.reduce((s,i)=>add(s,pos[i]),[0,0,0]).map(v=>v/ring.length);
    let n=[0,0,0];
    for(let k=0;k<ring.length;k++)
      n=add(n, cross(sub(pos[ring[k]],c), sub(pos[ring[(k+1)%ring.length]],c)));
    return { c, n:unit(n) };
  }

  /* A right-handed frame at ring atom `i`, from its two ring neighbours. ONE
   * recipe, used for both the old and the new geometry — that sameness is what
   * makes the transform between them a rotation. */
  function frameAt(pos, i, prev, next){
    const u=unit(sub(pos[prev],pos[i])), v=unit(sub(pos[next],pos[i]));
    const e1=unit(add(u,v));
    const e3=unit(cross(u,v));
    const e2=cross(e3,e1);
    return [e1,e2,e3];
  }
  const toLocal=(F,d)=>[dot(F[0],d), dot(F[1],d), dot(F[2],d)];
  const toWorld=(F,l)=>add(add(mul(F[0],l[0]), mul(F[1],l[1])), mul(F[2],l[2]));

  /* The flip. Returns new positions plus which substituents ended up axial. */
  function flip(spec, from){
    const G=graph();
    if(!G) throw new Error('chair-flip: kit/molgraph.js must be loaded first');
    const ring=ringOf(spec);
    if(!ring) throw new Error('chair-flip: no ring in this molecule');
    const pos=(from||spec.atoms.map(a=>a.pos)).map(p=>[p[0],p[1],p[2]]);
    const out=pos.map(p=>[p[0],p[1],p[2]]);
    const inRing=new Set(ring);
    const adj=adjacency(spec);

    // 1. invert the pucker: negate each ring atom's height above the mean plane
    const { c, n } = plane(pos, ring);
    ring.forEach(i=>{
      const h=dot(sub(pos[i],c), n);
      out[i]=sub(pos[i], mul(n, 2*h));
    });

    // 2 + 3. carry every substituent branch across in its ring atom's own frame
    ring.forEach((i,k)=>{
      const prev=ring[(k-1+ring.length)%ring.length], next=ring[(k+1)%ring.length];
      const Fo=frameAt(pos, i, prev, next), Fn=frameAt(out, i, prev, next);
      (adj[i]||[]).forEach(s=>{
        if(inRing.has(s)) return;
        // the whole branch hanging off this bond, so an -OH keeps its hydrogen
        const branch=G.component(spec, s, [[i,s]]);
        branch.forEach(b=>{
          out[b]=add(out[i], toWorld(Fn, toLocal(Fo, sub(pos[b], pos[i]))));
        });
      });
    });

    const t=tilts(spec, out, ring);
    return { pos:out, ring,
             axial:t.filter(x=>!x.equatorial).map(x=>x.sub),
             equatorial:t.filter(x=>x.equatorial).map(x=>x.sub),
             tilts:t };
  }

  /* Each heavy substituent's angle away from the ring plane — the same
   * measurement check-molecules.js uses to decide axial from equatorial, so a
   * flip's result is stated in the vocabulary the specs already declare in. */
  const EQ_MAX_TILT = 40;
  function tilts(spec, pos, ring){
    ring=ring||ringOf(spec);
    const { n } = plane(pos, ring);
    const inRing=new Set(ring);
    const adj=adjacency(spec);
    const out=[];
    ring.forEach(i=>{
      (adj[i]||[]).forEach(s=>{
        if(inRing.has(s) || spec.atoms[s].el==='H') return;
        const tilt=90-Math.acos(Math.min(1,Math.abs(dot(unit(sub(pos[s],pos[i])), n))))*180/Math.PI;
        out.push({ atom:i, sub:s, tilt, equatorial:tilt<=EQ_MAX_TILT });
      });
    });
    return out;
  }

  /* The signed volume at a stereocentre. Its SIGN is the handedness, and it is
   * what chair/check-chair.js compares before and after: same sign is the same
   * molecule in a new shape, opposite sign is the enantiomer. */
  function chirality(spec, pos, i){
    const adj=adjacency(spec);
    const nb=(adj[i]||[]).slice(0,4);
    if(nb.length<4) return null;
    const [a,b,c2,d]=nb.map(k=>pos[k]);
    return dot(cross(sub(b,a), sub(c2,a)), sub(d,a));
  }
  function stereocentres(spec){
    const adj=adjacency(spec);
    return spec.atoms.map((a,i)=>i)
      .filter(i=>spec.atoms[i].el==='C' && (adj[i]||[]).length===4);
  }

  const API={ flip, tilts, ringOf, plane, chirality, stereocentres, EQ_MAX_TILT };
  if(typeof module!=='undefined' && module.exports) module.exports=API;
  else global.ChairFlip=API;
})(this);
