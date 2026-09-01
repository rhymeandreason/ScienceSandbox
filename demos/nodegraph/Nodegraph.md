<!-- KIND: rulebook. Load whole before touching graphdata.js, graphcontent.js
     or nodegraph.html. Biology-Node-Graph.md is the conceptual truth for what
     the graph is FOR; this is how it is built and what breaks it. -->

# Working on the node graph

Three files. **`graphdata.js` is the skeleton** — nodes and typed, ranked edges, and nothing that draws. **`graphcontent.js` is the material** attached to it, separate because the two evolve at different speeds. **`nodegraph.html` is the page**, and it holds no curriculum.

Content is **re-declared here, never shared with `lib/mapcontent.js`** — the questions-composer is being deprecated and the nodegraph is not inheriting a dependency on it. Copying a curated row is the accepted cost.

## The two axes are semantic

**X is explanatory order**, computed from the edge types. **Y is the scale ladder**, from each node's `level`. So `part-of` edges run vertically and causal edges horizontally, and reading direction is explanation direction.

## Edge grammar

Every edge type is in exactly one of four groups, declared in `nodegraph.html`:

* **FORWARD** — `prerequisite-of` `causes` `determines` `enables` `produces` `alters` `transforms-into` `evidence-for` `part-of` `contains` `contributes-to` `lowers` `precedes` `necessitates`. Source sits left.
* **BACKWARD** — `consumes` `destroys` `explained-by` `instance-of` `illustrates`. Target sits left; an instance comes after its class.
* **LATERAL** — `contrasts-with` `analogous-to`. Beside the reading: no order, no arrowhead, contrast colour, never a walk step. One holds two things apart, the other says they are the same move in different systems.
* **Ordering nothing** — `describes` `answers` `preserves` `spends` `supplies`.

**Containment is two relations pointing opposite ways.** `part-of` BUILDS, so the part reads first (amino acids make a primary structure). `contains` ZOOMS IN, so the whole reads first (you meet the enzyme, then look inside for the pocket). One type for both put the entire enzyme subtree six columns left of the enzyme.

### A resource claim is not an explanatory order

The map has learned this four times: fermentation recycling NAD⁺, active transport spending ATP, the Calvin cycle handing sugar to glycolysis, and dehydration synthesis producing water. Three closed a cycle — the Calvin one made **every node on the map** circular.

**The fourth did not warn.** `dehydration produces water-mol` and `hydrolysis consumes water-mol` laid out cleanly and read as an ordering, so they pinned the whole macromolecule lead-in to column 0, on top of the electronegativity water's own story starts from. Nobody reads dehydration synthesis before they know what a water molecule is. The reading order runs the OTHER way, and saying so is what put the macromolecules right of the unit that explains their solvent: `water-mol prerequisite-of dehydration`. **A resource claim standing in for an explanatory one is silent** — look for the pair, not just the cycle.

Biology's resources genuinely go round in loops and the explanation axis is a DAG. `spends` and `supplies` exist so an edge can say "this makes the stuff that one over there uses" without also claiming which is read first.

**A cycle is always a data bug.** The page warns; the check below catches it.

## Node types

| type | what it is | walkable? |
| --- | --- | --- |
| `concept` `structure` `process` | the skeleton | yes |
| `question` | a door. `qtype` is `anchor` (opens a unit, large), `bridging` (joins two already open, small) or `extension` (small, italic, blue) | via `answers` |
| `theme` | a saved query over the map. Its fan is dealt whole regardless of rank | no |
| `evidence` | how we know. Meselson–Stahl, Hershey–Chase. **Not on the map** — pulled before layout, dealt from a pill | no |
| `specimen` | spawned from `proteins/proteins.js` by a `p:` placement | no |
| `content` | a film, spawned from `graphcontent.js`. A LESSON IS NOT ONE: it rides its concept | no |
| `ask` / `satellite` | a facet pill and what it reveals | no |

Everything after the first row is a **destination, not a station**: `station()` excludes them so the walk never steps onto one. Adding a type means adding it there too.

## Rank, and the spine flag

`1` is the spine, `2` enrichment, `3` surfaced on request. Soft budget of about **five rank-1 edges per node**; past \~8 is a hairball wanting a hinge node. `hbond` is the sanctioned exception.

**Rank is authored and never rewritten.** Reachability is a separate field, `l.spine` — rank 1 plus each node's own best edge — so a node whose best edge is rank 2 is still reachable without falsifying the rank that draws it, orders the walk and sizes hubs. Promoting rank in place is what once erased the map's only rank-3 edge.

**A theme's rank is read from the instance's side only** — `p:prion instance-of folding` rank 1 says prion is the best thing we hold for folding, not that folding's next word is prion.

## Placement, computed once at load

No randomness, same map every session, so spatial memory can form.

**X:**

1. Longest-path layering over the ordering constraints.
2. **Pull-right**: a node with no upstream constraint is pulled to one column before its first *independently anchored* consequence. **The search is transitive** — a node whose every consequence merely trails it has no anchor one step out, and used to be left at column 0. That stranded `antiparallel → strand-asymmetry → replication` and `codon → genetic-code → translation` at the map's left edge, four columns before the DNA they are properties of.
3. **Median tightening**: a node with slack moves to the median of its rank-1 neighbours, clamped to its own legal range. Longest-path puts everything as far LEFT as constraints allow, which is wrong for a node merely *mentioned* early — glucose sat nine columns from the glycolysis that consumes it. Rank 1 is what makes it safe: a node with one late consumer and two early causes stays early.
4. Authored `nudge` last. Nothing uses it now.
5. **Columns are spaced by what they hold**, not by a constant. The gap after a column scales with the busier of the two it separates, 250px to 580px. A layer holding two nodes used to cost the same 430px as one holding twenty-three, so the sparse tail spent a third of the map's width on almost nothing — and white space around a lone question read as emphasis it had not earned — while the water end had cards in a gap barely wider than one card. Only the spacing changes, never the order, so no edge can reverse.

**Y:** levels 1–10 become bands, ecosystem at top, unoccupied bands stay thin. Then every node settles at the **median of its rank-1 neighbours**, with a levelled one clamped back into its own band. The ladder says which rung, the edges say where along it. Without this a membrane protein sat below the tertiary structure it is an instance of.

**A rung is as tall as what stands on it**, 340px to 1320px. Every used band was a flat 660px, so macromolecule's thirty-eight nodes and ecosystem's one got the same paper: five nodes were spending 2,640px of a 5,540px map while molecule and macromolecule had cards on identical points. `BAND_PAD` is a fraction of the band now, not 110px of a fixed 660.

**The median pass filters questions BEFORE the neighbour fallback**, and each pass reads a snapshot. The other order let a node whose only rank-1 neighbour is a question pass the non-empty test, filter to nothing and bail — van-Helmont never read the carbon fixation it is evidence for. Reading `ty` while writing it made a node's seat depend on where it sits in `graphdata.js`.

**A leaf sits on the card it points at.** A degree-1 node's median IS its neighbour, so the four DNA evidence cards were all targeted at one identical point one column left of `dna-structure`, and only the relax separated them.

**Questions** anchor 0.7 columns left of their rank-1 answer.

**Then the relax, which only resolves overlap**: x pinned to the column (0.12), y pulled to the median (questions 0.07, levelled 0.09, levelless 0.06), repulsion, a weak y-alignment along edges, deterministic jitter. No spring invents a position. Dragging pins a card out of it.

**Repulsion separates BOXES, on the axis of least overlap.** It used the circumscribed circle, so every card reserved its own diagonal in all directions — and the widest cards are the questions, so every hole in the paper had a door in the middle of it: measured, the thirteen loosest nodes on the map were all questions, at 600–780px of clearance against a 313px median. `sizeOf` is half-width and half-height, and the push takes the shorter way out. A wide flat card stops shoving neighbours down for a height it does not have.

## Extension questions, and the ask bar

**An extension question is not on the map.** It is a query, and a query has no seat: it arrives at whatever it asked about and leaves with it. `graphdata.js` authors it like any other question, and the page pulls it out **before layout** (`QUERIES`), keeping only `anchorId`. Leaving them in cost nothing visible and moved every neighbour they repelled. The degree they added is given back, or the card they answer reads one link heavier than it is.

**`kind` is optional.** Where the answer is one member of the target's `kinds`, the question names it and lands on that member: the card opens, the fan deals, and the question spawns beside the member, with the pill left in the chain because a reader who arrived by query and one who clicked "what kinds are there?" are looking at the same thing. Where there is no `kind`, the question lands on the card itself and the chain is one link. The fan was where this started, not what it is for.

Being a satellite is what makes it free: it rides its target, is skipped by the relax, and pushes nothing. `dropQuery` runs from `collapseKinds`, so the fan and the question that opened it leave together.

It is styled as a different ACT, not a smaller one: italic, and a blue no unit owns. Hover and focus both repaint a question in ink, so the colour is restated after those rules or they win.

**The bar is the only way to reach one**, bottom centre. It holds every question, not only the deferred ones — asking an anchor or bridging question focuses the card it already has. The placeholder rotates through them, so the bar shows what it accepts rather than describing it; Enter on an empty field takes the offer, typing filters, ArrowDown opens the list grouped by unit. A query arrives from wherever the reader was, which may be the whole map at 0.30, so `follow` carries a zoom and centres the CHAIN rather than the question — following either end puts the rest against a screen edge.

**Questions are searched by TERMS, not substring** — `tree mass` has to find "Where does the mass of a tree come from?", and a contiguous match never will. The card a question answers into counts too, at a fifth of the weight, so `pigment` finds the autumn question without the word being in it. Browsing and searching look different on purpose: an empty field lists every question grouped by unit, which is the curriculum's own order; typed terms give a flat list in score order, because the best match belongs where Enter takes it.

**Typed words that match no question are a SEARCH.** Cards are deliberately not in the dropdown: a reader who wants one types its name and presses Enter, and does not need a list to confirm the name they just typed exists. The search reads what is visible on a card — name, claim, and the names in its `kinds` — and a kinds hit resolves to the card that holds it and deals the fan, because that is where the reader has to go to read it. Every term must appear or the row is out, so two words narrow. Scoring is whole-field > prefix > whole word > fragment: `trans` is a fatty acid AND the first five letters of translation, and the one it *is* wins. A miss reddens the bar.

**Last, a semantic guess.** When nothing deterministic matches, `/api/find` embeds the line and the page cosines it against `graphdata-vectors.json` — baked by `tools/bake-graph-vectors.js`, one vector per question, per claim and per kinds member. The file is half a megabyte and is fetched on the FIRST MISS, never at load. A checkout with no key loses nothing it had: the endpoint's first refusal turns the fallback off for the session, so three misses cost one round trip, not three.

**It is a guess, and it says so.** Absolute cosine does not separate signal from noise here — measured, `asdfgh` scores 0.839 against its best claim while a correct hit scores 0.855. What carries information is how far the top row stands above the rest of its OWN kind, since questions sit systematically higher than claims (same register), which is what `kind` is in every row for. Even so the separation is soft: `my cat is hungry` reaches z=3.27, above real questions at z=2.7. So `Z_FLOOR` rejects only the flattest distributions and every arrival it produces is LABELLED "closest match" under the field. Raising the floor trades junk for real questions, one for one; it does not clean up.

## Extending the map

**A question the curriculum does not cover gets a GRAFT.** `/api/extend` proposes two or three cards wired to cards that already exist, and they arrive as satellites of the one they attach to: pinned, outside the layout pass, dropped when focus leaves. That is what makes it safe rather than careful — a generated node cannot move a laid-out card, close a cycle on the explanation axis or spend a rank-1 budget, because it never enters the passes that do those things. Measured: a graft drifts the skeleton **529.4px**, against **529.4px** for opening the same two cards with no graft.

**The model gets the whole INDEX, not just the retrieval.** Given only the vector search's candidates it wired gills to AQUATIC OVERWINTERING — `simple-diffusion` and `sa-v` never surface for that query because they never say oxygen. Two hundred ids and names is about a thousand tokens; the whole map is cheaper than being wrong. Rank is 2 or 3, never the spine; `part-of`, `contains` and `instance-of` are out of the grammar it may use; every id is validated at the endpoint and again against `byId` before anything is drawn, and an unresolvable edge is dropped rather than repaired.

**Ephemeral on the map, permanent in the drawer.** Rebuilding is not restoring — every build is a fresh call returning different cards — so a graft is saved to `localStorage` under the question that made it, and the question joins the dropdown beside the authored ones, in its host's unit, marked with a dashed rule. Asking it again deals the same cards back with no call. A saved graft whose host has since been renamed is skipped at load rather than becoming a dead door. Every accessor is wrapped: a private window throws on `localStorage` itself and the map still has to work.

**A stale bake is silent**, so `.githooks/pre-commit` gates `graphdata.js`, `graphcontent.js`, the vectors and the baker on `--check`, which is offline and only compares hashes. The baker also carries the graph's only OFFLINE integrity check — edges resolving, every extension's `kind` existing, every placement pointing at a real node — because the rest of the QA list needs the laid-out graph and lives in the browser.

### What belongs here

**An extension question is one that is worth asking and not worth a seat.** The map's 35 questions are doors into a unit or joints between two, and they are placed accordingly; these are the ones a reader arrives with rather than the ones the curriculum arrives with, so they are held in the bar until asked. They should be answerable by exactly one place on the map, and they should be worth reading before the answer is known.

**A `kind` still has to be THE answer where one is named.** *Why does eating fat give more energy than eating sugar?* was tagged extension with `fatty-acid` and had to be given back: the card's own claim already says the tail is the energy, and saturated / unsaturated / trans is a different question. Landing it kindless on the card would have been right; naming a member that does not answer is what was wrong.

## Evidence: a card that is not worth a seat

**Seven experiments, seven leaves, one edge each.** A leaf's y target IS its neighbour's, so the four DNA experiments were all aimed at one point beside `dna-structure` and stacked there, in the busiest columns on the map. They are pulled out **before layout**, the way an extension question is, and arrive from a **"How do we know?"** pill on the claim they settle.

**Only `type: 'evidence'` leaves.** `point-mutation evidence-for nat-select` and the three `evidence-for endosymbiosis` edges come from concept cards that are stations in their own right. The edge type does not decide this; the node type does.

**They are still findable by name.** `Meselson`, `Photograph 51` and `heavy nitrogen` all land on the claim the experiment settles with its fan dealt — the same arrival a `kinds` hit gets, scored the same way. The vector corpus still holds their claims, which are the most distinctive prose on the map, and `EVIDENCE_HOST` is what turns a row naming an off-map card into a landing.

**An experiment is only ever in a fan now**, so it is sized for one: 21.5rem and five lines. There is no short way to say heavy nitrogen or a labelled phage, and at card width Photograph 51 lost the sentence that matters.

## Two facets, one mechanism

`kinds` and `evidence` fail the node test for opposite reasons — a kinds member is too small to be a card, an experiment is a real card whose seat says nothing — and both hang off a pill. **So the pill belongs to the facet, not the host**: `host.facets.kinds` and `host.facets.evidence` each hold their own pill, fan and links, and where a card has both they stack. `carbon-fixation` is that card, and it is why `host.pill` could not stay a single field.

Only the kinds fan can carry a query: an extension question names a `kind`, never an experiment.

## Kinds: detail that failed the node test

**Reusable concepts get nodes. Facts about one thing get cards.** A `kinds` array on a node is the enumeration that fails that test — UV and benzene route nowhere and nobody arrives at one alone.

**Only where the members are NOT already nodes.** `organelle` gets no pill because nucleus, ribosome, mitochondrion, chloroplast and cell wall are already cards hanging off it; a fan would add leftovers and leave a reader asking why five members are cards and five are not. Where the members *are* nodes, the chips already lead there and going deeper wants a lesson.

**One member may keep its card when it alone carries something downstream.** `pigment` fans Carotenoid, Anthocyanin, Phycobilin and Retinal while `chlorophyll` stays a node, because chlorophyll is `part-of photosystem` at rank 1 and answers a question of its own and none of the others reaches anything. That is the split `organelle` forbids, allowed because it is one card against a fan rather than five against five: the reader asks why chlorophyll is different, and the map's answer is the edge leaving it. **Accessory pigments used to be a card here** — a card whose whole claim was the fan it named.

The chain is **card → pill → fan**. The pill is a node because as a chip it read as one more navigation control and what it does is not navigation. It grows on focus and goes when focus leaves that card's family.

**None of it is baked**, and that is deliberate. A satellite is a leaf with one edge to one parent: its position says nothing beyond "below this card", and nobody remembers the seat of something they have never seen. They are pinned, skipped by the relax's repulsion and link pull, and ride their host — so opening one moves nothing else on the map. Measured: **0.0px** of skeleton drift.

## Build: the map's other reading

The segmented toggle bottom left switches **Map** (the baked graph) for **Build** (one grown from a seed card). Same nodes, same edges, same authored rank — only the seats differ, so nothing in Build reaches into `graphdata.js` and no bake can go stale behind it.

**Both axes mean something else.** X is hops from the seed, y is a slot in a fan. So the scale ruler and the band lines are hidden in this mode rather than left to lie, and so are the ask bar and the highlight, both of which reach cards Build has not dealt.

**Two hops are dealt at the start; a click deals another.** Depth is not capped — the graph a reader ends with is the path they took.

**Five edges per card, rank-first.** A card deals its rank-1 edges and tops up from rank 2 and then 3 only if it is still short, so the spine leads and the enrichment fills in behind it. Uncapped, `func` and `protein-class` alone put seventeen cards on one column.

**The fan opens RIGHT whatever the arrow says.** On the map an edge's direction is the reading order and it decides which side of a card its neighbour sits. Here the reading order is the reader's own clicks, so what is right of a card is what that card revealed — a `consumes` edge and a `produces` edge deal to the same side.

**Revealing calls the relax, and the relax is `question-composer.html`'s.** That page is the one that already grows a graph a click at a time, and its `step` is ported here as `buildStep`: repulsion, a LINK SPRING at a rest length, a firm pull to the hop column, a soft pull to the fan row, heavy friction. The map's own step is overlap resolution over targets a layout pass has already spread across a grid; run over a grown graph it dealt cards on top of their own arrivals. The spring is what the map does not have and what holds a fan open — without it the column pull and repulsion alone read as a jumble.

Two departures from the composer, both because these cards are not one size. The **separation is the map's box test on the axis of least overlap**, not the composer's radius cushion: a cushion drawn on the diagonal holds tall cards apart sideways at a distance only their corners reach. And the **spring's rest length clears both boxes** — at a flat 420 a specimen with a ribbon in it settled sitting on both of its rank-1 neighbours, the spring balancing the push.

**Overlap is a constraint, not a force.** As a force it needs alpha to still be worth something, so it either loses the race with the decay — measured from a collapsed pile, seven pairs still overlapping and nothing left to move them — or it is held alive against the decay and then fights the spring in a limit cycle the reader sees as JITTER. It is projected straight onto the positions after the integration instead: it resolves in a frame or two, cannot oscillate, and the last frame to run is overlap-free. The displacement is counted into `moved` so the loop cannot call itself settled with a separation still pending. Measured: opening Build and expanding a card both reach zero overlaps, and the graph comes to rest in ~500 frames with 0.2px of drift after.

**A card arrives at its seat.** `reveal` sets x to the target the way the composer's `show` does; flying a card in from whatever revealed it means every arrival starts inside a pile, and the first thing the reader sees is the shove that separates it. The fan is dealt off the parent's CURRENT position, bowed (the ends pulled 70px left of the middle), and stepped by each card's own measured height, since these range from a two-line question to a specimen with a picture in it.

**A hop is not a column.** Every fan reaching the same distance put twelve cards in a 180px band and the hop read as a wall. Three things spread it, all deterministic so the graph is the same every session: the BOW (a fan's ends set back 160px from its middle), the RANK (each step off the spine pushes a card another 0.55 of a hop out, so how far right it sits says how well it is attached), and a per-card drift hashed from the id, which is the only one of the three that separates five rank-1 siblings from each other.

**The drift widens with depth** — half a hop's width at the first fan, a whole one at the second, since the first fan is read against the card that opened it and wants to stay tidy beside it, while a second hop is five fans landing at the same distance. Running off the screen is the right trade: the reader came here by clicking and can pan. `BUILD_COL` is 820 and the spring's rest length 620; measured, the two-hop opening puts hop 1 across 119px and hop 2 across 823.

**The camera reads the settled graph, not the targets.** `enterBuild` runs the relax to rest before `buildCamera` measures the extents, or the fit frames targets the relax then walks out of the shot.

**Switching modes costs the reader nothing.** `enterBuild` saves every node's baked x/y/tx/ty/pinned/lit and `leaveBuild` puts them back, so Map returns exactly as it was left, cards and camera included. `light()` refuses anything not in `built`, or focusing a question mounts a WebGL context for a card nobody can see; `focus()` skips the pills, the query and the graft for the same reason. The walk is refused outright.

**The seed is `q-machine` and it is a testing default**, not a claim about where the curriculum starts.

## What must pass before you commit

Run these in the console. Every one has caught a real bug.

* **No ordering cycle.** `ordered()` on every edge, compare `layerOf`.
* **No walk loop.** Hold → from all nodes; none may revisit.
* **Nothing stranded** — no node with zero `l.spine` edges.
* **Every concept reaches a question** within \~6 hops.
* **No hairball** over 8 rank-1 edges except `hbond`.
* **Placements resolve** — no content id or node id that does not exist.
* **Claims are not clipped** — `scrollHeight > clientHeight` on `.claim`. About 95 characters on a normal card, 130 on a hub. **Allow 2px**: every card reports a scrollHeight a line-height rounding over its clientHeight, so a bare `>` calls eight healthy cards clipped. A real clip is a whole line.
* **Every evidence card opens** — deal each `EVIDENCE` fan and check the claims, since nothing on the laid-out map will show you a clipped one.

## Content: inline or its own card

`graphcontent.js` splits two ways in `nodegraph.html`. **INLINE** rides the node — a molbox, a water sim, a builder, a ribbon, and a LESSON — and lands in the card's thumb. **CARD** spawns its own node, which today is only a film, somebody else's object hanging off the concept it illustrates.

A lesson is inline because it arrives as a **screenshot** (`shot:`, required), not a live box, so it cannot compete with a running sim for the thumb — which is what put lessons on their own cards in the first place, back when glycolysis carried both. Where a concept holds both, **the lesson wins the thumb**: the tie-break is explicit in the sort, because rank alone leaves the card's face depending on source order. Under it goes `.opener.primary`, the map's one filled pill, in the concept's own region tint. It is the only way into the lesson now, so it does not fade with the card's other controls.

One lesson can be **several doors**: `l:krebs`/`l:pyrox` are both krebs-lab, and `l:membrane`/`l:osmosis` are both membrane-lab, differing in `shot` and in a `?step=` on the href. A second row is what buys the right picture and the right entry point, since a card shows one screenshot and links one place.

**`?step=N` is 1-based over the lesson's own `STEPS`,** in krebs-lab and membrane-lab alike, clamped so a bad number opens the last step rather than an empty stage. Adding a door to a lesson that has no such parameter means adding one there first — it is four lines and additive, and the no-parameter default must stay exactly what it was.

**A question can host a lesson.** Where a lesson is a whole unit rather than one claim — water-lab is — no concept card is the right host, and hanging it on one would say the lesson is about that one claim. The anchoring question is the unit's door, so `l:water` sits on `q-medium` and `l:builder` on `q-bond`.

**`q-bond` was authored to be that door.** The chemistry floor — electronegativity, the covalent bond, polarity, the ionic bond — was the one stretch of the map with no question pointing at it, and molecule-builder is the lesson that IS that floor: nine molecules, a third of them ionic, so it is valence and geometry and charge rather than any one claim. **A `Molecular Bonding` card was the other candidate and was refused**: no rank-1 path would route through it that does not already reach `covalent`, so its whole claim would have been the fan it names — `pigment`'s rule, one section up. The question keeps its own shape and gains the same two things a concept card gains, a thumb and the pill, plus a `haslesson` class that brings the 2rem type down to card scale.

**Every lesson card is lit at load**, not fogged — they are the featured work, so a reader who never explores still sees every one. The opening camera does NOT frame them: they span three units and 10,000px, and fitting them needs k≈0.14, well under `centre()`'s 0.3 floor and unreadable. `start()` therefore collects the doors it lights into a list and passes THAT to `centre()`, so the opening view is unchanged and the lessons are simply already out of the fog for whoever pans.

A lesson thumb spends **no stage**: it is an `<img>` written straight in, and the pool of four stays for boxes that are actually running something. No `loading="lazy"` — inside a transformed `#world` the intersection never resolves and the image stays at zero width. The card being lit is the laziness.

## Highlight: the saved queries

One `<select>` in the masthead, three groups, all generated from the data so a new unit or theme cannot be forgotten there. **By unit** is the chapter — the same grouping the card's coloured dot already carries — and it lights the unit's nodes and frames their bounding box. **By weight** reads the map's own shape (carries / through / degree / bridge, and `all` as their union). **By theme** is a cross-unit query and behaves like clicking the theme card: light, focus, and a camera framing wide enough to reach the fan.

Choosing a mode CLOSES every open card outside the picks and releases its stage; cards inside stay open, and nothing is opened for the reader, because exploration is light and the menu is a reading rather than a click.

A question carries no `unit` and must not — a bridging one joins two by definition. So a unit's doors are derived: a question joins the unit its rank-1 answers are in, which puts an anchoring question in one unit and a bridging one in both.

Highlight lies over the fog. Marks respond, and so do EDGES: an edge with both ends in the picks draws as though both were lit, everything else falls below the fog. A group with its interior wiring dropped is a scatter of dots, and what a unit looks like is how it is wired. Focus outranks the whole overlay, so Escape drops back to the at-a-glance version rather than clearing it.

## Adding a unit

Questions first, then nodes, then edges, then the QA walk, then content. Do not attach material before the skeleton settles or you will stop restructuring.

Every unit doc has a **ranking caution**, and it is always the same failure: named molecules with diagram real estate outrank constraints that carry the explanation. Krebs intermediates over chemiosmosis, Calvin intermediates over photolysis, the replication enzyme roster over complementarity. The discriminating question is **how many rank-1 paths in this graph pass through this node** — not page count.

## Traps that ship looking fine

* A **class name collision** between a node's kind and a control's class. A lesson card was `.lesson` and so was the opener button, so the pointerdown guard swallowed every click on the card.
* Testing an opener with `element.click()`. It skips pointerdown and sails past the guard that is actually broken. **Use real clicks.**
* **`.node.card`-scoped rules, when the thing is not a card.** Every `.thumb` and `.opener` rule was written for cards; the first question to carry a lesson matched none of them, so the raw 1600px still laid out at natural size and the door came out 1142px tall. They are scoped to `.node` now.
* **Ties in the control-fade rule.** `.node:not(.hub) .opener` is three classes, and so is every rule trying to hold an opener visible — so the winner was whichever sat later in the file, and widening one selector silently blanked the film cards' play buttons. The fade now names its exceptions (`:not(.primary)`, `:not(.content)`) instead of being out-shouted.
* `loading="lazy"` on anything inside `#world`. The transform defeats the intersection test and the image silently never loads — `naturalWidth` is 0 while `complete` is false and nothing errors.
* Anything computed **before specimens and content cards push their links** is scoring a different graph. `n.big` still does.
* A node created after `focus()` has run needs `.lit` explicitly, or it sits at 18% and looks like a rendering bug.
* `rem` inside a mark. Marks counter-scale below k=1 and a `rem` child does not, so it renders at 5px on screen.
* The browser tool's console buffer does not clear on navigate. A fresh tab is the only trustworthy read.

## The ask bar / query feature — state and design

**Where it lives**: `demos/nodegraph/nodegraph.html` (bar, tiers, graft rendering), `api/find.js` (embed a query), `api/extend.js` (generate cards), `demos/tools/bake-graph-vectors.js` (corpus), `demos/nodegraph/graphdata-vectors.json` (259 rows). Rulebook: `demos/nodegraph/Nodegraph.md`.

**Enter walks tiers, in this order.** Each is deterministic and offline until the last two:

1. **A card named this, or the subject of its lesson** — `goToNamed`. Every term must land as a whole word (200/term in `score`). `membrane` reaches `selective-perm` via the lesson's *href stem*, which is why lesson text is searchable at name weight; blurbs are deliberately not, they sent `water` to the osmosis lesson.

2. **A question** — term-matched, not substring, so `tree mass` finds *Where does the mass of a tree come from?* The card it answers into counts at a fifth weight.

3. **A graft you already own** — `nearestMine`, loose matching on content words (≥2 shared, ≥⅔ of the shorter side). Function words are stripped or "how does a cell make energy" and "how does a cell divide" collide.

4. **Keyword search over claims and kinds** — `goToMatch`. A kinds hit opens the card and deals the fan.

5. **Semantic guess** — `/api/find` + cosine against baked vectors, ranked by **z within row kind**, `Z_FLOOR = 3.5`. Labelled "closest match", never presented as a lookup.

6. **The offer** — "That's a new question." + Extend the map pill.

**Why z and not cosine**: measured, `asdfgh` scores 0.839 against its best claim and a correct hit scores 0.855. Questions sit systematically higher than claims (same register), which is why `kind` is on every row. Even z doesn't separate cleanly — `my cat is hungry` hits 3.27 — so 3.5 is set where a hit is *confident*, on the principle that a wrong jump costs more than a miss. It refuses fish→photosynthesis (3.22) and costs sunscreen (2.72), which was right. The numbers are in the comment.

**Grafts** (`api/extend.js`): generated cards arrive as **satellites** — pinned, outside the layout pass. That's the whole safety argument, and it's measured: a graft drifts the skeleton 529.4px vs 529.4px for opening the same two cards with no graft. They cannot move a laid-out card, close a cycle, or spend a rank-1 budget. Rank 2/3 only; `part-of`/`contains`/`instance-of`are out of the grammar; ids validated at the endpoint *and* against `byId`; unresolvable edges dropped, never repaired. The model gets the **whole index**, not just the retrieval — given only the vector candidates it wired gills to Aquatic overwintering.

**Persistence**: grafts go to `localStorage` under the question text; the question becomes a door in the dropdown in its host's unit. Restoring costs 0 API calls. Hosts renamed since are skipped at load. All accessors wrapped.

**Uncommitted: nothing. Unverified: the URL feature.** `?node=`, `?node=&kind=`, `?ask=`, `?q=`, plus the link button, are written and parse, but I never got them into a browser — my test server died and navigation was declined. **Nobody has confirmed a single one of those URLs works.** That's the first thing to test.

**Traps for the next agent**: the browser pane's console serves stale messages across reloads (I chased a phantom `RUBISCO_VARIANTS` error), `innerWidth` reads 0 when the pane collapses (it silently breaks any centring maths), and `document.hidden` throttles rAF so the camera crawls — drive `step()/draw()/followStep()` by hand.
