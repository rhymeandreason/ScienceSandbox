# Molecule Sandbox — interactive AP Bio chemistry sims

Self-contained, browser-based 3D molecular simulations for AP Bio. Each lesson is
one HTML page sharing a small set of modules. No build step, no framework — plain
Three.js (r128, global style) + vanilla JS.

Let the human test in the browser for visual changes, it's faster than taking screenshots.
Tell her what to do to test the changes.

Try to model scientific accuracy, especially when building atoms and molecules. 
Spheres should never intersect.


## Pages (lessons)

| Page | Lesson | Paradigm |
|---|---|---|
| `water-lab.html` | Structure of water → the universal solvent (H-bonds, ice, temperature, salt dissolving) | solvation physics |
| `molecule-lab.html` | Dissolving sandbox: polar/nonpolar/ionic solutes, CO₂ → carbonic acid → bicarbonate + pH | solvation physics + reactions |
| `aminoacid-lab.html` | Build a peptide: amino acids join by dehydration synthesis, releasing water | molecular assembly |
| `glycolysis-lab.html` | shows 5 steps to emphasize carbon bookkeeping, why does it cost 2 ATP to make ATP | pathway |
| `molecule-builder.html` | Build a bond by hand: drag atoms together and watch valence, geometry and charge decide what you get (H₂O · CH₄ · NH₃→NH₄⁺ · NaCl · KCl) | bonding assembly |
| `macromolecule-lab.html` | The four classes side by side: one monomer each (glucose · palmitic acid · alanine · AMP), at true relative size, with their functional groups callable out | comparison gallery |
| `contrast-lab.html` | Spot the difference: three near-identical pairs (glucose/galactose · ribose/deoxyribose · purine/pyrimidine) where one feature is the whole lesson | comparison gallery |

## Shared modules

Loaded **in this order**, before each page's own `<script>`:

```html
<link rel="stylesheet" href="sandbox.css">   <!-- after fonts/icons, before page <style> -->
...
<script src=".../three.min.js"></script>
<script src="molecules.js"></script>   <!-- MolLib.PALETTE (colours/radii) + MolLib.MOLECULES (specs) -->
<script src="scene.js"></script>       <!-- Stage.create + molecule builder -->
<script src="fx.js"></script>          <!-- FX.create → reaction effects -->
<script src="atomkit.js"></script>     <!-- AtomKit.create → how an atom is DRESSED -->
<script> /* page-specific code */ </script>
```

- **`molecules.js`** — single source of truth for atom/bond colours + radii
  (`MolLib.PALETTE`) and declarative molecule specs (`MolLib.MOLECULES`). Add new
  molecules here. A spec's coordinates are **canonical** — never bake a viewing
  angle into them with `Skel.rotate()`. Declare `view:VIEW.pyranose` (radians
  `[x,y,z]`, applied by `Stage.buildMolecule`) so the numbers describe the
  molecule and not a camera, and so two specs share a view by name rather than by
  copying three constants. Add new entries to the `VIEW` table. **Read the scale-families note at the top of the file first:**
  specs come in two bond-length families (hand-written solvation molecules vs.
  derived real-Å × 1.9 ones), and a page may only show molecules from one of
  them. Full rationale in `SCIENCE.md` §1.
- **`scene.js`** — `Stage.create(canvas, opts)` returns
  `{scene, camera, renderer, root, cam, applyCam, resize}` (renderer/scene/camera/
  orbit/lights/resize boilerplate). Pass `orbit:false` when dragging should turn
  the **models** rather than swing the camera — a side-by-side comparison page
  must not orbit, because orbiting puts one molecule nearer the camera and
  perspective then magnifies it (`contrast-lab.html` does this and drives both
  halves from one shared spin/lean).
  **Presentation helpers — use these instead of hand-tuning a camera:**
  `Stage.measure(spec)` → `{rxz, hy, radius, span}` (a turntable sweeps a
  *cylinder*, so `rxz`/`hy`, not one radius; `span` is real Å);
  `Stage.frame(camera, cam, boxes, {pad, top, bottom})` solves the camera
  distance from the actual frustum, so it stays correct at any viewport — a
  hand-picked `r:` is only right at the size it was tuned for;
  `Stage.buildMolecule(spec, {center:true})` puts the group origin at the
  molecule's middle so it turns on the spot rather than orbiting its build
  origin, and every built molecule gets `rotation.order='YXZ'` so a leaned
  model still spins upright. Also a clean builder: `Stage.buildMolecule`,
  `Stage.atom/bond`, `Stage.removeAtoms`, `Stage.setOptionalH`. Zoom/drag
  side-effects go through `onZoom(r)` / `onDrag()` hooks.
  `Stage.bond` takes a bond **order** — `[i,j,2]` in a spec draws a double bond as
  a pair of sticks. `setOptionalH` shows/hides the nonpolar C–H's a spec lists in
  `optH` (visibility only, so it never resurrects reaction-removed atoms).
- **`fx.js`** — `FX.create(THREE, root, camera)` returns transient reaction effects
  (`spawnRing`, `popGlow`, `protonHop`, `settleShimmer`, …) + `step()` (call once
  per frame in your loop). Purely cosmetic.
- **`atomkit.js`** — `AtomKit.create(THREE)` returns the shared *vocabulary* for
  drawing an atom: electron `dot`s (each in its own atom's colour, with an ink ring
  so it stays legible on that same atom), the soft `cloud`, the element `label`, the
  `charge` badge (`+`, `δ−`), `cel()` for the flat diagram look, and `DOT_GAP` (how
  far an electron floats off the surface — one number, so a dot never sits at a
  different height on nitrogen than on oxygen). Only used by the bonding builder
  today. Anything a student learns to **read** belongs here; anything they learn
  about **bonding** does not.
- **`covalent-drag.js` / `ionic-drag.js`** — the bonding builder's two mechanics,
  each driven by a `RECIPES` table (`CovalentDrag`: core + slots + polarity;
  `IonicDrag`: metal + nonmetal + separation). Page-specific, not plumbing: the
  same mechanic with different constants is a recipe, a different mechanic is a
  different file. See **`SCIENCE.md` §12**.
- **`sandbox.css`** — the shared sketchbook look (cream paper, torn-edge panel,
  fonts, `#app` grid, stage/side-panel chrome). Page-specific rules go in the
  page's own `<style>` after this link.
- **`tools/sdf2spec.js`** — converts a PubChem 3D record into a `MolLib` spec, so
  geometry is derived rather than guessed. The amino acids are generated this way;
  regenerate them instead of hand-editing coordinates. See `tools/README.md`.
- **`tools/sdf2spec-generic.js`** — the same conversion for molecules that are
  **not** amino acids (no fixed backbone order to force). Orients on the ring
  plane when there is a ring, so a pyranose lands face-on. `amp` is generated
  with it.

## Architecture principle: **share the plumbing, not the physics**

There is deliberately **no monolithic `engine.js`**. Lessons fall into distinct
paradigms (solvation, assembly, pathways, gradients) that don't share a simulation
core — only the universal scaffolding is extracted. The two solvation pages keep
their **own** molecule builder (cel outlines, Debug recolour/toon, hydration
`userData`); only the scene *bootstrap* is shared. The bonding builder splits the
same way one level down: covalent and ionic get separate modules because filling a
valence slot and handing an electron over are different mechanics, while water and
methane share one module because they are the same mechanic at two slot counts.
Full rationale in **`SCIENCE.md` §11**, the builder's own rules in **§12**.

## Adding a new page

1. Copy the head (fonts/icons + `sandbox.css` + the four scripts) and the `#app`
   layout skeleton from `molecule-builder.html` (the simplest page).
2. Add any new molecules to `molecules.js` — prefer generating the geometry with
   `tools/sdf2spec.js` over typing coordinates, then run `check-molecules.js`.
3. `const {scene,camera,renderer,root,cam,applyCam,resize}=Stage.create(canvas,{...});`
   then `const FXi=FX.create(THREE,root,camera);` — skip FX entirely if the page
   has no reactions (`contrast-lab.html` does).
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
6. Build the lesson's *mechanic* custom — don't try to unify paradigms.

## Scientific accuracy

**Read `SCIENCE.md` before adding or changing any visualization.** It's the
rulebook: geometry/angles, polarity, H-bonds, reaction/effect/colour conventions
(§9), amino-acid & peptide rules (§10), the module architecture (§11), and the
bonding builder's rules (§12).
Before adding a **new molecule**, read §1 — it sets how much fidelity a molecule
owes based on the claim it makes (prop / contrast / subject), and requires that
any chemical claim ship with a `check-molecules.js` assertion in the same commit.
Pedagogical exaggerations (enlarged bond lengths for legibility, neutral vs.
zwitterion forms) must stay **explicit in comments**.

## Run / test locally

Pages load sibling scripts, so `file://` won't work — serve the folder:

```bash
python3 -m http.server 8817     # then open http://localhost:8817/water-lab.html
```

`check-molecules.js` prints computed bond angles for every spec, audits ring
stereochemistry against a spec's `stereo` declaration (`'all-equatorial'`,
`{axial:[…]}` for a pyranose, `{faces:{…}}` for a furanose — see SCIENCE.md §1),
audits ring **topology** against `topology:{rings:[…], fused:true}`, and **exits FAIL if any
bonded pair's spheres merge** — a merged pair means the stick is
buried inside the atoms and simply won't be visible, which is how a double bond
can be correctly tagged yet render as nothing. Run it after any geometry change.
Note: when a browser tab is backgrounded, `requestAnimationFrame` pauses —
so an automated screenshot may freeze on the last painted frame. Verify logic by
driving the page's functions directly rather than trusting a single screenshot.

Layout — framing, spacing, rotation, captions — has **no** checker; it is
verified by hand in the browser. `TESTING.md` records what a headless one would
take and why the sweep matters (every layout bug here has been conditional on one
angle, one aspect or one toggle state). Nothing runs automatically: there is no
CI and no git hook, so `check-molecules.js` is hand-run too.

_`old/` holds earlier prototypes and notes — reference only, not loaded by any page._

## Later
glycolysis-lab ending fork — pyruvate ×2 sitting there, two doors: O₂ present → Krebs, absent → fermentation. Not built; it's the hook to the next lesson.
