/* =====================================================================
 *  mol-sugars.js — the monosaccharides, one family, one file
 * =====================================================================
 *  docs/molecules-wishlist.md's re-partition, first instalment. These four
 *  were in the old mol-contrast.js because they happen to appear beside each other on
 *  contrast-lab; that is a fact about a page, not about a molecule. Four pages
 *  that are not contrast-lab already load that file, and dna-lab needs exactly
 *  one sugar out of it — the cost failure the wishlist names.
 *
 *  Family B (real ångströms × SCALE), every one built by skel.js's ring
 *  builders. The `contrast:` blocks travel WITH the specs: contrast is a
 *  property of a molecule naming its partner, never a property of a file.
 *
 *  ASCORBATE IS HERE AND IS NOT QUITE A SUGAR. It is a lactone built from a
 *  hexose — `class:'acid'` — and it had a file of its own, mol-vitamins.js, on
 *  the argument that a collagen page drawing it would otherwise parse seventeen
 *  glycolysis intermediates to reach one molecule. That argument was about
 *  mol-pathways.js and it expired when glucose moved here: reaching ascorbate
 *  now costs four small monosaccharides.
 *
 *  "Vitamin" was never a chemical class anyway. Retinol is a polyene, ascorbate
 *  a lactone, cobalamin a cobalt complex, and the one thing they share is a
 *  fact about US — the pathway that makes it is missing in this species, so it
 *  has to arrive in food. The same substance is a vitamin for a human and an
 *  ordinary metabolite for a dog. `essential:true` stays a flag on the spec,
 *  which is where a fact about the eater belongs.
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
  const { GL, FURANOSE_UP, FURANOSE_DOWN, ringPyranose, ringFuranose,
          flatRing } = SkelLib;

  const SUGARS = {};
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
    SUGARS.galactose=g.spec({ name:'Galactose', formula:'C₆H₁₂O₆', class:'sugar',
      names:['O5','C1','C2','C3','C4','C5','O1','HO1','O2','HO2','O3','HO3','O4','HO4','C6','O6','HO6','H1','H2','H3','H4','H5','H61','H62'],
      smiles:'OC[C@H]1O[C@@H](O)[C@H](O)[C@@H](O)[C@H:1]1[OH:1]',
      // C4 axial, every other substituent equatorial. `all-equatorial` here would
      // be glucose — and the render of the two is very nearly the same picture.
      stereo:{ axial:[C4] },
      view:VIEW.pyranose,       // the same object as glucose's — they cannot drift
      optH:CH,
      /* The same two half-reactions beta-glucose declares, reaching the other
         product: galactose is beta at C1 too, so its homo-dimer is the beta-1,4
         galactobiose. Indices come from the build variables, never typed.
         LACTOSE IS NOT LISTED HERE and that is not an omission: it is galactose
         donating onto GLUCOSE, so there is no "2 x this molecule" formula for
         check-molecules.js to verify. The pair is measured where the geometry
         is, in macromolecule/glycosidic.js's own table. */
      condense:{
        roles:[
          { key:'c1', label:'anomeric –OH', keep:OH[0], leaves:[ohH[0]] },
          { key:'c4', label:'C4 –OH',       keep:4,      leaves:[OH[3], ohH[3]] } ],
        makes:[ { product:'galactobiose', donor:'c1', acceptor:'c4',
                  config:'beta', invert:false } ] },
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
    SUGARS.alphaGlucose=g.spec({ name:'\u03b1-D-Glucose', short:'\u03b1-Glucose',
      // Laid out flat for macromolecule-builder.html's build stage: the
      // chain is assembled in the diagram, and the shape the linkage
      // forces — flat ribbon or helix — is what the 3D reveal is FOR.
      flat:true,
      flat2d:[[1.539,0],[0.77,-1.333],[-0.77,-1.333],[-1.539,0],[-0.77,1.333],[0.77,1.333],[1.539,-2.666],[-1.539,-2.666],[-3.079,0],[-1.539,2.666],[1.539,2.666],[3.079,2.666]],
      formula:'C\u2086H\u2081\u2082O\u2086', class:'sugar',
      names:['O5','C1','C2','C3','C4','C5','O1','HO1','O2','HO2','O3','HO3','O4','HO4','C6','O6','HO6','H1','H2','H3','H4','H5','H61','H62'],
      smiles:'OC[C@H]1O[C@H](O)[C@H](O)[C@@H](O)[C@@H]1O',
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
    SUGARS.ribose=r.s.spec({ name:'Ribose', formula:'C₅H₁₀O₅', class:'sugar',
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
    SUGARS.deoxyribose=d.s.spec({ name:'Deoxyribose', formula:'C₅H₁₀O₄', class:'sugar',
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
  /* ---------------------------------------------------------------------
   *  GLUCOSE
   * ---------------------------------------------------------------------
   *  Moved here out of mol-pathways.js. It was there because glycolysis starts
   *  with it, which is a fact about a pathway rather than about the molecule —
   *  and it left the sugar file without the sugar, so five pages that wanted
   *  one monosaccharide were parsing thirteen phosphorylated intermediates and
   *  two nucleotide carriers to get it.
   *
   *  glycolysis-lab now loads both files, deliberately. Six small
   *  monosaccharides cost it nothing next to the ATP it was already paying for
   *  (molecules-wishlist.md).
   *
   *  IT BELONGS BESIDE GALACTOSE. The two differ at exactly one hydroxyl and
   *  say so in each other's `contrast:` blocks; check-molecules.js asserts that
   *  difference, and a pair split across two files is a pair that drifts.
   * ------------------------------------------------------------------- */
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
    // them all in `optH`: glycolysis-lab hides optional H, a page that wants the
    // full formula shows it. A ring carbon has three bonds already, so
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
    SUGARS.glucose=g.spec({ name:'Glucose', short:'Glucose', formula:'C₆H₁₂O₆', charge:0, class:'sugar',
      // Laid out flat for macromolecule-builder.html's build stage: the
      // chain is assembled in the diagram, and the shape the linkage
      // forces — flat ribbon or helix — is what the 3D reveal is FOR.
      flat:true,
      flat2d:[[1.539,0],[0.77,-1.333],[-0.77,-1.333],[-1.539,0],[-0.77,1.333],[0.77,1.333],[1.539,-2.666],[-1.539,-2.666],[-3.079,0],[-1.539,2.666],[1.539,2.666],[3.079,2.666]],
      names:['O5','C1','C2','C3','C4','C5','O1','HO1','O2','HO2','O3','HO3','O4','HO4','C6','O6','HO6','H1','H2','H3','H4','H5','H61','H62'],
      smiles:'OC[C@H]1O[C@@H](O)[C@H](O)[C@@H](O)[C@@H:1]1[OH:1]',
      // asserted by check-molecules.js — the one property that no bond length,
      // bond angle or screenshot can confirm, and the one that makes it glucose
      stereo:'all-equatorial',
      view:VIEW.pyranose,
      optH:CH,                            // nonpolar C–H; the five O–H are never optional
      mono:'carbohydrate',                // the carbohydrate monomer of the four-class set
      gly:{ carbons:6, ring:true, cN:[...C,c6], phosphates:0,
            note:'β-D-glucopyranose — the ring form that dominates in water' },
      // functional-group index map, a curated captioned list — the same kind of
      // contract as `gly` above. Derived from the build variables,
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
      // the hydrolysis half needs (an enzyme runs this
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
      // starts from a different reagent, `alphaGlucose` in mol-sugars.js.
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

  /* ---------------------------------------------------------------------
   *  ASCORBATE — vitamin C
   * ---------------------------------------------------------------------
   *  IT IS AN ACID WITH NO CARBOXYL GROUP, and that is the whole reason to
   *  draw it rather than name it. The proton it loses (pKa 4.2, so it is
   *  ascorbATE at blood pH) comes off the hydroxyl on C3, and what makes
   *  that hydroxyl acidic is the C2=C3 double bond sitting between it and
   *  the C1 carbonyl: the anion left behind spreads its charge across all
   *  four atoms instead of holding it on one oxygen. Draw the ene-diol and
   *  the lactone with the right bond orders and a student can see why;
   *  draw it as a generic sugar-shaped blob and "vitamin C is an acid" is
   *  a fact to memorise.
   *
   *  AND IT IS A REDUCING AGENT, which is the job it does in collagen.
   *  Prolyl hydroxylase needs its iron ferrous; ascorbate is what puts the
   *  electron back after a stray oxidation. No ascorbate, no hydroxyproline,
   *  no interchain hydrogen bonds, and the triple helix slips — scurvy is
   *  collagen that cannot hold itself together.
   *
   *  THE RING IS A REGULAR PENTAGON, which is a deliberate idealisation:
   *  flatRing() builds every side at 1.39 Å, where the real molecule runs
   *  1.34 (C2=C3) to 1.46 (C4–O1). Planarity is the honest part and the
   *  part the lesson uses — the ring IS flat, because the ene-diol and the
   *  carbonyl are conjugated through it. Side lengths are within ~8%, which
   *  is the same licence every flat ring in this library takes (purine, the
   *  bases). The two stereocentres are NOT idealised away: see `smiles`.
   *
   *  L-ascorbic acid, so C4 is R and C5 is S. `check-molecules.js` cannot
   *  see this one — its signed-volume test is wired to `pep` — so the
   *  committed `smiles` and `tools/check-handedness.js` are what hold it.
   */
  {
    // Ring, in traversal order: O1 · C1 · C2 · C3 · C4. The lactone oxygen
    // bridges the carbonyl carbon and the one carrying the tail, which is what
    // makes this a γ-lactone rather than an open acid.
    const s = flatRing(5, ['O','C','C','C','C']);
    const O1=0, C1=1, C2=2, C3=3, C4=4;
    s.order(C2, C3, 2);                    // the ene- of the ene-diol

    // An sp2 hydroxyl: IN the ring plane, unlike Skel's tetrahedral one. On a
    // carbon of a C=C this is not decoration — the O's lone pair has to line up
    // with the double bond for the conjugation above to exist, and a hydroxyl
    // pushed out of plane draws a molecule that could not be acidic.
    const enolOH = i => { const o = s.grow(i,'O',GL.CO,'sp2',0);
                          s.grow(o,'H',GL.OH,'sp3',0); return o; };

    const oc1 = s.carbonyl(C1, 0);         // the lactone C=O
    const o2  = enolOH(C2);
    const o3  = enolOH(C3);                // the acidic one

    // The tail: C5 and C6, each with a hydroxyl. Both stereocentres are set
    // here, and neither is set by a number that looks like it means anything.
    //   C4 — it already has two ring bonds, so freeTet hands back the two slots
    //        straddling the ring plane; the tail takes one and C4's H the
    //        other, and which is which is the centre.
    //   C5 — its slots are all equivalent until something else lands (they are
    //        a rotation about C4–C5, i.e. a torsion, not a choice), so this
    //        centre is set by the ORDER of the two grows below. C6 before the
    //        hydroxyl is (5S); swapping the two lines builds D-ascorbate,
    //        which renders identically and is not a vitamin.
    // Both verified by tools/check-handedness.js against PubChem, which is the
    // only thing here that can see either of them.
    const C5 = s.grow(C4,'C',GL.CC,'sp3',0);
    const C6 = s.grow(C5,'C',GL.CC,'sp3',0);
    const o5 = s.hydroxyl(C5, 0);
    const o6 = s.hydroxyl(C6, 0);

    // C–H last, so every index above stays stable (glucose's discipline).
    const CH = [ s.grow(C4,'H',GL.CH,'sp3',0), s.grow(C5,'H',GL.CH,'sp3',0),
                 s.grow(C6,'H',GL.CH,'sp3',0), s.grow(C6,'H',GL.CH,'sp3',0) ];

    SUGARS.ascorbate = s.spec({
      name:'Vitamin C', formula:'C₆H₈O₆', class:'acid',
      names:['O1','C1','C2','C3','C4','OC1','O2','HO2','O3','HO3',
             'C5','C6','O5','HO5','O6','HO6','H4','H5','H61','H62'],
      // `flat` puts this spec under tools/spec2smiles.js, which GENERATES the
      // string below from the atoms above. Never hand-write it: a typed SMILES
      // is a second description of the molecule, free to drift from the
      // geometry it claims to describe. It also gives molecule-viewer.html its
      // flat2d and drawn tabs.
      flat:true,
      smiles:'O=C1O[C@H]([C@@H](O)CO)C(O)=C1O',
      // Baked by tools/bake-flat2d.js — the diagram layout the same spheres
      // slide onto in the viewer's second tab. An empty array is what gives
      // the generator somewhere to write; it is never typed either.
      flat2d:[[1.166,1.199],[0.335,2.343],[-1.011,1.906],[-1.011,0.491],[0.335,0.054],[0.772,3.689],[-2.156,2.738],[-2.156,-0.341],[0.772,-1.292],[-0.175,-2.343],[2.156,-1.586],[0.262,-3.689]],
      essential:true,                      // the flag the shelf is built from
      optH:CH,
      // Where the proton goes. Named because a card that animates the
      // ionisation has to find that oxygen, and counting from the ring is how
      // it ends up on the wrong one.
      acid:{ site:o3, pKa:4.2, note:'The C3 hydroxyl. Its anion delocalises '
           + 'through C2=C3 onto the C1 carbonyl, which is the whole of why a '
           + 'molecule with no –COOH is an acid.' },
      note:'We eat it because a gene died. Nearly every other mammal makes its '
         + 'own vitamin C from glucose; the last enzyme of that pathway, GULO, '
         + 'is still in the human genome as a wreck that codes for nothing. '
         + 'Scurvy is the bill for that deletion.' });
  }

  register(SUGARS, SELFNAME);
})(typeof window !== 'undefined' ? window : globalThis);
