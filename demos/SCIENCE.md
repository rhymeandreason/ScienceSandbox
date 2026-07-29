# Scientific Accuracy Rules

The rulebook for every page in this project. **§1 governs adding any molecule**
(§1.1–§1.6); §§2–8 are chemistry and the water/solvation physics; §§9–13 are
per-page. When adding or tweaking a visualization, check it against these before
shipping. The guiding principle:

> **Accuracy comes from the coordinates and the forces, not from the rendering
> library.** A pretty render of wrong geometry is still wrong. Prefer computing
> real positions/interactions over eyeballing them.

---

## 1. Molecular geometry

### 1.1 Angles and shape

- **Bond angle is 104.5°**, not 90° or 120°. The H–O–H angle is used verbatim in
  the 3D molecule builder and the 2D diagrams.
- Water is **bent / V-shaped** — never draw it linear.
- **Relative atom sizes:** O is drawn larger than H (O has more electrons / larger
  van der Waals radius). Keep O clearly bigger than H.
- O–H bond lengths in the model are stylized (enlarged for legibility), but the
  *angle* and *bent shape* must stay correct. If a length is exaggerated, say so
  in a comment rather than implying it's to scale.

### 1.2 Where geometry comes from

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

Whatever the source, run `check-molecules.js`. It caught a double bond that was
correctly tagged but rendered as nothing, which reading the spec would never
reveal.

### 1.3 Stereochemistry is the error nothing else catches

**Bond lengths, bond angles and the render can all be perfect while the molecule
is a different substance.** Nothing but an explicit stereo audit sees it, so a
spec **declares** what it expects and `check-molecules.js` fails if the geometry
disagrees:

```js
stereo:'all-equatorial',   // β-D-glucopyranose — asserted, not assumed
```

Glucose shipped wrong this way — substituents alternating axial/equatorial, not
glucose, and at C5 not even D-. All-equatorial is what makes glucose the most
stable of the 16 aldohexoses and much of why the pathway is built around it, so
it is a chemical claim and gets asserted like one.

**A real record is not a guarantee — your transform can destroy what you fetched
it for.** PubChem supplied L-amino acids; the converter shipped D, because its
reframe negated one output component of an orthonormal basis, which is a
**reflection**, not a rotation. A mirror preserves every bond length, every
angle and the render, so the specs were committed, reviewed and rendered before
a signed-volume check found it. Keep the basis right-handed (`e3 = e1 × e2`),
flip the *axis* rather than the output, and let `chirality:'L'` assert it.

**`Skel` has no general chirality model.** All-equatorial works only because it
is expressible as a geometric rule ("pick the slot most perpendicular to the
ring axis"). A sugar needing a *specific* mixed pattern — galactose differs from
glucose at one carbon — must come from a real record, not from a face-naming
convention invented on the spot.

### 1.4 Adding a molecule: how much fidelity does it owe?

Fidelity is not a global dial. Every geometry bug this project has shipped had
the same shape — the spec was right about everything **except the one feature the
lesson depended on**. The carboxyl C=O was buried inside its spheres; the
α-carbon was drawn linear; the glucose ring was a different sugar. So before
adding a molecule, ask what claim it is making, and classify it:

**Tier 1 — Prop.** Appears in a scene, never compared against a sibling. Water in
a membrane diagram, methane as "the nonpolar one". Hand-write it; correct shape
and polarity is enough.

**Tier 2 — Contrast.** Shown *against* a near-identical molecule where one
feature is the entire point. That feature must be exactly right **and asserted by
`check-molecules.js`**. Most of the AP Bio curriculum lives here:

<!-- ENUM: flip the Built column when a pair ships; add a row for a new contrast. -->
| Contrast | Differs by | The lesson | Built |
|---|---|---|---|
| starch vs cellulose | α- vs β-1,4 linkage | why we can't digest wood | — |
| saturated vs unsaturated fat | one C=C, *cis* | why butter is solid and oil is not | — |
| ribose vs deoxyribose | one –OH at 2′ | why DNA is the stable archive | ✓ `stereo:{faces}` |
| glucose vs galactose | one –OH orientation | why galactosemia is a disease | ✓ `stereo:{axial}` |
| L- vs D-amino acids | handedness | why life is homochiral | — |
| purine vs pyrimidine | two rings vs one | why A–T and G–C are equal width | ✓ `topology` |

The three built pairs are `contrast-lab.html`. The three unbuilt ones each need a
**new assertion type** before they can ship, which is the point of rule 2 below —
*cis*-C=C needs a torsion check, starch/cellulose needs a check across a
glycosidic linkage, and L/D on a sugar needs a signed-volume test like the one
`chirality` already does for amino acids. None of them is blocked on geometry;
they are blocked on being checkable.

**How a distinguishing feature gets declared.** One of these goes on the spec,
and `check-molecules.js` fails if the geometry disagrees:

<!-- ENUM: a new claim type goes here AND in check-molecules.js's header, same commit. -->
| Declaration | Means | Used by |
|---|---|---|
| `stereo:'all-equatorial'` | every ring substituent equatorial | glucose |
| `stereo:{axial:[i,…]}` | exactly these ring atoms are axial, all others equatorial | galactose (C4) |
| `stereo:{faces:{i:'a',…}}` | which ring atoms' substituents share a face — checked as a *relative* pattern, since the ring normal's sign is arbitrary | ribose, deoxyribose |
| `topology:{rings:[…],fused:true}` | ring count, ring sizes, and that a bicycle shares an edge | purine, pyrimidine |
| `chirality:'L'` | signed volume over CIP priorities | the amino acids |

`{faces}` deliberately cannot catch a *global* mirror (flip every substituent and
the relative pattern is unchanged, so L-ribose would pass as D-). No page makes a
D/L claim about a sugar yet; the moment one does, that claim needs its own
assertion rather than leaning on this one.

Every one of those is a stereochemistry or bond-order claim — the class that
renders beautifully while being wrong.

**Tier 3 — Subject.** The structure *is* the lesson (DNA's helix, an enzyme's
active site). Derive it from a real record.

Rules that follow:

1. **Name honesty.** If the distinguishing feature is not rendered correctly,
   do not use the name that implies it. Call it "a sugar", not "glucose".
2. **A claim ships with its assertion, in the same commit.** `stereo:` exists so
   a chemical claim fails a check rather than relying on someone noticing. A new
   claim type means extending `check-molecules.js` as part of adding the
   molecule — never as a follow-up.
3. **Source it by the three-way rule above** (hand-write / PubChem / `Skel`).
4. **Anything a lab manipulates needs an index map** (`pep`, `gly`), because
   reactions address atoms by position and a reindex silently breaks them.

### 1.5 Bond-length scale families — a page may only show one

Display radii in `PALETTE` are stylised and **large**, so no spec can use true
ångströms: a bond must exceed the sum of its two atoms' radii or the spheres
swallow the stick. `check-molecules.js` enforces exactly that, and nothing more.

*How* a spec satisfies it is not uniform across this project, and that is the
trap. There are two families:

<!-- ENUM: update when a spec is added, or SCALE / the GL constants change. -->
| Family | Specs | Rule | Implied scale |
|---|---|---|---|
| **A. hand-written** | water, ethanol, ammonia, methane, CO₂, carbonic, bicarbonate, hydronium | each length picked to clear its own radii | ~1.2–1.6×, **varies within a molecule** |
| **B. derived** | amino acids, palmitate, AMP, glucose + all glycolysis intermediates | real Å × one global `SCALE` | **1.9×**, relative lengths truthful |

Family A cannot be normalised, and should not be. `water-lab.html` and
`molecule-lab.html` hard-code `HL=1.55` and tune the whole solvation engine
around that scale — `EQ`, `MIN`, `hbThreshold`, the ice lattice `iceBond`.
Rescaling water means re-tuning that physics for no visible gain, because
nothing ever shows water beside an amino acid.

**The invariant: one page, one family.** Only family B is comparable
molecule-to-molecule, so only family B may make a size claim.

Learned the expensive way, and it is the §1.4 failure shape exactly. `Skel`'s
table (`GL`) was family A while the amino acids were family B; every page drew
from one family, so nothing showed it — until `macromolecule-lab.html` put
`Skel` glucose beside PubChem alanine under the words *"true relative size"* and
glucose came out ~0.7× everything around it. No bond-length check, no angle and
no screenshot of any *existing* page could have caught it. `GL` is now family B,
and the fix also split `GL.CC`/`GL.CO` (C–O is the shorter bond) and gave C=O
its own `GL.CdO`.

**Known residual, measured:** `ringPyranose()` builds a *regular* hexagon, so a
pyranose's ring C–O comes out as long as its ring C–C. Against the real PubChem
β-D-glucopyranose record that leaves the ring 3.13 Å wide vs 2.90, and the
heavy-atom span 6.78 Å vs 6.26 — **+8%**, inherited from the ring and consistent
throughout. Left alone deliberately; closing it means a ring builder with
alternating bond lengths, which is a rewrite, not a constant.

**Do not measure size across hydrogens — heavy atoms only.** An –OH rotamer is
arbitrary in any static model, so a size figure that depends on one measures the
builder, not the molecule. Macromolecule-lab's first "Å across" readout took the
widest pair over *all* atoms and put glucose at 8.3 Å against a real 6.45: the
widest pair was two hydroxyl *hydrogens*, because `Skel.outwardAt` splays every
free substituent away from the centroid at once and a real molecule's hydroxyls
never all point outward together.

If you add a page that must show a solvation molecule next to a derived one,
that is a new problem — solve it in `molecules.js`, not on the page.

### 1.6 Derive when shape carries the lesson; schematize when topology does

Both are legitimate, and the failure is doing one while claiming the other.

Real coordinates are right when the *shape* is the point — a chair ring, a
tetrahedral centre, a helix. They are **wrong** when the lesson is topology.
A phospholipid's real conformer is floppy and renders as spaghetti; the lesson is
"polar head, nonpolar tails", so build it schematically **on purpose** and say so
in the comment, exactly as the open-chain Fischer-projection intermediates in §1.2
(source 3, `Skel`) are deliberate. Bilayers and polymers additionally need
instancing rather than N built groups, and should be validated at the monomer,
not the assembly.

The declaration vocabulary is in §1.4; the unbuilt rows of its contrast table are
blocked on **extending it**, not on geometry. Nearest gap: **cis/trans is
unchecked** — bond order 2 renders, but nothing asserts an unsaturated fatty
acid's double bond is *cis*, and the kink is the whole reason that lesson exists.

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
  a cohesive network, not drift through each other. (Distances in `water-lab.html` are
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
- **Handedness: L, and asserted.** Life builds proteins from L-amino acids only;
  the D- mirror images exist but ribosomes don't use them. Each chiral residue
  declares `chirality:'L'` and `check-molecules.js` verifies the signed volume
  over CIP priorities. Glycine is the exception and declares nothing — its side
  chain is an H, so its α-carbon has two identical substituents and it is
  achiral, which is also why it is the most conformationally flexible residue.
- **Model simplifications (keep explicit):** residues are drawn in the **neutral**
  –NH₂/–COOH form, not the physiological **zwitterion** (–NH₃⁺/–COO⁻); this makes
  the "lose a water" bookkeeping legible but is a display choice. Each residue stays a
  separate group linked by a redrawn peptide stick — so a chain is N groups, not
  one merged molecule (no claim of a single rigid conformation).



## 11. Module architecture — share the plumbing, not the physics

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

## 12. Bonding builder (`molecule-builder.html`)

Five tabs, in three groups, because every comparison on this page is itself a
lesson: **water / methane** (the same rule at two slot counts, so methane reads as
*the rule generalises* rather than as a new fact), **ammonia → ammonium** (the bond
one atom pays for), and **salt / KCl** (the same transfer from two metals, so KCl
is the *control* showing the behaviour belongs to metal + nonmetal, not to sodium).

### What the mechanic asserts

- **A bond is an attraction, not a decision.** Atoms are dragged near and the last
  stretch is pulled by the core, not the mouse; releasing inside the capture radius
  still bonds. A click-to-place bench said "you may now place an atom here", which
  is a different claim.
- **Nuclei are solid.** An atom slides on the core's surface rather than entering
  it — which is also what makes a sloppy drop work, since anywhere on the face is
  within reach of a slot.
- **Geometry is lifted from `molecules.js`**, never re-derived: slot directions are
  the real ligand positions normalised, so a molecule the student *builds* is
  identical to the same molecule every other page *loads*. Angles as
  `check-molecules.js` reports them: H₂O **104.6°** (the spec's coordinates
  realise 104.57 against a 104.5 target), NH₃ **106.8°**, CH₄ and NH₄⁺
  **109.5°**. The notes rail quotes the textbook values — 104.5° and 107° — since
  those are what a student writes down; the difference is spec rounding, not a
  second claim.
- **Valence is enforced, never explained.** The slot count is the answer to "why
  H₂O and not H₃O" — and in the ammonia tab a further hydrogen is refused *as an
  atom* and accepted *as a proton*, which is the acid/base door.

### The 2D view is a projection, and says so

2D locks the camera straight on, cel-shades the atoms (Toon + inflated back-face
outline, the same convention as water-lab's Render mode) and swings out-of-plane
electrons into the plane so the octet can be counted. **It is a projection for
counting, not a claim about shape.** Water's lone pairs really do stick out of the
H–O–H plane and methane really is a tetrahedron, so:

- the flat layouts move only what would otherwise hide behind the core;
- bond angles and the underlying slot geometry are untouched;
- the notes and the teach text state the real angle (109.5°, not the 90° the flat
  cross draws), and 3D is one click away.

The 2D camera uses a **12° FOV pulled back** rather than an orthographic camera:
at 45° an off-centre atom is drawn skewed and a nearer one reads as *bigger* rather
than *nearer*, both lies in a view whose job is comparison. (A true
`OrthographicCamera` would mean swapping the camera object, and `fx.js` captures
its camera in a closure.)

### Model simplifications (keep explicit)

- **`polar` weights are stylised**, from electronegativity difference, not dipole
  moments (§2).
- **Ionic separations are roomier than any covalent bond** (Na–Cl 2.55 against
  radii summing to 1.94) so the eye reads a *space* between two ions rather than a
  join. Nothing is shared across that gap.
- **Stick view still draws a stick for the ion pair** — amber, the palette's ion
  colour, never covalent grey — because stick view is the schematic the rest of the
  project speaks and a student who switches to it should find a bond. The electron
  view has none, because there is no shared pair in that gap.
- **Each covalent lesson ships exactly as many ligands as it has slots.** The limit
  is shown by the open-slot counter and the ghost markers rather than tested by a
  refusal.

## 13. Macromolecule gallery (`macromolecule-lab.html`)

A **comparison** page, not a reaction page: `aminoacid-lab.html` already shows a
polymer being built one dehydration at a time, so this one covers the step
before — what the four monomer classes look like next to each other, and which
functional groups distinguish them. There is no simulation loop.

- **One monomer per class, and the protein monomer is `alanine`** — the spec
  already in the library, already asserted `chirality:'L'`. Nothing is
  duplicated for it; it just gained a `groups` map.
- **`groups` is an index contract** (§1.4, rule 4), the analogue of `pep` / `gly`:
  `{key, label, formula, atoms:[…], note}`. The page renders whatever the map
  says and knows no chemistry of its own, so a new functional group is a
  `molecules.js` edit. Regenerating a spec must not renumber it — an off-by-one
  here mislabels chemistry rather than crashing.
- **True relative size in compare mode.** Palmitic acid really is ~3× the span
  of alanine and nothing normalises it; the layout sizes each grid column from
  its own occupants instead.
- **Scale family B**, like every molecule on this page — see §1.5. This is the
  page that discovered the rule, by drawing a family-A glucose next to family-B
  monomers and labelling it "true relative size". If a fifth monomer is ever
  added here, it must be family B.
- **One glucose in the library, not two.** The carbohydrate monomer is the
  `glucose` that `glycolysis-lab.html` already builds with `Skel`; it gained
  `groups`, its C–H, and `optH` rather than being duplicated under a second key.
  A parallel PubChem-derived spec was the alternative and was dropped: both
  declare `stereo:'all-equatorial'`, which is the claim that actually gets
  asserted, so the second copy bought nothing but a name collision with
  `Object.assign(MOLECULES, GLYCOLYSIS)`.
- **Adding the C–H did not renumber anything.** They are grown last, after every
  hydroxyl, so `gly.cN` and the group indices are untouched — glycolysis-lab
  addresses those by position. That page hides them (`Stage.setOptionalH(g,false)`)
  and excludes them from its plate-height and camera-fit measurements, so its
  "no C–H anywhere" look is unchanged.
- **Derived where shape is the claim, schematic where topology is** (§1.6): AMP
  comes from a PubChem 3D record via `tools/sdf2spec-generic.js` — the furanose
  ring and the 2′-OH are the claims. Palmitic acid is built as an idealised
  all-anti zigzag **on purpose**: a real conformer is floppy and renders as
  spaghetti, while the lesson is "one small polar head on a long nonpolar tail".
- **The lipid is saturated, deliberately.** §1.6 still lists cis/trans as
  unchecked, and the *cis* kink is the entire point of the unsaturated
  contrast — so that molecule waits for a torsion assertion rather than shipping
  a double bond nothing verifies.
- **Lipids are named as the exception.** They are not polymers of a repeating
  monomer, and the side panel says so instead of quietly filing them next to the
  other three.
- **Model simplifications (keep explicit):** palmitic acid is drawn as the
  neutral acid (at cell pH it is the carboxylate, palmitate) so the –COOH head
  is legible, the same choice §10 makes for amino acids. AMP is drawn as the
  dianion the PubChem record supplies — accurate at cytosolic pH, and the same
  convention the glycolysis phosphates use.
