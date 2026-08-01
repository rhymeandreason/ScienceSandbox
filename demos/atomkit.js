/* =============================================================================
 *  atomkit.js — how a draggable atom is DRESSED, shared by the bonding lessons
 * =============================================================================
 *  Loaded as a classic script AFTER three.min.js, molecules.js, scene.js.
 *  Exposes window.AtomKit.
 *
 *  This is plumbing, not physics (README: "share the plumbing, not the
 *  physics"). Covalent water and ionic salt are genuinely different mechanics —
 *  one fills valence slots, the other transfers an electron — and they keep
 *  their own modules. What they must NOT differ on is what an electron looks
 *  like, what an atom's letter looks like, or what "the diagram view" means,
 *  because a student moving between the two tabs has to read the second lesson
 *  with the vocabulary the first one taught. Anything a student learns to READ
 *  lives here; anything they learn about BONDING does not.
 *
 *  The conventions this file owns:
 *    · an electron is a small sphere in ITS OWN ATOM'S colour, with an ink ring
 *      so it stays legible sitting on that same atom
 *    · an atom carries its element letter at its centre, always on top
 *    · an atom has a soft cloud that is allowed to overlap its neighbour's
 *    · the 2D view is cel-shaded: flat Toon bands + an ink outline
 *
 *  Usage:
 *    const kit = AtomKit.create(THREE);
 *    kit.dot(0xd6362e);  kit.cloud('O');  kit.cel(meshes, on);
 *    const tag = kit.label('O','O');   // ink chosen by labelInk(), not by you
 *    tag.setDim('2d');                 // …and re-inked when the view flips
 * ========================================================================== */
(function(global){
  'use strict';

  const INK = '#2b2723';
  const INK_HEX = 0x2b2723;

  /* How far a valence electron floats off its atom's surface. One number for
   * every lesson, because a dot that sits at a different height on nitrogen than
   * on oxygen reads as meaning something. Roomy on purpose: tucked against the
   * sphere the dots crowd the outline and there is nowhere to show a pair
   * sitting OFF-centre, which is how polarity gets drawn. */
  const DOT_GAP = 0.34;

  function create(THREE){
    const P=global.MolLib.PALETTE;

    const dotGeo=new THREE.SphereGeometry(1,12,10);
    /* Electrons and letters are drawn WITHOUT depth by default, as an overlay.
     * In 2D that is the whole point — the flat view exists to be counted, and an
     * electron hidden behind a nucleus is an electron missing from the octet.
     *
     * In 3D it is the opposite: overlaid letters and dots from the far side of
     * the molecule float on top of the atoms in front of them, and the picture
     * stops reading as a solid object. So `setDim('3d')` turns depth testing back
     * ON for everything registered here, and setDim('2d') turns it off again.
     *
     * A dot marked {overlay:true} opts out permanently and stays on top in both
     * views. That is for the SHARED PAIR specifically: it sits in the pinch
     * between two surfaces, which for water is 0.92 against an oxygen of radius
     * 0.95 — i.e. physically inside the nucleus. Depth-test it and it does not
     * become subtly occluded, it disappears completely, taking the count that
     * the bond is made of with it. */
    const depthOf=[];               // everything that follows the view's depth mode
    /* The kit remembers the current view, because dots and letters are NOT all
     * made at build time: a shared pair, a rebuilt lone pair and the ionic tab's
     * redrawn electrons are all born mid-lesson, after setDim() has run. Born
     * with a hardcoded default they would keep the wrong depth mode forever,
     * which reads as half the electrons obeying the view and half ignoring it. */
    let curDim='3d';
    const dotInk=new THREE.MeshBasicMaterial({ color:INK_HEX, side:THREE.BackSide,
      depthTest:false, depthWrite:false });
    const dotInkDepth=new THREE.MeshBasicMaterial({ color:INK_HEX, side:THREE.BackSide,
      depthTest:true, depthWrite:false });
    function dot(color, opts){
      const overlay=!!(opts&&opts.overlay);
      const solid=!overlay && curDim!=='2d';
      const m=new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({
        color:color, transparent:true, opacity:0.95,
        depthTest:solid, depthWrite:false }));
      m.renderOrder=20; m.scale.setScalar(0.1);
      // ink ring: an electron wears its atom's colour, so it has to stay legible
      // sitting ON that same atom
      const ring=new THREE.Mesh(dotGeo, solid?dotInkDepth:dotInk);
      ring.scale.setScalar(1.32); ring.renderOrder=19;
      m.add(ring);
      if(!overlay) depthOf.push({ mesh:m, ring });
      return m;
    }

    /* The electron cloud: a soft back-faced shell, so it reads as a haze with a
     * bright rim rather than a solid ball hiding the atom. Clouds are ALLOWED to
     * interpenetrate — two overlapping clouds is what a covalent bond IS, and
     * watching them merge while dragging is the point. (The project's
     * no-intersection rule is about the solid nuclei, which still holds.) */
    function cloud(el){
      const m=new THREE.Mesh(Stage.Rsphere, new THREE.MeshBasicMaterial({
        color:P.atoms[el], transparent:true, opacity:0.13,
        side:THREE.BackSide, depthWrite:false }));
      m.scale.setScalar((P.radii[el]||0.7)*1.85);
      m.renderOrder=-1;
      return m;
    }

    /* The element letter at the atom's centre. A Sprite so it always faces the
     * camera through any orbit, and a high renderOrder so it is never swallowed
     * by its own cloud. Whether it is also depth-TESTED is the view's call, not
     * this function's: flat overlay in 2D, occluded by other atoms in 3D — see
     * setDim() and faceCamera() at the bottom of the file. */
    /* WHICH ink a symbol takes is a property of the VIEW, not of the caller, so
     * the rule lives here and every lesson gets the same answer:
     *
     *   3D — the atom is a saturated sphere and the letter sits on top of it, so
     *        the letter is light. Hydrogen is the exception: its sphere is pale
     *        steel (--H), and white on that is unreadable.
     *   2D — the Lewis view drops the shading, so the letter is dark on paper.
     *        Carbon is the exception, for the mirror-image reason: it stays dark
     *        enough in flat view that dark ink disappears into it.
     *
     * The exceptions are per-element and deliberate; do not "simplify" them into
     * a luminance test, because the answer has to be stable across a lesson, not
     * derived per atom.
     */
    const billboards=[];   // letters AND charge badges: everything sprite-drawn
    const LIGHT='#ffffff', DARK='#2b2b2b';
    function labelInk(el, dim){
      return dim==='2d' ? (el==='C' ? LIGHT : DARK)
                        : (el==='H' ? DARK  : LIGHT);
    }

    function label(text, el, ink){
      const c=document.createElement('canvas'); c.width=c.height=128;
      const x=c.getContext('2d');
      const size=text.length>1?66:92;
      let cur=ink||labelInk(el,'3d');
      // element symbols use the sans stack (--font-sans in sandbox.css), not the
      // slab — a canvas can't read a CSS var, so the stack is repeated here
      function draw(){
        x.clearRect(0,0,128,128);
        x.fillStyle=cur||INK;
        x.font='bold '+size+'px "Proxima Soft", "Proxima Nova", Nunito, -apple-system, '+
               'BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
        x.textAlign='center'; x.textBaseline='middle';
        x.fillText(text, 64, 68);
      }
      draw();
      const tex=new THREE.CanvasTexture(c);
      /* A canvas bakes whatever font is loaded AT DRAW TIME — build the scene
       * before Nunito arrives and every symbol is permanently Helvetica, with
       * nothing on screen to say so. Redraw once the webfonts settle. */
      if(document.fonts&&document.fonts.ready)
        document.fonts.ready.then(()=>{ draw(); tex.needsUpdate=true; });
      const s=new THREE.Sprite(new THREE.SpriteMaterial({
        map:tex, transparent:true,
        depthTest:false, depthWrite:false }));
      s.renderOrder=30;                       // above the electron dots (20)
      s.scale.setScalar((P.radii[el]||0.7)*1.6);
      /* The letter outlives the view it was drawn for — the 2D/3D toggle keeps
       * the same sprites and only moves things — so it has to be able to re-ink
       * itself. A caller that passed an explicit `ink` keeps it: an override is
       * an override in both views. */
      s.userData.lift=(P.radii[el]||0.7)*1.06;   // see faceCamera()
      s.userData.base=new THREE.Vector3();      // the letter sits at the centre
      billboards.push(s);
      s.setDim=function(dim){
        s.material.depthTest=(dim!=='2d');
        if(dim==='2d') s.position.set(0,0,0);
        if(ink) return s;
        const next=labelInk(el,dim);
        if(next===cur) return s;
        cur=next; draw(); tex.needsUpdate=true;
        return s;
      };
      s.setDim(curDim);       // born into the view that is actually on screen
      return s;
    }

    /* A charge badge (+ / −) for an ion. Same overlay rules as the letter, and
     * parked off the atom's shoulder so it never covers the element symbol. */
    function charge(text, color, el, scale){
      const c=document.createElement('canvas'); c.width=c.height=96;
      const x=c.getContext('2d');
      x.fillStyle='rgba(255,255,255,0.94)'; x.beginPath(); x.arc(48,48,40,0,7); x.fill();
      x.lineWidth=6; x.strokeStyle=INK; x.stroke();
      x.fillStyle=color;
      // δ− needs two glyphs in the same circle a bare + gets to itself
      x.font='bold '+(text.length>1?40:66)+'px sans-serif';
      x.textAlign='center'; x.textBaseline='middle'; x.fillText(text,48,51);
      const s=new THREE.Sprite(new THREE.SpriteMaterial({
        map:new THREE.CanvasTexture(c), transparent:true,
        depthTest:false, depthWrite:false }));
      s.renderOrder=31;
      s.scale.setScalar(0.62*(scale||1));
      const r=(P.radii[el]||0.7);
      /* A badge follows the same rule as the letter — solid in 3D, overlay in 2D
       * — but it is parked off the atom's SHOULDER rather than at its centre, and
       * that offset has to survive the lift. So `base` is the shoulder and
       * faceCamera() adds the camera-ward part on top of it; without that a
       * depth-tested badge stays stuck inside its own sphere at most angles, and
       * with only the lift it would slide onto the letter it exists to avoid. */
      s.userData.base=new THREE.Vector3(r*0.78, r*0.78, 0);
      s.userData.lift=r*1.06;
      s.position.copy(s.userData.base);
      s.setDim=function(dim){
        s.material.depthTest=(dim!=='2d');
        if(dim==='2d') s.position.copy(s.userData.base);
        return s;
      };
      billboards.push(s);
      s.setDim(curDim);
      return s;
    }

    /* ---- cel shading, for the 2D view ---------------------------------
     * The two moves the other pages use (water-lab's Debug ▸ Render): swap the
     * lit Standard material for Toon so the sphere reads as flat bands instead
     * of a photographic highlight, and give it an inflated back-face shell for
     * an ink outline. Not decoration — 2D is the DIAGRAM view, and a diagram
     * wants a drawn atom you could copy into a notebook, not a rendered ball.
     * The 3D view keeps the lit spheres, because there the highlight is what
     * tells you which atom is nearer.
     */
    const OUTLINE_GAP=0.05;   // constant world-space thickness, so the outline is
                              // the same weight on small H as on large Cl
    const outlineMat=new THREE.MeshBasicMaterial({color:INK_HEX, side:THREE.BackSide});
    function toonify(mesh, on){
      const m=mesh.material;
      if(!m || m.isMeshBasicMaterial) return;                 // dots, clouds, ghosts
      if(!!m.isMeshToonMaterial===on) return;                 // already right
      const o={color:m.color.getHex(), transparent:m.transparent, opacity:m.opacity};
      /* Coming BACK from 2D, rebuild through Stage.atomMat rather than naming
       * roughness here: this used to carry its own copy of the numbers, so an
       * atom that had been flipped to the diagram view and back came home
       * glossier than one that never left. */
      // …and assign only the flags: `o.color` is a hex NUMBER, and writing that
      // over the material's THREE.Color leaves the shader with a uniform it
      // cannot upload — a blank canvas and a WebGL error, not a wrong tint.
      mesh.material = on ? new THREE.MeshToonMaterial(o)
                         : Object.assign(Stage.atomMat(o.color),
                             {transparent:o.transparent, opacity:o.opacity});
      m.dispose();
    }
    function outline(mesh, on){
      const had=mesh.userData.outline;
      if(on===!!had) return;
      if(on){
        const r=mesh.scale.x||1;
        const o=new THREE.Mesh(mesh.geometry, outlineMat);    // shares the unit sphere
        o.scale.setScalar((r+OUTLINE_GAP)/r);                 // child scale is relative
        mesh.add(o); mesh.userData.outline=o;
      }else{ mesh.remove(had); mesh.userData.outline=null; }
    }
    // atoms get both; sticks pass outlined:false, because an outlined cylinder
    // reads as a second bond running alongside the first
    function cel(meshes, on, outlined){
      meshes.forEach(m=>{ if(!m) return;
        toonify(m,on);
        if(outlined!==false) outline(m,on);
      });
    }

    /* One call for everything that changes between the two views: which ink the
     * letters take, and whether letters and electrons are solid or overlay.
     * Callers still own the geometry; this owns the drawing conventions. */
    function setDim(dim){
      curDim=(dim==='2d')?'2d':'3d';
      const depth=(dim!=='2d');
      billboards.forEach(s=>s.setDim(dim));
      depthOf.forEach(d=>{
        d.mesh.material.depthTest=depth;
        d.ring.material=depth?dotInkDepth:dotInk;
      });
    }

    /* A depth-tested letter sitting at its atom's CENTRE is inside the sphere,
     * which hides it completely — the opposite of legible. So in 3D each sprite
     * rides just proud of its own front surface, recomputed per frame because
     * "front" is wherever the camera has orbited to. It is then occluded by
     * every OTHER atom, which is the whole point, while never by its own.
     * No-op in 2D, where the letters are a flat overlay again.
     * The offset runs along the camera's VIEW AXIS, not toward the camera's
     * position, and the difference is not academic. A sprite is a billboard: the
     * whole quad carries the view-space depth of its centre. Offsetting toward
     * the camera position shortens that depth only by cos(off-axis angle), so an
     * atom out near the edge of frame lifts by less than its own radius and its
     * sphere eats the letter from one side — which is exactly what chlorine did.
     * Along the view axis the depth gain is the full lift, wherever the atom sits.
     */
    const _v=new THREE.Vector3(), _d=new THREE.Vector3(), _mat=new THREE.Matrix4();
    function faceCamera(camera){
      camera.getWorldDirection(_d).negate();      // scene → camera, in world space
      billboards.forEach(s=>{
        if(!s.material.depthTest || !s.parent) return;
        _v.copy(_d).transformDirection(
          _mat.copy(s.parent.matrixWorld).invert());
        /* Solve for the along-axis distance rather than just adding the lift: a
         * badge's shoulder offset has its OWN component along the view axis, and
         * once the camera orbits past that shoulder the offset points away from
         * the viewer and cancels part of the lift — the badge sinks back into its
         * own sphere at exactly the angles where it is hardest to notice. Cancel
         * that component first and every sprite ends up the same lift proud of
         * its atom's centre, from every angle, keeping its lateral placement. */
        const base=s.userData.base;
        s.position.copy(base)
                  .addScaledVector(_v, s.userData.lift - base.dot(_v));
      });
    }

    /* A lesson that throws a dot or a letter away tells the kit, so the
     * registries track what is on screen rather than everything ever made. The
     * ionic tab redraws its electrons on every count change and every view flip,
     * so this is not housekeeping for its own sake. */
    /* Move a badge off its default shoulder. Callers must go through this rather
     * than assigning .position, because in 3D faceCamera() rewrites .position
     * every frame — it adds the camera-ward lift to `base`, and a caller's own
     * placement would be overwritten on the next tick. (covalent-drag parks each
     * δ badge on the far side of its ligand, pointing away from the core; the
     * default shoulder aims at the core on half the bonds, straight into the
     * shared pair the badge exists to explain.) */
    function place(sprite, v){
      if(!sprite) return sprite;
      if(sprite.userData.base) sprite.userData.base.copy(v);
      sprite.position.copy(v);
      return sprite;
    }

    function forget(m){
      const i=depthOf.findIndex(d=>d.mesh===m); if(i>=0) depthOf.splice(i,1);
      const j=billboards.indexOf(m); if(j>=0) billboards.splice(j,1);
    }
    function clear(){ billboards.length=0; depthOf.length=0; }

    return { dot, cloud, label, labelInk, charge, place, cel, setDim, faceCamera, forget, clear,
             DOT_GAP, INK, INK_HEX };
  }

  global.AtomKit={ create };
})(this);
