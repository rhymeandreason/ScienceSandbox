<!-- KIND: argument — load when choosing the next protein to add to proteins.js, or when pricing one that has already been asked for. Candidates only: nothing here is committed, and no PDB id here has been fetched. Written 2026-08-27, alongside the ATP synthase bench review. How to actually add one is docs/AddingAProtein.md. -->

# What to add next, and what each one costs

**Tier 1 and Tier 2 are verified (2026-08-28), as are the Tier 3 rows marked `id verified`; the rest are not.** Every id outside Tier 1 was written from memory and none has been fetched. Confirm the id, the chain count and the format availability against RCSB before a baker is pointed at one. The `format` column is a prediction, not a measurement.

## The three selection goals

1. **Tells a story core to Bio 101**
2. **Complete data, or a fragment that is honest by itself.**
3. **Contributes a shape or a function the library does not already have.**
4. **Does it pair with something already in?** Contrast teaches. KcsA earns its place *because* napump is there; GroEL because prion is. Rank pairs above orphans.
5. **When movement is the story, are there two deposited states?** Pairs often help us here. A single apo structure is a portrait; a pair is a mechanism. The `motion?` column answers this and nothing else — a second *state of the same construct*. A related protein, a different species or a bound partner goes in `pairs with`, which is goal 4.
6. **Does it bring non-protein chains?** Nucleosome, DNA polymerase and the ribosome all carry nucleic acid. Whether `bake-lib.js` and the ss-record read handle that is a one-time engineering cost — but it gates four candidates at once, so it's worth pricing early.
7. **Species consistency.** Half the current library is whale, pig, cow and rat. Not wrong, but if two candidates tie, take the human one.
8. Is the shape beautiful?

## Tier 1 — big story, cheap bake, fills a real hole

**Verified 2026-08-28** against RCSB: every id below was fetched, `.pdb` confirmed to exist, and chains / missing residues / ligands read out of the file itself. `chains` is the asymmetric unit; `gaps` counts unobserved residues per chain (REMARK 465).

| candidate | id | fills | chains (AU) | `does` | motion? | variance? | pairs with | file notes | status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Insulin** | **1MSO** (was 4INS) | signalling; a hormone cut out of a bigger chain | 4 = 2×(A21 + B30) | new: `hormone` | no | no | — | 1.00 Å, **no gaps**, 2 Zn. 4INS is pig at 1.5 Å; 3I40 is one AB dimer if the hexamer is noise | id verified |
| **GFP** | 1EMA | the missing β-barrel; how biology is *done* | 1 | new: `reporter` | no | **engineered** — 1EMA is the **S65T** bright mutant, `MUTATION: YES` in the file, not wild-type *Aequorea* GFP | **2POR** — one fold, two problems | 1.9 Å, 10 gaps (both termini, barrel intact), chromophore as **CRO**, one residue | id verified |
| **Nucleosome** | 1AOI | DNA packaging — the chromatin picture | 8 histone + 2×146 bp DNA | `structural` | no | no | 1ZAA; histone tails (Tier 4) | 2.8 Å, Xenopus. Tails unobserved: H3 18, H3′ 8, H4 4, H2A 1 | id verified |
| **Lysozyme** | 1LZ1 | the first enzyme mechanism ever solved | 1 | `enzyme` | no | no — but human lysozyme **amyloid** variants (I56T, D67H) are a real disease pair, not yet priced | **amylase** (held); β-lactamase | 1.5 Å, human, **130/130, no gaps, no ligands** — the cleanest file in the tier. 2LZT etc. are hen, a species contrast not a state | id verified |
| **Antibody, intact IgG** | **1HZH** (or 1IGT) | immune recognition; one fold reused six times | 4 (2 heavy 457, 2 light 215) | new: `recognition` | no | no | — | 2.7 Å, **human** IgG1 b12, 13 gaps in one heavy chain, heavy N-glycans. 1IGT is mouse, 2.8 Å, **no gaps** — cleaner file, wrong species | id verified, pick one |
| **Triosephosphate isomerase** | **1HTI** (was 1TIM) | EC class **5, isomerase** — empty; glycolysis | 2 | `enzyme` | no | no | **amylase**, whose catalytic domain is the same barrel | 2.8 Å, human, **no gaps**, PGA inhibitor bound. 1TIM is chicken at 2.5 Å — the fold is named after that file | id verified |
| **Hexokinase** | 1HKB? / 2YHX? | EC class **2, transferase** — empty | 1–2 | `enzyme` | **yes** — open, glucose-closed | no | — | | Done |
| **Carbonic anhydrase** | 1CA2 | EC class **4, lyase** — empty; one zinc | 1 | `enzyme` | no | no | **catalase** — both diffusion-limited | 2.0 Å, human, 3 gaps (N-term), 1 Zn | id verified |
| **Lactate dehydrogenase** | **4L4R / 4L4S / 1I10** | EC class **1, oxidoreductase** — empty | 2 / 2 / 8 | `enzyme` | **yes — three states, verified** | no — 4L4R/4L4S/1I10 are one wild-type isozyme | ADH, the other branch | Human **M** isozyme all the way through: **4L4R apo** 2.1 Å, **4L4S + NADH** 2.9 Å, **1I10 + NADH + oxamate** 2.3 Å. A loop closing over the site in three steps. 1I0Z is the **H** isozyme — do not mix the two | id verified |
| **Alcohol dehydrogenase** | **1HET + 8ADH** | the fermentation branch | 2 / 1 | `enzyme` | **yes — verified** | no | LDH; the fermentation lesson | Horse liver both: **1HET holo** 1.15 Å with NAD + 2 Zn, **8ADH apo** 2.4 Å, no gaps. 8ADH's own title is the interdomain motion. Yeast **4W6Z** (2.4 Å, 4 chains) is right for fermentation but has no apo partner verified | id verified, pick organism |
| **Haemoglobin R state** | **2DN1** (not 2DN2) | T→R allostery — the **R** half only; T is already held as 2HHB | 1 αβ dimer in the file; **assembly 1 is 2 models, each carrying chains A and B** | `oxygen carrier` | **yes** — oxy against held deoxy | no — oxy/deoxy is a ligand state, so this variant gets **no `state` field**; the axis is for healthy/disease/mutant/swap | **held haemoglobin, as a variant of it** — not a new protein | 1.25 Å, human, 1 gap/chain, 4 HEM + 8 **OXY** atoms. **Do not take 2DN2**: it is deoxy and would duplicate 2HHB, whose bakes feed a featured lesson (`2HHB-B.fold.bin`, the surface the sickle contact needs). The T/R mismatch in resolution, 1.74 against 1.25, is invisible on a Cα ribbon. **Real cost**: something must expand assembly 1 and rename A,B,A,B to A,B,C,D before a quaternary bake — `hemoglobin/tools/` has never met that, since 2HHB is a 4-chain deposition. Same model-merging shape as ferritin and GroEL | id verified |
| **Fetal haemoglobin** | 1FDH | the developmental switch | 4 (2α + 2γ) | `oxygen carrier` | no | no — a different gene, not a mutation | **2DN2** — adult deoxy, same state | 2.5 Å, human, deoxy, **no gaps**, 4 HEM | id verified |
| **Cytochrome c** | **3ZCF** (was 3CYT) | tiny, ancient, near-identical yeast to human | 4 copies of 1 | new: `electron carrier` | no | no | — | 1.65 Å, **human**, no gaps, HEC covalently attached. 3CYT is tuna and holds oxidised and reduced conformers as chains O and I, but the difference is sub-ångström: a redox pair, not a visible motion | id verified |
| **Zinc finger on DNA** | 1ZAA | sequence-specific DNA reading, smallest package there is | 1 protein (87) + 2 DNA (11 bp) | new: `DNA-binding` | no | no | **1AOI**, **1YSA** | 2.1 Å, Zif268 (mouse), 2 gaps, **3 Zn** — one per finger | id verified |
| **Leucine zipper** | 1YSA | the **natural** coiled coil | 2 protein (58) + 2 DNA (20 bp) | new: `DNA-binding` | no | no | **1ZAA**; designed coiled coils (Tier 5) | 2.9 Å, GCN4 (yeast), 1 gap/chain, no ligands. Two HELIX records for the whole file | id verified |
| **Bacterial porin** | 2POR | a **second** β-barrel, membrane-embedded | 1 | new: `transport` | no | no | **1EMA**; napump (held) | 1.8 Å, *Rhodobacter capsulatus*, **no gaps**, 17 SHEET records, C8E detergent belt marks the bilayer | id verified |
| **Calmodulin** | **1CLL + 1CFD** | a Ca²⁺ switch; one of the largest changes in a small protein | 1 each | new: `sensor` | **yes** — Ca-bound/apo | no | — | 1CLL 1.7 Å x-ray, 4 Ca, 4 gaps; 1CFD **solution NMR**, apo, no gaps. Labelled human and Xenopus — **SEQRES identical at all 148 residues**, so it is one protein twice | id verified |
| **Catalase** | 1DGF | EC class **1** again; diffusion-limited | 4 | `enzyme` | no | no | **1CA2** | 1.5 Å, human erythrocyte, **4×497, no gaps**, 4 HEM + 4 NADPH | id verified |
| --- 
Every Tier 1 file is x-ray except 1CFD (NMR), every one has legacy `.pdb`, and every one carries HELIX/SHEET records, so the ss read needs nothing new.

**`variance?` is the third axis, beside `motion?` and `pairs with`.** It answers one question: does this entry carry a sequence that differs from the wild-type protein, and is that difference the point or an artefact of getting the crystal? Three of the verified files carry substitutions nobody would guess from the name — GFP's 1EMA is the S65T mutant, KcsA's open state carries six, and 1FHA was crystallised through engineered contacts. A `no` in that column has been checked, not assumed.

**Sickle haemoglobin is done.** The tetramer **is** in `proteins.js`, as `hemoglobin/2HBS`, surface-baked and carrying `state: 'mutant'` since 2026-08-28. What is outstanding is the **fibre**, which the registry header already lists under WHAT IS NOT HERE and which joins the day it has a pipeline the re-bake reaches. Neither is a candidate, and neither belongs in this document except as the thing the R state pairs against.

**Four id changes**, three of them on selection goal 7: insulin 4INS → **1MSO**, TIM 1TIM → **1HTI**, cytochrome c 3CYT → **3ZCF**, and oxy Hb 1HHO → **2DN1** on resolution and chain count.

**2HHB stays.** An earlier draft of this row proposed swapping the held deoxy tetramer for 2DN2 so that T and R came from one study at one resolution. That is wrong from inside the registry: 2HHB's bakes feed `hemoglobin-lab`, a featured lesson, and re-cutting them to gain sharpness a ribbon cannot show is a regression traded for nothing. R is the half that is missing, and 2DN1 is the whole change.

**The cheapest three are 1LZ1, 1MSO and 1EMA** — one chain or two, no gaps worth naming, and in GFP's case a chromophore the file already names as a residue.

The nucleosome is still the highest-value entry and still the only one with an engineering cost: 2 DNA chains of 146 nt, and nothing in `bake-lib.js` has met a nucleic-acid chain.

## Tier 2 — strong story, more work

| candidate | id | fills | chains | motion? | variance? | pairs against | why not tier 1 | status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **KcsA K⁺ channel** | 1BL8 (+ **5VK6**) | downhill transport; selectivity | 4 | **yes, with a caveat** | **engineered, heavily** — 5VK6 carries **six** substitutions (A28C, E71A, L90C, R117Q, E118C, E120Q), not the one the name implies | **napump** | needs the bilayer treatment napump already has. Verified: 1BL8 closed 3.2 Å; **5VK6 open 2.25 Å is the E71A mutant and ships with a mouse Fab bound** (2 of its 3 chains) — the open state is not the same molecule alone | id verified |
| **Aquaporin** | 1J4N | water across a membrane | **1 in the file**; tetramer via assembly 1 | no | no | **napump**, **2POR** | 2.2 Å, **bovine** AQP1, 22 gaps, BNG detergent belt. **Species goal loses here**: the human AQP1, 1FQY, is electron crystallography at 3.8 Å with 43 gaps. Story still overlaps KcsA's | id verified |
| **Myosin S1** | **1FMW / 1MMD / 1VOM** (not 2MYS) | muscle; a lever arm that swings | 1 each | **yes — three states, verified** | no — the three states are one construct | **atp-synthase** | the second state exists after all. *Dictyostelium* motor domain, one construct: **1FMW** MgATP 2.15 Å, **1MMD** ADP·BeF₃ 2.0 Å, **1VOM** ADP·vanadate 1.9 Å, 19–32 gaps each. **2MYS is a trap** — chicken S1 at 2.8 Å whose two light chains are **Cα-only**, which renders as a ribbon and is not a structure | id verified |
| **Kinesin** | 1BG2 | walking; the other motor | 1 | **no clean pair** | no | **atp-synthase** | verified: 1BG2 is human motor domain + ADP, 1.8 Å. 3KIN is a rat dimer, 4HNA is kinesin on tubulin with a DARPin — neither is the same construct in a second state. The demotion stands | id verified |
| **Chymotrypsin** | **2CGA → 4CHA** | the catalytic triad; digestion — **and a zymogen cut into an enzyme** | 1 → 3 | **yes — activation, verified** | no (a cut, not a substitution) | **amylase**; prion, for what a cut does to a fold | the demotion reason was thin. Bovine both: **2CGA chymotrypsinogen** 1.8 Å, **one chain of 245, no gaps**, inert; **4CHA α-chymotrypsin** 1.68 Å, the same protein as **three chains (13 / 131 / 97)** held by disulfides after two cuts. The activation is legible as the chain count, which no other pair here can say | id verified |
| **Rubisco** | **1RCX + 8RUC** | photosynthesis, absent entirely; most abundant protein on Earth | 16 (8 large + 8 small) / 8 | **yes — activation, verified** | no | **LH2**, if photosynthesis lands | Spinach both: **1RCX non-activated** 2.4 Å with RuBP bound, and **8RUC activated** 1.60 Å with CABP + Mg. The activation is one **carbamylated lysine** — `KCX` appears 48 times in 8RUC and **zero times in 1RCX**, so the difference between the two files is a residue a page can point at, and a checker can assert. Still 16 chains and no lesson waiting | id verified |
| **GroEL** | 1OEL (+ **1AON**) | folding, chaperoned | **7 in the file**; 14 via assembly 1, as 2 models of 7 | **yes — verified** | no | **prion** | 2.8 Å, *E. coli*, 547 res/chain, 23 gaps each, no ligands. **1AON is the partner state** — GroEL + GroES + 7 ADP, 3.0 Å, 21 chains in one AU, lid on and one ring open | id verified |
| **Ferritin** | 1FHA | 24 identical subunits, octahedral — a hollow iron ball built from one part | **1 in the file**; 24 via assembly 1, as 24 models of 1 | no | no — but 1FHA was **crystallised via engineered contacts**, per its own title | — | **human** H ferritin, 2.4 Å, one 183-residue 4-helix bundle, 11 gaps, 1 Fe + 2 Ca. **Not a 24-chain bake** — the cheapest chain in the doc, repeated. Cost is merging 24 models | id verified |
| **LH2 light-harvesting ring** | 1NKZ | a circle of chlorophylls on a ring of helices; the symmetry *is* the antenna | **6 in the file** (3 αβ pairs); the 9-fold ring via assembly 1 | no | no | **rubisco**, if photosynthesis lands | 2.0 Å, *Rhodoblastus acidophilus*, 1 gap/α chain. **The pigments are all in the file** — 594 BCL atoms and 312 carotenoid (RG1), which is the antenna itself and not a garnish. Chains are 53 and 41 residues: two helices per pair, and the ring is symmetry | id verified |
| **PCNA sliding clamp** | **1VYM** (was 1AXC) | a ring threaded *around* DNA | 3 | no | no | DNA polymerase | 1VYM is **native human PCNA**, 2.3 Å, 3×261, 5 gaps/chain, no ligands — the bare ring. 1AXC is the same ring with a 22-residue **p21 peptide** in each site: a binding partner, not a second state | id verified |
| **β-lactamase** | 1BTL | antibiotic resistance: evolution on a human timescale | 1 | no | **wanted, no id yet** — the resistant variant this row asks for is unnamed. TEM-1 (1BTL) is the parent; an extended-spectrum TEM needs picking | **lysozyme** — bacterial wall made and unmade | verified: *E. coli* TEM-1, 1.8 Å, 1 chain. Wants a resistant variant beside it to read | id verified |
| **Antifreeze protein** | 1WFA | binds **ice**, not a molecule — and `water-lab` is a featured lesson about that surface | 2 copies of 1 | no | no | **water-lab's ice**; collagen, the other one-shape protein | 1.7 Å, winter flounder, **38 residues, 1 gap** — the whole protein is a **single α-helix**, two HELIX records for two copies. The smallest entry in the doc by a wide margin, and the bake is trivial; the cost is entirely the ice lattice it has to be shown against | id verified |
| **Nitrogenase** | **1M1N + 1N2C** | the FeMo cofactor — breaking N≡N at room temperature | 8 each | **yes — docking, verified** | no | **atp-synthase** — the other ATP-driven machine | *Azotobacter* both. **1M1N is the MoFe protein alone at 1.16 Å**, the sharpest file anywhere in this doc, carrying FeMo-co (`CFN`) and the P-cluster (`CLF`). **1N2C is the Fe protein docked onto it**, 3.0 Å, frozen mid-cycle by ADP·AlF₄⁻, adding 4 chains and an `SF4` cluster. Still a metal cluster the bake has never met — but at 1.16 Å it would be met properly | id verified |
| --- 
**Verifying this tier moved three rows and killed two demotion reasons.** Chymotrypsin was down here as "a fourth enzyme in a library of three"; it is really a zymogen and an enzyme, and the cut between them is visible as a chain count. Rubisco was down here for 16 chains; it still has them, but its activation turns out to be one carbamylated lysine present in one file and absent in the other. Myosin was demoted for wanting a second state, and has three. What is left holding this tier down is chain count and missing lessons, which are honest reasons, rather than gaps in the deposition record.

The pairings are the argument. KcsA earns its place *because* napump is already registered — channel against pump, downhill against paid-for, on one bench — in a way it would not earn standing alone. Same for GroEL against prion: folding helped, next to folding gone wrong.

Myosin and kinesin are the second consumer of whatever the ATP synthase rotation became, and neither is worth adding until that machinery has settled and been named. They are no longer the same bet, though: **myosin's second state exists and kinesin's does not.** The *Dictyostelium* motor domain is deposited in three nucleotide states of one construct, all under 2.2 Å, so a lever-arm tween is a matter of choosing two of them. Kinesin's only partners change the composition — a dimer, or the motor on tubulin — so there is nothing to tween against.

## Tier 3 — expensive, price before committing

| candidate | id | fills | scale | motion? | variance? | the cost | status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Complex I** | 5XTD? | the ETC lesson already queued | \~45 subunits | unverified | unverified | the stator-fit and label-travel traps, again |  |
| **DNA polymerase** | **4KTQ + 3KTQ** (was 1TAU) | replication; the hand-shaped fold | 1 + DNA each | **yes — verified** | no — 4KTQ/3KTQ are one construct | DNA pipeline. The two-state story is found: Taq large fragment, **4KTQ open binary** 2.5 Å (primer/template only) and **3KTQ closed ternary** 2.3 Å (ddNTP caught in the site), each 1 protein + 2 DNA chains, essentially no gaps. The fingers close between them | id verified |
| **Ribosome** | 4V6X? | translation | \~50 protein + rRNA | unverified | unverified | **mmCIF only — see below** |  |
| **Aminoacyl-tRNA synthetase** | TBC | EC class **6, ligase** — empty | 1–2 + tRNA | unverified | unverified | RNA pipeline, same gate as DNA polymerase |  |
| **Tubulin / actin** | 1JFF / 1ATN | cytoskeleton; a polymer that is not collagen | 2 / 1 | unverified | unverified | the subject is the filament, not the file |  |
| **CRISPR-Cas9** | 5F9R | humans engineering biology | 1 + sgRNA + DNA | unverified | unverified | RNA *and* DNA in one file; same gate as DNA polymerase |  |
| **HK97 capsid** | 1OHG? | subunits covalently linked into interlocking rings — protein chainmail | 60+ | unverified | unverified | almost certainly mmCIF-only |  |
| **Clathrin cage** | 1XI4? | triskelions self-assembling into a soccer ball | 100+ | unverified | unverified | cryo-EM, coarse, and huge |  |
| --- 
Complex I is the one with a schedule behind it: fermentation and the ETC are queued, and Complex I is the ETC's largest single object. It will hit both traps `atp-synthase/tools/prep.js` already documents — fitting on a pseudo-symmetric region, and chain labels that travel with the moving part — so its baker should start from that file rather than from scratch.

## Tier 4 — predicted Alphafold

keyed on **the hole** rather than on the protein. Verdict included so ruled-out candidates stay visible instead of being re-proposed.

| the hole | measured now | id | what prediction adds | pairs against | verdict | status |
| --- | --- | --- | --- | --- | --- | --- |
| **PrP N-terminal half** | 1QLZ, **104 of 210** | P04156 | the half nobody can see, and the copper sites in it — why `does` is `unknown` | prion's own two, already registered | **take** — the hole is recorded in `read` already |  |
| **Histone tails** | 1AOI, tails absent | P0C0S8 etc. | the parts the chromatin story is entirely about | nucleosome, if it lands | **take, with it** |  |
| **α-synuclein monomer** | nothing deposited | P37840 | low pLDDT *as the finding* — the model reporting there is no answer | its own fibrils (2N0A, 6H6B); prion | **hold** — strong, but it's a new protein, not a hole in one we have |  |
| **Full-length collagen** | 3HR2, 5.2 Å envelope | P02452 | atomic detail across 3016 Å | collagen's six | **no** — long PPII trimers are a known weak case; a confident wrong rope |  |
| **Sickle Hb, E6V** | 2HBS, measured | P68871 | *nothing* — returns normal haemoglobin | 2HHB / 2HBS | **no, and say so** — the calibration case |  |
| **napump, the other door** | 7E1Z + 7E20, both measured | P05023 | one state, chosen by training data | E1/E2 | **no** — prediction flattens exactly what the pair teaches |  |

Basic lesson: The bottom three rows are the section's real work. A collection that only shows prediction succeeding teaches that it's a substitute for measurement; these three are cases where you hold the measured answer and prediction is confidently wrong, so the distinction `method` draws becomes something a reader can check rather than something a comment asserts.

Two rows to take, one to hold, three that exist to be refused.

Then the section changes character: it's no longer "a predicted entry when we're forced," it's **a section about how structures get made** — which is a current topic with a 2024 Nobel behind it (Baker for design; Hassabis and Jumper for AlphaFold).

That reframes what belongs in it. The best entries aren't proteins that happen to lack a structure — they're proteins where **the method is the story**.

| entry | id | the claim it carries | method | why it's in this section | status |
| --- | --- | --- | --- | --- | --- |
| **A nucleoporin** (Y-complex member) | AF, id TBC | prediction supplying parts measurement couldn't trace | `predicted` | the NPC scaffold, 2022 — high pLDDT, no crystal structure, docked into cryo-EM density. The best-documented win there is |  |
| **Top7** | 1QYS | a fold that occurs in no gene, designed then solved | x-ray | the design half of the Nobel, and the library's only structure of something that was **imagined before it existed** |  |
| **α-synuclein monomer** | P37840 | low pLDDT *as the answer*— the model reporting there is nothing to report | `predicted` | disorder is \~30% of the human proteome and the library currently implies it doesn't exist |  |
| **A matched pair** — one protein you already hold, predicted | P02185 (myoglobin) | the same molecule, twice, by two methods | `predicted` | the calibration. Without it the section is anecdotes |  |
| **Sickle Hb, predicted** | P68871 | prediction returning normal haemoglobin for the mutation the library is about | `predicted` | the failure you can check against 2HBS, which you already hold |  |

**Top7 is the one I'd argue hardest for.** It's a measured x-ray structure, so it costs nothing unusual to bake — but it's a protein that was designed on a computer in 2003, then made, then crystallised, and the structure matched the design at \~1.2 Å. Nothing else in the collection is a molecule that didn't exist until someone specified it. Next to seven proteins that evolution wrote, it's the sharpest possible statement of what changed.

The nucleoporin is the strongest *prediction* case but I can't name the right subunit with confidence — that needs checking against the 2022 papers before it goes in the doc as anything but a placeholder.

And the two bottom rows are what keep the section honest: one case where prediction matches measurement almost exactly, one where it's confidently wrong about a molecule you hold the truth for.

## Tier 5 — designed by humans

Ranked by how much biology they teach rather than by how impressive they are. Ids are from memory and need checking.

| protein | id | year | what a student gets from it | pairs against | status |
| --- | --- | --- | --- | --- | --- |
| **Top7** | 1QYS | 2003 | proof the inverse problem is solvable: a fold chosen on a screen, made, crystallised, and it matched at \~1.2 Å | everything — it's the baseline claim |  |
| **Designed fluorescent β-barrel**(mFAP) | TBC | 2018 | nature's barrel and a designed one doing the same job by different means | **GFP**, if it lands |  |
| **Neoleukin-2/15** | TBC | 2019 | same function as IL-2, *no sequence relation to it* — function follows shape, not ancestry | the whole homology assumption |  |
| **Kemp eliminase**(KE07/KE59) | TBC | 2008 | designed enzymes start terrible; directed evolution improved them \~10⁵-fold | **rnase, amylase** — natural enzymes that are superb |  |
| **Designed nanocage vaccine** (I53-50) | TBC | 2016–21 | self-assembly, and design reaching an approved medicine | — |  |
| **Designed coiled coils** (Harbury) | 1GCM etc. | 1993 | why two, three or four helices wrap — the packing rules, made testable | fills the library's **missing coiled coil** |  |
| **Designed TIM barrel** (sTIM11) | TBC | 2016 | **exact** symmetry where nature's is only pseudo — a billion years of drift, removed | **amylase**, whose catalytic domain is a natural TIM barrel |  |
| **Designed β-propeller** | TBC | 2015–17 | the same argument on a pinwheel | a natural propeller, not yet held |  |

**The two I'd actually build first:**

**Top7**, because without it nothing else in the section has a floor. It's one chain, \~93 residues, measured x-ray, and its entire meaning is that the fold appears in no genome.

**The Kemp eliminase**, because it's the honest one. Design produced a catalyst about a millionth as good as a natural enzyme; laboratory evolution then fixed what design couldn't. Set against amylase and RNase A — two enzymes that are extraordinarily good at their jobs — it says something true and unflattering that a section of triumphs would hide: humans can specify a *shape* well and a *catalytic site* badly, and the gap between those two is where the field actually is.

**Neo-2/15 is the biggest idea** on the list and the hardest to show. That two molecules with no common ancestor and no sequence similarity do the same job is a genuinely deep point about what a protein *is* — but it needs IL-2 alongside it to read at all, so it's a two-entry commitment.

The coiled coils are the cheapest win: tiny structures, well-solved, and they close a fold gap while teaching the one folding rule students can actually predict from a sequence.

## Ruled out, and why

Nothing yet. When a candidate is dropped it moves here with the reason, so it is not re-proposed six months later on the same merits.
