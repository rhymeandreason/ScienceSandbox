/* =====================================================================
 *  mol-krebs.js — the citric-acid cycle's intermediates and its two cofactors
 * =====================================================================
 *  Acetyl-CoA and oxaloacetate in, two CO₂ out, and the six acids in between:
 *  citrate, isocitrate, α-ketoglutarate, succinyl-CoA, succinate, fumarate,
 *  malate. Plus FAD/FADH₂, the one carrier this cycle uses that glycolysis
 *  does not.
 *
 *  WHY THIS IS ITS OWN FILE, given that the partition is by DERIVATION and
 *  SCALE FAMILY and not by topic (molecules.js's `DOMAINS` note, and
 *  mol-pathways.js's header, which explicitly says the Krebs intermediates
 *  belong THERE). Both are right about the axis and this file is the cost
 *  clause they each name: "a page paying to parse specs it never renders is
 *  what splits a file". `glycolysis-lab.html` loads `mol-pathways.js` and
 *  draws none of this — and the cost is not marginal, because FAD and CoA are
 *  the two largest Skel builds in the repo. `mol-carriers.js` is the standing
 *  precedent for exactly this shape: same builder, same family, split off
 *  because one page should not pay for specs only another draws.
 *
 *  So the name is the one thing here that does NOT follow the rule, and it is
 *  worth being honest about rather than quietly filing it under a derivation
 *  it shares with three other files. Everything in it is Skel-built from ideal
 *  VSEPR angles and measured bond lengths, family B, needs `skel.js` — the
 *  same sentence `mol-pathways.js` opens with. If a respiration page ever
 *  draws glycolysis and the cycle together it should load both files, which is
 *  what "let the lesson load what it draws" means; nothing here is a duplicate
 *  of anything there.
 *
 *  MODEL SIMPLIFICATIONS — the same list mol-pathways.js keeps, same reasons,
 *  plus one this file adds:
 *   1. C–H hydrogens are OMITTED on the carbon backbone, so the carbons stay
 *      countable. THE EXCEPTION IS A STEREOCENTRE'S OWN H, and it is not a
 *      style choice: CIP priority 4 at every centre here IS that hydrogen, so
 *      a spec that leaves it out cannot state its own handedness and the
 *      checker has nothing to measure. Malate has one, isocitrate two.
 *      THE SECOND EXCEPTION IS SUCCINATE AND FUMARATE, whose C–H are drawn in
 *      full: succinate dehydrogenase's event is two of them leaving, and a
 *      hydrogen never on screen cannot be watched go.
 *      Hydroxyl and amide H's are always drawn (they read as –OH and –NH).
 *   2. C=O double bonds are tagged `[i,j,2]`. The carboxylate's two oxygens
 *      are drawn as one double and one single — the charge is really
 *      delocalised over both, and the same caveat mol-pathways.js records for
 *      P=O applies, but a carboxylate with two identical sticks reads as an
 *      ester and this pathway is nothing but carboxylates.
 *   3. Charges live in `formula`/`charge` and the lesson's labels, not in a
 *      force model. Every acid here is drawn fully ionised, which is what it
 *      is at the mitochondrial matrix pH of ~7.8 — more so than in the
 *      cytosol, so this is if anything safer than glycolysis's ~7.2.
 *   4. THE CYCLE'S SUBSTRATES ARE DRAWN AS FREE ACIDS, never as their
 *      enzyme-bound forms. Aconitase's cis-aconitate intermediate and the
 *      enzyme-bound oxalosuccinate are both real and both skipped: Bio 101
 *      teaches eight steps, and drawing a transient nobody names would add a
 *      molecule to count without adding a fact to learn.
 *
 *  STEREOCHEMISTRY IS THE POINT OF HALF THIS FILE, and it is the class of
 *  error that renders beautifully while being wrong (MolecularGeometry.md
 *  §1.3). Three claims are asserted by `check-molecules.js`:
 *    · fumarate is TRANS — `cis:{value:false}`. Succinate dehydrogenase makes
 *      the E alkene and only that one; the Z isomer is maleate, which is not
 *      a metabolite and is toxic. Same bond length, same angles, same render
 *      as the cis isomer: only the torsion tells them apart.
 *    · malate is (S) — the `chiral:` claim this file adds, because the
 *      existing `chirality:'L'` check is gated on `pep` and hard-codes an
 *      amino acid's backbone indices.
 *    · isocitrate is (R) at its carbinol carbon and (S) at the next one —
 *      threo-D_s-isocitrate, the only one of the four stereoisomers aconitase
 *      makes and isocitrate dehydrogenase accepts.
 *  And one claim that is deliberately NOT a stereo assertion: citrate has no
 *  stereocentre at all. See its note — that is the interesting fact about it.
 * ===================================================================== */
(function(global){
  'use strict';
  const SELFNAME = 'mol-krebs.js';
  const Lib = global.MolLib
    || (typeof require === 'function' ? require('./molecules.js').MolLib : null);
  if (!Lib) throw new Error(SELFNAME + ': molecules.js must be loaded first');
  const { MOLECULES, VIEW, register } = Lib;
  const SkelLib = global.SkelLib
    || (typeof require === 'function' ? require('./skel.js').SkelLib : null);
  if (!SkelLib) throw new Error(SELFNAME + ': skel.js must be loaded first');
  const { GL, AR, TET, SP2, V, vadd, vsub, vmul, vlen, vnorm, vcross, rad,
          perpTo, Skel, chainC, flatRing, fuseRing, flatH,
          carboxylate, carboxylBranch } = SkelLib;

  const KREBS = {};


  /* =====================================================================
   *  THE SIX ACIDS
   * ===================================================================== */
  {
    /* — oxaloacetate: what the cycle hands back to itself. Four carbons,
     *   a ketone at C2 between two carboxylates, and the shortest-lived
     *   intermediate in the matrix (µM concentrations) — which is exactly why
     *   citrate synthase's step is so far downhill: it pulls a vanishing pool
     *   forward.
     *
     *   C3's two hydrogens are the acidic ones. They are not drawn (header
     *   note 1), but they are the reason this molecule reacts: citrate
     *   synthase's enolate chemistry happens on acetyl-CoA's methyl, and OAA's
     *   C2 ketone is the electrophile that methyl attacks.
     */
    const g = chainC(4);
    carboxylate(g, 0);              // C1
    g.carbonyl(1, 0);               // C2 ketone
    carboxylate(g, 3);              // C4
    KREBS.oaa = g.spec({
      name:'Oxaloacetate', short:'OAA', formula:'C₄H₂O₅²⁻', charge:-2, class:'acid',
      krebs:{ carbons:4, cN:[0,1,2,3], carboxyls:2, keto:1, terminal:false } });
  }
  {
    /* — citrate: six carbons, three carboxylates, one hydroxyl, and NO
     *   STEREOCENTRE. C3 carries –OH, –COO⁻ and two –CH₂COO⁻ arms, and those
     *   two arms are identical, so the molecule is achiral.
     *
     *   THAT IS THE INTERESTING FACT, and it is why this spec declares no
     *   stereochemistry rather than declaring symmetry. Citrate is PROCHIRAL:
     *   aconitase still tells the two arms apart, because an enzyme binds it
     *   at three points and a three-point attachment distinguishes faces that
     *   the molecule's own symmetry does not. Ogston's 1948 argument, and the
     *   reason isotope labelling of the cycle came out "wrong" until someone
     *   made it: the label leaves in a specific arm's CO₂, from an
     *   intermediate that is, on paper, symmetric. A spec cannot assert that —
     *   there is no geometric claim to check — so it is written down here.
     *
     *   THE ARMS ARE BUILT THE SAME WAY ON PURPOSE. C2 and C4 are both grown
     *   from the same `chainC` scaffold and their carboxyls by the same helper
     *   in the same order, so nothing about the drawing can suggest that one
     *   of them is the one aconitase takes. The asymmetry is the enzyme's, not
     *   the molecule's, and the picture should not pre-empt it.
     */
    const g = chainC(5);            // C1 …C5: OOC–CH₂–C–CH₂–COO
    carboxylate(g, 0);              // C1
    carboxylate(g, 4);              // C5
    const oh = g.hydroxyl(2, 0);    // C3's hydroxyl
    const [c6] = carboxylBranch(g, 2, 0);   // C3's own carboxylate — the third arm
    KREBS.citrate = g.spec({
      name:'Citrate', short:'Citrate', formula:'C₆H₅O₇³⁻', charge:-3, class:'acid',
      view:[0.3512, 0.3032, 0.0648],
      krebs:{ carbons:6, cN:[0,1,2,3,4], carboxyls:3, oh, c6,
              // the two arms aconitase chooses between, named so a lesson can
              // point at them without re-deriving which is which
              arms:[[1,0],[3,4]], prochiral:true } });
  }
  {
    /* — isocitrate: citrate's hydroxyl moved one carbon over. Same formula,
     *   same mass, and the whole reason aconitase exists: citrate's –OH is on
     *   a TERTIARY carbon and cannot be oxidised to a ketone, isocitrate's is
     *   on a secondary one and can. One step that changes nothing you can
     *   count, so that the next step is possible at all.
     *
     *   TWO STEREOCENTRES, and only one of the four stereoisomers is a
     *   metabolite: (2R,3S)-isocitrate, threo-D_s. `Ca` here is the carbinol
     *   carbon (the one carrying –OH), `Cb` the one carrying the middle
     *   carboxylate. CIP at each, written out because the checker takes the
     *   priority order from the spec rather than computing it:
     *     Ca:  O(H) > C(carboxyl, its own) > Cb > H
     *     Cb:  C(carboxyl, its own) > Ca (O,C,H) > Cc (C,H,H) > H
     *
     *   THE H's ARE DRAWN HERE, on both centres, and that is header note 1's
     *   exception: priority 4 at each centre is that hydrogen, so leaving it
     *   out would leave the handedness unstated and unmeasurable.
     */
    const g = chainC(3);                       // Ca–Cb–Cc, the propane backbone
    const [ca, cb, cc] = [0, 1, 2];
    const [caC] = carboxylBranch(g, ca, 0);    // Ca's carboxylate
    const oh = g.hydroxyl(ca, 0);              // Ca's hydroxyl
    const caH = g.grow(ca, 'H', GL.CH, 'sp3', 0);
    const [cbC] = carboxylBranch(g, cb, 0);    // Cb's carboxylate
    const cbH = g.grow(cb, 'H', GL.CH, 'sp3', 0);
    const [ccC] = carboxylBranch(g, cc, 0);    // Cc's carboxylate
    KREBS.isocitrate = g.spec({
      name:'Isocitrate', short:'Isocitrate', formula:'C₆H₅O₇³⁻', charge:-3, class:'acid',
      view:[3.0696, -0.4767, -3.1283],
      chiral:[ { at:ca, priority:[oh, caC, cb, caH], hand:'R' },
               { at:cb, priority:[cbC, ca, cc, cbH], hand:'S' } ],
      krebs:{ carbons:6, cN:[ca, cb, cc], carboxyls:3, oh,
              // the carboxylate that leaves as CO₂ at the next step is Cb's —
              // the middle one — not either end. Named so the lesson does not
              // have to guess.
              decarb:cbC,
              // …and the hydrogen NAD⁺ takes as it goes. It is Ca's, the one
              // the –OH shares its carbon with: oxidising that carbinol to a
              // ketone is what makes the β-carboxylate able to leave at all.
              // Drawn here only because Ca is a stereocentre (header note 1),
              // which is the one reason this atom exists to be named.
              hydride:caH } });
  }
  {
    /* — α-ketoglutarate (2-oxoglutarate): five carbons, one CO₂ lighter than
     *   isocitrate. The cycle's second junction with the rest of metabolism —
     *   transaminate it and you have glutamate, which is why this molecule is
     *   where nitrogen enters and leaves the carbon skeleton.
     */
    const g = chainC(5);
    carboxylate(g, 0);              // C1
    g.carbonyl(1, 0);               // C2 ketone — the "α-keto"
    carboxylate(g, 4);              // C5
    KREBS.akg = g.spec({
      name:'α-Ketoglutarate', short:'α-KG', formula:'C₅H₄O₅²⁻', charge:-2, class:'acid',
      krebs:{ carbons:5, cN:[0,1,2,3,4], carboxyls:2, keto:1,
              // the carboxylate lost as the second CO₂
              decarb:0,
              // WHERE THE OXIDATION HAPPENS, since there is no hydrogen to
              // name: C2's electrons are the ones NAD⁺ takes, and what is left
              // of C2 becomes the thioester carbon. So a lesson aims the
              // hydride here rather than at an atom the spec does not draw.
              oxC:1 } });
  }
  {
    /* — succinate: four carbons, two carboxylates, and a C2 axis of symmetry
     *   that matters. Succinate is the cycle's only SYMMETRIC intermediate, so
     *   from here on an isotope label is scrambled between the two ends — the
     *   companion fact to citrate's prochirality above, and the other half of
     *   why the labelling experiments were hard to read.
     */
    const g = chainC(4);
    carboxylate(g, 0);
    carboxylate(g, 3);
    /* THE FOUR C–H, DRAWN — the one place this file breaks its own header note
     * 1. Succinate dehydrogenase's whole event is two of these leaving, and a
     * hydrogen that was never on screen cannot be watched going: the step reads
     * as two glows off bare carbons and the student is told what happened. The
     * backbone is in z=0, so each CH₂'s pair splays to ±z. */
    const h2 = [g.grow(1, 'H', GL.CH, 'sp3', 0), g.grow(1, 'H', GL.CH, 'sp3', 0)];
    const h3 = [g.grow(2, 'H', GL.CH, 'sp3', 0), g.grow(2, 'H', GL.CH, 'sp3', 0)];
    /* …and WHICH TWO GO: one off each carbon, on OPPOSITE faces. The enzyme
     * eliminates anti, and that is the whole reason the product is the E alkene
     * (the assertion below). Picked by the sign of z rather than by index, so it
     * survives the builder handing the slots out in a different order. */
    const face = (hs, sign) => hs[0] && g.at(hs[0]).z * sign > 0 ? hs[0] : hs[1];
    KREBS.succinate = g.spec({
      name:'Succinate', short:'Succinate', formula:'C₄H₄O₄²⁻', charge:-2, class:'acid',
      krebs:{ carbons:4, cN:[0,1,2,3], carboxyls:2, symmetric:true,
              // C2 and C3 — the pair the C=C forms between — and the two
              // hydrogens that leave them.
              dehydroC:[1, 2], dehydroH:[face(h2, +1), face(h3, -1)] } });
  }
  {
    /* — fumarate: succinate with a C2=C3 double bond, TRANS.
     *
     *   THE ONE ASSERTION THIS FILE EXISTS FOR. Succinate dehydrogenase
     *   removes one H from each of C2 and C3 and does it stereospecifically —
     *   anti elimination, giving the E alkene and nothing else. The Z isomer
     *   is maleate: same formula, same bond lengths, same 120° angles, an
     *   identical render, and not a metabolite at all (it is toxic, and it is
     *   what fumarase will not touch). Only the torsion about the C=C tells
     *   them apart, which is precisely the class of error MolecularGeometry.md
     *   §1.3 is about. `cis:{value:false}` makes check-molecules.js measure it.
     *
     *   BUILT BY HAND, NOT FROM chainC, and the two carboxyl carbons are
     *   PLACED rather than grown. `chainC`'s backbone is the tetrahedral-ish
     *   111°, and both alkene carbons here need 120°; more importantly
     *   `freeSp2` picks between its two slots using `outwardAt`, which is a
     *   centroid heuristic — right for splaying a substituent into open space,
     *   and no basis at all for a claim about which side of a double bond an
     *   arm sits on. Trans has to be constructed, not hoped for.
     *
     *   The alkene and both carboxyl carbons are coplanar (z=0), which is what
     *   a conjugated diacid really is: the π system runs the length of the
     *   molecule.
     */
    const s = new Skel();
    const dx = GL.CdC / 2;
    const c2 = s.put('C', V(-dx, 0, 0));
    const c3 = s.put('C', V( dx, 0, 0));
    s.link(c2, c3, 2);                         // the double bond
    /* …and one carboxyl carbon on each, on OPPOSITE sides of the C=C axis.
     * The +y/−y pair IS the trans claim, so it is written as two explicit
     * directions rather than folded into a sign trick: each arm leaves its
     * alkene carbon at 120° from the bond to the other one (`SP2`), which
     * puts it 60° off the axis, and they take opposite y. Read the two lines
     * together and the geometry is the claim. */
    const off = a => V(GL.CC * Math.cos(rad(180 - SP2)) * (a === c2 ? -1 : 1), 0, 0);
    const up  = y => V(0, GL.CC * Math.sin(rad(180 - SP2)) * y, 0);
    const c1 = s.put('C', vadd(s.at(c2), vadd(off(c2), up(+1))));   // up off C2…
    const c4 = s.put('C', vadd(s.at(c3), vadd(off(c3), up(-1))));   // …down off C3
    s.link(c2, c1); s.link(c3, c4);
    carboxylate(s, c1, 0);
    carboxylate(s, c4, 0);
    // …and the one hydrogen left on each alkene carbon, drawn for succinate's
    // reason: the pair that did not leave is what says two of four did.
    s.grow(c2, 'H', GL.CH, 'sp2', 0);
    s.grow(c3, 'H', GL.CH, 'sp2', 0);
    KREBS.fumarate = s.spec({
      name:'Fumarate', short:'Fumarate', formula:'C₄H₂O₄²⁻', charge:-2, class:'acid',
      // C1–C2=C3–C4: the dihedral about the double bond. ~180° = trans = E.
      cis:{ atoms:[c1, c2, c3, c4], value:false },
      krebs:{ carbons:4, cN:[c1, c2, c3, c4], carboxyls:2, ene:[c2, c3],
              symmetric:true } });
  }
  {
    /* — malate: fumarate plus a water, added across the double bond. Fumarase
     *   adds –OH and –H anti, to one face only, so the product is a single
     *   enantiomer: (S)-malate, which every textbook also calls L-malate.
     *
     *   (S) IS ASSERTED, via this file's `chiral:` claim. It cannot go through
     *   the existing `chirality:'L'` check, which is gated on `mol.pep` and
     *   reads an amino acid's fixed backbone indices — see check-molecules.js.
     *   CIP at C2, in the order the claim lists:
     *     O(H) > C1 (carboxyl: O,O,O) > C3 (CH₂: C,H,H) > H
     *   The distinction is not academic: (R)-malate is not a metabolite, and
     *   fumarase will not make it or take it.
     *
     *   L AND (S) ARE THE SAME MOLECULE HERE, but they are not the same kind
     *   of name — L/D is a Fischer relationship to glyceraldehyde and R/S is
     *   CIP — and for malate they happen to coincide. Declared as (S), because
     *   that is what the checker measures: a signed volume over a stated
     *   priority order.
     */
    const g = chainC(4);                       // C1–C2–C3–C4
    carboxylate(g, 0);                         // C1 carboxylate
    const oh = g.hydroxyl(1, 0);               // C2's hydroxyl — the stereocentre
    const c2H = g.grow(1, 'H', GL.CH, 'sp3', 0);
    carboxylate(g, 3);                         // C4 carboxylate (C3 stays a bare CH₂)
    KREBS.malate = g.spec({
      name:'Malate', short:'Malate', formula:'C₄H₄O₅²⁻', charge:-2, class:'acid',
      chiral:[ { at:1, priority:[oh, 0, 2, c2H], hand:'S' } ],
      krebs:{ carbons:4, cN:[0,1,2,3], carboxyls:2, oh,
              // the hydride malate dehydrogenase hands NAD⁺, off the same C2
              // the hydroxyl is on — the carbinol becoming the ketone that
              // closes the cycle. Drawn for the stereocentre; named here so
              // the last step does not have to rediscover it.
              hydride:c2H } });
  }


  register(KREBS, SELFNAME);
})(this);
