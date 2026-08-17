/* =============================================================================
 *  kit/leaving.js — a piece of a molecule leaves, travels, and is gone
 * =============================================================================
 *  The event every reaction lesson animates: something detaches and goes
 *  somewhere. A phosphoryl group onto ADP, a hydride onto NAD⁺, a water off a
 *  condensation, CO₂ off a decarboxylation, an electron off a metal. Four pages
 *  in this repo had already written it, separately, and they did not agree —
 *  aminoacid-lab's released water is built from the SOLVATION water spec, whose
 *  O–H is exaggerated to 1.55 for that engine's physics, so it lands about 70%
 *  of the size it should be beside PubChem-measured residues. Nobody wrote that
 *  bug; it is what "each page solves it alone" produces.
 *
 *  What is easy to get wrong, and therefore what this owns:
 *
 *   · A SHED ATOM TAKES ITS BONDS WITH IT. Hide the sphere and leave the stick
 *     and there is a bond hanging in the air, anchored to nothing.
 *   · WHAT IS IN THE AIR MUST BE SWEEPABLE. A flight is fire-and-forget, so a
 *     restart mid-flight strands the mesh on stage forever unless every travelling
 *     group is registered somewhere one call can clear.
 *   · REMOVAL IS A COMMIT, NOT THE TWEEN'S LAST FRAME. rAF stops in a hidden
 *     tab. A group removed by its animation's final frame is still sitting there
 *     when you come back; removed by a wall-clock beat, it is gone either way.
 *     (kit/motion.js's `after` is the beat that survives this — pass it in.)
 *   · OFFSTAGE IS A SCREEN EDGE, NOT A WORLD HEIGHT. The constant that cleared
 *     the frame when the camera was close sits inside the shot once the camera
 *     is fitted to a whole pathway, and the thing "leaving" parks over the
 *     molecule instead. Solve it off the camera every time.
 *   · AND A DEPARTURE NEEDS MORE ROOM THAN AN ARRIVAL. NDC 1.08 puts an atom's
 *     CENTRE past the rim — plenty for something entering, but it leaves half a
 *     sphere hanging on the edge for something going.
 *   · TRAVEL THE WHOLE VECTOR. A camera at an elevation makes world +Y point
 *     partly INTO the shot, so drifting up world Y by the exit point's height
 *     climbs short of the edge — the same bug again, wearing a disguise.
 *   · ATOMS ARE NOT A MOLECULE UNTIL THEY ARE. When a product assembles out of
 *     the pieces that left (a condensation water), draw the atoms converging
 *     with NO bonds, and add the bonds only once they have arrived. A bond
 *     stretching to an atom still parked on its old carbon is a bond that does
 *     not exist yet.
 *
 *  The page owns all the chemistry: WHICH atoms leave, what colour the event
 *  is, where it goes. This owns meshes, motion, cleanup and camera arithmetic.
 *
 *  Loaded after scene.js (uses Stage.atom/Stage.bond by default) and
 *  kit/motion.js. Exposes window.Leaving.
 *
 *  Usage:
 *    const GO = Leaving.create({root, camera, motion:MO, tag:'run'});
 *    GO.shed(lane.g, [pIdx, ...terminalO]);           // it left; look left
 *    const frag = GO.fragment(spec, [pIdx, ...oIdx]); // build what travels
 *    GO.launch(frag, {from, to, dur:620, arc:2.6});   // send it, forget it
 *    GO.clear();                                      // restart: sweep the air
 * ========================================================================== */
(function(global){
  'use strict';
  const THREE=global.THREE;

  function create(opts){
    const root=opts.root, camera=opts.camera;
    const motion=opts.motion;                       // kit/motion.js instance
    const tag=opts.tag||'leaving';
    // Defaults to scene.js's primitives; injectable so a page that builds its
    // atoms differently is not locked out.
    const mkAtom=opts.atom || ((c,r,p,el)=>global.Stage.atom(c,r,p,el));
    const mkBond=opts.bond || ((a,b,c)=>global.Stage.bond(a,b,c));
    const PAL=opts.palette || (global.MolLib && global.MolLib.PALETTE) || {};
    const radii=opts.radii || PAL.radii || {};
    const colors=opts.colors || PAL.atoms || {};
    const bondColor=opts.bondColor!=null ? opts.bondColor
                  : (PAL.bonds && PAL.bonds.covalent);

    // Everything currently travelling. One set, so one call clears the stage.
    const air=new Set();
    const at=(fn,ms)=>motion.after((ms||0)/1000, fn, tag);

    /* ---- the substrate half: atoms stop being drawn ---------------------- */
    // `group` is a built molecule (scene.js's userData.atomMeshes/bondMeshes).
    // Bonds go with the atoms — see the header.
    function shed(group,indices){
      const u=group.userData, set=new Set(indices);
      set.forEach(i=>{ const m=u.atomMeshes[i]; if(m) m.visible=false; });
      u.bondMeshes.forEach(bm=>{
        if(bm.userData.pair.some(q=>set.has(q))) bm.visible=false; });
      return group;
    }

    /* ---- the travelling half: a group built from a spec's own atoms ------ */
    // Positions come from the SPEC, recentred on `center` (default: the first
    // index), so the caller places the group by one point and the internal
    // geometry is the molecule's real geometry rather than a guess.
    function fragment(spec,indices,o){
      o=o||{};
      const c=spec.atoms[o.center!=null?o.center:indices[0]].pos;
      const rel=i=>new THREE.Vector3(spec.atoms[i].pos[0]-c[0],
                                     spec.atoms[i].pos[1]-c[1],
                                     spec.atoms[i].pos[2]-c[2]);
      const g=new THREE.Group();
      const set=new Set(indices);
      indices.forEach(i=>{ const el=spec.atoms[i].el;
        g.add(mkAtom(colors[el], radii[el], rel(i), el)); });
      // Only bonds with BOTH ends in the fragment: one end outside is the bond
      // that just broke, and drawing it would send a stick off into space.
      (spec.bonds||[]).forEach(b=>{
        if(set.has(b[0]) && set.has(b[1])) g.add(mkBond(rel(b[0]),rel(b[1]),bondColor)); });
      return g;
    }

    /* ---- put it in the air, and guarantee it comes down ------------------ */
    function hold(g){ air.add(g); root.add(g); return g; }
    function drop(g){ if(air.delete(g)) root.remove(g); }
    function clear(){ air.forEach(g=>root.remove(g)); air.clear(); }

    // Move a group from `from` to `to` and remove it on arrival. `arc` lifts it
    // over the midpoint — a throw, which the eye follows across a gap better
    // than a slide. The MOTION is pixels (render loop); the REMOVAL is a beat
    // (wall clock), so a hidden tab still ends up with an empty stage.
    function launch(g,o){
      o=o||{};
      const from=o.from||g.position.clone(), to=o.to;
      const dur=o.dur!=null?o.dur:620, arc=o.arc||0;
      g.position.copy(from); hold(g);
      const fade=o.fade ? materialsOf(g) : null;
      motion.seq([{dur:dur/1000, ease:o.ease||'outQuad', onUpdate:(e,k)=>{
        g.position.lerpVectors(from,to,e);
        if(arc) g.position.y+=arc*Math.sin(k*Math.PI);
        if(fade) setOpacity(fade, 1-k);
      }}],{tag});
      at(()=>{ drop(g); if(o.onDone) o.onDone(); }, dur);
      return g;
    }

    function materialsOf(g){
      const out=[]; g.traverse(o=>{ if(o.isMesh&&o.material){
        o.material.transparent=true; out.push(o.material); } });
      return out;
    }
    const setOpacity=(mats,v)=>mats.forEach(m=>{ m.opacity=Math.max(0,Math.min(1,v)); });

    /* ---- pieces becoming a molecule -------------------------------------- */
    // `parts` is [{mesh, to}] — each loose atom and where it belongs once this
    // IS a molecule. NO BONDS while they travel; call link() after. Returns the
    // duration so the caller can schedule the rest on it.
    function gather(parts,o){
      o=o||{};
      const dur=o.dur!=null?o.dur:420;
      const from=parts.map(p=>p.mesh.position.clone());
      motion.seq([{dur:dur/1000, ease:o.ease||'outQuad', onUpdate:e=>{
        parts.forEach((p,i)=>p.mesh.position.lerpVectors(from[i],p.to,e)); }}],{tag});
      return dur;
    }
    // The bonds, once the atoms have arrived. Points, not indices: the caller
    // already knows where things ended up.
    function link(g,pairs,color){
      pairs.forEach(([a,b])=>g.add(mkBond(a,b,color!=null?color:bondColor)));
      return g;
    }

    /* ---- offstage, solved from the camera -------------------------------- */
    // A world point straight above `to` on SCREEN, just past the top edge, at
    // `to`'s own depth so it holds through a zoom ease. `edge` is NDC: default
    // 1.3 clears a sphere's radius as well as its centre (a departure); pass
    // ~1.08 for something arriving, which only has to be off-frame at the start.
    function offstage(to,edge){
      const v=to.clone().project(camera);
      return new THREE.Vector3(v.x, edge==null?1.3:edge, v.z).unproject(camera);
    }
    // Straight across the SCREEN, at any orbit angle: the camera's own X axis,
    // which is perpendicular to depth, so a thing taking it neither recedes nor
    // shrinks. World axes do not have that property once the camera is tilted.
    function acrossScreen(dist){
      // The matrix may be a frame stale when this is asked from a click rather
      // than from the loop, and a stale axis is a drift in the wrong direction.
      camera.updateMatrixWorld();
      return new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0)
        .normalize().multiplyScalar(dist);
    }

    return { shed, fragment, launch, hold, drop, clear, gather, link,
             offstage, acrossScreen, get inAir(){ return air.size; } };
  }

  global.Leaving={create};
})(window);
