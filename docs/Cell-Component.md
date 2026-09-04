<!-- KIND: recipe, scoped — the brief for the cell components. Load whole when building one. It assumes demos/docs/AddingAComponent.md, which is the contract every component shares; this says only what is specific to a cell. -->

# The cell components

The cell is the component most generated requests will land on, because "cell" is the word students use. It is also the one that answers the osmosis question every run so far has asked for and no component could show: a cell that swells, shrivels and bursts.

**Most of the rendering is already done.** `cell/cutaway.js` draws the textbook animal cutaway at reference quality: a bowl of cytoplasm with a nucleus, mitochondria with cristae, ER ribbons studded with ribosomes, a Golgi stack, centrioles and vesicles, procedurally from noise, on r128 and `kit/card-stage.js`. `cell/cutaway-test.html` mounts it. Look at it before reading further; this brief is written against what it already does.

What `cutaway.js` is not is a component. It has `create` · `mount` · `flyTo` · `focusOn` · `pick` · `hover` · `bounds`, and none of `set` · `state` · `on` · `note` · `show` · `layers` · `featured`. Its params are `seed` and `tilt`. So the work below is mostly wrapping and extending, not building.

The test of done is unchanged: `tools/gen-app.js` writes a working page from `Components.md` and a request such as "why does a red blood cell burst in pure water?"

## 1. Shape: a core and four components, not one component with seven presets

**Not one module with a `kind` string.** The model only ever sees the `Components.md` section, and one module means one parameter table where `tissue`, `bath`, `variant`, `deoxygenated` and `hair` are each live for one preset and dead for the rest. §9's own lesson is that a rule in the reference is not enforcement; a seven-way table is unenforceable by construction.

The cells share plumbing and differ in physics, which is the repo's standing split (`SCIENCE.md` §6). Animal cells burst. Walled cells plasmolyse. A red blood cell has no organelles and can sickle. An epithelial cell has two outsides. Those are different conclusions, not different parameters.

`cell/cell-core.js`, not mountable, holds what is shared:

- `buildShell`, `sweepProfile`, `makeNoise`, `displace`, `seededRandom`, lifted out of `cutaway.js` as they stand.
- The contract plumbing every cell needs: anchors and library through `Notebook`, `show(name, on)`, `layers()`, `state()`, `featured()`, `palette()`.
- The osmosis solver: a tween from a tonicity to a volume, shared, with what happens at the ends left to each component.
- `zoomTo` and the flight, §6.

Four mounted components, each with only its own parameters in its own `Components.md` section:

| Component | covers | its physics |
| --- | --- | --- |
| `AnimalCell` | a generic animal cell; `polarised: true` for an epithelial one | swells, crenates, bursts; the two faces |
| `PlantCell` | `kind: 'leaf' \| 'root' \| 'potato'` | the wall holds: turgor, plasmolysis, `mass` |
| `RedBloodCell` | one cell | a biconcave disc, no organelles, sickling |
| `BacterialCell` | one cell | the prokaryote contrast: nucleoid, plasmid, flagellum |

`PlantCell` keeps a `kind` because its three cells differ in what fills them and nothing else. `AnimalCell` keeps epithelial as a mode because the organelle set and the burst physics are identical; only the outside changes.

"Compare a plant and an animal cell" is two boxes on `card-stage`, as it always was. A generated page now names two components instead of passing two strings, which is more legible to the model, not less.

```js
const a = AnimalCell.mount(el, {
  cutaway: 0.55,        // 0..1, how much of the near side is removed
  tonicity: 'isotonic', // 'hypotonic' | 'isotonic' | 'hypertonic', or a number: outside over inside, 1 isotonic
  volume: 1,            // driven by tonicity; settable to reset
  isolate: null,        // an organelle kept opaque while the rest fade
  labels: false,
  seed: 1234,
  polarised: false,     // the epithelial mode
  tissue: 'gut',        // polarised only: 'gill' | 'gut' | 'kidney'
  bath: null,           // polarised only: { apical:{...}, basolateral:{...} } in mM
});
```

`create(THREE, root, camera, opts)` and `mount(el, params)` as every component has them, on `kit/card-stage.js`, `viewOffset` passed through.

## 2. Fidelity: `buildShell` is the answer, and it exists

Do not write a fidelity spec for these. `cutaway.js` already reaches the reference standard, and the reason is one idea worth keeping:

**`buildShell` takes any parametric surface `S(u,w)`, keeps `w` up to a per-`u` cut, offsets an inner wall along the finite-difference normal, and closes the two with a rounded lip.** A cut organelle therefore has real membrane thickness instead of a clipped single surface, and the lip is what makes the render read as a cell rather than a diagram. Outer, lip and inner are vertex colours, which is why those materials carry no `color`. `sweepProfile` gives the cristae and the ER ribbons; the noise gives the cytoplasm speckle and the ragged Golgi discs.

Everything the other three components need is the same three tools pointed somewhere else:

- **`PlantCell`**: a box profile, not a bowl. The wall is three shells with a visible middle lamella between neighbour stubs, since a plant cell's wall is the thing a student is being asked to notice. Chloroplasts are lens bodies cut open by `buildShell` with grana stacks inside. One vacuole dominating the volume, with the tonoplast a shell of its own. The potato adds amyloplasts packed with starch grains.
- **`RedBloodCell`**: one biconcave profile through `sweepProfile`, cut, with nothing inside but a haemoglobin tint. Cheap, and the point of it is the shape change.
- **`BacterialCell`**: a capsule profile, wall and membrane as two shells, a nucleoid as a noise-displaced tangle, a flagellum as a swept helix.

**Prop tier, and not a scale** (`MolecularGeometry.md` §1.4). Each of these declares `rung: 'cell'` and `unit: null` against the ladder in `demos/docs/Scale.md`; `cell/cutaway.js` already carries the block. A null unit is a claim, not a gap: the render is not measurable, so no page prints a length off it, and `tools/check-scale.js` fails a commit where one advertises a length anyway.

Sizes that ARE claimed, such as a red blood cell's 8 µm across, belong in the library card as prose, where they read as a fact about real cells rather than a measurement of the render. That is what resolves the conflict an earlier draft of this brief had with `cell/cutaway.js`'s header: how big a cell IS survives the picture not being to scale.

`form` is `'single'` for all four, and it matters for what may sit beside them. A single cell at the `cell` rung may share a scene with bulk cells at the same rung, which is how a red cell in a vessel and a chloroplast in mesophyll will work. It may NOT share a scene with `Membrane`, which is §6.

## 3. Organelles as named parts

Every organelle is an anchor with a library card, so a page answers "what is that?" with a note on it. Names, used for anchors, layers and `isolate` alike:

`membrane`, `wall`, `lamella`, `nucleus`, `nucleolus`, `chromatin`, `pore`, `mitochondrion`, `chloroplast`, `amyloplast`, `starch`, `roughER`, `smoothER`, `golgi`, `vesicle`, `lysosome`, `vacuole`, `tonoplast`, `ribosome`, `cytoskeleton`, `centriole`, `hair`, `nucleoid`, `plasmid`, `flagellum`, `capsule`, `cytoplasm`, and for the polarised animal cell `apical`, `basolateral`, `junction`.

**Split `er` into `roughER` and `smoothER`.** `cutaway.js` registers one part named `er`, and what it draws is rough ER: two arcs of swept ribbon around the nucleus with ribosome studs pushed into `riboPositions`. Register those arcs as `roughER`, and add a third run of ribbon further out with no studs, a paler profile and more tubular curvature as `smoothER`. Two parts, two library cards, because the difference between them is a thing a Bio 101 student is asked for by name and a single `er` anchor cannot say it. The instanced ribosome mesh keeps serving both the cytoplasm speckle and `roughER`'s studs, so the split costs one more group and no new draw call for the ribosomes.

The library is keyed by component and by name, falling back to a shared table. A vacuole in a potato is a store and in a leaf it is turgor, and the card should say the thing the lesson is about. `Notebook.create` takes a flat `library`, so the mount hands it the merged table and rebuilds when `kind` changes.

The library card is two sentences in a tutor's voice: what it is, what it does. Write them as carefully as the header; they are what a generated page says.

Hover lights an organelle and click isolates it, as Leaf does; `cutaway.js` already has the hover and the pick, and `setHighlight` is where isolate hooks in. `featured()` returns the five or six a student asks about first: for `AnimalCell`, nucleus, mitochondrion, roughER, golgi, membrane, lysosome.

## 4. Volume and tonicity

This is the reason to build these. Membrane shows a patch of bilayer with two compartments; it cannot show a cell changing shape, and the red blood cell request is exactly that.

- `tonicity` drives `volume` over a few seconds through a tween in the core, not a snap. A number is allowed, outside over inside, so a page can sweep it with a slider.
- `AnimalCell` and `RedBloodCell` crenate when they shrink and burst when volume passes a threshold: a `burst` event, the membrane opens, the contents disperse, `state().burst` true until `set({ volume: 1 })` resets.
- `PlantCell` and `BacterialCell` never burst. The wall holds and swelling becomes turgor, `state().turgor` 0..1. Shrinking is plasmolysis: the membrane pulls away from the wall and the gap is visible. That difference is the whole plant-versus-animal osmosis lesson, and having them as two components is what makes it impossible to get wrong.
- The potato experiment needs `state().mass`, relative to its start, since the class measures a cylinder on a balance and not a cell. Volume times a declared density is enough; the claim a page makes is the sign and the shape of the curve against tonicity, and the isotonic crossing. That crossing is the experiment's result, and a page should be able to sweep tonicity and plot it.
- **Sickling is this scale too.** `RedBloodCell` takes `deoxygenated` 0..1 and, for `variant: 'HbS'`, morphs the disc into the crescent through the same shape machinery as volume; `state().rigidity` rises and the cell stops deforming under tonicity. HbA never sickles. What sickling causes is the scale above and a separate component: a vessel of instanced red cells jamming a capillary. What causes it is the scale below and already built: `sickle/fibre-test.html` and Proteinbox for haemoglobin, which the `sickle` note hands off to. This component draws one cell changing shape and nothing more.
- Water crossing the membrane is a `flows` layer of small particles entering or leaving, rate from the tonicity, off by default. Choreography, not physics, and say so.

The deformation is the one per-frame cost. `buildShell` output is not cheap to rebuild, so drive volume as a vertex displacement or a scale on the built geometry, never a rebuild. §8.

Events: `frame` (state, dt) always, `burst`, `sickled`, `hover` (name or null), `select` (name or null).

## 5. The polarised animal cell

**An epithelial cell is polarised, and that is the whole point of it.** A gill ionocyte, a gut lining cell and a kidney tubule cell sit between two environments and carry different proteins on each face; every transport story a Bio 101 course tells is a story about the two faces being different. A generic cell with one outside cannot tell it, and the salmon lesson drawn as one membrane between "inside" and "outside" quietly implies the blood touches the sea.

- `bath.apical` and `bath.basolateral` in millimolar, the shape Membrane's `contents` takes: for a seawater gill, apical is the sea and basolateral is blood.
- `tissue` picks the proteins on each face, and `state().faces.apical` / `.basolateral` say which way salt and water move across each. Gill in seawater: the pump and the cotransporter stand-in basolateral, a chloride channel apical, sodium leaking between cells past the tight junction. Gill in fresh water: uptake, the other way. Gut: sugar in with sodium apically, out basolaterally. Kidney: water back through aquaporins.
- Mitochondria drawn many and lit when the pump works, because an ionocyte is packed with them and that is the visible fact that says this cell spends energy.
- A `salt` flow layer through the cell, one face in and the other out, so the cell reads as a conduit and not a bag. Choreography, declared.
- Two handoffs, §6.

The geometry is a column rather than `cutaway.js`'s bowl, with a tight junction to each neighbour's stub. Same organelle builders, a different outer profile.

## 6. The zoom to the bilayer

The cell is where the scale ladder goes from a cell to a membrane, and the handoff is a first-class thing. One scale family per scene is the rule (`MolecularGeometry.md` §1.5): a cell is about 20 µm and a bilayer about 5 nm, 4000 to 1, and Membrane is exaggerated on top of that. A literally continuous zoom would break depth precision long before it arrived and would land on a lie about relative size when it did. So the bridge is **a flight and then a swap**, which reads as continuous to a student and asserts nothing false.

Three rungs:

1. **At cell zoom the membrane is a visible double line**, exaggerated and declared. `buildShell` already gives the outer membrane a real inner wall and a lip, so this is a material and thickness change, not new geometry. The student sees it is two layers before they go anywhere, which is what makes the transition legible instead of magical.
2. **The flight.** `zoomTo('membrane')` picks a point on the surface and closes on it until the patch fills the frame, organelles fading as it goes. `bounds(org)` and `flyTo` exist in `cutaway.js` and are in the stage's own theta/phi/r terms, as `tree/tree.js` does it.
3. **The swap.** At frame-fill, crossfade into `Membrane`. Hold the patch orientation across the fade, same normal up and same roll, and it reads as one motion.

```js
c.zoomTo('membrane');          // flies, then emits 'handoff'
c.on('handoff', h => ...);     // h = { to:'Membrane', params:{...}, back:() => ... }
c.zoomTo(null);                // fly back out; the cell's state is as it was
```

The event carries the params describing the patch the camera reached, so the next component opens on the same thing the student was looking at. The handoff carries proteins and bath **by preset, never sizes**, which is what keeps §2's no-scale position intact.

- `zoomTo('membrane')` → `Membrane` with `units:'mM'` and `contents` from the cell's tonicity, proteins by component: a red blood cell gets `AQP` and the anion exchanger stand-in, a root cell its pumps, an animal cell `NA`, `K`, `pump`. Outside is up.
- `zoomTo('apical')` and `zoomTo('basolateral')`, polarised only → `Membrane` with that face's proteins for the `tissue` and that face's bath as the outside, the cytosol inside. Same Membrane, two layouts, and the student sees why one cell needs two different membranes.
- `zoomTo('mitochondrion')` → `Membrane` with `context:'mitochondrion'`, `fuel:'NADH'`.
- `zoomTo('chloroplast')` → `Membrane` with `context:'thylakoid'`, `fuel:'light'`. Both are in `Membrane-Chemiosmosis.md`.
- Any other organelle → a flight and `state().zoom` naming it, no handoff. The reference says so and a page does not fake one.

**The swap itself is shared, not the cell's.** `CardStage.handoff(fromBox, mountNext)` crossfades one box into another in the same stage element and returns a `back()`. `kit/card-stage.js` today exports `showPanel` · `create` · `pool` only, so this is new; put it beside `showPanel` so Leaf's palisade cell can hand off to a chloroplast the same way later.

## 7. Counts and what is exaggerated

A real animal cell has hundreds of mitochondria and millions of ribosomes. `cutaway.js` draws five mitochondria and an instanced ribosome speckle. Draw what reads and declare the rest:

- One number per organelle kind in a `COUNTS` table at the top of each file: drawn versus typical real. `state().organelles[name]` carries `{drawn, real}` so a page can print "5 drawn, about 1,000 in a real cell."
- Organelle sizes are consistent with each other where they can be. Ribosomes cannot be drawn to scale beside a nucleus; they are oversize and it is declared, the way Membrane declares `EXAG`.
- Every exaggeration is declared where it is set, not in a doc.

## 8. Budget

Measure the step alone, with nothing moving and with the water flow on, at the biggest component. Under 2 ms a step. The organelles are instanced where repeated. `buildShell` and `sweepProfile` are build-time costs and must stay build-time: Membrane's lathe rebuild cost 3 ms a frame until it was gated, and that was the entire budget. Volume, turgor and sickling are displacement or scale on built geometry.

Add a triangle budget per component when the first one is measured; `cutaway.js` is the baseline and nobody has counted it yet.

## 9. Traps this project has already fallen into

- A rule in the reference is not enforcement. Every rule the model broke (particle budget, protein spacing, the view offset, a second script for notes) was fixed by moving it into the library. Clamp, default and enforce in the component. The four-way split in §1 is this lesson applied to the parameter table itself.
- `state()` must read the live thing, not the params. Tree reported flow intensities from its params while the steps drove the flows directly, and a page printed zeros over visible traffic.
- Materials are per organelle, not shared, or isolating one dims another. `cutaway.js` shares `erMat` across the ER ribbons and `gm` across the Golgi discs, which is correct within a part and wrong across the `roughER` / `smoothER` split, so give the smooth run its own material.
- A hidden organelle is still simulated. Hiding is visibility only.
- Featured sets are short. The show panel with every anchor was a menu, not a lesson.
- Every number a page could print is in state. If a fact is worth a caption, it is a field.
- Colours are typed as sRGB and converted. r128 has no colour management and a hex lands in the material as linear; `cutaway.js`'s `col()` is why its hexes are what shows. Any new organelle goes through it.

## 10. Files, and the order to build them

1. `cell/cell-core.js` — the builders lifted from `cutaway.js`, plus the contract plumbing and the osmosis tween. Header is the contract.
2. `cell/cell-animal.js` — `cutaway.js`'s body on the core, `er` split, tonicity and burst, then the polarised mode. `cell/cutaway.js` is retired into it, not kept in parallel.
3. `kit/card-stage.js` gains `handoff`; `zoomTo('membrane')` on `AnimalCell`.
4. `cell/cell-plant.js`, then `cell/cell-rbc.js`, then `cell/cell-bacterium.js`.
5. A bench each on the sidebar shell, a control per parameter and the show panel; `cell/cutaway-test.html` becomes `cell/animal-test.html`.
6. `cell/check-cell.js` for the checkable claims: a red blood cell with a nucleus fails, a walled cell that bursts fails, an animal cell reporting turgor fails.
7. A `Components.md` section per component with Good for and Not for and the anchor and layer names, a `Modules.md` bullet, an admin card, then the generation run and its page under Generated apps as UGC.

## 11. Process hooks, later

Leave room, do not build in the first version: `divide` 0..1 for mitosis, `secrete` for ER to Golgi to membrane traffic as particle flows like Tree's, `stream` for cytoplasmic streaming in the plant cell. Each a scalar `set`, which is what makes it one line for the model. Design the organelle placement so a nucleus can split and vesicles have a path, and stop there.

Everything else is `demos/docs/AddingAComponent.md`.
