#!/usr/bin/env node
/* =====================================================================
 *  check-molecules.js — geometry audit for molecules.js
 *
 *  Run:  node check-molecules.js          (exits non-zero on failure)
 *
 *  Why this exists: the display radii in PALETTE are stylised and LARGE
 *  relative to the bond lengths. If a bond is shorter than the sum of the
 *  two atoms' radii, the spheres merge and the bond stick vanishes inside
 *  them — the molecule renders as a blob and students can't read the
 *  bonds off it. Ethanol shipped that way: its O–H was 1.00 against radii
 *  summing to 1.50, because its geometry had been written at realistic
 *  ångström lengths while every other molecule used the stylised scale
 *  (water's O–H is 1.55 vs the same 1.50, clearing by 0.05).
 *
 *  So: every bonded pair must clear, every NON-bonded pair within a
 *  molecule must not overlap either, and bond angles are printed so a new
 *  molecule's shape can be eyeballed against its real VSEPR geometry.
 *  Run this after adding or editing anything in MOLECULES.
 * ===================================================================== */
'use strict';

// molecules.js is a browser script ending in `})(this)`; under CommonJS
// `this` is module.exports, so MolLib lands there.
const { PALETTE, MOLECULES } = require('./molecules.js').MolLib;

const TIGHT = 0.03;   // a positive but very small gap: renders, but barely

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const angle = (a, b, c) => {
  const u = [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const v = [c[0] - b[0], c[1] - b[1], c[2] - b[2]];
  const dot = u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  return Math.acos(dot / (Math.hypot(...u) * Math.hypot(...v))) * 180 / Math.PI;
};

let failures = 0, warnings = 0;

for (const [key, mol] of Object.entries(MOLECULES)) {
  if (!mol.atoms) continue;            // ionic entries carry no geometry
  const R = i => PALETTE.radii[mol.atoms[i].el] || 0.7;
  const P = i => mol.atoms[i].pos;
  const label = i => mol.atoms[i].el + i;
  const bonds = mol.bonds || [];
  const bonded = new Set(bonds.map(([i, j]) => (i < j ? `${i},${j}` : `${j},${i}`)));

  console.log(`\n== ${key} (${mol.formula})`);

  for (const [i, j] of bonds) {
    const len = dist(P(i), P(j)), radii = R(i) + R(j), gap = len - radii;
    let flag = '';
    if (gap <= 0) { flag = '   <-- SPHERES MERGE, bond stick hidden'; failures++; }
    else if (gap < TIGHT) { flag = '   <-- very tight'; warnings++; }
    console.log(`   bond  ${label(i)}-${label(j)}: len ${len.toFixed(3)}`
      + `  radii ${radii.toFixed(2)}  gap ${gap.toFixed(3)}${flag}`);
  }

  // Atoms that are NOT bonded must still not interpenetrate — a too-small
  // bond angle can fold two H's into each other even when every bond is fine.
  for (let i = 0; i < mol.atoms.length; i++) {
    for (let j = i + 1; j < mol.atoms.length; j++) {
      if (bonded.has(`${i},${j}`)) continue;
      const gap = dist(P(i), P(j)) - (R(i) + R(j));
      if (gap < 0) {
        failures++;
        console.log(`   NON-BONDED OVERLAP ${label(i)}..${label(j)}: gap ${gap.toFixed(3)}`);
      }
    }
  }

  // Bond angles at each shared atom — informational, for checking VSEPR shape.
  const seen = new Set();
  for (const [i, j] of bonds) {
    for (const [p, q] of bonds) {
      const c = [i, j].find(x => x === p || x === q);
      if (c === undefined) continue;
      const a = i === c ? j : i, b = p === c ? q : p;
      if (a >= b) continue;
      const sig = `${a},${c},${b}`;
      if (seen.has(sig)) continue;
      seen.add(sig);
      console.log(`   angle ${label(a)}-${label(c)}-${label(b)}: `
        + `${angle(P(a), P(c), P(b)).toFixed(1)}°`);
    }
  }
}

console.log('');
if (failures) {
  console.log(`FAIL: ${failures} overlapping pair(s)`);
  process.exit(1);
}
console.log(`PASS: no sphere overlaps in any molecule`
  + (warnings ? ` (${warnings} tight bond(s) — check they still read clearly)` : ''));
