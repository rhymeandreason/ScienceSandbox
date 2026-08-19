#!/usr/bin/env node
/* =============================================================
 *  reaction/check-reaction.js
 * =============================================================
 * `reaction/reaction.js` is browser-only — it wants THREE, a camera and a DOM
 * — so this does not run it. It reads it, and asserts the things that broke
 * when the verbs lived in the page and nothing checked them:
 *
 *   1. EVERY `fx:` A LESSON NAMES IS A REGISTERED VERB. The old chain ended in
 *      a bare `else`, so a typo'd verb was a silent 280 ms swap: the step ran,
 *      the ledger moved, and the animation the whole step was about simply did
 *      not happen. There is nothing on screen that says "that string was
 *      wrong".
 *   2. NO VERB IS BOTH `lane` AND `whole`. The module's one structural claim
 *      is that a reaction happens to a molecule and only the lane count is a
 *      stage fact; a verb answering both would be the duplication coming back
 *      through a different door.
 *   3. EXACTLY ONE VERB IS `whole`. If a second appears, the claim above has
 *      stopped being true and this file is the place to argue about it — not
 *      a page that quietly grew a second special case.
 *   4. NO VERB READS A LESSON'S STATE. `done`, `busy`, `intro`, `lanes` and
 *      the tray belong to the page; a verb reaching for one is the module
 *      growing lesson physics (SCIENCE.md §6).
 *
 * `node reaction/check-reaction.js`, offline, no dependencies.
 */
'use strict';
const fs = require('fs'), path = require('path');

const HERE = __dirname, ROOT = path.join(HERE, '..');
const SRC = fs.readFileSync(path.join(HERE, 'reaction.js'), 'utf8');

let fails = 0;
const fail = m => { fails++; console.log(`  FAIL  ${m}`); };
const ok = m => console.log(`  ok    ${m}`);

/* ---- the verb table, read out of the source ------------------------- */
// `verb('name', {…})` is the only way one is registered, which is what makes
// the table readable without running the module.
const VERBS = [...SRC.matchAll(/\bverb\(\s*'([a-z]+)'\s*,\s*\{/g)].map(m => m[1]);

console.log('== 1. every fx a lesson names is a registered verb');
if (!VERBS.length) fail('no verbs found — has verb() been renamed?');

// Which pages drive the module. Widen alongside any new one.
const PAGES = ['glycolysis-lab.html'];
let named = 0;
for (const page of PAGES) {
  const src = fs.readFileSync(path.join(ROOT, page), 'utf8');
  if (!/reaction\/reaction\.js/.test(src)) { fail(`${page} does not load the module`); continue; }
  // Only the step table's own `fx:` — a string in prose is not a claim.
  const fxs = [...src.matchAll(/\bfx\s*:\s*'([a-z]+)'/g)].map(m => m[1]);
  const seen = new Set();
  fxs.forEach(f => {
    named++;
    if (!VERBS.includes(f))
      fail(`${page} names fx:'${f}', which no verb registers — the step would `
         + `run as a plain swap with no animation and nothing would say so`);
    seen.add(f);
  });
  // …and the other direction, as a note rather than a failure: a verb no
  // lesson uses is not wrong (the next lesson may want it), but an unused
  // verb is untested by anything, so it should be said out loud.
  const idle = VERBS.filter(v => !seen.has(v));
  if (idle.length) console.log(`  note  ${page} uses ${seen.size}/${VERBS.length} verbs; `
    + `idle: ${idle.join(', ')}`);
}
if (!fails) ok(`${named} fx name(s) across ${PAGES.length} page(s), all registered`);

console.log('\n== 2. a verb is a per-lane body, or the one that is not');
// Each verb's body, from its `verb('x', {` to the next one (or the end of the
// table). Crude, and enough: these are flat object literals in source order.
const bodies = {};
VERBS.forEach((v, i) => {
  const start = SRC.search(new RegExp(`\\bverb\\(\\s*'${v}'`));
  const nextV = VERBS[i + 1];
  const end = nextV ? SRC.search(new RegExp(`\\bverb\\(\\s*'${nextV}'`)) : SRC.length;
  bodies[v] = SRC.slice(start, end);
});
const hasLane  = v => /\blane\s*\(\s*c\s*\)\s*\{/.test(bodies[v]);
const hasWhole = v => /\bwhole\s*\(\s*c\s*\)\s*\{/.test(bodies[v]);

VERBS.forEach(v => {
  if (hasLane(v) && hasWhole(v))
    fail(`verb '${v}' defines both lane() and whole() — pick one. A reaction `
       + `happens to a molecule; only the lane COUNT is a stage fact.`);
  if (!hasLane(v) && !hasWhole(v))
    fail(`verb '${v}' defines neither lane() nor whole() — nothing would run.`);
});
const wholes = VERBS.filter(hasWhole);
if (wholes.length !== 1)
  fail(`${wholes.length} verb(s) are whole-stage (${wholes.join(', ') || 'none'}), `
     + `expected exactly one. The module's structural claim is that every verb `
     + `except the one about lane COUNT is a per-lane body — if that has `
     + `stopped being true, argue it here before adding the second.`);
else ok(`${VERBS.length} verbs: ${VERBS.length - 1} per-lane, '${wholes[0]}' whole-stage`);

console.log('\n== 3. no verb reads a lesson\'s state');
/* The module reaches the page through `host` and nothing else. These are
 * glycolysis-lab's own names; a verb using one has taken a lesson's physics
 * into the shared layer, which is the thing SCIENCE.md §6 exists to stop. */
const LESSON_STATE = /\b(done|busy|intro|reviewing|laneDone|platesOff|nSteps|STEPS|stepAt|speciesAt|refresh)\b/;
VERBS.forEach(v => {
  // strip comments — these words are discussed in the prose on purpose
  const code = bodies[v].replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const m = code.match(LESSON_STATE);
  if (m) fail(`verb '${v}' reads '${m[1]}', which is a lesson's state. `
            + `Ask the host a question about the STAGE instead.`);
});
if (!fails) ok('every verb talks to the stage through host, and to nothing else');

console.log('');
if (fails) { console.log(`FAIL: ${fails} claim(s) no longer true`); process.exit(1); }
console.log('PASS: the verb table is complete, per-lane, and free of lesson state');
