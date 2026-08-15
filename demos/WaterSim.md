# Water Sim

Applies to the solvation apps only (`water-lab.html`, `molecule-lab.html`).

## 1. Hydrogen bonds

- An H-bond is **intermolecular**: a **δ+ H of one molecule** to a **δ− O lone
  pair of another**. Never within a molecule, never H–H or O–O.
- **~1/20 the strength of a covalent bond.** State the ratio; don't draw the two
  alike. Convention here: covalent = solid stick, H-bond = **dashed** teal.
- **Directional** — strongest when O–H···O is near linear. Detection and forces
  weight by alignment (dot of the O–H and H···O directions); bent geometries are
  weaker or rejected.
- **One donor H → at most one H-bond** (best-aligned nearest acceptor in range),
  so counts stay physical. A real water takes up to 4 total: 2 donated, 2
  accepted.
- **It's an attractive force.** A formed bond must actually *pull* toward an
  equilibrium O···O distance, floored by short-range steric repulsion — molecules
  latch into a network rather than drifting through each other. Distances in
  `water-lab.html` are scene units, not ångströms; the *behavior* is what has to
  be right: attract when far, repel when close, settle at equilibrium.

## 2. Ice

- Freezing produces the **real hexagonal ice (Iₕ) lattice**, from crystallography,
  not a decorative grid: each O **tetrahedrally bonded to four others**; puckered
  hexagonal bilayers, **ABAB**-stacked (not cubic ABCABC); **one H bridges every
  O···O** (ice rules — each O donates 2, accepts 2); real O···O ≈ 2.76 Å.
- **Ice is less dense than liquid → it floats.** The frozen state must visibly
  occupy more volume than the liquid. That's the whole lesson — never let ice
  look denser.
- No atom overlap during freeze/melt (§4).

## 3. Emergent properties must trace back to H-bonding

- **Cohesion / surface tension** — H-bonds pull molecules together.
- **Adhesion / capillary action** — narrower tube → higher rise.
- **High specific heat / heat of vaporization** — added heat first **breaks
  H-bonds** before molecules speed up or escape. Evaporation happens at high
  energy, not low.
- **Solvent** — water surrounds ions in **hydration shells**, δ− O facing cations
  (Na⁺), δ+ H facing anions (Cl⁻). Orientation must be correct.

## 4. Simulation integrity

- **No interpenetration.** Atom spheres must not visibly overlap. Use
  position-based collision resolution, or a repulsion force with a floor below
  any attractive equilibrium.
- **Stable integration.** Damp velocities, keep force constants low enough not to
  explode, and sanity-check max velocity after settling.
- **Equilibrium first.** With attraction and repulsion on the same pair, put the
  steric floor *below* the attractive equilibrium so bonded pairs rest at the
  intended distance instead of the forces fighting.
- **Counts must be believable.** Verify any readout against the geometry — an
  8-molecule cluster showing 100+ H-bonds is a bug. It was: the molecules had
  collapsed with no repulsion.
