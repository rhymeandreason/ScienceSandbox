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
 *  · ANNOTATIONS GO IN `view`, NOT THE FRAME. annotate.js projects into
 *    `stageEl.clientWidth/Height` (its own Trap 3), so handing it the
 *    framed box would scale every dot by the caption row's height — a few
 *    percent, worst at the ends of the molecule, and invisible until you
 *    look closely at a label near the bottom. `view` is the element whose
 *    box IS the canvas's; the constructor measures the two and says so out
 *    loud when they disagree, because nothing offline can see this.
 *
 *  · `afterFrame` RUNS AFTER THE RENDER, the same name and the same rule as
 *    kit/stagekit.js: anything pinning DOM to a 3D point belongs there,
 *    because before the render it reads the previous frame's camera. This
 *    module owns its own loop, so without the hook a page has nowhere to
 *    step a callout at all.
 *
 *  · THE LEADER IS THE OTHER HALF OF THE FRAME. A framed box says "this is
 *    a window"; only the leader says WHICH thing it is a window onto. Two
 *    lines from the frame's silhouette corners down to a marked point — the
 *    exploded view every figure uses. The module owns the GEOMETRY (which
 *    two corners face the target, and it is whichever pair spans the widest
 *    angle from it, so the wedge is right for a box in any corner). The
 *    page owns WHICH thing and how to project it, because only the page has
 *    the other camera — this module's camera looks at the close-up, never
 *    at the scene the close-up came from.
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

    /* The element whose box is exactly the canvas's, for anything projecting
       DOM onto a 3D point. Defaults to the canvas's parent, which is the
       `.inset-view` row in main.css's component. */
    const view = opts.view || canvas.parentElement;

    /* The framed box itself, which is what a leader points FROM. `.inset` is
       main.css's component and this module's header already names it. */
    const frame = opts.frame || (canvas.closest && canvas.closest('.inset')) ||
                  (view && view.parentElement);

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
      _radii = null;                      // a resize may have swapped the rule
      if (!ext) return;
      stage.resize();
      global.Stage.frame(stage.camera, stage.cam,
        [{ x: 0, y: 0, rxz: ext.rxz, hy: ext.hy }],
        { pad: opts.pad || 1.15 });
      stage.applyCam();
    }

    /* ---- the leader ----
     * opts.leader = { host, at() -> [xPx, yPx] in host's box, or null }
     * The page projects, because the scene's camera is the page's. */
    const NS = 'http://www.w3.org/2000/svg';
    let svg = null, wedge = null, mark = null;
    if (opts.leader && opts.leader.host) {
      svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('class', 'inset-leader');
      wedge = document.createElementNS(NS, 'path');
      wedge.setAttribute('class', 'inset-leader-wedge');
      mark = document.createElementNS(NS, 'circle');
      mark.setAttribute('class', 'inset-leader-mark');
      mark.setAttribute('r', String(opts.leader.markR || 7));
      svg.appendChild(wedge); svg.appendChild(mark);
      opts.leader.host.appendChild(svg);
    }

    /* Cached: getComputedStyle every frame for four properties is real work,
       and a radius only changes when the stylesheet does. fit() refreshes it,
       which is also when a responsive rule would have swapped it. */
    let _radii = null;
    function radii() {
      if (_radii) return _radii;
      const cs = getComputedStyle(frame);
      _radii = [cs.borderTopLeftRadius, cs.borderTopRightRadius,
                cs.borderBottomRightRadius, cs.borderBottomLeftRadius]
        .map(v => parseFloat(v) || 0);
      return _radii;
    }

    function drawLeader() {
      if (!svg) return;
      const p = frame && !frame.hidden ? opts.leader.at() : null;
      if (!p) { svg.style.display = 'none'; return; }
      svg.style.display = '';
      const h = opts.leader.host.getBoundingClientRect();
      const f = frame.getBoundingClientRect();
      const x0 = f.left - h.left, y0 = f.top - h.top;
      /* ONTO THE ARC, not the mathematical corner. The frame is rounded, so
         a line drawn to the sharp corner ends in the empty square outside
         the curve and visibly overshoots — the leader is UNDER the frame, so
         the box hides the overshoot everywhere except exactly there. Moving
         the endpoint inward along the diagonal by r(1 - 1/root2) lands it on
         the nearest point of the corner arc. The radius is READ from the
         frame's computed style: it is a design-system value in main.css, and
         a copy typed here would not follow it. */
      const k = 1 - Math.SQRT1_2;
      const R = radii(), W = f.width, H = f.height;
      const corners = [
        [x0 + R[0] * k,     y0 + R[0] * k],          // top-left
        [x0 + W - R[1] * k, y0 + R[1] * k],          // top-right
        [x0 + W - R[2] * k, y0 + H - R[2] * k],      // bottom-right
        [x0 + R[3] * k,     y0 + H - R[3] * k],      // bottom-left
      ];
      /* THE TWO SILHOUETTE CORNERS, found by angle rather than by asking
         which side the target is on: a box in any corner of any stage gets
         the right pair, including when the target is diagonally away and the
         answer is one corner from each edge. Angles are measured relative to
         the frame's centre so the ±pi seam is never inside the span. */
      const cx = x0 + f.width / 2, cy = y0 + f.height / 2;
      const base = Math.atan2(cy - p[1], cx - p[0]);
      let lo = corners[0], hi = corners[0], loA = Infinity, hiA = -Infinity;
      for (const c of corners) {
        let a = Math.atan2(c[1] - p[1], c[0] - p[0]) - base;
        while (a > Math.PI) a -= 2 * Math.PI;
        while (a < -Math.PI) a += 2 * Math.PI;
        if (a < loA) { loA = a; lo = c; }
        if (a > hiA) { hiA = a; hi = c; }
      }
      wedge.setAttribute('d',
        'M' + lo[0].toFixed(1) + ',' + lo[1].toFixed(1) +
        'L' + p[0].toFixed(1) + ',' + p[1].toFixed(1) +
        'L' + hi[0].toFixed(1) + ',' + hi[1].toFixed(1));
      mark.setAttribute('cx', p[0].toFixed(1));
      mark.setAttribute('cy', p[1].toFixed(1));
    }

    function draw() {
      if (spin) { stage.cam.theta += spin; stage.applyCam(); }
      stage.renderer.render(stage.scene, stage.camera);
      drawLeader();
      if (opts.afterFrame) opts.afterFrame();
    }

    function tick() { if (!running) return; raf = requestAnimationFrame(tick); draw(); }
    function start() { if (running) return; running = true; raf = requestAnimationFrame(tick); }
    function stop() {
      running = false; if (raf) cancelAnimationFrame(raf); raf = 0;
      // The leader is drawn from the loop, so stopping would otherwise freeze
      // it wherever it last was — pointing at nothing, over a hidden box.
      if (svg) svg.style.display = 'none';
    }

    const ro = new ResizeObserver(fit); ro.observe(canvas);
    /* Visibility drives the loop, so a caller that never calls stop() still
     * does not burn a frame on a box behind a closed step. `start()` called
     * by hand on a hidden canvas is honoured until the observer disagrees —
     * the observer is the fallback, not the authority. */
    const io = new IntersectionObserver(es => {
      es.forEach(e => e.isIntersecting ? start() : stop());
    }, { threshold: 0.01 });
    io.observe(canvas);

    /* Said out loud, because the symptom is a callout a few pixels off rather
       than anything that looks like an error. Measured after the first fit, so
       the boxes are the ones the browser settled on. */
    if (view && view !== canvas) {
      const dw = Math.abs(view.clientWidth - canvas.clientWidth);
      const dh = Math.abs(view.clientHeight - canvas.clientHeight);
      if (dw > 1 || dh > 1) console.warn(
        'kit/inset.js: `view` is ' + view.clientWidth + 'x' + view.clientHeight +
        ' but the canvas is ' + canvas.clientWidth + 'x' + canvas.clientHeight +
        ' — anything projected into it will be skewed. Wrap the canvas in an ' +
        'element whose box is the canvas\'s (main.css `.inset-view`).');
    }

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
      get view() { return view; },
      get frame() { return frame; },
      destroy() {
        stop(); ro.disconnect(); io.disconnect();
        if (svg && svg.parentNode) svg.parentNode.removeChild(svg);
        if (group) stage.root.remove(group);
        stage.renderer.dispose();          // the context, actually released
      },
    };
  }

  global.Inset = { create };
})(this);
