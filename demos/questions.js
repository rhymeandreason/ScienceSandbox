/* =====================================================================
 *  questions.js — the question bank, and the topics they connect.
 *  Loaded as a classic script BEFORE a page's own script; exposes
 *  window.QuestionBank = { CONCEPTS, QUESTIONS }.
 *
 *  This is CONTENT, not a module: no behaviour, no DOM, nothing to call.
 *  It is split out because more than one page will read it —
 *  `concept-map.html` draws it as a graph today.
 *
 *  CONCEPTS — the topics a question can name. `id` is what a question
 *  refers to; `built` says whether an engine for it is on disk, which is
 *  the only thing that has to be kept true as lessons ship.
 *
 *  QUESTIONS — one row each:
 *
 *      ['Why are snowflakes six-sided?', ['crystal','water'], 1]
 *        the question                      the concepts        rank
 *
 *  The CONCEPTS a question names are the editorial claim: two ids means
 *  the question sits between those two lessons, three means no single
 *  lesson answers it. A question whose ids are all one lesson is a
 *  caption, not a connection.
 *
 *  RANK is how well the question opens a card — 1 introduces the idea
 *  from cold, 2 follows up, 3 is depth. It is written per question and
 *  read per card, so the test is: if a student landed on any card this
 *  question names, is this a good first thing to ask there?
 *
 *  Every row is a question, ending in a question mark. A statement is a
 *  caption and belongs in the lesson, not here.
 *
 *  An id no CONCEPT defines is dropped silently by the consumer rather
 *  than throwing, so a typo costs the question an edge and says nothing.
 * ===================================================================== */
(function (global) {
  'use strict';

  const CONCEPTS = [
    { id: 'water',     name: 'Water',                 built: 1, featured: 1 },
    { id: 'bonds',     name: 'Bonds',                 built: 1, featured: 1 },
    { id: 'solvation', name: 'Solvation',             built: 1 },
    { id: 'hydrophob', name: 'Hydrophobic effect',    built: 0 },
    { id: 'entropy',   name: 'Entropy',               built: 0 },
    { id: 'folding',   name: 'Protein folding',       built: 1 },
    { id: 'protein',   name: 'Protein structure',     built: 1, featured: 1 },
    { id: 'binding',   name: 'Binding & recognition', built: 0 },
    { id: 'enzyme',    name: 'Enzymes',               built: 0 },
    { id: 'cooperat',  name: 'Cooperativity',         built: 0 },
    { id: 'shape',     name: 'Shape is function',     built: 1 },
    { id: 'membrane',  name: 'The membrane',          built: 1, featured: 1 },
    { id: 'diffusion', name: 'Diffusion',             built: 1 },
    { id: 'osmosis',   name: 'Osmosis',               built: 0 },
    { id: 'massact',   name: 'Mass action',           built: 1 },
    { id: 'coupling',  name: 'Energy coupling',       built: 1 },
    { id: 'glycolys',  name: 'Glycolysis',            built: 1, featured: 1 },
    { id: 'krebs',     name: 'Krebs cycle',           built: 1 },
    { id: 'ferment',   name: 'Fermentation',          built: 0 },
    { id: 'betaox',    name: 'Beta-oxidation',        built: 0 },
    { id: 'etc',       name: 'Electron transport',    built: 0 },
    { id: 'ledger',    name: 'Atom conservation',     built: 0 },
    { id: 'macromol',  name: 'Macromolecules',        built: 1 },
    { id: 'dna',       name: 'DNA',                   built: 1 },
    { id: 'crystal',   name: 'Crystal growth',        built: 0 },
    { id: 'denature',  name: 'Denaturing',            built: 0 },
    { id: 'scale',     name: 'One vs a million',      built: 0 },
  ];

  /* Each row is [question, the concepts it needs, rank, per-lesson ranks?].
     Rank is how well the question opens a card: 1 introduces the idea from cold,
     2 follows up, 3 is depth. It orders a fan when a card is expanded — rank 1
     nearest the card, the rest reading outward — so the first thing a student
     sees off any card is its best way in, not row order.

     The same question rarely opens two cards equally well, so a row may carry
     a fourth element overriding the rank for named lessons:

       ['Why does the helix twist?', ['dna','water'], 3, { dna: 1 }]

     — depth from Water, the way in from DNA. Anything not named there falls
     back to the plain rank, which is why most rows have no fourth element. */
  const QUESTIONS = [
    ['Why do oil and water separate?',                         ['water','hydrophob','entropy'], 1],
    ['Why does soap work?',                                    ['hydrophob','membrane','solvation'], 1],
    ['Why do proteins bury their greasy parts with nothing pulling them in?', ['hydrophob','folding','entropy'], 3],
    ['What are the alternatives to road salt?',                ['water','solvation'], 2],
    ['Why do recipes change at altitude?',                     ['water','entropy'], 1],
    ['How are fizzy drinks made?',                             ['water','solvation','diffusion'], 3],
    ['Why are snowflakes six-sided?',                          ['crystal','water'], 1],
    ['What makes ice cream creamy rather than gritty?',        ['crystal','water'], 1],
    ['How do deep-sea fish keep their blood from crystallising?', ['crystal','binding','protein'], 3],
    ['How do wood frogs survive freezing solid?',              ['crystal','osmosis'], 3],
    ['A protein folds in a second out of more shapes than there are atoms. How?', ['folding','entropy'], 3],
    ['Why do egg whites turn opaque and solid?',               ['denature','folding','hydrophob'], 1],
    ['Why is a fever above 40&#176;C dangerous?',              ['denature','protein','enzyme'], 2],
    ['How do vent bacteria run enzymes above 100&#176;C?',     ['denature','protein'], 3],
    ['Why can&#8217;t you use up an enzyme?',                  ['enzyme','binding','scale'], 1],
    ['Why is cyanide deadly?',                                 ['binding','enzyme','etc'], 2],
    ['Why are some people lactose intolerant?',                ['binding','enzyme','shape'], 1],
    ['Why does one molecule smell of lemon and its mirror of orange?', ['shape','binding'], 1],
    ['Why did thalidomide&#8217;s two halves behave so differently?', ['shape','binding'], 2],
    ['Why does CO kill at 0.1% of the air?',                   ['cooperat','binding','protein'], 2],
    ['How does a fetus take oxygen from its own mother&#8217;s blood?', ['cooperat','protein','scale'], 3],
    ['Why does exercise release oxygen exactly where it&#8217;s needed?', ['cooperat','protein','ledger'], 3],
    ['Why are cells small?',                                   ['diffusion','scale'], 1],
    ['Why does an insect need no lungs and you do?',           ['diffusion','scale','membrane'], 2],
    ['Why can&#8217;t a metre-long neuron let its signal diffuse?', ['diffusion','scale'], 3],
    ['Why does breathing fast make you dizzy?',                ['massact','scale','solvation'], 2],
    ['Why does blood pH barely move when you drink Coke?',     ['massact','solvation','scale'], 2],
    ['How do salmon cross from salt water to fresh?',          ['osmosis','membrane','water'], 1],
    ['Why is an IV 0.9% saline, and distilled water fatal?',   ['osmosis','membrane','solvation'], 1],
    ['How does cholera dehydrate you without entering a cell?', ['osmosis','membrane','binding'], 3],
    ['How high can a tree grow?',                              ['osmosis','water'], 1],
    ['Poke a hole in a membrane and it heals. Why?',           ['membrane','hydrophob','entropy'], 2],
    ['What does a pump actually spend, and on what?',          ['membrane','coupling','glycolys'], 2],
    ['Why do sprinters&#8217; legs burn at 200m but marathoners&#8217; don&#8217;t?', ['ferment','glycolys','protein'], 1],
    ['How does one organism running one pathway give you both bread and beer?', ['ferment','glycolys'], 1],
    ['How do crucian carp survive sealed under ice?',          ['ferment','glycolys'], 3],
    ['Why do red blood cells have no mitochondria?',           ['ferment','glycolys','krebs'], 2],
    ['Why are apples stored in low oxygen, not just cold?',    ['ferment','krebs'], 3],
    ['Why does fructose behave unlike glucose in the liver?',  ['glycolys','enzyme'], 3],
    ['Where does the CO&#8322; you exhale come from?',         ['ledger','krebs','glycolys'], 1],
    ['Why does the oxygen you breathe end up in water, not CO&#8322;?', ['ledger','etc','krebs'], 2],
    ['Why does fat carry more energy than sugar?',             ['ledger','betaox'], 1],
    ['How do camels get water from fat?',                      ['ledger','betaox','osmosis'], 2],
    ['How do bears hibernate?',                                ['betaox','etc'], 3],
    ['How do hibernating animals burn fat as heat?',           ['etc','membrane','betaox'], 3],
    ['How do bacteria live on sulfur or iron with no sun?',    ['etc','coupling'], 3],
    ['Why is ATP worth spending at all?',                      ['coupling','krebs','massact'], 1],
    ['Why is one reaction enough to build all four polymers?', ['macromol','bonds','water'], 3],
    ['Why isn&#8217;t the mutation rate zero?',                ['dna','binding','enzyme'], 2],
    ['What holds the two DNA strands together?',               ['dna','bonds','water'], 2],
    ['Why does a bond form at all?',                           ['bonds','entropy'], 1],
    ['One photon, one flash. One adrenaline, a million glucose. How?', ['scale','binding','glycolys'], 2],
    ['Why is a polymer built by removing water, and taken apart by adding it?', ['macromol','water','bonds'], 2],
    ['Why can you digest starch but not cellulose, when both are only glucose?', ['macromol','shape','enzyme'], 1],
    ['Why are there four classes of macromolecule and not forty?', ['macromol','dna','protein'], 2],
    ['What makes a fat saturated, and why does a membrane care?', ['macromol','membrane'], 2],
    ['Why does one wrong amino acid out of 146 sickle a whole cell?', ['macromol','protein','folding'], 2],
    ['Why is DNA a double helix and not a single strand?',     ['dna','bonds','shape'], 1],
    ['Why does the DNA helix twist?',                          ['dna','bonds'], 1],
    ['Why do the two strands run in opposite directions?',     ['dna','shape','enzyme'], 2],
    ['How does a protein read the sequence without opening the helix?', ['dna','binding','protein'], 3],
    ['Why does heat separate the strands but leave the backbone intact?', ['dna','denature','bonds'], 2],
  ];

  // What a card actually sorts by. Defined here rather than in each consumer,
  // so the page, the editor and the checker cannot disagree about a rank.
  function rankFor(row, conceptId) {
    const per = row[3];
    return (per && per[conceptId]) || row[2];
  }

  global.QuestionBank = { CONCEPTS, QUESTIONS, rankFor };
})(this);
