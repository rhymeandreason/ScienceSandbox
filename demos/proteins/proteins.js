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
 *    said   everything outside `read` — purpose, claim, prov, which chains,
 *           which residues make the pocket. A HUMAN's, and a re-bake never
 *           touches it.
 *    read   inside `read: {}` — method, resolution, residue counts, ligands,
 *           the fit residuals, the file that was written. THE BAKER's, and
 *           rewritten from the deposition on every re-bake.
 *
 *  That split is why a card can print "1.0 Å, x-ray diffraction, 151 of 151
 *  residues" without a human ever typing a number that a re-bake could
 *  falsify. `proteins/tools/registry-io.js` is the one place that knows how to
 *  splice a `read` block back in; it runs this file rather than parsing it,
 *  the same way `tools/mapcontent-io.js` handles the door map, so the prose
 *  around the data cannot be lost to a save.
 *
 *  METHOD IS A CONTROLLED VOCABULARY, and the reason is not tidiness:
 *
 *    'x-ray diffraction' · 'solution nmr' · 'electron microscopy' ·
 *    'neutron diffraction'          — MEASURED, and carry a resolution
 *    'predicted'                    — carries `plddt`, never a resolution
 *
 *  A predicted structure is a different kind of claim from a measured one, and
 *  a collection that lets the two read alike is a collection that will
 *  eventually show a student a guess as a fact. check-proteins.js fails a
 *  `predicted` variant carrying a resolution, and a measured one without.
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
      section: 'human', label: 'native fold', chip: 'healthy',
      source: { kind: 'rcsb', id: '1QLZ' },
      state: 'healthy', form: 'PrP\u1D9C',
      claim: 'Human PrP in its healthy form, a compact helical bundle.',
      prov:  'Recombinant human protein, folded as it is in a healthy cell.',
      read: {
        method: "solution nmr",
        resolution: null,
        chainsInFile: 1,
        chainsDrawn: 1,
        residues: 104,
        baked: "prp-view-1QLZ.pdb",
        bytes: 138514 } },
    { id: '6LNI',
      purpose: 'one rung of the disease fibril',
      section: 'human', label: 'fibril rung', chip: 'disease',
      source: { kind: 'rcsb', id: '6LNI' },
      state: 'disease', form: 'PrP\u02E2\u1D9C',
      claim: 'Human PrP in its disease form, one flat rung of a fibril.',
      prov:  'Disease fold, grown in vitro from recombinant protein. Not taken '
           + 'from a sick brain.',
      read: {
        method: "electron microscopy",
        resolution: 2.7,
        chainsInFile: 10,
        chainsDrawn: 1,
        residues: 600,
        baked: "prp-view-6LNI.pdb",
        bytes: 41719 } },
    { id: 'stack', of: '6LNI',
      purpose: 'ten rungs, which is why it spreads',
      section: 'human', label: '6LNI stacked', chip: 'disease',
      source: { kind: 'rcsb', id: '6LNI' },
      state: 'disease', form: 'PrP\u02E2\u1D9C',
      claim: 'The same fibril, all ten deposited chains.',
      prov:  'The same in vitro fibril, all ten deposited chains.',
      read: {
        method: "electron microscopy",
        resolution: 2.7,
        chainsInFile: 10,
        chainsDrawn: 10,
        residues: 600,
        baked: "prp-view-stack.pdb",
        bytes: 400387 } },
  ];

  const MYOGLOBIN_VARIANTS = [
    { id: '1MBN',
      purpose: 'the first protein structure ever solved',
      section: 'where it came from', label: 'Kendrew, 1960', chip: 'first',
      source: { kind: 'rcsb', id: '1MBN' },
      chains: 'A',
      pocket: { prox: 93, dist: 64 },
      claim: 'Kendrew’s myoglobin: the first protein structure anyone ever saw.',
      prov:  'Sperm whale, X-ray at 2.0 A. The 1958 model was a 6 A blob that showed '
             + 'only the sausage of the chain; this is the refined coordinate set that '
             + 'came out of the same work. The iron carries a hydroxide — the protein '
             + 'has been oxidised and cannot bind O2 in this state.',
      read: {
        method: "x-ray diffraction",
        resolution: 2,
        title: "THE STEREOCHEMISTRY OF THE PROTEIN MYOGLOBIN",
        chainsInFile: 1,
        residues: 153,
        declared: 153,
        helices: 8,
        strands: 0,
        heme: 43,
        bound: ["OH"],
        fitOn: "1BZP",
        fitAtoms: 43,
        fitRmsd: 0.601,
        caRmsd: 0.65,
        extents: [43.85,40.55,21.4],
        frame: "chosen by hand, shared by all seven",
        baked: "mb-1MBN.json",
        bytes: 8869 } },
    { id: '1BZP', default: true,
      purpose: 'the site with nothing in it',
      section: 'the site, four states', label: 'empty · deoxy', chip: '1.15 Å',
      source: { kind: 'rcsb', id: '1BZP' },
      chains: 'A',
      pocket: { prox: 93, dist: 64 },
      claim: 'Deoxy myoglobin: the site with nothing in it.',
      prov:  'Sperm whale, 1.15 A. The iron sits slightly out of the porphyrin plane, '
             + 'pulled towards the histidine below it. This is the state that is '
             + 'waiting.',
      read: {
        method: "x-ray diffraction",
        resolution: 1.15,
        title: "ATOMIC RESOLUTION CRYSTAL STRUCTURE ANALYSIS OF NATIVE DEOXY AND CO",
        chainsInFile: 1,
        residues: 153,
        declared: 153,
        helices: 8,
        strands: 0,
        heme: 43,
        bound: null,
        fitOn: null,
        fitAtoms: null,
        fitRmsd: null,
        caRmsd: null,
        extents: [43.55,39.66,21.35],
        frame: "chosen by hand, shared by all seven",
        baked: "mb-1BZP.json",
        bytes: 8877 } },
    { id: '1A6M',
      purpose: 'oxygen bound',
      section: 'the site, four states', label: 'oxygen bound', chip: 'O₂',
      source: { kind: 'rcsb', id: '1A6M' },
      chains: 'A',
      pocket: { prox: 93, dist: 64 },
      claim: 'Oxygen bound: what myoglobin is for.',
      prov:  'Sperm whale, 1.0 A — among the sharpest protein structures there are. '
             + 'The O2 comes in at an angle and is held there by the distal histidine, '
             + 'which is why the site binds oxygen well and carbon monoxide less well '
             + 'than a bare iron would.',
      read: {
        method: "x-ray diffraction",
        resolution: 1,
        title: "OXY-MYOGLOBIN, ATOMIC RESOLUTION",
        chainsInFile: 1,
        residues: 151,
        declared: 151,
        helices: 8,
        strands: 0,
        heme: 43,
        bound: ["OXY"],
        fitOn: "1BZP",
        fitAtoms: 43,
        fitRmsd: 0.101,
        caRmsd: 0.5,
        extents: [43.03,39.42,20.67],
        frame: "chosen by hand, shared by all seven",
        baked: "mb-1A6M.json",
        bytes: 8919 } },
    { id: '1MBC',
      purpose: 'carbon monoxide in the same place',
      section: 'the site, four states', label: 'carbon monoxide', chip: 'CO',
      source: { kind: 'rcsb', id: '1MBC' },
      chains: 'A',
      pocket: { prox: 93, dist: 64 },
      claim: 'Carbon monoxide in the same place: poisoning, as a structure.',
      prov:  'Sperm whale, 1.5 A. CO binds this site far more tightly than O2 and does '
             + 'not let go, so the protein is full and useless. The distal histidine is '
             + 'what keeps the ratio from being far worse than it is.',
      read: {
        method: "x-ray diffraction",
        resolution: 1.5,
        title: "X-RAY STRUCTURE AND REFINEMENT OF CARBON-MONOXY (FE II)-MYOGLOBIN AT",
        chainsInFile: 1,
        residues: 153,
        declared: 153,
        helices: 8,
        strands: 0,
        heme: 43,
        bound: ["CMO"],
        fitOn: "1BZP",
        fitAtoms: 43,
        fitRmsd: 0.18,
        caRmsd: 0.74,
        extents: [43.02,39.81,21.16],
        frame: "chosen by hand, shared by all seven",
        baked: "mb-1MBC.json",
        bytes: 8943 } },
    { id: '1ABS',
      purpose: 'the CO cut loose by light, frozen mid-escape',
      section: 'the site, four states', label: 'CO cut loose by light', chip: '20 K',
      source: { kind: 'rcsb', id: '1ABS' },
      chains: 'A',
      pocket: { prox: 93, dist: 64 },
      claim: 'The same CO, cut loose by light and frozen before it could leave.',
      prov:  'Sperm whale, 1.5 A at 20 kelvin. A laser broke the Fe-CO bond and the '
             + 'crystal was held cold enough that the CO stopped in a pocket beside the '
             + 'iron instead of escaping. A reaction intermediate, held still and '
             + 'measured.',
      read: {
        method: "x-ray diffraction",
        resolution: 1.5,
        title: "PHOTOLYSED CARBONMONOXY-MYOGLOBIN AT 20 K",
        chainsInFile: 1,
        residues: 154,
        declared: 154,
        helices: 8,
        strands: 0,
        heme: 43,
        bound: ["CMO"],
        fitOn: "1BZP",
        fitAtoms: 43,
        fitRmsd: 0.505,
        caRmsd: 1.24,
        extents: [42.55,40.12,20.94],
        frame: "chosen by hand, shared by all seven",
        baked: "mb-1ABS.json",
        bytes: 8967 } },
    { id: '1YMB',
      purpose: 'another animal, the same answer',
      section: 'relatives', label: 'horse heart', chip: '1 chain',
      source: { kind: 'rcsb', id: '1YMB' },
      chains: 'A',
      pocket: { prox: 93, dist: 64 },
      claim: 'Horse heart myoglobin: another animal, the same answer.',
      prov:  'X-ray at 1.9 A. About a fifth of the sequence differs from the whale’s '
             + 'and the fold does not care. The residues that do not change are the ones '
             + 'lining the pocket.',
      read: {
        method: "x-ray diffraction",
        resolution: 1.9,
        title: "HIGH RESOLUTION STUDY OF THE THREE-DIMENSIONAL STRUCTURE OF HORSE",
        chainsInFile: 1,
        residues: 153,
        declared: 153,
        helices: 8,
        strands: 0,
        heme: 43,
        bound: null,
        fitOn: "1BZP",
        fitAtoms: 43,
        fitRmsd: 0.534,
        caRmsd: 0.87,
        extents: [43.58,40.31,21.11],
        frame: "chosen by hand, shared by all seven",
        baked: "mb-1YMB.json",
        bytes: 8793 } },
    { id: '2HHB-B',
      purpose: 'the same fold, doing a job a monomer cannot',
      section: 'relatives', label: 'haemoglobin β', chip: '1 of 4',
      source: { kind: 'repo', id: '2HHB', path: 'hemoglobin/data/2HHB.pdb' },
      chains: 'B',
      pocket: { prox: 92, dist: 63 },
      claim: 'One beta chain of haemoglobin: the same fold, doing a job myoglobin '
             + 'cannot.',
      prov:  'Human, 1.74 A, read from the file hemoglobin-lab already uses. Myoglobin '
             + 'holds oxygen; haemoglobin passes it on, and the difference is not in '
             + 'this chain — it is in having four of them that talk to each other.',
      read: {
        method: "x-ray diffraction",
        resolution: 1.74,
        title: "THE CRYSTAL STRUCTURE OF HUMAN DEOXYHAEMOGLOBIN AT 1.74 ANGSTROMS",
        chainsInFile: 4,
        residues: 146,
        declared: 146,
        helices: 8,
        strands: 0,
        heme: 43,
        bound: null,
        fitOn: "1BZP",
        fitAtoms: 43,
        fitRmsd: 0.99,
        caRmsd: null,
        extents: [43.6,38.54,19.36],
        frame: "chosen by hand, shared by all seven",
        baked: "mb-2HHB-B.json",
        bytes: 8633 } },
  ];

  const RNASE_VARIANTS = [
    { id: '1FS3', default: true,
      purpose: 'the fold by itself',
      section: 'the fold', label: 'crystal', chip: '1 chain',
      source: { kind: 'rcsb', id: '1FS3' },
      claim: 'Bovine pancreatic RNase A, wild type, nothing bound.',
      prov:  'X-ray at 1.4 A. The reference fold: three helices over a long curled '
             + 'sheet, four disulfides.',
      read: {
        method: "x-ray diffraction",
        resolution: 1.4,
        title: "CRYSTAL STRUCTURE OF WILD-TYPE BOVINE PANCREATIC RIBONUCLEASE A",
        models: 0,
        chainsInFile: 1,
        chainsDrawn: 1,
        residues: 124,
        declared: 124,
        disulfides: 4,
        ligands: [],
        extents: [38.74,30.61,25.6],
        frame: "computed",
        baked: "rnase-1FS3.json",
        bytes: 3290 } },
    { id: '2AAS',
      purpose: 'the same fold in solution',
      section: 'the fold', label: 'solution, NMR', chip: '1 chain',
      source: { kind: 'rcsb', id: '2AAS' },
      model: 1,
      claim: 'The same protein in solution, by NMR.',
      prov:  '32 deposited models; this is model 1, and it is not more real than model '
             + '12. The crystal fold and the solution fold agree.',
      read: {
        method: "solution nmr",
        resolution: null,
        title: "HIGH-RESOLUTION THREE-DIMENSIONAL STRUCTURE OF RIBONUCLEASE A IN",
        models: 32,
        chainsInFile: 1,
        chainsDrawn: 1,
        residues: 124,
        declared: 124,
        disulfides: 4,
        ligands: [],
        extents: [38.53,30.22,27.64],
        frame: "deposited",
        baked: "rnase-2AAS.json",
        bytes: 3218 } },
    { id: '1RUV',
      purpose: 'the transition state, held still',
      section: 'working', label: 'transition state', chip: '1 chain',
      source: { kind: 'rcsb', id: '1RUV' },
      claim: 'Uridine vanadate in the active site — the transition state, held still.',
      prov:  'X-ray at 1.25 A. Vanadium fakes the five-coordinate phosphorus RNA '
             + 'passes through, so the enzyme cannot finish the reaction and will not '
             + 'let go.',
      read: {
        method: "x-ray diffraction",
        resolution: 1.25,
        title: "RIBONUCLEASE A-URIDINE VANADATE COMPLEX: HIGH RESOLUTION RESOLUTION X-",
        models: 0,
        chainsInFile: 1,
        chainsDrawn: 1,
        residues: 124,
        declared: 124,
        disulfides: 4,
        ligands: ["UVC","TBU"],
        extents: [38.76,30.35,25.68],
        frame: "computed",
        baked: "rnase-1RUV.json",
        bytes: 3301 } },
    { id: '1RNU',
      kind: 'cut',
      purpose: 'cut in two and still working',
      section: 'taken apart', label: 'cut in two · RNase S', chip: '1 chain',
      source: { kind: 'rcsb', id: '1RNU' },
      claim: 'RNase S: one backbone bond cut, and the protein still works.',
      prov:  'Subtilisin cuts between residues 20 and 21. The 20-residue S-peptide '
             + 'stays bound to the S-protein and the pair is active. Residues 16-23 are '
             + 'unmodelled, so the gap drawn is wider than the cut.',
      read: {
        method: "x-ray diffraction",
        resolution: 1.6,
        title: "REFINEMENT OF THE CRYSTAL STRUCTURE OF RIBONUCLEASE S. COMPARISON WITH",
        models: 0,
        chainsInFile: 1,
        chainsDrawn: 1,
        residues: 116,
        declared: 124,
        disulfides: 4,
        ligands: ["SO4"],
        extents: [39.48,31.93,27.48],
        frame: "deposited",
        baked: "rnase-1RNU.json",
        bytes: 3049 } },
    { id: '1A2W',
      kind: 'swap',
      purpose: 'the C-terminal half traded',
      section: 'taken apart', label: 'C-terminal swap', chip: '2 chains',
      source: { kind: 'rcsb', id: '1A2W' },
      chains: 'A,B',
      claim: 'Two molecules, each folded around the other’s C-terminal strand.',
      prov:  'Domain swapping: the same contacts as the monomer, made between chains '
             + 'instead of within one. The hinge is the loop around 112-115.',
      read: {
        method: "x-ray diffraction",
        resolution: 2.1,
        title: "CRYSTAL STRUCTURE OF A 3D DOMAIN-SWAPPED DIMER OF BOVINE PANCREATIC",
        models: 0,
        chainsInFile: 2,
        chainsDrawn: 2,
        residues: 248,
        declared: 248,
        disulfides: 8,
        ligands: ["CL ×2","SO4"],
        extents: [70.24,43.28,30.77],
        frame: "computed",
        baked: "rnase-1A2W.json",
        bytes: 6427 } },
    { id: '1F0V',
      kind: 'swap',
      purpose: 'the N-terminal half traded',
      section: 'taken apart', label: 'N-terminal swap', chip: '2 chains',
      source: { kind: 'rcsb', id: '1F0V' },
      chains: 'A,B',
      claim: 'The other swap: the N-terminal helix traded instead.',
      prov:  'Chains A and B of a deposition holding two dimers, with a CpG '
             + 'dinucleotide bound on chains M-P, which the bench does not draw. One '
             + 'protein, two different ways to come apart and re-fold as a pair.',
      read: {
        method: "x-ray diffraction",
        resolution: 1.7,
        title: "CRYSTAL STRUCTURE OF AN RNASE A DIMER DISPLAYING A NEW TYPE OF 3D",
        models: 0,
        chainsInFile: 8,
        chainsDrawn: 2,
        residues: 248,
        declared: 248,
        disulfides: 8,
        ligands: ["PO4 ×2","GOL ×15"],
        extents: [80.28,35.87,35.21],
        frame: "deposited",
        baked: "rnase-1F0V.json",
        bytes: 6517 } },
    { id: '1DFJ',
      kind: 'bound',
      purpose: 'caught by the protein that keeps it off our RNA',
      section: 'working', label: 'held by its inhibitor', chip: '2 chains',
      source: { kind: 'rcsb', id: '1DFJ' },
      claim: 'RNase A held by ribonuclease inhibitor, the protein that keeps it off '
             + 'your own RNA.',
      prov:  'A 456-residue leucine-rich horseshoe closing on a 124-residue enzyme. '
             + 'One of the tightest protein-protein complexes known.',
      read: {
        method: "x-ray diffraction",
        resolution: 2.5,
        title: "RIBONUCLEASE INHIBITOR COMPLEXED WITH RIBONUCLEASE A",
        models: 0,
        chainsInFile: 2,
        chainsDrawn: 2,
        residues: 580,
        declared: 581,
        disulfides: 4,
        ligands: ["ACE","SO4"],
        extents: [65.34,59.73,43.17],
        frame: "deposited",
        baked: "rnase-1DFJ.json",
        bytes: 14697 } },
  ];

  const PROTEINS = [
    {
      key: 'prion', name: 'Prion protein', dir: 'proteins/prion',
      blurb: 'One sequence, two shapes: the healthy human fold and the disease '
           + 'fold, as deposited. The stack is the reason it spreads.',
      /* The bench parses reduced PDB text at runtime with PrionLib rather than
         loading a trace, so its baker writes files this registry describes but
         does not shape. `pipeline:'pdb'` is what tells check-proteins.js to
         expect a .pdb per variant instead of a .json. */
      pipeline: 'pdb',
      /* What else lives in data/ and is not a variant. Prion COMMITS its
         sources (they are small once cut to model 1) and its baker writes
         two intermediates the views are sliced out of. Listing them is what
         lets check-proteins.js flag a file that is in data/ for no reason —
         a stale bake from a renamed view, which a bench goes on loading. */
      keeps: ['1QLZ.pdb', '1QLZ-model1.pdb', '6LNI.pdb',
              'prp-native.pdb', 'prp-fibril.pdb', 'prp-stack.pdb',
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
      /* Four states of one site, so they share a frame — fitted on the HEME by
         atom name, which also matches a whale's myoglobin to a beta chain of
         haemoglobin, where residue numbering does not correspond at all. */
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
  const defaultOf = p => p.variants.find(v => v.default) || p.variants[0];
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
