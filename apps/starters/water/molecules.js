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
      K:  0x0054C0,   // potassium — blue (distinct from Na)
      C:  0x3a3a3a,   // carbon   — charcoal
      N:  0x3f6ae0,   // nitrogen — blue
      S:  0xe0b93a,   // sulfur   — goldenrod (cysteine / methionine)
      P:  0xe07b1f,   // phosphorus — orange (CPK). Deliberately the warmest atom
                      // in the palette: in glycolysis the phosphate IS the energy
                      // currency, so every P a student sees is "something ATP paid
                      // for or will be paid back". No other lesson uses P, so it
                      // can't be confused with sulfur's goldenrod.
    },
    bonds: {
      covalent:  0xb3a892,   // covalent stick — muted stone on cream
      hbond:     0x0042aa,   // hydrogen bond  — deep blue
      iondipole: 0xd9791e,   // ion–dipole bond — deep amber
      peptide:   0x6a5acd,   // peptide (amide C–N) bond — slate violet, so the
                             // newly-formed backbone link reads distinct from the
                             // ordinary covalent sticks within each residue
    },
    // default display radii (scene units, stylised — enlarged for legibility)
    radii: { O:0.95, H:0.55, C:0.85, N:0.90, S:1.05, Na:0.70, Cl:1.24, K:0.85, P:1.00 },
  };

  // ---- molecule library ----------------------------------------------
  // Each entry:
  //   name, formula
  //   class    — 'solvent' | 'ionic' | 'polar' | 'nonpolar'
  //   atoms    — [{el, pos:[x,y,z]}]  local positions (bond lengths are
  //              stylised ~1.5–1.9, matching water's exaggerated O–H)
  //   bonds    — [[i,j], …]  indices into atoms
  //   sites    — { donors:[{atom}], acceptors:[{atom, lonePairs}] }
  //              donor = a δ+ H that can point into water; acceptor = a
  //              lone-pair-bearing atom water's H can point at. Drives the
  //              H-bond engine for molecular (polar) solutes.
  //   dissociates — ionic only: [{ion, charge, radius}] produced on dissolving
  //   hydrophobic — indices of nonpolar atoms (tail), for the exclusion lesson
  //
  // Geometry notes: united-atom where a group is nonpolar filler (ethanol's
  // CH3/CH2 are single C spheres); explicit H's where they carry the lesson.
  const MOLECULES = {
    water: {
      name:'Water', formula:'H₂O', class:'solvent',
      atoms:[ {el:'O',pos:[0,0,0]}, {el:'H',pos:[1.226,-0.948,0]}, {el:'H',pos:[-1.226,-0.948,0]} ],
      bonds:[ [0,1],[0,2] ],
      sites:{ donors:[{atom:1},{atom:2}], acceptors:[{atom:0, lonePairs:2}] },
    },
    nacl: {
      name:'Salt', formula:'NaCl', class:'ionic',
      dissociates:[ {ion:'Na', charge:+1, radius:0.70}, {ion:'Cl', charge:-1, radius:1.24} ],
    },
    kcl: {
      name:'Potassium chloride', formula:'KCl', class:'ionic',
      dissociates:[ {ion:'K', charge:+1, radius:0.85}, {ion:'Cl', charge:-1, radius:1.24} ],
    },
    ethanol: {
      name:'Ethanol', formula:'C₂H₅OH', class:'polar',
      // CH3–CH2–OH, all-atom: methyl (3 H) + methylene (2 H) + hydroxyl (1 H) = 6 H.
      // Only the hydroxyl O–H is polar; the ethyl group is the nonpolar tail.
      // Bond lengths are the STYLISED ones (C–C 1.85, C–O 1.90, O–H 1.55, C–H 1.50),
      // not real Å. They have to exceed the sum of the two display radii or the
      // spheres merge and hide the bond stick — water's O–H 1.55 vs radii 1.50 sets
      // the convention. Angles are true tetrahedral (109.5°) / 105° at the hydroxyl.
      // Origin sits at the heavy-atom centroid so the molecule spins about its middle.
      atoms:[ {el:'C',pos:[-1.544,-0.183,0]},        // 0 methyl C
              {el:'C',pos:[0.056,0.717,0]},          // 1 methylene C
              {el:'O',pos:[1.487,-0.533,0]},         // 2 hydroxyl O
              {el:'H',pos:[2.775,0.329,0]},          // 3 hydroxyl H (donor)
              {el:'H',pos:[-1.634,-1.046,1.226]},    // 4 methyl H
              {el:'H',pos:[-2.674,0.803,0]},         // 5 methyl H
              {el:'H',pos:[-1.634,-1.046,-1.226]},   // 6 methyl H
              {el:'H',pos:[0.145,1.578,1.226]},      // 7 methylene H
              {el:'H',pos:[0.145,1.578,-1.226]} ],   // 8 methylene H
      bonds:[ [0,1],[1,2],[2,3],[0,4],[0,5],[0,6],[1,7],[1,8] ],
      sites:{ donors:[{atom:3}], acceptors:[{atom:2, lonePairs:2}] },
      hydrophobic:[0,1,4,5,6,7,8],
    },
    ammonia: {
      name:'Ammonia', formula:'NH₃', class:'polar',
      // trigonal pyramidal, lone pair up (+y); H's splay down at ~107°
      atoms:[ {el:'N',pos:[0,0,0]},
              {el:'H',pos:[1.391,-0.562,0]},
              {el:'H',pos:[-0.695,-0.562,1.204]},
              {el:'H',pos:[-0.695,-0.562,-1.204]} ],
      bonds:[ [0,1],[0,2],[0,3] ],
      sites:{ donors:[{atom:1},{atom:2},{atom:3}], acceptors:[{atom:0, lonePairs:1}] },
    },
    methane: {
      name:'Methane', formula:'CH₄', class:'nonpolar',
      // tetrahedral; no polar sites → excluded by water (hydrophobic)
      atoms:[ {el:'C',pos:[0,0,0]},
              {el:'H',pos:[0.866,0.866,0.866]}, {el:'H',pos:[0.866,-0.866,-0.866]},
              {el:'H',pos:[-0.866,0.866,-0.866]}, {el:'H',pos:[-0.866,-0.866,0.866]} ],
      bonds:[ [0,1],[0,2],[0,3],[0,4] ],
      sites:{ donors:[], acceptors:[] },
      hydrophobic:[0,1,2,3,4],
    },
    co2: {
      name:'Carbon dioxide', formula:'CO₂', class:'reactive',
      // Linear O=C=O; symmetric, so the two C=O dipoles cancel and the MOLECULE
      // has no net dipole. That does NOT make it methane: each O still carries
      // δ− and two lone pairs, so water can donate an O–H to it. CO₂ is ~30×
      // more soluble than O₂ and ~60× more than CH₄ for exactly this reason.
      //   → acceptors on both O's, and NO hydrophobic list. Listing the O's as
      //     hydrophobic (as an earlier version did) put the site springs and the
      //     nonpolar exclusion field on the same atoms, fighting every frame.
      // It cannot DONATE an H-bond, so it hydrates more weakly than ethanol/NH₃.
      atoms:[ {el:'C',pos:[0,0,0]}, {el:'O',pos:[1.9,0,0]}, {el:'O',pos:[-1.9,0,0]} ],
      bonds:[ [0,1,2],[0,2,2] ],
      sites:{ donors:[], acceptors:[{atom:1, lonePairs:2},{atom:2, lonePairs:2}] },
      // reaction chain driven by molecule-lab's updateReactions():
      //   CO₂ + H₂O → H₂CO₃ → HCO₃⁻ + H⁺(as H₃O⁺)
      reactsTo:'carbonic',
    },

    // ---- carbonation products -------------------------------------------
    // Not in the picker: these only ever appear as products of the CO₂ chain,
    // so each carries `product:true` and the engine tags them with the parent
    // key ('co2') for counting and clearing.
    carbonic: {
      name:'Carbonic acid', formula:'H₂CO₃', class:'polar', product:true,
      // Trigonal planar about C (120°): one C=O plus two C–O–H arms. Stylised
      // lengths again (C–O 1.9, O–H 1.55) — the ANGLES are the real ones.
      // The acidic H's are BENT off the C–O axis at ~107°, like water's O — a
      // hydroxyl O is never linear (check-molecules.js prints these angles).
      // Origin is the heavy-atom centroid, so it spins about its middle.
      atoms:[ {el:'C',pos:[0,0,0]},                 // 0 central C
              {el:'O',pos:[0,1.9,0]},               // 1 carbonyl O (=O)
              {el:'O',pos:[1.645,-0.95,0]},         // 2 hydroxyl O
              {el:'O',pos:[-1.645,-0.95,0]},        // 3 hydroxyl O
              {el:'H',pos:[2.779,0.107,0]},         // 4 acidic H on atom 2
              {el:'H',pos:[-2.779,0.107,0]} ],      // 5 acidic H on atom 3
      bonds:[ [0,1,2],[0,2],[0,3],[2,4],[3,5] ],
      sites:{ donors:[{atom:4},{atom:5}],
              acceptors:[{atom:1, lonePairs:2},{atom:2, lonePairs:2},{atom:3, lonePairs:2}] },
      ionizesTo:'bicarbonate',   // loses ONE H (pKa1 = 3.6 — it is a genuine acid)
    },
    bicarbonate: {
      name:'Bicarbonate', formula:'HCO₃⁻', class:'ion', product:true, charge:-1,
      // Carbonic acid minus one acidic H. The two bare O's share the negative
      // charge (delocalised) — drawn as plain O's here; the charge lives in the
      // label and the pH readout, not in the force model (no polyatomic-ion
      // electrostatics in this engine yet).
      atoms:[ {el:'C',pos:[0,0,0]},
              {el:'O',pos:[0,1.9,0]},
              {el:'O',pos:[1.645,-0.95,0]},
              {el:'O',pos:[-1.645,-0.95,0]},
              {el:'H',pos:[-2.779,0.107,0]} ],      // 4 the one remaining H (bent, ~107°)
      bonds:[ [0,1,2],[0,2],[0,3],[3,4] ],
      sites:{ donors:[{atom:4}],
              acceptors:[{atom:1, lonePairs:2},{atom:2, lonePairs:2},{atom:3, lonePairs:2}] },
    },
    hydronium: {
      name:'Hydronium', formula:'H₃O⁺', class:'ion', product:true, charge:+1,
      // Where the H⁺ actually goes: a bare proton doesn't exist in water. This
      // is a water molecule that ACCEPTED the acid's H — trigonal pyramidal
      // (~113°), one lone pair left on top. All three H's can donate.
      atoms:[ {el:'O',pos:[0,0,0]},
              {el:'H',pos:[1.437,-0.581,0]},
              {el:'H',pos:[-0.719,-0.581,1.244]},
              {el:'H',pos:[-0.719,-0.581,-1.244]} ],
      bonds:[ [0,1],[0,2],[0,3] ],
      sites:{ donors:[{atom:1},{atom:2},{atom:3}], acceptors:[] },
    },

    // ---- amino acids ----------------------------------------------------
    // Shared backbone, laid out left→right so a chain grows along +X:
    //   amino end (−X)  H₂N–Cα–COOH  carboxyl end (+X)
    //   0 N   1 H   2 H       (amino group; an H leaves in condensation)
    //   3 Cα  4 H              (α-carbon; 4 is the backbone H)
    //   5 C   6 O(=O)  7 O(–OH)  8 H   (carboxyl; the –OH, atoms 7+8, leaves)
    //   9…    side chain (R), bonded to Cα (atom 3), splayed −Y
    // `pep` names the atoms the peptide-bond reaction acts on (aminoacid-lab.js):
    //   cC carboxyl carbon · oOH/hOH the leaving hydroxyl · nN amino N · hN amino H's.
    // Only the ANGLES/topology carry the lesson; bond lengths are stylised as
    // elsewhere (must exceed the two display radii so the stick shows).
    // Zwitterion form is skipped on purpose — the neutral –NH₂/–COOH makes the
    // "lose a water" bookkeeping legible; note this is a display simplification.
    // ---- generated from PubChem 3D records (see tools/sdf2spec.js) --------
    // Coordinates are REAL conformers: correct angles (Ca is tetrahedral, ~110°,
    // not the 180° the old hand-written specs drew) and genuinely non-planar,
    // unlike the flat z=0 layouts elsewhere in this file. One global 1.9x scale
    // is applied so every stick clears the enlarged display radii — relative
    // bond lengths stay truthful, which the old per-pair guesses did not.
    // Bond ORDERS come straight from the SDF bond block, so the carboxyl C=O
    // is tagged [i,j,2] without anyone having to notice it by hand.
    // Re-generate rather than hand-editing these numbers.
    glycine: {
      name:'Glycine', formula:'C₂H₅NO₂', class:'aminoacid', res:'Gly', side:'–H',
      atoms:[ {el:'N',pos:[-2.225,0.942,-1.34]},
              {el:'H',pos:[-2.194,2.878,-1.394]},
              {el:'H',pos:[-2.195,0.34,-3.18]},
              {el:'C',pos:[0,0,0]},
              {el:'H',pos:[-0.006,0.705,1.954]},
              {el:'C',pos:[2.341,0.942,-1.34]},
              {el:'O',pos:[2.294,2.285,-3.239]},
              {el:'O',pos:[4.526,0.214,-0.179]},
              {el:'H',pos:[6.032,0.873,-1.056]},
              {el:'H',pos:[-0.002,-2.077,0]} ],
      bonds:[ [0,1],[0,2],[0,3],[3,4],[3,5],[3,9],[5,6,2],[5,7],[7,8] ],
      optH:[4,9],   // nonpolar C–H, hidden by the lab’s H toggle
      pep:{ cC:5, oOH:7, hOH:8, nN:0, hN:[1,2] },
    },
    alanine: {
      name:'Alanine', formula:'C₃H₇NO₂', class:'aminoacid', res:'Ala', side:'–CH₃',
      atoms:[ {el:'N',pos:[-2.227,0.979,1.339]},
              {el:'H',pos:[-3.836,0.37,0.449]},
              {el:'H',pos:[-2.301,0.234,3.127]},
              {el:'C',pos:[0,0,0]},
              {el:'H',pos:[-0.008,0.747,-1.942]},
              {el:'C',pos:[2.35,0.979,1.339]},
              {el:'O',pos:[2.398,2.292,3.255]},
              {el:'O',pos:[4.479,0.213,0.095]},
              {el:'H',pos:[6.029,0.833,0.924]},
              {el:'C',pos:[-0.054,-2.893,0]},
              {el:'H',pos:[1.547,-3.668,-1.082]},
              {el:'H',pos:[-1.802,-3.612,-0.87]},
              {el:'H',pos:[0.076,-3.662,1.931]} ],
      bonds:[ [0,1],[0,2],[0,3],[3,4],[3,5],[3,9],[5,6,2],[5,7],[7,8],[9,10],[9,11],[9,12] ],
      optH:[4,10,11,12],   // nonpolar C–H, hidden by the lab’s H toggle
      pep:{ cC:5, oOH:7, hOH:8, nN:0, hN:[1,2] },
    },
    serine: {
      name:'Serine', formula:'C₃H₇NO₃', class:'aminoacid', res:'Ser', side:'–CH₂OH',
      atoms:[ {el:'N',pos:[-2.216,0.977,1.36]},
              {el:'H',pos:[-2.211,0.344,3.191]},
              {el:'H',pos:[-2.143,2.91,1.44]},
              {el:'C',pos:[0,0,0]},
              {el:'H',pos:[-0.013,0.749,-1.943]},
              {el:'C',pos:[2.345,0.977,1.36]},
              {el:'O',pos:[2.545,1.381,3.639]},
              {el:'O',pos:[4.272,1.35,-0.317]},
              {el:'H',pos:[5.813,1.976,0.524]},
              {el:'C',pos:[-0.047,-2.899,0]},
              {el:'O',pos:[2.112,-3.833,-1.336]},
              {el:'H',pos:[-1.759,-3.637,-0.924]},
              {el:'H',pos:[0.036,-3.669,1.932]},
              {el:'H',pos:[2.018,-3.186,-3.064]} ],
      bonds:[ [0,1],[0,2],[0,3],[3,4],[3,5],[3,9],[5,6,2],[5,7],[7,8],[9,10],[9,11],[9,12],[10,13] ],
      optH:[4,11,12],   // nonpolar C–H, hidden by the lab’s H toggle
      pep:{ cC:5, oOH:7, hOH:8, nN:0, hN:[1,2] },
    },
    cysteine: {
      name:'Cysteine', formula:'C₃H₇NO₂S', class:'aminoacid', res:'Cys', side:'–CH₂SH',
      atoms:[ {el:'N',pos:[-2.223,1.021,1.326]},
              {el:'H',pos:[-2.255,2.949,1.148]},
              {el:'H',pos:[-3.839,0.374,0.477]},
              {el:'C',pos:[0,0,0]},
              {el:'H',pos:[-0.03,0.703,-1.962]},
              {el:'C',pos:[2.347,1.021,1.326]},
              {el:'O',pos:[2.892,0.517,3.533]},
              {el:'O',pos:[3.833,2.497,-0.178]},
              {el:'H',pos:[5.349,3.102,0.722]},
              {el:'C',pos:[-0.089,-2.905,0]},
              {el:'S',pos:[2.665,-4.284,-1.578]},
              {el:'H',pos:[-1.794,-3.58,-0.985]},
              {el:'H',pos:[-0.139,-3.656,1.941]},
              {el:'H',pos:[4.4,-3.554,0.138]} ],
      bonds:[ [0,1],[0,2],[0,3],[3,4],[3,5],[3,9],[5,6,2],[5,7],[7,8],[9,10],[9,11],[9,12],[10,13] ],
      optH:[4,11,12],   // nonpolar C–H, hidden by the lab’s H toggle
      pep:{ cC:5, oOH:7, hOH:8, nN:0, hN:[1,2] },
    },
  };

  /* =====================================================================
   *  GLYCOLYSIS INTERMEDIATES  (glycolysis-lab.html)  — see SCIENCE.md §12
   * =====================================================================
   *  These specs are COMPUTED, not typed out. Every earlier molecule here is
   *  small enough to hand-place, but a phosphorylated six-carbon sugar has
   *  ~30 atoms and four tetrahedral centres per phosphate — hand coordinates
   *  would be eyeballed, and SCIENCE.md's rule is that accuracy lives in the
   *  coordinates. So geometry is generated from bond lengths + real VSEPR
   *  angles by the tiny `Skel` builder below, and check-molecules.js audits
   *  the result (no sphere overlaps, printed angles).
   *
   *  MODEL SIMPLIFICATIONS — all deliberate, all listed in SCIENCE.md §12:
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

  // Stylised bond lengths, same scale convention as everything above: each MUST
  // exceed the sum of the two display radii or the spheres swallow the stick.
  //   C+C 1.70 · C+O 1.80 · O+H 1.50 · O+P 1.95 · C+H 1.40
  const GL = { CC:1.95, CO:1.95, OH:1.60, OP:2.10, PO:2.10, CH:1.60 };
  const TET = 109.5, SP2 = 120;

  const V  = (x,y,z)=>({x,y,z});
  const vadd=(a,b)=>V(a.x+b.x,a.y+b.y,a.z+b.z);
  const vsub=(a,b)=>V(a.x-b.x,a.y-b.y,a.z-b.z);
  const vmul=(a,s)=>V(a.x*s,a.y*s,a.z*s);
  const vlen=a=>Math.hypot(a.x,a.y,a.z);
  const vnorm=a=>{const l=vlen(a)||1;return vmul(a,1/l);};
  const vcross=(a,b)=>V(a.y*b.z-a.z*b.y, a.z*b.x-a.x*b.z, a.x*b.y-a.y*b.x);
  const rad=d=>d*Math.PI/180;

  // ---- Skel: an atoms+bonds accumulator that knows VSEPR ----------------
  // The point of it: you never state a substituent's position, you state which
  // atom it hangs off and how it's hybridised. Directions come out of the
  // geometry already committed, so angles are correct by construction and
  // successive calls on the same atom automatically take the next free slot.
  function Skel(){ this.atoms=[]; this.bonds=[]; }
  Skel.prototype.put=function(el,p){ this.atoms.push({el,pos:[p.x,p.y,p.z]}); return this.atoms.length-1; };
  Skel.prototype.at =function(i){ const p=this.atoms[i].pos; return V(p[0],p[1],p[2]); };
  Skel.prototype.link=function(i,j,order){ this.bonds.push(order?[i,j,order]:[i,j]); return this; };
  Skel.prototype.nbrs=function(i){ const A=this.at(i);
    return this.bonds.filter(b=>b[0]===i||b[1]===i)
      .map(b=>vnorm(vsub(this.at(b[0]===i?b[1]:b[0]),A))); };

  // any unit vector perpendicular to `a` (picks a seed axis that isn't parallel)
  function perpTo(a){
    let t=vcross(a,V(0,0,1));
    if(vlen(t)<0.25) t=vcross(a,V(1,0,0));
    return vnorm(t);
  }
  Skel.prototype.centroid=function(){
    return vmul(this.atoms.reduce((s,a)=>vadd(s,V(a.pos[0],a.pos[1],a.pos[2])),V(0,0,0)),
      1/(this.atoms.length||1));
  };
  // When an atom has only ONE bond so far, the correct bond ANGLE still leaves a
  // free rotation about that bond — and picking that azimuth arbitrarily is how a
  // phosphate ends up folded back through the carbon chain it hangs off (the first
  // version of this file did exactly that; check-molecules.js caught it as a
  // 1.5-unit C..O overlap). So: seed the cone so slot 0 points as far as possible
  // AWAY from the centroid of everything already placed. Backbones are always
  // built before their substituents, so "away from the centroid" means "out into
  // open space", and groups splay outward instead of collapsing inward.
  Skel.prototype.outwardAt=function(i,a){
    const away=vsub(this.at(i), this.centroid());
    const t=vsub(away, vmul(a, away.x*a.x+away.y*a.y+away.z*a.z));   // ⊥ component
    return vlen(t)<0.05 ? perpTo(a) : vnorm(t);
  };
  // remaining sp3 bond directions at atom i, each `TET` from every existing bond
  Skel.prototype.freeTet=function(i){
    const nb=this.nbrs(i);
    if(nb.length===0) return [V(0,1,0),V(0,-1,0)];
    if(nb.length===1){
      const a=nb[0], t=this.outwardAt(i,a), u=vnorm(vcross(a,t));
      const c=Math.cos(rad(TET)), s=Math.sin(rad(TET));
      return [0,1,2].map(k=>{ const ph=k*2*Math.PI/3;
        return vnorm(vadd(vmul(a,c), vadd(vmul(t,s*Math.cos(ph)), vmul(u,s*Math.sin(ph))))); });
    }
    if(nb.length===2){
      // the two open slots straddle the plane of the existing pair, opening away
      // from it — the classic axial/equatorial pair on a ring carbon
      const bis=vnorm(vmul(vadd(nb[0],nb[1]),-1)), p=vnorm(vcross(nb[0],nb[1]));
      const h=rad(TET/2), c=Math.cos(h), s=Math.sin(h);
      return [ vnorm(vadd(vmul(bis,c), vmul(p, s))), vnorm(vadd(vmul(bis,c), vmul(p,-s))) ];
    }
    return [ vnorm(vmul(nb.reduce(vadd,V(0,0,0)),-1)) ];   // 3 bonds → one slot left
  };
  // remaining sp2 (trigonal planar, 120°) directions — carbonyl + carboxylate carbons
  Skel.prototype.freeSp2=function(i){
    const nb=this.nbrs(i);
    if(nb.length===1){
      const a=nb[0], t=this.outwardAt(i,a);      // same outward rule as freeTet
      const c=Math.cos(rad(SP2)), s=Math.sin(rad(SP2));
      return [ vnorm(vadd(vmul(a,c), vmul(t,s))), vnorm(vadd(vmul(a,c), vmul(t,-s))) ];
    }
    return [ vnorm(vmul(nb.reduce(vadd,V(0,0,0)),-1)) ];
  };
  // hang one atom off atom i in its next free slot; `hyb` picks the geometry
  Skel.prototype.grow=function(i,el,dist,hyb,slot,order){
    const dirs=(hyb==='sp2'?this.freeSp2(i):this.freeTet(i));
    const j=this.put(el, vadd(this.at(i), vmul(dirs[slot||0], dist)));
    this.link(i,j,order); return j;
  };

  // ---- functional groups ------------------------------------------------
  Skel.prototype.hydroxyl=function(i,slot){                 // –OH
    const o=this.grow(i,'O',GL.CO,'sp3',slot);
    this.grow(o,'H',GL.OH,'sp3',0);                         // C–O–H ≈ 109.5°
    return o;
  };
  Skel.prototype.carbonyl=function(i,slot){                 // C=O (double bond)
    return this.grow(i,'O',GL.CO,'sp2',slot,2);
  };
  // –O–PO₃²⁻ : a bridging ester O, then a tetrahedral P with three more O's.
  // Returns the P index — the page uses it as the effect anchor, because the P
  // is what visibly arrives from ATP and later leaves for ADP.
  Skel.prototype.phosphate=function(i,slot){
    const o=this.grow(i,'O',GL.CO,'sp3',slot);
    const p=this.grow(o,'P',GL.OP,'sp3',0);
    for(let k=0;k<3;k++) this.grow(p,'O',GL.PO,'sp3',0);
    return p;
  };
  Skel.prototype.rotate=function(rx,ry,rz){
    const cx=Math.cos(rx), sx=Math.sin(rx);
    const cy=Math.cos(ry), sy=Math.sin(ry);
    const cz=Math.cos(rz), sz=Math.sin(rz);
    this.atoms.forEach(a=>{
      let [x,y,z]=a.pos;
      let y1=y*cx-z*sx, z1=y*sx+z*cx;
      let x2=x*cy+z1*sy, z2=-x*sy+z1*cy;
      let x3=x2*cz-y1*sz, y3=x2*sz+y1*cz;
      a.pos=[x3,y3,z2];
    });
    return this;
  };

  Skel.prototype.spec=function(extra){
    return Object.assign({ atoms:this.atoms, bonds:this.bonds }, extra);
  };

  // ---- backbone scaffolds ----------------------------------------------
  // Open carbon chain in the textbook orientation: C1 at the TOP, growing down
  // −Y in a zig-zag through the real ~111° chain angle, all carbons in the z=0
  // plane so substituents splay toward the viewer in ±z and the backbone stays
  // readable head-on. Carbons land at indices 0…n−1 = C1…Cn.
  function chainC(n){
    const s=new Skel(), half=rad(111/2);
    const dy=GL.CC*Math.sin(half), dx=GL.CC*Math.cos(half);
    for(let k=0;k<n;k++){
      s.put('C', V((k%2?dx:0)-dx/2, (n-1)*dy/2 - k*dy, 0));
      if(k) s.link(k-1,k);
    }
    return s;
  }
  // β-D-glucopyranose ring: six-membered, O5 at index 0 then C1…C5 at 1…5, laid
  // in the xz-plane with an alternating ±y pucker (the chair — a flat hexagon is
  // as wrong for a pyranose as a linear water is for H₂O). C6 is exocyclic on C5.
  function ringPyranose(){
    const s=new Skel(), R=GL.CC;             // regular hexagon: side = circumradius
    for(let k=0;k<6;k++){ const th=k*Math.PI/3;
      s.put(k===0?'O':'C', V(R*Math.cos(th), (k%2?0.34:-0.34), R*Math.sin(th))); }
    for(let k=0;k<6;k++) s.link(k,(k+1)%6);
    return s;
  }

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
    g.hydroxyl(1,0); g.hydroxyl(2,0); g.hydroxyl(3,0); g.hydroxyl(4,0);
    const c6=g.grow(5,'C',GL.CC,'sp3',0); // C6, exocyclic
    g.hydroxyl(c6,0);
    // Rotate to a clear 3D 3/4 chair perspective (ring face tilted towards camera)
    g.rotate(1.05, 0.45, -0.2);
    GLYCOLYSIS.glucose=g.spec({ name:'Glucose', formula:'C₆H₁₂O₆', class:'sugar',
      gly:{ carbons:6, ring:true, cN:[...C,c6], phosphates:0,
            note:'β-D-glucopyranose — the ring form that dominates in water' } });
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
    g.carbonyl(0,0); g.grow(0,'O',GL.CO,'sp2',0);          // carboxylate: two O's
    g.hydroxyl(1,1);
    const p=g.phosphate(2,0);
    GLYCOLYSIS.pga3=g.spec({ name:'3-phosphoglycerate', formula:'C₃H₆O₇P²⁻', class:'sugar',
      gly:{ carbons:3, cN:[0,1,2], p3:p, phosphates:1, hot:p } });
  }
  {
    // — pyruvate: the finish line. Three carbons, no phosphate left, and a
    //   methyl at C3 as a united atom (same convention as alanine's –CH₃).
    const g=chainC(3);
    g.carbonyl(0,0); g.grow(0,'O',GL.CO,'sp2',0);          // C1 carboxylate
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

  global.MolLib = { PALETTE, MOLECULES };
})(this);
