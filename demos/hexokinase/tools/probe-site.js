/* =====================================================================
 *  probe-site.js — what else is in these files that the page could show.
 *
 *  Scouting, not a checker. Answers three questions off the deposited
 *  coordinates before anything gets built on them:
 *
 *    1. the glucose is in 3B8A -- where does it sit, and which residues
 *       touch it? (the "substrate binds HERE, not anywhere on the
 *       surface" claim)
 *    2. how far does the cleft close on it?
 *    3. is the closed form GATED -- i.e. could glucose reach the site
 *       without the lobes opening? That is the structural criterion for
 *       induced fit vs conformational selection, and it is measurable
 *       rather than a matter of opinion.
 *
 *  Run:  node hexokinase/tools/probe-site.js
 * ===================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { readCA, align, superpose, dist } = require('./pdbio.js');

const DATA = path.join(__dirname, '..', 'data');
const OPEN = '1IG8', CLOSED = '3B8A';
const txt = id => fs.readFileSync(path.join(DATA, id + '.pdb'), 'utf8');

/* every heavy atom of one HET group, plus the protein's heavy atoms */
function atoms(text, { het, chain }) {
  const out = [];
  for (const line of text.split('\n')) {
    const rec = line.slice(0, 6);
    if (rec !== 'ATOM  ' && rec !== 'HETATM') continue;
    const alt = line[16];
    if (alt !== ' ' && alt !== 'A') continue;
    const resName = line.slice(17, 20).trim();
    const el = (line.slice(76, 78).trim() || line.slice(12, 14).trim()[0]);
    if (el === 'H') continue;
    if (het && resName !== het) continue;
    if (!het && rec !== 'ATOM  ') continue;
    if (chain && line[21] !== chain) continue;
    out.push({
      name: line.slice(12, 16).trim(), res: resName,
      n: parseInt(line.slice(22, 26), 10), chain: line[21], el,
      x: parseFloat(line.slice(30, 38)),
      y: parseFloat(line.slice(38, 46)),
      z: parseFloat(line.slice(46, 54)),
    });
  }
  return out;
}

const A = readCA(txt(OPEN)), B = readCA(txt(CLOSED));
const glc = atoms(txt(CLOSED), { het: 'BGC', chain: B.chain });
const prot = atoms(txt(CLOSED), { chain: B.chain });

console.log('='.repeat(66));
console.log(`1. the substrate in ${CLOSED}`);
console.log(`   BGC heavy atoms: ${glc.length}  (${glc.map(a => a.name).join(' ')})`);

/* residues whose ANY heavy atom is within 4 A of any glucose atom */
const contacts = new Map();
for (const p of prot) {
  let best = Infinity;
  for (const g of glc) best = Math.min(best, dist(p, g));
  if (best < 4.0) {
    const k = `${p.res}${p.n}`;
    if (!contacts.has(k) || contacts.get(k) > best) contacts.set(k, best);
  }
}
const sorted = [...contacts.entries()].sort((a, b) => a[1] - b[1]);
console.log(`   residues within 4.0 A: ${sorted.length}`);
for (const [k, d] of sorted) console.log(`     ${k.padEnd(8)} ${d.toFixed(2)} A`);
console.log(`   ...out of ${new Set(prot.map(p => p.res + p.n)).size} residues in the chain`
          + ` — the site is ${(sorted.length / new Set(prot.map(p => p.res + p.n)).size * 100).toFixed(1)}% of it`);

/* ---- 2. how far the cleft closes on the substrate ------------------- */
console.log('\n' + '='.repeat(66));
console.log('2. the cleft, open vs closed');

const al = align(A.seq, B.seq);
const PA = al.pairs.map(([i]) => A.ca[i]);
const PB = al.pairs.map(([, j]) => B.ca[j]);

/* lobes, as hinge.js finds them */
const INLIER = 1.5, SEED_K = 30;
function consensus(pool) {
  let best = null;
  for (const s of pool) {
    const near = [...pool].sort((i, j) => dist(PA[s], PA[i]) - dist(PA[s], PA[j])).slice(0, SEED_K);
    if (near.length < 12) continue;
    let set = near, last = -1, it = 0;
    while (set.length !== last && it++ < 20) {
      last = set.length;
      const moved = superpose(set.map(i => PA[i]), set.map(i => PB[i])).apply(PA);
      set = pool.filter(i => dist(moved[i], PB[i]) < INLIER);
      if (set.length < 12) break;
    }
    if (set.length >= 12 && (!best || set.length > best.length)) best = set;
  }
  return best || [];
}
const all = PA.map((_, i) => i);
const l1 = consensus(all);
const used = new Set(l1);
const l2 = consensus(all.filter(i => !used.has(i)));

/* Put everything in the open form's frame, on the large lobe -- the same
   frame the bake uses, so these numbers describe what the page draws. */
const fit = superpose(l1.map(i => PB[i]), l1.map(i => PA[i]));
const TB = fit.apply(PB);
const Tglc = fit.apply(glc);

const nearest = (pts, set) => {
  let m = Infinity;
  for (const i of set) for (const g of Tglc) m = Math.min(m, dist(pts[i], g));
  return m;
};
console.log(`   closest large-lobe Ca to glucose:  open ${nearest(PA, l1).toFixed(1)} A`
          + `   closed ${nearest(TB, l1).toFixed(1)} A`);
console.log(`   closest small-lobe Ca to glucose:  open ${nearest(PA, l2).toFixed(1)} A`
          + `   closed ${nearest(TB, l2).toFixed(1)} A`);

/* Which lobe grips the substrate. This is the induced-fit claim reduced to
   one number: if BOTH lobes contact it, the cleft has to shut for the
   grip to exist at all, and the closure is not decoration. */
const lobeOfRes = new Map();
for (const i of l1) lobeOfRes.set(PA[i].n, 1);
for (const i of l2) lobeOfRes.set(PA[i].n, 2);
let g1 = 0, g2 = 0, gx = 0;
for (const [k] of sorted) {
  const n = parseInt(k.slice(3), 10);
  const w = lobeOfRes.get(n);
  if (w === 1) g1++; else if (w === 2) g2++; else gx++;
}
console.log(`   contact residues by lobe:  large ${g1}   small ${g2}   hinge/unassigned ${gx}`);

/* ---- 3. is the closed form gated? ----------------------------------- */
console.log('\n' + '='.repeat(66));
console.log('3. is the site reachable without opening? (induced fit vs selection)');

/* Burial: count protein Ca within 12 A of the glucose centroid, open and
   closed. A site that gains a shell on closing is one the substrate could
   not have walked into. */
const c = Tglc.reduce((a, g) => ({ x: a.x + g.x / Tglc.length, y: a.y + g.y / Tglc.length, z: a.z + g.z / Tglc.length }), { x: 0, y: 0, z: 0 });
const shell = pts => pts.filter(p => dist(p, c) < 12).length;
console.log(`   Ca within 12 A of the site centre:  open ${shell(PA)}   closed ${shell(TB)}`);
console.log(`   (+${shell(TB) - shell(PA)} on closing)`);

let maxR = 0;
for (const g of Tglc) maxR = Math.max(maxR, dist(g, c));
console.log(`   glucose radius about its own centre: ${maxR.toFixed(1)} A`);
console.log('='.repeat(66));
