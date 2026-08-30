/* =====================================================================
 *  clips-io.js — fetch a clip, transcode it, and rewrite
 *  demos/nodegraph/clips.js. The one place that knows the file's shape.
 *
 *  Same contract as questions-io.js and mapcontent-io.js: local only,
 *  mtime-guarded, header prose spliced around, written to a temp file and
 *  renamed. The dev server's /api/clips is the only caller.
 *
 *  giphy.com 403s both its oEmbed endpoint and its page HTML, while the
 *  media CDN serves without complaint. So the id and the pixels come off
 *  the wire and the WORDS do not: title and credit are typed by a human in
 *  clip-shelf.html. That is not a fallback, it is the normal case — most of
 *  these clips carry no attribution on giphy either.
 * ===================================================================== */
'use strict';

const fs = require('fs');
const os = require('os');
const vm = require('vm');
const path = require('path');
const { execFile } = require('child_process');

const FILE = path.resolve(__dirname, '../nodegraph/clips.js');
const DIR  = path.resolve(__dirname, '../nodegraph/clips');

const OPEN  = '  const CLIPS = [';
const CLOSE = '\n  ];';

/* Card thumbs are small and a clip is decorative motion, not a subject to
   be measured. 640 is generous for the largest a thumb ever gets, and it
   keeps a typical giphy clip under a megabyte. */
const MAX_W = 640;
const CRF   = 26;

/* ---- reading ---------------------------------------------------------- */

// Run rather than parse: the same thing the browser does with the file.
function parse(src) {
  const sandbox = {};
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: 'clips.js' });
  if (!sandbox.Clips || !Array.isArray(sandbox.Clips.CLIPS)) {
    throw new Error('clips.js ran but exposed no Clips.CLIPS');
  }
  return sandbox.Clips.CLIPS;
}

function read() {
  const src = fs.readFileSync(FILE, 'utf8');
  const { mtimeMs } = fs.statSync(FILE);
  const rows = parse(src);
  return { src, mtimeMs, rows, orphans: orphans(rows) };
}

/* Files in clips/ that no row names. An ingest writes its media before the
   human decides to keep the row, so an abandoned preview leaves two files
   behind; the shelf shows these so they can be swept. */
function orphans(rows) {
  if (!fs.existsSync(DIR)) return [];
  const named = new Set();
  for (const r of rows) { named.add(r.slug + '.mp4'); named.add(r.slug + '.jpg'); }
  return fs.readdirSync(DIR).filter(f => !f.startsWith('.') && !named.has(f));
}

/* ---- giphy ------------------------------------------------------------ */

/* The id is the last dash-segment of a giphy permalink, which is the only
   part of the page we can get at. Accepts a bare id too, and the /media/
   and i.giphy.com forms, because those are what you get from a right-click
   Copy Image Address rather than from the address bar. */
function giphyId(input) {
  const s = String(input || '').trim();
  if (/^[A-Za-z0-9]{6,}$/.test(s)) return s;
  let u;
  try { u = new URL(s); } catch { return null; }
  if (!/(^|\.)giphy\.com$/.test(u.hostname)) return null;
  const parts = u.pathname.split('/').filter(Boolean);
  const media = parts.indexOf('media');
  if (media >= 0 && parts[media + 1]) {
    // /media/<id>/giphy.mp4, and the channel form /media/<user>/<id>/...
    const tail = parts.slice(media + 1).filter(p => !p.includes('.'));
    return tail[tail.length - 1] || null;
  }
  const last = parts[parts.length - 1] || '';
  const seg = last.split('-').pop();
  return /^[A-Za-z0-9]{6,}$/.test(seg) ? seg : null;
}

const pageUrl = id => 'https://giphy.com/gifs/' + id;
const mediaUrl = id => 'https://media.giphy.com/media/' + id + '/giphy.mp4';

async function download(url, to) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) {
    const e = new Error('giphy answered ' + res.status + ' for ' + url);
    e.code = 'INVALID';
    throw e;
  }
  fs.writeFileSync(to, Buffer.from(await res.arrayBuffer()));
}

/* ---- ffmpeg ----------------------------------------------------------- */

const run = (bin, args) => new Promise((resolve, reject) => {
  execFile(bin, args, { maxBuffer: 1 << 24 }, (err, stdout, stderr) => {
    if (err) {
      const e = new Error(bin + ' failed: ' + String(stderr || err.message).trim().split('\n').pop());
      e.code = 'INVALID';
      return reject(e);
    }
    resolve(stdout);
  });
});

async function probe(file) {
  const out = await run('ffprobe', ['-v', 'error',
    '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height',
    '-show_entries', 'format=duration',
    '-of', 'json', file]);
  const j = JSON.parse(out);
  const s = (j.streams || [])[0] || {};
  return { w: s.width || 0, h: s.height || 0,
           seconds: Math.round((Number(j.format.duration) || 0) * 100) / 100 };
}

/* Re-encoded rather than copied: a giphy mp4 can carry odd dimensions that
   some decoders refuse, has its moov atom at the end (so it will not start
   until fully downloaded), and sometimes an audio track nobody wants on a
   silently autoplaying card. yuv420p because Safari is the browser this is
   tested in. */
async function transcode(src, out, { from, to, maxWidth }) {
  const w = Math.max(64, Math.min(1280, maxWidth || MAX_W));
  const args = ['-y'];
  if (from) args.push('-ss', String(from));
  args.push('-i', src);
  if (to) args.push('-t', String(Math.max(0.1, to - (from || 0))));
  args.push(
    '-an',
    '-vf', `scale='min(${w},iw)':-2:flags=lanczos`,
    '-c:v', 'libx264', '-profile:v', 'main', '-pix_fmt', 'yuv420p',
    '-crf', String(CRF), '-preset', 'slow',
    '-movflags', '+faststart',
    out);
  await run('ffmpeg', args);
}

// The unmounted thumb's still. One frame, from the transcoded file, so the
// timestamp the human picks means the same thing they previewed.
async function poster(src, out, at) {
  await run('ffmpeg', ['-y', '-ss', String(Math.max(0, at || 0)), '-i', src,
    '-frames:v', '1', '-q:v', '3', out]);
}

/* ---- ingest -----------------------------------------------------------
   Writes the media and hands back a row. Does NOT touch clips.js: the
   shelf previews the result at card size first, and only a save commits
   it. */

const slugify = s => String(s || '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);

async function ingest(opts = {}) {
  const bad = m => { const e = new Error(m); e.code = 'INVALID'; throw e; };

  let source = null, id = null, page = '';
  if (opts.file) {
    // A local mp4/gif, for the day the CDN form changes or a clip comes
    // from anywhere else.
    source = path.resolve(opts.file);
    if (!fs.existsSync(source)) bad('no such file: ' + opts.file);
  } else {
    id = giphyId(opts.url);
    if (!id) bad('not a giphy link or id: ' + (opts.url || '(empty)'));
    page = pageUrl(id);
  }

  const slug = slugify(opts.slug || opts.title || id);
  if (!slug) bad('needs a slug');
  if (!opts.replace && read().rows.some(r => r.slug === slug)) {
    bad('slug already taken: ' + slug);
  }

  fs.mkdirSync(DIR, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'clip-'));
  const raw = path.join(tmp, 'raw' + (source ? path.extname(source) : '.mp4'));
  try {
    if (source) fs.copyFileSync(source, raw);
    else await download(mediaUrl(id), raw);

    const mp4 = path.join(DIR, slug + '.mp4');
    const jpg = path.join(DIR, slug + '.jpg');
    await transcode(raw, mp4, { from: opts.in, to: opts.out, maxWidth: opts.maxWidth });
    await poster(mp4, jpg, opts.poster);

    const dims = await probe(mp4);
    return {
      id: 'v:' + slug,
      slug,
      page,
      giphyId: id || null,
      title: opts.title || '',
      caption: opts.caption || '',
      credit: opts.credit || '',
      /* How the clip meets the card's 4:3 thumb. Most giphy clips are square
         or portrait, so `cover` (crop to fill) is the default and `contain`
         (letterbox) is for the ones whose edges carry something. */
      fit: opts.fit === 'contain' ? 'contain' : 'cover',
      ...dims,
      bytes: fs.statSync(mp4).size,
      fetched: new Date().toISOString().slice(0, 10),
    };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

function remove(slug) {
  for (const ext of ['.mp4', '.jpg']) {
    const f = path.join(DIR, slugify(slug) + ext);
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
}

/* ---- validating ------------------------------------------------------- */

function validate(rows) {
  const out = [];
  const seen = new Set();
  rows.forEach((r, i) => {
    const at = p => out.push({ row: i, slug: r.slug, problem: p });
    if (!r.slug || slugify(r.slug) !== r.slug) return at('slug is missing or not filename-safe');
    if (r.id !== 'v:' + r.slug) at('id must be v: + slug');
    if (seen.has(r.slug)) at('duplicate slug'); else seen.add(r.slug);
    if (!r.title) at('needs a title');
    for (const ext of ['.mp4', '.jpg']) {
      if (!fs.existsSync(path.join(DIR, r.slug + ext))) at('missing file: ' + r.slug + ext);
    }
    if (r.page && !/^https:\/\/giphy\.com\//.test(r.page)) at('page is not a giphy permalink');
    if (!(r.w > 0 && r.h > 0)) at('has no dimensions');
    if (r.fit && !['cover', 'contain'].includes(r.fit)) at('fit is not cover or contain');
  });
  return out;
}

/* ---- writing ---------------------------------------------------------- */

const quote = s => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";

const KEYS = ['id', 'slug', 'page', 'giphyId', 'title', 'caption', 'credit',
              'fit', 'w', 'h', 'seconds', 'bytes', 'fetched'];

function serialise(rows) {
  return rows.map(r => {
    const lead = r.caption ? `    /* ${r.caption.replace(/\*\//g, '* /')} */\n` : '';
    // Wrapped rather than one long line: a generated file still gets read,
    // and a 300-column row is a diff nobody can see a change in.
    const parts = KEYS.filter(k => r[k] !== '' && r[k] != null)
      .map(k => k + ': ' + (typeof r[k] === 'number' ? r[k] : quote(r[k])) + ',');
    const lines = [];
    for (const p of parts) {
      if (lines.length && (lines[lines.length - 1] + ' ' + p).length <= 78) {
        lines[lines.length - 1] += ' ' + p;
      } else lines.push('      ' + p);
    }
    return lead + '    {\n' + lines.join('\n') + '\n    },';
  }).join('\n');
}

function splice(src, rows) {
  const open = src.indexOf(OPEN);
  if (open < 0) throw new Error('clips.js has no CLIPS array to replace');
  const from = open + OPEN.length;
  const close = src.indexOf(CLOSE, from);
  if (close < 0) throw new Error('the CLIPS array is not closed as expected');
  return src.slice(0, from) + '\n' + serialise(rows) + src.slice(close);
}

function write(rows, { since } = {}) {
  const current = read();
  if (since != null && Math.abs(current.mtimeMs - since) > 1) {
    const e = new Error('clips.js changed on disk since it was loaded');
    e.code = 'STALE';
    throw e;
  }
  const problems = validate(rows);
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

module.exports = { FILE, DIR, read, parse, validate, serialise, splice, write,
                   ingest, remove, giphyId, slugify, orphans };
