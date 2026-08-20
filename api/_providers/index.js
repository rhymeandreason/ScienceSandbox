/* =============================================================================
 *  _providers/index.js — which model answers the question
 * =============================================================================
 *  `AI_PROVIDER` in the environment picks one. A provider is any module with
 *  `{id, label, envKey, model, PRICE, ask({system, question, schema})}` that
 *  returns `{json, usage:{input, output, cached}}`, so adding a third is a file
 *  and a line in PROVIDERS, and `_tutor.js` never learns its name.
 *
 *  ASK_BENCH=1 marks a deployment as a test bench: a request may then name its
 *  provider and supply its own system prompt. Both stay off in production, where
 *  they would let a visitor choose which key to spend and what the tutor is.
 * ========================================================================== */
'use strict';

const PROVIDERS = {
  gemini:    () => require('./gemini.js'),
  anthropic: () => require('./anthropic.js'),
};

const DEFAULT = process.env.AI_PROVIDER || 'gemini';

const names = () => Object.keys(PROVIDERS);
const bench = () => process.env.ASK_BENCH === '1';

/* Returns a provider, or throws a message the box can show a student. The
 * require is lazy per provider: a missing SDK for the one you are not using is
 * not an error. */
function pick(requested) {
  let id = DEFAULT;

  if (requested) {
    if (!bench())              throw new Error('this deployment does not let the request pick a provider');
    if (!PROVIDERS[requested]) throw new Error(`no provider named "${requested}"`);
    id = requested;
  }

  if (!PROVIDERS[id]) throw new Error(`AI_PROVIDER is "${id}", which is not one of: ${names().join(', ')}`);

  const p = PROVIDERS[id]();
  if (!process.env[p.envKey]) throw new Error(`${p.envKey} is not set on the server`);
  return p;
}

module.exports = { pick, names, bench, DEFAULT };
