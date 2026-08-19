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
 *  the two largest Skel builds in the repo. `mol-compare.js` is the standing
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
          perpTo, Skel, chainC, flatRing, fuseRing, flatH } = SkelLib;

  const KREBS = {};

  /* ---- the group this file draws over and over -------------------------
   * A carboxylate on an sp2 carbon: one C=O and one C–O⁻, both at 120°. Every
   * acid below has two or three of them, and writing it out each time is how
   * one of them ends up with a single bond order or a tetrahedral angle.
   *
   * ONE DOUBLE AND ONE SINGLE, which is a drawing decision and not a claim
   * about the electrons — see the header's note 2. The real anion is
   * symmetric, both C–O at 1.26 Å; `GL.CdO` (1.23) is close enough that the
   * asymmetry is invisible next to the sphere radii, and the double stick is
   * what makes it read as a carboxylate rather than as an ester.
   */
  const carboxylate = (s, i, slot) => {
    const o1 = s.grow(i, 'O', GL.CdO, 'sp2', slot || 0, 2);   // C=O
    const o2 = s.grow(i, 'O', GL.CdO, 'sp2', 0);              // C–O⁻
    return [o1, o2];
  };
  // …and the same thing on a carbon that is not yet in the skeleton: grow the
  // carboxyl CARBON off `i`, then put its two oxygens on. Returns [c, o1, o2].
  const carboxylBranch = (s, i, slot) => {
    const c = s.grow(i, 'C', GL.CC, 'sp3', slot || 0);
    const [o1, o2] = carboxylate(s, c, 0);
    return [c, o1, o2];
  };

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
      chiral:[ { at:ca, priority:[oh, caC, cb, caH], hand:'R' },
               { at:cb, priority:[cbC, ca, cc, cbH], hand:'S' } ],
      krebs:{ carbons:6, cN:[ca, cb, cc], carboxyls:3, oh,
              // the carboxylate that leaves as CO₂ at the next step is Cb's —
              // the middle one — not either end. Named so the lesson does not
              // have to guess.
              decarb:cbC } });
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
              decarb:0 } });
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
    KREBS.succinate = g.spec({
      name:'Succinate', short:'Succinate', formula:'C₄H₄O₄²⁻', charge:-2, class:'acid',
      krebs:{ carbons:4, cN:[0,1,2,3], carboxyls:2, symmetric:true } });
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
      krebs:{ carbons:4, cN:[0,1,2,3], carboxyls:2, oh } });
  }


  /* =====================================================================
   *  COENZYME A, AND THE TWO THIOESTERS THE CYCLE MAKES OF IT
   * =====================================================================
   *  DRAWN IN FULL, all seventy-odd atoms, and that is a deliberate answer to
   *  a real question. Only the thiol end reacts: everything from the amide
   *  nitrogens back through the pantothenate arm to adenine and its three
   *  phosphates is a HANDLE, untouched by every step that uses it. Truncating
   *  to the business end would be defensible and this file does not do it, for
   *  two reasons the lesson depends on:
   *
   *    · THE SIZE IS THE POINT. Acetyl-CoA delivers TWO carbons to a
   *      four-carbon acceptor, and it is the biggest molecule on the stage by
   *      a wide margin. A student who sees the acetyl group next to the
   *      apparatus that carries it has the right picture of what a coenzyme
   *      IS: mostly recognition surface, with a tiny reactive tip. Drawn
   *      truncated, acetyl-CoA looks like a small molecule and "carrier"
   *      becomes a word rather than a shape.
   *    · IT IS HALF AN ADENINE NUCLEOTIDE, like ATP and NAD⁺ before it. Three
   *      carriers on three pages, all built on the same ADP core, is a fact
   *      worth being able to SEE — and it is the standard argument for the RNA
   *      world, which is a Bio 101 idea this repo can actually draw.
   *
   *  So the cost is paid here rather than in the drawing, which is exactly why
   *  this file is separate from mol-pathways.js (see the header).
   *
   *  ONE SKELETON, THREE SPECS. `buildCoA()` returns the whole thing plus the
   *  index of its sulfur; CoA-SH caps that with a hydrogen and the two
   *  thioesters put an acyl group there instead. Building them separately is
   *  how the acetyl and succinyl forms end up disagreeing about a molecule
   *  they share ninety percent of.
   */

  /* Remove one atom and close the gap, remapping every bond. Skel has no such
   * operation and should not grow one for this: `centroid()` reduces over the
   * whole array, so a hole left in place makes the very next `grow` throw, and
   * a builder that can leave holes is a builder every caller has to know about.
   * Doing it here, once, immediately, keeps that contained — the returned map
   * is applied to the handful of indices still live at the call site. */
  /* THE FORMULAS ARE THE LITERATURE'S, for the anion each spec declares —
   * hydrogen included, even though these builds draw almost none of it.
   * check-molecules.js excludes H from its comparison for exactly this reason
   * (a spec's H count is a drawing decision, a formula's is a chemical one)
   * and checks every heavy element against the atoms actually built, so these
   * strings are pinned to the skeleton on every count that can be. */
  const FORMULA = {
    coa:         'C₂₁H₃₂N₇O₁₆P₃S⁴⁻',
    acetylcoa:   'C₂₃H₃₄N₇O₁₇P₃S⁴⁻',
    succinylcoa: 'C₂₅H₃₅N₇O₁₉P₃S⁵⁻',
  };


  /* AN EXTENDED CHAIN OF MIXED ELEMENTS, in the plane, at the real ~111°.
   *
   * `chainC` does this for carbon at one bond length; CoA's arm is twelve
   * atoms of C, N and S at five different lengths, and it has to come out
   * EXTENDED. Grown atom-by-atom with `grow` it does not: slot 0 is seeded
   * away from the centroid of everything placed so far (`outwardAt`), which is
   * exactly right for splaying a substituent into open space and wrong for a
   * long chain hanging off a heavy head — the centroid barely moves, every
   * step turns the same way, and the arm curls into an arc until its two
   * amides collide. check-molecules.js reported that as three overlapping
   * pairs, which is how it was found.
   *
   * So the backbone is LAID DOWN, not grown: alternating steps 34.5° either
   * side of −Y, which is the same construction `chainC` uses (90° − 111°/2)
   * and puts every bond angle at 111° by arithmetic rather than by hope.
   * Substituents are still grown afterwards — by then each backbone atom has
   * two neighbours, so `freeTet`/`freeSp2` return the out-of-plane pair and
   * the well-behaved case is the only one left.
   *
   * THE ARM'S CONFORMATION IS A DECLARED SCHEMATIC (MolecularGeometry.md
   * §1.6). A real pantetheine arm is a floppy rotor and adopts no particular
   * shape; fully extended is the legible one, it is what every textbook draws,
   * and nothing in the lesson rests on its torsions. What the lesson does rest
   * on — that the arm is LONG, and holds the reactive sulfur far from the
   * nucleotide — is exactly what extending it shows.
   */
  function extendedChain(els, lens){
    const s = new Skel(), a = rad(90 - 111 / 2);
    const idx = [];
    let p = V(0, 0, 0);
    els.forEach((el, k) => {
      if (k) p = vadd(p, vmul(V((k % 2 ? 1 : -1) * Math.sin(a), -Math.cos(a), 0), lens[k]));
      idx.push(s.put(el, p));
      if (k) s.link(idx[k - 1], idx[k]);
    });
    return { s, idx };
  }

  function dropAtom(s, victim){
    const map = [];
    const kept = [];
    s.atoms.forEach((a, i) => { if (i !== victim) { map[i] = kept.length; kept.push(a); } });
    s.atoms = kept;
    s.bonds = s.bonds
      .filter(b => b[0] !== victim && b[1] !== victim)
      .map(b => b.length > 2 ? [map[b[0]], map[b[1]], b[2]] : [map[b[0]], map[b[1]]]);
    return map;
  }

  function buildCoA(){
    // — the adenosine half, exactly as ATP and NADH build it: a flat adenine
    //   fitted onto β-D-ribofuranose's reserved β slot at C1′. The face
    //   choices ARE the stereochemistry (see ribosyl's note in skel.js); none
    //   of them is made here, which is the point of using the helper.
    const r = SkelLib.ribosyl();
    const s = r.s;
    /* THE SAME JOIN ATP MAKES, with the same numbers — deliberately, not by
     * coincidence. `outN9` is the base's own outward direction (the negated sum
     * of N9's existing bonds), it is carried onto the NEGATED β-slot direction,
     * and `CHI` is the glycosidic torsion χ. 106° puts χ at −120.5°, ANTI,
     * where purine nucleotides actually sit; mol-compare.js swept it and its
     * note carries the argument. Reproducing that here rather than picking a
     * fresh spin is the whole point of three carriers sharing one core — a
     * different χ would make CoA's adenosine a visibly different shape from
     * ATP's for no reason, and the first spin tried here (0, with the
     * un-negated direction) folded the base onto the ribose hard enough that
     * check-molecules.js reported four overlapping pairs. */
    const CHI = 106 * Math.PI / 180;
    const ade = SkelLib.adenine();
    const outN9 = vnorm(vmul(ade.s.nbrs(ade.n9).reduce(vadd, V(0,0,0)), -1));
    SkelLib.fitOnto(ade.s, ade.n9, outN9, vmul(r.baseDir, -1), r.basePos, CHI);
    const off = SkelLib.absorb(s, ade.s);
    s.link(r.c1, ade.n9 + off);
    // C1′'s own hydrogen goes on only NOW — the β slot is occupied by a BOND
    // rather than an atom until the link above exists, and freeTet reports
    // what is free, not what is spoken for. (skel.js's ribosyl note.)
    s.grow(r.c1, 'H', GL.CH, 'sp3', 0);

    /* — THE 3′-PHOSPHATE, which is what makes this coenzyme A rather than a
     *   plain nucleotide arm. It does no chemistry whatsoever; it is a
     *   recognition tag, and it is how an enzyme tells CoA from ADP, whose
     *   entire 5′ end it otherwise shares. Worth drawing for that alone —
     *   "the difference between two carriers is one phosphate at a place
     *   nothing reacts" is a good fact, and it is the same fact NAD⁺ vs NADP⁺
     *   turns on.
     *
     *   It REPLACES the 3′ hydroxyl's hydrogen, so that H is dropped first and
     *   every index still in use is remapped before anything else is grown.
     */
    let c1 = r.c1, c5 = r.c5, o3 = r.o3, n9 = ade.n9 + off;
    {
      const bond = s.bonds.find(b => (b[0] === o3 || b[1] === o3) &&
        s.atoms[b[0] === o3 ? b[1] : b[0]].el === 'H');
      if (bond) {
        const m = dropAtom(s, bond[0] === o3 ? bond[1] : bond[0]);
        c1 = m[c1]; c5 = m[c5]; o3 = m[o3]; n9 = m[n9];
      }
    }
    const p3 = s.phosphoUnit(o3, { terminal:true }).p;

    // — the 5′ diphosphate: two phosphorus in a row bridged by oxygen, the
    //   same α–β chain ATP opens with. `phosphoUnit` grows the bridge BEFORE
    //   the terminal oxygens so the chain extends outward instead of folding
    //   back over the ribose (its note).
    const o5 = s.grow(c5, 'O', GL.CO, 'sp3', 0);
    const a1 = s.phosphoUnit(o5, {});            // Pα + the α–β bridge
    const a2 = s.phosphoUnit(a1.bridge, {});     // Pβ + the bridge to pantothenate

    /* — PANTOTHENATE (vitamin B5) and β-mercaptoethylamine, the arm. This is
     *   the half a student has a reason to care about: it is a VITAMIN, it is
     *   why B5 is one, and it ends in the sulfur everything attaches to. Built
     *   as a plain chain of grows because it is a chain — no ring, and no
     *   stereochemistry to get wrong except the one noted below.
     *
     *   Pβ–O–CH₂–C(CH₃)₂–CH(OH)–C(=O)–NH–CH₂–CH₂–C(=O)–NH–CH₂–CH₂–SH
     */
    const arm = extendedChain(
      // cP1 cQ  cR  cA1 nA1 cB1 cB2 cA2 nA2 cC1 cC2  S
      ['C','C','C','C','N','C','C','C','N','C','C','S'],
      // the bond INTO each atom; [0] is unused (nothing precedes cP1).
      // The two amide C–N are AR.CN (1.34, shortened by the amide's
      // partial double-bond character); the two N–C leaving them are
      // ordinary GL.CN single bonds.
      [ GL.CO, GL.CC, GL.CC, GL.CC, AR.CN, GL.CN, GL.CC,
        GL.CC, AR.CN, GL.CN, GL.CC, GL.CS ]);
    const A = SkelLib.absorb(s, SkelLib.fitOnto(arm.s, 0,
      vsub(arm.s.at(1), arm.s.at(0)),                    // the chain's own axis…
      s.freeTet(a2.bridge)[0],                           // …onto the bridge's free slot
      vadd(s.at(a2.bridge), vmul(s.freeTet(a2.bridge)[0], GL.CO)), 0));
    const at = i => arm.idx[i] + A;
    s.link(a2.bridge, at(0));
    const cP1 = at(0), cQ = at(1), cR = at(2),
          cA1 = at(3), nA1 = at(4), cB1 = at(5), cB2 = at(6),
          cA2 = at(7), nA2 = at(8), cC1 = at(9), cC2 = at(10), S = at(11);
    s.grow(cQ, 'C', GL.CC, 'sp3', 0);                           // two methyls, united
    s.grow(cQ, 'C', GL.CC, 'sp3', 0);                           //   atoms like pyruvate's
    /* THE ONE STEREOCENTRE IN THE ARM, AND IT IS DELIBERATELY NOT ASSERTED.
     * Pantothenate is (R) at this carbon and only the R form is the vitamin.
     * It is left undeclared because nothing in this pathway acts on it and
     * nothing is drawn against its mirror — and per MolecularGeometry.md §1.4
     * a claim ships with its assertion or it does not ship. Declaring (R) here
     * would state a fact the lesson never uses, the render never shows, and
     * the build was never steered toward: `grow` took whichever slot was free.
     * If a vitamin lesson ever draws it, THAT is the moment to add `chiral`
     * and to place this carbon deliberately. The hydrogen it would need is
     * already here.
     */
    s.hydroxyl(cR, 0);
    s.grow(cR, 'H', GL.CH, 'sp3', 0);
    // the two amide carbonyls and their N–H, hung off the chain that already
    // exists — both carbons are sp2, so their O takes a 120° slot
    s.grow(cA1, 'O', GL.CdO, 'sp2', 0, 2);
    s.grow(nA1, 'H', AR.NH, 'sp2', 0);
    s.grow(cA2, 'O', GL.CdO, 'sp2', 0, 2);
    s.grow(nA2, 'H', AR.NH, 'sp2', 0);

    return { s, S, p3, pa:a1.p, pb:a2.p, n9, c1 };
  }

  {
    // — coenzyme A itself, the free thiol. Registered as its own species
    //   because the cycle RELEASES it twice — citrate synthase and the α-KG
    //   dehydrogenase complex both hand it back — so it stands on the stage
    //   rather than being a suffix on someone else's name.
    const { s, S, p3, pa, pb } = buildCoA();
    s.grow(S, 'H', GL.SH, 'sp3', 0);
    KREBS.coa = s.spec({
      name:'Coenzyme A', short:'CoA-SH', formula:FORMULA.coa, charge:-4,
      class:'carrier',
      krebs:{ carrier:true, thiol:S, phosphates:3, p3, pa, pb } });
  }

  /* ---- the two thioesters ---------------------------------------------
   * ACYL–S–CoA. The acyl carbon is sp2 (it is a carbonyl), so it is grown at
   * 120° off the sulfur rather than at the thiol's tetrahedral angle — the
   * same distinction PEP's enol ester makes in mol-pathways.js, and for the
   * same reason: the helpers assume a tetrahedral parent unless told.
   *
   * `hot` names the thioester carbon on both, the way glycolysis's specs name
   * the phosphate a step transfers. It is the bond that breaks in each case:
   * citrate synthase cleaves acetyl-CoA's, and succinyl-CoA synthetase cleaves
   * succinyl-CoA's to drive the cycle's one substrate-level phosphorylation.
   */
  const thioester = (n) => {
    const b = buildCoA();
    // THE ACYL GROUP IS LAID DOWN EXTENDED, for the arm's reason and found the
    // same way: grown atom-by-atom, succinyl's four carbons curled back until
    // its far carboxylate sat 1.84 A off the thioester's own carbonyl oxygen,
    // which check-molecules.js reported as an overlap. `n` is the acyl's
    // carbon count -- 2 for acetyl, 4 for succinyl -- and the first of them is
    // the thioester carbon itself.
    const acyl = extendedChain(Array(n).fill('C'),
                               [GL.CS, ...Array(n - 1).fill(GL.CC)]);
    const slot = b.s.freeTet(b.S)[0];
    const A = SkelLib.absorb(b.s, SkelLib.fitOnto(acyl.s, 0,
      n > 1 ? vsub(acyl.s.at(1), acyl.s.at(0)) : V(0, -1, 0),
      slot, vadd(b.s.at(b.S), vmul(slot, GL.CS)), 0));
    const c = acyl.idx.map(i => i + A);
    b.s.link(b.S, c[0]);
    b.s.grow(c[0], 'O', GL.CdO, 'sp2', 0, 2);        // the thioester's carbonyl
    return Object.assign(b, { c });
  };
  {
    // — acetyl-CoA: two carbons on the end of all that apparatus, and the
    //   molecule every catabolic pathway funnels into. Fat, sugar and most
    //   amino acids all arrive here — and nothing in human metabolism turns it
    //   back into glucose, which is why "fat cannot become sugar" is true and
    //   why this molecule is the right place to say so.
    const { s, S, c, p3, pa, pb } = thioester(2);    // C(=O) + the methyl
    KREBS.acetylcoa = s.spec({
      name:'Acetyl-CoA', short:'Acetyl-CoA', formula:FORMULA.acetylcoa, charge:-4,
      class:'carrier',
      krebs:{ carrier:true, thiol:S, hot:c[0], acyl:c, carbons:2,
              phosphates:3, p3, pa, pb } });
  }
  {
    // — succinyl-CoA: the same handle carrying four carbons instead of two,
    //   and the cycle's one high-energy intermediate. Breaking its thioester
    //   phosphorylates GDP (or ADP) directly — substrate-level, the same trick
    //   glycolysis's steps 7 and 10 use, and the only instance of it here.
    const { s, S, c, p3, pa, pb } = thioester(4);    // C(=O)–CH₂–CH₂–COO⁻
    carboxylate(s, c[3], 0);
    KREBS.succinylcoa = s.spec({
      name:'Succinyl-CoA', short:'Succinyl-CoA', formula:FORMULA.succinylcoa, charge:-5,
      class:'carrier',
      krebs:{ carrier:true, thiol:S, hot:c[0], acyl:c, carbons:4,
              phosphates:3, p3, pa, pb } });
  }


  /* =====================================================================
   *  FAD / FADH₂ — the carrier this cycle has that glycolysis does not
   * =====================================================================
   *  Succinate → fumarate is the one oxidation in the cycle that does NOT
   *  reduce NAD⁺, and the reason is worth a molecule: taking two hydrogens off
   *  a plain C–C to make a C=C releases less energy than oxidising an alcohol
   *  to a ketone, not enough to reduce NAD⁺, and FAD's flavin sits at the
   *  lower potential that can take it. That is why the cycle's ledger reads
   *  3 NADH + 1 FADH₂ rather than 4 NADH, and why FADH₂ is worth fewer ATP
   *  downstream — it enters the chain at complex II, past the first pump.
   *
   *  THE SAME TWO-STATE SHAPE AS ATP/ADP AND NAD⁺/NADH — one molecule, two
   *  states, differing by the atoms a step moves (kit/carriers.js's contract).
   *  Here the difference is TWO HYDROGENS, on N1 and N5 of the flavin, and
   *  `redox` names them so a page can hide exactly those to show the oxidised
   *  form. FADH₂ is built as the full molecule and FAD is FADH₂ minus that
   *  pair, so the two cannot disagree about where the hydrogens go.
   *
   *  ISOALLOXAZINE, drawn flat and drawn in full. Three fused six-rings in a
   *  row — dimethylbenzene, then the pyrazine that carries N5 and N10, then
   *  the pyrimidinedione with its two carbonyls — and every one of them is
   *  aromatic or conjugated, so `flatRing`/`fuseRing` keep the whole system in
   *  one plane. A tetrahedral builder would pucker it, and a puckered flavin
   *  is not a flavin: the ring system is planar precisely so it can stack, and
   *  stacking is how it sits in its enzyme.
   *
   *  AND IT IS A NUCLEOTIDE TOO — flavin adenine DInucleotide. Ribitol (an
   *  open-chain sugar alcohol, NOT a ring — the "flavin mononucleotide" half
   *  is famously not a real nucleotide for exactly that reason), a
   *  pyrophosphate bridge, then ribose and adenine: the same ADP core ATP,
   *  NADH and CoA are all built on. Four carriers, one core.
   */
  function buildFlavin(){
    /* — the tricycle. Ring A is the dimethylbenzene, ring B the pyrazine
     *   fused across A's C5a–C9a edge, ring C the pyrimidinedione fused across
     *   B's C4a–C10a edge. Each fuse opens AWAY from the previous ring's
     *   centre, which is what makes the three LINEAR rather than angular —
     *   an angular isoalloxazine is a different chromophore.
     */
    const s = flatRing(6, ['C','C','C','C','C','C']);      // ring A
    const cA = s.centroid();
    // ring B across A's edge 3–4, carrying N5 and N10
    const B = fuseRing(s, 6, 3, 4, cA, ['N','C','C','N']);
    const n5 = B[0], c4a = B[1], c10a = B[2], n10 = B[3];
    const cB = vmul(vadd(vadd(s.at(3), s.at(4)), vadd(s.at(c4a), s.at(c10a))), 0.25);
    // ring C across B's c4a–c10a edge: N1, C2(=O), N3(H), C4(=O)
    const C = fuseRing(s, 6, c4a, c10a, cB, ['N','C','N','C']);
    const n1 = C[0], c2 = C[1], n3 = C[2], c4 = C[3];

    /* ONE KEKULÉ STRUCTURE, and it is the REDUCED one — FADH₂. The benzene
     * alternates; ring B is drawn with N5 and N10 as amines (both carry an H
     * in FADH₂, N10's replaced by the ribitol chain); the two carbonyls are
     * real double bonds in both states. Oxidised FAD is this minus two
     * hydrogens, and its extra ring double bonds are NOT re-drawn — see the
     * note where FAD is registered.
     */
    s.order(0, 1, 2).order(2, 3, 2).order(4, 5, 2);        // ring A aromatic
    /* …AND THE C4a=C10a DOUBLE BOND, which the reduced ring really has: the
     * 1,5-dihydro flavin is N1(H)–C10a=C4a–N5(H), and that one double bond is
     * what makes ring C conjugated rather than a saturated urea. Left out, the
     * molecule is 1,5-dihydro-FADH₂ — two hydrogens further reduced than
     * anything in biology — and tools/check-handedness.js said so by writing
     * our ring `C1NC(=O)NC(=O)C1` against PubChem's aromatic `c1[nH]…c1`. */
    s.order(c4a, c10a, 2);
    const o2 = s.grow(c2, 'O', GL.CdO, 'sp2', 0, 2);
    const o4 = s.grow(c4, 'O', GL.CdO, 'sp2', 0, 2);
    /* THE TWO METHYLS GO ON THE MIDDLE PAIR — it is 7,8-dimethylisoalloxazine,
     * and 7 and 8 are the benzene carbons FURTHEST from the ring fusion. Ring
     * A is 0–5 and the fuse took edge 3–4, so 2 and 5 are the carbons ortho to
     * the fusion (C6 and C9) and 0 and 1 are the middle pair. Put on 1 and 2 —
     * one middle, one outer — this builds 6,7-dimethylisoalloxazine, a real
     * compound and the wrong one; every bond length and angle is identical and
     * check-molecules.js cannot see it, because ring topology and ring count
     * are unchanged. check-handedness caught it against PubChem. */
    const me7 = flatH(s, 0, GL.CC); s.atoms[me7].el = 'C';
    const me8 = flatH(s, 1, GL.CC); s.atoms[me8].el = 'C';
    // ring hydrogens on the two carbons that keep one: C6 and C9
    flatH(s, 2, AR.CH);
    flatH(s, 5, AR.CH);
    const h3 = flatH(s, n3, AR.NH);
    // …and the two the redox state turns on. N10's slot is taken by the
    // ribitol chain below, so only N5 and N1 get one here.
    const h5 = flatH(s, n5, AR.NH);
    const h1 = flatH(s, n1, AR.NH);
    return { s, n5, n10, n1, n3, c4a, c10a, o2, o4, h1, h5,
             ring:[0,1,2,3,4,5,n5,c4a,c10a,n10,n1,c2,n3,c4] };
  }

  function buildFAD(){
    const f = buildFlavin();
    const s = f.s;
    /* — RIBITOL, and it is the reason this molecule's name is a small lie.
     *   An open-chain sugar ALCOHOL, five carbons with hydroxyls on three of
     *   them, joined to N10 by a plain C–N bond. There is no anomeric carbon
     *   and no ring, so "flavin mononucleotide" is not a nucleotide at all —
     *   a nucleotide needs a glycosidic bond to a sugar RING. Worth drawing
     *   correctly rather than substituting a ribose, because a student who
     *   has just met ATP and NAD⁺ will assume it is one.
     *
     *   Laid down extended, for the same reason CoA's arm is (see
     *   `extendedChain`): a five-carbon chain grown off a heavy flat ring
     *   curls back over it.
     */
    const rib = extendedChain(['C','C','C','C','C'],
                              [GL.CN, GL.CC, GL.CC, GL.CC, GL.CC]);
    const slot = vnorm(vmul(s.nbrs(f.n10).reduce(vadd, V(0,0,0)), -1));
    const R = SkelLib.absorb(s, SkelLib.fitOnto(rib.s, 0,
      vsub(rib.s.at(1), rib.s.at(0)), slot,
      vadd(s.at(f.n10), vmul(slot, GL.CN)), 0));
    const rc = rib.idx.map(i => i + R);
    s.link(f.n10, rc[0]);
    /* — the three hydroxyls, on ribitol's 2′, 3′ and 4′. The 1′ carbon carries
     *   the flavin and the 5′ carries the phosphate.
     *
     *   SLOT 1, NOT SLOT 0, AND THAT IS THE WHOLE STEREOCHEMISTRY OF THIS
     *   MOLECULE. `freeTet` hands back the two open slots on a chain carbon in
     *   an order that falls out of a cross-product sign, not out of chemistry
     *   — the same trap `equatorial()` exists to avoid on a ring. Taking slot 0
     *   because it is first makes no choice at all, and the one it happens to
     *   give is the WRONG ONE: it builds L-ribitol, the enantiomer, with every
     *   bond length, every angle and every rendered pixel identical to the real
     *   thing. Real FAD is D-ribitol, (2S,3S,4R).
     *
     *   Nothing inside this repo can see that. `chiral:` measures a signed
     *   volume against a priority order this file would also have written, and
     *   check-molecules.js passed the mirrored build without complaint. It was
     *   caught by `tools/check-handedness.js`, which is the only check that
     *   reaches outside for an absolute answer — the same tool that once found
     *   every Skel-built sugar in this library was the L-enantiomer
     *   (MolecularGeometry.md §1.3). The `fadh2` row there is what holds this
     *   line honest; change this slot and that row fails.
     */
    [1, 2, 3].forEach(k => s.hydroxyl(rc[k], 1));

    // — the pyrophosphate bridge and the adenosine half, exactly as CoA and
    //   ATP build it: Pα, the α–β bridge, Pβ, then a ribose 5′ oxygen.
    const o5 = s.grow(rc[4], 'O', GL.CO, 'sp3', 0);
    const a1 = s.phosphoUnit(o5, {});
    const a2 = s.phosphoUnit(a1.bridge, {});

    const r = SkelLib.ribosyl();
    const ade = SkelLib.adenine();
    const CHI = 106 * Math.PI / 180;               // ANTI, the same χ as ATP's
    const outN9 = vnorm(vmul(ade.s.nbrs(ade.n9).reduce(vadd, V(0,0,0)), -1));
    SkelLib.fitOnto(ade.s, ade.n9, outN9, vmul(r.baseDir, -1), r.basePos, CHI);
    const aoff = SkelLib.absorb(r.s, ade.s);
    r.s.link(r.c1, ade.n9 + aoff);
    r.s.grow(r.c1, 'H', GL.CH, 'sp3', 0);          // after the link — see buildCoA

    /* — and join the two halves at the bridge's far oxygen, exactly the way
     *   NADH does it (mol-compare.js): the direction is the bridging oxygen's
     *   own FREE SLOT, negated, and C5′ arrives along its own free slot. Using
     *   the P→O vector instead — which is what this did first — aims the
     *   ribose down the bond it is joining rather than into the open slot, and
     *   swings the ring into Pβ's terminal oxygen: check-molecules.js reported
     *   it as a 0.18 overlap on both FAD and FADH₂.
     *
     *   BRIDGE_CHI is that join's torsion, swept the way NADH's was and
     *   decided the same way — but NOT to the same value, which is worth
     *   recording because the first version of this line simply copied NADH's
     *   200° along with its justification. Swept here at 10° steps, clearance
     *   is FLAT: the closest non-bonded pair is 3.32 Å at every angle on the
     *   circle, so it decides nothing (the same finding NADH reports). Extent
     *   does decide, and it does not favour 200°:
     *
     *       80°   51.10 Å across, 2.06 out of plane   ← this
     *      200°   48.78 Å across, 2.05 out of plane
     *      260°   47.93 Å across                       (the least extended)
     *
     *   So 80°, for the reason NADH gives: the most EXTENDED arrangement, so
     *   the flavin and the adenine read as two halves joined tail to tail
     *   rather than as one blob. Flatness is within noise across 60–90° and
     *   breaks the near-tie for nothing, so extent alone picks it. Declared
     *   schematic per §1.6, unchecked, same standing as χ. */
    const BRIDGE_CHI = 80 * Math.PI / 180;
    const dirO5b = s.freeTet(a2.bridge)[0];
    const outC5 = r.s.freeTet(r.c5)[0];
    const N = SkelLib.absorb(s, SkelLib.fitOnto(r.s, r.c5, outC5,
      vmul(dirO5b, -1), vadd(s.at(a2.bridge), vmul(dirO5b, GL.CO)), BRIDGE_CHI));
    s.link(a2.bridge, r.c5 + N);
    return Object.assign(f, { s, pa:a1.p, pb:a2.p, n9:ade.n9 + aoff + N });
  }

  {
    // — FADH₂, the reduced form: the molecule as built, both redox hydrogens
    //   present. Registered first because it is the one the geometry is, and
    //   FAD is derived from it below.
    const f = buildFAD();
    KREBS.fadh2 = f.s.spec({
      name:'FADH₂', short:'FADH₂', formula:'C₂₇H₃₅N₉O₁₅P₂²⁻', charge:-2,
      class:'carrier',
      // Six rings: the flavin's three, adenine's fused pair, and the ribose.
      // `linear` is scoped to the flavin's own atoms — see below.
      topology:{ rings:[5,5,6,6,6,6], fused:true, linear:f.ring },
      krebs:{ carrier:true, flavin:f.ring, redox:[f.h1, f.h5], phosphates:2,
              pa:f.pa, pb:f.pb, reduced:true } });
  }
  {
    /* — FAD, the oxidised form: the same molecule without the two hydrogens on
     *   N1 and N5.
     *
     *   BUILT BY DROPPING THEM, not by a second skeleton, so the pair the
     *   `redox` field names on FADH₂ is exactly the pair missing here. The two
     *   drops go highest-index-first so the first does not renumber the second.
     *
     *   THE RING'S BOND ORDERS ARE NOT REDRAWN, and that is a stated
     *   simplification rather than an oversight. Oxidised flavin gains two
     *   ring double bonds (N5=C4a and N1=C10a, the quinoid form) that the
     *   reduced one does not have; drawing that difference would mean a second
     *   Kekulé structure and a second skeleton, and the two would be free to
     *   drift apart on every other atom. What the lesson needs from this pair
     *   is that TWO HYDROGENS moved — the same claim NAD⁺/NADH makes with one
     *   hydride — and that is what the two specs differ by. The bond-order
     *   half is invisible at this scale in any case: both forms render as the
     *   same flat tricycle. Flagged here because it is exactly the sort of
     *   thing MolecularGeometry.md §1.6 says must stay explicit in a comment.
     */
    const f = buildFAD();
    const s = f.s;
    /* THE TWO DROPS GO HIGHEST-INDEX-FIRST so the first cannot renumber the
     * second, and the maps COMPOSE — every index this spec still names is
     * carried through both. Writing the drops without that, which is the
     * obvious version, leaves `flavin` pointing two atoms off. */
    let m = f.s.atoms.map((_, i) => i);
    [f.h1, f.h5].sort((a, b) => b - a).forEach(h => {
      const step = dropAtom(s, h);
      m = m.map(i => (i === h ? null : step[i]));
    });
    KREBS.fad = s.spec({
      name:'FAD', short:'FAD', formula:'C₂₇H₃₃N₉O₁₅P₂²⁻', charge:-2,
      class:'carrier',
      topology:{ rings:[5,5,6,6,6,6], fused:true, linear:f.ring.map(i => m[i]) },
      // remapped through the drop, so these still name the flavin's own atoms
      krebs:{ carrier:true, flavin:f.ring.map(i => m[i]), phosphates:2,
              pa:m[f.pa], pb:m[f.pb], reduced:false } });
  }

  register(KREBS, SELFNAME);
})(this);
