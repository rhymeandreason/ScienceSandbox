/* =====================================================================
 *  mol-solvation.js — the hand-written solvation set (family A)
 * ===================================================================== */
(function(global){
  'use strict';
  const SELFNAME = 'mol-solvation.js';
  // Registry from molecules.js. Domain files only ever ADD to it.
  const Lib = global.MolLib
    || (typeof require === 'function' ? require('./molecules.js').MolLib : null);
  if (!Lib) throw new Error(SELFNAME + ': molecules.js must be loaded first');
  const { MOLECULES, VIEW, register } = Lib;

  // FAMILY A. Every bond length here was chosen individually to clear its two
  // display radii, and water-lab/molecule-lab hard-code HL=1.55 and tune their
  // whole solvation engine around it. These may not share a SCENE with family B
  // — a page whose stages are separate may load both, and says so at its script
  // tags. mol-small.js is the exception either way: same keys, never both.
  // See the scale-families note in molecules.js. Needs no builder.
  register({
    water: {
      name:'Water', formula:'H₂O', class:'solvent',
      atoms:[ {el:'O',pos:[0,0,0]}, {el:'H',pos:[1.226,-0.948,0]}, {el:'H',pos:[-1.226,-0.948,0]} ],
      bonds:[ [0,1],[0,2] ],
      sites:{ donors:[{atom:1},{atom:2}], acceptors:[{atom:0, lonePairs:2}] },
      // The O–H of 1.55 against radii summing to 1.50 is the constant the whole
      // solvation engine is tuned around (HL in water-lab/molecule-lab), which
      // is why family A cannot be rescaled — see the header and item 7.
      units:'scene',   // family A: hand-picked display lengths, not real Angstroms x anything
      src:{path:'hand'},
    },
    nacl: {
      name:'Salt', formula:'NaCl', class:'ionic',
      dissociates:[ {ion:'Na', charge:+1, radius:0.70}, {ion:'Cl', charge:-1, radius:1.24} ],
      // No coordinates at all — an ionic solute is only ever drawn as the two
      // dissociated ions. `path:'hand'` covers the chosen radii and charges.
      units:'scene',   // family A: hand-picked display lengths, not real Angstroms x anything
      src:{path:'hand'},
    },
    kcl: {
      name:'Potassium chloride', formula:'KCl', class:'ionic',
      dissociates:[ {ion:'K', charge:+1, radius:0.85}, {ion:'Cl', charge:-1, radius:1.24} ],
      units:'scene',   // family A: hand-picked display lengths, not real Angstroms x anything
      src:{path:'hand'},
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
      units:'scene',   // family A: hand-picked display lengths, not real Angstroms x anything
      src:{path:"hand"},
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
      units:'scene',   // family A: hand-picked display lengths, not real Angstroms x anything
      src:{path:"hand"},
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
      units:'scene',   // family A: hand-picked display lengths, not real Angstroms x anything
      src:{path:"hand"},
    },
    o2: {
      name:'Oxygen', formula:'O₂', class:'nonpolar',
      // THE NONPOLAR REFERENCE, and the cleanest one there is: two identical
      // atoms, so there is no electronegativity difference to make a dipole and
      // nothing for water to H-bond to at all. Methane is the usual stand-in and
      // it is a weaker example — CH₄ at least has polarisable C–H. O₂ has
      // nothing, which is why it crosses a lipid bilayer freely while glucose,
      // barely three times its radius, needs a transporter.
      //   → NO acceptors, despite being oxygen. This is the trap: an O in a
      //     C=O or O–H is a fine H-bond acceptor, and it is easy to give the
      //     same lone pairs to O₂ by pattern. Its lone pairs sit on a homonuclear
      //     bond with no partial charge, and O₂ is ~30× LESS soluble than CO₂
      //     for exactly that reason. Listing acceptors here would draw water
      //     shells around it and teach the opposite.
      atoms:[ {el:'O',pos:[1.05,0,0]}, {el:'O',pos:[-1.05,0,0]} ],
      bonds:[ [0,1,2] ],
      sites:{ donors:[], acceptors:[] },
      hydrophobic:[0,1],
      units:'scene',   // family A: hand-picked display lengths, not real Angstroms x anything
      src:{path:'hand'},
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
      units:'scene',   // family A: hand-picked display lengths, not real Angstroms x anything
      src:{path:"hand"},
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
      units:'scene',   // family A: hand-picked display lengths, not real Angstroms x anything
      src:{path:"hand"},
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
      units:'scene',   // family A: hand-picked display lengths, not real Angstroms x anything
      src:{path:"hand"},
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
      units:'scene',   // family A: hand-picked display lengths, not real Angstroms x anything
      src:{path:"hand"},
    },
  }, SELFNAME);
})(this);
