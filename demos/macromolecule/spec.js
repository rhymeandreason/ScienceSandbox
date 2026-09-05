/* =============================================================================
 *  macromolecule/spec.js — what a monomer becomes once it has reacted
 * =============================================================================
 *  One condensation, on any of the classes: a bond is made, a water leaves, and
 *  the molecule that is left is not the molecule that started. This file is the
 *  arithmetic of that, and nothing else — no poses, no chemistry about WHICH
 *  atoms, no THREE. The roles it reads are the spec's own `condense:` block,
 *  which check-molecules.js already audits.
 *
 *  ---- TWO KINDS OF STALENESS, AND ONLY ONE IS RENUMBERING -------------------
 *
 *  Every index in a spec moves when an atom goes, so bonds, names, `optH`,
 *  `groups` and the roles themselves are remapped through one map.
 *
 *  The other kind cannot be remapped, and it is the one that ships looking
 *  fine. A residue in a chain HAS NO FORMULA of its own, no SMILES, no anomeric
 *  configuration and no contrast partner: those are claims about the free
 *  monomer, and glucose-in-cellulose is not glucose. Carrying them through with
 *  their indices patched up produces a spec that states, precisely and
 *  wrongly, that it is still a sugar you could put in your tea. So they are
 *  DROPPED, and `MONOMER_ONLY` is the list. Anything a page needs about the
 *  residue after this has to be a fact about the residue.
 *
 *  A SPENT ROLE IS KEPT, EMPTIED, NOT DELETED. The atom the bond was made at is
 *  still there; only the leaving group went. Emptying `leaves` is what says
 *  "this end is used", and `free()` reading that is the whole rule for where a
 *  chain can still grow — which is why chain direction never has to be stated
 *  anywhere as a rule.
 *
 *  Plain arrays, Node-loadable, so check-macromolecule.js runs it.
 * ========================================================================== */
(function(global){
  'use strict';

  /* Claims about the FREE MONOMER. None survives a condensation, and none can
   * be fixed by renumbering — a residue simply does not have one. */
  const MONOMER_ONLY = ['formula', 'smiles', 'stereo', 'chirality', 'gly',
                        'glycosidic', 'contrast', 'compare', 'src', 'view',
                        'mono', 'helix'];

  const role = (spec, key) => ((spec.condense && spec.condense.roles) || [])
    .find(r => r.key === key) || null;

  /* A role that can still react: one whose leaving atoms are still on the
   * molecule. Asking whether a residue can bond again has to be a question
   * about THIS spec, not about what its class is in general. */
  const free = (spec, key) => { const r = role(spec, key);
                                return r && r.leaves.length ? r : null; };

  const bondedTo = (spec, i) => (spec.bonds || [])
    .filter(b => b[0] === i || b[1] === i)
    .map(b => b[0] === i ? b[1] : b[0]);

  function strip(spec, drop){
    const gone = new Set(drop);
    const keep = spec.atoms.map((_,i) => i).filter(i => !gone.has(i));
    const at = new Map(keep.map((old, ni) => [old, ni]));
    const ix = i => at.has(i) ? at.get(i) : -1;
    const live = a => a.map(ix).filter(i => i >= 0);

    const out = Object.assign({}, spec, {
      atoms: keep.map(i => spec.atoms[i]),
      names: spec.names ? keep.map(i => spec.names[i]) : undefined,
      bonds: (spec.bonds || []).filter(b => at.has(b[0]) && at.has(b[1]))
        .map(b => [at.get(b[0]), at.get(b[1]), ...b.slice(2)]),
      // What it is now, so nothing downstream has to guess whether a spec it
      // was handed is a monomer or a residue.
      residue: true,
    });
    for(const k of MONOMER_ONLY) delete out[k];

    if(spec.condense) out.condense = Object.assign({}, spec.condense, {
      roles: spec.condense.roles.map(r => Object.assign({}, r, {
        keep: ix(r.keep), leaves: live(r.leaves) })),
      // `makes` names PRODUCTS — maltose, cellobiose — which a residue in a
      // chain is not on its way to being any more.
      makes: undefined });
    // An amino acid's own index map, which molecules.js derives its roles from.
    // Left pointing at the old numbering it would disagree with the roles
    // beside it.
    if(spec.pep) out.pep = { cC:ix(spec.pep.cC), oOH:ix(spec.pep.oOH),
                             hOH:ix(spec.pep.hOH), nN:ix(spec.pep.nN),
                             hN:live(spec.pep.hN) };
    // Optional-hydrogen lists are indices too, and a page hiding H by a stale
    // one hides whichever atom moved into that slot.
    if(spec.optH)   out.optH = live(spec.optH);
    if(spec.groups) out.groups = spec.groups
      .map(g => Object.assign({}, g, { atoms: live(g.atoms) }))
      .filter(g => g.atoms.length);
    return out;
  }

  /* What two monomers become. Returns them in the order they went in; the bond
   * itself is BETWEEN them and belongs to whatever draws the chain, not to
   * either molecule. */
  function react(host, guest, donor, acceptor){
    return { host:  strip(host,  role(host,  donor).leaves),
             guest: strip(guest, role(guest, acceptor).leaves) };
  }

  const API = { strip, react, role, free, bondedTo, MONOMER_ONLY };
  if(typeof module === 'object' && module.exports) module.exports = API;
  global.MacroSpec = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
