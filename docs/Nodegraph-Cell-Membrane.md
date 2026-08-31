This unit's job is to close three dangling edges — the mitochondrion respiration needs, the bilayer that macromolecules built, and the compartment chemiosmosis requires. It's also the first unit where the scale ladder does real work.

## 1. Anchoring questions

* Why does a cell need a boundary at all?

* Why does a cell in pure water burst, and one in seawater shrivel?

* Why can oxygen cross a membrane freely but glucose needs help?

* Why is a cell small?

* Why does a eukaryote bother with compartments?

* Why does a mitochondrion have its own DNA?

* What actually happens when you're dehydrated, at the cell level?

* Why do plant cells not burst in fresh water when animal cells do?

## 2. The membrane is the unit's hinge

Same pattern as water and proteins — one mechanism node that everything routes through:

**`Selective Permeability`** (Concept, rank-1 hub) ← caused by the hydrophobic core of the bilayer → causes every transport node downstream

Without this hinge, `Membrane` collects fifteen rank-1 edges. With it, the causal story is one sentence: *the bilayer's greasy middle is what makes some things cross and others not*, and every transport mechanism is a workaround for that fact.

## 3. The spine

```
Phospholipid ──amphipathic──> Bilayer ──> Hydrophobic Core
                                              ↓ causes
                                      Selective Permeability
                                              ↓
                    ┌─────────────┬───────────┴────┬──────────────┐
              Simple Diffusion  Facilitated    Active Transport  Bulk Transport
                    ↓             ↓                ↓
                 Osmosis    Channel/Carrier    Pump (Na⁺/K⁺)
                    ↓                              ↓
                  Tonicity                    Electrochemical Gradient
                                                   ↓
                                            Chemiosmosis (→ respiration)

```

That bottom edge is the payoff. The proton gradient in respiration is just active transport creating a store of potential energy — the same physics, already introduced two nodes earlier.

## 4. Node inventory (\~36)

**Membrane** — Phospholipid Bilayer · Hydrophobic Core · Selective Permeability · Fluid Mosaic · Membrane Protein · Cholesterol · Glycoprotein · Membrane Fluidity **Transport** — Simple Diffusion · Osmosis · Tonicity (hypo/iso/hypertonic) · Facilitated Diffusion · Channel Protein · Carrier Protein · Aquaporin · Active Transport · Sodium-Potassium Pump · Electrochemical Gradient · Endocytosis · Exocytosis **Cell** — Cell Theory · Prokaryote · Eukaryote · Cytoplasm · Cytoskeleton · Surface Area to Volume **Organelles** — Nucleus · Ribosome · ER (rough/smooth) · Golgi · Lysosome · Mitochondrion · Chloroplast · Vacuole · Cell Wall **Bridges** — Endomembrane System · Endosymbiotic Theory

## 5. Key edges

| From | Type | To | Rank |
| --- | --- | --- | --- |
| Hydrophobic Effect | causes | Phospholipid Bilayer | 1 |
| Hydrophobic Core | causes | Selective Permeability | 1 |
| Selective Permeability | necessitates | Membrane Protein | 1 |
| Membrane Protein | instance-of | Tertiary Structure | 1 |
| Osmosis | instance-of | Simple Diffusion | 1 |
| Active Transport | requires | ATP | 1 |
| Active Transport | produces | Electrochemical Gradient | 1 |
| Electrochemical Gradient | instance-of | Chemiosmosis | 1 |
| Surface Area to Volume | explains | Cell Size, Compartmentalization | 1 |
| Mitochondrion | evidence-for | Endosymbiotic Theory | 1 |
| Cell Wall | contrasts-with | Membrane | 1 |
| Nucleus → ER → Golgi → Vesicle | precedes | Endomembrane System | 1 |

## 6. Misconception edges

| Wrong model | Edge |
| --- | --- |
| The membrane is a static wall | `Fluid Mosaic` →`corrects`→ it's a two-dimensional fluid; proteins drift |
| Osmosis is water being "pulled" toward salt | `Osmosis` →`explained-by`→ `Simple Diffusion` — water moves down *its own* gradient, passively |
| Diffusion stops at equilibrium | `Diffusion` — molecules keep moving; net flow is zero, motion isn't |
| Facilitated diffusion needs energy | `Facilitated Diffusion` →`contrasts-with`→ `Active Transport` — "helped" ≠ "powered" |
| Cells are mostly empty space | `Cytoplasm` — the mesoscale crowding image again |
| Organelles float freely | `Cytoskeleton` — they're positioned and trafficked |

The osmosis one is worth extra care. It's the most-failed concept in Bio 101, and almost every failure traces to describing it as solute attracting water rather than water diffusing down its own concentration gradient.

## 7. Surface area to volume deserves its own node

Often buried as a footnote, but it independently explains cell size limits, why mitochondria have cristae, why the small intestine has villi, why alveoli are alveolar, and why large organisms need circulatory systems. That's five rank-1 downstream paths across four units — comfortably enough to justify a node, and a good example of the "count downstream paths, not page count" test finding something textbooks under-rank.

## 8. Content set (\~25)

**Core:**

* **Tonicity sandbox** — cell in three solutions, watch it swell, sit, shrivel; toggle plant/animal. The unit's central widget.

* **Permeability tester** — drag molecules at the membrane; O₂ passes, glucose bounces, ions need a channel. Directly demonstrates the hinge.

* **Fluid mosaic animation** — lateral drift, proteins moving. Kills the static-wall model.

* **Aquaporin cutaway** (viewer, SES) — a pore that passes water and excludes protons. Reuses the protein viewer, connects selectivity to tertiary structure.

* **Na⁺/K⁺ pump animation** — conformational change, ATP consumed, 3 out 2 in.

* **Gradient → chemiosmosis bridge** — same animation, relabelled for the mitochondrion. Shows the reuse explicitly.

* **SA:V calculator** — cube size vs ratio, with the biological consequences listed.

* **Goodsell mesoscale cell** — crowding, at rank 1, as misconception correction.

* **Endosymbiosis comparison** — mitochondrion vs bacterium: double membrane, circular DNA, own ribosomes, binary fission.

* **Real micrographs** with the imaging-method caveats — TEM organelles, fluorescence-labelled cytoskeleton.

**Assessment:** predict cell behaviour in a given solution; classify five transport events by mechanism and energy cost; explain why a 10 cm cell can't work; given a molecule's properties, predict how it crosses.

## 9. Outbound bridges

* `Electrochemical Gradient` → **Chemiosmosis** (respiration — closes the dangling edge)

* `Chloroplast` → **Photosynthesis** (the next unit's home)

* `Nucleus` → **Transcription** (molecular genetics)

* `Membrane Protein` → **Tertiary Structure** (back to proteins)

* `Endosymbiosis` → **Evolution**

* `Cell Theory` → **Cell Division** → meiosis, later

Six bridges, two of them retrospective. That's the healthy pattern for a unit placed mid-graph.

## 10. QA and ranking caution

**Hairball risk:** `Membrane` and `Cell` are both at risk. The permeability hinge fixes membrane. `Cell` I'd handle by making `Organelle` a genuine intermediate rather than hanging nine organelles directly off it.

**The predictable ranking error:** a model will rank the organelle roster highest, because organelle-function tables dominate every textbook treatment of this unit. Most organelles have thin downstream degree in Bio 101 — Golgi and smooth ER appear once and never recur. Meanwhile selective permeability, SA:V, and the electrochemical gradient have large downstream fan-out and get a paragraph each.

Same discriminating question, and it separates cleanly: how many rank-1 paths in later units pass through this node? Mitochondrion, chloroplast, nucleus, and ribosome survive at rank 1. The rest drop to 2, which is the right answer and not one the page counts would give you.
