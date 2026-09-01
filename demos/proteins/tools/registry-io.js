#!/usr/bin/env node
/* =====================================================================
 *  registry-io.js — read proteins/proteins.js, and write back the halves
 *  a baker owns.
 *
 *  The one place that knows the file's shape, and the same shape
 *  tools/mapcontent-io.js has for the door map: RUN the file rather than
 *  parse it, validate what its header promises, and splice back only the
 *  blocks the writer owns.
 *
 *  WHAT A SAVE MAY TOUCH IS EXACTLY ONE THING: the `read: { … }` object
 *  inside a variant. Everything else — the purposes, the species, the
 *  comments that say why a structure was chosen and which one it was
 *  chosen instead of — is a human's and is carried across untouched. A
 *  writer that re-emitted the whole file would lose the comments on the
 *  first re-bake, which is the failure this shape exists to prevent: the
 *  reasons are the part that cannot be recovered from the data.
 *
 *  ONE PROTEIN AT A TIME. `write('myoglobin', {…})` rewrites that
 *  protein's variants and leaves the other two exactly as they are on
 *  disk, because bakers run separately and one must never write back a
 *  stale copy of another's numbers.
 *
 *  Run with no arguments for a validation pass:  node registry-io.js
 * ===================================================================== */
'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const FILE = path.resolve(__dirname, '..', 'proteins.js');

/* ---- reading --------------------------------------------------------- */

/* Run, not parse: the same thing the browser does with it, and the only
   way `basis` comes back as numbers rather than as text to re-parse. */
function parse(src) {
  const sandbox = {};
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: 'proteins.js' });
  const lib = sandbox.ProteinLib;
  if (!lib || !Array.isArray(lib.PROTEINS))
    throw new Error('proteins.js ran but exposed no ProteinLib.PROTEINS');
  return lib;
}

function read() {
  const src = fs.readFileSync(FILE, 'utf8');
  return { src, lib: parse(src) };
}

/* ---- validation ------------------------------------------------------
 *
 *  Everything here is a rule the file's own header states. They are
 *  checked on every save as well as by check-proteins.js, because a
 *  half-valid registry written by a baker is worse than a refused write:
 *  the bake succeeded, so nobody looks. */
function validate(lib) {
  const bad = [];
  const keys = new Set();

  for (const p of lib.PROTEINS) {
    const at = p.key || '(no key)';
    if (!p.key || !p.name || !p.dir) bad.push(`${at}: needs key, name and dir`);
    if (keys.has(p.key)) bad.push(`${at}: duplicate key`);
    keys.add(p.key);
    /* One word from the vocabulary, and every protein has one — `unknown` is
       an answer, so a missing `does` is a question nobody asked rather than a
       function nobody knows. */
    if (!p.does) bad.push(`${at}: no does — say what it is for, or 'unknown'`);
    else if (!lib.DOES.includes(p.does))
      bad.push(`${at}: does '${p.does}' is not one of ${lib.DOES.join(', ')}`);

    if (!Array.isArray(p.variants) || !p.variants.length)
      { bad.push(`${at}: no variants`); continue; }

    const ids = new Set();
    let defaults = 0;
    for (const v of p.variants) {
      const vat = `${at}/${v.id || '(no id)'}`;
      if (!v.id) bad.push(`${vat}: needs an id`);
      if (ids.has(v.id)) bad.push(`${vat}: duplicate id`);
      ids.add(v.id);
      if (!v.purpose) bad.push(`${vat}: needs a purpose — what is this variant FOR`);
      if (v.default) defaults++;
      if (!v.read || typeof v.read !== 'object')
        bad.push(`${vat}: needs a read block, even an empty one`);

      /* A cut of another variant (prion's stack, an NMR ensemble) names the
         entry it came out of, and that entry has to be in the list — or the
         bench offers a view of something the registry never described. */
      if (v.of && !p.variants.some(o => o.id === v.of))
        bad.push(`${vat}: of:'${v.of}' is not a variant here`);

      /* THE MEASURED / PREDICTED SPLIT, which is the one this file exists to
         keep honest: a prediction that reads like an experiment is the error
         a collection makes silently. The registry indexes on the METHOD; a
         resolution or a pLDDT is a fact about one structure and lives in its
         bake, beside the coordinates it qualifies. */
      const m = v.read && v.read.method;
      if (m && !lib.METHODS.includes(m))
        bad.push(`${vat}: method '${m}' is not one of ${lib.METHODS.join(', ')}`);

      /* THE OTHER AXIS, and controlled for the same reason as `method`: a
         collection that let 'mutant' and 'mutation' both stand would split
         the disease structures in two on a sort and nobody would see it. The
         field is optional — most variants differ by a ligand or a species,
         which is not a state — but a value outside the list is a typo, not a
         new idea. */
      if (v.state && !lib.STATES.includes(v.state))
        bad.push(`${vat}: state '${v.state}' is not one of ${lib.STATES.join(', ')}`);

      /* Residues against what the entry declares, and ONLY where the two are
         the same kind of number: SEQRES is per chain, so this holds for a
         variant drawing one named chain and says nothing about an assembly.
         Prion's ten-rung stack models 600 residues against a declared 210 and
         is not a contradiction — it is ten copies of one chain, which is the
         whole point of that view. A fragment is legitimate too, and the panel
         says so; what this catches is the two numbers coming from different
         places. */
      const single = v.chains && !v.chains.includes(',') && !v.of;
      if (single && v.read && v.read.declared != null && v.read.residues > v.read.declared)
        bad.push(`${vat}: chain ${v.chains} models ${v.read.residues} residues ` +
                 `against ${v.read.declared} declared`);
    }
    /* EXACTLY ONE DEFAULT. None is the failure worth naming: with no mark the
       choice falls to whichever variant the list starts with, so re-ordering
       the list re-aims the bench and the card without anyone touching a
       decision. Mark the first entry if nothing else earns it. */
    /* AN ENZYME HAS AN EC NUMBER, and every variant that carries one has to
       carry the SAME one: they are meant to be entries of one protein, and
       two numbers means one of them is filed under the wrong key. The other
       direction is legitimate — an entry can classify nothing and still be an
       enzyme's structure — so only disagreement fails. */
    const ecs = [...new Set(p.variants.map(v => v.read && v.read.ec).filter(Boolean))];
    if (ecs.length > 1)
      bad.push(`${at}: variants disagree about the EC number (${ecs.join(', ')})`);
    if (p.does === 'enzyme' && !ecs.length)
      bad.push(`${at}: does 'enzyme' and no variant carries an EC number`);
    if (p.does !== 'enzyme' && ecs.length)
      bad.push(`${at}: carries EC ${ecs[0]} but does is '${p.does}'`);

    if (defaults === 0)
      bad.push(`${at}: no variant marked default — mark one, the first if nothing else`);
    if (defaults > 1) bad.push(`${at}: ${defaults} variants marked default`);

    /* The reference has to be one of the variants, or a bench superposes onto
       something nobody can look at. */
    if (p.fit && !ids.has(p.fit.on))
      bad.push(`${at}: fit.on '${p.fit.on}' is not a variant here`);
    /* A scoped fit names variants, and the reference has to be one of them —
       a scope that excludes what everything is fitted onto describes nothing. */
    for (const id of (p.fit && p.fit.among) || [])
      if (!ids.has(id)) bad.push(`${at}: fit.among '${id}' is not a variant here`);
    if (p.fit && p.fit.among && !p.fit.among.includes(p.fit.on))
      bad.push(`${at}: fit.among does not include the reference '${p.fit.on}'`);
    if (!p.fit && !p.fitWhy)
      bad.push(`${at}: no fit and no fitWhy — say whether it cannot or need not`);

    /* A hand-picked basis is only shareable across variants that share a
       frame. Without a fit it is right for one structure and wrong for the
       rest — the trap that made the myoglobin bench jump. */
    if (p.view && p.view.shared && !p.fit)
      bad.push(`${at}: view.shared with no superposition`);
    if (p.view && p.view.by === 'human' && !p.view.basis)
      bad.push(`${at}: view by a human, but no basis recorded`);
  }
  return bad;
}

/* ---- writing --------------------------------------------------------- */

/* A `read` block, one line per key, in the order given rather than sorted:
   these are read by a person comparing two variants side by side, and a
   stable order is what makes that a scan instead of a search. */
function serialise(read, indent) {
  const pad = ' '.repeat(indent);
  const keys = Object.keys(read).filter(k => read[k] !== undefined);
  if (!keys.length) return '{}';
  const body = keys.map(k => `${pad}  ${k}: ${JSON.stringify(read[k])}`).join(',\n');
  return '{\n' + body + ' }';
}

/* Find `{ id: 'X'` … its `read: {…}` … and replace that object alone.
   Deliberately textual and deliberately narrow: the alternative is
   re-emitting the file from the parsed objects, which drops every comment
   in it — and in this file the comments are the reasons. */
function spliceRead(src, id, read) {
  const at = src.indexOf(`{ id: '${id}'`);
  if (at < 0) throw new Error(`registry: no variant '${id}' in proteins.js`);
  const key = src.indexOf('read:', at);
  if (key < 0) throw new Error(`registry: variant '${id}' has no read block`);

  const open = src.indexOf('{', key);
  let depth = 0, end = -1;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (!depth) { end = i + 1; break; } }
  }
  if (end < 0) throw new Error(`registry: variant '${id}' has an unclosed read block`);

  /* The indent of the line `read:` sits on, so the block lands under it. */
  const lineStart = src.lastIndexOf('\n', key) + 1;
  const indent = src.slice(lineStart, key).length;
  return src.slice(0, open) + serialise(read, indent) + src.slice(end);
}

/* write(key, {id: read, …}) — one protein's variants, validated before the
   file is touched. Returns what changed, so a baker can print it. */
function write(key, blocks) {
  let { src, lib } = read();
  const p = lib.byKey(key);
  if (!p) throw new Error(`registry: no protein '${key}'`);

  const touched = [];
  for (const [id, read_] of Object.entries(blocks)) {
    if (!lib.variantOf(p, id)) throw new Error(`registry: '${key}' has no variant '${id}'`);
    src = spliceRead(src, id, read_);
    touched.push(id);
  }

  /* Validate the RESULT, not the input: a splice that produced something the
     rules reject must not reach disk, or the next reader inherits it. */
  const after = parse(src);
  const bad = validate(after);
  if (bad.length)
    throw new Error('registry: refusing to write —\n  ' + bad.join('\n  '));

  fs.writeFileSync(FILE, src);
  return touched;
}

if (require.main === module) {
  const { lib } = read();
  const bad = validate(lib);
  const n = lib.PROTEINS.reduce((k, p) => k + p.variants.length, 0);
  if (bad.length) { console.error('proteins.js:\n  ' + bad.join('\n  ')); process.exit(1); }
  console.log(`proteins.js ok — ${lib.PROTEINS.length} proteins, ${n} variants`);
}

module.exports = { FILE, read, parse, validate, write, spliceRead, serialise };
