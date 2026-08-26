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

### What runs, and when

Three rules, all learned from a frame-rate readout in the corner rather than from reasoning about it — the loop's own JS turned out to be 0.12ms, so every real cost was paint, WebGL setup, or a rebuild.

* **The relax settles.** `alpha` used to floor at 0.012 and run for ever, writing a transform on every card and a `d` on every link each frame whether or not anything had moved. It now decays to zero on a MOTION test (below 0.05px of movement) and `wake()` restarts it.
* **Card loops pause while the map moves.** A pan, a wheel or a wave stops the live stages; they come back 220ms after the last event, and not before the map has settled. A paused box keeps its last frame, which is card-stage's whole bargain.
* **A revealed card starts on a calm frame, not a settled one.** A context, its shaders and its geometry are tens of milliseconds that no spreading makes free — but waiting for a full settle left the card the reader just opened on its placeholder for seconds. The gate is the wave (`alpha` past its first fast decay), capped under a second. At LOAD there is no motion to protect, so the first drain runs flat out and in reveal order; every drain after it waits and goes latest-first.

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

13. **The asked card is a root and never a wave.** Its links make it a genuine neighbour of every module it reached, so `start()` will otherwise deal the reader's last question into the door's own map as though someone had authored it. Filtered in `expand()`, because every path that reveals a card goes through that one.

14. **`expand()` runs before the page's own additions exist.** `start()` is called at the bottom of the map's script, so anything appended below it has NOT initialized yet. Invariant 13's filter tests a PROPERTY (`!m.ask`) and not the `ASKED` binding for exactly this reason: touching that `const` from `expand()` is a temporal-dead-zone throw during load, which aborts the whole script and leaves the page blank with one error. Same shape as the `draw()` collision in 12 — appending to a copy of door-map is when both happen.

## **Card kinds**

| KIND | MODULE | PAGES |
| --- | --- | --- |
| `water` | card-stage + `water/watersim.js` | door-map, cards-cluster |
| `build` | `molecule-builder.js` (ortho, own context) | door-map, cards-cluster |
| `molbox` | `kit/molbox.js` | cards-cluster, membrane-lab |
| `protein` | card-stage + `folding/ribbon.js`, from a baked trace | door-map |

**A protein card is angstroms, and its own scene** — which is what lets it be, since every other card on the page is a spec in the small-molecule family (MolecularGeometry.md 1.5). It draws from a trace baked by `tools/bake-trace.js`: Ca plus the DEPOSITED secondary structure, centred, 12 KB for a tetramer against the 453 KB PDB it came from. **Three things a protein card can show, and only the first is free.** Ribbon is the default and the only one fetched at reveal. The other two are gated the same way, and the gates are the design:

| | bytes | control | gate |
| --- | --- | --- | --- |
| ribbon | 12 KB trace | — | drawn at reveal |
| surface | 362 KB `*.card.surf.bin` | segment beside ribbon | `.near`, then the click |
| the fold | 833 KB trajectory | play button in the picture's corner | `.near`, then the click |

**One decoded surface per page** (`sesOwner`): 362 KB of quantised mesh becomes several MB of GPU buffers, and CardStage's LRU rations contexts, not what a page hangs off one. A card that loses its surface falls back to the ribbon it never removed.

**The fold is a play button, not a third segment.** Ribbon and surface are representations — the same molecule drawn two ways, which is what a segmented pair says. The fold is an event: it starts, runs, ends. Its rule lives in `hemoglobin/foldplay.js`, shared with `hemoglobin-lab`, so the card cannot become a second unwatched copy of act 2.

**The two live in different frames** — the trajectory in `FoldLib.orient()`'s, the trace in the crystal's — so the toggle re-frames rather than flipping visibility, and one is on screen at a time, which is what makes that legal. The fold is framed on its FINAL radius, or the camera appears to fold along with the protein.

### The lesson behind a card

A card is a promise that a thing is worth looking at; the full act is `hemoglobin-lab`'s, and it stays there. **Open lesson** on a `.near` protein card puts the lesson itself in a `kit/modal.js` card over the map, in an iframe.

**`?chrome=bare` is the LESSON's parameter, not the map's.** The map asks for a mode; `hemoglobin-lab` reads it before first paint (so it never flashes its own title on the way into someone else's frame) and its own stylesheet decides what bare means — today, one rule hiding `#pagetitle`, because the modal has already said what the page is. Anything else that must go when the lesson is not the whole window is added beside that rule, in that file.

The alternative was the map injecting a stylesheet through `contentDocument`, which same-origin allows. That is the map holding an opinion about another page's internals, and it breaks silently the day the lesson renames a selector. Nothing would check it.

**The iframe is empty until it opens and emptied on close.** A lesson is its own WebGL context and about a megabyte of trajectory, and neither should be paid by a reader who never opened it. Behaviour is `kit/modal.js`'s (focus return, the Esc stack, the trap); the markup and the look are the page's, which is the contract that module states in its own header.

**What did NOT get extracted, and why.** The lesson's act is ball-and-stick with per-frame pendant rebuilds, H-bond dashes gated on measured formation, the `fx` layer, a focus/opacity blend, a camera that turns across the coda, timed callouts, then the heme and three chains arriving. Almost none of that is a property of the fold — it is the telling of it, and extracting it would extract the lesson. `FoldPlay` took the one piece that is a rule.

**Protein cards do not orbit** (`stage:{orbit:false}`): a drag on a card is a drag on the map. Otherwise a reader who meant to move a card turns the molecule inside it, with no way back to the framing the card was composed with.

Small molecules go to the builder (flat view draws the electrons); molecules with no recipe go to molbox. Builder and molbox are ortho.

## **question-composer: the map entered by typing**

`tests/question-composer.html` is door-map with a text box, and the claim is that **the typed question becomes a temporary door**. `openFrom(q)` composes the same three levels `start()` does, rooted on a question instead of one of the written doors: the question, every module that answers it, then each of those modules' best band. It reuses `show` / `expand` / `centre` and keeps start()'s own-door rule, so a crossing does not haul its far side in.

**Two halves, and only the first one changes.** `rank()` scores the typed text against every authored question; `openFrom()` composes the map around whichever is chosen. The scorer in the page is LEXICAL — token overlap, no network, no key — and it exists so the OPENING can be judged before any vector is baked. It fails at the thing the real one is for: "why does water stick to itself" shares no token with `polarity`. Swapping it for cosine over baked embeddings moves nothing below it.

**A miss is the artefact, not the failure.** Below `FLOOR` the box says nothing covers that yet rather than routing to the least-bad card, and the typed text is the only record of a door worth writing. Logged to the console until it has somewhere to go.

**25 of the 66 questions in `mapcontent.js` name one module.** Rooting on one of those opens 7 cards against ~16 — a thin door a student can type straight into. That is the "a question naming ONE module is a caption, not a crossing" gap `mapcontent.js`'s own header already flags; the composer is what makes it visible.

### The reader's own words, and the edges off them

The typed question is **one card carrying what was typed**, dashed and captioned *you asked*, with two kinds of edge off it:

* **Inherited (solid)** — the modules of the authored question it matched, carrying the rank that question already had on each. Real crossings.
* **Discovered (dashed)** — modules the text reached on its own that the match did not already cover. Proximity, drawn as proximity.

Both at once, because a question rarely lands entirely in one bucket. Measured: *"how does my body get energy from sugar"* matches *"Why is sugar sweet and starch isn't?"* and inherits Monomers & polymers and Molecular geometry, while the discovered edges are what reach **Glycolysis**, which the authored match never touches. The match explains what the map already answers; the discovered edges are where this particular wording pulls that the authored one does not.

The card prints both wordings (*the map words it as "…"*), because the reader is the only one who can tell whether they mean the same thing. `textContent`, since it is text the reader typed.

**Zero reach is the only miss, and it must not open.** A root with no neighbours draws one card on blank paper, which reads as a broken page rather than as an answer. `openAsk()` returns the reach and the caller refuses to open on nothing. This is the failure that killed the first version of this feature: two guards I added (a 0.34 floor and a two-matching-words rule) made most questions reach nothing, and every one of them rendered as an empty map.

**Weight rare words, not all words.** Plain token counting made `water` worth as much as `curly`, and `water` is in nearly every module on a water door, so questions attached to Polarity for saying "water" at all. Module scores are IDF-weighted over the query.

**`centre()` diverges from door-map's**: the composer is a fixed band across the top, and centring on the whole window put the root card underneath it.

### The vector backend

`tools/bake-vectors.js` embeds all 66 authored questions once (gemini-embedding-001, 256d, `SEMANTIC_SIMILARITY`) into `lib/mapcontent-vectors.json`. `api/find.js` embeds the READER's question and returns only that vector; the ranking happens in the page. The corpus vectors ship with the page anyway, so a server-side cosine would protect nothing, and the floors are the knobs worth tuning without a redeploy.

**The task type is not a detail.** A query embedded with anything other than the corpus's task type lands in a different geometry: the cosines come back plausible and the ranking is quietly wrong. `api/find.js` echoes its task and dims, and the page refuses a vector that disagrees with the file it is comparing against.

**Modules come from questions, not from a bag of their own.** The lexical fallback unions every question under a module into one token bag, which is where its noise came from: `ice` inherited the word `blood` from a question about freezing, so anything mentioning blood scored against it. Ranking whole questions and reading off THEIR modules is max-pooling instead of mean-pooling, and the collision has nowhere to form. Measured: *"why is blood red"* went from Ice & density to Cooperativity.

**What ten queries settled, and what they did not.** The shape of the scoring is now known and the numbers are not:

* An **absolute floor works for the match**. Off-map questions ("the capital of France", "how do I bake sourdough") land 0.79-0.83 and real ones land 0.87+, so `MATCH = 0.85` refuses cleanly. This was worth measuring, because corpus-to-corpus similarity sits in a narrow 0.75-0.99 band that suggests no floor could work; query-to-corpus separates where corpus-to-corpus does not.
* **Normalising against the query's own distribution is worse.** A z-score ranks `asdfqwer` above a real membrane question, because a flat distribution has a high z at its own top. Tried and rejected.
* **An absolute floor alone fails for discovered edges.** Glycolysis's best row for *"how does my body get energy from sugar"* is 0.836 and correct; Base pairing's for *"what makes hair curly"* is 0.841 and noise. No cut separates them.
* **Votes alone fail too.** Counting how many top rows carry a module puts three of them on *"how do I bake sourdough bread"*.

So a discovered module must clear a floor AND be corroborated: two near questions carry it, or one carries it from very close. Ten queries is enough to see that shape and nowhere near enough to trust `NEARABS` / `NEARSOLO` / `NEARK`. The fixture is what should fix them.

**Embeddings recover coverage, not only phrasing.** *"why do we breathe"* reached nothing lexically and reads as a coverage gap; it matches *"Why does breathing fast make you dizzy?"* at 0.903. The question was always there.

**No key, no vectors, no problem.** The page falls back to the lexical scorer, says so in the placeholder, and one endpoint failure drops the session to words rather than to nothing. A keyless checkout is a working page.

**`api/find.js` is open, and metered by its own counter.** It does not use `api/_limit.js`, which counts rows in the tutor's tables that a search never writes. `api/_finds.js` counts the rows this endpoint writes: a per-visitor cap that is friction, and a global cap that is the actual protection, since it needs no identity and holds against a script. Both fail open, like the tutor's.

**Why open rather than gated.** The gate it would inherit is `TUTOR_KEYS`, so a shared map link would hand out tutor spend along with it: one link, two budgets, and no way to give away the first without the second. Cost is not the reason either way. Gemini's rate limits are per PROJECT, so an abused search endpoint starves the tutor of quota whichever API key each presents, and a second key would buy revocation rather than isolation. The caps are what prevent that; the gate never could.

**A refusal is not an outage.** The page drops to the lexical scorer on any non-ok reply, 429 included, and says so in the placeholder. That is what makes it safe to set the caps low rather than generously.

**No pre-commit gate yet** — test status, like `chain/` and `chair/`. When the page is promoted, the vectors become a derived artefact of a file the CMS rewrites, and a stale vector does not error, it routes a student to the wrong door. That is what the gate has to catch.

## **Gotchas for a cold session**

* **The browser probe tab is hidden**, so `requestAnimationFrame`, `ResizeObserver` and `IntersectionObserver` delivery never fire. Drive `box.pump(dt)` and the page's own `step()` directly. `pump()` exists for this.

* **Screenshots with 4 live contexts come back blank** in the probe tab — the compositor does not pick up four WebGL layers. Verify with `readPixels` or `snapshot()` instead, and ask the human to look in Safari.

* Checkers: `node tools/check-pages.js`, `tools/check-docs.js`, `kit/check-kit.js`, `molecule-builder/check-molecule-builder.js`, `check-molecules.js` (slow, \~2min). The pre-commit hook gates each; silence means it ran and passed.

* `check-docs.js` treats any backticked path as a claim the file exists — write a former filename in italics, not in backticks. This doc broke that rule twice on its first commit and the checker caught both.

## **Considered**

1. **NOT recommended: a card-view registry.** I proposed it, then measured: after deleting `mol`, `build` and `molbox` are one-line calls and only the \~12 lines of WaterSim seeding are duplicated. That is a vocabulary, not an implementation (Modules.md's own test). If it bothers you, the honest home is a `WaterSim.scene(root, {waters, salt})` helper in the module that owns the physics.
