/* =============================================================================
 *  kit/fit.js — the stage is not an empty rectangle
 * =============================================================================
 *  A lesson's canvas has chrome on all four edges: species labels along the top,
 *  a bottom bar, a reagent tray down one side, a caption that comes and goes.
 *  A molecule fitted to the raw canvas is fitted to spoken-for space, and lands
 *  under the caption.
 *
 *  glycolysis-lab.html solved this properly and paid five functions for it
 *  (`usable`, `barReservePx`, `capReservePx`, `trayReservePx`, `orthoFrustum`)
 *  plus a top-anchor. All of that except WHICH ELEMENTS TO MEASURE is the same
 *  on every lesson that has chrome, so this file is that, and the page keeps the
 *  measuring — it is the only part that knows its own stylesheet.
 *
 *  It owns no camera policy either: `solve()` returns a distance and a target,
 *  the page decides what to do with them (glycolysis eases toward both). What it
 *  does own is the arithmetic that is easy to get subtly wrong — and each of
 *  these was got wrong once here before it was got right:
 *
 *    · a reserve is paid ONCE, on the edge it is on. Insetting both edges for
 *      one obstructed edge double-charges and shrinks the scene to a speck.
 *    · the leftover band's centre is HALF the difference of the two reserves.
 *      The whole difference moves the subject twice as far as the band, which
 *      reads as "floating high".
 *    · a horizontal reserve is paid SYMMETRICALLY even though the tray sits on
 *      one side, because the subject belongs on the centre line. Sliding the
 *      frustum instead means anything added at an edge moves the molecule.
 *    · reserves are read from the STYLESHEET (declared height), not from the
 *      live box, or a longer caption re-frames the scene and every state is
 *      composed differently.
 *    · every field is returned even on the no-size path. A ResizeObserver fires
 *      during layout, and one missing field reaches the fit as NaN — which a
 *      camera ease then carries forever, leaving a blank stage.
 *
 *  Loaded after scene.js. Exposes window.Fit. No dependency on Stage or Lesson;
 *  a page can use it with a bare camera.
 * ========================================================================== */
(function(global){
  'use strict';

  // A perspective camera at distance r sees this much world half-height. It is
  // also how an ORTHOGRAPHIC page keeps `cam.r` meaningful: give the frustum the
  // half-height a perspective camera would show at r and every number
  // downstream — the solved R, the camera ease, the wheel clamp, the target
  // shift — keeps its meaning verbatim.
  const HALF_FOV=Math.tan(22.5*Math.PI/180);
  // aspect is NaN until the first ResizeObserver tick; never trust it blindly
  const ASPECT_FALLBACK=1.26;

  function create(opts={}){
    const canvas=opts.canvas, camera=opts.camera, cam=opts.cam;
    const halfFov=opts.halfFov||HALF_FOV;
    // () => {top,bottom,left,right} in CSS PIXELS. The page's job: it is the
    // only thing that knows which of its elements are over the canvas.
    let reserve=opts.reserve||(()=>({}));
    // How much of the canvas the reserves may eat before they are scaled back
    // together. Without it a tall caption on a short viewport leaves no stage.
    const VCAP=opts.vcap!=null?opts.vcap:0.6;
    const HCAP=opts.hcap!=null?opts.hcap:0.30;

    const aspect=()=>isFinite(camera.aspect)&&camera.aspect>0?camera.aspect:ASPECT_FALLBACK;

    /* What is left of the canvas, as fractions.
     *   v, h    leftover vertical / horizontal fraction
     *   shift   how far to DROP the camera target so the subject centres in the
     *           band that is left (world units come from R*halfFov)
     *   tf, bf  the reserves themselves as fractions — an anchor needs the EDGE,
     *           not the leftover's centre */
    function usable(){
      const c=canvas.getBoundingClientRect();
      if(!c.height||!c.width) return {v:1,h:1,shift:0,tf:0,bf:0};
      const r=reserve()||{};
      const top=r.top||0, bottom=r.bottom||0;
      const side=Math.max(r.left||0, r.right||0);
      const left=Math.min(side, c.width*HCAP);
      const vcap=c.height*VCAP;
      const k=(top+bottom)>vcap ? vcap/(top+bottom) : 1;
      const t=top*k, b=bottom*k;
      return { v:Math.max(0.4, (c.height-t-b)/c.height),
               h:Math.max(0.28, (c.width-2*left)/c.width),
               shift:(b-t)/(2*c.height),
               tf:t/c.height, bf:b/c.height };
    }

    /* How far back, and where to look.
     *   halfNeeded  half-height the content needs, about its own centre
     *   wide        half-width ditto
     *   centerY     that centre, in world Y
     * Solved per AXIS against the leftover fractions — a row of molecules is far
     * wider than it is tall, and the tighter axis wins. */
    function solve({halfNeeded, wide, centerY=0, pad=1.10, min=15, max=90}){
      const u=usable(), asp=aspect();
      const R=Math.max(min, Math.min(max,
        Math.max(halfNeeded/(halfFov*u.v), wide/(halfFov*asp*u.h))*pad));
      // Drop the TARGET rather than insetting both edges — see the header.
      return { R, Y: centerY - u.shift*R*halfFov, u };
    }

    /* Hang the content off the TOP of the usable band instead of centring it,
     * damped by `pull`. Worth having when the slack is more useful below the
     * subject than above it (a button under the molecule, say).
     * Damped because the camera usually sits at an elevation, so a world-Y shift
     * does not travel a matching number of pixels — solving it exactly walks the
     * label off the top edge. A SMALLER Y IS A HIGHER SUBJECT, so never take the
     * larger: on a state that fills the frame the pull is zero and centring
     * stands. */
    function anchorTop(R, centredY, topY, pull=0.5){
      const u=usable(), H=R*halfFov;
      const anchored=topY-H*(1-2*u.tf);
      return centredY + Math.min(0, anchored-centredY)*pull;
    }

    /* ORTHOGRAPHIC pages only: push cam.r into the frustum. Centred, and it
     * stays centred — the subject lives on the centre line and chrome works
     * around it (see the header on symmetric horizontal reserves). */
    function frustum(){
      if(!camera.isOrthographicCamera) return;
      const halfH=cam.r*halfFov, halfW=halfH*aspect();
      camera.top=halfH; camera.bottom=-halfH;
      camera.left=-halfW; camera.right=halfW;
      camera.updateProjectionMatrix();
    }

    // world units per CSS pixel, at the current framing
    const worldPerPx=()=>{
      const h=canvas.clientHeight||1;
      return 2*cam.r*halfFov/h;
    };

    return { usable, solve, anchorTop, frustum, worldPerPx, HALF_FOV:halfFov,
      set reserve(fn){ reserve=fn||(()=>({})); },
      get reserve(){ return reserve; } };
  }

  global.Fit={create, HALF_FOV};
})(this);
