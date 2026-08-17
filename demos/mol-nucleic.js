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
   * this runs, so everything below is in the record's own units. */
  const N_H = 1.01;
  function moveH(spec, h, from, to){
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
    view:VIEW.flatRing,
    src:PUBCHEM({ name:'adenine', cid:190, conformer:'000000BE00000001' })
  };
  moveH(adenine, 10, 0, 1);                        // N7 → N9

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
    view:VIEW.flatRing,
    src:PUBCHEM({ name:'guanine', cid:135398634, conformer:'081204EA00000001' })
  };
  moveH(guanine, 11, 1, 4);                        // N7 → N9

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
    view:VIEW.flatRing,
    src:PUBCHEM({ name:'cytosine', cid:597, conformer:'0000025500000001' })
  };
  moveH(cytosine, 8, 1, 3);                        // N3 → N1

  register({ adenine, thymine, guanine, cytosine }, SELFNAME);

})(typeof window !== 'undefined' ? window : globalThis);
