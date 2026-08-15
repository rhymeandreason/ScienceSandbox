/* =============================================================================
 *  scene.js — shared 3D stage + molecule builder for the simulation pages
 * =============================================================================
 *  The boring-but-universal scaffolding every page re-implemented: renderer,
 *  scene, camera + orbit controls, studio lights, resize. Plus a clean molecule
 *  builder (materials + atom/bond/buildMolecule) for pages that assemble and
 *  transform molecules.
 *
 *  Loaded as a classic script AFTER three.min.js and molecules.js. Exposes
 *  window.Stage. Deliberately knows NOTHING about any particular lesson's
 *  physics — solvation (createWaterSim), pathways, membranes, etc. are built per
 *  page on top of this. See SCIENCE.md §6 for the architecture rationale.
 *
 *  Usage:
 *    const {scene,camera,renderer,root,cam,applyCam,resize}=Stage.create(canvas,{
 *      cam:{theta:0,phi:1.2,r:16}, onZoom:r=>..., onDrag:()=>...
 *    });
 *    const g = Stage.buildMolecule(MolLib.MOLECULES.glycine);   // atoms+bonds group
 *    root.add(g);  // ...then render camera each frame yourself
 * ========================================================================== */
(function(global){
  'use strict';
  const THREE=global.THREE;

  /* ---- material system (Standard by default; optional cel-shaded Toon) ---- */
  let toon=false;
  function setToon(b){ toon=!!b; }
  /* Atoms are MATTE. roughness .35 + a touch of metalness gave every sphere a
   * small hard highlight, and at these sizes that reads as wet plastic — worse,
   * on a big atom the hotspot competes with the element letter sitting right
   * next to it. Broad diffuse shading still says which atom is nearer, which is
   * the only job the lighting has here. */
  function atomMat(color){ return toon
    ? new THREE.MeshToonMaterial({color})
    : new THREE.MeshStandardMaterial({color,roughness:.92,metalness:0}); }
  function bondMat(color){ return toon
    ? new THREE.MeshToonMaterial({color})
    : new THREE.MeshStandardMaterial({color,roughness:.5}); }
  function glowMat(color,ei){ return toon
    ? Object.assign(new THREE.MeshToonMaterial({color,emissive:color}),{emissiveIntensity:ei})
    : new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:ei,roughness:.4}); }

  /* ---- geometry primitives ---- */
  const Rsphere=new THREE.SphereGeometry(1,32,24);
  // one atom sphere. `role` tags the mesh with its element so downstream code
  // (fx.js colorOf/popGlow, per-page recolouring) can find atoms vs. bonds.
  function atom(color,radius,pos,role){
    const m=new THREE.Mesh(Rsphere,atomMat(color));
    m.scale.setScalar(radius); if(pos)m.position.copy(pos);
    if(role) m.userData.role=role;
    return m;
  }
  // one covalent stick (or pair for double bond) between two points.
  function bond(a,b,color,rad=0.14,order=1,perpHint=null){
    const dir=new THREE.Vector3().subVectors(b,a), len=dir.length();
    const normDir=dir.clone().normalize();
    if(order===2){
      const g=new THREE.Group();
      g.userData.role='covalent';
      let perp=perpHint?perpHint.clone():null;
      if(!perp || perp.lengthSq()<0.001){
        // A LINEAR molecule (CO2) has no neighbouring bond to define a plane, so
        // any perpendicular is geometrically arbitrary — but not visually. Offset
        // the pair ACROSS the view, not along it: crossing with +Z for a bond that
        // isn't already pointing at the camera splays the sticks vertically, so the
        // double bond reads as double from the default angle instead of hiding one
        // stick directly behind the other.
        const helper=Math.abs(normDir.z)<0.9?new THREE.Vector3(0,0,1):new THREE.Vector3(0,1,0);
        perp=new THREE.Vector3().crossVectors(normDir,helper);
      }
      perp.normalize();
      const offset=0.15;
      const r2=rad*0.75;
      [-offset, offset].forEach(off=>{
        const shift=perp.clone().multiplyScalar(off);
        const aOff=a.clone().add(shift);
        const m=new THREE.Mesh(new THREE.CylinderGeometry(r2,r2,len,16),bondMat(color));
        m.userData.role='covalent';
        m.position.copy(aOff).add(dir.clone().multiplyScalar(.5));
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),normDir);
        g.add(m);
      });
      return g;
    }
    const m=new THREE.Mesh(new THREE.CylinderGeometry(rad,rad,len,16),bondMat(color));
    m.userData.role='covalent';
    m.position.copy(a).add(dir.clone().multiplyScalar(.5));
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),normDir);
    return m;
  }

  // Clean molecule builder from a molecules.js spec. Tracks per-atom AND per-bond
  // meshes (each bond stamped with its atom `pair`) so a reaction can pull specific
  // atoms/bonds out later — e.g. the leaving –OH/–H of a peptide condensation.
  // Colours/radii come from MolLib.PALETTE. Pages layer their own userData
  // (hydration sites, peptide metadata, …) on top of what's returned here.
  function buildMolecule(spec, opts={}){
    const P=global.MolLib.PALETTE, state=P.atoms;
    const g=new THREE.Group();
    const atomMeshes=spec.atoms.map(a=>atom(state[a.el]||0x888888, P.radii[a.el]||0.7,
      new THREE.Vector3(a.pos[0],a.pos[1],a.pos[2]), a.el));
    const bondCol=opts.bondColor!=null?opts.bondColor:P.bonds.covalent;
    const bondMeshes=(spec.bonds||[]).map(bSpec=>{
      const i=bSpec[0], j=bSpec[1], order=bSpec[2]||1;
      const posI=new THREE.Vector3().fromArray(spec.atoms[i].pos);
      const posJ=new THREE.Vector3().fromArray(spec.atoms[j].pos);
      let perpHint=null;
      if(order===2){
        const kBond=(spec.bonds||[]).find(b=>(b[0]===i||b[1]===i||b[0]===j||b[1]===j) && !(b[0]===i&&b[1]===j) && !(b[0]===j&&b[1]===i));
        if(kBond){
          const kIdx=[kBond[0],kBond[1]].find(idx=>idx!==i && idx!==j);
          if(kIdx!=null){
            const posK=new THREE.Vector3().fromArray(spec.atoms[kIdx].pos);
            const bondVec=new THREE.Vector3().subVectors(posJ,posI).normalize();
            const otherVec=new THREE.Vector3().subVectors(posK,posI).normalize();
            const planeNorm=new THREE.Vector3().crossVectors(bondVec,otherVec);
            if(planeNorm.lengthSq()>0.001){
              perpHint=new THREE.Vector3().crossVectors(planeNorm,bondVec).normalize();
            }
          }
        }
      }
      const m=bond(posI, posJ, bondCol, 0.14, order, perpHint);
      m.userData.pair=[i,j]; return m;
    });
    bondMeshes.forEach(m=>g.add(m));
    atomMeshes.forEach(m=>g.add(m));
    // YXZ, so a page that both leans and spins a molecule gets a turntable
    // rather than a tumble: the default XYZ composes as RX*RY, applying the spin
    // in the model's own frame and then leaning the spin axis over with it.
    // Harmless where only rotation.y is set, which is every other page today.
    g.rotation.order='YXZ';
    // opts.center puts the group's origin at the middle of the molecule so it
    // turns on the spot rather than orbiting its build origin. Opt-in: pages
    // that place molecules by their spec origin would shift if it were default.
    //
    // `true` centres on the bounding box. An explicit [x,y,z] centres on a point
    // the caller chooses — which is how a comparison page registers two
    // molecules against each other: centred on their own boxes, two specs that
    // differ by one atom have different boxes, so their SHARED skeleton lands in
    // slightly different places and the eye reads a shift that is not the
    // difference. Centring both on the part they have in common removes it.
    let center=null;
    if(opts.center){
      center=Array.isArray(opts.center)?opts.center:centerOf(spec);
      g.children.forEach(ch=>{ ch.position.x-=center[0]; ch.position.y-=center[1]; ch.position.z-=center[2]; });
    }
    // PRESENTATION ORIENTATION. `spec.view` is [x,y,z] radians saying which way
    // this molecule should face — the angle that makes a pyranose read as a 3/4
    // chair rather than a flat hexagon. It used to be baked into the atom
    // coordinates by Skel.rotate(), which meant the spec's numbers were a view
    // rather than the molecule, two specs could only share a view by copying
    // three constants, and a page could not ask for a different one.
    //
    // Applied to the MESHES, not to the group's rotation: the group's rotation
    // belongs to the page (idle spin, the user's drag), and composing the two
    // there is exactly the Euler-order trap that made molecules cartwheel.
    // Baking it here instead keeps that free, and keeps atom/bond meshes as
    // direct children so removeAtoms() and friends still work.
    //
    // WHICH LEAVES THE PAGE ONE OBLIGATION: that rotation is an OFFSET, and it
    // must be ZERO AT REST. A spec's `view:` is a declaration about how the
    // molecule should be seen; anything composed on top of it at rest means the
    // declared angle is one nobody ever sees, while the file still says
    // otherwise. contrast-lab.html holds to it by construction
    // (`rotation.y=spin` — 0 at rest); molecule-viewer.html broke it twice, and
    // is fixed by routing every opening angle through one function
    // (molview.js's defaultView) rather than by checking afterwards — a check
    // downstream of the spec derives its expectation from the same field it is
    // checking, so it cannot see a view that never arrived. CLAUDE.md carries
    // the rule.
    //
    // Pass opts.view to override, or null for the spec's canonical coordinates.
    const view = opts.view!==undefined ? opts.view : spec.view;
    if(view){
      // 'ZYX' composes as RZ*RY*RX, which is the order Skel.rotate() applied
      // when these were baked — so a migrated spec renders identically.
      const q=new THREE.Quaternion().setFromEuler(
        new THREE.Euler(view[0]||0, view[1]||0, view[2]||0, 'ZYX'));
      g.children.forEach(ch=>{
        ch.position.applyQuaternion(q);      // where it sits
        ch.quaternion.premultiply(q);        // and which way it points (bonds)
      });
    }
    g.userData={ spec, atomMeshes, bondMeshes, center,
      atomWorld:i=>atomMeshes[i].getWorldPosition(new THREE.Vector3()) };
    return g;
  }
  // Move an existing bond mesh onto a new pair of endpoints. A stick's LENGTH is
  // baked into its geometry, so a molecule whose atoms move (a conformational
  // change animated frame by frame, rather than a swap between two specs) needs
  // its bonds re-placed and re-stretched rather than rebuilt — rebuilding per
  // frame would churn geometries and materials at 60Hz.
  // Single sticks only: a double bond is a Group whose two children carry a
  // perpendicular offset chosen from a neighbour, and that plane is not
  // recoverable from the two endpoints alone. Callers animating a molecule with
  // double bonds must rebuild those.
  function placeBond(mesh,a,b){
    if(mesh.isGroup) return false;
    const dir=new THREE.Vector3().subVectors(b,a), len=dir.length();
    if(!len) return false;
    const base=mesh.geometry.parameters && mesh.geometry.parameters.height;
    mesh.position.copy(a).addScaledVector(dir,0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), dir.clone().normalize());
    if(base) mesh.scale.y=len/base;
    return true;
  }

  // remove atoms (and any bond touching them) from a built molecule — the leaving
  // group of a reaction. Nulls the atomMeshes slot so indices stay stable.
  function removeAtoms(g,idxs){
    const set=new Set(idxs), u=g.userData;
    idxs.forEach(i=>{ const m=u.atomMeshes[i]; if(m) g.remove(m); u.atomMeshes[i]=null; });
    u.bondMeshes=u.bondMeshes.filter(bm=>{
      if(bm.userData.pair.some(p=>set.has(p))){ g.remove(bm); return false; } return true; });
  }

  /* ---- presentation: how big a molecule is, and where to put the camera ----
   *
   *  Framing used to be a hand-tuned constant per page (`r:26`), guessed against
   *  one molecule at one viewport, and the extent maths behind it was copied
   *  between pages. Both belong here: how large a molecule is, and how far back
   *  you must stand to see it, are properties of the geometry and the lens — not
   *  decisions a lesson should have an opinion about.
   */

  // Bounding-box centre of a spec, INCLUDING display radii. This is the point to
  // spin about: a spec's coordinates sit around wherever its build started (a
  // ring's centre, a chain's first atom), which is not the middle of the
  // finished molecule, and turning about that makes it orbit rather than rotate.
  // Bounding box rather than mean atom position, which dense clusters of
  // hydrogens drag off-centre.
  function centerOf(spec){
    const P=global.MolLib.PALETTE.radii;
    const lo=[Infinity,Infinity,Infinity], hi=[-Infinity,-Infinity,-Infinity];
    spec.atoms.forEach(a=>{ const R=P[a.el]||0.7;
      for(let k=0;k<3;k++){ lo[k]=Math.min(lo[k],a.pos[k]-R); hi[k]=Math.max(hi[k],a.pos[k]+R); } });
    return lo.map((v,k)=>(v+hi[k])/2);
  }

  // How much room a molecule needs, measured about its own centre.
  //
  //   rxz    horizontal radius about the vertical spin axis — the extent that
  //          matters once it is turning, because a turntable sweeps a CYLINDER,
  //          not a sphere. Framing the sphere (the obvious first guess) treats
  //          the tallest point as though it could also swing out sideways, and
  //          costs roughly a third of the molecule's size on screen.
  //   hy     half-height, which a vertical spin never changes.
  //   radius full 3D radius — for anything tumbling on more than one axis.
  //   span   widest heavy-atom centre separation in REAL angstroms (the display
  //          scale divided out), i.e. the figure an instrument would agree with.
  //          Heavy atoms only: an -OH is a free rotor, so counting its hydrogen
  //          reports how the spec happens to be drawn, not how big it is.
  // Measured AS BUILT, which means the spec's `view` is applied first. Skipping
  // that reports the extents of a differently-oriented molecule: a pyranose
  // turned face-on is much taller than the same ring seen edge-on, so the camera
  // frames the wrong shape and captions placed at ±hy land on top of the model.
  // opts.view overrides, matching buildMolecule's option of the same name.
  function measure(spec, opts={}){
    const P=global.MolLib.PALETTE.radii;
    const O=opts.center||centerOf(spec);
    const skip=new Set(opts.skip||[]);
    const view = opts.view!==undefined ? opts.view : spec.view;
    const q = view ? new THREE.Quaternion().setFromEuler(
      new THREE.Euler(view[0]||0, view[1]||0, view[2]||0, 'ZYX')) : null;
    const v=new THREE.Vector3();
    let rxz=0, hy=0, radius=0;
    spec.atoms.forEach((a,i)=>{
      if(skip.has(i)) return;
      const R=P[a.el]||0.7;
      v.set(a.pos[0]-O[0], a.pos[1]-O[1], a.pos[2]-O[2]);
      if(q) v.applyQuaternion(q);
      const x=v.x, y=v.y, z=v.z;
      rxz=Math.max(rxz, Math.hypot(x,z)+R);
      hy =Math.max(hy,  Math.abs(y)+R);
      radius=Math.max(radius, Math.hypot(x,y,z)+R);
    });
    const heavy=spec.atoms.filter(a=>a.el!=='H');
    let span=0;
    for(let i=0;i<heavy.length;i++)
      for(let j=i+1;j<heavy.length;j++){
        const a=heavy[i].pos, b=heavy[j].pos;
        span=Math.max(span, Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]));
      }
    return { rxz, hy, radius, span:span/(global.MolLib.SCALE||1.9), center:O };
  }

  // Solve the camera distance that fits `boxes`, instead of guessing a constant.
  //
  //   boxes  [{x,y,rxz,hy}]  each item's centre and half-extents (from measure)
  //   opts   {pad, top, bottom, min, max}  pad is slack (1.12 = 12%);
  //          top/bottom reserve world-space bands for captions above/below.
  //
  // Solved per AXIS against the real frustum, not as one circumscribing radius:
  // a row of molecules is far wider than it is tall, and fitting its bounding
  // circle pulls back far enough to show empty space above and below. The
  // horizontal half-angle shrinks with aspect < 1, so the tighter axis wins —
  // which is why a constant tuned on a wide monitor crops on a laptop.
  function frame(camera, cam, boxes, opts={}){
    const o=Object.assign({pad:1.12, top:0, bottom:0, min:6, max:220}, opts);
    if(!boxes.length || !isFinite(camera.aspect) || !camera.aspect) return cam.r;
    const hw=Math.max(...boxes.map(b=>Math.abs(b.x||0)+b.rxz));
    const hh=Math.max(...boxes.map(b=>Math.max( (b.y||0)+b.hy+o.top,
                                               -(b.y||0)+b.hy+o.bottom)));
    // An orthographic camera's apparent size comes from the frustum's
    // half-extents, not from standing distance — there is no fov to solve a
    // `d` against, so fit left/right/top/bottom directly instead of cam.r.
    if(camera.isOrthographicCamera){
      const halfH=Math.max(hh, hw/camera.aspect)*o.pad;
      camera.top=halfH; camera.bottom=-halfH;
      camera.left=-halfH*camera.aspect; camera.right=halfH*camera.aspect;
      camera.updateProjectionMatrix();
      return cam.r;
    }
    const tan=Math.tan(camera.fov*Math.PI/360);
    const d=Math.max(hh/tan, hw/(tan*camera.aspect))*o.pad;
    cam.r=Math.max(o.min, Math.min(o.max, d));
    return cam.r;
  }

  /* ---- the stage: renderer + scene + camera + orbit + resize ---- */
  // opts: cam {theta,phi,r} initial · phiMin/phiMax pitch clamp · rMin/rMax zoom
  // clamp · wheel step · onZoom(r) / onDrag() side-effect hooks (per-page state)
  // · ortho:true swaps in an OrthographicCamera — no perspective foreshortening,
  //   so a shape read off one side of the frame is the same size as the same
  //   shape read off the other. `frame()` fits its frustum directly; `cam.r`
  //   still only sets standing distance (harmless for an ortho camera, never
  //   drives apparent size).
  function create(canvas, opts={}){
    const o=Object.assign({ phiMin:0.25, phiMax:2.85, rMin:5, rMax:60, wheel:0.08,
      onZoom:null, onDrag:null }, opts);
    const camInit=Object.assign({theta:0.5,phi:1.15,r:9}, opts.cam||{});

    const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
    renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    const scene=new THREE.Scene();
    const camera=o.ortho
      ? new THREE.OrthographicCamera(-1,1,1,-1,0.1,1000)
      : new THREE.PerspectiveCamera(45,1,0.1,1000);
    const root=new THREE.Group(); scene.add(root);

    scene.add(new THREE.AmbientLight(0xffffff,.55));
    // Lights parented to the camera so they travel with the view: orbiting reads
    // as rotating the MODEL under a fixed studio light — highlights stay put on
    // screen instead of sweeping across the molecules.
    scene.add(camera);
    const keyL=new THREE.DirectionalLight(0xffffff,.9); keyL.position.set(4,6,8);
    const fillL=new THREE.DirectionalLight(0x88aaff,.4); fillL.position.set(-6,-2,-4);
    camera.add(keyL,keyL.target,fillL,fillL.target);

    const cam={theta:camInit.theta,phi:camInit.phi,r:camInit.r,target:new THREE.Vector3(0,0,0)};
    function applyCam(){
      camera.position.set(
        cam.target.x+cam.r*Math.sin(cam.phi)*Math.sin(cam.theta),
        cam.target.y+cam.r*Math.cos(cam.phi),
        cam.target.z+cam.r*Math.sin(cam.phi)*Math.cos(cam.theta));
      camera.lookAt(cam.target);
    }
    // Camera orbit. Pages pass `orbit:false` when dragging should turn the MODELS
    // instead of swinging the camera — a comparison page showing two molecules
    // side by side must not orbit, because orbiting puts one of them nearer the
    // camera than the other and perspective then magnifies it. Those pages take
    // the pointer themselves; wheel zoom stays either way.
    let drag=null;
    if(o.orbit!==false){
      // preventDefault stops the browser starting a TEXT SELECTION on the same
      // drag — sandbox.css also sets user-select:none on #stage, and both are
      // wanted: the CSS covers pages that take the pointer themselves
      // (orbit:false, where this handler does not exist), this covers a drag
      // that begins on the canvas and sweeps out of the stage entirely.
      canvas.addEventListener('pointerdown',e=>{e.preventDefault();
        drag={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);});
      canvas.addEventListener('pointermove',e=>{ if(!drag)return; if(o.onDrag)o.onDrag();
        cam.theta-=(e.clientX-drag.x)*0.008;
        cam.phi=Math.max(o.phiMin,Math.min(o.phiMax,cam.phi-(e.clientY-drag.y)*0.008));
        drag={x:e.clientX,y:e.clientY}; applyCam();});
      canvas.addEventListener('pointerup',()=>drag=null);
    }
    canvas.addEventListener('wheel',e=>{e.preventDefault();
      cam.r=Math.max(o.rMin,Math.min(o.rMax,cam.r*(1+Math.sign(e.deltaY)*o.wheel)));
      if(o.onZoom) o.onZoom(cam.r); applyCam();},{passive:false});

    // Bail on a zero-sized canvas instead of computing w/0. A ResizeObserver
    // fires during layout, and a grid item is briefly 0px tall before its row is
    // resolved — one such frame set camera.aspect to NaN, which poisons the
    // projection matrix and makes every subsequent project()/unproject() return
    // NaN until the next real resize happens to arrive. Pages that fit their
    // camera from camera.aspect then silently frame against a garbage number.
    function resize(){ const w=canvas.clientWidth,h=canvas.clientHeight;
      if(!w||!h) return;
      renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix(); }
    new ResizeObserver(resize).observe(canvas);
    applyCam();
    return {scene,camera,renderer,root,cam,applyCam,resize};
  }

  // Show/hide a spec's OPTIONAL hydrogens — the nonpolar C–H's listed in
  // spec.optH. Unlike removeAtoms this only flips `visible`, so it is fully
  // reversible and does not disturb atoms a REACTION has already removed (the
  // peptide bond deletes the leaving –OH and one amino H; a rebuild would
  // resurrect them). An H on N/O/S is never in optH: those are the H-bond
  // donors, so hiding them would hide the lesson.
  function setOptionalH(g,show){
    const spec=g.userData.spec, opt=spec&&spec.optH;
    if(!opt||!opt.length) return;
    const set=new Set(opt);
    opt.forEach(i=>{ const m=g.userData.atomMeshes[i]; if(m) m.visible=show; });
    g.userData.bondMeshes.forEach(bm=>{
      if(bm.userData.pair.some(p=>set.has(p))) bm.visible=show; });
  }

  global.Stage={ create, setToon, atomMat, bondMat, glowMat, atom, bond,
    buildMolecule, removeAtoms, setOptionalH, placeBond, measure, frame, centerOf,
    Rsphere, get toon(){return toon;} };
})(this);
