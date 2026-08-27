<!-- KIND: recipe — load when bringing a NEW protein into the repo from deposited coordinates, before any lesson exists for it. Ends at a bench the human can look at. `rendering-modules.md` is what to draw it with; this is how to decide what is worth drawing. -->

# Adding a protein

From "let's look at X" to a bench the human can click through. No lesson, no page copy, no roadmap. Three steps, and the report at the end of each is the deliverable, not the code.

**The rule the whole file serves: look before you decide, and measure before you render.** A protein arrives as an argument about what it will show, and the argument is usually wrong. This repo has paid for that twice, and both receipts are in here.

## 1. Pull the data and say what is actually in it

Pull the data and see if it’s complete.

\-Are there variants? do the variants tell a story? Are there quaternary structures? special features like heme groups? Are there ensemble views? Explain what you found to the human in non-technical words and include the links. If the data is incomplete, state simply “fragment: 104 out of 210 deposited” Flag if there are holes. Write in non-technical language using bullet points.

For framents, check Alphafold and state the confidence score. If Alphafold score is low, also check for molecular dynamics papers that might have accessible data.

## 2. Build the bench

One test page, every relevant structure as a ribbon, buttons to switch. Not a lesson. It exists so the human can look, and so the conversation about what the protein is for happens against something real. Make a folder for the protein in the proteins folder to hold the data and the test page.  `proteins/<name>/<name>-test.html`

Two worked examples: `proteins/prion/prion-test.html` is one sequence in two states, `proteins/rnase/rnase-test.html` is one state in seven situations. Copy whichever the protein resembles.

**The layout is `proteins/protein-test.css` .**  Load it after `sandbox.css` and before `kit/proteinbox.css`. What a page adds in its own `<style>` is only what it says with COLOUR — prion's rust `.disease` variant is the whole of its block, and rnase has no block at all. 

**Bake, do not parse the deposition at runtime.** A baker beside the page cuts each source down to what the bench draws and writes it to `data/`. Two of them: `proteins/prion/tools/prep.js` writes reduced PDBs the page still parses, and `proteins/rnase/tools/prep.js` writes `bake-trace.js`-shaped JSON the box takes directly — **prefer the second**, because the page that parses nothing cannot decide an altloc differently from the baker that already decided it.

**Reading the file is `proteins/bake-lib.js`, and a new baker does not re-implement it.** The altloc rule, secondary structure read rather than detected, ss indexed by residue number, `nums` beside `first`, the centring, the solved frame, SEQRES / SSBOND / HETATM — each carries the trap it exists to prevent, and three copies is where those start to drift. What a baker writes for itself is the VIEW table and whatever its protein is about. It composes its own output object from `assemble` and `frameOf` rather than handing off to a shared writer, because the bakes are committed artefacts and a shared writer reorders every one of them the day it changes its mind about a key. Along with the trace, that baker writes a `meta` block holding every figure the panel prints: the declared length off `SEQRES`, the disulfides off `SSBOND`, the ligands off `HETATM`, the model count. A number counted in the baker is re-counted on every re-bake; the same number typed into a panel is not. Chain A unless the assembly is the point, alt-locs blank or `A` only, and the file's own `HELIX` / `SHEET` records ride along. Secondary structure is **read, never detected**: for a lesson about folding, detecting it is inventing the claim.

**Do not draw the ribbon yourself. Mount a `kit/proteinbox.js`.** The scene, the camera, the framing, the drag and the WebGL context are the module's, which is what makes every protein in the repo behave the same way. `rendering-modules.md` has the options; the shape of it is:

```
const box = Proteinbox.create({ mount, orbit:true, sub:10,
                                stage:{ ortho:false, turn:'trackball' } });
box.setData(data, { colors });      // again per structure, same box
```

* **`sub:10` on a full-height stage.** The box asks for 6 samples per residue because a card is a thumbnail with a triangle budget. At full size that shows as faceting wherever the chain turns hard — the ends of arrows and the tight loops read chunky, which is the spline showing rather than the protein.
* **`turn:'trackball'`.** The default turntable clamps its pitch short of the poles, about a hundred pixels of upward drag, which runs out exactly when someone is trying to look at the top of the molecule.
* **The zoom clamp is the box's, and it follows the framing.** `scene.js`'s `rMin`/`rMax` default to a fixed 5-60 A, which is below the distance a big structure frames at: the inhibitor complex opens at 107, so the first wheel tick used to clamp it to 60 and no zoom out ever came back. `Proteinbox.fit()` now retunes the clamp to 0.2x-3x of whatever it just solved, so nothing is needed from the page. Worth knowing only because it is invisible until a reader scrolls.
* **One box, re-fed.** `setData` swaps the structure and keeps the camera, so a reader who turned the molecule still has that view after a switch. One box per structure costs a WebGL context each and snaps the framing back on every click.

**A ribbon is not always the whole subject.** Myoglobin is 153 residues wrapped around one iron, and a bench that drew only the backbone would draw the box and leave out what is in it. `proteins/myoglobin/` is the worked example: its baker writes a `pocket` beside the trace — the heme, whatever is bound to its iron, the one or two side chains that make the site — **centred by the same vector as the trace**, because a pocket centred on itself sits at the origin with the protein somewhere else, and that reads as a bug in the ribbon. The page draws it ball-and-stick into `box.group`, which is the structure's own frame: parent it to `box.root` instead and a ligand keeps the crystal's orientation while the protein turns. The box clears that group on every `setData`, so re-add after. Connectivity comes off the file's `CONECT` records, never a distance cutoff — a cutoff wide enough for the 2.0 Å Fe–N coordination also draws the porphyrin's diagonals.

**If the views are states of one thing, superpose them.** A deposition's orientation is its crystal's, so N files is N arbitrary frames: flipping between them turns the whole molecule, and a reader cannot tell a real change from the crystallographer's choice of origin. Fit every view onto ONE reference in the baker — `proteins/myoglobin/tools/prep.js` does it with the `kabsch` in `sickle/tools/bake-sickle.js` — and centre them all on the reference's centroid, or the re-centring slides back apart most of the fit that was just made.

* **Fit on what the bench is ABOUT**, which is not always the trace. Myoglobin's four states are a binding site, so the fit is on the heme, matched by atom name: that puts the iron in the same place in every view, and it works between structures whose residue numbering does not correspond at all — a whale's myoglobin against haemoglobin's β chain. A Cα fit could not have matched those two.
* **The panel says it was fitted, and how well.** A `view: deposited` row is a half-truth the moment anything is superposed. Name the reference and print the residual beside it.
* **A number that needs an alignment nobody has is null, not computed.** The backbone RMSD is meaningful across the whale and horse files, which number from the same alignment, and meaningless against a β chain, where residue 45 is not the same residue. The bench prints "numbering not comparable" there rather than a figure that would be read as a poor match instead of no match.

**What the page still owns is what a CHAIN is.** The box takes `{first, nums, CA, ss}` per chain — the shape `tools/bake-trace.js` writes — and never parses a deposition, because parsing decides which altloc, which chain, and whether secondary structure is read or detected. A page that owns a protein already owns those.

Three invariants on that side. Each is a bug that ships looking fine.

* **Parse chain-aware before anything multi-chain.** `PrionLib.parse` keys residues by number alone, which is right for one chain and silently wrong for ten: chain B's residue 180 overwrites chain A's, and a ten-rung stack parses as one rung wearing the last chain's coordinates.
* **Send `nums`, not just `first`.** They are what lets the box break the ribbon where the chain breaks. Omit them and a chain reads as contiguous, so an unmodelled loop is drawn as a smooth tube across 10 Å of nothing — indistinguishable from data at ribbon width. 7LNA is the case.
* **Say where the frame came from.** A deposited frame is the experiment's, not a decision about how the structure should be seen, so the box gets a `view` basis: `FoldLib.viewBasis` solves one from the shape, `FoldLib.basisFrom` puts a known axis upright where the field has a convention (a fibril vertical, a membrane protein on its normal), and a globular domain gets neither — its extents are too close to tell apart, its solved basis would flip between rebakes, and a human picks one instead. Whichever it was, the panel names it rather than leaving a rotation nobody can account for.

**Every number in the panel is counted off the parsed file**, not typed. Residues, segments, chains, record counts. A typed number is a claim nothing checks, and a re-bake falsifies it silently.

## 3. Say whether a surface is worth baking

Recommend SES only against a criterion, never a feeling:

**Bake it when the claim is about a surface.** A pocket, an interface, what fits into what, complementarity. `sickle/fibre-test` bakes one because the lesson is a contact between two tetramers.

**Skip it when the claim is about the fold.** A ribbon is strictly better there, because a surface buries the secondary structure that *is* the point. Prion is a fold claim, which is why the stack reads at all as a ribbon and would read as a lump of dough as a surface.

It is expensive and it is a bake, not a render: `rendering-modules.md` owns the how, including the rule that a surface's frame is read from the trace file rather than re-derived.

## 4. Downloads and files

**Raw downloads are a separate question.** A deposition can be much larger than anything the bench reads (1QLZ is 2.7 MB of 20 models; the bake is 169 KB). Bake small, commit the bake, and ask before committing the raw file. The baker's header carries the source URLs so a re-run is possible without it.

## 5. Summary

Write a short editorial style summary to capture the significance for a lesson. Example written for prion:

**PrP — the prion protein**

Most abundant in the brain. Misfolding causes a family of rare and fatal neurological diseases. Prion disease is also called transmissible spongiform encephalopathy, TSE, named for the sponge-like holes the brain ends up full of.

Creutzfeldt-Jakob disease (CJD) is the common one, and happens sporadically with no known cause.

Mad-cow (BSE) is the same disease. BSE was unusually good at crossing barriers, which is why it was a public health emergency.

The healthy form is a compact bundle, about 60% helix, tumbling alone in solution. The diseased form is the same sequence with the same disulfide bond and not one atom changed, flattened into a sheet one molecule thick and stacked against identical copies of itself every 4.9 ångströms. The stack is the reason it spreads: its exposed top face is shaped exactly like the molecule that should bind there, so any healthy PrP that drifts up gets pressed flat onto it and becomes the new top face. There is no gene here and no enzyme. Growing is copying, and breaking a fibril in half just gives you two of them.

Neurologist and biochemist Stanley Prusiner coined the word "prion” in 1982, for proteinaceous infectious particle. Most scientists at the time believed that only viruses, bacteria, fungi, or parasites could transmit disease using DNA or RNA. Prusiner got the Nobel for it in 1997, with fifteen years of being told he was wrong in between.

Data Notes:

PrP^C for cellular, the healthy helical form. That's 1QLZ and 1B10.

PrP^Sc for scrapie, the misfolded stacking form. That's 6LNI and 7LNA. The Sc is from sheep scrapie for historical reasons and gets used generically now, even for human disease, which trips people up.
