# Platform plan — sharing, teacher customization, remix

The plan of record for everything platform-shaped: what happens after
`index.html` becomes a page teachers actually open. Self-contained — nothing
here depends on reading another planning doc. (`docs/plan.md` is kept only as a
historical record of what the project thought before the lessons existed; every
part of it still live has been folded in here.)

The lesson build order is `demos/LESSONS-ROADMAP.md` and this document does not
touch it.

## Two standing constraints

Everything below is designed against these. They are what keep this a small
project rather than an ed-tech vendor.

**1. Supplemental, never graded.** These pages are study material. The real
assessment is the midterm and the final, and those live where they already live.
So: no scores collected, no gradebook, no LMS grade passback, no completion
tokens. Quizzes exist for retrieval practice, not measurement. This is the
written answer to "can I see my students' scores" — it is *no*, on purpose, and
it is what permanently excuses this project from accounts, identity and
per-student storage.

**2. Teachers author, students study.** Teachers are the ones who scope lessons,
write quiz items and eventually remix. Students receive a link and work through
it alone, often at 11pm with no teacher in the room — so a page must teach
without one.

## Where the project actually is

Thirteen pages in `demos/` over shared modules, four of them featured lessons.
No backend, no accounts, no AI, published straight from the working tree to
GitHub Pages. The audience is **college Bio 101 — mostly adults**.

Three findings from building them shape everything below.

**A lesson is not a standalone file.** It is a page plus `palette.js` →
`molecules.js` → `skel.js` → `mol-*.js` → `scene.js`, in an order where wrong
script tags mean `MOLECULES.x is undefined`. So a remix sandbox must carry the
library, not just a file; the agent's edit surface is *page code against a
documented API*, which is far easier to constrain than free-form files; and
`CLAUDE.md` + `SCIENCE.md` are already most of a system prompt.

**This repo audits itself.** `check-molecules.js` prints every bond angle,
audits each declared `stereo` / `topology` / `chirality` claim, and fails when
bonded spheres merge. `check-handedness.js` is the only global-mirror catch.
Generated *specs* can be run through those. That is the difference between this
and any other remix-a-science-app product, and it should be load-bearing in the
design, not a footnote.

**The audience being adults retires the heaviest constraint the project once
carried.** COPPA machinery, SOPIPA and the ~40 state student-privacy laws key on
K-12 and largely don't reach higher ed. FERPA still binds the *institution*, and
data minimization is still the posture — but now by choice. That converts a
compliance project into a design preference, which is much cheaper to hold.

## The tension to name first

`LESSONS-ROADMAP.md` is explicit: **"Pedagogy retrofits are a later tier.
Quizzes, predict-before-you-see, scored interaction — real, and deliberately not
now. Visualization first."**

Teacher-authored quizzes are that deferred tier. So this plan does not overrule
the roadmap; it splits the work in two, and only one half is due now:

- **Making a lesson declarative** — pulling stages, copy and callouts out of the
  page's `<script>` into a config. Not pedagogy. It is the refactor that makes
  scoping, sharing, customization and remix all possible, and it pays for itself
  the first time a teacher wants steps 1–5 only.
- **Quizzes and scored interaction** — the roadmap's later tier. Stays deferred.
  When it lands, the roadmap already names its host and its shape:
  predict-before-you-see on glycolysis, "ATP in or out?" before steps 1 and 7.
  Teacher-authored quiz items are then just more config, on a mechanic the
  roadmap wanted anyway.

Reading that convergence the other way: the pedagogy tier and the platform tier
want the *same* config layer. Building it once, now, for scoping, means the quiz
tier is nearly free later. That is the argument for doing this before the
roadmap would otherwise reach it — and the only argument. It is not a reason to
start quizzes.

Note that constraint 1 also *shrinks* the deferred tier. "Scored interaction"
was the expensive half of it; ungraded retrieval practice is much smaller than
what the roadmap was deferring.

## Pilot: `glycolysis-lab`

The roadmap's build order opens with **"0. Finish `glycolysis-lab`. Half-built
and the beefiest thing here. Nothing below starts first."** That holds. The
config work starts when the page is finished, and it starts *there* for reasons
that are not coincidence:

- ten steps in five stages — real scoping structure a teacher would actually cut
  ("I stop at the committed step");
- it already carries a second simulation (the mass-action modal) with its own
  constants, so it is the page that most needs its knobs named;
- the roadmap picks it as the natural host for predict-before-you-see anyway;
- it is a prototype, so extracting its config cannot regress a featured lesson.

That last point matters. Do this to a featured lesson and a mistake is a
regression in front of students.

## Stage 1 — the config layer (no AI, no backend)

Extract one lesson's configurable surface by hand. Roughly: which stages are
shown, which callouts fire, panel copy overrides, whether the mass-action modal
is offered, whether optional H's start visible.

Encode it **in the URL** — `glycolysis-lab.html?c=<encoded>`. Possession of the
link is the whole access model, and it buys, for free:

- no database, no accounts, no login, no student data, no moderation queue;
- teachers share and fork by copy-paste;
- the whole feature ships on GitHub Pages, before the Vercel move;
- nothing to migrate afterwards.

Move to stored configs only when links get unwieldy or teachers want to edit in
place — that is a Vercel-era decision, not this one.

**Two rules for the config, or it rots:**

1. **The page validates it and falls back.** An unknown or malformed config
   renders the default lesson, never a broken one. A teacher's stale link must
   not become a white screen in a classroom.
2. **A config can only ever *subset* or *relabel*, never assert new chemistry.**
   The moment a config can introduce a molecule or a claim, everything
   `check-molecules.js` guarantees stops covering what students see.

`tools/check-pages.js` should learn the config schema in the same commit, on the
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

- `at` anchors an item to a stage the config already names — no second
  vocabulary.
- `why` is the explanation shown after answering, and it is the field doing the
  teaching. A right/wrong badge alone teaches nothing, and under constraint 2
  the explanation is standing in for a teacher who is not there.
- Multiple choice only. No free text: it invites personal information, needs a
  model to grade, and is the one input type that creates a moderation problem.

**Write items like exam questions, not interaction checks.** "Which step is
irreversible, and why" — not "click the γ phosphate." Professors grade on
midterms; a teacher recommending this to a class is implicitly claiming it helps
there. Interaction checks teach the interface.

**State, not scores.** Answers go in `localStorage`, keyed by a hash of the
config, so an edited quiz starts fresh instead of restoring answers to questions
that changed. Students are on personal laptops (see below), so persistence
across sessions is a feature — a student can finish a lesson that evening. A
visible "start over" control is the whole mitigation for the shared library
machine, and it is cheap.

Repeatable by design: no score is kept, so re-answering is free and encouraged.
That is what retrieval practice is.

**The answers are visible in the URL.** View Source defeats any client-side
quiz, and hashing four options defeats nothing. Under constraint 1 this costs
nothing — there is no grade to protect — but never ship copy implying otherwise.

`check-pages.js` gains item validation in the same commit: `correct` in range,
`at` naming a real stage, `why` non-empty.

**v2, later:** `gate: true` turns an item into predict-before-you-see — it
blocks the step instead of following it. Same schema, one flag, but it changes
the page's control flow, which is why it is not v1.

## Stage 2 — teacher authoring, with AI

Once a schema exists, the AI job is **natural language → config**, validated
against that schema. This is the design that makes an AI feature safe in an
accuracy-first project:

> The model never states biology. It selects and relabels from what the library
> already asserts. A hallucination becomes a schema validation error, not a
> false claim on screen.

Teacher types "I only cover through the committed step and I don't test
stereochemistry"; the model emits config; the page validates, previews, and
hands back a link.

**The proxy is the privacy chokepoint.** Forward the prompt with no identity
attached. Don't log prompt or response bodies — or purge on a short TTL.
Rate-limit on ephemeral or hashed-IP tokens, never persistent per-user tracking.

**Provider choice matters less than expected** — every frontier model handles a
small structured-output job like this. The real axes are **cost** (it scales per
teacher, then per student) and terms: treat **no-training-on-data + short
retention as a hard filter**, not a preference. Keep the provider swappable
behind a thin interface and A/B later. Note that a personal ChatGPT/Claude
*subscription* can't legitimately be fanned out to a class — this is
pay-per-token API work, and subscription auth (Codex, Claude Code) is
single-user.

**No general agent harness.** The edit surface is one validated JSON object, so
this is a system prompt plus schema-constrained output, not a filesystem and a
shell. Revisit only if free-code remix ever lands.

This stage needs the proxy, which needs Vercel.

## Stage 3 — remix, bounded

Two things argue against open chat-to-code:

- **The accuracy claim.** A remixed page can't run the checkers the way a
  committed one does. If remixes live on a project URL, the project's central
  claim silently covers output nobody verified. Decide the labelling —
  "community, unverified" — *before* the first remix exists.
- **A public gallery is a moderation commitment; private links are not.** With
  the audience adults and teacher-first, unlisted capability links are enough.
  A class-scoped gallery with join codes, and any username concept, are only
  worth revisiting if students ever author — and if they do, generated handles
  (`curious-mitochondria-7`), never free text.

So the first remix is **config + one custom step**: pick an existing mechanic,
pick a molecule the library already holds, write your own copy. Real authorship,
bounded blast radius, and it reuses Stage 1 entirely. Free code generation stays
a dev-only tool until teachers have shown what they actually try to make.

When free-code remix does come, the runtime stays lean: sandboxed iframe with
the modules loaded and no network, plus a plain editor. No WebContainers, no
npm, no dev server. Versioning is a visible snapshots timeline with restore;
real git underneath stays deferred. Shared snapshots are effectively public —
unlisted ≠ private — so the share UI says so.

## The molecule library question

Should the library be pre-generated in anticipation of future lessons and
remixing? **No.**

`docs/molecule-grouping.md` establishes that the resolver was the thing blocking
a bulk baker, and that job is now done: `tools/resolve-catalog.js` and
`tools/catalog/`'s 265 resolved rows are committed. So the tier-1 baker is
unblocked, and could emit ~100 PubChem-derived specs. The question is whether it
should.

Three reasons not to, in order of weight:

1. **`CLAUDE.md`'s standing rule.** A page loads only the molecules it shows; a
   molecule in the wrong domain is one some page pays for and never draws. A
   hundred specs no lesson loads is that cost, ~100 times.
2. **Every molecule making a chemical claim ships with the assertion that checks
   it, in the same commit.** Bulk-generating specs means bulk-generating
   unasserted claims — the exact failure mode that left every sugar here the
   wrong enantiomer for months.
3. **The roadmap prices the real demand and it is small**: enzymes needs ~1 new
   molecule (ADP), membrane ~6, DNA ~9. Two new domain files, not ten.

What to build instead is **the baker, not the bulk output** — so adding a
molecule is cheap, provenanced and checked *at the moment a lesson or a remix
needs it*. The catalog stays the index it already is; specs get generated one
row at a time, with `check-molecules.js` and `check-handedness.js` as the gate.
An agent adding a tier-1 molecule then edits the catalog row, not the library —
which is exactly what `molecule-grouping.md` recommended.

This is also the honest answer for remix: a teacher who wants a molecule the
library lacks is served by a fast checked path to *one* new spec, not by a
warehouse of unchecked ones.

Two cheap wins the roadmap already flags stay worth doing on their own merits:
**hydroxide** (hydronium exists, so the pH story is currently asymmetric) and
**O₂** as the nonpolar reference.

## Instrumentation

Ground rules: never log prompt or response bodies, never log identity, key
everything on a random per-session/per-project ID.

| Event | Reads as |
| --- | --- |
| `lesson_opened` (lesson id, config present y/n) | adoption; whether customization is used at all |
| `config_created` / `config_opened` | authoring vs receiving — the core question |
| `app_broke` | the worst failure mode; keep it, it is the metric analytics can catch and a human never reports |
| `webgl_unavailable` | a machine that silently can't run the page |
| `agent_result` (ok/error, latency, tokens) | edit success rate, cost per session |
| `reset_to_default` | frustration signal |
| `quiz_item_answered` (item id, chosen option) | **item-level counts only** — see below |

`webgl_unavailable` earns its place because a page that fails to render is
indistinguishable from one nobody opened.

**Quiz aggregates are product telemetry, not assessment.** Constraint 1 rules
out scores; what is still worth counting is *which option people pick*, summed
across everyone, never linked into a per-person sequence. "78% of answers to Q3
chose the same wrong option" means either the lesson fails at that exact point
or the question is bad — both fixable, and invisible any other way. Counts per
option, no session key, no ordering. This needs an endpoint, so it waits for
Vercel.

**Not loggable — gather by hand.** The questions that decide whether this works
are qualitative: explanation quality on a 0–2 rubric (wrong / mechanical /
conceptual — the North Star), a pre/post concept check, spot-checking the
scientific correctness of anything AI-generated, and the two adoption
questions — *would the teacher assign it again*, and *did it run without you in
the room*.

**Go / no-go, decided in advance.** Strong-go: students reach conceptual
explanations, the teacher would reassign, generated configs are correct.
Fixable: the learning works but the tooling is rough. Rethink: fun but they
can't explain the science, or the teacher won't reassign. **Fun ≠ learning.**

### Hardware assumptions

College students, mostly on their own laptops. Real WebGL and a retina-capable
canvas are safe to assume, which matters for the heavier pages
(`hemoglobin-lab`'s trajectory, glycolysis' stage machinery). The old
1366×768 Chromebook target is retired. `webgl_unavailable` stays as a rare-event
alarm rather than a planning input.

**Phones are explicitly not a target.** These are laptop lessons — a landscape
stage beside a 372px panel, dragging atoms and orbiting a camera. The
`@media (max-width:920px)` stack exists so a phone visit is not broken, not so
the lesson works there. Worth a sanity check that `index.html` and one lesson
render without horizontal scroll, since a shared link does get tapped on a
phone; not worth a redesign.

## Order

1. Finish `glycolysis-lab` (roadmap §0). Nothing here starts first.
2. Ship the feedback link on `index.html` — host-agnostic, one `<a>`, and at ten
   teachers it outperforms any dashboard.
3. Extract the glycolysis config; URL-encode it; teach `check-pages.js` the
   schema.
4. Quiz v0 on that schema (Stage 1b), ungraded, `localStorage`.
5. Move to Vercel. Preview deploys per branch are worth the move on their own —
   a teacher-shareable URL for `glycolysis-bio101` without touching the public
   index is the problem the index/admin split was working around.
6. Proxy endpoint + natural-language → config. Anonymous item-level quiz counts.
7. Bounded remix.

Steps 1–4 need no API key, no backend and no vendor decision.

## Deferred

Accounts, student authoring, public gallery, class/join-code concept, usernames,
stored server-side configs, free-code remix, snapshot versioning, the tier-1
bulk bake, and predict-before-you-see (`gate: true`) until `LESSONS-ROADMAP.md`
reaches it.

Permanently out, per constraint 1: scores, gradebooks, LMS grade passback,
completion tokens, per-student storage of any kind.
