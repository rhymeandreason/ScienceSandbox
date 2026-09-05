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
      Zn: 0x9c8fbe,   // zinc — muted violet. Third of the deposition-only
                      // metals, so like Fe and Co it has a colour and no
                      // display radius. STRUCTURAL rather than catalytic where
                      // it turns up here: a zinc finger is not a fold that
                      // binds zinc, it is a fold that does not exist without
                      // it, so the metal has to read as part of the protein
                      // rather than as something bound to it. Violet keeps it
                      // clear of iron's rust and cobalt's teal, and clear of
                      // the base family it sits beside on a DNA complex.
      Co: 0x2f7f8f,   // cobalt — deep teal. Like Fe it arrives only from a
                      // DEPOSITION and has no display radius; proteinbox sizes
                      // both off carbon. NOT cobalt blue, which is the one
                      // colour the palette cannot spare: nitrogen's indigo and
                      // potassium's blue are both there already, and a metal
                      // that reads as either is worse than a metal that reads
                      // as no colour in particular. Teal is unclaimed and
                      // clears chlorine's green.
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
      condense:  0x6a5acd,   // A BOND MADE BY DEHYDRATION SYNTHESIS — slate
                             // violet, so a newly-formed link reads distinct
                             // from the ordinary covalent sticks around it.
                             // One colour for one reaction: the peptide bond,
                             // the glycosidic bond and the phosphoester are the
                             // same event on different groups, and a page that
                             // gave each its own colour would be saying they
                             // are different chemistry. Was `peptide`, which
                             // named the protein case as though it were the
                             // whole rule. fx.js's condense() flares in it.
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
    // ---- bases: a nucleotide's identity, carried by half a rung ---------
    // kit/nucleic.js splits every base pair at its own hydrogen bonds and
    // colours each half by which base it came from, the same split-stick
    // convention kit/proteinbox.js uses inside a pocket. So these four are
    // read at 2 A wide against the paper AND against each other, in pairs
    // that are always adjacent: G with C, A with T or U.
    //
    // THE PAIRING PARTNERS ARE COMPLEMENTARY IN HUE, not merely different.
    // A reader learns G-C and A-T as two colour combinations before learning
    // them as letters, so the pair has to read as one object with two halves
    // rather than as two unrelated bars. Purines are the darker half of each
    // pair (G, A), which also puts the larger ring on the heavier colour.
    //
    // T and U are the SAME colour deliberately: they are the same base to
    // everything except the 5-methyl, and a lesson comparing DNA to RNA wants
    // the reader looking at the backbone, not at a colour change nobody
    // explained.
    bases: {
      G: 0x3f6ae0,   // guanine  — indigo, cytosine's partner
      C: 0x63c1d8,   // cytosine — pale cyan
      A: 0xc4452f,   // adenine  — deep red, thymine/uracil's partner
      T: 0xe0a03c,   // thymine  — warm amber
      U: 0xe0a03c,   // uracil   — the same amber, on purpose
      X: 0x8a8578,   // a base the file names and this repo cannot letter:
                     // stone, so it reads as "not one of the four" rather
                     // than as a fifth base
    },
    // ---- the four histones ------------------------------------------------
    // A nucleosome is eight chains of ONE fold, so the ss palette answers the
    // wrong question there: what a reader has to tell apart is which histone,
    // and the octamer's whole shape is (H3-H4)2 with two H2A-H2B dimers. The
    // two copies of a histone share a colour, because they are the same
    // protein and the picture should say the octamer is four PAIRS.
    //
    // They have to clear two families at once, which is what fixes them here
    // rather than leaving them to a page: `bases` sits on the rungs threading
    // right through the octamer, and `strands` is the DNA's own backbone
    // wrapped around it. Green and magenta are spoken for by the second, and
    // indigo, cyan, red and amber by the first — so these four are muted and
    // sit in the gaps between: teal, ochre, violet, terracotta.
    histones: {
      H3:  0x3f7f8c,
      H4:  0xa8823f,
      H2A: 0x6d5f9e,
      H2B: 0x9c5f52,
    },
    // ---- secondary structure: how kit/ribbon.js's cartoon is coloured -----
    // The house ss palette, and it lived inside kit/proteinbox.js as `RIB`
    // until a second consumer needed it. Coil is a warm grey so the parts that
    // are not making a claim recede; helix takes the same deep blue as an
    // H-bond, and strand the amber the ion-dipole bond uses.
    ss: {
      C: 0x7d8c7a,   // coil
      H: 0x0042aa,   // helix
      E: 0xc2571b,   // strand
    },
    // ---- strands: the sugar-phosphate backbone kit/nucleic.js draws --------
    // The quiet channel, and deliberately so. `bases` above are all saturated
    // and light, because the rungs are what a reader is meant to land on; a
    // backbone that goes anywhere near them starts reading as a fifth and
    // sixth base, which is what a blue-and-orange pair did before these.
    //
    // GREEN AND MAGENTA ARE THE TWO HUES `bases` LEAVES FREE — nothing in it
    // is either — and they are far enough apart in the blue channel to stay
    // separable for a reader who cannot use the red-green one. Two strands
    // have to be told apart or antiparallel is invisible, and that is the only
    // thing a backbone's colour has to say.
    //
    // THESE ARE LIGHTER IN THE FILE THAN THEY LOOK ON SCREEN. lib/scene.js
    // renders with LinearEncoding and no tone mapping, so every colour here
    // reaches the screen darker than its hex — house-wide, and not something
    // one page gets to change. A hex picked by eye off a swatch always comes
    // out disappointing. Judge them in the render.
    strands: {
      a:   0x4ad18c,   // first strand  — green
      b:   0xef73ad,   // second strand — magenta
      one: 0xd8d2c4,   // a chain with nothing to be told apart from: tRNA is
                       // ONE strand paired to itself, so a second colour there
                       // would claim a second molecule
    },
    /* ---- organelles ---------------------------------------------------
       ONE ORGANELLE, ONE COLOUR, wherever it is drawn. cell/cutaway.js chose
       these by eye against the cream paper and typed them inline; they are
       the house colours now, because the cutaway is where a student meets an
       organelle first and every later view of one has to agree with it. A
       lesson that zooms from the cut cell into a mitochondrion's inner
       membrane must not arrive somewhere a different colour.

       `outer` / `inner` / `rim` are the cutaway's shell: the outside face,
       the cut face (darker — a cut edge reads as depth), and the rim between.

       `head` / `tail` TINT A BILAYER drawn inside that organelle
       (membrane/membrane.js's `context`). Both are derived from the
       organelle's own colour, and they keep the relationship the plasma
       membrane has always had: a saturated head over a paler, warmer tail.
       So the sheet still reads as the same bilayer everywhere — the tint
       says which organelle you are standing in, not what the membrane is
       made of. */
    organelles: {
      /* A CUT SHELL is three colours: `outer` the outside face, `inner` the
         cut face (darker, so a cut edge reads as depth), `rim` the band
         between. An organelle drawn as ribbons instead carries `side` and
         `top` — the ER and the mitochondrion's cristae. */
      plasma:        { outer:0xee8e84, inner:0xa8132a, rim:0xf4b0a6, head:0xe0705c, tail:0xf0c98a },
      mitochondrion: { outer:0xe0552f, inner:0xe2775b, rim:0xf4b8a4, head:0xd9612f, tail:0xeeba7e,
                       cristaSide:0xf2a3ae, cristaTop:0xfff6f7 },
      /* Not in the animal cell, so it has no cutaway entry to copy: the
         green comes from leaf/leaf.js's `chloro`, lightened to the same
         degree the other heads are lightened off their shells. */
      chloroplast:   { outer:0x4f8a33, inner:0x37701f, rim:0xa7c98a, head:0x5f9440, tail:0xcfdc9a },
      nucleus:       { outer:0x3f6cb5, inner:0x4a78c0, rim:0x9cb9e6, head:0x4a78c0, tail:0xb9c9e8,
                       nucleolus:0xf6b64a, chromatin:0x3d64a8, pore:0x274a8f },
      er:            { side:0xd9426d, top:0xf6c0ce, ribosome:0x7c1030, head:0xd9426d, tail:0xf6c0ce },
      golgi:         { outer:0x7c85cf, inner:0x7c85cf, rim:0xb4bae6, head:0x7c85cf, tail:0xc2c7ea,
                       vesicle:0x8b93da },
      lysosome:      { outer:0xec6f95, inner:0xd94f6a, rim:0xf3bdcb, head:0xec6f95, tail:0xf3bdcb },
      /* No membrane, so no head/tail: a bilayer cannot be set inside a
         centrosome, and an entry that offered one would invite a page to
         try. */
      centrosome:    { outer:0x6fbe62, microtubule:0x8bd07c },
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
