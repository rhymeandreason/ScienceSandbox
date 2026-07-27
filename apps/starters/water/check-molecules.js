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
 *
 *  It also audits RING STEREOCHEMISTRY, because that is the one error class
 *  nothing else here can see. Glucose shipped with its substituents
 *  alternating axial/equatorial around the ring: every bond length fine,
 *  every angle textbook-correct, renders beautifully — and not glucose. Only
 *  measuring each substituent against the ring axis catches it. A spec can
 *  declare `stereo:'all-equatorial'` (β-D-glucopyranose, the arrangement that
 *  makes glucose the most stable hexose) and this asserts it; otherwise the
 *  pattern is printed for eyeballing.
 * ===================================================================== */
'use strict';

// molecules.js is a browser script ending in `})(this)`; under CommonJS
// `this` is module.exports, so MolLib lands there.
const { PALETTE, MOLECULES } = require('./molecules.js').MolLib;

const TIGHT = 0.03;   // a positive but very small gap: renders, but barely

const EQ_MAX_TILT = 45;   // substituent within this angle of the ring PLANE = equatorial

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const angle = (a, b, c) => {
  const u = [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const v = [c[0] - b[0], c[1] - b[1], c[2] - b[2]];
  const dot = u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  return Math.acos(dot / (Math.hypot(...u) * Math.hypot(...v))) * 180 / Math.PI;
};
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1],
                         a[2] * b[0] - a[0] * b[2],
                         a[0] * b[1] - a[1] * b[0]];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = v => { const l = Math.hypot(...v) || 1; return v.map(x => x / l); };

// Smallest cycles in the bond graph: for each bond, look for another route
// between its two ends. Rings here are 5- or 6-membered sugars; anything larger
// is not a ring we have an axial/equatorial story for.
function findRings(atomCount, bonds) {
  const adj = Array.from({ length: atomCount }, () => []);
  bonds.forEach(([i, j]) => { adj[i].push(j); adj[j].push(i); });
  const rings = [], seen = new Set();
  for (const [i, j] of bonds) {
    const prev = new Map([[i, null]]);
    const queue = [i];
    let done = false;
    while (queue.length && !done) {
      const u = queue.shift();
      for (const v of adj[u]) {
        if ((u === i && v === j) || (u === j && v === i)) continue;   // skip this bond
        if (prev.has(v)) continue;
        prev.set(v, u);
        if (v === j) { done = true; break; }
        queue.push(v);
      }
    }
    if (!prev.has(j)) continue;
    const path = [];
    for (let c = j; c !== null; c = prev.get(c)) path.push(c);
    if (path.length < 5 || path.length > 6) continue;
    const sig = [...path].sort((a, b) => a - b).join(',');
    if (seen.has(sig)) continue;
    seen.add(sig);
    rings.push(path);
  }
  return rings;
}

// Mean-plane normal of a ring, summed over its edges so a puckered chair still
// gives a stable axis rather than one triangle's normal.
function ringNormal(ring, P) {
  const c = ring.reduce((s, i) => [s[0] + P(i)[0] / ring.length,
                                   s[1] + P(i)[1] / ring.length,
                                   s[2] + P(i)[2] / ring.length], [0, 0, 0]);
  let n = [0, 0, 0];
  for (let k = 0; k < ring.length; k++) {
    const x = cross(sub(P(ring[k]), c), sub(P(ring[(k + 1) % ring.length]), c));
    n = [n[0] + x[0], n[1] + x[1], n[2] + x[2]];
  }
  return unit(n);
}

let failures = 0, warnings = 0, stereoFails = 0;

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

  // ---- ring stereochemistry -------------------------------------------
  // Wrong configuration is invisible to every check above: lengths, angles and
  // the render all stay perfect while the molecule is a different sugar. So
  // measure each substituent against the ring axis. Hydrogens are skipped —
  // the heavy groups carry the identity, and the glycolysis specs omit C–H.
  for (const ring of findRings(mol.atoms.length, bonds)) {
    const inRing = new Set(ring);
    const n = ringNormal(ring, P);
    const found = [];
    for (const i of ring) {
      for (const [a, b] of bonds) {
        const j = a === i ? b : b === i ? a : null;
        if (j === null || inRing.has(j) || mol.atoms[j].el === 'H') continue;
        const tilt = 90 - Math.acos(Math.abs(dot3(unit(sub(P(j), P(i))), n))) * 180 / Math.PI;
        found.push({ i, j, tilt, eq: tilt <= EQ_MAX_TILT });
      }
    }
    if (!found.length) continue;
    const ringName = ring.length === 6 ? 'pyranose' : 'furanose';
    console.log(`   ring (${ringName}, ${ring.map(label).join('-')}):`);
    found.forEach(s => console.log(`     ${label(s.i)}->${label(s.j)}`
      + ` tilt ${s.tilt.toFixed(0)}° from ring plane — ${s.eq ? 'equatorial' : 'AXIAL'}`));

    if (mol.stereo === 'all-equatorial') {
      const axial = found.filter(s => !s.eq);
      if (axial.length) {
        stereoFails++;
        console.log(`   STEREO FAIL: spec declares all-equatorial but `
          + `${axial.map(s => label(s.i)).join(', ')} ${axial.length === 1 ? 'is' : 'are'} axial.`);
        console.log(`     An all-equatorial pyranose is what makes glucose the most`);
        console.log(`     stable hexose — alternating ax/eq is a different sugar.`);
      } else {
        console.log(`   stereo OK: all-equatorial as declared`);
      }
    } else if (mol.stereo) {
      stereoFails++;
      console.log(`   STEREO FAIL: unknown stereo declaration '${mol.stereo}'`);
    } else {
      console.log(`   (no \`stereo\` declared — pattern above is informational)`);
    }
  }
}

console.log('');
if (failures || stereoFails) {
  const parts = [];
  if (failures) parts.push(`${failures} overlapping pair(s)`);
  if (stereoFails) parts.push(`${stereoFails} ring(s) with wrong stereochemistry`);
  console.log(`FAIL: ${parts.join(' + ')}`);
  process.exit(1);
}
console.log(`PASS: no sphere overlaps, ring stereochemistry as declared`
  + (warnings ? ` (${warnings} tight bond(s) — check they still read clearly)` : ''));
