/* =====================================================================
 *  mol-vitamins.js — the molecules we cannot make and have to eat
 * =====================================================================
 *  SPLIT ON COST, NOT ON TOPIC — the same argument mol-krebs.js makes.
 *  molecules.js's manifest note is explicit that a topic-shaped file
 *  ("respiration") earns nothing, because the partition that matters is
 *  which builder a spec needs and which scale family it is in. These are
 *  Skel builds in family B like half the library, so on derivation alone
 *  they could sit in any of those files.
 *
 *  What justifies a file is that nothing else wants them. A collagen page
 *  drawing ascorbate would otherwise parse seventeen glycolysis
 *  intermediates to get one molecule, and a vitamin is exactly the kind of
 *  molecule that turns up beside a protein rather than inside a pathway.
 *
 *  WHAT A VITAMIN IS, and it is not a chemical class: retinol is a
 *  polyene, ascorbate a lactone, cobalamin a cobalt complex. They share
 *  one fact, and it is a fact about US — the pathway that makes it is
 *  missing or broken in this species, so it has to arrive in food. That is
 *  why `essential:true` is a flag on the spec rather than a `class`: it is
 *  not a property of the molecule at all, and the same substance is a
 *  vitamin for a human and an ordinary metabolite for a dog.
 * ===================================================================== */
(function(global){
  'use strict';
  const SELFNAME = 'mol-vitamins.js';
  // Registry from molecules.js. Domain files only ever ADD to it.
  const Lib = global.MolLib
    || (typeof require === 'function' ? require('./molecules.js').MolLib : null);
  if (!Lib) throw new Error(SELFNAME + ': molecules.js must be loaded first');
  const { MOLECULES, VIEW, register } = Lib;
  const SkelLib = global.SkelLib
    || (typeof require === 'function' ? require('./skel.js').SkelLib : null);
  if (!SkelLib) throw new Error(SELFNAME + ': skel.js must be loaded first');
  const { GL, flatRing } = SkelLib;

  const VIT = {};

  /* ---------------------------------------------------------------------
   *  ASCORBATE — vitamin C
   * ---------------------------------------------------------------------
   *  IT IS AN ACID WITH NO CARBOXYL GROUP, and that is the whole reason to
   *  draw it rather than name it. The proton it loses (pKa 4.2, so it is
   *  ascorbATE at blood pH) comes off the hydroxyl on C3, and what makes
   *  that hydroxyl acidic is the C2=C3 double bond sitting between it and
   *  the C1 carbonyl: the anion left behind spreads its charge across all
   *  four atoms instead of holding it on one oxygen. Draw the ene-diol and
   *  the lactone with the right bond orders and a student can see why;
   *  draw it as a generic sugar-shaped blob and "vitamin C is an acid" is
   *  a fact to memorise.
   *
   *  AND IT IS A REDUCING AGENT, which is the job it does in collagen.
   *  Prolyl hydroxylase needs its iron ferrous; ascorbate is what puts the
   *  electron back after a stray oxidation. No ascorbate, no hydroxyproline,
   *  no interchain hydrogen bonds, and the triple helix slips — scurvy is
   *  collagen that cannot hold itself together.
   *
   *  THE RING IS A REGULAR PENTAGON, which is a deliberate idealisation:
   *  flatRing() builds every side at 1.39 Å, where the real molecule runs
   *  1.34 (C2=C3) to 1.46 (C4–O1). Planarity is the honest part and the
   *  part the lesson uses — the ring IS flat, because the ene-diol and the
   *  carbonyl are conjugated through it. Side lengths are within ~8%, which
   *  is the same licence every flat ring in this library takes (purine, the
   *  bases). The two stereocentres are NOT idealised away: see `smiles`.
   *
   *  L-ascorbic acid, so C4 is R and C5 is S. `check-molecules.js` cannot
   *  see this one — its signed-volume test is wired to `pep` — so the
   *  committed `smiles` and `tools/check-handedness.js` are what hold it.
   */
  {
    // Ring, in traversal order: O1 · C1 · C2 · C3 · C4. The lactone oxygen
    // bridges the carbonyl carbon and the one carrying the tail, which is what
    // makes this a γ-lactone rather than an open acid.
    const s = flatRing(5, ['O','C','C','C','C']);
    const O1=0, C1=1, C2=2, C3=3, C4=4;
    s.order(C2, C3, 2);                    // the ene- of the ene-diol

    // An sp2 hydroxyl: IN the ring plane, unlike Skel's tetrahedral one. On a
    // carbon of a C=C this is not decoration — the O's lone pair has to line up
    // with the double bond for the conjugation above to exist, and a hydroxyl
    // pushed out of plane draws a molecule that could not be acidic.
    const enolOH = i => { const o = s.grow(i,'O',GL.CO,'sp2',0);
                          s.grow(o,'H',GL.OH,'sp3',0); return o; };

    const oc1 = s.carbonyl(C1, 0);         // the lactone C=O
    const o2  = enolOH(C2);
    const o3  = enolOH(C3);                // the acidic one

    // The tail: C5 and C6, each with a hydroxyl. Both stereocentres are set
    // here, and neither is set by a number that looks like it means anything.
    //   C4 — it already has two ring bonds, so freeTet hands back the two slots
    //        straddling the ring plane; the tail takes one and C4's H the
    //        other, and which is which is the centre.
    //   C5 — its slots are all equivalent until something else lands (they are
    //        a rotation about C4–C5, i.e. a torsion, not a choice), so this
    //        centre is set by the ORDER of the two grows below. C6 before the
    //        hydroxyl is (5S); swapping the two lines builds D-ascorbate,
    //        which renders identically and is not a vitamin.
    // Both verified by tools/check-handedness.js against PubChem, which is the
    // only thing here that can see either of them.
    const C5 = s.grow(C4,'C',GL.CC,'sp3',0);
    const C6 = s.grow(C5,'C',GL.CC,'sp3',0);
    const o5 = s.hydroxyl(C5, 0);
    const o6 = s.hydroxyl(C6, 0);

    // C–H last, so every index above stays stable (glucose's discipline).
    const CH = [ s.grow(C4,'H',GL.CH,'sp3',0), s.grow(C5,'H',GL.CH,'sp3',0),
                 s.grow(C6,'H',GL.CH,'sp3',0), s.grow(C6,'H',GL.CH,'sp3',0) ];

    VIT.ascorbate = s.spec({
      name:'Vitamin C', formula:'C₆H₈O₆', class:'acid',
      names:['O1','C1','C2','C3','C4','OC1','O2','HO2','O3','HO3',
             'C5','C6','O5','HO5','O6','HO6','H4','H5','H61','H62'],
      // `flat` puts this spec under tools/spec2smiles.js, which GENERATES the
      // string below from the atoms above. Never hand-write it: a typed SMILES
      // is a second description of the molecule, free to drift from the
      // geometry it claims to describe. It also gives molecule-viewer.html its
      // flat2d and drawn tabs.
      flat:true,
      smiles:'O=C1O[C@H]([C@@H](O)CO)C(O)=C1O',
      // Baked by tools/bake-flat2d.js — the diagram layout the same spheres
      // slide onto in the viewer's second tab. An empty array is what gives
      // the generator somewhere to write; it is never typed either.
      flat2d:[[1.166,1.199],[0.335,2.343],[-1.011,1.906],[-1.011,0.491],[0.335,0.054],[0.772,3.689],[-2.156,2.738],[-2.156,-0.341],[0.772,-1.292],[-0.175,-2.343],[2.156,-1.586],[0.262,-3.689]],
      essential:true,                      // the flag the shelf is built from
      optH:CH,
      // Where the proton goes. Named because a card that animates the
      // ionisation has to find that oxygen, and counting from the ring is how
      // it ends up on the wrong one.
      acid:{ site:o3, pKa:4.2, note:'The C3 hydroxyl. Its anion delocalises '
           + 'through C2=C3 onto the C1 carbonyl, which is the whole of why a '
           + 'molecule with no –COOH is an acid.' },
      note:'We eat it because a gene died. Nearly every other mammal makes its '
         + 'own vitamin C from glucose; the last enzyme of that pathway, GULO, '
         + 'is still in the human genome as a wreck that codes for nothing. '
         + 'Scurvy is the bill for that deletion.' });
  }

  register(VIT, SELFNAME);
  if (typeof module !== 'undefined' && module.exports) module.exports = { VIT };
})(typeof window !== 'undefined' ? window : globalThis);
