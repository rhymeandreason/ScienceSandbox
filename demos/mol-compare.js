/* =====================================================================
 *  mol-compare.js — the SAME molecule, derived two ways.
 *
 *  Loaded only by molecule-viewer.html. Every other domain file holds molecules
 *  a lesson draws; this one holds controls. `atpSkel` and `nadhSkel` are ATP and
 *  NADH built from ideal VSEPR angles and measured bond lengths, to sit beside
 *  `atp` and `nadh` in mol-glycolysis.js, which are real PubChem conformers.
 *  Same molecules, same scale family, two derivations each — and the page lets
 *  you switch between them under one camera.
 *
 *  WHY THIS EXISTS. MolecularGeometry.md §1.6 says derive when shape carries the
 *  lesson and schematize when topology does, and that the failure is doing one
 *  while claiming the other. That rule gets applied by argument every time a
 *  molecule is added. This makes it a thing you can look at, and the two pairs
 *  say different things about the same trade:
 *
 *    ATP    built 1.02 Å out of its own plane, 14.4 Å across
 *           conformer 1.33 Å, 9.6 Å
 *    NADH   built 1.01 Å, 21.4 Å  ·  conformer 1.91 Å, 12.0 Å
 *
 *  A schematic is flat and EXTENDED whatever you feed it, because every torsion
 *  is set to open outward; a real conformer folds back on itself, and the bigger
 *  the molecule the further it folds. So the cost of schematizing is not a
 *  constant — it grows, and NADH is on the shelf to show it growing. Whether
 *  that difference costs a student anything is answerable by eye in a way no
 *  paragraph settles.
 *
 *  IT IS A SEPARATE FILE BECAUSE OF WHO PAYS. glycolysis-lab and
 *  macromolecule-lab both load mol-glycolysis.js; putting a second 43-atom ATP
 *  in there would bill two lessons for a spec they never draw, which is the
 *  failure the domain split exists to prevent (CLAUDE.md, "Adding a new page").
 *
 *  WHAT MAKES THE COMPARISON HONEST. A hand-built ribose has four stereocentres
 *  and no internal check can catch a global mirror (MolecularGeometry.md §1.3) —
 *  nadhSkel has TWO of them —
 *  so without an external reference, "the two look different" would confound
 *  "different method" with "I got the sugar wrong", which is exactly the
 *  confusion the page exists to remove. Hence `smiles` and a
 *  tools/check-handedness.js REF entry pointing at the SAME PubChem record the
 *  conformer matches. If both canonicalise to that record, every visible
 *  difference between them is method and nothing else. NADH goes one better:
 *  its generated `smiles` is byte-identical to `nadh`'s.
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
  // adenine / ribosyl / phosphoUnit are skel.js's nucleotide fragments — the
  // three pieces both molecules here are assembled from, and thirteen more
  // catalog rows after them. See their notes there for the stereochemistry.
  const { GL, AR, V, vadd, vsub, vmul, vnorm, absorb, fitOnto,
          adenine, ribosyl, flatRing, flatH } = SkelLib;

  const COMPARE = {};


  {
    /* — atpSkel: ATP from ideal geometry.
     *
     *  THREE PIECES, in the order a chemist would name them: adenine, ribose,
     *  triphosphate. Each is built by the shared builder, none of it is typed
     *  as coordinates, and the joins go through skel.js's fitOnto/absorb — the
     *  same pair maltose and cellobiose are assembled with.
     *
     *  STEREOCHEMISTRY IS THE WHOLE RISK, and it now lives in skel.js's
     *  ribosyl() — the ring, its 2′/3′ faces and the reserved β slot at C1′.
     *  Read its note before touching a sugar face; getting one backwards builds
     *  L-ribose, which renders identically.
     */
    // --- ribose, and everything hung off it ----------------------------
    const rib = ribosyl(), s = rib.s;
    const c1 = rib.c1, c2 = rib.c2, c3 = rib.c3, c4 = rib.c4, c5 = rib.c5;
    const n9dir = rib.baseDir, n9pos = rib.basePos;

    // --- the triphosphate ----------------------------------------------
    // Not Skel.phosphate(), which builds a TERMINAL phosphate (P plus three O).
    // Here the α and β phosphorus each spend a slot on a bridging oxygen
    // instead, and that chain — three P in a row, γ on the end — is the only
    // claim ATP's picture makes. phosphoUnit() is one link of it; its note
    // carries the slot-0 and bridge-first traps.
    //
    // Anionic, not acid: ATP is stored as the physiological tetra-anion, and
    // the charge on those phosphates IS the lesson.
    const o5  = s.grow(c5, 'O', GL.CO, 'sp3', 0);
    const a1  = s.phosphoUnit(o5, {});                 // Pα + α–β bridge
    const a2  = s.phosphoUnit(a1.bridge, {});          // Pβ + β–γ bridge
    const a3  = s.phosphoUnit(a2.bridge, {terminal:true});   // Pγ and its three O
    const pa = a1.p, pb = a2.p, pg = a3.p;
    const [g1, g2, g3] = a3.oxy;                       // together, the γ group

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
      // Tuned in molecule-viewer.html (drag, then its copy button) rather than
      // inherited: VIEW.pyranose is the sugar-chair angle every hexose shares,
      // and on a nucleotide it frames the ribose and lets the phosphate tail
      // run off wherever it likes. This one is about the CHAIN, which is what
      // ATP's picture claims. Inline rather than a VIEW entry because it is one
      // molecule's angle — VIEW is for an angle two specs SHARE, and a table
      // entry with a single user is a name nobody can reuse.
      view:[-1.3882, -0.1018, -0.7511],
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


  {
    /* — nadhSkel: NADH from ideal geometry.
     *
     *  The same exercise as atpSkel, one molecule further out: NADH is a
     *  DINUCLEOTIDE, so where ATP ends after one sugar this one runs
     *  adenine–ribose–P–O–P–ribose–nicotinamide, with a second furanose and its
     *  four stereocentres on the far end of the bridge. That is the point of
     *  building it — the schematic's cost is supposed to grow with the molecule,
     *  and a viewer that only ever showed the cheap case would not say so.
     *
     *  FIVE RINGS, THREE BUILDERS, and each is the one the ring's own physics
     *  asks for: adenine and the dihydronicotinamide are laid out flat
     *  (`flatRing`/`fuseRing`) because sp2 ring systems ARE flat and a
     *  tetrahedral builder would pucker them; both riboses come out of
     *  `ringFuranose` and take their identity from `face()`.
     *
     *  CHARGE STATE follows `nadh` in mol-glycolysis.js: the NEUTRAL molecule,
     *  so each phosphate carries its –OH rather than the bare O⁻ atpSkel shows.
     *  A derivation control that differed in protonation as well as in method
     *  would confound the two, which is the one thing it exists not to do.
     *
     *  WHAT IS SCHEMATIC HERE, declared per MolecularGeometry.md §1.6:
     *   · The dihydronicotinamide ring is drawn as a regular planar hexagon at
     *     the aromatic C–C length. The real 1,4-dihydropyridine is a shallow
     *     boat, and its two bonds INTO the sp3 C4 are ~1.50 Å, not 1.39. What
     *     the picture claims is the thing the lesson claims — C4 is sp3 and
     *     carries two hydrogens, one of them the hydride, so the ring is no
     *     longer aromatic — and that IS built: the two H's come from freeTet(),
     *     which straddles the ring plane at the tetrahedral angle. It is also
     *     the claim check-molecules.js's `gly.nic` block asserts.
     *   · Both glycosidic torsions and the two ester torsions along the
     *     pyrophosphate are set by a spin constant, the same standing the
     *     disaccharides' φ/ψ have: floppy in solution, declared, unchecked.
     */

    // --- the adenosine half ---------------------------------------------
    const ribA = ribosyl(), s = ribA.s;
    const c1 = ribA.c1, c2 = ribA.c2, c3 = ribA.c3, c4 = ribA.c4, c5 = ribA.c5;
    const n9dir = ribA.baseDir, n9pos = ribA.basePos;

    // --- the pyrophosphate bridge ----------------------------------------
    // `acid:true` — the NEUTRAL molecule, so each phosphorus keeps its –OH
    // rather than the bare O⁻ atpSkel shows. phosphoUnit()'s note carries the
    // slot-0 and bridge-first traps; the second unit's "bridge" is the ester
    // that the nicotinamide ribose is fitted onto below.
    const o5  = s.grow(c5, 'O', GL.CO, 'sp3', 0);
    const u1  = s.phosphoUnit(o5, {acid:true});
    const u2  = s.phosphoUnit(u1.bridge, {acid:true});
    const pa = u1.p, pb = u2.p, o5b = u2.bridge;

    // --- join adenine on, then the sugar's C–H ---------------------------
    // BEFORE the C–H, for atpSkel's reason: n9dir only RESERVED C1′'s β slot,
    // and freeTet() reports what is free, not what is spoken for.
    const CHI_A = 106 * Math.PI / 180;         // anti, as in atpSkel
    const ade = adenine();
    const outN9 = vnorm(vmul(ade.s.nbrs(ade.n9).reduce(vadd, V(0,0,0)), -1));
    fitOnto(ade.s, ade.n9, outN9, vmul(n9dir, -1), n9pos, CHI_A);
    const offA = absorb(s, ade.s);
    s.link(c1, ade.n9 + offA);
    const CH_A = [ s.grow(c1,'H',GL.CH,'sp3',0), s.grow(c2,'H',GL.CH,'sp3',0),
                   s.grow(c3,'H',GL.CH,'sp3',0), s.grow(c4,'H',GL.CH,'sp3',0),
                   s.grow(c5,'H',GL.CH,'sp3',0), s.grow(c5,'H',GL.CH,'sp3',0) ];

    // --- the dihydronicotinamide ring ------------------------------------
    // N1 C2 C3 C4 C5 C6 at 0…5. One Kekulé pair — C2=C3 and C5=C6 — with N1–C2,
    // C3–C4, C4–C5 and C6–N1 single: that pattern IS 1,4-dihydro, and it is why
    // C4 is left with two open tetrahedral slots below.
    function nicotinamide(){
      const r = flatRing(6, ['N','C','C','C','C','C']);
      const n1 = 0, k2 = 1, k3 = 2, k4 = 3, k5 = 4, k6 = 5;
      r.order(k2,k3,2).order(k5,k6,2);
      // the carboxamide at C3, in the ring plane — it is conjugated with C2=C3
      // and with its own carbonyl, so it is not free to rotate out of it. Grown
      // the way adenine's 6-amino is: bisecting C3's two neighbours from
      // outside, which cannot tip the ring.
      const inPlane = (from, dir, el, dist) => {
        const j = r.put(el, vadd(r.at(from), vmul(dir, dist)));
        r.link(from, j); return j;
      };
      const outC3 = vnorm(vmul(r.nbrs(k3).reduce(vadd, V(0,0,0)), -1));
      const cam = inPlane(k3, outC3, 'C', GL.CC);
      // O and N off the amide carbon at ±120° in the same plane — a planar sp2
      // amide, which is what the resonance makes it.
      {
        const back = vnorm(vsub(r.at(k3), r.at(cam)));
        const side = vnorm(V(-back.z, 0, back.x));         // in-plane ⊥
        const c = Math.cos(Math.PI/3), sn = Math.sin(Math.PI/3);
        const arm = k => vnorm(vadd(vmul(back,-c), vmul(side, k*sn)));
        var amO = inPlane(cam, arm( 1), 'O', GL.CdO); r.order(cam, amO, 2);
        var amN = inPlane(cam, arm(-1), 'N', AR.CN);
        // the amide N's two H, in the plane for the same reason
        const nb = vnorm(vsub(r.at(cam), r.at(amN)));
        const sd = vnorm(V(-nb.z, 0, nb.x));
        [1,-1].forEach(k => inPlane(amN,
          vnorm(vadd(vmul(nb,-c), vmul(sd, k*sn))), 'H', AR.NH));
      }
      // ring C–H: three flat ones, and THE TWO ON C4. Those two are the
      // molecule — freeTet() at a carbon with two ring neighbours returns the
      // pair of slots straddling the ring plane, so they come out above and
      // below it at the tetrahedral angle, which is what an sp3 centre in a
      // ring of sp2 ones looks like.
      const hRing = [ flatH(r, k2, AR.CH), flatH(r, k5, AR.CH), flatH(r, k6, AR.CH) ];
      const h4 = [ r.grow(k4,'H',GL.CH,'sp3',0), r.grow(k4,'H',GL.CH,'sp3',0) ];
      return { s:r, n1, ring:[n1,k2,k3,k4,k5,k6], c4:k4, h4, hRing,
               amide:{c:cam, o:amO, n:amN} };
    }

    // --- the nicotinamide riboside half ----------------------------------
    // The same sugar again, which is the point of ribosyl(): a dinucleotide's
    // two halves differ in what they carry, not in the ribose that carries it.
    const ribB = ribosyl(), r = ribB.s;
    const b1 = ribB.c1, b2 = ribB.c2, b3 = ribB.c3, b4 = ribB.c4, b5 = ribB.c5;
    const n1dir = ribB.baseDir, n1pos = ribB.basePos;
    // RESERVE C5″'s bond to the bridge before anything else can take it — same
    // trap as n9dir, and the reason C5″'s own hydrogens are grown last of all,
    // after the ester link exists.
    const outB5 = r.freeTet(b5)[0];

    // N1 lands on C1″'s β face, exactly as N9 does on the other sugar. χ is
    // declared schematic; 106° is atpSkel's value, and a pyridinium nucleoside
    // sits anti like a purine one.
    const nic = nicotinamide();
    const outN1 = vnorm(vmul(nic.s.nbrs(nic.n1).reduce(vadd, V(0,0,0)), -1));
    fitOnto(nic.s, nic.n1, outN1, vmul(n1dir, -1), n1pos, CHI_A);
    const offN = absorb(r, nic.s);
    r.link(b1, nic.n1 + offN);
    const CH_B = [ r.grow(b1,'H',GL.CH,'sp3',0), r.grow(b2,'H',GL.CH,'sp3',0),
                   r.grow(b3,'H',GL.CH,'sp3',0), r.grow(b4,'H',GL.CH,'sp3',0) ];

    // --- and join the two halves at the bridge's far oxygen ---------------
    const dirO5b = s.freeTet(o5b)[0];
    // The bridge's own torsion, swept like the disaccharides' φ/ψ. Clearance
    // does NOT decide it — over most of the circle the closest non-bonded pair
    // is the ribose's own 2′/3′ hydroxyls at 2.53 Å, an order of magnitude above
    // the checker's floor — so the two things a viewer can see decide instead,
    // and they agree: 200° is both the most EXTENDED arrangement (21.4 Å across,
    // so the two nucleotides read as two halves joined tail to tail rather than
    // as one blob) and the FLATTEST (1.01 Å out of its own plane, against 1.16
    // and worse either side). Declared schematic, unchecked, same standing as χ.
    fitOnto(r, b5, outB5, vmul(dirO5b, -1),
            vadd(s.at(o5b), vmul(dirO5b, GL.CO)), 200 * Math.PI / 180);
    const offB = absorb(s, r);
    s.link(o5b, b5 + offB);
    // NOW C5″'s hydrogens: it has two real neighbours at last, so freeTet
    // returns the two slots that are genuinely free.
    const CH_B5 = [ s.grow(b5+offB,'H',GL.CH,'sp3',0),
                    s.grow(b5+offB,'H',GL.CH,'sp3',0) ];

    // Every index below is COMPUTED from the build, never counted off a
    // rendering — the same discipline `nadh`'s own `nic` block is written with.
    const N = i => i + offN + offB;
    const nicIdx = { ring:nic.ring.map(N), n:N(nic.n1), c4:N(nic.c4),
                     h:nic.h4.map(N),
                     amide:{ c:N(nic.amide.c), o:N(nic.amide.o), n:N(nic.amide.n) } };
    const optH = [ ...CH_A, ...CH_B.map(i=>i+offB), ...CH_B5,
                   ...nic.hRing.map(N), ...nicIdx.h ];

    COMPARE.nadhSkel = s.spec({
      name:'Nicotinamide adenine dinucleotide (reduced)', short:'NADH (idealized)',
      formula:'C₂₁H₂₉N₇O₁₄P₂', charge:0, class:'nucleotide',
      // Generated by tools/spec2smiles.js from these coordinates, and the reason
      // this spec can be trusted at all: check-handedness.js matches it against
      // the same PubChem record `nadh` matches, so every visible difference
      // between the two is method and not a mirrored sugar.
      // — and it comes back BYTE-IDENTICAL to `nadh`'s, which is the strongest
      // statement this file can make: two independent derivations of a molecule
      // with eight stereocentres canonicalise to the same string.
      smiles:'Nc1ncnc2c1ncn2[C@@H]1O[C@H](COP(=O)(O)OP(=O)(O)OC[C@H]2O[C@@H]([N:1]3[CH:1]=[CH:1][CH2:1][C:1]([C:1]([NH2:1])=[O:1])=[CH:1]3)[C@H](O)[C@@H]2O)[C@@H](O)[C@H]1O',
      flat:true,
      // 44 heavy atoms, spec order, real ångströms — tools/bake-flat2d.js.
      // Worth switching derivation while in 2D: the two layouts differ only in
      // how RDKit folded each one, because a depiction is computed from
      // CONNECTIVITY and connectivity is what the two derivations agree about.
      flat2d:[[4.135,2.075],[3.982,3.528],[2.553,3.831],[1.823,2.566],[2.8,1.481],[1.959,5.166],[0.37,2.414],[2.497,0.052],[3.582,-0.926],[3.278,-2.355],[2.975,-3.784],[1.849,-2.051],[4.707,-2.658],[1.585,-4.235],[0.196,-4.687],[2.037,-5.625],[1.134,-2.846],[9.418,4.201],[8.688,2.936],[7.227,2.936],[6.497,4.201],[7.227,5.467],[8.688,5.467],[6.25,6.552],[4.915,5.958],[5.068,4.505],[9.418,6.732],[-3.461,-3.302],[-4.643,-4.161],[-4.191,-5.55],[-2.73,-5.55],[-2.279,-4.161],[-5.05,-6.732],[-1.872,-6.732],[-0.89,-3.709],[-6.032,-3.709],[-6.336,-2.28],[-7.725,-1.829],[-8.811,-2.806],[-8.507,-4.235],[-7.118,-4.687],[-8.029,-0.4],[-9.418,0.052],[-6.943,0.578]],
      topology:{ rings:[5,5,5,6,6], fused:true },
      // NO `view:` on purpose. It carried VIEW.pyranose, copied along with the
      // rest of atpSkel's shape — a hexose chair angle, which says nothing
      // about a dinucleotide and was only ever harmless because
      // molecule-viewer used to override it. Now that a declared view IS the
      // opening pose (molview.js openingPose), an angle nobody chose would be
      // an angle everybody sees. Absent, the viewer opens it on its own widest
      // plane, which is the honest default until someone tunes one.
      optH,
      gly:{ carbons:21, phosphates:2, carrier:true, nic:nicIdx,
            spent:{ name:'Nicotinamide adenine dinucleotide (oxidised)',
                    short:'NAD⁺', formula:'C₂₁H₂₇N₇O₁₄P₂⁺' } },
      compare:{ against:'nadh', method:'skel',
                note:'Ideal VSEPR angles, measured bond lengths, no conformer.' },
    });
    COMPARE.nadhSkel.flatMark =
      [...nicIdx.ring, nicIdx.c4, ...nicIdx.h,
       nicIdx.amide.c, nicIdx.amide.o, nicIdx.amide.n];
  }

  register(COMPARE, SELFNAME);
})(this);
