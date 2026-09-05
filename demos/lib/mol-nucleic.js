/* =====================================================================
 *  mol-nucleic.js — the four DNA bases, and the faces they pair on
 * =====================================================================
 *  Tier 3 (MolecularGeometry.md §1.4): on the DNA page the structure IS the
 *  lesson, so these are real records — PubChem 3D conformers fetched BY CID
 *  (adenine 190, thymine 1135, guanine 135398634, cytosine 597), converted by
 *  tools/sdf2spec-generic.js, inputs committed in tools/sdf/. Re-generate
 *  rather than hand-editing the numbers.
 *
 *  ---------------------------------------------------------------------
 *  THE TAUTOMER CORRECTION — read this before trusting any N–H below
 *  ---------------------------------------------------------------------
 *  PubChem's 3D conformers are of the FREE BASE, and for three of the four
 *  they put the hydrogen somewhere DNA does not:
 *
 *    adenine   CID 190        H on N7   — the 7H tautomer; DNA is 9H
 *    guanine   CID 135398634  H on N7   — likewise
 *    cytosine  CID 597        H on N3   — DNA's cytosine is protonated at N1
 *    thymine   CID 1135       H on N1 and N3 — correct as fetched
 *
 *  Two of those are cosmetic-looking and one is not:
 *
 *  · The purine N7→N9 move matters because N9 is where the sugar attaches.
 *    A page that later swaps that hydrogen for deoxyribose would, uncorrected,
 *    be attaching the backbone to the wrong nitrogen — on the major-groove
 *    edge instead of the glycosidic one.
 *
 *  · CYTOSINE'S IS NOT COSMETIC AT ALL. Its N3 is the ACCEPTOR that takes
 *    guanine's N1–H. Leave the fetched hydrogen sitting on N3 and cytosine is
 *    drawn as a donor exactly where it must accept — G–C comes out with the
 *    middle hydrogen bond reversed, and the pairing rule the whole lesson
 *    rests on is wrong in a way that renders perfectly.
 *
 *  So the correction is applied HERE, IN CODE, rather than by retyping
 *  coordinates: `moveH` re-bonds the hydrogen and recomputes its position on
 *  the outward bisector of the target nitrogen's two ring neighbours. The
 *  fetched record stays exactly as fetched, the edit stays visible, and
 *  `tautomer:` declares the result so check-molecules.js fails if it drifts.
 *
 *  ---------------------------------------------------------------------
 *  WHAT `wc:` CLAIMS
 *  ---------------------------------------------------------------------
 *  Each base names its Watson–Crick edge: which atoms donate, which accept,
 *  and which partner atom each one meets. That is the pairing RULE stated as
 *  chemistry — A has one donor and one acceptor, G has two donors and one
 *  acceptor, and no amount of pushing an A against a C makes those lists
 *  complementary. dna-lab reads the latch from here rather than from a table
 *  of allowed letters, so "A pairs with T" is a consequence on that page and
 *  not a premise.
 *
 *  Note what is NOT here: no glycosidic bond, no sugar, no C1′. These are the
 *  bases alone, which is all step 1 of the lesson shows.
 * ===================================================================== */
(function(global){
  'use strict';
  const SELFNAME = 'mol-nucleic.js';
  const Lib = global.MolLib
    || (typeof require === 'function' ? require('./molecules.js').MolLib : null);
  if (!Lib) throw new Error(SELFNAME + ': molecules.js must be loaded first');
  const { MOLECULES, VIEW, register } = Lib;

  /* Move a ring N–H to another ring nitrogen: re-bond it, then put it on the
   * outward bisector of the target's two ring neighbours at 1.01 Å, in the
   * ring plane. Positions are ångströms here — register() applies SCALE after
   * this runs, so everything below is in the record's own units.
   *
   * A TAUTOMER IS NOT JUST A PROTON. The double bond moves with it, and an
   * earlier version of this file forgot that — which is not a cosmetic slip,
   * because bond ORDER is what the lone-pair count is computed from. Leave
   * cytosine's Kekulé structure in the N3–H form after moving the hydrogen to
   * N1 and N3 ends up with two single bonds: (5 − 2)/2 = 1.5 lone pairs, an
   * impossible number, so lobes/lobes.js refuses it, kit/hbond.js gives it capacity 0,
   * and G–C silently comes out with two hydrogen bonds instead of three. The
   * geometry was perfect the whole time. `swap` is therefore not optional
   * bookkeeping — it is the other half of the same edit. */
  const N_H = 1.01;
  function order(spec, i, j, n){
    const b = spec.bonds.find(x =>
      (x[0]===i && x[1]===j) || (x[0]===j && x[1]===i));
    if(!b) throw new Error(SELFNAME+`: no bond ${i}-${j} to re-order`);
    if(n===1) b.length = 2; else b[2] = n;
    return spec;
  }
  function moveH(spec, h, from, to, swap){
    const b = spec.bonds.find(x =>
      (x[0]===from && x[1]===h) || (x[0]===h && x[1]===from));
    if(!b) throw new Error(SELFNAME+': no bond to move from atom '+from);
    b[0] = Math.min(to,h); b[1] = Math.max(to,h);

    const P = i => spec.atoms[i].pos;
    const ring = [];
    for(const x of spec.bonds){
      const o = x[0]===to ? x[1] : x[1]===to ? x[0] : null;
      if(o!=null && o!==h && spec.atoms[o].el!=='H') ring.push(o);
    }
    if(ring.length!==2) throw new Error(SELFNAME+': atom '+to+' is not a ring N');
    const n = P(to), out = [0,0,0];
    for(const r of ring){
      const d=[P(r)[0]-n[0], P(r)[1]-n[1], P(r)[2]-n[2]];
      const L=Math.hypot(...d); for(let k=0;k<3;k++) out[k] -= d[k]/L;
    }
    const L=Math.hypot(...out);
    spec.atoms[h].pos = [n[0]+out[0]/L*N_H, n[1]+out[1]/L*N_H, n[2]+out[2]/L*N_H];

    // …and the double bonds that move with the proton.
    for(const s of (swap || [])) order(spec, s[0], s[1], s[2]);
    return spec;
  }

  /* `regen:'manual'` is the honest verdict for all four: the committed .sdf IS
   * the source, and a hand step — moveH, above — sits in the middle. Three of
   * them genuinely need it and thymine is left on 'manual' too, because the
   * spec it produces is only reached by running the same documented path. */
  const PUBCHEM = o => ({ path:'pubchem', cid:o.cid, query:o.name,
    record:'3d', conformer:o.conformer, sdf:o.name+'.sdf',
    tool:'sdf2spec-generic', regen:o.regen || 'manual', fetched:'2026-08-16' });

  /* ---- adenine -------------------------------------------------------- */
  // 0 N7  1 N9  2 N3  3 N1  4 N6  5 C5  6 C4  7 C6  8 C8  9 C2
  // 10 H(N7→N9)  11 H8  12 H2  13,14 H61,H62
  const adenine = {
    name:'Adenine', formula:'C₅H₅N₅', charge:0, class:'base',
    units:'angstrom',
    atoms:[{el:'N',pos:[-0.808,-1.657,0]},{el:'N',pos:[-2.172,0.106,0]},{el:'N',pos:[-0.436,1.808,0]},{el:'N',pos:[1.831,0.905,0]},{el:'N',pos:[2.263,-1.453,0]},{el:'C',pos:[0.005,-0.559,0]},{el:'C',pos:[-0.865,0.523,0]},{el:'C',pos:[1.372,-0.366,0]},{el:'C',pos:[-2.102,-1.208,0]},{el:'C',pos:[0.911,1.9,0]},{el:'H',pos:[-0.512,-2.624,0]},{el:'H',pos:[-2.942,-1.888,0]},{el:'H',pos:[1.313,2.908,0]},{el:'H',pos:[3.258,-1.273,0]},{el:'H',pos:[1.917,-2.403,0]}],
    bonds:[[0,5],[0,8],[0,10],[1,6],[1,8,2],[2,6,2],[2,9],[3,7],[3,9,2],[4,7],[4,13],[4,14],[5,6],[5,7,2],[8,11],[9,12]],
    names:['N7','N9','N3','N1','N6','C5','C4','C6','C8','C2','H9','H8','H2','H61','H62'],
    topology:{ rings:[5,6], fused:true },
    tautomer:{ nh:['N9'] },                       // corrected from the fetched 7H
    // The Watson–Crick edge. N1 accepts; the N6 amino donates. It has exactly
    // ONE of each, which is why it meets thymine and cannot meet cytosine.
    sites:{ donors:[{atom:13},{atom:14}], acceptors:[{atom:3, lonePairs:1}] },
    wc:{ partner:'thymine', bonds:[
      { self:3,  role:'acceptor', partner:'N3', partnerAtom:2 },   // N1 ··· H–N3
      { self:4,  role:'donor',    partner:'O4', partnerAtom:0 } ]},// N6–H ··· O4
    // The glycosidic site: N9 is where the sugar attaches, and the hydrogen on
    // it is what leaves as half of the water. Declared here, on the base,
    // because it is a fact about the base and not about the page that draws it
    // — the same shape mol-monomers.js's amino acids use for the peptide bond.
    condense:{ roles:[ { key:'glyco', label:'N9\u2013H', keep:1, leaves:[10] } ] },
    view:VIEW.flatRing,
    src:PUBCHEM({ name:'adenine', cid:190, conformer:'000000BE00000001' })
  };
  // 7H → 9H: the proton goes N7→N9 and the C8 double bond swings the other
  // way, N9=C8 becoming N7=C8.
  moveH(adenine, 10, 0, 1, [[1,8,1],[0,8,2]]);

  /* ---- thymine -------------------------------------------------------- */
  // 0 O4  1 O2  2 N3  3 N1  4 C5  5 C4  6 C6  7 C7(methyl)  8 C2
  const thymine = {
    name:'Thymine', formula:'C₅H₆N₂O₂', charge:0, class:'base',
    units:'angstrom',
    atoms:[{el:'O',pos:[2.361,-0.015,-0.002]},{el:'O',pos:[-1.619,-2.351,-0.001]},{el:'N',pos:[0.378,-1.195,0.001]},{el:'N',pos:[-1.66,-0.05,0]},{el:'C',pos:[0.339,1.236,0]},{el:'C',pos:[1.132,-0.028,0]},{el:'C',pos:[-0.996,1.146,0]},{el:'C',pos:[1.082,2.533,0]},{el:'C',pos:[-1.016,-1.277,0]},{el:'H',pos:[-1.635,2.021,0.001]},{el:'H',pos:[0.889,-2.073,0]},{el:'H',pos:[-2.676,-0.028,0]},{el:'H',pos:[1.716,2.611,-0.889]},{el:'H',pos:[1.717,2.611,0.889]},{el:'H',pos:[0.402,3.392,0.001]}],
    bonds:[[0,5,2],[1,8,2],[2,5],[2,8],[2,10],[3,6],[3,8],[3,11],[4,5],[4,6,2],[4,7],[6,9],[7,12],[7,13],[7,14]],
    names:['O4','O2','N3','N1','C5','C4','C6','C7','C2','H6','H3','H1','H71','H72','H73'],
    topology:{ rings:[6] },
    tautomer:{ nh:['N3','N1'] },                   // as fetched — already right
    // O2 is deliberately NOT in the pairing list: it points into the minor
    // groove, away from adenine, and a student who counts "two oxygens, two
    // bonds" has found the trap this field exists to close.
    sites:{ donors:[{atom:10}], acceptors:[{atom:0, lonePairs:2},{atom:1, lonePairs:2}] },
    wc:{ partner:'adenine', bonds:[
      { self:2,  role:'donor',    partner:'N1', partnerAtom:3 },
      { self:0,  role:'acceptor', partner:'N6', partnerAtom:4 } ]},
    // The glycosidic site: N1 is where the sugar attaches, and the hydrogen on
    // it is what leaves as half of the water. Declared here, on the base,
    // because it is a fact about the base and not about the page that draws it
    // — the same shape mol-monomers.js's amino acids use for the peptide bond.
    condense:{ roles:[ { key:'glyco', label:'N1\u2013H', keep:3, leaves:[11] } ] },
    view:VIEW.flatRing,
    src:PUBCHEM({ name:'thymine', cid:1135, conformer:'0000046F00000001',
                 regen:'exact' })
  };

  /* ---- guanine -------------------------------------------------------- */
  // 0 O6  1 N7  2 N1  3 N3  4 N9  5 N2  6 C5  7 C4  8 C6  9 C2  10 C8
  const guanine = {
    name:'Guanine', formula:'C₅H₅N₅O', charge:0, class:'base',
    units:'angstrom',
    atoms:[{el:'O',pos:[2.068,-1.693,0.001]},{el:'N',pos:[-0.946,-1.957,0]},{el:'N',pos:[1.665,0.591,0]},{el:'N',pos:[-0.536,1.549,-0.001]},{el:'N',pos:[-2.303,-0.188,0.001]},{el:'N',pos:[1.367,2.913,-0.002]},{el:'C',pos:[-0.139,-0.857,0.001]},{el:'C',pos:[-0.995,0.219,0]},{el:'C',pos:[1.285,-0.75,0.001]},{el:'C',pos:[0.772,1.677,-0.001]},{el:'C',pos:[-2.239,-1.503,0]},{el:'H',pos:[-0.65,-2.925,0]},{el:'H',pos:[2.66,0.798,-0.001]},{el:'H',pos:[-3.081,-2.18,0]},{el:'H',pos:[0.812,3.762,-0.003]},{el:'H',pos:[2.376,3.015,-0.002]}],
    bonds:[[0,8,2],[1,6],[1,10],[1,11],[2,8],[2,9],[2,12],[3,7],[3,9,2],[4,7],[4,10,2],[5,9],[5,14],[5,15],[6,7,2],[6,8],[10,13]],
    names:['O6','N7','N1','N3','N9','N2','C5','C4','C6','C2','C8','H9','H1','H8','H21','H22'],
    topology:{ rings:[5,6], fused:true },
    tautomer:{ nh:['N9','N1'] },                   // N7→N9 corrected; N1–H kept
    // THREE sites, alternating acceptor–donor–donor. That is the whole reason
    // G–C is the stronger pair, and it is a count, not a rule.
    sites:{ donors:[{atom:12},{atom:14},{atom:15}],
            acceptors:[{atom:0, lonePairs:2}] },
    wc:{ partner:'cytosine', bonds:[
      { self:0,  role:'acceptor', partner:'N4', partnerAtom:2 },   // O6 ··· H–N4
      { self:2,  role:'donor',    partner:'N3', partnerAtom:1 },   // N1–H ··· N3
      { self:5,  role:'donor',    partner:'O2', partnerAtom:0 } ]},// N2–H ··· O2
    // The glycosidic site: N9 is where the sugar attaches, and the hydrogen on
    // it is what leaves as half of the water. Declared here, on the base,
    // because it is a fact about the base and not about the page that draws it
    // — the same shape mol-monomers.js's amino acids use for the peptide bond.
    condense:{ roles:[ { key:'glyco', label:'N9\u2013H', keep:4, leaves:[11] } ] },
    view:VIEW.flatRing,
    src:PUBCHEM({ name:'guanine', cid:135398634, conformer:'081204EA00000001' })
  };
  // Same swing as adenine: N9=C8 → N7=C8.
  moveH(guanine, 11, 1, 4, [[4,10,1],[1,10,2]]);

  /* ---- cytosine ------------------------------------------------------- */
  // 0 O2  1 N3  2 N4  3 N1  4 C4  5 C5  6 C2  7 C6
  const cytosine = {
    name:'Cytosine', formula:'C₄H₅N₃O', charge:0, class:'base',
    units:'angstrom',
    atoms:[{el:'O',pos:[-1.519,-1.96,0]},{el:'N',pos:[0.475,-0.861,0]},{el:'N',pos:[2.601,0.216,0]},{el:'N',pos:[-1.587,0.325,0]},{el:'C',pos:[1.235,0.291,0]},{el:'C',pos:[0.591,1.469,0]},{el:'C',pos:[-0.918,-0.885,0]},{el:'C',pos:[-0.88,1.406,0]},{el:'H',pos:[0.976,-1.744,0]},{el:'H',pos:[1.083,2.432,0]},{el:'H',pos:[-1.392,2.382,0]},{el:'H',pos:[3.16,1.06,0]},{el:'H',pos:[3.046,-0.693,0.001]}],
    bonds:[[0,6,2],[1,4],[1,6],[1,8],[2,4],[2,11],[2,12],[3,6],[3,7,2],[4,5,2],[5,7],[5,9],[7,10]],
    names:['O2','N3','N4','N1','C4','C5','C2','C6','H1','H5','H6','H41','H42'],
    topology:{ rings:[6] },
    tautomer:{ nh:['N1'] },                        // corrected off N3 — see header
    sites:{ donors:[{atom:11},{atom:12}],
            acceptors:[{atom:1, lonePairs:1},{atom:0, lonePairs:2}] },
    wc:{ partner:'guanine', bonds:[
      { self:2,  role:'donor',    partner:'O6', partnerAtom:0 },
      { self:1,  role:'acceptor', partner:'N1', partnerAtom:2 },
      { self:0,  role:'acceptor', partner:'N2', partnerAtom:5 } ]},
    // The glycosidic site: N1 is where the sugar attaches, and the hydrogen on
    // it is what leaves as half of the water. Declared here, on the base,
    // because it is a fact about the base and not about the page that draws it
    // — the same shape mol-monomers.js's amino acids use for the peptide bond.
    condense:{ roles:[ { key:'glyco', label:'N1\u2013H', keep:3, leaves:[8] } ] },
    view:VIEW.flatRing,
    src:PUBCHEM({ name:'cytosine', cid:597, conformer:'0000025500000001' })
  };
  // N3–H → N1–H. Two doubles move: N1=C6 and C4=C5 become N3=C4 and C5=C6,
  // which is what restores N3's single in-plane lone pair — the acceptor
  // guanine's N1–H needs, and the reason G–C has three bonds and not two.
  moveH(cytosine, 8, 1, 3, [[3,7,1],[4,5,1],[1,4,2],[5,7,2]]);

  /* ---- phosphate ------------------------------------------------------
   * Phosphoric acid, as fetched (CID 1004). The nucleotide's third part, and
   * the only one of the three this file has to add — the sugar already exists
   * as MOLECULES.deoxyribose, built by mol-contrast.js.
   *
   * WHY THE NEUTRAL ACID AND NOT THE ION. At pH 7 free phosphate is HPO4²⁻ and
   * the phosphate in a nucleotide carries a negative charge; that charge is the
   * whole reason DNA is an acid and binds histones. But the reaction step 2
   * shows is a CONDENSATION, and a condensation needs the –OH that leaves. So
   * this spec is the protonated form, which is honest about the bond being
   * made and understates the charge. A page that draws the finished backbone
   * owes the ionised form; this one owes the leaving group.
   *
   * 0 P  1,2,3 O(H)  4 O(double)  5,6,7 the three hydroxyl H
   */
  const phosphate = {
    name:'Phosphate', formula:'H₃O₄P', charge:0, class:'acid',
    units:'angstrom',
    atoms:[{el:'P',pos:[0.077,-0.027,-0.046]},{el:'O',pos:[-1.3,-0.531,-0.724]},{el:'O',pos:[-0.055,-0.494,1.495]},{el:'O',pos:[-0.042,1.582,0]},{el:'O',pos:[1.319,-0.531,-0.724]},{el:'H',pos:[-2.154,-0.257,-0.327]},{el:'H',pos:[-0.84,-0.212,2.011]},{el:'H',pos:[0.152,2.097,-0.812]}],
    bonds:[[0,1],[0,2],[0,3],[0,4,2],[1,5],[2,6],[3,7]],
    names:['P','O1','O2','O3','O4','HO1','HO2','HO3'],
    // The three –OH are equivalent, so which one esterifies is arbitrary; O1 is
    // named as the one that reacts only so the page has something to point at.
    // The other two are what carry the charge once this is in a backbone.
    condense:{
      roles:[ { key:'ester', label:'P\u2013OH', keep:0, leaves:[1,5] } ] },
    // Two acceptors per oxygen either way; the finder reads them off lobes.js.
    // A tetrahedron has no informative default angle \u2014 every rotation of it
    // looks like the last one \u2014 so what this molecule is gets said by the
    // viewer's 2D layout, not by `view:`. Both fields below are generated
    // (spec2smiles.js, bake-flat2d.js); an authored value here would be a
    // second description of the geometry, free to drift from it.
    flat:true,
    smiles:'O=P(O)(O)O',
    flat2d:[[0,0],[-1.374,-0.793],[-0.793,1.374],[0.793,-1.374],[1.374,0.793]],
    view:VIEW.flatRing,
    src:PUBCHEM({ name:'phosphate', cid:1004, conformer:'000003EC00000001',
                 regen:'exact' })
  };


  /* =====================================================================
   *  THE FOUR dNTPs — what actually arrives at a growing strand
   * =====================================================================
   *  A base pairs; a NUCLEOTIDE is what a polymerase adds, and the two are
   *  not the same molecule. The bases above carry no sugar and no phosphate,
   *  which is all the pairing lesson needs. Replication needs the rest,
   *  because the energy and the DIRECTION are both in the part the bases do
   *  not have: three phosphates, of which two leave.
   *
   *  ---------------------------------------------------------------------
   *  ONE TAIL, FOUR BASES — and why that is the honest construction
   *  ---------------------------------------------------------------------
   *  `TAIL` below is the 2′-deoxyribose-5′-triphosphate of PubChem's dATP
   *  (CID 15993, 3D conformer 00003E7900000001), converted by
   *  sdf2spec-generic.js with its adenine removed. Each of the four bases is
   *  then superposed onto the frame that adenine occupied — its glycosidic
   *  nitrogen and the two ring atoms flanking it — so all four wear one
   *  sugar and one triphosphate in one conformation.
   *
   *  PubChem publishes no 3D conformer for dGTP at all, so a spec per record
   *  was never available. But four records would have been the worse choice
   *  even if they existed: the lesson's claim is that the tail is identical
   *  and the base is the choice, and four independently-relaxed floppy
   *  triphosphates would put part of the visible difference outside the
   *  chemistry. This is maltose/cellobiose's shared pose (MolecularGeometry.md
   *  §1.4), for the same reason — every on-screen difference between the four
   *  traces back to the base.
   *
   *  WHICH RING ATOM MAPS ONTO WHICH is not a free choice: it is the flip of
   *  the base about the glycosidic bond, and getting it wrong turns the
   *  Watson-Crick edge to face the sugar. The mapping is the one the χ torsion
   *  is defined by — O4′–C1′–N9–C4 for a purine and O4′–C1′–N1–C2 for a
   *  pyrimidine — so purine C4 goes where pyrimidine C2 goes, and C8 where C6
   *  goes. All four then inherit the record's anti conformation.
   *
   *  Two things fall out and are worth checking against, because they are
   *  independent of everything above: the glycosidic bond comes out at the
   *  record's own 1.459 Å for all four, and each finished formula matches the
   *  published record for that dNTP exactly, base by base.
   *
   *  THE TAIL IS TURNED 20°/40° OFF THE RECORD at C4′–C5′ and C5′–O5′.
   *  Adenine's own conformer leaves guanine's 2-amino hydrogen 1.35 Å from an
   *  α-phosphate oxygen — a clash, and the one thing a shared frame can get
   *  wrong. Those two torsions are floppy in solution and are asserted by
   *  nothing; swept together they clear all four bases at 3.34 Å, with γ still
   *  gauche− (−81.8°) and β still anti (−140.0°). Per §1.6 the pose is
   *  schematic and the clearance is a property of the conformation that no
   *  checker can see.
   *
   *  ---------------------------------------------------------------------
   *  WHAT `nucleotidyl:` CLAIMS, and why it is not `condense:`
   *  ---------------------------------------------------------------------
   *  Adding a nucleotide is not a dehydration. No water leaves: the 3′–OH of
   *  the strand attacks the α phosphorus and PYROPHOSPHATE goes, taking the
   *  bridging oxygen with it. `condense:` cannot express that — it sheds at
   *  most O+H+H, by construction — so this is its own claim, and
   *  check-molecules.js derives the leaving group from the bond graph rather
   *  than trusting the list.
   *
   *  It also states the DIRECTION, on one molecule: the α phosphate is
   *  esterified to O5′ and the hydroxyl that will accept the next one is O3′.
   *  A strand grows 5′→3′ because those are different atoms and only one of
   *  them is a nucleophile. That is the whole of step 3 of the replication
   *  lesson, said as chemistry instead of as a rule.
   * ================================================================== */
  const TAIL = {
    names:["C1′","H1′","C2′","H2′","H2′′","C3′","H3′","O3′","HO3′","C4′","H4′","O4′","C5′","H5′","H5′′","O5′","Pᴾ","O4ᴾ","O2ᴾ","HO2ᴾ","O3ᴾ","PBᴾ","O4Bᴾ","O2Bᴾ","HO2Bᴾ","O3Bᴾ","PGᴾ","O4Gᴾ","O2Gᴾ","HO2Gᴾ","O1Gᴾ","HO1Gᴾ"],
    atoms:[{el:'C',pos:[-0.877,-1.165,-0.001]},{el:'H',pos:[-1.793,-0.875,0.53]},{el:'C',pos:[-1.188,-1.715,-1.386]},{el:'H',pos:[-2.01,-1.171,-1.861]},{el:'H',pos:[-0.307,-1.654,-2.037]},{el:'C',pos:[-1.502,-3.161,-1.075]},{el:'H',pos:[-1.402,-3.825,-1.937]},{el:'O',pos:[-2.852,-3.241,-0.622]},{el:'H',pos:[-2.929,-2.773,0.226]},{el:'C',pos:[-0.557,-3.484,0.076]},{el:'H',pos:[-1.017,-4.144,0.82]},{el:'O',pos:[-0.273,-2.236,0.744]},{el:'C',pos:[0.763,-4.077,-0.397]},{el:'H',pos:[1.297,-3.391,-1.061]},{el:'H',pos:[0.588,-5.016,-0.931]},{el:'O',pos:[1.38,-4.752,0.686]},{el:'P',pos:[2.13,-6.164,0.437]},{el:'O',pos:[3.27,-6.108,-0.539]},{el:'O',pos:[0.944,-7.182,0.018]},{el:'H',pos:[0.619,-7.177,-0.908]},{el:'O',pos:[2.546,-6.67,1.913]},{el:'P',pos:[3.589,-6.073,2.991]},{el:'O',pos:[3.697,-6.845,4.273]},{el:'O',pos:[4.97,-5.943,2.161]},{el:'H',pos:[5.509,-6.748,2.004]},{el:'O',pos:[3.11,-4.54,3.167]},{el:'P',pos:[3.749,-3.298,3.978]},{el:'O',pos:[3.888,-3.52,5.455]},{el:'O',pos:[2.819,-2.047,3.551]},{el:'H',pos:[2.966,-1.176,3.98]},{el:'O',pos:[5.135,-3.021,3.192]},{el:'H',pos:[5.761,-2.358,3.553]}],
    bonds:[[0,1],[0,2],[0,11],[2,3],[2,4],[2,5],[5,6],[5,7],[5,9],[7,8],[9,10],[9,11],[9,12],[12,13],[12,14],[12,15],[15,16],[16,17,2],[16,18],[16,20],[18,19],[20,21],[21,22,2],[21,23],[21,25],[23,24],[25,26],[26,27,2],[26,28],[26,30],[28,29],[30,31]] };

  /* The glycosidic nitrogen and the two ring atoms that flank it, per base —
   * the triad superposed onto the frame adenine vacated, and the hydrogen on
   * that nitrogen, which the sugar replaces. See the header for why C2/C6 and
   * not C6/C2. */
  const GLYCO = {
    adenine:  { n:'N9', a:'C4', b:'C8', h:'H9' },
    guanine:  { n:'N9', a:'C4', b:'C8', h:'H9' },
    thymine:  { n:'N1', a:'C2', b:'C6', h:'H1' },
    cytosine: { n:'N1', a:'C2', b:'C6', h:'H1' },
  };

  /* An orthonormal frame from three points, RIGHT-HANDED BY CONSTRUCTION
   * (e3 = e1 × e2). The whole graft is one frame read into another, so a
   * left-handed one here would mirror the base and leave every bond length,
   * every angle and the render untouched — §1.3's failure reached by a
   * different road. */
  function triad(P, n, a, b){
    const s = (u,v) => [u[0]-v[0], u[1]-v[1], u[2]-v[2]];
    const d = (u,v) => u[0]*v[0] + u[1]*v[1] + u[2]*v[2];
    const x = (u,v) => [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]];
    const unit = u => { const L = Math.hypot(u[0],u[1],u[2]); return [u[0]/L,u[1]/L,u[2]/L]; };
    const e1 = unit(s(P[a], P[n]));
    let t = s(P[b], P[n]);
    t = s(t, e1.map(c => c * d(t, e1)));
    const e2 = unit(t);
    return [e1, e2, x(e1, e2)];
  }

  /* TAIL was emitted IN THE FRAME OF THE ADENINE IT LOST — that base's
   * glycosidic N at the origin, its triad as the axes. So a base lands simply
   * by being re-expressed in its own triad: no fit, no least squares, and the
   * bond comes out at the record's length rather than near it. */
  const OF = { adenine:'dATP', thymine:'dTTP', guanine:'dGTP', cytosine:'dCTP' };
  const NUCLEO = {};

  function nucleotide(base, key, meta){
    const g = GLYCO[key];
    const at = n => base.names.indexOf(n);
    const P = base.atoms.map(a => a.pos);
    const F = triad(P, at(g.n), at(g.a), at(g.b));
    const O = P[at(g.n)];
    const put = p => F.map(e =>
      e[0]*(p[0]-O[0]) + e[1]*(p[1]-O[1]) + e[2]*(p[2]-O[2]));

    // The glycosidic hydrogen goes; everything else comes across in order.
    const drop = at(g.h);
    const keep = base.atoms.map((_, i) => i).filter(i => i !== drop);
    const off = TAIL.atoms.length;
    const map = new Map(keep.map((old, k) => [old, off + k]));   // base -> merged

    const atoms = TAIL.atoms.map(a => ({ el:a.el, pos:a.pos.slice() }))
      .concat(keep.map(i => ({ el:base.atoms[i].el,
        pos:put(P[i]).map(v => +v.toFixed(3)) })));
    const names = TAIL.names.concat(keep.map(i => base.names[i]));
    const bonds = TAIL.bonds.map(b => b.slice())
      .concat(base.bonds.filter(b => map.has(b[0]) && map.has(b[1]))
        .map(b => [map.get(b[0]), map.get(b[1]), ...b.slice(2)]));
    bonds.push([TAIL.names.indexOf('C1′'), map.get(at(g.n))]);   // the new bond

    const i = n => names.indexOf(n);
    const site = s => ({ ...s, atom:map.get(s.atom) });

    return { name:meta.name, formula:meta.formula, charge:0, class:'nucleotide',
      units:'angstrom', atoms, bonds, names,
      topology: meta.topology,
      /* Carried across from the base, which is where they are true: the
       * pairing edge belongs to the base whether or not it is carrying a
       * sugar. Indices are remapped; nothing is retyped.
       *
       * The tautomer claim comes across MINUS THE GLYCOSIDIC NITROGEN, which
       * is the point of restating it here rather than inheriting it: that
       * nitrogen's hydrogen is the atom the sugar replaced, so the nucleotide
       * asserts the sugar went on the right one. dATP and dCTP end up
       * declaring no ring N–H at all, which is a claim and not an omission —
       * an adenine still carrying an N9–H is an adenine with nothing attached
       * to it. */
      tautomer:{ nh: base.tautomer.nh.filter(x => x !== g.n) },
      sites:{ donors: base.sites.donors.map(site),
              acceptors: base.sites.acceptors.map(site) },
      wc:{ partner: OF[base.wc.partner],
           bonds: base.wc.bonds.map(b => ({ ...b, self:map.get(b.self) })) },
      /* The reaction this molecule exists for. `leaves` is BAKED — derived
       * below by cutting the α–bridge bond and walking the graph — and
       * check-molecules.js re-derives it the same way and fails on a
       * disagreement, the bake-flat2d.js contract applied to a bond list. */
      nucleotidyl:{ ester:'O5′', alpha:'Pᴾ', bridge:'O3ᴾ',
                    nucleophile:'O3′', proton:'HO3′',
                    leaves: departing(bonds, i('Pᴾ'), i('O3ᴾ')) },
      optH: names.map((n, k) => k).filter(k => atoms[k].el === 'H' &&
        bonds.some(b => (b[0] === k && atoms[b[1]].el === 'C') ||
                        (b[1] === k && atoms[b[0]].el === 'C'))),
      flat:true, ...BAKED[meta.key],
      // No `view:` yet — picked in molecule-viewer.html, not guessed.
      view:null,
      src:{ path:'pubchem', cid:15993, query:meta.query, record:'3d',
        conformer:'00003E7900000001', sdf:'datp.sdf', tool:'sdf2spec-generic',
        regen:'manual', fetched:'2026-09-05',
        method:'dATP’s deoxyribose-5′-triphosphate, its two backbone '
          + 'torsions swept 20°/40° for clearance, with '
          + base.name.toLowerCase() + ' superposed on the glycosidic triad '
          + 'adenine vacated — see this file’s dNTP header' },
    };
  }

  /* What leaves as pyrophosphate: cut the α–bridge bond, keep everything still
   * reachable from the bridge. Derived rather than listed, because a typed list
   * of twelve indices is a claim nothing checks and a re-emitted TAIL would
   * silently falsify. */
  function departing(bonds, alpha, bridge){
    const adj = new Map();
    for(const [a, b] of bonds){
      if(a === alpha && b === bridge) continue;
      if(b === alpha && a === bridge) continue;
      (adj.get(a) || adj.set(a, []).get(a)).push(b);
      (adj.get(b) || adj.set(b, []).get(b)).push(a);
    }
    const seen = new Set([bridge]), stack = [bridge];
    while(stack.length){
      for(const n of adj.get(stack.pop()) || [])
        if(!seen.has(n)){ seen.add(n); stack.push(n); }
    }
    return [...seen].sort((a, b) => a - b);
  }

  /* Generated, never authored: spec2smiles.js and bake-flat2d.js read both off
   * the geometry, and a hand-written string here would be a second description
   * of the molecule sitting next to `atoms`/`bonds` and free to drift from it.
   *
   * They live in a TABLE rather than in `nucleotide()` because tools/specfile.js
   * replaces a field inside the block of the spec that owns it, and four specs
   * built by one function own no line of their own. One entry each gives each
   * generator somewhere to write, and keeps the write verifiable per spec.
   *
   *   node tools/spec2smiles.js --write && node tools/bake-flat2d.js --write
   */
  const BAKED = {
    dATP: {
      smiles:'Nc1ncnc2c1ncn2[C@H]1C[C@H](O)[C@@H](COP(=O)(O)OP(=O)(O)OP(=O)(O)O)O1',
      flat2d:[[-1.638,1.619],[-0.441,2.488],[0.755,1.619],[2.161,2.076],[0.298,0.213],[-1.181,0.213],[1.167,-0.984],[0.566,-2.335],[1.435,-3.531],[2.631,-2.662],[0.239,-4.4],[2.304,-4.728],[3.775,-4.573],[3.929,-6.044],[3.62,-3.102],[5.246,-4.418],[5.847,-3.067],[7.198,-3.669],[4.496,-2.466],[6.449,-1.716],[-5.437,2.076],[-3.044,2.076],[-2.762,4.763],[-4.98,6.044],[-7.198,4.763],[-4.98,3.482],[-3.501,3.482],[-5.719,4.763],[-4.24,1.207],[-3.501,6.044]],
    },
    dTTP: {
      smiles:'Cc1cn([C@H]2C[C@H](O)[C@@H](COP(=O)(O)OP(=O)(O)OP(=O)(O)O)O2)c(=O)[nH]c1=O',
      flat2d:[[0.412,-2.374],[-1.067,-2.219],[-1.377,-0.763],[-2.736,-0.158],[-0.088,-0.019],[1.018,-1.015],[0.067,1.461],[1.427,2.066],[1.582,3.545],[0.102,3.701],[3.062,3.39],[1.738,5.025],[0.534,5.9],[1.409,7.103],[-0.341,4.696],[-0.67,6.774],[-2.029,6.169],[-2.634,7.528],[-1.424,4.81],[-3.388,5.564],[3.388,-7.528],[3.388,-2.374],[3.388,-4.951],[1.156,-3.663],[1.156,-6.24],[2.644,-6.24],[0.412,-4.951],[0.412,-7.528],[2.644,-3.663]],
    },
    dGTP: {
      smiles:'Nc1nc2c(ncn2[C@H]2C[C@H](O)[C@@H](COP(=O)(O)OP(=O)(O)OP(=O)(O)O)O2)c(=O)[nH]1',
      flat2d:[[2.57,-0.594],[2.57,-2.069],[1.168,-2.524],[0.712,-3.927],[0.301,-1.332],[1.168,-0.139],[-1.174,-1.332],[-1.911,-0.055],[-3.385,-0.055],[-3.385,-1.529],[-3.385,1.42],[-4.86,-0.055],[-5.597,-1.332],[-6.874,-0.594],[-4.32,-2.069],[-6.334,-2.608],[-5.597,-3.885],[-6.874,-4.623],[-4.32,-3.148],[-4.86,-5.162],[6.874,4.1],[6.032,1.01],[4.376,4.631],[2.667,2.733],[3.763,0.272],[1.878,5.162],[5.165,2.202],[3.763,1.747],[5.471,3.645],[2.973,4.176],[5.165,-0.183]],
    },
    dCTP: {
      smiles:'Nc1ccn([C@H]2C[C@H](O)[C@@H](COP(=O)(O)OP(=O)(O)OP(=O)(O)O)O2)c(=O)n1',
      flat2d:[[0.413,-2.376],[-1.068,-2.22],[-1.378,-0.764],[-2.738,-0.158],[-0.088,-0.019],[1.018,-1.015],[0.067,1.461],[1.428,2.067],[1.583,3.548],[0.103,3.703],[3.064,3.392],[1.739,5.028],[0.534,5.903],[1.409,7.108],[-0.341,4.699],[-0.67,6.778],[-2.03,6.173],[-2.636,7.533],[-1.425,4.813],[-3.39,5.567],[3.39,-2.376],[3.39,-4.954],[3.39,-7.533],[1.157,-3.665],[2.646,-6.244],[1.157,-6.244],[2.646,-3.665],[0.413,-4.954]],
    },
  };

  const dATP = nucleotide(adenine, 'adenine', {
    key:"dATP", name:"dATP", query:"2'-deoxyadenosine 5'-triphosphate",
    formula:'C₁₀H₁₆N₅O₁₂P₃', topology:{ rings:[5,5,6], fused:true } });
  const dTTP = nucleotide(thymine, 'thymine', {
    key:"dTTP", name:"dTTP", query:"2'-deoxythymidine 5'-triphosphate",
    formula:'C₁₀H₁₇N₂O₁₄P₃', topology:{ rings:[5,6] } });
  const dGTP = nucleotide(guanine, 'guanine', {
    key:"dGTP", name:"dGTP", query:"2'-deoxyguanosine 5'-triphosphate",
    formula:'C₁₀H₁₆N₅O₁₃P₃', topology:{ rings:[5,5,6], fused:true } });
  const dCTP = nucleotide(cytosine, 'cytosine', {
    key:"dCTP", name:"dCTP", query:"2'-deoxycytidine 5'-triphosphate",
    formula:'C₉H₁₆N₃O₁₃P₃', topology:{ rings:[5,6] } });

  /* `wc.partnerAtom` still points into the BASE the partner was made from, so
   * it is remapped last, once all four exist. check-molecules.js reads it to
   * prove the edge is reciprocal, and an index left pointing at the base would
   * name whatever atom happens to sit there in the nucleotide. */
  Object.assign(NUCLEO, { dATP, dTTP, dGTP, dCTP });
  for(const spec of Object.values(NUCLEO)){
    const p = NUCLEO[spec.wc.partner];
    for(const b of spec.wc.bonds) b.partnerAtom = p.names.indexOf(b.partner);
  }

  register({ adenine, thymine, guanine, cytosine, phosphate,
             dATP, dTTP, dGTP, dCTP }, SELFNAME);

})(typeof window !== 'undefined' ? window : globalThis);
