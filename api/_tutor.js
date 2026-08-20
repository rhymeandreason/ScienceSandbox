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
const targets   = require('./_targets.js');

const MAX_CHARS = 500;   // a question, not a pasted essay
const MAX_TURNS = 40;    // a conversation, not an unbounded transcript to re-send

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

/* On a lesson page the tutor may also aim at one thing on screen. `point` is an
 * enum rather than a selector or a coordinate for the same reason `chapters` is:
 * a wrong id is impossible, where a wrong selector is silent. 'none' rather than
 * null because a nullable enum is the one shape the two vendors disagree on. */
function schemaFor(lesson) {
  const t = targets.ids(lesson);
  if (!t.length) return SCHEMA;
  return {
    ...SCHEMA,
    properties: { ...SCHEMA.properties, point: { type: 'string', enum: [...t, 'none'] } },
    required: [...SCHEMA.required, 'point'],
  };
}

/* What the tutor is told about where the student is standing. The step comes
 * from the page each turn, so "why does this need heat?" resolves against the
 * step they are on and not against water in general. */
function situation(lesson, step) {
  const L = targets.forLesson(lesson);
  if (!L) return '';

  const all   = targets.visible(lesson);
  const home  = all.filter(t => t.home);
  const away  = all.filter(t => !t.home);
  const steps = home.filter(t => t.kind === 'step');
  const here  = steps.find(t => t.at === step);

  const line = t => `- ${t.qid}: ${t.what}`;
  const byLesson = {};
  for (const t of away) (byLesson[t.lessonTitle] = byLesson[t.lessonTitle] || []).push(t);

  return `\n\nThe student is not reading, they are on the ${L.title} lesson page, `
    + `working with an interactive 3D model.`
    + (here ? ` Right now they are on "${here.title}", ${steps.indexOf(here) + 1} of ${steps.length}.`
              + ` Assume their question is about what is in front of them.` : '')

    + `\n\nYou can point at ONE thing. Set \`point\` to its id, or to "none" when the answer is not `
    + `about anything listed. Do not mention the pointing in \`answer\` and do not say "look at" or `
    + `"click": the page draws a button from the id.`

    + `\n\nOn THIS page, which they can act on without going anywhere. Strongly prefer these, and `
    + `prefer a control or a step they can act on over describing it in words:\n`
    + home.map(line).join('\n')

    + `\n\nOn OTHER lesson pages. Pointing at one of these navigates the student away from what they `
    + `are doing, so pick one only when the answer genuinely lives in that other lesson and nothing `
    + `above covers it:\n`
    + Object.entries(byLesson).map(([t, list]) => `${t}\n` + list.map(line).join('\n')).join('\n')

    + `\n\nThis page IS the ${L.chapter} chapter, so do not cite that chapter back to them.`;
}

/* A turn, not a question. `messages` is the whole transcript so far, ending in
 * the student's latest. `system` overrides the tutor prompt (bench only), and
 * `cited` names chapters already shown in this thread, so the caller can test
 * whether suppressing a repeat citation reads better than repeating it. */
async function ask({ messages, provider, system, cited, lesson, step }) {
  const p = providers.pick(provider);

  let prompt = (system || SYSTEM) + situation(lesson, step);
  if (cited && cited.length) {
    const names = cited.map(byId).filter(Boolean).map(c => c.chapter);
    if (names.length) prompt += `\n\nAlready shown to this student in this conversation: `
      + `${names.join(', ')}. Do not cite ${names.length > 1 ? 'those' : 'that'} again.`;
  }

  const out = await p.ask({ system: prompt, messages, schema: schemaFor(lesson) });

  // Two models, two ways to be sloppy about a schema. Neither gets to reach the
  // page: an unknown id is dropped, and a missing array becomes an empty one.
  const chapters = (Array.isArray(out.json.chapters) ? out.json.chapters : [])
    .map(byId).filter(Boolean).slice(0, 3)
    // Resolved here, not on the page: the title and the href are the catalog's
    // to state, and the client should never hold a second copy of either.
    .map(c => ({ id: c.id, chapter: c.chapter, page: c.page }));

  // Resolved to the target itself, so the page looks up an id it was given
  // rather than one it was told about. 'none' and anything unrecognised are the
  // same answer: do not draw a button.
  const t = targets.byId(lesson, out.json.point);
  // `href` is built here or not at all. A link whose step the page does not read
  // would land on the right lesson at the wrong place, so `deepLink` decides
  // whether the parameter goes on, and check-ask.js decides whether that flag
  // is telling the truth.
  const point = !t ? null : {
    id: t.qid, kind: t.kind, what: t.what, home: t.home,
    at: t.at, el: t.el, title: t.title,
    lesson: t.lesson, lessonTitle: t.lessonTitle,
    href: t.home ? null : '/' + t.page + (t.deepLink ? `?${t.param}=${encodeURIComponent(t.at)}` : ''),
    lands: t.home || t.deepLink,   // false: the link opens the lesson, not the step
  };

  const u = out.usage;
  return {
    answer: String(out.json.answer || '').trim(),
    chapters,
    point,
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
  const body   = payload || {};
  const wanted = body.provider || null;

  // One question or a whole transcript. The single-question form is what a
  // lesson's box sends and stays the simple case; `messages` is the chat.
  const messages = Array.isArray(body.messages)
    ? body.messages
        .filter(m => m && (m.role === 'user' || m.role === 'assistant') && String(m.content || '').trim())
        .map(m => ({ role: m.role, content: String(m.content).trim() }))
    : [{ role: 'user', content: String(body.question || '').trim() }];

  const last = messages[messages.length - 1];
  if (!messages.length || !last.content) return { status: 400, body: { error: 'ask a question' } };
  if (last.role !== 'user')              return { status: 400, body: { error: 'the last turn must be the student\'s' } };
  if (last.content.length > MAX_CHARS)   return { status: 400, body: { error: `keep it under ${MAX_CHARS} characters` } };
  if (messages.length > MAX_TURNS)       return { status: 400, body: { error: `this thread is over ${MAX_TURNS} turns, start a new one` } };

  // A client-supplied system prompt is a bench affordance and nothing else:
  // anywhere it is allowed, the student writes the tutor's instructions.
  let system = null;
  if (body.system) {
    if (!providers.bench()) return { status: 403, body: { error: 'this deployment does not let the request set the prompt' } };
    system = String(body.system);
  }

  const t0 = Date.now();
  try {
    const out = await ask({ messages, provider: wanted, system, cited: body.cited,
                            lesson: body.lesson, step: Number(body.step) });
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
  const bench = providers.bench();
  return {
    default: providers.DEFAULT,
    bench,
    limits: { maxChars: MAX_CHARS, maxTurns: MAX_TURNS },
    // The prompt is handed out only to a bench, which is the only place it can
    // be edited anyway. Elsewhere the box has no business knowing it.
    system: bench ? SYSTEM : null,
    // The bench needs the target list to show what the tutor could have aimed
    // at, and to fake standing on a step.
    lessons: Object.entries(targets.LESSONS).map(([id, L]) => ({
      id, title: L.title, deepLink: L.deepLink,
      targets: targets.visible(id).map(t => ({ id: t.qid, kind: t.kind, home: t.home,
                 at: t.at, el: t.el, title: t.title, lessonTitle: t.lessonTitle })),
    })),
    providers: providers.names().map(id => {
      const p = require(`./_providers/${id}.js`);
      return { id, label: p.label, model: p.model, ready: !!process.env[p.envKey] };
    }),
  };
}

module.exports = { ask, handleAsk, config, situation, schemaFor, SYSTEM, SCHEMA, MAX_CHARS };
