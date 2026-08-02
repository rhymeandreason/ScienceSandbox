/* =====================================================================
 *  ribbon.js — secondary structure as geometry, from a Ca trace alone.
 *
 *  Page-specific, like folding.js, villin.js and actin.js: only
 *  folding-lab has a protein backbone to draw. Real angstroms, never sees
 *  SCALE, and it builds a BufferGeometry rather than a mesh so the page
 *  keeps ownership of materials, opacity and the fade machinery.
 *
 * ---------------------------------------------------------------------
 *  WHY THIS EXISTS RATHER THAN A LIBRARY
 * ---------------------------------------------------------------------
 *  Every viewer that draws cartoons — Mol*, 3Dmol, NGL, ChemDoodle —
 *  brings its own WebGL context and camera and cannot draw into
 *  scene.js's scene (RenderingLibraries.md, "Two viewers means two
 *  canvases"). Using one here would mean a second canvas stacked on the
 *  first, and folding-lab's atoms/tube crossfade, its hover raycast and
 *  its shared camera through the zoom ladder all live in the first one.
 *  A ribbon is not worth losing those, and it is ~200 lines.
 *
 * ---------------------------------------------------------------------
 *  ORIENTING A RIBBON WITHOUT C=O
 * ---------------------------------------------------------------------
 *  A cartoon's twist normally comes from the peptide plane — the C=O
 *  vector says which way the ribbon faces. We do not have it here: act 3
 *  draws HP35 from villin.js's Ca trace, and actin.bin is Ca-only too.
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
    E: [1.50, 0.22],     // beta strand — wider than a helix, same thinness
    C: [0.32, 0.22],     // coil — the same band, narrowed to a cord
  };

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

     Coil is never smoothed: a loop's wiggle IS its shape, and rounding it
     off would quietly straighten the parts of the chain the model is least
     sure about. Residues at a run's boundary get half weight so the join
     into coil has no kink. */
  function smooth(P, ss, passes, w) {
    let cur = P.map(p => p.slice());
    for (let it = 0; it < passes; it++) {
      const next = cur.map(p => p.slice());
      for (let i = 1; i + 1 < cur.length; i++) {
        if ((ss[i] || 'C') === 'C') continue;
        const edge = ss[i - 1] !== ss[i] || ss[i + 1] !== ss[i];
        const k = w * (edge ? 0.5 : 1);
        for (let c = 0; c < 3; c++) {
          const mid = (cur[i - 1][c] + cur[i + 1][c]) / 2;
          next[i][c] = cur[i][c] + (mid - cur[i][c]) * k;
        }
      }
      cur = next;
    }
    return cur;
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

     `path` defaults to `pts`, so callers that do not smooth are unaffected. */
  function frames(pts, path) {
    path = path || pts;
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
      /* NO SIGN-CONTINUITY FLIP HERE. There used to be one —
             if (dot(nrm, prev) < 0) nrm = -nrm;
         — and on a helix it fires on EVERY residue and is the single reason
         the band curled into cups instead of wrapping.

         That guard assumes the frame turns less than 90 degrees per step,
         so a reversal must be spurious. An alpha helix advances 100 degrees
         per residue, cos(100) is negative, and the test cannot tell a real
         100-degree rotation from a spurious 180-degree flip. It "corrected"
         every one: the measured step became 180 - 100 = 80 degrees and the
         frame ALTERNATED about the axis rather than rotating around it, so
         each turn of the ribbon flared open and closed like a cone.

         It is only needed for a normal with a genuine sign ambiguity, which
         is what the binormal this used to compute had. The bisector has
         none — it always points at the local centre of curvature, so its
         direction is determined, and forcing continuity onto something
         already continuous can only corrupt it. The degenerate case is
         handled above by inheriting `prev`, which is the only place a
         previous frame legitimately gets a say. */
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
               { smooth } guide-point smoothing weight, default 0.20
               { passes } smoothing passes, default 1; 0 disables it
               { sub }    samples per residue, default SUB (10)

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
    const w = (opts && opts.smooth != null) ? opts.smooth : 0.20;
    const SM = passes > 0 ? smooth(P, ss, passes, w) : P;
    const F = frames(P, SM);
    const prof = i => {
      const c = ss[i] || 'C';
      return c === 'C' ? [coil, PROFILE.C[1]] : PROFILE[c] || [coil, PROFILE.C[1]];
    };

    const pos = [], nor = [], idx = [];
    const samples = [];

    const V3 = p => new THREE.Vector3(p[0], p[1], p[2]);

    /* TENSION 0.94, NOT THE DEFAULT, and it is the difference between a
       smooth coil and a scalloped one.

       three.js's CatmullRomCurve3 defaults to centripetal parameterisation
       at the standard tension, whose tangent at a knot is half the chord
       from the previous knot to the next. On a curve as tightly wound as an
       alpha helix that chord is far shorter than the arc it stands for —
       the guide points are 100 degrees apart — so the cubic between two
       knots sags inward. Measured on an ideal helix it dropped from 1.76 A
       off axis at each residue to 1.46 A between them: a 17% scallop, once
       per residue, which is exactly the jaggedness this file had after the
       frame was finally right.

       IT IS NOT A SAMPLING PROBLEM AND SUB CANNOT FIX IT. The scallop is in
       the curve, not in how finely the curve is walked; raising SUB just
       draws the same scallop with more triangles. Scaling the tangents up
       is what fixes it — 0.94 takes the same measurement to 0.27%.

       Uniform parameterisation ('catmullrom') is required to pass a
       tension at all, and is safe here for a reason specific to protein
       backbones: centripetal exists to stop unevenly spaced knots throwing
       cusps, and consecutive Ca are 3.8 A apart the whole length of any
       chain. Checked against the real HP35 trace, where the tighter loops
       are the risk: the curve's worst excursion from its guide points grows
       only 1.96 -> 2.09 A, well inside one Ca step.

       Both curves take it. They are differenced to recover the frame, so a
       tension on one and not the other would put the difference back into
       the wobble this removes. */
    const CURVE = v => new THREE.CatmullRomCurve3(v, false, 'catmullrom', 0.94);

    /* The centre line, and its twin one angstrom along the frame normal. */
    const curve = CURVE(SM.map(V3));
    const edge  = CURVE(
      SM.map((p, i) => V3([p[0] + F[i].n[0], p[1] + F[i].n[1], p[2] + F[i].n[2]])));

    const smoothstep = t => t * t * (3 - 2 * t);
    /* Not `sub` — that is this module's vector subtraction, and shadowing it
       here throws "sub is not a function" further down build(). */
    const step = Math.max(2, (opts && opts.sub) || SUB);
    const total = (n - 1) * step;
    let prevN = null;
    for (let s = 0; s <= total; s++) {
      const u = s / total;
      const f = s / step;
      const i0 = Math.min(n - 1, Math.floor(f)), i1 = Math.min(n - 1, i0 + 1);
      const t = smoothstep(f - i0);
      const cp = curve.getPoint(u), ep = edge.getPoint(u);
      const tan = norm([...curve.getTangent(u).toArray()]);

      /* Frame from the two curves: the offset direction gives the face, and
         crossing twice drops whatever component of it drifted off
         perpendicular. side = t x r, then n = side x t is r with its
         parallel part removed — one step, no explicit projection. */
      let r = sub([ep.x, ep.y, ep.z], [cp.x, cp.y, cp.z]);
      if (len(r) < 1e-6) r = prevN || (Math.abs(tan[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]);
      let side = cross(tan, r);
      if (len(side) < 1e-6) side = cross(tan, Math.abs(tan[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]);
      side = norm(side);
      const nrm = norm(cross(side, tan));
      prevN = nrm;

      const w0 = prof(i0), w1 = prof(i1);
      samples.push({
        p: [cp.x, cp.y, cp.z], n: nrm, s: side,
        w: w0[0] + (w1[0] - w0[0]) * t,
        h: w0[1] + (w1[1] - w0[1]) * t,
      });
    }

    for (const S of samples) {
      const side = S.s;
      const N = S.n, W = S.w, H = S.h;
      const c = [
        [S.p[0] + side[0]*W + N[0]*H, S.p[1] + side[1]*W + N[1]*H, S.p[2] + side[2]*W + N[2]*H],
        [S.p[0] - side[0]*W + N[0]*H, S.p[1] - side[1]*W + N[1]*H, S.p[2] - side[2]*W + N[2]*H],
        [S.p[0] - side[0]*W - N[0]*H, S.p[1] - side[1]*W - N[1]*H, S.p[2] - side[2]*W - N[2]*H],
        [S.p[0] + side[0]*W - N[0]*H, S.p[1] + side[1]*W - N[1]*H, S.p[2] + side[2]*W - N[2]*H],
      ];
      const negN = [-N[0], -N[1], -N[2]], negS = [-side[0], -side[1], -side[2]];
      /* face order: top(+N) left(-side) bottom(-N) right(+side) */
      const ring = [[c[0], N], [c[1], N], [c[1], negS], [c[2], negS],
                    [c[2], negN], [c[3], negN], [c[3], side], [c[0], side]];
      for (const [v, nv] of ring) { pos.push(v[0], v[1], v[2]); nor.push(nv[0], nv[1], nv[2]); }
    }

    for (let s = 0; s + 1 < samples.length; s++) {
      const a = s * 8, b = (s + 1) * 8;
      for (let f = 0; f < 4; f++) {
        const a0 = a + f*2, a1 = a + f*2 + 1, b0 = b + f*2, b1 = b + f*2 + 1;
        idx.push(a0, b0, b1, a0, b1, a1);
      }
    }

    /* Flat caps, so an end reads as cut rather than hollow.

       The ring lays down each corner twice, once per adjoining face, so the
       cap has to pick one copy of each: c0 c1 c2 c3 live at +0 +1 +3 +5.
       (+7 is c0's second copy, not c3 — using it drew a degenerate quad,
       i.e. no cap at all, which is invisible until an end faces the
       camera.) */
    const capAt = (s, flip) => {
      const base = s * 8;
      const q = [base + 0, base + 1, base + 3, base + 5];   // c0 c1 c2 c3
      if (flip) idx.push(q[0], q[2], q[1], q[0], q[3], q[2]);
      else idx.push(q[0], q[1], q[2], q[0], q[2], q[3]);
    };
    capAt(0, true);
    capAt(samples.length - 1, false);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setIndex(idx);
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
           PROFILE, HP35_HELICES, HP35_OFFSET };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = RibbonLib;
