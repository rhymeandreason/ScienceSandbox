#!/usr/bin/env node
/* =====================================================================
 *  bake-hb.js — fold one hemoglobin beta chain once, commit the answer.
 *
 *  Same argument as folding/tools/bake-fold.js: the fold is deterministic,
 *  so it belongs on disk rather than being re-solved in every student's
 *  browser. Here it matters more — chain B is 729 backbone atoms against
 *  villin's 199, and the relaxation takes about 8.5 seconds. That is not a
 *  loading pause, it is a page that appears broken.
 *
 *  WHY A FORMAT OF ITS OWN, AND NOT FoldLib.encode. encode() writes every
 *  atom of every keyframe: 185 x 729 x 3 floats, 1.6 MB. But this page
 *  draws a RIBBON, and a ribbon needs one atom per residue — the Ca. The
 *  only other thing on screen is act 1's hydrogen-bond dashes, and a dash
 *  needs exactly two points, the acceptor O and the donor H. So the file
 *  carries 146 Ca + 103 O + 103 H per keyframe instead of 729 atoms,
 *  quantised to int16 against the trajectory's own bounding box, and comes
 *  out at roughly a quarter the size. Everything dropped is something
 *  nothing draws.
 *
 *  QUANTISATION. int16 across a box that never exceeds ~500 A gives about
 *  0.008 A per step — two orders of magnitude below the 1.24 A the fold
 *  itself lands from deposited, and far below the 1.74 A the structure was
 *  measured at. It is invisible in the geometry and it is not pretending
 *  otherwise; the checker asserts the round-trip error stays under 0.02 A.
 *
 *  SECONDARY STRUCTURE COMES FROM THE DEPOSITED HELIX RECORDS, not from
 *  DSSP. Both are available for this file — unlike villin, where AlphaFold
 *  ships no records and DSSP was the only option — and the deposited
 *  assignment is what gives the eight helices their classical A..H names,
 *  which is the vocabulary the lesson needs (the iron hangs off His F8).
 *  check-hb.js runs DSSP anyway and asserts the two still agree residue by
 *  residue, because a silent drift between them would change which parts
 *  of the chain draw as a band.
 *
 *  Re-run after ANY change to folding/folding.js's solver, its schedule or
 *  its H-bond cutoffs, exactly as with the villin bake.
 *
 *  Run:  node hemoglobin/tools/bake-hb.js       (offline, no dependencies)
 * ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const FoldLib = require('../../folding/folding.js');
const RibbonLib = require('../../folding/ribbon.js');
const { extract } = require('./chain.js');

const HERE = path.join(__dirname, '..');            // demos/hemoglobin
const SRC = path.join(HERE, 'data', '2HHB.pdb');
const OUT = path.join(HERE, 'data', '2HHB-B.fold.bin');

const CHAIN = 'B';        // the beta chain: 146 residues, helices BA..BH
const MAGIC = 0x48424631; // 'HBF1'
const VERSION = 1;

/* ---------------------------------------------------------------- bake */

/* ---------------------------------------------------------------- landing
 *
 *  THE LAST FRAME IS THE DEPOSITED CHAIN, NOT THE SOLVER'S GUESS AT IT.
 *
 *  The relaxation lands 1.24 A RMSD from 2HHB — a good global number, and
 *  not good enough locally. Measured on the solver's final frame: 29 of 99
 *  helical i->i+3 windows fall outside alpha-helix range against 9 for the
 *  deposited chain, one pair of residues is squeezed to 2.61 A where 5.2 is
 *  right, four alpha turns come out LEFT-handed, and residue 101 sits 4.32 A
 *  from where it belongs. A ribbon shows every one of these, because the
 *  band's orientation is recovered from consecutive Ca — so a chain that is
 *  1.24 A out on average draws as a cartoon with kinked, part-flattened
 *  helices, which is what it looked like.
 *
 *  Blending the last stretch onto the measured coordinates fixes that, and
 *  it is the honest end rather than a cosmetic one: THIS PAGE ALREADY TELLS
 *  THE STUDENT THE DESTINATION WAS MEASURED FIRST AND THE PATH IS INVENTED.
 *  Ending 1.24 A short of the destination does not make that claim more
 *  true, it just means the last thing they look at is our approximation of
 *  haemoglobin instead of haemoglobin. The animation is a steered
 *  interpolation from beginning to end; this makes the final frame agree
 *  with the structure the whole thing was aimed at.
 *
 *  WHAT IT IS NOT is a fix for a bad fold, and it must not be used to hide
 *  one. The blend only runs over the last 14% of the trajectory, where the
 *  chain is already within about 1.5 A of the answer, so it moves fractions
 *  of an angstrom per residue and cannot rescue a collapse that went
 *  somewhere else. check-hb.js still asserts the UNBLENDED solver output
 *  lands within 2 A, so a fold that stopped working would still fail.
 *
 *  Bond lengths are re-projected after the blend, because interpolating
 *  between two conformations shortens chords: two atoms 1.33 A apart in
 *  both endpoints are closer than 1.33 A halfway between them unless the
 *  bond happens to be pointing the same way. Same Jacobi projection the
 *  solver uses, against the same deposited lengths.
 *
 *  Not applied to folding-lab / villin, and folding/folding.js is deliberately
 *  untouched: that solver is shared, and re-tuning it here would restate
 *  villin's fold as a side effect of fixing haemoglobin's.
 */
const LAND_FROM = 0.86;                  // t at which the blend starts
const LAND_PASSES = 150;                   // Jacobi passes, warm-started (see land())
const smoothstep = x => x * x * (3 - 2 * x);

function land(traj, parsed, hb) {
  const nodes = parsed.nodes, n = nodes.length;

  /* BOND LENGTHS ARE NOT ENOUGH, and the first version of this got it
     wrong in a way worth recording. Projecting only parsed.bonds left the
     Ca-Ca spacing at 1.83 A in the middle of the blend, against 3.80 in
     both endpoints — because THERE IS NO Ca-Ca BOND. Consecutive alpha
     carbons are held apart by the N-CA-C and CA-C-N ANGLES, and a blend
     between two conformations bends angles just as readily as it shortens
     chords. Repairing lengths while leaving angles crushed produced a
     chain with correct bonds and a concertina'd backbone, which the
     ribbon drew as exactly the kind of tangle this whole change exists to
     remove.

     So the constraint set is the solver's: every bonded pair (1-2) AND
     every pair of atoms two bonds apart (1-3), each held at its deposited
     distance. A 1-3 distance IS an angle constraint — fixing the two arms
     and the base fixes the angle between them — and it is how folding.js
     states its own angles, which is why the two agree. */
  const cI = [], cJ = [], cL = [];
  const seen = new Set();
  const addPair = (i, j) => {
    if (i === j) return;
    const key = i < j ? i * n + j : j * n + i;
    if (seen.has(key)) return;
    seen.add(key);
    cI.push(i); cJ.push(j);
    cL.push(Math.hypot(nodes[i].native[0] - nodes[j].native[0],
                       nodes[i].native[1] - nodes[j].native[1],
                       nodes[i].native[2] - nodes[j].native[2]));
  };

  const adj = Array.from({ length: n }, () => []);
  for (const [i, j] of parsed.bonds) { adj[i].push(j); adj[j].push(i); addPair(i, j); }
  for (let k = 0; k < n; k++)                       // 1-3 across each centre
    for (let a = 0; a < adj[k].length; a++)
      for (let b = a + 1; b < adj[k].length; b++) addPair(adj[k][a], adj[k][b]);

  /* THE PROJECTION IS PATH-DEPENDENT, SO THE FRAMES MUST BE WALKED IN ORDER.
     Blending each frame and projecting it from scratch, independently of its
     neighbours, was the second thing this got wrong. A Jacobi projection on
     an over-determined constraint set does not have one answer — it has a
     basin of them, and which one it reaches depends on where it started. Two
     adjacent frames start from almost the same place and can still settle a
     little differently, and the difference is not smooth in t: it showed up
     as a 2.7 A jolt at t=0.933 in a stretch where every other step is 0.7,
     with the SOLVER's own output perfectly smooth through the same window.
     More passes made it worse, not better (2.70 at 12 passes, 3.03 at 500),
     which is the signature of a coherence problem rather than a convergence
     one — each frame was converging harder onto its own private answer.

     So the corrected chain is CARRIED forward: each frame starts from the
     previous corrected frame, moved by the solver's own frame-to-frame
     delta, and is only then pulled toward the deposited coordinates. The
     projection begins from a state that already very nearly satisfies its
     constraints, so it barely moves anything and cannot wander to a
     different basin than its predecessor. Drift does not accumulate,
     because the pull toward native reaches full strength at t=1 and pins
     the last frame exactly regardless of the path taken to it. */
  const fStart = traj.ts.findIndex(t => t > LAND_FROM);
  if (fStart <= 0) return traj;

  /* The raw frames, snapshotted before anything is overwritten — the deltas
     have to come from the solver's trajectory, not from the corrected one
     being written over the top of it. */
  const rawFrames = traj.key.slice(fStart - 1).map(a => Float64Array.from(a));
  const carried = Float64Array.from(rawFrames[0]);

  for (let f = fStart; f < traj.count; f++) {
    const w = smoothstep(Math.min(1, (traj.ts[f] - LAND_FROM) / (1 - LAND_FROM)));
    const P = traj.key[f];
    const cur = rawFrames[f - fStart + 1], prev = rawFrames[f - fStart];

    // carry the corrected chain forward by the solver's own step
    for (let i = 0; i < n * 3; i++) carried[i] += cur[i] - prev[i];

    // then pull it onto the measured coordinates
    for (let i = 0; i < n; i++) {
      const nat = nodes[i].native;
      for (let k = 0; k < 3; k++)
        carried[i * 3 + k] += (nat[k] - carried[i * 3 + k]) * w;
    }

    /* Restore what the pull bent. Warm-started, so a handful of passes is
       enough — and unlike the from-scratch version, more of them converge
       toward the same answer the previous frame reached rather than away
       from it. At w=1 the frame is already exactly deposited and this is a
       no-op. */
    if (w < 1) {
      for (let pass = 0; pass < LAND_PASSES; pass++)
        for (let c = 0; c < cI.length; c++) {
          const a = cI[c] * 3, b = cJ[c] * 3;
          const dx = carried[b] - carried[a], dy = carried[b+1] - carried[a+1],
                dz = carried[b+2] - carried[a+2];
          const L = Math.hypot(dx, dy, dz) || 1e-6;
          const s = 0.5 * (L - cL[c]) / L;
          carried[a]   += dx * s; carried[a+1] += dy * s; carried[a+2] += dz * s;
          carried[b]   -= dx * s; carried[b+1] -= dy * s; carried[b+2] -= dz * s;
        }
    } else {
      for (let i = 0; i < n; i++)
        for (let k = 0; k < 3; k++) carried[i * 3 + k] = nodes[i].native[k];
    }

    for (let i = 0; i < n * 3; i++) P[i] = carried[i];

    /* Re-measure formation on the coordinates that will actually be drawn.
       Same ramp folding.js's formation() uses — a dash must never fade in on
       a bond the geometry it is drawn over has not made. Recomputing here is
       what takes the final tally to the full 103: those bonds were found on
       the deposited structure in the first place, so a frame that IS the
       deposited structure necessarily has all of them. */
    const fm = traj.formed[f];
    for (let k = 0; k < hb.length; k++) {
      const o = hb[k].o * 3, h = hb[k].h * 3;
      const d = Math.hypot(P[o] - P[h], P[o+1] - P[h+1], P[o+2] - P[h+2]);
      fm[k] = Math.max(0, Math.min(1, (3.6 - d) / (3.6 - 2.2)));
    }
  }
  return traj;
}

function bake() {
  const raw = fs.readFileSync(SRC, 'utf8');
  const ex = extract(raw, CHAIN);

  const parsed = FoldLib.parse(ex.text, {});
  const hb = FoldLib.hbonds(parsed);
  const folder = FoldLib.Folder(parsed);
  const traj = folder.bake(FoldLib.BAKE.frames, FoldLib.BAKE.keep);

  /* The solver's own final frame, kept before the blend touches it. The
     checker needs it to ask whether THE FOLD is right-handed: once the
     trajectory is landed, its last frame is the deposited structure, and a
     handedness test there would re-measure the crystal and pass no matter
     how mirrored the solver had become. rmsd() and formation() are read off
     the folder's own state and are likewise unaffected by the blend. */
  const preLand = Float64Array.from(traj.key[traj.count - 1]);

  land(traj, parsed, hb);

  /* Which node index is which. The trajectory is indexed by node, so the
     three subsets the page draws are just index lists into each frame. */
  const caIdx = parsed.residues.map(r => r.atoms.CA);
  if (caIdx.some(i => i == null))
    throw new Error('a residue of chain ' + CHAIN + ' has no CA');
  const oIdx = hb.map(b => b.o);
  const hIdx = hb.map(b => b.h);

  /* Secondary structure, from the deposited HELIX records. */
  const first = parsed.residues[0].num;
  const ss = RibbonLib.assign(caIdx.length, first, ex.helices);

  return { parsed, hb, traj, folder, caIdx, oIdx, hIdx, ss, first,
           preLand, helices: ex.helices };
}

/* -------------------------------------------------------------- encode */

/* Layout, little-endian throughout. Every int16 block is a whole number of
   4-byte words by construction (3 coords x an even count would not be, so
   each block is padded to 4 rather than assumed aligned). */
function encode(b) {
  const { traj, caIdx, oIdx, hIdx, ss, first, hb, folder } = b;
  const K = traj.count, R = caIdx.length, B = hb.length;
  const pts = R + B + B;                       // points stored per keyframe

  /* Bounding box over everything that will actually be written. */
  let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  const idx = caIdx.concat(oIdx, hIdx);
  for (const frame of traj.key)
    for (const i of idx)
      for (let k = 0; k < 3; k++) {
        const v = frame[i * 3 + k];
        if (v < lo[k]) lo[k] = v;
        if (v > hi[k]) hi[k] = v;
      }
  const span = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) || 1;
  const scale = span / 65534;                  // one unit of int16, in angstroms

  const pad4 = n => (n + 3) & ~3;
  const headerBytes = 32;
  const staticBytes = pad4(R) +                // ss, one byte per residue
                      pad4(B * 4) +            // bond from/to residue numbers
                      R * 3 * 4 +              // deposited Ca, float32
                      K * 4;                   // ts, float32
  const frameBytes = K * (pad4(pts * 3 * 2) + pad4(B));
  const buf = Buffer.alloc(headerBytes + staticBytes + frameBytes);

  let p = 0;
  buf.writeUInt32LE(MAGIC, p); p += 4;
  buf.writeUInt16LE(VERSION, p); p += 2;
  buf.writeUInt16LE(R, p); p += 2;
  buf.writeUInt16LE(K, p); p += 2;
  buf.writeUInt16LE(B, p); p += 2;
  buf.writeUInt16LE(first, p); p += 2;
  buf.writeUInt16LE(0, p); p += 2;             // reserved, keeps the floats aligned
  for (let k = 0; k < 3; k++) { buf.writeFloatLE(lo[k], p); p += 4; }
  buf.writeFloatLE(scale, p); p += 4;

  /* Static blocks. */
  const SSCODE = { C: 0, H: 1, E: 2 };
  for (let i = 0; i < R; i++) buf.writeUInt8(SSCODE[ss[i]] || 0, p + i);
  p += pad4(R);
  for (let i = 0; i < B; i++) {
    buf.writeUInt16LE(hb[i].from, p + i * 4);
    buf.writeUInt16LE(hb[i].to, p + i * 4 + 2);
  }
  p += pad4(B * 4);
  for (let i = 0; i < R; i++) {
    const nat = b.parsed.nodes[caIdx[i]].native;
    for (let k = 0; k < 3; k++) { buf.writeFloatLE(nat[k], p); p += 4; }
  }
  for (let i = 0; i < K; i++) { buf.writeFloatLE(traj.ts[i], p); p += 4; }

  /* Keyframes. */
  for (let f = 0; f < K; f++) {
    const frame = traj.key[f];
    let w = p;
    for (const i of idx)
      for (let k = 0; k < 3; k++) {
        const v = Math.round((frame[i * 3 + k] - lo[k]) / scale);
        buf.writeInt16LE(Math.max(-32768, Math.min(32767, v - 32767)), w); w += 2;
      }
    p += pad4(pts * 3 * 2);
    for (let i = 0; i < B; i++) buf.writeUInt8(Math.round(traj.formed[f][i] * 255), p + i);
    p += pad4(B);
  }

  return { buf, lo, scale, R, K, B };
}

/* ------------------------------------------------------------ round trip */

/* The decoder, here rather than in a browser module, so the checker can
   measure exactly what the page will see. Mirror any change on both sides. */
function decode(buf) {
  const u8 = Buffer.from(buf);
  let p = 0;
  if (u8.readUInt32LE(p) !== MAGIC) throw new Error('bad magic');
  p += 4;
  const version = u8.readUInt16LE(p); p += 2;
  const R = u8.readUInt16LE(p); p += 2;
  const K = u8.readUInt16LE(p); p += 2;
  const B = u8.readUInt16LE(p); p += 2;
  const first = u8.readUInt16LE(p); p += 2;
  p += 2;
  const lo = [u8.readFloatLE(p), u8.readFloatLE(p + 4), u8.readFloatLE(p + 8)]; p += 12;
  const scale = u8.readFloatLE(p); p += 4;

  const pad4 = n => (n + 3) & ~3;
  const ss = [];
  for (let i = 0; i < R; i++) ss.push('CHE'[u8.readUInt8(p + i)]);
  p += pad4(R);
  const bonds = [];
  for (let i = 0; i < B; i++)
    bonds.push({ from: u8.readUInt16LE(p + i * 4), to: u8.readUInt16LE(p + i * 4 + 2) });
  p += pad4(B * 4);
  const native = [];
  for (let i = 0; i < R; i++) {
    native.push([u8.readFloatLE(p), u8.readFloatLE(p + 4), u8.readFloatLE(p + 8)]);
    p += 12;
  }
  const ts = [];
  for (let i = 0; i < K; i++) { ts.push(u8.readFloatLE(p)); p += 4; }

  const pts = R + B + B;
  const key = [], formed = [];
  for (let f = 0; f < K; f++) {
    const a = new Float32Array(pts * 3);
    for (let i = 0; i < pts * 3; i++)
      a[i] = (u8.readInt16LE(p + i * 2) + 32767) * scale + lo[i % 3];
    p += pad4(pts * 3 * 2);
    const fm = new Float32Array(B);
    for (let i = 0; i < B; i++) fm[i] = u8.readUInt8(p + i) / 255;
    p += pad4(B);
    key.push(a); formed.push(fm);
  }
  return { version, R, K, B, first, ss, bonds, native, ts, key, formed };
}

/* ------------------------------------------------------------------ run */

if (require.main === module) {
  if (!fs.existsSync(SRC)) {
    console.error('missing ' + path.relative(HERE, SRC));
    process.exit(1);
  }
  const t0 = Date.now();
  const b = bake();
  const { buf, R, K, B } = encode(b);
  fs.writeFileSync(OUT, buf);

  const formed = b.folder.formation().filter(x => x > 0.5).length;
  const sep4 = b.hb.filter(x => x.sep === 4).length;
  console.log(`baked ${K} keyframes x ${R} Ca + ${B} H-bonds in ${Date.now() - t0} ms`);
  console.log(`  lands ${b.folder.rmsd().toFixed(2)} A RMSD from deposited, ${formed}/${B} H-bonds formed`);
  console.log(`  ${sep4}/${B} of them i->i+4, ${b.helices.length} deposited helices`);
  console.log(`  wrote ${path.relative(HERE, OUT)} (${(buf.length / 1024).toFixed(0)} KB)`);
}

module.exports = { bake, encode, decode, CHAIN, MAGIC, VERSION };
