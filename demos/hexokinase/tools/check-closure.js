/* =====================================================================
 *  check-closure.js — assert the baked closure on EVERY frame.
 *
 *  A morph is normally eyeballed at its two ends, which are the two
 *  frames that cannot be wrong: they are the deposited structures. Every
 *  way a morph breaks is in between. So each assertion here runs over the
 *  whole trajectory, and the endpoint checks are the least of them.
 *
 *  Run:  node hexokinase/tools/check-closure.js
 * ===================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { readCA, align, superpose, dist } = require('./pdbio.js');

const DATA = path.join(__dirname, '..', 'data');
const CA_STEP = 3.8;        // A between consecutive Ca
const STEP_TOL = 0.6;       // how far a frame may drift from it
const CLASH = 3.4;          // two non-adjacent Ca closer than this is a clash
const END_RMSD = 1.2;       // a terminal frame must land on its structure

let failures = 0;
const head = s => console.log('\n' + s + '\n' + '-'.repeat(s.length));
function ok(cond, msg, detail) {
  console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${msg}${detail ? '   ' + detail : ''}`);
  if (!cond) failures++;
}

/* ---- read the bake -------------------------------------------------- */
const buf = fs.readFileSync(path.join(DATA, 'HK.closure.bin'));
const meta = JSON.parse(fs.readFileSync(path.join(DATA, 'HK.closure.json'), 'utf8'));

head('1. the file is the format it says it is');
const magic = buf.slice(0, 4).toString();
ok(magic === 'HXM2', 'magic HXM2', magic);
const FR = buf.readUInt16LE(4), N = buf.readUInt16LE(6);
ok(FR === meta.frames, 'frame count matches the metadata', `${FR} vs ${meta.frames}`);
ok(N === meta.paired, 'residue count matches the metadata', `${N} vs ${meta.paired}`);

let o = 8;
const resNum = [], lobe = [];
let ss = '';
for (let i = 0; i < N; i++) { resNum.push(buf.readUInt16LE(o)); o += 2; }
for (let i = 0; i < N; i++) { lobe.push(buf.readUInt8(o)); o += 1; }
for (let i = 0; i < N; i++) { ss += String.fromCharCode(buf.readUInt8(o)); o += 1; }
const expect = 8 + N * 4 + FR * N * 12;
ok(buf.length === expect, 'file length is exactly the header plus the frames', `${buf.length} vs ${expect}`);

const frames = [];
for (let f = 0; f < FR; f++) {
  const pts = [];
  for (let i = 0; i < N; i++) {
    pts.push({ n: resNum[i], x: buf.readFloatLE(o), y: buf.readFloatLE(o + 4), z: buf.readFloatLE(o + 8) });
    o += 12;
  }
  frames.push(pts);
}
ok(frames.length === FR, 'every frame decoded', `${frames.length}`);

/* consecutive residue numbers are the backbone steps; a gap in the
 * deposited chain is not a bond and must not be asserted as one. */
const steps = [];
for (let i = 1; i < N; i++) if (resNum[i] === resNum[i - 1] + 1) steps.push([i - 1, i]);

head('2. the chain never stretches -- every frame, not just the ends');
let worstStep = 0, worstAt = -1;
for (let f = 0; f < FR; f++) {
  for (const [a, b] of steps) {
    const d = Math.abs(dist(frames[f][a], frames[f][b]) - CA_STEP);
    if (d > worstStep) { worstStep = d; worstAt = f; }
  }
}
ok(worstStep < STEP_TOL,
   `all ${steps.length} backbone steps within ${STEP_TOL} A of ${CA_STEP} A, across ${FR} frames`,
   `worst ${worstStep.toFixed(3)} A at frame ${worstAt}`);

head('3. the chain never passes through itself');
let worstClash = Infinity, clashAt = -1, clashPair = null;
for (let f = 0; f < FR; f++) {
  const p = frames[f];
  for (let i = 0; i < N; i++) {
    for (let j = i + 3; j < N; j++) {
      const d = dist(p[i], p[j]);
      if (d < worstClash) { worstClash = d; clashAt = f; clashPair = [resNum[i], resNum[j]]; }
    }
  }
}
ok(worstClash > CLASH,
   `closest non-adjacent Ca pair stays above ${CLASH} A`,
   `min ${worstClash.toFixed(2)} A at frame ${clashAt} (${clashPair})`);

/* ---- endpoints land on the deposited structures --------------------- */
head('4. the end frames are the structures they claim to be');
const load = id => readCA(fs.readFileSync(path.join(DATA, id + '.pdb'), 'utf8'));
const A = load(meta.open.id), B = load(meta.closed.id);
const al = align(A.seq, B.seq);
const PA = al.pairs.map(([i]) => A.ca[i]);
const PB = al.pairs.map(([, j]) => B.ca[j]);
ok(PA.length === N, 'the alignment still pairs the same residues the bake used', `${PA.length} vs ${N}`);

const first = superpose(frames[0], PA);
ok(first.rmsd < END_RMSD, `frame 0 lands on ${meta.open.id} (open)`, `RMSD ${first.rmsd.toFixed(2)} A`);

const lobe1 = PA.map((_, i) => i).filter(i => lobe[i] === 1);
const onLobe1 = superpose(lobe1.map(i => PB[i]), lobe1.map(i => PA[i])).apply(PB);
const last = superpose(frames[FR - 1], onLobe1);
ok(last.rmsd < END_RMSD, `frame ${FR - 1} lands on ${meta.closed.id} (closed)`, `RMSD ${last.rmsd.toFixed(2)} A`);

head('5. the large lobe holds still and the small one swings');
const l1 = PA.map((_, i) => i).filter(i => lobe[i] === 1);
const l2 = PA.map((_, i) => i).filter(i => lobe[i] === 2);
ok(l1.length === meta.lobe1 && l2.length === meta.lobe2, 'lobe sizes match the metadata', `${l1.length}/${l2.length}`);

let maxL1 = 0, maxL2 = 0;
for (const i of l1) maxL1 = Math.max(maxL1, dist(frames[0][i], frames[FR - 1][i]));
for (const i of l2) maxL2 = Math.max(maxL2, dist(frames[0][i], frames[FR - 1][i]));
ok(maxL2 > maxL1, 'the small lobe travels further than the large one',
   `lobe2 ${maxL2.toFixed(1)} A vs lobe1 ${maxL1.toFixed(1)} A`);

head('6. the motion is a closure, and it only goes one way');
const angles = frames.map(fr => {
  const held = superpose(l1.map(i => fr[i]), l1.map(i => PA[i])).apply(fr);
  return superpose(l2.map(i => held[i]), l2.map(i => PA[i])).angle;
});
ok(angles[0] < 1.5, 'frame 0 is the open state, angle ~0', `${angles[0].toFixed(2)} deg`);
let backslide = 0, backAt = -1;
for (let f = 1; f < FR; f++) {
  const d = angles[f - 1] - angles[f];
  if (d > backslide) { backslide = d; backAt = f; }
}
ok(backslide < 0.4, 'the hinge angle never reverses along the trajectory',
   `worst backslide ${backslide.toFixed(2)} deg at frame ${backAt}`);
ok(Math.abs(angles[FR - 1] - meta.hingeAngleDeg) < 2.0,
   'the final angle is the one the metadata publishes',
   `${angles[FR - 1].toFixed(1)} vs ${meta.hingeAngleDeg} deg`);

head('7. secondary structure is the file\'s own, not a guess');
const { readSS } = require('./pdbio.js');
const ssMap = readSS(fs.readFileSync(path.join(DATA, meta.open.id + '.pdb'), 'utf8'), A.chain);
const fromFile = PA.map(c => ssMap.get(c.n) || 'C').join('');
ok(ss === fromFile, `all ${N} assignments still match ${meta.open.id}'s HELIX/SHEET records`);
ok(/^[HEC]+$/.test(ss), 'every residue is H, E or C');
const cnt = { H: 0, E: 0, C: 0 };
for (const c of ss) cnt[c]++;
ok(cnt.H === meta.ss.helix && cnt.E === meta.ss.strand && cnt.C === meta.ss.coil,
   'the metadata counts are the counts in the file',
   `${cnt.H}H ${cnt.E}E ${cnt.C}C`);

head('8. the honesty the page depends on');
ok(meta.crossIsozyme === true, 'the cross-isozyme caveat is recorded in the metadata');
ok(typeof meta.note === 'string' && meta.note.length > 40, 'the caveat is spelled out, not just flagged');
ok(A.unk === 0 && B.unk === 0, 'neither endpoint has unsequenced residues', `${A.unk}/${B.unk}`);

console.log('\n' + '='.repeat(60));
if (failures) { console.log(`FAIL: ${failures} check(s) failed`); process.exit(1); }
console.log(`PASS: the closure holds on all ${FR} frames`);
