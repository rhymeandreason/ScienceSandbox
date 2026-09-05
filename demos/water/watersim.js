/* =============================================================================
 *  water/watersim.js — liquid water, and everything that follows from H-bonds
 * =============================================================================
 *  water-lab.html grew a full molecular-dynamics model inline: an H-bond
 *  network, a real ice Iₕ lattice, hydration shells around dissociating ions,
 *  and a temperature continuum running from ice to vapour. A second solvation
 *  page would have rewritten all of it, and water-lab-v2.html already proved
 *  that by copying the engine verbatim.
 *
 *  ---------------------------------------------------------------------------
 *  WHY THIS IS ONE MODULE AND NOT FOUR
 *  ---------------------------------------------------------------------------
 *  The obvious split — sim / ice / hydration / thermodynamics — is not a seam.
 *  The freeze fraction `fz` runs through all of it: it quiets the jitter, seats
 *  molecules on lattice sites, releases the hydration shells, and drives brine
 *  rejection by measuring the ice radius. Meanwhile the dissolved ion count
 *  sets the freezing point that produced `fz` in the first place. Splitting
 *  that up yields four files that import each other and one number threaded
 *  through three boundaries. It is one physics model, so it is one module.
 *
 *  ---------------------------------------------------------------------------
 *  WHAT THIS OWNS, AND WHAT IT REFUSES TO OWN
 *  ---------------------------------------------------------------------------
 *  Modules.md: share the plumbing, not the physics — except that here the
 *  physics IS the shared thing, and the lesson is what stays on the page.
 *
 *  OWNS   molecule pool and integration · H-bond matching, drawing and forces
 *         · the ice Iₕ lattice and its Bernal–Fowler proton assignment
 *         · ions, octahedral hydration shells, ion–dipole bonds, contact-pair
 *         · dissociation and brine rejection · the temperature continuum
 *         · evaporation and recondensation · the tuning constants for all of it
 *
 *  REFUSES  steps, tabs, sliders, readouts, callouts, camera, and every number
 *         rendered as text. It also refuses to decide what a snapping ionic
 *         bond LOOKS like: `onDissociate` hands the page the two ions and the
 *         break point, and the page spends its own fx.js on them.
 *
 *  `thermo()` is deliberately reachable without THREE and without a scene, so
 *  a checker can assert that pure water freezes at 0°C and 1 m NaCl does not.
 *
 *  Rulebook: docs/WaterSim.md. Bench: water/water-test.html.
 * ========================================================================== */
(function(global){
'use strict';

const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));

/* =============================================================================
 *  The temperature continuum — pure, no THREE, no scene
 * ========================================================================== */
// Colligative shift from dissolved salt: NaCl → 2 free particles, so it both
// depresses the freezing point and elevates the boiling point in proportion to
// concentration. ΔTf = Kf·m (Kf=1.86), capped at the −21°C NaCl/water eutectic;
// ΔTb = ΔTf·(Kb/Kf) since Kf/Kb ≈ 3.63.
function saltShift(nParticles, nWater){
  if(!nParticles) return {dTf:0, dTb:0, molal:0};
  const waterKg=Math.max(0.05, nWater*0.018);   // ~18 g per water molecule
  const molal=nParticles/waterKg;               // free particles (Na⁺+Cl⁻) per kg
  const dTf=Math.min(1.86*molal, 21);
  return {dTf, dTb:dTf/3.63, molal};
}
function thermo({temperature=22, tempEnabled=false, freezeEnabled=false,
                 nWater=0, nParticles=0, saltMode=false}={}){
  const T=tempEnabled ? temperature : 22;
  const {dTf,dTb,molal}=saltShift(nParticles, nWater);
  // Sharp freeze: stay liquid until ~3° above the (salt-depressed) freezing point,
  // then a narrow ramp to full ice right AT the freezing point (0°C for pure water).
  // An 8° ramp made water look and read "frozen" as high as 4°C — where it's
  // actually still liquid (and densest at 4°C).
  const FB=3;
  const fz=freezeEnabled ? clamp((FB-dTf-T)/FB,0,1) : 0;
  const warm=clamp((T-20)/80,0,1);
  // curved rather than linear: motion stays fairly calm through the middle of the
  // range and then visibly ramps up as T approaches boiling, so heating reads as
  // molecules "speeding up" rather than a flat jiggle increase
  const kinetic=Math.pow(warm,1.7)*0.2;
  // Boiling is anchored at the true 100°C (raised by ΔTb once salt is dissolved),
  // so a 0–100°C slider tops out exactly at the boiling point.
  const boilProxy=100+dTb;
  // In salt mode boiling ramps to a full rolling boil within ~2°C of the boiling
  // point (boiling is nearly a threshold), so it visibly boils right at ~102°C.
  const evapProb = T>=boilProxy
    ? (saltMode ? Math.min(0.025, 0.012*(T-boilProxy)) : Math.min(0.02, 0.01*(T-boilProxy)+0.003))
    : 0;
  const hbScale=clamp(1-(T-40)/60,0.15,1)*(1-0.7*fz);
  return {T,fz,warm,kinetic,evapProb,hbScale,dTf,dTb,molal};
}

/* =============================================================================
 *  Tuning — scene units, not ångströms. WaterSim.md §1: the BEHAVIOUR is what
 *  has to be right. A page overrides any of these via opts.tuning, and may
 *  mutate `sim.cfg` live; every value below is re-read each frame.
 * ========================================================================== */
const TUNING = {
  naRad:0.70,        // Na⁺ display radius (real Na⁺/O ≈ 0.73)
  clRad:1.24,        // Cl⁻ display radius (real Cl⁻/O ≈ 1.29, Cl⁻/Na⁺ ≈ 1.77)
  naShellDist:2.7,   // Na⁺ → water-O resting distance (tight shell)
  clShellDist:3.6,   // Cl⁻ → water-O resting distance (looser shell)
  centroidPull:0.0011, // how strongly the whole cluster collapses inward
  // ion–dipole "bond" stiffness. Real ion–water attraction ≈ several× a
  // hydrogen bond, and Na⁺ (small, dense) grips ~1.5× harder than Cl⁻:
  //   Na⁺–water ≈ 4.5× H-bond, Cl⁻–water ≈ 3× H-bond (kHB below).
  naShellK:0.036,    // Na⁺ shell spring (≈ 4.5 × kHB)
  clShellK:0.024,    // Cl⁻ shell spring (≈ 3 × kHB)
  orientSlerp:0.08,  // how fast shell waters snap to ion-dipole orientation
  screen:0.05,       // residual ion–ion pull after dissociation (water dielectric ≈ ×1/80)
  kHB:0.008,         // hydrogen-bond force strength (shell↔bulk connectivity)
  jitter:0.006,      // thermal jiggle
  stericMIN:4.1,     // water–water minimum spacing (roomier = less cluttered shells)
  // --- geometry lengths for tuning the ice-vs-liquid density lesson ---
  iceBond:4.0,       // ice Iₕ nearest-neighbour O···O spacing (lattice bond length)
  liquidEQ:3.6,      // liquid H-bond equilibrium O···O distance (property/freeze steps)
  hbThreshold:3.25,  // max H···O distance for a hydrogen bond to register/draw
  warmStretch:0.22,  // how much the H-bond network thermally stretches at the hot end
                     // (rest length & draw reach ×(1+warm·this); heat loosens the network)
  // --- evaporation: molecules rise above the cluster and fade over a tall band
  //     near the top before recycling to the bottom, so they never pop out ---
  evapFadeLo:12,     // height where an escaped molecule starts fading
  evapTop:22 };      // height where it is fully gone, and recycled

/* =============================================================================
 *  The simulation
 * ========================================================================== */
function create(THREE, root, opts={}){
  const cfg = Object.assign({}, TUNING, opts.tuning||{});
  const onDissociate = opts.onDissociate || function(){};
  const onSaltChange = opts.onSaltChange || function(){};

  // Atom and bond colours come from the shared palette (molecules.js) so a
  // caption and the sphere it names cannot drift. `state` is element → hex.
  const state = global.MolLib.PALETTE.atoms;
  const bondColor = global.MolLib.PALETTE.bonds.covalent;
  const hbColor   = global.MolLib.PALETTE.bonds.hbond;
  const ionColor  = global.MolLib.PALETTE.bonds.iondipole;

  const Rsphere = new THREE.SphereGeometry(1,32,24);

  // MATTE: a tight specular highlight reads as wet plastic at these sizes, and on
  // a big atom it competes with the element letter beside it. Same numbers as
  // Stage.atomMat in scene.js; these stay separate because the H-bond and
  // hydration code below reaches into the meshes it makes.
  function atomMat(color){ return new THREE.MeshStandardMaterial({color,roughness:.92,metalness:0}); }
  function bondMat(color){ return new THREE.MeshStandardMaterial({color,roughness:.5}); }
  function glowMat(color,ei){
    return new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:ei,roughness:.4}); }

  function atom(color, radius, pos, role){
    const m=new THREE.Mesh(Rsphere, atomMat(color));
    m.scale.setScalar(radius); if(pos)m.position.copy(pos);
    if(role) m.userData.role=role;
    return m;
  }
  function bond(a,b,color=bondColor,rad=0.13,order=1,perpHint=null){
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
    const g=new THREE.CylinderGeometry(rad,rad,len,16);
    const m=new THREE.Mesh(g, bondMat(color)); m.userData.role='covalent';
    m.position.copy(a).add(dir.clone().multiplyScalar(.5));
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),normDir);
    return m;
  }
  // visible dashed hydrogen bond, built from short cylinder segments. The tubes are
  // rebuilt every frame from one shared material, so recolouring the material
  // recolours every bond on the next frame.
  const _hbGeo=new THREE.CylinderGeometry(0.07,0.07,1,8);
  let _hbMat=glowMat(hbColor,.55);
  // ion–water (ion–dipole) bonds get their own colour so they read as a distinct
  // interaction from the hydrogen bonds
  let _ionMat=glowMat(ionColor,.6);
  const _up=new THREE.Vector3(0,1,0);

  function dashTube(a,b,mat=_hbMat){
    const g=new THREE.Group();
    const dir=new THREE.Vector3().subVectors(b,a), len=dir.length();
    const n=Math.max(5,Math.round(len/0.26)), q=new THREE.Quaternion().setFromUnitVectors(_up,dir.clone().normalize());
    for(let i=0;i<n;i++){
      const m=new THREE.Mesh(_hbGeo,mat);
      m.position.copy(a).add(dir.clone().multiplyScalar((i+0.5)/n));
      m.quaternion.copy(q); m.scale.set(1,len/n*0.6,1); g.add(m);
    }
    return g;
  }
  const hbondTube=(a,b)=>dashTube(a,b,_hbMat);
  // Water molecule: O at local origin, two H's at 104.5°.
  const ANG=104.5*Math.PI/180, HL=1.55, half=ANG/2;
  const H1L=new THREE.Vector3(Math.sin(half)*HL,-Math.cos(half)*HL,0);
  const H2L=new THREE.Vector3(-Math.sin(half)*HL,-Math.cos(half)*HL,0);
  function water(){
    const g=new THREE.Group();
    const O=atom(state.O,0.95,new THREE.Vector3(0,0,0),'O');
    const Ha=atom(state.H,0.55,H1L,'H'), Hb=atom(state.H,0.55,H2L,'H');
    const ba=bond(new THREE.Vector3(0,0,0),H1L), bb=bond(new THREE.Vector3(0,0,0),H2L);
    g.add(ba,bb);
    g.add(O,Ha,Hb);
    // atomMeshes/bondMeshes/pair are what kit/focus.js reads to light one atom
    // rather than a whole molecule. Indices are 0=O, 1=Ha, 2=Hb, and a bond
    // belongs to a set only when both its ends do, which is Focus's rule and the
    // reason `pair` has to be here rather than inferred.
    ba.userData.pair=[0,1]; bb.userData.pair=[0,2];
    g.userData={O,Ha,Hb, atomMeshes:[O,Ha,Hb], bondMeshes:[ba,bb],
      oWorld:()=>O.getWorldPosition(new THREE.Vector3()),
      hWorld:i=>(i?Hb:Ha).getWorldPosition(new THREE.Vector3())};
    return g;
  }

  // Generic molecule builder driven by a MolLib spec (atoms + bonds + sites).
  // Used for SOLUTE molecules (ethanol, ammonia, methane, CO₂…). Water keeps its

  /* ---------- the molecule pool and the water–water engine ---------- */
  const mols=[]; let lines=[]; const forces=[];
  // Engine parameters, rewritten from `cfg` at the top of every frame. Kept
  // separate from `cfg` because these carry the per-frame thermal stretch, and
  // writing that back into the tuning would make the constants drift as the
  // student moves the temperature slider.
  const eng={ centroidPull:0.0024, jitter:0.006, MIN:3.0, stericK:0.045,
    EQ:3.6, kHB:0.008, hbThreshold:2.7, hbForce:true, spin:0, collisionMin:1.9 };
  const V=(x,y,z)=>new THREE.Vector3(x,y,z);
  function spawn(pos,rot){
    const w=water();
    w.position.copy(pos||V((Math.random()-.5)*5,(Math.random()-.5)*5,(Math.random()-.5)*3));
    if(rot)w.rotation.copy(rot); else w.rotation.set(Math.random()*6,Math.random()*6,Math.random()*6);
    w.userData.vel=V(0,0,0); root.add(w); mols.push(w); return w;
  }
  function remove(){ if(mols.length){ const w=mols.pop(); root.remove(w); return w; } }
  function clearLines(){ lines.forEach(l=>root.remove(l)); lines=[]; }
  function stepWater({hook, showHbonds=true, hbScale=1}={}){
    const c=V(0,0,0); mols.forEach(m=>c.add(m.position)); if(mols.length)c.multiplyScalar(1/mols.length);
    forces.length=mols.length;
    for(let i=0;i<mols.length;i++) forces[i]=(forces[i]||V()).set(0,0,0);
    mols.forEach((w,i)=>{
      forces[i].add(V().subVectors(c,w.position).multiplyScalar(eng.centroidPull));
      forces[i].add(V((Math.random()-.5)*eng.jitter,(Math.random()-.5)*eng.jitter,(Math.random()-.5)*eng.jitter));
      if(hook) hook(w,i,forces[i]);
    });
    for(let i=0;i<mols.length;i++)for(let j=i+1;j<mols.length;j++){
      const d=V().subVectors(mols[i].position,mols[j].position), dist=Math.max(0.4,d.length());
      if(dist<eng.MIN){ const push=d.normalize().multiplyScalar((eng.MIN-dist)*eng.stericK);
        forces[i].add(push); forces[j].sub(push); }
    }
    mols.forEach((w,i)=>{ w.userData.vel.add(forces[i]).multiplyScalar(0.9);
      w.position.add(w.userData.vel); w.rotation.y+=eng.spin; });
    if(eng.collisionMin>0){ const m=eng.collisionMin;
      for(let it=0;it<3;it++)for(let i=0;i<mols.length;i++)for(let j=i+1;j<mols.length;j++){
        const d=V().subVectors(mols[i].position,mols[j].position), dist=d.length();
        if(dist<m&&dist>1e-4){ d.multiplyScalar((m-dist)/dist*0.5);
          mols[i].position.add(d); mols[j].position.sub(d); } } }
    clearLines(); let n=0;
    // Each oxygen has only two lone pairs, so it can ACCEPT at most two H-bonds
    // (a water tops out at 4 total: 2 as donor, 2 as acceptor). Cap acceptors so
    // counts stay physical in a dense cluster.
    // A single pair of waters shares at most ONE H-bond (each of water's 4 bonds
    // goes to a different neighbour), so also forbid a second bond between a pair.
    const accepted=new Map(), bonded=new Set();
    // Per-molecule H-bond tally, read next frame. `hbBonds` records WHICH
    // hydrogen went to WHICH molecule, because the matcher below already knows
    // and anything reading it back off geometry would be re-deriving a decision
    // that has already been made, and can disagree with it.
    mols.forEach((m,idx)=>{ m.userData._i=idx; m.userData.hb=0; m.userData.hbBonds=[]; });
    const pairKey=(a,b)=>a<b?a+'|'+b:b+'|'+a;
    for(const donor of mols){ if(donor.userData.escaped) continue;   // gas-phase molecule: no H-bonds
      const oD=donor.userData.oWorld();
      for(let hi=0;hi<2;hi++){ const h=donor.userData.hWorld(hi);
        let best=null,bestMol=null,bestD=eng.hbThreshold,bestLin=0;
        for(const acc of mols){ if(acc===donor||acc.userData.escaped)continue;   // can't bond to a molecule that's left
          if((accepted.get(acc)||0)>=2) continue;   // this oxygen's lone pairs are full
          if(bonded.has(pairKey(donor.userData._i,acc.userData._i))) continue;   // pair already H-bonded
          const oA=acc.userData.oWorld(), dd=h.distanceTo(oA);
          if(dd<bestD){ const oh=V().subVectors(h,oD).normalize(), ha=V().subVectors(oA,h).normalize();
            const lin=oh.dot(ha); if(lin>0.5){ best=oA;bestMol=acc;bestD=dd;bestLin=lin; } }
        }
        if(best){ n++; accepted.set(bestMol,(accepted.get(bestMol)||0)+1);
          bonded.add(pairKey(donor.userData._i,bestMol.userData._i));
          donor.userData.hb++; bestMol.userData.hb++;   // both partners gain a bond
          donor.userData.hbBonds.push({acc:bestMol, h:hi});
          if(showHbonds){ const l=hbondTube(h,best); lines.push(l); root.add(l); }
          if(eng.hbForce&&hbScale>0){ const ax=V().subVectors(bestMol.position,donor.position);
            const dist=ax.length()||1; ax.multiplyScalar((dist-eng.EQ)*eng.kHB*bestLin*hbScale/dist);
            donor.userData.vel.add(ax); bestMol.userData.vel.sub(ax); }
        }
      }
    }
    return {hbondCount:n, centroid:c};
  }

  /* ---- ice Iₕ lattice (built to fit the current molecule count) ---- */
  function frameQuat(u,v){
    const x=u.clone().normalize();
    const z=new THREE.Vector3().crossVectors(u,v); if(z.lengthSq()<1e-6)z.set(0,0,1); z.normalize();
    const y=new THREE.Vector3().crossVectors(z,x).normalize();
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,y,z));
  }
  const qLocalInv=frameQuat(H1L.clone().add(H2L), H1L.clone()).invert();
  function buildIceSites(n){
    const b=cfg.iceBond,dxy=0.9428*b,alat=Math.sqrt(3)*dxy, R=4;
    const A1x=alat,A1z=0,A2x=alat/2,A2z=1.5*dxy, P=[];
    for(let k=0;k<5;k++){ const base=k*(4*b/3), upA=(k%2===0);
      for(let nn=-R;nn<=R;nn++)for(let mm=-R;mm<=R;mm++){
        const ax=A1x*nn+A2x*mm, az=A1z*nn+A2z*mm, bx=ax, bz=az+dxy;
        const up=upA?[ax,az]:[bx,bz], lo=upA?[bx,bz]:[ax,az];
        P.push(new THREE.Vector3(up[0],base+b/6,up[1]));
        P.push(new THREE.Vector3(lo[0],base-b/6,lo[1]));
      }
    }
    const ctr=new THREE.Vector3(); P.forEach(p=>ctr.add(p)); ctr.multiplyScalar(1/P.length); P.forEach(p=>p.sub(ctr));
    P.sort((a,b)=>a.lengthSq()-b.lengthSq());
    const sites=P.slice(0,n);
    const c2=new THREE.Vector3(); sites.forEach(p=>c2.add(p)); c2.multiplyScalar(1/sites.length); sites.forEach(p=>p.sub(c2));
    // ---- Bernal–Fowler proton assignment ----
    // Orient every O···O link donor→acceptor so each interior oxygen DONATES exactly
    // two bonds (its two covalent, "near" H's) and ACCEPTS two (neighbours' "far" H's).
    // That's a bounded-out-degree (≤2) orientation of the H-bond graph: it guarantees
    // exactly one proton per link, so no two hydrogens ever share an O···O channel.
    const adj=sites.map(()=>[]), edges=[];
    for(let i=0;i<sites.length;i++)for(let j=i+1;j<sites.length;j++){
      if(sites[i].distanceTo(sites[j])<b*1.15){ adj[i].push(j); adj[j].push(i); edges.push([i,j]); }
    }
    const out=sites.map(()=>0), donor={};                 // out[i]=donor count, donor["i,j"]=donor index
    const key=(a,c)=>a<c?a+','+c:c+','+a;
    for(const [i,j] of edges){ const d=out[i]<=out[j]?i:j; donor[key(i,j)]=d; out[d]++; }   // greedy seed
    // Rebalance: any oxygen donating >2 pushes the excess along an augmenting path of
    // donor-directed edges to an oxygen with spare capacity, flipping edges en route.
    function reduce(v){
      const prev=new Map([[v,-1]]), stack=[v];
      while(stack.length){
        const u=stack.pop();
        for(const w of adj[u]){
          if(donor[key(u,w)]===u && !prev.has(w)){
            prev.set(w,u);
            if(out[w]<2){ let cur=w; while(prev.get(cur)!==-1){ const p=prev.get(cur); donor[key(p,cur)]=cur; cur=p; }
              out[v]--; out[w]++; return true; }
            stack.push(w);
          }
        }
      }
      return false;
    }
    let guard=sites.length*8;
    for(let v=0;v<sites.length;v++){ while(out[v]>2 && guard-->0){ if(!reduce(v)) break; } }
    const quats=sites.map((_,i)=>{
      const dd=[], accept=[];
      for(const jn of adj[i]){ const dir=sites[jn].clone().sub(sites[i]).normalize();
        (donor[key(i,jn)]===i?dd:accept).push(dir); }        // donor dirs = near H's
      // Surface molecule short of two donor bonds: keep both covalent H's but aim the
      // spare one(s) into open space (a real dangling O–H) — never back along a link
      // this molecule is accepting on, which is what caused overlapping protons.
      while(dd.length<2){
        let best=new THREE.Vector3(0,1,0), bestScore=1e9;
        for(let s=0;s<48;s++){ const c=new THREE.Vector3(Math.random()-.5,Math.random()-.5,Math.random()-.5);
          if(c.lengthSq()<1e-4) continue; c.normalize();
          let sc=0; for(const a of accept) sc=Math.max(sc,c.dot(a)); for(const d0 of dd) sc=Math.max(sc,c.dot(d0));
          if(sc<bestScore){ bestScore=sc; best=c; } }
        dd.push(best);
      }
      return frameQuat(dd[0].clone().add(dd[1]), dd[0].clone()).multiply(qLocalInv);
    });
    return {sites,quats};
  }
  let iceFor=-1;
  function assignIce(){
    const n=mols.length; const {sites,quats}=buildIceSites(n);
    const free=sites.map((_,i)=>i);
    mols.forEach(w=>{
      let bi=free[0],bk=0,bd=1e9;
      free.forEach((si,k)=>{ const d=w.position.distanceToSquared(sites[si]); if(d<bd){bd=d;bi=si;bk=k;} });
      free.splice(bk,1);
      w.userData.iceSite=sites[bi]; w.userData.iceQuat=quats[bi];
    });
    iceFor=n;
  }

  /* ---- salt (step 5): Na⁺ / Cl⁻ ions ----
     Each ion holds a first hydration shell of 6 water molecules in an
     octahedral arrangement (the textbook coordination number for both Na⁺
     and Cl⁻ in dilute solution). Waters are RECRUITED from those already in
     the scene — add water first, then add salt.
       • Na⁺ (cation): each water points its O (δ−) straight at the ion.
       • Cl⁻ (anion):  each water points ONE O–H bond (δ+) at the ion —
         a near-linear Cl⁻···H–O hydrogen bond, not the H–H bisector.        */
  const salt=[]; const saltBonds=[];
  const bisLocal=H1L.clone().add(H2L).normalize();   // molecule bisector (points toward the H's)
  const h1Local=H1L.clone().normalize();             // one O–H direction, for anion orientation
  const WSHELL=1.15;                                  // water-O half-thickness for contact/shell
  const SHELL_N=6;                                    // octahedral coordination number, Na⁺ & Cl⁻
  // six octahedral vertex directions for seating the shell
  const OCTA=[new THREE.Vector3(1,0,0),new THREE.Vector3(-1,0,0),
              new THREE.Vector3(0,1,0),new THREE.Vector3(0,-1,0),
              new THREE.Vector3(0,0,1),new THREE.Vector3(0,0,-1)];
  // WHICH salt is a lesson decision, so the key comes from the page — and naming
  // it there is also what keeps check-pages.js able to see it, since that audit
  // reads a page's own source for the specs it uses.
  // display radius for an ion: Na⁺/Cl⁻ read the tuning, since those two carry the
  // lesson; any other ion (e.g. K⁺) uses its own spec radius.
  function ionRadius(ion, specR){ return ion==='Na'?cfg.naRad : ion==='Cl'?cfg.clRad : specR; }
  function addSalt(specKey){
    const spec=global.MolLib.MOLECULES[specKey];
    if(!spec || !spec.dissociates) throw new Error(`addSalt: ${specKey} is not a dissociating salt`);
    const catDef=spec.dissociates.find(d=>d.charge>0);   // cation
    const anDef =spec.dissociates.find(d=>d.charge<0);   // anion
    const catR=ionRadius(catDef.ion,catDef.radius), anR=ionRadius(anDef.ion,anDef.radius);
    // drop the crystal in from above the cluster so it drifts down into the water
    let maxY=0; mols.forEach(w=>maxY=Math.max(maxY,w.position.y));
    const base=new THREE.Vector3((Math.random()-.5)*2, maxY+6, (Math.random()-.5)*2);
    // seat the pair at contact distance (surfaces just touching) so the spheres don't overlap
    const half=(catR+anR)/2+0.05;
    const na=atom(state[catDef.ion],catR, base.clone().add(new THREE.Vector3(-half,0,0)),catDef.ion);
    const cl=atom(state[anDef.ion], anR, base.clone().add(new THREE.Vector3(half,0,0)), anDef.ion);
    // `descending` is per-ion so an already-settled crystal keeps its normal physics
    // (and its hydration shells) while a newly-added one is still falling in.
    na.userData={role:catDef.ion, charge:catDef.charge, vel:new THREE.Vector3(), rad:catR, baseRad:catDef.radius, shellCount:0, descending:true};
    cl.userData={role:anDef.ion,  charge:anDef.charge,  vel:new THREE.Vector3(), rad:anR,  baseRad:anDef.radius,  shellCount:0, descending:true};
    root.add(na,cl); salt.push(na,cl);
    // ionic bond, shown until water wedges the ions apart. `dissociated` is per-bond
    // so dropping a second crystal never resets the first back to a contact pair.
    const stick=new THREE.Mesh(new THREE.CylinderGeometry(0.14,0.14,1,12),
      new THREE.MeshStandardMaterial({color:0xe0cf8a,emissive:0x4a3d12,roughness:.45}));
    root.add(stick); saltBonds.push({na,cl,stick,dissociated:false});
    onSaltChange();          // the phase-change points moved; the page re-labels its slider
  }
  const anyDescending=()=>salt.some(m=>m.userData.descending);
  // once a crystal reaches the water, clear its descending flag and lock in shells
  function checkSaltArrival(){
    let arrived=false;
    saltBonds.forEach(b=>{
      if(!b.na.userData.descending) return;
      const both=[b.na,b.cl].every(ion=>mols.some(w=>ion.position.distanceTo(w.position)<3.0));
      if(both){ b.na.userData.descending=b.cl.userData.descending=false; arrived=true; }
    });
    if(arrived) assignShells();
  }
  function clearSalt(){ salt.forEach(m=>root.remove(m)); salt.length=0;
    saltBonds.forEach(b=>root.remove(b.stick)); saltBonds.length=0;
    mols.forEach(w=>{ w.userData.shellIon=null; w.userData.shellSlot=-1; }); clearIonBonds();
    onSaltChange(); }
  // A water "bridges" a Na⁺–Cl⁻ pair once its O has wedged onto the bond axis
  // between the two ions: projection lands in the mid-section of the axis and the
  // O sits close to that line. This is the real contact→solvent-separated ion-pair
  // transition — the first bridging water screens the pair and pries it apart.
  function bridgingWater(na,cl){
    const axis=new THREE.Vector3().subVectors(cl.position,na.position);
    const len=axis.length()||1; axis.multiplyScalar(1/len);
    return mols.some(w=>{
      const rel=new THREE.Vector3().subVectors(w.userData.oWorld(),na.position);
      const t=rel.dot(axis)/len;                       // fractional position along Na→Cl
      if(t<0.3||t>0.7) return false;                   // must sit between the ions, not beside
      const perp=rel.addScaledVector(axis,-t*len).length();
      return perp<1.2;                                 // O close to the bond line
    });
  }
  function checkDissociation(){
    saltBonds.forEach(b=>{
      if(b.dissociated || b.na.userData.descending) return;   // already split, or still falling in
      if(!bridgingWater(b.na,b.cl)) return;                   // wait for a water to wedge this pair apart
      b.dissociated=true;
      // one-time "pop apart" impulse outward from this pair's midpoint
      const c=new THREE.Vector3().addVectors(b.na.position,b.cl.position).multiplyScalar(0.5);
      [b.na,b.cl].forEach(m=>{ const d=new THREE.Vector3().subVectors(m.position,c);
        if(d.lengthSq()<1e-4) d.set(Math.random()-.5,Math.random()-.5,Math.random()-.5);
        m.userData.vel.add(d.normalize().multiplyScalar(0.25)); });
      onDissociate(b.na, b.cl, c);   // the page owns what a snapping bond LOOKS like
    });
  }
  // ion–dipole bonds: each shell water → its ion, drawn to the atom that faces
  // the ion (O for Na⁺, the inward H for Cl⁻) so the polarity reads correctly
  let ionBondLines=[];
  function clearIonBonds(){ ionBondLines.forEach(l=>root.remove(l)); ionBondLines=[]; }
  function updateIonBonds(){
    clearIonBonds();
    if(fz>0.3) return;   // hidden while frozen (shells have released into the ice)
    mols.forEach(w=>{
      const ion=w.userData.shellIon; if(!ion) return;
      let atomPos;
      if(ion.userData.charge>0){ atomPos=w.userData.oWorld(); }              // Na⁺ ↔ O
      else { const h0=w.userData.hWorld(0), h1=w.userData.hWorld(1);          // Cl⁻ ↔ nearer O–H
        atomPos=h0.distanceToSquared(ion.position)<h1.distanceToSquared(ion.position)?h0:h1; }
      const l=dashTube(atomPos, ion.position, _ionMat); ionBondLines.push(l); root.add(l);
    });
  }
  // Assign each ion its 6 nearest un-claimed waters as an octahedral shell.
  function assignShells(){
    mols.forEach(w=>{ w.userData.shellIon=null; w.userData.shellSlot=-1; });
    const taken=new Set();
    salt.forEach(ion=>{
      if(ion.userData.descending){ ion.userData.shellCount=0; return; }   // no shell while still falling in
      const cand=mols.filter(w=>!taken.has(w))
        .sort((a,b)=>a.position.distanceToSquared(ion.position)-b.position.distanceToSquared(ion.position))
        .slice(0,SHELL_N);
      cand.forEach((w,k)=>{ taken.add(w); w.userData.shellIon=ion; w.userData.shellSlot=k; });
      ion.userData.shellCount=cand.length;
    });
  }
  // a water leaving the shell (e.g. evaporating) frees its slot and thins the shell
  function releaseFromShell(w){
    const ion=w.userData.shellIon; if(!ion) return;
    ion.userData.shellCount=Math.max(0,ion.userData.shellCount-1);
    w.userData.shellIon=null; w.userData.shellSlot=-1;
  }
  function updateSaltBonds(){
    const up=new THREE.Vector3(0,1,0);
    saltBonds.forEach(b=>{
      const dist=b.na.position.distanceTo(b.cl.position);
      const bonded = !b.dissociated && dist < b.na.userData.rad+b.cl.userData.rad+0.9;   // still a contact ion pair
      b.stick.visible=bonded;
      if(bonded){
        const dir=new THREE.Vector3().subVectors(b.cl.position,b.na.position);
        b.stick.position.copy(b.na.position).add(dir.clone().multiplyScalar(.5));
        b.stick.quaternion.setFromUnitVectors(up,dir.clone().normalize());
        b.stick.scale.set(1,dist,1);
      }
    });
  }
  function ionForceOnWater(w,f){
    for(const ion of salt){
      const d=new THREE.Vector3().subVectors(w.position,ion.position), dist=d.length()||1;
      if(dist<8){
        const shell=ion.userData.rad+WSHELL;                 // resting hydration distance (contact)
        const k = dist<shell ? 0.16 : 0.018;                 // hard repulsion inside, soft pull outside
        f.addScaledVector(d.multiplyScalar(1/dist), -(dist-shell)*k);  // spring toward the shell
      }
    }
  }
  function orientShells(){
    mols.forEach(w=>{
      const ion=w.userData.shellIon; if(!ion) return;
      const toIon=new THREE.Vector3().subVectors(ion.position,w.position).normalize();
      let q;
      if(ion.userData.charge>0){
        // cation: O (δ−) toward ion → bisector (toward H's) points away
        q=new THREE.Quaternion().setFromUnitVectors(bisLocal, toIon.clone().multiplyScalar(-1));
      } else {
        // anion: one O–H bond (δ+) points straight at the ion (linear Cl⁻···H–O)
        q=new THREE.Quaternion().setFromUnitVectors(h1Local, toIon);
      }
      w.quaternion.slerp(q,cfg.orientSlerp);
    });
  }
  function updateIons(){
    // A freshly-added crystal falls as one rigid body (no ion–ion or water forces yet)
    // so the pair stays bonded until it reaches the water. Only its own ions descend —
    // already-settled crystals below keep their normal physics.
    const descending=salt.filter(m=>m.userData.descending);
    if(descending.length){
      // centre on the descending crystal's centroid, not each ion, so the horizontal
      // pull doesn't squeeze Na⁺ and Cl⁻ toward each other on the way down
      const c=new THREE.Vector3(); descending.forEach(a=>c.add(a.position)); c.multiplyScalar(1/descending.length);
      const cen=new THREE.Vector3(c.x*-0.0008,0,c.z*-0.0008);
      descending.forEach(a=>{
        const f=new THREE.Vector3(0,-0.012,0).add(cen);   // gravity + slack horizontal centering (shared)
        a.userData.vel.add(f).multiplyScalar(0.9); a.position.add(a.userData.vel);
      });
    }
    const settled=salt.filter(m=>!m.userData.descending);
    // brine rejection: as ice grows it excludes the salt, so freezing pushes the
    // ions out to just beyond the lattice (leaving nearly-fresh ice + salty brine)
    let iceR=0; if(fz>0.2) mols.forEach(w=>iceR=Math.max(iceR,w.position.length()));
    settled.forEach(a=>{
      let f;
      if(fz>0.2){ const r=a.position.length()||1, Rrej=iceR+1.5;
        f=a.position.clone().multiplyScalar((Rrej-r)/r*0.012*fz); }   // spring outward to the ice surface
      else f=new THREE.Vector3().copy(a.position).multiplyScalar(-0.004);   // gentle containment
      // An ion is "shielded" once it carries a substantial hydration shell: water's
      // dielectric + the shell's steric bulk then cut the ion–ion pull to a few percent.
      // Screening is per-ion (not a global switch), so a hydrated ion never gets yanked
      // back to contact even while another pair is still dissociating.
      const aShielded=a.userData.shellCount>=3;
      settled.forEach(b=>{ if(a===b)return;
        const dir=new THREE.Vector3().subVectors(b.position,a.position), dist=Math.max(1,dir.length()); dir.normalize();
        const shielded = aShielded || b.userData.shellCount>=3;
        const sc = shielded ? cfg.screen : 1;   // water's dielectric screens ion–ion pull once either ion is hydrated
        f.addScaledVector(dir, -a.userData.charge*b.userData.charge*0.012*sc/dist);  // unlike attract / like repel
        if(dist<a.userData.rad+b.userData.rad+0.4) f.addScaledVector(dir,-0.05);  // ion–ion steric
        if(shielded){   // hydrated ions carry shells that can't interpenetrate → they stay apart
          const ra=a.userData.charge>0?cfg.naShellDist:cfg.clShellDist;
          const rb=b.userData.charge>0?cfg.naShellDist:cfg.clShellDist;
          const reach=ra+rb; if(dist<reach) f.addScaledVector(dir,-(reach-dist)*0.03);
        }
      });
      // water pushes back on the ion — no passing through molecules; also wedges pairs apart
      mols.forEach(w=>{
        const dir=new THREE.Vector3().subVectors(a.position,w.position), dist=dir.length()||1;
        const shell=a.userData.rad+WSHELL;
        if(dist<shell) f.addScaledVector(dir.multiplyScalar(1/dist),(shell-dist)*0.09);
      });
      a.userData.vel.add(f).multiplyScalar(0.9); a.position.add(a.userData.vel);
    });
  }
  // Hard constraint: no water ATOM (O or either H) may overlap an ion sphere.
  // This matters most for Cl⁻, whose inward-pointing H is the closest atom and
  // would otherwise poke into the large anion. Shoves the whole molecule out.
  const WO_RAD=0.95, WH_RAD=0.55;
  function separateIonsFromWater(){
    salt.forEach(ion=>{
      mols.forEach(w=>{
        const atoms=[[w.userData.oWorld(),WO_RAD],[w.userData.hWorld(0),WH_RAD],[w.userData.hWorld(1),WH_RAD]];
        let pen=0, dir=null;
        for(const [p,rad] of atoms){
          const d=new THREE.Vector3().subVectors(p,ion.position), dist=d.length()||1;
          const minD=ion.userData.rad+rad+0.08;
          if(minD-dist>pen){ pen=minD-dist; dir=d.multiplyScalar(1/dist); }
        }
        if(dir) w.position.addScaledVector(dir,pen);   // push molecule out until the offending atom clears
      });
    });
  }


  /* =============================================================================
   *  One frame
   * ========================================================================== */
  let fz=0;                      // freeze fraction, 0 liquid → 1 solid
  let wasFreezing=false, wasBoiling=false;
  function setMolOpacity(w,op){
    w.traverse(o=>{ if(o.isMesh && o.material){ o.material.transparent=(op<1); o.material.opacity=op; } });
  }
  /* frame:
   *   still         no thermal jiggle at all (a single molecule being inspected)
   *   solvent       the dissolving scene: roomier spacing, its own H-bond strength
   *   showHbonds    draw the dashed network
   *   tempEnabled · temperature · freezeEnabled   the temperature continuum
   * Returns thermo()'s params plus the live counts, so the page can label what it
   * is looking at without recomputing any of it. */
  function step(frame={}){
    const solvent=!!frame.solvent;
    // Roomier spacing on every multi-molecule scene (not just the solvent one) so
    // the network reads clearly: gentler cluster pull + a larger steric minimum.
    eng.centroidPull = cfg.centroidPull;
    eng.kHB          = solvent?cfg.kHB:0.008;
    eng.MIN          = cfg.stericMIN;
    eng.EQ           = cfg.liquidEQ;
    eng.hbThreshold  = cfg.hbThreshold;
    const p=thermo({temperature:frame.temperature, tempEnabled:frame.tempEnabled,
      freezeEnabled:frame.freezeEnabled, nWater:mols.length, nParticles:salt.length,
      saltMode:solvent && salt.length>0});
    // Heat loosens the H-bond network: rest length and draw reach stretch with warmth,
    // so bonds visibly lengthen before breaking (the weaker force + jitter still thin
    // the count out, so hotter water shows fewer, longer, strained bonds — as in reality).
    const warmStretch=1+p.warm*cfg.warmStretch;
    eng.EQ*=warmStretch; eng.hbThreshold*=warmStretch;
    fz=p.fz;
    if(salt.length && wasFreezing && p.fz<0.05) assignShells();   // melting: re-form hydration shells
    wasFreezing = p.fz>0.3;
    // condensing back below the boiling point re-forms depleted shells
    if(salt.length && wasBoiling && p.evapProb<=0 && !anyDescending()) assignShells();
    wasBoiling = p.evapProb>0;
    // base thermal jiggle: quieted by freezing, amplified by warmth so heating visibly
    // speeds molecules up well before the boiling threshold kicks in escape behavior
    eng.jitter = frame.still?0:(solvent?cfg.jitter:0.006)*(1-p.fz*0.92)*(1+p.warm*1.4);
    if(frame.freezeEnabled && p.fz>0.02){ if(iceFor!==mols.length) assignIce(); } else iceFor=-1;
    let escaping=0;
    const r=stepWater({ showHbonds:!!frame.showHbonds, hbScale:p.hbScale, hook:(w,i,f)=>{
      if(frame.tempEnabled && p.kinetic>0) f.add(new THREE.Vector3(Math.random()-.5,Math.random()-.5,Math.random()-.5).multiplyScalar(p.kinetic));
      if(p.fz>0 && w.userData.iceSite) f.add(new THREE.Vector3().subVectors(w.userData.iceSite,w.position).multiplyScalar(0.035*p.fz));
      if(w.userData.escaped){ if(p.evapProb<=0){ w.userData.escaped=false; setMolOpacity(w,1); } else { f.set(0,0.055,0); escaping++; } }
      // A molecule can only break free once it's lost most of its H-bonds: escape
      // chance falls off with how many bonds it still holds (last frame's tally), so
      // you see bonds break BEFORE a molecule leaves — the energy-of-vaporization story.
      else if(p.evapProb>0){
        const bondFactor=clamp(1-(w.userData.hb||0)*0.5,0,1);   // 0 bonds→1×, 1→0.5×, ≥2→0
        if(bondFactor>0 && Math.random()<p.evapProb*bondFactor){ w.userData.escaped=true; releaseFromShell(w); }
      }
      // escaping waters break free of the hydration shell (boiling leaves the salt behind)
      if(salt.length && !w.userData.escaped){
        const ion=w.userData.shellIon;
        if(ion){ // spring toward this water's octahedral seat in the ion's shell
          const cat=ion.userData.charge>0;
          const sd=cat?cfg.naShellDist:cfg.clShellDist, sk=(cat?cfg.naShellK:cfg.clShellK)*(1-p.fz);
          const site=ion.position.clone().addScaledVector(OCTA[w.userData.shellSlot], sd);
          f.add(new THREE.Vector3().subVectors(site,w.position).multiplyScalar(sk));   // shells release as ice takes over
        } else ionForceOnWater(w,f);
      }
    }});
    if(p.fz>0.02) mols.forEach(w=>{ if(w.userData.iceQuat) w.quaternion.slerp(w.userData.iceQuat,0.08*p.fz); });
    else if(salt.length) orientShells();
    mols.forEach(w=>{ if(!w.userData.escaped) return;
      if(w.position.y>=cfg.evapTop){   // faded out at the top → recycle back into the pool
        w.position.set((Math.random()-.5)*4,-5,(Math.random()-.5)*4);
        w.userData.vel.set(0,0,0); w.userData.escaped=false; setMolOpacity(w,1);
      } else {                         // fade with height as it drifts up past the cluster
        setMolOpacity(w, clamp((cfg.evapTop-w.position.y)/(cfg.evapTop-cfg.evapFadeLo),0,1));
      } });
    if(salt.length){ checkSaltArrival(); checkDissociation(); updateIons(); separateIonsFromWater(); updateSaltBonds(); updateIonBonds(); } else clearIonBonds();
    return Object.assign({hbondCount:r.hbondCount, centroid:r.centroid, escaping,
      nWater:mols.length, nIons:salt.length}, p);
  }

  return { mols, salt, cfg, step,
    spawn, remove, clearLines, addSalt, clearSalt, assignShells, anyDescending,
    // the page's own decorations are drawn with the same factories, so a callout
    // and the molecule under it cannot end up different shapes
    atom, bond, dashTube, water, ionRadius, ANG, HL, H1L, H2L,
    get fz(){ return fz; } };
}

global.WaterSim = { create, thermo, TUNING };
/* Scale (kit/scale.js, docs/Scale.md). Bulk molecules: this is family A in
   MolecularGeometry.md 1.5, hand-written lengths tuned around HL=1.55, so it is
   not any single factor off angstroms and unit stays null. A solute spec beside
   it is the same rung, single form, which is why water-lab puts one in this box. */
global.WaterSim.SCALE = { rung: 'molecules', form: 'bulk', unit: null, exag: {}, down: {} };
// Node-loadable half: a checker can assert the phase-change points without a scene.
if(typeof module!=='undefined' && module.exports) module.exports={ thermo, TUNING };
})(typeof globalThis!=='undefined'?globalThis:this);
