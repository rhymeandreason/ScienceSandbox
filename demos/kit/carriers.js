/* =============================================================================
 *  kit/carriers.js — one object with two states, standing in a column
 * =============================================================================
 *  ATP and ADP were two tiles once, and the single phosphate that distinguishes
 *  them was never drawn. The fix generalises: a carrier is ONE molecule with a
 *  charged and a discharged state differing by exactly one group, and the way
 *  to teach it is to draw that group appearing and leaving on the same object.
 *  ATP/ADP by the transferring phosphoryl, NADH/NAD⁺ by the hydride on C4,
 *  FADH₂/FAD, GTP/GDP, and — the same shape wearing different words — a
 *  conjugate acid and its base, which differ by one proton.
 *
 *  Every energy lesson after glycolysis is mostly carriers: pyruvate oxidation
 *  needs NAD⁺ and CoA, the citric acid cycle needs NAD⁺ three times plus FAD
 *  and GDP, and a light-reactions page would be almost nothing else.
 *
 *  This owns the MECHANISM. The page owns every chemical fact:
 *
 *    page  ·  which molecule, which atoms are the group, which atom a flight
 *             aims at, what the states are called, when a step has run
 *    this  ·  n instances of it, laid into the column's DOM slots, fitted,
 *             arriving, with the group shown or hidden
 *
 *  What is easy to get wrong, and therefore what this owns:
 *
 *   · THE DRAWING IS A MOLECULE IN THE SCENE, not a picture in a box — same
 *     camera and scale as the subject, because the claim is that this is
 *     another molecule in the cytosol and not an icon for one. It is placed by
 *     projecting a DOM slot's box, so layout still decides the column.
 *   · REBUILD ONLY WHEN THE SPEC CHANGES. Reusing the meshes across a change
 *     leaves an ATP wearing a NADH's label.
 *   · THE SLOTS ARE REBUILT ONLY WHEN THE COUNT CHANGES, because a running
 *     animation measures against those boxes and they must not move under it.
 *   · HIDDEN, NOT REMOVED. The discharged state is the charged one with the
 *     group's `visible` off — the next step puts it back, and a deleted mesh
 *     cannot come back.
 *   · `keep` IS LOAD-BEARING. A page that hides optional hydrogens will hide
 *     the very atoms that distinguish the two states (NAD⁺ vs NADH is two C4
 *     hydrogens against one). A pair names what it needs back, and it is
 *     re-asserted on every draw because the build re-hides them every time.
 *   · FIT DOWN, NEVER UP. The scale is capped at 1: carriers run well over
 *     twice a hexose across, and a carrier enlarged to fill its slot would take
 *     the stage from the molecule the lesson is actually following.
 *   · ARRIVAL IS PER INSTANCE, and it fires on the transition INTO visible, not
 *     on a redraw. With two carriers on screen "something arrived" is a claim
 *     about ONE of them; popping both when a single lane hands over its
 *     phosphate says the other changed too.
 *   · AN ENTRANCE IS A MULTIPLIER, never a scale of its own. The real scale is
 *     re-solved from the column every frame, so an entrance that sets `scale`
 *     directly fights it and wins for as long as it runs.
 *
 *  Loaded after scene.js. Exposes window.Carriers.
 *
 *  Usage — the page keeps its pair table and its lesson state:
 *    const CAR = Carriers.create({root, camera, canvas, host:carrierEl});
 *    CAR.show(2, ATP_SPEC);                       // two instances
 *    CAR.mols.forEach((g,j)=>CAR.setGroup(g, pair.group(spec),
 *                                         charged(j), pair.keep&&pair.keep(spec)));
 *    CAR.place(isVisible);                        // from afterFrame, every frame
 *    CAR.pointAt(j, pair.anchor(spec));           // where a flight starts/ends
 * ========================================================================== */
(function(global){
  'use strict';
  const THREE=global.THREE;

  function create(opts){
    const root=opts.root, camera=opts.camera, canvas=opts.canvas;
    const host=opts.host;                       // the column element
    const visSel='.'+(opts.visClass||'cvis');   // holds the slots
    const slotSel='.'+(opts.slotClass||'cslot');
    const slotHTML=opts.slotHTML||(()=>'<div class="cslot"><span class="clab"></span></div>');
    // Where a molecule sits INSIDE its slot: 'center' (default, unchanged for
    // every existing caller) or 'left'. A layout decision, so the page makes
    // it — the module only knows how to honour it.
    const align=opts.align||'center';
    // Injected so a page builds its molecules its own way (optional-H policy,
    // centring); defaults to the ordinary centred build.
    const build=opts.build||(spec=>{ const g=global.Stage.buildMolecule(spec,{center:true});
                                     global.Stage.setOptionalH(g,false); return g; });
    const measure=opts.measure||(spec=>global.Stage.measure(spec));
    const ARRIVE_MS=opts.arriveMs!=null?opts.arriveMs:520;
    const ARRIVE_FROM=opts.arriveFrom!=null?opts.arriveFrom:0.82;

    let mols=[], spec0=null;
    let arriveAt=[], wasVis=false, fitK=1;
    const anchor=new THREE.Vector3();
    const easeOut=t=>1-Math.pow(1-t,3);

    /* ---- how many, and of what ------------------------------------------ */
    function show(n,spec){
      if(spec!==spec0){ while(mols.length) root.remove(mols.pop()); spec0=spec; }
      while(mols.length>n) root.remove(mols.pop());
      while(mols.length<n){ const g=build(spec); root.add(g); pop(mols.length); mols.push(g); }
      const vis=host.querySelector(visSel);
      if(vis && vis.children.length!==n)
        vis.innerHTML=Array.from({length:n},(_,i)=>slotHTML(i)).join('');
      return mols;
    }

    /* ---- charged or not: one group's visibility -------------------------- */
    // `group` is the atom indices that distinguish the states; `keep` the ones
    // that must stay on screen in EITHER state (see the header).
    function setGroup(g,group,charged,keep){
      const u=g.userData, set=new Set(group);
      group.forEach(i=>{ const m=u.atomMeshes[i]; if(m) m.visible=charged; });
      u.bondMeshes.forEach(bm=>{
        if(bm.userData.pair.some(p=>set.has(p))) bm.visible=charged; });
      if(keep && keep.length){ const ks=new Set(keep);
        keep.forEach(i=>{ const m=u.atomMeshes[i]; if(m) m.visible=true; });
        u.bondMeshes.forEach(bm=>{
          if(bm.userData.pair.some(p=>ks.has(p))) bm.visible=true; }); }
    }

    /* ---- the entrance ---------------------------------------------------- */
    const pop=j=>{ arriveAt[j]=performance.now(); };
    function arriveScale(j){
      const t0=arriveAt[j];
      if(!t0) return 1;
      const t=(performance.now()-t0)/ARRIVE_MS;
      if(t>=1){ arriveAt[j]=0; return 1; }
      return ARRIVE_FROM+(1-ARRIVE_FROM)*easeOut(t);
    }

    /* ---- put each molecule over its own slot ----------------------------- */
    // Call every frame, AFTER the render (a projection reads a matrix the
    // render refreshes; before it, everything is pinned to the last frame).
    // Returns the fitted scale so a caption can state it — the fitted one, not
    // the entrance's current frame, or the number ticks while the molecule sits
    // still and reads as a measurement.
    function place(visible){
      if(!mols.length) return fitK;
      if(visible && !wasVis) mols.forEach((_,j)=>pop(j));
      wasVis=visible;
      mols.forEach(g=>g.visible=visible);
      if(!visible) return fitK;
      const slots=host.querySelectorAll(slotSel);
      const c=canvas.getBoundingClientRect();
      if(!c.width||!c.height) return fitK;
      camera.updateMatrixWorld();
      const z=anchor.set(0,0,0).project(camera).z;      // the subject's own depth
      const m=measure(spec0);
      const pxPerWorld=c.width/(camera.right-camera.left);
      mols.forEach((g,j)=>{
        const box=slots[j] && slots[j].getBoundingClientRect();
        if(!box||!box.width) return;
        // SCALE FIRST, THEN PLACE — `align:'left'` needs the molecule's own
        // half-width in pixels to sit its EDGE on the slot's edge, and that is
        // not known until the fit is solved. Centring never needed it, which is
        // why this used to run the other way round.
        fitK=Math.min(box.width *0.94/(2*m.rxz*pxPerWorld),
                      box.height*0.94/(2*m.hy *pxPerWorld), 1);
        // A molecule limited by its slot's HEIGHT — a tall thin column, which
        // is what a carrier tray is — never fills the width, so centring leaves
        // a gutter down both sides. Left-aligning gives that whole gutter to
        // whatever stands beside the tray instead of splitting it in two.
        const cx = align==='left'
          ? box.left + m.rxz*pxPerWorld*fitK
          : box.left + box.width/2;
        g.position.copy(new THREE.Vector3(
          (cx-c.left)/c.width*2-1,
          -(((box.top+box.height/2)-c.top)/c.height*2-1), z).unproject(camera));
        g.scale.setScalar(fitK*arriveScale(j));
      });
      return fitK;
    }

    /* ---- where a flight starts or ends ----------------------------------- */
    // Client pixels of one atom on instance j — lane j's OWN carrier on a
    // per-lane step, not "the carrier". Null when there is nothing on screen to
    // aim at, so a caller never fires a flight at the origin.
    function pointAt(j,atomIdx){
      if(!host.isConnected) return null;
      const g=mols[Math.min(j||0, mols.length-1)];
      if(!g||!g.visible) return null;
      const c=canvas.getBoundingClientRect();
      if(!c.width||!c.height) return null;
      const mesh=g.userData.atomMeshes[atomIdx];
      if(!mesh) return null;
      const p=mesh.getWorldPosition(new THREE.Vector3()).project(camera);
      return {x:c.left+(p.x*.5+.5)*c.width, y:c.top+(-p.y*.5+.5)*c.height};
    }

    // World midpoint of a bond on instance j — what a "this bond breaks" mark
    // is pinned to. Null rather than a guess, same rule as pointAt.
    function bondMid(j,i0,i1,out){
      const g=mols[Math.min(j||0, mols.length-1)];
      if(!g||!g.visible||i0<0||i1<0) return null;
      const u=g.userData;
      return (out||new THREE.Vector3()).copy(u.atomWorld(i0)).add(u.atomWorld(i1))
        .multiplyScalar(.5);
    }

    function clear(){ while(mols.length) root.remove(mols.pop()); spec0=null; arriveAt=[]; }

    return { show, setGroup, place, pop, pointAt, bondMid, clear,
             get mols(){ return mols; }, get spec(){ return spec0; },
             get scale(){ return fitK; } };
  }

  global.Carriers={create};
})(window);
