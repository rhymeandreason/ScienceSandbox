/* =====================================================================
 *  mapcontent-io.js — read, validate and rewrite demos/lib/mapcontent.js.
 *
 *  The one place that knows the file's shape, and the same shape
 *  questions-io.js has for the older bank: run the file rather than parse
 *  it, validate every rule its header states, splice ONE array back in.
 *
 *  Two arrays are rewritable, QUESTIONS and MODULES, and each is spliced
 *  on its own. The header, DOORS and VIEWS are carried across untouched,
 *  so the prose that states the curation rules cannot be lost to a save.
 *
 *  A save that carries only one of them leaves the other exactly as it was
 *  on disk: the CMS edits questions and modules on separate screens, and
 *  saving one must not write back a stale copy of the other.
 * ===================================================================== */
'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const FILE = path.resolve(__dirname, '../lib/mapcontent.js');

const Q_OPEN = '  const QUESTIONS = [';
const M_OPEN = '  const MODULES = [';
const CLOSE = '\n  ];';

/* ---- reading ---------------------------------------------------------- */

// Run, not parse: the same thing the browser does with it, and the only way
// the ranks come back as numbers rather than as text to re-parse here.
function parse(src) {
  const sandbox = {};
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: 'mapcontent.js' });
  const c = sandbox.MapContent;
  if (!c || !c.MODULES || !c.QUESTIONS || !c.DOORS) {
    throw new Error('mapcontent.js ran but exposed no MapContent');
  }
  return {
    doors: c.DOORS,
    modules: c.MODULES,
    views: c.VIEWS || {},
    // Copied rather than handed over, so a caller mutating what it got back
    // cannot reach into the parsed file and change it underneath.
    rows: c.QUESTIONS.map(([text, mods]) => ({ text, mods: { ...mods } })),
    mods: c.MODULES.map(m => ({ ...m })),
  };
}

function read() {
  const src = fs.readFileSync(FILE, 'utf8');
  const { mtimeMs } = fs.statSync(FILE);
  return { src, mtimeMs, ...parse(src) };
}

/* ---- validating -------------------------------------------------------
   Every rule mapcontent.js's own header states, in the order a curator
   would hit them. Returns {row, text, problem}; empty means safe to write.

   A question naming ONE module is NOT an error. 28 of them do, the header
   says so, and clearing that backlog is the editorial work — a validator
   that refused them would make the file unsavable before the work starts.
   `crossings()` below is how the CMS shows it instead. */

/* MODULES. Fewer rules than the questions have, and each of them is a way the
 * map breaks rather than a matter of taste: a door with no rank 1 module opens
 * on nothing, a rank outside 1-3 is a band the reveal never asks for, and an id
 * that changes orphans every question naming it. That last one is why the CMS
 * does not offer to edit an id. */
function validateModules(mods, doors, rows) {
  const doorIds = new Set(doors.map(d => d.id));
  const out = [];
  const seen = new Map();

  mods.forEach((m, i) => {
    const at = p => out.push({ row: i, text: m.name || m.id, problem: p });
    if (!m.id || !/^[a-z][a-z0-9]*$/.test(m.id)) return at('id must be lowercase letters and digits');
    if (seen.has(m.id)) at('duplicate id, already row ' + seen.get(m.id));
    else seen.set(m.id, i);
    if (!m.name || !String(m.name).trim()) at('has no name');
    if (!m.claim || !String(m.claim).trim()) at('has no claim');
    if (!doorIds.has(m.door)) at('unknown door: ' + m.door);
    if (![1, 2, 3].includes(m.rank)) at('rank is not 1, 2 or 3');
    if (!['built', 'engine', 'planned'].includes(m.state)) at('state is not built, engine or planned');
  });

  // An OPEN door has to open on something. A door nothing points at is fine —
  // it is a door not yet written — but one that is open and has no rank 1
  // module renders as an empty screen with no error.
  for (const d of doors) {
    if (!d.open) continue;
    const mine = mods.filter(m => m.door === d.id);
    if (!mine.length) continue;
    if (!mine.some(m => m.rank === 1)) {
      out.push({ row: -1, text: d.name || d.id,
                 problem: 'is open but no module on it is rank 1, so it opens on nothing' });
    }
  }

  // A question pointing at an id no module defines loses that edge silently —
  // the map drops it rather than throwing. Renaming or removing a module is
  // where that happens, so it is caught here rather than in the questions.
  const ids = new Set(mods.map(m => m.id));
  for (const r of rows || []) {
    for (const id of Object.keys(r.mods || {})) {
      if (!ids.has(id)) {
        out.push({ row: -1, text: r.text,
                   problem: 'names ' + id + ', which no module defines any more' });
      }
    }
  }

  return out;
}

function validate(rows, modules) {
  const ids = new Set(modules.map(m => m.id));
  const out = [];
  const seen = new Map();

  rows.forEach((r, i) => {
    const at = p => out.push({ row: i, text: r.text, problem: p });
    if (typeof r.text !== 'string' || !r.text.trim()) return at('empty');
    if (!r.text.trim().endsWith('?')) at('not a question');

    const mods = Object.entries(r.mods || {});
    if (!mods.length) at('names no module');
    for (const [id, rank] of mods) {
      if (!ids.has(id)) at('unknown module id: ' + id);
      if (![1, 2, 3].includes(rank)) at('rank on ' + id + ' is not 1, 2 or 3');
    }

    // Text identity is no longer what joins a question to itself — the row is —
    // but two rows with the same words are two nodes saying one thing, which is
    // the split the question-major shape exists to prevent.
    const key = r.text.trim().toLowerCase();
    if (seen.has(key)) at('duplicate of row ' + seen.get(key));
    else seen.set(key, i);
  });

  return out;
}

/* How many modules a question joins, and how many DOORS those sit on. One
 * module is a caption; two or more is a crossing; two or more doors is the
 * crossing the whole map exists for. Derived here rather than in the CMS so
 * the page and any checker count it the same way. */
function crossings(rows, modules) {
  const doorOf = new Map(modules.map(m => [m.id, m.door]));
  return rows.map(r => {
    const ids = Object.keys(r.mods || {}).filter(id => doorOf.has(id));
    const doors = new Set(ids.map(id => doorOf.get(id)));
    return { mods: ids.length, doors: doors.size };
  });
}

/* ---- writing ---------------------------------------------------------- */

const quote = s => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";

// The mods are padded onto a column where the question is short enough to allow
// it, which is how the file was baked — a save that dropped the alignment would
// show up as 63 changed lines in the diff.
const COLUMN = 64;

function serialise(rows) {
  return rows.map(r => {
    const head = '    [' + quote(r.text) + ',';
    const pad = ' '.repeat(Math.max(1, COLUMN - head.length));
    const mods = Object.entries(r.mods || {})
      .map(([id, rank]) => id + ':' + rank).join(', ');
    return head + pad + '{ ' + mods + ' }],';
  }).join('\n');
}

/* A module is two lines, the second one the claim, because a claim runs to 89
 * characters and putting it on the first would make every row wrap differently.
 * Optional fields are written only when set, so a module with no host does not
 * carry an empty one. */
function serialiseModules(mods) {
  return mods.map(m => {
    const bits = ['id:' + quote(m.id), 'name:' + quote(m.name), 'door:' + quote(m.door),
                  'rank:' + m.rank, 'state:' + quote(m.state)];
    if (m.away) bits.push('away:1');
    if (m.host) bits.push('host:' + quote(m.host));
    return '    { ' + bits.join(', ') + ',\n      claim:' + quote(m.claim) + ' },';
  }).join('\n');
}

function spliceAt(src, open, body, what) {
  const i = src.indexOf(open);
  if (i < 0) throw new Error('mapcontent.js has no ' + what + ' array to replace');
  const from = i + open.length;
  const close = src.indexOf(CLOSE, from);
  if (close < 0) throw new Error('the ' + what + ' array is not closed as expected');
  return src.slice(0, from) + '\n' + body + src.slice(close);
}

const splice = (src, rows) => spliceAt(src, Q_OPEN, serialise(rows), 'QUESTIONS');
const spliceModules = (src, mods) => spliceAt(src, M_OPEN, serialiseModules(mods), 'MODULES');

/* Writes only if the file has not moved since the caller read it, so a save
 * from the CMS cannot land on top of an edit made in the editor meanwhile.
 * Pass `since: null` to skip the check deliberately. Written to a sibling temp
 * file and renamed, so a crash mid-write cannot leave half a map. */
function write({ rows, mods, since } = {}) {
  const current = read();
  if (since != null && Math.abs(current.mtimeMs - since) > 1) {
    const e = new Error('mapcontent.js changed on disk since it was loaded');
    e.code = 'STALE';
    throw e;
  }
  // Whichever half the caller did not send is the file's own, so saving one
  // screen never writes back a stale copy of the other.
  const nextRows = rows || current.rows;
  const nextMods = mods || current.mods;

  // Both are validated whichever was sent: a module edit can orphan a question
  // that names it, and a question edit can name a module that has gone, so the
  // pair has to be checked together or the save is only half-checked.
  const problems = validate(nextRows, nextMods)
    .concat(validateModules(nextMods, current.doors, nextRows));
  if (problems.length) {
    const e = new Error(problems.length + ' row(s) would not pass the checker');
    e.code = 'INVALID';
    e.problems = problems;
    throw e;
  }

  let next = current.src;
  if (mods) next = spliceModules(next, nextMods);
  if (rows) next = splice(next, nextRows);
  parse(next);                      // it must still run before it is kept
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, next);
  fs.renameSync(tmp, FILE);
  return { mtimeMs: fs.statSync(FILE).mtimeMs,
           rows: nextRows.length, mods: nextMods.length };
}

module.exports = { FILE, read, parse, validate, validateModules, crossings,
                   serialise, serialiseModules, splice, spliceModules, write };
