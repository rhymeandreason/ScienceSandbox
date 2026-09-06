/* =============================================================================
 *  macromolecule/flat.js — the tabletop a fat is built on, and the pose there
 * =============================================================================
 *  THE GESTURE IS FLAT AND THE MOLECULE IS NOT, and for a fat those two cannot
 *  be reconciled by aiming better. Glycerol's three hydroxyls point into three
 *  different directions in space, so two of the three esters want the tail
 *  fifteen units out of the z = 0 plane the pointer works on: a student dragging
 *  on the tabletop can never arrive. molecule-builder.html met the same wall and
 *  answered it the same way — BUILD IN THE DIAGRAM, THEN LOOK AT THE MOLECULE.
 *
 *  So this file is the flat half of the fat card: the layout the pieces are
 *  dragged in, and the ester construction restricted to that layout. The real
 *  one in ester.js is untouched, because it is what the reveal morphs TO.
 *
 *  ONLY GLYCEROL NEEDS FLATTENING. Both fatty acids are already idealised
 *  all-anti zigzags at z = 0 (mol-lipids.js), so `spec` hands them back
 *  unchanged rather than laying out a molecule that is already lying down.
 *
 *  THE LAYOUT IS BAKED, THE HYDROGENS ARE NOT. `flat2d` is RDKit's depiction,
 *  heavy atoms only (tools/bake-flat2d.js), which is right for a diagram and
 *  wrong here by exactly three atoms: an esterification is DEFINED by the
 *  hydroxyl H that leaves, and a layout without them has nothing to react. Each
 *  one is placed here, in the plane, at 120° off its own C–O bond and on the
 *  side away from the rest of the molecule — the angle a diagram draws and the
 *  side it puts it on. The real angle is 104.5° and it is asserted in the 3D
 *  spec, which is where an angle claim belongs.
 *
 *  WHAT THE FLAT POSE KEEPS. Everything ester.js measures: the carbon lands
 *  where the H was, at the same 1.34 Å, with the acid turned until its departing
 *  oxygen points back down the new bond and the carbonyl syn to the alcohol's
 *  carbon. Z is reachable exactly in a plane — a torsion there is 0 or 180 — so
 *  the flat build asserts the same configuration the round one does rather than
 *  a flattened approximation of it.
 *
 *  WHAT IT GIVES UP, and the page must say so: the C–O–C angles are the
 *  drawing's, not the molecule's, and glycerol's backbone is a flat zigzag
 *  rather than a real sp3 chain. That is the whole content of the reveal.
 *
 *  Ångströms in, ångströms out. No THREE, Node-loadable.
 * ========================================================================== */
(function(global){
  'use strict';

  const req = p => (typeof require === 'function' ? require(p) : null);
  const Spec    = global.MacroSpec || req('./spec.js');
  const Ester   = global.Ester     || req('./ester.js');
  const Peptide = global.Peptide   || req('./peptide.js');

  const sub = (a,b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
  const add = (a,b) => [a[0]+b[0], a[1]+b[1], a[2]+b[2]];
  const mul = (a,s) => [a[0]*s, a[1]*s, a[2]*s];
  const len = a => Math.hypot(a[0], a[1], a[2]);
  const unit = a => { const L = len(a); return L ? mul(a, 1/L) : [0,0,0]; };
  const qmul = (a,b) => [
    a[3]*b[0] + a[0]*b[3] + a[1]*b[2] - a[2]*b[1],
    a[3]*b[1] - a[0]*b[2] + a[1]*b[3] + a[2]*b[0],
    a[3]*b[2] + a[0]*b[1] - a[1]*b[0] + a[2]*b[3],
    a[3]*b[3] - a[0]*b[0] - a[1]*b[1] - a[2]*b[2]];
  const qAxis = (axis, ang) => {
    const u = unit(axis), s = Math.sin(ang/2);
    return [u[0]*s, u[1]*s, u[2]*s, Math.cos(ang/2)];
  };
  function qrot(q, v){
    const [x,y,z,w] = q;
    const tx = 2*(y*v[2] - z*v[1]), ty = 2*(z*v[0] - x*v[2]), tz = 2*(x*v[1] - y*v[0]);
    return [v[0] + w*tx + y*tz - z*ty,
            v[1] + w*ty + z*tx - x*tz,
            v[2] + w*tz + x*ty - y*tx];
  }

  const FLAT_EPS = 1e-6;
  const isFlat = spec => spec.atoms.every(a => Math.abs(a.pos[2]) < FLAT_EPS);

  const bondedTo = (spec, i) => (spec.bonds || [])
    .filter(b => b[0] === i || b[1] === i)
    .map(b => b[0] === i ? b[1] : b[0]);

  /* The same atoms, laid out flat. A spec already in the plane comes back as
   * itself — including the same object, so a page can test identity to find out
   * whether anything moved. */
  function spec(s){
    if(isFlat(s)) return s;
    const F = s.flat2d;
    // A molecule with no layout must fail VISIBLY. Dropping it into the plane by
    // zeroing z would fold the two hydroxyls that point out of the page onto the
    // backbone and still render.
    if(!F || !F.length) return null;

    let k = 0;
    const flatIdx = s.atoms.map(a => a.el === 'H' ? -1 : k++);
    if(k !== F.length) return null;

    const pos = s.atoms.map((a,i) =>
      a.el === 'H' ? null : [F[flatIdx[i]][0], F[flatIdx[i]][1], 0]);

    // Centre of the heavy atoms, which is the "rest of the molecule" each H is
    // placed away from.
    const heavy = pos.filter(Boolean);
    const mid = mul(heavy.reduce(add, [0,0,0]), 1/heavy.length);

    /* THE HYDROGENS, PLACED BY THE PARENT THEY HANG ON. `flat2d` is heavy
     * atoms only, and a page that draws H cannot use a layout that leaves them
     * out — glycerol's three hydroxyl H are the atoms an esterification
     * consumes, and an amino acid's N–H is half of a peptide bond.
     *
     * Two conventions, both the drawing's rather than the molecule's:
     *   · ONE heavy neighbour — a hydroxyl, an amine on a terminal N, a methyl
     *     — the H fan out at ±120° and 180° off that bond. Bent, the way a
     *     diagram draws –OH, and never collinear, which is what an "opposite
     *     the neighbour" rule gives and what makes a bond look like a straight
     *     line through an atom.
     *   · TWO OR MORE — the H go in the hole: opposite the sum of the heavy
     *     bonds, spread ±60° when there are two of them. That is where a
     *     drawing puts the H on a CH2, and it is the only direction left.
     * With one H on a one-neighbour parent the side is free, and it is taken
     * away from the middle of the molecule so the group has room to react.
     */
    const rot = (v, t) => [v[0]*Math.cos(t) - v[1]*Math.sin(t),
                           v[0]*Math.sin(t) + v[1]*Math.cos(t), 0];
    // The role an atom is the kept end of, and the atom at the unit's OTHER end.
    // Only meaningful for a two-ended unit: glycerol has three roles and no
    // "other end", so its hydrogens keep the away-from-the-middle rule.
    const roles = (s.condense && s.condense.roles) || [];
    const roleOf = i => roles.find(r => r.keep === i) || null;
    const otherKeep = mine => {
      if(roles.length !== 2) return null;
      const o2 = roles.find(r => r !== mine);
      return o2 ? o2.keep : null;
    };
    const parents = new Map();
    s.atoms.forEach((a,i) => {
      if(a.el !== 'H') return;
      const o = bondedTo(s, i).find(j => s.atoms[j].el !== 'H');
      if(o == null) return;
      if(!parents.has(o)) parents.set(o, []);
      parents.get(o).push(i);
    });

    for(const [o, hs] of parents){
      if(!pos[o]) return null;
      const heavy = bondedTo(s, o).filter(j => s.atoms[j].el !== 'H');
      if(!heavy.length || heavy.some(j => !pos[j])) return null;
      let dirs;
      if(heavy.length === 1){
        const back = unit(sub(pos[heavy[0]], pos[o]));   // parent → its neighbour
        const spread = hs.length === 1 ? [[Math.PI*2/3], [-Math.PI*2/3]]
                     : hs.length === 2 ? [[Math.PI*2/3, -Math.PI*2/3]]
                     : [[Math.PI*2/3, -Math.PI*2/3, Math.PI]];
        // One H: whichever side lands farther from the middle of the molecule.
        const pick = spread.length > 1
          ? spread.map(t => rot(back, t[0]))
              .sort((a,b) => len(sub(add(pos[o], b), mid)) - len(sub(add(pos[o], a), mid)))
              .slice(0,1)
          : spread[0].map(t => rot(back, t));
        dirs = pick;
      }else{
        const sum = heavy.reduce((v,j) => add(v, unit(sub(pos[j], pos[o]))), [0,0,0]);
        /* NO ROOM MEANS NOT DRAWN. Three bonds around a carbon fill the plane —
         * their directions cancel, so there is no hole and any direction picked
         * here is a lie that lands the H on top of a neighbour (alanine's put it
         * 0.32 A inside the amino nitrogen). A diagram does not draw that
         * hydrogen at all, so the layout folds it onto its own carbon, which is
         * molview.js's move for the same problem: it disappears into the atom it
         * hangs on rather than being deleted or invented somewhere.
         *
         * No atom that REACTS is ever in this case — a leaving H sits on an O or
         * an N with one heavy neighbour — so nothing the page needs is folded. */
        if(len(sum) < 0.35){ hs.forEach(i => { pos[i] = pos[o].slice(); }); continue; }
        const hole = mul(unit(sum), -1);
        dirs = hs.length === 1 ? [hole]
             : hs.map((_,n) => rot(hole, (n - (hs.length-1)/2) * Math.PI/3));
      }
      /* WHICH H LEAVES DECIDES WHICH DIRECTION IT GETS. On an amino nitrogen the
       * two hydrogens are interchangeable atoms and the layout may hand them
       * either slot — but one of them is about to be replaced by the next
       * residue's carbonyl carbon, and the OTHER one has to live beside it. Give
       * the leaving H the slot pointing up-chain, away from this unit's own far
       * end, and the survivor takes the slot pointing down-chain, out of the way
       * of the carbon arriving. Ordered the other way it lands 1.0 A inside that
       * carbon: a real clash, in a picture that still renders.
       *
       * Nothing here decides WHERE the bond goes — the pose does — so this is a
       * drawing decision about a hydrogen, which is what a layout is for. */
      const mine = roleOf(o), far = mine && otherKeep(mine);
      const order = hs.slice();
      if(mine && far != null && dirs.length > 1){
        const leaving = mine.leaves.filter(i => hs.includes(i));
        if(leaving.length === 1){
          const best = dirs.map((v,n) => [n, len(sub(add(pos[o], v), pos[far]))])
            .sort((a,b) => b[1] - a[1])[0][0];
          order.splice(order.indexOf(leaving[0]), 1);
          order.splice(best, 0, leaving[0]);
        }
      }
      order.forEach((i,n) => {
        // The H–O bond keeps its real length; only the direction is the drawing's.
        const L = len(sub(s.atoms[i].pos, s.atoms[o].pos));
        pos[i] = add(pos[o], mul(unit(dirs[n] || dirs[0]), L));
      });
    }
    return { ...s, atoms: s.atoms.map((a,i) => ({ el:a.el, pos:pos[i] })), flatBuilt:true };
  }

  /* ---- one planar condensation, three role pairs --------------------------
   * All three bonds this folder builds are the same construction: one molecule
   * KEEPS an atom and loses what was attached to it, the other arrives along
   * that vacated direction, and one turn about the new bond is left free. The
   * round versions differ in what they measure it against; flattened, they
   * differ only in which roles they read and what the free turn is set to. So
   * there is one function here and three callers, rather than three copies of
   * a rotation that has to stay in step.
   *
   * `where` returns the same shape peptide.js, glycosidic.js and ester.js do,
   * so plane.js cannot tell any of the six latches apart.
   */
  /* The atom at a spec's OTHER end, moved by `put` if it is being placed.
   * ROLE, NOT FREE: the atom a role keeps survives the reaction — a mid-chain
   * residue still has the N it bonded through — and it is the chain's incoming
   * point whether or not it can still react. Asking for the free ones instead
   * makes every unit past the first fall back to its centre, and the measure
   * below then compares two blobs and picks wrong.
   *
   * A unit with no such role at all (a fatty acid has one end and no second)
   * answers with its centre, so the caller still gets something to compare. */
  function end(spec, roleKey, put){
    const f = roleKey && Spec.role(spec, roleKey);
    const p = f ? spec.atoms[f.keep].pos
      : mul(spec.atoms.filter(a => a.el !== 'H').reduce((v,a) => add(v, a.pos), [0,0,0]),
            1 / Math.max(spec.atoms.filter(a => a.el !== 'H').length, 1));
    return put ? put(p) : p;
  }

  function where(host, guest, hRole, gRole, o){
    const ha = Spec.free(host, hRole), ga = Spec.free(guest, gRole);
    if(!ha || !ga) return null;
    if(!isFlat(host) || !isFlat(guest)) return null;
    const P = (s,i) => s.atoms[i].pos;

    const A = P(host, ha.keep);                    // the atom the host KEEPS
    const B = P(host, ha.leaves[0]);               // and the one that goes
    const dir = unit(sub(B, A));
    const L = typeof o.len === 'function' ? o.len(host, guest, ha, ga) : o.len;
    const At = add(A, mul(dir, L));                // where the guest's atom lands

    // Turn the guest IN THE PLANE until its own leaving group points back down
    // the new bond. One rotation about z, and a z rotation is the only one that
    // leaves a flat molecule flat.
    const K = P(guest, ga.keep), Gl = P(guest, ga.leaves[0]);
    const from = unit(sub(Gl, K)), to = mul(dir, -1);
    const ang = Math.atan2(from[0]*to[1] - from[1]*to[0], from[0]*to[0] + from[1]*to[1]);
    let q = qAxis([0,0,1], ang);
    const put = (qq, p) => add(qrot(qq, sub(p, K)), At);
    const flip = qq => qmul(qAxis(dir, Math.PI), qq);   // in-plane: stays in-plane

    if(o.tor != null){
      /* THE ONE TURN NOTHING ELSE DECIDES, set to the value the round bond is
       * asserted at — Z for an ester. In a plane a torsion can only be 0 or
       * 180, so it is reachable exactly and the flat build makes the same claim
       * the model does rather than an approximation of it. Measured, never
       * assumed: which of the two the construction lands on depends on the
       * conformer it started from. */
      const ref = o.ref(host, guest, ha, ga);
      const t = () => Ester.torsion(P(host, ref[0]), A, At, put(q, P(guest, ref[1])));
      if(Math.abs(Math.abs(t() - o.tor) % (2*Math.PI)) > Math.PI/2) q = flip(q);
    }else{
      /* A CHAIN IS LAID OUT AS A CHAIN. Composing depictions that were each
       * solved alone does not give one: every monomer's leaving group comes off
       * its own backbone at the layout's angle, so aligning the guest by that
       * group turns the chain the same way at every unit and four of them close
       * into a ring, residues 1 and 3 overlapping. Choosing between the two
       * mirror images does not save it — both turn.
       *
       * So for a chain the guest's spin is set by its OWN BACKBONE instead: the
       * vector from the end it just bonded through to the end still open is
       * turned to continue the host's, and the chain runs across the page the
       * way a drawn one does.
       *
       * WHAT THAT GIVES UP, and it is the drawing's to give up: the guest's
       * departing group no longer points back down the bond it is making. It is
       * gone a moment later — this is the frame before a condensation, not a
       * mechanism — and the atom that MATTERS still lands exactly where the
       * host's leaving group was, at the bond's own length, because that half is
       * the host's and is untouched. The 3D pose asserts the real torsions, and
       * the reveal is where they arrive. */
      /* THE AXIS IS THE STEP THE CHAIN JUST TOOK, not the host's backbone.
       * Aligning backbones leaves each unit displaced sideways by however far
       * the leaving group sits off its own backbone, and four of those stack
       * into a staircase that folds back on itself. Pointing each unit along
       * the direction from the end it came in by to the bond it is making is
       * self-similar — the next step reproduces it — so the chain is straight
       * by construction rather than by luck. */
      const back = Spec.role(host, o.ends[0]);
      const want = back ? unit(sub(At, host.atoms[back.keep].pos)) : null;
      const gb = Spec.role(guest, o.ends[0]), gf = Spec.role(guest, o.ends[1]);
      const have = (gb && gf)
        ? unit(sub(guest.atoms[gf.keep].pos, guest.atoms[gb.keep].pos)) : null;
      if(want && have){
        const ang2 = Math.atan2(have[0]*want[1] - have[1]*want[0],
                                have[0]*want[0] + have[1]*want[1]);
        q = qAxis([0,0,1], ang2);
      }
    }

    const oIx = o.tor != null ? o.ref(host, guest, ha, ga)[1] : ga.keep;
    return {
      pos: sub(At, qrot(q, K)), quat: q, slot: hRole,
      at: K,                                       // the bonding atom, guest frame
      bondAt: mul(add(A, At), 0.5),
      // The water assembles between the two groups that gave it up.
      waterAt: mul(add(B, put(q, Gl)), 0.5),
      twist: Ester.torsion(P(host, (o.ref ? o.ref(host, guest, ha, ga)[0] : ha.keep)),
                           A, At, put(q, P(guest, oIx))),
      clash: null,
    };
  }

  /* The three. Each one is its round counterpart's roles and its asserted turn,
   * and nothing else: the lengths come from those files (or off the guest's own
   * bond) so the flat build cannot drift from the model it morphs into. */
  const pose = (host, acid, slot) => where(host, acid, slot, 'carboxyl', {
    len: Ester.CO, tor: Ester.ZTOR,
    ref: (h, g, ha, ga) => [Ester.alkylC(h, ha.keep),
                            Ester.carbonylO(g, ga.keep, ga.leaves)],
  });

  /* NO OMEGA IN A DRAWING. The round bond is asserted trans and the reveal is
   * where that lands; flat, the same assertion fixes the one free turn and the
   * chain then bends the same way at every residue, because each layout's N–H
   * comes off its own backbone at the same angle. Four residues coil into a
   * ball. So the flat build spends that turn the way a textbook does — on
   * keeping the chain extended — and omega goes back to being the model's.
   *
   * The turn is a half turn about the new bond, which for a molecule lying in
   * the plane is an in-plane MIRROR of the guest. Safe only because a layout
   * makes no stereo claim to mirror: bake-flat2d.js hands RDKit no chiral flag
   * (its header says why), the spheres carry no wedges, and the configuration
   * lives in the spec the reveal morphs to, which nothing here touches. */
  const peptide = (host, guest) => where(host, guest, 'carboxyl', 'amino', {
    len: Peptide.CN, tor: null, ends: ['amino', 'carboxyl'],
    ref: (h, g) => [Peptide.alphaOf(h), Peptide.alphaOf(g)],
  });

  const glycosidic = (host, guest) => (guest.key !== host.key)
    // Two different anomers joined is a linkage nothing measures, and
    // glycosidic.js refuses it for that reason. Refused here on the same test,
    // written the same way — a flat build that accepted what the round one
    // rejects would assemble a chain the reveal has no pose for.
    ? null
    : where(host, guest, 'c1', 'c4', {
        // MEASURED off the bond the acceptor is giving up, not typed: the new
        // C–O replaces the C4–O4 this sugar already carries.
        len: (h, g, ha, ga) => len(sub(g.atoms[ga.keep].pos, g.atoms[ga.leaves[0]].pos)),
        tor: null, ends: ['c4', 'c1'],
      });

  const API = { spec, pose, peptide, glycosidic, where, isFlat };
  if(typeof module === 'object' && module.exports) module.exports = API;
  global.MacroFlat = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
