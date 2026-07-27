# Scientific Accuracy Rules — Water Visualization

Rules and decisions that keep `water-lab.html` scientifically honest. When adding or
tweaking a visualization, check it against these before shipping. The guiding
principle:

> **Accuracy comes from the coordinates and the forces, not from the rendering
> library.** A pretty render of wrong geometry is still wrong. Prefer computing
> real positions/interactions over eyeballing them.

---

## 1. Molecular geometry

- **Bond angle is 104.5°**, not 90° or 120°. The H–O–H angle is used verbatim in
  the 3D molecule builder and the 2D diagrams.
- Water is **bent / V-shaped** — never draw it linear.
- **Relative atom sizes:** O is drawn larger than H (O has more electrons / larger
  van der Waals radius). Keep O clearly bigger than H.
- O–H bond lengths in the model are stylized (enlarged for legibility), but the
  *angle* and *bent shape* must stay correct. If a length is exaggerated, say so
  in a comment rather than implying it's to scale.

### Where geometry comes from

Three sources, and the choice is not about how "complex" a molecule looks. The
question is whether its shape follows from **one or two known constants** or
**emerges from many coupled constraints**.

1. **Hand-written** — small molecules defined by a known angle, where the spec
   doubles as teaching material in its comments. Water (104.5°), methane (109.5°),
   ammonia (~107°), CO₂ (linear), the small ions. These are verifiably right today;
   don't churn them, and don't trade their readable annotated layout for an opaque
   coordinate block.
2. **Generated from a real record** (`tools/sdf2spec.js`, PubChem 3D) — branching
   skeletons, conformational freedom, or more than a handful of coordinates to
   type. The amino acids. The cost is real: generated specs are unreadable numbers
   carrying a "regenerate, don't hand-edit" warning, so only pay it when hand
   placement would actually drift.
3. **Generated from VSEPR** (`Skel` in `molecules.js`) — the glycolysis
   intermediates. First-principles derivation rather than a database, so it also
   covers the charged species PubChem has no 3D conformer for (bicarbonate,
   pyruvate, HPO₄²⁻), and it produces the deliberate flat Fischer-projection
   layout the lesson wants. Don't "upgrade" these to PubChem — it's a downgrade.

**The failure mode to watch for** is not complexity, it's a *scene* requirement
quietly outranking the chemistry. The old amino-acid specs were laid out so a
peptide chain would line up neatly along +X, and the α-carbon ended up at 180° —
a straight line through a tetrahedral centre. Whenever a layout is serving the
camera or the animation rather than the molecule, assume it has drifted and check.

Whatever the source, run `check-molecules.js`. It caught a double bond that was
correctly tagged but rendered as nothing, which reading the spec would never
reveal.

### Stereochemistry is the error nothing else catches

Bond lengths, bond angles and the render can all be perfect while the molecule
is **a different substance**. Glucose shipped that way: its substituents
alternated axial/equatorial around the ring, which is not glucose, and at C5 not
even D-. No screenshot shows this and no angle readout hints at it — only
measuring each substituent against the ring axis does.

So `check-molecules.js` audits rings, and a spec may **declare** what it expects:

```js
stereo:'all-equatorial',   // β-D-glucopyranose — asserted, not assumed
```

All-equatorial is what makes glucose the most stable of the 16 aldohexoses, and
is a large part of why the pathway is built around it rather than a sibling
sugar. It is a chemical claim, so it gets asserted like one.

`Skel` has **no general chirality model**. Glucose works because all-equatorial
is expressible as a geometric rule ("pick the slot most perpendicular to the ring
axis"). A sugar needing a *specific* mixed pattern — galactose differs from
glucose at one carbon only — cannot be built this way. Convert it from a real
record instead of inventing a face-naming convention; getting that subtly wrong
produces exactly the invisible failure above.

## 2. Polarity & charge

- Oxygen is **more electronegative** → it carries the partial negative charge
  (**δ−**); each hydrogen carries partial positive (**δ+**).
- The **dipole points toward oxygen** (the negative end).
- The electron cloud / density is shown **shifted toward O**, never symmetric.

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
- **P=O stays a single stick, on purpose.** In phosphate the charge is delocalised
  over the oxygens; doubling one of them would assert a localisation that isn't
  there. Same reasoning as drawing bicarbonate's two bare O's identically.

## 4. Hydrogen bonds

- An H-bond is an **intermolecular** attraction between a **δ+ H of one molecule**
  and a **δ− O (lone pair) of another** — never within the same molecule, never
  H-to-H or O-to-O.
- **Strength:** ~1/20 of a covalent bond. State this ratio; don't draw H-bonds
  with the same weight/style as covalent bonds. Convention here: covalent = solid
  stick, H-bond = **dashed** teal connector.
- **Directionality:** strongest when **O–H···O is close to linear**. Detection and
  forces are weighted by the alignment (dot product of the O–H direction and the
  H···O direction); bent geometries are weaker or rejected.
- **One donor H → at most one H-bond.** Each H forms a single H-bond (to the best
  aligned, nearest acceptor within range), so counts stay physical. A real water
  molecule participates in up to 4 H-bonds total (2 as donor, 2 as acceptor).
- **It is an attractive force.** When a bond forms it must actually *pull* the two
  molecules together toward an **equilibrium O···O distance**, balanced by
  short-range steric (Pauli) repulsion as a hard core. Molecules should latch into
  a cohesive network, not drift through each other. (Distances in `water.html` are
  scene units, not Ångström — the *behavior* is what must be right: attract when
  far, repel when too close, settle at equilibrium.)

## 5. Ice (solid water)

- Freezing produces the **real hexagonal ice (Iₕ) lattice**, built from actual
  crystallography — not a decorative grid:
  - Each oxygen is **tetrahedrally bonded to four others**.
  - Structure is **puckered hexagonal bilayers, ABAB-stacked** (hexagonal, not
    cubic ABCABC).
  - **One hydrogen bridges every O···O** linkage (ice rules: each O donates 2 H,
    accepts 2).
  - Real **O···O ≈ 2.76 Å**; the lattice is **more open than liquid**.
- **Ice is less dense than liquid water → it floats.** The frozen state must
  visibly occupy more volume / be more open than the liquid state. This is the
  whole point of the lesson; never let ice look denser than liquid.
- No atom overlap during the freeze/melt animation — molecules must not pass
  through each other (enforced by collision resolution, see §7).

## 6. Emergent properties must trace back to H-bonding

Every "special property" lesson should visibly connect to hydrogen bonding:

- **Cohesion / surface tension** — H-bonds pull molecules together.
- **Adhesion / capillary action** — narrower tube → higher rise (correct
  direction of the effect).
- **High specific heat / heat of vaporization** — added heat first goes into
  **breaking H-bonds** before molecules speed up / escape. Evaporation happens at
  high energy, not low.
- **Solvent** — polar water surrounds ions in **hydration shells**: δ− O faces
  cations (e.g. Na⁺), δ+ H faces anions (e.g. Cl⁻). Orientation must be correct.

## 7. Physics / simulation integrity

- **No interpenetration.** Spheres representing atoms/molecules must not visibly
  overlap during animation. Use position-based collision resolution or a repulsion
  force with a floor below any attractive equilibrium.
- **Stable integration.** Damp velocities; keep force constants low enough that the
  sim doesn't explode. Sanity-check by measuring max velocity after settling.
- **Equilibrium first.** When both attraction and repulsion act on the same pair,
  set the steric floor *below* the attractive equilibrium so bonded pairs rest at
  the intended distance instead of the two forces fighting.
- **Counts must be believable.** If a readout reports a quantity (e.g. number of
  H-bonds), verify it against the geometry — an 8-molecule cluster showing 100+
  H-bonds is a bug (it was: molecules had collapsed with no repulsion).

## 8. Rendering caveats to remember

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

## 9. Reaction & event animation reference (`fx.js`)

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

## 10. Amino acids & peptide bonds (`aminoacid-lab.html`)

- **Amino acids contain C, H, O, N — and S only in cysteine/methionine.**
  Potassium is **not** part of any amino acid; K⁺ is an intracellular electrolyte
  / enzyme cofactor (an ion in solution, like the Na⁺/Cl⁺ elsewhere), never built
  into the backbone or a side chain. The side panel says so explicitly.
- **Shared backbone:** every residue is amino group (–NH₂) + α-carbon + carboxyl
  (–COOH), differing only by the side chain **R**. The specs in `molecules.js`
  share one atom layout (indices 0–8) with R appended from index 9.
- **Peptide bond = dehydration synthesis (condensation).** Two residues join when
  one's **carboxyl –OH** and the other's **amino –H** leave as a single **H₂O**,
  forming a C–N amide bond. This is the inverse of CO₂ + H₂O (where water is
  *consumed*): here water is *released*, and the readout counts one water per bond.
- **Peptide bond colour:** slate violet (`#6a5acd`, `PALETTE.bonds.peptide`), drawn
  thicker than the stone covalent sticks so the backbone link reads as distinct.
- **Geometry is generated, not hand-placed** (`tools/sdf2spec.js`). The four
  residue specs are converted from PubChem 3D records, so the angles are real —
  the α-carbon is tetrahedral (~109°), where the earlier hand-written specs drew
  N–Cα–C at 180° and N–Cα–H at 90°, which no carbon does. Unlike the flat z=0
  layouts elsewhere in `molecules.js`, these are **genuinely non-planar**.
  Re-generate rather than hand-editing the numbers.
- **One global scale, not per-bond fudging.** Display radii here are enlarged for
  legibility, so true Ångström coordinates bury every stick inside its two
  spheres. A single 1.9× factor clears them all while keeping *relative* bond
  lengths truthful. Run `check-molecules.js` after any geometry change — it fails
  on merged spheres, which is exactly the bug that hid the carboxyl C=O.
- **Hydrogens: all present, C–H hideable.** The specs carry every real hydrogen;
  `spec.optH` lists the nonpolar C–H's that the lab's "show C–H hydrogens" toggle
  hides (`Stage.setOptionalH`). An H on N/O/S is **never** in `optH` — those are
  the H-bond donors and the leaving groups, so hiding them would hide the lesson.
  The toggle flips visibility only; it must not rebuild, or it would resurrect the
  –OH and –H that a peptide bond already consumed.
- **Model simplifications (keep explicit):** residues are drawn in the **neutral**
  –NH₂/–COOH form, not the physiological **zwitterion** (–NH₃⁺/–COO⁻); this makes
  the "lose a water" bookkeeping legible but is a display choice. Each residue stays a
  separate group linked by a redrawn peptide stick — so a chain is N groups, not
  one merged molecule (no claim of a single rigid conformation).


