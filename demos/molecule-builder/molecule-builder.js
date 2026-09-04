/* =============================================================================
 *  molecule-builder/molecule-builder.js — the bonding builder as a box
 * =============================================================================
 *  Loaded as a classic script AFTER three.min.js, molecules.js, scene.js, fx.js,
 *  atomkit.js, kit/card-stage.js, covalent-drag.js and ionic-drag.js.
 *  Exposes window.MoleculeBuilder.
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
 *    //  …plus zoomOnComplete:true on a card, where the bench frame is too big
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
 *    builder brings its own stage and ortho camera rather than
 *    borrowing the host's: a host drawn in perspective (water-lab) can mount one
 *    and the projection is still right, because the host never had a say.
 *
 *  · THE CANVAS, THE LOOP AND THE CONTEXT ARE kit/card-stage.js's. This file
 *    used to own all three, and so did kit/molbox.js, and the two had already
 *    drifted. What stays here is the part that is a DECISION — the ortho
 *    projection, the width-first frustum, the 2D lock, and what a view change
 *    means. A builder is still one context that `destroy()` really releases,
 *    and it still stops rendering when nobody can see it; those rules did not
 *    weaken, they moved somewhere one file states them.
 *
 *  · THE RESIZE ORDER IS LOAD-BEARING, and it is the one thing the move could
 *    have broken silently. `Stage.resize()` holds an ortho camera's HALF-HEIGHT
 *    and rewrites the width from the new aspect; this module's rule is the
 *    opposite — the half-height is whatever shows the WIDTH the recipe needs.
 *    So `applyZoom` runs from card-stage.js's `onResize`, which fires after
 *    `Stage.resize()` and overwrites it. Reversed, the frame narrows on every
 *    resize until chloride falls off the side, and check-molecule-builder.js
 *    cannot see it: that checker reads the constants, not a live resize.
 *
 *  · `snapshot()` REFUSES MID-FOLD. A 2D↔3D change hides the sticks for 340 ms
 *    so the molecule folds up before it re-bonds (covalent-drag.js `setDim`),
 *    and a still taken in that window shows a bonded molecule drawn with no
 *    bonds. A bad FRAME is gone in 16 ms; a bad still is what a card keeps. So
 *    the sim is asked — `holding()` — and null is a legitimate answer.
 *
 *  · THE FRAME THAT HOLDS THE SCATTER IS TOO BIG FOR THE MOLECULE. Opening
 *    width is measured against where the atoms are DEALT (W_ONE and friends,
 *    check-molecule-builder.js §2), so a finished water sits 4.8 wide in a
 *    frame 15.7 across and fills 30% of it. That is right on the lesson's big
 *    stage and wrong on a card, which is a close-up by definition — so it is
 *    `zoomOnComplete:true`, per instance, rather than a change to the shared
 *    beat. The host decides, because only the host knows how big its box is.
 *    The fit is SOLVED from the built molecule's own bounding box, never
 *    typed: a typed pair would be right for water and wrong for MgCl2. And it
 *    is skipped while a reagent can still arrive — closing in on the product
 *    would deal the second molecule off the paper.
 *
 *  · A FINISHED MOLECULE TURNS ITSELF, ONCE — IF THE STUDENT FINISHED IT. The
 *    flat view is locked, so a student who never finds the toggle reads the
 *    flat cross as the molecule's SHAPE rather than as a way of drawing it. One
 *    unprompted turn is what says the two pictures are one object, and it is
 *    why the beat belongs here rather than in each host. Once, and only from
 *    flat: someone who turned it back to 2D is answering the question. And
 *    never on a molecule the PAGE assembled — `fill()` and `fill:true` are a
 *    replay of a state the student reached earlier or a card opening
 *    pre-built, and a turn fired at that says "you finished it" to nobody.
 *    `turn:false` opts out of it entirely.
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
    let rWant = rBase, wWant = wBase;

    /* THE MOLECULE TURNS ITSELF, ONCE, WHEN IT IS FINISHED — and the beat is
     * the argument, not the animation. 2D is the projection for COUNTING and it
     * is locked, so a student who never finds the toggle never learns the thing
     * is three-dimensional at all: the flat cross reads as the molecule's shape
     * rather than as a way of drawing it. Turning it once, unprompted, is what
     * says the two pictures are one object. molecule-builder.html has done this
     * since before there was a module (its `spun` flag, at 900 ms); the module
     * was extracted without it, which left every embedded builder flat forever.
     *
     * ONCE, and only from FLAT: a student who has turned it back to 2D on
     * purpose is answering the question, and turning it again overrules them.
     * `turn:false` opts a host out — a lesson driving its own beat wants the
     * moment, not this one. A wall-clock timer, like covalent-drag's stick hold
     * and for the same reason: it is a COMMIT, so it lands whether or not the
     * card was on screen, and a paused card resumes already turned. */
    const TURN_MS = 900;
    let turned = false, turnT = null;

    /* A PRE-BUILT MOLECULE HAS NOT EARNED THE TURN. The beat says "you finished
     * it, now look at it in three dimensions" — fire it at a molecule the page
     * assembled and it says that to nobody, and the card animates at a reader
     * who has done nothing. `molecule-builder.html` has always drawn this line
     * (its `restoring` flag skips the completion ring and the auto-turn on a
     * replayed state); the module was extracted without it.
     *
     * Scoped rather than a state flag, because both mechanics report from
     * INSIDE fill(): covalent's fill() calls bond(h, i, quiet) and ionic's
     * calls transfer(a, instant), and both fire onChange synchronously before
     * fill() returns. `quiet`/`instant` are the same distinction one level
     * down — they already suppress the shimmer for exactly this reason. */
    let replaying = false;
    function replay(fn) {
      replaying = true;
      try { fn(); } finally { replaying = false; }
    }
    function cancelTurn(){ clearTimeout(turnT); turnT = null; }
    function scheduleTurn(){
      if (opts.turn === false || turned || !flat || turnT) return;
      turned = true;
      turnT = setTimeout(() => { turnT = null; setView(false); }, TURN_MS);
    }
    // the two travel together: a stage that deals a second molecule needs both
    // the pull-back and the width, and setting one without the other clips
    function wantZoom(r, w){ rWant = r; wWant = w; }

    /* THE FRAME HAS TWO JOBS AND THEY WANT DIFFERENT SIZES. While you are
     * building, it has to hold the atoms where they are DEALT — scattered out
     * to x ±6, which is what W_ONE/W_IONS/W_TWO are measured against and what
     * check-molecule-builder.js §2 enforces. Once the molecule is built, all
     * that room is empty: a finished water is 4.8 wide inside a frame 15.7
     * across, so it fills 30% of a card and reads as a small molecule rather
     * than a close-up.
     *
     * On the LESSON page that frame is right — the stage is large, the molecule
     * reads fine in it, and holding still is worth more than a closer look. On
     * a CARD it is not. So this is opt-in per instance rather than a change to
     * the shared beat: `zoomOnComplete:true` and the card gets its own framing.
     *
     * SOLVED, NEVER TYPED (AddingAPage.md). The extent comes out of the built
     * molecule's own bounding box, so it is right for every recipe, and a
     * change to any scatter or radius moves it without anyone editing a number.
     * A typed pair would be correct for water and wrong for MgCl2. */
    const FIT_PAD = 1.35;      // slack, and the room the view switch sits in
    const _fitBox = new global.THREE.Box3();
    function fitZoom(){
      if (!sim || !sim.group) return null;
      _fitBox.setFromObject(sim.group);
      if (_fitBox.isEmpty()) return null;
      // Symmetric about the origin, because the frustum is: applyZoom writes
      // left = -halfH*a. Taking the larger side is what keeps the far edge in.
      const halfW = Math.max(Math.abs(_fitBox.min.x), Math.abs(_fitBox.max.x)) * FIT_PAD;
      const halfH = Math.max(Math.abs(_fitBox.min.y), Math.abs(_fitBox.max.y)) * FIT_PAD;
      if (!(halfW > 0) || !(halfH > 0)) return null;
      // wWant IS a half-width (applyZoom: halfH = max(cam.r*k, wWant/a), and the
      // frame is 2*halfH*a across), and cam.r is that half-height over ZOOM.k.
      return { r: halfH / ZOOM.k, w: halfW };
    }

    /* THE FRUSTUM IS THE FRAMING, and it is solved from the WIDTH the recipe
     * needs rather than from a zoom level — the header's second trap. This runs
     * on every resize through card-stage.js's `onResize`, which fires AFTER
     * `Stage.resize()`: scene.js's ortho branch holds the half-height and
     * rewrites the width from the new aspect, which is the opposite rule and
     * would narrow this frame until chloride falls off the side. So it does not
     * merely re-apply the zoom, it overwrites what Stage just wrote — and the
     * ordering is the whole reason `onResize` exists. Nothing offline sees this:
     * check-molecule-builder.js reads the constants, not a live resize. */
    let stage = null;
    function applyZoom(){
      if (!stage) return;             // called once from inside create(), before this is set
      const w = box.canvas.clientWidth, h = box.canvas.clientHeight;
      if (!w || !h) return;
      const a = w/h;
      const halfH = Math.max(stage.cam.r * ZOOM.k, wWant / a);
      const camera = stage.camera;
      camera.top = halfH; camera.bottom = -halfH;
      camera.left = -halfH*a; camera.right = halfH*a;
      camera.updateProjectionMatrix();
    }

    /* ---- the frame ------------------------------------------------------
     * Everything that has to happen before a render and needs `dt`. The loop
     * itself, the canvas, the visibility gate and the context release are
     * kit/card-stage.js's; every line in here is a decision of this module's. */
    let sim = null, fx = null;
    function frameStep(dt){
      const cam = stage.cam, applyCam = stage.applyCam;
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
      if (sim) sim.step(dt);
      if (fx) fx.step();
    }

    /* THE PROJECTION IS ORTHOGRAPHIC, AND THAT IS NOT A PREFERENCE — the
     * header's first trap. It goes through `stage:` because card-stage.js
     * forwards that to Stage.create verbatim and has no opinion about cameras. */
    const box = global.CardStage.create({
      mount, canvasClass:'mb-canvas', autoplay:false,
      stage:{
        ortho:true, cam:{ theta:0.6, phi:1.15, r:rBase },
        rMin:ZOOM.min, rMax:ZOOM.max,
        onZoom:()=>{ userZoomed = true; applyZoom(); },   // the wheel wins from then on
        onDrag:()=>{ userSpun = true; },
      },
      step: frameStep,
      onResize: applyZoom,
      afterFrame: opts.afterFrame,
      onDestroy: () => {
        cancelTurn();                   // no setView() on a torn-down sim
        if (dims && dims.parentElement) dims.parentElement.removeChild(dims);
        if (sim && sim.destroy) sim.destroy();
      },
    });
    stage = box.stage;
    const canvas = box.canvas;
    // Only what this file still uses: the loop and the render are box's now.
    const { camera, root } = stage;

    fx = global.FX.create(global.THREE, root, camera);
    const Drag = ionic ? global.IonicDrag : global.CovalentDrag;
    sim = Drag.create({ THREE:global.THREE, root, camera, canvas, fx,
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
       * whether it has been earned yet.
       *
       * `--sm` because this one lies ON THE STAGE. The document-size segmented
       * is the height of a .cta, which over a molecule is a control covering
       * the thing it switches. */
      dims.className = 'segmented segmented--sm mb-dims';
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
      // Whoever asked, the scheduled turn is now redundant or overruled. Harmless
      // when it is the timer itself calling: it has already cleared its handle.
      cancelTurn();
      if (toFlat === flat) return;      // already there: a no-op, not a re-render
      flat = toFlat;
      if (dims) dims.querySelectorAll('[data-dim]').forEach(o =>
        o.setAttribute('aria-pressed', String((o.dataset.dim === '2d') === flat)));
      if (flat) userSpun = true;        // no idle turntable behind a locked view
      else {
        // three-quarter camera, close enough to the flat one to read as a
        // continuation before it turns
        stage.cam.theta = 0.3; stage.cam.phi = 1.4; stage.applyCam();
        userSpun = false;
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
      if (s && s.complete) { arm(true); if (!replaying) scheduleTurn(); }
      /* AFTER the wantZoom above, and only when a reagent is NOT in play. The
       * order is the rule: `two` means a second molecule can still arrive at
       * the edge of the frame, and closing in on what is already built would
       * deal it off the paper. A reagent stage keeps the wide frame and gets
       * no close-up, which is correct — the subject there is the reaction, not
       * the product. */
      if (opts.zoomOnComplete && s && s.complete && !two) {
        const fit = fitZoom();
        if (fit) wantZoom(fit.r, fit.w);
      }
      onChange(state(s));
    }
    function state(s){
      return Object.assign({ flat }, s || sim.state());
    }

    applyZoom();     // the frustum IS the framing; nothing is right until it is set
    sim.setDim('2d'); sim.setMode(modeFor());
    if (opts.fill) replay(() => sim.fill());
    box.start();

    return {
      sim, stage, canvas, state,
      start: box.start, stop: box.stop, pump: box.pump,
      get running(){ return box.running; },
      setView, get flat(){ return flat; },
      /* No picture MID-FOLD. A dim change hides the sticks for a third of a
       * second so the molecule folds up before it re-bonds, and a still caught
       * in that window shows a bonded molecule with no bonds — a chemistry
       * error that, unlike a bad frame, then sits there. Null is a legitimate
       * answer: a caller that has nowhere to put a picture shows none. */
      snapshot(){ return sim.holding() ? null : box.snapshot(); },
      reset(){
        userZoomed = false; wantZoom(rBase, wBase);
        turned = false; cancelTurn();   // a fresh molecule earns the turn again
        arm(false);
        sim.reset();
        sim.setMode(modeFor());
      },
      fill(){ replay(() => sim.fill()); sim.setMode(modeFor()); },
      destroy: box.destroy,
    };
  }

  global.MoleculeBuilder = { create, ZOOM, R_ONE, R_TWO, R_IONS };
})(window);
