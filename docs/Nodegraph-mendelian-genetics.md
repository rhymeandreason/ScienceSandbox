This is the one unit where the graph's ordering choice really changes the material. Coming after molecular genetics, alleles arrive as a consequence of something already known — a gene sequence with two versions — rather than as an abstraction. That inversion should be visible in the structure.

## 1. Anchoring questions

Using the retyped standard — pre-existing curiosity, no course vocabulary, multi-node answer:

* Why do you look like your parents but not exactly?

* Why do some traits skip a generation?

* Why do siblings differ when they have the same parents?

* Why are some diseases more common in men?

* Why is it a bad idea to marry your cousin?

* Why do purebred dogs have so many health problems?

**Bridging:** why does a carrier show no symptoms? why do sex-linked traits follow a different pattern?**Comprehension:** what ratio does a monohybrid cross produce?

The sibling one is the best anchor. It has a genuine puzzle in it, and the answer requires meiosis, independent assortment, crossing over, and random fertilization — four nodes, none of them obvious.

## 2. The spine — meiosis first

The structural decision that matters: **meiosis causes the ratios, so it comes first.** Textbooks usually do Mendel's ratios and then explain the mechanism afterward, which leaves students memorizing squares.

```
Chromosome (from mol.gen) ──> Homologous Pairs ──> Meiosis
                                                      ↓
              ┌──────────────┬──────────────┬─────────┴────────┐
        Segregation   Independent      Crossing Over    Random Fertilization
              ↓         Assortment          ↓                  ↓
        Allele pairs      ↓            recombination      ← genetic variation →
         separate    combinations                              ↓
              ↓                                          Natural Selection
        Mendel's Ratios

```

Everything below meiosis is a consequence. The Punnett square becomes a bookkeeping device for a physical process, not a rule.

## 3. Node inventory (\~34)

**Cell division** — Cell Cycle · Mitosis · Meiosis I & II · Homologous Chromosomes · Sister Chromatids · Crossing Over · Independent Assortment · Diploid/Haploid · Gamete · Fertilization **Core concepts** — Gene vs Allele · Locus · Genotype · Phenotype · Homozygous/Heterozygous · Dominant/Recessive · Carrier **Laws** — Segregation · Independent Assortment (as law) · Punnett Square · Test Cross · Probability **Beyond simple dominance** — Incomplete Dominance · Codominance · Multiple Alleles (ABO) · Polygenic Traits · Pleiotropy · Epistasis · Environmental Influence **Linkage & sex** — Linked Genes · Recombination Frequency · Sex Chromosomes · Sex-Linked Inheritance **Applied** — Pedigree · Genetic Disorder · Nondisjunction

## 4. Key edges

| From | Type | To | Rank |
| --- | --- | --- | --- |
| Gene (mol.gen) | has-variants | Allele | 1 |
| Meiosis | causes | Segregation | 1 |
| Segregation | causes | Mendel's 3:1 ratio | 1 |
| Independent Assortment | causes | 9:3:3:1 | 1 |
| Allele | determines | Protein variant → Phenotype | 1 |
| Dominance | explained-by | Enzyme function / dosage | 1 |
| Meiosis | contrasts-with | Mitosis | 1 |
| Crossing Over | causes | Recombination → variation | 1 |
| Meiosis | produces | Genetic Variation → **Natural Selection** | 1 |
| Linked Genes | violates | Independent Assortment | 1 |
| Nondisjunction | causes | Aneuploidy (Down syndrome) | 1 |
| Sickle Cell | instance-of | Recessive, Heterozygote Advantage | 1 |

## 5. The edge that justifies the ordering

**`Dominance` →`explained-by`→ enzyme function**, rank 1.

Dominance is presented as a brute fact in every textbook — "the dominant allele masks the recessive." That's a description, not an explanation. The actual reason, in most cases: the recessive allele produces a nonfunctional protein, and one working copy makes enough enzyme. Dominance is a *molecular* phenomenon.

You can only wire this because molecular genetics came first. It's the payoff for the ordering inversion, and it turns the unit's most memorized fact into something derived.

Same for incomplete dominance — half the enzyme, half the pigment — and codominance, where both proteins are made and both are visible.

## 6. Misconception edges

| Wrong model | Edge |
| --- | --- |
| Dominant means common, or stronger, or better | `Dominance` — polydactyly is dominant and rare; it means expressed in heterozygotes, nothing more |
| One gene, one trait | `Polygenic`, `Pleiotropy` — height involves hundreds of loci; sickle cell affects a dozen systems |
| Genes alone determine phenotype | `Environmental Influence` — same genotype, different outcomes |
| Meiosis is just mitosis twice | `Meiosis` →`contrasts-with`→ `Mitosis` — homologs pair, and that's the whole difference |
| Recessive disorders are rare because recessive | `Carrier`, `Allele Frequency` — carrier frequency is what matters |
| Blood type is simple dominance | `Multiple Alleles` — three alleles, and A/B are codominant |
| Traits blend | `Segregation` — the particulate insight that made Mendel right and blending wrong |

## 7. Evidence nodes

Mendel himself is the good one — pea plants, discrete traits, large numbers, and the fact that he chose seven traits that happened to be unlinked. That last detail is worth including honestly: his laws are cleaner than biology generally is, and linkage is the correction.

Also worth: Morgan's fruit flies for sex linkage and linked genes; the historical blending-inheritance hypothesis as the thing Mendel disproved.

## 8. Content set (\~26)

**Core:**

* **Meiosis animation with variation counter** — run it repeatedly, watch different gamete combinations emerge; a running count of possible outcomes. Answers the sibling anchor directly.

* **Mitosis/meiosis side by side** — synchronized, with homolog pairing highlighted as the divergence point.

* **Crossing over close-up** — chromatids exchanging segments; makes recombination physical.

* **Punnett square builder** — interactive, with a toggle showing the underlying meiosis for each square.

* **Dominance at the molecular level** — enzyme diagram: two working copies, one working copy, none. The unit's key explanatory piece.

* **Pedigree analyzer** — real family trees, deduce the inheritance pattern; include a sex-linked one.

* **Probability simulator** — run a 3:1 cross 10 times vs 1000 times. Shows why Mendel needed large numbers and why real families deviate.

* **Sickle cell heterozygote map** — allele frequency overlaid on malaria distribution. Reuses the protein and molecular work, and bridges straight to evolution.

* **Polygenic height distribution** — discrete alleles summing to a continuous bell curve.

**Assessment:** predict offspring ratios and justify from meiosis; determine inheritance pattern from a pedigree; explain why two brown-eyed parents can have a blue-eyed child; explain at the protein level why one allele is recessive.

## 9. Outbound bridges

* `Genetic Variation` → **Natural Selection** — the main bridge into evolution

* `Allele Frequency` → **Hardy-Weinberg** (and to Chemistry/statistics)

* `Heterozygote Advantage` → **Balancing Selection**

* `Meiosis` → **Sexual Reproduction** → the cost-of-sex question in evolution

* `Allele` ← **Gene, Mutation** — retrospective, closing molecular genetics

* `Nondisjunction` → **Chromosome Structure**

## 10. Ranking caution

The predictable error here is Punnett squares. They dominate teaching time, homework, and assessment, so any prominence-weighted ranking puts them at the top. But nothing downstream routes through them — they're a calculating tool, not a concept. Rank 2.

`Meiosis` and `Genetic Variation` will be under-ranked because they feel like background, and they're the two nodes carrying every rank-1 path into evolution.

There's also a scale-ladder signal worth checking here. This unit is where the graph first crosses from level 4 to level 8 — `Meiosis` at cell level producing `Allele Frequency` at population level. If your Δlevel audit flags that edge as suspicious, it's correctly identifying that something belongs in between: the organism, and reproduction. Worth making that intermediate explicit rather than letting the jump stand.
