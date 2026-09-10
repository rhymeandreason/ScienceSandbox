/* =============================================================================
 *  condense/condense.js — two molecules, one bond, one water
 * =============================================================================
 *  WHAT IT IS. One condensation, at close range: two molecules stand apart, the
 *  bonds that will break are marked, a hydroxyl comes off and waits, a proton
 *  crosses to it, and only then is it a water and leaves while the two close on
 *  the bond they just made. Sugars into a disaccharide, an acid and an alcohol
 *  into an ester, two amino acids into a peptide.
 *
 *  WHAT IT IS NOT, and the distinction is the whole reason it exists separately:
 *  it is not a chain. `macromolecule-builder.html` teaches monomers becoming a
 *  polymer, where the lesson is the SHAPE the linkage forces — alpha coils into
 *  starch, beta lies flat into cellulose — and the water is bookkeeping that has
 *  to happen and does not have to be watched. This is the other view: one
 *  reaction, and the atoms are the lesson. Neither is got by zooming the other.
 *
 *  IT IS NAMED FOR WHAT IT DOES, not for reactions in general. A phosphodiester
 *  bond — DNA's backbone — is NOT a condensation: pyrophosphate leaves carrying
 *  the bridging oxygen, which is why `mol-nucleic.js` deliberately declares no
 *  `condense:` block. Calling this Reaction would promise that and quietly not
 *  do it.
 *
 *  ---- WHAT IT OWNS, AND WHAT IT ASKS -------------------------------------
 *  It owns the BEATS. Everything geometric is `macromolecule/`'s and already
 *  audited by check-macromolecule.js: `pose()` says where the second molecule
 *  sits, where the bond forms and where the water assembles; `MacroSpec.react`
 *  says what the two become. This file adds when each of those is seen.
 *
 *  WHICH SIDE BRINGS THE OXYGEN IS READ, NEVER BRANCHED. A sugar's donor keeps
 *  its anomeric O and hands over a proton; an amino acid's carboxyl hands over
 *  its whole hydroxyl and takes a proton from the amine. Same reaction,
 *  mirrored, and a branch on the linkage name is right for two of the three and
 *  silently backwards for the third with everything still rendering. So the
 *  oxygen comes from whichever role's `leaves` contains one, off the spec.
 *
 *  ---- PARAMS -------------------------------------------------------------
 *    from      ['glucose','glucose']  two registered spec keys. REBUILDS.
 *    role      null                   which host role reacts ('sn2', 'c1', …);
 *                                     null takes the first still free. REBUILDS.
 *    progress  0                       0 = apart, 1 = bonded and the water gone.
 *                                      GLIDES. This is the whole animation API:
 *                                      `set({progress:1})` runs the reaction and
 *                                      `set({progress:0})` runs it backwards.
 *    gap       3                       how far apart they wait, in MULTIPLES OF
 *                                      THE BOND ABOUT TO FORM. Not a world
 *                                      distance: one number has to mean the same
 *                                      beside a five-atom glycine and a sixteen-
 *                                      carbon palmitate. REBUILDS.
 *    turn      0.35                    how much of the facing is left to do on
 *                                      the way in, 0 = none. A whole turn walks
 *                                      the guest through the host. REBUILDS.
 *    water     true                    draw the leaving water at all.
 *
 *  ---- WHY progress AND NOT react() ---------------------------------------
 *  A component's animation API is `set`, and a scrub is worth more here than a
 *  play button: the beat a student misses is the one between the hydroxyl
 *  leaving and the proton arriving, and that beat is 300 ms. Everything below
 *  is therefore a pure function of `progress`, so dragging backwards un-reacts
 *  it. The one thing that cannot be is an fx ring, which fires; rings are
 *  emitted on a FORWARD crossing only and simply do not happen on a scrub back.
 *
 *  AND THE CROSSING PROTON IS A REAL SPHERE, not fx.js's glow. The module's
 *  rule is that a glow is a courier and the atom is revealed on arrival, which
 *  is right for a beat that plays once; a courier cannot be scrubbed. Drawn as
 *  the atom it is, moving, it can. It is still a PROTON — the O–H breaks
 *  heterolytically and the oxygen keeps both electrons — and what it becomes on
 *  the water is a bonded hydrogen, the water's oxygen supplying the pair.
 *
 *  THIS IS WHERE THE ATOMS END UP, NOT THE MECHANISM. A real glycosidase runs
 *  through an oxocarbenium-like transition state with two carboxylates doing
 *  general acid/base catalysis, and no single proton makes this trip. The
 *  bookkeeping is exact and is what the lesson is for; the arrow is a
 *  simplification, and `state().mechanism` says so out loud.
 *
 *  Loads after scene.js, molecules.js + its domain files, skel.js, chain/frame.js,
 *  macromolecule/{spec,glycosidic,ester,peptide}.js and kit/card-stage.js.
 *  lib/fx.js is optional and only adds the rings.
 * ========================================================================== */
(function (global) {
  'use strict';

  const DEFAULTS = { from: ['glucose', 'glucose'], role: null, progress: 0,
                     gap: 3, turn: 0.35, water: true };

  /* THE BEATS, as fractions of `progress`. Written here rather than in seconds
     because the caller owns the clock: a tween to progress:1 over 4 s and a
     student dragging a slider have to produce the same picture at the same
     fraction, or a scrub and a play tell different stories. */
  const BEAT = {
    BREAK: 0.05,   // both bonds are marked and the leaving atoms come off
    CLEAR: 0.15,   // the hydroxyl has stepped clear of the carbon it left
    CROSS: 0.45,   // the proton has arrived on the oxygen
    FORM:  0.55,   // the second O–H is drawn: NOW it is a water
    CLOSE: 0.80,   // the two have met and the new bond is drawn
  };
  const PHASES = ['apart', 'breaking', 'waiting', 'crossing', 'water', 'closing', 'done'];
  const HOH = 104.5 * Math.PI / 180;
  /* How far the hydroxyl steps off the carbon it left, in multiples of the O–H
     it still carries. Far enough to read as detached, near enough to still
     belong to that molecule: it has not gone anywhere yet. */
  const STEP_OH = 1.6;

  const lerp = (a, b, t) => a + (b - a) * t;
  const span = (t, a, b) => Math.max(0, Math.min(1, (t - a) / (b - a)));

  /* ---- which condensation this is, asked of the molecules ------------------
     Never a parameter. A linkage the caller names lets an author ask for a
     peptide bond between two sugars, which renders. Order matters only because
     an amino acid carries BOTH a carboxyl and an amino: test the pair that
     needs both before the one that needs either. */
  function linkageOf(hk, gk, M) {
    const S = global.MacroSpec, h = M[hk], g = M[gk];
    if (!h || !g) throw new Error(`condense: unknown spec ${!h ? hk : gk}`);
    const has = (sp, k) => !!S.role(sp, k);
    if (global.Glycosidic && global.Glycosidic.LINKAGE[hk] && has(g, 'c4'))
      return { name: 'glycosidic', donor: 'c1', acceptor: 'c4',
               pose: (H, G, o) => global.Glycosidic.pose(H, G, o.refs),
               startQuat: (G, o) => global.Glycosidic.startQuat(G, o.refs),
               /* The linkage geometry is MEASURED off a real disaccharide
                  rather than constructed from angles, so this one needs to see
                  the record. It knows which — LINKAGE is keyed by monomer — it
                  just cannot fetch it, being Node-loadable with no MolLib. */
               refs: ['cellobiose', 'maltose'] };
    if (has(h, 'carboxyl') && has(g, 'amino'))
      return { name: 'peptide', donor: 'carboxyl', acceptor: 'amino',
               pose: (H, G, o) => global.Peptide.pose(H, G, o.role), refs: [] };
    if (has(g, 'carboxyl') && global.Ester.slots(h).length)
      return { name: 'ester', acceptor: 'carboxyl', slots: H => global.Ester.slots(H),
               pose: (H, G, o) => global.Ester.pose(H, G, o.role), refs: [] };
    return null;
  }

  function create(THREE, root, camera, opts) {
    const MolLib = global.MolLib, SkelLib = global.SkelLib, Stage = global.Stage;
    const S = global.MacroSpec;
    if (!MolLib || !Stage || !S) throw new Error('condense: molecules.js, scene.js and macromolecule/spec.js first');
    const M = MolLib.MOLECULES, PAL = MolLib.PALETTE, SCL = MolLib.SCALE;
    const fx = (opts && opts.fx) || null;

    let p = Object.assign({}, DEFAULTS, opts || {});
    const listeners = {};
    const emit = (ev, ...a) => (listeners[ev] || []).forEach(fn => fn(...a));
    const on = (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn);
      return () => { listeners[ev] = listeners[ev].filter(f => f !== fn); }; };

    const group = new THREE.Group();
    root.add(group);
    let B = null;                        // everything the build solved
    let lastPhase = null, seen = 0;      // rings fire once, forwards only

    /* Angstroms in, display units out — macromolecule/ works in real ones and a
       registered spec has already been multiplied by SCALE. A pose solved
       against scaled coordinates puts the bond at 1/SCALE of a bond length,
       which renders as one molecule slightly inside the other.
       `view:` is dropped because buildMolecule bakes it into the meshes, and a
       pose solved against the raw coordinates would desync from every one. */
    const unscale = (spec, key) => Object.assign({}, spec, { key, view: null,
      atoms: spec.atoms.map(a => ({ el: a.el, pos: a.pos.map(v => v / SCL) })) });
    const rescaleSpec = sp => Object.assign({}, sp, { view: null,
      atoms: sp.atoms.map(a => ({ el: a.el, pos: a.pos.map(v => v * SCL) })) });
    const v3 = a => new THREE.Vector3(a[0] * SCL, a[1] * SCL, a[2] * SCL);

    function clear() {
      while (group.children.length) {
        const o = group.children.pop();
        o.traverse(x => { if (x.geometry) x.geometry.dispose(); });
        group.remove(o);
      }
      B = null; lastPhase = null; seen = 0;
    }

    function build() {
      clear();
      const [hk, gk] = p.from;
      const L = linkageOf(hk, gk, M);
      if (!L) throw new Error(`condense: ${hk} + ${gk} do not condense — `
        + `neither molecule's condense roles match the other's`);
      const H = unscale(M[hk], hk), G = unscale(M[gk], gk);
      const role = p.role || (L.slots ? L.slots(H)[0] : L.donor);
      if (!S.free(H, role)) throw new Error(`condense: ${hk}'s ${role} has already reacted`);
      const refs = {};
      L.refs.forEach(k => { refs[k] = unscale(M[k], k); });
      const pose = L.pose(H, G, { role, refs });
      if (!pose) throw new Error('condense: pose() returned nothing');

      const hr = S.role(H, role), gr = S.role(G, L.acceptor);
      /* WHICH SIDE BRINGS THE OXYGEN — asked of the atoms. */
      const hasO = (sp, r) => r.leaves.some(i => sp.atoms[i].el === 'O');
      const hostGivesO = hasO(H, hr);
      if (hostGivesO === hasO(G, gr))
        throw new Error('condense: both roles leave an oxygen, or neither does');

      const gA = Stage.buildMolecule(rescaleSpec(H));
      const gB = Stage.buildMolecule(rescaleSpec(G));
      group.add(gA); group.add(gB);
      const home = v3(pose.pos);
      const qPose = new THREE.Quaternion(pose.quat[0], pose.quat[1], pose.quat[2], pose.quat[3]);
      gB.position.copy(home); gB.quaternion.copy(qPose); gB.updateMatrixWorld(true);
      const hKeep = gA.userData.atomWorld(hr.keep).clone();
      const dir = gB.userData.atomWorld(gr.keep).clone().sub(hKeep).normalize();
      const bondLen = gB.userData.atomWorld(gr.keep).distanceTo(hKeep);

      /* Only `Glycosidic` measures a start orientation; the other two construct
         their geometry and have none, so theirs is part of the way back from
         the pose along the shortest rotation and it turns the rest on the way
         in. Deliberately partial: a molecule swinging through a half turn on
         its way in passes through the one it is reacting with. */
      const qStart = L.startQuat
        ? new THREE.Quaternion(...L.startQuat(G, { refs }))
        : new THREE.Quaternion().slerp(qPose, 1 - p.turn);
      gB.quaternion.copy(qStart); gB.updateMatrixWorld(true);
      /* THE GAP IS SOLVED AFTER THE TURN. A group rotates about its own origin
         and an origin is not the reacting atom — palmitate's is eight angstroms
         down its chain — so a distance measured at the pose orientation and
         then turned is not the distance asked for. Place by the ATOM. */
      const want = hKeep.clone().addScaledVector(dir, p.gap * bondLen);
      const start = gB.position.clone().add(want.clone().sub(gB.userData.atomWorld(gr.keep)));
      gB.position.copy(start); gB.updateMatrixWorld(true);

      /* The two leaving sets, in the roles' own terms. Read here, once, with
         the guest at its start pose: it does not move until long after the
         hydroxyl has come off, so these are the positions it came off from. */
      const oOwn = hostGivesO ? { g: gA, sp: H, r: hr } : { g: gB, sp: G, r: gr };
      const hOwn = hostGivesO ? { g: gB, sp: G, r: gr } : { g: gA, sp: H, r: hr };
      const oI = oOwn.r.leaves.find(i => oOwn.sp.atoms[i].el === 'O');
      const oH = oOwn.r.leaves.find(i => oOwn.sp.atoms[i].el === 'H');
      const hI = hOwn.r.leaves.find(i => hOwn.sp.atoms[i].el === 'H');
      if (oI == null || hI == null) throw new Error('condense: a role leaves no proton');
      const pO = oOwn.g.userData.atomWorld(oI).clone();
      const pH2 = oH != null ? oOwn.g.userData.atomWorld(oH).clone() : null;
      const pH1 = hOwn.g.userData.atomWorld(hI).clone();
      const pKeepO = oOwn.g.userData.atomWorld(oOwn.r.keep).clone();

      /* The water, built once and moved by `progress`. The O–H the molecule
         already drew is kept at ITS OWN length and direction; only the arriving
         proton is placed, at a real H–O–H about the axis the three atoms
         already share, so the fold happens in the plane the eye is watching. */
      const OHW = SkelLib.GL.OH * SCL;
      const ref = pH2 || pKeepO;
      const d1 = ref.clone().sub(pO).normalize();
      let nrm = new THREE.Vector3().crossVectors(d1, pH1.clone().sub(pO));
      if (nrm.lengthSq() < 1e-6) nrm.set(0, 0, 1); else nrm.normalize();
      const t2 = pO.clone().add(d1.clone().applyAxisAngle(nrm, HOH).multiplyScalar(OHW));
      const stepOut = pO.clone().sub(pKeepO).normalize().multiplyScalar(OHW * STEP_OH);

      const water = new THREE.Group();
      const wO = Stage.atom(PAL.atoms.O, PAL.radii.O, pO, 'O');
      const wH1 = pH2 ? Stage.atom(PAL.atoms.H, PAL.radii.H, pH2, 'H') : null;
      const wH2 = Stage.atom(PAL.atoms.H, PAL.radii.H, pH1, 'H');
      water.add(wO); if (wH1) water.add(wH1); water.add(wH2);
      /* Built at their real endpoints, because `Stage.bond` takes the two
         points — a bond is not a mesh you make and then place. `placeBond`
         moves one afterwards, which is what the beats do. */
      const bond1 = wH1 ? Stage.bond(pO, pH2, PAL.bonds.covalent) : null;
      const bond2 = Stage.bond(pO, t2, PAL.bonds.covalent);
      if (bond1) water.add(bond1);
      water.add(bond2);
      group.add(water);
      /* The new bond, drawn between two molecules, so it belongs to neither —
         `MacroSpec.react` says exactly that, which is why it is a mesh of its
         own rather than something added to a spec. */
      const madeBond = Stage.bond(hKeep, gB.userData.atomWorld(gr.keep), PAL.bonds.covalent);
      group.add(madeBond);

      /* Where the water goes: straight up the SCREEN and off it, at its own
         depth, so it clears the frame at any orbit angle. World +Y is partly
         into the shot at a typical elevation and a departure taking it recedes
         instead of leaving. */
      const away = () => {
        const v = pO.clone().project(camera);
        return new THREE.Vector3(v.x, 1.35, v.z).unproject(camera).sub(pO);
      };

      B = { L, role, H, G, hr, gr, gA, gB, start, home, qStart, qPose, hKeep,
            oOwn, hOwn, oI, oH, hI, pO, pH2, pH1, pKeepO, t2, stepOut,
            water, wO, wH1, wH2, bond1, bond2, madeBond, away, bondLen,
            hostGivesO, leaves: leavesOf(H, hr, G, gr) };
      /* MEASURED AT progress 0, with the guest still standing off. That is the
         widest the scene ever is — everything after moves inward except the
         water, which is leaving and is allowed off the edge. Framing to the
         reacted state instead would push the two molecules out of shot while
         they were still apart, which is most of the reaction. */
      apply(0);
      const bb = new THREE.Box3().setFromObject(group);
      const size = bb.getSize(new THREE.Vector3()), mid = bb.getCenter(new THREE.Vector3());
      B.bounds = { centre: mid, rxz: Math.max(size.x, size.z) / 2, hy: size.y / 2 };
      apply(p.progress);
      emit('build', state());
      return B;
    }

    const leavesOf = (H, hr, G, gr) => {
      const c = {};
      hr.leaves.forEach(i => c[H.atoms[i].el] = (c[H.atoms[i].el] || 0) + 1);
      gr.leaves.forEach(i => c[G.atoms[i].el] = (c[G.atoms[i].el] || 0) + 1);
      return Object.keys(c).sort().map(e => e + (c[e] > 1 ? c[e] : '')).join('');
    };

    const setVis = (g, idx, on) => idx.forEach(i => {
      const m = g.userData.atomMeshes[i]; if (m) m.visible = on;
      g.userData.bondMeshes.forEach(bm => {
        if (bm.userData.pair.indexOf(i) >= 0) bm.visible = on; });
    });

    /* EVERY FRAME IS A PURE FUNCTION OF t. Nothing here reads the previous
       value, so dragging backwards un-reacts the molecules exactly. */
    function apply(t) {
      if (!B) return;
      t = Math.max(0, Math.min(1, t));
      const gone = t >= BEAT.BREAK;
      setVis(B.oOwn.g, B.oOwn.r.leaves, !gone);
      setVis(B.hOwn.g, B.hOwn.r.leaves, !gone);

      B.water.visible = p.water && gone;
      if (B.water.visible) {
        // 2 · it comes off and stays, still a hydroxyl
        const out = span(t, BEAT.BREAK, BEAT.CLEAR);
        const off = B.stepOut.clone().multiplyScalar(out);
        // 5 · and after the water is made, it leaves
        if (t > BEAT.CLOSE) off.addScaledVector(B.away(), span(t, BEAT.CLOSE, 1));
        B.water.position.copy(off);
        // 3 · the proton crosses to it
        const cross = span(t, BEAT.CLEAR, BEAT.CROSS);
        B.wH2.position.lerpVectors(B.pH1, B.pO, cross).sub(off);
        B.wH2.visible = true;
        // 4 · and only now is it a water: the second O–H is drawn
        const made = t >= BEAT.FORM;
        B.bond2.visible = made;
        if (made) {
          B.wH2.position.copy(B.t2).sub(off);
          Stage.placeBond(B.bond2, B.pO.clone().sub(off), B.t2.clone().sub(off));
        }
      }

      // the two close on the bond they just made
      const in_ = span(t, BEAT.FORM, BEAT.CLOSE);
      const e = in_ * in_ * (3 - 2 * in_);           // smoothstep, so it settles
      B.gB.position.lerpVectors(B.start, B.home, e);
      B.gB.quaternion.copy(B.qStart).slerp(B.qPose, e);
      B.gB.updateMatrixWorld(true);
      const made = t >= BEAT.CLOSE;
      B.madeBond.visible = made;
      if (made) Stage.placeBond(B.madeBond, B.hKeep, B.gB.userData.atomWorld(B.gr.keep));

      // rings fire, so they only happen going forwards
      if (fx && t > seen) {
        if (seen < BEAT.BREAK && t >= BEAT.BREAK) {
          fx.spawnRing(B.pO.clone().lerp(B.pKeepO, 0.5), PAL.atoms.O);
          fx.spawnRing(B.pH1, PAL.atoms.H);
        }
        if (seen < BEAT.CLOSE && t >= BEAT.CLOSE) fx.spawnRing(B.hKeep, PAL.atoms.O);
        seen = t;
      } else if (t < seen) seen = t;

      const ph = t < BEAT.BREAK ? 'apart' : t < BEAT.CLEAR ? 'breaking'
        : t < BEAT.CROSS ? 'waiting' : t < BEAT.FORM ? 'crossing'
        : t < BEAT.CLOSE ? 'water' : t < 1 ? 'closing' : 'done';
      if (ph !== lastPhase) { lastPhase = ph; emit('phase', ph, t); }
    }

    /* ---- the tween, so `set` is the whole animation API ------------------ */
    const tweens = global.CardStage && global.CardStage.tweens ? global.CardStage.tweens() : null;

    function set(next, o) {
      if (!next) return api;
      const rebuild = ['from', 'role', 'gap', 'turn'].some(k =>
        next[k] !== undefined && JSON.stringify(next[k]) !== JSON.stringify(p[k]));
      Object.keys(next).forEach(k => { if (k !== 'progress') p[k] = next[k]; });
      if (rebuild) { build(); }
      if (next.progress != null) {
        /* Keyed, so a second set() mid-flight replaces the first rather than
           racing it — and snapped on demand, because a slider the student is
           dragging must track the thumb. */
        if (!tweens || (o && o.snap)) { p.progress = next.progress; apply(p.progress); }
        else tweens.to(p.progress, next.progress, (o && o.dur) || 3.2,
                       v => { p.progress = v; apply(v); },
                       { key: 'progress', ease: 'inOutCubic' });
      } else if (!rebuild) apply(p.progress);
      return api;
    }

    function step(dt) { if (tweens) tweens.update(dt); return state(); }

    function state() {
      if (!B) return null;
      return {
        progress: +p.progress.toFixed(3),
        phase: lastPhase || 'apart',
        linkage: B.L.name,
        host: p.from[0], guest: p.from[1], role: B.role,
        /* The one thing a caption most wants and would otherwise be typed: a
           sugar takes the water's oxygen from the ACCEPTOR and an ester or a
           peptide from the DONOR, and it is read off the roles either way. */
        oxygenFrom: B.hostGivesO ? p.from[0] : p.from[1],
        protonFrom: B.hostGivesO ? p.from[1] : p.from[0],
        leaves: B.leaves,
        gapBonds: p.gap,
        bondAngstrom: +(B.bondLen / MolLib.SCALE).toFixed(2),
        atomsDrawn: [B.gA, B.gB].map(g => g.userData.atomMeshes.filter(m => m && m.visible).length),
        mechanism: 'atom bookkeeping, not the mechanism — no single proton makes this trip',
      };
    }

    /* ---- anchors, facings, library --------------------------------------
       Functions, not baked points: the guest moves and the bond moves with it.
       Null while a part is not on stage, which is how annotate.js knows not to
       draw a callout for a water that has not been made yet. */
    const anchors = {
      host: () => B && B.hKeep.clone(),
      guest: () => B && B.gB.userData.atomWorld(B.gr.keep).clone(),
      bond: () => B && B.madeBond.visible
        ? B.hKeep.clone().lerp(B.gB.userData.atomWorld(B.gr.keep), 0.5) : null,
      water: () => B && B.water.visible
        ? B.pO.clone().add(B.water.position) : null,
      /* IT RIDES THE PROTON. Pinned to where the proton STARTED, a callout on
         the one beat this step is about sits on the molecule the proton has
         already left, with a leader line to empty space. And it stops once the
         proton is part of the water, because from there the `water` anchor is
         the one that names it. */
      leavingH: () => {
        if (!B || p.progress >= BEAT.FORM) return null;
        if (p.progress < BEAT.BREAK) return B.pH1.clone();
        return B.wH2.getWorldPosition(new THREE.Vector3());
      },
    };
    const facings = {};
    const library = {
      host: { text: 'The molecule that keeps its place',
        card: 'One half of the pair, and the one the reaction is measured from. '
            + 'It holds still while the other comes to meet it.' },
      guest: { text: 'The molecule that comes in',
        card: 'It waits a few bond lengths off, turns to face the way it will '
            + 'bond, and closes only once the water has been made.' },
      bond: { text: 'The bond they made',
        card: 'The new bond belongs to neither molecule — it is between them. '
            + 'Which bond it is, is what tells starch from cellulose, or a fat '
            + 'from a protein.' },
      water: { text: 'The water that left',
        card: 'One water, and it is made of both molecules: a whole hydroxyl '
            + 'from one and a single proton from the other. That is what '
            + '"condensation" names.' },
      leavingH: { text: 'The proton that crosses',
        card: 'The O–H breaks so that the oxygen keeps both electrons, so what '
            + 'leaves is a proton. It becomes the water\'s second hydrogen.' },
    };

    const LAYERS = [{ name: 'water', label: 'The water', on: true }];
    const layersOf = () => LAYERS.map(l => Object.assign({}, l, { on: p.water }));
    const show = (name, on) => { if (name === 'water') { p.water = !!on; apply(p.progress); } };
    /* A LIST OF {name, color}, which is what CardStage.showPanel's legend maps
       over — an object here throws inside `paint` and takes the whole step's
       panel with it. Found by a generated page, not by the bench: the bench
       asked for the chips it knew about and the model asked for `legend`.

       The elements a condensation moves, and only those: the water is an O and
       two H, the backbone that keeps them is C, and a legend listing every
       element in a 24-atom sugar is a colour key nobody reads. Off the palette,
       never typed. */
    const hex = v => '#' + v.toString(16).padStart(6, '0');
    const palette = () => [
      { name: 'Oxygen', color: hex(PAL.atoms.O) },
      { name: 'Hydrogen', color: hex(PAL.atoms.H) },
      { name: 'Carbon', color: hex(PAL.atoms.C) },
    ];

    build();
    const api = { step, state, set, on, anchors, facings, library,
                  layersOf, show, palette, group,
                  bounds: () => B && B.bounds,
                  destroy() { clear(); root.remove(group); } };
    return api;
  }

  function mount(el, params) {
    params = params || {};
    if (!global.CardStage) throw new Error('condense.js: load kit/card-stage.js first');
    let sim = null, last = null, nb = null, FXi = null;
    const box = global.CardStage.create({
      mount: el,
      cam: params.cam || { theta: 0.5, phi: 1.25, r: 26 },
      stage: Object.assign({ ortho: true, rMin: 10, rMax: 70 }, params.stage || {}),
      step: dt => { if (sim) last = sim.step(dt); if (FXi) FXi.step(); },
      afterFrame: () => { if (nb) nb.step(); },
      onResize: () => frame(),
      viewOffset: params.viewOffset,
    });
    /* AN ORTHOGRAPHIC CAMERA IS FRAMED BY ITS FRUSTUM, not by standing distance,
       so `cam.r` cannot size this scene and `Stage.frame` is what does. It has
       to run again on a resize and after any rebuild, because both change the
       extent: a different pair is a different size, and so is a wider gap. */
    /* A DECLARATION, NOT A CONST. CardStage fires `onResize` from inside its own
       `create`, before anything after that call has been assigned, so an arrow
       here is read before initialisation and the whole mount dies. `sim` is null
       at that point and the guard below is what makes the early call harmless. */
    function frame() {
      if (!sim || !sim.bounds()) return;
      const b = sim.bounds();
      box.cam.target.copy(b.centre);
      /* THE PANEL TAKES WIDTH, AND `viewOffset` DOES NOT GIVE IT BACK. It shifts
         the projection so the scene sits beside the glass, but a shift is not a
         shrink: the frustum stays the size it was and whatever was on the far
         side goes off the edge. So the width the scene has to fit into is the
         canvas MINUS twice the shift, and the extent is inflated by that ratio
         before it is fitted. Read through the same path CardStage reads it, so
         a shell that stamps the offset on its own stage still works. */
      const W = box.canvas.clientWidth, H = box.canvas.clientHeight;
      const fn = params.viewOffset || el.viewOffset;
      const off = (fn && W && H) ? fn(W, H) : null;
      const room = off && off.x ? Math.max(0.25, (W - 2 * Math.abs(off.x)) / W) : 1;
      global.Stage.frame(box.camera, box.cam,
                         [{ x: 0, y: 0, rxz: b.rxz / room, hy: b.hy }], { pad: 1.3 });
      box.applyCam();
    }
    /* ORTHOGRAPHIC, for the reason every side-by-side page in this repo is: under
       perspective the nearer molecule reads as the bigger one, and this scene is
       two molecules of comparable size beside each other. */
    box.renderer.toneMapping = THREE.NoToneMapping;
    FXi = global.FX ? global.FX.create(THREE, box.root, box.camera) : null;
    sim = create(THREE, box.root, box.camera, Object.assign({}, params, { fx: FXi }));
    frame();
    box.pump();
    nb = global.Notebook ? global.Notebook.create(
      { box, anchors: sim.anchors, facings: sim.facings, library: sim.library }) : null;

    return {
      sim, box,
      views: () => ({}),
      lookAt(name, dur) { return this; },
      note: (n, o) => nb && nb.note(n, o), notes: n => nb && nb.notes(n),
      clearNotes: () => nb && nb.clear(), anchors: () => nb ? nb.list() : [],
      layers: sim.layersOf, palette: sim.palette,
      show: (n, on) => { sim.show(n, on); if (!box.running) box.draw(); return this; },
      set(next, o) {
        const rebuilt = next && ['from', 'role', 'gap', 'turn'].some(k => next[k] !== undefined);
        sim.set(next, o);
        if (rebuilt) frame();
        if (!box.running) box.draw();
        return this;
      },
      frame,
      state: () => last || sim.state(),
      on: sim.on,
      start: box.start, stop: box.stop, pump: box.pump,
      destroy() { sim.destroy(); box.destroy(); },
    };
  }

  /* `linkageOf` is exported for check-condense.js, which RUNS it rather than
     reading the source: everything it needs — the specs, the roles, the three
     linkage modules — is Node-loadable, so the claim can be asserted rather
     than grepped for. Nothing on a page should call it; use `state().linkage`. */
  global.Condense = { create, mount, DEFAULTS, BEAT, linkageOf };
  if (typeof module === 'object' && module.exports) module.exports = global.Condense;
  /* Scale (kit/scale.js). Real molecules from the library, whose coordinates are
     angstroms multiplied once by MolLib.SCALE — so unlike a diagram this render
     IS measurable, and `state().bondAngstrom` is a real length. Nothing is
     exaggerated: the hydroxyl's step off its carbon is a MOTION, not a size. */
  global.Condense.SCALE = {
    rung: 'molecules', form: 'single',
    unit: 1e-10 / 1.9,          // metres per scene unit, = 1 angstrom / MolLib.SCALE
    sceneUnits: ['gap'],        // gap is in bond lengths, not metres
    exag: {},
    down: {},
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
