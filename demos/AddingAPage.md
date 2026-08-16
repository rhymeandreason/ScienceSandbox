# Adding a lesson page

Reference for building a new `*-lab.html` page: shared modules, script load order, and the checklist. Everyday lesson edits don't need this file — see `CLAUDE.md`.

## Shared modules

Only `molecules.js` + `scene.js` are universal. A page loads what it uses, in this order — each script assumes the ones above it:

```html
<link rel="stylesheet" href="sandbox.css">   <!-- loads the fonts too; after icons, before page <style> -->
...
<script src=".../three.min.js"></script>
<script src="palette.js"></script>     <!-- always, first — atom/bond colours + radii -->
<script src="molecules.js"></script>   <!-- always — PALETTE, SCALE, VIEW + the empty registry -->
<script src="skel.js"></script>        <!-- only if the page shows a Skel-built molecule -->
<script src="mol-solvation.js"></script>   <!-- the specs: load the domains this page shows -->
<script src="mol-monomers.js"></script>    <!-- the domains this page shows -->
<script src="scene.js"></script>       <!-- always — Stage.create + molecule builder -->
<script src="molview.js"></script>     <!-- if the page shows one molecule three ways -->
<script src="fx.js"></script>          <!-- if the page fires any effect -->
<script src="annotate.js"></script>    <!-- if the page labels parts of a model -->
<script src="atomkit.js"></script>     <!-- bonding builder only -->
<script src="covalent-drag.js"></script>  <!-- bonding builder only -->
<script src="ionic-drag.js"></script>     <!-- bonding builder only -->
<script> /* page-specific code */ </script>
```

* **A page loads only the molecules it shows.** `molecules.js` is the registry (`PALETTE`, `SCALE`, `VIEW`, `DOMAINS`) and holds no specs; the `mol-*.js` files assign into it. Wrong script tags = `MOLECULES.x is undefined`, not a silent wrong render.
* Order is `molecules.js` → `skel.js` → `mol-*.js`. `skel.js` has no dependencies (real ångströms, never sees `SCALE`); the domain files need both, and `mol-contrast.js` mirrors alanine out of `mol-monomers.js`.
* **Spec coordinates on disk are real ångströms** (`units:'angstrom'`); `register()` applies `SCALE` once on the way in. The family-A solvation set is `units:'scene'` — already display units. Why: MolecularGeometry.md §1.5; `check-molecules.js` requires the field.

**Two kinds of page.** Most load `scene.js` + MolLib. The folding pages (`folding-lab`, `folding-lab-ribbon`, `hemoglobin-lab`) draw *deposited* coordinates through `scene.js` too, but load `palette.js`/`molecules.js` for `PALETTE` alone, no `mol-*.js`: every coordinate is a real ångström and display radii are `PALETTE.radii / SCALE`, computed in the page.

`aminoacid-lab` loads `mol-small` (not `mol-solvation`) because it needs a real water beside the residues — **family-B pages use `mol-small.js`, solvation pages use `mol-solvation.js`.** They define the same keys and `register()` throws if both load.

<!-- ENUM: update when a module is added, or an exported entry point is added/renamed. -->

| Module | Exposes | Rules |
| --- | --- | --- |
| `palette.js` | `MolPalette` — atom/bond colours, display radii. Loads before `molecules.js`, which re-exports it as `MolLib.PALETTE` | own header |
| `molecules.js` | `MolLib` = `PALETTE` · `MOLECULES` (registry, empty until a domain file loads) · `SCALE` · `VIEW` · `DOMAINS` · `register` · `atomIndex`/`resolveAtoms` | `MolecularGeometry.md` §1 |
| `skel.js` | `SkelLib` = `Skel` + `GL`/`AR` bond-length tables (**real ångströms**) + ring/chain scaffolds + the **nucleotide fragments** `adenine`, `ribosyl` and `Skel.phosphoUnit` (one link of a phosphate chain), which thirteen catalog rows share. Builder, not data; no dependencies | MolecularGeometry.md §1.2, §1.5 |
| `residues.js` | `ResidueLib` = `SIDE` (twenty side chains in each residue's N–CA–C frame) + `graft` + `TYPES`. **Generated** by `tools/bake-residues.js` — real ångströms, no `SCALE`, no MolLib. Not a domain file: it holds pieces of molecules | own header |
| `mol-solvation.js` · `mol-monomers.js` · `mol-glycolysis.js` · `mol-contrast.js` · `mol-compare.js` | nothing — each `register()`s its specs into `MolLib.MOLECULES` | MolecularGeometry.md §1.2, §1.5 |
| `mol-small.js` | the same substances as `mol-solvation.js` but **to scale** (family B). Either/or — `register()` throws if both load | own header, MolecularGeometry.md §1.5 |
| `haworth.js` | `Haworth` = `haworth` (sugar spec → Haworth-projection SVG) + `findRings` + `faces`. Derived from the spec's own geometry — ring finder, committed `names`, substituent face from the ring normal — so nothing is hand-placed and a regenerated spec redraws correctly. Never goes through SMILES, which sidesteps the rooted-SMILES anomer bug. `contrast-lab.html` only | own header |
| `lib-node.js` | the whole library for Node checkers, via `MolLib.DOMAINS`. No page loads it | own header |
| `scene.js` | `Stage.create/measure/frame/buildMolecule/atom/bond/removeAtoms/setOptionalH` | §6 |
| `fx.js` | `FX.create` → `spawnRing`, `popGlow`, `protonHop`, `settleShimmer`, `step` | §5 |
| `molview.js` | `MolView.create` → `show`, `setMode`, `setHighlight`, `setOptionalH`, `step`, `fit`, `snap`, `field`/`has`, `viewEuler` (the pose on screen folded back into a spec's `view:`), `resetPose`, `setSpin`, `atDeclaredView`. `defaultView()` is the ONLY source of an opening angle — a spec's declared `view:` where it has one, a PCA pose where it does not; the turntable is off unless a page switches it on · plus `usableAround`, `flatPose`, `VIEW_FIELD`. Three views of one molecule (3D · the same spheres on the diagram's layout · the drawn diagram) and the morph between them. Loads after `scene.js`; `smiles-drawer` only if the page shows the Diagram view | own header |
| `atomkit.js` | `AtomKit.create` → `dot`, `cloud`, `label`, `charge`, `cel`, `DOT_GAP` | own header |
| `annotate.js` | `Annot.create` → `add`, `step`, `play`, `setMode`, `show`, `clear`. Callouts pinned to a model: dot on the atom, fanned label, three reveal modes. DOM over the canvas, not sprites | own header |
| `covalent-drag.js` / `ionic-drag.js` | `CovalentDrag` / `IonicDrag`, each driven by a `RECIPES` table | own header |
| `folding/actin.js` | `ActinLib` = `parseCA` + `screwOf` + `extend` + `encode`/`decode`. `folding-lab.html` rungs 4–5 only. Real ångströms | own header |
| `folding/villin.js` | `VillinLib` = `parseCA`/`segment` (PAE → rigid domains)/`poses` + `encode`/`decode`. `folding-lab.html` act 3 only. Real ångströms | own header |
| `hemoglobin/tube.js` | `TubeLib` = `chain` (Cα trace + secondary structure → one continuous tube mesh per chain, helix collapsed onto its axis so there is no corkscrew) + `triangles` (cost of a setting without building it) + `relax` + `DEFAULTS`. The **abstract** multi-chain style — a tetramer is 4 draw calls, not \~240. Real ångströms in, plain `BufferGeometry` out, no materials, THREE passed in | `docs/rendering-modules.md` |
| `hemoglobin/surface.js` | `SurfLib` = `decode` (SES1 buffer → `{geo, head, res, nVert, nTri}`) + `chainOf`/`numberOf`, the per-vertex residue lookups that let a page paint one residue onto the skin. Browser half of the format `tools/bake-surface.js` writes; the format itself is specified in that file's header, next to the writer. **A surface is baked, never solved in the page** — SES on 2HHB took 3Dmol 5.7 s | `docs/rendering-modules.md` |
| `folding/ribbon.js` | `RibbonLib` = `build` (Cα trace + secondary structure → ribbon `BufferGeometry`) + `dssp`/`parseBackbone` (Kabsch & Sander, needs N/CA/C/O) + `assign`/`detect` + `HP35_HELICES`. Real ångströms, no materials. **Called per frame on live fold coordinates** — a ribbon is only as trustworthy as the solver frame under it | own header |
| `hemoglobin/hbfold.js` | `HbFold` = `decode` (baked fold → Cα trace, secondary structure, H-bonds, sequence, the **focus segment**'s backbone, `at(t)`). `hemoglobin-lab.html` only. Real ångströms, no THREE | own header |
| `folding/folding.js` | `FoldLib` = `parse`/`hbonds`/`extended` + `orient` + `SCHEDULE` (the act boundary, bisected by the page) + `Folder` (constrained relaxation + `bake`). Real ångströms, renders nothing. **Constraints hold the peptide bond trans and give each H-bond its deposited rise** | own header |
| `sandbox.css` | cream paper, torn-edge panel, `#app` grid, stage/panel chrome — and the `@import` that loads **all** webfonts, so no page carries a font `<link>` | own header |
| `tools/sdf2spec.js` | PubChem 3D → spec, amino-acid backbone order | `tools/README.md` |
| `tools/sdf2spec-generic.js` | the same for non-amino-acids; orients on the ring plane | `tools/README.md` |
| `tools/sdf/` | the committed PubChem inputs (9 `.sdf`) for every `path:'pubchem'` spec | `tools/sdf/README.md` |
| `tools/catalog/` | the molecule catalog (265 rows) with the `CID` / `Has 3D` / `Stereo` columns the resolver added. Committed for `tools/sdf/`'s reason: a build-time input no page loads, costing \~400 network requests to re-derive | `tools/catalog/README.md` |
| `tools/resolve-catalog.js` | resolves `tools/catalog/`'s NAMES to CIDs and asks whether each has a 3D conformer — **needs the network**, like `check-handedness.js`. Never picks between candidates; marks a row `Ambiguous` and reports every CID. Self-tests against the `src.cid` values already committed here | own header |
| `tools/spec2smiles.js` | regenerates every contrast spec's `smiles` through RDKit. `--write` puts it in the spec instead of printing it to paste | `tools/README.md` |
| `tools/specfile.js` | writes a generated field back into the spec that owns it, for the two bakers above. Replaces a field that is already there and refuses to invent a position for one that is not; verifies every write by re-loading the library | own header |
| `tools/bake-flat2d.js` | `--write` as above. The 2D LAYOUT (`flat2d`) each `flat:true` spec's atoms slide onto — RDKit's depiction coordinates, returned in the spec's own atom order so no graph matching is needed, scaled to the molecule's own mean bond | own header |
| `folding/tools/bake-actin.js` | reduces 9ZZI + 9JUS (6.1 MB) to `pdb/actin.bin` (27 KB): one protomer, the screw that stacks it, the complex's Cα traces. The page rebuilds the other twelve | own header |
| `folding/tools/bake-villin.js` | derives villin's domains from the 1.9 MB PAE, samples the eight arrangements, runs `RibbonLib.dssp` over the full backbone → `folding/data/AF-P02640-villin.poses.bin`. Neither the PAE nor the backbone reaches the browser, so the DSSP happens here | own header |
| `hemoglobin/tools/chain.js` | pulls one chain out of 2HHB and builds the amide hydrogens it doesn't deposit — `FoldLib.parse` reads no chain ID, and `hbonds` needs an H an X-ray structure lacks | own header |
| `hemoglobin/tools/bake-unfold.js` | **the baker.** Unfolds 2HHB chain B and reverses the film, holding helices rigid at first → `hemoglobin/data/2HHB-B.fold.bin` (403 KB, \~60 s), keyframes resampled by arc length so playback is even. **Re-run after any change to it or `folding/folding.js`** | own header |
| `hemoglobin/tools/bake-hb.js` | **superseded**, refuses to run. Kept because it owns the file format (including v2's `FOCUS`, residues 4-18) and records four traps: bond lengths without 1-3 angle pairs crush Cα–Cα to 1.83 Å; per-frame projection jolts a smooth stretch; omega is a 1-4 torsion nothing else pins; de-clashing without holding H-bonds dissolves the helices | own header |
| `hemoglobin/tools/bake-quaternary.js` | level 4's other three chains: 2HHB A/C/D Cα traces + four heme irons, rotated into the trajectory frame via `FoldLib.orient()` → `hemoglobin/data/2HHB-quaternary.json` (12 KB). JSON because 428 points need no second decoder | own header |
| `hemoglobin/tools/check-hb.js` | the \~85 assertions behind the haemoglobin page: staleness, quantisation, both decoders agreeing, DSSP vs deposited HELIX records, the opening close-up, **level 1's flat chain** (generated in the page, so the checker lifts the generator out of the HTML — including `placeAtom`'s torsion SIGN), and **helix handedness**, the one global mirror an internal check can catch | own header |
| `folding/tools/bake-fold.js` | solves the villin fold once → `folding/data/1VII.fold.bin` (442 KB, 185 keyframes). Both folding pages play that file. **Re-run after any change to the solver, schedule or H-bond cutoffs** | own header |
| `tools/bake-residues.js` | writes `residues.js` by MEASURING the twenty side chains off committed structures — 2HHB for nineteen, 9ZZI for isoleucine. Keeps one real instance each (the medoid), never an average of rotamers | own header |
| `tools/check-residues.js` | re-bakes and compares, then asserts chemistry: heavy-atom counts, ring closure, proline's ring onto the backbone N, and **L-configuration** — one of two checks that catch a mirror | own header |
| `tools/check-handedness.js` | the ONLY check that catches a global mirror; needs `npm i` + network. Covers glycolysis too, deriving SMILES from spec geometry where none is committed | own header, MolecularGeometry.md §1.3 |

Easy to get wrong, invisible from the API:

* **Spec coordinates are canonical.** Never bake a viewing angle in with `Skel.rotate()` — declare `view:VIEW.pyranose` (radians `[x,y,z]`, applied by `Stage.buildMolecule`), and add new angles to `VIEW` so specs share a view by name, not by copied constants. An angle only ONE spec uses stays inline (`atpSkel`): a `VIEW` entry with a single user is a name nobody can reuse.
* **A declared `view:` is what the student sees. A page's own rotation is an OFFSET from it, and must be zero at rest.** `Stage.buildMolecule` bakes `view:` into the meshes and leaves the group free for the page; compose anything on top of it at rest and the spec's angle is one nobody ever sees, while the file, the checkers and the docs all still say otherwise. `contrast-lab.html` holds to it by construction (`rotation.y=spin` — *0 at rest*); `molecule-viewer.html` broke it twice, once with a PCA opening pose and once by carrying a pose across its derivation switch, and nothing caught either — the composition happens in THREE at runtime, so no offline checker can see it — and neither can a runtime one, since anything downstream of the spec derives the "expected" angle from the same field it is checking. So it is **one code path, not an assertion**: `molview.js`'s `defaultView()` is the only place an opening angle comes from, and it returns identity for a spec that declares a view precisely because `buildMolecule` has already baked it in. Tune an angle by dragging in `molecule-viewer.html` and pasting its copy button's output.
* **Specs come in two bond-length families; a page shows one.** Nothing fails a
  build — `register()` throws only for the `mol-small`/`mol-solvation` pair, so
  mixing `mol-solvation` with a family-B domain renders as a plausible size
  difference rather than an error. Your script tags are the only signal.
  MolecularGeometry.md §1.5.
* **`mol-*.js` coordinates are real ångströms** unless `units:'scene'`. Pasting display-scale numbers into an `angstrom` spec is a silent 1.9× that reads as a styling choice. `tools/sdf2spec*.js` emit ångströms, so their output pastes in.
* **Never hand-tune a camera.** `Stage.measure` + `Stage.frame` solve distance from the real frustum; a hand-picked `r:` is right only at the size it was tuned for. Pass `orbit:false` on side-by-side pages — orbiting brings one molecule nearer and perspective magnifies it.
* **`Stage.bond` takes a bond order** (`[i,j,2]` → double bond). `setOptionalH` toggles *visibility* of the `optH` C–H's, so it can never resurrect a reaction-removed atom.
* **`mol-compare.js` holds controls, not lessons.** `atpSkel` and `nadhSkel` are the same molecules as `atp` and `nadh`, built the other way, and they earn their place by matching the SAME `check-handedness.js` reference — that is what makes a visible difference between them method rather than a mistake. That reference is **derived from `compare:{against:…}`**, not typed: a control added without one would leave the tool reporting every spec passing while never having looked at the new one. A control whose partner has no reference fails the run. The pair is deliberate: NADH is twice the molecule, so it shows the schematic's cost GROWING with size (1.01 Å out of plane and 21.4 Å across, against the conformer's 1.91 and 12.0). Its own domain file because `glycolysis-lab` and `macromolecule-lab` load `mol-glycolysis.js` and must not pay for a spec they never draw.
* **A `flat2d` layout is positions, not decoration.** molecule-viewer.html moves the real atoms onto it, so a stale one flies them to the wrong places in front of the student. Heavy atoms, in spec order, real ångströms; `register()` does not scale it, so the page applies `SCALE` itself. Re-run `tools/bake-flat2d.js` after touching the spec — `check-molecules.js` fails on the length, the scale and any overlap.
* **`atomkit.js` owns what a student learns to *read***, never how a bond forms.
* **`glycolysis-lab.html` carries a second simulation.** The mass-action modal is a plain 2D canvas — no Three.js, no MolLib, no spec — because its dots stand for *populations*; looking like molecules would make a geometry claim nothing backs. Its physics: molecules draw an energy from the thermal distribution and react when they clear a barrier, `EA` forward and `EA + ΔE` back. **`EA` is a legibility knob** (it makes about half of arrivals react), so the claims resting on it are asserted by `tools/check-massaction.js`, which lifts the constants out of the HTML rather than copying them.
* Drag modules are *mechanics*, not plumbing. Same mechanic, different constants → a recipe in the same file; different mechanic → new file.

## Architecture principle: **share the plumbing, not the physics**

Deliberately **no monolithic `engine.js`**. What each shared module does and does not own, the test for whether something belongs in one, and the same split a level down inside the bonding builder: **`SCIENCE.md` §6.**

## Adding a new page

1. **Start from a built page, not a blank one.** Match by information complexity, not paradigm: single concept → `water-lab.html` or `molecule-builder.html`; multi-step or multi-stage → `hemoglobin-lab.html`; side-by-side → `contrast-lab.html`. Copy its layout, panel structure and copy tone wholesale — first-draft quality comes from reusing those choices.

2. Copy the head (fonts/icons + `sandbox.css` + the scripts you need) and the `#app` skeleton from `aminoacid-lab.html`, or `contrast-lab.html` for the no-FX, no-loop shape. **Load only the `mol-*.js` domains your page shows**, after `molecules.js` (and after `skel.js` if any needs the builder).

3. Add new molecules to the right `mol-*.js` — never to `molecules.js`. A molecule in the wrong domain is one some page pays for and never draws. Prefer `tools/sdf2spec.js` over typing coordinates, give it a `src:`, then run the checkers. A new domain file also goes in `MolLib.DOMAINS`. **A molecule that makes a chemical claim ships with the assertion that checks it, in the same commit** (MolecularGeometry.md §1.4 rule 2) — an undeclared claim is how every sugar here spent months being the wrong enantiomer.

4. `const {scene,camera,renderer,root,cam,applyCam,resize}=Stage.create(canvas,{...});` then `const FXi=FX.create(THREE,root,camera);` — skip FX only if the page fires nothing (`contrast-lab.html`; `macromolecule-lab.html` still rings on selection).

5. Build with `Stage.buildMolecule(spec,{center:true})`, or a page-specific builder if you need outlines/physics `userData`. Then frame the camera:

   ```js
   const g = Stage.buildMolecule(MolLib.MOLECULES.glucose, {center:true});
   root.add(g);
   const m = Stage.measure(MolLib.MOLECULES.glucose);
   Stage.frame(camera, cam, [{x:0, y:0, rxz:m.rxz, hy:m.hy}]);  applyCam();
   ```

   Re-call `Stage.frame` from a `ResizeObserver` — it solves against `camera.aspect`, so it's right only once the canvas is measured. Leave the spec's orientation alone: `view:` already carries the chosen angle. Raising the camera (`phi≈1.3`) is fine; *swinging* it (`theta`) is not on a side-by-side page.

6. Fire `FXi.spawnRing/popGlow/…` at event sites; call `FXi.step()` in the render loop before `renderer.render`.

7. Build the lesson's *mechanic* custom — see the architecture principle above.
