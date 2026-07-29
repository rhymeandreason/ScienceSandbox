# Molecule Sandbox — interactive AP Bio chemistry sims

Self-contained, browser-based 3D molecular simulations for AP Bio. Each lesson is
one HTML page sharing a small set of modules. No build step, no framework — plain
Three.js (r128, global style) + vanilla JS.

Let the human test in the browser for visual changes, it's faster than taking screenshots.
Tell her what to do to test the changes.

Try to model scientific accuracy, especially when building atoms and molecules. 
Spheres should never intersect.


## Pages (lessons)

<!-- ENUM: add a row when a *-lab.html is added or repurposed. See "Keeping the docs true". -->
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

Only `molecules.js` + `scene.js` are universal. A page loads what it uses, and the
order matters — each script assumes the ones above it:

```html
<link rel="stylesheet" href="sandbox.css">   <!-- after fonts/icons, before page <style> -->
...
<script src=".../three.min.js"></script>
<script src="molecules.js"></script>   <!-- always — PALETTE (colours/radii) + MOLECULES (specs) -->
<script src="scene.js"></script>       <!-- always — Stage.create + molecule builder -->
<script src="fx.js"></script>          <!-- if the page fires any effect -->
<script src="atomkit.js"></script>     <!-- bonding builder only -->
<script src="covalent-drag.js"></script>  <!-- bonding builder only -->
<script src="ionic-drag.js"></script>     <!-- bonding builder only -->
<script> /* page-specific code */ </script>
```

<!-- ENUM: update when any page's <script> tags change. See "Keeping the docs true". -->
| Page | Loads |
|---|---|
| `contrast-lab` | molecules, scene |
| `water-lab`, `molecule-lab`, `aminoacid-lab`, `glycolysis-lab`, `macromolecule-lab` | + fx |
| `molecule-builder` | + atomkit, covalent-drag, ionic-drag |

<!-- ENUM: update when a module is added, or an exported entry point is added/renamed. -->
| Module | Exposes | Rules |
|---|---|---|
| `molecules.js` | `MolLib.PALETTE` (colours/radii), `MolLib.MOLECULES` (specs), `Skel`, `VIEW` | `SCIENCE.md` §1 |
| `scene.js` | `Stage.create/measure/frame/buildMolecule/atom/bond/removeAtoms/setOptionalH` | §11 |
| `fx.js` | `FX.create` → `spawnRing`, `popGlow`, `protonHop`, `settleShimmer`, `step` | §9 |
| `atomkit.js` | `AtomKit.create` → `dot`, `cloud`, `label`, `charge`, `cel`, `DOT_GAP` | §12 |
| `covalent-drag.js` / `ionic-drag.js` | `CovalentDrag` / `IonicDrag`, each driven by a `RECIPES` table | §12 |
| `sandbox.css` | cream paper, torn-edge panel, fonts, `#app` grid, stage/panel chrome | — |
| `tools/sdf2spec.js` | PubChem 3D → spec, amino-acid backbone order | `tools/README.md` |
| `tools/sdf2spec-generic.js` | the same for non-amino-acids; orients on the ring plane | `tools/README.md` |

Things that are easy to get wrong and are not visible from the API:

- **A spec's coordinates are canonical.** Never bake a viewing angle into them
  with `Skel.rotate()` — declare `view:VIEW.pyranose` (radians `[x,y,z]`, applied
  by `Stage.buildMolecule`), and add new angles to the `VIEW` table so two specs
  share a view by name rather than by copying three constants.
- **Specs come in two bond-length families** and a page may show only one. §1.5.
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
what belongs in a shared module: `SCIENCE.md` §11.**

## Adding a new page

1. Copy the head (fonts/icons + `sandbox.css` + the scripts you need — see the
   table above) and the `#app` layout skeleton from `contrast-lab.html` (the
   smallest page: two scripts, no FX, no simulation loop).
2. Add any new molecules to `molecules.js` — prefer generating the geometry with
   `tools/sdf2spec.js` over typing coordinates, then run `check-molecules.js`.
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
6. Build the lesson's *mechanic* custom — don't try to unify paradigms.

## Scientific accuracy

**Read `SCIENCE.md` before adding or changing any visualization.** It's the
rulebook. §1 covers adding any molecule (geometry, sources, stereochemistry,
fidelity tiers, scale families); §§2–8 chemistry and the solvation physics;
§§9–13 the per-page rules — fx/colour conventions (§9), amino acids (§10),
module architecture (§11), bonding builder (§12), macromolecule gallery (§13).
Before adding a **new molecule**, read §1.4 — it sets how much fidelity a molecule
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
`stereo` / `topology` / `chirality` claim (§1.4 lists them), and **exits FAIL if
any bonded pair's spheres merge** — a merged pair buries the stick inside the
atoms, which is how a double bond can be correctly tagged yet render as nothing.
Run it after any geometry change.
Note: when a browser tab is backgrounded, `requestAnimationFrame` pauses —
so an automated screenshot may freeze on the last painted frame. Verify logic by
driving the page's functions directly rather than trusting a single screenshot.

Layout — framing, spacing, rotation, captions — has **no** checker; it is
verified by hand in the browser. `TESTING.md` records what a headless one would
take and why the sweep matters (every layout bug here has been conditional on one
angle, one aspect or one toggle state).

`tools/check-docs.js` audits what the docs *claim* — see "Keeping the docs true".

Nothing runs automatically: there is no CI and no git hook, so both checkers are
hand-run. The two together:

```bash
node check-molecules.js && node tools/check-docs.js
```

_`old/` holds earlier prototypes and notes — reference only, not loaded by any page._

## Keeping the docs true

These docs are load-bearing: they are the only record of *why* a constant, a
geometry or a module boundary is what it is, so a stale one actively misleads.
Every doc error this project has shipped was the same shape — **an enumeration
that grew a new member and wasn't updated**. Not prose going out of date; a
list, table or index that claims to be complete and silently isn't.

Most of those are now mechanically checked:

```bash
node tools/check-docs.js
```

It audits the per-page script table against the real `<script>` tags, every
file named in a doc against the filesystem, and every `§n` reference against
`SCIENCE.md`'s actual headings (including that no section is missing from
CLAUDE.md's index). A file a doc names *on purpose* that doesn't exist —
`engine.js`, TESTING.md's proposals — goes in the script's `KNOWN_ABSENT` map
with a reason, and is then asserted **absent**: build it and the check fails
until the doc that called it hypothetical is updated.

It cannot check whether prose is *true* — nothing mechanical would have caught
the stale `stereo:` vocabulary. The rest is on the reader:

> **If your change adds a member to a set, find every enumeration of that set
> and update it in the same commit.** A doc claim gets asserted the same way a
> chemical claim does (§1.4, rule 2): in the commit that makes it true.

**The enumerations, and what invalidates each.** ✓ = `check-docs.js` catches it,
so you do not have to remember; the unmarked rows are the ones that need you.

| Enumeration | Goes stale when you… | |
|---|---|---|
| `CLAUDE.md` → per-page script table | change any page's `<script>` tags | ✓ |
| `CLAUDE.md` → `SCIENCE.md` section index | add a `## n.` section to `SCIENCE.md` | ✓ |
| any doc's file references | rename or delete a file | ✓ |
| `CLAUDE.md` → Pages table | add or repurpose a `*-lab.html` | |
| `CLAUDE.md` → module index table | add a module, or add/rename an exported entry point | |
| `SCIENCE.md` §1.2 | add a geometry source or converter | |
| `SCIENCE.md` §1.4 declaration table | teach `check-molecules.js` a new claim type | |
| `SCIENCE.md` §1.4 contrast table | build one of the unbuilt pairs (flip its Built column) | |
| `SCIENCE.md` §1.5 family table | add a spec, or change `SCALE` / the `GL` constants | |
| `SCIENCE.md` §9 effect + colour tables | add an `fx.js` primitive or wire an effect to a new event | |
| `check-molecules.js` header | add a claim type or a new audit | |
| `MolLib.VIEW` table | add a shared viewing angle | |

**Checklist for the unchecked ones:**

- **New page** → Pages table, and a `##` section in `SCIENCE.md` only if the page
  constrains shared code or another page. Decisions internal to the page belong
  in a comment block at the top of the page, where the invalidating edit happens.
- **New molecule** → §1.4 (what tier, what does it assert), §1.5 (which family),
  and the assertion itself, all in one commit. §1.4 rule 2 is not optional.
- **New claim type in `check-molecules.js`** → §1.4's declaration table *and* the
  script's own header. They drifted apart once already.
- **Changed a constant with a reason** → the reason lives in the doc, not the
  commit message. Nobody greps git log for why `SCALE` is 1.9.

**Delete rather than hedge.** A rule that no longer holds should be removed, not
softened — SCIENCE.md's value is that every line in it is currently true. If a
decision was reversed, say so and why; that is the one case where history earns
its space (§1.5 is the model).

### When a checker lands, retire the prose it replaces

The docs carry war stories — the ethanol bond length, the mirrored amino acids,
the family-A glucose — because a bug that could recur is worth more than the
lines it costs. But a story stops earning its space the moment something catches
the bug for you. So:

> **When a rule becomes mechanically enforced, cut its story to the rule.** The
> checker is the better documentation: it can't go stale and it fires without
> being read.

The test is whether enforcement is **unconditional**:

- **Unconditional** — every spec is checked whether or not it opts in (merged
  spheres, non-bonded overlap, doc file references, the script table). Story
  retires; state the rule in one line.
- **Conditional on a declaration** — only checked if someone writes `stereo:` or
  `chirality:` (§1.4). The prose still has to argue for declaring, so the story
  **stays**. This is why §1.3 keeps both incidents at length.
- **Unenforced** — scale families, size-across-hydrogens, *cis*/*trans*, and
  whether any prose is actually true. Story stays, and is the only defence.

**Write for an agent, not for a newcomer.** An agent reads the code accurately
and fast, so prose describing *what the code does* is worse than absent — it goes
stale and gets believed over the source. Spend the words on what code cannot
state: intent, alternatives already rejected, invariants that span files, and
failures that would otherwise be repeated. Mechanism goes in the code.

Where a fact belongs follows from **which edit invalidates it**: one file → a
comment in that file; several → a doc. Never both — the `stereo:` vocabulary
drifted precisely because it lived in two places.

Budget note: **CLAUDE.md is read on every task**, whether or not it's relevant,
so its job is routing and prohibitions — not explanation. `SCIENCE.md` is read on
demand and can afford length; optimise it for navigability instead. If CLAUDE.md
grows in proportion to the number of pages, it is holding something that belongs
in a page comment or a `SCIENCE.md` section.

## Later
glycolysis-lab ending fork — pyruvate ×2 sitting there, two doors: O₂ present → Krebs, absent → fermentation. Not built; it's the hook to the next lesson.
