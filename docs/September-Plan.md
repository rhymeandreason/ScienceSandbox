<!-- KIND: argument — the September plan for the app builder. Read for priority and reasoning, not during a build. -->

# September plan: the app builder

**Goal.** A hosted builder where students and teachers make single-page biology apps from a tested library, with cheap, fast LLM generation and edits. Easier than a coding agent, because the model composes components and never writes Three.js.

**The evidence the plan rests on.** Water-lab is the model: with the physics in `water/watersim.js`, the page is under a thousand lines, most of it lesson text. Membrane-lab was the counterexample: the lathe machines were a module but about 2,400 lines of page script sat inline. The product's ceiling is the component library. The LLM is a thin layer over it.

**Three tiers of authoring fall out of that.**

| Tier | What the author does | Who does the work |
| --- | --- | --- |
| 0 | Pick a template, change parameters | No model, or a tiny one |
| 1 | Compose components, wire sliders to `set` and a graph to `state`, write prose | A small model |
| 2 | Build a new component | Mary, with a full coding agent |

Generated apps will be the median, not the bespoke. The featured lessons stay hand-built and set the bar for what the next component has to do.

## Library first

1. **Component contract.** `X.mount(el, params)` returns `{set(params), state(), on(event, fn), destroy()}`. `state()` feeds the tutor drawer per turn today and feeds the builder's LLM when it debugs an app tomorrow. (Done)

2. **Extract Membrane.** Move membrane-lab's inline logic into a Membrane component. Then protein box, molbox, and a small graph. The salmon question is Membrane plus a graph plus a parameter sweep. (Done)

3. **Invariants live in the components.** A remixer can make ice denser than water. Clamp parameter ranges inside the module and keep the existing checkers as the gate. The generator cannot be trusted with accuracy and does not need to be if the components refuse to lie.

4. **One stack.** Tree and Leaf use ES modules and importmaps on Three 0.165 and 0.170; the featured lessons use r128 as a global. Two Three versions cannot coexist. Script tags and globals are the more robust LLM target and the easier sandbox. Decide, then port Tree and Leaf, which are the cell and organism-scale procedural models the scale ladder needs.

5. **Freeze the library.** Student apps live forever. Serve it at a pinned path like `/lib/v1/kodo.js` and `/lib/v1/kodo.css` by Vercel rewrite, and never change v1 behaviour. A behaviour change cuts v2. Serving from our own origin keeps the iframe CSP simple.

6. **A graph component.** Small, SVG, no library, using the existing design tokens. Wired to `state()`.

## Prove the format by hand

Write three apps in the target form before any LLM code: salmon osmosis, one lab experiment, one Tree-scale app. If the format holds, they become the generator's eval set. If it does not, the missing component was found cheaply. Store them in the `apps` table as the first rows, so the render route is testable with zero model calls.

## Backend, extending `api/`

What exists: serverless functions on Vercel with a provider layer for Anthropic and Gemini; Neon Postgres with `threads`, `messages`, and `finds` (whose `extend` rows already store a generated `answer` as JSON); cohort keys in `_keys.js`; a Postgres rate limit in `_limit.js` that fails open; loopback-gated developer affordances in `_local.js`; the privacy posture of no IP, no name, a browser-minted visitor id. All of it carries over.

1. **An `apps` table.** id (unguessable), cohort, title, html, parent_id for remix lineage, hashed edit token, nullable owner_id for accounts later, created_at. Store the HTML string itself: the app is exactly what the student sees and exports. Save every version as a new row, never an overwrite. An LLM edit that breaks the app is the common case, and undo is what makes people trust the editor.

2. **A render route.** `/app/<id>` serves the stored HTML in an iframe via `srcdoc` with `sandbox="allow-scripts"` and no `allow-same-origin`. The app runs on an opaque origin and cannot reach cookies, the parent's localStorage, or the API with the viewer's key. The parent owns the chrome: title, remix, the prompt box. The iframe posts `window.onerror` up to the parent, and the next edit turn carries those errors. This is the biggest quality lever for a low-cost model.

3. **A build endpoint** shaped like `extend.js`. In: prompt, current HTML when editing, the component reference (cached). Out: HTML, or a diff for edits. Logs provider, model, usage and latency per turn the way `messages` does. Gated by the same key as the tutor, so a forwarded email cannot spend the budget. The extend rule carries over: the model may only assemble from what exists.

   **The reference is the cached prefix.** `_tutor.js` already sends two strings: `stable` (the system prompt plus the lesson's situation), which the provider caches, and `context` (the moment), which pays full rate. The build endpoint uses the same split. Stable is the system prompt plus `Components.md`, about 2,800 tokens today and growing with each component; that growth is fine, since a cache read is a tenth of an input token and the prefix only changes on deploy. Context is the per-app HTML, the last runtime errors and any selection, since those change every turn.

   **The prefix must clear the model's cache minimum.** `CACHE_MINS` in `_providers/anthropic.js`: Sonnet 5 wants 1,024 tokens, Haiku 4.5 wants 4,096, and under the minimum the prompt silently does not cache. The reference alone is under Haiku's line, so "use the small model for edits" would turn the cache off. Fix that by putting the three hand-built apps into the stable prefix as worked examples. That lifts it past 4,096 on every model and teaches the format at the same time, which is worth doing anyway.

4. **Export.** One button that downloads the HTML with library paths made absolute.

5. **Save rate.** Cap saves per token per minute so a runaway page loop cannot fill the table. No model cost, still a row.

Do not sanitise generated HTML. Sandbox everything instead.

## Edits, not just first drafts

Most turns are follow-ons: "make the graph bigger", "add a slider for salinity", "why is it blank". The first draft is the cheap case. The design is for the edit.

**An app has a thread.** Reuse the `threads` and `messages` shape: one thread per app, one user message per request, one assistant message per turn carrying the edit and its usage. The transcript holds prompts and one-line edit summaries, never past HTML. The current HTML rides in the uncached context each turn, so the model always sees the file as it is and the transcript stays small.

**The model returns search/replace blocks, not a whole file.** Output tokens are the expensive ones and the slow ones, and a whole-file rewrite of three hundred lines to change one word is where a "fast edit" goes to die. Unified diffs fail on line numbers. A search/replace block applies exactly or fails loudly. On a failed apply, retry once asking for the whole file, then surface the failure. The server applies the edit, stores the result as a new version row, and returns the HTML plus the summary line.

**Validate before storing.** Parse the result, check every script tag points at `/lib/v1/`, check every component it mounts is in the reference. A failed check goes back to the model as the next turn's error, not to the student as a broken page.

**Runtime errors close the loop.** The iframe posts `window.onerror` and unhandled rejections to the parent. The next turn carries them automatically as "the previous edit produced these errors", whether or not the student mentions them. A student saying "it's blank" and the model seeing `Membrane is not defined` is the difference between one turn and four.

**Selection scopes the request.** The student clicks a component or a paragraph in the preview and types "this one, bigger". The parent chrome knows the element and passes its outer HTML as the anchor in context. Cheap, and it makes small edits land where the student pointed.

**Parameter changes need no model.** An app declares its parameters in one data block. The chrome renders them as controls and edits the block directly. Tier 0 costs nothing per turn, and the student learns that the numbers are the physics.

**Undo is a pointer move.** Every turn is a version row, so undo and "go back to the one that worked" spend no model call. Show the versions as a list with their summary lines.

**Escalate on failure, not by default.** A small model does the edit. After a failed apply or two turns in a row that end in runtime errors, the next turn goes to the larger model. Log which model produced each version so the escalation rate is a query.

## Access and ownership

**Beta testers get personal keyed links.** `TUTOR_KEYS` is `label:secret,label:secret`. One pair per person, the label is their name, the link is `/build?k=<secret>`. The page copies the key to storage and strips it from the address bar exactly as water-lab does. The label is what the log and the limit count against, so each tester's builds show by name and one person is revoked by removing one pair. The key is the default owner of what they build. A vanity path like `/build/mary` can rewrite to the keyed URL, but the secret must still be in the link or the path is guessable.

**Each app has two links.** View: `/app/<id>`, anyone can see and remix. Edit: `/app/<id>?e=<secret>`, the secret stored hashed on the row the way cohort keys are, compared in constant time, a miss is a 403. After the first visit the page saves the token to localStorage and `history.replaceState`s it away, so copies of the address bar, screenshots and referrers do not leak edit rights.

**Remix forks.** A new row with `parent_id` set and a fresh edit token. The original is never touched. A remix does not see the original's build prompts by default; the author can opt in.

**Unlisted by default.** Ids are unguessable, so a view link is private in practice. A public gallery, if ever, is an explicit curated flag.

**No accounts yet.** Email is the account: the tester finds the edit link in their inbox. What this cannot do: list "my apps" across devices, recover a lost link without a hand re-issue, or revoke a leaked edit link except by rotation. Mitigations: the builder page keeps a list of edit links it has seen in localStorage; an edit page has a "rotate edit link" action.

**Safari eviction.** Safari clears a site's localStorage after seven days of browser use without a visit. Say so on the page: keep the email or bookmark, this browser may forget.

**When accounts become worth it.** People ask "where are my apps" more than once, teachers want their students' work in one place, or spend needs a per-person budget. Then add magic-link email sign-in, which is the same token idea attached to an email. Existing rows join an account when the person pastes an edit link once. That is why `owner_id` exists from day one.

## Limits

Builds cost far more than questions, and a tester iterating for an hour uses maybe twenty turns. Give builds their own constants in `_limit.js`, counted in the same single-round-trip query as asks so the 1.5 s budget stays one trip:

```js
const LIMITS = {
  ask:   { visitorHour: 40, cohortHour: 500, cohortDay: 1500 },
  build: { visitorHour: 60, cohortHour: 200, cohortDay: 600  },
};
```

Optionally per key via a third field in the env pair, `mary:<secret>:1000`. With one person per cohort, the visitor cap equals the cohort cap for builders.

Fail open still holds. Raise the provider's prepaid cap deliberately when raising these, since that is the number that actually stops spend.

Add a view summing input and output tokens per cohort per day. Within a week of named testers, tune the constants from that rather than from guesses.

## Cost levers, in order

Template-first generation, prompt caching of the component reference, a small model for edits, diffs rather than whole files.

## Order

1. Contract and Membrane extraction. (Done)
2. Three hand-built apps.
3. `apps` table and render route, seeded with those three.
4. Build endpoint.
5. Library freeze at `/lib/v1/`.
6. Limits, keys, usage view.
7. Export, rotate-token, Safari note.
