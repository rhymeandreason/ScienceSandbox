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
  ];

  const PLACEMENTS = [
    ['w:hbond',     { hbond: 1 }],
    ['w:ice',       { 'ice-density': 1 }],
    ['w:solvation', { solvent: 1 }],
    ['w:heat',      { 'spec-heat': 1, 'temp-buffer': 2 }],
    ['b:water',     { 'water-mol': 1, polarity: 1 }],
  ];

  global.GraphContent = { CONTENT, PLACEMENTS };
})(this);
