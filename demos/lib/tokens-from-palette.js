/* =====================================================================
 *  tokens-from-palette.js — publishes palette.js to CSS.
 *
 *  Load in <head>, straight after palette.js and before the first paint:
 *
 *      <script src="palette.js"></script>
 *      <script src="tokens-from-palette.js"></script>
 *
 *  The atom and bond colours existed twice, in two formats, and had drifted:
 *  sandbox.css said oxygen was #e6362f while the renderer drew #d6362e, so a
 *  caption's coloured O was a slightly different red from the sphere it named.
 *  Sodium, chloride and hydrogen were off by similar amounts. Rather than copy
 *  the numbers across and hope, the ints become custom properties at load, so
 *  editing palette.js moves the type and the molecule together.
 *
 *  Writes --atom-O ..., --bond-hbond ... and --base-G ..., plus the bare
 *  --O / --Na / --Cl / --K names the older pages still use. When nothing greps for those, the
 *  second loop goes.
 * ===================================================================== */
(function (global) {
  'use strict';

  const P = global.MolPalette;
  if (!P) { console.warn('tokens-from-palette: palette.js must load first'); return; }

  const css = global.document.documentElement.style;
  const hex = n => '#' + n.toString(16).padStart(6, '0');

  for (const [el, n] of Object.entries(P.atoms)) css.setProperty('--atom-' + el, hex(n));
  for (const [name, n] of Object.entries(P.bonds)) css.setProperty('--bond-' + name, hex(n));
  for (const [b, n] of Object.entries(P.bases)) css.setProperty('--base-' + b, hex(n));

  // legacy bare-element names
  for (const [el, n] of Object.entries(P.atoms)) css.setProperty('--' + el, hex(n));
})(typeof window !== 'undefined' ? window : globalThis);
