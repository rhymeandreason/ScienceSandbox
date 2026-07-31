#!/usr/bin/env node
/* =====================================================================
 *  check-handedness.js — an AUDIT, not a guard.
 *
 *  Compares each spec's committed `smiles` against a named reference record
 *  from PubChem. This is the only check here that can catch a GLOBAL MIRROR,
 *  and it is the only one that reaches outside for an absolute answer.
 *
 *    npm i && node tools/check-handedness.js
 *
 *  Why nothing else can do it. `stereo:{axial}` and `stereo:{faces}` assert
 *  RELATIVE patterns — the ring normal's sign falls out of traversal order, so
 *  flipping every substituent at once leaves the pattern unchanged. cod-check.js
 *  compares ring-plane tilt and torsions, also relative. haworth.js re-anchors
 *  the normal to the D convention, so it draws a correct D-sugar even from
 *  mirrored coordinates. Bond lengths, angles and the render are all identical
 *  between enantiomers. A mirror is invisible from the inside, by construction.
 *
 *  It found one: every Skel-built sugar in this library was the L-enantiomer.
 *  L-glucose, L-galactose, L-ribose, L-deoxyribose and both disaccharides,
 *  shipped and rendering beautifully. See molecule-pipeline.md item 5.
 *
 *  DELIBERATELY NOT WIRED INTO check-molecules.js. It needs the network and a
 *  dev-only dependency, and a network call inside a guard is a liability — the
 *  same reasoning as cod-check.js. Run it when you touch a builder, add a
 *  stereocentre, or doubt a spec. The answer cannot go stale on its own.
 *
 *  THE CONTROL MATTERS. The specs that came from PubChem must match, or the
 *  spec -> molblock -> RDKit path is what is broken, not the geometry. That is
 *  what separates "our sugar is mirrored" from "our exporter is mirrored", and
 *  it is why dAlanine is in the list: it must come back D.
 *
 *  Reference names are anomer- and stereo-specific ON PURPOSE. A bare "glucose"
 *  is CID 5793, which leaves the anomeric centre undefined and would prove
 *  nothing.
 * ===================================================================== */
'use strict';

const path = require('path');
const cp = require('child_process');
const { MOLECULES } = require(path.join(__dirname, '..', 'lib-node.js'));

// spec key -> the PubChem name that pins the exact stereoisomer we claim to be.
const REF = {
  // control: these ARE PubChem conversions, so a mismatch indicts the pipeline
  glycine: 'glycine',
  alanine: 'L-alanine',
  dAlanine: 'D-alanine',
  proline: 'L-proline',
  glutamine: 'L-glutamine',
  glutamate: 'L-glutamic acid',
  // the Skel-built sugars — what this tool exists for
  glucose: 'beta-D-glucopyranose',
  galactose: 'beta-D-galactopyranose',
  ribose: 'beta-D-ribofuranose',
  deoxyribose: '2-deoxy-beta-D-erythro-pentofuranose',
  maltose: 'beta-maltose',
  cellobiose: 'beta-cellobiose',
};

const fetchSmiles = name => {
  const url = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/'
    + encodeURIComponent(name) + '/property/IsomericSMILES/TXT';
  try {
    const out = cp.execSync(`curl -s --max-time 30 "${url}"`, { encoding: 'utf8' }).trim();
    const first = out.split('\n')[0];
    return (!first || /Status:|PUGREST/.test(out)) ? null : first;
  } catch (e) { return null; }
};

const SENT = String.fromCharCode(1);
// Swap every @ <-> @@ : the enantiomer, written out. Used only to distinguish
// "mirrored" from "some other stereoisomer", which are very different bugs.
const mirrorOf = s => s.split('@@').join(SENT).split('@').join('@@').split(SENT).join('@');

require('@rdkit/rdkit')().then(RDKit => {
  const canon = s => {
    const m = RDKit.get_mol(s);
    if (!m) return null;
    const out = m.get_smiles(); m.delete(); return out;
  };

  let bad = 0, skipped = 0;
  for (const [key, name] of Object.entries(REF)) {
    const spec = MOLECULES[key];
    if (!spec || !spec.smiles) { console.log(`  skip  ${key.padEnd(12)} no committed smiles`); skipped++; continue; }
    // The :1 atom map is highlight metadata for SmilesDrawer, not structure.
    const ours = canon(spec.smiles.replace(/:1(?=])/g, ''));
    if (!ours) { console.log(`  FAIL  ${key.padEnd(12)} committed smiles does not parse`); bad++; continue; }

    const raw = fetchSmiles(name);
    if (!raw) { console.log(`  skip  ${key.padEnd(12)} no PubChem record for "${name}"`); skipped++; continue; }
    const ref = canon(raw);
    if (!ref) { console.log(`  skip  ${key.padEnd(12)} reference did not parse`); skipped++; continue; }

    if (ours === ref) { console.log(`  ok    ${key.padEnd(12)} matches ${name}`); continue; }

    bad++;
    const mirrored = ours === canon(mirrorOf(raw));
    console.log(`  FAIL  ${key.padEnd(12)} ${mirrored ? 'is the EXACT MIRROR of' : 'differs from'} ${name}`);
    console.log(`          ours: ${ours}`);
    console.log(`          ref : ${ref}`);
    if (mirrored) {
      console.log('          A mirror preserves every bond length, every angle and the render.');
      console.log('          For a pyranose the handedness is the pucker phase in');
      console.log('          skel.js ringPyranose(); for a furanose it is the UP/DOWN face');
      console.log('          tags in mol-contrast.js, because face() is normal-sign-dependent.');
    }
  }

  console.log('');
  if (bad) { console.log(`FAIL: ${bad} spec(s) disagree with their reference`); process.exit(1); }
  console.log(`PASS: every checked spec matches its reference`
    + (skipped ? ` (${skipped} skipped)` : ''));
}).catch(e => {
  console.log('ERR', e.message);
  console.log('RDKit is a dev dependency — run `npm i` in demos/ first.');
  process.exit(1);
});
