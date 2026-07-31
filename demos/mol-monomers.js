/* =====================================================================
 *  mol-monomers.js — the macromolecule monomers: amino acids, lipid, nucleotide
 * ===================================================================== */
(function(global){
  'use strict';
  const SELFNAME = 'mol-monomers.js';
  // Registry from molecules.js. Domain files only ever ADD to it.
  const Lib = global.MolLib
    || (typeof require === 'function' ? require('./molecules.js').MolLib : null);
  if (!Lib) throw new Error(SELFNAME + ': molecules.js must be loaded first');
  const { MOLECULES, VIEW } = Lib;

  // FAMILY B, but NO builder: these are PubChem conversions (the amino acids,
  // amp) and hand-derived literals (palmitate). The carbohydrate monomer is
  // glucose, which lives in mol-glycolysis.js — one glucose in the library.
  Object.assign(MOLECULES, {
    // ---- amino acids ----------------------------------------------------
    // Shared backbone, laid out left→right so a chain grows along +X:
    //   amino end (−X)  H₂N–Cα–COOH  carboxyl end (+X)
    //   0 N   1 H   2 H       (amino group; an H leaves in condensation)
    //   3 Cα  4 H              (α-carbon; 4 is the backbone H)
    //   5 C   6 O(=O)  7 O(–OH)  8 H   (carboxyl; the –OH, atoms 7+8, leaves)
    //   9…    side chain (R), bonded to Cα (atom 3), splayed −Y
    // `pep` names the atoms the peptide-bond reaction acts on (aminoacid-lab.html):
    //   cC carboxyl carbon · oOH/hOH the leaving hydroxyl · nN amino N · hN amino H's.
    // Only the ANGLES/topology carry the lesson; bond lengths are stylised as
    // elsewhere (must exceed the two display radii so the stick shows).
    // Zwitterion form is skipped on purpose — the neutral –NH₂/–COOH makes the
    // "lose a water" bookkeeping legible; note this is a display simplification.
    // Handedness: life builds proteins from L-amino acids only (the D- mirror
    // images exist but ribosomes don't use them), so every chiral residue
    // declares `chirality:'L'` and check-molecules.js verifies the signed
    // volume over CIP priorities. optH lists only nonpolar C–H — an H on
    // N/O/S is never in it, since those are the H-bond donors and the leaving
    // groups a peptide bond consumes, and hiding them would hide the lesson.
    // ---- generated from PubChem 3D records (see tools/sdf2spec.js) --------
    // Coordinates are REAL conformers: correct angles (Ca is tetrahedral, ~110°,
    // not the 180° the old hand-written specs drew) and genuinely non-planar,
    // unlike the flat z=0 layouts elsewhere in this file. One global 1.9x scale
    // is applied so every stick clears the enlarged display radii — relative
    // bond lengths stay truthful, which the old per-pair guesses did not.
    // Bond ORDERS come straight from the SDF bond block, so the carboxyl C=O
    // is tagged [i,j,2] without anyone having to notice it by hand.
    // Re-generate rather than hand-editing these numbers.
    glycine: {
      name:'Glycine', formula:'C₂H₅NO₂', class:'aminoacid', res:'Gly', side:'–H',
      // Re-verified 2026-07-30 against the committed sdf/glycine.sdf: 0.000
      // coordinate delta, bonds identical. `query` is kept because it records how
      // this was originally asked for; `cid` is what now identifies it.
      src:{path:'pubchem', cid:750, query:'glycine', record:'3d',
           conformer:'000002EE00000001', sdf:'glycine.sdf',
           tool:'sdf2spec', regen:'exact', fetched:'2026-07-30'},
      atoms:[ {el:'N',pos:[-2.225,0.942,1.34]},
              {el:'H',pos:[-2.194,2.878,1.394]},
              {el:'H',pos:[-2.195,0.34,3.18]},
              {el:'C',pos:[0,0,0]},
              {el:'H',pos:[-0.006,0.705,-1.954]},
              {el:'C',pos:[2.341,0.942,1.34]},
              {el:'O',pos:[2.294,2.285,3.239]},
              {el:'O',pos:[4.526,0.214,0.179]},
              {el:'H',pos:[6.032,0.873,1.056]},
              {el:'H',pos:[-0.002,-2.077,0]} ],
      names:['N','H','H2','CA','HA1','C','O','OXT','HXT','HA2'],
      smiles:'O=C(O)C[NH2:1]',
      bonds:[ [0,1],[0,2],[0,3],[3,4],[3,5],[3,9],[5,6,2],[5,7],[7,8] ],
      optH:[4,9],   // nonpolar C–H, hidden by the lab’s H toggle
      // glycine is ACHIRAL: its side chain is an H, so Ca has two identical
      // substituents and there is no L/D to assert.
      pep:{ cC:5, oOH:7, hOH:8, nN:0, hN:[1,2] },
      // contrast-lab.html: glycine is the free-N-H reference half of the
      // glycine-proline pair (see proline's own contrast block below for
      // why alanine couldn't take this slot — it's already D-alanine's
      // partner). Glycine has the plainest possible side chain, so the only
      // thing left to contrast is the backbone nitrogen itself.
      contrast:{ pair:'glycine-proline', partner:'proline',
        differs:'free vs ring-closed amino N',
        lesson:'why gluten resists digestion',
        diff:['N','H','H2'],
        note:'Glycine has no side chain to speak of — just an H — so its backbone '
           + 'nitrogen carries two ordinary N–H bonds and the chain stays free to '
           + 'straighten, which is the shape a digestive protease needs to grip. '
           + 'Proline’s side chain bonds back into that nitrogen and takes away '
           + 'both.' },
    },
    alanine: {
      name:'Alanine', formula:'C₃H₇NO₂', class:'aminoacid', res:'Ala', side:'–CH₃',
      // The name 'alanine' resolves to CID 5950, which is L-alanine — the right
      // one, but by PubChem's choice rather than ours. Now pinned to the CID, and
      // chirality:'L' below is the assertion that would catch it if that ever moved.
      src:{path:'pubchem', cid:5950, query:'alanine', record:'3d',
           conformer:'0000173E00000001', sdf:'alanine.sdf',
           tool:'sdf2spec', regen:'exact', fetched:'2026-07-30'},
      atoms:[ {el:'N',pos:[-2.227,0.979,-1.339]},
              {el:'H',pos:[-3.836,0.37,-0.449]},
              {el:'H',pos:[-2.301,0.234,-3.127]},
              {el:'C',pos:[0,0,0]},
              {el:'H',pos:[-0.008,0.747,1.942]},
              {el:'C',pos:[2.35,0.979,-1.339]},
              {el:'O',pos:[2.398,2.292,-3.255]},
              {el:'O',pos:[4.479,0.213,-0.095]},
              {el:'H',pos:[6.029,0.833,-0.924]},
              {el:'C',pos:[-0.054,-2.893,0]},
              {el:'H',pos:[1.547,-3.668,1.082]},
              {el:'H',pos:[-1.802,-3.612,0.87]},
              {el:'H',pos:[0.076,-3.662,-1.931]} ],
      names:['N','H','H2','CA','HA','C','O','OXT','HXT','CB','HB1','HB2','HB3'],
      smiles:'O=[C:1](O)[C@H:1]([CH3:1])[NH2:1]',
      bonds:[ [0,1],[0,2],[0,3],[3,4],[3,5],[3,9],[5,6,2],[5,7],[7,8],[9,10],[9,11],[9,12] ],
      optH:[4,10,11,12],   // nonpolar C–H, hidden by the lab’s H toggle
      chirality:'L',   // asserted by check-molecules.js — life is homochiral
      // contrast-lab.html: alanine is the L (reference) half of the L-/D-alanine
      // pair. Every atom position differs from D-alanine (a true mirror image,
      // not a rotation), so there is no single distinguishing atom the way
      // galactose's C4 is one — `diff` instead marks the whole stereocentre:
      // Cα and its four substituents, the group whose spatial arrangement is
      // the entire lesson.
      contrast:{ pair:'alanine-D-alanine', partner:'dAlanine',
        differs:'handedness',
        lesson:'why life is homochiral',
        diff:['CA','N','HA','C','CB'],
        note:'Every ribosome on Earth builds proteins from L-amino acids only. '
           + 'The choice of L over D looks like an early accident — but once '
           + 'translation locked onto one hand, every enzyme that reads a '
           + 'protein chain came to expect it, and a D-residue jams the machinery.' },
      pep:{ cC:5, oOH:7, hOH:8, nN:0, hN:[1,2] },
      // alanine doubles as the PROTEIN monomer in macromolecule-lab.html's
      // gallery, so it carries the same `groups` index map the other three
      // monomers do. Indices are the fixed backbone order (see above) —
      // regenerating this spec must not renumber them.
      mono:'protein',
      groups:[
        { key:'amino', label:'Amino group', formula:'–NH₂', atoms:[0,1,2],
          note:'The nitrogen end. Every amino acid has one, and it is where the next residue attaches.' },
        { key:'carboxyl', label:'Carboxyl group', formula:'–COOH', atoms:[5,6,7,8],
          note:'The acid end. Its –OH is what leaves as water when a peptide bond forms.' },
        { key:'alpha', label:'α-carbon', formula:'Cα', atoms:[3,4],
          note:'One carbon carrying all four: amino, carboxyl, an H, and the side chain. Four different groups means it is chiral — and life uses only the L form.' },
        { key:'side', label:'Side chain', formula:'R = –CH₃', atoms:[9,10,11,12],
          note:'The only part that differs between the twenty amino acids. Everything a protein does traces back to which R groups sit where.' },
      ],
    },
    serine: {
      name:'Serine', formula:'C₃H₇NO₃', class:'aminoacid', res:'Ser', side:'–CH₂OH',
      src:{path:'pubchem', cid:5951, query:'serine', record:'3d',
           conformer:'0000173F00000001', sdf:'serine.sdf',
           tool:'sdf2spec', regen:'exact', fetched:'2026-07-30'},
      atoms:[ {el:'N',pos:[-2.216,0.977,-1.36]},
              {el:'H',pos:[-2.211,0.344,-3.191]},
              {el:'H',pos:[-2.143,2.91,-1.44]},
              {el:'C',pos:[0,0,0]},
              {el:'H',pos:[-0.013,0.749,1.943]},
              {el:'C',pos:[2.345,0.977,-1.36]},
              {el:'O',pos:[2.545,1.381,-3.639]},
              {el:'O',pos:[4.272,1.35,0.317]},
              {el:'H',pos:[5.813,1.976,-0.524]},
              {el:'C',pos:[-0.047,-2.899,0]},
              {el:'O',pos:[2.112,-3.833,1.336]},
              {el:'H',pos:[-1.759,-3.637,0.924]},
              {el:'H',pos:[0.036,-3.669,-1.932]},
              {el:'H',pos:[2.018,-3.186,3.064]} ],
      names:['N','H','H2','CA','HA','C','O','OXT','HXT','CB','OG','HB1','HB2','HG'],
      bonds:[ [0,1],[0,2],[0,3],[3,4],[3,5],[3,9],[5,6,2],[5,7],[7,8],[9,10],[9,11],[9,12],[10,13] ],
      optH:[4,11,12],   // nonpolar C–H, hidden by the lab’s H toggle
      chirality:'L',   // asserted by check-molecules.js — life is homochiral
      pep:{ cC:5, oOH:7, hOH:8, nN:0, hN:[1,2] },
    },
    cysteine: {
      name:'Cysteine', formula:'C₃H₇NO₂S', class:'aminoacid', res:'Cys', side:'–CH₂SH',
      src:{path:'pubchem', cid:5862, query:'cysteine', record:'3d',
           conformer:'000016E600000001', sdf:'cysteine.sdf',
           tool:'sdf2spec', regen:'exact', fetched:'2026-07-30'},
      atoms:[ {el:'N',pos:[-2.223,1.021,-1.326]},
              {el:'H',pos:[-2.255,2.949,-1.148]},
              {el:'H',pos:[-3.839,0.374,-0.477]},
              {el:'C',pos:[0,0,0]},
              {el:'H',pos:[-0.03,0.703,1.962]},
              {el:'C',pos:[2.347,1.021,-1.326]},
              {el:'O',pos:[2.892,0.517,-3.533]},
              {el:'O',pos:[3.833,2.497,0.178]},
              {el:'H',pos:[5.349,3.102,-0.722]},
              {el:'C',pos:[-0.089,-2.905,0]},
              {el:'S',pos:[2.665,-4.284,1.578]},
              {el:'H',pos:[-1.794,-3.58,0.985]},
              {el:'H',pos:[-0.139,-3.656,-1.941]},
              {el:'H',pos:[4.4,-3.554,-0.138]} ],
      names:['N','H','H2','CA','HA','C','O','OXT','HXT','CB','SG','HB1','HB2','HG'],
      bonds:[ [0,1],[0,2],[0,3],[3,4],[3,5],[3,9],[5,6,2],[5,7],[7,8],[9,10],[9,11],[9,12],[10,13] ],
      optH:[4,11,12],   // nonpolar C–H, hidden by the lab’s H toggle
      chirality:'L',   // asserted by check-molecules.js — life is homochiral
      pep:{ cC:5, oOH:7, hOH:8, nN:0, hN:[1,2] },
    },

    /* -------------------------------------------------------------------
     *  MACROMOLECULE MONOMERS  (macromolecule-lab.html)
     * -------------------------------------------------------------------
     *  One representative monomer per class, for the four-class comparison
     *  gallery. Two of the four are specs that already existed and were reused
     *  rather than duplicated: the protein monomer is `alanine` above, and the
     *  carbohydrate is `glucose` in the glycolysis section below. Only the
     *  lipid and the nucleotide are new.
     *
     *  Each carries a `groups` map: the functional groups the gallery labels,
     *  as {key, label, formula, atoms:[…], note}. This is the same kind of
     *  index contract as `pep` / `gly` (SCIENCE.md §1, rule 4) — the page
     *  addresses atoms by position, so a reindex would silently mislabel
     *  chemistry rather than crash. Regenerate; don't renumber by hand.
     * ------------------------------------------------------------------- */

    //  The CARBOHYDRATE monomer is `glucose`, built in the glycolysis section
    //  below — one glucose in the library, not two. It gained `groups`, `optH`
    //  and its C–H there rather than being duplicated here.
    //
    // — LIPID. SCHEMATIC ON PURPOSE (SCIENCE.md §1, "derive when shape carries
    //   the lesson; schematize when topology does"). A real palmitate conformer
    //   is floppy and renders as spaghetti; the lesson here is "long nonpolar
    //   tail, one small polar head", which an idealised all-anti zigzag shows
    //   far better. So: 16 carbons at a real 109.5° C–C–C, planar, united-atom
    //   (the CH₂'s are single C spheres, the same convention ethanol uses).
    //   SATURATED deliberately — SCIENCE.md §1 notes that nothing yet asserts a
    //   double bond is *cis*, and the cis kink is the entire point of the
    //   unsaturated contrast, so that molecule waits for a torsion check.
    //   Drawn as the neutral acid so the –COOH head is legible; at cell pH it is
    //   really the carboxylate, palmitate.
    palmitate: {
      name:'Palmitic acid', formula:'C₁₆H₃₂O₂', class:'lipid', mono:'lipid',
      // NOT a PubChem conversion, despite sitting in family B — see the comment
      // above: an idealised all-anti zigzag at a real 109.5°, united-atom, worked
      // out once and baked in as literals. molecule-pipeline.md item 0 listed this
      // as a path-2 spec that failed to reproduce (32 fetched H vs 1 committed)
      // and read that as hydrogen stripping. It is not: the record was never the
      // source, and the H count is what united-atom MEANS. `path:'built'` is the
      // whole reason that misreading was possible.
      src:{path:'built', method:'all-anti zigzag, united-atom', charge:0},
      atoms:[ {el:'C',pos:[-15.099,-0.47,0]},
              {el:'C',pos:[-12.71,1.218,0]},
              {el:'C',pos:[-10.32,-0.47,0]},
              {el:'C',pos:[-7.931,1.218,0]},
              {el:'C',pos:[-5.541,-0.47,0]},
              {el:'C',pos:[-3.152,1.218,0]},
              {el:'C',pos:[-0.762,-0.47,0]},
              {el:'C',pos:[1.627,1.218,0]},
              {el:'C',pos:[4.017,-0.47,0]},
              {el:'C',pos:[6.406,1.218,0]},
              {el:'C',pos:[8.796,-0.47,0]},
              {el:'C',pos:[11.185,1.218,0]},
              {el:'C',pos:[13.575,-0.47,0]},
              {el:'C',pos:[15.964,1.218,0]},
              {el:'C',pos:[18.354,-0.47,0]},
              {el:'C',pos:[20.743,1.218,0]},
              {el:'O',pos:[-17.222,0.508,0]},
              {el:'O',pos:[-14.863,-3.043,0]},
              {el:'H',pos:[-13.065,-3.45,0]} ],
      names:['C1','C2','C3','C4','C5','C6','C7','C8','C9','C10','C11','C12','C13','C14','C15','C16','O1','O2','HO2'],
      smiles:'CCCCC[CH2:1][CH2:1][CH2:1][CH2:1]CCCCCCC(=O)O',
      bonds:[ [0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,10],
              [10,11],[11,12],[12,13],[13,14],[14,15],[0,16,2],[0,17],[17,18] ],
      hydrophobic:[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],
      groups:[
        { key:'carboxyl', label:'Carboxyl head', formula:'–COOH', atoms:[0,16,17,18],
          note:'The only polar part of the whole molecule — one water-friendly end on a sixteen-carbon chain.' },
        { key:'tail', label:'Hydrocarbon tail', formula:'–(CH₂)₁₄CH₃',
          atoms:[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],
          note:'Carbon and hydrogen only: no charge, no H-bonds. Water closes ranks and squeezes it out — that is what "hydrophobic" means.' },
        { key:'saturated', label:'Saturated', formula:'no C=C', atoms:[],
          note:'Every C–C is single, so the chain lies straight and packs tightly — solid at room temperature. One cis double bond would kink it, and that is an oil.' },
      ],
      // contrast-lab.html: palmitate is the saturated (reference) half of the
      // saturated/unsaturated pair. `diff` marks C9-C10 — the exact backbone
      // position that's a single bond here and palmitoleate's cis C=C there —
      // so the highlight lands on the same chain segment in both columns even
      // though only one of them kinks.
      contrast:{ pair:'palmitate-palmitoleate', partner:'palmitoleate',
        differs:'one C=C, cis',
        lesson:"why butter is solid and oil is not",
        diff:['C8','C9','C10','C11'],
        note:'No double bond anywhere in this chain, so every C–C rotates freely '
           + 'into the same all-anti zigzag. Straight chains stack against each '
           + 'other like pencils in a box — tight packing is what makes a '
           + 'saturated fat solid at room temperature.' } },

    // — NUCLEIC ACID. Derived from the PubChem 3D record for AMP
    //   (tools/sdf2spec-generic.js): the furanose ring shape and the 2′-OH are
    //   the claims, and the 2′-OH is exactly the one atom that separates RNA
    //   from DNA. Drawn as the dianion the record supplies — accurate at
    //   cytosolic pH, and the same convention the glycolysis phosphates use.
    amp: {
      name:'Adenosine monophosphate', formula:'C₁₀H₁₂N₅O₇P²⁻', class:'nucleotide', mono:'nucleic acid',
      // SETTLED 2026-07-30, and the comment above was right: the record supplies
      // the dianion. CID 15938965 is adenosine 5'-monophosphate(2-), and it
      // regenerates this spec EXACTLY (0.0000 delta, bonds identical). There was
      // no deprotonation step, so there is no `strip`.
      //
      // The trap that produced the wrong story: querying the NAME 'AMP' returns
      // CID 6083, the neutral acid — 37 atoms, two extra H sitting on the
      // phosphate oxygens, and a different conformer besides. The item 0 sweep
      // fetched that, read 14 H against 12, and inferred a stripping step that
      // never happened. Never identify this spec by name; the CID IS the charge
      // state, which is exactly the hazard molecule-pipeline.md item 1 warns
      // about for anomers.
      src:{path:'pubchem', cid:15938965, record:'3d',
           conformer:'00F3359500000005', sdf:'amp.sdf',
           tool:'sdf2spec-generic', charge:-2, regen:'exact', fetched:'2026-07-30'},
      atoms:[ {el:'P',pos:[-6.419,-4.966,-4.143]},
              {el:'O',pos:[-2.061,-1.359,1.881]},
              {el:'O',pos:[-1.333,5.382,2.698]},
              {el:'O',pos:[-4.964,2.545,5.027]},
              {el:'O',pos:[-5.496,-3.81,-1.372]},
              {el:'O',pos:[-5.993,-7.82,-3.868]},
              {el:'O',pos:[-4.679,-3.696,-6.084]},
              {el:'O',pos:[-9.209,-4.207,-4.362]},
              {el:'N',pos:[1.837,0.612,0.765]},
              {el:'N',pos:[4.427,-0.512,-2.398]},
              {el:'N',pos:[4.83,2.848,3.476]},
              {el:'N',pos:[9.085,2.868,1.635]},
              {el:'N',pos:[10.031,0.892,-2.35]},
              {el:'C',pos:[-2.134,3.123,1.489]},
              {el:'C',pos:[-4.745,2.253,2.339]},
              {el:'C',pos:[-0.501,0.86,2.242]},
              {el:'C',pos:[-4.69,-0.575,1.708]},
              {el:'C',pos:[-5.64,-1.153,-0.962]},
              {el:'C',pos:[4.184,1.533,1.39]},
              {el:'C',pos:[2.083,-0.602,-1.527]},
              {el:'C',pos:[5.76,0.818,-0.594]},
              {el:'C',pos:[8.298,1.535,-0.421]},
              {el:'C',pos:[7.328,3.433,3.43]},
              {el:'H',pos:[-2.106,3.424,-0.571]},
              {el:'H',pos:[-6.297,3.314,1.455]},
              {el:'H',pos:[0.059,0.921,4.248]},
              {el:'H',pos:[-5.743,-1.716,3.095]},
              {el:'H',pos:[-4.464,-0.208,-2.394]},
              {el:'H',pos:[-7.611,-0.529,-1.183]},
              {el:'H',pos:[-1.459,5.129,4.524]},
              {el:'H',pos:[-6.62,1.889,5.519]},
              {el:'H',pos:[0.502,-1.507,-2.477]},
              {el:'H',pos:[8.024,4.502,5.049]},
              {el:'H',pos:[9.448,-0.103,-3.886]},
              {el:'H',pos:[11.866,1.434,-2.181]} ],
      bonds:[ [0,4],[0,5],[0,6],[0,7,2],[1,15],[1,16],[2,13],[2,29],[3,14],[3,30],
              [4,17],[8,15],[8,18],[8,19],[9,19,2],[9,20],[10,18,2],[10,22],[11,21],
              [11,22,2],[12,21],[12,33],[12,34],[13,14],[13,15],[13,23],[14,16],
              [14,24],[15,25],[16,17],[16,26],[17,27],[17,28],[18,20],[19,31],
              [20,21,2],[22,32] ],
      optH:[23,24,25,26,27,28,31,32],   // nonpolar C–H; the O–H / N–H are never optional
      groups:[
        { key:'phosphate', label:'Phosphate', formula:'–PO₄', atoms:[0,4,5,6,7],
          note:'Negatively charged, and the piece that links one nucleotide to the next — the sugar–phosphate backbone.' },
        { key:'sugar', label:'Five-carbon sugar', formula:'ribose', atoms:[1,13,14,15,16,17],
          note:'A furanose: five-membered, unlike glucose’s six. Every nucleotide is phosphate + this sugar + a base.' },
        { key:'twooh', label:'The 2′–OH', formula:'–OH', atoms:[2,29],
          note:'This single hydroxyl is the whole difference between RNA and DNA. Remove it (deoxyribose) and the strand becomes far harder to break — which is why DNA is the archive.' },
        { key:'base', label:'Nitrogenous base', formula:'adenine', atoms:[8,9,10,11,12,18,19,20,21,22],
          note:'Two fused rings — a purine. The base is the letter; the phosphate and sugar are just the tape it is written on.' },
      ],
    },
  });
})(this);
