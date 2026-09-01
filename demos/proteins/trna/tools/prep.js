#!/usr/bin/env node
/* =============================================================================
 *  proteins/trna/tools/prep.js — tRNA-Phe, the molecule that is not a duplex
 * =============================================================================
 *    node proteins/trna/tools/prep.js
 *
 *  writes proteins/trna/data/trna-1EHZ.json.
 *
 *  1EHZ is yeast phenylalanine tRNA at 1.93 A: one chain, 76 nucleotides, no
 *  protein, three metals and nothing else in the frame. It is here because it
 *  is everything 1BNA is not, and each difference tests a code path a perfect
 *  duplex cannot reach:
 *
 *    UNPAIRED NUCLEOTIDES     four stems and three loops. About a third of the
 *                             chain has no Watson-Crick partner, and it has to
 *                             read as visibly not-a-ladder or the rung means
 *                             nothing. On 1BNA every nucleotide is paired, so
 *                             the stub path was drawn but never seen.
 *    MODIFIED BASES           fourteen of them, eleven distinct, every one
 *                             deposited as HETATM. See below: this is the one
 *                             that fails silently.
 *    A FOLD, NOT A HELIX      an L, so the frame is solved rather than a
 *                             convention. `basisFrom` wants an axis and this
 *                             molecule does not have one.
 *
 *  THE MODIFIED BASES ARE THE TRAP, and they are why this entry was worth
 *  doing before anything larger. A modified residue is a HETATM, so an
 *  ATOM-only read returns 62 of 76 nucleotides — 18% of the chain gone, in
 *  fourteen separate one-residue holes, and a ribbon splines straight across
 *  every one of them. Nothing about the render says so. It is the same failure
 *  hydroxyproline causes in collagen, which is why `modResidues` exists and
 *  why this baker opts in; the count is asserted below rather than trusted.
 *
 *  It is also what the two published viewers disagreed about. 3Dmol drops them
 *  from the cartoon and falls back to ball-and-stick, so the picture is a
 *  ribbon with fourteen sprays of atoms hanging off it; Mol* resolves them as
 *  polymer and keeps one clean chain. viewer-compare.html, on this entry.
 *
 *  WHICH ONES ARE MODIFIED RIDES IN THE BAKE as `mods`, not folded into `seq`.
 *  5MC and C are both 'C' to a reader and to the pairing test, and the
 *  difference between them is most of what a tRNA lesson is about.
 *
 *  PAIRING IS WATSON-CRICK ONLY and this molecule is where that under-claim
 *  becomes visible. tRNA's tertiary structure is held together by exactly the
 *  contacts basePairs refuses to find — the G15-C48 Levitt pair, G19-C56, the
 *  T-loop's reverse-Hoogsteen T54-A58 — so the L stays folded in the
 *  coordinates while the drawing shows the two arms joined by nothing. That is
 *  the honest picture of what was solved from the file, and the page says so
 *  rather than the bake inventing rungs to cover it.
 * ============================================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const Bake = require(path.join(__dirname, '..', '..', 'bake-lib.js'));

const HERE = path.join(__dirname, '..', 'data');
const SRC = path.join(HERE, 'src', '1EHZ.pdb');

const text = Bake.modelOne(fs.readFileSync(SRC, 'utf8'));

const kinds = Bake.chainKinds(text);
const na = [...kinds].filter(([, k]) => k === 'na').map(([id]) => id);
if (!na.length) { console.error('no nucleic chains'); process.exit(1); }

/* OPT IN TO THE MODIFIED RESIDUES, off the file's own MODRES records. Not a
   list this repo keeps — which names are modified is a fact each entry states
   about itself, and a hardcoded list is what misses the next one. */
const mod = Bake.modResidues(text);
const chains = Bake.naTrace(text, new Set(na), mod);

/* THE COUNT IS ASSERTED, not printed and hoped over. SEQRES says how long the
   entry claims the chain is, and an ATOM-only read of this file comes back 14
   short — which is a render that looks fine. If those two ever stop agreeing,
   this baker stops rather than writing a quietly holed trace. */
const declared = Bake.declared(text);
for (const id of na) {
  const got = chains.get(id).length;
  if (declared[id] && got !== declared[id]) {
    console.error('chain ' + id + ': read ' + got + ' nucleotides, SEQRES declares '
      + declared[id] + '. A modified residue is a HETATM — check MODRES.');
    process.exit(1);
  }
}

const pairs = Bake.basePairs(chains);
const T = Bake.assembleNA(chains);

/* THE FRAME IS SOLVED HERE, unlike the duplex's. A tRNA is an L and has no
   axis to stand it on, so `basisFrom` has nothing to be given; `frameOf` turns
   it onto its own axes and reports whether the three extents were far enough
   apart to be worth trusting. An L is strongly anisotropic, so they are. */
const all = [];
for (const id of T.order) for (const p of T.chains[id].P) all.push(p);
const F = Bake.frameOf(all);

const nMod = T.order.reduce((k, id) => k + T.chains[id].mods.length, 0);

const out = {
  source: '1EHZ.pdb',
  entry: '1EHZ',
  what: 'yeast tRNA-Phe',
  method: Bake.method(text),
  resolution: Bake.resolution(text),
  pairsFrom: 'geometry (N1...N3 Watson-Crick)',
  centre: T.centre,
  order: T.order,
  chains: T.chains,
  pairs,
  radius: T.radius,
  extents: F.extents,
  frame: F.view ? 'solved from the shape' : 'deposited',
};
if (F.view) out.view = F.view;

fs.mkdirSync(HERE, { recursive: true });
const dst = path.join(HERE, 'trna-1EHZ.json');
fs.writeFileSync(dst, JSON.stringify(out));

const n = T.order.reduce((k, id) => k + T.chains[id].nums.length, 0);
console.log(dst);
console.log('  ' + n + ' nucleotides, ' + pairs.length + ' Watson-Crick pairs, '
  + (n - pairs.length * 2) + ' unpaired, ' + nMod + ' modified, radius '
  + out.radius + ' A, ' + (fs.statSync(dst).size / 1024).toFixed(1) + ' KB');
console.log('  ' + out.extents.join(' x ') + ' A, frame ' + out.frame);
for (const id of out.order) console.log('  chain ' + id + '  ' + out.chains[id].seq);
console.log('  modified: ' + out.order.flatMap(id => out.chains[id].mods)
  .map(m => m.name + m.num).join(' '));
