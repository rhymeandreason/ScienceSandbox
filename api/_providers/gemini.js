/* =============================================================================
 *  _providers/gemini.js — Gemini behind the same interface
 * =============================================================================
 *  Same contract as anthropic.js: system prompt + question + JSON Schema in,
 *  parsed JSON and normalised usage out. The differences that matter are all
 *  here, not in the tutor:
 *
 *    · the system prompt is `systemInstruction`, not a message;
 *    · the schema goes in `responseJsonSchema` and must lose
 *      `additionalProperties`, which Gemini's validator rejects;
 *    · usage counts are `usageMetadata`, and thinking tokens are counted
 *      separately from the answer's, so they get added into `output` rather
 *      than quietly disappearing from the bill the bench prints.
 * ========================================================================== */
'use strict';

const MODEL = process.env.GEMINI_MODEL || 'gemini-3.7-flash';

/* USD per 1M text tokens, paid tier, read 2026-08-19 from
 * https://ai.google.dev/gemini-api/docs/pricing
 *
 * Per model, because GEMINI_MODEL is a knob and the models are 40x apart: one
 * rate for "Gemini" would make the bench's cost readout fiction the moment you
 * turned that knob. An unlisted model prices at zero and says so, which is the
 * one honest answer available when the rate is not known here.
 *
 * The 3.7-flash figures are promotional through 2026-12-31; input/output double
 * to 1.50/7.50 after that. */
const PRICES = {
  'gemini-3.7-flash':      { input: 0.75, output: 3.75, cached: 0.075 },
  'gemini-3.5-flash':      { input: 1.50, output: 9.00, cached: 0.15  },
  // Flash-Lite has no context caching, so `cached` is zero because there is
  // nothing to price, not because a cache read is free.
  'gemini-3.5-flash-lite': { input: 0.30, output: 2.50, cached: 0     },
  // The 2.5 pair is closed to new API keys: Google answers a request for one
  // with a 400 naming its 3.5 replacement. Kept priced for anyone still on it.
  'gemini-2.5-flash':      { input: 0.30, output: 2.50, cached: 0.03  },
  'gemini-2.5-flash-lite': { input: 0.10, output: 0.40, cached: 0.01  },
};

const UNPRICED = { input: 0, output: 0, cached: 0, unknown: true };
const PRICE = PRICES[MODEL] || UNPRICED;

let client = null;

/* Thinking is configured differently either side of the 3.x line: 2.5 models take
 * a token budget (0 turns it off), 3.x models take a named level, and each
 * rejects the other's field. The answer is three sentences about settled
 * biology, so both settings say the same thing: barely think about it. */
function thinkingFor(model) {
  return /^gemini-2\./.test(model) ? { thinkingBudget: 0 }
                                   : { thinkingLevel: 'LOW' };
}

// Gemini's structured-output validator rejects `additionalProperties`, which the
// Anthropic schema needs. Strip it rather than keep two schemas: one catalog,
// one shape, and the checker only has one thing to assert.
function forGemini(node) {
  if (Array.isArray(node)) return node.map(forGemini);
  if (!node || typeof node !== 'object') return node;
  const out = {};
  for (const [k, v] of Object.entries(node)) {
    if (k === 'additionalProperties') continue;
    out[k] = forGemini(v);
  }
  return out;
}

async function ask({ system, messages, schema }) {
  if (!client) {
    const { GoogleGenAI } = require('@google/genai');
    client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }

  const res = await client.models.generateContent({
    model: MODEL,
    // Gemini's word for the assistant's turn is "model". The tutor speaks the
    // same transcript to both vendors; only the label changes here.
    contents: messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
    config: {
      systemInstruction: system,
      maxOutputTokens: 2000,
      thinkingConfig: thinkingFor(MODEL),
      responseMimeType: 'application/json',
      responseJsonSchema: forGemini(schema),
    },
  });

  const u = res.usageMetadata || {};

  return {
    json: JSON.parse(res.text),
    // What answered, not what was asked for. An alias resolves to a dated build,
    // and a model that is retired or rerouted resolves to something else again.
    served: res.modelVersion || MODEL,
    usage: {
      input:  (u.promptTokenCount || 0) - (u.cachedContentTokenCount || 0),
      output: (u.candidatesTokenCount || 0) + (u.thoughtsTokenCount || 0),
      cached: u.cachedContentTokenCount || 0,
    },
  };
}

module.exports = { id: 'gemini', label: 'Gemini', envKey: 'GEMINI_API_KEY',
                   model: MODEL, PRICE, ask };
