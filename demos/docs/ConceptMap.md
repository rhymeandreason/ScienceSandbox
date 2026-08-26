<!-- KIND: rulebook, scoped — load before touching kit/card-stage.js, kit/molbox.js, molecule-builder/molecule-builder.js as a mounted box, or either card page (tests/door-map.html, tests/cards-cluster.html). The invariants section is the load-bearing half and every item in it is a failure that ships looking fine. Nothing here applies to a lesson that draws one stage of its own. -->

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

## **Card kinds**

| KIND | MODULE | PAGES |
| --- | --- | --- |
| `water` | card-stage + `water/watersim.js` | door-map, cards-cluster |
| `build` | `molecule-builder.js` (ortho, own context) | door-map, cards-cluster |
| `molbox` | `kit/molbox.js` | cards-cluster, membrane-lab |

Small molecules go to the builder (flat view draws the electrons); molecules with no recipe go to molbox. Builder and molbox are ortho.

## **Gotchas for a cold session**

* **The browser probe tab is hidden**, so `requestAnimationFrame`, `ResizeObserver` and `IntersectionObserver` delivery never fire. Drive `box.pump(dt)` and the page's own `step()` directly. `pump()` exists for this.

* **Screenshots with 4 live contexts come back blank** in the probe tab — the compositor does not pick up four WebGL layers. Verify with `readPixels` or `snapshot()` instead, and ask the human to look in Safari.

* Checkers: `node tools/check-pages.js`, `tools/check-docs.js`, `kit/check-kit.js`, `molecule-builder/check-molecule-builder.js`, `check-molecules.js` (slow, \~2min). The pre-commit hook gates each; silence means it ran and passed.

* `check-docs.js` treats any backticked path as a claim the file exists — write a former filename in italics, not in backticks. This doc broke that rule twice on its first commit and the checker caught both.

## **Considered**

1. **NOT recommended: a card-view registry.** I proposed it, then measured: after deleting `mol`, `build` and `molbox` are one-line calls and only the \~12 lines of WaterSim seeding are duplicated. That is a vocabulary, not an implementation (Modules.md's own test). If it bothers you, the honest home is a `WaterSim.scene(root, {waters, salt})` helper in the module that owns the physics.
