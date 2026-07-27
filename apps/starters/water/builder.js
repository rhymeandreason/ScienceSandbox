/* =============================================================================
 *  builder.js — valence-gated molecule assembly (the "build it yourself" lesson)
 * =============================================================================
 *  Loaded as a classic script AFTER molecules.js + scene.js + fx.js. Exposes
 *  window.Builder. Knows nothing about the page's UI — it owns the *rules*:
 *
 *    1. VALENCE   — an atom bonds only while it has a free slot. This is the
 *                   whole covalent lesson: you cannot put a third H on oxygen,
 *                   because oxygen has room for two. The rule is enforced, not
 *                   explained, so the student discovers H₂O rather than being
 *                   told it.
 *    2. GEOMETRY  — free slots sit at real VSEPR angles (104.5° bent, 109.5°
 *                   tetrahedral, 180° linear), so shape is taught by where the
 *                   atoms are allowed to go, not by a caption.
 *    3. TRANSFER  — metals don't share, they GIVE. Na + Cl is not a stick bond;
 *                   the electron moves, both atoms become ions, and what holds
 *                   them together is charge attraction. Ionic vs covalent falls
 *                   out of the same interaction instead of needing a mode switch.
 *
 *  SIMPLIFYING ASSUMPTION: every target here is one CENTRAL atom plus terminal
 *  atoms (H₂O, CH₄, CO₂) or a single ion pair (NaCl, KCl). That covers the
 *  intro bonding lesson and keeps the assembly model to "core + ligands" — no
 *  ring closure, no chains, no stereochemistry. Chains would need a real graph
 *  and a layout pass; if a later lesson wants them, that is a rewrite of
 *  addAtom(), not an extension of it.
 *
 *  Usage:
 *    const b = Builder.create({THREE, root, fx});
 *    b.setTarget('water');       // → {name, formula, prompt, …}
 *    b.addAtom('H');             // → {ok:true, bonded:'covalent'} | {ok:false, why:'…'}
 *    b.check();                  // → {complete:true, …} once it matches
 *    b.step();                   // per-frame (ghost slot pulse)
 * ========================================================================== */
(function(global){
  'use strict';

  /* ---- elements the builder offers -------------------------------------
   * `valence` is bonding capacity, NOT electron count: the number of covalent
   * slots the atom brings. `gives`/`needs` drive the ionic path — a metal has
   * one loose electron to hand over and no covalent slots at all, which is
   * exactly why Na cannot be talked into sharing.
   */
  /* `electrons` is the count of VALENCE electrons — which is the reason the slot
   * count is what it is, and worth showing rather than asserting. Oxygen brings
   * 6: two pair off as lone pairs and two stay unpaired, so exactly 2 are
   * available to share. That's the slot count, derived. Carbon brings 4, all
   * unpaired → 4 slots. Hydrogen brings 1 → 1. The dots make the rule visible
   * instead of magic.
   */
  const ELEMENTS = {
    H:  { name:'Hydrogen',  kind:'nonmetal', valence:1, electrons:1, needs:0 },
    O:  { name:'Oxygen',    kind:'nonmetal', valence:2, electrons:6, needs:2 },
    C:  { name:'Carbon',    kind:'nonmetal', valence:4, electrons:4, needs:4 },
    N:  { name:'Nitrogen',  kind:'nonmetal', valence:3, electrons:5, needs:3 },
    Cl: { name:'Chlorine',  kind:'nonmetal', valence:1, electrons:7, needs:1 },
    Na: { name:'Sodium',    kind:'metal',    valence:0, electrons:1, gives:1 },
    K:  { name:'Potassium', kind:'metal',    valence:0, electrons:1, gives:1 },
  };

  const ELECTRON_COLOR = 0xffc93c;   // warm yellow: reads on red O and steel H alike

  /* ---- VSEPR slot directions -------------------------------------------
   * Lifted from the molecules.js specs on purpose, not re-derived: water's H's
   * really are at (±1.226,−0.948,0)/1.55 and methane's at (±1,±1,±1)/√3. Using
   * the same numbers means a molecule the student BUILDS is geometrically
   * identical to the same molecule the other pages LOAD — no drift between the
   * builder's water and molecule-lab's water.
   */
  const S3 = 1/Math.sqrt(3);
  /* `lone` = directions for the lone PAIRS that don't bond. They sit opposite the
   * bonding slots, which is the honest reason water is 104.5° and not the 109.5°
   * a bare tetrahedron would give: the two lone pairs on oxygen take up more room
   * than the bonds and squeeze them together. Showing them explains the angle.
   */
  const SHAPES = {
    linear:      { angle:'180°',   dirs:[[1,0,0],[-1,0,0]], lone:[] },
    bent:        { angle:'104.5°', dirs:[[0.7910,-0.6116,0],[-0.7910,-0.6116,0]],
                                   lone:[[0,0.6116,0.7910],[0,0.6116,-0.7910]] },
    pyramidal:   { angle:'107°',   dirs:[[0.9271,-0.3746,0],
                                         [-0.4634,-0.3746,0.8026],
                                         [-0.4634,-0.3746,-0.8026]],
                                   lone:[[0,1,0]] },
    tetrahedral: { angle:'109.5°', dirs:[[S3,S3,S3],[S3,-S3,-S3],[-S3,S3,-S3],[-S3,-S3,S3]],
                                   lone:[] },
  };
  // a free ion's remaining pairs just spread out tetrahedrally
  const ION_PAIR_DIRS = [[S3,S3,S3],[S3,-S3,-S3],[-S3,S3,-S3],[-S3,-S3,S3]];

  /* ---- bond lengths (stylised, matching molecules.js) -------------------
   * Every length must EXCEED the sum of the two display radii or the spheres
   * merge and swallow the bond stick — the project's one global rule. Water's
   * O–H 1.55 against radii 0.95+0.55=1.50 sets the convention; the ionic pairs
   * are deliberately roomier because nothing is shared across that gap.
   */
  const BOND_LEN = {
    'O-H':1.55, 'C-H':1.50, 'N-H':1.50, 'C-O':1.90, 'C-Cl':2.10,
    'Na-Cl':2.55, 'K-Cl':2.70,
  };
  function bondLen(a,b){
    return BOND_LEN[a+'-'+b] || BOND_LEN[b+'-'+a] ||
           ((global.MolLib.PALETTE.radii[a]||0.7)+(global.MolLib.PALETTE.radii[b]||0.7))*1.35;
  }

  /* ---- the lesson: four targets, covalent → ionic ----------------------
   * Ordered so the RULE generalizes before the exception arrives. Water and
   * methane establish "share until you run out of slots"; NaCl then refuses to
   * play by that rule, which is the point; KCl confirms the ionic behaviour was
   * about metal-vs-nonmetal, not about sodium specifically.
   */
  const TARGETS = [
    { key:'water', name:'Water', formula:'H₂O', bonding:'covalent',
      core:'O', ligands:{H:2}, shape:'bent',
      prompt:'Oxygen has two open slots. Fill them.',
      teach:'Oxygen shares a pair with each hydrogen — a <b>covalent bond</b>. '+
            'Two slots, two hydrogens: that is why water is H₂O and not H₃O. '+
            'The slots sit <b>104.5°</b> apart, so water comes out bent — the '+
            'reason it has a positive end and a negative end at all.' },

    { key:'methane', name:'Methane', formula:'CH₄', bonding:'covalent',
      core:'C', ligands:{H:4}, shape:'tetrahedral',
      prompt:'Carbon has four. Same rule — fill them all.',
      teach:'Carbon\'s four slots point to the corners of a tetrahedron '+
            '(<b>109.5°</b>), so methane is not flat. Four bonds, four '+
            'hydrogens, nothing left over: carbon is the backbone of every '+
            'molecule in biology because four slots build in every direction.' },

    { key:'nacl', name:'Salt', formula:'NaCl', bonding:'ionic',
      pair:['Na','Cl'],
      prompt:'Sodium has no slots to share. Give it a chlorine anyway.',
      teach:'Sodium would not share — it <b>gave the electron away</b>. Now it '+
            'is Na<sup>+</sup> and chlorine is Cl<sup>−</sup>, and what holds '+
            'them together is <b>opposite charge</b>, not a shared pair. That '+
            'is an <b>ionic bond</b>: no stick, just attraction. It is also why '+
            'salt comes apart in water and methane does not.' },

    { key:'kcl', name:'Potassium chloride', formula:'KCl', bonding:'ionic',
      pair:['K','Cl'],
      prompt:'Try a different metal. Does the same thing happen?',
      teach:'It does. Potassium hands its electron over exactly like sodium: '+
            'the behaviour belongs to <b>metal + nonmetal</b>, not to sodium. '+
            'Any metal meeting any nonmetal transfers rather than shares.' },
  ];

  /* ---- small sprite badge for ionic charge (+ / −) ---------------------- */
  function chargeSprite(THREE, text, color){
    const c=document.createElement('canvas'); c.width=c.height=64;
    const x=c.getContext('2d');
    x.fillStyle='rgba(255,255,255,0.92)'; x.beginPath(); x.arc(32,32,29,0,7); x.fill();
    x.lineWidth=5; x.strokeStyle='#2b2b2b'; x.stroke();
    x.fillStyle=color; x.font='bold 46px sans-serif';
    x.textAlign='center'; x.textBaseline='middle'; x.fillText(text,32,35);
    const s=new THREE.Sprite(new THREE.SpriteMaterial({
      map:new THREE.CanvasTexture(c), transparent:true, depthTest:false }));
    s.scale.setScalar(0.9);
    return s;
  }

  function create(opts){
    const THREE=opts.THREE, root=opts.root, fx=opts.fx||null;
    const P=global.MolLib.PALETTE;

    const group=new THREE.Group(); root.add(group);
    let target=null;          // current TARGETS entry
    let placed=[];            // [{el, mesh, dir, slotIdx}] — core is placed[0]
    let slotGhosts=[];        // ghost meshes marking open valence
    let bonds=[];             // meshes/groups representing formed bonds
    let ionic=false;          // did this assembly go the transfer route?
    let tPulse=0;
    let dots=[];              // electron dot meshes (all of them, for clear/toggle)
    let showE=true;           // valence electrons visible?

    /* ---- valence electron dots ---------------------------------------
     * One small sphere per electron, sitting just off the atom's surface. Three
     * kinds, and the difference between them IS the lesson:
     *   unpaired  — a single dot on an open slot: "this one is available"
     *   lone pair — two dots together: "spoken for, not sharing"
     *   shared    — a pair sitting BETWEEN two nuclei: a covalent bond, drawn as
     *               what it actually is rather than as an abstract stick
     */
    /* depthTest:false — electrons are an OVERLAY, not geometry competing with the
     * spheres. Two reasons it has to be this way: a shared pair sits at the bond
     * midpoint, which for O–H (bond 1.55, O radius 0.95) is *inside* the oxygen,
     * and the stylised radii leave only ~0.05 units of gap between adjacent
     * surfaces — there is physically nowhere to put a visible dot. Drawing on top
     * also means the student can always count all eight electrons, which is the
     * entire point of the lesson; occluding half of them behind the nucleus would
     * hide the octet.
     */
    const dotGeo=new THREE.SphereGeometry(1,12,10);
    function dot(pos, bright){
      const m=new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({
        color:ELECTRON_COLOR, transparent:true, opacity:bright?0.98:0.82,
        depthTest:false, depthWrite:false }));
      m.renderOrder=20;
      m.scale.setScalar(0.1);
      m.position.copy(pos);
      m.visible=showE;
      m.userData.electron=true;
      group.add(m); dots.push(m);
      return m;
    }
    // two dots straddling `dir`, i.e. one pair
    function pairAt(center, dir, spread){
      const d=new THREE.Vector3(dir[0],dir[1],dir[2]).normalize();
      // any perpendicular will do — pairs read as "two" from any angle
      const perp=new THREE.Vector3().crossVectors(d,
        Math.abs(d.z)<0.9?new THREE.Vector3(0,0,1):new THREE.Vector3(0,1,0)).normalize();
      [-1,1].forEach(s=>dot(center.clone()
        .add(perp.clone().multiplyScalar(s*(spread||0.15)))));
    }
    function surfacePos(el, dir, extra){
      const r=(P.radii[el]||0.7)+0.13+(extra||0);
      return new THREE.Vector3(dir[0]*r, dir[1]*r, dir[2]*r);
    }

    // draw the core's electrons: an unpaired dot on each open slot + its lone pairs
    function drawCoreElectrons(){
      if(!target || target.pair) return;
      const core=placed[0]; if(!core) return;
      const shape=SHAPES[target.shape];
      const used=new Set(placed.slice(1).map(p=>p.slotIdx));
      shape.dirs.forEach((d,i)=>{
        if(used.has(i)) return;                       // that electron is now shared
        dot(surfacePos(core.el,d), true);
      });
      (shape.lone||[]).forEach(d=>{
        pairAt(surfacePos(core.el,d,0.04), d, 0.16);
      });
    }
    // terminal atom's own unpaired electron, before it bonds
    function clearElectrons(){ dots.forEach(m=>group.remove(m)); dots=[]; }

    /* ionic path: draw each atom's own electrons, because nothing is shared.
     * Before the transfer, sodium shows its single loose electron and chlorine
     * shows seven — one short of full. After, sodium shows NONE and chlorine
     * shows eight. The count is the whole story: you can see the electron leave.
     */
    function drawIonicElectrons(){
      placed.forEach(p=>{
        const spec=ELEMENTS[p.el];
        let n=spec.electrons;
        if(ionic) n = spec.kind==='metal' ? 0 : spec.electrons+1;
        let left=n, i=0;
        while(left>0 && i<ION_PAIR_DIRS.length){
          const d=ION_PAIR_DIRS[i++];
          const base=surfacePos(p.el,d).add(p.mesh.position);
          if(left>=2){ pairAt(base, d, 0.15); left-=2; }
          else { dot(base, true); left-=1; }
        }
      });
    }

    function redrawElectrons(){
      clearElectrons();
      if(!target) return;
      if(target.pair){ drawIonicElectrons(); return; }
      drawCoreElectrons(); drawBondElectrons();
    }

    /* the shared pairs — the actual covalent bond, drawn as two electrons.
     * They cannot go at the literal bond midpoint: for O–H that point is inside
     * the oxygen sphere, so the pair reads as sitting ON oxygen rather than
     * BETWEEN the two atoms. Instead push the pair sideways into open space
     * beside its bond, far enough out to clear both spheres, and separate its two
     * dots ALONG the bond so they always read as two rather than merging into one
     * blob when the view foreshortens the offset.
     */
    let sharedPairs=[];   // [{a:Vector3,b:Vector3}] bond endpoints
    function drawBondElectrons(){
      const centers=placed.map(p=>p.mesh.position);
      sharedPairs.forEach(sp=>{
        const mid=new THREE.Vector3().addVectors(sp.a,sp.b).multiplyScalar(0.5);
        const along=new THREE.Vector3().subVectors(sp.b,sp.a).normalize();
        // two independent perpendiculars, then their negatives: four candidate
        // directions to sit in. Pick whichever ends up furthest from every
        // nucleus, so the pair never buries itself in a neighbouring atom —
        // that generalizes from water's V to methane's tetrahedron for free.
        const reach=Math.max(...placed.map(p=>P.radii[p.el]||0.7))+0.30;

        // First choice: straight out from this bond, away from the OTHER bonds.
        // That keeps each pair visibly attached to the bond it belongs to —
        // water's two pairs splay left and right instead of both drifting onto
        // oxygen's face, which is what a pure "furthest from any nucleus" rule
        // does as soon as the winning direction happens to point at the camera.
        let best=new THREE.Vector3();
        sharedPairs.forEach(o=>{
          if(o===sp) return;
          best.sub(new THREE.Vector3().subVectors(o.b,o.a).normalize());
        });
        best.addScaledVector(along, -best.dot(along));      // keep it perpendicular

        if(best.lengthSq()<0.01){
          // Only one bond, or a symmetric set that cancels (linear, tetrahedral):
          // no "away" direction exists, so fall back to whichever perpendicular
          // sits furthest from every nucleus.
          const u=new THREE.Vector3().crossVectors(along,
            Math.abs(along.z)<0.9?new THREE.Vector3(0,0,1):new THREE.Vector3(0,1,0)).normalize();
          const v=new THREE.Vector3().crossVectors(along,u).normalize();
          let bestScore=-Infinity;
          [u, v, u.clone().negate(), v.clone().negate()].forEach(d=>{
            const at=mid.clone().add(d.clone().multiplyScalar(reach));
            const score=Math.min(...centers.map(c=>at.distanceTo(c)));
            if(score>bestScore){ bestScore=score; best=d.clone(); }
          });
        }
        const center=mid.clone().add(best.normalize().multiplyScalar(reach));
        [-1,1].forEach(s=>dot(center.clone().add(along.clone().multiplyScalar(s*0.13)), true));
      });
    }

    function setElectrons(b){
      showE=!!b;
      dots.forEach(m=>m.visible=showE);
    }

    /* ---- ghost slots: where an atom is ALLOWED to go ------------------
     * A faint translucent sphere at each unfilled VSEPR direction. This is the
     * valence rule made visible before it is enforced — the student can see
     * that oxygen offers exactly two places, so a rejected third H reads as
     * "full", not "broken".
     */
    function clearGhosts(){ slotGhosts.forEach(m=>group.remove(m)); slotGhosts=[]; }
    function rebuildGhosts(){
      clearGhosts();
      if(!target || target.pair) return;                 // ionic pairs have no slots
      const core=placed[0]; if(!core) return;
      const shape=SHAPES[target.shape];
      const used=new Set(placed.slice(1).map(p=>p.slotIdx));
      const ligEl=Object.keys(target.ligands)[0];
      const len=bondLen(target.core, ligEl);
      shape.dirs.forEach((d,i)=>{
        if(used.has(i)) return;
        const m=new THREE.Mesh(Stage.Rsphere, new THREE.MeshBasicMaterial({
          color:P.atoms[ligEl]||0xaaaaaa, transparent:true, opacity:0.20 }));
        m.scale.setScalar((P.radii[ligEl]||0.6)*0.92);
        m.position.set(d[0]*len, d[1]*len, d[2]*len);
        m.userData.slotIdx=i;
        group.add(m); slotGhosts.push(m);
      });
    }

    function openSlots(){ return slotGhosts.length; }

    /* ---- adding an atom ------------------------------------------------ */
    function addAtom(el){
      if(!target) return {ok:false, why:'Pick something to build first.'};
      const spec=ELEMENTS[el];
      if(!spec) return {ok:false, why:el+' is not on the bench.'};

      /* --- ionic targets: two atoms, one transfer --- */
      if(target.pair){
        const [metal, nonmetal]=target.pair;
        if(placed.length===0){
          if(el!==metal && el!==nonmetal)
            return {ok:false, why:'This one is '+target.formula+'. Try '+metal+' or '+nonmetal+'.'};
          placeCore(el); return {ok:true, placed:el};
        }
        if(placed.length===1){
          const have=placed[0].el;
          const want=have===metal?nonmetal:metal;
          if(el!==want)
            return {ok:false, why:have+' needs a '+want+' to react with, not another '+el+'.'};
          return transfer(el);
        }
        return {ok:false, why:target.formula+' is a pair — it is already done.'};
      }

      /* --- covalent targets: core first, then fill slots --- */
      if(placed.length===0){
        if(el!==target.core)
          return {ok:false, why:'Start with the atom that has the most slots — '+
                                target.core+' ('+ELEMENTS[target.core].valence+').'};
        placeCore(el); return {ok:true, placed:el};
      }

      const core=placed[0];
      if(ELEMENTS[core.el].kind==='metal')
        return {ok:false, why:core.el+' does not share. It has no slots.'};
      if(!slotGhosts.length)
        return {ok:false, why:ELEMENTS[core.el].name+' has no room left — '+
                              'all '+ELEMENTS[core.el].valence+' slots are full.'};

      const wanted=Object.keys(target.ligands)[0];
      if(el!==wanted)
        return {ok:false, why:'That slot is waiting for '+wanted+'.'};
      if(ELEMENTS[el].valence<1)
        return {ok:false, why:el+' has nothing to share.'};

      return bondInto(el);
    }

    function placeCore(el){
      const m=Stage.atom(P.atoms[el]||0x888888, P.radii[el]||0.7, new THREE.Vector3(), el);
      group.add(m);
      placed.push({el, mesh:m, slotIdx:-1});
      // settleShimmer, not popGlow: popGlow punches the scale and captures that
      // scale as its rest state, so handing it anything twice in quick succession
      // ratchets the size up. The shimmer is emissive-only — enough to notice an
      // atom arrived, quiet enough to do four times in a row while building CH₄.
      if(fx) fx.settleShimmer(m, P.atoms[el]);
      rebuildGhosts();
      redrawElectrons();
    }

    // covalent: consume the first open slot, draw a real stick
    function bondInto(el){
      const ghost=slotGhosts[0], slotIdx=ghost.userData.slotIdx;
      const pos=ghost.position.clone();
      const m=Stage.atom(P.atoms[el]||0x888888, P.radii[el]||0.7, pos, el);
      group.add(m);
      placed.push({el, mesh:m, slotIdx});
      // thinner stick than the other pages use: the shared PAIR of dots is now
      // doing the explaining, so the stick is a guide line, not the whole story
      const stick=Stage.bond(new THREE.Vector3(), pos, P.bonds.covalent, 0.10, 1);
      group.add(stick); bonds.push(stick);
      sharedPairs.push({a:new THREE.Vector3(), b:pos.clone()});
      if(fx) fx.settleShimmer(m, P.atoms[el]);
      rebuildGhosts();
      redrawElectrons();
      return {ok:true, bonded:'covalent', placed:el, remaining:openSlots()};
    }

    /* ---- ionic: the electron moves, and there is NO stick --------------
     * Rendered as a line of small amber beads rather than a cylinder. That is
     * the whole visual argument: a covalent stick is a shared pair sitting
     * between two nuclei; an ionic "bond" is just two charges that cannot let
     * go of each other, so there is nothing solid in the gap.
     */
    function transfer(el){
      const a=placed[0];
      const metal=ELEMENTS[a.el].kind==='metal'?a.el:el;
      const len=bondLen(a.el, el);
      const pos=new THREE.Vector3(len,0,0);
      const m=Stage.atom(P.atoms[el]||0x888888, P.radii[el]||0.7, pos, el);
      group.add(m);
      placed.push({el, mesh:m, slotIdx:-1});
      ionic=true;

      const beads=new THREE.Group();
      for(let i=1;i<=4;i++){
        const b=new THREE.Mesh(Stage.Rsphere,
          new THREE.MeshBasicMaterial({color:P.bonds.iondipole, transparent:true, opacity:0.75}));
        b.scale.setScalar(0.075);
        b.position.lerpVectors(new THREE.Vector3(), pos, i/5);
        beads.add(b);
      }
      group.add(beads); bonds.push(beads);

      // charge badges, offset up-and-out so they don't sit inside the spheres
      const plusOn =a.el===metal?a:placed[1];
      const minusOn=a.el===metal?placed[1]:a;
      const plus=chargeSprite(THREE,'+',
        '#'+new THREE.Color(P.atoms[plusOn.el]).getHexString());
      const minus=chargeSprite(THREE,'−',
        '#'+new THREE.Color(P.atoms[minusOn.el]).getHexString());
      plus.position.copy(plusOn.mesh.position).add(
        new THREE.Vector3(0,(P.radii[plusOn.el]||0.7)+0.45,0));
      minus.position.copy(minusOn.mesh.position).add(
        new THREE.Vector3(0,(P.radii[minusOn.el]||0.7)+0.45,0));
      group.add(plus,minus); bonds.push(plus,minus);

      // reuse the proton-hop comet for the electron handoff — same beat,
      // opposite sign, and it already reads as "a charge moved". This is the one
      // moment in the lesson that earns a loud effect, so it keeps its comet;
      // the arrival is a quiet shimmer rather than a full ring + spark burst.
      // Redraw the dots NOW, not in the comet's arrival callback: the callback
      // only fires if the frame loop is running, so a throttled or backgrounded
      // tab would leave the electron count visibly stale. The comet is
      // decoration on top of an already-correct state.
      redrawElectrons();
      if(fx) fx.protonHop(plusOn.mesh.getWorldPosition(new THREE.Vector3()),
                          minusOn.mesh.getWorldPosition(new THREE.Vector3()),
                          ()=>fx.settleShimmer(minusOn.mesh, P.bonds.iondipole));
      clearGhosts();
      return {ok:true, bonded:'ionic', placed:el, transferred:metal};
    }

    /* ---- did they build it? ------------------------------------------- */
    function check(){
      if(!target) return {complete:false};
      const counts={};
      placed.slice(target.pair?0:1).forEach(p=>counts[p.el]=(counts[p.el]||0)+1);
      if(target.pair){
        const done=placed.length===2 && ionic;
        return {complete:done, bonding:'ionic'};
      }
      const want=target.ligands;
      const done=Object.keys(want).every(el=>counts[el]===want[el]) &&
                 openSlots()===0;
      return {complete:done, bonding:'covalent', shape:target.shape,
              angle:SHAPES[target.shape]&&SHAPES[target.shape].angle};
    }

    function clear(){
      [...group.children].forEach(c=>group.remove(c));
      placed=[]; bonds=[]; slotGhosts=[]; dots=[]; sharedPairs=[]; ionic=false;
    }

    function setTarget(key){
      clear();
      target=TARGETS.find(t=>t.key===key)||null;
      return target;
    }

    // ghost slots breathe, so "there is a place for something here" reads as an
    // invitation rather than as part of the finished molecule. Kept slow and
    // shallow — it should be noticeable when you look for it, not while reading.
    function step(){
      tPulse+=0.022;
      const k=0.15+0.05*Math.sin(tPulse);
      slotGhosts.forEach(m=>m.material.opacity=k);
    }

    return { group, setTarget, addAtom, check, clear, step, setElectrons,
             get target(){return target;},
             get placed(){return placed.map(p=>p.el);},
             get openSlots(){return openSlots();},
             get isIonic(){return ionic;},
             get electronsShown(){return showE;} };
  }

  global.Builder={ create, ELEMENTS, SHAPES, TARGETS, BOND_LEN, bondLen };
})(this);
