/* =============================================================================
 *  covalent-drag.js — build a covalent molecule by HAND: drag an atom onto the core
 * =============================================================================
 *  Loaded as a classic script AFTER three.min.js, molecules.js, scene.js, fx.js.
 *  Exposes window.CovalentDrag, which serves every "core atom fills its slots"
 *  lesson — water and methane today. They are ONE mechanic with different
 *  constants (how many slots, pointing where), so they are one module with a
 *  RECIPE, unlike ionic-drag.js which is a different mechanic and therefore a
 *  different file. See README "share the plumbing, not the physics".
 *
 *  The claim this page makes, and therefore what the interaction has to make
 *  feel true:
 *
 *    1. A bond is not a decision, it is an ATTRACTION. So the ligand is not
 *       clicked into a slot — it is dragged near, and the last stretch is pulled
 *       by the core rather than by the mouse. Letting go inside the capture
 *       radius still bonds; the atom finishes the trip on its own.
 *    2. What is shared is ELECTRONS. The shared pair is drawn between the two
 *       nuclei, and the two electrons that merge into it are the same two dots
 *       the free atoms were carrying a moment earlier — one from the core's open
 *       slot, one from the ligand. Nothing is created; the count is conserved.
 *    3. Only as many fit as there are slots. Oxygen offers two at 104.5° and
 *       carbon four at 109.5°, so the spare ligand on the bench has nowhere to
 *       be pulled and simply drifts. The count is discovered, not announced.
 *
 *  Geometry is lifted from MolLib.MOLECULES (slot dirs = the real ligand
 *  positions normalised), so a hand-built molecule is the same molecule every
 *  other page loads.
 *
 *  Usage:
 *    const w = CovalentDrag.create({THREE, root, camera, canvas, fx, onChange,
 *                                   recipe:'water'});
 *    w.setMode('electrons'|'sticks');  w.setDim('2d'|'3d');  w.reset();
 * ========================================================================== */
(function(global){
  'use strict';

  const S = {
    CAPTURE: 3.4,             // within this, the core starts pulling
    SNAP: 0.42,               // this close to the slot and the bond forms
    BREAK: 1.35,              // drag a bonded atom this far off-slot and it lets go
    DAMP: 0.86,               // velocity damping for a free-floating atom
    PULL: 26,                 // attraction strength (scene units / s²)
  };

  const S3 = 1/Math.sqrt(3);

  /* ---- the recipes ----------------------------------------------------
   * Slot dirs are the real ligand positions from molecules.js, normalised —
   * water's H's at (±1.226,−0.948,0)/1.55, methane's at (±1,±1,±1)/√3 — so a
   * molecule the student BUILDS is geometrically identical to the same molecule
   * the other pages LOAD.
   *
   * `slots2d` is a PROJECTION for counting electrons, not a claim about shape.
   * Water's slots are already in a plane so its flat view is the same geometry;
   * methane's tetrahedron is not, and drawn straight on it collapses into an
   * unreadable overlap, so the flat view spreads the four bonds to N/E/S/W —
   * which is exactly the Lewis diagram a textbook draws, and exactly the lie a
   * textbook tells. That is why 3D is one click away, and why the teach card
   * says 109.5° rather than 90°.
   *
   * `lone`/`loneFlat` are the pairs that do NOT bond. Water's stick out of the
   * H–O–H plane — they are the honest reason the angle is 104.5° instead of the
   * 109.5° a bare tetrahedron gives — so the flat view swings them into the
   * plane to keep the octet countable. Carbon has none: all four of its
   * electrons are in slots, which is why methane has no leftovers to draw.
   */
  const RECIPES = {
    water: {
      core:'O', ligand:'H', bond:1.55,
      slots:   [[0.7910,-0.6116,0], [-0.7910,-0.6116,0]],
      slots2d: [[0.7910,-0.6116,0], [-0.7910,-0.6116,0]],
      lone:     [[0,0.6116,0.7910], [0,0.6116,-0.7910]],
      loneFlat: [[0.6116,0.7910,0], [-0.6116,0.7910,0]],
      // one more ligand than fits, so "only two" is discovered, not announced
      start:[[-5.0,-1.2,1.2],[5.0,1.4,-1.0],[-4.4,3.6,-1.6]],
    },
    methane: {
      core:'C', ligand:'H', bond:1.50,
      slots:   [[S3,S3,S3],[S3,-S3,-S3],[-S3,S3,-S3],[-S3,-S3,S3]],
      slots2d: [[0,1,0],[1,0,0],[0,-1,0],[-1,0,0]],
      lone:[], loneFlat:[],
      start:[[-5.2,-1.4,1.0],[5.2,1.2,-1.2],[-1.6,5.0,-1.4],
             [1.8,-5.0,1.4],[5.4,-3.0,0.8]],
    },
  };

  function create(opts){
    const THREE=opts.THREE, root=opts.root, camera=opts.camera,
          canvas=opts.canvas, fx=opts.fx||null,
          onChange=opts.onChange||function(){};
    const P=global.MolLib.PALETTE;
    const R=RECIPES[opts.recipe||'water'];
    // solid nuclei: a ligand can never be pushed inside the core, no matter
    // where the pointer goes. It slides on that shell instead — which is also
    // what makes a sloppy drop work, because a ligand dropped anywhere on the
    // core's face is then within reach of a slot and slides into it.
    const TOUCH=(P.radii[R.core]+P.radii[R.ligand])*1.014;

    const group=new THREE.Group(); root.add(group);
    let mode='electrons';
    let dim='3d';             // '2d' = straight-on Lewis view, rotation locked
    let ligands=[], core=null, sticks=[], sharedPairs=[];
    function slotDirs(){ return (dim==='2d')?R.slots2d:R.slots; }
    let t=0;

    /* ---- pieces: the shared dressing lives in atomkit.js --------------
     * Electron dots, clouds, letters and the cel/outline treatment are the
     * VOCABULARY of the lesson, not its mechanic, so both bonding tabs read
     * them from the same kit. What stays here is the covalent physics. */
    const kit=AtomKit.create(THREE);
    const dot=kit.dot, cloud=kit.cloud, label=kit.label;
    function applyCel(){
      const on=(dim==='2d');
      kit.cel([core&&core.sphere].concat(ligands.map(h=>h.sphere)), on);
      kit.cel(sticks, on, false);
    }

    function v3(a){ return new THREE.Vector3(a[0],a[1],a[2]); }

    /* ---- build the starting scatter ----------------------------------- */
    function build(){
      // the core: nucleus + cloud + its own valence electrons
      const og=new THREE.Group();
      const osphere=Stage.atom(P.atoms[R.core], P.radii[R.core], new THREE.Vector3(), R.core);
      const ocloud=cloud(R.core);
      // white letter on the dark core sphere; the ligands take ink on pale steel
      og.add(osphere, ocloud, label(R.core, R.core, '#ffffff'));
      // two lone PAIRS (four electrons, spoken for) — positions come from
      // layoutLone(), because they move when the view flips to 2D
      const lonePairs=R.lone.map(()=>{
        const pair=[dot(P.atoms[R.core]), dot(P.atoms[R.core])];
        pair.forEach(m=>og.add(m));
        return pair;
      });
      // … and two UNPAIRED electrons, one on each open slot: the two that are
      // free to share, which is why water is H₂O and not H₃O.
      const slotDots=slotDirs().map(d=>{
        const m=dot(P.atoms[R.core]);
        m.position.copy(v3(d).normalize().multiplyScalar(P.radii[R.core]+0.17));
        og.add(m); return m;
      });
      // ghost markers showing WHERE a ligand is allowed to land
      const ghosts=slotDirs().map((d,i)=>{
        const m=new THREE.Mesh(Stage.Rsphere, new THREE.MeshBasicMaterial({
          color:P.atoms[R.ligand], transparent:true, opacity:0.18, depthWrite:false }));
        m.scale.setScalar(P.radii[R.ligand]*0.9);
        m.position.copy(v3(d).multiplyScalar(R.bond));
        m.userData.slot=i;
        og.add(m); return m;
      });
      group.add(og);
      core={group:og, sphere:osphere, cloud:ocloud, lonePairs, slotDots, ghosts};
      layoutLone();

      // three ligands — one more than fits, so "only two" is discovered, not
      // announced. The spare one has nowhere to be pulled and just drifts.
      R.start.forEach(p=>{
        const hg=new THREE.Group();
        hg.position.set(p[0],p[1],p[2]);
        const sphere=Stage.atom(P.atoms[R.ligand], P.radii[R.ligand], new THREE.Vector3(), R.ligand);
        const hcloud=cloud(R.ligand);
        const e=dot(P.atoms[R.ligand]);                  // its single valence electron
        hg.add(sphere, hcloud, e, label(R.ligand, R.ligand, '#2b2b2b'));
        group.add(hg);
        ligands.push({ group:hg, sphere, cloud:hcloud, electron:e,
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
      const dirs=(dim==='2d')?R.loneFlat:R.lone;
      core.lonePairs.forEach((pair,i)=>{
        const dir=v3(dirs[i]).normalize();
        const perp=new THREE.Vector3().crossVectors(dir,
          Math.abs(dir.z)<0.9?new THREE.Vector3(0,0,1):new THREE.Vector3(0,1,0)).normalize();
        const base=dir.clone().multiplyScalar(P.radii[R.core]+0.17);
        pair.forEach((m,k)=>m.position.copy(base).addScaledVector(perp,(k?1:-1)*0.16));
      });
    }

    /* 2D flattens everything onto z=0 — including the loose ligands, which
     * otherwise drift toward the camera and read as "bigger" rather than
     * "nearer". step() keeps holding them there while the mode lasts. */
    function setDim(d){
      dim=(d==='2d')?'2d':'3d';
      layoutLone();
      layoutBonds();          // the slots themselves moved — see layoutBonds()
      applyCel();
      if(dim==='2d') ligands.forEach(h=>{ h.group.position.z=0; h.vel.z=0; });
    }

    /* ---- bonding ------------------------------------------------------- */
    function slotPos(i){ return v3(slotDirs()[i]).multiplyScalar(R.bond); }
    function slotTaken(i){ return ligands.some(h=>h.slot===i); }
    // nearest OPEN slot to a ligand, or null when the core is full
    function bestSlot(h){
      let best=null, bd=Infinity;
      slotDirs().forEach((d,i)=>{
        if(slotTaken(i)) return;
        const dist=h.group.position.distanceTo(slotPos(i));
        if(dist<bd){ bd=dist; best={i, dist}; }
      });
      return best;
    }

    /* The shared pair sits ON the bond axis, in the gap between the two
     * SURFACES — not at the bond midpoint, which for O–H (bond 1.55, O radius
     * 0.95) is buried inside the core. The surfaces meet at 0.95 and 1.00
     * along the axis, so the pair goes at 0.975: visually right in the pinch
     * between the two spheres, which is where a shared pair belongs. The two
     * dots straddle the axis so the pair still reads as TWO electrons.
     * (They draw with depthTest:false, so the sliver of sphere in front of them
     * doesn't hide them — see dot().) */
    // where a slot's two shared dots belong, for the CURRENT view's geometry
    function pairPlacement(i){
      const b=slotPos(i);
      const along=b.clone().normalize();
      const gapMid=(P.radii[R.core] + (R.bond-P.radii[R.ligand]))/2;
      const center=along.clone().multiplyScalar(gapMid);
      /* Straddle the axis away from the OTHER bonds, so the pairs splay apart
       * instead of stacking. Summing the other slot dirs and negating gives that
       * for water (two slots) and for methane's flat cross; a real tetrahedron
       * cancels exactly — all four dirs sum to zero, so "away from the others"
       * is the bond's own axis and there is no preferred side. Fall back there
       * to whichever perpendicular sits furthest from every nucleus. */
      const dirs=slotDirs();
      let out=new THREE.Vector3();
      dirs.forEach((d,j)=>{ if(j!==i) out.sub(v3(d)); });
      out.addScaledVector(along, -out.dot(along));                // keep it ⊥ bond
      if(out.lengthSq()<0.01){
        const u=new THREE.Vector3().crossVectors(along,
          Math.abs(along.z)<0.9?new THREE.Vector3(0,0,1):new THREE.Vector3(0,1,0)).normalize();
        const v=new THREE.Vector3().crossVectors(along,u).normalize();
        const nuclei=[new THREE.Vector3()].concat(
          dirs.map((d,j)=>slotTaken(j)?slotPos(j):null).filter(Boolean));
        let bestScore=-Infinity;
        [u, v, u.clone().negate(), v.clone().negate()].forEach(d=>{
          const at=center.clone().addScaledVector(d, 0.2);
          const score=Math.min(...nuclei.map(c=>at.distanceTo(c)));
          if(score>bestScore){ bestScore=score; out=d.clone(); }
        });
      }
      out.normalize();
      return { center, out, end:b };
    }

    function makeSharedPair(i){
      const pair={slot:i, dots:[]};
      // one electron from each atom, still wearing the colour it arrived in
      [P.atoms[R.core], P.atoms[R.ligand]].forEach(col=>{
        const m=dot(col); group.add(m); pair.dots.push(m);
      });
      sharedPairs.push(pair);
      // a guide-line stick for the other view mode — thin, because in electron
      // mode the pair of dots is what is doing the explaining
      const st=Stage.bond(new THREE.Vector3(), slotPos(i), P.bonds.covalent, 0.10, 1);
      st.userData.slot=i;
      st.userData.len=slotPos(i).length();       // the length its geometry was cut at
      group.add(st); sticks.push(st);
      layoutBonds();
      applyCel();                       // a stick born in 2D is born cel-shaded
      applyMode();
    }

    /* Everything that hangs off a slot has to be re-placed when the slots move.
     * They do move: methane's four bonds are a tetrahedron in 3D and a flat cross
     * in 2D, so a pair positioned once at bond time is left pointing at where its
     * bond used to be the moment the view is switched. (Water never caught this —
     * its slots are already planar, so both views use the same dirs.) The dots
     * and the stick are cheap to re-place, so they are re-placed rather than
     * cached. */
    function layoutBonds(){
      // the core's own open-slot electrons and the ghost markers hang off the
      // same directions, so they travel with them
      if(core){
        const dirs=slotDirs();
        core.slotDots.forEach((m,i)=>
          m.position.copy(v3(dirs[i]).normalize().multiplyScalar(P.radii[R.core]+0.17)));
        core.ghosts.forEach((m,i)=>m.position.copy(slotPos(i)));
      }
      sharedPairs.forEach(p=>{
        const {center,out}=pairPlacement(p.slot);
        p.dots.forEach((m,k)=>m.position.copy(center).addScaledVector(out,(k?1:-1)*0.17));
      });
      sticks.forEach(st=>{
        const b=slotPos(st.userData.slot), len=b.length();
        st.position.copy(b).multiplyScalar(0.5);
        st.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), b.clone().normalize());
        st.scale.set(1, len/st.userData.len, 1);   // geometry was cut at userData.len
      });
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
      core.slotDots[i].visible=false;
      core.ghosts[i].visible=false;
      makeSharedPair(i);
      if(fx) fx.settleShimmer(h.sphere, P.atoms[R.core]);
      onChange(state());
    }
    function unbond(h){
      const i=h.slot; h.slot=null;
      dropSharedPair(i);
      core.ghosts[i].visible=(mode==='electrons');
      core.slotDots[i].visible=(mode==='electrons');
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
      const targets=ligands.map(h=>h.sphere);
      const hits=ray.intersectObjects(targets, false);
      if(!hits.length) return null;
      return ligands.find(h=>h.sphere===hits[0].object)||null;
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
    // keep a free ligand outside the core's surface (see TOUCH)
    function shell(h){
      const p=h.group.position, d=p.length();
      if(d>TOUCH || d<1e-4) return;
      p.multiplyScalar(TOUCH/Math.max(d,1e-4));
      h.vel.addScaledVector(p.clone().normalize(), -h.vel.dot(p.clone().normalize()));
    }

    function step(dt){
      dt=Math.min(dt||0.016, 0.05);
      t+=dt;

      ligands.forEach(h=>{
        if(dim==='2d'){ h.group.position.z=0; h.vel.z=0; }
        // its lone electron always faces the core — "this is the one I can share"
        if(h.slot==null){
          const toO=h.group.position.clone().negate();
          if(toO.lengthSq()>1e-6)
            h.electron.position.copy(toO.normalize().multiplyScalar(P.radii[R.ligand]+0.17));
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
           * as it closes. You feel the core take over before you let go, which
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

      // ghosts breathe, and brighten when a ligand is close enough to be caught
      core.ghosts.forEach((g,i)=>{
        if(!g.visible) return;
        const near=ligands.some(h=>h.slot==null &&
          h.group.position.distanceTo(slotPos(i))<S.CAPTURE);
        const base=near?0.42:0.16;
        g.material.opacity=base+0.05*Math.sin(t*3.2);
      });
    }

    /* ---- view mode ----------------------------------------------------- */
    function applyMode(){
      const e=(mode==='electrons');
      core.lonePairs.forEach(p=>p.forEach(m=>m.visible=e));
      core.slotDots.forEach((m,i)=>m.visible=e && !slotTaken(i));
      core.ghosts.forEach((m,i)=>m.visible=e && !slotTaken(i));
      core.cloud.visible=e;
      sharedPairs.forEach(p=>p.dots.forEach(d=>d.visible=e));
      ligands.forEach(h=>{
        h.cloud.visible=e;
        h.electron.visible=e && h.slot==null;
      });
      sticks.forEach(s=>s.visible=!e);
    }
    function setMode(m){ mode=(m==='sticks')?'sticks':'electrons'; applyMode(); }

    function state(){
      const bonded=ligands.filter(h=>h.slot!=null).length;
      return { bonded, open:slotDirs().length-bonded, complete:bonded===slotDirs().length,
               free:ligands.length-bonded };
    }

    function reset(){
      [...group.children].forEach(c=>group.remove(c));
      ligands=[]; sticks=[]; sharedPairs=[]; core=null; held=null;
      build();
      setDim(dim);
    }

    build();
    return { group, step, setMode, setDim, reset, destroy, state,
             /* Where the molecule IS, for effects that have to fire somewhere.
                The core happens to sit at the origin, but read the mesh
                rather than assuming it — the assumption is exactly what put the
                completion ring in empty space in the salt tab. */
             center:()=>core ? core.group.getWorldPosition(new THREE.Vector3())
                               : new THREE.Vector3(),
             get mode(){return mode;}, get dim(){return dim;} };
  }

  global.CovalentDrag={ create, S, RECIPES };
})(this);
