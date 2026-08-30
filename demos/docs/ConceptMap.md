<!-- KIND: rulebook, scoped — load before touching the map's content (lib/mapcontent.js, and tools/bake-vectors.js which derives from it), the card pages (tests/question-composer.html, tests/cards-cluster.html), or the composer's search (api/find.js). What is HERE is what no file can say for itself: the design law, the alternatives that were measured and rejected, and the facts about other people's software. The traps are commented at their own sites and are not repeated here. The last section is an ARGUMENT rather than a rule and can be skipped during a build. Nothing here applies to a lesson that draws one stage of its own. -->

# Cards, the stage concepts, and the door map

## **Goal**

Exploration by **connecting questions through biology concepts**. A door opens onto concepts; a shared QUESTION is the crossing from one concept to the next, which is what makes the map a map rather than a list. Typing your own question is a second way in, needing no door. Specimens — real deposited structures — hang off the concepts that hold them.

**`tests/question-composer.html` is the page.** One page, one renderer — a second copy of the same engine without the text box was kept for a while as the plainer version, and it is gone.

**Bipartite, with one exception.** Concepts never link to concepts, and a question is always the crossing between them. A concept reaches a SPECIMEN or a VIDEO directly, with no question between; that survives because both are LEAVES and never link onward, so the graph stays layered and the fan, the bands and the relax are untouched.

**Three things whose ROLE is not visible from their name:**

* **`lib/mapcontent-vectors.json`** is derived, not authored — the map's searchable text embedded once by `tools/bake-vectors.js`.
* **`proteins/proteins.js`** is not map content. It is the registry of which structures we hold and which file plays which role; `PLACEMENTS`' `p:` rows name keys in it.
* **`tests/cards-cluster.html`** is the stage bench, not a lesson: a wall of cards across every kind, against a pool budget of 4.

`map-cms.html` edits `lib/mapcontent.js` through the dev server and is not served in production.

## **How much opens, and when**

The door opens **three levels deep, not one**: its rank 1 concepts, their best band of questions, and the concept each of those leads to. The water door is the argument for it — everything water does comes from polarity, so a fan of five peers would state the wrong thing. Polarity is the door's only rank 1 concept, and hydrogen bonding, solvation, dehydration & hydrolysis and the hydrophobic effect arrive through the questions that cross to them.

A click carries the same shape: expanding a concept deals its questions **and** the concepts each question ranks first, because a question with nothing on its far side is a crossing the reader has to take on faith.

**Band, not rank 1.** The filters take the lowest rank a question actually has among its still-hidden concepts, so a question whose concepts are all rank 2 deals them rather than nothing. Whole bands only, which is the same promise a card's own wave makes.

**A concept's neighbours include ITS DOOR.** `start()` never sees it, because the door is visible before anything expands. Anything that roots the map on a node OTHER than the door must filter the door out of every concept's wave — otherwise each concept deals the same 29rem door node and they stack on it. This one is not commented anywhere, because no single site owns it.

## **Zoom**

Two mechanisms, split at k = 1, and the split is the point.

* **Out (k < 1): `transform: scale()`.** Minifying costs nothing in sharpness and leaves the layout alone. A relayout at 0.7 rewraps a heading, which redesigns the card under the reader.
* **In (k > 1): CSS `zoom`.** A scaled layer is rasterised once at layout size and stretched, so every glyph softens — worst in Safari, which holds the cached layer. Zoom relayouts at the size being looked at.

The two agree exactly at k = 1. All the pan/drag maths is in screen px; only the translate is divided, because zoom multiplies the element's own units too.

**The zoom floor is a decision, not a clamp.** `centre()` floors at 0.5 because that is what a claim is readable at — it does not solve the opening view out of the window. So a band means the same thing on every screen and for every door, however many cards it opens with.

**A card's controls are not on the view's scale.** A band is the VIEW's, and an open card is 34rem where the rest are 17.5, so at one zoom the two are not the same size on screen at all. What a control needs is APPARENT size, so that is what is measured. The upshot: opening a card is most of the way to being able to work on it, which is what the `.hub` width was already promising and nothing was reading. The concept still decides whether a control is EARNED; `.near` decides whether it is reachable, and it is faded rather than removed so nothing reflows as the reader scrolls in.

### What runs, and when

Three rules, all learned from a frame-rate readout in the corner rather than from reasoning about it — the loop's own JS turned out to be 0.12ms, so every real cost was paint, WebGL setup, or a rebuild.

* **The relax settles.** `alpha` used to floor low and run for ever, writing a transform on every card and a `d` on every link each frame whether or not anything had moved. It now decays to zero on a MOTION test.
* **Card loops pause while the map moves**, and come back after it settles. A paused box keeps its last frame, which is card-stage's whole bargain.
* **A revealed card starts on a calm frame, not a settled one.** A context, its shaders and its geometry are tens of milliseconds that no spreading makes free — but waiting for a full settle left the card the reader just opened on its placeholder for seconds. At LOAD there is no motion to protect, so the first drain runs flat out and in reveal order; every drain after it waits and goes latest-first.

**Canvases follow separately.** A card's canvas measures its UNZOOMED layout box, so at k = 2.5 it draws 2.5x fewer pixels than the screen shows. Pixel ratio is re-set after the wheel stops, because re-sizing a drawing buffer reallocates it.

## **Invariants**

**They are commented at their own sites, which is where they bite.** Listing them here as well was two copies to keep in step. What is worth knowing cold is the SHAPE they share: every one of them ships looking fine. Contexts are dropped with no error, a control renders and highlights and does nothing, a card sits at the origin at opacity 1, a toggle is present and queryable and invisible. Read the header comment of whichever file you are in before changing it.

Two that are not any one file's:

* **One scale family per SCENE, not per page** (MolecularGeometry.md §1.5). A page with separate stages may load both families and says so at its script tags — that comment is the only enforcement, since which scene a spec lands in is a runtime fact.
* **`querySelectorAll` finds a control that `opacity: 0` has hidden.** Anything gated by `.near`, `.hub` or a class is verified with computed style, or it is not verified. And a synthetic `click` in the console skips the pointer sequence half these bugs live in, so it passes on a completely dead button. Test controls with a real click.

## **Card kinds**

**How a kind is PLACED is the kind's own business, and the three ways are not interchangeable.** `water`, `build`, `molbox` and `protein` are INLINE: they mount a live box in a concept card's thumb, cost a WebGL context, and a card takes its rank 1 inline item and no more, because the pool rations four across the whole map. `lesson` is a BUTTON — a lesson has no still of its own worth showing, and the card it hangs off is the picture. `video` is a CARD, its own node hanging off the concepts that placed it, exactly as a specimen does: a poster, a title and somebody else's name is a card's worth of content rather than a chip in a corner. A specimen is always `protein` and has no `CONTENT` row at all.

### The caption column

**Captions are off in the player and the text sits beside it.** These animations print their key terms on the picture (`Glucose`, `Pyruvate`, the ATP counter), and a burned-in caption lands on top of the word it is explaining. So the cues run down a column to the right of the modal, lit line following playback, click a line to seek. `cc_load_policy=0` only asks, because a reader whose YouTube account defaults captions on overrides it and that is exactly the reader this is for. The API's getters keep reporting a live track after it is killed, so **the picture is the only test** that it worked.

**The player chrome is ours as far as it goes, and the limit is measured.** `controls=0`, a `pointer-events: none` frame and our own strip give a clean picture on a straight watch-through. It does not survive interaction: YouTube draws its own overlay on every pause AND every seek, a cue click included, and it does not fade on a timer worth waiting out. Measured after a resume, it was still up at +2s and gone by +8s. Covering it would black out several seconds of film every time a reader touches a cue, which costs more than the chrome does. **So the cover is the pre-play state only.** Removing this properly means hosting the file, which needs the author's permission. Do not re-attempt covering it.

**The cue file is authored, and it carries two tracks.** YouTube publishes no caption text a page can read: the Data API's `captions.download` is owner-only OAuth, `timedtext` serves an empty body to a plain request, and the only track on the glycolysis video is auto-generated ASR, which renders enzyme names as noise.

**A video that is not ours leads with its own words**, credited and linked, because putting our sentences where its author's were is its own kind of misrepresentation. The second track is the same beats rewritten for a Bio 101 reader and is labelled a summary. The column prints the source of whichever is showing: a column of somebody else's writing with no name on it reads as ours. `step` is the lesson's own numbering, so a cue and `glycolysis-lab`'s ten steps cannot drift apart.

**Two modals, not one parameterised modal.** A lesson and a video share the word "opens" and nothing else: a lesson is same-origin, a page we own, sized as a sheet, carrying `chrome=bare`; a video is 16:9, third-party, autoplaying, and its header has to say whose work it is. **The map at rest makes no third-party request** — a video's `src` is a bare id and the embed is built from it, and the poster is a local file for the same reason.

### The protein card

**`kit/proteinbox.js` owns the molecule; the page owns the map.** The box knows about the trace, the surface and the fold, draws its own two controls, and — given `protein:` / `variant:` — reads `proteins/proteins.js` to find those files itself. The openers and their modals are the page's, because a box has no opinion about what is behind the card it sits on. `rendering-modules.md` has the module.

**A protein card is angstroms, and its own scene** — which is what lets it be, since every other card on the page is a spec in the small-molecule family (MolecularGeometry.md §1.5).

**Three things a protein card can show, and only the first is free.** Ribbon is a 12 KB trace and is drawn at reveal. The surface is a few hundred KB and the fold is most of a megabyte, so both are gated on `.near` and then on the click. The gates are the design, not a loading strategy.

**One decoded surface per page.** A few hundred KB of quantised mesh becomes several MB of GPU buffers, and the pool rations contexts, not what a page hangs off one. A card that loses its surface falls back to the ribbon it never removed.

**The fold is a play button, not a third segment.** Ribbon and surface are representations — the same molecule drawn two ways, which is what a segmented pair says. The fold is an event: it starts, runs, ends. Its rule lives in `hemoglobin/foldplay.js`, shared with `hemoglobin-lab`, so the card cannot become a second unwatched copy of act 2.

**The two live in different frames** — the trajectory in `FoldLib.orient()`'s, the trace in the crystal's — so the toggle re-frames rather than flipping visibility, and one is on screen at a time, which is what makes that legal. The fold is framed on its FINAL radius, or the camera appears to fold along with the protein.

**Protein cards do not orbit**: a drag on a card is a drag on the map. Otherwise a reader who meant to move a card turns the molecule inside it, with no way back to the framing the card was composed with.

Small molecules go to the builder (flat view draws the electrons); molecules with no recipe go to molbox. Builder and molbox are ortho.

### The lesson behind a card

A card is a promise that a thing is worth looking at; the full act is `hemoglobin-lab`'s, and it stays there. **Open lesson** on a `.near` protein card puts the lesson itself in a `kit/modal.js` card over the map, in an iframe.

**`?chrome=bare` is the LESSON's parameter, not the map's.** The map asks for a mode; the lesson reads it before first paint (so it never flashes its own title on the way into someone else's frame) and its own stylesheet decides what bare means. Anything else that must go when the lesson is not the whole window is added beside that rule, in that file.

The alternative was the map injecting a stylesheet through `contentDocument`, which same-origin allows. That is the map holding an opinion about another page's internals, and it breaks silently the day the lesson renames a selector. Nothing would check it.

**The iframe is empty until it opens and emptied on close.** A lesson is its own WebGL context and about a megabyte of trajectory, and neither should be paid by a reader who never opened it.

**What did NOT get extracted, and why.** The lesson's act is ball-and-stick with per-frame pendant rebuilds, H-bond dashes gated on measured formation, the `fx` layer, a focus/opacity blend, a camera that turns across the coda, timed callouts, then the heme and three chains arriving. Almost none of that is a property of the fold — it is the telling of it, and extracting it would extract the lesson. `FoldPlay` took the one piece that is a rule.

## **question-composer: the map entered by typing**

**One copy of the engine, and that is the point.** This page was for a while a rebase of a boxless twin, and the twin drifted the moment it was taken — ~175 lines behind within the day, and still carrying the protein card inline after `kit/proteinbox.js` had taken it out. Keeping two copies in step is a cost on every engine change forever. **Do not take another copy to try something in.**

The claim the text box makes is that **the typed question becomes a temporary door**. `openFrom(q)` composes the same three levels `start()` does, rooted on a question instead of one of the written doors, and keeps start()'s own-door rule so a crossing does not haul its far side in.

**Content is in the corpus, not only questions about it.** A concept used to be reachable only through a question somebody had written for it, so `geometry`, `covalent` and `ionic` — no questions filed — could not be found at all, and `what is a buffer` was a miss with Acids & pH sitting right there. Every concept's `claim` is now a row of its own. **A claim never becomes a hit**: a hit is a row the reader opens as the authored question it matched, so a claim arrives as a discovered (dashed) edge, which is what a proximity to the content itself is.

**The two kinds do not share a threshold.** Claims sit lower than questions across the board, declarative against interrogative, so their floor is separate and was measured rather than guessed: 20 off-map queries top out at 0.825 and the answers the question corpus cannot reach land 0.84 to 0.94. One floor and no vote rule, because a claim is the concept's own sentence and there is nothing to corroborate it with — measured, `asdfqwer`'s top claim carries two question votes, so corroboration separates nothing here.

**Two halves, and only the first one changed.** `search()` scores the typed text; `openAsk()` composes the map around what it returns. That seam held: the scorer went from token overlap to cosine over baked embeddings and nothing below it moved. The lexical pair is kept as the no-key fallback rather than deleted — a checkout with no `GEMINI_API_KEY` is still a working page, and it is the same code path the session drops to when the endpoint refuses.

**A miss is the artefact, not the failure.** Below the floor the box says nothing answers that yet rather than routing to the least-bad card, and the typed text is the only record of a door worth writing. Every search is a row in `finds` (`api/_finds.js`), and `demos/ask/log.html`'s **Map** tab is where they are read — rolled up by repeated text, because one person asking about osmosis is a person and forty are a lesson that is missing.

**A good few of the questions in `mapcontent.js` name one concept.** Rooting on one of those opens a handful of cards rather than a neighbourhood, which is a thin door a student can type straight into. That is the "a question naming ONE concept is a caption, not a crossing" gap `mapcontent.js`'s own header already flags; the composer is what makes it visible.

### The reader's own words, and the edges off them

The typed question is **one card carrying what was typed**, dashed and captioned *you asked*, with two kinds of edge off it:

* **Inherited (solid)** — the concepts of the authored question it matched, carrying the rank that question already had on each. Real crossings.
* **Discovered (dashed)** — concepts the text reached on its own that the match did not already cover. Proximity, drawn as proximity.

Both at once, because a question rarely lands entirely in one bucket. Measured: *"how does my body get energy from sugar"* matches *"Why is sugar sweet and starch isn't?"* and inherits Monomers & polymers and Molecular geometry, while the discovered edges are what reach **Glycolysis**, which the authored match never touches. The match explains what the map already answers; the discovered edges are where this particular wording pulls that the authored one does not.

The card prints both wordings (*the map words it as "…"*), because the reader is the only one who can tell whether they mean the same thing.

**Zero reach is the only miss, and it must not open.** A root with no neighbours draws one card on blank paper, which reads as a broken page rather than as an answer. This is the failure that killed the first version of this feature: two guards (a 0.34 floor and a two-matching-words rule) made most questions reach nothing, and every one of them rendered as an empty map.

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

So a keyword that names a card is answered **before any embedding**. It is a CARD-NAME LOOKUP and not keyword search: exact on the name or on an authored alternate, then a prefix / whole-word pass at five characters or more.

**A concept matches its name and its `alt` list, never its id.** It used to match the id, and that was measured and retired: the branch was load-bearing for about a third of the cards and junk for the rest. `ice` and `geometry` landed only because somebody had picked a short id; `cooperat` and `hydrophob` were truncations no reader types; `condense` answered for Dehydration & hydrolysis by accident. Worse, it did quietly what the name rule refuses on purpose — `density` cannot reach Ice & density, but `pumps` reached Channels & pumps, and an internal key was what decided which. Those ten are `alt` entries now, so they are authored, and the list reaches what no id ever would: `pH` and `buffer` for Acids & pH, `water fearing` for the hydrophobic effect, `quaternary structure` for Levels of structure.

**A SPECIMEN still matches its registry key**, and the case that settles it is `hemoglobin`, whose registry name is the British spelling. Drop the key and an American student cannot type the flagship card. A protein's key is its common name; a concept's id is an abbreviation of its own title, which is the whole difference.

**`alt` is for knowing, not for ranking.** It is not baked into the claim's vector: a sentence that measured well is not improved by synonyms stapled to it, and a two-word row embedded against a corpus of sentences ranks badly. Two alternates that normalise alike are a `--check` failure — first match wins, so which card a shared word opens would be an accident of table order.

**"The name holds the typed word" is deliberately NOT a rule.** It was tried, and it let `effect` claim The hydrophobic effect and `levels` claim Levels of structure — a tail word is not a name. The cost is that `density` no longer reaches Ice & density, which is the right trade: being asked to type the head of a name is normal, being answered from its tail is a surprise. Head-word prefixes like `simple` → Simple diffusion do still hit, and read as autocomplete rather than as a wrong answer.

**The second half is not solved.** `photosynthesis` (0.851) and `mitosis` (0.849) sit above real on-map keywords like `pH` (0.852) and below none of them: there is no gap to cut. Corroboration narrows it (`DNA` has 7 near questions, `photosynthesis` 1) without separating it. A bare keyword that does not name a card can still land somewhere plausible and wrong, and the fixture is what should settle whether short queries want their own floor.

### The list is what the map already says

Putting the reader's own wording on the map is what **Enter** does, and it is **not a row**. It was one, and drawing it meant offering the reader back the thing they had just typed, above the answers they came for. So the list holds only what already exists: a named card if there is one, then authored questions, and no concept chips under them — which cards a question opens is what the map itself shows a moment later, and saying it twice made a list of questions read as a list of metadata.

A miss keeps one line of its own. Without it, Enter on a question the map cannot answer does nothing at all and reads as a broken box.

### A door as a saved query

`?q=` opens the map on a question through the same path a reader's own typing takes. Every door carries one and `admin.html` links them all, so the claim is testable rather than argued: if a composed query reads as well as `start()`'s hand-tuned fan, the door stops being a node kind and becomes a URL somebody bookmarked.

Measured, one link per door: water lands on the same three cards `start()` composes, which is the result that matters. The doors that pull in other doors' concepts are doing the right thing rather than leaking — base pairing IS hydrogen bonding, and folding IS the hydrophobic effect, so a crossing at the opening frame is the map making its own argument. `energy` opens thin because that door has one concept, which is content and not mechanism.

**The card is the intro.** `?q=` draws the reader's question at once, alone, framed centre at whatever zoom one card fits at, with the mast, the ask box, the legend and the readout hidden — the intro is a state of the PAGE, not of four widgets. There is no separate title card: a second presentation of the same sentence was one too many, and the card can carry it at a size worth reading.

**The reveal is a PULL-BACK, not a cut.** `openAsk()` re-shows the card at the same origin and centres on everything it composed, so the reveal tweens from the frame the card was introduced in to that one — x, y and k together. One card fits at a closer zoom than twenty, and that difference IS the reveal: the camera draws back and the map appears around a card that never moved. A drag or a wheel ends it, because the pull-back is an offer and not a ride.

It fires on the LATER of the graph being composed and a beat long enough to read the sentence. Whichever is slower is the one that matters, because a fast load should not flash the question away and a slow one should not add a wait on top of a wait. Every path out lowers the intro, including the query that reaches nothing and the corpus that will not load — chrome that never comes back is worse than the map it was hiding, which is why a missing corpus THROWS rather than returning past the reveal.

**The question is on screen before any fetch returns**, because `?q=` carries it: the card is up at ~46ms against ~490ms for its own embedding. **And the three requests go out together** — corpus, endpoint config and the query's embedding were serial and none needs the one before it. The POST is fired before the GET has said the endpoint is up, because a wasted POST on a keyless checkout costs nothing while waiting for permission costs a round trip on every load that works.

**Start over** reloads the query instead of opening water: arriving on a saved query makes that query the starting point.

**A door's question now has to RETRIEVE as well as read**, which is a constraint a door that was only a node never had. `What decides which things get into a cell?` opens the PROTEIN door: `cell` collides with *"Why does one wrong amino acid sickle a whole cell?"* at 0.863, and two separate phrasings using the word did it. `membrane` does not collide. Write a door's question against the corpus, not against the ear.

**What deleting `DOORS` would actually cost.** The node and `start()` go, and so does the own-door filter — but `door` survives as a CONCEPT field, because it is also the colour system: a concept's door tint is the dot, and that dot is how a crossing is visible on a card that looks like all the rest. So the end state is a lookup table of regions, not an entry point.

### The vector backend

`tools/bake-vectors.js` embeds the authored questions once (gemini-embedding-001, 256d, `SEMANTIC_SIMILARITY`). `api/find.js` embeds the READER's question and returns only that vector; the ranking happens in the page. The corpus vectors ship with the page anyway, so a server-side cosine would protect nothing, and the floors are the knobs worth tuning without a redeploy.

**The task type is not a detail.** A query embedded with anything other than the corpus's task type lands in a different geometry: the cosines come back plausible and the ranking is quietly wrong. `api/find.js` echoes its task and dims, and the page refuses a vector that disagrees with the file it is comparing against.

**Concepts come from questions, not from a bag of their own.** The lexical fallback unions every question under a concept into one token bag, which is where its noise came from: `ice` inherited the word `blood` from a question about freezing, so anything mentioning blood scored against it. Ranking whole questions and reading off THEIR concepts is max-pooling instead of mean-pooling, and the collision has nowhere to form. Measured: *"why is blood red"* went from Ice & density to Cooperativity.

**What ten queries settled, and what they did not.** The shape of the scoring is now known and the numbers are not:

* An **absolute floor works for the match**. Off-map questions ("the capital of France", "how do I bake sourdough") land 0.79-0.83 and real ones land 0.87+, so a 0.85 floor refuses cleanly. This was worth measuring, because corpus-to-corpus similarity sits in a narrow 0.75-0.99 band that suggests no floor could work; query-to-corpus separates where corpus-to-corpus does not.
* **Normalising against the query's own distribution is worse.** A z-score ranks `asdfqwer` above a real membrane question, because a flat distribution has a high z at its own top. Tried and rejected.
* **An absolute floor alone fails for discovered edges.** Glycolysis's best row for *"how does my body get energy from sugar"* is 0.836 and correct; Base pairing's for *"what makes hair curly"* is 0.841 and noise. No cut separates them.
* **Votes alone fail too.** Counting how many top rows carry a concept puts three of them on *"how do I bake sourdough bread"*.

So a discovered concept must clear a floor AND be corroborated: two near questions carry it, or one carries it from very close. Ten queries is enough to see that shape and nowhere near enough to trust the constants. The fixture is what should fix them.

**Embeddings recover coverage, not only phrasing.** *"why do we breathe"* reached nothing lexically and reads as a coverage gap; it matches *"Why does breathing fast make you dizzy?"* at 0.903. The question was always there.

**No key, no vectors, no problem.** The page falls back to the lexical scorer, says so in the placeholder, and one endpoint failure drops the session to words rather than to nothing. A keyless checkout is a working page.

**`api/find.js` is open, and metered by its own counter.** It does not use `api/_limit.js`, which counts rows in the tutor's tables that a search never writes. `api/_finds.js` counts the rows this endpoint writes: a per-visitor cap that is friction, and a global cap that is the actual protection, since it needs no identity and holds against a script. Both fail open, like the tutor's.

**Why open rather than gated.** The gate it would inherit is `TUTOR_KEYS`, so a shared map link would hand out tutor spend along with it: one link, two budgets, and no way to give away the first without the second. Cost is not the reason either way. Gemini's rate limits are per PROJECT, so an abused search endpoint starves the tutor of quota whichever API key each presents, and a second key would buy revocation rather than isolation. The caps are what prevent that; the gate never could.

**A refusal is not an outage.** The page drops to the lexical scorer on any non-ok reply, 429 included, and says so in the placeholder. That is what makes it safe to set the caps low rather than generously.

### Editing the map after it is baked

**Re-bake when any BAKED TEXT changes**, and only then. Vectors are keyed on the text, and two texts are baked: a question as written, and a concept as `Name. claim.` So a question's wording and a concept's `name` or `claim` re-bake; ranks, edges, `door`, `host`, `CONTENT`, `PLACEMENTS` and `DOORS` do not, because they are read live at load.

```bash
npm run check:vectors                # names the drift, embeds nothing
node tools/bake-vectors.js           # re-embeds only the rows whose text moved
```

**There is no separate *check-mapcontent.js*.** One script, two modes: both read the same file and the same hashes, so a second one would only be a way for them to disagree.

**Forgetting is silent, so the page says it out loud.** A question whose wording changed has no vector and is simply ABSENT from search: not a wrong answer, an unreachable card, and nothing about it is visible on screen. So the page compares its question count against the baked file and warns to the console with the exact rows.

**The deployed page reads the committed file**, so a re-bake has to be committed and pushed like any other artefact.

**Renaming or deleting a concept id silently drops every edge pointing at it.** The card is still drawn, the question is still drawn, and the crossing between them is simply gone — the one thing the map exists to do. Nothing caught this, so `--check` now does, and it covers a renamed protein key the same way. It fails `--check` and only warns a bake, because a broken reference does not corrupt a vector: it breaks the map.

**Attaching an EXISTING question to a new concept needs no bake.** Nothing about a concept is embedded for the vector path — a matched question's concepts are read from its edges — so the text did not move, only the edge. A new concept built out of new questions does need one, for the questions.

**Gated on `lib/mapcontent.js`, not on the page.** `question-composer.html` is still test status, and the usual reason a test page skips a gate is that it has no audience — which stops holding the moment the link is shared. What the hook protects is the MAP, which has nothing to do with embeddings. The check belongs in the hook rather than beside `tools/check-handedness.js` because it is offline: `--check` embeds nothing. Only the fix needs the key, which is what `--no-verify` is for.

### CONTENT and PLACEMENTS — a concept is a claim, content is what makes it visible

**One concept can have many.** `VIEWS` was keyed by concept and could hold exactly one entry per card, so glycolysis could have a molecule or a video and never both. `CONTENT` is content-major — one row per unit, `id` namespaced by kind — and `PLACEMENTS` says where each one sits, carrying the rank it has on each concept. Same split, and for the same reason, as `QUESTIONS`: the thing is one object however many concepts point at it.

**Rank means what it means everywhere else** — 1 is what the card opens with, 2 is one step in. Reusing it rather than inventing a rule is what lets content be authored like everything else here. For inline content it also breaks the tie, since a card can only afford one live box.

**A `p:` row is the exception that proves the table.** It places a protein whose entry lives in `proteins/proteins.js`, and nothing in `CONTENT` restates what that protein is. Every entry in that registry is drawn whether or not it has a row here; without one it hangs off the Proteins door at the back rank. So adding a protein stays a one-file edit, and `PLACEMENTS` is an override rather than a second registry to keep in step. The registry says what we hold; the map says where it belongs and which deposition it means.

**The MAP names the pair, the BOX finds the files.** A `p:` placement stores a protein key and optionally a variant id, and that is all it stores: no path, no filename. A page that reconstructed a filename from a stem would be standing a convention where a fact already is, and it would go on working right up until one file was named differently. An explicit path still wins, because an `r:` content row names files the registry has no role for (a chain-B fold, a lesson-tier surface).

**Two conventions for finding the ribbon, and the registry means both.** A protein on its own pipeline carries a `bake` block naming every artefact by role, and that block is authoritative: hemoglobin's 2HBS has no `trace` in it because the entry is deposited for a SURFACE — a contact between tetramers is a claim about skin — so no ribbon exists and the box says so instead of drawing an empty frame. A protein on the shared `trace` pipeline has no `bake` block at all and `read.baked` IS its trace. Reading `read.baked` unconditionally hands 2HBS's quaternary json to a ribbon drawer.

The surface toggle then follows the registry's judgement for free: a variant with no `card` role has none because a skin teaches nothing about it, and for the pump it would hide the site that is the whole point of the E1/E2 pair. **The surface is the CARD tier, never the lesson's** — a card bake is a fraction of the lesson's for the same structure, and a 280 px thumb cannot show the difference. A card surface that is baked must also be RECORDED as a role, since a file in `data/` the registry does not name is exactly what `proteins/check-proteins.js` exists to catch.

**`viewFor()` is the one place that decides what a node draws.** A concept hands over the best-ranked INLINE item placed on it; a specimen hands over `{protein, variant}` and lets the box resolve; a video hands over nothing, because a poster is markup rather than a stage. Two callers, one box, and no third place where a filename could be wrong.

The caption takes a second sans token, `--ui` (`system-ui`), because `--sans` is Futura and Futura is a DISPLAY face here: it carries the logo, the buttons and the uppercase letterspaced labels, and it is unreadable as running text at 11px. Prose set in sans takes `--ui`; a label keeps `--sans`.

### A new KIND of node is a page change

`DOORS` / `CONCEPTS` / `QUESTIONS` / `CONTENT` / `PLACEMENTS` are data, and a sixth table is not. The page says what a kind is in several places, and the diff is the only reliable list of them.

**The drawing half is cheap; the half that bites is the checks that GATE rather than draw.** Adding specimens, a kind check that skipped a non-concept left the surface toggle invisible at every zoom, and not focusing a named card left it just under the controls threshold for a second reason. Neither threw, neither logged, and both survived a DOM query that found the buttons and reported them working. **The lesson is the test, not the count.** A cheap kind is still a kind — cheap for a leaf, as specimens and videos both turned out to be, and not cheap for anything that questions must cross THROUGH.

**A named card is focused**, the way a clicked one is, so it takes `.hub` and its full width. Naming a card is asking to work on it.

## **Gotchas for a cold session**

* **The browser probe tab is hidden**, so `requestAnimationFrame`, `ResizeObserver` and `IntersectionObserver` delivery never fire. Drive `box.pump(dt)` and the page's own `step()` directly. `pump()` exists for this.

* **`setTimeout` is throttled there too**, so a debounce does not fire on the schedule you typed against. A dropdown that looks empty a second after typing is usually this and not a bug.

* **Screenshots with 4 live contexts come back blank** in the probe tab — the compositor does not pick up four WebGL layers. Verify with `readPixels` or `snapshot()` instead, and ask the human to look in Safari.

* Checkers: `node tools/check-pages.js`, `tools/check-docs.js`, `tools/bake-vectors.js --check` (the map's own — vectors AND references), `proteins/check-proteins.js`, `kit/check-kit.js`, `molecule-builder/check-molecule-builder.js`, `check-molecules.js` (slow, ~2min). The pre-commit hook gates each; silence means it ran and passed.

* `check-docs.js` treats any backticked path as a claim the file exists, and resolves it from `demos/` — so a checker outside `demos/tools/` needs its directory (`proteins/check-proteins.js`, not the bare name). Write a former filename in italics, not in backticks. This doc has broken that rule four times now and the checker caught every one.

## **Considered**

1. **NOT recommended: a card-view registry.** I proposed it, then measured: after deleting `mol`, `build` and `molbox` are one-line calls and only the ~12 lines of WaterSim seeding are duplicated. That is a vocabulary, not an implementation (Modules.md's own test). If it bothers you, the honest home is a `WaterSim.scene(root, {waters, salt})` helper in the module that owns the physics.

## **Where this is going**

*The one section here that is an ARGUMENT and not a rule. Skip it during a build; it exists so a cold session knows which way the code is being pushed and does not defend a decision that is already on its way out.*

**The ask box is what the map is for, and doors were the scaffold that let it be built before search existed.**

**The architecture already suits it, in the one place that counts.** The relax is O(live²), not O(nodes²): it costs what is DRAWN, never what exists, and `openAsk()` never consults a door. A corpus ten times bigger costs the layout nothing, because the map is never drawn — a neighbourhood is.

**What does not scale, in the order it will break:**

* **Hand-authored rank.** It does two jobs that separate under density — *what opens this card* stays editorial, *which four of two hundred questions* cannot be answered by hand. Human curation will be in selecting the content to add; ranking will become an AI feature that is either live or baked, and right now the human is curating the examples. The plan is the `said` / `read` split this repo already runs on `proteins/proteins.js`: authored ranks are the human's half and are never overwritten, generated ranks are derived and regenerable, and `--check` fails a generated one sitting where an authored one was. The authored edges become the eval set, and **the ones carrying a different rank on different cards** are the subset that matters, because they are the only evidence that rank belongs to the edge and not to the question.
* **The absolute floor.** It was calibrated against the corpus as it stood. As the corpus densifies the nearest neighbour gets closer for EVERY query, off-map ones included, so the floor drifts without anything being wrong. It has to become relative, or be recalibrated at every significant growth. The fixture is what would catch that.
* **The shipped corpus.** ~2 KB a question: comfortable to ~500, awkward past ~1500. Quantising to int8 buys 4x. Past that, search moves server-side — which is why `api/find.js` returns a VECTOR rather than results, so that flip is a change in one file.
