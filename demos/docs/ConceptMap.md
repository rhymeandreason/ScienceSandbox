<!-- KIND: rulebook, scoped — load before touching kit/card-stage.js, kit/molbox.js, molecule-builder/molecule-builder.js as a mounted box, or any of the card pages (tests/door-map.html, tests/question-composer.html, tests/cards-cluster.html). The invariants section is the load-bearing half and every item in it is a failure that ships looking fine. Nothing here applies to a lesson that draws one stage of its own. -->

# Cards, the stage modules, and door-map

## **Goal**

`tests/door-map.html` is a new interaction paradigm: exploration by connecting questions through biology concepts. Door → modules → questions, bipartite, where a shared question IS the crossing to the next door. The work here was making a module card **show its actual 3D content** rather than a placeholder, which meant building the shared stage layer underneath it.

## **What exists**

CMS at map-cms.html

**`kit/card-stage.js`** (new). The shell all three boxes now sit on: own canvas, Stage, rAF loop, IntersectionObserver gate, ResizeObserver, and a `destroy()` that really releases the WebGL context. Plus `CardStage.pool({limit, onEvict})`, LRU, default 4.

**Converted onto it:** `kit/molbox.js` (was *kit/inset.js*) and `molecule-builder/molecule-builder.js`. Both gained `snapshot()` and `pump()`, neither of which was possible while each owned a private loop.

**`kit/molbox.js`** — renamed from *inset.js*. Orthographic by default now.

**`tests/cards-cluster.html`** (new) — the bench: 9 cards, 3 kinds, budget of 4.

**`tests/door-map.html`** — module cards go live on the click that opens them; the cards the door opens with are live at load. 4:3 picture blocks. Questions grow no picture block.

**`lib/mapcontent.js`** — the map's content and nothing that draws it: DOORS, MODULES, QUESTIONS (question-major, rank on the EDGE), VIEWS. Its own header is the rulebook for what each field means.

**`map-cms.html`** — edits that file through the dev server's `/api/mapcontent`, on two screens that save independently: questions and their module chips, and modules with their rank. Not served in production.

## **How much opens, and when**

The door opens **three levels deep, not one**: its rank 1 modules, their best band of questions, and the module each of those leads to. The water door is the argument for it — everything water does comes from polarity, so a fan of five peers would state the wrong thing. Polarity is the door's only rank 1 module, and hydrogen bonding, solvation, dehydration & hydrolysis and the hydrophobic effect arrive through the questions that cross to them.

A click carries the same shape: expanding a module deals its questions **and** the modules each question ranks first, because a question with nothing on its far side is a crossing the reader has to take on faith. `expand(n, keep, next)` — `keep` filters the wave, `next` filters the step beyond it, and `start()` narrows `next` to this door so a crossing does not haul its far side in at load.

**Band, not rank 1.** Both filters take the lowest rank a question actually has among its still-hidden modules, so a question whose modules are all rank 2 deals them rather than nothing. Whole bands only, which is the same promise a card's own wave makes.

## **Zoom**

Two mechanisms, split at k = 1, and the split is the point.

* **Out (k < 1): `transform: scale()`.** Minifying costs nothing in sharpness and leaves the layout alone. A relayout at 0.7 rewraps a heading, which redesigns the card under the reader.
* **In (k > 1): CSS `zoom`.** A scaled layer is rasterised once at layout size and stretched, so every glyph softens — worst in Safari, which holds the cached layer. Zoom relayouts at the size being looked at. `#world` carries `text-rendering: geometricPrecision` so glyph advances stay sub-pixel and the wrap does not drift with k.

The two agree exactly at k = 1. All the pan/drag maths is in screen px; only the translate is divided, because zoom multiplies the element's own units too.

### Zoom bands

`data-zoom` on `#world` and `<body>` is the one place a band is decided, so CSS and JS read the same fact without either polling `view.k`. Absolute k, and it can be absolute because `centre()` no longer solves the opening zoom out of the window — it floors at **0.5**, which is a decision about what a claim is readable at, not a clamp the fit happened to hit. So a band means the same thing on every screen and for every door, however many cards it opens with. `centre()` reports its own k as `openK`.

| band | k | what it is for |
| --- | --- | --- |
| `atlas` | < 0.40 | the shape, not the words |
| `region` | 0.40 – 0.75 | **the opening view**: cards readable, whole neighbourhoods |
| `interact` | ≥ 0.75 | close enough to work ON a card — where a live canvas is worth its context |

**A card's controls are not on that scale.** A band is the VIEW's, and an open card is 34rem where the rest are 17.5, so at one zoom the two are not the same size on screen at all. What a control needs is APPARENT size, so that is what `markNear()` measures — `k` times the card's own width ratio, against one threshold, `CONTROLS_AT = 0.95` of a default card:

| card | controls appear at |
| --- | --- |
| open (`.hub`, 34rem) | k ≥ 0.49 |
| default (17.5rem) | k ≥ 0.95 |

So opening a card is most of the way to being able to work on it, which is what the `.hub` width was already promising and nothing was reading. The module still decides whether a control is EARNED (`mb-dims.armed` is a finished molecule); `.near` decides whether it is reachable, and it is faded rather than removed so nothing reflows as the reader scrolls in.

`markNear()` runs from `applyView()` and from `measure()` — `measure()` being the one place a card's size is re-read, so opening and closing a card re-tests it for free.

**Canvases follow separately.** A card's canvas measures its UNZOOMED layout box, so at k = 2.5 it draws 2.5x fewer pixels than the screen shows. `reDensify()` sets each live box's pixel ratio to `dpr * k`, capped at 3 — 180ms after the wheel stops, because re-sizing a drawing buffer reallocates it, and again whenever a card mounts or re-fronts while zoomed in.

## **Invariants — the things that break silently**

 1. **Contexts are rationed, not counted.** Browsers cap WebGL contexts near 8-16 and drop the OLDEST with no error. Never create one stage per card. Default 4. Measured cost of 4 live: 4.48ms/frame against 16.7ms at 60fps.

 2. **`onEvict` fires BEFORE the destroy**, on every path out of the pool (evict / release / clear), so a card can take its `snapshot()`. A released card keeps its last frame — that is the whole reason a reader tolerates a card going quiet. `clear()` not firing it was a real bug: cards kept handles to dead boxes and silently stopped responding.

 3. **`acquire` is also bring-to-front.** A card already live must still re-acquire on click, or the card being watched is the next evicted.

 4. **The builder's resize order.** `Stage.resize()` holds an ortho camera's half-HEIGHT and rewrites width from aspect; the builder's rule is the opposite (half-height is whatever shows the WIDTH the recipe needs). So `applyZoom` runs from `onResize`, which fires AFTER `Stage.resize`. Reversed, a tall panel narrows to 6.83 of the 14.00 every recipe needs and chloride falls off the side. Asserted in `check-molecule-builder.js` §3.

 5. **`snapshot()` refuses mid-fold.** A 2D↔3D change hides the sticks for 340ms (covalent-drag `stickHold`); a still caught there shows a bonded molecule with no bonds. Both drag modules answer `holding()`.

 6. **Molbox: a zero-sized box must not be fitted.** Stage.frame bails on the missing aspect, leaving THREE's constructor frustum `top = 1` — a 30-unit molecule in a 2-unit frame. membrane-lab hits this every load (builds its box while `#lipidBox` is hidden). Guarded on `mount.clientWidth`.

 7. **`Stage.frame` floors solved PERSPECTIVE distance at 6** (`min:6`). Every molecule smaller than that fills only \~50% of its box and `pad` cannot reach it. This is why molbox is ortho by default. Ortho returns before the clamp.

 8. **An ortho camera does not zoom by moving.** Its size IS its frustum, so Stage.create's wheel (which only moves `cam.r`) does nothing. Both molbox and the builder map `cam.r` onto the frustum.

 9. **One scale family per SCENE, not per page** (MolecularGeometry.md §1.5). A page with separate stages may load both families and says so at its script tags — that comment is the only enforcement, since which scene a spec lands in is a runtime fact. `mol-small`/`mol-solvation` still throw if both load: same keys, different rule.

10. **`molecule-builder.html` does NOT use the module.** It has its own shell. It keeps its own copy of the 900ms turn, and the checker fails if the two numbers diverge.

11. **A module's neighbours include ITS DOOR.** `door-map`'s `start()` never sees it, because the door is visible before anything expands. Anything that roots the map on a node OTHER than the door must filter the door out of every module's wave (`expand`'s `keep`) — otherwise each module deals the same 29rem door node and they stack on it. `question-composer` hit this on its first run.

12. **`function draw()` is taken.** The map's `draw()` is what positions every node from the rAF loop, and a second `function draw` at the page's top scope silently REPLACES it: function declarations redeclare without error, so every card stays at the origin with opacity 1 and nothing logs. Adding page-level UI to a copy of door-map is exactly when this happens. `question-composer` shipped it and it read as a physics bug for two rounds.

13. **A ghost is a root, never a wave.** `question-composer`'s ghost node has real entries in `links`, so it is a genuine neighbour of the modules it landed near — and `start()` will deal it into the door's own map, dashed and captioned, as though someone had authored it. Filtered in `expand()` (`!m.ghost`) rather than at each call site, because every path that reveals a card goes through that one.

## **Card kinds**

| KIND | MODULE | PAGES |
| --- | --- | --- |
| `water` | card-stage + `water/watersim.js` | door-map, cards-cluster |
| `build` | `molecule-builder.js` (ortho, own context) | door-map, cards-cluster |
| `molbox` | `kit/molbox.js` | cards-cluster, membrane-lab |
| `protein` | card-stage + `folding/ribbon.js`, from a baked trace | door-map |

**A protein card is angstroms, and its own scene** — which is what lets it be, since every other card on the page is a spec in the small-molecule family (MolecularGeometry.md 1.5). It draws from a trace baked by `tools/bake-trace.js`: Ca plus the DEPOSITED secondary structure, centred, 12 KB for a tetramer against the 453 KB PDB it came from. Ribbon only for now — the SES bake of the same structure is 1.5 MB, and at thumb size a surface is a blob, so the surface belongs behind a control on a card that is already `.near`.

Small molecules go to the builder (flat view draws the electrons); molecules with no recipe go to molbox. Builder and molbox are ortho.

## **question-composer: the map entered by typing**

`tests/question-composer.html` is door-map with a text box, and the claim is that **the typed question becomes a temporary door**. `openFrom(q)` composes the same three levels `start()` does, rooted on a question instead of one of the written doors: the question, every module that answers it, then each of those modules' best band. It reuses `show` / `expand` / `centre` and keeps start()'s own-door rule, so a crossing does not haul its far side in.

**Two halves, and only the first one changes.** `rank()` scores the typed text against every authored question; `openFrom()` composes the map around whichever is chosen. The scorer in the page is LEXICAL — token overlap, no network, no key — and it exists so the OPENING can be judged before any vector is baked. It fails at the thing the real one is for: "why does water stick to itself" shares no token with `polarity`. Swapping it for cosine over baked embeddings moves nothing below it.

**A miss is the artefact, not the failure.** Below `FLOOR` the box says nothing covers that yet rather than routing to the least-bad card, and the typed text is the only record of a door worth writing. Logged to the console until it has somewhere to go.

**25 of the 66 questions in `mapcontent.js` name one module.** Rooting on one of those opens 7 cards against ~16 — a thin door a student can type straight into. That is the "a question naming ONE module is a caption, not a crossing" gap `mapcontent.js`'s own header already flags; the composer is what makes it visible.

### The ghost

A typed question the map has no node for is **placed anyway**, as `GHOST` — one reused node, dashed, captioned *your question*, wearing the spark rather than a door's tint. Its edges are dashed for the same reason the card is: they are **proximity, not a crossing**. `nearestModules()` scores the text against each module's own words plus every question already filed under it, and attaches the best 3.

Nothing generated is written back to `lib/mapcontent.js`, and the reason is structural rather than editorial: **a discovered edge carries no rank**, and rank is per-edge pedagogical judgement ("is this a good FIRST thing to ask on this card"). An edge missing that field cannot enter the graph even when it is correct. Generation belongs in `map-cms.html` with a human on it; the drawn map stays authored.

**Coverage needs two words, not one.** The score is the fraction of the QUERY the module covers, because a module's bag grows as questions are filed under it and normalising by size would punish the best-documented modules. But a two-word question clears any sane floor on ONE shared noun: measured, *what makes hair curly* attached itself to Folding on the word `hair`. So a ghost's edge costs `min(2, words)` hits. A ghost's edge is the only claim it makes.

**The ghost is a ROOT and never a wave** — invariant 13. And `centre()` on this page diverges from door-map's: the composer is a fixed band across the top, and centring on the whole window put the ghost's own best module underneath it.

**No pre-commit gate yet** — test status, like `chain/` and `chair/`. When the page is promoted, the vectors become a derived artefact of a file the CMS rewrites, and a stale vector does not error, it routes a student to the wrong door. That is what the gate has to catch.

## **Gotchas for a cold session**

* **The browser probe tab is hidden**, so `requestAnimationFrame`, `ResizeObserver` and `IntersectionObserver` delivery never fire. Drive `box.pump(dt)` and the page's own `step()` directly. `pump()` exists for this.

* **Screenshots with 4 live contexts come back blank** in the probe tab — the compositor does not pick up four WebGL layers. Verify with `readPixels` or `snapshot()` instead, and ask the human to look in Safari.

* Checkers: `node tools/check-pages.js`, `tools/check-docs.js`, `kit/check-kit.js`, `molecule-builder/check-molecule-builder.js`, `check-molecules.js` (slow, \~2min). The pre-commit hook gates each; silence means it ran and passed.

* `check-docs.js` treats any backticked path as a claim the file exists — write a former filename in italics, not in backticks. This doc broke that rule twice on its first commit and the checker caught both.

## **Considered**

1. **NOT recommended: a card-view registry.** I proposed it, then measured: after deleting `mol`, `build` and `molbox` are one-line calls and only the \~12 lines of WaterSim seeding are duplicated. That is a vocabulary, not an implementation (Modules.md's own test). If it bothers you, the honest home is a `WaterSim.scene(root, {waters, salt})` helper in the module that owns the physics.
