#!/usr/bin/env node
/* =====================================================================
 *  bake-card-surface.js — a CARD-tier solvent-excluded surface, in the
 *  frame its trace already uses.
 *
 *    node tools/bake-card-surface.js hemoglobin/data/2HHB.pdb A,B,C,D
 *
 *  reads  <input>.trace.json   (for the frame — bake the trace first)
 *  writes <input>.card.surf.bin
 *
 * ---------------------------------------------------------------------
 *  WHY A SECOND SURFACE AT ALL. hemoglobin/data/2HHB.surf.bin is 1.5 MB
 *  at 0.7 A, which is the resolution a full-screen lesson looking for
 *  one residue's patch needs. A card is 280 px, and the reader toggling
 *  a surface on one is asking a shape question, not a residue question.
 *  Coarser grid, and the file lands in the low hundreds of KB — the
 *  difference between a toggle that answers and one you wait on.
 *
 *  THE FRAME IS THE WHOLE POINT. 2HHB.surf.bin is baked in the frame
 *  FoldLib.orient() solved from chain B, because hemoglobin-lab's fold
 *  lives there. A card's ribbon comes from bake-trace.js, which is the
 *  crystal frame centred on the Ca it kept. Two frames, and a surface
 *  that is the right shape in the wrong orientation reads as a bug in
 *  the mesh rather than as a missing rotation. So the frame is not
 *  re-derived here — it is READ from the trace, which makes them the
 *  same by construction and not by two files agreeing today.
 *
 *  Same encoder as bake-surface.js (required, not copied): one writer,
 *  one reader, and SurfLib decodes this exactly as it decodes the other.
 * ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const SES = require('./ses.js');
const { readAtoms, tagResidues, encode } = require('../hemoglobin/tools/bake-surface.js');

/* 1.4 A against the lesson tier's 0.7. Measured on 2HHB: 0.7 is 1.5 MB, 1.1 is
   608 KB, 1.4 is 362 KB, 1.7 is 266 KB, 2.0 is 190 KB. 1.4 is where the shape is
   still the protein's and the file is small enough that the toggle answers
   rather than makes the reader wait. Below it the lobes read as lumps, and the
   bytes saved are ~170 KB once, on a click. */
const SPACING = 1.4;

const [, , src, want, sp] = process.argv;
if (!src) {
  console.error('usage: node tools/bake-card-surface.js <file.pdb> [chains] [spacing]');
  process.exit(1);
}
const spacing = sp ? +sp : SPACING;
const tracePath = src.replace(/\.pdb$/i, '') + '.trace.json';
if (!fs.existsSync(tracePath)) {
  console.error('no ' + tracePath + ' — run bake-trace.js first, it owns the frame');
  process.exit(1);
}
const trace = JSON.parse(fs.readFileSync(tracePath, 'utf8'));
const only = want ? new Set(want.split(',')) : new Set(trace.order);

const I = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
const raw = fs.readFileSync(src, 'utf8');
const all = readAtoms(raw, I);

/* The chains the card draws, and the hetero groups readAtoms kept — a heme
   left out would open a hole in the surface exactly where the pocket is. */
const keep = [];
for (const a of all.atoms) {
  const r = all.residues[a.res];
  if (!only.has(r.chain)) continue;
  keep.push({ p: [a.p[0] - trace.centre[0], a.p[1] - trace.centre[1],
                  a.p[2] - trace.centre[2]], r: a.r, res: a.res });
}
if (!keep.length) { console.error('no atoms on those chains'); process.exit(1); }

const t0 = Date.now();
const mesh = SES.build(keep, { spacing, probe: SES.PROBE });
const { volume, area } = SES.measure(mesh);
const wt = SES.watertight(mesh);
if (!wt.ok) throw new Error('mesh is not closed: ' + wt.bad + ' unpaired edges');
if (volume <= 0) throw new Error('mesh is inside out');

const buf = encode(mesh, tagResidues(mesh, keep), all.residues, {
  source: path.basename(src, '.pdb') + ' (card tier)',
  spacing, probe: SES.PROBE, chains: [...only].join(''),
  atoms: keep.length, area: +area.toFixed(1), volume: +volume.toFixed(1),
  note: 'frame read from ' + path.basename(tracePath) +
        ': crystal coordinates less that file\'s `centre`. Coarse on purpose.',
});
const dst = src.replace(/\.pdb$/i, '') + '.card.surf.bin';
fs.writeFileSync(dst, buf);
console.log(dst + '  ' + mesh.nVert + ' verts, ' + mesh.nTri + ' tris at ' +
            spacing + ' A in ' + ((Date.now() - t0) / 1000).toFixed(1) + 's, ' +
            (buf.length / 1024).toFixed(0) + ' KB');
