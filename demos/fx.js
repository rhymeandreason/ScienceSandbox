/* =============================================================================
 *  fx.js — transient 3D reaction/event effects, shared across simulation pages
 * =============================================================================
 *  A tiny time-based effect registry so the MOMENT something happens (a molecule
 *  forms, an ionic bond snaps, a solute settles) reads as an EVENT, not a silent
 *  swap. Every effect is purely cosmetic — nothing here feeds back into physics,
 *  H-bond counts, or any readout.
 *
 *  Usage (per page):
 *    const fx = FX.create(THREE, root, camera);   // root: the THREE.Group the
 *                                                  // molecules live in; camera:
 *                                                  // the scene camera (for billboards)
 *    fx.spawnRing(pos, color);  fx.popGlow(g, color);  …
 *    // spawnRing/spawnCore/spawnBurst take an optional trailing `follow`
 *    // Object3D. Pass it when the thing the effect fired ON can still move
 *    // (a molecule that is being dragged, an ion still settling) — see
 *    // tracker() below. Omit it and the effect stays where it was fired.
 *    // in the render loop, once per frame, before renderer.render():
 *    fx.step();
 *
 *  The colour language (documented in SCIENCE.md §5):
 *    cool blue  → water-driven step (hydration, water attacking)
 *    warm amber → acid / proton chemistry
 *    ion palette→ dissociation (each ion flares its own colour)
 *    water-blue → hydration shell closing in
 *    white core → shared white-hot instant before the coloured rings take over
 * ========================================================================== */
(function(global){
  "use strict";

  // Build a fresh effects context bound to one page's THREE / root / camera.
  // Each effect is {t,dur,update(k),cleanup?} with k easing 0→1; step() advances
  // them once per frame off a real wall-clock dt so timing is frame-rate
  // independent. Geometries are created once per context and shared by all
  // effects of that kind.
  function create(THREE, root, camera){
    const fx=[];
    let _last=performance.now();
    function step(){
      const now=performance.now(); let dt=(now-_last)/1000; _last=now;
      if(dt>0.1) dt=0.1;                                 // clamp after a tab-switch stall
      for(let i=fx.length-1;i>=0;i--){ const e=fx[i]; e.t+=dt;
        const k=Math.min(e.t/e.dur,1); e.update(k);
        if(k>=1){ if(e.cleanup) e.cleanup(); fx.splice(i,1); } }
    }

    /* ---- where an effect fires, when that place can MOVE -----------------
     * Every spawn below took a Vector3 and copied it once, which is right for a
     * reaction that happens at a fixed spot and wrong for one that happens ON
     * something the user can still drag. The completion ring was the case that
     * showed it: finish a molecule in the builder and keep dragging — a bonded
     * ligand tows the whole frame — and the molecule slides out from under its
     * own ring, leaving it expanding in empty paper.
     *
     * So a spawn may take an optional `follow` Object3D. The OFFSET between the
     * fire point and that object is locked at spawn and re-applied every frame,
     * which keeps effects that fire at a specific spot on a molecule (the
     * electron landing on a chloride, say) riding that spot rather than the
     * centre.
     *
     * Deliberately not solved by parenting the meshes to the molecule's group:
     * they would inherit its scale, and popGlow punches that to 1.7× on exactly
     * the frames the ring is alive — the ring would pulse with it.
     */
    function tracker(pos, follow){
      const fixed=(pos||new THREE.Vector3()).clone();
      if(!follow) return ()=>fixed;
      const out=fixed.clone(), tmp=new THREE.Vector3();
      const off=fixed.clone().sub(follow.getWorldPosition(tmp));
      return ()=>{
        /* Switching tabs destroys a sim while its effects are still in flight.
         * An anchor that is off the graph has no meaningful world position — it
         * would report its bare local one — so hold the last good point and let
         * the effect finish where it was rather than teleport it. */
        if(follow.parent) out.copy(follow.getWorldPosition(tmp)).add(off);
        return out;
      };
    }

    // bright soft core flash at a point — the white-hot instant of the event.
    const _coreGeo=new THREE.CircleGeometry(1,40);
    function spawnCore(pos,color,follow,size=1){
      const m=new THREE.Mesh(_coreGeo,new THREE.MeshBasicMaterial(
        {color,transparent:true,opacity:1,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}));
      const at=tracker(pos,follow);
      m.position.copy(at()); m.renderOrder=12; root.add(m);
      fx.push({t:0,dur:0.34,update(k){
        m.position.copy(at());
        m.scale.setScalar((0.4+k*2.4)*size);
        m.material.opacity=(1-k)*(1-k);
        m.quaternion.copy(camera.quaternion);
      },cleanup(){ root.remove(m); m.material.dispose(); }});
    }

    // a spray of little glowing sparks flying outward — the "energy released" debris.
    const _sparkGeo=new THREE.SphereGeometry(0.12,8,6);
    function spawnBurst(pos,color,n=14,follow,size=1){
      const at=tracker(pos,follow);
      for(let i=0;i<n;i++){
        const m=new THREE.Mesh(_sparkGeo,new THREE.MeshBasicMaterial(
          {color,transparent:true,opacity:1,blending:THREE.AdditiveBlending,depthWrite:false}));
        m.position.copy(at()); m.renderOrder=11; root.add(m);
        // random direction on a sphere, varied speed
        const dir=new THREE.Vector3(Math.random()-.5,Math.random()-.5,Math.random()-.5)
          .normalize().multiplyScalar((2.6+Math.random()*2.4)*size);
        const dur=0.5+Math.random()*0.35;
        fx.push({t:0,dur,update(k){
          m.position.copy(at()).addScaledVector(dir,k*(2-k));  // ease-out flight
          m.scale.setScalar((1-k*0.7)*size);
          m.material.opacity=(1-k);
        },cleanup(){ root.remove(m); m.material.dispose(); }});
      }
    }

    // expanding shockwave ring at a point — the "energy released" beat: a double
    // ring + core flash + spark burst so the moment really lands. Billboarded to
    // the camera each frame so it always reads as a flat disc facing the viewer.
    const _ringGeo=new THREE.RingGeometry(0.60,0.86,56);
    function _ring(pos,color,delay,scale,dur,follow,size=1){
      const m=new THREE.Mesh(_ringGeo,new THREE.MeshBasicMaterial(
        {color,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}));
      const at=tracker(pos,follow);
      m.position.copy(at()); m.renderOrder=10; root.add(m);
      fx.push({t:0,dur:dur+delay,update(k){
        const kk=Math.max(0,Math.min((k*(dur+delay)-delay)/dur,1));
        m.position.copy(at());
        m.scale.setScalar((0.4+kk*scale)*size);
        m.material.opacity=1.0*(1-kk)*(1-kk)*(kk>0?1:0);
        m.quaternion.copy(camera.quaternion);
      },cleanup(){ root.remove(m); m.material.dispose(); }});
    }
    /* `follow` is optional and every caller that omits it behaves exactly as
     * before. Pass the molecule's anchor Object3D on any page where the thing
     * that just completed can still be dragged.
     *
     * `size` is a plain multiplier on the whole effect, default 1, and it
     * exists because THESE RADII ARE IN ANGSTROMS. The ring was tuned on the
     * solvation pages, where the event is one bond between two atoms a few
     * angstroms apart; on hemoglobin-lab the same ring marks a bond on a
     * 65 A molecule and reads as a spark. Scale it at the CALL, per page —
     * a shared default that drifts to suit the biggest subject would shrink
     * the effect on every page that was right already. */
    function spawnRing(pos,color,follow,size=1){
      spawnCore(pos,0xffffff,follow,size);
      _ring(pos,color,0,   5.4,0.75,follow,size);   // fast leading ring
      _ring(pos,color,0.12,4.0,0.85,follow,size);   // trailing echo
      spawnBurst(pos,color,16,follow,size);
    }

    // pop a freshly-formed molecule: strong scale overshoot + emissive flash on
    // its atoms that decays back to normal. Atom materials are per-atom, so
    // lighting one molecule never touches another; shared bond/outline materials
    // are skipped (no emissive, or role 'covalent').
    function popGlow(g,color){
      const parts=[];
      g.traverse(o=>{ if(o.isMesh && o.material && o.material.emissive
            && o.userData.role && o.userData.role!=='covalent'){
        parts.push({m:o.material, e0:o.material.emissiveIntensity, c0:o.material.emissive.getHex()});
        o.material.emissive.setHex(color); } });
      // scale RELATIVE to whatever g already is: a molecule Group rests at 1, but
      // a bare ion mesh rests at its radius — never assume 1 or we'd resize the ion.
      const base=g.scale.x||1;
      fx.push({t:0,dur:1.1,update(k){
        const e=1-k;
        // springy overshoot: a quick punch out then a small wobble back
        g.scale.setScalar(base*(1+0.7*e*e*(1+0.25*Math.sin(k*18))));
        parts.forEach(p=>{ p.m.emissiveIntensity=2.2*e; });
      },cleanup(){ g.scale.setScalar(base);
        parts.forEach(p=>{ p.m.emissiveIntensity=p.e0; p.m.emissive.setHex(p.c0); }); }});
    }

    // a glowing proton flying from an acid to the water it protonates — the actual
    // H⁺ transfer of an ionization step. Bigger, additively-lit, with a comet
    // trail of fading echoes. Fires onArrive when it lands.
    const _protonGeo=new THREE.SphereGeometry(0.34,16,12);
    function protonHop(from,to,onArrive){
      const m=new THREE.Mesh(_protonGeo,new THREE.MeshBasicMaterial(
        {color:0xffe08a,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));
      m.position.copy(from); m.renderOrder=13; root.add(m);
      let lastTrail=0;
      const pos=new THREE.Vector3();
      fx.push({t:0,dur:0.5,update(k){
        pos.lerpVectors(from,to,k); pos.y+=1.3*Math.sin(k*Math.PI);   // arc
        m.position.copy(pos);
        m.scale.setScalar(1.1+0.6*Math.sin(k*Math.PI));
        // shed a fading trail dot every so often
        if(k-lastTrail>0.06 && k<0.95){ lastTrail=k;
          const t=new THREE.Mesh(_sparkGeo,new THREE.MeshBasicMaterial(
            {color:0xffcf6b,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));
          t.position.copy(pos); t.scale.setScalar(1.6); root.add(t);
          fx.push({t:0,dur:0.3,update(kk){ t.scale.setScalar(1.6*(1-kk)); t.material.opacity=1-kk; },
            cleanup(){ root.remove(t); t.material.dispose(); }});
        }
      },cleanup(){ root.remove(m); m.material.dispose(); if(onArrive) onArrive(); }});
    }

    // pick a representative colour off a molecule group (its first coloured atom)
    // so an effect can be tinted to whatever it's decorating without hard-coding.
    function colorOf(g){ let c=null;
      g.traverse(o=>{ if(c===null && o.isMesh && o.material && o.material.color
          && o.userData.role && o.userData.role!=='covalent') c=o.material.color.getHex(); });
      return c==null?0xffffff:c; }

    // gentle cousin of popGlow for a NON-reaction beat (a solute settling into its
    // hydration shell): a soft emissive breathe in-and-out, no scale punch, no ring
    // or sparks — enough to notice, not enough to imply a reaction happened.
    function settleShimmer(g,color){
      const parts=[];
      g.traverse(o=>{ if(o.isMesh && o.material && o.material.emissive
            && o.userData.role && o.userData.role!=='covalent'){
        parts.push({m:o.material, e0:o.material.emissiveIntensity, c0:o.material.emissive.getHex()});
        o.material.emissive.setHex(color); } });
      fx.push({t:0,dur:1.1,update(k){
        parts.forEach(p=>{ p.m.emissiveIntensity=0.8*Math.sin(k*Math.PI); });   // fade up then down
      },cleanup(){ parts.forEach(p=>{ p.m.emissiveIntensity=p.e0; p.m.emissive.setHex(p.c0); }); }});
    }

    return { step, spawnRing, spawnCore, spawnBurst, popGlow, protonHop, colorOf, settleShimmer, _fx:fx };
  }

  global.FX = { create };
})(this);
