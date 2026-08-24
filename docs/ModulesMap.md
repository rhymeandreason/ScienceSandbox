**Mechanism doors.** Eight, one per arc. They ask how something works, and each
is answered by the modules under it. Membership is many-to-many — a module can
sit in several arcs, which is what the `Also in` column carries — so these are
routes through the modules, not folders holding them.

**Water — could life run on any other liquid?**

| Module | Kind | State | Also in |
| --- | --- | --- | --- |
| Polarity | principle | hosted · water-lab, molecule-builder | carbon |
| Hydrogen bonding | object | hosted · water-lab | proteins, information |
| Ice & density | object | hosted · water-lab | — |
| Dissolving | process | hosted · water-lab, solvation-lab | carbon |
| Heat & temperature | principle | hosted · water-lab | — |
| Cohesion | principle | engine-only · droplet-test, adhesion-test | — |
| The hydrophobic effect | principle | planned | proteins, boundaries |
| Entropy | principle | planned | energy, proteins |
| Crystal growth | process | planned | — |
| Acids & pH | principle | hosted · molecule-lab | energy |

**Carbon — why is life built from carbon?**

Two halves, and the arc needs both. What carbon *does* — four bonds, stable chains,
C=O where silicon gives SiO₂ — and where it *comes from*: a gas in the air that a
leaf can grab. The second half is why the plant modules live here.

| Module | Kind | State | Also in |
| --- | --- | --- | --- |
| Covalent bonding | object | hosted · molecule-builder | — |
| Ionic bonding | object | hosted · molecule-builder | water |
| Molecular geometry | object | hosted · molecule-builder | — |
| Monomers & polymers | object | hosted · macromolecule-lab | information |
| Dehydration synthesis & hydrolysis | process | engine-only · the `join` verb, and it run backwards | rot |
| Isomers & chirality | object | hosted · contrast-lab | proteins |
| Light reactions | process | planned · `kit/carriers.js` says a page "would be almost nothing else" | energy |
| The Calvin cycle | process | planned · one verb, carboxylation, on the pathway compiler | energy |
| Transpiration & the water column | principle | planned · osmosis + cohesion, both already on the map | water, boundaries |
| Cellulose & the cell wall | object | planned · macromolecules + turgor | boundaries |

*Where does a tree come from?* is the arc's most striking answer, and essentially
nobody believes it: asked what a tree is made of, students say soil, or water. Van
Helmont weighed the pot in the 1640s — a 5 lb willow gained 164 lb while the soil
lost two ounces. By dry mass wood is about 50% carbon, 43% oxygen and 6% hydrogen:
the carbon skeleton comes from CO₂, the hydrogen from water, and soil minerals are
a couple of percent. **The atom-conservation ledger answers it exactly**, which is
this arc's reason to build it. Photosynthesis belongs in **Energy** too — plants
respire as well, the neighbouring misconception being that they "breathe backwards".

**Plants vs animals is a contrast, not a card.** Its pairs land in four different
arcs — photosynthesis against respiration, cell wall against cytoskeleton,
transpiration in water, cellulose against starch — so a card for it would claim
membership everywhere and answer nothing. Contrast is a *rendering* device in this
library (`contrast-lab`), not a node: draw the two mechanisms as separate modules
and let a question link them, the way *Why can you digest starch but not
cellulose?* already does.

**Proteins — how does a chain of beads become a machine?**

| Module | Kind | State | Also in |
| --- | --- | --- | --- |
| Levels of structure | object | standalone · hemoglobin-lab | — |
| Folding | process | hosted · folding-lab | — |
| Heme & oxygen binding | object | hosted · hemoglobin-lab | boundaries |
| Binding & recognition | process | planned | signalling |
| Enzyme catalysis | process | engine-only · hexokinase/ | energy |
| Cooperativity | principle | planned | — |
| Denaturing | process | planned | water |
| The sickle mutation | object | engine-only · sickle/ | information |

**Boundaries — what makes inside different from outside?**

| Module | Kind | State | Also in |
| --- | --- | --- | --- |
| The bilayer | object | standalone · membrane-lab | — |
| Simple diffusion | principle | hosted · membrane-lab, diffusion/ | — |
| Channels & pumps | object | hosted · membrane-lab | energy |
| Osmosis | principle | planned | — |
| Scale & the √t wall | principle | engine-only · diffusion/ | — |

**Energy — where does the energy in your food go?**

| Module | Kind | State | Also in |
| --- | --- | --- | --- |
| Glycolysis | process | standalone · glycolysis-lab | — |
| The Krebs cycle | process | standalone · krebs-lab | — |
| Fermentation | process | standalone · fermentation-lab | — |
| Beta-oxidation | process | planned | — |
| Electron transport | process | planned | boundaries |
| Energy coupling | principle | engine-only · coupling/ | — |
| Mass action | principle | hosted · glycolysis-lab modal | water |
| Atom conservation | principle | planned | — |

**Information — how is a body written down?**

| Module | Kind | State | Also in |
| --- | --- | --- | --- |
| The double helix | object | standalone · dna-lab | — |
| Base pairing | object | hosted · dna-lab | water |
| Replication & fidelity | process | planned | — |

**Signalling — how do cells talk to each other?**

Nothing built. Its threshold idea is that **the message never gets in**: a hormone binds outside, changes a shape, and the inside does the rest — students almost universally picture the molecule entering and doing the work. Second idea, **amplification**: one molecule producing millions, which is why signalling is both fast and cheap.

| Module | Kind | State | Also in |
| --- | --- | --- | --- |
| Receptor binding | process | planned · needs `bind`/`release` | proteins |
| Amplification cascade | principle | planned · a small new module | energy |
| Second messengers | principle | planned · `diffusion/` inside a cell | boundaries |
| Switching off | process | planned · `bind`/`release` run backwards | proteins |
| Nerve impulse | object | planned · voltage-gated channels, a large membrane build | boundaries |

Four of the five ride on one verb family already wanted for its own sake — `bind`/`release` is Gap 1 in `QUESTIONS-ROADMAP.md`, and it pays off in enzymes and cooperativity too. Two questions in the bank are already signalling questions filed elsewhere: *How does one adrenaline molecule release a million glucose?* and *How does cholera dehydrate you without entering a cell?* This is also the arc that reaches drugs, hormones, allergies and poisons, which is worth something on a map for a general audience.

**Development — how does one cell become a whole animal?**

Nothing built, and unlike signalling it is a **genre change**. Its threshold idea is that every cell holds the same instructions and reads a different part; the mechanism is positional information — a molecule diffuses from a source, its concentration says where you are, and a threshold turns a gene on.

| Module | Kind | State | Also in |
| --- | --- | --- | --- |
| Morphogen gradient | principle | planned · `diffusion/` + a threshold | boundaries |
| Gene expression | process | planned · prerequisite for the rest | information |
| Cell division | object | planned · a new genre: cells and lineages | — |
| Differentiation | process | planned · the same genre | information |
| Sculpting by cell death | process | planned · the same genre | — |

Only the first is cheap. After it the stage stops being a molecular one, which is the objection `QUESTIONS-ROADMAP.md` Part 5 raises against `xinact/`: the whole library renders molecules at true relative size, and a lineage tree of cells shares no plumbing with any of it. Not a reason never to build it; a reason not to make it the next arc.


---

**Subject doors.** Seven, and a different kind: they ask *tell me about X*, pull
modules from several arcs at once, and introduce almost nothing of their own. They
exist because the mechanism doors are the wrong shape for arriving — nobody wakes
up wanting to know what makes inside different from outside, and everybody wants to
know why bread rises. New modules are marked **new**; everything else already sits
in an arc above.

**Is a virus alive?** A real open question with an entirely mechanical answer: a
protein shell and a nucleic acid, no metabolism, borrowing someone else's
machinery. Lands on mRNA vaccines without trying.
*Pulls:* capsid self-assembly **new** · receptor binding · replication & fidelity ·
monomers & polymers.

**Why do antibiotics stop working?** The practical face of evolution, which is
otherwise the emptiest territory here, and the one a general audience already
argues about.
*Pulls:* selection & resistance **new** · binding & recognition · enzyme catalysis ·
the bilayer.

**Why does anything rot?** Decomposition closes the loop the carbon arc opens: air
→ tree → back to air. Digestion happening *outside* the body is the threshold idea,
and the modules are unusually cheap.
*Pulls:* dehydration synthesis & hydrolysis · enzyme catalysis · fermentation · atom
conservation.

**How does life survive where it shouldn't?** Eight questions in the bank already
answer to this door and nothing else: vent bacteria, wood frogs, crucian carp,
deep-sea fish, camels, bears, sulfur-and-iron bacteria, brown fat. Archaea are
evidence here rather than a door of their own — ether lipids, membranes that hold
at 100°C.
*Pulls:* denaturing · crystal growth · electron transport · beta-oxidation · the
bilayer.

**What happens when you cook something?** Seven questions already, and the most
general-audience entry point on the map.
*Pulls:* denaturing · heat & temperature · crystal growth · the hydrophobic effect ·
fermentation · dissolving.

**How does a poison kill you?** Three in the bank — cyanide, CO, thalidomide — with
arsenic and lactose intolerance a line away.
*Pulls:* binding & recognition · electron transport · isomers & chirality · enzyme
catalysis.

**How does your body know what's you?** The third payoff for `bind`/`release` after
enzymes and signalling: an antibody is recognition and nothing else. Pairs with the
virus door around vaccines.
*Pulls:* antibodies **new** · binding & recognition · capsid self-assembly.

**Held, deliberately.** *Cancer* has the strongest pull of anything considered and
the weakest coverage — division control, signalling stuck on, repair failing,
selection inside one body — all in the cell-and-lineage genre this library does not
have. An empty development door reads as honest territory; an empty cancer door
reads as a promise. Revisit once gene expression and cell division exist. *Ageing*,
*sleep*, *origins of life* and *climate* are held for the same reason with less
hope: enormous pull, and no mechanism this library can show, so they would be doors
onto essays. *Senses* folds into signalling; *archaea* into survival and boundaries.

**What the shape tells you:**

* **28 planned, 6 engine-only, 19 built**, over eight mechanism doors and seven subject doors. The engine-only six are the cheapest wins on the list — cohesion, dehydration synthesis, enzyme catalysis, the sickle fibre, scale, coupling all have working code and no lesson around them.

* **Processes cluster in Energy; objects cluster in Water and Carbon.** That matches the reuse asymmetry — the Water and Carbon objects carry the cross-arc memberships, and every Energy process belongs to exactly one arc.

* **Signalling and development are empty, and not equally so.** Signalling is four modules over one verb family the roadmap already wants, so it is buildable next. Development needs a stage this library does not have, so its door stays honestly dashed — with the morphogen gradient as a foothold if one is wanted.

* **An unclaimed question cluster is a door you have already written for.** Survival had eight questions and cooking seven before either was a door — they were written one at a time, months apart, filed under mechanism arcs. That test is worth re-running whenever the bank grows: a cluster with no door is the cheapest door there is.

* **Build order that falls out of the above:** the six engine-only modules first (a lesson each, no new engine), then `bind`/`release`, which converts four planned modules — receptor binding, switching off, enzyme catalysis, cooperativity — into buildable ones at once.
