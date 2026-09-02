#!/usr/bin/env node
/* =============================================================================
 *  proteins/nucleosome/tools/prep.js — 1AOI: how two metres of DNA fits in a cell
 * =============================================================================
 *    node proteins/nucleosome/tools/prep.js
 *
 *  writes proteins/nucleosome/data/nucleosome-1AOI.json.
 *
 *  Ten chains: eight histones and 146 base pairs of DNA wound 1.65 turns
 *  around them. 2.8 A, Xenopus histones on human alpha-satellite DNA. It is
 *  the highest-value entry on the wishlist and it was the last one gated on
 *  engineering rather than on choice.
 *
 *  IT IS THE SAME PROBLEM AS proteins/zif268/ AT TWENTY TIMES THE SIZE, which
 *  is exactly why 1ZAA was built first: one shared centre over both polymers,
 *  one frame, two vocabularies in one scene. Nothing here is a new mechanism —
 *  and that is the point of the order they were done in.
 *
 *  WHICH CHAIN IS WHICH HISTONE IS READ, off COMPND. Eight chains of four
 *  proteins in two copies each is precisely the situation where a typed map
 *  goes wrong silently and the picture still looks like a nucleosome: swap H2A
 *  and H2B in a legend and nothing in the render objects.
 *
 *  THE SIX MANGANESE ARE NOT BAKED, and that is a decision rather than an
 *  omission. Zif268's three zincs are baked because a zinc finger does not
 *  exist without them; 1AOI's Mn are from the crystallisation and belong to
 *  the experiment, not the molecule. Drawing them would say they matter.
 *
 *  THE HISTONE TAILS ARE THE STORY AND THEY ARE LARGELY NOT HERE. They are
 *  disordered, so each chain simply starts late — and the two copies of one
 *  histone do not even start at the same residue, which is a fact about what
 *  each one happened to be ordered enough to see rather than about the
 *  protein. The tails carry the chemical marks the whole of chromatin
 *  regulation is about, so what the file holds is the SPOOL and the parts a
 *  lesson would most want are the parts crystallography cannot see. The page
 *  has to say so, or it teaches that a nucleosome is a tidy disc.
 *
 *  NO COUNT IS TYPED IN THIS COMMENT. Coverage is printed below from the bake
 *  and from SEQRES, and SEQRES is itself the CONSTRUCT rather than the whole
 *  histone — so "96% modelled" is 96% of what was expressed, not of H3.
 *
 *  Every chain is modelled CONTIGUOUSLY: the missing residues are at the
 *  termini, so `runs()` still has not met an internal break. Said out loud
 *  because it keeps being nearly true and is not the same as being tested.
 * ============================================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const Bake = require(path.join(__dirname, '..', '..', 'bake-lib.js'));

const HERE = path.join(__dirname, '..', 'data');
const SRC = path.join(HERE, 'src', '1AOI.pdb');

const text = Bake.modelOne(fs.readFileSync(SRC, 'utf8'));

const kinds = Bake.chainKinds(text);
const aa = [...kinds].filter(([, k]) => k === 'aa').map(([id]) => id).sort();
const na = [...kinds].filter(([, k]) => k === 'na').map(([id]) => id).sort();
if (!aa.length || !na.length) { console.error('expected both polymers'); process.exit(1); }

/* CHAIN -> MOLECULE NAME, off COMPND's own MOL_ID blocks. A `MOLECULE:` line
   names the thing and the `CHAIN:` line under it says which chains are copies
   of it, so the two are read as a pair rather than by position. */
function molecules(t) {
  const out = {};
  let name = null;
  for (const line of t.split('\n')) {
    if (!line.startsWith('COMPND')) continue;
    const body = line.slice(10).trim().replace(/;$/, '');
    const m = body.match(/^MOLECULE:\s*(.+)$/);
    if (m) { name = m[1].trim(); continue; }
    const c = body.match(/^CHAIN:\s*(.+)$/);
    if (c && name) for (const id of c[1].split(',').map(x => x.trim())) out[id] = name;
    if (/^MOL_ID:/.test(body)) name = null;
  }
  return out;
}
const named = molecules(text);

const prot = Bake.caTrace(text, new Set(aa));
const dna = Bake.naTrace(text, new Set(na));
const R = Bake.ssRanges(text);

/* ONE CENTRE OVER BOTH POLYMERS — zif268's header has the long version, and
   the failure it prevents is the octamer landing inside the DNA. */
const all = [];
for (const res of prot.values()) for (const r of res) all.push([r.x, r.y, r.z]);
for (const res of dna.values()) for (const r of res) all.push(r.P);
const centre = [0, 1, 2].map(k => all.reduce((s, p) => s + p[k], 0) / all.length);

const P = Bake.assemble(prot, R, centre);
const D = Bake.assembleNA(dna, centre);

const hb = Bake.hbFor(Bake.resolution(text));
const pairs = Bake.centrePairs(Bake.basePairs(dna, { hb }), centre);

/* THE FRAME IS SOLVED, and this is the one structure so far where PCA is
   plainly the right instrument. A nucleosome is a DISC: its two long axes are
   the face and its short one is the superhelical axis, so "shortest axis into
   the screen" IS the face-on view every textbook draws. A duplex needed a
   convention because it has no shortest axis worth the name; this has one. */
const pts = [];
for (const id of P.order) for (const p of P.chains[id].CA) pts.push(p);
for (const id of D.order) for (const p of D.chains[id].P) pts.push(p);
const F = Bake.frameOf(pts);

const chains = Object.assign({}, P.chains, D.chains);
const order = [...aa, ...na];
for (const id of order) chains[id].molecule = named[id] || null;

const ext = (() => {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  const B = F.view || [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (const p of pts) for (let k = 0; k < 3; k++) {
    const v = B[k][0] * p[0] + B[k][1] * p[1] + B[k][2] * p[2];
    if (v < lo[k]) lo[k] = v;
    if (v > hi[k]) hi[k] = v;
  }
  return hi.map((h, k) => Bake.r2(h - lo[k]));
})();

const out = {
  source: '1AOI.pdb',
  entry: '1AOI',
  what: 'the nucleosome core particle',
  method: Bake.method(text),
  resolution: Bake.resolution(text),
  ssFrom: Bake.ssFrom(R),
  pairsFrom: 'geometry — Watson-Crick (N1...N3), wobble (N1...O2 + O6...N3), '
           + 'C1\'-C1\' 8.4-12.6 A, N...N within ' + hb + ' A',
  centre: P.centre,
  order,
  chains,
  pairs,
  radius: Math.max(P.radius, D.radius),
  extents: ext,
  frame: F.view ? 'solved from the shape — face on, down the superhelical axis'
                : 'deposited',
};
if (F.view) out.view = F.view;

fs.mkdirSync(HERE, { recursive: true });
const dst = path.join(HERE, 'nucleosome-1AOI.json');
fs.writeFileSync(dst, JSON.stringify(out));

const declared = Bake.declared(text);
const nres = aa.reduce((k, id) => k + chains[id].nums.length, 0);
const ndec = aa.reduce((k, id) => k + (declared[id] || 0), 0);
const nnt = na.reduce((k, id) => k + chains[id].nums.length, 0);

console.log(dst);
console.log('  ' + ext.join(' x ') + ' A, radius ' + out.radius + ' A, '
  + (fs.statSync(dst).size / 1024).toFixed(0) + ' KB, frame ' + out.frame);
for (const id of aa) {
  const c = chains[id];
  console.log('  ' + id + '  ' + (c.molecule || '?').padEnd(11)
    + String(c.nums.length).padStart(4) + '/' + declared[id]
    + '  ' + c.first + '-' + c.nums[c.nums.length - 1]
    + '  ' + c.helices + ' helices');
}
for (const id of na)
  console.log('  ' + id + '  DNA         ' + chains[id].nums.length + ' nt');
console.log('  ' + nres + ' of ' + ndec + ' residues modelled ('
  + Math.round(nres / ndec * 100) + '%) — the rest is tails');
console.log('  ' + nnt + ' nucleotides, ' + pairs.length + ' pairs at ' + hb
  + ' A, ' + (nnt / 2 - pairs.length) + ' positions unpaired');
console.log('  breaks: ' + Bake.breaks({ order: aa, chains }));
