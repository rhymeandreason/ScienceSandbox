#!/usr/bin/env node
/* =====================================================================
 *  bake-trace.js — a deposited PDB down to what a RIBBON needs, and
 *  nothing else.
 *
 *    node tools/bake-trace.js hemoglobin/data/2HHB.pdb A,B,C,D
 *
 *  writes <input>.trace.json beside the source.
 *
 * ---------------------------------------------------------------------
 *  WHY BAKE AT ALL. A ribbon needs a Ca trace and a secondary-structure
 *  letter per residue. 2HHB.pdb is 453 KB of text to yield 574 Ca, and a
 *  card that parses it is parsing 60,000 atom records it throws away.
 *  The trace is ~40 KB of JSON, gzips to a fraction of that, and is
 *  JSON.parse rather than a line loop.
 *
 *  THE COMMAND LINE IS ALL THAT LIVES HERE. Reading the file is
 *  `proteins/bake-lib.js` — the altloc rule, secondary structure read
 *  rather than detected, the residue-number indexing, `nums` riding along
 *  with `first`, the centring and the solved frame, each with the trap it
 *  exists to prevent. This file was a fourth copy of that until the
 *  extraction; what it does now is take a path, take an optional chain
 *  list, and print what it wrote.
 *
 *  A PROTEIN WITH A BENCH OF ITS OWN does not use this — it gets a baker
 *  under `proteins/<name>/tools/`, because choosing entries, cutting them
 *  down and saying what they claim is work with a human in it, and this
 *  is a one-file conversion with none. Both build the same shape from the
 *  same library. `AddingAProtein.md` is when to write which.
 * ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const Bake = require('../proteins/bake-lib.js');

const [, , src, want] = process.argv;
if (!src) {
  console.error('usage: node tools/bake-trace.js <file.pdb> [chains]');
  process.exit(1);
}

const text = fs.readFileSync(src, 'utf8');
const only = want ? new Set(want.split(',')) : null;

const chains = Bake.caTrace(text, only);
if (!chains.size) {
  console.error('no CA atoms' + (only ? ' on those chains' : ''));
  process.exit(1);
}

const R = Bake.ssRanges(text);
const T = Bake.assemble(chains, R);

const out = { source: path.basename(src), ssFrom: Bake.ssFrom(R), centre: T.centre,
              order: T.order, chains: T.chains, radius: T.radius };

const all = [];
for (const id of out.order) for (const p of out.chains[id].CA) all.push(p);
const F = Bake.frameOf(all);
if (F.view) out.view = F.view;
out.extents = F.extents;

const dst = src.replace(/\.pdb$/i, '') + '.trace.json';
fs.writeFileSync(dst, JSON.stringify(out));
const kb = (fs.statSync(dst).size / 1024).toFixed(0);
const n = out.order.reduce((k, id) => k + out.chains[id].nums.length, 0);
const breaks = Bake.breaks(out);
console.log(dst + '  ' + out.order.length + ' chains, ' + n + ' residues, ' +
            (breaks ? breaks + ' chain break(s), ' : '') +
            'ss ' + out.ssFrom + ', radius ' + out.radius + ' A, ' +
            out.extents.join(' x ') + ' A, ' +
            (out.view ? 'view solved' : 'view left to a human') + ', ' + kb + ' KB');
