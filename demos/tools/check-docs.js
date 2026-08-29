#!/usr/bin/env node
/* =====================================================================
 *  check-docs.js — audit for the claims CLAUDE.md and SCIENCE.md make
 *
 *  Run:  node tools/check-docs.js         (exits non-zero on failure)
 *
 *  Why this exists: the same reason check-molecules.js does. This project's
 *  rule is that a claim ships with its assertion rather than relying on
 *  someone noticing (MolecularGeometry.md §1.4, rule 2) — and the docs make claims
 *  too. Every doc error found in the audit of 2026-07-29 was an ENUMERATION
 *  that grew a member and wasn't updated: `stereo:` grew {axial}/{faces}
 *  while two files still said it understood only all-equatorial, §13 was
 *  written and the index stopped at §12. Prose can't be checked, but an
 *  enumeration can.
 *
 *  Two of those are mechanically verifiable, so they are checked here:
 *
 *    1. PATHS     every file named in a doc exists — or is listed in
 *                 KNOWN_ABSENT below with a reason.
 *    2. SECTIONS  every §n / §n.m reference resolves to a real heading, and
 *                 every top-level SCIENCE.md section appears in CLAUDE.md's
 *                 index.
 *
 *  A per-page script-table check used to live here too, diffing CLAUDE.md's
 *  claimed <script> tags against each page's actual ones. Retired along with
 *  the table itself: nothing else depended on that table being accurate, an
 *  agent can read a page's own <script> tags directly, and a check that
 *  exists only to keep a doc in sync with itself is circular.
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
const SCIENCE = rd('docs/SCIENCE.md');

// Files a doc names on purpose that do not exist. A name here is not just
// excused — it is asserted ABSENT, so if one gets built the check fails and
// tells you to update the doc that called it hypothetical.
const KNOWN_ABSENT = {
  // molecules-wishlist.md's proposed re-partition. These five are the files the
  // class-based split would create; nothing is moved yet, and the doc says so.
  'mol-sugars.js':      'molecules-wishlist.md proposal — not built',
  'mol-glycans.js':     'molecules-wishlist.md proposal — not built',
  'mol-carriers.js':    'molecules-wishlist.md proposal — not built',
  'mol-glycolysis.js':  'molecules-wishlist.md proposal — not built',
  'mol-cofactors.js':   'molecules-wishlist.md proposal — not built',
  'engine.js':          'the monolith CLAUDE.md/§10 exist to argue against',
  'water.html':         "CLAUDE.md's example of a rename that outlived its file",
  'layout.js':          'TESTING.md proposal — not built',
  'check-layout.js':    'TESTING.md proposal — not built',
  'contrast-layout.js': 'TESTING.md proposal — not built',
  'three.min.js':       'loaded from a CDN, deliberately not vendored',
  '3Dmol.js':           'a library NAME, not a file here — viewer-compare.html loads it from a CDN',
  // Deleted with the vendored ChemDoodle (GPLv3): the docs discuss them in the
  // past tense, and asserting them ABSENT is what stops one quietly returning
  // and putting the GPL back on the repo. Both are on the chemdoodle-archive
  // branch, and it is not coming back — hemoglobin-lab.html supersedes
  // protein-lab.html, so there is no rewrite pending.
  //
  'protein-lab.html':    'deleted with vendor/chemdoodle — docs/rendering-modules.md',
  // viewer-compare.html left demos/ for /viewer-compare/ at the repo root: it
  // loads its two libraries from CDNs and fetches structures from RCSB, so it
  // shares nothing with the lessons and is ready to lift into its own repo.
  // Still in weekly use as a style reference, and NOT deployed. ses.js,
  // bake-surface.js and surface-test.html cite the SES timings it measured, by
  // the filename it had here; asserted absent so it cannot come back to demos/.
  'viewer-compare.html': 'moved to /viewer-compare/ at the repo root — local tool, not deployed',
  // Deposited structures for a viewer-compare selector that never read them: it
  // fetches from files.rcsb.org. Deleted as dead weight, not with the page.
  'pdb/1IGT.pdb':        'nothing read it — viewer-compare fetches from RCSB',
  'pdb/1LYZ.pdb':        'nothing read it — viewer-compare fetches from RCSB',
  // The old-vs-generated spec bench, deleted once the conversion was done.
  // molecule-pipeline.md cites what it showed; that prose is history.
  '_compare.html':       'old-vs-generated spec bench — the conversion is done',
  '_generated-specs.json': '_compare.html\'s data, deleted with it',
  '_old-specs.json':       '_compare.html\'s data, deleted with it',
  // The Mol* stage-5 page and the orientation library it was the last consumer
  // of. protein-lab.html was pdb.js's reason to exist and is not coming back;
  // hemoglobin-inhouse.html, the surviving control arm, now carries the one
  // call it used (orientPDB) inline. Asserted absent so the library does not
  // quietly reappear as a shared module with a single caller.
  // demos/molstar/ is gone entirely now: its three pages and 3.8 MB of
  // structures were deleted, and the README that held the measurements moved to
  // viewer-compare/molstar-evaluation.md, beside the bench that asks the same
  // question. hemoglobin-inhouse.html still discusses these pages in the past
  // tense, which is why the names stay asserted here rather than being scrubbed.
  'molstar/protein-molstar.html': 'Mol* stage 5 — deleted with the rest of molstar/',
  'protein-molstar.html':         'same page, named without its folder',
  'pdb.js':              'deleted with protein-molstar.html; orient() ported into hemoglobin-inhouse.html',
  'tools/check-pdb.js':  'deleted with pdb.js — it had no other subject',
  'RDKit.js':           'library NAME, weighed against SmilesDrawer and unadopted',
  'Kekule.js':          'library NAME, weighed against SmilesDrawer and unadopted',
  'SmilesDrawer/RDKit.js': 'the two 2D candidates named as one alternative',
  // LESSONS-ROADMAP.md's domain-file plan. Absent BY DESIGN — the roadmap is
  // the file that proposes them, so building one must fail here until that
  // row moves from "after" to "now".
  'mol-photosynthesis.js': 'LESSONS-ROADMAP.md tier-after — deferred',
  'mol-carbs.js':          'LESSONS-ROADMAP.md — proposed by docs/molecule-grouping.md, declined',
  'mol-aminoacids.js':     'LESSONS-ROADMAP.md — proposed by docs/molecule-grouping.md, declined',
  'mol-signaling.js':      'LESSONS-ROADMAP.md — out of scope',
  'mol-ecology.js':        'LESSONS-ROADMAP.md — out of scope',
  // Build outputs and runtime strings, not repo files.
  'generated-specs.json':         'sdf2spec.js writes it; not committed',
  'generated-specs-generic.json': 'sdf2spec-generic.js writes it; not committed',
};

let fails = 0;
const fail = (what, msg) => { fails++; console.log(`  FAIL  ${what}: ${msg}`); };
// PRINTS, and only prints. Most checkers in this repo spell `ok` the other way
// round — ok(cond, what) — so a check written that way here would hand a
// CONDITION to a message parameter and pass forever while asserting nothing.
// Refuse the second argument rather than swallow it; use `is` below.
const ok = (msg, ...extra) => { if(extra.length) throw new Error(
  'ok() takes a message, not a condition — use is(cond, msg)'); console.log(`  ok    ${msg}`); };
const is = (cond, msg, what) => cond ? ok(msg) : fail(what||msg, msg);

/* ---- 1. PATHS ------------------------------------------------------ */
console.log('\n== 1. files named in docs exist');

// Every doc AND every source file, because a page's own header comment is now
// where page-internal rules are supposed to live (CLAUDE.md, "Keeping the docs
// true") — so it is exactly as capable of naming a file that got renamed. The
// first version of this check scanned only .md plus a hand-listed five modules,
// and missed molecule-builder.html citing water-drag.js / salt-drag.js long
// after those became covalent-drag.js / ionic-drag.js.
const DOCS = fs.readdirSync(ROOT)
  .filter(f => /\.(md|js|html)$/.test(f) && !f.startsWith('_'))
  .concat(fs.readdirSync(path.join(ROOT, 'docs'))
    .filter(f => /\.md$/.test(f)).map(f => `docs/${f}`))
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
    // A METHOD CALL IS NOT A PATH. `res.json()` in a page's fetch chain reads
    // as the file "res.json" — flagged the first time a lesson loaded JSON
    // instead of a binary. Anything immediately followed by '(' is code.
    if (src[m.index + m[0].length] === '(') continue;
    if (!named.has(n)) named.set(n, new Set());
    named.get(n).add(doc);
  }
}

// Docs sometimes write a path from the repo root rather than from demos/.
const norm = n => n.replace(/^demos\//, '');
// Prose names a script the way a reader says it — `check-molecules.js` lives at
// the top level, `check-docs.js` in tools/ and `ribbon.js` in kit/, and
// none of them gets a directory in running text. So resolve a bare name
// against all of them. folding/ and folding/tools/ joined the list when
// folding-lab's modules and bake scripts moved there, and hemoglobin/ +
// hemoglobin/tools/ when that page arrived; before each, any comment naming
// one of their files bare failed here. Every directory that holds a script
// prose might name belongs in this list — the failure mode is a checker that
// cries wolf at correct documentation, which trains people to ignore it.
// '..' is the repo root, which dev-server.js serves and GitHub Pages publishes;
// a doc in demos/ naming api/_tutor.js is naming it from there, not from here.
// 'docs' is where the rulebooks live and 'tests'/'attic' where the benches and
// the superseded lessons do; all three are named bare in running text, the same
// way a script is.
const SEARCH = ['.', '..', 'lib', 'css', 'docs', 'tests', 'attic', 'tools', 'folding', 'folding/tools',
                'proteins', 'proteins/tools',
                'hemoglobin', 'hemoglobin/tools', 'massaction', 'diffusion',
                'sickle', 'sickle/tools', 'membrane', 'membrane/tools',
                'kit', 'reaction', 'coupling', 'lobes', 'dna', 'ask', 'capillary', 'water',
                'molecule-builder'];
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

/* ---- 2. SECTIONS --------------------------------------------------- */
// Section rules used to live only in SCIENCE.md. Now MolecularGeometry.md
// (§1.x) and WaterSim.md (§1–4) carry their own numbered headings too, so a
// bare §N could mean any of three files. Heuristic: whichever *.md is named
// most recently on the SAME LINE governs every §-ref on that line; a line
// with no filename mention defaults to SCIENCE.md, since that's still the
// rulebook everything else was split out of.
console.log('\n== 2. section references resolve');

function headings(src) {
  const tops = new Set(), subs = new Set();
  for (const m of src.matchAll(/^## (\d+)\./gm)) tops.add(m[1]);
  for (const m of src.matchAll(/^### (\d+\.\d+)/gm)) subs.add(m[1]);
  return { tops, subs };
}

const SECTIONED = {
  'SCIENCE.md': headings(SCIENCE),
  'MolecularGeometry.md': headings(rd('docs/MolecularGeometry.md')),
  'WaterSim.md': headings(rd('docs/WaterSim.md')),
};
const { tops, subs } = SECTIONED['SCIENCE.md']; // only SCIENCE.md's index is audited below

for (const [doc, src] of [['CLAUDE.md', CLAUDE], ['SCIENCE.md', SCIENCE]]) {
  for (const line of src.split('\n')) {
    const namedFile = [...line.matchAll(/([A-Za-z][\w-]*\.md)/g)].pop();
    const file = namedFile && SECTIONED[namedFile[1]] ? namedFile[1] : 'SCIENCE.md';
    const { tops: fTops, subs: fSubs } = SECTIONED[file];
    for (const m of line.matchAll(/§+\s?(\d+(?:\.\d+)?)/g)) {
      const ref = m[1];
      const known = ref.includes('.') ? fSubs.has(ref) : fTops.has(ref);
      if (!known) fail('sections', `${doc} references §${ref}, which is not a heading in ${file}`);
    }
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
console.log('PASS: file references and section index all match reality');
