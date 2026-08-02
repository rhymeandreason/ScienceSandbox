#!/usr/bin/env node
/* =====================================================================
 *  check-pages.js — does each page load the molecules it actually uses?
 *
 *  Run:  node tools/check-pages.js       (exits non-zero on failure)
 *
 *  This guards the failure mode that docs/molecule-pipeline.md item 3
 *  introduced. Before the split every page loaded every spec, so a page could
 *  not reference a molecule it did not have. Now the <script> tags decide, and
 *  forgetting a mol-*.js means `MOLECULES.water is undefined` at runtime — on
 *  one interaction, possibly not the first one anybody clicks.
 *
 *  check-docs.js already asserts the script table matches the tags. It cannot
 *  see whether the resulting SET is sufficient, because that depends on which
 *  molecules the page's own JavaScript names. This closes that gap.
 *
 *  How: each page's local <script> tags are executed in a fresh vm context, in
 *  the order the page lists them — the same thing a browser does, minus Three
 *  and the DOM (only the library modules are run; they touch neither). Then
 *  every molecule name the page mentions is looked up in the MolLib that page
 *  actually built.
 *
 *  The reference scan is deliberately GENEROUS: a bare quoted 'water' counts,
 *  not just MOLECULES.water. Over-reporting costs a page one extra file;
 *  under-reporting ships a broken lesson. If that ever gets annoying, make the
 *  scan narrower, not the failure quieter.
 *
 *  It cannot check layout, framing or anything visual — TESTING.md covers why
 *  that stays a human job.
 * ===================================================================== */
'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ALL = Object.keys(require(path.join(ROOT, 'lib-node.js')).MOLECULES);

let fails = 0;
const fail = m => { fails++; console.log(`  FAIL  ${m}`); };

// Pages that render deposited PDB structures through a third-party viewer
// (RenderingLibraries.md). They touch none of the spec library — coordinates
// come from pdb/*.pdb, not MolLib — so there is no molecule reference to check.
// Their own assertions live in tools/check-pdb.js.
const PDB_PAGES = new Set(['viewer-compare.html', 'protein-lab.html']);

for (const page of fs.readdirSync(ROOT).filter(f => f.endsWith('.html') && !PDB_PAGES.has(f)).sort()) {
  const src = fs.readFileSync(path.join(ROOT, page), 'utf8');
  // Local scripts only, in page order; CDN Three is not our concern.
  const libs = [...src.matchAll(/<script\s+src="([^"]+)"/g)].map(m => m[1])
    .filter(s => !s.includes('/'))
    .filter(s => s === 'palette.js' || s === 'molecules.js' || s === 'skel.js' || /^mol-/.test(s));

  // A fresh window per page — exactly what the browser hands it.
  const sandbox = { console, Math, JSON, Object, Array, String, Number, Error, Boolean };
  sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);
  try {
    for (const f of libs) {
      vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
    }
  } catch (e) {
    fail(`${page}: loading [${libs.join(', ')}] threw — ${e.message}`);
    continue;
  }
  if (!sandbox.MolLib) { fail(`${page}: loads no molecules.js`); continue; }

  const have = new Set(Object.keys(sandbox.MolLib.MOLECULES));
  const used = ALL.filter(n =>
    new RegExp(`MOLECULES\\s*\\.\\s*${n}\\b`).test(src) ||
    new RegExp(`MOLECULES\\s*\\[\\s*['"]${n}['"]`).test(src) ||
    new RegExp(`['"]${n}['"]`).test(src));
  const missing = used.filter(n => !have.has(n));

  if (missing.length) {
    fail(`${page} names [${missing.join(', ')}] but loads only [${libs.join(', ')}] `
      + `— add the mol-*.js that owns them (and skel.js if it needs the builder)`);
  } else {
    console.log(`  ok    ${page.padEnd(23)} ${String(have.size).padStart(2)}/${ALL.length} specs loaded, `
      + `${used.length} referenced`);
  }
}

console.log('');
if (fails) { console.log(`FAIL: ${fails} page(s) reference a molecule they do not load`); process.exit(1); }
console.log('PASS: every page loads every molecule it names');
