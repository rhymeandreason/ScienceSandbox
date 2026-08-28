#!/usr/bin/env node
/* =====================================================================
 *  bake-villin.js — derive villin's domains and its eight arrangements
 *  once, and commit the answer.
 *
 *  Two things happen here that must never happen in a browser:
 *
 *   1. THE DOMAIN SPLIT reads AlphaFold's PAE matrix — 826x826, 1.9 MB of
 *      JSON. Shipping that to a student so their laptop can rediscover a
 *      boundary list that cannot change would be absurd. The matrix stays
 *      here as a committed input (same principle as tools/sdf/ keeping the
 *      PubChem files that generated the specs); only its conclusion ships.
 *
 *   2. THE ARRANGEMENTS are rejection-sampled. Deterministic given the seed,
 *      but not free, and identical for every visitor.
 *
 *  Writes folding/data/AF-P02640-villin.poses.bin. Re-run after ANY change to
 *  villin.js's segmentation or pose generation; folding/tools/check-folding.js compares
 *  the committed file against a fresh bake and fails if they differ.
 *
 *  Inputs, both committed:
 *    folding/data/AF-P02640-villin.pdb              AlphaFold model, v6
 *    folding/data/AF-P02640-F1-pae_v6.json    its predicted aligned error
 *  both from https://alphafold.ebi.ac.uk/entry/P02640
 *
 *  Run:  node folding/tools/bake-villin.js        (offline, no dependencies)
 * ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const Villin = require('../villin.js');
const Ribbon = require('../../kit/ribbon.js');

const HERE = path.join(__dirname, '..');   // demos/folding
const MODEL = path.join(HERE, 'data', 'AF-P02640-villin.pdb');
const PAE = path.join(HERE, 'data/AF-P02640-F1-pae_v6.json');
const OUT = path.join(HERE, 'data', 'AF-P02640-villin.poses.bin');

for (const f of [MODEL, PAE])
  if (!fs.existsSync(f)) { console.error('missing ' + path.relative(HERE, f)); process.exit(1); }

const t0 = Date.now();
const modelText = fs.readFileSync(MODEL, 'utf8');
const parsed = Villin.parseCA(modelText);

/* SECONDARY STRUCTURE, HERE AND NOT IN THE BROWSER.

   The page draws villin as a ribbon, which needs to know where the helices
   and strands are. AlphaFold DB ships no HELIX or SHEET records — the model
   file has none — so the only honest source is to compute them, and the
   only honest way to compute them is the standard one: DSSP over the
   backbone hydrogen bonds. That needs N, CA, C and O, which the all-atom
   model has for all 826 residues and which villin.js's Ca-only parseCA
   throws away. So it happens once, here, against the full file, and one
   byte per residue rides along in the bin.

   The alternative was ribbon.js's detect(), a Ca-spacing heuristic, and it
   would have been a guess presented in exactly the same ink as 1VII's
   measured helices. This is the same algorithm Mol* runs when it cartoons a
   file with no records. */
const bb = Ribbon.parseBackbone(modelText);
const ssByNum = new Map();
Ribbon.dssp(bb).forEach((c, i) => ssByNum.set(bb.nums[i], c));
const ss = parsed.nums.map(nu => ssByNum.get(nu) || 'C');
if (bb.nums.length !== parsed.nums.length) {
  console.error(`backbone parse found ${bb.nums.length} residues but the Ca trace has ` +
                `${parsed.nums.length} — the two must describe the same chain`);
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(PAE, 'utf8'));
const entry = Array.isArray(raw) ? raw[0] : raw;
const pae = entry.predicted_aligned_error || entry.pae;
if (!pae) { console.error('no predicted_aligned_error in ' + path.relative(HERE, PAE)); process.exit(1); }

const domains = Villin.segment(pae);
const poses = Villin.poses(parsed, domains);

const buf = Buffer.from(Villin.encode({ nums: parsed.nums, plddt: parsed.plddt, domains, poses, ss }));
fs.writeFileSync(OUT, buf);

console.log(`villin: ${parsed.ca.length} residues, ${domains.length} rigid bodies from PAE`);
const pct = c => (100 * ss.filter(x => x === c).length / ss.length).toFixed(0);
console.log(`  DSSP on the model's own backbone: ${pct('H')}% helix, ${pct('E')}% strand, ${pct('C')}% coil`);
domains.forEach(([s, e], i) => {
  const isHP = s <= Villin.HP35.start && e >= Villin.HP35.end;
  console.log(`  domain ${i + 1}  ${String(s).padStart(3)}-${String(e).padStart(3)}  ` +
              `${String(e - s + 1).padStart(3)} aa${isHP ? '   <- contains HP35, the chain folding-lab folds' : ''}`);
});
console.log(`\n${poses.length} arrangements (1 = the model's own layout, 2-${poses.length} generated):`);
poses.forEach((p, k) => console.log(`  ${k + 1}  longest Ca-Ca ${Villin.extent(p).toFixed(0)} A`));
console.log(`\nbaked in ${Date.now() - t0} ms`);
console.log(`  wrote ${path.relative(HERE, OUT)} (${(buf.length / 1024).toFixed(0)} KB)`);
