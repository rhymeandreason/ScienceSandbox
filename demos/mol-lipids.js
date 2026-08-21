/* =====================================================================
 *  mol-lipids.js — the membrane set (family B, real ångströms)
 * =====================================================================
 *  glycerol, so far. The phospholipid this file exists for is NOT here
 *  yet, and the reason is written down at the bottom rather than left
 *  for whoever tries next.
 *
 *  FAMILY B. Loads beside mol-small.js and mol-pathways.js, never
 *  beside mol-solvation.js — the membrane page compares a water against
 *  a lipid tail, and that comparison only means anything inside one
 *  scale family (molecules.js's header, MolecularGeometry.md §1).
 *
 *  CONSTRUCTED, NOT TYPED — MolecularGeometry.md §1.2 path 4, the same
 *  argument palmitate makes. Every position comes out of the geometry
 *  helpers below; a tetrahedral centre is built from the bonds it
 *  already has, never placed by eye. The first draft of this file WAS
 *  typed and it put three methyls around a nitrogen at 80° and 120°
 *  instead of 109.5° — angles that look plausible in a coordinate list
 *  and are visibly wrong the moment they render. check-molecules.js
 *  prints every angle for exactly this reason.
 * ===================================================================== */
(function(global){
  'use strict';
  const SELFNAME = 'mol-lipids.js';
  const Lib = global.MolLib
    || (typeof require === 'function' ? require('./molecules.js').MolLib : null);
  if (!Lib) throw new Error(SELFNAME + ': molecules.js must be loaded first');
  const { register } = Lib;

  /* ---------- the numbers every coordinate below is derived from ------ */
  const CC = 1.54,          // C–C single
        CO = 1.43;          // C–O alcohol / ester
  const TET = 109.47 * Math.PI / 180;

  const V = {
    add:(a,b)=>[a[0]+b[0], a[1]+b[1], a[2]+b[2]],
    mul:(a,s)=>[a[0]*s, a[1]*s, a[2]*s],
    len:a=>Math.hypot(a[0], a[1], a[2]),
    norm:a=>V.mul(a, 1/V.len(a)),
    cross:(a,b)=>[a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]],
  };
  const at = (p, dir, L) => V.add(p, V.mul(V.norm(dir), L));

  /* THE ZIGZAG, and why it needs no angle argument. Walking a chain with
   * a fixed lateral component and alternating its sign puts every
   * interior angle at exactly 109.47° WHATEVER the bond lengths are: the
   * two directions are (±s,−c,0), and the angle between the reversed
   * first and the second is acos(s²−c²), which is the tetrahedral angle
   * when s and c are sin/cos of half its supplement. */
  const S = Math.sin((Math.PI - TET) / 2), C = Math.cos((Math.PI - TET) / 2);
  function zigzag(start, lengths, sign) {
    const out = []; let p = start.slice(), s = sign;
    for (const L of lengths) { const q = at(p, [s * S, -C, 0], L); out.push(q); p = q; s = -s; }
    return out;
  }
  /* The two remaining tetrahedral directions at a centre with two bonds:
   * bisect away from the pair, then split by half the tetrahedral angle
   * along their common normal. */
  function tetra2(d1, d2) {
    const bis = V.norm(V.mul(V.add(V.norm(d1), V.norm(d2)), -1));
    const perp = V.norm(V.cross(d1, d2));
    const c = Math.cos(TET / 2), s = Math.sin(TET / 2);
    return [ V.norm(V.add(V.mul(bis, c), V.mul(perp, s))),
             V.norm(V.add(V.mul(bis, c), V.mul(perp, -s))) ];
  }
  /* The three remaining at a centre with one bond: a tripod at the
   * tetrahedral angle FROM THAT BOND — not from its supplement, which is
   * the way to get every branch at 70.5° and have it look fine until
   * check-molecules.js prints the angles. */
  function tetra3(d1) {
    const u = V.norm(d1);
    const t = Math.abs(u[0]) < 0.9 ? [1,0,0] : [0,1,0];
    const e1 = V.norm(V.cross(u, t)), e2 = V.cross(u, e1);
    const c = Math.cos(TET), s = Math.sin(TET);
    return [0,1,2].map(k => {
      const a = k * 2 * Math.PI / 3;
      return V.norm(V.add(V.mul(u, c),
        V.add(V.mul(e1, s * Math.cos(a)), V.mul(e2, s * Math.sin(a)))));
    });
  }

  register({
    // — GLYCEROL. Three carbons, three hydroxyls. Tier 1 prop
    //   (MolecularGeometry.md §1.4): correct shape and polarity is the
    //   whole ask, and it is compared against nothing. It earns its
    //   place by answering "what is a phospholipid made of" — the
    //   backbone is invisible inside the assembled lipid, so the pieces
    //   have to be shown beside it.
    glycerol: (() => {
      const c = [[0, CC * C, 0]];                          // C1
      zigzag(c[0], [CC, CC], -1).forEach(p => c.push(p));  // C2, C3
      // Both end carbons are TERMINAL — one bond each, so their hydroxyls
      // go on tetra3 directions. Continuing the zigzag instead is wrong
      // at a chain END: the alternating sign is only anti to the PREVIOUS
      // bond when there is one, and off the last atom it lands at 70° or
      // 180°. Both of those shipped in a draft of this file.
      const back = (from, to) => [c[to][0]-c[from][0], c[to][1]-c[from][1], c[to][2]-c[from][2]];
      const o1 = at(c[0], tetra3(back(0,1))[0], CO);
      const o3 = at(c[2], tetra3(back(2,1))[0], CO);
      const o2 = at(c[1], tetra2(back(1,0), back(1,2))[0], CO);
      const r = v => v.map(x => +x.toFixed(4));
      return {
        name:'Glycerol', formula:'C₃H₈O₃', charge:0, class:'lipid',
        // United-atom, like palmitate: a CH₂ is one carbon sphere, and
        // the formula states the hydrogens (MolecularGeometry.md §1.3b —
        // H is a drawing decision, the formula's count is a chemical one).
        atoms:[ {el:'C',pos:r(c[0])}, {el:'C',pos:r(c[1])}, {el:'C',pos:r(c[2])},
                {el:'O',pos:r(o1)},   {el:'O',pos:r(o2)},   {el:'O',pos:r(o3)} ],
        names:['C1','C2','C3','O1','O2','O3'],
        bonds:[ [0,1],[1,2],[0,3],[1,4],[2,5] ],
        units:'angstrom',
        src:{ path:'built', charge:0,
              method:'all-anti C3 backbone, tetrahedral 109.47° from existing bonds, united-atom' },
        groups:[
          { key:'backbone', label:'Three-carbon backbone', formula:'C₃', atoms:[0,1,2],
            note:'The hook everything else hangs off. Two hydroxyls take fatty acid tails; the third takes the phosphate.' },
          { key:'hydroxyls', label:'Three hydroxyls', formula:'–OH ×3', atoms:[3,4,5],
            note:'Polar, and all three get used — which is why glycerol dissolves in water and the lipid it becomes does not.' },
        ],
      };
    })(),

    // — POPC. 1-palmitoyl-2-oleoyl-sn-glycero-3-phosphocholine, the lipid
    //   a membrane is actually built from. Tier 2 contrast
    //   (MolecularGeometry.md §1.4): the claim is the SHAPE — one small
    //   charged head over two long nonpolar tails — so the head's charge
    //   and the tails' spacing both have to be right, and the cis kink
    //   has to be a kink rather than a bend.
    //
    //   ZWITTERION, and not as a simplification: +1 on the quaternary
    //   choline nitrogen, -1 on a phosphate oxygen, net 0. That is the
    //   molecule at every pH a cell sees, and the head being charged is
    //   the entire reason it faces water.
    //
    //   CONSTRUCTED (§1.2 path 4), because there is no alternative:
    //   PubChem publishes no 3D conformer for POPC. It has 41 rotatable
    //   bonds, past their cutoff, and all seven CIDs the catalog resolver
    //   found return 404 for record_type=3d while glucose and palmitic
    //   acid return 200. The catalog's URL for this row would fail today.
    //   §1.6 wants the idealised zigzag here anyway: a real conformer of a
    //   41-rotor lipid renders as spaghetti, and "two long tails, one
    //   small head" is the whole point of the picture.
    //
    //   BUILT FROM INTERNAL COORDINATES, torsions solved rather than
    //   typed. Every bond length and angle is exact by construction
    //   (NeRF placement): 109.47° at the choline nitrogen and along both
    //   chains, 120° at the phosphate, 123° at the two alkene carbons,
    //   125° at both sp2 ester carbonyls. The acyl chains are all-anti
    //   rods BY CONSTRUCTION, so only the fifteen linkage torsions were
    //   free, and those were solved by coordinate descent against a
    //   score that reads: no non-bonded contact closer than van der
    //   Waals, the two chain axes parallel, both chains pointing away
    //   from the head.
    //
    //   THAT IS WHAT FIXES THE CLASH the four earlier attempts could not.
    //   Building head-first made the chain spacing an OUTPUT — two rods
    //   descending from glycerol carbons 1.54 A apart sat ~1.9 A apart,
    //   inside each other's van der Waals radius. Making the torsions the
    //   free variables makes spacing a CONSTRAINT instead: the linkage
    //   has the torsional freedom to absorb the offset, and the solver
    //   spends it. Measured spacing now runs 3.67-4.60 A the whole length
    //   of both chains (a real C...C contact is 3.4-4.0 A), chain axes
    //   parallel to a dot product of 0.998, closest non-bonded approach
    //   anywhere in the molecule 3.46 A.
    //
    //   UNITED-ATOM, like glycerol and palmitate: a CH2 is one carbon
    //   sphere and the formula states the hydrogens (§1.3b). So this spec
    //   has no H atoms at all - both esters and the choline have no polar
    //   hydrogen to draw.
    //
    //   THE KINK IS THE sn-2 CHAIN'S, and it is one cis C=C at delta-9,
    //   the same feature palmitoleate carries in mol-contrast.js. `cis:`
    //   asserts it, because bond lengths and angles cannot see it - cis
    //   and trans share the same C=C length and the same ~123 degrees,
    //   and only the torsion differs.
    popc: {
      name:'Phospholipid (POPC)', formula:'C₄₂H₈₂NO₈P', charge:0, class:'lipid',
      units:'angstrom',
      // Chosen by dragging in molecule-viewer.html and pasting that page's
      // copy output — the only way an angle gets into this repo, because
      // nothing offline can judge a pose. Inline rather than a VIEW entry:
      // one molecule uses it, and a shared name nobody reuses is worse than
      // a literal (AddingAPage.md). Stage.buildMolecule bakes this into the
      // meshes, so a page's own rotation is an OFFSET from it and must be
      // zero at rest.
      view:[2.9720, 0.8566, 3.0634],
      src:{ path:'built', charge:0,
            method:'internal coordinates (NeRF); all-anti acyl rods, one cis C=C at '
                 + 'delta-9, 15 linkage torsions solved for van der Waals clearance '
                 + 'and parallel chains; united-atom' },
      atoms:[
        {el:'C',pos:[0.0232,6.0898,1.1125]}, {el:'C',pos:[1.201,6.6329,0.2822]},
        {el:'C',pos:[-0.4909,7.1925,2.0566]}, {el:'O',pos:[-0.1466,8.4743,1.5243]},
        {el:'P',pos:[-0.8523,9.7927,2.0934]}, {el:'O',pos:[-1.8651,10.328,1.1564]},
        {el:'O',pos:[-1.5462,9.5404,3.3761]}, {el:'O',pos:[0.3547,10.8252,2.2864]},
        {el:'C',pos:[0.6865,11.741,1.2395]}, {el:'C',pos:[0.4732,13.1652,1.7257]},
        {el:'N',pos:[0.023,14.0289,0.5718]}, {el:'C',pos:[0.8674,15.2673,0.515]},
        {el:'C',pos:[0.1686,13.2651,-0.7109]}, {el:'C',pos:[-1.4143,14.4121,0.7652]},
        {el:'O',pos:[2.0939,5.5621,-0.0357]}, {el:'C',pos:[2.3804,5.4021,-1.3349]},
        {el:'O',pos:[3.0392,6.1689,-1.9998]}, {el:'C',pos:[1.7701,4.1292,-1.8709]},
        {el:'C',pos:[2.3834,2.9193,-1.1417]}, {el:'C',pos:[1.761,1.6211,-1.6884]},
        {el:'C',pos:[2.3743,0.4112,-0.9592]}, {el:'C',pos:[1.7519,-0.8871,-1.5059]},
        {el:'C',pos:[2.3652,-2.097,-0.7767]}, {el:'C',pos:[1.7428,-3.3952,-1.3234]},
        {el:'C',pos:[2.3561,-4.6051,-0.5943]}, {el:'C',pos:[1.7337,-5.9034,-1.1409]},
        {el:'C',pos:[2.347,-7.1133,-0.4118]}, {el:'C',pos:[1.7246,-8.4115,-0.9584]},
        {el:'C',pos:[2.3379,-9.6214,-0.2293]}, {el:'C',pos:[1.7155,-10.9197,-0.7759]},
        {el:'C',pos:[2.3288,-12.1296,-0.0468]}, {el:'C',pos:[1.7064,-13.4278,-0.5934]},
        {el:'O',pos:[0.0727,4.6607,1.1321]}, {el:'C',pos:[-1.0775,4.0294,0.86]},
        {el:'O',pos:[-2.0511,4.5455,0.3602]}, {el:'C',pos:[-1.0045,2.5753,1.2604]},
        {el:'C',pos:[-1.4493,1.6943,0.0783]}, {el:'C',pos:[-1.3749,0.2113,0.4867]},
        {el:'C',pos:[-1.8197,-0.6697,-0.6955]}, {el:'C',pos:[-1.7452,-2.1526,-0.287]},
        {el:'C',pos:[-2.1901,-3.0336,-1.4692]}, {el:'C',pos:[-2.1156,-4.5166,-1.0608]},
        {el:'C',pos:[-2.5605,-5.3976,-2.243]}, {el:'C',pos:[-2.5986,-6.7257,-2.1825]},
        {el:'C',pos:[-2.2095,-7.5043,-0.9486]}, {el:'C',pos:[-2.3698,-9.0115,-1.221]},
        {el:'C',pos:[-1.9731,-9.8056,0.0374]}, {el:'C',pos:[-2.1334,-11.3128,-0.235]},
        {el:'C',pos:[-1.7366,-12.1069,1.0234]}, {el:'C',pos:[-1.8969,-13.6141,0.751]},
        {el:'C',pos:[-1.5001,-14.4082,2.0095]}, {el:'C',pos:[-1.6604,-15.9154,1.7371]},
      ],
      names:[

        'C2','C1','C3','O14','P','O12','O13','O11','CB','CA',
        'N','CN1','CN2','CN3','O21','C1A','O22','C2A','C3A','C4A',
        'C5A','C6A','C7A','C8A','C9A','C10A','C11A','C12A','C13A','C14A',
        'C15A','C16A','O31','C1B','O32','C2B','C3B','C4B','C5B','C6B',
        'C7B','C8B','C9B','C10B','C11B','C12B','C13B','C14B','C15B','C16B',
        'C17B','C18B',
      ],
      bonds:[

        [1,0],[0,2],[2,3],[3,4],[4,5,2],[4,6],[4,7],[7,8],[8,9],[9,10],
        [10,11],[10,12],[10,13],[1,14],[14,15],[15,16,2],[15,17],[17,18],[18,19],[19,20],
        [20,21],[21,22],[22,23],[23,24],[24,25],[25,26],[26,27],[27,28],[28,29],[29,30],
        [30,31],[0,32],[32,33],[33,34,2],[33,35],[35,36],[36,37],[37,38],[38,39],[39,40],
        [40,41],[41,42],[42,43,2],[43,44],[44,45],[45,46],[46,47],[47,48],[48,49],[49,50],
        [50,51],
      ],
      // The kink. Bond lengths and angles are identical cis or trans;
      // only this torsion tells them apart.
      cis:{ atoms:[41,42,43,44], value:true },
      hydrophobic:[17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,
                   35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51],
      groups:[
        { key:'choline', label:'Choline', formula:'–N(CH₃)₃⁺', atoms:[10,11,12,13,9,8],
          note:'Permanently positive, whatever the pH. This end has no choice but to face water.' },
        { key:'phosphate', label:'Phosphate', formula:'–PO₄⁻', atoms:[4,5,6,7,3],
          note:'The negative half of the head. Charge plus charge is why the head is the wet end.' },
        { key:'glycerol', label:'Glycerol backbone', formula:'C₃', atoms:[1,0,2],
          note:'The three-carbon hook: two hydroxyls took tails, the third took the phosphate.' },
        { key:'esters', label:'Two ester links', formula:'–O–C(=O)–', atoms:[14,15,16,32,33,34],
          note:'Where the tails were bolted on, by dehydration synthesis. The last polar atoms going down.' },
        { key:'tails', label:'Two fatty acid tails', formula:'C₁₆ + C₁₈', atoms:[17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51],
          note:'Carbon and hydrogen only, so nothing here is attracted to water. Two of them, which is what makes a sheet instead of a ball.' },
        { key:'kink', label:'One cis double bond', formula:'C=C', atoms:[41,42,43,44],
          note:'The oleoyl tail bends here and the palmitoyl one does not. A bent chain cannot pack flush against its neighbours, which is what keeps the membrane fluid.' },
      ],
    },
  }, SELFNAME);

  /* The phospholipid this file was waiting for is now `popc` above. The
   * four head-first attempts that could not clear the tails, and their
   * measurements, are in this file's git history - the note that recorded
   * them is gone because the wall it described has been climbed. What
   * replaced them is in popc's own comment: solve the torsions, don't
   * type them.
   */
})(this);
