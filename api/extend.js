/* =============================================================================
 *  api/extend.js — the map reaching past itself, one question at a time
 * =============================================================================
 *  GET  /api/extend  → whether the endpoint is configured
 *  POST /api/extend  {q, candidates:[{id,name,claim}]} → {outside, nodes, edges}
 *
 *  A reader asks something Bio 101 does not cover — "how do fish breathe
 *  underwater?" — and the map has every PIECE (diffusion, surface-area-to-
 *  volume, a transport protein) and no card that assembles them. Today the
 *  search routes that question to photosynthesis, confidently, because
 *  photosynthesis is the closest thing baked. This answers it by drawing the
 *  bridge instead: two or three new cards, each wired to a card that already
 *  exists.
 *
 *  IT MAY ONLY ATTACH TO WHAT IS ALREADY THERE, and it is shown ALL of it.
 *  Two lists arrive: `index`, every card on the map as id and name, and
 *  `candidates`, the dozen the page's vector search ranked highest, with their
 *  claims. Every edge has to name an id from one of those or a node proposed
 *  in the same reply; anything else is dropped here AND again in the page,
 *  which resolves against `byId` before it draws.
 *
 *  THE INDEX IS THERE BECAUSE RETRIEVAL PICKS THE WRONG NEIGHBOURS. Measured:
 *  "how do fish breathe underwater" ranks photosynthesis first and never
 *  surfaces `simple-diffusion` or `sa-v`, which are the cards that actually
 *  explain a gill — they say "molecules spread because they move at random"
 *  and never say oxygen. Given only the retrieval, the model wired gills to
 *  AQUATIC OVERWINTERING, which is anchored and absurd. Two hundred ids and
 *  names is about a thousand tokens; the whole map is cheaper than being
 *  wrong.
 *
 *  RANK 2 OR 3, NEVER 1. Rank 1 is the authored spine — what a card deals
 *  first, what the walk steps along, what sizes a hub. Generated material is
 *  enrichment by construction, and the schema will not express anything else.
 *
 *  NOTHING HERE IS PERSISTED, and that is what makes it safe. The page spawns
 *  these as satellites: pinned, outside the layout, dropped when focus leaves.
 *  A generated node cannot move a laid-out card, cannot close a cycle on the
 *  explanation axis, and cannot spend a rank-1 budget, because it never enters
 *  the pass that would do any of those things. The blast radius of a wrong
 *  answer is one card the reader is looking at.
 *
 *  `outside` IS PART OF THE ANSWER. The model is asked to say plainly whether
 *  the question is inside this curriculum. "Gills are not in Bio 101; here is
 *  the diffusion that makes them work" is a better answer than a confident
 *  card pretending gills were always on the map.
 * ========================================================================== */
'use strict';

const keys = require('./_keys.js');
const finds = require('./_finds.js');

const MAXLEN = 400;              // a question, not a passage
const MAXNODES = 4;
const MAXCANDIDATES = 20;
const MAXINDEX = 400;            // the whole map, with room to grow

/* The grammar, cut to what a bridge can honestly claim. `part-of` and
 * `contains` are out: containment is the SCALE ladder, and a generated card has
 * no level, so it cannot say what it is part of. `instance-of` is out for the
 * same reason a fan member is not a card — the map already has a shape for
 * "a kind of", and it is authored. */
const TYPES = ['causes', 'enables', 'prerequisite-of', 'produces', 'consumes',
               'explained-by', 'contrasts-with', 'analogous-to', 'illustrates'];

const SCHEMA = {
  type: 'object',
  properties: {
    outside: { type: 'boolean' },
    note: { type: 'string' },
    nodes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          claim: { type: 'string' },
        },
        required: ['id', 'name', 'claim'],
      },
    },
    edges: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          from: { type: 'string' },
          type: { type: 'string', enum: TYPES },
          to: { type: 'string' },
          rank: { type: 'integer', enum: [2, 3] },
        },
        required: ['from', 'type', 'to', 'rank'],
      },
    },
  },
  required: ['outside', 'note', 'nodes', 'edges'],
};

const SYSTEM = `You extend a concept map for a college Biology 101 course.

The map is cards and typed, directed edges. A card is a NAME and a CLAIM: one
or two sentences, present tense, concrete, no hedging, under 110 characters.
Write the way a good tutor talks, not the way a textbook does. Never open with
"This is" or "X is the process by which".

You are given the reader's question, the map's INDEX — every card, as id and
name — and CANDIDATES, the handful a search ranked closest, with their claims.
Propose at most ${MAXNODES} new cards that answer the question, and the edges
that connect them.

Attach to the card whose MECHANISM explains the answer, which is often not one
of the candidates: the search ranks by wording, and the right card frequently
does not use the reader's words at all. Read the index for it.

RULES, and a reply breaking one is discarded:
- Every edge's "from" and "to" must be either an id from the index or the
  candidates, exactly as given, or the id of a card you are proposing in this
  same reply. Invent no other id.
- At least one edge must reach an EXISTING card. A cluster floating free of the
  map is not an answer.
- Attach where the claim is really true. An edge to a card that merely shares a
  topic word is worse than no edge.
- DIRECTION IS A CLAIM. "A causes B" says A explains B, and the map reads left
  to right along it. The general mechanism comes first and the special case
  second: diffusion enables a gill, a gill does not enable diffusion.
- New ids are lowercase, hyphenated, and describe the card: "gill", "countercurrent".
- rank 2 for the main link, rank 3 for a side one. Never rank 1.
- This map is Bio 101: water and bonding, macromolecules, protein structure,
  the cell and its membrane, molecular genetics, respiration, photosynthesis.
  Organism-scale anatomy and physiology — organs, breathing, circulation,
  whole-body systems — is OUTSIDE it. Say outside:true for those, and do not
  pretend otherwise; the reader is told. "note" is one sentence to the reader saying
  what the map does and does not cover here, and it is shown to them.
- Propose FEWER cards rather than padding. One card that lands is the goal.
- Every claim must be true. If you are not sure of a mechanism, leave it out.`;

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const who = keys.cohort(req);

  if (req.method === 'GET') {
    return res.status(200).json({ ok: !!process.env.GEMINI_API_KEY, gated: false });
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'GET or POST only' });
  }

  const body = typeof req.body === 'string' ? safeParse(req.body) : (req.body || {});
  const q = String(body.q || '').trim().slice(0, MAXLEN);
  if (!q) return res.status(400).json({ error: 'q is required' });

  /* ids and names only. Trusted no more than the candidates are: everything is
     re-checked against the page's own `byId` before a single card is drawn. */
  const index = (Array.isArray(body.index) ? body.index : [])
    .slice(0, MAXINDEX)
    .map(c => ({ id: String(c.id || '').slice(0, 60), name: String(c.name || '').slice(0, 80) }))
    .filter(c => c.id && c.name);

  const candidates = (Array.isArray(body.candidates) ? body.candidates : [])
    .slice(0, MAXCANDIDATES)
    .map(c => ({
      id: String(c.id || '').slice(0, 60),
      name: String(c.name || '').slice(0, 80),
      claim: String(c.claim || '').slice(0, 240),
    }))
    .filter(c => c.id && c.name);
  if (!candidates.length) return res.status(400).json({ error: 'candidates are required' });

  /* SHARES THE SEARCH'S CAP, deliberately. A generation costs far more than an
   * embedding, but it only happens where a search has already failed, so the
   * two are one activity from the reader's side and rationing them apart would
   * mean a reader who can search but never finish. */
  const capped = await finds.exceeded({ visitorId: body.visitorId });
  if (capped) return res.status(capped.status).json(capped.body);

  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({ error: 'no key configured' });
  }

  const t0 = Date.now();
  try {
    const gemini = require('./_providers/gemini.js');
    const idx = index.map(c => `${c.id} — ${c.name}`).join('\n');
    const known = candidates.map(c => `${c.id} — ${c.name}: ${c.claim}`).join('\n');
    const out = await gemini.ask({
      system: SYSTEM,
      messages: [{ role: 'user', content:
        `INDEX\n${idx}\n\nCANDIDATES\n${known}\n\nQUESTION\n${q}` }],
      schema: SCHEMA,
    });

    const clean = validate(out.json, candidates.concat(index));
    if (!clean.nodes.length) {
      return res.status(200).json({ outside: !!out.json.outside, note: out.json.note || '',
                                    nodes: [], edges: [], ms: Date.now() - t0 });
    }
    /* the VALIDATED answer, which is what the reader was shown — not the raw
       reply, whose dropped edges never reached anybody */
    finds.record({ visitorId: body.visitorId, cohort: who, q, kind: 'extend',
                   ms: Date.now() - t0,
                   answer: { outside: clean.outside, note: clean.note,
                             nodes: clean.nodes, edges: clean.edges,
                             served: out.served } });
    return res.status(200).json({ ...clean, ms: Date.now() - t0, served: out.served });
  } catch (err) {
    console.error('[extend] ' + ((err && err.message) || err));
    return res.status(502).json({ error: 'generation failed' });
  }
};

/* The model is asked for a shape and usually returns it; this is what happens
 * when it does not. Everything unresolvable is DROPPED rather than repaired —
 * a repaired edge is a claim nobody made. */
function validate(json, candidates) {
  const known = new Set(candidates.map(c => c.id));
  const seen = new Set();
  const nodes = [];

  for (const n of (Array.isArray(json.nodes) ? json.nodes : [])) {
    const id = String(n.id || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    const name = String(n.name || '').trim();
    const claim = String(n.claim || '').trim();
    /* An id colliding with a real card would let a generated claim sit where an
       authored one belongs, in the page's own index. */
    if (!id || !name || !claim || known.has(id) || seen.has(id)) continue;
    if (nodes.length >= MAXNODES) break;
    seen.add(id);
    nodes.push({ id, name: name.slice(0, 60), claim: claim.slice(0, 160) });
  }

  const ok = id => known.has(id) || seen.has(id);
  const edges = [];
  for (const e of (Array.isArray(json.edges) ? json.edges : [])) {
    const from = String(e.from || '').trim(), to = String(e.to || '').trim();
    if (!ok(from) || !ok(to) || from === to) continue;
    if (!TYPES.includes(e.type)) continue;
    /* Rank is forced rather than checked: the schema already says 2 or 3, and
       anything else arriving here is a bug, not a preference to honour. */
    edges.push({ from, type: e.type, to, rank: e.rank === 3 ? 3 : 2 });
  }

  /* A cluster with no edge to a real card is not an extension of anything, and
     the page would have nowhere to hang it. */
  const anchored = edges.some(e => known.has(e.from) || known.has(e.to));
  if (!anchored) return { outside: !!json.outside, note: String(json.note || ''), nodes: [], edges: [] };

  /* A node no surviving edge mentions would spawn with nothing attached. */
  const used = new Set(edges.flatMap(e => [e.from, e.to]));
  return {
    outside: !!json.outside,
    note: String(json.note || '').slice(0, 240),
    nodes: nodes.filter(n => used.has(n.id)),
    edges,
  };
}

function safeParse(s) { try { return JSON.parse(s); } catch (e) { return {}; } }
