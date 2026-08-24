/* =============================================================================
 *  ionic-drag.js — build an ion pair by HAND: the metal does not share, it GIVES
 * =============================================================================
 *  Loaded as a classic script AFTER three.min.js, molecules.js, scene.js, fx.js
 *  and atomkit.js.
 *
 *  A sibling of covalent-drag.js, deliberately NOT a mode of it. The two lessons
 *  share a look (atomkit.js) and a feel (drag, attraction, snap) but not a
 *  mechanic, and the difference is the entire point of putting them in adjacent
 *  tabs:
 *
 *    COVALENT  a slot is filled. Two electrons end up BETWEEN the nuclei and
 *              belong to both atoms. Neither atom's count changes.
 *    IONIC     nothing is filled and nothing is between them. One electron
 *              MOVES, permanently: the metal ends with none of its own and the
 *              nonmetal ends with eight. What holds the pair together afterwards
 *              is opposite charge, not anything in the gap.
 *
 *  That is why this file has no valence slots and no shared pair: there is
 *  nothing in the gap to draw. Stick view still gets a stick, because that is
 *  the schematic the rest of the project speaks — but an amber one, the
 *  palette's ion colour, never a covalent grey.
 *
 *  Counts are the argument, so they are drawn rather than asserted: the metal
 *  shows its loose electrons, the nonmetal shows seven (one short of full), and
 *  after the transfer you can count 0 and 8.
 *
 * ---------------------------------------------------------------------------
 *  ONE METAL, N NONMETALS
 * ---------------------------------------------------------------------------
 *  NaCl and KCl each move one electron, but MgCl₂ is the reason this file is
 *  written around a LIST of nonmetals rather than a second named atom.
 *  Magnesium is 2,8,2 — two loose electrons, and no single chlorine can take
 *  both, because chlorine is one short of full and not two. So the count on the
 *  metal is what forces the formula, and a student can watch it happen: dock one
 *  chloride and magnesium goes 2 → 1 and wears a single +; dock the second and
 *  it goes 1 → 0 and reads 2+.
 *
 *  The two transfers are INDEPENDENT on purpose. Mg⁺ is a real, fleeting thing
 *  and showing it beats jumping straight to 2+, because "how many electrons has
 *  it lost so far" is the only question this tab is asking.
 *
 *  With n:1 every generalisation below collapses back to exactly the old
 *  two-atom behaviour — one nonmetal, one stick, one hop, no repulsion pair, a
 *  badge that never gets past +. NaCl and KCl are meant to be unchanged.
 *
 *  Usage:
 *    const s = IonicDrag.create({THREE, root, camera, canvas, fx, onChange,
 *                                recipe:'nacl'});
 *    s.setMode('electrons'|'sticks');  s.setDim('2d'|'3d');  s.reset();
 *    s.fill();            // snap straight to the transferred pair (a re-opened lesson)
 *    s.offerWater();      // put the pair in water — the solvent stage, below
 *    s.finishReaction();  // …and snap that to dissolved (a re-opened one)
 * ========================================================================== */
(function(global){
  'use strict';

  const S = {
    CAPTURE: 4.2,             // ionic attraction reaches further than a slot does
    SNAP: 0.5,
    /* How far off the bond length a dragged ion has to be pulled before the
     * transfer un-does itself. Scaled per recipe by `hold` below — this is the
     * NaCl figure, and it is deliberately larger than a covalent BREAK (1.35):
     * an ion pair that came apart as easily as a slot lets go of a ligand
     * teaches the opposite of what the tab is for. */
    BREAK: 1.9,
    DAMP: 0.86,
    PULL: 30,               // approach, before the electron moves
    SPRING: 34,             // the charge hold afterwards, about NACL
    HOP: 0.55,                // seconds for the electron to cross
    /* Two Cl⁻ push each other apart — the only thing making MgCl₂ linear. It is
     * applied tangentially (see the repulsion pass in step()), so it can only
     * ever argue about the ANGLE and the bond length stays exactly REST however
     * large this gets. That is what sets the number: nothing here trades against
     * geometry, so it is chosen purely on how long the swing to 180° should
     * take. ~4s from a right angle — slow enough to read as a settle, not so
     * slow the student has stopped watching. Approach is exponential (the
     * restoring force vanishes at 180°), so halving this roughly doubles it. */
    REPEL: 450,
  };

  /* Separations are roomier than any covalent bond in the project (O–H is 1.55
   * against radii summing to 1.50): Na 0.70 + Cl 1.24 = 1.94 against 2.55. The
   * gap is deliberate — nothing is shared across it, and the eye should read a
   * space between two ions rather than a join. Potassium is the bigger atom and
   * gets the longer bond, straight from molecules.js.
   *
   * Mg–Cl is 2.18 Å in the gas phase against Na–Cl's 2.36; both are stretched by
   * the same ~1.08 for legibility, so MgCl₂ comes out SHORTER than NaCl on
   * screen. That ordering is the chemistry — Mg²⁺ is the smaller, harder-pulling
   * ion — and it survives only because neither number was hand-picked.
   *
   * `n` is how many nonmetals the metal has to supply, which for these recipes
   * is also how many electrons it starts with: one each.
   *
   * `hold` is how hard the pair is to pull apart, and it is the one number on
   * this page a student can FEEL rather than count. It comes from the lattice
   * enthalpies — KCl 715, NaCl 787, MgCl₂ 2526 kJ/mol — taken as a ratio against
   * NaCl and square-rooted: 0.95, 1, 1.79. The square root is a legibility
   * choice and nothing else. MgCl₂ really is ~3× the energy, but a bond that
   * needed a drag three times the length of the stage would just read as broken
   * UI, so the ordering is kept exact and the spread compressed.
   *
   * The ordering is the whole point, and it is two separate reasons stacked:
   * K⁺ is a bigger ion than Na⁺, so its bond is longer and weaker (KCl melts at
   * 770 °C against NaCl's 801); Mg²⁺ carries twice the charge on a smaller ion,
   * and charge is the term that dominates — doubling it does far more than the
   * size difference between K and Na ever could. A student who drags all three
   * learns that "ionic" is not one strength.
   * NOT claimed here: that lattice energy orders melting points. MgCl₂ melts
   * LOWER than NaCl despite ~3× the lattice energy, which is a real and separate
   * lesson (the small, hard Mg²⁺ distorts chloride and the bond picks up
   * covalent character). This page is only saying how hard the pair is to pull
   * apart, so it stays with the energy and does not borrow the melting point.
   */
  const RECIPES = {
    nacl:  { metal:'Na', nonmetal:'Cl', bond:2.55, n:1, hold:1 },
    kcl:   { metal:'K',  nonmetal:'Cl', bond:2.70, n:1, hold:0.95 },
    mgcl2: { metal:'Mg', nonmetal:'Cl', bond:2.35, n:2, hold:1.79 },
  };

  /* Where the atoms are dealt. The n:1 pair is unchanged. For MgCl₂ both
   * chlorines start on the SAME side — if they began at ±180° the answer would
   * already be on the table, and the swing apart after the second transfer is
   * the moment the lesson lands. */
  const STARTS = {
    1: { metal:[-4.6,0.6,0], nons:[[4.4,-0.4,0]] },
    2: { metal:[-4.6,0.6,0], nons:[[4.6,-1.9,0],[3.9,2.2,0]] },
  };

  /* Where an ion's electrons sit. 3D spreads them tetrahedrally, the same
   * arrangement a free ion's leftover pairs take; 2D rings them around the atom in
   * the plane, because the whole reason to have a flat view is being able to
   * count to eight without orbiting. */
  const S3=1/Math.sqrt(3);
  const DIRS_3D=[[S3,S3,S3],[S3,-S3,-S3],[-S3,S3,-S3],[-S3,-S3,S3]];
  const DIRS_2D=[[0,1,0],[1,0,0],[0,-1,0],[-1,0,0]];

  /* ---- the solvent stage: what water does to a finished ion pair ---------
   * Only ever offered on a card that opens with the pair already made, and it
   * is the argument the ionic tab cannot make on its own: the bond the student
   * just built is not undone by pulling, it is undone by WATER. No electron
   * comes back — sodium stays Na⁺ and chlorine stays Cl⁻ all the way through,
   * which is why the dots and the badges are never touched here.
   *
   * SIX waters to an ion, which is what a first shell actually holds, and the
   * two views draw that number two different ways:
   *
   *   3D   an OCTAHEDRON. Six directions in a frame built on the axis pointing
   *        away from the partner: that axis, the two perpendicular to it in the
   *        stage plane, the two out of it, and the one facing the partner. This
   *        is the arrangement Na⁺ and Cl⁻ really take, and it is the reason the
   *        number is six rather than a number someone picked.
   *   2D   a ring of six at 60°. Two of the octahedron's waters sit in front of
   *        and behind the ion, and drawn straight on they land ON it — so the
   *        flat view spreads all six around the circle instead. Exactly the
   *        trade methane's flat view makes (tetrahedron drawn N/E/S/W): the
   *        count is the thing the flat view has to keep, the shape is what 3D
   *        is one click away for.
   *
   * The seat facing the partner is the interesting one. It has nowhere to go
   * until the pair is pulled open, and getting the CATION's in is the whole
   * interaction — the anion's follows on geometry once the two are properly
   * apart, which is why the finished picture has two waters standing between
   * the ions rather than one.
   *
   * Screening is charged to the water that gets BETWEEN the ions, not to the
   * shell as a whole: three waters parked on the far side of sodium change
   * nothing a student can see, and one wedged in the gap changes everything.
   */
  const SOLV = {
    SEATS: 6,                 // an octahedron; see the header for the flat view
    // the flat ring, degrees off the outward axis. Ordered so the last seat is
    // the one facing the partner in BOTH views — that seat is the wedge.
    ANG2D: [0, 60, -60, 120, -120, 180],
    DOCK: 0.86,               // arrival fraction that counts as docked
    // how far off-stage a water waits for its seat — past the frame at every
    // zoom this card uses, so it is out of the picture rather than parked in it
    WAIT: 17,
    /* Water–water centres come no closer than this. A safety net rather than a
     * physics: the seats are chosen not to collide, but a water waiting for
     * room and a water on a seat are placed by different rules and can still
     * end up drawn on top of each other. water-lab's liquid holds its molecules
     * at an O···O of 3.6 and floors them at 1.9; this is the same floor with
     * enough daylight that two oxygens never merge. */
    MIN_OO: 2.6,
    TIGHT: 0.92,              // see shellR(): the shells are drawn compressed
    // H···O, in display units. water-lab's number, so a hydrogen bond means the
    // same distance on both pages — the two lessons are drawn to one scale.
    HB: 3.25,
    /* Once every wedge is in, the pair keeps a separation set by the two shells
     * rather than by the charges — same spring, new rest length. That is the
     * honest shape of the claim: the attraction did not vanish, it now has two
     * layers of water in the way. */
    LOOSE: 0.3,               // what is left of the ionic spring once wrapped
  };
  /* Water, drawn to the same numbers as every other water in the project: the
   * O–H vectors come straight out of MolLib (family A, 1.55), and the lone
   * pairs use the tetrahedral pair covalent-drag.js draws on the water tab —
   * out of the H–O–H plane in 3D, swung into it in 2D so they stay countable. */
  const WAT = {
    lone:     [[0,0.6116,0.7910], [0,0.6116,-0.7910]],
    loneFlat: [[0.6116,0.7910,0], [-0.6116,0.7910,0]],
  };

  function create(opts){
    const THREE=opts.THREE, root=opts.root, camera=opts.camera,
          canvas=opts.canvas, fx=opts.fx||null,
          onChange=opts.onChange||function(){};
    const P=global.MolLib.PALETTE;
    const kit=AtomKit.create(THREE);
    const R=RECIPES[opts.recipe||'nacl'];
    const REST=R.bond;
    // per-recipe bond strength — see `hold` on the recipes above
    const HOLD=R.hold||1;
    const BREAK=S.BREAK*HOLD;
    const N=R.n||1;
    const TOUCH=(P.radii[R.metal]+P.radii[R.nonmetal])*1.06;   // solid nuclei
    const TOUCH_NN=(P.radii[R.nonmetal]*2)*1.06;               // ...and between anions

    const group=new THREE.Group(); root.add(group);
    let mode='electrons', dim='3d';
    let metal=null, nons=[], t=0;

    function all(){ return metal ? [metal].concat(nons) : []; }
    function done(){ return nons.length>0 && nons.every(a=>a.given); }
    function moved(){ return nons.filter(a=>a.given).length; }   // electrons gone

    function v3(a){ return new THREE.Vector3(a[0],a[1],a[2]); }

    /* ---- an ion's electrons -------------------------------------------
     * Redrawn whenever the count changes, because the count IS the lesson: 1 → 0
     * on sodium (2 → 1 → 0 on magnesium) and 7 → 8 on chlorine, countable at
     * every step. Pairs sit together and the odd one stands alone, so "one short
     * of full" is visible on chlorine before anything happens — and magnesium's
     * two go up as a PAIR, which is what 3s² actually is. */
    function clearDots(atom){
      atom.dots.forEach(d=>{ atom.group.remove(d); kit.forget(d); }); atom.dots=[];
    }
    function drawDots(atom){
      clearDots(atom);
      let dirs=(dim==='2d')?DIRS_2D:DIRS_3D;
      /* Chlorine's electrons are laid out last-direction-last, and the electron
       * it was handed is the last one — so spin the whole layout until that
       * direction faces the metal it came from. The newcomer then lands where it
       * arrived from rather than somewhere around the back, which is what makes
       * the flight and the final arrangement agree. (In 2D the ordering already
       * lands it there; in 3D it was ending up behind the ion.) */
      if(atom.partner && atom.given){
        const toM=new THREE.Vector3().subVectors(
          atom.partner.group.position, atom.group.position);
        if(toM.lengthSq()>1e-6){
          const q=new THREE.Quaternion().setFromUnitVectors(
            v3(dirs[dirs.length-1]).normalize(), toM.normalize());
          dirs=dirs.map(d=>v3(d).normalize().applyQuaternion(q).toArray());
          atom.lastAxis=toM.clone();
        }
      }
      const r=(P.radii[atom.el]||0.7)+kit.DOT_GAP;   // one gap for every lesson
      // one colour per electron, so the newcomer can be picked out by eye
      const cols=[];
      for(let n=0;n<atom.count;n++) cols.push(P.atoms[atom.el]);

      let k=0, i=0;
      while(k<cols.length && i<dirs.length){
        const d=v3(dirs[i]).normalize(); i++;
        const perp=new THREE.Vector3().crossVectors(d,
          Math.abs(d.z)<0.9?new THREE.Vector3(0,0,1):new THREE.Vector3(0,1,0)).normalize();
        const base=d.multiplyScalar(r);
        const here=cols.slice(k, k+2); k+=here.length;
        here.forEach((col,j)=>{
          const m=kit.dot(col);
          m.position.copy(base);
          if(here.length===2) m.position.addScaledVector(perp, (j?1:-1)*0.17);
          atom.group.add(m); atom.dots.push(m);
        });
      }
      applyMode();
    }

    function makeAtom(el, pos, count){
      const g=new THREE.Group(); g.position.copy(pos);
      const sphere=Stage.atom(P.atoms[el], P.radii[el], new THREE.Vector3(), el);
      const cl2=kit.cloud(el);
      // atomkit owns which view gets light letters and which gets dark; keep the
      // sprite so setDim() can re-ink it when the view flips
      const tag=kit.label(el, el); tag.setDim(dim);
      g.add(sphere, cl2, tag);
      group.add(g);
      const a={ el, group:g, sphere, cloud:cl2, label:tag, count, dots:[],
                vel:new THREE.Vector3(), dragging:false,
                // per-partner state: everything below used to be a module-level
                // singleton, and is the whole reason MgCl₂ needed a refactor
                partner:null, given:false, stick:null, hop:null,
                lastAxis:null, badge:null };
      sphere.userData.atom=a;      // so pick() can map a raycast hit back
      return a;
    }

    function build(){
      // the metal on the left with its loose electrons, the nonmetals on the
      // right with seven each — the asymmetry the student is meant to notice
      // first, and on MgCl₂ the 2-against-7 that makes one chlorine not enough
      const st=STARTS[N]||STARTS[1];
      metal=makeAtom(R.metal, v3(st.metal), N);
      nons=st.nons.map(p=>{
        const a=makeAtom(R.nonmetal, v3(p), 7);
        a.partner=metal;
        return a;
      });
      all().forEach(drawDots);
      applyCel(); applyMode();
      onChange(state());
    }

    /* ---- the transfer --------------------------------------------------
     * The electron itself makes the trip: the metal's dot detaches, flies the
     * gap, and lands on chlorine having turned from the metal's colour to GREEN.
     * The colour change is the point — an electron wears its owner's colour
     * everywhere in this project (atomkit.js), so changing colour mid-flight is
     * the same sentence as "it changed owner". Nothing about it is shared or
     * returned: chlorine's eight are eight green electrons afterwards,
     * indistinguishable, which is exactly the chemistry.
     *
     * One nonmetal at a time. On MgCl₂ the second chloride can be sitting far
     * away, or nowhere near yet, and the first bond is complete without it.
     */
    /* `instant` is for fill(): the electron is ALREADY across. No flight, no
     * flash — the transfer is the thing this tab is about, and replaying it for
     * a lesson the student is only re-opening claims something just happened. */
    function transfer(a, instant){
      a.given=true;
      // Counts change NOW, not when the flight lands: the callback only runs
      // while the frame loop does, so a backgrounded tab would otherwise leave
      // the readout stale. The flight is animation over already-correct state,
      // and during it the eighth electron is simply the one in transit.
      metal.count=N-moved();
      a.count=instant?8:7;
      drawDots(metal); drawDots(a);
      // what stepHop() would have done on landing, minus the landing
      if(instant){ showCharge(a); metalCharge(); }
      else startHop(a);

      /* The stick is a STICK-VIEW object only. In the electron view drawing a
       * cylinder would contradict the lesson — there is no shared pair in that
       * gap, only two charges — but stick view is the schematic the rest of the
       * project speaks (water-lab draws its ion pairs this way), and a student
       * who switches to it to see "the bond" should find one. It is amber, the
       * palette's ion colour, so it never reads as a covalent stick. */
      a.stick=Stage.bond(metal.group.position, a.group.position,
                         P.bonds.iondipole, 0.10, 1);
      group.add(a.stick);
      applyCel(); applyMode();
      onChange(state());
    }

    /* The + and − go on when the electron LANDS, not when it sets off. A charge
     * is the consequence of the transfer, and badging both atoms while the
     * electron is still in the air says the opposite — that they were already
     * ions and the flight is decoration. Held back the length of the hop, the
     * badges become the punctuation on it: the dot arrives, and the charges are
     * what it left behind. (unbond() takes them off again the same way.)
     *
     * The metal's badge is rebuilt rather than set once, because on MgCl₂ its
     * TEXT changes: blank → + → 2+. The half-way + is deliberate — Mg⁺ is real,
     * and hiding it would hide the staging that is the reason for this tab. */
    function hex(el){ return '#'+new THREE.Color(P.atoms[el]).getHexString(); }
    function metalCharge(){
      if(metal.badge){ metal.group.remove(metal.badge); kit.forget(metal.badge); }
      metal.badge=null;
      const k=moved();
      if(!k) return;
      metal.badge=kit.charge(k>1?(k+'+'):'+', hex(R.metal), R.metal);
      metal.group.add(metal.badge);
    }
    function showCharge(a){
      if(a.badge) return;
      a.badge=kit.charge('−', hex(R.nonmetal), R.nonmetal);
      a.group.add(a.badge);
    }

    /* the flight: the metal's own dot, re-parented to the pair and animated across */
    function startHop(a){
      const from=metal.group.position.clone();
      const m=kit.dot(P.atoms[R.metal]);
      m.position.copy(from);
      group.add(m);
      a.hop={ m, from, k:0,
              c0:new THREE.Color(P.atoms[R.metal]), c1:new THREE.Color(P.atoms[R.nonmetal]) };
    }
    // where the newcomer is headed: chlorine's surface on the side facing the metal
    function hopTarget(a){
      const dir=new THREE.Vector3().subVectors(metal.group.position, a.group.position);
      if(dir.lengthSq()<1e-6) dir.set(-1,0,0);
      return a.group.position.clone()
        .addScaledVector(dir.normalize(), P.radii[R.nonmetal]+kit.DOT_GAP);
    }
    function stepHop(a, dt){
      const hop=a.hop; if(!hop) return;
      hop.k=Math.min(1, hop.k+dt/S.HOP);
      const to=hopTarget(a);
      hop.m.position.lerpVectors(hop.from, to, hop.k);
      hop.m.position.y += 0.9*Math.sin(hop.k*Math.PI);          // a small arc
      hop.m.material.color.copy(hop.c0).lerp(hop.c1, hop.k);    // metal → green
      if(hop.k>=1){
        const at=hop.m.position.clone();
        group.remove(hop.m); a.hop=null;
        a.count=8; drawDots(a);                                  // it has arrived
        showCharge(a); metalCharge();
        /* The pulse goes where the ELECTRON lands, not on the chlorine as a
         * whole: the event is one electron arriving at one place on the shell,
         * and a glow over the entire ion would say the ion changed rather than
         * that it gained a specific electron. Core + sparks, not spawnRing —
         * the full ring stays reserved for finishing a molecule, so it keeps
         * meaning "done" instead of firing twice a second apart. */
        /* Anchored to the chloride, not to the point in space where it was
         * standing: the ions are still settling into the bond as this plays,
         * and on MgCl₂ the second landing is followed by the whole swing to
         * 180°. The flash belongs to the shell it landed on. */
        if(fx){
          fx.spawnCore(at, 0xffffff, a.group);
          fx.spawnBurst(at, P.atoms[R.nonmetal], 14, a.group);
        }
        onChange(state());
      }
    }
    function stickLayout(){
      nons.forEach(a=>{
        const stick=a.stick; if(!stick) return;
        const p=metal.group.position, q=a.group.position;
        const dir=new THREE.Vector3().subVectors(q,p), len=dir.length();
        stick.position.copy(p).addScaledVector(dir, 0.5);
        stick.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), dir.clone().normalize());
        stick.scale.set(1, len/(stick.userData.len||len), 1);
        if(!stick.userData.len) stick.userData.len=len;
      });
    }
    /* One bond comes undone, not the molecule. Pull a chloride off MgCl₂ and the
     * other one stays put — magnesium simply drops from 2+ back to +, which is
     * the same claim the counts make, read backwards. */
    function unbond(a){
      if(!a.given) return;
      a.given=false; a.lastAxis=null;
      a.count=7;
      if(a.stick){ group.remove(a.stick); a.stick=null; }
      if(a.hop){ group.remove(a.hop.m); a.hop=null; }
      if(a.badge){ a.group.remove(a.badge); kit.forget(a.badge); a.badge=null; }
      metal.count=N-moved();
      metalCharge();
      drawDots(metal); drawDots(a);
      onChange(state());
    }

    /* ---- water: the solvent stage --------------------------------------
     * Deliberately not an IonicDrag or a CovalentDrag instance. These waters
     * are never built, never taken apart and never dragged — they are what the
     * ions are IN, and the only thing they own is where they sit and which way
     * they face. Same argument covalent-drag.js makes about its reagent. */
    // the seat facing the partner, in both views' orderings
    const WEDGE=SOLV.SEATS-1;
    const WSPEC=(global.MolLib.MOLECULES||{}).water;
    const HPOS=WSPEC ? WSPEC.atoms.filter(a=>a.el==='H').map(a=>a.pos)
                     : [[1.226,-0.948,0],[-1.226,-0.948,0]];
    let waters=[], poured=false;

    const HLEN=Math.hypot(HPOS[0][0],HPOS[0][1],HPOS[0][2]);
    /* Display units per Ångström, read off the page's own water: an O–H drawn
     * at 1.55 for a real 0.958 Å. Everything below is a measured distance put
     * through it, so the shells are not eyeballed. */
    const UPA=HLEN/0.958;
    /* Ion centre to water OXYGEN centre, Ångström. Measured values: Na⁺–O 2.40,
     * K⁺–O 2.80, Mg²⁺–O 2.09 (all from the first peak of the ion–water radial
     * distribution), Cl⁻–O 3.15, which is longer because the chloride is met by
     * a HYDROGEN and the oxygen sits an O–H further out. */
    const ION_O={ Na:2.40, K:2.80, Mg:2.09, Cl:3.15 };

    function shellR(a){
      /* Which end of the water is doing the touching sets the distance, and the
       * two ends are not the same size. The cation is met by the OXYGEN, so the
       * ion and O only have to clear each other; the anion is met by a
       * HYDROGEN, which puts the oxygen a whole O–H further out. Drawing both
       * shells at one radius would hide the reason chloride's shell looks
       * loose: it is being held at arm's length. The cation's extra 0.70 is
       * daylight rather than chemistry: four waters will not fit round a shell
       * drawn at bare contact without their oxygens overlapping. */
      /* Drawn at SOLV.TIGHT of the true distance. An explicit exaggeration:
       * at full scale a dissolved pair with both shells is about twenty units
       * across, which on this stage means atoms too small to read the badges
       * on — and the badges and the electron counts are what the card is
       * arguing about. The ORDER is exact (chloride's shell really is the
       * looser one) and only the overall spread is squeezed. */
      return (ION_O[a.el]||2.5)*UPA*SOLV.TIGHT;
    }
    function makeWater(ion, slot){
      const g=new THREE.Group();
      const osph=Stage.atom(P.atoms.O, P.radii.O, new THREE.Vector3(), 'O');
      const otag=kit.label('O','O'); otag.setDim(dim);
      g.add(osph, otag);
      const hs=HPOS.map(p=>{
        const hg=new THREE.Group(); hg.position.copy(v3(p));
        const tag=kit.label('H','H'); tag.setDim(dim);
        hg.add(Stage.atom(P.atoms.H, P.radii.H, new THREE.Vector3(), 'H'), tag);
        g.add(hg); return hg;
      });
      const sticks=hs.map(hg=>{
        const st=Stage.bond(new THREE.Vector3(), hg.position, P.bonds.covalent, 0.09, 1);
        g.add(st); return st;
      });
      // one dot from each atom in the gap, and the pair leans toward oxygen —
      // the same drawing of an O–H the water tab makes, for the same reason
      const pairs=hs.map(hg=>{
        const d=[kit.dot(P.atoms.O,{overlay:true}), kit.dot(P.atoms.H,{overlay:true})];
        d.forEach(m=>g.add(m));
        const c=hg.position.clone().normalize().multiplyScalar(
          P.radii.O+(HLEN-P.radii.O-P.radii.H)*0.5-0.12);
        const across=perpTo(hg.position);
        d.forEach((m,k)=>m.position.copy(c).addScaledVector(across,(k?1:-1)*0.17));
        return d;
      });
      const lones=[0,1].map(()=>[kit.dot(P.atoms.O), kit.dot(P.atoms.O)]);
      lones.forEach(d=>d.forEach(m=>g.add(m)));
      group.add(g);
      const w={ group:g, sphere:osph, hs, sticks, pairs, lones, ion, slot,
                k:0, latched:false };
      /* Dealt from outside the frame on the side it will end up on, so the pour
       * reads as water arriving rather than as eight molecules fading in. */
      g.position.copy(new THREE.Vector3().subVectors(seatOf(w).p, ion.group.position)
        .normalize().multiplyScalar(11).add(ion.group.position));
      layoutWaterDots(w);
      return w;
    }
    function perpTo(v){
      return new THREE.Vector3().crossVectors(v,
        Math.abs(v.z)<0.9?new THREE.Vector3(0,0,1):new THREE.Vector3(0,1,0)).normalize();
    }
    // the lone pairs are the only part of a water that moves when the view flips
    function layoutWaterDots(w){
      const dirs=(dim==='2d')?WAT.loneFlat:WAT.lone;
      w.lones.forEach((d,i)=>{
        const u=v3(dirs[i]).normalize();
        const base=u.clone().multiplyScalar(P.radii.O+kit.DOT_GAP);
        const across=perpTo(u);
        d.forEach((m,k)=>m.position.copy(base).addScaledVector(across,(k?1:-1)*0.16));
      });
    }

    /* Where this water belongs, in the ion's frame: the axis pointing away from
     * everything else in the pair, turned by the slot's angle. Recomputed every
     * frame rather than fixed at the pour, so the shells swing round to stay on
     * the outside as the ions come apart — which is what makes the wedge slot
     * open at all. */
    function outward(ion){
      const away=new THREE.Vector3();
      all().forEach(o=>{ if(o!==ion) away.add(
        new THREE.Vector3().subVectors(ion.group.position, o.group.position).normalize()); });
      if(away.lengthSq()<1e-6) away.set(1,0,0);
      return away.normalize();
    }
    /* The seat's direction, in a frame the pair itself defines: `u` away from
     * the partner, `q` square to it across the stage, `p` out of the stage. So
     * the shell is described relative to the bond rather than to the world, and
     * it swings round to stay on the outside as the ions move. */
    function slotDir(w){
      const u=outward(w.ion);
      if(dim==='2d')
        return u.applyAxisAngle(new THREE.Vector3(0,0,1),
                                SOLV.ANG2D[w.slot]*Math.PI/180).normalize();
      const p=new THREE.Vector3(0,0,1);
      const q=new THREE.Vector3().crossVectors(u,p).normalize();
      /* The four equatorial waters ride a circle about the outward axis, and
       * WHERE on that circle is a drawing decision, not a chemical one — the
       * octahedron is the same however it is spun. Left square to the stage,
       * two of them point straight at the camera and straight away from it and
       * are drawn on top of the ion. Turned a neat 45° they pair up instead:
       * the camera sees only their height, and ±45° gives two heights for four
       * waters, so two of the six hide behind the other two and a student
       * counts five. 30° is the nearest angle that gives all four a height of
       * their own (±cos30, ±sin30) while leaving none of them on the ion. */
      const th=Math.PI/6;
      const eq=k=>q.clone().multiplyScalar(Math.cos(th+k*Math.PI/2))
                   .addScaledVector(p, Math.sin(th+k*Math.PI/2)).normalize();
      // wedge last, so the slot index means the same in both views
      return [u, eq(0), eq(1), eq(2), eq(3), u.clone().negate()][w.slot];
    }
    /* Is there room? A slot is blocked while its seat would be inside another
     * ion's own shell, which is exactly what keeps the wedge waiting outside
     * until the student opens the gap. */
    function slotFree(w){
      /* The cation's wedge is never blocked: it is the water that does the
       * work. It goes for the gap from the moment there is water, sits against
       * the two ions where it can reach — off the axis at first, because at
       * contact there is nowhere on the axis it fits — and its arrival is what
       * splits the pair. Nobody pulls a solvated ion pair apart; water pries it.
       * Same event water-lab calls a BRIDGING water, on the same test: an
       * oxygen wedged onto the Na⁺–Cl⁻ axis between the two.
       *
       * Only the cation's, because Na⁺ is the small, hard ion water holds
       * tightest, and two wedges going for one gap land in the same place. The
       * anion's takes the geometric test below and follows once the two shells
       * have room for both. */
      if(w.slot===WEDGE && w.ion===metal) return true;
      const seat=slotDir(w).multiplyScalar(shellR(w.ion)).add(w.ion.group.position);
      return !all().some(o=>o!==w.ion &&
        seat.distanceTo(o.group.position) < shellR(o)*0.82);
    }
    /* Where a water is trying to be. A blocked one waits OFF the stage rather
     * than hovering next to the gap it cannot get into: two waters loitering in
     * the crack, plus the seats already filled around two ions in contact,
     * crowds the opening picture badly enough that you cannot see the pair the
     * card is about. Waiting off-stage also makes getting in an ARRIVAL — pull
     * the ions apart and water comes in from outside, which is where water in a
     * beaker actually comes from.
     *
     * Square to the pair's axis, so the run in never crosses an ion: the two
     * ions have opposite outward vectors, so ONE signed rotation puts the
     * cation's waiting water below the axis and the anion's above. */
    const ZAX=new THREE.Vector3(0,0,1);
    /* Where the prying water can actually get to, which at contact is NOT its
     * seat: the seat is on the far side of the other ion. So it takes the axis
     * as far in as the midpoint, and stands off it by exactly as much as it
     * must to touch both ions and be inside neither. Every term falls away as
     * the pair opens — at full separation this returns the plain seat — so one
     * expression covers the whole move, and the water is never told where to be
     * by a stage counter. */
    function pryPoint(w){
      const ion=w.ion, u=slotDir(w);
      const other=all().find(o=>o!==ion);
      if(!other) return u.multiplyScalar(shellR(ion)).add(ion.group.position);
      const d=ion.group.position.distanceTo(other.group.position);
      const t=Math.min(shellR(ion), d*0.5);
      const b=u.clone().multiplyScalar(t).add(ion.group.position);
      let off=0;
      all().forEach(o=>{
        const need=P.radii[o.el]+P.radii.O+0.12;
        const along=b.distanceTo(o.group.position);
        if(along<need) off=Math.max(off, Math.sqrt(need*need-along*along));
      });
      if(off<1e-3) return b;
      // pushed off the axis on the side it is already coming from
      const axis=new THREE.Vector3().subVectors(other.group.position, ion.group.position).normalize();
      const perp=new THREE.Vector3().subVectors(w.group.position, b);
      perp.addScaledVector(axis, -perp.dot(axis));
      if(dim==='2d') perp.z=0;
      if(perp.lengthSq()<1e-4) perp.set(-axis.y, axis.x, 0);
      return b.addScaledVector(perp.normalize(), off);
    }

    function seatOf(w){
      if(w.slot===WEDGE && w.ion===metal) return { p:pryPoint(w), free:true };
      /* Latched wins over blocked: a water that has got in does not get
       * squeezed back out, it holds the two ions apart. */
      if(w.latched || slotFree(w))
        return { p:slotDir(w).multiplyScalar(shellR(w.ion)).add(w.ion.group.position),
                 free:true };
      /* Between the last free seat and the blocked one, and further out than
         either: a water hovering AT a seat's angle sits on top of the water
         already in it. */
      /* Spread ALONG the axis by seat, or every blocked water on an ion waits
         at the same point and the relaxation pass below shoves the pile back
         into frame from underneath. */
      return { p:outward(w.ion).applyAxisAngle(ZAX, Math.PI/2)
                 .multiplyScalar(SOLV.WAIT)
                 .addScaledVector(outward(w.ion), (w.slot-(SOLV.SEATS-1)/2)*3)
                 .add(w.ion.group.position),
               free:false };
    }
    function docked(w){ return w.k>=SOLV.DOCK; }
    // the wedges are what screen the charges; a shell parked on the far side of
    // an ion is not between anything
    function wedged(){ return waters.filter(w=>w.slot===WEDGE && w.latched).length; }
    /* ONE water in the gap is enough. It only has to hold the two apart long
     * enough that neither is in contact with the other any more, and from there
     * the rest of the shell follows on its own — which is what the student then
     * watches happen, rather than having to drag until every seat is filled. */
    function screened(){ return wedged()>=1; }
    function solvated(){ return waters.some(docked); }

    function offerWater(){
      if(poured || !done()) return;
      poured=true;
      all().forEach(ion=>{
        for(let s=0;s<SOLV.SEATS;s++) waters.push(makeWater(ion, s));
      });
      applyCel(); applyMode();
      onChange(state());
    }

    /* What the page has been told. Every visible consequence of the solvent
     * stage — the sticky, the notes, the second-stage line, the wider frame —
     * hangs off onChange, and the two things worth reporting happen a second
     * apart: water gets into the gap, and only later are the ions far enough
     * apart to call it dissolved. Reporting the first and not the second left
     * the card finishing in silence. */
    let told='';
    function stepWaters(dt){
      if(!waters.length) return;
      waters.forEach(w=>{
        const s0=seatOf(w), seat=s0.p, free=s0.free;
        /* Waters are eased onto their seat rather than sprung at it. They have
         * no momentum worth modelling — nothing here is about how a water
         * moves, only about where it ends up and how fast it gets there — and a
         * spring stiff enough to make the wedge dive in during the moment the
         * student holds the gap open overshoots it and sails out the far side.
         * The one water that has found an opening gets the quicker rate. */
        /* The prying water is the SLOWEST thing on the card, not the fastest.
         * It is the event the student is here to watch, and a water that snaps
         * into the gap in a fifth of a second reads as the page having decided
         * rather than as water working its way in. */
        const rate=free ? (w.slot===WEDGE ? 1.7 : 4) : 3;
        w.group.position.lerp(seat, 1-Math.exp(-rate*dt));
        if(dim==='2d') w.group.position.z=0;
        /* Face the ion with the end that is attracted to it: oxygen's lone
         * pairs at the cation, a hydrogen at the anion. This is the only thing
         * the shell has to say and it says it by pointing — δ− toward +, δ+
         * toward −, on every water at once. */
        const towards=new THREE.Vector3().subVectors(w.ion.group.position, w.group.position);
        if(towards.lengthSq()>1e-6){
          const localAxis=new THREE.Vector3(0, (w.ion===metal)?1:-1, 0);
          const q=new THREE.Quaternion().setFromUnitVectors(localAxis, towards.normalize());
          w.group.quaternion.slerp(q, Math.min(1, 6*dt));
        }
        const near=w.group.position.distanceTo(seat);
        if(free && near<(w.slot===WEDGE?0.7:1.5) && !w.latched){
          w.latched=true;
          if(w.slot===WEDGE && w.ion===metal) split(w);
        }
        w.k = (free||w.latched) ? Math.max(0, 1-near/1.2) : 0;
      });
      /* Nothing above stops two waters being placed in the same piece of
         space: a water waiting for room and a water on a seat are positioned by
         different rules, and around the smaller ion the seats themselves are
         close. One relaxation pass, on the same solid-nuclei principle the ions
         already obey. */
      for(let i=0;i<waters.length;i++) for(let j=i+1;j<waters.length;j++){
        const a=waters[i].group.position, b=waters[j].group.position;
        const sep=new THREE.Vector3().subVectors(b,a), d=sep.length();
        if(d>=SOLV.MIN_OO || d<1e-6) continue;
        const push=sep.multiplyScalar((SOLV.MIN_OO-d)/d*0.5);
        b.add(push); a.sub(push);
        if(dim==='2d'){ a.z=0; b.z=0; }
      }
      hbUpdate();
      /* Deliberately NOT the docked count: waters settling in cross the docked
         threshold back and forth for a second or two, and every crossing would
         re-fire the page's win line and restart its toast. What the page has to
         hear about is the two things that mean something. */
      const s=state(), now=s.screened+'|'+s.dissolved;
      if(now!==told){ told=now; onChange(s); }
    }

    /* ---- hydrogen bonds ------------------------------------------------
     * The shell is not just a ring of waters pointed at an ion: the waters
     * hold on to EACH OTHER too, and that is the half of solvation a picture
     * of arrows at an ion leaves out. kit/hbond.js decides which pairs count —
     * same distance and same linearity test water-lab runs, so a dashed line
     * here and a dashed line there mean the same measurement.
     *
     * Sites are built by hand rather than through HBond.sites(), because these
     * waters are not a spec: they are eight little groups this file placed, and
     * the module's site objects are plain data exactly so that a caller can say
     * where its atoms are without owning a molecule graph.
     *
     * The ion–water attraction is drawn TOO, and in the palette's amber rather
     * than the H-bond navy — the same amber the ion pair's own stick is drawn
     * in, which is this project's colour for "held by charge". It is a
     * different and stronger thing than a hydrogen bond, and it is the thing
     * actually holding the shell on, so leaving it undrawn makes the shell look
     * like a coincidence. Two colours rather than one word for two ideas, on
     * the card where telling them apart is the point. */
    let hb=null, idb=null;
    /* A dash runs between two SURFACES, never between two centres. Drawn centre
     * to centre it spends its first unit inside the ion and its last inside the
     * oxygen — and because the flat view draws these on top of the atoms (see
     * below), that shows as a dashed line ruled straight across both spheres.
     * Trimmed here rather than by depth-testing them, because the reason they
     * are on top in 2D is that the flat view is a stack of overlays. */
    function span(a, ra, b, rb){
      const dir=new THREE.Vector3().subVectors(b, a), d=dir.length();
      if(d<1e-6) return [a.toArray(), b.toArray()];
      dir.multiplyScalar(1/d);
      return [ a.clone().addScaledVector(dir, Math.min(ra, d*0.45)).toArray(),
               b.clone().addScaledVector(dir, -Math.min(rb, d*0.45)).toArray() ];
    }
    function hbUpdate(){
      if(!waters.length || typeof HBond==='undefined') return;
      /* Thicker than the module's default and than water-lab's: this page
       * draws its atoms two or three times the size those pages do, and a dash
       * scaled for them is a couple of pixels of navy lost against a red
       * oxygen. */
      if(!hb){ hb=HBond.create(THREE, { radius:0.10, gap:0.34 }); group.add(hb.group); }
      const lone=(dim==='2d')?WAT.loneFlat:WAT.lone;
      const donors=[], acceptors=[];
      waters.forEach(w=>{
        const o=w.group.position, q=w.group.quaternion;
        acceptors.push({ p:[o.x,o.y,o.z], owner:w, capacity:2,
                         dirs:lone.map(d=>v3(d).applyQuaternion(q).toArray()) });
        w.hs.forEach(hg=>{
          const h=hg.position.clone().applyQuaternion(q).add(o);
          donors.push({ h:h.toArray(), root:[o.x,o.y,o.z], owner:w });
        });
      });
      hb.set(HBond.find(donors, acceptors, { maxDist:SOLV.HB }).map(q=>
        span(new THREE.Vector3(...q.h), P.radii.H,
             new THREE.Vector3(...q.p), P.radii.O)));
      /* The flat view is a stack of overlays, not a scene: an H-bond drawn
       * with depth spends most of its length inside the two oxygens it runs
       * between and comes out as two stubs. So in 2D it is drawn ON TOP, under
       * the electrons (renderOrder 20 in atomkit) and over the atoms — which is
       * the same order the dots and letters are already stacked in. In 3D the
       * depth test goes back on, or bonds behind the molecule float in front. */
      /* …and the amber half: ion to the atom that is doing the touching, which
         is the oxygen on the cation and the nearer hydrogen on the anion. Drawn
         for docked waters only, so a water still on its way in is not claimed
         to be holding anything. */
      if(!idb){ idb=HBond.create(THREE,
        { radius:0.10, gap:0.34, color:P.bonds.iondipole }); group.add(idb.group); }
      const ionic=[];
      waters.forEach(w=>{
        if(!docked(w) && !w.latched) return;
        const o=w.group.position, q=w.group.quaternion;
        let end=o;
        if(w.ion!==metal){
          let best=null;
          w.hs.forEach(hg=>{
            const h=hg.position.clone().applyQuaternion(q).add(o);
            if(!best || h.distanceTo(w.ion.group.position)<best.distanceTo(w.ion.group.position))
              best=h;
          });
          end=best||o;
        }
        ionic.push(span(w.ion.group.position, P.radii[w.ion.el],
                        end, (w.ion===metal)?P.radii.O:P.radii.H));
      });
      idb.set(ionic);
      const flat=(dim==='2d');
      [hb, idb].forEach(r=>{
        r.material.depthTest=!flat;
        r.group.children.forEach(g=>g.children.forEach(m=>{ m.renderOrder=flat?15:0; }));
      });
    }

    /* The moment the pair comes apart, and the only one-time EVENT the solvent
     * stage has. The ions are given an outward kick rather than being left to
     * the spring: the spring is what holds a separation, and a bond breaking is
     * a thing that happens at an instant — water-lab pops its pair apart the
     * same way, for the same reason. The flash goes at the point the water got
     * in, because that is where the event was. */
    function split(w){
      const mid=new THREE.Vector3();
      all().forEach(a=>mid.add(a.group.position));
      mid.multiplyScalar(1/all().length);
      all().forEach(a=>{
        if(a.dragging) return;
        const d=new THREE.Vector3().subVectors(a.group.position, mid);
        if(d.lengthSq()<1e-4) return;
        a.vel.addScaledVector(d.normalize(), 6);
      });
      if(fx){
        fx.spawnRing(w.group.position.clone(), P.bonds.iondipole);
        fx.popGlow(metal.group, hex(R.metal));
        nons.forEach(a=>fx.popGlow(a.group, hex(R.nonmetal)));
      }
    }

    /* The stick goes when the wedge lands. It is the stick view's drawing of the
     * ion pair, and once there is water in the gap there is no pair left to
     * draw — the two ions are separate solutes from here on. The charges and the
     * electron counts stay exactly as they were, which is the point. */
    function dropSticks(){
      nons.forEach(a=>{ if(a.stick){ group.remove(a.stick); a.stick=null; } });
    }

    /* fill()'s counterpart for the solvent stage: a card re-opened already
     * dissolved. Waters straight onto their seats, ions at the separation the
     * shells hold them at, no drift to watch. */
    function finishReaction(){
      if(!poured || !waters.length) return;
      nons.forEach((a,i)=>{
        const ang=(nons.length>1) ? i*Math.PI : 0;
        a.group.position.set(Math.cos(ang), Math.sin(ang), 0)
          .multiplyScalar(looseRest(a)).add(metal.group.position);
        a.vel.set(0,0,0);
      });
      waters.forEach(w=>{
        const st=seatOf(w);
        w.group.position.copy(st.p); w.k=st.free?1:0;
        // latched WITHOUT calling split(): a card re-opened already dissolved is
        // not the pair coming apart again
        if(w.slot===WEDGE) w.latched=true;
      });
      stepWaters(0.016);
      dropSticks();
      onChange(state());
    }
    /* What holds the two apart now is WATER, so the distance is the two shells
     * added up — plus room for the two waters standing between them not to be
     * drawn through each other. Which is the picture: not two ions that have
     * drifted apart, two ions each holding on to their own water. */
    function looseRest(a){ return shellR(metal)+shellR(a)+SOLV.MIN_OO+0.3; }

    /* ---- dragging (same contract as water-drag: capture-phase, so the
     * shared stage's orbit handler never sees a grab) -------------------- */
    const ray=new THREE.Raycaster(), ndc=new THREE.Vector2();
    const plane=new THREE.Plane(), hit=new THREE.Vector3();
    let held=null, grabOffset=new THREE.Vector3();

    function toNdc(e){
      const r=canvas.getBoundingClientRect();
      ndc.set(((e.clientX-r.left)/r.width)*2-1, -((e.clientY-r.top)/r.height)*2+1);
    }
    function pick(e){
      toNdc(e); ray.setFromCamera(ndc, camera);
      const hits=ray.intersectObjects(all().map(a=>a.sphere), false);
      return hits.length ? hits[0].object.userData.atom : null;
    }
    function pointerOnPlane(e){
      toNdc(e); ray.setFromCamera(ndc, camera);
      return ray.ray.intersectPlane(plane, hit) ? hit.clone() : null;
    }

    const surface=canvas.parentElement||canvas;
    function onDown(e){
      const a=pick(e);
      if(!a) return;                          // let the orbit handler have it
      e.stopPropagation(); e.preventDefault();
      held=a;
      a.dragging=true; a.vel.set(0,0,0);
      const world=a.group.getWorldPosition(new THREE.Vector3());
      plane.setFromNormalAndCoplanarPoint(
        camera.getWorldDirection(new THREE.Vector3()).negate(), world);
      const p=pointerOnPlane(e);
      grabOffset.copy(p ? world.clone().sub(p) : new THREE.Vector3());
      canvas.style.cursor='grabbing';
    }
    function onMove(e){
      if(!held){
        if(!canvas.style.cursor || canvas.style.cursor==='grab' || canvas.style.cursor==='')
          canvas.style.cursor = pick(e) ? 'grab' : '';
        return;
      }
      const p=pointerOnPlane(e); if(!p) return;
      const want=group.worldToLocal(p.add(grabOffset));
      // pulling the ions apart un-does the transfer: the electron goes home, so
      // "they stick together because of the charge" is testable, not asserted.
      // Dragging the METAL away breaks every bond it is holding; dragging one
      // chloride breaks only its own.
      /* …unless it is already in water. A solvated ion pulled apart stays an
         ION — that is the entire claim of the solvent card, and putting the
         electron back would say water un-does the transfer, which is the
         mistake the card exists to correct. */
      if(solvated()){
        // nothing to undo; the ions simply move
      }else if(held===metal){
        nons.forEach(a=>{
          if(a.given && want.distanceTo(a.group.position)>REST+BREAK) unbond(a);
        });
      }else if(held.given &&
               want.distanceTo(metal.group.position)>REST+BREAK){
        unbond(held);
      }
      held.group.position.copy(want);
      stickLayout();
    }
    function onUp(){
      if(!held) return;
      held.dragging=false; held=null;
      canvas.style.cursor='';
    }
    surface.addEventListener('pointerdown', onDown, true);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);

    function destroy(){
      if(hb){ hb.dispose(); hb=null; }
      if(idb){ idb.dispose(); idb=null; }
      surface.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      root.remove(group);
      canvas.style.cursor='';
    }

    /* ---- per-frame ------------------------------------------------------ */
    function step(dt){
      dt=Math.min(dt||0.016, 0.05); t+=dt;
      kit.faceCamera(camera);   // 3D letters ride their own front surface
      const list=all();
      if(dim==='2d') list.forEach(a=>{ a.group.position.z=0; a.vel.z=0; });

      const wrap=screened();
      /* Forces are accumulated first and integrated once, because the metal now
       * takes a pull from every nonmetal — damping inside the loop would damp it
       * twice on MgCl₂ and give the two tabs different physics. */
      nons.forEach(a=>{
        const sep=new THREE.Vector3().subVectors(a.group.position, metal.group.position);
        const d=Math.max(sep.length(), 1e-4);
        const u=sep.multiplyScalar(1/d);           // metal → nonmetal
        let mag;
        if(!a.given){
          /* Before the transfer: a plain approach pull, same shape as water's.
           * Inverse-square is fine here because the two never get close enough
           * for it to blow up — the transfer fires first. */
          if(d>=S.CAPTURE) return;
          mag=S.PULL/Math.max(d*d,1);
        }else{
          /* After it: the ions HOLD a separation, so this is a spring about the
           * rest length, not an ever-tightening attraction. It has to push apart
           * as readily as it pulls together — that is what "held by charge at a
           * distance" looks like, and an inverse-square term here diverges at
           * rest and parks the pair short of the bond length. */
          /* HOLD here too, so the difference is not only in where the bond
           * gives: stretch a pair without breaking it and the stiffer one
           * snaps back faster. Same charge argument, and it is the half a
           * student meets first, since most drags do not reach BREAK. */
          /* Water in the gap changes both terms of this spring and neither of
             the charges: the pull is what is left of an attraction with two
             hydration shells in the way, and the length it settles at is set by
             those shells rather than by the ions. Nothing here puts an electron
             back — d simply grows, and Na⁺ and Cl⁻ drift off as themselves. */
          /* Capped, because a Hookean spring that keeps stiffening is the one
             thing charge attraction does NOT do — two ions pulled well apart
             attract each other less, not more. Left uncapped, a dragged ion
             tows its partner along at any distance and the gap never opens. */
          const stretch=Math.max(-1.2, Math.min(d-(wrap?looseRest(a):REST), 1.2));
          mag=S.SPRING*HOLD*(wrap?SOLV.LOOSE:1)*stretch;
        }
        if(!metal.dragging) metal.vel.addScaledVector(u,  mag*dt);
        if(!a.dragging)     a.vel.addScaledVector(u, -mag*dt);
      });

      /* Like charges repel, and on MgCl₂ that is the ONLY thing making the
       * molecule linear. Nothing here places the chlorides at 180° — the metal's
       * spring fixes how far out each one sits and leaves the angle free, and
       * two Cl⁻ pushing on each other have exactly one arrangement left. So a
       * student can drag one chloride round and watch the other swing to stay
       * opposite, which is VSEPR arrived at rather than asserted. Neutral
       * chlorines do NOT repel: there is no charge yet, and the solid-nuclei
       * push below is what keeps them out of each other meanwhile.
       *
       * The push is TANGENTIAL: the component along an ion's own bond axis is
       * projected out before it is applied, so repulsion moves each chloride
       * around the metal and never along its bond. That splits the job the way
       * the chemistry is taught — the bond sets the distance, repulsion sets the
       * angle — and it is what lets REPEL be large. Left radial, the same
       * strength would stretch Mg–Cl past Na–Cl and cost the tab its point
       * (Mg²⁺ is the SMALLER, harder-pulling ion), so the honest way to settle
       * faster is to stop the force doing a job that was never its own. */
      for(let i=0;i<nons.length;i++) for(let j=i+1;j<nons.length;j++){
        const a=nons[i], b=nons[j];
        if(!(a.given && b.given)) continue;
        const sep=new THREE.Vector3().subVectors(b.group.position, a.group.position);
        const d=Math.max(sep.length(), 0.5);
        const f=sep.multiplyScalar(1/d).multiplyScalar(S.REPEL/(d*d)*dt);
        // each ion swings on its own radius, so each gets its own projection
        function tangential(ion, vec){
          const rad=new THREE.Vector3().subVectors(ion.group.position, metal.group.position);
          if(rad.lengthSq()<1e-6) return vec;
          rad.normalize();
          return vec.clone().addScaledVector(rad, -vec.dot(rad));
        }
        if(!b.dragging) b.vel.add(tangential(b, f));
        if(!a.dragging) a.vel.sub(tangential(a, f));
      }

      list.forEach(a=>{
        if(a.dragging) return;
        a.vel.multiplyScalar(Math.pow(S.DAMP, dt*60));
        a.group.position.addScaledVector(a.vel, dt);
      });

      // solid nuclei — no ion may be pushed inside another, metal or not
      function separate(a, b, min){
        const sep=new THREE.Vector3().subVectors(b.group.position, a.group.position);
        const d=sep.length();
        if(d>=min || d<1e-6) return;
        const push=sep.multiplyScalar((min-d)/d);
        if(!b.dragging) b.group.position.add(push);
        else if(!a.dragging) a.group.position.sub(push);
      }
      nons.forEach(a=>separate(metal, a, TOUCH));
      for(let i=0;i<nons.length;i++) for(let j=i+1;j<nons.length;j++)
        separate(nons[i], nons[j], TOUCH_NN);

      /* No ion is pinned — unlike water, where the oxygen holds the origin and
       * the hydrogens come to it. So once the molecule is formed it drifts
       * wherever the last drag left it, and the camera is still looking at the
       * origin. Ease the WHOLE thing back as a unit: every separation is
       * untouched, so the bond lengths stay exactly what the physics settled on
       * and only the framing moves. */
      if(done() && !list.some(a=>a.dragging)){
        const mid=new THREE.Vector3();
        list.forEach(a=>mid.add(a.group.position));
        mid.multiplyScalar(1/list.length);
        if(mid.lengthSq()>1e-4){
          const back=mid.multiplyScalar(-Math.min(1, 1.1*dt));
          list.forEach(a=>a.group.position.add(back));
          waters.forEach(w=>w.group.position.add(back));
        }
      }
      stepWaters(dt);
      if(screened()) dropSticks();
      stickLayout();
      nons.forEach(a=>stepHop(a, dt));

      // The layout above is baked at draw time, so dragging an ion around after
      // the transfer would leave the metal-coloured electron pointing at where
      // the metal used to be. Redraw once the axis has swung far enough to notice.
      nons.forEach(a=>{
        if(!a.given || !a.lastAxis) return;
        const now=new THREE.Vector3().subVectors(metal.group.position, a.group.position);
        if(now.lengthSq()>1e-6 &&
           now.normalize().dot(a.lastAxis.clone().normalize())<0.978)   // ~12°
          drawDots(a);
      });

      // fires on approach — the electron moves as they come into contact range,
      // not once they are already sitting at the perfect distance. Per chloride:
      // on MgCl₂ the first can be bonded while the second is still across the
      // stage, and magnesium is Mg⁺ in the meantime.
      nons.forEach(a=>{
        if(a.given) return;
        if(a.group.position.distanceTo(metal.group.position) < REST+S.SNAP) transfer(a);
      });
    }

    /* ---- views ---------------------------------------------------------- */
    function applyMode(){
      const e=(mode==='electrons');
      all().forEach(a=>{
        a.dots.forEach(m=>m.visible=e);
        a.cloud.visible=e;
        // the stick is a stick-view object: in the electron view it would assert
        // a shared pair sitting in a gap that has nothing in it
        if(a.stick) a.stick.visible=!e;
      });
      /* A water's dots and its sticks follow the same rule the ions do: the
         flat view is for counting electrons, the round one for seeing shape. */
      waters.forEach(w=>{
        w.pairs.forEach(d=>d.forEach(m=>m.visible=e));
        w.lones.forEach(d=>d.forEach(m=>m.visible=e));
        w.sticks.forEach(st=>st.visible=!e);
      });
      // badges stay in BOTH modes. "Stick bonds" is where a student goes to see
      // the bond drawn, and the honest drawing of this bond is + and − with
      // nothing in between.
    }
    function setMode(m){ mode=(m==='sticks')?'sticks':'electrons'; applyMode(); }

    function applyCel(){
      kit.cel(all().map(a=>a.sphere)
        .concat(waters.map(w=>w.sphere))
        .concat(waters.flatMap(w=>w.hs.map(h=>h.children[0]))), dim==='2d');
    }
    function setDim(d){
      dim=(d==='2d')?'2d':'3d';
      kit.setDim(dim);   // letter ink, and solid vs overlay for letters and dots
      applyCel();
      all().forEach(drawDots);
      waters.forEach(layoutWaterDots);
      applyMode();
      if(dim==='2d'){
        all().forEach(a=>{ a.group.position.z=0; a.vel.z=0; });
        waters.forEach(w=>{ w.group.position.z=0; });
      }
    }

    /* The covalent fill()'s counterpart — re-open a pair the student already
     * made. The nonmetals have to be MOVED first: transfer() draws the bond
     * stick between wherever the two atoms are, and an ion still parked at its
     * start position would be handed a stick the width of the stage. Placed at
     * REST and, on MgCl₂, on opposite sides — the same arrangement the anions'
     * own repulsion arrives at, so nothing lurches once step() takes over. */
    function fill(){
      if(!metal) return;
      /* The metal comes to the middle first. It is dealt off to the LEFT, and a
       * pair assembled around it where it stands would sit against the edge of
       * the stage — during play the student drags it wherever they like, but a
       * lesson that opens finished has to open framed. */
      metal.group.position.set(0,0,0); metal.vel.set(0,0,0);
      nons.forEach((a,i)=>{
        if(a.given) return;
        const ang=(nons.length>1) ? i*Math.PI : 0;
        a.group.position.copy(metal.group.position)
          .add(new THREE.Vector3(Math.cos(ang), Math.sin(ang), 0).multiplyScalar(REST));
        a.vel.set(0,0,0);
        transfer(a, true);
      });
    }

    function state(){
      // element-neutral names: the page's KCl tab reads the same fields.
      // nonmetalCount stays a scalar — the first nonmetal — so the 1:1 tabs
      // written before MgCl₂ existed need no edit; nonmetalCounts is the list.
      return { given: done(), complete: done(),
               transfers: moved(), n: N,
               metalCount: metal?metal.count:N,
               nonmetalCount: nons[0]?nons[0].count:7,
               nonmetalCounts: nons.map(a=>a.count),
               metal:R.metal, nonmetal:R.nonmetal,
               /* the solvent stage. `wrapped` is how many ions have water in
                  the gap, which is the thing the student is working toward;
                  `dissolved` is that having actually pushed them apart. */
               poured, shell: waters.filter(docked).length,
               wrapped: wedged(), screened: screened(),
               dissolved: screened() && nons.every(a=>
                 a.group.position.distanceTo(metal.group.position) > looseRest(a)*0.8) };
    }

    function reset(){
      [...group.children].forEach(c=>group.remove(c));
      metal=null; nons=[]; held=null; waters=[]; poured=false; told='';
      if(hb){ hb.dispose(); hb=null; }
      if(idb){ idb.dispose(); idb=null; }
      kit.clear();                  // the old letters and dots go with them
      build();
      setDim(dim);
    }

    build();
    return { group, step, setMode, setDim, reset, destroy, state, fill,
             offerWater, finishReaction,
             // the solvent stage has no test bench of its own yet; this is how
             // a console reaches the shell
             _waters:()=>waters,
             /* What the pair reads as. With one nonmetal that is the CHLORIDE:
              * it is the bigger ion and the one that ends up holding the
              * electron. With two it has to be the metal — it is the atom both
              * bonds share, and centring on one chloride would hang the other
              * off the edge. */
             center:()=>{
               /* With a shell around every ion the picture is the pair, not
                  either end of it — framing on the chloride hangs sodium and
                  three waters off the left edge. */
               if(waters.length && metal){
                 /* Averaged over the WATERS too, because the two shells are not
                    the same size: chloride holds its at arm's length and sodium
                    keeps its close, so the midpoint of the two ions is not the
                    middle of the picture. */
                 const pts=all().concat(waters);
                 const mid=new THREE.Vector3();
                 pts.forEach(o=>mid.add(o.group.getWorldPosition(new THREE.Vector3())));
                 return mid.multiplyScalar(1/pts.length);
               }
               const anchor=(N>1) ? metal : (nons[0]||metal);
               return anchor ? anchor.group.getWorldPosition(new THREE.Vector3())
                             : new THREE.Vector3();
             },
             // the same place as the OBJECT, so an effect can ride the ion
             // instead of being pinned where it was when it fired (fx.js)
             anchor:()=>{ const a=(N>1)?metal:(nons[0]||metal); return a?a.group:null; },
             get mode(){return mode;}, get dim(){return dim;} };
  }

  global.IonicDrag={ create, S, RECIPES };
})(this);
