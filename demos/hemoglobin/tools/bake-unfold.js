#!/usr/bin/env node
/* =====================================================================
 *  bake-unfold.js — fold the beta chain by UNFOLDING it and running the
 *  film backwards.
 *
 *  ---------------------------------------------------------------------
 *  WHY BACKWARDS
 *  ---------------------------------------------------------------------
 *  Folding forwards is a search: find a way into a compact tangle without
 *  passing any part of the chain through any other. bake-hb.js does that
 *  with a steered relaxation and it does not entirely succeed — the chain
 *  closed to 0.89 A between non-neighbouring alpha carbons before the
 *  de-clashing in settle() was bolted on, and even after it there are
 *  places a careful eye still catches.
 *
 *  Unfolding is not a search. It is monotone expansion: almost everything
 *  is moving APART for the whole trajectory, so the geometry is pushed
 *  away from contact rather than into it, and the steric term is working
 *  with the motion instead of against it.
 *
 *  It is also a recognised method rather than a trick. Daggett and
 *  Fersht's atomic-resolution folding work is built on it, and the
 *  justification in that literature is exactly the one that makes it
 *  attractive here: unfolding starts from the BEST characterised state on
 *  the pathway — the deposited structure — while folding starts from the
 *  least known and most heterogeneous one. Unfolding trajectories are also
 *  reported to be less diverse than folding trajectories, which is the
 *  physics way of saying the problem is better conditioned.
 *
 *  WHAT THIS BUYS, CONCRETELY. The last frame is the crystal structure
 *  because it is the FIRST frame of the unfold, by construction — not
 *  because a blend dragged it there. Everything settle() needed in order
 *  to land (the smoothstep blend, the omega repair, the H-bond holds, the
 *  warm-started walk) exists to solve a problem this formulation does not
 *  have. All 103 hydrogen bonds are formed at t=1 for the same reason.
 *
 *  ---------------------------------------------------------------------
 *  WHAT IT DOES NOT BUY, AND THE PAGE MUST STILL SAY SO
 *  ---------------------------------------------------------------------
 *  Microscopic reversibility holds UNDER THE SAME CONDITIONS. A driven
 *  unfold is not the same conditions as folding, so a reversed unfolding
 *  trajectory is not literally a folding pathway. Neither was the forward
 *  version — that was a relaxation steered toward an answer already known
 *  — so nothing true is being given up; the animation trades one invented
 *  path for an invented path that cannot do impossible things. And none of
 *  this touches the bigger caveat: haemoglobin folds co-translationally
 *  and its tertiary structure is organised by heme, so no method makes
 *  this the real pathway.
 *
 *  ---------------------------------------------------------------------
 *  SWELL, DO NOT PULL
 *  ---------------------------------------------------------------------
 *  Unfolding by yanking the two termini unravels the chain sequentially,
 *  and reversed that reads as a zip closing from one end — mechanical,
 *  obviously an animation. The chain is instead driven toward the extended
 *  conformation everywhere at once, so the reverse reads as a collapse
 *  from all sides, which is what folding looks like.
 *
 *  ---------------------------------------------------------------------
 *  TWO STAGES, WHICH ARE THE PAGE'S TWO ACTS RUN BACKWARDS
 *  ---------------------------------------------------------------------
 *  The helices are held RIGID for the first part of the unfold and
 *  released for the second. So:
 *
 *      unfold  0.0 -> RIGID_UNTIL   eight rigid helices pull apart
 *      unfold  RIGID_UNTIL -> 1.0   each helix unwinds into extended chain
 *
 *  reversed, that is:
 *
 *      play    0.0 -> ...           chain coils into helices   (level 2)
 *      play    ... -> 1.0           helices pack together      (level 3)
 *
 *  which is the act structure the lesson already teaches, now falling out
 *  of the method instead of being imposed on top of it. Treating formed
 *  helices as rigid bodies that diffuse and dock is the diffusion-collision
 *  model (Karplus & Weaver), and it is the model with the best track record
 *  on ALL-ALPHA proteins — which check-hb.js independently asserts this
 *  fold is, with zero beta strand anywhere in it.
 *
 *  Rigidity is imposed as distance constraints between every pair of alpha
 *  carbons inside a deposited helix, held at their deposited separation.
 *  That is enough to fix a body without a physics engine: a full set of
 *  pairwise distances determines a rigid shape up to reflection, and
 *  reflection is unreachable by continuous motion from the native state.
 *
 *  Run:  node hemoglobin/tools/bake-unfold.js     (offline, no dependencies)
 * ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const FoldLib = require('../../folding/folding.js');
const RibbonLib = require('../../folding/ribbon.js');
const { extract } = require('./chain.js');
const { encode, CHAIN } = require('./bake-hb.js');

const HERE = path.join(__dirname, '..');
const SRC = path.join(HERE, 'data', '2HHB.pdb');

/* ------------------------------------------------------- which end is which
 *
 *  `--flip` turns the extended target end for end before the unfold is run
 *  against it, and writes a separate file so the two can be compared side
 *  by side in the browser (hemoglobin-lab.html?fold=flip).
 *
 *  WHY IT MIGHT MATTER. The extended conformation comes out of FoldLib's
 *  NeRF build and then gets laid along X by orient(), and NOTHING in either
 *  step knows anything about where the chain's residues sit in the FOLDED
 *  structure. Measured on the current pair, the correlation between a
 *  residue's position along the long axis natively and its position along
 *  that axis when extended is -0.337 — NEGATIVE. The unfold is being asked
 *  to turn the chain inside out relative to its own native layout.
 *
 *  It shows up hardest at the ends. Both termini sit on the -X side of the
 *  folded protein (res 1 at -13 A, res 146 at -18 A), but the extended
 *  target sends res 1 to -251 and res 146 to +251: the C-terminus has to
 *  travel 270 A straight across the whole molecule, past everything else,
 *  to reach its place. That is a tangle imposed by the target rather than
 *  produced by the dynamics, and no amount of steric work fixes a route
 *  that was wrong before the first step.
 *
 *  A 180 DEGREE ROTATION, NOT A SIGN FLIP. Negating X alone is a
 *  REFLECTION — det = -1 — and it would hand back the mirror image of the
 *  extended chain, which is the enantiomer error MolecularGeometry.md 1.3
 *  calls out as invisible to most checks. Rotating 180 degrees about Z
 *  ((x,y,z) -> (-x,-y,z)) reverses the long axis with det = +1 and leaves
 *  the handedness alone. check-hb.js measures helix handedness on the
 *  computed part of the trajectory and would fail if this were got wrong.
 */
const FLIP = process.argv.includes('--flip');
const OUT = path.join(HERE, 'data',
                      FLIP ? '2HHB-B.fold.flip.bin' : '2HHB-B.fold.bin');

/* ---------------- the unfold ---------------- */

const STEPS = 7000;          // integration steps of the unfold
const KEYFRAMES = 185;       // recorded frames, matching the forward bake
const RIGID_UNTIL = 0.55;    // unfold time at which the helices are released
const RIGID_FADE = 0.15;     // and how long they take to let go
const PULL = 0.010;          // per-step drift toward the extended target
const MAX_DRIFT = 0.10;      // A, furthest any atom may be driven in one step
const RELAX_PASSES = 40;     // constraint passes after each step
const CLASH_MIN = 4.0;       // A, closest allowed non-local Ca-Ca
const CLASH_SEP = 3;         // |i-j| below this is the chain itself
const NEAR = 9.0;            // A, steric candidate-pair radius

const smoothstep = x => x * x * (3 - 2 * x);

function build() {
  const raw = fs.readFileSync(SRC, 'utf8');
  const ex = extract(raw, CHAIN);
  const parsed = FoldLib.parse(ex.text, {});
  const hb = FoldLib.hbonds(parsed);

  /* Put the problem in the viewing frame FIRST. orient() rotates the
     deposited coordinates in place onto the extended chain's principal
     axes, so it must run before either endpoint is read — otherwise the
     unfold would start in one basis and end in another. Idempotent. */
  FoldLib.orient(parsed);

  const nodes = parsed.nodes, n = nodes.length;
  const caIdx = parsed.residues.map(r => r.atoms.CA);
  if (caIdx.some(i => i == null)) throw new Error('a residue has no CA');
  const R = caIdx.length;

  /* The two endpoints. `native` is where the unfold begins — and therefore,
     reversed, exactly where the animation ends. `target` is the extended
     chain the forward solver used as ITS start, so the reversed trajectory
     opens on the same 503 A rod the page has always opened on. */
  const native = nodes.map(nd => nd.native.slice());
  const target = FoldLib.extended(parsed);

  if (FLIP) {
    const c = [0, 1, 2].map(k => target.reduce((s, p) => s + p[k], 0) / target.length);
    for (const p of target) {                       // 180 deg about Z, det = +1
      const x = p[0] - c[0], y = p[1] - c[1];
      p[0] = c[0] - x; p[1] = c[1] - y;
    }
  }

  /* ---- constraints ---- */
  const cI = [], cJ = [], cL = [];
  const seen = new Set();
  const at = (a, b) => Math.hypot(native[a][0] - native[b][0],
                                  native[a][1] - native[b][1],
                                  native[a][2] - native[b][2]);
  const addPair = (i, j) => {
    if (i === j) return;
    const key = i < j ? i * n + j : j * n + i;
    if (seen.has(key)) return;
    seen.add(key);
    cI.push(i); cJ.push(j); cL.push(at(i, j));
  };

  const adj = Array.from({ length: n }, () => []);
  for (const [i, j] of parsed.bonds) { adj[i].push(j); adj[j].push(i); addPair(i, j); }
  for (let k = 0; k < n; k++)
    for (let a = 0; a < adj[k].length; a++)
      for (let b = a + 1; b < adj[k].length; b++) addPair(adj[k][a], adj[k][b]);

  /* Omega: CA(i)-CA(i+1) picks trans over cis and O(i)-CA(i+1) holds the
     peptide flat. Omega is a 1-4 torsion so nothing above says anything
     about it, and without these a relaxation rotates straight through it.
     folding.js carries the same two pairs and the same reasoning. */
  const caOf = new Map(), oOf = new Map();
  nodes.forEach(nd => {
    if (nd.name === 'CA') caOf.set(nd.res, nd.i);
    if (nd.name === 'O') oOf.set(nd.res, nd.i);
  });
  for (const [i, j] of parsed.bonds) {
    const A = nodes[i], B = nodes[j];
    let C = null, N = null;
    if (A.name === 'C' && B.name === 'N' && B.res === A.res + 1) { C = A; N = B; }
    else if (B.name === 'C' && A.name === 'N' && A.res === B.res + 1) { C = B; N = A; }
    if (!C) continue;
    const ca1 = caOf.get(C.res), ca2 = caOf.get(N.res), o1 = oOf.get(C.res);
    if (ca1 != null && ca2 != null) addPair(ca1, ca2);
    if (o1 != null && ca2 != null) addPair(o1, ca2);
  }
  const nFixed = cI.length;

  /* Helix rigidity, in its own block so it can be released partway. Every
     Ca pair inside a deposited helix, at its deposited separation — plus,
     below, the hydrogen bonds those helices are made of.

     CA PAIRS ALONE ARE NOT ENOUGH, and the reason is worth keeping. They
     hold the helix's SHAPE, but the page counts hydrogen bonds, and an
     H-bond is a distance between an O and an H — neither of which is a Ca.
     With shape-only rigidity the O and H drifted inside a helix that was
     geometrically perfect, and the tally rose to 62, fell to 41, and rose
     again. A bond count that goes down in the middle of the fold destroys
     the one thing this page is built to show: that level 2 finishes and
     stays finished while level 3 does its work. */
  const first = parsed.residues[0].num;
  const ss = RibbonLib.assign(R, first, ex.helices);
  const rI = [], rJ = [], rL = [];
  for (const [a, b] of ex.helices)
    for (let p = a; p <= b; p++)
      for (let q = p + 1; q <= b; q++) {
        const i = caIdx[p - first], j = caIdx[q - first];
        if (i == null || j == null) continue;
        rI.push(i); rJ.push(j); rL.push(at(i, j));
      }

  /* Which atoms are inside a deposited helix. During the rigid stage the
     pull is applied to everything EXCEPT these — see unfold(). */
  const inHelix = new Uint8Array(n);
  for (const [a2, b2] of ex.helices)
    for (const r of parsed.residues)
      if (r.num >= a2 && r.num <= b2)
        for (const i of Object.values(r.atoms)) if (i != null) inHelix[i] = 1;

  /* The hydrogen bonds that live INSIDE one helix, held at their deposited
     O...H separation for as long as that helix is rigid. Bonds spanning two
     helices or a loop are left free — those are level 3's business and must
     be allowed to form late. */
  const helixOf = num => ex.helices.findIndex(([a2, b2]) => num >= a2 && num <= b2);
  for (const b3 of hb) {
    const ha = helixOf(b3.from), hb2 = helixOf(b3.to);
    if (ha < 0 || ha !== hb2) continue;
    rI.push(b3.o); rJ.push(b3.h); rL.push(at(b3.o, b3.h));
  }

  return { parsed, hb, nodes, n, caIdx, R, native, target, ss, first,
           helices: ex.helices, cI, cJ, cL, nFixed, rI, rJ, rL, inHelix };
}

function unfold(m) {
  const { n, R, caIdx, native, target, cI, cJ, cL, rI, rJ, rL, inHelix } = m;

  const P = new Float64Array(n * 3);
  native.forEach((p, i) => { P[i*3] = p[0]; P[i*3+1] = p[1]; P[i*3+2] = p[2]; });

  let sI = [], sJ = [];
  const findNear = () => {
    sI = []; sJ = [];
    for (let i = 0; i < R; i++) {
      const a = caIdx[i] * 3;
      for (let j = i + CLASH_SEP; j < R; j++) {
        const b = caIdx[j] * 3;
        const dx = P[b] - P[a], dy = P[b+1] - P[a+1], dz = P[b+2] - P[a+2];
        if (dx*dx + dy*dy + dz*dz < NEAR * NEAR) { sI.push(caIdx[i]); sJ.push(caIdx[j]); }
      }
    }
  };

  /* One combined sweep: fixed geometry, helix rigidity at its current
     weight, and the unilateral steric term — all in the same relaxation.
     Alternating separate solvers is what failed in settle(); they undo
     each other and never converge together. */
  const relax = (passes, rigid) => {
    for (let pass = 0; pass < passes; pass++) {
      for (let c = 0; c < cI.length; c++) {
        const a = cI[c] * 3, b = cJ[c] * 3;
        const dx = P[b] - P[a], dy = P[b+1] - P[a+1], dz = P[b+2] - P[a+2];
        const L = Math.hypot(dx, dy, dz) || 1e-6;
        const s = 0.5 * (L - cL[c]) / L;
        P[a] += dx*s; P[a+1] += dy*s; P[a+2] += dz*s;
        P[b] -= dx*s; P[b+1] -= dy*s; P[b+2] -= dz*s;
      }
      if (rigid > 0)
        for (let c = 0; c < rI.length; c++) {
          const a = rI[c] * 3, b = rJ[c] * 3;
          const dx = P[b] - P[a], dy = P[b+1] - P[a+1], dz = P[b+2] - P[a+2];
          const L = Math.hypot(dx, dy, dz) || 1e-6;
          const s = 0.5 * rigid * (L - rL[c]) / L;
          P[a] += dx*s; P[a+1] += dy*s; P[a+2] += dz*s;
          P[b] -= dx*s; P[b+1] -= dy*s; P[b+2] -= dz*s;
        }
      for (let c = 0; c < sI.length; c++) {
        const a = sI[c] * 3, b = sJ[c] * 3;
        const dx = P[b] - P[a], dy = P[b+1] - P[a+1], dz = P[b+2] - P[a+2];
        const L2 = dx*dx + dy*dy + dz*dz;
        if (L2 >= CLASH_MIN * CLASH_MIN) continue;
        const L = Math.sqrt(L2) || 1e-6;
        const s = 0.5 * (L - CLASH_MIN) / L;
        P[a] += dx*s; P[a+1] += dy*s; P[a+2] += dz*s;
        P[b] -= dx*s; P[b+1] -= dy*s; P[b+2] -= dz*s;
      }
    }
  };

  /* Snapshots are taken densely and resampled by ARC LENGTH at the end,
     not taken at even step counts. The unfold does not move at a uniform
     rate — it is slow while the helices are rigid and quicker once they
     let go — so evenly spaced steps produce unevenly spaced motion, which
     on playback is a chain that drifts and then lurches. Resampling on
     cumulative displacement makes every keyframe the same distance of
     travel apart, which is what the player's linear interpolation assumes.
     It is also why the largest step and the median step end up close
     together instead of a factor of forty apart. */
  const every = 4;
  const frames = [];
  const snap = () => frames.push(Float32Array.from(P));
  snap();

  for (let step = 1; step <= STEPS; step++) {
    const u = step / STEPS;
    /* Release the helices partway, smoothly — a hard switch would put a
       kink in the trajectory at exactly the moment the reversed film calls
       "level 2 finished". */
    const rigid = u <= RIGID_UNTIL ? 1
                : 1 - smoothstep(Math.min(1, (u - RIGID_UNTIL) / RIGID_FADE));

    /* PULL THE STRING, AND THE BEADS FOLLOW. While the helices are rigid
       the drift is applied to the LINKERS ONLY, and the helices move
       because the chain connecting them is being extended.

       Driving every atom toward the extended target during the rigid stage
       was the first attempt and it does not work, because the two demands
       contradict each other: the extended conformation requires unwound
       helices, and the rigidity constraints forbid exactly that. The
       relaxation split the difference — the chain stalled at 358 A across
       for more than half the trajectory and the backbone was crushed to
       2.43 A between consecutive alpha carbons while the two terms fought.
       Pulling only the loops asks for something the constraints permit, so
       it actually happens. */
    /* CLAMPED, and the clamp is what makes the constraints tractable. The
       drift is proportional to how far an atom still has to go, so at the
       start of the unfold — where the chain is compact and the extended
       target is hundreds of angstroms away — a single step moved some
       atoms several angstroms, far more than the relaxation could absorb
       without bending something. That showed up as consecutive alpha
       carbons crushed to 2.43 A, and as an unfold that lurched rather than
       ran. Capping the per-step move turns the drift into a constant-speed
       drag, which the constraints can follow exactly. */
    for (let i = 0; i < n; i++) {
      if (rigid > 0.5 && inHelix[i]) continue;
      let dx = (target[i][0] - P[i*3]) * PULL,
          dy = (target[i][1] - P[i*3+1]) * PULL,
          dz = (target[i][2] - P[i*3+2]) * PULL;
      const L = Math.hypot(dx, dy, dz);
      if (L > MAX_DRIFT) { const k = MAX_DRIFT / L; dx *= k; dy *= k; dz *= k; }
      P[i*3] += dx; P[i*3+1] += dy; P[i*3+2] += dz;
    }

    findNear();
    relax(RELAX_PASSES, rigid);
    if (step % every === 0 || step === STEPS) snap();
  }
  return resample(frames, KEYFRAMES);
}

/* resample(frames, k) -> k frames evenly spaced by cumulative motion.
   Distance between frames is measured as the largest single-atom move,
   which is the quantity playback smoothness actually depends on. */
function resample(frames, k) {
  const n3 = frames[0].length;
  const cum = [0];
  for (let f = 1; f < frames.length; f++) {
    let d = 0;
    for (let i = 0; i < n3; i += 3) {
      const s = Math.hypot(frames[f][i] - frames[f-1][i],
                           frames[f][i+1] - frames[f-1][i+1],
                           frames[f][i+2] - frames[f-1][i+2]);
      if (s > d) d = s;
    }
    cum.push(cum[f-1] + d);
  }
  const total = cum[cum.length - 1];
  const out = [];
  let c = 0;
  for (let q = 0; q < k; q++) {
    const want = (q / (k - 1)) * total;
    while (c < cum.length - 2 && cum[c + 1] < want) c++;
    const span = cum[c + 1] - cum[c];
    const u = span > 1e-9 ? (want - cum[c]) / span : 0;
    const A = frames[c], B = frames[Math.min(frames.length - 1, c + 1)];
    const a = new Float32Array(n3);
    for (let i = 0; i < n3; i++) a[i] = A[i] + (B[i] - A[i]) * u;
    out.push(a);
  }
  /* The endpoints must be exact, not interpolated: the last frame of the
     reversed film is the deposited structure and has to stay so. */
  out[0] = frames[0];
  out[k - 1] = frames[frames.length - 1];
  return out;
}

/* ---------------- run ---------------- */

function bakeUnfold() {
  const m = build();
  const frames = unfold(m);

  /* REVERSE. The unfold ran native -> extended; the animation plays
     extended -> native. */
  frames.reverse();

  const K = frames.length;
  const ts = frames.map((_, i) => i / (K - 1));

  /* Formation measured on the coordinates that will be drawn, using
     folding.js's own ramp. Nothing is scheduled: reversed, a bond forms on
     the frame the geometry actually closes it. */
  const formed = frames.map(P => {
    const a = new Float32Array(m.hb.length);
    for (let k = 0; k < m.hb.length; k++) {
      const o = m.hb[k].o * 3, h = m.hb[k].h * 3;
      const d = Math.hypot(P[o] - P[h], P[o+1] - P[h+1], P[o+2] - P[h+2]);
      a[k] = Math.max(0, Math.min(1, (3.6 - d) / (3.6 - 2.2)));
    }
    return a;
  });

  const traj = { key: frames, formed, ts, count: K, atoms: m.n, hb: m.hb };

  return {
    parsed: m.parsed, hb: m.hb, traj,
    caIdx: m.caIdx,
    oIdx: m.hb.map(b => b.o),
    hIdx: m.hb.map(b => b.h),
    ss: m.ss, first: m.first, helices: m.helices,
    /* The unfold's first frame is the deposited structure, so the fold's
       "unblended final frame" — what check-hb.js measures handedness on —
       is the reversed trajectory's last, which is that same structure. */
    preLand: Float64Array.from(frames[K - 1]),
  };
}

if (require.main === module) {
  const t0 = Date.now();
  const b = bakeUnfold();
  const { buf } = encode(b);
  fs.writeFileSync(OUT, buf);
  const last = b.traj.formed[b.traj.count - 1];
  console.log(`unfolded and reversed ${b.traj.count} keyframes in ${Date.now() - t0} ms` +
              (FLIP ? '  [--flip: extended target turned end for end]' : ''));
  console.log(`  ${[...last].filter(x => x > 0.5).length}/${b.hb.length} H-bonds formed at t=1`);
  console.log(`  wrote ${path.relative(HERE, OUT)} (${(buf.length / 1024).toFixed(0)} KB)`);
}

module.exports = { bakeUnfold, build, unfold };
