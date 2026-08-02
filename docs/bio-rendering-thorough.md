Two corrections to things I said earlier, since both are licence claims you'd be deciding on: **OpenChemLib is BSD-3-Clause, not MIT** (still permissive, still fine), and there are two viewers I should have raised — NGL and Miew — that sit between 3Dmol and Mol\* in weight.

## Legend

**3D approaches**
| | Approach | Ceiling |
|---|---|---|
| **A** | Per-atom, our `scene.js` | ~20k atoms |
| **B** | Instanced repeat — one subunit + a rule (`actin.js`) | any |
| **C** | Baked static mesh | any, no motion |
| **D** | Coarse-grained beads (~1/residue) | ~500k, keeps motion |
| **V** | Viewer library (Mol\*/NGL) — deposited structure, we don't author | ~10⁶ |

**2D approaches**
| | Approach |
|---|---|
| **S** | SMILES → skeletal, generated (SmilesDrawer / RDKit.js) |
| **H** | Hand-rolled SVG — `haworth.js`'s pattern |
| **G** | Generic diagram/chart code (D3, Observable Plot) |
| **I** | Licensed illustration, not code (Goodsell / PDB101, CC-BY) |
| **—** | Not needed |

---

## The curriculum

| Unit | Lesson | 3D | 2D | Notes |
|---|---|---|---|---|
| 1 | Water, H-bonding | ✅ A | — | `water-lab`, done |
| 1 | Functional groups | ✅ A | **S** | 2D is how they're *tested*. `macromolecule-lab` callouts |
| 1 | Four macromolecule classes | ✅ A | **S** | done in 3D; 2D missing |
| 1 | Isomers / stereochemistry | ✅ A | **S ‼** | `contrast-lab`. Wedge/dash fidelity is non-negotiable |
| 1 | Dehydration / hydrolysis | ✅ A | **H** | `aminoacid-lab`. 2D reaction arrows |
| 1 | Protein structure levels | ✅ V | — | `protein-lab`. See Mol\* item |
| 1 | Folding | ✅ A | — | `folding-lab`, done |
| **2** | **Phospholipid bilayer** | **B** | **H** | Highest payoff in the course. 2D = the textbook cross-section |
| 2 | Membrane transport proteins | **A / V** | **H** | Aquaporin 1J4N, Na⁺-K⁺ 2ZXE. Surfaces needed |
| 2 | Passive / active transport | **B** | **G** | Motion + a concentration graph |
| 2 | Surface-area : volume | **E→ geometry** | **G** | Pure math. Chart, not structure |
| 2 | Organelles / whole cell | **C** | **I** | Where Goodsell earns his place — see below |
| **2** | **Cell-size ladder** | **B + C** | — | `folding-lab` act 3, extended two rungs |
| 3 | Glycolysis | ✅ A | **S + G** | `glycolysis-lab` done in 3D. 2D pathway map missing |
| 3 | Krebs cycle | A | **G ‼** | Honestly *mostly* a 2D lesson. Don't force 3D |
| 3 | ETC complexes | **A + B** | **H** | Drops into the membrane |
| **3** | **ATP synthase** | **D** | **H** | Best motion story in biology. Forces coarse-graining |
| 3 | Cristae / mitochondrion | **C** | **I** | Organelle-scale container |
| 3 | Photosystems / thylakoid | **A + B** | **H** | Same membrane machinery reused |
| 4 | GPCR + ligand | **A / V** | **G** | Two states, morph between — `folding-lab`'s trick |
| 4 | Signal cascade | — | **G ‼** | Amplification is a *number*. Pure diagram |
| 4 | Cell cycle / checkpoints | — | **G** | Diagram |
| 4 | Mitosis / spindle | **B** | **H** | Tubulin + helical rule. `actin.js` transfers |
| 5 | Meiosis / crossing over | **B** light | **H ‼** | 2D is the right medium here |
| 5 | Punnett, linkage, pedigrees | — | **G** | Interactive, not structural |
| 5 | Chromosome condensation | **B + C** | **H** | Nucleosome repeated, then baked |
| **6** | **DNA double helix** | **A** | **S/H** | Overdue. Grooves never shown properly |
| 6 | **Nucleosome** (1KX5) | **A**, borderline | — | Packaging → regulation |
| 6 | Replication fork | **B** | **H ‼** | Leading/lagging reads far better in 2D |
| 6 | Transcription / RNA pol | **A + C** | **H** | |
| 6 | **Ribosome / translation** | **V or C** | **H** | The 150k-atom case. Forces the C/V decision |
| 6 | Codon table, mutations | — | **G** | |
| 6 | Operons (lac/trp) | — | **G** | |
| 7 | Hardy–Weinberg, selection | — | **G** | Simulation + charts |
| 7 | Phylogenetics | — | **G** | Tree layout |
| 8 | Population / ecosystem models | — | **G** | Charts |

**‼** = the 2D view is the *primary* teaching medium, not a supplement.

---

## Library recommendations

| Need | Recommendation | Licence | Why |
|---|---|---|---|
| Our own 3D (A/B/C/D) | **Three.js** — keep | MIT | Already the spine. Nothing displaces it |
| Deposited structures (V) | **Mol\*** | MIT | Best representations, biggest ceiling, closes the GPL door |
| ↳ lighter alternative | **NGL Viewer** | MIT | Mol\*'s predecessor, ~⅓ the size, simpler API. Real option if Mol\* feels heavy |
| ↳ lighter still | **Miew** (EPAM) | MIT | Smallest of the three. Fewer modes |
| ↳ current | ~~ChemDoodle~~ | **GPLv3** | Replace. Nothing unique survives (2D included — see below) |
| 2D skeletal (S) | **SmilesDrawer** | MIT | Tiny, one job. Prototype first |
| ↳ if fidelity fails | **RDKit.js** | BSD-3 | Gold-standard depiction incl. stereo — but ~7 MB WASM |
| ↳ full suite | Kekule.js | MIT | 2D+3D+sketcher in one. Heavier, less maintained |
| Sketcher (student draws) | **Ketcher** (EPAM) | Apache-2.0 | Best open sketcher. Better than ChemDoodle's |
| ↳ lighter | OpenChemLib JS | BSD-3 | Sketcher + tools, smaller |
| Charts / diagrams (G) | **Observable Plot** | ISC | Grammar-of-graphics, ~10 lines per chart |
| ↳ when you need control | D3 | ISC | Phylogenies, pathway layouts, anything custom |
| Metabolic pathway maps | Escher | permissive¹ | Purpose-built for glycolysis/Krebs maps |
| Cell-scale imagery (I) | **PDB101 / David Goodsell** | CC-BY² | See below |
| Mesoscale cell models | CellPAINT / Mesoscope | check¹ | Scripps. Builds Goodsell-style scenes from real structures |
| Mesh baking | VMD | non-commercial | Offline only. Deferred |

¹ verify before relying on it — I'm not certain of the exact terms
² per-image; most RCSB/PDB101 material is CC-BY-4.0, but check each

---

## The thing I should have raised earlier

**David Goodsell's cellular landscapes**, via [PDB101](https://pdb101.rcsb.org/). Not a library — illustrations, mostly CC-BY, showing cell interiors at true molecular density with every molecule drawn from real structures.

This matters because your "larger cell structures" question has a trap in it: at whole-cell scale, the honest picture isn't a clean diagram with labeled organelles floating in white space — it's *crowded*, wall-to-wall protein. That crowding is a real biological fact students never learn, and it's the single best corrective to the textbook cell diagram. Goodsell is the person who made that visible, and the work is licensed to reuse.

**CellPAINT** (same lineage, Scripps) is the interactive version — it builds those scenes in-browser from actual PDB structures. Worth a look for the Unit 2 whole-cell lesson specifically; closer to your paradigm than any viewer library.

Also worth naming so you can stop wondering about it: **BioRender** is the standard tool for exactly the 2D cell diagrams in the ‼ rows — and it's proprietary, subscription, and not embeddable. It's not an option here. Those diagrams get hand-rolled SVG.

---

## What the chart actually says

**Roughly a third of the remaining curriculum isn't structural at all.** Units 7–8 and much of 4–5 want charts and simulations. That's a whole second kind of page this repo doesn't have yet — and it needs one small dependency (Observable Plot) rather than any chemistry library.

**Several strong lessons are 2D-primary, not 3D-supplemented.** Replication fork, meiosis, signal cascades, Krebs. Forcing 3D onto them would make them worse. That's the real finding here: 2D isn't a gap to backfill on existing pages, it's the correct medium for a set of lessons you haven't built.

**ChemDoodle's last argument is gone.** I'd raised 2D and the sketcher as its unique contributions; Ketcher (Apache-2.0) and SmilesDrawer/RDKit.js (MIT/BSD) cover both, better. Nothing justifies GPLv3.

**Three dependencies would cover almost everything:** Mol\* (deposited 3D), SmilesDrawer or RDKit.js (2D skeletal), Observable Plot (charts). Everything else stays hand-built in Three.js and SVG — which is the repo's thesis, and the chart supports it.
