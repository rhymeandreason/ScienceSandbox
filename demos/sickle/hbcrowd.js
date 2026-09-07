/* =============================================================================
 *  sickle/hbcrowd.js — a crowd of haemoglobins, and what HbS does that HbA does not
 * =============================================================================
 *  Classic script after lib/scene.js, kit/surface.js, kit/card-stage.js and
 *  sickle/sickle-fibre.js. Exposes window.HbCrowd on the component contract.
 *
 *      const A = HbCrowd.mount(elL, { variant: 'HbA' });               // tumble
 *      const S = HbCrowd.mount(elR, { variant: 'HbS', stick: true });  // then dock
 *      S.play();            // a lag of failed contacts, then a strand grows
 *      S.zoom(1.8);         // pull back, before a page hands off to the cell
 *
 *  ONE QUESTION: why does the mutant molecule make a fibre and the normal one
 *  not. sickle-fibre.js draws the fibre as a finished object; this draws the
 *  MOMENT — a crowded field of them, and on the HbS side one pair holding
 *  long enough to become a strand. Same tetramer, same measured seats, so what
 *  the student watches assemble is the strand that component draws whole.
 *
 *  ---- HOW IT ASSEMBLES, AND WHY NOT ONE-AT-A-TIME ------------------------------
 *
 *  Sickle polymerisation is nucleation-limited, and the delay before it starts
 *  is the whole clinical story: deoxygenated HbS sits liquid for seconds, then
 *  a fibre appears all at once. So the choreography is that shape, not a
 *  conveyor belt:
 *
 *    LAG        approaches that touch a tip and let go. Nothing holds. This is
 *               the delay, and it is the only reason a red cell gets through
 *               the capillary before it stiffens.
 *    NUCLEUS    one contact holds. Growth starts from it, in the middle of the
 *               frame — not from an end.
 *    GROWTH     both ends of the strand take molecules, several in flight at
 *               once, and the gap between arrivals shrinks as it lengthens.
 *               Roughly a third of approaches still let go.
 *
 *  A seated molecule keeps a small thermal wobble. It is held by one contact,
 *  not welded.
 *
 *  ---- MEASURED AND NOT --------------------------------------------------------
 *
 *    MEASURED   the tetramer (an SES over a deposited structure), and every
 *               seat in the strand: SickleFibre.place() with the axial repeat
 *               and lateral pair read from sickle/data/fibre.json. One code
 *               path with the fibre, so the two cannot disagree.
 *    NOT        the tumbling. It is Brownian in SHAPE — a persistent random
 *               walk with no net current, which is what motion at this scale
 *               actually is — but not in rate: real haemoglobin at 5 mM is
 *               packed shoulder to shoulder and reorients in nanoseconds, and
 *               this is a crowd at a walking pace so a reader can follow one.
 *               state() reports no speed for that reason.
 *
 *  The strand here is STRAIGHT (pitch → ∞), which is the reference
 *  SickleFibre.strainOf measures against: a lesson about the first contacts has
 *  no business showing a twist that is a property of the whole fibre.
 *
 *  ---- PARAMS ------------------------------------------------------------------
 *
 *    variant  'HbA' | 'HbS'   which surface, and which colour the β6 mark takes
 *    n        a CAP on the crowd (rebuild, snaps). The room is sized to the
 *             frame and filled at a fixed density, so leaving this alone is
 *             normal; lowering it thins the crowd out for a bench
 *    grow     seats the strand fills before it calls itself done (of SEATS)
 *    stick    whether play() has anything to do
 *    lay      0 standing .. 1 lying — glides; rotates the seated strand only.
             Set at mount to build along the horizontal from the first molecule
 *    drift    rms speed of the free molecules' Brownian walk, scene units per
 *             second — a choreography number, not a diffusion coefficient
 *    base     path prefix to demos/ from the page ('' at the top level)
 *
 *  THE β6 MARK IS THE ONLY COLOUR THAT CHANGES BETWEEN VARIANTS. HbS paints it
 *  the fibre's patch orange (SickleFibre.COLOURS.patch); HbA paints it the
 *  site's charge blue, read from the `--cold` token so the caption that calls
 *  glutamate charged and the spot it names cannot drift. Both β chains carry
 *  the mark on both variants: in the crystal only one of the two is ever in a
 *  contact, but a free molecule has not chosen yet.
 *
 *  Anchors for note(): patch · chain. Events: dock (seated count), done.
 * ========================================================================== */
(function (global) {
  'use strict';

  const MAX = 240;                    // molecules the instanced mesh can hold
  const SEATS = 48;                    // seats the strand has, whatever the crowd is
  const DEFAULTS = { variant: 'HbS', n: MAX, grow: 22, stick: false, lay: 0, drift: 22, base: '' };

  /* ---- THE ROOM, AND WHY IT IS CROWDED ------------------------------------
     A molecule must not cross the frame to reach the strand. It did, when the
     crowd was a dozen: the nearest free tetramer to a new seat was three body
     lengths away and flew there, which is the one thing that reads as staged.
     So the room is sized to hold `n` molecules at a fixed AREA FRACTION —
     about a third of a diameter between neighbours — and a molecule joining
     the strand is one that was already touching it.

     It is a SLAB one molecule deep, not a box. Real cytoplasm is crowded in
     all three, and in all three you would see nothing: the strand would form
     behind a wall of haemoglobin. A monolayer is the honest compromise, and
     it is the same one every textbook diagram of this makes silently. */
  const R_MOL = 37;                   // the tetramer's radius, near enough
  const PACK = 0.34;                  // of the slab's area the crowd covers
  const OVER = 1.55;                  // how far the room runs past the frame
  const SLAB = 30;                    // half-depth: about one molecule
  const ASPECT = 1.45;
  const DOCK_S = 0.5;                 // one approach, seconds
  /* Choreography, all of it — the real delay is seconds and the real growth is
     microns a second. What is preserved is the SHAPE: a lag of failures, then
     acceleration from a nucleus, at both ends, with contacts still letting go. */
  const LAG_S = 1.8;                  // failed approaches before anything holds
  const HOLD_S = 0.3;                 // how long a contact that fails holds on
  const LEAVE_S = 0.55;               // and how long it takes to drift back off
  const ABORT_P = 0.4;                // approaches that let go at the nucleus
  const GAP0 = 0.5, GAP1 = 0.12;      // seconds between approaches, first to last
  const CONC = 3;                     // approaches in flight at once
  /* The Brownian walk. TAU is how long a free molecule keeps a heading, RTAU
     the same for its tumble; both are choreography, chosen so a reader can
     follow one molecule, and state() reports no speed because of it. */
  const TAU = 0.55, RTAU = 0.9, RKICK = 1.4;
  const AXES = ['x', 'y', 'z'];
  const SURF = {
    HbA: 'hemoglobin/data/2HHB.card.surf.bin',
    HbS: 'sickle/data/2HBS-T1.surf.bin',
  };

  const tokenHex = (name, fallback) => {
    try {
      const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      const m = /^#([0-9a-f]{6})$/i.exec(v);
      return m ? parseInt(m[1], 16) : fallback;
    } catch (e) { return fallback; }
  };
  /* The β6 mark's colour per variant, exported so a page marking the same
     residue on a Proteinbox paints it the same: the fibre's patch orange for
     HbS, the site's charge blue for HbA. */
  const markOf = v => (v === 'HbS'
    ? global.SickleFibre.COLOURS.patch
    : tokenHex('--cold', 0x2f6fb5));

  function create(THREE, root, camera, opts) {
    const F = global.SickleFibre;
    if (!F) throw new Error('hbcrowd.js: load sickle/sickle-fibre.js first');
    const P = Object.assign({}, DEFAULTS, opts);
    P.n = Math.max(2, Math.min(MAX, Math.round(P.n)));
    P.grow = Math.max(2, Math.min(SEATS, Math.round(P.grow)));
    const listeners = {};
    const emit = (ev, a) => (listeners[ev] || []).forEach(f => f(a));
    const tw = global.CardStage ? global.CardStage.tweens() : null;

    const grp = new THREE.Group();      // the seated strand; lay turns this
    root.add(grp);

    let D = null, S = null, mesh = null;
    let molR = 32, axial = 63;
    let seats = [];                     // Matrix4 per docking slot, strand-local
    let mols = [];
    let playing = false, done = false, clock = 0, nextAt = 0, T = 0;
    const taken = new Array(SEATS).fill(false);
    let ORDER = [];
    let rng = seeded(11);
    const ROOM = { x: 0, y: 0, z: 0 };
    let R_FREE = 135;                   // what the camera frames before anything docks
    /* THE FRAME COMES FIRST AND THE CROWD FILLS IT. The room runs half again
       past every edge of what the camera holds, so the crowd has no visible
       boundary, and `n` is then whatever fills that room at PACK — a count,
       not a composition. The `n` param is a CAP on it, for a bench that wants
       to see the thing thin out; it cannot make the crowd denser than PACK. */
    let nWant = 0;
    function sizeRoom() {
      R_FREE = ((P.grow / 2 - 1) / 2) * axial + R_MOL * 1.6;
      ROOM.y = R_FREE * OVER;
      ROOM.x = ROOM.y * ASPECT;
      ROOM.z = SLAB;
      nWant = Math.min(MAX, P.n,
        Math.round(4 * ROOM.x * ROOM.y * PACK / (Math.PI * R_MOL * R_MOL)));
      /* THE CAMERA FRAMES THE FINISHED STRAND —
         from the first frame, before there is one. Two reasons. The crowd runs
         off every edge, which is what looking into cytoplasm is, and framing
         the room instead puts a visible boundary around a thing that has none.
         And sizing the frame to the END of the beat means the camera does not
         move during it: growth is what should be moving, not the view.

         Seats fill outward from repeat 0, so `grow` seats reach ±(grow/4)
         repeats. */
    }

    /* Sum of three uniforms: near enough to normal for a kick, and it costs
       nothing. Box-Muller would buy accuracy nothing here can see. */
    const gauss = () => (rng() + rng() + rng() - 1.5) * 2;
    /* Per-axis kick that holds the crowd at `drift` rms speed: an OU walk
       settles at sigma*sqrt(TAU/2) per axis. */
    let SIGMA = 0;
    function sizeWalk() { SIGMA = (P.drift / Math.sqrt(3)) / Math.sqrt(TAU / 2); }

    /* A LATTICE IS NEVER SEEN. spawn() lays the crowd on a jittered grid so
       nothing starts inside anything, which is a grid, and the beat opens on
       it. Walking it forward a couple of seconds before the first frame costs
       one hitch at step entry and buys a crowd that was never in rows. */
    function warm() { for (let i = 0; i < 90; i++) step(1 / 30); }

    function seeded(seed) { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }

    /* ---- the molecules ---------------------------------------------------- */

    const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4();
    const _s = new THREE.Vector3(1, 1, 1);
    /* Where the bake's centroid sits, undone per instance. NOT geo.center():
       the decoder's normals are normalized int8 and r128 writes a translated
       normal back into them as zeros, which draws every molecule black. */
    const offV = new THREE.Vector3(), offM = new THREE.Matrix4();
    const _wq = new THREE.Quaternion(), _wm = new THREE.Matrix4(), _wv = new THREE.Vector3();

    function spawn() {
      rng = seeded(11 + P.n);
      sizeRoom(); sizeWalk();
      mols = [];
      /* Spread across the room on a jittered grid, so twelve molecules never
         start inside one another; the wander takes it from there. */
      const N = nWant;
      const cols = Math.ceil(Math.sqrt(N * ROOM.x / ROOM.y)), rows = Math.ceil(N / cols);
      const jx = ROOM.x / cols * 0.55, jy = ROOM.y / rows * 0.55;
      for (let i = 0; i < N; i++) {
        const cx = (i % cols + 0.5) / cols * 2 - 1, cy = (Math.floor(i / cols) + 0.5) / rows * 2 - 1;
        const axis = new THREE.Vector3(rng() - .5, rng() - .5, rng() - .5).normalize();
        mols.push({
          pos: new THREE.Vector3(cx * ROOM.x + (rng() - .5) * jx,
                                 cy * ROOM.y + (rng() - .5) * jy,
                                 (rng() - .5) * ROOM.z),
          q: new THREE.Quaternion().setFromAxisAngle(axis, rng() * 6.283),
          spin: axis.clone().multiplyScalar(0.25 + rng() * 0.35),
          vel: new THREE.Vector3(gauss(), gauss(), gauss() * 0.45).multiplyScalar(P.drift / Math.sqrt(3)),
          state: 'free', seat: -1, t: 0, dur: 0, a: null, b: null, bow: null,
          /* Its own phase, so a seated strand breathes rather than pulsing. */
          ph: rng() * 6.283, wob: new THREE.Vector3(rng() - .5, rng() - .5, rng() - .5).normalize(),
        });
      }
    }

    /* ---- the seats: the measured strand, out from the middle -----------------
       Slot 2j is tetramer i of the strand, slot 2j+1 its lateral partner: the
       pair the crystal puts side by side, then the axial repeat, exactly as
       sickle-fibre.js places them, and straight (pitch 1e12).

       THE REPEAT INDEX IS SIGNED and the nucleus is repeat 0, because a fibre
       does not start at one end. ORDER is the seats in the sequence they fill:
       the nucleating pair, then alternately up and down the strand, so both
       ends grow and neither is where it began. */
    const REP0 = SEATS >> 2;            // seat 2*REP0 is repeat 0
    function buildSeats() {
      const upright = F.uprightOf(D);
      const pair = F.Mat.fromRT(D.pair.R, D.pair.t);
      seats = [];
      for (let k = 0; k < SEATS; k++) {
        const i = (k >> 1) - REP0;
        let m = F.place(D, { rad: 0, ang: 0 }, i, 1e12, upright);
        if (k & 1) m = F.Mat.mul(m, pair);
        seats.push(new THREE.Matrix4().set(...m));
      }
      ORDER = [2 * REP0, 2 * REP0 + 1];
      for (let d = 1; d <= REP0; d++) {
        for (const i of [REP0 + d, REP0 - d]) {
          if (i < 0 || 2 * i + 1 >= SEATS) continue;
          ORDER.push(2 * i, 2 * i + 1);
        }
      }
    }

    /* Where the seated strand's middle is, strand-local. The lay rotation is
       about this point, so turning the strand over does not swing it across
       the room. */
    const chainMid = new THREE.Vector3();
    function midOf() {
      chainMid.set(0, 0, 0);
      let k = 0;
      for (const m of mols) if (m.state === 'seated') { chainMid.add(_v.setFromMatrixPosition(seats[m.seat])); k++; }
      if (k) chainMid.multiplyScalar(1 / k);
      return chainMid;
    }
    function applyLay() {
      const c = midOf();
      grp.quaternion.setFromAxisAngle(_v.set(0, 0, 1), -P.lay * Math.PI / 2);
      grp.position.copy(c).sub(_v.copy(c).applyQuaternion(grp.quaternion));
      grp.updateMatrixWorld(true);
    }

    /* ---- the surface ------------------------------------------------------ */

    function paint() {
      if (!S) return;
      const betaSix = new Set(['B:6', 'D:6']);
      const mark = new THREE.Color(markOf(P.variant));
      const skin = new THREE.Color(F.COLOURS.skin);
      const col = global.SurfLib.colors(S, (chain, num) =>
        betaSix.has(chain + ':' + num) ? [mark.r, mark.g, mark.b] : null,
        [skin.r, skin.g, skin.b]);
      S.geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    }

    function install(surf) {
      if (mesh) { root.remove(mesh); mesh.geometry.dispose(); mesh.material.dispose(); }
      S = surf;
      /* The HbA card bake is centred on its trace; only the HbS bake shares the
         fibre's frame, and only the HbS bake needs to (its seats are in it).
         A free molecule turns about its own centroid either way. */
      S.geo.computeBoundingSphere();
      molR = S.geo.boundingSphere.radius;
      if (P.variant === 'HbS') offV.set(0, 0, 0); else offV.copy(S.geo.boundingSphere.center).negate();
      offM.makeTranslation(offV.x, offV.y, offV.z);
      paint();
      const mat = global.Stage.bondMat(0xffffff);
      mat.vertexColors = true;
      mesh = new THREE.InstancedMesh(S.geo, mat, MAX);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      root.add(mesh);
      upload();
    }

    function upload() {
      if (!mesh) return;
      let n = 0;
      for (const m of mols) {
        if (m.state === 'seated') {
          /* Held by one contact, not welded: sub-ångström, but it is the
             difference between a crystal and a thing in water. */
          const w = Math.sin(T * 2.1 + m.ph);
          _wq.setFromAxisAngle(m.wob, 0.014 * w);
          _wm.compose(_wv.copy(m.wob).multiplyScalar(0.6 * Math.sin(T * 1.7 + m.ph * 1.6)), _wq, _s);
          _m.copy(grp.matrixWorld).multiply(seats[m.seat]).multiply(_wm);
        } else _m.compose(m.pos, m.q, _s).multiply(offM);
        mesh.setMatrixAt(n++, _m);
      }
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
    }

    /* ---- motion ------------------------------------------------------------ */

    const _d = new THREE.Vector3(), _e = new THREE.Vector3();
    /* Seated positions in world space, refreshed each frame from a pool: this
       runs every frame and a fresh Vector3 per seat per frame is pure churn. */
    const strandPts = [], strandPool = [];
    let nStrand = 0;
    function step(dt) {
      if (tw) tw.update(dt);
      T += dt;
      const free = mols.filter(m => m.state === 'free');
      /* The strand's world positions, once for the whole crowd rather than
         once per molecule per neighbour. */
      nStrand = 0;
      for (const m of mols) {
        if (m.state !== 'seated') continue;
        const v = strandPool[nStrand] || (strandPool[nStrand] = new THREE.Vector3());
        v.setFromMatrixPosition(_m.copy(grp.matrixWorld).multiply(seats[m.seat]));
        strandPts[nStrand++] = v;
      }
      for (const m of free) {
        /* BROWNIAN, NOT A CURRENT. Velocity is an Ornstein-Uhlenbeck walk: it
           is dragged toward zero over TAU and kicked at random, so a molecule
           holds a heading for about a body length and then loses it. No shared
           direction, no wrap-around, and the crowd goes nowhere on average —
           which is the honest picture of cytoplasm, where the only transport
           at this scale IS diffusion.

           A plain per-frame jitter is the other wrong answer: it is white
           noise, it reads as a bad frame rate, and it is frame-rate dependent
           besides. The persistence is what makes it look like a molecule. */
        const kick = SIGMA * Math.sqrt(dt);
        m.vel.multiplyScalar(Math.max(0, 1 - dt / TAU));
        m.vel.x += gauss() * kick; m.vel.y += gauss() * kick; m.vel.z += gauss() * kick * 0.45;
        /* The room's walls as a soft spring rather than a bounce: nothing here
           is a collision, and a molecule pushed back in keeps its history. */
        for (const ax of AXES) {
          const over = Math.abs(m.pos[ax]) - ROOM[ax];
          if (over > 0) m.vel[ax] -= Math.sign(m.pos[ax]) * (25 + over * 6) * dt;
        }
        /* Crowding. Two free molecules do not pass through each other, and
           nothing swims through the strand — which only starts to matter at
           this density, where the strand grows inside the crowd rather than
           in a clearing. Squared distance first: this is the one O(n²) loop
           and it runs on every free molecule every frame. */
        const min = molR * 1.9, min2 = min * min;
        for (const o of free) {
          if (o === m) continue;
          _d.subVectors(m.pos, o.pos);
          const d2 = _d.lengthSq();
          if (d2 > 0 && d2 < min2) {
            const d = Math.sqrt(d2);
            m.vel.addScaledVector(_d.multiplyScalar(1 / d), (min - d) * 1.5);
          }
        }
        /* Closer to the strand than to each other: it is a surface to lie
           against, and a wide exclusion round it reads as a keep-out zone. */
        const smin = molR * 1.65, smin2 = smin * smin;
        for (let i = 0; i < nStrand; i++) {
          _d.subVectors(m.pos, strandPts[i]);
          const d2 = _d.lengthSq();
          if (d2 > 0 && d2 < smin2) {
            const d = Math.sqrt(d2);
            m.vel.addScaledVector(_d.multiplyScalar(1 / d), (smin - d) * 2.2);
          }
        }
        m.pos.addScaledVector(m.vel, dt);
        /* Rotational diffusion: the axis itself wanders, so a molecule tumbles
           instead of spinning like a top about one axis for the whole beat. */
        m.spin.x += gauss() * RKICK * Math.sqrt(dt);
        m.spin.y += gauss() * RKICK * Math.sqrt(dt);
        m.spin.z += gauss() * RKICK * Math.sqrt(dt);
        m.spin.multiplyScalar(Math.max(0, 1 - dt / RTAU));
        const w = m.spin.length();
        if (w > 1e-6) { _q.setFromAxisAngle(_e.copy(m.spin).multiplyScalar(1 / w), w * dt); m.q.premultiply(_q); }
      }
      for (const m of mols) {
        if (m.state === 'docking' || m.state === 'leaving') {
          m.t = Math.min(1, m.t + dt / m.dur);
          /* Not a straight slide: a bowed path with a small overshoot at the
             seat, so a molecule arrives the way a thing settling into a fit
             does rather than the way a part slots into a jig. */
          const k = m.t, ease = 1 - Math.pow(1 - k, 3);
          const over = m.state === 'docking' ? 1 + 0.08 * Math.sin(Math.PI * k) * (1 - k) : 1;
          m.pos.lerpVectors(m.a.pos, m.b.pos, ease * over);
          m.pos.addScaledVector(m.bow, Math.sin(Math.PI * ease));
          m.q.slerpQuaternions(m.a.q, m.b.q, ease);
          if (m.t >= 1) arrived(m);
        } else if (m.state === 'holding') {
          /* It has the contact. Whether it keeps it is decided already; this
             is the beat in which a reader can see that it tried. */
          m.t += dt / HOLD_S;
          if (m.t >= 1) release(m);
        }
      }
      if (playing) {
        clock += dt;
        while (clock >= nextAt) { nextAt += gap(); attempt(); }
        if (finished()) { playing = false; done = true; emit('done', state()); }
      }
      upload();
    }

    /* ---- who approaches what, and when ---------------------------------------- */

    const inFlight = () => mols.reduce((k, m) => k + (m.state !== 'free' && m.state !== 'seated' ? 1 : 0), 0);
    const finished = () => !inFlight() && (seatedCount() >= P.grow || frontier(0) < 0
      || !mols.some(m => m.state === 'free'));

    /* Approaches come faster as the strand lengthens: more tip to hit, and
       more of the crowd already committed. */
    function gap() {
      const u = seatedCount() / P.grow;
      return (clock < LAG_S ? 0.55 : GAP0 + (GAP1 - GAP0) * u) * (0.7 + rng() * 0.6);
    }

    /* The nth seat in ORDER nobody holds or is heading for. 0 is the tip a
       molecule that means to stay goes to; 1 is where a failed approach
       touches, so two approaches never share a seat. */
    function frontier(skip) {
      let s = 0;
      for (const k of ORDER.slice(0, P.grow)) {
        if (taken[k]) continue;
        if (s++ === skip) return k;
      }
      return -1;
    }

    function attempt() {
      if (inFlight() >= CONC) return;
      /* Nothing holds during the lag. After it, a short strand still loses
         contacts often; a long one barely does, which is why polymerisation
         runs away once it starts. */
      const u = seatedCount() / P.grow;
      const abort = clock < LAG_S || rng() < ABORT_P * (1 - u);
      const k = frontier(abort ? 1 : 0);
      if (k < 0) return;
      _m.copy(grp.matrixWorld).multiply(seats[k]);
      _d.setFromMatrixPosition(_m);
      /* The seat takes the free molecule nearest to it, which is what "the
         greasy spot catches on whatever is passing" looks like. */
      let best = null, bd = Infinity;
      for (const m of mols) {
        if (m.state !== 'free') continue;
        const d = m.pos.distanceTo(_d);
        if (d < bd) { bd = d; best = m; }
      }
      if (!best) return;
      taken[k] = true;
      best.seat = k; best.abort = abort;
      _m.decompose(_d, _q, _e);
      begin(best, 'docking', { pos: _d.clone(), q: _q.clone() }, DOCK_S * (0.8 + rng() * 0.5));
    }

    function begin(m, state, to, dur) {
      m.state = state; m.t = 0; m.dur = dur;
      m.a = { pos: m.pos.clone(), q: m.q.clone() };
      m.b = to;
      /* Which way the path bows: sideways to the approach, a random hand. */
      _e.subVectors(m.b.pos, m.a.pos);
      m.bow = new THREE.Vector3(-_e.y, _e.x, (rng() - .5) * 40).normalize()
        .multiplyScalar((rng() < .5 ? -1 : 1) * (18 + rng() * 22));
    }

    function arrived(m) {
      if (m.state === 'leaving') {
        m.state = 'free'; m.seat = -1; m.vel.set(0, 0, 0);
        return;
      }
      if (m.abort) { m.state = 'holding'; m.t = 0; return; }
      m.state = 'seated';
      emit('dock', seatedCount());
    }

    /* A contact that does not hold. It backs off along the way it came, a
       little further out, and rejoins the crowd. */
    function release(m) {
      taken[m.seat] = false;
      _v.subVectors(m.a.pos, m.pos).normalize().multiplyScalar(molR * 0.9);
      begin(m, 'leaving', { pos: m.a.pos.clone().add(_v), q: m.a.q.clone() }, LEAVE_S);
    }

    const seatedCount = () => mols.reduce((k, m) => k + (m.state === 'seated' ? 1 : 0), 0);

    function play() {
      if (!P.stick || !D || playing || done) return api;
      playing = true; clock = 0; nextAt = 0.25;
      return api;
    }
    function reset() {
      playing = false; done = false; clock = 0; nextAt = 0; T = 0;
      taken.fill(false);
      if (tw) tw.cancel();
      /* lay is a setting, not progress: a strand mounted lying rebuilds lying. */
      spawn(); applyLay(); warm(); upload();
      emit('dock', 0);
      return api;
    }

    /* ---- what the camera should hold ------------------------------------------
       A patch of the crowd until there is a strand, then the strand, which
       outgrows the patch by about its third repeat. World space, so the lay
       rotation leaves it alone. */
    function focus() {
      const seated = mols.filter(m => m.state === 'seated');
      const out = { centre: new THREE.Vector3(), radius: R_FREE };
      if (!seated.length) return out;
      for (const m of seated) out.centre.add(_v.setFromMatrixPosition(_m.copy(grp.matrixWorld).multiply(seats[m.seat])));
      out.centre.multiplyScalar(1 / seated.length);
      let r = 0;
      for (const m of seated) r = Math.max(r, out.centre.distanceTo(_v.setFromMatrixPosition(_m.copy(grp.matrixWorld).multiply(seats[m.seat]))));
      out.radius = Math.max(r + molR * 1.2, R_FREE);
      return out;
    }

    /* ---- set / state ----------------------------------------------------------- */

    function set(nextP, o) {
      if (!nextP) return api;
      const snap = (o && o.snap) || !tw;
      if (nextP.lay !== undefined && nextP.lay !== P.lay) {
        const to = Math.max(0, Math.min(1, nextP.lay));
        if (snap) { P.lay = to; applyLay(); }
        else tw.to(P.lay, to, o && o.seconds || 1.4, v => { P.lay = v; applyLay(); }, { key: 'lay', ease: 'smooth' });
      }
      if (nextP.drift !== undefined) { P.drift = nextP.drift; sizeWalk(); }
      if (nextP.stick !== undefined) P.stick = !!nextP.stick;
      if (nextP.grow !== undefined) P.grow = Math.max(2, Math.min(SEATS, Math.round(nextP.grow)));
      if (nextP.n !== undefined && Math.round(nextP.n) !== P.n) {
        P.n = Math.max(2, Math.min(MAX, Math.round(nextP.n)));
        reset();
      }
      if (nextP.variant && nextP.variant !== P.variant && SURF[nextP.variant]) {
        P.variant = nextP.variant;
        reset();
        loadSurface();
      }
      return api;
    }

    function state() {
      const seated = seatedCount();
      const repeats = Math.ceil(seated / 2);
      return {
        variant: P.variant, n: mols.length, grow: P.grow, free: mols.length - seated, seated, repeats,
        stick: P.stick, lay: P.lay, playing, done,
        /* Which beat of the assembly this is: nothing holding yet, or growing. */
        phase: !playing && !done ? 'idle' : done ? 'done' : (seated ? 'growing' : 'lag'),
        /* The strand's length is the measured axial repeat times the repeats
           on stage; the crowd's drift is choreography and is not reported. */
        lengthA: axial * repeats, lengthNm: axial * repeats / 10,
        measured: { source: 'fibre.json (2HBS)', axialA: axial },
      };
    }

    /* ---- anchors ----------------------------------------------------------------- */

    const _a = new THREE.Vector3();
    const firstMol = () => mols.find(m => m.state === 'seated') || mols[0];
    const anchors = {
      patch: () => {
        const m = firstMol();
        if (!m || !D) return null;
        const mk = D.marks.find(x => x.donates) || D.marks[0];
        _a.fromArray(mk.beta6);
        if (m.state === 'seated') return _a.applyMatrix4(_m.copy(grp.matrixWorld).multiply(seats[m.seat]));
        return _a.add(offV).applyQuaternion(m.q).add(m.pos);
      },
      chain: () => (seatedCount() ? focus().centre : null),
    };
    const library = {
      patch: { text: 'β6', card: P.variant === 'HbS'
        ? 'The greasy spot. One valine where normal haemoglobin has a charged glutamate.'
        : 'A charged glutamate. It sits happily in water, and nothing sticks to it.' },
      chain: { text: 'the strand', card: 'Each molecule holds the next by the same contact. Straight here; in the cell, seven of these twist into a fibre.' },
    };

    /* ---- load ----------------------------------------------------------------- */

    function loadSurface() {
      return fetch(P.base + SURF[P.variant]).then(r => {
        if (!r.ok) throw new Error(SURF[P.variant] + ' — HTTP ' + r.status);
        return r.arrayBuffer();
      }).then(buf => { install(global.SurfLib.decode(THREE, buf)); emit('load', state()); });
    }
    function load() {
      return fetch(P.base + 'sickle/data/fibre.json').then(r => {
        if (!r.ok) throw new Error('sickle/data/fibre.json — HTTP ' + r.status);
        return r.json();
      }).then(json => {
        D = json;
        axial = F.axialLenOf(D);
        /* The frame, and so the room and the crowd in it, is an axial repeat's
           business — and that arrives with the file. */
        sizeRoom(); spawn(); applyLay(); warm();
        buildSeats();
        return loadSurface();
      }).then(() => api);
    }

    spawn();

    const api = {
      step, state, set, play, reset, focus, load, anchors, library, params: P,
      get molR() { return molR; },
      on(ev, fn) { (listeners[ev] || (listeners[ev] = [])).push(fn);
        return () => { const i = listeners[ev].indexOf(fn); if (i >= 0) listeners[ev].splice(i, 1); }; },
      dispose() { if (mesh) { root.remove(mesh); mesh.geometry.dispose(); mesh.material.dispose(); } root.remove(grp); },
    };
    return api;
  }

  /* ---- mount ------------------------------------------------------------------- */

  function mount(el, params = {}) {
    if (!global.CardStage) throw new Error('hbcrowd.js: load kit/card-stage.js first');
    if (!global.SurfLib) throw new Error('hbcrowd.js: load kit/surface.js first');
    let sim = null, nb = null;
    const listeners = {};
    const emit = (ev, ...a) => (listeners[ev] || []).forEach(f => f(...a));

    const box = global.CardStage.create({
      mount: el,
      cam: params.cam || { theta: 0.3, phi: 1.35, r: 520 },
      stage: Object.assign({ rMin: 90, rMax: 8000 }, params.stage || {}),
      step: dt => { if (sim) { sim.step(dt); camTw.update(dt); emit('frame', api.state(), dt); } },
      afterFrame: () => { if (nb) nb.step(); },
      onResize: () => frame(0, true),
      viewOffset: params.viewOffset,
    });
    box.camera.far = 40000;
    box.camera.updateProjectionMatrix();

    sim = create(THREE, box.root, box.camera, params);
    const camTw = global.CardStage.tweens();

    /* Fit the focus sphere in the room the panel leaves — sickle-fibre.js's
       rule, and the same arithmetic. Tweened, because it is called after
       every docking and a camera that jumps twelve times is not a zoom.

       AND IT ONLY EVER PULLS BACK. focus()'s radius is the larger of what the
       strand needs and what is left of the crowd's claim, and those two cross
       over: the crowd's shrinks as the strand's grows, so a camera that obeyed
       the number would breathe in and out a dozen times while the reader is
       trying to watch one contact. `held` is the widest it has had to be, and
       a refit under it plus a margin is not worth a move at all. */
    const tgtFrom = new THREE.Vector3(), tgtTo = new THREE.Vector3();
    let held = 0;
    function frame(dur = 0.9, relax) {
      /* CardStage.create lays out once, synchronously, before `sim` exists. */
      if (!sim) return;
      const f = sim.focus();
      const cam = box.camera;
      const half = THREE.MathUtils.degToRad(cam.fov) / 2;
      const W = box.canvas.clientWidth || 1, H = box.canvas.clientHeight || 1;
      const fn = params.viewOffset || el.viewOffset;
      const off = fn ? fn(W, H) : null;
      const fx = off ? Math.max(0.25, (W - Math.abs(off.x || 0) * 2) / W) : 1;
      const fy = off ? Math.max(0.25, (H - Math.abs(off.y || 0) * 2) / H) : 1;
      const av = Math.atan(Math.tan(half) * fy);
      const ah = Math.atan(Math.tan(half) * Math.max(cam.aspect, 0.1) * fx);
      const fit = a => f.radius / Math.max(Math.sin(a), 0.05);
      let r = Math.max(fit(av), fit(ah)) * 1.08;
      if (relax) held = 0;
      if (r < held * 1.06) {
        /* Close enough. Follow the centre if the strand has drifted off it,
           and leave the distance where it is. */
        if (box.cam.target.distanceTo(f.centre) < sim.molR * 0.4) return;
        r = box.cam.r;
      }
      held = Math.max(held, r);
      tgtFrom.copy(box.cam.target); tgtTo.copy(f.centre);
      const r0 = box.cam.r;
      camTw.to(0, 1, dur, u => {
        box.cam.r = r0 + (r - r0) * u;
        box.cam.target.lerpVectors(tgtFrom, tgtTo, u);
        box.applyCam();
        if (!box.running) box.draw();
      }, { key: 'fit', ease: 'smooth' });
    }
    sim.on('dock', () => frame(0.9));
    /* Pull back by a factor, for a page that wants room before it hands off. */
    function zoom(factor, dur = 2) {
      const r0 = box.cam.r, r1 = Math.min(r0 * factor, 7800);
      camTw.to(r0, r1, dur, v => { box.cam.r = v; box.applyCam(); if (!box.running) box.draw(); },
        { key: 'fit', ease: 'smooth' });
    }

    const ready = sim.load().then(() => {
      nb = global.Notebook ? global.Notebook.create({ box, anchors: sim.anchors, library: sim.library }) : null;
      frame(0);
      box.draw();
      return api;
    }).catch(e => { console.warn('HbCrowd: ' + e.message); return api; });

    const api = {
      sim, box, ready,
      set(next, o) { sim.set(next, o); return api; },
      state: () => sim.state(),
      play() { sim.play(); return api; },
      reset() { sim.reset(); frame(0.6, true); return api; },
      zoom(f, dur) { zoom(f, dur); return api; },
      on(ev, fn) {
        if (ev === 'frame') { (listeners.frame || (listeners.frame = [])).push(fn);
          return () => { const i = listeners.frame.indexOf(fn); if (i >= 0) listeners.frame.splice(i, 1); }; }
        return sim.on(ev, fn);
      },
      note: (n, o) => nb && nb.note(n, o), notes: n => nb && nb.notes(n),
      clearNotes: () => nb && nb.clear(), anchors: () => (nb ? nb.list() : []),
      start: box.start, stop: box.stop, pump: box.pump, draw: box.draw,
      destroy() { if (nb) nb.clear(); sim.dispose(); box.destroy(); },
    };
    return api;
  }

  global.HbCrowd = { create, mount, markOf, DEFAULTS, MAX, SEATS, SURF };
  /* Scale (kit/scale.js, docs/Scale.md). One scene unit is one ångström: the
     tetramer is a lab's and every seat is the fibre bake's, so a page may print
     the strand's length off state(). The crowd's motion is choreography, not a
     diffusion rate, and state() reports no speed for that reason. Bulk, because
     the subject is many molecules at once; the strand they make is the same
     rung, so SickleFibre may take over the same scene. */
  global.HbCrowd.SCALE = {
    rung: 'macromolecule', form: 'bulk', unit: 1e-10,
    sceneUnits: [], exag: {}, down: {},
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
