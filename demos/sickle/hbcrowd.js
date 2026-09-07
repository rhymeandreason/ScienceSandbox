/* =============================================================================
 *  sickle/hbcrowd.js — a crowd of haemoglobins, and what HbS does that HbA does not
 * =============================================================================
 *  Classic script after lib/scene.js, kit/surface.js, kit/card-stage.js and
 *  sickle/sickle-fibre.js. Exposes window.HbCrowd on the component contract.
 *
 *      const A = HbCrowd.mount(elL, { variant: 'HbA' });               // tumble
 *      const S = HbCrowd.mount(elR, { variant: 'HbS', stick: true });  // then dock
 *      S.play();            // molecules dock one by one into the measured strand
 *      S.zoom(1.8);         // pull back, before a page hands off to the cell
 *
 *  ONE QUESTION: why does the mutant molecule make a fibre and the normal one
 *  not. sickle-fibre.js draws the fibre as a finished object; this draws the
 *  MOMENT — a dozen molecules tumbling, and on the HbS side one pair holding
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
 *    NOT        the tumbling. Real haemoglobin at 5 mM is packed shoulder to
 *               shoulder and turns in nanoseconds; this is a dozen molecules at
 *               a walking pace so a reader can follow one. `drift` is a
 *               choreography number and state() does not dress it as a rate.
 *
 *  The strand here is STRAIGHT (pitch → ∞), which is the reference
 *  SickleFibre.strainOf measures against: a lesson about the first contacts has
 *  no business showing a twist that is a property of the whole fibre.
 *
 *  ---- PARAMS ------------------------------------------------------------------
 *
 *    variant  'HbA' | 'HbS'   which surface, and which colour the β6 mark takes
 *    n        molecules on stage (rebuild, snaps; capped at MAX)
 *    stick    whether play() has anything to do
 *    lay      0 standing .. 1 lying — glides; rotates the seated strand only.
             Set at mount to build along the horizontal from the first molecule
 *    drift    scene units per second the free molecules travel (choreography)
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

  const MAX = 48;
  const DEFAULTS = { variant: 'HbS', n: 12, stick: false, lay: 0, drift: 22, base: '' };

  /* The room the free molecules wander in, in ångströms, for a dozen 65 Å
     tetramers; it grows with the square root of the count so a crowd of
     thirty is as dense as a crowd of twelve. Nothing about it is a cytoplasm. */
  const ROOM12 = { x: 150, y: 105, z: 45 };
  const R_FREE12 = 135;               // what the camera frames before anything docks
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
    const taken = new Array(MAX).fill(false);
    let ORDER = [];
    let rng = seeded(11);
    const ROOM = { x: 0, y: 0, z: 0 };
    let R_FREE = R_FREE12;
    function sizeRoom() {
      const k = Math.sqrt(P.n / 12);
      ROOM.x = ROOM12.x * k; ROOM.y = ROOM12.y * k; ROOM.z = ROOM12.z * Math.sqrt(k);
      R_FREE = R_FREE12 * k;
    }

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
      sizeRoom();
      mols = [];
      /* Spread across the room on a jittered grid, so twelve molecules never
         start inside one another; the wander takes it from there. */
      const cols = Math.ceil(Math.sqrt(P.n * ROOM.x / ROOM.y)), rows = Math.ceil(P.n / cols);
      for (let i = 0; i < P.n; i++) {
        const cx = (i % cols + 0.5) / cols * 2 - 1, cy = (Math.floor(i / cols) + 0.5) / rows * 2 - 1;
        const axis = new THREE.Vector3(rng() - .5, rng() - .5, rng() - .5).normalize();
        mols.push({
          pos: new THREE.Vector3(cx * ROOM.x * 0.85 + (rng() - .5) * 20,
                                 cy * ROOM.y * 0.8 + (rng() - .5) * 20,
                                 (rng() - .5) * ROOM.z),
          q: new THREE.Quaternion().setFromAxisAngle(axis, rng() * 6.283),
          spin: axis.clone().multiplyScalar(0.25 + rng() * 0.35),
          vel: new THREE.Vector3(0, 0, 0),
          wander: new THREE.Vector3(),
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
    const REP0 = MAX >> 2;              // seat 2*REP0 is repeat 0
    function buildSeats() {
      const upright = F.uprightOf(D);
      const pair = F.Mat.fromRT(D.pair.R, D.pair.t);
      seats = [];
      for (let k = 0; k < MAX; k++) {
        const i = (k >> 1) - REP0;
        let m = F.place(D, { rad: 0, ang: 0 }, i, 1e12, upright);
        if (k & 1) m = F.Mat.mul(m, pair);
        seats.push(new THREE.Matrix4().set(...m));
      }
      ORDER = [2 * REP0, 2 * REP0 + 1];
      for (let d = 1; d <= REP0; d++) {
        for (const i of [REP0 + d, REP0 - d]) {
          if (i < 0 || 2 * i + 1 >= MAX) continue;
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
    function step(dt) {
      if (tw) tw.update(dt);
      T += dt;
      const free = mols.filter(m => m.state === 'free');
      for (const m of free) {
        /* A slow drift with a wander on top, and the room's walls as a soft
           spring rather than a bounce: nothing here is a collision. */
        m.wander.x += (rng() - .5) * 40 * dt; m.wander.y += (rng() - .5) * 40 * dt; m.wander.z += (rng() - .5) * 20 * dt;
        m.wander.multiplyScalar(Math.max(0, 1 - 0.8 * dt));
        m.vel.set(P.drift, 0, 0).add(m.wander);
        if (Math.abs(m.pos.y) > ROOM.y) m.vel.y -= Math.sign(m.pos.y) * 30;
        if (Math.abs(m.pos.z) > ROOM.z) m.vel.z -= Math.sign(m.pos.z) * 30;
        // Crowding: two free molecules do not pass through each other.
        for (const o of free) {
          if (o === m) continue;
          _d.subVectors(m.pos, o.pos);
          const d = _d.length(), min = molR * 1.9;
          if (d > 0 && d < min) m.vel.addScaledVector(_d.multiplyScalar(1 / d), (min - d) * 1.5);
        }
        m.pos.addScaledVector(m.vel, dt);
        if (m.pos.x > ROOM.x + molR) m.pos.x -= 2 * (ROOM.x + molR);
        _q.setFromAxisAngle(_e.copy(m.spin).normalize(), m.spin.length() * dt);
        m.q.premultiply(_q);
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
    const finished = () => !inFlight() && (frontier(0) < 0 || !mols.some(m => m.state === 'free'));

    /* Approaches come faster as the strand lengthens: more tip to hit, and
       more of the crowd already committed. */
    function gap() {
      const u = seatedCount() / Math.max(1, mols.length);
      return (clock < LAG_S ? 0.55 : GAP0 + (GAP1 - GAP0) * u) * (0.7 + rng() * 0.6);
    }

    /* The nth seat in ORDER nobody holds or is heading for. 0 is the tip a
       molecule that means to stay goes to; 1 is where a failed approach
       touches, so two approaches never share a seat. */
    function frontier(skip) {
      let s = 0;
      for (const k of ORDER) {
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
      const u = seatedCount() / Math.max(1, mols.length);
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
      spawn(); applyLay(); upload();
      emit('dock', 0);
      return api;
    }

    /* ---- what the camera should hold ------------------------------------------
       Before anything docks, the room. As molecules leave the crowd for the
       strand the crowd's claim shrinks and the strand's grows, so the fit
       moves continuously — and the strand outgrows the room by about its
       fourth repeat, which is the zoom-out a page asks for. World space, so
       the lay rotation leaves it alone. */
    function focus() {
      const seated = mols.filter(m => m.state === 'seated');
      const out = { centre: new THREE.Vector3(), radius: R_FREE };
      if (!seated.length) return out;
      for (const m of seated) out.centre.add(_v.setFromMatrixPosition(_m.copy(grp.matrixWorld).multiply(seats[m.seat])));
      out.centre.multiplyScalar(1 / seated.length);
      let r = 0;
      for (const m of seated) r = Math.max(r, out.centre.distanceTo(_v.setFromMatrixPosition(_m.copy(grp.matrixWorld).multiply(seats[m.seat]))));
      out.radius = Math.max(r + molR, R_FREE * (1 - seated.length / mols.length));
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
      if (nextP.drift !== undefined) P.drift = nextP.drift;
      if (nextP.stick !== undefined) P.stick = !!nextP.stick;
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
        variant: P.variant, n: P.n, free: P.n - seated, seated, repeats,
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
      onResize: () => frame(0),
      viewOffset: params.viewOffset,
    });
    box.camera.far = 40000;
    box.camera.updateProjectionMatrix();

    sim = create(THREE, box.root, box.camera, params);
    const camTw = global.CardStage.tweens();

    /* Fit the focus sphere in the room the panel leaves — sickle-fibre.js's
       rule, and the same arithmetic. Tweened, because it is called after
       every docking and a camera that jumps twelve times is not a zoom. */
    const tgtFrom = new THREE.Vector3(), tgtTo = new THREE.Vector3();
    function frame(dur = 0.9) {
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
      const r = Math.max(fit(av), fit(ah)) * 1.08;
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
      reset() { sim.reset(); frame(0.6); return api; },
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

  global.HbCrowd = { create, mount, markOf, DEFAULTS, MAX, SURF };
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
