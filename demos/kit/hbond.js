/* =============================================================================
 *  kit/hbond.js — the bond that is not a bond, found and drawn the same way
 * =============================================================================
 *  Three lessons want hydrogen bonds and each one was going to write it again:
 *  water-lab has it inline (a donor scan fused to the water sim), DNA base
 *  pairing IS this bond, and a protein's secondary structure is it a third
 *  time. Writing it three times is not just repetition — it is three slightly
 *  different criteria, so a student who saw water and then saw DNA would have
 *  no way to know they were being shown the same thing. They are the same
 *  thing, and that is most of the lesson.
 *
 *  Two halves, on the lobes.js pattern:
 *    · the MATCHING half is pure JS over positions (no THREE, no DOM),
 *      Node-loadable, so check-kit.js and a page get the same pairing.
 *    · the RENDER half is HBond.create(THREE) → pooled dashed tubes.
 *
 *  ---------------------------------------------------------------------------
 *  WHAT THIS OWNS, AND WHAT IT REFUSES TO OWN
 *  ---------------------------------------------------------------------------
 *  Modules.md: share the plumbing, not the physics. water-lab's H-bonds
 *  pull — there is a spring constant, a linearity weight and an equilibrium
 *  separation, and those belong to water-lab's sim. DNA's do not pull at all;
 *  the helix is baked and the bonds are drawn onto it.
 *
 *  So this module answers ONE question — given these donors and these
 *  acceptors, which pairs are hydrogen bonded, and how well — and the page
 *  does whatever it likes with the answer. It never moves anything.
 *
 *  A SITE is a plain object, so a page can derive sites from a rigid-body sim,
 *  from a built molecule's atom meshes, or from baked coordinates, without the
 *  module knowing which:
 *
 *    donor    { h, root, owner, id }      h = the hydrogen, root = N/O/F it is on
 *    acceptor { p, owner, id, dirs, capacity }
 *
 *  `dirs` are lone-pair directions (lobes.js gives them); `capacity` is how
 *  many bonds that acceptor can take. Both optional — see the next two blocks,
 *  because the defaults are where the chemistry is.
 *
 *  ---------------------------------------------------------------------------
 *  WHY THE CRITERION IS A CONE AND NOT A DISTANCE
 *  ---------------------------------------------------------------------------
 *  A distance cutoff alone will bond any H that drifts near any O, from any
 *  direction, which draws the picture the textbooks draw: a dotted line
 *  asserting an attraction, pointing nowhere in particular. The bond is
 *  directional. Two gates, both from water-lab's inline version, which had
 *  this right:
 *
 *    · H···A closer than `maxDist`
 *    · D–H···A near linear — dot(unit(H−D), unit(A−H)) > `minLinearity`,
 *      i.e. the default 0.5 is an angle of at least 120°
 *
 *  and a third, weaker one that water-lab could not have had — it predates
 *  lobes.js:
 *
 *    · if the acceptor declares `dirs`, the pair reports WHICH lone pair it
 *      came in on and HOW WELL aligned it is (`lobe`, `align`), and is refused
 *      only if it arrives behind the ears entirely (`minLobe`, default 0 — a
 *      hemisphere, not a cone).
 *
 *  THE ASYMMETRY BETWEEN THOSE TWO IS DELIBERATE, and an earlier version of
 *  this file got it wrong. Donor-side linearity is a strong, well-attested
 *  preference. Acceptor-side lone-pair directionality is NOT: the structural
 *  surveys (Taylor & Kennard's CSD work onward) find hydrogen bonds spread
 *  broadly around an acceptor rather than clustered along the idealised sp²
 *  or sp³ lone-pair axes. A hard 60° cone that REFUSED anything else would be
 *  asserting far more than the chemistry does — and it would be asserting it
 *  about lobes that are themselves a modelling choice, which is exactly the
 *  overclaim lobes.js spends its own header warning against.
 *
 *  So alignment scores rather than vetoes. What survives as a hard refusal is
 *  the one part that is not subtle: an approach into the BACK of the acceptor,
 *  on the side its own bonds are on, where there is nothing to bond to and a
 *  hydrogen in the way. A page that wants the strict cone anyway — a docking
 *  puzzle that has to say no — passes `minLobe:0.5` and gets it.
 *
 *  Reporting the lobe is what lets a page call Lobes.fill() on the ear that
 *  got used, so the student watches capacity being spent rather than being
 *  told a number; reporting `align` is what lets it draw a poor bond as a poor
 *  bond instead of silently accepting or silently dropping it.
 *
 *  ---------------------------------------------------------------------------
 *  CAPACITY IS COUNTED, NOT TYPED
 *  ---------------------------------------------------------------------------
 *  An oxygen accepts two hydrogen bonds because it has two lone pairs, and a
 *  water tops out at four because it also has two hydrogens to donate. That is
 *  a derivation, not a fact to memorise, and `sites()` derives it: capacity
 *  defaults to the number of lone-pair directions lobes.js found.
 *
 *  Conjugated pairs do not count. Adenine's exocyclic −NH₂ scores one lone
 *  pair by the electron sum and is not an acceptor — the pair is delocalised
 *  into the ring (lobes.js, "the conjugation trap"). If that atom were left
 *  with capacity 1 here, this module would happily draw A accepting a bond on
 *  its amino group, and the A–T pairing lesson would be exactly backwards. So
 *  `sites()` gives a conjugated atom capacity 0 and records why.
 *
 *  Without lobes.js loaded, capacity defaults to Infinity and the lobe gate is
 *  skipped. The module still works; it is just less honest, and a page that
 *  cares says so by loading lobes.
 *
 *  ---------------------------------------------------------------------------
 *  ONE BOND PER PAIR OF OWNERS
 *  ---------------------------------------------------------------------------
 *  Two waters share at most one hydrogen bond — water's four bonds each go to
 *  a different neighbour. Without that rule a close-packed pair double-bonds
 *  and the count in the panel is wrong. `onePerPair` is on by default and is
 *  keyed on `owner`.
 *
 *  Base pairs are the exception, and they are the reason this is a flag rather
 *  than a hidden assumption: A–T genuinely shares two bonds and G–C three, so
 *  the DNA page gives each base its own owner and turns `onePerPair` OFF. The
 *  default is right for solvent and wrong for base pairing, and a module that
 *  buried it would make G–C come out as one bond with nothing on screen to say
 *  why the pair that is harder to pull apart looked identical to the other.
 *
 *  ---------------------------------------------------------------------------
 *  MATCHING ORDER — AND WHY THE DEFAULT IS THE WORSE ALGORITHM
 *  ---------------------------------------------------------------------------
 *  Capacity makes this an assignment problem: which donor gets the acceptor
 *  they both want. `order:'best'` sorts every candidate by quality and assigns
 *  greedily, which is the better answer.
 *
 *  The default is `order:'donor'`, which walks donors in the order given and
 *  takes each one's nearest legal acceptor — bit-for-bit what water-lab's
 *  inline loop does today. water-lab is a featured lesson whose H-bond count
 *  is on screen and whose H-bond forces feed a running sim; silently improving
 *  its matcher would be a regression that looks like a bug in the physics. So
 *  the migration is behaviour-preserving by default, and 'best' is opt-in.
 *
 *  Usage:
 *    const {donors, acceptors} = HBond.sites(spec, {at:(i)=>worldPos(i)});
 *    const pairs = HBond.find(donors, acceptors, {maxDist:2.5});
 *    const H = HBond.create(THREE); H.set(pairs); root.add(H.group);
 *
 *  Loaded after scene.js; lobes/lobes.js and kit/molgraph.js are optional but
 *  wanted. Exposes window.HBond, and module.exports under Node.
 * ========================================================================== */
(function(global){
  'use strict';

  const MG = global.MolGraph ||
    (typeof require==='function' ? require('./molgraph.js').MolGraph : null);
  const LOBES = global.Lobes ||
    (typeof require==='function' ? (()=>{ try{ return require('../lobes/lobes.js').Lobes; }
                                         catch(e){ return null; } })() : null);

  /* ---- vector helpers over "either shape" ---------------------------------
   * A page holds THREE.Vector3; a spec and a checker hold [x,y,z]. Reading
   * both here keeps the matching half free of THREE without making every
   * caller convert. */
  const xyz = p => Array.isArray(p) ? p : [p.x, p.y, p.z];
  const sub = (a,b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
  const dot = (a,b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const len = a => Math.hypot(a[0],a[1],a[2]);
  const unit = a => { const l=len(a); return l>1e-9 ? [a[0]/l,a[1]/l,a[2]/l] : null; };

  /* Elements electronegative enough to carry the bond. Bio 101 never meets the
   * F case, but leaving it out would make the module state a chemistry rule it
   * does not mean. */
  const POLAR = ['N','O','F'];

  const DEFAULTS = {
    // Ångströms, H···A. 2.5 covers the normal range (1.6–2.2) with room for a
    // student dragging two molecules together by hand. A page working in
    // DISPLAY units (register() applied SCALE) must pass its own — this module
    // answers in whatever units went in, same contract as molgraph.
    maxDist:      2.5,
    minLinearity: 0.5,    // D–H···A ≥ 120° — a strong, real preference
    // Alignment to a lone pair SCORES; this is only the floor below which the
    // approach is coming in behind the ears. 0 = a hemisphere. Set 0.5 for a
    // strict 60° cone when a page needs to refuse (see the header).
    minLobe:      0,
    onePerPair:   true,
    order:        'donor' // 'donor' (water-lab-identical) | 'best'
  };

  /* =====================================================================
   *  sites() — derive donors and acceptors from a spec
   * ===================================================================== */
  /* `at` maps an atom index to a position, so the same spec can be asked
   * about its own local coordinates (default) or about where its atoms
   * currently are in the world after the page has moved them. */
  function sites(spec, opts){
    const o = opts || {};
    const at = o.at || (i => spec.atoms[i].pos);
    const owner = o.owner != null ? o.owner : (o.ownerOf || (()=>spec));
    const ownerOf = typeof owner === 'function' ? owner : (()=>owner);
    const donors = [], acceptors = [], notes = [];

    for(let i=0;i<spec.atoms.length;i++){
      const el = spec.atoms[i].el;

      // A donor is a hydrogen ON an electronegative atom. A C–H does not
      // donate, which is why fats do not dissolve and why this is a test on
      // the neighbour rather than on the hydrogen.
      if(el === 'H'){
        const nb = neighbors(spec, i);
        const root = nb.find(j => POLAR.includes(spec.atoms[j].el));
        if(root != null)
          donors.push({ h:xyz(at(i)), root:xyz(at(root)), owner:ownerOf(i),
                        id:i, rootId:root, el:spec.atoms[root].el });
        continue;
      }
      if(!POLAR.includes(el)) continue;

      // An acceptor needs an available lone pair. Ask lobes.js; if it is not
      // loaded, fall back to "any N/O/F, unlimited" and say so in notes, so a
      // page that skipped lobes can see what it gave up.
      if(!LOBES){
        acceptors.push({ p:xyz(at(i)), owner:ownerOf(i), id:i, el,
                         capacity:Infinity, dirs:null });
        continue;
      }
      const L = LOBES.at(spec, i);
      if(L.pairs == null){ notes.push({atom:i, el, why:L.reason}); continue; }
      if(L.conjugated){
        // Present, not available — the pair is in the π system. Recorded as a
        // zero-capacity site rather than dropped, so a page can draw the ear
        // muted and still refuse the bond. This is the A–T case.
        acceptors.push({ p:xyz(at(i)), owner:ownerOf(i), id:i, el,
                         capacity:0, conjugated:true,
                         dirs:L.dirs.map(d=>d.slice()) });
        continue;
      }
      acceptors.push({ p:xyz(at(i)), owner:ownerOf(i), id:i, el,
                       capacity:L.dirs.length || L.pairs,
                       dirs:L.dirs.map(d=>d.slice()) });
    }
    return { donors, acceptors, notes };
  }

  function neighbors(spec, i){
    if(MG) return MG.neighbors(spec, i);
    const out=[];
    for(const b of spec.bonds){ if(b[0]===i) out.push(b[1]); else if(b[1]===i) out.push(b[0]); }
    return out;
  }

  /* =====================================================================
   *  find() — the matching
   * ===================================================================== */
  function find(donors, acceptors, opts){
    const o = Object.assign({}, DEFAULTS, opts||{});
    const used = new Map();          // acceptor → bonds taken
    const lobeUsed = new Map();      // acceptor → Set of lobe indices spent
    const pairKeys = new Set();
    const out = [];

    const take = (d, a, c) => {
      used.set(a, (used.get(a)||0) + 1);
      if(c.lobe != null){
        if(!lobeUsed.has(a)) lobeUsed.set(a, new Set());
        lobeUsed.get(a).add(c.lobe);
      }
      if(o.onePerPair) pairKeys.add(key(d.owner, a.owner));
      out.push({ donor:d, acceptor:a, h:d.h, p:a.p,
                 d:c.d, linearity:c.linearity, lobe:c.lobe, align:c.align });
    };

    if(o.order === 'best'){
      const cand = [];
      for(const d of donors) for(const a of acceptors){
        const c = score(d, a, o, null);
        if(c.ok) cand.push({d, a, c});
      }
      // Nearest first; then linearity, then how well it sits on a lone pair.
      // Deterministic — no Math.random, and no dependence on array order
      // beyond the sort, so a checker and a page agree.
      cand.sort((x,y) => x.c.d - y.c.d
                      || y.c.linearity - x.c.linearity
                      || (y.c.align ?? 0) - (x.c.align ?? 0));
      for(const {d,a,c} of cand){
        if(!legal(d,a,o,used,pairKeys)) continue;
        const re = score(d, a, o, lobeUsed.get(a));   // its lobe may be spent now
        if(re.ok) take(d, a, re);
      }
      return out;
    }

    // 'donor' order: each donor takes its own nearest legal acceptor, donors
    // walked in the order given. water-lab's loop, moved.
    for(const d of donors){
      let best=null, bestC=null;
      for(const a of acceptors){
        if(!legal(d,a,o,used,pairKeys)) continue;
        const c = score(d, a, o, lobeUsed.get(a));
        if(c.ok && (!bestC || c.d < bestC.d)){ best=a; bestC=c; }
      }
      if(best) take(d, best, bestC);
    }
    return out;
  }

  function key(x,y){
    const a = String(idOf(x)), b = String(idOf(y));
    return a<b ? a+'|'+b : b+'|'+a;
  }
  let _oid = 0;
  const _ids = new WeakMap();
  function idOf(o){
    if(o == null) return 'null';
    if(typeof o !== 'object') return o;
    if(!_ids.has(o)) _ids.set(o, ++_oid);
    return _ids.get(o);
  }

  function legal(d, a, o, used, pairKeys){
    if(a.owner != null && d.owner != null && a.owner === d.owner) return false;  // not to itself
    const cap = a.capacity == null ? Infinity : a.capacity;
    if((used.get(a)||0) >= cap) return false;
    if(o.onePerPair && pairKeys.has(key(d.owner, a.owner))) return false;
    return true;
  }

  /* THE GATES, once. Returns {ok:false, why} rather than a bare null, and
   * `explain()` below is the same call with nothing thrown away — so a lesson
   * that wants to tell a student why two molecules did NOT bond is reading the
   * real decision, not a second implementation of it that will drift. Every
   * rejection is a separate claim, so the gates stay separate conditions. */
  function score(d, a, o, spentLobes){
    const ha = sub(a.p, d.h);
    const dist = len(ha);
    if(dist < 1e-6) return { ok:false, why:'coincident', d:dist };
    if(dist > o.maxDist)
      return { ok:false, why:'too far', d:dist, need:o.maxDist };

    const dh = unit(sub(d.h, d.root)), u = unit(ha);
    if(!dh || !u) return { ok:false, why:'degenerate geometry', d:dist };
    const linearity = dot(dh, u);
    if(linearity < o.minLinearity)
      return { ok:false, why:'D–H points away — not linear enough',
               d:dist, linearity, need:o.minLinearity };

    let lobe = null, align = null;
    if(a.dirs && a.dirs.length){
      // The H approaches the acceptor, so a lone pair pointing back OUT at it
      // is the one it is using: compare the acceptor→H direction to each ear,
      // and take the best still-unspent one. `align` is that cosine — kept and
      // returned rather than compared away, because how well a bond is aimed
      // is a fact about the bond and not just a yes/no about its existence.
      const toH = [-u[0], -u[1], -u[2]];
      let bestDot = -Infinity, free = false;
      for(let k=0;k<a.dirs.length;k++){
        if(spentLobes && spentLobes.has(k)) continue;
        free = true;
        const dk = unit(a.dirs[k]); if(!dk) continue;
        const s = dot(dk, toH);
        if(s > bestDot){ bestDot = s; lobe = k; }
      }
      if(!free)
        return { ok:false, d:dist, linearity,
                 why:'every lone pair on this acceptor is already taken' };
      align = bestDot;
      if(align < o.minLobe)
        return { ok:false, d:dist, linearity, align, lobe,
                 why: o.minLobe > 0
                    ? 'not pointing closely enough at a lone pair'
                    : 'coming in behind the lone pairs, where the acceptor\'s '
                      +'own bonds are' };
    }
    return { ok:true, d:dist, linearity, lobe, align };
  }

  /* explain(donor, acceptor, opts) — the same decision, kept. For a page that
   * has to say "no, and here is what is wrong with it": a student who drags
   * two molecules together and gets nothing has learned nothing. */
  function explain(d, a, opts){
    return score(d, a, Object.assign({}, DEFAULTS, opts||{}), null);
  }

  /* =====================================================================
   *  RENDER — pooled dashed tubes
   * ===================================================================== */
  /* water-lab rebuilt every tube every frame. At its molecule count that is
   * survivable; on a helix it is not, and the same rule hotspot.js learned
   * applies — a node recreated 60 times a second is a node that never
   * finishes anything it was doing. So the pool is reused and the spares are
   * hidden. */
  function create(THREE, opts){
    const o = Object.assign({ radius:0.055, gap:0.26, fill:0.6, dashRadius:null }, opts||{});
    const PAL = global.MolLib && global.MolLib.PALETTE;
    const color = o.color != null ? o.color
                : (PAL && PAL.bonds && PAL.bonds.hbond) != null ? PAL.bonds.hbond : 0x0042aa;

    const group = new THREE.Group();
    group.userData.role = 'hbond';
    const geo = new THREE.CylinderGeometry(o.radius, o.radius, 1, 8, 1);
    const mat = new THREE.MeshStandardMaterial({ color, roughness:0.5, metalness:0,
                                                 transparent:true, opacity:0.9 });
    const UP = new THREE.Vector3(0,1,0);
    const pool = [];      // one THREE.Group of dashes per bond

    function tube(a, b){
      const g = new THREE.Group();
      shape(g, a, b);
      return g;
    }

    function shape(g, a, b){
      const A = a.isVector3 ? a : new THREE.Vector3(...xyz(a));
      const B = b.isVector3 ? b : new THREE.Vector3(...xyz(b));
      const dir = new THREE.Vector3().subVectors(B, A), L = dir.length();
      const n = Math.max(3, Math.round(L / o.gap));
      const q = new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize());
      while(g.children.length < n) g.add(new THREE.Mesh(geo, mat));
      for(let i=0;i<g.children.length;i++){
        const m = g.children[i];
        if(i >= n){ m.visible = false; continue; }
        m.visible = true;
        m.position.copy(A).addScaledVector(dir, (i+0.5)/n);
        m.quaternion.copy(q);
        m.scale.set(1, L/n*o.fill, 1);
      }
      return g;
    }

    /* set(pairs) — pairs as find() returns them, or any {h,p} / [a,b].
     * `endAt` lets a page terminate the tube on a lone-pair tip rather than
     * the atom centre (Lobes.tip), which is the whole point of reporting the
     * lobe index. */
    function set(pairs, endAt){
      for(let i=0;i<pairs.length;i++){
        const q = pairs[i];
        const a = q.h || (q.donor && q.donor.h) || q[0];
        const b = endAt ? endAt(q) : (q.p || (q.acceptor && q.acceptor.p) || q[1]);
        if(!pool[i]){ pool[i] = new THREE.Group(); group.add(pool[i]); }
        pool[i].visible = true;
        shape(pool[i], a, b);
      }
      for(let i=pairs.length;i<pool.length;i++) pool[i].visible = false;
      return group;
    }

    function setVisible(v){ group.visible = !!v; }
    function dispose(){ geo.dispose(); mat.dispose(); }

    return { group, set, tube, setVisible, dispose, material:mat };
  }

  const HBond = { sites, find, explain, create, DEFAULTS, POLAR };
  global.HBond = HBond;
  if(typeof module === 'object' && module.exports) module.exports = { HBond };

})(typeof window !== 'undefined' ? window : globalThis);
