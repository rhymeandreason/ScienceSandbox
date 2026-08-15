# Platform plan — sharing, teacher customization, remix

The plan of record for everything platform-shaped: what happens after
`index.html` becomes a page teachers actually open. Self-contained. (`docs/plan.md`
is a historical record of what the project thought before the lessons existed;
everything still live has been folded in here.) The lesson build order is
`demos/LESSONS-ROADMAP.md` and this doc doesn't touch it.

**What's out of scope, deferred, or considered and declined is at the bottom, in
one section.** Everything before it is what gets built.

## Two standing constraints

Everything below is designed against these. They're what keep this a small
project rather than an ed-tech vendor.

**1. Supplemental, never graded.** These pages are study material; the real
assessment is the midterm and the final, and those live where they already live.
Quizzes are retrieval practice. This is the written answer to "can I see my
students' scores" — it is *no*, on purpose, and it is what permanently excuses
this project from accounts, identity and per-student storage.

**2. Teachers author, students study.** Teachers scope lessons, write quiz items
and eventually remix. Students get a link and work alone, often at 11pm with no
teacher in the room — so a page must teach without one.

## Where the project is

Thirteen pages in `demos/` over shared modules, four featured lessons, published
straight from the working tree to GitHub Pages. The audience is **college Bio 101
— mostly adults**. Three findings from building them shape everything below.

**A lesson is not a standalone file.** It's a page plus `palette.js` →
`molecules.js` → `skel.js` → `mol-*.js` → `scene.js`, in an order where wrong
script tags mean `MOLECULES.x is undefined`. So a remix sandbox must carry the
library, not just a file; the agent's edit surface is *page code against a
documented API*, far easier to constrain than free-form files; and `CLAUDE.md` +
`SCIENCE.md` are already most of a system prompt.

**This repo audits itself.** `check-molecules.js` prints every bond angle, audits
each declared `stereo`/`topology`/`chirality` claim, and fails when bonded
spheres merge; `check-handedness.js` is the only global-mirror catch. Generated
*specs* can be run through those. That's the difference between this and any
other remix-a-science-app product, and it should be load-bearing in the design,
not a footnote.

**An adult audience makes data minimization a design preference rather than a
compliance project.** COPPA machinery, SOPIPA and the ~40 state student-privacy
laws key on K-12 and largely don't reach higher ed. FERPA still binds the
*institution*, and minimization is still the posture — but now by choice, which
is much cheaper to hold.

## The config layer is the whole unlock

`LESSONS-ROADMAP.md` is explicit: **"Pedagogy retrofits are a later tier.
Quizzes, predict-before-you-see, scored interaction — real, and deliberately not
now. Visualization first."** This plan doesn't overrule that. It separates one
piece and builds only that piece now:

**Making a lesson declarative** — pulling stages, copy and callouts out of the
page's `<script>` into a config. Not pedagogy. It's the refactor that makes
scoping, sharing, customization and remix possible, and it pays for itself the
first time a teacher wants steps 1–5 only.

The pedagogy tier and the platform tier want the *same* config layer. The roadmap
already names the quiz tier's host and shape — predict-before-you-see on
glycolysis, "ATP in or out?" before steps 1 and 7 — so building the layer once,
now, for scoping makes that tier nearly free later. **That is the argument for
doing this before the roadmap would reach it, and the only one.**

## Pilot: `glycolysis-lab`

The roadmap opens with **"0. Finish `glycolysis-lab`. Half-built and the beefiest
thing here. Nothing below starts first."** That holds. Config work starts when
the page is finished, and starts *there* for reasons that aren't coincidence:

- ten steps in five stages — real scoping structure a teacher would cut ("I stop
  at the committed step");
- it already carries a second simulation (the mass-action modal) with its own
  constants, so it's the page that most needs its knobs named;
- the roadmap picks it as the host for predict-before-you-see anyway;
- it's a prototype, so extracting its config can't regress a featured lesson —
  do this to a featured lesson and a mistake happens in front of students.

## Stage 1 — the config layer

Extract one lesson's configurable surface by hand: which stages show, which
callouts fire, panel copy overrides, whether the mass-action modal is offered,
whether optional H's start visible.

Encode it **in the URL** — `glycolysis-lab.html?c=<encoded>`. Possession of the
link is the whole access model, which means teachers share and fork by
copy-paste, the feature ships on GitHub Pages before the Vercel move, and there
is nothing to migrate afterwards. Stored configs become a question only when
links get unwieldy or teachers want to edit in place — a Vercel-era decision.

**Two rules, or it rots:**

1. **The page validates it and falls back.** An unknown or malformed config
   renders the default lesson. A stale link must not become a white screen in a
   classroom.
2. **A config *subsets* or *relabels*; chemistry comes only from the library.**
   The moment a config can introduce a molecule or a claim, everything
   `check-molecules.js` guarantees stops covering what students see.

`tools/check-pages.js` learns the config schema in the same commit, on the
existing precedent that a derived artefact is checked by the code that can make
it stale.

## Stage 1b — quizzes as retrieval practice

The most likely first teacher request, and small once the schema exists. Items
ride in the same config as the scoping fields, because teachers author them.

```
quiz: [
  { at: 'stage3', q: '…', a: ['…','…','…'], correct: 1, why: '…' }
]
```

- `at` anchors an item to a stage the config already names — one vocabulary.
- `why` is shown after answering and is the field doing the teaching. A
  right/wrong badge teaches nothing, and under constraint 2 the explanation
  stands in for a teacher who isn't there.
- **Multiple choice**, so an item validates offline and no answer text ever
  leaves the page.

**Write items like exam questions.** "Which step is irreversible, and why" — not
"click the γ phosphate." A teacher recommending this to a class is implicitly
claiming it helps on the midterm; interaction checks teach the interface.

**State, not scores.** Answers go in `localStorage`, keyed by a hash of the
config, so an edited quiz starts fresh instead of restoring answers to questions
that changed. Students are on personal laptops, so cross-session persistence is a
feature — a student can finish that evening. A visible "start over" control
covers the shared library machine, and it's cheap. No score is kept, so
re-answering is free and encouraged: that is what retrieval practice is.

Note the answers are visible in the URL — View Source defeats any client-side
quiz, and hashing four options defeats nothing. Under constraint 1 that costs
nothing, but never ship copy implying otherwise.

`check-pages.js` gains item validation in the same commit: `correct` in range,
`at` naming a real stage, `why` non-empty.

## Stage 2 — teacher authoring, with AI

Once a schema exists, the AI job is **natural language → config**, validated
against that schema. This is what makes an AI feature safe in an accuracy-first
project:

> The model never states biology. It selects and relabels from what the library
> already asserts. A hallucination becomes a schema validation error, not a false
> claim on screen.

Teacher types "I only cover through the committed step and I don't test
stereochemistry"; the model emits config; the page validates, previews, hands
back a link. The edit surface is one validated JSON object, so this is a system
prompt plus schema-constrained output.

**The proxy is the privacy chokepoint.** Forward the prompt with no identity
attached, purge bodies on a short TTL, and rate-limit on ephemeral or hashed-IP
tokens.

**Provider choice matters less than expected** — every frontier model handles a
small structured-output job like this. The real axes are **cost** (it scales per
teacher, then per student) and terms: treat **no-training-on-data + short
retention as a hard filter**, not a preference. Keep the provider swappable
behind a thin interface. This is pay-per-token API work — a personal
ChatGPT/Claude *subscription* can't legitimately be fanned out to a class, and
subscription auth (Codex, Claude Code) is single-user.

This stage needs the proxy, which needs Vercel.

## Stage 3 — remix, bounded

The first remix is **config + one custom step**: pick an existing mechanic, pick
a molecule the library already holds, write your own copy. Real authorship,
bounded blast radius, and it reuses Stage 1 entirely.

Sharing is by unlisted capability link, same model as Stage 1. Two things to
settle before the first remix exists rather than after:

- **The labelling.** A remixed page can't run the checkers a committed one does.
  If remixes live on a project URL, the project's central accuracy claim silently
  covers output nobody verified — so "community, unverified" is decided up front.
- **Shared snapshots are effectively public.** Unlisted ≠ private, and the share
  UI says so.

## The molecule library: bake on demand

`docs/molecule-grouping.md` establishes that the resolver was blocking a bulk
baker, and that job is done: `tools/resolve-catalog.js` and `tools/catalog/`'s
265 resolved rows are committed. Build **the baker, not the bulk output** — so
adding a molecule is cheap, provenanced and checked *at the moment a lesson or a
remix needs it*.

The catalog stays the index it is; specs get generated one row at a time, with
`check-molecules.js` and `check-handedness.js` as the gate. An agent adding a
tier-1 molecule edits the catalog row, not the library, which is what
`molecule-grouping.md` recommended. That's also the honest answer for remix: a
teacher wanting a molecule the library lacks is served by a fast checked path to
*one* new spec.

Two cheap wins the roadmap flags are worth doing on their own merits:
**hydroxide** (hydronium exists, so the pH story is asymmetric) and **O₂** as the
nonpolar reference.

## Instrumentation

Ground rules: never log prompt or response bodies, never log identity, key
everything on a random per-session/per-project ID.

| Event | Reads as |
| --- | --- |
| `lesson_opened` (lesson id, config present y/n) | adoption; whether customization is used at all |
| `config_created` / `config_opened` | authoring vs receiving — the core question |
| `app_broke` | the worst failure mode; the metric analytics can catch and a human never reports |
| `webgl_unavailable` | a machine that silently can't run the page |
| `agent_result` (ok/error, latency, tokens) | edit success rate, cost per session |
| `reset_to_default` | frustration signal |
| `quiz_item_answered` (item id, chosen option) | **item-level counts only** — see below |

`webgl_unavailable` earns its place because a page that fails to render is
indistinguishable from one nobody opened.

**Quiz aggregates are product telemetry, not assessment.** What's worth counting
is *which option people pick*, summed across everyone: "78% of answers to Q3
chose the same wrong option" means either the lesson fails at that exact point or
the question is bad — both fixable, and invisible any other way. Counts per
option, no session key, no ordering, never linked into a per-person sequence.
Needs an endpoint, so it waits for Vercel.

**Gather by hand what analytics can't see.** The questions that decide whether
this works are qualitative: explanation quality on a 0–2 rubric (wrong /
mechanical / conceptual — the North Star), a pre/post concept check,
spot-checking the correctness of anything AI-generated, and the two adoption
questions — *would the teacher assign it again*, and *did it run without you in
the room*.

**Go / no-go, decided in advance.** Strong-go: students reach conceptual
explanations, the teacher would reassign, generated configs are correct. Fixable:
the learning works but the tooling is rough. Rethink: fun but they can't explain
the science, or the teacher won't reassign. **Fun ≠ learning.**

### Hardware assumptions

College students, mostly on their own laptops. Real WebGL and a retina-capable
canvas are safe to assume, which matters for the heavier pages
(`hemoglobin-lab`'s trajectory, glycolysis' stage machinery). `webgl_unavailable`
is a rare-event alarm, not a planning input. These are laptop lessons — a
landscape stage beside a 372px panel, dragging atoms, orbiting a camera — and the
`@media (max-width:920px)` stack exists so a phone visit isn't broken. Worth a
sanity check that `index.html` and one lesson render without horizontal scroll,
since a shared link does get tapped on a phone.

## Order

1. Finish `glycolysis-lab` (roadmap §0). Nothing here starts first.
2. Ship the feedback link on `index.html` — host-agnostic, one `<a>`, and at ten
   teachers it outperforms any dashboard.
3. Extract the glycolysis config; URL-encode it; teach `check-pages.js` the
   schema.
4. Quiz v0 on that schema (Stage 1b), ungraded, `localStorage`.
5. Move to Vercel. Preview deploys per branch are worth the move on their own — a
   teacher-shareable URL for `glycolysis-bio101` without touching the public
   index is the problem the index/admin split was working around.
6. Proxy endpoint + natural-language → config. Anonymous item-level quiz counts.
7. Bounded remix.

Steps 1–4 need no API key, no backend and no vendor decision.

## Not building this

**Permanently out, per constraint 1:** scores, gradebooks, LMS grade passback,
completion tokens, and per-student storage of any kind. Accounts and identity go
with them — nothing above needs a user record, and adding one would reopen every
privacy question the adult audience just closed. Free-text quiz answers are out
for the same reason: they invite personal information, need a model to grade, and
are the one input type that creates a moderation problem.

**Deferred, not rejected:** student authoring, a public gallery, class/join-code
concepts, usernames, server-side stored configs, free-code remix, snapshot
versioning, and predict-before-you-see (`gate: true`) until `LESSONS-ROADMAP.md`
reaches it — `gate` is one flag on the Stage 1b schema, but it changes the page's
control flow, which is why it isn't v1. A public gallery is a standing moderation
commitment where unlisted links are none, so it's worth revisiting only if
students ever author; if they do, generated handles (`curious-mitochondria-7`),
never free text. If free-code remix does land, the runtime stays a sandboxed
iframe with the modules loaded and no network, plus a plain editor — no
WebContainers, no npm, no dev server, and a visible snapshots timeline rather
than real git.

**Considered and declined.** *Bulk-baking the molecule library* (~100
PubChem-derived specs, now technically unblocked): a page loads only the
molecules it shows, so a hundred specs no lesson loads is `CLAUDE.md`'s
wrong-domain cost ~100 times; bulk-generating specs means bulk-generating
unasserted claims, the exact failure that left every sugar here the wrong
enantiomer for months; and the roadmap prices real demand small — enzymes needs
~1 new molecule (ADP), membrane ~6, DNA ~9. *Open chat-to-code as the first
remix*, because a remixed page can't run the checkers and free generation should
wait until teachers have shown what they try to make. *A general agent harness*
for Stage 2, since the edit surface is one JSON object. *Phones as a target* —
the responsive stack keeps a phone visit from breaking, not from being the
lesson. And the old 1366×768 Chromebook target, retired with the K-12 audience.
