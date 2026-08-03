#!/usr/bin/env node
/* =====================================================================
 *  chain.js — turn deposited 2HHB into something FoldLib can fold.
 *
 *  Two things stand between the deposited file and folding/folding.js, and
 *  both are properties of THIS structure rather than of the solver, which
 *  is why they live here and not there.
 *
 *  1. CHAIN IDS. Hemoglobin is four chains and FoldLib.parse does not read
 *     column 22 at all — it keys residues by number alone, so A1 and B1
 *     would land in the same bucket and the "protein" it folded would be
 *     four interleaved chains sharing one numbering. Extracting a single
 *     chain first is not an optimisation; parse is simply not a
 *     multi-chain reader, and it should not become one for a lesson whose
 *     whole subject is ONE chain. Level 4 is a separate act with a
 *     separate mechanism (rigid placement), not more of this.
 *
 *  2. NO HYDROGENS. 2HHB is X-ray at 1.74 A and models none — every ATOM
 *     record is C, N, O or S. FoldLib.hbonds is built on the amide H
 *     (it tests H...O distance and N-H...O angle), so on this file it
 *     would find zero hydrogen bonds and act 1 would have nothing to
 *     draw. 1VII got away without this because it is NMR, where the
 *     hydrogens are part of the deposited model.
 *
 *     So the amide H is CONSTRUCTED, and the placement is deliberately
 *     the one folding/ribbon.js's dssp() already uses: 1 A from N, along
 *     the direction opposite the preceding residue's C=O. Same convention
 *     in both files matters more than either being the best available
 *     guess — a page that assigns secondary structure with one rule and
 *     draws hydrogen bonds with another can show a helix with no bonds
 *     holding it, which is precisely the claim act 1 makes.
 *
 *     A residue whose predecessor is absent has no C=O to build from and
 *     gets no H, so it can never donate. Chain B of 2HHB is a complete
 *     1..146 with no gaps, so in practice that is residue 1 only.
 *
 *  Not a lesson module — nothing in the browser loads this. It runs at
 *  bake time and its output is checked in.
 * ===================================================================== */
'use strict';

/* PDB fixed-column ATOM record. Rebuilt rather than string-patched so the
   injected H lines are the same shape as everything around them. */
function atomLine(serial, name, resName, chain, resNum, xyz, el) {
  const nm = name.length < 4 ? ' ' + name.padEnd(3) : name;
  return 'ATOM  ' +
    String(serial).padStart(5) + ' ' + nm + ' ' +
    resName.padStart(3) + ' ' + chain +
    String(resNum).padStart(4) + '    ' +
    xyz.map(v => v.toFixed(3).padStart(8)).join('') +
    '  1.00  0.00' + ' '.repeat(10) + el.padStart(2);
}

const sub  = (a, b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0]/l, a[1]/l, a[2]/l]; };

/* extract(pdbText, chainId) -> { text, residues, helices }
     text     ATOM records for that chain only, with amide H injected, plus
              the chain's own HELIX records. Feed straight to FoldLib.parse.
     helices  [[startResNum, endResNum], ...] from the deposited HELIX
              records — an experimental assignment, not a heuristic. */
function extract(pdbText, chainId) {
  const lines = pdbText.split('\n');

  /* Deposited HELIX records for this chain. Columns per the PDB v3 spec:
     20 chain / 22-25 start / 32 chain / 34-37 end. */
  const helices = [];
  for (const line of lines) {
    if (!line.startsWith('HELIX')) continue;
    if (line[19] !== chainId) continue;
    helices.push([parseInt(line.slice(21, 25), 10), parseInt(line.slice(33, 37), 10)]);
  }

  /* Backbone-bearing ATOM records, in file order. Altlocs: keep blank or
     'A' only, so a residue modelled in two conformations contributes one. */
  const keep = [], byRes = new Map();
  for (const line of lines) {
    if (!line.startsWith('ATOM')) continue;
    if (line[21] !== chainId) continue;
    const alt = line[16];
    if (alt !== ' ' && alt !== 'A') continue;
    const num = parseInt(line.slice(22, 26), 10);
    const name = line.slice(12, 16).trim();
    keep.push(line);
    if (!byRes.has(num)) byRes.set(num, { num, name: line.slice(17, 20).trim(), atoms: {} });
    byRes.get(num).atoms[name] = [+line.slice(30, 38), +line.slice(38, 46), +line.slice(46, 54)];
  }

  const residues = [...byRes.values()].sort((a, b) => a.num - b.num);

  /* Amide H, by ribbon.js's dssp() convention — see the header. */
  const hLines = [];
  let serial = 90000;
  for (let i = 1; i < residues.length; i++) {
    const r = residues[i], p = residues[i - 1];
    if (r.num !== p.num + 1) continue;             // gap: no preceding C=O
    if (!r.atoms.N || !p.atoms.C || !p.atoms.O) continue;
    const d = norm(sub(p.atoms.C, p.atoms.O));
    const H = [r.atoms.N[0] + d[0], r.atoms.N[1] + d[1], r.atoms.N[2] + d[2]];
    hLines.push(atomLine(serial++, 'H', r.name, chainId, r.num, H, 'H'));
  }

  /* ATOM records only. The helices come back as data, not as re-emitted
     HELIX lines: FoldLib.parse reads nothing but ATOM, so a rewritten
     header would be decoration that no reader checks and every future
     reader would half-trust. */
  const text = keep.concat(hLines).join('\n') + '\n';

  return { text, residues, helices };
}

module.exports = { extract, atomLine };
