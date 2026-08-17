/* =============================================================================
 *  salmon/parts.js — the membrane and its machines, built from numbers.
 * =============================================================================
 *  WHY THIS EXISTS, GIVEN THAT WE HAVE THE REAL SURFACE. salmon/clip.js and
 *  tools/bake-pump.js produce an honest solvent-excluded surface of the actual
 *  pump, cut open, in a measured bilayer. That work settled what is TRUE, and
 *  it stays in the lesson as the aside that says "this is what the cartoon
 *  stands in for". But it cannot carry the lesson, for one hard reason and one
 *  soft one:
 *
 *    HARD  · a baked mesh cannot deform. The whole subject here is a protein
 *            CHANGING SHAPE — that is what a pump is. A surface that can only
 *            cross-fade between two frozen states can show the endpoints and
 *            never the mechanism.
 *    SOFT  · 160k triangles of real protein read as a lump. A student who has
 *            never seen a molecular surface cannot tell the binding site from
 *            any other dimple, and every textbook they have ever opened drew
 *            this as a smooth shape with a hole in it.
 *
 *  So the lesson's machines are procedural: a few numbers, a profile curve, and
 *  a revolution. Animating them is moving the numbers.
 *
 * -----------------------------------------------------------------------------
 *  THE ONE IDEA: A TRANSPORTER IS A PROFILE WITH TWO GATES
 * -----------------------------------------------------------------------------
 *  Look at any textbook carrier — BioRender's, StudySmarter's, anyone's. It is
 *  a two-dimensional silhouette with a funnel cut into it. That is a LATHE: a
 *  profile in the (r, y) half-plane, spun about the membrane normal.
 *
 *  Two functions define everything:
 *
 *    Ro(y)   the outside. A rounded barrel spanning the bilayer.
 *    Ri(y)   the cavity. Zero where the protein is solid on its axis.
 *
 *  and the contour is simply: up the outside, back down the inside, closed.
 *  Where Ri is zero the contour touches the axis and the protein is solid
 *  there; where Ri is positive there is a lumen.
 *
 *  Ri is built from three pieces that are MAXED together, not added:
 *
 *    pocket(y)     a bulge at mid-membrane. Always present. This is the
 *                  binding site, and it is why an occluded transporter still
 *                  has somewhere for the ion to be.
 *    throatUp(y)   a funnel widening from the site to the outer mouth.
 *    throatDown(y) the same, downward.
 *
 *  Each throat is scaled by its GATE, 0..1. And that is the entire mechanism:
 *
 *    gates (1, 0)  outward-open   — mouth up, sealed below
 *    gates (0, 0)  OCCLUDED       — sealed both ends, ion in a closed pocket
 *    gates (0, 1)  inward-open    — mouth down, sealed above
 *    gates (1, 1)  a CHANNEL      — open through, which is exactly why a
 *                                   channel is not a pump: it cannot do this
 *                                   one thing, refuse to be open at both ends.
 *
 *  That last line is the lesson. The difference between the leak and the pump
 *  is a constraint on two numbers, and a student can break it by hand and watch
 *  the gradient collapse. Nothing about that is available from a baked surface.
 *
 * -----------------------------------------------------------------------------
 *  WHAT IS EXAGGERATED, DECLARED HERE AS SCIENCE.md REQUIRES
 * -----------------------------------------------------------------------------
 *   · IONS ARE DRAWN OVERSIZE. Na+ is 1.02 A against a pump ~150 A tall. At
 *     true scale the thing the student is following is a third of a pixel.
 *     `ION.exaggeration` is the factor and it is ONE number, applied to every
 *     ion equally, so the RELATIVE sizes stay true — K+ still reads bigger than
 *     Na+, which the lesson needs, because the pump's two site types tell them
 *     apart by size. Exaggerated, not falsified.
 *   · THE PROTEIN'S SHAPE IS INVENTED. Ro and Ri are not measured from 7E1Z.
 *     The bilayer thickness IS measured (bake-pump.js, from OPM) and the
 *     protein's height and width are set to the real one's, so the proportions
 *     are right even though the silhouette is not. A student who later sees the
 *     SES aside should recognise the same object, not a different one.
 *   · A LATHE IS ROTATIONALLY SYMMETRIC AND NO PROTEIN IS. This is the honest
 *     cost of the whole approach. It buys a cavity that is guaranteed closed,
 *     which is what clip.js's parity capping needs, and a shape that morphs by
 *     construction. `lobes` breaks the symmetry cosmetically without touching
 *     the cavity, so it never lies about the lumen.
 *
 * -----------------------------------------------------------------------------
 *  WHAT THIS OWNS vs WHAT THE PAGE OWNS
 * -----------------------------------------------------------------------------
 *    page  ·  which machines exist, where they sit, what the gates DO over
 *             time, what anything is called, when a step has run
 *    this  ·  the geometry, the materials, and setGates() being continuous so
 *             a page can drive it from any easing curve it likes
 *
 *  Loaded after scene.js (it honours Stage.toon). Exposes window.Parts.
 * ========================================================================== */
(function (global) {
  'use strict';

  const THREE = global.THREE;

  /* ---------------------------------------------------------------------
     Materials. Textbook-flat: saturated, matte, no specular hotspot. A
     highlight on these shapes reads as wet plastic and fights the flat
     colour that makes them legible. Follows Stage.toon so the whole page
     switches register together.
     --------------------------------------------------------------------- */
  function flat(color, opts) {
    const o = opts || {};
    const M = (global.Stage && global.Stage.toon)
      ? new THREE.MeshToonMaterial({ color })
      : new THREE.MeshStandardMaterial({ color, roughness: .95, metalness: 0 });
    if (o.transparent) { M.transparent = true; M.opacity = o.opacity != null ? o.opacity : .5; }
    if (o.side) M.side = o.side;
    return M;
  }

  /* An outline as a back-face shell. Textbook art is line art, and without
     a contour these shapes lose their edge against each other — two pale
     blobs overlapping become one blob. Cheap, and it needs no post pass. */
  function outline(mesh, color, grow) {
    const m = new THREE.Mesh(mesh.geometry, new THREE.MeshBasicMaterial({
      color: color != null ? color : 0x24323d, side: THREE.BackSide }));
    m.scale.setScalar(1 + (grow != null ? grow : 0.035));
    m.renderOrder = (mesh.renderOrder || 0) - 1;
    return m;
  }

  const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
  const smooth = t => { t = clamp01(t); return t * t * (3 - 2 * t); };

  /* =====================================================================
     transporter(opts) — the lathe, and everything that moves.

       half        bilayer half-thickness. The protein spans it and stands
                   `over` beyond each leaflet.
       radius      outer radius at mid-membrane
       site        radius of the binding pocket
       mouth       radius of a fully open mouth
       wall        minimum material between lumen and outside. Load-bearing:
                   without it a wide mouth eats through the side wall and the
                   protein develops a hole in its flank.
       rings/segs  tessellation
       lobes       cosmetic symmetry-breaking, 0 = a clean solid of revolution

     Returns { group, mesh, setGates, gates, dispose }.
     ===================================================================== */
  function transporter(opts) {
    const o = Object.assign({
      half: 15.3, over: 14, radius: 14.5, site: 3.2, mouth: 7.4, wall: 3.0,
      rings: 96, segs: 56, lobes: 0, lobeDepth: .06,
      /* Cool against the membrane's warm, which is the first illustration's
         scheme and the reason it reads at a glance: a protein the colour of
         its lipids is a protein you have to hunt for. */
      color: 0x4f9db5, outlineColor: 0x28596b, outline: true,
    }, opts);

    const H = o.half + o.over;                 // half-height of the protein
    const rings = o.rings, segs = o.segs;
    const nContour = rings * 2;                // outer up, inner back down

    let gTop = 1, gBot = 0;

    /* ---- the two profile functions ---- */

    /* Outside: a barrel with rounded shoulders. `cap` is how much of the
       half-height is spent rounding, so the ends are domed rather than
       cut flat — a flat end reads as a cylinder someone sawed. */
    function Ro(y) {
      const u = Math.abs(y) / H, cap = 0.30;
      let s = 1;
      if (u > 1 - cap) {
        const t = (u - (1 - cap)) / cap;       // 0 at the shoulder, 1 at the pole
        s = Math.sqrt(Math.max(0, 1 - t * t));
      }
      /* Slight waist at the bilayer mid-plane: real transporters are
         narrowest where the lipid is thinnest, and it reads as "gripped
         by the membrane" rather than "pushed through a hole". */
      const waist = 1 - 0.07 * Math.exp(-((y / (o.half * .8)) ** 2));
      return o.radius * s * waist;
    }

    /* Inside: pocket, plus whichever throats their gates have opened. */
    function Ri(y) {
      const pocket = o.site * Math.exp(-((y / (o.half * .42)) ** 2));

      /* A throat starts at the site and widens to the mouth at the pole.
         smooth() rather than linear so the lumen eases open — a linear
         funnel has a visible crease where it leaves the pocket. */
      const up   = y <= 0 ? 0 : o.mouth * smooth(y / H);
      const down = y >= 0 ? 0 : o.mouth * smooth(-y / H);

      let r = Math.max(pocket, gTop * up, gBot * down);

      /* Never eat the wall. Without this the mouth wins at the poles,
         where Ro is already shrinking into its dome, and the protein
         opens a ring-shaped hole through its own shoulder. */
      return Math.min(r, Math.max(0, Ro(y) - o.wall));
    }

    /* ---- geometry ----
       Built by hand rather than with LatheGeometry so setGates can rewrite
       positions in place. Rebuilding a lathe every frame of a transition
       allocates a new geometry per frame; this allocates none. */
    const geo = new THREE.BufferGeometry();
    const nVert = nContour * (segs + 1);
    const pos = new Float32Array(nVert * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));

    const idx = [];
    for (let i = 0; i < nContour; i++) {
      const i2 = (i + 1) % nContour;           // wrap: the contour is closed
      for (let j = 0; j < segs; j++) {
        const a = i * (segs + 1) + j, b = i2 * (segs + 1) + j;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    geo.setIndex(idx);

    const mesh = new THREE.Mesh(geo, flat(o.color));
    const group = new THREE.Group();
    group.add(mesh);
    if (o.outline) group.add(outline(mesh, o.outlineColor));

    /* contourAt(i) -> [r, y]. The first `rings` points run up the outside
       from the bottom pole to the top; the next `rings` come back down the
       inside. Poles are included so the surface closes on the axis when a
       gate is shut. */
    function contourAt(i) {
      if (i < rings) {
        const y = -H + (2 * H) * (i / (rings - 1));
        return [Ro(y), y];
      }
      const k = i - rings;
      const y = H - (2 * H) * (k / (rings - 1));
      return [Ri(y), y];
    }

    function rebuild() {
      for (let i = 0; i < nContour; i++) {
        const [r, y] = contourAt(i);
        for (let j = 0; j <= segs; j++) {
          const th = (j / segs) * Math.PI * 2;
          /* Lobes ripple the RADIUS of the outer wall only. The inner wall
             is left perfectly round because the lumen is a claim about
             where the ion can be, and a rippled lumen would be a claim we
             have no basis for. */
          const lobe = (i < rings && o.lobes)
            ? 1 + o.lobeDepth * Math.cos(o.lobes * th) : 1;
          const v = (i * (segs + 1) + j) * 3;
          pos[v]     = r * lobe * Math.cos(th);
          pos[v + 1] = y;
          pos[v + 2] = r * lobe * Math.sin(th);
        }
      }
      geo.attributes.position.needsUpdate = true;
      geo.computeVertexNormals();
      geo.computeBoundingSphere();
    }

    /* setGates(top, bottom) — both in 0..1, continuous, no snapping. A page
       drives this from whatever easing it likes; the shape is defined at
       every intermediate value, which is what makes the occluded state a
       real position on the path rather than a third model. */
    function setGates(top, bottom) {
      gTop = clamp01(top); gBot = clamp01(bottom);
      rebuild();
    }
    setGates(gTop, gBot);

    return {
      group, mesh, setGates, geometry: geo,
      get gates() { return { top: gTop, bottom: gBot }; },
      /* The page needs to know where the ion belongs. This is the pocket
         centre, in the transporter's own frame — mid-membrane, on axis. */
      site: new THREE.Vector3(0, 0, 0),
      dispose() { geo.dispose(); mesh.material.dispose(); },
    };
  }

  /* =====================================================================
     membrane(opts) — head groups and tails, the way the textbook draws it.

     `exclude(x, z)` returns the distance from that column to the nearest
     protein, so lipids can be left out where a machine stands. Passing
     nothing fills the whole patch.

     SHAPE IS THE DECISION THAT MAKES THIS READ. A full disc of lipids is
     what a membrane really is and it is unusable: the near half stands
     between the camera and the machine, and the lesson's subject spends
     the whole animation behind a picket fence of tails. Every textbook
     draws a CROSS-SECTION for exactly this reason.

       'slab'  a band `depth` deep in z — a cutaway with enough thickness
               to still be a solid object when the camera moves. Default,
               and what a lesson should use.
       'disc'  the honest full patch. Correct, and it will hide your
               protein. Kept because a page that wants to look down the
               membrane normal needs it.

     AND IT OWNS THE CUT PLANE, because it is the only thing that knows
     which way the slab runs. A page that picks its own normal picks the
     wrong one: cutting a slab along its LENGTH slices the bilayer in half
     lengthwise and leaves a stub beside the protein, which is what this
     page did until the geometry was looked at rather than assumed. The
     thin axis is the one to cut across, membrane() laid it out, so
     membrane() hands back the plane and everything else borrows it.
     ===================================================================== */
  function membrane(opts) {
    const o = Object.assign({
      /* `reach` is framing, not fact — a membrane has no edge. Wide enough
         to say "this continues past the frame" and no wider: at 78 the
         bilayer became the subject and the machine in it an ornament. */
      half: 15.3, reach: 46, pitch: 7.2, headR: 2.7, clear: 4.5,
      shape: 'slab', depth: 13,
      head: 0xe0705c, tail: 0xf0c98a, outline: true, exclude: null,
    }, opts);

    const g = new THREE.Group();
    const cols = [];
    const zLimit = o.shape === 'slab' ? o.depth : o.reach;
    for (let x = -o.reach; x <= o.reach; x += o.pitch)
      for (let z = -zLimit; z <= zLimit; z += o.pitch) {
        if (o.shape !== 'slab' && Math.hypot(x, z) > o.reach) continue;
        if (o.exclude && o.exclude(x, z) < o.clear) continue;
        cols.push([x, z]);
      }

    const headGeo = new THREE.SphereGeometry(o.headR, 12, 9);
    const headMat = flat(o.head);
    /* Two tails per head, as the diagrams draw them — one tail reads as a
       lollipop and the doubled tail is most of what makes a phospholipid
       recognisable. They are straight: a kinked unsaturated tail is a real
       and different fact (contrast-lab owns that pair) and drawing kinks
       here would be making a claim this lesson is not making. */
    const tailGeo = new THREE.CylinderGeometry(0.55, 0.45, o.half - o.headR * .5, 6);
    const tailMat = flat(o.tail);

    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), Sc = new THREE.Vector3(1,1,1);
    for (const sign of [1, -1]) {
      const heads = new THREE.InstancedMesh(headGeo, headMat, cols.length);
      const tails = new THREE.InstancedMesh(tailGeo, tailMat, cols.length * 2);
      cols.forEach(([x, z], i) => {
        M.compose(new THREE.Vector3(x, sign * o.half, z), Q, Sc);
        heads.setMatrixAt(i, M);
        [-1, 1].forEach((k, t) => {
          M.compose(new THREE.Vector3(x + k * 0.95, sign * (o.half / 2), z), Q, Sc);
          tails.setMatrixAt(i * 2 + t, M);
        });
      });
      heads.instanceMatrix.needsUpdate = true;
      tails.instanceMatrix.needsUpdate = true;
      g.add(heads, tails);
    }
    g.userData.materials = [headMat, tailMat];

    /* ---- the cut ----
       Normal points at the camera side, so the half REMOVED is the near
       one and the viewer is left looking at the cut face. For a slab the
       thin axis is z. For a disc there is no thin axis and no right
       answer; z is returned so the API is uniform, and a disc being cut
       at all is already a page doing something unusual. */
    const normal = new THREE.Vector3(0, 0, -1);
    const plane = new THREE.Plane(normal.clone(), 0);
    let cutOn = false;

    function enable(on) {
      cutOn = !!on;
      g.userData.materials.forEach(m => {
        m.clippingPlanes = cutOn ? [plane] : [];
        m.needsUpdate = true;
      });
    }
    /* at(d): slide the cut along its own normal. d = 0 is the mid-plane,
       which is where a cross-section wants to be; positive moves the cut
       away from the camera. */
    function at(d) { plane.constant = d; }

    return {
      group: g, materials: g.userData.materials, columns: cols.length,
      half: o.half, shape: o.shape,
      cut: { plane, normal, enable, at, get on() { return cutOn; } },
    };
  }

  /* =====================================================================
     ions — oversize, and the factor is one number for all of them.
     ===================================================================== */
  const ION = {
    /* Shannon six-coordinate ionic radii, in A. These are the TRUE numbers
       and they are what `exaggeration` multiplies, so relative size — the
       fact that K+ is half again bigger than Na+ — survives intact. */
    NA: { r: 1.02, color: 0x7b5cf0, label: 'Na⁺' },
    K:  { r: 1.38, color: 0xf0a03c, label: 'K⁺' },
    CL: { r: 1.81, color: 0x63c26b, label: 'Cl⁻' },
    MG: { r: 0.72, color: 0x3cc98f, label: 'Mg²⁺' },
    /* Not an ion, and deliberately grey: water is the thing that moves
       when nothing is pushing it, and it should never be mistaken for
       cargo the pump is choosing. */
    HOH:{ r: 1.40, color: 0x9fb9c9, label: 'H₂O' },
    exaggeration: 2.6,
  };

  function ion(name, opts) {
    const o = Object.assign({ exaggeration: ION.exaggeration, outline: true }, opts);
    const spec = ION[name];
    if (!spec) throw new Error(`parts.ion: no such species ${name}`);
    const r = spec.r * o.exaggeration;
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 22, 16), flat(spec.color));
    m.userData = { species: name, trueRadius: spec.r, drawnRadius: r, label: spec.label };
    if (!o.outline) return m;
    const g = new THREE.Group();
    g.add(m, outline(m, 0x24323d, .10));
    g.userData = m.userData;
    return g;
  }

  global.Parts = { transporter, membrane, ion, ION, flat, outline };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.Parts;
})(typeof window !== 'undefined' ? window : globalThis);
