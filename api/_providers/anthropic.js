/* =============================================================================
 *  _providers/anthropic.js — Claude behind the provider interface
 * =============================================================================
 *  Takes a system prompt, a question and a JSON Schema; returns parsed JSON and
 *  normalised usage. Everything Anthropic-shaped stops here: the prompt cache
 *  breakpoint, the `output_config` schema, the token field names.
 * ========================================================================== */
'use strict';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5';

/* USD per 1M tokens, read 2026-08-19 from
 * https://docs.claude.com/en/docs/about-claude/pricing
 * A cache read is a tenth of an input token. Per model, because ANTHROPIC_MODEL
 * is a knob; an unlisted model prices at zero and says so rather than quoting
 * some other model's rate. */
const PRICES = {
  'claude-opus-5':    { input: 5.00, output: 25.00, cached: 0.50 },
  'claude-sonnet-5':  { input: 3.00, output: 15.00, cached: 0.30 },
  'claude-haiku-4-5': { input: 1.00, output:  5.00, cached: 0.10 },
};

const PRICE = PRICES[MODEL] || { input: 0, output: 0, cached: 0, unknown: true };

let client = null;

async function ask({ system, question, schema }) {
  if (!client) {
    const Anthropic = require('@anthropic-ai/sdk');
    client = new Anthropic();               // reads ANTHROPIC_API_KEY
  }

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    // The answer is three sentences. Low effort keeps latency and cost in the
    // range a question box can afford without changing what the model knows.
    output_config: { effort: 'low', format: { type: 'json_schema', schema } },
    // The catalog is byte-stable, so the breakpoint after it is paid once and
    // read back at a tenth of the price on every later question.
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: question }],
  });

  // output_config.format guarantees the first text block is valid JSON matching
  // the schema, so this parse is not a hopeful one.
  const text = res.content.find(b => b.type === 'text').text;

  return {
    json: JSON.parse(text),
    served: res.model || MODEL,   // what answered, not what was asked for
    usage: {
      input:  res.usage.input_tokens,
      output: res.usage.output_tokens,
      cached: res.usage.cache_read_input_tokens || 0,
    },
  };
}

module.exports = { id: 'anthropic', label: 'Claude', envKey: 'ANTHROPIC_API_KEY',
                   model: MODEL, PRICE, ask };
