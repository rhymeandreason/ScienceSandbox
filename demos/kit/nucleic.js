/* =============================================================================
 *  kit/nucleic.js — NucleicLib: a nucleic acid chain, drawn as a ladder
 * =============================================================================
 *  The nucleic counterpart of kit/ribbon.js, and the same contract: real
 *  angstroms in, plain BufferGeometry out, THREE passed in, no materials, no
 *  opinion about colour or timing. A page keeps those.
 *
 *  WHAT IT DRAWS THAT NO VIEWER DRAWS, and the whole reason it exists: a base
 *  PAIR is ONE RUNG SPANNING BOTH BACKBONES. 3Dmol and Mol* both hang a
 *  separate stub off each strand, pointing inward and stopping in mid-air —
 *  correct, and it says "bases face inward" while saying nothing at all about
 *  which base is with which. For a structural biologist that is fine, the
 *  sequence is in a side panel. For a reader meeting base pairing for the
 *  first time, the pair IS the lesson, and a ladder whose rungs are joined is
 *  the picture that makes it. viewer-compare.html is where both were looked at.
 *
 *  A RUNG IS BUILT FROM THE RIBBON, NOT FROM THE RESIDUE'S ATOMS. Its end is
 *  a chord of the backbone: centred on a point of the backbone's own spline,
 *  its width axis that spline's tangent. That is what makes the join exact at
 *  every crossing angle, and it is the third construction this module has had.
 *  The two before it both started from the atoms and tried to reach the ribbon
 *  afterwards — extending along the pair axis, which walks sideways PAST the
 *  ribbon because that axis does not point at the phosphate; then bending
 *  through C1' to P, which arrives and reads as kinked wire. Neither is a
 *  tuning problem. A rung anchored anywhere but on the drawn curve has to
 *  chase it, and the chase is what shows.
 *
 *  SO AN UNPAIRED BASE MUST LOOK DIFFERENT, or the claim is worthless. It is
 *  drawn as a STUB — half a rung, going nowhere. That is what makes the rung
 *  mean something: a hairpin loop, a melted end, a bulge and every one of
 *  tRNA's tertiary contacts come out visibly not-a-ladder, because the baker
 *  found no Watson-Crick contact there. The picture under-claims. It never
 *  invents a pair, and `basePairs` in proteins/bake-lib.js is deliberately
 *  strict for the same reason.
 *
 *  THE BASE SLAB IS IN THE BASE'S OWN PLANE. `Bn` rides in the bake because a
 *  slab drawn on any other plane is a rectangle that happens to be in about
 *  the right place: bases STACK, face to face, 3.4 A apart, and the stack is
 *  only legible if every slab in it is parallel to its neighbours. Get the
 *  plane from the backbone instead and the stack fans, which reads as sloppy
 *  geometry rather than as the wrong plane.
 *
 *  THE BACKBONE'S FLAT FACE POINTS OUTWARD, and this is the easy one to get
 *  backwards. The reference direction at each residue is C1'-to-P — the base
 *  pointing in, the backbone hanging out, so it is RADIAL. That radial vector
 *  is the face's NORMAL, which means it is the ribbon's THIN axis: the wide
 *  axis is perpendicular to it, tangent to the helix cylinder, so the ribbon
 *  wraps the outside of the duplex the way a stripe wraps a barber's pole.
 *
 *  Put the width along the radial instead and every number stays right while
 *  the ribbon becomes a FIN standing out edge-on from the helix, showing the
 *  reader its narrow side all the way round. It still twists, it still follows
 *  the phosphates, and it is wrong — the same class of failure as
 *  kit/ribbon.js's binormal corkscrew, and just as invisible from any single
 *  measurement.
 *
 *  A Frenet normal would be wrong for the separate reason that header gives:
 *  it is defined by the curve's own bending, which on a helix rotates once per
 *  turn relative to everything the reader is looking at.
 *
 *  Needs THREE, and a bake from proteins/dna/tools/prep.js (or any bake built
 *  by bake-lib's assembleNA + basePairs).
 *
 *    const parts = NucleicLib.build(THREE, trace, { sub: 8 });
 *    // { strands: [{id, geo}], rungs: {G: geo, C: geo, …}, stubs: {…} }
 *
 *  EVERY RUNG IS SPLIT AT ITS OWN HYDROGEN BONDS AND EACH HALF IS ITS BASE.
 *  Half a rung already IS one base, so colouring by half is colouring by base,
 *  and the sequence becomes readable off the structure with no labels: G-C and
 *  A-T are two colour combinations before they are two pairs of letters. It is
 *  the split-stick convention kit/proteinbox.js uses inside a pocket, for the
 *  same reason — deposited coordinates carry no spec, so the drawing has to do
 *  the work of saying what a thing is.
 *
 *  IT IS ALSO HOW A WOBBLE CAN BE DRAWN HONESTLY. A G-U wobble is a real pair
 *  and belongs on the ladder, but it is not Watson-Crick and a drawing that
 *  made it identical to G-C would erase the distinction that G3-U70 is
 *  entirely about. With colour carrying WHICH bases, the rung can say "paired"
 *  and "G with U" at once, and nothing has to be invented or suppressed. The
 *  split is at the measured bonds, so a wobble's lands off-centre — the 2 A
 *  shift, drawn rather than captioned.
 *
 *  SO PAIRED-VERSUS-UNPAIRED IS CARRIED BY SHAPE ALONE, which is the trade:
 *  colour can only say one thing. The gap down the middle of two facing stubs
 *  is the signal, and it is the more honest one.
 * ============================================================================= */
const NucleicLib = (function () {
  'use strict';

  /* Tuned on 1BNA at a card's framing, which is 40 A across and where every
     one of these is two or three pixels. Judge them there, never zoomed in. */
  const DEFAULTS = {
    sub: 8,           /* spline samples per nucleotide */
    width: 2.2,       /* backbone ribbon, across the flat face */
    thick: 0.7,       /* backbone ribbon, through it */
    rungWidth: 2.0,   /* a rung, across the base plane — kept under the
                         backbone's own `width` so the join does not shoulder
                         out past the ribbon it lands on */
    rungThick: 0.5,   /* a rung, through the plane — bases are FLAT */
    stub: 0.72,       /* an unpaired base, as a fraction of C1'-to-centroid */
    tension: 0.5,
  };

  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1],
                           a[2] * b[0] - a[0] * b[2],
                           a[0] * b[1] - a[1] * b[0]];
  function unit(v) {
    const n = Math.hypot(v[0], v[1], v[2]);
    return n > 1e-9 ? [v[0] / n, v[1] / n, v[2] / n] : [0, 0, 1];
  }
  /* v with everything along `axis` removed, renormalised. */
  function reject(v, axis) { return unit(sub(v, mul(axis, dot(v, axis)))); }

  /* Catmull-Rom through the control points, `n` samples per span. Same curve
     kit/ribbon.js uses, so a mixed page's two polymers are smoothed alike. */
  function spline(pts, n, tension) {
    if (pts.length < 2) return pts.slice();
    const out = [];
    const at = i => pts[Math.max(0, Math.min(pts.length - 1, i))];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
      for (let s = 0; s < n; s++) {
        const t = s / n, t2 = t * t, t3 = t2 * t;
        const a = -tension * t3 + 2 * tension * t2 - tension * t;
        const b = (2 - tension) * t3 + (tension - 3) * t2 + 1;
        const c = (tension - 2) * t3 + (3 - 2 * tension) * t2 + tension * t;
        const d = tension * t3 - tension * t2;
        out.push([a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
                  a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
                  a * p0[2] + b * p1[2] + c * p2[2] + d * p3[2]]);
      }
    }
    out.push(pts[pts.length - 1].slice());
    return out;
  }

  /* ------------------------------------------------------------------ mesh
   *
   *  A tiny accumulator, because all three parts are the same shape of thing:
   *  a rectangular cross-section swept along a path. Flat normals per face —
   *  a ribbon 0.7 A thick has visible edges and they should read as edges.
   */
  function Mesh() { this.pos = []; this.nrm = []; this.idx = []; }

  Mesh.prototype.ring = function (c, u, v, w, t) {
    const a = mul(u, w / 2), b = mul(v, t / 2);
    return [add(add(c, a), b), add(sub(c, a), b),
            sub(sub(c, a), b), sub(add(c, a), b)];
  };

  /* Two rings, four side quads. Winding is consistent so backface culling and
     any later flat-shading agree about which way is out.
   *
   *  `nA`/`nB` are the two rings' four SIDE normals, and passing them is what
   *  makes a swept ribbon smooth. Without them every quad takes one normal off
   *  its own corners, so the backbone is faceted along its length — visible as
   *  flat panels wherever the helix turns, which at eight samples a nucleotide
   *  is everywhere. Smoothing is per SIDE, never across the whole ring: the
   *  cross-section is a rectangle and its four edges are real edges. Average
   *  them away, as computeVertexNormals would, and a 0.7 A ribbon reads as a
   *  soft tube with no width to it. */
  Mesh.prototype.band = function (A, B, nA, nB) {
    for (let k = 0; k < 4; k++) {
      const k2 = (k + 1) % 4;
      this.quad(A[k], A[k2], B[k2], B[k],
                nA && [nA[k], nA[k], nB[k], nB[k]]);
    }
  };

  /* `ns` gives the four vertices their own normals; without it the quad takes
     one flat normal off its corners, which is right for a cap and for a rung. */
  Mesh.prototype.quad = function (p, q, r, s, ns) {
    const flat = ns ? null : unit(cross(sub(q, p), sub(s, p)));
    const base = this.pos.length / 3;
    const vs = [p, q, r, s];
    for (let i = 0; i < 4; i++) {
      const n = ns ? ns[i] : flat;
      this.pos.push(vs[i][0], vs[i][1], vs[i][2]);
      this.nrm.push(n[0], n[1], n[2]);
    }
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };

  Mesh.prototype.cap = function (R, flip) {
    flip ? this.quad(R[3], R[2], R[1], R[0]) : this.quad(R[0], R[1], R[2], R[3]);
  };

  Mesh.prototype.geo = function (THREE) {
    if (!this.idx.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  };

  /* ------------------------------------------------------------- ruled slab
   *
   *  A box between two end rings that the CALLER places and orients. It is
   *  ruled rather than swept: each end has its own centre and its own width
   *  axis, and the sides run straight between them.
   *
   *  THIS IS WHY A RUNG CANNOT MISS THE BACKBONE. Both earlier attempts built
   *  the rung from the residue's own atoms and then tried to make it reach —
   *  first by extending along the pair axis (which walks sideways past the
   *  ribbon, because that axis does not point at the phosphate), then by
   *  bending it through C1' to P (which arrives, and reads as a kinked wire).
   *  A rung's end is now a CHORD OF THE RIBBON: its centre is a point ON the
   *  backbone's own spline and its width axis is that spline's tangent. It is
   *  the ribbon's own cross-section, so it sits exactly across the ribbon at
   *  every crossing angle, and there is nothing left for a mitre to correct.
   */
  function ruled(mesh, A, B, plane, w, t) {
    const axis = unit(sub(B.c, A.c));
    const ring = (E, u) => {
      const n = reject(plane, axis);        /* through the slab: the base plane */
      const uu = reject(u, n);              /* across it: the ribbon's tangent */
      return mesh.ring(E.c, uu, n, w, t);
    };
    /* The two strands are ANTIPARALLEL, so their tangents oppose. Left alone
       that twists the box into a bowtie — the quad's edges cross. */
    const uB = dot(A.u, B.u) < 0 ? mul(B.u, -1) : B.u;
    const RA = ring(A, A.u), RB = ring(B, uB);
    mesh.cap(RA, true); mesh.band(RA, RB); mesh.cap(RB, false);
  }

  /* --------------------------------------------------------------- strand
   *
   *  One chain's backbone. `ref` is a per-nucleotide direction the flat face
   *  should contain — C1'-to-P, resampled along the spline with the path so a
   *  turn does not shear it away from the bases.
   *
   *  Returns the sampled path and per-sample tangent alongside the geometry,
   *  because THE RUNGS ARE BUILT FROM THEM. A rung end has to be a point on
   *  this exact curve — not on the phosphates it was splined through — or it
   *  lands wherever the smoothing happens not to be.
   */
  function strand(THREE, P, ref, o) {
    if (P.length < 2) return null;
    const path = spline(P, o.sub, o.tension);
    const dirs = spline(ref, o.sub, o.tension);
    const tans = path.map((_, i) => unit(sub(path[Math.min(i + 1, path.length - 1)],
                                             path[Math.max(i - 1, 0)])));
    const m = new Mesh();
    let prev = null, prevN = null;
    for (let i = 0; i < path.length; i++) {
      /* Radial is the face NORMAL, so it is the thin axis — see the header.
         Width goes across it, tangent to the helix cylinder. */
      const out = reject(dirs[Math.min(i, dirs.length - 1)], tans[i]);
      const u = unit(cross(tans[i], out));
      const R = m.ring(path[i], u, out, o.width, o.thick);
      /* The four side normals, in the order `band` walks them: ring() lays the
         corners out as +u+v, -u+v, -u-v, +u-v, so side k faces
         [+v, -u, -v, +u]. They are the cross-section's own axes rather than
         anything measured off the triangles, which is what keeps them exact
         through a turn. */
      const N = [out, mul(u, -1), mul(out, -1), u];
      if (!prev) m.cap(R, true); else m.band(prev, R, prevN, N);
      prev = R; prevN = N;
    }
    m.cap(prev, false);
    return { geo: m.geo(THREE), path, tans };
  }

  /* ----------------------------------------------------------------- build
   *
   *  `trace` is a bake: {order, chains:{id:{P, C1, Bc, Bn, nums}}, pairs}.
   *
   *  CHAIN BREAKS ARE HONOURED, on `nums`, for the reason bake-lib states —
   *  a spline across an unmodelled stretch is indistinguishable from data at
   *  ribbon width, and nucleic chains are missing residues more often than
   *  protein ones because a terminus is flexible by construction.
   */
  function build(THREE, trace, opts) {
    const o = Object.assign({}, DEFAULTS, opts || {});
    const strands = [];
    const ids = (opts && opts.chains) || trace.order;

    /* Where each nucleotide's rung meets its ribbon: a point on the spline and
       the spline's tangent there. Filled while the backbones are built, which
       is the only place the sampled curve exists. */
    const anchor = new Map();

    for (const id of ids) {
      const ch = trace.chains[id];
      if (!ch || ch.kind !== 'na') continue;
      for (const seg of runs(ch)) {
        if (seg.P.length < 2) continue;
        /* The face-reference: base to backbone, per nucleotide. */
        const ref = seg.P.map((p, i) => unit(sub(p, seg.C1[i])));
        const S = strand(THREE, seg.P, ref, o);
        if (!S) continue;
        strands.push({ id, geo: S.geo });
        /* spline() emits `sub` samples per span and then the last control
           point, so control point i is sample i*sub exactly. */
        seg.nums.forEach((num, i) => {
          const k = Math.min(i * o.sub, S.path.length - 1);
          anchor.set(id + ':' + num, { c: S.path[k], u: S.tans[k] });
        });
      }
    }

    /* Rungs and stubs are cross-chain, so they are built over the whole trace
       at once. GROUPED BY BASE, one mesh per letter, because that is the unit
       a page gives a colour to and the module still holds no materials. */
    const paired = new Set();
    const rungs = {}, stubs = {};
    const meshFor = (bag, b) => (bag[b] = bag[b] || new Mesh());

    for (const p of (trace.pairs || [])) {
      const A = anchor.get(p.a[0] + ':' + p.a[1]);
      const B = anchor.get(p.b[0] + ':' + p.b[1]);
      if (!A || !B) continue;
      const ra = find(trace, p.a[0], p.a[1]), rb = find(trace, p.b[0], p.b[1]);
      paired.add(p.a[0] + ':' + p.a[1]); paired.add(p.b[0] + ':' + p.b[1]);

      /* One plane for the pair. The two bases are coplanar to a degree or so,
         and their deposited normals may point opposite ways round — averaging
         without the flip cancels them to nearly nothing. */
      const n2 = dot(ra.Bn, rb.Bn) < 0 ? mul(rb.Bn, -1) : rb.Bn;
      const plane = unit(add(ra.Bn, n2));

      /* THE SPLIT IS AT THE PAIR'S OWN HYDROGEN BONDS, which the baker
         measured — not at the middle of the bar. In a Watson-Crick pair those
         land near the middle anyway; in a WOBBLE they do not, because the
         bases are shifted about 2 A out of register, and the off-centre split
         is that shift showing in the drawing rather than being asserted in a
         caption. A bake with no `mid` falls back to the midpoint, which is the
         honest thing to draw when nothing measured the bonds. */
      const cut = p.mid || mid(A.c, B.c);

      /* The two halves share one ring at the cut or they do not meet: same
         centre, and a width axis both sides agree on. `ruled` flips the far
         end's tangent for the antiparallel case, so the flip happens here too
         rather than twice with different answers. */
      const uB = dot(A.u, B.u) < 0 ? mul(B.u, -1) : B.u;
      const M = { c: cut, u: unit(add(A.u, uB)) };

      ruled(meshFor(rungs, p.bases[0]), A, M, plane, o.rungWidth, o.rungThick);
      ruled(meshFor(rungs, p.bases[1]), M, { c: B.c, u: uB }, plane,
            o.rungWidth, o.rungThick);
    }

    for (const id of ids) {
      const ch = trace.chains[id];
      if (!ch || ch.kind !== 'na') continue;
      for (let i = 0; i < ch.nums.length; i++) {
        if (paired.has(id + ':' + ch.nums[i])) continue;
        const A = anchor.get(id + ':' + ch.nums[i]);
        if (!A) continue;
        /* Out to the base and a little past it. The far end keeps the near
           end's width axis, so an unpaired base is visibly the same BAR as
           half a rung — which is what it is. */
        const c1 = ch.C1[i];
        const far = add(c1, mul(sub(ch.Bc[i], c1), 1 + o.stub));
        ruled(meshFor(stubs, ch.seq[i] || 'X'), A, { c: far, u: A.u },
              ch.Bn[i], o.rungWidth, o.rungThick);
      }
    }

    const bake = bag => {
      const out = {};
      for (const b of Object.keys(bag)) {
        const g = bag[b].geo(THREE);
        if (g) out[b] = g;
      }
      return out;
    };
    return { strands, rungs: bake(rungs), stubs: bake(stubs) };
  }

  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];

  function find(trace, id, num) {
    const ch = trace.chains[id];
    if (!ch) return null;
    const i = ch.nums.indexOf(num);
    if (i < 0) return null;
    return { P: ch.P[i], C1: ch.C1[i], Bc: ch.Bc[i], Bn: ch.Bn[i] };
  }

  /* Contiguous runs, on the numbers. Same rule as kit/proteinbox.js's. */
  function runs(ch) {
    const out = [];
    let from = 0;
    for (let i = 1; i <= ch.nums.length; i++) {
      if (i === ch.nums.length || ch.nums[i] !== ch.nums[i - 1] + 1) {
        out.push({ P: ch.P.slice(from, i), C1: ch.C1.slice(from, i),
                   Bc: ch.Bc.slice(from, i), Bn: ch.Bn.slice(from, i),
                   nums: ch.nums.slice(from, i) });
        from = i;
      }
    }
    return out;
  }

  /* Cost of a setting without building it: a strand is 4 quads per sample
     plus 2 caps, and every base — half a rung, or a whole stub — is 6 faces. */
  function triangles(trace, opts) {
    const o = Object.assign({}, DEFAULTS, opts || {});
    let n = 0, nres = 0;
    for (const id of trace.order) {
      const ch = trace.chains[id];
      if (!ch || ch.kind !== 'na') continue;
      nres += ch.nums.length;
      for (const seg of runs(ch)) n += (seg.P.length - 1) * o.sub * 8 + 4;
    }
    return n + nres * 12;
  }

  return { build, triangles, strand, ruled, spline, runs, DEFAULTS };
})();

/* Published as a top-level `const`, the same way kit/ribbon.js is — which is
   script scope and never a property of window, so a consumer reads it by its
   BARE name and loads this file after nothing in particular. The export is
   what lets kit/check-nucleic.js run it under node. */
if (typeof module !== 'undefined' && module.exports) module.exports = NucleicLib;
