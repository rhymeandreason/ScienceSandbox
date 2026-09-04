<!-- KIND: recipe, scoped — the brief for cell/cell.js. Load whole when building it. It assumes demos/docs/AddingAComponent.md, which is the contract every component shares; this says only what is specific to a cell. -->

# The cell component

The cell is the component most generated requests will land on, because "cell" is the word students use. It is also the one that answers the osmosis question every run so far has asked for and no component could show: a cell that swells, shrivels and bursts. Build it on the contract in `demos/docs/AddingAComponent.md`; this brief is what is specific to a cell. The test of done is unchanged: `tools/gen-app.js` writes a working page from `Components.md` and a request such as "why does a red blood cell burst in pure water?"

## 1. Shape

One module, `cell/cell.js`, one contract, six presets. Not six modules: a request will say "compare a plant and an animal cell" and expect two boxes of the same thing, and the organelle set is mostly shared. The three plant presets differ in what fills the cell, which is what a class experiment turns on.

```js
const c = Cell.mount(el, {
  kind: 'animal',        // 'animal' | 'red-blood-cell' | 'leaf' | 'root' | 'potato' | 'bacterium'
  cutaway: 0,            // 0..1, the near quarter removed so the inside shows
  tonicity: 'isotonic',  // 'hypotonic' | 'isotonic' | 'hypertonic', or a number: outside osmolarity relative to inside, 1 = isotonic
  volume: 1,             // read-only in effect: driven by tonicity over time; settable to reset
  isolate: null,         // an organelle name kept opaque while the rest fade
  labels: false,         // the library's notes for the featured organelles, on
  seed: 1,               // organelle placement; a new seed is a new cell of the same kind
  variant: 'HbA',        // red-blood-cell only: 'HbA' | 'HbS'
  deoxygenated: 0,       // red-blood-cell only, 0..1; an HbS cell sickles as it rises
});
```

`create(THREE, root, camera, opts)` and `mount(el, params)` as every component has them, on `kit/card-stage.js`, `viewOffset` passed through, anchors and a library wired through `Notebook`, `layers()`, `show()`, `palette()`, `featured()`.

## 2. Presets

| kind | has | does not have | size, diameter |
| --- | --- | --- | --- |
| `animal` | nucleus, mitochondria, rough and smooth ER, Golgi, lysosomes, ribosomes, cytoskeleton, centrioles, membrane | wall, chloroplasts, large vacuole | about 20 µm |
| `red-blood-cell` | membrane, cytoskeleton, haemoglobin as a tint | nucleus, mitochondria, everything else: a biconcave disc, not a blob | 8 µm across, 2 µm thick |
| `leaf` | the animal set minus centrioles and lysosomes, plus wall, chloroplasts, one large central vacuole | | about 40 µm, a palisade cell: a column |
| `root` | as `leaf` but no chloroplasts; a root hair as an option (`hair: true`) | chloroplasts | about 40 µm, a box; the hair many times longer |
| `potato` | as `root` plus amyloplasts packed with starch grains, a smaller vacuole, thin wall | chloroplasts | about 60 µm, a rounded box; a tuber storage cell |
| `bacterium` | wall, membrane, nucleoid, ribosomes, plasmid, flagellum, capsule | every membrane-bound organelle | 2 µm long |

The red blood cell is its own preset because it is the odd one out and because it is the cell every animal tonicity question is about. The three plant presets exist because the plant questions come from three places: the leaf for photosynthesis, the root for uptake, and the potato for the osmosis experiment every class runs, where a cylinder of tuber gains or loses mass in a series of salt solutions. The bacterium is there because "prokaryote vs eukaryote" is the second most common cell question in Bio 101. `plant` may be accepted as an alias for `leaf`.

Sizes are real and go in `state().size` in micrometres, with the scene unit stated in the header as one micrometre. A page prints the size from state, never types it.

## 3. Organelles as named parts

Every organelle is an anchor with a library card, so a page answers "what is that?" with a note on it. Names, used for anchors, layers and `isolate` alike:

`membrane`, `wall`, `nucleus`, `nucleolus`, `mitochondrion`, `chloroplast`, `amyloplast`, `starch`, `roughER`, `smoothER`, `golgi`, `lysosome`, `vacuole`, `ribosome`, `cytoskeleton`, `centriole`, `hair`, `nucleoid`, `plasmid`, `flagellum`, `capsule`, `cytoplasm`.

An anchor for a repeated organelle points at one of them, the nearest to the camera, the way Membrane's `NA` points at one sodium. The library card is two sentences in a tutor's voice: what it is, what it does. Write them as carefully as the header; they are what a generated page says.

The library is keyed by preset as well as by name: `library[kind][name]` falling back to `library.all[name]`. A vacuole in a potato is a store and in a leaf it is turgor, and the card should say the thing the lesson is about. `Notebook.create` takes a flat `library`, so the mount hands it the merged table for the current preset and rebuilds the notebook when `kind` changes.

Hover lights an organelle and click isolates it, as Leaf does. `show(name, on)` per organelle, and `featured()` returns the five or six a student asks about first per preset: for `animal`, nucleus, mitochondrion, roughER, golgi, membrane, lysosome.

## 4. Volume and tonicity

This is the reason to build it. Membrane shows a patch of bilayer with two compartments; it cannot show a cell changing shape, and the red blood cell request is exactly that.

- `tonicity` drives `volume` over a few seconds through a tween, not a snap: hypotonic swells, hypertonic shrinks, isotonic holds. A number is allowed, outside osmolarity relative to inside, so a page can sweep it with a slider.
- `animal` and `red-blood-cell` crenate when they shrink (the membrane wrinkles) and burst when volume passes a threshold: a `burst` event, the membrane opens, the contents disperse, and `state().burst` is true until `set({ volume: 1 })` resets.
- `leaf`, `root` and `potato` never burst: the wall holds, and swelling becomes turgor. `state().turgor` 0..1. Shrinking is plasmolysis: the membrane pulls away from the wall and the gap is visible. That difference is the whole plant-versus-animal osmosis lesson, and the component should make it impossible to get wrong.
- The potato experiment needs one more number: `state().mass`, the cell's mass relative to its start, since the class measures a cylinder on a balance and not a cell under a microscope. Volume times a declared density is enough; the claim a page makes is the sign and the shape of the curve against tonicity, and the isotonic point where it crosses zero. That crossing is the experiment's result, and a page should be able to sweep tonicity and plot it.
- `bacterium` behaves as the plant does, wall and all.
- **Sickling is this scale too.** The red blood cell takes `deoxygenated` 0..1 and, for the HbS variant (`variant: 'HbS'`), `sickle` follows it: the disc morphs into the crescent through the same shape machinery as volume, `state().rigidity` rises, and the cell stops deforming under tonicity. HbA never sickles. What sickling causes is the scale above and a separate component: a vessel with many instanced red cells that takes its shape from this one, where the crowd jams a capillary. What causes it is the scale below and already built: `sickle/fibre-test.html` for the HbS fibre and Proteinbox for haemoglobin, which the `sickle` note hands off to. This component draws one cell changing shape and nothing more.
- Water crossing the membrane is what a page may want to see: a `flows` layer of small water particles entering or leaving, rate from the tonicity, off by default. Choreography, not physics, and say so.

Events: `frame` (state, dt) always, `burst`, `sickled`, `hover` (name or null), `select` (name or null).

## 5. Counts, size and what is exaggerated

A real animal cell has hundreds of mitochondria and millions of ribosomes. Draw what reads and declare the rest:

- One number per organelle kind for the exaggeration, in a `COUNTS` table at the top of the file: drawn versus typical real. `state().organelles[name]` carries `{drawn, real}` so a page can print "12 drawn, about 1,000 in a real cell."
- Organelle sizes are to scale with each other and with the cell where they can be (a mitochondrion is about 1 µm, a ribosome 25 nm). Ribosomes cannot be drawn to scale at cell zoom; draw them oversize and declare it, the way Membrane declares `EXAG`.
- Prop tier (MolecularGeometry.md §1.4): shapes are a textbook diagram's. Say so in the header and in the reference section, so the model does not let a page claim a measured structure.

## 6. Scale handoffs

The cell is where the scale ladder goes from micrometres to nanometres, and the handoff is a first-class thing, not a one-off. One scale family per scene is the rule (MolecularGeometry.md §1.5): the cell is at one unit per micrometre and Membrane at ångström-scale exaggeration, so a zoom is a flight and a swap, never one scene.

```js
c.zoomTo('membrane');          // flies the camera to a point on the surface until the membrane fills the frame,
                               // then emits 'handoff'
c.on('handoff', h => ...);     // h = { to:'Membrane', params:{...}, back:() => ... }
c.zoomTo(null);                // fly back out; the cell's state is as it was
```

The event carries the params that describe the patch the camera reached, so the next component opens on the same thing the student was looking at:

- `zoomTo('membrane')` → `Membrane` with `units:'mM'` and `contents` from the cell's tonicity (inside is the cell's cytosol by preset, outside the bath), proteins by preset: a red blood cell gets `AQP` and the anion exchanger stand-in, a root cell its pumps, an animal cell `NA`, `K`, `pump`. Outside is up.
- `zoomTo('mitochondrion')` → `Membrane` with `context:'mitochondrion'`, `fuel:'NADH'`.
- `zoomTo('chloroplast')` → `Membrane` with `context:'thylakoid'`, `fuel:'light'`. Both are in `Membrane-Chemiosmosis.md`.
- Any other organelle → a flight and `state().zoom` naming it, with no handoff; the reference says so, and a page does not fake one.

The swap itself is shared, not the cell's: `CardStage.handoff(fromBox, mountNext)` crossfades one box into another in the same stage element and returns a `back()`; put it in `kit/card-stage.js` beside `showPanel`, so Leaf's palisade cell can hand off to a chloroplast the same way later. At cell zoom the membrane is drawn as a visible double line, exaggerated and declared, so the student sees what they are about to enter.

`state().zoom` is the organelle name or null; the flight is in the stage's own orbit terms, as `tree/tree.js`'s `flyTo` does it.

## 7. Process hooks, later

Leave room, do not build in the first version: `divide` 0..1 for mitosis, `secrete` for ER to Golgi to membrane traffic as particle flows like Tree's, `stream` for cytoplasmic streaming in the plant cell. Each a scalar `set`, which is what makes it one line for the model. Design the organelle placement so a nucleus can split and vesicles have a path, and stop there.

## 8. Budget

Measure the sim step alone, with nothing moving and with the water flow on, at the biggest preset. Under 2 ms a step. The organelles are instanced where repeated; the membrane is one deformable mesh, and its deformation is the one per-frame cost, so make it a vertex shader or a cheap displacement rather than a rebuild. Membrane's lathe rebuild cost 3 ms a frame until it was gated, and that was the entire budget.

## 9. Traps this project has already fallen into

- A rule in the reference is not enforcement. Every rule the model broke (particle budget, protein spacing, the view offset, a second script for notes) was fixed by moving it into the library. Clamp, default and enforce in the component.
- `state()` must read the live thing, not the params. Tree reported flow intensities from its params while the steps drove the flows directly, and a page printed zeros over visible traffic.
- Materials are per organelle, not shared, or isolating one dims another.
- A hidden organelle is still simulated. Hiding is visibility only.
- Featured sets are short. The show panel with every anchor was a menu, not a lesson.
- Every number a page could print is in state. If a fact is worth a caption, it is a field.

## 10. Files

`cell/cell.js` with the header as the contract; `cell/cell-test.html` on the sidebar shell with a control per parameter and the show panel; `cell/check-cell.js` if any claim is checkable (the preset tables above are: a red blood cell with a nucleus fails); the Components.md section with Good for and Not for and the anchor and layer names; a Modules.md bullet; an admin card; then the generation run, and its page under Generated apps as UGC.

Everything else is `demos/docs/AddingAComponent.md`.
