/* =============================================================================
 *  kit/hotspot.js — click the bond this step is about
 * =============================================================================
 *  The interaction every mechanism lesson needs: a target sitting ON the
 *  chemistry, not beside it. A button in the panel says "run the step"; a
 *  hotspot on the bond says WHICH BOND, and the student's own click is what
 *  makes it break. glycolysis-lab proved it, and the reasons it works are all
 *  small and all easy to lose:
 *
 *   · DRIVEN EVERY FRAME. The camera eases and the molecule turns, so a target
 *     that does not follow is one you miss. It rides the same schedule as a
 *     name plate — AFTER the render (kit/stagekit.js's `afterFrame`), or it is
 *     pinned to the previous frame's camera.
 *   · ELEMENTS ARE REUSED, never rebuilt. Recreating the node each frame
 *     restarts its CSS pulse 60 times a second, which renders as a dead ring.
 *   · NO SUCH BOND MEANS NO TARGET — never a target at the origin. A null
 *     silently placed at (0,0,0) is a clickable spot floating in the middle of
 *     the scene, and it is clickable, so the student finds it.
 *   · ONE HINT, beside the first target STILL STANDING. Two hints shout; a hint
 *     pinned to the first lane leaves the second unlabelled once the first has
 *     run.
 *   · THE GLOW IS A SEPARATE LAYER from the button. They sit at different
 *     z-indices — the pulse belongs under the molecule's own chrome, the
 *     click target above it — so they cannot be one element.
 *
 *  The page owns everything about MEANING: which bond, what the hint says, what
 *  a click does. This owns position, lifecycle and reuse.
 *
 *  Loaded after scene.js. Exposes window.Hotspot.
 *
 *  Usage — from `afterFrame`, every frame, with the whole current list:
 *    SPOTS.update(lanes.map((l,i)=>({
 *      group:l.g, pair:bondFor(l), hint:step.say, label:step.act, lane:i
 *    })));
 *  An item whose `pair` is null is skipped (see above); pass `null` for a lane
 *  that has already run. `update([])` retires every target.
 * ========================================================================== */
(function(global){
  'use strict';
  const THREE=global.THREE;

  function create(opts){
    const canvas=opts.canvas, camera=opts.camera;
    const host=opts.host, glowHost=opts.glowHost||null;
    const cls=opts.className||'spot';
    const glowCls=opts.glowClass||'sglow';
    const hintSel=opts.hintClass?('.'+opts.hintClass):'.shint';
    const hintCls=opts.hintClass||'shint';
    const onPick=opts.onPick||(()=>{});

    const v=new THREE.Vector3();
    const buttons=[], glows=[];
    // The item each button currently stands for, so the click handler reads the
    // CURRENT target rather than one captured when the node was made.
    let live=[];

    function grow(n){
      while(buttons.length<n){
        const i=buttons.length;
        const b=document.createElement('button');
        b.className=cls; b.type='button';
        b.innerHTML=`<span class="${hintCls}"></span>`;
        b.onclick=()=>{ const it=live[i]; if(it) onPick(it, i); };
        host.appendChild(b); buttons.push(b);
        if(glowHost){ const g=document.createElement('div');
          g.className=glowCls; glowHost.appendChild(g); glows.push(g); }
      }
    }
    const show=(el,on)=>{ if(el) el.style.display = on ? '' : 'none'; };

    /* Where a target sits, in world space:
     *   pair + group   the midpoint of a bond, off the BUILT molecule (so the
     *                  spec's `view` and the lane's own position are already in
     *                  it) — the common case
     *   world          an explicit Vector3, for a target that is not a bond */
    function pointOf(it){
      if(it.world) return v.copy(it.world);
      if(!it.pair || !it.group) return null;
      const u=it.group.userData;
      if(!u||!u.atomWorld) return null;
      const a=u.atomWorld(it.pair[0]), b=u.atomWorld(it.pair[1]);
      if(!a||!b) return null;
      return v.copy(a).add(b).multiplyScalar(0.5);
    }

    function update(items){
      const list=(items||[]);
      live=list;
      grow(list.length);
      const w=canvas.clientWidth, h=canvas.clientHeight;
      let hinted=false;
      buttons.forEach((el,i)=>{
        const it=list[i], gl=glows[i];
        const p=it?pointOf(it):null;
        if(!p){ show(el,false); show(gl,false); return; }   // no bond, no target
        show(el,true); show(gl,true);
        p.project(camera);
        const x=(p.x*0.5+0.5)*w, y=(-p.y*0.5+0.5)*h;
        el.style.left=x+'px'; el.style.top=y+'px';
        if(gl){ gl.style.left=x+'px'; gl.style.top=y+'px'; }
        // ONE HINT, on the first target still standing — see the header.
        const hintEl=el.querySelector(hintSel);
        if(hintEl) hintEl.textContent = hinted ? '' : (it.hint||'');
        hinted=true;
        if(it.label!=null) el.setAttribute('aria-label', it.label);
      });
    }

    const clear=()=>update([]);

    return { update, clear, get buttons(){ return buttons; } };
  }

  global.Hotspot={create};
})(this);
