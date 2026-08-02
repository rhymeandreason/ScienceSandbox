/* =====================================================================
 *  folding.js — the folding mechanic for folding-lab.html.
 *
 *  Page-specific by design (CLAUDE.md, "share the plumbing, not the
 *  physics"): nothing else in this sandbox folds a chain, so this is not a
 *  shared module and no other page loads it. It renders nothing and knows
 *  about no viewer — it takes PDB text and gives back positions, so the
 *  numbers can be checked in Node without a canvas.
 *
 *  Coordinates here are real angstroms and stay that way. This file never
 *  sees MolLib.SCALE, the same rule pdb.js follows.
 *
 * ---------------------------------------------------------------------
 *  WHAT THE ANIMATION CLAIMS, AND WHAT IT DOES NOT
 * ---------------------------------------------------------------------
 *  The lesson is that a helix is not a shape somebody drew. It is what you
 *  get when every backbone C=O reaches four residues down the chain and
 *  holds the N-H there. Measured on the deposited 1VII coordinates, 12 of
 *  the 14 backbone hydrogen bonds are exactly i -> i+4, in three runs that
 *  match the file's own HELIX records. The other two are a 3-10 style kink
 *  at a helix end (i+3) and one i+2; they are shown, not hidden, because a
 *  clean rule with two honest exceptions is a better thing to learn than a
 *  rule with the exceptions deleted.
 *
 *  ACT 2 HAS A DIFFERENT CAUSE, AND THAT IS THE POINT. Not one of the 14
 *  hydrogen bonds runs between helices — every single one is internal to a
 *  helix. So hydrogen bonds build the secondary structure and then stop.
 *  What packs the three helices into a bundle is the hydrophobic core:
 *  Phe47, Phe51 and Phe58 turning inward, away from water. Drawing an
 *  H-bond dash across that packing would teach something false, so act 2
 *  draws no dashes at all and shows the three phenylalanines instead.
 *
 *  THE PATH IS NOT REAL, THE ORDER IS. Villin HP35 folds in roughly four
 *  microseconds by thermal thrashing, not by the smooth monotonic collapse
 *  drawn here. What survives the stylisation is the ORDER of events — local
 *  helices first, tertiary packing after — which is the part a student is
 *  meant to carry away. `guide` below is the explicit knob that makes the
 *  collapse monotonic; see its comment for why it exists.
 *
 *  1VII IS AN NMR MINIMISED AVERAGE. It is one representative conformation
 *  computed from a family of models, not a photograph of a molecule. Good
 *  enough to be the target of a fold; not evidence that the protein holds
 *  exactly this shape.
 * ===================================================================== */
'use strict';

const FoldLib = (function () {

  /* Backbone-only display radii, in angstroms. NOT MolLib.PALETTE.radii:
     those are stylised for the SCALE=1.9 display space of the Three.js
     lesson pages, and pasting them in here would draw atoms roughly twice
     the size of the bonds joining them. */
  const RADII = { N: 0.34, C: 0.34, O: 0.32, H: 0.19 };

  /* Ideal backbone internal coordinates for building the EXTENDED start
     state (Engh & Huber). Only the start state uses these; every later
     frame's geometry comes from the deposited file. */
  const IDEAL = {
    N_CA: 1.458, CA_C: 1.525, C_N: 1.329, C_O: 1.231, N_H: 1.010,
    ang_N_CA_C: 111.2, ang_CA_C_N: 116.2, ang_C_N_CA: 121.7,
    ang_CA_C_O: 120.8, ang_C_N_H: 119.0,
    /* Beta region, not phi=psi=180. A fully linear chain is not a
       conformation any real polypeptide occupies, and starting from one
       would make the first thing a student sees the least physical frame
       of the animation. */
    phi: -139, psi: 135, omega: 180,
  };

  const v3 = {
    sub: (a, b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]],
    add: (a, b) => [a[0]+b[0], a[1]+b[1], a[2]+b[2]],
    mul: (a, s) => [a[0]*s, a[1]*s, a[2]*s],
    dot: (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2],
    cross: (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]],
    len: a => Math.hypot(a[0], a[1], a[2]),
    norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0]/l, a[1]/l, a[2]/l]; },
    dist: (a, b) => Math.hypot(a[0]-b[0], a[1]-b[1], a[2]-b[2]),
  };

  /* ---------------- 1. read the deposited structure ---------------- */

  /* parse(pdbText) -> { nodes, bonds, residues }
       nodes     [{ i, res, resName, name, el, native:[x,y,z] }]
       bonds     [[i, j, order]]  covalent, backbone + the shown side chains
       residues  [{ num, name, atoms:{name -> nodeIndex} }]

     Backbone N, CA, C, O and the amide H — everything a hydrogen bond needs
     and nothing that would bury it. The three core phenylalanines keep their
     side chains too: act 2 is about those rings and cannot be drawn without
     them. `sideChains` is a set of residue numbers, so the caller decides
     what counts as the core rather than this file hard-coding villin. */
  function parse(pdbText, opts) {
    const showSide = new Set((opts && opts.sideChains) || []);
    const BACKBONE = ['N', 'CA', 'C', 'O', 'H'];

    const nodes = [], byRes = new Map();
    for (const line of pdbText.split('\n')) {
      if (!line.startsWith('ATOM')) continue;
      const name = line.slice(12, 16).trim();
      const resName = line.slice(17, 20).trim();
      const resNum = parseInt(line.slice(22, 26), 10);
      const el = (line.slice(76, 78).trim() || name[0]).toUpperCase();
      const keep = BACKBONE.includes(name) ||
                   (showSide.has(resNum) && name !== 'HA' && el !== 'H');
      if (!keep) continue;
      const pos = [+line.slice(30, 38), +line.slice(38, 46), +line.slice(46, 54)];
      if (!pos.every(Number.isFinite)) continue;

      const node = { i: nodes.length, res: resNum, resName, name, el, native: pos };
      nodes.push(node);
      if (!byRes.has(resNum)) byRes.set(resNum, { num: resNum, name: resName, atoms: {} });
      byRes.get(resNum).atoms[name] = node.i;
    }

    const residues = [...byRes.values()].sort((a, b) => a.num - b.num);

    /* Covalent bonds. Intra-residue backbone is fixed connectivity; the
       peptide link joins C(i) to N(i+1). Side-chain connectivity is
       inferred by distance, which is safe on a deposited structure and
       avoids a per-residue topology table for the one residue type shown. */
    const bonds = [];
    residues.forEach((r, k) => {
      const a = r.atoms;
      const link = (x, y, order) => {
        if (a[x] != null && a[y] != null) bonds.push([a[x], a[y], order || 1]);
      };
      link('N', 'CA'); link('CA', 'C'); link('C', 'O', 2); link('N', 'H');
      const next = residues[k + 1];
      if (next && a.C != null && next.atoms.N != null) bonds.push([a.C, next.atoms.N, 1]);

      if (showSide.has(r.num)) {
        const side = Object.keys(a).filter(n => !BACKBONE.includes(n));
        const ring = side.concat(a.CA != null ? ['CA'] : []);
        for (let x = 0; x < ring.length; x++)
          for (let y = x + 1; y < ring.length; y++) {
            const d = v3.dist(nodes[a[ring[x]]].native, nodes[a[ring[y]]].native);
            if (d < 1.75) bonds.push([a[ring[x]], a[ring[y]], 1]);
          }
      }
    });

    return { nodes, bonds, residues };
  }

  /* ---------------- 2. read the hydrogen bonds off it ---------------- */

  /* hbonds(parsed) -> [{ o, h, n, from, to, sep, dist, angle }]
     A backbone hydrogen bond is C=O(i) ... H-N(j): the carbonyl oxygen is
     the acceptor, the amide hydrogen the donor. Two geometric tests, both
     standard, and both needed — distance alone accepts atoms that merely
     drift past each other, and an H-bond that is not close to linear is
     not doing the holding.

       H...O  <= 2.6 A     (the classic cutoff is 2.5; 2.6 keeps the two
                            weak helix-end bonds this structure really has)
       N-H...O >= 130 deg

     |i - j| < 2 is excluded: neighbouring residues are close because the
     chain is covalent, not because anything is bonded across. */
  function hbonds(parsed, opts) {
    const maxD = (opts && opts.maxDist) || 2.6;
    const minA = (opts && opts.minAngle) || 130;
    const { nodes, residues } = parsed;
    const at = (r, n) => (r.atoms[n] != null ? nodes[r.atoms[n]] : null);

    const out = [];
    for (const ra of residues) {
      const O = at(ra, 'O'); if (!O) continue;
      for (const rb of residues) {
        if (Math.abs(rb.num - ra.num) < 2) continue;
        const H = at(rb, 'H'), N = at(rb, 'N');
        if (!H || !N) continue;
        const dist = v3.dist(O.native, H.native);
        if (dist > maxD) continue;
        const u = v3.norm(v3.sub(N.native, H.native));
        const w = v3.norm(v3.sub(O.native, H.native));
        const angle = Math.acos(Math.max(-1, Math.min(1, v3.dot(u, w)))) * 180 / Math.PI;
        if (angle < minA) continue;
        out.push({ o: O.i, h: H.i, n: N.i, from: ra.num, to: rb.num,
                   sep: rb.num - ra.num, dist, angle });
      }
    }
    return out.sort((a, b) => a.from - b.from);
  }

  /* ---------------- 3. build the extended start state ---------------- */

  /* Place D given A-B-C plus |CD|, angle BCD and dihedral ABCD (NeRF).
     This is how the extended chain is built: real bond lengths and angles
     throughout, with only the two rotatable dihedrals set to beta values,
     so the start state is a physically possible conformation rather than a
     drawn straight line. */
  function place(A, B, C, len, angDeg, dihDeg) {
    const ang = angDeg * Math.PI / 180, dih = dihDeg * Math.PI / 180;
    const bc = v3.norm(v3.sub(C, B));
    let n = v3.cross(v3.sub(B, A), bc);
    if (v3.len(n) < 1e-6) n = v3.cross(bc, [bc[0] + 1, bc[1], bc[2]]);
    n = v3.norm(n);
    const m = v3.cross(n, bc);
    const d2 = [-len * Math.cos(ang), len * Math.sin(ang) * Math.cos(dih),
                 len * Math.sin(ang) * Math.sin(dih)];
    return [
      C[0] + d2[0]*bc[0] + d2[1]*m[0] + d2[2]*n[0],
      C[1] + d2[0]*bc[1] + d2[1]*m[1] + d2[2]*n[1],
      C[2] + d2[0]*bc[2] + d2[1]*m[2] + d2[2]*n[2],
    ];
  }

  /* extended(parsed) -> [[x,y,z], ...] parallel to parsed.nodes.
     Backbone built by NeRF; a shown side chain is carried along rigidly on
     its residue's N-CA-C frame, since nothing in this lesson asks a side
     chain to change its internal shape. */
  function extended(parsed) {
    const { nodes, residues } = parsed;
    const P = nodes.map(n => n.native.slice());
    const I = IDEAL;

    let prevC = null, prevCA = null, prevO = null, prevN = null;
    residues.forEach((r, k) => {
      const a = r.atoms;
      let N, CA, C;
      if (k === 0) {
        N  = [0, 0, 0];
        CA = [I.N_CA, 0, 0];
        const t = (180 - I.ang_N_CA_C) * Math.PI / 180;
        C  = [CA[0] + I.CA_C * Math.cos(t), I.CA_C * Math.sin(t), 0];
      } else {
        N  = place(prevN, prevCA, prevC, I.C_N,  I.ang_CA_C_N, I.psi);
        CA = place(prevCA, prevC, N,     I.N_CA, I.ang_C_N_CA, I.omega);
        C  = place(prevC, N, CA,         I.CA_C, I.ang_N_CA_C, I.phi);
      }
      if (a.N  != null) P[a.N]  = N;
      if (a.CA != null) P[a.CA] = CA;
      if (a.C  != null) P[a.C]  = C;

      // carbonyl O: in the peptide plane, anti to the next N
      const O = place(N, CA, C, I.C_O, I.ang_CA_C_O, I.psi + 180);
      if (a.O != null) P[a.O] = O;

      // amide H: in the peptide plane, trans to the previous carbonyl O
      if (a.H != null && prevC && prevO)
        P[a.H] = place(prevO, prevC, N, I.N_H, I.ang_C_N_H, 180);

      // side chain: rigid-body onto the new backbone frame
      const side = Object.keys(a).filter(n => !['N','CA','C','O','H'].includes(n));
      if (side.length && a.N != null && a.CA != null && a.C != null) {
        const F0 = frameOf(nodes[a.N].native, nodes[a.CA].native, nodes[a.C].native);
        const F1 = frameOf(N, CA, C);
        side.forEach(nm => {
          const local = toLocal(F0, nodes[a[nm]].native);
          P[a[nm]] = toWorld(F1, local);
        });
      }

      prevN = N; prevCA = CA; prevC = C; prevO = O;
    });

    /* Recentre on the deposited centroid. Where the extended chain sits in
       space is an artefact of having built it outward from an arbitrary
       origin, so this removes a meaningless ~60 A translation rather than
       helping the fold: without it the guide spends its whole budget
       dragging the chain across the scene instead of folding it, and the
       collapse needs an order of magnitude more frames to converge. */
    const c = centroid(P, P.map((_, i) => i));
    return P.map(q => v3.sub(q, c)).map(q => v3.add(q, centroid(
      nodes.map(nd => nd.native), nodes.map((_, i) => i))));
  }

  /* Orthonormal frame on a residue's N-CA-C, used to carry side chains. */
  function frameOf(N, CA, C) {
    const e1 = v3.norm(v3.sub(C, N));
    let e2 = v3.sub(CA, N);
    e2 = v3.norm(v3.sub(e2, v3.mul(e1, v3.dot(e2, e1))));
    return { o: CA, e1, e2, e3: v3.cross(e1, e2) };
  }
  function toLocal(F, p) {
    const d = v3.sub(p, F.o);
    return [v3.dot(d, F.e1), v3.dot(d, F.e2), v3.dot(d, F.e3)];
  }
  function toWorld(F, l) {
    return v3.add(F.o, v3.add(v3.mul(F.e1, l[0]),
                  v3.add(v3.mul(F.e2, l[1]), v3.mul(F.e3, l[2]))));
  }

  /* ---------------- 4. the schedule ---------------- */

  /* SCHEDULE(t) — the whole shape of the animation in one place, t = 0..1
     across the entire fold.

     Deliberately a free function rather than a method on Folder: once the
     trajectory is baked to a file the page never builds a Folder at all, but
     it still needs to know which act it is in to caption the stage. Keeping
     this pure means the page and the solver can never disagree about where
     act 1 ends. */
  function SCHEDULE(t) {
    // act 1 (0 .. .62): hydrogen bonds switch on, helices coil
    // act 2 (.62 .. 1): core collapses, guide firms up and seats it
    const a1 = Math.min(1, t / 0.62);
    const a2 = Math.max(0, (t - 0.62) / 0.38);
    return { a1, a2, act: t < 0.62 ? 1 : 2,
             hbGain: a1, coreGain: a2, guide: 0.04 * a1 + 0.55 * a2 * a2 };
  }

  /* ---------------- 5. the solver ---------------- */

  /* Folder — a small constrained relaxation, not a force field.
   *
   *  Rigid geometry is enforced as CONSTRAINTS rather than stiff springs:
   *  every covalent bond length and every 1-3 distance (which is what fixes
   *  a bond angle) is projected back to its deposited value after each
   *  step. Stiff springs would need a timestep small enough to resolve them
   *  and would buy nothing a student can see.
   *
   *  What is left to be a FORCE is the thing the lesson is about:
   *
   *    hbond   each native C=O...H-N pair pulls toward 1.9 A, switched on
   *            over act 1. This is the visible cause of the helices — the
   *            chain coils because the carbonyls reel the amides in.
   *    core    in act 2, the shown side-chain centroids attract each other.
   *            This stands in for water excluding them, which is the actual
   *            cause; it is a shortcut in mechanism, not in outcome, and
   *            the panel says so rather than letting the spring imply that
   *            phenylalanines attract at a distance.
   *    guide   a weak pull toward the deposited coordinates.
   *
   *  WHY `guide` EXISTS. Hydrogen-bond springs alone find a helix but not
   *  reliably THIS protein's helices, and a lesson that lands somewhere
   *  different each reload cannot be checked or taught from. The guide is
   *  the honesty cost of a repeatable animation: it is weak while the
   *  H-bonds are doing the visible work, and only firms up at the end to
   *  seat the structure. It is exposed as a number so the page can show it
   *  and a reader can see exactly how much help is being given.
   */
  function Folder(parsed, opts) {
    const o = Object.assign({ hbondLen: 1.9, coreLen: 5.2, damping: 0.86,
                              steps: 6, dt: 0.05 }, opts || {});
    const { nodes, bonds } = parsed;
    const n = nodes.length;
    const hb = hbonds(parsed);

    const pos = extended(parsed).map(p => p.slice());
    const vel = nodes.map(() => [0, 0, 0]);

    /* Distance constraints: bonds (1-2) and 1-3 pairs through any shared
       atom. The 1-3 set is what keeps bond angles from folding flat, and
       taking both targets from the deposited structure means the chain can
       never reach a geometry the real molecule does not have. */
    const adj = nodes.map(() => []);
    bonds.forEach(([i, j]) => { adj[i].push(j); adj[j].push(i); });
    const cons = bonds.map(([i, j]) => [i, j, v3.dist(nodes[i].native, nodes[j].native)]);
    const seen = new Set(bonds.map(([i, j]) => Math.min(i,j) + ':' + Math.max(i,j)));
    for (let k = 0; k < n; k++)
      for (const i of adj[k])
        for (const j of adj[k]) {
          if (i >= j) continue;
          const key = i + ':' + j;
          if (seen.has(key)) continue;
          seen.add(key);
          cons.push([i, j, v3.dist(nodes[i].native, nodes[j].native)]);
        }

    /* Side-chain centroids, for the act-2 core term. */
    const sideGroups = [];
    const bySide = new Map();
    nodes.forEach(nd => {
      if (['N','CA','C','O','H'].includes(nd.name)) return;
      if (!bySide.has(nd.res)) bySide.set(nd.res, []);
      bySide.get(nd.res).push(nd.i);
    });
    bySide.forEach(v => sideGroups.push(v));

    /* Which atoms are non-bonded enough to push each other apart. */
    const nb = nodes.map(() => new Set());
    cons.forEach(([i, j]) => { nb[i].add(j); nb[j].add(i); });

    const st = { pos, vel, hb, nodes, bonds, sideGroups,
                 hbGain: 0, coreGain: 0, guide: 0 };

    function schedule(t) {
      const s = SCHEDULE(t);
      st.hbGain = s.hbGain; st.coreGain = s.coreGain; st.guide = s.guide;
      return s;
    }

    /* Fraction of each native H-bond that is currently formed, 0..1 — what
       the page fades a dash in on, and what the counter counts. Formed
       means "at H-bond distance", measured on the live coordinates, so the
       readout can never claim a bond the geometry does not have. */
    function formation() {
      return hb.map(b => {
        const d = v3.dist(pos[b.o], pos[b.h]);
        return Math.max(0, Math.min(1, (3.6 - d) / (3.6 - 2.2)));
      });
    }

    /* The inner loops below are written in flat scalar arithmetic on X/Y/Z
       arrays rather than through the v3 helpers, and that is deliberate.
       The helpers return a fresh array per call; the constraint projection
       alone runs several thousand of them per substep, and the resulting
       allocation churn was the entire cost of a bake. Everything outside
       this function keeps using v3, where clarity is worth more than the
       microseconds. */
    const X = new Float64Array(n), Y = new Float64Array(n), Z = new Float64Array(n);
    const VX = new Float64Array(n), VY = new Float64Array(n), VZ = new Float64Array(n);
    const FX = new Float64Array(n), FY = new Float64Array(n), FZ = new Float64Array(n);
    const NX = new Float64Array(n), NY = new Float64Array(n), NZ = new Float64Array(n);
    nodes.forEach((nd, i) => { NX[i] = nd.native[0]; NY[i] = nd.native[1]; NZ[i] = nd.native[2]; });

    // constraints flattened, so the projection loop touches no objects
    const cI = new Int32Array(cons.length), cJ = new Int32Array(cons.length),
          cL = new Float64Array(cons.length);
    cons.forEach((c, k) => { cI[k] = c[0]; cJ[k] = c[1]; cL[k] = c[2]; });
    const nbFlat = nb.map(s => Int32Array.from(s).sort());
    const hbO = Int32Array.from(hb.map(b => b.o)), hbH = Int32Array.from(hb.map(b => b.h));

    const pull = () => { for (let i = 0; i < n; i++) { X[i] = pos[i][0]; Y[i] = pos[i][1]; Z[i] = pos[i][2];
                                                       VX[i] = vel[i][0]; VY[i] = vel[i][1]; VZ[i] = vel[i][2]; } };
    const push = () => { for (let i = 0; i < n; i++) { pos[i][0] = X[i]; pos[i][1] = Y[i]; pos[i][2] = Z[i];
                                                       vel[i][0] = VX[i]; vel[i][1] = VY[i]; vel[i][2] = VZ[i]; } };
    const cellMap = new Map();

    function step(t) {
      const s = schedule(t);
      pull();
      for (let rep = 0; rep < o.steps; rep++) {
        FX.fill(0); FY.fill(0); FZ.fill(0);

        // the lesson's force: native hydrogen bonds reeling in
        if (st.hbGain > 0) for (let b = 0; b < hbO.length; b++) {
          const i = hbO[b], j = hbH[b];
          const dx = X[j]-X[i], dy = Y[j]-Y[i], dz = Z[j]-Z[i];
          const L = Math.sqrt(dx*dx + dy*dy + dz*dz) || 1e-6;
          const k = 2.4 * st.hbGain * (L - o.hbondLen) / L;
          FX[i] += dx*k; FY[i] += dy*k; FZ[i] += dz*k;
          FX[j] -= dx*k; FY[j] -= dy*k; FZ[j] -= dz*k;
        }

        // act 2: the hydrophobic core draws together
        if (st.coreGain > 0) for (let x = 0; x < sideGroups.length; x++)
          for (let y = x + 1; y < sideGroups.length; y++) {
            const A = sideGroups[x], B = sideGroups[y];
            let ax=0,ay=0,az=0,bx=0,by=0,bz=0;
            for (const i of A) { ax+=X[i]; ay+=Y[i]; az+=Z[i]; }
            for (const i of B) { bx+=X[i]; by+=Y[i]; bz+=Z[i]; }
            ax/=A.length; ay/=A.length; az/=A.length;
            bx/=B.length; by/=B.length; bz/=B.length;
            const dx=bx-ax, dy=by-ay, dz=bz-az;
            const L = Math.sqrt(dx*dx+dy*dy+dz*dz) || 1e-6;
            if (L < o.coreLen) continue;
            const k = 1.1 * st.coreGain * (L - o.coreLen) / L;
            const ka = k/A.length, kb = k/B.length;
            for (const i of A) { FX[i]+=dx*ka; FY[i]+=dy*ka; FZ[i]+=dz*ka; }
            for (const i of B) { FX[i]-=dx*kb; FY[i]-=dy*kb; FZ[i]-=dz*kb; }
          }

        // the guide — see the Folder header for why this is here
        if (st.guide > 0) { const g = st.guide;
          for (let i = 0; i < n; i++) {
            FX[i] += (NX[i]-X[i])*g; FY[i] += (NY[i]-Y[i])*g; FZ[i] += (NZ[i]-Z[i])*g;
          } }

        /* Steric: nothing may pass through anything else. Bucketed into a
           2.7 A cell list rather than tested all-pairs — at 199 atoms the
           n^2 sweep dominated every substep. */
        cellMap.clear();
        for (let i = 0; i < n; i++) {
          const k = (Math.floor(X[i]/2.7)*73856093) ^ (Math.floor(Y[i]/2.7)*19349663) ^ (Math.floor(Z[i]/2.7)*83492791);
          let b = cellMap.get(k); if (!b) cellMap.set(k, b = []);
          b.push(i);
        }
        for (let i = 0; i < n; i++) {
          const bx = Math.floor(X[i]/2.7), by = Math.floor(Y[i]/2.7), bz = Math.floor(Z[i]/2.7);
          const ex = nbFlat[i];
          for (let dx = -1; dx <= 1; dx++)
            for (let dy = -1; dy <= 1; dy++)
              for (let dz = -1; dz <= 1; dz++) {
                const b = cellMap.get(((bx+dx)*73856093) ^ ((by+dy)*19349663) ^ ((bz+dz)*83492791));
                if (!b) continue;
                for (let q = 0; q < b.length; q++) {
                  const j = b[q];
                  if (j <= i) continue;
                  let skip = false;
                  for (let e = 0; e < ex.length; e++) if (ex[e] === j) { skip = true; break; }
                  if (skip) continue;
                  const ux = X[j]-X[i], uy = Y[j]-Y[i], uz = Z[j]-Z[i];
                  const L2 = ux*ux + uy*uy + uz*uz;
                  if (L2 > 7.29 || L2 < 1e-8) continue;      // 2.7 A cutoff
                  const L = Math.sqrt(L2);
                  const k = 1.6 * (2.7 - L) / L;
                  FX[i] -= ux*k; FY[i] -= uy*k; FZ[i] -= uz*k;
                  FX[j] += ux*k; FY[j] += uy*k; FZ[j] += uz*k;
                }
              }
        }

        const dt = o.dt, dmp = o.damping;
        for (let i = 0; i < n; i++) {
          VX[i] = (VX[i] + FX[i]*dt) * dmp; X[i] += VX[i]*dt;
          VY[i] = (VY[i] + FY[i]*dt) * dmp; Y[i] += VY[i]*dt;
          VZ[i] = (VZ[i] + FZ[i]*dt) * dmp; Z[i] += VZ[i]*dt;
        }

        // project geometry back onto the deposited bond lengths and angles
        for (let it = 0; it < 8; it++)
          for (let k = 0; k < cI.length; k++) {
            const i = cI[k], j = cJ[k];
            const dx = X[j]-X[i], dy = Y[j]-Y[i], dz = Z[j]-Z[i];
            const L = Math.sqrt(dx*dx + dy*dy + dz*dz) || 1e-6;
            const c = 0.5 * (L - cL[k]) / L;
            const ox = dx*c, oy = dy*c, oz = dz*c;
            X[i] += ox; Y[i] += oy; Z[i] += oz;
            X[j] -= ox; Y[j] -= oy; Z[j] -= oz;
          }
      }
      push();
      return s;
    }

    /* Jump straight to a t without animating. Replays from the extended
       start, so the same t always gives the same coordinates — but it costs
       a full replay, which is why the page calls it once through `bake`
       rather than on every scrub. */
    function seek(t, frames) {
      const f = frames || 90;
      extended(parsed).forEach((p, i) => { pos[i] = p.slice(); vel[i] = [0,0,0]; });
      for (let k = 1; k <= f; k++) step((k / f) * t);
      return schedule(t);
    }

    /* bake(frames, keep) -> a whole precomputed trajectory.
       The fold is deterministic, so running it once at load and then
       replaying stored coordinates makes playback free and — the part that
       matters for the lesson — makes the scrubber instant, so a student can
       drag back and forth across the moment a helix closes and watch it as
       many times as they like. Every `keep`th frame is stored as a
       Float32Array; the page lerps between them.

       `formed` is stored alongside, one 0..1 per native H-bond per keyframe,
       measured on the live coordinates rather than scheduled — so a dash can
       never fade in on a bond the geometry has not actually made. */
    function bake(frames, keep) {
      const F = frames || 900, K = keep || 5;
      extended(parsed).forEach((p, i) => { pos[i] = p.slice(); vel[i] = [0,0,0]; });
      const key = [], formed = [], ts = [];
      const snap = t => {
        const a = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { a[i*3] = pos[i][0]; a[i*3+1] = pos[i][1]; a[i*3+2] = pos[i][2]; }
        key.push(a); formed.push(Float32Array.from(formation())); ts.push(t);
      };
      snap(0);
      for (let k = 1; k <= F; k++) {
        const t = k / F;
        step(t);
        if (k % K === 0 || k === F) snap(t);
      }
      return { key, formed, ts, count: key.length, atoms: n, hb };
    }

    function rmsd() {
      let s = 0;
      for (let i = 0; i < n; i++) s += v3.dist(pos[i], nodes[i].native) ** 2;
      return Math.sqrt(s / n);
    }

    return Object.assign(st, { step, seek, formation, rmsd, schedule,
                               bake, reset: () => seek(0, 1) });
  }

  /* ---------------- 6. the baked trajectory on disk ---------------- */

  /* The fold is deterministic and nobody tunes it twice, so it is solved
     ONCE by tools/bake-fold.js and committed as a file. The page then loads
     coordinates instead of computing them, which is the difference between
     opening instantly and stalling for a second and a half on every visit,
     for every student, to recompute a number that cannot change.
     tools/check-pdb.js re-bakes and compares, so the committed file can
     never quietly fall out of step with the solver that produced it.

     Layout — magic, then five uint32, then three Float32 blocks:
       'FOLD' | version | frames | atoms | hbonds | (pad)
       ts     Float32[frames]                 t of each keyframe
       key    Float32[frames * atoms * 3]     xyz, atom-major within a frame
       formed Float32[frames * hbonds]        0..1 per H-bond per keyframe

     Float32 rather than quantised integers: it is the same numbers the
     solver produced, so the checker's comparison is exact rather than
     "close enough", and at this size the saving would not be worth a
     precision claim to defend. */
  const MAGIC = 0x444c4f46;                    // 'FOLD' little-endian
  const VERSION = 1;
  const HEADER = 24;                           // bytes, 4-aligned

  function encode(traj) {
    const F = traj.count, A = traj.atoms, H = traj.formed[0].length;
    const buf = new ArrayBuffer(HEADER + 4 * (F + F*A*3 + F*H));
    const dv = new DataView(buf);
    dv.setUint32(0, MAGIC, true); dv.setUint32(4, VERSION, true);
    dv.setUint32(8, F, true); dv.setUint32(12, A, true); dv.setUint32(16, H, true);
    const f32 = new Float32Array(buf, HEADER);
    f32.set(traj.ts, 0);
    for (let k = 0; k < F; k++) f32.set(traj.key[k], F + k*A*3);
    for (let k = 0; k < F; k++) f32.set(traj.formed[k], F + F*A*3 + k*H);
    return buf;
  }

  function decode(buf) {
    const dv = new DataView(buf);
    if (dv.getUint32(0, true) !== MAGIC) throw new Error('not a baked fold file');
    const version = dv.getUint32(4, true);
    if (version !== VERSION) throw new Error(`fold file is version ${version}, expected ${VERSION}`);
    const F = dv.getUint32(8, true), A = dv.getUint32(12, true), H = dv.getUint32(16, true);
    const need = HEADER + 4 * (F + F*A*3 + F*H);
    if (buf.byteLength !== need) throw new Error(`fold file truncated: ${buf.byteLength} of ${need} bytes`);
    const f32 = new Float32Array(buf, HEADER);
    const key = [], formed = [];
    for (let k = 0; k < F; k++) key.push(f32.subarray(F + k*A*3, F + (k+1)*A*3));
    for (let k = 0; k < F; k++) formed.push(f32.subarray(F + F*A*3 + k*H, F + F*A*3 + (k+1)*H));
    return { ts: f32.subarray(0, F), key, formed, count: F, atoms: A };
  }

  const ckey = p => Math.floor(p[0]/2.7) + ',' + Math.floor(p[1]/2.7) + ',' + Math.floor(p[2]/2.7);

  function centroid(pos, idx) {
    const c = [0, 0, 0];
    idx.forEach(i => { c[0] += pos[i][0]; c[1] += pos[i][1]; c[2] += pos[i][2]; });
    return v3.mul(c, 1 / idx.length);
  }

  return { parse, hbonds, extended, Folder, SCHEDULE, encode, decode,
           RADII, IDEAL, BAKE: { frames: 900, keep: 5 },
           _v3: v3, _place: place };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = FoldLib;
