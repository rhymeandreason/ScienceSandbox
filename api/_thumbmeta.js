/* =============================================================================
 *  api/_thumbmeta.js — the words on an app's first card, read out of its source
 * =============================================================================
 *  The shelf draws a card as the scene plus the panel over it, and the panel is
 *  text (`_apps.js`'s `thumb_meta`). The running page is the better source for
 *  that text and the builder's relay sends it from there. This is the other
 *  source: the stored file, which every app has whether or not a capture ever
 *  fired.
 *
 *  SO THE TWO ARE NOT EQUALS, AND THE RUNTIME ONE WINS. A step's `body` may be
 *  a function of ctx, and a step may rewrite the panel in `onEnter`; neither is
 *  visible here, and both are plain in the DOM. This reads what the file says
 *  the first card is, which is right for a page that has never been opened and
 *  a floor under one whose capture failed. `setThumb` overwrites it.
 *
 *  WHAT IT CANNOT SAY IS `scene`. That flag means the stored image holds the
 *  scene and nothing else, which only the capture that took it knows; a card
 *  built from source has words and no claim about the picture beside them.
 *
 *  IT PARSES, IT DOES NOT EVALUATE. The file is a page a model wrote, so
 *  running it to ask it questions is not on the table. The scan tracks strings
 *  and comments so a brace inside either cannot close an object early — the one
 *  known gap is a backtick inside a template literal's ${...}, which no
 *  generated page has yet written and which fails closed, to no words rather
 *  than to wrong ones.
 * ========================================================================== */
'use strict';

/* The index of the closing quote of the string literal opening at `i`. */
function endOfString(s, i) {
  const q = s[i];
  for (i++; i < s.length; i++) {
    if (s[i] === '\\') { i++; continue; }
    if (s[i] === q) return i;
  }
  return s.length;
}

/* The index of the bracket closing the one at `i`, or -1. */
function endOfBracket(s, i) {
  const open = s[i], close = open === '{' ? '}' : ']';
  let depth = 0;
  for (; i < s.length; i++) {
    const c = s[i];
    if (c === '"' || c === "'" || c === '`') { i = endOfString(s, i); continue; }
    if (c === '/' && s[i + 1] === '/') { const n = s.indexOf('\n', i); if (n < 0) return -1; i = n; continue; }
    if (c === '/' && s[i + 1] === '*') { const n = s.indexOf('*/', i); if (n < 0) return -1; i = n + 1; continue; }
    if (c === open) depth++;
    else if (c === close && --depth === 0) return i;
  }
  return -1;
}

/* `name: "…"` at the object's own top level, so a property of the same name
   inside an onEnter body cannot answer for the card. Returns '' when the value
   is anything but a string literal, which is how a `body(ctx)` reads. */
function topString(obj, name) {
  for (let i = 0, depth = 0; i < obj.length; i++) {
    const c = obj[i];
    if (c === '"' || c === "'" || c === '`') { i = endOfString(obj, i); continue; }
    if (c === '/' && obj[i + 1] === '/') { const n = obj.indexOf('\n', i); if (n < 0) break; i = n; continue; }
    if (c === '/' && obj[i + 1] === '*') { const n = obj.indexOf('*/', i); if (n < 0) break; i = n + 1; continue; }
    if (c === '{' || c === '[' || c === '(') { depth++; continue; }
    if (c === '}' || c === ']' || c === ')') { depth--; continue; }
    if (depth !== 1) continue;
    const m = /^(['"]?)([A-Za-z_$][\w$]*)\1\s*:\s*/.exec(obj.slice(i, i + name.length + 24));
    if (!m || m[2] !== name) continue;
    const v = i + m[0].length, q = obj[v];
    if (q !== '"' && q !== "'" && q !== '`') return '';
    return unescape(obj.slice(v + 1, endOfString(obj, v)));
  }
  return '';
}

function unescape(s) {
  return s.replace(/\\(u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|.)/g, (m, g) => {
    if (g[0] === 'u' || g[0] === 'x') return String.fromCharCode(parseInt(g.slice(1), 16));
    return { n: '\n', t: '\t', r: '\r', b: '', f: '', v: '', '0': '' }[g] !== undefined
      ? ({ n: '\n', t: '\t', r: '\r', b: '', f: '', v: '', '0': '' })[g] : g;
  });
}

/* The card carries prose, not markup. */
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", apos: "'", nbsp: ' ', mdash: '—', ndash: '–' };
function text(html, cap) {
  return String(html)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(#?\w+);/g, (m, g) => (ENTITIES[g] !== undefined ? ENTITIES[g]
      : /^#\d+$/.test(g) ? String.fromCharCode(+g.slice(1)) : m))
    .replace(/\s+/g, ' ').trim().slice(0, cap);
}

/* The words on the first card, or null when the file does not declare one.
   Shaped exactly as the relay's own `words()`, so `setThumb` cannot tell them
   apart and the shelf has one thing to draw. */
function fromSource(html) {
  const src = String(html || '');
  if (src.length > 400000) return null;      // not a page this builder wrote

  const create = /\b(?:LessonShell|Sandbox)\s*\.\s*create\s*\(\s*\{/.exec(src);
  if (!create) return null;
  const open = src.indexOf('{', create.index);
  const close = endOfBracket(src, open);
  if (close < 0) return null;
  const opts = src.slice(open, close + 1);

  const steps = /(^|[{,\s])steps\s*:\s*\[/.exec(opts);
  if (!steps) return null;
  const sOpen = opts.indexOf('[', steps.index);
  const sClose = endOfBracket(opts, sOpen);
  if (sClose < 0) return null;
  const list = opts.slice(sOpen, sClose + 1);

  // Every step object at the array's own level: the count is the progress dots,
  // and the first is the card.
  const objs = [];
  for (let i = 1, depth = 0; i < list.length; i++) {
    const c = list[i];
    if (c === '"' || c === "'" || c === '`') { i = endOfString(list, i); continue; }
    if (c === '/' && list[i + 1] === '/') { const n = list.indexOf('\n', i); if (n < 0) break; i = n; continue; }
    if (c === '/' && list[i + 1] === '*') { const n = list.indexOf('*/', i); if (n < 0) break; i = n + 1; continue; }
    if (c === '{' && depth === 0) { const e = endOfBracket(list, i); if (e < 0) break; objs.push(list.slice(i, e + 1)); i = e; continue; }
    if (c === '[' || c === '(') depth++;
    if (c === ']' || c === ')') depth--;
  }
  if (!objs.length) return null;

  const title = text(topString(objs[0], 'title'), 120);
  if (!title) return null;                   // no title, no card worth drawing

  // Which shell the page asked kit/app.js for. Only `steps` wears Back and Next.
  const shell = (/<script[^>]*\bdata-shell\s*=\s*["']([\w-]+)["']/.exec(src) || [])[1] || 'steps';

  return {
    brand:   text(topString(opts, 'brand'), 80)
             || text((/<title[^>]*>([\s\S]*?)<\/title>/i.exec(src) || [])[1] || '', 80),
    eyebrow: text(topString(objs[0], 'eyebrow'), 60),
    title,
    body:    text(topString(objs[0], 'body'), 320),
    steps:   Math.min(objs.length, 24),
    nav:     shell === 'steps',
  };
}

module.exports = { fromSource };
