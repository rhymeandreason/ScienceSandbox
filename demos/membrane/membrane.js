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
 *  down and turns a rotor, three protons a third-turn and one ATP with it,
 *  and that ATP is drawn leaving the F1 head unless `showATP:false`, out the
 *  side `atpExit` names if a second box is going to spend it;
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
    proteins: { K:null, CL:null, NA:null, AQP:null, pump:null, complex:null, synthase:null, leak:null, translocase:null },
    /* CONTEXT renames the two sides and repaints the lipid. Nothing else:
       the code keeps +y outside and −y inside in every context, so the
       thylakoid pumping into its lumen and the mitochondrion pumping out of
       its matrix are the same direction here. chemiosmosis.js owns the
       names. */
    context: 'plasma',        // 'plasma' | 'mitochondrion' | 'thylakoid'
    fuel: null,               // 'NADH' | 'FADH2' | 'light' | null — null lets the gradient run down
    fuelRate: 1,              // 0..1, a supply dial or a light dimmer
    oxygen: true,             // false: the respiratory chain has no final electron acceptor and stops
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
    showATP: true,            // the synthase releases a drawn ATP per third-turn
    showFuel: true,           // a carrier arrives at the complex and leaves spent
    /* THE OUTER MEMBRANE IS A BACKDROP, not a second sim: a sheet with porins
       in it, drawn above the inner one so the intermembrane space is a space
       with a lid. Nothing crosses it but the ATP. Mitochondrion only — a
       thylakoid's second membrane is the chloroplast envelope, which is not
       this picture, and a plasma membrane has none. */
    outerMembrane: false,
    atpExit: null,            // 'left' | 'right': it leaves that way, toward the box that spends it
    /* WHERE THE ATP IS GOING, as a function returning a WORLD point — the
       pump in another sim sharing this scene. Takes precedence over atpExit,
       and the token fades on arrival rather than at the edge; 'atpDelivered'
       fires when it lands, which is the moment something may spend it. */
    atpTo: null,
    /* HOW FAR THE TWO COMPARTMENTS RUN from this membrane, in world units:
       {up, down}, either omitted for "as far as the frame". A scene stacking
       several membranes gives each sim its own slice, so one sim's solution
       stops where the next sim's membrane begins instead of the two
       interleaving in the same space. The outer membrane is a cap of its own
       and the tighter of the two wins. */
    bounds: null,
    pumpAuto: false,
    pumpOn: true,
    turnSeconds: 11,
    timeScale: 1,             // sim seconds per real second; 'speed it up' is one set()
    shells: false,
    lipidMotion: true,
    /* THE SHEET IS BOWED, and it is the only thing on stage that says which
       side is which before a label does. A cell's surface is convex outward,
       so the sheet rises to the middle and falls away at both edges, and the
       compartment on the outside of that curve is the outside. `curve` is
       the sagitta in A at |x| = CURVE_SPAN — how far the sheet has dropped
       by the edge of the frame. 0 is flat. Small on purpose: the arc has to
       be read as a hint, and a deep one tips the proteins at its edges far
       enough to look broken.

       ONE DIRECTION IN EVERY CONTEXT, and it is not a coincidence: −y is
       the ENCLOSED compartment in all three — the cytoplasm, the matrix,
       the lumen — so the convex face is +y every time. A new context has
       to put its enclosed side at −y like the rest, or this is wrong and
       so is `pumpTo`. What the context does flip is the proton direction,
       not the curve; the thylakoid pumps down, into the sac it wraps.
       (Cristae reverse the local curvature. This is the flat patch.) */
    curve: 9,
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
    /* Where the sagitta is measured — roughly the half-width a lesson frames,
       so `curve` is a number the reader can see rather than a radius. */
    const CURVE_SPAN = 150;
    const BOW = P.curve > 0 ? (CURVE_SPAN * CURVE_SPAN + P.curve * P.curve) / (2 * P.curve) : 0;
    /* THE PHYSICS STAYS FLAT. Every rule below is written on a straight
       membrane at y = 0 — sign(y) is the side, |y| < HALF is the core, a
       pore is at an x — and bending that frame would touch all of it. So
       the arc is a placement, applied to the object and never to t.y: the
       sim thinks flat, the stage is curved, and the two agree because the
       mapping preserves the distance to the midsurface. */
    const _bend = new THREE.Vector3();
    function seat(obj, x, y, z) {
      _bend.set(x, y, z || 0);
      const th = MEM ? MEM.bend(_bend) : 0;
      obj.position.copy(_bend);
      return th;
    }
    const SPREAD = () => P.spread == null ? MEM_REACH * 0.55 : P.spread;
    const listeners = {};
    const emit = (ev, ...a) => CardStage.fire(listeners[ev], a, 'Membrane ' + ev);

    /* The second sheet, rebuilt with the layout because its porin sits over
       the machine the ATP came from. Translated rather than re-bowed: the true
       outer arc has a bigger radius than the inner one, and at the sagitta a
       lesson actually draws the difference is under a lipid's width. */
    const _out = new THREE.Vector3();
    function buildOuter(tint) {
      if (OUTER) { root.remove(OUTER.group); OUTER = null; }
      PORIN.group.visible = outerOn();
      if (!outerOn()) { porinX = null; return; }
      /* OVER THE DOOR IT FEEDS, offset so the ATP's two crossings do not
         stack into one vertical line the reader takes for a single pore. */
      /* INBOARD of the door it feeds, not outboard: the layout below spreads
         the inner membrane's machines to PORE_GAP, so the rightmost one is
         already near the edge of frame and a porin past it falls off. */
      porinX = (antX != null ? antX : synthX != null ? synthX : 0) - 38;
      /* CONCENTRIC WITH THE INNER SHEET, not parallel to it: a bigger radius
         by exactly the gap, so the two circles share a centre and the
         intermembrane space is the same width all the way out. Translating a
         copy of the inner arc instead would have the space widen toward the
         edges, which on a bowed membrane is where the eye goes. */
      OUTER = global.Parts.membrane({ half:HALF * 0.62, reach:MEM_REACH, head:tint.head, tail:tint.tail,
        bowR:BOW ? BOW + OUTER_GAP : 0,
        exclude:(x, z) => Math.hypot(x - porinX, z) - POR_HOLE });
      OUTER.group.position.y = outerY();
      root.add(OUTER.group);
      /* The porin rides the OUTER sheet's arc. seat() is the inner one's, and
         on a bowed pair that leaves the barrel hanging off its own membrane by
         the difference between two circles. */
      _out.set(porinX, 0, 0);
      const th = OUTER.bend(_out);
      PORIN.group.position.set(_out.x, _out.y + outerY(), 0);
      PORIN.group.rotation.z = -th;
      PORIN.setGates(1, 1);
      OUTER.cut.enable(cut);
    }

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
    const RESP = global.MolLib.PALETTE.respiration;
    const COMPLEX = global.Parts.transporter({ half:HALF, site:6.2, mouth:8.0, radius:CPX_R, lobes:3, lobeDepth:CPX_LOBE, color:RESP.complex });
    const SYN_R = 13.2, SYN_LOBE = 0.09, SYN_HOLE = SYN_R * (1 + SYN_LOBE) + 0.5;
    const SYNTH   = global.Parts.transporter({ half:HALF, site:6.0, mouth:8.2, radius:SYN_R, lobes:8, lobeDepth:SYN_LOBE, color:RESP.synthase });
    /* An UNCOUPLER's hole: dinitrophenol, or thermogenin in brown fat.
       Protons come back without touching the synthase, so the gradient
       collapses and no ATP is made. Grey: it is a hole, not a machine. */
    const LEAK_R = 11.0, LEAK_LOBE = 0.06, LEAK_HOLE = LEAK_R * (1 + LEAK_LOBE) + 0.5;
    const LEAK    = global.Parts.transporter({ half:HALF, site:6.0, mouth:7.6, radius:LEAK_R, lobes:0, color:RESP.leak });
    /* THE ADP/ATP TRANSLOCASE, and it is the answer to "how does the ATP get
       out". The F1 head hangs in the matrix, so the ATP is MADE in the matrix,
       and a charged nucleotide does not cross a bilayer. This carries it: one
       ATP out for one ADP in, a strict swap, which is why the matrix never
       runs out of substrate and why the count of ATP leaving is the count of
       ADP arriving. Drawn as a monomer — no lobes — because it is one, and
       because it must not read as a small member of the respiratory chain.

       NOT DRAWN: that the swap is ELECTROGENIC. It trades ATP⁴⁻ out for ADP³⁻
       in, so one negative charge leaves per turn and the membrane voltage
       drives it. The gradient pays twice, once to make the ATP and again to
       export it, and that costs about a quarter of the whole proton budget.
       The page says it; the sim does not model it, because a charge count
       here would move mV on a stage where mvPerIon is already a timing knob
       rather than a measurement. */
    const ANT_R = 10.0, ANT_LOBE = 0.08, ANT_HOLE = ANT_R * (1 + ANT_LOBE) + 0.5;
    const ANT = global.Parts.transporter({ half:HALF, site:5.4, mouth:7.0, radius:ANT_R,
                                           lobes:0, color:RESP.translocase });
    const ROTOR = buildRotor(SYNTH.height);
    SYNTH.group.add(ROTOR);
    /* Every machine on stage, and PORIN is one even though it stands in the
       other sheet: this list is what setCut opens, and a barrel left off it is
       the one solid object in a cutaway. */
    const ALL = [CHANNEL, CLCHAN, NACHAN, AQP, PUMP, COMPLEX, SYNTH, LEAK, ANT];
    root.add(CHANNEL.group, CLCHAN.group, NACHAN.group, AQP.group, PUMP.group,
             COMPLEX.group, SYNTH.group, LEAK.group, ANT.group);

    /* ---- the outer membrane, and the porin in it ----
       A SECOND SHEET AND NO SECOND PHYSICS. The intermembrane space needs a
       lid or it is just "above the membrane", and the ATP needs somewhere to
       arrive that is not already the cytosol. The porin (VDAC) is the reason
       the two are nearly the same solution: it passes anything small, so the
       space between the membranes is continuous with the cytosol and the ATP
       is home once it is through. Drawn as a wide barrel, in the leak's grey,
       because it is a hole and does not choose.

       OUTER_GAP is drawn, not measured: a real intermembrane space is much
       narrower than this against the protein it holds. It is this wide because
       the protons pumped into it have to be visible SITTING there — a band the
       eye reads as a compartment, not as a gap between two lines. Tuned at
       whole-membrane zoom against the F1 head, which is the tallest thing the
       space has to clear. */
    const OUTER_GAP = 82;
    /* SLIMMER AND SHORTER THAN A CARRIER, and both on purpose. transporter's
       default `over` is 14, which is most of the height of a machine that
       spans the thick inner membrane; on a sheet this thin it made the porin
       a silo standing two membranes proud of its own. And a hole does not
       need a body: the width here is the pore plus a wall, where a carrier's
       width is a mechanism wrapped around a site. */
    const POR_R = 6.6, POR_HOLE = 8.4;
    const PORIN = global.Parts.transporter({ half:HALF * 0.62, over:4.0, wall:2.2,
                                             site:4.9, mouth:5.4, radius:POR_R,
                                             lobes:0, color:RESP.porin });
    let OUTER = null, porinX = null, antX = null;
    const outerOn = () => !!P.outerMembrane && P.context === 'mitochondrion';
    /* Signed like everything else: the outer membrane is on the side the
       protons are pumped to, which is the side the ATP leaves by. */
    const outerY = () => CHEM.pumpDir(P.context) * OUTER_GAP;
    /* THE CEILING ON THE COMPARTMENT BELOW IT. Without this the protons the
       complex just pumped out drift straight through the outer sheet and the
       lid is a decoration. */
    const bandTop = () => Math.min(outerOn() ? OUTER_GAP - 8 : Infinity,
                                   P.bounds && P.bounds.up != null ? P.bounds.up : Infinity,
                                   P.extent);
    const bandBottom = () => Math.min(P.bounds && P.bounds.down != null ? P.bounds.down : Infinity,
                                      P.extent);
    root.add(PORIN.group);
    ALL.push(PORIN);   // declared below ALL, and setCut has to open it like any other
    let MEM = null, T = PUMP, PORES = [], pumpX = 0, complexX = 0, synthX = null, cut = false;

    /* The F1 head: a ring of three αβ pairs on a shaft. Three, because one
       ATP is made per third of a turn and a student should be able to count
       the beats against the lobes. It TURNS, and that is the only motion in
       the module driven by a count rather than by a clock. */
    function buildRotor(h) {
      const g = new THREE.Group();
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 9, 12), global.Parts.flat(RESP.stalk));
      shaft.userData.baseY = h + 4.5; g.add(shaft);
      for (let i = 0; i < 3; i++) {
        const lobe = new THREE.Mesh(new THREE.SphereGeometry(6.2, 18, 12), global.Parts.flat(RESP.synthase));
        lobe.scale.set(1, 1.25, 1);
        const th = (i / 3) * Math.PI * 2;
        lobe.position.set(Math.cos(th) * 7.4, 0, Math.sin(th) * 7.4);
        lobe.userData.baseY = h + 12.5;
        g.add(lobe);
      }
      return g;
    }
    /* ---- the ATP that comes out, and the way out ----
       The count was the only evidence: the rotor turned, a readout ticked,
       and nothing on stage said the gradient had bought anything. So one
       molecule leaves the head per third-turn, on the SAME pass() that
       increments the count, and a student can watch the beats instead of
       reading them.

       IT IS MADE IN THE MATRIX, which is where the F1 head hangs, and that is
       the whole reason this is a route and not a drift. A charged nucleotide
       cannot cross a bilayer, so the ATP goes matrix → translocase → inter-
       membrane space → porin → cytosol, and takes an ADP the other way
       through the translocase on the way. With neither door on stage it
       simply wanders off, which is a page not teaching export.

       DRAWN AS ITS PHOSPHATES, and nothing else. Real ATP at this stage's
       scale is thirty-one atoms about the size of a proton, which is a smudge,
       and an adenosine body drawn big enough to see turns the token into a
       lollipop whose biggest feature is the part the lesson never mentions.
       Beads in the palette's phosphorus orange — the colour glycolysis already
       taught as "something ATP paid for" — read as three at any size, and
       three against two is what tells ATP from the ADP passing it.

       THE THIRD BOND IS A CONDENSATION: ADP + Pi loses a water, the same
       reaction as a peptide or a glycosidic bond, so it is drawn in the same
       `condense` slate they are. It is also the one thing here that moves —
       the bead arrives oversize and snaps onto the chain — because the
       gradient spent on that bond is the whole lesson of the synthase. */
    const ATP_MAX = 8, ATP_SNAP = 0.35, ATP_SPEED = 52, ATP_FADE = 0.8;
    const atpChips = [];
    const R_BEAD = 2.2, BEAD_GAP = 5.0;
    function buildNucleotide(n) {
      const g = new THREE.Group();
      const PAL = global.MolLib.PALETTE;
      const x = i => (i - (n - 1) / 2) * BEAD_GAP;
      const beads = [];
      for (let i = 0; i < n; i++) {
        const b = new THREE.Mesh(new THREE.SphereGeometry(R_BEAD, 16, 12), global.Parts.flat(PAL.atoms.P));
        b.position.x = x(i); g.add(b); beads.push(b);
      }
      for (let i = 0; i < n - 1; i++) {
        const link = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, BEAD_GAP, 8),
          global.Parts.flat(i === n - 2 && n === 3 ? PAL.bonds.condense : PAL.bonds.covalent));
        link.rotation.z = Math.PI / 2; link.position.x = x(i) + BEAD_GAP / 2;
        g.add(link);
      }
      /* Named in the badge's own dress — ink on a white pill — so the word
         belongs to the same page as the + on every proton that paid for it. */
      const tag = kit.pill(n === 3 ? 'ATP' : 'ADP', 6.4);
      tag.position.set(0, R_BEAD + 5.2, 0);
      g.add(tag);
      g.userData = { newest: beads[n - 1], tag };
      return g;
    }
    /* The waypoints, in the sim's flat frame; seat() bends them onto the arc
       at draw time the way it does for a traveller. `out` is the leg after
       which the molecule has left the mitochondrion — the page's cue. */
    function atpRoute() {
      const d = CHEM.pumpDir(P.context);
      const legs = [];
      if (antX != null) {
        legs.push({ x:antX, y:-d * (HALF + 15) });          // across the matrix to the door
        legs.push({ x:antX, y: d * (HALF + 15), swap:true });  // through it, ADP the other way
      }
      if (outerOn()) {
        legs.push({ x:porinX, y: d * (OUTER_GAP - HALF * 0.62 - 7) });
        legs.push({ x:porinX, y: d * (OUTER_GAP + HALF * 0.62 + 9), out:true });
      }
      const last = legs.length ? legs[legs.length - 1] : null;
      /* SOMEWHERE TO GO beats a direction to drift in. atpTo answers in WORLD
         coordinates because what it points at belongs to another sim; the
         route is in this one's flat frame, so it is converted here, once, at
         release. Nothing on this stage moves afterwards. */
      if (P.atpTo) {
        const w = P.atpTo();
        if (w) {
          _atp.copy(w); root.worldToLocal(_atp);
          /* AND UNBENT, because a leg is flat: every waypoint here is in the
             sim's own straight frame and seat() puts it on the arc at draw
             time. A world point arrives already on the arc — or on nothing,
             being another membrane's — so bending it a second time would walk
             the ATP to a place that is not where it was sent. */
          if (BOW) {
            const th = Math.atan2(_atp.x, _atp.y + BOW), rad = Math.hypot(_atp.x, _atp.y + BOW);
            _atp.set(th * BOW, rad - BOW, 0);
          }
          legs.push({ x:_atp.x, y:_atp.y, fade:true, land:true, out:!legs.some(l => l.out) });
          return legs;
        }
      }
      const away = P.atpExit === 'left' ? -1 : P.atpExit === 'right' ? 1 : 0;
      legs.push({ x:(last ? last.x : (synthX || 0)) + (away || 1) * 90,
                  y:(last ? last.y : -d * (HALF + 26)) + (last ? d * 22 : -d * 14),
                  fade:true, out:!legs.some(l => l.out) });
      return legs;
    }
    const _atp = new THREE.Vector3();
    function releaseATP() {
      if (!P.showATP || !SYNTH.group.visible || atpChips.length >= ATP_MAX) return;
      const d = CHEM.pumpDir(P.context);
      const g = buildNucleotide(3);
      root.add(g);
      atpChips.push({ obj:g, t:0, phase:Math.random() * 6.28, fade:1,
                      x:(synthX || 0), y:-d * (SYNTH.height + 20), legs:atpRoute(), leg:0 });
    }
    /* The ADP that comes back the other way. Not a second molecule the sim
       tracks — it is the SAME event seen from the other side, so it is born
       where the ATP is leaving and walks the two legs in reverse. */
    function releaseADP(atX) {
      const d = CHEM.pumpDir(P.context);
      const g = buildNucleotide(2);
      root.add(g);
      atpChips.push({ obj:g, t:0, phase:Math.random() * 6.28, fade:1,
                      x:atX, y:d * (HALF + 15),
                      legs:[{ x:atX, y:-d * (HALF + 15) },
                            { x:atX - 44, y:-d * (HALF + 34), fade:true }], leg:0 });
    }
    function tickATP(dt) {
      for (let i = atpChips.length - 1; i >= 0; i--) {
        const c = atpChips[i];
        c.t += dt;
        const o = c.obj, leg = c.legs[c.leg];
        /* WALKED, not integrated: the route is the claim, and a velocity that
           merely points at a door arrives beside it half the time. */
        const dx = leg.x - c.x, dy = leg.y - c.y, dist = Math.hypot(dx, dy);
        const move = ATP_SPEED * dt;
        if (dist <= move) {
          c.x = leg.x; c.y = leg.y;
          /* ARRIVING IS AN EVENT, BEING THERE IS NOT. The last leg has nowhere
             to advance to, so this branch runs again every frame while the
             token fades: without the flag one ATP delivered itself a dozen
             times and the pump was handed a dozen reasons to turn. */
          if (!c.done) {
            c.done = true;
            if (leg.swap && antX != null) releaseADP(antX);
            if (leg.out && !c.left) { c.left = true; emit('atpOut', ROT.atp); }
            if (leg.land) emit('atpDelivered', ROT.atp);
            if (leg.fade) c.dying = true;
          }
          if (c.leg < c.legs.length - 1) { c.leg++; c.done = false; }
        } else { c.x += dx / dist * move; c.y += dy / dist * move; }
        seat(o, c.x, c.y, 0);
        /* A ROW READ EDGE-ON IS ONE DOT. The token stays in the screen plane
           and only leans, so the beads never collapse into each other. */
        o.rotation.z = Math.sin(c.t * 1.1 + c.phase) * 0.16;
        /* The new phosphate lands: oversize for a beat, then onto the chain. */
        const k = Math.min(1, c.t / ATP_SNAP);
        o.userData.newest.scale.setScalar(1 + 1.4 * (1 - k) * (1 - k));
        if (c.dying) {
          c.fade -= dt / ATP_FADE;
          o.traverse(m => { if (m.material) { m.material.transparent = true; m.material.opacity = Math.max(0, c.fade); } });
          if (c.fade <= 0) { kit.forget(o.userData.tag); root.remove(o); atpChips.splice(i, 1); }
        }
      }
    }
    function clearATP() {
      for (const c of atpChips) { kit.forget(c.obj.userData.tag); root.remove(c.obj); }
      atpChips.length = 0;
    }

    /* ---- the fuel, arriving and leaving ----
       THE POINT IS THAT IT STAYS ON ONE SIDE. NADH is made by the Krebs cycle
       in the matrix and hands its electrons to the chain in the matrix; it
       never crosses this membrane, and a reader told that in prose goes on
       picturing it going through. Drawn, the claim is unavoidable: the carrier
       comes up out of the matrix, docks on the complex's matrix face, and goes
       back down the way it came.

       AND IT IS NOT CONSUMED. It docks as NADH and leaves as NAD⁺ — the same
       molecule, so the same shape and the same colour, with only the name
       changed. That NAD⁺ going back is what lets the Krebs cycle turn again,
       which is the same fact as the ADP returning through the translocase.

       A DINUCLEOTIDE IS TWO NUCLEOTIDES, so it is drawn as two lobes on a
       bond — and deliberately not as ATP's row of three, because the two
       tokens on this stage must not read as the same kind of thing.

       Timed off the complex's own cycle: it arrives as the machine opens to
       load, and the swap happens on `occlude`, the beat whose caption is
       already "electrons from the fuel pass through". */
    const FUEL_SPEED = 34, FUEL_FADE = 0.9;
    let fuelChip = null;
    function buildCarrier(name) {
      const g = new THREE.Group();
      const c = global.MolLib.PALETTE.respiration.carrier;
      for (const [x, r] of [[-3.1, 3.6], [3.1, 3.0]]) {
        const lobe = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), global.Parts.flat(c));
        lobe.position.x = x; g.add(lobe);
      }
      const link = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 6.2, 8),
        global.Parts.flat(global.MolLib.PALETTE.bonds.covalent));
      link.rotation.z = Math.PI / 2; g.add(link);
      const tag = kit.pill(name, 6.4);
      tag.position.set(0, 8.0, 0);
      g.add(tag);
      g.userData.tag = tag;
      return g;
    }
    const fuelDock = () => {
      const d = pumpDir();
      return { x: complexX - 15, y: -d * (COMPLEX.height + 13) };
    };
    function fuelArrive() {
      if (!P.showFuel || !COMPLEX.group.visible || fuelChip) return;
      /* WHICHEVER FUEL IS ACTUALLY DRIVING IT — a one-shot from feed() counts,
         and is the only one when the continuous supply is off. */
      const f = pulseFuel || P.fuel;
      if (!CHEM.SPENT[f]) return;           // light: nothing arrives, and nothing should be drawn
      const d = pumpDir(), to = fuelDock();
      const g = buildCarrier(f === 'FADH2' ? 'FADH₂' : f);
      root.add(g);
      /* SHALLOW. The matrix is the band under the membrane and on a stage that
         also has to hold an outer membrane and a cell surface it is not a deep
         one — a carrier launched far enough down to make a journey of it makes
         the journey off the bottom of the frame. It comes up from just below
         the machine it feeds. */
      fuelChip = { obj:g, fuel:f, x: complexX - 34, y: -d * (COMPLEX.height + 30), to, fade:1, spent:false };
      seat(g, fuelChip.x, fuelChip.y, 0);
    }
    /* The electrons have gone. Rename in place — same body, same colour — and
       send it back into the matrix it came from. */
    function fuelSpend() {
      if (!fuelChip || fuelChip.spent) return;
      const c = fuelChip, d = pumpDir();
      kit.forget(c.obj.userData.tag);
      c.obj.remove(c.obj.userData.tag);
      const tag = kit.pill(CHEM.SPENT[c.fuel] || 'spent', 6.4);
      tag.position.set(0, 8.0, 0);
      c.obj.add(tag); c.obj.userData.tag = tag;
      c.spent = true;
      c.to = { x: complexX - 40, y: -d * (COMPLEX.height + 34) };
    }
    function tickFuel(dt) {
      const c = fuelChip;
      if (!c) return;
      const dx = c.to.x - c.x, dy = c.to.y - c.y, dist = Math.hypot(dx, dy);
      const move = FUEL_SPEED * dt;
      if (dist > move) { c.x += dx / dist * move; c.y += dy / dist * move; }
      else { c.x = c.to.x; c.y = c.to.y; }
      seat(c.obj, c.x, c.y, 0);
      if (c.spent && dist <= move) {
        c.fade -= dt / FUEL_FADE;
        c.obj.traverse(m => { if (m.material) { m.material.transparent = true; m.material.opacity = Math.max(0, c.fade); } });
        if (c.fade <= 0) clearFuel();
      }
    }
    /* ONE CARRIER, ONE TURN — the complex's answer to the pump's spend(), and
       independent of the supply switch for the same reason. `fuel` is the
       continuous supply, the Krebs cycle handing NADH over as fast as the
       chain can take it; this is a SINGLE one arriving, and a single one is
       exactly enough to drive one cycle. So it works with the supply off,
       which is what makes it a demonstration rather than a fast-forward: turn
       the supply off, send one, and watch the machine turn once and stop.

       It winds the complex back to the start of its loading beat and lets the
       cycle do the rest, rather than running the token on a timer of its own:
       a trigger with its own timing is a second answer to "when is the fuel
       spent", and the two would drift. */
    let pulseFuel = null;
    function feed(fuel) {
      if (!P.proteins.complex) return false;
      const f = fuel || P.fuel || (P.context === 'thylakoid' ? 'light' : 'NADH');
      if (!CHEM.FUELS[f]) { console.warn('membrane.js: no fuel named ' + f + '; have ' + Object.keys(CHEM.FUELS).join(', ')); return false; }
      if (!CHEM.complexRate(f, 1, 0, P.oxygen)) return false;   // no O₂: the NADH docks and nothing takes its electrons
      pulseFuel = f;
      clearFuel();
      cpxT = CHEM.Complex.startOf('load-H');
      cpxPhase = '';        // so the cycle's own transition fires on the next step
      return true;
    }
    function clearFuel() {
      if (!fuelChip) return;
      kit.forget(fuelChip.obj.userData.tag);
      root.remove(fuelChip.obj);
      fuelChip = null;
    }

    /* ---- oxygen, where the electrons end ----
       COMPLEX IV AT ITS REAL RATIO: O₂ + 4e⁻ + 4H⁺ → 2H₂O. A carrier brings
       two electrons, so ONE O₂ WAITS THROUGH TWO CARRIERS. It docks on the
       matrix face beside the carrier, takes two matrix protons on each
       carrier's `occlude` beat, and after the second pair leaves as two
       waters. One water per O₂, or one O₂ per NADH, is wrong by a factor of
       two in exactly the place a student counts.

       THE PROTONS THAT JOIN IT ARE DRAWN, NOT DEBITED. They are made for the
       picture and the matrix headcount keeps its own: the drawn pool is the
       gradient's whole budget, and emptying it here would stall the complex
       for a reason that is not biology. Protons used up in the matrix do add
       to the real gradient; this sim leaves that term out.

       Only a fuel whose acceptor is O₂ draws any of this (CHEM.ACCEPTOR), so a
       thylakoid shows none. */
    const O2_SPEED = 26, WATER_FADE = 1.2;
    const E_PER_O2 = 4, E_PER_CARRIER = 2;
    let o2 = null;
    const o2Riders = [], waters = [];
    const o2Dock = () => ({ x: complexX + 16, y: -pumpDir() * (COMPLEX.height + 12) });
    /* The pill goes on an UNSCALED wrapper: smallMolecule scales its group
       by K_(), and a tag inside it came out several times the NADH's. */
    function tagged(mol, name) {
      const g = new THREE.Group(), tag = kit.pill(name, 6.4);
      tag.position.set(0, 7.0, 0);
      g.add(mol, tag); g.userData.tag = tag;
      return g;
    }
    function dropToken(obj) {
      if (obj.userData.tag) kit.forget(obj.userData.tag);
      if (obj.userData.badge) kit.forget(obj.userData.badge);
      root.remove(obj);
    }
    const approach = (c, to, dt, speed) => {
      const dx = to.x - c.x, dy = to.y - c.y, dist = Math.hypot(dx, dy), move = speed * dt;
      if (dist > move) { c.x += dx / dist * move; c.y += dy / dist * move; }
      else { c.x = to.x; c.y = to.y; }
      seat(c.obj, c.x, c.y, 0);
      return dist <= move;
    };
    function o2Arrive() {
      if (!P.showFuel || o2 || P.oxygen === false || !COMPLEX.group.visible) return;
      if (CHEM.ACCEPTOR[pulseFuel || P.fuel] !== 'O2') return;
      const to = o2Dock();
      o2 = { obj: tagged(smallMolecule('o2'), 'O₂'), x: to.x + 22, y: -pumpDir() * (COMPLEX.height + 34), to, electrons: 0 };
      root.add(o2.obj); seat(o2.obj, o2.x, o2.y, 0);
    }
    function o2Reduce() {
      if (!o2 || o2.electrons >= E_PER_O2) return;
      o2.electrons += E_PER_CARRIER;
      for (let i = 0; i < E_PER_CARRIER; i++) {
        const r = { obj: chargedIon('H'), x: o2.to.x + (i ? 16 : -8), y: -pumpDir() * (COMPLEX.height + 38),
                    off: { x: (i ? 1 : -1) * 3.5, y: -pumpDir() * (o2.electrons === E_PER_O2 ? 4 : -1) } };
        root.add(r.obj); seat(r.obj, r.x, r.y, 0); o2Riders.push(r);
      }
    }
    function toWater() {
      const at = o2.to;
      dropToken(o2.obj); o2 = null;
      for (const r of o2Riders) dropToken(r.obj);
      o2Riders.length = 0;
      for (const s of [-1, 1]) {
        const w = { obj: tagged(smallMolecule('water'), 'H₂O'), x: at.x + s * 5, y: at.y,
                    to: { x: at.x + s * 18, y: -pumpDir() * (COMPLEX.height + 42) }, fade: 1 };
        root.add(w.obj); seat(w.obj, w.x, w.y, 0); waters.push(w);
      }
    }
    function tickO2(dt) {
      /* Cut off before any electrons reached it, the O₂ was never there. One
         already holding electrons stays bound, as it does in complex IV. */
      if (o2 && P.oxygen === false && !o2.electrons) { dropToken(o2.obj); o2 = null; }
      if (o2) {
        approach(o2, o2.to, dt, O2_SPEED);
        let aboard = 0;
        for (const r of o2Riders) if (approach(r, { x: o2.x + r.off.x, y: o2.y + r.off.y }, dt, O2_SPEED * 1.3)) aboard++;
        if (o2.electrons >= E_PER_O2 && aboard === o2Riders.length) toWater();
      }
      for (let i = waters.length - 1; i >= 0; i--) {
        const w = waters[i];
        if (!approach(w, w.to, dt, O2_SPEED * 0.7)) continue;
        w.fade -= dt / WATER_FADE;
        w.obj.traverse(m => { if (m.material) { m.material.transparent = true; m.material.opacity = Math.max(0, w.fade); } });
        if (w.fade <= 0) { dropToken(w.obj); waters.splice(i, 1); }
      }
    }
    function clearO2() {
      if (o2) dropToken(o2.obj);
      o2 = null;
      for (const t of o2Riders.concat(waters)) dropToken(t.obj);
      o2Riders.length = 0; waters.length = 0;
    }

    /* ---- the pump's cytoplasmic headpiece ----
       A P-TYPE ATPase IS MOSTLY NOT IN THE MEMBRANE. Ten transmembrane
       helices carry the ions, and hanging off them on the cytoplasmic side is
       a headpiece about as tall again, in three domains that a Bio 101 reader
       can be told apart and told the job of:

         N  nucleotide-binding — the ATP lands HERE, and it is the lobe that
            reaches furthest out into the cytosol
         P  phosphorylation — the aspartate that takes the phosphate, at the
            foot of the head where it meets the membrane
         A  actuator — takes the phosphate off again, on the other flank

       Drawn because the ATP had nowhere to dock: a token arriving at a bare
       barrel reads as landing on the membrane rather than on the protein, and
       the fact that it can only arrive from INSIDE the cell had nothing to be
       true of. N sits proud and off-axis on purpose — that asymmetry is what
       makes the head read as a headpiece and not a second barrel.

       The three lobes and their sizes are a schematic, not a structure. What
       is honest here is the arrangement, the proportion to the membrane part,
       and which lobe the nucleotide goes to. */
    /* CLEAR OF THE BARREL, which reaches PUMP.height — a lobe inside that is a
       lobe nobody sees — and SMALLER THAN F1, which is a fact and not a
       composition choice. The synthase's head is about 10 nm across and this
       one about 7, so drawn side by side on one stage the pump's has to be
       the lesser of the two: a reader comparing them is comparing the real
       proteins, and the first version had this one the bigger. Measure it
       against buildRotor's lobes, not against the barrel under it. */
    const HEAD_N = { x: 6.2,  y: 39.0, r: 4.8 };
    const HEAD_P = { x: 0.4,  y: 34.0, r: 4.2 };
    const HEAD_A = { x: -6.0, y: 36.5, r: 3.5 };
    function buildPumpHead() {
      const g = new THREE.Group();
      const mat = () => global.Parts.flat(0x4f9e78);
      /* The stalk is the helices continuing out of the bilayer, so it starts
         inside it rather than at its face. */
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 4.2, 22, 12), mat());
      stalk.userData.baseY = HALF + 9; g.add(stalk);
      for (const [key, L] of [['N', HEAD_N], ['P', HEAD_P], ['A', HEAD_A]]) {
        const lobe = new THREE.Mesh(new THREE.SphereGeometry(L.r, 18, 13), mat());
        lobe.scale.set(1, 0.92, 0.92);
        lobe.position.x = L.x;
        lobe.userData.baseY = L.y;
        lobe.userData.domain = key;
        g.add(lobe);
      }
      return g;
    }
    const PUMPHEAD = buildPumpHead();
    PUMP.group.add(PUMPHEAD);
    /* The head hangs on the CYTOSOLIC side, which is the side the pump's ATP
       and its Na⁺ both come from. Same rule as F1 and the same reason it is
       done by sign: a negative scale would turn the lighting inside out. */
    function orientHead(d) {
      for (const child of PUMPHEAD.children) child.position.y = -d * child.userData.baseY;
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
    const PROTEIN_KEYS = { K:null, CL:null, NA:null, AQP:null, pump:null, complex:null, synthase:null, leak:null, translocase:null };
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
      ANT.group.visible = !!pr.translocase;
      antX = pr.translocase ? pr.translocase.x : null;
      if (pr.translocase) { ANT.group.position.x = antX; ANT.setGates(1, 1);
        /* A carrier with no kind, like the pump: nothing queues in it, and
           what it carries is not a traveller at all. */
        holes.push([antX, ANT_HOLE]); PORES.push({ x:antX, R:ANT_R, lumen:7.0, kind:null }); }
      orientRotor(CHEM.pumpDir(P.context));
      orientHead(CHEM.pumpDir(P.context));
      T = pr.pump ? PUMP : pr.K ? CHANNEL : pr.CL ? CLCHAN : pr.NA ? NACHAN : pr.AQP ? AQP
        : pr.complex ? COMPLEX : pr.synthase ? SYNTH : pr.leak ? LEAK : PUMP;
      if (MEM) root.remove(MEM.group);
      /* `exclude` is a signed distance, so holes union as the MINIMUM. */
      /* The bilayer is TINTED BY THE ORGANELLE it is standing in, out of
         palette.js, so the sheet a student meets after zooming into a cut
         cell is the colour that cell's mitochondrion was. */
      const ctx = CHEM.CONTEXTS[P.context] || CHEM.CONTEXTS.plasma;
      const tint = global.MolLib.PALETTE.organelles[ctx.organelle] || global.MolLib.PALETTE.organelles.plasma;
      MEM = global.Parts.membrane({ half:HALF, reach:MEM_REACH, head:tint.head, tail:tint.tail, bowR:BOW,
        exclude: holes.length ? (x, z) => holes.reduce((m, h) => Math.min(m, Math.hypot(x - h[0], z) - h[1]), Infinity) : undefined });
      root.add(MEM.group);
      /* AFTER the sheet, because the arc belongs to it: a protein sits where
         the lipid it displaced would have, and turns with the surface, or it
         stands upright in a sloping bilayer with oil showing under one
         shoulder. */
      /* position.x is still the flat x every branch above just wrote; seat()
         replaces it with the point on the arc. */
      for (const M of [CHANNEL, CLCHAN, NACHAN, AQP, PUMP, COMPLEX, SYNTH, LEAK, ANT]) {
        if (!M.group.visible) continue;
        M.group.rotation.z = -seat(M.group, M.group.position.x, 0, 0);
      }
      buildOuter(tint);
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
      if (OUTER) OUTER.cut.enable(on);   // the lid is cut too, or the porin opens into a wall
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
        global.Parts.ionBadge(kind), el, k * 2);
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
    /* The lid counts: a compartment with an outer membrane over it is only as
       tall as that sheet, or things are scattered into the cytosol at birth. */
    const farY = (side) => (side > 0 ? bandTop() : bandBottom()) * 0.94;
    const inCompartment = side => side * rnd(HALF + 4, farY(side));
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
        const far = farY(s);
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
            if (synthX != null && t.lane === synthX) { protonsThroughSynthase++; if (ROT.pass(1)) { releaseATP(); emit('atp', ROT.atp); } }
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
        const lo = t.yband ? t.yband[0] : -bandBottom(), hi = t.yband ? t.yband[1] : bandTop();
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
      const supply = CHEM.complexRate(P.fuel, P.fuelRate, pmfNow(), P.oxygen);
      /* A one-shot burns at its own full rate: what is being dimmed by
         `fuelRate` is how fast they ARRIVE, and one that has already arrived
         is not arriving slowly. Back-pressure from the pmf still applies —
         a single NADH cannot push protons uphill any better than a stream. */
      const fuelled = supply > 0 ? supply : pulseFuel ? CHEM.complexRate(pulseFuel, 1, pmfNow(), P.oxygen) : 0;
      const rate = fuelled > 0 ? fuelled : cpxCargo.length ? CPX_COAST : 0;
      if (rate > 0) {
        const was = cpxT;
        cpxT = (cpxT + dt * rate / Math.max(0.1, P.complexSeconds)) % 1;
        /* SPENT AFTER ONE CYCLE. feed() starts the clock at load-H, which is
           0, so the wrap back past it is the turn ending. */
        if (pulseFuel && cpxT < was) pulseFuel = null;
      }
      let st = CHEM.Complex.at(cpxT);
      /* NOTHING TO CARRY: hold at the moment of binding rather than turning
         an empty machine. The matrix runs low on protons at a high pmf, and
         a complex miming a turn with nothing in it is a lie the student can
         see. */
      /* AND NOTHING TO PAY WITH IS THE SAME ANSWER. An empty complex used to
         pick up protons whatever was driving it, and CPX_COAST — there so a
         LOADED machine finishes rather than stranding its cargo — then carried
         it through a whole free cycle. So cutting the fuel bought one more
         turn of pumping, and a single feed() bought two. It loads only while
         something is paying; unfuelled and empty, it waits at the loading beat,
         which is what an unfuelled complex does. */
      /* READ LIVE, not from `fuelled`: that was measured before the step
         advanced the cycle, and the step is exactly when a one-shot runs out.
         Using the stale value, the wrap back to load-H still looked fuelled,
         the complex loaded once more, and CPX_COAST carried it through a
         second free cycle — one feed(), two turns. */
      const driving = () => supply > 0 || !!pulseFuel;
      if (st.phase === 'load-H' && !cpxCargo.length) {
        if (!driving() || !recruitProtons(CHEM.Complex.PROTONS_PER_CYCLE)) {
          cpxT = CHEM.Complex.startOf('load-H'); st = CHEM.Complex.at(cpxT);
        }
      }
      if (st.phase !== cpxPhase) {
        /* The carrier comes in as the machine opens to load and is spent on
           the beat this table already calls "the fuel is spent". Nothing here
           decides when that is: the cycle does, so the picture and the
           caption cannot disagree. */
        if (st.phase === 'load-H') { fuelArrive(); o2Arrive(); }
        if (st.phase === 'occlude') { fuelSpend(); o2Reduce(); }
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
      tickATP(dt);
      tickFuel(dt);
      tickO2(dt);
      tickShells(dt);
      /* LAST, and after everything that moved a traveller: the arc is the
         final word on where a thing is drawn, so nothing above has to know
         about it. */
      if (BOW) for (const t of travellers) seat(t.obj, t.x, t.y, t.z);
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
        outerMembrane: outerOn(),
        /* The third space, when there is one: above the outer membrane is
           neither half of this sim, and a caption that calls it "outside"
           has put the cytosol outside the cell. */
        sides: { beyond: outerOn() ? 'the cytosol' : null,
                 inside: CHEM.sideName(P.context, 'inside'), outside: CHEM.sideName(P.context, 'outside'),
                 pumpedInto: CHEM.sideName(P.context, pumpDir() > 0 ? 'outside' : 'inside') },
        pH: proton.pH, dpH: proton.dpH, pmf: proton.pmf,
        atpMade: ROT.atp, rotorTurns: ROT.protons / CHEM.PROTONS_PER_TURN,
        protonsThroughSynthase, protonsLeaked, complexTurns,
        fuel: P.fuel, oxygen: P.oxygen !== false, fuelRate: CHEM.complexRate(P.fuel, P.fuelRate, proton.pmf, P.oxygen), pmfStall: CHEM.PMF_STALL,
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
      clearATP(); clearFuel(); clearO2(); pulseFuel = null;
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
      if (next.outerMembrane != null && next.outerMembrane !== P.outerMembrane) {
        P.outerMembrane = !!next.outerMembrane; layout(P.proteins);   // the lid is built with the layout
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
      outer:    { label: 'the outer membrane', get: () => outerOn(), set: v => set({ outerMembrane: !!v }) },
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
      translocase: { name: 'ADP/ATP translocase', color: hex(RESP.translocase) },
    };
    /* WHAT A MACHINE CARRIES is knowable from the layout alone, and that
       matters because card-stage builds its legend at mount, before a page
       has called set({contents}). Without this a bench that populates on its
       first step drew a legend of proteins and nothing to put through them. */
    const PROTEIN_CARRIES = { K:['K'], CL:['CL'], NA:['NA'], AQP:['water'],
                              pump:['NA','K'], complex:['H'], synthase:['H'], leak:['H'],
                              /* It carries no traveller: what goes through it is the ATP,
                                 which is not one. */
                              translocase:[] };
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
    /* The x furthest from every machine on stage, the porin included: where a
       label can point at the solution itself rather than at something standing
       in it. Stepped rather than solved, because the answer only has to be a
       good gap and the list is never long. */
    function clearX() {
      const xs = PORES.map(p => p.x);
      if (outerOn() && porinX != null) xs.push(porinX);
      if (!xs.length) return -SPREAD() * 0.06;
      xs.sort((a, b) => a - b);
      if (xs.length === 1) return xs[0] - 58;
      /* BETWEEN two machines, never outside them all. The widest gap is
         always the open membrane past the last one, and that is off the side
         of the frame: this module knows where its proteins are and not where
         the camera stops, so the honest answer is the one bounded by things
         that are certainly on screen. Ties go to the gap nearest the middle,
         which is where a reader is already looking. */
      let best = null, bd = -1;
      for (let i = 1; i < xs.length; i++) {
        const mid = (xs[i - 1] + xs[i]) / 2, d = (xs[i] - xs[i - 1]) / 2;
        if (d > bd + 1e-6 || (Math.abs(d - bd) < 1e-6 && Math.abs(mid) < Math.abs(best))) { bd = d; best = mid; }
      }
      return best;
    }

    /* A callout points at a place on the stage, so it rides the arc too. */
    const at = (x, y) => { _a.set(x, y, 0); if (MEM) MEM.bend(_a); return _a; };
    const firstOf = kind => { const t = travellers.find(t => t.kind === kind && !t.aboard); return t ? t.obj.getWorldPosition(_a) : null; };
    const anchors = {
      'channel.K':  () => { const x = poreX('K');  return x == null ? null : at(x, T.height * 0.95); },
      'channel.CL': () => { const x = poreX('CL'); return x == null ? null : at(x, T.height * 0.95); },
      'channel.NA': () => { const x = poreX('NA'); return x == null ? null : at(x, T.height * 0.95); },
      aquaporin:    () => { const x = poreX('water'); return x == null ? null : at(x, T.height * 0.95); },
      pump:    () => P.proteins.pump ? at(pumpX, T.height * 0.98) : null,
      /* WHERE AN ATP BINDS THE PUMP, which is not the same place as "the
         pump". The nucleotide site is on the cytoplasmic headpiece: an ATP
         reaches this protein from INSIDE the cell, the same side the Na⁺ it
         carries starts on, and that is why the ATP a cell makes is ATP this
         pump can spend. Aim a delivery here and not at `pump`, which is the
         top of the barrel — the face on the outside of the cell, which an
         ATP would have to cross the membrane to reach. No headpiece is drawn,
         so the site is the barrel's cytosolic flank. */
      'pump.atp': () => P.proteins.pump
        ? at(pumpX + HEAD_N.x, -CHEM.pumpDir(P.context) * HEAD_N.y) : null,
      'pump.head': () => P.proteins.pump
        ? at(pumpX + HEAD_P.x, -CHEM.pumpDir(P.context) * HEAD_P.y) : null,
      complex:  () => P.proteins.complex  ? at(complexX, COMPLEX.height * 0.98) : null,
      translocase: () => antX == null ? null : at(antX, ANT.height * 0.98),
      porin:    () => !outerOn() ? null : at(porinX, outerY() + CHEM.pumpDir(P.context) * HALF * 0.9),
      cytosol:  () => !outerOn() ? null : at(clearX(), outerY() + CHEM.pumpDir(P.context) * 34),
      /* On the rotor, which moves with the context. */
      synthase: () => synthX == null ? null : at(synthX, -CHEM.pumpDir(P.context) * SYNTH.height * 1.15),
      leak:     () => P.proteins.leak ? at(P.proteins.leak.x, LEAK.height * 0.98) : null,
      oxygen:   () => o2 ? o2.obj.position : null,
      H: () => firstOf('H'),
      heads:   () => at(150, HALF),        // right of the proteins: a shell's panel covers the left
      tails:   () => at(150, 0),
      /* A COMPARTMENT'S CALLOUT MUST NOT LAND ON A MACHINE. It used to sit at
         a fixed x near the middle, which is exactly where a page puts its
         proteins: with a synthase at 0 the "intermembrane space" label pointed
         at the synthase. Mid-band vertically, and horizontally in the widest
         gap the layout leaves. */
      outside: () => at(clearX(), outerOn() ? (HALF + bandTop()) / 2 : farY(1) * 0.34),
      inside:  () => at(clearX(), -farY(-1) * 0.34),
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
      'pump.atp': { text: 'where the ATP binds', offset: [-44, 30],
        card: 'The N domain, the lobe reaching furthest into the cytosol. An ATP reaches this pump from inside the cell — the same side the Na⁺ it carries starts on — and the pump phosphorylates itself from it before it turns, on the P domain at the foot of the head. That is why the ATP a cell makes is ATP this pump can spend.' },
      /* A CALLOUT NAMES; THE CARD ARGUES. This one said "a carrier, not a
         pore", which is the argument, and left the reader looking at a green
         barrel with no name — while the legend beside it said Na⁺/K⁺ pump. */
      'pump.head': { text: 'the cytoplasmic head', offset: [-46, 26],
        card: 'Most of this protein is not in the membrane. Ten helices carry the ions across; the head hanging into the cytosol is three domains — one binds the ATP, one takes the phosphate, one takes it off again — and that cycle of getting phosphorylated and unphosphorylated IS the shape change that moves the cargo.' },
      pump: { text: 'Na⁺/K⁺ pump', offset: [42, -30],
        card: 'A carrier, not a pore: it binds its cargo and changes shape, so it is never open to both sides at once. One ATP buys one turn — 3 Na⁺ out and 2 K⁺ in, both uphill — and that standing cost is most of what a resting cell spends.' },
      heads: { text: 'hydrophilic heads', offset: [34, -30],
        card: 'The head carries charge and sits happily in water, so it turns outward on both faces. That is why a bilayer assembles itself and then holds together.' },
      tails: { text: 'hydrophobic tails', offset: [34, 26],
        card: 'The tails are hydrocarbon and will not mix with water, so they hide in the middle. Everything crossing this membrane has to get through that oil.' },
      outside: { text: 'outside the cell', offset: [-38, -26],
        card: 'Every solute particle sits where a water would have been, so fewer of the molecules here are water. More solute, less free water.' },
      inside:  { text: 'the cytosol', offset: [-38, 26],
        card: 'Mostly water, potassium, and the big anions that never leave. What is dissolved here is what the pump spends ATP to keep.' },
      water: { text: 'water', card: 'Small and uncharged enough to slip through the oil, slowly, in both directions. The net flow is a headcount, not a pull.' },
      NA: { text: 'Na⁺, with its water', offset: [34, -26],
        card: 'Smaller than K⁺, and it still cannot use the K⁺ filter: it holds its water too tightly to trade the shell for the pore.' },
      K:  { text: 'K⁺', card: 'High inside, so it leaks out through its channel, and the pump carries it back. That standing cost is what a cell at rest is.' },
      CL: { text: 'Cl⁻', card: 'High outside, so it runs inward through its own channel, undressing only partly to fit.' },
      A:  { text: 'anion that cannot leave', offset: [34, 26],
        card: 'Protein side chains, phosphates and nucleic acids. They are why the inside is negative, and why it holds so much K⁺ without being positive.' },
      /* Named, not described — the pump's lesson. The name is the CONTEXT's,
         though: the machine that pumps here is a different protein in a
         mitochondrion and in a chloroplast, so applyContext() rewrites both
         the name and the card, and this literal is the generic that stands
         when a page has set neither. */
      complex: { text: 'a proton-pumping complex', offset: [-44, -30],
        card: 'It carries protons one way only, and it pays with the fuel rather than with ATP. Turn the fuel off and it stops, which is the whole reason the gradient is a store and not a fixture.' },
      synthase: { text: 'ATP synthase', offset: [42, 30],
        card: 'A turbine, not a pump. Protons come back down the gradient through it and the rotor turns; every third of a turn makes one ATP. It cannot run uphill, so with no gradient it simply stops.' },
      oxygen: { text: 'oxygen', offset: [42, -34],
        card: 'The last stop for the electrons. Each O₂ takes four, two from each NADH, and four protons from the matrix, and leaves as two waters. With no oxygen the electrons have nowhere to go and the whole chain stops.' },
      leak: { text: 'an uncoupler', offset: [42, -30],
        card: 'A hole for protons. They come home without passing the synthase, so the gradient collapses and no ATP is made. The fuel still burns, and all of it comes out as heat.' },
      translocase: { text: 'ADP/ATP translocase', offset: [-44, 30],
        card: 'ATP is made in the matrix and a charged nucleotide cannot cross a bilayer, so this carries it: one ATP out for one ADP in, a strict swap. It trades a −4 for a −3, so the membrane voltage drives it — the gradient pays once to make the ATP and again to get it out, about a quarter of the whole proton budget.' },
      porin: { text: 'porin', offset: [42, -30],
        card: 'A hole in the outer membrane, wide and unselective. Anything this small passes, which is why the space between the two membranes is nearly the same solution as the cytosol, and why the ATP is home once it is through.' },
      cytosol: { text: 'the cytosol', offset: [-38, -26],
        card: 'Outside the mitochondrion altogether. This is where the ATP is spent: on pumps at the cell surface, on the enzymes that build things, on everything the cell does that costs.' },
      H:  { text: 'H⁺', card: 'A bare proton. It cannot cross the oil on its own, so every one of them goes through a protein, and which protein decides whether the energy becomes ATP.' },
    };
    /* The two compartments are named by the CONTEXT, so a card cannot say
       "the cytosol" about a matrix. Rewritten in place: the notebook
       holds this object. */
    function applyContext() {
      const inside = CHEM.sideName(P.context, 'inside'), outside = CHEM.sideName(P.context, 'outside');
      library.inside.text = inside; library.outside.text = outside;
      if (P.context === 'mitochondrion') {
        library.outside.card = 'The intermembrane space. Every proton the complexes throw out lands here, so this side goes acidic and positive: that is where the energy from NADH now sits. This space and a chloroplast\'s thylakoid lumen are the same place by descent, both of them the OUTSIDE of the bacterium each organelle came from. That is why a photosynthesis diagram looks flipped against this one.';
        library.inside.card  = 'The matrix. The Krebs cycle runs here and hands its NADH to the complexes in this membrane. Protons leave from this side and come back through the synthase.';
        library.complex.text = 'electron transport chain';
        library.complex.card = 'Three complexes drawn as one. NADH hands them electrons, they pass them down to oxygen, which becomes water, and each drop pays for protons thrown out. It spends FUEL rather than ATP: turn the fuel off and it stops, which is the whole reason the gradient is a store and not a fixture.';
      } else if (P.context === 'thylakoid') {
        library.outside.card = 'The stroma, around the outside of the thylakoid disc. ATP is made here, and it is what the Calvin cycle spends to fix carbon. Protons leave from this side and come back through the synthase.';
        library.complex.text = 'the light-driven chain';
        library.complex.card = 'Photosystem II splits water and starts the electrons moving, cytochrome b6f is the one that pumps, and photosystem I lifts them again for NADPH. Drawn as one machine. Light is the fuel, so the dimmer is a rate knob and darkness stops it.';
        library.inside.card  = 'The lumen, the space enclosed by the disc. Light drives protons in here, so this is the acidic side: the energy from the photons is now a gradient across this membrane. It is the same space as a mitochondrion\'s intermembrane space, both of them the OUTSIDE of the bacterium each organelle came from. A thylakoid ended up with that space sealed inside it, which is why the two diagrams are mirrored for a real reason rather than by convention.';
      }
    }

    applyContext();
    layout(P.proteins);
    setShells(P.shells);
    if (P.contents) setContents(P.contents);

    return { step, state, reset, set, on, spend, feed, anchors, library, layers, show, palette,
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
.mem-side.in  { bottom:24%; }
/* Above the outer membrane, when there is one. Higher than the outside
   label, because what it names is a third space, not the top of this one. */
.mem-side.beyond { top:7%; }`;
      document.head.appendChild(st);
    }
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    const mk = cls => { const d = document.createElement('div'); d.className = 'mem-side ' + cls; el.appendChild(d); return d; };
    const out = mk('out'), inn = mk('in'), bey = mk('beyond');
    const paint = () => {
      const s = sim.state();
      if (out.textContent !== s.sides.outside) out.textContent = s.sides.outside;
      if (inn.textContent !== s.sides.inside) inn.textContent = s.sides.inside;
      /* The outer membrane moves the top label DOWN: with a lid on, "inter-
         membrane space" names the band under it, not the top of the frame. */
      bey.textContent = s.sides.beyond || '';
      bey.style.display = s.sides.beyond ? '' : 'none';
      out.style.top = s.sides.beyond ? '37%' : '';
    };
    paint();
    return { paint, destroy() { out.remove(); inn.remove(); bey.remove(); } };
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
      /* A VIEW OFFSET SLIDES THE FRAME OFF THE SCENE'S CENTRE, so the
         compartment has to grow by what it slid or its far edge walks into
         shot: a page that drops the membrane to make room above it gets an
         empty band and a visible floor below. */
      const fn = params.viewOffset || el.viewOffset;
      const off = fn ? fn(box.canvas.clientWidth, box.canvas.clientHeight) : null;
      const slide = off && off.y && box.canvas.clientHeight
        ? Math.abs(off.y) / box.canvas.clientHeight * 2 * halfH : 0;
      return halfH + slide + 26;
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
      on: sim.on, spend: sim.spend, feed: sim.feed,
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
  /* Scale (kit/scale.js). The sheet is angstroms at MolLib.SCALE
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
