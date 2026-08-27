/* =====================================================================
 *  palette.js — atom + bond colours, and display radii.
 *
 *  Loaded BEFORE molecules.js on every page (and by lib-node.js for the
 *  checkers). molecules.js re-exports it as MolLib.PALETTE, so every reader
 *  still says MolLib.PALETTE.atoms.O — this file is only where the numbers
 *  live.
 *
 * ---------------------------------------------------------------------
 *  THESE ARE HOUSE COLOURS
 * ---------------------------------------------------------------------
 *  They're CPK-adjacent — red oxygen, blue nitrogen, green chlorine, orange
 *  phosphorus — so a student still transfers to a textbook figure or a
 *  PubChem page. But each one is muted and warmed for the cream paper this
 *  sandbox is drawn on. 
 *  Two choices that are load-bearing rather than cosmetic:
 *    - H is a pale steel (0xb9c2d0), not white. White hydrogens have no edge
 *      against cream; the steel keeps them readable as objects.
 *    - Na (violet) and K (blue) are pushed well apart. molecule-builder.html
 *      shows NaCl and KCl on adjacent tabs, and the standard palettes put
 *      those two nearly on top of each other.
 * ===================================================================== */
(function(global){
  'use strict';

  const PALETTE = {
    // ---- atoms (hex ints) ---------------------------------------------
    // These double as the swatches in water-lab's Debug ▸ Colours tab;
    // editing PALETTE.atoms live keeps every molecule on the page consistent.
    atoms: {
      O:  0xd6362e,   // oxygen   — red
      H:  0xb9c2d0,   // hydrogen — pale steel
      Na: 0x9a3fe0,   // sodium   — violet
      Cl: 0x1fa968,   // chloride — green
      K:  0x0054C0,   // potassium — blue (distinct from Na)
      Mg: 0xcf3b74,   // magnesium — rose. Third metal on the builder's ionic
                      // tabs, so it has to clear violet AND blue as well as
                      // chlorine's green: pushed warm and pink, the one
                      // direction Na and K are not.
      C:  0x3a3a3a,   // carbon   — charcoal
      N:  0x3f6ae0,   // nitrogen — blue
      S:  0xe0b93a,   // sulfur   — goldenrod (cysteine / methionine)
      Fe: 0xa8321a,   // iron     — rust. The one atom here that arrives only
                      // from a DEPOSITION: it is a heme's metal, never part of
                      // a spec, so it has a colour and deliberately no display
                      // radius — kit/proteinbox.js sizes it as a multiple of
                      // carbon so it stays the biggest atom in the group at
                      // whatever scale the ring is drawn.
      P:  0xe07b1f,   // phosphorus — orange (CPK). Deliberately the warmest atom
                      // in the palette: in glycolysis the phosphate IS the energy
                      // currency, so every P a student sees is "something ATP paid
                      // for or will be paid back". No other lesson uses P, so it
                      // can't be confused with sulfur's goldenrod.
    },
    // ---- bonds: a bond's colour is a lesson, not an element ------------
    bonds: {
      covalent:  0xb3a892,   // covalent stick — muted stone on cream
      hbond:     0x0042aa,   // hydrogen bond  — deep blue
      iondipole: 0xd9791e,   // ion–dipole bond — deep amber
      peptide:   0x6a5acd,   // peptide (amide C–N) bond — slate violet, so the
                             // newly-formed backbone link reads distinct from the
                             // ordinary covalent sticks within each residue
      lonepair:  0x2fb0ff,   // a LONE PAIR (lobes/lobes.js) — the place an
                             // H-bond can land, so it is deliberately in
                             // `hbond`'s family and deliberately not the same
                             // number. A lobe is a translucent VOLUME, and
                             // `hbond`'s navy at 46% over cream comes out
                             // periwinkle — the same hex would have stopped
                             // reading as the same colour. Lifted and pushed
                             // toward cyan instead: bright enough to survive
                             // the alpha, and clear of nitrogen's indigo
                             // (0x3f6ae0), which it has to sit on top of all
                             // over the nucleobases. Separate keys so
                             // retuning one cannot silently restyle the other.
    },
    // ---- default display radii (scene units, stylised — enlarged for
    // legibility). NOT van der Waals radii, and check-molecules.js checks
    // every bond clears the sum of its two. See molecules.js's header.
    // Mg is SMALLER than Na (0.60 vs 0.70) and that is not a styling choice:
    // Mg²⁺ pulls two charges' worth on the same shell count, so the ion is
    // tighter than Na⁺ despite magnesium sitting one place to the right. The
    // builder's MgCl₂ tab is where a student can see it next to NaCl.
    radii: { O:0.95, H:0.55, C:0.85, N:0.90, S:1.05, Na:0.70, Cl:1.24, K:0.85, P:1.00,
             Mg:0.60 },
  };

  global.MolPalette = PALETTE;
  if(typeof module==='object' && module.exports) module.exports = { PALETTE };
})(typeof window!=='undefined' ? window : globalThis);
