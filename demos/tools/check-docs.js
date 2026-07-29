#!/usr/bin/env node
/* =====================================================================
 *  check-docs.js — audit for the claims CLAUDE.md and SCIENCE.md make
 *
 *  Run:  node tools/check-docs.js         (exits non-zero on failure)
 *
 *  Why this exists: the same reason check-molecules.js does. This project's
 *  rule is that a claim ships with its assertion rather than relying on
 *  someone noticing (SCIENCE.md §1.4, rule 2) — and the docs make claims
 *  too. Every doc error found in the audit of 2026-07-29 was an ENUMERATION
 *  that grew a member and wasn't updated: a page was added and the script
 *  table didn't say so, `stereo:` grew {axial}/{faces} while two files still
 *  said it understood only all-equatorial, §13 was written and the index
 *  stopped at §12. Prose can't be checked, but an enumeration can.
 *
 *  Three of those are mechanically verifiable, so they are checked here:
 *
 *    1. SCRIPTS   CLAUDE.md's per-page script table vs the actual <script>
 *                 tags in each *.html.
 *    2. PATHS     every file named in a doc exists — or is listed in
 *                 KNOWN_ABSENT below with a reason.
 *    3. SECTIONS  every §n / §n.m reference resolves to a real heading, and
 *                 every top-level SCIENCE.md section appears in CLAUDE.md's
 *                 index.
 *
 *  What it deliberately does NOT check: whether the prose is TRUE. Nothing
 *  here would have caught the stale `stereo:` vocabulary — that one needs a
 *  human. The point is to spend the check on the errors that recur.
 * ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const CLAUDE = rd('CLAUDE.md');
const SCIENCE = rd('SCIENCE.md');

// Files a doc names on purpose that do not exist. A name here is not just
// excused — it is asserted ABSENT, so if one gets built the check fails and
// tells you to update the doc that called it hypothetical.
const KNOWN_ABSENT = {
  'engine.js':          'the monolith CLAUDE.md/§10 exist to argue against',
  'water.html':         "CLAUDE.md's example of a rename that outlived its file",
  'package.json':       'TESTING.md notes there is deliberately none',
  'layout.js':          'TESTING.md proposal — not built',
  'check-layout.js':    'TESTING.md proposal — not built',
  'contrast-layout.js': 'TESTING.md proposal — not built',
  'three.min.js':       'loaded from a CDN, deliberately not vendored',
  // Build outputs and runtime strings, not repo files.
  'generated-specs.json':         'sdf2spec.js writes it; not committed',
  'generated-specs-generic.json': 'sdf2spec-generic.js writes it; not committed',
  'index.html':                   "dev-server.js's directory-index default",
};

let fails = 0;
const fail = (what, msg) => { fails++; console.log(`  FAIL  ${what}: ${msg}`); };
const ok = msg => console.log(`  ok    ${msg}`);

/* ---- 1. SCRIPTS ---------------------------------------------------- */
// The table is cumulative: a row whose Loads cell starts with "+" inherits
// the previous row's set. That reads well and parses fine, but it means the
// row ORDER is load-bearing — don't reorder without rereading this.
console.log('\n== 1. per-page script table (CLAUDE.md)');

function tableAfter(src, marker) {
  const at = src.indexOf(marker);
  if (at < 0) return null;
  const lines = src.slice(at).split('\n').slice(1);
  const rows = [];
  for (const ln of lines) {
    if (!ln.startsWith('|')) break;
    const cells = ln.split('|').slice(1, -1).map(c => c.trim());
    if (cells.every(c => /^-+$/.test(c))) continue;      // separator
    rows.push(cells);
  }
  return rows.slice(1);                                  // drop the header row
}

const scriptRows = tableAfter(CLAUDE, "ENUM: update when any page's <script>");
if (!scriptRows) {
  fail('scripts', 'could not find the script table (its ENUM marker is gone)');
} else {
  const declared = new Map();
  let running = [];
  for (const [pageCell, loadCell] of scriptRows) {
    const pages = pageCell.split(',').map(s => s.trim().replace(/`/g, ''));
    const adds = loadCell.replace(/^\+/, '').split(',').map(s => s.trim());
    running = loadCell.trim().startsWith('+') ? running.concat(adds) : adds;
    for (const p of pages) declared.set(p, new Set(running.map(n => `${n}.js`)));
  }

  const pages = fs.readdirSync(ROOT)
    .filter(f => f.endsWith('.html') && !f.startsWith('_'));

  for (const page of pages) {
    const key = page.replace(/\.html$/, '');
    // Local scripts only — three.min.js comes from a CDN and is not the
    // table's subject.
    const actual = new Set([...rd(page).matchAll(/<script\s+src="([^"]+)"/g)]
      .map(m => m[1]).filter(s => !s.includes('/')));
    const want = declared.get(key);
    if (!want) { fail('scripts', `${page} is not in the table at all`); continue; }
    const missing = [...actual].filter(s => !want.has(s));
    const extra = [...want].filter(s => !actual.has(s));
    if (missing.length || extra.length) {
      fail('scripts', `${page} loads [${[...actual].join(', ')}] but the table says `
        + `[${[...want].join(', ')}]`);
    }
  }
  for (const key of declared.keys()) {
    if (!pages.includes(`${key}.html`)) fail('scripts', `table lists ${key}.html, which does not exist`);
  }
  if (!fails) ok(`${pages.length} pages match the table`);
}

/* ---- 2. PATHS ------------------------------------------------------ */
console.log('\n== 2. files named in docs exist');

// Every doc AND every source file, because a page's own header comment is now
// where page-internal rules are supposed to live (CLAUDE.md, "Keeping the docs
// true") — so it is exactly as capable of naming a file that got renamed. The
// first version of this check scanned only .md plus a hand-listed five modules,
// and missed molecule-builder.html citing water-drag.js / salt-drag.js long
// after those became covalent-drag.js / ionic-drag.js.
const DOCS = fs.readdirSync(ROOT)
  .filter(f => /\.(md|js|html)$/.test(f) && !f.startsWith('_'))
  .concat(fs.readdirSync(path.join(ROOT, 'tools'))
    .filter(f => /\.(md|js)$/.test(f)).map(f => `tools/${f}`))
  // This file cites filenames as examples (water-drag.js, lab.html) and would
  // flag its own prose.
  .filter(f => f !== 'tools/check-docs.js');

const named = new Map();          // name -> Set of docs naming it
for (const doc of DOCS) {
  // Drop URLs first — a CDN path like @2.1.1/src/bold/style.css is not a local
  // file, and its tail looks exactly like one.
  const src = rd(doc).replace(/\b(?:https?:)?\/\/[^\s"'`)]+/g, ' ');
  // The leading (^|[^\w./*-]) stops `*-lab.html` from being read as `lab.html`.
  for (const m of src.matchAll(
        /(^|[^\w./*-])([A-Za-z0-9_][A-Za-z0-9_./-]*\.(?:html|js|css|json))\b/gm)) {
    const n = m[2];
    if (n.includes('..') || n === 'Three.js') continue;         // prose, not a path
    if (!named.has(n)) named.set(n, new Set());
    named.get(n).add(doc);
  }
}

// Docs sometimes write a path from the repo root rather than from demos/.
const norm = n => n.replace(/^demos\//, '');
// Prose names a script the way a reader says it — `check-molecules.js` lives at
// the top level and `check-docs.js` in tools/, and neither gets a directory in
// running text. So resolve a bare name against both.
const SEARCH = ['.', 'tools'];
const exists = n => SEARCH.some(d => fs.existsSync(path.join(ROOT, d, norm(n))));

for (const [n, docs] of [...named].sort()) {
  const where = [...docs].join(', ');
  const key = norm(n);
  if (key in KNOWN_ABSENT) {
    if (exists(n)) {
      fail('paths', `${n} is in KNOWN_ABSENT ("${KNOWN_ABSENT[key]}") but now EXISTS — `
        + `update ${where}, then drop it from KNOWN_ABSENT`);
    }
    continue;
  }
  if (!exists(n)) {
    fail('paths', `${where} names ${n}, which does not exist. If that is `
      + `deliberate, add it to KNOWN_ABSENT in this file with a reason.`);
  }
}
ok(`${named.size} distinct file references scanned`);

/* ---- 3. SECTIONS --------------------------------------------------- */
console.log('\n== 3. section references resolve');

const tops = new Set();       // "1", "2", …
const subs = new Set();       // "1.4", …
for (const m of SCIENCE.matchAll(/^## (\d+)\./gm)) tops.add(m[1]);
for (const m of SCIENCE.matchAll(/^### (\d+\.\d+)/gm)) subs.add(m[1]);

for (const [doc, src] of [['CLAUDE.md', CLAUDE], ['SCIENCE.md', SCIENCE]]) {
  for (const m of src.matchAll(/§+\s?(\d+(?:\.\d+)?)/g)) {
    const ref = m[1];
    const known = ref.includes('.') ? subs.has(ref) : tops.has(ref);
    if (!known) fail('sections', `${doc} references §${ref}, which is not a heading in SCIENCE.md`);
  }
}

// The index bug: §13 existed and CLAUDE.md's index stopped at §12. The index
// covers sections both singly (§9) and by range (§§2–8), so expand ranges
// before asking whether a section is accounted for.
const idx = CLAUDE.slice(CLAUDE.indexOf('## Scientific accuracy'),
                         CLAUDE.indexOf('## Run / test locally'));
const covered = new Set();
for (const m of idx.matchAll(/§+\s?(\d+)\s*[-–—]\s*(\d+)/g)) {
  for (let i = +m[1]; i <= +m[2]; i++) covered.add(String(i));
}
for (const m of idx.matchAll(/§+\s?(\d+)(?!\s*[-–—]\s*\d)(?!\.\d)/g)) covered.add(m[1]);

for (const t of [...tops].sort((a, b) => a - b)) {
  if (!covered.has(t)) {
    fail('sections', `SCIENCE.md has §${t} but CLAUDE.md's index never mentions it`);
  }
}
if (tops.size) ok(`${tops.size} sections, ${subs.size} subsections, all references resolve`);

/* ---- summary ------------------------------------------------------- */
console.log('');
if (fails) {
  console.log(`FAIL: ${fails} doc claim(s) no longer true`);
  process.exit(1);
}
console.log('PASS: script table, file references and section index all match reality');
