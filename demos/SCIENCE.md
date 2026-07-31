# Scientific Accuracy Rules

The rulebook for every page in this project. §§2–3 are chemistry (polarity,
covalent bonding); §§4–6 are per-page. Water/solvation physics (hydrogen bonds,
ice, emergent properties) moved to `WaterSim.md` — it only applies to the
solvation apps.

**Read `MolecularGeometry.md` (§1.1–§1.6) before adding or converting any
molecule spec** — angles, bond lengths, geometry sources, and stereochemistry.
It moved out of this file for length; it is not optional reading, just not
inline here. When adding or tweaking a visualization, check it against these
rules before shipping. The guiding principle:

> **Accuracy comes from the coordinates and the forces, not from the rendering
> library.** A pretty render of wrong geometry is still wrong. Prefer computing
> real positions/interactions over eyeballing them.

---


## 2. Polarity & charge

- Oxygen is **more electronegative** → it carries the partial negative charge
  (**δ−**); each hydrogen carries partial positive (**δ+**).
- The **dipole points toward oxygen** (the negative end).
- The electron cloud / density is shown **shifted toward O**, never symmetric.
- In `molecule-builder.html` this is drawn three ways at once, all from one
  per-recipe `polar` weight (a stylised electronegativity difference, **not** a
  dipole moment — O–H 1.24 → `1`, N–H 0.84 → `0.7`, C–H 0.35 → `0`): the shared
  pair sits **off-centre toward the core**, each atom gets a **δ−/δ+ badge**, and
  the ligand's cloud **leans back** along its bond. The offset is small on purpose
  — pushed far enough to bury the pair in the core it stops reading as *shared
  unequally* and starts reading as *transferred*, which is the ionic picture.
- **Methane is the control.** `polar: 0` means dead-centre pairs and no badges, so
  "shared" in the water tab and "shared" in the methane tab are visibly not the
  same word.

## 3. Electrons & covalent bonding

- A **covalent bond = a shared pair of electrons** (one from each atom). Show it as
  a pair, not a single dot or a plain stick when the lesson is about electrons.
- Oxygen has **two bonding pairs and two lone pairs** (4 electron domains,
  tetrahedral-ish). Both lone pairs must be shown when depicting O's electrons.
- Bonding pairs sit **closer to O** than to H (electronegativity), consistent with
  the δ−/δ+ story.
- **Double bonds are drawn as two sticks, never one.** A spec's bond entry carries
  an optional third element — the bond order — so `[i,j,2]` renders as a pair of
  thinner cylinders. Every C=O in the library is tagged: CO₂, carbonic acid,
  bicarbonate, the amino-acid carboxyls, and the glycolysis carbonyls.
- **Where the pair is splayed matters.** For a molecule with a neighbouring bond,
  the offset direction is derived from the plane those two bonds define, so both
  sticks read head-on. A **linear** molecule (CO₂) has no such plane, so the
  fallback deliberately offsets *across* the view rather than toward the camera —
  otherwise one stick hides exactly behind the other and a double bond reads as
  single from the default angle.
- **An electron wears its own atom's colour** (`molecule-builder.html`). A shared
  pair therefore shows **one dot of each colour** — two atoms each putting one
  electron in, rather than a bond appearing from nowhere — and ownership needs no
  legend. The cost is that a red dot lands on a red sphere, so every dot carries an
  ink ring; without it the shared pair vanishes into the oxygen at exactly the
  moment it matters.
- **A dative (coordinate) bond is drawn as two dots of the DONOR's colour.** In
  NH₃ + H⁺ → NH₄⁺ nitrogen supplies both electrons and the proton brings none, so
  there is no second colour to show. The proton itself is drawn with **no electron
  dot at all** and a `+`, because that is what a proton is. Once formed, the four
  N–H bonds are identical and the ion carries a **whole +1** — every δ badge comes
  off, since four δ+ would assert partial charges that happen to sum to one.
- **P=O stays a single stick, on purpose.** In phosphate the charge is delocalised
  over the oxygens; doubling one of them would assert a localisation that isn't
  there. Same reasoning as drawing bicarbonate's two bare O's identically.


## 4. Rendering caveats to remember

- **WebGL ignores line width** — thin `THREE.Line` H-bonds are effectively
  invisible and get occluded. Render bonds that need to be *seen* as thin
  cylinders/tubes, not lines.
- Prefer **real computed coordinates** over hand-placed approximations for any
  crystal/lattice/geometry claim. Where a real record exists, convert it
  (`tools/sdf2spec.js`) instead of eyeballing numbers — the amino acids carried
  impossible bond angles for as long as they were hand-written.
- Keep pedagogical exaggerations (enlarged bonds, spacing for legibility)
  **explicit in comments** so they aren't mistaken for to-scale facts.
- **Mixed conventions are fine, but label them.** The amino acids are real 3D
  conformers; the water/solute and glycolysis specs are still hand-built, flat
  (z=0), and use united-atom methyls (ethanol, and the `Skel` builder's sugars).
  Don't assume a spec's style from its neighbours — check the comment above it.
- A stick only shows if the bond is **longer than the two display radii combined**.
  This is a rendering constraint, not chemistry, and it is why lengths get scaled
  up. `check-molecules.js` is the guard.

---

## 5. Reaction & event animation reference (`fx.js`)

Every "something happened" moment in a simulation is marked by a transient effect.
These live in the shared **`fx.js`** module (same reuse pattern as `molecules.js`)
so every page gets identical visuals. Each page creates one instance bound to its
own scene:

```js
const FXi = FX.create(THREE, root, camera);   // root: group the molecules live in
FXi.spawnRing(pos, color);  FXi.popGlow(g, color);  …
FXi.step();                                    // once per frame, in loop()
```

Effects are stepped off a wall-clock delta (frame-rate independent) and are
**purely cosmetic** — they never feed back into the physics, the H-bond counts,
or the pH readout. `popGlow` scales *relative* to a target's current scale, so it
works on both a molecule Group (rest scale 1) and a bare ion mesh (rest scale =
its radius) without resizing it.

### Guiding principle — intensity tracks the chemistry

The loudness of the effect is proportional to what actually happened. **Bonds
breaking or forming** get the full shockwave-and-sparks treatment; **hydration**
(no bonds broken, identity unchanged) gets only a soft shimmer; a solute where
**nothing happens** stays visually silent. Never dramatize a non-event — an
animation on plain dissolving would imply a reaction that didn't occur, and
methane's *silence* is itself the lesson about nonpolar solutes.

### Effect primitives

<!-- ENUM: update when an fx.js primitive is added or removed. -->
| Function | What it draws | Used for |
|---|---|---|
| `spawnRing(pos,color)` | white core flash + double additive shockwave ring + 16-spark burst | bond break/form events |
| `popGlow(g,color)` | emissive flash (2.2×) + springy scale overshoot on a molecule's atoms | a molecule freshly formed / an ion tearing free |
| `settleShimmer(g,color)` | soft emissive breathe in-and-out, **no** scale/ring/sparks | a polar solute locking into its hydration shell |
| `protonHop(from,to,onArrive)` | glowing proton arcing between points with a fading comet trail | the H⁺ transfer of an acid ionization |
| `colorOf(g)` | reads a molecule's first **atom** colour (skips covalent-bond meshes) | tinting an effect to whatever it decorates |

### Per-molecule event → effect → colour

Atom/palette colours are the single source of truth in `molecules.js`
(`MolLib.PALETTE.atoms`); ion effects pull them live via `colorOf`.

<!-- ENUM: update when an effect is wired to a new event. -->
| Molecule | `class` | Event | Effect(s) | Colour(s) |
|---|---|---|---|---|
| **Water** H₂O | `solvent` | — (the medium; ambient H-bond network) | none | — |
| **Salt** NaCl | `ionic` | water bridges the pair → **dissociation** | `spawnRing` + `popGlow` each ion | ring/Na⁺ violet `#9a3fe0`, Cl⁻ green `#1fa968` |
| **Potassium chloride** KCl | `ionic` | same → **dissociation** | `spawnRing` + `popGlow` each ion | ring/K⁺ blue `#0054c0`, Cl⁻ green `#1fa968` |
| **Ethanol** C₂H₅OH | `polar` | settles into water → hydration toast | `settleShimmer` (in sync with toast) | water-blue `#9fd4ff` |
| **Ammonia** NH₃ | `polar` | settles into water → hydration toast | `settleShimmer` (in sync with toast) | water-blue `#9fd4ff` |
| **Methane** CH₄ | `nonpolar` | squeezed out (no H-bonds) | **none** (silence is the point) | — |
| **Carbon dioxide** CO₂ | `reactive` | **step 1:** CO₂ + H₂O → H₂CO₃ | `spawnRing` at attack site + `popGlow` on new H₂CO₃ | cool blue: ring `#7cc4ff`, glow `#bfe4ff` |
| ↳ **Carbonic acid** H₂CO₃ | `polar`, `product` | **step 2:** H₂CO₃ → HCO₃⁻ + H⁺ | `popGlow` on HCO₃⁻ + `protonHop` acid→water | glow `#ffe4b0`; proton `#ffe08a`, trail `#ffcf6b` |
| ↳ **Bicarbonate** HCO₃⁻ | `ion`, `product` | (formed in step 2) | — (glowed as part of step 2) | `#ffe4b0` |
| ↳ **Hydronium** H₃O⁺ | `ion`, `product` | proton lands on a water | `spawnRing` at landing + `popGlow` on new H₃O⁺ | warm amber: ring `#ffc24d`, glow `#ffd98a` |

### Bonding builder events (`molecule-builder.html`)

Each **bond type finishes in its own visual language**, because the page exists to
say they are different kinds of event. Recolouring one effect for all three would
say the opposite. Every effect is fired at a position the module **asks for** (the
anchor atom, the landing point) — never at the world origin, which is only where
the molecule is in the water tab.

| Bond formed | Event | Effect(s) | Colour(s) |
|---|---|---|---|
| **Covalent** (H₂O, CH₄, NH₃) | the last slot fills | `spawnRing` from the **core atom**, expanding through the molecule — the bond is a thing the whole molecule now has | covalent stone `#b3a892` |
| **Dative** (NH₃ + H⁺ → NH₄⁺) | the proton lands in the lone pair | `spawnRing` from the **donor**, in the **donor's own colour** (it did not come from both atoms) + the donor pair swells 1.34× and settles + amber `settleShimmer` on the new ion | N blue `#3f6ae0`; shimmer amber `#ffc24d` |
| **Ionic** (NaCl, KCl) | the electron lands on the nonmetal | **no ring** — `spawnCore` white flash + `spawnBurst` at the **arrival point on the shell**: one electron arrived at one place, the molecule did not acquire something | white `#ffffff` + the nonmetal's colour |

- The **completion ring is latched to fire once per molecule**, re-armed when the
  lesson reports incomplete — so rebuilding earns it again but a second report of
  the same finished state does not.
- The **electron's own flight** carries the ionic story: sodium's dot detaches,
  arcs the gap over 0.55 s and lands **green**. An electron wears its owner's
  colour, so changing colour mid-flight *is* the sentence "it changed owner".
  Counts flip at the moment of transfer, not on arrival — the callback only runs
  while the frame loop does, and a backgrounded tab must not leave the readout
  stale.
- The **dative flare is deliberately small** (1.34×). A dot that balloons stops
  reading as an electron and starts reading as an effect, and the whole claim is
  that these are the *same two electrons* throughout.

### Colour language

- **Cool blue** (`#7cc4ff` / `#bfe4ff`) — a **water-driven** step: hydration, water
  attacking the carbon.
- **Warm amber** (`#ffc24d` / `#ffd98a` / `#ffe08a`) — **acid / proton** chemistry;
  echoes the amber ion–dipole bond colour and the falling-pH story.
- **Ion palette** (violet / blue / green) — dissociation flares each ion in its own
  identity colour so cation and anion read as distinct.
- **Water-blue** (`#9fd4ff`) — the **hydration shell closing in**; deliberately a
  water colour, not the solute's, because the solute is unchanged.
- The **white core flash** (`#ffffff`) is shared by all `spawnRing` events — the
  neutral white-hot instant before the coloured rings take over.

### Where each is wired

- Dissociation — `checkDissociation()` (at the "pop apart" impulse). Wired in
  **both** `water-lab.html` and `molecule-lab.html`.
- CO₂ chain — `updateReactions()` (step 1 hydration, step 2 ionization) —
  `molecule-lab.html`.
- Solute settle — `updateSolutes()`, at the moment descent ends and the hydration
  toast fires (gated to `class === 'polar'`) — `molecule-lab.html`.
- Peptide bond — `condense()` (`aminoacid-lab.html`): `spawnRing` in the peptide
  colour at the join + `popGlow` on both residues, as a water is released.

New pages: add `<script src="fx.js">`, call `FX.create(THREE, root, camera)` once,
`FXi.step()` in the loop, and call the primitives at your own event sites.

---

## 6. Module architecture — share the plumbing, not the physics

There is deliberately **no monolithic `engine.js`**. The lessons fall into distinct
paradigms — solvation, molecular assembly, pathways, bonding — that do not share a
simulation core, and pretending otherwise would produce an engine whose every
option exists for exactly one caller.

What *is* extracted is the scaffolding nobody's lesson is about:

| Module | Owns | Deliberately does **not** own |
|---|---|---|
| `molecules.js` | colours, radii, geometry specs | anything that moves |
| `scene.js` | renderer/camera/orbit/lights/resize, `atom`/`bond`/`buildMolecule` | any page's physics |
| `fx.js` | transient event effects | when an event happened |
| `atomkit.js` | how an atom is **drawn** for the bonding lessons | how a bond **forms** |

The test for whether something belongs in a shared module: **would two lessons
disagree about it?** Colours, radii and the look of an electron must not vary
between pages — a student moving from one tab to the next has to read the second
lesson with the vocabulary the first one taught. How a bond forms is exactly what
the lessons are *for*, so it stays local.

The split repeats one level down inside the bonding builder. Water and methane
share `covalent-drag.js` because they are the **same mechanic at two slot counts**
— a recipe. Salt gets `ionic-drag.js` because filling a valence slot and handing
an electron over are **different mechanics**, and expressing the second as a mode
of the first would have meant a flag that turns the lesson off. Rule of thumb:
*same mechanic, different constants* → one file with a recipe; *different
mechanic* → a different file.

The two solvation pages (`water-lab`, `molecule-lab`) keep their **own** molecule
builder — cel outlines, Debug recolour/toon, hydration `userData` — and share only
the scene bootstrap, for the same reason.

