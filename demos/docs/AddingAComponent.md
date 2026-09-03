<!-- KIND: recipe — load whole when building a component a generated app can mount: a cell, a tissue, an organism, a render of anything. Not for a lesson page, and not for a shared plumbing module (that is Modules.md's "Adding a module"). -->

# Adding a component

A component is a 3D scene a student's app can mount by name and drive by parameters, without writing Three.js. Four exist on the contract: `water/watersim-mount.js`, `membrane/membrane.js`, `leaf/leaf.js`, `tree/tree.js`, plus `Proteinbox.mount` in `kit/proteinbox.js`. Read one before starting. `leaf/leaf.js` is the smallest and the closest model for a render; `membrane/membrane.js` for anything with physics.

**The test of done is not that the bench looks right.** It is that `gemini-3.7-flash`, given only `docs/Components.md` and a one-sentence request, produces a working page that mounts your component. `tools/gen-app.js` runs exactly that. A component the model cannot use from the reference is not finished.

## 1. The contract

```js
const c = X.mount(el, params);   // builds its own canvas inside el and starts running
c.set({ ...params });            // any param, live; returns c
c.state();                       // a plain object; null before the first frame is acceptable
c.on('frame', (s, dt) => ...);   // every tick; returns an unsubscribe
c.start(); c.stop(); c.pump(dt); // pump is one step and one draw by hand, for tests
c.destroy();                     // gives the WebGL context back
c.sim; c.box;                    // the layers under it
```

Two layers, both exported:

- `X.create(THREE, root, camera, opts)` is the scene. It adds to a `root` it was handed, owns everything it adds, and knows nothing about canvases, loops or the DOM. It returns `{ step(dt), state(), set(next), on(ev, fn), ... }`.
- `X.mount(el, params)` is one `kit/card-stage.js` box around it: `CardStage.create({ mount: el, cam, stage, step, afterFrame, onResize, viewOffset: params.viewOffset })`. Pass `viewOffset` through; that is what centres the scene beside a lesson shell's panel. Do not write your own render loop, resize observer, or destroy. CardStage's are the ones that give the context back and stop rendering when the box scrolls off screen.

`set` reconciles: it adds and removes the difference, and never tears the scene down to apply a number. A parameter that requires a rebuild (a seed, a layer height) may rebuild, and the header says which ones do.

`state()` carries **every number a page could print**, and the reference will tell the model to print from it. If a fact is worth a caption, put it in state, not in the model's memory. Tree's flows once reported the params instead of the live intensities; a page printed zeros while water visibly flowed.

Events: `frame` always. Add named events for things a page wants to react to (`cross`, `turn`, `hover`, `select`, `night`), and emit nothing a page can read off `frame` anyway.

**Anchors and a library**, returned by `create` and wired by `mount` through `Notebook.create` in `lib/annotate.js`. `anchors` is name → function returning a live world point, or null when that part is not on stage. `library` is name → `{text, card, offset}`: the label and a two-sentence card, in a tutor's voice, for each part. This is how a generated page answers "what is that?" with a callout on the thing instead of a paragraph, so write the library as carefully as the header. The mount exposes `note`, `notes`, `clearNotes` and `anchors`; copy the five lines from `leaf/leaf.js`'s mount. List the anchor names in the Components.md section.

**Layers and a palette.** `layers()` lists what can be shown or hidden as `{name, label, on}`, `show(name, on)` does it by visibility (the sim keeps running: a hidden water still crosses), and `palette()` says what the colours mean. `CardStage.showPanel` turns all three into chips, so a component that declares them gets its "point at / show / colours" UI without a page writing a button. List the layer names in the Components.md section too.

## 2. The stack

- **Three r128, global script, no modules, no build.** The prototypes for Leaf and Tree were ES-module Three 0.17x and both were ported down; the library is not moving up (Modules.md). `lib/geo.js` holds the geometry the r128 build lacks: capsule, rounded box, merge. Add to it rather than vendoring an addon.
- **No CSS2DRenderer.** A label pinned to a 3D point is a DOM element in an overlay, positioned in CardStage's `afterFrame` from `camera.project`. `tree/tree.js`'s piles do it.
- **Lights.** `Stage.create`'s studio lights ride the camera and cast no shadows. A scene that needs a sun or shadows adds its own in `mount` and dims Stage's (Tree does both). r128 light intensities are not physical units, so a prototype's numbers do not transfer; tune by eye and say so in a comment.
- **Colours.** Atom and bond colours come from `palette.js`, never typed (CLAUDE.md). A render's own palette (a cytoplasm, a chloroplast) is the component's, declared once at the top of the file.
- **Materials are per instance of what can be dimmed or highlighted separately.** Leaf's two epidermis layers once shared a material, so isolating one dimmed the other.

## 3. Scale and science

- **One scale family per scene** (MolecularGeometry.md §1.5). Say in the header what one scene unit is. A cell at micrometres cannot share a scene with a molecule spec, and a page will try; the header is where it learns not to.
- **Say what is measured and what is drawn.** A render of a plant cell is a textbook diagram, prop tier: proportions plausible, nothing deposited. Declare that in the header and in the reference section, so the model does not let a page claim a size. Where a number is real (a bilayer's thickness from OPM, a tree's allometry), keep it beside its citation.
- **Invariants live in the component, not in the prompt.** A student remixing parameters must not be able to make the science false: clamp ranges, refuse impossible counts, keep the same particle budget per side if that is what the claim rests on. Membrane's contents reconcile and its budgets refuse; the reference only describes the rule.
- Pedagogical exaggeration is allowed and must be one declared number (`EXAG` in Membrane, `ION.exaggeration` in parts), applied uniformly so relative sizes stay true.

## 4. Budget

A generated page will put more on stage than you expect. Measure the sim step alone, `sim.step(dt)` in a loop, at the crowd the reference recommends and at the budget:

- under 2 ms a step at the recommended crowd, on a laptop
- a hard cap the component enforces at `add`, with one console warning, not a clamp somewhere later
- anything quadratic in the crowd bucketed on a grid

Measure the fixed cost too, with nothing on stage. Membrane's was 3 ms a frame from a lathe rebuilt every tick whether or not its gates had moved, and it hid under the crowd cost until an empty stage was timed.

## 5. Files, in this order

1. `<name>/<name>.js`, header first. The header is the contract: what it is, what one unit is, every param with its range and default, what `state()` holds, the events, what is exaggerated, what it refuses to own. Comments are present tense and explain the non-obvious (CLAUDE.md).
2. `<name>/<name>-test.html`, the bench: every control a `set`, every readout from `state`, on the sidebar shell (`css/main.css` + `css/sandbox.css`, `#app-sidebar > #stage + #side`). Copy `leaf/leaf-test.html`. Drive it with `pump` from the console; a backgrounded tab never runs the loop.
3. A checker if the component makes a checkable claim, `<name>/check-<name>.js`, Node-loadable and dependency-free, and its gate line in `.githooks/pre-commit` once the component is past test status.
4. `docs/Components.md`: a section in the shape of the others. Load order, the `mount` call with every param commented, what it models in two sentences, the `state()` table, events, then **Good for / Not for**. The model reads nothing else, so if the section does not say it, the model does not know it. Keep it tight; the whole file is the cached prompt and every section costs every request.
5. `docs/Modules.md`: one bullet under the water/membrane/leaf/tree ones. `admin.html`: one card for the bench. `node tools/check-docs.js` passes.
6. Run `node tools/gen-app.js "<a request a teacher would type that needs your component>" tests/gen-<name>-test.html`, open the page, drive it, and fix the component or the reference until it works first try. Add the page to `admin.html` under Generated apps with the `UGC` badge. That page is the eval; keep it.

## 6. What the last four taught

- The reference is carrying the structure. A bare question produced a three-step lesson. Put effort into the section, not into a prompt.
- Anything the reference has to say twice, or say in prose as a rule, should be a parameter or a default instead. The salmon app reached under the params twice; both became defaults.
- What the model forgets goes into the library, not the doc. It forgot `viewOffset`, so the shell now stamps it on its stage and CardStage reads it there.
- Two flaws from three runs were in the components, not the model: a frame cost and a noisy readout. Drive the generated page by hand; the model's page will use your component the way a student will, not the way your bench does.
