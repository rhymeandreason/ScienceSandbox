/* =============================================================================
 *  macromolecule/glycosidic.js — where the next sugar has to sit
 * =============================================================================
 *  A glycosidic bond is a condensation like any other: one sugar's anomeric
 *  –OH meets another's C4 –OH, one water leaves. What is not like the peptide
 *  bond is where the answer comes from.
 *
 *  NOTHING HERE IS CONSTRUCTED. A peptide bond can be built out of its own
 *  length and the direction of the leaving group, because the one remaining
 *  degree of freedom, omega, is a fact (trans). A glycosidic linkage's two
 *  torsions are not: phi and psi about the bridge are what decide whether the
 *  chain runs flat or coils, and there is no single value either of them has to
 *  take. So they are not invented here. They are READ OFF THE DISACCHARIDE the
 *  library already carries, whose phi/psi were solved by tools/solve-linkage.js
 *  against the helix the real polymer forms, and which chain/check-chain.js
 *  re-measures on every build.
 *
 *  THE POSE IS A CONJUGATION, and it is three steps:
 *
 *    1. `match` our monomer's triad onto residue A of the disaccharide. Both
 *       are the same ring built by the same builder, so O5/C1/C4 correspond by
 *       NAME — that is what makes step 3 legitimate rather than a fit.
 *    2. Take the screw that carries residue A onto residue B. That is the
 *       linkage, and it is the only geometry being claimed.
 *    3. Carry it back through step 1's transform.
 *
 *  Which disaccharide is looked up decides everything downstream: cellobiose
 *  gives beta-1,4 and a chain that stays flat, maltose gives alpha-1,4 and a
 *  chain that turns out of the plane every residue. The page does not choose a
 *  shape; it chooses a sugar, and the shape is what that sugar's linkage does.
 *
 *  THE RESIDUE THAT LOSES ITS ATOMS IS THE ACCEPTOR, not the donor: the bridge
 *  oxygen is the DONOR's anomeric O, and the acceptor gives up its whole C4
 *  hydroxyl. `condense:` says so and this file never counts it off the formula.
 *
 *  Angstroms in, angstroms out. No THREE, Node-loadable.
 * ========================================================================== */
(function(global){
  'use strict';

  const req = p => (typeof require === 'function' ? require(p) : null);
  const Spec  = global.MacroSpec     || req('./spec.js');
  const Frame = global.CondenseFrame || req('../chain/frame.js');

  // The ring triad every sugar here is matched on. Three points fix a rigid
  // body; these three are on the ring itself and span it, so a triad that is
  // nearly collinear (which would make the basis ill-conditioned) cannot arise.
  const TRIAD = ['O5', 'C1', 'C4'];

  /* Which disaccharide carries which linkage. The KEY IS THE MONOMER: a page
   * puts beta-glucose on the stage and gets cellulose's bond, because that is
   * what beta-glucose makes. Nothing here is a mode the page picks. */
  const LINKAGE = {
    glucose:      { via:'cellobiose', config:'beta',  link:'1→4', polymer:'cellulose' },
    alphaGlucose: { via:'maltose',    config:'alpha', link:'1→4', polymer:'starch' },
  };

  const at = (spec, name) => {
    const i = (spec.names || []).indexOf(name);
    return i < 0 ? null : spec.atoms[i].pos;
  };
  const triadOf = (spec, suffix) => {
    const p = TRIAD.map(n => at(spec, n + (suffix || '')));
    return p.every(Boolean) ? p : null;
  };

  const linkageFor = spec => LINKAGE[spec.key] || LINKAGE[keyOf(spec)] || null;
  // A registered spec does not carry its own registry key, and the page has no
  // business passing one in: the name is the spec's, so read it from there.
  function keyOf(spec){
    for(const k in LINKAGE) if(LINKAGE[k].name === spec.name) return k;
    return null;
  }

  /* Where `guest` must sit for its C4 to bond to `host`'s anomeric carbon, with
   * the host at the origin unrotated. Returns the same shape peptide.js does,
   * so plane.js cannot tell the two latches apart. */
  function pose(host, guest, lib){
    const hc = Spec.free(host, 'c1'), ga = Spec.free(guest, 'c4');
    if(!hc || !ga) return null;
    const L = LINKAGE[host.key];
    if(!L) return null;
    // Both residues of a chain have to be the same sugar: a beta and an alpha
    // glucose joined would be a linkage no disaccharide here measures, and
    // reading one of the two tables for it would be inventing the other.
    if(guest.key !== host.key) return null;
    const di = lib[L.via];
    if(!di) return null;

    const mono = triadOf(host);
    const A = triadOf(di, 'A'), B = triadOf(di, 'B');
    if(!mono || !A || !B) return null;

    // 1 + 2 + 3: our monomer onto residue A, then wherever B sits, expressed
    // back in our monomer's own frame.
    const toA   = Frame.match(mono, A);
    const fromA = Frame.match(A, mono);
    const place = p => Frame.apply(fromA, Frame.apply(Frame.match(A, B), Frame.apply(toA, p)));

    // A rigid transform, recovered from where three known points land. The
    // guest is the same spec as the host, so its triad is `mono` too.
    const put = mono.map(place);
    const m = Frame.match(mono, put);
    const q = quatOf(m.r);
    const pos = Frame.sub(m.t, rotv(m.r, m.o));

    const bridge = at(host, 'O1');                 // the donor keeps its own O1
    const C4 = place(at(guest, 'C4'));
    return {
      pos, quat:q,
      config:L.config, link:L.link, polymer:L.polymer,
      bondAt: Frame.scale(Frame.add(bridge, C4), 0.5),
      // The water assembles between the two groups that gave it up: the host's
      // anomeric H and the acceptor's whole hydroxyl.
      waterAt: Frame.scale(Frame.add(at(host, 'HO1'), place(at(guest, 'O4'))), 0.5),
      clash: null,
    };
  }

  const rotv = (r, v) => [Frame.dot(r[0], v), Frame.dot(r[1], v), Frame.dot(r[2], v)];

  /* A rotation matrix as [x,y,z,w]. Shepperd's method: the naive formula
   * divides by a term that goes to zero at a half turn, and a half turn is
   * exactly what beta-1,4 is — so the branch that looks like an edge case here
   * is the case cellulose lands in. */
  function quatOf(r){
    const t = r[0][0] + r[1][1] + r[2][2];
    let q;
    if(t > 0){ const s = Math.sqrt(t + 1) * 2;
      q = [(r[2][1]-r[1][2])/s, (r[0][2]-r[2][0])/s, (r[1][0]-r[0][1])/s, 0.25*s]; }
    else if(r[0][0] > r[1][1] && r[0][0] > r[2][2]){
      const s = Math.sqrt(1 + r[0][0] - r[1][1] - r[2][2]) * 2;
      q = [0.25*s, (r[0][1]+r[1][0])/s, (r[0][2]+r[2][0])/s, (r[2][1]-r[1][2])/s]; }
    else if(r[1][1] > r[2][2]){
      const s = Math.sqrt(1 + r[1][1] - r[0][0] - r[2][2]) * 2;
      q = [(r[0][1]+r[1][0])/s, 0.25*s, (r[1][2]+r[2][1])/s, (r[0][2]-r[2][0])/s]; }
    else { const s = Math.sqrt(1 + r[2][2] - r[0][0] - r[1][1]) * 2;
      q = [(r[0][2]+r[2][0])/s, (r[1][2]+r[2][1])/s, 0.25*s, (r[1][0]-r[0][1])/s]; }
    const n = Math.hypot(q[0], q[1], q[2], q[3]);
    return q.map(v => v/n);
  }

  const react = (host, guest) => Spec.react(host, guest, 'c1', 'c4');

  /* ---- laying the chain on the table ---------------------------------------
   * A two-fold screw generates a FLAT ribbon: repeat beta-1,4 and every residue
   * centroid lands in one plane, exactly. But which plane depends on how the
   * first sugar happens to be turned, and a ribbon standing on edge reads as a
   * coil. So the first monomer is turned so that plane IS z = 0 — the plane the
   * pointer drags on — and the chain grows along +X across it.
   *
   * NOTHING HERE MAKES A CHAIN FLAT. The rotation is derived from where the
   * first three residues actually land, so it puts the chain's OWN plane on the
   * table and no more. Alpha-1,4 gets the same treatment and still climbs out
   * of it by the fourth residue, because a six-fold helix has no plane to find:
   * that departure is the lesson, and it would be a lie if this function had
   * flattened anything.
   */
  function startQuat(spec, lib){
    const r = pose(spec, spec, lib);
    if(!r) return [0,0,0,1];
    const heavy = spec.atoms.filter(a => a.el !== 'H');
    const cen = heavy.reduce((v,a) => Frame.add(v, a.pos), [0,0,0])
                     .map(v => v/heavy.length);
    // Three consecutive residue centroids, by accumulating the pose.
    const pts = []; let q = [0,0,0,1], p = [0,0,0];
    for(let i = 0; i < 3; i++){
      pts.push(Frame.add(qapp(q, cen), p));
      p = Frame.add(qapp(q, r.pos), p); q = qmul(q, r.quat);
    }
    const along = Frame.unit(Frame.sub(pts[1], pts[0]));
    const normal = Frame.unit(Frame.cross(along, Frame.sub(pts[2], pts[0])));
    // Turn the plane's normal onto +Z, then the chain's direction onto +X.
    const q1 = qBetween(normal, [0,0,1]);
    const q2 = qBetween(qapp(q1, along), [1,0,0]);
    return qmul(q2, q1);
  }

  function qBetween(a, b){
    const d = Frame.dot(a, b);
    if(d > 0.999999) return [0,0,0,1];
    if(d < -0.999999){
      const perp = Math.abs(a[0]) < 0.9 ? [1,0,0] : [0,1,0];
      const ax = Frame.unit(Frame.cross(a, perp));
      return [ax[0], ax[1], ax[2], 0];
    }
    const c = Frame.cross(a, b), q = [c[0], c[1], c[2], 1 + d];
    const n = Math.hypot(q[0], q[1], q[2], q[3]);
    return q.map(v => v/n);
  }
  const qmul = (a,b) => [
    a[3]*b[0] + a[0]*b[3] + a[1]*b[2] - a[2]*b[1],
    a[3]*b[1] - a[0]*b[2] + a[1]*b[3] + a[2]*b[0],
    a[3]*b[2] + a[0]*b[1] - a[1]*b[0] + a[2]*b[3],
    a[3]*b[3] - a[0]*b[0] - a[1]*b[1] - a[2]*b[2]];
  const qapp = (q,v) => {
    const [x,y,z,w] = q;
    const tx = 2*(y*v[2] - z*v[1]), ty = 2*(z*v[0] - x*v[2]), tz = 2*(x*v[1] - y*v[0]);
    return [v[0] + w*tx + y*tz - z*ty,
            v[1] + w*ty + z*tx - x*tz,
            v[2] + w*tz + x*ty - y*tx];
  };

  const API = { pose, react, startQuat, TRIAD, LINKAGE, quatOf };
  if(typeof module === 'object' && module.exports) module.exports = API;
  global.Glycosidic = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
