#!/usr/bin/env node
/* =====================================================================
 *  check-scale.js — audit every component's SCALE block
 *
 *  Run:  node tools/check-scale.js        (exits non-zero on failure)
 *
 *  Why this exists: scale used to be four private conventions and a prose
 *  claim. membrane/membrane.js declared EXAG in code, tree/tree.js and leaf/leaf.js said "the
 *  organism scale" in a header, cell/cutaway.js said "not a scale" in a header,
 *  and Components.md — the only thing the generator's model ever sees —
 *  said nothing at all. Nothing could disagree with anything, because
 *  nothing was comparable.
 *
 *  kit/scale.js makes it comparable and docs/Scale.md is the argument. This
 *  checks the parts a machine can:
 *
 *    1. PRESENT   every component in COMPONENTS exports a SCALE block, and
 *                 rung / form / unit / exag / down are well formed.
 *    2. HANDOFF   every `down` target is a component that exists and sits at
 *                 a LOWER rung. Same rung is an error: it should have been
 *                 one scene, which is the one-scale-family rule. A skipped
 *                 rung is a warning, not an error — cell -> membrane past
 *                 organelle is deliberate, and the point of the warning is
 *                 that it stays deliberate.
 *    3. LENGTHS   a component with `unit: null` declares a render nothing may
 *                 measure, so no field it advertises may be a length, unless
 *                 SCALE.sceneUnits names it as scene units on purpose.
 *    4. REFERENCE Components.md names a rung for every component, and the
 *                 rung it names is the one the code declares.
 *
 *  What it deliberately does NOT check: whether a rung is the RIGHT one.
 *  Nothing here would catch a tissue labelled an organ. That needs a human,
 *  and the enum is short enough that a wrong entry is visible on the page.
 * ===================================================================== */
'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const Ladder = require(path.join(ROOT, 'kit/scale.js'));

/* The components, and what must be loaded before each. A component added to
   the library is added here; that is the enumeration this file is, and a
   missing entry is caught by audit 4 when Components.md grows a section. */
const PRELUDE = ['lib/palette.js', 'lib/molecules.js'];
const COMPONENTS = {
  WaterSim:   'water/watersim.js',
  Proteinbox: 'kit/proteinbox.js',
  Membrane:   'membrane/membrane.js',
  Leaf:       'leaf/leaf.js',
  Tree:       'tree/tree.js',
  Cutaway:    'cell/cutaway.js',
};

const errors = [], warnings = [];
const fail = m => errors.push(m);
const warn = m => warnings.push(m);

/* ---- load them in one sandbox -------------------------------------- */

const sandbox = { console };
sandbox.globalThis = sandbox; sandbox.self = sandbox; sandbox.window = sandbox;
const ctx = vm.createContext(sandbox);
const run = f => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });

PRELUDE.forEach(run);
for (const [name, file] of Object.entries(COMPONENTS)) {
  try { run(file); } catch (e) { fail(`${name}: ${file} would not load under node — ${e.message}`); }
}

/* ---- 1. present and well formed ------------------------------------ */

const SCALES = {};
for (const [name, file] of Object.entries(COMPONENTS)) {
  const S = sandbox[name] && sandbox[name].SCALE;
  if (!S) { fail(`${name} (${file}) exports no SCALE block. See kit/scale.js.`); continue; }
  SCALES[name] = S;
  Ladder.validate(name, S).forEach(fail);
}

/* ---- 2. handoffs go down ------------------------------------------- */

for (const [name, S] of Object.entries(SCALES)) {
  for (const [part, target] of Object.entries(S.down || {})) {
    const T = SCALES[target];
    if (!T) { fail(`${name}.down.${part} hands off to ${target}, which is not a component here.`); continue; }
    if (Ladder.sameScene(S.rung, T.rung)) {
      fail(`${name}.down.${part} hands off to ${target} at the same rung (${S.rung}). ` +
           `Same rung shares a scene; a handoff across nothing is a camera move.`);
      continue;
    }
    if (!Ladder.isBelow(T.rung, S.rung)) {
      fail(`${name}.down.${part} hands off UP, ${S.rung} to ${T.rung}.`);
      continue;
    }
    const gap = Ladder.index(S.rung) - Ladder.index(T.rung);
    if (gap > 1) warn(`${name}.down.${part} skips ${gap - 1} rung(s): ${S.rung} straight to ${T.rung}. ` +
                      `Fine if deliberate; say so in the header.`);
  }
}

/* ---- 3. a null unit means no lengths -------------------------------- */

// The fields a page could print as a length. A component with unit:null that
// advertises one is claiming a measurement of a render that has no scale.
const LENGTHY = /^(size|span|width|height|depth|length|radius|diameter|thickness|distance)$/i;
for (const [name, S] of Object.entries(SCALES)) {
  if (S.unit !== null && S.unit !== undefined) continue;
  const C = sandbox[name];
  let sample = null;
  try { sample = typeof C.state === 'function' ? C.state() : null; } catch (e) { /* needs a scene; fine */ }
  const fields = sample ? Object.keys(sample) : Object.keys(C.DEFAULTS || {});
  const declared = new Set(S.sceneUnits || []);
  for (const f of fields)
    if (LENGTHY.test(f) && !declared.has(f))
      warn(`${name} declares unit:null but advertises "${f}". If that is scene units, ` +
           `list it in SCALE.sceneUnits; if it is metres, unit must not be null.`);
}

/* ---- 4. Components.md agrees ---------------------------------------- */

const REF = path.join(ROOT, 'docs/Components.md');
if (!fs.existsSync(REF)) fail('docs/Components.md is missing.');
else {
  const md = fs.readFileSync(REF, 'utf8');
  // Sections look like:  ## Name — prose
  const sections = [...md.matchAll(/^## ([A-Z][A-Za-z0-9]*) [—-]/gm)].map(m => m[1]);
  for (const name of sections) {
    if (!SCALES[name]) {
      fail(`Components.md has a section for ${name}, which check-scale.js does not know. ` +
           `Add it to COMPONENTS in this file.`);
      continue;
    }
    // The section's own text, up to the next ##.
    const start = md.indexOf(`## ${name} `);
    const next = md.indexOf('\n## ', start + 1);
    const body = md.slice(start, next < 0 ? md.length : next);
    const m = body.match(/\*\*Scale\*\*:\s*([a-z]+)\s*,\s*(single|bulk)/);
    if (!m) {
      fail(`Components.md section "${name}" has no "**Scale**: <rung>, <form>" line. ` +
           `The model only sees this file, so a rung that is not written here does not exist.`);
      continue;
    }
    const S = SCALES[name];
    if (m[1] !== S.rung) fail(`Components.md says ${name} is rung "${m[1]}"; the code says "${S.rung}".`);
    if (m[2] !== S.form) fail(`Components.md says ${name} is form "${m[2]}"; the code says "${S.form}".`);
  }
}

/* ---- report --------------------------------------------------------- */

for (const w of warnings) console.log(`  warn  ${w}`);
if (errors.length) {
  console.log('');
  for (const e of errors) console.log(`  FAIL  ${e}`);
  console.log('');
  console.log(`check-scale.js: ${errors.length} error(s), ${warnings.length} warning(s).`);
  process.exit(1);
}
console.log(`check-scale.js: ${Object.keys(SCALES).length} components, all scales declared` +
            (warnings.length ? `, ${warnings.length} warning(s).` : '.'));
