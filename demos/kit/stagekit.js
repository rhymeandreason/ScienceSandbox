/* =============================================================================
 *  kit/stagekit.js — the lesson shell: loop, resize, fit, clock
 * =============================================================================
 *  scene.js stops at primitives (atom, bond, buildMolecule, measure, frame) and
 *  that line is right — it is deliberately ignorant of any lesson's physics.
 *  But the layer directly above it is not physics either, and every page has
 *  built it again: a render loop, a ResizeObserver, an FX step, and a camera
 *  fit that has to know how much of the canvas the caption / tray / bar chrome
 *  is covering. That last one is the expensive one — glycolysis-lab carries
 *  five functions (`usable`, `barReservePx`, `capReservePx`, `trayReservePx`,
 *  `computeFit`) to answer "how much room is actually left", and the next
 *  lesson with a caption would need all five.
 *
 *  So this module owns exactly that: the loop, the resize, and the arithmetic
 *  that turns CHROME MEASURED IN PIXELS into the world-space bands Stage.frame
 *  wants. It owns no lesson state and no physics, and it never draws anything.
 *
 *  Loaded after scene.js (+ fx.js, kit/motion.js, kit/focus.js if used).
 *  Exposes window.Lesson.
 *
 *  Usage:
 *    const L = Lesson.create(canvas, {
 *      cam:{theta:.35,phi:1.2}, fx:true,
 *      boxes:()=>currentBoxes(),              // re-asked on every resize
 *      reservePx:()=>({bottom:capEl.offsetHeight+18}),
 *      frame:dt=>{ if(!userSpun) root.rotation.y+=dt*.13; },
 *    });
 *    L.root.add(g);  L.fit();  L.start();
 * ========================================================================== */
(function(global){
  'use strict';
  const THREE=global.THREE;

  function create(canvas, opts={}){
    const o=Object.assign({fx:true, motion:true, focus:true, pad:1.1,
      min:6, max:220}, opts);

    const stage=global.Stage.create(canvas, o);
    const {scene,camera,renderer,root,cam,applyCam,resize}=stage;

    const fx    = (o.fx    && global.FX)     ? global.FX.create(THREE,root,camera) : null;
    const motion= (o.motion&& global.Motion) ? global.Motion.create() : null;
    const focus = (o.focus && global.Focus)  ? global.Focus.create()  : null;

    /* ---- how big is a world unit, here, right now? ----
     * The conversion every page needed and none had. Under a perspective camera
     * it depends on standing distance, which the fit is itself solving for —
     * hence the loop in fit() below rather than a single call. */
    function worldPerPx(){
      const h=canvas.clientHeight||1;
      if(camera.isOrthographicCamera) return (camera.top-camera.bottom)/h;
      return 2*cam.r*Math.tan(camera.fov*Math.PI/360)/h;
    }
    const pxToWorld=px=>px*worldPerPx();

    /* ---- fit ----
     * boxes: [{x,y,rxz,hy}] as Stage.measure gives them, or the `boxes` option
     * (a function, so a resize re-asks the page what is on stage rather than
     * framing whatever was there when the page loaded).
     *
     * reservePx: {top,bottom} CSS pixels of chrome sitting over the canvas — a
     * caption, a tray, a bar chart. Measured from the DOM by the page (offsetHeight),
     * converted here. Solved by ITERATION because a perspective fit is circular:
     * the band is a pixel height, its world size depends on the distance, and
     * the distance depends on the band. Three passes converge to well under a
     * pixel; one pass under-reserves and the caption lands on the molecule. */
    function fit(boxesArg, fitOpts={}){
      const boxes = boxesArg || (typeof o.boxes==='function' ? o.boxes() : o.boxes);
      if(!boxes || !boxes.length) return;
      const rp = typeof (fitOpts.reservePx||o.reservePx)==='function'
        ? (fitOpts.reservePx||o.reservePx)() : (fitOpts.reservePx||o.reservePx||{});
      const base={pad:o.pad, min:o.min, max:o.max};
      let top=fitOpts.top||0, bottom=fitOpts.bottom||0;
      for(let k=0;k<3;k++){
        global.Stage.frame(camera, cam, boxes, Object.assign({},base,fitOpts,{top,bottom}));
        const w=worldPerPx();
        top   =(fitOpts.top   ||0)+(rp.top   ||0)*w;
        bottom=(fitOpts.bottom||0)+(rp.bottom||0)*w;
      }
      global.Stage.frame(camera, cam, boxes, Object.assign({},base,fitOpts,{top,bottom}));
      applyCam();
      return cam.r;
    }

    /* ---- resize ----
     * resize() BEFORE fit(): the fit solves against camera.aspect, which is
     * only right once the canvas has been measured. Every page here has that
     * comment; now only this one needs it. */
    let onResize=o.onResize||null;
    new ResizeObserver(()=>{ resize(); fit(); if(onResize) onResize(); }).observe(canvas);

    /* ---- the loop ----
     * dt in SECONDS, so a page's motion is written in real time rather than in
     * per-frame increments that run at different speeds on a 120 Hz display.
     * Motion first (it may move what the page is about to read), then the
     * page's own frame hook, then FX, then draw. */
    let running=false, last=0, frameHook=o.frame||null, afterHook=o.afterFrame||null;
    function tick(now){
      if(!running) return;
      const dt=last?Math.min((now-last)/1000, 0.1):1/60; last=now;
      if(motion) motion.step(dt);
      if(frameHook) frameHook(dt);
      if(fx) fx.step();
      renderer.render(scene,camera);
      // AFTER the render, never before. Vector3.project() reads the camera's
      // matrixWorldInverse, which is refreshed only on render — anything that
      // pins DOM to a 3D point (a species label, a callout, a badge) projects
      // the PREVIOUS frame's camera if it runs in the frame hook instead.
      // Barely visible on a slow drag, very visible during a zoom ease.
      if(afterHook) afterHook(dt);
      requestAnimationFrame(tick);
    }
    function start(){ if(running) return; running=true; last=0; requestAnimationFrame(tick); }
    function stop(){ running=false; }
    // One frame, on demand — for a screenshot, or for a page that only redraws
    // on interaction. A backgrounded tab pauses rAF, so anything automated
    // (see CLAUDE.md's browser gotchas) should call this rather than trust that
    // the loop is running.
    function draw(){ renderer.render(scene,camera); }

    function snapshot(name){
      draw();
      const a=document.createElement('a');
      a.download=(name||'molecule')+'.png';
      a.href=canvas.toDataURL('image/png'); a.click();
    }

    const api=Object.assign({}, stage, {
      fx, motion, focus,
      fit, worldPerPx, pxToWorld, start, stop, draw, snapshot,
    });
    // ACCESSORS DEFINED, NOT SPREAD. Object.assign COPIES VALUES: a `set frame`
    // written in an object literal handed to it is read through its (absent)
    // getter and lands as a plain `frame: undefined`, so every later
    // `L.frame = fn` assigns a dead property and the hook never runs. The page
    // still animates — Motion and FX are stepped by the loop itself — so what
    // you get is a camera that never eases and DOM anchors that only update on
    // a refresh, which reads as a framing bug rather than a wiring one.
    Object.defineProperties(api,{
      frame:      {get:()=>frameHook, set(fn){ frameHook=fn; }},
      afterFrame: {get:()=>afterHook, set(fn){ afterHook=fn; }},
      resized:    {get:()=>onResize,  set(fn){ onResize=fn; }},
      running:    {get:()=>running},
    });
    return api;
  }

  global.Lesson={create};
})(this);
