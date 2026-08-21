# AI tutor chat

## Goal

A science question box and an in-lesson tutor chat. The tutor answers in ≤3 sentences, cites chapters, and **points at things on the page**: a step, a control, or specific atoms. Backed by a serverless function so the API key never reaches the browser. Target deploy is Vercel; the lessons stay static.

## Status

Runs locally only. Nothing is deployed. **Logging is built** and writes to Neon; it is off wherever `DATABASE_URL` is unset.

Working end to end on `demos/water-lab.html`:

* multi-turn chat in a floating panel, launched from a button in the rail
* answers cite chapters, and never the chapter you are standing on
* **Show me** pill acts in place; an outlined pill links to another lesson
* aiming hits \~10/12 on the probe set (5 home, 5 away, 2 correctly none)
* highlights are atom-level via `kit/focus.js`: one oxygen, or the two atoms at either end of a real hydrogen bond
* controls get cyan rings, sized to a slider's *thumb*, not its track
* the tutor sees live scene state (molecule count, temperature, phase, salt)
* provider switch: Gemini (default, `gemini-3.7-flash`) or Claude, one env var
* the stable half of the prompt is cached server-side, and on a lesson page it is the large majority of the input

## Next steps, in order

Reordered once the demo-mode design landed: glycolysis moved to the front, because the bake is downstream of it and of real logged questions.

1. **Second lesson mount, and its UX.** Everything is justified by one page. Glycolysis is the real test (10 steps, existing hotspots, modals to coexist with). It comes first now: freezing baked answers for a page still being reshaped is the reliable way to make baked content rot on day one.
2. **Deploy, and collect.** `vercel.json` exists but is untested. Nothing downstream can start until real students have asked real questions. (The bench used to need `ASK_BENCH` unset here; it is now a localhost check instead, so there is nothing to remember. See *The bench is localhost* below.)
3. **Judge answer quality.** Never done properly. Multi-turn drift past turn 4, the 3-sentence cap, citation repetition, and flash-lite vs 3.7-flash vs Claude on the same questions. The log's per-model cards are the instrument.
4. **Access link + rate limit.** See *Demo mode* below: the link and the limit are the same piece of work, because a key names a cohort and a limit attaches to the label. Google AI Studio is prepaid, capped at $10, which fixes the unbounded bill but not availability: at roughly a tenth of a cent a turn that is about 10,000 turns, and a script burns it in under an hour. The failure mode is now "a stranger turns the tutor off for everyone", not "a large bill".
5. **Baked demo mode.** Gated on 1 and 2.
6. `?step=` on the four lessons that lack it, so away links land where they say.

## Logging

`api/_log.js`, `api/_schema.sql`, `demos/tools/db.js`. Neon Postgres over HTTP, one fetch per statement, because a function that may be frozen the moment it responds cannot hold a pool.

**One row per message, two per exchange.** The question's row carries the moment it was asked in (`step`, `state`); the answer's row carries how it was produced (`point`, `chapters`, `provider`, `model`, `usage`, `ms`). They share `turn`, and the `turns` view joins them. That pairing is the whole point: the aiming question is always "given *that* screen, why *that* target", and a transcript of text alone cannot answer it.

**Failed turns get a row too**, with `error` set and `text` holding what the student was actually shown. A log of successes only would hide the failure you most want to see.

**No IP, no user agent, no name.** A visitor is a random uuid the browser minted for itself. `visitor` lives in `localStorage`, so a second visit is recognisable as the same browser; `thread` is minted per page load, so a conversation is a conversation rather than one endless transcript per device. Clearing site data clears both.

**A logging failure must never cost a student an answer.** `logTurn` swallows everything to the console and carries its own 2s budget; `handleAsk` awaits it and cannot be rejected by it. It is awaited rather than fired and forgotten because a serverless function may be frozen the instant it responds, and a promise left running is a row that never lands. `check-ask.js` asserts the swallowing offline, with no database, by handing `logTurn` the shapes a bad turn produces — and asserts every column `logTurn` writes exists in the `messages` block of the DDL, matched inside that block alone, because the `turns` view names most of them too and matching the whole file lets a renamed column pass.

**Off by default.** No `DATABASE_URL` means every call is a no-op, which is what a checkout without a database gets and what GitHub Pages gets.

**The viewer is `demos/ask/log.html`**, over `api/log.js`. Every exchange as a card: the question, the answer, where it pointed, and the screen it was asked against as chips. The left edge is coloured from the thread id, so a conversation reads as one block without a grouping UI; home / away / nothing is said in the meta line instead. Filter by lesson, by model, or to the answers that pointed nowhere, which is the pile worth reading first. Failed turns keep their state chips. System fonts and no web font: a tool reading a local database should not need the network to render.

**A row of model cards sits above the list**, one per model that has answered, each with its turn count, average latency and average spend. Click one to filter to it. Those three numbers are the comparison the totals hide, and they are step 3's instrument: the first time two models ran side by side here, `gemini-3.5-flash-lite` came back faster and *twice as expensive per turn*, because it has no context caching and pays full rate for a prompt `3.7-flash` reads back at a tenth. A cheaper tier is not a cheaper turn.

**Hue is the vendor and nothing else** - blue for Gemini, amber for Claude - with variants separated by depth rather than hue. Green and purple already mean "pointed at this lesson" and "pointed at another one", and a model drifting into either is a third thing wearing a colour that has a meaning. Letting hue vary did exactly that.

**The viewer is not deployed**, by `.vercelignore`, and `/api/log` answers only to the machine it runs on. There is no token because there is nothing to reach: the log lives in Neon, so `.env.local` points at the same database production writes to and the dev server shows real student data with nothing public in the path. A secret exists to be leaked; not needing one beats guarding one. The static page still publishes to Pages, where there is no `/api` at all, so it is inert there.

**An answer is paired with its question by `reply_to`, never by `(thread_id, turn)`.** A client using the single-question form has no transcript to count, so it numbers every question 1, and a join on the turn number multiplies two questions against two answers. Counts double and nothing errors. `turn` is now counted server-side from the rows already in the thread and is display only; `check-ask.js` asserts the view joins on `reply_to`.

```bash
node demos/tools/db.js init     # apply the schema, idempotent
node demos/tools/db.js recent   # last 20 exchanges, screen beside aim
node demos/tools/db.js aim      # where the tutor pointed, by target
node demos/tools/db.js cost     # turns, tokens and dollars per day
```

`cost` reads the `cost_usd` the provider priced, so it quotes the rate that served the request rather than doing its own arithmetic against a table it would have to keep in step. It still understates: cache writes and cache storage are not in `usageMetadata`, as above.


## Demo mode (designed, not built)

The free tier stops being a throttled live tutor and becomes its own thing: a fixed set of questions whose answers were generated ahead of time, through the real prompt, and frozen. A hit renders in tens of milliseconds with its real `point` and its real chapters. Nothing generates, so there is no per-turn cost and nothing worth rate limiting.

**The corpus already exists.** The `turns` view is a table of `(question, answer, point, chapters, lesson, step)`, real questions with answers the real prompt produced. Baking is *selecting rows out of the log*, not authoring a new artefact, and a human picks which ones are fit to teach. That is the precondition: **there is nothing to curate until real students have asked real questions**, which is why the bake sits behind deploying.

**The integration is one function.** `answer(data)` in `chat.js` takes a plain `{answer, chapters, point}` and draws the reply, the Show me pill and the citations. A baked entry is already that shape, so demo mode is a source swap in front of one function. No second renderer, and nothing to keep in sync when the drawer changes.

**A baked entry stores the target's id, not the resolved target.** Resolution stays in `_targets.js` at serve time, exactly as the live path does it, which keeps the load-bearing property (an id from a constrained enum, resolved where the catalog lives) and makes a renamed target fail loudly rather than link somewhere wrong. Embeddings live beside the entries as an int8 binary sidecar, never JSON: the same vectors as JSON parse an order of magnitude slower on every cold start.

**Matching: an embed-only endpoint, with curated buttons as the static fallback.** The free tier's only model call becomes an embedding. Everything after it is local: a prototype measured brute-force cosine at 6.2 ms over 1148 items, and a baked set is an order of magnitude smaller, so **no vector database and no second service**. On GitHub Pages there is no `/api`, so the drawer offers its questions as a list instead of a text field, same entries and same renderer. That gives Pages a working tutor demo for the first time, where today the launcher never appears at all. The query cannot be embedded in the browser: that needs the model, which means a key in the page or a model download measured in tens of megabytes.

**Why "embed-only" is the security answer and not just the fast one.** Two properties, and the second is the one to rely on. *An embedding cannot be made expensive*: a generation's cost scales with what comes out, and the caller controls that (a thinking turn costs about 3x one that does not), while an embedding produces no output at all and its cost is a function of input length, already capped by `MAX_CHARS`. The worst case per request is fixed and knowable, which `/api/ask` never is. *Its output space is finite and pre-approved*: everything it can return was written before the request arrived and read by a human, so there is no prompt to inject into. A hostile question can at worst select a different pre-written answer. Same principle as the model returning ids from a constrained enum, extended to the whole free tier.

### Embeddings, measured

Not the same model. `gemini-3.7-flash` supports `generateContent, countTokens, createCachedContent, batchGenerateContent` and **not** `embedContent`; generative and embedding models are separate families everywhere, not a Gemini quirk. The key already carries `gemini-embedding-001` and `gemini-embedding-2` (both 3072 dims; 2048 and 8192 token inputs). So this is an `embed()` beside `ask()` in `_providers/gemini.js`, one more model name, no new dependency and no second key.

**Latency is ~350-400 ms, not tens of milliseconds.** It is a network round trip and that dominates; the local cosine really is ~1 ms. A demo answer lands in about half a second. Still roughly 4x faster than the live tutor and with no thinking-variance tail, but do not design against the smaller number.

**Truncation to 512 dimensions works** (`outputDimensionality`), which is what makes the storage plan viable: 3072 float32 is 12 kB *per question*, 512 int8 is 512 bytes. For a few hundred questions that is the difference between a 2 MB blob and a 100 kB one.

**The 0.95 threshold from generic RAG advice is wrong here, and it fails closed in the worst way - by rejecting real hits.** Measured against one baked question:

```
paraphrase   vs baked :  0.772     <- must hit  ("how come frozen water sits on top")
other baked  vs baked :  0.616     <- must miss (a different baked question)
off topic    vs baked :  0.500     <- must miss ("who invented the microscope")
```

The ordering is right, but these models do not produce cosines in the range that advice assumes, and the usable gap is about 0.62 to 0.77: narrower than comfortable. **The threshold must be calibrated against the real baked set with real student phrasings**, which is what makes the fixture eval load-bearing rather than a nicety: it is the only thing that measures whether the gap between "same question" and "different question" is wide enough to be safe. If it is not, curated buttons stop being the fallback and become the design.

**Not a lexical match in the page.** The same prototype found four ranking defects from lexical effects: a coincidental rare word placing an item, question filler scoring as content, companions drifting to the wrong chapter, compound words matching nothing. That was with a curation layer catching them. On a public demo with nobody in the loop, a confident wrong match is worse than an honest miss.

**Four things that must not happen.**

* **A miss dressed as a hit.** Below the similarity threshold the demo says it does not have that question and offers the ones it does. Never the nearest neighbour served as an answer. The cost of a false hit is a student taught something the tutor never said about their screen.
* **A state-dependent answer getting baked.** `crowding` is a phrase and not a number because a shipped threshold once told a student with 13 molecules to add more. A baked answer has no screen at all, so a candidate whose text leans on its own `state` is disqualified. Machine-checkable: flag candidates whose answer overlaps their state chips.
* **A silent stale bake.** A baked `point` naming a target a lesson has since renamed is invisible from the page, the same class of failure as a stale residue table. Wants a checker gated on the lesson files and `_targets.js`, in the pattern the repo already uses three times.
* **A demo that hides what it is.** The empty state says the answers are pre-written, before the first question, not after a student notices.

**What it does not solve.** The live path still needs the rate limit, since demo mode removes the free tier's exposure and not the live tutor's. Multi-turn does not bake: a logged answer beginning "Yes! Oil molecules are nonpolar" is only correct as turn 2 of its own conversation, so the demo is one question and one answer. And a checker catches a renamed target, never a sentence that has quietly become wrong.

### The access link

A link that turns the live tutor on, no accounts. It needs no new concept: **no key means demo mode, a valid key means the live tutor**, so the public site degrades to the baked demo rather than to an error.

**The key rides in the URL once.** `?k=` on the shared link, then into `localStorage`, then stripped from the address bar, and sent as a header on every request after that. A query string ends up in server access logs, browser history and screenshots; a header ends up in none of them. Same reason `LOG_TOKEN` was dropped rather than fixed.

**Keys name a cohort, not a person**: `TUTOR_KEYS=bio101-fall:<secret>,openday:<secret>`. The *label* is written to the thread row, so the log shows usage per cohort, a link that escapes is revoked on its own without cutting anyone else off, and a rate limit attaches to the label.

**It is a bearer token and nothing more.** Everyone it is forwarded to has it, and there is no way around that without accounts. So it protects *spend*, never anything private, and the prepaid cap stays the real backstop. Leakage is expected and rotation is routine. If it ever has to be more than that, it needs accounts, and that is a different design.

### Where to start

Not with the baker. With a selection pass that only *prints*: logged turns grouped by near-duplicate question, state-dependent ones flagged, candidates per lesson. If real questions turn out not to repeat, that is learned for the price of one script instead of a subsystem. Then the baked files, then the checker, then static demo mode (shippable on its own), then free text via the endpoint, then a fixture eval of question to expected entry id on every rebuild, because a re-embedding degrades matching silently.

Planned filenames, so a reader can tell design from code: `bake-answers.js`, `check-baked.js`, `api/match.js`. None of them exist.

**Nothing checks this file.** `check-docs.js` reads `demos/*.md` and `demos/tools/*`, not the repo-root `docs/`, so every filename named here is an unverified claim, including the ones above. Widening it needs `api/`, `api/_providers/` and `ask/` added to its `SEARCH` list first, or real files like `chat.js` and `gemini.js` report as missing; doing that also surfaces three genuinely stale references in `ToDo.md` and `molecule-pipeline.md`. Worth doing, and it is not this document's job to pretend it is already done.


## What a session costs

About **half a cent per turn**, measured, on `gemini-3.7-flash`. An eight-turn session is a cent or two. Thirty students is under a dollar.

The prompt is split in two because the two halves are priced differently. `situation(lesson)` is the catalog, the target list and the sim notes: byte-identical for every question asked on that page, by every student, all day, so it is held server-side and read back at a tenth. `moment(lesson, step, state, cited)` is the step they are standing on, their screen readings and what they have already been cited, and it rides in front of the newest question instead. For `water-lab` the split is about 94% cacheable; `check-ask.js` prints the current size per lesson rather than this paragraph naming one that will rot.

This is what the ordering is for, and it is easy to undo by accident: move the step sentence back up into `situation` and everything after it stops matching, the discount silently stops applying, and no answer looks any different. `check-ask.js` asserts `situation()` does not vary with step or state, because that is the only symptom there is.

**Do not trim the cacheable half. There is a cliff under it.** Every model has a minimum prompt length it will cache, and under it the discount silently stops applying. Break-even against a cached prompt is about **200 tokens**: a cached 2,000-token prompt costs what an uncached 200-token one costs. So no trim of `situation` ever wins, and a trim that crosses the floor costs several times more for a *shorter* prompt. `SYSTEM` alone is under every floor, which is why the plain ask box, with no lesson, never caches at all.

**The floor is a per-model fact, so it lives in the provider next to `PRICE`, as `CACHE_MIN`.** It is not guessable from the tier and it is not monotonic across generations: `gemini-3.7-flash` caches from 1,024 tokens (measured - send it less and the API names the number back), Claude Opus 5 from 512, Sonnet 5 from 1,024, and **Haiku 4.5 only from 4,096**. No lesson prompt is anywhere near 4,096, so switching to Haiku to save money would turn caching off for every lesson at once. `null` means the model has no context caching (flash-lite), `undefined` means nobody has measured it and nothing is asserted.

The lessons sit a few hundred tokens above Gemini's floor, and dropping the away-lesson target lists is exactly what would push them under. `check-ask.js` prints each lesson's size and its clearance, warns when the margin gets thin, and fails below the floor. It reads the floor off whichever provider `AI_PROVIDER` selects rather than holding a copy, so changing the model changes the check: point it at Haiku and it fails every lesson, point it at flash-lite and it stops asserting and says why. The estimate is characters over five, deliberately low by about 10%, so it errs toward warning about a lesson that was fine rather than clearing one that was not. It stays offline: the true count needs `countTokens`, the network and a key, and this checker requires none of them.

Going the other way, adding to `situation` is nearly free at a tenth rate. **The limit on prompt size is aiming accuracy, not money** - every target added is one more way for the model to point wrong. Trim `moment` instead, where every token is full price: at \~130 tokens it costs about two-thirds of what the entire cached half costs.

**What the cost readout does not see:** writing a cache entry is billed at the input rate and holding it is billed by the hour, and Gemini reports neither in `usageMetadata`. The printed figure understates the first question against a cold instance. It is small against what the reads save; it is still an understatement.

**Output is now the larger half of the bill**, which it was not before. If cost needs to come down again, the lever is answer length, not the prompt, and **not `thinkingLevel`**: measured, `NONE` is not a valid value for that field on `gemini-3.7-flash` and `MINIMAL` is rejected as unsupported, so `LOW` is already the floor.

`LOW` is not a flat spend either. It is adaptive, and it buys the aiming. Four real questions:

```
1340ms  thoughts    0  answer  80  | Why does ice float?
2425ms  thoughts  320  answer  80  | What makes water polar?
1756ms  thoughts    0  answer  77  | How does a pump differ from a channel?
2698ms  thoughts  485  answer  63  | Who invented the microscope?
```

Nothing on the easy ones, 300 to 500 tokens on the hard ones, and latency tracks it exactly: about 1.4s without thinking, 2.5s with. The ~2s average is a blend of two populations, not a flat cost. Note **which** two it thought about: the polarity question, and the one that must point at *nothing*, which is the hardest call the tutor makes. Thinking is being spent where the aiming is hard.

Those thought tokens bill as output at the output rate, so a thinking turn runs about 3x a non-thinking one. It is a real cost driver and not one that can be dialled down without changing model. `thoughtsTokenCount` is folded into `output` in the stored usage, so the log cannot show this split; measuring it needs a direct call.

**The rate doubles on 2026-12-31.** `gemini-3.7-flash` is priced promotionally at $0.75/$3.75 per 1M tokens in/out; after that date it is $1.50/$7.50. Nothing in the repo changes and nothing fails - the same questions cost twice as much. It is the only number here that moves on a schedule rather than when someone edits something, so it is the one worth a calendar entry. The rates live in `gemini.js`'s `PRICES` table and must be updated there, not here, or the cost readout starts quoting the old ones.

**Per-session cost is not the risk; the tail is.** `MAX_TURNS = 40` with a growing transcript means one thread's worst case is many times the median, and a public endpoint with no rate limit is where that gets spent. Still next step 2.

## Key context

**Files.** `api/_tutor.js` (prompt in two halves, schema, validation, retries), `api/_catalog.js` (7 chapters), `api/_targets.js` (35 targets across 5 lessons + per-lesson `notes`), `api/_providers/` (one module per vendor), `demos/ask/chat.js` + `chat.css` (the module), `demos/ask/check-ask.js`, `demos/water-lab.html` (the only page with a drawer), `api/_log.js` + `api/_schema.sql` + `demos/tools/db.js` + `api/log.js` + `demos/ask/log.html` (the log and its viewer).

**Run it.** `node demos/tools/dev-server.js` — it serves `/api/*` by requiring the same handler Vercel runs, lazily and uncached, so editing `api/` takes effect on the next question with no restart. Needs `npm i` at the repo root. Key goes in `.env.local` (gitignored; copy `.env.local.example`), and `DATABASE_URL` beside it if you want the log.

The “Ask a Question” button and chat drawer are only added to the page if the server is running. See demos/ask/chat.js:48

Thus on Github pages, this feature is hidden.

**The provider contract is `ask({system, context, messages, schema})`.** Two strings, because they are priced differently: `system` is the cacheable half, `context` is this turn's. A provider that concatenates them still answers correctly and quietly pays full rate, which is the failure mode to watch for when adding a third vendor. Gemini holds `system` as a cached-content handle and cannot send `systemInstruction` alongside it; Claude sends both as system blocks with the cache breakpoint between them. Both fall back to inline on any cache failure.

**The load-bearing idea.** The model returns *ids from a constrained enum*, never selectors, coordinates or prose. Chapters and targets are both resolved server-side into titles and hrefs. A wrong id is impossible; a wrong selector would be silent. Keep this when extending.

**Only steps travel.** A lesson offers its whole target list at home and only its steps to other lessons: a control you cannot reach is not a destination. This is also what stops the prompt growing by a whole lesson at a time.

**Judgements belong in the page, not the prompt.** Shipping a threshold and asking the model to compare failed — it told a student with 13 molecules to add more. The page now sends `crowding` as a *phrase* and the note keys off the word. Same rule as reading a rendered number instead of typing one.

**Read facts where they live.** Bitten twice: the hydration shell was lit by "six nearest waters" when the sim records `userData.shellIon`, and the hydrogen bond was re-derived from geometry when the matcher already knew the donor, which H, and the acceptor (it now records `userData.hbBonds`).

**Notes can outlive the limitation they describe.** A note saying "the slider is locked until step 3" kept the tutor from pointing at it long after `act()` could hop there. The checker cannot catch a stale sentence. Re-read `api/_targets.js` notes whenever a page gains a capability.

**Gotchas.**

* A hidden browser tab pauses rAF *and CSS animations*. A computed style sampled there reads as "not running"; the sim also stops, so no H-bonds form and the salt crystal never lands. Front the tab before believing a measurement.
* `#askchat { display: flex }` silently beats `[hidden] { display: none }`. Open and closed is the `.on` class and nothing else. Do not reintroduce `hidden`.
* The launcher is only added once `GET /api/ask` answers, so the tutor is simply absent on GitHub Pages instead of showing a JSON parse error.
* Gemini 503s under load. Retries are in `_tutor.js`; 4xx never retries.
* `api/` publishes as readable source on Pages. The system prompt is public. No key is in it.

**The bench is localhost.** Editing the tutor's prompt and picking a provider per request are developer affordances, and the question they really ask is "am I on the machine serving this". That is `api/_local.js`, checked by the transport (`api/ask.js`, `dev-server.js`) and passed into `handleAsk(payload, {bench})` and `config(bench)` as an argument. `handleAsk` stays transport-free: it receives a boolean, never a request.

This replaced an `ASK_BENCH=1` environment variable, and the reason is worth keeping. A flag is safe only while somebody remembers not to set it, it is silent when it is wrong, and it travels to production inside whatever gets pasted into a project's settings - `.env.local.example` shipped it *uncommented*, so the documented way to set up a local environment turned it on. An address cannot be forgotten: no real request to a deployment is ever loopback, so the capability is absent by construction. The variable no longer exists; setting it does nothing. `X-Forwarded-For` is deliberately not consulted, or the bench belongs to anyone who types a header.

The stakes were not only money. With the prompt replaceable, the endpoint answers as whatever a stranger says it is, on your domain, and everything `SYSTEM` does for safety goes with it.

**Benches.** `demos/ask/chat-test.html` (multi-turn, editable prompt, scored aim probes) and `ask-test.html` (single-shot). Both need the API served from the same machine; there is nothing to configure. **The chat bench has drifted**: it sends no `state` and does not know about the sim notes, so tuning there no longer predicts the lesson. Reconcile or retire it.

**Audience.** The tutor prompt says *high school*, chosen deliberately, even though `demos/CLAUDE.md` frames the lessons for college Bio 101.
