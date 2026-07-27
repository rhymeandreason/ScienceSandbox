# Molecule Sandbox — interactive AP Bio chemistry sims

Self-contained, browser-based 3D molecular simulations for AP Bio. Each lesson is
one HTML page sharing a small set of modules. No build step, no framework — plain
Three.js (r128, global style) + vanilla JS.

Let the human test in the browser for visual changes, it's faster than taking screenshots.

Try to model scientific accuracy, especially when building atoms and molecules. 
Spheres should never intersect.


## Pages (lessons)

| Page | Lesson | Paradigm |
|---|---|---|
| `water-lab.html` | Structure of water → the universal solvent (H-bonds, ice, temperature, salt dissolving) | solvation physics |
| `molecule-lab.html` | Dissolving sandbox: polar/nonpolar/ionic solutes, CO₂ → carbonic acid → bicarbonate + pH | solvation physics + reactions |
| `aminoacid-lab.html` | Build a peptide: amino acids join by dehydration synthesis, releasing water | molecular assembly |
| `glycolysis-lab.html` | shows 5 steps to emphasize carbon bookkeeping, why does it cost 2 ATP to make ATP | pathway |

## Shared modules

Loaded **in this order**, before each page's own `<script>`:

```html
<link rel="stylesheet" href="sandbox.css">   <!-- after fonts/icons, before page <style> -->
...
<script src=".../three.min.js"></script>
<script src="molecules.js"></script>   <!-- MolLib.PALETTE (colours/radii) + MolLib.MOLECULES (specs) -->
<script src="scene.js"></script>       <!-- Stage.create + molecule builder -->
<script src="fx.js"></script>          <!-- FX.create → reaction effects -->
<script> /* page-specific code */ </script>
```

- **`molecules.js`** — single source of truth for atom/bond colours + radii
  (`MolLib.PALETTE`) and declarative molecule specs (`MolLib.MOLECULES`). Add new
  molecules here.
- **`scene.js`** — `Stage.create(canvas, opts)` returns
  `{scene, camera, renderer, root, cam, applyCam, resize}` (renderer/scene/camera/
  orbit/lights/resize boilerplate). Also a clean builder: `Stage.buildMolecule`,
  `Stage.atom/bond`, `Stage.removeAtoms`, `Stage.setOptionalH`. Zoom/drag
  side-effects go through `onZoom(r)` / `onDrag()` hooks.
  `Stage.bond` takes a bond **order** — `[i,j,2]` in a spec draws a double bond as
  a pair of sticks. `setOptionalH` shows/hides the nonpolar C–H's a spec lists in
  `optH` (visibility only, so it never resurrects reaction-removed atoms).
- **`fx.js`** — `FX.create(THREE, root, camera)` returns transient reaction effects
  (`spawnRing`, `popGlow`, `protonHop`, `settleShimmer`, …) + `step()` (call once
  per frame in your loop). Purely cosmetic.
- **`sandbox.css`** — the shared sketchbook look (cream paper, torn-edge panel,
  fonts, `#app` grid, stage/side-panel chrome). Page-specific rules go in the
  page's own `<style>` after this link.
- **`tools/sdf2spec.js`** — converts a PubChem 3D record into a `MolLib` spec, so
  geometry is derived rather than guessed. The amino acids are generated this way;
  regenerate them instead of hand-editing coordinates. See `tools/README.md`.

## Architecture principle: **share the plumbing, not the physics**

There is deliberately **no monolithic `engine.js`**. Lessons fall into distinct
paradigms (solvation, assembly, pathways, gradients) that don't share a simulation
core — only the universal scaffolding is extracted. The two solvation pages keep
their **own** molecule builder (cel outlines, Debug recolour/toon, hydration
`userData`); only the scene *bootstrap* is shared. Full rationale in
**`SCIENCE.md` §11**.

## Adding a new page

1. Copy the head (fonts/icons + `sandbox.css` + the four scripts) and the `#app`
   grid skeleton from `aminoacid-lab.html` (the simplest page).
2. Add any new molecules to `molecules.js` — prefer generating the geometry with
   `tools/sdf2spec.js` over typing coordinates, then run `check-molecules.js`.
3. `const {scene,camera,renderer,root,cam,applyCam,resize}=Stage.create(canvas,{...});`
   then `const FXi=FX.create(THREE,root,camera);`
4. Build molecules with `Stage.buildMolecule(spec)` (assembly pages) **or** a
   page-specific builder if you need outlines/physics `userData`.
5. Fire `FXi.spawnRing/popGlow/…` at your reaction/event sites; call `FXi.step()`
   in the render loop before `renderer.render`.
6. Build the lesson's *mechanic* custom — don't try to unify paradigms.

## Scientific accuracy

**Read `SCIENCE.md` before adding or changing any visualization.** It's the
rulebook: geometry/angles, polarity, H-bonds, reaction/effect/colour conventions
(§9), amino-acid & peptide rules (§10), and the module architecture (§11).
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
stereochemistry against a spec's `stereo` declaration, and **exits FAIL if any
bonded pair's spheres merge** — a merged pair means the stick is
buried inside the atoms and simply won't be visible, which is how a double bond
can be correctly tagged yet render as nothing. Run it after any geometry change.
Note: when a browser tab is backgrounded, `requestAnimationFrame` pauses —
so an automated screenshot may freeze on the last painted frame. Verify logic by
driving the page's functions directly rather than trusting a single screenshot.

_`old/` holds earlier prototypes and notes — reference only, not loaded by any page._

## Later
glycolysis-lab ending fork — pyruvate ×2 sitting there, two doors: O₂ present → Krebs, absent → fermentation. Not built; it's the hook to the next lesson.
