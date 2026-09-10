/* =============================================================================
 *  macromolecule/nucleoside.js — where a base sits on its sugar
 * =============================================================================
 *  The fourth condensation, and the one the library had the data for and no way
 *  to run: a sugar's anomeric –OH meets a base's ring N–H, one water leaves, and
 *  what is left is a nucleoside. `deoxyribose` declares the roles, each base
 *  declares `glyco`, and check-molecules.js already audits both.
 *
 *  MEASURED, NOT CONSTRUCTED, which is glycosidic.js's method and this is a port
 *  of it. The N-glycosidic bond has a torsion (chi) that nothing here could
 *  derive from angles — it is what decides whether a base sits anti or syn over
 *  its sugar, and anti is what B-DNA is made of. So the placement is read off a
 *  deposited nucleotide: dATP, dGTP, dTTP, dCTP, each of which carries the same
 *  atom names as the free base it contains.
 *
 *  THE REFERENCE PROVES ITSELF. A free base carries the proton the bond
 *  displaces and the nucleotide does not — adenine has H9, dATP's adenine has
 *  no H9 at all — so the two records agree about exactly the atom this reaction
 *  removes. That is not a coincidence to rely on quietly; check-nucleoside.js
 *  asserts it.
 *
 *  WHICH NITROGEN IS THE WHOLE OF PURINE VERSUS PYRIMIDINE. A purine bonds
 *  through N9 and a pyrimidine through N1, and they are not interchangeable:
 *  aiming a pyrimidine at N9 finds no atom, and a purine at N1 finds the wrong
 *  one and builds a nucleoside nobody has ever made, rendering perfectly. The
 *  table says which, per base, and never guesses from the atom count.
 *
 *  Angstroms in, angstroms out. Plain arrays, no THREE, Node-loadable.
 * ========================================================================== */
(function(global){
  'use strict';

  const req = p => (typeof require === 'function' ? require(p) : null);
  const Spec  = global.MacroSpec     || req('./spec.js');
  const Frame = global.CondenseFrame || req('../chain/frame.js');
  /* Shepperd's method, from glycosidic.js, which argues at its definition why
     the naive quaternion formula is wrong at a half turn. One copy, not two. */
  const Gly   = global.Glycosidic    || req('./glycosidic.js');

  /* The sugar's triad, in the free spec and in a nucleotide. Three points fix a
     rigid body; these span the furanose ring, so they cannot go collinear. The
     names differ only by the prime a nucleotide puts on its sugar. */
  const SUGAR = ['O4', 'C1', 'C4'];
  const primed = n => n + '′';

  /* Which nucleotide measures which base, and which nitrogen carries the bond.
     A base's triad spans its bonded ring, so the transform is well conditioned
     whichever way the base is turned. */
  const REF = {
    adenine:  { via:'dATP', n:'N9', triad:['N9','C4','C8'], kind:'purine' },
    guanine:  { via:'dGTP', n:'N9', triad:['N9','C4','C8'], kind:'purine' },
    thymine:  { via:'dTTP', n:'N1', triad:['N1','C2','C4'], kind:'pyrimidine' },
    cytosine: { via:'dCTP', n:'N1', triad:['N1','C2','C4'], kind:'pyrimidine' },
  };

  const at = (spec, name) => {
    const i = (spec.names || []).indexOf(name);
    return i < 0 ? null : spec.atoms[i].pos;
  };
  const triadOf = (spec, names) => {
    const p = names.map(n => at(spec, n));
    return p.every(Boolean) ? p : null;
  };

  /* A sugar and a base condense when the sugar still has its anomeric hydroxyl,
     the base still has its ring proton, and something in the library measures
     that base. Nothing here is a mode the page picks. */
  const routeFor = (sugarKey, baseKey) =>
    (sugarKey === 'deoxyribose' || sugarKey === 'ribose') ? (REF[baseKey] || null) : null;

  /* Where `base` must sit for its N to bond to `sugar`'s C1, with the sugar at
     the origin unrotated. Same shape peptide.js and glycosidic.js return. */
  function pose(sugar, base, lib){
    const sc = Spec.free(sugar, 'c1'), bg = Spec.free(base, 'glyco');
    if(!sc || !bg) return null;
    const R = routeFor(sugar.key, base.key);
    if(!R) return null;
    const nt = lib[R.via];
    if(!nt) return null;

    const mono = triadOf(sugar, SUGAR);
    const A = triadOf(nt, SUGAR.map(primed));   // the reference's own sugar
    const B = triadOf(nt, R.triad);             // and its base
    const own = triadOf(base, R.triad);
    if(!mono || !A || !B || !own) return null;

    // Our sugar onto the reference's, then wherever the base sits, expressed
    // back in our sugar's own frame. glycosidic.js's three steps exactly.
    const toA   = Frame.match(mono, A);
    const fromA = Frame.match(A, mono);
    const place = p => Frame.apply(fromA, Frame.apply(toA, p));
    const put = B.map(p => Frame.apply(fromA, p));

    const m = Frame.match(own, put);
    const quat = Gly.quatOf(m.r);
    const pos = Frame.sub(m.t, rotv(m.r, m.o));

    const nAt = Frame.apply(fromA, at(nt, R.n));
    const c1 = at(sugar, 'C1');
    // The base's ring proton, where it lands once the base has been placed. It
    // is an INDEX on the role, so it is read off the spec's atoms rather than
    // by name — `leaves` is what check-molecules.js audits, and a name lookup
    // here would be a second statement of the same fact.
    const hIdx = bg.leaves[0];
    const hAt = Frame.apply(m, base.atoms[hIdx].pos);
    return {
      pos, quat,
      // The atom that bonds, in the BASE's own frame: a base's origin is nowhere
      // near its bonding nitrogen, which is plane.js's rule for every latch.
      at: at(base, R.n),
      link: R.n + '–C1′', kind: R.kind,
      bondAt: Frame.scale(Frame.add(c1, nAt), 0.5),
      // The water assembles between the two groups that gave it up: the sugar's
      // whole anomeric hydroxyl and the base's ring proton.
      waterAt: Frame.scale(Frame.add(at(sugar, 'O1'), hAt), 0.5),
      // What the bond it just placed actually measures. A caller that wants to
      // assert the geometry should not have to rebuild it.
      length: Frame.len(Frame.sub(nAt, c1)),
      clash: null,
    };
  }

  const rotv = (r, v) => [Frame.dot(r[0], v), Frame.dot(r[1], v), Frame.dot(r[2], v)];

  const react = (sugar, base) => Spec.react(sugar, base, 'c1', 'glyco');

  const API = { pose, react, routeFor, REF, SUGAR };
  if(typeof module === 'object' && module.exports) module.exports = API;
  global.Nucleoside = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
