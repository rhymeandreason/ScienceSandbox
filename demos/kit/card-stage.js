/* =============================================================================
 *  kit/card-stage.js — a live 3D box on a card, and the budget of them
 * =============================================================================
 *  Loaded as a classic script AFTER scene.js. Exposes window.CardStage.
 *
 *  PLUMBING ONLY, so it stays in kit/: a canvas, a Stage, a loop, a visibility
 *  gate, and a destroy that actually gives the WebGL context back. It owns no
 *  lesson state, no chemistry, and no opinion about what is in the box.
 *
 *  Usage:
 *    const box = CardStage.create({ mount, cam:{r:26}, step: dt => sim.step(...) });
 *    box.stop();  box.start();  box.destroy();
 *
 *    const pool = CardStage.pool({ limit: 4 });
 *    pool.acquire('salt', () => CardStage.create({...}));   // evicts the LRU
 *
 * ---------------------------------------------------------------------
 *  WHY THIS EXISTS, GIVEN THAT TWO MODULES ALREADY DID IT
 * ---------------------------------------------------------------------
 *  kit/molbox.js and molecule-builder/molecule-builder.js each wrote the same
 *  four things — own canvas, own loop, IntersectionObserver gate, destroy — and
 *  had already drifted: the builder learned that `renderer.dispose()` does not
 *  return the context and added the `WEBGL_lose_context` call, and molbox — then
 *  called inset.js — did not. So a box a page destroyed kept its context for the
 *  life of the tab, while its own header said it was released. Neither is wrong enough to
 *  notice from a page, which is the whole argument for one shell. This is it,
 *  and `water/watersim.js` is what forced it: the one shared module that IS the
 *  physics, and therefore the one with no stage of its own to mount.
 *
 *  WaterSim keeps refusing to grow one. Its `create(THREE, root, opts)` takes an
 *  Object3D precisely so water-lab and capillary/ can drive the same liquid under
 *  two different cameras, and so a card can put water and something else in one
 *  scene. This module is the missing half, not a replacement for that refusal.
 *
 * ---------------------------------------------------------------------
 *  WHAT IS EASY TO GET WRONG, AND THEREFORE WHAT THIS OWNS
 * ---------------------------------------------------------------------
 *
 *  · A SECOND WEBGL CONTEXT IS A REAL RESOURCE, AND A WALL OF CARDS IS THE
 *    CASE THAT BREAKS. Browsers cap contexts around 8-16 and silently drop the
 *    OLDEST past that — the symptom is a canvas going blank, with no error, and
 *    on a map of cards the one that blanks is the one the reader opened first.
 *    So a page that shows many cards does not create many stages: `pool()` holds
 *    a small number live and destroys the least recently acquired. The cap is a
 *    browser fact rather than a page preference, which is why it lives here and
 *    why the default is 4 and not "as many as fit".
 *
 *  · THE CANVAS IS MADE HERE, NOT SUPPLIED. `destroy()` force-loses the
 *    context, and a canvas that has lost one can never be granted another — so
 *    a host that handed the element in could never be given a live box on it
 *    again. Same reason as molecule-builder.js, and it is what makes the pool's
 *    destroy-then-recreate work at all.
 *
 *  · A BOX NOBODY CAN SEE MUST NOT RENDER. An IntersectionObserver drives the
 *    loop, so a card panned off the edge of a map costs nothing and a caller
 *    that forgets to stop it gets the right behaviour anyway. `start()` on a
 *    hidden box is honoured until the observer disagrees — the observer is the
 *    fallback, not the authority.
 *
 *  · A PAUSED BOX MUST NOT BE BLANK. One frame is rendered synchronously at
 *    create, and every `stop()` leaves the last frame on the canvas rather than
 *    clearing it. On a card that matters more than it does in a molbox: a
 *    stopped card is the reader's THUMBNAIL, and the whole reason pausing is
 *    acceptable is that the picture stays.
 *
 *  · `stop()` FREEZES, IT DOES NOT RESET. A sim mid-anything resumes mid-it.
 *    That is deliberate — a card the reader panned past and came back to should
 *    be where they left it — but it means a caller wanting a fresh box asks the
 *    pool for one instead of calling `start()`.
 *
 *  · `dt` IS SECONDS, CLAMPED AT 0.1. kit/motion.js's rule and the same number,
 *    because the two run off the same loop. A tab that was hidden for a minute
 *    otherwise resumes with a single sixty-second step, which in a physics sim
 *    is every molecule leaving the box at once.
 *
 *  · `afterFrame` RUNS AFTER THE RENDER — kit/stagekit.js's name and rule.
 *    Anything pinning DOM to a 3D point belongs there, because before the render
 *    it reads the previous frame's camera. The loop is this module's, so without
 *    the hook a card has nowhere to step a callout at all.
 *
 *  · THE SHAPE IS SETTLED NOW, AND IT WAS NOT WHEN THIS WAS WRITTEN. All three
 *    boxes are on it: `kit/molbox.js`, `molecule-builder/molecule-builder.js`,
 *    and the cards in `tests/cards-cluster.html`, which is the bench and the
 *    worked example. What the two conversions taught, in case a fourth is
 *    coming: the hooks that mattered were `onResize` (the builder's frustum
 *    rule is the opposite of `Stage.resize`'s and has to run after it) and
 *    `afterFrame` (molbox draws its leader there). Neither box needed a new
 *    one. `snapshot()` is what both of them lacked and could not have had while
 *    each owned a private loop.
 * ========================================================================== */
(function (global) {
  'use strict';

  /* ---- one box ---------------------------------------------------------- */

  function create(opts = {}) {
    const mount = opts.mount;
    if (!mount) throw new Error('kit/card-stage.js: needs a `mount` element');
    if (!global.Stage) throw new Error('kit/card-stage.js: load scene.js first');

    // Made here on purpose — see the header. `display:block` because an inline
    // canvas leaves a descender's worth of gap under it, which on a card reads
    // as a misaligned border rather than as a line-height.
    const canvas = document.createElement('canvas');
    // Named by the caller where a stylesheet already selects on it — the
    // bonding builder's `.mb-stage > .mb-canvas` rule predates this module and
    // pages depend on it, so the class comes in rather than the rule moving.
    canvas.className = opts.canvasClass || 'cardstage-canvas';
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    mount.appendChild(canvas);

    /* A DRAG HAS TO REDRAW, BECAUSE A CARD IS USUALLY NOT RUNNING.
       scene.js's orbit and zoom move the camera and call applyCam(), which
       positions it and nothing more: on an ordinary page a rAF loop is
       already drawing every frame, so the move is on screen before anyone
       notices there was a gap. A box with autoplay:false runs no loop, so a
       still card takes the drag, moves the camera, and keeps the last frame
       it drew — pointer state changes, picture does not, and it reads as a
       canvas that ignores the mouse rather than as a missing render.

       onDrag / onZoom are scene.js's own hooks, so this is one draw per
       event and not a loop started for a gesture. A caller's own hooks are
       kept: a page that passes onDrag wants it as well as this, not
       instead. */
    const stageOpts = Object.assign({
      cam: { theta: 0.5, phi: 1.15, r: 26 },
    }, opts.stage || {}, opts.cam ? { cam: opts.cam } : {});
    const also = fn => (...a) => { if (fn) fn(...a); if (!wanted) draw(); };
    stageOpts.onDrag = also(stageOpts.onDrag);
    stageOpts.onZoom = also(stageOpts.onZoom);

    const stage = global.Stage.create(canvas, stageOpts);

    /* ---- the loop ----
     * Gated on visibility, and `visible` is the authority: start() sets the
     * intent, the observer sets whether it may run. */
    let raf = 0, last = 0, wanted = false, visible = true, dead = false;

    function draw() {
      if (opts.frame) opts.frame();
      stage.applyCam();
      stage.renderer.render(stage.scene, stage.camera);
      if (opts.afterFrame) opts.afterFrame();
    }

    function tick(now) {
      if (!wanted || !visible || dead) return;
      raf = requestAnimationFrame(tick);
      const dt = last ? Math.min((now - last) / 1000, 0.1) : 0.016;
      last = now;
      if (opts.step) opts.step(dt);
      draw();
    }

    /* One step and one render, by hand. A backgrounded tab pauses rAF, so an
     * automated screenshot otherwise catches whatever frame the loop stopped
     * on — CLAUDE.md's standing browser trap. Drive this instead of trusting a
     * shot. Not part of the loop, and it does not start or stop one. */
    function pump(dt) {
      if (dead) return;
      if (opts.step) opts.step(Math.min(dt === undefined ? 0.016 : dt, 0.1));
      draw();
    }

    function start() {
      if (dead) return;
      wanted = true;
      if (raf || !visible) return;
      last = 0;                          // a resumed box must not integrate the gap
      raf = requestAnimationFrame(tick);
    }

    /* A PNG of what the box currently shows, for a card that is about to lose
     * its stage. Renders first and reads in the same turn deliberately: without
     * `preserveDrawingBuffer` the drawing buffer is only guaranteed readable
     * until the compositor takes it, so a toDataURL a frame later comes back
     * blank. The cost of preserving it on every card instead is paid by every
     * frame of every live one, to serve the moment a card stops being live. */
    function snapshot() {
      if (dead) return null;
      draw();
      try { return canvas.toDataURL('image/png'); } catch (e) { return null; }
    }

    function stop() {
      wanted = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      // No clear: the last frame IS the card's thumbnail. See the header.
    }

    // The observer moves `visible` without touching `wanted`, so a card that
    // scrolls back into view resumes only if the page had asked it to run.
    const io = new IntersectionObserver(es => {
      const now = es.some(e => e.isIntersecting);
      if (now === visible) return;
      visible = now;
      if (visible && wanted) { last = 0; raf = requestAnimationFrame(tick); }
      else if (!visible && raf) { cancelAnimationFrame(raf); raf = 0; }
    }, { threshold: 0.01 });
    io.observe(canvas);

    /* THE ROOM A PANEL LEAVES. A lesson shell covers part of the canvas with
       glass, and a scene centred on the canvas is half under it. `viewOffset`
       is a function of the canvas size returning the pixel shift that
       centres the scene in what is left; the projection is offset, the
       canvas is not, so the scene still draws behind the glass. Applied on
       every resize, after Stage's own, and exposed as layout() for a page
       whose panel moved. */
    function layout() {
      const W = canvas.clientWidth, H = canvas.clientHeight;
      if (!W || !H) return;
      const off = opts.viewOffset ? opts.viewOffset(W, H) : null;
      if (off && (off.x || off.y)) stage.camera.setViewOffset(W, H, off.x || 0, off.y || 0, W, H);
      else if (stage.camera.view) stage.camera.clearViewOffset();
      stage.camera.updateProjectionMatrix();
    }
    const ro = new ResizeObserver(() => {
      stage.resize();                    // Stage has its own too; this one is ours
      layout();
      if (opts.onResize) opts.onResize();
      if (!raf) draw();                  // a paused box must re-frame, not stretch
    });
    ro.observe(canvas);

    stage.resize();
    layout();
    if (opts.onResize) opts.onResize();
    // One frame now, so the box is never blank in the gap before rAF runs — and
    // so a card created paused still shows its subject.
    draw();
    if (opts.autoplay !== false) start();

    return {
      canvas, stage,
      scene: stage.scene, camera: stage.camera, renderer: stage.renderer,
      root: stage.root, cam: stage.cam, applyCam: stage.applyCam,
      start, stop, draw, pump, snapshot, layout,
      get running() { return !!raf; },
      get dead() { return dead; },
      destroy() {
        if (dead) return;
        dead = true;
        stop(); io.disconnect(); ro.disconnect();
        if (opts.onDestroy) opts.onDestroy();
        stage.renderer.dispose();
        // dispose() alone does NOT hand the context back — the header's first
        // trap, and the half kit/molbox.js was missing before it moved here.
        // The browser may have taken the context already, over its own cap on
        // live ones; asking a lost context to lose itself is an INVALID_OPERATION
        // in the console and nothing else, so check before asking.
        const gl = stage.renderer.getContext();
        if (gl && !gl.isContextLost()) {
          const lose = gl.getExtension('WEBGL_lose_context');
          if (lose) lose.loseContext();
        }
        if (canvas.parentElement) canvas.parentElement.removeChild(canvas);
      },
    };
  }

  /* ---- the budget of boxes ----------------------------------------------
   * Least-recently-acquired eviction. `acquire` is also "bring to front": a
   * card the reader keeps returning to is by definition not the one to drop.
   * The pool destroys, it does not stop — a stopped box still holds its
   * context, and the context is the scarce thing this exists to ration.
   *
   * `onEvict(key, box)` fires BEFORE the destroy, with the box still live, so a
   * card can take its own `snapshot()` on the way out. Firing it after would
   * hand back a corpse, and the one thing a caller wants at that moment is the
   * picture — the reason a reader tolerates a card going quiet is that it does
   * not go blank. It fires on EVERY way out — evicted, released, cleared —
   * because the caller's handle is dead in all three and only this says so. */

  function pool(opts = {}) {
    const limit = opts.limit || 4;
    const live = new Map();              // key → box, in acquisition order

    function evict() {
      while (live.size > limit) {
        const [key, box] = live.entries().next().value;
        live.delete(key);
        if (opts.onEvict) opts.onEvict(key, box);
        box.destroy();
      }
    }

    return {
      limit,
      get size() { return live.size; },
      has: key => live.has(key),
      get: key => live.get(key) || null,
      keys: () => Array.from(live.keys()),

      // `build` is called only on a miss. On a hit the key is re-inserted, which
      // is what moves it to the young end of the Map's iteration order.
      acquire(key, build) {
        const hit = live.get(key);
        if (hit) { live.delete(key); live.set(key, hit); return hit; }
        const box = build();
        live.set(key, box);
        evict();
        return box;
      },

      release(key) {
        const box = live.get(key);
        if (!box) return false;
        live.delete(key);
        if (opts.onEvict) opts.onEvict(key, box);
        box.destroy();
        return true;
      },

      // Fires onEvict too, like release: every path out of the pool has to tell
      // the caller, or a card keeps a handle to a destroyed box and quietly
      // stops responding to clicks — it calls start() on a corpse and never
      // asks for a new one. Found exactly that way.
      clear() {
        for (const [key, box] of live) {
          if (opts.onEvict) opts.onEvict(key, box);
          box.destroy();
        }
        live.clear();
      },
    };
  }

  global.CardStage = { create, pool };
})(typeof globalThis !== 'undefined' ? globalThis : this);
