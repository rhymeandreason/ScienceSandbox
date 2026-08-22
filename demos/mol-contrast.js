/* =====================================================================
 *  mol-contrast.js — the near-identical pairs where one feature is the whole lesson
 * ===================================================================== */
(function(global){
  'use strict';
  const SELFNAME = 'mol-contrast.js';
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
          perpTo, spinAbout, alignTo, absorb, FURANOSE_UP, FURANOSE_DOWN,
          Skel, chainC, ringPyranose, ringFuranose, flatRing, fuseRing,
          flatH } = SkelLib;

  /* ---------------------------------------------------------------------
   *  CONTRAST PAIRS — contrast-lab.html
   * ---------------------------------------------------------------------
   *  Family B (real Å × SCALE), so a pair is genuinely comparable: if these
   *  came from different scale families the whole page would be a lie.
   *
   *  Every molecule here is Tier 2 in SCIENCE.md's sense — it exists only to be
   *  shown beside a near-identical sibling, where ONE feature is the entire
   *  lesson. That feature is therefore asserted by check-molecules.js, never
   *  merely drawn. Each spec carries a `contrast` block naming its partner, the
   *  lesson, and `diff` — the atoms that differ, which is what the page dims
   *  everything else down to.
   * ------------------------------------------------------------------- */
  const CONTRAST = {};
  {
    // — galactose: β-D-galactopyranose. Built by exactly the same sequence as
    //   glucose above, with ONE substitution: C4's –OH is axial, not equatorial.
    //   That is the whole molecule's reason to exist on this page, so the build
    //   deliberately mirrors glucose's line for line — if the two builds drifted
    //   apart, a difference could show up on screen that is not the difference.
    const g=ringPyranose();
    const C=[1,2,3,4,5];
    const RING=[0,1,2,3,4,5];
    const C4=4;                           // ring index of C4 — the one flipped atom
    const OH=[];
    C.forEach(k=>{ if(k<5) OH.push(g.hydroxyl(k, k===C4 ? g.axial(k,RING) : g.equatorial(k,RING))); });
    const c6=g.grow(5,'C',GL.CC,'sp3',g.equatorial(5,RING));
    OH.push(g.hydroxyl(c6,0));
    const CH=[];
    C.forEach(k=>CH.push(g.grow(k,'H',GL.CH,'sp3',0)));
    CH.push(g.grow(c6,'H',GL.CH,'sp3',0), g.grow(c6,'H',GL.CH,'sp3',0));
    const ohH=OH.map(o=>{
      const b=g.bonds.find(b=>(b[0]===o||b[1]===o) && g.atoms[b[0]===o?b[1]:b[0]].el==='H');
      return b[0]===o?b[1]:b[0];
    });
    CONTRAST.galactose=g.spec({ name:'Galactose', formula:'C₆H₁₂O₆', class:'sugar',
      names:['O5','C1','C2','C3','C4','C5','O1','HO1','O2','HO2','O3','HO3','O4','HO4','C6','O6','HO6','H1','H2','H3','H4','H5','H61','H62'],
      smiles:'OC[C@H]1O[C@@H](O)[C@H](O)[C@@H](O)[C@H:1]1[OH:1]',
      // C4 axial, every other substituent equatorial. `all-equatorial` here would
      // be glucose — and the render of the two is very nearly the same picture.
      stereo:{ axial:[C4] },
      view:VIEW.pyranose,       // the same object as glucose's — they cannot drift
      optH:CH,
      contrast:{ pair:'glucose-galactose', partner:'glucose',
        differs:'one –OH orientation',
        lesson:'why galactosemia is a disease',
        diff:[C4, OH[3], ohH[3]],
        align:RING,
        note:'Same formula, same atoms, same bonds — C4’s –OH points axial instead '
           + 'of equatorial. One enzyme (GALT) tells them apart. Without it, galactose '
           + 'from milk builds up and damages the liver, eyes and brain.' } });
  }
  {
    // — alpha-D-glucopyranose: glucose with the anomeric –OH AXIAL. The same
    //   build as galactose above and as glucose in mol-pathways.js, line for
    //   line, with one slot changed at C1 — because that one slot is the whole
    //   reason this molecule exists.
    //
    //   condense-lab.html needs it as a REAGENT, and the reason is chemical
    //   rather than convenient. A student cannot turn β-glucose into α-glucose
    //   by rotating it: the two differ by which side of the ring C1's oxygen
    //   sits on, and getting from one to the other means breaking a bond at C1.
    //   So starch's linkage and cellulose's cannot be two ways of bringing the
    //   same molecule together — they are two different starting molecules, and
    //   the lesson only tells the truth if the student picks between them.
    //
    //   Not given a `contrast:` block: contrast-lab.html already runs six pairs
    //   and glucose is spoken for by galactose there. The α/β difference is
    //   asserted below by `stereo:` in the ordinary way.
    const g=ringPyranose();
    const C=[1,2,3,4,5];
    const RING=[0,1,2,3,4,5];
    const C1=1;                           // ring index of C1 — the one flipped atom
    const OH=[];
    C.forEach(k=>{ if(k<5) OH.push(g.hydroxyl(k, k===C1 ? g.axial(k,RING) : g.equatorial(k,RING))); });
    const c6=g.grow(5,'C',GL.CC,'sp3',g.equatorial(5,RING));
    OH.push(g.hydroxyl(c6,0));
    const CH=[];
    C.forEach(k=>CH.push(g.grow(k,'H',GL.CH,'sp3',0)));
    CH.push(g.grow(c6,'H',GL.CH,'sp3',0), g.grow(c6,'H',GL.CH,'sp3',0));
    const ohH=OH.map(o=>{
      const b=g.bonds.find(b=>(b[0]===o||b[1]===o) && g.atoms[b[0]===o?b[1]:b[0]].el==='H');
      return b[0]===o?b[1]:b[0];
    });
    CONTRAST.alphaGlucose=g.spec({ name:'\u03b1-D-Glucose', short:'\u03b1-Glucose',
      formula:'C\u2086H\u2081\u2082O\u2086', class:'sugar',
      names:['O5','C1','C2','C3','C4','C5','O1','HO1','O2','HO2','O3','HO3','O4','HO4','C6','O6','HO6','H1','H2','H3','H4','H5','H61','H62'],
      // No `smiles:` on purpose. That field is GENERATED by tools/spec2smiles.js
      // through RDKit, and a hand-typed one is a stereochemical claim nothing
      // checked — on an anomer, the exact claim most easily got backwards. No
      // page draws this molecule's diagram; run the tool if one ever needs to.
      // C1 axial, every other substituent equatorial. `all-equatorial` here
      // would be ordinary β-glucose, and the two render as nearly one picture.
      stereo:{ axial:[C1] },
      view:VIEW.pyranose,       // the same object as glucose's — they cannot drift
      optH:CH,
      // condense-lab.html. Same two roles β-glucose declares (mol-pathways.js),
      // reaching the other product: an axial anomeric oxygen builds the α-1,4
      // linkage, which is starch's. No `invert` — this molecule already IS the
      // configuration maltose needs, which is the entire point of it existing.
      condense:{
        roles:[
          { key:'c1', label:'anomeric \u2013OH', keep:OH[0], leaves:[ohH[0]] },
          { key:'c4', label:'C4 \u2013OH',       keep:4,      leaves:[OH[3], ohH[3]] } ],
        makes:[ { product:'maltose', donor:'c1', acceptor:'c4', config:'alpha', invert:false } ] } });
  }
  {
    // — ribose and 2-deoxyribose. Built by one shared function, because "the same
    //   molecule minus one oxygen" has to be literally that: the deoxy build runs
    //   the identical sequence and swaps a single hydroxyl for a hydrogen.
    //   β-D-ribofuranose faces: 1′-OH and 5′ up (that pairing is what β- means),
    //   2′-OH and 3′-OH down.
    // Face TAGS, relative to the sign ringNormal() returns for this ring's fixed
    // traversal. That sign is arbitrary but deterministic, so which of ±1 means
    // "up" is a fact to be established, not assumed — and it was established
    // wrong: with UP=+1 this built L-ribose and L-deoxyribose (item 5).
    //
    // The pyranose fix in skel.js does NOT transfer here, and flipping this
    // ring's frame the way ringPyranose's was flipped does exactly nothing:
    // face() is defined against the ring normal, so reversing the traversal
    // reverses the normal too and every substituent follows it. For a furanose
    // the only thing that mirrors the molecule is swapping these tags. That
    // asymmetry — equatorial() is normal-sign-INdependent, face() is
    // sign-dependent — is why the two sugar families needed different fixes.
    //
    // Asserted by the committed `smiles` on both specs. The constant now lives
    // in skel.js beside ringFuranose(), where the traversal that fixes its sign
    // is — `atpSkel` builds a furanose too, and got it wrong the same way.
    const UP=FURANOSE_UP, DOWN=FURANOSE_DOWN;
    function riboFuranose(deoxy){
      const s=ringFuranose();
      const RING=[0,1,2,3,4];             // O4′, C1′, C2′, C3′, C4′
      const c1=1,c2=2,c3=3,c4=4;
      const o1=s.hydroxyl(c1, s.face(c1,RING,UP));
      // the 2′ position — the entire difference between the two sugars
      const o2 = deoxy ? null : s.hydroxyl(c2, s.face(c2,RING,DOWN));
      const h2 = deoxy ? s.grow(c2,'H',GL.CH,'sp3',s.face(c2,RING,DOWN)) : null;
      const o3=s.hydroxyl(c3, s.face(c3,RING,DOWN));
      const c5=s.grow(c4,'C',GL.CC,'sp3',s.face(c4,RING,UP));
      const o5=s.hydroxyl(c5,0);
      // C–H last, so every index above is stable (same discipline as glucose)
      const CH=[ s.grow(c1,'H',GL.CH,'sp3',0), s.grow(c2,'H',GL.CH,'sp3',0),
                 s.grow(c3,'H',GL.CH,'sp3',0), s.grow(c4,'H',GL.CH,'sp3',0),
                 s.grow(c5,'H',GL.CH,'sp3',0), s.grow(c5,'H',GL.CH,'sp3',0) ];
      const ohH=o=>{ const b=s.bonds.find(b=>(b[0]===o||b[1]===o) && s.atoms[b[0]===o?b[1]:b[0]].el==='H');
        return b[0]===o?b[1]:b[0]; };
      return { s, RING, c2, o1, o2, h2, o3, c5, o5, CH, ohH };
    }
    // Faces are declared by LABEL, not by sign: the ring normal's sign falls out
    // of ring traversal order, so only which substituents share a face is
    // meaningful — and that is exactly what makes this ribose rather than one of
    // its stereoisomers (arabinose, xylose, lyxose all differ only here).
    const FACES={ 1:'a', 2:'b', 3:'b', 4:'a' };

    const r=riboFuranose(false);
    CONTRAST.ribose=r.s.spec({ name:'Ribose', formula:'C₅H₁₀O₅', class:'sugar',
      names:['O4','C1','C2','C3','C4','O1','HO1','O2','HO2','O3','HO3','C5','O5','HO5','H1','H2','H3','H4','H51','H52'],
      smiles:'OC[C@H]1O[C@@H](O)[C@H]([OH:1])[C@@H]1O',
      stereo:{ faces:FACES },
      view:VIEW.furanose,
      optH:r.CH,
      contrast:{ pair:'ribose-deoxyribose', partner:'deoxyribose',
        differs:'one –OH at 2′',
        lesson:'why DNA is the stable archive',
        diff:[r.o2, r.ohH(r.o2)],
        align:r.RING,
        note:'The 2′–OH is the reactive one: it can attack the backbone next door, '
           + 'which is why RNA self-cleaves in minutes to hours. Useful for a '
           + 'short-lived message.' } });

    const d=riboFuranose(true);
    CONTRAST.deoxyribose=d.s.spec({ name:'Deoxyribose', formula:'C₅H₁₀O₄', class:'sugar',
      names:['O4','C1','C2','C3','C4','O1','HO1','H21','O3','HO3','C5','O5','HO5','H1','H22','H3','H4','H51','H52'],
      smiles:'OC[C@H]1O[C@@H](O)[CH2:1][C@@H]1O',
      // C2′ carries no heavy substituent at all now, so it drops out of the face
      // declaration — asserting a face for an atom that isn't there would pass
      // vacuously and tell us nothing.
      stereo:{ faces:{ 1:'a', 3:'b', 4:'a' } },
      view:VIEW.furanose,
      optH:d.CH,
      contrast:{ pair:'ribose-deoxyribose', partner:'ribose',
        differs:'one –OH at 2′',
        lesson:'why DNA is the stable archive',
        diff:[d.h2],
        align:d.RING,
        note:'Take that one oxygen away and the backbone has nothing to attack '
           + 'itself with. DNA lasts — readably — for tens of thousands of years.' } });
  }
  {
    // — purine and pyrimidine, the two parent ring systems. Named as the parents
    //   rather than as adenine/thymine on purpose (SCIENCE.md rule 1): the claim
    //   being made is about ring COUNT and width, and dressing them up with
    //   substituents would add features this page does not check.
    //
    //   Both rings are drawn as regular polygons — a ~4% idealisation, since real
    //   C–N (1.34 Å) is a little shorter than C–C (1.39 Å). That is deliberate:
    //   the lesson is the two-ring vs one-ring WIDTH, and a regular polygon makes
    //   that width read cleanly without changing it meaningfully.

    // pyrimidine: one six-ring, N1 C2 N3 C4 C5 C6 at indices 0…5
    const p=flatRing(6, ['N','C','N','C','C','C']);
    p.order(0,1,2).order(2,3,2).order(4,5,2);      // one Kekulé structure
    const pH=[1,3,4,5].map(i=>flatH(p,i,AR.CH));
    CONTRAST.pyrimidine=p.spec({ name:'Pyrimidine', formula:'C₄H₄N₂', class:'base',
      names:['N1','C2','N3','C4','C5','C6','H2','H4','H5','H6'],
      smiles:'c1nc[cH:1][cH:1]n1',
      topology:{ rings:[6] },
      view:VIEW.flatRing,
      contrast:{ pair:'purine-pyrimidine', partner:'purine',
        differs:'one ring vs two',
        lesson:'why A–T and G–C are equal width',
        // The C4–C5 edge and its two hydrogens: on purine this exact edge is
        // where the second ring is fused. Highlighting a plain edge on one side
        // and a whole fused ring on the other is what makes the absence visible
        // — a pyrimidine's difference from a purine is something it does NOT have.
        diff:[3,4,pH[1],pH[2]],
        note:'C and T are pyrimidines — one ring, the narrow ones. Where purine '
           + 'carries a second ring, this edge just carries two hydrogens.' } });

    // purine: the same six-ring with an imidazole fused across C4–C5.
    // Indices 0…5 = N1 C2 N3 C4 C5 C6, then 6,7,8 = N7 C8 N9.
    const q=flatRing(6, ['N','C','N','C','C','C']);
    const five=fuseRing(q, 5, 3, 4, V(0,0,0), ['N','C','N']);   // N7, C8, N9
    q.order(0,1,2).order(2,3,2).order(4,5,2);      // six-ring, same Kekulé form
    q.order(five[0],five[1],2);                    // N7=C8
    const qH=[1,5,five[1]].map(i=>flatH(q,i,AR.CH));
    qH.push(flatH(q,five[2],AR.NH));               // N9–H, the 9H tautomer
    CONTRAST.purine=q.spec({ name:'Purine', formula:'C₅H₄N₄', class:'base',
      names:['N1','C2','N3','C4','C5','C6','N7','C8','N9','H2','H6','H8','H9'],
      smiles:'c1nc[c:1]2[n:1][cH:1][nH:1][c:1]2n1',
      topology:{ rings:[5,6], fused:true },
      view:VIEW.flatRing,
      contrast:{ pair:'purine-pyrimidine', partner:'pyrimidine',
        differs:'one ring vs two',
        lesson:'why A–T and G–C are equal width',
        diff:[3,4,...five, ...qH.slice(2)],
        note:'A and G are purines — two fused rings, the wide ones. Every base pair '
           + 'is one wide plus one narrow, so the DNA ladder keeps a constant 2 nm '
           + 'rung. Two purines would bulge; two pyrimidines would pinch.' } });
  }
  {
    // — D-alanine: the exact mirror image of `alanine` above, not a rotation.
    // Negating one coordinate component is a reflection (determinant -1), which
    // flips every CIP-priority signed volume without touching a single bond
    // length or angle — the same trick check-molecules.js's comment on the
    // chirality check describes ("negated one output component"). Z is chosen
    // arbitrarily; any single axis works.
    const mirror=p=>[p[0],p[1],-p[2]];
    CONTRAST.dAlanine={ name:'D-Alanine', formula:'C₃H₇NO₂', class:'aminoacid',
      // Reflection of `alanine` (determinant -1), computed at load time, so it
      // inherits alanine's provenance and cannot drift from it.
      // Mirrors MOLECULES.alanine, which register() has already scaled — so
      // these coordinates are scene units, not Angstroms. Scaling again would
      // double it.
      units:'scene',
      src:{path:'mirror', of:'alanine', axis:'z'},
      res:'D-Ala', side:'–CH₃',
      atoms:MOLECULES.alanine.atoms.map(a=>({ el:a.el, pos:mirror(a.pos) })),
      names:['N','H','H2','CA','HA','C','O','OXT','HXT','CB','HB1','HB2','HB3'],
      smiles:'O=[C:1](O)[C@@H:1]([CH3:1])[NH2:1]',
      bonds:MOLECULES.alanine.bonds.map(b=>b.slice()),
      optH:MOLECULES.alanine.optH.slice(),
      chirality:'D',   // asserted by check-molecules.js — the mirror life doesn't use
      pep:{ cC:5, oOH:7, hOH:8, nN:0, hN:[1,2] },
      contrast:{ pair:'alanine-D-alanine', partner:'alanine',
        differs:'handedness',
        lesson:'why life is homochiral',
        diff:['CA','N','HA','C','CB'],
        note:'Same four groups on Cα as L-alanine — amino, carboxyl, H, methyl — '
           + 'just mirrored. Bacteria use D-alanine to cross-link cell walls, and it '
           + 'turns up in a few peptide antibiotics, but no ribosome on Earth reads it.' } };
  }
  {
    // — proline: the one amino acid whose side chain bonds BACK to its own
    //   backbone nitrogen, closing a 5-membered ring (N-Ca-Cb-Cg-Cd-N). Every
    //   other residue's backbone follows the fixed order this file documents
    //   at the top of the amino-acid section (0 N, 1 H, 2 H, 3 Ca, …) because
    //   the amino N carries TWO hydrogens — a primary amine. Proline's N is
    //   secondary (one H, one ring bond), so slot 2 — normally the second
    //   amino H — holds Cδ instead, and Cδ's own two hydrogens land at the
    //   tail (15, 16). `pep.hN` is therefore a ONE-element array, not two:
    //   documentation of the difference, not a page hookup — proline is not
    //   in aminoacid-lab.html's AA_KEYS, so nothing ever reads hN[1] on it.
    //
    //   Real PubChem 3D conformer (CID 145742, L-proline), reindexed by hand
    //   into the above order and run through sdf2spec.js's own reframe()
    //   (recentre on Ca, backbone N->C -> +X, side chain -> -Y, the same
    //   1.9x SCALE). check-molecules.js's
    //   chirality check (CA_IDX 3, R_IDX 9 — both land on the right atoms
    //   under this reindexing) confirms the geometry is L, as it must be:
    //   ribosomes only ever build with proline's one hand.
    //
    //   contrast-lab.html: paired with glycine, not alanine — alanine's
    //   `contrast` slot is already spoken for by D-alanine, and glycine (no
    //   side chain beyond H) makes the cleaner point anyway: even the
    //   plainest possible amino acid still has a free N-H. Proline does not.
    CONTRAST.proline={ name:'Proline', formula:'C₅H₉NO₂', class:'aminoacid', res:'Pro', side:'ring to N',
      // The one spec whose extra step was written down. reindex:'by-hand' is
      // load-bearing: sdf2spec.js THROWS on proline (its reindex assumes two H
      // on the amino N), so only reframe() was used. Anything that regenerates
      // this must reproduce the hand reindex or hit the same TypeError.
      // The .sdf is committed and the conformer pinned, but `regen:'manual'` is
      // the honest ceiling: sdf2spec.js still throws on this record (verified
      // again 2026-07-30), so the committed file documents the SOURCE without
      // making the spec re-derivable. Reproducing it means repeating the hand
      // reindex described above.
      units:'angstrom',
      src:{path:'pubchem', cid:145742, record:'3d',
           conformer:'0002394E00000001', sdf:'proline.sdf',
           tool:'sdf2spec:reframe-only', reindex:'by-hand',
           regen:'manual', fetched:'2026-07-30'},
      atoms:[ {el:'N',pos:[-1.1784,0.4747,-0.7253]},
              {el:'H',pos:[-1.0163,1.3679,-1.1863]},
              {el:'C',pos:[-1.5289,-0.5705,-1.6816]},
              {el:'C',pos:[0,0,0]},
              {el:'H',pos:[0.0111,0.4184,1.0116]},
              {el:'C',pos:[1.2216,0.4747,-0.7253]},
              {el:'O',pos:[1.2147,1.1511,-1.7432]},
              {el:'O',pos:[2.3458,0.0489,-0.0989]},
              {el:'H',pos:[3.1579,0.3484,-0.5605]},
              {el:'C',pos:[-0.1026,-1.5216,0]},
              {el:'H',pos:[-0.2768,-1.9095,1.01]},
              {el:'H',pos:[0.7958,-2.0095,-0.3947]},
              {el:'C',pos:[-1.2979,-1.8411,-0.89]},
              {el:'H',pos:[-1.1132,-2.7058,-1.5347]},
              {el:'H',pos:[-2.1726,-2.0658,-0.2668]},
              {el:'H',pos:[-0.8747,-0.5332,-2.56]},
              {el:'H',pos:[-2.5658,-0.4789,-2.0168]} ],
      names:['N','H','CD','CA','HA','C','O','OXT','HXT','CB','HB1','HB2','CG','HG1','HG2','HD1','HD2'],
      smiles:'O=C(O)[C@@H]1CC[CH2:1][NH:1]1',
      bonds:[ [0,1],[0,2],[0,3],[2,15],[2,16],[3,4],[3,5],[3,9],
              [5,6,2],[5,7],[7,8],[9,10],[9,11],[9,12],[12,2],[12,13],[12,14] ],
      optH:[4,10,11,13,14,15,16],   // nonpolar C–H, hidden by the lab's H toggle
      chirality:'L',   // asserted by check-molecules.js — life is homochiral
      pep:{ cC:5, oOH:7, hOH:8, nN:0, hN:[1] },   // one amino H, not two — see note above
      contrast:{ pair:'glycine-proline', partner:'glycine',
        differs:'ring-closed vs free amino N',
        lesson:'why gluten resists digestion',
        diff:['N','H','CD'],
        note:'Every other amino acid’s backbone nitrogen carries a free N–H, and the '
           + 'chain around it can flex into the extended shape a protease has to '
           + 'grip. Proline’s side chain bonds back into that nitrogen: no free N–H, '
           + 'and a stiff kink the enzyme cannot accommodate. Gliadin is unusually '
           + 'proline-rich, so those bonds pass through your gut uncut.' } };
  }
  {
    // — glutamine / glutamic acid: the second half of the gluten story. The edit
    //   is at the tip of the side chain only — amide –NH2 becomes –OH, so an N
    //   is replaced by an O and one H drops (C5H10N2O3 -> C5H9NO4). The lab's
    //   `ask` calls this "one atom" because the swap is what you SEE; the lost H
    //   is one of the two amide H's and is not separately visible.
    //
    //   Tissue transglutaminase (tTG) deamidates a glutamine side chain: the
    //   terminal amide –NH2 becomes an –OH, neutral becomes negative at gut pH.
    //   That single swap is what turns an undigested gliadin fragment into
    //   something HLA-DQ2/DQ8 binds tightly enough to trigger a T-cell response
    //   — see the `contrast` notes below. The proline pair explains why the
    //   fragment survives the gut at all; this pair explains why the survivor
    //   becomes an antigen.
    //
    //   Both are real PubChem 3D conformers (CID 5961 L-glutamine, CID 33032
    //   L-glutamic acid) run through tools/sdf2spec.js — no hand reindexing,
    //   unlike proline, though glutamine did force the backbone-N fix in that
    //   tool's reindex(): it is the first residue here with TWO nitrogens, and
    //   the SDF lists the side-chain amide N first.
    //
    //   The two carry the same ELEMENT in the same slot all the way to index 16
    //   (backbone 0-8, then Cb 9, Cg 10, its H 11/12, Cd 13, its H 14/15), and
    //   diverge only at the tail: glutamine 16 O(=), 17 N, 18/19 amide H;
    //   glutamic acid 16 O(-H), 17 O(=), 18 hydroxyl H. That alignment is an
    //   indexing convenience, not the visual effect — it keeps `diff` and `pep`
    //   reading the same slots on both, nothing more. What the eye actually
    //   responds to is the pose, set further down. Same slots also does NOT mean
    //   same coordinates: these are two independent conformers whose positions
    //   differ from index 1 on. `diff` marks only the group that changes — the
    //   carbonyl O is common to both, and highlighting it would overstate the
    //   edit.
    //
    //   VIEW TUNING: both are then rotated about X — the backbone axis reframe()
    //   already fixed — by +18.00° (Gln) and +17.75° (Glu). Straight out of the
    //   converter the side chain curled toward the camera and Cb/Cg drew as one
    //   blob with the terminal group hidden behind them; each angle is the one
    //   that flattened that molecule's heavy atoms best. Rotation about a fixed
    //   axis is chirality-preserving, so check-molecules.js still reads both as
    //   L; only the pose changes, never a length or an angle. Constrained to the
    //   root that keeps the side chain pointing -Y: the other z-minimum is ~180°
    //   away and would flip one chain up and the other down.
    //
    //   Then the terminal group is turned about the Cg-Cd bond (atoms 10->13) by
    //   -84.75° (Gln) and -89.50° (Glu). That bond is a freely rotating single
    //   bond, so this picks a different SIDE-CHAIN ROTAMER — a conformation the
    //   real residue samples constantly — rather than editing any length or
    //   angle. It is the one change here that is not a pure view transform, and
    //   it earns its place: in the PubChem rotamer the amide sits edge-on to the
    //   camera and the N hides behind the carbonyl O, which is precisely the
    //   atom the whole pair exists to show. After the turn every non-bonded pair
    //   of heavy atoms clears by at least 0.50 in screen XY.
    //
    //   Both angles are additionally constrained to put the carbonyl O on the
    //   RIGHT and the group that actually differs (Gln's –NH2, Glu's –OH) on the
    //   LEFT, so the eye lands on the same spot in either panel and sees one
    //   substitution. This is what makes the pair read as one molecule edited;
    //   unconstrained, the two best-scoring rotamers splay opposite ways.
    //
    //   Drawn NEUTRAL (side chain as –COOH, not –COO–), matching every other
    //   amino acid in this file and `palmitate`'s 'Palmitic acid' naming. The
    //   lesson is the amide->acid swap; the ionisation that follows from it is
    //   named in the note rather than drawn.
    CONTRAST.glutamine={ name:'Glutamine', formula:'C₅H₁₀N₂O₃', class:'aminoacid', res:'Gln', side:'–CH₂CH₂CONH₂',
      // conformer:null is the ACTIVE claim here, and 2026-07-30 made it worse
      // rather than better. ALL TEN currently-published conformers of CID 5961
      // were fetched and converted; none reproduces this spec (best |Δ| 6.357,
      // default record 7.056). The deviation climbs outward from the backbone
      // (N 0.5 → NE2 5.3 → terminal H 7.1): the backbone reproduces, the
      // flexible tail does not, and the tail is where this spec's lesson lives.
      //
      // So the source geometry is LOST — PubChem regenerates conformer sets, and
      // whichever one this came from is no longer published. sdf/glutamine.sdf is
      // committed as the closest available record, NOT as a reproduction; that is
      // what regen:'lost' means. THIS SPEC IS NOW ITS OWN SOURCE. Do not
      // 'refresh' it from PubChem — you would silently swap the rotamer, and the
      // amide's edge-on presentation that the contrast lesson depends on is a
      // property of THIS conformer.
      units:'angstrom',
      src:{path:'pubchem', cid:5961, record:'3d', conformer:null,
           sdf:'glutamine.sdf', tool:'sdf2spec', regen:'lost',
           fetched:'2026-07-30'},
      atoms:[ {el:'N',pos:[-1.1737,0.3363,-0.8058]},
              {el:'H',pos:[-1.1547,-0.1737,-1.6879]},
              {el:'H',pos:[-1.1516,1.3258,-1.0495]},
              {el:'C',pos:[0,0,0]},
              {el:'H',pos:[-0.0021,0.6584,0.8768]},
              {el:'C',pos:[1.2416,0.3363,-0.8058]},
              {el:'O',pos:[1.2516,0.7332,-1.9637]},
              {el:'O',pos:[2.38,0.1637,-0.0837]},
              {el:'H',pos:[3.1805,0.3879,-0.6042]},
              {el:'C',pos:[-0.0384,-1.4621,0.4753]},
              {el:'C',pos:[-0.1305,-2.53,-0.6211]},
              {el:'H',pos:[0.85,-1.6674,1.0868]},
              {el:'H',pos:[-0.8968,-1.5805,1.1505]},
              {el:'C',pos:[-0.2784,-3.9421,-0.0963]},
              {el:'H',pos:[-0.9963,-2.34,-1.2658]},
              {el:'H',pos:[0.7663,-2.4937,-1.2511]},
              {el:'O',pos:[0.69,-4.6295,0.2174]},
              {el:'N',pos:[-1.5826,-4.3758,-0.0279]},
              {el:'H',pos:[-2.3637,-3.7879,-0.3]},
              {el:'H',pos:[-1.8063,-5.3079,0.3032]} ],
      names:['N','H','H2','CA','HA','C','O','OXT','HXT','CB','CG','HB1','HB2','CD','HG1','HG2','OE1','NE2','HE21','HE22'],
      smiles:'N[C@@H](CCC(=O)[NH2:1])C(=O)O',
      bonds:[ [0,1],[0,2],[0,3],[3,4],[3,5],[3,9],[5,6,2],[5,7],[7,8],
              [9,10],[9,11],[9,12],[10,13],[10,14],[10,15],[13,16,2],[13,17],[17,18],[17,19] ],
      optH:[4,11,12,14,15],   // nonpolar C–H; the amide N–H at 18/19 are donors, never optional
      chirality:'L',   // asserted by check-molecules.js — life is homochiral
      pep:{ cC:5, oOH:7, hOH:8, nN:0, hN:[1,2] },
      contrast:{ pair:'glutamine-glutamate', partner:'glutamate',
        differs:'side-chain amide vs acid',
        lesson:'how gluten becomes an antigen',
        diff:['NE2','HE21','HE22'],
        note:'Gliadin is glutamine-rich as well as proline-rich. This side chain '
           + 'ends in an amide — neutral, and nothing your immune system objects to. '
           + 'An enzyme in your gut wall swaps that –NH₂ for an –OH.' } };
    CONTRAST.glutamate={ name:'Glutamic acid', formula:'C₅H₉NO₄', class:'aminoacid', res:'Glu', side:'–CH₂CH₂COOH',
      // Same as glutamine, and checked the same way: all ten published
      // conformers of CID 33032 fetched and converted 2026-07-30, none
      // reproducing this spec (best |Δ| 5.827). Note these two are INDEPENDENT
      // conformers, not one spec edited into the other, which is why their
      // shared atoms do not share coordinates — and why losing the source hits
      // them separately. This spec is now its own source; see glutamine.
      units:'angstrom',
      src:{path:'pubchem', cid:33032, record:'3d', conformer:null,
           sdf:'glutamate.sdf', tool:'sdf2spec', regen:'lost',
           fetched:'2026-07-30'},
      atoms:[ {el:'N',pos:[-1.1711,0.3311,-0.8089]},
              {el:'H',pos:[-1.1858,1.3332,-0.9974]},
              {el:'H',pos:[-2.0195,0.1284,-0.2821]},
              {el:'C',pos:[0,0,0]},
              {el:'H',pos:[-0.0047,0.6579,0.8768]},
              {el:'C',pos:[1.2416,0.3311,-0.8089]},
              {el:'O',pos:[1.2495,0.7226,-1.9695]},
              {el:'O',pos:[2.3805,0.1411,-0.0926]},
              {el:'H',pos:[3.1821,0.3532,-0.6168]},
              {el:'C',pos:[-0.0132,-1.4647,0.4689]},
              {el:'C',pos:[0.1268,-2.5258,-0.6263]},
              {el:'H',pos:[-0.9363,-1.6532,1.0337]},
              {el:'H',pos:[0.8032,-1.6047,1.1905]},
              {el:'C',pos:[0.2042,-3.9379,-0.1021]},
              {el:'H',pos:[-0.73,-2.4705,-1.3058]},
              {el:'H',pos:[1.0421,-2.3463,-1.2011]},
              {el:'O',pos:[-1.0042,-4.5553,-0.0789]},
              {el:'O',pos:[1.24,-4.4716,0.2742]},
              {el:'H',pos:[-0.9411,-5.47,0.2695]} ],
      names:['N','H','H2','CA','HA','C','O','OXT','HXT','CB','CG','HB1','HB2','CD','HG1','HG2','OE2','OE1','HE2'],
      smiles:'N[C@@H](CCC(=O)[OH:1])C(=O)O',
      bonds:[ [0,1],[0,2],[0,3],[3,4],[3,5],[3,9],[5,6,2],[5,7],[7,8],
              [9,10],[9,11],[9,12],[10,13],[10,14],[10,15],[13,16],[13,17,2],[16,18] ],
      optH:[4,11,12,14,15],   // nonpolar C–H; the hydroxyl H at 18 is a donor, never optional
      chirality:'L',   // asserted by check-molecules.js — life is homochiral
      pep:{ cC:5, oOH:7, hOH:8, nN:0, hN:[1,2] },
      contrast:{ pair:'glutamine-glutamate', partner:'glutamine',
        differs:'side-chain acid vs amide',
        lesson:'how gluten becomes an antigen',
        diff:['OE2','HE2'],
        note:'The same residue after that swap: an oxygen where the amide nitrogen '
           + 'was, giving up its H and leaving the side chain negative. The immune '
           + 'receptor nearly everyone with celiac disease carries grips exactly this '
           + 'charge — and ignores the neutral version.' } };
  }
  {
    // — palmitoleate: palmitate's exact carbon count (16) with one cis C=C at
    // Δ9 (atoms 8,9 here — C9=C10 in 1-indexed chemistry numbering), the real
    // structure of palmitoleic acid. Built the same way palmitate was — a flat,
    // schematic, real-angle zigzag (MolecularGeometry.md §1.6) — not a PubChem conformer,
    // so the two sit in the exact same visual language and only the one
    // feature differs.
    //
    // A cis double bond is invisible to bond length/angle alone: both cis and
    // trans use the same C=C length (GL.CdC) and the same ~120° angles at each
    // alkene carbon (`SP2` below vs the chain's usual `TET`) — only the
    // TORSION about the C=C differs, which is exactly what `cis:` asserts
    // (see check-molecules.js). Geometrically, the two backbone carbons
    // flanking the double bond are folded to the SAME side of it (dihedral
    // 0°) rather than continuing the ordinary alternating zigzag (which would
    // read trans, dihedral 180°) — worked out and verified against the
    // dihedral formula before being baked in as literals here, the same way
    // the VIEW angles were.
    //
    // The carboxyl head (atoms 16,17,18) is copied verbatim from palmitate's,
    // offset onto this spec's own C0 — the two chains start identically for
    // eight carbons, so the head sits in exactly the same place relative to
    // C0 in both molecules.
    const chain=[
      [0,0], [1.2574,0.8889], [2.5153,0], [3.7726,0.8889], [5.0305,0],
      [6.2879,0.8889], [7.5458,0], [8.8032,0.8889], [10.0611,0],
      [11.2689,0.5568], [11.41,2.0905], [12.9026,2.4695], [13.0432,4.0032],
      [14.5358,4.3821], [14.6768,5.9158], [16.1695,6.2947],
    ];
    CONTRAST.palmitoleate={ name:'Palmitoleic acid', formula:'C₁₆H₃₀O₂', class:'lipid',
      // Built exactly as palmitate was, and for the same reason — the pair must
      // sit in one visual language so the single cis C=C is the only difference.
      // The cis torsion was worked out against the dihedral formula and verified
      // before being written as literals; `cis:` asserts it at check time.
      units:'angstrom',
      src:{path:'built', method:'all-anti zigzag, united-atom, one cis C=C at Δ9',
           charge:0, like:'palmitate'},
      atoms:[
        ...chain.map(p=>({ el:'C', pos:[p[0],p[1],0] })),
        { el:'O', pos:[-1.1174,0.5147,0] },
        { el:'O', pos:[0.1242,-1.3542,0] },
        { el:'H', pos:[1.0705,-1.5684,0] },
      ],
      names:['C1','C2','C3','C4','C5','C6','C7','C8','C9','C10','C11','C12','C13','C14','C15','C16','O1','O2','HO2'],
      smiles:'CCCCC[CH2:1]/[CH:1]=[CH:1]\\[CH2:1]CCCCCCC(=O)O',
      // SmilesDrawer lays this chain out kinking DOWN; the coordinates above
      // kink UP. Mirror the flat panel so the two views agree about which way
      // the chain bends — the model is the geometry that is asserted, so it is
      // the drawing that moves, not the molecule. Safe here only because
      // nothing in this molecule is chiral: a cis C=C reflects to a cis C=C.
      flatFlipY:true,
      bonds:[ [0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9,2],[9,10],
              [10,11],[11,12],[12,13],[13,14],[14,15],[0,16,2],[0,17],[17,18] ],
      hydrophobic:[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],
      cis:{ atoms:[7,8,9,10], value:true },   // asserted by check-molecules.js
      contrast:{ pair:'palmitate-palmitoleate', partner:'palmitate',
        differs:'one C=C, cis',
        lesson:"why butter is solid and oil is not",
        diff:['C8','C9','C10','C11'],
        note:'One cis double bond, and the whole back half of the chain bends '
           + 'away. That kink is why vegetable oil stays liquid in the fridge: a '
           + 'bent chain cannot stack flush against its neighbours the way a '
           + 'straight one does.' } };
  }
  {
    // — maltose and cellobiose: two glucoses joined C1→C4, and the ONLY
    //   difference between them is whether that link leaves the anomeric carbon
    //   axial (α, starch) or equatorial (β, cellulose). Named as the
    //   disaccharides rather than as "starch" and "cellulose" on purpose
    //   (SCIENCE.md rule 1): a polymer's coil-vs-ribbon shape is an emergent
    //   property of many repeats, and drawing two repeats does not earn the
    //   polymer's name. What IS rendered exactly is the linkage, which is the
    //   whole lesson — maltose is starch's repeat, cellobiose is cellulose's.
    //
    //   Both residues are built by the same two functions, in the same order,
    //   from the same `ringPyranose()` as glucose — so the pair cannot drift
    //   apart into some difference that is not the difference. `alpha` reaches
    //   exactly one call: which slot at C1 the bridging oxygen takes.
    //
    //   The glycosidic linkage is declared (`glycosidic:`, a new claim type)
    //   and check-molecules.js fails if the geometry disagrees — α and β differ
    //   by nothing a bond length, a bond angle or a render can see, exactly the
    //   class of error MolecularGeometry.md §1.3 is about.
    //
    //   The two TORSIONS about the linkage (φ about C1–O, ψ about O–C4) ARE now
    //   asserted, and each molecule has its own. They are not quoted from a
    //   paper — published φ/ψ come in several conventions and a number copied
    //   without its convention is unfalsifiable. They are SOLVED, by
    //   tools/solve-linkage.js, for the pair whose repeat reproduces the helix
    //   the real polymer forms. The citation is therefore the polymer parameter,
    //   which a textbook states unambiguously and `helix:` below re-measures.
    //
    //   This replaces a shared pair of schematic values. Sharing them made every
    //   visible difference between the two cards trace to the α/β choice, which
    //   was right for a two-residue contrast — but it also meant the torsions
    //   carried no polymer information, so repeating the linkage gave both
    //   sugars the same near-straight chain and starch would not coil.
    //   chain/glucose-chains-test.html is the record of that.
    //
    //   Swept for NEAR-COPLANAR RING PLANES (0.87 of parallel), which is both the
    //   extended shape real maltose and cellobiose take and the only family of
    //   poses a single camera can present: with the two ring planes at right
    //   angles — which a pose picked for clearance alone happily gives — no
    //   viewing angle exists that shows both rings as chairs, and the second
    //   residue renders as a blob whatever VIEW.disaccharide does. That was the
    //   first version's mistake, and the page's whole claim is "same molecule
    //   except here", which cannot survive one half being unreadable.
    //
    //   THE PAIR NO LONGER SHARES A POSE, and the difference between the two
    //   cards is now larger than the α/β flip alone: each sits at the torsion its
    //   own polymer takes. What keeps that honest is that neither was chosen by
    //   eye — both come out of a search against a published helix, and
    //   chain/check-chain.js fails if a rebuilt spec stops reproducing it.
    //
    //   MALTOSE IS TIGHT, on purpose. Every pose that reproduces V-amylose's
    //   six-fold helix clears non-bonded pairs by about 0.03 in this library's
    //   radii, against cellobiose's 0.16. That is not a near-miss to fix: the
    //   amylose helix IS compact — compact enough to hold iodine, which is what
    //   the starch test is — and palette.js's radii are stylised and enlarged for
    //   legibility, so atoms this library draws as nearly touching are
    //   comfortably apart in the real sugar. It clears check-molecules.js's floor,
    //   which is the assertion that matters: spheres must not merge.
    const LINK = {
      // cellulose Iβ: 2.00 residues/turn, 5.32 Å rise (target 2 and 5.20)
      beta:  { phi:42*Math.PI/180,  spin:-180*Math.PI/180 },
      // V-amylose: 6.26 residues/turn, 1.43 Å rise (target 6 and 1.33)
      alpha: { phi:-31*Math.PI/180, spin:35*Math.PI/180 },
    };
    // spinAbout / alignTo / absorb now come from skel.js — every molecule built
    // from two joined sub-skeletons needs them, and ATP was the second caller.
    // `spin` above stays a knob here because the torsion it sets is this pair's
    // declared schematic, not something the builder should choose.

    // The residue that donates C1 — the non-reducing end. `alpha` picks the
    // anomeric slot: axial gives α-D-glucose (starch), equatorial gives β
    // (cellulose). Everything else is glucose's own all-equatorial pattern.
    // `gal` flips C4's hydroxyl to axial, which is the one thing that makes a
    // galactose out of a glucose — the same single substitution mol-contrast's
    // galactose spec above is built by.
    function donor(alpha, gal){
      const s=ringPyranose(), RING=[0,1,2,3,4,5], c1=1;
      const bo=s.grow(c1,'O',GL.CO,'sp3', alpha ? s.axial(c1,RING) : s.equatorial(c1,RING));
      const OH=[2,3,4].map(k=>s.hydroxyl(k,
        (gal && k===4) ? s.axial(k,RING) : s.equatorial(k,RING)));
      const c6=s.grow(5,'C',GL.CC,'sp3', s.equatorial(5,RING));
      OH.push(s.hydroxyl(c6,0));
      // C–H last, as everywhere else in this file: every index above stays put.
      // Each ring carbon has three bonds by now, so exactly one slot is free.
      const CH=[1,2,3,4,5].map(k=>s.grow(k,'H',GL.CH,'sp3',0));
      CH.push(s.grow(c6,'H',GL.CH,'sp3',0), s.grow(c6,'H',GL.CH,'sp3',0));
      return { s, RING, c1, bo, OH, c6, CH };
    }
    // The residue that accepts at C4 — the reducing end. Its C4 –OH is the one
    // the linkage replaced, so C4 carries the bridge instead (linked after the
    // rings are merged) and its H goes axial. `dir4` is the direction that bond
    // leaves in, captured BEFORE anything is grown on C4, and is what the
    // placement solves against.
    // `gal` puts the LINKAGE axial at C4 and sends H4 equatorial instead — the
    // two swap, because a galactose differs from a glucose by exactly which
    // side of the ring C4's oxygen is on, and here that oxygen is the bridge.
    function acceptor(gal){
      const s=ringPyranose(), RING=[0,1,2,3,4,5], c4=4;
      const dir4=s.freeTet(c4)[gal ? s.axial(c4,RING) : s.equatorial(c4,RING)];
      const h4=s.grow(c4,'H',GL.CH,'sp3', gal ? s.equatorial(c4,RING) : s.axial(c4,RING));
      const OH=[1,2,3].map(k=>s.hydroxyl(k, s.equatorial(k,RING)));
      const c6=s.grow(5,'C',GL.CC,'sp3', s.equatorial(5,RING));
      OH.push(s.hydroxyl(c6,0));
      const CH=[1,2,3,5].map(k=>s.grow(k,'H',GL.CH,'sp3',0));
      CH.push(s.grow(c6,'H',GL.CH,'sp3',0), s.grow(c6,'H',GL.CH,'sp3',0));
      // h4 belongs in the C–H list too — it is grown early only because C4's two
      // free slots have to be claimed before the linkage takes one of them.
      CH.push(h4);
      return { s, RING, c4, dir4, h4, OH, c6, CH };
    }
    /* `gal` says which residues are galactose rather than glucose, and it has to
     * be per-residue: galactobiose is both, LACTOSE is a galactose donor onto a
     * glucose acceptor. Passing `true` means both, which is the common case. */
    function disaccharide(alpha, tune, gal){
      const galD = gal===true || (gal && gal.donor);
      const galA = gal===true || (gal && gal.acceptor);
      const d=donor(alpha, galD), a=acceptor(galA);
      const { phi, spin } = tune || (alpha ? LINK.alpha : LINK.beta);
      /* The two torsions about the linkage, both continuous now. `phi` turns the
       * C4 direction about the C1–O bond and `spin` turns the second ring about
       * the O–C4 bond: between them they are the pair a carbohydrate chemist
       * calls φ/ψ. `phi` used to be a choice between the bridge oxygen's three
       * sp3 slots, which gave three angles 120° apart — coarse enough that no
       * real linkage conformation was reachable. Turning about the C1–O axis
       * keeps the C1–O–C4 angle tetrahedral by construction (real glycosidic O
       * is ~116°, a little wider) while letting φ take any value.
       */
      const axis=vnorm(vsub(d.s.at(d.bo), d.s.at(d.c1)));
      const out=spinAbout(d.s.freeTet(d.bo)[0], axis, phi);
      const c4Target=vadd(d.s.at(d.bo), vmul(out, GL.CO));
      // Carry the acceptor's own C4→O direction onto −out, so its C4 ends up
      // bonded to the bridge O and not merely near it, then spin about the new
      // bond to open the two rings away from each other.
      const rot=alignTo(a.dir4, vmul(out,-1));
      const c4Local=a.s.at(a.c4);
      a.s.atoms.forEach(at=>{
        const p=spinAbout(rot(vsub(V(at.pos[0],at.pos[1],at.pos[2]), c4Local)), out, spin);
        at.pos=[p.x+c4Target.x, p.y+c4Target.y, p.z+c4Target.z];
      });
      const off=absorb(d.s, a.s);
      d.s.link(d.bo, a.c4+off);
      const ohH=(s,o)=>{ const b=s.bonds.find(b=>(b[0]===o||b[1]===o)&&s.atoms[b[0]===o?b[1]:b[0]].el==='H');
        return b[0]===o?b[1]:b[0]; };
      return { s:d.s, d, a, off,
        c1:d.c1, bo:d.bo, c4:a.c4+off, c4d:4,
        optH:[...d.CH, ...a.CH.map(i=>i+off)],
        // the anomeric H — part of the difference, since it swaps places with
        // the bridge O when the configuration flips
        h1:d.CH[0],
        ohH:o=>ohH(d.s,o) };
    }

    /* Exposed for tools/solve-linkage.js, which searches φ/ψ for the pair that
     * reproduces a published helix. A tool that rebuilt this geometry itself
     * would be a second copy of the linkage, free to drift from the one the
     * specs are actually made of — which is the whole failure this repo keeps
     * writing checkers about. */
    Lib.BUILD = Lib.BUILD || {};
    Lib.BUILD.disaccharide = disaccharide;

    const m=disaccharide(true);
    CONTRAST.maltose=m.s.spec({ name:'Maltose', formula:'C₁₂H₂₂O₁₁', class:'sugar',
      names:['O5A','C1A','C2A','C3A','C4A','C5A','O1A','O2A','HO2A','O3A','HO3A','O4A','HO4A','C6A','O6A','HO6A','H1A','H2A','H3A','H4A','H5A','H6A1','H6A2','O5B','C1B','C2B','C3B','C4B','C5B','H4B','O1B','HO1B','O2B','HO2B','O3B','HO3B','C6B','O6B','HO6B','H1B','H2B','H3B','H5B','H6B1','H6B2'],
      smiles:'OC[C@H]1O[C@H:1]([O:1][C@H:1]2[C@H](O)[C@@H](O)[C@H](O)O[C@@H]2CO)[C@H](O)[C@@H](O)[C@@H]1O',
      // α: the bridge leaves C1 AXIAL. Every other substituent on both rings is
      // equatorial (glucose's own pattern), and the checker verifies that too —
      // `{axial:[…]}` is checked in both directions, per ring.
      stereo:{ axial:[m.c1] },
      glycosidic:{ anomeric:m.c1, bridge:m.bo, partner:m.c4, config:'alpha', link:'1→4' },
      // The polymer this linkage builds, and the reason its torsions are what
      // they are. Asserted by chain/check-chain.js, which repeats the linkage
      // and measures the screw that comes out.
      helix:{ polymer:'V-amylose', perTurn:6, rise:1.33,
              src:'six residues per turn, pitch ~8 Å' },
      view:VIEW.disaccharide,
      optH:m.optH,
      contrast:{ pair:'starch-cellulose', partner:'cellobiose',
        differs:'α- vs β-1,4 linkage',
        lesson:'why we can’t digest wood',
        diff:[m.c1, m.bo, m.c4, m.h1],
        note:'The bridge leaves C1 pointing axial — down, out of the ring plane. '
           + 'Chain these and the backbone has to curl: starch coils into a helix '
           + 'loose enough for amylase to reach in, which is why bread is food.' } });

    const c=disaccharide(false);
    CONTRAST.cellobiose=c.s.spec({ name:'Cellobiose', formula:'C₁₂H₂₂O₁₁', class:'sugar',
      names:['O5A','C1A','C2A','C3A','C4A','C5A','O1A','O2A','HO2A','O3A','HO3A','O4A','HO4A','C6A','O6A','HO6A','H1A','H2A','H3A','H4A','H5A','H6A1','H6A2','O5B','C1B','C2B','C3B','C4B','C5B','H4B','O1B','HO1B','O2B','HO2B','O3B','HO3B','C6B','O6B','HO6B','H1B','H2B','H3B','H5B','H6B1','H6B2'],
      smiles:'OC[C@H]1O[C@@H:1]([O:1][C@H:1]2[C@H](O)[C@@H](O)[C@H](O)O[C@@H]2CO)[C@H](O)[C@@H](O)[C@@H]1O',
      // β: the bridge is equatorial, so the whole molecule is all-equatorial —
      // the same declaration glucose itself carries, now over two rings.
      stereo:'all-equatorial',
      glycosidic:{ anomeric:c.c1, bridge:c.bo, partner:c.c4, config:'beta', link:'1→4' },
      helix:{ polymer:'cellulose Iβ', perTurn:2, rise:5.20,
              src:'two-fold ribbon, cellobiose repeat ~10.3–10.4 Å' },
      view:VIEW.disaccharide,
      optH:c.optH,
      contrast:{ pair:'starch-cellulose', partner:'maltose',
        differs:'α- vs β-1,4 linkage',
        lesson:'why we can’t digest wood',
        diff:[c.c1, c.bo, c.c4, c.h1],
        note:'The bridge leaves C1 equatorial — straight out, in the ring plane. '
           + 'Chain these and the backbone stays flat and straight: cellulose '
           + 'ribbons stack into fibres no human enzyme can open. Wood is glucose '
           + 'we cannot reach.' } });

    /* — GALACTOBIOSE, the repeat of β-1,4-galactan (the galactan side chains of
     *   pectin, in plant cell walls). It is here as the CONTROL the starch /
     *   cellulose pair cannot be.
     *
     *   Those two vary the DONOR's anomeric carbon: α or β at C1. This varies
     *   the ACCEPTOR's C4 instead. A galactose is a glucose with C4's oxygen on
     *   the other side of the ring, and in a 1→4 chain that oxygen IS the
     *   bridge — so the linkage leaves the second ring axially while staying
     *   β at C1. Two independent axial/equatorial choices, one at each end of
     *   the same bond, and this is the other one.
     *
     *   IT SHARES CELLOBIOSE'S TORSIONS ON PURPOSE, and that is the opposite of
     *   the decision made for maltose. Maltose needed its own φ/ψ because a
     *   published helix says what amylose does. No comparable figure is quoted
     *   here for pectic galactan, so rather than solve against a number this
     *   file cannot cite, the torsions are held FIXED at cellobiose's and the
     *   only thing allowed to differ is the substituent. Whatever the chain then
     *   does is attributable to that one flip and nothing else.
     *
     *   SO IT CARRIES NO `helix:`. The chain chain/glucose-chains-test.html
     *   draws from it is this model's PREDICTION, not a measured polymer, and
     *   the page has to say so. chain/check-chain.js only audits specs that declare a
     *   helix, so this one is deliberately outside it.
     */
    const gb=disaccharide(false, LINK.beta, {donor:true, acceptor:true});
    CONTRAST.galactobiose=gb.s.spec({ name:'Galactobiose', formula:'C₁₂H₂₂O₁₁', class:'sugar',
      names:['O5A','C1A','C2A','C3A','C4A','C5A','O1A','O2A','HO2A','O3A','HO3A','O4A','HO4A','C6A','O6A','HO6A','H1A','H2A','H3A','H4A','H5A','H6A1','H6A2','O5B','C1B','C2B','C3B','C4B','C5B','H4B','O1B','HO1B','O2B','HO2B','O3B','HO3B','C6B','O6B','HO6B','H1B','H2B','H3B','H5B','H6B1','H6B2'],
      // C4 axial on BOTH rings: the donor's free hydroxyl and the acceptor's
      // bridge. Everything else equatorial, exactly as in cellobiose — which is
      // the claim that this differs from that pair by one position.
      stereo:{ axial:[gb.c4d, gb.c4] },
      glycosidic:{ anomeric:gb.c1, bridge:gb.bo, partner:gb.c4, config:'beta', link:'1→4' },
      view:VIEW.disaccharide,
      optH:gb.optH });

    /* — LACTOSE, β-D-galactopyranosyl-(1→4)-D-glucose. The control this page's
     *   whole enzyme argument rests on, and the one sugar here that is NOT a
     *   polymer repeat.
     *
     *   It shares galactobiose's donor half exactly: the same β-1,4 bond, the
     *   same galactose giving C1, the same axial C4 on that ring. The only
     *   difference is what accepts — glucose instead of galactose. And you
     *   digest one and not the other: lactase cleaves this bond happily, while
     *   pectic galactan passes through as fibre. So a student who thinks an
     *   enzyme is reading the chain's SHAPE has to explain this pair, and
     *   cannot. Enzymes read the linkage and its neighbours, not the silhouette.
     *
     *   IT DOES NOT CHAIN, and that is a fact about the molecule rather than a
     *   gap in the model: the glucose's C4 is spent on the bridge and its C1 is
     *   the free reducing end, so there is no repeat to make. chain-repeat.js is
     *   never pointed at it, and the bench draws it as the single molecule it is.
     *
     *   Torsions pinned to cellobiose's, as galactobiose's are, so nothing about
     *   the comparison comes from a knob. No `helix:` — there is no helix.
     */
    const lac=disaccharide(false, LINK.beta, { donor:true, acceptor:false });
    CONTRAST.lactose=lac.s.spec({ name:'Lactose', formula:'C₁₂H₂₂O₁₁', class:'sugar',
      names:['O5A','C1A','C2A','C3A','C4A','C5A','O1A','O2A','HO2A','O3A','HO3A','O4A','HO4A','C6A','O6A','HO6A','H1A','H2A','H3A','H4A','H5A','H6A1','H6A2','O5B','C1B','C2B','C3B','C4B','C5B','H4B','O1B','HO1B','O2B','HO2B','O3B','HO3B','C6B','O6B','HO6B','H1B','H2B','H3B','H5B','H6B1','H6B2'],
      // Axial at the GALACTOSE's C4 only. The glucose half is ordinary
      // all-equatorial glucose, which is the difference from galactobiose and
      // the whole point of having both.
      stereo:{ axial:[lac.c4d] },
      glycosidic:{ anomeric:lac.c1, bridge:lac.bo, partner:lac.c4, config:'beta', link:'1→4' },
      view:VIEW.disaccharide,
      optH:lac.optH });
  }
  register(CONTRAST, SELFNAME);
})(this);
