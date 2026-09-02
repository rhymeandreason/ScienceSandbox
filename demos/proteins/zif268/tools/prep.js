#!/usr/bin/env node
/* =============================================================================
 *  proteins/zif268/tools/prep.js — Zif268 on DNA: two polymers, one frame
 * =============================================================================
 *    node proteins/zif268/tools/prep.js
 *
 *  writes proteins/zif268/data/zif268-1ZAA.json.
 *
 *  1ZAA is three zinc fingers gripping eleven base pairs: chain C is 87
 *  residues of protein (85 modelled), chains A and B are the duplex, and three
 *  zincs hold the fingers' folds together, one each. 2.1 A, mouse.
 *
 *  IT IS HERE BECAUSE IT IS THE SMALLEST MIXED FILE. Everything before it was
 *  protein alone or nucleic alone; this is the first bake where both come out
 *  of one deposition and have to land in ONE frame. The nucleosome is the same
 *  problem at twenty times the size, and a failure there would be three
 *  failures at once.
 *
 *  ONE CENTRE, SOLVED OVER BOTH POLYMERS AND PASSED TO EACH. This is the whole
 *  trap of a mixed bake and it is silent: `assemble` and `assembleNA` each
 *  solve their own centre when they are not given one, so a protein centred on
 *  its own atoms and a duplex centred on ITS own atoms come out overlapping at
 *  the origin — the protein sitting inside the DNA rather than beside it. Both
 *  are individually correct and the picture is nonsense. So the centre is
 *  computed here, over every atom either of them keeps, and handed to both.
 *
 *  THE FRAME IS THE DUPLEX'S, not the complex's. A PCA over both polymers
 *  would solve for the shape of protein-plus-DNA, which is not a thing anyone
 *  needs to see down a particular axis; what a reader wants is the DNA lying
 *  across the page with the protein wrapped into its major groove. So the
 *  helix axis comes off the base-pair centroids exactly as `proteins/dna/`
 *  does it, and the protein simply rides the same basis.
 *
 *  THE ZINCS ARE BAKED because they are the structural claim. A zinc finger is
 *  not a fold that happens to bind zinc — it does not exist without it. Three
 *  fingers, three zincs, and the file says so with three ZN records.
 *
 *  WHAT THIS ENTRY STILL DOES NOT TEST: a chain break. Chain C is modelled
 *  3-87 of a declared 1-87, so the two missing residues are TERMINAL and
 *  `runs()` sees one contiguous run. The duplex does carry two unpaired 5'
 *  overhangs (A1, B1), which is the first time a stub has been drawn on a
 *  duplex rather than in a loop.
 * ============================================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const Bake = require(path.join(__dirname, '..', '..', 'bake-lib.js'));
const FoldLib = require(path.join(__dirname, '..', '..', '..', 'folding', 'folding.js'));

const HERE = path.join(__dirname, '..', 'data');
const SRC = path.join(HERE, 'src', '1ZAA.pdb');

const text = Bake.modelOne(fs.readFileSync(SRC, 'utf8'));

/* WHAT EVERY CHAIN IS, asked of the file rather than assumed from the entry.
   This is the census `chainKinds` exists for, and this is the first bake where
   the answer is not all one thing. */
const kinds = Bake.chainKinds(text);
const aa = [...kinds].filter(([, k]) => k === 'aa').map(([id]) => id);
const na = [...kinds].filter(([, k]) => k === 'na').map(([id]) => id);
if (!aa.length || !na.length) {
  console.error('expected both polymers; got ' +
    [...kinds].map(x => x.join('=')).join(' '));
  process.exit(1);
}

const prot = Bake.caTrace(text, new Set(aa));
const dna = Bake.naTrace(text, new Set(na));
const R = Bake.ssRanges(text);

/* THE SHARED CENTRE. Over the protein's Ca and the DNA's phosphates together —
   see the header. Weighting is by atom, which is what putting both arrays in
   one mean does, and is right here because neither polymer should drag the
   frame onto itself. */
const all = [];
for (const res of prot.values()) for (const r of res) all.push([r.x, r.y, r.z]);
for (const res of dna.values()) for (const r of res) all.push(r.P);
const centre = [0, 1, 2].map(k => all.reduce((s, p) => s + p[k], 0) / all.length);

const P = Bake.assemble(prot, R, centre);
const D = Bake.assembleNA(dna, centre);
const hb = Bake.hbFor(Bake.resolution(text));
const rawPairs = Bake.basePairs(dna, { hb });
const pairs = Bake.centrePairs(rawPairs, centre);

/* The duplex's own axis, off the base-pair centroids — the same convention
   proteins/dna/tools/prep.js uses, so two pages drawing DNA aim it the same
   way. Measured before centring and applied after; a basis is a rotation and
   does not care where the origin is. */
const mid = p => {
  const a = dna.get(p.a[0]).find(r => r.num === p.a[1]);
  const b = dna.get(p.b[0]).find(r => r.num === p.b[1]);
  return [0, 1, 2].map(k => (a.Bc[k] + b.Bc[k]) / 2);
};
const m0 = mid(rawPairs[0]), m1 = mid(rawPairs[rawPairs.length - 1]);
const axis = [0, 1, 2].map(k => m1[k] - m0[k]);
const up = [0, 1, 2].map(k => dna.get(na[0])[0].Bc[k] - m0[k]);
const B = FoldLib.basisFrom(up, axis);

/* The zincs, in the shared frame. Three of them, one per finger. */
const zinc = text.split('\n')
  .filter(l => l.startsWith('HETATM') && l.slice(17, 20).trim() === 'ZN')
  .map(l => {
    const p = Bake.xyz(l);
    return { num: parseInt(l.slice(22, 26), 10),
             xyz: [0, 1, 2].map(k => Bake.r2(p[k] - centre[k])) };
  });

/* ONE `chains` OBJECT HOLDING BOTH, keyed the way the file keys them, each
   carrying its own `kind`. A consumer walks `order` and asks; kit/nucleic.js
   skips anything that is not 'na' and a ribbon skips anything that is not
   'aa', so neither has to know what else is in the file. */
const chains = Object.assign({}, P.chains, D.chains);
const order = [...aa, ...na];

const ext = (() => {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  const pts = [];
  for (const id of aa) for (const p of P.chains[id].CA) pts.push(p);
  for (const id of na) for (const p of D.chains[id].P) pts.push(p);
  for (const p of pts) for (let k = 0; k < 3; k++) {
    const v = B[k][0] * p[0] + B[k][1] * p[1] + B[k][2] * p[2];
    if (v < lo[k]) lo[k] = v;
    if (v > hi[k]) hi[k] = v;
  }
  return hi.map((h, k) => Bake.r2(h - lo[k]));
})();

const out = {
  source: '1ZAA.pdb',
  entry: '1ZAA',
  what: 'Zif268 zinc fingers on DNA',
  method: Bake.method(text),
  resolution: Bake.resolution(text),
  ssFrom: Bake.ssFrom(R),
  pairsFrom: 'geometry — Watson-Crick (N1...N3), wobble (N1...O2 + O6...N3), '
           + 'C1\'-C1\' 8.4-12.6 A, N...N within ' + hb + ' A',
  centre: P.centre,
  order,
  chains,
  pairs,
  zinc,
  radius: Math.max(P.radius, D.radius),
  extents: ext,
  view: B.map(ax => ax.map(Bake.r2)),
  frame: 'the duplex\'s helix axis across the page',
};

fs.mkdirSync(HERE, { recursive: true });
const dst = path.join(HERE, 'zif268-1ZAA.json');
fs.writeFileSync(dst, JSON.stringify(out));

const declared = Bake.declared(text);
console.log(dst);
console.log('  ' + ext.join(' x ') + ' A, radius ' + out.radius + ' A, '
  + (fs.statSync(dst).size / 1024).toFixed(1) + ' KB');
for (const id of aa) {
  const c = chains[id];
  console.log('  protein ' + id + '  ' + c.nums.length + '/' + declared[id]
    + ' residues ' + c.first + '-' + c.nums[c.nums.length - 1]
    + ', ' + c.helices + ' helices, ' + c.strands + ' strands, ss ' + out.ssFrom);
}
for (const id of na)
  console.log('  DNA     ' + id + '  ' + chains[id].seq);
const nnt = na.reduce((k, id) => k + chains[id].nums.length, 0);
console.log('  ' + pairs.length + ' base pairs, ' + (nnt - pairs.length * 2)
  + ' unpaired (5\' overhangs), ' + zinc.length + ' zinc');
console.log('  breaks: ' + Bake.breaks({ order: aa, chains }));
