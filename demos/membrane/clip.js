/* =============================================================================
 *  membrane/clip.js — cut a baked SES open, and make the cut look like material.
 * =============================================================================
 *  THE PROBLEM THIS EXISTS FOR. tools/ses.js gives a page a solvent-excluded
 *  surface, and surface-test.html shows what that buys: a protein stops being a
 *  ribbon sculpture with gaps to drift between and becomes a solid object. That
 *  is exactly the correction a transport lesson needs — and it is also exactly
 *  what makes a transport lesson impossible to draw, because the ion the
 *  student is following goes INSIDE, and a solid object has no inside.
 *
 *  For a CHANNEL there is a cheap way out: a pore goes all the way through, so
 *  a camera placed on the axis looks straight down it and the surface stays
 *  whole. A pump has no such angle, and that is not a limitation of the
 *  rendering — it is the definition of the machine. An alternating-access
 *  transporter is never open at both ends at once; if it were, the ion would
 *  run back down its gradient and the pump would be a leak. So the cavity is
 *  by construction a dead end, no camera can see into it, and the only honest
 *  way to show the ion inside is to cut the protein open.
 *
 * -----------------------------------------------------------------------------
 *  WHY A CLIPPING PLANE ALONE IS WRONG, AND WHAT THIS ADDS
 * -----------------------------------------------------------------------------
 *  `material.clippingPlanes` is one line and gets you 80% of the way. It also
 *  produces the single most misleading image in this whole design, because a
 *  mesh is a SHELL: clip it and you are looking through the hole at the inside
 *  of the far wall. The protein reads as hollow — a bag with an ion rattling
 *  around in it. That is a worse mental model than the uncut surface was, and
 *  the student cannot tell it is a rendering artefact, because a hollow bag is
 *  a perfectly coherent thing for a picture to be showing.
 *
 *  So the cut face has to be FILLED. The fill is the claim: this protein is
 *  solid, we sliced it, and the cavity you can now see is a real void inside
 *  solid material rather than the inside of a balloon.
 *
 *  The fill cannot be computed from the mesh — the cross-section of an SES is
 *  not a shape the mesh knows, and solving it would mean intersecting every
 *  triangle with the plane and re-triangulating the loops, which is fiddly,
 *  slow, and degenerate exactly where SES surfaces are most interesting (a
 *  cavity's cross-section is several disjoint loops, some of them nested).
 *
 *  The standard answer is the stencil buffer, and it is exact rather than
 *  approximate. Draw the clipped mesh's back faces incrementing stencil and its
 *  front faces decrementing it; any pixel where the count is non-zero is a
 *  pixel where the eye entered the solid and never came out, which is precisely
 *  a pixel that the cut plane passes through material. Fill those. Nested
 *  loops, disjoint cavities and grazing angles all fall out for free, because
 *  the parity argument never mentioned them. (three.js ships this as
 *  webgl_clipping_stencil; the reasoning above is why it is the right tool and
 *  not merely the available one.)
 *
 * -----------------------------------------------------------------------------
 *  WHAT THIS OWNS vs WHAT THE PAGE OWNS — CLAUDE.md's "share the plumbing"
 * -----------------------------------------------------------------------------
 *    page  ·  which protein, which plane (where the biology says to cut),
 *             what the skin and the cut face are COLOURED, when to move it
 *    this  ·  the stencil passes, the cap quad, the render order the three of
 *             them must be drawn in, and keeping the cap on the plane
 *
 *  No THREE global, no scene, no lesson state. Real angstroms in and out, same
 *  as SurfLib.decode, whose `geo` this is built to take directly.
 *
 * -----------------------------------------------------------------------------
 *  THE FOUR THINGS THAT GO WRONG
 * -----------------------------------------------------------------------------
 *   · THE RENDERER MUST HAVE `localClippingEnabled`. It is off by default and
 *     nothing warns you: the clippingPlanes are silently ignored and you get an
 *     uncut protein with an invisible cap floating inside it. create() sets it,
 *     which is why create() wants the renderer at all.
 *   · THE CAP MUST NOT BE CLIPPED BY ITS OWN PLANE. It lies exactly ON the
 *     plane, so a plane that clips it removes it entirely or z-fights it into
 *     noise depending on the float. Its material carries no clippingPlanes.
 *   · ORDER IS LOAD-BEARING, and it is not the order you would guess: stencil
 *     passes, then cap, then skin. The stencil meshes write no colour and no
 *     depth, so they must run before anything tests against them; the cap is
 *     opaque and wants to be in the depth buffer before a translucent skin
 *     composites over it.
 *   · NEVER MOVE A SurfLib GEOMETRY WITH translate()/applyMatrix4(). Its
 *     normals are an interleaved Int8Array, and three transforms normals along
 *     with positions: the floats are written back into int8, every component
 *     truncates, and the surface renders unlit BLACK. It reads as a lighting
 *     bug and it is a destroyed attribute. Move the position array by hand, or
 *     move the parent — and if you move the parent, remember clipping planes
 *     are WORLD space and the cap is parented, so both have to agree.
 *   · A TRANSLUCENT SKIN OVER A STENCIL CAP IS TWO DIFFERENT DEBTS. The cap is
 *     opaque and correct. The skin is the case surface-test.html's "drawing
 *     translucent over opaque" comment already covers — depthWrite off,
 *     FrontSide — and this does not change any of that. It only guarantees the
 *     cap is beneath it.
 * ========================================================================== */
(function (global) {
  'use strict';

  const THREE = global.THREE;

  /* ---------------------------------------------------------------------
     create({ renderer })

     Call once per page, before any section(). The only reason this exists
     as a step rather than being folded into section() is localClipping:
     it is a renderer-wide flag, section() does not otherwise need the
     renderer, and a module that quietly reaches for a global renderer is
     the kind of thing Modules.md says not to write.
     --------------------------------------------------------------------- */
  function create(opts) {
    const renderer = opts && opts.renderer;
    if (!renderer) throw new Error('clip.create needs { renderer }');
    renderer.localClippingEnabled = true;

    /* A renderer built with stencil:false cannot cap, and the failure is
       silent and confusing — the parity passes run, write nothing, and the
       cap covers the entire cross-section rectangle, so the protein gains
       a large flat slab. Better to say so. */
    const ctx = renderer.getContext();
    const bits = ctx.getParameter(ctx.STENCIL_BITS);
    if (!bits) console.warn('clip.js: no stencil buffer — caps will be slabs. ' +
                            'The renderer was built with stencil:false.');
    return { section };
  }

  /* ---------------------------------------------------------------------
     section({ geo, plane, material, capMaterial, radius })

     `geo`      the mesh to cut — SurfLib.decode's `geo` is the intended
                input, but nothing here knows that; any closed mesh works,
                and the parity argument REQUIRES it be closed. An open mesh
                caps as garbage, which is not a bug that can be detected
                here (bake-surface.js is where closure is checked).
     `plane`    a THREE.Plane in the same frame as geo. Kept live: the
                caller may move it and call setPlane, or mutate it and call
                setPlane() with no argument.
     `material` the skin. Cloned, so a caller reusing one material across
                two sections does not get one section's clippingPlanes
                applied to both.
     `radius`   how big the cap quad must be to cover the cross-section.
                Defaults to the geometry's bounding sphere, which is always
                enough and is usually the right answer.

     Returns { group, setPlane, setCapColor, dispose }.
     --------------------------------------------------------------------- */
  function section(o) {
    if (!o || !o.geo || !o.plane) throw new Error('clip.section needs { geo, plane }');

    const geo = o.geo;
    const plane = o.plane;

    if (!geo.boundingSphere) geo.computeBoundingSphere();
    /* 2x, not 1x: the bounding sphere bounds the geometry, but the quad is a
       SQUARE and a square must cover a circle of that radius whatever way the
       plane is turned. A quad sized to the radius clips the cap's own corners
       off at oblique angles, which reads as a bite taken out of the protein. */
    const radius = (o.radius != null ? o.radius : geo.boundingSphere.radius) * 2;

    const group = new THREE.Group();

    /* ---- the two parity passes ----
       Colour and depth are both off: these exist only to leave a count in
       the stencil buffer. IncrementWrap/DecrementWrap rather than the
       saturating ops, because a deeply nested cavity can exceed 8 bits of
       depth on the way in and must come back to zero on the way out. */
    function parityPass(side, op, order) {
      const m = new THREE.MeshBasicMaterial({
        depthWrite: false, depthTest: false, colorWrite: false,
        side: side,
        clippingPlanes: [plane],
        stencilWrite: true,
        stencilFunc: THREE.AlwaysStencilFunc,
        stencilFail: op, stencilZFail: op, stencilZPass: op,
      });
      const mesh = new THREE.Mesh(geo, m);
      mesh.renderOrder = order;
      group.add(mesh);
      return mesh;
    }
    const backPass  = parityPass(THREE.BackSide,  THREE.IncrementWrapStencilOp, 0);
    const frontPass = parityPass(THREE.FrontSide, THREE.DecrementWrapStencilOp, 1);

    /* ---- the cap ----
       DoubleSide because the plane may be viewed from either face as the
       camera orbits, and a single-sided cap vanishes from one half of the
       orbit — which looks exactly like the hollow-shell bug this module
       exists to prevent, only intermittently, which is worse.

       stencilFunc NotEqual 0: fill where the parity says material. The
       Replace ops zero the buffer as it draws, so the next frame starts
       clean even if something upstream turned autoClearStencil off. */
    const capMat = o.capMaterial ? o.capMaterial.clone()
      : new THREE.MeshStandardMaterial({ roughness: .55, metalness: 0 });
    capMat.side = THREE.DoubleSide;
    capMat.clippingPlanes = [];          // see "MUST NOT BE CLIPPED" above
    capMat.stencilWrite = true;
    capMat.stencilRef = 0;
    capMat.stencilFunc = THREE.NotEqualStencilFunc;
    capMat.stencilFail = THREE.ReplaceStencilOp;
    capMat.stencilZFail = THREE.ReplaceStencilOp;
    capMat.stencilZPass = THREE.ReplaceStencilOp;

    const cap = new THREE.Mesh(new THREE.PlaneGeometry(radius, radius), capMat);
    /* The cap is positioned by setPlane, never by the scene graph — it has
       to stay welded to the plane and nothing else may move it. */
    cap.matrixAutoUpdate = false;
    cap.renderOrder = 2;
    group.add(cap);

    /* ---- the skin ---- */
    const skinMat = o.material ? o.material.clone()
      : new THREE.MeshStandardMaterial({ roughness: .35, metalness: 0 });
    skinMat.clippingPlanes = [plane];
    const skin = new THREE.Mesh(geo, skinMat);
    skin.renderOrder = 3;
    group.add(skin);

    /* setPlane(next)
       Re-seats the cap quad on the plane. PlaneGeometry faces +Z, so the
       quad's rotation is the one that takes +Z onto the plane normal, and
       its position is any point on the plane — coplanarPoint gives the
       nearest one to the origin, which keeps the quad centred on the cut
       rather than sliding off it as the plane turns. */
    const _q = new THREE.Quaternion();
    const _p = new THREE.Vector3();
    const Z = new THREE.Vector3(0, 0, 1);
    function setPlane(next) {
      if (next && next !== plane) plane.copy(next);
      _q.setFromUnitVectors(Z, plane.normal);
      plane.coplanarPoint(_p);
      cap.matrix.compose(_p, _q, new THREE.Vector3(1, 1, 1));
      cap.matrixWorldNeedsUpdate = true;
    }
    setPlane();

    function dispose() {
      cap.geometry.dispose();
      [backPass.material, frontPass.material, capMat, skinMat].forEach(m => m.dispose());
    }

    return {
      group, setPlane, dispose,
      cap, skin, plane,
      /* The two materials a page legitimately wants to reach: the skin's
         opacity is how a lesson fades the protein back behind an ion, and
         the cap's colour is how it says "this is cut material, not
         surface". Everything else here is mechanism. */
      skinMaterial: skinMat, capMaterial: capMat,
    };
  }

  global.ClipLib = { create, section };
})(typeof window !== 'undefined' ? window : globalThis);
