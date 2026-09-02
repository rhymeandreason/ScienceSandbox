/* =============================================================================
 *  proteins/nucleic-acids.js — every deposited structure here that carries DNA
 *  or RNA, and what we have of it
 * =============================================================================
 *  `proteins.js` is to a protein trace what this is to a nucleic one. Same
 *  discipline, same two authors per variant, same invariant: every `read`
 *  field is one the BAKE can produce, so nothing here is a number a human
 *  typed and a re-bake could falsify. `check-nucleic-acids.js` re-derives all
 *  of them and fails on a disagreement.
 *
 *  WHY A SECOND FILE RATHER THAN A `polymer` FIELD ON THE FIRST. `proteins.js`
 *  opens by saying it is every protein in `proteins/`, and widening it would
 *  have meant an implicit `polymer:'protein'` on seventeen existing entries,
 *  an `ec` that is absent-and-odd rather than optional, and a checker
 *  branching on every assertion. The cost of two files is that they can drift;
 *  the cost of one was touching every entry in it to add something none of
 *  them needed.
 *
 *  THE LINE BETWEEN THE TWO FILES IS THE BAKE, NOT THE BIOLOGY: a structure
 *  is indexed here when its bake carries nucleic chains. Zif268 is a protein
 *  and it is in this file, because 1ZAA's bake is the mixed shape — `pairs`,
 *  `kind` per chain, a `zinc` array — and `check-proteins.js` cannot read one.
 *  Drawing the line at "is it a protein" instead would put one entry in the
 *  protein index whose bake the protein checker has to special-case, which is
 *  the thing having two files was supposed to avoid.
 *
 *  WHAT A `kind` MEANS HERE, and it is about the FILE rather than the molecule:
 *
 *    dna       a duplex and nothing else
 *    rna       one chain, folded, no protein
 *    complex   protein and nucleic acid in one deposition, one frame
 *
 *  Read by the benches under `proteins/<name>/` and by
 *  `check-nucleic-acids.js`. The bakers do not read it — each one owns its own
 *  entry choices, the same split `proteins.js` makes.
 * ============================================================================= */
(function (global) {
  'use strict';

  const STRUCTURES = [
    {
      key: 'dna', name: 'B-DNA', dir: 'proteins/dna', kind: 'dna',
      blurb: 'The Drew-Dickerson dodecamer: the first B-DNA any crystal '
           + 'structure showed, and still the molecule every textbook picture '
           + 'of the double helix is drawn from.',
      /* THE SMALLEST HONEST DUPLEX, which is why it is the one kit/nucleic.js
         was tuned on: every rule the renderer has to obey is in it once, and
         nothing else is. It is also the entry that CANNOT test the exceptions
         — see trna, which is here for exactly the opposite reason. */
      pipeline: 'trace',
      variants: [
        { id: '1BNA',
          purpose: 'the double helix, as it was first seen',
          species: 'synthetic',
          label: 'CGCGAATTCGCG', chip: '2 chains',
          source: { kind: 'rcsb', id: '1BNA' },
          read: {
            method: 'x-ray diffraction',
            chains: 2,
            nucleotides: 24,
            residues: 0,
            pairs: 12,
            wobble: 0,
            modified: 0,
            baked: 'dna-1BNA.json' } },
      ],
    },
    {
      key: 'trna', name: 'tRNA-Phe', dir: 'proteins/trna', kind: 'rna',
      blurb: 'One strand that folds back on itself: four stems where the '
           + 'chain is paired to its own distant parts, three loops where it '
           + 'is not, and an L when you stop drawing it flat.',
      /* EVERYTHING 1BNA IS NOT, and each difference exercises a path a
         perfect duplex cannot reach — unpaired nucleotides, modified bases
         deposited as HETATM, and a fold with no axis to stand it on. The
         modified bases are the trap: an ATOM-only read returns 62 of 76. */
      pipeline: 'trace',
      variants: [
        { id: '1EHZ',
          purpose: 'the adaptor, and where the ladder stops',
          species: 'yeast',
          label: 'yeast tRNA-Phe', chip: '1 chain',
          source: { kind: 'rcsb', id: '1EHZ' },
          read: {
            method: 'x-ray diffraction',
            chains: 1,
            nucleotides: 76,
            residues: 0,
            pairs: 21,
            wobble: 1,
            modified: 14,
            baked: 'trna-1EHZ.json' } },
      ],
    },
    {
      key: 'zif268', name: 'Zif268', dir: 'proteins/zif268', kind: 'complex',
      blurb: 'Three zinc fingers reading eleven base pairs: the smallest '
           + 'package in biology for recognising one DNA sequence and not '
           + 'another. A zinc finger is not a fold that binds zinc — it is a '
           + 'fold that does not exist without it.',
      /* THE SMALLEST MIXED FILE, and the rehearsal for the nucleosome: the
         first bake where both polymers come out of one deposition and have to
         share one centre. Centre them separately and each is individually
         correct while the protein lands inside the DNA. */
      pipeline: 'trace',
      variants: [
        { id: '1ZAA',
          purpose: 'a protein reading a sequence',
          species: 'mouse',
          label: 'Zif268 on DNA', chip: '3 chains',
          source: { kind: 'rcsb', id: '1ZAA' },
          read: {
            method: 'x-ray diffraction',
            chains: 3,
            nucleotides: 22,
            residues: 85,
            pairs: 10,
            wobble: 0,
            modified: 0,
            baked: 'zif268-1ZAA.json' } },
      ],
    },
  ];

  const KINDS = ['dna', 'rna', 'complex'];

  const byKey = k => STRUCTURES.find(s => s.key === k);
  const variantOf = (s, id) => {
    const e = typeof s === 'string' ? byKey(s) : s;
    return e && e.variants.find(v => v.id === id);
  };
  const defaultOf = s => {
    const e = typeof s === 'string' ? byKey(s) : s;
    return e && e.variants[0];
  };

  /* The bake's path, from the entry and the variant — so a bench names a
     structure and not a file, and a renamed bake is one edit here. */
  const bakedPath = (s, id) => {
    const e = typeof s === 'string' ? byKey(s) : s;
    const v = variantOf(e, id) || defaultOf(e);
    return v && (e.dir + '/data/' + v.read.baked);
  };

  /* RCSB's own pages, built from the id rather than stored. A URL in a
     registry is one more thing to mistype, and every id here can produce it. */
  const urls = id => ({
    rcsb: 'https://www.rcsb.org/structure/' + id,
    pdb: 'https://files.rcsb.org/download/' + id + '.pdb',
  });

  global.NucleicAcids = { STRUCTURES, KINDS, byKey, variantOf, defaultOf,
                          bakedPath, urls };
  if (typeof module === 'object' && module.exports)
    module.exports = global.NucleicAcids;
})(typeof window !== 'undefined' ? window : globalThis);
