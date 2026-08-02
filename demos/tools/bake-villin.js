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
 *  Writes pdb/AF-P02640-villin.poses.bin. Re-run after ANY change to
 *  villin.js's segmentation or pose generation; tools/check-pdb.js compares
 *  the committed file against a fresh bake and fails if they differ.
 *
 *  Inputs, both committed:
 *    pdb/AF-P02640-villin.pdb              AlphaFold model, v6
 *    tools/pae/AF-P02640-F1-pae_v6.json    its predicted aligned error
 *  both from https://alphafold.ebi.ac.uk/entry/P02640
 *
 *  Run:  node tools/bake-villin.js        (offline, no dependencies)
 * ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const Villin = require('../villin.js');

const ROOT = path.join(__dirname, '..');
const MODEL = path.join(ROOT, 'pdb', 'AF-P02640-villin.pdb');
const PAE = path.join(ROOT, 'tools/pae/AF-P02640-F1-pae_v6.json');
const OUT = path.join(ROOT, 'pdb', 'AF-P02640-villin.poses.bin');

for (const f of [MODEL, PAE])
  if (!fs.existsSync(f)) { console.error('missing ' + path.relative(ROOT, f)); process.exit(1); }

const t0 = Date.now();
const parsed = Villin.parseCA(fs.readFileSync(MODEL, 'utf8'));

const raw = JSON.parse(fs.readFileSync(PAE, 'utf8'));
const entry = Array.isArray(raw) ? raw[0] : raw;
const pae = entry.predicted_aligned_error || entry.pae;
if (!pae) { console.error('no predicted_aligned_error in ' + path.relative(ROOT, PAE)); process.exit(1); }

const domains = Villin.segment(pae);
const poses = Villin.poses(parsed, domains);

const buf = Buffer.from(Villin.encode({ nums: parsed.nums, plddt: parsed.plddt, domains, poses }));
fs.writeFileSync(OUT, buf);

console.log(`villin: ${parsed.ca.length} residues, ${domains.length} rigid bodies from PAE`);
domains.forEach(([s, e], i) => {
  const isHP = s <= Villin.HP35.start && e >= Villin.HP35.end;
  console.log(`  domain ${i + 1}  ${String(s).padStart(3)}-${String(e).padStart(3)}  ` +
              `${String(e - s + 1).padStart(3)} aa${isHP ? '   <- contains HP35, the chain folding-lab folds' : ''}`);
});
console.log(`\n${poses.length} arrangements (1 = the model's own layout, 2-${poses.length} generated):`);
poses.forEach((p, k) => console.log(`  ${k + 1}  longest Ca-Ca ${Villin.extent(p).toFixed(0)} A`));
console.log(`\nbaked in ${Date.now() - t0} ms`);
console.log(`  wrote ${path.relative(ROOT, OUT)} (${(buf.length / 1024).toFixed(0)} KB)`);
