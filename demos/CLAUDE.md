# Working in demos/

Self-contained browser 3D molecular simulations for Biology 101. One HTML page
per lesson over a few shared modules. No build, no framework — Three.js r128
(global) + vanilla JS.

- Model the science accurately, especially atom and molecule geometry.
- Let the human test visual changes in the browser; tell her what to click.
- Be extremely concise everywhere, including commit messages. Sacrifice grammar
  for concision.

## Pages (lessons)

<!-- ENUM: add a row when a \*-lab.html is added or repurposed. -->

**Status**: *featured lesson* = real, student-facing, browser-tested; breaking one
is a regression, and it's listed under "Featured" on the top-level `index.html`.
*prototype* = in progress, not held to that bar. *reference* = superseded, kept
as fallback or worked example — don't read it unless asked. *test* = an
evaluation record, not a lesson.

| Page | Lesson | Paradigm | Status |
| --- | --- | --- | --- |
| `water-lab.html` | Structure of water → the universal solvent (H-bonds, ice, temperature, salt dissolving) | solvation physics | featured lesson |
| `molecule-builder.html` | Build a bond by hand: drag atoms together and watch valence, geometry and charge decide what you get (H₂O · CH₄ · NH₃→NH₄⁺ · CO₂ · N₂ · HCl · NaCl · KCl · MgCl₂) | bonding assembly | featured lesson |
| `hemoglobin-lab.html` | **The protein-structure lesson.** All four levels on one molecule: a β chain folds 1→3, heme settles into the pocket, then the other three chains dock | folding animation | featured lesson |
| `contrast-lab.html` | Spot the difference: six near-identical pairs (glucose/galactose · ribose/deoxyribose · purine/pyrimidine · L-/D-alanine · maltose/cellobiose · palmitic/palmitoleic acid) where one feature is the whole lesson | comparison gallery | featured lesson |
| `molecule-lab.html` | Dissolving sandbox: polar/nonpolar/ionic solutes, CO₂ → carbonic acid → bicarbonate + pH | solvation physics + reactions | prototype |
| `aminoacid-lab.html` | Build a peptide: amino acids join by dehydration synthesis, releasing water | molecular assembly | prototype |
| `glycolysis-lab.html` | Ten steps in five stages: carbon bookkeeping, PFK-1 as the committed step, the one oxidation, the three irreversible steps. ATP is drawn as a molecule losing and regaining its γ phosphate (schematic fallback behind "Show full molecules"); the reversibility note opens a mass-action modal — a second simulation with its own physics (below) | pathway | prototype |
| `macromolecule-lab.html` | The four classes side by side: one monomer each (glucose · palmitic acid · alanine · AMP), at true relative size, functional groups callable out | comparison gallery | prototype |
| `protein-lab.html` | Superseded PDB viewer — the ChemDoodle (GPL) worked example, see its header | PDB structure viewer | reference |
| `folding-lab-ribbon.html` | Levels 1→3 on villin, level 4 only pointed at. Superseded by `hemoglobin-lab` — villin is 36 residues and one chain, so it could never finish the sentence | folding animation | reference |
| `folding-lab.html` | Villin headpiece collapses from an extended chain, then zooms out. Superseded by `folding-lab-ribbon.html` | folding animation | reference |
| `folding/ribbon-test.html` | Test bench for `folding/ribbon.js` | evaluation scratch | test |
| `viewer-compare.html` | ChemDoodle vs 3Dmol.js — settled: neither adopted | evaluation scratch | test |
| `molstar/` | Six-stage Mol\* evaluation — settled: not adopted | evaluation scratch | test |

## Shared modules

Only `molecules.js` + `scene.js` are universal. A page loads what it uses, in
this order — each script assumes the ones above it:

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
<script src="annotate.js"></script>    <!-- if the page labels parts of a model -->
<script src="atomkit.js"></script>     <!-- bonding builder only -->
<script src="covalent-drag.js"></script>  <!-- bonding builder only -->
<script src="ionic-drag.js"></script>     <!-- bonding builder only -->
<script> /* page-specific code */ </script>
```

- **A page loads only the molecules it shows.** `molecules.js` is the registry
  (`PALETTE`, `SCALE`, `VIEW`, `DOMAINS`) and holds no specs; the `mol-*.js`
  files assign into it. Wrong script tags = `MOLECULES.x is undefined`, not a
  silent wrong render.
- Order is `molecules.js` → `skel.js` → `mol-*.js`. `skel.js` has no
  dependencies (real ångströms, never sees `SCALE`); the domain files need both,
  and `mol-contrast.js` mirrors alanine out of `mol-monomers.js`.
- **Spec coordinates on disk are real ångströms** (`units:'angstrom'`);
  `register()` applies `SCALE` once on the way in. The family-A solvation set is
  `units:'scene'` — already display units. Why: MolecularGeometry.md §1.5;
  `check-molecules.js` requires the field.

<!-- ENUM: update when any page's <script> tags change.  -->

| Page | Loads |
| --- | --- |
| `water-lab` | palette, molecules, mol-solvation, scene, fx, atomkit |
| `molecule-lab` | palette, molecules, mol-solvation, scene, fx |
| `molecule-builder` | palette, molecules, mol-solvation, scene, fx, atomkit, covalent-drag, ionic-drag |
| `aminoacid-lab` | palette, molecules, mol-monomers, mol-small, scene, fx |
| `glycolysis-lab` | palette, molecules, skel, mol-glycolysis, scene, fx |
| `macromolecule-lab` | palette, molecules, skel, mol-monomers, mol-glycolysis, scene, fx |
| `contrast-lab` | palette, molecules, skel, mol-monomers, mol-glycolysis, mol-contrast, haworth, scene |
| `protein-lab` | pdb, vendor/chemdoodle/ChemDoodleWeb |
| `folding-lab` | palette, molecules, scene, fx, folding/folding, folding/villin, folding/actin |
| `folding-lab-ribbon` | palette, molecules, scene, fx, folding/folding, folding/villin, folding/actin, folding/ribbon |
| `hemoglobin-lab` | palette, molecules, scene, fx, annotate, folding/ribbon, residues, hemoglobin/hbfold |

Rows are explicit — no row inherits from the one above it.

**Three kinds of page, not two.** Most load `scene.js` + MolLib. The folding
pages (`folding-lab`, `folding-lab-ribbon`, `hemoglobin-lab`) draw *deposited*
coordinates through `scene.js` too, but load `palette.js`/`molecules.js` for
`PALETTE` alone, no `mol-*.js`: every coordinate is a real ångström and display
radii are `PALETTE.radii / SCALE`, computed in the page. `protein-lab` is the
third kind and the only one: vendored ChemDoodle Web, no Three.js, no MolLib —
**GPLv3, which makes any page loading it GPLv3** (`RenderingLibraries.md`), and
audited by `tools/check-pdb.js`. Don't add a second ChemDoodle page.

**Design reasoning for the folding pages lives in the source headers**:
`folding/folding.js` (H-bonds, hydrophobic core, solver constraints),
`folding/villin.js` (why act 3 is an AlphaFold prediction), `folding/ribbon.js`
(HELIX vs DSSP; why a cartoon exposes solver bugs), `folding/actin.js` (the
measured screw extending 5 subunits to 13). Trajectories are precomputed and
committed (`folding/data/*.bin`) — re-run the matching `folding/tools/bake-*.js`
or `check-folding.js` fails.

`aminoacid-lab` loads `mol-small` (not `mol-solvation`) because it needs a real
water beside the residues — **family-B pages use `mol-small.js`, solvation pages
use `mol-solvation.js`.** They define the same keys and `register()` throws if
both load.

<!-- ENUM: update when a module is added, or an exported entry point is added/renamed. -->

| Module | Exposes | Rules |
| --- | --- | --- |
| `palette.js` | `MolPalette` — atom/bond colours, display radii. Loads before `molecules.js`, which re-exports it as `MolLib.PALETTE` | own header |
| `molecules.js` | `MolLib` = `PALETTE` · `MOLECULES` (registry, empty until a domain file loads) · `SCALE` · `VIEW` · `DOMAINS` · `register` · `atomIndex`/`resolveAtoms` | `MolecularGeometry.md` §1 |
| `skel.js` | `SkelLib` = `Skel` + `GL`/`AR` bond-length tables (**real ångströms**) + ring/chain scaffolds. Builder, not data; no dependencies | MolecularGeometry.md §1.2, §1.5 |
| `residues.js` | `ResidueLib` = `SIDE` (twenty side chains in each residue's N–CA–C frame) + `graft` + `TYPES`. **Generated** by `tools/bake-residues.js` — real ångströms, no `SCALE`, no MolLib. Not a domain file: it holds pieces of molecules | own header |
| `mol-solvation.js` · `mol-monomers.js` · `mol-glycolysis.js` · `mol-contrast.js` | nothing — each `register()`s its specs into `MolLib.MOLECULES` | MolecularGeometry.md §1.2, §1.5 |
| `mol-small.js` | the same substances as `mol-solvation.js` but **to scale** (family B). Either/or — `register()` throws if both load | own header, MolecularGeometry.md §1.5 |
| `lib-node.js` | the whole library for Node checkers, via `MolLib.DOMAINS`. No page loads it | own header |
| `scene.js` | `Stage.create/measure/frame/buildMolecule/atom/bond/removeAtoms/setOptionalH` | §6 |
| `fx.js` | `FX.create` → `spawnRing`, `popGlow`, `protonHop`, `settleShimmer`, `step` | §5 |
| `atomkit.js` | `AtomKit.create` → `dot`, `cloud`, `label`, `charge`, `cel`, `DOT_GAP` | own header |
| `annotate.js` | `Annot.create` → `add`, `step`, `play`, `setMode`, `show`, `clear`. Callouts pinned to a model: dot on the atom, fanned label, three reveal modes. DOM over the canvas, not sprites | own header |
| `covalent-drag.js` / `ionic-drag.js` | `CovalentDrag` / `IonicDrag`, each driven by a `RECIPES` table | own header |
| `folding/actin.js` | `ActinLib` = `parseCA` + `screwOf` + `extend` + `encode`/`decode`. `folding-lab.html` rungs 4–5 only. Real ångströms | own header |
| `folding/villin.js` | `VillinLib` = `parseCA`/`segment` (PAE → rigid domains)/`poses` + `encode`/`decode`. `folding-lab.html` act 3 only. Real ångströms | own header |
| `folding/ribbon.js` | `RibbonLib` = `build` (Cα trace + secondary structure → ribbon `BufferGeometry`) + `dssp`/`parseBackbone` (Kabsch & Sander, needs N/CA/C/O) + `assign`/`detect` + `HP35_HELICES`. Real ångströms, no materials. **Called per frame on live fold coordinates** — a ribbon is only as trustworthy as the solver frame under it | own header |
| `hemoglobin/hbfold.js` | `HbFold` = `decode` (baked fold → Cα trace, secondary structure, H-bonds, sequence, the **focus segment**'s backbone, `at(t)`). `hemoglobin-lab.html` only. Real ångströms, no THREE | own header |
| `folding/folding.js` | `FoldLib` = `parse`/`hbonds`/`extended` + `orient` + `SCHEDULE` (the act boundary, bisected by the page) + `Folder` (constrained relaxation + `bake`). Real ångströms, renders nothing. **Constraints hold the peptide bond trans and give each H-bond its deposited rise** | own header |
| `sandbox.css` | cream paper, torn-edge panel, `#app` grid, stage/panel chrome — and the `@import` that loads **all** webfonts, so no page carries a font `<link>` | own header |
| `tools/sdf2spec.js` | PubChem 3D → spec, amino-acid backbone order | `tools/README.md` |
| `tools/sdf2spec-generic.js` | the same for non-amino-acids; orients on the ring plane | `tools/README.md` |
| `tools/sdf/` | the committed PubChem inputs (9 `.sdf`) for every `path:'pubchem'` spec | `tools/sdf/README.md` |
| `tools/spec2smiles.js` | regenerates every contrast spec's `smiles` through RDKit | `tools/README.md` |
| `folding/tools/bake-actin.js` | reduces 9ZZI + 9JUS (6.1 MB) to `pdb/actin.bin` (27 KB): one protomer, the screw that stacks it, the complex's Cα traces. The page rebuilds the other twelve | own header |
| `folding/tools/bake-villin.js` | derives villin's domains from the 1.9 MB PAE, samples the eight arrangements, runs `RibbonLib.dssp` over the full backbone → `folding/data/AF-P02640-villin.poses.bin`. Neither the PAE nor the backbone reaches the browser, so the DSSP happens here | own header |
| `hemoglobin/tools/chain.js` | pulls one chain out of 2HHB and builds the amide hydrogens it doesn't deposit — `FoldLib.parse` reads no chain ID, and `hbonds` needs an H an X-ray structure lacks | own header |
| `hemoglobin/tools/bake-unfold.js` | **the baker.** Unfolds 2HHB chain B and reverses the film, holding helices rigid at first → `hemoglobin/data/2HHB-B.fold.bin` (403 KB, ~60 s), keyframes resampled by arc length so playback is even. **Re-run after any change to it or `folding/folding.js`** | own header |
| `hemoglobin/tools/bake-hb.js` | **superseded**, refuses to run. Kept because it owns the file format (including v2's `FOCUS`, residues 4-18) and records four traps: bond lengths without 1-3 angle pairs crush Cα–Cα to 1.83 Å; per-frame projection jolts a smooth stretch; omega is a 1-4 torsion nothing else pins; de-clashing without holding H-bonds dissolves the helices | own header |
| `hemoglobin/tools/bake-quaternary.js` | level 4's other three chains: 2HHB A/C/D Cα traces + four heme irons, rotated into the trajectory frame via `FoldLib.orient()` → `hemoglobin/data/2HHB-quaternary.json` (12 KB). JSON because 428 points need no second decoder | own header |
| `hemoglobin/tools/check-hb.js` | the ~85 assertions behind the haemoglobin page: staleness, quantisation, both decoders agreeing, DSSP vs deposited HELIX records, the opening close-up, **level 1's flat chain** (generated in the page, so the checker lifts the generator out of the HTML — including `placeAtom`'s torsion SIGN), and **helix handedness**, the one global mirror an internal check can catch | own header |
| `folding/tools/bake-fold.js` | solves the villin fold once → `folding/data/1VII.fold.bin` (442 KB, 185 keyframes). Both folding pages play that file. **Re-run after any change to the solver, schedule or H-bond cutoffs** | own header |
| `tools/bake-residues.js` | writes `residues.js` by MEASURING the twenty side chains off committed structures — 2HHB for nineteen, 9ZZI for isoleucine. Keeps one real instance each (the medoid), never an average of rotamers | own header |
| `tools/check-residues.js` | re-bakes and compares, then asserts chemistry: heavy-atom counts, ring closure, proline's ring onto the backbone N, and **L-configuration** — one of two checks that catch a mirror | own header |
| `tools/check-handedness.js` | the ONLY check that catches a global mirror; needs `npm i` + network. Covers glycolysis too, deriving SMILES from spec geometry where none is committed | own header, MolecularGeometry.md §1.3 |

Easy to get wrong, invisible from the API:

* **Spec coordinates are canonical.** Never bake a viewing angle in with
  `Skel.rotate()` — declare `view:VIEW.pyranose` (radians `[x,y,z]`, applied by
  `Stage.buildMolecule`), and add new angles to `VIEW` so specs share a view by
  name, not by copied constants.
* **Specs come in two bond-length families**; a page shows one.
  MolecularGeometry.md §1.5.
* **`mol-*.js` coordinates are real ångströms** unless `units:'scene'`. Pasting
  display-scale numbers into an `angstrom` spec is a silent 1.9× that reads as a
  styling choice. `tools/sdf2spec*.js` emit ångströms, so their output pastes in.
* **Never hand-tune a camera.** `Stage.measure` + `Stage.frame` solve distance
  from the real frustum; a hand-picked `r:` is right only at the size it was
  tuned for. Pass `orbit:false` on side-by-side pages — orbiting brings one
  molecule nearer and perspective magnifies it.
* **`Stage.bond` takes a bond order** (`[i,j,2]` → double bond).
  `setOptionalH` toggles *visibility* of the `optH` C–H's, so it can never
  resurrect a reaction-removed atom.
* **`atomkit.js` owns what a student learns to *read***, never how a bond forms.
* **`glycolysis-lab.html` carries a second simulation.** The mass-action modal is
  a plain 2D canvas — no Three.js, no MolLib, no spec — because its dots stand
  for *populations*; looking like molecules would make a geometry claim nothing
  backs. Its physics: molecules draw an energy from the thermal distribution and
  react when they clear a barrier, `EA` forward and `EA + ΔE` back. **`EA` is a
  legibility knob** (it makes about half of arrivals react), so the claims
  resting on it are asserted by `tools/check-massaction.js`, which lifts the
  constants out of the HTML rather than copying them.
* Drag modules are *mechanics*, not plumbing. Same mechanic, different constants
  → a recipe in the same file; different mechanic → new file.

## Architecture principle: **share the plumbing, not the physics**

Deliberately **no monolithic `engine.js`**. What each shared module does and does
not own, the test for whether something belongs in one, and the same split a
level down inside the bonding builder: **`SCIENCE.md` §6.**

## Adding a new page

0. **Start from a featured lesson, not a blank page.** Match by information
   complexity, not paradigm: single concept → `water-lab.html` or
   `molecule-builder.html`; multi-step or multi-stage → `hemoglobin-lab.html`;
   side-by-side → `contrast-lab.html`. Copy its layout, panel structure and copy
   tone wholesale — first-draft quality comes from reusing those choices.
1. Copy the head (fonts/icons + `sandbox.css` + the scripts you need) and the
   `#app` skeleton from `aminoacid-lab.html`, or `contrast-lab.html` for the
   no-FX, no-loop shape. **Load only the `mol-*.js` domains your page shows**,
   after `molecules.js` (and after `skel.js` if any needs the builder).
2. Add new molecules to the right `mol-*.js` — never to `molecules.js`. A
   molecule in the wrong domain is one some page pays for and never draws. Prefer
   `tools/sdf2spec.js` over typing coordinates, give it a `src:`, then run the
   checkers. A new domain file also goes in `MolLib.DOMAINS`. **A molecule that
   makes a chemical claim ships with the assertion that checks it, in the same
   commit** (MolecularGeometry.md §1.4 rule 2) — an undeclared claim is how every
   sugar here spent months being the wrong enantiomer.
3. `const {scene,camera,renderer,root,cam,applyCam,resize}=Stage.create(canvas,{...});`
   then `const FXi=FX.create(THREE,root,camera);` — skip FX only if the page fires
   nothing (`contrast-lab.html`; `macromolecule-lab.html` still rings on selection).
4. Build with `Stage.buildMolecule(spec,{center:true})`, or a page-specific
   builder if you need outlines/physics `userData`. Then frame the camera:

   ```js
   const g = Stage.buildMolecule(MolLib.MOLECULES.glucose, {center:true});
   root.add(g);
   const m = Stage.measure(MolLib.MOLECULES.glucose);
   Stage.frame(camera, cam, [{x:0, y:0, rxz:m.rxz, hy:m.hy}]);  applyCam();
   ```

   Re-call `Stage.frame` from a `ResizeObserver` — it solves against
   `camera.aspect`, so it's right only once the canvas is measured. Leave the
   spec's orientation alone: `view:` already carries the chosen angle. Raising
   the camera (`phi≈1.3`) is fine; *swinging* it (`theta`) is not on a
   side-by-side page.
5. Fire `FXi.spawnRing/popGlow/…` at event sites; call `FXi.step()` in the render
   loop before `renderer.render`.
6. Build the lesson's *mechanic* custom — see the architecture principle above.

## Scientific accuracy

**Read `SCIENCE.md` before adding or changing any visualization** — it's the
rulebook. `bio-rendering-thorough.md` covers which diagrams a lesson needs.

`MolecularGeometry.md` §1 covers adding a molecule — geometry, sources,
stereochemistry, fidelity tiers, scale families. `SCIENCE.md` carries the rest:
§§2–3 polarity and covalent bonding, §4 rendering caveats, §5 fx/colour
conventions, §6 module architecture.

Before adding a **new molecule**, read `MolecularGeometry.md` §1.4 — it sets how
much fidelity a molecule owes for the claim it makes (prop / contrast / subject)
and requires a `check-molecules.js` assertion in the same commit. Pedagogical
exaggerations (stretched bonds, neutral vs zwitterion) stay **explicit in
comments**.

Water/solvation physics is in `WaterSim.md` (solvation apps only). Each page
documents itself in its own comments.

## Run / test locally

```bash
node tools/dev-server.js        # http://localhost:8817/ — zero dependencies
```

Live reload, and `no-store` so you never debug a fix that's already correct on
disk. **It serves the repo root, not `demos/`**, because that's what GitHub Pages
publishes — the local URL is the URL that ships. `/` is the lesson index; a
lesson is `/demos/water-lab.html`. `demos/index.html` only redirects up.

Save a file and the browser reloads; a **CSS-only** change swaps the stylesheet in
place, so the scene keeps its camera, selection and toggles.

The reload client is injected into responses, never written to disk — this repo
publishes to Pages straight from the working tree, so anything committed ships.
To see exactly what deploys:

```bash
python3 -m http.server 8818     # from the repo root; no injection, no reload
```

`check-molecules.js` prints every spec's bond angles, audits each declared
`stereo` / `topology` / `chirality` claim, and **fails if any bonded pair's
spheres merge** — a merged pair buries the stick, which is how a double bond can
be correctly tagged and render as nothing. Run it after any geometry change.

Two browser gotchas: a backgrounded tab pauses `requestAnimationFrame`, so an
automated screenshot may freeze on the last frame — drive the page's functions
directly instead of trusting one shot. And **set the viewport before judging
layout**: `resize_window` to ~1440x900. Every page here is a landscape stage
beside a 372px panel with a `@media (max-width:920px)` stack, and judging it in a
phone-width pane produces confident wrong conclusions. It cuts both ways —
widening the pane is what exposed a canvas rendering at twice its box on retina.

Framing, spacing, rotation, captions: the human tests in the browser.
`tools/check-docs.js` audits what the docs *claim*.

**check-molecules, check-pages and check-pdb run automatically on commit.**
`npm i` in `demos/` points `core.hooksPath` at `.githooks/`. Reinstall with
`npm run hooks`; disable with `git config --unset core.hooksPath`; skip once with
`git commit --no-verify`.

Each checker is gated on the files it can judge, so most commits run one or none.
**Each derived artefact is gated on the code that can make it stale, not on its
own folder** — that's why the patterns look wider than the checkers do:

| checker | fires on | cost |
| --- | --- | --- |
| `check-molecules.js` | `molecules.js`, `skel.js`, `mol-*.js`, `tools/sdf/` | 0.1 s |
| `check-pages.js` | any `*.html`, plus the registry files it reads | 0.2 s |
| `check-pdb.js` | `pdb.js`, `tools/check-pdb.js`, anything in `pdb/` | 0.3 s |
| `check-folding.js` | anything under `folding/`, plus `palette.js` |  |
| `check-residues.js` | `residues.js`, either `tools/*-residues.js`, `2HHB.pdb`, `9ZZI.pdb` | 0.2 s |
| `check-massaction.js` | `glycolysis-lab.html`, `tools/check-massaction.js` — the modal's physics lives *in* the page | 1.5 s |
| `check-hb.js` | anything under `hemoglobin/`, **plus `hemoglobin-lab.html`**, plus `folding/folding.js` and `folding/ribbon.js` — **two modes** | 0.3 s or 57 s |

`check-hb.js` full run re-bakes the unfold (56 of its 57 s); `--quick` skips that
and two assertions needing the un-quantised trajectory, leaving 56 of 59 running
off the committed file in 0.3 s. The hook picks **full** when `bake-unfold.js`,
`bake-hb.js`, `folding/folding.js` or `folding/ribbon.js` is staged, **quick**
otherwise.

**The hook prints only on skip or failure** — a silent checker ran and passed.
Don't read silence as "it didn't fire". Widen a pattern alongside any new derived
artefact; nothing about a stale one is visible from the page that plays it.

No CI. By hand:

```bash
node check-molecules.js && node tools/check-docs.js && node tools/check-pages.js && node tools/check-residues.js && node tools/check-massaction.js
```

Those are offline and dependency-free. **`tools/check-handedness.js` is separate
on purpose** — it needs the network and RDKit, and it is the only global-mirror
check (why: MolecularGeometry.md §1.3). Run it after touching a ring builder or
adding a stereocentre:

```bash
npm i && node tools/check-handedness.js
```

*`old/` holds earlier prototypes and notes — reference only, loaded by no page.*

## Copywriting

Write as a tutor for a college Bio 101 student. Concise, no repetition. The text
supports the visuals and interaction — prioritize core concepts, and steer the
reader toward asking more rather than dumping facts.

**A number in user-facing text must be read from the data at render time.** A
typed number is a claim nothing checks and a re-bake silently falsifies. **Read
it from where the fact lives, not the nearest lookalike** — counting helices in a
trajectory's `ss` gives five because adjacent ones merge, so the eight the page
says is carried across from the HELIX records by the baker.
