/* =============================================================================
 *  kit/scale.js — the scale ladder, and what a component may claim about size
 * =============================================================================
 *  Every component declares one SCALE block. It answers the three questions a
 *  page (and the model writing one) has to get right, which used to be four
 *  private conventions: membrane.js declared EXAG in code, tree.js and leaf.js
 *  said "the organism scale" in prose, cutaway.js said "not a scale" in prose,
 *  and Components.md said nothing.
 *
 *      X.SCALE = {
 *        rung:  'cell',                 // required, one of RUNGS
 *        form:  'single',               // 'single' | 'bulk'
 *        exag:  { ribosome: 30 },       // drawn / true, per part name
 *        unit:  null,                   // metres per scene unit, or null
 *        sceneUnits: ['width'],         // advertised fields that are scene units, not metres
 *        down:  { membrane: 'Membrane' },   // part name -> component to hand off to
 *      };
 *
 *  RUNG is size, and it governs ONE thing: components at the same rung may
 *  share a scene, components at different rungs may not. That is the one-scale
 *  -family rule (MolecularGeometry.md §1.5) as a comparison instead of a
 *  judgement call. Crossing a rung is a handoff, never a camera move.
 *
 *  FORM is how many, and it is orthogonal to rung on purpose. Bulk recurs all
 *  the way up the ladder: watersim is bulk molecules, a mesophyll is bulk
 *  cells, a vessel of red cells will be too. Bulk and single at the SAME rung
 *  is the normal, correct scene — a solute in water, a chloroplast in
 *  mesophyll — and it is the scene the generator most needs permission for.
 *
 *  UNIT is optional and usually null. A null unit is a claim, not a gap: this
 *  render is not measurable, so nothing may print a length off it. Real sizes
 *  of the real subject still belong on the library card as prose, because how
 *  big a cell IS survives the render not being to scale.
 *
 *  tools/check-scale.js enforces all of it. docs/Scale.md is the argument.
 * ========================================================================== */
(function (global) {
  'use strict';

  // Ordered small to large. Adding one is a real decision: see docs/Scale.md,
  // and the test is whether two things at the new rung could share a scene.
  const RUNGS = [
    'molecules',      // atoms, molecules, and liquids made of them
    'macromolecule',  // a protein, a nucleic acid
    'membrane',       // a bilayer and its machines, nm
    'organelle',      // a mitochondrion, a chloroplast, from outside
    'cell',           // µm
    'tissue',
    'organ',          // an organ, a vessel
    'organism',
    'population',
  ];

  const FORMS = ['single', 'bulk'];

  const index = rung => RUNGS.indexOf(rung);
  const sameScene = (a, b) => a === b;          // the whole rule, spelt out
  const isBelow = (a, b) => index(a) < index(b);

  // Returns an array of complaints, empty when the block is well formed. The
  // checker adds the cross-file audits (part names, handoff targets) it can
  // only do with every component in hand.
  function validate(name, S) {
    const out = [];
    if (!S || typeof S !== 'object') return [`${name}: no SCALE block`];
    if (!RUNGS.includes(S.rung)) out.push(`${name}: rung ${JSON.stringify(S.rung)} is not one of ${RUNGS.join(', ')}`);
    if (!FORMS.includes(S.form)) out.push(`${name}: form ${JSON.stringify(S.form)} is not 'single' or 'bulk'`);
    if (S.unit !== null && S.unit !== undefined && !(S.unit > 0))
      out.push(`${name}: unit must be a positive number of metres per scene unit, or null`);
    for (const [part, factor] of Object.entries(S.exag || {}))
      if (!(factor > 0)) out.push(`${name}: exag.${part} is ${factor}; it is drawn/true, so it is positive`);
    if (S.sceneUnits && !Array.isArray(S.sceneUnits))
      out.push(`${name}: sceneUnits is a list of field names`);
    for (const [part, target] of Object.entries(S.down || {}))
      if (typeof target !== 'string') out.push(`${name}: down.${part} names ${target}, not a component`);
    return out;
  }

  global.ScaleLadder = { RUNGS, FORMS, index, sameScene, isBelow, validate };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.ScaleLadder;
})(typeof globalThis !== 'undefined' ? globalThis : this);
