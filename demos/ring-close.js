/* =============================================================================
 *  ring-close.js — why glucose is a ring, built the way a model kit shows it
 * =============================================================================
 *  Loaded after three.min.js, molecules.js, scene.js, fx.js, kit/motion.js,
 *  kit/molgraph.js and condense/frame.js. Exposes window.RingClose.
 *
 *  The fourth drag mechanic. covalent-drag.js fills a valence slot,
 *  ionic-drag.js hands an electron over, condense-drag.js joins two molecules;
 *  this one folds ONE molecule onto itself. Different mechanic, different file
 *  (SCIENCE.md §6).
 *
 *  THE CLAIM. A student meets glucose as a hexagon and is told it is a ring.
 *  This asks why. The answer is the one a physical ball-and-stick kit gives
 *  before anybody explains it: carbon's four bonds want 109.5°, and only some
 *  ring sizes let them have it. Try to close a three-membered ring and the
 *  sticks will not reach. That refusal is the lesson, so the angle behind it is
 *  MEASURED off a real ring rather than asserted, and printed with the
 *  molecule it was measured from.
 *
 *  THE OPEN CHAIN IS DERIVED, NEVER AUTHORED, and this is the most important
 *  decision in the file. Open-chain glucose has four stereocentres, and
 *  mol-krebs.js records what happens when a sugar chain is laid down by hand:
 *  one `freeTet` slot taken because it was first built L-ribitol, the
 *  enantiomer, "with every bond length, every angle and every rendered pixel
 *  identical to the real thing", and check-molecules.js passed it. Only
 *  tools/check-handedness.js caught it, which needs the network.
 *
 *  So there is no open-chain spec. The chain is the RING SPEC with C1–O5
 *  broken and the pieces turned — every stereocentre inherited from a molecule
 *  the checkers already vouch for, and no new centre declared anywhere. The
 *  same reason glycolysis-lab opens its ring at run time instead of shipping an
 *  open form. What this file poses is a CONFORMATION, which is not a claim
 *  about configuration and cannot be mirrored.
 *
 *  WHERE α AND β COME FROM, honestly. C1 is a carbonyl: three atoms around a
 *  planar carbon, with an empty face on each side. The attacking hydroxyl can
 *  add to either, and which one it takes is which anomer you get. That is a
 *  real fork the hand is allowed to make — unlike condense-lab's sugar cards,
 *  where the anomer is fixed in the reagent and no amount of turning a finished
 *  β-glucose converts it. This is where the two reagents that page consumes
 *  come from.
 *
 *  ---------------------------------------------------------------------------
 *  KNOWN BROKEN: THE α/β FORK. `faceAt` returns the same anomer whichever side
 *  the hydroxyl approaches from, so this module currently only ever builds
 *  β-glucose. Do NOT wire it into a lesson until this is fixed — the fork is the
 *  reason the file exists.
 *
 *  Ruled out already, so nobody re-walks it: the arithmetic is right (the
 *  reference sign off the closed β spec is +1 and probe points either side of
 *  the carbonyl plane give ±0.6 as they should); C1 really is planar now
 *  (124/118/118, summing to 360); and latching the face at CAPTURE rather than
 *  at SNAP did not fix it.
 *
 *  What is left, and where to look: the dragged oxygen does not land where the
 *  pointer aims. `moveOxygen` places it at `p + grabOffset`, and grabOffset is
 *  measured between the oxygen and a plane point under it — but the oxygen sits
 *  at a different DEPTH from the drag plane, so under perspective that residual
 *  is not the small in-plane number the code assumes. Staging the approach 6
 *  units to either side moved the final position by 0.33 units, not 12, which
 *  is the signature: the oxygen is barely following the pointer at all. Fix the
 *  placement first and re-test the fork; it is very likely the only bug left.
 *  ---------------------------------------------------------------------------
 *
 *  MODEL SIMPLIFICATIONS, deliberate and kept explicit:
 *   - The open chain is posed, not relaxed. Its dihedrals are turned to a
 *     readable extended shape; no force field says that is the conformer a real
 *     open-chain glucose favours, and none is claimed.
 *   - The corner angle is MEASURED off a real ring of that size where the
 *     library has one, and is the planar limit only for three and four, which
 *     cannot pucker out of it. Not flat Baeyer strain: see `strainOf`, which
 *     carries the argument, because using it would rank the furanose as the
 *     relaxed one and get the lesson exactly backwards.
 *   - Closure is offered at one carbon only. See CLOSERS.
 *
 *  Usage:
 *    const rc = RingClose.create({THREE, root, camera, canvas, fx, motion,
 *                                 onChange:report});
 *    rc.step(dt);  rc.reset();  rc.destroy();  rc.state();
 * ========================================================================== */
(function(global){
  'use strict';

  const S = {
    CAPTURE: 4.2,
    SNAP: 0.95,
    PULL: 18,
    DAMP: 0.86,
  };

  /* The ring this closes into, and the reagent each face produces. Both are
   * registered, checked specs — the same two condense-lab joins — so closing
   * hands the next lesson a molecule it already knows how to use. */
  const RECIPE = {
    open:'glucose',                 // the spec the chain is derived FROM
    anomer:{ beta:'glucose', alpha:'alphaGlucose' },
    // The frame match that poses the closed ring, as in condense-drag.js: a
    // pyranose is rigid, so three atoms fix it exactly.
    triad:['O5','C1','C4'],
  };

  /* WHICH HYDROXYLS MAY ATTACK. Every one is offered — refusing to draw the
   * wrong answers would leave the student with nothing to be wrong about, and
   * "why this ring" is not a question you can ask with one option on screen.
   *
   * `ring` is the size the closure would make, counted rather than typed: the
   * attacking oxygen, C1, and the carbons between them.
   *
   * C4 is the honest awkward case. It closes in reality — glucofuranose exists
   * — but it is under 1% of glucose in water, and this model builds only the
   * pyranose, so it is refused with that reason rather than with strain it does
   * not have. Saying "this model does not do that" beats implying the chemistry
   * forbids it. */
  const CLOSERS = [
    { atom:'O2', ring:3 },
    { atom:'O3', ring:4 },
    { atom:'O4', ring:5, real:'glucofuranose', note:'a five-ring really does form here' },
    { atom:'O5x', ring:6, closes:true },
  ];

  const TET = 109.5;

  /* A REAL RING OF THIS SIZE, where the library has one. This is the whole
   * arithmetic of the lesson and it is easy to get exactly backwards.
   *
   * The textbook first answer is Baeyer strain: the angle a FLAT n-gon forces,
   * 180 − 360/n. Used here it would print 120° for the six-ring and 108° for
   * the five, making the FURANOSE look like the relaxed one and the pyranose
   * strained by 10.5° — which is the opposite of the truth and precisely the
   * error that sank Baeyer's theory. Rings above four pucker. A cyclohexane
   * chair reaches 109.5° exactly and pays nothing.
   *
   * So the number is MEASURED off a real molecule wherever the library has one
   * — glucose's own pyranose, ribose's furanose, both checked specs — and falls
   * back to the planar limit only for three and four, where the ring genuinely
   * has no room to pucker out of it. A three-membered ring IS planar; 60° is
   * not an approximation there, it is the angle.
   */
  const REFERENCE = { 5:'ribose', 6:'glucose' };

  function ringAngles(spec, ring){
    const P=i=>spec.atoms[i].pos, out=[];
    for(let m=0;m<ring.length;m++){
      const a=P(ring[(m-1+ring.length)%ring.length]), b=P(ring[m]), c=P(ring[(m+1)%ring.length]);
      const u=[a[0]-b[0],a[1]-b[1],a[2]-b[2]], v=[c[0]-b[0],c[1]-b[1],c[2]-b[2]];
      const d=(u[0]*v[0]+u[1]*v[1]+u[2]*v[2])/(Math.hypot(...u)*Math.hypot(...v));
      out.push(Math.acos(Math.max(-1,Math.min(1,d)))*180/Math.PI);
    }
    return out;
  }
  const cache={};
  function strainOf(n){
    if(cache[n]) return cache[n];
    const MOL=global.MolLib && global.MolLib.MOLECULES;
    const key=REFERENCE[n], spec=key && MOL && MOL[key];
    let r;
    if(spec && global.MolGraph){
      const ring=(global.MolGraph.rings(spec)||[]).find(x=>x.length===n);
      if(ring){
        const a=ringAngles(spec, ring);
        const mean=a.reduce((x,y)=>x+y,0)/a.length;
        r={ angle:mean, off:Math.abs(TET-mean), source:'measured', from:spec.name };
      }
    }
    if(!r){
      const flat=180-360/n;
      r={ angle:flat, off:Math.abs(TET-flat), source:'planar', from:null };
    }
    return (cache[n]=r);
  }

  function create(opts){
    const { THREE, root, camera, canvas, fx, motion } = opts;
    const onChange = opts.onChange || function(){};
    const MOL = global.MolLib.MOLECULES;
    const MolGraph = global.MolGraph;
    const V = (x,y,z)=>new THREE.Vector3(x,y,z);

    const spec = MOL[RECIPE.open];
    if(!spec) throw new Error(`ring-close: ${RECIPE.open} is not loaded`);
    const NAME = {}; (spec.names||[]).forEach((n,i)=>{ NAME[n]=i; });

    const C1=NAME.C1, O5=NAME.O5;
    // The ring bond that has to break for there to be a chain at all.
    const RING_BOND=[C1,O5];

    const group=new THREE.Group();
    root.add(group);

    let mol=null, halos=[], picked=null, held=false;
    let joined=false, anomer=null, refused=null, clock=0;
    /* The face is latched when the oxygen CROSSES INTO capture range, not when
     * it snaps. At the snap point the two faces are a fraction of a unit apart
     * and whichever way the path happened to curve decides the anomer — a fork
     * settled by accident. Four units out the sides are unambiguous, it is the
     * student's approach that picks one, and the page can name the product
     * before they commit to it. Cleared on release, so backing off and coming
     * round the other side really does change the answer. */
    let pendingFace=null;
    let vel=V(0,0,0);

    /* ---- the open chain ---------------------------------------------------
     * Break C1–O5, then turn the backbone so the two ends come apart. Every
     * atom keeps the position the RING spec gave it until it is turned, and a
     * turn is a rotation about a real bond, so nothing here invents a
     * stereocentre — see the header.
     *
     * The ring oxygen leaves as C5's hydroxyl and needs a hydrogen, which the
     * ring spec has no atom for. glycolysis-lab's g6p carries one (`openH`)
     * built into the spec for exactly this. Glucose does not, so the chain is
     * drawn with O5 one bond short and the caption does not pretend otherwise:
     * this card is about the RING, and an H that appears from nowhere would be
     * a second, unearned claim.
     */
    function openPose(){
      const g=Stage.buildMolecule(spec,{center:true});
      const u=g.userData;
      // hide the ring bond — there is no ring yet
      u.bondMeshes.forEach(bm=>{
        const p=bm.userData.pair;
        if((p[0]===C1&&p[1]===O5)||(p[0]===O5&&p[1]===C1)) bm.visible=false;
      });
      /* Swing the C1 end away from O5 by turning about C2–C3, carrying
       * everything past it. One turn, about a real bond, chosen because it is
       * far enough down the chain that the whole aldehyde end moves and near
       * enough that the rest of the molecule holds still. */
      const c2=NAME.C2, c3=NAME.C3;
      const moving=MolGraph.component(spec, c2, [[c2,c3], RING_BOND])
        .filter(i=>i!==c3);
      turn(g, c3, c2, moving, 115*Math.PI/180);
      flattenC1(g);
      return g;
    }

    /* C1 BECOMES A CARBONYL, and without this the card has no lesson.
     *
     * Breaking C1–O5 leaves C1 still wearing the ring's tetrahedral geometry:
     * four directions, one of them now empty but still pointing where O5 used
     * to be. An attacking hydroxyl then has no choice to make — the leftover
     * pyramid decides which side it arrives on, and every closure returns the
     * same anomer no matter how the student comes in.
     *
     * A real aldehyde carbon is sp2: C2, O1 and H1 flat around it at 120°, with
     * an EMPTY FACE ON EACH SIDE. That flatness is the entire reason α and β
     * both exist, so it has to be built, not assumed. C2 and O1 keep their
     * directions (they carry the rest of the molecule and the carbonyl's own
     * axis); H1 is placed in their plane, opposite the bisector, and O1 is
     * pulled in to a real C=O.
     */
    function flattenC1(g){
      const u=g.userData;
      const P=i=>u.atomMeshes[i] && u.atomMeshes[i].position;
      const c2=NAME.C2, o1=NAME.O1, h1=NAME.H1;
      const c=P(C1); if(!c||!P(c2)||!P(o1)) return;
      const GL=(global.SkelLib&&global.SkelLib.GL)||{};
      const SC=global.MolLib.SCALE;
      const dC=P(c2).clone().sub(c).normalize();
      const dO=P(o1).clone().sub(c).normalize();
      const nrm=dC.clone().cross(dO).normalize();
      /* Real aldehyde angles, not the ring's leftovers. C2's direction is kept
       * because it carries the whole rest of the chain; O1 and H1 are then set
       * around it at an aldehyde's own geometry (C–C=O ~124 deg), summing to
       * 360 by construction. Leaving O1 where the ring had it gives 109 deg — a
       * tetrahedral angle on a carbon that is no longer tetrahedral. */
      const spin=(d,a)=>d.clone().applyAxisAngle(nrm, a);
      const CdO=(GL.CdO||1.23)*SC, CH=(GL.CH||1.09)*SC;
      P(o1).copy(c.clone().add(spin(dC, 124*Math.PI/180).multiplyScalar(CdO)));
      if(P(h1)) P(h1).copy(c.clone().add(spin(dC, -118*Math.PI/180).multiplyScalar(CH)));
      // and it is drawn as the double bond it is — a carbonyl on a single
      // stick is a different functional group
      u.bondMeshes.forEach(bm=>{
        const [i,j]=bm.userData.pair;
        if((i===C1&&j===o1)||(i===o1&&j===C1)){
          const rep=Stage.bond(P(C1), P(o1),
            global.MolLib.PALETTE.bonds.covalent, 0.14, 2);
          rep.userData.pair=[i,j];
          g.remove(bm); g.add(rep);
          const k=u.bondMeshes.indexOf(bm);
          if(k>=0) u.bondMeshes[k]=rep;
        }
      });

      /* THE ANOMERIC PROTON MOVES. When the ring opens, C1's –OH hands its
       * hydrogen to the ring oxygen, which leaves as C5's hydroxyl: the open
       * chain is an aldehyde with NO H on O1 and an –OH at C5. Left where the
       * ring spec put it, this draws a hemiacetal — the half-open thing — and
       * puts a hydrogen on the very oxygen that is about to attack.
       *
       * The atom is MOVED, never hidden and replaced: it is the same hydrogen,
       * and closing puts it back because poseAsRing restores every atom from
       * the ring spec by name. */
      const ho1=NAME.HO1, c5=NAME.C5;
      if(P(ho1) && P(O5) && P(c5)){
        const away=P(O5).clone().sub(P(c5)).normalize();
        P(ho1).copy(P(O5).clone().add(away.multiplyScalar((GL.OH||0.97)*SC)));
        u.bondMeshes.forEach(bm=>{
          const [i,j]=bm.userData.pair;
          if((i===o1&&j===ho1)||(i===ho1&&j===o1)) bm.userData.openPair=[O5,ho1];
        });
      }
    }
    // Rotate `idxs` about the axis through atoms a→b, in the group's own space.
    function turn(g, a, b, idxs, ang){
      const u=g.userData;
      const pa=u.atomMeshes[a].position, pb=u.atomMeshes[b].position;
      const axis=pb.clone().sub(pa).normalize();
      const q=new THREE.Quaternion().setFromAxisAngle(axis, ang);
      idxs.forEach(i=>{
        const m=u.atomMeshes[i]; if(!m) return;
        m.position.sub(pa).applyQuaternion(q).add(pa);
      });
      // bonds follow their atoms
      redrawBonds(g);
    }

    function build(){
      mol=openPose();
      group.add(mol);
      group.updateMatrixWorld(true);
      joined=false; anomer=null; refused=null; picked=null; pendingFace=null; vel.set(0,0,0);
      markSites();
      report();
    }

    const at=i=>{ const m=mol.userData.atomMeshes[i];
      return m ? m.getWorldPosition(V()) : null; };
    // The oxygen a closer names. 'O5x' is the ring oxygen itself, which in the
    // open chain is C5's hydroxyl — the one that actually closes glucose.
    const oxygenOf=c=>c.atom==='O5x' ? O5 : NAME[c.atom];

    /* ---- markers ----------------------------------------------------------
     * Every candidate oxygen is ringed, and so is C1. Same vocabulary as
     * condense-drag.js and molecule-builder's ghosts: a ring in the XY plane,
     * which faces the camera because the page has promised not to orbit. */
    function markSites(){
      halos=[];
      const P=global.MolLib.PALETTE;
      const add=(idx, el)=>{
        const host=mol.userData.atomMeshes[idx];
        if(!host) return null;
        const m=new THREE.Mesh(new THREE.TorusGeometry(1.5,0.17,12,40),
          new THREE.MeshBasicMaterial({ color:P.atoms[el]||0x888888,
            transparent:true, opacity:0.5, depthWrite:false, depthTest:false }));
        m.renderOrder=3;
        host.add(m);
        host.updateWorldMatrix(true,false);
        m.quaternion.copy(host.getWorldQuaternion(new THREE.Quaternion()).invert());
        halos.push(m);
        return m;
      };
      // the target: an oxygen is what lands on C1
      add(C1, 'O');
      // and every oxygen that could be the one to land, marked as carbon
      CLOSERS.forEach(c=>{ const i=oxygenOf(c); if(i!=null) c.halo=add(i,'C'); });
    }
    function clearHalos(){
      halos.forEach(m=>{ if(m.parent) m.parent.remove(m); });
      halos=[];
      CLOSERS.forEach(c=>{ c.halo=null; });
    }

    /* ---- which face, and therefore which anomer --------------------------
     * C1's carbonyl is planar: C1, the carbon before it and the oxygen on it
     * define that plane, and the attacking hydroxyl comes in above or below.
     * The sign is taken against the plane's own normal and then anchored to the
     * RING SPEC — the β spec is the one whose O5 sits on the reference side, so
     * the naming comes from the molecule rather than from a screen direction or
     * a guess about which way is up. */
    function faceAt(p){
      const c2=NAME.C2, o1=NAME.O1;
      const a=at(C1), b=at(c2), o=at(o1);
      if(!a||!b||!o||!p) return null;
      const n=b.clone().sub(a).cross(o.clone().sub(a)).normalize();
      // the reference: where the ring oxygen sits in the CLOSED β spec, carried
      // into this frame by the same three atoms
      const ref=refSide(n);
      return Math.sign(p.clone().sub(a).dot(n))===ref ? 'beta' : 'alpha';
    }
    function refSide(n){
      const beta=MOL[RECIPE.anomer.beta];
      const P=i=>V(beta.atoms[i].pos[0],beta.atoms[i].pos[1],beta.atoms[i].pos[2]);
      const a=P(NAME.C1), b=P(NAME.C2), o=P(NAME.O1);
      const nb=b.clone().sub(a).cross(o.clone().sub(a)).normalize();
      return Math.sign(P(O5).clone().sub(a).dot(nb)) || 1;
    }

    /* ---- closing ---------------------------------------------------------- */
    function close(c){
      joined=true;
      anomer=pendingFace || faceAt(at(oxygenOf(c)));
      const key=RECIPE.anomer[anomer];
      clearHalos();
      poseAsRing(key);
      if(fx) fx.spawnRing(at(C1), global.MolLib.PALETTE.bonds.covalent, null, 0.9);
      report();
    }
    /* Pose the whole molecule as the finished ring, from the ring spec's own
     * DISPLAYED coordinates — centred then turned by its `view:`, the order
     * Stage.buildMolecule uses. The atoms are the student's; the geometry is
     * the checked one. Same contract as condense-drag.js's place:'product'. */
    function poseAsRing(key){
      const ring=MOL[key];
      const rn={}; (ring.names||[]).forEach((n,i)=>{ rn[n]=i; });
      const c=Stage.centerOf(ring);
      const q=ring.view ? new THREE.Quaternion().setFromEuler(
        new THREE.Euler(ring.view[0]||0, ring.view[1]||0, ring.view[2]||0, 'ZYX')) : null;
      const target=i=>{ const a=ring.atoms[i].pos;
        const v=V(a[0]-c[0],a[1]-c[1],a[2]-c[2]);
        return q ? v.applyQuaternion(q) : v; };
      // every atom the two share by name — the chain IS the ring, re-posed
      const u=mol.userData;
      (spec.names||[]).forEach((nm,i)=>{
        const ri=rn[nm];
        if(ri===undefined || !u.atomMeshes[i]) return;
        u.atomMeshes[i].position.copy(target(ri));
      });
      u.bondMeshes.forEach(bm=>{
        delete bm.userData.openPair;           // the H is back on O1
        const [i,j]=bm.userData.pair;
        if(!u.atomMeshes[i]||!u.atomMeshes[j]) return;
        bm.visible=true;                       // the ring bond is back
        Stage.placeBond(bm, u.atomMeshes[i].position, u.atomMeshes[j].position);
      });
      mol.position.set(0,0,0);
    }

    /* ---- dragging ---------------------------------------------------------
     * The whole molecule does not move: ONE hydroxyl oxygen is dragged, and the
     * atoms hanging off it follow. Folding a molecule onto itself is not the
     * same gesture as bringing two together, which is why this is not
     * condense-drag.js with a different recipe. */
    const ray=new THREE.Raycaster(), ndc=new THREE.Vector2();
    const plane=new THREE.Plane(), hit=new THREE.Vector3();
    let grabOffset=V(), grabbed=null;

    function toNdc(e){
      const r=canvas.getBoundingClientRect();
      ndc.set(((e.clientX-r.left)/r.width)*2-1, -((e.clientY-r.top)/r.height)*2+1);
    }
    function pick(e){
      if(joined) return null;
      toNdc(e); ray.setFromCamera(ndc, camera);
      const targets=CLOSERS.map(c=>mol.userData.atomMeshes[oxygenOf(c)]).filter(Boolean);
      const h=ray.intersectObjects(targets, false)[0];
      if(!h) return null;
      return CLOSERS.find(c=>mol.userData.atomMeshes[oxygenOf(c)]===h.object)||null;
    }
    function pointerOnPlane(e){
      toNdc(e); ray.setFromCamera(ndc, camera);
      return ray.ray.intersectPlane(plane, hit) ? hit.clone() : null;
    }
    const surface=canvas.parentElement||canvas;
    function onDown(e){
      const c=pick(e);
      if(!c) return;
      e.stopPropagation(); e.preventDefault();
      grabbed=c; held=true; picked=c; refused=null; vel.set(0,0,0);
      // the plane through C1, so what looks like contact IS contact — the same
      // reachability rule condense-drag.js's header sets out
      plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(V()).negate(), at(C1));
      const p=pointerOnPlane(e);
      const n=camera.getWorldDirection(V()).normalize();
      if(p){
        grabOffset.copy(at(oxygenOf(c)).sub(p));
        grabOffset.addScaledVector(n, -grabOffset.dot(n));
      } else grabOffset.set(0,0,0);
      canvas.style.cursor='grabbing';
      report();
    }
    function onMove(e){
      if(joined) return;
      if(!held){
        if(!canvas.style.cursor || canvas.style.cursor==='grab' || canvas.style.cursor==='')
          canvas.style.cursor = pick(e) ? 'grab' : '';
        return;
      }
      const p=pointerOnPlane(e); if(!p) return;
      moveOxygen(grabbed, p.add(grabOffset));
      report();
    }
    /* Move one oxygen, and bring what hangs off it. Everything on the far side
     * of its bond to the chain travels with it — its own hydrogen — while the
     * chain itself holds still. A hydroxyl that left its H behind would be
     * drawing a bond stretching to nothing. */
    function moveOxygen(c, worldTarget){
      const oi=oxygenOf(c);
      const u=mol.userData;
      const anchor=carbonOf(oi);
      const riders=MolGraph.component(spec, oi, [[anchor,oi], RING_BOND])
        .filter(i=>i!==anchor);
      const local=mol.worldToLocal(worldTarget.clone());
      const delta=local.clone().sub(u.atomMeshes[oi].position);
      riders.forEach(i=>{ const m=u.atomMeshes[i]; if(m) m.position.add(delta); });
      redrawBonds(mol);
    }
    /* The carbon an attacking oxygen stays attached to — NEVER C1.
     *
     * O5 is the ring oxygen and is bonded to two carbons, C1 and C5. In the open
     * chain it belongs to C5; C1 is the carbonyl it is coming to attack. Taking
     * the first carbon in bond order picks C1, which makes 23 of the molecule's
     * 24 atoms "riders": dragging the oxygen then swings the entire molecule
     * rigidly about the one atom it is supposed to approach, the C1···O5 distance
     * never changes, and the anomer comes out the same every time because the
     * approach side never changed either. The hydroxyls each have one carbon, so
     * nothing else here notices. */
    /* While the chain is open, one bond is drawn somewhere other than where the
     * spec says: the anomeric H hangs off O5, not O1. `openPair` carries that
     * override, and it is deleted the moment the ring closes. */
    function redrawBonds(g){
      const u=g.userData;
      u.bondMeshes.forEach(bm=>{
        const [i,j]=bm.userData.openPair||bm.userData.pair;
        if(!u.atomMeshes[i]||!u.atomMeshes[j]) return;
        Stage.placeBond(bm, u.atomMeshes[i].position, u.atomMeshes[j].position);
      });
    }

    function carbonOf(oi){
      const a={};
      (spec.bonds||[]).forEach(([i,j])=>{ (a[i]=a[i]||[]).push(j); (a[j]=a[j]||[]).push(i); });
      return (a[oi]||[]).find(k=>spec.atoms[k].el==='C' && k!==C1);
    }
    function onUp(){
      held=false; grabbed=null; canvas.style.cursor='';
      if(!joined) pendingFace=null;           // let go and the choice is open again
      report();
    }
    surface.addEventListener('pointerdown', onDown, true);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);

    /* ---- the loop --------------------------------------------------------- */
    function step(dt){
      if(joined || !mol) return;
      clock+=dt;
      const target=at(C1);
      let nearest=null, nd=Infinity;
      CLOSERS.forEach(c=>{
        const p=at(oxygenOf(c)); if(!p) return;
        const d=p.distanceTo(target);
        if(d<nd){ nd=d; nearest=c; }
        if(c.halo) c.halo.material.opacity =
          (d<=S.CAPTURE?0.95:0.5)-0.12+0.12*Math.sin(clock*3.2);
      });
      if(!nearest) return;
      // latch on the way in; forget it once the hand backs out of range again
      if(nearest.closes){
        if(nd<=S.CAPTURE){ if(!pendingFace) pendingFace=faceAt(at(oxygenOf(nearest))); }
        else pendingFace=null;
      }
      if(nd<=S.SNAP){
        if(nearest.closes) close(nearest);
        else refuse(nearest);
      }
    }
    /* A ring that cannot be made is REFUSED, and the refusal carries the
     * number. Snapping the atom back is the whole point: a kit that let you
     * force a three-membered ring would be teaching that you can. */
    function refuse(c){
      refused=c; pendingFace=null;
      const oi=oxygenOf(c);
      const home=homeOf(oi);
      moveOxygen(c, mol.localToWorld(home.clone()));
      held=false; grabbed=null;
      // popGlow takes a GROUP and lights its emissive atoms; the refusal wants a
      // mark at a POINT, which is spawnRing's job.
      if(fx) fx.spawnRing(at(oi), 0xc0392b, null, 0.7);
      report();
    }
    // Where an oxygen sits in the untouched open pose, so a refusal puts it
    // back exactly rather than approximately.
    let HOME=null;
    function homeOf(i){
      if(!HOME){
        HOME={};
        mol.userData.atomMeshes.forEach((m,k)=>{ if(m) HOME[k]=m.position.clone(); });
      }
      return HOME[i];
    }

    /* ---- what the page narrates ------------------------------------------- */
    let last='';
    function report(){
      const s=state(), k=JSON.stringify(s);
      if(k!==last){ last=k; onChange(s); }
    }
    function state(){
      const target=mol?at(C1):null;
      const rows=CLOSERS.map(c=>{
        const p=mol?at(oxygenOf(c)):null;
        const st=strainOf(c.ring);
        return { atom:c.atom==='O5x'?'O5':c.atom, ring:c.ring,
                 closes:!!c.closes, real:c.real||null, note:c.note||null,
                 angle:+st.angle.toFixed(1), off:+st.off.toFixed(1),
                 source:st.source, from:st.from,
                 near: p && target ? p.distanceTo(target)<=S.CAPTURE : false };
      });
      const face=joined?anomer:pendingFace;
      return {
        joined, anomer:face,
        product: face ? RECIPE.anomer[face] : null,
        refused: refused ? (()=>{ const st=strainOf(refused.ring);
                             return { atom:refused.atom==='O5x'?'O5':refused.atom,
                               ring:refused.ring,
                               angle:+st.angle.toFixed(1), off:+st.off.toFixed(1),
                               source:st.source, from:st.from,
                               real:refused.real||null, note:refused.note||null }; })() : null,
        picked: picked ? (picked.atom==='O5x'?'O5':picked.atom) : null,
        tetrahedral:TET,
        closers:rows,
      };
    }

    function reset(){
      motion.cancel('ringclose');
      clearHalos();
      HOME=null;
      group.clear();
      build();
    }
    function destroy(){
      surface.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      motion.cancel('ringclose');
      root.remove(group);
    }

    build();
    return { group, step, reset, destroy, state };
  }

  global.RingClose = { create, RECIPE, CLOSERS, strainOf };
})(this);
