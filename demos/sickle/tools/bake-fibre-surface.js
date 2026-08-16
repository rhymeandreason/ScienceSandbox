#!/usr/bin/env node
/* =====================================================================
 *  bake-fibre-surface.js — 2HBS tetramer 1 -> sickle/data/2HBS-T1.surf.bin
 *
 *  The solvent-excluded surface of the ONE body the fibre repeats, so
 *  fibre-test.html can draw the assembly as surfaces instead of tubes.
 *
 *  The algorithm is tools/ses.js and the file format is
 *  hemoglobin/tools/bake-surface.js — both reused, neither reimplemented.
 *  What is specific to this file is small and all of it is about frames and
 *  budgets:
 *
 *  WHICH ATOMS. Chains A-D only: tetramer 1 of 2HBS's asymmetric unit, the
 *  body every instance in the fibre is a copy of. Tetramer 2 is NOT baked —
 *  the lateral operation puts it there at draw time, exactly as it does for
 *  the tube, so a second surface would be the same mesh stored twice and,
 *  worse, a second thing to keep in register.
 *
 *  WHICH FRAME. fibre.json's, which means subtracting the centroid that
 *  bake-fibre.js subtracted — read out of that file rather than recomputed,
 *  so the two cannot drift. A surface half an angstrom out of register with
 *  its own tube reads as a bug in the surface code.
 *
 *  WHY THE SPACING IS COARSER THAN hemoglobin's. bake-surface.js uses
 *  0.7 A, which gives a beautiful 128k-triangle skin for a page that draws
 *  ONE molecule. This page draws up to 420 of them: at 0.7 that is 54M
 *  triangles, which no machine this repo targets will hold. The grid is
 *  therefore coarser, and the cost of that is real — see the comparison
 *  this file prints. A surface is the one representation here whose fidelity
 *  is traded directly against how many molecules can be on screen.
 *
 *  Run:  node sickle/tools/bake-fibre-surface.js [--spacing 1.1]
 * ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const SES = require('../../tools/ses.js');
const { readAtoms, tagResidues, encode } = require('../../hemoglobin/tools/bake-surface.js');

const SRC = path.join(__dirname, '../../hemoglobin/data/2HBS.pdb');
const FIBRE = path.join(__dirname, '../data/fibre.json');
const OUT = path.join(__dirname, '../data/2HBS-T1.surf.bin');

const T1 = new Set(['A', 'B', 'C', 'D']);

/* 1.1 A against hemoglobin's 0.7. Chosen by looking at the printed table:
   it is the coarsest grid that still closes every reentrant patch cleanly
   (watertight, positive volume, area within a few percent of the fine bake)
   while bringing a 420-instance fibre inside a budget a laptop can draw. */
const SPACING = 1.1;

function main() {
  const argS = process.argv.indexOf('--spacing');
  const spacing = argS > 0 ? +process.argv[argS + 1] : SPACING;

  const D = JSON.parse(fs.readFileSync(FIBRE, 'utf8'));
  const centre = D.centre;
  if (!centre) throw new Error('fibre.json has no `centre` — re-run bake-fibre.js');

  /* Identity rotation: 2HBS's own frame is the frame fibre.json works in,
     modulo the centring below. Unlike the haemoglobin bake there is no
     orient() matrix to re-derive, because nothing here solved one. */
  const I = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const raw = fs.readFileSync(SRC, 'utf8');
  const { atoms, residues, skipped } = readAtoms(raw, I);

  /* Keep tetramer 1, and centre it. readAtoms tags each atom with an index
     into `residues`, which is what carries the chain. */
  const keep = atoms.filter(a => T1.has(residues[a.res].chain));
  for (const a of keep) a.p = a.p.map((v, k) => v - centre[k]);

  const chainsSeen = [...new Set(keep.map(a => residues[a.res].chain))].sort();
  console.log('2HBS chains ' + chainsSeen.join('') + ': ' + keep.length + ' atoms over ' +
              new Set(keep.map(a => a.res)).size + ' residues');
  console.log('  excluded het: ' + ([...skipped].map(([k, v]) => k + ' x' + v).join(', ') || 'none'));
  console.log('  centred on fibre.json centre [' + centre.join(', ') + ']');

  const t0 = Date.now();
  const mesh = SES.build(keep, { spacing, probe: SES.PROBE });
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  const { volume, area } = SES.measure(mesh);
  const wt = SES.watertight(mesh);

  console.log('  grid ' + mesh.dims.join(' x ') + ' at ' + spacing + ' A  ->  ' +
              mesh.nVert + ' verts, ' + mesh.nTri + ' tris in ' + secs + 's');
  console.log('  area ' + area.toFixed(0) + ' A^2, volume ' + volume.toFixed(0) + ' A^3');
  if (!wt.ok) throw new Error('mesh is not closed: ' + wt.bad + ' unpaired edges');
  if (volume <= 0) throw new Error('mesh is inside out');

  /* What this costs at the scales the page actually offers. Printed rather
     than assumed, because the whole reason the spacing is coarse is this
     table and it should be re-read whenever the spacing changes. */
  console.log('  fibre cost:');
  for (const [n, what] of [[2, 'one contact'], [24, 'double strand, 12 repeats'],
                           [168, 'fibre, 7 x 12'], [420, 'fibre, 7 x 30 (max)']])
    console.log('    x' + String(n).padStart(3) + '  ' +
                (mesh.nTri * n / 1e6).toFixed(1) + 'M triangles   ' + what);

  const resIdx = tagResidues(mesh, keep);
  const buf = encode(mesh, resIdx, residues, {
    source: '2HBS',
    spacing, probe: SES.PROBE, radii: 'Bondi 1964 (N: Rowland & Taylor 1996)',
    atoms: keep.length, area: +area.toFixed(1), volume: +volume.toFixed(1),
    chains: chainsSeen.join(''),
    note: 'tetramer 1 (A-D) of 2HBS, centred on fibre.json `centre`. Coarser ' +
          'grid than hemoglobin/data/2HHB.surf.bin on purpose: this mesh is ' +
          'instanced up to 420 times.',
  });
  fs.writeFileSync(OUT, buf);
  console.log('  wrote ' + path.relative(process.cwd(), OUT) +
              '  ' + (buf.length / 1024).toFixed(0) + ' KB');
}

if (require.main === module) main();
