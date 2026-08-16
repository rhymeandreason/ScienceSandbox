/* =====================================================================
 *  tube.js — TubeLib: a Ca trace + secondary structure -> a smooth tube.
 *
 *  The abstracted cousin of folding/ribbon.js. Where the ribbon draws a flat
 *  band that shows a helix turning, this draws ONE continuous tube per chain,
 *  wide through helices and thin through loops, with the helix collapsed onto
 *  its own axis so there is no corkscrew. It is the representation for
 *  pictures with more than one molecule in them: a tetramer is 4 draw calls
 *  instead of ~240, and at any distance where a crowd is legible the ribbon's
 *  extra detail is invisible anyway.
 *
 *  WHY THIS IS A MODULE. It began as page-local code in tube-test.html, was
 *  copied into crowd-test.html, and a winding fix made in one did not reach
 *  the other — the copy rendered dark and inside-out until it was carried
 *  across by hand. The third page that wanted it is the one that made this a
 *  module. If a fourth appears, it already exists.
 *
 *  Real angstroms in, plain BufferGeometry out. No materials — the page owns
 *  those, exactly as RibbonLib does. No dependency but THREE, passed in.
 *
 *  Used by: sickle/fibre-test.html, hemoglobin/crowd-test.html.
 *  (hemoglobin/tube-test.html still carries the original inline copy; it is
 *  the prototype these were derived from and is left alone deliberately.)
 * ===================================================================== */
(function (global) {
  'use strict';

  /* Every default below came out of tube-test.html, where each was tuned
     against the reference figure. See its header for the reasoning; this
     file's job is to stop them being retyped. */
  const DEFAULTS = {
    /* Collapse each helix onto its own axis — RibbonLib's "rocket" style. A
       weight this high erases the coil-within-the-coil that a flat band
       normally hides by tracking the axis rather than the atoms. */
    collapseW: { H: 0.55, E: 0.55, C: 0 },
    collapsePasses: 3,
    /* Then a second pass over every point, loops included. RibbonLib.smooth
       cannot do this one — it skips coil unconditionally and by design ("a
       loop's wiggle IS its shape"), which is right for a cartoon and wrong
       for this deliberately more abstract picture. */
    relaxPasses: 3,
    relaxW: 0.4,
    /* The radius is a per-residue array blurred the same way, and THAT is
       what makes the helix-to-loop join gradual: blurring a step function
       spreads it over a few residues, so the tube tapers instead of
       stepping. It also means there is no join to hide. */
    radiusBlurPasses: 6,
    radiusBlurW: 0.5,
    /* HELIX_R sits close to ribbon.js's flat-band half-width (PROFILE.H[0] =
       1.30) so the two read as the same molecule at different levels of
       abstraction rather than as a redraw. */
    helixR: 1.5,
    coilR: 0.55,
    sides: 10,
    segPerRes: 3,
    caps: true,
  };

  /* Laplacian relaxation of a list of numbers, endpoints pinned. Used for
     the coordinates (once per axis) and for the radius array — they want the
     same operation, so they share one. */
  function relax(A, passes, w) {
    let cur = A.slice();
    for (let it = 0; it < passes; it++) {
      const next = cur.slice();
      for (let i = 1; i + 1 < cur.length; i++)
        next[i] = cur[i] + ((cur[i - 1] + cur[i + 1]) / 2 - cur[i]) * w;
      cur = next;
    }
    return cur;
  }

  /* A tube of VARYING radius. THREE.TubeGeometry takes one number, so this
     builds the rings itself — which is the point: a radius ramping from
     helixR down to coilR over a few residues is what turns the helix/loop
     boundary into a taper. Frenet frames go uncorrected because a circular
     cross-section has no orientation to get wrong; the frame machinery
     ribbon.js needs is only needed for a FLAT band. */
  function varTube(THREE, pts, radii, segments, sides) {
    const curve = new THREE.CatmullRomCurve3(pts);
    const F = curve.computeFrenetFrames(segments, false);
    const pos = [], nor = [], idx = [];
    const last = pts.length - 1;
    const P = new THREE.Vector3(), v = new THREE.Vector3();

    for (let s = 0; s <= segments; s++) {
      const t = s / segments;
      curve.getPoint(t, P);
      /* getPoint is uniform in the PARAMETER, so t maps straight onto the
         control-point index — which is what lets the radius array be read
         with a plain lerp rather than an arc-length search. */
      const u = t * last, i0 = Math.min(last, Math.floor(u));
      const r = radii[i0] + (radii[Math.min(last, i0 + 1)] - radii[i0]) * (u - i0);
      const N = F.normals[s], B = F.binormals[s];
      for (let k = 0; k < sides; k++) {
        const a = 2 * Math.PI * k / sides, ca = Math.cos(a), sa = Math.sin(a);
        v.set(N.x * ca + B.x * sa, N.y * ca + B.y * sa, N.z * ca + B.z * sa);
        pos.push(P.x + v.x * r, P.y + v.y * r, P.z + v.z * r);
        nor.push(v.x, v.y, v.z);         // smooth around the tube, no duplication
      }
    }

    /* WINDING, and it is not the obvious one. THREE.TubeGeometry lays its
       ring out with `cos = -Math.cos(v)` — a reflection, which walks the
       circle the opposite way round the frame from the plain (cos, sin) used
       above. Copy its index order without copying that sign and every face
       comes out inside-out: back-face culling then shows the INSIDE of the
       far wall, lit by normals pointing away from the camera, so the chain
       renders tube-shaped but dark. Verified by face test — with this order
       all faces point away from the axis, with the two triples swapped,
       none do. THIS IS THE FIX THAT DID NOT REACH THE COPY. */
    for (let s = 0; s < segments; s++)
      for (let k = 0; k < sides; k++) {
        const k2 = (k + 1) % sides;
        const a0 = s * sides + k, a1 = s * sides + k2;
        idx.push(a0, a1 + sides, a0 + sides, a0, a1, a1 + sides);
      }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setIndex(idx);
    return geo;
  }

  /* chain(THREE, CA, ss, opts) -> [{ geo }, ...]
     CA: array of [x,y,z] in angstroms. ss: array or string of H/E/C, one per
     residue. Returns the tube plus, unless caps:false, a sphere at each
     terminus — the only two open ends a continuous tube has. Each cap's
     position is BAKED INTO ITS GEOMETRY so the whole set shares one
     transform, which is what lets a caller instance them. */
  function chain(THREE, CA, ss, opts) {
    const o = Object.assign({}, DEFAULTS, opts || {});
    const S = typeof ss === 'string' ? ss.split('') : ss;
    const n = CA.length;

    const collapsed = RibbonLib.smooth(CA.map(p => [p[0], p[1], p[2]]),
                                       S, o.collapsePasses, o.collapseW);
    /* Relax each axis independently — a Laplacian is per-component, so this
       is the same operation as smoothing the path. */
    const ax = [0, 1, 2].map(c => relax(collapsed.map(p => p[c]), o.relaxPasses, o.relaxW));
    const pts = [];
    for (let i = 0; i < n; i++) pts.push(new THREE.Vector3(ax[0][i], ax[1][i], ax[2][i]));

    const radii = relax(Array.from({ length: n },
      (_, i) => (S[i] === 'H' || S[i] === 'E') ? o.helixR : o.coilR),
      o.radiusBlurPasses, o.radiusBlurW);

    const parts = [{ geo: varTube(THREE, pts, radii, (n - 1) * o.segPerRes, o.sides) }];
    if (o.caps)
      for (const i of [0, n - 1]) {
        const cap = new THREE.SphereGeometry(radii[i], o.sides, Math.max(2, o.sides >> 1));
        cap.translate(pts[i].x, pts[i].y, pts[i].z);
        parts.push({ geo: cap });
      }
    return parts;
  }

  /* Triangles a given setting will cost, without building it. Lets a page
     show the price of a tessellation slider before paying it. */
  function triangles(nRes, opts) {
    const o = Object.assign({}, DEFAULTS, opts || {});
    const seg = (nRes - 1) * o.segPerRes;
    return seg * o.sides * 2 +
           (o.caps ? 2 * (o.sides * Math.max(2, o.sides >> 1) * 2) : 0);
  }

  global.TubeLib = { chain, triangles, relax, DEFAULTS };
})(typeof window !== 'undefined' ? window : globalThis);
