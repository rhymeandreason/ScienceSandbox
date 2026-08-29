/* =====================================================================
 *  mapcontent-io.js — read, validate and rewrite demos/lib/mapcontent.js.
 *
 *  The one place that knows the file's shape, and the same shape
 *  questions-io.js has for the older bank: run the file rather than parse
 *  it, validate every rule its header states, splice ONE array back in.
 *
 *  Two arrays are rewritable, QUESTIONS and CONCEPTS, and each is spliced
 *  on its own. The header, DOORS and VIEWS are carried across untouched,
 *  so the prose that states the curation rules cannot be lost to a save.
 *
 *  A save that carries only one of them leaves the other exactly as it was
 *  on disk: the CMS edits questions and concepts on separate screens, and
 *  saving one must not write back a stale copy of the other.
 * ===================================================================== */
'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const FILE = path.resolve(__dirname, '../lib/mapcontent.js');

const Q_OPEN = '  const QUESTIONS = [';
const C_OPEN = '  const CONCEPTS = [';
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
  if (!c || !c.CONCEPTS || !c.QUESTIONS || !c.DOORS) {
    throw new Error('mapcontent.js ran but exposed no MapContent');
  }
  return {
    doors: c.DOORS,
    views: c.VIEWS || {},
    // Copied rather than handed over, so a caller mutating what it got back
    // cannot reach into the parsed file and change it underneath.
    rows: c.QUESTIONS.map(([text, ranks]) => ({ text, concepts: { ...ranks } })),
    concepts: c.CONCEPTS.map(m => ({ ...m })),
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

   A question naming ONE concept is NOT an error. 28 of them do, the header
   says so, and clearing that backlog is the editorial work — a validator
   that refused them would make the file unsavable before the work starts.
   `crossings()` below is how the CMS shows it instead. */

/* CONCEPTS. Fewer rules than the questions have, and each of them is a way the
 * map breaks rather than a matter of taste: a door with no rank 1 concept opens
 * on nothing, a rank outside 1-3 is a band the reveal never asks for, and an id
 * that changes orphans every question naming it. That last one is why the CMS
 * does not offer to edit an id. */
function validateConcepts(concepts, doors, rows) {
  const doorIds = new Set(doors.map(d => d.id));
  const out = [];
  const seen = new Map();

  concepts.forEach((m, i) => {
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

  /* AN ALTERNATE THAT TWO CARDS CLAIM IS A COIN TOSS. `cardNamed()` returns the
     FIRST match, so a word on two cards routes by table order and looks like a
     considered answer. Names count too: an alt that repeats another card's name
     shadows it, which is the same bug with a worse symptom.

     A cheap normalise, not the composer's: this catches what an author actually
     does twice, which is type the same word on two rows. The composer also
     de-pluralises, so `pump` there and `pumps` here would slip past — that is a
     known gap and not worth a second copy of `norm` drifting from the first. */
  const flat = t => String(t).toLowerCase().replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ').trim();
  const claimed = new Map();
  const label = m => m.name || m.id;
  concepts.forEach((m, i) => {
    const words = [[flat(m.name), true], ...String(m.alt || '').split('·').map(w => [flat(w), false])]
      .filter(([w]) => w);
    for (const [w, isName] of words) {
      const prev = claimed.get(w);
      if (prev === undefined || prev.i === i) { claimed.set(w, { i, isName }); continue; }
      /* Neither row is the offender — the checker cannot know which card the
         word belongs to — so it names BOTH and leaves the choice to the author.
         Reported on the later row only, because saying it twice reads as two
         problems when there is one. */
      const other = concepts[prev.i];
      out.push({ row: i, text: label(m),
                 problem: '“' + w + '” is on two cards, ' + label(other)
                        + (prev.isName ? ' (its name)' : '') + ' and ' + label(m)
                        + (isName ? ' (its name)' : '')
                        + ' — first match wins, so one of them has to go' });
    }
  });

  // An OPEN door has to open on something. A door nothing points at is fine —
  // it is a door not yet written — but one that is open and has no rank 1
  // concept renders as an empty screen with no error.
  for (const d of doors) {
    if (!d.open) continue;
    const mine = concepts.filter(m => m.door === d.id);
    if (!mine.length) continue;
    if (!mine.some(m => m.rank === 1)) {
      out.push({ row: -1, text: d.name || d.id,
                 problem: 'is open but no concept on it is rank 1, so it opens on nothing' });
    }
  }

  // A question pointing at an id no concept defines loses that edge silently —
  // the map drops it rather than throwing. Renaming or removing a concept is
  // where that happens, so it is caught here rather than in the questions.
  const ids = new Set(concepts.map(m => m.id));
  for (const r of rows || []) {
    for (const id of Object.keys(r.concepts || {})) {
      if (!ids.has(id)) {
        out.push({ row: -1, text: r.text,
                   problem: 'names ' + id + ', which no concept defines any more' });
      }
    }
  }

  return out;
}

function validate(rows, concepts) {
  const ids = new Set(concepts.map(m => m.id));
  const out = [];
  const seen = new Map();

  rows.forEach((r, i) => {
    const at = p => out.push({ row: i, text: r.text, problem: p });
    if (typeof r.text !== 'string' || !r.text.trim()) return at('empty');
    if (!r.text.trim().endsWith('?')) at('not a question');

    const edges = Object.entries(r.concepts || {});
    if (!edges.length) at('names no concept');
    for (const [id, rank] of edges) {
      if (!ids.has(id)) at('unknown concept id: ' + id);
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

/* How many concepts a question joins, and how many DOORS those sit on. One
 * concept is a caption; two or more is a crossing; two or more doors is the
 * crossing the whole map exists for. Derived here rather than in the CMS so
 * the page and any checker count it the same way. */
function crossings(rows, concepts) {
  const doorOf = new Map(concepts.map(m => [m.id, m.door]));
  return rows.map(r => {
    const ids = Object.keys(r.concepts || {}).filter(id => doorOf.has(id));
    const doors = new Set(ids.map(id => doorOf.get(id)));
    return { concepts: ids.length, doors: doors.size };
  });
}

/* ---- writing ---------------------------------------------------------- */

const quote = s => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";

// The edge map is padded onto a column where the question is short enough to
// allow it, which is how the file was baked — a save that dropped the alignment
// would show up as 63 changed lines in the diff.
const COLUMN = 64;

function serialise(rows) {
  return rows.map(r => {
    const head = '    [' + quote(r.text) + ',';
    const pad = ' '.repeat(Math.max(1, COLUMN - head.length));
    const edges = Object.entries(r.concepts || {})
      .map(([id, rank]) => id + ':' + rank).join(', ');
    return head + pad + '{ ' + edges + ' }],';
  }).join('\n');
}

/* A concept is two lines, the second one the claim, because a claim runs to 89
 * characters and putting it on the first would make every row wrap differently.
 * Optional fields are written only when set, so a concept with no host does not
 * carry an empty one. */
function serialiseConcepts(concepts) {
  return concepts.map(m => {
    const bits = ['id:' + quote(m.id), 'name:' + quote(m.name), 'door:' + quote(m.door),
                  'rank:' + m.rank, 'state:' + quote(m.state)];
    if (m.away) bits.push('away:1');
    if (m.host) bits.push('host:' + quote(m.host));
    // Its own line: an alt list runs long and would wrap the first one.
    const alt = m.alt ? '\n      alt:' + quote(m.alt) + ',' : '';
    return '    { ' + bits.join(', ') + ',' + alt + '\n      claim:' + quote(m.claim) + ' },';
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
const spliceConcepts = (src, cs) => spliceAt(src, C_OPEN, serialiseConcepts(cs), 'CONCEPTS');

/* Writes only if the file has not moved since the caller read it, so a save
 * from the CMS cannot land on top of an edit made in the editor meanwhile.
 * Pass `since: null` to skip the check deliberately. Written to a sibling temp
 * file and renamed, so a crash mid-write cannot leave half a map. */
function write({ rows, concepts, since } = {}) {
  const current = read();
  if (since != null && Math.abs(current.mtimeMs - since) > 1) {
    const e = new Error('mapcontent.js changed on disk since it was loaded');
    e.code = 'STALE';
    throw e;
  }
  // Whichever half the caller did not send is the file's own, so saving one
  // screen never writes back a stale copy of the other.
  const nextRows = rows || current.rows;
  const nextConcepts = concepts || current.concepts;

  // Both are validated whichever was sent: a concept edit can orphan a question
  // that names it, and a question edit can name a concept that has gone, so the
  // pair has to be checked together or the save is only half-checked.
  const problems = validate(nextRows, nextConcepts)
    .concat(validateConcepts(nextConcepts, current.doors, nextRows));
  if (problems.length) {
    const e = new Error(problems.length + ' row(s) would not pass the checker');
    e.code = 'INVALID';
    e.problems = problems;
    throw e;
  }

  let next = current.src;
  if (concepts) next = spliceConcepts(next, nextConcepts);
  if (rows) next = splice(next, nextRows);
  parse(next);                      // it must still run before it is kept
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, next);
  fs.renameSync(tmp, FILE);
  return { mtimeMs: fs.statSync(FILE).mtimeMs,
           rows: nextRows.length, concepts: nextConcepts.length };
}

module.exports = { FILE, read, parse, validate, validateConcepts, crossings,
                   serialise, serialiseConcepts, splice, spliceConcepts, write };
