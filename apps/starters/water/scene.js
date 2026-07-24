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
 *  page on top of this. See SCIENCE.md §11 for the architecture rationale.
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
  function atomMat(color){ return toon
    ? new THREE.MeshToonMaterial({color})
    : new THREE.MeshStandardMaterial({color,roughness:.35,metalness:.1}); }
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
  // one covalent stick between two points (world or local, caller's choice).
  function bond(a,b,color,rad=0.14){
    const dir=new THREE.Vector3().subVectors(b,a), len=dir.length();
    const m=new THREE.Mesh(new THREE.CylinderGeometry(rad,rad,len,16),bondMat(color));
    m.userData.role='covalent';
    m.position.copy(a).add(dir.clone().multiplyScalar(.5));
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.clone().normalize());
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
    const bondMeshes=(spec.bonds||[]).map(([i,j])=>{
      const m=bond(new THREE.Vector3().fromArray(spec.atoms[i].pos),
                   new THREE.Vector3().fromArray(spec.atoms[j].pos), bondCol);
      m.userData.pair=[i,j]; return m;
    });
    bondMeshes.forEach(m=>g.add(m));
    atomMeshes.forEach(m=>g.add(m));
    g.userData={ spec, atomMeshes, bondMeshes,
      atomWorld:i=>atomMeshes[i].getWorldPosition(new THREE.Vector3()) };
    return g;
  }
  // remove atoms (and any bond touching them) from a built molecule — the leaving
  // group of a reaction. Nulls the atomMeshes slot so indices stay stable.
  function removeAtoms(g,idxs){
    const set=new Set(idxs), u=g.userData;
    idxs.forEach(i=>{ const m=u.atomMeshes[i]; if(m) g.remove(m); u.atomMeshes[i]=null; });
    u.bondMeshes=u.bondMeshes.filter(bm=>{
      if(bm.userData.pair.some(p=>set.has(p))){ g.remove(bm); return false; } return true; });
  }

  /* ---- the stage: renderer + scene + camera + orbit + resize ---- */
  // opts: cam {theta,phi,r} initial · phiMin/phiMax pitch clamp · rMin/rMax zoom
  // clamp · wheel step · onZoom(r) / onDrag() side-effect hooks (per-page state).
  function create(canvas, opts={}){
    const o=Object.assign({ phiMin:0.25, phiMax:2.85, rMin:5, rMax:60, wheel:0.08,
      onZoom:null, onDrag:null }, opts);
    const camInit=Object.assign({theta:0.5,phi:1.15,r:9}, opts.cam||{});

    const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
    renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    const scene=new THREE.Scene();
    const camera=new THREE.PerspectiveCamera(45,1,0.1,1000);
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
    let drag=null;
    canvas.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);});
    canvas.addEventListener('pointermove',e=>{ if(!drag)return; if(o.onDrag)o.onDrag();
      cam.theta-=(e.clientX-drag.x)*0.008;
      cam.phi=Math.max(o.phiMin,Math.min(o.phiMax,cam.phi-(e.clientY-drag.y)*0.008));
      drag={x:e.clientX,y:e.clientY}; applyCam();});
    canvas.addEventListener('pointerup',()=>drag=null);
    canvas.addEventListener('wheel',e=>{e.preventDefault();
      cam.r=Math.max(o.rMin,Math.min(o.rMax,cam.r*(1+Math.sign(e.deltaY)*o.wheel)));
      if(o.onZoom) o.onZoom(cam.r); applyCam();},{passive:false});

    function resize(){ const w=canvas.clientWidth,h=canvas.clientHeight;
      renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix(); }
    new ResizeObserver(resize).observe(canvas);
    applyCam();
    return {scene,camera,renderer,root,cam,applyCam,resize};
  }

  global.Stage={ create, setToon, atomMat, bondMat, glowMat, atom, bond,
    buildMolecule, removeAtoms, Rsphere, get toon(){return toon;} };
})(this);
