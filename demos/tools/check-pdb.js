#!/usr/bin/env node
/* =====================================================================
 *  check-pdb.js — assertions for pdb.js's orientation.
 *
 *  pdb.js rotates deposited coordinates onto their principal axes. That is a
 *  transform applied to a molecule nobody here authored, so it needs the same
 *  standard of proof as a hand-typed spec: MolecularGeometry.md §1.4 rule 2 —
 *  a chemical claim ships with the assertion that checks it.
 *
 *  The claim is "this is a rotation" and it has three parts:
 *
 *   1. WELL-FORMED   coordinates land in columns 31-54 and still parse. The
 *                    fields are fixed-width; an off-by-one silently corrupts
 *                    every atom.
 *   2. RIGID         interatomic distances survive (rounding only).
 *   3. SAME HAND     chirality survives. This is the one that matters and the
 *                    one distance-checking CANNOT catch, because a mirror
 *                    preserves every distance. We compare the SIGNED volume of
 *                    a fixed atom quadruple before and after; the sign flips
 *                    if and only if the structure was mirrored.
 *
 *  Run:  node tools/check-pdb.js        (offline, no dependencies)
 * ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const PDB = require('../pdb.js');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'pdb');
let failures = 0;

const fail = (what, msg) => { console.log(`  FAIL  ${what}: ${msg}`); failures++; };
const ok   = msg => console.log(`  ok    ${msg}`);

const atoms = text => {
  const out = [];
  for (const l of text.split('\n'))
    if (l.startsWith('ATOM') || l.startsWith('HETATM'))
      out.push([+l.slice(30, 38), +l.slice(38, 46), +l.slice(46, 54)]);
  return out;
};

// signed volume of the tetrahedron on four atoms — sign IS the handedness
const chirality = (P, i, j, k, l) => {
  const s = (a, b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
  const u = s(P[j], P[i]), v = s(P[k], P[i]), w = s(P[l], P[i]);
  return u[0]*(v[1]*w[2] - v[2]*w[1])
       - u[1]*(v[0]*w[2] - v[2]*w[0])
       + u[2]*(v[0]*w[1] - v[1]*w[0]);
};

const dist = (P, i, j) => Math.hypot(P[i][0]-P[j][0], P[i][1]-P[j][1], P[i][2]-P[j][2]);

const files = fs.existsSync(DIR)
  ? fs.readdirSync(DIR).filter(f => f.endsWith('.pdb')).sort()
  : [];

if (!files.length) {
  console.log('no pdb/*.pdb to check');
  process.exit(0);
}

for (const file of files) {
  const raw = fs.readFileSync(path.join(DIR, file), 'utf8');
  const A = atoms(raw);
  if (A.length < 5) { fail(file, 'fewer than 5 atoms parsed — wrong columns?'); continue; }

  // every orientation the library can produce, including the axis swap that
  // long:'y' performs — swapping two rows is exactly how a mirror gets in
  const MODES = [
    { mode: 'pca',  long: 'x' },
    { mode: 'pca',  long: 'y' },
    { mode: 'axis' }
  ];

  for (const opts of MODES) {
    const B = atoms(PDB.orient(raw, opts));
    const tag = `${file} ${opts.mode}${opts.long ? '/' + opts.long : ''}`;

    if (B.length !== A.length) { fail(tag, `atom count changed ${A.length} -> ${B.length}`); continue; }
    if (!B.every(p => p.every(Number.isFinite))) { fail(tag, 'produced a coordinate that will not parse'); continue; }

    // rigid: sample pairs across the whole structure, not just the first two
    let worst = 0;
    for (let n = 0; n < 40; n++) {
      const i = (n * 97) % A.length, j = (n * 613 + 7) % A.length;
      if (i === j) continue;
      worst = Math.max(worst, Math.abs(dist(A, i, j) - dist(B, i, j)));
    }
    if (worst > 0.005) { fail(tag, `not rigid — a distance moved by ${worst.toFixed(4)} A`); continue; }

    // same hand: several quadruples, because one could be near-degenerate
    let mirrored = false, checked = 0;
    for (let n = 0; n < 20; n++) {
      const q = [0, 1, 2, 3].map(k => (n * 131 + k * 37) % A.length);
      if (new Set(q).size < 4) continue;
      const before = chirality(A, ...q), after = chirality(B, ...q);
      if (Math.abs(before) < 1e-6) continue;         // coplanar: says nothing
      checked++;
      if (Math.sign(before) !== Math.sign(after)) mirrored = true;
    }
    if (mirrored)      fail(tag, 'MIRRORED — orientation flipped the structure into its enantiomer');
    else if (!checked) fail(tag, 'could not test chirality: every quadruple was coplanar');
    else               ok(`${tag.padEnd(18)} rigid (max ${worst.toFixed(4)} A), same hand (${checked} quadruples)`);
  }

  // the deposited mode must be a genuine passthrough
  if (PDB.orient(raw, { mode: 'deposited' }) !== raw) fail(file, "mode:'deposited' modified the file");

  const h = PDB.helices(raw);
  const n = k => Object.values(h[k]).reduce((s, r) => s + r.length, 0);
  console.log(`        helices: ${n('alpha')} alpha, ${n('three10')} 3-10, ${n('pi')} pi`);
}

if (failures) { console.log(`\nFAIL: ${failures} assertion(s) failed`); process.exit(1); }
console.log('\nPASS: orientation is a rotation — rigid, well-formed, and never mirrored');
