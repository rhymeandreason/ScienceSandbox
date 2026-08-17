#!/usr/bin/env node
/* =====================================================================
 *  check-pages.js — two audits of a page's own source.
 *
 *  Run:  node tools/check-pages.js       (exits non-zero on failure)
 *
 *    1. does each page load the molecules it actually uses?
 *    2. does every proton hop REMOVE THE ATOM IT MOVES?
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
// (docs/rendering-modules.md) are skipped here: they touch none of the spec library
// — coordinates come from pdb/*.pdb, not MolLib — so there is no molecule
// reference to check.
//
// viewer-compare.html is back from the sickle-cell branch: 3Dmol + Mol* over
// pdb/*.pdb, no MolLib. protein-lab.html stays deleted (vendored ChemDoodle);
// the non-GPL rewrite will need naming here if it still bypasses MolLib.
const PDB_PAGES = new Set(['viewer-compare.html']);

// index.html draws nothing at all — it is a redirect up to the lesson index at
// the repo root, which is where GitHub Pages serves it from. admin.html is an
// internal nav page linking to other pages' scenes, not a scene itself.
const NO_SCENE = new Set(['index.html', 'admin.html']);

const PAGES = fs.readdirSync(ROOT)
  .filter(f => f.endsWith('.html') && !PDB_PAGES.has(f) && !NO_SCENE.has(f)).sort();

console.log('== 1. every page loads the molecules it names');
for (const page of PAGES) {
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

/* =====================================================================
 *  2. A PROTON HOP HAS TO TAKE THE ATOM WITH IT.
 *
 *  fx.js's protonHop draws a COURIER, not the hydrogen: a glow that flies to a
 *  target and fades. It does not touch the molecule. So a hop whose source atom
 *  is still drawn shows two hydrogens where the chemistry has one — a white H
 *  sitting on the bond it supposedly just left, while a second one sails away,
 *  and the honest question is where the extra one came from.
 *
 *  This is not hypothetical and not rare. The audit of 2026-08-17 found it at
 *  FOUR call sites across three steps of glycolysis-lab: steps 1 and 3 flew the
 *  hydroxyl proton for the whole phosphate flight with the H still on screen,
 *  step 6's whole-step route sent a hydride to NAD⁺ while the hydrogen it was
 *  supposedly made of stayed on the aldehyde, and step 2 had no shed at all.
 *  Every one of them was written beside a call site that DID shed correctly.
 *  The pattern: shedding is remembered when the hydrogen is the subject of the
 *  beat, and forgotten when it is a side effect of something else moving.
 *
 *  WHAT THIS CAN AND CANNOT SEE. It is a source-proximity check, not a proof:
 *  it asks whether a call that removes the source is written near the hop. It
 *  cannot tell that the removal names the SAME atom the hop starts from, or
 *  that it runs on the same branch. What it does catch is the whole observed
 *  failure mode — a hop with no removal anywhere near it.
 *
 *  ENUM: REMOVERS is the point of this check, not an implementation detail. A
 *  page may make the source stop being drawn any way it likes, but the way has
 *  to be listed here — and adding one is exactly the moment to ask whether it
 *  really removes the atom. Two idioms are in use today:
 *    · shed it       glycolysis-lab hides the mesh (GO.shed via shedAtoms)
 *    · morph it      molecule-lab swaps the whole acid for its ion, so the
 *                    hydrogen is gone by construction — no shed to find
 * ===================================================================== */
const REMOVERS = /\b(shedAtoms|shed|removeAtoms|morphSolute|swapLane)\s*\(/;
const BEFORE = 14, AFTER = 3;      // lines of context; widen only with a reason

console.log('\n== 2. every proton hop removes the atom it moves');
let hops = 0;
for (const page of PAGES) {
  const lines = fs.readFileSync(path.join(ROOT, page), 'utf8').split('\n');
  lines.forEach((raw, i) => {
    const line = raw.replace(/\/\/.*$/, '');       // a hop named in a comment is prose
    if (!/(?:\bprotonHop|\bhop)\s*\(/.test(line)) return;
    // The page's own hop() wrapper is a DEFINITION, not a call — it is where
    // the courier is configured, and the shed belongs at the call sites.
    if (/\b(const|let|var|function)\s/.test(line.slice(0, line.search(/(?:\bprotonHop|\bhop)\s*\(/)))) return;
    hops++;
    const win = lines.slice(Math.max(0, i - BEFORE), i + 1 + AFTER)
                     .map(l => l.replace(/\/\/.*$/, '')).join('\n');
    if (!REMOVERS.test(win))
      fail(`${page}:${i + 1} — proton hop with no source removal within `
        + `${BEFORE} lines: the H flies off while the molecule keeps it. `
        + `Shed the source atom as the hop starts (or morph the molecule), `
        + `and reveal a real atom at the destination via protonHop's onArrive.`);
  });
}
if (!fails) console.log(`  ok    ${hops} proton hop(s), every one removes its source`);

console.log('');
if (fails) { console.log(`FAIL: ${fails} page claim(s) no longer true`); process.exit(1); }
console.log('PASS: every page loads every molecule it names, '
  + 'and every proton hop removes its source');
