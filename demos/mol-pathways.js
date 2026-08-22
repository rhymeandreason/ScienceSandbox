/* =====================================================================
 *  mol-pathways.js — catabolic pathway intermediates, built from VSEPR angles
 * =====================================================================
 *  Glycolysis, so far: glucose → pyruvate, plus the carriers those steps move
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
    // — glucose: the only ring on the page, and the only unphosphorylated sugar
    const g=ringPyranose();
    const C=[1,2,3,4,5];                  // ring C1…C5
    const RING=[0,1,2,3,4,5];             // O5 + C1…C5, the pyranose ring itself
    // EVERY substituent equatorial — that is what makes this β-D-glucopyranose
    // rather than one of its 15 stereoisomers. Passing slot 0 here (as an earlier
    // version did) alternates axial/equatorial around the ring, which is not
    // glucose and, at C5, not even D-.
    const OH=[];                          // the hydroxyl O's, in C1…C4 then C6 order
    C.forEach(k=>{ if(k<5) OH.push(g.hydroxyl(k, g.equatorial(k,RING))); });
    const c6=g.grow(5,'C',GL.CC,'sp3',g.equatorial(5,RING));   // C6, exocyclic
    OH.push(g.hydroxyl(c6,0));            // free rotor off the ring — no ax/eq here
    // C–H hydrogens. Grown LAST so every index above (cN, c6, the OH's) is
    // unchanged — glycolysis-lab addresses those by position. Every other spec
    // on the pathway omits C–H entirely, and this one keeps that look by listing
    // them all in `optH`: glycolysis-lab hides optional H, macromolecule-lab
    // offers them behind its toggle. A ring carbon has three bonds already, so
    // exactly one slot is free; C6 has two.
    const CH=[];
    C.forEach(k=>CH.push(g.grow(k,'H',GL.CH,'sp3',0)));
    CH.push(g.grow(c6,'H',GL.CH,'sp3',0), g.grow(c6,'H',GL.CH,'sp3',0));
    // Rotate to a clear 3D 3/4 chair perspective (ring face tilted towards camera)
    // the H on each hydroxyl O is grown immediately after its O, so it is the
    // next index — asserted rather than assumed, since a Skel change would move it
    const ohH=OH.map(o=>{
      const b=g.bonds.find(b=>(b[0]===o||b[1]===o) && g.atoms[b[0]===o?b[1]:b[0]].el==='H');
      return b[0]===o?b[1]:b[0];
    });
    GLYCOLYSIS.glucose=g.spec({ name:'Glucose', short:'Glucose', formula:'C₆H₁₂O₆', charge:0, class:'sugar',
      names:['O5','C1','C2','C3','C4','C5','O1','HO1','O2','HO2','O3','HO3','O4','HO4','C6','O6','HO6','H1','H2','H3','H4','H5','H61','H62'],
      smiles:'OC[C@H]1O[C@@H](O)[C@H](O)[C@@H](O)[C@@H:1]1[OH:1]',
      // asserted by check-molecules.js — the one property that no bond length,
      // bond angle or screenshot can confirm, and the one that makes it glucose
      stereo:'all-equatorial',
      view:VIEW.pyranose,
      optH:CH,                            // nonpolar C–H; the five O–H are never optional
      mono:'carbohydrate',                // macromolecule-lab.html: the carbohydrate monomer
      gly:{ carbons:6, ring:true, cN:[...C,c6], phosphates:0,
            note:'β-D-glucopyranose — the ring form that dominates in water' },
      // functional-group index map for macromolecule-lab.html's gallery — the
      // same kind of contract as `gly` above. Derived from the build variables,
      // not typed out, so re-ordering the build can't silently mislabel a group.
      groups:[
        { key:'hydroxyl', label:'Hydroxyl', formula:'–OH',
          atoms:[...OH,...ohH],
          note:'Five of them. Every one is a hydrogen-bond site — which is why sugar dissolves in water.' },
        { key:'ring', label:'Ring oxygen', formula:'–O–', atoms:[0],
          note:'The pyranose ring closes through an oxygen, not a sixth carbon.' },
        { key:'anomeric', label:'Anomeric carbon', formula:'C1', atoms:[1,OH[0],ohH[0]],
          note:'The one carbon bonded to two oxygens. Its –OH points equatorial here (β); flipping it to axial gives α — and α vs β is the whole difference between starch and cellulose.' },
      ],
      // The two half-reactions glucose can enter. No page draws these today —
      // the drag lesson they were written for is gone — but they are a fact
      // about the molecule rather than about a page, they are what
      // LESSONS-ROADMAP §1's hydrolysis half needs (an enzyme runs this
      // backwards), and check-molecules.js audits them. A
      // condensation is one bond made and one water released, so a role names
      // the atom that STAYS bonded and the atoms that leave with the water.
      //
      // WHICH SIDE KEEPS THE OXYGEN is not a free choice — it is read off the
      // product. In maltose and cellobiose the bridging oxygen is grown on the
      // donor's C1 (it is named O1A, and residue B has no O4 at all), so the
      // donor keeps its anomeric O and gives up only that O's H, while the
      // acceptor gives up its whole C4 hydroxyl. The water is O + H + H either
      // way, which is why the reaction shape alone cannot catch getting this
      // backwards: the frame match onto the product geometry is what does.
      //
      // Indices come from the build variables, never typed, so re-ordering the
      // build cannot aim the reaction at the wrong hydroxyl.
      //
      // This spec is BETA — O1 equatorial — so it reaches cellobiose and only
      // cellobiose. Maltose is NOT a second product of this molecule: getting
      // there means moving C1's oxygen to the other side of the ring, which is
      // breaking a bond, not turning the molecule round. Starch's linkage
      // starts from a different reagent, `alphaGlucose` in mol-contrast.js.
      condense:{
        roles:[
          { key:'c1', label:'anomeric –OH', keep:OH[0], leaves:[ohH[0]] },
          { key:'c4', label:'C4 –OH',       keep:4,      leaves:[OH[3], ohH[3]] } ],
        makes:[ { product:'cellobiose', donor:'c1', acceptor:'c4', config:'beta', invert:false } ] },
      // contrast-lab.html: glucose is the reference half of the glucose/galactose
      // pair. `diff` is C4 and its hydroxyl — the one position where galactose
      // differs — derived from the build variables above rather than typed, so
      // re-ordering this build cannot silently point the highlight elsewhere.
      contrast:{ pair:'glucose-galactose', partner:'galactose',
        differs:'one –OH orientation',
        lesson:'why galactosemia is a disease',
        diff:[4, OH[3], ohH[3]],
        // The atoms this molecule shares with its partner, used to register the
        // two against each other on screen. Both are centred on the centroid of
        // their own `align` set, so the part they have in common lands in the
        // same place and the only visible offset is the real difference.
        align:RING,
        note:'C4’s –OH lies equatorial, in the plane of the ring, like every other '
           + 'substituent here. All-equatorial is what makes glucose the most stable '
           + 'hexose — and the one sugar nearly every organism runs on.' } });
  }
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
    g.carbonyl(1,0);                                       // C2 ketone
    GLYCOLYSIS.pyruvate=g.spec({ name:'Pyruvate', short:'Pyruvate', formula:'C₃H₃O₃⁻', charge:-1, class:'sugar',
      gly:{ carbons:3, cN:[0,1,2], phosphates:0, terminal:true,
        // WHAT THE NEXT PATHWAY DOES TO IT. Glycolysis ends here and the
        // bridge reaction starts here, so the two atoms pyruvate dehydrogenase
        // acts on are named on the molecule rather than in whichever page
        // happens to draw it next: C1 leaves as CO₂, C2 is where the oxidation
        // happens and what is left of it becomes acetyl-CoA's thioester
        // carbon. See krebs-lab.html; glycolysis never reads either.
        decarb:0, oxC:1 } });
  }
  {
    // — inorganic phosphate (Pi), the free phosphate already dissolved in the
    //   cytosol. Students routinely assume the second phosphate on 1,3-BPG cost
    //   an ATP; it did not, it came from here, so Pi is drawn as its own species.
    const s=new Skel(); s.put('P',V(0,0,0));
    [[1,1,1],[1,-1,-1],[-1,1,-1],[-1,-1,1]].forEach(d=>{
      s.link(0, s.put('O', vmul(vnorm(V(d[0],d[1],d[2])), GL.PO))); });
    s.grow(1,'H',GL.OH,'sp3',0);
    GLYCOLYSIS.pi=s.spec({ name:'Inorganic phosphate', short:'Pᵢ', formula:'HPO₄²⁻', charge:-2, class:'ion',
      gly:{ carbons:0, phosphates:1, free:true } });
    // — ATP, the carrier the priming steps spend and the payoff steps recharge.
    //   NOT built by Skel: adenine + ribose + a triphosphate chain is 31 heavy
    //   atoms and three fused/ring systems, so it comes from the PubChem 3D
    //   record for the TETRAANION (the cytosolic form) through
    //   tools/sdf2spec-generic.js, the same path AMP took in mol-monomers.js.
    //   Identified by CID, never by name: 'ATP' returns the neutral acid, which
    //   is a different charge state and a different atom count.
    //
    //   THE CLAIM THIS MOLECULE MAKES is the phosphate chain: three of them in
    //   a row, α through γ, with γ on the end. That is the whole reason ATP is
    //   the currency and the whole reason the page can take one off. `gamma`
    //   is the phosphoryl group that TRANSFERS — P plus its three terminal O.
    //   The bridging O between β and γ stays behind and becomes a terminal
    //   oxygen of ADP, which is what a kinase actually does: it moves PO₃⁻,
    //   not the whole phosphate. Removing exactly these four atoms from a built
    //   ATP therefore gives a correct ADP, which is how the page draws it.
    //
    //   HANDEDNESS IS INHERITED, NOT CHECKED HERE. The ribose has four
    //   stereocentres and no internal check can catch a global mirror
    //   (MolecularGeometry.md §1.3) — this spec's guarantee is its provenance:
    //   a CID whose name fixes the configuration (2R,3S,4R,5R), through a
    //   converter that keeps its basis right-handed. That is exactly the cover
    //   `amp` has in mol-monomers.js — except that this one now DOES carry a
    //   `smiles` and a `tools/check-handedness.js` REF entry, because
    //   molecule-viewer.html teaches ABOUT it rather than spending it. That is
    //   the upgrade this comment used to ask for; `amp` still has neither.
    GLYCOLYSIS.atp={ name:'Adenosine triphosphate', short:'ATP',
      formula:'C₁₀H₁₂N₅O₁₃P₃⁴⁻', charge:-4, class:'nucleotide',
      units:'angstrom',
      src:{path:'pubchem', cid:5461108, record:'3d',
           conformer:'0053547400000001', sdf:'atp.sdf',
           tool:'sdf2spec-generic', charge:-4, regen:'exact', fetched:'2026-08-12'},
      // FLAT DRAWING. `flat:true` says a page draws this molecule as a
      // structural diagram as well as a model, which is what makes
      // tools/spec2smiles.js generate the string below off these coordinates.
      // Never typed — a hand-written SMILES is a second, unchecked description
      // of the molecule sitting next to `atoms`/`bonds`, free to drift.
      // It is a DEPICTION string: the molblock it comes from carries no formal
      // charges, so this reads as the neutral acid while `formula` above says
      // what the spec actually is. The flat drawing shows connectivity, and the
      // page says the charge in words rather than letting the picture claim it.
      smiles:'Nc1ncnc2c1ncn2[C@@H]1O[C@H](COP(=O)(O)OP(=O)(O)O[P:1](=[O:1])([OH:1])[OH:1])[C@@H](O)[C@H]1O',
      flat:true,
      // THE 2D LAYOUT the page slides these atoms onto. Heavy atoms only,
      // in spec order, real angstroms — baked by tools/bake-flat2d.js, which
      // has the reasoning. `register()` leaves it alone, so the page applies
      // SCALE itself.
      flat2d:[[3.146,1.441],[5.636,0.911],[6.423,-1.51],[-1.145,-0.042],[-2.744,-3.493],[0.454,-3.493],[1.748,0.987],[4.544,1.895],[2.692,2.839],[3.6,0.043],[6.729,-0.072],[4.653,-0.181],[6.62,2.004],[4.985,-1.204],[6.117,-2.948],[7.861,-1.815],[-3.732,-0.451],[-6.11,-0.451],[-3.451,2.22],[-5.656,3.493],[-7.861,2.22],[-1.88,-2.303],[-0.41,-2.303],[-2.334,-0.905],[0.044,-0.905],[1.442,-0.451],[-4.186,0.947],[-4.921,-1.315],[-5.656,0.947],[-6.391,2.22],[-4.186,3.493]],
      // adenine is the fused bicycle, ribose the third ring
      topology:{rings:[5,5,6], fused:true},
      gly:{ carbons:10, phosphates:3, carrier:true,
            pa:0, pb:1, pg:2,
            // the transferring phosphoryl: Pγ and its three terminal oxygens
            gamma:[2,13,14,15],
            // what is left once those four go, for the label beside it
            spent:{ name:'Adenosine diphosphate', short:'ADP',
                    formula:'C₁₀H₁₂N₅O₁₀P₂³⁻', phosphates:2 } },
      atoms:[ {el:'P',pos:[-3,-1.42,-1.163]},
              {el:'P',pos:[-0.234,-2.465,-1.045]},
              {el:'P',pos:[2.258,-2.882,0.526]},
              {el:'O',pos:[-1.352,0.358,1.474]},
              {el:'O',pos:[-1.361,3.12,3.107]},
              {el:'O',pos:[-3.831,2.91,1.972]},
              {el:'O',pos:[-3.406,-0.055,-0.358]},
              {el:'O',pos:[-1.563,-1.728,-0.448]},
              {el:'O',pos:[-2.757,-1.091,-2.621]},
              {el:'O',pos:[-3.971,-2.51,-0.768]},
              {el:'O',pos:[0.713,-2.361,0.283]},
              {el:'O',pos:[0.355,-1.595,-2.132]},
              {el:'O',pos:[-0.561,-3.921,-1.296]},
              {el:'O',pos:[2.565,-2.485,1.966]},
              {el:'O',pos:[2.176,-4.387,0.296]},
              {el:'O',pos:[3.076,-2.132,-0.52]},
              {el:'N',pos:[0.297,1.59,0.292]},
              {el:'N',pos:[0.774,1.777,-1.88]},
              {el:'N',pos:[2.541,1.336,1.188]},
              {el:'N',pos:[4.217,1.396,-0.584]},
              {el:'N',pos:[3.64,1.675,-2.89]},
              {el:'C',pos:[-1.399,2.744,1.731]},
              {el:'C',pos:[-2.771,2.225,1.341]},
              {el:'C',pos:[-0.501,1.524,1.517]},
              {el:'C',pos:[-2.697,0.768,1.766]},
              {el:'C',pos:[-3.679,-0.126,1.03]},
              {el:'C',pos:[1.657,1.502,0.192]},
              {el:'C',pos:[-0.187,1.754,-0.98]},
              {el:'C',pos:[1.932,1.62,-1.161]},
              {el:'C',pos:[3.27,1.562,-1.538]},
              {el:'C',pos:[3.8,1.295,0.701]},
              {el:'H',pos:[-1.11,3.627,1.153]},
              {el:'H',pos:[-2.897,2.324,0.259]},
              {el:'H',pos:[0.195,1.384,2.352]},
              {el:'H',pos:[-2.863,0.667,2.846]},
              {el:'H',pos:[-4.713,0.189,1.199]},
              {el:'H',pos:[-3.572,-1.156,1.386]},
              {el:'H',pos:[-0.453,3.406,3.304]},
              {el:'H',pos:[-4.662,2.487,1.698]},
              {el:'H',pos:[-1.241,1.843,-1.201]},
              {el:'H',pos:[4.585,1.161,1.438]},
              {el:'H',pos:[4.619,1.63,-3.139]},
              {el:'H',pos:[2.935,1.799,-3.604]} ],
      bonds:[[0,6,null],[0,7,null],[0,8,null],[0,9,2],[1,7,null],[1,10,null],[1,11,null],[1,12,2],[2,10,null],[2,13,null],[2,14,null],[2,15,2],[3,23,null],[3,24,null],[4,21,null],[4,37,null],[5,22,null],[5,38,null],[6,25,null],[16,23,null],[16,26,null],[16,27,null],[17,27,2],[17,28,null],[18,26,2],[18,30,null],[19,29,null],[19,30,2],[20,29,null],[20,41,null],[20,42,null],[21,22,null],[21,23,null],[21,31,null],[22,24,null],[22,32,null],[23,33,null],[24,25,null],[24,34,null],[25,35,null],[25,36,null],[26,28,null],[27,39,null],[28,29,2],[30,40,null]],
      optH:[31,32,33,34,35,36,39,40],
    };
    // The flat drawing highlights the SAME atoms the model does. Not a copy of
    // the list — the list itself, so the two views cannot drift apart and the
    // assertion that already checks `gamma` covers this too.
    GLYCOLYSIS.atp.flatMark = GLYCOLYSIS.atp.gly.gamma;

    // — NADH, the other carrier: the one glycolysis LOADS rather than spends.
    //   Same provenance and the same caveats as `atp` above — PubChem 3D by CID
    //   through tools/sdf2spec-generic.js, handedness inherited from the CID and
    //   checked by nothing here (MolecularGeometry.md 1.3) beyond the
    //   `smiles`/REF pair it shares with ATP.
    //
    //   CHARGE STATE: the NEUTRAL molecule (CID 439153), not the physiological
    //   dianion ATP is stored as. Deliberate, because the two carriers make
    //   different claims. ATP's claim is a chain of ionised phosphates that a
    //   kinase moves the end of, so its charge IS the lesson. NADH's claim is
    //   the nicotinamide ring: C4 (index 39) carries TWO hydrogens, one of them
    //   the hydride G3P dehydrogenase just put there, and the ring's aromaticity
    //   is broken to make room. That is visible in the geometry regardless of
    //   what the diphosphate bridge is doing, and the neutral record is the one
    //   a textbook draws.
    //
    //   THE MOLECULE IS A DIMER of two nucleotides joined tail to tail:
    //   adenine-ribose-P-O-P-ribose-nicotinamide. Only the nicotinamide half
    //   does chemistry; the adenine half is a handle the enzyme grips. `nic`
    //   names the working end so a page can point at it instead of guessing.
    GLYCOLYSIS.nadh={ name:'Nicotinamide adenine dinucleotide (reduced)', short:'NADH',
      formula:'C₂₁H₂₉N₇O₁₄P₂', charge:0, class:'nucleotide',
      units:'angstrom',
      src:{path:'pubchem', cid:439153, record:'3d',
           conformer:'0006B37100000001', sdf:'nadh.sdf',
           tool:'sdf2spec-generic', charge:0, regen:'exact', fetched:'2026-08-13'},
      // As ATP's above: generated, and a DEPICTION string only. `:1` marks are
      // the highlight set, folded onto the heavy atoms a flat drawing draws.
      smiles:'Nc1ncnc2c1ncn2[C@@H]1O[C@H](COP(=O)(O)OP(=O)(O)OC[C@H]2O[C@@H]([N:1]3[CH:1]=[CH:1][CH2:1][C:1]([C:1]([NH2:1])=[O:1])=[CH:1]3)[C@H](O)[C@@H]2O)[C@@H](O)[C@H]1O',
      flat:true,
      // THE 2D LAYOUT the page slides these atoms onto. Heavy atoms only,
      // in spec order, real angstroms — baked by tools/bake-flat2d.js, which
      // has the reasoning. `register()` leaves it alone, so the page applies
      // SCALE itself.
      flat2d:[[-2.72,-3.465],[-0.425,-4.487],[-5.287,0.209],[3.777,-1.601],[-2.008,2.037],[-4.561,3.892],[3.721,-5.355],[6.604,-4.071],[-3.573,-2.291],[1.018,-4.335],[-1.868,-4.638],[-3.894,-4.317],[-0.576,-3.044],[-1.547,-2.612],[-0.273,-5.93],[11.191,0.113],[-7.115,2.037],[6.274,-0.932],[-9.463,2.037],[-6.838,4.673],[-9.014,5.93],[-11.191,4.673],[10.414,-2.277],[-3.388,1.588],[-4.561,2.441],[-3.836,0.209],[-5.735,1.588],[4.022,-3.936],[5.348,-3.346],[3.051,-2.858],[5.196,-1.903],[-2.983,-0.965],[1.608,-3.01],[-7.563,3.417],[7.654,-1.381],[-8.289,1.184],[5.973,0.487],[-9.014,3.417],[8.733,-0.41],[8.431,1.009],[7.051,1.458],[-9.74,4.673],[10.112,-0.858],[-7.563,5.93]],
      // two riboses (5), adenine's fused pair (5+6), nicotinamide (6)
      topology:{rings:[5,5,5,6,6], fused:true},
      gly:{ carbons:21, phosphates:2, carrier:true,
            // the reduced end: ring, the carbon that took the hydride, and the
            // two H's on it — one was there before, one arrived from G3P
            nic:{ ring:[17,34,38,39,40,36], n:17, c4:39, h:[63,64],
                  amide:{c:42, o:15, n:22} },
            // what is left once C4 gives the hydride back, for the label beside it
            spent:{ name:'Nicotinamide adenine dinucleotide (oxidised)',
                    short:'NAD⁺', formula:'C₂₁H₂₇N₇O₁₄P₂⁺' } },
      atoms:[ {el:'P',pos:[4.397,0.862,0.474]},
              {el:'P',pos:[3.266,0.526,3.169]},
              {el:'O',pos:[1.427,-1.871,-2.535]},
              {el:'O',pos:[-0.999,1.171,3.218]},
              {el:'O',pos:[1.383,0.689,-4.191]},
              {el:'O',pos:[-1.042,0.705,-2.966]},
              {el:'O',pos:[-2.705,-1.255,3.633]},
              {el:'O',pos:[-3.304,-0.542,1.071]},
              {el:'O',pos:[3.648,0.531,-0.922]},
              {el:'O',pos:[1.702,0.506,3.58]},
              {el:'O',pos:[3.222,0.834,1.583]},
              {el:'O',pos:[5.248,-0.474,0.802]},
              {el:'O',pos:[3.703,-1.03,3.225]},
              {el:'O',pos:[5.208,2.126,0.468]},
              {el:'O',pos:[4.136,1.457,3.962]},
              {el:'O',pos:[1.891,3.751,-1.243]},
              {el:'N',pos:[-0.832,-2.302,-1.948]},
              {el:'N',pos:[-1.715,2.198,1.204]},
              {el:'N',pos:[-1.549,-3.601,-0.285]},
              {el:'N',pos:[-2.797,-2.328,-3.375]},
              {el:'N',pos:[-4.578,-3.687,-2.406]},
              {el:'N',pos:[-4.337,-4.815,-0.31]},
              {el:'N',pos:[1.97,4.315,0.995]},
              {el:'C',pos:[1.385,0.497,-2.777]},
              {el:'C',pos:[0.017,0.021,-2.329]},
              {el:'C',pos:[2.271,-0.7,-2.444]},
              {el:'C',pos:[0.063,-1.447,-2.725]},
              {el:'C',pos:[-1.612,-1.064,2.736]},
              {el:'C',pos:[-2.031,-0.188,1.575]},
              {el:'C',pos:[-0.578,-0.193,3.435]},
              {el:'C',pos:[-2.015,1.198,2.198]},
              {el:'C',pos:[2.852,-0.636,-1.039]},
              {el:'C',pos:[0.827,-0.352,2.87]},
              {el:'C',pos:[-2.105,-2.67,-2.278]},
              {el:'C',pos:[-0.396,2.591,0.936]},
              {el:'C',pos:[-0.543,-2.886,-0.743]},
              {el:'C',pos:[-2.731,2.873,0.517]},
              {el:'C',pos:[-2.532,-3.475,-1.234]},
              {el:'C',pos:[-0.068,3.546,0.049]},
              {el:'C',pos:[-1.12,4.287,-0.738]},
              {el:'C',pos:[-2.522,3.841,-0.391]},
              {el:'C',pos:[-3.821,-3.991,-1.324]},
              {el:'C',pos:[1.343,3.872,-0.147]},
              {el:'C',pos:[-4.027,-2.887,-3.351]},
              {el:'H',pos:[1.683,1.44,-2.318]},
              {el:'H',pos:[-0.088,0.134,-1.244]},
              {el:'H',pos:[3.081,-0.808,-3.174]},
              {el:'H',pos:[-0.191,-1.598,-3.782]},
              {el:'H',pos:[-1.25,-2.05,2.431]},
              {el:'H',pos:[-1.302,-0.268,0.761]},
              {el:'H',pos:[-0.562,-0.348,4.52]},
              {el:'H',pos:[-2.966,1.422,2.698]},
              {el:'H',pos:[2.06,-0.623,-0.284]},
              {el:'H',pos:[3.464,-1.524,-0.848]},
              {el:'H',pos:[1.15,-1.389,2.998]},
              {el:'H',pos:[0.863,-0.104,1.806]},
              {el:'H',pos:[2.282,0.955,-4.449]},
              {el:'H',pos:[-0.948,1.649,-2.751]},
              {el:'H',pos:[-2.38,-1.789,4.378]},
              {el:'H',pos:[-3.265,-1.478,0.811]},
              {el:'H',pos:[0.364,2.061,1.491]},
              {el:'H',pos:[0.406,-2.754,-0.241]},
              {el:'H',pos:[-3.733,2.546,0.772]},
              {el:'H',pos:[-0.956,4.127,-1.81]},
              {el:'H',pos:[-1.033,5.361,-0.54]},
              {el:'H',pos:[-3.36,4.318,-0.889]},
              {el:'H',pos:[-4.661,-2.664,-4.202]},
              {el:'H',pos:[5.886,-0.46,1.547]},
              {el:'H',pos:[3.262,-1.68,2.638]},
              {el:'H',pos:[-5.277,-5.177,-0.398]},
              {el:'H',pos:[-3.775,-5.042,0.5]},
              {el:'H',pos:[2.953,4.568,0.982]},
              {el:'H',pos:[1.491,4.415,1.884]} ],
      bonds:[[0,8,null],[0,10,null],[0,11,null],[0,13,2],[1,9,null],[1,10,null],[1,12,null],[1,14,2],[2,25,null],[2,26,null],[3,29,null],[3,30,null],[4,23,null],[4,56,null],[5,24,null],[5,57,null],[6,27,null],[6,58,null],[7,28,null],[7,59,null],[8,31,null],[9,32,null],[11,67,null],[12,68,null],[15,42,2],[16,26,null],[16,33,null],[16,35,null],[17,30,null],[17,34,null],[17,36,null],[18,35,2],[18,37,null],[19,33,2],[19,43,null],[20,41,null],[20,43,2],[21,41,null],[21,69,null],[21,70,null],[22,42,null],[22,71,null],[22,72,null],[23,24,null],[23,25,null],[23,44,null],[24,26,null],[24,45,null],[25,31,null],[25,46,null],[26,47,null],[27,28,null],[27,29,null],[27,48,null],[28,30,null],[28,49,null],[29,32,null],[29,50,null],[30,51,null],[31,52,null],[31,53,null],[32,54,null],[32,55,null],[33,37,null],[34,38,2],[34,60,null],[35,61,null],[36,40,2],[36,62,null],[37,41,2],[38,39,null],[38,42,null],[39,40,null],[39,63,null],[39,64,null],[40,65,null],[43,66,null]],
      optH:[44,45,46,47,48,49,50,51,52,53,54,55,60,61,62,63,64,65,66],
    };
    // Same rule as ATP's above: assembled from the checked `nic` block, never
    // retyped. The two H's fold onto C4 in the flat drawing (a hydrogen has no
    // glyph of its own there), which tools/spec2smiles.js does for every mark.
    {
      const n = GLYCOLYSIS.nadh.gly.nic;
      GLYCOLYSIS.nadh.flatMark =
        [...n.ring, n.c4, ...n.h, n.amide.c, n.amide.o, n.amide.n];
    }
  }
  register(GLYCOLYSIS, SELFNAME);
})(this);
