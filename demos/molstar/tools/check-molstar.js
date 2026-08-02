#!/usr/bin/env node
/* =====================================================================
 *  check-molstar.js — asserts what molstar/tools/fold2pdb.js claims.
 *
 *  The exported PDB is a format conversion, so the only defensible claim
 *  is that it changed nothing. That is what is checked here: the text file
 *  must reproduce the .bin to the precision the text format allows, and
 *  must land where the solver says it lands.
 *
 *  THE ORIENT TRAP, recorded because it wasted an hour. `folding.js`'s
 *  Folder calls orient() on the parsed structure, which rewrites every
 *  node's `native` into a principal-axis frame. The trajectory is baked in
 *  that frame. So comparing an exported frame against a freshly-parsed
 *  1VII.pdb compares two different bases and reports ~4.4 A — a number
 *  that looks like a real error and is not one. Call FoldLib.orient(parsed)
 *  first. The value only means something once both sides share a frame.
 *
 *  Run:  node molstar/tools/check-molstar.js     (offline, no dependencies)
 *  Requires molstar/data/1VII.fold.pdb — run fold2pdb.js first.
 * ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const FoldLib = require('../../folding/folding.js');

const HERE = path.join(__dirname, '..');
const FOLD = path.join(HERE, '..', 'folding');
const PDB = path.join(HERE, 'data', '1VII.fold.pdb');
const CORE_RESIDUES = [47, 51, 58];

/* What bake-fold.js reports for the committed trajectory. If the solver
   changes these move, and BOTH files must be regenerated — same staleness
   trap folding/tools/check-folding.js exists to catch on the .bin. */
const FINAL_RMSD = 0.77;      // A, last frame vs deposited
const MIN_START_RMSD = 25;    // A, first frame must still be extended
const TEXT_PRECISION = 0.0005; // A, %.3f rounding

let fails = 0;
const ok = (label, pass, detail) => {
  console.log(`  ${pass ? 'ok  ' : 'FAIL'}  ${label}${detail ? '  — ' + detail : ''}`);
  if (!pass) fails++;
};

if (!fs.existsSync(PDB)) {
  console.error('missing molstar/data/1VII.fold.pdb — run: node molstar/tools/fold2pdb.js');
  process.exit(1);
}

const parsed = FoldLib.parse(fs.readFileSync(path.join(FOLD, 'data', '1VII.pdb'), 'utf8'),
                             { sideChains: CORE_RESIDUES });
FoldLib.orient(parsed);                       // see THE ORIENT TRAP above
const bin = fs.readFileSync(path.join(FOLD, 'data', '1VII.fold.bin'));
const traj = FoldLib.decode(bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength));

const lines = fs.readFileSync(PDB, 'utf8').split('\n');
const models = [];
let cur = null;
for (const l of lines) {
  if (l.startsWith('MODEL')) { cur = []; continue; }
  if (l.startsWith('ENDMDL')) { models.push(cur); cur = null; continue; }
  if (cur && l.startsWith('ATOM')) cur.push([+l.slice(30, 38), +l.slice(38, 46), +l.slice(46, 54)]);
}

console.log('== exported trajectory matches the bake');
ok('model count', models.length === traj.count, `${models.length} vs ${traj.count} keyframes`);
ok('atom count', models[0].length === traj.atoms, `${models[0].length} vs ${traj.atoms}`);

let worst = 0;
for (let k = 0; k < Math.min(models.length, traj.count); k++)
  for (let i = 0; i < traj.atoms; i++)
    for (let c = 0; c < 3; c++)
      worst = Math.max(worst, Math.abs(traj.key[k][i*3 + c] - models[k][i][c]));
ok('coordinates round-trip', worst <= TEXT_PRECISION, `max ${worst.toFixed(4)} A (%.3f allows ${TEXT_PRECISION})`);

const rmsd = frame => {
  let s = 0;
  parsed.nodes.forEach((n, i) => { for (let c = 0; c < 3; c++) s += (frame[i][c] - n.native[c]) ** 2; });
  return Math.sqrt(s / parsed.nodes.length);
};
const final = rmsd(models[models.length - 1]);
const start = rmsd(models[0]);
ok('final frame lands on the deposited fold', Math.abs(final - FINAL_RMSD) < 0.01,
   `${final.toFixed(2)} A, expected ${FINAL_RMSD}`);
ok('first frame is still extended', start > MIN_START_RMSD,
   `${start.toFixed(2)} A from folded`);

console.log('\n== PDB is well-formed');
const atoms = lines.filter(l => l.startsWith('ATOM'));
ok('atom names sit in the element-aligned columns',
   atoms.every(l => /^.{12}( [A-Z][A-Z0-9]{0,2}|[A-Z]{4}) /.test(l)));
ok('every line fits the fixed-column record', atoms.every(l => l.length >= 78));
ok('element column populated', atoms.every(l => /[A-Z]/.test(l.slice(76, 78))));
ok('file terminates', lines.some(l => l.startsWith('END')));

console.log(fails ? `\nFAIL: ${fails} check(s) failed` : '\nPASS: export is faithful to the bake');
process.exit(fails ? 1 : 0);
