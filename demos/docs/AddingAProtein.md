<!-- KIND: recipe — load when bringing a NEW protein into the repo from deposited coordinates, before any lesson exists for it. Ends at a bench the human can look at. `rendering-modules.md` is what to draw it with; this is how to decide what is worth drawing. -->

# Adding a protein

From "let's look at X" to a bench the human can click through. No lesson, no page copy, no roadmap. Three steps, and the report at the end of each is the deliverable, not the code.

**The rule the whole file serves: look before you decide, and measure before you render.** A protein arrives as an argument about what it will show, and the argument is usually wrong. This repo has paid for that twice, and both receipts are in here.

## 1. Pull the data and say what is actually in it

Pull the data and see if it’s complete

\-Are there variants? do the variants tell a story? Are there quaternary structures? special features like heme groups? Are there ensemble views? Explain what you found to the human in non-technical words and include the links. If the data is incomplete, state simply “fragment: 104 out of 210 deposited” Flag if there are holes.

For framents, check Alphafold and state the confidence score. If Alphafond score is low, also check for molecular dynamics papers that might have accessible data. Write in non-technical language using bullet points.

## 2. Build the bench

One test page, every relevant structure as a ribbon, buttons to switch. Not a lesson. It exists so the human can look, and so the conversation about what the protein is for happens against something real. Make a folder for the protein in the proteins folder to hold the data and the test page.  `proteins/<name>/<name>-test.html`

See proteins/prion/prion-test.html as the example and copy its layout.

**Bake, do not parse the deposition at runtime.** A baker beside the page (`proteins/prion/tools/prep.js` is the worked example) cuts each source down to what the bench draws and writes it to `data/`. Chain A unless the assembly is the point, alt-locs blank or `A` only, and the file's own `HELIX` / `SHEET` records ride along. Secondary structure is **read, never detected**: for a lesson about folding, detecting it is inventing the claim.

Four invariants. Each one is a bug that ships looking fine.

* **One ribbon per continuous run.** Split the residues wherever numbering skips, and give each run its own mesh. Handing a spline a list with a hole in it draws a smooth tube across 10 Å of nothing, and at ribbon width that is indistinguishable from data.
* **Parse chain-aware before anything multi-chain.** `PrionLib.parse` keys residues by number alone, which is right for one chain and silently wrong for ten: chain B's residue 180 overwrites chain A's, and a ten-rung stack parses as one rung wearing the last chain's coordinates.
* **One camera, solved once, over everything being compared.** Re-framing per structure rescales them against each other and hides exactly the size difference a comparison is for. `Stage.frame` wants half-extents about a centre, not a `Box3`; passing a `Box3` gives NaN and renders nothing while every number in the panel stays right.

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

Most abundant in the brain.  The healthy form is a compact bundle, about 60% helix, tumbling alone in solution. The diseased form is the same sequence with the same disulfide bond and not one atom changed, flattened into a sheet one molecule thick and stacked against identical copies of itself every 4.9 ångströms. Nothing about it is helix any more. The stack is the reason it spreads: its exposed top face is shaped exactly like the molecule that should bind there, so any healthy PrP that drifts up gets pressed flat onto it and becomes the new top face. There is no gene here and no enzyme. Growing is copying, and breaking a fibril in half just gives you two of them.

The misfolding causes a family of rare and fatal neurological diseases. Prion disease is also called transmissible spongiform encephalopathy, TSE, named for the sponge-like holes the brain ends up full of.

Creutzfeldt-Jakob disease (CJD) is the common one, and happens sporadically with no known cause.

Mad-cow (BSE) is the same disease. BSE was unusually good at crossing barriers, which is why it was a public health emergency.

Neurologist and biochemist Stanley Prusiner coined the word "prion” in 1982, for proteinaceous infectious particle. Most scientists at the time believed that only viruses, bacteria, fungi, or parasites could transmit disease using DNA or RNA. Prusiner got the Nobel for it in 1997, with fifteen years of being told he was wrong in between.

Data Notes:

PrP^C for cellular, the healthy helical form. That's 1QLZ and 1B10.

PrP^Sc for scrapie, the misfolded stacking form. That's 6LNI and 7LNA. The Sc is from sheep scrapie for historical reasons and gets used generically now, even for human disease, which trips people up.
