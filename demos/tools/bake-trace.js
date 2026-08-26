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
 *  SECONDARY STRUCTURE IS READ, NOT DETECTED. HELIX and SHEET records
 *  are the depositors' own assignment; RibbonLib.detect() is a geometric
 *  guess and a helix it invents is a claim about the structure that
 *  nothing in the repo checks. A file with no HELIX records bakes as all
 *  coil and SAYS SO in `ssFrom`, so a card drawn from it is visibly a
 *  worm rather than silently wrong.
 *
 *  THE FRAME. Coordinates are written CENTRED — the centroid of every
 *  baked Ca subtracted — because a card frames what it is given and the
 *  crystal's origin is nowhere near the molecule. `centre` records the
 *  vector removed, so anything else baked from the same PDB in the
 *  crystal frame (a surface, a ligand) can be brought into this one by
 *  subtracting the same numbers. A surface baked in a DIFFERENT frame is
 *  the trap bake-surface.js documents at length: right shape, wrong
 *  orientation, and it reads as a bug in the mesh.
 *
 *  0.01 A, which is finer than any deposited coordinate is meaningful to
 *  and is what bake-quaternary.js already writes.
 * ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const FoldLib = require('../folding/folding.js');

const [, , src, want] = process.argv;
if (!src) {
  console.error('usage: node tools/bake-trace.js <file.pdb> [chains]');
  process.exit(1);
}
const text = fs.readFileSync(src, 'utf8');
const only = want ? new Set(want.split(',')) : null;

/* ---- Ca, in file order --------------------------------------------- */

const chains = new Map();          // id -> [{num, x, y, z}]
for (const line of text.split('\n')) {
  if (!line.startsWith('ATOM')) continue;
  if (line.slice(12, 16).trim() !== 'CA') continue;
  // An altLoc other than the first is a second copy of the same residue.
  const alt = line[16];
  if (alt !== ' ' && alt !== 'A') continue;
  const id = line[21] === ' ' ? '_' : line[21];
  if (only && !only.has(id)) continue;
  if (!chains.has(id)) chains.set(id, []);
  chains.get(id).push({
    num: parseInt(line.slice(22, 26), 10),
    x: +line.slice(30, 38), y: +line.slice(38, 46), z: +line.slice(46, 54),
  });
}
if (!chains.size) { console.error('no CA atoms' + (only ? ' on those chains' : '')); process.exit(1); }

/* ---- deposited secondary structure ---------------------------------- */

const ranges = { H: [], E: [] };   // {chain, from, to}
for (const line of text.split('\n')) {
  if (line.startsWith('HELIX ')) {
    ranges.H.push({ chain: line[19], from: parseInt(line.slice(21, 25), 10),
                    to: parseInt(line.slice(33, 37), 10) });
  } else if (line.startsWith('SHEET ')) {
    ranges.E.push({ chain: line[21], from: parseInt(line.slice(22, 26), 10),
                    to: parseInt(line.slice(33, 37), 10) });
  }
}
const ssFrom = (ranges.H.length || ranges.E.length) ? 'deposited' : 'none';

/* ---- centre once, over every chain kept ----------------------------- */

let cx = 0, cy = 0, cz = 0, n = 0;
for (const res of chains.values()) for (const r of res) { cx += r.x; cy += r.y; cz += r.z; n++; }
cx /= n; cy /= n; cz /= n;

const r2 = v => Math.round(v * 100) / 100;
const out = { source: path.basename(src), ssFrom,
              centre: [r2(cx), r2(cy), r2(cz)],
              order: [], chains: {} };

let radius = 0;
for (const [id, res] of chains) {
  /* SS is indexed by the residue's own NUMBER, not by its position in the
     array: a chain with a gap (an unmodelled loop) would otherwise slide
     every letter after the gap onto the wrong residue. */
  const ss = res.map(r => {
    for (const h of ranges.H) if (h.chain === id && r.num >= h.from && r.num <= h.to) return 'H';
    for (const e of ranges.E) if (e.chain === id && r.num >= e.from && r.num <= e.to) return 'E';
    return 'C';
  }).join('');
  out.order.push(id);
  /* The COUNT comes from the records, never from the letters: adjacent
     helices touch, so 2HHB's eight per chain read as six runs of H once
     they are stamped onto residues. A page that says "eight helices" has to
     say it from here — the trap CLAUDE.md names about numbers in prose. */
  out.chains[id] = {
    first: res[0].num,
    /* EVERY residue number, not just the first. A trace that carries only
       `first` describes a chain as contiguous, and an unmodelled loop then
       reads as a chain that simply skips: the ribbon splines a smooth band
       across coordinates nobody measured, and at ribbon width that is
       indistinguishable from data. With the numbers here a consumer can
       break the band where the chain breaks. 7LNA orders 95-227 and models
       nothing for 194-196, which is what this exists for. */
    nums: res.map(r => r.num),
    helices: ranges.H.filter(h => h.chain === id).length,
    strands: ranges.E.filter(e => e.chain === id).length,
    CA: res.map(r => {
      const p = [r2(r.x - cx), r2(r.y - cy), r2(r.z - cz)];
      radius = Math.max(radius, Math.hypot(p[0], p[1], p[2]));
      return p;
    }),
    ss,
  };
}
out.radius = r2(radius);

/* ---- the presentation frame ----

   Solved, not typed, and only when the shape earns it. A deposited frame is
   a crystal or an EM box, so there is nothing in it worth preserving; what a
   reader needs is the structure's own axes, longest across the frame and
   shortest into the screen. That is what makes a fibril rung read as one
   molecule thick instead of as a squiggle seen end-on.

   `worth:false` means the three extents are too close to tell apart — a
   globular domain, whose axes are noise and whose solved basis would flip
   between rebakes. No `view` is written, the trace opens in the deposited
   frame, and a human picks one. FoldLib.viewBasis carries the handedness
   guard: a basis assembled by hand mirrors the protein half the time, and
   nothing downstream can see it. */
const all = [];
for (const id of out.order) for (const p of out.chains[id].CA) all.push(p);
const V = FoldLib.viewBasis(all);
if (V.worth) out.view = V.R.map(ax => ax.map(r2));
out.extents = V.ext.map(r2);

const dst = src.replace(/\.pdb$/i, '') + '.trace.json';
fs.writeFileSync(dst, JSON.stringify(out));
const kb = (fs.statSync(dst).size / 1024).toFixed(0);
const breaks = out.order.reduce((k, id) => k + out.chains[id].nums
  .filter((v, i, a) => i && v !== a[i - 1] + 1).length, 0);
console.log(dst + '  ' + out.order.length + ' chains, ' + n + ' residues, ' +
            (breaks ? breaks + ' chain break(s), ' : '') +
            'ss ' + ssFrom + ', radius ' + out.radius + ' A, ' +
            out.extents.join(' x ') + ' A, ' +
            (out.view ? 'view solved' : 'view left to a human') + ', ' + kb + ' KB');
