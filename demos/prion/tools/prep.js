#!/usr/bin/env node
/* =====================================================================
 *  prep.js — cut the two deposited files down to the pair that can morph.
 *
 *  The lesson's claim needs exactly one thing from the PDB: the SAME
 *  residues, in two structures, with different secondary structure. That
 *  is residues 170-228 — 1QLZ models 125-228 and 6LNI's fibril core runs
 *  170-229, so the overlap is where the comparison is legitimate and
 *  everywhere else is one file talking about residues the other never saw.
 *
 *  WHAT GETS DROPPED, AND WHY IT IS NOT A LOSS.
 *
 *  1QLZ AS DEPOSITED IS 20 NMR MODELS, 2.7 MB, and what is committed here
 *  is `1QLZ-model1.pdb` — the header records plus model 1, 141 KB. The
 *  name says so because the file is not 1QLZ and a reader who assumed it
 *  was would be wrong about the most important thing in it: the native
 *  state of PrP is an ENSEMBLE, and this is one member of it. The other 19
 *  are 2.6 MB of conformations nothing here reads.
 *
 *  A trajectory has to start from a single conformation whichever way you
 *  choose it, so the reduction costs the animation nothing. It costs the
 *  CLAIM something, and the page has to carry that: "the native fold" is a
 *  family of structures that agree about the helices and disagree about
 *  the loops, and model 1 is not more real than model 12.
 *
 *  modelOne() stays even though the committed file has one model. It is
 *  three lines, and it is what lets someone re-run this against a fresh
 *  download from the PDB without discovering the hard way that they baked
 *  twenty interleaved copies of the same chain.
 *
 *  6LNI is ten chains: two protofibrils of five layers each. Chain A is
 *  one rung, and one rung is what act 3 morphs INTO. The other nine are
 *  act 4's whole subject, so they are kept in a separate stack file rather
 *  than thrown away — the stack is the reason the conversion spreads, and
 *  cutting it here would delete the point of the lesson to save 500 KB.
 *
 *  ALTLOCS: blank or 'A' only, matching hemoglobin/tools/chain.js. A
 *  residue modelled twice contributes once, or the residue index and the
 *  torsion list stop lining up.
 *
 *  SOURCES, for a re-run from scratch:
 *    https://files.rcsb.org/download/1QLZ.pdb    (NMR, human PrP 125-228)
 *    https://files.rcsb.org/download/6LNI.pdb    (cryo-EM, recombinant fibril)
 *
 *  Run:  node prion/tools/prep.js      (offline, no dependencies)
 * ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, '..', 'data');

/* The overlap. Not a tuning knob: it is 1QLZ's last residue against
   6LNI's first, and it is asserted below rather than trusted. */
const LO = 170, HI = 228;

/* modelOne(text) — everything up to the first ENDMDL, or the whole file if
   there are no MODEL records. An X-ray file passes through untouched. */
function modelOne(text) {
  const end = text.indexOf('\nENDMDL');
  return end === -1 ? text : text.slice(0, end + 1);
}

/* chainSlice(text, chainId, lo, hi) — ATOM records for one chain inside a
   residue range, in file order. */
function chainSlice(text, chainId, lo, hi) {
  const out = [];
  for (const line of text.split('\n')) {
    if (!line.startsWith('ATOM')) continue;
    if (line[21] !== chainId) continue;
    const alt = line[16];
    if (alt !== ' ' && alt !== 'A') continue;
    const num = parseInt(line.slice(22, 26), 10);
    if (num < lo || num > hi) continue;
    out.push(line);
  }
  return out;
}

/* records(text, tag, chainId) — HELIX or SHEET lines for one chain. The
   secondary structure is READ, never detected: CLAUDE.md's rule, and here
   it is also the entire lesson, so a heuristic would be inventing the
   thing the page claims to have measured. */
function records(text, tag, chainId) {
  const col = tag === 'HELIX' ? 19 : 21;
  return text.split('\n').filter(l => l.startsWith(tag) && l[col] === chainId);
}

function resNums(lines) {
  const s = new Set();
  for (const l of lines) s.add(parseInt(l.slice(22, 26), 10));
  return [...s].sort((a, b) => a - b);
}

function main() {
  const nat = modelOne(fs.readFileSync(path.join(DATA, '1QLZ-model1.pdb'), 'utf8'));
  const fib = fs.readFileSync(path.join(DATA, '6LNI.pdb'), 'utf8');

  const natA = chainSlice(nat, 'A', LO, HI);
  const fibA = chainSlice(fib, 'A', LO, HI);

  const nNums = resNums(natA), fNums = resNums(fibA);
  const same = nNums.length === fNums.length && nNums.every((n, i) => n === fNums[i]);
  if (!same) {
    throw new Error(`residue ranges differ: native ${nNums[0]}-${nNums[nNums.length-1]}` +
                    ` (${nNums.length}) vs fibril ${fNums[0]}-${fNums[fNums.length-1]} (${fNums.length})`);
  }

  /* Same residue NUMBERS is not yet the same PROTEIN. Both files are human
     PrP, but the morph is only meaningful if it is one sequence changing
     shape, so the sequences are compared residue by residue and a mismatch
     stops the bake. 6LNI is wild-type; 7DWV (E196K) would fail here, which
     is the check doing its job rather than an obstacle. */
  const seqOf = lines => {
    const m = new Map();
    for (const l of lines) m.set(parseInt(l.slice(22, 26), 10), l.slice(17, 20).trim());
    return m;
  };
  const sn = seqOf(natA), sf = seqOf(fibA);
  const diff = nNums.filter(n => sn.get(n) !== sf.get(n));
  if (diff.length) {
    throw new Error('sequence differs at ' +
      diff.map(n => `${n} ${sn.get(n)}/${sf.get(n)}`).join(', '));
  }

  const helix = records(nat, 'HELIX', 'A');
  const sheet = records(fib, 'SHEET', 'A');

  const write = (name, lines) => {
    fs.writeFileSync(path.join(DATA, name), lines.join('\n') + '\nEND\n');
    return lines.length;
  };

  const nNat = write('prp-native.pdb', helix.concat(natA));
  const nFib = write('prp-fibril.pdb', sheet.concat(fibA));

  /* The stack: every chain, same range, for act 4. */
  const chains = [...new Set(fib.split('\n')
    .filter(l => l.startsWith('ATOM')).map(l => l[21]))].sort();
  const stack = chains.flatMap(c => chainSlice(fib, c, LO, HI));
  const nStk = write('prp-stack.pdb', stack);

  console.log(`core        ${nNums[0]}-${nNums[nNums.length - 1]}  ${nNums.length} residues, sequence identical`);
  console.log(`native      prp-native.pdb  ${nNat} lines, ${helix.length} HELIX records`);
  console.log(`fibril      prp-fibril.pdb  ${nFib} lines, ${sheet.length} SHEET records`);
  console.log(`stack       prp-stack.pdb   ${nStk} lines, ${chains.length} chains ${chains.join('')}`);
}

if (require.main === module) main();
module.exports = { LO, HI, modelOne, chainSlice, records };
