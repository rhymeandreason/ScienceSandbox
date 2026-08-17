/* =============================================================================
 *  dna/pairing.js — where a base has to sit to pair, solved rather than typed
 * =============================================================================
 *  Step 1 of dna-lab needs one number it must not invent: the pose a partner
 *  base lands in when it latches. Typing a rotation and an offset per pair
 *  would make "A pairs with T" a fact about this file — the student would be
 *  watching a hard-coded answer play back, and A–G would fail because a table
 *  said so.
 *
 *  So the pose is DERIVED from what mol-nucleic.js already declares:
 *
 *    1. Each `wc:` bond says which atom donates and which accepts.
 *    2. For every one, compute where the partner's atom HAS to be — straight
 *       out along the donor's D–H at 1.9 Å (H···A), or out along the
 *       acceptor's lone pair at 2.9 Å (N···N / N···O), lobes.js supplying the
 *       lone-pair direction.
 *    3. Fit the partner onto those target points. Two or three correspondences
 *       and a rigid in-plane move is a Procrustes problem, so this is CLOSED
 *       FORM — no search, no random restarts, and a checker and the page get
 *       the same pose to the last digit.
 *
 *  Then — and this is the part worth keeping — the bonds in the solved pose
 *  are found by kit/hbond.js, the same generic code water-lab's dimer uses.
 *  Nothing here reports "2 hydrogen bonds" because it was told to; the pose is
 *  solved from the declaration and the bonds are then discovered in it. If the
 *  two disagree, the page shows the disagreement.
 *
 *  ---------------------------------------------------------------------------
 *  WHY A MISMATCHED PAIR STILL GETS A POSE
 *  ---------------------------------------------------------------------------
 *  `pairing(a,b)` does not consult a table of allowed letters. It matches each
 *  base's donors against the other's acceptors — the lists lobes.js and the
 *  `sites:` field already provide — and solves for whatever correspondence
 *  comes out. A–C finds one; two purines find one too. What separates them is
 *  measured afterwards, on the solved pose:
 *
 *    · `rms`   how badly the fit had to compromise to satisfy every bond
 *    · `clash` the closest heavy-atom approach that is NOT a hydrogen bond
 *    · `span`  the width of the pair across the two bases
 *
 *  A–T and G–C come out at the same span within a fraction of an ångström —
 *  that constancy is the whole reason the ladder has parallel rails. Two
 *  purines come out far wider, and that is the refusal the lesson wants: not
 *  "G is the wrong letter", but "this pair is too fat for the rung".
 *
 *  Loaded after kit/molgraph.js, lobes/lobes.js and kit/hbond.js. No THREE:
 *  positions in, positions out, Node-loadable so check-dna.js runs it.
 * ========================================================================== */
(function(global){
  'use strict';

  const req = p => (typeof require==='function' ? require(p) : null);
  const MG    = global.MolGraph || (req('../kit/molgraph.js')||{}).MolGraph;
  const LOBES = global.Lobes    || (req('../lobes/lobes.js')||{}).Lobes;
  const HB    = global.HBond    || (req('../kit/hbond.js')||{}).HBond;

  // Target separations. Heavy-atom N···N and N···O in a Watson–Crick pair sit
  // at 2.8–2.95 Å; H···A about 1.9. Real numbers, and the only two constants
  // in this file — everything else is solved.
  const D_HEAVY = 2.90;
  const D_H     = 1.90;

  const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
  const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
  const mul=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];
  const len=a=>Math.hypot(a[0],a[1],a[2]);
  const unit=a=>{const l=len(a); return l>1e-9?mul(a,1/l):null;};
  const P=(s,i)=>s.atoms[i].pos;

  const centroid = s => {
    const h = s.atoms.filter(a=>a.el!=='H');
    return h.reduce((c,a)=>add(c,a.pos),[0,0,0]).map(v=>v/h.length);
  };

  /* The hydrogen on `n` that points most directly away from the base's middle
   * — i.e. the one on the pairing edge rather than the one facing inward. */
  function outwardH(spec, n){
    const c = centroid(spec), away = unit(sub(P(spec,n), c));
    let best=null, bestDot=-Infinity;
    for(const j of MG.neighbors(spec,n)){
      if(spec.atoms[j].el!=='H') continue;
      const d = unit(sub(P(spec,j), P(spec,n)));
      const s = d && away ? d[0]*away[0]+d[1]*away[1]+d[2]*away[2] : 0;
      if(s>bestDot){ bestDot=s; best=j; }
    }
    return best;
  }

  /* The lone-pair direction on `n` that points away from the base — the one a
   * partner can actually reach. Falls back to the ring-neighbour bisector if
   * lobes.js is not loaded or refuses to answer for this atom. */
  function outwardLobe(spec, n){
    const c = centroid(spec), away = unit(sub(P(spec,n), c));
    if(LOBES){
      const L = LOBES.at(spec, n);
      let best=null, bestDot=-Infinity;
      for(const d of (L.dirs||[])){
        const u = unit(d); if(!u) continue;
        const s = u[0]*away[0]+u[1]*away[1]+u[2]*away[2];
        if(s>bestDot){ bestDot=s; best=u; }
      }
      if(best) return best;
    }
    return away;
  }

  /* ---- the correspondences ------------------------------------------------
   * Where each of the partner's atoms has to end up, expressed in the fixed
   * base's frame. `from` is fixed; `to` is the one being moved. */
  function targets(from, to, bonds, choice){
    const out = [];
    let amb = 0;
    for(const b of bonds){
      if(b.role === 'donor'){
        // `from` donates: its H points at the partner's acceptor, which
        // therefore sits along that H at H···A.
        //
        // AN AMINO GROUP HAS TWO HYDROGENS AND ONLY ONE OF THEM PAIRS.
        // Guanine's N2 is the case: pick the wrong H and all three of G–C's
        // targets stop agreeing with each other, the fit compromises, and the
        // pair lands with atoms overlapping. Which one is right depends on
        // where the partner ends up, which is what we are solving for — so
        // rather than guess with a heuristic, the caller enumerates and keeps
        // the fit that actually works.
        const hs = MG.neighbors(from, b.self).filter(j=>from.atoms[j].el==='H');
        const h = hs.length > 1
          ? hs[(choice >> (amb++)) & 1]
          : (hs[0] != null ? hs[0] : outwardH(from, b.self));
        if(h==null) continue;
        const dir = unit(sub(P(from,h), P(from,b.self)));
        out.push({ atom:b.partnerAtom, target: add(P(from,h), mul(dir, D_H)) });
      } else {
        // `from` accepts: the partner's donor N sits out along the lone pair.
        const dir = outwardLobe(from, b.self);
        out.push({ atom:b.partnerAtom, target: add(P(from,b.self), mul(dir, D_HEAVY)) });
      }
    }
    return out;
  }

  /* ---- rigid in-plane fit (closed form) -----------------------------------
   * Both bases are planar and stay in the plane, so the transform has three
   * parameters and Procrustes solves it exactly: centre both point sets, take
   * the rotation that best aligns them, translate. */
  function fit(spec, corr){
    const n = corr.length;
    if(n < 2) return null;
    let cs=[0,0,0], ct=[0,0,0];
    for(const c of corr){ cs = add(cs, P(spec,c.atom)); ct = add(ct, c.target); }
    cs = mul(cs, 1/n); ct = mul(ct, 1/n);

    let sxx=0, sxy=0;
    for(const c of corr){
      const s = sub(P(spec,c.atom), cs), t = sub(c.target, ct);
      sxx += s[0]*t[0] + s[1]*t[1];      // Σ cos-ish
      sxy += s[0]*t[1] - s[1]*t[0];      // Σ sin-ish
    }
    const theta = Math.atan2(sxy, sxx);
    const co = Math.cos(theta), si = Math.sin(theta);
    const apply = p => {
      const d = sub(p, cs);
      return [ ct[0] + d[0]*co - d[1]*si,
               ct[1] + d[0]*si + d[1]*co,
               ct[2] + d[2] ];
    };
    let rms = 0;
    for(const c of corr) rms += Math.pow(len(sub(apply(P(spec,c.atom)), c.target)), 2);
    return { apply, theta, rms:Math.sqrt(rms/n) };
  }

  function posed(spec, apply){
    return { atoms: spec.atoms.map(a=>({el:a.el, pos:apply(a.pos)})),
             bonds: spec.bonds, names: spec.names, sites: spec.sites };
  }

  /* ---- what the pose is worth --------------------------------------------- */
  function measure(fixed, moved, bonded){
    // Closest heavy-atom approach that is NOT one of the hydrogen bonds — the
    // exclusion matters, because an H-bond IS two heavy atoms 2.9 Å apart and
    // counting it as a clash makes every correct pair look like a collision.
    const skip = new Set((bonded||[]).map(b => b.a + '|' + b.b));
    let clash = Infinity;
    for(let i=0;i<fixed.atoms.length;i++){
      if(fixed.atoms[i].el==='H') continue;
      for(let j=0;j<moved.atoms.length;j++){
        if(moved.atoms[j].el==='H') continue;
        if(skip.has(i+'|'+j)) continue;
        const d = len(sub(fixed.atoms[i].pos, moved.atoms[j].pos));
        if(d > 3.4 || d < 0.01) continue;
        clash = Math.min(clash, d);
      }
    }
    // Span: the widest heavy-atom separation across the pair. With no sugars
    // yet this stands in for C1′–C1′; what matters is that A–T and G–C agree
    // and a purine–purine does not.
    let span = 0;
    for(const a of fixed.atoms){
      if(a.el==='H') continue;
      for(const b of moved.atoms){
        if(b.el==='H') continue;
        span = Math.max(span, len(sub(a.pos,b.pos)));
      }
    }
    return { clash: clash===Infinity ? null : clash, span };
  }

  /* ---- pairing(a, b) ------------------------------------------------------
   * The public call. Returns the solved pose plus what it cost, and the bonds
   * kit/hbond.js FINDS in it — not the ones we asked for. */
  function pairing(fixedSpec, moveSpec, opts){
    const o = opts || {};
    // A declared partner uses its own wc: list. Anything else gets a derived
    // correspondence — donors of one against acceptors of the other — so a
    // mismatch is refused by geometry rather than by not being in a table.
    const declared = fixedSpec.wc && moveSpec.name &&
      fixedSpec.wc.partner === moveSpec.name.toLowerCase();
    const bonds = declared ? fixedSpec.wc.bonds : derive(fixedSpec, moveSpec);

    // Enumerate the amino-hydrogen choices (at most a handful) and keep the
    // one that fits. The winning combination IS the answer to "which of the
    // amino hydrogens points into the pair" — solved, not asserted.
    let f = null, corr = null;
    for(let choice = 0; choice < 4; choice++){
      const c = targets(fixedSpec, moveSpec, bonds, choice);
      const g = fit(moveSpec, c);
      if(g && (!f || g.rms < f.rms)){ f = g; corr = c; }
    }
    if(!f) return { ok:false, why:'no complementary donor/acceptor pair to fit on',
                    declared, bonds:[] };

    const moved = posed(moveSpec, f.apply);
    const m = measure(fixedSpec, moved,
      bonds.map(b => ({ a:b.self, b:b.partnerAtom })));

    // The loop closes here: ask the generic H-bond finder what it sees.
    // onePerPair is OFF — two bases really do share two or three.
    const sa = HB.sites(fixedSpec, { owner:'fixed' });
    const sb = HB.sites(moved,     { owner:'moved' });
    // order:'best', not the default. A base pair is an assignment problem —
    // guanine has two donors and cytosine two acceptors within reach of both,
    // and donor-order greedy lets N1–H take the nearer O2, leaving N3 unbonded
    // and G–C reporting two bonds instead of three. The nearest-first pass
    // gets the pairing that satisfies every site.
    const found = HB.find(sa.donors.concat(sb.donors),
                          sa.acceptors.concat(sb.acceptors),
                          { maxDist:o.maxDist || 2.6, onePerPair:false,
                            order:'best' });

    return { ok:true, declared, apply:f.apply, theta:f.theta, rms:f.rms,
             moved, bonds:found, count:found.length,
             clash:m.clash, span:m.span, asked:bonds.length };
  }

  /* Best-effort correspondence for two bases that do not declare each other:
   * take the fixed base's edge atoms and match each to the partner's nearest
   * complementary site by role. Deliberately generous — the point is to give a
   * mismatch its best shot and let the measurement refuse it. */
  function derive(from, to){
    const edge = (from.wc && from.wc.bonds || []).map(b=>({ self:b.self, role:b.role }));
    const cand = { donor:[], acceptor:[] };
    for(const b of (to.wc && to.wc.bonds || []))
      cand[b.role === 'donor' ? 'donor' : 'acceptor'].push(b.self);
    const used = new Set(), out = [];
    for(const e of edge){
      const want = e.role === 'donor' ? 'acceptor' : 'donor';
      const pick = cand[want].find(i => !used.has(i));
      if(pick == null) continue;
      used.add(pick);
      out.push({ self:e.self, role:e.role, partnerAtom:pick });
    }
    return out;
  }

  const Pairing = { pairing, targets, fit, measure, derive, D_HEAVY, D_H };
  global.Pairing = Pairing;
  if(typeof module==='object' && module.exports) module.exports = { Pairing };

})(typeof window!=='undefined' ? window : globalThis);
