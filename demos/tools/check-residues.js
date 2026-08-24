#!/usr/bin/env node
/* =====================================================================
 *  check-residues.js — assert what residues.js claims.
 *
 *  Run:  node tools/check-residues.js        (offline, instant)
 *
 *  residues.js is generated, so half of this file is a staleness check —
 *  the same arrangement folding/ and hemoglobin/ use, and for the same
 *  reason: a table that no longer matches the structure it was measured
 *  from is invisible from any page that draws it.
 *
 *  The other half is the chemistry, and the one that earns its keep is
 *  L-CONFIGURATION. Every amino acid a ribosome makes except glycine is
 *  L, and a mirrored side chain is exactly the failure MolecularGeometry.md 1.3
 *  says internal checks cannot see: a D-leucine renders as a leucine.
 *  Here it CAN be seen, because chirality survives into the stored
 *  coordinates: the frame is built from the backbone, so which SIDE of it
 *  CB sits on is the configuration, and that is one sign to test. In the
 *  deposited structure the equivalent measure is the improper dihedral
 *  N-C-CA-CB, which comes out at a median -121.5 degrees over 2HHB's 534
 *  side chains — the textbook value for L, and +122 for D. Mirroring the
 *  table flips every stored z and the assertion below fails on all
 *  nineteen. It is the single most valuable line in this file.
 * ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const HERE = path.join(__dirname, '..');
const ResidueLib = require(path.join(HERE, 'lib', 'residues.js'));

let fails = 0;
function ok(cond, label, detail) {
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${label}${detail ? '   ' + detail : ''}`);
  if (!cond) fails++;
}

/* ---------------- the file is the one the baker would write ---------------- */

try {
  execFileSync(process.execPath, [path.join(__dirname, 'bake-residues.js'), '--check'],
               { stdio: 'pipe' });
  ok(true, 'residues.js matches a fresh bake of its sources');
} catch (e) {
  ok(false, 'residues.js matches a fresh bake of its sources',
     're-run: node tools/bake-residues.js');
}

/* ---------------- the twenty ---------------- */

const S = ResidueLib.SIDE;
const TYPES = Object.keys(S);
ok(TYPES.length === 20, 'exactly twenty standard amino acids', `${TYPES.length}`);

/* The textbook side-chain heavy-atom count of every one. This is the table
   that says "tryptophan" means something specific — the whole point of the
   file — and it is written out rather than derived, because a count
   derived from the same coordinates it is checking would agree with any
   mistake they contain. */
const HEAVY = { GLY:0, ALA:1, SER:2, CYS:2, THR:3, VAL:3, PRO:3, LEU:4, ILE:4,
                ASN:4, ASP:4, MET:4, GLN:5, GLU:5, LYS:5, HIS:6, ARG:7, PHE:7,
                TYR:8, TRP:10 };
{
  const wrong = TYPES.filter(t => S[t].atoms.length !== HEAVY[t]);
  ok(wrong.length === 0, 'every side chain has its textbook heavy-atom count',
     wrong.length ? wrong.map(t => `${t} ${S[t].atoms.length}!=${HEAVY[t]}`).join(' ')
                  : `${Object.values(HEAVY).reduce((a, b) => a + b, 0)} atoms in all`);
}
ok(S.GLY.atoms.length === 0, 'glycine has no side chain at all');

/* Elements: the only heteroatoms in a standard side chain are N, O and S,
   and exactly which types carry S is a fact worth pinning. */
{
  const bad = [];
  TYPES.forEach(t => S[t].atoms.forEach(a => {
    if (!'CNOS'.includes(a[1])) bad.push(`${t}.${a[0]}=${a[1]}`);
  }));
  ok(bad.length === 0, 'side chains are made of C, N, O and S only', bad.join(' '));
  const sulphur = TYPES.filter(t => S[t].atoms.some(a => a[1] === 'S')).sort();
  ok(sulphur.join(',') === 'CYS,MET', 'only cysteine and methionine carry sulphur',
     sulphur.join(',') || 'none');
}

/* ---------------- geometry ---------------- */

const dist = (a, b) => Math.hypot(a[0]-b[0], a[1]-b[1], a[2]-b[2]);
const xyz = a => [a[2], a[3], a[4]];

{
  let lo = Infinity, hi = 0, loAt = '', hiAt = '';
  for (const t of TYPES)
    for (const [i, j] of S[t].bonds) {
      const d = dist(xyz(S[t].atoms[i]), xyz(S[t].atoms[j]));
      if (d < lo) { lo = d; loAt = `${t} ${S[t].atoms[i][0]}-${S[t].atoms[j][0]}`; }
      if (d > hi) { hi = d; hiAt = `${t} ${S[t].atoms[i][0]}-${S[t].atoms[j][0]}`; }
    }
  ok(lo > 1.2 && hi < 1.9, 'every side-chain bond is a real bond length',
     `${lo.toFixed(2)} (${loAt}) to ${hi.toFixed(2)} (${hiAt})`);
}

/* CB sits one bond from CA, which is at the frame's origin — the graft
   depends on it and nothing else pins it. */
{
  let dev = -1, worst = 0, at = '';
  for (const t of TYPES) {
    if (!S[t].atoms.length) continue;
    const cb = S[t].atoms.find(a => a[0] === 'CB');
    if (!cb) { ok(false, `${t} has a CB`); continue; }
    const d = dist(xyz(cb), [0, 0, 0]);
    if (Math.abs(d - 1.53) > dev) { dev = Math.abs(d - 1.53); worst = d; at = t; }
  }
  ok(dev < 0.06, 'every CB is 1.53 A from its own CA',
     `furthest is ${at} at ${worst.toFixed(3)} A`);
}

/* Everything is connected: no atom floats, and the side chain reaches the
   backbone. A stray atom would draw as a sphere with no stick. */
{
  const orphans = [];
  for (const t of TYPES) {
    const n = S[t].atoms.length;
    if (!n) continue;
    const seen = new Set(S[t].anchors.map(a => a[0]));
    let grew = true;
    while (grew) {
      grew = false;
      for (const [i, j] of S[t].bonds) {
        if (seen.has(i) && !seen.has(j)) { seen.add(j); grew = true; }
        if (seen.has(j) && !seen.has(i)) { seen.add(i); grew = true; }
      }
    }
    if (seen.size !== n) orphans.push(`${t} ${n - seen.size}`);
  }
  ok(orphans.length === 0, 'every side-chain atom connects back to the backbone',
     orphans.join(' '));
}

/* The rings, by their own bond count: a ring closes, so a cyclic side
   chain has as many bonds as atoms once its anchor is counted. Proline is
   the one whose ring runs through the BACKBONE — CD bonds to N — which is
   what makes it the residue that kinks a chain. */
{
  const anchors = t => S[t].anchors.length;
  const cyclic = { HIS: 1, PHE: 1, TYR: 1, TRP: 2, PRO: 1 };   // rings expected
  const bad = [];
  for (const t of TYPES) {
    const n = S[t].atoms.length, b = S[t].bonds.length + anchors(t);
    const rings = b - n;                       // edges - nodes, over one component
    if ((cyclic[t] || 0) !== rings) bad.push(`${t} ${rings}!=${cyclic[t] || 0}`);
  }
  ok(bad.length === 0, 'the aromatic rings close, and only they do (Trp has two)',
     bad.join(' ') || 'His Phe Tyr Pro 1 each, Trp 2');
  ok(S.PRO.anchors.some(a => a[1] === 'N'),
     'proline closes its ring onto the backbone nitrogen — the reason it kinks a chain');
}

/* ---------------- L, not D ----------------
   The improper dihedral N-C-CB about CA. Positive is L. Every residue a
   ribosome makes is L except glycine, which has no CB to be either. */
{
  /* In the frame: CA = origin, C = (+|CA-C|, 0, 0), N lies in the z=0 plane
     with y > 0 (the frame's y is built to make it so). So the sign of CB's
     z coordinate IS the configuration: L puts CB on -z. */
  const wrong = [];
  for (const t of TYPES) {
    if (t === 'GLY') continue;
    const cb = S[t].atoms.find(a => a[0] === 'CB');
    if (cb[4] > 0) wrong.push(`${t} z=${cb[4].toFixed(2)}`);
  }
  ok(wrong.length === 0,
     'every residue is the L enantiomer, the one a ribosome makes',
     wrong.length ? 'D-AMINO ACIDS: ' + wrong.join(' ')
                  : '19 with a CB, all L (glycine has none to be either)');
}

/* ---------------- the graft puts them back where they came from ----------------
   Round trip: take a residue out of the source structure, graft the stored
   side chain onto its backbone, and the atoms should land on the deposited
   ones. Not exactly — the stored chain is ONE instance and this is a
   different copy — so it is the DISTRIBUTION that is asserted, not the
   worst case. Measured over 2HHB's 534 side chains the median miss is
   0.10 Å and the tail reaches 0.57, which is real variation in backbone
   geometry between residues rather than anything this file can fix; a
   frame that disagreed with the baker's would miss by ångströms across
   the board. That is the failure this catches. */
{
  const text = fs.readFileSync(path.join(HERE, 'hemoglobin/data/2HHB.pdb'), 'utf8');
  const res = new Map();
  for (const line of text.split('\n')) {
    if (!line.startsWith('ATOM')) continue;
    const alt = line[16];
    if (alt !== ' ' && alt !== 'A') continue;
    const key = line.slice(21, 27);
    if (!res.has(key)) res.set(key, { type: line.slice(17, 20).trim(), a: {} });
    res.get(key).a[line.slice(12, 16).trim()] =
      [+line.slice(30, 38), +line.slice(38, 46), +line.slice(46, 54)];
  }
  const misses = [];
  for (const r of res.values()) {
    if (!S[r.type] || !S[r.type].atoms.length) continue;
    if (!r.a.N || !r.a.CA || !r.a.C || !r.a.CB) continue;
    const got = ResidueLib.graft(r.type, r.a.N, r.a.CA, r.a.C);
    misses.push(dist(got.find(g => g.name === 'CB').p, r.a.CB));
  }
  misses.sort((a, b) => a - b);
  const at = p => misses[Math.floor(p * (misses.length - 1))];
  ok(misses.length > 500 && at(0.5) < 0.15 && at(0.95) < 0.35,
     'grafting a side chain lands its CB on the deposited one',
     `${misses.length} residues: median ${at(0.5).toFixed(3)} A, ` +
     `p95 ${at(0.95).toFixed(3)}, max ${misses[misses.length-1].toFixed(3)}`);
}

console.log(fails ? `\n${fails} FAILED` : '\nall checks passed');
process.exit(fails ? 1 : 0);
