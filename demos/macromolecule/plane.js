/* =============================================================================
 *  macromolecule/plane.js — loose molecules on a flat plane, and what sticks
 * =============================================================================
 *  THE GESTURE, LIFTED FROM dna-lab.html STEP 1. Molecules lie on z = 0, the
 *  pointer is projected onto that plane, and pushing one into another either
 *  works or does not. Nothing refuses a drag, nothing is greyed out, nothing
 *  announces the rule: a pairing that does not hold can be shoved together all
 *  day and will not stick, and that is how the rule gets discovered rather
 *  than read.
 *
 *  Everything above is generic. What is NOT generic — which pairs hold, where
 *  the guest lands, what the join produces — arrives as `solve` and `join` in
 *  the options. Base pairing is one latch; a condensation is another. This
 *  file knows about neither.
 *
 *  WHAT IT OWNS
 *    · the z = 0 pointer projection, the pick, and pointer capture
 *    · a piece: one draggable mesh, its spec, its DOM tag
 *    · dragging a BONDED GROUP as one rigid body — every piece carries its own
 *      offset from the pointer, so the group keeps its internal geometry
 *      exactly. Re-solving mid-drag is what lets a joined chain jitter
 *    · the proximity test against the solved pose, and the snap tween
 *    · rebuilding a piece's mesh when its spec changes, and disposing the old
 *
 *  WHAT IT DOES NOT OWN, and must not: chemistry, captions, camera, layout,
 *  or what a join means. A latch that needs a new option to know what reacted
 *  is a latch that belongs in the page.
 *
 *  THE DRAG IS PLANAR; THE SNAP IS NOT. The pointer only means anything on a
 *  plane the student is looking at face-on, so a piece is moved in x and y.
 *  Where it LANDS is a full transform out of `solve`, because a real pose is
 *  six numbers and flattening it to three would draw a molecule no chemistry
 *  put there. Amino acids are not planar; the plane is the tabletop, not a
 *  claim about the molecules on it.
 *
 *  Loads after THREE, scene.js and kit/motion.js.
 * ========================================================================== */
(function(global){
  'use strict';

  /* ---- putting a solved pose on the stage ---------------------------------
   * `solve` answers with the host at the origin unrotated, because a join is a
   * relationship between two molecules and not a place on stage. These two put
   * that answer somewhere, and which one is used depends on which molecule the
   * student is holding.
   *
   * THE TWO ARE NOT TWO SOLVES. Asking the solver again with the arguments
   * swapped is a DIFFERENT REACTION — for a condensation, the guest's donor
   * onto the host's acceptor, a bond pointing the other way down the chain —
   * and it places both molecules somewhere real, so the page renders a
   * confident, wrong join. There is ONE pose. Whichever molecule is not moving
   * is the one it is measured from, and the other end of it is that pose
   * inverted, never re-solved.
   *
   * Plain arrays, so the algebra that decides where two molecules end up can be
   * checked in Node. THREE never reaches this far; `create` converts at the
   * boundary. Quaternions are [x,y,z,w], the order THREE uses.
   */
  const qmul = (a,b) => [
    a[3]*b[0] + a[0]*b[3] + a[1]*b[2] - a[2]*b[1],
    a[3]*b[1] - a[0]*b[2] + a[1]*b[3] + a[2]*b[0],
    a[3]*b[2] + a[0]*b[1] - a[1]*b[0] + a[2]*b[3],
    a[3]*b[3] - a[0]*b[0] - a[1]*b[1] - a[2]*b[2]];
  const qconj = q => [-q[0], -q[1], -q[2], q[3]];
  const qapp = (q,v) => {
    const [x,y,z,w] = q;
    const tx = 2*(y*v[2] - z*v[1]), ty = 2*(z*v[0] - x*v[2]), tz = 2*(x*v[1] - y*v[0]);
    return [v[0] + w*tx + y*tz - z*ty,
            v[1] + w*ty + z*tx - x*tz,
            v[2] + w*tz + x*ty - y*tx];
  };
  const vadd = (a,b) => [a[0]+b[0], a[1]+b[1], a[2]+b[2]];
  const vsub = (a,b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];

  // Where the guest goes, given where the host is.
  function compose(hostAt, s){
    return { pos: vadd(qapp(hostAt.quat, s.pos), hostAt.pos),
             quat: qmul(hostAt.quat, s.quat) };
  }
  // Where the host goes, given where the guest is. The exact inverse of the
  // above: compose(invert(g, s), s) is g again, for every g and every s.
  function invert(guestAt, s){
    const quat = qmul(guestAt.quat, qconj(s.quat));
    return { pos: vsub(guestAt.pos, qapp(quat, s.pos)), quat };
  }

  function create(opts){
    const THREE = global.THREE;
    const o = Object.assign({
      latchR: 3.4,        // how close the solved pose has to be, in world units
      pickR: 7,           // grab radius about a piece's heavy-atom centroid
      snap: 0.28,         // seconds
      tagClass: 'tag',
    }, opts);
    const { canvas, camera, root, motion, stageEl } = o;

    const pieces = [];
    // Undirected: a join is a fact about two pieces, and the drag walks it in
    // whichever direction it arrives from.
    const links = [];

    /* ---- a piece ---------------------------------------------------------- */
    function add(spec, at, quat, extra){
      const p = Object.assign({ spec, mol:null, tag:null }, extra || {});
      p.tag = document.createElement('div');
      p.tag.className = o.tagClass;
      stageEl.appendChild(p.tag);
      rebuild(p, spec, at, quat || new THREE.Quaternion());
      pieces.push(p);
      return p;
    }

    /* Replace a piece's spec and its mesh. The departing atoms of a
     * condensation have to actually GO: hiding them leaves them in the bond
     * list, and a hidden atom is still a claim about what the molecule is. */
    function rebuild(p, spec, at, quat){
      const old = p.mol;
      p.spec = spec;
      p.mol = o.build(spec);
      p.mol.position.copy(at || (old ? old.position : new THREE.Vector3()));
      p.mol.quaternion.copy(quat || (old ? old.quaternion : new THREE.Quaternion()));
      root.add(p.mol);
      // buildMolecule makes a geometry per atom and per bond, so a rebuilt
      // molecule leaks both unless the old tree goes with it.
      if(old){ root.remove(old); old.traverse(x => { if(x.geometry) x.geometry.dispose(); }); }
      p.centre = centroid(spec);
      if(o.onRebuild) o.onRebuild(p);
      return p;
    }

    function centroid(spec){
      const h = spec.atoms.filter(a => a.el !== 'H');
      return h.reduce((v,a) => v.add(new THREE.Vector3(...a.pos)), new THREE.Vector3())
              .multiplyScalar(1/(h.length || 1));
    }
    const centreOf = p => p.centre.clone().applyQuaternion(p.mol.quaternion).add(p.mol.position);
    const atomAt = (p, i) => new THREE.Vector3(...p.spec.atoms[i].pos)
      .applyQuaternion(p.mol.quaternion).add(p.mol.position);

    /* Every piece reachable from `p` through joins — the thing that moves when
     * the student drags one end of a chain. */
    function group(p){
      const seen = new Set([p]), queue = [p];
      while(queue.length){
        const cur = queue.pop();
        for(const l of links){
          const other = l.a === cur ? l.b : l.b === cur ? l.a : null;
          if(other && !seen.has(other)){ seen.add(other); queue.push(other); }
        }
      }
      return [...seen];
    }

    /* ---- the plane -------------------------------------------------------- */
    const plane = new THREE.Plane(new THREE.Vector3(0,0,1), 0);
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), hit = new THREE.Vector3();
    function toWorld(e){
      const r = canvas.getBoundingClientRect();
      ndc.set((e.clientX-r.left)/r.width*2-1, -((e.clientY-r.top)/r.height*2-1));
      ray.setFromCamera(ndc, camera);
      ray.ray.intersectPlane(plane, hit);
      return hit;
    }
    const nearest = w => pieces.map(p => ({ p, d:w.distanceTo(centreOf(p)) }))
      .filter(x => x.d < o.pickR).sort((a,b) => a.d - b.d)[0];

    /* ---- drag ------------------------------------------------------------- */
    let held = null, dragging = [];

    function down(e){
      const n = nearest(toWorld(e));
      if(!n) return false;
      held = n.p;
      dragging = group(held).map(p => ({ p, off:p.mol.position.clone().sub(hit) }));
      try{ canvas.setPointerCapture(e.pointerId); }catch(_){}
      return true;
    }
    function move(e){
      if(!held) return false;
      const w = toWorld(e);
      for(const d of dragging){ d.p.mol.position.copy(w).add(d.off); d.p.mol.position.z = 0; }
      tryLatch();
      if(o.onMove) o.onMove();
      return true;
    }
    function up(e){
      held = null; dragging = [];
      try{ canvas.releasePointerCapture(e.pointerId); }catch(_){}
    }

    /* THE LATCH. Near the solved pose against any other piece and it snaps in,
     * but only if `solve` returned one. Both orderings are tried: which of two
     * molecules a solver happens to frame its answer "from" is an accident of
     * the solver, and the student has no idea which. */
    function tryLatch(){
      if(!held) return;
      const heldGroup = new Set(group(held));
      for(const other of pieces){
        if(heldGroup.has(other)) continue;
        for(const [host, guest] of [[other, held], [held, other]]){
          const s = o.solve(host, guest);
          if(!s) continue;
          const t = placeGuest(host, s);
          // Where the guest would have to be, against where it is. The test is
          // symmetric: dragging the host moves the target instead of the piece,
          // and the same distance closes either way.
          if(guest.mol.position.distanceTo(t.pos) > o.latchR) continue;
          // The pose is no longer the pointer's to set. Dropping the drag here
          // lets the tween land exactly on the solved pose instead of fighting
          // a cursor that is still moving.
          held = null; dragging = [];
          latch(host, guest, s, heldGroup);
          return;
        }
      }
    }

    /* `solve` answers with the host at the origin unrotated, because a join is
     * a relationship between two molecules and not a place on stage. Putting
     * that answer on the stage is this file's job, and there are two ways round
     * it — the student may be holding either molecule.
     *
     * THE TWO ARE NOT TWO SOLVES. Asking the solver again with the arguments
     * swapped is a DIFFERENT REACTION — the guest's carboxyl onto the host's
     * amino, a bond pointing the other way down the chain — and it places both
     * molecules somewhere real, so the page renders a confident, wrong join.
     * There is one pose; whichever molecule is not being held is the one it is
     * measured from, and the other end of it is that pose inverted. */
    // THREE in, THREE out; the algebra itself is the module-level pair above.
    const whereIs = p => ({ pos:p.mol.position.toArray(), quat:p.mol.quaternion.toArray() });
    const asThree = r => ({ pos:new THREE.Vector3(...r.pos),
                            quat:new THREE.Quaternion(...r.quat) });
    const local = s => ({ pos:s.pos.toArray(), quat:s.quat.toArray() });
    const placeGuest = (host,  s) => asThree(compose(whereIs(host),  local(s)));
    const placeHost  = (guest, s) => asThree(invert (whereIs(guest), local(s)));
    // A point of the solved pose in world space, read from wherever the host
    // ACTUALLY is. Called after the snap lands, never from the transform the
    // snap started with: when the host is the piece that moved, the two differ
    // by the whole length of the tween.
    const inHost = (host, v) => v.clone().applyQuaternion(host.mol.quaternion)
                                 .add(host.mol.position);

    /* The snap. Whichever piece the student was holding is the one that moves,
     * and it moves with everything already joined to it: a chain dragged by one
     * end is one object, and tweening a single residue out of it tears the
     * chain apart while every bond still renders. */
    function latch(host, guest, s, heldGroup){
      const mover = heldGroup.has(guest) ? guest : host;
      const target = mover === guest ? placeGuest(host, s) : placeHost(guest, s);
      const tag = 'latch:' + pieces.indexOf(mover);
      if(motion) motion.cancel(tag);

      // The rigid motion taking the mover to its target, as a delta the rest of
      // the mover's group rides on.
      const dq = target.quat.clone().multiply(mover.mol.quaternion.clone().invert());
      const riders = [...heldGroup].map(p => ({
        p,
        fromPos: p.mol.position.clone(), fromQuat: p.mol.quaternion.clone(),
        toPos: target.pos.clone().add(
          p.mol.position.clone().sub(mover.mol.position).applyQuaternion(dq)),
        toQuat: dq.clone().multiply(p.mol.quaternion),
      }));

      const land = () => {
        links.push({ a:host, b:guest });
        if(o.onJoin) o.onJoin(host, guest, {
          bondAt:  inHost(host, s.bondAt),
          waterAt: inHost(host, s.waterAt),
          pose: s });
      };
      const put = u => {
        for(const r of riders){
          r.p.mol.position.lerpVectors(r.fromPos, r.toPos, u);
          THREE.Quaternion.slerp(r.fromQuat, r.toQuat, r.p.mol.quaternion, u);
        }
      };
      if(!motion){ put(1); land(); return; }
      motion.seq([
        { dur:o.snap, ease:'outBack', onUpdate:u => { put(u); if(o.onMove) o.onMove(); } },
        { call:land },
      ], { tag });
    }

    /* Pull two pieces apart. A drag is how a group gets MOVED, so breaking one
     * needs its own gesture rather than happening by accident. */
    function breakAt(p){
      const i = links.findIndex(l => l.a === p || l.b === p);
      if(i < 0) return null;
      const l = links.splice(i, 1)[0];
      if(o.onBreak) o.onBreak(l.a, l.b);
      return l;
    }

    /* Pin each piece's tag to the molecule it names. Called from afterFrame:
     * projection reads a matrix that is only refreshed on render. */
    const _v = new THREE.Vector3();
    function placeTags(){
      const r = canvas.getBoundingClientRect();
      for(const p of pieces){
        if(p.tag.style.display === 'none') continue;
        _v.copy(centreOf(p)).project(camera);
        p.tag.style.left = ((_v.x*0.5+0.5) * r.width) + 'px';
        p.tag.style.top  = ((-_v.y*0.5+0.5) * r.height + (o.tagDrop||0)) + 'px';
      }
    }

    return { add, rebuild, pieces, links, group, centreOf, atomAt, centroid,
             toWorld, nearest, down, move, up, breakAt, placeTags,
             get held(){ return held; } };
  }

  const API = { create, compose, invert };
  if(typeof module === 'object' && module.exports) module.exports = API;
  global.MacroPlane = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
