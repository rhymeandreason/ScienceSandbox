/* =============================================================================
 *  dna/nucleotide.js — a nucleotide as a spec, and the two bonds that make one
 * =============================================================================
 *  WHAT THIS OWNS. Everything about a nucleotide that is TRUE OF THE MOLECULE:
 *  what it is made of, where the record puts its atoms, and which atoms leave
 *  when one is joined to the next. Nothing about how any of that is drawn,
 *  animated, dragged or narrated — that is the lesson's, and it stays in the
 *  page (SCIENCE.md §6).
 *
 *  The test the section sets is "would two lessons disagree about it?", and
 *  this side of the line is where the answer is no. Two pages disagreeing about
 *  which atom the phosphate esterifies would be two pages teaching different
 *  chemistry; two pages disagreeing about how the join is animated is two
 *  lessons, which is the point of having two.
 *
 *  WHY IT EXISTS. dna-lab builds nucleotides by hand and joins them; the
 *  replication page adds one to a growing strand, over and over, against a
 *  template. Those are the same three reactions — glycosidic bond, ester bond,
 *  phosphodiester bond — and the second page writing its own copy is how the
 *  two drift into bonding different atoms.
 *
 *  ---- SPEC ARITHMETIC, NOT MESHES ------------------------------------------
 *
 *  Every function here takes and returns SPECS: atoms, bonds, names. No THREE,
 *  no scene, no page state, so check-dna.js can run the whole file in Node and
 *  a page can call it before it has drawn anything.
 *
 *  ---- UNITS ----------------------------------------------------------------
 *
 *  A registered spec is in DISPLAY units (ångströms × MolLib.SCALE) and the
 *  record is in ångströms. Everything here works in the spec's own units and
 *  takes the scale explicitly where the record is involved, so nothing in this
 *  file has to know what MolLib.SCALE happens to be.
 *
 *  ---- NAMES ARE THE JOIN ---------------------------------------------------
 *
 *  assemble() suffixes the guest's labels — ′ for the sugar's atoms, ᴾ for the
 *  phosphate's — so a merged nucleotide says which part every atom came from,
 *  and `pdbName` turns that back into what 1BNA calls it. That round trip is
 *  what lets a spec built here be fitted onto a deposited residue, and it is
 *  the reason a page must not rename atoms after a join.
 *
 *  Loaded after molecules.js, dna/attach.js and dna/data/bdna.js.
 * ========================================================================== */
(function(global){
  'use strict';

  // Read at CALL time, not at load: a page loads the baked record after its
  // modules, and capturing here binds `undefined` for the whole session.
  const req = p => (typeof require === 'function' ? require(p) : null);
  // In a browser these are globals the page has already loaded. In Node they
  // are requires, and each one publishes itself differently — the library as a
  // module export, attach.js as a named one, the record onto `window`. The
  // three shapes are the modules', not this file's opinion of them.
  const lib = () => global.MolLib || (global.MolLib = req('../lib/lib-node.js'));
  const attach = () => global.Attach
    || (global.Attach = (req('./attach.js') || {}).Attach || global.Attach);
  const record = () => global.BDNA
    || (req('./data/bdna.js'), global.BDNA || (global.window || {}).BDNA);

  /* ---- the arithmetic a pose needs, on plain arrays ------------------------ */
  const sub = (a, b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
  const add = (a, b) => [a[0]+b[0], a[1]+b[1], a[2]+b[2]];
  const mul = (a, s) => [a[0]*s, a[1]*s, a[2]*s];
  const dist = (a, b) => Math.hypot(a[0]-b[0], a[1]-b[1], a[2]-b[2]);
  // q * v * q⁻¹, written out: the module is loaded in Node as well, where there
  // is no THREE to borrow one from.
  function qrot(q, v){
    const [x, y, z, w] = q;
    const tx = 2*(y*v[2] - z*v[1]), ty = 2*(z*v[0] - x*v[2]), tz = 2*(x*v[1] - y*v[0]);
    return [v[0] + w*tx + y*tz - z*ty,
            v[1] + w*ty + z*tx - x*tz,
            v[2] + w*tz + x*ty - y*tx];
  }
  const qmul = (a, b) => [
    a[3]*b[0] + a[0]*b[3] + a[1]*b[2] - a[2]*b[1],
    a[3]*b[1] - a[0]*b[2] + a[1]*b[3] + a[2]*b[0],
    a[3]*b[2] + a[0]*b[1] - a[1]*b[0] + a[2]*b[3],
    a[3]*b[3] - a[0]*b[0] - a[1]*b[1] - a[2]*b[2]];
  const qconj = q => [-q[0], -q[1], -q[2], q[3]];

  const SUGAR = () => lib().MOLECULES.deoxyribose;
  const PHOS  = () => lib().MOLECULES.phosphate;
  const S     = () => lib().SCALE;
  // attach.js speaks ångströms; a registered spec does not.
  const un = s => ({ ...s, atoms:s.atoms.map(a => ({ el:a.el, pos:mul(a.pos, 1 / S()) })) });

  /* ---- the atoms a condensation loses, by role ----------------------------
   * Out of the spec's own `condense:` block, never counted off the formula: a
   * page that typed the indices would be making a claim the spec already
   * makes, and the two would part company on the next re-registration. */
  const leaving = (spec, role) => {
    const r = ((spec.condense && spec.condense.roles) || []).find(x => x.key === role);
    return r ? r.leaves.slice() : [];
  };
  const keptAtom = (spec, role) => {
    const r = ((spec.condense && spec.condense.roles) || []).find(x => x.key === role);
    return r ? r.keep : -1;
  };

  // Drop atoms and renumber. Every index in a spec — bonds included — moves
  // when an atom goes, so the map is built once and everything reads through it.
  function indexAfter(spec, drop){
    const keep = spec.atoms.map((_, i) => i).filter(i => !drop.includes(i));
    return { keep, at:new Map(keep.map((old, ni) => [old, ni])) };
  }

  /* Rebuild a spec without some atoms. The departing atoms have to actually go:
   * a hidden atom is still in the bond list, and still a claim about what the
   * molecule is. */
  function without(spec, drop){
    const { keep, at } = indexAfter(spec, drop);
    return { ...spec,
      atoms: keep.map(i => spec.atoms[i]),
      names: spec.names ? keep.map(i => spec.names[i]) : undefined,
      bonds: (spec.bonds || []).filter(b => at.has(b[0]) && at.has(b[1]))
        .map(b => [at.get(b[0]), at.get(b[1]), ...b.slice(2)]) };
  }

  /* host + guest, minus one water, plus one bond. Both specs are in display
   * units; `pose` places the guest in the host's frame. */
  function assemble(host, guest, pose, dropHost, dropGuest, hostAtom, guestAtom, suffix){
    const H = indexAfter(host, dropHost), G = indexAfter(guest, dropGuest);
    const atoms = H.keep.map(i => host.atoms[i]).concat(G.keep.map(i =>
      ({ el:guest.atoms[i].el, pos:add(qrot(pose.quat, guest.atoms[i].pos), pose.pos) })));
    const off = H.keep.length;
    const names = H.keep.map(i => host.names[i])
      .concat(G.keep.map(i => guest.names[i] + suffix));
    const move = (m, b, d) => [m.get(b[0]) + d, m.get(b[1]) + d, ...b.slice(2)];
    const bonds = host.bonds.filter(b => H.at.has(b[0]) && H.at.has(b[1]))
        .map(b => move(H.at, b, 0))
      .concat(guest.bonds.filter(b => G.at.has(b[0]) && G.at.has(b[1]))
        .map(b => move(G.at, b, off)));
    bonds.push([H.at.get(hostAtom), off + G.at.get(guestAtom)]);
    // `view` and `optH` are dropped: the merged molecule is not either spec any
    // more, and an inherited view would turn it as though it were.
    return { name:host.name, atoms, bonds, names, units:host.units, view:null };
  }

  /* ---- where a part has to sit -------------------------------------------
   * Solved once per base and cached, in DISPLAY units. `sugar` is in the base's
   * frame; `phosphate` is in the SUGAR's — so a phosphate follows a sugar that
   * has itself been placed, which is what composing them below does. */
  const poses = {};
  function pose(key, kind){
    const k = key + ':' + kind;
    if(!(k in poses)){
      const M = lib().MOLECULES;
      const r = kind === 'sugar'
        ? attach().sugar(key, un(M[key]), un(SUGAR()))
        : attach().phosphate(key, un(SUGAR()), un(PHOS()));
      poses[k] = r.ok ? { quat:r.quat.slice(), pos:mul(r.pos, S()),
                          rms:r.rms, length:r.length } : null;
    }
    return poses[k];
  }

  /* The sugar's `c5` role, renumbered into the assembled spec. Read by NAME:
   * assemble() suffixes the guest's labels, so the sugar's O5 is 'O5′' and its
   * hydroxyl hydrogen 'HO5′' in the molecule that now holds them. */
  function remapRoles(host, sugar, merged){
    const i = n => merged.names.indexOf(n);
    const r = ((sugar.condense && sugar.condense.roles) || []).find(x => x.key === 'c5');
    if(!r) return null;
    const keep = i(sugar.names[r.keep] + '′');
    const leaves = r.leaves.map(k => i(sugar.names[k] + '′')).filter(k => k >= 0);
    return keep < 0 ? null : { roles:[{ key:'c5', label:r.label, keep, leaves }] };
  }

  /* One part joined to a growing nucleotide, as SPEC ARITHMETIC — no mesh, no
   * stage. A page that builds finished nucleotides calls this twice per base,
   * and it has to be the same code its drag runs or the two would drift into
   * bonding different atoms. */
  function addPart(hostSpec, key, kind){
    const p = pose(key, kind);
    if(!p) return hostSpec;
    if(kind === 'sugar'){
      const spec = assemble(hostSpec, SUGAR(), p,
        leaving(hostSpec, 'glyco'), leaving(SUGAR(), 'c1'),
        keptAtom(hostSpec, 'glyco'), keptAtom(SUGAR(), 'c1'), '′');
      // The nucleoside keeps the sugar's roles so the NEXT join can read them:
      // the phosphate esterifies an –OH that is now part of the assembled
      // molecule, and `condense:` is where a page asks which atom that is.
      spec.condense = remapRoles(hostSpec, SUGAR(), spec);
      return spec;
    }
    // In the sugar's frame, then carried into the base's by the sugar's pose —
    // the same composition a page's drag target does, on the atoms rather than
    // on the mesh.
    const s = pose(key, 'sugar');
    const inBase = { quat:qmul(s.quat, p.quat), pos:add(qrot(s.quat, p.pos), s.pos) };
    return assemble(hostSpec, PHOS(), inBase,
      leaving(hostSpec, 'c5'), leaving(PHOS(), 'ester'),
      keptAtom(hostSpec, 'c5'), keptAtom(PHOS(), 'ester'), 'ᴾ');
  }

  // A whole nucleotide from a base: the two joins, in the order a cell makes
  // them and the order every page here shows them.
  const build = key => addPart(addPart(lib().MOLECULES[key], key, 'sugar'), key, 'phosphate');

  /* ---- our labels out, the record's in ------------------------------------
   * attach.js speaks PDB names because that is what it reads; an assembled
   * nucleotide's labels are this lesson family's own invention, so the
   * translation lives here. Hydrogens are dropped: the record has none, and an
   * atom with no counterpart cannot be fitted onto anything. */
  function pdbName(spec, i){
    if(spec.atoms[i].el === 'H') return null;
    const n = spec.names[i];
    if(n.endsWith('ᴾ')) return n.slice(0, -1) === 'P' ? 'P' : null;    // only the P
    if(n.endsWith('′')) return n.slice(0, -1) + "'";
    return n;
  }
  function pdbAtoms(spec, scale){
    const s = scale || S();
    const out = {};
    for(let i = 0; i < spec.names.length; i++){
      const n = pdbName(spec, i);
      if(n) out[n] = mul(spec.atoms[i].pos, 1 / s);
    }
    return out;
  }

  // Where the record puts this nucleotide: a rigid fit of our atoms onto the
  // deposited residue, in DISPLAY units.
  function fit(spec, pairIndex, strand){
    const f = attach().residueFit(pdbAtoms(spec), pairIndex, strand);
    return f.ok ? { ok:true, quat:f.quat.slice(), pos:mul(f.pos, S()), rms:f.rms } : f;
  }

  /* ---- then WEAR THE RECORD'S OWN COORDINATES -----------------------------
   * residueFit is a rigid fit, and a rigid fit of an idealised nucleotide onto
   * a crystal one leaves about 0.7 Å of residual, all of it in the backbone —
   * our sugar pucker is Skel's, not 1BNA's. Two stacked residues hide that: the
   * two bonds come out 1.47 and 1.61 Å and read as bonds. A third does not: one
   * join lands at 2.73 Å, which is not a bond at any scale.
   *
   * So after the fit, every atom the record HAS is moved to where the record
   * has it, and the phosphodiester bonds come out the crystal's 1.6 Å every
   * time. What the record does not have — hydrogens, the two spare phosphate
   * oxygens — rides on its nearest neighbour that does, so bond lengths to
   * those are untouched and nothing is invented. The nucleotide a page draws
   * after this is 1BNA's, not ours placed near it.
   *
   * `at` is the pose fit() returned; the atoms come back in the molecule's own
   * frame, so the page keeps drawing it at the same place. */
  function wearRecord(spec, pairIndex, strand, at){
    const dep = attach().residueAt(record(), pairIndex, strand);
    if(!dep) return spec;
    const qi = qconj(at.quat), s = S();
    const moved = new Array(spec.atoms.length).fill(null);
    for(let i = 0; i < spec.atoms.length; i++){
      const n = pdbName(spec, i);
      if(!n || !dep[n]) continue;
      moved[i] = qrot(qi, sub(mul(dep[n], s), at.pos));
    }
    // Outward over the bond graph: an atom with no counterpart takes the
    // displacement of the nearest one that has.
    const nbr = spec.atoms.map(() => []);
    for(const [a, b] of spec.bonds || []){ nbr[a].push(b); nbr[b].push(a); }
    let front = moved.map((m, i) => m ? i : -1).filter(i => i >= 0);
    while(front.length){
      const next = [];
      for(const i of front) for(const j of nbr[i]){
        if(moved[j]) continue;
        moved[j] = add(spec.atoms[j].pos, sub(moved[i], spec.atoms[i].pos));
        next.push(j);
      }
      front = next;
    }
    return { ...spec, atoms:spec.atoms.map((a, i) =>
      moved[i] ? { ...a, pos:moved[i] } : a) };
  }

  /* ---- the bond between two nucleotides -----------------------------------
   * WHICH ATOM MEETS WHICH, ASKED OF THE GEOMETRY rather than declared. With
   * two residues at their crystal placements exactly one O3′···P pair is within
   * bonding distance, and which residue donates decides which way the strand
   * runs. Declaring it from the letters would work and would hide the thing
   * being taught.
   *
   * `posOf(res, i)` is the page's: it knows where its molecules are. Distances
   * come back in ångströms whatever the page's units, because `scale` says. */
  function backboneLinks(residues, posOf, opts){
    const o = Object.assign({ maxDist:2.2, scale:S() }, opts || {});
    const iOf = (res, n) => res.spec.names.indexOf(n);
    const out = [];
    for(const donor of residues) for(const taker of residues){
      if(donor === taker) continue;
      const o3 = iOf(donor, 'O3′'), p = iOf(taker, 'Pᴾ');
      if(o3 < 0 || p < 0) continue;
      const d = dist(posOf(donor, o3), posOf(taker, p)) / o.scale;
      if(d < o.maxDist) out.push({ donor, taker, o:o3, p, d });
    }
    return out;
  }

  /* ---- and the hydrogen bonds that hold two of them together ---------------
   * MUTUAL NEAREST, NOT EVERYTHING UNDER A CUTOFF. Every nitrogen and oxygen on
   * one base has a neighbour on the other within a few ångströms, so a plain
   * distance test counts the pair's own crowding: it makes G·C five bonds and
   * A·T three, both wrong and neither of them looking it. Requiring each atom
   * to be the OTHER'S CLOSEST leaves exactly the Watson-Crick contacts — three
   * for G·C, two for A·T, at 2.6 to 3.3 Å. The cutoff only stops a lone atom
   * pairing with something across the groove.
   *
   * A base atom is one whose name carries neither suffix, because the sugar's
   * end in ′ and the phosphate's in ᴾ. So "which atoms are the base" is the
   * split the two joins already made. */
  function baseContacts(a, b, posOf, opts){
    const o = Object.assign({ maxDist:3.4, scale:S() }, opts || {});
    const sites = res => res.spec.names.map((n, i) => i)
      .filter(i => !/[′ᴾ]$/.test(res.spec.names[i]) && /^[NO]/.test(res.spec.names[i]));
    const A = sites(a), B = sites(b);
    if(!A.length || !B.length) return [];
    const d = (i, j) => dist(posOf(a, i), posOf(b, j)) / o.scale;
    const out = [];
    for(const i of A){
      const j = B.reduce((best, k) => d(i, k) < d(i, best) ? k : best, B[0]);
      const back = A.reduce((best, k) => d(k, j) < d(best, j) ? k : best, A[0]);
      if(d(i, j) < o.maxDist && back === i) out.push([i, j]);
    }
    return out;
  }

  /* Which of the phosphate's two spare hydroxyls reacts: the one nearest the
   * oxygen replacing it. The three –OH on a phosphate are equivalent, so naming
   * one would be an accident of the record it was converted from. */
  function esterOH(res, posOf, toward){
    const iOf = n => res.spec.names.indexOf(n);
    let best = null;
    for(const n of ['O2ᴾ', 'O3ᴾ']){
      const i = iOf(n);
      if(i < 0) continue;
      const d = dist(posOf(res, i), toward);
      if(!best || d < best.d) best = { d, o:i, h:iOf('H' + n) };
    }
    return best;
  }

  const API = { pose, addPart, build, assemble, without, leaving, keptAtom,
                pdbName, pdbAtoms, fit, wearRecord, backboneLinks, baseContacts,
                esterOH };
  if(typeof module === 'object' && module.exports) module.exports = API;
  global.Nucleo = API;
})(typeof window !== 'undefined' ? window : globalThis);
