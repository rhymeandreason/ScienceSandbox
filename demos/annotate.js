/* =====================================================================
 *  annotate.js — callouts pinned to a point on a 3D model.
 *
 *  A label with a leader dot that names part of a molecule: "Iron (Fe) —
 *  binds O2", "Heme group". The callout every textbook figure has.
 *
 *  WHAT THIS OWNS AND WHAT IT DOES NOT (SCIENCE.md 6). It owns how a
 *  callout LOOKS and how it TRACKS: the dot, the leader, the type, the
 *  three reveal modes, the projection maths. It owns nothing about what a
 *  callout says or where it points — that is the lesson, and it stays in
 *  the page. The test the section sets is "would two lessons disagree
 *  about it?", and the answer here splits cleanly: a student must not have
 *  to learn a second annotation vocabulary on the second tab, and no two
 *  pages will ever want to label the same atom.
 *
 *  ---- ANCHORS ARE SEMANTIC, WHICH IS THE WHOLE POINT ------------------
 *
 *  `at` may be a fixed point, but it is meant to be a FUNCTION returning
 *  one, and every moving model should pass a function. The label then
 *  follows whatever the page recomputes each frame — a folding chain, a
 *  sliding subunit, a heme riding its chain in — because the anchor is
 *  "wherever atom N is now" rather than a position captured at build time.
 *
 *  NEVER capture the point at build time. Baking an anchor — a coordinate,
 *  or a spot on the mesh — is what a viewer has to do when it is handed an
 *  opaque asset, and it is wrong here: every model on this site is built
 *  from named atoms that move, so a baked point comes adrift the moment
 *  the thing it names does anything.
 *
 *  ---- DOM, NOT SPRITES ------------------------------------------------
 *
 *  The labels are absolutely-positioned HTML over the canvas, not textures
 *  in the scene. A canvas sprite bakes whatever font is loaded at draw
 *  time — atomkit.js carries a whole comment about redrawing once the
 *  webfonts settle — and it resamples badly as the camera pulls in. DOM
 *  gets the house type from sandbox.css for free, stays crisp at every
 *  zoom, and can be read by a screen reader. The cost is that the layer
 *  cannot be occluded by geometry, which is not a cost: a label
 *  half-swallowed by the atom it names reads as a rendering fault. These
 *  are annotation OVER the scene, deliberately.
 *
 *  Labels are still depth-SORTED against each other by z-index, so two
 *  callouts that overlap stack the way the model does.
 *
 *  ---- THE THREE TRAPS -------------------------------------------------
 *
 *  1. step() BELONGS IN THE RENDER LOOP, not in whatever advances your
 *     animation. Orbiting and zooming move the camera without advancing
 *     anything, and a label that only updates when the model does shears
 *     off its atom the moment the user drags. Same rule as
 *     hemoglobin-lab's pearls, for the same reason.
 *
 *  2. THE LAYER MUST NOT EAT THE MOUSE. It covers the whole stage, so it
 *     is pointer-events:none, and only the dots turn pointer events back
 *     on — and only in 'click' mode. Get this wrong and orbit dies with no
 *     visible cause, because the thing swallowing the drag is invisible.
 *
 *  3. PROJECT IN CSS PIXELS. camera.project gives normalised coordinates;
 *     turning those into a position means the element's CSS box
 *     (clientWidth/Height), never canvas.width/height, which on a retina
 *     screen is twice that and puts every label off the bottom right.
 *
 *  ---- REVEAL MODES ----------------------------------------------------
 *
 *    'on'      every label visible. The figure-caption mode.
 *    'click'   dots only; clicking one opens its label, clicking again
 *              closes it. For a crowded model where all-on is soup.
 *    'reveal'  play() runs them in as a staggered wipe, left to right
 *              across the screen, each one rising into place. For a page
 *              that wants the naming to be an EVENT — the same sweep
 *              hemoglobin-lab uses for its residue pearls, so the two read
 *              as the same gesture.
 *
 *  The mode is a property of the layer and can be changed at any time.
 *  'reveal' finishes in the 'on' state: the wipe is how the labels ARRIVE,
 *  not a state they stay in.
 *
 *  How they LEAVE is show(false) or fade(x), and those are different
 *  things on purpose. show() is the switch a student flicks: these do not
 *  apply here. fade() is the dimmer a page drives: these are on their way
 *  out because the subject is changing. They multiply, and either reaching
 *  zero drops the layer out of the document — which is also what stops a
 *  faded-out callout catching clicks in 'click' mode. There is deliberately
 *  no staggered EXIT to match the wipe: arriving is an event worth making,
 *  leaving is the page moving on, and animating both makes the second one
 *  look like the first.
 *
 *  ---- USE -------------------------------------------------------------
 *
 *    const notes = Annot.create(THREE, document.getElementById('stage'),
 *                               camera, { mode:'on' });
 *    notes.add({ text:'Iron (Fe)', at:() => hemeFe(), tone:'iron' });
 *    ...
 *    notes.step();                    // in the render loop, before render
 *
 *  Load after scene.js; no dependency on MolLib, and it never sees SCALE —
 *  it is given world points and asks nothing about what they mean.
 * ===================================================================== */
'use strict';

window.Annot = (function () {

  const MODES = ['on', 'click', 'reveal'];

  /* The wipe. Matched to hemoglobin-lab's pearl reveal, because a page
     showing both should not look like it has two different ideas of how
     things arrive. */
  const SWEEP = 0.55;      // seconds for the stagger to cross the screen
  const RISE  = 0.34;      // seconds one label takes to come in
  const LIFT  = 14;        // px it travels up on the way

  function create(THREE, stageEl, camera, opts) {
    opts = opts || {};
    const layer = document.createElement('div');
    layer.className = 'annot-layer';
    /* Trap 2. The layer is the size of the stage; if it took pointer
       events the user could never orbit again. */
    layer.style.pointerEvents = 'none';
    stageEl.appendChild(layer);

    const notes = [];
    const _v = new THREE.Vector3();
    let mode = 'on';
    let visible = opts.visible !== false;
    let alpha = opts.alpha === undefined ? 1 : opts.alpha;
    let revealT0 = -1;

    /* ---- the fan ----
       THE DOT IS THE TRUTH AND THE LABEL IS THE TYPESETTING. A dot sits
       exactly on its anchor and never moves; the label is pushed off by a
       fixed screen-space offset and joined back by a drawn leader. This is
       not decoration, it is the only way two callouts on one 10 A group
       are readable at all — anchored strictly, a label on the iron and one
       on the ring holding it land within forty pixels of each other and
       the top one hides the other.

       `offset` is [dx, dy] in CSS pixels from the dot. dx<0 puts the label
       on the left and flips the leader with it. The leader's length and
       angle are solved from the offset ONCE, here, because the offset is
       screen-space and constant — recomputing it per frame would burn a
       trig call per label to arrive at the same number. */
    const SIDE_GAP = 18;         // px from the dot to the label's near edge

    function add(spec) {
      const el = document.createElement('div');
      el.className = 'annot' + (spec.tone ? ' annot-' + spec.tone : '');

      const off = spec.offset || [0, 0];
      const dx = (off[0] || 0) + (off[0] < 0 ? -SIDE_GAP : SIDE_GAP);
      const dy = off[1] || 0;
      if (dx < 0) el.classList.add('annot-left');
      el.style.setProperty('--adx', dx + 'px');
      el.style.setProperty('--ady', dy + 'px');
      el.style.setProperty('--alen', Math.hypot(dx, dy).toFixed(1) + 'px');
      el.style.setProperty('--aang', (Math.atan2(dy, dx) * 180 / Math.PI).toFixed(2) + 'deg');

      const dot = document.createElement('button');
      dot.className = 'annot-dot';
      dot.type = 'button';
      dot.setAttribute('aria-label', spec.text);

      const leader = document.createElement('span');
      leader.className = 'annot-leader';

      const label = document.createElement('span');
      label.className = 'annot-label';
      label.textContent = spec.text;

      el.appendChild(leader); el.appendChild(dot); el.appendChild(label);
      layer.appendChild(el);

      const note = {
        el, dot, label,
        at: spec.at,
        open: spec.open !== false,     // 'click' mode starts them closed below
        delay: 0,
        set(text) { label.textContent = text; dot.setAttribute('aria-label', text); return note; },
        remove() {
          const i = notes.indexOf(note);
          if (i >= 0) notes.splice(i, 1);
          el.remove();
        },
      };

      dot.addEventListener('click', e => {
        if (mode !== 'click') return;
        e.stopPropagation();
        note.open = !note.open;
        el.classList.toggle('is-open', note.open);
      });

      notes.push(note);
      applyMode();
      return note;
    }

    /* Resolve an anchor to a world point. A function is the interesting
       case — see the header — but a Vector3 or a plain [x,y,z] is allowed
       for something genuinely fixed. */
    function anchor(a) {
      const p = (typeof a === 'function') ? a() : a;
      if (!p) return null;
      return Array.isArray(p) ? _v.set(p[0], p[1], p[2]) : _v.copy(p);
    }

    function applyMode() {
      layer.classList.toggle('is-click', mode === 'click');
      /* Trap 2 again: the dots are only clickable in the mode where
         clicking them means something. */
      layer.style.pointerEvents = 'none';
      for (const n of notes) {
        n.dot.style.pointerEvents = (mode === 'click') ? 'auto' : 'none';
        n.dot.tabIndex = (mode === 'click') ? 0 : -1;
        if (mode === 'click') { n.open = false; }
        else if (mode === 'on') { n.open = true; }
        n.el.classList.toggle('is-open', n.open);
      }
    }

    function setMode(m) {
      if (MODES.indexOf(m) < 0) throw new Error('annotate: unknown mode ' + m);
      mode = m;
      revealT0 = -1;
      applyMode();
      if (m === 'reveal') play();
      return api;
    }

    /* Stagger by where each label actually IS on screen, not by the order
       they were added — the sweep has to look like one gesture crossing
       the stage, and the add order is whatever the page found convenient.
       Re-seeded on every play() because the camera will have moved.

       BY RANK, NOT BY RAW X. Scaling each label's screen x straight into a
       delay works only when the labels are spread across the stage:
       callouts on ONE heme sit within a few percent of each other and all
       arrive on the same frame, so the stagger stops staggering exactly
       when the set is small enough to want it. Ranking spaces them evenly
       however tightly they cluster, and still runs left to right because
       the rank is by x. */
    function play() {
      revealT0 = performance.now() / 1000;
      const order = [];
      for (const n of notes) {
        const p = anchor(n.at);
        n.open = true;
        if (!p) { n.delay = 0; continue; }
        p.project(camera);
        order.push({ n, x: p.x });
      }
      order.sort((a, b) => a.x - b.x);
      const gap = order.length > 1 ? SWEEP / (order.length - 1) : 0;
      order.forEach((e, i) => { e.n.delay = i * gap; });
      return api;
    }

    /* show() is the switch, fade() is the dimmer, and they are separate
       because a page needs both: "these do not apply here" (a toggle a
       student flicks) and "these are on their way out" (a page taking them
       off as the subject changes). They multiply — fade(0.4) on a hidden
       layer stays hidden — and either one reaching zero drops the layer
       out of the document, which is also what stops a faded-out callout
       from still catching clicks in click mode. */
    function paint() {
      layer.style.opacity = alpha;
      layer.style.display = (visible && alpha > 0.002) ? '' : 'none';
    }
    function show(on) { visible = !!on; paint(); return api; }
    function fade(x) {
      alpha = x <= 0 ? 0 : x >= 1 ? 1 : x;
      paint();
      return api;
    }

    function step() {
      if (!visible || alpha <= 0.002) return;   // display:none — nothing to place
      /* Trap 3: the element's CSS box, never the canvas backing store. */
      const w = stageEl.clientWidth, h = stageEl.clientHeight;
      if (!w || !h) return;
      const now = performance.now() / 1000;
      const live = [];

      for (const n of notes) {
        const p = anchor(n.at);
        if (!p) { n.el.style.display = 'none'; continue; }
        /* Camera distance BEFORE projecting, because project() overwrites
           the vector — and it is the honest depth. See the sort below. */
        const depth = p.distanceTo(camera.position);
        p.project(camera);

        /* z outside [-1,1] is behind the camera or past the far plane:
           projecting it gives a mirrored point that lands somewhere
           plausible and completely wrong. */
        if (p.z < -1 || p.z > 1) { n.el.style.display = 'none'; continue; }
        n.el.style.display = '';

        let o = 1, lift = 0;
        if (mode === 'reveal') {
          if (revealT0 < 0) { o = 0; }
          else {
            const t = (now - revealT0 - n.delay) / RISE;
            o = t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
            lift = (1 - o) * LIFT;
          }
        }

        const x = (p.x + 1) / 2 * w;
        const y = (1 - p.y) / 2 * h + lift;
        n.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
        n.el.style.opacity = o;
        live.push({ n, depth });
      }

      /* Nearer labels on top — BY RANK, not by the projected z. Mapping
         p.z into a z-index band silently does nothing: perspective z is so
         nonlinear that everything more than a few molecule-widths out
         lands at 0.99-something, and labels on one heme come out
         identical. Ranking by true camera distance costs a sort of two. */
      live.sort((a, b) => b.depth - a.depth);
      live.forEach((e, i) => { e.n.el.style.zIndex = 100 + i; });
    }

    const api = {
      add, step, play, show, fade, setMode,
      clear() { while (notes.length) notes[0].remove(); return api; },
      get mode() { return mode; },
      get alpha() { return alpha; },
      get notes() { return notes.slice(); },
      el: layer,
    };
    if (opts.mode) setMode(opts.mode); else applyMode();
    paint();
    return api;
  }

  return { create, MODES };
})();
