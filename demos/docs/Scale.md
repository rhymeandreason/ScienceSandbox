<!-- KIND: rulebook — the scale ladder every component declares. Load whole when adding a component, changing one's scale, or deciding whether two things go in one box. `kit/scale.js` is the enum, `tools/check-scale.js` the enforcement. -->

# Scale

## The problem

"What scale is this component?" collapses three questions that come apart constantly:

1. **What is one scene unit?** Sometimes answerable, often not.
2. **How big is the real subject?** A red blood cell is 8 µm across whether or not the render is measurable.
3. **What is exaggerated, and by how much?**

Before this, each component answered whichever it felt like, privately. `membrane/membrane.js` declared `EXAG` in code. `tree/tree.js` and `leaf/leaf.js` said "the organism scale" and "the cell-and-tissue scale" in a header. `cell/cutaway.js` said "not a scale" in a header. `Components.md`, the only thing the generator's model ever sees, said nothing at all. Nothing could contradict anything, because nothing was comparable.

The `Cell-Component.md` brief hit this directly: it asked for `state().size` in micrometres while `cell/cutaway.js`'s header forbade putting a number beside the render. Both were right, about different questions.

## The answer: rung, and form

```js
X.SCALE = {
  rung: 'cell',                  // required, from the ladder below
  form: 'single',                // 'single' | 'bulk'
  unit: null,                    // metres per scene unit, or null: not measurable
  sceneUnits: [],                // advertised fields that are scene units on purpose
  exag: { ribosome: 30 },        // drawn / true, per part name
  down: { membrane: 'Membrane' },// part name -> the component a zoom hands off to
};
```

### Rung is size, and it governs exactly one thing

```
molecules · macromolecule · membrane · organelle · cell · tissue · organ · organism · population
```

**Components at the same rung may share a scene. Components at different rungs may not.** That is `MolecularGeometry.md` §1.5's one-scale-family rule turned from a judgement call into a comparison. Crossing a rung is a handoff between two boxes; it is never a camera move, because a cell is about 20 µm and a bilayer about 5 nm and no camera survives 4000:1.

A coarse enum rather than a number, because the generator's three real needs are all comparisons: don't mount two scales in one box, know whether a zoom exists, don't print a number the render can't support. None needs metres, and a closed set can be checked for typos where a float cannot be checked for being wrong.

### Form is how many, and it is orthogonal on purpose

`bulk` recurs all the way up the ladder:

| | rung | form |
| --- | --- | --- |
| a water molecule | molecules | single |
| `WaterSim` | molecules | **bulk** |
| the capillary PBF sim | molecules | **bulk** |
| a red blood cell | cell | single |
| the sickle vessel, planned | cell | **bulk** |
| `Leaf`'s mesophyll | cell | **bulk** |

"Many of the same thing, where the behaviour is emergent" happens at the molecule rung and again at the cell rung, and will happen again at the organism rung the first time we draw a population. That is the signature of a second axis, not a ladder entry, and it is why bulk liquid kept refusing to sit anywhere in the ladder.

**Bulk plus single at the same rung is the normal, correct scene.** A solute in water. A chloroplast in mesophyll. A red cell in a vessel. That is the pattern a generated page most needs permission for, and folding `liquid` into the ladder as its own rung would have forbidden three working featured lessons: `water-lab`, `molecule-lab` and `solvation-lab` all put a solute molecule inside the water, in one scene, correctly.

### Unit is optional, and null is a claim

Most components have `unit: null`, and that is not a gap. It says: **this render is not measurable, so nothing may print a length off it.** `tools/check-scale.js` enforces it against the fields a component advertises.

How big the real thing is survives the render not being to scale, so a real size still belongs on the library card as prose. "A red blood cell is about 8 µm across" is a fact about red blood cells. "This picture is 8 µm wide" would be a measurement of a diagram. The first is always allowed; the second needs a `unit`.

Two components have a real unit today: `Proteinbox` at one ångström per scene unit, from a lab's own coordinates, and `Membrane` at about an ångström, with everything crossing drawn 5× oversize against the sheet.

### Exag is per part, so a page prints it from data

`{ ribosome: 30 }` means drawn 30× its true size relative to everything else in the scene. A page saying "ribosomes shown 30× oversize" reads it rather than typing it. `Membrane`'s long-standing `EXAG` becomes `exag: { crossing: 5 }` and stops being a one-off.

### Down is the zoom graph, declared separately from the ladder

`down` maps a part name to the component a zoom hands off to. It is separate from the ordering on purpose: a component can declare a zoom target without the ladder implying one, and it can deliberately skip a rung. `AnimalCell.down.mitochondrion` will go straight to `Membrane` with `context:'mitochondrion'`, skipping the `organelle` rung, because the lesson there is chemiosmosis and not mitochondrial shape. The checker warns on a skip rather than failing, so it stays a decision instead of becoming an accident.

## What the checker enforces

`node tools/check-scale.js`, offline, dependency-free, gated in `.githooks/pre-commit`:

1. Every component exports a well-formed `SCALE`.
2. Every `down` target exists and sits at a lower rung. Same rung fails: it should have been one scene. A skipped rung warns.
3. A component with `unit: null` advertises no length, unless `sceneUnits` names the field on purpose.
4. `Components.md` carries a `**Scale**: <rung>, <form>` line per section, and it matches the code.

Audit 4 is the one that matters most. The model only sees `Components.md`, so a rung that is not written there does not exist, and a rung written there that the code disagrees with is worse than none.

**What it does not check is whether a rung is the RIGHT one.** Nothing here catches a tissue labelled an organ. The enum is short enough that a wrong entry is visible on the page.

## Adding a component

Declare `SCALE` beside the `global.X = {...}` export, add the component to `COMPONENTS` in `tools/check-scale.js`, and put the `**Scale**:` line in its `Components.md` section. If the render has no meaningful unit, say `unit: null` rather than inventing one; a number nothing checks is worse than an honest absence.

## Adding a rung

A real decision, not a convenience. The test is whether two things at the new rung could share a scene. `liquid` failed that test against `molecules` and became `form: 'bulk'` instead. Update `RUNGS` in `kit/scale.js`, the ladder in `Components.md`, and the table above.
