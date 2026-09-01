#!/usr/bin/env node
/* =====================================================================
 *  bake-graph-vectors.js — the NODE GRAPH's searchable text as vectors.
 *
 *    node tools/bake-graph-vectors.js            # bake, if anything changed
 *    node tools/bake-graph-vectors.js --check    # exit 1 if stale, embed nothing
 *    node tools/bake-graph-vectors.js --force    # re-embed every row
 *
 *  reads nodegraph/graphdata.js, writes nodegraph/graphdata-vectors.json.
 *
 * ---------------------------------------------------------------------
 *  A SIBLING OF bake-vectors.js, NOT A PARAMETER ON IT. That one bakes
 *  lib/mapcontent.js for the questions-composer, which is being deprecated;
 *  the node graph re-declares its content rather than inheriting a
 *  dependency on it, and the two corpora have different row kinds. Sharing
 *  one script would mean a flag deciding which map is being baked, and a
 *  stale bake of the wrong one reads exactly like a fresh bake of the right
 *  one. Read that file's header for the reasoning this one inherits:
 *  why bake at all, why hashes, why SEMANTIC_SIMILARITY, why 256 dims.
 *
 *  THREE KINDS OF ROW, and the third is the one this map has that the other
 *  does not:
 *
 *    q      a question, embedded as written. Matched question-to-question.
 *    claim  a card, as `Name. claim.` The name is in the vector because a
 *           card's name is the thing a reader types that no question can
 *           answer for them.
 *    kind   a member of a card's `kinds` fan, as `Name. claim.` A fan member
 *           is real content with nowhere else to be retrieved from —
 *           Anthocyanin and Phycobilin are on no card of their own — and
 *           leaving them out makes them findable only by someone who
 *           already knows the word.
 *
 *  The three sit at different absolute cosines, so `kind` is written into
 *  every row and the page floors them separately. One shared threshold is
 *  the wrong shape, not a number to tune.
 * ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'nodegraph', 'graphdata.js');
const CONTENT = path.join(ROOT, 'nodegraph', 'graphcontent.js');
const DST = path.join(ROOT, 'nodegraph', 'graphdata-vectors.json');

const MODEL = process.env.EMBED_MODEL || 'gemini-embedding-001';
const DIMS = 256;
const TASK = 'SEMANTIC_SIMILARITY';

const args = new Set(process.argv.slice(2));
const CHECK = args.has('--check');
const GATE = args.has('--gate');
const FORCE = args.has('--force');

/* The dev server reads .env.local per request rather than at boot; this is a
 * one-shot script, so a plain parse is enough. Nothing here prints a value. */
function env() {
  for (const f of [path.join(ROOT, '.env.local'), path.join(ROOT, '..', '.env.local')]) {
    if (!fs.existsSync(f)) continue;
    for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  }
}

const sha = s => crypto.createHash('sha256').update(s, 'utf8').digest('hex').slice(0, 16);

const graph = () => require(SRC).GraphData;

/* ---- map integrity ------------------------------------------------------
 * Not about vectors at all, and here because this is the graph's only
 * checker. Everything below ships looking fine: the page drops what it
 * cannot resolve with a console.warn nobody is reading, and the reader gets
 * a map that is quietly missing the thing they came for.
 *
 * The rest of the QA list — cycles, stranded nodes, hairballs, clipped
 * claims — needs the laid-out graph and lives in the browser, per
 * nodegraph/Nodegraph.md. These four need only the data. */
function integrity() {
  const { NODES, EDGES } = graph();
  const byId = new Map(NODES.map(n => [n.id, n]));
  const bad = [];

  for (const [from, type, to, rank] of EDGES) {
    if (!byId.has(from)) bad.push(`edge names a missing node: ${from} -${type}-> ${to}`);
    if (!byId.has(to)) bad.push(`edge names a missing node: ${from} -${type}-> ${to}`);
    if (![1, 2, 3].includes(rank)) bad.push(`edge has no rank: ${from} -${type}-> ${to}`);
  }

  /* An extension question naming a kind that is not in the fan spawns
     nothing and warns at click time, which is the worst place to find out. */
  for (const n of NODES) {
    if (n.qtype !== 'extension') continue;
    const answers = EDGES.filter(e => e[0] === n.id && e[1] === 'answers');
    if (!answers.length) { bad.push(`extension question answers nothing: ${n.id}`); continue; }
    if (!n.kind) continue;
    const host = byId.get(answers.sort((a, b) => a[3] - b[3])[0][2]);
    if (!host || !(host.kinds || []).some(k => k[0] === n.kind))
      bad.push(`extension names a kind that is not there: ${n.id} → ${n.kind}`);
  }

  /* A placement pointing at a renamed node drops the lesson, the film or the
     sim it was carrying, and the card is still drawn without it. */
  let placements = null;
  try { placements = require(CONTENT).GraphContent; } catch (e) { /* soft: a
    checkout without graphcontent.js still gets its edges checked */ }
  if (placements) {
    const content = new Set(placements.CONTENT.map(c => c.id));
    for (const [cid, ranks] of placements.PLACEMENTS) {
      if (!content.has(cid) && !/^p:/.test(cid)) bad.push(`placement names missing content: ${cid}`);
      for (const nid of Object.keys(ranks))
        if (!byId.has(nid)) bad.push(`placement names missing node: ${cid} → ${nid}`);
    }
  }
  return bad;
}

function corpus() {
  const { NODES } = graph();
  const rows = [];

  for (const n of NODES) {
    if (n.type === 'question') {
      rows.push({ kind: 'q', text: n.text, hash: sha(n.text), node: n.id });
      continue;
    }
    if (n.claim) {
      const text = `${n.name}. ${n.claim}`;
      rows.push({ kind: 'claim', text, hash: sha(text), node: n.id });
    }
    for (const [name, claim] of n.kinds || []) {
      const text = `${name}. ${claim}`;
      rows.push({ kind: 'kind', text, hash: sha(text), node: n.id, member: name });
    }
  }
  return rows;
}

/* Re-normalise after truncating: a Matryoshka prefix is a valid embedding, but
 * the prefix of a unit vector is not itself a unit vector, and every consumer
 * treats a dot product AS the cosine. 4 decimals is far finer than anything
 * cosine RANKING resolves, and it is a third off the file. */
function unit(v) {
  const n = Math.hypot(...v);
  return n ? v.map(x => +(x / n).toFixed(4)) : v;
}

async function embed(texts) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY not set (looked at .env.local and the environment)');
  const out = [];
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

  const bad = integrity();
  if (bad.length) {
    /* Fails --check and --gate, warns a bake: the page reads graphdata.js live
       and never reads the ids written here, so a broken reference does not
       corrupt a vector. It breaks the map, which is worse, and is why it is
       said either way. */
    console.error(`${CHECK || GATE ? 'BROKEN' : 'WARNING'}: ${bad.length} bad reference(s) in nodegraph/graphdata.js`);
    for (const b of bad) console.error('  ' + b);
    if (CHECK || GATE) process.exit(1);
  }

  const tally = rows.reduce((a, r) => (a[r.kind] = (a[r.kind] || 0) + 1, a), {});
  const census = `${tally.q || 0} questions + ${tally.claim || 0} claims + ${tally.kind || 0} kinds`;

  /* --gate IS THE HOOK'S MODE, AND STALENESS DOES NOT BLOCK IT. Baking needs a
     key and the network, and graphdata.js is hand-edited — a rule that stops a
     one-word claim edit until the machine can reach Google is a rule that
     teaches `--no-verify`, which then also skips the integrity half, which is
     the half that actually breaks the map. So the two failures are split by
     what they cost:

       integrity  fatal. Offline to check, offline to fix, and it means the map
                  is silently missing a crossing somebody just authored.
       staleness  loud, and it passes. The cost is that one row cannot be the
                  answer in a LAST-RESORT labelled guess — the keyword search
                  above it is untouched, and the page reads whatever rows it
                  finds. Re-bake when it suits you.

     --check keeps both fatal, for a run by hand or by CI. */
  if (CHECK || GATE) {
    if (!stale.length && !orphans.length) {
      console.log(`ok    ${census}, every one baked`);
      process.exit(0);
    }
    const how = GATE ? 'STALE (not blocking)' : 'STALE';
    console.error(`${how}: ${stale.length} row(s) with no vector, ${orphans.length} orphan(s)`);
    for (const r of stale.slice(0, 8)) console.error('  unbaked: ' + r.text);
    for (const r of orphans.slice(0, 8)) console.error('  orphan:  ' + (r.text || r.hash));
    console.error('\nrun: node tools/bake-graph-vectors.js');
    process.exit(GATE ? 0 : 1);
  }

  if (stale.length) {
    console.log(`embedding ${stale.length} of ${rows.length} row(s) (${census}) with ${MODEL} @ ${DIMS}d`);
    const fresh = await embed(stale.map(r => r.text));
    stale.forEach((r, i) => have.set(r.hash, fresh[i]));
  }

  const out = {
    model: MODEL, dims: DIMS, task: TASK,
    /* Not a date: the file is committed, and a timestamp makes every re-bake a
       diff even when no vector moved. */
    rows: rows.map(r => ({
      hash: r.hash, kind: r.kind, text: r.text, node: r.node,
      ...(r.member ? { member: r.member } : {}),
      v: have.get(r.hash),
    })),
  };

  /* Compared against the file as SERIALISED, not against `stale`: a row's
     SHAPE can change with no text changing, and an early return on "nothing to
     re-embed" would leave a corpus the page can no longer read while the baker
     reports ok. Vectors are cached by hash, so this rewrites without spending
     a call. */
  /* ONE ROW PER LINE. `JSON.stringify` puts the whole corpus on one line, and
     at half a megabyte that makes re-baking a single reworded claim a
     whole-file diff — which, with small content edits landing often, is the
     difference between a readable history and a binary blob. Still plain JSON. */
  const next = '{"model":' + JSON.stringify(out.model) +
    ',"dims":' + out.dims + ',"task":' + JSON.stringify(out.task) + ',"rows":[\n' +
    out.rows.map(r => JSON.stringify(r)).join(',\n') + '\n]}\n';
  if (fs.existsSync(DST) && fs.readFileSync(DST, 'utf8') === next) {
    console.log(`ok    ${census}, already written`);
    return;
  }
  fs.writeFileSync(DST, next);
  console.log(`wrote ${path.relative(ROOT, DST)}  ${census}  ${(fs.statSync(DST).size / 1024).toFixed(0)} KB`);
})().catch(e => { console.error(e.message); process.exitCode = 1; });
