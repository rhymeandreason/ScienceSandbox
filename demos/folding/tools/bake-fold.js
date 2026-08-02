#!/usr/bin/env node
/* =====================================================================
 *  bake-fold.js — solve the villin fold once, commit the answer.
 *
 *  folding-lab.html used to run the whole 900-frame relaxation in the
 *  browser on every visit: about a second and a half of constraint solving
 *  before the first frame could draw, repeated for every student, every
 *  time, to arrive at a number that is identical each run. The fold is
 *  deterministic — same input file, same solver, same trajectory — so it
 *  belongs on disk next to the structure it came from.
 *
 *  Writes folding/data/1VII.fold.bin. Run it after ANY change to folding.js's solver,
 *  its schedule, or the H-bond cutoffs; folding/tools/check-folding.js re-bakes and
 *  compares, so a stale file fails the build rather than quietly animating
 *  something the current code would not produce.
 *
 *  Run:  node folding/tools/bake-fold.js        (offline, no dependencies)
 * ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const FoldLib = require('../folding.js');

const HERE = path.join(__dirname, '..');   // demos/folding
const SRC = path.join(HERE, 'data', '1VII.pdb');
const OUT = path.join(HERE, 'data', '1VII.fold.bin');

/* Must match folding-lab.html's CORE_RESIDUES: the three phenylalanines are
   in the trajectory as atoms, so baking a different set writes a file with a
   different atom count than the page expects. */
const CORE_RESIDUES = [47, 51, 58];

if (!fs.existsSync(SRC)) {
  console.error('missing ' + path.relative(HERE, SRC));
  process.exit(1);
}

const t0 = Date.now();
const parsed = FoldLib.parse(fs.readFileSync(SRC, 'utf8'), { sideChains: CORE_RESIDUES });
const folder = FoldLib.Folder(parsed);
const traj = folder.bake(FoldLib.BAKE.frames, FoldLib.BAKE.keep);
const buf = Buffer.from(FoldLib.encode(traj));
fs.writeFileSync(OUT, buf);

const formed = folder.formation().filter(x => x > 0.5).length;
console.log(`baked ${traj.count} keyframes x ${traj.atoms} atoms in ${Date.now() - t0} ms`);
console.log(`  lands ${folder.rmsd().toFixed(2)} A RMSD from deposited, ${formed}/${traj.formed[0].length} H-bonds formed`);
console.log(`  wrote ${path.relative(HERE, OUT)} (${(buf.length / 1024).toFixed(0)} KB)`);
