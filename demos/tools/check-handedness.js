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
  // the glycolysis pathway. Nothing here is drawn from a `smiles` — these have
  // none, so the string is DERIVED FROM THE GEOMETRY below, which is the point:
  // what gets checked is the coordinates the page renders. Names pin the open
  // (keto) form where the spec is drawn open, because PubChem's default record
  // for a hexose phosphate is the furanose ring and that would report "differs"
  // for a molecule whose handedness is fine.
  // the two carriers molecule-viewer.html teaches ABOUT. Both are PubChem
  // conversions, so like the amino acids above they indict the pipeline rather
  // than a hand-built ring — but both carry a `smiles` now (the flat drawing
  // needs one), and a committed depiction string with four stereocentres in it
  // is exactly the thing that must not be allowed to be the mirror image.
  atp: 'ATP',
  nadh: 'NADH',
  g6p: 'beta-D-glucose 6-phosphate',
  f6p: 'keto-D-fructose 6-phosphate',
  f16bp: 'keto-D-fructose 1,6-bisphosphate',
  g3p: 'D-glyceraldehyde 3-phosphate',
  bpg13: '1,3-bisphospho-D-glyceric acid',
  pga3: '3-phospho-D-glyceric acid',
  pga2: '2-phospho-D-glyceric acid',
};

// A spec with no committed `smiles` is described by its own coordinates: heavy
// atoms into a V2000 molblock with the chiral flag set, and RDKit reads the
// configuration off the 3D positions. Same path tools/spec2smiles.js uses.
const pad = (v, w) => String(v).padStart(w);
function molblock(key, m) {
  const keep = m.atoms.map((a, i) => i).filter(i => m.atoms[i].el !== 'H');
  const map = new Map(keep.map((i, n) => [i, n]));
  const bonds = (m.bonds || []).filter(b => map.has(b[0]) && map.has(b[1]))
    .map(b => [map.get(b[0]), map.get(b[1]), b[2] || 1]);
  let s = `${key}\n  ScienceSandbox\n\n`
    + `${pad(keep.length, 3)}${pad(bonds.length, 3)}  0  0  1  0  0  0  0  0999 V2000\n`;
  keep.forEach(i => { const a = m.atoms[i];
    s += `${pad(a.pos[0].toFixed(4), 10)}${pad(a.pos[1].toFixed(4), 10)}`
       + `${pad(a.pos[2].toFixed(4), 10)} ${a.el.padEnd(3)} 0  0  0  0  0  0  0  0  0  0  0  0\n`; });
  for (const b of bonds) s += `${pad(b[0] + 1, 3)}${pad(b[1] + 1, 3)}${pad(b[2], 3)}  0\n`;
  return s + 'M  END\n';
}

// TWO DIFFERENCES THAT ARE NOT STEREOCHEMISTRY, normalised on both sides so a
// real mirror is what stands out:
//  · the house phosphate is four SINGLE P–O bonds (mol-glycolysis.js
//    simplification 2 — the charge is delocalised and doubling one would be a
//    lie), so RDKit completes P's valence with a hydride. Write it back as the
//    ordinary acid.
//  · PubChem answers some of these as the anion and some as the free acid.
//    Charge is not handedness.
const normalise = s => s
  .replace(/\[PH\]/g, 'P(=O)').replace(/P\(=O\)\(O\)\(O\)O/g, 'P(=O)(O)O')
  .replace(/\[O-\]/g, 'O');

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
    if (!spec) { console.log(`  skip  ${key.padEnd(12)} no such spec`); skipped++; continue; }
    // The :1 atom map is highlight metadata for SmilesDrawer, not structure.
    let mine = spec.smiles && spec.smiles.replace(/:1(?=])/g, '');
    if (!mine) {                          // no committed string: read the geometry
      const m = RDKit.get_mol(molblock(key, spec));
      if (!m) { console.log(`  FAIL  ${key.padEnd(12)} geometry does not parse`); bad++; continue; }
      mine = m.get_smiles(); m.delete();
    }
    const ours = canon(normalise(mine));
    if (!ours) { console.log(`  FAIL  ${key.padEnd(12)} committed smiles does not parse`); bad++; continue; }

    const raw = fetchSmiles(name);
    if (!raw) { console.log(`  skip  ${key.padEnd(12)} no PubChem record for "${name}"`); skipped++; continue; }
    const ref = canon(normalise(raw));
    if (!ref) { console.log(`  skip  ${key.padEnd(12)} reference did not parse`); skipped++; continue; }

    if (ours === ref) { console.log(`  ok    ${key.padEnd(12)} matches ${name}`); continue; }

    bad++;
    const mirrored = ours === canon(mirrorOf(normalise(raw)));
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
