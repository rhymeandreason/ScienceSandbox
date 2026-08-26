/* =============================================================================
 *  kit/proteinbox.js — Proteinbox: a card that shows a deposited protein
 * =============================================================================
 *  kit/molbox.js draws a molecule built from a spec. This draws one measured in
 *  a lab: real angstroms, from files a baker wrote, in a scene of its own —
 *  which is what lets it BE angstroms, since one scale family per SCENE
 *  (MolecularGeometry.md 1.5) and the cards beside it are the small-molecule
 *  family.
 *
 *  Three things it can show, and only the first is free:
 *
 *    ribbon   12 KB trace, tools/bake-trace.js       drawn on create
 *    surface  ~360 KB SES, tools/bake-card-surface.js  fetched on the click
 *    fold     ~830 KB trajectory, HbFold + FoldPlay    fetched on the click
 *
 *  THE GATES ARE THE DESIGN. A card is a thumbnail until a reader decides
 *  otherwise, and neither of the big two is ever something the box DOES to
 *  someone who scrolled past it: the bytes are asked for on the click, the
 *  ribbon stays up until they land, and the loop runs only while the fold is
 *  showing. The page adds the third gate — whether the controls are reachable
 *  at this zoom at all — because only the page knows how big its card is on
 *  screen. door-map does that with `.near`.
 *
 *  ONE DECODED SURFACE ACROSS EVERY BOX, for the same reason kit/card-stage.js
 *  rations contexts: 360 KB of quantised mesh becomes several MB of GPU
 *  buffers, and the LRU rations contexts, not what a page hangs off one. A box
 *  that loses its surface falls back to the ribbon it never removed.
 *
 *  WHAT IT DOES NOT OWN. Anything about the page around it: no lesson button,
 *  no modal, no `.near`. It owns the molecule and the two questions a reader
 *  can ask of it.
 *
 *  NO `cache:'force-cache'` ON ANY OF THESE FETCHES. It reads as the right
 *  thing to ask for — the files never change — but the dev server sends
 *  `no-store` so a reload never serves a stale page, and WebKit fails a
 *  force-cache request for a no-store resource outright rather than falling
 *  back to the network. Safari-only, and it presents as a box that never draws.
 *  Ordinary caching already does the job: these are static files with real
 *  cache headers in production, and the second box asking for one gets it from
 *  the memory cache anyway.
 *
 *  Every library is read by its BARE name, not off `global`: folding/ribbon.js
 *  publishes `const RibbonLib` at script top level, which is script scope and
 *  never a property of window — `global.RibbonLib` is undefined, and only at
 *  the moment a card tries to draw.
 *
 *  Needs, in load order: THREE, lib/scene.js, folding/ribbon.js,
 *  kit/card-stage.js. And only for the option that uses it —
 *  hemoglobin/surface.js for `surface`, hemoglobin/hbfold.js +
 *  hemoglobin/foldplay.js for `fold`.
 *
 *    const box = Proteinbox.create({
 *      mount, trace:'…/2HHB.trace.json',       // or data: a parsed one
 *      chains:'B',                             // default: every chain in the file
 *      surface:'…/2HHB.card.surf.bin',         // omit and there is no toggle
 *      fold:'…/2HHB-B.fold.bin',               // omit and there is no play button
 *    });
 *
 *  `data:` is `trace:` already parsed — same object, no fetch — for a page
 *  whose coordinates arrive as something the box does not read. It does not
 *  read PDB and should not learn to: parsing decides which altloc, which
 *  chain, and whether secondary structure is read or detected, and a page
 *  that owns a protein already owns those. What is shared is the box.
 *
 *  `colors:` overrides the ss palette — one number for a flat colour, or
 *  {C,H,E} for some of it. Omit it and every protein in the repo is drawn the
 *  same way, which is the default for a reason.
 *
 *  Returns kit/card-stage.js's box, so a pool's acquire / snapshot / destroy
 *  work on it unchanged, plus `drop()` (back to ribbon, release the surface),
 *  `setData(t)` (draw a different structure in the same box, keeping the
 *  camera) and `rep` for a caller that wants to know what is showing.
 * ============================================================================= */
(function (global) {
  'use strict';

  /* Coil, helix, strand — folding/ribbon-test.html's, so a card and the bench
     that tunes the ribbon are never two opinions about the same helix. */
  const RIB = { C: 0x7d8c7a, H: 0x0042aa, E: 0xc2571b };
  const SES_COLOUR = 0xdfe4ee;

  let sesOwner = null;              // the one box holding a decoded surface

  /* Checked rather than assumed: a library that is not there yet shows up as an
     empty box, which reads as a module with no stage — the wrong story, and one
     nobody can see is wrong. Bare `typeof` because classic scripts share one
     global lexical scope, which is where ribbon.js's `const RibbonLib` lives:
     it is never a property of window, so `global.RibbonLib` would say missing
     on a page that has it. */
  function missing() {
    const gaps = [];
    if (typeof THREE === 'undefined') gaps.push('three.min.js');
    if (typeof Stage === 'undefined') gaps.push('lib/scene.js');
    if (typeof CardStage === 'undefined') gaps.push('kit/card-stage.js');
    if (typeof RibbonLib === 'undefined') gaps.push('folding/ribbon.js');
    return gaps;
  }

  function create(opts) {
    const gaps = missing();
    if (gaps.length) {
      console.warn('Proteinbox needs ' + gaps.join(', ') + ' loaded before it');
      return null;
    }

    const mount = opts.mount;
    let radius = 0, player = null, surf = null, rep = 'ribbon';
    let stillMid = null, stillR = 0, foldR = 0;

    /* AN ORTHO CAMERA DOES NOT ZOOM BY MOVING: its size is its frustum, so a
       cam.r written straight onto the camera does nothing and the protein is
       drawn against THREE's constructor frustum, top = 1 — a 33 A molecule in a
       2 A frame, which fills the box with one lobe of one helix. Stage.frame's
       ortho branch writes the frustum and leaves cam.r alone, so the answer is
       read back, or the first wheel event jumps the card. Same shape as
       molbox's fit() and the same reason; it re-runs from onResize because the
       aspect it solved against is gone the moment a card grows. */
    const fit = () => {
      if (!radius || !mount.clientWidth || !mount.clientHeight) return;
      box.stage.resize();
      Stage.frame(box.camera, box.cam,
                         [{ x: 0, y: 0, rxz: radius, hy: radius }],
                         { pad: opts.pad || 1.12 });
      if (box.camera.isOrthographicCamera) box.cam.r = box.camera.top;
      box.applyCam();
    };

    const box = CardStage.create({
      mount,
      cam: { theta: 0.6, phi: 1.1, r: 40 },
      /* orbit:false by default — on a map, a drag on this canvas is a drag on
         the card, and a molecule that spins under the pointer leaves a reader
         who meant to move the card with no way back to the framing it was
         composed with. A page that wants the turn passes orbit:true. */
      stage: Object.assign({ ortho: true, orbit: opts.orbit === true },
                           opts.stage || {}),
      autoplay: false,                 // a still ribbon has nothing to run
      step: dt => { if (player && rep === 'fold') player.tick(dt); },
      onResize: fit,
      onDestroy: () => { if (sesOwner === box) sesOwner = null; },
    });

    /* Two groups, never both visible. The trajectory is in FoldLib.orient()'s
       frame and the trace is in the crystal's, so they are not the same
       molecule in the same place; the box re-centres on whichever is showing,
       which is what makes drawing them from two frames legal. */
    const chainGroup = new THREE.Group();
    const foldGroup = new THREE.Group();
    box.root.add(chainGroup, foldGroup);

    /* ---- the ribbon ----

       TWO WAYS IN, ONE SHAPE OF DATA. `trace:` fetches a bake-trace.js file;
       `data:` hands the same object over directly, already parsed. A page
       whose coordinates arrive as something else — a PDB it reads with its
       own module, a format nobody has written yet — parses it however it
       likes and calls setData().

       The box deliberately does NOT learn to read those formats. Parsing
       carries decisions this file has no business making (which altloc, which
       chain, whether secondary structure is read or detected), and every page
       that owns a protein already owns them. What is shared here is the box:
       the scene, the camera, the framing and the turn. */
    function setData(t, o) {
      o = o || {};
      chainGroup.clear();
      const ids = (o.chains || opts.chains)
        ? String(o.chains || opts.chains).split(',') : t.order.slice();

      /* Colour. Default is the ss palette, which is the point of drawing every
         protein in the repo the same way. A page that colours by something
         else — a state, a mutation, a chain — passes `colors`, and one colour
         means all three. */
      const c = o.colors || opts.colors;
      const pal = c == null ? RIB
        : (typeof c === 'number' ? { C: c, H: c, E: c }
                                 : Object.assign({}, RIB, c));
      const mats = [pal.C, pal.H, pal.E].map(v => {
        const m = Stage.bondMat(v);
        m.side = THREE.DoubleSide;
        return m;
      });

      const drawn = [];
      /* One chain per frame. A tetramer is ~80k triangles and building all
         four in the frame the trace lands is a visible stall on a page that
         is usually animating something when it arrives. */
      const build = () => {
        const cid = ids.shift();
        if (cid === undefined || box.dead) return;
        const ch = t.chains[cid];
        if (ch) {
          for (const seg of runs(ch)) {
            if (seg.CA.length < 4) continue;   // RibbonLib needs a spline's worth
            const pts = seg.CA.map(p => new THREE.Vector3(p[0], p[1], p[2]));
            drawn.push(...pts);
            chainGroup.add(new THREE.Mesh(
              RibbonLib.build(THREE, pts, seg.ss,
                              { sub: opts.sub == null ? 6 : opts.sub }), mats));
          }
          /* The trace is centred on every chain it HOLDS, so a box drawing
             one of four would sit off to the side. Re-centre on what is
             actually drawn, and re-solve after each — every chain changes
             both the centre and the radius. */
          if (drawn.length) {
            stillMid = drawn.reduce((acc, p) => acc.add(p), new THREE.Vector3())
                            .multiplyScalar(1 / drawn.length);
            stillR = 0;
            for (const p of drawn) stillR = Math.max(stillR, p.distanceTo(stillMid));
            if (rep === 'ribbon') reframeStill();
          }
          box.draw();
        }
        if (ids.length) requestAnimationFrame(build);
      };
      build();
    }

    /* A chain is drawn as one ribbon per CONSECUTIVE RUN of residues. Without
       `nums` a trace cannot say where it breaks, so it is treated as
       contiguous — which is what every trace baked before bake-trace.js
       started writing them says, and the honest reading of a file that does
       not carry the information. */
    function runs(ch) {
      const n = ch.ss.length, ss = ch.ss;
      if (!ch.nums) return [{ CA: ch.CA, ss: ss.split('') }];
      const out = [];
      let from = 0;
      for (let i = 1; i <= n; i++) {
        if (i === n || ch.nums[i] !== ch.nums[i - 1] + 1) {
          out.push({ CA: ch.CA.slice(from, i), ss: ss.slice(from, i).split('') });
          from = i;
        }
      }
      return out;
    }

    if (opts.data) setData(opts.data);
    else if (opts.trace) {
      fetch(opts.trace)
        .then(r => r.json())
        .then(t => { if (!box.dead) setData(t); })
        /* Loud, not silent. A swallowed catch here is a box that shows its
           placeholder for ever and looks exactly like a module with no stage
           yet — the one failure this file can produce that nobody can see. */
        .catch(e => console.warn('Proteinbox: ' + opts.trace + ' — ' + e.message));
    }

    function reframeStill() {
      if (!stillMid) return;
      box.root.position.copy(stillMid).negate();
      radius = stillR;
      fit();
    }

    /* ---- the surface ---- */
    function dropSurface() {
      if (!surf) return;
      box.root.remove(surf);
      surf.geometry.dispose();
      surf = null;
      if (sesOwner === box) sesOwner = null;
    }

    function showSurface() {
      if (surf) { surf.visible = true; box.draw(); return; }
      busy(true);
      fetch(opts.surface)
        .then(r => r.arrayBuffer())
        .then(buf => {
          if (box.dead) return;
          if (sesOwner && sesOwner !== box) sesOwner.drop();
          const S = SurfLib.decode(THREE, buf);
          surf = new THREE.Mesh(S.geo, new THREE.MeshStandardMaterial({
            color: opts.surfaceColour || SES_COLOUR,
            roughness: 0.45, metalness: 0.0, side: THREE.FrontSide,
          }));
          box.root.add(surf);
          sesOwner = box;
          box.draw();
        })
        .catch(() => setRep('ribbon'))
        .then(() => busy(false));
    }

    /* ---- the fold ---- */
    function showFold() {
      if (player) { player.mesh.visible = true; reframeFold(); box.start(); return; }
      busy(true);
      fetch(opts.fold)
        .then(r => r.arrayBuffer())
        .then(buf => {
          if (box.dead) return;
          player = FoldPlay.create(THREE, HbFold.decode(buf), {
            /* Well under the lesson's sub 6: the ribbon is rebuilt as it plays
               and the cost of a rebuild is the triangle count. */
            sub: opts.foldSub == null ? 3 : opts.foldSub,
            speed: opts.foldSpeed == null ? 0.16 : opts.foldSpeed,
            material: Stage.bondMat(RIB.H),
          });
          foldGroup.add(player.mesh);
          reframeFold();
          box.start();
        })
        .catch(() => setRep('ribbon'))
        .then(() => busy(false));
    }

    function reframeFold() {
      if (!player) return;
      player.mesh.geometry.computeBoundingSphere();
      foldGroup.position.copy(player.mesh.geometry.boundingSphere.center).negate();
      /* Framed on the FINAL fold, not on this instant: a chain that starts
         extended and ends compact would otherwise zoom out through the whole
         animation, which reads as the camera folding rather than the protein. */
      if (!foldR) {
        const t = player.t;
        player.seek(1);
        player.mesh.geometry.computeBoundingSphere();
        foldR = player.mesh.geometry.boundingSphere.radius;
        player.seek(t);
      }
      radius = foldR;
      box.root.position.set(0, 0, 0);
      fit();
    }

    /* ---- the controls ----
       Two of them, because they are two kinds of thing. Ribbon and surface are
       REPRESENTATIONS — one molecule drawn two ways, which is what a segmented
       pair says. The fold is an EVENT: it starts, it runs, it ends, and a play
       button is what says that. In the same row of segments it would have
       claimed the fold was a third way of drawing the same still.
       Look is kit/proteinbox.css's; a page that wants them somewhere else
       restyles `.pbox-rep` and `.pbox-play` rather than rebuilding them. */
    const controls = [];
    const bar = document.createElement('div');
    bar.className = 'pbox-rep';
    const reps = ['ribbon'];
    if (opts.surface) reps.push('surface');
    const btns = reps.map(name => {
      const b = document.createElement('button');
      b.type = 'button'; b.dataset.rep = name; b.textContent = name;
      b.addEventListener('click', e => { e.stopPropagation(); setRep(name); });
      bar.appendChild(b);
      controls.push(b);
      return b;
    });
    if (reps.length > 1) mount.appendChild(bar);

    let play = null;
    if (opts.fold) {
      play = document.createElement('button');
      play.type = 'button';
      play.className = 'pbox-play';
      play.textContent = '▶';
      play.title = 'play the fold';
      play.addEventListener('click', e => {
        e.stopPropagation();
        setRep(rep === 'fold' ? 'ribbon' : 'fold');
      });
      mount.appendChild(play);
      controls.push(play);
    }

    // Disabled while bytes are in flight, so a second click cannot start a
    // second fetch of the same file.
    const busy = on => controls.forEach(b => { b.disabled = on; });

    function setRep(next) {
      rep = next;
      btns.forEach(b => b.classList.toggle('on', b.dataset.rep === rep));
      chainGroup.visible = rep === 'ribbon';
      if (surf) surf.visible = rep === 'surface';
      if (player) player.mesh.visible = rep === 'fold';
      if (rep !== 'fold') box.stop();
      if (play) {
        play.textContent = rep === 'fold' ? '■' : '▶';
        play.title = rep === 'fold' ? 'stop' : 'play the fold';
        play.classList.toggle('on', rep === 'fold');
      }
      if (rep === 'ribbon') { reframeStill(); box.draw(); }
      else if (rep === 'surface') showSurface();
      else showFold();
      if (opts.onRep) opts.onRep(rep);
    }
    setRep('ribbon');

    box.drop = () => { setRep('ribbon'); dropSurface(); };

    /* Replace what is drawn without replacing the box. A page that switches
       between structures keeps one WebGL context, one camera and one turn,
       which is the whole reason the box is shared: the reader's viewpoint
       survives the switch instead of snapping back on every click. */
    box.setData = setData;
    Object.defineProperty(box, 'rep', { get: () => rep });
    return box;
  }

  global.Proteinbox = { create, RIB };
})(this);
