/* =====================================================================
 *  mol-compare.js — the SAME molecule, derived two ways.
 *
 *  Loaded only by molecule-viewer.html. Every other domain file holds molecules
 *  a lesson draws; this one holds a control. `atpSkel` is ATP built from ideal
 *  VSEPR angles and measured bond lengths, to sit beside `atp` in
 *  mol-glycolysis.js, which is a real PubChem conformer. Same molecule, same
 *  scale family, two derivations — and the page lets you switch between them
 *  under one camera.
 *
 *  WHY THIS EXISTS. MolecularGeometry.md §1.6 says derive when shape carries the
 *  lesson and schematize when topology does, and that the failure is doing one
 *  while claiming the other. That rule gets applied by argument every time a
 *  molecule is added. This makes it a thing you can look at: the schematic ATP
 *  is ~0.4 Å out of its own plane, the conformer is 1.33, and the question of
 *  whether that difference costs a student anything is answerable by eye in a
 *  way no paragraph settles.
 *
 *  IT IS A SEPARATE FILE BECAUSE OF WHO PAYS. glycolysis-lab and
 *  macromolecule-lab both load mol-glycolysis.js; putting a second 43-atom ATP
 *  in there would bill two lessons for a spec they never draw, which is the
 *  failure the domain split exists to prevent (CLAUDE.md, "Adding a new page").
 *
 *  WHAT MAKES THE COMPARISON HONEST. A hand-built ribose has four stereocentres
 *  and no internal check can catch a global mirror (MolecularGeometry.md §1.3) —
 *  so without an external reference, "the two look different" would confound
 *  "different method" with "I got the sugar wrong", which is exactly the
 *  confusion the page exists to remove. Hence `smiles` and a
 *  tools/check-handedness.js REF entry pointing at the SAME PubChem record
 *  `atp` matches. If both canonicalise to that record, every visible difference
 *  between them is method and nothing else.
 * ===================================================================== */
(function(global){
  'use strict';
  const SELFNAME = 'mol-compare.js';
  const Lib = global.MolLib
    || (typeof require === 'function' ? require('./molecules.js').MolLib : null);
  if (!Lib) throw new Error(SELFNAME + ': molecules.js must be loaded first');
  const { MOLECULES, VIEW, register } = Lib;
  const SkelLib = global.SkelLib
    || (typeof require === 'function' ? require('./skel.js').SkelLib : null);
  if (!SkelLib) throw new Error(SELFNAME + ': skel.js must be loaded first');
  const { GL, AR, V, vadd, vsub, vmul, vnorm, absorb, fitOnto,
          FURANOSE_UP, FURANOSE_DOWN,
          ringFuranose, flatRing, fuseRing, flatH } = SkelLib;

  const COMPARE = {};

  {
    /* — atpSkel: ATP from ideal geometry.
     *
     *  THREE PIECES, in the order a chemist would name them: adenine, ribose,
     *  triphosphate. Each is built by the shared builder, none of it is typed
     *  as coordinates, and the joins go through skel.js's fitOnto/absorb — the
     *  same pair maltose and cellobiose are assembled with.
     *
     *  STEREOCHEMISTRY IS THE WHOLE RISK, and it is confined to four calls.
     *  The ribose is β-D-ribofuranose, and its identity is which FACE of the
     *  near-flat ring each substituent sits on — a five-ring is too flat for
     *  axial/equatorial to mean anything (skel.js, `face`). The face pattern
     *  below is the one `ribose` in mol-contrast.js already carries and that
     *  check-handedness.js already matches against beta-D-ribofuranose:
     *  base UP at C1′, –OH DOWN at C2′ and C3′, C5′ UP at C4′. Copied as a
     *  PATTERN, not as coordinates — arabinose, xylose and lyxose differ from
     *  ribose in nothing else.
     */
    // NOT +1/-1 by inspection — see skel.js's FURANOSE_UP. Getting this
    // backwards builds L-ribose, which has every bond length, every angle and
    // every pixel of the real thing. It was backwards here first, and
    // check-handedness.js is what said so.
    const UP = FURANOSE_UP, DOWN = FURANOSE_DOWN;

    // --- adenine: purine with an amine at C6 ---------------------------
    // Same construction as `purine` in mol-contrast.js — a flat six-ring with
    // an imidazole fused across C4–C5 — because a base is planar and a
    // tetrahedral builder would pucker it. Indices: 0…5 = N1 C2 N3 C4 C5 C6,
    // then 6,7,8 = N7 C8 N9.
    function adenine(){
      const a = flatRing(6, ['N','C','N','C','C','C']);
      const five = fuseRing(a, 5, 3, 4, V(0,0,0), ['N','C','N']);   // N7 C8 N9
      const n7 = five[0], c8 = five[1], n9 = five[2];
      // One Kekulé structure. The real ring is delocalised, but alternating
      // orders keep every atom's valence right, which a uniform stick would not
      // (skel.js's note on AR).  N1=C2 · N3=C4 · C5=C6 · N7=C8
      a.order(0,1,2).order(2,3,2).order(4,5,2).order(n7,c8,2);
      // the 6-amino group — what makes this adenine rather than purine. Grown
      // in the ring plane at the aromatic C–N length, since it is conjugated
      // into the ring and is not free to rotate out of it.
      // placed like flatH: in the ring plane, bisecting C6's two neighbours from
      // outside, so the amine cannot tip the base out of planarity
      const n6 = (()=>{
        const dir = vnorm(vmul(a.nbrs(5).reduce(vadd, V(0,0,0)), -1));
        const j = a.put('N', vadd(a.at(5), vmul(dir, AR.CN)));
        a.link(5, j); return j;
      })();
      flatH(a, 1, AR.CH);            // H2
      flatH(a, c8, AR.CH);           // H8
      // the amine's two H, in the plane, splayed off the C6–N bond
      {
        const back = vnorm(vsub(a.at(5), a.at(n6)));
        const side = vnorm(V(-back.z, 0, back.x));      // in-plane perpendicular
        const c = Math.cos(Math.PI/3), sn = Math.sin(Math.PI/3);
        [1,-1].forEach(k=>{
          const d = vnorm(vadd(vmul(back,-c), vmul(side, k*sn)));
          const h = a.put('H', vadd(a.at(n6), vmul(d, AR.NH)));
          a.link(n6, h);
        });
      }
      return { s:a, n9 };
    }

    // --- ribose, and everything hung off it ----------------------------
    const s = ringFuranose();
    const RING = [0,1,2,3,4];            // O4′, C1′, C2′, C3′, C4′
    const c1 = 1, c2 = 2, c3 = 3, c4 = 4;

    // Where the base attaches: C1′'s UP face, the β configuration. Taken as a
    // DIRECTION rather than grown as an atom, because the atom it leads to is
    // the far side of a ring system built elsewhere.
    const n9dir = s.freeTet(c1)[s.face(c1, RING, UP)];
    const n9pos = vadd(s.at(c1), vmul(n9dir, GL.CN));

    const o2 = s.hydroxyl(c2, s.face(c2, RING, DOWN));
    const o3 = s.hydroxyl(c3, s.face(c3, RING, DOWN));
    const c5 = s.grow(c4, 'C', GL.CC, 'sp3', s.face(c4, RING, UP));

    // --- the triphosphate ----------------------------------------------
    // Grown one atom at a time rather than through Skel.phosphate(), which
    // builds a TERMINAL phosphate (P plus three O). Here the α and β phosphorus
    // each spend a slot on a bridging oxygen instead, and that chain — three P
    // in a row, γ on the end — is the only claim ATP's picture makes.
    //
    // EVERY SLOT HERE IS 0, and that is not laziness. freeTet() returns the
    // slots still FREE at that atom, so the numbering shifts down after each
    // grow — asking for slot 2 on a phosphorus that already has three bonds
    // reads past the end of a one-element list. Slot 0 is also seeded to point
    // away from everything placed so far (skel.js's `outwardAt`), which is why
    // each BRIDGE is grown before its phosphorus's terminal oxygens: the bridge
    // takes the outward direction and the chain extends, instead of the second
    // phosphate folding back over the sugar it just came off.
    const o5  = s.grow(c5, 'O', GL.CO, 'sp3', 0);
    const pa  = s.grow(o5, 'P', GL.OP, 'sp3', 0);
    const oab = s.grow(pa, 'O', GL.OP, 'sp3', 0);     // α–β bridge, outward
    s.grow(pa, 'O', GL.PO, 'sp3', 0, 2);              // Pα=O
    s.grow(pa, 'O', GL.PO, 'sp3', 0);                 // Pα–O⁻
    const pb  = s.grow(oab, 'P', GL.OP, 'sp3', 0);
    const obg = s.grow(pb, 'O', GL.OP, 'sp3', 0);     // β–γ bridge, outward
    s.grow(pb, 'O', GL.PO, 'sp3', 0, 2);              // Pβ=O
    s.grow(pb, 'O', GL.PO, 'sp3', 0);                 // Pβ–O⁻
    const pg  = s.grow(obg, 'P', GL.OP, 'sp3', 0);
    const g1  = s.grow(pg, 'O', GL.PO, 'sp3', 0, 2);  // Pγ=O
    const g2  = s.grow(pg, 'O', GL.PO, 'sp3', 0);     // and its two O⁻ —
    const g3  = s.grow(pg, 'O', GL.PO, 'sp3', 0);     // together, the γ group

    // --- join the base on -----------------------------------------------
    // N9 lands on the position C1′'s β face points at, with the base's own
    // outward direction carried back onto C1′ — so the ring system extends away
    // from the sugar rather than folding over it.
    //
    // `spin` sets the GLYCOSIDIC TORSION χ (O4′–C1′–N9–C4), the one angle here
    // that nothing else pins. It is a declared schematic per
    // MolecularGeometry.md §1.6 — χ is floppy in solution — but not an arbitrary
    // one: it was swept, and clearance turned out NOT to decide it (the closest
    // non-bonded pair stays between 1.83 and 2.22 at every angle, an order of
    // magnitude above the checker's floor). So it is set by chemistry instead.
    // 106° puts χ at −120.5°, which is ANTI, where purine nucleotides actually
    // sit; the first value tried left the base syn, the minor conformer, and
    // nothing about the render would have said so. Not asserted — same standing
    // as the disaccharide's φ/ψ, which are also declared and also unchecked.
    //
    // BEFORE THE C–H HYDROGENS, and that ordering is load-bearing. `n9dir` only
    // RESERVED C1′'s β slot; nothing occupies it until this link exists, so a
    // hydrogen grown at C1′ first would be handed the very direction the base is
    // about to take and the two would land on top of each other. freeTet()
    // reports what is free, not what is spoken for.
    const CHI = 106 * Math.PI / 180;
    const ade = adenine();
    const outN9 = vnorm(vmul(ade.s.nbrs(ade.n9).reduce(vadd, V(0,0,0)), -1));
    fitOnto(ade.s, ade.n9, outN9, vmul(n9dir, -1), n9pos, CHI);
    const off = absorb(s, ade.s);
    s.link(c1, ade.n9 + off);

    // C–H last, so every index above stays stable if a hydrogen is ever added or
    // dropped (the same discipline glucose and ribose are built with).
    const CH = [ s.grow(c1,'H',GL.CH,'sp3',0), s.grow(c2,'H',GL.CH,'sp3',0),
                 s.grow(c3,'H',GL.CH,'sp3',0), s.grow(c4,'H',GL.CH,'sp3',0),
                 s.grow(c5,'H',GL.CH,'sp3',0), s.grow(c5,'H',GL.CH,'sp3',0) ];

    COMPARE.atpSkel = s.spec({
      name:'Adenosine triphosphate', short:'ATP (idealized)',
      formula:'C₁₀H₁₂N₅O₁₃P₃⁴⁻', charge:-4, class:'nucleotide',
      // Generated by tools/spec2smiles.js from these coordinates, and the reason
      // this spec can be trusted at all: check-handedness.js matches it against
      // the same PubChem record `atp` matches.
      smiles:'Nc1ncnc2c1ncn2[C@@H]1O[C@H](COP(=O)(O)OP(=O)(O)O[P:1](=[O:1])([OH:1])[OH:1])[C@@H](O)[C@H]1O',
      flat:true,
      // 31 heavy atoms, spec order, real ångströms — tools/bake-flat2d.js.
      // Worth switching derivation while in 2D. The layouts are NOT identical
      // (RDKit still folds the phosphate tail its own way for each), but they
      // are far more alike than the two 3D models are, because a depiction is
      // computed from CONNECTIVITY and connectivity is the thing the two
      // derivations agree about completely.
      flat2d:[[0.418,1.538],[0.264,3.008],[-1.182,3.315],[-1.92,2.035],[-0.932,0.938],[-1.783,4.665],[-3.39,1.881],[-1.239,-0.508],[-0.141,-1.496],[-0.448,-2.941],[-0.755,-4.387],[-1.893,-2.634],[0.997,-3.249],[-2.16,-4.843],[-3.566,-5.3],[-1.704,-6.248],[-2.617,-3.438],[-4.664,-4.311],[-5.652,-5.409],[-3.675,-3.213],[-5.762,-3.322],[5.762,3.689],[5.023,2.41],[3.545,2.41],[2.807,3.689],[3.545,4.969],[5.023,4.969],[2.557,6.067],[1.207,5.466],[1.362,3.996],[5.762,6.248]],
      topology:{ rings:[5,5,6], fused:true },
      view:VIEW.pyranose,
      optH:CH,
      gly:{ carbons:10, phosphates:3, carrier:true,
            pa:pa, pb:pb, pg:pg,
            gamma:[pg, g1, g2, g3],
            spent:{ name:'Adenosine diphosphate', short:'ADP',
                    formula:'C₁₀H₁₂N₅O₁₀P₂³⁻', phosphates:2 } },
      // the same working end `atp` declares, so the page's Highlight points at
      // the same four atoms whichever derivation is on screen
      compare:{ against:'atp', method:'skel',
                // Short on purpose: it renders in the page's bottom-left debug
                // block, which shares that corner with the notes rail.
                note:'Ideal VSEPR angles, measured bond lengths, no conformer.' },
    });
    COMPARE.atpSkel.flatMark = COMPARE.atpSkel.gly.gamma;
  }

  register(COMPARE, SELFNAME);
})(this);
