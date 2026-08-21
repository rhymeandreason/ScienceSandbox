/* =============================================================================
 *  kit/inset.js — one molecule in a box, over a scene at another scale
 * =============================================================================
 *  The figure convention every textbook uses and this repo had no spelling
 *  for: a framed close-up of ONE molecule, sitting over a stage drawn at a
 *  scale where that molecule is a few pixels. membrane-lab is the case that
 *  forced it — membrane/parts.js draws a lipid as a head sphere and two
 *  instanced cylinders, which is honest about a BILAYER and says nothing
 *  about what a lipid IS. The inset is where the ball-and-stick goes.
 *
 *  PLUMBING ONLY, so it stays in kit/: a renderer, a camera solved from the
 *  molecule's own extent, a loop that stops when nobody is looking. It owns
 *  no lesson state, no chemistry, and no opinion about which molecule.
 *
 *  Usage:
 *    const box = Inset.create({ canvas, spec: MolLib.MOLECULES.popc });
 *    box.stop();  box.start();          // or let visibility drive it
 *
 * ---------------------------------------------------------------------
 *  WHAT IS EASY TO GET WRONG, AND THEREFORE WHAT THIS OWNS
 * ---------------------------------------------------------------------
 *
 *  · THE FRAME IS NOT DECORATION. An inset is a magnification, so the
 *    molecule in it is at a completely different scale from the scene
 *    behind it. Unframed, it reads as an object standing IN that scene at
 *    that size, which is a false claim about a lipid roughly a thousand
 *    times over. The border is what makes it a window instead of a lie,
 *    and it lives in main.css's `.inset` component rather than here —
 *    kit/ carries no CSS. A caller that drops the class gets a wrong
 *    picture, and nothing offline can see it, so it is said here too.
 *
 *  · ORBIT TURNS THE CAMERA, NEVER THE MOLECULE. Stage.create's drag moves
 *    `cam`, so a spec's declared `view:` is still exactly what the box
 *    opens on and the group's rotation stays identity — the rule
 *    AddingAPage.md §115 exists for, satisfied by construction rather than
 *    by remembering. The optional turntable below advances `cam.theta` for
 *    the same reason; nothing here ever touches `group.rotation`.
 *
 *  · A SECOND WEBGL CONTEXT IS A REAL RESOURCE. Browsers cap them around
 *    8-16 and drop the OLDEST when you pass it, so a page that makes one
 *    inset per step eventually kills its own main stage — with no error,
 *    because losing a context is a canvas going blank. So: one inset,
 *    reused via `show()`, and `destroy()` actually releases it.
 *
 *  · A BOX NOBODY CAN SEE MUST NOT RENDER. An inset behind a hidden step
 *    is invisible waste, and it is the second context that makes it worth
 *    caring about. An IntersectionObserver drives start/stop, so a caller
 *    that forgets gets the right behaviour anyway.
 *
 *  · THE CAMERA IS SOLVED, NEVER TYPED. Stage.measure + Stage.frame against
 *    the real frustum, re-solved on every resize. A hand-picked `r` is
 *    correct only at the size it was picked at, and an inset is the most
 *    likely thing on a page to be resized by CSS alone.
 * ========================================================================== */
(function(global){
  'use strict';
  const THREE = global.THREE;

  function create(opts = {}) {
    const canvas = opts.canvas;
    if (!canvas) throw new Error('kit/inset.js: needs a canvas');

    const stage = global.Stage.create(canvas, Object.assign({
      cam: { theta: 0, phi: 1.35, r: 30 },
      rMin: 3, rMax: 400,
    }, opts.stage || {}));

    let spec = null, group = null, ext = null;
    let running = false, raf = 0;
    // Off by default. A spec that declares `view:` was posed by hand, and a
    // box that turns away from that angle within a second of appearing shows
    // it to nobody. Ask for it where the point IS that the thing is 3D.
    let spin = opts.spin ? (typeof opts.spin === 'number' ? opts.spin : 0.0035) : 0;

    function show(next) {
      if (group) { stage.root.remove(group); group = null; }
      spec = next || null;
      if (!spec) return;
      // center:true also bakes the spec's `view:` into the meshes — which is
      // why nothing here needs to know the pose exists.
      group = global.Stage.buildMolecule(spec, { center: true });
      stage.root.add(group);
      ext = global.Stage.measure(spec);
      fit();
    }

    function fit() {
      if (!ext) return;
      stage.resize();
      global.Stage.frame(stage.camera, stage.cam,
        [{ x: 0, y: 0, rxz: ext.rxz, hy: ext.hy }],
        { pad: opts.pad || 1.15 });
      stage.applyCam();
    }

    function draw() {
      if (spin) { stage.cam.theta += spin; stage.applyCam(); }
      stage.renderer.render(stage.scene, stage.camera);
    }

    function tick() { if (!running) return; raf = requestAnimationFrame(tick); draw(); }
    function start() { if (running) return; running = true; raf = requestAnimationFrame(tick); }
    function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }

    const ro = new ResizeObserver(fit); ro.observe(canvas);
    /* Visibility drives the loop, so a caller that never calls stop() still
     * does not burn a frame on a box behind a closed step. `start()` called
     * by hand on a hidden canvas is honoured until the observer disagrees —
     * the observer is the fallback, not the authority. */
    const io = new IntersectionObserver(es => {
      es.forEach(e => e.isIntersecting ? start() : stop());
    }, { threshold: 0.01 });
    io.observe(canvas);

    if (opts.spec) show(opts.spec);
    // One frame now, so the box is never blank in the gap before rAF runs —
    // and so a screenshot of a paused tab still shows the molecule.
    if (spec) draw();

    return {
      show, fit, start, stop, draw,
      setSpin(on) { spin = on ? (typeof on === 'number' ? on : 0.0035) : 0; },
      get spec() { return spec; },
      get group() { return group; },
      get stage() { return stage; },
      destroy() {
        stop(); ro.disconnect(); io.disconnect();
        if (group) stage.root.remove(group);
        stage.renderer.dispose();          // the context, actually released
      },
    };
  }

  global.Inset = { create };
})(this);
