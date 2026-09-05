<!-- KIND: rulebook — load whole before adding a molecule, changing geometry, or changing what a motion implies happened. -->

# Scientific Accuracy Rules

The rulebook for every page. §§2–3 are chemistry (polarity, covalent bonding);
§§4–5 are per-page. Water/solvation physics lives in `WaterSim.md` (solvation
apps only). Module architecture — what's shared and what stays local — lives
in `Modules.md`.

**Read `MolecularGeometry.md` §1.1–§1.6 before adding or converting any molecule
spec** — angles, bond lengths, geometry sources, stereochemistry. It moved out
for length, not because it's optional. Check these rules before shipping a new
molecule, a geometry change, or a motion that implies a bond formed/broke or a
charge moved; polish on an already-reviewed animation (timing, easing, camera)
doesn't need it.

> **Accuracy comes from the coordinates and the forces, not from the rendering
> library.** A pretty render of wrong geometry is still wrong. Compute real
> positions and interactions rather than eyeballing them.

---

## 2. Polarity & charge

- Oxygen is **more electronegative** → it carries **δ−**; each hydrogen **δ+**.
- The **dipole points toward oxygen**, and the electron cloud is drawn **shifted
  toward O**, never symmetric.
- `molecule-builder.html` draws this three ways from one per-recipe `polar`
  weight — a stylised electronegativity difference, **not** a dipole moment (O–H
  1.24 → `1`, N–H 0.84 → `0.7`, C–H 0.35 → `0`): the shared pair sits **off-centre
  toward the core**, each atom gets a **δ−/δ+ badge**, and the ligand's cloud
  **leans back** along its bond. The offset stays small on purpose — pushed far
  enough to bury the pair in the core, it reads as *transferred*, i.e. ionic.
- **Methane is the control.** `polar: 0` means centred pairs and no badges, so
  "shared" in the water tab and "shared" in the methane tab are visibly not the
  same word.

## 3. Electrons & covalent bonding

- A **covalent bond = a shared pair**, one electron from each atom. Draw it as a
  pair, not a dot or a plain stick, when the lesson is about electrons.
- Oxygen has **two bonding pairs and two lone pairs** (4 domains,
  tetrahedral-ish). Show both lone pairs whenever O's electrons are depicted.
- Bonding pairs sit **closer to O**, consistent with the δ−/δ+ story.
- **Double bonds are two sticks, never one.** A bond entry's optional third
  element is the bond order, so `[i,j,2]` renders as a pair of thinner cylinders.
  Every C=O in the library is tagged: CO₂, carbonic acid, bicarbonate, the
  amino-acid carboxyls, the glycolysis carbonyls.
- **Splay direction matters.** With a neighbouring bond, the offset comes from
  the plane those two bonds define so both sticks read head-on. A **linear**
  molecule (CO₂) has no such plane, so the fallback offsets *across* the view —
  otherwise one stick hides behind the other and a double bond reads as single.
- **An electron wears its own atom's colour** (`molecule-builder.html`), so a
  shared pair is **one dot of each colour** and ownership needs no legend. Cost:
  a red dot lands on a red sphere, so every dot carries an ink ring — without it
  the shared pair vanishes into the oxygen exactly when it matters.
- **A LONE PAIR IS THE EXCEPTION** (`lobes/lobes.js`): one blue for every
  element, greyed when conjugated. A dot's colour answers *whose electron this
  is* — the point of a shared pair being one of each. A lobe is not asking that;
  it is asking *can a donor point here*, so it wears the H-bond's colour
  instead. Tinting by element would also put red ears on water and blue ones on
  adenine, which is the **orbital phase convention**, and the sign a student
  would infer is backwards — a lone pair is the δ− end. The hexes and the
  reason they are two keys live in `palette.js`.
- **A dative bond is two dots of the DONOR's colour.** In NH₃ + H⁺ → NH₄⁺ nitrogen
  supplies both electrons, so there's no second colour; the proton is drawn with
  **no dot at all** and a `+`, because that's what a proton is. Once formed the
  four N–H bonds are identical and the ion carries a **whole +1** — every δ badge
  comes off, since four δ+ would assert partial charges that sum to one.
- **P=O stays a single stick.** Phosphate's charge is delocalised over the
  oxygens; doubling one asserts a localisation that isn't there. Same reasoning
  as drawing bicarbonate's two bare O's identically.

## 4. Rendering caveats

- **WebGL ignores line width** — thin `THREE.Line` H-bonds are invisible and get
  occluded. Bonds that must be *seen* are thin cylinders.
- Prefer **real computed coordinates** for any crystal/lattice/geometry claim.
  Where a record exists, convert it (`tools/sdf2spec.js`) — the amino acids
  carried impossible bond angles for as long as they were hand-written.
- Keep pedagogical exaggerations (enlarged bonds, spacing for legibility)
  **explicit in comments** so they aren't read as to-scale facts.
- **Mixed conventions are fine, but label them.** The amino acids are real 3D
  conformers; the water/solute and glycolysis specs are hand-built, flat (z=0),
  united-atom methyls. Don't infer a spec's style from its neighbours — read the
  comment above it.
- A stick only shows if the bond is **longer than the two display radii
  combined**. A rendering constraint, not chemistry, and why lengths get scaled
  up. `check-molecules.js` is the guard.

---

## 5. Reaction & event animation (`fx.js`)

Every "something happened" moment gets a transient effect from the shared
`fx.js`, so every page looks the same. One instance per page, bound to its scene:

```js
const FXi = FX.create(THREE, root, camera);   // root: group the molecules live in
FXi.spawnRing(pos, color);  FXi.popGlow(g, color);  …
FXi.step();                                    // once per frame, in loop()
```

Effects step off a wall-clock delta (frame-rate independent) and are **purely
cosmetic** — never feeding back into physics, H-bond counts or pH. `popGlow`
scales *relative* to the target's current scale, so it works on a molecule Group
(rest scale 1) and a bare ion mesh (rest scale = its radius) alike.

**Intensity tracks the chemistry.** Bonds breaking or forming get the full
shockwave-and-sparks; **hydration** (no bonds broken, identity unchanged) gets a
soft shimmer; a solute where **nothing happens** stays silent. Never dramatize a
non-event — an animation on plain dissolving implies a reaction that didn't
occur, and methane's silence is itself the lesson about nonpolar solutes.

<!-- ENUM: update when an fx.js primitive is added or removed. -->
| Function | What it draws | Used for |
|---|---|---|
| `spawnRing(pos,color)` | white core flash + double additive shockwave ring + 16-spark burst | bond break/form events |
| `popGlow(g,color)` | emissive flash (2.2×) + springy scale overshoot on a molecule's atoms | a molecule freshly formed / an ion tearing free |
| `settleShimmer(g,color)` | soft emissive breathe in-and-out, **no** scale/ring/sparks | a polar solute locking into its hydration shell |
| `protonHop(from,to,onArrive,opt)` | glowing proton arcing between points with a fading comet trail | the H⁺ transfer of an acid ionization. `opt` is optional: `{color}` where a hop must not read as the effect firing beside it, `{dur}` in seconds, `{away}` for a proton a reaction **displaces** — snaps off the bond, then drifts and fades instead of landing |
| `colorOf(g)` | reads a molecule's first **atom** colour (skips covalent-bond meshes) | tinting an effect to whatever it decorates |

### Per-molecule event → effect → colour

Atom colours are the single source of truth in `molecules.js`
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

### Bonding builder (`molecule-builder.html`)

Each **bond type finishes in its own visual language**, because the page exists
to say they are different kinds of event; recolouring one effect for all three
would say the opposite. Every effect fires at a position the module **asks for**
(the anchor atom, the landing point), never at the world origin.

| Bond formed | Event | Effect(s) | Colour(s) |
|---|---|---|---|
| **Covalent** (H₂O, CH₄, NH₃) | the last slot fills | `spawnRing` from the **core atom**, expanding through the molecule — the bond is a thing the whole molecule now has | covalent stone `#b3a892` |
| **Dative** (NH₃ + H⁺ → NH₄⁺) | the proton lands in the lone pair | `spawnRing` from the **donor**, in the **donor's own colour** (it did not come from both atoms) + the donor pair swells 1.34× and settles + amber `settleShimmer` on the new ion | N blue `#3f6ae0`; shimmer amber `#ffc24d` |
| **Ionic** (NaCl, KCl) | the electron lands on the nonmetal | **no ring** — `spawnCore` white flash + `spawnBurst` at the **arrival point on the shell**: one electron arrived at one place, the molecule did not acquire something | white `#ffffff` + the nonmetal's colour |

- The **completion ring fires once per molecule**, re-armed when the lesson
  reports incomplete — rebuilding earns it again, a repeated finished state
  doesn't.
- The **electron's flight** carries the ionic story: sodium's dot detaches, arcs
  over 0.55 s, lands **green**. An electron wears its owner's colour, so changing
  colour mid-flight *is* the sentence "it changed owner". Counts flip at
  transfer, not arrival — the callback only runs while the frame loop does, and a
  backgrounded tab must not leave the readout stale.
- The **dative flare is deliberately small** (1.34×). A ballooning dot stops
  reading as an electron; the whole claim is that these are the *same two
  electrons* throughout.

### Dehydration synthesis has ONE effect, everywhere

<!-- ENUM: every page that condenses calls this; nothing else may. -->
A peptide bond, a glycosidic bond and a phosphoester are **the same reaction on
different groups**: two halves give up an –OH and an –H, a water leaves, and a
bond closes where they were. So they get one effect and one colour, and a page
that invents its own flare for a condensation is teaching, in the language a
student reads fastest, that these are three different kinds of chemistry.

`fx.condense(bondAt, waterAt, opt)` is the only implementation. It fires in two
places because the reaction happens in two: a full `spawnRing` **at the new
bond's midpoint** in flare violet `#8a2be2`, plus a small white core and
**oxygen-red** burst where the water goes. It does not draw the water; that is a molecule, and the page
owns it.

The midpoint matters. A flare at a molecule's transform origin lands in the
middle of a ring system and says "something happened somewhere" — the failure
`dna-lab` step 1 had already fixed for hydrogen bonds.

Its rings are also the one effect in `fx.js` that is **painted rather than
added**. Every other flare is a bright colour, and additive blending is right
for those; violet is darker than the paper, and adding it to cream gives a pale
pink smudge however saturated it is. The white core stays additive, because
painting a white disc over a molecule punches a hole in it.

`opt.color` exists only for a page saying *this particular one is not a
condensation*. `opt.size` is the ångström scaling every `fx` primitive takes.

### Colour language

- **Cool blue** (`#7cc4ff` / `#bfe4ff`) — a **water-driven** step.
- **Warm amber** (`#ffc24d` / `#ffd98a` / `#ffe08a`) — **acid / proton**
  chemistry; echoes the ion–dipole bond colour and the falling-pH story.
- **Ion palette** (violet / blue / green) — each ion flares in its own identity
  colour so cation and anion read as distinct.
- **Water-blue** (`#9fd4ff`) — the **hydration shell closing in**; a water
  colour, not the solute's, because the solute is unchanged.
- **Violet** (`#6a5acd` the bond, `#8a2be2` the flare) — **dehydration
  synthesis**, whichever groups it joined. Two numbers for one idea because the
  effects blend additively on cream: adding a violet that carries green
  (`#6a5acd`, g=`0x5a`) lands as a pale pink smudge, so the flare uses the same
  hue with the green taken out. `PALETTE.bonds.condense` is the stick; the flare
  constant lives in `fx.js` beside `PROTON_GOLD`, like every other ring colour.
- **White core flash** (`#ffffff`) — shared by all `spawnRing` events, the
  white-hot instant before the coloured rings.

### Where each is wired

- Dissociation — `checkDissociation()`, in **both** `water-lab.html` and
  `molecule-lab.html`.
- CO₂ chain — `updateReactions()` (step 1 hydration, step 2 ionization),
  `molecule-lab.html`.
- Solute settle — `updateSolutes()` when descent ends and the hydration toast
  fires (gated to `class === 'polar'`), `molecule-lab.html`.
- Dehydration synthesis — `fx.condense()`, called by `tests/aminoacid-lab.html`
  (the peptide bond) and by `dna-lab.html` step 2 (the glycosidic bond and the
  phosphoester). `aminoacid-lab` adds `popGlow` on both residues; `dna-lab`
  deliberately does not, because its nucleotide is hydrogen-bonded to a partner
  four ångströms away and a 1.7× punch swells one straight through the other.

New pages: add `<script src="fx.js">`, `FX.create(THREE, root, camera)` once,
`FXi.step()` in the loop, then call the primitives at your own event sites.
