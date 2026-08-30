
Initial Prompt: I am building a node-graph navigator for browsing concepts, questions, and content. Everything can be connected, there are no limits on type of connection. There can be groups, and connections can be ranked. There can also be a level above, called Subject if you need. Our topic is Biology 101, how would you organize the material?

## The core recommendation

Biology 101 has a natural spine that most course outlines flatten: **scale**. Molecule → macromolecule → organelle → cell → tissue → organ → organism → population → community → ecosystem. Make that a first-class edge type (`part-of`/ `contained-in`) rather than a chapter ordering. It's the axis students actually get lost on — they know what a mitochondrion is but can't say what level they're currently thinking at.

Layer that against the second axis, which is the one biology textbooks call "big ideas": structure↔function, information flow, energy flow, evolution, homeostasis. I'd make these actual nodes (type `Theme`) rather than tags. They become deliberate high-degree hubs, and "show me everything connected to Structure–Function" is one of the most valuable views your graph can offer.

## Node types

* **Concept** — Osmosis, Natural Selection, Allele

* **Structure** — things that physically exist: Ribosome, Chloroplast, Nephron

* **Process** — Glycolysis, Meiosis, Transcription

* **Question** — "Why does a cell need a boundary?", "Why is sex worth the cost?"

* **Content** — a video, diagram, textbook section, problem set

* **Evidence** — Mendel's pea crosses, Meselson–Stahl, Griffith's transformation

* **Theme** — the five above

Structure and Process are worth separating from Concept because half of biology's difficulty is that students conflate an object with what it does.

## Edge types

Since you allow anything-to-anything, typing edges is what keeps it from turning to mush:

`prerequisite-of` · `part-of` · `instance-of` · `causes` · `regulates` · `transforms-into` · `occurs-in` (localization) · `contrasts-with` · `analogous-to` · `evidence-for` · `answers` · `illustrates`

`contrasts-with` and `analogous-to` are underrated. Mitosis/meiosis, DNA/RNA, prokaryote/eukaryote, artery/vein — these pairs are where the exam questions live, and they're invisible in a pure hierarchy.

## Ranking

I'd use rank for two different jobs, so consider two fields:

**Strength (1–3)** — rank-1 edges form the default spine, the path a student walks if they just keep hitting "next." Rank-2 is enrichment. Rank-3 is "true but only surface on request." Without this, a hub like DNA gets 60 edges and becomes unusable.

**Direction of learning** — whether the edge is a prerequisite you should already have, or a consequence you'll meet later. Same edge, different meaning depending on where the reader stands.

## Groups as views, not folders

The traditional units — Chemistry of Life, Cell Structure, Energetics, Molecular Genetics, Mendelian Genetics, Evolution, Ecology, Form & Function — are fine, but a node should be allowed in several. DNA legitimately belongs to Molecular Genetics, Evolution, and Cell Structure. If groups are homes, you'll fight that constantly; if they're saved queries or overlapping sets, you won't.

## A worked slice

`Membrane Structure` (Structure) connects out as:

* ←`prerequisite-of` **Phospholipid** (rank 1, cross-subject → Chemistry)

* →`enables` **Diffusion**, **Osmosis**, **Active Transport** (rank 1)

* →`part-of` **Cell** (rank 1)

* →`instance-of` **Structure–Function** (Theme, rank 1)

* ←`answers` **"Why does a cell need a boundary?"** (rank 1)

* →`contrasts-with` **Cell Wall** (rank 2)

* →`occurs-in` **Mitochondrion**, **Nucleus** (rank 2 — the same motif reused internally)

* →`illustrates` fluid-mosaic animation (Content, rank 2)

Eight edges, six types, and the node is now reachable from a question, from chemistry, from a theme, and from the scale hierarchy.

## On Subject

Use it. The payoff is marking edges that leave biology — the chemistry prerequisites, the statistics behind Hardy–Weinberg, the physics of diffusion. Those are exactly the edges where students stall, and flagging them as cross-subject lets you offer a bridge instead of a dead end.

## One caution

The freedom to connect anything is the main risk here. Biology is densely interconnected enough that a naive graph becomes a hairball at about 200 nodes. Rank discipline is what saves it — I'd suggest a soft budget of roughly five rank-1 edges per node and enforce it during authoring, not later.

---

What if we use an LLM to generate the ranking? Shall we pre-bake, or allow dynamic ranking based on the user's query?

Hybrid, but the split matters more than the fact that it's hybrid: you're actually ranking two different things and it's tempting to put them in one field.

**Intrinsic strength** — how essential is this edge to understanding this node — is a property of the material. It doesn't change when the user changes. **Query relevance** is a property of the moment. Pre-bake the first, compute the second at request time, and keep them in separate fields so you can tune their weights independently.

## Why the intrinsic layer should be baked

Cost and latency are the obvious reasons, but the real ones are:

**Consistency.** A node-graph navigator earns its keep over plain search by letting people build a spatial memory of the material. "Meiosis is over there, past the chromosome stuff." If the neighborhood rearranges on every query, you've thrown that away and you've just built a search engine with circles. Stability is a feature.

**Auditability.** Baked ranks are an artifact a biology instructor can open, disagree with, and correct. Dynamic ranks can only be re-prompted and hoped at. In an educational product, a wrong prerequisite edge misleads every student who hits it, so you want the correction path to exist.

**Quality.** Offline you can afford to sample the model three times and take consensus, or run a second pass that checks the first. At query time you get one shot at low temperature.

## What dynamic should actually do

Not re-rank from scratch. Treat the baked rank as a prior and let the query perturb it:

```
score = w₁·baked_strength + w₂·query_affinity + w₃·learner_state

```

`query_affinity` doesn't need an LLM at all in the common case — embedding similarity between the query and the node is fast and good enough. Reach for a model when you need to interpret *intent* rather than *topic*: "I don't get osmosis" and "quiz me on osmosis" want different edges surfaced from an identical neighborhood.

That third term is the one people skip and it's often worth more than the LLM. What has this person already visited, what did they get wrong, what's two hops from their frontier. Prerequisite edges should get heavy weight for someone struggling and near-zero for someone who's already mastered the upstream node.

## The middle option

Bake per-intent rather than per-query. Pick five or six modes — first encounter, exam review, stuck/confused, deepening, connecting across units — and store a small rank vector per edge instead of a scalar. You get most of dynamic's adaptivity, keep the auditability, and query time collapses to picking an index and doing a cheap similarity blend.

I'd start here and only add live LLM re-ranking if you can show it beats this on something you're measuring.

## Generating the baked ranks well

A few things that materially change output quality:

* **Don't ask for a 1–3 rating on 60 edges.** Calibration drifts across batches and you'll get a suspicious pile of 2s. Ask for forced choice against a budget: "exactly five of these are essential — which five." Scarcity produces much better discrimination than a Likert scale.

* **Rank within edge type, not across.** A rank-1 `prerequisite-of` and a rank-1 `contrasts-with` are answering different questions and comparing them is meaningless.

* **Use a rubric question per type.** For prerequisites: "could a student correctly explain A without knowing B?" For contrasts: "do students commonly confuse these?" Concrete questions are far more reliable than abstract importance.

* **Ask asymmetrically.** Membrane→Osmosis and Osmosis→Membrane deserve different strengths, and a single symmetric edge weight will feel wrong in one direction.

## Evaluating it

Have the model rank a unit you already have a good syllabus for and check whether the rank-1 subgraph reproduces the teaching order. If the spine doesn't look like a coherent course when you walk it, the ranking is wrong regardless of how sensible each individual edge looks.

---

How would you do Water as a slice?

Water is the best stress test in the whole course, because a naive graph gives it forty edges and it becomes a hairball on its own. It's also the node where the fan-out pattern is cleanest, so it's worth working carefully.

## First decision: don't make Water one node

One `Water` node collecting everything violates the rank-1 budget immediately. Split it into three tiers, where each tier has a different job:

**Cause** → `Water Molecule` (Structure) — polarity, bent geometry **Mechanism** → `Hydrogen Bonding` (Concept) — the single hinge everything routes through **Properties** → cohesion, specific heat, solvency, hydrophobic effect, density anomaly, ionization **Consequences** → the actual biology, attached to properties, never to Water directly

That routing rule is the whole trick. If a downstream consequence attaches to `Water Molecule` rather than to the specific property that causes it, you've lost the explanation and gained a degree.

## The slice

**`Water Molecule`** (Structure, Subject: Biology, bridges to Chemistry)

* ←`prerequisite-of` **Electronegativity**, **Covalent Bond** (rank 1, cross-subject)

* →`causes` **Hydrogen Bonding** (rank 1) — the only mechanism edge it needs

* →`instance-of` **Structure–Function** (Theme, rank 1)

* ←`answers` **"Why is water the medium of life?"** (rank 1)

* →`contrasts-with` **Hydrocarbon / Nonpolar Molecule** (rank 2)

Five rank-1 edges, and it stays legible.

**`Hydrogen Bonding`** — the real hub, fanning to properties at rank 1:

| Property | Rank-1 consequence |
| --- | --- |
| Cohesion & Adhesion | → Transpiration & Xylem Transport |
| High Specific Heat | → Temperature Buffering in Cells & Lakes |
| Evaporative Cooling | → Thermoregulation / Sweating |
| Solvent Properties | → Osmosis, Blood Plasma as Transport Medium |
| Hydrophobic Effect | → Phospholipid Bilayer, Protein Folding |
| Ice Density Anomaly | → Aquatic Overwintering |
| Ionization & pH | → Buffers, Enzyme pH Optima |

Each property node needs its own anchoring question, and these are the ones that make the graph feel alive: *"Why can a tree be a hundred metres tall?"*, *"Why do lakes freeze from the top down?"*, *"Why does a membrane assemble itself?"*

## The edge that justifies the whole project

`Hydrophobic Effect` →`causes` `Phospholipid Bilayer`, rank 1.

In every textbook this is unit 1 and unit 4, two hundred pages apart, and students almost never connect them. The bilayer isn't held together by bonds between the lipids — water's exclusion of nonpolar tails is what does the work. Same for protein folding: the hydrophobic core exists because water pushes it there.

If your graph surfaces that edge and a linear syllabus doesn't, you've demonstrated the value proposition in a single hop. I'd use this slice as your demo.

## Scale behaviour

Water is also the node that tests your `part-of` axis hardest, because it appears at every level: molecule, cytoplasm, tissue fluid, organism (blood, xylem sap), ecosystem (lakes, water cycle). Don't try to place it at one level. Instead attach it via `occurs-in` at each scale and let the navigator show which rung the reader is currently standing on. It's a good early check on whether your scale traversal actually works, since most nodes only sit at one or two levels and won't exercise it.

## Ranking notes for this slice

If you're generating these with a model, water is where calibration goes wrong in a predictable way: it'll rate cohesion and specific heat as equally essential because both are textbook-famous. Ask the discriminating question instead — *could a student explain transpiration without this?* — and the ranks separate properly. Cohesion is load-bearing for xylem transport; specific heat is genuinely secondary to it.

The `contrasts-with` edges also matter more here than usual. Water/lipid, ice/liquid water, hydrophilic/hydrophobic, acid/base. Nearly every misconception in this unit is a failure to hold one of those pairs apart.

So would Polarity be a prerequisite of Water Molecule, or would that property be described on the Water Molecule card?

Neither, quite. Polarity is a prerequisite, but of `Hydrogen Bonding`, not of `Water Molecule` — and *water's* polarity is card content on `Water Molecule`.

The distinction is between the general concept and the particular instance:

* **`Polarity`** — the general idea that unequal electron sharing produces partial charges. A Chemistry-subject node. Reusable across every molecule in the course.

* **"water is polar, δ− at oxygen, δ+ at the hydrogens, because of the bent geometry"** — a specific fact about this molecule. Card content on `Water Molecule`.

So the chain is:

```
Electronegativity → Polarity → [applied to] Water Molecule's bent geometry
                                        ↓
                              Hydrogen Bonding

```

`Polarity` is `prerequisite-of` `Hydrogen Bonding` at rank 1 — you cannot explain an H-bond without it. Its relation to `Water Molecule`is weaker and a different type: something like `instantiated-by` or just `describes`, rank 2. `Water Molecule` is the canonical example of polarity, not a thing that requires the concept to exist.

## The general rule

**Reusable concepts get nodes. Facts about one thing get cards.**

The test: does this appear in the explanation of at least two other nodes, and would a student ever need to arrive at it on its own? Polarity passes on both counts — it's needed for solubility, for amino acid classification, for membrane permeability, for why oil won't mix. It has a life beyond water. "Water's bond angle is 104.5°" fails both; nothing else routes through it.

## Why it matters here specifically

If you inline polarity into the water card, the hydrophobic effect breaks. That node needs polarity too — via *nonpolar*molecules being excluded — and it can't reach a concept that's buried inside a different node's card text. You'd end up re-explaining it, and the two explanations would drift.

That's the real cost of over-inlining: duplicated explanation that silently diverges. The real cost of over-noding is a hairball of thin nodes nobody wants to visit. Polarity is comfortably on the node side of that trade.

## Practical shape of the card

`Water Molecule`'s card should *state* the polarity fact and link out for the concept:

> Oxygen pulls the shared electrons harder than hydrogen does, and the 104.5° bend means those pulls don't cancel — the molecule has a negative end and a positive end. → **Polarity**

Enough to read the card standalone, with the concept one hop away for anyone who needs it. That inline-link-as-edge pattern is worth adopting generally; it makes your rank-2 edges discoverable in context rather than only in a sidebar.

---

How would you organize Macromolecules and Proteins?

Macromolecules is the unit where a graph most obviously beats a textbook, because the textbook is forced to present four independent chapters and the actual structure is one pattern instantiated four times.

## Macromolecules: make the pattern a node

Don't put `Carbohydrate`, `Lipid`, `Protein`, `Nucleic Acid` side by side as four siblings under a `Macromolecules` heading. That's the textbook shape and it hides the point.

Instead make the shared machinery explicit:

* **`Polymer`** — monomers joined into chains

* **`Dehydration Synthesis`** / **`Hydrolysis`** — the universal build/break reaction pair

* **`Functional Group`** — hydroxyl, carbonyl, carboxyl, amino, phosphate, methyl

Each of the four classes then connects `instance-of` → `Polymer` at rank 1, and each has a `Monomer` node hanging off it. The reader who learns dehydration synthesis once gets it four times.

| Class | Monomer | Bond | Rank-1 destination |
| --- | --- | --- | --- |
| Carbohydrate | Monosaccharide | Glycosidic | Energy Storage, Structural Support |
| Lipid | (not a true polymer) | Ester | Membranes, Energy Density |
| Protein | Amino Acid | Peptide | Enzymes, everything else |
| Nucleic Acid | Nucleotide | Phosphodiester | Information Storage |

**Lipid is the productive exception.** It's the one class that isn't a polymer, and students who pattern-match through the unit get this wrong every year. Model it as an explicit `contrasts-with` → `Polymer` at rank 1, flagged as a common misconception rather than quietly omitted. A graph can carry "here is where the pattern breaks" in a way a chapter can't.

Lipid is also where the water slice pays off — `Hydrophobic Effect` → `Phospholipid Bilayer` lands here, and it's the edge that makes membranes feel inevitable rather than arbitrary.

## Proteins: the spine is the levels of structure

Protein is the largest node in Bio 101 and needs the same three-tier treatment you gave water. The organizing axis is the four structural levels, and they form a clean rank-1 causal chain:

```
Amino Acid → Primary → Secondary → Tertiary → Quaternary → Function
    (R groups)   (sequence)  (backbone H-bonds)  (R-group interactions)

```

That chain is the spine. Everything else attaches to a rung, not to `Protein` itself.

* **`Amino Acid`** — 20 of them; the real content is the R-group classification: nonpolar, polar, acidic, basic

* **`Primary Structure`** ← `determined-by` **Gene Sequence** — your bridge to molecular genetics

* **`Secondary Structure`** — α-helix, β-sheet; caused by backbone hydrogen bonding, *not* R groups

* **`Tertiary Structure`** — where R-group chemistry cashes out: hydrophobic core, disulfide bridges, ionic bonds. Routes back to `Hydrophobic Effect` at rank 1.

* **`Quaternary Structure`** — multiple subunits; hemoglobin as the canonical case

* **`Denaturation`** — `contrasts-with` the whole chain; the experiment that proves shape is everything

The most valuable single edge in the unit: **`Amino Acid R-Group` → `causes` → `Tertiary Structure` → `causes` → `Function`**, rank 1 throughout. Sickle cell is the demo — one amino acid substitution, hydrophilic to hydrophobic, propagating all the way to a clinical phenotype. That's four hops of pure causation and it's exactly what a navigator should be able to walk.

## Enzymes

I'd keep `Enzyme` as a child of `Protein` rather than a sibling, connected `instance-of` at rank 1, with its own subtree: active site, substrate specificity, activation energy, induced fit, inhibition, cofactors. It's big enough to deserve the space, but it makes no sense detached from tertiary structure — the active site *is* a tertiary structure feature.

`Enzyme` → `Metabolism` is then your rank-1 bridge into the energetics unit.

## Where this unit connects out

Three rank-1 edges leave macromolecules and they're the ones that make the course cohere:

* **Protein → Gene Expression** (primary structure is written by DNA)

* **Phospholipid → Membrane** (via the hydrophobic effect)

* **Enzyme → Metabolic Pathway** (into cellular respiration)

## Ranking caution

The failure mode here is that a model will rank all four macromolecule classes identically, because textbooks give them equal page counts. They aren't equal. Protein has vastly higher downstream degree — enzymes, membranes, transport, signalling, immunity, contraction all route through it — and your rank-1 spine should reflect that. Ask "how many rank-1 paths later in the course pass through this node" rather than "how important is this," and protein separates from carbohydrate immediately.

---

How would you do Cellular Respiration?

Respiration is the node where students memorize a pipeline and understand nothing, so the structural decision matters more here than anywhere else in the course.

## First decision: the stages aren't the spine

The obvious model is a four-node chain — glycolysis → pyruvate oxidation → Krebs → electron transport chain. That's what gets memorized and it's exactly the representation that produces students who can recite the stages and can't say why oxygen is needed.

The actual through-line is **electron carriers**. The first three stages exist to strip electrons off glucose and load them onto NAD⁺ and FAD; the last stage cashes them in. Model it that way and the whole thing becomes one idea instead of four:

```
Glucose --[oxidized]--> CO₂
   |                      ↑
   └─ electrons ─→ NADH/FADH₂ ─→ ETC ─→ Proton Gradient ─→ ATP Synthase ─→ ATP
                                            |
                                            └─ O₂ accepts spent electrons

```

So `NADH / Electron Carriers` is your hub node, sitting at rank 1 with every stage. The stages connect to each other with `precedes` at rank 2 — sequence is real but it's not the explanation.

## The slice

**`Cellular Respiration`** (Process)

* ←`prerequisite-of` **Redox** (rank 1, cross-subject → Chemistry). The single biggest omission in most Bio 101 treatments.

* ←`prerequisite-of` **ATP**, **Enzyme**, **Mitochondrion** (rank 1)

* →`instance-of` **Energy Flow** (Theme, rank 1)

* ←`answers` **"Where does the energy in food actually go?"** (rank 1)

* →`contrasts-with` **Photosynthesis** (rank 1)

**Stage nodes**, each carrying location and carrier yield as card content:

| Stage | Location | Loads | Direct ATP |
| --- | --- | --- | --- |
| Glycolysis | Cytosol | 2 NADH | 2 (substrate-level) |
| Pyruvate Oxidation | Matrix | 2 NADH | 0 |
| Krebs Cycle | Matrix | 6 NADH, 2 FADH₂ | 2 (substrate-level) |
| ETC + Chemiosmosis | Inner membrane | — | \~26–28 (oxidative) |

That last column is worth its own `contrasts-with` edge: **substrate-level phosphorylation** vs **oxidative phosphorylation**. Students merge them and then can't explain why fermentation yields so little.

## The edges that do the real work

**`Chemiosmosis` as a reusable concept, not a respiration detail.** Proton gradient across a membrane, ATP synthase as a turbine. Make it its own node with `instance-of` edges from *both* the mitochondrial ETC and the thylakoid light reactions, rank 1 in both directions. Learned once, used twice — and it retroactively explains why membranes matter, linking back to the phospholipid bilayer.

**`Oxygen` →`final electron acceptor`→ `ETC`**, rank 1, flagged as misconception. The near-universal wrong model is that oxygen "burns" the sugar. It doesn't touch the glucose; it sits at the end of the chain mopping up spent electrons. This edge is the fix, and it's what makes `Fermentation` comprehensible rather than arbitrary.

**`Fermentation`** →`contrasts-with` `Cellular Respiration`, rank 1. Anchoring question: *"Why do your muscles burn when you sprint?"* Its real job in the graph is to demonstrate what happens when the carrier pool can't be recycled — it's the negative control for the whole electron-carrier story.

## Anchoring questions

The unit needs these more than any other, because the mechanism is so abstract:

* *"Why do we breathe?"* — and specifically, why do we exhale carbon?

* *"Why can't you hold your breath and keep running?"*

* *"If a mitochondrion is a battery, what's the voltage?"* — the proton gradient

* *"Why does eating fat give more energy than eating sugar?"* — bridges back to macromolecules

## Where it connects out

* **Mitochondrion** → and onward to **Endosymbiotic Theory**, which is a rank-1 bridge to evolution. Cheap edge, disproportionate payoff.

* **Enzyme** → the entire pathway is enzyme-catalysed; ties back to protein structure

* **Photosynthesis** → the reciprocal pair; ideally taught as one system, which is exactly what a graph can do and a linear syllabus can't

* **Membrane** → chemiosmosis requires an intact impermeable barrier

## Ranking caution

A model ranking this unit will almost certainly over-weight the Krebs cycle, because it has the most named intermediates and the most textbook real estate. Citrate, isocitrate, α-ketoglutarate — none of that is load-bearing for anything downstream in Bio 101. Meanwhile chemiosmosis has enormous downstream degree and usually gets a page and a half.

Apply the same test as before: *how many rank-1 paths later in the course pass through this node?* Chemiosmosis wins by a wide margin, Krebs drops to rank 2 for its intermediates while keeping rank 1 for its carrier output. If your generated ranks put the Krebs intermediates above chemiosmosis, that's a good signal your rubric prompt is measuring page count rather than explanatory load.

Would it still create a graph linking the steps?

Yes: Ranking changes what's emphasized and what surfaces first, not what exists. The full sequential chain is there:

```
Glucose → Glycolysis → Pyruvate → Pyruvate Oxidation → Acetyl-CoA → Krebs → ETC
                          |
                          └─ Fermentation (when O₂ absent)

```

Every `precedes` edge, every intermediate, every stage node. A student who wants the classic pipeline view gets exactly the classic pipeline view, and a "show pathway order" traversal walks it cleanly.

What changes is only which edges are load-bearing for *explanation*. The carrier hub is what answers "why does this work"; the sequence answers "what happens next." Both are real questions and your graph should serve both.

## That said, I under-ranked sequence

Re-reading my rank-2 call — I think that was too harsh for this unit specifically. Respiration is one of the few places in Bio 101 where temporal order is genuinely causal rather than merely expository: pyruvate oxidation *cannot* occur before glycolysis, because glycolysis produces its substrate. That's not curricular convention, it's a real dependency.

Better modelling: use `produces` / `consumes` edges on the intermediates rather than a generic `precedes`.

| Stage | Consumes | Produces |
| --- | --- | --- |
| Glycolysis | Glucose | Pyruvate |
| Pyruvate Oxidation | Pyruvate | Acetyl-CoA |
| Krebs | Acetyl-CoA | CO₂ |

Those are rank 1 — they carry the same ordering information but explain *why* the order holds. The sequence then falls out of substrate dependency rather than being asserted separately. You get order and mechanism from one edge type.

## Fermentation isn't in the chain

Worth being precise here, because the linear textbook layout misleads on this: fermentation isn't a fifth step. It branches from pyruvate as an alternative fate.

* `Pyruvate` →`fate-of`→ **Pyruvate Oxidation** (O₂ present)

* `Pyruvate` →`fate-of`→ **Fermentation** (O₂ absent)

A branch node, not a link in a chain. This is where a graph is straightforwardly better than a page — the fork is visible, and the reason for the fork (regenerating NAD⁺ so glycolysis can continue) sits on the branch edge itself.

## So the practical answer

You end up with both structures overlaid on the same node set: a linear substrate chain and a carrier hub. Two views, one graph. Which one is the default entry depends on the reader's intent — which is exactly the per-intent rank vector from earlier. First encounter and exam review probably want the sequence; "I don't get it" wants the carriers.

---

How would you go about adding content to this graph?

Two quite different problems get called "adding content," and they need opposite approaches:

1. **Building the skeleton** — the \~250 nodes and their typed, ranked edges

2. **Attaching material** — videos, diagrams, readings, problem sets to existing nodes

Skeleton first, always. If you attach material before the node structure is settled, every restructure orphans things and you'll stop restructuring.

## Building the skeleton

**Don't ask a model to generate the graph.** "Produce a knowledge graph for Bio 101" gives you plausible mush — the density is wrong, the ranks are uniform, and you can't tell what's missing. Go unit by unit, node by node, with the model doing one bounded job at a time:

* *Enumerate the nodes for this unit.* Nouns only, no edges yet.

* *For this node, what must a student already know?* → prerequisite candidates.

* *What does this node make possible?* → downstream candidates.

* *What is this commonly confused with?* → `contrasts-with`, and these are the highest-value edges in the whole graph.

Deduplicate across units by hand or by embedding similarity. That's where you'll catch `Polarity` being independently invented three times.

**Start with the questions, not the concepts.** Write the fifty questions the course should let someone answer — *why does a tree not collapse under its own weight, why do lakes freeze from the top, why does one amino acid substitution cause sickle cell*. Then build backward: every node must lie on a path answering at least one question. Anything that doesn't is a candidate for deletion or demotion to card content. This is the single most effective filter I know for keeping a course graph from bloating, and it's much easier than pruning after the fact.

**Bake ranks after all edges exist**, not during creation. Forced choice against a budget, within edge type, as discussed.

## The single best QA move

Walk the rank-1 subgraph as a linear path and see whether it reads like a coherent course. Nothing else catches structural error as cheaply. Specifically look for:

* **Cycles in prerequisites.** A→B→A means one of them is mistyped — usually a `causes` edge labelled `prerequisite-of`.

* **Orphans.** No rank-1 inbound edge and it isn't an entry point? Either it's unreachable or you're missing the edge that matters.

* **Hairballs.** Anything over \~8 rank-1 edges needs splitting — that's the signal that told you to break Water into molecule/mechanism/properties.

* **Unit bridges.** Count the rank-1 edges crossing between units. If it's near zero you've built eight disconnected textbook chapters, and the graph is adding nothing.

Then have a biologist review the rank-1 spine only. It's maybe 15% of the edges and it carries nearly all the pedagogical risk — a wrong rank-3 `analogous-to` is a curiosity, a wrong rank-1 prerequisite misleads everyone.

## Attaching material

Different rules apply. Content nodes are cheap and low-risk, so be permissive where you were strict about concepts.

**Attach to the most specific node that fits.** A video on the electron transport chain goes on `ETC`, not on `Cellular Respiration`. Generic parent-node attachment is how these systems degrade into a pile of links nobody clicks.

**Type the relationship, not just the resource.** `explains` vs `demonstrates` vs `tests` vs `applies` are genuinely different needs. Somebody stuck wants an explainer; somebody revising wants problems. Same node, different content, and your per-intent ranking already knows which mode they're in.

**Let one item attach to several nodes.** A sickle-cell case study legitimately serves `Amino Acid`, `Tertiary Structure`, `Point Mutation`, and `Natural Selection`. Multi-attachment is the point — it's how a resource gets found from four directions.

For ingesting existing material, the tractable pipeline is: chunk it, embed it, propose the top few node matches per chunk, and have a human confirm. Don't let a model attach unsupervised; precision matters more than coverage here, because a mis-attached resource is worse than a missing one.

## Sequencing

I'd do one unit end to end before touching the rest — macromolecules and proteins is the right pilot, since it has clear internal structure and three strong outbound bridges. Build it fully, walk the spine, attach a dozen real resources, then look at whether the navigation actually feels better than a contents page. You'll learn more from that than from getting 250 nodes half-right.

---

Proteins

Here's the pilot unit built out end to end — questions first, then nodes, then edges, then the QA walk.

## 1. Anchoring questions

Every node below has to sit on a path answering at least one of these, or it gets demoted to card content.

* Why does changing one amino acid out of 146 cause sickle cell disease?

* Why is a fever above 40 °C dangerous?

* Why can't you un-cook an egg?

* How does a floppy chain become a machine with a specific job?

* Why does an enzyme only act on one substrate?

* Why does a change in pH shut an enzyme down?

* Why does eating protein not directly become your protein?

* What decides which amino acid goes where?

## 2. The mechanism hinge

Same move as water. Don't wire the four bonding forces straight into tertiary structure — route them through one node:

**`R-Group Interactions`** (Concept, rank-1 hub) ← hydrophobic effect · hydrogen bonding (R-group) · ionic bonds · disulfide bridges · van der Waals

This keeps `Tertiary Structure` at five rank-1 edges instead of nine, and it gives you a single place to say the thing that actually matters: *the side chains are what fold the protein.* Two of its inputs — hydrophobic effect and hydrogen bonding — are reused nodes from the water unit, not new ones.

## 3. The spine

```
Gene Sequence
     ↓ determines
Amino Acid ──→ R-Group ──→ R-Group Interactions
     ↓ joined by peptide bonds          ↓ causes
Primary Structure                  Tertiary Structure
     ↓ backbone H-bonds → Secondary ────┘    ↓ causes
                                        Function

```

The critical distinction, and the one students reliably miss: **secondary and tertiary have different causes.** Secondary is backbone hydrogen bonding, indifferent to which side chains are present. Tertiary is entirely side-chain driven. Model these as two separate `caused-by` edges from two separate sources, never as one continuous folding process.

## 4. Node inventory (\~34)

**Foundation** — Amino Acid · R-Group · Peptide Bond · Polypeptide **Levels** — Primary · Secondary (α-helix, β-sheet) · Tertiary · Quaternary **Forces** — R-Group Interactions · Disulfide Bridge · Ionic Bond · Van der Waals *(+ reused: Hydrophobic Effect, Hydrogen Bonding)* **Dynamics** — Protein Folding · Denaturation · Misfolding **Function classes**— Enzyme · Structural · Transport · Receptor · Antibody · Motor **Enzyme subtree** — Active Site · Substrate · Induced Fit · Activation Energy · Specificity · Optimal Conditions · Competitive Inhibition · Allosteric Regulation · Cofactor · Feedback Inhibition

## 5. Key edges

| From | Type | To | Rank |
| --- | --- | --- | --- |
| Gene Sequence | determines | Primary Structure | 1 |
| Amino Acid | polymerized-by | Peptide Bond → Polypeptide | 1 |
| R-Group | causes | R-Group Interactions | 1 |
| Hydrogen Bonding (backbone) | causes | Secondary Structure | 1 |
| R-Group Interactions | causes | Tertiary Structure | 1 |
| Tertiary Structure | causes | Function | 1 |
| Tertiary Structure | contains | Active Site | 1 |
| Denaturation | destroys | Tertiary/Quaternary | 1 |
| Denaturation | preserves | Primary Structure | 1 |
| Enzyme | instance-of | Protein | 1 |
| Enzyme | lowers | Activation Energy | 1 |
| Protein | instance-of | Structure–Function (Theme) | 1 |
| Hemoglobin | instance-of | Quaternary Structure | 2 |
| Prion / Amyloid | instance-of | Misfolding | 2 |

That denaturation pair is worth its own attention. Cooking destroys 2°/3°/4° but leaves primary intact, because peptide bonds are covalent and the folding forces are not. Stating both edges — one `destroys`, one `preserves` — is what makes irreversibility comprehensible instead of just asserted.

## 6. Misconception edges

These are the highest-value edges in the unit and they don't appear in any textbook's structure.

| Common wrong model | Edge |
| --- | --- |
| Levels form in sequence: 1° then 2° then 3° | `Protein Folding` →`corrects`→ *it's simultaneous and co-translational; the levels are a description scheme, not a timeline* |
| Denaturation breaks the protein into amino acids | `Denaturation` →`contrasts-with`→ `Hydrolysis` |
| Heat "kills" enzymes like a poison | `Optimal Conditions` →`explained-by`→ `Tertiary Structure` — heat unfolds, it doesn't destroy |
| All bonding in folding is the same kind | `R-Group Interactions` — five distinct forces, different strengths |
| Eating collagen builds collagen | `Hydrolysis` →`precedes`→ `Translation` — it's dismantled to monomers first |

## 7. The showcase path

Six hops of pure causation, and the reason this unit is the right pilot:

```
Point Mutation → Primary Structure (Glu→Val) → hydrophobic patch on surface
    → aggregation into fibres → Quaternary Structure → sickled cell
    → phenotype → malaria resistance → Natural Selection

```

One `contrasts-with` edge on `R-Group` — charged vs nonpolar — is what makes the second hop explicable. Without it, "one amino acid changed" is just a fact. With it, it's a mechanism.

## 8. Outbound bridges (rank 1)

* `Primary Structure` ← **Gene Expression** — the central dogma's landing point

* `Enzyme` → **Metabolic Pathway** — into respiration

* `Transport Protein` → **Membrane** — channels, pumps, and back to the bilayer

* `Tertiary Structure` ← **Hydrophobic Effect** — back to water, the unit's payoff edge

* `Point Mutation` → **Natural Selection** — into evolution

Five bridges out of one unit. That's a healthy number; if a unit you build has fewer than three, it's probably modelled as a chapter rather than a region.

## 9. QA walk

**Cycle check.** `Protein Folding` and `Tertiary Structure` will circularly define each other if you're careless. Fix: folding is the *process*, tertiary is the *result*. `Protein Folding` →`produces`→ `Tertiary Structure`, one direction only.

**Hairball check.** Tertiary sits at five rank-1 edges after the hinge refactor. Enzyme is the remaining risk — with ten children it's arguably its own unit, not a subtree. I'd leave it merged for the pilot and watch whether readers treat it as a destination or a waypoint.

**Orphan check.** Van der Waals and Motor Protein have thin inbound rank-1 traffic. Both are legitimately rank 2 for Bio 101.

**Question coverage.** All eight anchoring questions resolve on rank-1 paths. The perm/disulfide question I dropped — it only reaches `Disulfide Bridge` and nothing downstream, which is exactly the filter working.

## 10. Ranking caution for this unit

A model ranking these will over-weight the twenty amino acid names and the α-helix/β-sheet nomenclature, because that's where the memorization pressure and the page count are. Neither has much downstream degree. It will under-weight `R-Group Interactions`, which barely exists as a named concept in textbooks but carries nearly every explanatory path in the unit.

Same discriminating question as before: how many rank-1 paths later in the course run through this node. Ask that and the R-group hinge separates from the nomenclature immediately.

---

How does water connect to macromolecules?

This is the pair of units where the cross-links are densest, and where a linear syllabus loses the most. Water is chapter 2 and macromolecules is chapter 3, adjacent on the page and rarely connected in students' heads.

## The four bridges

**1. Water is the reagent in the universal reaction**

`Dehydration Synthesis` removes a water molecule to form every bond in every polymer. `Hydrolysis` adds one back to break it. Not four separate chemistries — one, repeated across all four classes.

* `Water` →`consumed-by`→ `Hydrolysis` (rank 1)

* `Water` →`produced-by`→ `Dehydration Synthesis` (rank 1)

This is the most literal connection and the most under-taught. Building a protein of 300 residues releases 299 water molecules. Digestion is just the reverse, run enzymatically.

**2. Water's exclusion is what folds things**

The big one, and the one you already have wired from both directions:

* `Hydrophobic Effect` →`causes`→ `Phospholipid Bilayer` (rank 1)

* `Hydrophobic Effect` →`causes`→ `Tertiary Structure` (rank 1, via `R-Group Interactions`)

Same physics, two destinations, opposite units in the textbook. Membranes assemble and proteins fold for identical reasons: water reorganizing to minimize contact with nonpolar surfaces. If a reader can traverse from water to both of these, the graph has earned itself.

Worth being precise on the card: it isn't attraction between the nonpolar parts. It's water's own hydrogen-bond network pushing them together. Students get this backwards almost universally, so it deserves a misconception edge.

**3. Solubility sorts the macromolecules**

`Polarity` — the general concept node, already reused from the water unit — is what determines which macromolecules dissolve and which don't:

| Class | Behaviour in water | Consequence |
| --- | --- | --- |
| Carbohydrate | Hydrophilic (many hydroxyls) | Transported free in blood as glucose |
| Protein | Mixed — polar surface, nonpolar core | Folds; soluble globular vs insoluble fibrous |
| Nucleic Acid | Highly hydrophilic (phosphate backbone) | Stays dissolved in nucleus/cytosol |
| Lipid | Hydrophobic | Needs carriers (lipoproteins) to move in blood |

That last row is a nice payoff — *why does cholesterol need a "carrier" but glucose doesn't* is answered entirely by polarity, and it reaches all the way to why blood lipid panels exist.

**4. Water shapes the double helix too**

Less commonly drawn, but real: the phosphate backbone faces outward because it's charged, and the bases stack inward partly to escape water. Same hydrophobic logic as the bilayer and the protein core, third instance.

* `Hydrophobic Effect` →`contributes-to`→ `DNA Structure` (rank 2)

## The generalization worth making explicit

Three of those bridges are the same idea. I'd consider a small hub node:

**`Amphipathic`** — molecules with both a polar and a nonpolar region — with `instance-of` edges from `Phospholipid`, `Globular Protein`, and `Detergent`. It's the concept that makes "water sorts molecules into an inside and an outside" reusable rather than something rediscovered three times.

That's the same node/card judgment from earlier: amphipathic passes the test because it's needed in at least two places and someone might legitimately arrive at it directly.

## Why this pairing is the argument for the whole project

If you want one demo, walk this: start at `Water Molecule`, two hops through `Hydrogen Bonding` and `Hydrophobic Effect`, and land simultaneously on membrane assembly, protein folding, and DNA structure — three chapters, three units, one cause.

A textbook physically cannot present that. It has to pick an order. Your graph doesn't.

---

And how would you do your initial recommendation of scale?

Here's the numbering I've been using, made explicit:

| \# | Level | Examples from your units |
| --- | --- | --- |
| 1 | Molecule | Water, amino acid, glucose, ATP, nucleotide |
| 2 | Macromolecule | Protein, DNA, cellulose, phospholipid |
| 3 | Organelle | Mitochondrion, nucleus, ribosome, membrane |
| 4 | Cell | Red blood cell, neuron, prokaryote |
| 5 | Tissue | Epithelium, xylem, muscle tissue |
| 6 | Organ | Heart, leaf, kidney |
| 7 | Organism | Human, oak, *E. coli* |
| 8 | Population | Herd, bacterial colony, gene pool |
| 9 | Community | All species in a pond |
| 10 | Ecosystem | Pond including water, soil, light |

That's what makes the earlier table consistent — protein at 2, mitochondrion at 3, respiration occurring at 4, natural selection emerging at 8.

## Three things I left out, deliberately

**Atom / subatomic below 1.** Electrons and protons matter for electronegativity and redox, but they belong to the Chemistry subject. Better handled as a cross-subject bridge than as rung 0.

**Organ system between 6 and 7.** Genuinely a rung in most textbooks — circulatory, digestive, nervous. I collapsed it because Bio 101 rarely reasons at that level distinctly from organ, and every extra rung costs you resolution in the gutter display. If your course does a physiology unit properly, insert it and shift 7–10 up by one. Decide before you populate; renumbering later is annoying.

**Biosphere above 10.** Only appears in the climate/biogeochemistry section, if at all. Fold it into 10 unless ecology is a major unit for you.

## The soft joints

Two boundaries won't hold cleanly and it's better to know which:

**1↔2 (molecule/macromolecule).** Where does a molecule become a macromolecule? A dipeptide isn't one; a 300-residue protein is. There's no principled cutoff. I'd use "is it a polymer or a lipid aggregate" as the working rule and accept a few judgment calls.

**2↔3 (macromolecule/organelle).** The phospholipid bilayer, as flagged. Also ribosomes, which are complexes of RNA and protein and sit uncomfortably at both. Assign by function — if it's a functional subcellular unit, call it 3.

If a node genuinely straddles, null the level and let its `part-of` edges do the placement rather than forcing a number.

Extra clarification:

## Scale is a property; part-of is an edge

**Scale level** should be an attribute on the node — an integer 1–10 from the ladder. Every node carries one. It's free, it needs no edges, and it's what lets you filter, colour, and say "you are here."

**`part-of`** should be an edge between *specific instances*. `Mitochondrion` is part-of `Cell`. `Nephron` is part-of `Kidney`. These are real containment facts about real things.

The ladder itself — molecule → organelle → cell → tissue — is then the *type-level* schema. It's not a set of edges between your content nodes; it's the axis those nodes are placed on. Don't create edges asserting "Organelle is part-of Cell" as abstract nodes, or you'll have a parallel skeleton nobody visits that duplicates the real containment facts.

So: one integer attribute, plus concrete `part-of` edges wherever actual containment holds.

## Why the attribute earns its keep

Three things it gives you that edges alone don't:

**Orientation.** Show the ladder as a persistent gutter with the current level lit. This is the cheapest possible fix for the most common form of student disorientation — knowing what a mitochondrion is, not knowing what size of thing you're currently reasoning about.

**Traversal control.** "Stay at this level" versus "go up" versus "go down" are genuinely different navigation intents. With a level integer you can filter neighbours by Δlevel: same-level edges are lateral reasoning, +1 is zooming out, −1 is mechanism.

**A QA signal.** Any rank-1 edge spanning more than about two levels is suspicious — usually a skipped intermediate. `DNA` → `Phenotype` jumps six rungs and is almost certainly missing `Protein` and `Cell`. Scanning for large Δlevel on rank-1 edges is a cheap structural audit that catches real gaps.

## Where the ladder breaks

Three honest problems, and how I'd handle each.

**Processes have no level.** Glycolysis isn't at a scale — it *occurs at* one. Use `occurs-at` rather than forcing a level attribute, or better, let the process inherit level from its location: glycolysis in the cytosol is cell-level, transpiration is organism-level. Concepts like `Polarity` and `Redox` have no level at all, and that's fine — leave it null rather than inventing one.

**Multi-level nodes.** Water is the case you'd flagged. It appears as a molecule, as cytoplasm, as xylem sap, as a lake. Don't pick one. Give it a null primary level and multiple `occurs-in` edges at different rungs — that's precisely the behaviour the navigator should show.

**The ladder isn't uniform.** Plants have no organs in the animal sense, single-celled organisms collapse four rungs into one, and macromolecule-vs-molecule is a soft boundary. Treat the ladder as a default frame with documented exceptions rather than an invariant, and don't let a validator reject nodes that legitimately don't fit.

## Two containment relations, not one

Worth splitting, because they're different claims:

* **`part-of`** — structural containment. Mitochondrion in cell, cell in tissue.

* **`member-of`** — set membership at the population levels. Organism in population, population in community.

An organism isn't a *part* of a population the way an organelle is part of a cell; you can remove it and both persist. Merging these makes the ecology levels behave oddly under traversal, and it's a one-line fix to keep them separate.

## The `emerges-at` edge

The most valuable scale edge isn't containment at all. It's marking where a property first appears that its components don't have:

* `Life` emerges-at Cell — no organelle is alive

* `Consciousness` emerges-at Organism

* `Evolution` emerges-at Population — an individual cannot evolve

* `Nutrient Cycling` emerges-at Ecosystem

That last one is the fix for a genuinely common misconception: students describe individual organisms adapting. Modelling evolution as emerging at the population level, structurally, does more than a warning box.

## Sanity check against your existing units

Run the ladder over what you've built and it holds up, with informative exceptions:

| Node | Level | Note |
| --- | --- | --- |
| Water Molecule | 1 |  |
| Polarity | — | concept, no level |
| Amino Acid | 1 |  |
| Protein | 2 |  |
| Phospholipid Bilayer | 2→3 | boundary case; it *is* the organelle boundary |
| Mitochondrion | 3 |  |
| Chemiosmosis | occurs-at 3 | process |
| Cellular Respiration | occurs-at 4 |  |
| Natural Selection | emerges-at 8 | population |

The bilayer sitting between rungs is the interesting one, and I'd resist forcing it. Membranes are exactly the thing that creates the molecule/organelle boundary — the ladder has a rung there *because* of the bilayer, not the other way round.

---

How shall we handle content rendering scale of ball-and-stick, ses surface, mesoscale, microscope photos, etc?

This is a second axis, and the important thing is that it's genuinely independent of the scale ladder. The same protein can be shown as ball-and-stick, ribbon, SES surface, or a schematic blob — all level 2, all different representations. Conflating representation with scale will cause trouble immediately.

## The axis

Roughly ordered by abstraction rather than size:

| Mode | What it shows | Where it fits |
| --- | --- | --- |
| Formula / notation | H₂O, chemical equations | 1 |
| Ball-and-stick | Bond geometry, angles | 1–2 |
| Space-filling (CPK) | Actual volume, packing | 1–2 |
| Ribbon / cartoon | Fold topology | 2 |
| SES / molecular surface | Shape, charge, pockets | 2 |
| Schematic diagram | Function, abstracted | any |
| Mesoscale illustration | Crowding, relative scale | 3–4 |
| Micrograph (LM, EM) | Real appearance | 3–6 |
| Photograph | Real appearance | 6–10 |
| Model / animation | Dynamics over time | any |

Store it as an attribute on the Content node — `representation: ses_surface` — alongside the scale level of the node it attaches to.

## The key point: mode encodes what's being taught

Representation isn't a rendering preference, it's a claim about which property matters. That means the choice should be driven by the edge type, not by what looks nicest:

* Explaining **polarity** → ball-and-stick, because you need to see the 104.5° bend and where the charge sits. A space-filling model hides the geometry.

* Explaining **hydrophobic core** → SES with hydrophobicity colouring. Ball-and-stick makes this invisible.

* Explaining **active site specificity** → SES, because the pocket shape *is* the explanation.

* Explaining **fold topology** → ribbon. Everything else is noise.

* Explaining **why a cell isn't a bag of dilute soup** → mesoscale illustration, and nothing else works.

So your Content attachment should carry both the mode and the reason: `illustrates` + `representation: ses` + a note on what it's showing. That way a reader who asks "why is this enzyme specific" gets the surface render, not the ribbon.

## Two things worth building in

**Mode ladders on a single node.** For big nodes like `Protein` or `Membrane`, offer the same object across several modes with an explicit transition. Ball-and-stick → space-filling → ribbon → SES for a protein is a genuinely useful sequence, because each step discards information deliberately. Making the discard visible is the teaching move — students think a ribbon *is* what a protein looks like.

**Scale bars and honesty flags.** Two specific misconceptions come from rendering, and both are correctable with metadata:

* *Colour.* Atoms aren't red and white; proteins aren't rainbow. Flag colour as conventional vs meaningful (CPK convention vs hydrophobicity mapping vs arbitrary).

* *Emptiness.* Almost every textbook diagram shows a cell with five organelles in clear space. The mesoscale illustrations — Goodsell-style — are the correction, and I'd attach one to `Cell` at rank 1 specifically as a misconception fix rather than as decoration.

## Micrographs

These need their own small attribute set because the imaging method constrains what's true in the picture:

`LM` (colour, live, \~200 nm limit) · `TEM` (internal, greyscale, fixed/dead, false colour if any) · `SEM` (surface topography, always false-coloured) · `fluorescence` (only what's labelled is visible)

That last one matters more than it looks. A fluorescence image showing green mitochondria doesn't mean everything else is absent — it means nothing else was stained. Students read absence into these constantly. An `imaging_method`attribute lets you surface the caveat automatically rather than relying on each caption to say it.

## Where this intersects your ranking

Representation mode is a good candidate for the per-intent rank vector. First encounter probably wants schematic; deepening wants SES or micrograph; "I don't get it" often wants the mesoscale or the real photo, because abstraction is frequently the thing causing the confusion. Same content node set, different default render per mode — which is exactly the shape you already have for edges.

I have interactive modules that can render a protein with ball-and-stick, spheres, SES.

Then treat the module as a single Content node with mode as a *parameter*, not as three separate content nodes. That's the main modelling decision, and it changes what the edges can do.

## The shape

```
Content node: protein_viewer
  attachable_to: any node with a structure ID
  parameters: pdb_id, mode, coloring, highlight_residues, camera

```

The edge from a concept node carries the parameters:

```
Tertiary Structure --illustrates--> protein_viewer
    { pdb: 1HHO, mode: ses, coloring: hydrophobicity }

Active Site --demonstrates--> protein_viewer
    { pdb: 1AKE, mode: ses, highlight: [12,15,84], camera: pocket }

Peptide Bond --explains--> protein_viewer
    { pdb: 1UBQ, mode: ball_stick, highlight: backbone }

```

One module, many attachments, each arriving pre-configured for the concept that sent you there. This is what you can't do with static images — the entry state carries pedagogical intent.

## Why parameterized beats three nodes

Three separate nodes triples your attachment work and loses the connection between them. As one parameterized node, you get:

**Mode switching as the lesson.** Land on ball-and-stick, toggle to spheres, and the reader sees that the "empty space" between bonds isn't empty. That transition is the teaching moment. Toggle to SES and the interior vanishes entirely — which is the point about what a substrate can actually reach. Three static images can't say this; a toggle says it in two seconds.

**Correct default per entry point.** Same viewer, same molecule, different opening state depending on which concept sent you. The reader who arrived from `Specificity` opens on the surface with the pocket framed. The reader from `Peptide Bond` opens on sticks.

**One integration surface.** Your renderer changes, the graph doesn't.

## Worth adding: a rationale field on the edge

Not just the mode, but why that mode. `"the pocket shape is the explanation — sticks make it invisible"`. Cheap to write, and it survives handoff — the next person to touch the unit knows why the surface render was chosen and doesn't 'improve' it to a ribbon.

It also lets you do the honest thing when the reader switches away from the recommended mode: a small note saying what they've stopped being able to see.

## Add ribbon if you haven't

Ball-and-stick, spheres, and SES cover atoms and surface, but nothing in that set shows fold topology. Secondary structure — α-helix, β-sheet — is essentially invisible in all three at protein scale. If the module can do cartoon/ribbon, it closes the gap between `Secondary Structure` and everything else in your protein unit. If it can't, that's a real limitation worth knowing, and those nodes may need static images as a fallback.

## Highest-value attachments in your existing units

If you're picking where to wire it first:

| Node | pdb | mode | Shows |
| --- | --- | --- | --- |
| Sickle Cell / Point Mutation | 2HBS vs 1HHO | SES, hydrophobicity | The one surface patch that causes everything |
| Active Site | 1AKE | SES, pocket framed | Shape complementarity |
| Tertiary Structure | any globular | SES → spheres toggle | Hydrophobic core, buried |
| Denaturation | folded/unfolded pair | spheres | Same atoms, no shape |
| Membrane Transport | aquaporin 1J4N | SES, channel cutaway | Selectivity by pore geometry |

The sickle-cell one is the demo. Two structures, identical except one residue, side by side with hydrophobicity colouring — the entire six-hop causal chain from your protein unit becomes visible in one image. That's the attachment I'd build first.

## One caution

Interactive modules invite over-attachment because they're impressive. Resist wiring the viewer to every protein-adjacent node. If the reader can't say what they were supposed to notice, the attachment is decoration and it dilutes the ones that matter. The rationale field is a decent forcing function here — if you can't write the sentence, don't make the edge.

---

What would your ideal content set be for Proteins?

Working from the \~34 nodes in the protein unit. I'd aim for roughly 30 pieces, not 100 — coverage is less valuable than every attachment having a defensible reason.

## The core ten

If you build nothing else, build these.

| \# | Content | Mode | Attaches to | Shows |
| --- | --- | --- | --- | --- |
| 1 | **Sickle cell comparison** — 1HHO vs 2HBS side by side | Viewer, SES + hydrophobicity | Point Mutation, Primary Structure, R-Group | One residue, one surface patch, whole phenotype |
| 2 | **Fold stripper** — same protein through sticks → spheres → SES → ribbon | Viewer, mode toggle | Tertiary Structure | What each representation discards |
| 3 | **Hydrophobic core cutaway** — clipping plane through a globular protein | Viewer, SES + polarity colouring | R-Group Interactions, Hydrophobic Effect | Nonpolar inside, polar outside; the water payoff |
| 4 | **Active site fit** — adenylate kinase open vs closed | Viewer, SES, pocket framed | Active Site, Induced Fit | Shape complementarity, and that it's not rigid |
| 5 | **Denaturation sequence** — folded → unfolded, backbone intact | Viewer, spheres → sticks | Denaturation | Same atoms, structure gone, chain unbroken |
| 6 | **R-group sorter** — 20 side chains, interactive grouping | Custom widget | Amino Acid, R-Group | Four chemical classes; the classification that matters |
| 7 | **Peptide bond animation** — condensation, water leaving | Short animation | Peptide Bond | Bridge to dehydration synthesis |
| 8 | **Egg-cooking demo** — 60 seconds of real footage | Video | Denaturation | Irreversibility, viscerally |
| 9 | **Structure levels diagram** — the four levels with *causes* labelled | Static, annotated | Primary–Quaternary | Backbone H-bonds vs R-groups as separate causes |
| 10 | **Enzyme rate vs temperature/pH** | Interactive plot | Optimal Conditions | Curve shape, and why it falls off a cliff |

Numbers 1 and 3 are the ones I'd build first. Both use the viewer, both make an invisible cause visible, and both close loops back to the water unit.

## Misconception content

One piece per misconception edge, doing a specific corrective job:

* **Co-translational folding animation** → `Protein Folding`. Folding begins while the chain is still emerging from the ribosome. Kills the "1° then 2° then 3° in sequence" model.

* **Denaturation vs hydrolysis, side by side** → the two `contrasts-with` nodes. Cooking vs digestion; one keeps peptide bonds, one breaks them.

* **Protein digestion path** — steak → amino acids → your proteins → `Hydrolysis`/`Translation`. Kills "eating collagen builds collagen."

* **Five forces, five strengths** — comparative bar chart → `R-Group Interactions`. Disulfide covalent and \~20× the rest; students treat all folding bonds as equivalent.

* **Crowded cytoplasm** — Goodsell mesoscale → `Protein`, `Tertiary Structure`. Proteins aren't floating alone in clear fluid.

## Function class exemplars

One good example each, since the abstract class nodes are inert without them:

Enzyme → lysozyme · Structural → collagen triple helix · Transport → hemoglobin (also carries quaternary) · Receptor → GPCR · Antibody → IgG Y-shape · Motor → myosin walking animation

The myosin animation is disproportionately valuable — it's the clearest demonstration anywhere in the course that a protein is a machine with moving parts, not a static shape.

## Assessment

Typed `tests`, not `explains`, so your intent ranking can find them:

* Predict the effect: given a substitution, what happens to folding? (targets R-Group → Tertiary → Function)

* Sort the causes: which level does each bonding force build?

* Enzyme curve reading: identify optimum, explain the drop-off

* The sickle-cell chain, reconstructed end to end

* Trace a dietary protein from mouth to muscle

## Gaps I'd accept

**Quaternary structure** is thin here, and that's correct for Bio 101 — hemoglobin carries it adequately.

**Allosteric regulation** deserves an animation but rarely gets a good one. Static diagrams work poorly for it. I'd leave it under-served rather than attach something mediocre.

**Van der Waals and Motor Protein** were the rank-2 orphans in the QA walk. One piece each, or none. Don't let content backfill nodes the structure already flagged as marginal.

## Where the effort goes

Roughly: eight viewer configurations, six custom animations, four interactive widgets, six static diagrams, five assessments, one video. The viewer configurations are nearly free once the module is wired — that's the argument for doing them first and seeing what the remaining gaps actually are before commissioning animation work.

---

What is your ideal content set for Macromolecules?

Working from the macromolecules nodes — Polymer, Dehydration Synthesis/Hydrolysis, Functional Group, the four classes and their monomers. Protein is already served by its own set, so this unit's job is the *shared pattern* and the places it breaks. Roughly 25 pieces.

## The core ten

| \# | Content | Mode | Attaches to | Shows |
| --- | --- | --- | --- | --- |
| 1 | **Universal reaction widget** — build/break a bond, class as a parameter | Interactive, 4 configs | Dehydration Synthesis, Hydrolysis, all four classes | One chemistry, four instantiations |
| 2 | **Starch vs cellulose** — identical glucose, α vs β linkage | Viewer, sticks → spheres | Carbohydrate, Glycosidic Bond | One bond flip; helix vs rigid sheet |
| 3 | **Self-assembly animation** — phospholipids forming a micelle, then a bilayer, in water | Animation | Phospholipid, Amphipathic, Hydrophobic Effect | The bilayer builds itself; the water payoff |
| 4 | **Solubility sorter** — drop molecules into water, watch what dissolves | Interactive widget | Polarity, all four classes | Polarity predicts behaviour |
| 5 | **Saturated vs unsaturated** — cis double bond kink, packing density | Viewer, spheres | Lipid, Fatty Acid | Geometry → melting point → membrane fluidity |
| 6 | **Functional group palette** — hover a group, see its properties and where it appears | Interactive | Functional Group | The reusable chemical alphabet |
| 7 | **Water counter** — build a 20-mer, count water molecules released | Extension of #1 | Polymer, Dehydration Synthesis | n−1 bonds, n−1 waters; makes it literal |
| 8 | **The lipid exception** — side-by-side: three polymers assembling vs a triglyceride | Static, annotated | Lipid, Polymer | Where the pattern genuinely breaks |
| 9 | **Four classes at a glance** — monomer, bond, function, solubility | Interactive table | Macromolecules (parent) | The unit's organizing frame |
| 10 | **Digestion trace** — a meal to monomers to your own polymers | Animated diagram | Hydrolysis | Kills "eating X builds X" |

Numbers 1 and 2 first. The reaction widget is the unit's spine, and starch-vs-cellulose is the cheapest demonstration in the whole course that structure determines function — one bond orientation separating food from wood.

## Misconception content

* **Cellulose and the missing enzyme** → `Specificity`. We eat cellulose constantly and get nothing from it, because no human enzyme fits a β-linkage. Best available bridge from this unit into proteins, and it makes "enzyme specificity" concrete rather than abstract.

* **Lipid ≠ fat ≠ triglyceride** → `Lipid`. The class includes steroids and waxes, which share no structural motif with fats at all — they're grouped by solubility, which is a genuinely different basis from the other three classes.

* **"Sugar" is not one thing** → `Carbohydrate`. Table sugar, blood glucose, starch, and fibre are all carbohydrate.

* **Polymers aren't uniform chains** → `Polymer`. Students picture identical beads. Protein and nucleic acid vary monomer to monomer, and that variation *is* the information.

* **Macromolecules aren't built from what you ate** → covered by #10.

## Class exemplars

Carbohydrate → glucose, starch, cellulose, chitin · Lipid → triglyceride, phospholipid, cholesterol · Protein → *link out, don't duplicate* · Nucleic acid → nucleotide, DNA backbone with phosphates facing out

Chitin is worth including as a small piece — it makes the point that the same polysaccharide strategy produces beetle shells and fungal cell walls, which is a nice early instance of the evolution theme.

## Assessment

* Given a monomer, predict the bond and the class

* Count the waters: how many released building a chain of n?

* Sort molecules by predicted water solubility, then justify from structure

* Why can termites digest wood and you can't?

* Which of these four is not a polymer, and what does that change?

## Gaps I'd accept

**Nucleic acids** should stay thin here. They get a full unit later, and the temptation to front-load DNA structure into macromolecules produces duplication that drifts. One backbone image showing charged phosphates outside is enough — it earns its place by connecting to polarity, not by teaching DNA.

**Steroids** are structurally alien to everything else in the unit. One image, rank 2, and don't build around them.

**Quantitative energy density** — the 9 vs 4 kcal/g comparison — is often taught here but is really a respiration topic. Leave it as a forward link.

## Where the effort goes

One substantial interactive widget with four configurations, three animations, three viewer setups, four static diagrams, five assessments. Cheaper than the protein set, because a single well-parameterized reaction widget covers what would otherwise be four separate pieces — the same argument as parameterizing the protein viewer, applied one unit earlier.

---

What is your ideal content set for Water?

Water is the cheapest unit to build content for and the highest-leverage. Most of it is demonstrable with real footage rather than commissioned animation, and the phenomena are visible at human scale — which is unusual for anything in Bio 101 that matters this much.

Roughly 25 pieces, built around one hub.

## The core ten

| \# | Content | Mode | Attaches to | Shows |
| --- | --- | --- | --- | --- |
| 1 | **H-bond sandbox** — a few dozen water molecules, adjustable temperature | Interactive sim | Hydrogen Bonding | Bonds forming and breaking constantly; freeze it and the lattice appears |
| 2 | **Polarity render** — charge-mapped surface, bent geometry visible | Viewer, sticks + charge colouring | Water Molecule, Polarity | Where δ− and δ+ sit, and why the bend matters |
| 3 | **Ice lattice vs liquid** — same molecules, two states, density measured | Viewer, spheres | Ice Density Anomaly | Solid is more open; the count is the proof |
| 4 | **Hydrophobic exclusion animation** — nonpolar molecules pushed together by water reorganizing | Animation | Hydrophobic Effect | It's water's doing, not attraction between the oils |
| 5 | **Capillary rise footage** — dye climbing a thin tube, then real xylem | Video | Cohesion, Adhesion | The mechanism, then the biology |
| 6 | **Specific heat comparison** — equal heat into water vs metal vs oil, thermometers visible | Video or sim | Specific Heat | Where the energy goes: breaking bonds, not raising temperature |
| 7 | **Dissolution animation** — NaCl crystal, water molecules orienting into hydration shells | Animation | Solvent Properties | Why polar dissolves polar |
| 8 | **Water strider / pin on water** | Video | Cohesion, Surface Tension | Surface tension at visible scale |
| 9 | **pH scale interactive** — log scale, biological ranges marked | Interactive | Ionization, pH | Each unit is 10×; blood's narrow window |
| 10 | **Frozen lake cross-section** — ice on top, life below | Diagram or footage | Ice Density Anomaly, Aquatic Overwintering | The consequence that makes the anomaly matter |

Numbers 1 and 4 first. The sandbox is the unit's hub — nearly every property node can point at it with different parameters, which is the same parameterization argument as the protein viewer. And #4 is the single most-often-taught-backwards idea in the course.

## Misconception content

* **The hydrophobic effect is water's doing** → covered by #4, but worth an explicit annotated panel too. Oil doesn't "like" oil.

* **Hydrogen bonds are not covalent** → strength comparison bar, \~5% of a covalent bond. Explains why they break and reform constantly at body temperature, which is the whole point.

* **Ice floating is weird** → nearly every other substance contracts on freezing. Without the comparison, students don't register that anything needs explaining.

* **Evaporative cooling isn't the air** → sweat on skin, thermal camera. The fastest molecules leave and take the energy with them.

* **"Neutral" pH 7 is not universal** → stomach at 2, blood at 7.4, lysosomes at 5. Enzyme optima follow location.

## Bridge content

The unit's real value is outbound, so these earn their place more than a sixth property demo would:

* **One cause, three structures** — hydrophobic effect resolving simultaneously into bilayer, protein core, and DNA base stacking. The demo piece for the whole graph.

* **Amphipathic sorter** — phospholipid, detergent, globular protein; drop each into water and watch it arrange.

* **Dehydration synthesis** — link out to the macromolecules reaction widget rather than duplicating it.

* **Transpiration column** — cohesion all the way from soil to a 100 m canopy, unbroken.

## Assessment

* Predict solubility from structure, then explain from polarity

* Why does sweating stop cooling you in high humidity?

* A lake freezes bottom-up — what happens to the ecosystem?

* Trace a water molecule from root to atmosphere, naming the property at each step

* Which property explains each of these five phenomena? (mixed set)

## Gaps I'd accept

**Surface tension** is visually irresistible and biologically minor for Bio 101 — water striders and one line about alveolar surfactant. Don't let the good footage inflate its rank.

**pH and buffers** are usually taught here but belong closer to enzymes. Keep the scale interactive, forward-link the buffer chemistry.

**The water cycle** is ecology. One outbound edge, no content in this unit.

## Where the effort goes

This is the unit where you can lean hardest on existing footage — capillary action, water striders, freezing, sweating are all real, filmable, and probably already available. One good molecular sandbox plus three animations plus assembled video covers most of it. Build the sandbox well and parameterize it; six property nodes can point at the same module with different temperature, solute, and surface settings.

---
