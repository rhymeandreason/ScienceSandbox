/* =====================================================================
 *  mol-sugars.js — the monosaccharides, one family, one file
 * =====================================================================
 *  docs/molecules-wishlist.md's re-partition, first instalment. These four
 *  were in mol-contrast.js because they happen to appear beside each other on
 *  contrast-lab; that is a fact about a page, not about a molecule. Four pages
 *  that are not contrast-lab already load that file, and dna-lab needs exactly
 *  one sugar out of it — the cost failure the wishlist names.
 *
 *  Family B (real ångströms × SCALE), every one built by skel.js's ring
 *  builders. The `contrast:` blocks travel WITH the specs: contrast is a
 *  property of a molecule naming its partner, never a property of a file.
 *
 *  STILL TO MOVE HERE, when their files are dissolved: glucose (mol-pathways.js)
 *  and ascorbate (mol-vitamins.js). Until then this file is the sugar file
 *  without the sugar, and glycolysis-lab still gets glucose from where it is.
 * ===================================================================== */
(function(global){
  'use strict';
  const SELFNAME = 'mol-sugars.js';
  const Lib = global.MolLib
    || (typeof require === 'function' ? require('./molecules.js').MolLib : null);
  if (!Lib) throw new Error(SELFNAME + ': molecules.js must be loaded first');
  const { MOLECULES, VIEW, register } = Lib;
  const SkelLib = global.SkelLib
    || (typeof require === 'function' ? require('./skel.js').SkelLib : null);
  if (!SkelLib) throw new Error(SELFNAME + ': skel.js must be loaded first');
  const { GL, FURANOSE_UP, FURANOSE_DOWN, ringPyranose, ringFuranose } = SkelLib;

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
    //   It is a REAGENT in its own right, and the reason is chemical
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
      // Same two roles β-glucose declares (mol-pathways.js),
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
      // The two bonds that make this sugar a nucleotide, both condensations:
      // C1′'s anomeric –OH meets the base's N–H, and C5′'s –OH meets a
      // phosphate's P–OH. Declared here rather than on dna-lab because they are
      // facts about the sugar; the C3′–OH is deliberately absent, since the
      // bond it makes belongs to the strand and not to one nucleotide.
      condense:{ roles:[
        { key:'c1', label:'anomeric \u2013OH', keep:1,  leaves:[5, 6] },
        // C5\u2032 keeps its OXYGEN \u2014 the bridge in a phosphoester is the sugar's
        // O5\u2032, and it is the phosphate that gives up an \u2013OH. Keeping C5 here
        // would build the bond one atom short and still look like an ester.
        { key:'c5', label:'5\u2032 \u2013OH',      keep:11, leaves:[12] } ] },
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
  register(CONTRAST, SELFNAME);
})(typeof window !== 'undefined' ? window : globalThis);
