# 3D Molecule Visualization Guide (AP Biology)

A concise, reusable playbook for building accurate 3D molecular lessons (Three.js
or similar). For the deeper rationale and water-specific rules, see
[`water/SCIENCE.md`](water/SCIENCE.md).

**Golden rule:** accuracy lives in the **coordinates and forces**, not the
renderer. Compute real geometry; don't eyeball it.

---

## Quick checklist (every lesson)

- [ ] Correct **bond angles** and **shape** (see table).
- [ ] Correct **relative atom sizes** (bigger atom = larger radius).
- [ ] **CPK colors** (see table) so atoms are identifiable across lessons.
- [ ] Right **bond type**: covalent = solid stick (shared electrons); ionic =
      ions in a lattice, no sticks; H-bond = dashed connector, ~1/20 strength.
- [ ] Any **charges** (δ±, ionic ±) shown on the correct atoms.
- [ ] The **core concept is visible** and traces to structure (polarity, bonding,
      shape → function).
- [ ] **No sphere interpenetration** during animation.
- [ ] Readout **counts/labels match the geometry** (sanity-check them).
- [ ] Pedagogical exaggerations (enlarged bonds, extra spacing) **noted in code**.

## CPK color convention

| Atom | Color | Hex (approx) |
|------|-------|--------------|
| H | white | `#e9eef8` |
| C | dark grey/black | `#303030` |
| N | blue | `#3050f8` |
| O | red | `#ff4d4d` |
| P | orange | `#ff8000` |
| S | yellow | `#ffe14d` |
| Na⁺ | violet | `#b06bff` |
| Cl⁻ | green | `#5fd07a` |
| K⁺ | violet | `#8f40d4` |
| Ca²⁺ | dark green | `#3dd06a` |
| Mg²⁺ | green | `#2ee06a` |

Relative radii: cations are **smaller** than their neutral atoms, anions
**larger**. Keep Na⁺ noticeably smaller than Cl⁻.

## Geometry reference (common AP Bio species)

| Species | Shape | Angle | Notes |
|---------|-------|-------|-------|
| H₂O | bent | 104.5° | polar; δ− on O, δ+ on H |
| CO₂ | linear | 180° | nonpolar (dipoles cancel) |
| CH₄ / sp³ C | tetrahedral | 109.5° | baseline for organic carbons |
| NH₃ | trigonal pyramidal | ~107° | one lone pair; polar |
| C=C / sp² | trigonal planar | 120° | flat |
| NaCl | rock-salt lattice | 90° (octahedral) | ionic, 6-coordinate; **no molecules** |
| Glucose ring | chair (6-ring) | ~109.5° | pucker, don't draw flat |

---

## Bonding: pick the right model

**Covalent (molecules).** Atoms joined by shared-electron sticks. Build a molecule
group: place atoms at real bond lengths/angles, connect with cylinders. For
electron-level detail, show shared pairs (between atoms, shifted toward the more
electronegative atom) and lone pairs.

**Ionic (lattices, e.g. NaCl).** There is **no discrete NaCl molecule** — it's a
3D repeating lattice of alternating ions held by electrostatic attraction. Rules:
- Alternate cations/anions in a **checkerboard** (rock-salt = two interleaved FCC
  sublattices; each ion 6-coordinate octahedral).
- Size by **ionic radius** (Na⁺ small, Cl⁻ large), CPK-colored.
- Don't draw covalent sticks. If you show connectivity, use faint neutral lines or
  leave them implicit; the point is the **repeating charged lattice**, not bonds.
- For the "dissolving" story, water surrounds ions in **hydration shells**:
  δ− O toward cations, δ+ H toward anions.

**Hydrogen bonds.** Intermolecular attraction, δ+ H → δ− O/N lone pair. Dashed,
~1/20 covalent strength, strongest when nearly **linear**. One donor H → one bond.
Relevant well beyond water: **DNA base pairing** (A=T two H-bonds, G≡C three),
protein secondary structure, enzyme–substrate binding.

## Rendering recipe (Three.js)

- **Atom:** one shared unit `SphereGeometry`, per-atom scale = radius,
  `MeshStandardMaterial` (CPK color).
- **Covalent bond:** cylinder from A to B — orient with
  `quaternion.setFromUnitVectors(up, dir.normalize())`, scale length to `|B−A|`.
- **Dashed bond (H-bond/ionic hint):** **not** `THREE.Line` — WebGL ignores line
  width, so lines are invisible/occluded. Use a row of short cylinder segments;
  shared geo/material keeps it cheap to rebuild each frame.
- **Molecule as a group:** put the central atom at the group origin so world
  positions are easy; store references for later (charges, bonds, forces).
- **Orbit view:** spherical camera (drag = rotate, wheel = zoom) is enough; no
  heavy controls dependency needed.

## Optional physics (only when it teaches something)

If molecules move (bonding, dissolving, phase change):
- Model attractions as **forces toward an equilibrium distance**, with short-range
  **repulsion** as a hard core set **below** that equilibrium.
- **Damp velocities**; keep constants small; verify the sim doesn't explode
  (measure max velocity after settling).
- **Resolve collisions** so spheres never interpenetrate (position-based push-apart
  passes are simple and robust).

## Common pitfalls

- Drawing water linear or at 90°/120° (it's 104.5° bent).
- Showing a "NaCl molecule" — it's a lattice, not a molecule.
- Making ice look denser than liquid (it's **less** dense → floats).
- H-bonds as thin lines (invisible in WebGL) or as strong as covalent bonds.
- Symmetric electron cloud on a polar molecule (must shift to the electronegative
  atom).
- Readout numbers that don't match the geometry (collapsed/overlapping atoms
  inflate bond counts).
