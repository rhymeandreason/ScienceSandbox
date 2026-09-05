/* =============================================================================
 *  molview.js — three views of one molecule, and the morph between them
 * =============================================================================
 *  Loaded as a classic script AFTER scene.js. Exposes window.MolView.
 *  Optional: smiles-drawer, for the Diagram view only.
 *
 *  WHAT THIS OWNS: how one molecule is SHOWN — the model, the flat layout, the
 *  drawing, and the fact that the first two are the same spheres in different
 *  places. Nothing here knows what a molecule MEANS. Which molecules a page
 *  shelves, what its notes say, which atoms are "the working end", whether there
 *  is a second derivation to switch to — all of that is the lesson, and stays in
 *  the page (Modules.md: share the plumbing, not the physics).
 *
 *  THREE VIEWS, and the difference between them is the point.
 *
 *  3D ......... the molecule. Real coordinates, free to turn.  Reads spec.atoms.
 *  2D ......... THE SAME SPHERES, MOVED. Every atom slides from where it really
 *               is to where a structural diagram would put it, and the bonds
 *               stretch to follow. Nothing is added and nothing is swapped — it
 *               is one continuous object the whole way, which is the only thing
 *               that can honestly say "the diagram and the model are the same
 *               molecule".  Reads spec.flat2d (tools/bake-flat2d.js).
 *  Diagram .... the drawing proper. SmilesDrawer over the spec's generated
 *               `smiles`, with labels, ring circles and stereo wedges — the
 *               things a diagram has and a pile of spheres cannot.
 *
 *  A PROJECTION of the 3D coordinates was tried first for the flat view, and it
 *  was wrong. A projection cannot untangle a molecule: ATP's phosphate tail
 *  genuinely folds back over its own ribose in the PubChem conformer, so
 *  flattening lands one on top of the other however you turn it. Hence the move:
 *  the atoms are relocated, not re-photographed, and the caller's caption should
 *  say so.
 *
 *  What every flat view gives up: the ANGLES AND DISTANCES ARE NOT THE
 *  MOLECULE'S. Bond LENGTHS are, near enough — bake-flat2d.js scales the layout
 *  to the molecule's own mean bond — which is what keeps the transition reading
 *  as a rearrangement rather than a zoom.
 *
 *  A VIEW IS WHICH SPEC FIELD IS DRAWN: atoms / flat2d / smiles (VIEW_FIELD
 *  below). A spec missing the field must degrade VISIBLY — `has(view)` answers
 *  that, the flat host says "no drawing yet" in words, and a molecule with no
 *  flat2d simply stays where it is rather than silently pretending to lay down.
 *
 *  Usage:
 *    const v = MolView.create({ canvas, camera, applyCam, root,
 *                               flatHost: document.getElementById('flat'),
 *                               usable: MolView.usableAround(canvas, {...}),
 *                               focusAtoms: spec => spec.gly.gamma });
 *    v.show(spec);  v.setMode('2d');  v.setHighlight(true);  v.setSpin(true);
 *    (in the render loop, before renderer.render)  v.step();
 *    (in a ResizeObserver on the canvas)           v.fit();
 *
 *  The caller keeps its own camera. This module only writes the ORTHOGRAPHIC
 *  frustum half-height, because that is the framing and the framing eases with
 *  the morph — see halfFor().
 * ========================================================================== */
(function(global){
'use strict';
const THREE=global.THREE;

/* view -> the spec field it reads, and the module that turns it into pixels.
 * Missing field = that view is unavailable for that molecule, which is a fact
 * worth showing rather than hiding. Pages quote this rather than keeping their
 * own copy: a lookup table in a page is a claim nothing checks. */
const VIEW_FIELD={
  '3d':      { field:'atoms',  via:'Stage.buildMolecule', what:'ball-and-stick model' },
  '2d':      { field:'flat2d', via:'Stage.buildMolecule + flat2d',
               what:'flat layout, atoms moved' },
  'diagram': { field:'smiles', via:'SmilesDrawer (atomVisualization:\'allballs\')',
               what:'structural diagram' },
};

/* ---------- the flat drawing's ink ----------
 * Atom colours are MolPalette's, so an oxygen is the same red in both views and
 * the orange phosphorus still reads as "the energy currency" (palette.js). Only
 * the bond ink is ours, because a bond's colour in a lesson is a claim about the
 * bond, and a structural diagram makes no such claim. */
const FLAT_INK='#3d3730';
// The disc behind a highlighted atom. Warm and light: it has to read as a
// spotlight under the element colours, never as another element.
const FLAT_HL='#f3dca0';
// Dim to grey in place, contrast-lab.html's treatment and for its reason: the
// point is "this part of a molecule you can still see all of", so hiding the
// rest would leave a phosphate floating in space with nothing to be the end of.
// A neutral grey, because a warm one leaves dimmed oxygens reading as pink.
const GREY=new THREE.Color(0x8d8a86);

function flatColors(){
  const A=global.MolLib.PALETTE.atoms, hx=n=>'#'+n.toString(16).padStart(6,'0');
  const t={ BACKGROUND:'#00000000', BOND:FLAT_INK };
  for(const el of ['C','O','N','P','S','H']) if(A[el]!=null) t[el]=hx(A[el]);
  return t;
}

/* SmilesDrawer emits a SQUARE viewBox whatever size it was asked for, so a
 * molecule as wide as ATP arrives letterboxed into a sliver. Re-fit the viewBox
 * to what was actually drawn — measured, since the extent depends on how the
 * layout engine folded this particular molecule. */
function fitSvg(svg){
  let bb; try{ bb=svg.getBBox(); }catch(e){ return; }
  if(!bb||!bb.width||!bb.height) return;
  const pad=12;
  svg.setAttribute('viewBox',`${bb.x-pad} ${bb.y-pad} ${bb.width+pad*2} ${bb.height+pad*2}`);
  svg.removeAttribute('width'); svg.removeAttribute('height');
  svg.setAttribute('preserveAspectRatio','xMidYMid meet');
  svg.style.width='100%'; svg.style.height='100%';
}

/* ---------- the opening pose ----------
 * A SPEC THAT DECLARES `view:` HAS ALREADY ANSWERED THIS. Its author picked an
 * angle, every other page renders it at that angle, and the group's rotation is
 * therefore ZERO at rest — which is exactly how contrast-lab.html holds its
 * pairs ("0 at rest — the spec's own orientation") and what makes its own
 * paste-VIEW readout round-trip. This module matches it, for the same reason
 * and one more: viewEuler() is only worth pasting if pasting it back reproduces
 * the picture, and PCA composed on top of the baked view would mean a number
 * that never came true.
 *
 * EVERY path that puts a molecule on screen goes through here — show(), the
 * derivation switch, resetPose() — so a declared view is used because there is
 * nowhere else for an angle to come from, not because something checks after
 * the fact. flatPose below is the fallback for a spec with no `view:`.
 */
function viewQ(spec){
  const q=new THREE.Quaternion();
  if(spec&&spec.view) q.setFromEuler(new THREE.Euler(
    spec.view[0]||0, spec.view[1]||0, spec.view[2]||0, 'ZYX'));
  return q;
}
function defaultView(spec){
  // A spec that declares `view:` HAS a default view, and Stage.buildMolecule has
  // already baked it into the meshes — so the pose that shows it is IDENTITY.
  // Returning that here, by name, is the whole mechanism: there is no second
  // place a default angle can come from, and nothing to remember to call.
  return spec.view ? new THREE.Quaternion() : flatPose(spec);
}

/* ---------- flatPose: an opening angle for a spec that declares none ----------
 * PCA over the heavy atoms: the two directions the molecule is widest in become
 * screen X and Y, so the least of it is pointing at you. This is the MODEL's
 * resting attitude, not the flat view — a dinucleotide dropped in at whatever
 * angle its PubChem conformer happens to carry reads as a tangle. Heavy atoms
 * only, and for the same reason Stage.measure counts only heavy atoms —
 * hydroxyl hydrogens are free rotors, so including them measures how the spec
 * happens to have been drawn rather than how the molecule is shaped.
 *
 * The basis MUST stay right-handed (e3 = e1 × e2). Flipping one axis to
 * "tidy up" the framing is a REFLECTION, and a reflection turns the molecule
 * into its mirror image while leaving every bond length, every angle and the
 * render identical (MolecularGeometry.md §1.3). It is exactly the bug that cost
 * this repo months of wrong sugars, and a viewer is the last place to
 * reintroduce it — nothing downstream would catch it here.
 */
function flatPose(spec){
  const pts=spec.atoms.filter(a=>a.el!=='H').map(a=>a.pos);
  const c=[0,1,2].map(k=>pts.reduce((s,p)=>s+p[k],0)/pts.length);
  const C=[[0,0,0],[0,0,0],[0,0,0]];
  pts.forEach(p=>{ const d=[p[0]-c[0],p[1]-c[1],p[2]-c[2]];
    for(let i=0;i<3;i++) for(let j=0;j<3;j++) C[i][j]+=d[i]*d[j]; });
  const mul=(M,v)=>[0,1,2].map(i=>M[i][0]*v[0]+M[i][1]*v[1]+M[i][2]*v[2]);
  const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const unit=v=>{ const l=Math.hypot(...v)||1; return v.map(x=>x/l); };
  // power iteration, deflating after each axis — three eigenvectors is small
  // enough that a full solver would be more code than it is worth
  const axis=(M,seed)=>{ let v=unit(seed);
    for(let k=0;k<80;k++) v=unit(mul(M,v)); return v; };
  const e1=axis(C,[1,0.3,0.1]);
  // deflate e1 out, then the next-widest direction is the leading eigenvector
  const D=C.map((row,i)=>row.map((x,j)=>x-dot(mul(C,e1),e1)*e1[i]*e1[j]));
  let e2=axis(D,[0.2,1,0.4]);
  e2=unit(e2.map((x,i)=>x-dot(e2,e1)*e1[i]));          // re-orthogonalise
  const e3=[e1[1]*e2[2]-e1[2]*e2[1],                   // right-handed, always
            e1[2]*e2[0]-e1[0]*e2[2],
            e1[0]*e2[1]-e1[1]*e2[0]];
  // rows e1,e2,e3 — the rotation that sends the molecule's own axes to screen
  const M=new THREE.Matrix4().set(e1[0],e1[1],e1[2],0,
                                  e2[0],e2[1],e2[2],0,
                                  e3[0],e3[1],e3[2],0,
                                  0,0,0,1);
  return new THREE.Quaternion().setFromRotationMatrix(M);
}

/* How much of the canvas the molecule may actually use, given the panels lying
 * over it. The rails, the card strip and the caption are all over the stage, so
 * the full frustum is not the full picture — and a flat layout is nearly three
 * times as wide as its model, which is exactly when it starts sliding under
 * them. MEASURED, not assumed: panels are sized in CSS and by their own text, so
 * a constant would be right at one window size and one copy length.
 *
 * Returns a function, because it must be re-measured on every fit.
 *   MolView.usableAround(canvas, {left:[el],right:[el],top:[el],bottom:[el]})
 * An element that CSS has taken off the stage (`position:static`, i.e. the
 * narrow media query stacked it) stops reserving room, automatically. */
function usableAround(canvas, sides, gap=18){
  const list=s=>[].concat(sides[s]||[]).filter(Boolean);
  const onStage=el=>getComputedStyle(el).position!=='static';
  return ()=>{
    const r=canvas.getBoundingClientRect();
    if(!r.width||!r.height) return {fw:1,fh:1};
    const edge=(s,f)=>list(s).filter(onStage)
      .reduce((mx,el)=>Math.max(mx, f(el.getBoundingClientRect(), r)+gap), 0);
    const l =edge('left',  (b,r)=>b.right - r.left);
    const rt=edge('right', (b,r)=>r.right - b.left);
    const t =edge('top',   (b,r)=>b.bottom - r.top);
    const bo=edge('bottom',(b,r)=>r.bottom - b.top);
    return { fw:Math.max(0.25, (r.width-l-rt)/r.width),
             fh:Math.max(0.25, (r.height-t-bo)/r.height) };
  };
}

function create(opt){
  const Stage=global.Stage, MolLib=global.MolLib;
  const canvas=opt.canvas, camera=opt.camera, root=opt.root;
  const applyCam=opt.applyCam||(()=>{});
  const flatHost=opt.flatHost||null;
  const usable=opt.usable||(()=>({fw:1,fh:1}));
  const focusAtoms=opt.focusAtoms||(()=>[]);
  // The turntable's SPEED. Whether it runs at all is `spinning` below, which a
  // caller drives from a control — see setSpin().
  const spinRate=opt.spinRate==null?0.0035:opt.spinRate;
  const dragEnabled=opt.drag!==false;
  const noFlatMsg=opt.noFlatMessage||'No flat drawing for this molecule yet.';

  /* ---------- state ----------
   * `morph` is the whole flat view: 0 = the atoms where they really are, 1 = the
   * atoms on the diagram's layout, and every value between is a frame of the
   * transition. There is no second model and no swap — 2D is this number
   * reaching 1, which is what makes the two views provably one molecule. */
  let spec=null, built=null;
  let mode='3d';
  let showH=false, showFocus=false;
  // OFF unless the caller asks. A spec that declares `view:` has stated the
  // angle it should be seen at, and a page that drifts off it on load shows
  // that angle for about a second — so the resting state is rest, and the spin
  // is something you turn on to look around. It used to run until your first
  // drag, back when the opening pose was a PCA guess nobody had committed to.
  let spinning=opt.spin===true;
  const pose=new THREE.Quaternion();  // the model's own attitude, only 3D changes it
  let morph=0, morphTo=0;             // 0 = model, 1 = laid flat
  let home=[], target=[];             // per atom: where it is, where the layout wants it
  let perp0=[];                       // per double bond: its original offset direction
  let halfNow=0, halfTo=0;            // the ortho frustum, eased with the morph
  let dragging=false, last=null;
  const flatOf=m=>m==='3d'?0:1;
  // A spec with no flat2d cannot lie down. Sending it to a layout it does not
  // have would collapse it onto its own model coordinates and read as "this
  // molecule's diagram looks exactly like its model", which is a lie.
  const canFlat=()=>!!(spec&&spec.flat2d&&spec.flat2d.length);

  /* ---------- where every atom goes ----------
   * `flat2d` is heavy atoms only, in spec order, in real ångströms — so we apply
   * SCALE (register() leaves the field alone) and walk the spec's atom list in
   * step with it. A hydrogen has no place in the layout, so it is sent to the
   * heavy atom it hangs on: on the way out it folds in and disappears, and on the
   * way back it grows out again. That reads as "the diagram doesn't draw these",
   * which is true, rather than as atoms being deleted. */
  function layout(){
    const S=MolLib.SCALE||1.9, F=spec.flat2d||[];
    const adj=spec.atoms.map(()=>[]);
    (spec.bonds||[]).forEach(([i,j])=>{ adj[i].push(j); adj[j].push(i); });
    let k=0; const flatIdx=spec.atoms.map(a=>a.el==='H'?-1:k++);
    const at=i=>F[flatIdx[i]] ? new THREE.Vector3(F[flatIdx[i]][0]*S, F[flatIdx[i]][1]*S, 0) : null;
    home=built.userData.atomMeshes.map(m=>m.position.clone());
    target=spec.atoms.map((a,i)=>{
      if(a.el!=='H') return at(i)||home[i].clone();
      const parent=adj[i].find(j=>spec.atoms[j].el!=='H');
      return (parent!=null && at(parent)) || home[i].clone();
    });
    // setOptionalH() owns the C–H sticks' visibility; record its verdict so
    // applyMorph does not switch a hidden one back on next frame.
    markHidden();
    // A double bond is a Group of two sticks offset along a perpendicular that
    // scene.js chose from a neighbouring bond, and placeBond() refuses to move
    // one because that plane cannot be recovered from two endpoints. It can be
    // recovered HERE, because this module knows where the molecule is going:
    // flat in XY, where the only sensible offset is in the plane of the page. So
    // the original perpendicular is recorded now and eased toward that one.
    //
    // AND THE GROUP HAS ITS OWN TRANSFORM. buildMolecule centres the molecule by
    // shifting every direct child, so each double-bond group carries
    // position = -center (and `spec.view`'s rotation, where a spec has one) while
    // its two sticks keep the coordinates they were built at. Its children
    // therefore live in the GROUP's frame, not the molecule's — placing them at
    // molecule-space coordinates puts every double bond off by exactly the
    // centring offset, which reads as sticks floating away from their spheres. So
    // the group's transform is flattened to the identity ONCE, here, and its
    // children are addressed in the molecule's frame from then on.
    perp0=built.userData.bondMeshes.map(b=>{
      if(!b.isGroup) return null;
      const v=new THREE.Vector3().subVectors(b.children[1].position, b.children[0].position)
        .applyQuaternion(b.quaternion);          // into the molecule's frame...
      b.children.forEach(c=>{ c.position.applyQuaternion(b.quaternion).add(b.position);
                              c.quaternion.premultiply(b.quaternion); });
      b.position.set(0,0,0); b.quaternion.identity();   // ...and now the group is a no-op
      return v.lengthSq()>1e-9 ? v.normalize() : new THREE.Vector3(0,0,1);
    });
  }
  function markHidden(){
    const opt=new Set(spec.optH||[]);
    built.userData.bondMeshes.forEach(bm=>{
      bm.userData.hiddenByH = !showH && bm.userData.pair.some(p=>opt.has(p)); });
  }

  /* ---------- draw the current frame of the morph ----------
   * Bonds are re-placed rather than rebuilt: rebuilding 45 sticks' geometries and
   * materials at 60Hz is the churn scene.js's placeBond note warns about. */
  const _a=new THREE.Vector3(), _b=new THREE.Vector3(), _d=new THREE.Vector3(),
        _p=new THREE.Vector3(), _z=new THREE.Vector3(0,0,1), _up=new THREE.Vector3(0,1,0);
  function applyMorph(t){
    if(!built) return;
    built.userData.atomMeshes.forEach((m,i)=>{
      if(!m) return;
      m.position.lerpVectors(home[i], target[i], t);
      if(spec.atoms[i].el==='H'){
        // shrink as it folds in, and stop drawing it once it is inside its parent
        const k=1-t;
        m.scale.setScalar(Math.max(k,0.001));
        if(t>=1) m.visible=false;
        else if(!spec.optH || !spec.optH.includes(i) || showH) m.visible=true;
      }
    });
    built.userData.bondMeshes.forEach((bm,n)=>{
      const [i,j]=bm.userData.pair;
      _a.copy(built.userData.atomMeshes[i].position);
      _b.copy(built.userData.atomMeshes[j].position);
      _d.subVectors(_b,_a);
      const len=_d.length();
      if(len<1e-6){ bm.visible=false; return; }
      if(!bm.userData.hiddenByH) bm.visible=true;
      if(!bm.isGroup){ Stage.placeBond(bm,_a,_b); return; }
      // ease the pair's offset from where scene.js put it to the flat plane
      _p.crossVectors(_d,_z);
      if(_p.lengthSq()<1e-6) _p.copy(perp0[n]); else _p.normalize();
      if(_p.dot(perp0[n])<0) _p.negate();
      _p.lerp(perp0[n],1-t).normalize();
      _d.normalize();
      bm.children.forEach((c,side)=>{
        const off=(side?1:-1)*0.15;
        c.position.copy(_a).addScaledVector(_d,len/2).addScaledVector(_p,off);
        c.quaternion.setFromUnitVectors(_up,_d);
        const base=c.geometry.parameters && c.geometry.parameters.height;
        if(base) c.scale.y=len/base;
      });
    });
  }

  /* ---------- highlight ----------
   * One toggle, every view, from ONE atom list — two views of a molecule
   * disagreeing about which part matters is the confusion this module exists to
   * remove. In the model the rest dims to grey in place; in the diagram the
   * highlight travels INSIDE the SMILES string as atom-map class 1 (`[P:1]`),
   * put there by tools/spec2smiles.js from the same list. Nothing is pasted in
   * here and nothing is re-derived. */
  function applyFocus(){
    if(!built) return;
    const set=new Set(showFocus?(focusAtoms(spec)||[]):[]);
    const paint=(m,on)=>{
      m.traverse(o=>{
        if(!o.isMesh||!o.material) return;
        const base=o.userData.baseColor; if(base===undefined) return;
        o.material.color.setHex(base);
        if(showFocus&&!on) o.material.color.lerp(GREY,0.9);
        if(o.material.emissive){
          o.material.emissive.setHex(showFocus&&on?base:0x000000);
          o.material.emissiveIntensity=showFocus&&on?0.45:0;
        }
      });
    };
    built.userData.atomMeshes.forEach((m,i)=>{ if(m) paint(m,set.has(i)); });
    // a bond is in the focus only if BOTH ends are — one end in would light the
    // stick reaching out of the group and make it look larger than it is
    built.userData.bondMeshes.forEach(m=>paint(m,m.userData.pair.every(p=>set.has(p))));
  }

  /* ---------- the drawing ----------
   * `atomVisualization:'allballs'` is what makes this look like the model rather
   * than a line skeleton: every atom gets a disc, including the carbons a
   * skeletal drawing leaves as bare vertices — which is the point, since a page
   * counting atoms in its rail is asking the student to count them here. */
  function paintFlat(){
    if(!flatHost) return;
    flatHost.innerHTML='';
    if(!spec||!spec.smiles||typeof global.SmilesDrawer==='undefined'){
      flatHost.innerHTML=`<div class="fnone">${noFlatMsg}</div>`;
      return;
    }
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    flatHost.appendChild(svg);
    try{
      global.SmilesDrawer.parse(spec.smiles, tree=>{
        new global.SmilesDrawer.SvgDrawer({
          width:1100, height:620,
          // 'allballs', not 'balls': 'balls' only draws a disc where there is a
          // LABEL, which leaves every carbon as a bare vertex.
          atomVisualization:'allballs',
          bondThickness:1.4, terminalCarbons:true, compactDrawing:false,
          themes:{ light:flatColors() },
        }).draw(tree, svg, 'light', null, false, showFocus?[[1,FLAT_HL]]:[]);
        fitSvg(svg);
      }, ()=>{ flatHost.innerHTML=''; });
    }catch(e){ flatHost.innerHTML=''; }
  }

  /* ---------- framing ----------
   * Two fits, eased together with the morph, so the molecule never jumps size at
   * the moment it is trying to show you that it is the same object. The 3D fit is
   * the full 3D radius (the model is free to turn, and fitting the current
   * silhouette would let a turn push the far end out of frame); the flat fit is
   * the layout's own box, which is much wider and much shorter. */
  function halfFor(m){
    if(!spec) return halfNow||1;
    const pad=1.06, asp=camera.aspect||1, u=usable();
    let hw, hh;
    if(m==='3d'||!canFlat()){
      hw=hh=Stage.measure(spec).radius;
    } else {
      const S=MolLib.SCALE||1.9, R=MolLib.PALETTE.radii;
      const keep=spec.atoms.map((a,i)=>i).filter(i=>spec.atoms[i].el!=='H');
      hw=hh=0;
      spec.flat2d.forEach((p,k)=>{ const r=R[spec.atoms[keep[k]].el]||0.7;
        hw=Math.max(hw, Math.abs(p[0])*S+r); hh=Math.max(hh, Math.abs(p[1])*S+r); });
    }
    return Math.max(hh/u.fh, hw/(asp*u.fw))*pad;
  }
  function applyHalf(){
    camera.top=halfNow; camera.bottom=-halfNow;
    camera.left=-halfNow*camera.aspect; camera.right=halfNow*camera.aspect;
    camera.updateProjectionMatrix();
  }
  function fit(){ halfTo=halfFor(mode); halfNow=halfTo; applyHalf(); applyCam(); }

  /* ---------- build ---------- */
  function show(next, o={}){
    // keepPose preserves what is ON SCREEN, not the group's quaternion. Two
    // derivations of one molecule can declare different `view:` — atpSkel does
    // and atp does not — and each is baked into its own meshes, so carrying the
    // group rotation across would carry the pose and CHANGE the picture, which
    // is the one thing a derivation cut must not do. Solve for the pose that
    // leaves pose ∘ view where it was.
    const keep=o.keepPose?pose.clone().multiply(viewQ(spec)):null;
    if(built){ root.remove(built); built=null; }
    spec=next;
    built=Stage.buildMolecule(spec,{center:true});
    // baseColor is what applyFocus() restores to; scene.js does not record it,
    // and reading material.color instead would remember whatever the last dim
    // left behind.
    built.traverse(x=>{ if(x.isMesh&&x.material&&x.userData.baseColor===undefined)
      x.userData.baseColor=x.material.color.getHex(); });
    root.add(built);
    Stage.setOptionalH(built,showH);
    layout();
    // Start facing you. A dinucleotide dropped in at whatever attitude its
    // PubChem conformer happens to carry reads as a tangle; its own widest plane
    // is the one pose that is about the molecule rather than about the record.
    pose.copy(keep ? keep.multiply(viewQ(spec).invert()) : defaultView(spec));
    snap();
    applyFocus(); paintFlat();
  }
  // Land on the current view immediately — no transition. Used on build, and by
  // a caller cutting between two derivations of one molecule.
  function snap(){
    morph=morphTo=canFlat()?flatOf(mode):0;
    halfNow=halfTo=halfFor(mode); applyHalf();
    built.quaternion.copy(morph>=1?IDENT:pose);
    applyMorph(morph);
  }

  /* ---------- view switch ---------- */
  function setMode(next){
    if(next===mode||!VIEW_FIELD[next]) return;
    mode=next;
    // Both flat views ride the SAME morph. Coming from 3D you watch the molecule
    // lie down either way; the only difference is that Diagram then hands over to
    // the drawing once it has arrived, so 2D and Diagram are the same layout with
    // and without its labels — switching between them swaps nothing but the ink.
    morphTo=canFlat()?flatOf(mode):0;
    halfTo=halfFor(mode);
  }

  /* ---------- drag turns the MODEL ----------
   * 3D only. A flat layout you can tilt is not a layout, and the promise that
   * the angles are not the molecule's would stop being legible the moment it
   * started turning in space. The camera never moves: turning the model is what
   * lets the flat view be a lock rather than a suggestion, and keeps the lighting
   * rig (parented to the camera in scene.js) fixed so highlights stay put. */
  if(dragEnabled){
    canvas.addEventListener('pointerdown',e=>{
      if(mode!=='3d') return; dragging=true; last=[e.clientX,e.clientY];
      canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove',e=>{
      if(!dragging) return;
      const dx=(e.clientX-last[0])*0.01, dy=(e.clientY-last[1])*0.01;
      last=[e.clientX,e.clientY];
      // Turned about the CAMERA's axes, not the model's, so a drag right always
      // sends the near face right no matter how far it has already been turned.
      pose.premultiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(dy,dx,0,'XYZ')));
    });
    const stop=()=>{ dragging=false; };
    canvas.addEventListener('pointerup',stop);
    canvas.addEventListener('pointercancel',stop);
  }

  /* ---------- one frame ---------- */
  const IDENT=new THREE.Quaternion(), _q=new THREE.Quaternion();
  function step(){
    if(morph!==morphTo){
      const s=0.055;
      morph += Math.sign(morphTo-morph)*Math.min(s, Math.abs(morphTo-morph));
      if(Math.abs(morph-morphTo)<1e-4) morph=morphTo;
    }
    const ease=morph<0.5 ? 2*morph*morph : 1-Math.pow(-2*morph+2,2)/2;
    if(built){
      if(morph>0||morphTo>0){
        // Standing the molecule up is part of lying it down: the layout is in the
        // XY plane, so the model's own attitude has to reach identity by the time
        // the atoms arrive, or a finished flat layout would still be tilted in
        // space. Eased by the same curve, so both finish together.
        //
        // Two steps, and a scratch quaternion rather than a fresh one per frame:
        // three r128's slerpQuaternions() sets the receiver but returns undefined,
        // so the tempting one-liner (`new Quaternion().slerpQuaternions(...)` fed
        // straight to copy) throws — once per frame, invisibly, until the view is
        // switched. Check THREE.REVISION before tidying this back up.
        _q.slerpQuaternions(pose, IDENT, ease);
        built.quaternion.copy(_q);
      } else built.quaternion.copy(pose);
      applyMorph(ease);
    }

    // the turntable: only in 3D, only when the caller has switched it on
    // Dragging does NOT cancel it. The control is the state, and one that
    // silently switched itself off would leave a ticked box doing nothing.
    if(spinning && spinRate && mode==='3d' && morph===0 && !dragging){
      pose.premultiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0,spinRate,0)));
    }

    // framing eases with the morph, so nothing jumps size
    if(Math.abs(halfNow-halfTo)>1e-4){ halfNow += (halfTo-halfNow)*0.12; applyHalf(); }

    // Diagram hands over only once the model has actually arrived. You watch it
    // lie down, and then the labels come. Handing over early would be a cut,
    // which is the one thing this module is built to avoid.
    const arrived = mode==='diagram' && morph>=1;
    if(flatHost) flatHost.classList.toggle('on', arrived);
    root.visible=!arrived;
    return arrived;
  }

  /* ---------- back to the opening pose ----------
   * Whatever show() started this molecule at: the spec's own `view:` where it
   * declares one, flatPose where it does not. The undo for a drag, so it
   * returns the picture the card dealt. The spin, if it is on, keeps running:
   * Reset answers "where does this start", not "stop moving".
   */
  function resetPose(){
    if(!spec) return;
    pose.copy(defaultView(spec));
  }

  /* ---------- the canonical coordinates, on screen ----------
   * The spec's own numbers with NOTHING composed on top: the picture
   * `view:` is an offset FROM, and the honest starting point for choosing
   * one. What is drawn is pose ∘ view, so this is pose = view⁻¹ — for a
   * spec declaring no view that is simply identity.
   *
   * NOT A SECOND SOURCE OF AN OPENING ANGLE, and the distinction is the
   * whole reason this is safe. `defaultView()` remains the only thing
   * `show()` consults; this is a USER ACTION, exactly like a drag, and it
   * is reachable only by asking. The bug AddingAPage.md's "A declared `view:`" rule records —
   * this page composing a PCA pose on top of a declared view — was a
   * default doing it silently at load, which is a different thing from a
   * button that says what it did.
   *
   * It reports itself: at canonical, viewEuler() returns [0,0,0] by
   * construction, so the readout above the button is the check that the
   * button worked. Nothing has to be trusted here.
   */
  function canonicalPose(){
    if(!spec) return;
    pose.copy(viewQ(spec).invert());
  }

  /* ---------- the angle on screen, as a spec would write it ----------
   * `spec.view` is [x,y,z]
   * radians, and Stage.buildMolecule bakes it into the MESHES; this module then
   * turns the GROUP. So what is on screen is pose ∘ view, and pasting `pose`
   * into a spec would be wrong by exactly the view already baked in. Compose
   * the two into the ONE quaternion that reproduces this picture from the
   * canonical coordinates, and hand it back in `view:`'s own ZYX order and
   * units. That number is the deliverable — VIEW's entries in molecules.js were
   * hand-tuned ("+28° x / -24.4° y off an earlier pass"); this returns the
   * number that pass was looking for, so a page can print it and the angle can
   * be pasted rather than guessed at.
   */
  function viewEuler(){
    const q=viewQ(spec);
    // The GROUP's quaternion, not `pose`. step() copies pose onto the group and
    // THEN advances the idle turntable, so pose runs one tick ahead of what is
    // drawn; reporting it would describe a frame nobody saw. Only ~0.2° — and
    // only while the turntable is running, which is off unless asked for — but
    // this number is meant to be pasted, so it should be the picture, exactly.
    const now=built ? built.quaternion : pose;
    const e=new THREE.Euler().setFromQuaternion(now.clone().multiply(q), 'ZYX');
    return [e.x, e.y, e.z];
  }

  /* Is the picture on screen the spec's own committed angle?
   * The one question a `view:` exists to answer, and the one this page has now
   * twice got wrong in a way nothing noticed — first by composing a PCA pose on
   * top of it, then by carrying a pose across the derivation cut. Both times the
   * spec was right, the render was wrong, and every check passed. So it is
   * answerable, out loud, rather than by eye: null for a spec that declares
   * nothing, true/false for one that does. Compared as an ANGLE between
   * quaternions, not component by component — two Euler triplets can differ in
   * all three numbers and mean the same rotation. */
  function atDeclaredView(tol){
    if(!spec||!spec.view||!built) return null;
    const want=viewQ(spec);
    const got=new THREE.Quaternion().setFromEuler(
      new THREE.Euler(...viewEuler(), 'ZYX'));
    return want.angleTo(got) <= (tol==null?1e-3:tol);
  }

  return {
    show, setMode, step, fit, snap, viewEuler, resetPose, canonicalPose, atDeclaredView,
    setSpin(on){ spinning=!!on; },
    get spinning(){ return spinning; },
    setHighlight(on){ showFocus=!!on; applyFocus(); paintFlat(); },
    setOptionalH(on){
      showH=!!on;
      if(!built) return;
      Stage.setOptionalH(built,showH);
      markHidden();                 // setOptionalH owns these; remember its verdict
      applyFocus();
    },
    // What is being drawn right now, for a page that wants to say so in words.
    // `has` is the honest answer to "can this molecule be shown that way".
    field:m=>VIEW_FIELD[m||mode],
    has:m=>{ const f=VIEW_FIELD[m||mode]; return !!(spec&&f&&spec[f.field]); },
    get mode(){ return mode; },
    get spec(){ return spec; },
    get group(){ return built; },
    get pose(){ return pose; },
  };
}

global.MolView={ create, usableAround, flatPose, VIEW_FIELD, FLAT_INK, FLAT_HL };
})(this);
