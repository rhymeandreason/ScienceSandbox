/* =============================================================================
 *  proteins/proteins.js — every protein in proteins/, and what we have of it
 * =============================================================================
 *  What `molecules.js` is to a spec, this is to a deposition: the one place
 *  that says which structures we hold, which variant is the default, and what
 *  each one is FOR. It is read by three kinds of reader — the bakers under
 *  `proteins/<name>/tools/`, the benches, and `proteins/check-proteins.js` —
 *  and it is written by two authors, which is the thing to understand before
 *  editing it.
 *
 *  TWO HALVES PER VARIANT, WITH DIFFERENT OWNERS.
 *
 *    said   everything outside `read` — purpose, species, which chains,
 *           which residues make the pocket. A HUMAN's, and a re-bake never
 *           touches it.
 *    read   inside `read: {}` — method, chains in the file, residues
 *           modelled, residues declared, and the file that was written. THE
 *           BAKER's, rewritten from the deposition on every run.
 *
 *  That split is why a card can print "x-ray diffraction, 151 of 151
 *  residues" without a human ever typing a number that a re-bake could
 *  falsify.
 *
 *  EVERY `read` FIELD IS ALSO IN THE BAKE — that is the invariant the whole
 *  file rests on. These five are convenience lines printed into an INDEX, so
 *  the collection can be listed, sorted and compared without opening
 *  seventeen files; they are never a fact the bake cannot produce. The moment
 *  one is, the index stops being a copy and becomes a second source, and the
 *  second source is the one that goes stale. `check-proteins.js` re-derives
 *  all five from the baked file and fails on a disagreement — including the
 *  case where the bake cannot answer at all, which is the way this could
 *  otherwise be broken quietly.
 *
 *  It is why the prion baker carries EXPDTA, REMARK 2 and the COMPND chain
 *  list into every reduced PDB it writes: a cut-down file that cannot say
 *  which experiment made it, how sharp it is and how many chains its entry
 *  has is a file this index would have to REMEMBER things for.
 *
 *  Everything else a reader wants about one structure — resolution, ligands,
 *  the fit residual, the extents — stays in that structure's own bake, beside
 *  the coordinates it describes, and a bench reads it from there.
 *
 *  NO PAGE COPY HERE EITHER. What a structure IS belongs in this file; what a
 *  bench SAYS about it under one particular stage is page copy and lives on
 *  the page, in its `SAYS` table.
 *
 *  `proteins/tools/registry-io.js` is the one place that knows how to splice a
 *  `read` block back in. It runs this file rather than parsing it, the same way
 *  `tools/mapcontent-io.js` handles the door map, so the prose and the comments
 *  around the data cannot be lost to a save — and in this file the comments are
 *  the reasons a structure was chosen, and which one it was chosen instead of.
 *
 *  METHOD IS A CONTROLLED VOCABULARY, and the reason is not tidiness:
 *
 *    'x-ray diffraction' · 'solution nmr' · 'electron microscopy' ·
 *    'neutron diffraction'          — MEASURED
 *    'predicted'                    — MODELLED, by AlphaFold or its like
 *
 *  A predicted structure is a different kind of claim from a measured one, and
 *  a collection that lets the two read alike will eventually show a student a
 *  guess as a fact. This is the field that keeps them apart, which is why it
 *  is spelled one way — `check-proteins.js` fails a method outside the list,
 *  so 'X-RAY DIFFRACTION' and 'x-ray' cannot both end up here and split the
 *  collection in two on a sort.
 *
 *  What QUALIFIES a method — a resolution for a measured structure, a pLDDT
 *  for a predicted one — is a fact about that one structure and lives in its
 *  bake, not here. The index says which KIND of claim a variant is; the bake
 *  says how good it is.
 *
 *  URLS ARE DERIVED FROM `source`, never stored — `rcsb.org/structure/<id>`
 *  and `files.rcsb.org/download/<id>.pdb` for a `kind:'rcsb'`, and a different
 *  pair for AlphaFold. A stored URL is one more thing to mistype, and every
 *  bench already builds both from the id for exactly that reason.
 *
 *  WHAT IS NOT HERE. The sickle fibre, whose baker feeds hemoglobin-lab's
 *  folding trajectory and which this file's re-bake does not reach. It joins
 *  the day someone gives it a `pipeline` that does. Hemoglobin itself is in,
 *  on `pipeline:'own'` for that same reason — its entry says why.
 * ============================================================================= */
(function (global) {
  'use strict';

  /* PrP's three, one of which is not a deposition: `stack` is 6LNI's ten
     chains kept together, a cut of a file already in the list, which is why
     it carries `of:` instead of a source of its own.

     HUMAN ONLY. The bench carried the Syrian hamster pair (1B10 native, 7LNA
     scrapie fibril) through the review and they were not selected: the pair
     says the same thing the human pair says, and two species on one bench is
     a comparison a lesson has not asked for. What went with them is the one
     thing they alone showed — 7LNA is disease MATERIAL from an infected
     brain, where 6LNI is the disease FOLD grown in vitro. If a lesson ever
     needs that distinction, it wants a brain-derived HUMAN fibril, not the
     hamster back. */
  const PRION_VARIANTS = [
    { id: '1QLZ', default: true,
      purpose: 'the healthy fold, human',
      species: 'human',
      section: 'human', label: 'native fold', chip: 'healthy',
      source: { kind: 'rcsb', id: '1QLZ' },
      state: 'healthy', form: 'PrP\u1D9C',
      read: {
        method: "solution nmr",
        chainsInFile: 1,
        ec: null,
        residues: 104,
        declared: 210,
        baked: "prp-1QLZ.json" } },
    { id: '6LNI',
      purpose: 'one rung of the disease fibril',
      species: 'human',
      section: 'human', label: 'fibril rung', chip: 'disease',
      source: { kind: 'rcsb', id: '6LNI' },
      state: 'disease', form: 'PrP\u02E2\u1D9C',
      read: {
        method: "electron microscopy",
        chainsInFile: 10,
        ec: null,
        residues: 60,
        declared: 210,
        baked: "prp-6LNI.json" } },
    { id: 'stack', of: '6LNI',
      purpose: 'ten rungs, which is why it spreads',
      species: 'human',
      section: 'human', label: '6LNI stacked', chip: 'disease',
      source: { kind: 'rcsb', id: '6LNI' },
      state: 'disease', form: 'PrP\u02E2\u1D9C',
      read: {
        method: "electron microscopy",
        chainsInFile: 10,
        ec: null,
        residues: 600,
        declared: 2100,
        baked: "prp-stack.json" } },
  ];

  const MYOGLOBIN_VARIANTS = [
    { id: '1MBN', default: true,
      purpose: 'the first protein structure ever solved',
      species: 'sperm whale',
      section: 'where it came from', label: 'Kendrew, 1960', chip: 'first',
      source: { kind: 'rcsb', id: '1MBN' },
      chains: 'A',
      pocket: { prox: 93, dist: 64 },
      read: {
        method: "x-ray diffraction",
        chainsInFile: 1,
        residues: 153,
        declared: 153,
        ec: null,
        baked: "mb-1MBN.json" } },
    { id: '1BZP',
      purpose: 'the site with nothing in it',
      species: 'sperm whale',
      section: 'the site, four states', label: 'empty · deoxy', chip: '1.15 Å',
      source: { kind: 'rcsb', id: '1BZP' },
      chains: 'A',
      pocket: { prox: 93, dist: 64 },
      read: {
        method: "x-ray diffraction",
        chainsInFile: 1,
        residues: 153,
        declared: 153,
        ec: null,
        baked: "mb-1BZP.json" } },
    { id: '1A6M',
      purpose: 'oxygen bound',
      species: 'sperm whale',
      section: 'the site, four states', label: 'oxygen bound', chip: 'O₂',
      source: { kind: 'rcsb', id: '1A6M' },
      chains: 'A',
      pocket: { prox: 93, dist: 64 },
      read: {
        method: "x-ray diffraction",
        chainsInFile: 1,
        residues: 151,
        declared: 151,
        ec: null,
        baked: "mb-1A6M.json" } },
    { id: '1MBC',
      purpose: 'carbon monoxide in the same place',
      species: 'sperm whale',
      section: 'the site, four states', label: 'carbon monoxide', chip: 'CO',
      source: { kind: 'rcsb', id: '1MBC' },
      chains: 'A',
      pocket: { prox: 93, dist: 64 },
      read: {
        method: "x-ray diffraction",
        chainsInFile: 1,
        residues: 153,
        declared: 153,
        ec: null,
        baked: "mb-1MBC.json" } },
    { id: '1ABS',
      purpose: 'the CO cut loose by light, frozen mid-escape',
      species: 'sperm whale',
      section: 'the site, four states', label: 'CO cut loose by light', chip: '20 K',
      source: { kind: 'rcsb', id: '1ABS' },
      chains: 'A',
      pocket: { prox: 93, dist: 64 },
      read: {
        method: "x-ray diffraction",
        chainsInFile: 1,
        residues: 154,
        declared: 154,
        ec: null,
        baked: "mb-1ABS.json" } },
    { id: '1YMB',
      purpose: 'another animal, the same answer',
      species: 'horse',
      section: 'relatives', label: 'horse heart', chip: '1 chain',
      source: { kind: 'rcsb', id: '1YMB' },
      chains: 'A',
      pocket: { prox: 93, dist: 64 },
      read: {
        method: "x-ray diffraction",
        chainsInFile: 1,
        residues: 153,
        declared: 153,
        ec: null,
        baked: "mb-1YMB.json" } },
    { id: '2HHB-B',
      purpose: 'the same fold, doing a job a monomer cannot',
      species: 'human',
      section: 'relatives', label: 'haemoglobin β', chip: '1 of 4',
      source: { kind: 'repo', id: '2HHB', path: 'hemoglobin/data/2HHB.pdb' },
      chains: 'B',
      pocket: { prox: 92, dist: 63 },
      read: {
        method: "x-ray diffraction",
        chainsInFile: 4,
        residues: 146,
        declared: 146,
        ec: null,
        baked: "mb-2HHB-B.json" } },
  ];

  const RNASE_VARIANTS = [
    { id: '1FS3', default: true,
      purpose: 'the fold by itself',
      species: 'bovine',
      section: 'the fold', label: 'crystal', chip: '1 chain',
      source: { kind: 'rcsb', id: '1FS3' },
      read: {
        method: "x-ray diffraction",
        chainsInFile: 1,
        residues: 124,
        declared: 124,
        ec: "3.1.27.5",
        baked: "rnase-1FS3.json" } },
    { id: '2AAS',
      purpose: 'the same fold in solution',
      species: 'bovine',
      section: 'the fold', label: 'solution, NMR', chip: '1 chain',
      source: { kind: 'rcsb', id: '2AAS' },
      model: 1,
      read: {
        method: "solution nmr",
        chainsInFile: 1,
        residues: 124,
        declared: 124,
        ec: "3.1.27.5",
        baked: "rnase-2AAS.json" } },
    { id: '1RUV',
      purpose: 'the transition state, held still',
      species: 'bovine',
      section: 'working', label: 'transition state', chip: '1 chain',
      source: { kind: 'rcsb', id: '1RUV' },
      read: {
        method: "x-ray diffraction",
        chainsInFile: 1,
        residues: 124,
        declared: 124,
        ec: "3.1.27.5",
        baked: "rnase-1RUV.json" } },
    { id: '1RNU',
      kind: 'cut',
      purpose: 'cut in two and still working',
      species: 'bovine',
      section: 'taken apart', label: 'cut in two · RNase S', chip: '1 chain',
      source: { kind: 'rcsb', id: '1RNU' },
      read: {
        method: "x-ray diffraction",
        chainsInFile: 1,
        residues: 116,
        declared: 124,
        ec: "3.1.27.5",
        baked: "rnase-1RNU.json" } },
    { id: '1A2W',
      kind: 'swap',
      purpose: 'the C-terminal half traded',
      species: 'bovine',
      section: 'taken apart', label: 'C-terminal swap', chip: '2 chains',
      source: { kind: 'rcsb', id: '1A2W' },
      chains: 'A,B',
      read: {
        method: "x-ray diffraction",
        chainsInFile: 2,
        residues: 248,
        declared: 248,
        ec: "3.1.27.5",
        baked: "rnase-1A2W.json" } },
    { id: '1F0V',
      kind: 'swap',
      purpose: 'the N-terminal half traded',
      species: 'bovine',
      section: 'taken apart', label: 'N-terminal swap', chip: '2 chains',
      source: { kind: 'rcsb', id: '1F0V' },
      chains: 'A,B',
      read: {
        method: "x-ray diffraction",
        chainsInFile: 8,
        residues: 248,
        declared: 248,
        ec: "3.1.27.5",
        baked: "rnase-1F0V.json" } },
    { id: '1DFJ',
      kind: 'bound',
      purpose: 'caught by the protein that keeps it off our RNA',
      species: 'bovine enzyme, porcine inhibitor',
      section: 'working', label: 'held by its inhibitor', chip: '2 chains',
      source: { kind: 'rcsb', id: '1DFJ' },
      read: {
        method: "x-ray diffraction",
        chainsInFile: 2,
        residues: 580,
        declared: 581,
        ec: "3.1.27.5",
        baked: "rnase-1DFJ.json" } },
  ];


  /* COLLAGEN'S SIX, AND MOST OF THEM ARE NOT PIECES OF EACH OTHER. Three are
     designed peptides that occur in no gene, one is a construct built around a
     real site, one is a complex with a chaperone, and one is a whole molecule.
     `proteins/collagen/collagen-test.html`'s lower-left readout is where that
     is said to a reader; here it is why the list looks heterogeneous.

     HUMAN ONLY. The bench carried 1BKV — the T3-785 peptide, a real type III
     sequence with a proline-free guest — through review and it was not
     selected. It was the only NATURAL short sequence here, which sounds like a
     reason to keep it, and the measurement is what sank it: the wide extents
     that were supposed to show its imino-poor middle splaying turned out to be
     one frayed chain terminus, and with the ends trimmed it says nothing 1CAG
     does not say better. It is also type III, so the type I ruler cannot even
     place it. If a lesson ever wants "collagen is not a uniform rope", it
     wants that claim measured first, not this entry back. */
  const COLLAGEN_VARIANTS = [
    { id: 'ppg10', default: true,
      /* THE DEFAULT IS A SECTION, NOT THE MOLECULE, and every reader of this
         file should know it before they trust the card. A collagen molecule is
         3016 Å of three chains; this is 86 Å of designed repeat, about a
         thirty-fifth of one, and it is the default because it is the clearest
         picture of what the repeat DOES — not because it is representative of
         the size. `molecule` is the whole thing and looks like a hair.

         It is also the unhydroxylated half of the one controlled pair here,
         and the state prolyl 4-hydroxylase actually acts on. */
      purpose: 'the triple helix by itself, at 1.3 Å — a section, not the molecule',
      species: 'synthetic',
      source: { kind: 'rcsb', id: '1K6F' },
      chains: 'A,B,C',
      helix: 'A,B,C',
      pocket: { hydroxyl: true },
      strands: { A: 'chain 1', B: 'chain 2', C: 'chain 3' },
      read: {
        method: "x-ray diffraction",
        chainsInFile: 6,
        residues: 87,
        declared: 90,
        ec: null,
        baked: "col-ppg10.json" } },

    { id: 'pog9',
      purpose: 'the same helix with the hydroxyls on — the matched control',
      species: 'synthetic',
      source: { kind: 'rcsb', id: '3B0S' },
      /* Chains A-C, not D-F: the file holds two triple helices and chain E
         models seventeen hydroxyls where every other chain models nine. */
      chains: 'A,B,C',
      helix: 'A,B,C',
      pocket: { hydroxyl: true },
      strands: { A: 'chain 1', B: 'chain 2', C: 'chain 3' },
      read: {
        method: "x-ray diffraction",
        chainsInFile: 6,
        residues: 81,
        declared: 81,
        ec: null,
        baked: "col-pog9.json" } },

    { id: 'oi',
      purpose: 'one glycine replaced by alanine — the brittle-bone substitution',
      species: 'synthetic',
      source: { kind: 'rcsb', id: '1CAG' },
      chains: 'A,B,C',
      helix: 'A,B,C',
      pocket: { hydroxyl: true },
      strands: { A: 'chain 1', B: 'chain 2', C: 'chain 3' },
      read: {
        method: "x-ray diffraction",
        chainsInFile: 3,
        residues: 88,
        declared: 90,
        ec: null,
        baked: "col-oi.json" } },

    { id: 'grip',
      purpose: 'the GFOGER site with the integrin holding it',
      species: 'human peptide, human integrin',
      source: { kind: 'rcsb', id: '1DZI' },
      chains: 'A,B,C,D',
      /* The frame is solved on the COLLAGEN, not on everything drawn: the
         I-domain's own longest axis is longer, and a frame over all four
         chains stands the helix at an angle to the screen. */
      helix: 'B,C,D',
      pocket: { metal: 'CO' },
      strands: { A: 'integrin α2 I', B: 'chain 1', C: 'chain 2', D: 'chain 3' },
      read: {
        method: "x-ray diffraction",
        chainsInFile: 4,
        residues: 248,
        declared: 251,
        ec: null,
        baked: "col-grip.json" } },

    { id: 'chaperone',
      purpose: 'Hsp47 holding a finished helix — collagen before it leaves the cell',
      species: 'human',
      source: { kind: 'rcsb', id: '4AU3' },
      /* Two Hsp47 on one triple helix; the file holds a second copy of the
         same assembly on C, D and H-J. Which two touch this helix was counted
         off the Cα distances, not guessed. */
      chains: 'A,B,E,F,G',
      helix: 'E,F,G',
      strands: { A: 'Hsp47', B: 'Hsp47', E: 'chain 1', F: 'chain 2', G: 'chain 3' },
      read: {
        method: "x-ray diffraction",
        chainsInFile: 10,
        residues: 777,
        declared: 844,
        ec: null,
        baked: "col-chaperone.json" } },

    { id: 'molecule',
      purpose: 'one whole type I molecule, 3016 Å, as it sits in a fibril',
      species: 'rat tail tendon',
      source: { kind: 'rcsb', id: '3HR2' },
      /* A and C are α1(I), B is α2(I) — two of one gene product and one of
         another, which is what the colour says. It is also THE RULER: every
         other variant's position on the molecule is a sequence match against
         this entry, and its own numbering starts at the telopeptide, sixteen
         residues before helix residue 1. */
      chains: 'A,B,C',
      helix: 'A,B,C',
      strands: { A: 'α1(I)', B: 'α2(I)', C: 'α1(I)' },
      read: {
        method: "fiber diffraction",
        chainsInFile: 3,
        residues: 3134,
        declared: 3140,
        ec: null,
        baked: "col-molecule.json" } },
  ];

  const PROTEINS = [
    {
      key: 'napump', name: 'Na⁺/K⁺-ATPase', dir: 'proteins/napump',
      blurb: 'The pump that keeps every animal cell electrically alive: three '
           + 'sodiums out, two potassiums in, one ATP a turn, and about a '
           + 'fifth of the energy you spend at rest.',
      does: 'enzyme',
      pipeline: 'trace',
      /* NOT SUPERPOSED, AND IT MUST NOT BE. Both are baked from their OPM
         copies, which are already in one frame — the bilayer normal upright,
         the membrane centred on zero — so a fit would move them out of the
         membrane and into each other, which is the one comparison this pair
         is not about. Flipping between them works because they share the
         MEMBRANE's frame rather than a fitted one. */
      fit: null,
      fitWhy: 'both are already in the membrane frame OPM solved; fitting one '
            + 'onto the other would trade that for an arbitrary one',
      view: { by: 'measured', shared: false,
              why: 'the field draws a membrane protein on its bilayer normal, '
                 + 'and OPM republishes the coordinates already in it — the '
                 + 'frame is the file, not a basis this repo solved' },
      surface: { bake: false,
                 why: 'a claim about a CYCLE, not a surface: what changes '
                    + 'between the two is which side the site opens to, and a '
                    + 'skin hides the site along with the change' },
      variants: [
        { id: 'E1', default: true,
          purpose: 'three sodiums bound, the door open to the inside',
          species: 'pig',
          source: { kind: 'rcsb', id: '7E1Z' },
          read: {
            method: "electron microscopy",
            chainsInFile: 3,
            residues: 1302,
            declared: 1392,
            ec: "7.2.2.13",
            baked: "pump-E1.json" } },
        { id: 'E2',
          purpose: 'two potassiums bound, the door open to the outside',
          species: 'pig',
          source: { kind: 'rcsb', id: '7E20' },
          read: {
            method: "electron microscopy",
            chainsInFile: 3,
            residues: 1321,
            declared: 1392,
            ec: "7.2.2.13",
            baked: "pump-E2.json" } },
      ],
    },
    {
      key: 'prion', name: 'Prion protein', dir: 'proteins/prion',
      blurb: 'One sequence, two shapes: the healthy human fold and the disease '
           + 'fold, as deposited. The stack is the reason it spreads.',
      /* NOT A HEDGE. PrP-C's normal job is genuinely unsettled — copper
         binding, signalling, myelin maintenance are all proposed and none
         settled — and a collection that guessed would be teaching one of
         them. What it does when it misfolds is the whole lesson, and that is
         not a function. */
      does: 'unknown',
      pipeline: 'trace',
      /* What else lives in data/ and is not a variant. Prion COMMITS its
         sources (they are small once cut to model 1) and its baker writes
         two intermediates the views are sliced out of. Listing them is what
         lets check-proteins.js flag a file that is in data/ for no reason —
         a stale bake from a renamed view, which a bench goes on loading. */
      /* The sources and what the baker cuts out of them. They stay as PDB
         because prion.js's morph and CCD need whole residues and
         check-prion.js reads two of them for its geometry assertions — only
         the three VIEWS became traces, when the unfold animation they were
         shaped for was dropped. */
      /* 1QLZ.pdb, the 2.7 MB twenty-model deposition, is not committed — the
         baker's header carries its URL and 1QLZ-model1.pdb is what the bench
         reads. The ensemble view was measured off it and never shown; prep.js
         says why. Re-download before re-running either. */
      keeps: ['1QLZ-model1.pdb', '6LNI.pdb',
              'prp-native.pdb', 'prp-fibril.pdb', 'prp-stack.pdb',
              'prp-view-1QLZ.pdb', 'prp-view-6LNI.pdb', 'prp-view-stack.pdb'],
      /* Not superposed, and it must not be: the ensemble view IS the spread of
         twenty models, and the stack is ten chains whose relative positions
         are the subject. Fitting either would delete what it shows. */
      fit: null,
      fitWhy: 'the ensemble and the stack are about relative position; a fit '
            + 'would delete what they show',
      view: { by: 'measured', shared: false,
              why: 'a fibril has a convention — its axis vertical — and the '
                 + 'baker solves that axis off consecutive rungs' },
      surface: { bake: false,
                 why: 'a fold claim: a surface buries the secondary structure '
                    + 'that is the whole point' },
      variants: PRION_VARIANTS,
    },
    {
      key: 'amylase', name: 'α-Amylase', dir: 'amylase',
      blurb: 'The enzyme in your saliva that starts on starch before you have '
           + 'swallowed. One long trough, four subsites, and a drug sitting in '
           + 'it that the enzyme cannot cut.',
      /* EC 3.2.1.1, in the file's own COMPND record. */
      does: 'enzyme',
      /* Its own pipeline: `amylase/tools/` bakes the site measurements, the
         surface and the docking control that `amylase-test.html` reads, and
         `check-amylase.js` / `check-fit.js` audit them. Nothing here reaches
         into that; the `read` block comes off 1OSE itself. */
      pipeline: 'own',
      page: 'amylase/amylase-test.html',
      /* One entry, so nothing to superpose onto anything. */
      fit: null,
      fitWhy: 'a single deposition — there is no second structure to fit',
      view: { by: 'deposited', shared: false,
              why: 'a globular domain with a trough across it; a solved basis '
                 + 'would flip between rebakes and no human has picked one' },
      surface: { bake: true,
                 why: 'baked, and it earns it: the lesson is a POCKET — a '
                    + '19.8 Å trough over four subsites — and a ribbon draws '
                    + 'the walls of it as a tangle of loops' },
      variants: [
        { id: '1OSE', default: true,
          purpose: 'the site, with acarbose sitting in it',
          species: 'pig',
          chains: 'A',
          source: { kind: 'repo', id: '1OSE', path: 'amylase/data/1OSE.pdb' },
          /* The ribbon is a trace baked with `tools/bake-trace.js`, the
             one-file conversion that tool exists for. The rest is this
             protein's own: the SES the bench toggles, the site measurements
             its panel prints, and the docking control `check-fit.js` audits. */
          bake: { trace: '1OSE.trace.json',
                  surface: '1OSE.surf.bin',
                  card: '1OSE.card.surf.bin',
                  site: 'amylase.json',
                  fit: 'fit.json' },
          read: {
            method: "x-ray diffraction",
            chainsInFile: 1,
            residues: 495,
            declared: 496,
            ec: "3.2.1.1",
            baked: "1OSE.trace.json" } },
      ],
    },
    {
      key: 'hemoglobin', name: 'Haemoglobin', dir: 'hemoglobin',
      blurb: 'Four myoglobins that learned to talk to each other. One oxygen '
           + 'binding pulls the whole tetramer into the shape that binds the '
           + 'next three more easily.',
      does: 'oxygen carrier',
      /* NOT THIS REGISTRY'S PIPELINE, and that is the whole of the entry. Its
         bakes feed hemoglobin-lab's folding trajectory and are made by
         `hemoglobin/tools/`, on their own schedule and in their own formats —
         a trace, a quaternary file with hemes and irons, a surface, an 830 KB
         fold. `pipeline:'own'` says so: check-proteins.js verifies the `read`
         block against the DEPOSITION each variant names rather than against a
         bake it did not shape, and leaves that folder's files alone.

         It is in here because a gallery that omitted the repo's most developed
         protein would read as broken, and because "what do we hold" is a
         question about the repo and not about which script wrote a file. */
      pipeline: 'own',
      /* Its bench is not at the derived path, so it is named. `surface-test`
         is where these two variants get reviewed against each other — it
         toggles 2HHB against 2HBS with both SES surfaces — which is the same
         job every other protein's `<key>-test.html` does. */
      page: 'hemoglobin/surface-test.html',
      /* The only protein here that already has a LESSON. A card links it
         second, because the gallery is about what we hold and the lesson is
         what one of them became. */
      lesson: 'hemoglobin-lab.html',
      /* Two crystals of the same protein, one mutation apart. Not states of
         one thing in a frame sense — 2HBS is two tetramers in the asymmetric
         unit and the fibre contact is what it is deposited for — so nothing is
         superposed and each opens in its own frame. */
      fit: null,
      fitWhy: 'two entries, not two states of one; the sickle file is deposited '
            + 'for a contact between tetramers, which a fit onto one of them '
            + 'would move',
      view: { by: 'deposited', shared: false,
              why: 'a tetramer is round enough that a solved basis would flip '
                 + 'between rebakes, and no human has picked one yet' },
      surface: { bake: true,
                 why: 'baked already, and the one case that earns it: the '
                    + 'sickle lesson is a CONTACT between two tetramers, which '
                    + 'is a claim about surfaces' },
      variants: [
        { id: '2HHB', default: true,
          purpose: 'the tetramer, deoxy — what the lesson folds',
          species: 'human',
          source: { kind: 'repo', id: '2HHB', path: 'hemoglobin/data/2HHB.pdb' },
          /* EVERY BAKE THIS ENTRY HAS, BY ROLE. A protein whose files another
             pipeline writes has several in several shapes, and which is which
             is a decision rather than something a filename proves — so the
             roles are said here, `check-proteins.js` fails a name that is not
             on disk, and `read.baked` is the one a card draws.

               trace    the Cα ribbon, what a gallery card and a bench draw
               quaternary  chains + hemes + irons, hemoglobin-lab's level 4
               surface  the full SES, 1.5 MB, for a page that shows skin
               card     the same surface cut down for a thumbnail
               fold     the folding trajectory, chain B, 830 KB */
          bake: { trace: '2HHB.trace.json',
                  quaternary: '2HHB-quaternary.json',
                  surface: '2HHB.surf.bin',
                  card: '2HHB.card.surf.bin',
                  fold: '2HHB-B.fold.bin' },
          read: {
            method: "x-ray diffraction",
            chainsInFile: 4,
            residues: 574,
            declared: 574,
            ec: null,
            baked: "2HHB.trace.json" } },
        { id: '2HBS',
          purpose: 'sickle haemoglobin, one mutation away',
          species: 'human',
          chains: 'A,B,C,D',
          source: { kind: 'repo', id: '2HBS', path: 'hemoglobin/data/2HBS.pdb' },
          /* The first of the two tetramers in the asymmetric unit. NO TRACE,
             and that is a fact worth reading off this list: the sickle side is
             baked for its SURFACE, because what it is deposited for is a
             contact between tetramers, and a contact is a claim about skin
             rather than about a backbone. Its quaternary file carries the
             chains, hemes and irons that surface-test draws beside it. */
          bake: { quaternary: '2HBS-T1-quaternary.json',
                  surface: '2HBS-T1.surf.bin' },
          read: {
            method: "x-ray diffraction",
            chainsInFile: 8,
            residues: 574,
            declared: 574,
            ec: null,
            baked: "2HBS-T1-quaternary.json" } },
      ],
    },
    {
      key: 'collagen', name: 'Collagen', dir: 'proteins/collagen',
      blurb: 'Three chains wound into a rope, Gly-X-Y over and over, a third '
           + 'of the protein in you. Every third residue is glycine because '
           + 'nothing with a side chain fits where the chains meet.',
      /* IT HOLDS. The first entry here that catalyses nothing and carries
         nothing: collagen is material, and what it does is not chemistry. */
      does: 'structural',
      pipeline: 'trace',
      /* Not superposed, and not a near miss: these are six different
         molecules, not six states of one. Three designed peptides, a
         construct built around a real site, a chaperone complex and a whole
         molecule — there is no correspondence for a fit to use. */
      fit: null,
      fitWhy: 'six different molecules rather than six states of one; three of '
            + 'them occur in no gene, so there is nothing to fit onto what',
      view: { by: 'measured', shared: false,
              why: 'a collagen figure is drawn along the helix, the way a '
                 + 'fibril is drawn on its axis — the baker solves that axis '
                 + 'off the SUBJECT\'s chains rather than off everything '
                 + 'drawn, or a complex is framed on its partner instead' },
      surface: { bake: false,
                 why: 'a fold claim, and the most extreme one here: the whole '
                    + 'subject is three strands winding around each other, '
                    + 'and a skin over them is a smooth rod' },
      /* NO COLLAGEN FILE RECORDS ITS OWN HELIX, and the escape is claimed here
         rather than left to look like a broken read. A PDB says helix or
         sheet; polyproline II is neither, so these bake as pure coil and
         `check-proteins.js` would otherwise fail every one of them for drawing
         a worm. `some: true` because three of the six DO carry records — for
         their partner proteins, and for 1CAG's depositors annotating the
         triple helix as a class-10 coiled coil, which is the collection
         holding both answers about one shape. */
      /* HOW ITS CHAINS ARE TOLD APART, and it is here rather than on the bench
         because the bench is not the only thing that draws this protein — the
         gallery card does too, and a colour decision kept on one page means
         the card and the bench show the same molecule two ways.

         KEYED BY STRAND NAME, not by chain id, so it says something about the
         MOLECULE: a homotrimer's three interchangeable chains get three
         colours because the subject is the braid, and 3HR2's two α1 chains get
         the same one because they are two copies of one gene product. A chain
         id would only have said "the third one".

         NOT palette.js's business. That file owns what an ATOM is coloured,
         which is a fact about chemistry every page must agree on; this is a
         page distinguishing three identical polymers, which is a fact about
         nothing but legibility. It is the house green and rust from
         protein-test.css with a blue to complete the set, and grey for a chain
         that is not collagen at all. */
      draw: { byStrand: {
        'chain 1': 0x1f5f4f,          // deep green, the house accent
        'chain 2': 0xe2643a,          // rust
        'chain 3': 0x2f6f9f,          // blue
        'α1(I)':   0x1f5f4f,
        'α2(I)':   0xe2643a,
        'Hsp47':   0x9aa0a6,          // grey: present, and not the subject
        'integrin α2 I': 0x9aa0a6,
      } },
      ss: { deposited: false, some: true,
            why: 'polyproline II is neither of the two things a HELIX or SHEET '
               + 'record describes, so all-coil is the correct read and the '
               + 'bench tells the strands apart by colour instead' },
      variants: COLLAGEN_VARIANTS,
    },
    {
      key: 'rnase', name: 'Ribonuclease A', dir: 'proteins/rnase',
      blurb: '124 residues that cut RNA, and the most-studied enzyme of the '
           + 'twentieth century. The protein Anfinsen unfolded and watched '
           + 'come back.',
      /* EC 3.1.27.5, in the file's own COMPND record. */
      does: 'enzyme',
      pipeline: 'trace',
      /* Not superposed, and this is the interesting case: these are not states
         of one thing. 1DFJ's subject is the assembly and the dimers' is the
         pairing, so fitting by the enzyme chain would pin the 124-residue
         monomer and let the 456-residue horseshoe land wherever it fell. */
      fit: null,
      fitWhy: 'different objects, not states of one: the complex and the '
            + 'dimers are about what the enzyme is attached to',
      view: { by: 'deposited', shared: false,
              why: 'no shared frame, so a hand-picked basis would be right '
                 + 'for one variant and wrong for the other six' },
      surface: { bake: false,
                 why: 'fold claims, except 1DFJ — the one genuine surface '
                    + 'claim here, worth a bake only if a lesson is about '
                    + 'the inhibitor' },
      variants: RNASE_VARIANTS,
    },
    {
      key: 'myoglobin', name: 'Myoglobin', dir: 'proteins/myoglobin',
      blurb: 'One iron atom, wrapped in 153 residues. The first protein '
           + 'structure ever solved, and still the clearest binding site '
           + 'there is.',
      does: 'oxygen carrier',
      pipeline: 'trace',
      /* THE DEFAULT AND THE REFERENCE ARE DIFFERENT VARIANTS HERE, and that is
         not an oversight: they answer different questions. The default is what
         the collection opens on and what a card shows — 1MBN, because the
         first protein structure anyone ever saw is what myoglobin is FOR in
         this repo. The reference is what everything is superposed onto, and
         that has to be deoxy: the empty site is the state every other view is
         a change FROM, and fitting onto an occupied one would put that file's
         ligand at the origin of the comparison it is one side of. */
      fit: { on: '1BZP', by: 'heme' },
      fitWhy: 'states of one site; the heme matches by atom name across files '
            + 'whose residue numbering does not correspond',
      /* One basis covers all seven BECAUSE they share a frame. A human turned
         the molecule on the bench and pasted this; a solved basis for a bundle
         this round would flip between re-bakes. */
      view: { by: 'human', shared: true,
              basis: [[-0.5342, 0.633, -0.5604],
                      [0.8271, 0.5283, -0.1917],
                      [0.1747, -0.5659, -0.8058]] },
      surface: { bake: false,
                 why: 'the claim is the site, and an SES seals the pocket shut' },
      variants: MYOGLOBIN_VARIANTS,
    },
  ];

  const byKey = key => PROTEINS.find(p => p.key === key) || null;
  /* THE VARIANT A PROTEIN OPENS ON, and the one a card shows. Required, not
     inferred: falling back to the first entry would mean the choice is
     wherever the list happens to start, and re-ordering the list would
     silently re-aim every bench and every card. `check-proteins.js` fails a
     protein with none, and the fix is to mark one — the first entry, if
     nothing else earns it. */
  const defaultOf = p => p.variants.find(v => v.default) || null;

  /* THE PROTEIN'S EC NUMBER, agreed across its variants. Read per variant off
     each deposition, because that is where it is written, and asked for per
     PROTEIN because that is what it describes — every entry of ribonuclease A
     says 3.1.27.5, and one that said something else would mean a variant is
     filed under the wrong protein. `check-proteins.js` fails that disagreement
     rather than letting this pick a winner.

     Null is an answer: haemoglobin carries oxygen and catalyses nothing. */
  function ecOf(p) {
    const seen = [...new Set(p.variants.map(v => v.read && v.read.ec).filter(Boolean))];
    return seen.length === 1 ? seen[0] : null;
  }

  /* What the first digit of an EC number means, for a page that wants to say
     it in words. The same table bake-lib.js keeps for Node. */
  const EC_CLASS = [null,
    ['oxidoreductase', 'moving electrons'],
    ['transferase', 'moving a group from one molecule to another'],
    ['hydrolase', 'cutting a bond with water'],
    ['lyase', 'cutting without water, or adding across a double bond'],
    ['isomerase', 'rearranging one molecule'],
    ['ligase', 'joining two, paying with ATP'],
    ['translocase', 'moving something across a membrane']];
  const variantOf = (p, id) => p.variants.find(v => v.id === id) || null;

  /* THE `colors` A BOX NEEDS FOR ONE VARIANT, built from the protein's strand
     table and that variant's chain names — or null, which is every protein
     that has no reason to colour its chains apart and should therefore be
     drawn the repo's one way.

     A FUNCTION RATHER THAN A FIELD PER VARIANT, because the mapping is
     mechanical and the two halves have different owners: which strand a chain
     IS belongs to the variant, what a strand is coloured belongs to the
     protein. Every consumer calling this is what stops a bench and a gallery
     card becoming two opinions about the same molecule. */
  function colorsOf(p, v) {
    const map = p.draw && p.draw.byStrand;
    if (!map || !v || !v.strands) return null;
    const byChain = {};
    for (const [ch, strand] of Object.entries(v.strands))
      if (map[strand] != null) byChain[ch] = map[strand];
    return Object.keys(byChain).length ? { byChain } : null;
  }

  /* Both URLs a bench shows, derived from `source` so an id and its links
     cannot disagree. A `repo` source has no remote entry of its own — it is a
     chain lifted out of a file another page already holds — so it points at
     the entry it came from and says where the local copy lives. */
  function urls(v) {
    const s = v.source || { kind: 'rcsb', id: v.id };
    if (s.kind === 'alphafold') return {
      entry: 'https://alphafold.ebi.ac.uk/entry/' + s.id,
      file: 'https://alphafold.ebi.ac.uk/files/AF-' + s.id + '-F1-model_v4.pdb',
    };
    return {
      entry: 'https://www.rcsb.org/structure/' + s.id,
      file: 'https://files.rcsb.org/download/' + s.id + '.pdb',
      local: s.kind === 'repo' ? s.path : null,
    };
  }

  /* `fiber diffraction` is spelled the way EXPDTA spells it, like every other
     entry here: the baker lower-cases what the file says, and a registry that
     Anglicised it would fail its own checker against the deposition. It is a
     MEASURED method and a coarse one — 3HR2 is a 5.2 Å molecular envelope,
     which its own bake records; this list only says which KIND of claim it
     is. */
  const MEASURED = ['x-ray diffraction', 'solution nmr', 'electron microscopy',
                    'neutron diffraction', 'fiber diffraction'];
  const METHODS = MEASURED.concat(['predicted']);

  /* WHAT THE PROTEIN DOES, in one word the collection can be sorted on. A
     vocabulary rather than free text for the same reason `method` is one:
     'enzyme' and 'an enzyme' would split the group in two on a filter and
     nobody would see it happen.

     `unknown` is a real answer and not a gap to fill in later. PrP is the
     case — what its healthy form is FOR has been argued for forty years —
     and a collection that guessed would be teaching one side of that.

     `structural` is the answer for a protein whose job is to HOLD, and it is
     not a synonym for 'no function': collagen does one thing, mechanically,
     and does it as material rather than as chemistry. It is the first entry
     here that catalyses nothing and carries nothing. */
  const DOES = ['enzyme', 'oxygen carrier', 'unknown', 'structural'];

  global.ProteinLib = { PROTEINS, METHODS, MEASURED, DOES, EC_CLASS,
                        byKey, defaultOf, ecOf,
                        variantOf, colorsOf, urls };
  if (typeof module === 'object' && module.exports)
    module.exports = global.ProteinLib;
})(typeof window !== 'undefined' ? window : globalThis);
