/* =====================================================================
 *  mol-glycans.js — the disaccharides (family B, real ångströms)
 * =====================================================================
 *  Four sugars joined to four sugars, and each pair of them is an argument
 *  about ONE linkage: maltose against cellobiose is α- against β-1,4 and is
 *  the whole of why we can digest starch and not wood; lactose against
 *  galactobiose moves the same question onto galactose.
 *
 *  WHY THIS IS ITS OWN FILE. These four used to sit in mol-contrast.js beside
 *  proline and a fatty acid, grouped by "appear on contrast-lab". Five pages
 *  that are not contrast-lab wanted only these — amylase, chain/, chair/,
 *  capillary/ and macromolecule-builder — and were parsing an amino acid and a
 *  lipid to reach a disaccharide. That is the cost rule inverted: one page's
 *  convenience billed to everyone else (molecules.js's DOMAINS note).
 *
 *  WHAT DEPENDS ON THE NUMBERS HERE, and it is more than it looks. Each spec's
 *  φ/ψ are not decoration and not a schematic: they were SOLVED by
 *  tools/solve-linkage.js for the pair whose repeat reproduces the helix the
 *  real polymer forms, chain/check-chain.js re-measures that on every build,
 *  and macromolecule/glycosidic.js reads the linkage straight off these
 *  residues to place the next sugar a student drags on. Change a torsion here
 *  and cellulose stops being flat on a page that never mentions this file.
 *
 *  Needs skel.js: the rings come from the same `ringPyranose()` glucose does,
 *  which is what keeps a disaccharide's halves from drifting off the
 *  monosaccharide they are made of.
 * ===================================================================== */
(function(global){
  'use strict';
  const SELFNAME = 'mol-glycans.js';
  const Lib = global.MolLib
    || (typeof require === 'function' ? require('./molecules.js').MolLib : null);
  if (!Lib) throw new Error(SELFNAME + ': molecules.js must be loaded first');
  const { MOLECULES, VIEW, register } = Lib;
  const SkelLib = global.SkelLib
    || (typeof require === 'function' ? require('./skel.js').SkelLib : null);
  if (!SkelLib) throw new Error(SELFNAME + ': skel.js must be loaded first');
  const { GL, V, vadd, vsub, vmul, vnorm, spinAbout, alignTo, absorb,
          ringPyranose } = SkelLib;

  const GLYCANS = {};
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
    GLYCANS.maltose=m.s.spec({ name:'Maltose', formula:'C₁₂H₂₂O₁₁', class:'sugar',
      names:['O5A','C1A','C2A','C3A','C4A','C5A','O1A','O2A','HO2A','O3A','HO3A','O4A','HO4A','C6A','O6A','HO6A','H1A','H2A','H3A','H4A','H5A','H61A','H62A','O5B','C1B','C2B','C3B','C4B','C5B','H4B','O1B','HO1B','O2B','HO2B','O3B','HO3B','C6B','O6B','HO6B','H1B','H2B','H3B','H5B','H61B','H62B'],
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
    GLYCANS.cellobiose=c.s.spec({ name:'Cellobiose', formula:'C₁₂H₂₂O₁₁', class:'sugar',
      names:['O5A','C1A','C2A','C3A','C4A','C5A','O1A','O2A','HO2A','O3A','HO3A','O4A','HO4A','C6A','O6A','HO6A','H1A','H2A','H3A','H4A','H5A','H61A','H62A','O5B','C1B','C2B','C3B','C4B','C5B','H4B','O1B','HO1B','O2B','HO2B','O3B','HO3B','C6B','O6B','HO6B','H1B','H2B','H3B','H5B','H61B','H62B'],
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
    GLYCANS.galactobiose=gb.s.spec({ name:'Galactobiose', formula:'C₁₂H₂₂O₁₁', class:'sugar',
      names:['O5A','C1A','C2A','C3A','C4A','C5A','O1A','O2A','HO2A','O3A','HO3A','O4A','HO4A','C6A','O6A','HO6A','H1A','H2A','H3A','H4A','H5A','H61A','H62A','O5B','C1B','C2B','C3B','C4B','C5B','H4B','O1B','HO1B','O2B','HO2B','O3B','HO3B','C6B','O6B','HO6B','H1B','H2B','H3B','H5B','H61B','H62B'],
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
    GLYCANS.lactose=lac.s.spec({ name:'Lactose', formula:'C₁₂H₂₂O₁₁', class:'sugar',
      names:['O5A','C1A','C2A','C3A','C4A','C5A','O1A','O2A','HO2A','O3A','HO3A','O4A','HO4A','C6A','O6A','HO6A','H1A','H2A','H3A','H4A','H5A','H61A','H62A','O5B','C1B','C2B','C3B','C4B','C5B','H4B','O1B','HO1B','O2B','HO2B','O3B','HO3B','C6B','O6B','HO6B','H1B','H2B','H3B','H5B','H61B','H62B'],
      // Axial at the GALACTOSE's C4 only. The glucose half is ordinary
      // all-equatorial glucose, which is the difference from galactobiose and
      // the whole point of having both.
      stereo:{ axial:[lac.c4d] },
      glycosidic:{ anomeric:lac.c1, bridge:lac.bo, partner:lac.c4, config:'beta', link:'1→4' },
      view:VIEW.disaccharide,
      optH:lac.optH });
  }
  register(GLYCANS, SELFNAME);
})(this);
