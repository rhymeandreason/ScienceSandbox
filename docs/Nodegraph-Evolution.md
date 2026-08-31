Placed last, evolution should read as synthesis rather than assertion — every mechanism it needs already exists somewhere in the graph. If the unit requires much new machinery, the earlier units were built wrong.

## 1. Anchoring questions

* Why do antibiotics stop working?

* Why do we need a new flu shot every year?

* Why are there so many kinds of beetle?

* Why do humans have a tailbone?

* Why do whales have finger bones in their flippers?

* Why are there still monkeys?

* Why doesn't a giraffe stretching its neck make its calves taller?

The last one is worth foregrounding. It has a wrong premise embedded — the Lamarckian model students arrive with — and correcting it requires the whole mechanism. That's the register you identified as strongest.

"Why are there still monkeys?" is similar: a genuine question with a structural misunderstanding inside it, about trees versus ladders.

## 2. Reuse audit

| Needed | Status |
| --- | --- |
| Variation source | Built — Mutation, Meiosis |
| Heritability | Built — Allele, gene → protein |
| Molecular homology | Built — Cytochrome c, genetic code |
| Worked example | Built — sickle cell, three units deep |
| Endosymbiosis | Built (cell) |
| Population level | Ladder rung 8, `emerges-at` already flagged |
| Selection pressure | New |
| Speciation | New |
| Phylogeny | New |

Six of nine present. The unit is largely a rewiring job, which is what putting it last buys you.

## 3. The spine

```
Mutation ──┐
           ├──> Variation ──> Heritable ──> Differential Survival
Meiosis ───┘        ↑                            & Reproduction
                    │                                  ↓
                    │                          Allele Frequency Change
                    │                                  ↓
                    └──────── over generations ──> Adaptation
                                                       ↓
                                            Reproductive Isolation
                                                       ↓
                                                  Speciation
                                                       ↓
                                                  Common Descent

```

Natural selection isn't a node so much as the conjunction of four conditions — variation, heritability, differential fitness, and time. I'd model those as four rank-1 `requires` edges into `Natural Selection` rather than as a description on its card, because the classic misconceptions are each a failure of one specific condition.

## 4. Node inventory (\~36)

**Mechanism** — Variation · Heritability · Differential Reproduction · Fitness · Selection Pressure · Natural Selection · Adaptation **Other forces** — Genetic Drift · Founder Effect · Bottleneck · Gene Flow · Sexual Selection · Artificial Selection **Population genetics** — Population · Gene Pool · Allele Frequency · Hardy-Weinberg · Selection Types (directional, stabilizing, disruptive) · Balancing Selection **Speciation** — Species Concept · Reproductive Isolation (pre/postzygotic) · Allopatric · Sympatric · Adaptive Radiation **Evidence** — Fossil Record · Transitional Forms · Homologous Structures · Vestigial Structures · Analogous Structures · Embryology · Biogeography · Molecular Homology **History & pattern** — Common Descent · Phylogenetic Tree · Cladistics · Convergent Evolution · Coevolution · Extinction

## 5. Key edges — mostly retrospective

The unit's value is in edges pointing backward, not new nodes:

| From | Type | To | Rank |
| --- | --- | --- | --- |
| Mutation (mol.gen) | source-of | Variation | 1 |
| Meiosis (mendelian) | source-of | Variation | 1 |
| Sickle Cell | evidence-for | Balancing Selection | 1 |
| Cytochrome c | evidence-for | Common Descent | 1 |
| Genetic Code universality | evidence-for | Common Descent | 1 |
| Endosymbiosis (cell) | instance-of | Major Transition | 1 |
| Rubisco inefficiency | instance-of | Constraint / Frozen Accident | 1 |
| Homologous Structures | contrasts-with | Analogous Structures | 1 |
| Natural Selection | emerges-at | Population (level 8) | 1 |
| Antibiotic Resistance | instance-of | Directional Selection | 1 |

Sickle cell now has edges in four units — molecular, protein, mendelian, evolution. That single example threading the entire graph is the clearest demonstration of what the structure buys.

## 6. Misconception edges — the unit's core work

More misconceptions cluster here than anywhere else in biology, and each maps to a specific missing condition:

| Wrong model | Fails which condition | Edge |
| --- | --- | --- |
| Individuals evolve / adapt during life | Heritability | `Natural Selection` →`emerges-at`→ `Population` |
| Organisms develop traits because they need them | Variation precedes selection | `Mutation` →`is`→ random with respect to need |
| Evolution is progress toward better | — | `Fitness` — context-dependent; a tapeworm is highly fit |
| Evolution has a goal | — | `Genetic Drift` — much change isn't selected at all |
| Humans descended from monkeys | — | `Common Descent` — shared ancestor, branching not linear |
| Survival of the fittest = strongest | — | `Differential Reproduction` — it's reproduction, not combat |
| "Just a theory" | — | `Evidence` nodes collectively |
| Bacteria "become" resistant when exposed | Variation precedes selection | `Antibiotic Resistance` — the resistant ones were already there |

The Lamarckian one is the deepest and deserves the most content. The graph handles it structurally: if `Natural Selection`sits at population level and the ladder is visible, "the individual adapted" becomes a visible category error rather than a corrected sentence.

## 7. Evidence nodes

This unit has the richest evidence set in the course, and modelling them as `Evidence` nodes with `evidence-for` edges is what makes the "just a theory" objection answerable structurally — the reader can see the convergence.

* **Whale limb bones** — homology, the anchor question

* **Tiktaalik** — a transitional form predicted, then found in rock of the predicted age. The best available demonstration that evolution makes testable predictions.

* **Peppered moths** — directional selection, observed

* **Antibiotic resistance** — happening now, with consequences

* **Darwin's finches / Grants' 40-year study** — measured selection in the wild

* **Cytochrome c sequence table** — relatedness quantified; reuses the protein library

* **Vestigial structures** — tailbone, goosebumps, wisdom teeth

* **Biogeography** — marsupial distribution

* **Endosymbiosis** — already built

Tiktaalik and the Grants' finch study are the two I'd build carefully. Prediction and measurement are what make the theory look like science rather than narrative.

## 8. Content set (\~28)

**Core:**

* **Selection simulator** — a population with variation; adjust the pressure and watch allele frequency shift over generations. Individuals don't change; the distribution does. This single piece does more against the Lamarckian model than any explanation.

* **Drift simulator** — same setup, no selection, small population. Frequencies still move. Separates drift from selection cleanly.

* **Antibiotic resistance animation** — pre-existing resistant variants, not induced change. Includes why finishing the course matters.

* **Cytochrome c comparison tool** — pick two species, count differences, build the tree. Molecular evidence generating phylogeny directly.

* **Homology overlay** — human arm, whale flipper, bat wing, horse leg; same bones, colour-coded. Then an analogous pair (bird and insect wing) for contrast.

* **Tiktaalik prediction story** — the rock age was predicted first. Timeline format.

* **Tree-not-ladder interactive** — build a phylogeny; demonstrate why "more evolved" is meaningless.

* **Sickle cell / malaria map** — reused from Mendelian, retagged as balancing selection.

* **Peppered moth data** — real frequency shifts against industrial soot records.

**Assessment:** given a scenario, identify which of the four conditions is doing the work; explain why an individual can't evolve; predict the frequency outcome under a stated pressure; explain the resistance mechanism to a non-biologist.

## 9. Where evolution as a theme lands

This is where the fifth theme finally has enough instances to be browsable. Tagging pass across the whole graph:

Endosymbiosis · genetic code universality · cytochrome c conservation · sickle cell · Rubisco's inefficiency · homologous structures · antibiotic resistance · the shared machinery of respiration and photosynthesis · ATP as universal currency · the fact that all life uses the same twenty amino acids

That last cluster is worth noticing. Several of the strongest evolution-theme instances are in units built long before this one — universality *is* evidence, and it's been sitting in your graph untagged since macromolecules.

## 10. Ranking caution

Two failure modes here, and the second is more interesting.

**The ordinary one:** speciation taxonomy — allopatric, sympatric, parapatric, peripatric — is highly nameable and gets ranked up. Prezygotic and postzygotic isolation subtypes likewise. Almost none of it has downstream degree in Bio 101.

**The specific one:** evolution is the unit where a model is most likely to hedge, since it's socially contested outside biology. Watch for generated content that softens causal claims or over-qualifies. Inside the discipline it isn't contested, and a ranking that treats "evidence for common descent" as tentative is importing a controversy that doesn't exist in the source material. Worth checking the generated cards specifically for this rather than assuming the rank numbers are the only thing that can go wrong.
