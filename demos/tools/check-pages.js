#!/usr/bin/env node
/* =====================================================================
 *  check-pages.js — two audits of a page's own source.
 *
 *  Run:  node tools/check-pages.js       (exits non-zero on failure)
 *
 *    1. does each page load the molecules it actually uses?
 *    2. does every proton hop REMOVE THE ATOM IT MOVES?
 *    3. does every link on the ROOT index resolve to something served?
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
 *  Audit 3 reaches OUTSIDE demos/, which nothing else here does. The root
 *  index.html is the front door and the only page a student is handed, yet it
 *  is the one page no checker walked: it links the short URLs, which are a
 *  vercel.json routing fact rather than a file on disk, so "does this href
 *  exist" needs the route table to answer. Renaming a rewrite and leaving the
 *  link behind takes the two flagship lessons off the front page and shows up
 *  nowhere until a student clicks.
 *
 *  It cannot check layout, framing or anything visual — TESTING.md covers why
 *  that stays a human job.
 * ===================================================================== */
'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ALL = Object.keys(require(path.join(ROOT, 'lib', 'lib-node.js')).MOLECULES);

let fails = 0;
const fail = m => { fails++; console.log(`  FAIL  ${m}`); };

// Pages that render deposited PDB structures through a third-party viewer
// (docs/rendering-modules.md) are skipped here: they touch none of the spec library
// — coordinates come from a .pdb, not MolLib — so there is no molecule
// reference to check. The set is empty because no such page is in demos/ any
// more: the third-party viewers were evaluated and none was adopted, and the
// bench that compared them moved to /viewer-compare/ at the repo root, outside
// what this checker walks. A page that draws a deposited structure without
// MolLib needs naming here.
const PDB_PAGES = new Set();

// index.html draws nothing at all — it is a redirect up to the lesson index at
// the repo root, which is where GitHub Pages serves it from. admin.html is an
// internal nav page linking to other pages' scenes, not a scene itself.
// design-system.html loads palette.js to read the atom colours as swatches,
// which is the only reason it looks like a scene; it renders no molecule.
// tests/droplet-test.html and tests/adhesion-test.html render water as bulk — a
// refracting continuum, not spheres — because cohesion, contact angle and
// wicking are all properties of the bulk. There is no molecule on either page.
// tests/concept-map.html draws the topics themselves as a graph — labels and
// edges, no stage. questions-cms.html edits that graph's data file as text.
// tests/osmosis-data-test.html is at cell scale: a wall, a protoplast and the
// water crossing it. The registry has no spec for any of those, and the page's
// subject is a class's own measurements rather than a structure — loading
// molecules.js would buy it nothing and cost it a domain it never draws.
const NO_SCENE = new Set(['index.html', 'admin.html', 'design-system.html',
                          'tests/droplet-test.html', 'tests/adhesion-test.html',
                          'tests/concept-map.html', 'tests/osmosis-data-test.html',
                          'questions-cms.html', 'map-cms.html']);

// The lessons at the top level, plus the benches in tests/. Both directories,
// because two of the pages in tests/ (aminoacid-lab, macromolecule-lab) build
// real scenes out of the shared registry and were covered here before they
// moved — a checker that only read the top level would have dropped them
// silently, which is the failure this whole file exists to prevent.
//
// attic/ is NOT walked. Those pages are superseded (admin.html: reference) and
// not deployed; holding them to the registry's current shape would mean
// maintaining code nothing serves.
const html = d => fs.readdirSync(path.join(ROOT, d))
  .filter(f => f.endsWith('.html')).map(f => (d ? d + '/' : '') + f);
const PAGES = [...html(''), ...html('tests')]
  .filter(f => !PDB_PAGES.has(f) && !NO_SCENE.has(f)).sort();

console.log('== 1. every page loads the molecules it names');
for (const page of PAGES) {
  const src = fs.readFileSync(path.join(ROOT, page), 'utf8');
  // Local scripts only, in page order; CDN Three is not our concern. A src is
  // matched on its BASENAME and resolved against the page's own directory, so
  // a bench in tests/ loading ../molecules.js counts the same as a lesson
  // loading molecules.js.
  const libs = [...src.matchAll(/<script\s+src="([^"]+)"/g)].map(m => m[1])
    .filter(s => !/^https?:/.test(s))
    .filter(s => { const b = path.basename(s);
      return b === 'palette.js' || b === 'molecules.js' || b === 'skel.js' || /^mol-/.test(b); });
  const dir = path.dirname(path.join(ROOT, page));

  // A fresh window per page — exactly what the browser hands it.
  const sandbox = { console, Math, JSON, Object, Array, String, Number, Error, Boolean };
  sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);
  try {
    for (const f of libs) {
      vm.runInContext(fs.readFileSync(path.resolve(dir, f), 'utf8'), ctx, { filename: f });
    }
  } catch (e) {
    fail(`${page}: loading [${libs.join(', ')}] threw — ${e.message}`);
    continue;
  }
  if (!sandbox.MolLib) { fail(`${page}: loads no molecules.js`); continue; }

  const have = new Set(Object.keys(sandbox.MolLib.MOLECULES));

  /* A page's spec names do not all live in the page any more. The map pages
   * keep their card tables in lib/mapcontent.js — CONTENT, not a library: no
   * behaviour, no scene, and the spec names they draw are in there. Without
   * this the gate silently stopped covering them (5 referenced fell to 1).
   *
   * A NAMED list, not "every script that is not a mol-*.js". That was the first
   * try and it read scene.js and residues.js too, where the word `glycine`
   * appears in prose — sixteen pages failed for naming a molecule none of them
   * mentions. A content file is a deliberate thing and there are two, so adding
   * the third is a line here, exactly as adding a domain is a line above. */
  const CONTENT = new Set(['mapcontent.js', 'questions.js']);
  const content = [...src.matchAll(/<script\s+src="([^"]+)"/g)].map(m => m[1])
    .filter(f => !/^https?:/.test(f) && CONTENT.has(path.basename(f)))
    .map(f => { try { return fs.readFileSync(path.resolve(dir, f), 'utf8'); }
                catch { return ''; } });
  const hay = [src, ...content].join('\n');

  const used = ALL.filter(n =>
    new RegExp(`MOLECULES\\s*\\.\\s*${n}\\b`).test(hay) ||
    new RegExp(`MOLECULES\\s*\\[\\s*['"]${n}['"]`).test(hay) ||
    new RegExp(`['"]${n}['"]`).test(hay));
  const missing = used.filter(n => !have.has(n));

  if (missing.length) {
    fail(`${page} names [${missing.join(', ')}] but loads only [${libs.join(', ')}] `
      + `— add the mol-*.js that owns them (and skel.js if it needs the builder)`);
  } else {
    console.log(`  ok    ${page.padEnd(32)} ${String(have.size).padStart(2)}/${ALL.length} specs loaded, `
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
 *  really removes the atom. Three idioms are in use today:
 *    · shed it       glycolysis-lab hides the mesh (GO.shed via shedAtoms)
 *    · morph it      molecule-lab swaps the whole acid for its ion, so the
 *                    hydrogen is gone by construction — no shed to find
 *    · fly it in     the source is not on a lane molecule at all: it arrives
 *                    as a travelling fragment and kit/leaving.js's `launch`
 *                    DROPS that fragment before running its onDone, so the
 *                    atom stops being drawn on the frame the hop starts.
 *                    glycolysis-lab's `flyPi` is the one wrapper of this shape
 *                    (step 6's HPO₄²⁻ arrives holding the proton it releases).
 *                    Listed by WRAPPER, not by `launch`: a bare `launch` near
 *                    a hop is common and proves nothing about that hop's
 *                    source, so matching it would wave through the very cases
 *                    this exists to catch.
 *    · @undrawn      there is no atom to remove, because the spec never drew
 *                    one. mol-krebs.js omits C–H on every backbone carbon
 *                    (its header note 1), so succinate — symmetric, with no
 *                    stereocentre to except — has none of the four hydrogens
 *                    succinate dehydrogenase strips. `dehydro` therefore hops
 *                    off the CARBONS, and a shed would be reaching for meshes
 *                    that do not exist. The tag is written at the call site
 *                    and must name which spec draws nothing, so it cannot be
 *                    used to wave through a molecule that does.
 * ===================================================================== */
const REMOVERS = /\b(shedAtoms|shed|removeAtoms|morphSolute|swapLane|flyFree)\s*\(|@undrawn\b/;
const BEFORE = 14, AFTER = 3;      // lines of context; widen only with a reason

/* WHERE THE HOPS LIVE, which is no longer only the pages. `reaction/` holds the
 * verb bodies glycolysis-lab used to write inline, so scanning .html alone made
 * this check report ONE hop on a page that has a dozen — a green tick over the
 * exact code the audit above was written about. Widen this list alongside any
 * module that gains a hop.
 */
const HOP_SOURCES = [...PAGES, 'reaction/reaction.js'];

/* THE CALL SITES, and `protonAway` is one. A departure to solution is written
 * as a wrapper now (same colour, same `away` profile, same '+'), and a wrapper
 * whose name the pattern does not know is a hop this check cannot see — which
 * is how the four call sites in the audit above would look today. Add a name
 * here whenever a page or module wraps protonHop. */
const HOP_CALL = /(?:\bprotonHop|\bprotonAway|\bhop)\s*\(/;

console.log('\n== 2. every proton hop removes the atom it moves');
let hops = 0;
for (const page of HOP_SOURCES) {
  const lines = fs.readFileSync(path.join(ROOT, page), 'utf8').split('\n');
  lines.forEach((raw, i) => {
    const line = raw.replace(/\/\/.*$/, '');       // a hop named in a comment is prose
    if (!HOP_CALL.test(line)) return;
    // The page's own hop wrappers are DEFINITIONS, not calls — they are where
    // the courier is configured, and the shed belongs at the call sites.
    //
    // ACROSS LINES, because they are written that way: `const piProtonGoes=at=>`
    // sits on the line above its protonHop, and a same-line test called that a
    // call site and demanded a shed inside a definition. Walk back to the last
    // line that ENDED a statement, and if a declaration is still open when the
    // call appears, this is that declaration.
    let head = line.slice(0, line.search(HOP_CALL));
    for (let k = i - 1; k >= 0 && k >= i - 3; k--) {
      const prev = lines[k].replace(/\/\/.*$/, '').trimEnd();
      head = prev + ' ' + head;
      if (/[;{}]$/.test(prev)) break;
    }
    if (/\b(const|let|var|function)\s+[\w$]+\s*=[^;]*$/.test(head)) return;
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

/* ---- 3. the root index's links ------------------------------------------
 * A root-relative href resolves one of two ways: a rewrite in vercel.json, or a
 * file on disk. Both are checked here, against the same table the dev server
 * reads, so a link cannot pass this and 404 in production. */
console.log('');
console.log('== 3. every link on the root index resolves');
const REPO = path.join(ROOT, '..');
{
  let routes = null;
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(REPO, 'vercel.json'), 'utf8'));
    routes = new Set((cfg.rewrites || []).map(r => r.source));
    // A redirect is a served URL too: /builder is retired but still answers.
    for (const r of cfg.redirects || []) if (!/[(*?[\\]/.test(r.source)) routes.add(r.source);
  } catch (e) {
    fail(`vercel.json would not parse, so no link on the index can be checked: ${e.message}`);
  }

  const index = path.join(REPO, 'index.html');
  if (routes && !fs.existsSync(index)) {
    fail('there is no index.html at the repo root — the site has no front door');
  } else if (routes) {
    const src = fs.readFileSync(index, 'utf8');
    const links = [...new Set([...src.matchAll(/href="(\/[^"#]*)"/g)].map(m => m[1]))];
    for (const href of links) {
      const clean = href.split('?')[0];
      if (routes.has(clean)) continue;
      if (fs.existsSync(path.join(REPO, clean === '/' ? 'index.html' : clean))) continue;
      fail(`index.html links ${href}, which is neither a vercel.json route nor a `
        + `file on disk. Renaming a rewrite means renaming the link with it.`);
    }
    if (!fails) console.log(`  ok    ${links.length} root-relative link(s), every one served`);
  }
}

console.log('');
if (fails) { console.log(`FAIL: ${fails} page claim(s) no longer true`); process.exit(1); }
console.log('PASS: every page loads every molecule it names, '
  + 'every proton hop removes its source, '
  + 'and every link on the root index is served');
