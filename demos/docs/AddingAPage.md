<!-- KIND: recipe — load when building a new page, or when a page needs a module it does not already load. The module table is lookup material: read the row, not the file. -->

# Adding a lesson page

Reference for building a new `*-lab.html` page: shared modules, script load order, and the checklist. Everyday lesson edits don't need this file — see `CLAUDE.md`.

## Reading list

`CLAUDE.md`'s "What to read" table routes by task. This section covers the one
case it cannot: a staged build, where each phase is a different job.

**A staged build reads differently at each stage**, because the phases are
different jobs. Establishing the chemistry is not a repo task and wants no repo
docs; comparing shapes wants the siblings and no chemistry; building wants the
chrome. Give each phase its own two-line list and drop the global one:

| Phase | Read |
| --- | --- |
| Establish the facts (no code) | `CLAUDE.md`'s copywriting section. Nothing else |
| Find where the new lesson does not fit the old shape | the sibling pages and the shared shell. No chemistry |
| Molecules and step data | `MolecularGeometry.md` §1, `SCIENCE.md` §§5-6, the `STEPS` record |
| The page | this file, `pathways.css`, the sibling's chrome |
| Adversarial review | `SCIENCE.md` and the facts, and deliberately **not** the sibling page: a verifier holding the sibling checks whether the new page matches it, which is not the same question as whether it is true |

**If you need a doc this list does not name, stop and say which.** A gap in the
list is invisible from inside a build, and guessing past it is how a rule gets
missed silently.
## Shared modules

Script load order, the module table, the per-module notes, and how to add a
module: **`Modules.md`**. A page loads only the modules it shows, so start from
that file's load-order block and take the rows you need.

## Page traps

* **Spec coordinates are canonical.** Never bake a viewing angle in with `Skel.rotate()` — declare `view:VIEW.pyranose` (radians `[x,y,z]`, applied by `Stage.buildMolecule`), and add new angles to `VIEW` so specs share a view by name, not by copied constants. An angle only ONE spec uses stays inline (`atpSkel`): a `VIEW` entry with a single user is a name nobody can reuse.
* **A declared `view:` is what the student sees. A page's own rotation is an OFFSET from it, and must be zero at rest.** `Stage.buildMolecule` bakes `view:` into the meshes and leaves the group free for the page; compose anything on top of it at rest and the spec's angle is one nobody ever sees, while the file, the checkers and the docs all still say otherwise. `contrast-lab.html` holds to it by construction (`rotation.y=spin` — *0 at rest*); `molecule-viewer.html` broke it twice, once with a PCA opening pose and once by carrying a pose across its derivation switch, and nothing caught either — the composition happens in THREE at runtime, so no offline checker can see it — and neither can a runtime one, since anything downstream of the spec derives the "expected" angle from the same field it is checking. So it is **one code path, not an assertion**: `molview.js`'s `defaultView()` is the only place an opening angle comes from, and it returns identity for a spec that declares a view precisely because `buildMolecule` has already baked it in. Tune an angle by dragging in `molecule-viewer.html` and pasting its copy button's output.
* **Specs come in two bond-length families; a SCENE shows one.** Not a page — a size difference is a claim only where two molecules are drawn under the same camera, so a page whose stages are separate may load both (`tests/cards-cluster.html`). Nothing fails a build, and nothing can: which scene a spec lands in is a runtime fact. Mixing families *inside one scene* renders as a plausible size difference rather than an error, so a page that loads both **says where the tags are** why its scenes never meet. `register()` still throws for the `mol-small`/`mol-solvation` pair, which is a separate rule — they define the same keys, and the loser is overwritten everywhere. MolecularGeometry.md §1.5.
* **`mol-*.js` coordinates are real ångströms** unless `units:'scene'`. Pasting display-scale numbers into an `angstrom` spec is a silent 1.9× that reads as a styling choice. `tools/sdf2spec*.js` emit ångströms, so their output pastes in.
* **Never hand-tune a camera.** `Stage.measure` + `Stage.frame` solve distance from the real frustum; a hand-picked `r:` is right only at the size it was tuned for. Pass `orbit:false` on side-by-side pages — orbiting brings one molecule nearer and perspective magnifies it.
* **`Stage.bond` takes a bond order** (`[i,j,2]` → double bond). `setOptionalH` toggles *visibility* of the `optH` C–H's, so it can never resurrect a reaction-removed atom.
* **`mol-compare.js` holds controls *and* two lesson molecules.** `atpSkel` and `nadhSkel` are the same molecules as `atp` and `nadh`, built the other way, and they earn their place by matching the SAME `check-handedness.js` reference — that is what makes a visible difference between them method rather than a mistake. That reference is **derived from `compare:{against:…}`**, not typed: a control added without one would leave the tool reporting every spec passing while never having looked at the new one. A control whose partner has no reference fails the run. The pair is deliberate: NADH is twice the molecule, so it shows the schematic's cost GROWING with size (1.01 Å out of plane and 21.4 Å across, against the conformer's 1.91 and 12.0). Its own domain file because `macromolecule-lab` loads the pathway file and must not pay for a spec it never draws — but **`glycolysis-lab` draws both**, loading `mol-compare.js` on purpose: a real conformer folds its tail over the γ phosphate and over the nicotinamide C4, which are the exact atoms steps 1/3/6/7/10 are about. So editing a "control" here can change a featured lesson, and no checker says so.
* **A `flat2d` layout is positions, not decoration.** molecule-viewer.html moves the real atoms onto it, so a stale one flies them to the wrong places in front of the student. Heavy atoms, in spec order, real ångströms; `register()` does not scale it, so the page applies `SCALE` itself. Re-run `tools/bake-flat2d.js` after touching the spec — `check-molecules.js` fails on the length, the scale and any overlap.
## Architecture principle: **share the plumbing, not the physics**

Deliberately **no monolithic `engine.js`**. What each shared module does and does not own, the test for whether something belongs in one, and the same split a level down inside the bonding builder: **`SCIENCE.md` §6.**

## Adding a new page

1. **Ask the human what existing page is similar.** Copy its layout and main UI structure wholesale.

2. Copy the head (icons + `main.css` + `sandbox.css` + the scripts you need). **Load only the `mol-*.js` domains your page shows**, after `molecules.js` (and after `skel.js` if any needs the builder).

3. Add new molecules to the right `mol-*.js` — never to `molecules.js`. A molecule in the wrong domain is one some page pays for and never draws. Prefer `tools/sdf2spec.js` over typing coordinates, give it a `src:`, then run the checkers. A new domain file also goes in `MolLib.DOMAINS`. **A molecule that makes a chemical claim ships with the assertion that checks it, in the same commit** (MolecularGeometry.md §1.4 rule 2) — an undeclared claim is how every sugar here spent months being the wrong enantiomer.

4. `const {scene,camera,renderer,root,cam,applyCam,resize}=Stage.create(canvas,{...});` then `const FXi=FX.create(THREE,root,camera);` — skip FX only if the page fires nothing (`contrast-lab.html`; `tests/macromolecule-lab.html` still rings on selection).

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
