<!-- KIND: recipe — load when bringing a NEW protein into the repo from deposited coordinates, before any lesson exists for it. Ends at a reviewed protein in proteins/proteins.js, not at a bench. `rendering-modules.md` is what to draw it with; this is how to decide what is worth drawing. -->

# Adding a protein

From "let's look at X" to a bench the human can click through, and from there to a protein the repo holds. No lesson, no page copy, no roadmap. The report at the end of each step is the deliverable, not the code.

**Say what the protein IS before pulling a byte of it.** Step 1 is a summary written from what you already know, printed into the chat, and it is the brief for the search that follows — every claim in it is a structure to go looking for. Pull first and you get whatever a keyword search returned, then write a caption for it.

**The bench comes before the database.** `proteins/proteins.js` is what we have SELECTED, and selecting is a human looking at structures on a bench and saying which ones earn a place. So a new protein is not registered when it is pulled; it is registered in step 5, after step 4 has thrown some of it away. The prion bench carried a Syrian hamster pair through review and lost it there, which is the shape of a normal pass, not a failure of one.

**The rule the whole file serves: look before you decide, and measure before you render.** A protein arrives as an argument about what it will show, and the argument is usually wrong. This repo has paid for that twice, and both receipts are in here.

## 1. Summary — write this FIRST, and print it into the chat

Write a short editorial style summary capturing what the protein IS and why a lesson would want it. Before pulling anything.

**IT IS THE BRIEF FOR STEP 2, which is why it comes first.** A summary written after the data is a caption for whatever happened to be deposited; written before, it is a list of claims, and each claim is a structure to go looking for. Collagen's went "Gly-X-Y, every third residue glycine · hydroxyproline and vitamin C · one wrong glycine gives brittle bone · staggered into fibrils", and that is exactly the shelf that came back: a bare helix, a hydroxylated twin, a Gly→Ala peptide, one whole molecule. Nothing on that bench was found by browsing.

It is written from what you already know, so **it will contain things the data then corrects** — that is the point of the order, not a flaw in it. Collagen's first draft said the imino-poor stretch splays the helix; measuring said that was a frayed chain terminus. Fix the summary when the data says so, and say what changed.

**PRINT IT INTO THE CHAT.** The human reads it here, before any bytes are pulled, because this is the cheapest moment to say "that is not the lesson I want".

**IT ALSO GOES ON THE BENCH, in a `summary` tab beside the panel's own notes.** Not in a reply, not in a doc, and not in `proteins/proteins.js`: a reply is gone by the next session, and the registry says what a structure IS, never what it MEANS. `proteins/collagen/collagen-test.html` is the worked example — a two-button tab strip under the provenance line, `what the files say` holding the notes that were already there and `summary` holding this. Set as section labels rather than `button.mode`, because a tab changes what you READ and `button.mode` is the thing that changes what is DRAWN, and a bench that blurred those would have six buttons where three of them do nothing to the stage.

It is PAGE COPY, so it lives in the page's markup with `SAYS`, and it is the only prose on a bench not keyed to one variant: the per-structure claims say what each file shows, and this says what the protein is for. **Open with a lead paragraph** — two or three sentences that would survive alone — then the rest as notes. The lead is what a reader takes away from a bench they clicked through once, and it is what gets compressed into the registry's `blurb` at step 5. The tab goes in once the bench exists at step 3; the words are written now.

Some of what a summary says has nowhere else to go, and that is the second reason to write one: collagen's vitamin C and its dominant-not-recessive inheritance are in none of its seven files, and no panel row could ever print them.

Example written for prion:

**PrP — the prion protein**

Most abundant in the brain. Misfolding causes a family of rare and fatal neurological diseases. Prion disease is also called transmissible spongiform encephalopathy, TSE, named for the sponge-like holes the brain ends up full of.

Creutzfeldt-Jakob disease (CJD) is the common one, and happens sporadically with no known cause.

Mad-cow (BSE) is the same disease. BSE was unusually good at crossing barriers, which is why it was a public health emergency.

The healthy form is a compact bundle, about 60% helix, tumbling alone in solution. The diseased form is the same sequence with the same disulfide bond and not one atom changed, flattened into a sheet one molecule thick and stacked against identical copies of itself. The stack is the reason it spreads: its exposed top face is shaped exactly like the molecule that should bind there, so any healthy PrP that drifts up gets pressed flat onto it and becomes the new top face. There is no gene here and no enzyme. Growing is copying, and breaking a fibril in half just gives you two of them.

Neurologist and biochemist Stanley Prusiner coined the word "prion” in 1982, for proteinaceous infectious particle. Most scientists at the time believed that only viruses, bacteria, fungi, or parasites could transmit disease using DNA or RNA. Prusiner got the Nobel for it in 1997, with fifteen years of being told he was wrong in between.

## 2. Pull the data and say what is actually in it

**Go looking for the claims step 1 made**, one search per claim, rather than pulling what a keyword search returns first. Then say what actually came back — including which claims have no structure behind them, because that gap is a finding and it decides what the lesson can show. Collagen's stability claim is the case: the summary said hydroxyproline is what holds the helix together at body temperature, and the evidence for it turned out to be two melting temperatures and no structure at all, since both crystals are folded.

Pull the data and see if it’s complete.

\-Are there variants? do the variants tell a story? Are there quaternary structures? special features like heme groups? Are there ensemble views? Explain what you found to the human in non-technical words and include the links. If the data is incomplete, state simply “fragment: 104 out of 210 deposited” Flag if there are holes. Write in non-technical language using bullet points.

For framents, check Alphafold and state the confidence score. If Alphafold score is low, also check for molecular dynamics papers that might have accessible data and inform the human in the chat, don’t proceed to step 3.

## 3. Build the bench

One test page, every relevant structure as a ribbon, buttons to switch. Not a lesson. It exists so the human can look, and so the conversation about what the protein is for happens against something real. Make a folder for the protein in the proteins folder to hold the data and the test page.  `proteins/<name>/<name>-test.html`

Three worked examples, and they are different SHAPES of bench rather than three of the same thing. Copy whichever the protein resembles:

* **`proteins/prion/prion-test.html` — one sequence in two states.** The pair IS the lesson, so the page says it with colour and almost nothing else.
* **`proteins/rnase/rnase-test.html` — one molecule in seven situations.** Every entry is the same 124 residues doing something different, so the panel is about what changed.
* **`proteins/collagen/collagen-test.html` — seven structures that are mostly NOT the same molecule.** Three designed peptides, a natural fragment of a different collagen gene, two complexes and one whole molecule. That is the hard case, because a reader will assume seven collagen structures are seven pieces of one thing, and six of them are pieces of nothing. What that bench had to grow to be honest is below.

**The layout is `proteins/protein-test.css` .**  Load it after `sandbox.css` and before `kit/proteinbox.css`. What a page adds in its own `<style>` is only what it says with COLOUR — prion's rust `.disease` variant is the whole of its block, and rnase has no block at all.

**Bake, do not parse the deposition at runtime.** A baker beside the page cuts each source down to what the bench draws and writes it to `data/` as `bake-trace.js`-shaped JSON the box takes directly. All three do it; prion did not until the animation it kept whole residues for was dropped, and while it parsed at load its bench and its gallery card drew the same file facing two different ways. A page that parses nothing cannot decide an altloc — or a frame — differently from the baker that already decided it.

**While the protein is under review its candidates live in the baker**, as a `CANDIDATES` table at the top of `proteins/<name>/tools/prep.js`: id, chains, and one line saying what each is meant to show. Nothing goes into `proteins/proteins.js` yet, because everything in that file is a decision and none has been made. Bake generously here — a candidate that turns out to say nothing is what step 4 is for, and it is cheaper to look at one than to argue about it.

**Reading the file is `proteins/bake-lib.js`, and a new baker does not re-implement it.** The altloc rule, secondary structure read rather than detected, ss indexed by residue number, `nums` beside `first`, the centring, the solved frame, SEQRES / SSBOND / HETATM — each carries the trap it exists to prevent, and three copies is where those start to drift. What a baker writes for itself is the VIEW table and whatever its protein is about. It composes its own output object from `assemble` and `frameOf` rather than handing off to a shared writer, because the bakes are committed artefacts and a shared writer reorders every one of them the day it changes its mind about a key. Along with the trace, that baker writes a `meta` block holding every figure the panel prints: the declared length off `SEQRES`, the disulfides off `SSBOND`, the ligands off `HETATM`, the model count. A number counted in the baker is re-counted on every re-bake; the same number typed into a panel is not. Chain A unless the assembly is the point, alt-locs blank or `A` only, and the file's own `HELIX` / `SHEET` records ride along. Secondary structure is **read, never detected**: for a lesson about folding, detecting it is inventing the claim.

**Do not draw the ribbon yourself. Mount a `kit/proteinbox.js`.** The scene, the camera, the framing, the drag and the WebGL context are the module's, which is what makes every protein in the repo behave the same way. `rendering-modules.md` has the options; the shape of it is:

```
const box = Proteinbox.create({ mount, orbit:true, sub:10,
                                stage:{ ortho:false, turn:'trackball' } });
box.setData(data, { colors });      // again per structure, same box
```

* **`sub:10` on a full-height stage.** The box asks for 6 samples per residue because a card is a thumbnail with a triangle budget. At full size that shows as faceting wherever the chain turns hard — the ends of arrows and the tight loops read chunky, which is the spline showing rather than the protein.
* **`turn:'trackball'`.** The default turntable clamps its pitch short of the poles, about a hundred pixels of upward drag, which runs out exactly when someone is trying to look at the top of the molecule.
* **The zoom clamp is the box's, and it follows the framing.** `scene.js`'s `rMin`/`rMax` default to a fixed 5-60 A, which is below the distance a big structure frames at: the inhibitor complex opens at 107, so the first wheel tick used to clamp it to 60 and no zoom out ever came back. `Proteinbox.fit()` now retunes the clamp to 0.2x-3x of whatever it just solved, so nothing is needed from the page. Worth knowing only because it is invisible until a reader scrolls. Two more house numbers sit above it and moved for the same reason: `Stage.frame`'s own 6-220 A solve limit, and the camera's 1000 A far plane. One collagen molecule is 3016 A long and frames at \~2500, so clamped it opened showing a tenth of itself and unclamped it stood correctly behind the far plane and drew nothing. `fit()` lifts both off the radius it measured, and it frames per AXIS rather than on a circumscribing sphere — a 60:1 rod framed as a sphere is a hairline in the middle of an empty stage.
* **One box, re-fed.** `setData` swaps the structure and keeps the camera, so a reader who turned the molecule still has that view after a switch. One box per structure costs a WebGL context each and snaps the framing back on every click.

**A ribbon is not always the whole subject.** Myoglobin is 153 residues wrapped around one iron, and a bench that drew only the backbone would draw the box and leave out what is in it. `proteins/myoglobin/` is the worked example: its baker writes a `pocket` beside the trace — the heme, whatever is bound to its iron, the one or two side chains that make the site — **centred by the same vector as the trace**, because a pocket centred on itself sits at the origin with the protein somewhere else, and that reads as a bug in the ribbon. The page hands it to `box.setPocket({atoms, bonds})` and the box draws it: the ball-and-stick proportions, the split sticks and the iron's rust are the module's, so this heme and hemoglobin-lab's cannot become two opinions about the same group. It draws in the structure's own frame, does not widen the framing radius, and clears with the ribbon on every `setData`. **What is IN the pocket stays the baker's** — which residues, which ligand names count, whether a cross-residue bond is kept — the same refusal the box makes about parsing. Connectivity comes off the file's `CONECT` records, never a distance cutoff — a cutoff wide enough for the 2.0 Å Fe–N coordination also draws the porphyrin's diagonals.

**If the views are states of one thing, superpose them.** A deposition's orientation is its crystal's, so N files is N arbitrary frames: flipping between them turns the whole molecule, and a reader cannot tell a real change from the crystallographer's choice of origin. Fit every view onto ONE reference in the baker — `proteins/myoglobin/tools/prep.js` does it with the `kabsch` in `sickle/tools/bake-sickle.js` — and centre them all on the reference's centroid, or the re-centring slides back apart most of the fit that was just made.

* **Fit on what the bench is ABOUT**, which is not always the trace. Myoglobin's four states are a binding site, so the fit is on the heme, matched by atom name: that puts the iron in the same place in every view, and it works between structures whose residue numbering does not correspond at all — a whale's myoglobin against haemoglobin's β chain. A Cα fit could not have matched those two.
* **The panel says it was fitted, and how well.** A `view: deposited` row is a half-truth the moment anything is superposed. Name the reference and print the residual beside it.
* **A number that needs an alignment nobody has is null, not computed.** The backbone RMSD is meaningful across the whale and horse files, which number from the same alignment, and meaningless against a β chain, where residue 45 is not the same residue. The bench prints "numbering not comparable" there rather than a figure that would be read as a poor match instead of no match.

**The box will not read a PDB, and that refusal is the design.** It takes chains already decided — `{first, nums, CA, ss}`, the shape `proteins/bake-lib.js` writes — and draws them. Opening a deposition would force three judgement calls that change what the picture CLAIMS rather than how it looks: which altloc (a residue modelled twice contributes once, or the ribbon splines through both), which chains (a monomer, one subunit of an assembly, or the whole thing), and whether secondary structure is read or detected. A shared module has no business making those for every protein in the repo.

**So the protein owns them, in its baker.** `proteins/bake-lib.js` applies the altloc rule and reads `HELIX`/`SHEET`; the `proteins/<name>/tools/prep.js` beside the bench picks the chains and says what the view is. A bench then `fetch`es a bake and hands it over. The invariants below are what the baker has to get right; the first one is prion's scar, from when that parse ran on the page.

Three invariants, wherever the chains get built. Each is a bug that ships looking fine.

* **Parse chain-aware before anything multi-chain.** `PrionLib.parse` keys residues by number alone, which is right for one chain and silently wrong for ten: chain B's residue 180 overwrites chain A's, and a ten-rung stack parses as one rung wearing the last chain's coordinates.
* **Send `nums`, not just `first`.** They are what lets the box break the ribbon where the chain breaks. Omit them and a chain reads as contiguous, so an unmodelled loop is drawn as a smooth tube across 10 Å of nothing — indistinguishable from data at ribbon width. 1RNU is the case: subtilisin cuts RNase A at 20-21 and residues 16-23 go unmodelled, so the gap drawn is wider than the cut.
* **Say where the frame came from.** A deposited frame is the experiment's, not a decision about how the structure should be seen, so the box gets a `view` basis: `FoldLib.viewBasis` solves one from the shape, `FoldLib.basisFrom` puts a known axis upright where the field has a convention (a fibril vertical, a membrane protein on its normal), and a globular domain gets neither — its extents are too close to tell apart, its solved basis would flip between rebakes, and a human picks one instead. Whichever it was, the panel names it rather than leaving a rotation nobody can account for: `custom view`, `computed`, `deposited`, and those three words are `Bake.viewFor`'s, not a baker's.

**A HUMAN'S ROTATION HAS EXACTLY ONE PATH, and every step of it is checked.** Turn the molecule on the bench, press *copy this view*, paste into that protein's `view: {by:'human', basis}` in `proteins/proteins.js`, re-run the baker. The baker calls `Bake.viewFor(ME, fallback)`, which returns the registry's basis where one is chosen and the solved one otherwise; `proteins/check-proteins.js` then fails any bake not wearing what the registry declares. **Do not write a basis anywhere else.** Both other places it has been written were silent when wrong: a baker that solved its own would undo the choice on the next re-bake, and a page-side table applied after the fetch turned the bench while the gallery card reading the same file stayed where it was. There were three such tables and they are gone.

**The copy button is `box.pickView()` and a page must not compute one itself.** What is on screen is `camera⁻¹ · view`, so a button that reads only the camera is right until the structure has a view and wrong forever after — which is the moment someone is using it. It needs the chain group's rotation, which only the box can see.

**Every number in the panel is counted off the file**, not typed. Residues, segments, chains, record counts. A typed number is a claim nothing checks, and a re-bake falsifies it silently.

### What the collagen bench had to add, and when yours will need the same

Each of these started as a bug that rendered beautifully. They are in `proteins/collagen/` if you need to read one.

* **A modified residue is a HETATM, so an ATOM-only trace drops it.** Hydroxyproline is every third residue of collagen and an ATOM-only read of 1CAG keeps 19 of 29, splining the ribbon over the holes — indistinguishable from a disordered protein. `Bake.modResidues` reads the file's own MODRES set; pass it to `caTrace` so they count as chain, and to `ligands` so they stop being reported as cargo. Opt-in, because it changes what a trace CONTAINS and every bake is a committed artefact.
* **Colour by chain where the ss palette says nothing.** No collagen file carries a HELIX or SHEET record — polyproline II is neither — so the repo default draws a triple helix as one green rope and the braid, the entire subject, disappears. `colors:{byChain:{…}}` is for that, and the page's legend reads the same table the ribbon does. Ask what a reader has to TELL APART on this bench; if the answer is not "what it is folded into", the default palette is wrong for it.
* **The framing clamps are a molecule stage's numbers.** `Stage.frame` solves within 6–220 Å and the camera stops at 1000; one collagen molecule is 3016 Å, frames at \~2500, and opened showing a tenth of itself and then nothing at all. `Proteinbox.fit` now lifts both off the radius it measured and frames per AXIS — a 60:1 rod framed on its circumscribing sphere is a hairline in the middle of an empty stage.
* **A complex's frame is solved on the SUBJECT, not on everything drawn.** 1DZI's longest axis is the integrin's, so a frame over all four chains lays that across the screen and stands the collagen at an angle while the view row still claims "helix axis across". The candidate names its own `helix` chains; the roll about that axis is then chosen from everything drawn, so a partner ends up beside the subject rather than behind it.
* **A pocket is what a view is ABOUT up close, and one view gets one.** The metal for the grip, the hydroxyls for the peptides — and 1DZI has 18 hydroxyprolines it deliberately does not draw, because on that view they are not the point. Two pockets is two subjects.
* **The empty pocket is a measurement.** `(Pro-Pro-Gly)₁₀` ASKS for hydroxyls and has none, and its row says so; a baker that was never asked would look identical and mean nothing. Where an absence is half of a comparison, bake the absence.
* **Say where a fragment sits on the whole molecule — by matching, never by typing.** Six of collagen's seven entries are designed peptides whose 1–30 numbering is construct-local. The baker sequence-matches each against the one entry that is a whole molecule and reports a position or `null`. **Two traps, both of which produced confident wrong answers first:** uniqueness is not enough, because a repeat protein has long runs that happen to occur once (a (Gly-Pro-Hyp)₉ peptide "located" itself in the C-terminal repeat); and LONGEST loses to coincidence (matching 1DZI by length picked a 9-residue run in an unrelated site over the 6 of `GFOGER`, putting the integrin's grip 440 residues from where it is). Score by INFORMATIVE residues instead — the ones outside the repeat's own alphabet — and require at least two.
* **A field's numbering convention is not the file's.** Collagen positions are quoted from the start of the triple-helical domain; 3HR2 numbers from its telopeptide and runs 16 ahead of every number in a paper. Find the offset (look for where Gly-X-Y actually starts), print both numbers, and check the result against something known — `GFOGER` comes out at 502, which is where the literature puts it.

## 4. Review, and select

**Hand the bench over and stop.** The human clicks through, and the output of this step is a decision about each candidate: kept, or not. That decision is not one an agent can make from the data, because it is a question about what a lesson will be about — the hamster prion pair was structurally fine and was dropped because two species is a comparison no lesson had asked for.

What to put in front of them, per candidate: what it shows that the others do not, and what it costs (bytes, and a button on a bench that is already long). Where two candidates say the same thing, say so — that is the pair most likely to be cut.

## 5. Register what survived

**Now the protein goes into `proteins/proteins.js`**, selected set only — which is also what puts it on the gallery at `proteins/index.html`, since that page is nothing but the registry drawn. Move the `CANDIDATES` table out of the baker and into the registry's `variants`, and switch the baker to reading it — a few lines, and the diff is the record of what review decided. From here the registry is the single source for what a structure IS: which entries, which chains, which species, what each variant is for, and which one is the default. **Not what a bench SAYS about it** — that is page copy, written to be read under one particular stage, and it lives on the page in its `SAYS` table.

The baker writes the `read` block back on every run — method, chains in the file, residues modelled, residues declared, and the file it wrote. **A human never types a number into that file**, and **every one of those five is answerable by the bake itself**: they are convenience lines printed into an index so the collection can be listed and compared without opening seventeen files, never a fact the bake cannot produce. Everything else about one structure — resolution, ligands, extents, a fit residual — stays in that structure's own bake and a bench reads it from there. It is why a cut-down file has to keep saying what it is — `EXPDTA`, `REMARK 2`, the `COMPND` chain list — rather than leaving the index to remember for it. `node proteins/<name>/tools/prep.js` writes them, `proteins/tools/registry-io.js` splices only that block so the prose and the comments survive, and `proteins/check-proteins.js` fails a commit where the two disagree. `Modules.md` has the field list.

* **`purpose` is the field that makes the collection worth having.** One short phrase saying what this variant is FOR — "misfolded disease variant", "cut in two and still working".
* **One variant carries `default: true`, and it is required.** It is what the bench opens on and what a card shows, so it is a decision rather than a position — `defaultOf` reads the mark and never falls back to the first entry, because then re-ordering the list would silently re-aim every bench. It is not automatically the superposition reference: myoglobin opens on Kendrew's 1MBN and superposes onto deoxy 1BZP, and the registry says why.
* **A protein whose files another pipeline writes gets `pipeline:'own'`.** Haemoglobin is the case: `hemoglobin/tools/` bakes a trace, a quaternary file, a surface and an 830 KB fold for the folding lesson, and nothing here should reach into that. Its `read` block is written by `proteins/tools/read-own.js` from the DEPOSITION each variant names in `source.path`, `bake:` names that folder's files BY ROLE — trace, quaternary, surface, card, fold — so what exists is legible and the checker can fail a name that has been renamed out from under it, `page:` names its bench where the derived path would miss it, and `lesson:` is the optional second link for a protein that has already become one. The checker verifies the same four fields against the same deposition and leaves that folder's files alone.
* **`does` says what the protein is FOR**, in one word from a vocabulary — `enzyme`, `oxygen carrier`, `unknown` — because it is the first question a reader has and the one a ribbon cannot answer. An enzyme's `read.ec` comes off each entry's own `COMPND` record, so a production page — which loads bakes and never a PDB — can say which reaction without anybody typing it. The validator fails an `enzyme` with no EC anywhere, a non-enzyme carrying one, and variants that disagree about it: two numbers under one key means a variant is filed under the wrong protein. Free text would split the collection in two on a filter the day someone wrote "an enzyme". **`unknown` is an answer**: PrP's healthy function has been argued for forty years, and a registry that guessed would be teaching one side of it.
* **A trap gets a comment, not a list.** No register of rejected entries: the bench records what was kept, and the reasons are cheap to re-derive. The exception is where the OBVIOUS choice is wrong — 7RSA is the most-cited RNase A structure and carries no SSBOND records at all, so a bench built on it prints "no disulfides" for the protein whose disulfides are the whole story. One line, beside the entry it explains.

## 6. Say whether a surface is worth baking

Recommend SES only against a criterion, never a feeling:

**Bake it when the claim is about a surface.** A pocket, an interface, what fits into what, complementarity. `sickle/fibre-test` bakes one because the lesson is a contact between two tetramers.

**Skip it when the claim is about the fold.** A ribbon is strictly better there, because a surface buries the secondary structure that *is* the point. Prion is a fold claim, which is why the stack reads at all as a ribbon and would read as a lump of dough as a surface.

It is expensive and it is a bake, not a render: `rendering-modules.md` owns the how, including the rule that a surface's frame is read from the trace file rather than re-derived.

## 7. Downloads and files

**Raw downloads are a separate question.** A deposition can be much larger than anything the bench reads (1QLZ is 2.7 MB of 20 models; the bake is 169 KB). Bake small, commit the bake, and ask before committing the raw file. The baker's header carries the source URLs so a re-run is possible without it.
