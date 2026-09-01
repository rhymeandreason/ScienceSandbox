/* =====================================================================
 *  panel.js — the one window's behaviour: fill it, preview it, save it.
 *
 *  Talks to the dev server's /api/images, which lives in
 *  tools/dev-server.js and nowhere else. So this extension can only work
 *  on a machine running that server, exactly like clip-shelf.html.
 *
 *  A save is two calls, in this order: ingest writes the file and hands
 *  back a row, then the row is appended to what is on disk under an mtime
 *  guard. Ingest first, because the row it returns carries the measured
 *  width, height and byte count — numbers nothing here should be typing.
 *
 *  With the server down, the form is kept and replayed later. The image
 *  is still at its URL; the only thing lost is the order clips land in.
 * ===================================================================== */
'use strict';

const API = 'http://localhost:8817/api/images';

const $ = id => document.getElementById(id);
const slugify = s => String(s || '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);

let pending = null;

/* ---- the form --------------------------------------------------------- */

function fields() {
  return {
    url: pending.src,
    page: pending.page || '',
    title: $('title').value.trim(),
    caption: $('caption').value.trim(),
    credit: $('credit').value.trim(),
    license: $('license').value.trim(),
    fit: $('fit').value,
    maxWidth: Number($('maxWidth').value) || 1024,
  };
}

/* The filename, live, while the title is being typed. It is the whole
   reason the title field is first: five cristae images clipped in a row
   become -2 and -3, and the moment to notice that is now, not the day one
   of them has to be found again. */
function refreshName() {
  const slug = slugify($('title').value);
  // No extension: it is decided by the Content-Type the source serves, so
  // printing one here would be a guess shown as a fact. The save line reports
  // the real one.
  $('filename').textContent = slug ? 'nodegraph/images/' + slug : '';
}

function applyFit() {
  const fit = $('fit').value;
  $('crop').style.objectFit = fit;
}

/* ---- the wire --------------------------------------------------------- */

async function post(body) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.error || 'the server answered ' + res.status);
  return out;
}

async function commit(form) {
  const { row } = await post({ action: 'ingest', ...form });

  // Re-read rather than cache: the registry is a file on disk that a
  // checkout, an editor or another clip may have moved under us.
  const res = await fetch(API);
  if (!res.ok) throw new Error('could not read the registry back');
  const { rows, mtimeMs } = await res.json();

  await post({ rows: rows.concat(row), mtimeMs });
  return row;
}

/* ---- the queue -------------------------------------------------------- */

const isOffline = e => e instanceof TypeError;   // fetch could not reach it at all

async function queue(form) {
  const { queue = [] } = await chrome.storage.local.get('queue');
  queue.push(form);
  await chrome.storage.local.set({ queue });
  return queue.length;
}

async function flush() {
  const { queue = [] } = await chrome.storage.local.get('queue');
  if (!queue.length) return;

  const left = [];
  let done = 0;
  for (const form of queue) {
    try { await commit(form); done++; }
    catch (e) {
      // A rejection is the clip's own problem and replaying will not fix
      // it, so it is dropped rather than retried forever. Offline keeps it.
      if (isOffline(e)) left.push(form);
    }
  }
  await chrome.storage.local.set({ queue: left });

  const q = $('queued');
  if (done || left.length) {
    q.hidden = false;
    q.textContent = [
      done ? done + ' queued clip(s) saved' : '',
      left.length ? left.length + ' still waiting for the dev server' : '',
    ].filter(Boolean).join(' · ');
  }
}

/* ---- go --------------------------------------------------------------- */

async function start() {
  const got = await chrome.storage.local.get('pending');
  pending = got.pending;
  if (!pending) { $('status').textContent = 'nothing to clip'; return; }
  await chrome.storage.local.remove('pending');

  $('shot').src = pending.src;
  $('crop').src = pending.src;
  $('src').textContent = pending.page || pending.src;

  $('title').value = pending.title || '';
  $('caption').value = pending.caption || '';
  $('credit').value = pending.credit || '';
  $('license').value = pending.license || '';
  refreshName();
  applyFit();
  $('title').focus();
  $('title').select();

  flush();
}

$('title').addEventListener('input', refreshName);
$('fit').addEventListener('change', applyFit);
$('close').addEventListener('click', () => window.close());

$('save').addEventListener('click', async () => {
  const form = fields();
  if (!form.title) { $('status').className = 'status bad';
                     $('status').textContent = 'needs a title'; return; }

  $('save').disabled = true;
  $('status').className = 'status';
  $('status').textContent = 'fetching…';
  try {
    const row = await commit(form);
    $('status').className = 'status good';
    $('status').textContent = `${row.slug}.${row.ext} · ${row.w}×${row.h} · `
      + `${Math.round(row.bytes / 1024)} KB`;
    setTimeout(() => window.close(), 900);
  } catch (e) {
    $('save').disabled = false;
    $('status').className = 'status bad';
    if (isOffline(e)) {
      const n = await queue(form);
      $('status').textContent = `dev server is down — queued (${n})`;
    } else {
      $('status').textContent = e.message;
    }
  }
});

start();
