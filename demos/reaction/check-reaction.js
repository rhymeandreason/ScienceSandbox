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
 *   3. ONLY A VERB ABOUT THE LANE COUNT IS `whole`, and the list of them is
 *      written here rather than counted. It was "exactly one" while glycolysis
 *      was the only lesson: `split`, one molecule becoming two. The cycle adds
 *      its mirror — `join`, two becoming one at citrate synthase — and that is
 *      the same claim, not a weakening of it: a reaction happens to a molecule,
 *      and the only thing a verb may own the whole stage for is how many
 *      molecules there are. A third name appearing in this list is the
 *      argument to have; a third whole-stage verb NOT in it is the failure.
 *   4. NO VERB READS A LESSON'S STATE. `done`, `busy`, `intro`, `lanes` and
 *      the tray belong to the page; a verb reaching for one is the module
 *      growing lesson physics (Modules.md).
 *
 * `node reaction/check-reaction.js`, offline, no dependencies.
 */
'use strict';
const fs = require('fs'), path = require('path');

const HERE = __dirname, ROOT = path.join(HERE, '..');
const SRC = fs.readFileSync(path.join(HERE, 'reaction.js'), 'utf8');

let fails = 0;
const fail = m => { fails++; console.log(`  FAIL  ${m}`); };
// PRINTS, and only prints. Most checkers in this repo spell `ok` the other way
// round — ok(cond, what) — so a check written that way here would hand a
// CONDITION to a message parameter and pass forever while asserting nothing.
// Refuse the second argument rather than swallow it; use `is` below.
const ok = (m, ...extra) => { if(extra.length) throw new Error(
  'ok() takes a message, not a condition — use is(cond, msg)'); console.log(`  ok    ${m}`); };
const is = (cond, m) => cond ? ok(m) : fail(m);

/* ---- the verb table, read out of the source ------------------------- */
// `verb('name', {…})` is the only way one is registered, which is what makes
// the table readable without running the module.
const VERBS = [...SRC.matchAll(/\bverb\(\s*'([a-z]+)'\s*,\s*\{/g)].map(m => m[1]);

console.log('== 1. every fx a lesson names is a registered verb');
if (!VERBS.length) fail('no verbs found — has verb() been renamed?');

// Which pages drive the module. Widen alongside any new one.
const PAGES = ['glycolysis-lab.html', 'krebs-lab.html', 'fermentation-lab.html'];
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
// The verbs that are ABOUT the lane count, and may therefore own the stage.
// Both directions of the same event: a molecule splitting, and two joining —
// and `thioester`, which is the second of those wearing a different name: the
// acyl group leaves the sulfur and the step ends with free coenzyme A standing
// beside the acid, two molecules where one was.
const COUNT_VERBS = ['split', 'join', 'thioester'];
const wholes = VERBS.filter(hasWhole);
const stray = wholes.filter(v => !COUNT_VERBS.includes(v));
if (stray.length)
  fail(`verb(s) ${stray.join(', ')} own the whole stage but are not about the `
     + `lane COUNT. Every verb except those is a per-lane body — if that has `
     + `stopped being true, argue it in COUNT_VERBS before adding the next.`);
else ok(`${VERBS.length} verbs: ${VERBS.length - wholes.length} per-lane, `
      + `${wholes.join(' + ')} whole-stage`);

console.log('\n== 3. no verb reads a lesson\'s state');
/* The module reaches the page through `host` and nothing else. These are
 * glycolysis-lab's own names; a verb using one has taken a lesson's physics
 * into the shared layer, which is the thing Modules.md exists to stop. */
const LESSON_STATE = /\b(done|busy|intro|reviewing|laneDone|platesOff|nSteps|STEPS|stepAt|speciesAt|refresh)\b/;
VERBS.forEach(v => {
  // strip comments — these words are discussed in the prose on purpose
  const code = bodies[v].replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const m = code.match(LESSON_STATE);
  if (m) fail(`verb '${v}' reads '${m[1]}', which is a lesson's state. `
            + `Ask the host a question about the STAGE instead.`);
});
if (!fails) ok('every verb talks to the stage through host, and to nothing else');

console.log('\n== 4. the default host answers only STAGE questions');
/* `Reaction.stageHost` exists because both pathway pages had written the same
 * seven forwards by hand. The risk it adds is that the next convenient thing to
 * put in it is an answer only a lesson can give — and nothing on screen would
 * say so, because the page it was lifted from still works. */
{
  // The sections above read this file as TEXT, because the verb bodies are what
  // they are about. This one is about behaviour, so it loads the module — it
  // assigns to globalThis outside a browser and touches no THREE until create().
  require(path.join(__dirname, 'reaction.js'));
  const {Reaction} = globalThis;

  const H = Reaction.stageHost({lanes:{}, carriers:{}});
  const KEYS = ['lanes','laneOrigin','laneBase','plateY','settleLanes',
                'swapLane','spawnLanes','popCarrier'].sort();
  const got = Object.keys(H).sort();
  if (got.join() !== KEYS.join())
    fail(`stageHost answers [${got}], expected [${KEYS}]. Adding one is a claim `
       + `that the answer cannot depend on the lesson — check that it cannot.`);
  else ok(`the default host answers ${got.length} stage questions and no others`);

  // Same rule as the verbs, and the same reason (Modules.md).
  const src = Reaction.stageHost.toString()
                .replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/.*$/gm,'');
  const m = src.match(LESSON_STATE);
  if (m) fail(`stageHost reads '${m[1]}', which is a lesson's state.`);
  else ok('…and it names no lesson state');

  /* RESOLVED LAZILY. Both pages build their carrier column AFTER Reaction.create,
   * so a host that captured the instance would hold undefined in one page and
   * throw on a temporal dead zone in the other — at the first carrier pop, long
   * after load, which is the worst time to find out. */
  let built = null;
  const lazy = Reaction.stageHost({
    lanes:{}, carriers:()=>(built = built || {pop:j=>('popped'+j)}) });
  is(built === null, 'a carriers thunk is not called while the host is built');
  is(lazy.popCarrier(2) === 'popped2', '…and is resolved at the first question');

  /* THE HOOK FIRES ON BOTH LANE-LIST CHANGES. A page re-solves its camera fit
   * here — a different fit per page, which is why this hook exists instead of a
   * decision — and a swap that skipped it left the framing solved for molecules
   * that are no longer on stage. */
  let fired = 0;
  const fake = { swapOne(){}, render(){}, plateY:()=>0, settle(){},
                 origin:()=>1, base:()=>2, get lanes(){ return ['L']; } };
  const hooked = Reaction.stageHost({lanes:fake, carriers:{}, onLanes:()=>fired++});
  hooked.swapLane(0,'x');        is(fired === 1, 'swapLane fires onLanes');
  hooked.spawnLanes(['a'],null); is(fired === 2, 'spawnLanes fires onLanes too');
  hooked.settleLanes();          is(fired === 2, '…and settling, which changes no list, does not');
  is(hooked.lanes()[0] === 'L', 'lanes() reads through to the module, never a cached array');
}

console.log('');
if (fails) { console.log(`FAIL: ${fails} claim(s) no longer true`); process.exit(1); }
console.log('PASS: the verb table is complete, per-lane, and free of lesson state');
