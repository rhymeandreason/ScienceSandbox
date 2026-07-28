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
 *       carbon four at 109.5°, and the bench holds exactly that many ligands —
 *       the molecule is finished when the bench is empty.
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
  /* `polar` is how unequally the pair is shared, 0 (dead centre) to 1 (as far
   * toward the core as this page will draw it). It is a stylised weight from the
   * electronegativity difference, NOT a dipole moment: O–H is 1.24 and gets 1,
   * N–H is 0.84 and gets 0.7, C–H is 0.35 and gets 0 because chemistry calls a
   * C–H bond nonpolar. Its whole job is to place the shared pair off-centre, so
   * that water's "shared" and methane's "shared" are visibly not the same word —
   * and to earn the δ badges, which appear only where there is a real charge
   * separation to label. SCIENCE.md §2 requires the density be drawn shifted
   * toward oxygen and never symmetric; this is that rule, applied to the object
   * this page already uses to mean "the shared electrons".
   */
  const RECIPES = {
    water: {
      core:'O', ligand:'H', bond:1.55, polar:1,
      slots:   [[0.7910,-0.6116,0], [-0.7910,-0.6116,0]],
      slots2d: [[0.7910,-0.6116,0], [-0.7910,-0.6116,0]],
      lone:     [[0,0.6116,0.7910], [0,0.6116,-0.7910]],
      loneFlat: [[0.6116,0.7910,0], [-0.6116,0.7910,0]],
      start:[[-5.0,-1.2,1.2],[5.0,1.4,-1.0]],
    },
    /* Ammonia is the only recipe with a SECOND stage, and it is the reason to
     * have one: nitrogen's three slots fill to NH3 and its lone pair is left
     * over, and that leftover pair is not decoration — it is a docking site. A
     * bare proton (a hydrogen with NO electron, which is why it draws no dot and
     * wears a +) lands in it, and nitrogen supplies BOTH electrons of the new
     * bond. That is a dative bond, the one bonding type the other tabs cannot
     * show: water's tab is "one electron each", salt's is "hand it over", and
     * this is "one atom pays for the whole bond".
     *
     * `proton` holds the geometry AFTER it lands. The three N–H bonds barely
     * move (107° → 109.5°) because the lone pair stops taking up more room than
     * a bond the moment it becomes one — the shape change IS the explanation for
     * why ammonia was 107° in the first place. Slot order is preserved so bonds
     * 0/1/2 stay themselves and the proton takes index 3.
     */
    ammonia: {
      core:'N', ligand:'H', bond:1.50, polar:0.7,
      slots:   [[0.9272,-0.3746,0],[-0.4635,-0.3748,0.8029],[-0.4635,-0.3748,-0.8029]],
      slots2d: [[0.8660,-0.5,0],[-0.8660,-0.5,0],[0,-1,0]],
      lone:     [[0,1,0]],
      loneFlat: [[0,1,0]],
      start:[[-5.0,-1.4,1.2],[5.0,1.2,-1.0],[-1.4,4.8,-1.4]],
      proton:{
        slots:   [[0.9428,-0.3333,0],[-0.4714,-0.3333,0.8165],[-0.4714,-0.3333,-0.8165],[0,1,0]],
        slots2d: [[0.8660,-0.5,0],[-0.8660,-0.5,0],[0,-1,0],[0,1,0]],
        lone:[], loneFlat:[],
        start:[4.6,4.2,0],
      },
    },
    methane: {
      core:'C', ligand:'H', bond:1.50, polar:0,      // the nonpolar control
      slots:   [[S3,S3,S3],[S3,-S3,-S3],[-S3,S3,-S3],[-S3,-S3,S3]],
      slots2d: [[0,1,0],[1,0,0],[0,-1,0],[-1,0,0]],
      lone:[], loneFlat:[],
      start:[[-5.2,-1.4,1.0],[5.2,1.2,-1.2],[-1.6,5.0,-1.4],[1.8,-5.0,1.4]],
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
    let protonated=false, proton=null;
    // after the proton lands the molecule is a different shape with one more
    // slot, so every direction lookup goes through here
    function G(){ return (protonated && R.proton) ? R.proton : R; }
    function slotDirs(){ return (dim==='2d')?G().slots2d:G().slots; }
    function loneDirs(){ return (dim==='2d')?G().loneFlat:G().lone; }
    let t=0;

    /* ---- pieces: the shared dressing lives in atomkit.js --------------
     * Electron dots, clouds, letters and the cel/outline treatment are the
     * VOCABULARY of the lesson, not its mechanic, so both bonding tabs read
     * them from the same kit. What stays here is the covalent physics. */
    const kit=AtomKit.create(THREE);
    const dot=kit.dot, cloud=kit.cloud, label=kit.label;
    const GAP=kit.DOT_GAP;   // surface → electron, shared by every lesson
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
      const lonePairs=[];
      // … and two UNPAIRED electrons, one on each open slot: the two that are
      // free to share, which is why water is H₂O and not H₃O.
      const slotDots=slotDirs().map(d=>{
        const m=dot(P.atoms[R.core]);
        m.position.copy(v3(d).normalize().multiplyScalar(P.radii[R.core]+GAP));
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
      buildLonePairs();

      // exactly as many ligands as there are slots: scattered wide enough that
      // none starts inside the core's capture radius, so every bond is one the
      // student made rather than one that happened on load
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
    /* Rebuildable, because ammonia's lone pair is not permanent furniture: a
     * proton lands in it and it becomes a bond. Deprotonating puts it back. */
    function buildLonePairs(){
      core.lonePairs.forEach(pair=>pair.forEach(m=>core.group.remove(m)));
      core.lonePairs=loneDirs().map(()=>{
        const pair=[dot(P.atoms[R.core]), dot(P.atoms[R.core])];
        pair.forEach(m=>core.group.add(m));
        return pair;
      });
      layoutLone();
      applyMode();
    }
    function layoutLone(){
      const dirs=loneDirs();
      core.lonePairs.forEach((pair,i)=>{
        if(!dirs[i]) return;
        const dir=v3(dirs[i]).normalize();
        const perp=new THREE.Vector3().crossVectors(dir,
          Math.abs(dir.z)<0.9?new THREE.Vector3(0,0,1):new THREE.Vector3(0,1,0)).normalize();
        const base=dir.clone().multiplyScalar(P.radii[R.core]+GAP);
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
      /* Dead centre of the gap between the two SURFACES is where an equally
       * shared pair belongs. A polar bond pulls it toward the core — not all the
       * way onto it, which would be the ionic picture, but visibly off the middle
       * and biased toward the atom that wants the electrons more. */
      const gapMid=(P.radii[R.core] + (R.bond-P.radii[R.ligand]))/2;
      /* Small on purpose. The stylised radii leave only ~0.05 between the two
       * surfaces, so any pull at all puts the pair inside the core's silhouette;
       * pushed further it stops reading as "shared, unequally" and starts
       * reading as "transferred", which is the salt tab's picture, not this one.
       * The δ badges and the leaning cloud carry the rest of the argument. */
      const pull=(R.polar||0)*0.08;
      const center=along.clone().multiplyScalar(gapMid-pull);
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

    function makeSharedPair(i, dative){
      const pair={slot:i, dots:[]};
      /* One electron from each atom, still wearing the colour it arrived in —
       * except a DATIVE bond, where the core paid for both. Drawing both dots in
       * the core's colour is the whole argument: the proton brought nothing, so
       * there is no second colour to show. */
      (dative ? [P.atoms[R.core], P.atoms[R.core]]
              : [P.atoms[R.core], P.atoms[R.ligand]]).forEach(col=>{
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
          m.position.copy(v3(dirs[i]).normalize().multiplyScalar(P.radii[R.core]+GAP)));
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

    /* δ badges, and the cloud shifted toward the core. Both appear only on a
     * polar recipe and only on bonds that actually exist: an unbonded hydrogen
     * has no charge separation to label, and labelling it would say the atom is
     * charged rather than the BOND being lopsided. Methane's polar:0 means it
     * never gets either, which is the point of having it next door. */
    function showPolarity(){
      if(!R.polar) return;
      const bonded=ligands.filter(x=>x.slot!=null && !x.isProton);
      if(!core.delta && bonded.length){
        core.delta=kit.charge('δ−', '#'+new THREE.Color(P.atoms[R.core]).getHexString(),
                              R.core, 0.85);
        core.group.add(core.delta);
      }
      bonded.forEach(x=>{
        if(!x.delta){
          x.delta=kit.charge('δ+', '#'+new THREE.Color(P.atoms[R.ligand]).getHexString(),
                             R.ligand, 0.8);
          x.group.add(x.delta);
        }
        // parked on the far side of the ligand, pointing away from the core: the
        // kit's default shoulder position aims at the core on half the bonds,
        // straight into the shared pair the badge is supposed to be explaining
        x.delta.position.copy(x.group.position).normalize()
          .multiplyScalar(P.radii[R.ligand]*1.15);
        // SCIENCE.md §2: the density is drawn shifted toward the core, never
        // symmetric. The ligand's haze leans back along its own bond.
        if(x.cloud) x.cloud.position.copy(
          x.group.position.clone().normalize().multiplyScalar(-0.16*R.polar));
      });
    }
    function hidePolarity(h){
      if(h && h.delta){ h.group.remove(h.delta); h.delta=null;
                        if(h.cloud) h.cloud.position.set(0,0,0); }
      const anyBonded=ligands.some(x=>x.slot!=null && !x.isProton);
      if(!anyBonded && core && core.delta){ core.group.remove(core.delta); core.delta=null; }
    }

    function bond(h, i){
      h.slot=i; h.vel.set(0,0,0);
      h.group.position.copy(slotPos(i));
      // the two electrons that merge into the shared pair are the two that were
      // just visible on the free atoms — hide them, don't create new ones
      h.electron.visible=false;
      // the protonated stage adds a slot that never had a ghost or a spare
      // electron of its own — its pair came from the lone pair
      if(core.slotDots[i]) core.slotDots[i].visible=false;
      if(core.ghosts[i]) core.ghosts[i].visible=false;
      makeSharedPair(i);
      if(fx) fx.settleShimmer(h.sphere, P.atoms[R.core]);
      showPolarity();
      if(R.proton && !proton && bondedCount()===R.slots.length) spawnProton();
      onChange(state());
    }
    function unbond(h){
      if(h.isProton) return deprotonate(h);
      const i=h.slot; h.slot=null;
      dropSharedPair(i);
      if(core.ghosts[i]) core.ghosts[i].visible=(mode==='electrons');
      if(core.slotDots[i]) core.slotDots[i].visible=(mode==='electrons');
      h.electron.visible=(mode==='electrons');
      hidePolarity(h);
      onChange(state());
    }

    /* ---- the proton: a hydrogen with no electron ------------------------
     * It appears only once the neutral molecule is finished, because that is
     * when the lone pair is the only thing left to react with. It draws no
     * electron dot (it has none — that is what makes it a proton) and wears a +
     * so the missing dot reads as a charge rather than as a rendering slip.
     */
    function spawnProton(){
      const g=new THREE.Group();
      g.position.set(R.proton.start[0], R.proton.start[1], R.proton.start[2]);
      const sphere=Stage.atom(P.atoms[R.ligand], P.radii[R.ligand]*0.92,
                              new THREE.Vector3(), R.ligand);
      const badge=kit.charge('+', '#'+new THREE.Color(P.atoms[R.ligand]).getHexString(),
                             R.ligand);
      g.add(sphere, label(R.ligand, R.ligand, '#2b2b2b'), badge);
      group.add(g);
      proton={ group:g, sphere, badge, cloud:null,
               electron:{visible:false, position:new THREE.Vector3()},
               vel:new THREE.Vector3(), slot:null, dragging:false, isProton:true };
      ligands.push(proton);
      applyCel();
    }
    // where it docks: straight into the lone pair it is aiming for
    function protonTarget(){
      const d=loneDirs()[0];
      return d ? v3(d).normalize().multiplyScalar(R.bond) : null;
    }
    function protonate(h){
      protonated=true;                     // slot set becomes the 4-bond geometry
      // the lone pair is not replaced by a bond — it BECOMES one
      core.lonePairs.forEach(pair=>pair.forEach(m=>core.group.remove(m)));
      core.lonePairs=[];
      const i=slotDirs().length-1;
      h.slot=i; h.vel.set(0,0,0);
      // NOT snapped to the slot: the per-frame lerp for bonded ligands glides it
      // the last stretch, so you watch the proton arrive onto the waiting pair
      makeSharedPair(i, true);
      flarePair(i);
      /* The proton's own + comes off as the molecule's + goes on: the charge did
       * not arrive and then sit there being carried by one atom, it became a
       * property of the whole ion. Two badges would say it is still the
       * hydrogen's. */
      h.group.remove(h.badge);
      // δ− becomes a whole +: the ion's charge is not a partial one any more
      if(core.delta){ core.group.remove(core.delta); core.delta=null; }
      core.charge=kit.charge('+', '#'+new THREE.Color(P.atoms[R.core]).getHexString(), R.core);
      core.group.add(core.charge);
      layoutBonds();                       // 107° → 109.5°: the other three move
      /* Amber, and a ring rather than the ionic flash: SCIENCE.md §9 gives proton
       * chemistry the warm amber vocabulary, and this IS the moment the molecule
       * becomes an ion. Fired here rather than by the page because only the
       * module knows where the proton landed. */
      if(fx){
        /* A covalent bond's ring expands from the molecule, because the bond
         * belongs to both atoms. A DATIVE bond's expands from the DONOR, in the
         * donor's own colour, because it does not: nitrogen paid for it. Same
         * effect, moved and recoloured — the variant should read as "a covalent
         * bond, but from here", which is what a dative bond is.
         * The shimmer stays amber (SCIENCE.md §9, proton/acid chemistry) because
         * the other half of this moment is that the molecule became an ion. */
        fx.spawnRing(core.group.getWorldPosition(new THREE.Vector3()), P.atoms[R.core]);
        fx.settleShimmer(core.sphere, 0xffc24d);
      }
      onChange(state());
    }

    /* The dative animation, and why it is a FLARE rather than a journey: the
     * lone pair hardly moves. Nitrogen's lone-pair site is 1.07 from the nucleus
     * and the bond's pinch is 0.93 — a tenth of a unit apart. Sliding the dots
     * between them was invisible, and worse, it implied the pair travelled to
     * meet the proton when the truth is the opposite: the pair stays exactly
     * where it always was and the PROTON comes to it. So the proton glides the
     * last stretch (the ordinary bonded-ligand lerp does that once its slot is
     * set) and the two donor dots swell and settle — "these two, the ones that
     * were already here, are now the bond". The swell is deliberately small: a
     * dot that balloons stops reading as an electron and starts reading as an
     * effect, and this one has to stay the same two electrons throughout. */
    let dative=null;
    function flarePair(slot){
      const p=sharedPairs.find(x=>x.slot===slot); if(!p) return;
      dative={ dots:p.dots, k:0 };
    }
    function stepDative(dt){
      if(!dative) return;
      dative.k=Math.min(1, dative.k+dt/0.5);
      const swell=Math.sin(dative.k*Math.PI);         // 0 → 1 → 0
      dative.dots.forEach(m=>m.scale.setScalar(0.1*(1+0.35*swell)));
      if(dative.k>=1){ dative.dots.forEach(m=>m.scale.setScalar(0.1)); dative=null; }
    }
    function deprotonate(h){
      protonated=false;
      const i=h.slot; h.slot=null;
      dropSharedPair(i);
      dative=null;
      if(core.charge){ core.group.remove(core.charge); core.charge=null; }
      h.group.add(h.badge);                // it leaves as a proton, as it arrived
      buildLonePairs();
      showPolarity();                      // back to a neutral polar molecule                    // the pair goes back to being a pair
      layoutBonds();
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
        if(h.slot==null && !h.isProton){
          const toO=h.group.position.clone().negate();
          if(toO.lengthSq()>1e-6)
            h.electron.position.copy(toO.normalize().multiplyScalar(P.radii[R.ligand]+GAP));
        }

        if(h.slot!=null){                   // bonded: sit on the slot
          h.group.position.lerp(slotPos(h.slot), 1-Math.pow(0.001, dt));
          return;
        }
        // the proton has exactly one place to go: the lone pair
        const pTarget=h.isProton ? protonTarget() : null;
        const b=h.isProton ? (pTarget?{i:-1}:null) : bestSlot(h);
        if(!b){ h.vel.multiplyScalar(Math.pow(S.DAMP, dt*60));
                h.group.position.addScaledVector(h.vel, dt); return; }
        const target=pTarget || slotPos(b.i);
        const land=()=>h.isProton ? protonate(h) : bond(h, b.i);
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
          if(h.group.position.distanceTo(target)<S.SNAP) land();
        }else{
          // released (or never touched): a real inverse-square-ish pull-in
          if(d<S.CAPTURE){
            const f=S.PULL/Math.max(d*d, 0.25);
            h.vel.addScaledVector(toSlot.normalize(), f*dt);
          }
          h.vel.multiplyScalar(Math.pow(S.DAMP, dt*60));
          h.group.position.addScaledVector(h.vel, dt);
          shell(h);
          if(h.group.position.distanceTo(target)<S.SNAP) land();
        }
      });

      stepDative(dt);

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
        if(h.cloud) h.cloud.visible=e;
        if(h.electron) h.electron.visible=e && h.slot==null && !h.isProton;
      });
      sticks.forEach(s=>s.visible=!e);
    }
    function setMode(m){ mode=(m==='sticks')?'sticks':'electrons'; applyMode(); }

    function bondedCount(){ return ligands.filter(h=>h.slot!=null && !h.isProton).length; }
    function state(){
      const bonded=bondedCount();
      const slots=R.slots.length;                 // the NEUTRAL molecule's slots
      return { bonded, open:Math.max(0,slots-bonded), complete:bonded>=slots,
               protonated, hasProton:!!proton,
               free:ligands.length-bonded };
    }

    function reset(){
      [...group.children].forEach(c=>group.remove(c));
      ligands=[]; sticks=[]; sharedPairs=[]; core=null; held=null;
      protonated=false; proton=null;
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
