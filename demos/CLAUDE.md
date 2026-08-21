# Working in demos/

Self-contained browser 3D molecular simulations for Biology 101. One HTML page per lesson over a few shared modules. No build, no framework — Three.js r128 (global) + vanilla JS.

* Model the science accurately, especially atom and molecule geometry.
* Let the human test visual changes in the browser; tell her what to click.
* Be extremely concise everywhere, including commit messages. Sacrifice grammar for concision.

## Pages (lessons)

<!-- ENUM: Only add to this chart if a page is a featured lesson -->

**Status**: *featured lesson* = real, student-facing, browser-tested; breaking one is a regression, and it's listed under "Featured" on the top-level `index.html`. *prototype* = in progress, not held to that bar. *reference* = superseded, kept as fallback or worked example — don't read it unless asked. *test* = an evaluation record, not a lesson — disposable, may get deleted once it's served its purpose. *internal tool* = not a lesson either, but kept in active use (e.g. to pick a molecule's default rotation) — don't delete it like a test.

| Page | Lesson | Status |
| --- | --- | --- |
| `water-lab.html` | Structure of water → the universal solvent (H-bonds, ice, temperature, salt dissolving), with an AI tutor: the lesson's text lives on the model as `annotate.js` callouts, and an ask box takes the sidebar | featured lesson |
| `molecule-builder.html` | Build a bond by hand: drag atoms together and watch valence, geometry and charge decide what you get (H₂O · CH₄ · NH₃→NH₄⁺ · CO₂ · N₂ · HCl · NaCl · KCl · MgCl₂) | featured lesson |
| `hemoglobin-lab.html` | **The protein-structure lesson.** All four levels on one molecule: a β chain folds 1→3, heme settles into the pocket, then the other three chains dock | featured lesson |
| `contrast-lab.html` | Spot the difference: six near-identical pairs (glucose/galactose · ribose/deoxyribose · purine/pyrimidine · L-/D-alanine · maltose/cellobiose · palmitic/palmitoleic acid) | prototype |
| `molecule-lab.html` | Dissolving sandbox: polar/nonpolar/ionic solutes, CO₂ → carbonic acid → bicarbonate + pH | prototype |
| `solvation-lab.html` | The forces **between** molecules, where `molecule-builder` stops. One card built (salt in water: hydration shells, water wedges the pair apart, the electron counts never move), two named (the H-bond alone · methane, where nothing happens) | prototype |
| `aminoacid-lab.html` | Build a peptide: amino acids join by dehydration synthesis, releasing water | test |
| `glycolysis-lab.html` | Ten steps in five stages. Everything is rendered as molecules. Animations for each step. the user interacts on the molecule. Hosts the `massaction/` sim in a modal — a second simulation with its own physics (below) | featured lesson |
| `krebs-lab.html` | The Krebs cycle. Pyruvate oxidation, then eight steps around the ring, with the loop drawn in the sidebar and a second turn played back for the ×2. Where the carbon goes, and why the ATP is beside the point | prototype |
| `membrane-lab.html` | The membrane: what gets through, and what it costs. Five steps — bilayer structure, simple diffusion (O₂), a channel's selectivity, a pump spending ATP, active vs passive transport side by side | featured lesson |
| `design-system.html` | Every token, type step and button in `main.css`, drawn on the stage's own paper. Swatches read their own computed value, so the page cannot claim a colour the token does not hold | internal tool |
| `water-render-debug.html` | Test bench for render styles — a still life of water, an H-bond and the two ions, with colour swatches and the toon/outline switches. Built on Stage's own factories, so a style judged here is the one a lesson renders | test |
| `molecule-viewer.html` | Reference shelf: (ATP · NADH · acetyl-CoA · FADH₂). **Three views of one molecule** — 3D with measured and idealized (skel), then *the same spheres sliding onto the diagram's layout* (`flat2d`), then the drawn diagram (SmilesDrawer over the generated `smiles`). | internal tool |
| `macromolecule-lab.html` | The four classes side by side: one monomer each (glucose · palmitic acid · alanine · AMP), at true relative size, functional groups callable out | test |
| `folding-lab-ribbon.html` | Levels 1→3 on villin. Superseded by `hemoglobin-lab` | reference |
| `folding/ribbon-test.html` | Test bench for `folding/ribbon.js` | test |
| `massaction/massaction-test.html` | Test bench for `massaction/massaction.js` — three mounts, including the barrier slider the enzymes lesson needs and glycolysis never renders | test |
| `kit/kit-test.html` | Test bench for `kit/` — the timeline, the highlight vocabulary, and a camera fit against pixel chrome, with no lesson around them | test |
| `diffusion/diffusion-test.html` | Test bench for `diffusion/diffusion.js` — the only place that module runs until the membrane lesson exists | test |
| `coupling/coupling-test.html` | Test bench for `coupling/coupling.js` — ΔG adds, and it only adds when the two reactions share a molecule | test |
| `lobes/lobes-test.html` | Test bench for `lobes/lobes.js` — lone pairs as teardrops, and which nitrogens on adenine are not acceptors | test |
| `sickle/fibre-test.html` | HbS fibre structure test bench, with SES surface render (HbA vs HbS toggle). No lesson page yet | prototype |

## Making a new lesson

**Load `main.css` before `sandbox.css`.** `main.css` is the design system: tokens (primitive → semantic → domain), the type scale, and the six button shapes. `sandbox.css` is the old shared chrome, being retired into it; because it loads second it still wins wherever the two overlap, so moving a piece across is a deletion rather than an edit. Atom and bond colours are not written in CSS at all: `tokens-from-palette.js` publishes `palette.js` as `--atom-*` / `--bond-*` at load, so a caption and the sphere it names cannot drift. See `design-system.html`.

**Use shared modules.** Every page loads `molecules.js` + `scene.js`; most also load one or more `mol-*.js` domain files. Full script-load order, the module reference table, and the seven-step checklist for building a new page: **`AddingAPage.md`**.

**Above `scene.js` there is `kit/`** — the loop, the resize, the timeline, the highlight vocabulary, and a camera fit that spends *pixels* of caption/tray chrome. It owns no lesson state and no physics; it exists so a new lesson is its mechanic and nothing else. **`kit/README.md`.**

## Architecture principle: **share the plumbing, not the physics**

Deliberately **no monolithic `engine.js`**. What each shared module does and does not own, the test for whether something belongs in one, and the same split a level down inside the bonding builder: **`SCIENCE.md` §6.**

## The primary UX is always a bespoke 3D molecular simulation

A lesson's main stage is a 3D scene built for that lesson, rendered as molecules, interacted with **on the molecule**. That is the lesson.

**`reaction/` is the exception that proves this**: it is a shared module that drives the 3D stage rather than replacing it. A step says `fx:'ox'` and the module owns what that does to the molecule — the verbs, the transfers, the spec geometry — while the lesson keeps its lanes, carriers and ledger. Adding a verb must not touch a page. The cycle added six (`decarb`, `join`, `thioester`, `hydrate`, `dehydro`, `shift`) and changed no lesson but its own. A spec's atom names are read through `host.meta`, because a step can span two domain blocks — pyruvate carries `gly`, the acetyl-CoA it becomes carries `krebs`. `AddingAPage.md`.

**`massaction/`, `diffusion/` and `coupling/` are never the primary UX.** They are 2D abstractions that teach a statistical or thermodynamic point the 3D stage can't make honestly, and they belong behind a `kit/modal.js` side door — a second simulation the student opens when they doubt what the main stage just did, as glycolysis opens `massaction/`. `LESSONS-ROADMAP.md` lists them next to lessons as material, not as the design; don't read that as a stage.

## Scientific accuracy

**Read `SCIENCE.md` before adding a molecule, changing geometry, or changing what a motion implies happened** (a bond forming/breaking, a charge moving) — it's the rulebook: §§2–3 polarity and covalent bonding, §4 rendering caveats, §5 fx/colour conventions, §6 module architecture. Polish on an already-reviewed animation (timing, easing, camera) doesn't need it. `bio-rendering-thorough.md` covers which diagrams a lesson needs.

Before adding a **new molecule**, read `MolecularGeometry.md` §1 — geometry, sources, stereochemistry, scale families, and §1.4's fidelity tiers (prop / contrast / subject), which set how much accuracy the molecule owes for the claim it makes and require a `check-molecules.js` assertion in the same commit. Pedagogical exaggerations (stretched bonds, neutral vs zwitterion) stay **explicit in comments**.

Water/solvation physics is in `WaterSim.md` (solvation apps only).

## Run / test locally

```bash
node tools/dev-server.js        # http://localhost:8817/ — zero dependencies
```

Live reload, and `no-store` so you never debug a fix that's already correct on disk. **It serves the repo root, not `demos/`**, because that's what GitHub Pages publishes — the local URL is the URL that ships. `/` is the lesson index; a lesson is `/demos/water-lab.html`. `demos/index.html` only redirects up.

Save a file and the browser reloads; a **CSS-only** change swaps the stylesheet in place, so the scene keeps its camera, selection and toggles.

**The pages are dependency-free; the tutor is not.** `water-lab`'s ask box calls `api/`, which needs the model SDKs and a key, and neither is in the working tree:

```bash
npm i                           # at the REPO ROOT, not demos/. installs the SDKs api/_providers/ requires
```

Then put the key in `.env.local` **at the repo root** (gitignored, the same file Vercel's CLI reads): `GEMINI_API_KEY=` for the default provider, or `AI_PROVIDER=anthropic` + `ANTHROPIC_API_KEY=`. `GEMINI_MODEL` / `ANTHROPIC_MODEL` override the model. The dev server re-reads it per request, so pasting a key needs no restart, but installing the SDKs does, since the server resolved them at startup. A missing key answers `<KEY> is not set on the server`; a missing `npm i` answers `Cannot find module '@google/genai'`.

The reload client is injected into responses, never written to disk — this repo publishes to Pages straight from the working tree, so anything committed ships. To see exactly what deploys:

```bash
python3 -m http.server 8818     # from the repo root; no injection, no reload
```

`check-molecules.js` prints every spec's bond angles, audits each declared `stereo` / `topology` / `chirality` claim, and **fails if any bonded pair's spheres merge** — a merged pair buries the stick, which is how a double bond can be correctly tagged and render as nothing. Run it after any geometry change.

Two browser gotchas: a backgrounded tab pauses `requestAnimationFrame`, so an automated screenshot may freeze on the last frame — drive the page's functions directly instead of trusting one shot. And **set the viewport before judging layout**: `resize_window` to \~1440x900. These are laptop lessons, and judging one in a phone-width pane produces confident wrong conclusions. It cuts both ways — widening the pane is what exposed a canvas rendering at twice its box on retina.

Framing, spacing, rotation, captions: the human tests in the browser. `tools/check-docs.js` audits what the docs *claim*.

**Checkers run automatically on commit**, each gated to the files it can judge, so most commits run one or none — see `.githooks/pre-commit` for the exact patterns and reasoning. `npm i` in `demos/` points `core.hooksPath` there. Reinstall with `npm run hooks`; disable with `git config --unset core.hooksPath`; skip once with `git commit --no-verify`.

**The hook prints only on skip or failure** — a silent checker ran and passed. Don't read silence as "it didn't fire".

Widen a checker's gate pattern alongside any new derived artefact — nothing about a stale one is visible from the page that plays it.

No CI. By hand:

```bash
node check-molecules.js && node tools/check-docs.js && node tools/check-pages.js && node tools/check-residues.js && node massaction/check-massaction.js && node kit/check-kit.js && node reaction/check-reaction.js && node diffusion/check-diffusion.js && node coupling/check-coupling.js && node lobes/check-lobes.js
```

Those are offline and dependency-free. **`tools/check-handedness.js` is separate on purpose** — it needs the network and RDKit, and it is the only global-mirror check (why: MolecularGeometry.md §1.3). Run it after touching a ring builder or adding a stereocentre:

```bash
npm i && node tools/check-handedness.js
```

## Copywriting

Write as a tutor for a college Bio 101 student. Concise, no repetition. The text supports the visuals and interaction — prioritize core concepts, and steer the reader toward asking more rather than dumping facts.

**A number in user-facing text must be read from the data at render time.** A typed number is a claim nothing checks and a re-bake silently falsifies. **Read it from where the fact lives, not the nearest lookalike** — counting helices in a trajectory's `ss` gives five because adjacent ones merge, so the eight the page says is carried across from the HELIX records by the baker.

**Don’t use em dashes.**

## Working Conventions

You are an engineer who cares about design and making science easy to understand. We want to make beautiful, richly interactive science simulations that are better than what’s out there. Be brave in your recommendations, you are an LLM and work that would take a human a day takes you 15 minutes.

The human uses molecule-viewer.html to manually choose a good default rotation for a molecule. Ask her to do this if you need. Don’t try to rotate dynamically, you can’t see what is happening.

**Don’t write a changelog in a code file’s comments. Comments should be active voice, and only document things that are not obvious from reading the code.**

## Never use these structures:

* "It's not just X — it's Y"
* "Not only X, but Y"
* "This isn't about X. It's about Y."
* "No X. No Y. Just Z."

These mimic insight without providing any.
