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

1. **Rate limit + deploy.** No limit exists; a public LLM endpoint without one is a free-money faucet. Vercel WAF rule on `/api/ask`. `vercel.json` exists but is untested. **`ASK_BENCH` must be unset in production** or a visitor can rewrite the tutor's prompt.
2. **Judge answer quality.** Never done properly. Multi-turn drift past turn 4, the 3-sentence cap, citation repetition, and flash-lite vs 3.7-flash vs Claude on the same questions.
3. **Second lesson mount.** Everything is justified by one page. Glycolysis is the real test (10 steps, existing hotspots, modals to coexist with).
4. `?step=` on the four lessons that lack it, so away links land where they say.

## Logging

`api/_log.js`, `api/_schema.sql`, `demos/tools/db.js`. Neon Postgres over HTTP, one fetch per statement, because a function that may be frozen the moment it responds cannot hold a pool.

**One row per message, two per exchange.** The question's row carries the moment it was asked in (`step`, `state`); the answer's row carries how it was produced (`point`, `chapters`, `provider`, `model`, `usage`, `ms`). They share `turn`, and the `turns` view joins them. That pairing is the whole point: the aiming question is always "given *that* screen, why *that* target", and a transcript of text alone cannot answer it.

**Failed turns get a row too**, with `error` set and `text` holding what the student was actually shown. A log of successes only would hide the failure you most want to see.

**No IP, no user agent, no name.** A visitor is a random uuid the browser minted for itself. `visitor` lives in `localStorage`, so a second visit is recognisable as the same browser; `thread` is minted per page load, so a conversation is a conversation rather than one endless transcript per device. Clearing site data clears both.

**A logging failure must never cost a student an answer.** `logTurn` swallows everything to the console and carries its own 2s budget; `handleAsk` awaits it and cannot be rejected by it. It is awaited rather than fired and forgotten because a serverless function may be frozen the instant it responds, and a promise left running is a row that never lands. `check-ask.js` asserts the swallowing offline, with no database, by handing `logTurn` the shapes a bad turn produces — and asserts every column `logTurn` writes exists in the `messages` block of the DDL, matched inside that block alone, because the `turns` view names most of them too and matching the whole file lets a renamed column pass.

**Off by default.** No `DATABASE_URL` means every call is a no-op, which is what a checkout without a database gets and what GitHub Pages gets.

**The viewer is `demos/ask/log.html`**, over `api/log.js`. Every exchange as a card: the question, the answer, where it pointed, and the screen it was asked against as chips. The left edge is coloured from the thread id, so a conversation reads as one block without a grouping UI; home / away / nothing is said in the meta line instead. Filter by lesson, or to the answers that pointed nowhere, which is the pile worth reading first. Failed turns keep their state chips.

**The viewer is not deployed**, by `.vercelignore`, and `/api/log` answers only to the machine it runs on. There is no token because there is nothing to reach: the log lives in Neon, so `.env.local` points at the same database production writes to and the dev server shows real student data with nothing public in the path. A secret exists to be leaked; not needing one beats guarding one. The static page still publishes to Pages, where there is no `/api` at all, so it is inert there.

**An answer is paired with its question by `reply_to`, never by `(thread_id, turn)`.** A client using the single-question form has no transcript to count, so it numbers every question 1, and a join on the turn number multiplies two questions against two answers. Counts double and nothing errors. `turn` is now counted server-side from the rows already in the thread and is display only; `check-ask.js` asserts the view joins on `reply_to`.

```bash
node demos/tools/db.js init     # apply the schema, idempotent
node demos/tools/db.js recent   # last 20 exchanges, screen beside aim
node demos/tools/db.js aim      # where the tutor pointed, by target
node demos/tools/db.js cost     # turns, tokens and dollars per day
```

`cost` reads the `cost_usd` the provider priced, so it quotes the rate that served the request rather than doing its own arithmetic against a table it would have to keep in step. It still understates: cache writes and cache storage are not in `usageMetadata`, as above.


## What a session costs

About **half a cent per turn**, measured, on `gemini-3.7-flash`. An eight-turn session is a cent or two. Thirty students is under a dollar.

The prompt is split in two because the two halves are priced differently. `situation(lesson)` is the catalog, the target list and the sim notes: byte-identical for every question asked on that page, by every student, all day, so it is held server-side and read back at a tenth. `moment(lesson, step, state, cited)` is the step they are standing on, their screen readings and what they have already been cited, and it rides in front of the newest question instead. For `water-lab` the split is about 94% cacheable; `check-ask.js` prints the current size per lesson rather than this paragraph naming one that will rot.

This is what the ordering is for, and it is easy to undo by accident: move the step sentence back up into `situation` and everything after it stops matching, the discount silently stops applying, and no answer looks any different. `check-ask.js` asserts `situation()` does not vary with step or state, because that is the only symptom there is.

**Do not trim the cacheable half. There is a cliff under it.** Every model has a minimum prompt length it will cache, and under it the discount silently stops applying. Break-even against a cached prompt is about **200 tokens**: a cached 2,000-token prompt costs what an uncached 200-token one costs. So no trim of `situation` ever wins, and a trim that crosses the floor costs several times more for a *shorter* prompt. `SYSTEM` alone is under every floor, which is why the plain ask box, with no lesson, never caches at all.

**The floor is a per-model fact, so it lives in the provider next to `PRICE`, as `CACHE_MIN`.** It is not guessable from the tier and it is not monotonic across generations: `gemini-3.7-flash` caches from 1,024 tokens (measured - send it less and the API names the number back), Claude Opus 5 from 512, Sonnet 5 from 1,024, and **Haiku 4.5 only from 4,096**. No lesson prompt is anywhere near 4,096, so switching to Haiku to save money would turn caching off for every lesson at once. `null` means the model has no context caching (flash-lite), `undefined` means nobody has measured it and nothing is asserted.

The lessons sit a few hundred tokens above Gemini's floor, and dropping the away-lesson target lists is exactly what would push them under. `check-ask.js` prints each lesson's size and its clearance, warns when the margin gets thin, and fails below the floor. It reads the floor off whichever provider `AI_PROVIDER` selects rather than holding a copy, so changing the model changes the check: point it at Haiku and it fails every lesson, point it at flash-lite and it stops asserting and says why. The estimate is characters over five, deliberately low by about 10%, so it errs toward warning about a lesson that was fine rather than clearing one that was not. It stays offline: the true count needs `countTokens`, the network and a key, and this checker requires none of them.

Going the other way, adding to `situation` is nearly free at a tenth rate. **The limit on prompt size is aiming accuracy, not money** - every target added is one more way for the model to point wrong. Trim `moment` instead, where every token is full price: at \~130 tokens it costs about two-thirds of what the entire cached half costs.

**What the cost readout does not see:** writing a cache entry is billed at the input rate and holding it is billed by the hour, and Gemini reports neither in `usageMetadata`. The printed figure understates the first question against a cold instance. It is small against what the reads save; it is still an understatement.

**Output is now the larger half of the bill**, which it was not before. If cost needs to come down again, the lever is `thinkingLevel` and answer length, not the prompt.

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

**Benches.** `demos/ask/chat-test.html` (multi-turn, editable prompt, scored aim probes) and `ask-test.html` (single-shot). **The chat bench has drifted**: it sends no `state` and does not know about the sim notes, so tuning there no longer predicts the lesson. Reconcile or retire it.

**Audience.** The tutor prompt says *high school*, chosen deliberately, even though `demos/CLAUDE.md` frames the lessons for college Bio 101.
