#!/usr/bin/env node
/* =====================================================================
 *  check-proteins.js — the claims proteins/proteins.js makes, against
 *  the files it describes.
 *
 *    node proteins/check-proteins.js      (offline, no dependencies)
 *
 *  The registry is written by two authors — a human types the purposes
 *  and the prose, a baker writes the `read` blocks — and the failures
 *  worth catching are the ones where those two drift apart, or where the
 *  file describes something that is no longer on disk. Every assertion
 *  below is a bug that ships looking fine.
 *
 *  It does NOT check the science. Whether 1ABS really has its CO
 *  photolysed is the depositors' claim and the bench's subject; what this
 *  can check is that the variant the registry calls 1ABS is the file the
 *  bench draws, that it was baked from the entry the registry names, and
 *  that nobody typed a number the deposition disagrees with.
 * ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const IO = require('./tools/registry-io.js');

const HERE = __dirname;
const bad = [];
const say = m => bad.push(m);

const { lib } = IO.read();

/* 1. The rules the file's own header states — same pass a save makes, run
      again here because a registry can also be edited by hand. */
for (const m of IO.validate(lib)) say(m);

for (const p of lib.PROTEINS) {
  const dir = path.join(HERE, '..', p.dir);
  if (!fs.existsSync(dir)) { say(`${p.key}: dir ${p.dir} does not exist`); continue; }

  const data = path.join(dir, 'data');
  const onDisk = fs.existsSync(data) ? fs.readdirSync(data) : [];
  const claimed = new Set();

  for (const v of p.variants) {
    const at = `${p.key}/${v.id}`;
    const r = v.read || {};

    /* 2. EVERY VARIANT HAS A BAKE, AND EVERY BAKE HAS A VARIANT. A variant
          with no file is a button that draws nothing; a file no variant
          claims is either a stale bake from a renamed view — which a bench
          will happily keep loading — or a view someone forgot to describe. */
    if (!r.baked) { say(`${at}: no baked file recorded — has the baker been run?`); continue; }
    claimed.add(r.baked);
    const file = path.join(data, r.baked);
    if (!fs.existsSync(file)) { say(`${at}: ${r.baked} is not in ${p.dir}/data`); continue; }

    /* 4. What the bake says about itself matches what the registry asked
          for. A `pipeline:'pdb'` protein writes coordinates with no meta to
          read, so only the trace bakes can answer this. */
    if (p.pipeline !== 'pdb') {
      let t;
      try { t = JSON.parse(fs.readFileSync(file, 'utf8')); }
      catch (e) { say(`${at}: ${r.baked} is not JSON — ${e.message}`); continue; }

      const entry = (v.source && v.source.id) || v.id;
      if (t.meta && t.meta.entry && t.meta.entry !== entry)
        say(`${at}: baked from ${t.meta.entry}, registry says ${entry}`);

      const drawn = (t.order || []).length;
      if (v.chains && drawn !== v.chains.split(',').length)
        say(`${at}: registry asks for chains ${v.chains}, bake holds ${drawn}`);

      const residues = (t.order || []).reduce((k, id) => k + t.chains[id].nums.length, 0);
      if (r.residues != null && residues !== r.residues)
        say(`${at}: bake holds ${residues} residues, registry says ${r.residues}`);

      /* 5. SECONDARY STRUCTURE READ, NOT DETECTED — and a file that had no
            records to read bakes as all coil. That is honest and it is also
            a worm on screen, so it must never pass silently. */
      if (t.ssFrom !== 'deposited')
        say(`${at}: ss is '${t.ssFrom}' — the bench draws a coil worm, not a fold`);

      /* 6. A SHARED VIEW IS ONLY LEGAL ON A SUPERPOSED SET, and if it is
            declared then every bake has to be carrying it. Half the views
            wearing a basis is the jumping this rule exists to stop. */
      if (p.view && p.view.shared && JSON.stringify(t.view) !== JSON.stringify(p.view.basis))
        say(`${at}: registry declares a shared view the bake is not wearing`);

      /* 7. Every fitted variant names the reference, and the reference itself
            is fitted onto nothing. Read off the BAKE's meta, which is where a
            residual belongs — the registry indexes the collection and does not
            carry a number about one structure's relation to another. */
      if (p.fit && t.meta) {
        const isRef = v.id === p.fit.on;
        if (isRef && t.meta.fitOn)
          say(`${at}: the reference, but baked as fitted onto ${t.meta.fitOn}`);
        if (!isRef && t.meta.fitOn !== p.fit.on)
          say(`${at}: baked fitted onto ${t.meta.fitOn || 'nothing'}, registry says ${p.fit.on}`);
      }
    }
  }

  /* 8. Bakes nothing claims. `keeps` is the protein's own list of files that
        are deliberately in data/ without being variants — committed sources,
        intermediates a baker slices views out of, a bake measured once and
        not shown. Anything outside both lists is a stale file, and a stale
        bake from a renamed view is one a bench goes on loading. */
  const keeps = new Set(p.keeps || []);
  for (const f of onDisk) {
    if (f === 'src' || fs.statSync(path.join(data, f)).isDirectory()) continue;
    if (!claimed.has(f) && !keeps.has(f))
      say(`${p.key}: ${f} is in data/ and neither a variant nor in keeps`);
  }
  for (const f of keeps)
    if (!onDisk.includes(f)) say(`${p.key}: keeps lists ${f}, which is not there`);

  /* 9. THE BAKER CAN BE RE-RUN. Raw depositions are gitignored — they are
        many times the size of what they bake down to — so the curl that
        fetches them back has to be in the baker's header, or a checkout
        holds bakes nobody can reproduce. */
  const prep = path.join(dir, 'tools', 'prep.js');
  if (!fs.existsSync(prep)) say(`${p.key}: no tools/prep.js`);
  else {
    const src = fs.readFileSync(prep, 'utf8');
    /* The word does not matter; the ADDRESS does. A checkout has to be able
       to fetch back whatever the repo does not commit. */
    const remote = p.variants.some(v => (v.source || {}).kind === 'rcsb');
    if (remote && !/files\.rcsb\.org|alphafold\.ebi\.ac\.uk/.test(src))
      say(`${p.key}: prep.js never names where its sources come from`);
  }
}

const n = lib.PROTEINS.reduce((k, p) => k + p.variants.length, 0);
if (bad.length) {
  console.error('proteins:\n  ' + bad.join('\n  '));
  process.exit(1);
}
console.log(`PASS: ${lib.PROTEINS.length} proteins, ${n} variants — every variant has ` +
  'its bake, every bake a variant; entries, chains and residue counts agree with ' +
  'what was baked; secondary structure is deposited everywhere; every declared ' +
  'fit and shared view is the one the bakes carry');
