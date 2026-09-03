/* =============================================================================
 *  kit/proteinbox.js — Proteinbox: a card that shows a deposited protein
 * =============================================================================
 *  kit/molbox.js draws a molecule built from a spec. This draws one measured in
 *  a lab: real angstroms, from files a baker wrote, in a scene of its own —
 *  which is what lets it BE angstroms, since one scale family per SCENE
 *  (MolecularGeometry.md 1.5) and the cards beside it are the small-molecule
 *  family.
 *
 *  IT DRAWS DNA AND RNA TOO, through kit/nucleic.js, on any chain the bake
 *  marks `kind:'na'` — a backbone ribbon per strand and one rung per base
 *  pair. A protein and a duplex in one bake share one box, one scale and one
 *  centre; `proteins/zif268/` is the worked example. Load kit/nucleic.js
 *  alongside kit/ribbon.js when a page has any, and the box says so if it is
 *  missing rather than drawing half a structure.
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
 *  camera), `setPocket(p)`, `focus(f)`, `setGhost(o)` and `rep` for a caller that wants to know what is
 *  showing.
 *
 *  `focus({at:[x,y,z], radius, view, ghost}, ms)` leans the camera in on a few
 *  angstroms of the structure — a binding site — keeping the angle the reader
 *  turned to, and `focus(null, ms)` gives the whole protein back. A pocket is
 *  10 A across inside a 40 A protein, so a lesson about binding that never
 *  leans in is asking a reader to see a 0.3 A move from across the room.
 *  `view` is a basis for the close-up alone, since the angle that shows a
 *  protein is rarely the angle that shows one site in it; `ghost` fades the
 *  ribbon with the move; `ms` tweens all four together, which is what says
 *  the close-up is the same molecule.
 *
 *  `setGhost(opacity)` does the fade on its own, for a page that wants it
 *  without a move. It fades the ribbon and leaves setPocket's atoms solid,
 *  which is what makes a focused view readable: the container stays visible
 *  as a container. It survives setData, because a page that walked the meshes
 *  itself would lose the fade on the next switch and not be able to tell.
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
  /* The ss palette is lib/palette.js's, not this module's — a second consumer
     (proteins/zif268, a protein and a duplex in one scene) needed the same
     three colours, and a copy is how a caption and the band it names drift.
     Every page that loads this file loads palette.js before it. */
  const RIB = MolPalette.ss;

  /* Stands for "every nucleic chain, together" in the per-frame build queue.
     A string nobody can collide with, because the queue otherwise holds chain
     ids straight out of a PDB. */
  const NA_STEP = '\u0000na';
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
       block is authoritative and a variant with no `trace` role in it has no
       ribbon to draw. A protein on the shared `trace` pipeline has no `bake`
       block at all, and `read.baked` IS its trace. Reading `read.baked`
       unconditionally would hand a ribbon drawer whichever file that pipeline
       happened to call its default — a surface, a quaternary json — and the
       box would fetch the wrong shape and render nothing, which reads as a
       broken box rather than as a missing role. */
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
    /* THE POINTS THEMSELVES, kept so the framing can be solved EXACTLY rather
       than from half-extents. A perspective frustum widens with depth, and
       `Stage.frame` solves the two on-screen axes at the content's middle
       plane — right for everything else it frames, which is flat (a row of
       molecules is a few ångströms deep), and wrong for a protein, which is as
       deep as it is wide. Whatever is nearest the camera is magnified past the
       edge: lysozyme overflowed by 19% under a rotation a human had chosen
       precisely so the cleft would face the reader, and myoglobin by 4% on
       its own.

       IT IS SOLVED HERE AND NOT THERE because the answer needs the POINTS.
       Standing back by the half-depth assumes the bounding corner is occupied
       and pulled lysozyme back 46%, leaving it at 60% of the stage — framing
       badly in the other direction. Treating the item as an ellipsoid closes
       the form and is tighter, and still cropped myoglobin, whose shape is not
       an ellipsoid. No summary of a point cloud answers this for every protein
       in the repo; the cloud does, it is a thousand points, and this module is
       the only caller that has one. So `Stage.frame`'s own solve stays the
       floor and the exact requirement is passed as `min`. */
    let stillPts = [], stillRaw = [];
    /* Bumped by every setData. The chain loop below yields to rAF between
       chains, so a switch that lands mid-build leaves the OLD loop running:
       it keeps adding meshes to a group the new call already cleared, and
       keeps widening the centre and radius with points nobody is drawing —
       a ten-rung stack framing a single chain. The loop checks the token it
       started with and stops when it is no longer the current one. */
    let generation = 0;
    let stillMid = null, stillR = 0, foldR = 0;

    /* WHERE THE CAMERA IS POINTED, when it is not pointed at the whole
       structure. `box.focus({at, radius})` frames a few angstroms of one — a
       binding site — and null returns to the ribbon's own framing. It is kept
       across setData ON PURPOSE: a page showing four states of one site
       switches the file and means to stay where it was looking, and re-aiming
       after every switch is how the camera jumps. */
    let focused = null;

    /* THE BASIS CURRENTLY ON THE CHAIN GROUP, which is not always the one the
       trace or the registry declared: a focused view can ask for its own — the
       site is not necessarily best seen from the angle the whole protein is.
       Null means the structure's own. */
    let viewNow = null;
    let viewDeclared = null;

    /* The one tween. Rotation, distance, centre and the ghost move together or
       the switch reads as three separate things happening to one picture. */
    let tween = null;

    /* AN ORTHO CAMERA DOES NOT ZOOM BY MOVING: its size is its frustum, so a
       cam.r written straight onto the camera does nothing and the protein is
       drawn against THREE's constructor frustum, top = 1 — a 33 A molecule in a
       2 A frame, which fills the box with one lobe of one helix. Stage.frame's
       ortho branch writes the frustum and leaves cam.r alone, so the answer is
       read back, or the first wheel event jumps the card. Same shape as
       molbox's fit() and the same reason; it re-runs from onResize because the
       aspect it solved against is gone the moment a card grows. */
    /* THE NEAREST FACE IS WHAT HAS TO FIT. For a point at (x,y,z) relative to
       the framed centre, a perspective camera at distance d shows it inside
       the frustum when |x| <= (d - z)·tan·aspect, so that point alone needs
       d >= z + |x|/(tan·aspect), and the same in y without the aspect. The
       answer is the largest of those over everything drawn — exact, with no
       assumption about the shape.

       IT IS SOLVED PER fit() AND NOT ONCE, because tan and aspect are the
       camera's and the aspect changes with the pane: a value cached at build
       time is right until a reader resizes, which is the kind of wrong that
       only appears on someone else's screen. The ribbon is wider than the
       trace it splines through, and the pad is what covers that.

       Returns 0 before there is anything to measure, which is what `min` was
       before this and leaves Stage.frame's own answer standing. */
    const needed = () => {
      /* A FOCUSED CAMERA IS DELIBERATELY TOO CLOSE. This solves the distance
         at which everything drawn is inside the frustum, which is the right
         answer for a whole protein and the exact opposite of what a pocket
         view asks for. */
      if (focused) return 0;
      if (rep !== 'ribbon' || !stillPts.length || !stillMid) return 0;
      if (box.camera.isOrthographicCamera) return 0;   // no widening with depth
      const tan = Math.tan(box.camera.fov * Math.PI / 360);
      const asp = box.camera.aspect;
      if (!tan || !asp || !isFinite(asp)) return 0;
      let need = 0;
      for (const p of stillPts) {
        const x = p.x - stillMid.x, y = p.y - stillMid.y, z = p.z - stillMid.z;
        const dx = z + Math.abs(x) / (tan * asp);
        const dy = z + Math.abs(y) / tan;
        if (dx > need) need = dx;
        if (dy > need) need = dy;
      }
      return need * (opts.pad || 1.12);
    };

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
      /* THE STILL HALF-WIDTHS ARE THE WHOLE STRUCTURE'S, so a focused camera
         has to ignore them: framing 11 A of a protein against the 40 A box it
         sits in solves for the box and leans in by nothing. */
      const hx = focused ? radius : (rep === 'ribbon' && stillHX ? stillHX : radius);
      const hy = focused ? radius : (rep === 'ribbon' && stillHY ? stillHY : radius);
      Stage.frame(box.camera, box.cam,
                         [{ x: 0, y: 0, rxz: hx, hy: hy }],
                         { pad: opts.pad || 1.12, min: needed(), max: Infinity });
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
      step: dt => { tickTween(dt); if (player && rep === 'fold') player.tick(dt); },
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
      const p = {
        mats: matsOf(palOf(base)),
        byChain: c && c.byChain
          ? Object.fromEntries(Object.entries(c.byChain)
              .map(([id, v]) => [id, matsOf(palOf(v))])) : null,
      };
      /* A GHOST IS A PROPERTY OF THE BOX, NOT OF THE MESHES ON SCREEN, which
         is the whole reason it is applied here. setData clears the chain group
         and rebuilds a chain per frame, so anything a page did by walking the
         meshes is undone by the next switch — and undone invisibly, because
         the page's call succeeded against an empty group. */
      applyGhost(p);
      return p;
    }

    /* ---- setGhost(opacity) ----

       Fade the RIBBON, so what is drawn inside it can be seen. A pocket view
       puts the camera inside the protein, where an opaque ribbon is a wall
       across the picture; at 0.15 or so the helices still say what the site is
       buried in without hiding it. setPocket's atoms are never touched — they
       are the subject.

       Takes an opacity, or 0 / nothing for solid. Survives setData. */
    let ghost = 0;
    function applyGhost(p) {
      const on = ghost > 0;
      const all = (p.mats || []).concat(
        Object.values(p.byChain || {}).reduce((a, b) => a.concat(b), []));
      for (const m of all) {
        m.transparent = on;
        m.opacity = on ? ghost : 1;
        /* Off while ghosted, so the far wall of the pocket shows through the
           near one. A transparent mesh that still writes depth hides whatever
           is behind it and reads as a hole in the protein. */
        m.depthWrite = !on;
      }
    }
    box.setGhost = function setGhost(v) {
      ghost = v || 0;
      applyGhost(paint);
      box.draw();
    };

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
      viewDeclared = view || null;
      chainGroup.quaternion.identity();
      /* A FOCUS OUTLIVES A SWITCH, and so does the angle it asked for: a page
         showing four states of one site sets the framing once and means to
         stay there while the file underneath changes. */
      viewNow = focused && focused.view ? focused.view : (view || null);
      if (viewNow) {
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
          viewNow[0][0], viewNow[0][1], viewNow[0][2], 0,
          viewNow[1][0], viewNow[1][1], viewNow[1][2], 0,
          viewNow[2][0], viewNow[2][1], viewNow[2][2], 0,
          0, 0, 0, 1));
      }

      const drawn = [];

      /* THE NUCLEIC CHAINS GO IN ONE STEP, NOT ONE PER FRAME, and the reason
         is that a rung is CROSS-CHAIN: a base pair joins two backbones, so
         there is no such thing as drawing one strand of a duplex on its own.
         `NucleicLib.build` takes the whole trace for that reason, so the queue
         carries a single sentinel standing for all of them. A duplex is ~2k
         triangles and the nucleosome's 292 nucleotides about 25k — one
         frame's work either way, which is what makes the sentinel affordable.

         Anything without `kind:'na'` is a protein: every bake written before
         2026-08-31 has no `kind` at all, and a Ca trace is the only thing
         `assemble` has ever produced. */
      const naIds = ids.filter(id => t.chains[id] && t.chains[id].kind === 'na');
      const queue = ids.filter(id => !(t.chains[id] && t.chains[id].kind === 'na'));
      if (naIds.length) queue.push(NA_STEP);

      /* One chain per frame. A tetramer is ~80k triangles and building all
         four in the frame the trace lands is a visible stall on a page that
         is usually animating something when it arrives. */
      const build = () => {
        const cid = queue.shift();
        if (cid === undefined || box.dead || mine !== generation) return;
        if (cid === NA_STEP) drawNucleic(t, naIds, drawn);
        const ch = cid === NA_STEP ? null : t.chains[cid];
        if (ch) {
          for (const seg of runs(ch)) {
            if (seg.CA.length < 4) continue;   // RibbonLib needs a spline's worth
            const pts = seg.CA.map(p => new THREE.Vector3(p[0], p[1], p[2]));
            /* Centre and radius are solved in the frame the reader will see,
               so `drawn` carries the rotated points. Measuring the raw ones
               centres the box on where the molecule USED to be, which reads
               as a framing bug rather than as a missing rotation. */
            drawn.push(...pts.map(v => v.clone()));
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
          if (drawn.length) solveStill(drawn);
          box.draw();
        }
        /* rAF NEVER FIRES IN A HIDDEN TAB, and a chain-per-frame build then
           stops partway: the box keeps whatever it had drawn, which on a
           ten-rung stack is a fibril missing most of itself. Anything that
           renders a page without showing it — an automated screenshot, a
           thumbnail capture, a background tab a reader left open — lands
           there. setTimeout is throttled in that state but it does run, so
           the build finishes either way. */
        if (cid === NA_STEP && drawn.length) {
          /* The nucleic step re-solves the framing the same way a chain does;
             it is outside the `if (ch)` above because there is no single chain
             to hang it off. */
          solveStill(drawn);
          box.draw();
        }
        if (queue.length) {
          if (typeof document !== 'undefined' && document.hidden) setTimeout(build, 0);
          else requestAnimationFrame(build);
        }
      };
      build();
    }

    /* ---- THE NUCLEIC BRANCH ----------------------------------------------
     *
     *  DNA and RNA, drawn as kit/nucleic.js's ladder — a backbone ribbon per
     *  strand and one rung per base pair, split at its own hydrogen bonds with
     *  each half in its base's colour. Why a joined rung rather than the two
     *  facing stubs every published viewer draws: that module's header, and
     *  docs/rendering-modules.md.
     *
     *  IT IS THE SAME BOX AND THE SAME SCALE. Both polymers are real angstroms
     *  out of one deposition, which is what lets a protein and a duplex share
     *  a stage at all (MolecularGeometry.md 1.5) — and a mixed bake centres
     *  them on ONE vector solved over both, so nothing here has to reconcile
     *  two frames. `proteins/zif268/` is the worked example.
     *
     *  COLOUR IS THE PALETTE'S AND NOT AN ARGUMENT. `colors` is the ss palette
     *  for a ribbon and means nothing to a base; a page that wants to say
     *  something with the colour of a nucleotide is saying something this box
     *  has no opinion about, and can draw it itself. `byChain` IS honoured for
     *  the backbones, because "which strand" is the one thing a caller might
     *  legitimately need to override — collagen's reason, one polymer over.
     */
    function drawNucleic(t, ids, drawn) {
      if (typeof NucleicLib === 'undefined') {
        console.warn('Proteinbox: this trace has nucleic chains and '
          + 'kit/nucleic.js is not loaded — load it after kit/ribbon.js');
        return;
      }
      const parts = NucleicLib.build(THREE, t,
        { chains: ids, sub: opts.sub == null ? 6 : opts.sub });

      const q = chainGroup.quaternion;
      const keep = geo => {
        /* Same rule the ribbon follows: `drawn` carries the structure's OWN
           points, and solveStill turns them into the frame the reader sees.
           Keeping them raw is what lets a view change re-solve the framing
           without rebuilding the ribbon. */
        const a = geo.attributes.position.array;
        for (let i = 0; i < a.length; i += 3)
          drawn.push(new THREE.Vector3(a[i], a[i + 1], a[i + 2]));
      };

      parts.strands.forEach((sd, i) => {
        const over = paint.byChain && paint.byChain[sd.id];
        const mesh = new THREE.Mesh(sd.geo, over ? over[0]
          : naMat('strand:' + i, MolPalette.strands[i % 2 ? 'b' : 'a']));
        mesh.userData.chain = sd.id;
        chainGroup.add(mesh);
        keep(sd.geo);
      });
      for (const bag of [parts.rungs, parts.stubs])
        for (const b of Object.keys(bag)) {
          chainGroup.add(new THREE.Mesh(bag[b], naMat('base:' + b,
            MolPalette.bases[b] === undefined ? MolPalette.bases.X
                                              : MolPalette.bases[b])));
          keep(bag[b]);
        }
    }

    /* Cached per box, like `paint` — a rebuild reuses them, and a box that
       dies takes them with it. */
    const naMats = {};
    const naMat = (key, color) => (naMats[key] = naMats[key]
      || Object.assign(Stage.bondMat(color), { side: THREE.DoubleSide }));

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

    /* THE FRAMING, SOLVED IN THE FRAME THE READER SEES. The points arrive in
       the structure's own coordinates and are turned by whatever basis is on
       the chain group, so this is what a view change re-runs — measuring the
       raw ones centres the box on where the molecule USED to be, which reads
       as a framing bug rather than as a missing rotation. */
    function solveStill(raw) {
      if (raw) stillRaw = raw;
      if (!stillRaw.length) return;
      const q = chainGroup.quaternion;
      stillPts = stillRaw.map(v => v.clone().applyQuaternion(q));
      stillMid = stillPts.reduce((acc, p) => acc.add(p), new THREE.Vector3())
                         .multiplyScalar(1 / stillPts.length);
      stillR = stillHX = stillHY = 0;
      for (const p of stillPts) {
        stillR = Math.max(stillR, p.distanceTo(stillMid));
        stillHX = Math.max(stillHX, Math.abs(p.x - stillMid.x));
        stillHY = Math.max(stillHY, Math.abs(p.y - stillMid.y));
      }
      if (rep === 'ribbon') reframeStill();
    }

    /* A BASIS ONTO THE CHAIN GROUP, and the framing re-solved after it. Null
       is the structure's own declared view, which is what focus(null) goes
       back to. */
    function applyView(basis) {
      viewNow = basis || null;
      chainGroup.quaternion.identity();
      if (viewNow) chainGroup.setRotationFromMatrix(new THREE.Matrix4().set(
        viewNow[0][0], viewNow[0][1], viewNow[0][2], 0,
        viewNow[1][0], viewNow[1][1], viewNow[1][2], 0,
        viewNow[2][0], viewNow[2][1], viewNow[2][2], 0,
        0, 0, 0, 1));
      solveStill();
    }

    function reframeStill() {
      if (!stillMid) return;
      /* THE FOCUS SURVIVES A REBUILD, which is the whole reason it is checked
         here rather than only in focus(): a chain goes in one frame at a time
         and re-solves the framing after each, so a focus applied once would be
         thrown away by the next chain to land. */
      if (focused) { aimAtFocus(); return; }
      box.root.position.copy(stillMid).negate();
      radius = stillR;
      fit();
    }

    function aimAtFocus() {
      /* The point arrives in the structure's own coordinates — a baker's, the
         same ones setPocket takes — and the reader sees the ROTATED frame, so
         it is turned by the chain group's quaternion the way the ribbon points
         are. Without that the camera lands where the site used to be, which
         reads as a framing bug rather than as a missing rotation. */
      const p = new THREE.Vector3(focused.at[0], focused.at[1], focused.at[2])
        .applyQuaternion(chainGroup.quaternion);
      box.root.position.copy(p).negate();
      radius = focused.radius;
      fit();
    }

    /* ---- focus(f, ms) ----

       `box.focus({ at:[x,y,z], radius, view, ghost }, ms)` puts the camera a
       few angstroms from one part of a structure; `box.focus(null, ms)` gives
       the whole thing back. `view` is an optional basis for the close-up,
       because the angle that shows a protein is rarely the angle that shows
       one site inside it, and `ghost` fades the ribbon along with the move.

       THE READER'S OWN TURN IS KEPT: the camera's theta and phi are never
       touched here. What moves is the centre, the distance, the structure's
       own basis and the ribbon's opacity.

       ms TWEENS ALL FOUR AT ONCE, and that is the point of doing it in the box
       rather than in a page. A camera that jumps has no way of saying that the
       close-up is the SAME molecule; one that leans in says it without a word
       of copy. Four separate animations would say it four times, slightly out
       of step. Omit ms and it snaps, which is right for a first draw.

       Nothing about which part is worth looking at is the box's business, the
       same refusal it makes about what is in the pocket: the page passes
       coordinates it already has. */
    const snap = () => ({
      pos: box.root.position.clone(),
      r: box.cam.r,
      q: chainGroup.quaternion.clone(),
      g: ghost,
    });

    function setState(st) {
      box.root.position.copy(st.pos);
      box.cam.r = st.r;
      chainGroup.quaternion.copy(st.q);
      if (st.g !== ghost) { ghost = st.g; applyGhost(paint); }
      box.applyCam();
    }

    box.focus = function focus(f, ms) {
      const from = snap();

      focused = f || null;
      applyView(focused && focused.view ? focused.view : viewDeclared);
      if (focused) aimAtFocus(); else reframeStill();
      if (focused && focused.ghost != null) ghost = focused.ghost;
      else if (!focused) ghost = 0;
      applyGhost(paint);

      const to = snap();
      /* rAF NEVER FIRES IN A HIDDEN TAB, and a tween there would rewind to
         where it started and never leave: the box would hold the PREVIOUS
         framing while everything else says it moved. Anything that renders a
         page without showing it — an automated check, a thumbnail capture, a
         tab left open behind another — lands there, so it takes the
         destination and skips the journey. Same trap the chain build answers
         with a setTimeout. */
      const hidden = typeof document !== 'undefined' && document.hidden;
      if (!ms || hidden || from.r === to.r && from.pos.equals(to.pos)
                 && from.q.equals(to.q) && from.g === to.g) { box.draw(); return; }

      /* Solved forward, then rewound: the destination has to be computed by
         the same fit() every other framing goes through, or a tween lands
         somewhere a resize would immediately correct. */
      setState(from);
      tween = { t: 0, ms, from, to };
      box.start();
    };

    /* SMOOTHSTEP, and the rotation SLERPS. Lerping a basis matrix takes the
       molecule through shapes it does not have; the quaternion path is the one
       turn a hand would make. The framing solved for the DESTINATION stands
       throughout, so a resize mid-tween lands on the target rather than on the
       frame being passed through — the alternative is re-solving every frame
       for a picture nobody is looking at yet. */
    function tickTween(dt) {
      if (!tween) return;
      tween.t += dt * 1000;
      const k = Math.min(1, tween.t / tween.ms);
      const e = k * k * (3 - 2 * k);
      const { from, to } = tween;
      box.root.position.lerpVectors(from.pos, to.pos, e);
      box.cam.r = from.r + (to.r - from.r) * e;
      chainGroup.quaternion.copy(from.q).slerp(to.q, e);
      const g = from.g + (to.g - from.g) * e;
      if (g !== ghost) { ghost = g; applyGhost(paint); }
      box.applyCam();
      if (k >= 1) {
        tween = null;
        solveStill();                    // the frame the reader now sees
        if (rep !== 'fold') box.stop();
      }
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
