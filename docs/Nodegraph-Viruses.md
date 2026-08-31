## Viruses

(befoe the Diversity section) Viruses are a genuine unit because they have their own mechanism, not just a place in a classification table — and they're one of the few topics where the "is it alive" question is a real biological problem rather than a definitional game.

They also make an unusually good unit for a graph specifically, because a virus is defined by what it *lacks*. Nearly every node is a `contrasts-with` edge to something you've already built.

## Anchors

* Why is there no cure for the common cold?

* Why do you need a flu shot every year but only one measles shot?

* Are viruses alive?

* Why can't antibiotics treat a cold?

* Why do some viruses stay with you forever?

* How can something with no cells make you so sick?

* Why did COVID keep producing new variants?

The antibiotic one is worth foregrounding — it's a real public-health misconception with consequences, and answering it requires knowing what antibiotics target and why a virus has none of it.

## The structural idea: defined by absence

A virus is nucleic acid plus a protein coat, and that's it. No membrane transport of its own, no ribosomes, no metabolism, no ATP production, no independent replication. Each of those absences is a rank-1 `lacks` edge to a node you've built:

| Lacks | Consequence | Built in |
| --- | --- | --- |
| Ribosomes | Must hijack host translation | Molecular genetics |
| Metabolism / ATP | No energy of its own | Respiration |
| Membrane transport | Enters by receptor binding or fusion | Cell/membrane |
| Independent replication | Obligate parasite | Molecular genetics |
| Cell structure | Below the `emerges-at Cell` threshold | Scale ladder |

That table *is* the unit. It's also the cleanest demonstration in the course of what a cell actually needs, arrived at negatively.

## Spine

```
Capsid + Genome ──> Attachment (receptor specificity)
                          ↓
                       Entry
                          ↓
              ┌───────────┴───────────┐
        Lytic Cycle              Lysogenic Cycle
    (hijack, replicate,        (integrate, dormant,
     assemble, burst)           reactivate later)
                          ↓
              Host machinery does all the work
                          ↓
                    High mutation rate ──> Antigenic Drift ──> Variants

```

## Nodes (\~24)

**Structure** — Virus · Capsid · Viral Genome (DNA/RNA, single/double) · Envelope · Spike Protein · Bacteriophage**Cycle** — Attachment · Host Range / Tropism · Entry · Uncoating · Host Hijacking · Assembly · Release (lysis, budding) · Lytic · Lysogenic · Provirus/Latency **Special cases** — Retrovirus · Reverse Transcriptase · HIV**Consequences** — Mutation Rate · Antigenic Drift/Shift · Vaccine · Antiviral vs Antibiotic · Zoonosis · Pandemic**Boundary** — Is It Alive? · Prion · Viroid

## Key retrospective edges

| From | Type | To | Rank |
| --- | --- | --- | --- |
| Spike Protein | binds | Host Receptor | 1 |
| Attachment | instance-of | Protein Specificity (proteins) | 1 |
| Host Hijacking | uses | Translation, Ribosome (mol.gen) | 1 |
| Envelope | derived-from | Host Membrane (cell) | 1 |
| Reverse Transcriptase | violates | Central Dogma | 1 |
| Mutation Rate | causes | Antigenic Drift → Natural Selection | 1 |
| Virus | lacks | Metabolism, Ribosomes, Membrane Transport | 1 |
| Bacteriophage | evidence-for | Hershey-Chase (mol.gen) | 1 |
| Virus | fails | Cell Theory | 1 |

The reverse transcriptase edge is the most valuable one. The central dogma is presented as near-inviolable in molecular genetics, and retroviruses run it backwards — RNA to DNA, integrated into your genome permanently. That's a genuine exception to a rule the reader already holds, which is a much stronger teaching moment than encountering it as a new fact.

## Misconceptions

| Wrong | Fix |
| --- | --- |
| Antibiotics work on viruses | `Antibiotic` targets cell walls, bacterial ribosomes, bacterial enzymes — a virus has none |
| Viruses are just small bacteria | `Virus` →`contrasts-with`→ `Prokaryote` — bacteria are cells and self-sufficient |
| The flu shot changes yearly because it wears off | `Antigenic Drift` — the virus changed, not your immunity |
| Viruses "want" to kill you | `Fitness` — killing the host fast is usually bad strategy |
| Viral DNA in your genome is exotic | \~8% of the human genome is endogenous retrovirus |
| Vaccines give you the disease | `Antibody`, `Memory Cells` (physiology) |

## The "is it alive" node

Worth building carefully rather than answering. Run it as a criteria checklist against the standard properties of life:

| Property | Virus |
| --- | --- |
| Genetic material | Yes |
| Evolves | Yes — visibly, fast |
| Reproduces | Only inside a host |
| Metabolism | No |
| Homeostasis | No |
| Cellular | No |

The honest answer is that it sits at the boundary and the boundary is a human construct. That connects to your `emerges-at Cell` edge — life emerges at level 4, and viruses sit just below it. Pair with prions, which have no genome at all and still replicate, to show the boundary is fuzzy in more than one direction.

## Content (\~18)

* **Infection cycle animation** — attachment through release, with host machinery highlighted so it's visible that the virus contributes nothing but instructions

* **Lytic/lysogenic switch** — same phage, two paths, and what triggers reactivation. Explains cold sores and shingles.

* **Spike-receptor viewer** — SES render of spike bound to receptor; reuses the protein viewer and makes tropism concrete. Explains why a plant virus can't infect you.

* **Antigenic drift simulator** — accumulate mutations, watch antibody recognition fail; why a yearly shot, and why measles doesn't need one

* **Scale comparison** — virus vs bacterium vs cell, to scale. Exercises the ladder and is genuinely surprising.

* **Antibiotic target diagram** — bacterial cell with drug targets marked, then the same targets absent from a virus

* **Is-it-alive sorter** — virus, prion, bacterium, seed, crystal, fire

* **HIV/retrovirus animation** — reverse transcription and integration, against the central dogma diagram

## Where it goes in the order

After molecular genetics at the earliest — the unit is incoherent without translation and the central dogma. I'd place it after evolution, since antigenic drift and host-pathogen coevolution are among its best content and both need selection.

If you build physiology, viruses gain a lot from immunity being present, and immunity gains from viruses. There's an argument for pairing them.

## Ranking caution

The predictable error is the classification scheme — Baltimore groups, capsid symmetries, enveloped vs naked as a taxonomy. Nameable, tidy, and nothing downstream routes through it in a first-year course.

Under-ranked will be the `lacks` edges, because absence doesn't read as content. They carry nearly every explanatory path in the unit — the antibiotic answer, the obligate-parasite answer, the is-it-alive answer all run through them.
