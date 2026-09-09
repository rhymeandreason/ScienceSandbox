/* =====================================================================
 *  mol-pathways.js — catabolic pathway intermediates, built from VSEPR angles
 * =====================================================================
 *  Glycolysis, so far: G6P → pyruvate, plus the carriers those steps move
 *  (ATP/ADP, NAD⁺/NADH, Pi).
 *
 *  NAMED FOR HOW IT IS BUILT, NOT FOR ONE LESSON. This file used to be named
 *  for glycolysis alone, which read as "the glycolysis file" when the library
 *  is not divided by topic at all — it is divided by DERIVATION and SCALE
 *  FAMILY. See the `DOMAINS` note in molecules.js. Everything here is
 *  Skel-built from ideal VSEPR angles and measured bond lengths, which is what
 *  puts it in one file and after `skel.js` in the load order.
 *
 *  So the Krebs and electron-transport intermediates belong HERE when they come
 *  — citrate, the succinate/fumarate pair, the quinones — not in a new domain
 *  file named for respiration. They are the same derivation, the same scale
 *  family and the same builder dependency, and a topic-shaped file could take
 *  part in neither the load order nor `DOMAIN_ALTERNATES`. Split this only when it
 *  is slow to parse or when a page pays for a large set it never draws, which
 *  is the rule the whole partition is built on.
 * ===================================================================== */
(function(global){
  'use strict';
  const SELFNAME = 'mol-pathways.js';
  // Registry from molecules.js. Domain files only ever ADD to it.
  const Lib = global.MolLib
    || (typeof require === 'function' ? require('./molecules.js').MolLib : null);
  if (!Lib) throw new Error(SELFNAME + ': molecules.js must be loaded first');
  const { MOLECULES, VIEW, register } = Lib;
  // Builder + bond-length tables from skel.js. This file cannot be loaded
  // without it; the page script table in CLAUDE.md is the enumeration that
  // keeps that true.
  const SkelLib = global.SkelLib
    || (typeof require === 'function' ? require('./skel.js').SkelLib : null);
  if (!SkelLib) throw new Error(SELFNAME + ': skel.js must be loaded first');
  const { GL, AR, TET, SP2, V, vadd, vsub, vmul, vlen, vnorm, vcross, rad,
          perpTo, Skel, chainC, ringPyranose, ringFuranose, flatRing, fuseRing,
          flatH } = SkelLib;

  /* =====================================================================
   *  GLYCOLYSIS INTERMEDIATES  (glycolysis-lab.html)
   * =====================================================================
   *  These specs are COMPUTED, not typed out. Every earlier molecule here is
   *  small enough to hand-place, but a phosphorylated six-carbon sugar has
   *  ~30 atoms and four tetrahedral centres per phosphate — hand coordinates
   *  would be eyeballed, and SCIENCE.md's rule is that accuracy lives in the
   *  coordinates. So geometry is generated from bond lengths + real VSEPR
   *  angles by the tiny `Skel` builder below, and check-molecules.js audits
   *  the result (no sphere overlaps, printed angles).
   *
   *  MODEL SIMPLIFICATIONS — all deliberate, all listed here:
   *   1. C–H hydrogens are OMITTED on the carbon backbone. The lesson is
   *      "where do the six carbons go", so the carbons must stay countable;
   *      24 extra H's would bury them. The exceptions are the two molecules
   *      whose STEP is about a specific hydrogen, and they are the same H
   *      twice: DHAP's two C3 hydrogens (step 5 moves one of them to C2, and
   *      the other survives as…) and the aldehyde H on G3P's C1 (…which step 6
   *      oxidises onto NAD⁺). Everywhere else the backbone stays bare.
   *      Hydroxyl O–H hydrogens are always drawn (they read as "–OH").
   *   2. C=O double bonds are tagged `[i,j,2]` and drawn as a PAIR of sticks
   *      (see `bond()` in scene.js / the labs). P=O is the exception: the three
   *      phosphate O's are all drawn as single sticks, because the charge is
   *      delocalised over them and picking one to double up would be a lie.
   *   3. From the ISOMERISATION on, the sugar is drawn as an OPEN CHAIN, the
   *      way every textbook draws glycolysis (Fischer projection), not as the
   *      furanose ring F1,6-bisphosphate actually is in solution. The open
   *      chain is what makes "six carbons in a row snap into 3 + 3" legible,
   *      which is the whole reason this page exists.
   *      WHERE THE CHAIN STARTS IS ITSELF THE CLAIM. Glucose and G6P are both
   *      drawn as real pyranose rings, because phosphorylating C6 — a carbon
   *      outside the ring — opens nothing; the ring opens at step 2, where the
   *      aldose→ketose isomerisation genuinely runs through the open-chain
   *      aldehyde. Opening it at step 1 instead (as this file did until the
   *      ring G6P landed) put the biggest event on the page's most-watched
   *      step on a change of drawing style rather than on chemistry.
   *   4. Phosphate/carboxylate charges live in the labels and the ledger, not
   *      in a force model — this page has no electrostatics (it is not the
   *      solvation engine).
   */


  // ---- the intermediates ------------------------------------------------
  // `gly` is this page's metadata block (the analogue of `pep` on the amino
  // acids): `cN` maps the biologist's carbon numbering onto atom indices, `p1`
  // /`p3` are the phosphorus atoms (effect anchors), `cleave` is the bond
  // aldolase breaks, and `carbons` is the count the ledger asserts on screen.

  const GLYCOLYSIS = {};
  {
    // — glucose-6-phosphate: STILL A RING. Hexokinase phosphorylates C6, which
    //   is the exocyclic carbon hanging off C5 — it is not in the ring, and
    //   putting a phosphate on it does not open one. G6P in solution is a
    //   pyranose just as glucose is.
    //
    //   This spec was an open chain, and drawing it that way made step 1 look
    //   like hexokinase tore the ring apart. The ring DOES open on the way to
    //   fructose-6-phosphate — the aldose→ketose isomerisation at step 2 runs
    //   through the open-chain aldehyde — so the opening belongs to step 2,
    //   where it is chemistry, rather than to step 1, where it was only the
    //   picture changing style. `open` is the bond that breaks when it goes:
    //   C1–O5, the ring's anomeric bond.
    const g=ringPyranose();
    const C=[1,2,3,4,5];                  // ring C1…C5
    const RING=[0,1,2,3,4,5];             // O5 + C1…C5
    const OH=[];
    C.forEach(k=>{ if(k<5) OH.push(g.hydroxyl(k, g.equatorial(k,RING))); });
    const c6=g.grow(5,'C',GL.CC,'sp3',g.equatorial(5,RING));   // C6, exocyclic
    const p=g.phosphate(c6,0);            // …and the phosphate goes on THAT
    // C–H last, so every index above is unchanged — same order glucose uses
    const CH=[];
    C.forEach(k=>CH.push(g.grow(k,'H',GL.CH,'sp3',0)));
    CH.push(g.grow(c6,'H',GL.CH,'sp3',0), g.grow(c6,'H',GL.CH,'sp3',0));
    // THE PROTON THE RING OXYGEN ENDS UP WITH, and the one atom in this spec
    // that the closed pyranose does NOT have: as drawn here O5 has three
    // connections, which is an oxonium and wrong. It is the OPEN chain's atom —
    // when C1–O5 breaks, O5 leaves as C5's hydroxyl and needs an H — and the
    // page keeps it hidden until step 2's first proton lands on it.
    // Built into the spec rather than conjured at run time because it has to be
    // a real mesh in the real place: an H that appears where the geometry says
    // an H goes, not a glow parked near an oxygen. Hidden at build (see
    // glycolysis-lab's `build`), NOT via optH — that field is nonpolar C–H's,
    // and scene.js's contract is that an H on N/O/S is never in it.
    const openH=g.grow(0,'H',GL.OH,'sp3',0);
    GLYCOLYSIS.g6p=g.spec({ name:'Glucose-6-phosphate', short:'G6P', formula:'C₆H₁₁O₉P²⁻', charge:-2, class:'sugar',
      // the same two claims glucose carries, because it is the same ring
      stereo:'all-equatorial',
      topology:{ rings:[6] },
      view:VIEW.pyranose,
      optH:CH,
      gly:{ carbons:6, ring:true, cN:[...C,c6], p3:p, phosphates:1,
            open:[1,0],               // C1–O5: the bond that breaks at step 2
            // THE PROTON THAT MOVES when the hemiacetal comes apart: the
            // anomeric –OH on C1 gives its H to the ring oxygen, which leaves
            // as C5's hydroxyl while C1 becomes the aldehyde. The page draws
            // that hop, so it needs both ends by index. Found, not assumed —
            // an O's H is grown right after it, but a Skel change would move it.
            anomeric:{ o:OH[0], h:(()=>{ const o=OH[0];
              const b=g.bonds.find(b=>(b[0]===o||b[1]===o)
                && g.atoms[b[0]===o?b[1]:b[0]].el==='H');
              return b[0]===o?b[1]:b[0]; })() },
            // …and the OTHER proton step 2 moves: C2's H, which ends up on C1
            // as the carbonyl shifts the other way. CH is grown C1…C5 then C6
            // twice, so CH[1] is C2's. The page sheds it as the hop starts —
            // without that the proton has no visible origin.
            c2H:CH[1],
            openH,                    // hidden until the hemiacetal opens
            // …which is what `latentH` says generally: hydrogens the spec grows
            // but the RESTING molecule does not have, hidden at build and drawn
            // from the beat they arrive on. The page hides this list and nothing
            // else; the named field beside it is what a step aims at.
            latentH:[openH],
            note:'still a pyranose — C6 is outside the ring, so phosphorylating '
               + 'it opens nothing' } });
  }
  {
    // — fructose-6-phosphate: the aldose→ketose isomerisation, and nothing else.
    //   G6P's C1 aldehyde has become a C1 hydroxyl and the C=O has moved to C2.
    //   That shift is the whole point of step 2: an aldose cannot be cut into two
    //   phosphorylatable three-carbon halves, a ketose can, so the cell pays a
    //   step to move the carbonyl one carbon in before it pays its second ATP.
    const g=chainC(6);
    g.hydroxyl(0,0);                                       // C1 –OH (was the aldehyde)
    g.carbonyl(1,0);                                       // C2 ketone
    // C3…C5 –OH. C5 TAKES THE OTHER SLOT: `k%2` alternates faces, which is what
    // a Fischer drawing looks like but is not a configuration — and at C5 it
    // put the –OH on the wrong side. C5 is not touched by this reaction or by
    // aldolase, so it must match glucose's C5 (which the ring's all-equatorial
    // claim fixes) and G3P's C2 (which it becomes). It matched neither: the
    // centre inverted at step 2 and inverted back at step 4. `dCentre` below is
    // the assertion that it cannot drift again.
    for(let k=2;k<=4;k++) g.hydroxyl(k, k===4 ? 1 : k%2);
    const p6=g.phosphate(5,0);                             // C6 –O–PO₃, carried over
    GLYCOLYSIS.f6p=g.spec({ name:'Fructose-6-phosphate', short:'F6P', formula:'C₆H₁₁O₉P²⁻', charge:-2, class:'sugar',
      gly:{ carbons:6, cN:[0,1,2,3,4,5], p1:null, p3:p6, phosphates:1,
            c1:0,                     // where PFK-1's phosphate lands next
            dCentre:[4,3,5],          // C5 (–O, C4, C6) — must match glucose's C5
            note:'drawn open-chain (Fischer); really a furanose ring in solution' } });
  }
  {
    // — fructose-1,6-bisphosphate: both ENDS phosphorylated. PFK-1's product, and
    //   the committed step — past here the carbon has no fate but glycolysis.
    const g=chainC(6);
    const p1=g.phosphate(0,0);                             // C1 –O–PO₃
    g.carbonyl(1,0);                                       // C2 ketone
    for(let k=2;k<=4;k++) g.hydroxyl(k, k===4 ? 1 : k%2);  // C3…C5 –OH; C5, see f6p
    const p6=g.phosphate(5,0);                             // C6 –O–PO₃
    GLYCOLYSIS.f16bp=g.spec({ name:'Fructose-1,6-bisphosphate', short:'F1,6-BP', formula:'C₆H₁₀O₁₂P₂⁴⁻', charge:-4, class:'sugar',
      gly:{ carbons:6, cN:[0,1,2,3,4,5], p1, p3:p6, phosphates:2,
            cleave:[2,3],           // aldolase cuts C3–C4 → DHAP (C1-3) + G3P (C4-6)
            dCentre:[4,3,5],        // C5 — survives the cut as G3P's C2
            note:'drawn open-chain (Fischer) though it is really a furanose ring' } });
  }
  {
    // — DHAP: the C1–C3 half of the cut. A ketose, so it is NOT yet a substrate
    //   for the payoff phase; triose-phosphate isomerase converts it to G3P.
    // BUILT UPSIDE-DOWN, THEN TURNED OVER — and that is not a flourish, it is
    // what makes step 5's turn exact. The page ends the isomerase by rotating
    // this molecule 180° about X and swapping G3P in, so flipped-DHAP's atoms
    // have to land on G3P's. Building the phosphate with `phosphate(0,…)` at
    // the chain's TOP does not do that: `freeTet` derives its slot directions
    // per atom, so slot 0 on the first carbon is not the mirror of slot 0 on
    // the last, and the P came down 1.23 Å off — a visible jump on the one step
    // whose point is that the phosphate does NOT move. Growing it with the SAME
    // call G3P uses, on the same end of the same chain, makes the two frames
    // mirror images by construction; the rotate() then puts DHAP the way up the
    // split delivers it (F1,6-BP's top half keeps the top phosphate).
    // Asserted by `turnX` below — the whole reason that check exists.
    const g=chainC(3);
    const p=g.phosphate(2,0);                              // as g3p grows its own
    g.carbonyl(1,0);
    g.hydroxyl(0,1);
    // THE TWO HYDROGENS ON C3, drawn — the second exception to "no backbone
    // C–H" (see MODEL SIMPLIFICATIONS 1), and for the same reason as the first:
    // step 5 is ABOUT one of them. The isomerase takes one off C3 and puts it
    // on C2; the C=O slides out to C3 behind it. So of these two, one moves and
    // the other STAYS — and the one that stays is drawn again on the product as
    // G3P's `aldehydeH`, the very H that NAD⁺ takes at step 6. Drawing both
    // makes that continuous: two H here, one H there, and the student watched
    // which one left.
    // WHICH of the two is a pedagogical pick. The enzyme abstracts the pro-R
    // proton specifically, but C3 is prochiral (two H, one OH, one C) — the
    // choice is invisible in a ball-and-stick and naming either is honest about
    // the reaction while staying silent about a face the page never shows.
    const hMove=g.grow(0,'H',GL.CH,'sp3',0);
    g.grow(0,'H',GL.CH,'sp3',0);                           // the one that stays
    g.rotate(Math.PI,0,0);                                 // phosphate to the top
    GLYCOLYSIS.dhap=g.spec({ name:'Dihydroxyacetone phosphate', short:'DHAP', formula:'C₃H₅O₆P²⁻', charge:-2, class:'sugar',
      // `turnX` is a claim about DRAWING, not chemistry, and it is the one the
      // step 5 animation rests on: this molecule turned 180° about X lands on
      // g3p's frame. It has to, because DHAP is drawn phosphate-UP (it is
      // F1,6-BP's top half) and G3P phosphate-DOWN, so the page turns the one
      // over before swapping in the other. If the two frames disagree the swap
      // jogs, and a jog on this step reads as the phosphate moving — which is
      // exactly what the reaction does NOT do.
      // cN RUNS BACKWARDS THROUGH THE INDICES because the build does: the chain
      // was grown phosphate-last and then turned over, so DHAP's C1 — the
      // phosphate carbon, by the biologist's numbering — is atom 2, and C3 (the
      // one that loses a hydrogen) is atom 0. cN is exactly the map that lets
      // the rest of the page keep saying "C1" and mean the right sphere.
      gly:{ carbons:3, cN:[2,1,0], p1:p, phosphates:1, movingH:hMove, turnX:'g3p' } });
  }
  {
    // — G3P: the C4–C6 half, renumbered C1–C3. The aldehyde H on C1 is drawn
    //   because THAT is the hydrogen NAD⁺ takes in the next stage.
    const g=chainC(3);
    g.carbonyl(0,0); const h=g.grow(0,'H',GL.CH,'sp2',0);
    g.hydroxyl(1,1);
    // C2's HYDROGEN, drawn — the one step 5 just put there. DHAP's C2 is a
    // carbonyl and carries none; G3P's is a CHOH and carries exactly one, so
    // this atom is the product half of the isomerase's move. Without it the
    // proton the student watched cross the molecule arrives nowhere and the
    // step ends with a hydrogen unaccounted for.
    const h2=g.grow(1,'H',GL.CH,'sp3',0);
    const p=g.phosphate(2,0);
    GLYCOLYSIS.g3p=g.spec({ name:'Glyceraldehyde-3-phosphate', short:'G3P', formula:'C₃H₅O₆P²⁻', charge:-2, class:'sugar',
      gly:{ carbons:3, cN:[0,1,2], p3:p, phosphates:1, aldehydeH:h, c2H:h2, dCentre:[1,0,2] } });
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
    // C2's H, carried through — see g3p. It is the same atom from step 5, where
    // the student put it there, to step 9, where it leaves in the water; drawn
    // at every station in between so it does not blink out and back.
    const h2=g.grow(1,'H',GL.CH,'sp3',0);
    const p3=g.phosphate(2,0);
    GLYCOLYSIS.bpg13=g.spec({ name:'1,3-bisphosphoglycerate', short:'1,3-BPG', formula:'C₃H₄O₁₀P₂⁴⁻', charge:-4, class:'sugar',
      gly:{ carbons:3, cN:[0,1,2], p1, p3, phosphates:2, hot:p1, c2H:h2, dCentre:[1,0,2] } });
  }
  {
    // — 3-phosphoglycerate: C1 phosphate handed to ADP, leaving a carboxylate.
    //   Drawn ionised (–COO⁻), which is accurate at cytosolic pH ~7.2. (The
    //   amino-acid page draws the neutral –COOH instead, because there the
    //   leaving –OH has to be visible; here nothing leaves, so accuracy wins.)
    const g=chainC(3);
    g.carbonyl(0,0); g.grow(0,'O',GL.CdO,'sp2',0);         // carboxylate: two O's
    const oh2=g.hydroxyl(1,1);
    const h2=g.grow(1,'H',GL.CH,'sp3',0);                  // C2's H, carried through
    const p=g.phosphate(2,0);
    // THE TWO PROTONS THE MUTASE SWAPS. Step 8 moves the phosphate C3 → C2, so
    // C2's hydroxyl has to give ITS proton up (an oxygen cannot attack the
    // phosphorus while still holding one) and C3's oxygen takes one back as the
    // phosphate leaves. Net zero — both specs are C₃H₄O₇P³⁻ at charge −3 — but
    // neither event is nothing, and drawing only the arrival (which the product
    // spec gave away for free) left the phosphate landing on an oxygen that
    // still visibly held its H.
    //   · oh2H  is on the molecule and leaves.
    const oh2H=(()=>{ const b=g.bonds.find(b=>(b[0]===oh2||b[1]===oh2)
      && g.atoms[b[0]===oh2?b[1]:b[0]].el==='H');
      return b[0]===oh2?b[1]:b[0]; })();
    //   · oh3H is the one that ARRIVES, so it is latent: as drawn here the C3
    //     oxygen already carries the phosphate, and a third connection would be
    //     an oxonium. It belongs to the molecule the instant that phosphate
    //     goes. Grown last so no index above it moves.
    //     The bridge is DERIVED, not typed: of the P's oxygens it is the one
    //     with a second heavy neighbour (C3). Same distinction terminalO makes.
    const nb=i=>g.bonds.filter(b=>b.includes(i)).map(b=>b[0]===i?b[1]:b[0]);
    const bridge=nb(p).filter(i=>g.atoms[i].el==='O'
                  && nb(i).some(x=>x!==p && g.atoms[x].el!=='H'))[0];
    const oh3H=g.grow(bridge,'H',GL.OH,'sp3',0);
    // `hot` is deliberately ABSENT here, unlike on 1,3-BPG and PEP. 3-PG's C3
    // phosphate is an ordinary low-energy ester — it cannot phosphorylate ADP,
    // which is exactly why steps 8 and 9 exist: the cell has to MOVE that
    // phosphate to C2 and then dehydrate the molecule to make it transferable.
    GLYCOLYSIS.pga3=g.spec({ name:'3-phosphoglycerate', short:'3-PG', formula:'C₃H₄O₇P³⁻', charge:-3, class:'sugar',
      gly:{ carbons:3, cN:[0,1,2], p3:p, phosphates:1, c2H:h2, dCentre:[1,0,2],
            oh2H, oh3H, latentH:[oh3H] } });
  }
  {
    // — 2-phosphoglycerate: the same atoms as 3-PG with the phosphate moved from
    //   C3 to C2. Phosphoglycerate mutase does nothing to the energy books — no
    //   ATP, no NADH, no carbon — and that is the reason to show it: it sets up
    //   the dehydration that follows, which is what actually creates a
    //   high-energy phosphate out of a low-energy one.
    const g=chainC(3);
    g.carbonyl(0,0); g.grow(0,'O',GL.CdO,'sp2',0);         // C1 carboxylate
    // SLOT 1, matching 3-PG's C2 –OH. The mutase moves the phosphate between
    // C3 and C2; it does not invert C2, and putting the new substituent in the
    // other tetrahedral slot is exactly an inversion. Same class of slip as
    // F6P's C5, caught by the same assertion.
    const p=g.phosphate(1,1);                              // C2 –O–PO₃
    const oh=g.hydroxyl(2,0);                              // C3 –OH — the OH enolase removes
    // THE OTHER HALF OF THE WATER. A dehydration needs two atoms and a hydroxyl
    // is only one of them: the H comes off C2, next door. Drawn for the same
    // reason as DHAP's and G3P's (MODEL SIMPLIFICATIONS 1) — step 9 is about
    // these atoms, and a water that assembles from one drawn atom and one
    // invisible one is a water half conjured.
    const lh=g.grow(1,'H',GL.CH,'sp3',0);
    GLYCOLYSIS.pga2=g.spec({ name:'2-phosphoglycerate', short:'2-PG', formula:'C₃H₄O₇P³⁻', charge:-3, class:'sugar',
      gly:{ carbons:3, cN:[0,1,2], p2:p, phosphates:1, oh3:oh, loseH:lh, dCentre:[1,0,2] } });
  }
  {
    // — phosphoenolpyruvate: 2-PG minus a water. Enolase pulls the C3 –OH and a
    //   C2 hydrogen out as H₂O, leaving a C2=C3 double bond and trapping the
    //   molecule in its ENOL form. That is the whole trick: the enol is strained
    //   relative to the keto form pyruvate would rather be, and losing the
    //   phosphate is what lets it relax. PEP therefore has the highest
    //   phosphoryl-transfer potential of any biological molecule — well above
    //   ATP's — which is why step 10 is both spontaneous and irreversible.
    // Only C1–C2 comes from chainC. C3 is GROWN off C2 instead of laid down by
    // the scaffold, because chainC's backbone angle is the tetrahedral-ish 111°
    // and C2 here is sp2 — every angle around it has to be 120°, and the C2=C3
    // bond has to be 1.33 Å rather than the single-bond 1.54. Both fall out of
    // grow() once the parent's hybridisation is stated; neither does if C3 is
    // repositioned after the fact.
    const g=chainC(2);
    g.carbonyl(0,0); g.grow(0,'O',GL.CdO,'sp2',0);         // C1 carboxylate
    // The enol ester oxygen hangs off an sp2 carbon, so it is grown at 120° —
    // Skel.phosphate() assumes a tetrahedral parent and would put it at 109.5°.
    const o=g.grow(1,'O',GL.CO,'sp2',0);
    const c3=g.grow(1,'C',GL.CdC,'sp2',0,2);               // C2=C3, the enol double bond
    const p=g.grow(o,'P',GL.OP,'sp3',0);
    for(let k=0;k<3;k++) g.grow(p,'O',GL.PO,'sp3',0);
    GLYCOLYSIS.pep=g.spec({ name:'Phosphoenolpyruvate', short:'PEP', formula:'C₃H₂O₆P³⁻', charge:-3, class:'sugar',
      gly:{ carbons:3, cN:[0,1,c3], p2:p, phosphates:1, hot:p, enol:[1,c3] } });
  }
  {
    // — pyruvate: the finish line. Three carbons, no phosphate left, and a
    //   methyl at C3 as a united atom (same convention as alanine's –CH₃).
    const g=chainC(3);
    g.carbonyl(0,0); g.grow(0,'O',GL.CdO,'sp2',0);         // C1 carboxylate
    const ket=g.carbonyl(1,0);                             // C2 ketone
    GLYCOLYSIS.pyruvate=g.spec({ name:'Pyruvate', short:'Pyruvate', formula:'C₃H₃O₃⁻', charge:-1, class:'sugar',
      gly:{ carbons:3, cN:[0,1,2], phosphates:0, terminal:true,
        // THE BOND A REDUCTION ATTACKS, for the branch after this one: C2=O is
        // what takes the hydride and becomes an alcohol. Captured from the
        // build rather than typed, so re-ordering the spec cannot point the
        // hotspot at a bond that is no longer there. fermentation-lab.html.
        redBond:[1,ket],
        // WHAT THE NEXT PATHWAY DOES TO IT. Glycolysis ends here and the
        // bridge reaction starts here, so the two atoms pyruvate dehydrogenase
        // acts on are named on the molecule rather than in whichever page
        // happens to draw it next: C1 leaves as CO₂, C2 is where the oxidation
        // happens and what is left of it becomes acetyl-CoA's thioester
        // carbon. See krebs-lab.html; glycolysis never reads either.
        decarb:0, oxC:1 } });
  }

  /* =====================================================================
   *  FERMENTATION INTERMEDIATES  (fermentation-lab.html)
   * =====================================================================
   *  Where pyruvate goes with no oxygen: reduced straight to lactate, or
   *  decarboxylated and then reduced to ethanol. Same builder and same scale
   *  family as the glycolysis intermediates above, which is not a filing
   *  convenience — lactate differs from pyruvate at exactly one carbon, and
   *  two molecules built by different routines would show that difference
   *  mixed in with a difference in drawing style.
   *
   *  MODEL SIMPLIFICATIONS 1 (above) applies unchanged: methyls are united
   *  atoms and the only C–H hydrogens drawn are the ones a step is about.
   *  Here that is the hydride NADH hands over, so both products wear the H
   *  they were given on the carbon that took it. Nothing else gains one.
   */
  {
    // — lactate: pyruvate with its C2 ketone reduced to an alcohol. No carbon
    //   lost, nothing else touched — C1 is still a carboxylate and C3 still a
    //   methyl — so the ONLY difference from pyruvate is at C2, which trades
    //   its double-bonded O for an –OH and an H. That one carbon is the claim.
    const g=chainC(3);
    g.carbonyl(0,0); g.grow(0,'O',GL.CdO,'sp2',0);   // C1 carboxylate
    const oh=g.hydroxyl(1,0);                        // C2 –OH …
    const nh=g.grow(1,'H',GL.CH,'sp3',0);            // … and the hydride that made it
    GLYCOLYSIS.lactate=g.spec({ name:'Lactate', short:'Lactate',
      formula:'C₃H₅O₃⁻', charge:-1, class:'sugar',
      // REDUCING A KETONE MAKES A STEREOCENTRE, and which one is not a detail
      // the build gets to decide: C2's four slots come out of freeTet in an
      // order set by the cross-product sign, so taking slot 0 twice would give
      // whichever hand fell out. Muscle LDH makes L-lactate, which is (S), and
      // this is the assertion that fails if a later edit reverses it.
      chiral:[{ at:1, priority:[oh, 0, 2, nh], hand:'S' }],
      // `nh` and `oh` are not named in the block: nothing reads them, and `oh2`
      // already means a hydroxyl INDEX on bpg13 above, where it is read.
      gly:{ carbons:3, cN:[0,1,2], phosphates:0, terminal:true } });
  }
  {
    // — acetaldehyde: what is left of pyruvate once pyruvate decarboxylase
    //   takes C1 away as CO₂. Two carbons, and the aldehyde H is DRAWN even
    //   though no step moves it: it is the H that distinguishes an aldehyde
    //   from the ketone pyruvate was, and the next step adds a second one
    //   beside it. Both have to be visible for that to read as a change.
    const g=chainC(2);
    const ket=g.carbonyl(0,0);                       // C1=O
    // NOT named `aldehydeH`: that name means "the H a dehydrogenase takes"
    // everywhere else in this library (G3P's), and this one stays put.
    const fh=g.grow(0,'H',GL.CH,'sp2',0);
    GLYCOLYSIS.acetaldehyde=g.spec({ name:'Acetaldehyde', short:'Acetaldehyde',
      formula:'C₂H₄O', charge:0, class:'sugar',
      // same name pyruvate's carbonyl carries, and the same reason
      // `oxC` is pyruvate's name for the carbon whose oxidation state the next
      // step changes, and it is the right name in both directions: there a
      // dehydrogenase takes from it, here a dehydrogenase gives to it. One
      // atom, one name, so reaction/reaction.js does not learn a second.
      gly:{ carbons:2, cN:[0,1], phosphates:0, formylH:fh, oxC:0, redBond:[0,ket] } });
  }
  {
    // — ethanol: acetaldehyde's carbonyl reduced, the mirror of lactate's step
    //   on a molecule one carbon shorter. C0 keeps the aldehyde H it had and
    //   gains a second from NADH, which is why both are drawn: the carbon ends
    //   the step wearing two hydrogens and neither is decoration.
    //   Index 0 is the reactive carbon in both this and acetaldehyde, so the
    //   step's before and after point at the same sphere.
    const g=chainC(2);
    g.hydroxyl(0,0);                                 // C1 –OH
    const fh=g.grow(0,'H',GL.CH,'sp3',0);            // the aldehyde H, kept
    g.grow(0,'H',GL.CH,'sp3',0);                     // the hydride from NADH
    // NO STEREOCENTRE, and that is worth stating rather than leaving to be
    // noticed: C1 carries two identical hydrogens, so ethanol has no hand to
    // get wrong and needs no `chiral`. Lactate's C2 does, and has one.
    // NOT `ethanol`: mol-small.js already holds one, all-atom and hand-written
    // for the solvation lessons. Same substance, different
    // DEPICTION — its methyl carries three explicit H's and this file's methyls
    // are united atoms, so reusing it would sprout three hydrogens on the
    // methyl at the exact moment the step is claiming one hydride arrived
    // somewhere else. Two specs, one name each, the way `atp`/`atpSkel` split.
    GLYCOLYSIS.ethanolSkel=g.spec({ name:'Ethanol', short:'Ethanol',
      formula:'C₂H₆O', charge:0, class:'sugar',
      gly:{ carbons:2, cN:[0,1], phosphates:0, terminal:true, formylH:fh } });
  }
  register(GLYCOLYSIS, SELFNAME);
})(this);
