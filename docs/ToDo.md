# ToDo

Open work and pending decisions. Started 2026-08-02.

Each item says what it is, why it's worth doing, and what would settle it. An
item leaves this file when it ships, or when a decision doc absorbs it.

**Rendering decisions live in two places, and they do not currently agree.**
`demos/RenderingLibraries.md` covers PDB-scale viewers and picks ChemDoodle as
default; `docs/chemistry-rendering-libraries.md` covers all three formats (2D,
3D, equations) and routes macromolecules to 3Dmol. Read both before concluding
anything, and see item 2 — reconciling them is itself open work.

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

## 2. Evaluate Mol\* — and revisit the ChemDoodle decision

**Status:** proposed. `RenderingLibraries.md` was decided 2026-08-01 and never
considered Mol\*.

**There are two conflicting recommendations on record.**
`demos/RenderingLibraries.md` makes ChemDoodle the default with 3Dmol as the
exception; `docs/chemistry-rendering-libraries.md` routes 3D macromolecules to
3Dmol on its own page and keeps Three.js for everything small. `protein-lab.html`
loads both 3Dmol and ChemDoodle today. Whatever Mol\* evaluation happens should
resolve all three into one answer rather than adding a fourth.

Add Mol\* as a third column in `viewer-compare.html` **before deleting that
page**. It plausibly beats ChemDoodle at what `protein-lab` actually does:

- Levels 1–3 are one molecule restyled — representations-over-one-structure is
  Mol\*'s central abstraction, so switching is a state update, not a reload
- Distinguishes 3-10 helices natively — `RenderingLibraries.md` line 31 records
  that ChemDoodle *cannot*, and `pdb.js` hand-parses `HELIX` class columns to
  work around it
- Has molecular surfaces, which ChemDoodle has no renderer for at all (line 53)
- Draws non-covalent interactions, so tertiary structure can be *shown* holding
  the fold rather than asserted

**It also closes a door the doc calls one-way.** Mol\* is MIT. Adopting it would
let `protein-lab` stop being GPLv3 and drop the vendored-ChemDoodle burden (no
npm, no CDN — lines 89–93). Exactly one page is affected today. That number only
grows.

**Test hardest:** 1AON (GroEL/GroES, ~58k atoms) on a Chromebook — line 97's
admitted untested case. Mol\* is the only candidate designed for that scale, so
it's where the answer could change the plan.

**Not affected:** `folding-lab` stays ours — but for a narrower reason than
"Mol\* can't move things." **It can**: it plays MD trajectories, and its
villin-md demo does exactly that
(`molstar.org/demos/states/villin-md.molx`). What it gives is a scrubber, not a
narration — no cued H-bond dashes, no two named causes, no zoom-out ladder. The
Three.js pages are likewise unaffected; they are hand-built specs at molecular
scale.

Measured on that demo, on a developer machine: **cartoon 59 ms, Gaussian surface
2.615 s.** Surfaces stay expensive — Mol\* does not answer
`RenderingLibraries.md`'s Chromebook question, it just re-poses it.

**One footgun if adopted:** Mol\* ships a one-click *Wiggle → Uncertainty*
animation, which presents confidence as motion — precisely what `villin.js`'s
header argues must never be done, and why act 3 uses eight discrete
arrangements. The reasoning still holds; adopting Mol\* puts the wrong choice
one button away.

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
