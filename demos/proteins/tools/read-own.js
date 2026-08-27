#!/usr/bin/env node
/* =====================================================================
 *  read-own.js — the `read` blocks for a protein whose files another
 *  pipeline writes.
 *
 *    node proteins/tools/read-own.js        (offline, no dependencies)
 *
 *  Every protein in the registry has a baker that writes its own `read`
 *  block, except the ones marked `pipeline:'own'` — haemoglobin today,
 *  whose bakes are made by `hemoglobin/tools/` for the folding
 *  trajectory, on their own schedule and in their own formats. Nothing
 *  in this repo should reach into that pipeline and nothing here does.
 *
 *  So the numbers come from the DEPOSITION each variant already names in
 *  `source.path`, which is committed beside those bakes. That keeps the
 *  rule the registry rests on — a human never types a number into it —
 *  without this file having any opinion about how the bakes were made.
 *
 *  It is a separate script rather than a branch inside a baker because
 *  it is a different job: a baker cuts a deposition down and describes
 *  what it wrote, and this describes a file somebody else wrote.
 * ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const Bake = require('../bake-lib.js');
const IO = require('./registry-io.js');

const ROOT = path.join(__dirname, '..', '..');

function main() {
  const { lib } = IO.read();
  let touched = 0;

  for (const p of lib.PROTEINS) {
    if (p.pipeline !== 'own') continue;
    const blocks = {};

    for (const v of p.variants) {
      const src = v.source && v.source.path;
      if (!src) throw new Error(`${p.key}/${v.id}: pipeline 'own' needs source.path`);
      const text = fs.readFileSync(path.join(ROOT, src), 'utf8');

      /* Restricted to the chains the variant names, because 2HBS holds two
         tetramers and the bake this entry points at is one of them. Counting
         the whole file would describe a structure nothing draws. */
      const only = v.chains ? new Set(v.chains.split(',')) : null;
      const chains = Bake.caTrace(text, only);
      const decl = Bake.declared(text);

      let residues = 0;
      for (const res of chains.values()) residues += res.length;
      const declared = [...chains.keys()].every(c => decl[c] != null)
        ? [...chains.keys()].reduce((k, c) => k + decl[c], 0) : null;

      /* `bake` is the said half — which of that folder's several files this
         entry means — and it is copied here so every consumer reads one key. */
      const baked = v.bake;
      if (!baked) throw new Error(`${p.key}/${v.id}: pipeline 'own' needs bake:`);
      if (!fs.existsSync(path.join(ROOT, p.dir, 'data', baked)))
        throw new Error(`${p.key}/${v.id}: ${baked} is not in ${p.dir}/data`);

      blocks[v.id] = {
        method: Bake.method(text),
        chainsInFile: Bake.chainCount(text),
        residues, declared, baked,
      };
      console.log(`${p.key}/${v.id.padEnd(6)} ${blocks[v.id].method}, ` +
        `${residues} of ${declared} residues, ` +
        `${blocks[v.id].chainsInFile} chains in the entry, ${baked}`);
    }
    touched += IO.write(p.key, blocks).length;
  }
  console.log(touched
    ? `registry  proteins.js  ${touched} variants updated`
    : 'no protein is marked pipeline:\'own\'');
}

if (require.main === module) main();
module.exports = { main };
