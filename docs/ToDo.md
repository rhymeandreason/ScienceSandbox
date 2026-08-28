# ToDo

Open work and pending decisions. Started 2026-08-02.

Each item says what it is, why it's worth doing, and what would settle it. An
item leaves this file when it ships, or when a decision doc absorbs it.

**Rendering decisions are reconciled.** We draw proteins ourselves — Three.js +
`scene.js` + `kit/ribbon.js`; no third-party 3D viewer is used. Mol\* was
evaluated and not adopted (`viewer-compare/molstar-evaluation.md` holds the measurements);
ChemDoodle was deleted for its GPLv3, along with the pages that loaded it, so no
page here is GPL now. Both survive on the `chemdoodle-archive` branch.

Related docs: `docs/molecule-pipeline.md`, `docs/plan.md`. Item 4 below is
what survives of a curriculum-wide 3D/2D survey; the survey itself is gone, so
this is the summary, not a pointer to one.

---

## 1. 2D skeletal diagrams — spread them past `contrast-lab`

The library question is settled: SmilesDrawer for flat structures, `haworth.js`
for sugars. **Two measured traps before touching any of this:** RDKit's
`rootedAtAtom` silently returns the wrong anomer, and SmilesDrawer emits a
square `viewBox` regardless of the size requested. Evidence pages:
`docs/rdkit-vs-smilesdrawer.html`, `docs/smilesdrawer-greys.html`.

**One page out of nine has 2D.** Students are *assessed* in 2D — skeletal
diagrams are what the AP exam shows — and several pages want one:

| Page | 2D case |
|---|---|
| `macromolecule-lab` | Functional-group callouts are a 2D idiom. Specs already carry `smiles` |
| `aminoacid-lab` | R groups are learned flat; the peptide bond reads better in 2D |
| `glycolysis-lab` | Pathways are drawn 2D in every textbook. Would need a layout, not just depiction |
| `molecule-builder` | Possibly — a flat readout of what was just built |

Blocking work before any of those: most specs outside `mol-contrast.js` have no
`smiles` yet (3 in `mol-monomers.js`, 1 in `mol-glycolysis.js`). That is a
`spec2smiles.js` run, not authoring — but `check-molecules.js` guards the
committed string, so it is a real commit with real assertions.

**Linked 2D↔3D highlighting is unbuilt and is the pedagogically interesting
part** — hover an atom in one view, it lights in the other. Known limit:
SmilesDrawer has `drawAtomHighlight` and **no bond highlighting at all**;
RDKit takes atoms *and* bonds. If a lesson needs a highlighted *bond*, that is
the constraint that would force the renderer choice open again.

### Also open

**KaTeX + mhchem for chemical equations.** The highest-value, lowest-risk
addition on this list, and needed by `molecule-lab`'s carbonic-acid text
*today* — it currently fakes the notation in HTML. Nothing in the repo loads
KaTeX yet.

---

## 2. A real MD trajectory beside the baked fold

**Status:** sourced, blocked on a licence question. See `docs/external-data.md`.

The want is villin folding *as simulated*, shown next to `pdb/1VII.fold.bin`'s
constrained relaxation.

- **The canonical dataset is unusable.** DESRES's 300 μs HP35 run forbids
  redistribution *and* modification. Not a maybe — licence quoted in
  `docs/external-data.md`.
- **Usable candidate:** SimTK `foldvillin` (Ensign, Kasson & Pande 2007) —
  hundreds of Folding@home trajectories, unfolded → native, free download,
  **but no stated licence.** That question blocks everything else.
- **The science complicates the lesson, productively.** That paper's finding is
  that villin has no single folding pathway. `folding-lab`'s two-act story is a
  teaching approximation; this is the evidence of what it approximates. Better
  as an added act than as a replacement.

---

## 3. Open, undecided

- **A sketcher** — the student *draws* a molecule and it's checked. An assessment
  mode, not a display mode, and nothing in the repo does anything like it.
  Ketcher (Apache-2.0) is the strongest open one; OpenChemLib JS (BSD-3) is
  lighter. **A third-party editor is the wrong genre for us — the want is a
  custom `builder.js`.** Parked.
- **Coarse-grained rendering** — one bead per residue. The only way to keep
  *motion* above ~20k atoms. Not needed until a lesson demands it; ATP synthase
  is the one that would.
- **A checker for `tools/ses.js`** — nothing validates the surface mesh. The
  flood fill's failure mode (bubbles of surface inside buried pockets) reads as
  noise, not as a bug, so eyeballing won't catch it. MSMS computes SES
  analytically rather than on a grid — a genuinely independent method — so
  comparing volume/area/genus on 2HHB would settle it. Offline and one-time,
  like `check-handedness.js`. `freesasa` does area alone for much less setup.
  VMD wraps MSMS but is non-commercial, can't ship, no WASM build.
  *Its two old justifications are gone: `ses.js` is the mesh baker now, and
  `check-pdb.js` has been deleted along with `pdb.js`.*
- **A trajectory reader**, if item 2's licence clears — those are DCD files.
  VMD, mdtraj or MDAnalysis, offline. mdtraj has the least licence friction.

---

## 4. Future lessons, by rendering approach

From an AP Bio curriculum pass. Approaches:

- **A** — per-atom, our renderer. What every page does now. Ceiling ~20k atoms
- **B** — instanced repeat: one subunit + a rule, like `folding/actin.js`'s screw
- **C** — baked static mesh. Unlimited size, zero motion
- **D** — coarse-grained beads. Keeps motion above A's ceiling (see item 3)
- **E** — not structural: charts, geometry, simulation

| Unit | Lesson | Scale | Render |
|---|---|---|---|
| 2 | **Phospholipid bilayer** | ~10⁵ atoms | B |
| 2 | Aquaporin / Na⁺-K⁺ pump | ~10k | A |
| 2 | Surface-area : volume | — | E |
| 2 | **Cell-size ladder** | mixed | B + C |
| 3 | **ATP synthase** | ~50k | D |
| 3 | ETC complexes | ~30k ea. | A + B |
| 3 | Cristae / mitochondrion | organelle | C |
| 4 | GPCR + ligand | ~10k | A |
| 4 | Microtubule / spindle | ~10⁷ | B |
| 5 | Chromosome condensation | ladder | B + C |
| 6 | **DNA double helix** | ~500 | A |
| 6 | **Nucleosome** (1KX5) | ~25k | A, borderline |
| 6 | RNA polymerase | ~30k | A + C |
| 6 | **Ribosome** (4V6X) | ~150k | C |
| 7–8 | Evolution, ecology | — | E |

Ten of fifteen need **no new dependency**. B is the workhorse, because biology
at this scale is overwhelmingly *one subunit plus a rule* — the machinery
`folding/actin.js` already has generalizes further than it looks.

**Suggested build order:** DNA helix (small, overdue, unlocks Unit 6) →
membrane (highest payoff, proves B at scale) → transport proteins (drop into the
membrane) → ATP synthase (forces D) → ribosome (forces the C decision, by which
point the requirements are known).
