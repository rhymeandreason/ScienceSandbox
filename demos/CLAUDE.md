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
| `contrast-lab.html` | Spot the difference: six near-identical pairs (glucose/galactose · ribose/deoxyribose · purine/pyrimidine · L-/D-alanine · maltose/cellobiose · palmitic/palmitoleic acid) where one feature is the whole lesson | comparison gallery |

## Shared modules

Only `molecules.js` + `scene.js` are universal. A page loads what it uses, and the
order matters — each script assumes the ones above it:

```html
<link rel="stylesheet" href="sandbox.css">   <!-- after fonts/icons, before page <style> -->
...
<script src=".../three.min.js"></script>
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
units. §1.5 has the why, and `check-molecules.js` requires the field.

<!-- ENUM: update when any page's <script> tags change. See "Keeping the docs true". -->
| Page | Loads |
|---|---|
| `water-lab`, `molecule-lab` | molecules, mol-solvation, scene, fx |
| `molecule-builder` | molecules, mol-solvation, scene, fx, atomkit, covalent-drag, ionic-drag |
| `aminoacid-lab` | molecules, mol-monomers, mol-small, scene, fx |
| `glycolysis-lab` | molecules, skel, mol-glycolysis, scene, fx |
| `macromolecule-lab` | molecules, skel, mol-monomers, mol-glycolysis, scene, fx |
| `contrast-lab` | molecules, skel, mol-monomers, mol-glycolysis, mol-contrast, haworth, scene |

Rows are explicit — no row inherits from the one above it any more, because the
sets stopped being nested once pages began loading different domains.

`aminoacid-lab` loads `mol-small` because dehydration synthesis releases a real
water molecule and that water has to sit correctly beside the residues. **A
family-B page that needs a small molecule loads `mol-small.js`; only the
solvation pages load `mol-solvation.js`.** The two define the same keys and
`register()` throws if both are present.

<!-- ENUM: update when a module is added, or an exported entry point is added/renamed. -->
| Module | Exposes | Rules |
|---|---|---|
| `molecules.js` | `MolLib` = `PALETTE` (colours/radii) · `MOLECULES` (the registry, empty until a domain file loads) · `SCALE` · `VIEW` · `DOMAINS` (the manifest) · `register` (applies the display scale) · `atomIndex`/`resolveAtoms` | `SCIENCE.md` §1 |
| `skel.js` | `SkelLib` = `Skel` + the `GL`/`AR` bond-length tables (**real ångströms**) + ring/chain scaffolds. The builder, not data — and it has no dependencies at all | §1.2, §1.5 |
| `mol-solvation.js` · `mol-monomers.js` · `mol-glycolysis.js` · `mol-contrast.js` | nothing — each calls `register()` to add its specs to `MolLib.MOLECULES` | §1.2, §1.5 |
| `mol-small.js` | the same substances as `mol-solvation.js` but **to scale** (family B). Either/or with it — `register()` throws if both load | own header, §1.5 |
| `lib-node.js` | the whole library for Node checkers, by walking `MolLib.DOMAINS`. No page loads it | own header |
| `scene.js` | `Stage.create/measure/frame/buildMolecule/atom/bond/removeAtoms/setOptionalH` | §10 |
| `fx.js` | `FX.create` → `spawnRing`, `popGlow`, `protonHop`, `settleShimmer`, `step` | §9 |
| `atomkit.js` | `AtomKit.create` → `dot`, `cloud`, `label`, `charge`, `cel`, `DOT_GAP` | own header |
| `covalent-drag.js` / `ionic-drag.js` | `CovalentDrag` / `IonicDrag`, each driven by a `RECIPES` table | own header |
| `sandbox.css` | cream paper, torn-edge panel, fonts, `#app` grid, stage/panel chrome | — |
| `tools/sdf2spec.js` | PubChem 3D → spec, amino-acid backbone order | `tools/README.md` |
| `tools/sdf2spec-generic.js` | the same for non-amino-acids; orients on the ring plane | `tools/README.md` |
| `tools/sdf/` | the committed PubChem inputs (8 `.sdf`) for every `path:'pubchem'` spec | `tools/sdf/README.md` |
| `tools/spec2smiles.js` | regenerates every contrast spec's `smiles` through RDKit, sugars included | `tools/README.md` |
| `tools/check-handedness.js` | the ONLY check that catches a global mirror — needs `npm i` + network | own header, §1.3 |

Things that are easy to get wrong and are not visible from the API:

- **A spec's coordinates are canonical.** Never bake a viewing angle into them
  with `Skel.rotate()` — declare `view:VIEW.pyranose` (radians `[x,y,z]`, applied
  by `Stage.buildMolecule`), and add new angles to the `VIEW` table so two specs
  share a view by name rather than by copying three constants.
- **Specs come in two bond-length families** and a page should show only one. §1.5.
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
what belongs in a shared module: `SCIENCE.md` §10.**

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
   it, in the same commit** (SCIENCE.md §1.4 rule 2). This is not advisory: an
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
rulebook. §1 covers adding any molecule (geometry, sources, stereochemistry,
fidelity tiers, scale families); §§2–8 chemistry and the solvation physics;
§9 the fx/colour conventions; §10 module architecture. The bonding builder's,
the amino-acid page's, and the macromolecule gallery's own rules live in
their own header comments (`molecule-builder.html`, `covalent-drag.js`/
`ionic-drag.js`; `aminoacid-lab.html` and the relevant `molecules.js` amino-
acid comments; `macromolecule-lab.html` and the relevant `molecules.js`/
`glycolysis-lab.html` spec comments), not in SCIENCE.md — they're
page-internal, not cross-cutting.
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

**The three offline checkers run automatically on commit.** `npm i` in `demos/`
points `core.hooksPath` at `.githooks/`, whose `pre-commit` runs them whenever a
commit touches `demos/`. Install or re-install it by hand with `npm run hooks`;
disable it with `git config --unset core.hooksPath`; skip it once with
`git commit --no-verify`. The goal is that nobody *forgets*, not that nobody can
decide.

It checks the working tree, not the staged content, so a partially-staged commit
is checked as what is on disk. And it never runs `check-handedness.js` — network
plus a dev dependency does not belong in a commit path.

There is still no CI. To run them by hand:

```bash
node check-molecules.js && node tools/check-docs.js && node tools/check-pages.js
```

Those three are offline and have no dependencies. **`tools/check-handedness.js`
is separate on purpose** — it needs the network and RDKit (`npm i`), and it is
the only thing here that can catch a *global mirror*, which every internal check
is blind to by construction (§1.3). Run it after touching a ring builder or
adding a stereocentre:

```bash
npm i && node tools/check-handedness.js
```

_`old/` holds earlier prototypes and notes — reference only, not loaded by any page._

## Keeping the docs true

These docs are the only record of *why* a constant, geometry, or module
boundary is what it is, so a stale one actively misleads. Every doc error this
project has shipped was the same shape — **an enumeration that grew a new
member and wasn't updated.** Most of those are now caught automatically:

```bash
node tools/check-docs.js && node tools/check-pages.js
```

`check-docs.js` audits the per-page script table, file references, and `§n`
references against the filesystem and `SCIENCE.md`'s real headings. A file a
doc names *on purpose* that doesn't exist (`engine.js`, TESTING.md's
proposals) goes in the script's `KNOWN_ABSENT` map so it's asserted absent
instead of flagged missing. `check-pages.js` runs each page's scripts in a
fresh context and fails if it names a molecule its `mol-*.js` set doesn't
provide — `check-docs.js` proves the table matches the tags, this proves the
tags are *enough*.

Neither can check whether prose is *true* — that's on the reader:

> **If your change adds a member to a set, find every enumeration of that set
> and update it in the same commit.** A doc claim gets asserted the same way a
> chemical claim does (§1.4, rule 2): in the commit that makes it true.

**The enumerations, and what invalidates each.** ✓ = `check-docs.js` catches it,
so you do not have to remember; the unmarked rows are the ones that need you.

| Enumeration | Goes stale when you… | |
|---|---|---|
| `CLAUDE.md` → per-page script table | change any page's `<script>` tags | ✓ |
| a page's `mol-*.js` set vs the molecules it names | use a new molecule on a page | ✓ |
| `MolLib.DOMAINS` manifest | add a `mol-*.js` domain file | ✓ (paths) |
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

**Checklist for the unchecked ones:** new page → Pages table (+ a `##`
`SCIENCE.md` section only if it constrains shared code or another page —
page-internal decisions go in a header comment instead). New molecule → §1.4
(tier, claim) + §1.5 (family) + the assertion, same commit — §1.4 rule 2 isn't
optional. New claim type in `check-molecules.js` → §1.4's table *and* the
script's header; they've drifted apart once already. Changed a constant with a
reason → the reason lives in the doc, not the commit message.

**Delete rather than hedge**, and **retire a story once a checker replaces
it.** A rule that no longer holds gets removed, not softened; a bug that's now
mechanically caught (merged spheres, doc/file mismatches) gets its war story
cut to a one-line rule, since the checker is the better documentation — it
can't go stale. A bug that's only caught when someone opts in (`stereo:`,
`chirality:` — §1.4) keeps its story, because the prose is what argues for
opting in. Anything still unenforced (scale families, *cis*/*trans*, whether
prose is true) keeps its story as the only defence. History earns space only
when a decision was reversed and the reversal isn't otherwise obvious (§1.5 is
the model).

Where a fact belongs follows from **which edit invalidates it**: one file → a
comment in that file; several → a doc, never both — the `stereo:` vocabulary
drifted precisely because it lived in two places. And write for an agent, not
a newcomer: skip prose that restates what the code already shows; spend words
on intent, rejected alternatives, and cross-file invariants instead.

## Later
glycolysis-lab ending fork — pyruvate ×2 sitting there, two doors: O₂ present → Krebs, absent → fermentation. Not built; it's the hook to the next lesson.
