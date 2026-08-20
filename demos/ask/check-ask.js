#!/usr/bin/env node
/* =============================================================================
 *  check-ask.js — the catalog is a set of claims about files. Check them.
 * =============================================================================
 *  `node demos/ask/check-ask.js`
 *
 *  The failure this exists to catch is silent from the page: a lesson gets
 *  renamed, the catalog still names the old file, and the box keeps confidently
 *  citing a chapter whose link 404s. Nothing about that is visible until a
 *  student clicks it.
 * ========================================================================== */
'use strict';

const fs   = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const { CHAPTERS, IDS } = require(path.join(ROOT, 'api/_catalog.js'));

let fail = 0;
const bad = m => { console.log(`  FAIL  ${m}`); fail++; };

console.log(`\nask catalog — ${CHAPTERS.length} chapters\n`);

if (new Set(IDS).size !== IDS.length) bad('duplicate chapter id');

for (const c of CHAPTERS) {
  if (!/^[a-z][a-z0-9-]*$/.test(c.id)) bad(`${c.id}: id must be lowercase kebab`);
  if (!c.chapter) bad(`${c.id}: no chapter name`);
  if (!c.covers || c.covers.length < 30) bad(`${c.id}: covers is too thin to match a student's wording against`);

  if (c.page === null) { console.log(`  ----  ${c.id.padEnd(11)} ${c.chapter}  (no page yet)`); continue; }

  if (c.page.startsWith('/')) bad(`${c.id}: page must be repo-relative, not rooted`);
  if (!fs.existsSync(path.join(ROOT, c.page))) bad(`${c.id}: ${c.page} does not exist`);
  else console.log(`  ok    ${c.id.padEnd(11)} ${c.page}`);
}

// The schema's enum is built from IDS, so a prompt that names a chapter the enum
// does not carry would be unreachable. Cheap to assert, and it fails loudly the
// first time the two lists are edited apart.
const { SCHEMA, SYSTEM } = require(path.join(ROOT, 'api/_tutor.js'));
const enums = SCHEMA.properties.chapters.items.enum;
if (enums.join() !== IDS.join()) bad('the response schema enum and the catalog have drifted apart');
for (const id of IDS) if (!SYSTEM.includes(`- ${id} (`)) bad(`${id} is missing from the system prompt`);

/* Every provider answers the same interface. This is the assertion that keeps
 * "swap the provider" a one-line env change instead of a debugging session:
 * a module that drops `PRICE` prices every question at zero, silently. */
const providers = require(path.join(ROOT, 'api/_providers'));
console.log(`\nproviders — default ${providers.DEFAULT}\n`);

for (const id of providers.names()) {
  const p = require(path.join(ROOT, `api/_providers/${id}.js`));
  for (const f of ['id', 'label', 'envKey', 'model', 'PRICE', 'ask']) {
    if (p[f] === undefined) bad(`${id}: no ${f}`);
  }
  if (p.id !== id) bad(`${id}: module says its id is "${p.id}"`);
  if (typeof p.ask !== 'function') bad(`${id}: ask is not a function`);
  for (const k of ['input', 'output', 'cached']) {
    if (typeof (p.PRICE || {})[k] !== 'number') bad(`${id}: PRICE.${k} is not a number`);
  }
  if (!fail) console.log(`  ok    ${id.padEnd(11)} ${p.model}  (${p.envKey}${process.env[p.envKey] ? ' set' : ' unset'})`);
}

if (!providers.names().includes(providers.DEFAULT)) bad(`AI_PROVIDER "${providers.DEFAULT}" is not a provider`);

console.log(fail ? `\n  ${fail} problem(s)\n` : '\n  all good\n');
process.exit(fail ? 1 : 0);
