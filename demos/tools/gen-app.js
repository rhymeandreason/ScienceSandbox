#!/usr/bin/env node
/* =====================================================================
 *  gen-app.js — one generated app, from the component reference alone
 *
 *  Run, from the repo root or demos/:
 *    node demos/tools/gen-app.js "a teacher's request" <path to write> [--model gemini-3.7-flash]
 *
 *  The eval for docs/Components.md: the model gets that file as its whole
 *  system prompt and a request, and writes a page. Nothing else — no repo,
 *  no tools — so a page that fails here is a gap in the reference, not in
 *  the model. Prints the usage and the time, which is the cost model.
 *
 *  Key: GEMINI_API_KEY from .env.local at the repo root, the same file the
 *  tutor reads (docs/ai-tutor.md). Never printed.
 * ===================================================================== */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const env = path.join(ROOT, '.env.local');
if (fs.existsSync(env)) for (const line of fs.readFileSync(env, 'utf8').split('\n')) {
  const m = /^\s*([A-Z_]+)\s*=\s*(.*)\s*$/.exec(line);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const args = process.argv.slice(2);
const mi = args.indexOf('--model');
const MODEL = mi >= 0 ? args.splice(mi, 2)[1] : (process.env.GEMINI_MODEL || 'gemini-3.7-flash');
const [request, out] = args;
if (!request || !out) { console.error('usage: gen-app.js "request" <path to write> [--model m]'); process.exit(2); }
if (!process.env.GEMINI_API_KEY) { console.error('GEMINI_API_KEY is not set'); process.exit(2); }

const reference = fs.readFileSync(path.join(ROOT, 'demos', 'docs', 'Components.md'), 'utf8');
const system = `You write single-page science apps for Bio 101 students from a component library. Your only reference is the document below; it is complete. Use nothing it does not describe. Reply with the HTML file and nothing else: no fences, no prose before or after. The file will be saved one folder below demos/, so the reference's relative paths apply as written.\n\n${reference}`;

(async () => {
  const { GoogleGenAI } = await import(path.join(ROOT, 'node_modules', '@google/genai', 'dist', 'node', 'index.mjs'));
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const t0 = Date.now();
  const res = await client.models.generateContent({
    model: MODEL,
    contents: [{ role: 'user', parts: [{ text: `Request from a teacher: ${request}` }] }],
    config: { systemInstruction: system, maxOutputTokens: 16000 },
  });
  const ms = Date.now() - t0;
  let html = res.text || '';
  html = html.replace(/^\s*```(?:html)?\s*/i, '').replace(/\s*```\s*$/, '');
  fs.writeFileSync(out, html);
  const u = res.usageMetadata || {};
  console.log(JSON.stringify({
    model: res.modelVersion || MODEL, ms,
    input: u.promptTokenCount || 0, output: u.candidatesTokenCount || 0,
    thoughts: u.thoughtsTokenCount || 0, lines: html.split('\n').length, out,
  }));
})().catch(e => { console.error(e.message || e); process.exit(1); });
