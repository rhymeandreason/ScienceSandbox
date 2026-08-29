<!-- KIND: recipe — load when bringing a NEW protein into the repo from deposited coordinates, before any lesson exists for it. Ends at a reviewed protein in proteins/proteins.js, not at a bench. `rendering-modules.md` is what to draw it with; this is how to decide what is worth drawing. -->

# Adding a protein

Workflow: A separate agent session looks at proteins-wishlist and does a first pass at finding a good candidate file.

**The bench comes before the database.** `proteins/proteins.js` is what we have SELECTED, and selecting is a human looking at structures on a bench and saying which ones earn a place. So a new protein is not registered when it is pulled; it is registered after the human reviews the bench.

**The rule the whole file serves: look before you decide, and measure before you render.**

## 1. Pull the data from proteins/proteins-wishlist.md

## 2. Build the bench

One test page, every relevant structure as a ribbon, buttons to switch. Not a lesson. It exists so the human can review. Make a folder for the protein in the proteins folder to hold the data and the test page.  `proteins/<name>/<name>-test.html`

**First, read your file and answer these. Each names what it costs, and the list below the examples is where each answer is spelled out.** Most candidates answer no to all of them, and no to all of them means copy hexokinase, bake chain A, ship — 1LZ1 is the case, and 1CA2 and 2POR are one pocket away from it.

* **Is there a nucleic-acid chain, or is the entry mmCIF-only?** Then stop and say so — see the two below that end the recipe.
* **Does the entry deposit its biological assembly as MODELS?** *The biological assembly is not what the file's first model holds.*
* **Is there a chain in the file you are not drawing?** *A partner chain is in the file.*
* **Is there a HETATM sitting in the site — a metal, a cofactor, a ligand?** *Something is bound in the site*, and *the pair is apo against holo* if you also hold the empty one.
* **Does it declare MODRES, or carry no HELIX / SHEET records?** *A residue is modified*, and *the file carries no HELIX or SHEET records*.
* **Is the entry a fragment or a construct, or does the literature number it differently from the file?** *An entry is a fragment or a construct*, and *the field quotes different numbers than the file*.

4 examples. Copy hexokinase as the default. Copy prion if you have a disease or mutation variatn. If you have a reason to use an advanced example, tell the human first.

* **`proteins/hexokinase/hexokinase-test.html` — enzyme with two states for motion. This is the primary example.**
* **`proteins/prion/prion-test.html` — normal and misfolded disease variant, and extra assembly view for the disease.**
* **`proteins/collagen/collagen-test.html` —**  **(Advanced)** More files were included on this page to show closeups, a mutation example,  and the whole structure. There are two stories here: scurvy and brittle bone disease.
* **`proteins/atp-synthase/atp-synthase-test.html` —**  **(Advanced)** This assembly has many chains, and a custom rotation animation. Ask the human before doing animation. Tell her what should happen.

**The layout is `proteins/protein-test.css` .**  Load it after `sandbox.css` and before `kit/proteinbox.css`. What a page adds in its own `<style>` is only what it says with COLOUR — prion's rust `.disease` variant is the whole of its block, and rnase has no block at all.

**Bake, do not parse the deposition at runtime.** A baker beside the page cuts each source down to what the bench draws and writes it to `data/` as `bake-trace.js`-shaped JSON the box takes directly.

**While the protein is under review its candidates live in the baker**, as a `CANDIDATES` table at the top of `proteins/<name>/tools/prep.js`: id, chains, and one line saying what each is meant to show. Nothing goes into `proteins/proteins.js` yet, because everything in that file is a decision and none has been made. Bake generously here — a candidate that turns out to say nothing is what step 4 is for, and it is cheaper to look at one than to argue about it. **Every example bench above is POST-review and its baker shows it** — hexokinase's `proteins/hexokinase/tools/prep.js` opens `REG.byKey('hexokinase')` and takes its view table out of the registry. Copy the page, not that: yours reads its own `CANDIDATES` until the human has decided.

**Two candidates end the recipe rather than complicate it, and both are invisible until a baker returns nothing.** Say so and stop; neither is a thing to work around beside a bench.

* **A nucleic-acid chain.** `caTrace` keys on the `CA` atom, and DNA and RNA have none, so a chain of either bakes as nothing at all. Four candidates on the wishlist carry one — the nucleosome's two 146-mers, the two DNA-binding Tier 1 entries, the polymerase pair — so it is a one-time engineering cost that opens four at once, and it is a decision about what the trace shape IS, not a baker's to make alone.
* **A deposition with no legacy `.pdb`.** Every record read here is a PDB record: `HELIX` / `SHEET`, `SEQRES`, `SSBOND`, `MODRES`, `CONECT`, `MODEL`. A structure large enough to be mmCIF-only is also large enough that the bake, the framing and the lesson are all different questions from the ones this file answers.

**Reading the file is `proteins/bake-lib.js`, and a new baker does not re-implement it.** The altloc rule, secondary structure read rather than detected, ss indexed by residue number, `nums` beside `first`, the centring, the solved frame, SEQRES / SSBOND / HETATM — each carries the trap it exists to prevent, and three copies is where those start to drift. What a baker writes for itself is the VIEW table and whatever its protein is about. It composes its own output object from `assemble` and `frameOf` rather than handing off to a shared writer, because the bakes are committed artefacts and a shared writer reorders every one of them the day it changes its mind about a key. Along with the trace, that baker writes a `meta` block holding every figure the panel prints: the declared length off `SEQRES`, the disulfides off `SSBOND`, the ligands off `HETATM`, the model count. A number counted in the baker is re-counted on every re-bake; the same number typed into a panel is not. Chain A unless the assembly is the point, alt-locs blank or `A` only, and the file's own `HELIX` / `SHEET` records ride along. Secondary structure is **read, never detected**: for a lesson about folding, detecting it is inventing the claim.

**Do not draw the ribbon yourself. Mount a `kit/proteinbox.js`.** The scene, the camera, the framing, the drag and the WebGL context are the module's, which is what makes every protein in the repo behave the same way. `rendering-modules.md` has the options; the shape of it is:

```
const box = Proteinbox.create({ mount, orbit:true, sub:10,
                                stage:{ ortho:false, turn:'trackball' } });
box.setData(data, { colors });      // again per structure, same box
```

* **`sub:10` and `turn:'trackball'` on a full-height stage.** The box's defaults are a card's — 6 samples per residue, and a turntable whose pitch clamps about a hundred pixels into an upward drag. Both run out at full size, on faceting and on the top of the molecule. `Modules.md`'s `scene.js` row is why.
* **The zoom clamp and the framing limits are the box's, and they follow what it solved.** `Proteinbox.fit()` retunes `scene.js`'s `rMin`/`rMax`, `Stage.frame`'s own solve limit and the camera's far plane off the radius it just measured, and frames per AXIS rather than on a circumscribing sphere. Nothing is needed from the page. It is here because every one of those is invisible until a reader scrolls.
* **One box, re-fed.** `setData` swaps the structure and keeps the camera, so a reader who turned the molecule still has that view after a switch. One box per structure costs a WebGL context each and snaps the framing back on every click.

**A ribbon is not always the whole subject.** Myoglobin is 153 residues wrapped around one iron, and a bench that drew only the backbone would draw the box and leave out what is in it. `proteins/myoglobin/` is the worked example: its baker writes a `pocket` beside the trace — the heme, whatever is bound to its iron, the one or two side chains that make the site — **centred by the same vector as the trace**, because a pocket centred on itself sits at the origin with the protein somewhere else, and that reads as a bug in the ribbon. The page hands it to `box.setPocket({atoms, bonds})` and the box draws it: the ball-and-stick proportions, the split sticks and the iron's rust are the module's, so this heme and hemoglobin-lab's cannot become two opinions about the same group. It draws in the structure's own frame, does not widen the framing radius, and clears with the ribbon on every `setData`. **What is IN the pocket stays the baker's** — which residues, which ligand names count, whether a cross-residue bond is kept — the same refusal the box makes about parsing. Connectivity comes off the file's `CONECT` records, never a distance cutoff — a cutoff wide enough for the 2.0 Å Fe–N coordination also draws the porphyrin's diagonals.

**If the views are states of one thing, match their rotation and position so they can be flipped back and forth.** A deposition's orientation is its crystal's, so N files is N arbitrary frames: flipping between them turns the whole molecule, and a reader cannot tell a real change from the crystallographer's choice of origin. Fit every view onto ONE reference in the baker — `proteins/myoglobin/tools/prep.js` does it with the `kabsch` in `sickle/tools/bake-sickle.js` — and centre them all on the reference's centroid, or the re-centring slides back apart most of the fit that was just made.

* **Fit on what the bench is ABOUT**, which is not always the trace. Myoglobin's four states are a binding site, so the fit is on the heme, matched by atom name: that puts the iron in the same place in every view, and it works between structures whose residue numbering does not correspond at all — a whale's myoglobin against haemoglobin's β chain. A Cα fit could not have matched those two.
* **The panel says it was fitted, and how well.** A `view: deposited` row is a half-truth the moment anything is superposed. Name the reference and print the residual beside it.
* **A number that needs an alignment nobody has is null, not computed.** The backbone RMSD is meaningful across the whale and horse files, which number from the same alignment, and meaningless against a β chain, where residue 45 is not the same residue. The bench prints "numbering not comparable" there rather than a figure that would be read as a poor match instead of no match.

**The box will not read a PDB, and that refusal is the design.** It takes chains already decided — `{first, nums, CA, ss}`, the shape `proteins/bake-lib.js` writes — and draws them. Opening a deposition would force three judgement calls that change what the picture CLAIMS rather than how it looks: which altloc (a residue modelled twice contributes once, or the ribbon splines through both), which chains (a monomer, one subunit of an assembly, or the whole thing), and whether secondary structure is read or detected. A shared module has no business making those for every protein in the repo.

**So the protein owns them, in its baker.** `proteins/bake-lib.js` applies the altloc rule and reads `HELIX`/`SHEET`; the `proteins/<name>/tools/prep.js` beside the bench picks the chains and says what the view is. A bench then `fetch`es a bake and hands it over. The invariants below are what the baker has to get right; the first one is prion's scar, from when that parse ran on the page.

Three invariants, wherever the chains get built. Each is a bug that ships looking fine.

* **Parse chain-aware before anything multi-chain.** `PrionLib.parse` keys residues by number alone, which is right for one chain and silently wrong for ten: chain B's residue 180 overwrites chain A's, and a ten-rung stack parses as one rung wearing the last chain's coordinates.
* **Send `nums`, not just `first`.** They are what lets the box break the ribbon where the chain breaks. Omit them and a chain reads as contiguous, so an unmodelled loop is drawn as a smooth tube across 10 Å of nothing — indistinguishable from data at ribbon width. 1RNU is the case: subtilisin cuts RNase A at 20-21 and residues 16-23 go unmodelled, so the gap drawn is wider than the cut.
* **Say where the frame came from.** A deposited frame is the experiment's, not a decision about how the structure should be seen, so the box gets a `view` basis: `FoldLib.viewBasis` solves one from the shape, `FoldLib.basisFrom` puts a known axis upright where the field has a convention (a fibril vertical, a membrane protein on its normal), and a globular domain gets neither — its extents are too close to tell apart, its solved basis would flip between rebakes, and a human picks one instead. Whichever it was, the panel names it rather than leaving a rotation nobody can account for: `chosen in the registry`, `computed`, `deposited`, and those three words are `Bake.viewFor`'s, not a baker's.

**A HUMAN'S ROTATION HAS EXACTLY ONE PATH, AND IT IS NOT A BAKE.** Turn the molecule on the bench, press *copy this view*, paste into that protein's `view: {by:'human', basis}` in `proteins/proteins.js`, reload. That is the whole loop, and it is short on purpose: a chosen basis is taste rather than measurement, so making it a committed artefact would charge a re-bake for every re-aim, rewrite files whose coordinates did not change, and leave the same decision in two places with a checker holding them level.

**So the two kinds of basis live in different places, and that split is the design.** A SOLVED basis — `FoldLib.viewBasis` worked it out from the shape — is a measurement, and it is baked beside the extents it came with. A CHOSEN one lives only in the registry and `kit/proteinbox.js` reads it at draw time. `Bake.viewFor` writes no view at all where the registry holds a chosen one, so `frame` reads *chosen in the registry* and a page that forgets to pass the basis opens in the deposited frame, which is visibly wrong rather than subtly. `proteins/check-proteins.js` fails a bake that carries a chosen basis anyway.

**Every consumer asks `ProteinLib.viewOf(p)`** — `colorsOf`'s rule, and for its reason: it is everyone calling the same thing that stops a bench and a gallery card becoming two opinions about which way one molecule faces. A box created with `protein:` gets it without asking. **Do not write a basis anywhere else.** The page-side `CUSTOM` tables that used to do this applied after the fetch, so they turned the bench while the card reading the same file stayed put, and no checker could see it. There were three and they are gone.

**The copy button is `box.pickView()` and a page must not compute one itself.** What is on screen is `camera⁻¹ · view`, so a button that reads only the camera is right until the structure has a view and wrong forever after — which is the moment someone is using it. It needs the chain group's rotation, which only the box can see.

**Every number in the panel is counted off the file**, not typed. Residues, segments, chains, record counts. A typed number is a claim nothing checks, and a re-bake falsifies it silently.

### Nine conditions the deposition puts you in, and what each one costs

Each started as a bug that rendered beautifully, and collagen hit eight of them at once, so `proteins/collagen/` is where to read one. **Read the condition, not the protein** — most of these are the common path. Ferritin's assembly is 24 models; GFP's chromophore is a HETATM; KcsA's open state ships with a Fab; every apo/holo pair is the fourth row.

* **The biological assembly is not what the file's first model holds.** `modelOne` takes everything up to the first `ENDMDL`, which is right for an NMR deposition and silently wrong for an assembly deposited as models: ferritin is ONE chain in the asymmetric unit and 24 models of it in assembly 1, GroEL is 7 and 2 models of 7, oxy haemoglobin is 2 and 4. Take the default and you bake a twenty-fourth of an iron ball, which renders as a perfectly good four-helix bundle and says nothing about the ball. Decide which file you are reading — asymmetric unit or assembly — before anything else, and if it is models, merge them chain-aware. Prion's `stack` is the worked case: 6LNI's ten chains held together, which is why it carries `of:` rather than a source of its own.
* **A partner chain is in the file.** Solve the frame on the SUBJECT, not on everything drawn. 1DZI's longest axis is the integrin's, so a frame over all four chains lays that across the screen and stands the collagen at an angle while the view row still claims "helix axis across". The candidate names its own subject chains; the roll about that axis is then chosen from everything drawn, so a partner ends up beside the subject rather than behind it. Half the assemblies on the wishlist are this: a Fab, a peptide, a lid, a strand of DNA.
* **Something is bound in the site.** A pocket is what a view is ABOUT up close, and one view gets one. The metal for the grip, the hydroxyls for the peptides — and 1DZI has 18 hydroxyprolines it deliberately does not draw, because on that view they are not the point. Two pockets is two subjects.
* **The pair is apo against holo.** The empty pocket is a measurement. `(Pro-Pro-Gly)₁₀` ASKS for hydroxyls and has none, and its row says so; a baker that was never asked would look identical and mean nothing. Where an absence is half of a comparison, bake the absence.
* **A residue is modified, so it is a HETATM and an ATOM-only trace drops it.** Hydroxyproline is every third residue of collagen and an ATOM-only read of 1CAG keeps 19 of 29, splining the ribbon over the holes — indistinguishable from a disordered protein. `Bake.modResidues` reads the file's own MODRES set; pass it to `caTrace` so they count as chain, and to `ligands` so they stop being reported as cargo. Opt-in, because it changes what a trace CONTAINS and every bake is a committed artefact.
* **The file carries no HELIX or SHEET records, or too few to say anything.** Colour by chain instead. Polyproline II is neither, so no collagen file records any, and the repo default draws a triple helix as one green rope — the braid, the entire subject, disappears. `colors:{byChain:{…}}` is for that, and the page's legend reads the same table the ribbon does. Ask what a reader has to TELL APART on this bench; if the answer is not "what it is folded into", the default palette is wrong for it.
* **An entry is a fragment or a construct.** Say where it sits on the whole molecule — by matching, never by typing. Six of collagen's seven entries are designed peptides whose 1–30 numbering is construct-local. The baker sequence-matches each against the one entry that is a whole molecule and reports a position or `null`. **Two traps, both of which produced confident wrong answers first:** uniqueness is not enough, because a repeat protein has long runs that happen to occur once (a (Gly-Pro-Hyp)₉ peptide "located" itself in the C-terminal repeat); and LONGEST loses to coincidence (matching 1DZI by length picked a 9-residue run in an unrelated site over the 6 of `GFOGER`, putting the integrin's grip 440 residues from where it is). Score by INFORMATIVE residues instead — the ones outside the repeat's own alphabet — and require at least two.
* **The field quotes different numbers than the file.** Collagen positions are quoted from the start of the triple-helical domain; 3HR2 numbers from its telopeptide and runs 16 ahead of every number in a paper. Find the offset (look for where Gly-X-Y actually starts), print both numbers, and check the result against something known — `GFOGER` comes out at 502, which is where the literature puts it. Serine proteases and β-lactamases have the same habit, under their own conventions.
* **The structure is very large or very long.** Nothing is needed from the page; `Proteinbox.fit` lifts `Stage.frame`'s solve limit and the camera's far plane off the radius it measured, and frames per AXIS. It is recorded because it was silent: one collagen molecule is 3016 Å, and clamped it opened showing a tenth of itself, unclamped it stood correctly behind the far plane and drew nothing.

## 4. Human reviews the bench

**Hand the bench over and stop.**

## 5. Add selections to proteins.js

**Now the protein goes into `proteins/proteins.js`**, selected set only — which is also what puts it on the gallery at `proteins/index.html`, since that page is nothing but the registry drawn. Move the `CANDIDATES` table out of the baker and into the registry's `variants`, and switch the baker to reading it — a few lines, and the diff is the record of what review decided. From here the registry is the single source for what a structure IS: which entries, which chains, which species, what each variant is for, and which one is the default. **Not what a bench SAYS about it** — that is page copy, written to be read under one particular stage, and it lives on the page in its `SAYS` table.

Then `node proteins/<name>/tools/prep.js` again to write the `read` block back, and `proteins/check-proteins.js`.

**What every field means and who owns it is `proteins/proteins.js`'s own header — read it before editing the file.** The said/read split and why a human never types a number into it, the method vocabulary, the derived URLs, `does`, `pipeline`; `Modules.md`'s row is the field list. None of it is repeated here. What is not in either:

* **`purpose` is the field that makes the collection worth having.** One short phrase saying what this variant is FOR — "misfolded disease variant", "cut in two and still working".
* **One variant carries `default: true`, and it is required.** `defaultOf` reads the mark and never falls back to the first entry, because then re-ordering the list would silently re-aim every bench. It is not automatically the superposition reference: myoglobin opens on Kendrew's 1MBN and superposes onto deoxy 1BZP, and the registry says why.
* **`pipeline:'own'` names the derived files BY ROLE.** `bake:` carries trace, quaternary, surface, card, fold, so what exists is legible and the checker can fail a name renamed out from under it; `page:` names the bench where the derived path would miss it; `lesson:` is the optional second link once one exists. Haemoglobin is the case, and `proteins/tools/read-own.js` writes its `read` from the deposition each variant names in `source.path`.
* **`does` is validated against `read.ec`.** An `enzyme` with no EC anywhere fails, so does a non-enzyme carrying one, and so do variants that disagree — two numbers under one key means a variant is filed under the wrong protein. The EC comes off each entry's own `COMPND` record, so a production page that loads bakes and never a PDB can still say which reaction. **The vocabulary is short, not closed** — it is four words today and most of the wishlist wants a fifth. Adding one is the human's decision and a one-line edit to `DOES`; inventing one in a variant is what the validator is there to stop.
* **A trap gets a comment, not a list.** No register of rejected entries: the bench records what was kept, and the reasons are cheap to re-derive. The exception is where the OBVIOUS choice is wrong — 7RSA is the most-cited RNase A structure and carries no SSBOND records at all, so a bench built on it prints "no disulfides" for the protein whose disulfides are the whole story. One line, beside the entry it explains.

## 6. Say whether a surface is worth baking

Recommend SES only against a criterion, never a feeling:

**Bake it when the claim is about a surface.** A pocket, an interface, what fits into what, complementarity. `sickle/fibre-test` bakes one because the lesson is a contact between two tetramers.

**Skip it when the claim is about the fold.** A ribbon is strictly better there, because a surface buries the secondary structure that *is* the point. Prion is a fold claim, which is why the stack reads at all as a ribbon and would read as a lump of dough as a surface.

It is expensive and it is a bake, not a render: `rendering-modules.md` owns the how, including the rule that a surface's frame is read from the trace file rather than re-derived.

## 7. Downloads and files

**gitignore the pdb files because they are multiple MBs**
