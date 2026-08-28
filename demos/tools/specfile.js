/* =====================================================================
 *  specfile.js — write a generated field back into the spec that owns it.
 *
 *  Used by tools/spec2smiles.js and tools/bake-flat2d.js. Not loaded by any
 *  page; Node only.
 *
 *  WHY THIS EXISTS. Both of those tools used to end the same way:
 *
 *      rows.forEach(r => console.log(r));
 *
 *  — print the generated line, and leave a person to paste it into the right
 *  spec in the right `mol-*.js`. That step is where the failures live, and they
 *  are the expensive kind: a `flat2d` pasted onto the wrong spec is not a wrong
 *  picture, it is atoms flying to the wrong places in front of a student, and a
 *  regenerated string nobody pasted looks exactly like one nobody needed to.
 *  check-molecules.js catches some of it (wrong length, wrong scale, overlap,
 *  wrong heavy-atom count) precisely because that hand-off is unreliable.
 *
 *  AND AGENTS WRITE THE CODE HERE. "Copy this 44-element array into the middle
 *  of a 500-line file" is the single worst instruction you can give one: it is
 *  a transcription task, it is expensive in tokens, and a dropped digit in a
 *  coordinate is invisible in review. A tool that edits the file itself turns
 *  that into a command with an exit code.
 *
 *  WHAT IT WILL NOT DO. It replaces a field that is ALREADY THERE and reports
 *  `absent` otherwise, rather than guessing an insertion point. Where a field
 *  goes in a spec is an authoring decision — next to the thing it belongs
 *  with, under the comment that explains it — and a tool inventing a position
 *  would start writing specs nobody chose the shape of. Adding `smiles:''` and
 *  `flat2d:[]` by hand once, so the generator has somewhere to write, is the
 *  right amount of human involvement.
 *
 *  HOW IT FINDS THE FIELD. A spec is written one of TWO ways here, and both
 *  had to be handled — the first version of this file knew only about the
 *  first, and reported three specs "absent" that were plainly there:
 *
 *    · `PREFIX.key = …`      GLYCOLYSIS.nadh={ · COMPARE.atpSkel = s.spec({
 *    · `key: { … }`          a property of the object handed to register(),
 *                            which is how mol-monomers/-solvation/-small are
 *                            written
 *
 *  For the second, the key's own INDENT delimits the block: a sibling spec
 *  starts at the same column, and every nested object inside it (`src:{`,
 *  `pep:{`, `sites:{`) is deeper. That distinction is what keeps a search for
 *  `smiles:` from wandering out of the spec it belongs to.
 *
 *  Textual, not an AST rewrite, because these files are hand-written with
 *  load-bearing comments and a printer would reflow all of it.
 *
 *  Every write is VERIFIED by re-loading the library and deep-comparing the
 *  field against what was asked for. A regex that matched the wrong line
 *  therefore fails loudly here rather than shipping.
 * ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// Start of the block for `key`, and the start of whatever follows it.
function block(src, key) {
  // form 1 — PREFIX.key = …
  const assign = new RegExp(`(^|[^\\w.])[A-Z_]{2,}\\.${key}\\s*=`, 'm');
  let m = assign.exec(src);
  if (m) {
    const from = m.index + m[0].length;
    // The next top-level `PREFIX.` statement ends this one. Matching `[=.]`
    // after the member catches `GLYCOLYSIS.atp.flatMark = …` too, which belongs
    // to the previous spec's paragraph but must not be searched into anyway.
    const rest = /\n\s*[A-Z_]{2,}\.\w+\s*[=.]/g;
    rest.lastIndex = from;
    const n = rest.exec(src);
    return { from, to: n ? n.index : src.length };
  }
  // form 2 — `key: {` as a property of register()'s object literal. The key's
  // indent is the delimiter: siblings share it, nested objects are deeper.
  const prop = new RegExp(`^([ \\t]*)${key}\\s*:\\s*\\{`, 'm');
  m = prop.exec(src);
  if (!m) return null;
  const from = m.index + m[0].length, indent = m[1];
  // ends at the next line starting at that same column — a sibling spec, or
  // the closing brace of the object they all live in
  const sib = new RegExp(`^${indent}(?:\\w|\\}|\\))`, 'gm');
  sib.lastIndex = from;
  const n = sib.exec(src);
  return { from, to: n ? n.index : src.length };
}

/* Replace `field:` inside spec `key` of `file` with `valueText`.
 * Returns 'written' | 'unchanged' | 'absent' | 'ambiguous'. */
function setField(file, key, field, valueText) {
  // `spec.domain` is the bare filename register() stamped on ('mol-krebs.js'),
  // and every domain file lives in lib/. Joining it onto ROOT read the repo
  // root instead and threw ENOENT on the first spec, which took --write out
  // repo-wide when the domain files moved into lib/.
  const p = path.join(ROOT, 'lib', file);
  const src = fs.readFileSync(p, 'utf8');
  const b = block(src, key);
  if (!b) return 'absent';
  const window = src.slice(b.from, b.to);
  // One line, its own indent, ending at the line break — the shape both
  // generators emit and every existing field already has.
  const line = new RegExp(`^([ \\t]*)${field}\\s*:.*$`, 'gm');
  const hits = window.match(line);
  if (!hits) return 'absent';
  if (hits.length > 1) return 'ambiguous';
  const next = window.replace(line, (_, indent) => `${indent}${field}:${valueText},`);
  if (next === window) return 'unchanged';
  fs.writeFileSync(p, src.slice(0, b.from) + next + src.slice(b.to));
  return 'written';
}

/* Re-load the library from disk and confirm the field really is what we asked
 * for. The point of the whole exercise is that nobody has to check by eye. */
function verify(key, field, expected) {
  for (const k of Object.keys(require.cache)) delete require.cache[k];
  const { MOLECULES } = require(path.join(ROOT, 'lib', 'lib-node.js'));
  const got = MOLECULES[key] && MOLECULES[key][field];
  return JSON.stringify(got) === JSON.stringify(expected);
}

/* The whole write path for one field, with its own reporting line.
 *   spec      the spec object (for `.domain`)
 *   expected  the value as it should read back out of the library
 *   valueText the source text to write, without the trailing comma
 * `scaled` re-reads through register(), which multiplies angstrom coordinates
 * by SCALE — so a field register() leaves alone (flat2d) verifies directly,
 * and anything it touches must say so. */
function write(key, spec, field, valueText, expected) {
  if (!spec.domain) return { ok: false, note: 'spec has no domain — cannot place it' };
  const r = setField(spec.domain, key, field, valueText);
  if (r === 'absent')
    return { ok: false, note: `no \`${field}:\` line in ${spec.domain} — add an empty one` };
  if (r === 'ambiguous')
    return { ok: false, note: `more than one \`${field}:\` line inside ${key}` };
  if (expected !== undefined && !verify(key, field, expected))
    return { ok: false, note: `wrote ${field} into ${spec.domain} but it did not read back` };
  return { ok: true, note: r };
}

module.exports = { setField, verify, write, block };
