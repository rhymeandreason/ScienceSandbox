#!/usr/bin/env node
/* =============================================================================
 *  kit/check-nucleic.js — the nucleic ladder's claims, asserted on ideal B-DNA
 * =============================================================================
 *    node kit/check-nucleic.js
 *
 *  Offline, no dependencies, no THREE — it stubs the three THREE calls
 *  kit/nucleic.js makes, the way kit/check-ribbon.js does, because what is
 *  being checked is the arithmetic and not the renderer.
 *
 *  EVERY CLAIM HERE IS A BUG THAT SHIPPED LOOKING MERELY UGLY, which is why it
 *  is gated on the module rather than on any page that draws one:
 *
 *  · THE FLAT FACE POINTS OUTWARD. Put the ribbon's width along the radial
 *    instead of across it and the backbone becomes a fin standing edge-on from
 *    the helix. It still twists, still follows the phosphates, still measures
 *    correctly on every other axis — and shows the reader its narrow side all
 *    the way round. This one shipped. It is the corkscrew failure in
 *    kit/ribbon.js's header wearing different clothes.
 *  · A RUNG SPANS BOTH BACKBONES. The whole argument for the module: a rung
 *    that stops short reads as two detached bars, which is the drawing we
 *    already have from every viewer.
 *  · A RUNG DOES NOT OVERSHOOT, twice over. The per-end extension is measured
 *    rather than constant, because a constant is right in the middle of a
 *    duplex and spears out past the last turn at both ends. And it stops short
 *    of the phosphate rather than at it, because the ribbon is a spline
 *    THROUGH the phosphates and therefore sits inside them on every turn.
 *  · AN UNPAIRED POSITION LEAVES A GAP. Two stubs facing each other span
 *    nearly what a rung does; the difference a reader sees is the void down
 *    the middle, and that void is the whole difference between "partners" and
 *    "opposite each other". Assert the gap, not the length.
 *  · EVERY HALF IS FILED UNDER ITS OWN BASE, and the split between them is at
 *    the pair's measured hydrogen bonds. A page colours by those keys, so a
 *    half in the wrong bag draws a rung that lies about which base it is; and
 *    a split at the geometric middle instead of the bonds looks identical on
 *    Watson-Crick and erases a wobble's 2 A shift, which is the one thing the
 *    wobble is worth drawing for.
 *  · A RUNG IS ANCHORED ON THE RIBBON. Its end is centred on the backbone's
 *    own spline with its width along that spline's tangent — the ribbon's
 *    cross-section. Build it from the residue's atoms instead and it is short
 *    of the ribbon, past it, or across it at the wrong angle; all three
 *    shipped, and none of them is a tuning problem.
 *  · THE BASE SLABS ARE PARALLEL. Bases stack face to face; a stack whose
 *    slabs fan is the wrong plane, and reads as sloppy geometry rather than as
 *    a mistake.
 *
 *  IDEAL B-DNA, GENERATED HERE rather than read from a bake: 10.5 bp per turn,
 *  3.4 A rise, phosphates at 9.4 A radius and C1' at 5.8 A, the minor-groove
 *  offset dropped. A deposited structure would test the reader as well as the
 *  arithmetic, and when both are in one assertion neither gets diagnosed.
 * ============================================================================= */
'use strict';

/* The three calls nucleic.js makes of THREE, and nothing else. */
const THREE = {
  BufferGeometry: function () {
    this.attributes = {};
    this.setAttribute = (k, v) => { this.attributes[k] = v; };
    this.setIndex = i => { this.index = i; };
    this.computeBoundingSphere = () => {};
  },
  Float32BufferAttribute: function (a, n) { this.array = a; this.itemSize = n; },
};

const NucleicLib = require(require('path').join(__dirname, 'nucleic.js'));

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = v => Math.hypot(v[0], v[1], v[2]);
const unit = v => { const n = len(v) || 1; return [v[0] / n, v[1] / n, v[2] / n]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2],
                         a[0] * b[1] - a[1] * b[0]];
/* v with everything along `ax` removed — the module's own `reject`, rebuilt
   here rather than imported, so a checker never passes because the thing it is
   checking and the thing it checks with share a bug. */
const rejectV = (v, ax) => unit(sub(v, [ax[0] * dot(v, ax), ax[1] * dot(v, ax),
                                        ax[2] * dot(v, ax)]));

/* ---------------------------------------------------------------- ideal B-DNA
 *
 *  Helix axis on X, so the structure lies across the page the way the baker's
 *  convention puts a real one. Strand B is antiparallel and offset half a turn.
 */
const N = 12, RISE = 3.4, TWIST = 2 * Math.PI / 10.5, RP = 9.4, RC = 5.8;

function strandAt(i, phase, dir) {
  const a = phase + dir * i * TWIST, x = i * RISE;
  return {
    P:  [x, RP * Math.cos(a), RP * Math.sin(a)],
    C1: [x, RC * Math.cos(a), RC * Math.sin(a)],
    Bc: [x, 1.2 * Math.cos(a), 1.2 * Math.sin(a)],
    /* A base plane is perpendicular to the helix axis: its normal IS the axis. */
    Bn: [1, 0, 0],
  };
}

function chain(phase, dir, first) {
  const res = [];
  for (let i = 0; i < N; i++) res.push(strandAt(i, phase, dir));
  return {
    kind: 'na', first, nums: res.map((_, i) => first + i),
    seq: 'C'.repeat(N), ring: 'Y'.repeat(N),
    P: res.map(r => r.P), C1: res.map(r => r.C1),
    Bc: res.map(r => r.Bc), Bn: res.map(r => r.Bn),
  };
}

/* B runs the other way round the cylinder and is numbered back down, so pair
   i of A meets the residue opposite it — the A(i)/B(2N+1-i) rule 1BNA has. */
const A = chain(0, 1, 1);
const B = { ...chain(Math.PI, 1, 13) };
const mid2 = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
const TRACE = {
  order: ['A', 'B'], chains: { A, B },
  pairs: A.nums.map((n, i) => ({
    a: ['A', n], b: ['B', B.nums[i]], bases: 'CG', kind: 'wc',
    mid: mid2(A.C1[i], B.C1[i]),
  })),
};

/* Every rung half in one list, for the assertions that do not care which base
   a face belongs to. `build` returns them grouped because that is the unit a
   page colours. */
const allFaces = bag => Object.values(bag).flatMap(faces);
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const allVerts = bag => {
  const out = [];
  for (const g of Object.values(bag)) {
    const a = g.attributes.position.array;
    for (let i = 0; i < a.length; i += 3) out.push([a[i], a[i + 1], a[i + 2]]);
  }
  return out;
};

let bad = 0;
const ok = (pass, msg, detail) => {
  console.log('  ' + (pass ? 'ok   ' : 'FAIL ') + msg + (detail ? '   ' + detail : ''));
  if (!pass) bad++;
};

/* ------------------------------------------------------ the flat face outward
 *
 *  Read off the geometry rather than off the internals: every quad's normal is
 *  in the buffer, so the widest faces are found by area and asked which way
 *  they point. A fin's widest faces point ALONG the radial; a wrapped ribbon's
 *  point across it.
 */
function faces(geo) {
  const p = geo.attributes.position.array, n = geo.attributes.normal.array;
  const out = [];
  for (let v = 0; v + 11 < p.length; v += 12) {
    const q = k => [p[v + k * 3], p[v + k * 3 + 1], p[v + k * 3 + 2]];
    const a = q(0), b = q(1), c = q(2);
    out.push({ area: len(cross(sub(b, a), sub(c, a))),
               n: [n[v], n[v + 1], n[v + 2]],
               c: [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2] });
  }
  return out;
}

console.log('\nthe backbone ribbon');
{
  const parts = NucleicLib.build(THREE, TRACE, { sub: 6 });
  ok(parts.strands.length === 2, 'both strands built',
     parts.strands.length + ' of 2');

  const F = faces(parts.strands[0].geo).sort((x, y) => y.area - x.area);
  const wide = F.slice(0, Math.floor(F.length / 3));   /* the broad faces only */

  /* Radial at a face is its own centre with the axis component removed — the
     axis is X here, so radial is the YZ part. */
  let along = 0;
  for (const f of wide) {
    const radial = unit([0, f.c[1], f.c[2]]);
    along += Math.abs(dot(unit(f.n), radial));
  }
  const mean = along / wide.length;
  ok(mean > 0.8, 'the wide faces point RADIALLY (flat side out, not a fin)',
     '|n . radial| = ' + mean.toFixed(3) + ', wants > 0.8');

  /* And the narrow faces are the radial extent: thin through the cylinder. */
  const narrow = F.slice(-Math.floor(F.length / 3));
  let acrossN = 0;
  for (const f of narrow) {
    const radial = unit([0, f.c[1], f.c[2]]);
    acrossN += Math.abs(dot(unit(f.n), radial));
  }
  ok(acrossN / narrow.length < 0.4, 'the narrow faces point ACROSS the radial',
     '|n . radial| = ' + (acrossN / narrow.length).toFixed(3) + ', wants < 0.4');
}

/* ------------------------------------------------------------------- the rung */
console.log('\nthe rung');
{
  const o = NucleicLib.DEFAULTS;
  const parts = NucleicLib.build(THREE, TRACE, { sub: 6 });
  const F = allFaces(parts.rungs);
  /* TWO ruled boxes per pair now — one per base — 6 faces each. */
  ok(F.length === TRACE.pairs.length * 12, 'two halves per pair, one per base',
     (F.length / 12) + ' of ' + TRACE.pairs.length);

  /* AND EACH HALF IS FILED UNDER ITS OWN BASE. The whole point of the split:
     a page colours by these keys, so a half in the wrong bag is a rung that
     lies about which base it is. */
  const want = {};
  for (const p of TRACE.pairs) for (const b of p.bases) want[b] = (want[b] || 0) + 1;
  const got = {};
  for (const [b, g] of Object.entries(parts.rungs))
    got[b] = g.attributes.position.array.length / 12 / 6;
  ok(JSON.stringify(want) === JSON.stringify(got),
     'and each half is filed under its own base',
     JSON.stringify(got) + ' vs ' + JSON.stringify(want));

  const d = unit(sub(B.C1[0], A.C1[0]));
  const proj = F.filter(f => Math.abs(f.c[0]) < 1e-6).map(f => dot(f.c, d));
  const span = Math.max(...proj) - Math.min(...proj);
  const c1c1 = len(sub(B.C1[0], A.C1[0]));
  ok(span > c1c1 + 1, 'a rung reaches PAST both C1\' toward the backbones',
     span.toFixed(2) + ' A vs C1\'-C1\' ' + c1c1.toFixed(2) + ' A');

  /* THE ASSERTION THAT MATTERS, and the one whose absence let a rung ship
     ending in mid-air: the end must ARRIVE AT the backbone. Every end was 2 to
     3.6 A short of it — placed level with P along the pair axis, which walks
     sideways past the ribbon rather than into it, because that axis does not
     point at the phosphate. Measured as the cap's own centroid against the
     ribbon's centreline, so it cannot be satisfied by a longer straight bar. */
  const half = Math.hypot(o.rungWidth / 2, o.thick / 2);
  const verts = allVerts(parts.rungs);
  const near = P => {
    let best = Infinity;
    for (const v of verts) best = Math.min(best, len(sub(v, P)));
    return best;
  };
  let worst = 0;
  for (const p of TRACE.pairs) {
    for (const [id, num] of [p.a, p.b]) {
      const ch = TRACE.chains[id];
      worst = Math.max(worst, near(ch.P[ch.nums.indexOf(num)]));
    }
  }
  ok(worst < half + 0.3, 'and ARRIVES at the backbone, not short of it',
     'furthest end is ' + worst.toFixed(2) + ' A from its phosphate, wants < '
     + (half + 0.3).toFixed(2));
}

/* --------------------------------------------------------- rung against stub */
console.log('\nan unpaired base');
{
  /* The same structure with one pair withheld: the two nucleotides it named
     must come back as stubs, and a stub must be visibly the shorter thing. */
  const cut = { ...TRACE, pairs: TRACE.pairs.slice(1) };
  const parts = NucleicLib.build(THREE, cut, { sub: 6 });
  ok(!!parts.stubs, 'a withheld pair produces stubs at all');
  const S = allFaces(parts.stubs);
  ok(S.length === 2 * 6, 'two stubs, one per orphaned nucleotide',
     (S.length / 6) + ' of 2');

  /* THE CLAIM IS THE GAP, not the length. Two stubs facing each other across
     an unpaired position must not meet — that void down the middle is the
     entire difference between "these two are partners" and "these two happen
     to be opposite each other", and it is what a reader sees. Measuring the
     two stubs as one span misses it: they span nearly what a rung does, with
     nothing in the middle. */
  const d = unit(sub(B.C1[0], A.C1[0]));
  const mid = dot(A.C1[0], d) + len(sub(B.C1[0], A.C1[0])) / 2;
  const here = F => F.filter(f => Math.abs(f.c[0]) < 1e-6).map(f => dot(f.c, d));

  const sp = here(S);
  const left = Math.max(...sp.filter(v => v < mid));
  const right = Math.min(...sp.filter(v => v > mid));
  ok(right - left > 2, 'two stubs leave a GAP where a rung would be continuous',
     (right - left).toFixed(2) + ' A of nothing, wants > 2');

  /* And the rung one position along, which IS paired, crosses its own middle. */
  const rf = allFaces(parts.rungs).filter(f => Math.abs(f.c[0] - RISE) < 1e-6)
    .map(f => dot(f.c, d));
  ok(Math.min(...rf) < mid && Math.max(...rf) > mid,
     'a rung spans its middle', 'crosses ' + mid.toFixed(2));
}

/* ----------------------------------------------------------- the rung's anchor
 *
 *  ON IDEAL B-DNA THIS TEST IS VACUOUS, which is why it builds its own case.
 *  There the C1'-C1' chord runs straight through the helix axis, so a rung
 *  built from the residue's atoms and one built from the ribbon land in nearly
 *  the same place and the difference between them cannot be seen. Real DNA is
 *  not like that, and neither is anything bent.
 *
 *  THE CLAIM: a rung's end is centred ON the backbone's own curve, with its
 *  width along that curve's tangent. It is the ribbon's cross-section, so it
 *  cannot be short of the ribbon, past it, or across it at the wrong angle —
 *  the three ways this shipped wrong before the construction changed.
 */
console.log('\nthe rung\'s anchor');
{
  const TILT = 35 * Math.PI / 180;
  const o = NucleicLib.DEFAULTS;

  /* THREE residues per strand: the middle one is the pair under test, and a
     Catmull-Rom passes exactly through its control point, so the anchor there
     is P itself and the assertion has an exact expected value. */
  const L = 5.8, OUT = 4.2, STEP = 3.4, SPLAY = 2.4;
  function strandOf(sign, first) {
    const P = [], C1 = [], Bc = [], Bn = [], nums = [];
    for (let i = 0; i < 3; i++) {
      const z = (i - 1) * STEP;
      const outAt = OUT + (i - 1) * SPLAY;
      C1.push([sign * L, 0, z]);
      P.push([sign * (L + outAt * Math.cos(TILT)), sign * outAt * Math.sin(TILT), z]);
      Bc.push([0, 0, z]); Bn.push([0, 0, 1]); nums.push(first + i);
    }
    return { kind: 'na', first, nums, seq: 'CCC', ring: 'YYY', P, C1, Bc, Bn };
  }
  const T = {
    order: ['A', 'B'],
    chains: { A: strandOf(-1, 1), B: strandOf(1, 11) },
    pairs: [{ a: ['A', 2], b: ['B', 12], bases: 'CG', kind: 'wc' }],
  };

  const parts = NucleicLib.build(THREE, T, {});
  const verts = allVerts(parts.rungs);
  /* DEDUPED FIRST. Every corner is pushed once per face it belongs to — a cap
     and two sides — so an undeduped "four smallest x" is the same corner three
     times over, and the centroid it yields is off by half the rung's width. */
  const seen = new Map();
  for (const v of verts) seen.set(v.map(x => x.toFixed(4)).join(','), v);
  const capA = [...seen.values()].sort((a, b) => a[0] - b[0]).slice(0, 4);
  const mid = capA.reduce((s, v) => [s[0] + v[0] / 4, s[1] + v[1] / 4, s[2] + v[2] / 4],
                          [0, 0, 0]);

  const Pmid = T.chains.A.P[1];
  ok(len(sub(mid, Pmid)) < 0.02,
     'the end is centred ON the backbone curve, not on the residue\'s atoms',
     len(sub(mid, Pmid)).toFixed(4) + ' A off it, wants < 0.02');

  /* And its width lies along that curve, not across it: the cap should measure
     rungWidth along the ribbon's tangent and rungThick along the base plane. */
  const tan = unit(sub(T.chains.A.P[2], T.chains.A.P[0]));
  const spread = d => {
    const v = capA.map(x => dot(sub(x, mid), d));
    return Math.max(...v) - Math.min(...v);
  };
  /* Measured along the tangent WITH THE BASE NORMAL REJECTED OUT, which is
     the axis `ruled` actually builds on: a rung's width has to stay in the
     base plane, or the slab tilts out of the stack to chase the backbone.
     Measuring along the raw tangent reads short by that tilt and looks like a
     width bug. */
  const axis = unit(sub(T.chains.B.P[1], T.chains.A.P[1]));
  const nrm = rejectV([0, 0, 1], axis);
  const wide = rejectV(tan, nrm);
  ok(Math.abs(spread(wide) - o.rungWidth) < 0.05,
     'and its width lies along the ribbon\'s tangent, in the base plane',
     spread(wide).toFixed(2) + ' A vs rungWidth ' + o.rungWidth);
  ok(Math.abs(spread([0, 0, 1]) - o.rungThick) < 0.05,
     'while its thickness is the base plane\'s',
     spread([0, 0, 1]).toFixed(2) + ' A vs rungThick ' + o.rungThick);

  /* The case has to be oblique, or none of the three proved anything. */
  ok(Math.abs(dot([1, 0, 0], tan)) > 0.1, 'and the test case was genuinely oblique',
     'pair axis . ribbon tangent = ' + Math.abs(dot([1, 0, 0], tan)).toFixed(3)
     + ', wants > 0.1');
}

/* ------------------------------------------------------------------ the split
 *
 *  THE SPLIT IS AT THE PAIR'S MEASURED HYDROGEN BONDS, not at the middle of
 *  the bar. In Watson-Crick geometry the two land in nearly the same place, so
 *  a split that silently ignored `mid` would pass every test above and every
 *  look at 1BNA. It is a WOBBLE that tells them apart: the bases sit about
 *  2 A out of register, so the bonds are off-centre, and drawing the split
 *  there is what lets the picture say "shifted" without a caption.
 *
 *  Asserted by pushing `mid` well off centre and requiring the two halves to
 *  follow it — one base's geometry must end where the other's begins, at the
 *  offset, or the halves either overlap or leave a gap at the join.
 */
console.log('\nthe split');
{
  const SHIFT = 2.0;
  const d = unit(sub(B.C1[0], A.C1[0]));
  const off = TRACE.pairs.map(p => Object.assign({}, p, {
    mid: add3(mid2(A.C1[0], B.C1[0]), [d[0] * SHIFT, d[1] * SHIFT, d[2] * SHIFT]),
  }));
  /* One pair only, so the two bags hold one half each and cannot be confused
     with a neighbour's. */
  const T = { order: ['A', 'B'], chains: { A, B }, pairs: [off[0]] };
  const parts = NucleicLib.build(THREE, T, {});

  /* THE JOINT RING IS TILTED, because its width axis follows the ribbon's
     tangent and that tangent is not square to the pair axis. So the halves'
     extremes along that axis are NOT the split — they sit half a thickness
     either side of it, and measuring them reads as a 0.25 A gap that is not
     there. What is actually claimed is that both halves share ONE ring: same
     four corners, centred on the measured bonds. */
  const nearest = bag => {
    const seen = new Map();
    for (const v of allVerts(bag)) seen.set(v.map(x => x.toFixed(4)).join(','), v);
    return [...seen.values()]
      .sort((x, y) => len(sub(x, off[0].mid)) - len(sub(y, off[0].mid))).slice(0, 4);
  };
  const centroid = R => R.reduce(
    (s, v) => [s[0] + v[0] / 4, s[1] + v[1] / 4, s[2] + v[2] / 4], [0, 0, 0]);

  const ringA = nearest({ C: parts.rungs.C }), ringB = nearest({ G: parts.rungs.G });
  ok(len(sub(centroid(ringA), off[0].mid)) < 0.02,
     'the first base ends at the measured bonds',
     len(sub(centroid(ringA), off[0].mid)).toFixed(4) + ' A off the split');
  ok(len(sub(centroid(ringB), off[0].mid)) < 0.02,
     'and the second begins there — one shared ring, no gap and no overlap',
     len(sub(centroid(ringB), off[0].mid)).toFixed(4) + ' A off the split');

  /* And it really was off centre, or this proved only that halves meet. */
  ok(len(sub(off[0].mid, mid2(A.C1[0], B.C1[0]))) > 1,
     'and the split was genuinely off centre',
     len(sub(off[0].mid, mid2(A.C1[0], B.C1[0]))).toFixed(2)
     + ' A from the middle, wants > 1');
}

/* --------------------------------------------------------------- the stacking */
console.log('\nthe base stack');
{
  const parts = NucleicLib.build(THREE, TRACE, { sub: 6 });
  const F = allFaces(parts.rungs).sort((a, b) => b.area - a.area);
  const wide = F.slice(0, TRACE.pairs.length * 4);
  /* Every broad rung face is a base plane, and every base plane here is
     perpendicular to the helix axis. They must all agree. */
  let worst = 1;
  for (const f of wide) worst = Math.min(worst, Math.abs(unit(f.n)[0]));
  ok(worst > 0.95, 'every rung slab lies in the base plane (the stack is flat)',
     'worst |n . axis| = ' + worst.toFixed(3) + ', wants > 0.95');
}

console.log('\n' + (bad
  ? 'FAIL: ' + bad + ' assertion(s)'
  : 'PASS: the backbone shows its flat side outward, rungs span both strands '
    + 'anchored on the ribbon itself, each half filed and split at its own '
    + 'bonds, an unpaired position reads as a gap, and the slabs stack parallel') + '\n');
process.exit(bad ? 1 : 0);
