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
 *  It also audits the DISTINGUISHING-FEATURE CLAIMS a spec declares — the
 *  error class nothing above can see, because a wrong stereocentre has perfect
 *  bond lengths, textbook angles, and renders beautifully. It is only caught
 *  when a spec DECLARES what it should be, so the declaration is not optional
 *  decoration; SCIENCE.md §1.3 has the two incidents that established this.
 *
 *  Six declarations, each FAILing if the geometry disagrees (SCIENCE.md §1.4
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

// molecules.js is a browser script ending in `})(this)`; under CommonJS
// `this` is module.exports, so MolLib lands there.
const { PALETTE, MOLECULES } = require('./molecules.js').MolLib;

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
// drawn flat (SCIENCE.md §1.6 schematic style) rather than as a real 3D
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

let failures = 0, warnings = 0, stereoFails = 0, chiralFails = 0;

for (const [key, mol] of Object.entries(MOLECULES)) {
  if (!mol.atoms) continue;            // ionic entries carry no geometry
  const R = i => PALETTE.radii[mol.atoms[i].el] || 0.7;
  const P = i => mol.atoms[i].pos;
  const label = i => mol.atoms[i].el + i;
  const bonds = mol.bonds || [];
  const bonded = new Set(bonds.map(([i, j]) => (i < j ? `${i},${j}` : `${j},${i}`)));

  console.log(`\n== ${key} (${mol.formula})`);

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
if (failures || stereoFails || chiralFails) {
  const parts = [];
  if (failures) parts.push(`${failures} overlapping pair(s)`);
  if (stereoFails) parts.push(`${stereoFails} ring(s) failing a declared `
    + `stereo/topology claim`);
  if (chiralFails) parts.push(`${chiralFails} mirrored stereocentre(s) (L/D)`);
  console.log(`FAIL: ${parts.join(' + ')}`);
  process.exit(1);
}
console.log(`PASS: no sphere overlaps; every declared stereo/topology/chirality `
  + `claim holds`
  + (warnings ? ` (${warnings} tight bond(s) — check they still read clearly)` : ''));
