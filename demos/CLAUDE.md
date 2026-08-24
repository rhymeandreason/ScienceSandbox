<!-- KIND: rulebook — load whole, always. Project rules, the page index, and where every other doc applies. -->

# Working in demos/

Self-contained browser 3D molecular simulations for Biology 101. One HTML page per lesson over a few shared modules. No build, no framework — Three.js r128 (global) + vanilla JS.

* Model the science accurately, especially atom and molecule geometry.
* Let the human test visual changes in the browser; tell her what to click.
* Be extremely concise everywhere, including commit messages. Sacrifice grammar for concision.

## What to read

| Task | Read |
| --- | --- |
| Adding or converting a molecule | `MolecularGeometry.md` §1, and §1.4 for the fidelity tier it owes |
| …and the chemistry it has to obey | `SCIENCE.md` §§2-3, plus the target `mol-*.js` |
| Changing geometry, or what a motion implies happened | `SCIENCE.md` §§2-5 |
| Polish on a reviewed animation (timing, easing, camera) | nothing extra |
| A new page | `AddingAPage.md`, then the sibling page the human names |
| A new step-through pathway lesson | `AddingAPage.md`, `Modules.md`'s load order, `SCIENCE.md` §§5-6, `glycolysis-lab.html`'s `STEPS` table and what reads it |
| Adding or changing a shared module | `Modules.md` |
| A new `reaction/` verb | `reaction/reaction.js`'s header, `reaction/check-reaction.js` |
| A solvation page | `WaterSim.md` |
| The AI tutor, or `api/` | `docs/ai-tutor.md` — design, and the local setup the pages do not need |
| Deciding what to build next | the two roadmaps. This is the only task they serve |

**Every doc in that table lives in `demos/docs/`**; prose names them bare, the way it names a script. `CLAUDE.md` is the one that stays at the top level, because that is where it gets loaded from.

Every `.md` opens with a `KIND:` comment saying when to load it. *rulebook* = invariants, load whole. *recipe* = how to build one kind of thing. *argument* = why this and not that, written for the human; loading one during a build spends context on judgement about priority instead of on the build. **If you need a doc this table does not name, stop and say which** — a gap here is invisible from inside a build, and guessing past it is how a rule gets missed.

## Pages (lessons)

<!-- ENUM: Only add to this chart if a page is a featured lesson. Prototypes and Test pages go on demos/admin.html -->

**Where a page lives says what it is.** The top level holds lessons — featured and prototype — and nothing else; the shared modules are in `lib/` and the shared stylesheets in `css/`. A module that belongs to one folder keeps its stylesheet beside it (`kit/enzyme-blob.css`, `energy/energy.css`); `css/` is only for the sheets more than one folder's pages load. A bench lives beside the module it exercises (`kit/kit-test.html`, `membrane/pump-test.html`); a bench with no module folder of its own goes in `tests/`. `attic/` holds superseded lessons, kept as worked examples and `.vercelignore`d so nothing links a student into one.

**Status**: *featured lesson* = real, student-facing, browser-tested; breaking one is a regression, and it's listed under "Featured" on the top-level `index.html`. *prototype* = in progress, not held to that bar. *reference* = superseded, kept as a fallback or worked example; not listed here either, and don't read one unless asked. *test* = a bench, not a lesson; **test pages are not listed here — `admin.html` is the live index of every page in the repo**, and it is the one that stays current. *internal tool* = not a lesson either, but kept in active use (e.g. to pick a molecule's default rotation) — don't delete it like a test.

| Page | Lesson | Status |
| --- | --- | --- |
| `water-lab.html` | Structure of water → the universal solvent (H-bonds, ice, temperature, salt dissolving), with an AI tutor: the lesson's text lives on the model as `annotate.js` callouts, and an ask box takes the sidebar | featured lesson |
| `molecule-builder.html` | Build a bond by hand: drag atoms together and watch valence, geometry and charge decide what you get (H₂O · CH₄ · NH₃→NH₄⁺ · CO₂ · N₂ · HCl · NaCl · KCl · MgCl₂) | featured lesson |
| `hemoglobin-lab.html` | **The protein-structure lesson.** All four levels on one molecule: a β chain folds 1→3, heme settles into the pocket, then the other three chains dock | featured lesson |
| `contrast-lab.html` | Spot the difference: six near-identical pairs (glucose/galactose · ribose/deoxyribose · purine/pyrimidine · L-/D-alanine · maltose/cellobiose · palmitic/palmitoleic acid) | prototype |
| `molecule-lab.html` | Dissolving sandbox: polar/nonpolar/ionic solutes, CO₂ → carbonic acid → bicarbonate + pH | prototype |
| `solvation-lab.html` | The forces **between** molecules, where `molecule-builder` stops. One card built (salt in water: hydration shells, water wedges the pair apart, the electron counts never move), two named (the H-bond alone · methane, where nothing happens) | prototype |
| `glycolysis-lab.html` | Ten steps in five stages. Everything is rendered as molecules. Animations for each step. the user interacts on the molecule. Hosts the `massaction/` sim in a modal — a second simulation with its own physics (below) | featured lesson |
| `krebs-lab.html` | The Krebs cycle. Pyruvate oxidation, then eight steps around the ring, with the loop drawn in the sidebar and a second turn played back for the ×2. Where the carbon goes, and why the ATP is beside the point | prototype |
| `fermentation-lab.html` | Where pyruvate goes with no O₂. Two branches on tabs (lactate, one step; ethanol, two), and the claim that the product is the byproduct: the ledger is a NAD⁺ balance carried in from glycolysis, and it lands on zero | prototype |
| `membrane-lab.html` | The membrane: what gets through, and what it costs. Five steps — bilayer structure, simple diffusion (O₂), a channel's selectivity, a pump spending ATP, active vs passive transport side by side | featured lesson |
| `design-system.html` | Every token, type step and button in `main.css`, drawn on the stage's own paper. Swatches read their own computed value, so the page cannot claim a colour the token does not hold | internal tool |
| `molecule-viewer.html` | Reference shelf: (ATP · NADH · acetyl-CoA · FADH₂). **Three views of one molecule** — 3D with measured and idealized (skel), then *the same spheres sliding onto the diagram's layout* (`flat2d`), then the drawn diagram (SmilesDrawer over the generated `smiles`). | internal tool |
| `sickle/fibre-test.html` | HbS fibre structure test bench, with SES surface render (HbA vs HbS toggle). No lesson page yet | prototype |

**A featured lesson is served at a short URL** (`/water`, `/builder`,
`/hemoglobin`, `/glycolysis`, `/membrane`) by a `vercel.json` rewrite, which
does not move the file. So each of the five carries `<base href="/demos/">` and
its relative paths keep resolving. Promoting a page to featured means adding
that tag and both routes: `docs/deploy.md`.

## Making a new lesson

**Ask the human which existing page is closest, and copy it.** The shared modules live in `lib/`, so a lesson at the top level loads `lib/scene.js` and `css/main.css`, and a bench in `tests/` reaches them through `../`; prose names them bare. Every page loads `molecules.js` + `scene.js`; everything above that is chosen — the `mol-*.js` domains it draws, the `kit/` pieces its mechanic needs, and rarely a standalone module. A page loading a domain it never draws is paying for someone else's molecules.

**Never type an atom or bond colour.** `tokens-from-palette.js` publishes `palette.js` as `--atom-*` / `--bond-*` at load, so a caption and the sphere it names cannot drift. `design-system.html` draws every token on the stage's own paper.

## Architecture principle: **share the plumbing, not the physics**

Deliberately **no monolithic `engine.js`**. What each shared module does and does not own, the test for whether something belongs in one, and the same split a level down inside the bonding builder: **`SCIENCE.md` §6.**

## The primary UX is always a bespoke 3D molecular simulation

A lesson's main stage is a 3D scene built for that lesson, rendered as molecules, interacted with **on the molecule**. That is the lesson.

**`reaction/` is the exception that proves this**: a shared module that drives the 3D stage rather than replacing it. A step says `fx:'ox'` and the module owns what that does to the molecule, while the lesson keeps its lanes, carriers and ledger. **Adding a verb must not touch a page** — the cycle added six and changed no lesson but its own. `Modules.md`.

**`massaction/`, `diffusion/` and `coupling/` are never the primary UX.** They are 2D abstractions that teach a statistical or thermodynamic point the 3D stage can't make honestly, and they belong behind a `kit/modal.js` side door — a second simulation the student opens when they doubt what the main stage just did, as glycolysis opens `massaction/`. `LESSONS-ROADMAP.md` lists them next to lessons as material, not as the design; don't read that as a stage.

## Scientific accuracy

`SCIENCE.md` is the rulebook — §§2–3 polarity and covalent bonding, §4 rendering caveats, §5 fx/colour conventions, §6 module architecture. When to open it, and the rest: the table above.

**A molecule that makes a chemical claim ships with the assertion that checks it, in the same commit** — `MolecularGeometry.md` §1.4's fidelity tiers (prop / contrast / subject) set how much accuracy it owes for the claim it makes. Pedagogical exaggerations (stretched bonds, neutral vs zwitterion) stay **explicit in comments**.

## AI Tutor

See `docs/ai-tutor.md`.

## Run / test locally

```bash
node tools/dev-server.js        # http://localhost:8817/ — zero dependencies
```

Live reload, and `no-store` so you never debug a fix that's already correct on disk. **It serves the repo root, not `demos/`**, because that's what GitHub Pages publishes — the local URL is the URL that ships. `/` is the lesson index; a lesson is `/demos/water-lab.html`. `demos/index.html` only redirects up.

Save a file and the browser reloads; a **CSS-only** change swaps the stylesheet in place, so the scene keeps its camera, selection and toggles.

**The pages are dependency-free; the tutor is not.** `water-lab`'s ask box needs SDKs and a key that are not in the working tree; setup is in `docs/ai-tutor.md`.

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

No CI: the hook is the run. It covers every checker except `tools/check-handedness.js` below, and `chain/`'s and `chair/`'s, which stay ungated while those pages are test-status. A checker is `node <path>`, offline and dependency-free; `.githooks/pre-commit` is the list.

**`tools/check-handedness.js` is separate on purpose** — it needs the network and RDKit, and it is the only global-mirror check (why: MolecularGeometry.md §1.3). Run it after touching a ring builder or adding a stereocentre:

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

**The human uses Safari.** Keep that in mind when she reports rendering or style bugs.

**Don’t write a changelog in a code file’s comments. Comments should be active voice, and only document things that are not obvious from reading the code.**

## Never use these structures:

* "It's not just X — it's Y"
* "Not only X, but Y"
* "This isn't about X. It's about Y."
* "No X. No Y. Just Z."

These mimic insight without providing any.
