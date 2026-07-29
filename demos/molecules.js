/* =====================================================================
 *  molecules.js — shared molecule library + colour palette
 *  Loaded as a classic script (Three r128 global style) BEFORE the page's
 *  main script. Exposes window.MolLib for both water-lab.html and the
 *  upcoming molecule-builder.html, so colours and geometry stay identical
 *  across pages.
 *
 *  PALETTE is the single source of truth for atom + bond colours.
 *  MOLECULES will hold the declarative specs (geometry + charge sites +
 *  solute class) that drive buildMolecule() and the solvation physics.
 *
 * ---------------------------------------------------------------------
 *  BOND-LENGTH SCALE FAMILIES — read this before putting two molecules
 *  from different sections on the same screen.
 * ---------------------------------------------------------------------
 *  There is ONE hard rule, and check-molecules.js enforces it: a bond must
 *  be longer than the sum of its two atoms' display radii, or the spheres
 *  swallow the stick and the molecule renders as a blob. Display radii here
 *  are stylised and LARGE, so no spec can use true ångströms.
 *
 *  How each section satisfies that rule is NOT the same, and that is the
 *  trap. Two families live in this file:
 *
 *    A. HAND-WRITTEN (water, ethanol, ammonia, methane, CO₂, carbonic,
 *       bicarbonate, hydronium — the solvation pages).
 *       Each length was chosen individually to clear its radii. Water's O–H
 *       is 1.55 against radii summing to 1.50. Implied scale runs ~1.2–1.6×
 *       and varies WITHIN a molecule (ethanol: C–C 1.19×, C–O 1.33×,
 *       O–H 1.61×). There is no proportionality claim, and there cannot be
 *       one: water-lab.html and molecule-lab.html hard-code HL=1.55 and tune
 *       their entire solvation engine around it (EQ, MIN, hbThreshold, the
 *       ice lattice spacing). Rescaling water means re-tuning that physics.
 *       Do not touch this family to make some other page tidy.
 *
 *    B. DERIVED (the amino acids, palmitate, amp, and everything the Skel
 *       builder makes — glucose and the glycolysis intermediates).
 *       Real ångströms × ONE global factor, SCALE = 1.9. Relative lengths
 *       are truthful, so these molecules are comparable to each other.
 *
 *  THE INVARIANT: a single page may only show molecules from ONE family.
 *  Every page satisfies this — water-lab and molecule-lab are family A,
 *  aminoacid-lab / glycolysis-lab / macromolecule-lab are family B.
 *
 *  This was learned the expensive way. The Skel table (GL, further down)
 *  used to be family A while the amino acids were family B; nothing showed
 *  it, because no page mixed them. macromolecule-lab.html then put Skel
 *  glucose beside PubChem alanine and AMP under the words "true relative
 *  size", and glucose was ~0.7× everything around it. GL is now family B.
 *  If you add a page that shows a solvation molecule next to a derived one,
 *  that is a new problem and it needs solving here, not on the page.
 * ===================================================================== */
(function(global){
  'use strict';

  // ---- colours (hex ints) ---------------------------------------------
  // Atom colours double as the swatches in water-lab's Debug ▸ Colours tab;
  // editing PALETTE.atoms live keeps every molecule on the page consistent.
  const PALETTE = {
    atoms: {
      O:  0xd6362e,   // oxygen   — red
      H:  0xb9c2d0,   // hydrogen — pale steel
      Na: 0x9a3fe0,   // sodium   — violet
      Cl: 0x1fa968,   // chloride — green
      K:  0x0054C0,   // potassium — blue (distinct from Na)
      C:  0x3a3a3a,   // carbon   — charcoal
      N:  0x3f6ae0,   // nitrogen — blue
      S:  0xe0b93a,   // sulfur   — goldenrod (cysteine / methionine)
      P:  0xe07b1f,   // phosphorus — orange (CPK). Deliberately the warmest atom
                      // in the palette: in glycolysis the phosphate IS the energy
                      // currency, so every P a student sees is "something ATP paid
                      // for or will be paid back". No other lesson uses P, so it
                      // can't be confused with sulfur's goldenrod.
    },
    bonds: {
      covalent:  0xb3a892,   // covalent stick — muted stone on cream
      hbond:     0x0042aa,   // hydrogen bond  — deep blue
      iondipole: 0xd9791e,   // ion–dipole bond — deep amber
      peptide:   0x6a5acd,   // peptide (amide C–N) bond — slate violet, so the
                             // newly-formed backbone link reads distinct from the
                             // ordinary covalent sticks within each residue
    },
    // default display radii (scene units, stylised — enlarged for legibility)
    radii: { O:0.95, H:0.55, C:0.85, N:0.90, S:1.05, Na:0.70, Cl:1.24, K:0.85, P:1.00 },
  };

  // ---- molecule library ----------------------------------------------
  // Each entry:
  //   name, formula
  //   class    — 'solvent' | 'ionic' | 'polar' | 'nonpolar'
  //   atoms    — [{el, pos:[x,y,z]}]  local positions. These are family A
  //              (hand-written, per-bond, matching water's exaggerated O–H) —
  //              see the scale-families note at the top of this file.
  //   bonds    — [[i,j], …]  indices into atoms
  //   sites    — { donors:[{atom}], acceptors:[{atom, lonePairs}] }
  //              donor = a δ+ H that can point into water; acceptor = a
  //              lone-pair-bearing atom water's H can point at. Drives the
  //              H-bond engine for molecular (polar) solutes.
  //   dissociates — ionic only: [{ion, charge, radius}] produced on dissolving
  //   hydrophobic — indices of nonpolar atoms (tail), for the exclusion lesson
  //
  // Geometry notes: united-atom where a group is nonpolar filler (ethanol's
  // CH3/CH2 are single C spheres); explicit H's where they carry the lesson.
  const MOLECULES = {
    water: {
      name:'Water', formula:'H₂O', class:'solvent',
      atoms:[ {el:'O',pos:[0,0,0]}, {el:'H',pos:[1.226,-0.948,0]}, {el:'H',pos:[-1.226,-0.948,0]} ],
      bonds:[ [0,1],[0,2] ],
      sites:{ donors:[{atom:1},{atom:2}], acceptors:[{atom:0, lonePairs:2}] },
    },
    nacl: {
      name:'Salt', formula:'NaCl', class:'ionic',
      dissociates:[ {ion:'Na', charge:+1, radius:0.70}, {ion:'Cl', charge:-1, radius:1.24} ],
    },
    kcl: {
      name:'Potassium chloride', formula:'KCl', class:'ionic',
      dissociates:[ {ion:'K', charge:+1, radius:0.85}, {ion:'Cl', charge:-1, radius:1.24} ],
    },
    ethanol: {
      name:'Ethanol', formula:'C₂H₅OH', class:'polar',
      // CH3–CH2–OH, all-atom: methyl (3 H) + methylene (2 H) + hydroxyl (1 H) = 6 H.
      // Only the hydroxyl O–H is polar; the ethyl group is the nonpolar tail.
      // Bond lengths are the STYLISED ones (C–C 1.85, C–O 1.90, O–H 1.55, C–H 1.50),
      // not real Å. They have to exceed the sum of the two display radii or the
      // spheres merge and hide the bond stick — water's O–H 1.55 vs radii 1.50 sets
      // the convention. Angles are true tetrahedral (109.5°) / 105° at the hydroxyl.
      // Origin sits at the heavy-atom centroid so the molecule spins about its middle.
      atoms:[ {el:'C',pos:[-1.544,-0.183,0]},        // 0 methyl C
              {el:'C',pos:[0.056,0.717,0]},          // 1 methylene C
              {el:'O',pos:[1.487,-0.533,0]},         // 2 hydroxyl O
              {el:'H',pos:[2.775,0.329,0]},          // 3 hydroxyl H (donor)
              {el:'H',pos:[-1.634,-1.046,1.226]},    // 4 methyl H
              {el:'H',pos:[-2.674,0.803,0]},         // 5 methyl H
              {el:'H',pos:[-1.634,-1.046,-1.226]},   // 6 methyl H
              {el:'H',pos:[0.145,1.578,1.226]},      // 7 methylene H
              {el:'H',pos:[0.145,1.578,-1.226]} ],   // 8 methylene H
      bonds:[ [0,1],[1,2],[2,3],[0,4],[0,5],[0,6],[1,7],[1,8] ],
      sites:{ donors:[{atom:3}], acceptors:[{atom:2, lonePairs:2}] },
      hydrophobic:[0,1,4,5,6,7,8],
    },
    ammonia: {
      name:'Ammonia', formula:'NH₃', class:'polar',
      // trigonal pyramidal, lone pair up (+y); H's splay down at ~107°
      atoms:[ {el:'N',pos:[0,0,0]},
              {el:'H',pos:[1.391,-0.562,0]},
              {el:'H',pos:[-0.695,-0.562,1.204]},
              {el:'H',pos:[-0.695,-0.562,-1.204]} ],
      bonds:[ [0,1],[0,2],[0,3] ],
      sites:{ donors:[{atom:1},{atom:2},{atom:3}], acceptors:[{atom:0, lonePairs:1}] },
    },
    methane: {
      name:'Methane', formula:'CH₄', class:'nonpolar',
      // tetrahedral; no polar sites → excluded by water (hydrophobic)
      atoms:[ {el:'C',pos:[0,0,0]},
              {el:'H',pos:[0.866,0.866,0.866]}, {el:'H',pos:[0.866,-0.866,-0.866]},
              {el:'H',pos:[-0.866,0.866,-0.866]}, {el:'H',pos:[-0.866,-0.866,0.866]} ],
      bonds:[ [0,1],[0,2],[0,3],[0,4] ],
      sites:{ donors:[], acceptors:[] },
      hydrophobic:[0,1,2,3,4],
    },
    co2: {
      name:'Carbon dioxide', formula:'CO₂', class:'reactive',
      // Linear O=C=O; symmetric, so the two C=O dipoles cancel and the MOLECULE
      // has no net dipole. That does NOT make it methane: each O still carries
      // δ− and two lone pairs, so water can donate an O–H to it. CO₂ is ~30×
      // more soluble than O₂ and ~60× more than CH₄ for exactly this reason.
      //   → acceptors on both O's, and NO hydrophobic list. Listing the O's as
      //     hydrophobic (as an earlier version did) put the site springs and the
      //     nonpolar exclusion field on the same atoms, fighting every frame.
      // It cannot DONATE an H-bond, so it hydrates more weakly than ethanol/NH₃.
      atoms:[ {el:'C',pos:[0,0,0]}, {el:'O',pos:[1.9,0,0]}, {el:'O',pos:[-1.9,0,0]} ],
      bonds:[ [0,1,2],[0,2,2] ],
      sites:{ donors:[], acceptors:[{atom:1, lonePairs:2},{atom:2, lonePairs:2}] },
      // reaction chain driven by molecule-lab's updateReactions():
      //   CO₂ + H₂O → H₂CO₃ → HCO₃⁻ + H⁺(as H₃O⁺)
      reactsTo:'carbonic',
    },

    // ---- carbonation products -------------------------------------------
    // Not in the picker: these only ever appear as products of the CO₂ chain,
    // so each carries `product:true` and the engine tags them with the parent
    // key ('co2') for counting and clearing.
    carbonic: {
      name:'Carbonic acid', formula:'H₂CO₃', class:'polar', product:true,
      // Trigonal planar about C (120°): one C=O plus two C–O–H arms. Stylised
      // lengths again (C–O 1.9, O–H 1.55) — the ANGLES are the real ones.
      // The acidic H's are BENT off the C–O axis at ~107°, like water's O — a
      // hydroxyl O is never linear (check-molecules.js prints these angles).
      // Origin is the heavy-atom centroid, so it spins about its middle.
      atoms:[ {el:'C',pos:[0,0,0]},                 // 0 central C
              {el:'O',pos:[0,1.9,0]},               // 1 carbonyl O (=O)
              {el:'O',pos:[1.645,-0.95,0]},         // 2 hydroxyl O
              {el:'O',pos:[-1.645,-0.95,0]},        // 3 hydroxyl O
              {el:'H',pos:[2.779,0.107,0]},         // 4 acidic H on atom 2
              {el:'H',pos:[-2.779,0.107,0]} ],      // 5 acidic H on atom 3
      bonds:[ [0,1,2],[0,2],[0,3],[2,4],[3,5] ],
      sites:{ donors:[{atom:4},{atom:5}],
              acceptors:[{atom:1, lonePairs:2},{atom:2, lonePairs:2},{atom:3, lonePairs:2}] },
      ionizesTo:'bicarbonate',   // loses ONE H (pKa1 = 3.6 — it is a genuine acid)
    },
    bicarbonate: {
      name:'Bicarbonate', formula:'HCO₃⁻', class:'ion', product:true, charge:-1,
      // Carbonic acid minus one acidic H. The two bare O's share the negative
      // charge (delocalised) — drawn as plain O's here; the charge lives in the
      // label and the pH readout, not in the force model (no polyatomic-ion
      // electrostatics in this engine yet).
      atoms:[ {el:'C',pos:[0,0,0]},
              {el:'O',pos:[0,1.9,0]},
              {el:'O',pos:[1.645,-0.95,0]},
              {el:'O',pos:[-1.645,-0.95,0]},
              {el:'H',pos:[-2.779,0.107,0]} ],      // 4 the one remaining H (bent, ~107°)
      bonds:[ [0,1,2],[0,2],[0,3],[3,4] ],
      sites:{ donors:[{atom:4}],
              acceptors:[{atom:1, lonePairs:2},{atom:2, lonePairs:2},{atom:3, lonePairs:2}] },
    },
    hydronium: {
      name:'Hydronium', formula:'H₃O⁺', class:'ion', product:true, charge:+1,
      // Where the H⁺ actually goes: a bare proton doesn't exist in water. This
      // is a water molecule that ACCEPTED the acid's H — trigonal pyramidal
      // (~113°), one lone pair left on top. All three H's can donate.
      atoms:[ {el:'O',pos:[0,0,0]},
              {el:'H',pos:[1.437,-0.581,0]},
              {el:'H',pos:[-0.719,-0.581,1.244]},
              {el:'H',pos:[-0.719,-0.581,-1.244]} ],
      bonds:[ [0,1],[0,2],[0,3] ],
      sites:{ donors:[{atom:1},{atom:2},{atom:3}], acceptors:[] },
    },

    // ---- amino acids ----------------------------------------------------
    // Shared backbone, laid out left→right so a chain grows along +X:
    //   amino end (−X)  H₂N–Cα–COOH  carboxyl end (+X)
    //   0 N   1 H   2 H       (amino group; an H leaves in condensation)
    //   3 Cα  4 H              (α-carbon; 4 is the backbone H)
    //   5 C   6 O(=O)  7 O(–OH)  8 H   (carboxyl; the –OH, atoms 7+8, leaves)
    //   9…    side chain (R), bonded to Cα (atom 3), splayed −Y
    // `pep` names the atoms the peptide-bond reaction acts on (aminoacid-lab.js):
    //   cC carboxyl carbon · oOH/hOH the leaving hydroxyl · nN amino N · hN amino H's.
    // Only the ANGLES/topology carry the lesson; bond lengths are stylised as
    // elsewhere (must exceed the two display radii so the stick shows).
    // Zwitterion form is skipped on purpose — the neutral –NH₂/–COOH makes the
    // "lose a water" bookkeeping legible; note this is a display simplification.
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
      bonds:[ [0,1],[0,2],[0,3],[3,4],[3,5],[3,9],[5,6,2],[5,7],[7,8] ],
      optH:[4,9],   // nonpolar C–H, hidden by the lab’s H toggle
      // glycine is ACHIRAL: its side chain is an H, so Ca has two identical
      // substituents and there is no L/D to assert.
      pep:{ cC:5, oOH:7, hOH:8, nN:0, hN:[1,2] },
    },
    alanine: {
      name:'Alanine', formula:'C₃H₇NO₂', class:'aminoacid', res:'Ala', side:'–CH₃',
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
      bonds:[ [0,1],[0,2],[0,3],[3,4],[3,5],[3,9],[5,6,2],[5,7],[7,8],[9,10],[9,11],[9,12] ],
      optH:[4,10,11,12],   // nonpolar C–H, hidden by the lab’s H toggle
      chirality:'L',   // asserted by check-molecules.js — life is homochiral
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
      bonds:[ [0,1],[0,2],[0,3],[3,4],[3,5],[3,9],[5,6,2],[5,7],[7,8],[9,10],[9,11],[9,12],[10,13] ],
      optH:[4,11,12],   // nonpolar C–H, hidden by the lab’s H toggle
      chirality:'L',   // asserted by check-molecules.js — life is homochiral
      pep:{ cC:5, oOH:7, hOH:8, nN:0, hN:[1,2] },
    },
    cysteine: {
      name:'Cysteine', formula:'C₃H₇NO₂S', class:'aminoacid', res:'Cys', side:'–CH₂SH',
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
    },

    // — NUCLEIC ACID. Derived from the PubChem 3D record for AMP
    //   (tools/sdf2spec-generic.js): the furanose ring shape and the 2′-OH are
    //   the claims, and the 2′-OH is exactly the one atom that separates RNA
    //   from DNA. Drawn as the dianion the record supplies — accurate at
    //   cytosolic pH, and the same convention the glycolysis phosphates use.
    amp: {
      name:'Adenosine monophosphate', formula:'C₁₀H₁₂N₅O₇P²⁻', class:'nucleotide', mono:'nucleic acid',
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
  };

  /* =====================================================================
   *  GLYCOLYSIS INTERMEDIATES  (glycolysis-lab.html)  — see SCIENCE.md §12
   * =====================================================================
   *  These specs are COMPUTED, not typed out. Every earlier molecule here is
   *  small enough to hand-place, but a phosphorylated six-carbon sugar has
   *  ~30 atoms and four tetrahedral centres per phosphate — hand coordinates
   *  would be eyeballed, and SCIENCE.md's rule is that accuracy lives in the
   *  coordinates. So geometry is generated from bond lengths + real VSEPR
   *  angles by the tiny `Skel` builder below, and check-molecules.js audits
   *  the result (no sphere overlaps, printed angles).
   *
   *  MODEL SIMPLIFICATIONS — all deliberate, all listed in SCIENCE.md §12:
   *   1. C–H hydrogens are OMITTED on the carbon backbone. The lesson is
   *      "where do the six carbons go", so the carbons must stay countable;
   *      24 extra H's would bury them. The ONE exception is the aldehyde H on
   *      G3P's C1 — that specific H is what gets oxidised onto NAD⁺, so it is
   *      drawn. Hydroxyl O–H hydrogens are always drawn (they read as "–OH").
   *   2. C=O double bonds are tagged `[i,j,2]` and drawn as a PAIR of sticks
   *      (see `bond()` in scene.js / the labs). P=O is the exception: the three
   *      phosphate O's are all drawn as single sticks, because the charge is
   *      delocalised over them and picking one to double up would be a lie.
   *   3. After the first phosphorylation the sugar is drawn as an OPEN CHAIN,
   *      the way every textbook draws glycolysis (Fischer projection), not as
   *      the furanose ring F1,6-bisphosphate actually is in solution. Glucose
   *      itself IS drawn as its real pyranose ring, and the ring visibly opens
   *      during priming — glucose genuinely ring-opens and closes in water.
   *      The open chain is what makes "six carbons in a row snap into 3 + 3"
   *      legible, which is the whole reason this page exists.
   *   4. Phosphate/carboxylate charges live in the labels and the ledger, not
   *      in a force model — this page has no electrostatics (it is not the
   *      solvation engine).
   */

  // Bond lengths: REAL ångströms × SCALE — the derived scale family (see the
  // "Bond-length scale families" note at the top of this file).
  //
  // These used to be picked one at a time to just clear the display radii
  // (C+C 1.70 · C+O 1.80 · O+H 1.50 · O+P 1.95 · C+H 1.40), which is the
  // hand-written family's rule. It kept every stick visible and was internally
  // fine — this page only ever shows its own specs — but it made C–C and C–O
  // the SAME length when C–O is really the shorter of the two, used one number
  // for both C–O and C=O, and put the whole page at ~0.7× the derived specs.
  // That last one only surfaced when macromolecule-lab.html put this glucose
  // next to alanine and AMP under the words "true relative size".
  //
  // Every value below still clears its radii sum by a wide margin (the tightest
  // is O–H at 1.84 against 1.50); check-molecules.js asserts that.
  const SCALE = 1.9;                    // the shared factor, as in tools/sdf2spec.js
  const GL = {
    CC: 1.54*SCALE,   // 2.93  C–C single
    CO: 1.43*SCALE,   // 2.72  C–O single (hydroxyl, phosphate ester bridge)
    CdO:1.23*SCALE,   // 2.34  C=O — and the carboxylate C–O⁻, which is nearly it
    OH: 0.97*SCALE,   // 1.84  O–H
    CH: 1.09*SCALE,   // 2.07  C–H
    OP: 1.60*SCALE,   // 3.04  P–O ester (the bridging oxygen)
    PO: 1.50*SCALE,   // 2.85  P–O terminal (P=O 1.48 / P–O⁻ 1.51, delocalised)
  };
  const TET = 109.5, SP2 = 120;

  const V  = (x,y,z)=>({x,y,z});
  const vadd=(a,b)=>V(a.x+b.x,a.y+b.y,a.z+b.z);
  const vsub=(a,b)=>V(a.x-b.x,a.y-b.y,a.z-b.z);
  const vmul=(a,s)=>V(a.x*s,a.y*s,a.z*s);
  const vlen=a=>Math.hypot(a.x,a.y,a.z);
  const vnorm=a=>{const l=vlen(a)||1;return vmul(a,1/l);};
  const vcross=(a,b)=>V(a.y*b.z-a.z*b.y, a.z*b.x-a.x*b.z, a.x*b.y-a.y*b.x);
  const rad=d=>d*Math.PI/180;

  // ---- Skel: an atoms+bonds accumulator that knows VSEPR ----------------
  // The point of it: you never state a substituent's position, you state which
  // atom it hangs off and how it's hybridised. Directions come out of the
  // geometry already committed, so angles are correct by construction and
  // successive calls on the same atom automatically take the next free slot.
  function Skel(){ this.atoms=[]; this.bonds=[]; }
  Skel.prototype.put=function(el,p){ this.atoms.push({el,pos:[p.x,p.y,p.z]}); return this.atoms.length-1; };
  Skel.prototype.at =function(i){ const p=this.atoms[i].pos; return V(p[0],p[1],p[2]); };
  Skel.prototype.link=function(i,j,order){ this.bonds.push(order?[i,j,order]:[i,j]); return this; };
  Skel.prototype.nbrs=function(i){ const A=this.at(i);
    return this.bonds.filter(b=>b[0]===i||b[1]===i)
      .map(b=>vnorm(vsub(this.at(b[0]===i?b[1]:b[0]),A))); };
  // Set the order of an already-linked pair. Aromatic rings are laid out as a
  // polygon first and given their Kekulé orders after, so the geometry code
  // never has to care which bonds are double.
  Skel.prototype.order=function(i,j,o){
    const b=this.bonds.find(b=>(b[0]===i&&b[1]===j)||(b[0]===j&&b[1]===i));
    if(!b) throw new Error(`order(): no bond ${i}-${j}`);
    b[2]=o; return this;
  };

  // any unit vector perpendicular to `a` (picks a seed axis that isn't parallel)
  function perpTo(a){
    let t=vcross(a,V(0,0,1));
    if(vlen(t)<0.25) t=vcross(a,V(1,0,0));
    return vnorm(t);
  }
  Skel.prototype.centroid=function(){
    return vmul(this.atoms.reduce((s,a)=>vadd(s,V(a.pos[0],a.pos[1],a.pos[2])),V(0,0,0)),
      1/(this.atoms.length||1));
  };
  // When an atom has only ONE bond so far, the correct bond ANGLE still leaves a
  // free rotation about that bond — and picking that azimuth arbitrarily is how a
  // phosphate ends up folded back through the carbon chain it hangs off (the first
  // version of this file did exactly that; check-molecules.js caught it as a
  // 1.5-unit C..O overlap). So: seed the cone so slot 0 points as far as possible
  // AWAY from the centroid of everything already placed. Backbones are always
  // built before their substituents, so "away from the centroid" means "out into
  // open space", and groups splay outward instead of collapsing inward.
  Skel.prototype.outwardAt=function(i,a){
    const away=vsub(this.at(i), this.centroid());
    const t=vsub(away, vmul(a, away.x*a.x+away.y*a.y+away.z*a.z));   // ⊥ component
    return vlen(t)<0.05 ? perpTo(a) : vnorm(t);
  };
  // remaining sp3 bond directions at atom i, each `TET` from every existing bond
  Skel.prototype.freeTet=function(i){
    const nb=this.nbrs(i);
    if(nb.length===0) return [V(0,1,0),V(0,-1,0)];
    if(nb.length===1){
      const a=nb[0], t=this.outwardAt(i,a), u=vnorm(vcross(a,t));
      const c=Math.cos(rad(TET)), s=Math.sin(rad(TET));
      return [0,1,2].map(k=>{ const ph=k*2*Math.PI/3;
        return vnorm(vadd(vmul(a,c), vadd(vmul(t,s*Math.cos(ph)), vmul(u,s*Math.sin(ph))))); });
    }
    if(nb.length===2){
      // the two open slots straddle the plane of the existing pair, opening away
      // from it — the classic axial/equatorial pair on a ring carbon
      const bis=vnorm(vmul(vadd(nb[0],nb[1]),-1)), p=vnorm(vcross(nb[0],nb[1]));
      const h=rad(TET/2), c=Math.cos(h), s=Math.sin(h);
      return [ vnorm(vadd(vmul(bis,c), vmul(p, s))), vnorm(vadd(vmul(bis,c), vmul(p,-s))) ];
    }
    return [ vnorm(vmul(nb.reduce(vadd,V(0,0,0)),-1)) ];   // 3 bonds → one slot left
  };
  // remaining sp2 (trigonal planar, 120°) directions — carbonyl + carboxylate carbons
  Skel.prototype.freeSp2=function(i){
    const nb=this.nbrs(i);
    if(nb.length===1){
      const a=nb[0], t=this.outwardAt(i,a);      // same outward rule as freeTet
      const c=Math.cos(rad(SP2)), s=Math.sin(rad(SP2));
      return [ vnorm(vadd(vmul(a,c), vmul(t,s))), vnorm(vadd(vmul(a,c), vmul(t,-s))) ];
    }
    return [ vnorm(vmul(nb.reduce(vadd,V(0,0,0)),-1)) ];
  };
  // hang one atom off atom i in its next free slot; `hyb` picks the geometry
  Skel.prototype.grow=function(i,el,dist,hyb,slot,order){
    const dirs=(hyb==='sp2'?this.freeSp2(i):this.freeTet(i));
    const j=this.put(el, vadd(this.at(i), vmul(dirs[slot||0], dist)));
    this.link(i,j,order); return j;
  };

  // ---- ring stereochemistry ---------------------------------------------
  // freeTet() on a ring carbon returns its AXIAL and EQUATORIAL slots, but in an
  // order that falls out of the cross-product sign, not out of chemistry. Taking
  // slot 0 every time therefore alternates axial/equatorial around the ring — an
  // arbitrary stereoisomer wearing glucose's name. `equatorial()` picks by
  // geometry instead: of the free slots, the one most PERPENDICULAR to the ring
  // axis. β-D-glucopyranose is all-equatorial, which is exactly why it is the
  // most stable hexose and the one the whole pathway is built around.
  Skel.prototype.ringNormal=function(ring){
    const c=vmul(ring.reduce((s,i)=>vadd(s,this.at(i)),V(0,0,0)), 1/ring.length);
    let n=V(0,0,0);
    for(let k=0;k<ring.length;k++)
      n=vadd(n, vcross(vsub(this.at(ring[k]),c), vsub(this.at(ring[(k+1)%ring.length]),c)));
    return vnorm(n);
  };
  Skel.prototype.equatorial=function(i,ring){
    const n=this.ringNormal(ring), dirs=this.freeTet(i);
    let best=0, bestDot=Infinity;
    dirs.forEach((d,k)=>{ const v=Math.abs(d.x*n.x+d.y*n.y+d.z*n.z);
      if(v<bestDot){ bestDot=v; best=k; } });
    return best;
  };
  // The other one. Glucose never needs this; galactose is glucose with C4 axial,
  // and that single flip is the whole difference between a sugar we metabolise
  // and one that poisons an infant who cannot (galactosemia). Defined as "not
  // equatorial" rather than "most parallel to the axis" on purpose: the two
  // free slots on a ring carbon are a pair, so deriving one from the other
  // guarantees they can never both resolve to the same slot.
  Skel.prototype.axial=function(i,ring){
    return this.freeTet(i).length===2 ? 1-this.equatorial(i,ring) : 0;
  };
  // Which FACE of a near-planar ring a substituent points to. A furanose is too
  // flat for the axial/equatorial distinction to mean much — ribose's identity is
  // carried by which side of the ring each –OH sits on. `side` is +1 or −1
  // against the ring normal; the normal's own sign is arbitrary (it falls out of
  // the ring's traversal order), so only the RELATIVE faces are meaningful, and
  // that is exactly what check-molecules.js asserts.
  Skel.prototype.face=function(i,ring,side){
    const n=this.ringNormal(ring), dirs=this.freeTet(i);
    let best=0, bestDot=-Infinity;
    dirs.forEach((d,k)=>{ const v=side*(d.x*n.x+d.y*n.y+d.z*n.z);
      if(v>bestDot){ bestDot=v; best=k; } });
    return best;
  };

  // ---- functional groups ------------------------------------------------
  Skel.prototype.hydroxyl=function(i,slot){                 // –OH
    const o=this.grow(i,'O',GL.CO,'sp3',slot);
    this.grow(o,'H',GL.OH,'sp3',0);                         // C–O–H ≈ 109.5°
    return o;
  };
  Skel.prototype.carbonyl=function(i,slot){                 // C=O (double bond)
    return this.grow(i,'O',GL.CdO,'sp2',slot,2);
  };
  // –O–PO₃²⁻ : a bridging ester O, then a tetrahedral P with three more O's.
  // Returns the P index — the page uses it as the effect anchor, because the P
  // is what visibly arrives from ATP and later leaves for ADP.
  Skel.prototype.phosphate=function(i,slot){
    const o=this.grow(i,'O',GL.CO,'sp3',slot);
    const p=this.grow(o,'P',GL.OP,'sp3',0);
    for(let k=0;k<3;k++) this.grow(p,'O',GL.PO,'sp3',0);
    return p;
  };
  Skel.prototype.rotate=function(rx,ry,rz){
    const cx=Math.cos(rx), sx=Math.sin(rx);
    const cy=Math.cos(ry), sy=Math.sin(ry);
    const cz=Math.cos(rz), sz=Math.sin(rz);
    this.atoms.forEach(a=>{
      let [x,y,z]=a.pos;
      let y1=y*cx-z*sx, z1=y*sx+z*cx;
      let x2=x*cy+z1*sy, z2=-x*sy+z1*cy;
      let x3=x2*cz-y1*sz, y3=x2*sz+y1*cz;
      a.pos=[x3,y3,z2];
    });
    return this;
  };

  Skel.prototype.spec=function(extra){
    return Object.assign({ atoms:this.atoms, bonds:this.bonds }, extra);
  };

  // ---- backbone scaffolds ----------------------------------------------
  // Open carbon chain in the textbook orientation: C1 at the TOP, growing down
  // −Y in a zig-zag through the real ~111° chain angle, all carbons in the z=0
  // plane so substituents splay toward the viewer in ±z and the backbone stays
  // readable head-on. Carbons land at indices 0…n−1 = C1…Cn.
  function chainC(n){
    const s=new Skel(), half=rad(111/2);
    const dy=GL.CC*Math.sin(half), dx=GL.CC*Math.cos(half);
    for(let k=0;k<n;k++){
      s.put('C', V((k%2?dx:0)-dx/2, (n-1)*dy/2 - k*dy, 0));
      if(k) s.link(k-1,k);
    }
    return s;
  }
  // β-D-glucopyranose ring: six-membered, O5 at index 0 then C1…C5 at 1…5, laid
  // in the xz-plane with an alternating ±y pucker (the chair — a flat hexagon is
  // as wrong for a pyranose as a linear water is for H₂O). C6 is exocyclic on C5.
  function ringPyranose(){
    const s=new Skel(), R=GL.CC;             // regular hexagon: side = circumradius
    // Pucker is a FRACTION of the ring, not a fixed offset: it was 0.34 when
    // GL.CC was 1.95, and leaving it absolute after the rescale would have
    // flattened the chair toward a hexagon as the ring grew. `equatorial()`
    // picks substituent slots off this pucker, so a flatter ring is not a
    // cosmetic difference — it is what decides which stereoisomer gets built.
    const pucker=0.174*R;
    for(let k=0;k<6;k++){ const th=k*Math.PI/3;
      s.put(k===0?'O':'C', V(R*Math.cos(th), (k%2?pucker:-pucker), R*Math.sin(th))); }
    for(let k=0;k<6;k++) s.link(k,(k+1)%6);
    return s;
  }
  // β-D-ribofuranose ring: five-membered, O4′ at index 0 then C1′…C4′ at 1…4.
  // Puckered as a C3′-endo envelope — four atoms near-coplanar, one lifted. Real
  // furanoses are never flat, but the pucker here is deliberately SMALL: unlike a
  // pyranose chair, nothing about ribose's identity rides on it (the –OH faces
  // carry that), and a strong pucker would tempt `equatorial()` into reporting
  // an ax/eq split that means nothing on a five-ring. Use `face()` on this ring.
  function ringFuranose(){
    const s=new Skel(), R=GL.CC/(2*Math.sin(Math.PI/5));   // side → circumradius
    const pucker=0.12*R;
    for(let k=0;k<5;k++){ const th=k*2*Math.PI/5;
      // index 3 is C3′ — the one atom out of the plane (C3′-endo)
      s.put(k===0?'O':'C', V(R*Math.cos(th), k===3?pucker:0, R*Math.sin(th))); }
    for(let k=0;k<5;k++) s.link(k,(k+1)%5);
    return s;
  }
  // ---- aromatic ring systems -------------------------------------------
  // Purine and pyrimidine are FLAT — every ring atom is sp2, and the delocalised
  // π system is what holds them planar. So these are laid out as regular polygons
  // in the xz-plane rather than grown through freeTet(): a tetrahedral builder
  // would pucker them, and a puckered base would break the one claim this pair
  // makes, which is about WIDTH. Two rings vs one is why A–T and G–C are the same
  // width and the DNA backbone stays a constant 2 nm apart.
  //
  // Bond orders below are one Kekulé structure of the aromatic ring. The real
  // molecule is delocalised — no bond is truly single or double — but every
  // textbook draws a Kekulé form, and alternating orders at least keep every
  // atom's valence correct, which a uniform "aromatic" stick would not show.
  const AR = { CC: 1.39*SCALE, CN: 1.34*SCALE, CH: 1.08*SCALE, NH: 1.01*SCALE };
  // Regular polygon of `n` sides, side length AR.CC, in the xz-plane.
  function flatRing(n, els){
    const s=new Skel(), R=AR.CC/(2*Math.sin(Math.PI/n));
    for(let k=0;k<n;k++){ const th=k*2*Math.PI/n;
      s.put(els[k], V(R*Math.cos(th), 0, R*Math.sin(th))); }
    for(let k=0;k<n;k++) s.link(k,(k+1)%n);
    return s;
  }
  // Fuse a regular `n`-gon onto the existing edge i–j, coplanar with the ring and
  // opening AWAY from `awayFrom` (the parent ring's centre). Returns the new atom
  // indices in order walking from j round to i. This is how the imidazole gets
  // onto the pyrimidine ring to make a purine — sharing the C4–C5 edge, which is
  // the definition of the fused bicycle.
  // Both rings live in the xz-plane, so this is 2D trigonometry about the y-axis
  // — not a general 3D fuse. Keeping it 2D is the point: a general version would
  // silently tolerate a non-planar purine, which is the one thing that must not
  // happen here.
  function fuseRing(s, n, i, j, awayFrom, els){
    const a=s.at(i), b=s.at(j);
    const mid=vmul(vadd(a,b),0.5);
    const out=vnorm(vsub(mid, awayFrom));            // already in-plane (all y=0)
    const side=vlen(vsub(b,a));
    const apo=side/(2*Math.tan(Math.PI/n));          // centre → edge midpoint
    const c=vadd(mid, vmul(out, apo));               // polygon centre
    const R=side/(2*Math.sin(Math.PI/n));
    const ang=p=>Math.atan2(p.z-c.z, p.x-c.x);
    const thB=ang(b), step=2*Math.PI/n;
    // step in whichever direction walks AWAY from a — i.e. the direction whose
    // first vertex is not a. a and b are adjacent, so one of ±step lands on a.
    const dA=((ang(a)-thB)%(2*Math.PI)+2*Math.PI)%(2*Math.PI);
    const dir=(Math.abs(dA-step)<Math.abs(dA-(2*Math.PI-step))) ? -1 : +1;
    const idx=[];
    for(let k=1;k<=n-2;k++){
      const th=thB+dir*k*step;
      idx.push(s.put(els[k-1], V(c.x+R*Math.cos(th), 0, c.z+R*Math.sin(th))));
    }
    s.link(j, idx[0]);
    for(let k=0;k<idx.length-1;k++) s.link(idx[k], idx[k+1]);
    s.link(idx[idx.length-1], i);
    return idx;
  }
  // Hang an H off a flat ring atom, in the ring plane, bisecting its two
  // neighbours from the outside. Doing this with freeTet() would push the H out
  // of the plane and make the ring look puckered when it is not.
  function flatH(s, i, dist){
    const dir=vnorm(vmul(s.nbrs(i).reduce(vadd,V(0,0,0)),-1));
    const h=s.put('H', vadd(s.at(i), vmul(dir, dist)));
    s.link(i,h);
    return h;
  }

  // ---- the intermediates ------------------------------------------------
  // `gly` is this page's metadata block (the analogue of `pep` on the amino
  // acids): `cN` maps the biologist's carbon numbering onto atom indices, `p1`
  // /`p3` are the phosphorus atoms (effect anchors), `cleave` is the bond
  // aldolase breaks, and `carbons` is the count the ledger asserts on screen.
  // Presentation views: which way a molecule should FACE, in radians [x,y,z],
  // applied by Stage.buildMolecule rather than baked into the coordinates. A
  // spec's atom positions stay canonical, so check-molecules.js measures the
  // molecule and not a camera angle, and two specs can share one view by name
  // instead of by copying three constants and a comment.
  // ENUM: a new shared angle goes here, not inline in a spec — CLAUDE.md
  // "Keeping the docs true" lists this table as one that goes stale silently.
  const VIEW = {
    // The 3/4 chair. Every pyranose on every page uses this, which is what makes
    // glucose look the same in glycolysis-lab, macromolecule-lab and contrast-lab.
    pyranose:[1.05, 0.45, -0.2],
    furanose:[-0.89, -2.723, -1.257],
    // Flat aromatics are built in the xz-plane, so they need turning face-on.
    flatRing:[-Math.PI/2, 0.35, 0],
  };

  const GLYCOLYSIS = {};
  {
    // — glucose: the only ring on the page, and the only unphosphorylated sugar
    const g=ringPyranose();
    const C=[1,2,3,4,5];                  // ring C1…C5
    const RING=[0,1,2,3,4,5];             // O5 + C1…C5, the pyranose ring itself
    // EVERY substituent equatorial — that is what makes this β-D-glucopyranose
    // rather than one of its 15 stereoisomers. Passing slot 0 here (as an earlier
    // version did) alternates axial/equatorial around the ring, which is not
    // glucose and, at C5, not even D-.
    const OH=[];                          // the hydroxyl O's, in C1…C4 then C6 order
    C.forEach(k=>{ if(k<5) OH.push(g.hydroxyl(k, g.equatorial(k,RING))); });
    const c6=g.grow(5,'C',GL.CC,'sp3',g.equatorial(5,RING));   // C6, exocyclic
    OH.push(g.hydroxyl(c6,0));            // free rotor off the ring — no ax/eq here
    // C–H hydrogens. Grown LAST so every index above (cN, c6, the OH's) is
    // unchanged — glycolysis-lab addresses those by position. Every other spec
    // on the pathway omits C–H entirely, and this one keeps that look by listing
    // them all in `optH`: glycolysis-lab hides optional H, macromolecule-lab
    // offers them behind its toggle. A ring carbon has three bonds already, so
    // exactly one slot is free; C6 has two.
    const CH=[];
    C.forEach(k=>CH.push(g.grow(k,'H',GL.CH,'sp3',0)));
    CH.push(g.grow(c6,'H',GL.CH,'sp3',0), g.grow(c6,'H',GL.CH,'sp3',0));
    // Rotate to a clear 3D 3/4 chair perspective (ring face tilted towards camera)
    // the H on each hydroxyl O is grown immediately after its O, so it is the
    // next index — asserted rather than assumed, since a Skel change would move it
    const ohH=OH.map(o=>{
      const b=g.bonds.find(b=>(b[0]===o||b[1]===o) && g.atoms[b[0]===o?b[1]:b[0]].el==='H');
      return b[0]===o?b[1]:b[0];
    });
    GLYCOLYSIS.glucose=g.spec({ name:'Glucose', formula:'C₆H₁₂O₆', class:'sugar',
      // asserted by check-molecules.js — the one property that no bond length,
      // bond angle or screenshot can confirm, and the one that makes it glucose
      stereo:'all-equatorial',
      view:VIEW.pyranose,
      optH:CH,                            // nonpolar C–H; the five O–H are never optional
      mono:'carbohydrate',                // macromolecule-lab.html: the carbohydrate monomer
      gly:{ carbons:6, ring:true, cN:[...C,c6], phosphates:0,
            note:'β-D-glucopyranose — the ring form that dominates in water' },
      // functional-group index map for macromolecule-lab.html's gallery — the
      // same kind of contract as `gly` above. Derived from the build variables,
      // not typed out, so re-ordering the build can't silently mislabel a group.
      groups:[
        { key:'hydroxyl', label:'Hydroxyl', formula:'–OH',
          atoms:[...OH,...ohH],
          note:'Five of them. Every one is a hydrogen-bond site — which is why sugar dissolves in water.' },
        { key:'ring', label:'Ring oxygen', formula:'–O–', atoms:[0],
          note:'The pyranose ring closes through an oxygen, not a sixth carbon.' },
        { key:'anomeric', label:'Anomeric carbon', formula:'C1', atoms:[1,OH[0],ohH[0]],
          note:'The one carbon bonded to two oxygens. Its –OH points equatorial here (β); flipping it to axial gives α — and α vs β is the whole difference between starch and cellulose.' },
      ],
      // contrast-lab.html: glucose is the reference half of the glucose/galactose
      // pair. `diff` is C4 and its hydroxyl — the one position where galactose
      // differs — derived from the build variables above rather than typed, so
      // re-ordering this build cannot silently point the highlight elsewhere.
      contrast:{ pair:'glucose-galactose', partner:'galactose',
        differs:'one –OH orientation',
        lesson:'why galactosemia is a disease',
        diff:[4, OH[3], ohH[3]],
        // The atoms this molecule shares with its partner, used to register the
        // two against each other on screen. Both are centred on the centroid of
        // their own `align` set, so the part they have in common lands in the
        // same place and the only visible offset is the real difference.
        align:RING,
        note:'C4’s –OH lies equatorial, in the plane of the ring, like every other '
           + 'substituent here. All-equatorial is what makes glucose the most stable '
           + 'hexose — and the one sugar nearly every organism runs on.' } });
  }
  {
    // — glucose-6-phosphate: ring has opened to the aldose chain; P on C6.
    //   Hexokinase's product, and the step that traps glucose inside the cell
    //   (the phosphate's charge means it can't slip back out through GLUT).
    const g=chainC(6);
    g.carbonyl(0,0); g.grow(0,'H',GL.CH,'sp2',0);          // C1 aldehyde, incl. its H
    for(let k=1;k<=4;k++) g.hydroxyl(k, k%2);              // C2…C5 –OH, alternating face
    const p=g.phosphate(5,0);                              // C6 –O–PO₃
    GLYCOLYSIS.g6p=g.spec({ name:'Glucose-6-phosphate', formula:'C₆H₁₃O₉P²⁻', class:'sugar',
      gly:{ carbons:6, cN:[0,1,2,3,4,5], p3:p, phosphates:1 } });
  }
  {
    // — fructose-1,6-bisphosphate: both ENDS phosphorylated, and the carbonyl has
    //   moved C1 → C2 (aldose → ketose). That shift is the isomerase step, shown
    //   as a visible change rather than given its own stage.
    const g=chainC(6);
    const p1=g.phosphate(0,0);                             // C1 –O–PO₃
    g.carbonyl(1,0);                                       // C2 ketone
    for(let k=2;k<=4;k++) g.hydroxyl(k, k%2);              // C3…C5 –OH
    const p6=g.phosphate(5,0);                             // C6 –O–PO₃
    GLYCOLYSIS.f16bp=g.spec({ name:'Fructose-1,6-bisphosphate', formula:'C₆H₁₄O₁₂P₂⁴⁻', class:'sugar',
      gly:{ carbons:6, cN:[0,1,2,3,4,5], p1, p3:p6, phosphates:2,
            cleave:[2,3],           // aldolase cuts C3–C4 → DHAP (C1-3) + G3P (C4-6)
            note:'drawn open-chain (Fischer) though it is really a furanose ring' } });
  }
  {
    // — DHAP: the C1–C3 half of the cut. A ketose, so it is NOT yet a substrate
    //   for the payoff phase; triose-phosphate isomerase converts it to G3P.
    const g=chainC(3);
    const p=g.phosphate(0,0);
    g.carbonyl(1,0);
    g.hydroxyl(2,1);
    GLYCOLYSIS.dhap=g.spec({ name:'Dihydroxyacetone phosphate', formula:'C₃H₇O₆P²⁻', class:'sugar',
      gly:{ carbons:3, cN:[0,1,2], p1:p, phosphates:1 } });
  }
  {
    // — G3P: the C4–C6 half, renumbered C1–C3. The aldehyde H on C1 is drawn
    //   because THAT is the hydrogen NAD⁺ takes in the next stage.
    const g=chainC(3);
    g.carbonyl(0,0); const h=g.grow(0,'H',GL.CH,'sp2',0);
    g.hydroxyl(1,1);
    const p=g.phosphate(2,0);
    GLYCOLYSIS.g3p=g.spec({ name:'Glyceraldehyde-3-phosphate', formula:'C₃H₇O₆P²⁻', class:'sugar',
      gly:{ carbons:3, cN:[0,1,2], p3:p, phosphates:1, aldehydeH:h } });
  }
  {
    // — 1,3-BPG: G3P oxidised. The aldehyde H is gone (it left with 2e⁻ on NAD⁺)
    //   and a phosphate from the cytosol has taken its place on C1. That C1
    //   phosphate sits on an ACYL phosphate — the high-energy bond whose
    //   hydrolysis pays for the first ATP. Nothing spent ATP to attach it.
    const g=chainC(3);
    g.carbonyl(0,0);
    const p1=g.phosphate(0,1);                             // C1 acyl phosphate
    g.hydroxyl(1,1);
    const p3=g.phosphate(2,0);
    GLYCOLYSIS.bpg13=g.spec({ name:'1,3-bisphosphoglycerate', formula:'C₃H₈O₁₀P₂⁴⁻', class:'sugar',
      gly:{ carbons:3, cN:[0,1,2], p1, p3, phosphates:2, hot:p1 } });
  }
  {
    // — 3-phosphoglycerate: C1 phosphate handed to ADP, leaving a carboxylate.
    //   Drawn ionised (–COO⁻), which is accurate at cytosolic pH ~7.2. (The
    //   amino-acid page draws the neutral –COOH instead, because there the
    //   leaving –OH has to be visible; here nothing leaves, so accuracy wins.)
    const g=chainC(3);
    g.carbonyl(0,0); g.grow(0,'O',GL.CdO,'sp2',0);         // carboxylate: two O's
    g.hydroxyl(1,1);
    const p=g.phosphate(2,0);
    GLYCOLYSIS.pga3=g.spec({ name:'3-phosphoglycerate', formula:'C₃H₆O₇P²⁻', class:'sugar',
      gly:{ carbons:3, cN:[0,1,2], p3:p, phosphates:1, hot:p } });
  }
  {
    // — pyruvate: the finish line. Three carbons, no phosphate left, and a
    //   methyl at C3 as a united atom (same convention as alanine's –CH₃).
    const g=chainC(3);
    g.carbonyl(0,0); g.grow(0,'O',GL.CdO,'sp2',0);         // C1 carboxylate
    g.carbonyl(1,0);                                       // C2 ketone
    GLYCOLYSIS.pyruvate=g.spec({ name:'Pyruvate', formula:'C₃H₃O₃⁻', class:'sugar',
      gly:{ carbons:3, cN:[0,1,2], phosphates:0, terminal:true } });
  }
  {
    // — inorganic phosphate (Pi), the free phosphate already dissolved in the
    //   cytosol. Students routinely assume the second phosphate on 1,3-BPG cost
    //   an ATP; it did not, it came from here, so Pi is drawn as its own species.
    const s=new Skel(); s.put('P',V(0,0,0));
    [[1,1,1],[1,-1,-1],[-1,1,-1],[-1,-1,1]].forEach(d=>{
      s.link(0, s.put('O', vmul(vnorm(V(d[0],d[1],d[2])), GL.PO))); });
    s.grow(1,'H',GL.OH,'sp3',0);
    GLYCOLYSIS.pi=s.spec({ name:'Inorganic phosphate', formula:'HPO₄²⁻', class:'ion',
      gly:{ carbons:0, phosphates:1, free:true } });
  }
  Object.assign(MOLECULES, GLYCOLYSIS);

  /* ---------------------------------------------------------------------
   *  CONTRAST PAIRS — contrast-lab.html
   * ---------------------------------------------------------------------
   *  Family B (real Å × SCALE), so a pair is genuinely comparable: if these
   *  came from different scale families the whole page would be a lie.
   *
   *  Every molecule here is Tier 2 in SCIENCE.md's sense — it exists only to be
   *  shown beside a near-identical sibling, where ONE feature is the entire
   *  lesson. That feature is therefore asserted by check-molecules.js, never
   *  merely drawn. Each spec carries a `contrast` block naming its partner, the
   *  lesson, and `diff` — the atoms that differ, which is what the page dims
   *  everything else down to.
   * ------------------------------------------------------------------- */
  const CONTRAST = {};
  {
    // — galactose: β-D-galactopyranose. Built by exactly the same sequence as
    //   glucose above, with ONE substitution: C4's –OH is axial, not equatorial.
    //   That is the whole molecule's reason to exist on this page, so the build
    //   deliberately mirrors glucose's line for line — if the two builds drifted
    //   apart, a difference could show up on screen that is not the difference.
    const g=ringPyranose();
    const C=[1,2,3,4,5];
    const RING=[0,1,2,3,4,5];
    const C4=4;                           // ring index of C4 — the one flipped atom
    const OH=[];
    C.forEach(k=>{ if(k<5) OH.push(g.hydroxyl(k, k===C4 ? g.axial(k,RING) : g.equatorial(k,RING))); });
    const c6=g.grow(5,'C',GL.CC,'sp3',g.equatorial(5,RING));
    OH.push(g.hydroxyl(c6,0));
    const CH=[];
    C.forEach(k=>CH.push(g.grow(k,'H',GL.CH,'sp3',0)));
    CH.push(g.grow(c6,'H',GL.CH,'sp3',0), g.grow(c6,'H',GL.CH,'sp3',0));
    const ohH=OH.map(o=>{
      const b=g.bonds.find(b=>(b[0]===o||b[1]===o) && g.atoms[b[0]===o?b[1]:b[0]].el==='H');
      return b[0]===o?b[1]:b[0];
    });
    CONTRAST.galactose=g.spec({ name:'Galactose', formula:'C₆H₁₂O₆', class:'sugar',
      // C4 axial, every other substituent equatorial. `all-equatorial` here would
      // be glucose — and the render of the two is very nearly the same picture.
      stereo:{ axial:[C4] },
      view:VIEW.pyranose,       // the same object as glucose's — they cannot drift
      optH:CH,
      contrast:{ pair:'glucose-galactose', partner:'glucose',
        differs:'one –OH orientation',
        lesson:'why galactosemia is a disease',
        diff:[C4, OH[3], ohH[3]],
        align:RING,
        note:'Same formula, same atoms, same bonds — C4’s –OH points axial instead '
           + 'of equatorial. One enzyme (GALT) tells them apart. Without it, galactose '
           + 'from milk builds up and damages the liver, eyes and brain.' } });
  }
  {
    // — ribose and 2-deoxyribose. Built by one shared function, because "the same
    //   molecule minus one oxygen" has to be literally that: the deoxy build runs
    //   the identical sequence and swaps a single hydroxyl for a hydrogen.
    //   β-D-ribofuranose faces: 1′-OH and 5′ up (that pairing is what β- means),
    //   2′-OH and 3′-OH down.
    const UP=+1, DOWN=-1;
    function riboFuranose(deoxy){
      const s=ringFuranose();
      const RING=[0,1,2,3,4];             // O4′, C1′, C2′, C3′, C4′
      const c1=1,c2=2,c3=3,c4=4;
      const o1=s.hydroxyl(c1, s.face(c1,RING,UP));
      // the 2′ position — the entire difference between the two sugars
      const o2 = deoxy ? null : s.hydroxyl(c2, s.face(c2,RING,DOWN));
      const h2 = deoxy ? s.grow(c2,'H',GL.CH,'sp3',s.face(c2,RING,DOWN)) : null;
      const o3=s.hydroxyl(c3, s.face(c3,RING,DOWN));
      const c5=s.grow(c4,'C',GL.CC,'sp3',s.face(c4,RING,UP));
      const o5=s.hydroxyl(c5,0);
      // C–H last, so every index above is stable (same discipline as glucose)
      const CH=[ s.grow(c1,'H',GL.CH,'sp3',0), s.grow(c2,'H',GL.CH,'sp3',0),
                 s.grow(c3,'H',GL.CH,'sp3',0), s.grow(c4,'H',GL.CH,'sp3',0),
                 s.grow(c5,'H',GL.CH,'sp3',0), s.grow(c5,'H',GL.CH,'sp3',0) ];
      const ohH=o=>{ const b=s.bonds.find(b=>(b[0]===o||b[1]===o) && s.atoms[b[0]===o?b[1]:b[0]].el==='H');
        return b[0]===o?b[1]:b[0]; };
      return { s, RING, c2, o1, o2, h2, o3, c5, o5, CH, ohH };
    }
    // Faces are declared by LABEL, not by sign: the ring normal's sign falls out
    // of ring traversal order, so only which substituents share a face is
    // meaningful — and that is exactly what makes this ribose rather than one of
    // its stereoisomers (arabinose, xylose, lyxose all differ only here).
    const FACES={ 1:'a', 2:'b', 3:'b', 4:'a' };

    const r=riboFuranose(false);
    CONTRAST.ribose=r.s.spec({ name:'Ribose', formula:'C₅H₁₀O₅', class:'sugar',
      stereo:{ faces:FACES },
      view:VIEW.furanose,
      optH:r.CH,
      contrast:{ pair:'ribose-deoxyribose', partner:'deoxyribose',
        differs:'one –OH at 2′',
        lesson:'why DNA is the stable archive',
        diff:[r.o2, r.ohH(r.o2)],
        align:r.RING,
        note:'The 2′–OH is the reactive one: it can attack the backbone next door, '
           + 'which is why RNA self-cleaves in minutes to hours. Useful for a '
           + 'short-lived message.' } });

    const d=riboFuranose(true);
    CONTRAST.deoxyribose=d.s.spec({ name:'Deoxyribose', formula:'C₅H₁₀O₄', class:'sugar',
      // C2′ carries no heavy substituent at all now, so it drops out of the face
      // declaration — asserting a face for an atom that isn't there would pass
      // vacuously and tell us nothing.
      stereo:{ faces:{ 1:'a', 3:'b', 4:'a' } },
      view:VIEW.furanose,
      optH:d.CH,
      contrast:{ pair:'ribose-deoxyribose', partner:'ribose',
        differs:'one –OH at 2′',
        lesson:'why DNA is the stable archive',
        diff:[d.h2],
        align:d.RING,
        note:'Take that one oxygen away and the backbone has nothing to attack '
           + 'itself with. DNA lasts — readably — for tens of thousands of years.' } });
  }
  {
    // — purine and pyrimidine, the two parent ring systems. Named as the parents
    //   rather than as adenine/thymine on purpose (SCIENCE.md rule 1): the claim
    //   being made is about ring COUNT and width, and dressing them up with
    //   substituents would add features this page does not check.
    //
    //   Both rings are drawn as regular polygons — a ~4% idealisation, since real
    //   C–N (1.34 Å) is a little shorter than C–C (1.39 Å). That is deliberate:
    //   the lesson is the two-ring vs one-ring WIDTH, and a regular polygon makes
    //   that width read cleanly without changing it meaningfully.

    // pyrimidine: one six-ring, N1 C2 N3 C4 C5 C6 at indices 0…5
    const p=flatRing(6, ['N','C','N','C','C','C']);
    p.order(0,1,2).order(2,3,2).order(4,5,2);      // one Kekulé structure
    const pH=[1,3,4,5].map(i=>flatH(p,i,AR.CH));
    CONTRAST.pyrimidine=p.spec({ name:'Pyrimidine', formula:'C₄H₄N₂', class:'base',
      topology:{ rings:[6] },
      view:VIEW.flatRing,
      contrast:{ pair:'purine-pyrimidine', partner:'purine',
        differs:'one ring vs two',
        lesson:'why A–T and G–C are equal width',
        // The C4–C5 edge and its two hydrogens: on purine this exact edge is
        // where the second ring is fused. Highlighting a plain edge on one side
        // and a whole fused ring on the other is what makes the absence visible
        // — a pyrimidine's difference from a purine is something it does NOT have.
        diff:[3,4,pH[1],pH[2]],
        align:[0,1,2,3,4,5],
        note:'C and T are pyrimidines — one ring, the narrow ones. Where purine '
           + 'carries a second ring, this edge just carries two hydrogens.' } });

    // purine: the same six-ring with an imidazole fused across C4–C5.
    // Indices 0…5 = N1 C2 N3 C4 C5 C6, then 6,7,8 = N7 C8 N9.
    const q=flatRing(6, ['N','C','N','C','C','C']);
    const five=fuseRing(q, 5, 3, 4, V(0,0,0), ['N','C','N']);   // N7, C8, N9
    q.order(0,1,2).order(2,3,2).order(4,5,2);      // six-ring, same Kekulé form
    q.order(five[0],five[1],2);                    // N7=C8
    const qH=[1,5,five[1]].map(i=>flatH(q,i,AR.CH));
    qH.push(flatH(q,five[2],AR.NH));               // N9–H, the 9H tautomer
    CONTRAST.purine=q.spec({ name:'Purine', formula:'C₅H₄N₄', class:'base',
      topology:{ rings:[5,6], fused:true },
      view:VIEW.flatRing,
      contrast:{ pair:'purine-pyrimidine', partner:'pyrimidine',
        differs:'one ring vs two',
        lesson:'why A–T and G–C are equal width',
        diff:[3,4,...five, ...qH.slice(2)],
        align:[0,1,2,3,4,5],      // the pyrimidine ring, before the fusion
        note:'A and G are purines — two fused rings, the wide ones. Every base pair '
           + 'is one wide plus one narrow, so the DNA ladder keeps a constant 2 nm '
           + 'rung. Two purines would bulge; two pyrimidines would pinch.' } });
  }
  Object.assign(MOLECULES, CONTRAST);

  // SCALE is exported so Stage.measure() can divide it back out and report real
  // angstroms. Pages used to hard-code 1.9 to do that, which silently becomes
  // wrong the day this constant moves.
  global.MolLib = { PALETTE, MOLECULES, SCALE };
})(this);
