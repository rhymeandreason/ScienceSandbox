# Lessons roadmap

What to build next, and why that order. Status vocabulary is `CLAUDE.md`'s
(featured lesson / prototype / reference / test).

## The thesis

**Fidelity, unified on one page.** An interactive 3D model beats a static
diagram, but that is not the main claim. The main claim is that Bio 101's
diagrams *disagree with each other*, and a student can't tell whether two
pictures of the same thing are two conventions or two objects. A page here earns
its place by putting them on one screen as one object.

Existing pages are that argument already:

- `contrast-lab` — six pairs textbooks draw as if identical
- `molecule-viewer` — a 3D model and a skeletal diagram shown to be the same atoms
- `hemoglobin-lab` — four levels of protein structure that are always four figures
- `glycolysis-lab` — ATP as a real molecule losing a real γ phosphate, not a coin

Hemoglobin got the teacher response, and it's the page that refused hardest to
split its subject up. That's the selection rule.

**Pedagogy retrofits are a later tier.** Quizzes, predict-before-you-see,
scored interaction — real, and deliberately not now. Visualization first.

## Evidence: the threshold-concepts matrix

Ross, Taylor, Hughes, Whitaker, Lutze-Mann & Tzioumis (2010), *Threshold
concepts: challenging the way we think, teach and learn in biology and science*,
UniServe Science Conf. p.134 — 58 novice students, 11 expert academics, 55
academics surveyed internationally. Follow-on slides: *Using threshold concepts
to design a first year biology curriculum* (same team), which crosses the matrix
with four practicals.

Their finding: biology's hard parts are not the troublesome *content* but the
discipline's tacit understandings, rarely taught explicitly. Matrix rows —
energy transformation · SA:V · variation · probability · uncertainty ·
proportional reasoning · predictive reasoning · hypothesis testing · randomness ·
subcellular↔macroscopic · scale · integrated systems · equilibrium.

Useful here as corroboration, not as the build order — it ranks by *concept
coverage*, this roadmap ranks by *diagram conflict*. Where they disagree, the
thesis wins (that's why SA:V dropped, below).

| Matrix row | Covered by |
| --- | --- |
| subcellular ↔ macroscopic, scale | `macromolecule-lab`, `molecule-viewer` |
| energy transformation | `glycolysis-lab`, and `coupling/` |
| dynamic equilibrium, probability, randomness | the mass-action modal, and `diffusion/` |
| integrated systems (structure→function) | `hemoglobin-lab` |
| proportional reasoning | `diffusion/` (√t, and D against size) |
| SA:V, variation, uncertainty, hypothesis testing | nothing |

## Textbook coverage

Chapter numbers are OpenStax *Biology 2e*, TRU/BCcampus edition
(<https://bccampusbiology.pressbooks.tru.ca>) — the same book `docs/Biology-2e-Concepts.md`
indexes. Numbers are that edition's flat 1–255 chapter numbering, not OpenStax's
§x.y.

| Page | Status | Chapters |
| --- | --- | --- |
| `molecule-builder` | featured | [5 Atoms, Isotopes, Ions, and Molecules](https://bccampusbiology.pressbooks.tru.ca/chapter/atoms-isotopes-ions-and-molecules-the-building-blocks/) |
| `water-lab` | featured | [6 Water](https://bccampusbiology.pressbooks.tru.ca/chapter/water/) · [5](https://bccampusbiology.pressbooks.tru.ca/chapter/atoms-isotopes-ions-and-molecules-the-building-blocks/) (ionic bonds, dissolving) |
| `macromolecule-lab` | prototype | [7 Carbon](https://bccampusbiology.pressbooks.tru.ca/chapter/carbon/) · [9 Synthesis of Biological Macromolecules](https://bccampusbiology.pressbooks.tru.ca/chapter/synthesis-of-biological-macromolecules/) |
| `contrast-lab` | prototype | [10 Carbohydrates](https://bccampusbiology.pressbooks.tru.ca/chapter/carbohydrates/) · [11 Lipids](https://bccampusbiology.pressbooks.tru.ca/chapter/lipids/) · [13 Nucleic Acids](https://bccampusbiology.pressbooks.tru.ca/chapter/nucleic-acids/) |
| `aminoacid-lab` | prototype | [9 Synthesis](https://bccampusbiology.pressbooks.tru.ca/chapter/synthesis-of-biological-macromolecules/) (dehydration) · [12 Proteins](https://bccampusbiology.pressbooks.tru.ca/chapter/proteins/) |
| `hemoglobin-lab` | featured | [12 Proteins](https://bccampusbiology.pressbooks.tru.ca/chapter/proteins/) (all four levels) |
| `molecule-viewer` | prototype | [30 ATP](https://bccampusbiology.pressbooks.tru.ca/chapter/atp-adenosine-triphosphate/) · [33 Energy in Living Systems](https://bccampusbiology.pressbooks.tru.ca/chapter/energy-in-living-systems/) (NADH) |
| `molecule-lab` | prototype | [6 Water](https://bccampusbiology.pressbooks.tru.ca/chapter/water/) · [5](https://bccampusbiology.pressbooks.tru.ca/chapter/atoms-isotopes-ions-and-molecules-the-building-blocks/) (CO₂ → carbonic acid, pH) |
| `glycolysis-lab` | featured | **[34 Glycolysis](https://bccampusbiology.pressbooks.tru.ca/chapter/glycolysis/)** · [33 Energy in Living Systems](https://bccampusbiology.pressbooks.tru.ca/chapter/energy-in-living-systems/) · [39 Regulation of Cellular Respiration](https://bccampusbiology.pressbooks.tru.ca/chapter/regulation-of-cellular-respiration/) (PFK-1) |
| ↳ mass-action modal | — | [27 Energy and Metabolism](https://bccampusbiology.pressbooks.tru.ca/chapter/energy-and-metabolism/) · [29 The Laws of Thermodynamics](https://bccampusbiology.pressbooks.tru.ca/chapter/the-laws-of-thermodynamics/) |
| **1. Enzymes** | planned | **[31 Enzymes](https://bccampusbiology.pressbooks.tru.ca/chapter/enzymes/)** · [28 Potential, Kinetic, Free, and Activation Energy](https://bccampusbiology.pressbooks.tru.ca/chapter/potential-kinetic-free-and-activation-energy/) |
| **2. Membrane + osmosis** | planned | **[22 Components and Structure](https://bccampusbiology.pressbooks.tru.ca/chapter/components-and-structure/)** · [23 Passive Transport](https://bccampusbiology.pressbooks.tru.ca/chapter/passive-transport/) · [11 Lipids](https://bccampusbiology.pressbooks.tru.ca/chapter/lipids/) · [215 Osmoregulation and Osmotic Balance](https://bccampusbiology.pressbooks.tru.ca/chapter/osmoregulation-and-osmotic-balance/) |
| **3. Nucleic acids / DNA** | planned | **[67 DNA Structure and Sequencing](https://bccampusbiology.pressbooks.tru.ca/chapter/dna-structure-and-sequencing/)** · [13 Nucleic Acids](https://bccampusbiology.pressbooks.tru.ca/chapter/nucleic-acids/) |
| *tier after* — photosynthesis | — | [41 Overview](https://bccampusbiology.pressbooks.tru.ca/chapter/overview-of-photosynthesis/) · [42 Light-Dependent Reactions](https://bccampusbiology.pressbooks.tru.ca/chapter/the-light-dependent-reactions-of-photosynthesis/) · [43 Using Light Energy](https://bccampusbiology.pressbooks.tru.ca/chapter/using-light-energy-to-make-organic-molecules/) |
| *tier after* — ETC / chemiosmosis | — | [36 Oxidative Phosphorylation](https://bccampusbiology.pressbooks.tru.ca/chapter/oxidative-phosphorylation/) |
| *dropped* — SA:V | — | [15 Studying Cells](https://bccampusbiology.pressbooks.tru.ca/chapter/studying-cells/) · [17 Eukaryotic Cells](https://bccampusbiology.pressbooks.tru.ca/chapter/eukaryotic-cells/) |

**What the shape shows.** The repo owns Parts II–III (chemistry and
macromolecules) nearly end to end, and touches Part VII at exactly one chapter.
Part V (**plasma membranes**, ch. 21–25) and Part XIV (**DNA**, ch. 65–71) have
no page at all — the two structural holes §2 and §3 exist to fill. Part VI
(metabolism, ch. 26–31) is half-covered: ATP and the thermodynamics are drawn,
enzymes are not, which is §1.

Nothing here proposes covering the book. Chapters 44+ are cells, genetics,
evolution and organismal biology — different subject matter at a different scale,
and out of scope for a molecular-visualization repo.

## Build order

### 0. Finish `glycolysis-lab`

Half-built and the beefiest thing here. Nothing below starts first.

Its central claim is worth stating plainly, because it *is* the thesis: glycolysis
is the worst-drawn pathway in Bio 101 — linear in one book and circular in the
next, structures then boxes, ATP as a blob, a coin, a lightning bolt. Drawing ATP
as a molecule whose γ phosphate the student clicks off is the fix, not a flourish.

### 1. Enzymes

**The conflict.** Two incompatible drawings that are never reconciled: the
lock-and-key / induced-fit cartoon, and the energy-barrier curve. No figure shows
them as one event — that the shape change *is* what lowers the barrier.

**Why first.** Adjacent to glycolysis, not a detour: PFK-1 is already named the
committed step, and the mass-action demo already simulates barrier crossing with
`ea` forward and `ea + ΔE` back. The page makes that claim cashable — lower the
barrier, watch the rate move while ΔE does not. Cheapest strong page on the list;
reuses physics that is already written and already asserted
(`massaction/check-massaction.js`).

**Step one is done.** The model is out of `glycolysis-lab.html` and in
`massaction/` — module, CSS, checker and a test bench that already mounts the
slider path this page needs. A module, not an iframe-embedded page: the modal
chrome already works, and a frame would re-pay `sandbox.css` and cut the sim off
from the step's own ΔE. What remains for this lesson is the page itself:
`MassAction.create({ea:{min,max,value}})` beside the lock-and-key / induced-fit
picture, so the shape change and the barrier are one event. Panel B of
`massaction/massaction-test.html` is that interaction standing alone, and
check-massaction.js §8 already asserts the claim it rests on — lowering `ea`
speeds both directions and moves the equilibrium not at all.

Matrix rows: energy transformation, probability, equilibrium.

### 2. The membrane (osmosis inside it)

**The conflict.** The bilayer as two rows of lollipops, at a geometry and scale
that are simply false, proteins drawn as beans wedged in. Separately, water
movement is drawn three contradictory ways — arrows both directions, arrows one
direction, "water moves toward solute" as if pulled.

**Why.** Nothing in the repo has a membrane, and a student who has seen
`water-lab` already knows why phosphate heads face water and tails don't — no
textbook figure connects those two pictures. Watching molecules cross both ways
while the *net* is what changes settles osmosis visually, with no quiz needed.

Standalone osmosis is **not** a separate page: without the membrane it's a
counter, and with it it's this page's second half.

**The walk is already built.** `diffusion/diffusion.js` is the box, the counters
and the √t plot, with no membrane in it by design — this page adds the wall.
Its `advance()` is where a permeability test goes, and `check-diffusion.js` §9
asserts no barrier has grown there in the meantime.

Matrix rows: dynamic equilibrium, randomness, subcellular↔macroscopic.

### 3. Nucleic acids / DNA

**The conflict.** As bad as it gets — ladder vs helix, bases as jigsaw tabs
instead of hydrogen bonds, grooves invisible, antiparallel strands drawn
parallel.

**Why.** The pieces are already built: `skel.js` has `adenine`, `ribosyl` and
`phosphoUnit`, and `macromolecule-lab` draws AMP. Payoff is structure→function on
a molecule where the structure *is* the function.

Matrix rows: integrated systems, scale.

### Reversed: diffusion

**Dropped, then built as a module** — `diffusion/`, no lesson page. The original
judgement is left standing below because the half of it that was right is still
right, and it is what kept this to a module rather than a page.

What it got wrong: it weighed the *diagram* and not the *claim*. The cubes-with-
numbers figure really is inert, and SA:V really is the weakest part — but the
mechanism underneath is not a diagram problem at all. "It evened out, so it
stopped" is the same misconception the mass-action modal exists to break, one
subject over; and √t — four times the wait for twice the distance — is a
quantitative fact every textbook asserts in a sentence and no figure ever shows.
That one is measured live on the module's own plot, which is the strongest thing
here and was invisible from the diagram the judgement was made against.

What it got right: **populations of dots make no geometry claim**, so this is
not a lesson page and does not go on the index. It is plumbing for one — the
membrane page (§2) puts a wall down the middle of a box whose behaviour a
student already trusts, and the module stops one step short of that on purpose.
The same relationship `massaction/` has to the enzymes page.

The size-to-rate half does play to the thesis after all: a dot's radius is read
from the spec's own coordinates, so "why O₂ crosses and glucose doesn't" is a
prediction from the molecules, not an assertion — and `check-diffusion.js` holds
it to four published diffusion coefficients.

Matrix rows: randomness, probability, scale, proportional reasoning.

### Dropped

**SA:V.** Ranked high under the matrix and low under the thesis: the standard
cubes-with-numbers diagram isn't *inconsistent*, just inert. The diffusion half
of this entry is above; the surface-area argument is still not a page.

## Molecule library

Folded in from `docs/molecule-grouping.md` (grouping + storage) and
`resources/Molecule groupings.md` (the wishlist). Both predate the current
library; corrections are at the end of this section.

**What exists: 44 specs across five domain files** (`mol-small.js` re-registers
five of them at the other scale). Read it from the library, not from here:

```bash
node -e "const M=require('./lib-node.js').MolLib.MOLECULES;const b={};for(const k in M)(b[M[k].domain]??=[]).push(k);console.log(b)"
```

**Grouping: by topic, i.e. by lesson.** `docs/molecule-grouping.md` settles this
— of 159 catalogued molecules only 7 appear in more than one topic, so the
duplication that would force a chemical-class scheme (`mol-sugars`, `mol-acids`)
doesn't exist. Topic grouping is also just what `CLAUDE.md`'s standing rule
already demands: a page loads only the molecules it shows. New domain files
below are named for lessons for that reason.

**Storage: split on fidelity tier.** Tier 2/3 — contrast pairs, subjects, skel
twins — stay hand-written, because their comments are load-bearing and a
`skel.js` build *is* its own provenance (`MolecularGeometry.md` §1.6). Tier 1
bulk PubChem props get generated from the catalog by a baker, on the
`residues.js` / `folding/data/*.bin` precedent: a `Do not edit` header and a
checker that re-bakes and fails on staleness. A generated `.js` still loads as a
plain script, so the no-build contract holds; a runtime JSON fetch would not.

### Cost per lesson

| Lesson | New molecules | New file |
| --- | --- | --- |
| **1. Enzymes** | **~1** — ADP. Substrate and product specs already exist in `mol-pathways.js` | none |
| **2. Membrane** | ~4 left — **O₂ ✓** and **glycerol ✓** are in; the phospholipid is started and held (see `mol-lipids.js`'s tail note), then cholesterol, triglyceride (optional) | `mol-lipids.js` ✓ |
| **3. DNA** | ~9 — five nucleobases, one full nucleotide, an A–T and a G–C pair | `mol-nucleic.js` |
| *tier after* — photosynthesis / ETC | chlorophyll a, acetyl-CoA, FAD/FADH₂ — the expensive builds | `mol-photosynthesis.js` |

This independently confirms the build order. Enzymes is first partly because it
costs one molecule; DNA is third partly because it costs nine — though `skel.js`
already carries `adenine`, `ribosyl` and `phosphoUnit`, so the nucleotide is a
build, not a transcription.

Two cheap wins that belong to no lesson: **hydroxide** (you have hydronium, so
autoionization and the pH scale are currently asymmetric) and **O₂** as the
nonpolar reference — which is also half of the membrane page's "why does O₂
cross and glucose doesn't" argument.

### Domain files

`docs/molecule-grouping.md` proposes ~12 files covering the whole catalog. This
is that plan cut down to what the roadmap actually builds — two new files, not
ten. `now` is a snapshot; the one-liner above is the live count.

| file | holds | now | after | needed by |
| --- | --- | --- | --- | --- |
| `mol-solvation.js` | water, salts, small polars/nonpolars — display units | 10 | 12 | `water-lab`, `molecule-lab`, `molecule-builder` |
| `mol-small.js` | the same substances to scale (family B) — either/or | 5 | 7 | `aminoacid-lab` |
| `mol-monomers.js` | amino acids, palmitate, AMP | 6 | 6 | `aminoacid-lab`, `macromolecule-lab` |
| `mol-pathways.js` | glucose → pyruvate, ATP, NADH, Pi | 14 | 15 | `glycolysis-lab`, **enzymes**, and 3 more pages |
| `mol-contrast.js` | the six near-identical pairs | 12 | 12 | `contrast-lab` |
| `mol-compare.js` | `atpSkel` / `nadhSkel` — controls, not lessons | 2 | 2 | `molecule-viewer` |
| **`mol-lipids.js`** | glycerol ✓ · phospholipid, cholesterol, triglyceride | 1 | ~5 | **membrane** |
| **`mol-nucleic.js`** | five bases, a nucleotide, A–T and G–C pairs | — | ~9 | **DNA** |
| *deferred* `mol-photosynthesis.js` | chlorophyll a | — | ~4 | photosynthesis / ETC |
| *not now* `mol-carbs.js` | — carbs live in `mol-pathways` + `mol-contrast` | — | — | no lesson asks |
| *not now* `mol-aminoacids.js` | — 7 specs in `mol-monomers`/`mol-contrast`, 20 side chains in `residues.js` | — | — | no lesson asks |
| **`mol-krebs.js`** | the six acids ✓ · acetyl-CoA, succinyl-CoA, FAD/FADH₂ | 7 | ~11 | **Krebs** |
| *not now* `mol-signaling.js`, `mol-ecology.js` | — | — | — | out of scope (ch. 44+) |

Three notes on the deltas:

- **ADP lands in `mol-pathways.js`**, not a new file — it's the same reaction
  the page already draws, from the other side.
- **hydroxide and O₂ go in `mol-solvation.js` + `mol-small.js` both**, since
  those two files define the same keys by contract and `register()` throws if
  one drifts.
- **`mol-carbs` and `mol-aminoacids` are the two the source plan wants most and
  this roadmap wants least.** Splitting them out is a refactor of specs that
  already work, serving no page — and it would break the `mol-pathways.js`
  load line in five HTML files to move glucose somewhere new. Revisit when a
  lesson needs a sugar that isn't in glycolysis or the contrast set.

### Corrections to the source docs

- **ATP and NADH already exist** (`mol-pathways.js`, plus `atpSkel`/`nadhSkel`
  controls in `mol-compare.js`). The wishlist's wave 1 is largely already
  shipped; **ADP** is the real gap, and glycolysis needs it anyway to show the
  γ phosphate coming off onto something.
- **Amino acids: 7 standalone specs, not 4** — glycine, alanine, serine,
  cysteine, plus proline, glutamine, glutamate in `mol-contrast.js` (and
  `dAlanine` as the mirror). Separately, `residues.js` holds **all twenty side
  chains**, measured, in each residue's N–CA–C frame. So "no positively charged
  side chain" is wrong for `SIDE` and right for the spec registry — wave 2
  should graft from `residues.js` rather than fetch twenty PubChem records.
- **The resolver is done.** `docs/molecule-grouping.md` closes on "the resolver
  blocks everything above" — `tools/resolve-catalog.js` and the resolved
  `tools/catalog/` (265 rows with CIDs) are committed. The tier-1 baker is
  unblocked; that recommendation is spent.
- **The wishlist is written against the AP CED.** This project's audience is
  college Bio 101, so its "the CED does not require this" judgment calls —
  Krebs intermediates especially — aren't binding here. They're still deferred,
  but on build cost, not on that.

## Tier after

**Photosynthesis and the electron transport chain.** Both badly drawn, both real
gaps, both hemoglobin-sized builds. Chemiosmosis needs the membrane page to exist
first, so they are downstream of §2 by construction — not a reason to widen scope
now.

**Pedagogy retrofits.** Predict-before-you-see: gate a step on the student
committing to an answer, then play it. Glycolysis is the natural first host — ask
"ATP in or out?" before steps 1 and 7 and the carbon bookkeeping stops being
something they watch. Covers hypothesis testing and predictive reasoning, the two
matrix rows nothing here touches. Cheap, and still after the visuals.
