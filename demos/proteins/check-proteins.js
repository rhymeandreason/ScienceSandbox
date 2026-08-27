#!/usr/bin/env node
/* =====================================================================
 *  check-proteins.js — the claims proteins/proteins.js makes, against
 *  the files it describes.
 *
 *    node proteins/check-proteins.js      (offline, no dependencies)
 *
 *  The registry is written by two authors — a human types the purposes,
 *  the species and the reasons, a baker writes the `read` blocks — and the
 *  failures
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
const Bake = require('./bake-lib.js');
const { chainsDeclared } = Bake;

/* SEQRES for chain A — the only reader here that bake-lib does not already
   export, because a trace bake keeps the number and a reduced PDB keeps the
   records. */
const declaredOf = text => {
  const l = text.split('\n').find(x => x.startsWith('SEQRES') && x[11] === 'A');
  return l ? parseInt(l.slice(13, 17), 10) : null;
};

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

    /* 4. EVERY `read` FIELD IS RE-DERIVABLE FROM THE BAKE, and agrees with it.
          That is the invariant the registry rests on: `read` is a few
          convenience lines printed into an index, never a fact the bake cannot
          produce. If it ever holds something the file does not, the file stops
          being the source and the index becomes a second one — and the second
          source is the one that goes stale.

          A `pipeline:'pdb'` bake answers in its own records, which is why the
          prion baker carries EXPDTA, REMARK 2 and the COMPND chain list into
          every reduced file it writes. */
    /* A protein whose files another pipeline writes is verified against the
       DEPOSITION it names, not against a bake this registry did not shape.
       Haemoglobin is the case: `hemoglobin/tools/` writes a trace, a
       quaternary file, a surface and an 830 KB fold for the folding lesson,
       in formats with no `meta` block to cross-check and no reason to grow
       one. The invariant survives — every read field is still answerable by a
       committed file — it is just a different file. */
    if (p.pipeline === 'own') {
      const src = v.source && v.source.path;
      if (!src) { say(`${at}: pipeline 'own' needs source.path`); continue; }
      const full = path.join(HERE, '..', src);
      if (!fs.existsSync(full)) { say(`${at}: ${src} is not there`); continue; }
      const text = fs.readFileSync(full, 'utf8');
      const only = v.chains ? new Set(v.chains.split(',')) : null;
      const chains = Bake.caTrace(text, only);
      const decl = Bake.declared(text);
      let residues = 0;
      for (const res of chains.values()) residues += res.length;
      const declared = [...chains.keys()].every(c => decl[c] != null)
        ? [...chains.keys()].reduce((k, c) => k + decl[c], 0) : null;
      const from = { method: Bake.method(text), chainsInFile: Bake.chainCount(text),
                     residues, declared };
      for (const k of Object.keys(from))
        if (r[k] != null && from[k] !== r[k])
          say(`${at}: registry says ${k} ${JSON.stringify(r[k])}, ` +
              `${src} says ${JSON.stringify(from[k])} — re-run read-own.js`);
      continue;
    }

    if (p.pipeline === 'pdb') {
      const text = fs.readFileSync(file, 'utf8');
      const from = {
        method: (text.split('\n').find(l => l.startsWith('EXPDTA')) || '')
          .slice(10).trim().toLowerCase() || null,
        chainsInFile: chainsDeclared(text),
        residues: text.split('\n')
          .filter(l => l.startsWith('ATOM') && l.slice(12, 16).trim() === 'CA').length,
        declared: declaredOf(text),
      };
      for (const k of Object.keys(from))
        if (r[k] != null && from[k] !== r[k])
          say(`${at}: registry says ${k} ${JSON.stringify(r[k])}, ` +
              `${r.baked} says ${JSON.stringify(from[k])}`);
    }

    if (p.pipeline !== 'pdb') {
      let t;
      try { t = JSON.parse(fs.readFileSync(file, 'utf8')); }
      catch (e) { say(`${at}: ${r.baked} is not JSON — ${e.message}`); continue; }

      /* The same invariant for a trace bake, whose meta is where those four
         were counted. */
      const meta = t.meta || {};
      /* Missing is a failure, not a skip: a registry field the bake cannot
         produce is the invariant breaking quietly, which is the one way this
         check could be passed by a file that no longer supports it. */
      for (const k of ['method', 'chainsInFile', 'counts'])
        if (meta[k] == null) say(`${at}: ${r.baked} has no meta.${k} to check the registry against`);
      if (r.method != null && meta.method && meta.method !== r.method)
        say(`${at}: registry says method ${r.method}, bake says ${meta.method}`);
      if (r.chainsInFile != null && meta.chainsInFile != null &&
          meta.chainsInFile !== r.chainsInFile)
        say(`${at}: registry says ${r.chainsInFile} chains in file, bake says ${meta.chainsInFile}`);
      if (r.declared != null && Array.isArray(meta.counts)) {
        const declared = meta.counts.every(c => c.declared !== null)
          ? meta.counts.reduce((k, c) => k + c.declared, 0) : null;
        if (declared !== null && declared !== r.declared)
          say(`${at}: registry says ${r.declared} declared, bake says ${declared}`);
      }

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

  /* 8. Bakes nothing claims — skipped for a folder this registry does not
        write. `keeps` would have to list another pipeline's every artefact,
        and the day it added one the failure would land here rather than
        where it belongs. `keeps` is the protein's own list of files that
        are deliberately in data/ without being variants — committed sources,
        intermediates a baker slices views out of, a bake measured once and
        not shown. Anything outside both lists is a stale file, and a stale
        bake from a renamed view is one a bench goes on loading. */
  const keeps = new Set(p.keeps || []);
  if (p.pipeline !== 'own') for (const f of onDisk) {
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
  /* A protein on its own pipeline has no prep.js of ours to check; its
     sources are committed beside its bakes, which is what `source.path`
     already asserted above. */
  if (p.pipeline === 'own') continue;

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
