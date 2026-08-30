/* =====================================================================
 *  graphcontent.js — what the graph's cards can SHOW, and nothing that
 *  draws it. Loaded after graphdata.js; exposes
 *  window.GraphContent = { CONTENT, PLACEMENTS }.
 *
 *  Separate from graphdata.js on purpose: the skeleton and the material
 *  attached to it are different problems that evolve at different speeds
 *  (Biology-Node-Graph.md's "adding content" section). Same shape as
 *  mapcontent.js's tables, because that shape was earned: content-major,
 *  one row per unit however many nodes point at it, with PLACEMENTS
 *  carrying the rank each placement has.
 *
 *  INLINE only, so far: every row here mounts a live box in its node's
 *  thumb, showing the node's own subject. Content that is its own object
 *  (a video, the sickle comparison serving three nodes) becomes a NODE in
 *  graphdata.js instead — reusable things get nodes, a node's own picture
 *  rides the node.
 *
 *  `id` is namespaced by kind:  w: water sim   m: molbox
 *  A water row's `frame` block is TUNING, not curriculum — it is what
 *  water/watersim.js's step() takes.
 * ===================================================================== */
(function (global) {
  'use strict';

  const CONTENT = [
    /* H-bonds forming and breaking at room temperature: the hub's claim,
       moving. */
    { id: 'w:hbond', kind: 'water', waters: 16,
      frame: { showHbonds: true, tempEnabled: true, temperature: 22 } },
    /* The lattice: same molecules, held apart. */
    { id: 'w:ice', kind: 'water', waters: 16,
      frame: { showHbonds: true, tempEnabled: true, temperature: -8, freezeEnabled: true } },
    /* A crystal coming apart shell by shell. */
    { id: 'w:solvation', kind: 'water', waters: 14, salt: 1,
      frame: { showHbonds: true, tempEnabled: true, temperature: 22 } },
    /* Heat going into breaking bonds: the same box, hot. */
    { id: 'w:heat', kind: 'water', waters: 16,
      frame: { showHbonds: true, tempEnabled: true, temperature: 85 } },
    /* The builder's water, dealt finished and FLAT: the flat view is the one
       that draws every valence electron, which is what the card's claim is
       about. The turn stays the reader's, through the control. */
    { id: 'b:water', kind: 'build', recipe: 'water' },

    /* ---- inline: a protein drawn ON a concept card ----------------------
       These name files directly (composer's r: convention) because what
       they draw — a chain-B fold, one chain of a tetramer — has no role in
       proteins/proteins.js, which registers structures, not illustrations. */
    /* The tetramer as a Cα ribbon: four folded chains packed, which is
       quaternary's exact claim. */
    { id: 'r:quaternary', kind: 'protein',
      trace: 'hemoglobin/data/2HHB.trace.json' },
    /* ONE chain of the same tetramer: one chain finding one shape. Same
       trace file, so nothing is baked twice. */
    { id: 'r:tertiary', kind: 'protein',
      trace: 'hemoglobin/data/2HHB.trace.json', chains: 'B' },
    /* The chain again, with the fold trajectory behind its play button. */
    { id: 'r:folding', kind: 'protein',
      trace: 'hemoglobin/data/2HHB.trace.json', chains: 'B',
      fold: 'hemoglobin/data/2HHB-B.fold.bin' },

    /* ---- button: the lesson behind the card -----------------------------
       hemoglobin-lab IS the folding lesson (folding-lab is deprecated):
       a β chain folds 1→3, the heme settles, the chains dock. */
    { id: 'l:hemoglobin', kind: 'lesson', name: 'How a chain folds',
      href: 'hemoglobin-lab.html?chrome=bare' },
  ];

  const PLACEMENTS = [
    ['w:hbond',     { hbond: 1 }],
    ['w:ice',       { 'ice-density': 1 }],
    ['w:solvation', { solvent: 1 }],
    ['w:heat',      { 'spec-heat': 1, 'temp-buffer': 2 }],
    ['b:water',     { 'water-mol': 1, polarity: 1 }],

    ['r:quaternary', { quaternary: 1 }],
    ['r:tertiary',   { tertiary: 1 }],
    ['r:folding',    { folding: 1 }],
    ['l:hemoglobin', { folding: 1 }],

    /* ---- specimens ------------------------------------------------------
       A `p:` row places a protein whose entry lives in proteins/proteins.js;
       nothing here restates what the protein IS. The page spawns a specimen
       CARD per placed protein — a leaf, instance-of the concepts that hold
       it. An unplaced registry protein simply does not appear yet, and the
       page says so in the console. */
    ['p:hemoglobin', { quaternary: 1, 'point-mutation': 2, folding: 2 }],
    ['p:amylase',    { enzyme: 1, specificity: 2 }],
    ['p:rnase',      { denaturation: 1, folding: 1 }],   /* Anfinsen: it refolds itself */
    ['p:prion',      { folding: 1, denaturation: 2 }],
    /* the α-helix canonical, and the first tertiary structure ever solved */
    ['p:myoglobin',  { func: 1, secondary: 1 }],

    /* Worked from the CONCEPT side, not the library side: for each concept,
       which protein demonstrates it best. Exactly one canonical per concept
       at rank 1, the rest at 2 — otherwise a concept collects thirty
       examples, which is the hairball again in a different costume. */
    /* the CLOSED form on purpose: the default 1IG8 is open, which is the
       state induced fit has not happened in yet */
    ['p:hexokinase@3B8A', { 'induced-fit': 1, enzyme: 2 }],
    /* the catalytic triad, and a pocket that picks side chains by shape */
    ['p:chymotrypsin',    { 'active-site': 1, specificity: 1 }],
    /* three disulfides holding 51 residues in two chains together */
    ['p:insulin',         { disulfide: 1, quaternary: 2 }],
    /* Gly-X-Y is the sequence that permits the triple helix, and the `oi`
       variant is a second point mutation to set beside sickle */
    ['p:collagen',        { primary: 2, 'point-mutation': 2 }],
    /* the β-barrel, to set against myoglobin's helices */
    ['p:gfp',             { secondary: 2 }],
    /* quaternary structure that is not haemoglobin: 24 identical subunits */
    ['p:ferritin',        { quaternary: 2 }],

    /* atp-synthase and napump stay UNPLACED. Both are outbound bridges —
       chemiosmosis, active transport — and neither unit exists yet. Per
       Biology-Node-Graph.md that is a gap in the units, not in the library:
       a protein with no concept to attach to does not need a node. */
  ];

  global.GraphContent = { CONTENT, PLACEMENTS };
})(this);
