<!-- KIND: reference + argument — how a page is generated from the component library today, what it costs, what the runs showed, and what the builder backend should do differently. Load when working on tools/gen-app.js, the reference the model is handed, or the backend that will replace the script. -->

# The generator

A student's app is one HTML file that mounts components from the library. The model that writes it is given exactly one document, `docs/Components.md`, and a request. `tools/gen-app.js` is that in a script, and it is also the eval: every change to the reference or a component is judged by rerunning the same requests and driving the pages.

## 1. How it works today

```bash
node tools/gen-app.js "a teacher's request" tests/gen-<name>-test.html
node tools/gen-app.js --edit tests/gen-<name>-test.html "the student's next message" tests/gen-<name>-2.html
```

- **System prompt**: a four-sentence preamble, then the whole of `Components.md`. The preamble says the reference is complete, to use nothing it does not describe, and to reply with the file and nothing else.
- **User message**: `Request from a teacher: …`. In `--edit` mode: the current page, then `The student now asks: …`, and an instruction to change the page and return the whole file.
- **Model**: `gemini-3.7-flash`, `maxOutputTokens` 16,000, default thinking, no schema, no examples, no tools. The key is `GEMINI_API_KEY` from `.env.local` at the repo root, the same file the tutor reads. `--model` overrides.
- **Output**: fences stripped if the model added them, the file written, and one JSON line with the model served, time, and input, output and thinking tokens. That line is the cost model; keep it.

There is no repair loop, no retry and no validation. That is deliberate for now: a page that fails is a gap in the reference or a component, and the script's job is to expose it, not paper over it. The backend will want a retry on a syntax error, and nothing else.

## 2. What the reference is

`Components.md` is the product's prompt. It is written to be handed to a model as its only context: the page skeleton, the contract every component shares, one section per component in a fixed shape (load order, the mount call with every param commented, what it models, the `state()` table, events, anchors, layers, Good for and Not for), the chart, and the copy rules. About 6,000 tokens with five components and the shell; each component adds a few hundred. It is cacheable as a prefix and should be cached in the backend.

The rules that have held, learned from runs rather than guessed:

- If the section does not say it, the model does not know it. Nothing else reaches the model.
- Anything the reference says twice, or says as a rule in prose, should be a default or an enforcement in the library instead. Every rule the model broke was fixed that way: the particle budget, protein spacing, the view offset, the second script for notes.
- Do not add example pages to the prompt. A designed example lives in the repo as the standard and feeds three or four lines into the section; pasted whole it triples the prefix and the model copies its subject.
- The copy rules are load-bearing. "Show, do not tell" plus the notes and layers API is what turned four edits from paragraphs into callouts.

## 3. The eval set

Every generated page that taught something is in `admin.html` under Generated apps with the `UGC` badge, and the request that made it is on its card. Rerun those requests after a change and drive the result: load it, read the console, `pump` the sim by hand, check the numbers and the notes. A page that only "runs" has not been checked; both real defects found so far (a frame cost, a noisy readout) were invisible without driving.

## 4. What the runs measured

First generation, one request, no examples:

| request | input | output | thinking | time | result |
| --- | --- | --- | --- | --- | --- |
| red blood cell, three solutions, sidebar | 2,842 | 2,912 | 1,861 | 19 s | worked first try |
| three-step swelling lesson, shell | 4,454 | 4,106 | 1,555 | 18 s | worked first try |
| "How do salmon go from ocean to freshwater?" | 4,427 | 2,295 | 2,101 | 14 s | a three-step lesson; forgot the view offset |
| the same, after the leak channel existed | 6,196 | 3,080 | 2,333 | 17 s | used the leak channel unasked; spaced proteins too close |

Edits, the whole file returned each turn, before and after the components had notes and layers:

| student message | before | after |
| --- | --- | --- |
| what does the urine do? | a stat tile plus prose | the same, correctly: nothing on stage to point at |
| what are the two pumps? | a callout box in the panel, on every step | `m.notes(['channel.K', 'pump'])` |
| what are gill epithelium? | renamed everything, body at 780 characters | one note on the bilayer, body at 440 |
| speed up the simulation | invented a control and a pump hack, 3,700 thinking tokens | `timeScale: 2.5`, 900 thinking tokens |
| what's the purple thing? can I see it without the water? | not run | `ctx.ui.showPanel(m)` per step |

Every edit cost about 2,500 output tokens and 8,000 input, of which the reference half is cacheable, at 10 to 15 seconds. The saving from notes and layers was in what the page became, not in the bill.

## 5. What edits should do better

- **Output is the bill, and the whole-file format spends it on lines that did not change.** Four of five edits touched under forty lines and returned 240. A diff format cuts output roughly five to one. The shape that suits a model: reply with a list of `{find, replace}` pairs against the current page, each `find` unique, applied by the server, with a whole-file fallback when a find fails. Test it with `gen-app.js` first; it is a mode flag and a small applier.
- **Keep the reference out of the per-turn half.** The backend caches the preamble plus `Components.md` as the prefix and sends the page and the message uncached. The tutor's provider layer already does this split.
- **The page should carry its own request history.** A comment block at the top of the generated file listing the requests that shaped it lets the model see what the student asked before, and lets an eval replay the sequence. The generator does not do this yet.
- **Retry once on a syntax error, never on a semantic one.** A page that throws on load is worth one more attempt with the error appended; a page that runs and is wrong is a finding.
- **Prefer a model that thinks less on edits.** Thinking tokens fell from 3,700 to 900 on the same edit once the component had the parameter; the cheapest edit is the one the library makes trivial.

## 6. Where it goes

The backend that replaces the script owns four things the script does not: an apps table with parent and author for remix, a route that serves a stored page from a sandboxed origin, the cached prefix, and rate limits that do not no-op without a cohort. The tutor's key gate, provider abstraction, database client and logging are reusable as they are. Everything about what the model is told, and how a page is judged, is this document and `Components.md`, and should not move into the backend's code.
