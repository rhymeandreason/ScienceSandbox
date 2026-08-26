#!/usr/bin/env node
/* =====================================================================
 *  bake-vectors.js — every authored question as a vector, once.
 *
 *    node tools/bake-vectors.js            # bake, if anything changed
 *    node tools/bake-vectors.js --check    # exit 1 if stale, embed nothing
 *    node tools/bake-vectors.js --force    # re-embed every row
 *
 *  reads lib/mapcontent.js, writes lib/mapcontent-vectors.json.
 *
 * ---------------------------------------------------------------------
 *  WHY BAKE AT ALL. The corpus changes when a human edits a question,
 *  which is a few times a week at most; the reader's QUERY changes every
 *  keystroke. So the 66 authored texts are embedded here and shipped as
 *  static data, and the one live call a page makes is for the query.
 *  Embedding the bank in the browser would be 66 calls per page load to
 *  learn something that was already true yesterday.
 *
 *  HASHES, NOT JUST VECTORS. map-cms.html rewrites mapcontent.js. A
 *  vector whose question has been reworded is not an error and does not
 *  throw: it routes a reader to the wrong card, confidently. Each row
 *  carries the sha256 of the exact text it was made from, so --check can
 *  say WHICH question drifted, and re-baking re-embeds only those.
 *
 *  SEMANTIC_SIMILARITY, and it matters. This corpus is matched question
 *  against question — same register, same length, symmetric. The
 *  RETRIEVAL_QUERY / RETRIEVAL_DOCUMENT pair is trained for the
 *  asymmetric case (a short query against a long passage) and ranks
 *  measurably worse here. api/find.js MUST embed the query with the same
 *  task type or the two live in different geometries.
 *
 *  256 DIMENSIONS. gemini-embedding-001 is 3072-wide and Matryoshka-
 *  trained, so a prefix is a valid smaller embedding — but only after
 *  re-normalising, which truncation breaks. At 66 rows the retrieval
 *  loss is nil and the file is ~68 KB instead of ~800 KB.
 * ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'lib', 'mapcontent.js');
const DST = path.join(ROOT, 'lib', 'mapcontent-vectors.json');

const MODEL = process.env.EMBED_MODEL || 'gemini-embedding-001';
const DIMS = 256;
const TASK = 'SEMANTIC_SIMILARITY';

const args = new Set(process.argv.slice(2));
const CHECK = args.has('--check');
const FORCE = args.has('--force');

/* The dev server reads .env.local per request rather than at boot; this is a
 * one-shot script, so a plain parse is enough. Nothing here prints a value. */
function env() {
  // demos/ first, then the repo root, which is where the tutor's own lives.
  for (const f of [path.join(ROOT, '.env.local'), path.join(ROOT, '..', '.env.local')]) {
    if (!fs.existsSync(f)) continue;
    for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  }
}

const sha = s => crypto.createHash('sha256').update(s, 'utf8').digest('hex').slice(0, 16);

/* mapcontent.js hands its tables to `this`, which is module.exports here. */
function corpus() {
  const { QUESTIONS, MODULES } = require(SRC).MapContent;
  return QUESTIONS.map(([text, mods]) => ({
    text,
    hash: sha(text),
    mods: Object.keys(mods).filter(id => MODULES.some(m => m.id === id)),
  }));
}

/* Re-normalise after truncating: a Matryoshka prefix is a valid embedding, but
 * the prefix of a unit vector is not itself a unit vector, and every consumer
 * here treats a dot product AS the cosine. */
function unit(v) {
  const n = Math.hypot(...v);
  // 4 decimals: a 256-d unit vector's components sit near 1/16, so this is
  // ~3 significant figures, far finer than anything cosine RANKING resolves,
  // and it is a third off the file.
  return n ? v.map(x => +(x / n).toFixed(4)) : v;
}

async function embed(texts) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY not set (looked at .env.local and the environment)');
  const out = [];
  // Batched, but modestly: the endpoint caps a batch and a 66-row corpus is not
  // worth a backoff loop. One retry, because a cold 503 is the common failure.
  for (let i = 0; i < texts.length; i += 25) {
    const slice = texts.slice(i, i + 25);
    const body = {
      requests: slice.map(t => ({
        model: 'models/' + MODEL,
        content: { parts: [{ text: t }] },
        taskType: TASK,
        outputDimensionality: DIMS,
      })),
    };
    let res, last;
    for (let tries = 0; tries < 2; tries++) {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:batchEmbedContents`,
        { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
          body: JSON.stringify(body) });
      if (res.ok) break;
      last = await res.text();
    }
    if (!res.ok) throw new Error(`embed failed ${res.status}: ${last.slice(0, 300)}`);
    const json = await res.json();
    for (const e of json.embeddings) out.push(unit(e.values));
    process.stderr.write(`  embedded ${Math.min(i + 25, texts.length)}/${texts.length}\n`);
  }
  return out;
}

(async () => {
  env();
  const rows = corpus();
  const old = fs.existsSync(DST) ? JSON.parse(fs.readFileSync(DST, 'utf8')) : { rows: [] };
  const have = new Map(old.rows.map(r => [r.hash, r.v]));

  const stale = rows.filter(r => FORCE || !have.has(r.hash));
  const orphans = old.rows.filter(r => !rows.some(x => x.hash === r.hash));

  if (CHECK) {
    if (!stale.length && !orphans.length) {
      console.log(`ok    ${rows.length} questions, every one baked`);
      process.exit(0);
    }
    console.error(`STALE: ${stale.length} question(s) with no vector, ${orphans.length} orphan(s)`);
    for (const r of stale.slice(0, 8)) console.error('  unbaked: ' + r.text);
    for (const r of orphans.slice(0, 8)) console.error('  orphan:  ' + (r.text || r.hash));
    console.error('\nrun: node tools/bake-vectors.js');
    process.exit(1);
  }

  if (!stale.length && !orphans.length) {
    console.log(`ok    ${rows.length} questions, nothing to re-embed`);
    return;
  }
  console.log(`embedding ${stale.length} of ${rows.length} question(s) with ${MODEL} @ ${DIMS}d`);
  const fresh = stale.length ? await embed(stale.map(r => r.text)) : [];
  stale.forEach((r, i) => have.set(r.hash, fresh[i]));

  const out = {
    model: MODEL, dims: DIMS, task: TASK,
    // Not a date: the file is committed, and a timestamp makes every re-bake a
    // diff even when no vector moved.
    rows: rows.map(r => ({ hash: r.hash, text: r.text, mods: r.mods, v: have.get(r.hash) })),
  };
  fs.writeFileSync(DST, JSON.stringify(out));
  console.log(`wrote ${path.relative(ROOT, DST)}  ${rows.length} rows  ${(fs.statSync(DST).size / 1024).toFixed(0)} KB`);
})().catch(e => { console.error(e.message); process.exitCode = 1; });
