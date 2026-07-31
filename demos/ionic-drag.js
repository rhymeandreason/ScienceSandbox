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
 *  shows its single loose electron, the nonmetal shows seven (one short of
 *  full), and after the transfer you can count 0 and 8.
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
  };

  /* Separations are roomier than any covalent bond in the project (O–H is 1.55
   * against radii summing to 1.50): Na 0.70 + Cl 1.24 = 1.94 against 2.55. The
   * gap is deliberate — nothing is shared across it, and the eye should read a
   * space between two ions rather than a join. Potassium is the bigger atom and
   * gets the longer bond, straight from molecules.js.
   */
  const RECIPES = {
    nacl: { metal:'Na', nonmetal:'Cl', bond:2.55 },
    kcl:  { metal:'K',  nonmetal:'Cl', bond:2.70 },
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
    const TOUCH=(P.radii[R.metal]+P.radii[R.nonmetal])*1.06;   // solid nuclei

    const group=new THREE.Group(); root.add(group);
    let mode='electrons', dim='3d';
    let na=null, cl=null, stick=null, badges=[], hop=null;
    let given=false;          // has the electron moved?
    let lastAxis=null;        // Na→Cl direction the dot layout was drawn for
    let t=0;

    function v3(a){ return new THREE.Vector3(a[0],a[1],a[2]); }

    /* ---- an ion's electrons -------------------------------------------
     * Redrawn whenever the count changes, because the count IS the lesson: 1 → 0
     * on sodium and 7 → 8 on chlorine, countable at every step. Pairs sit
     * together and the odd one stands alone, so "one short of full" is visible
     * on chlorine before anything happens. */
    function clearDots(atom){
      atom.dots.forEach(d=>atom.group.remove(d)); atom.dots=[];
    }
    function drawDots(atom){
      clearDots(atom);
      let dirs=(dim==='2d')?DIRS_2D:DIRS_3D;
      /* Chlorine's electrons are laid out last-direction-last, and the electron
       * it was handed is the last one — so spin the whole layout until that
       * direction faces sodium. The newcomer then lands where it arrived from
       * rather than somewhere around the back, which is what makes the flight
       * and the final arrangement agree. (In 2D the ordering already lands it
       * there; in 3D it was ending up behind the ion.) */
      if(atom===cl && given){
        const toNa=new THREE.Vector3().subVectors(na.group.position, cl.group.position);
        if(toNa.lengthSq()>1e-6){
          const q=new THREE.Quaternion().setFromUnitVectors(
            v3(dirs[dirs.length-1]).normalize(), toNa.normalize());
          dirs=dirs.map(d=>v3(d).normalize().applyQuaternion(q).toArray());
          lastAxis=toNa.clone();
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
      return { el, group:g, sphere, cloud:cl2, label:tag, count, dots:[],
               vel:new THREE.Vector3(), dragging:false };
    }

    function build(){
      // the metal on the left with its one loose electron, the nonmetal on the
      // right with seven — the asymmetry the student is meant to notice first
      na=makeAtom(R.metal, new THREE.Vector3(-4.6,0.6,0), 1);
      cl=makeAtom(R.nonmetal, new THREE.Vector3(4.4,-0.4,0), 7);
      drawDots(na); drawDots(cl);
      applyCel(); applyMode();
      onChange(state());
    }

    /* ---- the transfer --------------------------------------------------
     * The electron itself makes the trip: sodium's one dot detaches, flies the
     * gap, and lands on chlorine having turned from violet to GREEN. The colour
     * change is the point — an electron wears its owner's colour everywhere in
     * this project (atomkit.js), so changing colour mid-flight is the same
     * sentence as "it changed owner". Nothing about it is shared or returned:
     * chlorine's eight are eight green electrons afterwards, indistinguishable,
     * which is exactly the chemistry.
     */
    function transfer(){
      given=true;
      // Counts change NOW, not when the flight lands: the callback only runs
      // while the frame loop does, so a backgrounded tab would otherwise leave
      // the readout stale. The flight is animation over already-correct state,
      // and during it the eighth electron is simply the one in transit.
      na.count=0; cl.count=7;
      drawDots(na); drawDots(cl);
      startHop();

      badges=[ kit.charge('+', '#'+new THREE.Color(P.atoms[R.metal]).getHexString(), R.metal),
               kit.charge('−', '#'+new THREE.Color(P.atoms[R.nonmetal]).getHexString(), R.nonmetal) ];
      na.group.add(badges[0]); cl.group.add(badges[1]);

      /* The stick is a STICK-VIEW object only. In the electron view drawing a
       * cylinder would contradict the lesson — there is no shared pair in that
       * gap, only two charges — but stick view is the schematic the rest of the
       * project speaks (water-lab draws its ion pairs this way), and a student
       * who switches to it to see "the bond" should find one. It is amber, the
       * palette's ion colour, so it never reads as a covalent stick. */
      stick=Stage.bond(na.group.position, cl.group.position,
                       P.bonds.iondipole, 0.10, 1);
      group.add(stick);
      applyCel(); applyMode();
      onChange(state());
    }

    /* the flight: sodium's own dot, re-parented to the pair and animated across */
    function startHop(){
      const from=na.group.position.clone();
      const m=kit.dot(P.atoms[R.metal]);
      m.position.copy(from);
      group.add(m);
      hop={ m, from, k:0,
            c0:new THREE.Color(P.atoms[R.metal]), c1:new THREE.Color(P.atoms[R.nonmetal]) };
    }
    // where the newcomer is headed: chlorine's surface on the side facing sodium
    function hopTarget(){
      const dir=new THREE.Vector3().subVectors(na.group.position, cl.group.position);
      if(dir.lengthSq()<1e-6) dir.set(-1,0,0);
      return cl.group.position.clone()
        .addScaledVector(dir.normalize(), P.radii[R.nonmetal]+kit.DOT_GAP);
    }
    function stepHop(dt){
      if(!hop) return;
      hop.k=Math.min(1, hop.k+dt/S.HOP);
      const to=hopTarget();
      hop.m.position.lerpVectors(hop.from, to, hop.k);
      hop.m.position.y += 0.9*Math.sin(hop.k*Math.PI);          // a small arc
      hop.m.material.color.copy(hop.c0).lerp(hop.c1, hop.k);    // violet → green
      if(hop.k>=1){
        const at=hop.m.position.clone();
        group.remove(hop.m); hop=null;
        cl.count=8; drawDots(cl);                                // it has arrived
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
      if(!stick) return;
      const a=na.group.position, b=cl.group.position;
      const dir=new THREE.Vector3().subVectors(b,a), len=dir.length();
      stick.position.copy(a).addScaledVector(dir, 0.5);
      stick.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), dir.clone().normalize());
      stick.scale.set(1, len/(stick.userData.len||len), 1);
      if(!stick.userData.len) stick.userData.len=len;
    }
    function unbond(){
      given=false;
      na.count=1; cl.count=7;
      drawDots(na); drawDots(cl);
      if(stick){ group.remove(stick); stick=null; }
      if(hop){ group.remove(hop.m); hop=null; }
      badges.forEach(s=>s.parent&&s.parent.remove(s)); badges=[];
      onChange(state());
    }

    /* ---- dragging (same contract as water-drag: capture-phase, so the
     * shared stage's orbit handler never sees a grab) -------------------- */
    const ray=new THREE.Raycaster(), ndc=new THREE.Vector2();
    const plane=new THREE.Plane(), hit=new THREE.Vector3();
    let held=null, other=null, grabOffset=new THREE.Vector3();

    function toNdc(e){
      const r=canvas.getBoundingClientRect();
      ndc.set(((e.clientX-r.left)/r.width)*2-1, -((e.clientY-r.top)/r.height)*2+1);
    }
    function pick(e){
      toNdc(e); ray.setFromCamera(ndc, camera);
      const hits=ray.intersectObjects([na.sphere, cl.sphere], false);
      if(!hits.length) return null;
      return hits[0].object===na.sphere ? na : cl;
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
      held=a; other=(a===na)?cl:na;
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
      // "they stick together because of the charge" is testable, not asserted
      if(given && want.distanceTo(other.group.position)>REST+S.BREAK) unbond();
      held.group.position.copy(want);
      stickLayout();
    }
    function onUp(){
      if(!held) return;
      held.dragging=false; held=null; other=null;
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
      const pair=[na,cl];
      if(dim==='2d') pair.forEach(a=>{ a.group.position.z=0; a.vel.z=0; });

      // the two ions attract EACH OTHER, so whichever is loose moves; once the
      // charges exist the pull is stronger, which is the point of the lesson
      const sep=new THREE.Vector3().subVectors(cl.group.position, na.group.position);
      const d=sep.length();
      const rest=REST;
      pair.forEach(a=>{
        if(a.dragging) return;
        const toward=(a===na?1:-1);                     // +1 pulls Na toward Cl
        const dir=sep.clone().normalize().multiplyScalar(toward);
        if(!given){
          /* Before the transfer: a plain approach pull, same shape as water's.
           * Inverse-square is fine here because the two never get close enough
           * for it to blow up — the transfer fires first. */
          if(d<S.CAPTURE) a.vel.addScaledVector(dir, (S.PULL/Math.max(d*d,1))*dt);
        }else{
          /* After it: the ions HOLD a separation, so this is a spring about the
           * rest length, not an ever-tightening attraction. It has to push apart
           * as readily as it pulls together — that is what "held by charge at a
           * distance" looks like, and an inverse-square term here diverges at
           * rest and parks the pair short of the bond length. */
          a.vel.addScaledVector(dir, S.SPRING*(d-rest)*dt);
        }
        a.vel.multiplyScalar(Math.pow(S.DAMP, dt*60));
        a.group.position.addScaledVector(a.vel, dt);
      });

      // solid nuclei — neither ion may be pushed inside the other
      const now=new THREE.Vector3().subVectors(cl.group.position, na.group.position);
      if(now.length()<TOUCH){
        const push=now.clone().normalize().multiplyScalar((TOUCH-now.length()));
        if(!cl.dragging) cl.group.position.add(push);
        else na.group.position.sub(push);
      }
      /* Neither ion is pinned — unlike water, where the oxygen holds the origin
       * and the hydrogens come to it. So once the pair is formed it drifts
       * wherever the last drag left it, and the camera is still looking at the
       * origin. Ease the PAIR back as a unit: separation is untouched, so the
       * bond length stays exactly what the physics settled on and only the
       * framing moves. */
      if(given && !na.dragging && !cl.dragging){
        const mid=new THREE.Vector3().addVectors(na.group.position, cl.group.position)
          .multiplyScalar(0.5);
        if(mid.lengthSq()>1e-4){
          const back=mid.multiplyScalar(-Math.min(1, 1.1*dt));
          na.group.position.add(back); cl.group.position.add(back);
        }
      }
      stickLayout();
      stepHop(dt);

      // The layout above is baked at draw time, so dragging an ion around after
      // the transfer would leave the violet electron pointing at where sodium
      // used to be. Redraw once the axis has swung far enough to notice.
      if(given && lastAxis){
        const now2=new THREE.Vector3().subVectors(na.group.position, cl.group.position);
        if(now2.lengthSq()>1e-6 &&
           now2.normalize().dot(lastAxis.clone().normalize())<0.978)   // ~12°
          drawDots(cl);
      }

      // fires on approach — the electron moves as they come into contact range,
      // not once they are already sitting at the perfect distance
      if(!given && now.length()<rest+S.SNAP) transfer();
    }

    /* ---- views ---------------------------------------------------------- */
    function applyMode(){
      const e=(mode==='electrons');
      [na,cl].forEach(a=>{ if(!a) return;
        a.dots.forEach(m=>m.visible=e);
        a.cloud.visible=e;
      });
      // the stick is a stick-view object: in the electron view it would assert a
      // shared pair sitting in a gap that has nothing in it
      if(stick) stick.visible=!e;
      // badges stay in BOTH modes. "Stick bonds" is where a student goes to see
      // the bond drawn, and the honest drawing of this bond is + and − with
      // nothing in between.
    }
    function setMode(m){ mode=(m==='sticks')?'sticks':'electrons'; applyMode(); }

    function applyCel(){
      const on=(dim==='2d');
      kit.cel([na&&na.sphere, cl&&cl.sphere], on);
    }
    function setDim(d){
      dim=(d==='2d')?'2d':'3d';
      [na,cl].forEach(a=>{ if(a) a.label.setDim(dim); });
      applyCel();
      if(na) drawDots(na);
      if(cl) drawDots(cl);
      if(dim==='2d') [na,cl].forEach(a=>{ a.group.position.z=0; a.vel.z=0; });
    }

    function state(){
      // element-neutral names: the page's KCl tab reads the same fields
      return { given, complete:given,
               metalCount:na?na.count:1, nonmetalCount:cl?cl.count:7,
               metal:R.metal, nonmetal:R.nonmetal };
    }

    function reset(){
      [...group.children].forEach(c=>group.remove(c));
      na=cl=null; stick=null; badges=[]; hop=null; given=false; held=null;
      build();
      setDim(dim);
    }

    build();
    return { group, step, setMode, setDim, reset, destroy, state,
             // the chloride is the anchor: it is the bigger ion and the one that
             // ends up holding the electron, so it is what the pair reads as
             center:()=>cl ? cl.group.getWorldPosition(new THREE.Vector3())
                           : new THREE.Vector3(),
             get mode(){return mode;}, get dim(){return dim;} };
  }

  global.IonicDrag={ create, S, RECIPES };
})(this);
