/* =====================================================================
 *  questions-io.js — read, validate and rewrite demos/questions.js.
 *
 *  The one place that knows the file's shape. Two callers, and they must
 *  not drift: `check-map.js` audits the bank, and the dev server's
 *  /api/questions writes it for `questions-cms.html`. If the CMS could
 *  serialise its own rows, it could write something the checker rejects.
 *
 *  Only the QUESTIONS array is ever rewritten. The header, the CONCEPTS
 *  table and everything else in the file are carried across untouched,
 *  so the prose that states the curation rules cannot be lost to a save.
 * ===================================================================== */
'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const FILE = path.resolve(__dirname, '../lib/questions.js');

const OPEN = '  const QUESTIONS = [';
const CLOSE = '\n  ];';

/* ---- reading ---------------------------------------------------------- */

// The file is a classic script, so it is run rather than parsed: the same
// thing the browser does with it, and the only way the ranks and the ids
// come back as values instead of as text to be re-parsed here.
function parse(src) {
  const sandbox = {};
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: 'questions.js' });
  const bank = sandbox.QuestionBank;
  if (!bank || !bank.CONCEPTS || !bank.QUESTIONS) {
    throw new Error('questions.js ran but exposed no QuestionBank');
  }
  return {
    concepts: bank.CONCEPTS,
    rankFor: bank.rankFor,
    rows: bank.QUESTIONS.map(([text, refs, rank, per]) =>
      ({ text, refs: [...refs], rank, per: { ...(per || {}) } })),
  };
}

function read() {
  const src = fs.readFileSync(FILE, 'utf8');
  const { mtimeMs } = fs.statSync(FILE);
  return { src, mtimeMs, ...parse(src) };
}

/* ---- validating -------------------------------------------------------
   Every rule the bank's own header states, in the order a curator would
   hit them. Returns a list of {row, problem}; empty means the rows are
   safe to write. */

function validate(rows, concepts) {
  const ids = new Set(concepts.map(c => c.id));
  const out = [];
  const seen = new Map();

  rows.forEach((r, i) => {
    const at = p => out.push({ row: i, text: r.text, problem: p });
    if (typeof r.text !== 'string' || !r.text.trim()) return at('empty');
    if (!r.text.trim().endsWith('?')) at('not a question');
    if (!Array.isArray(r.refs) || !r.refs.length) at('names no lesson');
    else {
      for (const id of r.refs) if (!ids.has(id)) at('unknown lesson id: ' + id);
      if (new Set(r.refs).size !== r.refs.length) at('names the same lesson twice');
    }
    if (![1, 2, 3].includes(r.rank)) at('rank is not 1, 2 or 3');
    for (const [id, n] of Object.entries(r.per || {})) {
      if (!ids.has(id)) at('per-lesson rank for an unknown lesson: ' + id);
      else if (!r.refs.includes(id)) at('per-lesson rank for ' + id + ', which it does not name');
      if (![1, 2, 3].includes(n)) at('per-lesson rank for ' + id + ' is not 1, 2 or 3');
    }

    const key = r.text.trim().toLowerCase();
    if (seen.has(key)) at('duplicate of row ' + seen.get(key));
    else seen.set(key, i);
  });

  return out;
}

/* ---- writing ---------------------------------------------------------- */

const quote = s => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";

// The refs are padded onto a column where the question is short enough to
// allow it, which is how the file was written by hand — a save that dropped
// the alignment would show up as 62 changed lines in the diff.
const COLUMN = 63;   // where the refs start on a hand-written row

function serialise(rows) {
  return rows.map(r => {
    const head = '    [' + quote(r.text) + ',';
    const pad = ' '.repeat(Math.max(1, COLUMN - head.length));
    // An override equal to the plain rank is not written: it says nothing, and
    // a file full of them would hide the ones that mean something.
    const per = Object.entries(r.per || {})
      .filter(([id, n]) => r.refs.includes(id) && n !== r.rank)
      .sort(([a], [b]) => a.localeCompare(b));
    const tail = per.length
      ? ', { ' + per.map(([id, n]) => id + ': ' + n).join(', ') + ' }'
      : '';
    return head + pad + '[' + r.refs.map(quote).join(',') + '], ' + r.rank + tail + '],';
  }).join('\n');
}

function splice(src, rows) {
  const open = src.indexOf(OPEN);
  if (open < 0) throw new Error('questions.js has no QUESTIONS array to replace');
  const from = open + OPEN.length;
  const close = src.indexOf(CLOSE, from);
  if (close < 0) throw new Error('the QUESTIONS array is not closed as expected');
  return src.slice(0, from) + '\n' + serialise(rows) + src.slice(close);
}

/* Writes only if the file has not moved since the caller read it, so a save
 * from the CMS cannot land on top of an edit made in the editor meanwhile.
 * Pass `since: null` to skip the check deliberately. Written to a sibling
 * temp file and renamed, so a crash mid-write cannot leave half a bank. */
function write(rows, { since } = {}) {
  const current = read();
  if (since != null && Math.abs(current.mtimeMs - since) > 1) {
    const e = new Error('questions.js changed on disk since it was loaded');
    e.code = 'STALE';
    throw e;
  }
  const problems = validate(rows, current.concepts);
  if (problems.length) {
    const e = new Error(problems.length + ' row(s) would not pass the checker');
    e.code = 'INVALID';
    e.problems = problems;
    throw e;
  }

  const next = splice(current.src, rows);
  parse(next);                      // it must still run before it is kept
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, next);
  fs.renameSync(tmp, FILE);
  return { mtimeMs: fs.statSync(FILE).mtimeMs, rows: rows.length };
}

module.exports = { FILE, read, parse, validate, serialise, splice, write };
