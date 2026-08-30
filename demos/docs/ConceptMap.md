<!-- KIND: rulebook, scoped — load before touching the map's content (lib/mapcontent.js, and tools/bake-vectors.js which derives from it), any of the card pages (tests/question-composer.html, tests/cards-cluster.html), the stage layer under them (kit/card-stage.js, kit/molbox.js, kit/proteinbox.js, molecule-builder/molecule-builder.js as a mounted box), or the composer's search (api/find.js). The invariants section is the load-bearing half and every item in it is a failure that ships looking fine. The last section is an ARGUMENT rather than a rule and can be skipped during a build. Nothing here applies to a lesson that draws one stage of its own. -->

# Cards, the stage concepts, and the door map

## **Goal**

Exploration by **connecting questions through biology concepts**. A door opens onto concepts; a shared QUESTION is the crossing from one concept to the next, which is what makes the map a map rather than a list. Typing your own question is a second way in, needing no door. Specimens — real deposited structures — hang off the concepts that hold them.

**`tests/question-composer.html` is the page.** One page, one renderer — a second copy of the same engine without the text box was kept for a while as the plainer version, and it is gone.

**Bipartite, with one exception.** Concepts never link to concepts, and a question is always the crossing between them. A concept reaches a SPECIMEN directly, with no question between; that survives because a specimen is a leaf and never links onward.

## **What exists**

**Content** — what the map says, and nothing that draws it:

* **`lib/mapcontent.js`** — `DOORS`, `CONCEPTS`, `QUESTIONS` (question-major, rank on the EDGE), `CONTENT`, `PLACEMENTS` (content-major, rank on the EDGE). Its own header is the rulebook for what each field means.
* **`lib/mapcontent-vectors.json`** — the map's searchable text embedded once, by `tools/bake-vectors.js`: every authored question, and every concept's own `claim` as `Name. claim.`. Re-bake when either TEXT changes; `--check` is also the map's integrity checker.
* **`proteins/proteins.js`** — not map content. The registry of which structures we hold and which file plays which role for each. `PLACEMENTS`' `p:` rows name keys in it.

**Pages**:

* **`tests/question-composer.html`** — the map entered by typing, and the one to work in.
* **`tests/cards-cluster.html`** — the stage bench: 9 cards, 3 kinds, budget of 4.
* **`map-cms.html`** — edits `lib/mapcontent.js` through the dev server's `/api/mapcontent`, on two screens that save independently. Not served in production.

**The stage layer**, which is what lets a card show its subject rather than a placeholder:

* **`kit/card-stage.js`** — the shell all the boxes sit on: own canvas, Stage, rAF loop, IntersectionObserver gate, ResizeObserver, and a `destroy()` that really releases the WebGL context. Plus `CardStage.pool({limit, onEvict})`, LRU, default 4.
* **`kit/molbox.js`** — a molecule from a spec. Orthographic by default.
* **`kit/proteinbox.js`** — a deposited structure: ribbon, and the surface and fold toggles. Takes `protein:` / `variant:` and reads the registry itself, or explicit paths.
* **`molecule-builder/molecule-builder.js`** — the builder, mounted as a box.

**Search**, which only the composer uses:

* **`api/find.js`** — embeds the reader's question and returns the vector; open, and metered by **`api/_finds.js`**.
* **`tools/bake-vectors.js`** — the corpus, and `--check`.

## **How much opens, and when**

The door opens **three levels deep, not one**: its rank 1 concepts, their best band of questions, and the concept each of those leads to. The water door is the argument for it — everything water does comes from polarity, so a fan of five peers would state the wrong thing. Polarity is the door's only rank 1 concept, and hydrogen bonding, solvation, dehydration & hydrolysis and the hydrophobic effect arrive through the questions that cross to them.

A click carries the same shape: expanding a concept deals its questions **and** the concepts each question ranks first, because a question with nothing on its far side is a crossing the reader has to take on faith. `expand(n, keep, next)` — `keep` filters the wave, `next` filters the step beyond it, and `start()` narrows `next` to this door so a crossing does not haul its far side in at load.

**Band, not rank 1.** Both filters take the lowest rank a question actually has among its still-hidden concepts, so a question whose concepts are all rank 2 deals them rather than nothing. Whole bands only, which is the same promise a card's own wave makes.

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

So opening a card is most of the way to being able to work on it, which is what the `.hub` width was already promising and nothing was reading. The concept still decides whether a control is EARNED (`mb-dims.armed` is a finished molecule); `.near` decides whether it is reachable, and it is faded rather than removed so nothing reflows as the reader scrolls in.

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

 5. **`snapshot()` refuses mid-fold.** A 2D↔3D change hides the sticks for 340ms (covalent-drag `stickHold`); a still caught there shows a bonded molecule with no bonds. Both drag concepts answer `holding()`.

 6. **Molbox: a zero-sized box must not be fitted.** Stage.frame bails on the missing aspect, leaving THREE's constructor frustum `top = 1` — a 30-unit molecule in a 2-unit frame. membrane-lab hits this every load (builds its box while `#lipidBox` is hidden). Guarded on `mount.clientWidth`.

 7. **`Stage.frame` floors solved PERSPECTIVE distance at 6** (`min:6`). Every molecule smaller than that fills only \~50% of its box and `pad` cannot reach it. This is why molbox is ortho by default. Ortho returns before the clamp.

 8. **An ortho camera does not zoom by moving.** Its size IS its frustum, so Stage.create's wheel (which only moves `cam.r`) does nothing. Both molbox and the builder map `cam.r` onto the frustum.

 9. **One scale family per SCENE, not per page** (MolecularGeometry.md §1.5). A page with separate stages may load both families and says so at its script tags — that comment is the only enforcement, since which scene a spec lands in is a runtime fact. `mol-small`/`mol-solvation` still throw if both load: same keys, different rule.

10. **`molecule-builder.html` does NOT use the concept.** It has its own shell. It keeps its own copy of the 900ms turn, and the checker fails if the two numbers diverge.

11. **A concept's neighbours include ITS DOOR.** `start()` never sees it, because the door is visible before anything expands. Anything that roots the map on a node OTHER than the door must filter the door out of every concept's wave (`expand`'s `keep`) — otherwise each concept deals the same 29rem door node and they stack on it. `question-composer` hit this on its first run.

12. **`function draw()` is taken.** The map's `draw()` is what positions every node from the rAF loop, and a second `function draw` at the page's top scope silently REPLACES it: function declarations redeclare without error, so every card stays at the origin with opacity 1 and nothing logs. Adding page-level UI over the map's engine is exactly when this happens. `question-composer` shipped it and it read as a physics bug for two rounds.

13. **The asked card is a root and never a wave.** Its links make it a genuine neighbour of every concept it reached, so `start()` will otherwise deal the reader's last question into the door's own map as though someone had authored it. Filtered in `expand()`, because every path that reveals a card goes through that one.

14. **Declaration order inside the composer's own block bites too.** Invariant 14's dead-zone throw is not only about `start()` calling into the block from above: the block is \~500 lines and a `const` near its top touching one declared near its bottom is the same throw, with the same symptom — a blank page and one error, because the script aborts and nothing after the throwing line initializes. It has happened three times in this file (`ASKED`, `ASKED_URL`, and `expand()`'s filter). `document.getElementById` costs a lookup and has no dead zone.

15. **`expand()` runs before the page's own additions exist.** `start()` is called at the bottom of the map's script, so anything appended below it has NOT initialized yet. Invariant 13's filter tests a PROPERTY (`!m.ask`) and not the `ASKED` binding for exactly this reason: touching that `const` from `expand()` is a temporal-dead-zone throw during load, which aborts the whole script and leaves the page blank with one error. Same shape as the `draw()` collision in 12 — appending below the engine is when both happen.

## **Card kinds**

| KIND | CONCEPT | PAGES |
| --- | --- | --- |
| `water` | card-stage + `water/watersim.js` | composer, cards-cluster |
| `build` | `molecule-builder.js` (ortho, own context) | composer, cards-cluster |
| `molbox` | `kit/molbox.js` | cards-cluster, membrane-lab |
| `protein` | `kit/proteinbox.js` | composer |
| `lesson` | an opener under the thumb, `#lessonmodal` | composer |
| `video` | a card of its own, `#videomodal` | composer |

**How a kind is PLACED is the kind's own business, and the three ways are not interchangeable.** The first four are INLINE: they mount a live box in a concept card's thumb, cost a WebGL context, and a card takes its rank 1 inline item and no more, because the pool rations four across the whole map. `lesson` is a BUTTON — a lesson has no still of its own worth showing, and the card it hangs off is the picture. `video` is a CARD, its own node hanging off the concepts that placed it, exactly as a specimen does: a poster, a title and somebody else's name is a card's worth of content rather than a chip in a corner. A specimen is always `protein` and has no `CONTENT` row at all — `viewFor()` hands the box a protein key instead of paths.

### The caption column

**The video's own captions are turned off, and the text sits beside it instead.** These animations print their key terms on the picture (`Glucose`, `Pyruvate`, the ATP counter), and a burned-in caption lands on top of the word it is explaining. So the player runs with captions off and the cues are a column down the right of the modal, lit line following playback, click a line to seek.

**Turning them off takes more than the parameter.** `cc_load_policy=0` only asks: a reader whose YouTube account defaults captions on gets them anyway, and that is exactly the reader this is for. `killCaptions()` calls `setOption('captions','track',{})` and `unloadModule` on both module names, on `onReady` and again on every `onApiChange` and once more on a delay, because the captions module does not exist when the player is ready and can load after the event that announced the last one. None of it is documented, the getters keep reporting a live track afterwards, and **the picture is the only test** that it worked.

**The player chrome is ours too.** `controls=0` takes YouTube's bar away and does not finish the job: the title, avatar, logo and share button still fade in over the picture on hover, and a PAUSED player draws its own overlay carrying all of them plus "More videos". So the frame is `pointer-events: none`, the poster covers it whenever the video is not running, and the strip under it (play/pause, elapsed, scrubber, fullscreen) is the page's own. The end screen is killed by rewinding to 0 on `ENDED`, which puts frame 0 back and never lets the thumbnail grid draw. Two traps: **`BUFFERING` is not `PAUSED`** — YouTube fires it after `PLAYING` and on every seek, and treating it as a stop throws the poster over a running video for as long as the buffer takes; and `destroy()` takes the iframe with it, so only `.mstage` is rebuilt on close, never `.mvideo`, whose strip has live listeners bound to its nodes.

**The cue file is authored, and it carries TWO tracks.** YouTube publishes no caption text a page can read: the Data API's `captions.download` is owner-only OAuth, `timedtext` serves an empty body to a plain request, and the only track on the glycolysis video is auto-generated ASR, which renders "phosphofructokinase" as noise. So the file is `{ tracks: [{ id, label, source, sourceUrl, cues: [{ t, text, step }] }] }`.

**A video that is not ours leads with its own words**, credited and linked, because putting our sentences where its author's were is its own kind of misrepresentation. The second track is the same beats rewritten for a Bio 101 reader, and it is labelled as a summary. The column prints the source of whichever is showing: a column of somebody else's writing with no name on it reads as ours. `step` is the lesson's own numbering, so a cue and `glycolysis-lab`'s ten steps cannot drift apart.

**Layout note that cost an hour.** The column is `position: absolute` inside `.mbody`. A row flex container takes its cross-axis height from the tallest item's content, and 19 cues are taller than a 16:9 picture, so in flow the column held the card at its max height with a band of dead black under the video. And `#videoframe` needs an explicit `height: auto`: the IFrame API stamps `width="640" height="360"` **attributes** on the iframe it builds, and a presentational height beats `aspect-ratio`.

**Two modals, not one parameterised modal.** A lesson and a video share the word "opens" and nothing else: a lesson is same-origin, a page we own, sized as a sheet, carrying `chrome=bare`; a video is 16:9, third-party, autoplaying, and its header has to say whose work it is. `kit/modal.js` stacks independent dialogs, which is what it was built for. A video's `src` is a bare YouTube id and the page builds a `youtube-nocookie` embed from it, so **the map at rest makes no third-party request** — the poster is a local file for the same reason, and clearing the frame on hide is what stops playback rather than merely hiding it.

**`kit/proteinbox.js` owns the molecule; the page owns the map.** The box knows about the trace, the surface and the fold, draws its own two controls, and — given `protein:` / `variant:` — reads `proteins/proteins.js` to find those three files itself. Which files a CONCEPT's card names is an `r:` row in `CONTENT`; the openers and their modals are the page's, because a box has no opinion about what is behind the card it sits on. A lesson is its own content item rather than a field on a picture that happens to share the card. `rendering-modules.md` has the module.

**A protein card is angstroms, and its own scene** — which is what lets it be, since every other card on the page is a spec in the small-molecule family (MolecularGeometry.md 1.5). It draws from a trace baked by `tools/bake-trace.js`: Ca plus the DEPOSITED secondary structure, centred, 12 KB for a tetramer against the 453 KB PDB it came from. **Three things a protein card can show, and only the first is free.** Ribbon is the default and the only one fetched at reveal. The other two are gated the same way, and the gates are the design:

|  | bytes | control | gate |
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

**One copy of the engine, and that is the point.** This page was for a while a rebase of a boxless twin, and the twin drifted the moment it was taken — \~175 lines behind within the day, missing `goLiveSoon()` (card startup queued for quiet frames rather than created mid-wave) and `cardsQuiet()` (sims paused during pan and zoom), and still carrying the protein card inline after `kit/proteinbox.js` had taken it out. Keeping two copies in step is a cost on every engine change forever. **Do not take another copy to try something in.**

**What is the composer's own, over the engine, is still worth knowing as a shape**: the CSS block, the `.composer` markup, the specimen and video node loops (in the graph construction, after `CONCEPTS` and before `QUESTIONS`), and everything after `start();`.

Edits, and this list grows every time the composer gains a kind or a control — check it against the diff rather than trusting it:

| where | what |
| --- | --- |
| `expand()` | the `!m.ask` filter |
| `paintNode()` | the `n.ask` branch, and the `protein` and `video` branches |
| `paintLink()` | the `l.near` branch |
| `centre()` | the composer's band across the top |
| `markNear()` | `CARDKIND` — specimens and videos count as cards |
| `refreshMeta()` | a leaf's hidden neighbours are concepts, not questions |
| `goLive()` / `goLiveSoon()` | both go through `viewFor()` |
| the protein card | `protein:`/`variant:` when a specimen, paths when an `r:` content row |

The claim the text box makes is that **the typed question becomes a temporary door**. `openFrom(q)` composes the same three levels `start()` does, rooted on a question instead of one of the written doors: the question, every concept that answers it, then each of those concepts' best band. It reuses `show` / `expand` / `centre` and keeps start()'s own-door rule, so a crossing does not haul its far side in.

**Content is in the corpus, not only questions about it.** A concept used to be reachable only through a question somebody had written for it, so `geometry`, `covalent` and `ionic` — no questions filed — could not be found at all, and `what is a buffer` was a miss with Acids & pH sitting right there. Every concept's `claim` is now a row of its own. **A claim never becomes a hit**: a hit is a row the reader opens and `openAsk()` takes one as the authored question it matched, so a claim arrives as a discovered (dashed) edge, which is what a proximity to the content itself is.

**The two kinds do not share a threshold.** Claims sit lower than questions across the board, declarative against interrogative, so `CLAIMFLOOR` is separate and was measured rather than guessed: 20 off-map queries top out at 0.825 and the answers the question corpus cannot reach land 0.84 to 0.94. One floor and no vote rule, because a claim is the concept's own sentence and there is nothing to corroborate it with — measured, `asdfqwer`'s top claim carries two question votes, so corroboration separates nothing here.

**Two halves, and only the first one changed.** `search()` scores the typed text; `openAsk()` composes the map around what it returns. That seam held: the scorer went from token overlap to cosine over baked embeddings and nothing below it moved. `lexRank()` / `lexNear()` are the original lexical pair, kept as the no-key fallback rather than deleted — a checkout with no `GEMINI_API_KEY` is still a working page, and it is the same code path the session drops to when the endpoint refuses.

**A miss is the artefact, not the failure.** Below the floor the box says nothing answers that yet rather than routing to the least-bad card, and the typed text is the only record of a door worth writing. Every search is now a row in `finds` (`api/_finds.js`), and `demos/ask/log.html`'s **Map** tab is where they are read — rolled up by repeated text, because one person asking about osmosis is a person and forty are a lesson that is missing.

**25 of the 66 questions in `mapcontent.js` name one concept.** Rooting on one of those opens 7 cards against \~16 — a thin door a student can type straight into. That is the "a question naming ONE concept is a caption, not a crossing" gap `mapcontent.js`'s own header already flags; the composer is what makes it visible.

### The reader's own words, and the edges off them

The typed question is **one card carrying what was typed**, dashed and captioned *you asked*, with two kinds of edge off it:

* **Inherited (solid)** — the concepts of the authored question it matched, carrying the rank that question already had on each. Real crossings.
* **Discovered (dashed)** — concepts the text reached on its own that the match did not already cover. Proximity, drawn as proximity.

Both at once, because a question rarely lands entirely in one bucket. Measured: *"how does my body get energy from sugar"* matches *"Why is sugar sweet and starch isn't?"* and inherits Monomers & polymers and Molecular geometry, while the discovered edges are what reach **Glycolysis**, which the authored match never touches. The match explains what the map already answers; the discovered edges are where this particular wording pulls that the authored one does not.

The card prints both wordings (*the map words it as "…"*), because the reader is the only one who can tell whether they mean the same thing. `textContent`, since it is text the reader typed.

**Zero reach is the only miss, and it must not open.** A root with no neighbours draws one card on blank paper, which reads as a broken page rather than as an answer. `openAsk()` returns the reach and the caller refuses to open on nothing. This is the failure that killed the first version of this feature: two guards I added (a 0.34 floor and a two-matching-words rule) made most questions reach nothing, and every one of them rendered as an empty map.

**Weight rare words, not all words.** Plain token counting made `water` worth as much as `curly`, and `water` is in nearly every concept on a water door, so questions attached to Polarity for saying "water" at all. Concept scores are IDF-weighted over the query.

**`centre()` aims at a fixed band across the top** rather than the whole window, which is where centring put the root card underneath the composer.

### Keywords are not questions

A reader types `osmosis` as readily as a sentence, and the corpus is QUESTIONS. Measured against it:

```
polarity        0.811  refused    <- the door's own rank 1 concept, by name
glycolysis      0.819  refused
photosynthesis  0.851  MATCH      <- there is no photosynthesis concept
```

Both directions wrong: the most central card on the map is unreachable by its own name, and an off-map word scrapes over the floor. **No scoring rule fixes the first half.** `polarity` and `glycolysis` have zero questions within 0.83 of them, so there is nothing for a floor or a vote rule to work with — a concept name is simply not a question, and this corpus contains only questions.

So a keyword that names a card is answered **before any embedding**, by `cardNamed()`. It is a CARD-NAME LOOKUP and not keyword search: exact on the name or on an authored alternate, then a prefix / whole-word pass at five characters or more, after normalising away a leading article and folding plurals. `hemoglobin` reaches its card the same way `polarity` does.

**A concept matches its name and its `alt` list, never its id.** It used to match the id, and that was measured and retired: the branch was load-bearing for ten of the 27 cards and junk for the rest. `ice` and `geometry` landed only because somebody had picked a short id; `cooperat` and `hydrophob` were truncations no reader types; `condense` answered for Dehydration & hydrolysis by accident. Worse, it did quietly what the name rule refuses on purpose — `density` cannot reach Ice & density, but `pumps` reached Channels & pumps, and an internal key was what decided which. Those ten are `alt` entries now, so they are authored, and the list reaches what no id ever would: `pH` and `buffer` for Acids & pH, `water fearing` for the hydrophobic effect, `quaternary structure` for Levels of structure.

**A SPECIMEN still matches its registry key**, and the case that settles it is `hemoglobin`, whose registry name is the British spelling. Drop the key and an American student cannot type the flagship card. A protein's key is its common name; a concept's id is an abbreviation of its own title, which is the whole difference.

**`alt` is for knowing, not for ranking.** It is not baked into the claim's vector: a sentence that measured well is not improved by synonyms stapled to it, and a two-word row embedded against a corpus of sentences ranks badly. Two alternates that normalise alike are a `--check` failure — first match wins, so which card a shared word opens would be an accident of table order.

| the typed text | reaches |
| --- | --- |
| equals a name or an id | `polarity`, `osmosis`, `ice` |
| is a prefix of a name | `hydrophobic` → The hydrophobic effect, `hydrogen bonds` → Hydrogen bonding |
| holds a name as whole words | `protein folding` → Folding, `lipid bilayer` → The bilayer |

**"The name holds the typed word" is deliberately NOT one of them.** It was tried, and it let `effect` claim The hydrophobic effect and `levels` claim Levels of structure — a tail word is not a name. The cost is that `density` no longer reaches Ice & density, which is the right trade: being asked to type the head of a name is normal, being answered from its tail is a surprise. Head-word prefixes like `simple` → Simple diffusion do still hit, and read as autocomplete rather than as a wrong answer.

The card becomes the first row in the list, because they named a thing that exists and the map has nothing better to offer than that thing. `openCard()` composes what clicking that card would have done, and focuses it.

**The second half is not solved.** `photosynthesis` (0.851) and `mitosis` (0.849) sit above real on-map keywords like `pH` (0.852) and below none of them: there is no gap to cut. Corroboration narrows it (`DNA` has 7 near questions, `photosynthesis` 1) without separating it. A bare keyword that does not name a card can still land somewhere plausible and wrong, and the fixture is what should settle whether short queries want their own floor.

### The list is what the map already says

Putting the reader's own wording on the map is what **Enter** does, and it is **not a row**. It was one, and drawing it meant offering the reader back the thing they had just typed, above the answers they came for. So the list holds only what already exists: a named card if there is one, then authored questions, and no concept chips under them — which cards a question opens is what the map itself shows a moment later, and saying it twice made a list of questions read as a list of metadata.

`cursor` at -1 is **nothing highlighted**, and that is the resting state: Enter takes the default. Arrowing down starts at the first row rather than at a default that is not drawn. `cursor` indexes `order` (a named card is -1, questions are 1+, and 0 is the default that never appears in it) because three index conventions in one handler is how an arrow key opens the wrong thing.

A miss keeps one line of its own. Without it, Enter on a question the map cannot answer does nothing at all and reads as a broken box.

### A door as a saved query

`?q=` opens the map on a question through the same path a reader's own typing takes. Every door now carries one, and `admin.html` links all six, so the claim is testable rather than argued: if a composed query reads as well as `start()`'s hand-tuned fan, the door stops being a node kind and becomes a URL somebody bookmarked.

Measured, one link per door:

| door | opens on | own-door share |
| --- | --- | --- |
| water | Polarity · Solvation · Hydrogen bonding | 3/3 |
| carbon | Molecular geometry · Covalent bonding | 2/3 |
| proteins | Folding · Levels of structure (+ H-bonding, hydrophobic effect) | 2/4 |
| boundaries | Channels & pumps · The bilayer | 2/4 |
| information | Base pairing (+ H-bonding, Folding) | 1/3 |
| energy | Glycolysis | 1/1 |

Water lands on the same three cards `start()` composes, which is the result that matters. The doors that pull in other doors' concepts are doing the right thing rather than leaking: base pairing IS hydrogen bonding, and folding IS the hydrophobic effect, so a crossing at the opening frame is the map making its own argument. `energy` opens thin because that door has one concept, which is content and not mechanism.

**The card is the intro.** `?q=` draws the reader's question at once, alone, framed centre at whatever zoom one card fits at, with `body.intro` hiding the mast, the ask box, the legend and the readout — the intro is a state of the PAGE, not of four widgets. There is no separate title card: a second presentation of the same sentence was one too many, and the card can carry it at a size worth reading.

**The reveal is a PULL-BACK, not a cut.** `openAsk()` re-shows the card at the same origin and centres on everything it composed, so the reveal tweens from the frame the card was introduced in to that one — x, y and k together. One card fits at a closer zoom than twenty, and that difference IS the reveal: the camera draws back and the map appears around a card that never moved. A drag or a wheel ends it, because the pull-back is an offer and not a ride.

It fires on the LATER of the graph being composed and a beat long enough to read the sentence (1150ms). Whichever is slower is the one that matters, because a fast load should not flash the question away and a slow one should not add a wait on top of a wait. Every path out lowers the intro, including the query that reaches nothing and the corpus that will not load — chrome that never comes back is worse than the map it was hiding, which is why a missing corpus THROWS rather than returning past the reveal at the bottom of `bootVectors`.

**The question is on screen before any fetch returns**, because `?q=` carries it: the card is up at ~46ms against ~490ms for its own embedding. **And the three requests go out together** — corpus, endpoint config and the query's embedding were serial and none needs the one before it. The POST is fired before the GET has said the endpoint is up, because a wasted POST on a keyless checkout costs nothing while waiting for permission costs a round trip on every load that works. `search(text, pre)` takes a vector already in flight.

**`start()` does not run when `?q=` is present**, so no water door is composed and swapped out. **Start over** reloads the query instead of opening water: arriving on a saved query makes that query the starting point.

**A door's question now has to RETRIEVE as well as read**, which is a constraint a door that was only a node never had. `What decides which things get into a cell?` opens the PROTEIN door: `cell` collides with *"Why does one wrong amino acid sickle a whole cell?"* at 0.863, and two separate phrasings using the word did it. `membrane` does not collide. Write a door's question against the corpus, not against the ear.

**What deleting `DOORS` would actually cost.** The node and `start()` go, and so does the own-door filter in `expand()` — but `door` survives as a CONCEPT field, because it is also the colour system: `paintNode` reads a concept's door tint for the dot, and that dot is how a crossing is visible on a card that looks like all the rest. So the end state is a lookup table of regions, not an entry point.

### The vector backend

`tools/bake-vectors.js` embeds all 66 authored questions once (gemini-embedding-001, 256d, `SEMANTIC_SIMILARITY`) into `lib/mapcontent-vectors.json`. `api/find.js` embeds the READER's question and returns only that vector; the ranking happens in the page. The corpus vectors ship with the page anyway, so a server-side cosine would protect nothing, and the floors are the knobs worth tuning without a redeploy.

**The task type is not a detail.** A query embedded with anything other than the corpus's task type lands in a different geometry: the cosines come back plausible and the ranking is quietly wrong. `api/find.js` echoes its task and dims, and the page refuses a vector that disagrees with the file it is comparing against.

**Concepts come from questions, not from a bag of their own.** The lexical fallback unions every question under a concept into one token bag, which is where its noise came from: `ice` inherited the word `blood` from a question about freezing, so anything mentioning blood scored against it. Ranking whole questions and reading off THEIR concepts is max-pooling instead of mean-pooling, and the collision has nowhere to form. Measured: *"why is blood red"* went from Ice & density to Cooperativity.

**What ten queries settled, and what they did not.** The shape of the scoring is now known and the numbers are not:

* An **absolute floor works for the match**. Off-map questions ("the capital of France", "how do I bake sourdough") land 0.79-0.83 and real ones land 0.87+, so `MATCH = 0.85` refuses cleanly. This was worth measuring, because corpus-to-corpus similarity sits in a narrow 0.75-0.99 band that suggests no floor could work; query-to-corpus separates where corpus-to-corpus does not.
* **Normalising against the query's own distribution is worse.** A z-score ranks `asdfqwer` above a real membrane question, because a flat distribution has a high z at its own top. Tried and rejected.
* **An absolute floor alone fails for discovered edges.** Glycolysis's best row for *"how does my body get energy from sugar"* is 0.836 and correct; Base pairing's for *"what makes hair curly"* is 0.841 and noise. No cut separates them.
* **Votes alone fail too.** Counting how many top rows carry a concept puts three of them on *"how do I bake sourdough bread"*.

So a discovered concept must clear a floor AND be corroborated: two near questions carry it, or one carries it from very close. Ten queries is enough to see that shape and nowhere near enough to trust `NEARABS` / `NEARSOLO` / `NEARK`. The fixture is what should fix them.

**Embeddings recover coverage, not only phrasing.** *"why do we breathe"* reached nothing lexically and reads as a coverage gap; it matches *"Why does breathing fast make you dizzy?"* at 0.903. The question was always there.

**No key, no vectors, no problem.** The page falls back to the lexical scorer, says so in the placeholder, and one endpoint failure drops the session to words rather than to nothing. A keyless checkout is a working page.

**`api/find.js` is open, and metered by its own counter.** It does not use `api/_limit.js`, which counts rows in the tutor's tables that a search never writes. `api/_finds.js` counts the rows this endpoint writes: a per-visitor cap that is friction, and a global cap that is the actual protection, since it needs no identity and holds against a script. Both fail open, like the tutor's.

**Why open rather than gated.** The gate it would inherit is `TUTOR_KEYS`, so a shared map link would hand out tutor spend along with it: one link, two budgets, and no way to give away the first without the second. Cost is not the reason either way. Gemini's rate limits are per PROJECT, so an abused search endpoint starves the tutor of quota whichever API key each presents, and a second key would buy revocation rather than isolation. The caps are what prevent that; the gate never could.

**A refusal is not an outage.** The page drops to the lexical scorer on any non-ok reply, 429 included, and says so in the placeholder. That is what makes it safe to set the caps low rather than generously.

### Editing the map after it is baked

**Re-bake when any BAKED TEXT changes**, and only then. Vectors are keyed on the text, and two texts are baked: a question as written, and a concept as `Name. claim.`

| what you edited in `lib/mapcontent.js` | re-bake? |
| --- | --- |
| a question's wording, or a new / deleted question | **yes** |
| a concept's `name` or `claim`, or a new / deleted concept | **yes** |
| a question's ranks, or which concepts it names | no |
| a concept's `rank`, `state`, `door`, `host` | no |
| `CONTENT`, `PLACEMENTS`, `DOORS` | no |

A concept's NAME is in its baked text, so renaming a card re-bakes it — the name is what a reader typing `polarity` matches against. Everything in the "no" rows is read live from `mapcontent.js` at load.

```bash
npm run check:vectors                # = bake-vectors.js --check; names the drift, embeds nothing
node tools/bake-vectors.js           # re-embeds only the rows whose text moved
```

**There is no separate *check-mapcontent.js*.** One script, two modes: both read the same file and the same hashes, so a second one would only be a way for them to disagree. `--check` covers four things — questions with no vector, orphan vectors whose question was reworded, broken concept references, and a note for concepts with no questions.

**Forgetting is silent, so the page says it out loud.** A question whose wording changed has no vector and is simply ABSENT from search: not a wrong answer, an unreachable card, and nothing about it is visible on screen. The page compares its question count against the baked file and warns to the console with the exact rows. Measured: rewording one question drops the corpus to 65 of 66 and names it.

**The deployed page reads the committed file**, so a re-bake has to be committed and pushed like any other artefact.

### Changing concepts, and adding new ones

Concepts need no bake at all, because nothing about a concept is embedded: the vector path reads a matched question's `neighbours()` for its concepts, so a concept is reachable the moment a question with a vector names it. Two consequences worth knowing:

* **Attaching an EXISTING question to a new concept needs no bake.** The text did not move, only the edge, so the new card is searchable immediately. A new concept built out of new questions does need one, for the questions.
* **Renaming or deleting a concept id silently drops every edge pointing at it.** The page resolves `byId[mid]` and does `if (!m) continue`, so the card is still drawn, the question is still drawn, and the crossing between them is simply gone — the one thing the map exists to do. Nothing caught this, so `--check` now does:

```
BROKEN: 1 bad reference(s) in lib/mapcontent.js
  question names no such concept `polarityy`: Why do water molecules stick to each other?
```

It checks question rows, every `PLACEMENTS` row (both halves: the content it places and the concepts it places it on), content nobody placed, and each concept's `door` against the ids that actually exist, and notes concepts with no questions without failing on them — a planned card waiting for questions is a normal thing to commit. It fails `--check` and only warns a bake, because the page reads `mapcontent.js` live and never reads the `concepts` the bake writes: a broken reference does not corrupt a vector, it breaks the map.

### CONTENT and PLACEMENTS — a concept is a claim, content is what makes it visible

**One concept can have many.** `VIEWS` was keyed by concept and could hold exactly one entry per card, so glycolysis could have a molecule or a video and never both. `CONTENT` is content-major — one row per unit, `id` namespaced by kind — and `PLACEMENTS` says where each one sits, carrying the rank it has on each concept. Same split, and for the same reason, as `QUESTIONS`: the thing is one object however many concepts point at it.

**A `p:` row is the exception that proves the table.** It places a protein whose entry lives in `proteins/proteins.js`, and nothing in `CONTENT` restates what that protein is. Every entry in that registry is drawn whether or not it has a row here; without one it hangs off the Proteins door at the back rank. So adding a protein stays a one-file edit, and `PLACEMENTS` is an override rather than a second registry to keep in step. Its third element picks a variant, and that is the whole of what it stores: no path, no filename. The registry says what we hold; the map says where it belongs and which deposition it means.

**A concept reaches a specimen or a video directly, with no question between**, and that is the one place the map is no longer bipartite. It survives because **both are LEAVES**: they hang off concepts and off questions and never off each other, so the graph stays layered and the fan, the bands and the relax are untouched. `expand`'s tail only re-expands questions, so a leaf never drags a second neighbourhood in.

**Rank means what it means everywhere else** — 1 is what the card opens with, 2 is one step in. Reusing it rather than inventing a rule is what lets content be authored like everything else here. For inline content it also breaks the tie, since a card can only afford one live box.

A question reaches one by naming it in its own row, namespaced so a key can never collide with a concept id:

```js
['Why do proteins bury their greasy parts?', { hydrophob:1, folding:2, 'p:myoglobin':2 }]
```

**The card is the concept card inverted.** On a concept the name is an eyebrow and the CLAIM is the card, because a lesson is what it asserts; on a specimen the NAME is the card and the blurb is a caption under the picture, because a thing is the point and what we say about it is a label on it. No dot either: the dot carries which DOOR a concept belongs to, and a specimen belongs to none — it is held by every concept that names it.

**The card prints its provenance, and every number on it is read at render time** from the variant's `read` block — the baker's half of the registry, rewritten from the deposition on every run. So a card says *x-ray diffraction · 124 of 124 residues · bovine* without a human having typed a count a re-bake could falsify, which is the thing `proteins/proteins.js`'s two-halves design exists to make possible.

**An enzyme is marked by WHAT IT DOES**, not by the word: the EC number's first digit is a class, and the registry carries that class's own name and gloss in `EC_CLASS`. So Ribonuclease A reads *HYDROLASE · EC 3.1.27.5* and Na⁺/K⁺-ATPase reads *TRANSLOCASE*, which says more than "enzyme" and costs the same line. A protein with no EC (haemoglobin, myoglobin, the prion) gets no tag rather than an empty one.

**The surface is the CARD tier, never the lesson's.** Hemoglobin's card bake is 362 KB against 1.5 MB for the same structure at 0.7 A, and a 280 px thumb cannot show the difference — `tools/bake-card-surface.js` exists for exactly this.

**The MAP names the pair, the BOX finds the files.** A `p:` placement stores a protein key and optionally a variant id, and that is all it stores; `kit/proteinbox.js` takes `protein:` / `variant:` / `base:` and reads `proteins/proteins.js` itself. Nothing on the page resolves a path. A page that reconstructed `2HHB.card.surf.bin` from a stem would be standing a convention where a fact already is, and it would go on working right up until one file was named differently.

Which deposition a card shows is the map's decision — 2HHB or sickle 2HBS is a different claim — and which files are behind it is the registry's. An explicit path still wins, because an `r:` content row names files the registry has no role for (a chain-B fold, a lesson-tier surface).

**Two conventions for finding the ribbon, and the registry means both.** A protein on its own pipeline carries a `bake` block naming every artefact by role, and that block is authoritative: hemoglobin's 2HBS has no `trace` in it because the entry is deposited for a SURFACE — a contact between tetramers is a claim about skin — so no ribbon exists and the box says so instead of drawing an empty frame. A protein on the shared `trace` pipeline has no `bake` block at all and `read.baked` IS its trace, which is four of the six. Reading `read.baked` unconditionally hands 2HBS's quaternary json to a ribbon drawer; both files apply the same rule, and 21 of the 22 variants resolve to a file that exists.

The toggle then follows the registry's judgement for free: four of the six have no `card` role because a skin teaches nothing about them, and for the pump it hides the site that is the whole point of the E1/E2 pair. Amylase's card surface was baked and RECORDED as a role, since a file in `data/` the registry does not name is exactly what `proteins/check-proteins.js` exists to catch.

**`viewFor()` is the one place that decides what a node draws.** A concept hands over the best-ranked INLINE item placed on it; a specimen hands over `{protein, variant}` and lets the box resolve; a video hands over nothing, because a poster is markup rather than a stage. Two callers, one box, and no third place where a filename could be wrong.

**`refreshMeta` knows two nouns now.** A specimen's hidden neighbours are the concepts that hold it, and the card said "+1 question" over two concepts.

The caption takes a second sans token, `--ui` (`system-ui`), because `--sans` is Futura and Futura is a DISPLAY face here: it carries the logo, the buttons and the uppercase letterspaced labels, and it is unreadable as running text at 11px. Prose set in sans takes `--ui`; a label keeps `--sans`. This is the composer's own `:root`.

**`--check` covers the new keys**: a protein renamed in `proteins/proteins.js` drops its edges exactly the way a renamed concept id did, and the checker names it. It loads `proteins/proteins.js` softly, so a checkout without `proteins/` still gets its questions checked.

**What the kind actually cost.** The drawing half was cheap, because a leaf is cheap: a `paintNode` branch, `viewFor()`, one widened filter in `openAsk`, one in `openFrom`, and `moduleNamed()` becoming `cardNamed()` over both kinds. `band()`, `STEP` and the rank-promotion loop needed nothing — a specimen card is a concept card and steps like one, and the promotion loop already skipped non-questions.

**The half that bit was the checks that GATE rather than draw.** `markNear()` skipped a non-concept and the surface toggle was invisible at every zoom, and `openCard()` not focusing what it opened left the root under `CONTROLS_AT` for a second reason. Neither threw, neither logged, and both survived a DOM query that found the buttons and reported them working. **The lesson is the test, not the count**: `querySelectorAll` finds a control that `opacity: 0` has hidden, so a kind change is verified with computed style or it is not verified. A cheap kind is still a kind.

### A new KIND of node is a page change

`DOORS` / `CONCEPTS` / `QUESTIONS` / `CONTENT` / `PLACEMENTS` are data, and a sixth table is not. The page says what a kind is in several places: `paintNode`'s branches, `expand`'s `STEP` per kind, `band()`, the rank-promotion loop, `CARDKIND`, and the composer's `QNODES` and `CARDS`.

**`markNear()` is the one that hides.** It skipped anything that was not `kind === 'concept'`, so a specimen never took `.near` at any zoom and its surface toggle sat at opacity 0 forever — present in the DOM, queryable, invisible. Nothing throws and nothing is missing from the page; the control is simply always faded. A kind check that GATES A CLASS fails this way rather than loudly, which is why it is worth listing separately from the ones that draw.

**A named card is focused**, the way a clicked one is. `openCard()` calls `focus()`, so the card takes `.hub` and its 34rem width — otherwise the root is a default 17.5rem card at apparent 0.85, just under `CONTROLS_AT`, and the toggle is hidden for that reason as well. Naming a card is asking to work on it. A kind that draws, fans and crosses like the others is an edit to each of those, not a row in `mapcontent.js` — cheap for a leaf, as specimens and videos both turned out to be, and not cheap for anything that questions must cross THROUGH.

**Gated on `lib/mapcontent.js`, not on the page.** `question-composer.html` is still test status, and the usual reason a test page skips a gate is that it has no audience — which stops holding the moment the link is shared. What the hook protects is the MAP: a question with no vector is an unreachable card, and a renamed concept id drops every edge pointing at it, which has nothing to do with embeddings.

The check belongs in the hook rather than beside `tools/check-handedness.js` because it is offline: `--check` embeds nothing and only compares hashes. Only the fix needs the key, which is what `--no-verify` is for. The pattern covers `lib/mapcontent.js`, `lib/mapcontent-vectors.json` and `tools/bake-vectors.js`.

## **Gotchas for a cold session**

* **The browser probe tab is hidden**, so `requestAnimationFrame`, `ResizeObserver` and `IntersectionObserver` delivery never fire. Drive `box.pump(dt)` and the page's own `step()` directly. `pump()` exists for this.

* **Screenshots with 4 live contexts come back blank** in the probe tab — the compositor does not pick up four WebGL layers. Verify with `readPixels` or `snapshot()` instead, and ask the human to look in Safari.

* Checkers: `node tools/check-pages.js`, `tools/check-docs.js`, `tools/bake-vectors.js --check` (the map's own — vectors AND references), `proteins/check-proteins.js`, `kit/check-kit.js`, `molecule-builder/check-molecule-builder.js`, `check-molecules.js` (slow, \~2min). The pre-commit hook gates each; silence means it ran and passed.

* `check-docs.js` treats any backticked path as a claim the file exists, and resolves it from `demos/` — so a checker outside `demos/tools/` needs its directory (`proteins/check-proteins.js`, not the bare name). Write a former filename in italics, not in backticks. This doc has broken that rule four times now and the checker caught every one.

* **`setTimeout` is throttled in the hidden probe tab**, so the composer's 220ms debounce does not fire on the schedule you typed against. A dropdown that looks empty a second after typing is usually this and not a bug — wait three seconds, or call the handler's work directly.

* **`querySelectorAll` finds controls that `opacity: 0` has hidden.** The specimen's surface toggle was reported working twice from a DOM query while being invisible on screen. Anything gated by `.near`, `.hub` or a class is verified with `getComputedStyle`, never by presence.

## **Considered**

1. **NOT recommended: a card-view registry.** I proposed it, then measured: after deleting `mol`, `build` and `molbox` are one-line calls and only the \~12 lines of WaterSim seeding are duplicated. That is a vocabulary, not an implementation (Modules.md's own test). If it bothers you, the honest home is a `WaterSim.scene(root, {waters, salt})` helper in the module that owns the physics.

## **Where this is going**

*The one section here that is an ARGUMENT and not a rule. Skip it during a build; it exists so a cold session knows which way the code is being pushed and does not defend a decision that is already on its way out.*

**The ask box is what the map is for, and doors were the scaffold that let it be built before search existed.** The material is dense and getting denser — cells, genetics, animals, the experiments that settled the fundamentals, the instruments that did the settling — and the bet is that typing a question and landing in a neighbourhood is how a student browses that, rather than descending a tree somebody drew.

**The architecture already suits it, in the one place that counts.** The relax is O(live²), not O(nodes²): it costs what is DRAWN, never what exists, and `openAsk()` never consults a door. A corpus ten times bigger costs the layout nothing, because the map is never drawn — a neighbourhood is.

**What does not scale, in the order it will break:**

* **Hand-authored rank.** 114 edges today. It does two jobs that separate under density — *what opens this card* stays editorial, *which four of two hundred questions* cannot be answered by hand. Human curation will be in selecting the content to add. ranking will become an AI feature that is either live or baked, and right now the human is curating the examples. The plan is the `said` / `read` split this repo already runs on `proteins/proteins.js`: authored ranks are the human's half and are never overwritten, generated ranks are derived and regenerable, and `--check` fails a generated one sitting where an authored one was. The 114 edges become the eval set, and the **26 that carry a different rank on different cards** are the subset that matters, because they are the only evidence that rank belongs to the edge and not to the question. 
* **The absolute floor.** `MATCH = 0.85` was calibrated against 66 questions. As the corpus densifies the nearest neighbour gets closer for EVERY query, off-map ones included, so the floor drifts without anything being wrong. It has to become relative, or be recalibrated at every significant growth. The fixture is what would catch that.
* **The shipped corpus.** \~2 KB a question: comfortable to \~500, awkward past \~1500. Quantising to int8 buys 4x. Past that, search moves server-side — which is why `api/find.js` returns a VECTOR rather than results, so that flip is a change in one file.
* **Authoring throughput.** At which point generation into the CMS queue, human-approved and never drawn unapproved, stops being overkill. The miss log in `finds` is already collecting the evidence of what to write.

**What to add, and as what.** More doors and concepts are content and cost no mechanism. Tools and species are FACETS, not cards — `read.method` and `species` already connect every specimen, so "everything solved by cryo-EM" can highlight what exists rather than adding to it. Experiments earn a card, because an experiment has its own content and its own edge: the claim it settled. Images want a registry with licences before they want plumbing.
