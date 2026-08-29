<!-- KIND: argument — the proposed re-partition of the mol-*.js files, and every molecule we have decided is worth adding. Load when deciding WHICH molecule to build next, before moving a spec between domain files, or to find the record a planned spec is generated from. `AddingAMolecule.md` is the recipe for building one once it is chosen; `MolecularGeometry.md` §1 is the rulebook both obey. Nothing here is built yet. -->

# Molecules wishlist

The library as it should be partitioned, and what is missing from it. **Bold = does not exist yet.**

## Why the partition changes

Files are named for a chemical class rather than for a page. Class tracks builder and scale family almost perfectly, so the cost rule the partition exists to serve (`molecules.js`'s `DOMAINS` note: a page must not parse specs it never renders) still holds, and the name becomes something a person can predict.

Two files were named for pages and are dissolved:

* **`mol-contrast.js`** held four unrelated chemical classes grouped by "appear side by side on `contrast-lab`". Four pages that are not `contrast-lab` load it — `amylase`, `chain/`, `chair/`, `capillary/` — and all four want only the disaccharides. They were parsing proline and palmitoleate to get maltose, which is the cost failure inverted: the contrast page's convenience billed to everyone else. Contrast survives where it already lives, in each spec's `contrast:` block naming its partner and `diff`. It was never a property a file had to carry.
* **`mol-compare.js`** held two specs, and every page that loaded it also loaded `mol-pathways.js`. The split saved nobody anything.

`mol-vitamins.js` goes too: one occupant, and `essential:` is a flag on the spec rather than a class. `mol-monomers.js` and `mol-pathways.js` are dissolved into the class files their contents belong to.

The trade is that `contrast-lab` goes from three domain files to five, because a contrast page is cross-class by nature. That is the correct place for the cost — it draws six pairs and uses nearly everything it loads.

## The files

| File | Existing | Additions |
| --- | --- | --- |
| `mol-sugars.js` | glucose, α-glucose, galactose, ribose, deoxyribose, ascorbate | **fructose**, **acarbose** |
| `mol-glycans.js` | maltose, cellobiose, lactose, galactobiose | **sucrose** |
| `mol-aminoacids.js` | gly, ala, ser, cys, D-ala, pro, gln, glu | **hydroxyproline**, **tyrosine**, **histidine**, **lysine**, **aspartate**, **tryptophan** |
| `mol-carriers.js` | ATP, AMP, Pi, NADH, FAD, FADH₂, CoA, acetyl-CoA, succinyl-CoA, atpSkel, nadhSkel | **ADP**, **NAD⁺**, **2,3-BPG** |
| `mol-glycolysis.js` | G6P, F6P, F16BP, DHAP, G3P, 1,3-BPG, 3PGA, 2PGA, PEP, pyruvate, lactate, acetaldehyde, ethanolSkel | — |
| `mol-krebs.js` | OAA, citrate, isocitrate, αKG, succinate, fumarate, malate | — |
| `mol-lipids.js` | glycerol, palmitate, palmitoleate, POPC | **elaidate**, **triacylglycerol**, **cholesterol**, **retinal (11-cis / all-trans)**, **testosterone / estradiol**, **ouabain** |
| `mol-nucleic.js` | adenine, thymine, guanine, cytosine, purine, pyrimidine | **uracil**, **CMP** |
| `mol-cofactors.js` | — | **heme b**, **chlorophyll a**, **β-carotene** |
| `mol-small.js` | water, ammonia, methane, O₂, CO₂, ethanol | **CO**, **urea**, **methanol** |
| `mol-solvation.js` | water, NaCl, KCl, ethanol, ammonia, methane, O₂, CO₂, carbonic, bicarbonate, hydronium | **Zn²⁺**, **Fe²⁺/Fe³⁺** |
| *deleted* | `mol-contrast.js`, `mol-compare.js`, `mol-vitamins.js`, `mol-monomers.js`, `mol-pathways.js` | dissolved into the rows above |

`mol-small.js` and `mol-solvation.js` stay the family A / family B either-or they already are; `register()` throws if both load, and that is the point.

### Placements that are not obvious

**Glucose goes in `mol-sugars.js`, and `glycolysis-lab` loads both files.** The alternative leaves the sugar file without the sugar. Six small monosaccharides cost nothing next to ATP.

**`mol-carriers.js` is the biggest structural win.** FAD and CoA are the two largest Skel builds in the repo and are currently stranded in `mol-krebs.js`, which `glycolysis-lab` does not load. No page draws a pathway without drawing its carriers, so they belong in one file every pathway page loads deliberately — and `mol-krebs.js` shrinks to the eight acids.

**Ions go in `mol-solvation.js`** because `nacl` and `kcl` already live there as bare dissociation records with no coordinates. A molecule with no geometry has no family, so Zn²⁺ and Fe are the same kind of object.

**Ouabain goes in `mol-lipids.js`, not beside the ions it is grouped with in every pharmacology textbook.** It is a 58-atom steroid glycoside with a rigid fused-ring core — family B, and structurally cholesterol's neighbour. That it happens to inhibit a pump is a fact about a protein, not a chemical class, which is the same reasoning that dissolves `mol-vitamins.js`.

**`mol-cofactors.js` is the one genuinely new file**, and the protein gallery is what demands it. Heme is wanted by myoglobin, haemoglobin and ferritin, is too large for `mol-small.js`, is not a carrier in the NAD/FAD sense, and is the shape chlorophyll reads against.

## Why these molecules

Two tests were applied, and a molecule earning its place under either is on the list.

### It completes a protein we already hold

The model is ascorbate, which exists because collagen does. `proteins/proteins.js` names a cast for each entry, and most of those casts have a missing character. **Hexokinase is the only protein whose full cast the library already has** (glucose, ATP, G6P).

* **Hydroxyproline** — collagen's variants hold `1CAG` and "the same helix with the hydroxyls on". Ascorbate is the vitamin; Hyp is what it makes, and it is the residue that makes the helix hold. One oxygen from the proline we have. The strongest single gap in the library.
* **ADP** — ATP synthase's entire purpose. We have ATP, AMP and Pi and not the substrate.
* **Tyrosine, histidine** — GFP's chromophore is Ser-Tyr-Gly cyclised and its blue variant is Y66H. Both residues are named in the entry; neither exists. Serine does.
* **Carbon monoxide** — myoglobin has three CO variants, including the photolysed one caught mid-escape. O₂ is in the library; its competitor is not.
* **Heme b** — myoglobin, haemoglobin, and the chemistry ferritin's iron does on the way in. It currently exists only as coordinates inside one protein.
* **Acarbose** — amylase's own bound ligand, a real diabetes drug, and a transition-state mimic: a sugar that cannot be cut, beside a maltose that can.
* **2,3-BPG** — haemoglobin's allosteric effector, one phosphate moved from the `bpg13` glycolysis already holds. Glycolysis and oxygen delivery as a contrast pair.
* **Uracil, CMP** — RNase A is pyrimidine-specific, and that claim needs U and C as nucleotides rather than free bases.
* **Zn²⁺** — insulin's storage hexamer is six copies around two zincs.
* **Fe²⁺/Fe³⁺** — ferritin's whole job is the oxidation on the way in.
* **Ouabain** — the Na⁺/K⁺ pump's classic inhibitor, an arrow poison and a heart drug.

**The prion has no partner and should not get one.** It is a fold, not chemistry, and adding a molecule for it would be inventing a cast.

### It closes a hole in a lesson we already teach

* **Uracil** — A, T, G and C are all here and U is not. The T-vs-U methyl is the canonical DNA-vs-RNA contrast, and `contrast-lab` is built for exactly that shape.
* **NAD⁺, ADP** — every pathway page narrates NAD⁺→NADH and ADP→ATP with one side of each on screen.
* **Cholesterol** — `membrane-lab` has POPC alone. Membrane fluidity currently has no molecule.
* **Sucrose** — four disaccharides in the library and not the one students eat.
* **Triacylglycerol** — palmitate and glycerol are both here; the fat itself is three condensations away, and "fat" has no model.
* **Charged and aromatic amino acids** — six of twenty, all roughly neutral. Lysine, aspartate, histidine (pKa ~6, the buffering one) and tryptophan would let a protein page argue about folding.
* **Elaidate** — the trans partner to the palmitoleate already here. One geometry change, and the most nutritionally loaded pair in Bio 101.
* **11-cis vs all-trans retinal** — vision as a single bond rotating. Nothing else in the repo is light-driven.
* **Testosterone vs estradiol** — near-identical steroids, wildly different outcome.
* **Chlorophyll a, β-carotene** — photosynthesis has no molecules at all. Chlorophyll is a heme-shaped porphyrin carrying Mg instead of Fe, so it reads directly against the heme in `hemoglobin-lab`.
* **Fructose, urea, methanol** — cheap, familiar, and each answers a question a student actually asks.

## Where each one comes from

`src:{path:…}` is `MolecularGeometry.md` §1.2's five sources. This table chooses one per molecule and names the record to ask for, so the choice is not re-argued at build time.

| Molecule | File | Path | Source | Why this path |
| --- | --- | --- | --- | --- |
| fructose (β-D-fructofuranose) | sugars | `skel` | `ringFuranose` | matches ribose and glucose; the Fischer layout is the lesson |
| sucrose | glycans | `skel` | glucose α1→2β fructose | must share the disaccharide build and its `glycosidic:` block |
| acarbose | sugars | `pubchem` | CID 41774 | four rings and many stereocentres — hand placement would drift |
| hydroxyproline | aminoacids | `pubchem` | CID 5810, trans-4-hydroxy-L- | matches every existing amino acid; expect proline's hand reindex |
| tyrosine | aminoacids | `pubchem` | CID 6057 | ditto |
| histidine | aminoacids | `pubchem` | CID 6274 | ditto |
| lysine | aminoacids | `pubchem` | CID 5962 | ditto |
| aspartate | aminoacids | `pubchem` | CID 5960 | ditto |
| tryptophan | aminoacids | `pubchem` | CID 6305 | ditto |
| ADP | carriers | `skel` | ATP's build, truncated | `glycolysis-lab` draws `atpSkel`; a PubChem ADP would not match it |
| NAD⁺ | carriers | `skel` | NADH's build, minus the C4 hydride | the pair's only visible difference must be the actual difference |
| 2,3-BPG | carriers | `skel` | 1,3-BPG's build, phosphate moved | charged; PubChem has no usable 3D for the 4− anion |
| elaidate | lipids | `built` | palmitoleate's method, trans | topology is the lesson; a real conformer renders as spaghetti |
| triacylglycerol (tripalmitin) | lipids | `built` | glycerol + 3× palmitate | ditto |
| cholesterol | lipids | `pubchem` | CID 5997 | rigid fused rings — the flat plate IS the shape |
| 11-cis retinal | lipids | `pubchem` | CID 1070 | the geometry is the claim, so it must be a real record |
| all-trans retinal | lipids | `pubchem` | CID 638015 | ditto |
| testosterone | lipids | `pubchem` | CID 6013 | rigid steroid |
| estradiol | lipids | `pubchem` | CID 5757 | ditto |
| ouabain | lipids | `pubchem` | CID 439501 | rigid glycoside; it has geometry, so not an ion record |
| uracil | nucleic | `pubchem` | CID 1174 | matches A/T/G/C; declare `tautomer:` like its neighbours |
| CMP | nucleic | `pubchem` | CID 6131 | branching sugar, phosphate and base |
| heme b | cofactors | `pubchem` | PDB component `HEM`, or CID 26945 | not the hemoglobin bake — see below |
| chlorophyll a | cofactors | `pubchem` | PDB component `CLA`, or CID 12085802 | the phytol tail is likely truncated; declare it if so |
| β-carotene | cofactors | `pubchem` | CID 5280489 | long rigid polyene |
| carbon monoxide | small | `hand` | 1.128 Å, one bond | §1.2 case 1, trivially |
| urea | small | `hand` | planar, known angles | the comments are the teaching material |
| methanol | small | `hand` | microwave geometry | the same source as its `mol-small.js` neighbours |
| Zn²⁺ | solvation | `hand` | ionic radius and charge | a dissociation record with no coordinates, like `nacl` |
| Fe²⁺ / Fe³⁺ | solvation | `hand` | ditto | ditto |

**Ask PubChem by CID, never by name** (§1.2 case 2). A name pins neither stereocentre nor charge state, and half this list is chiral or charged.

### Seven of these are the second half of a pair

NAD⁺/NADH · ADP/ATP · elaidate/palmitoleate · hydroxyproline/proline · uracil/thymine · the two retinals · testosterone/estradiol.

Each must follow its partner's build line for line, the way galactose deliberately mirrors glucose in the file it currently sits in. If the two builds drift apart, a difference shows up on screen that is not the difference — and it renders perfectly.

### Heme is sourced from the chemical component, not from the protein

`hemoglobin/` already bakes heme, and `hemoglobin/tools/check-hb.js` asserts what it is: 43 heavy atoms — 34 C, 4 N, 4 O, 1 Fe — bonded from 2HHB's CONECT records, with the iron four-coordinate to its four pyrrole nitrogens.

That heme is IN SITU, and it is a different object from a spec. Everything interesting about it is relative to the pocket: `proxRes`, `prox` and the `o2` site are meaningless the moment it leaves. There are four copies per bake, in the protein's frame, heavy atoms only, in the deoxy state of one particular crystal.

A spec is the SUBSTANCE — one canonical heme b, centred, with its own `view`, its hydrogens present or declared in `optH`, comparable to a family-B water. `mol-small.js` and `mol-solvation.js` are the standing precedent for one substance held twice because the two answer different questions.

Sourcing it from `hemoglobin/data/` would make the spec a derived artefact of a derived artefact, inheriting 2HHB's accidents, and would chain it to a protein it has to outlive: the reason to want a heme spec at all is chlorophyll, the same ring carrying Mg instead of Fe.

THE RISK, and it is the one thing here nothing catches. Unlike `mol-small.js` and `mol-solvation.js`, these two hemes are in different namespaces — one is a registry key, the other is baked data — so `register()` will never throw and a drift is silent. Worth a cheap assertion that the two agree on 34/4/4/1 and on a four-coordinate iron. Topology only: the conformers legitimately differ, and checking coordinates would fail correctly.

## Where to start

**Uracil** is the cheapest and closes a real hole. **Hydroxyproline** is the one that finishes a story already half-told on the page. **Cholesterol** is the one that opens a lesson.
