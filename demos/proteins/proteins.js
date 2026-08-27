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
 *  WHAT IS NOT HERE. Hemoglobin and the sickle fibre are real structures with
 *  variants of their own, and they are deliberately out: their bakers feed the
 *  folding trajectory and this file's re-bake does not reach them. They join
 *  the day someone gives them a `pipeline` that does.
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
        baked: "rnase-1DFJ.json" } },
  ];

  const PROTEINS = [
    {
      key: 'prion', name: 'Prion protein', dir: 'proteins/prion',
      blurb: 'One sequence, two shapes: the healthy human fold and the disease '
           + 'fold, as deposited. The stack is the reason it spreads.',
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
      keeps: ['1QLZ.pdb', '1QLZ-model1.pdb', '6LNI.pdb',
              'prp-native.pdb', 'prp-fibril.pdb', 'prp-stack.pdb',
              'prp-view-1QLZ.pdb', 'prp-view-6LNI.pdb', 'prp-view-stack.pdb',
              /* Baked and drawn by nothing today: twenty NMR models as twenty
                 chains, which says the native state is a FAMILY. The bench
                 does not offer it — see prep.js on why it was measured and
                 then not shown. */
              'prp-view-ensemble.pdb'],
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
      key: 'hemoglobin', name: 'Haemoglobin', dir: 'hemoglobin',
      blurb: 'Four myoglobins that learned to talk to each other. One oxygen '
           + 'binding pulls the whole tetramer into the shape that binds the '
           + 'next three more easily.',
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
            baked: "2HBS-T1-quaternary.json" } },
      ],
    },
    {
      key: 'rnase', name: 'Ribonuclease A', dir: 'proteins/rnase',
      blurb: '124 residues that cut RNA, and the most-studied enzyme of the '
           + 'twentieth century. The protein Anfinsen unfolded and watched '
           + 'come back.',
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
  const variantOf = (p, id) => p.variants.find(v => v.id === id) || null;

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

  const MEASURED = ['x-ray diffraction', 'solution nmr', 'electron microscopy',
                    'neutron diffraction'];
  const METHODS = MEASURED.concat(['predicted']);

  global.ProteinLib = { PROTEINS, METHODS, MEASURED, byKey, defaultOf,
                        variantOf, urls };
  if (typeof module === 'object' && module.exports)
    module.exports = global.ProteinLib;
})(typeof window !== 'undefined' ? window : globalThis);
