# Molecule Sandbox — interactive AP Bio chemistry sims

Self-contained, browser-based 3D molecular simulations for AP Bio. Each lesson is
one HTML page sharing a small set of modules. No build step, no framework — plain
Three.js (r128, global style) + vanilla JS.

Let the human test in the browser for visual changes, it's faster than taking screenshots.
Tell her what to do to test the changes.

Try to model scientific accuracy, especially when building atoms and molecules. 


## Pages (lessons)

<!-- ENUM: add a row when a *-lab.html is added or repurposed. -->
| Page | Lesson | Paradigm |
|---|---|---|
| `water-lab.html` | Structure of water → the universal solvent (H-bonds, ice, temperature, salt dissolving) | solvation physics |
| `molecule-lab.html` | Dissolving sandbox: polar/nonpolar/ionic solutes, CO₂ → carbonic acid → bicarbonate + pH | solvation physics + reactions |
| `aminoacid-lab.html` | Build a peptide: amino acids join by dehydration synthesis, releasing water | molecular assembly |
| `glycolysis-lab.html` | shows 5 steps to emphasize carbon bookkeeping, why does it cost 2 ATP to make ATP | pathway |
| `molecule-builder.html` | Build a bond by hand: drag atoms together and watch valence, geometry and charge decide what you get (H₂O · CH₄ · NH₃→NH₄⁺ · CO₂ · N₂ · HCl · NaCl · KCl · MgCl₂). HCl and NaCl are a deliberate pair — the same chlorine, shared then taken; MgCl₂ is where the metal's count, not a rule, decides the formula | bonding assembly |
| `macromolecule-lab.html` | The four classes side by side: one monomer each (glucose · palmitic acid · alanine · AMP), at true relative size, with their functional groups callable out | comparison gallery |
| `protein-lab.html` | The four levels of protein structure. Levels 1–3 are one molecule (lysozyme) restyled, never swapped — that they are the *same chain* at three scales is the lesson; level 4 changes molecule (an antibody) because it must | PDB structure viewer |
| `folding-lab.html` | How a protein folds: villin headpiece (PDB 1VII) collapses from an extended chain. Two acts with two different causes — hydrogen bonds coil the helices (12 of its 14 are i→i+4), then the hydrophobic core packs them. Act 3 zooms out at true relative size — HP35 → the headpiece → villin (AlphaFold, eight arrangements, because the prediction knows each domain's shape and not their layout) → the actin filament it grips → and a coda showing villin-on-actin *measured* by X-ray, which is the answer the prediction could not give. It is `protein-lab`'s *why* to that page's *what* | folding animation |
| `folding-lab-ribbon.html` | **Evaluation copy of `folding-lab`, not a second lesson.** Identical except that act 3 is drawn as a cartoon instead of tubes — HP35's three α-helices from 1VII's own HELIX records, and all 826 residues of villin from a DSSP run at bake time on the AlphaFold model's backbone. Rungs 4–5 stay tubes: at 40 nm a ribbon is sub-pixel. Delete it once one of them wins | folding animation |
| `viewer-compare.html` | Not a lesson — the ChemDoodle Web vs 3Dmol.js evaluation. Loads no shared module on purpose, so the libraries are judged unmixed with our own rendering. Delete it once the first protein page ships (`RenderingLibraries.md`) | evaluation scratch |
| `contrast-lab.html` | Spot the difference: six near-identical pairs (glucose/galactose · ribose/deoxyribose · purine/pyrimidine · L-/D-alanine · maltose/cellobiose · palmitic/palmitoleic acid) where one feature is the whole lesson | comparison gallery |

## Shared modules

Only `molecules.js` + `scene.js` are universal. A page loads what it uses, and the
order matters — each script assumes the ones above it:

```html
<link rel="stylesheet" href="sandbox.css">   <!-- loads the fonts too; after icons, before page <style> -->
...
<script src=".../three.min.js"></script>
<script src="palette.js"></script>     <!-- always, first — atom/bond colours + radii -->
<script src="molecules.js"></script>   <!-- always — PALETTE, SCALE, VIEW + the empty registry -->
<script src="skel.js"></script>        <!-- only if the page shows a Skel-built molecule -->
<script src="mol-solvation.js"></script>   <!-- the specs: load the domains this page shows -->
<script src="mol-monomers.js"></script>    <!-- ...see the per-page table below -->
<script src="scene.js"></script>       <!-- always — Stage.create + molecule builder -->
<script src="fx.js"></script>          <!-- if the page fires any effect -->
<script src="atomkit.js"></script>     <!-- bonding builder only -->
<script src="covalent-drag.js"></script>  <!-- bonding builder only -->
<script src="ionic-drag.js"></script>     <!-- bonding builder only -->
<script> /* page-specific code */ </script>
```

**A page loads only the molecules it shows.** `molecules.js` holds no specs at
all — it is the registry (`PALETTE`, `SCALE`, `VIEW`, `DOMAINS`) — and the
`mol-*.js` domain files assign into it. So the script tags are what decide which
molecules exist on a page, and getting them wrong is a `MOLECULES.x is
undefined`, not a silent wrong render.

Load order is **`molecules.js` → `skel.js` → `mol-*.js`**. `skel.js` itself has
no dependencies since item 7 (it works in real ångströms and never sees
`SCALE`), but the domain files need both, and `mol-contrast.js` mirrors alanine
out of `mol-monomers.js`. Only pages showing a Skel-built molecule (sugars,
glycolysis) need `skel.js` at all.

**A spec's coordinates on disk are real ångströms** (`units:'angstrom'`);
`register()` multiplies by `SCALE` once, on the way into the registry. The
family-A solvation set is `units:'scene'` — those numbers are already display
units. MolecularGeometry.md §1.5 has the why, and `check-molecules.js` requires the field.

<!-- ENUM: update when any page's <script> tags change.  -->
| Page | Loads |
|---|---|
| `water-lab` | palette, molecules, mol-solvation, scene, fx, atomkit |  <!-- atomkit: step 1's element letters + δ badges -->
| `molecule-lab` | palette, molecules, mol-solvation, scene, fx |
| `molecule-builder` | palette, molecules, mol-solvation, scene, fx, atomkit, covalent-drag, ionic-drag |
| `aminoacid-lab` | palette, molecules, mol-monomers, mol-small, scene, fx |
| `glycolysis-lab` | palette, molecules, skel, mol-glycolysis, scene, fx |
| `macromolecule-lab` | palette, molecules, skel, mol-monomers, mol-glycolysis, scene, fx |
| `contrast-lab` | palette, molecules, skel, mol-monomers, mol-glycolysis, mol-contrast, haworth, scene |
| `protein-lab` | pdb, vendor/chemdoodle/ChemDoodleWeb |
| `folding-lab` | palette, molecules, scene, fx, folding/folding, folding/villin, folding/actin |
| `folding-lab-ribbon` | palette, molecules, scene, fx, folding/folding, folding/villin, folding/actin, folding/ribbon |

Rows are explicit — no row inherits from the one above it any more, because the
sets stopped being nested once pages began loading different domains.

**`protein-lab` is a different kind of page and its one-word row is not an
oversight.** Pages that render *deposited* structures (PDB files in `pdb/`) share
`pdb.js` and `sandbox.css` and nothing else: no Three.js, no `scene.js`, no
MolLib. They draw through vendored ChemDoodle Web, which is **GPLv3 and makes any
page loading it GPLv3** — `RenderingLibraries.md` and `vendor/chemdoodle/README.md`
carry the reasoning. `tools/check-pages.js` skips them because there is no
molecule reference to check; `tools/check-pdb.js` is what audits them instead.

**`folding-lab` is a THIRD kind of page: deposited coordinates, drawn by us.**
It reads `pdb/1VII.pdb` but renders through `scene.js` like the Three.js
lessons, because its chain moves every frame and its hydrogen-bond dashes are
the lesson — neither of which ChemDoodle can do, and going that way would also
pull the page into the GPL. So it loads `palette.js` + `molecules.js` for
`PALETTE` alone and no `mol-*.js` at all: every coordinate is a real ångström
off the PDB, never a `SCALE`d spec. Display radii are the house `PALETTE.radii`
**divided by `SCALE`**, computed in the page — that is what keeps its
ball-and-stick proportions identical to every other page, and `folding/folding.js`
deliberately holds no radii of its own since it renders nothing. Its chemical
claims are asserted at the foot of `tools/check-pdb.js`.

**Act 3 is an AlphaFold prediction and the page says so.** There is no
deposited full-length villin. `pdb/AF-P02640-villin.pdb` is AlphaFold's model
of chicken villin-1 (UniProt P02640), and 1VII is residues **791–826** of it —
35 of 36 identical, 2.03 Å Cα RMSD, so the folded chain seats onto the model by
a rigid superposition. The eight arrangements exist because **PAE says the
model cannot place its own domains**: ~2 Å within HP35, but pinned at the
31.75 Å ceiling between headpiece and core. Domains are moved rigidly and only
linkers change. They are *generated, not observed* — the same interface an NMR
ensemble uses, with completely different epistemic status, which is why the
legend note and the button tooltips say so. `folding/villin.js`'s header carries the
full argument, including why uncertainty must not be presented as motion.

**Where `folding-lab-ribbon`'s secondary structure comes from, and what each
source licenses.** Three different answers, and the difference is the point:
HP35's helices are 1VII's own **HELIX records** — an experiment; villin's 826
residues are **DSSP** (`RibbonLib.dssp`, Kabsch & Sander) run at bake time on
the AlphaFold model's N/CA/C/O, because AlphaFold DB ships no HELIX or SHEET
records at all; and `RibbonLib.detect()`, a Cα-spacing heuristic, is used by
**nothing** and should stay that way. The distinction matters because all
three render in identical ink. DSSP on a prediction reports *the model's*
secondary structure, not the protein's — the mild form of this page's standing
caveat, defensible because AlphaFold's local fold is its most reliable output
while the PAE argument driving the eight arrangements is about where domains
*sit*. `check-folding.js` validates the DSSP against 1VII's records over the
36 residues where experiment and prediction overlap, which is the only place
the two can be compared, and asserts the baked bytes match a fresh run.

The backbone the DSSP needs never reaches the browser: `villin.js`'s `parseCA`
is Cα-only by design, so the answer is computed once and carried as one byte
per residue in `AF-P02640-villin.poses.bin` (format **version 2**; the SS block
goes last so the Float32 views stay 4-aligned). Change `ribbon.js`'s DSSP and
you must re-run `node folding/tools/bake-villin.js`, exactly as with the fold
and the actin bins.

**Rungs 4–5 add two more structures and two more caveats.** The filament is
9ZZI (F-actin, cryo-EM 2.06 Å) — five subunits deposited, extended to 13 by the
helical screw **measured from the file itself** (27.60 Å rise, −166.60° twist,
four steps agreeing to 0.024 Å, both matching the literature). `folding/tools/check-folding.js`
asserts that repeating the screw reproduces every deposited chain, which is
what makes the extra subunits symmetry rather than invention. The coda is 9JUS
(villin gripping an actin trimer, X-ray 2.7 Å) — and **its villin is from a
deep-sea vent worm**, because no vertebrate villin–actin structure exists. That
species jump is stated on the page and asserted in the checker, and the complex
is deliberately *not* drawn in HP35's blue.

**The fold itself is precomputed and committed.** The page loads
`folding/data/1VII.fold.bin` and plays it; it runs no solver. `folding/folding.js` still
contains the solver because `folding/tools/bake-fold.js` and the checker need it —
but nothing in the browser calls `Folder`. Change the solver and you must
re-run `node folding/tools/bake-fold.js`, or `folding/tools/check-folding.js` fails: a stale trajectory
is invisible from the animation, which is exactly why it is checked.

`aminoacid-lab` loads `mol-small` because dehydration synthesis releases a real
water molecule and that water has to sit correctly beside the residues. **A
family-B page that needs a small molecule loads `mol-small.js`; only the
solvation pages load `mol-solvation.js`.** The two define the same keys and
`register()` throws if both are present.

<!-- ENUM: update when a module is added, or an exported entry point is added/renamed. -->
| Module | Exposes | Rules |
|---|---|---|
| `palette.js` | `MolPalette` — atom colours, bond colours, display radii, bond colours, display radii. Loads before `molecules.js`, which re-exports it as `MolLib.PALETTE` | own header |
| `molecules.js` | `MolLib` = `PALETTE` (colours/radii) · `MOLECULES` (the registry, empty until a domain file loads) · `SCALE` · `VIEW` · `DOMAINS` (the manifest) · `register` (applies the display scale) · `atomIndex`/`resolveAtoms` | `MolecularGeometry.md` §1 |
| `skel.js` | `SkelLib` = `Skel` + the `GL`/`AR` bond-length tables (**real ångströms**) + ring/chain scaffolds. The builder, not data — and it has no dependencies at all | MolecularGeometry.md §1.2, §1.5 |
| `mol-solvation.js` · `mol-monomers.js` · `mol-glycolysis.js` · `mol-contrast.js` | nothing — each calls `register()` to add its specs to `MolLib.MOLECULES` | MolecularGeometry.md §1.2, §1.5 |
| `mol-small.js` | the same substances as `mol-solvation.js` but **to scale** (family B). Either/or with it — `register()` throws if both load | own header, MolecularGeometry.md §1.5 |
| `lib-node.js` | the whole library for Node checkers, by walking `MolLib.DOMAINS`. No page loads it | own header |
| `scene.js` | `Stage.create/measure/frame/buildMolecule/atom/bond/removeAtoms/setOptionalH` | §6 |
| `fx.js` | `FX.create` → `spawnRing`, `popGlow`, `protonHop`, `settleShimmer`, `step` | §5 |
| `atomkit.js` | `AtomKit.create` → `dot`, `cloud`, `label`, `charge`, `cel`, `DOT_GAP` | own header |
| `covalent-drag.js` / `ionic-drag.js` | `CovalentDrag` / `IonicDrag`, each driven by a `RECIPES` table | own header |
| `folding/actin.js` | `ActinLib` = `parseCA` + `screwOf` (the helical operation, measured from the file) + `extend` + `encode`/`decode`. `folding-lab.html` rungs 4–5 only. Real ångströms | own header |
| `folding/villin.js` | `VillinLib` = `parseCA`/`segment` (PAE → rigid domains)/`poses` (generated arrangements) + `encode`/`decode`. `folding-lab.html` act 3 only. Real ångströms | own header |
| `folding/ribbon.js` | `RibbonLib` = `build` (Cα trace + secondary structure → a ribbon `BufferGeometry`) + `dssp`/`parseBackbone` (Kabsch & Sander, the real thing, needs N/CA/C/O) + `assign`/`detect` + `HP35_HELICES`. `folding-lab-ribbon.html` and `bake-villin.js`. Real ångströms, no materials — the page owns those | own header |
| `folding/folding.js` | `FoldLib` = `parse`/`hbonds`/`extended` (PDB text → backbone, its H-bonds, an extended start state) + `orient` (principal-axis frame) + `Folder` (the constrained relaxation and its `bake`). `folding-lab.html` only. Real ångströms; never sees `SCALE`, and holds no display radii — it renders nothing | own header |
| `sandbox.css` | cream paper, torn-edge panel, `#app` grid, stage/panel chrome — and the `@import` that loads **all** the webfonts, so no page carries a font `<link>` (only the two preconnect hints) | own header |
| `tools/sdf2spec.js` | PubChem 3D → spec, amino-acid backbone order | `tools/README.md` |
| `tools/sdf2spec-generic.js` | the same for non-amino-acids; orients on the ring plane | `tools/README.md` |
| `tools/sdf/` | the committed PubChem inputs (8 `.sdf`) for every `path:'pubchem'` spec | `tools/sdf/README.md` |
| `tools/spec2smiles.js` | regenerates every contrast spec's `smiles` through RDKit, sugars included | `tools/README.md` |
| `folding/tools/bake-actin.js` | reduces 9ZZI + 9JUS (6.1 MB) to `pdb/actin.bin` (27 KB): one actin protomer, the screw that stacks it, and the complex's Cα traces. The page rebuilds the other twelve subunits | own header |
| `folding/tools/bake-villin.js` | derives villin's domains from the 1.9 MB PAE matrix, rejection-samples the eight arrangements, and runs `RibbonLib.dssp` over the model's full backbone, writing `folding/data/AF-P02640-villin.poses.bin`. The PAE stays in `folding/data/` as a committed input and never reaches the browser; neither does the backbone, so the DSSP has to happen here | own header |
| `folding/tools/bake-fold.js` | solves the villin fold once and writes `folding/data/1VII.fold.bin` (433 KB, 181 keyframes). `folding-lab.html` plays that file and folds nothing itself. **Re-run after any change to `folding/folding.js`'s solver, schedule or H-bond cutoffs** — `folding/tools/check-folding.js` compares the committed file against a fresh bake and fails if they differ | own header |
| `tools/check-handedness.js` | the ONLY check that catches a global mirror — needs `npm i` + network | own header, MolecularGeometry.md §1.3 |

Things that are easy to get wrong and are not visible from the API:

- **A spec's coordinates are canonical.** Never bake a viewing angle into them
  with `Skel.rotate()` — declare `view:VIEW.pyranose` (radians `[x,y,z]`, applied
  by `Stage.buildMolecule`), and add new angles to the `VIEW` table so two specs
  share a view by name rather than by copying three constants.
- **Specs come in two bond-length families** and a page should show only one. MolecularGeometry.md §1.5.
- **Coordinates in a `mol-*.js` file are real ångströms** unless the spec says
  `units:'scene'`. Never paste display-scale numbers into an `angstrom` spec —
  it is a silent 1.9×, which reads as a styling choice rather than a bug.
  `tools/sdf2spec*.js` emit ångströms, so their output pastes in directly.
- **Never hand-tune a camera.** `Stage.measure` + `Stage.frame` solve the distance
  from the real frustum; a hand-picked `r:` is only right at the size it was tuned
  for. Pass `orbit:false` on a side-by-side page — orbiting puts one molecule
  nearer the camera and perspective magnifies it.
- **`Stage.bond` takes a bond order**; `[i,j,2]` in a spec draws a double bond as
  a pair of sticks. `setOptionalH` toggles *visibility* of the C–H's listed in
  `optH`, so it can never resurrect a reaction-removed atom.
- **`atomkit.js` owns what a student learns to _read_**, never how a bond forms.
- Page-specific, not plumbing: the drag modules are *mechanics*. Same mechanic,
  different constants → a recipe in the same file; different mechanic → new file.

## Architecture principle: **share the plumbing, not the physics**

There is deliberately **no monolithic `engine.js`** — the lessons are distinct
paradigms (solvation, assembly, pathways, bonding) with no shared simulation core,
so only the universal scaffolding is extracted. **Full rationale and the test for
what belongs in a shared module: `SCIENCE.md` §6.**

## Adding a new page

1. Copy the head (fonts/icons + `sandbox.css` + the scripts you need — see the
   table above) and the `#app` layout skeleton from `aminoacid-lab.html`, or
   `contrast-lab.html` if you want the no-FX, no-simulation-loop shape.
   **Load only the `mol-*.js` domains your page shows**, and put them after
   `molecules.js` (and after `skel.js` if any of them needs the builder).
2. Add any new molecules to the right `mol-*.js` domain file — never to
   `molecules.js`, which holds no specs. A molecule in the wrong domain is a
   molecule some page pays for and never draws. Prefer generating geometry with
   `tools/sdf2spec.js` (its inputs are committed in `tools/sdf/`) over typing
   coordinates, give it a `src:` (`check-molecules.js` requires one), then run
   the checkers. A new domain file also goes in `MolLib.DOMAINS`.
   **A molecule that makes a chemical claim ships with the assertion that checks
   it, in the same commit** (MolecularGeometry.md §1.4 rule 2). This is not advisory: an
   undeclared claim is one nothing can ever catch, which is how every sugar in
   this library spent months being the wrong enantiomer.
3. `const {scene,camera,renderer,root,cam,applyCam,resize}=Stage.create(canvas,{...});`
   then `const FXi=FX.create(THREE,root,camera);` — skip FX entirely if the page
   fires no effects at all (`contrast-lab.html` does; `macromolecule-lab.html`
   has no reactions but still rings on selection, so it keeps FX).
4. Build molecules with `Stage.buildMolecule(spec,{center:true})` (assembly
   pages) **or** a page-specific builder if you need outlines/physics `userData`.
   Then frame the camera rather than guessing a distance:

   ```js
   const g = Stage.buildMolecule(MolLib.MOLECULES.glucose, {center:true});
   root.add(g);
   const m = Stage.measure(MolLib.MOLECULES.glucose);
   Stage.frame(camera, cam, [{x:0, y:0, rxz:m.rxz, hy:m.hy}]);  applyCam();
   ```

   Re-call `Stage.frame` from a `ResizeObserver` — it solves against
   `camera.aspect`, so it is only right once the canvas has been measured.
   Leave the spec's own orientation alone: `view:` already carries the angle
   chosen to present it well, and with a raised camera (`phi≈1.3`) that is the
   view the other pages show. Raising the camera is fine; *swinging*
   it (`theta`) is not on a side-by-side page, because it puts one molecule
   nearer than the other and perspective magnifies it.
5. Fire `FXi.spawnRing/popGlow/…` at your reaction/event sites; call `FXi.step()`
   in the render loop before `renderer.render`.
6. Build the lesson's *mechanic* custom — see "share the plumbing, not the
   physics" above.

## Scientific accuracy

**Read `SCIENCE.md` before adding or changing any visualization.** It's the
rulebook. `MolecularGeometry.md` §1 covers adding any molecule (geometry,
sources, stereochemistry, fidelity tiers, scale families) — it moved out of
SCIENCE.md for length, not because it's optional; §§2–3 polarity and covalent
bonding; §4
rendering caveats; §5 the fx/colour conventions; §6 module architecture.
Water/solvation physics
(hydrogen bonds, ice, emergent properties) is in `WaterSim.md` — it only
applies to the solvation apps. The bonding builder's,
the amino-acid page's, and the macromolecule gallery's own rules live in
their own header comments (`molecule-builder.html`, `covalent-drag.js`/
`ionic-drag.js`; `aminoacid-lab.html` and the relevant `molecules.js` amino-
acid comments; `macromolecule-lab.html` and the relevant `molecules.js`/
`glycolysis-lab.html` spec comments), not in SCIENCE.md — they're
page-internal, not cross-cutting.
Before adding a **new molecule**, read MolecularGeometry.md §1.4 — it sets how much fidelity a molecule
owes based on the claim it makes (prop / contrast / subject), and requires that
any chemical claim ship with a `check-molecules.js` assertion in the same commit.
Pedagogical exaggerations (enlarged bond lengths for legibility, neutral vs.
zwitterion forms) must stay **explicit in comments**.

## Run / test locally

Serve the folder — the dev server gives live reload and, importantly, sends
`no-store`, so you never debug a fix that is already correct on disk:

```bash
node tools/dev-server.js        # http://localhost:8817/ — zero dependencies
```

Save a file and the browser reloads; a **CSS-only** change swaps the stylesheet
in place instead, so the scene keeps its camera angle, its selection and its
toggle states while you tune the paper texture.

The reload client is injected into HTML **responses**, never written to disk —
this repo publishes to GitHub Pages straight from the working tree, so anything
committed ships. To see exactly what deploys, serve it statically instead:

```bash
python3 -m http.server 8818     # no injection, no live reload
```

`check-molecules.js` prints every spec's bond angles, audits each declared
`stereo` / `topology` / `chirality` claim (MolecularGeometry.md §1.4 lists them), and **exits FAIL if
any bonded pair's spheres merge** — a merged pair buries the stick inside the
atoms, which is how a double bond can be correctly tagged yet render as nothing.
Run it after any geometry change.
Note: when a browser tab is backgrounded, `requestAnimationFrame` pauses —
so an automated screenshot may freeze on the last painted frame. Verify logic by
driving the page's functions directly rather than trusting a single screenshot.

**Set the viewport before judging any layout.** The agent browser pane keeps
whatever size it was last given, which is often phone-width — and every page here
is built for a landscape stage beside a 372px panel, with a `@media
(max-width:920px)` breakpoint that stacks it. Judging a wide layout in a narrow
pane produces confident, wrong conclusions: call `resize_window` to roughly
1440x900 first. It cuts both ways — widening the pane is what exposed a canvas
rendering at twice its box on a retina screen, which was invisible at 496px.

Layout — framing, spacing, rotation, captions — the human tests in the browser.

`tools/check-docs.js` audits what the docs *claim*

**check-molecules, check-pages and check-pdb run automatically on commit.**
`npm i` in `demos/` points `core.hooksPath` at `.githooks/`, whose `pre-commit`
runs them whenever a commit touches `demos/`. Install or re-install it by hand
with `npm run hooks`; disable it with `git config --unset core.hooksPath`; skip
it once with `git commit --no-verify`.

Each one is gated on the files it can actually judge, so most commits run one
or none. **`check-pdb` fires on `pdb.js`, `folding/folding.js`, `palette.js`,
`folding/tools/bake-fold.js`, `tools/check-pdb.js` and anything in `pdb/`** — the solver and the baked
trajectory are in that list deliberately: it once fired only on `*.pdb` and so
sat out a commit that changed both the solver and `folding/data/1VII.fold.bin`, which is
exactly the pair the staleness assertion exists to catch. Widen the pattern
alongside any new derived artefact, because nothing about a stale one is
visible from the page that plays it.



There is still no CI. To run them by hand:

```bash
node check-molecules.js && node tools/check-docs.js && node tools/check-pages.js
```

Those three are offline and have no dependencies. **`tools/check-handedness.js`
is separate on purpose** — it needs the network and RDKit (`npm i`), and it is
the only thing here that can catch a *global mirror*, which every internal check
is blind to by construction (MolecularGeometry.md §1.3). Run it after touching a ring builder or
adding a stereocentre:

```bash
npm i && node tools/check-handedness.js
```

_`old/` holds earlier prototypes and notes — reference only, not loaded by any page._

## Copywriting
Guidance for writing user=facing text: Be a tutor for a high school student learning biology.  Be concise, don't overcomplicate it. Prioritize core concepts.  If there's more info, steer me toward asking more questions. Your goal is to guide curiosity and inquiry, not to dump out a textbook of facts.




