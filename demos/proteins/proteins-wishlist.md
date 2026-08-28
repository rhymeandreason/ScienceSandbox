<!-- KIND: argument — load when choosing the next protein to add to proteins.js, or when pricing one that has already been asked for. Candidates only: nothing here is committed, and no PDB id here has been fetched. Written 2026-08-27, alongside the ATP synthase bench review. How to actually add one is docs/AddingAProtein.md. -->

# What to add next, and what each one costs

**THE IDS ARE UNVERIFIED.** Every PDB id below was written from memory and none has been fetched. Confirm the id, the chain count and the format availability against RCSB before a baker is pointed at one. The `format` column is a prediction, not a measurement.

## The three selection goals

1. **Tells a story core to Bio 101**
2. **Complete data, or a fragment that is honest by itself.** 
3. **Contributes a shape or a function the library does not already have.**
4. **Does it pair with something already in?** Contrast teaches. KcsA earns its place *because* napump is there; GroEL because prion is. Rank pairs above orphans.
5. **When movement is the story, are there two deposited states, or only one?** Pairs often help us here. A single apo structure is a portrait; a pair is a mechanism.
6. **Does it bring non-protein chains?** Nucleosome, DNA polymerase and the ribosome all carry nucleic acid. Whether `bake-lib.js` and the ss-record read handle that is a one-time engineering cost — but it gates four candidates at once, so it's worth pricing early.
7. **Species consistency.** Half the current library is whale, pig, cow and rat. Not wrong, but if two candidates tie, take the human one.

## Tier 1 — big story, cheap bake, fills a real hole

| candidate | id | fills | chains | `does` | states? | format |
| --- | --- | --- | --- | --- | --- | --- |
| **Insulin** | 4INS | signalling; a hormone cut out of a bigger chain | 4 (2×AB) | new: `hormone` | no | pdb |
| **GFP** | 1EMA | the missing β-barrel; how biology is *done* | 1 | new: `reporter` | no | pdb |
| **Nucleosome** | 1AOI | DNA packaging — the chromatin picture | 8 + 2 DNA | `structural` | no | pdb |
| **Lysozyme** | 1LZ1 (human) | the first enzyme mechanism ever solved | 1 | `enzyme` | 2LZT etc. | pdb |
| **Antibody, intact IgG** | 1IGT | immune recognition; one fold reused six times | 4 | new: `recognition` | no | pdb |

Insulin and GFP are the two cheapest additions available and neither duplicates anything. Insulin is 51 residues and carries a story a Bio 101 reader already half knows. GFP is one chain, one barrel, and a chromophore the protein builds out of its own backbone — which is a claim a ribbon can show.

The nucleosome is the highest-value entry in this tier and the only one with an engineering cost: it brings DNA, and nothing in `bake-lib.js` has met a nucleic-acid chain. See the DNA note under criteria.

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

The pairings are the argument. KcsA earns its place *because* napump is already registered — channel against pump, downhill against paid-for, on one bench — in a way it would not earn standing alone. Same for GroEL against prion: folding helped, next to folding gone wrong.

Myosin and kinesin are the second consumer of whatever the ATP synthase rotation became. Neither is worth adding until that machinery has settled and been named.

## Tier 3 — expensive, price before committing

| candidate | id | fills | scale | the cost |
| --- | --- | --- | --- | --- |
| **Complex I** | 5XTD? | the ETC lesson already queued | \~45 subunits | the stator-fit and label-travel traps, again |
| **DNA polymerase** | 1TAU | replication; the hand-shaped fold | 1 + DNA | DNA pipeline, and a two-state story to find |
| **Ribosome** | 4V6X? | translation | \~50 protein + rRNA | **mmCIF only — see below** |
| **Tubulin / actin** | 1JFF / 1ATN | cytoskeleton; a polymer that is not collagen | 2 / 1 | the subject is the filament, not the file |

Complex I is the one with a schedule behind it: fermentation and the ETC are queued, and Complex I is the ETC's largest single object. It will hit both traps `atp-synthase/tools/prep.js` already documents — fitting on a pseudo-symmetric region, and chain labels that travel with the moving part — so its baker should start from that file rather than from scratch.

## Ruled out, and why

Nothing yet. When a candidate is dropped it moves here with the reason, so it is not re-proposed six months later on the same merits.
