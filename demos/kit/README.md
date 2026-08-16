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
| `focus.js` | one vocabulary for "look here": ghost at 13% without depth-write, lit atoms emitting their **own** colour, a bond lit only when both ends are. Works on a built molecule (by atom index) or on whole objects against each other | the human, `kit-test.html` |
| `stagekit.js` | the shell: `Stage.create` + render loop (dt in **seconds**) + ResizeObserver + FX/Motion/Focus wiring + `fit()`, which converts **pixels of chrome** into the world-space bands `Stage.frame` wants. Two hooks: `frame` before the render, `afterFrame` after it — anything pinning DOM to a 3D point belongs in the second | the human, `kit-test.html` |
| `check-kit.js` | the assertions behind the two offline modules. `node kit/check-kit.js` | — |
| `kit-test.html` | bench for the two visual ones, with no lesson around them | — |

## Load order

After `scene.js` (and `fx.js` if the page fires effects):

```html
<script src="scene.js"></script>
<script src="fx.js"></script>
<script src="kit/motion.js"></script>     <!-- no dependencies -->
<script src="kit/molgraph.js"></script>   <!-- no dependencies -->
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
* **The fit is iterative on purpose.** A perspective fit against a pixel band is
  circular — the band's world size depends on the distance, which depends on the
  band. One pass under-reserves and the caption lands on the molecule.
* **`afterFrame`, not `frame`, for anything that projects.** `Vector3.project()`
  reads a matrix refreshed only on render, so a species label positioned in the
  `frame` hook is pinned to the previous frame's camera. Invisible at rest,
  obvious during a zoom.
* **A page does not have to hand its fit to the kit.** glycolysis-lab keeps its
  own — it measures lane LAYOUTS, not bounding boxes — and passes `onResize`
  instead. The shell is worth having even when only three of its four jobs fit.
* **`boxes` and `reservePx` are functions.** They are re-asked on every resize,
  so the fit is solved against what is on stage now, not what was there at load.
* **`molgraph` answers in the spec's own units.** A registered spec is already in
  display units (`register()` applied `SCALE`); a raw `mol-*.js` spec on disk is
  in ångströms. Distances out follow whatever went in.
* **A `groups` list in a spec and `findGroups()` are different things.** The list
  is curated and captioned — the ones a lesson names. `findGroups` is every
  instance, derived. Use the list for text, the finder for counting.
