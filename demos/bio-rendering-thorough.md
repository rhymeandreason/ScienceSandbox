> **Superseded in part, 2026-08-02 — we draw proteins ourselves.**
> The 3D-viewer question is closed: Three.js + `scene.js` + `folding/ribbon.js`,
> no third-party molecular viewer, ChemDoodle dropped, Mol\* evaluated and not
> adopted. `demos/RenderingLibraries.md` is the decision record and overrides
> every viewer recommendation below; this file has been updated to match.
>
> **The boundary is scale, not subject: everything up to and including a folded
> protein is ours** — approaches A/B/C/D. The one genuinely open case is the
> megadalton assembly (the ribosome row), where the choice is between a baked
> mesh and reopening the viewer question. See *Where ours stops*, below.
>



## Legend

**3D approaches**
| | Approach | Ceiling |
|---|---|---|
| **A** | Per-atom, our `scene.js` | ~20k atoms |
| **B** | Instanced repeat — one subunit + a rule (`actin.js`) | any |
| **C** | Baked static mesh | any, no motion |
| **D** | Coarse-grained beads (~1/residue) | ~500k, keeps motion |
| **R** | Our ribbon — `folding/ribbon.js` over a Cα trace + SS | ~600 res. measured, no hard ceiling |
| ~~**V**~~ | ~~Viewer library~~ — **not adopted**, kept only to read the old rows | — |

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
| 1 | Protein structure levels | ✅ A | — | `protein-lab`, **rewrite pending** off ChemDoodle. `molstar/protein-inhouse.html` is the proof |
| 1 | Folding | ✅ A | — | `folding-lab`, done |
| **2** | **Phospholipid bilayer** | **B** | **H** | Highest payoff in the course. 2D = the textbook cross-section |
| 2 | Membrane transport proteins | **A + R** | **H** | Aquaporin 1J4N, Na⁺-K⁺ 2ZXE. Surfaces are the gap — we have no SES/SAS code |
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
| 4 | GPCR + ligand | **A + R** | **G** | Two states, morph between — `folding-lab`'s trick, and a viewer could not have done it |
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
| 6 | **Ribosome / translation** | **C**, or reopen | **H** | The 150k-atom case — **the one row the verdict does not settle**. See below |
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
| Deposited structures | **ours** — `scene.js` + `folding/ribbon.js` | ours | **The decision.** ~19 KB gzipped marginal, one canvas, no defaults to fight |
| ↳ ~~evaluated~~ | ~~Mol\*~~ | MIT | **Not adopted.** Best-in-class and still wrong here: second WebGL context, second camera |
| ↳ ~~evaluated~~ | ~~NGL~~ · ~~Miew~~ | MIT | Not adopted — same structural objection, less capability |
| ↳ ~~current~~ | ~~ChemDoodle~~ | **GPLv3** | **Dropped.** `protein-lab` rewrite pending; nothing unique survives |
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

**Two dependencies now cover almost everything** — down from three, because the 3D one was the one we dropped: SmilesDrawer or RDKit.js (2D skeletal) and Observable Plot (charts). All 3D stays hand-built in Three.js. That is the repo's thesis, and the viewer evaluation ended by confirming it rather than by finding an exception.

---

## Where ours stops

The verdict covers **everything up to and including a folded protein**, and the chart above now reflects that. Worth being precise about what is and isn't settled, because "we draw it ourselves" can quietly become a rule nobody re-examines.

**Settled, and for a structural reason.** Any lesson where the molecule *does* something — folds, morphs between states, gets raycast, shares a camera with another object, or has FX fired at it — must be ours, at any size. A viewer brings its own WebGL context and canvas and cannot draw into `scene.js`'s scene, so those interactions would land on the wrong side of it. This is why the GPCR two-state row is ours despite being a large membrane protein: the morph is the lesson.

**Genuinely open: the megadalton assembly.** The ribosome (~150k atoms) is the one row the decision does not reach. It is a static subject at a scale we have never rendered, and the honest options are a baked mesh (approach C, no motion, and someone has to author it offline) or reopening the viewer question for that page alone. Don't resolve it here — resolve it when the lesson is designed and the motion requirement is known.

**Known gaps in ours, so they aren't discovered late:**

- **No molecular surface.** We have no SES/SAS implementation. The membrane-transport row wants one — a channel's pore reads far better as a surface than as sticks — and every viewer ships this for free. This is the largest single capability we gave up.
- **No live per-frame secondary structure.** `RibbonLib.build` takes `ss` as an argument, so animating a fold through the ribbon means re-running DSSP and rebuilding geometry each frame. `RenderingLibraries.md` names this as the one finding that could overturn the verdict, with precomputation as the current answer.
- **Nothing above ~600 residues is measured.** The 2HHB timings are our ceiling evidence. Treat larger claims as untested.
