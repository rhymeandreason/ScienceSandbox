<!-- KIND: argument — load when choosing the next protein to add to proteins.js, or when pricing one that has already been asked for. Candidates only: nothing here is committed, and no PDB id here has been fetched. Written 2026-08-27, alongside the ATP synthase bench review. How to actually add one is docs/AddingAProtein.md. -->

# What to add next, and what each one costs

**THE IDS ARE UNVERIFIED.** Every PDB id below was written from memory and none has been fetched. Confirm the id, the chain count and the format availability against RCSB before a baker is pointed at one. The `format` column is a prediction, not a measurement.

## The three selection goals

1. **Tells a story core to Bio 101**
2. **Complete data, or a fragment that is honest by itself.**
3. **Contributes a shape or a function the library does not already have.**
4. **Does it pair with something already in?** Contrast teaches. KcsA earns its place *because* napump is there; GroEL because prion is. Rank pairs above orphans.
5. **When movement is the story, are there two deposited states?** Pairs often help us here. A single apo structure is a portrait; a pair is a mechanism.
6. **Does it bring non-protein chains?** Nucleosome, DNA polymerase and the ribosome all carry nucleic acid. Whether `bake-lib.js` and the ss-record read handle that is a one-time engineering cost — but it gates four candidates at once, so it's worth pricing early.
7. **Species consistency.** Half the current library is whale, pig, cow and rat. Not wrong, but if two candidates tie, take the human one.
8. Is the shape beautiful?

## Tier 1 — big story, cheap bake, fills a real hole

| candidate | id | fills | chains | `does` | states? | format |
| --- | --- | --- | --- | --- | --- | --- |
| **Insulin** | 4INS | signalling; a hormone cut out of a bigger chain | 4 (2×AB) | new: `hormone` | no | pdb |
| **GFP** | 1EMA | the missing β-barrel; how biology is *done* | 1 | new: `reporter` | no | pdb |
| **Nucleosome** | 1AOI | DNA packaging — the chromatin picture | 8 + 2 DNA | `structural` | no | pdb |
| **Lysozyme** | 1LZ1 (human) | the first enzyme mechanism ever solved | 1 | `enzyme` | 2LZT etc. | pdb |
| **Antibody, intact IgG** | 1IGT | immune recognition; one fold reused six times | 4 | new: `recognition` | no | pdb |

Insulin and GFP are the two cheapest additions available and neither duplicates anything. Insulin is 51 residues and carries a story a Bio 101 reader already half knows. GFP is one chain, one barrel, and a chromophore the protein builds out of its own backbone — which is a claim a ribbon can show.

The nucleosome is the highest-value entry in this tier and the only one with an engineering cost: it brings DNA, and nothing in `bake-lib.js` has met a nucleic-acid chain. 

## Tier 2 — strong story, more work

| candidate | id | fills | chains | pairs against | why not tier 1 |
| --- | --- | --- | --- | --- | --- |
| **KcsA K⁺ channel** | 1BL8 | downhill transport; selectivity | 4 | **napump** | needs the bilayer treatment napump already has |
| **Aquaporin** | 1J4N | water across a membrane | 4 | **napump** | same, and the story overlaps KcsA's |
| **Myosin S1** | 2MYS | muscle; a lever arm that swings | 1 + 2 light | **atp-synthase** | wants a second state to tween |
| **Kinesin** | 1BG2 | walking; the other motor | 1 | **atp-synthase** | ditto, and less famous than myosin |
| **Chymotrypsin** | 4CHA | the catalytic triad; digestion | 3 | **amylase** | a fourth enzyme in a library of three |
| **Rubisco** | 1RCX | photosynthesis, absent entirely; most abundant protein on Earth | 16 | — | 16 chains, and no lesson waiting |
| **GroEL** | 1OEL | folding, chaperoned | 14 | **prion** | 14 chains for one barrel |
| **Ferritin** | 1FHA | 24 identical subunits, octahedral — a hollow iron ball built from one part | 24 | — | 24 chains, though only one part repeated |
| **LH2 light-harvesting ring** | 1NKZ? | a circle of chlorophylls on a ring of helices; the symmetry *is* the antenna | 18 | **rubisco**, if photosynthesis lands | carries chlorophyll, and no photosynthesis lesson yet |

The pairings are the argument. KcsA earns its place *because* napump is already registered — channel against pump, downhill against paid-for, on one bench — in a way it would not earn standing alone. Same for GroEL against prion: folding helped, next to folding gone wrong.

Myosin and kinesin are the second consumer of whatever the ATP synthase rotation became. Neither is worth adding until that machinery has settled and been named.

## Tier 3 — expensive, price before committing

| candidate | id | fills | scale | the cost |
| --- | --- | --- | --- | --- |
| **Complex I** | 5XTD? | the ETC lesson already queued | \~45 subunits | the stator-fit and label-travel traps, again |
| **DNA polymerase** | 1TAU | replication; the hand-shaped fold | 1 + DNA | DNA pipeline, and a two-state story to find |
| **Ribosome** | 4V6X? | translation | \~50 protein + rRNA | **mmCIF only — see below** |
| **Tubulin / actin** | 1JFF / 1ATN | cytoskeleton; a polymer that is not collagen | 2 / 1 | the subject is the filament, not the file |
| **HK97 capsid** | 1OHG? | subunits covalently linked into interlocking rings — protein chainmail | 60+ | almost certainly mmCIF-only |
| **Clathrin cage** | 1XI4? | triskelions self-assembling into a soccer ball; floppy leg, exact cage | 100+ | cryo-EM, coarse, and huge |

Complex I is the one with a schedule behind it: fermentation and the ETC are queued, and Complex I is the ETC's largest single object. It will hit both traps `atp-synthase/tools/prep.js` already documents — fitting on a pseudo-symmetric region, and chain labels that travel with the moving part — so its baker should start from that file rather than from scratch.

## Tier 4 — predicted Alphafold

keyed on **the hole** rather than on the protein. Verdict included so ruled-out candidates stay visible instead of being re-proposed.

| the hole | measured now | id | what prediction adds | pairs against | verdict |
| --- | --- | --- | --- | --- | --- |
| **PrP N-terminal half** | 1QLZ, **104 of 210** | P04156 | the half nobody can see, and the copper sites in it — why `does` is `unknown` | prion's own two, already registered | **take** — the hole is recorded in `read` already |
| **Histone tails** | 1AOI, tails absent | P0C0S8 etc. | the parts the chromatin story is entirely about | nucleosome, if it lands | **take, with it** |
| **α-synuclein monomer** | nothing deposited | P37840 | low pLDDT *as the finding* — the model reporting there is no answer | its own fibrils (2N0A, 6H6B); prion | **hold** — strong, but it's a new protein, not a hole in one we have |
| **Full-length collagen** | 3HR2, 5.2 Å envelope | P02452 | atomic detail across 3016 Å | collagen's six | **no** — long PPII trimers are a known weak case; a confident wrong rope |
| **Sickle Hb, E6V** | 2HBS, measured | P68871 | *nothing* — returns normal haemoglobin | 2HHB / 2HBS | **no, and say so** — the calibration case |
| **napump, the other door** | 7E1Z + 7E20, both measured | P05023 | one state, chosen by training data | E1/E2 | **no** — prediction flattens exactly what the pair teaches |

Basic lesson: The bottom three rows are the section's real work. A collection that only shows prediction succeeding teaches that it's a substitute for measurement; these three are cases where you hold the measured answer and prediction is confidently wrong, so the distinction `method` draws becomes something a reader can check rather than something a comment asserts.

Two rows to take, one to hold, three that exist to be refused.

Then the section changes character: it's no longer "a predicted entry when we're forced," it's **a section about how structures get made** — which is a current topic with a 2024 Nobel behind it (Baker for design; Hassabis and Jumper for AlphaFold).

That reframes what belongs in it. The best entries aren't proteins that happen to lack a structure — they're proteins where **the method is the story**.

| entry | id | the claim it carries | method | why it's in this section |
| --- | --- | --- | --- | --- |
| **A nucleoporin** (Y-complex member) | AF, id TBC | prediction supplying parts measurement couldn't trace | `predicted` | the NPC scaffold, 2022 — high pLDDT, no crystal structure, docked into cryo-EM density. The best-documented win there is |
| **Top7** | 1QYS | a fold that occurs in no gene, designed then solved | x-ray | the design half of the Nobel, and the library's only structure of something that was **imagined before it existed** |
| **α-synuclein monomer** | P37840 | low pLDDT *as the answer*— the model reporting there is nothing to report | `predicted` | disorder is \~30% of the human proteome and the library currently implies it doesn't exist |
| **A matched pair** — one protein you already hold, predicted | P02185 (myoglobin) | the same molecule, twice, by two methods | `predicted` | the calibration. Without it the section is anecdotes |
| **Sickle Hb, predicted** | P68871 | prediction returning normal haemoglobin for the mutation the library is about | `predicted` | the failure you can check against 2HBS, which you already hold |

**Top7 is the one I'd argue hardest for.** It's a measured x-ray structure, so it costs nothing unusual to bake — but it's a protein that was designed on a computer in 2003, then made, then crystallised, and the structure matched the design at \~1.2 Å. Nothing else in the collection is a molecule that didn't exist until someone specified it. Next to seven proteins that evolution wrote, it's the sharpest possible statement of what changed.

The nucleoporin is the strongest *prediction* case but I can't name the right subunit with confidence — that needs checking against the 2022 papers before it goes in the doc as anything but a placeholder.

And the two bottom rows are what keep the section honest: one case where prediction matches measurement almost exactly, one where it's confidently wrong about a molecule you hold the truth for.

## Tier 5 — designed by humans

Ranked by how much biology they teach rather than by how impressive they are. Ids are from memory and need checking.

| protein | id | year | what a student gets from it | pairs against |
| --- | --- | --- | --- | --- |
| **Top7** | 1QYS | 2003 | proof the inverse problem is solvable: a fold chosen on a screen, made, crystallised, and it matched at \~1.2 Å | everything — it's the baseline claim |
| **Designed fluorescent β-barrel**(mFAP) | TBC | 2018 | nature's barrel and a designed one doing the same job by different means | **GFP**, if it lands |
| **Neoleukin-2/15** | TBC | 2019 | same function as IL-2, *no sequence relation to it* — function follows shape, not ancestry | the whole homology assumption |
| **Kemp eliminase**(KE07/KE59) | TBC | 2008 | designed enzymes start terrible; directed evolution improved them \~10⁵-fold | **rnase, amylase** — natural enzymes that are superb |
| **Designed nanocage vaccine** (I53-50) | TBC | 2016–21 | self-assembly, and design reaching an approved medicine | — |
| **Designed coiled coils** (Harbury) | 1GCM etc. | 1993 | why two, three or four helices wrap — the packing rules, made testable | fills the library's **missing coiled coil** |
| **Designed TIM barrel** (sTIM11) | TBC | 2016 | **exact** symmetry where nature's is only pseudo — a billion years of drift, removed | **amylase**, whose catalytic domain is a natural TIM barrel |
| **Designed β-propeller** | TBC | 2015–17 | the same argument on a pinwheel | a natural propeller, not yet held |

**The two I'd actually build first:**

**Top7**, because without it nothing else in the section has a floor. It's one chain, \~93 residues, measured x-ray, and its entire meaning is that the fold appears in no genome.

**The Kemp eliminase**, because it's the honest one. Design produced a catalyst about a millionth as good as a natural enzyme; laboratory evolution then fixed what design couldn't. Set against amylase and RNase A — two enzymes that are extraordinarily good at their jobs — it says something true and unflattering that a section of triumphs would hide: humans can specify a *shape* well and a *catalytic site* badly, and the gap between those two is where the field actually is.

**Neo-2/15 is the biggest idea** on the list and the hardest to show. That two molecules with no common ancestor and no sequence similarity do the same job is a genuinely deep point about what a protein *is* — but it needs IL-2 alongside it to read at all, so it's a two-entry commitment.

The coiled coils are the cheapest win: tiny structures, well-solved, and they close a fold gap while teaching the one folding rule students can actually predict from a sequence.

## Ruled out, and why

Nothing yet. When a candidate is dropped it moves here with the reason, so it is not re-proposed six months later on the same merits.
