#!/usr/bin/env node
/* =====================================================================
 *  check-pdb.js — assertions for pdb.js's orientation.
 *
 *  pdb.js rotates deposited coordinates onto their principal axes. That is a
 *  transform applied to a molecule nobody here authored, so it needs the same
 *  standard of proof as a hand-typed spec: MolecularGeometry.md §1.4 rule 2 —
 *  a chemical claim ships with the assertion that checks it.
 *
 *  The claim is "this is a rotation" and it has three parts:
 *
 *   1. WELL-FORMED   coordinates land in columns 31-54 and still parse. The
 *                    fields are fixed-width; an off-by-one silently corrupts
 *                    every atom.
 *   2. RIGID         interatomic distances survive (rounding only).
 *   3. SAME HAND     chirality survives. This is the one that matters and the
 *                    one distance-checking CANNOT catch, because a mirror
 *                    preserves every distance. We compare the SIGNED volume of
 *                    a fixed atom quadruple before and after; the sign flips
 *                    if and only if the structure was mirrored.
 *
 *  Run:  node tools/check-pdb.js        (offline, no dependencies)
 * ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const PDB = require('../pdb.js');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'pdb');
let failures = 0;

const fail = (what, msg) => { console.log(`  FAIL  ${what}: ${msg}`); failures++; };
const ok   = msg => console.log(`  ok    ${msg}`);

const atoms = text => {
  const out = [];
  for (const l of text.split('\n'))
    if (l.startsWith('ATOM') || l.startsWith('HETATM'))
      out.push([+l.slice(30, 38), +l.slice(38, 46), +l.slice(46, 54)]);
  return out;
};

// signed volume of the tetrahedron on four atoms — sign IS the handedness
const chirality = (P, i, j, k, l) => {
  const s = (a, b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
  const u = s(P[j], P[i]), v = s(P[k], P[i]), w = s(P[l], P[i]);
  return u[0]*(v[1]*w[2] - v[2]*w[1])
       - u[1]*(v[0]*w[2] - v[2]*w[0])
       + u[2]*(v[0]*w[1] - v[1]*w[0]);
};

const dist = (P, i, j) => Math.hypot(P[i][0]-P[j][0], P[i][1]-P[j][1], P[i][2]-P[j][2]);

const files = fs.existsSync(DIR)
  ? fs.readdirSync(DIR).filter(f => f.endsWith('.pdb')).sort()
  : [];

if (!files.length) {
  console.log('no pdb/*.pdb to check');
  process.exit(0);
}

for (const file of files) {
  const raw = fs.readFileSync(path.join(DIR, file), 'utf8');
  const A = atoms(raw);
  if (A.length < 5) { fail(file, 'fewer than 5 atoms parsed — wrong columns?'); continue; }

  // every orientation the library can produce, including the axis swap that
  // long:'y' performs — swapping two rows is exactly how a mirror gets in
  const MODES = [
    { mode: 'pca',  long: 'x' },
    { mode: 'pca',  long: 'y' },
    { mode: 'axis' }
  ];

  for (const opts of MODES) {
    const B = atoms(PDB.orient(raw, opts));
    const tag = `${file} ${opts.mode}${opts.long ? '/' + opts.long : ''}`;

    if (B.length !== A.length) { fail(tag, `atom count changed ${A.length} -> ${B.length}`); continue; }
    if (!B.every(p => p.every(Number.isFinite))) { fail(tag, 'produced a coordinate that will not parse'); continue; }

    // rigid: sample pairs across the whole structure, not just the first two
    let worst = 0;
    for (let n = 0; n < 40; n++) {
      const i = (n * 97) % A.length, j = (n * 613 + 7) % A.length;
      if (i === j) continue;
      worst = Math.max(worst, Math.abs(dist(A, i, j) - dist(B, i, j)));
    }
    if (worst > 0.005) { fail(tag, `not rigid — a distance moved by ${worst.toFixed(4)} A`); continue; }

    // same hand: several quadruples, because one could be near-degenerate
    let mirrored = false, checked = 0;
    for (let n = 0; n < 20; n++) {
      const q = [0, 1, 2, 3].map(k => (n * 131 + k * 37) % A.length);
      if (new Set(q).size < 4) continue;
      const before = chirality(A, ...q), after = chirality(B, ...q);
      if (Math.abs(before) < 1e-6) continue;         // coplanar: says nothing
      checked++;
      if (Math.sign(before) !== Math.sign(after)) mirrored = true;
    }
    if (mirrored)      fail(tag, 'MIRRORED — orientation flipped the structure into its enantiomer');
    else if (!checked) fail(tag, 'could not test chirality: every quadruple was coplanar');
    else               ok(`${tag.padEnd(18)} rigid (max ${worst.toFixed(4)} A), same hand (${checked} quadruples)`);
  }

  // the deposited mode must be a genuine passthrough
  if (PDB.orient(raw, { mode: 'deposited' }) !== raw) fail(file, "mode:'deposited' modified the file");

  const h = PDB.helices(raw);
  const n = k => Object.values(h[k]).reduce((s, r) => s + r.length, 0);
  console.log(`        helices: ${n('alpha')} alpha, ${n('three10')} 3-10, ${n('pi')} pi`);
}

/* =====================================================================
 *  folding-lab.html — the claims folding.js makes about 1VII.
 *
 *  MolecularGeometry.md §1.4 rule 2: a chemical claim ships with the
 *  assertion that checks it. folding-lab.html makes four, and all four are
 *  things a student is told in so many words, so none of them may drift
 *  silently if the H-bond cutoffs or the solver are ever retuned.
 * ===================================================================== */
const VII = path.join(DIR, '1VII.pdb');
if (fs.existsSync(VII)) {
  console.log('\nfolding-lab (1VII):');
  const FoldLib = require('../folding.js');
  const parsed = FoldLib.parse(fs.readFileSync(VII, 'utf8'), { sideChains: [47, 51, 58] });
  const hb = FoldLib.hbonds(parsed);

  // CLAIM 1 — "12 of the 14 are exactly this i->i+4 grip" (side panel)
  const i4 = hb.filter(b => b.sep === 4).length;
  if (hb.length !== 14) fail('1VII h-bonds', `expected 14 backbone H-bonds, found ${hb.length}`);
  else if (i4 !== 12)   fail('1VII i+4', `expected 12 i+4 H-bonds, found ${i4}`);
  else ok(`14 backbone H-bonds, ${i4} of them i->i+4 — the helix rule the page teaches`);

  // CLAIM 2 — "not one of them runs between helices" (act 2's whole premise).
  // A tertiary contact would show up as a large sequence separation; every
  // bond being local is exactly what makes act 2 need a different mechanism.
  const maxSep = Math.max(...hb.map(b => Math.abs(b.sep)));
  if (maxSep > 4) fail('1VII locality',
    `an H-bond spans ${maxSep} residues — act 2 claims none is tertiary`);
  else ok(`every H-bond is local (max separation ${maxSep}) — none packs the helices`);

  // CLAIM 3 — the start state is genuinely extended, so act 1 shows a real
  // collapse rather than a nudge
  const E = FoldLib.extended(parsed), v = FoldLib._v3;
  const ca = parsed.residues.map(r => r.atoms.CA).filter(x => x != null);
  const span = v.dist(E[ca[0]], E[ca[ca.length - 1]]);
  const nativeSpan = v.dist(parsed.nodes[ca[0]].native, parsed.nodes[ca[ca.length - 1]].native);
  if (span < 100) fail('1VII extended', `start state only ${span.toFixed(1)} A end-to-end`);
  else ok(`starts ${span.toFixed(0)} A end-to-end, folds to ${nativeSpan.toFixed(1)} A`);

  // CLAIM 4 — the fold actually arrives. If this drifts, the animation ends
  // on something that is not the deposited structure and the page is lying.
  const folder = FoldLib.Folder(parsed);
  const fresh = folder.bake(FoldLib.BAKE.frames, FoldLib.BAKE.keep);
  const rmsd = folder.rmsd(), formed = folder.formation().filter(x => x > 0.5).length;
  if (rmsd > 1.0)        fail('1VII fold', `ends ${rmsd.toFixed(2)} A from the deposited structure`);
  else if (formed !== 14) fail('1VII fold', `only ${formed}/14 H-bonds formed at the end`);
  else ok(`fold lands ${rmsd.toFixed(2)} A RMSD from deposited, all 14 H-bonds formed`);

  /* CLAIM 5 — the atoms still fit on their bonds.
     folding-lab draws in real angstroms and takes its display radii from the
     house palette, divided by SCALE. That keeps its ball-and-stick proportions
     identical to every other page — but it also means a change to
     PALETTE.radii silently changes THIS page's geometry, and check-molecules
     cannot catch it because this page has no spec in the registry. So apply
     check-molecules' own rule here: two bonded spheres must not merge, or the
     stick between them is buried inside the atoms and the bond renders as
     nothing. */
  const LIB = require('../lib-node.js');
  const RAD = Object.fromEntries(['C','N','O','H']
    .map(e => [e, LIB.PALETTE.radii[e] / LIB.SCALE]));
  const I = FoldLib.IDEAL;
  const BONDED = [['N','H',I.N_H], ['C','O',I.C_O], ['C','N',I.C_N],
                  ['N','C',I.N_CA], ['C','C',I.CA_C]];
  let merged = null, tightest = Infinity;
  for (const [a, b, L] of BONDED) {
    const clear = L - (RAD[a] + RAD[b]);
    if (clear < tightest) { tightest = clear; }
    if (clear <= 0) merged = `${a}-${b} at ${L.toFixed(3)} A vs radii summing ${(RAD[a]+RAD[b]).toFixed(3)}`;
  }
  if (merged) fail('1VII radii', `bonded spheres merge — ${merged}; the stick renders as nothing`);
  else ok(`display radii clear every backbone bond (tightest ${tightest.toFixed(3)} A, N-H)`);

  /* CLAIM 6 — the COMMITTED trajectory is the one this solver produces.
     folding-lab.html no longer folds anything: it plays pdb/1VII.fold.bin.
     That file is only trustworthy while it matches the code, and nothing
     about a stale one looks wrong — it animates a perfectly plausible fold
     that the current solver would never generate. Compared byte-for-byte,
     which is exact because the format stores the solver's own Float32s. */
  const BIN = path.join(DIR, '1VII.fold.bin');
  if (!fs.existsSync(BIN)) {
    fail('1VII baked fold', 'pdb/1VII.fold.bin is missing — run: node tools/bake-fold.js');
  } else {
    const onDisk = fs.readFileSync(BIN);
    const expect = Buffer.from(FoldLib.encode(fresh));
    if (!onDisk.equals(expect)) {
      const why = onDisk.length !== expect.length
        ? `different size — ${onDisk.length} bytes on disk vs ${expect.length} fresh`
        : `same size, different contents — first differs at byte ${
            [...onDisk].findIndex((b, i) => b !== expect[i])}`;
      fail('1VII baked fold',
        `pdb/1VII.fold.bin does not match this solver (${why}) — re-run: node tools/bake-fold.js`);
    }
    else ok(`baked trajectory on disk matches a fresh bake exactly (${(onDisk.length/1024).toFixed(0)} KB)`);
  }
}

if (failures) { console.log(`\nFAIL: ${failures} assertion(s) failed`); process.exit(1); }
console.log('\nPASS: orientation is a rotation — rigid, well-formed, and never mirrored');
