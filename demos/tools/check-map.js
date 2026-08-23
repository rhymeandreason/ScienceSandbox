#!/usr/bin/env node
/* =====================================================================
 *  check-map.js — audit the question bank.
 *
 *  Run:  node tools/check-map.js       (exits non-zero on an error)
 *
 *  Two tiers, because they mean different things:
 *
 *    ERRORS are rows that would misbehave silently. A dead lesson id is
 *    the reason this exists — the consumer drops an unknown id rather
 *    than throwing (`if (!byId[r]) continue`), so a typo costs the
 *    question an edge and says nothing at all.
 *
 *    NOTES are curation, not correctness: a lesson almost nothing asks
 *    about, or a card whose fan opens with no rank 1. Neither is wrong,
 *    and both are what a curator wants to see before writing more
 *    questions, so they never fail the run.
 *
 *  The rules live in questions-io.js, which the CMS writes through, so
 *  the tool cannot save something this would reject.
 * ===================================================================== */
'use strict';

const io = require('./questions-io.js');

const { rows, concepts, rankFor } = io.read();
const at = (r, id) => rankFor([r.text, r.refs, r.rank, r.per], id);
const problems = io.validate(rows, concepts);

console.log(`== the bank: ${rows.length} questions over ${concepts.length} lessons`);

for (const p of problems) {
  console.log(`  FAIL  row ${p.row + 1}: ${p.problem}\n        ${p.text.slice(0, 68)}`);
}
if (!problems.length) console.log('  ok    every row is a question, names a real lesson, and is ranked 1-3');

/* ---- notes ------------------------------------------------------------ */

console.log('\n== per lesson');

const notes = [];
const THIN = 3;

for (const c of concepts) {
  const fan = rows.filter(r => r.refs.includes(c.id));
  // Counted the way the card reads it: a per-lesson rank wins here.
  const ranks = [1, 2, 3].map(n => fan.filter(r => at(r, c.id) === n).length);
  const flag = !fan.length ? 'nothing asks about it'
             : fan.length < THIN ? `only ${fan.length}`
             : !ranks[0] ? 'no rank 1 — the card opens on a follow-up'
             : '';
  if (flag) notes.push(`${c.name}: ${flag}`);
  console.log(`  ${flag ? 'note' : 'ok  '}  ${(c.featured ? '★ ' : '  ') + c.name.padEnd(22)} ${String(fan.length).padStart(2)} questions` +
              `  (rank 1/2/3: ${ranks.join('/')})${flag ? '  ← ' + flag : ''}`);
}

const spread = [1, 2, 3].map(n => `${n}: ${rows.filter(r => r.rank === n).length}`).join(' · ');
const over = rows.reduce((n, r) => n + Object.keys(r.per || {}).length, 0);
console.log(`\n  rank spread — ${spread}` +
            (over ? `  ·  ${over} per-lesson override(s)` : '') +
            `\n  ★ marks a featured lesson`);

if (problems.length) {
  console.log(`\nFAIL: ${problems.length} row(s) need fixing`);
  process.exit(1);
}
console.log(`\nPASS: the bank is consistent${notes.length ? ` (${notes.length} curation note(s) above)` : ''}`);
