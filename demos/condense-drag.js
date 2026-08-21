/* =============================================================================
 *  condense-drag.js — join two molecules by DEHYDRATION SYNTHESIS
 * =============================================================================
 *  Loaded as a classic script AFTER three.min.js, molecules.js, scene.js, fx.js,
 *  kit/motion.js and kit/leaving.js. Exposes window.CondenseDrag.
 *
 *  The third drag mechanic, and the first whose unit is a MOLECULE rather than
 *  an atom. covalent-drag.js fills a valence slot; ionic-drag.js hands an
 *  electron over; this one makes a bond between two finished molecules and
 *  releases the water that bond costs. Different mechanic, so a different file
 *  (SCIENCE.md §6) — and ONE file rather than one per class, because the whole
 *  claim of the lesson is that the sugar, the amino acid and the lipid enter
 *  the same reaction.
 *
 *  What the interaction has to make feel true:
 *
 *    1. A bond between two molecules costs something. The water is not a
 *       by-product mentioned in a caption — it is three atoms that were on the
 *       reactants a moment ago, and they LEAVE. Nothing is created or deleted:
 *       the O and the two H that fly off are the same meshes the student was
 *       just dragging, reparented, never rebuilt.
 *    2. Only two particular groups react. Every other part of either molecule
 *       can be brought together all day and nothing happens.
 *    3. The join has a configuration, and the student picks it — by picking a
 *       REAGENT, not by aiming. α- and β-glucose differ by which side of the
 *       ring C1's oxygen sits on, and no amount of turning one converts it into
 *       the other: that takes breaking a bond at C1. So starch's linkage and
 *       cellulose's are not two ways of bringing the same molecule together,
 *       they are two different molecules, and a card that let the hand choose
 *       between them would be teaching a chemistry that does not exist.
 *
 *  Chemistry lives in the SPEC, not here. A molecule declares `condense:` —
 *  which atom stays bonded, which atoms leave with the water, what the product
 *  is — and check-molecules.js asserts all of it. This file reads that block. A
 *  recipe below says only which two molecules are on the bench and where they
 *  start, so adding a card is a table entry rather than a code path.
 *
 *  TWO PLACEMENT STRATEGIES, and the difference is a matter of honesty.
 *
 *    place:'product'  The finished pose is lifted from the PRODUCT SPEC's own
 *                     coordinates. Both residues of maltose are built by the
 *                     same ringPyranose() as glucose, so they are rigid-identical
 *                     to the molecules on the bench and a three-point frame match
 *                     is exact rather than a fit. The student's hand chooses
 *                     WHICH product; the geometry shown is the checked one. Only
 *                     this strategy may carry a configuration claim, because α
 *                     vs β differs by nothing a bond length or a render can see
 *                     (MolecularGeometry.md §1.3).
 *
 *    place:'bond'     No product spec exists (a dipeptide has none), so the join
 *                     is built here: the incoming molecule is rotated to point
 *                     its departing bond at the acceptor and set at bond length.
 *                     A SCHEMATIC — the torsions about the new bond are not a
 *                     claimed conformer — so a card using it must not put a
 *                     stereochemical claim on screen.
 *
 *  THE HOST PAGE MUST PASS `orbit:false` AND FACE THE CAMERA ON.
 *  A molecule is dragged in ONE plane, and that plane is fixed by the view.
 *  Let the view turn and the plane turns with it, leaving the two reactive
 *  sites separated along the view axis by more than the capture radius: the
 *  card looks right, the sites touch on screen, and nothing ever reacts.
 *  Nothing here can detect that — the module never sees the camera's
 *  controls — so it is the page's promise to keep. dna-lab.html's step 1 made
 *  the same promise for the same reason, and its comment is the precedent.
 *
 *  Usage:
 *    const c = CondenseDrag.create({THREE, root, camera, canvas, fx, motion,
 *                                   recipe:'sugar', onChange:report});
 *    c.step(dt);  c.reset();  c.destroy();  c.state();
 * ========================================================================== */
(function(global){
  'use strict';

  const S = {
    CAPTURE: 4.2,      // sites this close and the acceptor starts pulling
    SNAP: 0.75,        // this close and the reaction fires
    PULL: 18,          // attraction (scene units / s²)
    DAMP: 0.86,
  };

  /* ---- the recipes ----------------------------------------------------
   * `a` stays put and carries the acceptor role; `b` is the one the student
   * drags, and carries the donor.
   *
   * Where b is DEALT is measured, not typed: `gap` is a multiple of the two
   * molecules' own half-widths, so a molecule that grows keeps its clearance
   * and a card can never open with the two reactants overlapping. `lift` is
   * the same multiple applied to a's height, which keeps the dragged molecule
   * off the fixed one's shoulder without hiding it behind the readout.
   *
   * `donors` is what makes the sugar card a fork: a list of REAGENTS the
   * student picks between, each reaching its own product. Both products are
   * real registered specs with their own `glycosidic:` claim, and each donor
   * already declares that product in its own `condense.makes` — the recipe
   * repeats it only so a mismatch is a checkable disagreement rather than a
   * silent single source. A recipe with one donor has no fork.
   */
  const RECIPES = {
    sugar: {
      a:'glucose', b:'glucose', acceptor:'c4', donor:'c1',
      place:'product',
      // The ring triad for the frame match. A pyranose ring is rigid and shared
      // by both residues of both products, so three atoms fix it exactly.
      triad:['O5','C1','C4'],
      // Which residue of the product each bench molecule becomes. Both products
      // name residue A the donor (it gives C1) and B the acceptor (it gives C4),
      // the same convention their `names` arrays use.
      residue:{ a:'B', b:'A' },
      // The exocyclic C6 arm turns freely, so its rotamer differs between a
      // lone glucose and a residue of the product and is not a claim either
      // one makes. Named here because condense/check-condense.js holds every OTHER
      // heavy atom to landing exactly.
      rotors:['O6','HO6','H61','H62'],
      // The two reagents, and the whole lesson. Same acceptor, same water, same
      // linkage position — the only difference is which side of the incoming
      // ring its anomeric oxygen is on, and that difference is why bread is
      // food and wood is not.
      donors:[
        { mol:'glucose',      product:'cellobiose', label:'\u03b2-D-glucose',
          makes:'cellulose\u2019s linkage' },
        { mol:'alphaGlucose', product:'maltose',    label:'\u03b1-D-glucose',
          makes:'starch\u2019s linkage' } ],
      gap:1.15, lift:0.14,
      title:'Two glucoses',
    },
    peptide: {
      a:'alanine', acceptor:'amino', donor:'carboxyl',
      place:'bond',
      /* The new bond's length, in ångströms, and it is NOT skel.js's GL.CN.
       * A peptide C–N is 1.33 Å, not an amine's 1.47: the carbonyl's π system
       * delocalises over it, which is the same fact as the peptide bond being
       * planar and unable to rotate — the constraint every protein structure
       * downstream of this page is built on. Required rather than defaulted,
       * because a silent generic single bond is what this card first drew.
       */
      bondLen:1.33,
      donors:[ { mol:'alanine', product:null, label:'Alanine', makes:'a peptide bond' } ],
      gap:1.15, lift:0.14,
      title:'Two alanines',
    },
  };

  function create(opts){
    const { THREE, root, camera, canvas, fx, motion } = opts;
    const onChange = opts.onChange || function(){};
    const R = RECIPES[opts.recipe || 'sugar'];
    if(!R) throw new Error(`condense-drag: no recipe '${opts.recipe}'`);

    const MOL = global.MolLib.MOLECULES;
    const SCALE = global.MolLib.SCALE;
    const leaving = global.Leaving.create({ root, camera, motion, tag:'condense' });

    const group = new THREE.Group();
    root.add(group);

    const V = (x,y,z)=>new THREE.Vector3(x,y,z);
    // Which reagent is on the bench. The donor is a CHOICE (see `donors`), so
    // specB and its role are re-read whenever that choice changes.
    let donorIx = 0;
    const specA = MOL[R.a];
    let specB = null;
    if(!specA)
      throw new Error(`condense-drag: recipe '${opts.recipe}' names a molecule that is not loaded`);

    // Roles come off the SPEC. A recipe naming a role the spec does not declare
    // is a wiring mistake worth failing loudly on: a silent fallback would react
    // at the wrong hydroxyl and look entirely correct doing it.
    function roleOf(spec, key, which){
      const block = spec.condense;
      if(!block) throw new Error(`condense-drag: the ${which} molecule has no \`condense:\` block`);
      const r = (block.roles||[]).find(r=>r.key===key);
      if(!r) throw new Error(`condense-drag: the ${which} molecule declares no role '${key}'`);
      return r;
    }
    const roleA = roleOf(specA, R.acceptor, 'acceptor');
    let roleB = null;

    /* The product is known before the student moves anything: it is a property
     * of which reagent they picked, and the recipe and the spec must agree on
     * it. Disagreeing is a wiring error worth throwing on — the alternative is
     * a card that names one product and builds another. */
    function useDonor(i){
      const d=R.donors[i];
      if(!d) throw new Error(`condense-drag: recipe '${opts.recipe}' has no donor ${i}`);
      specB = MOL[d.mol];
      if(!specB) throw new Error(`condense-drag: donor '${d.mol}' is not loaded`);
      roleB = roleOf(specB, R.donor, 'donor');
      const rx=(specB.condense.makes||[]).find(x=>x.donor===R.donor && x.acceptor===R.acceptor);
      if(!rx) throw new Error(`condense-drag: ${d.mol} declares no reaction ${R.donor}+${R.acceptor}`);
      if(rx.product!==d.product)
        throw new Error(`condense-drag: the recipe says ${d.mol} makes ${d.product}, `
                      + `but the spec says ${rx.product}`);
      donorIx=i;
      return rx;
    }
    let rxB = null;

    let A=null, B=null;
    let vel=V(0,0,0);
    let joined=false, config=null, product=null;
    let halos=[], clock=0;

    /* ---- build ---------------------------------------------------------- */
    function build(){
      rxB = useDonor(donorIx);
      A = Stage.buildMolecule(specA, {center:true});
      B = Stage.buildMolecule(specB, {center:true});
      const d=deal();
      B.position.set(d[0], d[1], d[2]);
      group.add(A); group.add(B);
      group.updateMatrixWorld(true);
      joined=false; config=null; product=null; vel.set(0,0,0);
      markSites();
      report();
    }

    /* ---- where to drag to ------------------------------------------------
     * covalent-drag.js draws a ghost on every open slot, and a student who has
     * used that page arrives here expecting the same promise: the place a thing
     * can land is marked. Without it this card is a guessing game — two rings
     * of twenty-odd atoms, and only one pair of them does anything.
     *
     * A marker is coloured as the atom that will LAND there, which is the same
     * rule covalent-drag's ghosts follow (a hydrogen's ghost is hydrogen
     * coloured). So the acceptor's target wears the donor's element and the
     * donor's wears the acceptor's — "an oxygen goes here", "a carbon comes to
     * this". Derived from the roles, so a recipe on different groups marks the
     * right atoms without touching this code.
     *
     * These are an INTERACTION AFFORDANCE, not a chemical claim, which is why
     * the colour is an element's rather than one of palette.js's bond colours:
     * every entry in that table means something about bonding, and a halo that
     * borrowed one would be asserting a bond type before any bond exists. */
    function markSites(){
      halos=[];
      const P=global.MolLib.PALETTE;
      /* A RING, not a translucent ball. A ball tinted with a dark element
       * disappears against a dark atom and muddies a light one; a ring reads
       * against both because its contrast is with the atom's EDGE and the paper
       * behind it. It lies in the XY plane, which faces the camera for free —
       * the page has promised not to orbit (see the header), and this is the
       * second thing that promise buys. */
      const add=(g, idx, el)=>{
        const host=g.userData.atomMeshes[idx];
        if(!host) return;
        const m=new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.17, 12, 40),
          new THREE.MeshBasicMaterial({ color:P.atoms[el]||0x888888,
            transparent:true, opacity:0.5, depthWrite:false, depthTest:false }));
        // child of the atom, so it rides every move the molecule makes and no
        // per-frame repositioning can drift away from the atom it names
        m.renderOrder=3;                      // never buried by the sphere it rings
        host.add(m);
        /* Undo the host's own orientation. buildMolecule premultiplies the
         * spec's `view:` into every atom mesh's quaternion, so a child inherits
         * that tilt and the ring renders as an ellipse — readable, but reading
         * as a ring drawn AROUND something rather than one lying flat on the
         * page. Once, at build: the molecules only translate after this. */
        host.updateWorldMatrix(true,false);
        m.quaternion.copy(host.getWorldQuaternion(new THREE.Quaternion()).invert());
        halos.push(m);
      };
      add(A, roleA.keep, specB.atoms[roleB.keep].el);   // the donor's atom lands here
      add(B, roleB.keep, specA.atoms[roleA.keep].el);   // and this is what lands
    }
    function clearHalos(){
      halos.forEach(m=>{ if(m.parent) m.parent.remove(m); });
      halos=[];
    }

    /* Where the dragged molecule is dealt, from the two molecules' measured
     * extents. Exposed because the page frames its camera on the same two
     * points, and a camera fitted to a deal position the module did not use is
     * how a card opens with the thing to grab off screen. */
    function deal(){
      const eA=Stage.measure(specA), eB=Stage.measure(specB);
      return [ (eA.rxz+eB.rxz)*(R.gap!=null?R.gap:1.15),
               eA.hy*(R.lift!=null?R.lift:0.14), 0 ];
    }

    function at(g,i){
      const m=g.userData.atomMeshes[i];
      return m ? m.getWorldPosition(V()) : null;
    }
    const siteA = ()=>at(A, roleA.keep);
    const siteB = ()=>at(B, roleB.keep);

    /* ---- placing the finished join --------------------------------------- */
    function nameIndex(spec){
      const m={}; (spec.names||[]).forEach((n,i)=>{ m[n]=i; }); return m;
    }
    // An orthonormal frame from three points, as a rotation matrix.
    function frame(p1,p2,p3){
      const x=p2.clone().sub(p1).normalize();
      const z=x.clone().cross(p3.clone().sub(p1)).normalize();
      const y=z.clone().cross(x).normalize();
      return new THREE.Matrix4().makeBasis(x,y,z);
    }
    // Where residue `which` of the product sits, and which bench atoms match it.
    function triadOf(which){
      const prod=MOL[product];
      const pn=nameIndex(prod), ln=nameIndex(which==='a'?specA:specB);
      const suffix=R.residue[which];
      return R.triad.map(t=>{
        const pi=pn[t+suffix], li=ln[t];
        if(pi===undefined || li===undefined)
          throw new Error(`condense-drag: triad atom '${t}' is missing from ${product} or its reactant`);
        return { p:prod.atoms[pi].pos, l:li };
      });
    }
    /* Move `g` so its triad lands on the product's. No SCALE here: `register()`
     * applied it once on the way in, so MOLECULES coordinates and the meshes
     * built from them are both already in display units.
     *
     * The triad is measured from the MESHES, not from the reactant spec, which
     * is what makes this safe: `center:true` and the spec's `view:` are baked
     * into the atom meshes, so reading them back picks both up and the
     * transform lands the molecule where its own atoms actually are. */
    function placeOnProduct(g, which){
      const pts=triadOf(which);
      const P=pts.map(t=>V(t.p[0],t.p[1],t.p[2]));
      const L=pts.map(t=>at(g,t.l));
      const rot=frame(P[0],P[1],P[2]).multiply(frame(L[0],L[1],L[2]).invert());
      const o=L[0].clone();
      g.applyMatrix4(new THREE.Matrix4().makeTranslation(-o.x,-o.y,-o.z));
      g.applyMatrix4(rot);
      g.applyMatrix4(new THREE.Matrix4().makeTranslation(P[0].x,P[0].y,P[0].z));
      g.updateMatrixWorld(true);
    }
    // No product spec: point the donor's departing bond at the acceptor and set
    // it at bond length. Schematic by construction — see the header.
    function placeOnBond(){
      const target=siteA();
      const away=target.clone().sub(at(A, roleA.leaves[0])).normalize();
      const keep=siteB(), leave=at(B, roleB.leaves[0]);
      const q=new THREE.Quaternion().setFromUnitVectors(
        leave.clone().sub(keep).normalize(), away.clone().negate());
      const o=keep.clone();
      if(R.bondLen==null)
        throw new Error(`condense-drag: recipe '${opts.recipe}' places by bond but `
                      + `declares no bondLen — the length of the bond it makes is a `
                      + `fact about the chemistry, not a default this module may pick`);
      const to=target.clone().add(away.multiplyScalar(R.bondLen*SCALE));
      B.applyMatrix4(new THREE.Matrix4().makeTranslation(-o.x,-o.y,-o.z));
      B.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(q));
      B.applyMatrix4(new THREE.Matrix4().makeTranslation(to.x,to.y,to.z));
      B.updateMatrixWorld(true);
    }

    /* ---- the reaction ---------------------------------------------------- */
    function react(){
      if(joined) return;
      joined=true;
      /* Let go of it. The student's finger is still down at the moment the bond
       * forms, and a grab that outlives the reaction goes on dragging one half
       * of a finished molecule around — pulling the product apart through the
       * bond it just made. */
      held=false;
      canvas.style.cursor='';
      product=R.donors[donorIx].product;
      config=rxB && rxB.config || null;

      // Pose first, so the water leaves from where the atoms actually end up.
      if(R.place==='product' && product && MOL[product]){ placeOnProduct(A,'a'); placeOnProduct(B,'b'); }
      else placeOnBond();

      const site=siteA();
      clearHalos();                           // there is nowhere left to aim
      releaseWater();
      if(fx && site) fx.spawnRing(site, 0.9);
      report();
    }

    /* The three atoms that leave are the three meshes that were already on the
     * reactants: reparented into the air with their world positions preserved,
     * gathered into a water, then thrown off frame. So the student can follow
     * one oxygen from a hydroxyl into the water and out. Building a fresh water
     * from the water spec would be less code and a worse claim — it would say a
     * water APPEARED. */
    function releaseWater(){
      const take=(g,spec,idx)=>idx.map(i=>{
        const m=g.userData.atomMeshes[i];
        if(!m) return null;
        const w=m.getWorldPosition(V());
        // drop the sticks to it before it goes — a stick to a departed atom is
        // the classic dangling-stick bug
        g.userData.bondMeshes.forEach(bm=>{ if(bm.userData.pair.includes(i)) bm.visible=false; });
        m.parent.remove(m);
        root.add(m); m.position.copy(root.worldToLocal(w));
        // the element comes off the SPEC. buildMolecule stores it on the mesh as
        // `userData.role`, which also carries non-atom roles elsewhere, so the
        // spec is the unambiguous source.
        return { mesh:m, el:spec.atoms[i].el };
      }).filter(Boolean);

      const gone=[...take(B, specB, roleB.leaves), ...take(A, specA, roleA.leaves)];
      if(!gone.length) return;
      const oh=gone.find(x=>x.el==='O')||gone[0];
      const o=oh.mesh;
      const hs=gone.filter(x=>x!==oh).map(x=>x.mesh);

      // water's own geometry, in display units: O–H 0.96 Å at 104.5°
      const OH=0.96*SCALE, half=104.5/2*Math.PI/180;
      const centre=o.position.clone();
      const parts=[{ mesh:o, to:centre }].concat(hs.map((m,k)=>({ mesh:m,
        to:centre.clone().add(V(Math.sin(half)*(k?-1:1), -Math.cos(half), 0).multiplyScalar(OH)) })));
      const dur=leaving.gather(parts);

      motion.after(dur/1000, ()=>{
        const air=new THREE.Group();
        root.add(air);
        parts.forEach(p=>{
          const w=p.mesh.getWorldPosition(V());
          p.mesh.parent.remove(p.mesh); air.add(p.mesh);
          p.mesh.position.copy(air.worldToLocal(w));
        });
        leaving.link(air, hs.map(m=>[o.position.clone(), m.position.clone()]));
        leaving.launch(air, { to:leaving.offstage(centre), arc:0.8, dur:900, fade:true,
                              onDone:()=>root.remove(air) });
      }, {tag:'condense'});
    }

    /* ---- dragging --------------------------------------------------------
     * Registered on the canvas's PARENT in the capture phase so a grab stops the
     * event before Stage's own orbit handler ever sees it. */
    const ray=new THREE.Raycaster(), ndc=new THREE.Vector2();
    const plane=new THREE.Plane(), hit=new THREE.Vector3();
    let held=false, grabOffset=V();

    function toNdc(e){
      const r=canvas.getBoundingClientRect();
      ndc.set(((e.clientX-r.left)/r.width)*2-1, -((e.clientY-r.top)/r.height)*2+1);
    }
    // Every sphere of B grabs the WHOLE molecule: it is a reagent, not a
    // construction set. Letting a student pull one hydroxyl off by hand would be
    // a second, undiscoverable route to the reaction that skips the water.
    function pick(e){
      if(joined || !B) return false;
      toNdc(e); ray.setFromCamera(ndc, camera);
      return ray.intersectObjects(B.userData.atomMeshes.filter(Boolean), false).length>0;
    }
    function pointerOnPlane(e){
      toNdc(e); ray.setFromCamera(ndc, camera);
      return ray.ray.intersectPlane(plane, hit) ? hit.clone() : null;
    }
    const surface=canvas.parentElement||canvas;

    /* THE DRAG PLANE CONTAINS THE ACCEPTOR SITE, not the dragged molecule.
     *
     * This is the difference between a card that works and one that cannot. A
     * plane through B lets B move only at ITS OWN depth, so the two reactive
     * sites can be sitting exactly on top of each other on screen while lying
     * several ångströms apart along the view axis. The molecules slide through
     * each other and nothing ever reacts — and nothing on screen says why,
     * because on screen they are touching.
     *
     * Putting the plane through the acceptor site makes what the student SEES
     * the thing that is true: bring the sites together visually and they are
     * together. The cost is a one-time step in depth when the molecule is
     * grabbed, which reads as a slight change in size and is the honest price
     * of dragging a 3D object with a 2D pointer.
     */
    function dragPlane(){
      const n=camera.getWorldDirection(V()).normalize();
      plane.setFromNormalAndCoplanarPoint(n.clone().negate(), siteA());
      return n;
    }
    function onDown(e){
      if(!pick(e)) return;                    // let the orbit handler have it
      e.stopPropagation(); e.preventDefault();
      held=true; vel.set(0,0,0);
      const n=dragPlane();
      const p=pointerOnPlane(e);
      if(p){
        // Where the grabbed molecule's own SITE sits relative to the pointer,
        // with the out-of-plane part dropped: keeping it would haul the
        // molecule straight back out of the plane on the first move.
        grabOffset.copy(siteB().sub(p));
        grabOffset.addScaledVector(n, -grabOffset.dot(n));
      } else grabOffset.set(0,0,0);
      canvas.style.cursor='grabbing';
    }
    function onMove(e){
      if(joined) return;                      // nothing left to drag
      if(!held){
        if(!canvas.style.cursor || canvas.style.cursor==='grab' || canvas.style.cursor==='')
          canvas.style.cursor = pick(e) ? 'grab' : '';
        return;
      }
      dragPlane();                            // the camera may have orbited
      const p=pointerOnPlane(e); if(!p) return;
      /* Move the molecule by however far its SITE has to travel — dragging by
       * the reactive site rather than by the group's origin, so the thing the
       * student is aiming is the thing that lands.
       *
       * The delta is WORLD space and `position` is the parent's, and those two
       * are the same thing only until someone orbits: Stage's orbit turns the
       * root these molecules hang from. So the target is resolved as a world
       * point and converted once, rather than added raw. */
      const shift=p.add(grabOffset).sub(siteB());
      B.position.copy(B.parent.worldToLocal(B.getWorldPosition(V()).add(shift)));
      report();
    }
    function onUp(){ held=false; canvas.style.cursor=''; }
    surface.addEventListener('pointerdown', onDown, true);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);

    /* ---- the loop --------------------------------------------------------
     * The last stretch is pulled by the acceptor, not by the mouse — the same
     * claim covalent-drag.js makes one level down. Letting go inside CAPTURE
     * still reacts; the molecule finishes the trip on its own. */
    function step(dt){
      if(joined || !A || !B) return;
      const a=siteA(), b=siteB();
      if(!a || !b) return;
      const d=a.clone().sub(b), r=d.length();
      /* The markers breathe, and brighten once the sites are close enough to be
       * caught — the same two-state signal covalent-drag.js gives a ghost, so
       * "it will take from here" is shown rather than left to be discovered by
       * letting go and seeing. */
      clock+=dt;
      const base=(r<=S.CAPTURE)?0.95:0.5;
      halos.forEach(m=>{ m.material.opacity=base-0.12+0.12*Math.sin(clock*3.2); });
      if(r<=S.SNAP){ react(); return; }
      if(held) return;
      if(r<=S.CAPTURE) vel.add(d.normalize().multiplyScalar(S.PULL*dt));
      vel.multiplyScalar(S.DAMP);
      B.position.add(vel.clone().multiplyScalar(dt));
      report();
    }

    /* ---- what the page narrates ------------------------------------------ */
    let last='';
    function report(){
      const s=state(), k=JSON.stringify(s);
      if(k!==last){ last=k; onChange(s); }
    }
    function state(){
      const a=A&&siteA(), b=B&&siteB();
      const r=(a&&b)?a.distanceTo(b):null;
      const d=R.donors[donorIx];
      return {
        joined, near: r!=null && r<=S.CAPTURE,
        config: joined ? config : (rxB && rxB.config || null),
        // The product is named from the moment the reagent is picked, not on
        // completion: the student is choosing between two outcomes, and a
        // choice they cannot read is not one they are making.
        product: d.product,
        donor:{ index:donorIx, label:d.label, makes:d.makes, mol:d.mol,
                count:R.donors.length },
        title:R.title,
      };
    }

    function reset(){
      motion.cancel('condense');
      leaving.clear();
      clearHalos();
      group.clear();
      build();
    }
    function destroy(){
      surface.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      motion.cancel('condense');
      leaving.clear();
      root.remove(group);
    }

    build();
    /* Picking a reagent restarts the card. It has to: the molecule on the bench
     * IS the choice, so there is nothing to swap in place. */
    function setDonor(i){ donorIx=i; reset(); }

    return { group, step, reset, destroy, state, deal, setDonor };
  }

  global.CondenseDrag = { create, RECIPES };
})(this);
