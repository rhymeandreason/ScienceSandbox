/* =====================================================================
 *  bake-closure.js — the hexokinase domain closure, as keyframes.
 *
 *  Writes hexokinase/data/HK.closure.bin (the trajectory) and
 *  HK.closure.json (what was measured making it). The page reads its
 *  numbers out of the JSON; nothing about this motion is typed twice.
 *
 * ---------------------------------------------------------------------
 *  WHAT THE ANIMATION CLAIMS, AND WHAT IT DOES NOT
 * ---------------------------------------------------------------------
 *  Endpoints are 1IG8 (hexokinase PII, apo, 2.2 A) and 3B8A (hexokinase
 *  PI with glucose, 2.95 A). Both are yeast hexokinase and they are 77%
 *  identical, but they are DIFFERENT ISOZYMES, so the 18.6 degrees this
 *  bakes is closure plus whatever PI and PII differ by, and those two
 *  cannot be separated from these files. Separating them would need a
 *  fully sequenced apo PI or holo PII; the only candidates, 1HKG and
 *  2YHX, have 83 and 78 UNK residues -- the depositors could not read
 *  those side chains in 1978, so no residue-level correspondence exists
 *  to morph along. hinge.js refuses them for that reason.
 *
 *  So: the closure is real and measured, the angle is approximate, and
 *  the page must say which. It is NOT the textbook 2YHX -> 1HKG pair,
 *  which is unsequenced at both ends and, measured, closes the wrong way.
 *
 * ---------------------------------------------------------------------
 *  WHY NOT INTERPOLATE THE COORDINATES
 * ---------------------------------------------------------------------
 *  A straight line from each atom's start to its end is the obvious
 *  morph and it breaks the molecule in the middle: two Ca that must stay
 *  3.8 A apart take separate chords across an 11 A swing and the chain
 *  stretches, or worse, passes through itself. Nothing about that is
 *  visible at either endpoint, which is where a morph is usually checked.
 *
 *  So interpolate DISTANCES, not positions. Every pair within the cutoff
 *  gets a target distance that eases from its value in the open form to
 *  its value in the closed one, and each frame is then solved for the
 *  coordinates that best satisfy those targets (SMACOF, seeded from the
 *  previous frame so the path stays continuous). Backbone neighbours are
 *  ~3.8 A in BOTH endpoints, so their interpolated target is ~3.8 A at
 *  every t: the chain cannot stretch, by construction rather than by
 *  tuning. check-closure.js asserts it anyway, on every frame.
 *
 *  Run:  node hexokinase/tools/bake-closure.js
 * ===================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { readCA, align, superpose, dist } = require('./pdbio.js');

const DATA = path.join(__dirname, '..', 'data');
const OPEN = '1IG8', CLOSED = '3B8A';

const FRAMES = 41;      // t = 0 .. 1
const CUTOFF = 12;      // A; pairs closer than this in either endpoint
const ITERS = 300;      // SMACOF sweeps per frame
const MAGIC = 'HXM1';

const load = id => {
  const s = readCA(fs.readFileSync(path.join(DATA, id + '.pdb'), 'utf8'));
  s.id = id;
  s.ligands = [...s.het.keys()].filter(l => l !== 'SO4' && l !== 'HOH');
  return s;
};

const A = load(OPEN), B = load(CLOSED);
if (A.unk || B.unk) throw new Error('endpoint has UNK residues; see hinge.js');

const al = align(A.seq, B.seq);
const PA = al.pairs.map(([i]) => A.ca[i]);
const PB = al.pairs.map(([, j]) => B.ca[j]);
const N = PA.length;

/* ---- lobes, by the same consensus hinge.js uses -------------------- */
const INLIER = 1.5, SEED_K = 30;
function consensus(pool) {
  let best = null;
  for (const s of pool) {
    const near = [...pool].sort((i, j) => dist(PA[s], PA[i]) - dist(PA[s], PA[j])).slice(0, SEED_K);
    if (near.length < 12) continue;
    let set = near, last = -1, it = 0;
    while (set.length !== last && it++ < 20) {
      last = set.length;
      const fit = superpose(set.map(i => PA[i]), set.map(i => PB[i]));
      const moved = fit.apply(PA);
      set = pool.filter(i => dist(moved[i], PB[i]) < INLIER);
      if (set.length < 12) break;
    }
    if (set.length >= 12 && (!best || set.length > best.length)) best = set;
  }
  return best || [];
}
const all = PA.map((_, i) => i);
const lobe1 = consensus(all);
const used = new Set(lobe1);
const lobe2 = consensus(all.filter(i => !used.has(i)));
const lobeOf = new Uint8Array(N);
for (const i of lobe1) lobeOf[i] = 1;
for (const i of lobe2) lobeOf[i] = 2;

/* Put the closed form in the open form's frame, on the LARGE lobe. The
 * student should see the small lobe swing while the big one holds still;
 * superposing on the whole molecule instead splits the motion across
 * both and reads as the whole protein writhing. */
const fit1 = superpose(lobe1.map(i => PB[i]), lobe1.map(i => PA[i]));
const TB = fit1.apply(PB);
const hingeFit = superpose(lobe2.map(i => TB[i]), lobe2.map(i => PA[i]));

/* ---- the pair list ------------------------------------------------- */
const pairs = [];
for (let i = 0; i < N; i++) {
  for (let j = i + 1; j < N; j++) {
    const da = dist(PA[i], PA[j]), db = dist(TB[i], TB[j]);
    if (da < CUTOFF || db < CUTOFF) pairs.push({ i, j, da, db, w: 1 / (da * da + 1e-6) });
  }
}
const chain = [];
for (let i = 1; i < N; i++) if (PA[i].n === PA[i - 1].n + 1) chain.push([i - 1, i]);

console.log(`${OPEN} -> ${CLOSED}: ${N} paired residues, ${(al.identity * 100).toFixed(1)}% identical`);
console.log(`lobe 1 ${lobe1.length}  lobe 2 ${lobe2.length}  hinge ${hingeFit.angle.toFixed(1)} deg`);
console.log(`${pairs.length} distance restraints under ${CUTOFF} A, ${chain.length} backbone steps`);

/* ---- SMACOF: coordinates that satisfy the interpolated distances ---- */
const ease = t => t * t * (3 - 2 * t);   // the motion starts and ends at rest

function solve(X, targets) {
  const nx = new Float64Array(N * 3), wsum = new Float64Array(N);
  for (let it = 0; it < ITERS; it++) {
    nx.fill(0); wsum.fill(0);
    for (let p = 0; p < pairs.length; p++) {
      const { i, j, w } = pairs[p];
      const d = targets[p];
      const dx = X[i * 3] - X[j * 3], dy = X[i * 3 + 1] - X[j * 3 + 1], dz = X[i * 3 + 2] - X[j * 3 + 2];
      const cur = Math.hypot(dx, dy, dz) || 1e-9;
      const s = d / cur;
      // Each pair proposes where the other end should be, at the target
      // separation along the CURRENT bearing. The weighted average of
      // every proposal is the next position (Guttman transform).
      nx[i * 3] += w * (X[j * 3] + dx * s); nx[i * 3 + 1] += w * (X[j * 3 + 1] + dy * s); nx[i * 3 + 2] += w * (X[j * 3 + 2] + dz * s);
      nx[j * 3] += w * (X[i * 3] - dx * s); nx[j * 3 + 1] += w * (X[i * 3 + 1] - dy * s); nx[j * 3 + 2] += w * (X[i * 3 + 2] - dz * s);
      wsum[i] += w; wsum[j] += w;
    }
    for (let i = 0; i < N; i++) {
      if (!wsum[i]) continue;
      X[i * 3] = nx[i * 3] / wsum[i]; X[i * 3 + 1] = nx[i * 3 + 1] / wsum[i]; X[i * 3 + 2] = nx[i * 3 + 2] / wsum[i];
    }
  }
  return X;
}

const frames = [];
let X = new Float64Array(N * 3);
for (let i = 0; i < N; i++) { X[i * 3] = PA[i].x; X[i * 3 + 1] = PA[i].y; X[i * 3 + 2] = PA[i].z; }

const targets = new Float64Array(pairs.length);
for (let f = 0; f < FRAMES; f++) {
  const t = ease(f / (FRAMES - 1));
  for (let p = 0; p < pairs.length; p++) targets[p] = pairs[p].da + (pairs[p].db - pairs[p].da) * t;
  X = solve(X, targets);
  // Hold the frame in the open form's own reference, on lobe 1, so the
  // camera never has to chase the molecule.
  const pts = [];
  for (let i = 0; i < N; i++) pts.push({ x: X[i * 3], y: X[i * 3 + 1], z: X[i * 3 + 2] });
  const held = superpose(lobe1.map(i => pts[i]), lobe1.map(i => PA[i])).apply(pts);
  frames.push(held);
  for (let i = 0; i < N; i++) { X[i * 3] = held[i].x; X[i * 3 + 1] = held[i].y; X[i * 3 + 2] = held[i].z; }
  if (f % 10 === 0 || f === FRAMES - 1) {
    let worst = 0;
    for (const [a, b] of chain) worst = Math.max(worst, Math.abs(dist(held[a], held[b]) - 3.8));
    console.log(`  frame ${String(f).padStart(2)}  t=${t.toFixed(2)}  worst backbone deviation from 3.8 A: ${worst.toFixed(3)}`);
  }
}

/* ---- write ---------------------------------------------------------- */
const head = 4 + 2 + 2 + N * 2 + N;
const buf = Buffer.alloc(head + FRAMES * N * 3 * 4);
let o = 0;
buf.write(MAGIC, o); o += 4;
buf.writeUInt16LE(FRAMES, o); o += 2;
buf.writeUInt16LE(N, o); o += 2;
for (let i = 0; i < N; i++) { buf.writeUInt16LE(PA[i].n, o); o += 2; }
for (let i = 0; i < N; i++) { buf.writeUInt8(lobeOf[i], o); o += 1; }
for (const fr of frames) for (const p of fr) {
  buf.writeFloatLE(p.x, o); o += 4;
  buf.writeFloatLE(p.y, o); o += 4;
  buf.writeFloatLE(p.z, o); o += 4;
}
fs.writeFileSync(path.join(DATA, 'HK.closure.bin'), buf);

const meta = {
  open: { id: OPEN, title: A.title, resolution: A.res, ligands: A.ligands, residues: A.ca.length },
  closed: { id: CLOSED, title: B.title, resolution: B.res, ligands: B.ligands, residues: B.ca.length },
  crossIsozyme: true,
  identity: +(al.identity * 100).toFixed(1),
  paired: N,
  hingeAngleDeg: +hingeFit.angle.toFixed(1),
  lobe1: lobe1.length, lobe2: lobe2.length,
  frames: FRAMES, cutoff: CUTOFF,
  note: 'PII apo vs PI holo: the angle is closure plus isozyme difference. '
      + 'The two cannot be separated from deposited structures; the only '
      + 'same-isozyme candidates are unsequenced (1HKG 83 UNK, 2YHX 78 UNK).',
};
fs.writeFileSync(path.join(DATA, 'HK.closure.json'), JSON.stringify(meta, null, 2) + '\n');
console.log(`\nwrote HK.closure.bin (${(buf.length / 1024).toFixed(0)} kB) and HK.closure.json`);
