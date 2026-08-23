<!-- KIND: recipe — load when a lesson needs the timeline, the highlight vocabulary, lanes, or camera fit against pixel chrome. -->

# `kit/` — the layer between `scene.js` and a lesson

`scene.js` owns primitives (atom, bond, buildMolecule, measure, frame) and is
deliberately ignorant of any lesson's physics. A lesson owns its mechanic.
Between those two there was nothing, so every page built the same four things
again — and the fourth one, camera fit against pixel chrome, cost glycolysis
five functions.

That gap is what these files are. They own **no lesson state, no physics, and
no chemistry beyond what a spec already says.** SCIENCE.md §6's test still
applies: if two pages would write it identically, it belongs here; if the
second page would want it *slightly* different, it does not.

| File | Owns | Checked by |
| --- | --- | --- |
| `motion.js` | **two clocks, on purpose.** Interpolation rides the render loop (`dt` in seconds, clamped); a `call` beat is a COMMIT and rides the wall clock too, so a step finishes in a hidden tab instead of leaving the lesson stuck `busy`. Named easings, `cancel(tag)` that clears both halves, `seek()` for scrub/screenshot. No THREE | `check-kit.js` |
| `molgraph.js` | questions you ask a **spec**: neighbours, terminal vs bridging, what leaves when a bond breaks, rings, functional groups found from connectivity, signed torsions. No THREE, no DOM, Node-loadable — so a checker and a page compute the same answer from the same code | `check-kit.js` |
| `hbond.js` | **the bond that is not a bond**, found the same way everywhere one is drawn — water, base pairs, secondary structure. Matching half is pure JS and Node-loadable; render half is pooled dashed tubes. Three gates: distance, D–H···A linearity, and — when `lobes/lobes.js` is loaded — a cone about a real lone pair, so an acceptor is not a sphere of stickiness. Capacity is COUNTED from those pairs, and a conjugated pair counts zero, which is what keeps adenine's amino group a donor. Owns no forces; water-lab's springs stay water-lab's | `check-kit.js`, `hbond-test.html` |
| `hotspot.js` | **click the bond this step is about.** A clickable, pulsing target pinned to a bond's projected midpoint on each object, driven every frame, elements reused. The page says which bond, what the hint reads and what a click does | the human, `glycolysis-lab` |
| `lanes.js` | molecules side by side, named, that **split and swap** — the shape every pathway lesson has. Per-species centring (both axes), one shared label baseline, DOM names projected onto their molecules every frame, abbreviate-then-shrink decided for all lanes at once, positions as targets so a swap frame moves nothing | the human, `glycolysis-lab` |
| `fit.js` | the stage is not an empty rectangle. Chrome measured in **pixels** by the page → leftover fractions, a solved distance and target, a top anchor, and (for an ortho page) a frustum built from `cam.r` so that number keeps meaning. Extracted from glycolysis-lab, which had it right and paid five functions for it | the human, bit-identical fit values before/after the extraction |
| `focus.js` | one vocabulary for "look here": ghost at 13% without depth-write, lit atoms emitting their **own** colour, a bond lit only when both ends are. Works on a built molecule (by atom index) or on whole objects against each other | the human, `kit-test.html` |
| `stagekit.js` | the shell: `Stage.create` + render loop (dt in **seconds**) + ResizeObserver + FX/Motion/Focus wiring + `fit()`, which converts **pixels of chrome** into the world-space bands `Stage.frame` wants. Two hooks: `frame` before the render, `afterFrame` after it — anything pinning DOM to a 3D point belongs in the second | the human, `kit-test.html` |
| `carriers.js` | **one object with two states, standing in a column.** ATP/ADP by the transferring phosphoryl, NADH/NAD⁺ by the hydride on C4 — and the same shape for FAD, GDP/GTP, CoA, or a conjugate acid and its base. Owns n instances of one spec laid into DOM slots, the group's visibility, the `keep` set a page's optional-H policy would otherwise hide (it is exactly what distinguishes the states), the fit-down-never-up into each slot, whether each sits centred or left-aligned in it (`align`), and a per-instance entrance. The page keeps which molecule, which atoms, and when a step has run | the human, `glycolysis-lab` |
| `enzyme-blob.js` | **the catalyst behind the substrate** — a translucent blob on the molecule a step acts on, with no structure drawn, because at this scale a drawn protein would be wrong about fold, size and active site alike. Owns the elements, the measurement and the placement; the page hands it GROUPS and keeps every chemical question (which molecule, how many blobs, what the enzyme is called), so this never learns what a lane is. Measures in the camera's basis off atom surfaces as a circumscribing circle, **live every frame** — the four ways that goes wrong are in its header, and each one shipped. `pin` is the single hold, and the caller takes it, because only the lesson knows the beat where one enzyme is beginning to hold two molecules or let go of two. Ships with `enzyme-blob.css`: its JS depends on the corner placement and on the sway riding a wrapper rather than the `<svg>` | the human, `check-kit.js` (the circle), `glycolysis-lab`, `krebs-lab` |
| `leaving.js` | **a piece of a molecule leaves, travels, and is gone** — the event every reaction lesson animates. Sheds atoms *with their bonds* and puts them back (`unshed`, for an atom drawn only once it arrives), builds the travelling fragment from the spec's own geometry, keeps one registry of what is in the air so a cancel can sweep it, removes on a wall-clock beat (not the tween's last frame), assembles a product out of the pieces that left (atoms converge, bonds only after), and solves *offstage* off the camera — a screen edge, never a world height, with more clearance for a departure than an arrival. The page keeps the chemistry: which atoms, what colour, where to | the human, `glycolysis-lab` |
| `inset.js` | **one molecule in a box, over a scene at another scale.** The framed close-up a figure uses when the stage draws the same object schematically — membrane-lab's bilayer is instanced cylinders, which says nothing about what a lipid IS. Owns its own renderer, a camera solved from the molecule's extent, an optional turntable that moves the CAMERA (so a spec's `view:` is still what the box opens on and the group's rotation stays identity), and an IntersectionObserver that stops the loop when nobody is looking. `afterFrame` runs after the render — same name and rule as `stagekit.js`, and the only place a page can step a callout, since the loop is the module's. `view` is the element whose box IS the canvas's: annotate.js divides by its `clientHeight`, so projecting into the FRAME instead skews every dot by the caption row, and the constructor measures the two and warns. `leader:{host,at}` is the other half of the frame: a framed box says "this is a window", only the leader says which thing it is a window ONTO — two lines from the frame's silhouette corners to a ringed point, with the page supplying the projection because the scene's camera is the page's. One context, reused via `show()`; `destroy()` releases it. The frame lives in `main.css`'s `.inset` and is not decoration — unframed, a magnified molecule reads as an object standing in the scene at that size | the human, `membrane-lab` |
| `modal.js` | **the card that covers the lesson** — the side doors every lesson grows. Opening, closing, the focus the four hand-written copies never gave back, the trap `aria-modal` already promised, and one Esc across a shared stack so the topmost closes. `anyOpen()` is what a page guards its stage keys on. Markup and content stay the page's | the human, `glycolysis-lab` |
| `check-kit.js` | the assertions behind the offline modules. `node kit/check-kit.js` | — |
| `kit-test.html` | bench for motion/focus/stagekit, with no lesson around them | — |
| `hbond-test.html` | bench for `hbond.js`: two sliders that break the bond **without changing the distance**, and adenine's donor/acceptor asymmetry printed from the module's own site lists | — |

## Load order

After `scene.js` (and `fx.js` if the page fires effects):

```html
<script src="scene.js"></script>
<script src="fx.js"></script>
<script src="kit/motion.js"></script>     <!-- no dependencies -->
<script src="kit/molgraph.js"></script>   <!-- no dependencies -->
<script src="kit/fit.js"></script>        <!-- if the page has chrome over the canvas -->
<script src="kit/lanes.js"></script>      <!-- if molecules stand side by side and swap -->
<script src="kit/hotspot.js"></script>    <!-- if the student clicks the chemistry itself -->
<script src="kit/leaving.js"></script>    <!-- if something detaches and travels -->
<script src="kit/carriers.js"></script>   <!-- if a molecule has a charged and a discharged state -->
<script src="kit/enzyme-blob.js"></script>     <!-- if a step has a catalyst to show; needs kit/enzyme-blob.css -->
<script src="lobes/lobes.js"></script>    <!-- optional, and hbond is more honest with it -->
<script src="kit/hbond.js"></script>      <!-- after lobes, if it is loaded at all -->
<script src="kit/modal.js"></script>      <!-- if the lesson has side doors; no deps -->
<script src="kit/inset.js"></script>      <!-- if a molecule needs a close-up box; after scene.js -->
<script src="kit/focus.js"></script>      <!-- after scene.js -->
<script src="kit/stagekit.js"></script>   <!-- last: it wires the other three -->
```

`Lesson.create` uses whichever of `FX` / `Motion` / `Focus` is present and hands
them back on the object, so a page loads the ones it wants and gets `null` for
the rest.

## Things that are easy to get wrong

* **`dt` is seconds, and it is clamped at 0.1.** A per-frame increment (`+=0.0022`)
  runs a third faster on a 120 Hz display; that is why every rate here is per
  second.
* **A `call` beat fires whether or not anyone is watching**, and fast-forwards
  the timeline when it does. That is glycolysis-lab's rule, and it is the right
  one: pixels are owed to a visible tab, but a step that leaves `busy` stuck
  true in a hidden one is unrecoverable without a reload. `commit:false` opts a
  cosmetic call out.
* **Cancel does not complete.** `motion.cancel()` freezes values where they are.
  Snapping to the end pose is how a rewind lands on the state it was rewinding
  away from. If a page wants the end pose, it sets it.
* **`seek()` does not fire `call` beats.** They are side effects; a scrub that
  re-spawns four rings is worse than one that spawns none. Re-run the step.
* **A jump re-derives state; it never mutates it.** Every reading a lesson shows
  — ledger, pools, tray, rail, caption — should be a function of "how many steps
  have run", so moving that number and redrawing lands on a state that is real
  rather than staged. It is why glycolysis's `?step=9` opens on a true tally
  instead of a mock, and why rewinding does not have to remember what it undid.
  The corollary is the part that bites: anything you *cannot* re-derive — a
  half-run step's per-lane set, a mid-flight flag — has to be cleared explicitly
  on every jump, or it leaks into the state you jumped to.
  **This is also why there is no sequence module.** That number is the lesson's
  own state, kit owns none, and the second pathway will want it a different
  shape anyway — a cycle that turns twice is not an index that counts to ten.
* **The fit is iterative on purpose.** A perspective fit against a pixel band is
  circular — the band's world size depends on the distance, which depends on the
  band. One pass under-reserves and the caption lands on the molecule.
* **A lane's molecule does not sit at `xOf(i,n)`.** It sits at `origin(key,i,n)`,
  which subtracts that species' own off-centredness. Every flight target and
  world anchor must use `origin`, or a group lands beside the atom it was
  aiming at.
* **A hotspot the module could not derive is not drawn.** `pair: null` means no
  target — never one at the origin, which is a clickable spot floating in the
  middle of the scene, and being clickable, the student finds it. `leavingBond`
  returns null for the same reason.
* **Never rebuild a pulsing element.** Recreating the node each frame restarts
  its CSS animation 60 times a second, which renders as a dead ring. Hotspot
  reuses its buttons and hides the spares.
* **The module owns the lane list.** A page that spawns lanes itself and assigns
  them to its own array gets molecules with no labels and no settle — `draw()`
  has nothing to label and `step()` nothing to ease. The split is a `render()`
  with a `place` hook for exactly this reason.
* **`afterFrame`, not `frame`, for anything that projects.** `Vector3.project()`
  reads a matrix refreshed only on render, so a species label positioned in the
  `frame` hook is pinned to the previous frame's camera. Invisible at rest,
  obvious during a zoom.
* **There are two fits, and they answer different questions.** `Lesson.fit`
  is *"here are my boxes, frame them"* — the common case, `Stage.frame` with
  pixel reserves converted for you. `Fit` is *"I measure my own extents; give me
  the chrome arithmetic"* — glycolysis measures LANE LAYOUTS, not bounding
  boxes, because mid-split the halves are still easing apart and a live bbox
  fits the stacked pair. A page uses one or the other, and the shell is worth
  having either way.
* **`boxes` and `reservePx` are functions.** They are re-asked on every resize,
  so the fit is solved against what is on stage now, not what was there at load.
* **`molgraph` answers in the spec's own units.** A registered spec is already in
  display units (`register()` applied `SCALE`); a raw `mol-*.js` spec on disk is
  in ångströms. Distances out follow whatever went in.
* **A `groups` list in a spec and `findGroups()` are different things.** The list
  is curated and captioned — the ones a lesson names. `findGroups` is every
  instance, derived. Use the list for text, the finder for counting.
