/* =============================================================================
 *  kit/scale.js — the scale ladder, as reference
 * =============================================================================
 *  Every component declares one SCALE block beside its global.X = {...} export:
 *
 *      X.SCALE = {
 *        rung:  'cell',                 // one of RUNGS below
 *        form:  'single',               // 'single' | 'bulk'
 *        exag:  { ribosome: 30 },       // drawn / true, per part name
 *        unit:  null,                   // metres per scene unit, or null
 *        sceneUnits: ['width'],         // advertised fields that are scene units, not metres
 *        down:  { membrane: 'Membrane' },   // part name -> component to hand off to
 *      };
 *
 *  RUNG is size: components at the same rung may share a scene, components at
 *  different rungs may not. FORM is how many, orthogonal to rung. UNIT null
 *  means the render is not measurable — no page may print a length off it.
 *  Each component is built and tested on its own, so this file is just the
 *  enum, not an enforcement layer.
 * ========================================================================== */
(function (global) {
  'use strict';

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

  global.ScaleLadder = { RUNGS, FORMS };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.ScaleLadder;
})(typeof globalThis !== 'undefined' ? globalThis : this);
