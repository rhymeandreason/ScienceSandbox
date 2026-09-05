<!-- KIND: argument — human only. Ranks what to build next and why. Do not load while building: its content is judgement about priority, and a build that absorbs it starts exercising that judgement in caption copy. -->

# Lessons roadmap

What to build next, and why that order. Status vocabulary is `CLAUDE.md`'s (featured lesson / prototype / reference / test).

## The thesis

**Fidelity, unified on one page.** An interactive 3D model beats a static diagram, but that is not the main claim. The main claim is that Bio 101's diagrams *disagree with each other*, and a student can't tell whether two pictures of the same thing are two conventions or two objects. A page here earns its place by putting them on one screen as one object.

Existing pages are that argument already:

* `contrast-lab` — six pairs textbooks draw as if identical
* `molecule-viewer` — a 3D model and a skeletal diagram shown to be the same atoms
* `hemoglobin-lab` — four levels of protein structure that are always four figures
* `glycolysis-lab` — ATP as a real molecule losing a real γ phosphate, not a coin
* Membrane-lab: shows an inset of a phospholipid next to the abstracted membrane render

**Pedagogy retrofits are a later tier.** Quizzes, predict-before-you-see, scored interaction — real, and deliberately not now. Visualization first.

## Evidence: the threshold-concepts matrix

Ross, Taylor, Hughes, Whitaker, Lutze-Mann & Tzioumis (2010), *Threshold concepts: challenging the way we think, teach and learn in biology and science*, UniServe Science Conf. p.134 — 58 novice students, 11 expert academics, 55 academics surveyed internationally. Follow-on slides: *Using threshold concepts to design a first year biology curriculum* (same team), which crosses the matrix with four practicals.

Their finding: biology's hard parts are not the troublesome *content* but the discipline's tacit understandings, rarely taught explicitly. Matrix rows — energy transformation · SA:V · variation · probability · uncertainty · proportional reasoning · predictive reasoning · hypothesis testing · randomness · subcellular↔macroscopic · scale · integrated systems · equilibrium.

Useful here as corroboration, not as the build order — it ranks by *concept coverage*, this roadmap ranks by *diagram conflict*. Where they disagree, the thesis wins (that's why SA:V dropped, below).

| Matrix row | Covered by |
| --- | --- |
| subcellular ↔ macroscopic, scale | `molecule-viewer` |
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
| `contrast-lab` | prototype | [10 Carbohydrates](https://bccampusbiology.pressbooks.tru.ca/chapter/carbohydrates/) · [11 Lipids](https://bccampusbiology.pressbooks.tru.ca/chapter/lipids/) · [13 Nucleic Acids](https://bccampusbiology.pressbooks.tru.ca/chapter/nucleic-acids/) |
| `hemoglobin-lab` | featured | [12 Proteins](https://bccampusbiology.pressbooks.tru.ca/chapter/proteins/) (all four levels) |
| `molecule-viewer` | prototype | [30 ATP](https://bccampusbiology.pressbooks.tru.ca/chapter/atp-adenosine-triphosphate/) · [33 Energy in Living Systems](https://bccampusbiology.pressbooks.tru.ca/chapter/energy-in-living-systems/) (NADH) |
| `molecule-lab` | prototype | [6 Water](https://bccampusbiology.pressbooks.tru.ca/chapter/water/) · [5](https://bccampusbiology.pressbooks.tru.ca/chapter/atoms-isotopes-ions-and-molecules-the-building-blocks/) (CO₂ → carbonic acid, pH) |
| `glycolysis-lab` | featured | **[34 Glycolysis](https://bccampusbiology.pressbooks.tru.ca/chapter/glycolysis/)** · [33 Energy in Living Systems](https://bccampusbiology.pressbooks.tru.ca/chapter/energy-in-living-systems/) · [39 Regulation of Cellular Respiration](https://bccampusbiology.pressbooks.tru.ca/chapter/regulation-of-cellular-respiration/) (PFK-1) |
| ↳ mass-action modal | — | [27 Energy and Metabolism](https://bccampusbiology.pressbooks.tru.ca/chapter/energy-and-metabolism/) · [29 The Laws of Thermodynamics](https://bccampusbiology.pressbooks.tru.ca/chapter/the-laws-of-thermodynamics/) |
| `membrane-lab` | featured | [22 Components and Structure](https://bccampusbiology.pressbooks.tru.ca/chapter/components-and-structure/) · [23 Passive Transport](https://bccampusbiology.pressbooks.tru.ca/chapter/passive-transport/) · [11 Lipids](https://bccampusbiology.pressbooks.tru.ca/chapter/lipids/) · [215 Osmoregulation and Osmotic Balance](https://bccampusbiology.pressbooks.tru.ca/chapter/osmoregulation-and-osmotic-balance/) |
| `krebs-lab` | **Done** | **[35 Oxidation of Pyruvate and the Citric Acid Cycle](https://bccampusbiology.pressbooks.tru.ca/chapter/oxidation-of-pyruvate-and-the-citric-acid-cycle/)** · [39 Regulation](https://bccampusbiology.pressbooks.tru.ca/chapter/regulation-of-cellular-respiration/) |
| `sickle/fibre-test` | **in progress**, no lesson yet | [12 Proteins](https://bccampusbiology.pressbooks.tru.ca/chapter/proteins/) (quaternary structure, and what a point mutation does to it) |
| **1. Enzymes** | planned | **[31 Enzymes](https://bccampusbiology.pressbooks.tru.ca/chapter/enzymes/)** · [28 Potential, Kinetic, Free, and Activation Energy](https://bccampusbiology.pressbooks.tru.ca/chapter/potential-kinetic-free-and-activation-energy/) |
| **2. Nucleic acids / DNA** | in progress dna-lab.html | **[67 DNA Structure and Sequencing](https://bccampusbiology.pressbooks.tru.ca/chapter/dna-structure-and-sequencing/)** · [13 Nucleic Acids](https://bccampusbiology.pressbooks.tru.ca/chapter/nucleic-acids/) |
| *tier after* — photosynthesis | — | [41 Overview](https://bccampusbiology.pressbooks.tru.ca/chapter/overview-of-photosynthesis/) · [42 Light-Dependent Reactions](https://bccampusbiology.pressbooks.tru.ca/chapter/the-light-dependent-reactions-of-photosynthesis/) · [43 Using Light Energy](https://bccampusbiology.pressbooks.tru.ca/chapter/using-light-energy-to-make-organic-molecules/) |
| *tier after* — ETC / chemiosmosis | — | [36 Oxidative Phosphorylation](https://bccampusbiology.pressbooks.tru.ca/chapter/oxidative-phosphorylation/) |
| *dropped* — SA:V | — | [15 Studying Cells](https://bccampusbiology.pressbooks.tru.ca/chapter/studying-cells/) · [17 Eukaryotic Cells](https://bccampusbiology.pressbooks.tru.ca/chapter/eukaryotic-cells/) |

**What the shape shows.** The repo owns Parts II–III (chemistry and macromolecules) nearly end to end, touches Part VII at exactly one chapter, and now covers Part V (**plasma membranes**, ch. 21–25) — `membrane-lab` shipped. Part XIV (**DNA**, ch. 65–71) has a page started (`dna-lab`, prototype) but no featured lesson yet — the one structural hole §2 exists to fill. Part VI (metabolism, ch. 26–31) is half-covered: ATP, the thermodynamics, and transport are drawn, enzymes are not, which is §1.

Nothing here proposes covering the book. Chapters 44+ are cells, genetics, evolution and organismal biology — different subject matter at a different scale, and out of scope for a molecular-visualization repo.

## Build order

### The sequencing rule

**Never build the next engine before shipping the current engine's page.** This roadmap contains its own evidence. `diffusion/` sat as a module with no consumer until `membrane-lab` put a wall down the middle of its box. `massaction/`'s barrier slider is built, checked (`check-massaction.js` §8) and **still has no page**, a full lesson later — §1 below has been "the cheapest strong page on the list" for two shipped lessons running.

So the order below alternates: engine, then the page that consumes it, then the next engine. An engine whose first consumer is not the very next item is an engine that will sit.

### 0.75. The sickle-cell page, built on the fibre

**Build the lesson around `sickle/fibre-test.html`.** The bench works — one contact, double strand, fibre — and the expensive parts (SES surface bake, fibre transforms, checker) are committed. Only the lesson is missing. Rides `hemoglobin-lab`, costs zero new molecules.

**Do not build binding as a pose search.** Dragging one tetramer onto another while a contact score rises was tried and failed — a monotone score is maximised by driving atoms through each other. Copy `dna/pairing.js`: solve the pose in closed form from declared donors and acceptors, let `kit/hbond.js` find the bonds. A student controls concentration, affinity, or which partner is offered. `sickle/sickle.js` loads on no page; keep `mutate`, the Kyte-Doolittle colouring, and the score as an offline measurement.

### 1. Enzymes

**The conflict.** The lock-and-key / induced-fit cartoon and the energy-barrier curve, never reconciled. No figure shows the shape change *as* what lowers the barrier.

**Why first.** Adjacent to glycolysis: PFK-1 is already the committed step, and `massaction/` already simulates barrier crossing with `ea` forward and `ea + ΔE` back. Lower the barrier, watch the rate move while ΔE doesn't — `check-massaction.js` §8 already asserts it.

**The model is already extracted** — module, CSS, checker, and a test bench (`massaction-test.html` panel B) mounting the slider path this page needs. A module, not an iframe: the modal chrome works, and a frame would re-pay `sandbox.css` and cut the sim off from the step's own ΔE.

**Cost: the `bind`/`release` verb family, then ADP, then the slider.** The same page argues from the engine side too: all fourteen `reaction/` verbs change a bond, and nothing in the repo binds. An enzyme is `bind`, existing verbs, `release`. Build the verbs first and this page is an instance rather than a bespoke build, carrying eight further questions with it: hemoglobin's sigmoid, cyanide, arsenic, lactose, the `contrast-lab` chirality pair. Solve the pose in closed form (§0.75).

Matrix rows: energy transformation, probability, equilibrium.

**The other half: SPECIFICITY, and the sugar work now supplies it.** Everything above is catalysis — the barrier comes down and the rate moves. None of it says why an enzyme accepts one substrate and refuses another, which is the half a student actually asks about ("why can't we digest wood?"). That half is now built and checked, and it costs **no new molecules**:

* The specs carry both linkages and the reagents they come from: `maltose`, `cellobiose`, `galactobiose`, `lactose`, and `alphaGlucose` beside ordinary β-glucose. α and β are different molecules, not a toggle.
* `chain/glucose-chains-test.html` repeats each linkage into what it becomes: starch's six-fold helix, cellulose's two-fold ribbon, and galactan's half-length ribbon, all falling out of torsions solved against published helix parameters rather than drawn.
* So "same monomer, same reaction, one bond flipped, one enzyme works" is a claim the repo can already show instead of assert.

**Use amylase, not lysozyme.** Lysozyme is the classic β-1,4 cutter and would need a PDB and a render path. Amylase costs neither and lands the arc on the page that already exists:

> **starch → (amylase) → maltose → (maltase) → glucose → glycolysis**

Amylase is an *endo*-α-1,4-glucanase and its real product is **maltose** — a spec that already exists and that `chain-repeat.js` already polymerises. Glucose is where `glycolysis-lab` opens, so this answers a question that page currently steps over: where the glucose came from. Two enzymes, two halves — **amylase** for specificity upstream, **PFK-1** for catalysis and regulation inside, as planned above.

Hydrolysis is a condensation run backwards — a water goes in and the bond comes apart — and the specs already name which atoms move: the `condense:` blocks on `glucose`, `alphaGlucose` and `alanine`, audited by `check-molecules.js`. They outlived the drag page they were written for and are kept for this.

**The missing half of the specificity claim: complementarity.** The chain
page shows the two substrates differ, and the linkage specs show why. Neither
says why the *enzyme* can take one and not the other, and that gap is where a
student lands on "the enzyme just knows". The answer is a shape argument with
two halves, and the repo now holds one of them and can get the other cheaply.

Measured, from `1OSE` (porcine pancreatic α-amylase with acarbose, 2.3 Å, a
pseudo-tetrasaccharide sitting in the site): the substrate lies in a **trough
19.8 Å end to end**, spanning four subsites. It is a **track, not a pocket**:
each sugar unit has its own contact set, adjacent units share only 42% of
their contacts, and the union is 25 residues out of 495. Cutting happens
between two subsites partway along, not at a single point.

So the shape a substrate has to present is a chain that stays in a shallow
open trough over ~20 Å. That is what α-1,4 gives and β-1,4 does not:

* **α-1,4 turns.** Every linkage bends the chain the same way, so starch
  coils into the six-fold helix `chain/glucose-chains-test.html` already
  builds from solved torsions. A helix is locally curved and loosely packed,
  it can lay a few units into a trough and let the rest spiral away, and its
  glycosidic oxygens face outward where a catalytic pair can reach them.
* **β-1,4 alternates.** Each glucose is flipped 180° from its neighbour, so
  cellulose comes out as the straight two-fold ribbon on that same page. A
  flat extended ribbon has the wrong curvature to sit in the trough, and its
  linkage oxygen points along the ribbon rather than out of it. Worse, the
  ribbon's exposed faces hydrogen-bond to the next ribbon, so cellulose is a
  crystalline sheet before an enzyme ever meets it: the substrate an amylase
  would have to accept is not a free chain at all.

**Measured now, on `amylase/amylase-test.html`.** Both chains are placed by
superposing their own three glycosidic oxygens onto acarbose's, which is the
only input — the pose is deposited rather than searched, and neither chain is
fitted to the protein. Acarbose scored in its own crystal pose is the control
row, so the numbers have a scale. Over the four residues the trough holds:

| | severe overlaps | contacts under 3 Å | closest approach |
| --- | --- | --- | --- |
| acarbose, as deposited | 0 | 9 | 2.56 Å |
| starch, α-1,4 | 1 | 9 | 2.08 Å |
| cellulose, β-1,4 | 13 | 22 | 0.79 Å |

Two heavy-atom centres 0.79 Å apart are the same atom twice. So the ribbon
does not sit in the trough at all, and "one bond flipped, one enzyme works"
is now a shown fact — which is the whole reason the sugar chains got built
with real torsions rather than drawn. Both chains and the protein are rigid
in that measurement, so it says what these shapes do in this trough, not what
a molecule can never do. `amylase/fit.js` is the arithmetic and
`amylase/tools/check-fit.js` asserts it offline against the code the page
draws with.

Costs: `1OSE` and a render path, which the paragraph above says amylase
avoids. That was true when the alternative was lysozyme and nothing here drew
a protein. It is not true now: `kit/ribbon.js` draws a cartoon from a Cα
trace, `hexokinase/tools/pdbio.js` reads one out of a PDB and superposes it, and
`hexokinase/tools/probe-site.js` is the contact measurement above, pointed at
a different file. A groove view is a page, not a project.

Species caveat to state on the page: 1OSE is porcine pancreatic, not human
salivary. Free detail sitting in every amylase file, and a better hook than
most: a Ca²⁺ and a **Cl⁻ 5.9 Å from the sugar**, because amylase needs
chloride to work at all.

### 2. Nucleic acids / DNA

**The conflict.** As bad as it gets — ladder vs helix, bases as jigsaw tabs instead of hydrogen bonds, grooves invisible, antiparallel strands drawn parallel.

**Started as `dna-lab.html` (prototype).** The pieces are already built: `skel.js` has `adenine`, `ribosyl` and `phosphoUnit`, and `mol-monomers.js` has AMP. Payoff is structure→function on a molecule where the structure *is* the function.

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

Two cheap wins that belong to no lesson: **hydroxide** (you have hydronium, so autoionization and the pH scale are currently asymmetric) and **O₂** as the nonpolar reference — which is also half of the membrane page's "why does O₂ cross and glucose doesn't" argument.

### Domain files

`docs/molecule-grouping.md` proposes \~12 files covering the whole catalog. This is that plan cut down to what the roadmap actually builds — two new files, not ten. `now` is a snapshot; the one-liner above is the live count.

| file | holds | now | after | needed by |
| --- | --- | --- | --- | --- |
| `mol-solvation.js` | water, salts, small polars/nonpolars — display units | 10 | 12 | `water-lab`, `molecule-lab`, `molecule-builder` |
| `mol-small.js` | the same substances to scale (family B) — either/or | 5 | 7 | family-B pages |
| `mol-monomers.js` | amino acids, palmitate, AMP | 6 | 6 | `polymer/` (planned) |
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

**`crystal/` — nucleation and a growth front.** The one piece of genuinely new physics on this list. Freezing in `water-lab` is a scalar fraction snapping molecules onto a pre-built lattice: no nucleation, no crystal *size*, no face for anything to bind. Snowflakes, ice cream, and antifreeze proteins all ask what shape ice grows into, and none is reachable from a fraction-frozen model.
