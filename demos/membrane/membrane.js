/* =============================================================================
 *  membrane/membrane.js — a membrane, its machines, and what crosses
 * =============================================================================
 *  membrane-lab.html grew this inline: a bilayer with holes for its proteins,
 *  ions and small molecules random-walking either side of it, a K⁺ and a Cl⁻
 *  channel that admit by hydration and by charge, a leak that builds the
 *  voltage that stops it, and a Na⁺/K⁺ pump whose cargo is the same ions the
 *  rest of the page walks around. The lesson drove all of it through a switch
 *  on the current step's id, so there were five hand-tuned frame orders and
 *  no single "advance everything". This module is that single path. What a
 *  lesson step used to decide by name is a parameter here:
 *
 *      potential   'off'     the pores conduct forever at full drive
 *                  'fixed'   E_K and E_Cl are constants; the leak spends the
 *                            gradient it started with (the channel step)
 *                  'nernst'  equilibria off the live counts, so a pump
 *                            rebuilding the gradient moves the target (rest)
 *      pumpAuto    the pump re-arms itself (rest) or waits for spend() (pump)
 *      shells      hydration shells drawn and shed at the filter
 *
 *  Two shapes, the same split water/watersim.js uses:
 *
 *      Membrane.create(THREE, root, camera, opts)   the sim: root is yours
 *      Membrane.mount(el, params)                   one box, one handle
 *
 *  The sim owns the sheet, the proteins, the travellers, and every rule that
 *  moves them. It refuses the lesson: no captions, no callouts, no buttons,
 *  and no notion of a step. Every number a page prints comes back from
 *  step(dt) or state(), or arrives on 'frame' (state, dt); 'cross' (t, dir)
 *  is a molecule through the bilayer, 'conduct' (t, dir) one through a pore,
 *  'turn' and 'turned' the pump starting and finishing. The one thing it
 *  cannot see — an ATP chip flying
 *  from a DOM button — is the page's, which calls spend() when the chip lands.
 *
 *  Proteins are a LAYOUT, not a step:
 *      proteins: { K:{x:-34} | null, CL:{x:34} | null, pump:{x:0} | null }
 *  The sheet is rebuilt with one hole per protein, so a hole can never stand
 *  without its protein. Rebuilding is a few hundred instanced lipids, fine on
 *  a change; it is not meant to be animated.
 *
 *  Travellers are add(kind, opts) with membrane-lab's own option names —
 *  walk · speed · blocked · bounded · shell · seeks · conducts · keepout ·
 *  yband · coreSpeed · exits — and `conducts` may name a pore by kind ('K',
 *  'CL') instead of by x. scatter(kind, n, side, opts) is the common case,
 *  and `contents` — counts per side per kind — is the declarative one:
 *  set({contents}) adds and removes only the difference. add() refuses past
 *  `maxTravellers`, because a crowd is a frame budget, not a preference.
 *
 *  WHAT IS EXAGGERATED is declared where it is set (EXAG, MV_PER_ION); the
 *  physics comments are membrane-lab's and travel with the code they explain.
 * ========================================================================== */
(function (global) {
  'use strict';

  const rnd = (a, b) => a + Math.random() * (b - a);
  const ELEMENT_OF = { NA:'Na', K:'K', CL:'Cl', MG:'Mg' };
  const OCTA = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];

  const DEFAULTS = {
    half: 15.3,               // OPM's half-thickness, from the bake
    reach: 340,               // the sheet runs off both edges: visible ends are a raft
    exag: 5.0,                // one exaggeration for everything that crosses (see below)
    extent: 90,               // half-height of each compartment, in world units
    spread: null,             // ±x scatter; default reach * 0.55
    proteins: { K:null, CL:null, pump:null },
    potential: 'off',
    E: { K:-90, CL:-75 },     // mV, the Nernst potentials of the gradients drawn
    mvPerIon: -2.5,           // stage timing, not a measurement (see netPush)
    pumpAuto: false,
    pumpOn: true,
    turnSeconds: 11,
    shells: false,
    lipidMotion: true,
    /* THE BUDGET. Ion spacing is quadratic in the crowd, and a page that
       scatters 400 things spends its whole frame keeping them apart. Refused
       at add(), not clamped later, so the count a page reads is the count it
       has. About 78 particles a side reads as a solution. */
    maxTravellers: 220,
    /* IONS ARE THE EXPENSIVE ONES: the spacing pass is over ions and anions
       only, and a hydrated ion is the biggest thing on stage. Separate cap. */
    maxIons: 110,
    /* What is dissolved on each side, declaratively: {inside:{water:46, K:20},
       outside:{water:26, NA:26, CL:26}}. set() reconciles the stage to it by
       adding and removing, counted by CURRENT side, so a water that crossed
       stays crossed and only the difference moves. */
    contents: null,
  };

  function create(THREE, root, camera, opts = {}) {
    if (!global.Parts || !global.Pump) throw new Error('membrane.js: load membrane/parts.js and membrane/pump.js first');
    const P = Object.assign({}, DEFAULTS, opts);
    P.E = Object.assign({}, DEFAULTS.E, opts.E || {});
    P.proteins = Object.assign({}, DEFAULTS.proteins, opts.proteins || {});
    const HALF = P.half, MEM_REACH = P.reach;
    const SPREAD = () => P.spread == null ? MEM_REACH * 0.55 : P.spread;
    const listeners = {};
    const emit = (ev, ...a) => (listeners[ev] || []).forEach(fn => fn(...a));

    /* ---- sizes ----
       molecules.js builds at MolLib.SCALE (~1.9x angstroms) while parts.js
       works raw; dividing puts them in one frame. Then everything crossing is
       enlarged by EXAG, above parts.js's 2.6 because the stage is ~300 A
       wide. One multiplier for molecules, ions and badges together, so only
       the comparison against the MEMBRANE is exaggerated. */
    const SCALE = global.MolLib.SCALE || 1.9;
    const EXAG = P.exag;
    const K_ = () => EXAG / SCALE;
    function ionRadius(kind) {
      const el = ELEMENT_OF[kind] || kind;
      const r = global.MolLib.PALETTE.radii[el];
      if (r == null) throw new Error('membrane.js: no palette radius for ' + el);
      return r * K_();
    }
    const kit = global.AtomKit.create(THREE);

    /* ---- the proteins, and the sheet with their holes ----
       A K⁺ channel is a TETRAMER and a CLC chloride channel a DIMER: the lobe
       count is the subunit count. The channel gets a wide pore and the pump a
       snug site — a channel conducts millions a second BECAUSE its pore does
       not grip. Radii feed the hole and the solid-wall test, so retuning a
       lobe cannot leave either behind. */
    const K_R = 14.5, K_LOBE = 0.11, CL_R = 15.6, CL_LOBE = 0.17;
    const K_HOLE = K_R * (1 + K_LOBE) + 0.5, CL_HOLE = CL_R * (1 + CL_LOBE) + 0.5;
    const CHANNEL = global.Parts.transporter({ half:HALF, site:7.2, mouth:8.8, radius:K_R, lobes:4, lobeDepth:K_LOBE });
    const CLCHAN  = global.Parts.transporter({ half:HALF, site:7.2, mouth:8.0, radius:CL_R, lobes:2, lobeDepth:CL_LOBE, color:0xb58a4f });
    const PUMP    = global.Parts.transporter({ half:HALF, color:0x4f9e78 });
    const ALL = [CHANNEL, CLCHAN, PUMP];
    root.add(CHANNEL.group, CLCHAN.group, PUMP.group);
    let MEM = null, T = PUMP, PORES = [], pumpX = 0, cut = false;

    function layout(proteins) {
      P.proteins = Object.assign({ K:null, CL:null, pump:null }, proteins);
      const pr = P.proteins;
      const holes = [];
      PORES = [];
      CHANNEL.group.visible = !!pr.K;
      if (pr.K) { CHANNEL.group.position.x = pr.K.x; CHANNEL.setGates(1, 1);
        holes.push([pr.K.x, K_HOLE]); PORES.push({ x:pr.K.x, R:K_R, lumen:8.8, kind:'K' }); }
      CLCHAN.group.visible = !!pr.CL;
      if (pr.CL) { CLCHAN.group.position.x = pr.CL.x; CLCHAN.setGates(1, 1);
        holes.push([pr.CL.x, CL_HOLE]); PORES.push({ x:pr.CL.x, R:CL_R, lumen:8.0, kind:'CL' }); }
      PUMP.group.visible = !!pr.pump;
      if (pr.pump) { pumpX = pr.pump.x; PUMP.group.position.x = pumpX;
        /* MOUTH rather than site — the site is narrowest and would seat an ion in the wall. */
        holes.push([pumpX, 15.0]); PORES.push({ x:pumpX, R:14.5, lumen:7.6, kind:null }); }
      T = pr.pump ? PUMP : pr.K ? CHANNEL : pr.CL ? CLCHAN : PUMP;
      if (MEM) root.remove(MEM.group);
      /* `exclude` is a signed distance, so holes union as the MINIMUM. */
      MEM = global.Parts.membrane({ half:HALF, reach:MEM_REACH,
        exclude: holes.length ? (x, z) => holes.reduce((m, h) => Math.min(m, Math.hypot(x - h[0], z) - h[1]), Infinity) : undefined });
      root.add(MEM.group);
      setCut(cut);
      /* A pore named by kind is re-resolved against the new layout. */
      for (const t of travellers) if (t.conductsKind) t.conducts = poreX(t.conductsKind);
    }
    const poreX = kind => { const p = PORES.find(q => q.kind === kind); return p ? p.x : null; };
    /* Only with a protein in it: an uncut shape seals the ions inside the lumen. */
    function setCut(on) {
      cut = on;
      MEM.cut.enable(on && PORES.length > 0);
      for (const Q of ALL) {
        Q.mesh.material.clippingPlanes = on ? [MEM.cut.plane] : [];
        Q.mesh.material.side = on ? THREE.DoubleSide : THREE.FrontSide;
        Q.mesh.material.needsUpdate = true;
      }
    }

    /* ---- what travels ---- */
    function chargedIon(kind) {
      const g = new THREE.Group();
      g.add(global.Parts.ion(kind, { radius: ionRadius(kind) }));
      const el = ELEMENT_OF[kind] || kind, k = K_();
      /* The badge is drawn at TWICE the matched size: at whole-membrane zoom
         the sign is all that separates K⁺ from Na⁺ from Cl⁻. */
      const b = kit.charge(kind === 'CL' ? '−' : '+',
        '#' + global.Parts.ION[kind].color.toString(16).padStart(6, '0'), el, k * 2);
      b.userData.base.multiplyScalar(k); b.userData.lift *= k;
      b.position.copy(b.userData.base);
      g.add(b); g.userData.badge = b;
      return g;
    }
    /* The impermeant anions: protein side chains, phosphates and nucleic
       acids that cannot leave, the reason the inside is negative at all. */
    function makeAnion() {
      const g = new THREE.Group();
      const r = ionRadius('CL') * 1.15;
      g.add(new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), global.Parts.flat(0x8f7fae)));
      const b = kit.charge('−', '#8f7fae', 'Cl', K_() * 2);
      b.userData.base.multiplyScalar(K_() * 1.6); b.userData.lift *= K_() * 1.6;
      b.position.copy(b.userData.base);
      g.add(b);
      return g;
    }
    function smallMolecule(name) {
      const spec = global.MolLib.MOLECULES[name];
      if (!spec) throw new Error('membrane.js: no spec named ' + name);
      const g = global.Stage.buildMolecule(spec, { center:true });
      g.scale.setScalar(K_());
      return g;
    }

    /* ---- hydration shells ----
       SIX waters in an octahedron, water-lab's facts: a cation's waters point
       O at the ion; an anion's point one O–H at it, so its shell sits a
       hydrogen further out. Rigid, parented to the ion. Not travellers, so
       the osmosis tally counts FREE water only. */
    const rO_ = () => global.MolLib.PALETTE.radii.O * K_();
    const shellDist = kind => (ionRadius(kind) + rO_()) * (kind === 'CL' ? 1.32 : 1.02);
    const bulkRadius = t => t.kind === 'A' ? ionRadius('CL') * 1.15
      : P.shells && t.obj.userData.shell && t.obj.userData.shell.length
      ? shellDist(t.kind) + rO_()
      : (ELEMENT_OF[t.kind] ? ionRadius(t.kind) : 3);
    const _wq = new THREE.Quaternion(), _wa = new THREE.Vector3(), _wb = new THREE.Vector3();
    function hydrate(group, kind) {
      const spec = global.MolLib.MOLECULES.water;
      const h1 = new THREE.Vector3(...spec.atoms[1].pos).normalize();
      const h2 = new THREE.Vector3(...spec.atoms[2].pos).normalize();
      const bis = h1.clone().add(h2).normalize();
      const d = shellDist(kind);
      const shell = [], badge = group.userData.badge;
      /* The charge badge stays on the ion, over the shell: screening is not
         cancelling. Enlarged ONCE, or growShell compounds it every lap. */
      if (badge && !badge.userData.enlarged) {
        badge.userData.enlarged = true; badge.material.depthTest = false;
        badge.position.copy(badge.userData.base); badge.scale.multiplyScalar(1.6);
      }
      for (const v of OCTA) {
        const w = global.Stage.buildMolecule(spec, { center:false });
        w.scale.setScalar(K_());
        const dir = _wa.set(v[0], v[1], v[2]).normalize();
        _wq.setFromUnitVectors(kind === 'CL' ? h1 : bis, _wb.copy(dir).multiplyScalar(kind === 'CL' ? -1 : 1));
        w.quaternion.copy(_wq);
        w.position.copy(dir).multiplyScalar(d);
        w.userData.seat = w.position.clone();
        w.visible = P.shells;
        group.add(w); shell.push(w);
      }
      group.userData.shell = shell;
      return group;
    }
    /* THE CHANNEL'S ACTUAL MECHANISM: a K⁺ filter's carbonyls sit where a
       water's O does in K⁺'s shell, so K⁺ trades water for filter. Na⁺'s
       tighter shell cannot be matched, so it keeps its coat and does not fit.
       Schematic — no carbonyl ring is drawn. Prop tier. */
    const shedding = [];
    const SHED_N = { K:6, CL:4 };          // most, not all: CLC strips chloride only partly
    function shedShell(t) {
      const shell = t.obj.userData.shell;
      if (!shell || !shell.length) return;
      const n = SHED_N[t.kind] != null ? SHED_N[t.kind] : shell.length;
      const going = shell.slice(0, n), staying = shell.slice(n);
      for (const w of going) {
        w.getWorldPosition(_wa); root.add(w); w.position.copy(_wa);
        const dir = _wb.copy(_wa).sub(t.obj.position).normalize();
        shedding.push({ obj:w, vx:dir.x * 9, vy:dir.y * 9 - 4, vz:dir.z * 9, life:1 });
      }
      t.obj.userData.shell = staying; t.shellOff = true;
    }
    function growShell(t) {
      for (const w of t.obj.userData.shell || []) t.obj.remove(w);
      hydrate(t.obj, t.kind);
      for (const w of t.obj.userData.shell) w.scale.setScalar(0.001);
      t.shellGrow = 0; t.shellOff = false;
    }
    function setShells(on) {
      P.shells = on;
      for (const t of travellers) { const s = t.obj.userData.shell; if (s) for (const w of s) w.visible = on; }
      /* Waters mid-flight are dropped, not hidden, or they pop back somewhere surprising. */
      if (!on) { for (const f of shedding) root.remove(f.obj); shedding.length = 0; }
    }
    function tickShells(dt) {
      for (let i = shedding.length - 1; i >= 0; i--) {
        const f = shedding[i];
        f.obj.position.x += f.vx * dt; f.obj.position.y += f.vy * dt; f.obj.position.z += f.vz * dt;
        f.life -= dt / 0.9;
        const k = Math.max(0, f.life);
        f.obj.scale.setScalar(K_() * k * k);
        if (f.life <= 0) { root.remove(f.obj); shedding.splice(i, 1); }
      }
      for (const t of travellers) {
        if (t.shellGrow == null || t.shellGrow >= 1) continue;
        t.shellGrow = Math.min(1, t.shellGrow + dt / 0.7);
        const k = t.shellGrow * t.shellGrow * (3 - 2 * t.shellGrow);
        for (const w of t.obj.userData.shell) w.scale.setScalar(K_() * k);
      }
    }
    const LAUNCH_GROW = 0.22;
    function tickBirth(dt) {
      for (const t of travellers) {
        if (t.born == null || t.born >= 1) continue;
        t.born = Math.min(1, t.born + dt / LAUNCH_GROW);
        const k = t.born * t.born * (3 - 2 * t.born);
        t.obj.scale.setScalar(t.bornScale * k);
      }
    }

    /* ---- travellers ----
       One pool. Each carries where it is going and how fast and NOTHING
       else: a traveller does not know what scene it is in. */
    const travellers = [];
    let nextId = 1;
    const WALK_SPEED = [14, 24], ION_SPEED = [8, 16], DRIFT_SPEED = [12, 18];
    const WATER_CORE = 1.0;
    const ION_GAP = 2 * global.Parts.ION.K.r * global.Parts.ION.exaggeration + 2.6;
    const CHANNEL_KEEPOUT = 26;
    let warnedBudget = false;
    function add(kind, opts = {}) {
      const ion = !!ELEMENT_OF[kind] || kind === 'A';
      const nIons = ion ? travellers.reduce((n, t) => n + (ELEMENT_OF[t.kind] || t.kind === 'A' ? 1 : 0), 0) : 0;
      if (travellers.length >= P.maxTravellers || (ion && nIons >= P.maxIons)) {
        if (!warnedBudget) { warnedBudget = true; console.warn(`membrane.js: budget is ${P.maxTravellers} travellers and ${P.maxIons} ions; add() refused`); }
        return null;
      }
      const o = Object.assign({ x:0, z:0, y:0, vy:0, blocked:false }, opts);
      if (typeof o.conducts === 'string') { o.conductsKind = o.conducts; o.conducts = poreX(o.conducts); }
      const obj = kind === 'A' ? makeAnion()
        : (kind === 'NA' || kind === 'K' || kind === 'CL') ? chargedIon(kind) : smallMolecule(kind);
      if (o.shell) hydrate(obj, kind);
      obj.position.set(o.x, o.y, o.z);
      root.add(obj);
      const t = Object.assign({ kind, obj, id: nextId++ }, o);
      if (t.blocked) t.bounded = true;    // cannot cross, so must not leave and come back either
      t.spin = { x:rnd(-.9,.9), y:rnd(-.9,.9), z:rnd(-.9,.9) };
      t.flipEvery = rnd(0.55, 1.15); t.since = Math.random() * t.flipEvery;
      if (t.walk) repick(t);
      if (t.born != null) { t.bornScale = obj.scale.x; obj.scale.setScalar(0.001); }
      travellers.push(t);
      return t;
    }
    const farY = () => P.extent * 0.94;
    const inCompartment = side => side * rnd(HALF + 4, farY());
    /* Ions default to ion speed, water to walking; blocked unless the bilayer
       lets it through (a gas, or water). An ion with a channel of its kind on
       stage uses it. The anions sit deep in the cytosol, heavy and slow,
       because protein and phosphate are the bulk of the interior and not a
       layer lining the membrane. Anything can be overridden. */
    function scatter(kind, n, side, opts = {}) {
      const ion = !!ELEMENT_OF[kind] || kind === 'A';
      const out = [];
      for (let i = 0; i < n; i++) {
        const s = side === 0 ? (i % 2 ? 1 : -1) : side;
        const far = farY();
        const def = {
          x: opts.clear === false ? rnd(-SPREAD(), SPREAD()) : rndClear(SPREAD() * (opts.span || 1)),
          z: rnd(-11, 11), y: inCompartment(s),
          walk:true, bounded:true,
          speed: ion ? ION_SPEED : WALK_SPEED,
          blocked: ion, coreSpeed: kind === 'water' ? WATER_CORE : undefined,
          keepout: kind === 'water' ? CHANNEL_KEEPOUT : undefined,
          shell: ion && kind !== 'A' && P.shells,
          conducts: (kind === 'K' || kind === 'CL') && poreX(kind) != null ? kind : undefined,
        };
        if (kind === 'A') Object.assign(def, { speed:[2, 5], y: s * far * (0.42 + Math.random() * 0.5),
                                               yband: s < 0 ? [-far, -far * 0.38] : [far * 0.38, far] });
        const t = add(kind, Object.assign(def, opts));
        if (!t) break;
        out.push(t);
      }
      return out;
    }
    /* Reconcile the stage to `contents`, by current side. Removal takes the
       nearest to the membrane first, so what a student watched cross is the
       last thing to vanish. */
    function setContents(c) {
      P.contents = c;
      for (const [sideName, side] of [['inside', -1], ['outside', 1]]) {
        const want = (c && c[sideName]) || {};
        const kinds = new Set([...Object.keys(want),
          ...travellers.filter(t => Math.sign(t.y) === side).map(t => t.kind)]);
        for (const kind of kinds) {
          const n = want[kind] | 0;
          const have = travellers.filter(t => t.kind === kind && !t.aboard && Math.sign(t.y) === side)
            .sort((a, b) => Math.abs(b.y) - Math.abs(a.y));
          if (have.length > n) for (const t of have.slice(n)) remove(t);
          else if (have.length < n) scatter(kind, n - have.length, side);
        }
      }
    }
    function remove(t) {
      const i = travellers.indexOf(t);
      if (i < 0) return;
      root.remove(t.obj); travellers.splice(i, 1);
    }
    function clear() {
      for (const t of travellers) root.remove(t.obj);
      travellers.length = 0;
      for (const f of shedding) root.remove(f.obj);
      shedding.length = 0;
      cargo.NA.length = 0; cargo.K.length = 0;
    }
    function rndClear(span) {
      for (let i = 0; i < 24; i++) {
        const x = rnd(-span, span);
        if (PORES.every(Q => Math.abs(x - Q.x) >= CHANNEL_KEEPOUT)) return x;
      }
      const edge = PORES.reduce((m, Q) => Math.max(m, Math.abs(Q.x)), 0) + CHANNEL_KEEPOUT;
      const x = rnd(Math.min(edge, span * 0.9), span);
      return Math.random() < .5 ? -x : x;
    }
    const laneGap = x => PORES.reduce((m, Q) => Math.min(m, Math.abs(x - Q.x)), Infinity);
    function repick(t) {
      const sp = t.speed || WALK_SPEED, v = rnd(sp[0], sp[1]);
      const cz = rnd(-1, 1), sr = Math.sqrt(1 - cz * cz), ph = rnd(0, Math.PI * 2);
      t.vy = v * cz; t.vx = v * sr * Math.cos(ph); t.vz = v * sr * Math.sin(ph);
    }

    /* ---- getting INTO a pore ----
       Nothing queues in solution: an ion is an ordinary walker until it
       wanders within reach of its own pore's mouth. THE MOUTH PULLS, or blind
       diffusion never finds a target a few Ångström across; a vestibule lined
       with acidic residues IS an electrostatic well, only the strength is
       staged. `seeks` is attracted to the nearest channel, `conducts` admitted
       by one. */
    const SEEK_PULL = 0.7, FUNNEL_R = 170, FUNNEL_PULL = 16, ESCAPE_R = 78, CAPTURE_R = 13;
    const _fv = new THREE.Vector3();
    const nearestChannel = t => {
      let best = null;
      for (const Q of PORES) if (Q.kind && (best == null || Math.abs(t.x - Q.x) < Math.abs(t.x - best))) best = Q.x;
      return best;
    };
    function funnel(t, dt) {
      if (t.exitPt) {
        if (Math.hypot(t.x - t.exitPt.x, t.y - t.exitPt.y, t.z - t.exitPt.z) < ESCAPE_R) return;
        t.exitPt = null;
      }
      if (!mayEnter(t)) return;
      const target = t.conducts != null ? t.conducts : t.seeks ? nearestChannel(t) : null;
      if (t.lane == null && target != null) {
        const side = Math.sign(t.y) || 1;
        _fv.set(target - t.x, side * T.height * 0.85 - t.y, -t.z);
        const d = _fv.length();
        if (d > 0.001 && d < FUNNEL_R) {
          _fv.multiplyScalar(1 / d);
          const k = FUNNEL_PULL * (t.seeks ? SEEK_PULL : 1) * (1 - d / FUNNEL_R) * dt;
          t.vx += _fv.x * k; t.vy += _fv.y * k; t.vz += _fv.z * k;
          const sp = (t.speed || WALK_SPEED)[1], v = Math.hypot(t.vx, t.vy, t.vz);
          if (v > sp) { const s = sp / v; t.vx *= s; t.vy *= s; t.vz *= s; }
        }
      }
    }
    /* ONLY THE CROWDED SIDE MAY SEND with the potential off: this model
       suppresses the return rate, so without the rule one side ends up with
       everything. Net flow halts at equality on its own. */
    function sideCount(kind) {
      let inside = 0, outside = 0;
      for (const t of travellers) { if (t.kind !== kind) continue; if (t.y >= 0) outside++; else inside++; }
      return { inside, outside };
    }
    function crowdedSide(kind) {
      const c = sideCount(kind);
      if (Math.abs(c.outside - c.inside) <= 1) return 0;
      return c.outside > c.inside ? 1 : -1;
    }
    const potentialOn = () => P.potential !== 'off';
    const mayEnter = t => t.seeks ? true : potentialOn() || Math.sign(t.y) === crowdedSide(t.kind);
    function refuseAt(t, lane) {
      const away = Math.sign(t.y) || 1, sp = (t.speed || WALK_SPEED)[1];
      t.exitPt = { x:t.x, y:t.y, z:t.z };
      t.vy = Math.abs(t.vy) * away + away * sp;
      t.vx = (t.x >= lane ? 1 : -1) * sp * 0.5;
    }
    function tryCapture(t) {
      if (t.lane != null) return false;
      if (t.conducts == null) {
        if (!t.seeks || t.exitPt) return false;
        const lane = nearestChannel(t);
        if (lane == null) return false;
        const ay = Math.abs(t.y);
        if (Math.abs(t.x - lane) > CAPTURE_R || Math.abs(t.z) > CAPTURE_R) return false;
        if (ay > T.height * 0.99 || ay < T.height * 0.7) return false;
        refuseAt(t, lane);
        return false;
      }
      if (t.exitPt) return false;
      const lane = t.conducts;
      if (Math.abs(t.x - lane) > CAPTURE_R || Math.abs(t.z) > CAPTURE_R) return false;
      const ay = Math.abs(t.y);
      if (ay > T.height * 0.99 || ay < T.height * 0.7) return false;
      if (!mayEnter(t)) return false;
      /* A pore takes one file, going one way. */
      const want = -Math.sign(t.y);
      const inLane = travellers.filter(o => o.lane === lane);
      if (inLane.some(o => Math.sign(o.vy) !== want)) return false;
      const gap = Math.max(ION_GAP, bulkRadius(t) * 2 + 1.2);
      if (inLane.some(o => Math.abs(o.y - t.y) < gap)) return false;
      t.lane = lane; t.x = lane; t.z = 0;
      t.vy = -Math.sign(t.y) * 11;
      t.obj.position.set(t.x, t.y, t.z);
      return true;
    }

    /* ---- the membrane potential ----
       The leak builds the thing that stops it. REAL: E_K, E_Cl. NOT REAL:
       mV per ion — a membrane needs millions of ions for 100 mV, so
       mvPerIon lands the effect in the seconds a student is watching. */
    let mV = 0, chargeOut = 0;
    const crossed = { K:0, CL:0 };
    function nernst(kind) {
      const c = sideCount(kind), z = kind === 'CL' ? -1 : 1;
      return (61 / z) * Math.log10((c.outside + 0.5) / (c.inside + 0.5));
    }
    const equilibriumOf = kind => P.potential === 'nernst' ? nernst(kind) : (P.E[kind] != null ? P.E[kind] : P.E.K);
    /* Signed, never clamped: negative means the voltage has overshot this
       ion's equilibrium and drives it back — the Goldman result, emerging. */
    const drive = kind => !potentialOn() ? 0 : (mV - equilibriumOf(kind)) / -equilibriumOf(kind);
    function netPush() {
      let nK = 0, nCl = 0;
      for (const t of travellers) { if (t.conducts == null) continue; if (t.kind === 'K') nK++; else if (t.kind === 'CL') nCl++; }
      const n = nK + nCl;
      return n ? (drive('K') * nK + drive('CL') * nCl) / n : 0;
    }
    const floorMV = () => Math.min(P.E.K, P.E.CL);

    /* ---- conduction is a HOP, not a conveyor: knock-on, dwell then hop ---- */
    const HOP = { wait:[0.10, 0.30], move:0.10, crowd:0.06 };
    function tickQueue(t, dt) {
      if (Math.abs(t.y) > T.height) {
        if (t.inPore) {
          const q = (t.kind === 'CL' ? -1 : 1) * Math.sign(t.y);
          chargeOut += q; crossed[t.kind] = (crossed[t.kind] || 0) + q;
          mV = Math.min(0, Math.max(floorMV(), P.mvPerIon * chargeOut));
          emit('conduct', t, Math.sign(t.y));
        }
        t.inPore = false; t.hop = null; t.lane = null;
        t.bounded = true;                 // it stays where it lands: a gradient runs out
        if (t.walk) {
          repick(t);
          const sp = (t.speed || WALK_SPEED)[1], away = Math.sign(t.y) || 1;
          t.vy = Math.abs(t.vy) * away + away * sp;
          t.exitPt = { x:t.x, y:t.y, z:t.z };
        }
        return false;
      }
      t.inPore = true;
      const push = drive(t.kind);
      if (!t.hop) t.hop = { wait: rnd(HOP.wait[0], HOP.wait[1]), t:0, moving:false };
      const h = t.hop;
      h.t += dt;
      if (!h.moving) {
        if (h.t < h.wait) { t.obj.position.y = t.y; return true; }
        const gap = Math.max(ION_GAP, bulkRadius(t) * 2 + 1.2);
        if (queueAhead(t) < gap) { t.obj.position.y = t.y; return true; }
        h.moving = true; h.t = 0;
        if (!potentialOn()) h.dir = Math.sign(t.vy);
        else {
          /* p(forward) = ½ + ½·push: net flux proportional to driving force. */
          const pref = (t.kind === 'CL' ? -1 : 1) * (push >= 0 ? 1 : -1);
          const p = 0.5 + 0.5 * Math.min(1, Math.abs(push));
          h.dir = Math.random() < p ? pref : -pref;
        }
      }
      const step = Math.max(ION_GAP, bulkRadius(t) * 2 + 1.2);
      t.y += (h.dir || Math.sign(t.vy)) * (step / HOP.move) * dt;
      if (h.t >= HOP.move) {
        h.moving = false; h.t = 0;
        const behind = queueBehind(t);
        h.wait = behind < step * 1.8 ? rnd(HOP.crowd * 0.6, HOP.crowd * 1.4) : rnd(HOP.wait[0], HOP.wait[1]);
      }
      t.obj.position.y = t.y;
      return true;
    }
    function queueAhead(t) {
      let best = Infinity;
      for (const o of travellers) { if (o === t || o.lane !== t.lane) continue;
        const d = (o.y - t.y) * Math.sign(t.vy); if (d > 0 && d < best) best = d; }
      return best;
    }
    function queueBehind(t) {
      let best = Infinity;
      for (const o of travellers) { if (o === t || o.lane !== t.lane) continue;
        const d = (t.y - o.y) * Math.sign(t.vy); if (d > 0 && d < best) best = d; }
      return best;
    }

    function lateral(t, dt) {
      const x0 = t.band ? t.band[0] : -SPREAD(), x1 = t.band ? t.band[1] : SPREAD();
      t.x += t.vx * dt; t.z += t.vz * dt;
      if (t.x > x1) { t.x = x1; t.vx = -t.vx; }
      if (t.x < x0) { t.x = x0; t.vx = -t.vx; }
      if (t.keepout && PORES.length && laneGap(t.x) < t.keepout) {
        let near = PORES[0].x;
        for (const Q of PORES) if (Math.abs(t.x - Q.x) < Math.abs(t.x - near)) near = Q.x;
        t.x = near + Math.sign(t.x - near || 1) * t.keepout;
        t.vx = -t.vx;
      }
      if (t.z >  11) { t.z =  11; t.vz = -t.vz; }
      if (t.z < -11) { t.z = -11; t.vz = -t.vz; }
      t.obj.position.x = t.x; t.obj.position.z = t.z;
    }
    function tumble(t, dt) {
      t.obj.rotation.x += dt * t.spin.x; t.obj.rotation.y += dt * t.spin.y; t.obj.rotation.z += dt * t.spin.z;
    }

    /* ---- the proteins are solid: an annulus, open down the middle ----
       The barrel is domed, parts.js's own profile copied because the page
       cannot ask the mesh. */
    function poreRadiusAt(Q, y) {
      const H = T.height, u = Math.abs(y) / H, cap = 0.30;
      let sc = 1;
      if (u > 1 - cap) { const k = (u - (1 - cap)) / cap; sc = Math.sqrt(Math.max(0, 1 - k * k)); }
      const waist = 1 - 0.07 * Math.exp(-((y / (HALF * 0.8)) ** 2));
      return Q.R * sc * waist;
    }
    function keepOutOfPores(t) {
      if (t.lane != null || t.aboard) return;
      const rad = bulkRadius(t);
      if (Math.abs(t.y) >= T.height + rad) return;
      for (const Q of PORES) {
        const dx = t.x - Q.x, dz = t.z, r = Math.hypot(dx, dz);
        const wall = poreRadiusAt(Q, t.y) + rad;
        if (r >= wall) continue;
        if (r <= Q.lumen + rad && t.conducts === Q.x && Math.abs(t.y) > T.height * 0.6) continue;
        const push = r > 0.001 ? wall / r : 1;
        t.x = Q.x + dx * push; t.z = dz * push;
        if (r <= 0.001) t.x = Q.x + wall;
        t.obj.position.x = t.x; t.obj.position.z = t.z;
        t.vx = Math.abs(t.vx) * Math.sign(t.x - Q.x || 1);
      }
    }
    const atMouth = t => t.conducts != null && Math.hypot(t.x - t.conducts, t.z) < CAPTURE_R * 2 && Math.abs(t.y) < T.height * 1.4;
    /* Hydrated ions do not interpenetrate: a spacing rule, not a force.
       BUCKETED, because all pairs is quadratic in the crowd and a generated
       page with eighty ions spent its whole frame here. The cell is the
       widest thing that can collide, a hydrated chloride, so only the 27
       neighbouring cells can hold a partner. Rebuilt per pass: a push moves
       an ion, and the second pass must see where it went. */
    const CELL = 2 * (shellDist('CL') + rO_()) + 1;
    const _grid = new Map();
    const _key = (x, y, z) => ((x + 512) << 20) ^ ((y + 512) << 10) ^ (z + 512);
    function keepClear(list) {
      for (let pass = 0; pass < 2; pass++) {
        _grid.clear();
        for (const t of list) {
          const k = _key(Math.floor(t.obj.position.x / CELL), Math.floor(t.y / CELL), Math.floor(t.obj.position.z / CELL));
          const b = _grid.get(k); if (b) b.push(t); else _grid.set(k, [t]);
        }
        for (const a of list) {
          if (atMouth(a)) continue;
          const cx = Math.floor(a.obj.position.x / CELL), cy = Math.floor(a.y / CELL), cz = Math.floor(a.obj.position.z / CELL);
          for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
            const bucket = _grid.get(_key(cx + dx, cy + dy, cz + dz));
            if (!bucket) continue;
            for (const b of bucket) {
              if (b === a || b.id <= a.id) continue;      // each pair once
              if (atMouth(b)) continue;
              pushApart(a, b);
            }
          }
        }
      }
    }
    function pushApart(a, b) {
      const min = bulkRadius(a) + bulkRadius(b);
      let dx = b.obj.position.x - a.obj.position.x, dy = b.y - a.y, dz = b.obj.position.z - a.obj.position.z;
      const d2 = dx*dx + dy*dy + dz*dz;
      if (d2 >= min * min || d2 < 1e-6) return;
      /* A QUEUED ION IS NOT SHOVED OFF ITS LANE — sideways is the wall. The
         free partner takes the whole correction, two free ions split it,
         and two queued ones are left to the file's waiting rule. */
      const aFree = a.lane == null, bFree = b.lane == null;
      if (!aFree && !bFree) return;
      const share = (aFree && bFree) ? 0.5 : 1;
      const d = Math.sqrt(d2), push = (min - d) * share / d;
      dx *= push; dy *= push; dz *= push;
      if (aFree) { a.x -= dx; a.y -= dy; a.z -= dz; a.obj.position.set(a.x, a.y, a.z); }
      if (bFree) { b.x += dx; b.y += dy; b.z += dz; b.obj.position.set(b.x, b.y, b.z); }
    }

    /* Where a traveller is allowed to be. The bilayer's interior is oily: a
       charged or strongly polar thing does not enter it. */
    function advance(t, dt) {
      if (t.conducts != null || t.seeks) { funnel(t, dt); tryCapture(t); }
      if (t.lane != null && tickQueue(t, dt)) return;
      const inCore = Math.abs(t.y) < HALF;
      if (t.blocked) {
        const edge = HALF + 2.4;
        if ((t.vy < 0 && t.y <= edge && t.y > 0) || (t.vy > 0 && t.y >= -edge && t.y < 0)) {
          t.vy = -t.vy;
          if (t.walkOnBounce) {
            t.walkOnBounce = false; t.walk = true; t.since = 0;
            repick(t); t.vy = Math.abs(t.vy) * Math.sign(t.y);
          }
        }
      }
      if (t.walk && !inCore) {
        t.since = (t.since || 0) + dt;
        if (t.since > t.flipEvery) { t.since = 0; t.flipEvery = rnd(0.55, 1.15); repick(t); }
      }
      if (t.walk) lateral(t, dt);
      t.y += t.vy * dt * (inCore && !t.blocked ? t.coreSpeed || 1 : 1);
      if (t.bounded) {
        const far = P.extent;
        const lo = t.yband ? t.yband[0] : -far, hi = t.yband ? t.yband[1] : far;
        if (t.y > hi) { t.y = hi; t.vy = -Math.abs(t.vy); }
        if (t.y < lo) { t.y = lo; t.vy =  Math.abs(t.vy); }
        t.obj.position.y = t.y; tumble(t, dt);
        return;
      }
      if (t.slowFrom != null && Math.sign(t.y) !== t.slowFrom) {
        t.slowFrom = null; t.vy = Math.sign(t.vy) * rnd(DRIFT_SPEED[0], DRIFT_SPEED[1]);
      }
      if (t.exits && Math.abs(t.y) > P.extent) { t.gone = true; return; }
      if (t.y >  P.extent) t.y = -P.extent;
      if (t.y < -P.extent) t.y =  P.extent;
      t.obj.position.y = t.y; tumble(t, dt);
    }

    /* ---- the pump's cargo is REAL IONS ----
       A spend recruits travellers out of the solution, so setting them down
       on the far side changes the counts and moves the voltage. pump.js owns
       the choreography; this only decides WHICH ions ride. */
    let pumpT = 0, running = false, atpSpent = 0, lastPhase = '';
    const lastGates = { top: NaN, bottom: NaN };
    const cargo = { NA:[], K:[] };
    const PUMP_LOAD = { NA:-1, K:1 };
    function recruit(kind, n) {
      const side = PUMP_LOAD[kind];
      const pool = travellers.filter(t => t.kind === kind && !t.aboard && Math.sign(t.y) === side)
        .sort((a, b) => ((a.x - pumpX) ** 2 + a.y * a.y) - ((b.x - pumpX) ** 2 + b.y * b.y));
      if (pool.length < n) return [];   // all or nothing, or aboard ions strand
      const took = pool.slice(0, n);
      for (const t of took) t.aboard = true;
      return took;
    }
    function seatRider(t, c, i, n) {
      const rr = n > 1 ? ionRadius(t.kind) * 1.15 : 0, th = (i / n) * Math.PI * 2;
      const tx = pumpX + Math.cos(th) * rr, tz = Math.sin(th) * rr, ty = c.u * T.height, k = 0.16;
      t.x += (tx - t.x) * k; t.z += (tz - t.z) * k; t.y += (ty - t.y) * k;
      t.obj.position.set(t.x, t.y, t.z);
    }
    function deliver(kind) {
      const to = -PUMP_LOAD[kind];
      for (const t of cargo[kind]) {
        t.aboard = false;
        t.y = to * T.height * 1.15; t.x = pumpX + rnd(-18, 18); t.z = rnd(-8, 8);
        t.obj.position.set(t.x, t.y, t.z);
        repick(t); t.vy = Math.abs(t.vy) * to;
      }
      cargo[kind].length = 0;
    }
    /* Paid up front: a real pump phosphorylates itself at the START. */
    function startTurn() { pumpT = 0; running = true; lastPhase = ''; atpSpent++; emit('turn', atpSpent); }
    function finishCycle() { chargeOut += 1; mV = Math.max(-95, P.mvPerIon * chargeOut); }
    /* One press buys one turn. False if a turn is under way or nothing to carry. */
    function spend() {
      if (!P.proteins.pump || running) return false;
      cargo.NA = recruit('NA', 3);
      if (!cargo.NA.length) return false;
      startTurn();
      return true;
    }
    function runPumpCycle(dt) {
      if (!P.proteins.pump) return null;
      if (running) {
        pumpT += dt / P.turnSeconds;
        if (pumpT >= 1) { pumpT = 0; running = false; deliver('K'); finishCycle(); lastPhase = ''; emit('turned', atpSpent); }
      }
      const st = global.Pump.at(pumpT);
      /* setGates rebuilds the lathe, which costs a frame's worth of time on
         its own; an idle pump asks for the same gates every frame. */
      if (st.gates.top !== lastGates.top || st.gates.bottom !== lastGates.bottom) {
        PUMP.setGates(st.gates.top, st.gates.bottom);
        lastGates.top = st.gates.top; lastGates.bottom = st.gates.bottom;
      }
      if (running && st.phase !== lastPhase) {
        if (st.phase === 'load-k') { deliver('NA'); cargo.K = recruit('K', 2); }
        lastPhase = st.phase;
      }
      const used = { NA:0, K:0 };
      const seats = st.cargo.reduce((a, c) => (a[c.species] = (a[c.species] || 0) + 1, a), {});
      for (const c of st.cargo) {
        const i = used[c.species]++, t = cargo[c.species][i];
        if (!t) continue;
        seatRider(t, c, i, seats[c.species]);
      }
      return st;
    }

    /* ---- one frame, in one order ----
       advance → keepClear → keepOutOfPores → shells → sweep. Wall exclusion
       runs after keepClear because whatever moves a traveller last decides
       where it is. Osmosis crossings are counted always; a page that does
       not care ignores them. */
    let crossings = { up:0, down:0 }, netRecent = 0;
    const NET_HALFLIFE = 30;
    let phase = null, elapsed = 0;
    function step(dt) {
      kit.faceCamera(camera);
      if (P.lipidMotion) MEM.tick(dt);
      tickBirth(dt);
      if (P.proteins.pump && P.pumpAuto && P.pumpOn && !running && cargo.NA.length === 0) {
        const got = recruit('NA', 3);
        if (got.length) { cargo.NA = got; startTurn(); }
      }
      const st = runPumpCycle(dt);
      phase = st ? st.phase : null;
      for (const t of travellers) {
        if (t.aboard) continue;
        const was = t.y;
        advance(t, dt);
        if (!t.blocked) {
          if (was > 0 && t.y <= 0) { crossings.down++; netRecent -= 1; emit('cross', t, -1); }
          if (was < 0 && t.y >= 0) { crossings.up++;   netRecent += 1; emit('cross', t,  1); }
        }
      }
      netRecent *= Math.pow(0.5, dt / NET_HALFLIFE);
      keepClear(travellers.filter(t => (ELEMENT_OF[t.kind] || t.kind === 'A') && !t.aboard));
      for (const t of travellers) keepOutOfPores(t);
      if (P.shells && PORES.length) {
        const mouth = T.height * 0.9;
        for (const t of travellers) {
          if (t.lane == null && !t.shellOff) continue;
          if (!t.shellOff && Math.abs(t.y) < mouth) shedShell(t);
          else if (t.shellOff && Math.abs(t.y) > mouth) growShell(t);
        }
      }
      tickShells(dt);
      for (let i = travellers.length - 1; i >= 0; i--)
        if (travellers[i].gone) { root.remove(travellers[i].obj); travellers.splice(i, 1); }
      elapsed += dt;
      const s = state();
      emit('frame', s, dt);
      return s;
    }

    function state() {
      const counts = {};
      for (const t of travellers) {
        const c = counts[t.kind] || (counts[t.kind] = { inside:0, outside:0 });
        if (t.y >= 0) c.outside++; else c.inside++;
      }
      /* THE VERDICT A PAGE PRINTS, off the HEADCOUNT, not the traffic. Osmosis
         is the headcount: more free water on a side means more of it wanders
         off that side, and that is the claim the page makes. The observed
         crossings say the same thing eventually, but at eighty molecules
         they are noise for the first half minute — a 50/50 stage read
         "leaving" and a 26/46 one read "balanced". `crossings` and
         `netRecent` stay for a page that wants to show what happened. */
      const w = counts.water || { inside: 0, outside: 0 };
      const nW = w.inside + w.outside;
      const diff = w.inside - w.outside;
      const net = Math.abs(diff) <= Math.max(2, 0.08 * nW) ? 'balanced' : diff > 0 ? 'leaving' : 'entering';
      return { t:elapsed, counts, mV, chargeOut, crossed:Object.assign({}, crossed),
        crossings:Object.assign({}, crossings), netRecent, net, netPush:netPush(),
        atpSpent, pumpRunning:running, pumpPhase:phase, pumpT,
        equilibrium: { K:equilibriumOf('K'), CL:equilibriumOf('CL') } };
    }
    function reset() {
      mV = 0; chargeOut = 0; crossed.K = crossed.CL = 0;
      crossings = { up:0, down:0 }; netRecent = 0;
      pumpT = 0; running = false; atpSpent = 0; lastPhase = '';
      for (const t of travellers) t.aboard = false;
      cargo.NA.length = 0; cargo.K.length = 0;
    }
    function set(next) {
      if (next.proteins) layout(next.proteins);
      if (next.shells != null) setShells(next.shells);
      if (next.cut != null) setCut(next.cut);
      for (const k of Object.keys(next)) if (!(k in { proteins:1, shells:1, cut:1, contents:1 })) P[k] = next[k];
      if (next.E) P.E = Object.assign({}, DEFAULTS.E, next.E);
      if (next.contents !== undefined) setContents(next.contents);
    }
    function on(ev, fn) {
      (listeners[ev] || (listeners[ev] = [])).push(fn);
      return () => { const i = listeners[ev].indexOf(fn); if (i >= 0) listeners[ev].splice(i, 1); };
    }

    layout(P.proteins);
    setShells(P.shells);
    if (P.contents) setContents(P.contents);

    return { step, state, reset, set, on, spend,
      add, scatter, remove, clear, travellers,
      params: () => P, pores: () => PORES.slice(),
      get height() { return T.height; },
      half: HALF, SPEED: { WALK:WALK_SPEED, ION:ION_SPEED }, KEEPOUT: CHANNEL_KEEPOUT,
      proteins: { K:CHANNEL, CL:CLCHAN, pump:PUMP }, get membrane() { return MEM; } };
  }

  /* ---- one box ----
     The compartments' extent is solved off the camera, so a molecule never
     blinks into existence in view. Like watersim-mount.js, this adds no
     physics: `m.sim` and `m.box` are the layers under it. */
  function mount(el, params = {}) {
    if (!global.CardStage) throw new Error('membrane.js: load kit/card-stage.js first');
    let sim = null;
    const box = global.CardStage.create({
      mount: el,
      cam: params.cam || { theta:0, phi:Math.PI / 2 - 0.10, r:300 },
      stage: Object.assign({ orbit:false, rMin:50, rMax:600 }, params.stage || {}),
      step: dt => { if (sim) last = sim.step(dt); },
      viewOffset: params.viewOffset,
      onResize: () => { if (sim) sim.set({ extent: extentOf() }); },
    });
    box.renderer.localClippingEnabled = true;
    const extentOf = () => {
      const cam = box.camera;
      const halfH = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2) * box.cam.r;
      return halfH + 26;
    };
    let last = null;
    sim = create(THREE, box.root, box.camera, Object.assign({ extent: extentOf() }, params));
    if (params.cut != null) sim.set({ cut: params.cut }); else sim.set({ cut: true });
    return {
      sim, box,
      set(next) { sim.set(next); return this; },
      state: () => last || sim.state(),
      on: sim.on, spend: sim.spend,
      add: sim.add, scatter: sim.scatter, clear: sim.clear, reset: sim.reset,
      start: box.start, stop: box.stop, pump: box.pump,
      destroy() { box.destroy(); },
    };
  }

  global.Membrane = { create, mount, DEFAULTS };
})(typeof globalThis !== 'undefined' ? globalThis : this);
