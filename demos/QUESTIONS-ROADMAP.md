<!-- KIND: argument — human only. Ranks the same ground from student questions. Do not load while building; see LESSONS-ROADMAP.md for the reason. -->

# Questions roadmap

A companion to `LESSONS-ROADMAP.md`. That file ranks by *diagram conflict*, the
thesis of the pages themselves. This one starts from the other end: a pile of
student questions, asking what to build so that the most of them become
answerable for the least new code.

The answer turned out not to be a list of lessons. It is a short list of
additions to the **engines already on disk**, because those engines reach much
further than the two pathway pages that produced them.

## Part 1 — what has actually been built

Not a rendering library. Three engines, at three levels of description.

**1. A grammar for molecular change.** `reaction/` owns the verbs; `kit/lanes`
owns multiplicity; `kit/carriers` owns a two-state object exchanging one group;
`kit/leaving` owns departure; `kit/molgraph` answers chemistry questions off the
spec, in the same code the checkers assert with; `kit/hotspot` makes the
student's own click the thing that breaks the bond; `kit/motion` makes all of it
seekable.

Composed, that is a **pathway compiler**. A lesson expressible as "a list of
steps, each a verb applied to a molecule in n lanes, with carriers banking and a
ledger keeping score" is now mostly data. Glycolysis and Krebs are two instances
of it rather than two lessons, which is the whole reason the cycle added six
verbs and changed no page but its own.

**2. Ensemble abstractions.** `massaction/` is A⇌B over a barrier. `diffusion/`
is a gradient with a permeability. `coupling/` is ΔG addition, gated on the two
reactions sharing a molecule. None is about any particular molecule. Each makes
a *statistical* claim the 3D stage cannot make honestly, which is why they
belong behind a `kit/modal.js` side door.

**3. Structure engines.** `folding/`, `hemoglobin/`, `membrane/`, `dna/`,
`sickle/`. These render objects rather than events.

The fact worth acting on: **1 and 2 describe the same chemistry at two levels,
and nothing yet is *about* the relationship between them.**

## Part 2 — what the grammar already reaches

These cost data plus at most a verb, and by the module's own rule a new verb
touches no page. This list is longer than any list of new modules and costs less
than one of them.

| Instance | New code | Questions it answers |
| --- | --- | --- |
| **Fermentation**, both branches | one verb (reduction) | sprinters vs marathoners · bread vs beer · crucian carp under the ice · red blood cells without mitochondria · apples in low oxygen |
| **Beta-oxidation** | the spiral repeat, which Krebs' second turn already proves | camels · bears · kangaroo rats · why fat carries more energy than sugar |
| **The Calvin cycle and the light reactions** | carboxylation | `kit/carriers.js`'s own header: a light-reactions page "would be almost nothing else" |
| **Pentose phosphate** | none | `kit/lanes.js` names it as a target |
| **Dehydration synthesis, all four macromolecule classes at once** | none, `join` exists | the four polymers are one reaction run four times, on the four monomers `macromolecule-lab` already holds at true relative size |

The last one is the sleeper. It is a genuine threshold idea in Bio 101, it is
nearly free, and it upgrades an existing prototype into a lesson.

## Part 3 — the two gaps in the grammar

### Gap 1: every verb is covalent. Nothing binds.

The table is `in out ox move lose split open iso decarb join thioester hydrate
dehydro shift` (reaction/reaction.js). All fourteen change a bond.

But half of biology is **recognition**: something sticks without changing, does
work, and lets go. Enzyme and substrate. O₂ on heme. A drug in a channel. A
transcription factor on DNA. An antibody. A receptor.

A **`bind` / `release` verb family, plus an occupancy readout**, is the single
highest-leverage thing that can be added to any engine here, because it extends
the pathway compiler into *all of protein function*, which today is rendered
only as static structure. It also dissolves the case for a separate enzyme
module: an enzyme is `bind`, then verbs that already exist, then `release`.

It pays off something already built and unused, too. `massaction/`'s barrier
slider exists and no lesson renders it (`massaction/massaction-test.html`).

### Gap 2: the ledger counts carriers, per lesson.

Both pathway pages bank ATP and NADH. Generalise that into an **atom-conservation
ledger**: every carbon, oxygen and hydrogen you started with, and where it is
now. This is a readout over machinery that already runs, so it is cheap, and it
is the only home for a whole class of question:

Where the CO₂ you exhale comes from · where the water a camel lives on comes
from · why fat beats sugar · and why the oxygen you breathe ends up in water
rather than in CO₂, which almost every student has backwards.

## Part 4 — the move worth generalising

Glycolysis opening `massaction/` has been treated as a glycolysis feature. It is
a **reusable pedagogical mechanic**: the stage shows one molecule's mechanism,
the side door shows a million of them, and the lesson is that the two look
nothing alike.

Made systematic, that one move answers the questions where single-molecule
intuition and population behaviour genuinely disagree, which is the whole reason
two engines at two levels is worth having:

| Stage shows | Door shows | Question |
| --- | --- | --- |
| one turnover | the rate curve | why you cannot use up an enzyme |
| one O₂ binding changes the shape | the sigmoid | why CO kills at 0.1% of the air · how a fetus takes oxygen from its own mother · why exercise makes blood release more oxygen exactly where it is needed |
| one molecule's random walk | the √t wall | why are cells small · why an insect needs no lungs · why a metre-long neuron cannot let the signal diffuse |
| one proton hopping onto bicarbonate | the buffer holding | why breathing fast makes you dizzy · why blood pH barely moves when you drink Coke |

Cooperativity needs Gap 1, and `hemoglobin-lab` is already built and featured
with not one question currently pointed at it.

## Part 5 — build order

1. **`bind` / `release`.** Extends the compiler into protein function. No page
   changes, by design.
2. **The conservation ledger.** A readout on machinery that already runs.
3. **Fermentation and beta-oxidation as data.** Two pathway instances, nine
   questions, almost no new code.
4. **Formalise the two-level move** as a kit convention rather than a glycolysis
   habit.
5. **`osmosis/`** — water flux across a semipermeable membrane, cell volume,
   water potential, over `diffusion/` + `membrane/parts`. Salmon · why an IV is
   0.9% saline and distilled water into a vein is fatal · cholera killing without
   entering a cell · how high a tree can grow.
6. **`crystal/`** — nucleation, a growth front, facet rates, face pinning. The
   only genuinely new physics in the water block; see Part 6.
7. **`denature/`** — temperature and ionic-strength dials on `folding/` and
   `hemoglobin/`. Egg whites · fever above 40°C · vent bacteria above 100°C.
8. **A pressure axis on `water-lab`** — see Part 6.
9. **`etc/`** — proton gradient and chemiosmosis over `membrane/`. The missing
   end of the respiration arc regardless of this list. Cyanide, properly ·
   hibernation and brown fat · bacteria living on sulfur or iron.
10. **`xinact/`** — X-inactivation as a cell-lineage mosaic. Calico cats ·
    colourblindness in males · heterochromia. Reuses nothing, and it is a second
    genre: chromosomes and lineages, not a molecular stage. Build it
    deliberately or not at all.

## Part 6 — two findings about the water block

**Colligative properties are already modelled.** `tempParams()` in
`water-lab.html` computes `dTf` and `dTb` from molality, so salt water visibly
freezes below 0°C and boils above 100°C. Road salt and its alternatives
therefore need *content*, a molal-per-gram comparison across CaCl₂, MgCl₂, urea
and sand, not a module.

**Freezing has no growth front.** It is a scalar fraction snapping molecules
onto a lattice pre-built for the molecule count. There is no nucleation event,
no crystal *size*, and no face for anything to bind. Four questions all ask the
same thing, "what shape and size does ice grow into, and what changes it," and
none is reachable from a fraction-frozen model: why snowflakes are six-sided ·
what makes ice cream creamy rather than gritty · how deep-sea fish keep their
blood from crystallising · how wood frogs survive freezing solid.

**Pressure is missing.** Boiling is a threshold against a hardcoded 100, with no
ambient pressure, no vapour-pressure balance, and no feedback from the escaped
gas population back into the liquid. A second dial answers recipes at altitude ·
a lid on the pot · how fizzy drinks are made, since Henry's law is the same
balance run inward.

## Part 7 — questions worth adding

The candidate list skewed to "amazing animal trick," a genre a good paragraph
already serves. Three tests for a question that earns a simulation:

1. **Intuition is confidently wrong.** Reading the right answer does not
   dislodge a wrong model; watching does. The strongest case, and the rarest.
2. **The answer is a quantity you have to feel.** A dial teaches a scaling law
   a number cannot.
3. **The answer is a mechanism unfolding in time.**

Most of what Part 4 unlocks is test 1. Beyond it:

**The hydrophobic effect** (`water-lab` plus a nonpolar solute). *Why do oil and
water separate, if separating makes things more ordered?* It doesn't; the water
is what gains freedom. Nearly every student has this exactly backwards. Also why
soap works, and why proteins bury their greasy parts when nothing pulls them
inward. The highest-value single question here, because it rewrites how a
student reads folding, membranes and solubility for the rest of the course.

**Self-assembly.** Poke a hole in a membrane and it heals with nothing repairing
it (`membrane/parts`). A protein has more possible shapes than the universe has
atoms and folds in a second (Levinthal, and `folding/` already runs the
trajectory).

**Molecular recognition** (`contrast-lab`, a prototype with no lesson around
it). Why one molecule smells of lemon and its mirror image of orange, on the L/D
alanine pair already in there. Why thalidomide's two identical-looking halves
did such different things. This turns spot-the-difference into a lesson about
why shape *is* function, and it is Gap 1's argument in miniature.

**Amplification** (a small new module). One photon hits your eye and you see a
flash. One adrenaline molecule releases millions of glucose. Cascades are the
mechanic under every signalling topic there will ever be.

**Fidelity** (`dna/`). *Why isn't the mutation rate zero?* Proofreading costs,
and the optimum is not perfection.

## Part 8 — what to cut

- **The genetics block, except item 10.** Identical twins' differing
  fingerprints, the 98% shared with chimpanzees: development and population
  genetics, sharing no plumbing with anything here.
- **Sunscreen**, despite appearing twice. Photon absorption by a conjugated
  system dumping energy as heat is a one-off mechanic serving one question.
- **Runoff and lake eutrophication.** Ecosystem scale. Its only molecular hook,
  oxygen solubility, comes free with the pressure dial.
- **Local anaesthetics.** Real, and cheaper once Gap 1 lands, but it still wants
  a voltage-gated channel with gating states, which is a bigger membrane build
  than it looks.
- **"Are there liquids that don't contain water?"** Content for
  `molecule-viewer`. Not every good question earns a stage.

## Appendix — every question, and what answers it

One row per question raised so far, sorted by the build item that unlocks it, so
this doubles as the work plan. "Item" refers to Part 5. `—` means no new code:
the engine is on disk and this is content.

| Question | Answered by | New code | Item |
| --- | --- | --- | --- |
| Why can't you use up an enzyme? | stage: one turnover · door: the rate curve | `bind`/`release` + the two-level convention | 1, 4 |
| Why is cyanide deadly? | an inhibitor that binds and never leaves | `bind`/`release` | 1 |
| Why is arsenic poisonous? | same, on the lipoamide of pyruvate dehydrogenase | `bind`/`release` | 1 |
| Why are some people lactose intolerant? | a substrate with no active site to fit | `bind`/`release` | 1 |
| Why does CO kill at 0.1% of the air? | stage: one binding shifts the shape · door: the sigmoid | `bind`/`release`, on `hemoglobin-lab` | 1, 4 |
| How does a fetus take oxygen from its own mother's blood? | two sigmoids, offset | `bind`/`release` | 1, 4 |
| Why does exercise release more oxygen exactly where it's needed? | the curve shifting under H⁺ and CO₂ | `bind`/`release` | 1, 4 |
| Why does one molecule smell of lemon and its mirror of orange? | shape complementarity, on `contrast-lab`'s L/D alanine | `bind`/`release` | 1 |
| Why did thalidomide's two halves behave so differently? | the same, with consequences | `bind`/`release` | 1 |
| Where does the CO₂ you exhale come from? | atom-conservation ledger | the ledger | 2 |
| Why does the oxygen you breathe end up in water, not CO₂? | the same ledger, run to the end | the ledger | 2 |
| Why does fat carry more energy than sugar? | ledger over beta-oxidation | the ledger | 2, 3 |
| How do camels get water from fat? | metabolic water on the ledger | the ledger | 2, 3 |
| Why do kangaroo rats never drink? | the same, plus `osmosis/` on the kidney | the ledger | 2, 3, 5 |
| Why do sprinters' legs burn at 200m but marathoners' don't? | fermentation as data | one verb | 3 |
| Bread and beer, one organism and one pathway. Why two products? | both fermentation branches side by side | one verb | 3 |
| How do crucian carp survive sealed under ice, slightly drunk? | the ethanol branch | one verb | 3 |
| Why do red blood cells have no mitochondria? | the pathway stopping where it stops | — | 3 |
| Why are apples stored in low oxygen, not just cold? | the O₂ dial on the branch point | — | 3 |
| Why are some animals cold-blooded? | flux rate against temperature | — | 3 |
| How do bears hibernate? | beta-oxidation at a throttled rate | the spiral repeat | 3 |
| Why does fructose behave unlike glucose in the liver? | it enters past the regulated step | — | 3 |
| The four polymers are one reaction run four times | `join` over `macromolecule-lab`'s four monomers | — | 3 |
| Why are cells small? | stage: one random walk · door: the √t wall | the two-level convention | 4 |
| Why does an insect need no lungs and you do? | the same wall, at two scales | the convention | 4 |
| Why can't a metre-long neuron let its signal diffuse? | the same wall again | the convention | 4 |
| Why does breathing fast make you dizzy? | stage: a proton hop · door: the buffer, on `molecule-lab`'s CO₂ chain | the convention | 4 |
| Why does blood pH barely move when you drink Coke? | the same buffer, pushed | the convention | 4 |
| How do salmon cross from salt water to fresh? | `osmosis/` | `osmosis/` | 5 |
| Why is an IV 0.9% saline, and distilled water fatal? | `osmosis/`, cell volume | `osmosis/` | 5 |
| How does cholera dehydrate you without entering a cell? | secreted Cl⁻, water following | `osmosis/` | 5 |
| How high can a tree grow? | `osmosis/` plus a tension column | `osmosis/` + column | 5 |
| Why are snowflakes six-sided? | `crystal/`, facet growth rates | `crystal/` | 6 |
| What makes ice cream creamy rather than gritty? | `crystal/`, nucleation against growth | `crystal/` | 6 |
| How do deep-sea fish keep their blood from crystallising? | `crystal/`, a protein pinning a growth face | `crystal/` | 6 |
| How do wood frogs survive freezing solid? | `crystal/`, plus where the ice is allowed to be | `crystal/` | 6 |
| Why do egg whites turn opaque and solid? | `denature/`, exposed hydrophobics aggregating | `denature/` | 7 |
| Why is a fever above 40°C dangerous? | the same, at 3°C of margin | `denature/` | 7 |
| How do vent bacteria run enzymes above 100°C? | `denature/` with the dial refusing to move | `denature/` | 7 |
| Why do recipes change at altitude? | pressure dial on `water-lab` | pressure axis | 8 |
| What happens if you boil water under a lid? | the same dial, run upward | pressure axis | 8 |
| How are fizzy drinks made? | Henry's law, the same balance run inward | pressure axis + a gas solute | 8 |
| What are the alternatives to road salt? | `water-lab` as it stands, molal per gram | — | 8 |
| Why is cyanide deadly (the honest answer)? | `etc/`, the gradient collapsing | `etc/` | 9 |
| How do hibernating animals burn fat as heat? | `etc/`, uncoupled | `etc/` | 9 |
| How do bacteria live on sulfur or iron with no sun or oxygen? | `etc/` with the donor and acceptor swapped | `etc/` | 9 |
| Why do calico cats turn out female? | `xinact/` | `xinact/` | 10 |
| Why is colourblindness commoner in males? | `xinact/`, and one X | `xinact/` | 10 |
| How can one person have two eye colours? | `xinact/`, mosaicism | `xinact/` | 10 |
| **Why do oil and water separate, if separating makes things more ordered?** | `water-lab` plus a nonpolar solute, entropy counted on the WATER | a solute + an entropy readout | unranked, highest value |
| Why does soap work? | the same, with a molecule that is both | the same | unranked |
| Why do proteins bury their greasy parts with nothing pulling them in? | the same effect, read on `folding/` | the same | unranked |
| Poke a hole in a membrane and it heals. Why? | `membrane/parts`, self-assembly | small | unranked |
| A protein folds in a second out of more shapes than there are atoms. How? | Levinthal, over `folding/`'s trajectory | small | unranked |
| One photon, one flash. One adrenaline, a million glucose. How? | a cascade module | a small new module | unranked |
| Why isn't the mutation rate zero? | `dna/`, proofreading against its cost | small | unranked |
| Why is runoff harmful to lakes? | oxygen solubility, and then ecosystem scale | — | cut |
| How does sunscreen work? | a conjugated system dumping a photon as heat | a one-off mechanic | cut |
| How do local anaesthetics block pain? | a voltage-gated channel with gating states | a large membrane build | cut for now |
| Why do identical twins have different fingerprints? | development, not molecules | a third genre | cut |
| Why are humans and chimps so distinct at 98%? | regulation and population genetics | a third genre | cut |
| Are there liquids that don't contain water? | `molecule-viewer` | — | content |

Sixty-two questions. Eight of them need nothing built at all: the engine is
on disk and the row is content. Six of those eight are metabolism, which is
what a pathway compiler being a compiler actually buys you.

## Part 9 — the reframe

Several candidate questions get better as **predictions rather than
explanations**. "Why do sprinters' legs burn?" is a lookup. *"Here is the dial
for oxygen. Guess what happens to the pyruvate before you move it"* is the same
science and a different lesson.

`LESSONS-ROADMAP.md` files predict-before-you-see under pedagogy retrofits, a
later tier. That ordering is right for a page's architecture and wrong for its
copy: the sims already on disk support the reframe today, and it costs a caption
rewrite.
