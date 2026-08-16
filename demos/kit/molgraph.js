/* =============================================================================
 *  kit/molgraph.js — questions you ask a spec, not a scene
 * =============================================================================
 *  "Which oxygen is the terminal one on that phosphate", "which atoms leave
 *  when this bond breaks", "where is every hydroxyl" — chemistry questions with
 *  chemistry answers, currently living inside glycolysis-lab.html's <script>
 *  (nbOf, terminalO, bridgeO, leavingH, phosphorylGroup, dihedralOf). Every
 *  pathway lesson after it — respiration, photosynthesis, enzymes, DNA — needs
 *  the same answers, and copying them out of an HTML file is how two pages come
 *  to disagree about what a phosphate is.
 *
 *  Pure graph + geometry over a molecules.js spec. No THREE, no scene, no
 *  MolLib — so `check-molecules.js` and friends can assert against the SAME
 *  code a page animates with, which is the point: a lesson that says "this
 *  –OH leaves" and a checker that agrees are only worth something if they
 *  computed it the same way.
 *
 *  Units: whatever the spec is in. Distances come back in the spec's own units
 *  (real angstroms for an `angstrom` spec), angles in DEGREES.
 *
 *  Exposes window.MolGraph, and module.exports for Node.
 * ========================================================================== */
(function(global){
  'use strict';

  const bondsOf=spec=>spec.bonds||[];
  const el=(spec,i)=>spec.atoms[i].el;
  const isH=(spec,i)=>el(spec,i)==='H';

  /* ---- adjacency ----
   * Built on demand and cached on the spec under a non-enumerable key, so
   * repeated queries in a render loop don't rebuild it and JSON.stringify of a
   * spec (the bakers do this) doesn't grow a derived field. */
  function adj(spec){
    let a=spec.__adj;
    if(a && a.n===spec.atoms.length && a.m===bondsOf(spec).length) return a.list;
    const list=spec.atoms.map(()=>[]);
    bondsOf(spec).forEach(b=>{ list[b[0]].push(b[1]); list[b[1]].push(b[0]); });
    Object.defineProperty(spec,'__adj',{value:{n:spec.atoms.length,m:bondsOf(spec).length,list},
      configurable:true, enumerable:false, writable:true});
    return list;
  }
  const neighbors=(spec,i)=>adj(spec)[i].slice();
  const heavyNeighbors=(spec,i)=>adj(spec)[i].filter(j=>!isH(spec,j));
  const degree=(spec,i)=>adj(spec)[i].length;
  const heavyDegree=(spec,i)=>heavyNeighbors(spec,i).length;

  function bondBetween(spec,i,j){
    return bondsOf(spec).find(b=>(b[0]===i&&b[1]===j)||(b[0]===j&&b[1]===i))||null;
  }
  const bondOrder=(spec,i,j)=>{ const b=bondBetween(spec,i,j); return b?(b[2]||1):0; };

  /* ---- roles around an atom ----
   * TERMINAL vs BRIDGING is the distinction the phosphate transfer turns on:
   * the three terminal oxygens go with the phosphoryl group, the bridging one
   * stays behind on the sugar. Defined by heavy-atom degree, not by name — a
   * spec that grows a hydrogen must not change which oxygen is which. */
  const terminal=(spec,i,element)=>heavyNeighbors(spec,i)
    .filter(j=>(!element||el(spec,j)===element) && heavyDegree(spec,j)===1);
  const bridging=(spec,i,element)=>heavyNeighbors(spec,i)
    .filter(j=>(!element||el(spec,j)===element) && heavyDegree(spec,j)>1);
  // the hydrogens hanging off atom i — what a dehydration takes with it
  const hydrogens=(spec,i)=>adj(spec)[i].filter(j=>isH(spec,j));

  /* ---- fragments ----
   * `side(spec, i, j)` = every atom reachable from i WITHOUT crossing the i–j
   * bond: the piece that leaves when that bond breaks. Returns null if the
   * bond is in a ring, because then nothing leaves — a caller that treats null
   * as "empty" would silently animate a ring-opening as a no-op. */
  function side(spec,i,j){
    const a=adj(spec), seen=new Set([i]), stack=[i];
    while(stack.length){
      const k=stack.pop();
      for(const n of a[k]){
        if(k===i&&n===j) continue;
        if(n===i&&k===j) continue;
        if(seen.has(n)) continue;
        seen.add(n); stack.push(n);
      }
    }
    return seen.has(j)?null:[...seen].sort((p,q)=>p-q);
  }
  // the whole connected piece containing i, ignoring a set of cut bonds
  function component(spec,i,cuts=[]){
    const cut=new Set(cuts.map(c=>c[0]<c[1]?c[0]+','+c[1]:c[1]+','+c[0]));
    const a=adj(spec), seen=new Set([i]), stack=[i];
    while(stack.length){ const k=stack.pop();
      for(const n of a[k]){
        const key=k<n?k+','+n:n+','+k;
        if(cut.has(key)||seen.has(n)) continue;
        seen.add(n); stack.push(n); } }
    return [...seen].sort((p,q)=>p-q);
  }

  /* ---- rings ----
   * Smallest cycle through each atom (SSSR-ish, by BFS). Enough for the rings
   * biology draws — pyranose, furanose, purine, pyrimidine, benzene — and it is
   * the same shape of answer haworth.js's own findRings gives; that file keeps
   * its copy for now because a Haworth projection is drawing, not chemistry. */
  function rings(spec){
    const a=adj(spec), found=new Map();
    for(let s=0;s<spec.atoms.length;s++){
      if(isH(spec,s)) continue;
      // BFS from s, remembering parents; the first time two branches meet we
      // have the smallest cycle through s.
      const prev=new Map([[s,-1]]), q=[s], depth=new Map([[s,0]]);
      while(q.length){
        const k=q.shift();
        for(const n of a[k]){
          if(isH(spec,n)||n===prev.get(k)) continue;
          if(!prev.has(n)){ prev.set(n,k); depth.set(n,depth.get(k)+1); q.push(n); continue; }
          const path=p=>{ const out=[]; for(let x=p;x!==-1;x=prev.get(x)) out.push(x); return out; };
          const A=path(k), B=path(n);
          const setB=new Set(B), meet=A.find(x=>setB.has(x));
          if(meet==null) continue;
          const ring=[...A.slice(0,A.indexOf(meet)+1),
                      ...B.slice(0,B.indexOf(meet)).reverse()];
          if(ring.length<3) continue;
          const key=[...ring].sort((p,r)=>p-r).join(',');
          if(!found.has(key)) found.set(key,ring);
        }
      }
    }
    // keep the small ones: a fused bicyclic reports its perimeter too, and the
    // perimeter is not a ring anyone draws
    const all=[...found.values()].sort((r,s)=>r.length-s.length);
    const kept=[];
    all.forEach(r=>{
      if(r.length>8) return;
      const set=new Set(r);
      // drop a ring that is the union of two already-kept smaller ones
      const covered=kept.filter(k=>k.every(x=>set.has(x)));
      if(covered.length>=2) return;
      kept.push(r);
    });
    return kept;
  }
  const inRing=(spec,i)=>rings(spec).some(r=>r.includes(i));

  /* ---- functional groups, FOUND rather than listed ----
   * `spec.groups` (macromolecule-lab) is a curated, captioned list — the ones a
   * lesson names. This is the other half: every instance in the molecule,
   * derived from the graph, so a page can say "there are five of these" without
   * anyone typing five. Where both exist the curated list wins for TEXT and
   * this one for COUNTING. Patterns are conservative on purpose: a group here
   * must be unambiguous from connectivity alone.
   *
   * Returns [{key,label,atoms:[...]}], atoms including the hydrogens that
   * belong to the group (an –OH is O and its H).
   */
  const PATTERNS=[
    { key:'hydroxyl', label:'hydroxyl', find(spec){ const out=[];
        spec.atoms.forEach((a,i)=>{ if(a.el!=='O') return;
          const h=hydrogens(spec,i), c=heavyNeighbors(spec,i);
          if(h.length===1 && c.length===1 && el(spec,c[0])!=='P') out.push([i,h[0]]); });
        return out; } },
    { key:'carbonyl', label:'carbonyl', find(spec){ const out=[];
        spec.atoms.forEach((a,i)=>{ if(a.el!=='C') return;
          const dO=heavyNeighbors(spec,i).filter(j=>el(spec,j)==='O'&&bondOrder(spec,i,j)===2);
          if(dO.length===1) out.push([i,dO[0]]); });
        return out; } },
    { key:'carboxyl', label:'carboxyl', find(spec){ const out=[];
        spec.atoms.forEach((a,i)=>{ if(a.el!=='C') return;
          const os=heavyNeighbors(spec,i).filter(j=>el(spec,j)==='O');
          if(os.length!==2) return;
          // C(=O)–O(H), or the deprotonated carboxylate: two oxygens, both
          // terminal. Either way it is the same group and the lesson says so.
          const dbl=os.some(j=>bondOrder(spec,i,j)===2);
          if(!dbl) return;
          const hs=os.flatMap(j=>hydrogens(spec,j));
          if(os.every(j=>heavyDegree(spec,j)===1)) out.push([i,...os,...hs]); });
        return out; } },
    { key:'amine', label:'amino', find(spec){ const out=[];
        spec.atoms.forEach((a,i)=>{ if(a.el!=='N') return;
          const h=hydrogens(spec,i);
          if(h.length>=2) out.push([i,...h]); });
        return out; } },
    { key:'phosphate', label:'phosphate', find(spec){ const out=[];
        spec.atoms.forEach((a,i)=>{ if(a.el!=='P') return;
          const os=heavyNeighbors(spec,i).filter(j=>el(spec,j)==='O');
          out.push([i,...os,...os.flatMap(j=>hydrogens(spec,j))]); });
        return out; } },
    { key:'methyl', label:'methyl', find(spec){ const out=[];
        spec.atoms.forEach((a,i)=>{ if(a.el!=='C') return;
          const h=hydrogens(spec,i);
          if(h.length===3 && heavyDegree(spec,i)===1) out.push([i,...h]); });
        return out; } },
  ];
  function findGroups(spec,keys){
    const want=keys?new Set([].concat(keys)):null;
    const out=[];
    PATTERNS.forEach(p=>{ if(want&&!want.has(p.key)) return;
      p.find(spec).forEach(atoms=>out.push({key:p.key,label:p.label,atoms})); });
    return out;
  }
  // the phosphoryl group that TRANSFERS: P plus its terminal oxygens, leaving
  // the bridging O behind. glycolysis-lab's phosphorylGroup, generalised.
  function phosphoryl(spec,p){
    if(el(spec,p)!=='P') return null;
    const term=terminal(spec,p,'O');
    return { p, terminal:term, bridge:bridging(spec,p,'O'),
      atoms:[p,...term,...term.flatMap(j=>hydrogens(spec,j))] };
  }

  /* ---- geometry ---- */
  const pos=(spec,i)=>spec.atoms[i].pos;
  const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
  const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const len=a=>Math.hypot(a[0],a[1],a[2]);
  const dist=(spec,i,j)=>len(sub(pos(spec,i),pos(spec,j)));
  function angle(spec,i,j,k){          // degrees at j
    const u=sub(pos(spec,i),pos(spec,j)), v=sub(pos(spec,k),pos(spec,j));
    return Math.acos(Math.max(-1,Math.min(1,dot(u,v)/(len(u)*len(v)))))*180/Math.PI;
  }
  // signed dihedral i–j–k–l, degrees, IUPAC sign. The sign is the whole point:
  // it is what distinguishes an L residue from a D one, so a caller that takes
  // Math.abs of this has thrown away the stereochemistry.
  function torsion(spec,i,j,k,l){
    const b1=sub(pos(spec,j),pos(spec,i)), b2=sub(pos(spec,k),pos(spec,j)),
          b3=sub(pos(spec,l),pos(spec,k));
    const n1=cross(b1,b2), n2=cross(b2,b3), m=cross(n1,b2.map(v=>v/len(b2)));
    return Math.atan2(dot(m,n2), dot(n1,n2))*180/Math.PI;
  }
  // centroid of a set of atom indices, in spec coordinates
  function centroid(spec,idxs){
    const c=[0,0,0];
    idxs.forEach(i=>{ const p=pos(spec,i); c[0]+=p[0]; c[1]+=p[1]; c[2]+=p[2]; });
    return c.map(v=>v/(idxs.length||1));
  }
  // how spread out a set is about its own centroid — the test macromolecule-lab
  // applies before ringing a group, because a flash at the centroid of five
  // hydroxyls points at the one place none of them is.
  function spread(spec,idxs){
    const c=centroid(spec,idxs);
    return Math.max(0,...idxs.map(i=>len(sub(pos(spec,i),c))));
  }

  const API={ adj, neighbors, heavyNeighbors, degree, heavyDegree,
    bondBetween, bondOrder, terminal, bridging, hydrogens,
    side, component, rings, inRing, findGroups, phosphoryl, PATTERNS,
    dist, angle, torsion, centroid, spread, isH, el };
  global.MolGraph=API;
  if(typeof module==='object' && module.exports) module.exports={MolGraph:API};
})(typeof globalThis!=='undefined'?globalThis:this);
