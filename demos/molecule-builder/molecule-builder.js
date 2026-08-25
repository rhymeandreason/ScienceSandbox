/* =============================================================================
 *  molecule-builder/molecule-builder.js — the bonding builder as a box
 * =============================================================================
 *  Loaded as a classic script AFTER three.min.js, molecules.js, scene.js, fx.js,
 *  atomkit.js, covalent-drag.js and ionic-drag.js. Exposes window.MoleculeBuilder.
 *
 *  What this owns is the STAGE a hand-built molecule needs, and nothing about
 *  chemistry: covalent-drag.js and ionic-drag.js still hold every rule, and this
 *  file cannot tell you what a bond is. It exists so a page that is not
 *  molecule-builder.html can put one molecule on the bench without copying 700
 *  lines of shell — and, more to the point, without copying the shell's
 *  DECISIONS and then drifting from them.
 *
 *  Usage:
 *    const b = MoleculeBuilder.create({ mount, recipe:'water', onChange });
 *    b.setView(false);        // 3D
 *    b.reset();  b.fill();  b.destroy();
 *
 * ---------------------------------------------------------------------
 *  WHAT IS EASY TO GET WRONG, AND THEREFORE WHAT THIS OWNS
 * ---------------------------------------------------------------------
 *
 *  · THE PROJECTION IS ORTHOGRAPHIC, AND THAT IS NOT A PREFERENCE. This is a
 *    page about comparing sizes — an oxygen against a hydrogen, a chloride
 *    against a sodium. Under perspective a nearer atom reads BIGGER rather than
 *    closer, which is the one misreading the lesson cannot survive. So the
 *    builder brings its own canvas, renderer and ortho camera rather than
 *    borrowing the host's: a host drawn in perspective (water-lab) can mount one
 *    and the projection is still right, because the host never had a say.
 *
 *  · A SECOND WEBGL CONTEXT IS A REAL RESOURCE. Browsers cap them around 8-16
 *    and silently drop the OLDEST past that — the symptom is the host's main
 *    stage going blank, with no error. So: one builder, reused, and `destroy()`
 *    actually releases the context. A page that makes one per step will kill
 *    itself. Same rule as kit/inset.js, for the same reason.
 *
 *  · A BOX NOBODY CAN SEE MUST NOT RENDER. An IntersectionObserver drives the
 *    loop, so a builder behind a closed step costs nothing and a caller that
 *    forgets to stop it gets the right behaviour anyway.
 *
 *  · THE VIEW TOGGLE IS NOT A VIEW TOGGLE. 2D and 3D each imply what gets
 *    DRAWN: flat is the projection for COUNTING, so it draws every valence
 *    electron; round is the one for SHAPE, so it draws sticks, because a cloud
 *    of dots hides the geometry it exists to show. Two pages that disagree
 *    about that teach different chemistry, so the coupling lives here in one
 *    place (`modeFor`) instead of in each page's button handler.
 *
 *  · FLAT IS LOCKED, AND THE LOCK IS RE-ASSERTED PER FRAME rather than by
 *    unbinding Stage's orbit handler — the handler is shared, and a builder
 *    that unbinds it takes the host's orbit with it.
 * ========================================================================== */
(function(global){
  'use strict';

  /* cam.r ⇒ world half-height on screen. An ortho camera's apparent size is its
   * frustum, so zoom is this mapping and nothing else; scene.js's resize holds
   * the half-height and rewrites the width. */
  const ZOOM = { min:30, max:130, k:0.08 };

  /* One molecule fits at 62. The proton-transfer stages deal a SECOND one at the
   * edge of the frame so it is not already inside the reaction, and at 62 that
   * reagent lands half off the paper on a narrow box. 80 is sized for the worst
   * case rather than for one laptop: HCl's water reaches x≈7.4, so the frustum
   * has to be ~9 wide at an aspect as low as 1.4. Eased rather than cut, because
   * the student is looking at the molecule when it happens and a jump reads as
   * the molecule shrinking, not the view widening. */
  const R_ONE = 62, R_TWO = 80;
  /* An ionic tab opens with the two ions already apart — they are dealt at
   * x ±4.6 and chloride is 1.24 wide on top of that — so it needs the wider
   * frame from the first frame, not only when a reagent arrives. */
  const R_IONS = 72;

  /* How wide the bench actually is, in world units, per stage. An embedded
   * builder does not get to assume its host's aspect: in a box taller than it
   * is wide the frustum is height-driven and the outermost atom falls off the
   * side. Chloride goes first, and it is wider than its sphere — dealt at x 4.6,
   * 1.24 of radius, and a valence cloud outside that again.
   * So the half-height is whatever it takes to show this much WIDTH, and a
   * narrow panel zooms out instead of cropping.
   *
   * These are MEASURED, not chosen: check-molecule-builder.js reads every
   * recipe's own dealt positions out of the two drag modules and fails if one
   * reaches past the frame it opens in. Widening a scatter means widening these.
   * "Drawn extent" includes the valence cloud at 1.85x the display radius — a
   * halo sliced off by the frame edge reads as badly as a cut sphere. */
  const W_ONE = 7.0, W_IONS = 7.0, W_TWO = 9.0;

  // which module owns which recipe. Filling a valence slot and handing an
  // electron over are different MECHANICS, hence different files (SCIENCE.md 6)
  const IONIC = { nacl:1, kcl:1, mgcl2:1 };

  function create(opts = {}) {
    /* The builder makes its OWN canvas inside the host's box, and destroy()
     * takes it away again. Not a convenience: destroy() force-loses the WebGL
     * context to give it back (see the header), and a canvas that has lost one
     * can never be granted another — so a host that supplied the element and
     * rebuilt on it would get a permanently white box. Owning the element is
     * what makes destroy-then-create work at all. */
    const mount = opts.mount;
    if (!mount) throw new Error('MoleculeBuilder.create needs a mount element');
    const canvas = document.createElement('canvas');
    canvas.className = 'mb-canvas';
    mount.appendChild(canvas);
    const recipe = opts.recipe || 'water';
    const onChange = opts.onChange || function(){};
    const ionic = !!IONIC[recipe];
    /* Everything the sim's onChange reads has to exist BEFORE the sim does: it
     * reports its opening state from inside create(), so a `let` further down
     * this function is still in its dead zone when the first report lands. */
    const rBase = ionic ? R_IONS : R_ONE;
    const wBase = ionic ? W_IONS : W_ONE;
    let flat = true;

    let userSpun = false, userZoomed = false;
    const stage = global.Stage.create(canvas, {
      ortho:true, cam:{ theta:0.6, phi:1.15, r:rBase },
      rMin:ZOOM.min, rMax:ZOOM.max,
      onZoom:()=>{ userZoomed = true; applyZoom(); },   // the wheel wins from then on
      onDrag:()=>{ userSpun = true; },
    });
    const { scene, camera, renderer, root, cam, applyCam } = stage;

    function applyZoom(){
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      const a = w/h;
      const halfH = Math.max(cam.r * ZOOM.k, wWant / a);
      camera.top = halfH; camera.bottom = -halfH;
      camera.left = -halfH*a; camera.right = halfH*a;
      camera.updateProjectionMatrix();
    }
    let rWant = rBase, wWant = wBase;
    // the two travel together: a stage that deals a second molecule needs both
    // the pull-back and the width, and setting one without the other clips
    function wantZoom(r, w){ rWant = r; wWant = w; }

    const fx = global.FX.create(global.THREE, root, camera);
    const Drag = ionic ? global.IonicDrag : global.CovalentDrag;
    const sim = Drag.create({ THREE:global.THREE, root, camera, canvas, fx,
                              recipe, onChange:report });

    /* ---- the view -------------------------------------------------------
     * 2D is the default: locked, countable, and the view the electron argument
     * is made in. 3D is where you go to check the geometry. */
    const dimsHost = opts.dims === false ? null
                   : (opts.dims && opts.dims.nodeType ? opts.dims : mount);
    let dims = null;
    if (dimsHost) {
      dims = document.createElement('div');
      /* `.segmented` is main.css's component for exactly this control, and the
       * pressed state is `aria-pressed` — which the design system reads AND a
       * screen reader announces, so there is no second source of truth. `mb-dims`
       * carries only what is this module's business: where the control sits and
       * whether it has been earned yet. */
      dims.className = 'segmented mb-dims';
      dims.setAttribute('role','group');
      dims.setAttribute('aria-label','View');
      dims.innerHTML =
        '<button data-dim="3d" aria-pressed="false">3D</button>' +
        '<button data-dim="2d" aria-pressed="true">2D</button>';
      dims.addEventListener('click', e => {
        const b = e.target.closest('[data-dim]');
        if (b) setView(b.dataset.dim === '2d');
      });
      dimsHost.appendChild(dims);
    }

    /* electrons-vs-sticks follows the view rather than having its own toggle:
     * see the header. This is the coupling, and it is the reason the toggle is
     * in this file rather than in a page. */
    function modeFor(){ return flat ? 'electrons' : 'sticks'; }

    /* The switch only exists once there is a molecule worth turning — an empty
     * bench has no geometry to check. `armDims:'always'` opts out, for a bench
     * or a page that wants the control from the start. */
    const armMode = opts.armDims || 'complete';
    function arm(on){
      if (dims) dims.classList.toggle('armed', on || armMode === 'always');
      if (!on && armMode !== 'always') setView(true);
    }
    arm(false);

    function setView(toFlat){
      if (toFlat === flat) return;      // already there: a no-op, not a re-render
      flat = toFlat;
      if (dims) dims.querySelectorAll('[data-dim]').forEach(o =>
        o.setAttribute('aria-pressed', String((o.dataset.dim === '2d') === flat)));
      if (flat) userSpun = true;        // no idle turntable behind a locked view
      else {
        // three-quarter camera, close enough to the flat one to read as a
        // continuation before it turns
        cam.theta = 0.3; cam.phi = 1.4; applyCam(); userSpun = false;
      }
      sim.setDim(flat ? '2d' : '3d');
      sim.setMode(modeFor());           // after setDim: the mode is derived from it
      onChange(state());
    }

    /* The reagent stages widen the frame the moment a second molecule can
     * appear, not when the page happens to know: the sim's own state says
     * whether one is on the bench, so nothing has to be told twice. */
    function report(s){
      const two = !!(s && (s.canOfferWater || s.hasWater));
      wantZoom(two ? R_TWO : rBase, two ? W_TWO : wBase);
      if (s && s.complete) arm(true);
      onChange(state(s));
    }
    function state(s){
      return Object.assign({ flat }, s || sim.state());
    }

    /* ---- the loop -------------------------------------------------------
     * Gated on visibility: a builder behind a closed step is invisible waste,
     * and it is the second WebGL context that makes it worth caring about. */
    let raf = 0, last = 0, running = false, visible = true;
    function frame(now){
      if (!running) return;
      raf = requestAnimationFrame(frame);
      const dt = last ? Math.min((now-last)/1000, 0.05) : 0.016; last = now;
      // the 2D lock, re-asserted rather than unbound — Stage's orbit handler is
      // shared with the host and unbinding it would take the host's orbit too
      if (flat) { cam.theta = 0; cam.phi = Math.PI/2; applyCam(); }
      else if (!userSpun) { cam.theta += 0.0009; applyCam(); }   // idle turntable
      /* Eased here rather than tweened on a timer: this is the only place that
       * knows the frame rate. Stops calling applyZoom once it has arrived. */
      if (!userZoomed && Math.abs(cam.r - rWant) > 0.05) {
        cam.r += (rWant - cam.r) * (1 - Math.pow(0.02, dt));
        applyZoom();
      }
      sim.step(dt);
      fx.step();
      renderer.render(scene, camera);
      if (opts.afterFrame) opts.afterFrame();
    }
    function start(){ if (running || !visible) return;
      running = true; last = 0; raf = requestAnimationFrame(frame); }
    function stop(){ running = false; cancelAnimationFrame(raf); }

    const io = new IntersectionObserver(es => {
      visible = es.some(e => e.isIntersecting);
      visible ? start() : stop();
    });
    io.observe(canvas);
    const ro = new ResizeObserver(applyZoom); ro.observe(canvas);

    stage.resize();
    applyZoom();     // the frustum IS the framing; nothing is right until it is set
    sim.setDim('2d'); sim.setMode(modeFor());
    if (opts.fill) sim.fill();
    start();

    return {
      sim, stage, canvas, start, stop, state,
      setView, get flat(){ return flat; },
      reset(){
        userZoomed = false; wantZoom(rBase, wBase);
        arm(false);
        sim.reset();
        sim.setMode(modeFor());
      },
      fill(){ sim.fill(); sim.setMode(modeFor()); },
      destroy(){
        stop(); io.disconnect(); ro.disconnect();
        if (dims && dims.parentElement) dims.parentElement.removeChild(dims);
        if (canvas.parentElement) canvas.parentElement.removeChild(canvas);
        if (sim.destroy) sim.destroy();
        renderer.dispose();
        // the context is the scarce thing, and dispose() alone does not give it
        // back — see the header
        const lose = renderer.getContext().getExtension('WEBGL_lose_context');
        if (lose) lose.loseContext();
      },
    };
  }

  global.MoleculeBuilder = { create, ZOOM, R_ONE, R_TWO, R_IONS };
})(window);
