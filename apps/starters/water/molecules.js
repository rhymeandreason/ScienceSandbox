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
    },
    bonds: {
      covalent:  0xb3a892,   // covalent stick — muted stone on cream
      hbond:     0x0042aa,   // hydrogen bond  — deep blue
      iondipole: 0xd9791e,   // ion–dipole bond — deep amber
    },
    // default display radii (scene units, stylised — enlarged for legibility)
    radii: { O:0.95, H:0.55, C:0.85, N:0.90, Na:0.70, Cl:1.24, K:0.85 },
  };

  // ---- molecule library ----------------------------------------------
  // Each entry:
  //   name, formula
  //   class    — 'solvent' | 'ionic' | 'polar' | 'nonpolar'
  //   atoms    — [{el, pos:[x,y,z]}]  local positions (bond lengths are
  //              stylised ~1.5–1.9, matching water's exaggerated O–H)
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
      bonds:[ [0,1],[0,2] ],
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
      bonds:[ [0,1],[0,2],[0,3],[2,4],[3,5] ],
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
      bonds:[ [0,1],[0,2],[0,3],[3,4] ],
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
  };

  global.MolLib = { PALETTE, MOLECULES };
})(this);
