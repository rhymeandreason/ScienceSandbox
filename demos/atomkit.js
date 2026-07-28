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
 *    kit.dot(0xd6362e);  kit.cloud('O');  kit.label('O','O','#fff');
 *    kit.cel(meshes, on);
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
    /* depthTest:false — electrons are an OVERLAY, not geometry competing with
     * the spheres. A shared pair sits at a point that is physically inside one
     * of the nuclei, and the student has to be able to count every electron
     * from any angle; occluding half of them behind a nucleus would hide the
     * octet, which is the lesson in both tabs. */
    const dotInk=new THREE.MeshBasicMaterial({ color:INK_HEX, side:THREE.BackSide,
      depthTest:false, depthWrite:false });
    function dot(color){
      const m=new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({
        color:color, transparent:true, opacity:0.95,
        depthTest:false, depthWrite:false }));
      m.renderOrder=20; m.scale.setScalar(0.1);
      // ink ring: an electron wears its atom's colour, so it has to stay legible
      // sitting ON that same atom
      const ring=new THREE.Mesh(dotGeo, dotInk);
      ring.scale.setScalar(1.32); ring.renderOrder=19;
      m.add(ring);
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
     * camera through any orbit, and depthTest:false + a high renderOrder so it
     * is never swallowed by its own sphere, by an overlapping cloud, or by the
     * neighbour once the two are touching — at bonding distance the spheres are
     * a hair apart, so a depth-tested label would flicker in and out at exactly
     * the moment the student is watching. */
    function label(text, el, ink){
      const c=document.createElement('canvas'); c.width=c.height=128;
      const x=c.getContext('2d');
      const size=text.length>1?66:92;
      x.fillStyle=ink||INK; x.font='bold '+size+'px "Zilla Slab", Georgia, serif';
      x.textAlign='center'; x.textBaseline='middle';
      x.fillText(text, 64, 68);
      const s=new THREE.Sprite(new THREE.SpriteMaterial({
        map:new THREE.CanvasTexture(c), transparent:true,
        depthTest:false, depthWrite:false }));
      s.renderOrder=30;                       // above the electron dots (20)
      s.scale.setScalar((P.radii[el]||0.7)*1.6);
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
      s.position.set(r*0.78, r*0.78, 0);
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
      mesh.material = on ? new THREE.MeshToonMaterial(o)
                         : new THREE.MeshStandardMaterial(
                             Object.assign({roughness:.35, metalness:.1}, o));
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

    return { dot, cloud, label, charge, cel, DOT_GAP, INK, INK_HEX };
  }

  global.AtomKit={ create };
})(this);
