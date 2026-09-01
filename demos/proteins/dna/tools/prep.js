#!/usr/bin/env node
/* =============================================================================
 *  proteins/dna/tools/prep.js — B-DNA, from the deposition a textbook draws
 * =============================================================================
 *    node proteins/dna/tools/prep.js
 *
 *  writes proteins/dna/data/dna-1BNA.json.
 *
 *  1BNA is the Drew-Dickerson dodecamer, CGCGAATTCGCG, the first B-DNA any
 *  crystal structure showed and still the one every textbook picture is drawn
 *  from. Two chains, 24 residues, 486 atom records, no ligands, waters the only
 *  HETATM. It is here because it is the SMALLEST HONEST DUPLEX: everything the
 *  nucleic renderer has to get right is in it once, and nothing else is.
 *
 *  WHAT THIS BAKE CARRIES THAT A PROTEIN TRACE DOES NOT, and why each:
 *
 *    P    the backbone. A ribbon down the phosphates, the way the field draws
 *         one. Residue 1 of each chain has no phosphate and bake-lib falls
 *         back to O5' — without that the duplex is a residue short at both 5'
 *         ends, which reads as the chain simply starting there.
 *    C1'  where the base hangs off the backbone. The rung's endpoint.
 *    Bc   the base's own centroid, and Bn its plane normal — so a slab can be
 *         drawn IN the base's plane rather than as a stub aimed at it.
 *    pairs  solved, not read. See bake-lib's basePairs: the format has no
 *         record for a base pair, so the rung is earned from an N1...N3
 *         contact and the bake says `pairsFrom` the way a trace says `ssFrom`.
 *
 *  THE FRAME IS A CONVENTION, NOT A PCA. A duplex has a known axis and the
 *  field draws it lying across the page, so the helix axis is measured off the
 *  base-pair centroids (first pair to last) and handed to FoldLib.basisFrom.
 *  Solving it instead would work here and stop working the moment a duplex is
 *  bent — 1YTB's is kinked 80 degrees, and PCA on that returns the chord.
 *
 *  IT WRITES NO `ss` AND NO `helices`. A duplex has no secondary structure in
 *  the sense HELIX and SHEET records mean, and a bake that carried an all-coil
 *  `ss` string would be inviting a consumer to draw it as a protein.
 * ============================================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const Bake = require(path.join(__dirname, '..', '..', 'bake-lib.js'));
const FoldLib = require(path.join(__dirname, '..', '..', '..', 'folding', 'folding.js'));

const HERE = path.join(__dirname, '..', 'data');
const SRC = path.join(HERE, 'src', '1BNA.pdb');

const text = Bake.modelOne(fs.readFileSync(SRC, 'utf8'));

/* Every chain in the file, and what each one IS. A protein baker would have
   found nothing here and said "no CA atoms"; this prints the census either
   way, because the census is the thing that goes wrong silently in a MIXED
   file and this is where the habit gets set. */
const kinds = Bake.chainKinds(text);
const na = [...kinds].filter(([, k]) => k === 'na').map(([id]) => id);
const aa = [...kinds].filter(([, k]) => k === 'aa').map(([id]) => id);
if (aa.length) console.log('  protein chains present and NOT baked here: ' + aa.join(','));
if (!na.length) { console.error('no nucleic chains'); process.exit(1); }

const chains = Bake.naTrace(text, new Set(na));
const pairs = Bake.basePairs(chains);

/* The helix axis, off the pairs rather than off the atoms: a base pair's
   centroid sits on the axis, and the line through the first and last is the
   axis to within a degree or two on a dodecamer. Chain A's own P-to-P vector
   would be off by the helical rise's worth of twist. */
const mid = ([ai, an, bi, bn]) => {
  const A = chains.get(ai).find(r => r.num === an);
  const B = chains.get(bi).find(r => r.num === bn);
  return [0, 1, 2].map(k => (A.Bc[k] + B.Bc[k]) / 2);
};
const m0 = mid(pairs[0]), m1 = mid(pairs[pairs.length - 1]);
const axis = [0, 1, 2].map(k => m1[k] - m0[k]);

const T = Bake.assembleNA(chains);

/* Upright is wrong for a duplex — the field lays one across the page, so the
   helix axis goes to X. basisFrom puts `up` on Y, so pass a perpendicular as
   the axis and let the hint be the axis itself. */
const B = FoldLib.basisFrom(
  [0, 1, 2].map(k => (chains.get(na[0])[0].Bc[k] - m0[k])), axis);

/* THE EXTENTS ALONG THE FRAME'S OWN AXES, so a card can fit what it is
   actually looking at rather than a ball around it. Measured after the basis
   is chosen, because that is the frame the reader sees; measuring in the
   deposited frame would describe a rotation nobody draws. */
const ext = (() => {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const id of T.order) for (const p of T.chains[id].P)
    for (let k = 0; k < 3; k++) {
      const v = B[k][0] * p[0] + B[k][1] * p[1] + B[k][2] * p[2];
      if (v < lo[k]) lo[k] = v;
      if (v > hi[k]) hi[k] = v;
    }
  return hi.map((h, k) => Bake.r2(h - lo[k]));
})();

const out = {
  source: '1BNA.pdb',
  entry: '1BNA',
  what: 'Drew-Dickerson dodecamer, CGCGAATTCGCG',
  method: Bake.method(text),
  resolution: Bake.resolution(text),
  pairsFrom: 'geometry (N1...N3 Watson-Crick)',
  centre: T.centre,
  order: T.order,
  chains: T.chains,
  pairs,
  radius: T.radius,
  extents: ext,
  view: B.map(ax => ax.map(Bake.r2)),
  frame: 'helix axis across the page',
};

fs.mkdirSync(HERE, { recursive: true });
const dst = path.join(HERE, 'dna-1BNA.json');
fs.writeFileSync(dst, JSON.stringify(out));

const n = out.order.reduce((k, id) => k + out.chains[id].nums.length, 0);
const kb = (fs.statSync(dst).size / 1024).toFixed(1);
console.log(dst);
console.log('  ' + out.extents.join(' x ') + ' A in the drawn frame');
console.log('  ' + out.order.length + ' chains, ' + n + ' nucleotides, ' +
            pairs.length + ' base pairs, radius ' + out.radius + ' A, ' + kb + ' KB');
for (const id of out.order)
  console.log('  chain ' + id + '  ' + out.chains[id].seq +
              '  ' + out.chains[id].first + '-' +
              out.chains[id].nums[out.chains[id].nums.length - 1]);
const unpaired = n - pairs.length * 2;
if (unpaired) console.log('  ' + unpaired + ' unpaired nucleotide(s) — drawn as stubs, not rungs');
