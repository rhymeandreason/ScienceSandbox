/* =====================================================================
 *  mapcontent.js — the door map's content, and nothing that draws it.
 *  Loaded as a classic script BEFORE tests/door-map.html's own script;
 *  exposes window.MapContent = { DOORS, MODULES, QUESTIONS, VIEWS }.
 *
 *  This is CONTENT, not a module: no behaviour, no DOM, nothing to call.
 *  It is split out of door-map.html so it can be edited somewhere better
 *  than an HTML file — map-cms.html reads and writes it through the dev
 *  server's /api/mapcontent, the same path questions-cms.html uses.
 *
 *  NOT lib/questions.js. That bank cuts the same ground into 27 COARSE
 *  concepts ('water', 'bonds', 'shape'); this cuts it into the modules a
 *  lesson actually is ('polarity', 'hbond', 'ice', 'heat'), which is the
 *  decomposition the map needs and the reason the two are separate files
 *  rather than one. 54 of the question texts started life there.
 *
 *  ---------------------------------------------------------------------
 *  DOORS — a door is a question big enough to hold a region. `tint` is the
 *  door's colour on the map, and every module wears its own door's — which
 *  is how a crossing is visible on a card that looks like all the rest. `open` says
 *  whether it has been written; the others are named because modules
 *  point at them, and they are what a second door costs: content, not a
 *  code change.
 *
 *  MODULES — one lesson each. `rank` is its place in ITS door's fan, so a
 *  door opens on its rank 1 modules and not on all nine. `state` is
 *  CLAUDE.md's vocabulary (built / engine / planned) and `away` marks a
 *  module belonging to another door, which the map dots in a different
 *  colour so a crossing is visible.
 *
 *  QUESTIONS — one row each, and QUESTION-MAJOR on purpose:
 *
 *      ['Why is water bent and CO₂ straight?', { polarity:1, geometry:1 }]
 *        the question                            the modules, and the rank
 *                                                the question has ON EACH
 *
 *  The map crosses from one module to another THROUGH a shared question,
 *  so a question is one node however many modules name it. Written
 *  module-major, the same question appeared once per module and a
 *  re-wording in one of them silently split that node in two — breaking
 *  the exact thing the map exists to do. One row cannot drift from
 *  itself.
 *
 *  RANK belongs to the EDGE, not to the question: 27 of these carry a
 *  different rank on different modules, because rank answers "is this a
 *  good FIRST thing to ask on this card?" and the answer changes with
 *  the card. 1 introduces from cold, 2 follows up, 3 is depth.
 *
 *  A question naming ONE module is a caption, not a crossing — it costs a
 *  node and leads nowhere. 28 of these are still that, which is where the
 *  editorial work is.
 *
 *  VIEWS — which modules have something to SHOW, and what. A module with
 *  no entry keeps its placeholder, which is the honest signal that the
 *  lesson behind it has no stage yet; a stand-in that is not that
 *  module's own subject is worse than no picture. The water scenarios'
 *  `frame` blocks are TUNING rather than curriculum — they are what
 *  water/watersim.js's step() takes.
 * ===================================================================== */
(function (global) {
  'use strict';

  const DOORS = [
    { id:'water', name:'Water', tint:'#2f7fb5', open:1,
      question:'Why is water the foundation of life?', label:'the water door' },
    { id:'information', name:'Information', tint:'#8a5cc0', open:0 },
    { id:'proteins', name:'Proteins', tint:'#c2553a', open:0 },
    { id:'boundaries', name:'Boundaries', tint:'#1f7a5e', open:0 },
    { id:'carbon', name:'Carbon', tint:'#5f6672', open:0 },
    { id:'energy', name:'Energy', tint:'#c08a1e', open:0 },
  ];

  const MODULES = [
    { id:'polarity', name:'Polarity', door:'water', rank:1, state:'built', host:'water-lab · molecule-builder',
      claim:'An uneven share of electrons gives a molecule two charged ends.' },
    { id:'hbond', name:'Hydrogen bonding', door:'water', rank:2, state:'built', host:'water-lab',
      claim:'The + H of one water molecule attracts the − O of another.' },
    { id:'solvation', name:'Solvation', door:'water', rank:2, state:'built', host:'water-lab · solvation-lab',
      claim:'Water is polar, so it dissolves anything polar or charged.' },
    { id:'ice', name:'Ice & density', door:'water', rank:3, state:'built', host:'water-lab',
      claim:'Unlike almost every substance, water is less dense as a solid.' },
    { id:'heat', name:'Heat & temperature', door:'water', rank:3, state:'built', host:'water-lab',
      claim:'Water takes a lot of heating, because the energy goes into breaking H-bonds first.' },
    { id:'cohesion', name:'Cohesion & adhesion', door:'water', rank:3, state:'engine', host:'droplet-test · adhesion-test',
      claim:'Water sticks to itself and to other things.' },
    { id:'hydrophob', name:'The hydrophobic effect', door:'water', rank:2, state:'planned',
      claim:'Oil and water separate because the water gains freedom by it.' },
    { id:'condense', name:'Dehydration & hydrolysis', door:'water', rank:2, state:'planned',
      claim:'Monomers join by losing a water, and water splits them apart again.' },
    { id:'entropy', name:'Entropy', door:'water', rank:3, state:'planned',
      claim:'Order can rise in one place as long as more disorder is made somewhere else.' },
    { id:'acids', name:'Acids & pH', door:'water', rank:3, state:'built', host:'molecule-lab',
      claim:'A buffer trades protons back and forth, so pH barely moves.' },
    { id:'basepair', name:'Base pairing', door:'information', rank:1, state:'built', away:1, host:'dna-lab',
      claim:'A pairs only with T and G only with C, because that is where the hydrogen bonds line up.' },
    { id:'replication', name:'Replication & fidelity', door:'information', rank:2, state:'planned', away:1,
      claim:'Copying is proofread as it goes, and the error rate is low but never zero.' },
    { id:'binding', name:'Binding & recognition', door:'proteins', rank:1, state:'planned', away:1,
      claim:'Two molecules stick because their shapes and charges match, and neither is changed by it.' },
    { id:'enzyme', name:'Enzyme catalysis', door:'proteins', rank:2, state:'engine', away:1, host:'hexokinase/',
      claim:'An enzyme lowers the barrier and comes out the other side unchanged.' },
    { id:'levels', name:'Levels of structure', door:'proteins', rank:1, state:'built', away:1, host:'hemoglobin-lab',
      claim:'A protein has four levels of structure, and the sequence decides all four.' },
    { id:'cooperat', name:'Cooperativity', door:'proteins', rank:2, state:'planned', away:1,
      claim:'One oxygen binding changes the shape, and makes the next one easier.' },
    { id:'pumps', name:'Channels & pumps', door:'boundaries', rank:1, state:'built', away:1, host:'membrane-lab',
      claim:'A channel lets things through; a pump spends ATP to push them the wrong way.' },
    { id:'polymers', name:'Monomers & polymers', door:'carbon', rank:1, state:'built', away:1, host:'macromolecule-lab',
      claim:'Four classes of macromolecule, each one a chain of repeating units.' },
    { id:'glycolysis', name:'Glycolysis', door:'energy', rank:1, state:'built', away:1, host:'glycolysis-lab',
      claim:'Ten steps split one sugar in two, spending two ATP to make four.' },
    { id:'geometry', name:'Molecular geometry', door:'carbon', rank:2, state:'built', away:1, host:'molecule-builder',
      claim:'Electron pairs push each other apart, and that is what sets the shape.' },
    { id:'covalent', name:'Covalent bonding', door:'carbon', rank:1, state:'built', away:1, host:'molecule-builder',
      claim:'Two atoms share a pair of electrons, and both count them as their own.' },
    { id:'ionic', name:'Ionic bonding', door:'carbon', rank:2, state:'built', away:1, host:'molecule-builder',
      claim:'One atom takes the electron outright, and the two ions hold on by charge.' },
    { id:'osmosis', name:'Osmosis', door:'boundaries', rank:2, state:'planned', away:1,
      claim:'Water crosses toward the saltier side with nothing pushing it.' },
    { id:'bilayer', name:'The bilayer', door:'boundaries', rank:1, state:'built', away:1, host:'membrane-lab',
      claim:'Phospholipids assemble into a sheet on their own, because their tails avoid water.' },
    { id:'denature', name:'Denaturing', door:'proteins', rank:2, state:'planned', away:1,
      claim:'Heat and acid unfold a protein without breaking a single covalent bond.' },
    { id:'folding', name:'Folding', door:'proteins', rank:1, state:'built', away:1, host:'folding-lab',
      claim:'The chain folds to one shape out of astronomically many, and the sequence picks it.' },
    { id:'diffusion', name:'Simple diffusion', door:'boundaries', rank:1, state:'built', away:1, host:'membrane-lab · diffusion/',
      claim:'Random motion spreads molecules out; going twice as far takes four times as long.' },
  ];

  const QUESTIONS = [
    ['How do structures self-assemble?',                        { hbond:1, folding:1 }],
    ['Why does water stabilize temperature?',                   { heat:1, hbond:1 }],
    ['Why does ice float?',                                     { ice:1, hbond:1 }],
    ['Why is water the universal solvent?',                     { polarity:1, solvation:1, hbond:1 }],
    ['How does pushing molecules together build a structure?',  { hydrophob:1, folding:1 }],
    ['Why do oil and water not mix?',                           { hydrophob:1, bilayer:2, hbond:1 }],
    ['Why does salt dissolve but sand doesn’t?',                { solvation:1, ionic:1 }],
    ['Why do water molecules stick to each other?',             { polarity:1, hbond:1 }],
    ['How does water build and break down macromolecules?',     { polarity:3, condense:1, acids:3 }],
    ['How high can a tree grow?',                               { cohesion:1, osmosis:2 }],
    ['Why does a water drop bead up on wax paper but soak into a towel?', { hbond:2, cohesion:1 }],
    ['What holds the two DNA strands together?',                { hbond:2, basepair:1 }],
    ['Why does heat separate the DNA strands?',                 { hbond:3, basepair:2, denature:3 }],
    ['What are the alternatives to road salt?',                 { solvation:2, heat:2 }],
    ['Why is an IV 0.9% saline?',                               { solvation:2, osmosis:1 }],
    ['How are fizzy drinks made?',                              { solvation:3, diffusion:2 }],
    ['Why are snowflakes six-sided?',                           { ice:1 }],
    ['What makes ice cream creamy?',                            { ice:1 }],
    ['How do deep-sea fish keep their blood from crystallising?', { ice:3, binding:2, folding:2 }],
    ['How do wood frogs survive freezing solid?',               { ice:3, osmosis:2 }],
    ['Why is a fever above 40°C dangerous?',                    { enzyme:2, denature:1 }],
    ['Why does a smell take so long to cross a room?',          { cohesion:3, diffusion:1 }],
    ['Why does soap work?',                                     { hydrophob:1, bilayer:1 }],
    ['Why do proteins bury their greasy parts?',                { hydrophob:2, entropy:2, folding:1 }],
    ['Why does a hole in a membrane heal itself?',              { entropy:1, bilayer:1 }],
    ['Why does breathing fast make you dizzy?',                 { acids:1, diffusion:2 }],
    ['Why does blood pH barely move when you drink Coke?',      { acids:1 }],
    ['Why does milk curdle in lemon juice?',                    { acids:2, denature:2 }],
    ['Why is DNA double-stranded?',                             { basepair:1 }],
    ['Why does the DNA helix twist?',                           { basepair:1 }],
    ['Why do the two DNA strands run in opposite directions?',  { basepair:2, replication:1 }],
    ['Why isn’t the mutation rate zero?',                       { replication:1 }],
    ['How does a protein read DNA without opening it?',         { replication:2, binding:1 }],
    ['Why can’t you use up an enzyme?',                         { binding:1, enzyme:1 }],
    ['Why do mirror-image molecules smell different?',          { binding:1 }],
    ['Why did thalidomide’s two mirror forms behave differently?', { binding:2 }],
    ['Why is cyanide deadly?',                                  { binding:3, enzyme:1 }],
    ['Why are some people lactose intolerant?',                 { enzyme:1 }],
    ['Why does fructose behave differently from glucose?',      { enzyme:2, glycolysis:3 }],
    ['What makes hair different from silk?',                    { levels:1, folding:2 }],
    ['Why does one wrong amino acid sickle a whole cell?',      { levels:1 }],
    ['How do vent bacteria run enzymes above 100°C?',           { levels:2, denature:1 }],
    ['Why does CO kill at 0.1% of the air?',                    { levels:2, cooperat:1 }],
    ['How does blood know where to drop its oxygen?',           { cooperat:1 }],
    ['Why does haemoglobin have four parts and not one?',       { cooperat:1 }],
    ['How does a fetus take oxygen from its mother’s blood?',   { cooperat:2 }],
    ['What does a membrane pump spend?',                        { pumps:1, glycolysis:2, bilayer:2 }],
    ['How does cholera dehydrate you without entering a cell?', { pumps:1, osmosis:1 }],
    ['Why do insects need no lungs?',                           { pumps:2, diffusion:1 }],
    ['Why can you digest starch but not cellulose?',            { polymers:1 }],
    ['Why are there four classes of macromolecule and not forty?', { polymers:1 }],
    ['Why is sugar sweet and starch isn’t?',                    { polymers:1, geometry:3 }],
    ['What makes a fat saturated?',                             { polymers:2, bilayer:1 }],
    ['Why is a polymer built by removing water?',               { polymers:2, condense:1 }],
    ['Why can’t you sprint a marathon?',                        { glycolysis:1 }],
    ['Where does the CO₂ you exhale come from?',                { glycolysis:1 }],
    ['Why do red blood cells have no mitochondria?',            { glycolysis:2 }],
    ['Why does carbon make four bonds?',                        { geometry:1, covalent:1 }],
    ['Why is graphite soft and diamond hard?',                  { geometry:2, ionic:2 }],
    ['Why is table salt safe when sodium explodes in water?',   { ionic:1 }],
    ['How do salmon cross from salt water to fresh?',           { osmosis:1 }],
    ['How do hibernating animals burn fat as heat?',            { bilayer:3 }],
    ['Why do egg whites turn opaque and solid?',                { denature:1 }],
    ['How does a protein find its shape so fast?',              { folding:1 }],
    ['Why are cells small?',                                    { diffusion:1 }],
    ['Why can’t a neuron let its signal diffuse?',              { diffusion:2 }],
  ];

  const VIEWS = {
  hbond:     { kind:'water', waters:16,
               frame:{ showHbonds:true, tempEnabled:true, temperature:22 } },
  solvation: { kind:'water', waters:14, salt:1,
               frame:{ showHbonds:true, tempEnabled:true, temperature:22 } },
  ice:       { kind:'water', waters:16,
               frame:{ showHbonds:true, tempEnabled:true, temperature:-8,
                       freezeEnabled:true } },
  heat:      { kind:'water', waters:16,
               frame:{ showHbonds:true, tempEnabled:true, temperature:85 } },
  /* The bonding builder rather than a picture of a water: this card's claim is
     about the uneven SHARE, and the builder's flat view is the one that draws
     every valence electron. Every builder card here passes `fill:true`, so it
     opens finished and STAYS in that flat view — the turn is the module's
     reward for a molecule the student assembled, and a card the page built has
     not earned it. Turning it is the reader's, through the control.
     Same recipe as `covalent` below, on purpose and not by accident: the two
     modules make different claims about the same molecule. */
  polarity:  { kind:'build', recipe:'water' },
  covalent:  { kind:'build', recipe:'water' },
  geometry:  { kind:'build', recipe:'methane' },
  ionic:     { kind:'build', recipe:'nacl' },

  /* The proton actually moving, which is what a pH is. The recipe hands HCl's
     hydrogen to a water and leaves chloride holding the pair — the mechanism
     the card's buffer claim is made of, though not a buffer itself. Named here
     rather than left blank because a proton changing hands is the thing, and no
     still of a species says it. */
  acids:     { kind:'build', recipe:'hcl' },

  /* The tetramer, as a ribbon. `levels` claims four levels of structure on one
     molecule, and a Ca ribbon is the only picture that shows three of them at
     once: the chain, the helices it folds into, and four of those packed. The
     trace is baked (tools/bake-trace.js) and its secondary structure is the
     deposited HELIX records, not a guess. */
  levels:    { kind:'protein', trace:'hemoglobin/data/2HHB.trace.json',
               surface:'hemoglobin/data/2HHB.card.surf.bin' },

  /* ONE chain of the same tetramer, because this card's claim is about one
     chain finding one shape — four of them would be the level above, which is
     the card next door. Same trace file, so nothing is baked twice. */
  folding:   { kind:'protein', trace:'hemoglobin/data/2HHB.trace.json', chains:'B' },
  /* No `surface` here on purpose: the card-tier bake is the whole tetramer, and
     a card drawing chain B would show a skin around three chains it is not
     claiming. A one-chain bake is a bake, not a flag. */

  /* One phospholipid, which is the whole of "their tails avoid water": the head
     and the two tails are visible as different things in one picture. The same
     spec membrane-lab puts in its inset, for the same reason. */
  bilayer:   { kind:'molbox', spec:'popc' },

  /* The sugar the ten steps split. A card cannot show ten steps, but it can
     show the thing they happen to, and glucose is unambiguous. */
  glycolysis:{ kind:'molbox', spec:'glucose' },
};

  global.MapContent = { DOORS, MODULES, QUESTIONS, VIEWS };
})(this);
