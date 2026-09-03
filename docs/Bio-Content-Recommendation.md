# Content set for Biology 101

Roughly 240 pieces across eleven units, plus reusable modules. Pieces marked **★** are the ones I'd build first — they carry the most explanatory load or demonstrate the graph's value most directly.

---

## Reusable modules

Build these once, parameterize per attachment. They account for a large share of the total and drive the cost down considerably.

| Module | Parameters | Serves |
| --- | --- | --- |
| **Protein viewer** | pdb_id, mode (sticks/spheres/SES/ribbon), colouring, highlight, camera | \~15 attachments across proteins, cell, genetics, viruses |
| **Molecular sandbox** | temperature, solutes, surfaces | \~6 water property nodes |
| **Polymer reaction widget** | class (carb/lipid/protein/nucleic) | dehydration synthesis, hydrolysis, 4 classes |
| **Chemiosmosis animation** | membrane context (mitochondrial/thylakoid) | respiration, photosynthesis |
| **Homeostasis loop** | system (temp/glucose/osmotic/pH/calcium) | \~5 physiology systems |
| **Selection simulator** | pressure, population size, drift on/off | evolution, antibiotic resistance, antigenic drift |

---

## Water (\~25)

★ **H-bond sandbox** — bonds forming and breaking; freeze to see the lattice ★ **Hydrophobic exclusion animation**— water reorganizing pushes nonpolar together, not attraction ★ **One cause, three structures** — hydrophobic effect → bilayer, protein core, base stacking Polarity render (charge-mapped) · Ice lattice vs liquid, density measured · Capillary rise footage → real xylem · Specific heat comparison · Dissolution / hydration shells · Water strider · pH scale interactive · Frozen lake cross-section · Amphipathic sorter · Transpiration column

*Misconceptions:* H-bonds aren't covalent (strength bar) · ice floating is anomalous · evaporative cooling mechanism · pH 7 isn't universal *Assessment:* predict solubility from structure · sweating in humidity · lake freezing bottom-up · trace a molecule root to atmosphere *Exemplar:* tardigrade anhydrobiosis — trehalose replacing water

---

## Macromolecules (\~25)

★ **Universal reaction widget** — build/break, class as parameter ★ **Starch vs cellulose** — identical glucose, α vs β, food vs wood Self-assembly animation (micelle → bilayer) · Solubility sorter · Saturated vs unsaturated packing · Functional group palette · Water counter (n−1 bonds, n−1 waters) · The lipid exception · Four classes at a glance · Digestion trace

*Misconceptions:* cellulose and the missing enzyme · lipid ≠ fat · "sugar" isn't one thing · polymers aren't uniform · eating X doesn't build X *Assessment:* predict bond and class from monomer · count the waters · sort by solubility · why termites and not you

---

## Proteins (\~30)

★ **Sickle cell comparison** — 1HHO vs 2HBS, SES + hydrophobicity ★ **Hydrophobic core cutaway** — clipping plane, polarity colouring **Fold stripper** — sticks → spheres → SES → ribbon; what each mode discards Active site fit (open/closed adenylate kinase) · Denaturation sequence · R-group sorter · Peptide bond animation · Egg-cooking footage · Structure levels with causes labelled · Enzyme rate vs temp/pH

*Misconceptions:* co-translational folding · denaturation vs hydrolysis · protein digestion path · five forces five strengths · crowded cytoplasm *Exemplars:* lysozyme, collagen, myosin, aquaporin, IgG, insulin, prion, ATCase, keratin, GFP barrel *Assessment:* predict substitution effect · sort causes by level · read enzyme curve · reconstruct the sickle chain*Exemplar:* icefish antifreeze proteins; icefish with no hemoglobin

---

## Cell / Membrane (\~25)

★ **Tonicity sandbox** — three solutions, plant/animal toggle ★ **Permeability tester** — drag molecules; O₂ passes, glucose bounces, ions need a channel Fluid mosaic animation · Aquaporin cutaway · Na⁺/K⁺ pump · Gradient → chemiosmosis bridge · SA:V calculator · Goodsell mesoscale cell · Endosymbiosis comparison · Micrographs with imaging-method caveats

*Misconceptions:* static wall · osmosis as "pulling" · diffusion stops at equilibrium · facilitated needs energy · cells are empty · organelles float *Assessment:* predict cell in solution · classify five transport events · why a 10 cm cell fails*Exemplars:* *Paramecium bursaria* with live *Chlorella* · *Caulerpa*, one cell metres long

---

## Cellular Respiration (\~20)

★ **Chemiosmosis animation** — the module; proton gradient → ATP synthase Electron carrier tracer (glucose → NADH → ETC → O₂) · Stage/location/yield interactive · Substrate vs oxidative phosphorylation · Fermentation branch at pyruvate · Mitochondrion structure, cristae as SA:V · ATP synthase viewer

*Misconceptions:* oxygen burns the sugar · Krebs is where the energy is · fermentation as a "step" *Assessment:* trace a carbon atom · trace an electron · why muscles burn *Exemplar:* *Loricifera* — animals with no mitochondria

---

## Photosynthesis (\~18)

★ **Side-by-side chemiosmosis** — mitochondrion and chloroplast, same mechanism ★ **Isotope tracer** — labelled water vs CO₂; where the O₂ comes from Absorption spectrum vs rate overlay · Van Helmont's willow · Chloroplast structure · Rubisco viewer · Leaf cross-section micrograph · Stomatal trade-off simulator · Reciprocal pair table (7 contrast rows)

*Misconceptions:* mass from soil · plants respire only at night · O₂ from CO₂ · chlorophyll uses green · "dark reactions" · autumn leaves turning colour *Assessment:* trace carbon air→glucose · trace oxygen water→atmosphere · altered wavelengths · plant in the dark *Exemplar:* green sulfur bacteria on vent glow

---

## Molecular Genetics (\~28)

★ **Sickle cell full chain** — base → codon → residue → patch → cell → phenotype → malaria ★ **Codon table interactive** — mutate a base, watch silent/missense/nonsense DNA viewer (backbone out, bases stacked — three retrospective bridges) · Replication fork with antiparallel constraint · Frameshift demo (English sentence) · Translation animation · Meselson–Stahl simulator · Differentiation visual · Splicing animation

*Misconceptions:* DNA leaves the nucleus · cells have different DNA · mutations always harmful · one gene one trait · reading frame · RNA as mere helper · genes as on/off switches *Evidence:* Griffith/Avery · Hershey–Chase · Photo 51 · Meselson–Stahl · Nirenberg *Assessment:* transcribe and translate · predict four mutations · why lagging strand is discontinuous · one genome, 200 cell types *Exemplar:* *Oxytricha* rebuilding its genome each generation

---

## Mendelian Genetics (\~26)

★ **Meiosis animation with variation counter** — answers "why do siblings differ" ★ **Dominance at the molecular level** — two working copies, one, none Mitosis/meiosis side by side · Crossing over close-up · Punnett builder with meiosis toggle · Pedigree analyzer · Probability simulator (10 vs 1000 crosses) · Sickle cell / malaria map · Polygenic height distribution

*Misconceptions:* dominant = common/strong/better · one gene one trait · genes alone determine · meiosis as mitosis twice · recessive = rare · blood type simple · traits blend *Evidence:* Mendel's peas (and his seven unlinked traits) · Morgan's flies *Assessment:* predict ratios from meiosis · pedigree pattern · brown-eyed parents, blue-eyed child · why an allele is recessive, at protein level *Exemplar:* haplodiploidy — male bees with no father

---

## Evolution (\~28)

★ **Selection simulator** — individuals don't change, the distribution does ★ **Cytochrome c comparison tool** — count differences, build the tree Drift simulator · Antibiotic resistance animation · Homology overlay (arm/flipper/wing/leg) vs analogous pair · Tiktaalik prediction timeline · Tree-not-ladder interactive · Peppered moth data · Grants' finch study

*Misconceptions:* individuals evolve · traits develop because needed · evolution as progress · goal-directed · descended from monkeys · fittest = strongest · "just a theory" · bacteria "become" resistant *Evidence:* whale limb bones · Tiktaalik · peppered moths · resistance in the wild · finches · cytochrome c · vestigial structures · biogeography · endosymbiosis*Assessment:* identify which of four conditions is operating · why an individual can't evolve · predict frequency shift · explain resistance to a non-biologist *Exemplar:* resistance genes in permafrost, predating antibiotics

---

## Viruses (\~18)

★ **Infection cycle animation** — host machinery highlighted; the virus supplies only instructions ★ **Antibiotic target diagram** — bacterial targets marked, then absent from a virus Lytic/lysogenic switch · Spike-receptor viewer · Antigenic drift simulator · Scale comparison (virus/bacterium/cell) · Is-it-alive sorter · HIV reverse transcription against the central dogma

*Misconceptions:* antibiotics work on viruses · viruses are small bacteria · flu shot "wears off" · viruses "want" to kill · ERVs are exotic · vaccines give you the disease *Assessment:* why no cold cure · why yearly flu but one measles shot · classify against life criteria *Exemplar:* mimivirus and its virophages

---

## Ecology (\~20)

★ **Energy pyramid calculator** — answers "why can't you live on grass" quantitatively Food web builder with removal cascades · Carbon cycle atom tracer · Yellowstone wolves · Population growth simulator with limiting factor · Energy-flows vs matter-cycles contrast

*Misconceptions:* energy cycles · decomposers unimportant · plants eat soil · growth until resources run out · more species always better *Assessment:* trophic efficiency · predict keystone removal · trace a nitrogen atom *Exemplar:Elysia chlorotica* — kleptoplasty; the producer/consumer boundary leaking

---

## Physiology (\~30)

★ **Homeostasis loop widget** — parameterized across five systems ★ **Countercurrent exchange animation** — vs concurrent comparison; answers "how do fish breathe" Action potential simulator with ion channels · Nephron filtration walkthrough · Sarcomere contraction (reuses myosin) · Fever as set-point shift · SA:V across five systems (alveoli, villi, gills, tubules, root hairs) · Immune response with memory cells

*Misconceptions:* cold-blooded means cold · veins carry deoxygenated blood · you breathe for oxygen (it's CO₂) · fever is the infection · nerves as wires · muscles push *Assessment:* trace O₂ from air to mitochondrion · identify the feedback component · why a severed cord doesn't heal *Exemplar:* wood frogs freezing solid

---

## Diversity (\~10, or fold into evolution)

Interactive cladogram from trait matrices · Domain comparison · Phylogeny vs appearance sorter

---

## Effort profile

The reusable modules carry roughly 40% of the total. Of the remainder, about 50 are custom animations (the real cost), 30 interactive widgets, 60 static or annotated diagrams, 45 assessments, and a small amount of assembled real footage — heaviest in water, where capillary action, freezing, and water striders are all filmable and likely already available.

**If you build ten things:** sickle cell full chain · hydrophobic core cutaway · H-bond sandbox · universal reaction widget · tonicity sandbox · chemiosmosis (both contexts) · codon table interactive · meiosis variation counter · selection simulator · homeostasis loop.

Those ten touch every unit, exercise every reusable module, and include all three showcase traversals.
