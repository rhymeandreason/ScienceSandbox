<!-- KIND: rulebook — the scale ladder every component declares. Load whole when adding a component, changing one's scale, or deciding whether two things go in one box. `kit/scale.js` is the enum, `tools/check-scale.js` the enforcement. -->

# Scale

Every component declares one `SCALE` block, beside its `global.X = {...}` export:

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

## Rung

```
molecules · macromolecule · membrane · organelle · cell · tissue · organ · organism · population
```

Ordered small to large. It governs exactly one thing: **components at the same rung may share a scene; components at different rungs may not.** Crossing a rung is a handoff between two boxes, never a camera move — a cell is ~20 µm and a bilayer ~5 nm, and no camera survives that.

## Form

`single` or `bulk` — how many, independent of rung. `bulk` recurs at every rung: `WaterSim` is bulk molecules, `Leaf`'s mesophyll is bulk cells. **Bulk and single at the same rung, in one scene, is normal** — a solute in water, a chloroplast in mesophyll, a red cell in a vessel.

## Measurement: molecules only

Only the **molecules** rung is held to real numbers — bond lengths, angles, chirality. That's `MolecularGeometry.md`'s job, not this doc's.

**Everything above molecules is an illustration.** Approximate is expected; no one is checking it with a ruler. Real-world sizes still belong in prose on the library card ("a red blood cell is about 8 µm across" is a fact about red blood cells), but the render itself doesn't have to earn that number.

`unit` on `SCALE` reflects this: leave it `null` unless the component is genuinely built from measured data (`Proteinbox` from lab coordinates, `Membrane` from a real bilayer thickness). A `null` unit means the render supports no length claims; `tools/check-scale.js` enforces that nothing measurable is advertised without one.

## Exag

`{ ribosome: 30 }` = drawn 30× its true size relative to the rest of the scene. A page reads this to print "ribosomes shown 30× oversize" instead of typing a number nothing checks.

## Down

`down` maps a part name to the component a zoom hands off to — separate from the ladder, so a component can skip a rung on purpose (e.g. straight from `cell` to `membrane`, past `organelle`, when the lesson is chemiosmosis and not mitochondrial shape). The checker warns on a skip rather than failing, so it stays a decision.

## What `tools/check-scale.js` enforces

Offline, dependency-free, gated in `.githooks/pre-commit`:

1. Every component exports a well-formed `SCALE`.
2. Every `down` target exists and sits at a lower rung (same rung fails; a skipped rung warns).
3. A component with `unit: null` advertises no length, unless `sceneUnits` names the field on purpose.
4. `Components.md` carries a matching `**Scale**: <rung>, <form>` line per section — the model only sees `Components.md`, so this is the audit that matters most.

**Not checked:** whether a rung is the *right* one. The enum is short enough that a wrong entry is visible on the page.

## Adding a component

Declare `SCALE`, add it to `COMPONENTS` in `tools/check-scale.js`, and add the `**Scale**:` line to its `Components.md` section.

## Adding a rung

A real decision: could two things at the new rung share a scene? If yes, it's not a new rung. Update `RUNGS` in `kit/scale.js`, the ladder in `Components.md`, and the table above.
