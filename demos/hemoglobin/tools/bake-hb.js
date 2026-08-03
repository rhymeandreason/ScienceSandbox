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

/* ------------------------------------------------------------- de-clashing
 *
 *  THE CHAIN PASSED THROUGH ITSELF DURING THE TERTIARY COLLAPSE, and on a
 *  ribbon that is unmissable: two helices drawn as solid bands slide across
 *  each other around 50% of the way through act 3.
 *
 *  Measured on the trajectory before this existed, over Ca pairs at least
 *  CLASH_SEP apart along the chain:
 *
 *      t      closest non-local Ca-Ca      pairs under 5.2 A
 *      0.44           3.86 A                     11
 *      0.65           1.08 A                     73
 *      0.79           1.25 A                    196
 *      0.83           0.89 A                    183
 *      1.00           4.17 A                     13
 *      deposited      4.16 A                     13
 *
 *  0.89 A between two alpha carbons is not a tight contact, it is one
 *  strand occupying the same space as another. The deposited protein never
 *  goes below 4.16.
 *
 *  WHY THE SOLVER LETS IT. folding.js does have a steric term, but it is a
 *  soft push that only switches on once two atoms are ALREADY within 2.7 A,
 *  and the constraint projection that runs after it — eight passes over
 *  bond lengths and angles — knows nothing about sterics and is free to
 *  shove the pair back through each other to satisfy a bond. At villin's
 *  36 residues and 199 atoms the chain rarely gets the chance. Haemoglobin
 *  collapsing from 503 A to 45 gets it constantly.
 *
 *  FIXED HERE AND NOT IN folding.js, deliberately, for the same reason the
 *  landing is: that solver is shared with folding-lab, and stiffening its
 *  sterics would restate villin's fold as a side effect of fixing this one.
 *
 *  Corrections are applied PER RESIDUE, rigidly — the whole N/CA/C/O/H set
 *  moves with its alpha carbon. Pushing lone atoms apart would tear the
 *  residue open and hand the projection a mess to clean up; moving the
 *  residue as a unit leaves its internal geometry exactly right and leaves
 *  only the inter-residue bonds for the projection, which is what it is
 *  good at.
 *
 *  4.1 A rather than something roomier because the deposited structure
 *  itself sits at 4.16, and a threshold the real protein cannot satisfy
 *  would fight the landing all the way to t=1. It is comfortably enough for
 *  the cartoon: the helix band is 2.6 A wide, so 4.1 A between centre lines
 *  cannot intersect. */
const CLASH_MIN = 3.6;                   // A, closest allowed non-local Ca-Ca
const CLASH_SEP = 3;                     // |i-j| below this is the chain itself
const CLASH_PASSES = 400;                // combined relaxation passes per frame

const smoothstep = x => x * x * (3 - 2 * x);

function settle(traj, parsed, hb, caIdx) {
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

  /* THE OMEGA PAIRS, and leaving them out was this post-process's own version
     of a bug folding.js already had and already fixed — its comment even
     records that a cartoon is what exposed it. Omega is the CA-C-N-CA
     torsion, a 1-4 relationship, so 1-2 and 1-3 say nothing about it and a
     relaxation will happily rotate the peptide toward cis. Consecutive alpha
     carbons then close from 3.80 A (trans) to about 2.9 (cis), and the
     backbone reads as crushed. Measured here at 2.56 A before these pairs
     were added — below even cis, so through geometry no peptide can adopt —
     and it was stubbornly independent of every steric knob, which is what
     gave it away as a different bug entirely.

     Omega really is rigid: the C-N bond has partial double-bond character
     and the barrier is ~20 kcal/mol. Phi and psi, the actual degrees of
     freedom, stay free. Same two pairs folding.js uses, same deposited
     targets — CA(i)-CA(i+1) picks trans over cis, O(i)-CA(i+1) holds the
     unit flat. */
  const caOf = new Map(), oOf = new Map();
  nodes.forEach(nd => {
    if (nd.name === 'CA') caOf.set(nd.res, nd.i);
    if (nd.name === 'O')  oOf.set(nd.res, nd.i);
  });
  let omegaPairs = 0;
  for (const [i, j] of parsed.bonds) {
    const A = nodes[i], B = nodes[j];
    let C = null, N = null;
    if (A.name === 'C' && B.name === 'N' && B.res === A.res + 1) { C = A; N = B; }
    else if (B.name === 'C' && A.name === 'N' && A.res === B.res + 1) { C = B; N = A; }
    if (!C) continue;
    const ca1 = caOf.get(C.res), ca2 = caOf.get(N.res), o1 = oOf.get(C.res);
    for (const [q, r] of [[ca1, ca2], [o1, ca2]]) {
      if (q == null || r == null) continue;
      const before = cI.length;
      addPair(q, r);
      if (cI.length > before) omegaPairs++;
    }
  }
  if (omegaPairs < 2 * (parsed.residues.length - 1))
    throw new Error(`only ${omegaPairs} omega pairs for ${parsed.residues.length} residues`);

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
  /* Each residue's atoms, so a steric correction can move the residue as a
     unit rather than tearing one atom out of it. */
  const groups = parsed.residues.map(r => Object.values(r.atoms).filter(i => i != null));
  const R = caIdx.length;

  /* ONE RELAXATION, NOT TWO ALTERNATING ONES — this is the third thing this
     post-process got wrong and the one that took longest to see. Pushing
     clashing residues apart and THEN projecting the bonds back is two
     solvers taking turns undoing each other: the push tears the peptide
     geometry, the projection drags the residue back toward whatever it was
     inside, and neither ever wins. Every knob made it worse somewhere else —
     more rounds bought separation (0.89 A -> 4.08) at the cost of Ca-Ca
     bonds crushed to 2.43 A and 5 A jumps between neighbouring keyframes.

     So the steric term becomes just another constraint in the SAME Jacobi
     sweep as the bonds and angles, and the whole thing relaxes together.
     The difference is that bonds are equalities — always pulled to their
     deposited length — while a steric pair is a UNILATERAL constraint that
     does nothing at all unless the pair is too close. That is the standard
     position-based formulation and it converges where the alternating
     version could not.

     Sterics act on the alpha carbons alone and let the bond and angle
     constraints carry the rest of each residue along, rather than moving
     residues rigidly. Rigid moves were the earlier version and they are
     what put the peptide bond under strain in the first place. */

  /* Candidate steric pairs, rebuilt per frame: only non-local Ca pairs
     already within NEAR are worth testing every pass, which turns 10,585
     tests into a few hundred and is what makes running them inside the
     relaxation affordable. */
  const NEAR = 9.0;
  let sI = [], sJ = [];
  const findNear = P => {
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

  /* Per-frame constraints holding shut the hydrogen bonds the SOLVER had
     already made. Without these the de-clashing dissolved the helices: bond
     lengths, angles and omega are all pinned, but PHI AND PSI ARE FREE — they
     are the fold's actual degrees of freedom — so a steric push rearranges
     them, and an alpha helix is nothing but a phi/psi pattern held by its
     i->i+4 hydrogen bonds. At t=0.81 the tally fell from 84 formed bonds to
     21 and two thirds of the ribbon reverted to coil, which reads as level 2
     UNDOING itself during level 3: the exact opposite of what the caption
     underneath it says, and a worse error than the intersecting helices this
     was all meant to fix.

     So a bond that had formed in the raw trajectory is held at the length it
     had there. This does not invent secondary structure — a bond that the
     solver had not made is not in the list, and one it makes later joins the
     list on the frame it makes it. It only stops the clean-up from taking
     apart what the fold had already built. */
  let hI = [], hJ = [], hL = [];
  const holdBonds = raw => {
    hI = []; hJ = []; hL = [];
    for (let k = 0; k < hb.length; k++) {
      const o = hb[k].o * 3, h = hb[k].h * 3;
      const L = Math.hypot(raw[o] - raw[h], raw[o+1] - raw[h+1], raw[o+2] - raw[h+2]);
      if (L > 3.2) continue;                  // not formed in the solver's own frame
      hI.push(hb[k].o); hJ.push(hb[k].h); hL.push(L);
    }
  };

  const relax = (P, passes, steric) => {
    for (let pass = 0; pass < passes; pass++) {
      for (let c = 0; c < hI.length; c++) {
        const a = hI[c] * 3, b = hJ[c] * 3;
        const dx = P[b] - P[a], dy = P[b+1] - P[a+1], dz = P[b+2] - P[a+2];
        const L = Math.hypot(dx, dy, dz) || 1e-6;
        const s = 0.5 * (L - hL[c]) / L;
        P[a] += dx * s; P[a+1] += dy * s; P[a+2] += dz * s;
        P[b] -= dx * s; P[b+1] -= dy * s; P[b+2] -= dz * s;
      }
      // equalities: bond lengths and the 1-3 pairs that hold the angles
      for (let c = 0; c < cI.length; c++) {
        const a = cI[c] * 3, b = cJ[c] * 3;
        const dx = P[b] - P[a], dy = P[b+1] - P[a+1], dz = P[b+2] - P[a+2];
        const L = Math.hypot(dx, dy, dz) || 1e-6;
        const s = 0.5 * (L - cL[c]) / L;
        P[a] += dx * s; P[a+1] += dy * s; P[a+2] += dz * s;
        P[b] -= dx * s; P[b+1] -= dy * s; P[b+2] -= dz * s;
      }
      if (!steric) continue;
      // unilateral: separate only what is actually interpenetrating
      for (let c = 0; c < sI.length; c++) {
        const a = sI[c] * 3, b = sJ[c] * 3;
        const dx = P[b] - P[a], dy = P[b+1] - P[a+1], dz = P[b+2] - P[a+2];
        const L2 = dx*dx + dy*dy + dz*dz;
        if (L2 >= CLASH_MIN * CLASH_MIN) continue;
        const L = Math.sqrt(L2) || 1e-6;
        const s = 0.5 * (L - CLASH_MIN) / L;
        P[a] += dx * s; P[a+1] += dy * s; P[a+2] += dz * s;
        P[b] -= dx * s; P[b+1] -= dy * s; P[b+2] -= dz * s;
      }
    }
  };

  /* THE WHOLE TRAJECTORY IS WALKED, not just the landing: the chain starts
     passing through itself around t=0.4, long before the blend begins. */
  const rawFrames = traj.key.map(a => Float64Array.from(a));
  const carried = Float64Array.from(rawFrames[0]);

  for (let f = 0; f < traj.count; f++) {
    const w = traj.ts[f] <= LAND_FROM ? 0
            : smoothstep(Math.min(1, (traj.ts[f] - LAND_FROM) / (1 - LAND_FROM)));
    const P = traj.key[f];

    // carry the corrected chain forward by the solver's own step
    if (f > 0)
      for (let i = 0; i < n * 3; i++) carried[i] += rawFrames[f][i] - rawFrames[f-1][i];

    // pull it onto the measured coordinates
    if (w > 0 && w < 1) {
      for (let i = 0; i < n; i++) {
        const nat = nodes[i].native;
        for (let k = 0; k < 3; k++)
          carried[i * 3 + k] += (nat[k] - carried[i * 3 + k]) * w;
      }
    }

    /* Separate anything that ended up inside something else, then put the
       geometry back. Alternated rather than done once each, because a steric
       push bends bonds and a projection can shove a pair back into contact —
       they have to converge together.

       THIS RUNS AFTER THE LANDING BLEND, NOT BEFORE IT. When it ran first,
       the blend and its 150 projection passes were free to walk a separated
       pair back into each other, and they did: the closest non-local contact
       sagged to 3.03 A at t=0.92 in a trajectory that was otherwise held at
       4.1. De-clashing has to be the last thing that touches the frame, or
       it is only a suggestion. */
    if (w < 1) {
      /* STERICS STAY ON THROUGH THE LANDING, and the obvious-looking
         optimisation of switching them off there is wrong. The target is
         the deposited chain, whose own closest non-local contact is 4.16 A,
         so it is tempting to argue the blend is already walking toward a
         clash-free state and the steric term is only picking fights. It
         was tried: the closest contact went straight back to 0.67 A. A
         straight Cartesian blend between two conformations that individually
         do not clash can still take a strand through another on the way,
         because every atom travels in a straight line and the chain does
         not. */
      findNear(carried);
      holdBonds(rawFrames[f]);
      relax(carried, CLASH_PASSES, true);
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

  /* Which node index is which. The trajectory is indexed by node, so the
     three subsets the page draws are just index lists into each frame.
     Needed BEFORE settle(), which de-clashes on alpha carbons. */
  const caIdx = parsed.residues.map(r => r.atoms.CA);
  if (caIdx.some(i => i == null))
    throw new Error('a residue of chain ' + CHAIN + ' has no CA');
  const oIdx = hb.map(b => b.o);
  const hIdx = hb.map(b => b.h);

  settle(traj, parsed, hb, caIdx);

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
  console.error('bake-hb.js is superseded and no longer writes the trajectory.');
  console.error('Run instead:  node hemoglobin/tools/bake-unfold.js');
  process.exit(1);
}

if (0) {
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
