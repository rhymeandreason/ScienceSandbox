# ToDo

Open work and pending decisions. Started 2026-08-02.

Each item says what it is, why it's worth doing, and what would settle it. An
item leaves this file when it ships, or when a decision doc absorbs it.

**Rendering decisions are reconciled — `demos/RenderingLibraries.md` is the
answer.** We draw proteins ourselves; no third-party 3D viewer is used, and
ChemDoodle has been deleted from the repo along with the two pages that loaded
it. `docs/chemistry-rendering-libraries.md` predates that and still routes
macromolecules to 3Dmol; where the two disagree, `RenderingLibraries.md` wins.
Item 2 records how it was settled.

Related docs: `docs/molecule-pipeline.md`, `docs/plan.md`,
`docs/bio-rendering-thorough.md` (the curriculum-wide 3D/2D survey this file's
item 4 summarizes).

---

## 1. 2D skeletal diagrams — spread them past `contrast-lab`

**Status: the library question is settled and shipped.** `contrast-lab.html`
loads SmilesDrawer 2.4.1 (line 118) and draws a flat structure under every
non-sugar model, from the `smiles` string `tools/spec2smiles.js` generates.
Sugars go through `haworth.js` instead, because no general depiction library
draws a Haworth projection and a flat wedge/hash ring is useless for exactly the
pairs that page exists to teach.

**Read `docs/chemistry-rendering-libraries.md` before touching any of this.** It
has the decision, the evidence pages (`docs/rdkit-vs-smilesdrawer.html`,
`docs/smilesdrawer-greys.html`), and two measured traps: RDKit's `rootedAtAtom`
silently returns the wrong anomer, and SmilesDrawer emits a square `viewBox`
regardless of the size requested.

### What is actually open

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

### Also still open from that doc

**KaTeX + mhchem for chemical equations.** Recommended there as the
highest-value, lowest-risk addition, and needed by `molecule-lab`'s
carbonic-acid text *today* — it currently fakes the notation in HTML. Nothing in
the repo loads KaTeX yet. Cheapest real win on this list.

---

## 2. ~~Evaluate Mol\* — and revisit the ChemDoodle decision~~ — SETTLED

**Status:** done, and absorbed by `demos/RenderingLibraries.md` — read that,
not this. Mol\* was evaluated over six stages (`demos/molstar/README.md` holds
the measurements) and **not adopted**: we draw proteins ourselves, with
Three.js + `scene.js` + `folding/ribbon.js`.

**ChemDoodle is gone.** It was GPLv3, and that licence applied to any page
loading it. `demos/vendor/chemdoodle/`, `protein-lab.html` and
`viewer-compare.html` were deleted together, so **no page in this repo is GPL
now**. All three survive on the local `chemdoodle-archive` branch. This also
resolves the disagreement flagged at the top of this file: neither ChemDoodle
nor 3Dmol is the default, because there is no third-party 3D viewer at all.

**What is still open** is the one thing that is not a decision:
`protein-lab.html` needs rewriting on our own renderer, and until it lands that
lesson is absent. `demos/molstar/protein-inhouse.html` is the template and most
of the proof — it already draws a whole tetramer with our DSSP, our palette and
our haems. `demos/pdb.js` and `demos/pdb/` are kept for it.

**One thing worth carrying forward** from the Mol\* evaluation: it ships a
one-click *Wiggle → Uncertainty* animation, which presents confidence as
motion — precisely what `villin.js`'s header argues must never be done, and why
act 3 uses eight discrete arrangements. Not our problem now, but the reasoning
is general.

---

## 2b. A real MD trajectory beside the baked fold

**Status:** sourced, blocked on a licence question. See `docs/external-data.md`.

Since Mol\* plays trajectories, the renderer is no longer the obstacle to
showing villin folding *as simulated* next to `pdb/1VII.fold.bin`'s constrained
relaxation.

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
  lighter. **`docs/chemistry-rendering-libraries.md` already argues the editor is
  the wrong genre for us and wants a custom `builder.js`** — read that section
  before reopening this. Parked.
- **Coarse-grained rendering** — one bead per residue. The only way to keep
  *motion* above ~20k atoms. Not needed until a lesson demands it; ATP synthase
  is the one that would.
- **VMD** — non-commercial licence, can't ship, no WASM build. Possibly useful
  offline as a mesh baker (`tools/bake-*.js` pattern) or to independently
  cross-check `tools/check-pdb.js`'s numbers. Not a dependency; revisit only if a
  ribosome- or chromatin-scale lesson is actually built.

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
