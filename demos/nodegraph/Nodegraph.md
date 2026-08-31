<!-- KIND: rulebook. Load whole before touching graphdata.js, graphcontent.js
     or nodegraph.html. Biology-Node-Graph.md is the conceptual truth for what
     the graph is FOR; this is how it is built and what breaks it. -->

# Working on the node graph

Three files. **`graphdata.js` is the skeleton** — nodes and typed, ranked
edges, and nothing that draws. **`graphcontent.js` is the material** attached
to it, separate because the two evolve at different speeds. **`nodegraph.html`
is the page**, and it holds no curriculum.

Content is **re-declared here, never shared with `lib/mapcontent.js`** — the
questions-composer is being deprecated and the nodegraph is not inheriting a
dependency on it. Copying a curated row is the accepted cost.

## The two axes are semantic

**X is explanatory order**, computed from the edge types. **Y is the scale
ladder**, from each node's `level`. So `part-of` edges run vertically and
causal edges horizontally, and reading direction is explanation direction.

## Edge grammar

Every edge type is in exactly one of four groups, declared in `nodegraph.html`:

* **FORWARD** — `prerequisite-of` `causes` `determines` `enables` `produces`
  `alters` `transforms-into` `evidence-for` `part-of` `contains`
  `contributes-to` `lowers` `precedes` `necessitates`. Source sits left.
* **BACKWARD** — `consumes` `destroys` `explained-by` `instance-of`
  `illustrates`. Target sits left; an instance comes after its class.
* **LATERAL** — `contrasts-with` `analogous-to`. Beside the reading: no order,
  no arrowhead, contrast colour, never a walk step. One holds two things
  apart, the other says they are the same move in different systems.
* **Ordering nothing** — `describes` `answers` `preserves` `spends` `supplies`.

**Containment is two relations pointing opposite ways.** `part-of` BUILDS, so
the part reads first (amino acids make a primary structure). `contains` ZOOMS
IN, so the whole reads first (you meet the enzyme, then look inside for the
pocket). One type for both put the entire enzyme subtree six columns left of
the enzyme.

### A resource claim is not an explanatory order

The map has learned this three times: fermentation recycling NAD⁺, active
transport spending ATP, and the Calvin cycle handing sugar to glycolysis. Each
was typed as `enables` or `produces` and each closed a cycle — the last one
made **every node on the map** circular.

Biology's resources genuinely go round in loops and the explanation axis is a
DAG. `spends` and `supplies` exist so an edge can say "this makes the stuff
that one over there uses" without also claiming which is read first.

**A cycle is always a data bug.** The page warns; the check below catches it.

## Node types

| type | what it is | walkable? |
| --- | --- | --- |
| `concept` `structure` `process` | the skeleton | yes |
| `question` | a door. `qtype` is `anchor` (opens a unit, large), `bridging` (joins two already open, small) or `extension` (small, italic, blue) | via `answers` |
| `theme` | a saved query over the map. Its fan is dealt whole regardless of rank | no |
| `evidence` | how we know. Meselson–Stahl, Hershey–Chase | no |
| `specimen` | spawned from `proteins/proteins.js` by a `p:` placement | no |
| `content` | a film, spawned from `graphcontent.js`. A LESSON IS NOT ONE: it rides its concept | no |
| `ask` / `satellite` | the kinds pill and what it reveals | no |

Everything after the first row is a **destination, not a station**: `station()`
excludes them so the walk never steps onto one. Adding a type means adding it
there too.

## Rank, and the spine flag

`1` is the spine, `2` enrichment, `3` surfaced on request. Soft budget of about
**five rank-1 edges per node**; past ~8 is a hairball wanting a hinge node.
`hbond` is the sanctioned exception.

**Rank is authored and never rewritten.** Reachability is a separate field,
`l.spine` — rank 1 plus each node's own best edge — so a node whose best edge
is rank 2 is still reachable without falsifying the rank that draws it, orders
the walk and sizes hubs. Promoting rank in place is
what once erased the map's only rank-3 edge.

**A theme's rank is read from the instance's side only** — `p:prion instance-of
folding` rank 1 says prion is the best thing we hold for folding, not that
folding's next word is prion.

## Placement, computed once at load

No randomness, same map every session, so spatial memory can form.

**X:**

1. Longest-path layering over the ordering constraints.
2. **Pull-right**: a node with no upstream constraint is pulled to one column
   before its first *independently anchored* consequence.
3. **Median tightening**: a node with slack moves to the median of its rank-1
   neighbours, clamped to its own legal range. Longest-path puts everything as
   far LEFT as constraints allow, which is wrong for a node merely *mentioned*
   early — glucose sat nine columns from the glycolysis that consumes it.
   Rank 1 is what makes it safe: a node with one late consumer and two early
   causes stays early.
4. Authored `nudge` last. Nothing uses it now.
5. Layer × 430px.

**Y:** levels 1–10 become bands, ecosystem at top, unoccupied bands stay thin.
Then every node settles at the **median of its rank-1 neighbours**, with a
levelled one clamped back into its own band. The ladder says which rung, the
edges say where along it. Without this a membrane protein sat below the
tertiary structure it is an instance of.

**Questions** anchor 0.7 columns left of their rank-1 answer.

**Then the relax, which only resolves overlap**: x pinned to the column (0.12),
y pulled to the median (questions 0.07, levelled 0.09, levelless 0.06),
repulsion, a weak y-alignment along edges, deterministic jitter. No spring
invents a position. Dragging pins a card out of it.

## Extension questions, and the ask bar

**An extension question is not on the map.** It is a query, and a query has no
seat: it arrives at whatever it asked about and leaves with it. `graphdata.js`
authors it like any other question, and the page pulls it out **before layout**
(`QUERIES`), keeping only `anchorId`. Leaving them in cost nothing visible and
moved every neighbour they repelled. The degree they added is given back, or
the card they answer reads one link heavier than it is.

**Its answer is inside its target's `kinds`, and it names which**, in `kind`,
matched on the kinds name. Asking one opens the card, deals the fan, and spawns
the question as a satellite of the member that answers it. The pill stays in
the chain: a reader who arrived by query and one who clicked "what kinds are
there?" are looking at the same thing, and a second way of drawing it would say
they are not.

Being a satellite is what makes it free: it rides its target, is skipped by the
relax, and pushes nothing. `dropQuery` runs from `collapseKinds`, so the fan
and the question that opened it leave together.

It is styled as a different ACT, not a smaller one: italic, and a blue no unit
owns. Hover and focus both repaint a question in ink, so the colour is restated
after those rules or they win.

**The bar is the only way to reach one**, bottom centre. It holds every
question, not only the deferred ones — asking an anchor or bridging question
focuses the card it already has. The placeholder rotates through them, so the
bar shows what it accepts rather than describing it; Enter on an empty field
takes the offer, typing filters, ArrowDown opens the list grouped by unit.
A query arrives from wherever the reader was, which may be the whole map at
0.30, so `follow` carries a zoom and centres the CHAIN rather than the question
— following either end puts the rest against a screen edge.

**Not built yet**: the fuzzy match onto a typed question (Gemini), and the same
field as a keyword search over the cards. Until then a typed miss reddens the
bar rather than failing silently.

### The test for tagging one

`kind` is what enforces it. *Why does sunburn cause mutations?* lands on
`mutagen`'s Ultraviolet. *Why does eating fat give more energy than eating
sugar?* was tagged extension and had to be given back: `fatty-acid`'s own claim
already says the tail is the energy, and saturated / unsaturated / trans is a
different question. **If no member is THE answer, the question is not an
extension.**

## Kinds: detail that failed the node test

**Reusable concepts get nodes. Facts about one thing get cards.** A `kinds`
array on a node is the enumeration that fails that test — UV and benzene route
nowhere and nobody arrives at one alone.

**Only where the members are NOT already nodes.** `organelle` gets no pill
because nucleus, ribosome, mitochondrion, chloroplast and cell wall are already
cards hanging off it; a fan would add leftovers and leave a reader asking why
five members are cards and five are not. Where the members *are* nodes, the
chips already lead there and going deeper wants a lesson.

The chain is **card → pill → kinds**. The pill is a node because as a chip it
read as one more navigation control and what it does is not navigation. It
grows on focus and goes when focus leaves that card's family.

**None of it is baked**, and that is deliberate. A satellite is a leaf with one
edge to one parent: its position says nothing beyond "below this card", and
nobody remembers the seat of something they have never seen. They are pinned,
skipped by the relax's repulsion and link pull, and ride their host — so
opening one moves nothing else on the map. Measured: **0.0px** of skeleton
drift.

## What must pass before you commit

Run these in the console. Every one has caught a real bug.

* **No ordering cycle.** `ordered()` on every edge, compare `layerOf`.
* **No walk loop.** Hold → from all nodes; none may revisit.
* **Nothing stranded** — no node with zero `l.spine` edges.
* **Every concept reaches a question** within ~6 hops.
* **No hairball** over 8 rank-1 edges except `hbond`.
* **Placements resolve** — no content id or node id that does not exist.
* **Claims are not clipped** — `scrollHeight > clientHeight` on `.claim`.
  About 95 characters on a normal card, 130 on a hub.

## Content: inline or its own card

`graphcontent.js` splits two ways in `nodegraph.html`. **INLINE** rides the
node — a molbox, a water sim, a builder, a ribbon, and a LESSON — and lands in
the card's thumb. **CARD** spawns its own node, which today is only a film,
somebody else's object hanging off the concept it illustrates.

A lesson is inline because it arrives as a **screenshot** (`shot:`, required),
not a live box, so it cannot compete with a running sim for the thumb — which
is what put lessons on their own cards in the first place, back when
glycolysis carried both. Where a concept holds both, **the lesson wins the
thumb**: the tie-break is explicit in the sort, because rank alone leaves the
card's face depending on source order. Under it goes `.opener.primary`, the
map's one filled pill, in the concept's own region tint. It is the only way
into the lesson now, so it does not fade with the card's other controls.

One lesson can be **several doors**: `l:krebs`/`l:pyrox` are both krebs-lab,
and `l:membrane`/`l:osmosis` are both membrane-lab, differing in `shot` and in
a `?step=` on the href. A second row is what buys the right picture and the
right entry point, since a card shows one screenshot and links one place.

**`?step=N` is 1-based over the lesson's own `STEPS`,** in krebs-lab and
membrane-lab alike, clamped so a bad number opens the last step rather than an
empty stage. Adding a door to a lesson that has no such parameter means adding
one there first — it is four lines and additive, and the no-parameter default
must stay exactly what it was.

**A question can host a lesson.** Where a lesson is a whole unit rather than
one claim — water-lab is — no concept card is the right host, and hanging it
on one would say the lesson is about that one claim. The anchoring question is
the unit's door, so `l:water` sits on `q-medium`. The question keeps its own
shape and gains the same two things a concept card gains, a thumb and the pill,
plus a `haslesson` class that brings the 2rem type down to card scale.

**Every lesson card is lit at load**, not fogged — they are the featured work,
so a reader who never explores still sees all seven. The opening camera does
NOT frame them: they span three units and 10,000px, and fitting them needs
k≈0.14, well under `centre()`'s 0.3 floor and unreadable. `start()` therefore
collects the doors it lights into a list and passes THAT to `centre()`, so the
opening view is unchanged and the lessons are simply already out of the fog
for whoever pans.

A lesson thumb spends **no stage**: it is an `<img>` written straight in, and
the pool of four stays for boxes that are actually running something. No
`loading="lazy"` — inside a transformed `#world` the intersection never
resolves and the image stays at zero width. The card being lit is the laziness.

## Highlight: the saved queries

One `<select>` in the masthead, three groups, all generated from the data so a
new unit or theme cannot be forgotten there. **By unit** is the chapter — the
same grouping the card's coloured dot already carries — and it lights the
unit's nodes and frames their bounding box. **By weight** reads the map's own
shape (carries / through / degree / bridge, and `all` as their union). **By
theme** is a cross-unit query and behaves like clicking the theme card: light,
focus, and a camera framing wide enough to reach the fan.

Choosing a mode CLOSES every open card outside the picks and releases its
stage; cards inside stay open, and nothing is opened for the reader, because
exploration is light and the menu is a reading rather than a click.

A question carries no `unit` and must not — a bridging one joins two by
definition. So a unit's doors are derived: a question joins the unit its
rank-1 answers are in, which puts an anchoring question in one unit and a
bridging one in both.

Highlight lies over the fog. Marks respond, and so do EDGES: an edge with
both ends in the picks draws as though both were lit, everything else falls
below the fog. A group with its interior wiring dropped is a scatter of dots,
and what a unit looks like is how it is wired. Focus outranks the whole
overlay, so Escape drops back to the at-a-glance version rather than clearing
it.

## Adding a unit

Questions first, then nodes, then edges, then the QA walk, then content. Do not
attach material before the skeleton settles or you will stop restructuring.

Every unit doc has a **ranking caution**, and it is always the same failure:
named molecules with diagram real estate outrank constraints that carry the
explanation. Krebs intermediates over chemiosmosis, Calvin intermediates over
photolysis, the replication enzyme roster over complementarity. The
discriminating question is **how many rank-1 paths in this graph pass through
this node** — not page count.

## Traps that ship looking fine

* A **class name collision** between a node's kind and a control's class. A
  lesson card was `.lesson` and so was the opener button, so the pointerdown
  guard swallowed every click on the card.
* Testing an opener with `element.click()`. It skips pointerdown and sails past
  the guard that is actually broken. **Use real clicks.**
* **`.node.card`-scoped rules, when the thing is not a card.** Every `.thumb`
  and `.opener` rule was written for cards; the first question to carry a
  lesson matched none of them, so the raw 1600px still laid out at natural
  size and the door came out 1142px tall. They are scoped to `.node` now.
* **Ties in the control-fade rule.** `.node:not(.hub) .opener` is three
  classes, and so is every rule trying to hold an opener visible — so the
  winner was whichever sat later in the file, and widening one selector
  silently blanked the film cards' play buttons. The fade now names its
  exceptions (`:not(.primary)`, `:not(.content)`) instead of being out-shouted.
* `loading="lazy"` on anything inside `#world`. The transform defeats the
  intersection test and the image silently never loads — `naturalWidth` is 0
  while `complete` is false and nothing errors.
* Anything computed **before specimens and content cards push their links** is
  scoring a different graph. `n.big` still does.
* A node created after `focus()` has run needs `.lit` explicitly, or it sits at
  18% and looks like a rendering bug.
* `rem` inside a mark. Marks counter-scale below k=1 and a `rem` child does not,
  so it renders at 5px on screen.
* The browser tool's console buffer does not clear on navigate. A fresh tab is
  the only trustworthy read.
