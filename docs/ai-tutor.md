# AI tutor chat

## Goal

A science question box and an in-lesson tutor chat. The tutor answers in ≤3 sentences, cites chapters, and **points at things on the page**: a step, a control, or specific atoms. Backed by a serverless function so the API key never reaches the browser. Target deploy is Vercel; the lessons stay static.

## Status

Runs locally only. Nothing is deployed and **nothing is logged**.

Working end to end on `demos/water-lab.html`:

* multi-turn chat in a floating panel, launched from a button in the rail
* answers cite chapters, and never the chapter you are standing on
* **Show me** pill acts in place; an outlined pill links to another lesson
* aiming hits \~10/12 on the probe set (5 home, 5 away, 2 correctly none)
* highlights are atom-level via `kit/focus.js`: one oxygen, or the two atoms at either end of a real hydrogen bond
* controls get cyan rings, sized to a slider's *thumb*, not its track
* the tutor sees live scene state (molecule count, temperature, phase, salt)
* provider switch: Gemini (default, `gemini-3.5-flash-lite`) or Claude, one env var

## Next steps, in order

1. **Logging.** Never built, and it blocks judging everything else. Neon Postgres, `threads` + `messages`, `thread_id` in `localStorage`, no IP. Log `point` and `state` alongside the question, not just the text — that turns the log into a debugging tool for the aiming.
2. **Rate limit + deploy.** No limit exists; a public LLM endpoint without one is a free-money faucet. Vercel WAF rule on `/api/ask`. `vercel.json` exists but is untested. **`ASK_BENCH` must be unset in production** or a visitor can rewrite the tutor's prompt.
3. **Judge answer quality.** Never done properly. Multi-turn drift past turn 4, the 3-sentence cap, citation repetition, and flash-lite vs 3.7-flash vs Claude on the same questions.
4. **Second lesson mount.** Everything is justified by one page. Glycolysis is the real test (10 steps, existing hotspots, modals to coexist with).
5. `?step=` on the four lessons that lack it, so away links land where they say.

## Key context

**Files.** `api/_tutor.js` (prompt, schema, validation, retries), `api/_catalog.js` (7 chapters), `api/_targets.js` (35 targets across 5 lessons + per-lesson `notes`), `api/_providers/` (one module per vendor), `demos/ask/chat.js` + `chat.css` (the module), `demos/ask/check-ask.js`, `demos/water-lab.html` (the only page with a drawer).

**Run it.** `node demos/tools/dev-server.js` — it serves `/api/*` by requiring the same handler Vercel runs, lazily and uncached, so editing `api/` takes effect on the next question with no restart. Needs `npm i` at the repo root. Key goes in `.env.local` (gitignored; copy `.env.local.example`).

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
