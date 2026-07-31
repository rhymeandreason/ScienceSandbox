#!/usr/bin/env node
/* =====================================================================
 *  check-molecules.js — geometry audit for molecules.js
 *
 *  Run:  node check-molecules.js          (exits non-zero on failure)
 *
 *  Why this exists: the display radii in PALETTE are stylised and LARGE
 *  relative to the bond lengths, so a bond shorter than the sum of its two
 *  atoms' radii has its stick swallowed by the spheres and renders as a
 *  blob. So: every bonded pair must clear, every NON-bonded pair within a
 *  molecule must not overlap either, and bond angles are printed so a new
 *  molecule's shape can be eyeballed against its real VSEPR geometry.
 *  Run this after adding or editing anything in MOLECULES.
 *
 *  It also audits PROVENANCE, unconditionally: every spec must carry a `src:`
 *  naming which of the five paths produced its coordinates
 *  (hand | pubchem | skel | built | mirror), plus the fields that path needs to
 *  be answerable — a pubchem spec without a cid/query, a record, a tool and an
 *  explicit `conformer` (null counts, and means "never pinned") FAILs. This
 *  checks shape, not truth: nothing here can tell whether a CID is the RIGHT
 *  CID. See the provenance note in molecules.js and docs/molecule-pipeline.md
 *  items 1–2. Unlike the claims below, it does not wait to be opted into.
 *
 *  It also audits the DISTINGUISHING-FEATURE CLAIMS a spec declares — the
 *  error class nothing above can see, because a wrong stereocentre has perfect
 *  bond lengths, textbook angles, and renders beautifully. It is only caught
 *  when a spec DECLARES what it should be, so the declaration is not optional
 *  decoration; MolecularGeometry.md §1.3 has the two incidents that established this.
 *
 *  Six declarations, each FAILing if the geometry disagrees (MolecularGeometry.md §1.4
 *  is the reference; add a new claim type here in the same commit that adds
 *  the molecule making the claim):
 *
 *    stereo:'all-equatorial'      every ring substituent equatorial  [glucose]
 *    stereo:{ axial:[i,…] }       exactly these ring atoms axial, every other
 *                                 one equatorial                 [galactose]
 *    stereo:{ faces:{i:'a',…} }   which substituents share a ring face, for a
 *                                 furanose too flat for axial/equatorial to
 *                                 mean anything. RELATIVE pattern only — the
 *                                 normal's sign is arbitrary, so this cannot
 *                                 catch a global mirror   [ribose, deoxyribose]
 *    topology:{ rings:[…],        ring count, ring sizes, and (fused) that a
 *               fused:true }      bicycle shares an edge  [purine/pyrimidine]
 *    chirality:'L'                signed volume over CIP priorities
 *                                 N > C(carboxyl) > R > H. Requires `pep`, so
 *                                 amino acids only        [the amino acids]
 *    cis:{ atoms:[i,j,k,l],       the i-j-k-l dihedral about the j-k bond is
 *           value:true }         ~0° (cis/Z) if true, ~180° (trans/E) if
 *                                 false — a double bond's C=C length and its
 *                                 ~120° flanking angles are identical either
 *                                 way, so only the torsion tells them apart
 *                                 [palmitoleate]
 *    glycosidic:{ anomeric:i,     a sugar–sugar link: the bridge O joins the
 *      bridge:o, partner:j,       anomeric carbon of ONE ring to carbon 4 of
 *      config:'alpha'|'beta',     ANOTHER, and the bond leaving the anomeric
 *      link:'1→4' }               carbon is axial (α) or equatorial (β). α and β
 *                                 are the same two sugars, the same bridge and
 *                                 the same angles — starch vs cellulose
 *                                 [maltose, cellobiose]
 *
 *  A spec with no declaration gets its ring pattern printed for eyeballing.
 * ===================================================================== */
'use strict';

// lib-node.js walks MolLib.DOMAINS and loads every domain file, so this sees
// the whole library even though no single PAGE does. (The `})(this)` at the
// foot of each module is what puts MolLib on module.exports under CommonJS.)
const { PALETTE, MOLECULES } = require('./lib-node.js');

const TIGHT = 0.03;   // a positive but very small gap: renders, but barely

const EQ_MAX_TILT = 45;   // substituent within this angle of the ring PLANE = equatorial

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const angle = (a, b, c) => {
  const u = [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const v = [c[0] - b[0], c[1] - b[1], c[2] - b[2]];
  const dot = u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  return Math.acos(dot / (Math.hypot(...u) * Math.hypot(...v))) * 180 / Math.PI;
};
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1],
                         a[2] * b[0] - a[0] * b[2],
                         a[0] * b[1] - a[1] * b[0]];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = v => { const l = Math.hypot(...v) || 1; return v.map(x => x / l); };
// Signed torsion (degrees) of p0-p1-p2-p3 about the p1-p2 bond: 0° means p0
// and p3 eclipse on the SAME side (cis/Z), ±180° means opposite sides
// (trans/E). Standard atan2 form so it stays well-defined even when p1-p2
// is exactly in-plane with p0/p3, which is the common case for a double bond
// drawn flat (MolecularGeometry.md §1.6 schematic style) rather than as a real 3D
// conformer.
const dihedral = (p0, p1, p2, p3) => {
  const b1 = sub(p1, p0), b2 = sub(p2, p1), b3 = sub(p3, p2);
  const n1 = cross(b1, b2), n2 = cross(b2, b3);
  const m1 = cross(n1, unit(b2));
  return Math.atan2(dot3(m1, n2), dot3(n1, n2)) * 180 / Math.PI;
};

// Smallest cycles in the bond graph: for each bond, look for another route
// between its two ends. Rings here are 5- or 6-membered sugars; anything larger
// is not a ring we have an axial/equatorial story for.
function findRings(atomCount, bonds) {
  const adj = Array.from({ length: atomCount }, () => []);
  bonds.forEach(([i, j]) => { adj[i].push(j); adj[j].push(i); });
  const rings = [], seen = new Set();
  for (const [i, j] of bonds) {
    const prev = new Map([[i, null]]);
    const queue = [i];
    let done = false;
    while (queue.length && !done) {
      const u = queue.shift();
      for (const v of adj[u]) {
        if ((u === i && v === j) || (u === j && v === i)) continue;   // skip this bond
        if (prev.has(v)) continue;
        prev.set(v, u);
        if (v === j) { done = true; break; }
        queue.push(v);
      }
    }
    if (!prev.has(j)) continue;
    const path = [];
    for (let c = j; c !== null; c = prev.get(c)) path.push(c);
    if (path.length < 5 || path.length > 6) continue;
    const sig = [...path].sort((a, b) => a - b).join(',');
    if (seen.has(sig)) continue;
    seen.add(sig);
    rings.push(path);
  }
  return rings;
}

// Mean-plane normal of a ring, summed over its edges so a puckered chair still
// gives a stable axis rather than one triangle's normal.
function ringNormal(ring, P) {
  const c = ring.reduce((s, i) => [s[0] + P(i)[0] / ring.length,
                                   s[1] + P(i)[1] / ring.length,
                                   s[2] + P(i)[2] / ring.length], [0, 0, 0]);
  let n = [0, 0, 0];
  for (let k = 0; k < ring.length; k++) {
    const x = cross(sub(P(ring[k]), c), sub(P(ring[(k + 1) % ring.length]), c));
    n = [n[0] + x[0], n[1] + x[1], n[2] + x[2]];
  }
  return unit(n);
}

let failures = 0, warnings = 0, stereoFails = 0, chiralFails = 0, nameFails = 0,
    smilesFails = 0, srcFails = 0;

/* ---- provenance ------------------------------------------------------
 * Every spec must say where its coordinates came from. This is the one audit
 * here that is UNCONDITIONAL — it does not wait for a spec to opt in, because
 * the failure it prevents is a spec silently joining the library with no
 * record of what produced it, which is exactly how the reproducibility sweep
 * in docs/molecule-pipeline.md item 0 ended up with five unregenerable specs.
 *
 * It checks shape, not truth: nothing here can tell whether a CID is the right
 * CID. What it can guarantee is that the question is always answerable.
 * Note `conformer` is checked with `in`, not for truthiness — null is a
 * deliberate claim ("never pinned") and must not be confused with absent.
 */
const SRC_PATHS = ['hand', 'pubchem', 'skel', 'built', 'mirror'];
// How completely a spec can be rebuilt from its committed source. This is a
// RECORDED VERDICT from an actual run, not something re-derived here — checking
// it for real needs the converters and (for 'lost') the network.
//   exact  — the committed .sdf regenerates this spec to 0.000
//   manual — the .sdf is the true source, but a hand step sits in the middle
//   lost   — no published record reproduces it; the SPEC is now the source
const SRC_REGEN = ['exact', 'manual', 'lost'];
const SDF_DIR = require('path').join(__dirname, 'tools', 'sdf');
console.log('\n== provenance (`src:` on every spec)');
{
  const byPath = {};
  let unpinned = 0;
  for (const [key, mol] of Object.entries(MOLECULES)) {
    const s = mol.src;
    const bad = m => { srcFails++; console.log(`  SRC FAIL  ${key}: ${m}`); };
    // `units` says whether the FILE holds real angstroms (register() applies
    // the display scale) or numbers already in scene units. It is not inferable
    // from anything else, and getting it wrong is a silent 1.9x — large enough
    // to see, small enough to be mistaken for a styling choice.
    if (!['angstrom', 'scene'].includes(mol.units))
      bad(`units must be 'angstrom' or 'scene', got ${JSON.stringify(mol.units)}`
        + ' — see the units note in molecules.js');
    if (!s || !s.path) { bad('no `src:` — see the provenance note in molecules.js'); continue; }
    if (!SRC_PATHS.includes(s.path)) { bad(`unknown src.path '${s.path}' (expected ${SRC_PATHS.join('|')})`); continue; }
    // A Skel spec is built from GL/AR, which are real angstroms by definition.
    if (s.path === 'skel' && mol.units !== 'angstrom')
      bad("src.path 'skel' must be units:'angstrom' — GL/AR are real angstroms");
    (byPath[s.path] = byPath[s.path] || []).push(key);
    if (s.path === 'pubchem') {
      if (!s.cid && !s.query) bad('src.path pubchem needs a `cid` or a `query`');
      if (!s.record) bad('src.path pubchem needs a `record` (e.g. "3d")');
      if (!s.tool) bad('src.path pubchem needs a `tool` (which converter)');
      if (!('conformer' in s)) bad('src.path pubchem must state `conformer` — use null '
        + 'to record that it was never pinned; absent is not the same claim');
      else if (s.conformer === null) unpinned++;
      if (!s.regen) bad('src.path pubchem needs `regen` (' + SRC_REGEN.join('|') + ')');
      else if (!SRC_REGEN.includes(s.regen)) bad(`unknown src.regen '${s.regen}'`);
      // A committed .sdf that isn't there is worse than none: it makes a spec
      // look reproducible while nothing backs the claim.
      if (s.sdf) {
        if (!require('fs').existsSync(require('path').join(SDF_DIR, s.sdf)))
          bad(`src.sdf '${s.sdf}' is not in tools/sdf/`);
      } else if (s.regen === 'exact') {
        bad("regen:'exact' claims the source regenerates this spec, so `sdf` must "
          + 'name the committed record that does it');
      }
      // conformer:null with regen:'exact' is contradictory — an exact rebuild
      // means the conformer IS pinned, whether or not anyone wrote it down.
      if (s.regen === 'exact' && s.conformer === null)
        bad("regen:'exact' contradicts conformer:null — if it rebuilds exactly, pin the conformer");
    }
    if (s.path === 'mirror') {
      if (!s.of) bad('src.path mirror needs `of`');
      else if (!MOLECULES[s.of]) bad(`src.of '${s.of}' is not a spec in this library`);
    }
    if (s.path === 'built' && !s.method) bad('src.path built needs a `method` — it is the '
      + 'only record of how the literals were derived');
  }
  if (!srcFails) {
    console.log('  ok    ' + Object.keys(byPath).sort()
      .map(p => `${p} ${byPath[p].length}`).join(' · ')
      + `  (${Object.keys(MOLECULES).length} specs)`);
    const regen = {};
    for (const m of Object.values(MOLECULES)) if (m.src && m.src.regen)
      regen[m.src.regen] = (regen[m.src.regen] || 0) + 1;
    console.log(`  ok    regen: ` + Object.keys(regen).sort().map(r => `${r} ${regen[r]}`).join(" · "));
    if (unpinned) console.log(`  note  ${unpinned} spec(s) carry conformer:null — no published `
      + `record reproduces them, so the SPEC is the source. Do not refresh these from `
      + `PubChem; see their comments in molecules.js.`);
  }
}

for (const [key, mol] of Object.entries(MOLECULES)) {
  if (!mol.atoms) continue;            // ionic entries carry no geometry
  const R = i => PALETTE.radii[mol.atoms[i].el] || 0.7;
  const P = i => mol.atoms[i].pos;
  const label = i => (mol.names ? mol.names[i] : mol.atoms[i].el + i);
  const bonds = mol.bonds || [];
  const bonded = new Set(bonds.map(([i, j]) => (i < j ? `${i},${j}` : `${j},${i}`)));

  console.log(`\n== ${key} (${mol.formula})`);

  // ---- atom names ------------------------------------------------------
  // `names` is what lets `diff` say what it selects rather than where it lands.
  // Nothing else enforces it, so this is where a bad rename gets caught: wrong
  // length, a duplicate, or a reference resolving to nothing.
  if (mol.names) {
    const dupes = mol.names.filter((n, i) => mol.names.indexOf(n) !== i);
    if (mol.names.length !== mol.atoms.length) {
      nameFails++;
      console.log(`   NAME FAIL: ${mol.names.length} names for ${mol.atoms.length} atoms`);
    }
    if (dupes.length) {
      nameFails++;
      console.log(`   NAME FAIL: duplicate name(s) ${[...new Set(dupes)].join(', ')} `
        + `— a name must select exactly one atom`);
    }
    // A name's first letter is its element (H, C, N, O, S, P are all one
    // character here), so a name and the atom it sits on must agree. This is
    // the check that matters for the BUILDER-made specs — sugars and bases get
    // a literal `names` array beside a computed `atoms` array, and reordering
    // the build would slide the two out of step. Length alone would not notice
    // a swap; element disagreement does.
    const wrong = mol.names
      .map((n, i) => (n && n[0] !== mol.atoms[i].el ? `${n} on ${mol.atoms[i].el}${i}` : null))
      .filter(Boolean);
    if (wrong.length) {
      nameFails++;
      console.log(`   NAME FAIL: name/element disagreement — ${wrong.slice(0, 4).join(', ')}`
        + (wrong.length > 4 ? ` (+${wrong.length - 4} more)` : '')
        + `\n     the \`names\` array has drifted out of step with \`atoms\``);
    }
    if (mol.names.length === mol.atoms.length && !dupes.length && !wrong.length)
      console.log(`   names OK: ${mol.atoms.length} unique labels, elements agree`);
  }
  // ---- the generated SMILES ------------------------------------------
  // `smiles` is produced by tools/spec2smiles.js and committed, so it can drift
  // from the `atoms`/`bonds` it was generated from. RDKit would settle it
  // properly but is a dev dependency this checker must not need, so two cheap
  // invariants stand in, and both catch a stale string:
  //   · the heavy-atom count must match the spec's
  //   · the atom-map marks (:1) must match the folded `diff` — folded because a
  //     hydrogen has no glyph in a skeletal drawing and marks its heavy parent
  if (mol.smiles) {
    let n = 0;
    for (let i = 0; i < mol.smiles.length; i++) {
      const c = mol.smiles[i];
      if (c === '[') { n++; i = mol.smiles.indexOf(']', i); continue; }
      const two = mol.smiles.slice(i, i + 2);
      if (two === 'Cl' || two === 'Br') { n++; i++; continue; }
      if ('BCNOPSFI'.includes(c) || 'bcnops'.includes(c)) n++;
    }
    const heavy = mol.atoms.filter(a => a.el !== 'H').length;
    if (n !== heavy) {
      smilesFails++;
      console.log(`   SMILES FAIL: ${n} heavy atoms in the string, ${heavy} in the spec `
        + `— re-run tools/spec2smiles.js`);
    }
    const adj = mol.atoms.map(() => []);
    (mol.bonds || []).forEach(([i, j]) => { adj[i].push(j); adj[j].push(i); });
    const folded = new Set(((mol.contrast && mol.contrast.diff) || []).map(r => {
      const i = typeof r === 'number' ? r : (mol.names || []).indexOf(r);
      return mol.atoms[i] && mol.atoms[i].el === 'H'
        ? adj[i].find(j => mol.atoms[j].el !== 'H') : i;
    }));
    const marks = (mol.smiles.match(/:1]/g) || []).length;
    if (marks !== folded.size) {
      smilesFails++;
      console.log(`   SMILES FAIL: ${marks} highlight marks, but \`diff\` folds to `
        + `${folded.size} heavy atom(s) — re-run tools/spec2smiles.js`);
    }
    if (n === heavy && marks === folded.size)
      console.log(`   smiles OK: ${heavy} heavy atoms, ${marks} highlight mark(s)`);
  }

  // Every atom reference must resolve. Migrated specs use names; the rest still
  // use integers, which are range-checked instead.
  if (mol.contrast && mol.contrast.diff) {
    for (const r of mol.contrast.diff) {
      const ok = typeof r === 'number'
        ? (Number.isInteger(r) && r >= 0 && r < mol.atoms.length)
        : (mol.names && mol.names.indexOf(r) >= 0);
      if (!ok) {
        nameFails++;
        console.log(`   NAME FAIL: contrast.diff references '${r}', not an atom of `
          + `this spec${typeof r === 'string' && !mol.names ? ' (spec has no `names`)' : ''}`);
      }
    }
  }

  for (const [i, j] of bonds) {
    const len = dist(P(i), P(j)), radii = R(i) + R(j), gap = len - radii;
    let flag = '';
    if (gap <= 0) { flag = '   <-- SPHERES MERGE, bond stick hidden'; failures++; }
    else if (gap < TIGHT) { flag = '   <-- very tight'; warnings++; }
    console.log(`   bond  ${label(i)}-${label(j)}: len ${len.toFixed(3)}`
      + `  radii ${radii.toFixed(2)}  gap ${gap.toFixed(3)}${flag}`);
  }

  // Atoms that are NOT bonded must still not interpenetrate — a too-small
  // bond angle can fold two H's into each other even when every bond is fine.
  for (let i = 0; i < mol.atoms.length; i++) {
    for (let j = i + 1; j < mol.atoms.length; j++) {
      if (bonded.has(`${i},${j}`)) continue;
      const gap = dist(P(i), P(j)) - (R(i) + R(j));
      if (gap < 0) {
        failures++;
        console.log(`   NON-BONDED OVERLAP ${label(i)}..${label(j)}: gap ${gap.toFixed(3)}`);
      }
    }
  }

  // Bond angles at each shared atom — informational, for checking VSEPR shape.
  const seen = new Set();
  for (const [i, j] of bonds) {
    for (const [p, q] of bonds) {
      const c = [i, j].find(x => x === p || x === q);
      if (c === undefined) continue;
      const a = i === c ? j : i, b = p === c ? q : p;
      if (a >= b) continue;
      const sig = `${a},${c},${b}`;
      if (seen.has(sig)) continue;
      seen.add(sig);
      console.log(`   angle ${label(a)}-${label(c)}-${label(b)}: `
        + `${angle(P(a), P(c), P(b)).toFixed(1)}°`);
    }
  }

  // ---- α-carbon handedness (L vs D) -----------------------------------
  // A mirror image has identical bond lengths, identical bond angles and an
  // identical-looking render — so nothing above can see it. The converter
  // shipped D-amino acids for exactly this reason: its reframe negated one
  // output component, which is a reflection, not a rotation. Life is
  // homochiral (L-amino acids), so specs declare it and we check the sign of
  // the signed volume over CIP priorities N > C(carboxyl) > R > H.
  if (mol.chirality && mol.pep) {
    const CA_IDX = 3, R_IDX = 9;         // fixed backbone order, see molecules.js
    const Ca = P(CA_IDX);
    const v1 = sub(P(mol.pep.nN), Ca), v2 = sub(P(mol.pep.cC), Ca), v3 = sub(P(R_IDX), Ca);
    const vol = dot3(cross(v1, v2), v3);
    const actual = vol > 0 ? 'L' : 'D';
    if (actual !== mol.chirality) {
      chiralFails++;
      console.log(`   CHIRALITY FAIL: spec declares ${mol.chirality}- but geometry is ${actual}-`
        + ` (signed volume ${vol.toFixed(2)})`);
      console.log(`     A mirrored frame inverts this and changes NOTHING else —`);
      console.log(`     check the converter's basis is right-handed (e3 = e1 x e2).`);
    } else {
      console.log(`   chirality OK: ${actual}- as declared (signed volume ${vol.toFixed(2)})`);
    }
  }

  // ---- alkene cis/trans --------------------------------------------------
  // A cis double bond has the same C=C bond length and the same ~120° angles
  // at each alkene carbon as trans does — the render, the bond-length table
  // and the angle table above all look identical either way. What differs is
  // the torsion about the C=C: `cis:{atoms:[i,j,k,l], value}` names the four
  // atoms i-j=k-l (the double bond is j-k), and asserts the dihedral is near
  // 0° (cis/Z) when value is true, or near 180° (trans/E) when false.
  if (mol.cis) {
    const [i, j, k, l] = mol.cis.atoms;
    const dh = dihedral(P(i), P(j), P(k), P(l));
    const isCis = Math.abs(dh) < 90;
    if (isCis !== mol.cis.value) {
      stereoFails++;
      console.log(`   CIS/TRANS FAIL: spec declares ${mol.cis.value ? 'cis' : 'trans'} `
        + `but the ${label(i)}-${label(j)}-${label(k)}-${label(l)} dihedral is ${dh.toFixed(1)}°`);
      console.log(`     Same bond length, same bond angles, same render either way —`);
      console.log(`     only the torsion about the C=C tells cis from trans.`);
    } else {
      console.log(`   cis/trans OK: ${mol.cis.value ? 'cis' : 'trans'} as declared `
        + `(${label(i)}-${label(j)}-${label(k)}-${label(l)} dihedral ${dh.toFixed(1)}°)`);
    }
  }

  // ---- ring topology ---------------------------------------------------
  // Purine vs pyrimidine makes no stereochemical claim at all — its claim is
  // COUNT. Two fused rings vs one, which is why every DNA base pair is one wide
  // base plus one narrow one and the ladder keeps a constant width. Nothing else
  // in this file can see a missing ring: drop purine's imidazole and what remains
  // is a perfectly valid, perfectly rendered, wrong molecule.
  if (mol.topology) {
    const rings = findRings(mol.atoms.length, bonds);
    const sizes = rings.map(r => r.length).sort();
    const want = (mol.topology.rings || []).slice().sort();
    if (sizes.length !== want.length || sizes.some((s, k) => s !== want[k])) {
      stereoFails++;
      console.log(`   TOPOLOGY FAIL: spec declares rings [${want.join(', ')}] `
        + `but geometry has [${sizes.join(', ')}]`);
    } else if (mol.topology.fused) {
      // "fused" is a real structural claim, not decoration: two rings sharing a
      // single atom (spiro) or none at all is a different molecule entirely.
      const shared = rings.length === 2
        ? rings[0].filter(i => rings[1].includes(i)).length : 0;
      if (shared < 2) {
        stereoFails++;
        console.log(`   TOPOLOGY FAIL: spec declares fused rings but they share `
          + `${shared} atom(s) — a fused bicycle shares an EDGE (2 atoms).`);
      } else {
        console.log(`   topology OK: rings [${sizes.join(', ')}], fused across ${shared} shared atoms`);
      }
    } else {
      console.log(`   topology OK: rings [${sizes.join(', ')}] as declared`);
    }
  }

  // ---- glycosidic linkage (α vs β) -------------------------------------
  // The one that decides whether a glucose polymer is food or firewood. Maltose
  // (starch's repeat) and cellobiose (cellulose's) are the same two glucoses,
  // joined at the same two carbons, through the same bridging oxygen, at the
  // same tetrahedral angle — the difference is only WHICH slot at the anomeric
  // carbon the bridge leaves from: axial (α) or equatorial (β). Every bond
  // length matches, every angle matches, and the two renders are near enough to
  // the same picture that no screenshot settles it.
  //
  // Three things are checked, because a wrong one of each is a different
  // molecule that would still look right: that the bridge really joins TWO
  // rings (not a second bond inside one), that it lands 1→4 (not 1→6, a
  // branch point, which is a real linkage but a different polymer), and the
  // α/β configuration itself.
  if (mol.glycosidic) {
    const { anomeric: i, bridge: o, partner: j, config } = mol.glycosidic;
    const link = mol.glycosidic.link || '1→4';
    const rings = findRings(mol.atoms.length, bonds);
    const ringOf = a => rings.find(r => r.includes(a));
    const linked = (a, b) => bonded.has(a < b ? `${a},${b}` : `${b},${a}`);
    const exoO = a => bonds.some(([p, q]) => {
      const k = p === a ? q : q === a ? p : null;
      return k !== null && mol.atoms[k].el === 'O' && !(ringOf(a) || []).includes(k);
    });
    const rA = ringOf(i), rB = ringOf(j);
    const fail = msg => { stereoFails++; console.log(`   GLYCOSIDIC FAIL: ${msg}`); };
    if (!linked(i, o) || !linked(o, j)) {
      fail(`${label(o)} is not bonded to both ${label(i)} and ${label(j)} — `
        + `the declared bridge is not a bridge.`);
    } else if (!rA || !rB) {
      fail(`${label(!rA ? i : j)} is not in a ring — a glycosidic link joins two sugar rings.`);
    } else if (rA.some(a => rB.includes(a))) {
      fail(`${label(i)} and ${label(j)} are in the SAME ring — that is a ring closure, `
        + `not a link between two residues.`);
    } else if (!rA.some(a => mol.atoms[a].el === 'O' && linked(a, i))) {
      fail(`${label(i)} is not adjacent to its own ring's oxygen, so it is not the `
        + `anomeric carbon. α/β is a claim about the anomeric position only.`);
    } else {
      // Position of the link on the ACCEPTOR ring, counted from that ring's own
      // anomeric carbon — the ring carbon that sits next to the ring oxygen and
      // carries a second, exocyclic oxygen. A pyranose ring alone cannot tell C2
      // from C4 (both are two steps from the ring O, in mirror-image positions);
      // it is the substituent pattern that breaks the tie.
      const oB = rB.find(a => mol.atoms[a].el === 'O');
      const c1B = rB.find(a => a !== oB && linked(a, oB) && exoO(a));
      const want = (() => { const m = /^(\d+)\D+(\d+)$/.exec(link); return m ? +m[2] - +m[1] : null; })();
      const step = (() => {
        if (c1B === undefined) return null;
        const d = Math.abs(rB.indexOf(j) - rB.indexOf(c1B));
        return Math.min(d, rB.length - d);
      })();
      if (step === null) {
        fail(`the ring holding ${label(j)} has no anomeric carbon (no ring carbon next `
          + `to the ring O carrying a second oxygen), so the link position is unverifiable.`);
      } else if (want !== null && step !== want) {
        fail(`spec declares a ${link} link but ${label(j)} is ${step} ring bond(s) from `
          + `${label(c1B)}, its own ring's anomeric carbon — that is a 1→${step + 1} link.`);
      } else {
        // The configuration itself, measured the same way the ring-stereo check
        // below measures every other substituent, so α/β and axial/equatorial
        // cannot disagree about the same bond.
        const n = ringNormal(rA, P);
        const tilt = 90 - Math.acos(Math.abs(dot3(unit(sub(P(o), P(i))), n))) * 180 / Math.PI;
        const actual = tilt <= EQ_MAX_TILT ? 'beta' : 'alpha';
        if (actual !== config) {
          fail(`spec declares ${config}-${link} but ${label(i)}->${label(o)} is `
            + `${actual === 'beta' ? 'equatorial (β)' : 'axial (α)'} `
            + `— tilt ${tilt.toFixed(0)}° from the ring plane.`);
          console.log(`     α and β share every bond length, every bond angle and very`);
          console.log(`     nearly the same render — and one is bread, the other is wood.`);
        } else {
          console.log(`   glycosidic OK: ${config}-${link} as declared `
            + `(${label(i)}->${label(o)} tilt ${tilt.toFixed(0)}°, `
            + `${label(j)} is ${step} ring bond(s) from ${label(c1B)})`);
        }
      }
    }
  }

  // ---- ring stereochemistry -------------------------------------------
  // Wrong configuration is invisible to every check above: lengths, angles and
  // the render all stay perfect while the molecule is a different sugar. So
  // measure each substituent against the ring axis. Hydrogens are skipped —
  // the heavy groups carry the identity, and the glycolysis specs omit C–H.
  for (const ring of findRings(mol.atoms.length, bonds)) {
    const inRing = new Set(ring);
    const n = ringNormal(ring, P);
    const found = [];
    for (const i of ring) {
      for (const [a, b] of bonds) {
        const j = a === i ? b : b === i ? a : null;
        if (j === null || inRing.has(j) || mol.atoms[j].el === 'H') continue;
        const tilt = 90 - Math.acos(Math.abs(dot3(unit(sub(P(j), P(i))), n))) * 180 / Math.PI;
        found.push({ i, j, tilt, eq: tilt <= EQ_MAX_TILT });
      }
    }
    if (!found.length) continue;
    const ringName = ring.length === 6 ? 'pyranose' : 'furanose';
    console.log(`   ring (${ringName}, ${ring.map(label).join('-')}):`);
    found.forEach(s => console.log(`     ${label(s.i)}->${label(s.j)}`
      + ` tilt ${s.tilt.toFixed(0)}° from ring plane — ${s.eq ? 'equatorial' : 'AXIAL'}`));

    if (mol.stereo === 'all-equatorial') {
      const axial = found.filter(s => !s.eq);
      if (axial.length) {
        stereoFails++;
        console.log(`   STEREO FAIL: spec declares all-equatorial but `
          + `${axial.map(s => label(s.i)).join(', ')} ${axial.length === 1 ? 'is' : 'are'} axial.`);
        console.log(`     An all-equatorial pyranose is what makes glucose the most`);
        console.log(`     stable hexose — alternating ax/eq is a different sugar.`);
      } else {
        console.log(`   stereo OK: all-equatorial as declared`);
      }
    } else if (mol.stereo && mol.stereo.axial) {
      // `{ axial:[...] }` — the general form. Exactly these ring atoms carry an
      // axial heavy substituent; every other one must be equatorial. Galactose is
      // `{axial:[C4]}` and glucose is all-equatorial, and that single flip is the
      // entire difference between them — so it is checked in BOTH directions:
      // a missing flip and a spurious extra flip are both failures.
      const want = new Set(mol.stereo.axial);
      const wrong = found.filter(s => want.has(s.i) === s.eq);
      if (wrong.length) {
        stereoFails++;
        console.log(`   STEREO FAIL: spec declares axial at [${mol.stereo.axial.map(label).join(', ')}] but`);
        wrong.forEach(s => console.log(`     ${label(s.i)}->${label(s.j)} is `
          + `${s.eq ? 'equatorial' : 'AXIAL'} (tilt ${s.tilt.toFixed(0)}°) — expected `
          + `${want.has(s.i) ? 'axial' : 'equatorial'}`));
      } else {
        console.log(`   stereo OK: axial exactly at [${mol.stereo.axial.map(label).join(', ')}]`);
      }
    } else if (mol.stereo && mol.stereo.faces) {
      // `{ faces:{ ringAtom: label } }` — for furanoses, where the ring is too
      // flat for axial/equatorial to carry meaning (ribose's substituents all
      // measure 49–62°, i.e. neither). What matters is which side of the ring
      // each one is on. The ring normal's SIGN is arbitrary — it falls out of the
      // traversal order findRings happens to produce — so this asserts only the
      // RELATIVE pattern: same label ⇒ same face, different label ⇒ opposite.
      // That is enough to separate ribose from arabinose, xylose and lyxose.
      // What it CANNOT catch is a global mirror — flip every substituent at once
      // and the relative pattern is unchanged, so L-ribose would pass as D-. That
      // needs a signed-volume test like the `chirality` check above. It is not
      // written yet because no page makes a D/L claim about a sugar; the moment
      // one does, that claim needs its own assertion here rather than this one.
      const decl = mol.stereo.faces;
      const seen = found.filter(s => decl[s.i] !== undefined);
      const missing = Object.keys(decl).filter(k => !seen.some(s => s.i === +k));
      if (missing.length) {
        stereoFails++;
        console.log(`   STEREO FAIL: faces declared for ${missing.map(k => label(+k)).join(', ')}`
          + ` but no heavy substituent is bonded there.`);
        console.log(`     A face declared on an atom that carries nothing passes vacuously —`);
        console.log(`     which is exactly how deoxyribose could be mistaken for ribose.`);
      } else {
        const side = s => Math.sign(dot3(unit(sub(P(s.j), P(s.i))), n));
        // anchor on the first substituent's label, then require consistency
        const anchor = decl[seen[0].i], anchorSide = side(seen[0]);
        const bad = seen.filter(s => (decl[s.i] === anchor) !== (side(s) === anchorSide));
        seen.forEach(s => console.log(`     ${label(s.i)}->${label(s.j)} face `
          + `${side(s) === anchorSide ? anchor : `not-${anchor}`} (declared ${decl[s.i]})`));
        if (bad.length) {
          stereoFails++;
          console.log(`   STEREO FAIL: ${bad.map(s => label(s.i)).join(', ')} `
            + `${bad.length === 1 ? 'sits' : 'sit'} on the wrong face of the ring.`);
          console.log(`     Flipping one –OH to the other face gives a different sugar`);
          console.log(`     with identical lengths, identical angles and an identical render.`);
        } else {
          console.log(`   stereo OK: face pattern as declared `
            + `(${seen.map(s => `${label(s.i)}:${decl[s.i]}`).join(' ')})`);
        }
      }
    } else if (mol.stereo) {
      stereoFails++;
      console.log(`   STEREO FAIL: unknown stereo declaration `
        + `'${JSON.stringify(mol.stereo)}' — expected 'all-equatorial', `
        + `{axial:[…]} or {faces:{…}}`);
    } else {
      console.log(`   (no \`stereo\` declared — pattern above is informational)`);
    }
  }
}

console.log('');
if (failures || stereoFails || chiralFails || nameFails || smilesFails || srcFails) {
  const parts = [];
  if (srcFails) parts.push(`${srcFails} spec(s) with missing or malformed \`src:\` provenance`);
  if (nameFails) parts.push(`${nameFails} broken atom-name reference(s)`);
  if (smilesFails) parts.push(`${smilesFails} stale generated SMILES`);
  if (failures) parts.push(`${failures} overlapping pair(s)`);
  if (stereoFails) parts.push(`${stereoFails} ring(s) failing a declared `
    + `stereo/topology claim`);
  if (chiralFails) parts.push(`${chiralFails} mirrored stereocentre(s) (L/D)`);
  console.log(`FAIL: ${parts.join(' + ')}`);
  process.exit(1);
}
console.log(`PASS: every spec records its provenance; no sphere overlaps; every `
  + `atom reference resolves; every declared stereo/topology/chirality claim holds`
  + (warnings ? ` (${warnings} tight bond(s) — check they still read clearly)` : ''));
