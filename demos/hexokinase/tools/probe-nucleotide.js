/* =====================================================================
 *  probe-nucleotide.js — is there anything in these files to draw as ATP?
 *
 *  Neither endpoint has a nucleotide. The question is whether the SULFATE
 *  both of them carry marks the phosphate site: crystallisation sulfate
 *  routinely sits in an anion pocket, and in a kinase that pocket is
 *  usually where a phosphate goes. If the SO4 sits against glucose O6 --
 *  the hydroxyl that actually gets phosphorylated -- then it is a MEASURED
 *  marker for where the gamma phosphate arrives, which is a far better
 *  thing to draw than a docked ATP nobody deposited.
 *
 *  Prints distances only. Whether any of it should be drawn is a
 *  separate decision.
 *
 *  Run:  node hexokinase/tools/probe-nucleotide.js
 * ===================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { dist } = require('./pdbio.js');

const DATA = path.join(__dirname, '..', 'data');
const IDS = ['1IG8', '2YHX', '3B8A', '1HKG'];

/* Nucleotide-ish HET codes, so a miss is reported rather than assumed. */
const NUC = new Set(['ATP', 'ADP', 'AMP', 'ANP', 'AGS', 'ACP', 'ADX', 'GTP', 'GDP']);

function hetGroups(text) {
  const groups = new Map();
  for (const line of text.split('\n')) {
    if (line.slice(0, 6) !== 'HETATM') continue;
    const alt = line[16];
    if (alt !== ' ' && alt !== 'A') continue;
    const res = line.slice(17, 20).trim();
    if (res === 'HOH') continue;
    const key = res + ' ' + line.slice(21, 26).trim();
    if (!groups.has(key)) groups.set(key, { res, atoms: [] });
    groups.get(key).atoms.push({
      name: line.slice(12, 16).trim(),
      x: parseFloat(line.slice(30, 38)),
      y: parseFloat(line.slice(38, 46)),
      z: parseFloat(line.slice(46, 54)),
    });
  }
  return groups;
}

for (const id of IDS) {
  const g = hetGroups(fs.readFileSync(path.join(DATA, id + '.pdb'), 'utf8'));
  const names = [...g.values()].map(v => v.res);
  const nuc = names.filter(n => NUC.has(n));
  console.log(`${id}  HET groups: ${names.length ? [...new Set(names)].join(', ') : '(none)'}`
            + `   nucleotide: ${nuc.length ? nuc.join(',') : 'NONE'}`);
}

/* ---- does 3B8A's sulfate mark the phosphate site? ------------------- */
console.log('\n' + '='.repeat(64));
console.log('3B8A: where the sulfate sits relative to the glucose');
const g = hetGroups(fs.readFileSync(path.join(DATA, '3B8A.pdb'), 'utf8'));
const glc = [...g.values()].find(v => v.res === 'BGC');
const sulfates = [...g.values()].filter(v => v.res === 'SO4');
if (!glc) { console.log('  no BGC found'); process.exit(0); }

for (const [i, s] of sulfates.entries()) {
  let best = Infinity, bestPair = null;
  for (const a of s.atoms) for (const b of glc.atoms) {
    const d = dist(a, b);
    if (d < best) { best = d; bestPair = [a.name, b.name]; }
  }
  const o6 = glc.atoms.find(a => a.name === 'O6');
  let toO6 = Infinity;
  if (o6) for (const a of s.atoms) toO6 = Math.min(toO6, dist(a, o6));
  console.log(`  SO4 #${i + 1}`);
  console.log(`    closest approach to glucose: ${best.toFixed(2)} A  (${bestPair[0]}...${bestPair[1]})`);
  console.log(`    closest approach to O6:      ${toO6.toFixed(2)} A`
            + '   <- O6 is the hydroxyl that gets phosphorylated');
}
console.log('='.repeat(64));
