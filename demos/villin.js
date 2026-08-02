/* =====================================================================
 *  villin.js — the scale-out mechanic for folding-lab.html's third act.
 *
 *  Page-specific, like folding.js and for the same reason (CLAUDE.md,
 *  "share the plumbing, not the physics"): nothing else here zooms out from
 *  a folded chain to the protein it belongs to. Renders nothing, knows about
 *  no viewer, runs in Node so its claims can be checked without a canvas.
 *  Real angstroms throughout; never sees MolLib.SCALE.
 *
 * ---------------------------------------------------------------------
 *  WHAT THIS IS AND, MUCH MORE IMPORTANTLY, WHAT IT IS NOT
 * ---------------------------------------------------------------------
 *  The chain folding-lab folds is PDB 1VII, the villin headpiece
 *  subdomain. It is not a protein — it is the last 36 residues of one.
 *  Chicken villin-1 (UniProt P02640) is 826 residues, and 1VII is residues
 *  791-826 of it: 35 of the 36 are identical, and the single difference is
 *  His791 -> Met41, the engineered initiator methionine you get when a
 *  subdomain is expressed on its own. Superposed, the two agree to 2.03 A
 *  Ca RMSD. Same fold, same protein, same species.
 *
 *  THE WHOLE-PROTEIN MODEL IS A PREDICTION, NOT A STRUCTURE. There is no
 *  deposited full-length villin. This uses AlphaFold's model (AF-P02640-F1,
 *  v6), and the page must never let that read as measured. AlphaFold ships
 *  two confidence estimates and they say very different things here:
 *
 *    pLDDT (per residue, local shape)
 *      HP35 791-826      mean 87.5   confident
 *      headpiece HP67    mean 83.3   confident
 *      gelsolin core     mean 77.6   usable
 *      linker 745-765    mean 42.1   very low
 *
 *    PAE (pairwise, RELATIVE placement) — the number that matters
 *      HP35 vs itself    mean  2.3 A   the fold is known
 *      core vs core      mean 19.7 A   the six domains are not confidently
 *                                      placed even against each other
 *      HP35 vs core      mean 29.0 A   pinned at the 31.75 A ceiling:
 *                                      NO information
 *
 *  So AlphaFold knows the SHAPE OF EACH DOMAIN well and knows essentially
 *  NOTHING about how they are arranged. The single pose in the deposited
 *  file is not a prediction of villin's shape; it is one arbitrary layout of
 *  parts modelled independently. Quoting that pose's dimensions as "villin
 *  is 9 nm across" would be reporting an artefact as a measurement.
 *
 *  WHY WE DRAW IT FLEXIBLE, AND THE ERROR THAT WOULD BE. Uncertainty is not
 *  motion. A high PAE means the predictor could not place the domain, NOT
 *  that the domain moves — conflating the two is a real scientific mistake
 *  and this file must not encourage it. Villin is drawn flexible because the
 *  BIOLOGY independently says so: the headpiece sits on a genuine flexible
 *  linker, and that tether is what lets villin hold one actin filament with
 *  its core while the headpiece reaches out and grabs a second, which is how
 *  it bundles filaments in a microvillus. PAE is CONSISTENT with that; it is
 *  not the evidence for it.
 *
 *  THE EIGHT ARRANGEMENTS ARE GENERATED, NOT OBSERVED. Arrangement 1 is the
 *  AlphaFold file's own layout. Arrangements 2-8 are made here: domains held
 *  rigid, linkers re-posed, clashes rejected. They are possible layouts
 *  consistent with the linker geometry — nobody has seen them. This is
 *  deliberately the same interface a structure viewer uses to step through
 *  NMR models, and the epistemic status is completely different: an NMR
 *  ensemble is experimental data, this is synthesis. The page has to say so.
 * ===================================================================== */
'use strict';

const VillinLib = (function () {

  /* Chicken villin numbering. HP35 is what folding-lab folds. */
  const HP35 = { start: 791, end: 826 };
  const N_POSES = 8;
  const CA_SPACING = 3.8;        // Ca-Ca along the backbone, angstroms
  /* No fixed clash distance: the bar is calibrated per structure against
     the reference pose's own tightest cross-domain contact. See poses(). */

  const v = {
    sub: (a, b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]],
    add: (a, b) => [a[0]+b[0], a[1]+b[1], a[2]+b[2]],
    mul: (a, s) => [a[0]*s, a[1]*s, a[2]*s],
    dot: (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2],
    len: a => Math.hypot(a[0], a[1], a[2]),
    norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0]/l, a[1]/l, a[2]/l]; },
    dist: (a, b) => Math.hypot(a[0]-b[0], a[1]-b[1], a[2]-b[2]),
  };

  /* ---------------- 1. read the model ---------------- */

  /* parseCA(pdbText) -> { nums, ca, plddt }
     Ca only. At 9 nm an all-atom model is 6517 spheres of mush, and the
     third act draws a tube through the backbone, so the side chains are
     weight the page would pay for and never show. AlphaFold puts its per-
     residue pLDDT in the B-factor column. */
  function parseCA(pdbText) {
    const nums = [], ca = [], plddt = [];
    for (const l of pdbText.split('\n')) {
      if (!l.startsWith('ATOM') || l.slice(12, 16).trim() !== 'CA') continue;
      const p = [+l.slice(30, 38), +l.slice(38, 46), +l.slice(46, 54)];
      if (!p.every(Number.isFinite)) continue;
      nums.push(parseInt(l.slice(22, 26), 10));
      ca.push(p);
      plddt.push(+l.slice(60, 66));
    }
    return { nums, ca, plddt };
  }

  /* ---------------- 2. find the rigid bodies ---------------- */

  /* segment(pae, opts) -> [[startRes, endRes], ...]
     The domain boundaries are DERIVED FROM THE DATA, not typed in. Two
     residues belong to the same rigid body when the model is confident about
     their relative placement, which is exactly what PAE measures — so a
     domain is a run of residues whose mutual PAE stays low.

     At threshold 14 A this returns six core domains plus the headpiece,
     which is villin's textbook architecture (six gelsolin-like repeats and a
     C-terminal headpiece) recovered without anybody supplying it. That
     agreement is the evidence the decomposition is real, and
     tools/check-pdb.js asserts it rather than trusting this comment.

     PAE is not symmetric; averaging is the standard symmetrisation. */
  function segment(pae, opts) {
    const o = Object.assign({ threshold: 14, minLength: 25 }, opts || {});
    const n = pae.length;
    const sym = (i, j) => (pae[i][j] + pae[j][i]) / 2;

    const segs = [];
    let start = 0;
    for (let i = 1; i < n; i++) {
      let m = 0;
      for (let j = start; j < i; j++) m += sym(i, j);
      m /= Math.max(1, i - start);
      if (m > o.threshold) {
        if (i - start >= o.minLength) segs.push([start + 1, i]);
        start = i;
      }
    }
    if (n - start >= o.minLength) segs.push([start + 1, n]);
    return segs;
  }

  /* Residues between two rigid bodies. These are the flexible parts — the
     only thing a generated arrangement is allowed to change. */
  function linkers(domains, nRes) {
    const out = [];
    for (let k = 0; k + 1 < domains.length; k++) {
      const a = domains[k][1], b = domains[k + 1][0];
      if (b - a > 1) out.push([a + 1, b - 1]);
    }
    return out;
  }

  /* ---------------- 3. generate arrangements ---------------- */

  function rotAxisAngle(axis, ang) {
    const [x, y, z] = v.norm(axis), c = Math.cos(ang), s = Math.sin(ang), t = 1 - c;
    return [[t*x*x + c,   t*x*y - s*z, t*x*z + s*y],
            [t*x*y + s*z, t*y*y + c,   t*y*z - s*x],
            [t*x*z - s*y, t*y*z + s*x, t*z*z + c  ]];
  }
  const applyR = (R, p) => R.map(r => r[0]*p[0] + r[1]*p[1] + r[2]*p[2]);

  /* A small deterministic PRNG. The arrangements must be identical on every
     machine and every run, because they are baked to a committed file that a
     checker compares byte for byte. Math.random would make that impossible. */
  function rng(seed) {
    let s = seed >>> 0;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }

  /* poses(parsed, domains, opts) -> [Float32Array, ...]
     Arrangement 0 is the model's own layout, untouched. Each later one hinges
     the chain at its linkers: pick a linker, rotate everything downstream of
     it about a random axis through the linker's first Ca, then rebuild the
     linker itself and reject the result if anything now overlaps.

     Domains are moved RIGIDLY and never deformed — their internal geometry is
     the part AlphaFold is actually confident about (PAE ~2 A within HP35), so
     it is the part we have no business changing. Only the linkers, which the
     model cannot place at all, are allowed to differ. */
  function poses(parsed, domains, opts) {
    const o = Object.assign({ count: N_POSES, seed: 20260801, maxTries: 4000,
                              maxAngle: Math.PI * 0.30, bondTolerance: 1e-3 }, opts || {});
    const { nums, ca } = parsed;
    const n = ca.length;
    const idxOf = new Map(nums.map((r, i) => [r, i]));
    const links = linkers(domains, n);

    const out = [flat(ca)];
    const rand = rng(o.seed);

    /* The bar for "too close" is AlphaFold's own tightest packing, not a
       constant. Villin's model has cross-domain Ca pairs at 3.83 A — real
       protein cores are packed that hard — so a fixed 4.0 A cutoff rejected
       the model itself and every arrangement derived from it. Calibrating
       against the reference means a generated layout must simply be no more
       crowded than the one AlphaFold produced, which is the honest standard:
       we are not claiming these are better packed, only that they are not
       worse. */
    const reference = closestApproach(ca, domains, idxOf, nums);
    const refLen = bondLengths(ca, nums);

    for (let k = 1; k < o.count; k++) {
      let accepted = null;
      for (let attempt = 0; attempt < o.maxTries && !accepted; attempt++) {
        const P = ca.map(p => p.slice());

        /* Hinge along each linker, one residue at a time.

           Rotating the whole downstream suffix about a point that lies ON the
           chain cannot change any bond length: every bond is either entirely
           inside the rotated part, entirely outside it, or is the bond to the
           pivot itself, whose two ends both stay put. So walking a small
           rotation down the linker's residues samples real conformations of
           the joint and leaves the polypeptide exact by construction.

           The earlier version rotated about the linker's first residue and
           then rebuilt the linker to span whatever gap resulted, which is why
           bonds came out anywhere from 2.71 to 4.32 A. Nothing rebuilds
           anything now. */
        for (const [ls, le] of links) {
          for (let r = ls; r <= le; r++) {
            const pivotIdx = idxOf.get(r);
            if (pivotIdx == null || pivotIdx + 1 >= n) continue;
            const axis = [rand()*2 - 1, rand()*2 - 1, rand()*2 - 1];
            if (v.len(axis) < 1e-6) continue;

            /* How freely a joint may swing depends on how much protein hangs
               off it. Villin's three linkers are not equivalent: 243-261 has
               584 residues downstream, so a large rotation there sweeps most
               of the molecule through the rest of it and can only ever clash.
               749-765 — the headpiece tether, the one with pLDDT 42 and PAE
               pinned at the ceiling — carries just 78 and can swing freely.
               Scaling by the downstream fraction says exactly that, and it
               also puts the variation where the lesson is: the arrangements
               differ mostly in where the headpiece has got to, which is what
               AlphaFold could not place and what villin's bundling needs. */
            const downstream = (n - pivotIdx) / n;
            const ang = (rand()*2 - 1) * o.maxAngle * (1 - downstream);
            const R = rotAxisAngle(axis, ang);
            const pivot = P[pivotIdx];
            for (let i = pivotIdx + 1; i < n; i++)
              P[i] = v.add(pivot, applyR(R, v.sub(P[i], pivot)));
          }
        }

        /* Both bars are the reference structure's own. A rotation changes the
           gap a linker must span, and if the gap exceeds what the linker's
           bonds can reach, relaxation leaves the chain stretched — a broken
           polypeptide, which no amount of "it is only a possible arrangement"
           excuses. Checked rather than assumed, because the stretch is
           invisible in a rendered tube. */
        if (bondError(P, nums, refLen) <= o.bondTolerance &&
            closestApproach(P, domains, idxOf, nums) >= reference) accepted = P;
      }
      /* Falling back to the model's own layout would silently show eight
         buttons where two are the same picture. Better to fail the bake. */
      if (!accepted) throw new Error(`could not generate arrangement ${k + 1} without a clash`);
      out.push(flat(accepted));
    }
    return out;
  }

  /* Closest approach between residues that are far apart in sequence.
     Only cross-domain pairs count: within a rigid domain the geometry is
     AlphaFold's and is not ours to second-guess.

     SEQ_GAP exists because a Ca-Ca distance of 3.8 A is not a clash when the
     two residues are neighbours — it is the backbone. The segmentation
     splits the chain at several points where it is covalently continuous
     (129|130, 507|508, 626|627, 722|723), so without this every pose,
     including AlphaFold's own, looks like six overlaps. */
  const SEQ_GAP = 5;

  function closestApproach(P, domains, idxOf, nums) {
    const tag = new Int32Array(P.length).fill(-1);
    domains.forEach(([s, e], d) => {
      for (let r = s; r <= e; r++) { const i = idxOf.get(r); if (i != null) tag[i] = d; }
    });
    let best = Infinity;
    for (let i = 0; i < P.length; i++) {
      if (tag[i] < 0) continue;
      for (let j = i + 1; j < P.length; j++) {
        if (tag[j] < 0 || tag[j] === tag[i]) continue;
        if (Math.abs(nums[j] - nums[i]) < SEQ_GAP) continue;
        const dx = P[j][0]-P[i][0], dy = P[j][1]-P[i][1], dz = P[j][2]-P[i][2];
        const d2 = dx*dx + dy*dy + dz*dz;
        if (d2 < best) best = d2;
      }
    }
    return Math.sqrt(best);
  }

  /* Each backbone bond's length in the reference structure. */
  function bondLengths(P, nums) {
    const L = new Float64Array(P.length);
    for (let i = 0; i + 1 < P.length; i++)
      L[i] = (nums[i + 1] === nums[i] + 1) ? v.dist(P[i], P[i + 1]) : 0;
    return L;
  }

  /* Worst deviation of any backbone bond from its reference length. */
  function bondError(P, nums, refLen) {
    let worst = 0;
    for (let i = 0; i + 1 < P.length; i++) {
      if (!refLen[i]) continue;
      worst = Math.max(worst, Math.abs(v.dist(P[i], P[i + 1]) - refLen[i]));
    }
    return worst;
  }

  const flat = P => {
    const a = new Float32Array(P.length * 3);
    P.forEach((p, i) => { a[i*3] = p[0]; a[i*3+1] = p[1]; a[i*3+2] = p[2]; });
    return a;
  };

  /* Largest Ca-Ca distance in an arrangement. Reported per pose ON PURPOSE:
     villin has no one size, and printing a single number would be the exact
     mistake this file's header warns about. */
  function extent(flatPos) {
    let m = 0;
    const n = flatPos.length / 3;
    for (let i = 0; i < n; i += 3)
      for (let j = i + 3; j < n; j += 3) {
        const dx = flatPos[j*3]-flatPos[i*3], dy = flatPos[j*3+1]-flatPos[i*3+1],
              dz = flatPos[j*3+2]-flatPos[i*3+2];
        m = Math.max(m, dx*dx + dy*dy + dz*dz);
      }
    return Math.sqrt(m);
  }

  /* ---------------- 4. the baked arrangements on disk ---------------- */

  /* Same reasoning as folding.js's bake: deterministic work belongs on disk,
     not repeated in every browser. Also keeps the 1.9 MB PAE matrix out of
     the page entirely — the domain boundaries it implies are baked in, so
     the browser never needs the evidence, only the conclusion.

       'VILN' | version | poses | residues | domains | (pad)
       resNums Int32[residues]
       plddt   Float32[residues]
       doms    Int32[domains*2]      start,end residue numbers
       pos     Float32[poses*residues*3]
  */
  const MAGIC = 0x4e4c4956;      // 'VILN'
  const VERSION = 1;
  const HEADER = 24;

  function encode(model) {
    const { nums, plddt, domains, poses: ps } = model;
    const R = nums.length, D = domains.length, K = ps.length;
    const buf = new ArrayBuffer(HEADER + 4*R + 4*R + 4*D*2 + 4*K*R*3);
    const dv = new DataView(buf);
    dv.setUint32(0, MAGIC, true); dv.setUint32(4, VERSION, true);
    dv.setUint32(8, K, true); dv.setUint32(12, R, true); dv.setUint32(16, D, true);
    let off = HEADER;
    new Int32Array(buf, off, R).set(nums);                    off += 4*R;
    new Float32Array(buf, off, R).set(plddt);                 off += 4*R;
    new Int32Array(buf, off, D*2).set(domains.flat());        off += 4*D*2;
    const all = new Float32Array(buf, off, K*R*3);
    ps.forEach((p, k) => all.set(p, k*R*3));
    return buf;
  }

  function decode(buf) {
    const dv = new DataView(buf);
    if (dv.getUint32(0, true) !== MAGIC) throw new Error('not a baked villin file');
    const version = dv.getUint32(4, true);
    if (version !== VERSION) throw new Error(`villin file is version ${version}, expected ${VERSION}`);
    const K = dv.getUint32(8, true), R = dv.getUint32(12, true), D = dv.getUint32(16, true);
    const need = HEADER + 4*R + 4*R + 4*D*2 + 4*K*R*3;
    if (buf.byteLength !== need) throw new Error(`villin file truncated: ${buf.byteLength} of ${need}`);
    let off = HEADER;
    const nums = new Int32Array(buf, off, R);            off += 4*R;
    const plddt = new Float32Array(buf, off, R);         off += 4*R;
    const flatD = new Int32Array(buf, off, D*2);         off += 4*D*2;
    const all = new Float32Array(buf, off, K*R*3);
    const domains = [];
    for (let d = 0; d < D; d++) domains.push([flatD[d*2], flatD[d*2+1]]);
    const poses = [];
    for (let k = 0; k < K; k++) poses.push(all.subarray(k*R*3, (k+1)*R*3));
    return { nums, plddt, domains, poses, residues: R, count: K };
  }

  return { parseCA, segment, linkers, poses, encode, decode, extent,
           closestApproach, bondLengths, bondError,
           HP35, N_POSES, CA_SPACING, SEQ_GAP, _v: v, _rng: rng };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = VillinLib;
