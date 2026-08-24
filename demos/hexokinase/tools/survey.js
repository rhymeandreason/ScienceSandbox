/* =====================================================================
 *  survey.js — which two deposited structures are a legitimate
 *  open -> closed pair for yeast hexokinase.
 *
 *  Run before baking anything. Published summaries of these four entries
 *  contradict each other and each other's titles: secondary sources call
 *  2YHX "open apo" when the file carries a bound sugar analogue (OTG),
 *  and call 1HKG a glucose complex when it has no HET record at all. The
 *  textbook morph 2YHX -> 1HKG is, on the files themselves, a different
 *  isozyme AND the wrong direction. So nothing here is cited; every
 *  number is measured off the deposited coordinates.
 *
 *  Rg is the discriminator that needs no lobe assignment: domain closure
 *  pulls mass toward the centre, so the closed form of a pair must be
 *  the more compact one. A pair whose "closed" member is the larger is
 *  not a pair.
 *
 *  Reads only hexokinase/data/*.pdb. Prints; asserts nothing. The
 *  assertions come later, in check-closure.js, once a pair is chosen.
 * ===================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, '..', 'data');
const IDS = ['1HKG', '1IG8', '2YHX', '3B8A'];

function parse(text) {
  const ca = [], het = new Map(), names = new Set();
  let title = '', res = null, chain = null;
  for (const line of text.split('\n')) {
    const rec = line.slice(0, 6);
    if (rec === 'TITLE ') title += line.slice(10).trim() + ' ';
    else if (line.startsWith('REMARK   2 RESOLUTION.')) {
      const m = line.match(/([\d.]+)\s+ANGSTROM/);
      if (m) res = parseFloat(m[1]);
    } else if (rec === 'HET   ') {
      const id = line.slice(7, 10).trim();
      het.set(id, (het.get(id) || 0) + 1);
    } else if (rec === 'ATOM  ') {
      const alt = line[16];
      if (alt !== ' ' && alt !== 'A') continue;      // one conformer only
      const name = line.slice(12, 16).trim();
      names.add(name);
      if (name !== 'CA') continue;
      if (chain === null) chain = line[21];
      if (line[21] !== chain) continue;             // first chain only
      ca.push({
        n: parseInt(line.slice(22, 26), 10),
        res: line.slice(17, 20).trim(),
        x: parseFloat(line.slice(30, 38)),
        y: parseFloat(line.slice(38, 46)),
        z: parseFloat(line.slice(46, 54)),
      });
    }
  }
  return { title: title.trim(), res, chain, ca, het, names };
}

// Radius of gyration over the Ca trace, in angstroms.
function rg(ca) {
  const n = ca.length;
  let cx = 0, cy = 0, cz = 0;
  for (const a of ca) { cx += a.x; cy += a.y; cz += a.z; }
  cx /= n; cy /= n; cz /= n;
  let s = 0;
  for (const a of ca) {
    s += (a.x - cx) ** 2 + (a.y - cy) ** 2 + (a.z - cz) ** 2;
  }
  return Math.sqrt(s / n);
}

// Longest Ca-Ca separation: the overall span, which closure also shortens.
function span(ca) {
  let m = 0;
  for (let i = 0; i < ca.length; i++)
    for (let j = i + 1; j < ca.length; j++) {
      const d = (ca[i].x - ca[j].x) ** 2 + (ca[i].y - ca[j].y) ** 2 + (ca[i].z - ca[j].z) ** 2;
      if (d > m) m = d;
    }
  return Math.sqrt(m);
}

// Chain breaks matter: a morph cannot interpolate across a gap the file
// never resolved, and 3.5 A structures are full of them.
function gaps(ca) {
  const out = [];
  for (let i = 1; i < ca.length; i++) {
    const d = Math.hypot(ca[i].x - ca[i - 1].x, ca[i].y - ca[i - 1].y, ca[i].z - ca[i - 1].z);
    if (d > 4.5) out.push({ after: ca[i - 1].n, before: ca[i].n, d: +d.toFixed(2) });
  }
  return out;
}

const rows = [];
for (const id of IDS) {
  const s = parse(fs.readFileSync(path.join(DATA, id + '.pdb'), 'utf8'));
  const ligands = [...s.het.keys()].filter(l => l !== 'SO4' && l !== 'HOH');
  rows.push({ id, s, ligands });
  console.log('='.repeat(72));
  console.log(id + '  ' + s.title);
  console.log(`  resolution   ${s.res} A`);
  console.log(`  chain        ${s.chain}`);
  console.log(`  Ca residues  ${s.ca.length}   (${s.ca[0].n}..${s.ca[s.ca.length - 1].n})`);
  console.log(`  backbone     ${s.names.has('N') && s.names.has('C') && s.names.has('O') ? 'full' : 'Ca-only'}  (${s.names.size} distinct atom names)`);
  console.log(`  ligands      ${ligands.length ? ligands.join(', ') : '(none)'}   [SO4 ignored]`);
  console.log(`  Rg           ${rg(s.ca).toFixed(2)} A`);
  console.log(`  span         ${span(s.ca).toFixed(2)} A`);
  const g = gaps(s.ca);
  console.log(`  chain breaks ${g.length}${g.length ? '  ' + g.map(x => `${x.after}/${x.before}`).join(' ') : ''}`);
}

console.log('=' .repeat(72));
console.log('\nCompactness ranking (closed should be smaller):');
for (const r of [...rows].sort((a, b) => rg(a.s.ca) - rg(b.s.ca)))
  console.log(`  ${r.id}  Rg ${rg(r.s.ca).toFixed(2)}   ${r.ligands.length ? 'holo (' + r.ligands.join(',') + ')' : 'apo'}`);
