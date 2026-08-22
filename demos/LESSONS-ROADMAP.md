# Lessons roadmap

What to build next, and why that order. Status vocabulary is `CLAUDE.md`'s (featured lesson / prototype / reference / test).

`QUESTIONS-ROADMAP.md` ranks the same ground from the other end: it starts from student questions, and lands on additions to the ENGINES rather than on new pages, because the pathway compiler in `reaction/` + `kit/` reaches far past the two pages that produced it. Where the two disagree, the thesis below wins.

## The thesis

**Fidelity, unified on one page.** An interactive 3D model beats a static diagram, but that is not the main claim. The main claim is that Bio 101's diagrams *disagree with each other*, and a student can't tell whether two pictures of the same thing are two conventions or two objects. A page here earns its place by putting them on one screen as one object.

Existing pages are that argument already:

* `contrast-lab` — six pairs textbooks draw as if identical
* `molecule-viewer` — a 3D model and a skeletal diagram shown to be the same atoms
* `hemoglobin-lab` — four levels of protein structure that are always four figures
* `glycolysis-lab` — ATP as a real molecule losing a real γ phosphate, not a coin

Hemoglobin got the teacher response, and it's the page that refused hardest to split its subject up. That's the selection rule.

**Pedagogy retrofits are a later tier.** Quizzes, predict-before-you-see, scored interaction — real, and deliberately not now. Visualization first.

## Evidence: the threshold-concepts matrix

Ross, Taylor, Hughes, Whitaker, Lutze-Mann & Tzioumis (2010), *Threshold concepts: challenging the way we think, teach and learn in biology and science*, UniServe Science Conf. p.134 — 58 novice students, 11 expert academics, 55 academics surveyed internationally. Follow-on slides: *Using threshold concepts to design a first year biology curriculum* (same team), which crosses the matrix with four practicals.

Their finding: biology's hard parts are not the troublesome *content* but the discipline's tacit understandings, rarely taught explicitly. Matrix rows — energy transformation · SA:V · variation · probability · uncertainty · proportional reasoning · predictive reasoning · hypothesis testing · randomness · subcellular↔macroscopic · scale · integrated systems · equilibrium.

Useful here as corroboration, not as the build order — it ranks by *concept coverage*, this roadmap ranks by *diagram conflict*. Where they disagree, the thesis wins (that's why SA:V dropped, below).

| Matrix row | Covered by |
| --- | --- |
| subcellular ↔ macroscopic, scale | `macromolecule-lab`, `molecule-viewer` |
| energy transformation | `glycolysis-lab`, and `coupling/` |
| dynamic equilibrium, probability, randomness | the mass-action modal, and `diffusion/` |
| integrated systems (structure→function) | `hemoglobin-lab` |
| proportional reasoning | `diffusion/` (√t, and D against size) |
| SA:V, variation, uncertainty, hypothesis testing | nothing |

## Textbook coverage

Chapter numbers are OpenStax *Biology 2e*, TRU/BCcampus edition (<https://bccampusbiology.pressbooks.tru.ca>) — the same book `docs/Biology-2e-Concepts.md` indexes. Numbers are that edition's flat 1–255 chapter numbering, not OpenStax's §x.y.

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
| `membrane-lab` | featured | [22 Components and Structure](https://bccampusbiology.pressbooks.tru.ca/chapter/components-and-structure/) · [23 Passive Transport](https://bccampusbiology.pressbooks.tru.ca/chapter/passive-transport/) · [11 Lipids](https://bccampusbiology.pressbooks.tru.ca/chapter/lipids/) · [215 Osmoregulation and Osmotic Balance](https://bccampusbiology.pressbooks.tru.ca/chapter/osmoregulation-and-osmotic-balance/) |
| `krebs-lab` | **in progress** | **[35 Oxidation of Pyruvate and the Citric Acid Cycle](https://bccampusbiology.pressbooks.tru.ca/chapter/oxidation-of-pyruvate-and-the-citric-acid-cycle/)** · [39 Regulation](https://bccampusbiology.pressbooks.tru.ca/chapter/regulation-of-cellular-respiration/) |
| `sickle/fibre-test` | **in progress**, no lesson yet | [12 Proteins](https://bccampusbiology.pressbooks.tru.ca/chapter/proteins/) (quaternary structure, and what a point mutation does to it) |
| **1. Enzymes** | planned | **[31 Enzymes](https://bccampusbiology.pressbooks.tru.ca/chapter/enzymes/)** · [28 Potential, Kinetic, Free, and Activation Energy](https://bccampusbiology.pressbooks.tru.ca/chapter/potential-kinetic-free-and-activation-energy/) |
| **2. Nucleic acids / DNA** | in progress dna-lab.html | **[67 DNA Structure and Sequencing](https://bccampusbiology.pressbooks.tru.ca/chapter/dna-structure-and-sequencing/)** · [13 Nucleic Acids](https://bccampusbiology.pressbooks.tru.ca/chapter/nucleic-acids/) |
| *tier after* — photosynthesis | — | [41 Overview](https://bccampusbiology.pressbooks.tru.ca/chapter/overview-of-photosynthesis/) · [42 Light-Dependent Reactions](https://bccampusbiology.pressbooks.tru.ca/chapter/the-light-dependent-reactions-of-photosynthesis/) · [43 Using Light Energy](https://bccampusbiology.pressbooks.tru.ca/chapter/using-light-energy-to-make-organic-molecules/) |
| *tier after* — ETC / chemiosmosis | — | [36 Oxidative Phosphorylation](https://bccampusbiology.pressbooks.tru.ca/chapter/oxidative-phosphorylation/) |
| *dropped* — SA:V | — | [15 Studying Cells](https://bccampusbiology.pressbooks.tru.ca/chapter/studying-cells/) · [17 Eukaryotic Cells](https://bccampusbiology.pressbooks.tru.ca/chapter/eukaryotic-cells/) |

**What the shape shows.** The repo owns Parts II–III (chemistry and macromolecules) nearly end to end, touches Part VII at exactly one chapter, and now covers Part V (**plasma membranes**, ch. 21–25) — `membrane-lab` shipped. Part XIV (**DNA**, ch. 65–71) has a page started (`dna-lab`, prototype) but no featured lesson yet — the one structural hole §2 exists to fill. Part VI (metabolism, ch. 26–31) is half-covered: ATP, the thermodynamics, and transport are drawn, enzymes are not, which is §1.

Nothing here proposes covering the book. Chapters 44+ are cells, genetics, evolution and organismal biology — different subject matter at a different scale, and out of scope for a molecular-visualization repo.

## Build order

### Shipped

**`glycolysis-lab`.**  Its central claim is the thesis stated plainly: glycolysis is the worst-drawn pathway in Bio 101 — linear in one book and circular in the next, structures then boxes, ATP as a blob, a coin, a lightning bolt. Drawing ATP as a molecule whose γ phosphate the student clicks off was the fix, not a flourish.

**`membrane-lab`.** Was §2 below; now featured. The bilayer as two rows of lollipops, at a geometry and scale that are simply false, proteins drawn as beans wedged in — and water movement drawn three contradictory ways, arrows both directions, arrows one direction, "water moves toward solute" as if pulled. Five steps settle it on one page: bilayer structure, a molecule crossing by simple diffusion, a channel's selectivity, a pump spending real ATP, and active vs. passive side by side. `diffusion/diffusion.js` — box, counters, √t plot, no membrane in it by design — turned out to be the walk; this page added the wall. Matrix rows covered: dynamic equilibrium, randomness, subcellular↔macroscopic.

### The sequencing rule

**Never build the next engine before shipping the current engine's page.** This roadmap contains its own evidence. `diffusion/` sat as a module with no consumer until `membrane-lab` put a wall down the middle of its box. `massaction/`'s barrier slider is built, checked (`check-massaction.js` §8) and **still has no page**, a full lesson later — §1 below has been "the cheapest strong page on the list" for two shipped lessons running.

So the order below alternates: engine, then the page that consumes it, then the next engine. An engine whose first consumer is not the very next item is an engine that will sit.

### 0. Finish `krebs-lab` to featured

**In progress, one commit, 2,614 lines.** Nothing new starts before it.

**Why it outranks everything planned.** One instance of a compiler is a page with a table in it; two instances is a compiler. Everything downstream that treats a pathway as data — fermentation, beta-oxidation, the Calvin cycle, pentose phosphate — is a bet on `reaction/` + `kit/` being general, and the second instance is where you find out what is still not. It has already reported one defect; see §0.5.

`QUESTIONS-ROADMAP.md` costs nine questions against pathway instances that only exist if this is true.

### 0.5. Extract the pathway shell

Two instances, so extract now, while Krebs is fresh and the diff is small. Measured 2026-08-20:

| Page | Total lines | `STEPS` table | Own `<style>` |
| --- | --- | --- | --- |
| `glycolysis-lab` | 3037 | 123 (4%) | 754 (24%) |
| `krebs-lab` | 2614 | 129 (4%) | 817 (31%) |
| `membrane-lab` | 2410 | — | 175 (7%) |
| `hemoglobin-lab` | 2694 | — | 137 (5%) |

**The compiler compiles the chemistry; the lesson shell doesn't exist.** A second pathway costs ~2,500 lines to express 129 lines of pathway, and the pathway pages carry four to six times the per-page CSS of the non-pathway ones.

Pull the carrier column, the ledger, the step rail, the caption band and the ~800 lines of CSS that lay them out into `sandbox.css` and a shell module. None of it is physics, so §"share the plumbing, not the physics" holds. This is the item that turns "author many lessons" from a goal into a property of the repo.

### 0.75. The sickle-cell page, built on the fibre

**Build the lesson around `sickle/fibre-test.html`.** The bench works — one contact, double strand, fibre — and the expensive parts (SES surface bake, fibre transforms, checker) are committed. Only the lesson is missing. Rides `hemoglobin-lab`, costs zero new molecules.

**The conflict.** Sickle-cell is drawn as a letter changing in a sequence, and separately as a crescent cell. The step between is the **fibre**: β6 of one tetramer in the Phe85/Leu88 pocket of the next. The mechanism is drawn nowhere.

Keep the bench's split between measured constants and slider-shaped guesses, and its live `twistStrain()` readout; that is what §0.9 generalizes.

**Do not build binding as a pose search.** Dragging one tetramer onto another while a contact score rises was tried and failed — a monotone score is maximised by driving atoms through each other. `QUESTIONS-ROADMAP.md` §3's `bind`/`release` argument from that drag is withdrawn with it. Copy `dna/pairing.js`: solve the pose in closed form from declared donors and acceptors, let `kit/hbond.js` find the bonds. A student controls concentration, affinity, or which partner is offered. `sickle/sickle.js` loads on no page; keep `mutate`, the Kyte-Doolittle colouring, and the score as an offline measurement.

### 0.9. The provenance readout

**A label convention, a slider convention, and a recomputed-from-what-is-drawn readout, shared across pages.** `fibre-test.html` is the worked example, so the first consumer already exists — the sequencing rule's condition for building it.

`CLAUDE.md` keeps pedagogical exaggerations explicit **in comments**, which serves the author. Put the same distinction on screen, where it serves the student. Nearly every lesson mixes measured geometry with a chosen exaggeration — `mol-solvation.js` stretches O–H to 1.55 Å, the membrane's proteins are placed rather than docked, `water-lab`'s ice lattice is sized to the molecule count — and none of it is visible from the page.

On-thesis: the conflict under all the others is **between a textbook figure and the evidence for it**. A student who has watched one picture announce where it stops being true reads every other picture differently.

### 1. Enzymes

**The conflict.** The lock-and-key / induced-fit cartoon and the energy-barrier curve, never reconciled. No figure shows the shape change *as* what lowers the barrier.

**Why first.** Adjacent to glycolysis: PFK-1 is already the committed step, and `massaction/` already simulates barrier crossing with `ea` forward and `ea + ΔE` back. Lower the barrier, watch the rate move while ΔE doesn't — `check-massaction.js` §8 already asserts it.

**The model is already extracted** — module, CSS, checker, and a test bench (`massaction-test.html` panel B) mounting the slider path this page needs. A module, not an iframe: the modal chrome works, and a frame would re-pay `sandbox.css` and cut the sim off from the step's own ΔE.

**Cost: the `bind`/`release` verb family, then ADP, then the slider.** `QUESTIONS-ROADMAP.md` §3 argues the same page from the engine side — all fourteen `reaction/` verbs change a bond, and nothing in the repo binds. An enzyme is `bind`, existing verbs, `release`. Build the verbs first and this page is an instance rather than a bespoke build, carrying eight further questions with it: hemoglobin's sigmoid, cyanide, arsenic, lactose, the `contrast-lab` chirality pair. Solve the pose in closed form (§0.75).

Matrix rows: energy transformation, probability, equilibrium.

**The other half: SPECIFICITY, and the sugar work now supplies it.** Everything
above is catalysis — the barrier comes down and the rate moves. None of it says
why an enzyme accepts one substrate and refuses another, which is the half a
student actually asks about ("why can't we digest wood?"). That half is now
built and checked, and it costs **no new molecules**:

* The specs carry both linkages and the reagents they come from: `maltose`,
  `cellobiose`, `galactobiose`, `lactose`, and `alphaGlucose` beside ordinary
  β-glucose. α and β are different molecules, not a toggle.
* `chain/glucose-chains-test.html` repeats each linkage into what it becomes:
  starch's six-fold helix, cellulose's two-fold ribbon, and galactan's
  half-length ribbon, all falling out of torsions solved against published helix
  parameters rather than drawn.
* So "same monomer, same reaction, one bond flipped, one enzyme works" is a
  claim the repo can already show instead of assert.

**Use amylase, not lysozyme.** Lysozyme is the classic β-1,4 cutter and would
need a PDB and a render path. Amylase costs neither and lands the arc on the
page that already exists:

> **starch → (amylase) → maltose → (maltase) → glucose → glycolysis**

Amylase is an *endo*-α-1,4-glucanase and its real product is **maltose** — a spec
that already exists and that `chain-repeat.js` already polymerises.
Glucose is where `glycolysis-lab` opens, so this answers a question that page
currently steps over: where the glucose came from. Two enzymes, two halves —
**amylase** for specificity upstream, **PFK-1** for catalysis and regulation
inside, as planned above.

Hydrolysis is a condensation run backwards — a water goes in and the bond comes
apart — and the specs already name which atoms move: the `condense:` blocks on
`glucose`, `alphaGlucose` and `alanine`, audited by `check-molecules.js`. They
outlived the drag page they were written for and are kept for this.

**The trap, and it is this section's own thesis.** This roadmap exists partly to
kill the lock-and-key cartoon. A generic pocket that a helix slots into and a
ribbon does not is that cartoon, redrawn at higher fidelity — and worse, it
would imply enzymes select on gross chain shape, when they read the linkage at a
single bond. Cheapest honest option: **do not draw the enzyme.** Show the chain,
the cut, and the refusal on β, with the enzyme present only as what it accepts.
If it is ever drawn, draw a deposited structure.

### 2. Nucleic acids / DNA

**The conflict.** As bad as it gets — ladder vs helix, bases as jigsaw tabs instead of hydrogen bonds, grooves invisible, antiparallel strands drawn parallel.

**Started as `dna-lab.html` (prototype).** The pieces are already built: `skel.js` has `adenine`, `ribosyl` and `phosphoUnit`, and `macromolecule-lab` draws AMP. Payoff is structure→function on a molecule where the structure *is* the function.

Matrix rows: integrated systems, scale.

### Reversed: diffusion

**Dropped as a page, built as a module** — `diffusion/`. It stays a module: populations of dots make no geometry claim, so it isn't a lesson page and isn't on the index. It was plumbing for one, and `membrane-lab` put the wall down the middle of its box. Same relationship `massaction/` has to enzymes.

The original judgement weighed the diagram, not the claim. The cubes-with-numbers figure is inert, but the mechanism underneath isn't a diagram problem: "it evened out, so it stopped" is the misconception the mass-action modal exists to break, and √t — four times the wait for twice the distance — is asserted in a sentence by every textbook and shown by no figure. The module measures it live on its own plot.

Size-to-rate plays to the thesis: a dot's radius is read from the spec's own coordinates, so "why O₂ crosses and glucose doesn't" is a prediction from the molecules, and `check-diffusion.js` holds it to four published diffusion coefficients.

Matrix rows: randomness, probability, scale, proportional reasoning.

### Dropped

**SA:V.** Ranked high under the matrix and low under the thesis: the standard cubes-with-numbers diagram isn't *inconsistent*, just inert. The diffusion half of this entry is above; the surface-area argument is still not a page.

## Molecule library

Folded in from `docs/molecule-grouping.md` (grouping + storage) and `resources/Molecule groupings.md` (the wishlist). Both predate the current library; corrections are at the end of this section.

**What exists: 44 specs across five domain files** (`mol-small.js` re-registers five of them at the other scale). Read it from the library, not from here:

```bash
node -e "const M=require('./lib-node.js').MolLib.MOLECULES;const b={};for(const k in M)(b[M[k].domain]??=[]).push(k);console.log(b)"
```

**Grouping: by topic, i.e. by lesson.** `docs/molecule-grouping.md` settles this — of 159 catalogued molecules only 7 appear in more than one topic, so the duplication that would force a chemical-class scheme (`mol-sugars`, `mol-acids`) doesn't exist. Topic grouping is also just what `CLAUDE.md`'s standing rule already demands: a page loads only the molecules it shows. New domain files below are named for lessons for that reason.

**Storage: split on fidelity tier.** Tier 2/3 — contrast pairs, subjects, skel twins — stay hand-written, because their comments are load-bearing and a `skel.js` build *is* its own provenance (`MolecularGeometry.md` §1.6). Tier 1 bulk PubChem props get generated from the catalog by a baker, on the `residues.js` / `folding/data/*.bin` precedent: a `Do not edit` header and a checker that re-bakes and fails on staleness. A generated `.js` still loads as a plain script, so the no-build contract holds; a runtime JSON fetch would not.

### Cost per lesson

| Lesson | New molecules | New file |
| --- | --- | --- |
| **0. Krebs** | **0 left of \~11** — six acids in `mol-krebs.js` ✓; the rest are what finishing costs | `mol-krebs.js` ✓ |
| **0.75. Sickle fibre** | **0** — rides `hemoglobin/data/2HBS.pdb`, already baked | none |
| **1. Enzymes** | **\~1** — ADP for the catalysis half. The **specificity** half costs **0**: maltose, cellobiose, galactobiose and α-glucose are built and checked | none |
| **2. Membrane** | \~4 left — **O₂ ✓** and **glycerol ✓** are in; the phospholipid is started and held (see `mol-lipids.js`'s tail note), then cholesterol, triglyceride (optional) | `mol-lipids.js` ✓ |
| **3. DNA** | \~9 — five nucleobases, one full nucleotide, an A–T and a G–C pair | `mol-nucleic.js` |
| *tier after* — photosynthesis / ETC | chlorophyll a, acetyl-CoA, FAD/FADH₂ — the expensive builds | `mol-photosynthesis.js` |

This independently confirms the build order, and now confirms the two items ahead of it more strongly than anything else here: **Krebs and sickle cost no new molecules at all.** Enzymes is next partly because it costs one molecule; DNA is third partly because it costs nine — though `skel.js` already carries `adenine`, `ribosyl` and `phosphoUnit`, so the nucleotide is a build, not a transcription.

Two cheap wins that belong to no lesson: **hydroxide** (you have hydronium, so autoionization and the pH scale are currently asymmetric) and **O₂** as the nonpolar reference — which is also half of the membrane page's "why does O₂ cross and glucose doesn't" argument.

### Domain files

`docs/molecule-grouping.md` proposes \~12 files covering the whole catalog. This is that plan cut down to what the roadmap actually builds — two new files, not ten. `now` is a snapshot; the one-liner above is the live count.

| file | holds | now | after | needed by |
| --- | --- | --- | --- | --- |
| `mol-solvation.js` | water, salts, small polars/nonpolars — display units | 10 | 12 | `water-lab`, `molecule-lab`, `molecule-builder` |
| `mol-small.js` | the same substances to scale (family B) — either/or | 5 | 7 | `aminoacid-lab` |
| `mol-monomers.js` | amino acids, palmitate, AMP | 6 | 6 | `aminoacid-lab`, `macromolecule-lab` |
| `mol-pathways.js` | glucose → pyruvate, ATP, NADH, Pi | 14 | 15 | `glycolysis-lab`, **enzymes**, and 3 more pages |
| `mol-contrast.js` | the six near-identical pairs | 12 | 12 | `contrast-lab` |
| `mol-compare.js` | `atpSkel` / `nadhSkel` — controls, not lessons | 2 | 2 | `molecule-viewer` |
| **`mol-lipids.js`** | glycerol ✓ · phospholipid, cholesterol, triglyceride | 1 | \~5 | **membrane** |
| **`mol-nucleic.js`** | five bases, a nucleotide, A–T and G–C pairs | — | \~9 | **DNA** |
| *deferred* `mol-photosynthesis.js` | chlorophyll a | — | \~4 | photosynthesis / ETC |
| *not now* `mol-carbs.js` | — carbs live in `mol-pathways` + `mol-contrast` | — | — | no lesson asks |
| *not now* `mol-aminoacids.js` | — 7 specs in `mol-monomers`/`mol-contrast`, 20 side chains in `residues.js` | — | — | no lesson asks |
| **`mol-krebs.js`** | the six acids ✓ · acetyl-CoA, succinyl-CoA, FAD/FADH₂ | 7 | \~11 | **Krebs** |
| *not now* `mol-signaling.js`, `mol-ecology.js` | — | — | — | out of scope (ch. 44+) |

Three notes on the deltas:

* **ADP lands in `mol-pathways.js`**, not a new file — it's the same reaction the page already draws, from the other side.
* **hydroxide and O₂ go in `mol-solvation.js` + `mol-small.js` both**, since those two files define the same keys by contract and `register()` throws if one drifts.
* **`mol-carbs` and `mol-aminoacids` are the two the source plan wants most and this roadmap wants least.** Splitting them out is a refactor of specs that already work, serving no page — and it would break the `mol-pathways.js` load line in five HTML files to move glucose somewhere new. Revisit when a lesson needs a sugar that isn't in glycolysis or the contrast set.

### Corrections to the source docs

* **ATP and NADH already exist** (`mol-pathways.js`, plus `atpSkel`/`nadhSkel` controls in `mol-compare.js`). The wishlist's wave 1 is largely already shipped; **ADP** is the real gap, and glycolysis needs it anyway to show the γ phosphate coming off onto something.
* **Amino acids: 7 standalone specs, not 4** — glycine, alanine, serine, cysteine, plus proline, glutamine, glutamate in `mol-contrast.js` (and `dAlanine` as the mirror). Separately, `residues.js` holds **all twenty side chains**, measured, in each residue's N–CA–C frame. So "no positively charged side chain" is wrong for `SIDE` and right for the spec registry — wave 2 should graft from `residues.js` rather than fetch twenty PubChem records.
* **The resolver is done.** `docs/molecule-grouping.md` closes on "the resolver blocks everything above" — `tools/resolve-catalog.js` and the resolved `tools/catalog/` (265 rows with CIDs) are committed. The tier-1 baker is unblocked; that recommendation is spent.
* **The wishlist is written against the AP CED.** This project's audience is college Bio 101, so its "the CED does not require this" judgment calls — Krebs intermediates especially — aren't binding here. They're still deferred, but on build cost, not on that.

## Tier after

**Photosynthesis and the electron transport chain.** Both badly drawn, both real gaps, both hemoglobin-sized builds. Chemiosmosis needed the membrane page to exist first — `membrane-lab` shipped, so that dependency is clear — not a reason to widen scope now.

**Pedagogy retrofits.** Predict-before-you-see: gate a step on the student committing to an answer, then play it. Glycolysis is the natural first host — ask "ATP in or out?" before steps 1 and 7 and the carbon bookkeeping stops being something they watch. Covers hypothesis testing and predictive reasoning, the two matrix rows nothing here touches. Cheap, and still after the visuals.

**The hydrophobic effect.** *Why do oil and water separate, if separating makes things more ordered?* It doesn't; the water is what gains freedom, and nearly every student has this exactly backwards. Not a diagram conflict, so it ranked nowhere under the thesis — but `docs/Biology-2e-Concepts.md` flags it as a **known discontinuity**, absent from AP and qualitative in OpenStax §12, with "nothing internal fixes this" written against it. A conflict between what a student is told and what is true is the thesis in a different key. It would ride `water-lab` plus a nonpolar solute, and it is what §0.75 and `folding/` are both secretly about.

**`crystal/` — nucleation and a growth front.** The one piece of genuinely new physics `QUESTIONS-ROADMAP.md` asks for. Freezing in `water-lab` is a scalar fraction snapping molecules onto a pre-built lattice: no nucleation, no crystal *size*, no face for anything to bind. Snowflakes, ice cream, and antifreeze proteins all ask what shape ice grows into, and none is reachable from a fraction-frozen model.

## Where `QUESTIONS-ROADMAP.md` and this file disagree

Both were re-read against each other on 2026-08-20. They agree on more than expected: enzymes first, ETC and photosynthesis deferred, and the module-behind-a-modal pattern, which that file presents as a new idea and this one had already stated in the diffusion entry.

Three real disagreements, resolved:

* **DNA.** Ranked §2 here and nearly cut there. This file wins, and the conflict was fake: §2 is DNA *structure* — ladder vs helix, antiparallel drawn parallel — and what that file cuts is *genetics*, calico cats and twins. Different subject. Both judgments stand.
* **The water block.** Mostly this file wins on the thesis. Two survive into the tier above: the hydrophobic effect and `crystal/`.
* **`osmosis/`.** Ranked high there, and lower here: the coverage table already shows `membrane-lab` claiming ch. 215 Osmoregulation, which makes it an extension to a featured page rather than a module.

**And the two roadmaps cost in different currencies.** This file costs in new molecules, that one in new engine code. Neither is wrong and they predict different things: molecules predict structure pages, which is why DNA is third at nine of them; engine code predicts mechanism pages. Read both before ranking anything.
