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
  };

  // ---- molecule library (populated in the next step) ------------------
  // Each entry: { name, formula, class, atoms:[{el,pos}], bonds:[[i,j]],
  //   sites:{donors,acceptors}, dissociates?, hydrophobic? }
  // class ∈ 'solvent' | 'ionic' | 'polar' | 'nonpolar' | 'weak-acid'
  const MOLECULES = {};

  global.MolLib = { PALETTE, MOLECULES };
})(this);
