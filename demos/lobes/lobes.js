/* =============================================================================
 *  lobes.js — where the non-bonding electrons are, drawn as teardrops
 * =============================================================================
 *  Two halves, one file:
 *    · the GEOMETRY half is pure JS over a spec (needs kit/molgraph.js only),
 *      Node-loadable, so check-lobes.js and a page compute the same answer
 *      from the same code.
 *    · the RENDER half is Lobes.create(THREE) → teardrop meshes.
 *
 *  ---------------------------------------------------------------------------
 *  WHY LONE PAIRS AND NOT MOLECULAR ORBITALS
 *  ---------------------------------------------------------------------------
 *  These are NOT the molecular orbitals of water. Water's canonical MOs are
 *  delocalised and symmetry-adapted (1b₁, 3a₁, 1b₂, 2a₁); its HOMO is a single
 *  p-like lobe perpendicular to the molecular plane, with no matching partner,
 *  and photoelectron spectra agree — two distinct ionisation energies, not one
 *  degenerate pair. Rendering that honestly gives a Bio 101 student four shapes
 *  none of which point where an H-bond goes.
 *
 *  What is drawn here is the EQUIVALENT (localised) picture: two sp³-ish ears
 *  at the tetrahedral angle. It is a valid unitary transform of the same
 *  wavefunction, not a different molecule — and it is the one that makes the
 *  lesson: a donor H points AT a lobe, an oxygen has exactly two so it accepts
 *  exactly two, and tetrahedral ice falls out for free. That is a modelling
 *  choice, and any page that draws these owes the student the word "model".
 *
 *  ---------------------------------------------------------------------------
 *  EVERY DIRECTION IS DERIVED, NONE IS TYPED
 *  ---------------------------------------------------------------------------
 *  Lobe directions come from the spec's own bond vectors, so a molecule whose
 *  geometry is edited gets lobes that move with it. The count comes from a
 *  formal-electron sum over bond ORDERS:
 *
 *        pairs = (valence − formal charge − Σ bond order) / 2
 *
 *  A non-integer or negative result is NOT rounded — it returns null with a
 *  reason. That is the whole guard: phosphate's oxygens come out fractional
 *  precisely because their charge is delocalised (SCIENCE.md §3, "P=O stays a
 *  single stick"), and inventing ears for them would assert a localisation the
 *  rest of the repo deliberately refuses to draw. A spec that knows better
 *  says so with an explicit `lonePairs`.
 *
 *  ---------------------------------------------------------------------------
 *  THE CONJUGATION TRAP — the reason this module is worth having for DNA
 *  ---------------------------------------------------------------------------
 *  The electron count above is blind to π systems, and on the nucleobases that
 *  is not a rounding error, it is the lesson backwards. Adenine's exocyclic
 *  −NH₂ nitrogen has three σ-bonds and, by the sum, one lone pair. Draw an ear
 *  on it and the figure says "acceptor". It is not: that pair is delocalised
 *  into the ring, which is why the amino group is a hydrogen-bond DONOR and
 *  why A pairs with T the one way it does. Same for guanine's N2, and for
 *  every amide N in a protein backbone.
 *
 *  So an atom whose lone pair is conjugated is flagged, and drawn in the
 *  muted, flattened style — present, not available. Deliberately coarse: the
 *  flag is per-ATOM, so an ester oxygen (one pair conjugated, one not) has
 *  both of its lobes muted rather than one. Refining that means committing to
 *  which pair, and nothing in a spec says.
 *
 *  Usage:
 *    Lobes.at(spec, i)            → { pairs, domains, dirs:[[x,y,z]…], … }
 *    const L = Lobes.create(THREE);
 *    const g = L.build(spec, { atoms:'acceptors' });   // a THREE.Group
 *    L.fill(g, atomIndex, 1);     // one slot taken — dim one ear
 *    L.tip(g, atomIndex, 0, v3);  // world point to terminate an H-bond on
 * ========================================================================== */
(function(global){
  'use strict';

  const MG = global.MolGraph ||
    (typeof require==='function' ? require('../kit/molgraph.js').MolGraph : null);
  if(!MG) throw new Error('lobes.js: kit/molgraph.js must load first');

  /* Idealised VSEPR angles. The COUNT and the FRAME come from the molecule;
   * only the opening angle is idealised, and it has to be — a lone pair has no
   * coordinates to measure. Water's true lone-pair separation in the localised
   * picture is wider than tetrahedral (pairs repel harder than bonds), but
   * every textbook draws the tetrahedron and a student has to match the book. */
  const TET  = 109.4712 * Math.PI/180;
  const TRIG = 120      * Math.PI/180;

  const VALENCE = { H:1, C:4, N:5, O:6, F:7, Ne:8, P:5, S:6, Cl:7, Br:7, I:7 };

  /* ---- vectors (plain arrays; no THREE in this half) ----------------- */
  const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
  const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
  const mul=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];
  const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const len=a=>Math.sqrt(dot(a,a));
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
  function unit(a){ const l=len(a); return l>1e-9 ? mul(a,1/l) : null; }
  // Rodrigues: rotate v about a UNIT axis k by angle t
  function rot(v,k,t){
    const c=Math.cos(t), s=Math.sin(t);
    return add(add(mul(v,c), mul(cross(k,v),s)), mul(k, dot(k,v)*(1-c)));
  }
  // any unit vector perpendicular to a
  function perp(a){
    const t = Math.abs(a[0])<0.9 ? [1,0,0] : [0,1,0];
    return unit(cross(a,t));
  }
  const posOf=(spec,i)=>spec.atoms[i].pos;

  /* ---- how many pairs -------------------------------------------------- */
  function declaredPairs(spec,i){
    const a=spec.atoms[i];
    if(a && typeof a.lonePairs==='number') return a.lonePairs;
    const acc = spec.sites && spec.sites.acceptors &&
                spec.sites.acceptors.find(x=>x.atom===i);
    if(acc && typeof acc.lonePairs==='number') return acc.lonePairs;
    return null;
  }

  function countPairs(spec,i){
    const declared=declaredPairs(spec,i);
    if(declared!=null) return { pairs:declared, from:'declared' };
    const el=MG.el(spec,i);
    const v=VALENCE[el];
    if(v==null) return { pairs:null, from:'valence',
      reason:`no valence for ${el} — declare lonePairs on the spec` };
    const q=(spec.atoms[i].charge)||0;
    let order=0;
    MG.neighbors(spec,i).forEach(j=>{ order+=MG.bondOrder(spec,i,j); });
    const n=(v - q - order)/2;
    if(n<0) return { pairs:null, from:'valence',
      reason:`${el} is over-bonded (Σorder ${order}, valence ${v})` };
    if(n!==Math.round(n)) return { pairs:null, from:'valence',
      reason:`${el} comes out at ${n} pairs — an odd electron count, or a `+
             `delocalised charge drawn with single sticks. Declare lonePairs.` };
    return { pairs:n, from:'valence' };
  }

  /* ---- is that pair actually available? --------------------------------
   * A σ-only N or O sitting next to an atom that carries a double bond has
   * its pair in the π system. See the header: this is the DNA trap. */
  function conjugatedAt(spec,i){
    const el=MG.el(spec,i);
    if(el!=='N' && el!=='O') return null;
    const nbrs=MG.neighbors(spec,i);
    if(nbrs.some(j=>MG.bondOrder(spec,i,j)>1)) return null;   // its OWN π — sp2 acceptor
    const hot=nbrs.filter(j=>MG.neighbors(spec,j)
                              .some(k=>k!==i && MG.bondOrder(spec,j,k)>1));
    if(!hot.length) return null;
    return el==='N'
      ? `this pair is delocalised into the π system on atom ${hot[0]} — the `+
        `group is a hydrogen-bond DONOR, not an acceptor`
      : `next to a π system on atom ${hot[0]} — one of these pairs is `+
        `delocalised, and a spec cannot say which`;
  }

  /* ---- where the pairs point ------------------------------------------
   * Cases, by how many BONDED neighbours the atom has. Every one of them
   * builds its frame out of real bond vectors; `null` where the geometry
   * cannot decide, never a guess. */
  function directions(spec,i,pairs){
    if(!pairs) return { dirs:[], note:null };
    const p0=posOf(spec,i);
    const b=MG.neighbors(spec,i)
             .map(j=>unit(sub(posOf(spec,j),p0)))
             .filter(Boolean);
    const n=b.length;
    const domains=n+pairs;

    /* --- no bonds: a bare ion. There IS no frame; the tetrahedron is
     * arbitrary and says so, so a caller can refuse to draw it. */
    if(n===0){
      const t=[[1,1,1],[1,-1,-1],[-1,1,-1],[-1,-1,1]].map(unit);
      return { dirs:t.slice(0,pairs), arbitrary:true,
               note:'no bonds to build a frame from — orientation is arbitrary' };
    }

    /* --- terminal atom: one bond. The open side is a cone, and which way
     * round the cone the lobes sit is set by the NEIGHBOUR's other bonds. */
    if(n===1){
      const away=mul(b[0],-1);
      const j=MG.neighbors(spec,i)[0];
      const others=MG.neighbors(spec,j).filter(k=>k!==i);
      if(domains===3){
        /* sp² — a carbonyl oxygen, a ring =N−. Both pairs lie IN the plane
         * the neighbour's substituents define, at 120° from the bond, which
         * is exactly where a donor comes in from. Get that plane wrong and
         * the ears point out of the ring instead of into the groove. */
        const pj=posOf(spec,j);
        let normal=null;
        for(let a=0;a<others.length && !normal;a++)
          for(let c=a+1;c<others.length && !normal;c++)
            normal=unit(cross(sub(posOf(spec,others[a]),pj),
                              sub(posOf(spec,others[c]),pj)));
        if(!normal && others.length)
          normal=unit(cross(b[0], sub(posOf(spec,others[0]),pj)));
        if(!normal) return { dirs:[], note:
          'sp² lobes need the neighbour’s plane, and it has no other bonds' };
        return { dirs:[ rot(away,normal, TRIG/2), rot(away,normal,-TRIG/2) ] };
      }
      if(domains===4){
        /* sp³ terminal — Cl on HCl, an alkoxide O⁻. A tripod round the bond
         * axis, staggered against the neighbour's other bonds where there
         * are any, because eclipsed ears read as pointing at those bonds. */
        const axis=unit(away);
        let ref=null;
        if(others.length){
          const o=sub(posOf(spec,others[0]),posOf(spec,j));
          ref=unit(sub(o, mul(axis, dot(o,axis))));      // o, flattened onto the cone
        }
        if(!ref) ref=perp(axis);
        const open=Math.PI-TET;                     // from `away`, not from the bond
        const k1=unit(cross(axis,ref));             // rotating about this tips `axis`
        const first=rot(axis,k1,open);              // …straight at the substituent
        const roll=others.length ? Math.PI/3 : 0;   // so stagger it by 60°
        const out=[];
        for(let k=0;k<pairs;k++) out.push(rot(first,axis, roll + k*2*Math.PI/3));
        return { dirs:out, arbitrary:!others.length,
                 note: others.length ? null :
          'nothing to stagger against — the tripod’s roll is arbitrary' };
      }
      return { dirs:[], note:`${domains} domains on a terminal atom is not a `+
                             `shape this module draws` };
    }

    /* --- two or more bonds: the pairs fill what the bonds leave open. */
    const sum=b.reduce(add,[0,0,0]);

    /* A FLAT three-coordinate atom has no open direction in its own plane, and
     * −Σb̂ does not say so: on purine's N9−H the three bonds leave a residual
     * of 0.18 pointing straight down the N−H, so the naive version drew a lone
     * pair lying along a bond. Test PLANARITY instead of the residual's size —
     * it is scale-free, and it is the actual question. (A pyramidal amine
     * measures ≈0.33 out of plane; an aromatic ring N, 0.00.) */
    const nrm3 = n>=3 ? unit(cross(b[1],b[2])) : null;
    const flat = !!nrm3 && Math.abs(dot(b[0], nrm3)) < 0.08;
    if(flat){
      if(pairs===1){
        /* The pair is in the p orbital PERPENDICULAR to the plane — the π
         * system. One orbital, drawn as the two lobes it has, above and
         * below. So dirs.length is 2 while pairs is 1, and `pi` says why.
         * This is the picture that makes the DNA point without a caption:
         * the amino group's electrons visibly lie flat in the ring instead of
         * sticking out to be donated into. Callers must not read dirs.length
         * as a pair count. */
        const nrm=unit(cross(b[0],b[1]));
        if(nrm) return { dirs:[nrm, mul(nrm,-1)], pi:true,
          note:'a p orbital in the π system, drawn as its two lobes — one '+
               'pair, not two, and not available to a donor' };
      }
      return { dirs:[], note:
        `${pairs} pairs on a flat three-coordinate atom is not a shape this `+
        `module draws` };
    }

    const open=unit(mul(sum,-1));
    if(!open || len(sum)<0.05) return { dirs:[], note:
      'the bonds cancel — a symmetric atom has no open direction to point at' };

    if(pairs===1) return { dirs:[open] };   // amine N, ring =N− with 2 σ, sp³ O⁻…

    if(pairs===2 && n===2){
      /* The water case. The two ears are NOT in the H−O−H plane — they
       * straddle it. Rotating `open` about the bond-plane normal would keep
       * them in-plane, which is the easy and wrong version; the axis has to
       * be the in-plane one perpendicular to `open`. */
      const normal=unit(cross(b[0],b[1]));
      if(!normal) return { dirs:[], note:'the two bonds are colinear' };
      const axis=unit(cross(open,normal));
      return { dirs:[ rot(open,axis, TET/2), rot(open,axis,-TET/2) ] };
    }
    return { dirs:[], note:`${pairs} pairs on ${n} bonds is not a shape this `+
                           `module draws` };
  }

  /* ---- the one question the module answers ----------------------------- */
  function at(spec,i){
    const el=MG.el(spec,i);
    const c=countPairs(spec,i);
    if(c.pairs==null)
      return { atom:i, el, pairs:null, dirs:[], reason:c.reason, from:c.from };
    const conj=conjugatedAt(spec,i);
    const d=directions(spec,i,c.pairs);
    /* A p-orbital pair is conjugated whether or not a NEIGHBOUR happened to be
     * drawn with a double bond. One Kekulé structure puts the ring's doubles
     * somewhere and the next puts them elsewhere; a planar atom's pair is in
     * the π system under both, so the flag is forced from the geometry rather
     * than left to depend on which resonance form the spec was typed in. */
    return { atom:i, el, pairs:c.pairs, from:c.from,
             domains:c.pairs+MG.neighbors(spec,i).length,
             conjugated:!!conj||!!d.pi, pi:!!d.pi,
             note:conj||d.note||null,
             arbitrary:!!d.arbitrary, dirs:d.dirs };
  }

  /* Every atom that has a drawable pair. `acceptors` narrows to the ones a
   * spec has already declared as H-bond acceptors — a page drawing the
   * H-bond lesson wants those, not the ether oxygen in the ring. */
  function all(spec,which){
    const only = which==='acceptors' && spec.sites && spec.sites.acceptors
      ? new Set(spec.sites.acceptors.map(a=>a.atom)) : null;
    const out=[];
    spec.atoms.forEach((a,i)=>{
      if(only && !only.has(i)) return;
      const r=at(spec,i);
      if(r.dirs.length) out.push(r);
    });
    return out;
  }

  /* How many H-bonds this molecule can ACCEPT. Conjugated pairs don't count,
   * which is the whole point of tracking them — an adenine that counted its
   * amino nitrogen would claim a slot base-pairing does not have. */
  function capacity(spec){
    return all(spec).reduce((s,r)=>s+(r.conjugated?0:r.dirs.length),0);
  }

  /* ========================================================================
   *  RENDER HALF
   * ===================================================================== */
  function create(THREE){
    const P=global.MolLib.PALETTE;

    /* The teardrop. A lathe over r(u) = u^A (1−u)^B, which is narrow at the
     * nucleus, widest about two thirds out and closes to a round tip — the
     * shape the textbooks draw. Not a cone (reads as an arrow, i.e. a
     * direction rather than a place) and not an ellipsoid (reads as a second
     * atom). The profile starts AT the nucleus, so the inner third is buried
     * inside its own sphere, which is where those electrons are. */
    const A=0.62, B=0.38, PEAK=Math.pow(A,A)*Math.pow(B,B);
    const WAIST=A;                       // u of the widest point — see tip()
    let geo=null;
    function lobeGeo(){
      if(geo) return geo;
      const pts=[], N=26;
      for(let k=0;k<=N;k++){
        const u=k/N;
        pts.push(new THREE.Vector2(Math.pow(u,A)*Math.pow(1-u,B)/PEAK, u));
      }
      geo=new THREE.LatheGeometry(pts,24);   // unit radius, unit length, along +Y
      return geo;
    }

    const UP=new THREE.Vector3(0,1,0);
    const MUTE=0x8c857a;                 // ink, greyed — "present, not available"

    function mat(color,opacity,side){
      return new THREE.MeshBasicMaterial({ color, transparent:true, opacity,
        side, depthWrite:false });
    }

    /* One ear = two draws of the same lathe. The BackSide pass is the body
     * (you see the far wall, so it reads as volume); the FrontSide pass adds
     * the near wall and with it the rim where the silhouette turns away.
     * Same trick as atomkit's cloud, and for the same reason: one flat
     * transparent pass reads as a sticker. */
    function ear(color, opacity){
      const g=new THREE.Group();
      const back=new THREE.Mesh(lobeGeo(), mat(color, opacity, THREE.BackSide));
      const front=new THREE.Mesh(lobeGeo(), mat(color, opacity*0.55, THREE.FrontSide));
      back.renderOrder=-3; front.renderOrder=-2;
      g.add(back, front);
      g.userData.mats=[back.material, front.material];
      g.userData.base=[opacity, opacity*0.55];
      return g;
    }

    /* opts:
     *   atoms     'all' (default) | 'acceptors' | [indices]
     *   length    multiples of the atom's display radius (default 2.3)
     *   width     multiples of the atom's display radius (default 0.66)
     *   opacity   default 0.30
     *   arbitrary draw lobes whose orientation the module admits is arbitrary
     *             (a bare ion, an unstaggered tripod). Default false: a lobe
     *             pointing nowhere in particular is still a lobe pointing
     *             somewhere, and the student cannot tell the difference.
     *   like      the group Stage.buildMolecule returned for this same spec.
     *             ALWAYS PASS IT. `center:true` shifts the atom meshes rather
     *             than the group, and a declared `view:` is baked into them
     *             too, so lobes built from raw spec coordinates land beside
     *             their own atoms — at a plausible offset that reads as a
     *             lobe placement bug rather than a framing one. Reading the
     *             centre back off `userData.center` is the only way to be
     *             sure the two agree; deriving it again here would be a
     *             second copy of the same arithmetic to drift out of step.
     */
    function build(spec, opts){
      const o=Object.assign({ atoms:'all', length:2.3, width:0.66,
                              opacity:0.30, arbitrary:false, like:null }, opts||{});
      const centre=(o.like && o.like.userData && o.like.userData.center) || null;
      const view=(o.view!==undefined ? o.view : spec.view);
      const q=view ? new THREE.Quaternion().setFromEuler(
        new THREE.Euler(view[0]||0, view[1]||0, view[2]||0, 'ZYX')) : null;
      const pick = Array.isArray(o.atoms)
        ? o.atoms.map(i=>at(spec,i)).filter(r=>r.dirs.length)
        : all(spec, o.atoms);
      const group=new THREE.Group();
      group.userData.byAtom={};
      pick.forEach(r=>{
        if(r.arbitrary && !o.arbitrary) return;
        const rad=(P.radii[r.el]||0.7);
        const color = r.conjugated ? MUTE : (P.atoms[r.el]||0x888888);
        const opac  = r.conjugated ? o.opacity*0.45 : o.opacity;
        const mine=[];
        r.dirs.forEach((d,k)=>{
          const e=ear(color, opac);
          /* A muted ear is SHORTER, not flatter. Squashing it would draw a p
           * orbital as an ellipse, which is a claim about its shape; the
           * thing being said is only "this one is spoken for", and length
           * plus the grey says that without inventing geometry. */
          const k2=r.conjugated?0.78:1;
          e.scale.set(rad*o.width*k2, rad*o.length*k2, rad*o.width*k2);
          e.position.fromArray(spec.atoms[r.atom].pos);
          if(centre) e.position.set(e.position.x-centre[0],
                                    e.position.y-centre[1], e.position.z-centre[2]);
          e.quaternion.setFromUnitVectors(UP, new THREE.Vector3().fromArray(d));
          if(q){ e.position.applyQuaternion(q); e.quaternion.premultiply(q); }
          e.userData.info={ atom:r.atom, index:k, conjugated:r.conjugated,
                            dir:d, length:rad*o.length };
          group.add(e); mine.push(e);
        });
        group.userData.byAtom[r.atom]={ ears:mine, info:r };
      });
      group.userData.report=pick;
      return group;
    }

    /* Mark slots as taken: the first `n` ears on this atom go dim, so the
     * "an oxygen accepts two, and no more" rule is something the student
     * WATCHES fill rather than reads. */
    function fill(group, atom, n){
      const rec=group.userData.byAtom[atom]; if(!rec) return;
      rec.ears.forEach((e,k)=>{
        const taken=k<n;
        e.userData.mats.forEach((m,mi)=>{
          m.opacity=e.userData.base[mi]*(taken?0.28:1);
        });
      });
    }

    /* The world point an H-bond should END on — the widest part of the ear,
     * not the tip. A line drawn to the tip overshoots past the electron
     * density it is supposed to be reaching into. Writes into `out`. */
    function tip(group, atom, k, out){
      const rec=group.userData.byAtom[atom]; if(!rec||!rec.ears[k]) return null;
      const e=rec.ears[k];
      out=out||new THREE.Vector3();
      out.set(0,WAIST,0).applyMatrix4(e.matrixWorld);
      return out;
    }

    function setVisible(group,on){ group.visible=!!on; }

    return { build, fill, tip, setVisible, WAIST };
  }

  const API={ at, all, capacity, directions, countPairs, conjugatedAt,
              create, TET, TRIG, VALENCE };
  global.Lobes=API;
  if(typeof module==='object' && module.exports) module.exports={Lobes:API};
})(typeof globalThis!=='undefined'?globalThis:this);
