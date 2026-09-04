<!-- KIND: reference + argument — how a page is generated from the component library, what it costs, what the runs showed, and what the builder backend does. Load when working on tools/gen-app.js, api/_builder.js, the reference the model is handed, or the builder pages and endpoints. -->

# The generator

A student's app is one HTML file that mounts components from the library. The model that writes it is given exactly one document, `docs/Components.md`, and a request. `tools/gen-app.js` is that in a script, and it is also the eval: every change to the reference or a component is judged by rerunning the same requests and driving the pages.

## 1. How it works today

```bash
node tools/gen-app.js "a teacher's request" tests/gen-<name>-test.html
node tools/gen-app.js --edit tests/gen-<name>-test.html "the student's next message" tests/gen-<name>-2.html
node tools/gen-app.js --edit <page> "..." <out> --whole      # the old whole-file edit, kept as the baseline
```

- **One module, two transports.** `api/_builder.js` holds the prompts, the reply shapes, the edit applier and the source checks. The script writes a file; `api/build.js` writes a row. Neither holds a prompt, so the eval and the product cannot drift.
- **System prompt**: a four-sentence preamble, then the whole of `Components.md`. Byte-stable across drafts and edits, so the provider caches it once; the cost line prints `cached` so you can see it read back.
- **A draft** is `Request from a teacher: …` and the model replies `{title, summary, html}`. The page is checked (`validate`: scripts only from `../` or the one CDN, every `mount` on a component the reference names) and retried once with the problems quoted if it fails. A page that passes and is wrong is a finding.
- **An edit** carries the page in the uncached half and the request in the message, and the model replies `{summary, edits: [{find, replace}]}`. Each find must occur exactly once; the list is applied here. A miss falls back to one whole-file call with the misses quoted, and then stops.
- **The page carries its history**: a `<!-- requests -->` comment after the doctype, oldest first, rebuilt after every turn. The model is told to leave it alone.
- **Model**: `gemini-3.7-flash` by default, `--provider anthropic` or `--model` to change. Default thinking on a draft, low on an edit. `maxOutputTokens` 16,000 for a page, 6,000 for edits. Keys from `.env.local` at the repo root.
- **Output**: one JSON line with the model served, time, input, cached and output tokens, dollars, and for an edit the route (`edits`, or `whole` with the reason). That line is the cost model; keep it.

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

Every whole-file edit cost about 2,500 output tokens and 8,000 input, of which the reference half is cacheable, at 10 to 15 seconds. The saving from notes and layers was in what the page became, not in the bill.

The same turn as find/replace pairs, once the format was built (2026-09-03, reference at 6,512 cached tokens):

| turn | route | input | cached | output | time | cost |
| --- | --- | --- | --- | --- | --- | --- |
| "make the first step's text shorter, one paragraph" on gen-salmon-n5 | 1 edit | 2,652 | 6,512 | 205 | 2.1 s | $0.0032 |
| "put a note on the aquaporin in the hypotonic step" on gen-rbc, through the builder page | 4 edits | | 6,512 | | 2.8 s | $0.0043 |
| a fresh draft, "a red blood cell in three solutions, with a sidebar" | draft | 17 | 6,512 | 3,478 | 10.1 s | $0.0135 |

Output fell about twelve to one and the turn from 10 to 15 seconds to 2 to 3. The draft's 17 uncached input tokens are the request; everything else read back from the cache.

## 5. What is built, and what an edit still cannot do

Built, in `_builder.js` and measured above: the pair format with its whole-file fallback, the history comment, one retry on a failed source check, low thinking on edits. Built in the builder page: the runtime error relay, so a page that throws in the browser tells the next turn what it threw. The script cannot run a page, so it never sees a runtime error; that loop only closes through the page.

Still true: the cheapest edit is the one the library makes trivial. Thinking tokens fell from 3,700 to 900 on the same edit once the component had the parameter, and no format change matches that.

## 6. The backend

`api/build.js` is the model turn: a first draft makes an app row and returns the edit token once; an edit needs the token and writes a version. `api/app.js` reads a stored page for anyone with the id, and restores, remixes, rotates the token and retitles for the token's holder; it takes no HTML from a caller. `api/_apps.js` is the two tables and the limit, its own constants counted in `app_versions`: 60 model turns an hour per visitor, 200 an hour and 600 a day per cohort, failing open like the tutor's. The same key as the tutor gates it.

The pages are `demos/build/`: `build.html` is the builder, `app.html` the viewer, `apps-client.js` what they share. A stored page runs in an iframe by `srcdoc` with `allow-scripts` only, on an opaque origin; a `<base>` is spliced into its head so `../lib/` resolves, and a relay posts its uncaught errors up. **On loopback the frame runs same-origin**: Chromium blocks every request an opaque origin makes to localhost, so locally the sandbox would load the CDN and nothing of the library. Deployed it is the real sandbox. Because the frame is cross-origin deployed, `vercel.json` and the dev server send `Access-Control-Allow-Origin: *` on `/demos/`, which is what lets Proteinbox fetch a bake from inside it.

Deployed routes: `/build` and `/app/<id>`, rewrites in `vercel.json`; locally the file paths. Seed a page from disk with `node demos/tools/db.js seed tests/gen-rbc-test.html`, which prints the view and edit links; `db.js apps` lists what exists and `db.js builds` sums tokens and dollars per cohort per day, which is what tunes the limits. It needs `DATABASE_URL`: without a database nothing can be stored, and both endpoints say so.

Not built: the library at a pinned `/lib/v1/` path, and a per-key limit. What the model is told, and how a page is judged, is this document and `Components.md`, and none of it lives in the backend's code.
