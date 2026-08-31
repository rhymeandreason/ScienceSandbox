/* =====================================================================
 *  graphdata.js — the node graph's content, and nothing that draws it.
 *  Loaded before nodegraph.html's own script; exposes
 *  window.GraphData = { UNITS, LADDER, NODES, EDGES }.
 *
 *  Two units built end to end (water, proteins) plus the macromolecule
 *  bridges between them, per docs/Biology-Node-Graph.md. The schema is
 *  that doc's, cut to v1:
 *
 *  NODES — typed. `type` is one of:
 *      concept    a reusable idea (Polarity, Specificity)
 *      structure  a thing that physically exists (Water molecule, Tertiary)
 *      process    something that happens (Folding, Transpiration)
 *      question   an anchoring question; `text`, no claim
 *      theme      a deliberate high-degree hub (Structure–Function)
 *  Structure and process are split from concept on purpose: half of
 *  biology's difficulty is conflating an object with what it does.
 *
 *  `level` is the scale ladder integer (LADDER below), on the node as an
 *  ATTRIBUTE, not as edges — the ladder is the axis nodes sit on, not a
 *  parallel skeleton. A process carries `occursAt` instead (it has no
 *  size, it has a location), an emergent property `emergesAt`, and a
 *  concept carries nothing: null level is correct, not missing.
 *
 *  `unit` picks the tint (UNITS). `subject:'chemistry'` marks a
 *  cross-subject prerequisite — the edges students stall on, flagged so
 *  the map can offer a bridge instead of a dead end.
 *
 *  EDGES — [from, type, to, rank]. Directed; the type reads left to
 *  right ("polarity prerequisite-of hbond"). Rank is intrinsic strength:
 *      1  the spine; what expanding a card deals first
 *      2  enrichment, one step in
 *      3  true, surfaced on request
 *  Soft budget: about five rank-1 edges per node, enforced while
 *  authoring. The one deliberate exception is hbond, the water unit's
 *  mechanism hub — every property routes through it.
 *
 *  ROUTING RULE (the water lesson): a consequence attaches to the
 *  property that causes it, never to water-mol directly. Attach to the
 *  most specific node that fits.
 * ===================================================================== */
(function (global) {
  'use strict';

  const UNITS = {
    water:    { name: 'Water',          tint: '#2f7fb5' },
    macro:    { name: 'Macromolecules', tint: '#5f6672' },
    proteins: { name: 'Proteins',       tint: '#c2553a' },
    resp:     { name: 'Respiration',    tint: '#2e7d63' },
    themes:   { name: 'Themes',         tint: '#c08a1e' },
  };

  /* Chemistry is not a unit: it is another SUBJECT, and its nodes wear
     this tint so the crossing out of biology is visible. */
  const CHEM_TINT = '#8a5cc0';

  const LADDER = [
    [1,  'molecule'], [2, 'macromolecule'], [3, 'organelle'], [4, 'cell'],
    [5,  'tissue'],   [6, 'organ'],         [7, 'organism'],  [8, 'population'],
    [9,  'community'],[10,'ecosystem'],
  ];

  const NODES = [

  /* ---- chemistry prerequisites (cross-subject) ------------------------ */
  { id:'electroneg', type:'concept', unit:'water', subject:'chemistry', name:'Electronegativity',
    claim:'Some atoms pull shared electrons harder than others.' },
  { id:'covalent', type:'concept', unit:'water', subject:'chemistry', name:'Covalent bond',
    claim:'Two atoms share a pair of electrons, and both count them as their own.' },
  { id:'polarity', type:'concept', unit:'water', subject:'chemistry', name:'Polarity',
    claim:'Unequal sharing gives a molecule a positive end and a negative end.' },

  /* ---- water: cause → mechanism → properties → consequences ----------- */
  { id:'water-mol', type:'structure', unit:'water', level:1, name:'Water molecule',
    claim:'Oxygen pulls the shared electrons harder, and the 104.5° bend means the pulls never cancel.' },
  { id:'hbond', type:'concept', unit:'water', name:'Hydrogen bonding',
    claim:'The + hydrogen of one molecule attracts the − oxygen of the next.' },

  { id:'cohesion', type:'concept', unit:'water', name:'Cohesion & adhesion',
    claim:'Water sticks to itself, and to any surface it can hydrogen-bond to.' },
  { id:'spec-heat', type:'concept', unit:'water', name:'High specific heat',
    claim:'Heating water spends most of the energy breaking H-bonds, not raising the temperature.' },
  { id:'evap-cool', type:'concept', unit:'water', name:'Evaporative cooling',
    claim:'The fastest molecules escape first, and they take their energy with them.' },
  { id:'solvent', type:'concept', unit:'water', name:'Solvent properties',
    claim:'Water surrounds anything polar or charged, shell by shell, until it is dissolved.' },
  { id:'hydrophobic', type:'concept', unit:'water', name:'The hydrophobic effect',
    claim:'Water pushes nonpolar molecules together to protect its own H-bond network.' },
  { id:'ice-density', type:'concept', unit:'water', name:'Ice density anomaly',
    claim:'The frozen lattice holds molecules farther apart than the liquid does.' },
  { id:'ionization', type:'concept', unit:'water', name:'Ionization & pH',
    claim:'Water splits into H⁺ and OH⁻ in tiny amounts, and pH counts them.' },

  { id:'transpiration', type:'process', unit:'water', occursAt:7, name:'Transpiration',
    claim:'An unbroken column of water is pulled from root to leaf.' },
  { id:'temp-buffer', type:'concept', unit:'water', name:'Temperature buffering',
    claim:'Cells and lakes change temperature slowly, because their water resists it.' },
  { id:'thermoreg', type:'process', unit:'water', occursAt:7, name:'Thermoregulation',
    claim:'Sweat evaporates, and the evaporation carries body heat away.' },
  { id:'osmosis', type:'process', unit:'water', occursAt:4, name:'Osmosis',
    claim:'Water crosses a membrane toward the saltier side, with nothing pushing it.' },
  { id:'overwinter', type:'process', unit:'water', occursAt:10, name:'Aquatic overwintering',
    claim:'Ice floats, so a lake freezes from the top and life persists below.' },
  { id:'buffers', type:'concept', unit:'water', name:'Buffers',
    claim:'A buffer trades protons back and forth, so pH barely moves.' },

  { id:'amphipathic', type:'concept', unit:'water', name:'Amphipathic',
    claim:'One molecule with a polar region and a nonpolar region, so water sorts it into an inside and an outside.' },
  { id:'dna-structure', type:'structure', unit:'macro', level:2, name:'DNA structure',
    claim:'Charged backbone facing the water, stacked bases hiding from it.' },

  /* ---- macromolecule bridges ------------------------------------------ */
  { id:'dehydration', type:'process', unit:'macro', occursAt:1, name:'Dehydration synthesis',
    claim:'Monomers join by losing a water molecule. Every polymer bond is built this way.' },
  { id:'hydrolysis', type:'process', unit:'macro', occursAt:1, name:'Hydrolysis',
    claim:'Water is added back to break the bond. Digestion is this, run enzymatically.' },
  { id:'phospholipid', type:'structure', unit:'macro', level:1, name:'Phospholipid',
    claim:'A charged head on two oily tails.' },
  { id:'bilayer', type:'structure', unit:'macro', level:2, name:'Phospholipid bilayer',
    claim:'Phospholipids sheet up on their own, tails in, heads out. Nothing bonds them together.' },

  /* ---- macromolecules: the shared pattern, and where it breaks --------
     This unit's job is not the four classes one at a time. It is that ONE
     reaction builds every polymer in biology and one reverse reaction takes
     them all apart, plus the one class that does not play: a lipid is an
     aggregate, not a polymer, and that exception is the content. */
  { id:'functional-group', type:'concept', unit:'macro', subject:'chemistry',
    name:'Functional group',
    claim:'A small cluster of atoms that behaves the same way whatever carbon skeleton it is bolted to.' },
  { id:'polymer', type:'concept', unit:'macro', name:'Polymer',
    claim:'Monomers joined into a chain by one bond, repeated. Three of the four classes are built this way.' },

  { id:'monosaccharide', type:'structure', unit:'macro', level:1, name:'Monosaccharide',
    claim:'One sugar unit. Same formula, different shape, and the shape is what an enzyme reads.' },
  { id:'polysaccharide', type:'structure', unit:'macro', level:2, name:'Polysaccharide',
    claim:'Sugars in a chain, for storage or for structure. Which one depends on how the link is turned.' },
  { id:'starch', type:'structure', unit:'macro', level:2, name:'Starch',
    claim:'Glucose linked α, which your enzymes can open. This is why bread is food.' },
  { id:'cellulose', type:'structure', unit:'macro', level:2, name:'Cellulose',
    claim:'The same glucose linked β. One flipped bond, and no enzyme you own will touch it.' },

  { id:'fatty-acid', type:'structure', unit:'macro', level:1, name:'Fatty acid',
    claim:'A long hydrocarbon tail with an acid group on the end. The tail is the energy.' },
  { id:'triglyceride', type:'structure', unit:'macro', level:2, name:'Triglyceride',
    claim:'Three fatty acids on a glycerol. Not a polymer: no repeating unit, no chain.' },

  { id:'nucleotide', type:'structure', unit:'macro', level:1, name:'Nucleotide',
    claim:'Phosphate, sugar, base. The phosphate is why the backbone is charged.' },
  { id:'protein-class', type:'structure', unit:'macro', level:2, name:'Protein',
    claim:'Amino acids in a chain. The only class whose monomers come in twenty kinds.' },

  /* ---- proteins: the spine is the levels of structure ----------------- */
  { id:'gene-seq', type:'concept', unit:'proteins', name:'Gene sequence',
    claim:'The order of bases that spells out the order of amino acids.' },
  { id:'amino-acid', type:'structure', unit:'proteins', level:1, name:'Amino acid',
    claim:'Twenty kinds, and only the side chain differs between them.' },
  { id:'r-group', type:'structure', unit:'proteins', level:1, name:'R-group',
    claim:'The side chain: nonpolar, polar, acidic or basic. This classification is the real content.' },
  { id:'peptide-bond', type:'structure', unit:'proteins', level:1, name:'Peptide bond',
    claim:'The covalent link between amino acids, and it survives cooking.' },
  { id:'primary', type:'structure', unit:'proteins', level:2, name:'Primary structure',
    claim:'The sequence of amino acids, written by the gene.' },
  { id:'secondary', type:'structure', unit:'proteins', level:2, name:'Secondary structure',
    claim:'Helices and sheets, held by backbone H-bonds. The side chains play no part.' },
  { id:'tertiary', type:'structure', unit:'proteins', level:2, name:'Tertiary structure',
    claim:'The overall 3D shape, driven entirely by the side chains.' },
  { id:'quaternary', type:'structure', unit:'proteins', level:2, name:'Quaternary structure',
    claim:'Several folded chains packed into one machine.' },
  { id:'rgroup-inter', type:'concept', unit:'proteins', name:'R-group interactions',
    claim:'The side chains are what fold the protein: five forces, very different strengths.' },
  { id:'disulfide', type:'structure', unit:'proteins', level:1, name:'Disulfide bridge',
    claim:'A covalent staple between two cysteines, roughly twenty times the other folding forces.' },
  { id:'vdw', type:'concept', unit:'proteins', name:'Van der Waals',
    claim:'Weak, everywhere, and only additive when surfaces already fit.' },
  { id:'folding', type:'process', unit:'proteins', occursAt:1, name:'Protein folding',
    claim:'The chain finds one shape out of astronomically many, while still leaving the ribosome.' },
  { id:'denaturation', type:'process', unit:'proteins', occursAt:1, name:'Denaturation',
    claim:'Heat or acid unfolds the shape without breaking a single covalent bond.' },
  { id:'func', type:'concept', unit:'proteins', name:'Protein function',
    claim:'What a protein does is what its shape lets it do.' },

  { id:'enzyme', type:'structure', unit:'proteins', level:2, name:'Enzyme',
    claim:'A protein that lowers the barrier and comes out the other side unchanged.' },
  { id:'active-site', type:'structure', unit:'proteins', level:2, name:'Active site',
    claim:'A pocket in the tertiary structure where the substrate fits.' },
  { id:'specificity', type:'concept', unit:'proteins', name:'Specificity',
    claim:'One enzyme, one substrate, because the pocket has one shape.' },
  { id:'induced-fit', type:'concept', unit:'proteins', name:'Induced fit',
    claim:'Binding tightens the fit. The pocket is not rigid.' },
  { id:'activation-e', type:'concept', unit:'proteins', subject:'chemistry', name:'Activation energy',
    claim:'The barrier a reaction has to clear before it can run downhill.' },
  { id:'optimal-cond', type:'concept', unit:'proteins', name:'Optimal conditions',
    claim:'Every enzyme has a pH and temperature where its shape holds, and a cliff past them.' },

  /* Haemoglobin and the sickle story are NOT nodes here: individual
     proteins are SPECIMENS, spawned from proteins/proteins.js and placed
     by graphcontent.js — the registry stays the single source of what we
     hold. The sickle chain's card content lives on point-mutation and on
     the haemoglobin specimen's own variants. */
  { id:'point-mutation', type:'concept', unit:'proteins', name:'Point mutation',
    claim:'One base changed, one amino acid swapped. Glu→Val on hemoglobin is enough to sickle a cell.' },
  { id:'nat-select', type:'process', unit:'proteins', emergesAt:8, name:'Natural selection',
    claim:'Sickle carriers resist malaria, so the allele persists. Populations evolve; individuals never do.' },

  /* ---- respiration ----------------------------------------------------
     THE STAGES ARE NOT THE SPINE. A four-node chain is what gets memorised
     and it is exactly the model that produces a student who can recite the
     stages and cannot say why oxygen is needed. The through-line is the
     ELECTRON CARRIERS: the first three stages strip electrons off glucose
     and load them, the last cashes them in. So `carriers` is the hub at
     rank 1 with every stage, and the stages carry `precedes` at rank 2 —
     the sequence is real, it is just not the explanation. */
  { id:'redox', type:'concept', unit:'resp', subject:'chemistry', name:'Redox',
    claim:'Oxidation is losing electrons, reduction is gaining them. Always both at once.' },

  { id:'glucose', type:'structure', unit:'macro', level:1, name:'Glucose',
    claim:'Six carbons holding electrons at high energy. Everything below is the story of taking them.' },
  { id:'pyruvate', type:'structure', unit:'resp', level:1, name:'Pyruvate',
    claim:'Three carbons, and the fork in the road: with oxygen it goes on, without it does not.' },
  { id:'acetyl-coa', type:'structure', unit:'resp', level:1, name:'Acetyl-CoA',
    claim:'Two carbons on a carrier, and the doorway into the cycle.' },
  { id:'atp', type:'structure', unit:'resp', level:1, name:'ATP',
    claim:'The cell spends this, not glucose. A rechargeable battery, recharged about your body weight a day.' },
  { id:'oxygen', type:'structure', unit:'resp', level:1, name:'Oxygen',
    claim:'It never touches the glucose. It waits at the end of the chain and takes the spent electrons.' },

  { id:'carriers', type:'concept', unit:'resp', name:'Electron carriers',
    claim:'NAD⁺ and FAD collect the electrons stripped off glucose and hand them to the chain. The pool is small, so it has to be given back.' },
  { id:'proton-gradient', type:'concept', unit:'resp', name:'Proton gradient',
    claim:'The chain pumps H⁺ to one side. The imbalance itself is stored energy, and it is what the cell actually banks.' },
  { id:'chemiosmosis', type:'concept', unit:'resp', occursAt:3, name:'Chemiosmosis',
    claim:'Protons fall back through a turbine, and the turbine makes ATP. Learned once here, used again in photosynthesis.' },
  { id:'substrate-phos', type:'concept', unit:'resp', name:'Substrate-level phosphorylation',
    claim:'An enzyme hands a phosphate straight to ADP. Direct, and a small fraction of the total.' },
  { id:'oxidative-phos', type:'concept', unit:'resp', name:'Oxidative phosphorylation',
    claim:'ATP made from the gradient instead of by hand. This is where almost all of it comes from.' },

  { id:'mitochondrion', type:'structure', unit:'resp', level:3, name:'Mitochondrion',
    claim:'Two membranes, and the inner one is folded because the chain lives in it. Area is the point.' },

  { id:'respiration', type:'process', unit:'resp', occursAt:4, name:'Cellular respiration',
    claim:'Glucose is taken apart one pair of electrons at a time, and the energy is banked as ATP.' },
  { id:'glycolysis', type:'process', unit:'resp', occursAt:4, name:'Glycolysis',
    claim:'Glucose splits into two pyruvate in the cytosol. Two ATP spent, four made, two carriers loaded.' },
  { id:'pyr-ox', type:'process', unit:'resp', occursAt:3, name:'Pyruvate oxidation',
    claim:'One carbon leaves as CO₂ and the rest becomes acetyl-CoA. The first carbon you breathe out.' },
  { id:'krebs', type:'process', unit:'resp', occursAt:3, name:'Krebs cycle',
    claim:'Two more carbons leave as CO₂ and the carriers are loaded. The named intermediates are not the point.' },
  { id:'etc', type:'process', unit:'resp', occursAt:3, name:'Electron transport chain',
    claim:'Electrons fall from carrier to carrier, and every drop pumps protons across the membrane.' },
  { id:'fermentation', type:'process', unit:'resp', occursAt:4, name:'Fermentation',
    claim:'No oxygen, so the chain stops and the carriers stay full. Fermentation empties them so glycolysis can keep going.' },

  /* ---- themes ---------------------------------------------------------- */
  { id:'structfunc', type:'theme', unit:'themes', name:'Structure ↔ Function',
    claim:'Show me everything where a shape is the explanation.' },
  { id:'energyflow', type:'theme', unit:'themes', name:'Energy Flow',
    claim:'Show me everything where the question is where the energy went.' },

  /* ---- anchoring questions --------------------------------------------
     Every non-question node must sit on a path answering at least one. */
  { id:'q-medium',   type:'question', text:'Why is water the medium of life?' },
  { id:'q-tree',     type:'question', text:'Why can a tree be a hundred metres tall?' },
  { id:'q-lakes',    type:'question', text:'Why do lakes freeze from the top down?' },
  { id:'q-membrane', type:'question', text:'Why does a membrane assemble itself?' },
  { id:'q-sweat',    type:'question', text:'Why does sweating cool you down?' },
  { id:'q-sickle',   type:'question', text:'Why does changing one amino acid out of 146 cause sickle cell disease?' },
  { id:'q-fever',    type:'question', text:'Why is a fever above 40 °C dangerous?' },
  { id:'q-egg',      type:'question', text:'Why can’t you un-cook an egg?' },
  { id:'q-machine',  type:'question', text:'How does a floppy chain become a machine with a specific job?' },
  { id:'q-substrate',type:'question', text:'Why does an enzyme only act on one substrate?' },
  { id:'q-collagen', type:'question', text:'Why does eating protein not directly become your protein?' },
  { id:'q-which',    type:'question', text:'What decides which amino acid goes where?' },
  { id:'q-food',     type:'question', text:'Where does the energy in food actually go?' },
  { id:'q-breathe',  type:'question', text:'Why do you breathe out the carbon you ate?' },
  { id:'q-oxygen',   type:'question', text:'Why do you need oxygen, if it never touches the glucose?' },
  { id:'q-battery',  type:'question', text:'If a mitochondrion is a battery, what is the voltage?' },
  { id:'q-burn',     type:'question', text:'Why do your muscles burn when you sprint?' },
  { id:'q-four',     type:'question', text:'Why are there only four kinds of macromolecule?' },
  { id:'q-starch',   type:'question', text:'Why can you digest starch but not cellulose?' },
  { id:'q-fat',      type:'question', text:'Why does eating fat give more energy than eating sugar?' },
  { id:'q-oil',      type:'question', text:'Why does oil refuse to mix into your blood?' },
  ];

  const EDGES = [
    /* chemistry chain into water. Polarity fans wide on purpose: the doc's
       argument for it being a NODE is that hydrophobic, solvent and
       amphipathic all need it and none can reach a fact buried in water's
       card. */
    ['electroneg',  'prerequisite-of', 'polarity',    1],
    ['covalent',    'prerequisite-of', 'polarity',    1],
    ['polarity',    'prerequisite-of', 'hbond',       1],
    ['polarity',    'prerequisite-of', 'hydrophobic', 1],
    ['polarity',    'prerequisite-of', 'solvent',     2],
    ['polarity',    'prerequisite-of', 'amphipathic', 2],
    /* water's polarity is card content on water-mol; the concept describes it */
    ['polarity',    'describes',       'water-mol',   2],

    /* water-mol: five rank-1 edges, and it stays legible */
    ['water-mol',   'causes',          'hbond',       1],
    ['water-mol',   'instance-of',     'structfunc',  1],
    ['q-medium',    'answers',         'water-mol',   1],
    ['q-medium',    'answers',         'solvent',     2],

    /* hbond, the mechanism hub: fans to the properties at rank 1 */
    ['hbond',       'causes',          'cohesion',    1],
    ['hbond',       'causes',          'spec-heat',   1],
    ['hbond',       'causes',          'evap-cool',   1],
    ['hbond',       'causes',          'solvent',     1],
    ['hbond',       'causes',          'hydrophobic', 1],
    ['hbond',       'causes',          'ice-density', 1],
    ['hbond',       'causes',          'ionization',  2],

    /* each property carries its consequence, never water-mol directly.
       A question answers TWO concepts where it can: one concept is a
       caption, two is a crossing. */
    ['cohesion',    'causes',          'transpiration', 1],
    ['q-tree',      'answers',         'transpiration', 1],
    ['q-tree',      'answers',         'cohesion',      2],
    ['spec-heat',   'causes',          'temp-buffer',   1],
    ['evap-cool',   'causes',          'thermoreg',     1],
    ['q-sweat',     'answers',         'thermoreg',     1],
    ['q-sweat',     'answers',         'evap-cool',     2],
    ['solvent',     'enables',         'osmosis',       1],
    ['ice-density', 'causes',          'overwinter',    1],
    ['q-lakes',     'answers',         'ice-density',   1],
    ['q-lakes',     'answers',         'overwinter',    2],
    ['ionization',  'causes',          'buffers',       1],
    /* pH reaching into the enzyme subtree: the doc's property table names
       enzyme pH optima as ionization's biology */
    ['ionization',  'prerequisite-of', 'optimal-cond',  2],

    /* the edge that justifies the project: one cause, three structures */
    ['hydrophobic', 'causes',          'bilayer',       1],
    ['hydrophobic', 'part-of',         'rgroup-inter',  1],
    ['hydrophobic', 'contributes-to',  'dna-structure', 2],
    ['q-membrane',  'answers',         'bilayer',       1],
    ['q-membrane',  'answers',         'hydrophobic',   2],

    /* amphipathic: the generalization, so it isn't rediscovered three times */
    ['phospholipid','instance-of',     'amphipathic',   1],
    ['phospholipid','part-of',         'bilayer',       1],
    ['amphipathic', 'describes',       'bilayer',       2],

    /* water is the reagent in the universal reaction */
    ['dehydration', 'produces',        'water-mol',     1],
    ['hydrolysis',  'consumes',        'water-mol',     1],
    ['dehydration', 'contrasts-with',  'hydrolysis',    1],
    ['dehydration', 'produces',        'peptide-bond',  1],
    ['hydrolysis',  'consumes',        'peptide-bond',  2],   /* digestion, literally */
    ['q-collagen',  'answers',         'hydrolysis',    1],
    ['q-collagen',  'answers',         'amino-acid',    2],

    /* protein spine: two levels, two separate causes */
    ['gene-seq',    'determines',      'primary',       1],
    ['q-which',     'answers',         'gene-seq',      1],
    ['q-which',     'answers',         'primary',       2],
    ['amino-acid',  'part-of',         'primary',       1],
    ['peptide-bond','part-of',         'primary',       2],
    ['r-group',     'part-of',         'amino-acid',    1],
    ['r-group',     'causes',          'rgroup-inter',  1],
    ['hbond',       'causes',          'secondary',     1],   /* backbone, not R-group */
    ['hbond',       'part-of',         'rgroup-inter',  2],   /* R-group H-bonds, the other kind */
    ['disulfide',   'part-of',         'rgroup-inter',  2],
    ['vdw',         'part-of',         'rgroup-inter',  3],
    /* THE LEVELS LADDER IS A RANK-1 CHAIN: primary determines secondary,
       secondary part-of tertiary, tertiary part-of quaternary. Two edge
       types on purpose — the first hop is information (the sequence says
       WHERE local structure forms), the next two are composition. The
       mechanisms feed in from the side (hbond causes secondary,
       rgroup-inter causes tertiary), so the sequence reads without the
       1°-then-2°-then-3° timeline misconception ever being asserted.

       Tertiary holds seven rank-1 edges, over the soft budget and under
       the ~8 hairball line: rgroup-inter in (the hinge), func out (the
       payoff), denaturation in (the destroys/preserves pair), q-machine
       in (the entry), secondary in and quaternary out (the ladder), and
       the secondary contrast below. Everything else is one step in —
       primary reaches tertiary through the hinge, the enzyme subtree
       opens through func, the theme is enrichment. */
    ['rgroup-inter','causes',          'tertiary',      1],
    ['primary',     'determines',      'secondary',     1],
    ['primary',     'determines',      'tertiary',      2],
    ['secondary',   'part-of',         'tertiary',      1],
    /* the unit's central misconception: one continuous folding process.
       Different causes — backbone H-bonds vs side chains — so the pair
       is held apart explicitly. Takes tertiary to seven rank-1 edges,
       still under the ~8 hairball line, and a contrast is the one edge
       type worth the overage. */
    ['secondary',   'contrasts-with',  'tertiary',      1],
    ['tertiary',    'part-of',         'quaternary',    1],
    ['tertiary',    'causes',          'func',          1],
    ['tertiary',    'instance-of',     'structfunc',    2],
    ['quaternary',  'causes',          'func',          2],

    /* folding is the process, tertiary is the result: one direction only */
    ['folding',     'produces',        'tertiary',      2],
    /* the unit's anchoring question, and one of the map's two entry points:
       it lands on the spine (fold, shape, payoff), not on one card */
    ['q-machine',   'answers',         'folding',       1],
    ['q-machine',   'answers',         'tertiary',      1],
    ['q-machine',   'answers',         'func',          2],
    ['folding',     'contrasts-with',  'denaturation',  2],

    /* denaturation: the destroys/preserves pair is what makes irreversibility comprehensible */
    ['denaturation','destroys',        'tertiary',      1],
    ['denaturation','destroys',        'quaternary',    2],
    ['denaturation','preserves',       'primary',       1],
    ['denaturation','contrasts-with',  'hydrolysis',    1],   /* cooking is not digestion */
    ['q-egg',       'answers',         'denaturation',  1],
    ['q-egg',       'answers',         'folding',       2],

    /* enzyme subtree, hanging off tertiary structure */
    ['enzyme',      'instance-of',     'func',          1],
    /* CONTAINS, not part-of: the two containment relations point opposite
       ways on the explanation axis. part-of builds (amino acids make a
       primary structure), contains zooms in (you meet the enzyme, then
       look inside for the pocket). Typed as part-of, the whole enzyme
       subtree sat six columns left of the enzyme and the walk dead-ended
       there — reading the pocket as a prerequisite for the protein. */
    ['tertiary',    'contains',        'active-site',   2],
    ['enzyme',      'contains',        'active-site',   1],
    ['enzyme',      'lowers',          'activation-e',  1],
    ['active-site', 'causes',          'specificity',   1],
    ['q-substrate', 'answers',         'specificity',   1],
    ['q-substrate', 'answers',         'active-site',   2],
    ['induced-fit', 'describes',       'active-site',   2],
    ['optimal-cond','explained-by',    'tertiary',      2],   /* heat unfolds, it doesn't poison */
    ['q-fever',     'answers',         'optimal-cond',  1],
    ['q-fever',     'answers',         'denaturation',  2],

    /* the showcase path: mutation to phenotype to evolution. The middle of
       the chain (fibres, the sickled cell) is the haemoglobin specimen's
       story; the graph carries the two ends. */
    ['q-sickle',    'answers',         'point-mutation',1],
    /* the hop that makes Glu→Val explicable: charged versus nonpolar */
    ['q-sickle',    'answers',         'r-group',       2],
    ['point-mutation','alters',        'primary',       1],
    ['point-mutation','evidence-for',  'nat-select',    1],

    /* ---- macromolecules --------------------------------------------------
       ONE REACTION, FOUR CLASSES. dehydration already reaches peptide-bond
       and water-mol from the protein unit; here it reaches the pattern
       itself, so the thing a reader learns is the repeat, not four
       chemistries that happen to rhyme. */
    ['functional-group', 'prerequisite-of', 'polymer',        1],
    ['functional-group', 'prerequisite-of', 'monosaccharide', 2],
    ['dehydration',      'produces',        'polymer',        1],
    ['hydrolysis',       'consumes',        'polymer',        1],
    ['q-four',           'answers',         'polymer',        1],
    ['q-four',           'answers',         'functional-group', 2],

    /* the three that are polymers, and the one that is not */
    ['polysaccharide',   'instance-of',     'polymer',        1],
    ['protein-class',    'instance-of',     'polymer',        1],
    ['dna-structure',    'instance-of',     'polymer',        1],
    /* THE PLACE THE PATTERN BREAKS, and the reason the unit is not just a
       list: three fatty acids on a glycerol is an aggregate, not a chain. */
    ['triglyceride',     'contrasts-with',  'polymer',        1],

    /* monomer into class, one per row */
    ['monosaccharide',   'part-of',         'polysaccharide', 1],
    ['glucose',          'instance-of',     'monosaccharide', 1],
    ['amino-acid',       'part-of',         'protein-class',  1],
    ['nucleotide',       'part-of',         'dna-structure',  1],
    ['fatty-acid',       'part-of',         'triglyceride',   1],

    /* starch vs cellulose: one flipped bond, and the whole of why you can
       eat bread and not grass. The highest-value edge in the unit. */
    ['polysaccharide',   'contains',        'starch',         1],
    ['polysaccharide',   'contains',        'cellulose',      1],
    ['starch',           'contrasts-with',  'cellulose',      1],
    ['hydrolysis',       'consumes',        'starch',         1],
    ['q-starch',         'answers',         'cellulose',      1],
    ['q-starch',         'answers',         'starch',         2],

    /* polarity sorts the classes, which is the water unit reaching forward */
    ['polarity',         'determines',      'triglyceride',   2],
    ['hydrophobic',      'causes',          'triglyceride',   2],
    ['q-oil',            'answers',         'triglyceride',   1],
    ['q-oil',            'answers',         'fatty-acid',     2],
    /* the bridge into respiration: a fatty acid tail is more reduced than a
       sugar, so there is more to strip off it */
    ['fatty-acid',       'prerequisite-of', 'carriers',       2],
    ['q-fat',            'answers',         'fatty-acid',     1],
    ['q-fat',            'answers',         'carriers',       2],

    /* ---- respiration -----------------------------------------------------
       THE CARRIER SPINE. Every stage touches `carriers` at rank 1 and the
       stages touch each other at rank 2, so expanding a stage deals the
       mechanism before the running order. */
    ['redox',       'prerequisite-of', 'carriers',    1],
    ['redox',       'prerequisite-of', 'respiration', 1],
    ['glycolysis',  'produces',        'carriers',    1],
    ['pyr-ox',      'produces',        'carriers',    1],
    ['krebs',       'produces',        'carriers',    1],
    ['carriers',    'enables',         'etc',         1],

    /* the carbon, which is the other half of what a stage does */
    ['glycolysis',  'consumes',        'glucose',     1],
    ['glycolysis',  'produces',        'pyruvate',    1],
    ['pyr-ox',      'consumes',        'pyruvate',    1],
    ['pyr-ox',      'produces',        'acetyl-coa',  1],
    ['krebs',       'consumes',        'acetyl-coa',  1],

    /* the running order: real, and deliberately rank 2 */
    ['glycolysis',  'precedes',        'pyr-ox',      2],
    ['pyr-ox',      'precedes',        'krebs',       2],
    ['krebs',       'precedes',        'etc',         2],
    ['respiration', 'contains',        'glycolysis',  2],
    ['respiration', 'contains',        'pyr-ox',      3],
    ['respiration', 'contains',        'krebs',       2],
    ['respiration', 'contains',        'etc',         2],

    /* cashing the carriers in */
    ['etc',         'produces',        'proton-gradient', 1],
    ['etc',         'consumes',        'oxygen',          1],
    ['proton-gradient', 'enables',     'chemiosmosis',    1],
    ['chemiosmosis','produces',        'atp',             1],
    /* the misconception this unit exists to break: oxygen does not burn the
       sugar, it sits at the end of the chain mopping up spent electrons.
       A contrast, because the wrong model is what has to be held apart. */
    ['oxygen',      'contrasts-with',  'glucose',         1],
    ['substrate-phos','contrasts-with','oxidative-phos',  1],
    ['glycolysis',  'instance-of',     'substrate-phos',  2],
    ['chemiosmosis','instance-of',     'oxidative-phos',  1],

    /* CHEMIOSMOSIS IS NOT A RESPIRATION DETAIL. It needs a membrane a proton
       cannot cross, which is the bilayer from the water unit doing work five
       chapters later. This is the edge that pays the water unit back. */
    ['bilayer',     'prerequisite-of', 'chemiosmosis',    1],
    ['mitochondrion','contains',       'etc',             1],
    ['mitochondrion','contains',       'krebs',           2],
    ['mitochondrion','enables',        'chemiosmosis',    2],

    /* the bridge OUT of the protein unit the doc names and the map lacked:
       the whole pathway is enzyme-catalysed, and it is what gives the walk
       somewhere to go from `enzyme` */
    ['enzyme',      'enables',         'respiration',     1],
    ['enzyme',      'enables',         'glycolysis',      2],
    /* digestion's rightward edge, which is what the hydrolysis nudge stood
       in for until this unit existed */
    ['hydrolysis',  'produces',        'glucose',         2],

    /* fermentation is the NEGATIVE CONTROL for the carrier story: it makes
       no ATP of its own, it empties the pool so glycolysis can keep running */
    ['fermentation','contrasts-with',  'respiration',     1],
    ['fermentation','consumes',        'pyruvate',        1],
    /* NOT `enables glycolysis`, which is what recycling NAD⁺ feels like and
       which closed a cycle on the explanation axis: glycolysis → pyruvate →
       fermentation → glycolysis. Stating the mechanism instead of the
       feedback puts fermentation on the carrier spine, which is its whole
       job here — the negative control for what happens when the pool cannot
       be emptied. */
    ['fermentation','produces',        'carriers',        1],

    ['q-food',      'answers',         'respiration',     1],
    ['q-food',      'answers',         'atp',             2],
    ['q-breathe',   'answers',         'krebs',           1],
    ['q-breathe',   'answers',         'pyr-ox',          2],
    ['q-oxygen',    'answers',         'oxygen',          1],
    ['q-oxygen',    'answers',         'etc',             2],
    ['q-battery',   'answers',         'proton-gradient', 1],
    ['q-battery',   'answers',         'chemiosmosis',    2],
    ['q-burn',      'answers',         'fermentation',    1],
    ['q-burn',      'answers',         'carriers',        2],

    /* THE THEME'S FAN — every card whose claim is shape-explains-function.
       Themes are the sanctioned exception to the rank-1 budget: the fan IS
       the view, and the page deals a theme's whole fan regardless of rank.
       So rank here is read from the INSTANCE's side only, and tertiary's
       (above) stays 2 to protect that card's own budget. */
    ['active-site',  'instance-of',    'structfunc',    1],
    ['bilayer',      'instance-of',    'structfunc',    2],
    ['ice-density',  'instance-of',    'structfunc',    2],
    ['dna-structure','instance-of',    'structfunc',    2],
    ['enzyme',       'instance-of',    'structfunc',    2],

    /* Energy Flow's fan, read from the instance's side like structfunc's */
    ['respiration',  'instance-of',    'energyflow',    1],
    ['chemiosmosis', 'instance-of',    'energyflow',    1],
    ['carriers',     'instance-of',    'energyflow',    1],
    ['atp',          'instance-of',    'energyflow',    1],
    ['fermentation', 'instance-of',    'energyflow',    2],
    ['redox',        'instance-of',    'energyflow',    2],
  ];

  global.GraphData = { UNITS, CHEM_TINT, LADDER, NODES, EDGES };
})(this);
