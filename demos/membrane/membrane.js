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
 *      proteins: { K | CL | NA | AQP | pump | complex | synthase | leak: {x} | null }
 *  K, CL and NA are channels for their ion; AQP is an aquaporin, a pore for
 *  water and nothing charged, single file, direction by headcount alone.
 *
 *  CHEMIOSMOSIS is the same membrane in an organelle. `context` renames the
 *  two sides and repaints the lipid ('plasma' | 'mitochondrion' | 'thylakoid')
 *  and changes nothing else: the code keeps +y outside and −y inside in every
 *  context. `complex` pumps protons out and pays with `fuel` ('NADH' |
 *  'FADH2' | 'light') at `fuelRate`, never with ATP; `synthase` lets them back
 *  down and turns a rotor, three protons a third-turn and one ATP with it;
 *  `leak` is an uncoupler's hole, protons home without ATP. The gradient's
 *  arithmetic — pH, the proton-motive force, the rotor's stoichiometry, and
 *  the rule that neither door runs uphill — is membrane/chemiosmosis.js, kept
 *  free of THREE so check-chemiosmosis.js can run it in node. `pumped`
 *  (turns) and `atp` (count) are its events.
 *
 *  mount() NAMES BOTH HALVES ON THE STAGE and keeps them there, whatever the
 *  context, because a compartment with no name on it is one the reader has to
 *  be told about in prose. `sideLabels:false` for a page drawing its own, as
 *  membrane-lab does.
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
  const ELEMENT_OF = { NA:'Na', K:'K', CL:'Cl', MG:'Mg', H:'H' };
  const OCTA = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];

  const DEFAULTS = {
    half: 15.3,               // OPM's half-thickness, from the bake
    reach: 340,               // the sheet runs off both edges: visible ends are a raft
    exag: 5.0,                // one exaggeration for everything that crosses (see below)
    extent: 90,               // half-height of each compartment, in world units
    spread: null,             // ±x scatter; default reach * 0.55
    proteins: { K:null, CL:null, NA:null, AQP:null, pump:null, complex:null, synthase:null, leak:null },
    /* CONTEXT renames the two sides and repaints the lipid. Nothing else:
       the code keeps +y outside and −y inside in every context, so the
       thylakoid pumping into its lumen and the mitochondrion pumping out of
       its matrix are the same direction here. chemiosmosis.js owns the
       names. */
    context: 'plasma',        // 'plasma' | 'mitochondrion' | 'thylakoid'
    fuel: null,               // 'NADH' | 'FADH2' | 'light' | null — null lets the gradient run down
    fuelRate: 1,              // 0..1, a light dimmer or an oxygen switch
    complexSeconds: 6.0,      // ONE FULL CYCLE, the empty half included; three real complexes are drawn as one
    mvFloor: null,            // how negative the inside may get; null takes it from the context
    /* WHICH HALF IS WHICH, on the stage, always. membrane-lab pins its two
       tallies at the edges and keeps them across every step, and the reason
       is the same here: a compartment with no name on it is a compartment
       the reader has to be told about in prose, and prose is where it goes
       wrong. A generated photosynthesis page called the lumen "inner"
       because the screen never said otherwise. mount() draws these; a page
       driving create() puts its own up, as membrane-lab does. */
    sideLabels: true,
    potential: 'off',
    E: { K:-90, CL:-75, NA:60 },   // mV, the Nernst potentials of the gradients drawn
    mvPerIon: -2.5,           // stage timing, not a measurement (see netPush)
    pumpAuto: false,
    pumpOn: true,
    turnSeconds: 11,
    timeScale: 1,             // sim seconds per real second; 'speed it up' is one set()
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
    /* CONCENTRATION IN UNITS. With units:'mM' the numbers in `contents` are
       millimolar and the module turns them into counts: one drawn particle
       per `mMPerParticle`, and water fills each side up to
       `particlesPerSide` so the headcount rule holds without the page doing
       arithmetic. 20 mM a particle puts seawater's 470 mM Na⁺ at 24 ions and
       blood's 150 at 8, which the frame can hold. It is an exaggeration in
       one declared number: real water is 55 M, and drawn to scale the salt
       would be one ion in a screen of water. state().concentration reads
       the counts back in mM, so a page never types a molarity. */
    units: 'count',           // 'count' | 'mM'
    mMPerParticle: 20,
    particlesPerSide: 78,
  };

  function create(THREE, root, camera, opts = {}) {
    if (!global.Parts || !global.Pump || !global.Chemiosmosis) throw new Error('membrane.js: load membrane/parts.js, membrane/pump.js and membrane/chemiosmosis.js first');
    const CHEM = global.Chemiosmosis;
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
    /* A Na⁺ LEAK: the epithelial sodium channel is a TRIMER, and it is what
       lets sodium in down its gradient, which is the whole reason the pump
       has work to do. Violet, the sodium family's colour. */
    const NA_R = 13.5, NA_LOBE = 0.12, NA_HOLE = NA_R * (1 + NA_LOBE) + 0.5;
    const NACHAN  = global.Parts.transporter({ half:HALF, site:7.0, mouth:8.4, radius:NA_R, lobes:3, lobeDepth:NA_LOBE, color:0x9b6fd8 });
    /* An AQUAPORIN: a TETRAMER whose pore passes water in single file and
       nothing charged. Slimmer than the ion channels; teal, so it reads as a
       different kind of door. */
    const AQP_R = 12.0, AQP_LOBE = 0.10, AQP_HOLE = AQP_R * (1 + AQP_LOBE) + 0.5;
    const AQP     = global.Parts.transporter({ half:HALF, site:6.4, mouth:8.4, radius:AQP_R, lobes:4, lobeDepth:AQP_LOBE, color:0x3fa7a0 });
    const PUMP    = global.Parts.transporter({ half:HALF, color:0x4f9e78 });
    /* ---- the chemiosmotic pair ----
       A COMPLEX: the electron-transport chain, or the cytochrome b6f of a
       thylakoid. Three complexes in the real chain, drawn as ONE, because
       the lesson's claim is "something with energy to spend pumps protons",
       not the identity of the pumper. INDIGO, for parts.js's reason: an
       organelle tints its bilayer with its own colour, and a mitochondrion's
       is orange, so the warm red this was first drawn in put the machine and
       its lipids in the same hue and made it something to hunt for. Cool
       against a warm sheet and against a thylakoid's green alike, and clear
       of every other protein here. It is a carrier, so it takes the pump's
       snug site.
       SYNTHASE: the c-ring is why it has that many lobes, and the rotor is
       drawn below it, on the inside face, where F1 hangs. */
    const CPX_R = 16.0, CPX_LOBE = 0.14, CPX_HOLE = CPX_R * (1 + CPX_LOBE) + 0.5;
    const COMPLEX = global.Parts.transporter({ half:HALF, site:6.2, mouth:8.0, radius:CPX_R, lobes:3, lobeDepth:CPX_LOBE, color:0x4d5fa6 });
    const SYN_R = 13.2, SYN_LOBE = 0.09, SYN_HOLE = SYN_R * (1 + SYN_LOBE) + 0.5;
    const SYNTH   = global.Parts.transporter({ half:HALF, site:6.0, mouth:8.2, radius:SYN_R, lobes:8, lobeDepth:SYN_LOBE, color:0xd9a13b });
    /* An UNCOUPLER's hole: dinitrophenol, or thermogenin in brown fat.
       Protons come back without touching the synthase, so the gradient
       collapses and no ATP is made. Grey: it is a hole, not a machine. */
    const LEAK_R = 11.0, LEAK_LOBE = 0.06, LEAK_HOLE = LEAK_R * (1 + LEAK_LOBE) + 0.5;
    const LEAK    = global.Parts.transporter({ half:HALF, site:6.0, mouth:7.6, radius:LEAK_R, lobes:0, color:0x8e939b });
    const ROTOR = buildRotor(SYNTH.height);
    SYNTH.group.add(ROTOR);
    const ALL = [CHANNEL, CLCHAN, NACHAN, AQP, PUMP, COMPLEX, SYNTH, LEAK];
    root.add(CHANNEL.group, CLCHAN.group, NACHAN.group, AQP.group, PUMP.group,
             COMPLEX.group, SYNTH.group, LEAK.group);
    let MEM = null, T = PUMP, PORES = [], pumpX = 0, complexX = 0, synthX = null, cut = false;

    /* The F1 head: a ring of three αβ pairs on a shaft. Three, because one
       ATP is made per third of a turn and a student should be able to count
       the beats against the lobes. It TURNS, and that is the only motion in
       the module driven by a count rather than by a clock. */
    function buildRotor(h) {
      const g = new THREE.Group();
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 9, 12), global.Parts.flat(0xb8862c));
      shaft.userData.baseY = h + 4.5; g.add(shaft);
      for (let i = 0; i < 3; i++) {
        const lobe = new THREE.Mesh(new THREE.SphereGeometry(6.2, 18, 12), global.Parts.flat(0xd9a13b));
        lobe.scale.set(1, 1.25, 1);
        const th = (i / 3) * Math.PI * 2;
        lobe.position.set(Math.cos(th) * 7.4, 0, Math.sin(th) * 7.4);
        lobe.userData.baseY = h + 12.5;
        g.add(lobe);
      }
      return g;
    }
    /* F1 HANGS WHERE THE ATP IS MADE, which is the side the protons come out
       on: the matrix in a mitochondrion, the stroma in a chloroplast. Drawn
       below the membrane in both until the thylakoid flipped, and then it was
       making ATP into the lumen. Positioned by sign rather than mirrored by a
       negative scale, which would turn the lighting inside out. */
    function orientRotor(d) {
      for (const child of ROTOR.children) child.position.y = -d * child.userData.baseY;
    }

    /* Two machines closer than this share lipid and read as one lump. A
       page names x by taste and the reference gives a rule, but a generated
       page put a channel between two others 36 apart; so the layout keeps
       the order a page chose and spreads what is too close, symmetrically
       about where the crowd was. */
    const PORE_GAP = 72;
    const LEAK_PREFERENCE = 3;      // protons per one that still takes the synthase
    const PROTEIN_KEYS = { K:null, CL:null, NA:null, AQP:null, pump:null, complex:null, synthase:null, leak:null };
    function spaced(pr) {
      const on = Object.keys(pr).filter(k => pr[k]).map(k => ({ k, x: pr[k].x || 0 })).sort((a, b) => a.x - b.x);
      for (let i = 1; i < on.length; i++) if (on[i].x - on[i - 1].x < PORE_GAP) on[i].x = on[i - 1].x + PORE_GAP;
      const mean0 = on.length ? Object.keys(pr).filter(k => pr[k]).reduce((s, k) => s + (pr[k].x || 0), 0) / on.length : 0;
      const mean1 = on.length ? on.reduce((s, o) => s + o.x, 0) / on.length : 0;
      const out = {};
      for (const o of on) out[o.k] = Object.assign({}, pr[o.k], { x: Math.round(o.x - mean1 + mean0) });
      return Object.assign({}, PROTEIN_KEYS, out);
    }
    function layout(proteins) {
      P.proteins = spaced(Object.assign({}, PROTEIN_KEYS, proteins));
      const pr = P.proteins;
      const holes = [];
      PORES = [];
      CHANNEL.group.visible = !!pr.K;
      if (pr.K) { CHANNEL.group.position.x = pr.K.x; CHANNEL.setGates(1, 1);
        holes.push([pr.K.x, K_HOLE]); PORES.push({ x:pr.K.x, R:K_R, lumen:8.8, kind:'K' }); }
      CLCHAN.group.visible = !!pr.CL;
      if (pr.CL) { CLCHAN.group.position.x = pr.CL.x; CLCHAN.setGates(1, 1);
        holes.push([pr.CL.x, CL_HOLE]); PORES.push({ x:pr.CL.x, R:CL_R, lumen:8.0, kind:'CL' }); }
      NACHAN.group.visible = !!pr.NA;
      if (pr.NA) { NACHAN.group.position.x = pr.NA.x; NACHAN.setGates(1, 1);
        holes.push([pr.NA.x, NA_HOLE]); PORES.push({ x:pr.NA.x, R:NA_R, lumen:8.4, kind:'NA' }); }
      AQP.group.visible = !!pr.AQP;
      if (pr.AQP) { AQP.group.position.x = pr.AQP.x; AQP.setGates(1, 1);
        holes.push([pr.AQP.x, AQP_HOLE]); PORES.push({ x:pr.AQP.x, R:AQP_R, lumen:8.4, kind:'water' }); }
      PUMP.group.visible = !!pr.pump;
      if (pr.pump) { pumpX = pr.pump.x; PUMP.group.position.x = pumpX;
        /* MOUTH rather than site — the site is narrowest and would seat an ion in the wall. */
        holes.push([pumpX, 15.0]); PORES.push({ x:pumpX, R:14.5, lumen:7.6, kind:null }); }
      COMPLEX.group.visible = !!pr.complex;
      if (pr.complex) { complexX = pr.complex.x; COMPLEX.group.position.x = complexX;
        /* A carrier, like the pump: no kind, so nothing queues in it. Its
           protons are recruited, not admitted. */
        holes.push([complexX, CPX_HOLE]); PORES.push({ x:complexX, R:CPX_R, lumen:8.0, kind:null }); }
      SYNTH.group.visible = !!pr.synthase;
      synthX = pr.synthase ? pr.synthase.x : null;
      if (pr.synthase) { SYNTH.group.position.x = synthX; SYNTH.setGates(1, 1);
        holes.push([synthX, SYN_HOLE]); PORES.push({ x:synthX, R:SYN_R, lumen:8.2, kind:'H', door:'synthase' }); }
      LEAK.group.visible = !!pr.leak;
      if (pr.leak) { LEAK.group.position.x = pr.leak.x; LEAK.setGates(1, 1);
        holes.push([pr.leak.x, LEAK_HOLE]); PORES.push({ x:pr.leak.x, R:LEAK_R, lumen:7.6, kind:'H', door:'leak' }); }
      orientRotor(CHEM.pumpDir(P.context));
      T = pr.pump ? PUMP : pr.K ? CHANNEL : pr.CL ? CLCHAN : pr.NA ? NACHAN : pr.AQP ? AQP
        : pr.complex ? COMPLEX : pr.synthase ? SYNTH : pr.leak ? LEAK : PUMP;
      if (MEM) root.remove(MEM.group);
      /* `exclude` is a signed distance, so holes union as the MINIMUM. */
      /* The bilayer is TINTED BY THE ORGANELLE it is standing in, out of
         palette.js, so the sheet a student meets after zooming into a cut
         cell is the colour that cell's mitochondrion was. */
      const ctx = CHEM.CONTEXTS[P.context] || CHEM.CONTEXTS.plasma;
      const tint = global.MolLib.PALETTE.organelles[ctx.organelle] || global.MolLib.PALETTE.organelles.plasma;
      MEM = global.Parts.membrane({ half:HALF, reach:MEM_REACH, head:tint.head, tail:tint.tail,
        exclude: holes.length ? (x, z) => holes.reduce((m, h) => Math.min(m, Math.hypot(x - h[0], z) - h[1]), Infinity) : undefined });
      root.add(MEM.group);
      setCut(cut);
      /* A pore named by kind is re-resolved against the new layout. */
      for (const t of travellers) if (t.conductsKind) t.conducts = poreX(t.conductsKind);
    }
    /* A PROTON HAS TWO DOORS when an uncoupler is on stage, and which one it
       takes is the whole of what an uncoupler does. Picked once per proton,
       so a stage with a leak splits its traffic instead of queueing all of
       it at the synthase. */
    function poreX(kind) {
      if (kind === 'H') {
        /* THE HOLE WINS, and that is what makes an uncoupler dangerous: it
           is always open, while the synthase has a rotor to wait for. The
           weight is a staging choice, declared here rather than emerging
           from a queue the sim does not model. */
        const doors = [];
        for (const q of PORES) if (q.kind === 'H') for (let i = 0; i < (q.door === 'leak' ? LEAK_PREFERENCE : 1); i++) doors.push(q);
        return doors.length ? doors[(Math.random() * doors.length) | 0].x : null;
      }
      const p = PORES.find(q => q.kind === kind); return p ? p.x : null;
    }
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
        : (kind === 'NA' || kind === 'K' || kind === 'CL' || kind === 'H') ? chargedIon(kind) : smallMolecule(kind);
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
      applyVis();
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
          /* The proton stays BARE. It is really H₃O⁺ and a shell would be
             honest, but it is drawn as the smallest thing on stage and six
             waters round it would make it the biggest. */
          shell: ion && kind !== 'A' && kind !== 'H' && P.shells,
          conducts: (kind === 'K' || kind === 'CL' || kind === 'NA' || kind === 'water' || kind === 'H') && poreX(kind) != null ? kind : undefined,
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
    /* mM → counts, water filling the side. A water figure given in mM is
       ignored: the headcount is the model's, not the page's. */
    function toCounts(side) {
      if (!side) return side;
      const out = {};
      let solute = 0;
      for (const k in side) if (k !== 'water') { out[k] = Math.max(0, Math.round(side[k] / P.mMPerParticle)); solute += out[k]; }
      out.water = Math.max(0, P.particlesPerSide - solute);
      return out;
    }
    function setContents(c) {
      if (P.units === 'mM' && c) c = { inside: toCounts(c.inside), outside: toCounts(c.outside) };
      P.contents = c;
      /* Where pH is measured FROM. Protons are conserved, so this stays the
         zero of the scale however far the gradient runs. */
      if (c && ((c.inside && c.inside.H) || (c.outside && c.outside.H)))
        protonRef = (((c.inside && c.inside.H) | 0) + ((c.outside && c.outside.H) | 0)) / 2;
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
      cpxCargo.length = 0;
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
          /* Water is drawn to its pore gently: an aquaporin's vestibule is
             not an electrostatic well, and pulled like an ion every water
             on stage queues at one door. */
          const k = FUNNEL_PULL * (t.seeks ? SEEK_PULL : t.kind === 'water' ? 0.35 : 1) * (1 - d / FUNNEL_R) * dt;
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
    /* A PROTON GOES ONE WAY THROUGH A DOOR: down the proton-motive force,
       outside to inside. chemiosmosis.js decides, off the headcount and the
       voltage together, so the synthase and the uncoupler obey the same rule
       and neither can run uphill. With the gradient gone it returns 0 and
       every door stops admitting. */
    const protonDir = () => CHEM.synthaseDirection(sideCount('H'), mV, { ref: protonRef, dir: pumpDir() });
    /* Off the headcount, not off state(): this is read every frame and
       state() walks every traveller to build its counts. */
    const pmfNow = () => CHEM.protonState(sideCount('H'), mV, protonRef, pumpDir()).pmf;
    const mayEnter = t => t.seeks ? true
      : t.kind === 'water' ? Math.sign(t.y) === crowdedSide('water')   // osmosis: the crowded side sends, always
      : t.kind === 'H' ? (protonDir() === -pumpDir() && Math.sign(t.y) === pumpDir())
      : potentialOn() || Math.sign(t.y) === crowdedSide(t.kind);
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
    const crossed = { K:0, CL:0, NA:0, water:0, H:0 };
    /* The proton circuit. `protonRef` is the count each side started with, so
       pH is read as a departure from where the page set it rather than from
       whatever half the current total happens to be. */
    const ROT = CHEM.rotor();
    let protonRef = null, complexTurns = 0, protonsLeaked = 0, protonsThroughSynthase = 0;
    function nernst(kind) {
      const c = sideCount(kind), z = kind === 'CL' ? -1 : 1;
      return (61 / z) * Math.log10((c.outside + 0.5) / (c.inside + 0.5));
    }
    const equilibriumOf = kind => P.potential === 'nernst' ? nernst(kind) : (P.E[kind] != null ? P.E[kind] : P.E.K);
    /* Signed, never clamped: negative means the voltage has overshot this
       ion's equilibrium and drives it back — the Goldman result, emerging. */
    /* Positive means the CATION LEAVES (Cl⁻ flips it where it is used).
       Normalised by |E|, not −E: K⁺'s equilibrium is negative and Na⁺'s is
       positive, and dividing by −E sent sodium out of the cell down a
       gradient that runs in. */
    /* H is excluded: its direction is the pmf, not an E from the table,
       and equilibriumOf would have fallen back to E.K and driven it. */
    const drive = kind => { if (!potentialOn() || kind === 'water' || kind === 'H') return 0;
      const E = equilibriumOf(kind); return (mV - E) / Math.max(1, Math.abs(E)); };
    function netPush() {
      let nK = 0, nCl = 0;
      for (const t of travellers) { if (t.conducts == null) continue; if (t.kind === 'K') nK++; else if (t.kind === 'CL') nCl++; }
      const n = nK + nCl;
      return n ? (drive('K') * nK + drive('CL') * nCl) / n : 0;
    }
    /* How negative the inside is allowed to get. The plasma membrane's floor
       is its own ion equilibria; an organelle's is the inner membrane's
       measured Δψ, which is far past any of them. */
    const floorMV = () => P.mvFloor != null ? P.mvFloor
      : P.context !== 'plasma' ? CHEM.DPSI_FLOOR : Math.min(P.E.K, P.E.CL);
    /* WHICH HALF THE COMPLEX FILLS, +1 top and −1 bottom, and everything with
       a direction in it reads this rather than assuming. */
    const pumpDir = () => CHEM.pumpDir(P.context);
    /* mV is the inside relative to the outside, so filling the top drives it
       negative and filling the bottom drives it positive. The clamp has to
       turn with that, or a thylakoid's voltage sits pinned at zero by a floor
       written for a cell membrane. */
    const clampMV = v => { const f = floorMV();
      return pumpDir() > 0 ? Math.min(0, Math.max(f, v)) : Math.max(0, Math.min(-f, v)); };

    /* ---- conduction is a HOP, not a conveyor: knock-on, dwell then hop ---- */
    const HOP = { wait:[0.10, 0.30], move:0.10, crowd:0.06 };
    function tickQueue(t, dt) {
      if (Math.abs(t.y) > T.height) {
        if (t.inPore) {
          const q = t.kind === 'water' ? 0 : (t.kind === 'CL' ? -1 : 1) * Math.sign(t.y);
          chargeOut += q; crossed[t.kind] = (crossed[t.kind] || 0) + Math.sign(t.y);
          /* ONE PROTON, ONE NOTCH. The rotor's angle and the ATP count both
             come out of the same pass(), so the picture cannot get ahead of
             the number. A proton down the uncoupler's hole turns nothing. */
          if (t.kind === 'H' && Math.sign(t.y) === -pumpDir()) {   // only one that came home counts
            if (synthX != null && t.lane === synthX) { protonsThroughSynthase++; if (ROT.pass(1)) emit('atp', ROT.atp); }
            else protonsLeaked++;
          }
          if (q) mV = clampMV(P.mvPerIon * chargeOut);
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
        /* A PROTON'S DIRECTION WAS DECIDED AT THE DOOR, by the pmf, and it
           does not get re-rolled every hop. Left in the coin-flip branch it
           took drive('H') = 0, went either way with equal odds, and half of
           them came back out the side they entered: thirty passes for eight
           protons moved, and a rotor turning on traffic that never crossed. */
        if (!potentialOn() || t.kind === 'water' || t.kind === 'H') h.dir = Math.sign(t.vy);
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
      /* Kept out of every pore but its own: a water with an aquaporin to
         use is steered to it by the funnel and must not be shoved off. */
      const others = t.conducts == null ? PORES : PORES.filter(Q => Q.x !== t.conducts);
      if (t.keepout && others.length && others.reduce((m, Q) => Math.min(m, Math.abs(t.x - Q.x)), Infinity) < t.keepout) {
        let near = others[0].x;
        for (const Q of others) if (Math.abs(t.x - Q.x) < Math.abs(t.x - near)) near = Q.x;
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

    /* ---- the complex: a carrier with one cargo and no ATP ----
       Driven exactly as the pump is, off a phase table in chemiosmosis.js:
       the gates come from the cycle, so the picture cannot disagree with it,
       and the two beats where it comes back EMPTY are drawn rather than cut.
       Two differences from the pump, and they are the lesson. It spends no
       ATP, it spends FUEL, so its rate is the page's slider and it stops
       when the fuel does. And it never comes back with a proton, or there is
       no gradient to build. */
    let cpxT = 0, cpxPhase = '';
    const cpxCargo = [];              // the protons riding, one per cargo seat
    const cpxGates = { top: NaN, bottom: NaN };
    /* A turn already begun finishes. The energy for it was spent at the
       occlusion, and a machine frozen mid-carry strands a proton inside the
       protein where nothing can reach it. */
    const CPX_COAST = 0.35;
    function setCpxGates(top, bottom) {
      if (top === cpxGates.top && bottom === cpxGates.bottom) return;
      COMPLEX.setGates(top, bottom); cpxGates.top = top; cpxGates.bottom = bottom;
    }
    /* ALL OR NOTHING, the pump's rule: a partly loaded machine turns with an
       empty seat, and the seat is where a student is counting. */
    function recruitProtons(n) {
      const from = -pumpDir();          // it loads at the mouth it is NOT filling
      const pool = travellers.filter(t => t.kind === 'H' && !t.aboard && t.lane == null && Math.sign(t.y) === from)
        .sort((a, b) => ((a.x - complexX) ** 2 + a.y * a.y) - ((b.x - complexX) ** 2 + b.y * b.y));
      if (pool.length < n) return false;
      for (const t of pool.slice(0, n)) { t.aboard = true; cpxCargo.push(t); }
      return true;
    }
    function releaseProtons(to) {
      for (const t of cpxCargo) {
        t.aboard = false;
        t.y = to * COMPLEX.height * 1.15; t.x = complexX + rnd(-16, 16); t.z = rnd(-8, 8);
        t.obj.position.set(t.x, t.y, t.z);
        t.lane = null; t.bounded = true;
        repick(t); t.vy = Math.abs(t.vy) * to;
        t.exitPt = { x:t.x, y:t.y, z:t.z };
      }
      cpxCargo.length = 0;
    }
    function runComplex(dt) {
      if (!P.proteins.complex) return null;
      const fuelled = CHEM.complexRate(P.fuel, P.fuelRate, pmfNow());
      const rate = fuelled > 0 ? fuelled : cpxCargo.length ? CPX_COAST : 0;
      if (rate > 0) cpxT = (cpxT + dt * rate / Math.max(0.1, P.complexSeconds)) % 1;
      let st = CHEM.Complex.at(cpxT);
      /* NOTHING TO CARRY: hold at the moment of binding rather than turning
         an empty machine. The matrix runs low on protons at a high pmf, and
         a complex miming a turn with nothing in it is a lie the student can
         see. */
      if (st.phase === 'load-H' && !cpxCargo.length) {
        if (!recruitProtons(CHEM.Complex.PROTONS_PER_CYCLE)) { cpxT = CHEM.Complex.startOf('load-H'); st = CHEM.Complex.at(cpxT); }
      }
      if (st.phase !== cpxPhase) {
        /* The proton is set down at the START of the empty half, so the two
           beats that follow are visibly carrying nothing. */
        if (st.phase === 'shut-out') {
          const n = cpxCargo.length, d = pumpDir();
          complexTurns += n; crossed.H += d * n; chargeOut += d * n;
          mV = clampMV(P.mvPerIon * chargeOut);
          releaseProtons(d); emit('pumped', complexTurns);
        }
        cpxPhase = st.phase;
      }
      /* MIRRORED WHEN IT PUMPS DOWN. The phase table's `u` runs −1 at the
         loading mouth to +1 at the far one, so multiplying by the direction
         puts the loading mouth at the bottom in a mitochondrion and at the top
         in a thylakoid, and the two gates swap with it. */
      const d = pumpDir();
      setCpxGates(d > 0 ? st.gates.top : st.gates.bottom, d > 0 ? st.gates.bottom : st.gates.top);
      for (let i = 0; i < st.cargo.length; i++) {
        const t = cpxCargo[i];
        if (!t) continue;
        const ty = st.cargo[i].u * d * COMPLEX.height, tx = complexX + (i - (st.cargo.length - 1) / 2) * 5.5;
        t.x += (tx - t.x) * 0.18; t.z += (0 - t.z) * 0.18; t.y += (ty - t.y) * 0.18;
        t.obj.position.set(t.x, t.y, t.z);
      }
      return st;
    }

    /* ---- one frame, in one order ----
       advance → keepClear → keepOutOfPores → shells → sweep. Wall exclusion
       runs after keepClear because whatever moves a traveller last decides
       where it is. Osmosis crossings are counted always; a page that does
       not care ignores them. */
    let crossings = { up:0, down:0 }, netRecent = 0, cpxState = null;
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
      cpxState = runComplex(dt);
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
      ROTOR.rotation.y += (ROT.angle - ROTOR.rotation.y) * Math.min(1, dt * 6);
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
      /* Read back in mM off the counts, whichever way they were set. */
      const concentration = {};
      for (const k in counts) if (k !== 'water') concentration[k] = { inside: counts[k].inside * P.mMPerParticle, outside: counts[k].outside * P.mMPerParticle };
      const w = counts.water || { inside: 0, outside: 0 };
      const nW = w.inside + w.outside;
      const diff = w.inside - w.outside;
      const net = Math.abs(diff) <= Math.max(2, 0.08 * nW) ? 'balanced' : diff > 0 ? 'leaving' : 'entering';
      const h = counts.H || { inside:0, outside:0 };
      const proton = CHEM.protonState(h, mV, protonRef, pumpDir());
      return { t:elapsed, counts, concentration, mMPerParticle: P.mMPerParticle, mV, chargeOut, crossed:Object.assign({}, crossed), layers: layers(),
        context: P.context,
        /* `pumpedInto` saves a page working out which half that is from the
           direction — the one thing about a context a caption most wants and
           most easily gets backwards. */
        sides: { inside: CHEM.sideName(P.context, 'inside'), outside: CHEM.sideName(P.context, 'outside'),
                 pumpedInto: CHEM.sideName(P.context, pumpDir() > 0 ? 'outside' : 'inside') },
        pH: proton.pH, dpH: proton.dpH, pmf: proton.pmf,
        atpMade: ROT.atp, rotorTurns: ROT.protons / CHEM.PROTONS_PER_TURN,
        protonsThroughSynthase, protonsLeaked, complexTurns,
        fuel: P.fuel, fuelRate: CHEM.complexRate(P.fuel, P.fuelRate, proton.pmf), pmfStall: CHEM.PMF_STALL,
        complexPhase: cpxState ? cpxState.phase : null, complexLabel: cpxState ? cpxState.label : null,
        complexCaption: cpxState ? cpxState.caption : null, complexT: cpxT,
        complexStoichiometry: CHEM.Complex.PROTONS_PER_CYCLE,
        stoichiometry: { protonsPerTurn: CHEM.PROTONS_PER_TURN, atpPerTurn: CHEM.ATP_PER_TURN, protonsPerATP: CHEM.PROTONS_PER_ATP },
        crossings:Object.assign({}, crossings), netRecent, net, netPush:netPush(),
        atpSpent, pumpRunning:running, pumpPhase:phase, pumpT,
        equilibrium: { K:equilibriumOf('K'), CL:equilibriumOf('CL') } };
    }
    function reset() {
      mV = 0; chargeOut = 0; crossed.K = crossed.CL = crossed.NA = crossed.water = crossed.H = 0;
      ROT.reset(); complexTurns = 0; protonsLeaked = 0; protonsThroughSynthase = 0;
      for (const t of cpxCargo) t.aboard = false;
      cpxCargo.length = 0; cpxT = 0; cpxPhase = ''; cpxState = null;
      crossings = { up:0, down:0 }; netRecent = 0;
      pumpT = 0; running = false; atpSpent = 0; lastPhase = '';
      for (const t of travellers) t.aboard = false;
      cargo.NA.length = 0; cargo.K.length = 0;
    }
    function set(next) {
      if (next.context != null && next.context !== P.context) {
        if (!CHEM.CONTEXTS[next.context]) console.warn('membrane.js: no context named ' + next.context + '; have ' + Object.keys(CHEM.CONTEXTS).join(', '));
        else { P.context = next.context; applyContext(); layout(P.proteins); }   // the lipid colour is baked into the sheet
      }
      if (next.proteins) layout(next.proteins);
      if (next.shells != null) setShells(next.shells);
      if (next.cut != null) setCut(next.cut);
      for (const k of Object.keys(next)) if (!(k in { proteins:1, shells:1, cut:1, contents:1 })) P[k] = next[k];   // units before contents, so a set carrying both reads right
      if (next.E) P.E = Object.assign({}, DEFAULTS.E, next.E);
      if (next.contents !== undefined) setContents(next.contents);
    }
    function on(ev, fn) {
      (listeners[ev] || (listeners[ev] = [])).push(fn);
      return () => { const i = listeners[ev].indexOf(fn); if (i >= 0) listeners[ev].splice(i, 1); };
    }

    /* ---- what can be shown or hidden, by name ----
       Hiding is visibility only: a hidden water still crosses and still
       counts, so a readout stays true with the crowd out of the way. */
    const eachOf = (kinds, fn) => { for (const t of travellers) if (kinds.includes(t.kind)) fn(t); };
    const vis = { water: true, ions: true, badges: true };
    const applyVis = () => {
      eachOf(['water', 'o2', 'co2'], t => { t.obj.visible = vis.water; });
      eachOf(['NA', 'K', 'CL', 'A'], t => { t.obj.visible = vis.ions; if (t.obj.userData.badge) t.obj.userData.badge.visible = vis.badges; });
    };
    const LAYERS = {
      water:    { label: 'water',            get: () => vis.water,  set: v => { vis.water = v; applyVis(); } },
      ions:     { label: 'ions',             get: () => vis.ions,   set: v => { vis.ions = v; applyVis(); } },
      badges:   { label: 'charge signs',     get: () => vis.badges, set: v => { vis.badges = v; applyVis(); } },
      shells:   { label: 'hydration shells', get: () => P.shells,   set: v => setShells(v) },
      cut:      { label: 'proteins cut open',get: () => cut,        set: v => setCut(v) },
      membrane: { label: 'the bilayer',      get: () => MEM.group.visible, set: v => { MEM.group.visible = v; } },
    };
    const layers = () => Object.keys(LAYERS).map(k => ({ name: k, label: LAYERS[k].label, on: !!LAYERS[k].get() }));
    function show(name, on = true) {
      const L = LAYERS[name];
      if (!L) { console.warn('membrane.js: no layer named ' + name + '; have ' + Object.keys(LAYERS).join(', ')); return; }
      L.set(!!on);
    }
    /* What the colours mean, for a legend a page did not have to write.
       ONLY WHAT IS ON STAGE. A fixed list is worse than no list: a generated
       photosynthesis page printed "K⁺ channel · Cl⁻ channel · Na⁺ leak
       channel · aquaporin" beside a thylakoid holding none of them, because
       it called palette() and believed the answer. A legend naming absent
       machines is a page confidently mislabelling itself. Travellers come
       off the current headcount, proteins off the current layout. */
    const hex = n => '#' + n.toString(16).padStart(6, '0');
    const TRAVELLER_KEY = {
      water: () => ({ name: 'water', color: hex(global.MolLib.PALETTE.atoms.O) }),
      o2:    () => ({ name: 'O₂', color: hex(global.MolLib.PALETTE.atoms.O) }),
      co2:   () => ({ name: 'CO₂', color: hex(global.MolLib.PALETTE.atoms.C) }),
      NA:    () => ({ name: 'Na⁺', color: hex(global.Parts.ION.NA.color) }),
      K:     () => ({ name: 'K⁺',  color: hex(global.Parts.ION.K.color) }),
      CL:    () => ({ name: 'Cl⁻', color: hex(global.Parts.ION.CL.color) }),
      H:     () => ({ name: 'H⁺',  color: hex(global.Parts.ION.H.color) }),
      A:     () => ({ name: 'anion that cannot leave', color: '#8f7fae' }),
    };
    const PROTEIN_KEY = {
      K:        { name: 'K⁺ channel', color: '#5b9bd5' },
      CL:       { name: 'Cl⁻ channel', color: '#b58a4f' },
      NA:       { name: 'Na⁺ leak channel', color: '#9b6fd8' },
      AQP:      { name: 'aquaporin', color: '#3fa7a0' },
      pump:     { name: 'Na⁺/K⁺ pump', color: '#4f9e78' },
      complex:  { name: 'the complex that pumps H⁺', color: '#4d5fa6' },
      synthase: { name: 'ATP synthase', color: '#d9a13b' },
      leak:     { name: 'uncoupler (a hole for H⁺)', color: '#8e939b' },
    };
    /* WHAT A MACHINE CARRIES is knowable from the layout alone, and that
       matters because card-stage builds its legend at mount, before a page
       has called set({contents}). Without this a bench that populates on its
       first step drew a legend of proteins and nothing to put through them. */
    const PROTEIN_CARRIES = { K:['K'], CL:['CL'], NA:['NA'], AQP:['water'],
                              pump:['NA','K'], complex:['H'], synthase:['H'], leak:['H'] };
    function palette() {
      const out = [], seen = new Set();
      const take = kind => {
        if (seen.has(kind) || !TRAVELLER_KEY[kind]) return;
        seen.add(kind); out.push(TRAVELLER_KEY[kind]());
      };
      for (const t of travellers) take(t.kind);
      for (const side of ['inside', 'outside'])
        if (P.contents && P.contents[side]) for (const k of Object.keys(P.contents[side])) take(k);
      for (const k of Object.keys(PROTEIN_KEY)) if (P.proteins[k]) for (const kind of PROTEIN_CARRIES[k]) take(kind);
      for (const k of Object.keys(PROTEIN_KEY)) if (P.proteins[k]) out.push(PROTEIN_KEY[k]);
      return out;
    }

    /* ---- the parts a page can point at, by name (Notebook, in lib/annotate.js) ----
       Live functions: a pore moves with the layout, an ion with itself. The
       words are the lesson's own callouts, so a generated page answers in
       the library's voice. */
    const _a = new THREE.Vector3();
    const firstOf = kind => { const t = travellers.find(t => t.kind === kind && !t.aboard); return t ? t.obj.getWorldPosition(_a) : null; };
    const anchors = {
      'channel.K':  () => { const x = poreX('K');  return x == null ? null : _a.set(x, T.height * 0.95, 0); },
      'channel.CL': () => { const x = poreX('CL'); return x == null ? null : _a.set(x, T.height * 0.95, 0); },
      'channel.NA': () => { const x = poreX('NA'); return x == null ? null : _a.set(x, T.height * 0.95, 0); },
      aquaporin:    () => { const x = poreX('water'); return x == null ? null : _a.set(x, T.height * 0.95, 0); },
      pump:    () => P.proteins.pump ? _a.set(pumpX, T.height * 0.98, 0) : null,
      complex:  () => P.proteins.complex  ? _a.set(complexX, COMPLEX.height * 0.98, 0) : null,
      /* On the rotor, which moves with the context. */
      synthase: () => synthX == null ? null : _a.set(synthX, -CHEM.pumpDir(P.context) * SYNTH.height * 1.15, 0),
      leak:     () => P.proteins.leak ? _a.set(P.proteins.leak.x, LEAK.height * 0.98, 0) : null,
      H: () => firstOf('H'),
      heads:   () => _a.set(150, HALF, 0),        // right of the proteins: a shell's panel covers the left
      tails:   () => _a.set(150, 0, 0),
      outside: () => _a.set(-SPREAD() * 0.06, farY() * 0.34, 0),
      inside:  () => _a.set(-SPREAD() * 0.06, -farY() * 0.34, 0),
      water: () => firstOf('water'), NA: () => firstOf('NA'), K: () => firstOf('K'), CL: () => firstOf('CL'), A: () => firstOf('A'),
    };
    const library = {
      'channel.K':  { text: 'K⁺ channel', offset: [-40, -30],
        card: 'A water-lined pore straight through, so a K⁺ crosses without ever touching the oil. It is open, it is free, and nothing about it is switched on.' },
      'channel.CL': { text: 'Cl⁻ channel', offset: [40, -30],
        card: 'Chloride is high outside, so it runs inward, the opposite way to the K⁺ beside it. Direction is set by the gradient, never by the protein.' },
      'channel.NA': { text: 'Na⁺ leak channel', offset: [40, -30],
        card: 'Sodium is high outside, so it leaks in whenever a door is open. This is the door, and every ion through it is one the pump has to throw back out.' },
      aquaporin: { text: 'aquaporin', offset: [40, -30],
        card: 'A pore for water and nothing charged, in single file. Water still crosses the lipid on its own, slowly; this is why some cells move it fast.' },
      pump: { text: 'a carrier, not a pore', offset: [42, -30],
        card: 'It binds its cargo and changes shape, so it is never open to both sides at once. One ATP buys one turn: 3 Na⁺ out and 2 K⁺ in, both uphill.' },
      heads: { text: 'hydrophilic heads', offset: [34, -30],
        card: 'The head carries charge and sits happily in water, so it turns outward on both faces. That is why a bilayer assembles itself and then holds together.' },
      tails: { text: 'hydrophobic tails', offset: [34, 26],
        card: 'The tails are hydrocarbon and will not mix with water, so they hide in the middle. Everything crossing this membrane has to get through that oil.' },
      outside: { text: 'outside the cell', offset: [-38, -26],
        card: 'Every solute particle sits where a water would have been, so fewer of the molecules here are water. More solute, less free water.' },
      inside:  { text: 'inside the cell', offset: [-38, 26],
        card: 'The cytosol: mostly water, potassium, and the big anions that never leave. What is dissolved here is what the pump spends ATP to keep.' },
      water: { text: 'water', card: 'Small and uncharged enough to slip through the oil, slowly, in both directions. The net flow is a headcount, not a pull.' },
      NA: { text: 'Na⁺, with its water', offset: [34, -26],
        card: 'Smaller than K⁺, and it still cannot use the K⁺ filter: it holds its water too tightly to trade the shell for the pore.' },
      K:  { text: 'K⁺', card: 'High inside, so it leaks out through its channel, and the pump carries it back. That standing cost is what a cell at rest is.' },
      CL: { text: 'Cl⁻', card: 'High outside, so it runs inward through its own channel, undressing only partly to fit.' },
      A:  { text: 'anion that cannot leave', offset: [34, 26],
        card: 'Protein side chains, phosphates and nucleic acids. They are why the inside is negative, and why it holds so much K⁺ without being positive.' },
      complex: { text: 'pumps H⁺, burns fuel', offset: [-44, -30],
        card: 'It carries protons one way only, and it pays with the fuel rather than with ATP. Turn the fuel off and it stops, which is the whole reason the gradient is a store and not a fixture.' },
      synthase: { text: 'ATP synthase', offset: [42, 30],
        card: 'A turbine, not a pump. Protons come back down the gradient through it and the rotor turns; every third of a turn makes one ATP. It cannot run uphill, so with no gradient it simply stops.' },
      leak: { text: 'an uncoupler', offset: [42, -30],
        card: 'A hole for protons. They come home without passing the synthase, so the gradient collapses and no ATP is made. The fuel still burns, and all of it comes out as heat.' },
      H:  { text: 'H⁺', card: 'A bare proton. It cannot cross the oil on its own, so every one of them goes through a protein, and which protein decides whether the energy becomes ATP.' },
    };
    /* The two compartments are named by the CONTEXT, so a card cannot say
       "inside the cell" about a matrix. Rewritten in place: the notebook
       holds this object. */
    function applyContext() {
      const inside = CHEM.sideName(P.context, 'inside'), outside = CHEM.sideName(P.context, 'outside');
      library.inside.text = inside; library.outside.text = outside;
      if (P.context === 'mitochondrion') {
        library.outside.card = 'The intermembrane space. Every proton the complexes throw out lands here, so this side goes acidic and positive: that is where the energy from NADH now sits.';
        library.inside.card  = 'The matrix. The Krebs cycle runs here and hands its NADH to the complexes in this membrane. Protons leave from this side and come back through the synthase.';
      } else if (P.context === 'thylakoid') {
        library.outside.card = 'The stroma, around the outside of the thylakoid disc. ATP is made here, and it is what the Calvin cycle spends to fix carbon. Protons leave from this side and come back through the synthase.';
        library.inside.card  = 'The lumen, the space enclosed by the disc. Light drives protons in here, so this is the acidic side: the energy from the photons is now a gradient across this membrane.';
      }
    }

    applyContext();
    layout(P.proteins);
    setShells(P.shells);
    if (P.contents) setContents(P.contents);

    return { step, state, reset, set, on, spend, anchors, library, layers, show, palette,
      add, scatter, remove, clear, travellers,
      params: () => P, pores: () => PORES.slice(),
      get height() { return T.height; },
      half: HALF, SPEED: { WALK:WALK_SPEED, ION:ION_SPEED }, KEEPOUT: CHANNEL_KEEPOUT,
      proteins: { K:CHANNEL, CL:CLCHAN, pump:PUMP, complex:COMPLEX, synthase:SYNTH, leak:LEAK },
      get membrane() { return MEM; } };
  }

  /* ---- which half is which ----
     Two labels down the stage's RIGHT edge, one in the middle of each
     compartment, naming them the way the context does. Right rather than
     membrane-lab's left because a lesson shell puts its step card over the
     left of the stage and would bury them. Mid-compartment rather than
     membrane-lab's top and bottom edges because the same shell keeps its own
     chrome in the corners — the progress dots and "drag to rotate" both sat
     on top of these when they were pinned there. It is the better place
     anyway: the label names a half of the screen, so it belongs in the
     middle of that half. Text-shadowed, membrane-lab's own trick, so they
     stay readable over whatever drifts behind them.

     They are DOM, not a mesh: they name a half of the screen rather than a
     thing in the scene, so they must not move with the camera. */
  let sideCss = false;
  function sideLabels(el, sim) {
    if (!sideCss) {
      sideCss = true;
      const st = document.createElement('style');
      st.textContent = `
.mem-side { position:absolute; right:16px; z-index:3; pointer-events:none;
  font-family:var(--font-display, inherit); font-size:var(--cap-sm, 11px);
  font-weight:var(--cap-weight, 600); letter-spacing:var(--cap-track, .12em);
  text-transform:uppercase; opacity:.6; white-space:nowrap;
  text-shadow:0 1px 10px rgba(255,255,255,.85); }
.mem-side.out { top:24%; }
.mem-side.in  { bottom:24%; }`;
      document.head.appendChild(st);
    }
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    const mk = cls => { const d = document.createElement('div'); d.className = 'mem-side ' + cls; el.appendChild(d); return d; };
    const out = mk('out'), inn = mk('in');
    const paint = () => {
      const s = sim.state();
      if (out.textContent !== s.sides.outside) out.textContent = s.sides.outside;
      if (inn.textContent !== s.sides.inside) inn.textContent = s.sides.inside;
    };
    paint();
    return { paint, destroy() { out.remove(); inn.remove(); } };
  }

  /* ---- one box ----
     The compartments' extent is solved off the camera, so a molecule never
     blinks into existence in view. Like watersim-mount.js, this adds no
     physics: `m.sim` and `m.box` are the layers under it. */
  function mount(el, params = {}) {
    if (!global.CardStage) throw new Error('membrane.js: load kit/card-stage.js first');
    let sim = null, nb = null;
    const box = global.CardStage.create({
      mount: el,
      cam: params.cam || { theta:0, phi:Math.PI / 2 - 0.10, r:300 },
      stage: Object.assign({ orbit:false, rMin:50, rMax:600 }, params.stage || {}),
      step: dt => { if (sim) last = sim.step(dt * (sim.params().timeScale || 1)); },
      afterFrame: () => { if (nb) nb.step(); },
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
    const sides = params.sideLabels === false ? null : sideLabels(el, sim);
    if (params.cut != null) sim.set({ cut: params.cut }); else sim.set({ cut: true });
    nb = global.Notebook ? global.Notebook.create({ box, anchors: sim.anchors, library: sim.library }) : null;
    return {
      sim, box,
      note: (n, o) => nb && nb.note(n, o), notes: n => nb && nb.notes(n), clearNotes: () => nb && nb.clear(),
      anchors: () => nb ? nb.list() : [],
      layers: sim.layers, show: (n, on) => { sim.show(n, on); if (!box.running) box.draw(); return this; }, palette: sim.palette,
      /* What the panel offers first: the proteins standing in the sheet and
         the two compartments; the switches a student reaches for. */
      set(next) { sim.set(next); if (sides) sides.paint(); return this; },
      state: () => last || sim.state(),
      /* The handle carries them so graph.js can resolve a signal by name off
         the thing it is following, without knowing it is a membrane. */
      signals: () => SIGNALS,
      on: sim.on, spend: sim.spend,
      add: sim.add, scatter: sim.scatter, clear: sim.clear, reset: sim.reset,
      start: box.start, stop: box.stop, pump: box.pump,
      destroy() { if (sides) sides.destroy(); box.destroy(); },
    };
  }

  /* ---- SIGNALS: what is worth plotting, and over what range -----------------
     A component knows what its own numbers MEAN and what range they live in;
     a page does not, and a generated page least of all. Two generated apps
     each typed their own y-maximum for the water count (90 in one, 80 in the
     other) and both clip silently the moment the particle count changes.
     Nothing can check a typed maximum, so the number is declared here instead
     and graph/graph.js reads it: `g.follow(m, 'water')` and no page types a
     range again.

     `pick` returns a number, or an object of side to number when `split` is
     set, in which case the graph draws one series per side and labels them
     with the CONTEXT's own names — matrix and intermembrane space in a
     mitochondrion, not "inside" and "outside".

     `domain` is a function of the first reading, evaluated once and then
     frozen: the total water is knowable from the sim and constant for a run,
     but a domain recomputed every frame would rescale the axis under the
     trace and turn a steady line into a wandering one. `cumulative` is the
     exception that may only grow. */
  const SIGNALS = {
    water: {
      label: 'Free water', unit: 'molecules', split: true,
      pick: s => sides(s.counts.water),
      domain: s => [0, total(s.counts.water)],
    },
    sodium: {
      label: 'Na\u207A', unit: 'ions', split: true,
      pick: s => sides(s.counts.NA),
      domain: s => [0, total(s.counts.NA)],
    },
    potassium: {
      label: 'K\u207A', unit: 'ions', split: true,
      pick: s => sides(s.counts.K),
      domain: s => [0, total(s.counts.K)],
    },
    protons: {
      label: 'H\u207A', unit: 'protons', split: true,
      pick: s => sides(s.counts.H),
      domain: s => [0, total(s.counts.H)],
    },
    /* The membrane potential is exaggerated (MV_PER_ION), so the range is the
       sim's, not a physiology textbook's. It is still signed, and the axis has
       to show the sign: a voltage plotted 0-up reads as a magnitude. */
    voltage: {
      label: 'Membrane potential', unit: 'mV',
      pick: s => s.mV,
      domain: () => [-100, 40],
    },
    /* Chemiosmosis. dpH and pmf are chemiosmosis.js's arithmetic, and their
       ranges are what that file can produce, not what a chloroplast does. */
    dpH: {
      label: 'pH difference across the membrane', unit: 'pH',
      pick: s => s.dpH,
      domain: () => [0, 1.6],
    },
    pmf: {
      label: 'Proton-motive force', unit: 'mV',
      pick: s => s.pmf,
      domain: () => [0, 250],
    },
    atp: {
      label: 'ATP made', unit: 'molecules', cumulative: true,
      pick: s => s.atpMade,
      domain: () => [0, 10],
    },
  };

  const total = c => c ? (c.inside || 0) + (c.outside || 0) : 0;
  const sides = c => ({ inside: (c && c.inside) || 0, outside: (c && c.outside) || 0 });

  global.Membrane = { create, mount, DEFAULTS, SIGNALS };
  /* Scale (kit/scale.js, docs/Scale.md). The sheet is angstroms at MolLib.SCALE
     display units each. Everything CROSSING is then enlarged by DEFAULTS.exag,
     so only the comparison against the membrane is exaggerated; that is the one
     entry in exag, and it is the number the header has always declared. */
  global.Membrane.SCALE = {
    rung: 'membrane', form: 'bulk',
    unit: 1e-10 / (global.MolLib && global.MolLib.SCALE || 1.9),
    exag: { crossing: DEFAULTS.exag },
    down: {},
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
