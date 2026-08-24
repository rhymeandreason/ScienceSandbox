/* =============================================================================
 *  chair/check-chair.js — the claims the ring flip rests on
 * =============================================================================
 *  Offline, dependency-free. Run from demos/:  node chair/check-chair.js
 *
 *  A ring flip changes SHAPE and nothing else. The failure that matters is the
 *  one that looks perfect: reflect a sugar through its ring plane and you get
 *  the enantiomer with every bond length, every angle and every rendered pixel
 *  identical. mol-krebs.js records that happening here once, passing
 *  check-molecules.js, caught only by the network checker. Nothing about this
 *  module's output can be judged by eye, so it is judged by these:
 *
 *    1. HANDEDNESS HOLDS. The signed volume at every four-coordinate carbon
 *       keeps its sign. This is the assertion the whole design serves.
 *    2. IT IS THE SAME MOLECULE. Every bond length is unchanged — a flip that
 *       stretched a bond would be relaxing the ring, not flipping it.
 *    3. AXIAL AND EQUATORIAL SWAP. Glucose is `stereo:'all-equatorial'`; its
 *       other chair must therefore be all-AXIAL. That is the lesson, and it is
 *       measured the same way check-molecules.js measures the claim it mirrors.
 *    4. FLIPPING TWICE COMES HOME. Two flips return the original geometry, so
 *       the operation is its own inverse and cannot drift a molecule across
 *       repeated use on the page.
 * ========================================================================== */
'use strict';

const CF = require('../lib/chair-flip.js');
const { MOLECULES } = require('../lib/lib-node.js');

let fails = 0;
const fail = m => { fails++; console.log(`   FAIL: ${m}`); };
const bonds = spec => (spec.bonds||[]).map(b=>[b[0],b[1]]);
const dist = (p,q) => Math.hypot(p[0]-q[0], p[1]-q[1], p[2]-q[2]);

// Which molecules are worth flipping: anything declaring a six-ring stereo claim.
const SUBJECTS = ['glucose', 'alphaGlucose', 'galactose'];

for (const key of SUBJECTS) {
  const spec = MOLECULES[key];
  if (!spec) { fail(`${key} is not registered`); continue; }
  console.log(`\n== ${key} (${spec.name})`);

  const before = spec.atoms.map(a => a.pos);
  const out = CF.flip(spec);
  const after = out.pos;

  // ---- 1. handedness ----------------------------------------------------
  const centres = CF.stereocentres(spec);
  const flipped = centres.filter(i => {
    const a = CF.chirality(spec, before, i), b = CF.chirality(spec, after, i);
    return a !== null && b !== null && Math.sign(a) !== Math.sign(b);
  });
  if (flipped.length)
    fail(`${flipped.length} stereocentre(s) changed hand — ${flipped.map(i=>spec.names?spec.names[i]:i).join(', ')}. `
       + `That is the ENANTIOMER, not the other chair, and it renders identically.`);
  else
    console.log(`   OK: all ${centres.length} stereocentre(s) keep their handedness`);

  // ---- 2. same molecule -------------------------------------------------
  let worst = 0, worstAt = null;
  for (const [i,j] of bonds(spec)) {
    const d = Math.abs(dist(after[i],after[j]) - dist(before[i],before[j]));
    if (d > worst) { worst = d; worstAt = `${i}-${j}`; }
  }
  if (worst > 1e-6)
    fail(`bond ${worstAt} changed length by ${worst.toFixed(4)} — a flip moves atoms, it does not restretch bonds`);
  else
    console.log(`   OK: every bond length unchanged (max ${worst.toExponential(1)})`);

  // ---- 3. axial and equatorial swap -------------------------------------
  const t0 = CF.tilts(spec, before), t1 = CF.tilts(spec, after);
  const swapped = t0.every((x,k) => x.equatorial !== t1[k].equatorial);
  const name = i => spec.names ? spec.names[i] : i;
  if (!swapped) {
    const stuck = t0.filter((x,k)=>x.equatorial===t1[k].equatorial).map(x=>name(x.sub));
    fail(`${stuck.length} substituent(s) did not change between axial and equatorial `
       + `(${stuck.join(', ')}) — the ring did not flip`);
  } else {
    console.log(`   OK: all ${t0.length} substituents swapped `
      + `(${t0.filter(x=>x.equatorial).length} equatorial → ${t1.filter(x=>x.equatorial).length})`);
  }

  // The lesson itself, for the molecule that carries the claim.
  if (spec.stereo === 'all-equatorial') {
    const stillEq = t1.filter(x => x.equatorial).map(x=>name(x.sub));
    if (stillEq.length)
      fail(`${key} declares all-equatorial, so its other chair must be all-AXIAL — `
         + `but ${stillEq.join(', ')} stayed equatorial`);
    else
      console.log(`   OK: all-equatorial flips to all-axial — the reason this sugar wins`);
  }

  // ---- 4. its own inverse -----------------------------------------------
  const back = CF.flip(spec, after).pos;
  let drift = 0;
  for (let i=0;i<before.length;i++) drift = Math.max(drift, dist(back[i], before[i]));
  if (drift > 1e-6)
    fail(`flipping twice lands ${drift.toFixed(4)} from where it started — the flip drifts`);
  else
    console.log(`   OK: flipping twice returns the original (max ${drift.toExponential(1)})`);
}

console.log('');
if (fails) { console.log(`FAIL: ${fails} broken chair-flip claim(s)`); process.exit(1); }
console.log('PASS: every flip keeps its handedness and its bond lengths, swaps every '
  + 'substituent between axial and equatorial, and is its own inverse');
