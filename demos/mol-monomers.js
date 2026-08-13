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
  const { MOLECULES, VIEW, register } = Lib;

  // FAMILY B, but NO builder: these are PubChem conversions (the amino acids,
  // amp) and hand-derived literals (palmitate). The carbohydrate monomer is
  // glucose, which lives in mol-glycolysis.js — one glucose in the library.
  register({
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
      units:'angstrom',
      src:{path:'pubchem', cid:750, query:'glycine', record:'3d',
           conformer:'000002EE00000001', sdf:'glycine.sdf',
           tool:'sdf2spec', regen:'exact', fetched:'2026-07-30'},
      atoms:[ {el:'N',pos:[-1.171,0.496,0.705]},
              {el:'H',pos:[-1.155,1.515,0.734]},
              {el:'H',pos:[-1.155,0.179,1.673]},
              {el:'C',pos:[0,0,0]},
              {el:'H',pos:[-0.003,0.371,-1.029]},
              {el:'C',pos:[1.232,0.496,0.705]},
              {el:'O',pos:[1.207,1.203,1.705]},
              {el:'O',pos:[2.382,0.113,0.094]},
              {el:'H',pos:[3.175,0.46,0.556]},
              {el:'H',pos:[-0.001,-1.093,0]} ],
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
      units:'angstrom',
      src:{path:'pubchem', cid:5950, query:'alanine', record:'3d',
           conformer:'0000173E00000001', sdf:'alanine.sdf',
           tool:'sdf2spec', regen:'exact', fetched:'2026-07-30'},
      atoms:[ {el:'N',pos:[-1.172,0.515,-0.705]},
              {el:'H',pos:[-2.019,0.195,-0.236]},
              {el:'H',pos:[-1.211,0.123,-1.646]},
              {el:'C',pos:[0,0,0]},
              {el:'H',pos:[-0.004,0.393,1.022]},
              {el:'C',pos:[1.237,0.515,-0.705]},
              {el:'O',pos:[1.262,1.206,-1.713]},
              {el:'O',pos:[2.357,0.112,-0.05]},
              {el:'H',pos:[3.173,0.438,-0.486]},
              {el:'C',pos:[-0.028,-1.522,0]},
              {el:'H',pos:[0.814,-1.93,0.57]},
              {el:'H',pos:[-0.949,-1.901,0.458]},
              {el:'H',pos:[0.04,-1.928,-1.016]} ],
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
      units:'angstrom',
      src:{path:'pubchem', cid:5951, query:'serine', record:'3d',
           conformer:'0000173F00000001', sdf:'serine.sdf',
           tool:'sdf2spec', regen:'exact', fetched:'2026-07-30'},
      atoms:[ {el:'N',pos:[-1.166,0.514,-0.716]},
              {el:'H',pos:[-1.164,0.181,-1.679]},
              {el:'H',pos:[-1.128,1.532,-0.758]},
              {el:'C',pos:[0,0,0]},
              {el:'H',pos:[-0.007,0.394,1.022]},
              {el:'C',pos:[1.234,0.514,-0.716]},
              {el:'O',pos:[1.339,0.727,-1.915]},
              {el:'O',pos:[2.249,0.71,0.167]},
              {el:'H',pos:[3.06,1.04,-0.276]},
              {el:'C',pos:[-0.025,-1.526,0]},
              {el:'O',pos:[1.112,-2.017,0.703]},
              {el:'H',pos:[-0.926,-1.914,0.486]},
              {el:'H',pos:[0.019,-1.931,-1.017]},
              {el:'H',pos:[1.062,-1.677,1.613]} ],
      names:['N','H','H2','CA','HA','C','O','OXT','HXT','CB','OG','HB1','HB2','HG'],
      bonds:[ [0,1],[0,2],[0,3],[3,4],[3,5],[3,9],[5,6,2],[5,7],[7,8],[9,10],[9,11],[9,12],[10,13] ],
      optH:[4,11,12],   // nonpolar C–H, hidden by the lab’s H toggle
      chirality:'L',   // asserted by check-molecules.js — life is homochiral
      pep:{ cC:5, oOH:7, hOH:8, nN:0, hN:[1,2] },
    },
    cysteine: {
      name:'Cysteine', formula:'C₃H₇NO₂S', class:'aminoacid', res:'Cys', side:'–CH₂SH',
      units:'angstrom',
      src:{path:'pubchem', cid:5862, query:'cysteine', record:'3d',
           conformer:'000016E600000001', sdf:'cysteine.sdf',
           tool:'sdf2spec', regen:'exact', fetched:'2026-07-30'},
      atoms:[ {el:'N',pos:[-1.17,0.537,-0.698]},
              {el:'H',pos:[-1.187,1.552,-0.604]},
              {el:'H',pos:[-2.02,0.197,-0.251]},
              {el:'C',pos:[0,0,0]},
              {el:'H',pos:[-0.016,0.37,1.033]},
              {el:'C',pos:[1.235,0.537,-0.698]},
              {el:'O',pos:[1.522,0.272,-1.86]},
              {el:'O',pos:[2.017,1.314,0.094]},
              {el:'H',pos:[2.815,1.632,-0.38]},
              {el:'C',pos:[-0.047,-1.529,0]},
              {el:'S',pos:[1.403,-2.255,0.831]},
              {el:'H',pos:[-0.944,-1.884,0.519]},
              {el:'H',pos:[-0.073,-1.924,-1.022]},
              {el:'H',pos:[2.316,-1.87,-0.073]} ],
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
     *  index contract as `pep` / `gly` (MolecularGeometry.md §1, rule 4) — the page
     *  addresses atoms by position, so a reindex would silently mislabel
     *  chemistry rather than crash. Regenerate; don't renumber by hand.
     * ------------------------------------------------------------------- */

    //  The CARBOHYDRATE monomer is `glucose`, built in the glycolysis section
    //  below — one glucose in the library, not two. It gained `groups`, `optH`
    //  and its C–H there rather than being duplicated here.
    //
    // — LIPID. SCHEMATIC ON PURPOSE (MolecularGeometry.md §1, "derive when shape carries
    //   the lesson; schematize when topology does"). A real palmitate conformer
    //   is floppy and renders as spaghetti; the lesson here is "long nonpolar
    //   tail, one small polar head", which an idealised all-anti zigzag shows
    //   far better. So: 16 carbons at a real 109.5° C–C–C, planar, united-atom
    //   (the CH₂'s are single C spheres, the same convention ethanol uses).
    //   SATURATED deliberately — MolecularGeometry.md §1 notes that nothing yet asserts a
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
      units:'angstrom',
      src:{path:'built', method:'all-anti zigzag, united-atom', charge:0},
      atoms:[ {el:'C',pos:[-7.9468,-0.2474,0]},
              {el:'C',pos:[-6.6895,0.6411,0]},
              {el:'C',pos:[-5.4316,-0.2474,0]},
              {el:'C',pos:[-4.1742,0.6411,0]},
              {el:'C',pos:[-2.9163,-0.2474,0]},
              {el:'C',pos:[-1.6589,0.6411,0]},
              {el:'C',pos:[-0.4011,-0.2474,0]},
              {el:'C',pos:[0.8563,0.6411,0]},
              {el:'C',pos:[2.1142,-0.2474,0]},
              {el:'C',pos:[3.3716,0.6411,0]},
              {el:'C',pos:[4.6295,-0.2474,0]},
              {el:'C',pos:[5.8868,0.6411,0]},
              {el:'C',pos:[7.1447,-0.2474,0]},
              {el:'C',pos:[8.4021,0.6411,0]},
              {el:'C',pos:[9.66,-0.2474,0]},
              {el:'C',pos:[10.9174,0.6411,0]},
              {el:'O',pos:[-9.0642,0.2674,0]},
              {el:'O',pos:[-7.8226,-1.6016,0]},
              {el:'H',pos:[-6.8763,-1.8158,0]} ],
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
      name:'Adenosine monophosphate', formula:'C₁₀H₁₂N₅O₇P²⁻', charge:-2, class:'nucleotide', mono:'nucleic acid',
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
      units:'angstrom',
      src:{path:'pubchem', cid:15938965, record:'3d',
           conformer:'00F3359500000005', sdf:'amp.sdf',
           tool:'sdf2spec-generic', charge:-2, regen:'exact', fetched:'2026-07-30'},
      atoms:[ {el:'P',pos:[-3.378,-2.614,-2.18]},
              {el:'O',pos:[-1.085,-0.715,0.99]},
              {el:'O',pos:[-0.702,2.833,1.42]},
              {el:'O',pos:[-2.613,1.339,2.646]},
              {el:'O',pos:[-2.892,-2.005,-0.722]},
              {el:'O',pos:[-3.154,-4.116,-2.036]},
              {el:'O',pos:[-2.463,-1.946,-3.202]},
              {el:'O',pos:[-4.847,-2.214,-2.296]},
              {el:'N',pos:[0.967,0.322,0.403]},
              {el:'N',pos:[2.33,-0.269,-1.262]},
              {el:'N',pos:[2.542,1.499,1.829]},
              {el:'N',pos:[4.782,1.509,0.861]},
              {el:'N',pos:[5.279,0.469,-1.237]},
              {el:'C',pos:[-1.123,1.644,0.784]},
              {el:'C',pos:[-2.497,1.186,1.231]},
              {el:'C',pos:[-0.263,0.453,1.18]},
              {el:'C',pos:[-2.468,-0.303,0.899]},
              {el:'C',pos:[-2.968,-0.607,-0.506]},
              {el:'C',pos:[2.202,0.807,0.732]},
              {el:'C',pos:[1.097,-0.317,-0.804]},
              {el:'C',pos:[3.031,0.43,-0.312]},
              {el:'C',pos:[4.367,0.808,-0.222]},
              {el:'C',pos:[3.857,1.807,1.805]},
              {el:'H',pos:[-1.108,1.802,-0.301]},
              {el:'H',pos:[-3.314,1.744,0.766]},
              {el:'H',pos:[0.031,0.485,2.236]},
              {el:'H',pos:[-3.023,-0.903,1.629]},
              {el:'H',pos:[-2.349,-0.109,-1.26]},
              {el:'H',pos:[-4.006,-0.278,-0.623]},
              {el:'H',pos:[-0.768,2.699,2.381]},
              {el:'H',pos:[-3.484,0.994,2.905]},
              {el:'H',pos:[0.264,-0.793,-1.304]},
              {el:'H',pos:[4.223,2.369,2.657]},
              {el:'H',pos:[4.973,-0.054,-2.045]},
              {el:'H',pos:[6.245,0.755,-1.148]} ],
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
  }, SELFNAME);
})(this);
