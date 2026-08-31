This is the unit that closes your oldest dangling edge — `Gene Sequence → Primary Structure` has been hanging since you built proteins — and it's also where the graph's payoff is largest, because the central dogma is a causal chain that textbooks split across three or four chapters.

## 1. Anchoring questions

* How does a molecule store instructions?

* Why does one substitution out of 146 cause sickle cell, when others do nothing?

* How does a copy get made without errors accumulating?

* If every cell has the same DNA, why is a neuron not a liver cell?

* Why is the code the same in bacteria and humans?

* What is a gene, actually?

The fourth is the one worth building toward. Students finish this unit able to recite transcription and translation and still can't answer it, because regulation gets cut for time.

## 2. The spine

```
DNA Structure ──> Replication (information persists)
      ↓
  Transcription ──> mRNA ──> Processing
                              ↓
                          Translation ──> Polypeptide
                                              ↓
                                    Primary Structure (proteins unit)
                                              ↓
                                    Tertiary → Function → Phenotype

```

The critical modelling point: **don't stop at "protein."** The chain only means something if it runs through folding to function to phenotype, which are nodes you already have. Wire `Translation` → `Primary Structure` at rank 1 and the two units fuse into one nine-hop causal path — the longest and most valuable traversal in the whole graph.

## 3. Node inventory (\~40)

**Structure** — DNA · Nucleotide · Base Pairing · Double Helix · Antiparallel · Sugar-Phosphate Backbone · Chromosome · Gene **Replication** — Semiconservative Replication · Helicase · DNA Polymerase · Leading/Lagging Strand · Primer · Ligase · Proofreading **Transcription** — RNA · mRNA · RNA Polymerase · Promoter · Template Strand · RNA Processing (splicing, cap, tail) · Intron/Exon **Translation** — Genetic Code · Codon · Anticodon · tRNA · rRNA/Ribosome · Start/Stop Codon · Reading Frame **Variation** — Mutation · Point Mutation (silent, missense, nonsense) · Frameshift · Mutagen **Regulation** — Gene Expression · Operon · Transcription Factor · Epigenetics**Bridges** — Central Dogma · Genome

## 4. Key edges

| From | Type | To | Rank |
| --- | --- | --- | --- |
| Base Pairing | enables | Replication, Transcription | 1 |
| Complementarity | causes | Semiconservative Replication | 1 |
| Gene | determines | Primary Structure | 1 |
| Genetic Code | maps | Codon → Amino Acid | 1 |
| Translation | produces | Polypeptide → **Primary Structure** | 1 |
| Point Mutation | causes | Altered R-Group → Tertiary → Phenotype | 1 |
| Antiparallel | causes | Leading/Lagging Strand asymmetry | 1 |
| Ribosome | instance-of | Organelle, RNA-protein complex | 1 |
| Gene Expression | explains | Cell Differentiation | 1 |
| DNA | instance-of | Nucleic Acid (macromolecules) | 1 |
| Genetic Code | evidence-for | Common Ancestry | 1 |

## 5. Complementarity is the hinge

Same pattern as the other units. One node carries the mechanism:

**`Base Pairing / Complementarity`** — A-T, G-C, hydrogen-bonded.

It's the reason replication is possible (each strand templates the other), the reason transcription works, the reason tRNA finds its codon, and the reason PCR and sequencing exist. Four rank-1 downstream paths from one idea. Route everything through it rather than restating "the bases pair" in each process node.

It also reaches back — those are hydrogen bonds, the same node from the water unit.

## 6. Misconception edges

| Wrong model | Edge |
| --- | --- |
| DNA leaves the nucleus | `Transcription` — mRNA is the messenger; that's the whole point of it |
| Every cell has different DNA | `Gene Expression` — same genome, different expression. The differentiation question. |
| Mutations are always harmful | `Mutation` — silent, neutral, occasionally beneficial; required for evolution |
| One gene → one trait | `Phenotype` — most traits are polygenic; most genes are pleiotropic |
| The code is "read" like English | `Reading Frame` — frameshift demo makes this concrete |
| RNA is just "DNA's helper" | `rRNA`, `tRNA` — RNA is structural and catalytic, not only a message |
| Genes are switched on/off like lights | `Transcription Factor` — it's rate modulation, not binary |

The differentiation one deserves rank-1 treatment. It's the question students most want answered and the one most often deferred.

## 7. Evidence nodes

This unit has unusually good historical experiments, and they're worth modelling as `Evidence` nodes rather than sidebars — they show *how we know*, which no other unit does as cleanly.

* **Griffith / Avery** → DNA is the transforming material

* **Hershey–Chase** → radiolabelled phage; protein vs DNA settled

* **Franklin's Photo 51 + Watson-Crick** → helix, dimensions, and a real credit-attribution note

* **Meselson–Stahl** → semiconservative replication; reuses your Isotope chemistry node

* **Nirenberg** → cracking the codon table

Meselson–Stahl is the best of them — three competing hypotheses, one experiment, unambiguous result. It's the cleanest demonstration of hypothesis testing available anywhere in Bio 101.

## 8. Content set (\~28)

**Core:**

* **Sickle-cell full chain** — the showcase. DNA base → codon → amino acid → surface patch → cell shape → phenotype → malaria resistance. Traverses three units in one piece; build this first.

* **DNA viewer** — antiparallel strands, backbone outside (polarity, from water), bases stacked inside (hydrophobic effect). Three retrospective bridges in one render.

* **Replication fork animation** — leading vs lagging, with the antiparallel constraint visible as the *cause* of the asymmetry, not an arbitrary fact.

* **Codon table, interactive** — enter a sequence, see the peptide; mutate a base and watch silent vs missense vs nonsense fall out.

* **Frameshift demo** — a readable English sentence with one letter deleted. Makes the reading-frame point in two seconds.

* **Translation animation** — ribosome, tRNA arriving, peptide bond forming. Reuses the peptide-bond piece from proteins.

* **Meselson–Stahl simulator** — pick a hypothesis, predict the band pattern, run it.

* **Differentiation visual** — same genome, neuron vs liver cell, different genes expressed.

* **Splicing animation** — introns removed; alternative splicing as one gene, several proteins.

**Assessment:** transcribe and translate a given strand; predict the effect of each of four mutations; explain why lagging-strand synthesis is discontinuous; explain how one genome makes 200 cell types.

## 9. Outbound bridges

* `Translation` → **Primary Structure** — the debt, repaid

* `Mutation` → **Natural Selection** — variation's source, into evolution

* `Chromosome` → **Meiosis** — into Mendelian genetics, the next unit

* `Genetic Code` → **Common Ancestry** — universality as evidence

* `Ribosome`, `Nucleus` → **Organelles** — retrospective, into cell

* `DNA Polymerase`, `Restriction Enzymes` → **Enzyme** — back to proteins

* `Gene Expression` → **Differentiation, Development**

Seven bridges. This is the most connected unit in the graph, which is why it belongs third rather than first.

## 10. Ranking caution

The predictable error is enzyme rosters. Helicase, primase, topoisomerase, ligase, single-strand binding protein — five named proteins in replication alone, each with a tidy job description, all highly rankable by page count. Almost none have downstream degree in Bio 101.

`Complementarity` and `Reading Frame` will be under-ranked for the same reason they always are: they're not named things, they're constraints.

There's also a subtler failure here. A model asked "what's essential to molecular genetics" will import *molecular biology's* priorities — mechanism detail, enzyme specifics — rather than a first-year course's. Scope the rubric explicitly: how many rank-1 paths in *this graph* pass through this node. Complementarity has four. Topoisomerase has none.
