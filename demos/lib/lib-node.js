/* =====================================================================
 *  lib-node.js — load the WHOLE molecule library under Node.
 *
 *  Pages deliberately load a subset: that is the entire point of splitting
 *  molecules.js into mol-*.js domain files, and water-lab.html not paying for
 *  thirteen sugars is the payoff. The checkers want the opposite — every spec,
 *  every time — so they come through here.
 *
 *  It walks MolLib.DOMAINS rather than listing the files, so adding a domain
 *  file means editing one manifest, not four checkers. That mattered enough to
 *  write down: the recurring doc failure in this repo is an enumeration that
 *  grew a member and wasn't updated, and four hand-maintained copies of the
 *  load order would have been exactly that.
 *
 *  Browser pages never load this file — they use <script> tags in the order
 *  CLAUDE.md's script table records.
 * ===================================================================== */
'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');
const here = f => require(path.join(__dirname, f));

here('palette.js');                          // colours/radii — before molecules.js
const MolLib = here('molecules.js').MolLib;   // core: PALETTE, SCALE, VIEW, registry
here('skel.js');                              // the builder — no dependencies
MolLib.DOMAINS.forEach(here);                 // the specs themselves

/* ---- alternates -------------------------------------------------------
 * A DOMAIN_ALTERNATES entry REPLACES a domain file rather than adding to it:
 * mol-small.js defines the same keys as mol-solvation.js at a different scale,
 * and register() throws if both load. So they cannot go into the registry
 * above — but the checkers still have to see them, or a whole file of specs
 * would never be audited for overlap, provenance or units.
 *
 * Each alternate is therefore loaded in its OWN context, and its specs are
 * merged under a suffixed key (`water [mol-small.js]`). The suffix only ever
 * appears in checker output; nothing looks these up by name. That keeps
 * `check-molecules.js` a plain walk over one object, which is worth more than
 * the slight ugliness in its log.
 */
for (const alt of MolLib.DOMAIN_ALTERNATES || []) {
  const sandbox = { console, Math, JSON, Object, Array, String, Number, Error, Boolean };
  sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);
  const load = f => vm.runInContext(
    fs.readFileSync(path.join(__dirname, f), 'utf8'), ctx, { filename: f });

  load('palette.js');
  load('molecules.js');
  load('skel.js');
  // Everything the alternate does NOT replace, so cross-file references still
  // resolve the way they would on a real page.
  for (const d of MolLib.DOMAINS) if (d !== alt.replaces) load(d);
  load(alt.file);

  const base = new Set(MolLib.DOMAINS.filter(d => d !== alt.replaces));
  for (const [k, spec] of Object.entries(sandbox.MolLib.MOLECULES)) {
    // only the specs the alternate itself contributed
    if (MolLib.MOLECULES[k] && base.size) {
      const same = JSON.stringify(MolLib.MOLECULES[k].atoms) === JSON.stringify(spec.atoms);
      if (same) continue;            // came from a shared domain file
    }
    MolLib.MOLECULES[`${k} [${alt.file}]`] = spec;
  }
}

module.exports = MolLib;
