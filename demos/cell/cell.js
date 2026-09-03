/* =============================================================================
 *  cell.js — a cell as a SCALING OBJECT: build it, then measure it
 * =============================================================================
 *  Two halves, one file, the same split as lobes.js:
 *    · the GEOMETRY half is pure JS with no dependencies at all, Node-loadable,
 *      so check-cell.js and a page compute the same numbers from the same code.
 *    · the RENDER half is Cell.create(THREE) → the surface as a solid, lit
 *      mesh, plus a true-scale outline to compare one against another.
 *
 *  FIRST OF ITS KIND IN THIS REPO. Everything else here draws ångströms —
 *  molecules from a spec, proteins from deposited coordinates. This draws
 *  MICROMETRES, and it never draws an atom. One scene unit is 1 µm, which is
 *  ~10,000× the scale family MolecularGeometry.md §1.5 governs. A scene that
 *  mounts this next to a mol-*.js spec is not a size comparison, it is four
 *  orders of magnitude of lie. There is no shared camera between them, ever.
 *
 *  ---------------------------------------------------------------------------
 *  WHY THIS EXISTS: A CELL'S SHAPE IS AN ARGUMENT, AND IT IS ALWAYS DRAWN
 *  AS A CIRCLE
 *  ---------------------------------------------------------------------------
 *  A textbook cell is a bag with organelles in it, and every consequence of
 *  being that shape rather than another one has to be asserted in prose beside
 *  the picture. This module goes the other way: it BUILDS a cell surface from
 *  four parameters and MEASURES the result, so the consequences are read off
 *  the triangles rather than claimed next to them.
 *
 *    · a sphere is the least membrane any volume can be wrapped in, and the
 *      most distance between the middle and the outside. Both at once.
 *    · a rod, a disc and a dimple all buy surface, and they buy it by giving
 *      up the sphere's compactness rather than by giving up cytoplasm.
 *    · fingers buy a great deal of surface and change nothing else.
 *
 *  Four knobs, and each setting of them is a cell that exists. `CELLS` holds
 *  six of them with their real dimensions.

 *  ---------------------------------------------------------------------------
 *  NOTHING IS COMPUTED FROM A FORMULA FOR THE SHAPE IT IS SUPPOSED TO BE
 *  ---------------------------------------------------------------------------
 *  This is the rule the module exists to keep. Area is a triangle sum; volume
 *  is a divergence-theorem sum over the same triangles; depth is a maximum
 *  over an interior search. Reach for 4πr² instead and the module still prints
 *  plausible numbers for a sphere, and then a disc, a rod and a villous cell
 *  all report the sphere's answer — which deletes the only lesson here, since
 *  the entire argument is that SHAPE moves these numbers independently of
 *  size. check-cell.js's first job is to catch exactly that substitution: it
 *  checks the measurement against the closed form on a sphere (where they must
 *  agree) and then checks that they DISAGREE on a rod, in the right direction.
 *
 *  ---------------------------------------------------------------------------
 *  ONE GENERATING FUNCTION, THREE CONSUMERS
 *  ---------------------------------------------------------------------------
 *  The surface is star-shaped about the origin, so it is fully described by a
 *  radius in each direction: `radiusAt(P, dir)`. The display mesh, the sample
 *  cloud the distance queries run against, and the inside/outside test are all
 *  derived from that one function. Nothing can drift out of step with anything
 *  else, and `inside()` is exact and needs no ray casting — which is the whole
 *  reason the shape family is restricted to star-shaped bodies rather than
 *  anything a marching-cubes pass could produce.
 *
 *  Usage:
 *    const P = Cell.resolve({ radius:5, aspect:1 });      // bakes volume scaling
 *    const m = Cell.mesh(P);                              // {pos, idx, nu, nv}
 *    const g = Cell.measure(m);                           // area, volume, sv, fold
 *    const d = Cell.depth(P);                             // deepest interior point
 *
 *    const C = Cell.create(THREE);
 *    root.add(C.build(P));
 * ========================================================================== */
(function(global){
  'use strict';

  /* =======================================================================
   *  GEOMETRY HALF — no THREE, no DOM
   * ==================================================================== */

  const TAU = Math.PI * 2;

  /* ---- the shape family -------------------------------------------------
   * Four knobs, each one a real cell somewhere:
   *
   *   radius  µm, the equatorial semi-axis of the base ellipsoid
   *   aspect  polar / equatorial. 1 sphere · >1 a rod (a bacillus, an axon)
   *           · <1 a disc (a red cell, a leaf mesophyll cell)
   *   dimple  0..0.9, a broad indentation at both poles. This is the red
   *           blood cell's biconcavity, and it is in the family for one
   *           reason: it is the clearest case in biology of a shape chosen
   *           to lower its own diffusion depth without giving up volume.
   *   villi   {count, height, cap, width} — fingers on a golden-angle spiral
   *           over a cap about +Y. `cap` is the cap's half-angle: π covers the
   *           whole cell (a lymphocyte, anything in suspension), and a smaller
   *           one gives a polarized cell with a brush border on one face (an
   *           enterocyte, a proximal tubule). `width` derives from the other
   *           two and rarely wants setting. Surface bought without volume,
   *           and, crucially, without depth.
   *
   * `scale` is not a knob. resolve() writes it when a caller asks for a
   * target volume, so a shape comparison can hold volume fixed. */
  const DEFAULTS = { radius:5, aspect:1, dimple:0, villi:null,
                     volume:null, scale:1, nu:192, nv:96 };

  /* Villus axes, golden-angle spiral over a spherical CAP about +Y. Full
   * sphere is cap = π, and then this is the ordinary Fibonacci sphere.
   *
   * WHY A CAP, AND WHY IT COUNTS INSIDE THE CAP. A cell covered evenly in
   * fingers is a real cell — a lymphocyte in circulation, anything rounded up
   * in suspension — but it is not the famous one. Every cell a textbook draws
   * microvilli on is POLARIZED: an enterocyte's brush border is on the apical
   * face and nowhere else, and so is a proximal tubule's. Uniform fingers draw
   * the wrong cell for the lesson they are usually in.
   *
   * The obvious implementation is to build the whole sphere and throw away
   * the axes outside the cap, and it is wrong: `count` would then mean points
   * generated rather than fingers drawn, so a slider reading 64 would show 16
   * at a third of a sphere and the DENSITY would be whatever the cap left
   * behind. Generating on the cap keeps `count` honest and the spacing even,
   * which is what `villusWidth` below then solves against.
   *
   * There is no axis parameter: the cap is about +Y and a page that wants it
   * pointing elsewhere rotates the group, which is what a Group is for. */
  const axisCache = new Map();
  function villusAxes(count, cap){
    cap = cap == null ? Math.PI : cap;
    const key = count + '|' + cap;
    if(axisCache.has(key)) return axisCache.get(key);
    const out = [];
    const ga = Math.PI * (3 - Math.sqrt(5));
    const yMin = Math.cos(cap);
    for(let i=0;i<count;i++){
      const y = 1 - (1 - yMin)*(2*i + 1)/(2*count);    // cell centres, on the cap
      const r = Math.sqrt(Math.max(0, 1 - y*y));
      const t = ga * i;
      out.push([Math.cos(t)*r, y, Math.sin(t)*r]);
    }
    axisCache.set(key, out);
    return out;
  }

  /* How wide a finger should be so that `count` of them sit on a cap of this
   * size without merging into a dome. Solid angle over count is the mean
   * spacing squared; 0.31 of that spacing leaves a visible gap between
   * neighbours. It lives here rather than in a page because it is a fact
   * about the packing, and a page that derived it itself would get a
   * different answer the day the cap moved. */
  function villusWidth(count, cap){
    cap = cap == null ? Math.PI : cap;
    const omega = 2*Math.PI*(1 - Math.cos(cap));
    return Math.min(0.28, 0.31*Math.sqrt(omega/Math.max(1,count)));
  }

  /* A finger's profile against angular distance from its axis. Smoothstep,
   * not a cosine: it reaches zero at `width` and stays there, so fingers are
   * compactly supported and the surface between them is the undisturbed
   * ellipsoid. A cosine bump would raise the whole surface a little
   * everywhere, which quietly adds volume and turns "area without volume"
   * into a claim the measurement then contradicts. */
  function bump(ang, width){
    if(ang >= width) return 0;
    const t = 1 - ang/width;
    return t*t*(3 - 2*t);
  }

  /* THE generating function. `dir` must be unit. Returns µm. */
  function radiusAt(P, dx, dy, dz){
    const ae = P.radius, ap = P.radius * P.aspect;
    const s = dx*dx + dz*dz;
    let r = 1 / Math.sqrt(s/(ae*ae) + (dy*dy)/(ap*ap));
    if(P.dimple > 0){
      // polar angle measured from the NEARER pole, so both faces dimple
      const th = Math.acos(Math.min(1, Math.abs(dy)));
      const w = 0.95;                       // broad: an RBC's dimple is most of the face
      r *= 1 - P.dimple * Math.exp(-(th/w)*(th/w));
    }
    if(P.villi && P.villi.count > 0){
      const ax = villusAxes(P.villi.count, P.villi.cap);
      let best = 0;
      for(let i=0;i<ax.length;i++){
        const a = ax[i];
        const c = dx*a[0] + dy*a[1] + dz*a[2];
        if(c <= 0) continue;                                  // > 90° away
        const b = bump(Math.acos(Math.min(1,c)), P.villi.width);
        if(b > best) best = b;
      }
      r += P.radius * P.villi.height * best;
    }
    return r * P.scale;
  }

  /* Exact, because the body is star-shaped. This is what the restriction to
   * this shape family buys, and it is used by every distance query. */
  function inside(P, x, y, z){
    const L = Math.sqrt(x*x + y*y + z*z);
    if(L < 1e-12) return true;
    return L < radiusAt(P, x/L, y/L, z/L);
  }

  /* ---- the mesh ---------------------------------------------------------
   * A structured (nu azimuth × nv polar) grid over the same function. The
   * pole rows collapse to a point, so the triangles there are degenerate:
   * they contribute exactly zero to both the area sum and the volume sum,
   * which is why they are left in rather than special-cased into fans. */
  function mesh(P){
    const nu = P.nu, nv = P.nv;
    const pos = new Float64Array((nu+1)*(nv+1)*3);
    let k = 0;
    for(let j=0;j<=nv;j++){
      const th = Math.PI * j/nv, st = Math.sin(th), ct = Math.cos(th);
      for(let i=0;i<=nu;i++){
        const ph = TAU * i/nu;
        const dx = st*Math.cos(ph), dy = ct, dz = st*Math.sin(ph);
        const r = radiusAt(P, dx, dy, dz);
        pos[k++] = r*dx; pos[k++] = r*dy; pos[k++] = r*dz;
      }
    }
    /* Winding is outward-facing (CCW seen from outside), which the volume sum
     * below depends on for its sign. check-cell.js asserts the sphere's
     * volume comes back POSITIVE, which is the only cheap way to catch this
     * being flipped — a flipped mesh renders identically once both faces are
     * drawn, and reports a negative volume nothing else would look at. */
    const idx = new Uint32Array(nu*nv*6);
    let t = 0;
    const at = (i,j) => j*(nu+1) + i;
    for(let j=0;j<nv;j++) for(let i=0;i<nu;i++){
      const a = at(i,j), b = at(i+1,j), c = at(i,j+1), d = at(i+1,j+1);
      idx[t++]=a; idx[t++]=b; idx[t++]=c;
      idx[t++]=b; idx[t++]=d; idx[t++]=c;
    }
    return { pos, idx, nu, nv, params:P };
  }

  /* ---- measurement, off the triangles and nothing else ------------------ */
  function measure(m){
    const p = m.pos, ix = m.idx;
    let area = 0, vol = 0, maxEdge = 0;
    for(let t=0;t<ix.length;t+=3){
      const a=ix[t]*3, b=ix[t+1]*3, c=ix[t+2]*3;
      const ax=p[a],ay=p[a+1],az=p[a+2];
      const ux=p[b]-ax, uy=p[b+1]-ay, uz=p[b+2]-az;
      const vx=p[c]-ax, vy=p[c+1]-ay, vz=p[c+2]-az;
      const cx=uy*vz-uz*vy, cy=uz*vx-ux*vz, cz=ux*vy-uy*vx;
      area += 0.5 * Math.sqrt(cx*cx+cy*cy+cz*cz);
      // divergence theorem: Σ a·(b×c)/6 over outward-wound triangles
      vol += (ax*(p[b+1]*p[c+2]-p[b+2]*p[c+1])
            - ay*(p[b]*p[c+2]  -p[b+2]*p[c])
            + az*(p[b]*p[c+1]  -p[b+1]*p[c])) / 6;
      const e = Math.max(ux*ux+uy*uy+uz*uz, vx*vx+vy*vy+vz*vz);
      if(e > maxEdge) maxEdge = e;
    }
    /* The sphere of the SAME volume is the comparison that makes the numbers
     * mean something. It is the minimum surface any shape of this volume can
     * have (the isoperimetric inequality), so area/sphereArea is "how much
     * membrane this shape carries beyond the least it could get away with" —
     * 1.000 for a bag, and above 1 for every shape a cell actually adopts. */
    const sphereRadius = Math.cbrt(3*vol/(4*Math.PI));
    const sphereArea = 4*Math.PI*sphereRadius*sphereRadius;
    return { area, volume:vol, sv:area/vol, sphereRadius, sphereArea,
             fold:area/sphereArea, maxEdge:Math.sqrt(maxEdge) };
  }

  /* ---- the sample cloud the distance queries run against -----------------
   * Its own grid, not the display mesh's: the display mesh is sized to
   * resolve villi and is far denser than a distance query needs, and reusing
   * it would make every query cost ten times what it has to. */
  function samples(P, n){
    const nv = Math.max(6, Math.round(Math.sqrt(n/2)));
    const nu = nv*2;                       // equal spacing at the equator
    const rows = nv - 1;
    const pts = new Float64Array((nu*rows + 2)*3);
    let k = 0;
    for(let j=1;j<nv;j++){
      const th = Math.PI*j/nv, st=Math.sin(th), ct=Math.cos(th);
      for(let i=0;i<nu;i++){
        const ph = TAU*i/nu;
        const dx=st*Math.cos(ph), dy=ct, dz=st*Math.sin(ph);
        const r = radiusAt(P,dx,dy,dz);
        pts[k++]=r*dx; pts[k++]=r*dy; pts[k++]=r*dz;
      }
    }
    const poles = [];
    for(const s of [1,-1]){
      const r = radiusAt(P,0,s,0);
      poles.push(k/3);
      pts[k++]=0; pts[k++]=r*s; pts[k++]=0;
    }
    /* Spacing, from the grid the cloud was built on rather than from an
     * O(n²) nearest-neighbour pass: every point's true nearest neighbour is
     * at most as far as its grid neighbour, so the max over grid edges is a
     * valid upper bound and costs one linear sweep. It matters that this is
     * an upper bound — depth() turns it into the error bar it prints, and a
     * bound that could be too small would make that error bar a lie. */
    const d2 = (a,b) => {
      const i=a*3, j=b*3;
      const dx=pts[i]-pts[j], dy=pts[i+1]-pts[j+1], dz=pts[i+2]-pts[j+2];
      return dx*dx+dy*dy+dz*dz;
    };
    let eps = 0;
    for(let j=0;j<rows;j++) for(let i=0;i<nu;i++){
      const a = j*nu + i;
      const e1 = d2(a, j*nu + (i+1)%nu);
      const e2 = j+1 < rows ? d2(a, (j+1)*nu + i) : d2(a, poles[1]);
      const e3 = j === 0 ? d2(a, poles[0]) : 0;
      const m = Math.max(e1, e2, e3);
      if(m > eps) eps = m;
    }
    return { pts, eps:Math.sqrt(eps), nu, rows };
  }

  function nearest2(S, x, y, z){
    let best = Infinity;
    for(let i=0;i<S.length;i+=3){
      const dx=S[i]-x, dy=S[i+1]-y, dz=S[i+2]-z;
      const d = dx*dx+dy*dy+dz*dz;
      if(d < best) best = d;
    }
    return best;
  }

  /* ---- depth: how far the deepest cytoplasm is from the membrane ---------
   * The radius of the largest sphere that fits inside — a maximum over the
   * interior of the distance to the surface, found coarse-to-fine.
   *
   * WHY NOT JUST HALF THE SHORTEST AXIS. Because that is right for a sphere,
   * right for a disc, and wrong for anything with a dimple or a waist, and
   * the shapes worth showing are exactly the ones where it is wrong. The
   * checker's rod fixture exists to make sure the search, not a shortcut,
   * is what produced the answer.
   *
   * THE SAMPLING ERROR IS SECOND ORDER, which is why a modest cloud is
   * enough. The nearest SAMPLE to an interior point sits up to ε/2 off the
   * true nearest surface point tangentially, so the reported distance is
   * √(d² + (ε/2)²) ≈ d + ε²/(8d): at ε = 0.08 R and d = R that is 0.08% of
   * R, not 4%. `error` reports that bound rather than ε/2, and the sphere
   * case in the checker is what proves the bound is the right one. */
  function depth(P, opts){
    const o = Object.assign({ n:2000, coarse:10, refine:3 }, opts||{});
    const cloud = samples(P, o.n), S = cloud.pts;
    // bounding radius from the sample cloud — the surface is what bounds the body
    let R = 0;
    for(let i=0;i<S.length;i+=3){
      const d = S[i]*S[i]+S[i+1]*S[i+1]+S[i+2]*S[i+2];
      if(d>R) R=d;
    }
    R = Math.sqrt(R);

    let bx=0, by=0, bz=0, bd=-1, half=R, step=2*R/o.coarse;
    let cx=0, cy=0, cz=0;
    for(let pass=0; pass<=o.refine; pass++){
      const n = pass===0 ? o.coarse : 8;
      const lo = -half, sp = 2*half/n;
      for(let i=0;i<=n;i++) for(let j=0;j<=n;j++) for(let k=0;k<=n;k++){
        const x=cx+lo+i*sp, y=cy+lo+j*sp, z=cz+lo+k*sp;
        if(!inside(P,x,y,z)) continue;
        const d = nearest2(S,x,y,z);
        if(d > bd){ bd=d; bx=x; by=y; bz=z; }
      }
      cx=bx; cy=by; cz=bz; half=sp; step=sp;
    }
    const d = Math.sqrt(bd);
    const eps = cloud.eps;
    return { depth:d, point:[bx,by,bz], eps,
             error: eps*eps/(8*Math.max(d,1e-9)), grid:step };
  }

  /* ---- resolve: bake a target volume into `scale` ------------------------
   * Two-pass, using the module's own measurement rather than a closed form,
   * so it holds for a villous dimpled rod exactly as it does for a sphere.
   * That is what lets a page ask the one question worth asking about shape:
   * SAME VOLUME, what does the surface do. */
  function resolve(params){
    const P = Object.assign({}, DEFAULTS, params||{});
    if(P.villi){
      P.villi = Object.assign({ count:48, height:0.45, cap:Math.PI }, P.villi);
      // width is derived from count and cap unless a caller insists
      if(P.villi.width == null)
        P.villi.width = villusWidth(P.villi.count, P.villi.cap);
    }
    if(P.volume == null) return P;
    P.scale = 1;
    const v = measure(mesh(P)).volume;
    P.scale = Math.cbrt(P.volume / v);
    return P;
  }

  /* Real cells, for scale. Sizes are the ordinary textbook figures; each one
   * is here because it is a different ANSWER to the same geometry. */
  /* The notes carry NO NUMBERS. Every figure about these cells is measured
   * from the parameters beside it at render time, and a note repeating one is
   * a second copy to go stale — which is how an E. coli that measures 0.4 µm
   * deep sat next to prose saying 1 µm for as long as it took to read the
   * table. Say what the shape is FOR; let the columns say how big it is. */
  const CELLS = [
    { name:'Mycoplasma',    radius:0.15, aspect:1,
      note:'about the smallest thing that self-replicates' },
    { name:'E. coli',       radius:0.4,  aspect:2.5,
      note:'a rod, so growing longer costs it no depth at all — only a sphere pays for volume with distance' },
    { name:'red blood cell',radius:3.9,  aspect:0.32, dimple:0.62,
      note:'wide, and still shallow: a dimple spends shape rather than cytoplasm to stay near the outside' },
    { name:'liver cell',    radius:11,   aspect:1,
      note:'a working animal cell, and never further than a capillary or two from the blood' },
    { name:'human egg',     radius:60,   aspect:1,
      note:'the largest human cell — and metabolically almost idle, which is how it gets away with it' },
    { name:'frog egg',      radius:500,  aspect:1,
      note:'pre-loaded with everything it will need; it does not import its way through development' },
  ];

  /* =======================================================================
   *  RENDER HALF
   * ==================================================================== */
  function create(THREE, opts){
    const css = (typeof getComputedStyle === 'function' && typeof document !== 'undefined')
      ? getComputedStyle(document.documentElement) : null;
    const tok = (name, fallback) => {
      const v = css && css.getPropertyValue(name).trim();
      return v ? v : fallback;
    };
    /* Read from main.css, never typed here — the same rule that keeps a
     * caption's oxygen and its sphere the same red. `--clay-500` is a
     * PRIMITIVE, which is off-system on purpose: there is no cell domain
     * token because there is one consumer, and one instance is not a
     * convention. A `--cell-surface` belongs in main.css's domain block the
     * day a second page draws one, next to `--membrane-channel`. */
    const O = Object.assign({
      surface: tok('--clay-500',  '#8a8073'),
      line:    tok('--text-dim',  '#5a5346'),
    }, opts||{});

    function geomFrom(m){
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(Float32Array.from(m.pos), 3));
      g.setIndex(new THREE.BufferAttribute(m.idx, 1));
      g.computeVertexNormals();
      return g;
    }

    /* A SOLID, LIT SURFACE, single-sided. The first version of this drew a
     * translucent two-pass shell cut in half, with the interior painted by
     * distance to the membrane. That put a heat map where cytoplasm goes,
     * and it cut away half the villi on the mount whose whole subject is
     * villi. Shape is what this module makes, so the surface is what it
     * draws: opaque, so the studio lights can model it, and single-sided,
     * because there is no inside to look at. */
    function body(m, o){
      const g = geomFrom(m);
      const mat = new THREE.MeshStandardMaterial({
        color:new THREE.Color((o && o.color) || O.surface),
        roughness:0.9, metalness:0, side:THREE.FrontSide });
      const mesh2 = new THREE.Mesh(g, mat);
      mesh2.userData.mat = mat;
      return mesh2;
    }

    /* opts:  color   override the surface colour
     * Returns a Group so a page can add its own reference objects into it and
     * dispose the lot together. */
    function build(P, o){
      const grp = new THREE.Group();
      const m = mesh(P);
      const b = body(m, o);
      grp.add(b);
      grp.userData = { params:P, mesh:m, body:b, measure:measure(m) };
      return grp;
    }

    /* A real cell at true scale, as the OUTLINE of its cross-section through
     * the middle. Without one of these a size slider is indistinguishable
     * from a zoom control, which is the failure a size mount is most likely
     * to ship with. A wireframe cage of the whole surface was the obvious
     * version and was worse than nothing: at 48x24 lines it reads as a solid
     * grey mass sitting on the subject. One closed curve reads as a caliper. */
    function outline(P, o){
      o = Object.assign({ n:180, opacity:0.55 }, o||{});
      const pts = [];
      for(let i=0;i<=o.n;i++){
        const a = TAU*i/o.n;
        const dx = Math.sin(a), dy = Math.cos(a);
        const r = radiusAt(P, dx, dy, 0);
        pts.push(new THREE.Vector3(r*dx, r*dy, 0));
      }
      const g = new THREE.BufferGeometry().setFromPoints(pts);
      const l = new THREE.Line(g, new THREE.LineDashedMaterial({
        color:new THREE.Color(o.color || O.line), transparent:true,
        opacity:o.opacity, dashSize:o.dash || 0.6, gapSize:(o.dash || 0.6)*0.7 }));
      l.computeLineDistances();
      /* Drawn over the cell, never inside it. The reference is a measurement
       * laid on top of the subject, and one that disappears behind whatever
       * it is measuring is not a reference. */
      l.renderOrder = 2;
      l.material.depthTest = false;
      return l;
    }

    function dispose(grp){
      grp.traverse(o=>{
        if(o.geometry) o.geometry.dispose();
        if(o.material) o.material.dispose();
      });
    }

    return { build, body, outline, dispose, colors:O };
  }

  const API = { radiusAt, inside, mesh, measure, samples, depth, resolve,
                villusAxes, villusWidth, bump, CELLS, DEFAULTS, create };
  global.Cell = API;
  if(typeof module === 'object' && module.exports) module.exports = { Cell:API };
})(typeof globalThis !== 'undefined' ? globalThis : this);
