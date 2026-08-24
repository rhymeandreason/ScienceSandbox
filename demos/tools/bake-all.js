#!/usr/bin/env node
/* =====================================================================
 *  bake-all.js — regenerate every derived data file from the structures
 *  committed beside them.
 *
 *  WHY THIS EXISTS. The repo commits both halves of the pipeline: the
 *  deposited `.pdb` a baker reads, and the `.bin`/`.json` it writes. The
 *  inputs are committed because they are not reproducible on demand — an
 *  entry gets superseded, a download URL moves — so git is the pin on the
 *  exact structure a lesson was checked against. The outputs are committed
 *  because a student's browser must not re-solve a fold. Neither half tells
 *  a person who just cloned this how to get from one to the other, and the
 *  bakers are spread across seven folders. This is that list, executable.
 *
 *  Every input a step names is already in the clone. Nothing here downloads
 *  anything, and nothing here needs a key.
 *
 *      node tools/bake-all.js --list        what would run, and what it writes
 *      node tools/bake-all.js               run all of it (about 3-5 minutes)
 *      node tools/bake-all.js hemoglobin    only steps whose id contains this
 *      node tools/bake-all.js --check       verify inputs exist, run nothing
 *
 *  A step's outputs are compared byte-for-byte against what was there
 *  before, and the run says which files CHANGED. On an untouched clone the
 *  answer should be none: a baker is deterministic, so a rebuild that moves
 *  bytes means a solver changed, and `git diff --stat` is then the report
 *  worth reading. That is the check this script is really for.
 *
 *  NOT INCLUDED, deliberately:
 *
 *    hemoglobin/tools/bake-hb.js   superseded by bake-unfold.js, and it
 *                                  refuses to run. Both write the same
 *                                  file; running the wrong one silently
 *                                  regresses the fold.
 *    tools/bake-flat2d.js          needs `npm i @rdkit/rdkit`, and writes
 *    tools/spec2smiles.js          into hand-authored spec files rather
 *                                  than a file it owns. Run those by hand,
 *                                  with the diff in front of you.
 *    tools/check-handedness.js     a checker, not a baker, and the only one
 *                                  that needs the network.
 * ===================================================================== */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');

/* Ordered. Two dependencies are real and the order encodes them:
   sickle/bake-fibre writes the fibre.json that bake-fibre-surface reads,
   and both sickle bakers read hemoglobin's structures rather than copies. */
const STEPS = [
  { id: 'residues',
    run: 'tools/bake-residues.js',
    reads: [],
    writes: ['residues.js'],
    note: 'the amino-acid table, from the spec library rather than a structure' },

  { id: 'dna-helix',
    run: 'dna/bake-helix.js',
    reads: ['dna/data/1BNA.pdb'],
    writes: ['dna/data/helix.json'] },

  { id: 'dna-ladder',
    run: 'dna/bake-ladder.js',
    reads: ['dna/data/1BNA.pdb'],
    writes: ['dna/data/bdna.js'] },

  { id: 'folding-fold',
    run: 'folding/tools/bake-fold.js',
    reads: ['folding/data/1VII.pdb'],
    writes: ['folding/data/1VII.fold.bin'],
    note: 'villin, the small fold' },

  { id: 'folding-villin',
    run: 'folding/tools/bake-villin.js',
    reads: ['folding/data/AF-P02640-villin.pdb', 'folding/data/AF-P02640-F1-pae_v6.json'],
    writes: ['folding/data/AF-P02640-villin.poses.bin'],
    note: 'the domain split reads AlphaFold’s 826x826 PAE matrix' },

  { id: 'folding-actin',
    run: 'folding/tools/bake-actin.js',
    reads: ['folding/data/9ZZI.pdb', 'folding/data/9JUS.pdb'],
    writes: ['folding/data/actin.bin'] },

  { id: 'hemoglobin-unfold',
    run: 'hemoglobin/tools/bake-unfold.js',
    reads: ['hemoglobin/data/2HHB.pdb'],
    writes: ['hemoglobin/data/2HHB-B.fold.bin'],
    note: 'the slow one, about a minute. hemoglobin-lab fetches this' },

  { id: 'hemoglobin-quaternary',
    run: 'hemoglobin/tools/bake-quaternary.js',
    reads: ['hemoglobin/data/2HHB.pdb'],
    writes: ['hemoglobin/data/2HHB-quaternary.json'],
    note: 'level 4’s other three chains. hemoglobin-lab fetches this' },

  { id: 'hemoglobin-surface',
    run: 'hemoglobin/tools/bake-surface.js',
    reads: ['hemoglobin/data/2HHB.pdb'],
    writes: ['hemoglobin/data/2HHB.surf.bin'] },

  { id: 'hemoglobin-hbs',
    run: 'hemoglobin/tools/bake-hbs.js',
    reads: ['hemoglobin/data/2HHB.pdb', 'hemoglobin/data/2HBS.pdb'],
    writes: ['hemoglobin/data/2HBS-T1-quaternary.json', 'hemoglobin/data/2HBS-T1.surf.bin'],
    note: 'the sickle variant, against the normal one' },

  { id: 'hexokinase-closure',
    run: 'hexokinase/tools/bake-closure.js',
    reads: ['hexokinase/data/2YHX.pdb', 'hexokinase/data/1IG8.pdb',
            'hexokinase/data/1HKG.pdb', 'hexokinase/data/3B8A.pdb'],
    writes: ['hexokinase/data/HK.closure.bin', 'hexokinase/data/HK.closure.json'] },

  { id: 'membrane-pump',
    run: 'membrane/tools/bake-pump.js',
    reads: ['membrane/data/7E1Z-opm.pdb', 'membrane/data/7E20-opm.pdb'],
    writes: ['membrane/data/7E1Z.surf.bin', 'membrane/data/7E20.surf.bin'],
    note: 'two 5.6 MB meshes; the largest write here' },

  { id: 'sickle-fibre',
    run: 'sickle/tools/bake-fibre.js',
    reads: ['hemoglobin/data/2HBS.pdb'],
    writes: ['sickle/data/fibre.json'],
    note: 'must precede sickle-fibre-surface, which reads what it writes' },

  { id: 'sickle-fibre-surface',
    run: 'sickle/tools/bake-fibre-surface.js',
    reads: ['hemoglobin/data/2HBS.pdb', 'sickle/data/fibre.json'],
    writes: ['sickle/data/2HBS-T1.surf.bin'] },

  { id: 'sickle',
    run: 'sickle/tools/bake-sickle.js',
    reads: ['hemoglobin/data/2HHB.pdb', 'hemoglobin/data/2HBS.pdb'],
    writes: ['sickle/data/sickle.json'] },
];

const args = process.argv.slice(2);
const LIST = args.includes('--list');
const CHECK = args.includes('--check');
const filter = args.filter(a => !a.startsWith('--'))[0] || null;

const chosen = filter ? STEPS.filter(s => s.id.includes(filter)) : STEPS;
if (!chosen.length) {
  console.error(`no step matches "${filter}". Ids: ${STEPS.map(s => s.id).join(', ')}`);
  process.exit(1);
}

const kb = n => n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.round(n / 1024) + ' KB';
const sizeOf = f => { try { return fs.statSync(path.join(ROOT, f)).size; } catch { return null; } };
const hashOf = f => {
  try { return crypto.createHash('sha1').update(fs.readFileSync(path.join(ROOT, f))).digest('hex'); }
  catch { return null; }
};

if (LIST) {
  for (const s of chosen) {
    console.log(`\n  ${s.id}`);
    console.log(`    run     node ${s.run}`);
    if (s.reads.length) console.log(`    reads   ${s.reads.join('\n            ')}`);
    console.log(`    writes  ${s.writes.map(w => `${w}  (${sizeOf(w) === null ? 'ABSENT' : kb(sizeOf(w))})`).join('\n            ')}`);
    if (s.note) console.log(`    note    ${s.note}`);
  }
  console.log(`\n  ${chosen.length} step(s). Nothing was run.\n`);
  process.exit(0);
}

/* Preflight. A missing input is the one failure worth catching before any
   step runs, because the bakers are minutes apart and the reason is always
   the same: the file is committed, so a clone has it and a working tree
   that does not has lost it. */
let missing = 0;
for (const s of chosen) {
  for (const f of s.reads) {
    if (sizeOf(f) === null) { console.log(`  MISSING  ${f}  (needed by ${s.id})`); missing++; }
  }
}
if (missing) {
  console.log(`\n  ${missing} input(s) missing. Every one is committed — \`git checkout -- demos/\`\n` +
              `  restores them. Nothing here downloads a structure, on purpose.\n`);
  process.exit(1);
}
console.log(`  inputs   ok, ${new Set(chosen.flatMap(s => s.reads)).size} file(s)`);

if (CHECK) { console.log('\n  --check: nothing was run.\n'); process.exit(0); }

const before = new Map();
for (const s of chosen) for (const w of s.writes) before.set(w, hashOf(w));

const changed = [];
let failed = 0;
for (const s of chosen) {
  const t0 = Date.now();
  process.stdout.write(`\n  ${s.id} ... `);
  try {
    execFileSync(process.execPath, [path.join(ROOT, s.run)], { cwd: ROOT, stdio: 'pipe' });
  } catch (e) {
    failed++;
    console.log(`FAILED after ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    console.log(String(e.stderr || e.message).split('\n').map(l => '      ' + l).join('\n'));
    continue;
  }
  console.log(`${((Date.now() - t0) / 1000).toFixed(1)}s`);
  for (const w of s.writes) {
    const now = hashOf(w);
    if (now === null) { console.log(`      ${w}  NOT WRITTEN`); failed++; }
    else if (now !== before.get(w)) { changed.push(w); console.log(`      ${w}  CHANGED  ${kb(sizeOf(w))}`); }
  }
}

console.log('');
if (failed) {
  console.log(`  FAIL: ${failed} step(s) or output(s) did not come through.\n`);
  process.exit(1);
}
if (changed.length) {
  console.log(`  ${changed.length} file(s) changed. The bakers are deterministic, so on an\n` +
              `  untouched clone this should be zero — read \`git diff --stat\` and be sure\n` +
              `  a solver changed on purpose.\n`);
} else {
  console.log(`  PASS: every output rebuilt byte-for-byte identical.\n`);
}
