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
      K:  0x7b5cf0,   // potassium — lilac (distinct from Na)
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
      atoms:[ {el:'C',pos:[-2.5,0,0]},          // 0 methyl C
              {el:'C',pos:[-1.1,0.5,0]},        // 1 methylene C
              {el:'O',pos:[0.2,-0.1,0]},        // 2 hydroxyl O
              {el:'H',pos:[1.0,0.5,0]},         // 3 hydroxyl H (donor)
              {el:'H',pos:[-3.13,0.78,0]},      // 4 methyl H
              {el:'H',pos:[-2.66,-0.56,0.82]},  // 5 methyl H
              {el:'H',pos:[-2.66,-0.56,-0.82]}, // 6 methyl H
              {el:'H',pos:[-1.07,1.14,0.77]},   // 7 methylene H
              {el:'H',pos:[-1.07,1.14,-0.77]} ],// 8 methylene H
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
      name:'Carbon dioxide', formula:'CO₂', class:'nonpolar',
      // linear O=C=O; symmetric so no net dipole → nonpolar. (The carbonation
      // reaction to carbonic acid is a later behaviour, not modelled yet.)
      atoms:[ {el:'C',pos:[0,0,0]}, {el:'O',pos:[1.9,0,0]}, {el:'O',pos:[-1.9,0,0]} ],
      bonds:[ [0,1],[0,2] ],
      sites:{ donors:[], acceptors:[{atom:1, lonePairs:2},{atom:2, lonePairs:2}] },
      hydrophobic:[0,1,2],
    },
  };

  global.MolLib = { PALETTE, MOLECULES };
})(this);
