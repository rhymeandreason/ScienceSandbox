# Scientific Accuracy Rules — Water Visualization

Rules and decisions that keep `water.html` scientifically honest. When adding or
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
  crystal/lattice/geometry claim.
- Keep pedagogical exaggerations (enlarged bonds, spacing for legibility)
  **explicit in comments** so they aren't mistaken for to-scale facts.

---

*Library note:* `water.html` uses Three.js. ChemDoodle was considered; it would
only add value for **loading external crystallographic files** (`.cif`/`.pdb`).
For everything here, correctness came from computing the coordinates/forces
ourselves, which any renderer can draw.
