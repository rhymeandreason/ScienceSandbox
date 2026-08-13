/* =====================================================================
 *  mol-glycolysis.js — the glycolysis pathway, built from VSEPR angles
 * ===================================================================== */
(function(global){
  'use strict';
  const SELFNAME = 'mol-glycolysis.js';
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
   *      24 extra H's would bury them. The ONE exception is the aldehyde H on
   *      G3P's C1 — that specific H is what gets oxidised onto NAD⁺, so it is
   *      drawn. Hydroxyl O–H hydrogens are always drawn (they read as "–OH").
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
    GLYCOLYSIS.glucose=g.spec({ name:'Glucose', short:'Glucose', formula:'C₆H₁₂O₆', class:'sugar',
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
    GLYCOLYSIS.g6p=g.spec({ name:'Glucose-6-phosphate', short:'G6P', formula:'C₆H₁₃O₉P²⁻', class:'sugar',
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
    GLYCOLYSIS.f6p=g.spec({ name:'Fructose-6-phosphate', short:'F6P', formula:'C₆H₁₃O₉P²⁻', class:'sugar',
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
    GLYCOLYSIS.f16bp=g.spec({ name:'Fructose-1,6-bisphosphate', short:'F1,6-BP', formula:'C₆H₁₄O₁₂P₂⁴⁻', class:'sugar',
      gly:{ carbons:6, cN:[0,1,2,3,4,5], p1, p3:p6, phosphates:2,
            cleave:[2,3],           // aldolase cuts C3–C4 → DHAP (C1-3) + G3P (C4-6)
            dCentre:[4,3,5],        // C5 — survives the cut as G3P's C2
            note:'drawn open-chain (Fischer) though it is really a furanose ring' } });
  }
  {
    // — DHAP: the C1–C3 half of the cut. A ketose, so it is NOT yet a substrate
    //   for the payoff phase; triose-phosphate isomerase converts it to G3P.
    const g=chainC(3);
    const p=g.phosphate(0,0);
    g.carbonyl(1,0);
    g.hydroxyl(2,1);
    GLYCOLYSIS.dhap=g.spec({ name:'Dihydroxyacetone phosphate', short:'DHAP', formula:'C₃H₇O₆P²⁻', class:'sugar',
      gly:{ carbons:3, cN:[0,1,2], p1:p, phosphates:1 } });
  }
  {
    // — G3P: the C4–C6 half, renumbered C1–C3. The aldehyde H on C1 is drawn
    //   because THAT is the hydrogen NAD⁺ takes in the next stage.
    const g=chainC(3);
    g.carbonyl(0,0); const h=g.grow(0,'H',GL.CH,'sp2',0);
    g.hydroxyl(1,1);
    const p=g.phosphate(2,0);
    GLYCOLYSIS.g3p=g.spec({ name:'Glyceraldehyde-3-phosphate', short:'G3P', formula:'C₃H₇O₆P²⁻', class:'sugar',
      gly:{ carbons:3, cN:[0,1,2], p3:p, phosphates:1, aldehydeH:h, dCentre:[1,0,2] } });
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
    const p3=g.phosphate(2,0);
    GLYCOLYSIS.bpg13=g.spec({ name:'1,3-bisphosphoglycerate', short:'1,3-BPG', formula:'C₃H₈O₁₀P₂⁴⁻', class:'sugar',
      gly:{ carbons:3, cN:[0,1,2], p1, p3, phosphates:2, hot:p1, dCentre:[1,0,2] } });
  }
  {
    // — 3-phosphoglycerate: C1 phosphate handed to ADP, leaving a carboxylate.
    //   Drawn ionised (–COO⁻), which is accurate at cytosolic pH ~7.2. (The
    //   amino-acid page draws the neutral –COOH instead, because there the
    //   leaving –OH has to be visible; here nothing leaves, so accuracy wins.)
    const g=chainC(3);
    g.carbonyl(0,0); g.grow(0,'O',GL.CdO,'sp2',0);         // carboxylate: two O's
    g.hydroxyl(1,1);
    const p=g.phosphate(2,0);
    // `hot` is deliberately ABSENT here, unlike on 1,3-BPG and PEP. 3-PG's C3
    // phosphate is an ordinary low-energy ester — it cannot phosphorylate ADP,
    // which is exactly why steps 8 and 9 exist: the cell has to MOVE that
    // phosphate to C2 and then dehydrate the molecule to make it transferable.
    GLYCOLYSIS.pga3=g.spec({ name:'3-phosphoglycerate', short:'3-PG', formula:'C₃H₆O₇P²⁻', class:'sugar',
      gly:{ carbons:3, cN:[0,1,2], p3:p, phosphates:1, dCentre:[1,0,2] } });
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
    GLYCOLYSIS.pga2=g.spec({ name:'2-phosphoglycerate', short:'2-PG', formula:'C₃H₆O₇P²⁻', class:'sugar',
      gly:{ carbons:3, cN:[0,1,2], p2:p, phosphates:1, oh3:oh, dCentre:[1,0,2] } });
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
    GLYCOLYSIS.pep=g.spec({ name:'Phosphoenolpyruvate', short:'PEP', formula:'C₃H₄O₆P³⁻', class:'sugar',
      gly:{ carbons:3, cN:[0,1,c3], p2:p, phosphates:1, hot:p, enol:[1,c3] } });
  }
  {
    // — pyruvate: the finish line. Three carbons, no phosphate left, and a
    //   methyl at C3 as a united atom (same convention as alanine's –CH₃).
    const g=chainC(3);
    g.carbonyl(0,0); g.grow(0,'O',GL.CdO,'sp2',0);         // C1 carboxylate
    g.carbonyl(1,0);                                       // C2 ketone
    GLYCOLYSIS.pyruvate=g.spec({ name:'Pyruvate', short:'Pyruvate', formula:'C₃H₃O₃⁻', class:'sugar',
      gly:{ carbons:3, cN:[0,1,2], phosphates:0, terminal:true } });
  }
  {
    // — inorganic phosphate (Pi), the free phosphate already dissolved in the
    //   cytosol. Students routinely assume the second phosphate on 1,3-BPG cost
    //   an ATP; it did not, it came from here, so Pi is drawn as its own species.
    const s=new Skel(); s.put('P',V(0,0,0));
    [[1,1,1],[1,-1,-1],[-1,1,-1],[-1,-1,1]].forEach(d=>{
      s.link(0, s.put('O', vmul(vnorm(V(d[0],d[1],d[2])), GL.PO))); });
    s.grow(1,'H',GL.OH,'sp3',0);
    GLYCOLYSIS.pi=s.spec({ name:'Inorganic phosphate', short:'Pᵢ', formula:'HPO₄²⁻', class:'ion',
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
    //   `amp` has in mol-monomers.js, and no more: neither carries a `smiles`,
    //   so `tools/check-handedness.js` skips both. Give this one a `smiles` and
    //   a REF entry if it ever becomes a molecule the page teaches ABOUT
    //   rather than one it spends.
    GLYCOLYSIS.atp={ name:'Adenosine triphosphate', short:'ATP',
      formula:'C₁₀H₁₂N₅O₁₃P₃⁴⁻', class:'nucleotide',
      units:'angstrom',
      src:{path:'pubchem', cid:5461108, record:'3d',
           conformer:'0053547400000001', sdf:'atp.sdf',
           tool:'sdf2spec-generic', charge:-4, regen:'exact', fetched:'2026-08-12'},
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
  }
  register(GLYCOLYSIS);
})(this);
