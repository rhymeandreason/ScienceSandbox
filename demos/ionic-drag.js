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
 * ========================================================================== */
(function(global){
  'use strict';

  const S = {
    CAPTURE: 4.2,             // ionic attraction reaches further than a slot does
    SNAP: 0.5,
    BREAK: 1.6,
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
   */
  const RECIPES = {
    nacl:  { metal:'Na', nonmetal:'Cl', bond:2.55, n:1 },
    kcl:   { metal:'K',  nonmetal:'Cl', bond:2.70, n:1 },
    mgcl2: { metal:'Mg', nonmetal:'Cl', bond:2.35, n:2 },
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

  function create(opts){
    const THREE=opts.THREE, root=opts.root, camera=opts.camera,
          canvas=opts.canvas, fx=opts.fx||null,
          onChange=opts.onChange||function(){};
    const P=global.MolLib.PALETTE;
    const kit=AtomKit.create(THREE);
    const R=RECIPES[opts.recipe||'nacl'];
    const REST=R.bond;
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
    function transfer(a){
      a.given=true;
      // Counts change NOW, not when the flight lands: the callback only runs
      // while the frame loop does, so a backgrounded tab would otherwise leave
      // the readout stale. The flight is animation over already-correct state,
      // and during it the eighth electron is simply the one in transit.
      metal.count=N-moved();
      a.count=7;
      drawDots(metal); drawDots(a);
      startHop(a);

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
        if(fx){
          fx.spawnCore(at, 0xffffff);
          fx.spawnBurst(at, P.atoms[R.nonmetal], 14);
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
      if(held===metal){
        nons.forEach(a=>{
          if(a.given && want.distanceTo(a.group.position)>REST+S.BREAK) unbond(a);
        });
      }else if(held.given &&
               want.distanceTo(metal.group.position)>REST+S.BREAK){
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
          mag=S.SPRING*(d-REST);
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
        }
      }
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
      // badges stay in BOTH modes. "Stick bonds" is where a student goes to see
      // the bond drawn, and the honest drawing of this bond is + and − with
      // nothing in between.
    }
    function setMode(m){ mode=(m==='sticks')?'sticks':'electrons'; applyMode(); }

    function applyCel(){
      kit.cel(all().map(a=>a.sphere), dim==='2d');
    }
    function setDim(d){
      dim=(d==='2d')?'2d':'3d';
      kit.setDim(dim);   // letter ink, and solid vs overlay for letters and dots
      applyCel();
      all().forEach(drawDots);
      if(dim==='2d') all().forEach(a=>{ a.group.position.z=0; a.vel.z=0; });
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
               metal:R.metal, nonmetal:R.nonmetal };
    }

    function reset(){
      [...group.children].forEach(c=>group.remove(c));
      metal=null; nons=[]; held=null;
      kit.clear();                  // the old letters and dots go with them
      build();
      setDim(dim);
    }

    build();
    return { group, step, setMode, setDim, reset, destroy, state,
             /* What the pair reads as. With one nonmetal that is the CHLORIDE:
              * it is the bigger ion and the one that ends up holding the
              * electron. With two it has to be the metal — it is the atom both
              * bonds share, and centring on one chloride would hang the other
              * off the edge. */
             center:()=>{
               const anchor=(N>1) ? metal : (nons[0]||metal);
               return anchor ? anchor.group.getWorldPosition(new THREE.Vector3())
                             : new THREE.Vector3();
             },
             get mode(){return mode;}, get dim(){return dim;} };
  }

  global.IonicDrag={ create, S, RECIPES };
})(this);
