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

const path = require('path');
const here = f => require(path.join(__dirname, f));

const MolLib = here('molecules.js').MolLib;   // core: PALETTE, SCALE, VIEW, registry
here('skel.js');                              // builder; reads SCALE back off MolLib
MolLib.DOMAINS.forEach(here);                 // the specs themselves

module.exports = MolLib;
