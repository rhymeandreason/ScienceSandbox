#!/usr/bin/env node
/* =====================================================================
 *  check-amylase.js — the assertions behind amylase-test.html's numbers.
 *
 *  Every figure the page prints is read out of amylase.json, so what is
 *  left to check is that the JSON still describes 1OSE. Re-measured HERE
 *  from the PDB rather than trusted: a baker that silently picks up the
 *  lone BGC A996 as a fifth subsite, or loses the ligand chain to an
 *  altloc filter, writes a file that looks entirely reasonable.
 *
 *  The published values it is held against, and where they come from:
 *  the site is a trough spanning four subsites over ~20 A, and amylase
 *  needs chloride, which sits within ~6 A of the sugar.
 *
 *  Run:  node amylase/tools/check-amylase.js
 * ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, '..', 'data');
const J = JSON.parse(fs.readFileSync(path.join(DATA, 'amylase.json'), 'utf8'));
const PDB = fs.readFileSync(path.join(DATA, '1OSE.pdb'), 'utf8');

let bad = 0;
const ok = (cond, msg) => {
  console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${msg}`);
  if (!cond) bad++;
};
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const dist = (a, b) => Math.hypot(a[0]-b[0], a[1]-b[1], a[2]-b[2]);

console.log('\n== 1. the ligand is the chained tetrasaccharide, and only that');
const names = J.ligand.residues.map(r => r.name + r.num).join('-');
ok(names === 'BGC1-AC12-GLC3-AC14', `ligand is ${names}, the LINK chain in the file`);
ok(J.ligand.residues.length === 4, `${J.ligand.residues.length} subsites`);
/* The lone glucose across the molecule is HETATM BGC A 996 and would look
   like a fifth unit to anything selecting on residue name. */
ok(!J.ligand.atoms.some(a => a.num === 996), 'BGC A996 is not in the ligand');
/* 12 + 21 + 11 + 21, the four HETATM residues of chain B. */
ok(J.ligand.atoms.length === 65, `${J.ligand.atoms.length} heavy atoms in chain B`);

console.log('\n== 2. bonds by distance separated bonded from merely close');
/* SIX rings, not four, and the difference is the whole reason acarbose
   works: AC1 is acarviosine, a valienamine cyclohexene joined by an N to
   a 4-amino-4,6-dideoxyglucose, so each of the two AC1 units carries two
   rings and the ligand is a PSEUDO-tetrasaccharide — four subsites, six
   rings, and a nitrogen where a glycosidic oxygen should be, which is why
   the enzyme cannot cut it and it sits in the site to be crystallised.
   Euler on the bond graph: rings = edges - vertices + components. A cut
   that let a merely-close pair through would raise the count. */
const V = J.ligand.atoms.length, E = J.ligand.bonds.length;
const parent = [...Array(V).keys()];
const find = x => parent[x] === x ? x : (parent[x] = find(parent[x]));
for (const [i, j] of J.ligand.bonds) parent[find(i)] = find(j);
const comps = new Set([...Array(V).keys()].map(find)).size;
ok(comps === 1, `the ligand is one connected piece (${comps})`);
ok(E - V + comps === 6, `${E - V + comps} rings over 4 subsites (each AC1 is two)`);

console.log('\n== 3. the trough, re-measured off the PDB');
const atoms = [];
for (const line of PDB.split('\n')) {
  if (!line.startsWith('ATOM') && !line.startsWith('HETATM')) continue;
  const alt = line[16];
  if (alt !== ' ' && alt !== 'A') continue;
  const el = (line.slice(76,78).trim() || line.slice(12,14).trim()[0]).toUpperCase();
  if (el === 'H') continue;
  atoms.push({ name: line.slice(17,20).trim(), chain: line[21], num: +line.slice(22,26),
               el, het: line.startsWith('HETATM'),
               p: [+line.slice(30,38), +line.slice(38,46), +line.slice(46,54)] });
}
const lig = atoms.filter(a => a.chain === 'B' && a.num >= 1 && a.num <= 4);
let span = 0;
for (let i = 0; i < lig.length; i++) for (let j = i+1; j < lig.length; j++)
  span = Math.max(span, dist(lig[i].p, lig[j].p));
ok(near(span, J.trough.span, 0.01), `span ${span.toFixed(2)} A matches the file`);
ok(near(span, 19.8, 1.0), `${span.toFixed(1)} A is the published ~19.8 A trough`);

const prot = atoms.filter(a => !a.het || a.name === 'PCA');
const hit = new Set();
for (const s of lig) for (const p of prot)
  if (dist(s.p, p.p) <= J.trough.contactCut) hit.add(p.chain + p.num + ':' + p.name);
ok(hit.size === J.trough.contactUnion, `${hit.size} contact residues, as written`);
ok(hit.size / J.residues < 0.1,
   `the site is ${(hit.size / J.residues * 100).toFixed(1)}% of the protein`);

console.log('\n== 4. a track, not a pocket');
/* Neighbouring subsites sharing most of their contacts would mean one
   cavity that four sugars happen to sit in, and the page says otherwise. */
for (const s of J.trough.adjacentOverlap)
  ok(s.both / s.of < 0.6,
     `adjacent subsites share ${s.both}/${s.of} of the smaller contact set`);

console.log('\n== 5. the ions');
const cl = J.ionDistances.find(i => i.el === 'CL');
const ca = J.ionDistances.find(i => i.el === 'CA');
ok(cl && near(cl.toLigand, 5.9, 0.5), `Cl- sits ${cl && cl.toLigand} A from the sugar`);
ok(ca && ca.toLigand > cl.toLigand, `Ca2+ (${ca && ca.toLigand} A) is the further of the two`);

console.log('\n== 6. the surface is in the ligand\'s frame');
const buf = fs.readFileSync(path.join(DATA, '1OSE.surf.bin'));
ok(buf.slice(0, 4).toString('ascii') === 'SES1', 'the mesh is an SES1 file');
const head = JSON.parse(buf.slice(8, 8 + buf.readUInt32LE(4)).toString('utf8'));
ok(head.centre.every((v, i) => near(v, J.centre[i], 1e-6)),
   'the skin was centred on the same centroid the JSON publishes');
/* Every ligand atom must land inside the mesh's own box, or the page is
   drawing sticks beside a protein rather than in it. */
const hi = head.qmin.map((lo, c) => lo + head.qscale[c] * 65535);
ok(J.ligand.atoms.every(a => a.p.every((v, c) => v > head.qmin[c] - 2 && v < hi[c] + 2)),
   'the ligand lies inside the skin\'s bounding box');
/* The ligand was excluded from the skin, which is the whole point of the
   trough being open — so no ligand residue may appear in its table. */
ok(!head.residues.some(([ch, n]) => ch === 'B' && n <= 4),
   'no ligand residue is in the surface: the trough is empty');

console.log(bad ? `\nFAIL: ${bad} check(s)\n` : '\nPASS: amylase.json still describes 1OSE\n');
process.exit(bad ? 1 : 0);
