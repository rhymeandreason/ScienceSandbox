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
 *  screen. The door map does that with `.near`.
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
 *  Every library is read by its BARE name, not off `global`: kit/ribbon.js
 *  publishes `const RibbonLib` at script top level, which is script scope and
 *  never a property of window — `global.RibbonLib` is undefined, and only at
 *  the moment a card tries to draw.
 *
 *  Needs, in load order: THREE, lib/scene.js, kit/ribbon.js,
 *  kit/card-stage.js. And only for the option that uses it —
 *  kit/surface.js for `surface`, hemoglobin/hbfold.js +
 *  hemoglobin/foldplay.js for `fold`.
 *
 *    const box = Proteinbox.create({
 *      mount, trace:'…/2HHB.trace.json',       // or data: a parsed one
 *      chains:'B',                             // default: every chain in the file
 *      surface:'…/2HHB.card.surf.bin',         // omit and there is no toggle
 *      fold:'…/2HHB-B.fold.bin',               // omit and there is no play button
 *    });
 *
 *  OR, by name, and then the registry answers all four:
 *
 *      Proteinbox.create({ mount, protein:'hemoglobin', base:'../' });
 *      Proteinbox.create({ mount, protein:'hemoglobin', variant:'2HBS' });
 *
 *  proteins/proteins.js names every artefact by ROLE — trace, card, fold —
 *  and check-proteins.js fails a role that is not on disk, so a caller
 *  rebuilding those names from a stem is standing a convention where a fact
 *  already is. An explicit path still wins, because hemoglobin-lab and the door
 *  map's VIEWS name files the registry has no role for.
 *
 *  `data:` is `trace:` already parsed — same object, no fetch — for a page
 *  whose coordinates arrive as something the box does not read. It does not
 *  read PDB and should not learn to: parsing decides which altloc, which
 *  chain, and whether secondary structure is read or detected, and a page
 *  that owns a protein already owns those. What is shared is the box.
 *
 *  `view:` is a 3x3 basis saying which way the structure should face, applied
 *  to the chain group so the camera stays the reader's.
 *
 *  TWO KINDS OF BASIS AND THEY LIVE IN DIFFERENT PLACES, which is the whole of
 *  the precedence `setData` applies — this option, then create's, then the
 *  bake's:
 *
 *    CHOSEN   a human turned the molecule and picked. Taste, not measurement,
 *             so it lives in proteins/proteins.js as `view:{by:'human',basis}`
 *             and is read at draw time. `protein:` picks it up here; a caller
 *             passing `data:` asks `ProteinLib.viewOf(p)` for it. Re-aiming a
 *             protein is then an edit and a reload, not a re-bake.
 *
 *    SOLVED   FoldLib.viewBasis worked it out from the shape. That IS a
 *             measurement, so it is baked beside the extents it came with, and
 *             it is the fallback whenever nobody has chosen. See viewBasis for
 *             why a globular domain gets none.
 *
 *  A protein whose registry entry holds a chosen basis bakes NO view at all,
 *  so a page that forgets to pass one opens in the deposited frame — visibly
 *  wrong rather than subtly, and the panel's `frame` row says why.
 *
 *  `afterFrame:` runs after every render, for a page drawing over the scene —
 *  an annotate.js layer's `step()`. Orbit moves the camera without advancing
 *  anything, so a label reprojected anywhere else shears off its atom on a
 *  drag.
 *
 *  `colors:` overrides the ss palette — one number for a flat colour, or
 *  {C,H,E} for some of it, or `{byChain:{A:…,B:…}}` where what has to be told
 *  apart is which strand rather than what it is folded into. Omit it and every
 *  protein in the repo is drawn the same way, which is the default for a
 *  reason.
 *
 *  Returns kit/card-stage.js's box, so a pool's acquire / snapshot / destroy
 *  work on it unchanged, plus `drop()` (back to ribbon, release the surface),
 *  `setData(t)` (draw a different structure in the same box, keeping the
 *  camera), `setPocket(p)` and `rep` for a caller that wants to know what is
 *  showing.
 *
 *  `setPocket({atoms, bonds})` draws the few atoms that belong INSIDE the
 *  ribbon — a heme, what is bound to its iron, the side chain a bench is about
 *  — ball-and-stick, in the structure's frame, at the proportions BALL /
 *  FE_BALL / STICK below. It returns `{group, materials}` so a lesson can fade
 *  or tint them, and it clears with the ribbon on every setData. What is IN
 *  the pocket is the baker's decision, never the box's, for the same reason
 *  the box does not parse PDB.
 * ============================================================================= */
(function (global) {
  'use strict';

  /* THE METALS A DEPOSITION BRINGS. They have colours in palette.js and
     deliberately no display radius, so they are sized here as a multiple of
     carbon and stay the biggest atom in a group at whatever scale it is drawn.
     A set rather than a test for 'Fe', because the second one to arrive would
     otherwise be a grey ball the size of a carbon. */
  const METAL = new Set(['Fe', 'Co', 'Mg', 'Zn', 'Mn', 'Ni', 'Cu']);

  /* Coil, helix, strand — kit/ribbon-test.html's, so a card and the bench
     that tunes the ribbon are never two opinions about the same helix. */
  const RIB = { C: 0x7d8c7a, H: 0x0042aa, E: 0xc2571b };
  const SES_COLOUR = 0xdfe4ee;

  /* ---- BALL-AND-STICK, FOR THE FEW ATOMS THAT EARN IT ----

     A ribbon is what a protein is drawn as; these are the proportions for the
     handful of atoms drawn INSIDE one — a heme, what is bound to its iron, the
     one or two side chains a bench is about. 43 atoms is a shape you can read
     at 10 A across, which is exactly what 150 residues of the same treatment
     is not, and it is how every published figure draws a porphyrin.

     SMALLER BALLS AND FATTER STICKS THAN A CLOSE-UP, deliberately, and this is
     the part that is easy to get wrong from the outside. The subject is the
     group's SHAPE seen from across a 40 A protein, not its volume: BALL shrinks
     the house radii so a porphyrin reads as a ring rather than a clump of
     touching spheres, and STICK is more than twice the house ratio because at
     that distance the house width comes out about a pixel — a cobweb, not a
     bond. They are set independently, since one is set by how far away the bond
     is seen from and the other by how much volume the ring should have.

     FE_BALL is a MULTIPLE of the shrunk carbon, never an absolute, so the iron
     stays the biggest atom in the group at any size the rest is drawn at.

     Judge them at a whole-protein framing, never zoomed in. */
  const BALL = 0.72;         // × the house display radius
  const FE_BALL = 2.7;       // × the shrunk carbon, for a metal
  const STICK = 0.36;        // × the FULL carbon radius; the house ratio is 0.165

  let sesOwner = null;              // the one box holding a decoded surface

  /* Checked rather than assumed: a library that is not there yet shows up as an
     empty box, which reads as a module with no stage — the wrong story, and one
     nobody can see is wrong. Bare `typeof` because classic scripts share one
     global lexical scope, which is where ribbon.js's `const RibbonLib` lives:
     it is never a property of window, so `global.RibbonLib` would say missing
     on a page that has it. */
  /* PDB writes elements in upper case ('FE'); PALETTE keys them the way the
     periodic table does ('Fe'). One spelling in, one lookup out — without this
     an iron silently falls through to the default grey, which reads as a
     rendering choice rather than as a missing key. */
  function norm(el) {
    if (!el) return 'C';
    return el.length > 1 ? el[0].toUpperCase() + el.slice(1).toLowerCase()
                         : el.toUpperCase();
  }

  function missing() {
    const gaps = [];
    if (typeof THREE === 'undefined') gaps.push('three.min.js');
    if (typeof Stage === 'undefined') gaps.push('lib/scene.js');
    if (typeof CardStage === 'undefined') gaps.push('kit/card-stage.js');
    /* Only setPocket reads it, but a box created without it fails at the
       click rather than at load, which is the harder failure to place. */
    if (typeof MolLib === 'undefined') gaps.push('lib/molecules.js');
    if (typeof RibbonLib === 'undefined') gaps.push('kit/ribbon.js');
    return gaps;
  }

  /* ---- a protein by NAME ---------------------------------------------
   *  `protein:'hemoglobin'` instead of four paths. proteins/proteins.js is the
   *  one place that knows which file plays which role for a structure — the
   *  `bake` block names them, and check-proteins.js fails a role that is not on
   *  disk — so a caller reconstructing `2HHB.card.surf.bin` from a stem is
   *  standing a convention where a fact already is.
   *
   *  `variant` picks which deposition; omitted, it is the registry's default.
   *  A caller still passing explicit paths wins: hemoglobin-lab and the door
   *  map's VIEWS name files the registry has no role for, and this must not
   *  take that away from them.
   *
   *  `base` is how far the calling page sits from the repo root, because the
   *  registry's paths are repo-relative and a page in tests/ is a directory
   *  down. It is the caller's fact about itself, not the registry's.
   */
  function fromRegistry(opts) {
    if (!opts.protein) return opts;
    const lib = (typeof ProteinLib !== 'undefined' && ProteinLib)
      || (typeof global !== 'undefined' && global.ProteinLib);
    if (!lib) {
      console.warn('Proteinbox: protein:' + opts.protein + ' needs proteins/proteins.js loaded before it');
      return opts;
    }
    const p = lib.PROTEINS.find(x => x.key === opts.protein);
    if (!p) { console.warn('Proteinbox: no protein `' + opts.protein + '` in the registry'); return opts; }
    const v = opts.variant
      ? p.variants.find(x => x.id === opts.variant)
      : (p.variants.find(x => x.default) || p.variants[0]);
    if (!v) { console.warn('Proteinbox: no variant `' + opts.variant + '` of ' + opts.protein); return opts; }

    const dir = (opts.base || '') + (p.dir || p.key) + '/data/';
    const at = f => (f ? dir + f : null);
    const bake = v.bake || {};
    /* THE TRACE ROLE, not `read.baked`. They are usually the same file and for
       sickle 2HBS they are not: its `baked` is the QUATERNARY json, because
       what that entry is deposited for is a contact between tetramers and the
       card that draws it wants chains, hemes and irons rather than a backbone.
       This box draws ribbons, so it asks for the ribbon's role by name and says
       so when there is none — the alternative is fetching a file of the wrong
       shape and rendering nothing, which reads as a broken box. */
    /* TWO CONVENTIONS, and the registry means both. A protein on its own
       pipeline carries a `bake` block naming every artefact by role, so that
       block is authoritative: hemoglobin's 2HBS has no `trace` in it because it
       is deposited for a surface, and no ribbon exists. A protein on the shared
       `trace` pipeline has no `bake` block at all, and `read.baked` IS its
       trace — which is four of the six. Reading `read.baked` unconditionally
       would hand 2HBS's quaternary json to a ribbon drawer. */
    const ribbon = v.bake ? (bake.trace || null) : (v.read && v.read.baked) || null;
    if (!opts.trace && !opts.data && !ribbon) {
      console.warn('Proteinbox: ' + opts.protein + ' ' + v.id
        + ' has no `trace` role to draw — the registry bakes it for '
        + (Object.keys(bake).join(', ') || 'nothing') + '. Name a path if you meant one of those.');
    }
    return Object.assign({}, opts, {
      trace:   opts.trace   || at(ribbon),
      surface: opts.surface || at(bake.card),
      fold:    opts.fold    || at(bake.fold),
      chains:  opts.chains  || v.chains,
      /* THE ROTATION A HUMAN CHOSE, read here rather than baked. A caller
         passing `data:` instead of a key does the same with
         `ProteinLib.viewOf(p)`; the bake's own `view`, where it has one, is
         the solved fallback under both. */
      view:    opts.view    || (lib.viewOf ? lib.viewOf(p) : null),
    });
  }

  function create(rawOpts) {
    const gaps = missing();
    if (gaps.length) {
      console.warn('Proteinbox needs ' + gaps.join(', ') + ' loaded before it');
      return null;
    }
    const opts = fromRegistry(rawOpts);

    const mount = opts.mount;
    let radius = 0, player = null, surf = null, rep = 'ribbon', seeded = false;
    /* THE PALETTE IN FORCE, held at box scope rather than inside setData.
       The chain loop builds one chain per frame, so a build is usually still
       running when anything else happens; if it closed over the materials it
       started with, a setColors mid-build would repaint the chains that exist
       and the loop would go on adding the rest in the OLD colours. Both write
       here and the loop reads it per mesh, so the last word wins whenever it
       was said. */
    let paint = { mats: null, byChain: null };
    /* HALF-EXTENTS ACROSS AND UP, beside the radius, and only the ribbon has
       them. A sphere is the right frame for a globular protein and the wrong
       one for a rod: one collagen molecule is 3016 Å by 55, and framed on its
       circumscribing radius the camera pulls back until the molecule is 1/60
       of the height — a hairline in the middle of an empty stage. scene.js's
       frame() already solves per axis; this is what lets it. Null falls back
       to the radius, which is what the surface and the fold still give. */
    let stillHX = 0, stillHY = 0;
    /* Bumped by every setData. The chain loop below yields to rAF between
       chains, so a switch that lands mid-build leaves the OLD loop running:
       it keeps adding meshes to a group the new call already cleared, and
       keeps widening the centre and radius with points nobody is drawing —
       a ten-rung stack framing a single chain. The loop checks the token it
       started with and stops when it is no longer the current one. */
    let generation = 0;
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
      /* NO HOUSE CLAMP ON THE SOLVE. Stage.frame's own min/max default to
         6-220 ångströms, which is the range a molecule stage lives in and
         has nothing to say about a protein whose radius was MEASURED off
         its own coordinates. One whole collagen molecule is 3016 Å end to
         end and frames at ~2500: clamped to 220 it opens showing a tenth of
         itself, off both edges, with nothing on screen saying so. The clamp
         that matters is the zoom one below, and it is set from the answer. */
      Stage.frame(box.camera, box.cam,
                         [{ x: 0, y: 0,
                            rxz: rep === 'ribbon' && stillHX ? stillHX : radius,
                            hy:  rep === 'ribbon' && stillHY ? stillHY : radius }],
                         { pad: opts.pad || 1.12, min: 0, max: Infinity });
      if (box.camera.isOrthographicCamera) box.cam.r = box.camera.top;
      /* THE ZOOM CLAMP FOLLOWS THE FRAMING, because scene.js's default is a
         fixed 5-60 and a protein's size is not: 1DFJ frames at 63 and every
         wheel event then clamped it to 60, so the box opened at a distance the
         reader could never get back to and read as stuck. Anchored to the
         distance just solved — a fifth of it is inside the molecule, three
         times it is the structure small in the frame — so a 124-residue
         monomer and a 580-residue complex both zoom the same amount. */
      if (box.stage.setZoomLimits)
        box.stage.setZoomLimits(box.cam.r * 0.2, box.cam.r * 3);
      /* THE FAR PLANE FOLLOWS TOO. scene.js builds the camera for a molecule
         stage and stops it at 1000, which is past anything in this repo until
         a structure is 3000 Å long: the camera then stands correctly at 4200
         and draws nothing at all, which reads as a bake that failed rather
         than as a frustum. Solved from the standing distance plus the widest
         the reader can zoom out to, which is the 3x above. */
      const far = Math.max(1000, box.cam.r * 6);
      if (box.camera.far < far) { box.camera.far = far; box.camera.updateProjectionMatrix(); }
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
      /* PASSED STRAIGHT THROUGH, the same hook molbox draws its leader in.
         Anything drawn OVER the scene in CSS pixels — an annotate.js layer —
         has to reproject after the camera the frame was rendered with, and
         orbiting moves that camera without advancing anything, so a page
         cannot do it from `step`. */
      afterFrame: opts.afterFrame,
      onResize: fit,
      onDestroy: () => { if (sesOwner === box) sesOwner = null; },
    });

    /* Two groups, never both visible. The trajectory is in FoldLib.orient()'s
       frame and the trace is in the crystal's, so they are not the same
       molecule in the same place; the box re-centres on whichever is showing,
       which is what makes drawing them from two frames legal. */
    const chainGroup = new THREE.Group();
    const foldGroup = new THREE.Group();
    /* Inside the chain group, not beside it: a pocket is measured in the same
       ångströms as the trace and has to wear the same presentation `view`, or
       a heme keeps the crystal's orientation while the protein turns. */
    const pocketGroup = new THREE.Group();
    chainGroup.add(pocketGroup);
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
    const palOf = v => v == null ? RIB
      : (typeof v === 'number' ? { C: v, H: v, E: v }
                               : Object.assign({}, RIB, v));
    const matsOf = pal => [pal.C, pal.H, pal.E].map(v => {
      const m = Stage.bondMat(v);
      m.side = THREE.DoubleSide;
      return m;
    });

    /* The materials one `colors` argument asks for: one set for the chains it
       does not name, and one per chain it does. Lifted out of setData so a
       recolour can build exactly what a rebuild would have. */
    function materialsFor(c) {
      const base = c && c.byChain ? Object.assign({}, c, { byChain: undefined }) : c;
      return {
        mats: matsOf(palOf(base)),
        byChain: c && c.byChain
          ? Object.fromEntries(Object.entries(c.byChain)
              .map(([id, v]) => [id, matsOf(palOf(v))])) : null,
      };
    }

    /* ---- setColors(colors) ----

       REPAINT WHAT IS ALREADY DRAWN, without rebuilding it. The same argument
       setData takes, applied to the meshes that are on screen:

         box.setColors({ byChain: { A: 0x1f5f4f, B: 0x9aa0a6 } })

       WHY THIS IS NOT setData WITH THE SAME TRACE. Rebuilding 28 chains of
       ribbon is a spline and a tube per segment, and the box deliberately
       builds a chain per frame so the page does not stall — which means a
       structure the reader is already looking at visibly reassembles itself,
       chain by chain, to change nothing but its colour. It also throws away
       the pocket, the framing and anything a page had parented into the chain
       group. A palette is not a model, and swapping one should not cost a
       model's worth of work.

       Meshes are found by the `userData.chain` they were tagged with, and
       anywhere under the chain group — a page that has re-parented some of
       them (a subassembly it turns) still gets them all. */
    function setColors(colors) {
      paint = materialsFor(colors);
      chainGroup.traverse(m => {
        const cid = m.userData && m.userData.chain;
        if (cid === undefined || !m.isMesh) return;
        m.material = (paint.byChain && paint.byChain[cid]) || paint.mats;
      });
      box.draw();
    }

    function setData(t, o) {
      o = o || {};
      const mine = ++generation;
      chainGroup.clear();
      /* The pocket belongs to the structure that was just replaced, so it goes
         with it — cleared and re-parented empty rather than left holding the
         previous molecule's heme inside the next one's ribbon. */
      pocketGroup.clear();
      chainGroup.add(pocketGroup);
      const ids = (o.chains || opts.chains)
        ? String(o.chains || opts.chains).split(',') : t.order.slice();

      /* Colour. Default is the ss palette, which is the point of drawing every
         protein in the repo the same way. A page that colours by something
         else — a state, a mutation, a chain — passes `colors`, and one colour
         means all three. */
      const c = o.colors || opts.colors;
      /* ONE SET, OR ONE PER CHAIN. `byChain` is the case the ss palette cannot
         serve: where what a reader has to tell apart is WHICH STRAND, not what
         it is folded into. Collagen is why it exists — three chains wound
         around each other, no HELIX or SHEET records in any collagen file, so
         the default palette draws the braid as one green rope and the thing
         the structure is famous for is invisible. A chain the map does not
         name falls back to the palette beside it. */
      paint = materialsFor(c);

      /* THE PRESENTATION FRAME, applied to the GROUP and not to the camera.

         A deposited protein opens in a crystal or EM frame, which is nobody's
         decision about how it should be seen; `view` is the basis a bake
         solved for it, or a human picked. Same split scene.js makes for a
         molecule spec: the frame belongs to the structure, the camera belongs
         to the reader, and composing the two anywhere else is the Euler trap
         that made molecules cartwheel.

         WHICH LEAVES THE PAGE ONE OBLIGATION, also scene.js's: the group's
         rotation is an OFFSET and must be ZERO AT REST, or the declared view
         is one nobody ever sees while the file still claims it. */
      const view = o.view || opts.view || t.view;
      chainGroup.quaternion.identity();
      if (view) {
        /* A VIEW BASIS IS RELATIVE TO A CANONICAL CAMERA, and saying "shortest
           axis into the screen" means nothing unless the screen is down that
           axis. The box's default camera stands off at an angle, which is
           right for a card with no declared view and wrong the moment there
           is one: the frame gets solved and then looked at obliquely, so a
           rung one molecule thick still reads as a tilted squiggle.

           FIRST DATA ONLY. After that the camera is the reader's, and a
           switch between structures must not snap away the turn they just
           made — the reason this box is re-fed rather than rebuilt. */
        if (!seeded) {
          box.cam.theta = 0;
          box.cam.phi = Math.PI / 2;
          if (box.cam.seed) box.cam.seed();
          seeded = true;
        }
        chainGroup.setRotationFromMatrix(new THREE.Matrix4().set(
          view[0][0], view[0][1], view[0][2], 0,
          view[1][0], view[1][1], view[1][2], 0,
          view[2][0], view[2][1], view[2][2], 0,
          0, 0, 0, 1));
      }

      const drawn = [];
      /* One chain per frame. A tetramer is ~80k triangles and building all
         four in the frame the trace lands is a visible stall on a page that
         is usually animating something when it arrives. */
      const build = () => {
        const cid = ids.shift();
        if (cid === undefined || box.dead || mine !== generation) return;
        const ch = t.chains[cid];
        if (ch) {
          for (const seg of runs(ch)) {
            if (seg.CA.length < 4) continue;   // RibbonLib needs a spline's worth
            const pts = seg.CA.map(p => new THREE.Vector3(p[0], p[1], p[2]));
            /* Centre and radius are solved in the frame the reader will see,
               so `drawn` carries the rotated points. Measuring the raw ones
               centres the box on where the molecule USED to be, which reads
               as a framing bug rather than as a missing rotation. */
            drawn.push(...pts.map(v => v.clone().applyQuaternion(chainGroup.quaternion)));
            const mesh = new THREE.Mesh(
              RibbonLib.build(THREE, pts, seg.ss,
                              { sub: opts.sub == null ? 6 : opts.sub }),
              (paint.byChain && paint.byChain[cid]) || paint.mats);
            /* WHICH CHAIN THIS MESH CAME FROM, and nothing more. A page that
               has to move PART of a structure — one subassembly of a machine,
               against the rest of it — cannot otherwise find its meshes: they
               go in one at a time across frames, several segments to a chain,
               and by the time a caller looks they are an anonymous pile. This
               records the fact; what a page does with it stays the page's, the
               same refusal this box makes about parsing. */
            mesh.userData.chain = cid;
            chainGroup.add(mesh);
          }
          /* The trace is centred on every chain it HOLDS, so a box drawing
             one of four would sit off to the side. Re-centre on what is
             actually drawn, and re-solve after each — every chain changes
             both the centre and the radius. */
          if (drawn.length) {
            stillMid = drawn.reduce((acc, p) => acc.add(p), new THREE.Vector3())
                            .multiplyScalar(1 / drawn.length);
            stillR = stillHX = stillHY = 0;
            for (const p of drawn) {
              stillR = Math.max(stillR, p.distanceTo(stillMid));
              stillHX = Math.max(stillHX, Math.abs(p.x - stillMid.x));
              stillHY = Math.max(stillHY, Math.abs(p.y - stillMid.y));
            }
            if (rep === 'ribbon') reframeStill();
          }
          box.draw();
        }
        /* rAF NEVER FIRES IN A HIDDEN TAB, and a chain-per-frame build then
           stops partway: the box keeps whatever it had drawn, which on a
           ten-rung stack is a fibril missing most of itself. Anything that
           renders a page without showing it — an automated screenshot, a
           thumbnail capture, a background tab a reader left open — lands
           there. setTimeout is throttled in that state but it does run, so
           the build finishes either way. */
        if (ids.length) {
          if (typeof document !== 'undefined' && document.hidden) setTimeout(build, 0);
          else requestAnimationFrame(build);
        }
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
    box.setColors = setColors;

    /* ---- setPocket(pocket) ----

       The few atoms drawn INSIDE the ribbon, ball-and-stick, in the
       structure's own frame:

         box.setPocket({ atoms:[{el, p:[x,y,z]}], bonds:[[i,j]] })

       exactly the shape a baker writes beside the trace. Coordinates go in as
       baked — centred with the trace by the same vector — because the box owns
       the centring and a group centred on itself lands at the origin with the
       protein somewhere else.

       WHAT IS IN THE POCKET IS NOT THE BOX'S BUSINESS, the same refusal it
       makes about parsing: which residues, which ligand names count, whether a
       cross-residue bond is kept. Those decide what the picture CLAIMS, and a
       page that owns a protein owns them. What is shared is how they are drawn.

       SPLIT STICKS, each half in its own atom's colour — the structure style
       every published figure uses, and the right one here for the reason
       Modules.md gives: these are deposited coordinates with no spec and often
       no hydrogens, so the bond does more of the work of saying what the atoms
       are.

       IT DOES NOT WIDEN THE FRAME. A pocket is inside the protein by
       definition, so the framing radius stays the ribbon's; letting 43 atoms
       vote on it would be a bug nobody could see.

       Returns `{group, materials}` — one material per element plus one per
       bond colour — so a LESSON can fade the group in, tint it, or hide it
       without the box growing an opinion about timing. Call with no argument
       to clear. */
    function setPocket(p) {
      pocketGroup.clear();
      if (!p || !p.atoms || !p.atoms.length) return { group: pocketGroup, materials: [] };

      const R = MolLib.PALETTE.radii, C = R.C / MolLib.SCALE;
      const colourOf = el => MolLib.PALETTE.atoms[el] || 0x888888;
      const materials = [], byEl = {};
      const matFor = el => byEl[el] || (byEl[el] = materials[materials.push(
        new THREE.MeshStandardMaterial({
          color: colourOf(el),
          /* A metal should look like one, and 'metal' is a set rather than
             iron: a heme's Fe and the Co sitting where a Mg belongs are the
             same kind of atom in a picture, and hardcoding one of them is how
             the second arrives looking like a large grey carbon. */
          roughness: METAL.has(el) ? .35 : .5, metalness: METAL.has(el) ? .35 : 0,
        })) - 1]);

      for (const a of p.atoms) {
        const el = norm(a.el);
        const r = METAL.has(el) ? BALL * C * FE_BALL
                                : BALL * ((R[el] || R.C) / MolLib.SCALE);
        const m = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), matFor(el));
        m.position.set(a.p[0], a.p[1], a.p[2]);
        pocketGroup.add(m);
      }

      const A = new THREE.Vector3(), B = new THREE.Vector3();
      for (const [i, j] of p.bonds || []) {
        const a = p.atoms[i], b = p.atoms[j];
        if (!a || !b) continue;
        A.set(a.p[0], a.p[1], a.p[2]); B.set(b.p[0], b.p[1], b.p[2]);
        const g = Stage.bondSplit(A, B, colourOf(norm(a.el)), colourOf(norm(b.el)),
                                  C * STICK);
        g.traverse(o => { if (o.material && !materials.includes(o.material)) materials.push(o.material); });
        pocketGroup.add(g);
      }
      box.draw();
      return { group: pocketGroup, materials };
    }
    box.setPocket = setPocket;

    /* THE STRUCTURE'S OWN FRAME, for anything setPocket does not cover. It is
       the chain group and not `root`, because the presentation `view` is
       applied here — a ligand parented to root would keep the crystal's
       orientation while the protein turned, and land in the right place only
       for a trace that happened to earn no view. Cleared on every setData, so
       a caller re-adds after it. */
    box.group = chainGroup;

    /* ---- pickView() ----
     *
     *  THE BASIS THIS STRUCTURE WOULD NEED TO OPEN FACING THE WAY IT FACES
     *  RIGHT NOW, as a row-major 3x3 ready to paste into a registry. Every
     *  bench's "copy this view" button is this, and it lives here because the
     *  correct answer needs something no page can reach.
     *
     *  WHAT A PAGE GOT WRONG DOING IT ITSELF. The obvious version reads the
     *  camera and inverts it: the camera's orientation says where the reader
     *  is standing, a view basis says how the structure should be turned to be
     *  seen from there, and those are opposites. That is right only while the
     *  chain group is unrotated — which it is exactly until a structure earns
     *  a view, and then never again. A structure already wearing V and looked
     *  at from camera C SHOWS C⁻¹·V, so copying C⁻¹ back drops the V that was
     *  on screen at the time, and the paste opens somewhere nobody chose. The
     *  failure is silent: a rotation is still a rotation, the protein still
     *  looks like a protein, and only the person who picked the view can tell.
     *
     *  So: read the group's rotation as well as the camera's, and return the
     *  product. `setData` seeds the canonical camera (theta 0, phi pi/2, which
     *  is the identity orientation) on the first structure with a view, which
     *  is what makes the returned basis mean the same thing when it is read
     *  back in.
     */
    box.pickView = function pickView(dp) {
      const d = dp === undefined ? 4 : dp;
      const m = new THREE.Matrix4().makeRotationFromQuaternion(
        box.camera.quaternion.clone().invert());
      m.multiply(new THREE.Matrix4().makeRotationFromQuaternion(chainGroup.quaternion));
      const e = m.elements, k = Math.pow(10, d), r = v => Math.round(v * k) / k;
      /* three.js stores column-major; a basis is rows, same as a bake. */
      return [[e[0], e[4], e[8]], [e[1], e[5], e[9]], [e[2], e[6], e[10]]]
        .map(row => row.map(r));
    };

    Object.defineProperty(box, 'rep', { get: () => rep });
    return box;
  }

  global.Proteinbox = { create, RIB };
})(this);
