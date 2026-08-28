/* =====================================================================
 *  ribbon.js — secondary structure as geometry, from a Ca trace alone.
 *
 *  SHARED, and documented alongside tube.js and surface.js in
 *  docs/rendering-modules.md — hemoglobin-lab draws through it, as do
 *  folding-lab-ribbon and the test benches under hemoglobin/ and sickle/.
 *  Its abstract counterpart is kit/tube.js: one tube per chain,
 *  cheap enough for a tetramer or a crowd, where this one is the dense
 *  literal cartoon. Real angstroms, never sees SCALE, and it builds a
 *  BufferGeometry rather than a mesh so the page keeps ownership of
 *  materials, opacity and the fade machinery.
 *
 * ---------------------------------------------------------------------
 *  WHY THIS EXISTS RATHER THAN A LIBRARY
 * ---------------------------------------------------------------------
 *  Every viewer that draws cartoons — Mol*, 3Dmol, NGL, ChemDoodle —
 *  brings its own WebGL context and camera and cannot draw into
 *  scene.js's scene (docs/rendering-modules.md, "two viewers means two
 *  canvases"). Using one here would mean a second canvas stacked on the
 *  first, and a lesson's atoms/ribbon crossfade, its hover raycast and
 *  its shared camera through the zoom ladder all live in the first one.
 *  A ribbon is not worth losing those.
 *
 * ---------------------------------------------------------------------
 *  ORIENTING A RIBBON WITHOUT C=O
 * ---------------------------------------------------------------------
 *  A cartoon's twist normally comes from the peptide plane — the C=O
 *  vector says which way the ribbon faces. Much of what we draw does not
 *  carry it: villin.js's HP35 trace, actin.bin and the baked folding
 *  trajectories are all Ca-only. So the frame must work from Ca alone
 *  even where a full backbone happens to be available.
 *
 *  The Ca-only substitute is standard and works because it measures the
 *  same thing indirectly. For residue i take the BISECTOR
 *
 *      b_i = normalize( (Ca[i-1] - Ca[i]) + (Ca[i+1] - Ca[i]) )
 *
 *  which points from the residue toward the midpoint of its neighbours —
 *  i.e. along the local radius of curvature, straight at a helix's axis.
 *  That is the direction a helical ribbon's flat face must look along, so
 *  the band lies on the helix's cylinder. It degenerates only where three
 *  consecutive Ca are collinear, which is why nearly-straight runs fall
 *  back to the previous frame.
 *
 *  A PLUS, NOT A CROSS, and this file shipped with the cross once. It is
 *  an easy substitution to make and to justify to yourself — both are
 *  built from the same two vectors and both are perpendicular to the
 *  tangent — but a cross product of two vectors lying in the osculating
 *  plane is the BINORMAL, perpendicular to that plane, not the radius
 *  inside it. On an ideal alpha helix the binormal is tilted ~56 degrees
 *  off the axis and has no radial component at all, so the ribbon came out
 *  rotated a quarter turn about its own path: the flat face pointed along
 *  the helix axis and the band wound edge-first, reading as a corkscrew
 *  ramp or a stack of fins rather than a ribbon wrapped on a cylinder.
 *
 *  It is worth knowing what this failure looks like, because it does not
 *  look like a bug. The width, the thickness, the smoothing and the twist
 *  continuity were all independently correct and the result still looked
 *  wrong, which sends you tuning numbers. The test is one line and is in
 *  folding/tools/check-folding.js: on an ideal helix the face normal must
 *  be radial and the width axis must lie along the helix axis.
 *
 *  THE SIGN IS THE WHOLE PROBLEM. b_i flips by 180 degrees between
 *  neighbours wherever the chain inflects, and an unflipped ribbon
 *  pinches to zero width and turns inside out at every such residue. So
 *  each frame is made continuous with the one before it. Do not "simplify"
 *  that away — it looks fine on a helix and shreds every loop.
 *
 *  Frenet frames (THREE.TubeGeometry's default) are the other obvious
 *  route and are worse: they spin about the tangent through straight runs
 *  and have no relationship to the helix axis at all.
 *
 * ---------------------------------------------------------------------
 *  WHAT IT IS NOT
 * ---------------------------------------------------------------------
 *  Not a DSSP. `assign()` takes residue ranges that the CALLER got from
 *  somewhere authoritative — for HP35 that is 1VII's own HELIX records.
 *  `detect()` exists for traces with no records at all, and is a
 *  geometric heuristic that should be checked against records wherever
 *  records exist. A helix this invents is a claim about the structure.
 * ===================================================================== */

const RibbonLib = (() => {
  'use strict';

  /* Half-width and half-thickness, in angstroms, per secondary structure.

     THESE ARE SCHEMATIC, NOT MEASUREMENTS, and what makes a cartoon readable
     is not any one of them but the RATIO BETWEEN THEM. The version before
     this one had H at [1.10, 0.22] against a coil the page set to TUBE_R
     (1.115 A) — a helix band 2.20 A across running into a loop 2.23 A
     across. Every dimension was defensible on its own and the result was a
     tube with corners, because nothing about it ever changed width.

     3Dmol's cartoon (`helixSheetWidth` 1.3 vs `coilWidth` 0.3) and Mol*'s
     both work the same way: one continuous flat band that is four to five
     times wider through secondary structure than through the loops between.
     The width CHANGE is the signal. Match those proportions here.

     The 6:1 width-to-thickness ratio is what makes the band read as flat
     when a turn brings it edge-on; the coil keeps the same thickness rather
     than becoming square, so the loops are the same ribbon narrowed and not
     a different object spliced in.

     If these are ever retuned, tune them against how many helical turns you
     can COUNT, which is the thing the ribbon is drawn for. */
  const PROFILE = {
    H: [1.30, 0.22],     // alpha helix — a flat band, 2.6 A x 0.44 A
    E: [1.60, 0.22],     // beta strand — wider than a helix, same thinness
    /* Coil is a ROUND TUBE of this radius, so the second number is unused
       and kept only so every entry has the same shape. A loop has no
       orientation worth showing — a flat band there claims something the
       structure does not say, and disappears to a line seen edge-on. */
    C: [0.32, 0.32],     // coil — a cord, radius only
  };

  /* The arrowhead on a beta strand's last residue, as half-widths.

     WITHOUT THIS A STRAND IS NOT READABLE, and the first version shipped
     without it on the reasoning that E is already wider than H. It is — by
     1.23x, which on screen is nothing. A strand read as "a straight piece of
     ribbon that might be slightly wider", indistinguishable at a glance from
     a helix seen end-on, and a sheet read as a pile of loose bands.

     The arrow is most of the signal, and it carries information the width
     cannot: DIRECTION. Which way a strand runs is what makes a sheet
     parallel or antiparallel, and that is the one thing a student is
     supposed to be able to see in a beta sheet.

     `head` is the barb, `tip` the point. The barb is a genuine
     DISCONTINUITY — the band steps from body width to head width between
     two samples, with no ramp. Easing it produces a lozenge rather than an
     arrow, which is why the width interpolation below is deliberately
     bypassed for the residue before the head.

     TIP IS ZERO, AND IT HAS TO BE. It was 0.30 first, on the reasoning that
     a zero-width ring is degenerate geometry. It is — the last ring
     collapses and its cap has no area — but a degenerate triangle simply
     does not rasterise, which costs nothing and is exactly what a point is.
     What 0.30 bought instead was a 0.6 A stub across the end of a 4.9 A
     barb: an arrow with its tip snipped off, which reads as a blunt flag
     rather than something pointing.

     Note the point is a knife EDGE, not a vertex: width goes to zero but
     the 0.44 A thickness stays, so the head is a flat triangle seen from
     above and a wedge from the side. That is what every viewer draws and
     what makes the arrow still read when the sheet is edge-on.

     `length` IS IN ANGSTROMS, MEASURED ALONG THE CURVE — not in residues,
     which is what it was first. A residue is not a fixed distance along the
     drawn path: the spline stretches where the chain turns, and a strand's
     last residues are exactly where it starts bending into a loop. So a
     "two-residue" head came out a different physical size on every strand,
     and on the ones running into a tight turn it stretched into a long
     dart. An arrowhead is a glyph. It should be the same size everywhere,
     like a font's arrow, and 6.0 A against a 4.9 A barb is the proportion
     that reads as one. */
  const ARROW = { head: 2.45, tip: 0, length: 6.0 };

  const SUB = 10;        // interpolated samples per residue

  const sub = (a, b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
  const add = (a, b) => [a[0]+b[0], a[1]+b[1], a[2]+b[2]];
  const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
  const dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
  const len = a => Math.hypot(a[0], a[1], a[2]);
  const norm = a => { const l = len(a) || 1; return [a[0]/l, a[1]/l, a[2]/l]; };

  /* ---------------- secondary structure ---------------- */

  /* assign(n, first, ranges) -> ['C','H',...] of length n.
     `first` is the residue number of points[0]; ranges are inclusive
     [from, to] pairs in the SAME numbering. Anything unlisted is coil. */
  function assign(n, first, ranges, code) {
    const ss = new Array(n).fill('C');
    for (const [a, b] of ranges || []) {
      for (let r = a; r <= b; r++) {
        const i = r - first;
        if (i >= 0 && i < n) ss[i] = code || 'H';
      }
    }
    return ss;
  }

  /* detect(points) -> SS array, from Ca geometry alone.
     An alpha helix holds Ca(i)->Ca(i+3) near 5.0-5.5 A and Ca(i)->Ca(i+4)
     near 6.0-6.5 A; both must hold, because the i+3 test alone also fires
     on tight turns. Only for traces with no HELIX records — prefer
     assign() whenever the deposited file states the answer. */
  function detect(points) {
    const n = points.length;
    const ss = new Array(n).fill('C');
    const d = (i, j) => len(sub(points[j], points[i]));
    for (let i = 0; i + 4 < n; i++) {
      const d3 = d(i, i + 3), d4 = d(i, i + 4);
      if (d3 > 4.6 && d3 < 6.0 && d4 > 5.4 && d4 < 7.0) {
        for (let k = i; k <= i + 4; k++) ss[k] = 'H';
      }
    }
    return ss;
  }

  /* ---------------- DSSP ---------------- */

  /* parseBackbone(pdbText) -> { nums, chains, N, CA, C, O }, parallel arrays.
     Every residue missing any of the four backbone atoms is dropped, because
     dssp() cannot say anything about one.

     KEYED BY CHAIN AND NUMBER, NOT NUMBER ALONE. The first version of this
     used the residue number as the whole key, which is correct for the
     single-chain AlphaFold model it was written for and silently destructive
     everywhere else: 9ZZI's five actin subunits collapsed onto one another
     into 370 residues instead of ~1850, and 9JUS's villin overwrote the
     actin it grips. The symptom was not an error but a plausible-looking
     agreement score, 84% against the deposited records instead of the high
     90s. Residue numbering restarts in every chain of every multi-chain
     structure, so this is the general case and not an edge case. */
  function parseBackbone(pdbText) {
    const byRes = new Map();
    const order = [];
    for (const l of pdbText.split('\n')) {
      if (!l.startsWith('ATOM')) continue;
      const name = l.slice(12, 16).trim();
      if (name !== 'N' && name !== 'CA' && name !== 'C' && name !== 'O') continue;
      const alt = l[16];
      if (alt !== ' ' && alt !== 'A') continue;      // first altloc only
      const chain = l[21];
      const num = parseInt(l.slice(22, 26), 10);
      const icode = l[26] === ' ' ? '' : l[26];
      const p = [+l.slice(30, 38), +l.slice(38, 46), +l.slice(46, 54)];
      if (!Number.isFinite(num) || !p.every(Number.isFinite)) continue;
      const key = chain + '|' + num + icode;
      if (!byRes.has(key)) { byRes.set(key, { chain, num }); order.push(key); }
      const r = byRes.get(key);
      if (r[name] == null) r[name] = p;
    }
    const out = { nums: [], chains: [], N: [], CA: [], C: [], O: [] };
    for (const key of order) {                       // file order, per chain
      const r = byRes.get(key);
      if (!r.N || !r.CA || !r.C || !r.O) continue;
      out.nums.push(r.num); out.chains.push(r.chain); out.CA.push(r.CA);
      out.N.push(r.N); out.C.push(r.C); out.O.push(r.O);
    }
    return out;
  }

  /* dssp(bb) -> ['C','H','E',...], one per residue of parseBackbone's output.

     Kabsch & Sander (1983), reduced to the three states a cartoon draws.

     WHY A REAL DSSP AND NOT detect(). detect() reads Ca spacing and is a
     guess; this reads the backbone hydrogen bonds that DEFINE the secondary
     structure, which is the same thing the deposited HELIX records report
     and the same algorithm Mol* runs when it cartoons a file with no
     records. That distinction is the whole reason villin can be drawn as a
     ribbon at all: a helix here is computed from the model's own N, CA, C
     and O by the standard method, not invented from Ca positions.

     WHAT IT STILL DOES NOT LICENSE. Run on an AlphaFold model this reports
     THE MODEL'S secondary structure, which is not the same claim as the
     protein's. It is the mild form of the caveat villin.js already makes at
     length: AlphaFold's local secondary structure is its most reliable
     output and the PAE argument is about where domains sit, not how they
     fold. folding/tools/check-folding.js checks this implementation against
     1VII's deposited HELIX records over the 36 residues where an experiment
     and the prediction overlap, which is the only place the two can be
     compared at all.

     The amide H is placed by DSSP's own approximation: 1 A from N along the
     direction opposite the preceding residue's C=O. Bond energy is the
     electrostatic term with q1*q2*f = 0.42 * 0.20 * 332 kcal/mol/A, and a
     bond exists below -0.5 kcal/mol. HBond(i,j) means the C=O of i donates
     to the N-H of j — the argument order matters and reversing it silently
     turns parallel sheet into antiparallel. */
  const HB_COUPLE = 0.42 * 0.20 * 332;
  const HB_CUTOFF = -0.5;

  function dssp(bb) {
    const n = bb.nums.length;
    const ss = new Array(n).fill('C');
    if (n < 4) return ss;

    /* Amide hydrogens. A residue that does not directly follow its
       predecessor in numbering starts a new chain and has no preceding
       C=O to place one from, so it can never accept in an H-bond. */
    const H = new Array(n).fill(null);
    const chain = bb.chains || new Array(n).fill('A');
    for (let i = 1; i < n; i++) {
      if (chain[i] !== chain[i - 1] || bb.nums[i] !== bb.nums[i - 1] + 1) continue;
      const d = norm(sub(bb.C[i - 1], bb.O[i - 1]));
      H[i] = [bb.N[i][0] + d[0], bb.N[i][1] + d[1], bb.N[i][2] + d[2]];
    }

    const dist = (a, b) => Math.hypot(a[0]-b[0], a[1]-b[1], a[2]-b[2]) || 1e-6;
    const cache = new Map();
    /* hb(i, j): does the C=O of i donate to the N-H of j? */
    function hb(i, j) {
      if (i < 0 || j < 0 || i >= n || j >= n || !H[j]) return false;
      /* Neighbours cannot bond — but only within a chain. Applying this
         across chains would suppress the real inter-subunit sheet wherever
         two chains happen to reuse a residue number, which is always. */
      if (chain[i] === chain[j] && Math.abs(bb.nums[i] - bb.nums[j]) < 2) return false;
      const key = i * n + j;
      const hit = cache.get(key);
      if (hit !== undefined) return hit;
      let val = false;
      if (dist(bb.CA[i], bb.CA[j]) <= 9) {           // DSSP's own prefilter
        const E = HB_COUPLE * (1 / dist(bb.O[i], bb.N[j]) + 1 / dist(bb.C[i], H[j])
                             - 1 / dist(bb.O[i], H[j]) - 1 / dist(bb.C[i], bb.N[j]));
        val = E < HB_CUTOFF;
      }
      cache.set(key, val);
      return val;
    }

    /* Helices, from n-turns. Two consecutive 4-turns make an alpha helix;
       two consecutive 3-turns make 3-10, which a cartoon draws as a helix
       too, so both land in 'H'. The 4-turn pass runs second and overwrites,
       because DSSP gives alpha priority over 3-10. */
    const mark = (from, to, code) => {
      for (let k = Math.max(0, from); k <= Math.min(n - 1, to); k++) ss[k] = code;
    };
    /* A turn is a claim about consecutive residues, so every index it spans
       has to be one chain with no numbering gap. Without this a helix can be
       declared across the join between two subunits. */
    const run = (i, k) => {
      if (i < 0 || k >= n) return false;
      for (let m = i + 1; m <= k; m++)
        if (chain[m] !== chain[m - 1] || bb.nums[m] !== bb.nums[m - 1] + 1) return false;
      return true;
    };
    for (let i = 0; i + 4 < n; i++)
      if (run(i, i + 4) && hb(i, i + 3) && hb(i + 1, i + 4)) mark(i + 1, i + 3, 'H');
    for (let i = 0; i + 5 < n; i++)
      if (run(i, i + 5) && hb(i, i + 4) && hb(i + 1, i + 5)) mark(i + 1, i + 4, 'H');

    /* Bridges. A residue pair is bridged when the H-bond pattern between
       them is one of the four Kabsch & Sander cases. */
    const bridge = new Array(n).fill(false);
    for (let i = 1; i + 1 < n; i++) {
      for (let j = i + 3; j + 1 < n; j++) {
        const anti = (hb(i, j) && hb(j, i)) || (hb(i - 1, j + 1) && hb(j - 1, i + 1));
        const para = (hb(i - 1, j) && hb(j, i + 1)) || (hb(j - 1, i) && hb(i, j + 1));
        if (anti || para) { bridge[i] = true; bridge[j] = true; }
      }
    }
    /* A LADDER, NOT A LONE BRIDGE. DSSP calls an isolated bridge 'B' and
       only a run of them 'E'. Drawing a single bridged residue as a strand
       puts a one-residue arrowhead in the middle of a loop, which reads as
       noise, so require a bridged neighbour. */
    for (let i = 0; i < n; i++)
      if (bridge[i] && ss[i] === 'C' && (bridge[i - 1] || bridge[i + 1])) ss[i] = 'E';

    return ss;
  }

  /* ---------------- guide-point smoothing ---------------- */

  /* A helix's Ca trace is ITSELF a spiral — the Ca sit 2.3 A off the axis
     and go round every 3.6 residues. Splining straight through them gives
     a ribbon that lurches at every residue instead of sweeping, which is
     what made the first version look restless even after the width was
     fixed.

     Carson & Bugg (1986) avoid this by taking guide points from the
     peptide planes rather than the Ca, then fitting a B-spline through
     those. We have no peptide planes (Ca-only input), so we approximate
     the same effect directly: pull each helix/strand Ca a little toward
     the midpoint of its neighbours.

     HOW MUCH IS NOT A MATTER OF TASTE, and guessing it got this wrong
     twice. One Laplacian pass of weight w multiplies an ideal helix's
     radius by |1 - w(1 - cos(100 deg))| = |1 - 1.1736 w|, because an alpha
     helix advances 100 degrees per residue. So:

         2 passes at 0.45  ->  0.22x  ->  2.30 A becomes 0.51 A
         1 pass   at 0.35  ->  0.59x  ->  2.30 A becomes 1.35 A
         1 pass   at 0.20  ->  0.77x  ->  2.30 A becomes 1.76 A

     The first is a COLLAPSE: at 0.5 A off axis the band is effectively
     straight, which is the "rocket" style — a different diagram that hides
     the fact a helix is a coil at all.

     THE SECOND WAS SET TO COMPENSATE FOR A BUG THAT IS NOW FIXED, which is
     the interesting one. 0.35 was chosen to damp a per-residue lurch, but
     the lurch was never the Ca spiral: it was frames being LERPED between
     residues in build(), and the cure for it is splining the offset curve
     (see build()). Smoothing was doing that job badly and paying for it by
     shrinking the helix — and once the frame was also turned the right way
     round, a 1.35 A radius under a 2.6 A band left barely any gap between
     turns and the helices read as a stack of cups.

     0.20 is what is left once the smoothing only has to do its own job:
     enough to regularise the guide points, gentle enough that the coil
     stays 1.76 A off axis and the 5.4 A pitch keeps daylight between one
     turn and the next. folding/tools/check-folding.js pins the retention
     between 40% and 80% so neither extreme can come back unnoticed.

     A STRAND NEEDS A COMPLETELY DIFFERENT WEIGHT, and using one number for
     both is why the first sheets came out lumpy — a row of caterpillars
     rather than flat bands.

     The arithmetic above is per-geometry, and a beta strand is not a helix.
     Its Ca alternate about 0.9 A either side of the strand's mean plane —
     the PLEAT, 180 degrees per residue, not 100 — so the same formula gives
     |1 - w(1 - cos 180)| = |1 - 2w|:

         w = 0.20  ->  60% of the pleat survives   (visibly bumpy)
         w = 0.50  ->  0%                          (exactly flat)

     0.50 annihilates it, exactly, because cos 180 is -1. And that is the
     RIGHT thing to do here where it would be vandalism on a helix, because
     the two features are not the same kind of thing. A helix's coil IS its
     shape and a cartoon that flattens it has drawn a different diagram. A
     strand's pleat is a side-chain alternation that no cartoon has ever
     drawn — every viewer renders a strand as a flat band, and the pleat is
     precisely the noise that has to go for the band to read flat.

     Hence a weight per secondary structure rather than one number.

     Coil stays at zero: a loop's wiggle IS its shape, and rounding it off
     would quietly straighten the parts of the chain the model is least sure
     about. Residues at a run's boundary get half weight so the join into
     coil has no kink. */
  const SMOOTH_W = { H: 0.20, E: 0.50, C: 0 };
  /* `w` is either a single number (every structure smoothed the same, which
     is what the checker uses to measure one geometry at a time) or a table
     keyed by SS code. Default is the table — see SMOOTH_W above for why one
     number cannot serve a helix and a strand at once. */
  function smooth(P, ss, passes, w) {
    const table = (w == null) ? SMOOTH_W : w;
    const weight = c => (typeof table === 'number' ? table : (table[c] || 0));
    let cur = P.map(p => p.slice());
    for (let it = 0; it < passes; it++) {
      const next = cur.map(p => p.slice());
      for (let i = 1; i + 1 < cur.length; i++) {
        if ((ss[i] || 'C') === 'C') continue;
        const edge = ss[i - 1] !== ss[i] || ss[i + 1] !== ss[i];
        const k = weight(ss[i]) * (edge ? 0.5 : 1);
        for (let c = 0; c < 3; c++) {
          const mid = (cur[i - 1][c] + cur[i + 1][c]) / 2;
          next[i][c] = cur[i][c] + (mid - cur[i][c]) * k;
        }
      }
      cur = next;
    }
    return cur;
  }

  /* ---------------- the path ---------------- */

  /* Curve tension PER SECONDARY STRUCTURE, and it has to be per-knot for the
     same reason the smoothing weight and the sign-continuity guard did: a
     helix and a loop are not the same kind of curve and one number cannot
     serve both. That is now the third global parameter in this file to have
     been split this way, which is worth noticing before adding a fourth.

     WHY HELICES WANT 0.94. A Catmull-Rom tangent at a knot is the chord from
     the previous knot to the next. On a helix the guide points are 100
     degrees apart, so that chord is far shorter than the arc it stands for
     and the cubic between knots sags inward — measured on an ideal helix,
     from 1.76 A off axis at each residue to 1.46 A between them. A 17%
     scallop, once per residue. Not a sampling problem: raising SUB draws the
     same scallop with more triangles. Scaling the tangents up is the fix,
     and 0.94 takes that measurement to 0.27%.

     LOOPS WANT IT TOO, WHICH WAS NOT THE EXPECTED ANSWER. Kinks in the coil
     look exactly like spline overshoot, and lowering the tension there is
     the obvious cure. It is the wrong one, and the numbers are not close.
     Peak curvature in villin's loops, over 15414 steps:

         tension 0.94   min radius 0.84 A      0 steps under 0.6 A
         tension 0.50   min radius 0.43 A    157
         tension 0.25   min radius 0.12 A   1772

     Low tension means short tangents, so the curve nearly stalls at each
     knot and then has to turn hard to reach the next — cusps AT the knots,
     which is the very thing it was supposed to prevent. At tension 0 every
     knot is a cusp exactly.

     The measurement that argued for lowering it was total turn accumulated
     across a corner, which looked like overshoot at 0.94 and less at 0.50.
     That window spans two intervals, so it also counts the neighbouring
     corners turning legitimately, and it cannot reach zero however good the
     curve is. Peak curvature is the metric that corresponds to a visible
     kink; total turn over a window is not. The real cause of the kinks was
     sampling — see COIL_X below.

     So: one tension, and this stays a plain constant rather than the
     per-structure table that the smoothing weight and the continuity guard
     both had to become. Two of those splits were right and this one was
     not; the table was written and then measured away. */
  const TENSION = 0.94;

  /* hermite(K) -> { point(i, t), tangent(i, t) }, a uniform cubic Hermite
     through the knots K at TENSION.

     Replaces THREE.CatmullRomCurve3. It is the same family of curve — at a
     tension of 0.5 this IS Catmull-Rom — and it was written when the plan
     was a per-knot tension, which the measurements above then rejected. It
     stays because it is equivalent, verified against the same assertions,
     and one less dependency on three.js's curve parameterisation quirks
     (its 'catmullrom' type is the only one that accepts a tension at all).

     Indexed by segment rather than by a normalised u, because build() walks
     residues and already knows which segment it is on — going through a
     0..1 parameter would only convert back. */
  function hermite(K) {
    const N = K.length;
    const m = [];
    for (let i = 0; i < N; i++) {
      const a = K[Math.max(0, i - 1)], b = K[Math.min(N - 1, i + 1)];
      /* Interior tangents span two intervals; the ends see only one, so
         double them or the curve starts and finishes visibly slack. */
      const w = TENSION * ((i === 0 || i === N - 1) ? 2 : 1);
      m.push([(b[0]-a[0]) * w, (b[1]-a[1]) * w, (b[2]-a[2]) * w]);
    }
    const seg = (i, t) => {
      if (i >= N - 1) return [N - 2 < 0 ? 0 : N - 2, N - 2 < 0 ? 0 : 1];
      return [i, t];
    };
    return {
      point(i0, t0) {
        const [i, t] = seg(i0, t0), j = Math.min(N - 1, i + 1);
        const t2 = t*t, t3 = t2*t;
        const h00 = 2*t3 - 3*t2 + 1, h10 = t3 - 2*t2 + t;
        const h01 = -2*t3 + 3*t2,    h11 = t3 - t2;
        const A = K[i], B = K[j], MA = m[i], MB = m[j];
        return [0, 1, 2].map(c => h00*A[c] + h10*MA[c] + h01*B[c] + h11*MB[c]);
      },
      tangent(i0, t0) {
        const [i, t] = seg(i0, t0), j = Math.min(N - 1, i + 1);
        const t2 = t*t;
        const d00 = 6*t2 - 6*t, d10 = 3*t2 - 4*t + 1;
        const d01 = -6*t2 + 6*t, d11 = 3*t2 - 2*t;
        const A = K[i], B = K[j], MA = m[i], MB = m[j];
        const d = [0, 1, 2].map(c => d00*A[c] + d10*MA[c] + d01*B[c] + d11*MB[c]);
        return len(d) < 1e-9 ? [1, 0, 0] : norm(d);
      },
    };
  }

  /* ---------------- frames ---------------- */

  /* One orientation frame per residue.

     TANGENT FROM THE SMOOTHED PATH, NORMAL FROM THE ORIGINAL Ca, which is
     the point of taking two arrays. Smoothing is what makes the ribbon
     sweep, but it also flattens the curvature the normal is derived from —
     smooth enough and the curvature vanishes, the normal degenerates, and
     the ribbon's face direction becomes noise. Reading the normal off the
     unsmoothed Ca keeps it well-conditioned no matter how hard the path is
     smoothed, because the real helix always curves hard.

     `path` defaults to `pts`, so callers that do not smooth are unaffected.

     ---------------------------------------------------------------------
     SIGN CONTINUITY IS FOR STRANDS AND LOOPS, NEVER FOR HELICES
     ---------------------------------------------------------------------
     `ss` decides whether the usual `if (dot(n, prev) < 0) n = -n` runs at a
     given residue, and both answers are wrong everywhere except where they
     belong. This file has now shipped each mistake once.

     ON A HELIX IT MUST NOT RUN. The frame genuinely advances 100 degrees
     per residue, cos(100) is negative, and the guard cannot tell that from
     a spurious 180-degree flip. It fired on every residue, the step became
     180 - 100 = 80, and the band alternated instead of rotating — each turn
     flaring open and shut like a cone.

     ON A STRAND IT MUST. A beta strand is PLEATED: the Ca alternate about
     0.9 A either side of the strand's mean plane, so the bisector points
     first one way and then the other, a true 180 degrees per residue.
     Measured on the bench, exactly 180. Without the guard the ribbon face
     reverses at every residue and the band rolls along its own length.

     The two cases look identical in the code and are opposite in fact,
     which is why this takes `ss` rather than a global policy. A helix's
     frame really does turn; a strand's alternation is really an artefact.
     Coil follows the strand rule: its curvature is well conditioned and
     varies slowly, so continuity is what it wants too.

     Unknown/absent `ss` is treated as coil, i.e. the guard runs. That is
     the safe default — a caller who forgets to pass `ss` gets a slightly
     over-constrained loop rather than a silently shredded strand.

     ---------------------------------------------------------------------
     `ref` — CONTINUITY WITH ANOTHER CONFORMATION, NOT JUST ALONG THE CHAIN
     ---------------------------------------------------------------------
     The guard above chains each residue's sign from the one before it,
     seeded at residue 0. That makes ONE build self-consistent and says
     nothing about two builds of the SAME chain in slightly different
     conformations — which is what an animation is.

     On a strand the bisector alternates a true 180 degrees per residue, so
     `dot(nrm, prev)` sits at the decision boundary, and a hair of movement
     between two conformations tips it the other way. The sign is then
     propagated, so one tipped decision inverts the band for the rest of the
     run: the two builds disagree about which face is up, and anything that
     blends them passes through an inverted ribbon. Strands show it first
     because the pleat is what puts that dot near zero.

     Pass the previous conformation's frames as `ref` and each residue takes
     its sign from ITS OWN normal last time rather than from its neighbour
     this time. Spatial continuity survives because `ref` had it. Omit `ref`
     and this behaves exactly as before. */
  function frames(pts, path, ss, ref) {
    path = path || pts;
    ss = ss || [];
    const n = pts.length;
    const out = [];
    let prev = null;
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[i], c = pts[Math.min(n - 1, i + 1)];
      /* Tangent along the path that is actually drawn... */
      const pa = path[Math.max(0, i - 1)], pc = path[Math.min(n - 1, i + 1)];
      const t = norm(sub(pc, pa));
      /* ...curvature off the raw Ca, which never goes slack. The bisector,
         pointing at the local centre of curvature — see the header on why
         this must not be a cross product. */
      let nrm = add(sub(a, b), sub(c, b));
      /* Collinear (or an endpoint): curvature says nothing, so inherit.
         Falling back to an arbitrary axis here is what puts a visible
         quarter-turn in the middle of an otherwise straight run. */
      if (len(nrm) < 1e-4) {
        nrm = prev ? prev.slice() : (Math.abs(t[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]);
      }
      nrm = norm(nrm);
      /* Orthogonalise against the tangent, then keep the sign continuous. */
      const proj = dot(nrm, t);
      nrm = norm([nrm[0] - t[0]*proj, nrm[1] - t[1]*proj, nrm[2] - t[2]*proj]);
      /* Sign continuity — everywhere EXCEPT a helix. See the header above:
         a helix's frame really turns 100 degrees per residue and must not
         be "corrected"; a strand's pleat really does alternate 180 and must
         be. */
      const guide = ref ? ref[i] && ref[i].n : prev;
      if (guide && (ss[i] || 'C') !== 'H' && dot(nrm, guide) < 0)
        nrm = [-nrm[0], -nrm[1], -nrm[2]];
      prev = nrm;
      out.push({ t, n: nrm });
    }
    return out;
  }

  /* ---------------- geometry ---------------- */

  /* build(THREE, points, ss, opts) -> BufferGeometry, in the caller's frame.
       points  array of THREE.Vector3 (Ca), real angstroms
       ss      per-point 'H' | 'E' | 'C'
       opts    { coil }    the coil's half-width, so a page can make its
                          loops exactly as thick as the tube they replace
               { smooth } guide-point smoothing weight — a number for all
                          structures, or a table by SS code; default SMOOTH_W
               { passes } smoothing passes, default 1; 0 disables it
               { sub }    samples per residue, default SUB (10)
               { ref }    the previous conformation's frames, when the same
                          chain is being drawn moving — keeps the band's
                          face from flipping between builds; frames() header
               { out }    an object to receive { frames }, to pass back as
                          the next build's `ref`

     SUB IS A SCALE KNOB, NOT A QUALITY KNOB. 10 is right when one chain
     fills the stage and a single residue is tens of pixels across. Drawing
     826 residues at 10 nm the same way costs 66k triangles and 141 ms to
     rebuild — a visible hitch every time an arrangement button is clicked —
     to resolve curvature far below one pixel. Lower it as the subject gets
     smaller on screen, the same reasoning that makes the far rungs tubes
     rather than ribbons at all. What it must NOT be used for is hiding the
     scallop a wrong curve tension produces; that is a different defect and
     more samples never fixed it (see the tension note below).

     THE HELIX IS NOT SCALED WITH IT, and that is deliberate. A single
     multiplier over every profile was an early version and it was wrong:
     matching the coil to folding-lab's TUBE_R (1.12 A) meant a factor of
     2.03, which took the helix ribbon to 9.3 A across — twice the width of
     the helix it is drawing. H and E stay in real angstroms so the ribbon
     is the size the secondary structure actually is; only the coil, which
     is a stand-in for a chain rather than a measurement, follows the page.
     A caller that passes a coil anywhere near the H half-width (1.30) has
     erased the width contrast the cartoon is built on — see PROFILE.

     ---------------------------------------------------------------------
     SPLINE THE EDGE, NOT THE FRAME
     ---------------------------------------------------------------------
     The obvious construction — spline the centre line, then lerp the
     per-residue orientation frames between knots — is what this used to do,
     and it is why the band twitched. Two frames one residue apart on a
     helix differ by ~100 degrees about the tangent; lerping two unit
     vectors 100 degrees apart traces a CHORD, so the interpolated normal
     shortens toward the middle of every residue and then snaps back. The
     face direction therefore accelerates and decelerates ten times per
     turn, which the eye reads as a wobble rather than a twist, and no
     amount of extra subdivision fixes it because the error is in the
     interpolant and not the step size.

     3Dmol (`subdivide` over its `points` AND `normals` arrays) and Mol*
     both avoid this the same way, and it is the single change that makes a
     ribbon look like a ribbon: build a SECOND curve offset one angstrom
     along the normal, spline that curve with exactly the same Catmull-Rom
     the centre line gets, and recover the frame at every sample as the
     difference between the two. The orientation is then interpolated by the
     same smooth basis as the path, arrives with the same continuity, and
     cannot shorten — it is re-normalised from two spline points rather than
     averaged from two directions.

     Widths get the same treatment for the same reason, via smoothstep
     rather than a linear ramp, so an H->C boundary eases in and out instead
     of putting a crease across the band where the taper starts.

     A rectangular cross-section, four faces, with duplicated vertices per
     face so the edges shade crisply instead of smearing round the corner. */
  function build(THREE, points, ss, opts) {
    const coil = (opts && opts.coil) || PROFILE.C[0];
    const n = points.length;
    if (n < 2) return new THREE.BufferGeometry();

    const P = points.map(p => [p.x, p.y, p.z]);
    const passes = (opts && opts.passes != null) ? opts.passes : 1;
    const w = (opts && opts.smooth != null) ? opts.smooth : SMOOTH_W;
    const SM = passes > 0 ? smooth(P, ss, passes, w) : P;
    /* `ref` is the PREVIOUS conformation's frames, for a caller drawing the
       same chain moving; see the frames() header. It is threaded rather
       than kept here because only the caller knows what "previous" means.
       `opts.out` hands the frames back so they can become the next ref. */
    const F = frames(P, SM, ss, opts && opts.ref);
    if (opts && opts.out) opts.out.frames = F;

    /* Arrowheads sit at the end of every strand run, pointing the way the
       chain runs — N to C. Their geometry is built in strandPlan() below,
       sized in angstroms rather than residues; ARROW carries the constants
       and the reasoning. */

    const pos = [], nor = [], idx = [];
    const samples = [];

    /* The centre line, and its twin one angstrom along the frame normal.
       Both at the same tension: they are differenced to recover the frame,
       so treating them differently would put that difference straight back
       into the wobble this removes. */
    const curve = hermite(SM);
    const edge  = hermite(
      SM.map((p, i) => [p[0] + F[i].n[0], p[1] + F[i].n[1], p[2] + F[i].n[2]]));

    const smoothstep = t => t * t * (3 - 2 * t);
    /* Not `sub` — that is this module's vector subtraction, and shadowing it
       here throws "sub is not a function" further down build(). */
    const band = Math.max(2, (opts && opts.sub) || SUB);

    /* COIL IS SAMPLED COIL_X TIMES FINER THAN THE BANDS, and this — not the
       curve tension — is what removes the kinks in the loops.

       A loop turns far harder than a helix or a strand, for two compounding
       reasons: it is the part of the chain that actually changes direction,
       and it is the one structure that is never smoothed, so its corners
       arrive at full strength. Villin's tightest loop bend has a radius of
       0.84 A. Walked at the bands' rate that is a 46 degree direction change
       between adjacent tube rings, and 553 steps in the chain turn more than
       30 — every one of them a visible corner in a round tube.

           coil rate     worst step     steps over 30 deg
              x1            46              553
              x2            28                0
              x3            18                0

       Raising the rate for the WHOLE chain would work and costs three times
       the geometry across 826 residues. Raising it only where the curvature
       is pays for it where it is needed: helices and strands are smoothed
       and regular, and gain nothing from the extra rings.

       The frame is still solved once, over the fine grid, for the same
       reason the curve is global — the twist must not restart at a boundary.
       Bands simply take every COIL_X'th sample. Run endpoints are pinned
       exactly, so a band and the tube beside it still share their boundary
       sample and butt with no gap. */
    const COIL_X = 3;
    const fine = band * COIL_X;
    const total = (n - 1) * fine;
    let prevN = null;
    for (let s = 0; s <= total; s++) {
      const f = s / fine;
      const i0 = Math.min(n - 1, Math.floor(f)), i1 = Math.min(n - 1, i0 + 1);
      const raw = f - i0;                 // the arrow taper is linear, not eased
      const t = smoothstep(raw);
      const cp = curve.point(i0, raw), ep = edge.point(i0, raw);
      const tan = curve.tangent(i0, raw);

      /* Frame from the two curves: the offset direction gives the face, and
         crossing twice drops whatever component of it drifted off
         perpendicular. side = t x r, then n = side x t is r with its
         parallel part removed — one step, no explicit projection. */
      let r = sub(ep, cp);
      if (len(r) < 1e-6) r = prevN || (Math.abs(tan[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]);
      let side = cross(tan, r);
      if (len(side) < 1e-6) side = cross(tan, Math.abs(tan[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]);
      side = norm(side);
      const nrm = norm(cross(side, tan));
      prevN = nrm;

      /* Width belongs to the element, not to the sample, so it is resolved
         per run below. Only the frame is global. */
      void t; void i1;
      samples.push({ p: cp, n: nrm, s: side, i: i0, raw });
    }

    /* ---------------------------------------------------------------
       ONE PIECE PER ELEMENT, BUTTED — not one band that morphs
       ---------------------------------------------------------------
       This used to be a single continuous tube whose cross-section was
       interpolated from coil into helix and back. It is the obvious
       construction and it looks wrong at exactly the place a cartoon is
       read: the join. A 0.64 A cord easing into a 2.6 A band over one
       residue is a short twisted funnel, and with four flat faces it
       catches the light as a crease. Every helix and every strand had two
       of them.

       Mol* and PyMOL do not morph. Each secondary-structure element is its
       own piece with its own constant cross-section, and the coil is a
       separate ROUND tube that simply meets it. The join reads as one thing
       ending and another starting, which is what it is, and the eye stops
       looking at it.

       Two consequences worth keeping straight:

       - The frame is still solved over the WHOLE chain, above. Only the
         geometry is split. Solving each element separately would let the
         twist restart at every boundary, which is a worse artefact than the
         funnel it replaces.

       - Runs meet at the MIDPOINT of the boundary bond — run [a..b] owns
         samples from (a-0.5) to (b+0.5) residues — so consecutive pieces
         share a sample position exactly and there is neither a gap nor an
         overlap to z-fight.

       Coil being round is the other half of it. A loop has no orientation
       worth showing, so a flat band there is claiming something the
       structure does not say, and its edge-on view vanishes to a line. A
       tube reads the same from every angle, which is what you want for the
       part of the chain that is just getting from one element to the next. */
    const runs = [];
    for (let i = 0; i < n; ) {
      let j = i;
      while (j + 1 < n && (ss[j+1] || 'C') === (ss[i] || 'C')) j++;
      runs.push({ a: i, b: j, code: ss[i] || 'C' });
      i = j + 1;
    }

    const meta = [];
    /* Six, not eight. The coil is a 0.64 A cord — at the scales this page
       draws, a couple of pixels across — so the cross-section is nowhere
       near the limiting factor, while COIL_X has just tripled how many of
       these rings there are. Six sides with smooth normals is
       indistinguishable and pays most of that back. Tubes cost twice a
       band's triangles per ring even so, which is why the coil dominates
       the geometry budget once it is sampled finely. */
    const TUBE_SIDES = 6;

    /* The ring plan for a strand: body, then a barb, then a straight taper
       to the point. Measured in ANGSTROMS ALONG THE CURVE, backwards from
       the run's drawn end.

       WHY ARC LENGTH AND NOT RESIDUES. A residue is not a fixed distance
       along the drawn path — the spline stretches through a turn, and a
       strand's last residues are precisely where it starts bending into
       one. Sizing the head in residues therefore made it a different
       physical size on every strand, longest on exactly the strands whose
       ends curve most, which is what turned some heads into long darts.

       THE BARB IS TWO RINGS AT ONE POSITION. Stepping the width between two
       ADJACENT samples still leaves a shoulder slanted by however far apart
       those samples are — at 10 per residue that is 0.33 A of run against
       0.73 A of rise per side, so the corner came out at roughly 25 degrees
       off square and read as a swept-back dart rather than an arrow.
       Emitting the body ring and the head ring at the SAME sample makes the
       connecting quad zero-length, so the shoulder is exactly perpendicular
       to the band and the corner is a true 90 degrees.

       The taper is linear, not smoothstepped: easing it gives the arrow
       curved sides, which reads as a leaf. */
    const strandPlan = list => {
      /* Arc length from the run's start to each sample. */
      const arc = [0];
      for (let k = 1; k < list.length; k++)
        arc.push(arc[k-1] + len(sub(samples[list[k]].p, samples[list[k-1]].p)));
      const total = arc[arc.length - 1];
      /* Never let the head eat the whole strand — a triangle with no shaft
         behind it does not say which way it came from. */
      const headLen = Math.min(ARROW.length, total * 0.6);
      const barbAt = total - headLen;

      const plan = [];
      let barbed = false;
      for (let k = 0; k < list.length; k++) {
        const S = samples[list[k]], a = arc[k];
        if (a < barbAt) { plan.push({ S, w: PROFILE.E[0] }); continue; }
        if (!barbed) {
          barbed = true;
          /* Square shoulder: body width and head width at one position. */
          plan.push({ S, w: PROFILE.E[0] });
          plan.push({ S, w: ARROW.head });
        }
        const u = headLen > 0 ? Math.min(1, (a - barbAt) / headLen) : 1;
        plan.push({ S, w: ARROW.head + (ARROW.tip - ARROW.head) * u });
      }
      return plan;
    };

    /* `plan` is a list of {S, w} — a sample and the half-width to use there.
       It is a list rather than a width function of the sample because the
       arrowhead's barb needs TWO rings at the SAME sample, one at body
       width and one at head width, and no per-sample function can express
       that. See the barb note in the strand plan below. */
    const emitBand = (plan, half) => {
      const base = pos.length / 3;
      for (const { S, w } of plan) {
        const side = S.s, N = S.n;
        const W = w, H = half;
        const c = [
          [S.p[0] + side[0]*W + N[0]*H, S.p[1] + side[1]*W + N[1]*H, S.p[2] + side[2]*W + N[2]*H],
          [S.p[0] - side[0]*W + N[0]*H, S.p[1] - side[1]*W + N[1]*H, S.p[2] - side[2]*W + N[2]*H],
          [S.p[0] - side[0]*W - N[0]*H, S.p[1] - side[1]*W - N[1]*H, S.p[2] - side[2]*W - N[2]*H],
          [S.p[0] + side[0]*W - N[0]*H, S.p[1] + side[1]*W - N[1]*H, S.p[2] + side[2]*W - N[2]*H],
        ];
        const negN = [-N[0], -N[1], -N[2]], negS = [-side[0], -side[1], -side[2]];
        /* face order: top(+N) left(-side) bottom(-N) right(+side); corners
           duplicated per face so the edges shade crisply instead of
           smearing round them. */
        const ring = [[c[0], N], [c[1], N], [c[1], negS], [c[2], negS],
                      [c[2], negN], [c[3], negN], [c[3], side], [c[0], side]];
        for (const [v, nv] of ring) { pos.push(v[0], v[1], v[2]); nor.push(nv[0], nv[1], nv[2]); }
      }
      const rings = plan.length - 1;
      for (let k = 0; k < rings; k++) {
        const a = base + k*8, b = base + (k+1)*8;
        for (let f = 0; f < 4; f++) {
          const a0 = a + f*2, a1 = a + f*2 + 1, b0 = b + f*2, b1 = b + f*2 + 1;
          idx.push(a0, b0, b1, a0, b1, a1);
        }
      }
      /* Flat caps. The ring lays each corner down twice, once per adjoining
         face, so a cap has to pick one copy of each: c0 c1 c2 c3 live at
         +0 +1 +3 +5. (+7 is c0's second copy — using it drew a degenerate
         quad, i.e. no cap, invisible until an end faced the camera.) */
      const cap = (ringBase, flip) => {
        const q = [ringBase, ringBase + 1, ringBase + 3, ringBase + 5];
        if (flip) idx.push(q[0], q[2], q[1], q[0], q[3], q[2]);
        else idx.push(q[0], q[1], q[2], q[0], q[2], q[3]);
      };
      cap(base, true);
      cap(base + rings*8, false);
    };

    const emitTube = (list, radius) => {
      const base = pos.length / 3;
      for (const s of list) {
        const S = samples[s], side = S.s, N = S.n;
        for (let k = 0; k < TUBE_SIDES; k++) {
          const a = 2 * Math.PI * k / TUBE_SIDES;
          const ca = Math.cos(a), sa = Math.sin(a);
          const nv = [side[0]*ca + N[0]*sa, side[1]*ca + N[1]*sa, side[2]*ca + N[2]*sa];
          pos.push(S.p[0] + nv[0]*radius, S.p[1] + nv[1]*radius, S.p[2] + nv[2]*radius);
          nor.push(nv[0], nv[1], nv[2]);   // smooth around the tube, no duplication
        }
      }
      const rings = list.length - 1;
      for (let r = 0; r < rings; r++) {
        for (let k = 0; k < TUBE_SIDES; k++) {
          const k2 = (k + 1) % TUBE_SIDES;
          const a0 = base + r*TUBE_SIDES + k,  a1 = base + r*TUBE_SIDES + k2;
          const b0 = a0 + TUBE_SIDES,          b1 = a1 + TUBE_SIDES;
          idx.push(a0, b0, b1, a0, b1, a1);
        }
      }
      for (const [ringBase, flip] of [[base, true], [base + rings*TUBE_SIDES, false]])
        for (let k = 1; k + 1 < TUBE_SIDES; k++)
          flip ? idx.push(ringBase, ringBase + k + 1, ringBase + k)
               : idx.push(ringBase, ringBase + k, ringBase + k + 1);
    };

    for (const r of runs) {
      const s0 = Math.max(0, Math.round((r.a - 0.5) * fine));
      const s1 = Math.min(total, Math.round((r.b + 0.5) * fine));
      if (s1 <= s0) continue;

      /* Coil walks every sample; bands take every COIL_X'th. The final
         index is pinned to s1 whatever the stride, so the last ring lands
         exactly on the boundary its neighbour starts from — otherwise a
         band would stop short of the tube beside it and leave a gap. */
      const stride = r.code === 'C' ? 1 : COIL_X;
      const list = [];
      for (let s = s0; s < s1; s += stride) list.push(s);
      list.push(s1);

      const from = idx.length;
      if (r.code === 'H')      emitBand(list.map(s => ({ S: samples[s], w: PROFILE.H[0] })), PROFILE.H[1]);
      else if (r.code === 'E') emitBand(strandPlan(list), PROFILE.E[1]);
      else                     emitTube(list, coil);
      meta.push({ ss: r.code, from: r.a, to: r.b,
                  indexStart: from, indexCount: idx.length - from });
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setIndex(idx);
    /* Which index range belongs to which element, so a caller can colour by
       secondary structure without re-deriving it — and, more importantly,
       without slicing the chain and calling build() per element, which
       re-runs the arrowhead logic on every slice and draws duplicate heads. */
    geo.userData.runs = meta;
    for (const m of meta) geo.addGroup(m.indexStart, m.indexCount,
      m.ss === 'H' ? 1 : m.ss === 'E' ? 2 : 0);
    geo.computeBoundingSphere();
    return geo;
  }

  /* 1VII's own HELIX records, in VILLIN numbering.
     The deposited file states 44-48, 55-58 and 63-72 in 1VII numbering,
     and 1VII residue 41 is villin 791 — a constant +750. Kept here rather
     than parsed at runtime because act 3 draws HP35 from villin.js's Ca
     trace, which never loads 1VII. folding/tools/check-folding.js asserts
     the offset and the ranges against the deposited file, so this cannot
     drift from the structure it claims to describe. */
  const HP35_OFFSET = 750;
  const HP35_HELICES = [[794, 798], [805, 808], [813, 822]];

  return { build, assign, detect, dssp, parseBackbone, frames, smooth,
           PROFILE, ARROW, SMOOTH_W, TENSION, HP35_HELICES, HP35_OFFSET };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = RibbonLib;
