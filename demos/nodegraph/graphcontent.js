/* =====================================================================
 *  graphcontent.js — what the graph's cards can SHOW, and nothing that
 *  draws it. Loaded after graphdata.js; exposes
 *  window.GraphContent = { CONTENT, PLACEMENTS }.
 *
 *  Separate from graphdata.js on purpose: the skeleton and the material
 *  attached to it are different problems that evolve at different speeds
 *  (Biology-Node-Graph.md's "adding content" section). Same shape as
 *  mapcontent.js's tables, because that shape was earned: content-major,
 *  one row per unit however many nodes point at it, with PLACEMENTS
 *  carrying the rank each placement has.
 *
 *  INLINE only, so far: every row here mounts a live box in its node's
 *  thumb, showing the node's own subject. Content that is its own object
 *  (a video, the sickle comparison serving three nodes) becomes a NODE in
 *  graphdata.js instead — reusable things get nodes, a node's own picture
 *  rides the node.
 *
 *  `id` is namespaced by kind:  w: water sim   m: molbox
 *  A water row's `frame` block is TUNING, not curriculum — it is what
 *  water/watersim.js's step() takes.
 * ===================================================================== */
(function (global) {
  'use strict';

  const CONTENT = [
    /* H-bonds forming and breaking at room temperature: the hub's claim,
       moving. */
    { id: 'w:hbond', kind: 'water', waters: 16,
      frame: { showHbonds: true, tempEnabled: true, temperature: 22 } },
    /* The lattice: same molecules, held apart. */
    { id: 'w:ice', kind: 'water', waters: 16,
      frame: { showHbonds: true, tempEnabled: true, temperature: -8, freezeEnabled: true } },
    /* A crystal coming apart shell by shell. */
    { id: 'w:solvation', kind: 'water', waters: 14, salt: 1,
      frame: { showHbonds: true, tempEnabled: true, temperature: 22 } },
    /* Heat going into breaking bonds: the same box, hot. */
    { id: 'w:heat', kind: 'water', waters: 16,
      frame: { showHbonds: true, tempEnabled: true, temperature: 85 } },
    /* The builder's water, dealt finished and FLAT: the flat view is the one
       that draws every valence electron, which is what the card's claim is
       about. The turn stays the reader's, through the control. */
    { id: 'b:water', kind: 'build', recipe: 'water' },

    /* ---- inline: a protein drawn ON a concept card ----------------------
       These name files directly (composer's r: convention) because what
       they draw — a chain-B fold, one chain of a tetramer — has no role in
       proteins/proteins.js, which registers structures, not illustrations. */
    /* The tetramer as a Cα ribbon: four folded chains packed, which is
       quaternary's exact claim. */
    { id: 'r:quaternary', kind: 'protein',
      trace: 'hemoglobin/data/2HHB.trace.json' },
    /* ONE chain of the same tetramer: one chain finding one shape. Same
       trace file, so nothing is baked twice. */
    { id: 'r:tertiary', kind: 'protein',
      trace: 'hemoglobin/data/2HHB.trace.json', chains: 'B' },
    /* The chain again, with the fold trajectory behind its play button. */
    { id: 'r:folding', kind: 'protein',
      trace: 'hemoglobin/data/2HHB.trace.json', chains: 'B',
      fold: 'hemoglobin/data/2HHB-B.fold.bin' },

    /* ---- molbox: the respiration molecules, spun ------------------------
       mol-pathways.js and mol-krebs.js already hold every one of these for
       molecule-viewer, so a carrier card draws the actual molecule rather
       than describing it. */
    { id: 'm:glucose',   kind: 'molbox', spec: 'glucose' },
    { id: 'm:pyruvate',  kind: 'molbox', spec: 'pyruvate' },
    { id: 'm:acetylcoa', kind: 'molbox', spec: 'acetylcoa' },
    { id: 'm:atp',       kind: 'molbox', spec: 'atp' },
    { id: 'm:nadh',      kind: 'molbox', spec: 'nadh' },

    /* ---- the lesson behind the card -----------------------------
       A lesson RIDES ITS CONCEPT: `shot` is the concept card's thumb and
       the opener under it is that card's call to action. `shot` is not
       optional — a lesson with no screenshot has nothing to sit under, and
       the page says so in the console.

       hemoglobin-lab IS the folding lesson (folding-lab is deprecated):
       a β chain folds 1→3, the heme settles, the chains dock.
       `chrome=bare` is hemoglobin-lab's own parameter and the pathway
       lessons do not read one, so they open with their full chrome. */
    { id: 'l:hemoglobin', kind: 'lesson', name: 'How a chain folds',
      blurb: 'All four levels on one molecule: a β chain folds, the heme settles into the pocket, then the other three chains dock.',
      shot: 'media/kodo-folding.webp',
      href: 'hemoglobin-lab.html?chrome=bare' },
    { id: 'l:glycolysis', kind: 'lesson', name: 'Ten steps in five stages',
      blurb: 'Every step drawn as molecules, with the sugar splitting in front of you.',
      shot: 'media/kodo-glycolysis.webp',
      href: 'glycolysis-lab.html' },
    { id: 'l:krebs', kind: 'lesson', name: 'Around the cycle',
      blurb: 'Eight steps around the ring, played twice for the ×2, and where every carbon ends up.',
      shot: 'media/kodo-krebs.webp',
      /* step 2 is citrate synthase: `done = step - 1` over a STEPS whose
         first entry is the bridge, so 2 is the cycle's own first step. The
         intro and the bridge are skipped because pyr-ox's card is the door
         to those, and this card's concept is the ring. */
      href: 'krebs-lab.html?step=2' },
    /* THE SAME LESSON, ENTERED AT THE BRIDGE. krebs-lab opens with pyruvate
       oxidation before the eight steps, so pyr-ox's lesson is that page —
       but a card shows one screenshot and links one place, and dropping a
       reader at the cycle's start when they asked about the bridge is the
       wrong step and the wrong picture. `?step=1` is krebs-lab's own jump
       (1 is the bridge, clamped there), so a second row is a second door,
       not a second lesson. `name` follows the page: the heading carries
       both words, and "the bridge" is the one that says what it does. */
    { id: 'l:pyrox', kind: 'lesson', name: 'The bridge',
      blurb: 'Pyruvate dehydrogenase strips one carbon off as CO₂ and hands the other two to coenzyme A, between glycolysis in the cytosol and the cycle in the matrix.',
      shot: 'media/kodo-pyruvateoxidation.webp',
      href: 'krebs-lab.html?step=1' },
    /* ON THE QUESTION, NOT A CONCEPT. water-lab is the whole unit rather
       than one claim inside it — h-bonds, ice, temperature, salt dissolving
       — so no single concept card is the right host, and hanging it on one
       would say the lesson is about that one. The anchoring question IS the
       unit's door, and the lesson is what is behind it. */
    /* ON THE QUESTION FOR THE SAME REASON water-lab is. The builder is nine
       molecules — H₂O, CH₄, NH₃→NH₄⁺, CO₂, N₂, HCl, and three salts — so it
       is valence, geometry and charge rather than any one claim, and a third
       of it is ionic. Hanging it on `covalent` would say it is about covalent
       bonds. */
    { id: 'l:builder', kind: 'lesson', name: 'Build a bond by hand',
      blurb: 'Drag two atoms together and let valence, geometry and charge decide what you get — water, methane, ammonia, CO₂, and salt.',
      shot: 'media/kodo-bonding.webp',
      href: 'molecule-builder.html' },
    { id: 'l:water', kind: 'lesson', name: 'Why water behaves the way it does',
      blurb: 'The shape of one molecule, then everything that follows from it: hydrogen bonds, why ice floats, why water resists heating, and what happens when salt goes in.',
      shot: 'media/kodo-water.webp',
      href: 'water-lab.html' },
    { id: 'l:membrane', kind: 'lesson', name: 'What gets through, and what it costs',
      blurb: 'Five steps: the bilayer, oxygen crossing freely, a channel choosing, a pump spending ATP, then the two side by side.',
      shot: 'media/kodo-membrane.webp',
      href: 'membrane-lab.html' },
    /* THE SAME LESSON AT ITS OSMOSIS STEP, the way l:pyrox enters krebs-lab
       at the bridge. `?step=3` is membrane-lab's own jump, 1-based over its
       STEPS. Osmosis sits in the WATER unit while the lesson is the cell's,
       which is the point of a second door: the reader arriving from water
       gets the step about water, not the bilayer. */
    { id: 'l:osmosis', kind: 'lesson', name: 'Water crossing both ways',
      blurb: 'The net flow is a headcount, not a pull: every water walks at random, and more water on one side means more of it wanders out.',
      shot: 'media/kodo-osmosis.webp',
      href: 'membrane-lab.html?step=3' },
    { id: 'l:fermentation', kind: 'lesson', name: 'Where pyruvate goes without O₂',
      blurb: 'Two branches on tabs, and a NAD⁺ ledger carried in from glycolysis that lands on zero.',
      /* the LACTATE branch: one step, and the one a reader meets first,
         in their own legs */
      shot: 'media/kodo-fermentation-lactate.webp',
      href: 'fermentation-lab.html' },

    /* ---- video: somebody else's work ------------------------------------
       RE-DECLARED, not read from lib/mapcontent.js. The composer is being
       deprecated and the nodegraph is not going to inherit a dependency on
       it, so these four rows are copied and the copy is the cost.

       `credit` is not decoration and is printed on the card. `src` is a
       YouTube id and the page builds a youtube-nocookie embed from it, so a
       card nobody opened makes no third-party request; `poster` is a LOCAL
       still for the same reason, and because a remote thumbnail would break
       the card the day the video moves.

       No `captions` here: the composer authored two-track caption files for
       all four, and this page has nothing that reads them yet. Naming a
       field nothing reads is how a claim goes stale. */
    { id: 'v:glycolysis', kind: 'video', src: '1VrRl0UTlA8',
      name: 'Glycolysis',
      credit: 'WEHI', year: 2021,
      creditUrl: 'https://www.wehi.edu.au/topic/biology-101/',
      poster: 'media/glycolysis-wehi.jpg' },
    { id: 'v:krebs', kind: 'video', src: 'aV-kI_ep1Rk',
      /* both names: the film says citric acid cycle, krebs-lab says Krebs */
      name: 'The Krebs cycle (citric acid cycle)',
      credit: 'Drew Berry, WEHI', year: 2020,
      creditUrl: 'https://www.wehi.edu.au/topic/biology-101/',
      poster: 'media/krebs-wehi.jpg' },
    { id: 'v:etc', kind: 'video', src: 'nmoLoiFakxY',
      name: 'The electron transport chain',
      credit: 'Drew Berry, WEHI', year: 2019,
      creditUrl: 'https://www.wehi.edu.au/topic/biology-101/',
      poster: 'media/etc-wehi.jpg' },
    { id: 'v:atp', kind: 'video', src: 'OT5AXGS1aL8',
      name: 'Synthesis of ATP',
      /* two names on it, and both are printed: the film has no dialogue for
         most of its run and the score is carrying the mechanism's rhythm */
      credit: 'Drew Berry & Franc Tétaz, WEHI', year: 2018,
      creditUrl: 'https://www.wehi.edu.au/topic/biology-101/',
      poster: 'media/atp-wehi.jpg' },
  ];

  const PLACEMENTS = [
    ['w:hbond',     { hbond: 1 }],
    ['w:ice',       { 'ice-density': 1 }],
    ['w:solvation', { solvent: 1 }],
    ['w:heat',      { 'spec-heat': 1, 'temp-buffer': 2 }],
    /* water-mol only: the same build on `polarity` illustrated one molecule
       under a claim that is about every molecule */
    ['b:water',     { 'water-mol': 1 }],

    ['r:quaternary', { quaternary: 1 }],
    ['r:tertiary',   { tertiary: 1 }],
    ['r:folding',    { folding: 1 }],
    ['l:hemoglobin', { folding: 1 }],

    /* ---- respiration ----------------------------------------------------
       A film goes on the node whose subject it IS, not on the umbrella:
       the ETC film goes on `etc`, never on `respiration`. Generic
       parent-node attachment is how these degrade into a pile of links
       nobody clicks. */
    ['m:glucose',    { glucose: 1 }],
    ['m:pyruvate',   { pyruvate: 1 }],
    ['m:acetylcoa',  { 'acetyl-coa': 1 }],
    ['m:atp',        { atp: 1 }],
    ['m:nadh',       { carriers: 1 }],

    ['v:glycolysis', { glycolysis: 1 }],
    ['v:krebs',      { krebs: 1 }],
    ['v:etc',        { etc: 1, 'proton-gradient': 2 }],
    ['v:atp',        { chemiosmosis: 1, atp: 2 }],

    ['l:glycolysis',   { glycolysis: 1 }],
    ['l:krebs',        { krebs: 1 }],
    ['l:pyrox',        { 'pyr-ox': 1 }],
    ['l:fermentation', { fermentation: 1 }],
    /* the featured membrane lesson, on the hinge rather than on the bilayer:
       what it teaches is what crosses and what that costs. ONE PLACEMENT: it
       also sat on active-transport at rank 2, which put the same screenshot
       and the same pill on two cards a short walk apart, and a reader who
       met it twice learned nothing the second time. */
    ['l:membrane',     { 'selective-perm': 1 }],
    ['l:builder',      { 'q-bond': 1 }],
    ['l:water',        { 'q-medium': 1 }],
    ['l:osmosis',      { osmosis: 1 }],

    /* ---- specimens ------------------------------------------------------
       A `p:` row places a protein whose entry lives in proteins/proteins.js;
       nothing here restates what the protein IS. The page spawns a specimen
       CARD per placed protein — a leaf, instance-of the concepts that hold
       it. An unplaced registry protein simply does not appear yet, and the
       page says so in the console. */
    ['p:hemoglobin', { quaternary: 1, 'point-mutation': 2, folding: 2 }],
    ['p:amylase',    { enzyme: 1, specificity: 2 }],
    ['p:rnase',      { denaturation: 1, folding: 1 }],   /* Anfinsen: it refolds itself */
    ['p:prion',      { folding: 1, denaturation: 2 }],
    /* the α-helix canonical, and the first tertiary structure ever solved */
    ['p:myoglobin',  { func: 1, secondary: 1 }],

    /* Worked from the CONCEPT side, not the library side: for each concept,
       which protein demonstrates it best. Exactly one canonical per concept
       at rank 1, the rest at 2 — otherwise a concept collects thirty
       examples, which is the hairball again in a different costume. */
    /* the CLOSED form on purpose: the default 1IG8 is open, which is the
       state induced fit has not happened in yet */
    ['p:hexokinase@3B8A', { 'induced-fit': 1, enzyme: 2 }],
    /* the catalytic triad, and a pocket that picks side chains by shape */
    ['p:chymotrypsin',    { 'active-site': 1, specificity: 1 }],
    /* three disulfides holding 51 residues in two chains together */
    ['p:insulin',         { disulfide: 1, quaternary: 2 }],
    /* Gly-X-Y is the sequence that permits the triple helix, and the `oi`
       variant is a second point mutation to set beside sickle */
    ['p:collagen',        { primary: 2, 'point-mutation': 2 }],
    /* the β-barrel, to set against myoglobin's helices */
    ['p:gfp',             { secondary: 2 }],
    /* quaternary structure that is not haemoglobin: 24 identical subunits */
    ['p:ferritin',        { quaternary: 2 }],
    /* the turbine itself, now that chemiosmosis exists to hang it on */
    ['p:atp-synthase',    { chemiosmosis: 1, etc: 2 }],

    /* the pump itself, now that the membrane unit exists to hang it on. Its
       E1 default is the inward-facing state, which is the one that has just
       bound its sodium. Every registry protein is now placed. */
    ['p:napump',          { 'active-transport': 1, 'carrier-protein': 2 }],
  ];

  global.GraphContent = { CONTENT, PLACEMENTS };
})(this);
