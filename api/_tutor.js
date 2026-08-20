/* =============================================================================
 *  _tutor.js — one question in, an answer and a list of chapters out
 * =============================================================================
 *  Shared by the Vercel function and the local dev server so both run the same
 *  prompt. No HTTP framework, no DOM, and no vendor: it takes a string and
 *  returns an object, and `_providers/` decides which model produced it.
 *
 *  THE CHAPTER CITATION IS DATA, NOT PROSE. The model returns `chapters` as ids
 *  constrained to the catalog's enum, and the page renders "See ..." from the
 *  catalog at display time. Asking for the sentence in the answer text instead
 *  would mean parsing it back out, and a chapter name the model spelled its own
 *  way, or a link to a page that was never built.
 * ========================================================================== */
'use strict';

const { CHAPTERS, IDS, byId } = require('./_catalog.js');
const providers = require('./_providers');

const MAX_CHARS = 500;   // a question, not a pasted essay

const SYSTEM = `Be a tutor for a high school student learning biology. Answer questions concisely, don't overcomplicate it. Prioritize core concepts. Keep your response to max 3 sentences. If there's more info, steer the student toward asking more questions. Your goal is to guide curiosity and inquiry, not to dump out a textbook of facts.

Don't always end on a question, only when the subject matter lends naturally to one.

Our core chapters are listed below. If the question relates to one or more of them, return their ids in \`chapters\`. Do NOT name chapters, say "See ...", or mention lessons in \`answer\` itself: the page renders the citation from the ids. Cite at most three, most relevant first, and cite none when the question genuinely fits no chapter.

${CHAPTERS.map(c => `- ${c.id} (${c.chapter}): ${c.covers}`).join('\n')}

If the question is not about biology or chemistry, say so in one friendly sentence and return no chapters.`;

const SCHEMA = {
  type: 'object',
  properties: {
    answer:   { type: 'string' },
    chapters: { type: 'array', items: { type: 'string', enum: IDS }, maxItems: 3 },
  },
  required: ['answer', 'chapters'],
  additionalProperties: false,
};

async function ask(question, providerName) {
  const p   = providers.pick(providerName);
  const out = await p.ask({ system: SYSTEM, question, schema: SCHEMA });

  // Two models, two ways to be sloppy about a schema. Neither gets to reach the
  // page: an unknown id is dropped, and a missing array becomes an empty one.
  const chapters = (Array.isArray(out.json.chapters) ? out.json.chapters : [])
    .map(byId).filter(Boolean).slice(0, 3)
    // Resolved here, not on the page: the title and the href are the catalog's
    // to state, and the client should never hold a second copy of either.
    .map(c => ({ id: c.id, chapter: c.chapter, page: c.page }));

  const u = out.usage;
  return {
    answer: String(out.json.answer || '').trim(),
    chapters,
    provider: p.id,
    // `model` is what served the request; `configured` is what was asked for.
    // They differ when an alias resolves, and when an override did not take.
    model: out.served || p.model,
    configured: p.model,
    usage: {
      ...u,
      // Priced where the price lives. The bench prints this rather than doing
      // its own arithmetic against a rate it would have to keep in step.
      cost_usd: (u.input * p.PRICE.input + u.output * p.PRICE.output
                 + u.cached * p.PRICE.cached) / 1e6,
      priced: !p.PRICE.unknown,   // false means no rate is known for this model, not free
    },
  };
}

/* Transport-free request handling: validation, the call, and the error mapping,
 * so the Vercel function and the dev server behave identically instead of
 * drifting into two versions of "what does a bad question do". */
async function handleAsk(payload) {
  const question = String((payload && payload.question) || '').trim();
  const wanted   = (payload && payload.provider) || null;

  if (!question)                   return { status: 400, body: { error: 'ask a question' } };
  if (question.length > MAX_CHARS) return { status: 400, body: { error: `keep it under ${MAX_CHARS} characters` } };

  const t0 = Date.now();
  try {
    const out = await ask(question, wanted);
    return { status: 200, body: { ...out, ms: Date.now() - t0 } };
  } catch (err) {
    const status = err && err.status;

    // Always, in full, on the server. A one-line student-facing message is the
    // right thing to render and the wrong thing to debug from: "try again in a
    // moment" is indistinguishable from "this key has no quota and never will".
    console.error(`\n[ask] ${wanted || 'default provider'} failed`
      + (status ? ` (HTTP ${status})` : '') + ':\n', err && err.message || err, '\n');

    // A configuration problem is ours, not the vendor's, and safe to show whole.
    if (!status) return { status: 500, body: { error: err.message } };

    if (status === 401 || status === 403)
      return { status: 500, body: { error: 'the API key was rejected' } };

    // Quota messages name the limit that was hit and how to raise it, and hold
    // no secret. Passing one through is the difference between a fix and a guess.
    if (status === 429)
      return { status: 429, body: { error: 'out of quota: ' + brief(err), detail: 'quota' } };

    if (status === 400 || status === 404)
      return { status: 502, body: { error: brief(err), detail: 'request' } };

    return { status: 502, body: { error: 'the tutor could not be reached' } };
  }
}

/* Both vendors put a JSON body in the error's message. Pull the human sentence
 * out of it when it is there, and never let it run past a line. */
function brief(err) {
  let m = (err && err.message) || 'unknown error';
  const at = m.indexOf('{');
  if (at >= 0) {
    try {
      const j = JSON.parse(m.slice(at));
      m = (j.error && (j.error.message || j.error.status)) || j.message || m;
    } catch { /* not JSON after all: the raw message is what we have */ }
  }
  return m.length > 220 ? m.slice(0, 219) + '…' : m;
}

/* What the bench needs to draw its provider switch, without guessing. */
function config() {
  return {
    default: providers.DEFAULT,
    switchable: providers.switchable(),
    providers: providers.names().map(id => {
      const p = require(`./_providers/${id}.js`);
      return { id, label: p.label, model: p.model, ready: !!process.env[p.envKey] };
    }),
  };
}

module.exports = { ask, handleAsk, config, SYSTEM, SCHEMA, MAX_CHARS };
