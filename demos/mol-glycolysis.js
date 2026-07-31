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
  const { MOLECULES, VIEW } = Lib;
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
   *   3. After the first phosphorylation the sugar is drawn as an OPEN CHAIN,
   *      the way every textbook draws glycolysis (Fischer projection), not as
   *      the furanose ring F1,6-bisphosphate actually is in solution. Glucose
   *      itself IS drawn as its real pyranose ring, and the ring visibly opens
   *      during priming — glucose genuinely ring-opens and closes in water.
   *      The open chain is what makes "six carbons in a row snap into 3 + 3"
   *      legible, which is the whole reason this page exists.
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
    GLYCOLYSIS.glucose=g.spec({ name:'Glucose', formula:'C₆H₁₂O₆', class:'sugar',
      names:['O5','C1','C2','C3','C4','C5','O1','HO1','O2','HO2','O3','HO3','O4','HO4','C6','O6','HO6','H1','H2','H3','H4','H5','H61','H62'],
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
    // — glucose-6-phosphate: ring has opened to the aldose chain; P on C6.
    //   Hexokinase's product, and the step that traps glucose inside the cell
    //   (the phosphate's charge means it can't slip back out through GLUT).
    const g=chainC(6);
    g.carbonyl(0,0); g.grow(0,'H',GL.CH,'sp2',0);          // C1 aldehyde, incl. its H
    for(let k=1;k<=4;k++) g.hydroxyl(k, k%2);              // C2…C5 –OH, alternating face
    const p=g.phosphate(5,0);                              // C6 –O–PO₃
    GLYCOLYSIS.g6p=g.spec({ name:'Glucose-6-phosphate', formula:'C₆H₁₃O₉P²⁻', class:'sugar',
      gly:{ carbons:6, cN:[0,1,2,3,4,5], p3:p, phosphates:1 } });
  }
  {
    // — fructose-1,6-bisphosphate: both ENDS phosphorylated, and the carbonyl has
    //   moved C1 → C2 (aldose → ketose). That shift is the isomerase step, shown
    //   as a visible change rather than given its own stage.
    const g=chainC(6);
    const p1=g.phosphate(0,0);                             // C1 –O–PO₃
    g.carbonyl(1,0);                                       // C2 ketone
    for(let k=2;k<=4;k++) g.hydroxyl(k, k%2);              // C3…C5 –OH
    const p6=g.phosphate(5,0);                             // C6 –O–PO₃
    GLYCOLYSIS.f16bp=g.spec({ name:'Fructose-1,6-bisphosphate', formula:'C₆H₁₄O₁₂P₂⁴⁻', class:'sugar',
      gly:{ carbons:6, cN:[0,1,2,3,4,5], p1, p3:p6, phosphates:2,
            cleave:[2,3],           // aldolase cuts C3–C4 → DHAP (C1-3) + G3P (C4-6)
            note:'drawn open-chain (Fischer) though it is really a furanose ring' } });
  }
  {
    // — DHAP: the C1–C3 half of the cut. A ketose, so it is NOT yet a substrate
    //   for the payoff phase; triose-phosphate isomerase converts it to G3P.
    const g=chainC(3);
    const p=g.phosphate(0,0);
    g.carbonyl(1,0);
    g.hydroxyl(2,1);
    GLYCOLYSIS.dhap=g.spec({ name:'Dihydroxyacetone phosphate', formula:'C₃H₇O₆P²⁻', class:'sugar',
      gly:{ carbons:3, cN:[0,1,2], p1:p, phosphates:1 } });
  }
  {
    // — G3P: the C4–C6 half, renumbered C1–C3. The aldehyde H on C1 is drawn
    //   because THAT is the hydrogen NAD⁺ takes in the next stage.
    const g=chainC(3);
    g.carbonyl(0,0); const h=g.grow(0,'H',GL.CH,'sp2',0);
    g.hydroxyl(1,1);
    const p=g.phosphate(2,0);
    GLYCOLYSIS.g3p=g.spec({ name:'Glyceraldehyde-3-phosphate', formula:'C₃H₇O₆P²⁻', class:'sugar',
      gly:{ carbons:3, cN:[0,1,2], p3:p, phosphates:1, aldehydeH:h } });
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
    GLYCOLYSIS.bpg13=g.spec({ name:'1,3-bisphosphoglycerate', formula:'C₃H₈O₁₀P₂⁴⁻', class:'sugar',
      gly:{ carbons:3, cN:[0,1,2], p1, p3, phosphates:2, hot:p1 } });
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
    GLYCOLYSIS.pga3=g.spec({ name:'3-phosphoglycerate', formula:'C₃H₆O₇P²⁻', class:'sugar',
      gly:{ carbons:3, cN:[0,1,2], p3:p, phosphates:1, hot:p } });
  }
  {
    // — pyruvate: the finish line. Three carbons, no phosphate left, and a
    //   methyl at C3 as a united atom (same convention as alanine's –CH₃).
    const g=chainC(3);
    g.carbonyl(0,0); g.grow(0,'O',GL.CdO,'sp2',0);         // C1 carboxylate
    g.carbonyl(1,0);                                       // C2 ketone
    GLYCOLYSIS.pyruvate=g.spec({ name:'Pyruvate', formula:'C₃H₃O₃⁻', class:'sugar',
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
    GLYCOLYSIS.pi=s.spec({ name:'Inorganic phosphate', formula:'HPO₄²⁻', class:'ion',
      gly:{ carbons:0, phosphates:1, free:true } });
  }
  Object.assign(MOLECULES, GLYCOLYSIS);
})(this);
