/* =====================================================================
 *  skel.js — the molecule BUILDER: idealised geometry from VSEPR angles.
 *  Loaded as a classic script BEFORE molecules.js, which cannot build its
 *  Skel-derived specs without it.
 *
 *  This is a library, not data. It knows about tetrahedral centres, ring
 *  normals and bond-length tables; it knows nothing about glucose. Everything
 *  here is reusable across molecules, and that is the test for what belongs:
 *  a fact about ONE molecule goes in that molecule's spec, next to the comment
 *  explaining it.
 *
 *  It lived inside molecules.js until docs/molecule-pipeline.md item 3 pulled
 *  it out. The split is not about line count — it is that the builder is CODE
 *  and the specs are DATA PLUS REASONING, and the two have different rules for
 *  changing. Editing a bond length here silently moves every Skel-built
 *  molecule in the library; editing a spec moves one. Anything that consumes
 *  this is `src:{path:'skel'}` (Skel.prototype.spec stamps it).
 *
 *  IT WORKS IN REAL ÅNGSTRÖMS. GL and AR are measured bond lengths, and every
 *  spec this produces is units:'angstrom' — MolLib.register() applies the
 *  display scale once, as the spec is registered. The builder does not know
 *  what SCALE is, and should not: that is a presentation decision, not a
 *  geometric one. (molecule-pipeline.md item 7)
 * ===================================================================== */
(function(global){
  'use strict';

  // Bond lengths, in real ångströms.
  //
  // These used to be picked one at a time to just clear the display radii
  // (C+C 1.70 · C+O 1.80 · O+H 1.50 · O+P 1.95 · C+H 1.40), which is the
  // hand-written family's rule. It kept every stick visible and was internally
  // fine — this page only ever shows its own specs — but it made C–C and C–O
  // the SAME length when C–O is really the shorter of the two, used one number
  // for both C–O and C=O, and put the whole page at ~0.7× the derived specs.
  // That last one only surfaced when this glucose was put beside alanine and
  // AMP under the words "true relative size" — a scale error is invisible
  // until two families share a frame.
  //
  // Every value below still clears its radii sum by a wide margin (the tightest
  // is O–H at 1.84 against 1.50); check-molecules.js asserts that.
  // REAL ANGSTROMS — the measured values, not display units. The builder works
  // in the units a chemist would quote and MolLib.register() applies the display
  // scale once, when the finished spec is registered. These used to read
  // `1.54*SCALE`: the real number and the display number were the same field,
  // and neither was stated. (molecule-pipeline.md item 7)
  const GL = {
    CC: 1.54,   // C–C single
    CO: 1.43,   // C–O single (hydroxyl, phosphate ester bridge)
    CdO:1.23,   // C=O — and the carboxylate C–O⁻, which is nearly it
    CdC:1.33,   // C=C — a fatty acid's one unsaturation
    OH: 0.97,   // O–H
    CH: 1.09,   // C–H
    CN: 1.47,   // C–N single — an amine, and a nucleoside's glycosidic bond
    OP: 1.60,   // P–O ester (the bridging oxygen)
    PO: 1.50,   // P–O terminal (P=O 1.48 / P–O⁻ 1.51, delocalised)
    // Sulfur, for the one bond coenzyme A exists to make. A THIOESTER is why
    // acetyl-CoA is a carrier at all: C–S is long and weak next to C–O, and
    // sulfur's lone pairs are too diffuse to conjugate into the carbonyl the
    // way an ester's oxygen does — so the acyl group is barely stabilised and
    // gives itself up readily. Drawing it at an ester's 1.43 would throw away
    // the visible half of that.
    CS: 1.82,   // C–S single (thioester, cysteine)
    SH: 1.34,   // S–H thiol
  };
  const TET = 109.5, SP2 = 120;

  const V  = (x,y,z)=>({x,y,z});
  const vadd=(a,b)=>V(a.x+b.x,a.y+b.y,a.z+b.z);
  const vsub=(a,b)=>V(a.x-b.x,a.y-b.y,a.z-b.z);
  const vmul=(a,s)=>V(a.x*s,a.y*s,a.z*s);
  const vlen=a=>Math.hypot(a.x,a.y,a.z);
  const vnorm=a=>{const l=vlen(a)||1;return vmul(a,1/l);};
  const vcross=(a,b)=>V(a.y*b.z-a.z*b.y, a.z*b.x-a.x*b.z, a.x*b.y-a.y*b.x);
  const rad=d=>d*Math.PI/180;

  // ---- Skel: an atoms+bonds accumulator that knows VSEPR ----------------
  // The point of it: you never state a substituent's position, you state which
  // atom it hangs off and how it's hybridised. Directions come out of the
  // geometry already committed, so angles are correct by construction and
  // successive calls on the same atom automatically take the next free slot.
  function Skel(){ this.atoms=[]; this.bonds=[]; }
  Skel.prototype.put=function(el,p){ this.atoms.push({el,pos:[p.x,p.y,p.z]}); return this.atoms.length-1; };
  Skel.prototype.at =function(i){ const p=this.atoms[i].pos; return V(p[0],p[1],p[2]); };
  Skel.prototype.link=function(i,j,order){ this.bonds.push(order?[i,j,order]:[i,j]); return this; };
  Skel.prototype.nbrs=function(i){ const A=this.at(i);
    return this.bonds.filter(b=>b[0]===i||b[1]===i)
      .map(b=>vnorm(vsub(this.at(b[0]===i?b[1]:b[0]),A))); };
  // Set the order of an already-linked pair. Aromatic rings are laid out as a
  // polygon first and given their Kekulé orders after, so the geometry code
  // never has to care which bonds are double.
  Skel.prototype.order=function(i,j,o){
    const b=this.bonds.find(b=>(b[0]===i&&b[1]===j)||(b[0]===j&&b[1]===i));
    if(!b) throw new Error(`order(): no bond ${i}-${j}`);
    b[2]=o; return this;
  };

  // any unit vector perpendicular to `a` (picks a seed axis that isn't parallel)
  function perpTo(a){
    let t=vcross(a,V(0,0,1));
    if(vlen(t)<0.25) t=vcross(a,V(1,0,0));
    return vnorm(t);
  }
  Skel.prototype.centroid=function(){
    return vmul(this.atoms.reduce((s,a)=>vadd(s,V(a.pos[0],a.pos[1],a.pos[2])),V(0,0,0)),
      1/(this.atoms.length||1));
  };
  // When an atom has only ONE bond so far, the correct bond ANGLE still leaves a
  // free rotation about that bond — and picking that azimuth arbitrarily is how a
  // phosphate ends up folded back through the carbon chain it hangs off (the first
  // version of this file did exactly that; check-molecules.js caught it as a
  // 1.5-unit C..O overlap). So: seed the cone so slot 0 points as far as possible
  // AWAY from the centroid of everything already placed. Backbones are always
  // built before their substituents, so "away from the centroid" means "out into
  // open space", and groups splay outward instead of collapsing inward.
  Skel.prototype.outwardAt=function(i,a){
    const away=vsub(this.at(i), this.centroid());
    const t=vsub(away, vmul(a, away.x*a.x+away.y*a.y+away.z*a.z));   // ⊥ component
    return vlen(t)<0.05 ? perpTo(a) : vnorm(t);
  };
  // remaining sp3 bond directions at atom i, each `TET` from every existing bond
  Skel.prototype.freeTet=function(i){
    const nb=this.nbrs(i);
    if(nb.length===0) return [V(0,1,0),V(0,-1,0)];
    if(nb.length===1){
      const a=nb[0], t=this.outwardAt(i,a), u=vnorm(vcross(a,t));
      const c=Math.cos(rad(TET)), s=Math.sin(rad(TET));
      return [0,1,2].map(k=>{ const ph=k*2*Math.PI/3;
        return vnorm(vadd(vmul(a,c), vadd(vmul(t,s*Math.cos(ph)), vmul(u,s*Math.sin(ph))))); });
    }
    if(nb.length===2){
      // the two open slots straddle the plane of the existing pair, opening away
      // from it — the classic axial/equatorial pair on a ring carbon
      const bis=vnorm(vmul(vadd(nb[0],nb[1]),-1)), p=vnorm(vcross(nb[0],nb[1]));
      const h=rad(TET/2), c=Math.cos(h), s=Math.sin(h);
      return [ vnorm(vadd(vmul(bis,c), vmul(p, s))), vnorm(vadd(vmul(bis,c), vmul(p,-s))) ];
    }
    return [ vnorm(vmul(nb.reduce(vadd,V(0,0,0)),-1)) ];   // 3 bonds → one slot left
  };
  // remaining sp2 (trigonal planar, 120°) directions — carbonyl + carboxylate carbons
  Skel.prototype.freeSp2=function(i){
    const nb=this.nbrs(i);
    if(nb.length===1){
      const a=nb[0], t=this.outwardAt(i,a);      // same outward rule as freeTet
      const c=Math.cos(rad(SP2)), s=Math.sin(rad(SP2));
      return [ vnorm(vadd(vmul(a,c), vmul(t,s))), vnorm(vadd(vmul(a,c), vmul(t,-s))) ];
    }
    return [ vnorm(vmul(nb.reduce(vadd,V(0,0,0)),-1)) ];
  };
  // hang one atom off atom i in its next free slot; `hyb` picks the geometry
  Skel.prototype.grow=function(i,el,dist,hyb,slot,order){
    const dirs=(hyb==='sp2'?this.freeSp2(i):this.freeTet(i));
    const j=this.put(el, vadd(this.at(i), vmul(dirs[slot||0], dist)));
    this.link(i,j,order); return j;
  };

  // ---- joining two sub-skeletons ----------------------------------------
  // A molecule with more than one ring system is built as separate Skels and
  // then fitted together: a disaccharide is two pyranoses, a nucleotide is a
  // base plus a furanose. These three do the fitting, and they lived in
  // mol-contrast.js until ATP needed them too — which is this file's own test
  // for what belongs here (a fact about ONE molecule goes in that molecule's
  // spec; a capability every joined molecule needs goes in the builder).
  //
  // The pieces are deliberately small and separate. `alignTo` solves only the
  // two-vector problem, which is underdetermined — carrying u onto w leaves a
  // free spin about w — so `spinAbout` stays a knob the caller sets, rather
  // than a hidden choice. That torsion is a CONFORMATION, and per
  // MolecularGeometry.md §1.6 a floppy one is the caller's to declare
  // schematic, not the builder's to invent.
  const vdot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
  // Rotate v about unit axis k by angle t (Rodrigues).
  const spinAbout=(v,k,t)=>{ const c=Math.cos(t), s=Math.sin(t);
    return vadd(vadd(vmul(v,c), vmul(vcross(k,v),s)), vmul(k, vdot(k,v)*(1-c))); };
  // Minimal rotation carrying unit u onto unit w.
  function alignTo(u,w){
    const d=Math.max(-1,Math.min(1,vdot(u,w)));
    const ax=vcross(u,w);
    if(vlen(ax)<1e-6) return d>0 ? (v=>v) : (v=>spinAbout(v,perpTo(u),Math.PI));
    const k=vnorm(ax), t=Math.acos(d);
    return v=>spinAbout(v,k,t);
  }
  // Copy `src`'s atoms and bonds into `dst`, offsetting every bond index.
  // Returns the offset, so the caller can map a src index onto its new home
  // rather than counting atoms by hand.
  function absorb(dst,src){
    const off=dst.atoms.length;
    src.atoms.forEach(a=>dst.atoms.push({ el:a.el, pos:a.pos.slice() }));
    src.bonds.forEach(b=>dst.bonds.push(b.length>2?[b[0]+off,b[1]+off,b[2]]:[b[0]+off,b[1]+off]));
    return off;
  }
  // Move every atom of `src` so that its atom `anchor` lands on `target`, with
  // its `from` direction carried onto `onto`, then spun by `spin` about `onto`.
  // This is the whole join in one call: the caller says which atom bonds where
  // and which way it points, and never touches a coordinate.
  function fitOnto(src, anchor, from, onto, target, spin){
    const rot=alignTo(from, onto), local=src.at(anchor);
    src.atoms.forEach(at=>{
      const p=spinAbout(rot(vsub(V(at.pos[0],at.pos[1],at.pos[2]), local)), onto, spin||0);
      at.pos=[p.x+target.x, p.y+target.y, p.z+target.z];
    });
    return src;
  }

  // ---- ring stereochemistry ---------------------------------------------
  // freeTet() on a ring carbon returns its AXIAL and EQUATORIAL slots, but in an
  // order that falls out of the cross-product sign, not out of chemistry. Taking
  // slot 0 every time therefore alternates axial/equatorial around the ring — an
  // arbitrary stereoisomer wearing glucose's name. `equatorial()` picks by
  // geometry instead: of the free slots, the one most PERPENDICULAR to the ring
  // axis. β-D-glucopyranose is all-equatorial, which is exactly why it is the
  // most stable hexose and the one the whole pathway is built around.
  Skel.prototype.ringNormal=function(ring){
    const c=vmul(ring.reduce((s,i)=>vadd(s,this.at(i)),V(0,0,0)), 1/ring.length);
    let n=V(0,0,0);
    for(let k=0;k<ring.length;k++)
      n=vadd(n, vcross(vsub(this.at(ring[k]),c), vsub(this.at(ring[(k+1)%ring.length]),c)));
    return vnorm(n);
  };
  Skel.prototype.equatorial=function(i,ring){
    const n=this.ringNormal(ring), dirs=this.freeTet(i);
    let best=0, bestDot=Infinity;
    dirs.forEach((d,k)=>{ const v=Math.abs(d.x*n.x+d.y*n.y+d.z*n.z);
      if(v<bestDot){ bestDot=v; best=k; } });
    return best;
  };
  // The other one. Glucose never needs this; galactose is glucose with C4 axial,
  // and that single flip is the whole difference between a sugar we metabolise
  // and one that poisons an infant who cannot (galactosemia). Defined as "not
  // equatorial" rather than "most parallel to the axis" on purpose: the two
  // free slots on a ring carbon are a pair, so deriving one from the other
  // guarantees they can never both resolve to the same slot.
  Skel.prototype.axial=function(i,ring){
    return this.freeTet(i).length===2 ? 1-this.equatorial(i,ring) : 0;
  };
  // Which FACE of a near-planar ring a substituent points to. A furanose is too
  // flat for the axial/equatorial distinction to mean much — ribose's identity is
  // carried by which side of the ring each –OH sits on. `side` is +1 or −1
  // against the ring normal; the normal's own sign is arbitrary (it falls out of
  // the ring's traversal order), so only the RELATIVE faces are meaningful, and
  // that is exactly what check-molecules.js asserts.
  Skel.prototype.face=function(i,ring,side){
    const n=this.ringNormal(ring), dirs=this.freeTet(i);
    let best=0, bestDot=-Infinity;
    dirs.forEach((d,k)=>{ const v=side*(d.x*n.x+d.y*n.y+d.z*n.z);
      if(v>bestDot){ bestDot=v; best=k; } });
    return best;
  };

  // ---- functional groups ------------------------------------------------
  Skel.prototype.hydroxyl=function(i,slot){                 // –OH
    const o=this.grow(i,'O',GL.CO,'sp3',slot);
    this.grow(o,'H',GL.OH,'sp3',0);                         // C–O–H ≈ 109.5°
    return o;
  };
  Skel.prototype.carbonyl=function(i,slot){                 // C=O (double bond)
    return this.grow(i,'O',GL.CdO,'sp2',slot,2);
  };
  // –O–PO₃²⁻ : a bridging ester O, then a tetrahedral P with three more O's.
  // Returns the P index — the page uses it as the effect anchor, because the P
  // is what visibly arrives from ATP and later leaves for ADP.
  Skel.prototype.phosphate=function(i,slot){
    const o=this.grow(i,'O',GL.CO,'sp3',slot);
    const p=this.grow(o,'P',GL.OP,'sp3',0);
    for(let k=0;k<3;k++) this.grow(p,'O',GL.PO,'sp3',0);
    return p;
  };
  Skel.prototype.rotate=function(rx,ry,rz){
    const cx=Math.cos(rx), sx=Math.sin(rx);
    const cy=Math.cos(ry), sy=Math.sin(ry);
    const cz=Math.cos(rz), sz=Math.sin(rz);
    this.atoms.forEach(a=>{
      let [x,y,z]=a.pos;
      let y1=y*cx-z*sx, z1=y*sx+z*cx;
      let x2=x*cy+z1*sy, z2=-x*sy+z1*cy;
      let x3=x2*cz-y1*sz, y3=x2*sz+y1*cz;
      a.pos=[x3,y3,z2];
    });
    return this;
  };

  // `src:{path:'skel'}` is defaulted rather than written 21 times, and it is
  // the one path that stays true without anyone maintaining it: everything
  // this function returns was, by construction, built by the code above it.
  // `extra` still wins, so a spec that is Skel-built and then post-processed
  // can say so.
  Skel.prototype.spec=function(extra){
    // units:'angstrom' because GL/AR are real — register() scales this once.
    return Object.assign({ atoms:this.atoms, bonds:this.bonds,
      src:{path:'skel'}, units:'angstrom' }, extra);
  };

  // ---- backbone scaffolds ----------------------------------------------
  // Open carbon chain in the textbook orientation: C1 at the TOP, growing down
  // −Y in a zig-zag through the real ~111° chain angle, all carbons in the z=0
  // plane so substituents splay toward the viewer in ±z and the backbone stays
  // readable head-on. Carbons land at indices 0…n−1 = C1…Cn.
  function chainC(n){
    const s=new Skel(), half=rad(111/2);
    const dy=GL.CC*Math.sin(half), dx=GL.CC*Math.cos(half);
    for(let k=0;k<n;k++){
      s.put('C', V((k%2?dx:0)-dx/2, (n-1)*dy/2 - k*dy, 0));
      if(k) s.link(k-1,k);
    }
    return s;
  }
  // β-D-glucopyranose ring: six-membered, O5 at index 0 then C1…C5 at 1…5, laid
  // in the xz-plane with an alternating ±y pucker (the chair — a flat hexagon is
  // as wrong for a pyranose as a linear water is for H₂O). C6 is exocyclic on C5.
  function ringPyranose(){
    const s=new Skel(), R=GL.CC;             // regular hexagon: side = circumradius
    // Pucker is a FRACTION of the ring, not a fixed offset: it was 0.34 when
    // GL.CC was 1.95, and leaving it absolute after the rescale would have
    // flattened the chair toward a hexagon as the ring grew. `equatorial()`
    // picks substituent slots off this pucker, so a flatter ring is not a
    // cosmetic difference — it is what decides which stereoisomer gets built.
    const pucker=0.174*R;
    // THE PUCKER PHASE IS THE HANDEDNESS, and the -z below is what sets it.
    // Ring atoms are laid down in sugar numbering order (O5, C1…C5) around the
    // circle while the chair alternates ±y; whether that traversal runs
    // clockwise or anticlockwise *relative to the alternation* is what makes
    // the result D or L. It was inverted here, so every pyranose in this
    // library was the L-sugar — L-glucose, L-galactose and both disaccharides —
    // until item 5 generated SMILES and compared them against PubChem's
    // beta-D-glucopyranose (CID 64689).
    //
    // Nothing could see it. `stereo:{axial}` / `{faces}` assert RELATIVE
    // patterns, because the ring normal's sign is arbitrary; cod-check.js
    // compares only torsions and ring-plane tilt; and haworth.js re-anchors the
    // normal to the D convention, so the 2D diagrams drew correct D-sugars from
    // mirrored 3D coordinates. A global mirror is invisible to every check that
    // does not reach outside for an ABSOLUTE reference.
    //
    // Do not "tidy" this sign away. Every sugar's committed `smiles` asserts
    // it; re-run tools/spec2smiles.js if you touch this function.
    for(let k=0;k<6;k++){ const th=k*Math.PI/3;
      s.put(k===0?'O':'C', V(R*Math.cos(th), (k%2?pucker:-pucker), -R*Math.sin(th))); }
    for(let k=0;k<6;k++) s.link(k,(k+1)%6);
    return s;
  }
  // β-D-ribofuranose ring: five-membered, O4′ at index 0 then C1′…C4′ at 1…4.
  // Puckered as a C3′-endo envelope — four atoms near-coplanar, one lifted. Real
  // furanoses are never flat, but the pucker here is deliberately SMALL: unlike a
  // pyranose chair, nothing about ribose's identity rides on it (the –OH faces
  // carry that), and a strong pucker would tempt `equatorial()` into reporting
  // an ax/eq split that means nothing on a five-ring. Use `face()` on this ring.
  // WHICH SIGN MEANS "UP" on a furanose. `face()` is defined against
  // ringNormal(), whose sign falls out of this ring's fixed traversal order —
  // arbitrary, but deterministic, so it is a fact to be ESTABLISHED, not
  // assumed. It was assumed once and assumed wrong: +1 builds L-ribose, and the
  // whole contrast pair shipped mirrored (docs/molecule-pipeline.md item 5).
  //
  // Reversing the traversal does not help — that reverses the normal too and
  // every substituent follows it. For a furanose the ONLY thing that mirrors the
  // molecule is swapping these two tags, which is why it lives here as one
  // constant rather than as a literal in each spec that builds a furanose.
  // Asserted by the committed `smiles` on `ribose`, `deoxyribose` and `atpSkel`.
  const FURANOSE_UP = -1, FURANOSE_DOWN = +1;
  function ringFuranose(){
    const s=new Skel(), R=GL.CC/(2*Math.sin(Math.PI/5));   // side → circumradius
    const pucker=0.12*R;
    for(let k=0;k<5;k++){ const th=k*2*Math.PI/5;
      // index 3 is C3′ — the one atom out of the plane (C3′-endo)
      s.put(k===0?'O':'C', V(R*Math.cos(th), k===3?pucker:0, R*Math.sin(th))); }
    for(let k=0;k<5;k++) s.link(k,(k+1)%5);
    return s;
  }
  // ---- aromatic ring systems -------------------------------------------
  // Purine and pyrimidine are FLAT — every ring atom is sp2, and the delocalised
  // π system is what holds them planar. So these are laid out as regular polygons
  // in the xz-plane rather than grown through freeTet(): a tetrahedral builder
  // would pucker them, and a puckered base would break the one claim this pair
  // makes, which is about WIDTH. Two rings vs one is why A–T and G–C are the same
  // width and the DNA backbone stays a constant 2 nm apart.
  //
  // Bond orders below are one Kekulé structure of the aromatic ring. The real
  // molecule is delocalised — no bond is truly single or double — but every
  // textbook draws a Kekulé form, and alternating orders at least keep every
  // atom's valence correct, which a uniform "aromatic" stick would not show.
  // Real angstroms, like GL above.
  const AR = { CC: 1.39, CN: 1.34, CH: 1.08, NH: 1.01 };
  // Regular polygon of `n` sides, side length AR.CC, in the xz-plane.
  function flatRing(n, els){
    const s=new Skel(), R=AR.CC/(2*Math.sin(Math.PI/n));
    for(let k=0;k<n;k++){ const th=k*2*Math.PI/n;
      s.put(els[k], V(R*Math.cos(th), 0, R*Math.sin(th))); }
    for(let k=0;k<n;k++) s.link(k,(k+1)%n);
    return s;
  }
  // Fuse a regular `n`-gon onto the existing edge i–j, coplanar with the ring and
  // opening AWAY from `awayFrom` (the parent ring's centre). Returns the new atom
  // indices in order walking from j round to i. This is how the imidazole gets
  // onto the pyrimidine ring to make a purine — sharing the C4–C5 edge, which is
  // the definition of the fused bicycle.
  // Both rings live in the xz-plane, so this is 2D trigonometry about the y-axis
  // — not a general 3D fuse. Keeping it 2D is the point: a general version would
  // silently tolerate a non-planar purine, which is the one thing that must not
  // happen here.
  function fuseRing(s, n, i, j, awayFrom, els){
    const a=s.at(i), b=s.at(j);
    const mid=vmul(vadd(a,b),0.5);
    const out=vnorm(vsub(mid, awayFrom));            // already in-plane (all y=0)
    const side=vlen(vsub(b,a));
    const apo=side/(2*Math.tan(Math.PI/n));          // centre → edge midpoint
    const c=vadd(mid, vmul(out, apo));               // polygon centre
    const R=side/(2*Math.sin(Math.PI/n));
    const ang=p=>Math.atan2(p.z-c.z, p.x-c.x);
    const thB=ang(b), step=2*Math.PI/n;
    // step in whichever direction walks AWAY from a — i.e. the direction whose
    // first vertex is not a. a and b are adjacent, so one of ±step lands on a.
    const dA=((ang(a)-thB)%(2*Math.PI)+2*Math.PI)%(2*Math.PI);
    const dir=(Math.abs(dA-step)<Math.abs(dA-(2*Math.PI-step))) ? -1 : +1;
    const idx=[];
    for(let k=1;k<=n-2;k++){
      const th=thB+dir*k*step;
      idx.push(s.put(els[k-1], V(c.x+R*Math.cos(th), 0, c.z+R*Math.sin(th))));
    }
    s.link(j, idx[0]);
    for(let k=0;k<idx.length-1;k++) s.link(idx[k], idx[k+1]);
    s.link(idx[idx.length-1], i);
    return idx;
  }
  // Hang an H off a flat ring atom, in the ring plane, bisecting its two
  // neighbours from the outside. Doing this with freeTet() would push the H out
  // of the plane and make the ring look puckered when it is not.
  function flatH(s, i, dist){
    const dir=vnorm(vmul(s.nbrs(i).reduce(vadd,V(0,0,0)),-1));
    const h=s.put('H', vadd(s.at(i), vmul(dir, dist)));
    s.link(i,h);
    return h;
  }

  // ---- nucleotide fragments ---------------------------------------------
  // Three pieces every nucleotide in the catalog is made of — adenine, the
  // β-D-ribofuranosyl it hangs on, and one link of a phosphate chain. They were
  // written inline for `atpSkel`, copied for `nadhSkel`, and thirteen more rows
  // of the molecule catalog (ADP, AMP, NAD⁺, NADP⁺, FAD, cAMP, dAMP, CoA…) are
  // the same three pieces again. That is this file's own test for what belongs
  // here: a fact about ONE molecule goes in that molecule's spec, a capability
  // every joined molecule needs goes in the builder.
  //
  // ATOM ORDER IS PART OF THE CONTRACT. `flat2d` is positional, `optH` and the
  // `gly`/`pep` index maps address atoms by number, and a spec's committed
  // `smiles` was generated from a particular ordering. So these emit atoms in
  // exactly the order the inline versions did, and the specs that moved onto
  // them are byte-identical — which is the only acceptable outcome of a
  // refactor like this.

  // Adenine: a flat six-ring with an imidazole fused across C4–C5, plus the
  // 6-amino that makes it adenine rather than purine. Same construction as
  // `purine` in mol-contrast.js, and flat for the same reason — a base is
  // planar, and a tetrahedral builder would pucker it.
  // Indices: 0…5 = N1 C2 N3 C4 C5 C6, then N7 C8 N9. Returns the N9 that bonds
  // to a sugar's anomeric carbon.
  function adenine(){
    const a = flatRing(6, ['N','C','N','C','C','C']);
    const five = fuseRing(a, 5, 3, 4, V(0,0,0), ['N','C','N']);   // N7 C8 N9
    const n7 = five[0], c8 = five[1], n9 = five[2];
    // One Kekulé structure. The real ring is delocalised, but alternating
    // orders keep every atom's valence right, which a uniform stick would not
    // (see the note on AR above).  N1=C2 · N3=C4 · C5=C6 · N7=C8
    a.order(0,1,2).order(2,3,2).order(4,5,2).order(n7,c8,2);
    // the 6-amino, grown in the ring plane at the aromatic C–N length: it is
    // conjugated into the ring and not free to rotate out of it. Placed like
    // flatH — bisecting C6's two neighbours from outside — so it cannot tip the
    // base out of planarity.
    const n6 = (()=>{
      const dir = vnorm(vmul(a.nbrs(5).reduce(vadd, V(0,0,0)), -1));
      const j = a.put('N', vadd(a.at(5), vmul(dir, AR.CN)));
      a.link(5, j); return j;
    })();
    flatH(a, 1, AR.CH);            // H2
    flatH(a, c8, AR.CH);           // H8
    // the amine's two H, in the plane, splayed off the C6–N bond
    {
      const back = vnorm(vsub(a.at(5), a.at(n6)));
      const side = vnorm(V(-back.z, 0, back.x));      // in-plane perpendicular
      const c = Math.cos(Math.PI/3), sn = Math.sin(Math.PI/3);
      [1,-1].forEach(k=>{
        const d = vnorm(vadd(vmul(back,-c), vmul(side, k*sn)));
        const h = a.put('H', vadd(a.at(n6), vmul(d, AR.NH)));
        a.link(n6, h);
      });
    }
    return { s:a, n9, n6 };
  }

  // β-D-ribofuranosyl: the ring, its 2′/3′ hydroxyls and the 5′ carbon a
  // phosphate hangs off — everything a nucleotide's sugar carries except the
  // base itself.
  //
  // STEREOCHEMISTRY IS THE WHOLE RISK AND IT IS ALL HERE. The identity of
  // β-D-ribofuranose is which FACE of the near-flat ring each substituent sits
  // on; a five-ring is too flat for axial/equatorial to mean anything (`face`
  // above). Base UP at C1′, –OH DOWN at C2′ and C3′, C5′ UP at C4′ — and
  // FURANOSE_UP is NOT +1 by inspection, see its note. Getting it backwards
  // builds L-ribose, which has every bond length, every angle and every pixel
  // of the real thing; only tools/check-handedness.js can tell you.
  //
  // `baseDir`/`basePos` RESERVE C1′'s β slot rather than growing an atom there:
  // what goes there is the far side of a ring system built elsewhere. Nothing
  // occupies the slot until the caller links it, and freeTet() reports what is
  // free rather than what is spoken for — so grow C1′'s hydrogen only AFTER
  // that bond exists, or the two land on top of each other.
  function ribosyl(){
    const s = ringFuranose();
    const ring = [0,1,2,3,4];              // O4′, C1′, C2′, C3′, C4′
    const c1 = 1, c2 = 2, c3 = 3, c4 = 4;
    const baseDir = s.freeTet(c1)[s.face(c1, ring, FURANOSE_UP)];
    const basePos = vadd(s.at(c1), vmul(baseDir, GL.CN));
    const o2 = s.hydroxyl(c2, s.face(c2, ring, FURANOSE_DOWN));
    const o3 = s.hydroxyl(c3, s.face(c3, ring, FURANOSE_DOWN));
    const c5 = s.grow(c4, 'C', GL.CC, 'sp3', s.face(c4, ring, FURANOSE_UP));
    return { s, ring, c1, c2, c3, c4, c5, o2, o3, baseDir, basePos };
  }

  // One phosphorus of a chain, grown onto the bridging oxygen `o`.
  //
  // EVERY SLOT HERE IS 0, and that is not laziness: freeTet() returns the slots
  // still FREE, so the numbering shifts down after each grow, and asking for
  // slot 2 on a phosphorus that already has three bonds reads past the end of a
  // one-element list.
  //
  // AND THE BRIDGE IS GROWN BEFORE THE TERMINAL OXYGENS. Slot 0 is seeded to
  // point away from everything placed so far (`outwardAt`), so the bridge takes
  // the outward direction and the chain EXTENDS. Grow the terminal oxygens
  // first and the next phosphate folds back over the sugar it just came off —
  // which is what the first version of this library actually did.
  //
  //   terminal:true  no bridge, three terminal oxygens (ATP's γ)
  //   acid:true      each single-bonded O gets its H (the neutral molecule);
  //                  otherwise it is left as O⁻ (the physiological anion)
  Skel.prototype.phosphoUnit = function(o, opts){
    opts = opts || {};
    const p = this.grow(o, 'P', GL.OP, 'sp3', 0);
    const bridge = opts.terminal ? null : this.grow(p, 'O', GL.OP, 'sp3', 0);
    const oxy = [ this.grow(p, 'O', GL.PO, 'sp3', 0, 2) ];        // P=O
    for(let k = 0; k < (opts.terminal ? 2 : 1); k++){
      const x = this.grow(p, 'O', GL.PO, 'sp3', 0);
      oxy.push(x);
      if(opts.acid) this.grow(x, 'H', GL.OH, 'sp3', 0);
    }
    return { p, bridge, oxy };
  };

  global.SkelLib = { GL, AR, TET, SP2, V, vadd, vsub, vmul, vlen, vnorm, vcross, rad,
    perpTo, vdot, spinAbout, alignTo, absorb, fitOnto,
    FURANOSE_UP, FURANOSE_DOWN,
    Skel, chainC, ringPyranose, ringFuranose, flatRing, fuseRing, flatH,
    adenine, ribosyl };
})(this);
