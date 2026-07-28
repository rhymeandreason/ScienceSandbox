/* =============================================================================
 *  water-drag.js — build water by HAND: drag a hydrogen onto oxygen
 * =============================================================================
 *  Loaded as a classic script AFTER three.min.js, molecules.js, scene.js, fx.js.
 *  Exposes window.WaterDrag. This is the water lesson's own mechanic, kept apart
 *  from builder.js (which is click-to-place across four targets) on purpose —
 *  see README "share the plumbing, not the physics".
 *
 *  The claim this page makes, and therefore what the interaction has to make
 *  feel true:
 *
 *    1. A bond is not a decision, it is an ATTRACTION. So the hydrogen is not
 *       clicked into a slot — it is dragged near, and the last stretch is pulled
 *       by the oxygen rather than by the mouse. Letting go inside the capture
 *       radius still bonds; the atom finishes the trip on its own.
 *    2. What is shared is ELECTRONS. The shared pair is drawn between the two
 *       nuclei, and the two electrons that merge into it are the same two dots
 *       the free atoms were carrying a moment earlier — one from oxygen's open
 *       slot, one from the hydrogen. Nothing is created; the count is conserved.
 *    3. Only two fit. Oxygen offers exactly two slots at 104.5°, so a third
 *       hydrogen has nowhere to be pulled and simply drifts.
 *
 *  Geometry is lifted from MolLib.MOLECULES.water (slot dirs = the real H
 *  positions normalised), so a hand-built water is the same water every other
 *  page loads.
 *
 *  Usage:
 *    const w = WaterDrag.create({THREE, root, camera, canvas, fx, onChange});
 *    w.setMode('electrons'|'sticks');  w.reset();  w.step(dt);
 * ========================================================================== */
(function(global){
  'use strict';

  const S = {
    OH: 1.55,                 // O–H display length (molecules.js convention)
    /* Slot dirs are water's real H positions normalised: (±1.226,−0.948,0)/1.55.
     * Lone pairs sit opposite, out of plane — they are the reason the angle is
     * 104.5° and not the 109.5° a bare tetrahedron would give, so they are drawn
     * rather than asserted. */
    SLOTS: [[0.7910,-0.6116,0], [-0.7910,-0.6116,0]],
    LONE:  [[0,0.6116,0.7910], [0,0.6116,-0.7910]],
    /* 2D view. The real lone pairs stick out of the H–O–H plane (that IS why the
     * angle is 104.5°), which means looking straight on they hide behind the
     * oxygen — you cannot count the octet. The flat layout swings them into the
     * plane, one to each upper side, which is exactly the Lewis diagram a
     * textbook draws. It is a PROJECTION for counting electrons, not a claim
     * about shape: the bond angle and the H positions are untouched, and 3D is
     * one click away to see where the pairs really sit. */
    LONE_FLAT: [[0.6116,0.7910,0], [-0.6116,0.7910,0]],
    CAPTURE: 3.4,             // within this, oxygen starts pulling
    /* Nuclei are solid: a hydrogen can never be pushed inside the oxygen, no
     * matter where the pointer goes. It slides on that shell instead — which is
     * also what makes a sloppy drop work, because a hydrogen dropped anywhere on
     * oxygen's face is then within reach of a slot and slides into it. */
    TOUCH: 1.52,              // O radius 0.95 + H radius 0.55, plus a hair of gap
    SNAP: 0.42,               // this close to the slot and the bond forms
    BREAK: 1.35,              // drag a bonded H this far off-slot and it lets go
    DAMP: 0.86,               // velocity damping for a free-floating atom
    PULL: 26,                 // attraction strength (scene units / s²)
    /* Electrons are coloured by WHICH ATOM BROUGHT THEM, not by what they are
     * doing, and each one wears its ATOM'S OWN colour. In the shared pair you can
     * still see one red (oxygen's) and one steel (hydrogen's), so "they share a
     * pair" reads as two atoms each putting one electron in, rather than as a
     * bond appearing from nowhere — and the ownership needs no legend, because
     * the electron is simply the colour of the atom it came from.
     * The cost is that a red dot lands on a red sphere, so every dot carries an
     * ink outline (see dot()) — without it the shared pair would vanish into the
     * oxygen at exactly the moment it matters. */
    E_O: 0xd6362e,            // oxygen's — the same red as the oxygen sphere
    E_H: 0xb9c2d0,            // hydrogen's — the same pale steel
  };

  function create(opts){
    const THREE=opts.THREE, root=opts.root, camera=opts.camera,
          canvas=opts.canvas, fx=opts.fx||null,
          onChange=opts.onChange||function(){};
    const P=global.MolLib.PALETTE;

    const group=new THREE.Group(); root.add(group);
    let mode='electrons';
    let dim='3d';             // '2d' = straight-on Lewis view, rotation locked
    let hydrogens=[], oxygen=null, sticks=[], sharedPairs=[];
    let t=0;

    /* ---- pieces: the shared dressing lives in atomkit.js --------------
     * Electron dots, clouds, letters and the cel/outline treatment are the
     * VOCABULARY of the lesson, not its mechanic, so both bonding tabs read
     * them from the same kit. What stays here is the covalent physics. */
    const kit=AtomKit.create(THREE);
    const dot=kit.dot, cloud=kit.cloud, label=kit.label;
    function applyCel(){
      const on=(dim==='2d');
      kit.cel([oxygen&&oxygen.sphere].concat(hydrogens.map(h=>h.sphere)), on);
      kit.cel(sticks, on, false);
    }

    function v3(a){ return new THREE.Vector3(a[0],a[1],a[2]); }

    /* ---- build the starting scatter ----------------------------------- */
    function build(){
      // oxygen: nucleus + cloud + its own six valence electrons
      const og=new THREE.Group();
      const osphere=Stage.atom(P.atoms.O, P.radii.O, new THREE.Vector3(), 'O');
      const ocloud=cloud('O');
      // white letter on the deep red sphere; the H's take ink on pale steel
      og.add(osphere, ocloud, label('O','O','#ffffff'));
      // two lone PAIRS (four electrons, spoken for) — positions come from
      // layoutLone(), because they move when the view flips to 2D
      const lonePairs=S.LONE.map(()=>{
        const pair=[dot(S.E_O), dot(S.E_O)];
        pair.forEach(m=>og.add(m));
        return pair;
      });
      // … and two UNPAIRED electrons, one on each open slot: the two that are
      // free to share, which is why water is H₂O and not H₃O.
      const slotDots=S.SLOTS.map(d=>{
        const m=dot(S.E_O);
        m.position.copy(v3(d).normalize().multiplyScalar(P.radii.O+0.17));
        og.add(m); return m;
      });
      // ghost markers showing WHERE a hydrogen is allowed to land
      const ghosts=S.SLOTS.map((d,i)=>{
        const m=new THREE.Mesh(Stage.Rsphere, new THREE.MeshBasicMaterial({
          color:P.atoms.H, transparent:true, opacity:0.18, depthWrite:false }));
        m.scale.setScalar(P.radii.H*0.9);
        m.position.copy(v3(d).multiplyScalar(S.OH));
        m.userData.slot=i;
        og.add(m); return m;
      });
      group.add(og);
      oxygen={group:og, sphere:osphere, cloud:ocloud, lonePairs, slotDots, ghosts};
      layoutLone();

      // three hydrogens — one more than fits, so "only two" is discovered, not
      // announced. The spare one has nowhere to be pulled and just drifts.
      [[-5.0,-1.2,1.2],[5.0,1.4,-1.0],[-4.4,3.6,-1.6]].forEach(p=>{
        const hg=new THREE.Group();
        hg.position.set(p[0],p[1],p[2]);
        const sphere=Stage.atom(P.atoms.H, P.radii.H, new THREE.Vector3(), 'H');
        const hcloud=cloud('H');
        const e=dot(S.E_H);                  // its single valence electron
        hg.add(sphere, hcloud, e, label('H','H','#2b2b2b'));
        group.add(hg);
        hydrogens.push({ group:hg, sphere, cloud:hcloud, electron:e,
                         vel:new THREE.Vector3(), slot:null, dragging:false,
                         home:new THREE.Vector3(p[0],p[1],p[2]) });
      });
      applyMode();
      onChange(state());
    }

    /* Put the two lone pairs where the current view can show them, and straddle
     * each pair across an axis the camera can see: in 2D that has to be the
     * in-plane perpendicular, or the two dots line up front-to-back and read as
     * one electron instead of two. */
    function layoutLone(){
      const dirs=(dim==='2d')?S.LONE_FLAT:S.LONE;
      oxygen.lonePairs.forEach((pair,i)=>{
        const dir=v3(dirs[i]).normalize();
        const perp=new THREE.Vector3().crossVectors(dir,
          Math.abs(dir.z)<0.9?new THREE.Vector3(0,0,1):new THREE.Vector3(0,1,0)).normalize();
        const base=dir.clone().multiplyScalar(P.radii.O+0.17);
        pair.forEach((m,k)=>m.position.copy(base).addScaledVector(perp,(k?1:-1)*0.16));
      });
    }

    /* 2D flattens everything onto z=0 — including the loose hydrogens, which
     * otherwise drift toward the camera and read as "bigger" rather than
     * "nearer". step() keeps holding them there while the mode lasts. */
    function setDim(d){
      dim=(d==='2d')?'2d':'3d';
      layoutLone();
      applyCel();
      if(dim==='2d') hydrogens.forEach(h=>{ h.group.position.z=0; h.vel.z=0; });
    }

    /* ---- bonding ------------------------------------------------------- */
    function slotPos(i){ return v3(S.SLOTS[i]).multiplyScalar(S.OH); }
    function slotTaken(i){ return hydrogens.some(h=>h.slot===i); }
    // nearest OPEN slot to a hydrogen, or null when oxygen is full
    function bestSlot(h){
      let best=null, bd=Infinity;
      S.SLOTS.forEach((d,i)=>{
        if(slotTaken(i)) return;
        const dist=h.group.position.distanceTo(slotPos(i));
        if(dist<bd){ bd=dist; best={i, dist}; }
      });
      return best;
    }

    /* The shared pair sits ON the bond axis, in the gap between the two
     * SURFACES — not at the bond midpoint, which for O–H (bond 1.55, O radius
     * 0.95) is buried inside the oxygen. The surfaces meet at 0.95 and 1.00
     * along the axis, so the pair goes at 0.975: visually right in the pinch
     * between the two spheres, which is where a shared pair belongs. The two
     * dots straddle the axis so the pair still reads as TWO electrons.
     * (They draw with depthTest:false, so the sliver of sphere in front of them
     * doesn't hide them — see dot().) */
    function makeSharedPair(i){
      const a=new THREE.Vector3(), b=slotPos(i);
      const along=new THREE.Vector3().subVectors(b,a).normalize();
      const gapMid=(P.radii.O + (S.OH-P.radii.H))/2;
      const center=along.clone().multiplyScalar(gapMid);
      // straddle the axis in the H–O–H plane, away from the other bond, so the
      // two pairs splay left and right instead of overlapping each other
      let out=v3(S.SLOTS[i]).sub(v3(S.SLOTS[1-i]));
      out.addScaledVector(along, -out.dot(along));                // keep it ⊥ bond
      if(out.lengthSq()<1e-6) out=new THREE.Vector3(0,0,1);
      out.normalize();
      const pair={slot:i, dots:[]};
      // one electron from each atom, still wearing the colour it arrived in
      [[-1,S.E_O],[1,S.E_H]].forEach(([s,col])=>{
        const m=dot(col); m.position.copy(center).addScaledVector(out, s*0.17);
        group.add(m); pair.dots.push(m);
      });
      sharedPairs.push(pair);
      // a guide-line stick for the other view mode — thin, because in electron
      // mode the pair of dots is what is doing the explaining
      const st=Stage.bond(a, b, P.bonds.covalent, 0.10, 1);
      st.userData.slot=i;
      group.add(st); sticks.push(st);
      applyCel();                       // a stick born in 2D is born cel-shaded
      applyMode();
    }
    function dropSharedPair(i){
      sharedPairs=sharedPairs.filter(p=>{
        if(p.slot!==i) return true;
        p.dots.forEach(d=>group.remove(d)); return false; });
      sticks=sticks.filter(s=>{
        if(s.userData.slot!==i) return true; group.remove(s); return false; });
    }

    function bond(h, i){
      h.slot=i; h.vel.set(0,0,0);
      h.group.position.copy(slotPos(i));
      // the two electrons that merge into the shared pair are the two that were
      // just visible on the free atoms — hide them, don't create new ones
      h.electron.visible=false;
      oxygen.slotDots[i].visible=false;
      oxygen.ghosts[i].visible=false;
      makeSharedPair(i);
      if(fx) fx.settleShimmer(h.sphere, P.atoms.O);
      onChange(state());
    }
    function unbond(h){
      const i=h.slot; h.slot=null;
      dropSharedPair(i);
      oxygen.ghosts[i].visible=(mode==='electrons');
      oxygen.slotDots[i].visible=(mode==='electrons');
      h.electron.visible=(mode==='electrons');
      onChange(state());
    }

    /* ---- dragging ------------------------------------------------------
     * Registered on the canvas's PARENT in the capture phase so a grab can stop
     * the event before Stage's own orbit handler (bound on the canvas itself)
     * ever sees it: dragging an atom must not also spin the camera. */
    const ray=new THREE.Raycaster();
    const ndc=new THREE.Vector2();
    const plane=new THREE.Plane();
    const hit=new THREE.Vector3();
    let held=null, grabOffset=new THREE.Vector3();

    function toNdc(e){
      const r=canvas.getBoundingClientRect();
      ndc.set(((e.clientX-r.left)/r.width)*2-1, -((e.clientY-r.top)/r.height)*2+1);
    }
    function pick(e){
      toNdc(e); ray.setFromCamera(ndc, camera);
      const targets=hydrogens.map(h=>h.sphere);
      const hits=ray.intersectObjects(targets, false);
      if(!hits.length) return null;
      return hydrogens.find(h=>h.sphere===hits[0].object)||null;
    }
    // the drag plane faces the camera and passes through the grabbed atom, so
    // the atom tracks the pointer exactly at its own depth
    function planeAt(p){
      plane.setFromNormalAndCoplanarPoint(
        camera.getWorldDirection(new THREE.Vector3()).negate(), p);
    }
    function pointerOnPlane(e){
      toNdc(e); ray.setFromCamera(ndc, camera);
      return ray.ray.intersectPlane(plane, hit) ? hit.clone() : null;
    }

    const surface=canvas.parentElement||canvas;
    function onDown(e){
      const h=pick(e);
      if(!h) return;                       // let the orbit handler have it
      e.stopPropagation(); e.preventDefault();
      held=h; h.dragging=true; h.vel.set(0,0,0);
      const world=h.group.getWorldPosition(new THREE.Vector3());
      planeAt(world);
      const p=pointerOnPlane(e);
      grabOffset.copy(p ? world.clone().sub(p) : new THREE.Vector3());
      canvas.style.cursor='grabbing';
    }
    function onMove(e){
      if(!held){                            // hover affordance only
        if(!canvas.style.cursor || canvas.style.cursor==='grab' || canvas.style.cursor==='')
          canvas.style.cursor = pick(e) ? 'grab' : '';
        return;
      }
      const p=pointerOnPlane(e); if(!p) return;
      const want=group.worldToLocal(p.add(grabOffset));   // atoms live in group space
      if(held.slot!=null && want.distanceTo(slotPos(held.slot))>S.BREAK) unbond(held);
      held.group.position.copy(want);
    }
    function onUp(){
      if(!held) return;
      held.dragging=false; held=null;
      canvas.style.cursor='';
    }
    surface.addEventListener('pointerdown', onDown, true);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);

    /* Tabs swap one lesson for another, so a module has to be able to take
     * itself off the page completely — a stale pointer handler would keep
     * grabbing atoms that are no longer visible. */
    function destroy(){
      surface.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      root.remove(group);
      canvas.style.cursor='';
    }

    /* ---- per-frame: attraction, snap, dressing ------------------------- */
    // keep a free hydrogen outside oxygen's surface (see S.TOUCH)
    function shell(h){
      const p=h.group.position, d=p.length();
      if(d>S.TOUCH || d<1e-4) return;
      p.multiplyScalar(S.TOUCH/Math.max(d,1e-4));
      h.vel.addScaledVector(p.clone().normalize(), -h.vel.dot(p.clone().normalize()));
    }

    function step(dt){
      dt=Math.min(dt||0.016, 0.05);
      t+=dt;

      hydrogens.forEach(h=>{
        if(dim==='2d'){ h.group.position.z=0; h.vel.z=0; }
        // its lone electron always faces oxygen — "this is the one I can share"
        if(h.slot==null){
          const toO=h.group.position.clone().negate();
          if(toO.lengthSq()>1e-6)
            h.electron.position.copy(toO.normalize().multiplyScalar(P.radii.H+0.17));
        }

        if(h.slot!=null){                   // bonded: sit on the slot
          h.group.position.lerp(slotPos(h.slot), 1-Math.pow(0.001, dt));
          return;
        }
        const b=bestSlot(h);
        if(!b){ h.vel.multiplyScalar(Math.pow(S.DAMP, dt*60));
                h.group.position.addScaledVector(h.vel, dt); return; }
        const target=slotPos(b.i);
        const toSlot=target.clone().sub(h.group.position);
        const d=toSlot.length();

        if(h.dragging){
          /* Attraction DURING the drag: inside the capture radius the atom stops
           * tracking the pointer exactly and leans toward the slot, more and more
           * as it closes. You feel the oxygen take over before you let go, which
           * is the honest version of "they pull together" — the last stretch is
           * not the mouse's doing. */
          if(d<S.CAPTURE){
            const k=1-(d/S.CAPTURE);            // 0 at the edge → 1 at the slot
            h.group.position.addScaledVector(toSlot.normalize(), d*k*k*0.55);
          }
          shell(h);
          if(h.group.position.distanceTo(target)<S.SNAP) bond(h, b.i);
        }else{
          // released (or never touched): a real inverse-square-ish pull-in
          if(d<S.CAPTURE){
            const f=S.PULL/Math.max(d*d, 0.25);
            h.vel.addScaledVector(toSlot.normalize(), f*dt);
          }
          h.vel.multiplyScalar(Math.pow(S.DAMP, dt*60));
          h.group.position.addScaledVector(h.vel, dt);
          shell(h);
          if(h.group.position.distanceTo(target)<S.SNAP) bond(h, b.i);
        }
      });

      // ghosts breathe, and brighten when a hydrogen is close enough to be caught
      oxygen.ghosts.forEach((g,i)=>{
        if(!g.visible) return;
        const near=hydrogens.some(h=>h.slot==null &&
          h.group.position.distanceTo(slotPos(i))<S.CAPTURE);
        const base=near?0.42:0.16;
        g.material.opacity=base+0.05*Math.sin(t*3.2);
      });
    }

    /* ---- view mode ----------------------------------------------------- */
    function applyMode(){
      const e=(mode==='electrons');
      oxygen.lonePairs.forEach(p=>p.forEach(m=>m.visible=e));
      oxygen.slotDots.forEach((m,i)=>m.visible=e && !slotTaken(i));
      oxygen.ghosts.forEach((m,i)=>m.visible=e && !slotTaken(i));
      oxygen.cloud.visible=e;
      sharedPairs.forEach(p=>p.dots.forEach(d=>d.visible=e));
      hydrogens.forEach(h=>{
        h.cloud.visible=e;
        h.electron.visible=e && h.slot==null;
      });
      sticks.forEach(s=>s.visible=!e);
    }
    function setMode(m){ mode=(m==='sticks')?'sticks':'electrons'; applyMode(); }

    function state(){
      const bonded=hydrogens.filter(h=>h.slot!=null).length;
      return { bonded, open:S.SLOTS.length-bonded, complete:bonded===S.SLOTS.length,
               free:hydrogens.length-bonded };
    }

    function reset(){
      [...group.children].forEach(c=>group.remove(c));
      hydrogens=[]; sticks=[]; sharedPairs=[]; oxygen=null; held=null;
      build();
      setDim(dim);
    }

    build();
    return { group, step, setMode, setDim, reset, destroy, state,
             /* Where the molecule IS, for effects that have to fire somewhere.
                Water's oxygen happens to sit at the origin, but read the mesh
                rather than assuming it — the assumption is exactly what put the
                completion ring in empty space in the salt tab. */
             center:()=>oxygen ? oxygen.group.getWorldPosition(new THREE.Vector3())
                               : new THREE.Vector3(),
             get mode(){return mode;}, get dim(){return dim;} };
  }

  global.WaterDrag={ create, S };
})(this);
