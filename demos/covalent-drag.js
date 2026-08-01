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
 *    w.fill();   // snap straight to the finished molecule (a re-opened lesson)
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
      /* WHERE THE PROTON COMES FROM.
       * A bare H⁺ dealt onto the bench was the one dishonest object on this page:
       * free protons do not sit around waiting: in water a proton is always
       * something a molecule is holding, and the only reason ammonia is a base
       * is that it can take one OFF a water molecule. So the second stage is not
       * handed a proton, it is handed WATER, and the student pulls the reaction
       * out of it. The stage says the same thing it always did about the dative
       * bond, and now also says where H⁺ came from and what is left behind.
       *
       * NH₃ + H₂O ⇌ NH₄⁺ + OH⁻, which is the reaction a textbook prints for
       * "ammonia is a weak base" — and the OH⁻ it leaves is why the solution is
       * basic. Not spawned on completion like the old proton was: the sticky's
       * button pours it in, so adding water is itself a thing the student did.
       */
      /* Dealt into clear paper: far enough right to read as a separate reagent,
       * low enough to clear the sticky note that is telling the student to drag
       * it. The three hydrogens are dealt around the other three quadrants. */
      water:{ start:[4.9,1.6,0.6] },
    },
    /* Hydrogen chloride is on this page for one reason: it is the SAME chlorine
     * the salt tabs use, on the other side of the argument. Sodium hands its
     * electron over and two ions are left holding each other by charge;
     * hydrogen shares one, and what is in the gap is a pair belonging to both.
     * Same atom, opposite outcome — which is the point students most often have
     * backwards, that a bond type is a property of the PAIR and not of an
     * element. Reading the tab strip left to right, it is also the acid to
     * ammonia's base: the H+ the lone pair accepts three tabs earlier is the one
     * this bond gives up in water.
     *
     * polar 0.8 sits where the electronegativity gap says it should: H–Cl is
     * 0.96, against O–H's 1.24 (weight 1) and N–H's 0.84 (weight 0.7). The core
     * is the electronegative end here, as in water and ammonia, so the default
     * direction is right and polarToward stays unset.
     *
     * Bond 1.85 is drawn-radius arithmetic, not ångströms: Cl 1.24 + H 0.55 =
     * 1.79, plus water's 0.05 of daylight. (The real thing is 1.27 Å.)
     */
    hcl: {
      core:'Cl', ligand:'H', bond:1.85, polar:0.8,
      slots:   [[1,0,0]],
      slots2d: [[1,0,0]],
      // three lone pairs, tetrahedral about the bond: cos(109.47°) = −1/3, and
      // the remaining 0.9428 spread evenly around the axis at 120°
      lone:     [[-0.3333,0.9428,0],[-0.3333,-0.4714,0.8165],[-0.3333,-0.4714,-0.8165]],
      // flat view puts them where they can be counted: N, W and S of the Cl,
      // with the bond going E. Eight around chlorine, two shared with hydrogen
      loneFlat: [[0,1,0],[-1,0,0],[0,-1,0]],
      start:[[5.2,1.6,-1.0]],
    },
    methane: {
      core:'C', ligand:'H', bond:1.50, polar:0,      // the nonpolar control
      slots:   [[S3,S3,S3],[S3,-S3,-S3],[-S3,S3,-S3],[-S3,-S3,S3]],
      slots2d: [[0,1,0],[1,0,0],[0,-1,0],[-1,0,0]],
      lone:[], loneFlat:[],
      start:[[-5.2,-1.4,1.0],[5.2,1.2,-1.2],[-1.6,5.0,-1.4],[1.8,-5.0,1.4]],
    },
    /* Carbon dioxide is the first recipe where one slot is not one pair. Carbon
     * has four electrons and only two neighbours, so each slot has to take TWO —
     * and the count is the whole argument: the student can flip to 2D and find
     * eight electrons around every atom, which is only true because the bonds
     * doubled. `order` is that number, and everything hung off a slot (the core's
     * spare dots, the shared pairs, the stick) is drawn `order` times.
     *
     * It is also the first recipe where the CORE is the positive end. C–O pulls
     * toward oxygen, the opposite of O–H and N–H, so `polarToward` names the
     * direction instead of leaving it implied — and the payoff is that the two
     * dipoles point opposite ways along one line and cancel. `netDipole:false`
     * says so out loud, because "polar bonds, nonpolar molecule" is exactly the
     * thing a student gets wrong, and the page should not make them infer it from
     * two badges pointing away from each other.
     *
     * Oxygen arrives carrying lone pairs of its own — the first ligand that does.
     * Hydrogen had one electron and nothing left over; oxygen brings six, two of
     * which go into the bond, and the other four have to be somewhere or the
     * octet does not close. */
    co2: {
      /* 2.10, not the ~1.7 a real C=O would suggest scaled against water's O–H.
       * The display radii are stylised and large — C 0.85 + O 0.95 is 1.80 on its
       * own — so a bond shorter than that buries the shared pairs INSIDE the two
       * spheres, and a double bond you cannot count is not a double bond. Every
       * recipe has to clear the sum of its two radii; water does (1.50 against
       * 1.55). A MULTIPLE bond needs more than that bare clearance, because its
       * pairs straddle the axis and so occupy the gap lengthwise as well as
       * across it — 2.10 leaves ~0.30 of open gap for a ±0.11 straddle to sit in. */
      core:'C', ligand:'O', bond:2.10, polar:0.7, polarToward:'ligand',
      netDipole:false,
      order:2,
      slots:   [[1,0,0],[-1,0,0]],
      slots2d: [[1,0,0],[-1,0,0]],
      lone:[], loneFlat:[],                  // all four of carbon's are in bonds
      ligandLone:{ n:2, mode:'perp' },       // sp: the two pairs sit off the axis
      /* Well OFF the bond axis, unlike every earlier recipe's scatter. With only
       * two ligands and both slots on one straight line, starting them near that
       * line puts them at the edges of the frame AND makes the molecule look
       * half-assembled on load — the linear shape should be the result of
       * bonding, not the arrangement it started in.
       *
       * The constraint that actually sets these numbers is S.CAPTURE: a ligand
       * that starts within 3.4 of its SLOT is already inside the core's pull and
       * flies in on its own, so the student watches the molecule assemble itself
       * instead of building it. That distance is measured slot-to-atom, not
       * origin-to-atom, and CO2's slots are 2.10 out along the very axis the
       * atoms would otherwise sit on — so clearing the radius takes either more
       * height or more width than a hydrogen recipe needs.
       * It has to be width. The stage is wider than it is tall and the tab strip
       * and the dock own the top and bottom of it, so an atom parked high enough
       * to clear 3.4 vertically lands underneath the cards. ±5.2 matches
       * methane's scatter exactly, which keeps the framing behaving like every
       * other tab at every window size, and 2.4 of height puts it 3.9 from the
       * slot — more margin than water's nearest hydrogen has. */
      start:[[-5.2,2.4,1.2],[5.2,-2.4,-1.2]],
    },
    /* Nitrogen gas: the same doubling taken one step further, and the cheapest
     * possible demonstration that bond order is a real quantity. Two identical
     * atoms, so there is no polarity to draw and nothing to distract from the
     * count — five valence electrons each, three into the bond, one pair left
     * over on each end pointing away down the axis. It is also the reason
     * nitrogen fixation is expensive, which is the fact that actually earns it a
     * place in a biology page: three shared pairs is the strongest bond in the
     * whole sandbox, and life needs it broken.
     *
     * Ligand and core are the same element here, which the engine allows and
     * nothing else in the file assumes otherwise — TOUCH, the radii and the
     * colours all read per-element. */
    n2: {
      // 2.15 for the reason CO2 is 1.95: two nitrogens are 0.90 + 0.90 of drawn
      // radius, and three pairs need more room in the gap than two do
      core:'N', ligand:'N', bond:2.15, polar:0,      // identical atoms: no dipole
      order:3,
      slots:   [[1,0,0]],
      slots2d: [[1,0,0]],
      lone:     [[-1,0,0]],                  // the core's, pointing away
      loneFlat: [[-1,0,0]],
      ligandLone:{ n:1, mode:'axial' },      // the ligand's, pointing the far way
      // off the bond axis and clear of S.CAPTURE, for CO2's reasons exactly:
      // 3.9 from the slot, so the triple bond is one the student pulled together
      start:[[5.2,2.4,-1.0]],

    },
  };
  /* Bond order per slot. A number applies to every slot (CO2's two doubles, N2's
   * one triple); the older recipes have none and mean 1. Kept a function rather
   * than a field so a future recipe with MIXED orders — a carboxyl's C=O and C–O
   * off one carbon — only has to make `order` an array. */
  function orderOf(R, i){
    const o=R.order;
    return Array.isArray(o) ? (o[i]||1) : (o||1);
  }

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
    // sticks suppressed while a view change is still moving the atoms — setDim()
    let stickHold=false, holdT=null;
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
      if(water){
        kit.cel([water.sphere].concat(water.hs.filter(Boolean).map(h=>h.sphere)), on);
        kit.cel(water.sticks.filter(Boolean), on, false);
      }
    }

    function v3(a){ return new THREE.Vector3(a[0],a[1],a[2]); }

    /* Every element symbol goes through here so nobody picks an ink or a depth
     * mode by hand: atomkit owns both, and registers the sprite so kit.setDim()
     * can find it again when the view flips. */
    function atomLabel(el){
      const s=label(el, el); s.setDim(dim); return s;
    }

    /* Two vectors perpendicular to `dir`, for anything that has to fan out
     * AROUND an axis: the electrons on a double bond's slot, the two shared
     * pairs in the gap, the parallel sticks. In 2D the first one is forced into
     * the z=0 plane, because a fan that spreads toward the camera collapses to a
     * single dot in the one view whose entire job is letting you count. */
    function basis(dir){
      const along=dir.clone().normalize();
      let u;
      if(dim==='2d'){
        u=new THREE.Vector3(-along.y, along.x, 0);            // in-plane normal
        if(u.lengthSq()<1e-6) u=new THREE.Vector3(1,0,0);
      }else{
        u=new THREE.Vector3().crossVectors(along,
          Math.abs(along.z)<0.9?new THREE.Vector3(0,0,1):new THREE.Vector3(0,1,0));
      }
      u.normalize();
      return { along, u, v:new THREE.Vector3().crossVectors(along,u).normalize() };
    }
    /* Where the k-th of n things sits when they straddle an axis: evenly spaced
     * and CENTRED on it, so a single one is dead on the axis (which is what every
     * pre-existing recipe wants) and two or three splay symmetrically about it
     * without the axis itself ever looking occupied when it isn't. */
    function fan(dir, k, n, spread){
      if(n<=1) return new THREE.Vector3();
      const {u}=basis(dir);
      return u.clone().multiplyScalar((k-(n-1)/2)*spread);
    }

    /* ---- build the starting scatter ----------------------------------- */
    function build(){
      // the core: nucleus + cloud + its own valence electrons
      const og=new THREE.Group();
      const osphere=Stage.atom(P.atoms[R.core], P.radii[R.core], new THREE.Vector3(), R.core);
      const ocloud=cloud(R.core);
      og.add(osphere, ocloud, atomLabel(R.core));
      // two lone PAIRS (four electrons, spoken for) — positions come from
      // layoutLone(), because they move when the view flips to 2D
      const lonePairs=[];
      // … and the UNPAIRED electrons, `order` of them on each open slot: the ones
      // free to share, which is why water is H₂O and not H₃O — and why carbon,
      // with four of them across two slots, has to double both bonds.
      // A group per slot, so a slot is still one thing to show, hide and place;
      // slotSpread() fans the members apart when there is more than one.
      const slotDots=slotDirs().map((d,i)=>{
        const g=new THREE.Group();
        for(let k=0;k<orderOf(G(),i);k++) g.add(dot(P.atoms[R.core]));
        og.add(g); return g;
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
      R.start.forEach((p,i)=>{
        const hg=new THREE.Group();
        hg.position.set(p[0],p[1],p[2]);
        const sphere=Stage.atom(P.atoms[R.ligand], P.radii[R.ligand], new THREE.Vector3(), R.ligand);
        const hcloud=cloud(R.ligand);
        /* The electrons this ligand has to OFFER — one for hydrogen, two for a
         * doubly-bonded oxygen, three for nitrogen. Grouped for the same reason
         * the core's are: the count is what the flat view exists to let you
         * check, and it has to be right on both ends of the bond, not just the
         * interesting one. */
        const e=new THREE.Group();
        for(let k=0;k<orderOf(R, i);k++) e.add(dot(P.atoms[R.ligand]));
        /* … and the ones it does NOT offer. Hydrogen has none, which is why no
         * recipe needed this until now; oxygen brings six and spends two, and the
         * remaining four have to be drawn or CO2's octets do not close. They hang
         * off the ligand and are placed relative to the bond it makes. */
        const lone=[];
        for(let k=0;k<((R.ligandLone&&R.ligandLone.n)||0);k++){
          const pair=[dot(P.atoms[R.ligand]), dot(P.atoms[R.ligand])];
          pair.forEach(m=>hg.add(m)); lone.push(pair);
        }
        hg.add(sphere, hcloud, e, atomLabel(R.ligand));
        group.add(hg);
        ligands.push({ group:hg, sphere, cloud:hcloud, electron:e, lone,
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
      core.lonePairs.forEach(pair=>pair.forEach(m=>{ core.group.remove(m); kit.forget(m); }));
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

    /* A ligand's own electrons, placed in its LOCAL frame against the bond it is
     * making (or about to make). Everything is oriented off `toCore`, so a loose
     * oxygen already shows which two electrons it is offering and which four it
     * is keeping, and nothing jumps when it lands.
     *
     *  · the offered electrons face the core — "these are the ones I can share",
     *    fanned apart when there is more than one so the count survives 2D
     *  · an AXIAL lone pair sits on the far side, straight down the bond line:
     *    N2's leftover pair, the one pointing out of the back of each nitrogen
     *  · PERPENDICULAR pairs ride off the axis: CO2's oxygens are sp, and their
     *    two pairs genuinely sit across the bond rather than behind it
     */
    function layoutLigand(h){
      const toCore=h.slot!=null ? slotPos(h.slot).clone().negate()
                                : h.group.position.clone().negate();
      if(toCore.lengthSq()<1e-6) return;
      const axis=toCore.normalize();                 // ligand → core, local frame
      const out=P.radii[R.ligand]+GAP;
      const n=h.electron.children.length;
      h.electron.position.copy(axis).multiplyScalar(out);
      h.electron.children.forEach((m,k)=>m.position.copy(fan(axis, k, n, 0.28)));
      if(!h.lone || !h.lone.length) return;
      const mode2=(R.ligandLone&&R.ligandLone.mode)||'axial';
      const {u,v}=basis(axis);
      h.lone.forEach((pair,i)=>{
        // axial: behind the atom. perp: fanned across the bond, ±u in 2D so both
        // stay in the plane the flat view can count in, ±v adding depth in 3D.
        const dir = mode2==='axial'
          ? axis.clone().negate()
          : (dim==='2d' ? u.clone().multiplyScalar(i?-1:1)
                        : u.clone().multiplyScalar(i?-1:1).addScaledVector(v, 0.35).normalize());
        const base=dir.clone().multiplyScalar(out);
        const straddle=new THREE.Vector3().crossVectors(dir,
          Math.abs(dir.z)<0.9?new THREE.Vector3(0,0,1):new THREE.Vector3(0,1,0)).normalize();
        pair.forEach((m,k)=>m.position.copy(base).addScaledVector(straddle,(k?1:-1)*0.16));
      });
    }

    /* 2D flattens everything onto z=0 — including the loose ligands, which
     * otherwise drift toward the camera and read as "bigger" rather than
     * "nearer". step() keeps holding them there while the mode lasts. */
    function setDim(d){
      const moved=(dim!==((d==='2d')?'2d':'3d'));
      dim=(d==='2d')?'2d':'3d';
      /* A slot that moved takes its stick with it INSTANTLY — layoutBonds puts
       * the stick on the new axis in one frame — while the atom it connects
       * only lerps there over the next few (step()). So for a moment the sticks
       * are drawn in the new geometry and the spheres are still in the old one,
       * which reads as the bonds coming loose. Holding them until the atoms
       * have arrived turns that into: the molecule folds up, THEN it is bonded.
       * Long enough to cover step()'s lerp, which is ~95% settled by 0.3s. */
      if(moved){ stickHold=true; clearTimeout(holdT);
                 holdT=setTimeout(()=>{ stickHold=false; applyMode(); }, 340); }
      kit.setDim(dim);   // light letters in 3D, dark on flat paper — and solid vs overlay
      layoutLone();
      layoutBonds();          // the slots themselves moved — see layoutBonds()
      layoutWater();
      applyCel();
      // the frame itself can be off z=0 now that the core is draggable, and a
      // molecule floating in front of the Lewis plane is exactly the "bigger vs
      // nearer" confusion the flat view exists to remove
      if(dim==='2d'){
        group.position.z=0;
        ligands.forEach(h=>{ h.group.position.z=0; h.vel.z=0; });
        if(water){ water.group.position.z=0; water.vel.z=0; }
      }
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
      /* Toward the core for O–H and N–H, toward the LIGAND for C=O — carbon is
       * the electron-poor end, so a pair drawn leaning on carbon would say the
       * opposite of the truth and take CO2's whole lesson with it. */
      const pull=(R.polar||0)*0.08*(R.polarToward==='ligand'?-1:1);
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

    function makeSharedPair(i, dative, quiet){
      const n=orderOf(G(), i);
      for(let idx=0; idx<n; idx++){
        const pair={slot:i, index:idx, dots:[]};
        /* One electron from each atom, still wearing the colour it arrived in —
         * except a DATIVE bond, where the core paid for both. Drawing both dots in
         * the core's colour is the whole argument: the proton brought nothing, so
         * there is no second colour to show. */
        (dative ? [P.atoms[R.core], P.atoms[R.core]]
                : [P.atoms[R.core], P.atoms[R.ligand]]).forEach(col=>{
          /* overlay: a shared pair sits in the pinch BETWEEN two surfaces, which
             for water is 0.92 against an oxygen of radius 0.95 — inside the
             nucleus. Depth-testing it would not dim it, it would delete it, and
             with it the count the bond is made of. */
          const m=dot(col, {overlay:true}); group.add(m); pair.dots.push(m);
        });
        sharedPairs.push(pair);
        // a guide-line stick for the other view mode — thin, because in electron
        // mode the pair of dots is what is doing the explaining. One per pair, so
        // stick mode shows the bond ORDER too rather than flattening C=O to C–O.
        const st=Stage.bond(new THREE.Vector3(), slotPos(i), P.bonds.covalent, 0.10, 1);
        st.userData.slot=i; st.userData.index=idx;
        st.userData.len=slotPos(i).length();     // the length its geometry was cut at
        group.add(st); sticks.push(st);
      }
      // a multiple bond arrives one pair at a time — see stepStagger()
      if(n>1 && !quiet) stagger(i, n);
      layoutBonds();
      applyCel();                       // a stick born in 2D is born cel-shaded
      applyMode();
    }

    /* ---- the doubling, made watchable ---------------------------------
     * A double bond formed in one silent instant is a fact the page asserts. The
     * drag is still ONE gesture — the student should not have to know in advance
     * that carbon wants two pairs here — but the pairs land in sequence, ~0.22s
     * apart, so the second one is a visible event with its own arrival. That is
     * the difference between "this bond is double" and "watch it become double",
     * and it is the only moment on the page where bond order is a thing that
     * happens rather than a thing that is drawn.
     *
     * Held as a slot-keyed job rather than per-pair state so a bond broken
     * mid-animation takes its own stagger with it and nothing is left invisible.
     */
    let staggers=[];
    function stagger(slot, n){
      staggers=staggers.filter(s=>s.slot!==slot);
      staggers.push({slot, n, k:0});
      applyStagger(staggers[staggers.length-1]);
    }
    function applyStagger(s){
      const shown=Math.min(s.n, Math.floor(s.k/0.22)+1);
      const e=(mode==='electrons');
      sharedPairs.forEach(p=>{ if(p.slot===s.slot)
        p.dots.forEach(m=>m.visible = e && p.index<shown); });
      sticks.forEach(st=>{ if(st.userData.slot===s.slot)
        st.visible = !e && !stickHold && st.userData.index<shown; });
      return shown>=s.n;
    }
    function stepStagger(dt){
      if(!staggers.length) return;
      staggers=staggers.filter(s=>{ s.k+=dt; return !applyStagger(s); });
    }
    function dropStagger(slot){ staggers=staggers.filter(s=>s.slot!==slot); }

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
        core.slotDots.forEach((g,i)=>{
          const d=v3(dirs[i]).normalize();
          g.position.copy(d).multiplyScalar(P.radii[R.core]+GAP);
          // the spares on a double/triple slot fan apart so they can be counted;
          // a single one stays dead on the bond axis, as it always was
          g.children.forEach((m,k)=>m.position.copy(fan(d, k, g.children.length, 0.30)));
        });
        core.ghosts.forEach((m,i)=>m.position.copy(slotPos(i)));
      }
      /* A slot's pairs stack ACROSS the bond, never along it — a double bond is
       * two pairs side by side in the same gap, and drawing them one behind the
       * other would read as one pair drawn twice.
       *
       * A multiple bond is laid out as a GRID, n rows of 2, which is the glyph a
       * textbook draws: the two dots of a pair straddle the bond AXIS, and the
       * pairs stack perpendicular to it. So a double bond is a 2×2 block and a
       * triple is 3×2, and the grouping is unambiguous in both directions —
       * whereas putting all 2n dots on one perpendicular line leaves "two pairs"
       * and "four loose electrons" distinguished only by spacing, which is
       * exactly the thing a student is being asked to tell apart.
       * Both axes are chosen in-plane by basis(), so the block survives the flat
       * view instead of collapsing toward the camera.
       * A single bond keeps its old behaviour exactly: pairPlacement's `out`,
       * chosen to lean away from the other bonds. */
      sharedPairs.forEach(p=>{
        const {center,out}=pairPlacement(p.slot);
        const n=orderOf(G(), p.slot);
        if(n<=1){
          p.dots.forEach((m,k)=>m.position.copy(center).addScaledVector(out,(k?1:-1)*0.17));
          return;
        }
        const b=slotPos(p.slot);
        const across=basis(b).u;                       // perpendicular: the rows
        const along=b.clone().normalize();             // the bond: the columns
        const row=(p.index-(n-1)/2)*0.34;
        p.dots.forEach((m,k)=>m.position.copy(center)
          .addScaledVector(across, row)
          .addScaledVector(along, (k?1:-1)*0.11));
      });
      sticks.forEach(st=>{
        const b=slotPos(st.userData.slot), len=b.length();
        const n=orderOf(G(), st.userData.slot);
        st.position.copy(b).multiplyScalar(0.5)
          .add(fan(b, st.userData.index, n, 0.26));   // parallel lines = bond order
        st.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), b.clone().normalize());
        st.scale.set(1, len/st.userData.len, 1);   // geometry was cut at userData.len
      });
      // a bonded ligand's leftover pairs hang off the slot it landed in, and the
      // slots move between views — so they are re-placed here with everything else
      ligands.forEach(h=>{ if(h.slot!=null && !h.isProton) layoutLigand(h); });
    }

    function dropSharedPair(i){
      dropStagger(i);
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
    /* Which end is which. Water and ammonia keep the core negative; CO2 is the
     * inverse and says so, and getting this from the recipe rather than from the
     * shape of the code is what lets one engine draw both without either one
     * being the special case. */
    function deltas(){
      return R.polarToward==='ligand' ? {core:'δ+', ligand:'δ−'}
                                      : {core:'δ−', ligand:'δ+'};
    }
    function showPolarity(){
      if(!R.polar || protonated) return;
      const sign=deltas();
      const bonded=ligands.filter(x=>x.slot!=null && !x.isProton);
      if(!core.delta && bonded.length){
        core.delta=kit.charge(sign.core, '#'+new THREE.Color(P.atoms[R.core]).getHexString(),
                              R.core, 0.85);
        core.group.add(core.delta);
      }
      bonded.forEach(x=>{
        if(!x.delta){
          x.delta=kit.charge(sign.ligand, '#'+new THREE.Color(P.atoms[R.ligand]).getHexString(),
                             R.ligand, 0.8);
          x.group.add(x.delta);
        }
        // parked on the far side of the ligand, pointing away from the core: the
        // kit's default shoulder position aims at the core on half the bonds,
        // straight into the shared pair the badge is supposed to be explaining
        kit.place(x.delta, x.group.position.clone().normalize()
                            .multiplyScalar(P.radii[R.ligand]*1.15));
        // SCIENCE.md §2: the density is drawn shifted toward whichever atom wants
        // the electrons more, never symmetric. For O–H that is the core, so the
        // ligand's haze leans back along its own bond; for C=O it is the oxygen,
        // so the haze leans the other way, out along the bond and off carbon.
        if(x.cloud) x.cloud.position.copy(x.group.position).normalize()
          .multiplyScalar(0.16*R.polar*(R.polarToward==='ligand'?1:-1));
      });
    }
    function hidePolarity(h){
      if(h && h.delta){ h.group.remove(h.delta); kit.forget(h.delta); h.delta=null;
                        if(h.cloud) h.cloud.position.set(0,0,0); }
      const anyBonded=ligands.some(x=>x.slot!=null && !x.isProton);
      if(!anyBonded && core && core.delta){ core.group.remove(core.delta); kit.forget(core.delta); core.delta=null; }
    }

    /* `quiet` is fill()'s: the bond is being restored, not made, so it gets no
     * settle shimmer and its shared pair is placed rather than staggered in.
     * Every effect on this page means "this just happened", and none of it did. */
    function bond(h, i, quiet){
      h.slot=i; h.vel.set(0,0,0);
      h.group.position.copy(slotPos(i));
      // the two electrons that merge into the shared pair are the two that were
      // just visible on the free atoms — hide them, don't create new ones
      h.electron.visible=false;
      // the protonated stage adds a slot that never had a ghost or a spare
      // electron of its own — its pair came from the lone pair
      if(core.slotDots[i]) core.slotDots[i].visible=false;
      if(core.ghosts[i]) core.ghosts[i].visible=false;
      makeSharedPair(i, false, quiet);
      if(fx && !quiet) fx.settleShimmer(h.sphere, P.atoms[R.core]);
      showPolarity();
      /* Nothing is dealt onto the bench when the molecule finishes any more —
       * the reagent is water, and it arrives when the student pours it in. See
       * offerWater(). */
      onChange(state());
    }
    /* Re-open a molecule the student has already built: every free ligand lands
     * in a slot at once, through the same bond() a drag would call. Not a second
     * way to be bonded — a shortcut to the state the mechanic itself produces,
     * which is why the shared pairs, the polarity badges and (on ammonia) the
     * proton all arrive with it. The neutral molecule only: the extra stage is
     * still something to do, not something to be handed. */
    function fill(){
      ligands.forEach(h=>{
        if(h.slot!=null || h.isProton) return;
        const b=bestSlot(h);
        if(b) bond(h, b.i, true);
      });
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
    function spawnProton(at){
      const g=new THREE.Group();
      const st=at || v3(R.proton.start);
      g.position.copy(st);
      const sphere=Stage.atom(P.atoms[R.ligand], P.radii[R.ligand]*0.92,
                              new THREE.Vector3(), R.ligand);
      const badge=kit.charge('+', '#'+new THREE.Color(P.atoms[R.ligand]).getHexString(),
                             R.ligand);
      g.add(sphere, atomLabel(R.ligand), badge);
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
      h.group.remove(h.badge); kit.forget(h.badge);
      /* Every δ comes off, not just nitrogen's. Ammonium's charge is a whole +1
       * belonging to the ION, spread over all five atoms — four separate δ+
       * badges would read as four partial charges that happen to add up, which
       * is a different claim — and with the four N–H bonds now identical, there
       * is no hydrogen to single out anyway. The bonds are still polar and the
       * clouds still lean toward nitrogen; what is gone is the labelling of
       * partial charges on a species whose charge is not partial. */
      if(core.delta){ core.group.remove(core.delta); kit.forget(core.delta); core.delta=null; }
      ligands.forEach(x=>{ if(x.delta){ x.group.remove(x.delta); kit.forget(x.delta); x.delta=null; } });
      core.charge=kit.charge('+', '#'+new THREE.Color(P.atoms[R.core]).getHexString(), R.core);
      core.group.add(core.charge);
      layoutBonds();                       // 107° → 109.5°: the other three move
      /* Amber, and a ring rather than the ionic flash: SCIENCE.md §5 gives proton
       * chemistry the warm amber vocabulary, and this IS the moment the molecule
       * becomes an ion. Fired here rather than by the page because only the
       * module knows where the proton landed. */
      if(fx){
        /* A covalent bond's ring expands from the molecule, because the bond
         * belongs to both atoms. A DATIVE bond's expands from the DONOR, in the
         * donor's own colour, because it does not: nitrogen paid for it. Same
         * effect, moved and recoloured — the variant should read as "a covalent
         * bond, but from here", which is what a dative bond is.
         * The shimmer stays amber (SCIENCE.md §5, proton/acid chemistry) because
         * the other half of this moment is that the molecule became an ion. */
        fx.spawnRing(core.group.getWorldPosition(new THREE.Vector3()), P.atoms[R.core],
                     core.group);   // NH₄⁺ is still draggable — ride it (fx.js)
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
      if(core.charge){ core.group.remove(core.charge); kit.forget(core.charge); core.charge=null; }
      h.group.add(h.badge);                // it leaves as a proton, as it arrived
      buildLonePairs();
      showPolarity();                      // back to a neutral polar molecule                    // the pair goes back to being a pair
      layoutBonds();
      onChange(state());
    }


    /* ---- the water reagent: where the proton actually comes from ---------
     * A whole H2O molecule, drawn to the same rules as the water TAB (same
     * dirs, same bond length, two lone pairs, a shared pair in each gap), that
     * the student drags at ammonia's lone pair. Close enough and it hands over
     * a proton — the H goes, its electron does NOT, and what is left is
     * hydroxide.
     *
     * The electron bookkeeping is the lesson, so it is animated rather than
     * stated: the two dots that were in the O–H gap do not vanish and get
     * replaced by a lone pair, they MOVE OUT to where the lone pair belongs,
     * and the H-coloured one turns oxygen-coloured on the way. That is the same
     * sentence ionic-drag.js writes when its electron changes colour in flight
     * — an electron wears its owner's colour — and it is what makes "OH⁻ keeps
     * both electrons" something you can watch instead of something you are
     * told. It is also why the charge lands on oxygen: it kept an electron that
     * used to be hydrogen's.
     *
     * Deliberately NOT a second CovalentDrag instance. Water here is a reagent,
     * not a lesson: it is never built, never taken apart, and has no slots to
     * fill. Sharing the class would mean carrying a whole molecule's worth of
     * interaction to draw one that only has to arrive and split.
     */
    const WATER={
      bond:1.55,
      /* The reagent gets its OWN capture radius, much shorter than a ligand's
       * (S.CAPTURE 3.4). A ligand is a loose atom looking for a slot and should
       * feel pulled from across the bench; water is a whole molecule the student
       * is supposed to STEER, and at the ligand's radius it was inside the
       * attraction the moment it was dealt — it flew in on its own and the drag
       * the lesson is built on never happened. Short enough that the last
       * stretch is still not the mouse's doing, and no further. */
      capture:2.2,
      /* How near the donor hydrogen has to get before the proton goes. Its own
       * number rather than S.SNAP (0.42, which a covalent bond earns by landing
       * IN a slot): nothing is being aimed here — an approaching acid and base
       * do not have to line up, they only have to meet — so the reaction should
       * fire from the distance a student reads as "touching", not from the
       * tolerance a slot needs. */
      snap:1.0,
      dirs:   [[0.7910,-0.6116,0], [-0.7910,-0.6116,0]],
      lone:    [[0,0.6116,0.7910], [0,0.6116,-0.7910]],
      loneFlat:[[0.6116,0.7910,0], [-0.6116,0.7910,0]],
    };
    let water=null;
    function hexOf(el){ return '#'+new THREE.Color(P.atoms[el]).getHexString(); }

    function offerWater(){
      if(water || !R.water || !protonReady()) return;
      const g=new THREE.Group();
      g.position.copy(v3(R.water.start));
      group.add(g);
      const osphere=Stage.atom(P.atoms.O, P.radii.O, new THREE.Vector3(), 'O');
      g.add(osphere, atomLabel('O'));
      const hs=WATER.dirs.map(d=>{
        const hg=new THREE.Group();
        hg.position.copy(v3(d).multiplyScalar(WATER.bond));
        hg.add(Stage.atom(P.atoms.H, P.radii.H, new THREE.Vector3(), 'H'), atomLabel('H'));
        g.add(hg);
        return { group:hg, sphere:hg.children[0], dir:v3(d).normalize() };
      });
      /* One dot from each atom, exactly as every other bond on this page draws
       * one — which is what makes the split legible later: you can see WHICH of
       * the two stays behind. */
      const pairs=hs.map(()=>[dot(P.atoms.O,{overlay:true}), dot(P.atoms.H,{overlay:true})]);
      pairs.forEach(p=>p.forEach(m=>g.add(m)));
      const lones=[[dot(P.atoms.O),dot(P.atoms.O)], [dot(P.atoms.O),dot(P.atoms.O)]];
      lones.forEach(p=>p.forEach(m=>g.add(m)));
      const wsticks=hs.map(h=>{
        const st=Stage.bond(new THREE.Vector3(), h.group.position, P.bonds.covalent, 0.10, 1);
        st.userData.len=WATER.bond;
        g.add(st); return st;
      });
      water={ group:g, sphere:osphere, hs, pairs, lones, sticks:wsticks, badge:null,
              vel:new THREE.Vector3(), slot:null, dragging:false, spent:false, split:null };
      layoutWater();
      applyCel(); applyMode();
      onChange(state());
    }

    /* Same job layoutLone()/layoutBonds() do for the core, for the reagent: the
     * lone pairs swing into the plane in 2D, and a shared pair straddles the
     * bond across an axis the camera can see. */
    function layoutWater(){
      if(!water) return;
      const lone=(dim==='2d')?WATER.loneFlat:WATER.lone;
      water.lones.forEach((pair,i)=>{
        /* The pair hydroxide inherited is the last one, and it does not sit on a
         * lone-pair DIRECTION from the table — it sits along the bond that is no
         * longer there, which is the whole point of it. Skipped entirely while
         * the split animation still owns its dots. */
        const d=(i<lone.length) ? v3(lone[i]) : (water.freeDir||new THREE.Vector3(0,1,0));
        if(i>=lone.length && water.split) return;
        const base=d.clone().normalize().multiplyScalar(P.radii.O+GAP);
        const across=basis(d).u;
        pair.forEach((m,k)=>m.position.copy(base).addScaledVector(across,(k?1:-1)*0.16));
      });
      water.hs.forEach((h,i)=>{
        const pair=water.pairs[i]; if(!pair) return;
        // the pinch between the two surfaces, leaning toward oxygen: O–H is the
        // page's most unequal covalent bond and water's own tab draws it so
        const b=h.group.position;
        const centre=b.clone().normalize().multiplyScalar(
          P.radii.O + (WATER.bond-P.radii.O-P.radii.H)*0.5 - 0.12);
        const across=basis(b).u;
        pair.forEach((m,k)=>m.position.copy(centre).addScaledVector(across,(k?1:-1)*0.17));
      });
      water.sticks.forEach((st,i)=>{
        const h=water.hs[i]; if(!st || !h || !st.visible) return;
        st.position.copy(h.group.position).multiplyScalar(0.5);
        st.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),
                                         h.group.position.clone().normalize());
      });
    }

    /* Which H is going to leave: whichever one is already nearest the lone pair.
     * Chosen per frame rather than fixed at build time, so a student who
     * approaches from the other side donates the other hydrogen — the molecule
     * is symmetric and the page should not pretend one of them is special. */
    function waterPos(local){
      return local.clone().applyQuaternion(water.group.quaternion).add(water.group.position);
    }
    function donorH(target){
      let best=null, bd=Infinity;
      water.hs.forEach((h,i)=>{
        if(!h) return;
        const d=waterPos(h.group.position).distanceTo(target);
        if(d<bd){ bd=d; best={h, i, dist:d}; }
      });
      return best;
    }

    function stepWater(dt){
      if(!water) return;
      if(dim==='2d'){ water.group.position.z=0; water.vel.z=0; }
      /* Solid nuclei, the same rule shell() gives a loose ligand: a student who
       * drags the water straight at the nitrogen must not be able to push it
       * THROUGH — two molecules interpenetrating is the one thing that makes
       * this stop reading as matter. Stopping it just outside also leaves the
       * donor hydrogen exactly where the approach can take over. */
      const wshell=P.radii.O+P.radii[R.core]+0.55;
      const d0=water.group.position.length();
      if(d0<wshell && d0>1e-4) water.group.position.multiplyScalar(wshell/d0);
      if(water.split) stepSplit(dt);
      if(water.spent){                       // hydroxide: drifting away, inert
        /* And once it has arrived, the park is DROPPED. It is expressed in group
         * space, so a live one drags the hydroxide along behind the ammonium
         * every time the student moves the molecule — which says the two are one
         * object. They are not: the proton left, and what is on the paper is two
         * separate species. (They do attract — opposite charges, the salt tabs'
         * whole lesson — but that is a force between two things, not a frame
         * they share.) Dropped, moveFrame's push-back is the only thing left
         * touching it, and it stays where it is in the world. */
        if(water.park){
          water.group.position.lerp(water.park, 1-Math.pow(0.25, dt));
          if(water.group.position.distanceTo(water.park)<0.05) water.park=null;
        }
        return;
      }
      const target=protonTarget(); if(!target) return;
      const d=donorH(target); if(!d) return;
      /* Turn to face before closing: a water molecule that arrived sideways and
       * then teleported its hydrogen into the bond would undo the one thing the
       * approach is for. Slerp, so it reads as the molecule orienting itself the
       * way a real one does in a field. */
      if(d.dist<WATER.capture*3){          // turns to face well before it closes
        const want=new THREE.Quaternion().setFromUnitVectors(
          d.h.dir, target.clone().sub(water.group.position).normalize());
        water.group.quaternion.slerp(want, 1-Math.pow(0.02, dt));
      }
      if(d.dist<WATER.capture){
        // where the oxygen has to stand for its hydrogen to be ON the lone pair
        const stand=target.clone().sub(
          d.h.dir.clone().applyQuaternion(water.group.quaternion).multiplyScalar(WATER.bond));
        /* The reaction fires DURING the drag, not on release. Ammonia taking a
         * proton off water is the easiest thing on this page — it happens in
         * every glass of ammonia solution without anyone deciding to do it — so
         * making the student carry the water in and then let go put a deliberate
         * act in front of a spontaneous one. Same shape as a ligand's approach
         * in step(): inside the capture radius the molecule stops tracking the
         * pointer exactly and leans in, harder the closer it gets, so you feel
         * the lone pair take it before it goes. */
        if(water.dragging){
          const lean=stand.clone().sub(water.group.position);
          const k=1-(d.dist/WATER.capture);          // 0 at the edge → 1 at the pair
          if(lean.lengthSq()>1e-8)
            water.group.position.addScaledVector(lean.normalize(), lean.length()*k*k*0.55);
        }else{
          water.group.position.lerp(stand, 1-Math.pow(0.004, dt));
        }
        if(d.dist<WATER.snap) splitWater(d);
      }else if(!water.dragging){
        water.vel.multiplyScalar(Math.pow(S.DAMP, dt*60));
        water.group.position.addScaledVector(water.vel, dt);
      }
    }

    /* The reaction. The H leaves as a bare proton (spawnProton + protonate, the
     * same two calls the old dealt-out H+ went through, so the dative bond, the
     * flare, the ring and the +1 all happen exactly as before) and everything
     * else here is about what STAYS. */
    function splitWater(d){
      const at=waterPos(d.h.group.position);
      water.group.remove(d.h.group);
      water.hs[d.i]=null;
      const stick=water.sticks[d.i];
      if(stick){ water.group.remove(stick); water.sticks[d.i]=null; }
      /* The gap's two electrons stay, and become a lone pair pointing where the
       * bond used to. Animated by stepSplit(): they slide out from the pinch to
       * the lone-pair site, and hydrogen's dot turns oxygen's colour, because it
       * now belongs to oxygen. */
      const pair=water.pairs[d.i];
      water.pairs[d.i]=null;
      water.lones.push(pair);
      water.freeDir=d.h.dir.clone();
      water.split={ k:0, pair, from:pair.map(m=>m.position.clone()),
                    dir:d.h.dir.clone(),
                    c0:new THREE.Color(P.atoms.H), c1:new THREE.Color(P.atoms.O) };
      water.spent=true;
      /* Hydroxide, and the minus goes on the OXYGEN: it is holding an electron
       * that used to be hydrogen's. Same badge vocabulary as the salt tabs. */
      water.badge=kit.charge('−', hexOf('O'), 'O');
      water.group.add(water.badge);
      /* The two products have to SEPARATE, or the student reads the toast over
       * a hydroxide parked on top of the ammonium it came off. A parking spot
       * rather than a shove: velocity through this module's damping dies in
       * about a tenth of a second and would barely move it.
       * Back to where the water was dealt, rather than along the line it came
       * in on: that spot is already chosen to be clear paper, while "away from
       * the molecule" points wherever the student happened to approach from —
       * which, coming over the top, parks the hydroxide on the ammonium. */
      water.park=v3(R.water.start).multiplyScalar(1.1);
      /* Let go of it. The student is still holding the pointer down on what is
       * now a hydroxide, and leaving the grab attached would have them dragging
       * the product around while it is trying to drift clear — and fighting the
       * park. The reaction ends the drag, which is also how it reads: the thing
       * you were holding is not the thing that is there now. */
      if(held===water){ held=null; water.dragging=false; canvas.style.cursor=''; }
      spawnProton(at);
      protonate(proton);
      applyCel(); applyMode();
      layoutWater();
    }
    function stepSplit(dt){
      const sp=water.split;
      sp.k=Math.min(1, sp.k+dt/0.55);
      // the site the vacated bond direction becomes: straight out along it
      const base=sp.dir.clone().multiplyScalar(P.radii.O+GAP);
      const across=basis(sp.dir).u;
      sp.pair.forEach((m,k)=>{
        const to=base.clone().addScaledVector(across,(k?1:-1)*0.16);
        m.position.lerpVectors(sp.from[k], to, sp.k);
        if(k===1) m.material.color.copy(sp.c0).lerp(sp.c1, sp.k);   // it changed owner
      });
      if(sp.k>=1) water.split=null;
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
    /* The core is grabbable too, and returns a sentinel rather than a ligand:
     * moving it is a different operation (see moveFrame) even though it starts
     * from the same pointerdown. */
    const CORE={};
    /* A covalent bond does not come apart because you pulled on it. Once a ligand
     * is in a slot, dragging it moves the WHOLE MOLECULE — the same operation as
     * dragging the core — instead of stretching until it snaps. That is the
     * lesson the salt tabs are the control for: there, the two ions can be pulled
     * apart, because what holds them is attraction between charges rather than a
     * shared pair. Making the covalent bond literally unbreakable by hand is a
     * stronger statement of "stronger" than any wording in a toast.
     *
     * The one bond that still lets go is ammonia's DATIVE bond, and it is not an
     * exception to the rule so much as different chemistry: NH4+ ⇌ NH3 + H+ is a
     * genuinely reversible acid-base equilibrium, and dragging the proton back
     * off is the second half of that tab's lesson. See unbond()/deprotonate(). */
    function framed(h){ return h===CORE || (h && h.slot!=null && !h.isProton); }
    function pick(e){
      toNdc(e); ray.setFromCamera(ndc, camera);
      const targets=ligands.map(h=>h.sphere);
      if(core) targets.push(core.sphere);
      /* Every sphere of the water molecule grabs the WHOLE molecule — it is a
       * reagent, not a construction set, and letting a student pull one of its
       * hydrogens off by hand would be a second, undiscoverable way to do the
       * reaction that skips the electron bookkeeping entirely. */
      if(water){
        targets.push(water.sphere);
        water.hs.forEach(h=>{ if(h) targets.push(h.sphere); });
      }
      const hits=ray.intersectObjects(targets, false);
      if(!hits.length) return null;
      if(core && hits[0].object===core.sphere) return CORE;
      if(water && (hits[0].object===water.sphere ||
                   water.hs.some(h=>h && h.sphere===hits[0].object))) return water;
      return ligands.find(h=>h.sphere===hits[0].object)||null;
    }

    /* Dragging anything framed() moves the molecule's whole FRAME — the group —
     * rather than that atom inside it. Every piece of bonded geometry (slot
     * positions,
     * ghost markers, sticks, shared pairs, lone pairs) is expressed relative to
     * a core sitting at the group's origin, and rewriting all of that to carry an
     * offset would be a large change with a lot of places to get subtly wrong.
     * Moving the frame keeps all of it exactly true, for free.
     *
     * The catch, and the reason for the second half: a LOOSE ligand is not part
     * of the molecule and must not be towed along by it. So each unbonded atom is
     * pushed back by the same delta in group space, which pins it where it was in
     * the world while the frame slides out from under it.
     *
     * `anchor` is the grabbed atom's group: the frame shifts by however far THAT
     * has to travel to reach the pointer, which is what makes dragging a bonded
     * hydrogen feel like towing the molecule by it rather than like moving the
     * core from a distance. */
    function moveFrame(worldTarget, anchor){
      const at=anchor.getWorldPosition(new THREE.Vector3());
      const before=group.position.clone();
      group.position.copy(group.parent.worldToLocal(
        group.getWorldPosition(new THREE.Vector3()).add(worldTarget.clone().sub(at))));
      const delta=group.position.clone().sub(before);
      ligands.forEach(h=>{
        if(h.slot==null && h!==held) h.group.position.sub(delta);
      });   // the ammonia proton is in `ligands` too, so it is covered here
      if(water && water!==held) water.group.position.sub(delta);   // ...and the reagent
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
      held=h;
      if(h!==CORE){ h.dragging=true; h.vel.set(0,0,0); }
      const world=(h===CORE?core.group:h.group).getWorldPosition(new THREE.Vector3());
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
      if(framed(held)){
        moveFrame(p.add(grabOffset), held===CORE?core.group:held.group);
        return;
      }
      const want=group.worldToLocal(p.add(grabOffset));   // atoms live in group space
      // only the dative proton can still be pulled off — see framed()
      if(held.slot!=null && want.distanceTo(slotPos(held.slot))>S.BREAK) unbond(held);
      held.group.position.copy(want);
    }
    function onUp(){
      if(!held) return;
      if(held!==CORE) held.dragging=false;
      held=null;
      canvas.style.cursor='';
    }
    surface.addEventListener('pointerdown', onDown, true);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);

    /* Tabs swap one lesson for another, so a module has to be able to take
     * itself off the page completely — a stale pointer handler would keep
     * grabbing atoms that are no longer visible. */
    function destroy(){
      clearTimeout(holdT); stickHold=false;   // no applyMode() on a torn-down sim
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
      kit.faceCamera(camera);   // 3D letters ride their own front surface

      ligands.forEach(h=>{
        if(dim==='2d'){ h.group.position.z=0; h.vel.z=0; }
        // its lone electron always faces the core — "this is the one I can share"
        if(h.slot==null && !h.isProton) layoutLigand(h);

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
      stepStagger(dt);
      stepWater(dt);

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
        // a ligand's LONE pairs survive bonding — that is what makes them lone —
        // so unlike its offered electrons they stay on once the bond forms
        if(h.lone) h.lone.forEach(pr=>pr.forEach(m=>m.visible=e));
      });
      sticks.forEach(s=>s.visible=!e && !stickHold);
      if(water){
        water.lones.forEach(p=>p.forEach(m=>m.visible=e));
        water.pairs.forEach(p=>{ if(p) p.forEach(m=>m.visible=e); });
        water.sticks.forEach(st=>{ if(st) st.visible=!e; });
        if(!e) layoutWater();          // a stick only gets placed while it is shown
      }
      // a multiple bond mid-arrival owns its own pairs' visibility; letting the
      // blanket assignments above stand would pop the whole bond in at once
      staggers.forEach(applyStagger);
    }
    function setMode(m){ mode=(m==='sticks')?'sticks':'electrons'; applyMode(); }

    /* The reagent is only offered to a FINISHED, un-protonated molecule: the
     * lone pair has to exist and be free for the reaction to mean anything. */
    function protonReady(){ return !!R.proton && !protonated &&
                            bondedCount()>=R.slots.length; }
    function bondedCount(){ return ligands.filter(h=>h.slot!=null && !h.isProton).length; }
    function state(){
      const bonded=bondedCount();
      const slots=R.slots.length;                 // the NEUTRAL molecule's slots
      return { bonded, open:Math.max(0,slots-bonded), complete:bonded>=slots,
               protonated, hasProton:!!proton,
               /* the page needs both: whether the reagent can still be poured
                  in, and whether it has already done its job */
               canOfferWater:!!R.water && protonReady() && !water,
               hasWater:!!water && !water.spent,
               hydroxide:!!water && water.spent,
               free:ligands.length-bonded,
               /* Bond order, and whether the bond dipoles survive being added up.
                  Both are recipe facts rather than run-time ones, but the page
                  narrates from `state` and should not have to reach into
                  RECIPES to find out whether it just watched a double bond. */
               order:orderOf(R,0), netDipole:R.netDipole!==false,
               // pairs actually shared: 2 per bond in CO2, 3 in N2. The number a
               // student would be asked for, and not derivable from `bonded`.
               pairs:ligands.reduce((n,h)=>n+(h.slot!=null&&!h.isProton?orderOf(R,h.slot):0),0) };
    }

    function reset(){
      [...group.children].forEach(c=>group.remove(c));
      group.position.set(0,0,0);      // Reset re-centres the frame, not just the atoms
      ligands=[]; sticks=[]; sharedPairs=[]; core=null; held=null;
      kit.clear();                    // the old letters and dots go with them
      protonated=false; proton=null; staggers=[]; dative=null; water=null;
      build();
      setDim(dim);
    }

    build();
    return { group, step, setMode, setDim, reset, destroy, state, fill, offerWater,
             /* Where the molecule IS, for effects that have to fire somewhere.
                The core happens to sit at the origin, but read the mesh
                rather than assuming it — the assumption is exactly what put the
                completion ring in empty space in the salt tab. */
             center:()=>core ? core.group.getWorldPosition(new THREE.Vector3())
                               : new THREE.Vector3(),
             /* The same place, as the OBJECT rather than a reading of it. An
                effect handed only center() is pinned to wherever the molecule
                was at the instant it fired — and a bonded ligand tows the whole
                frame (see framed()), so finishing a molecule and carrying on
                dragging used to leave the completion ring behind in empty
                paper. Pass this to fx and the ring rides along. */
             anchor:()=>core?core.group:null,
             get mode(){return mode;}, get dim(){return dim;} };
  }

  global.CovalentDrag={ create, S, RECIPES };
})(this);
