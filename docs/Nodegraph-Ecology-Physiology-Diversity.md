These three were bundled as "optional," but they're not one unit and they don't behave alike. Physiology is the biggest build in the whole course, ecology is the cheapest, and diversity is barely a unit at all in the sense the others are. Worth taking them separately.

---

# Ecology

Cheapest of the three, because the mechanisms are already built — this unit mostly extends the scale ladder and applies energy flow at a new level.

**Anchors:** Why can't you live on grass? Why are there more rabbits than foxes? Why does a small island have fewer species? What actually happens to a body when it decomposes? Why do invasive species take over?

**Spine:** the two flows, and they behave differently.

```
Sunlight ──> Producers ──> Consumers ──> Decomposers
   ENERGY: flows through, degrades, exits as heat — one direction
   MATTER: cycles, conserved, returns — closed loop

```

That contrast is the unit's central idea and the source of its best misconception fix. Energy flow is a `contrasts-with` edge to nutrient cycling at rank 1.

**Nodes (\~30):** Population · Community · Ecosystem · Biome · Niche · Habitat · Trophic Level · Producer/Consumer/Decomposer · Food Web · Energy Pyramid · 10% Rule · Carbon Cycle · Nitrogen Cycle · Water Cycle · Carrying Capacity · Exponential vs Logistic Growth · Limiting Factor · Competition · Predation · Symbiosis (mutualism, commensalism, parasitism) · Keystone Species · Succession · Biodiversity · Invasive Species · Habitat Fragmentation · Climate Change

**Key retrospective edges:** Photosynthesis → Producers (rank 1) · Respiration → energy release at every trophic level · Carbon Fixation → Carbon Cycle · Natural Selection → Coevolution, predator-prey · Meiosis/Variation → Biodiversity

**Misconceptions:**

| Wrong | Fix |
| --- | --- |
| Energy cycles like matter does | 10% Rule — most is lost as heat; that's why food chains are short |
| Decomposers are unimportant | Nutrient Cycling — without them everything locks up in corpses |
| Plants get food from soil | back to Carbon Fixation, the water/photosynthesis anchor |
| Populations grow until they run out | Logistic Growth, Carrying Capacity |
| More species is always better | Invasive Species — added species, collapsed diversity |

**Content:** food web builder with removal effects (pull a keystone species, watch cascade) · energy pyramid calculator answering "why can't you live on grass" quantitatively · carbon cycle tracer following one atom from air to tissue to atmosphere · Yellowstone wolves case study · population growth simulator with a limiting factor slider.

**Scale note:** this is the only unit exercising rungs 8–10, and the `member-of` relation you separated from `part-of` finally matters. Organism in population, population in community — removable membership, not structural containment.

---

# Physiology

The largest build. This is the entire tissue-organ-system region of the ladder, currently empty, and it's where most of your organism-scale anchor questions land.

**Anchors:** How do fish breathe in water? Why are some animals cold-blooded? Why do you get a fever? Why does a cut heal but a severed spinal cord doesn't? Why do bruises change colour? Why does exercise make you breathe harder? Why do wounds get infected but your gut is full of bacteria?

**The organizing idea is homeostasis** — the fifth theme, which finally has somewhere to live. Model it as a mechanism node with real structure, not a slogan:

```
Set Point → Sensor → Integrator → Effector → Response → Negative Feedback

```

Every system instantiates this. Thermoregulation, blood glucose, osmoregulation, blood pH, calcium. Build the loop once as a node with `instance-of` edges from each system, exactly as you did with chemiosmosis. It's the same reuse move and it's what keeps physiology from becoming eight disconnected system chapters.

**Nodes (\~45), grouped by system:** Homeostasis · Negative/Positive Feedback · Set Point | Circulatory: Heart · Blood Vessels · Blood · Hemoglobin (built) · Double Circulation | Respiratory: Gas Exchange Surface · Alveoli · Gills · Countercurrent Exchange · Partial Pressure | Digestive: Mechanical/Chemical Digestion · Enzymes (built) · Absorption · Villi | Excretory: Nephron · Filtration · Osmoregulation | Nervous: Neuron · Action Potential · Synapse · Neurotransmitter · Reflex Arc | Endocrine: Hormone · Target Cell · Receptor (built) | Immune: Innate/Adaptive · Antibody (built) · Antigen · Memory Cells · Inflammation | Musculoskeletal: Sarcomere · Actin/Myosin (built) · Sliding Filament

**The unifying constraint:** surface area to volume, already built in the cell unit, explains alveoli, villi, gills, nephron tubules, and root hairs. Five rank-1 instances of one node across five systems. That's the payoff for having given SA:V its own node rather than a footnote.

**Countercurrent exchange** deserves similar treatment — fish gills, and it recurs in kidney and in limb circulation in cold climates.

**Misconceptions:** cold-blooded animals are cold (ectotherms in sun are often warmer than you) · veins carry deoxygenated blood (pulmonary vein doesn't) · you breathe because you need oxygen (the trigger is CO₂ buildup) · fever is the infection harming you (it's your response) · nerves are wires carrying electricity (it's an ion gradient wave — back to the membrane unit) · muscles push (they only pull).

**Content:** action potential simulator with ion channels visible · countercurrent gas exchange animation against a concurrent comparison · homeostasis loop widget parameterized across five systems · nephron filtration walkthrough · sarcomere contraction animation reusing the myosin protein piece · fever as regulated set-point shift.

**Retrospective edges are dense here:** hemoglobin → gas transport · membrane transport → nephron and neuron · enzymes → digestion · antibody → immunity · myosin → contraction · ATP → every system. Physiology is where the molecular units cash out, which is a good argument for building it despite the cost.

---

# Diversity

Not really a unit in the same sense. It has few mechanisms of its own and mostly organizes what exists.

**Anchors:** Why are there so many kinds of beetle? What is a species, really? Why can't you catch a disease from a plant? Are viruses alive?

**Nodes (\~20):** Taxonomy · Binomial Nomenclature · Domains (Bacteria, Archaea, Eukarya) · Kingdoms · Phylogenetic Classification · Prokaryote (built) · Protist · Fungi · Plantae · Animalia · Virus · Body Plans · Cladogram (built)

**The one substantive decision:** classification should follow phylogeny, not appearance. Cladistics over Linnaean grouping, shared derived characters over similarity. This is a rank-1 `instance-of Evolution` theme node, and without that framing the unit is a memorization exercise.

**Viruses** are the interesting node — they force the "what is life" question explicitly, connect to the `emerges-at Cell` edge from the scale ladder, and have genuine molecular content (they hijack translation, which is already built).

**Content:** interactive cladogram building from trait matrices · domain comparison table · virus replication animation · the "is it alive" sorter — virus, prion, seed, fire, crystal.

---

## Sequencing among the three

I'd build **ecology first** — cheapest, extends the ladder, and closes the photosynthesis and respiration loops at ecosystem scale. Then **physiology**, which is the real work and the reason your best anchor questions exist. **Diversity last**, or fold it into evolution, since cladistics is already there and the rest is mostly reference material that a table serves better than a graph.

## Ranking caution across all three

Physiology is where prominence-weighting fails hardest. Anatomical detail — chamber names, vessel names, bone names, enzyme names in digestion — is enormously nameable and has near-zero downstream degree. Homeostasis, SA:V, gradients, and countercurrent exchange are the load-bearing nodes and read as background.

Ecology has the opposite risk: the cycles (carbon, nitrogen) are diagram-heavy and rank high, while the energy-vs-matter contrast that explains them gets a sentence.

Same discriminating question throughout, and by this point you have enough graph built that "how many rank-1 paths pass through this node" is an answerable query rather than an estimate.
