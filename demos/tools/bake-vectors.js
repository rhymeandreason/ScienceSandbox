#!/usr/bin/env node
/* =====================================================================
 *  bake-vectors.js — the map's searchable text as vectors, once:
 *  every authored QUESTION, and every concept's own CLAIM.
 *
 *    node tools/bake-vectors.js            # bake, if anything changed
 *    node tools/bake-vectors.js --check    # exit 1 if stale, embed nothing
 *    node tools/bake-vectors.js --force    # re-embed every row
 *
 *  reads lib/mapcontent.js, writes lib/mapcontent-vectors.json.
 *
 * ---------------------------------------------------------------------
 *  WHY BAKE AT ALL. The corpus changes when a human edits a question or
 *  a claim, which is a few times a week at most; the reader's QUERY changes
 *  every keystroke. So the authored texts are embedded here and shipped as
 *  static data, and the one live call a page makes is for the query.
 *  Embedding the bank in the browser would be one call per row per page load
 *  to learn something that was already true yesterday.
 *
 *  HASHES, NOT JUST VECTORS. map-cms.html rewrites mapcontent.js. A
 *  vector whose text has been reworded is not an error and does not
 *  throw: it routes a reader to the wrong card, confidently. Each row
 *  carries the sha256 of the exact text it was made from, so --check can
 *  say WHICH row drifted, and re-baking re-embeds only those. A claim row's
 *  text is `Name. claim.`, so renaming a concept re-bakes it too.
 *
 *  SEMANTIC_SIMILARITY, and it matters. The question rows are matched
 *  question against question — same register, same length, symmetric. The
 *  RETRIEVAL_QUERY / RETRIEVAL_DOCUMENT pair is trained for the
 *  asymmetric case (a short query against a long passage) and ranks
 *  measurably worse here. api/find.js MUST embed the query with the same
 *  task type or the two live in different geometries.
 *
 *  256 DIMENSIONS. gemini-embedding-001 is 3072-wide and Matryoshka-
 *  trained, so a prefix is a valid smaller embedding — but only after
 *  re-normalising, which truncation breaks. At this many rows the retrieval
 *  loss is nil and the file is a tenth the size.
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

/* ---- map integrity ------------------------------------------------------
 * Not about vectors at all, and here because this is the map's only checker.
 *
 * A question names its concepts BY ID, and lib/mapcontent.js is loaded by a page
 * that does `const m = byId[cid]; if (!m) continue;` — so renaming or deleting a
 * concept silently drops every edge pointing at it. The card is still drawn, the
 * question is still drawn, and the crossing between them is simply gone. That is
 * the one thing the map exists to do, and nothing was checking it. */
function integrity() {
  const { DOORS, CONCEPTS, QUESTIONS, CONTENT, PLACEMENTS } = require(SRC).MapContent;
  const ids = new Set(CONCEPTS.map(m => m.id));
  const doors = new Set(DOORS.map(d => d.id));
  const bad = [];

  /* The specimens are the OTHER registry's, and a protein renamed there drops
     its edges here exactly the way a renamed concept id did. Loaded softly: a
     checkout without proteins/ still gets its questions checked. */
  let keys = null, byKey = null;
  try {
    const lib = require(path.join(ROOT, 'proteins/proteins.js'));
    byKey = new Map((lib.PROTEINS || lib.ProteinLib.PROTEINS).map(p => [p.key, p]));
    keys = new Set(byKey.keys());
  } catch (e) {
    console.log('note  proteins/proteins.js did not load; specimen keys unchecked');
  }
  const known = id => id.startsWith('p:')
    ? (keys ? keys.has(id.slice(2)) : true)
    : ids.has(id);

  /* A placement points at two things and either can go missing without a
     symptom: the CONTENT row it places, and the concepts it places it on. A
     `p:` row is the exception — its content lives in the other registry. */
  const CONTENT_IDS = new Set((CONTENT || []).map(c => c.id));
  for (const [cid, ranks, opt] of (PLACEMENTS || [])) {
    if (cid.startsWith('p:')) {
      const key = cid.slice(2);
      if (keys && !keys.has(key)) bad.push(`PLACEMENTS names no such protein \`${cid}\``);
      /* A row exists to pick a placement or a variant, so a variant it names
         has to be there: the page falls back to the default, which draws a
         different deposition than the row asked for and looks entirely
         correct. */
      if (byKey && opt && opt.variant && byKey.has(key)
          && !byKey.get(key).variants.some(v => v.id === opt.variant))
        bad.push(`specimen \`${cid}\` names no such variant \`${opt.variant}\``);
    } else if (!CONTENT_IDS.has(cid)) {
      bad.push(`PLACEMENTS places no such content \`${cid}\``);
    }
    for (const id of Object.keys(ranks))
      if (!ids.has(id)) bad.push(`\`${cid}\` sits under no such concept \`${id}\``);
  }

  /* Content nobody placed is content the map cannot reach — it draws no card
     and appears nowhere, which is invisible from the page. */
  const placedIds = new Set((PLACEMENTS || []).map(([cid]) => cid));
  for (const c of (CONTENT || []))
    if (!placedIds.has(c.id)) bad.push(`content \`${c.id}\` is placed on nothing`);

  /* Every registry entry is drawn now, so a variant with no baked ribbon is a
     protein missing from the map rather than a row somebody left out. */
  if (byKey) for (const p of byKey.values()) {
    const v = p.variants.find(x => x.default) || p.variants[0];
    const ribbon = v && (v.bake ? v.bake.trace : v.read && v.read.baked);
    if (!ribbon) bad.push(`\`${p.key}/${v ? v.id : '?'}\` has no baked ribbon, so the map cannot draw it`);
  }

  for (const [text, ranks] of QUESTIONS)
    for (const id of Object.keys(ranks))
      if (!known(id)) bad.push(`question names no such ${id.startsWith('p:') ? 'protein' : 'concept'} \`${id}\`: ${text}`);

  for (const m of CONCEPTS)
    if (m.door && !doors.has(m.door)) bad.push(`concept \`${m.id}\` sits on no such door \`${m.door}\``);

  // Not a failure: a planned concept with nothing filed under it is a card
  // waiting for questions, which is a normal state to commit. It is no longer
  // an UNREACHABLE card either — its claim is in the corpus on its own.
  const lonely = CONCEPTS.filter(m => !QUESTIONS.some(([, r]) => r[m.id])).map(m => m.id);
  return { bad, lonely };
}

/* mapcontent.js hands its tables to `this`, which is module.exports here.
 *
 * TWO KINDS OF ROW. A question is a CROSSING and is embedded as written. A
 * concept's `claim` is the content itself, embedded as `Name. claim.` — the
 * name is in the vector on purpose, because a concept's name is the one thing
 * a reader types that the question corpus cannot answer (measured: `polarity`
 * scores 0.811 against questions, under every floor, and is the water door's
 * own rank 1 concept).
 *
 * Before this, a concept was reachable ONLY through a question somebody had
 * written for it, so `geometry`, `covalent` and `ionic` — no questions filed —
 * could not be found at all. Content that cannot be retrieved is content that
 * is not in the map.
 *
 * The two kinds sit at DIFFERENT absolute cosines: SEMANTIC_SIMILARITY is
 * symmetric and the question corpus is matched question-to-question, same
 * register, while a claim is a declarative answer to the reader's question.
 * So `kind` is written into every row and the composer floors the two
 * separately. One shared threshold is the wrong shape, not a number to tune. */
function corpus() {
  const { QUESTIONS, CONCEPTS } = require(SRC).MapContent;
  const rows = QUESTIONS.map(([text, ranks]) => ({
    kind: 'q',
    text,
    hash: sha(text),
    concepts: Object.keys(ranks).filter(id => CONCEPTS.some(m => m.id === id)),
  }));
  for (const m of CONCEPTS) {
    if (!m.claim) continue;
    const text = `${m.name}. ${m.claim}`;
    rows.push({ kind: 'claim', text, hash: sha(text), concept: m.id });
  }
  return rows;
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

  const { bad, lonely } = integrity();
  if (lonely.length) console.log(`note  ${lonely.length} concept(s) with no questions: ${lonely.join(', ')}`);
  if (bad.length) {
    // Fails --check, warns a bake: the page reads mapcontent.js live and never
    // reads the `concepts` written here, so a broken reference does not corrupt a
    // vector. It breaks the map, which is worse, and is why it is said either way.
    console.error(`${CHECK ? 'BROKEN' : 'WARNING'}: ${bad.length} bad reference(s) in lib/mapcontent.js`);
    for (const b of bad) console.error('  ' + b);
    if (CHECK) process.exit(1);
  }

  const tally = rows.reduce((a, r) => (a[r.kind] = (a[r.kind] || 0) + 1, a), {});
  const census = `${tally.q || 0} questions + ${tally.claim || 0} claims`;

  if (CHECK) {
    if (!stale.length && !orphans.length) {
      console.log(`ok    ${census}, every one baked`);
      process.exit(0);
    }
    console.error(`STALE: ${stale.length} row(s) with no vector, ${orphans.length} orphan(s)`);
    for (const r of stale.slice(0, 8)) console.error('  unbaked: ' + r.text);
    for (const r of orphans.slice(0, 8)) console.error('  orphan:  ' + (r.text || r.hash));
    console.error('\nrun: node tools/bake-vectors.js');
    process.exit(1);
  }

  if (stale.length) {
    console.log(`embedding ${stale.length} of ${rows.length} row(s) (${census}) with ${MODEL} @ ${DIMS}d`);
    const fresh = await embed(stale.map(r => r.text));
    stale.forEach((r, i) => have.set(r.hash, fresh[i]));
  }

  const out = {
    model: MODEL, dims: DIMS, task: TASK,
    // Not a date: the file is committed, and a timestamp makes every re-bake a
    // diff even when no vector moved.
    rows: rows.map(r => ({
      hash: r.hash, kind: r.kind, text: r.text,
      ...(r.kind === 'claim' ? { concept: r.concept } : { concepts: r.concepts }),
      v: have.get(r.hash),
    })),
  };

  /* Compared against the file as SERIALISED, not against `stale`. A row's
     SHAPE can change with no text changing — renaming the `mods` field to
     `concepts` did exactly that — and an early return on "nothing to re-embed"
     leaves a corpus the page can no longer read, with the baker reporting ok.
     Vectors are cached by hash, so this rewrites without spending a call. */
  const next = JSON.stringify(out);
  if (fs.existsSync(DST) && fs.readFileSync(DST, 'utf8') === next) {
    console.log(`ok    ${census}, already written`);
    return;
  }
  fs.writeFileSync(DST, next);
  console.log(`wrote ${path.relative(ROOT, DST)}  ${census}  ${(fs.statSync(DST).size / 1024).toFixed(0)} KB`);
})().catch(e => { console.error(e.message); process.exitCode = 1; });
