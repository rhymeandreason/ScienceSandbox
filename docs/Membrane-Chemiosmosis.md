<!-- KIND: recipe, scoped — the brief for putting Membrane in an organelle context: the mitochondrial inner membrane and the thylakoid, with a proton gradient and ATP synthase. Load whole when building it. It assumes demos/membrane/membrane.js's header and demos/docs/AddingAComponent.md. -->

# Membrane in an organelle: chemiosmosis

Respiration and photosynthesis are the same picture with one parameter flipped: a membrane, protons pumped across it by something that has energy to spend, and ATP synthase letting them back down the gradient and making ATP on the way. Membrane already owns pumps, channels, the potential and Nernst, so this is a context, one new pump rule, and one new machine, not a second simulation. It is also the reusable module the Bio doc names most, and the target of two of the cell's handoffs (`Cell-Component.md` §6).

## 1. What changes in `membrane/membrane.js`

```js
const m = Membrane.mount(el, {
  context: 'mitochondrion',   // 'plasma' (the default, everything as today) | 'mitochondrion' | 'thylakoid'
  fuel: 'NADH',               // what drives the complexes: 'NADH' | 'light' | null (none: the gradient runs down)
  fuelRate: 1,                // 0..1, how hard they pump; a light slider or an oxygen switch drives this
  proteins: { complex:{ x:-60 }, synthase:{ x:60 }, leak:null },
  units: 'mM', contents: { ... },   // protons and the counter-ions per side, as today
});
```

**Context** renames the two sides and picks the palette; nothing else. In `mitochondrion` the outside (+y) is the intermembrane space and the inside the matrix; in `thylakoid` the outside is the stroma and the inside the lumen. State, the library cards and the anchors `outside` and `inside` use those words; the code keeps +y and −y. The lipid palette shifts so a student can tell the three membranes apart at a glance, and the bilayer thickness stays OPM's.

**A proton kind**, `H`, drawn small and bare with its plus sign. It walks like an ion, is blocked by the lipid, and Nernst handles it as a monovalent cation. `state().pmf` is the proton-motive force: the potential plus 61 mV per pH unit from the two counts, and `state().pH` per side from the counts with a declared buffer so a handful of drawn protons reads as a tenth of a unit, not three.

**The complex** is the existing pump machinery with a different cargo rule: it recruits a proton from the inside, carries it out, and never comes back with one. No ATP is spent; a turn happens when `fuel` is set and `fuelRate` allows, so the rate is the page's slider. In `mitochondrion` it pumps out of the matrix; in `thylakoid` into the lumen, which is the same direction in the sim's own terms, inside to outside, because the lumen is drawn as the inside. That is the one flip the note promised: which real space is "inside" is the context, the physics does not move. Three complexes in the real chain are drawn as one, declared.

**The synthase** is the one new machine. A channel body from `Parts.transporter` with a rotor on the inside face that turns as protons pass, three protons per third of a turn and one ATP per full turn, or whatever `ATP_PER_TURN` the header declares with its citation. It admits protons only down the gradient, so with no gradient it stops, and with the complex off the gradient runs down and the rotor slows to nothing on its own, which is the whole lesson in one picture. `state().atpMade` counts, `turn` and `turned` events fire as the pump's do, and a `synthase` anchor carries the library card.

**The leak** is the existing proton-permeable channel stand-in for an uncoupler, off by default, so a page can show what dinitrophenol does: protons return without making ATP and the gradient collapses.

## 2. What does not change

Travellers, the funnel, the pore queue, `keepClear`, the budgets, `contents`, `net`, notes, layers, the show panel. Every existing test page keeps working with `context` unset. The Na⁺/K⁺ pump, the ion channels and the aquaporin are still available in any context, since a mitochondrial inner membrane has carriers too, but the featured set in an organelle context is the complex, the synthase, the two sides and a proton.

## 3. The claims a checker holds

`membrane/check-chemiosmosis.js`, Node-loadable off the pure parts:

- ATP per proton is the declared stoichiometry and never more: over a long run `atpMade * PROTONS_PER_ATP <= protons through the synthase`.
- With `fuel: null` the gradient only falls: `pmf` is non-increasing after the last complex turn.
- The synthase never runs uphill: no ATP is made while the inside count exceeds the outside by more than the drawn buffer.
- `context: 'thylakoid'` and `context: 'mitochondrion'` produce the same sim with the side names swapped, which is checkable by comparing state with the names stripped.

## 4. Copy the cards carefully

The library for this context is the lesson: what the complex is, what the synthase is, what the gradient is, why a leak wastes it. Two sentences each, in the tutor's voice, one card for each context where the wording differs. The reference section says which words a page prints for each side and tells the model that respiration and photosynthesis are one `fuel` apart, so a page comparing them mounts two boxes with one param changed.

## 5. Order

1. `context` and the side names, with the palette. Every existing page unchanged.
2. The `H` kind and `pmf` in state.
3. The complex as a pump rule with `fuel` and `fuelRate`.
4. The synthase and its rotor, then the checker.
5. The leak.
6. Components.md, Modules.md, admin, the generation run: "how does a mitochondrion make ATP?" and "what does light do in a chloroplast?" should each produce a working page, and diffing the two pages should show mostly the `fuel` line.
