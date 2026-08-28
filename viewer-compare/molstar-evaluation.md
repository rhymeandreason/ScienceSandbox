# Mol\* evaluation — `folding-lab` rebuilt by someone else's renderer

> ## SETTLED — Mol\* was not adopted
>
> **The verdict is in `demos/docs/rendering-modules.md`: we draw proteins ourselves**
> (Three.js + `scene.js` + `kit/ribbon.js`). Read that first; this file is
> the working that led to it.
>
> **Every path below is written as it stood, relative to `demos/`.** This file
> was `demos/molstar/README.md`; it sits beside `viewer-compare` now because
> that bench asks the same question of the same two libraries, and the two
> travel together if either leaves this repo. Nothing below was repointed —
> rewriting the paths of a settled argument only makes it harder to check
> against the commits it describes.
>
> **The pages and the structures are gone; this file is what is left.** The
> three `folding-molstar*.html` stages and the 3.8 MB of `data/` they loaded
> were deleted on the move to a deployed site, which is the production move this
> file always said was the right moment for it. What deleting was ever about is
> not leaving an *ambiguous* evaluation lying around, and the recorded decision
> below fixes that without the pages. Everything the evaluation measured is
> written down here.
>
> So: **read what follows as history, not as an open question.** Where it
> weighs Mol\* against our renderer, the weighing is done.

Everything specific to the evaluation lived in `demos/molstar/`, and nothing
outside it was changed — which is still worth recording, because it is what
made the evaluation readable as one self-contained argument.

**There are two questions here**, and stages 0–4 below answer only
the first. The second — `protein-lab`, rebuilt on hemoglobin — is stage 5, at
the bottom. It is a *different* question with a *different* strongest argument
(licence, not capability), and it should be decided separately: Mol\* could
easily win one and lose the other.

## The question

`folding-lab` renders a moving chain with cued H-bond dashes through our own
Three.js code. Mol\* is MIT, plays trajectories natively, and has representations
we do not. **Would `folding-lab` be better, or smaller, built on it?**

The comparison is only worth something if the renderer is the sole variable, so
this page must reuse the existing lesson's copy, palette and chrome. If Mol\*
looks better because someone restyled it, nothing has been learned.

## Stages, and what kills the idea at each

| | | Status |
|---|---|---|
| **0** | Export the baked trajectory to a format any viewer can read | **done** |
| **1** | Mount Mol\* in our own chrome, no built-in UI, playing that file | **done — passed** |
| **2** | Match `PALETTE`, ball-and-stick proportions, cartoon style | skipped for stages 3–4; **done for stage 5** |
| **3** | H-bond dashes + camera choreography | **done — passed** |
| **4** | Act 3's multi-structure ladder at true relative scale | **done — passed, with the sharpest caveat of the evaluation** |
| **5** | `protein-lab` rebuilt on hemoglobin, as a lesson | **done — passed** |
| **6** | The same molecule through our own renderer, for comparison | **done** |

### Stage 3 result — passed, and it changed what the page should do

`molstar/folding-molstar-narrated.html`. Stage 2 was skipped deliberately:
Mol\*'s default colours are untouched so nobody mistakes tuning for capability.

**The H-bonds were built twice, and the second answer is the one that matters.**

*First attempt — cue them ourselves.* Fourteen Mol\* distance measurements, one
per bond from `FoldLib.hbonds()`, shown and hidden per frame against the
`formed` array in `1VII.fold.bin`. It worked: 14/14 created, 14/14 surviving
every model change, ~0.9 ms to toggle. But it made each model update cost
**40.5 ms against stage 1's 12.6 ms** — 23 fps — because every frame had to
recompute fourteen dependent state nodes.

*Second attempt — let Mol\* do it.* Its `interactions` representation derives
non-covalent contacts from geometry, and because a model change rebuilds the
structure it **recomputes every frame**: the bonds appear as the chain actually
closes them, with nothing scheduling them. By default this only shows on click
(Mol\*'s focus behaviour); two calls make it permanent and global:

```js
const R = plugin.builders.structure.representation;
await R.addRepresentation(componentRef, { type: 'ball-and-stick' });
await R.addRepresentation(componentRef, { type: 'interactions' });
```

| | cartoon only | + 14 cued measurements | + ball-and-stick & interactions |
|---|---|---|---|
| model update | 12.6 ms | 40.5 ms | **26.6 ms** |
| playback | 61.7 fps | 23.1 fps | **34 fps** |

**The catch, and it is a teaching catch, not a technical one.** At the folded
state Mol\* draws **28 contacts where `folding.js` counts 14 hydrogen bonds**.
Mol\* is showing every non-covalent interaction it can find — side-chain
contacts, hydrophobic packing, the lot — and `folding-lab`'s lesson is
specifically the *fourteen backbone i→i+4 bonds* that coil the helices. Prettier
and more numerous is not the same as the point. The page prints both numbers
side by side so the divergence is visible rather than assumed; deciding which
one a student should see is a lesson decision, not a rendering one.

**Camera choreography works, with two traps, both now commented in the page:**

- **Never lerp `camera.radius`.** Mol\* derives the near and far clipping planes
  from it, so a radius that lags the structure clips the molecule out of the
  frustum — the stage goes blank and it reads as a rendering bug. Ease the
  *distance* instead; that only changes apparent size.
- **`canvas3d.boundingSphere` is lazy.** After a state commit it still reports
  the previous frame's sphere, and reports radius 0 on the first. `commit(true)`
  forces it, but that is a full scene commit just to ask a question. The page
  computes the sphere from `traj.key` instead — exact, free, and it cannot fall
  out of step with what is drawn.

### Stage 4 result — passed, and it found the one thing that would break the lesson

`molstar/folding-molstar-ladder.html`, with `tools/ladder2pdb.js` writing the two
derived rungs out of `folding/data/actin.bin`.

Four files in one scene, loaded in ~1.5 s, rung switch ~2 ms. The extents are
measured on screen from the coordinates Mol\* actually parsed, not from the
labels:

| rung | measured | ×HP35 | page claims |
|---|---|---|---|
| HP35 (1VII) | 2.7 nm | 1.0× | ~2 nm |
| villin (AlphaFold) | 8.9 nm | 3.3× | ~10 nm |
| actin filament, 13 subunits | 39.7 nm | 14.4× | ~40 nm |
| coda (9JUS) | 13.0 nm | 4.7× | — |

**MOL\* OVERRIDES THE CAMERA POSITION, AND THAT IS THE FINDING.** Asking for a
camera distance of 959 Å put the camera at 179: Mol\* recomputes distance from
`radius` and the field of view so the scene fits the viewport. Position is a
suggestion; `radius` is the only real zoom control.

Which means the obvious implementation — frame each rung by its own extent —
makes **every rung fill the screen equally**. HP35 and a filament fourteen times
its length render the same size, every label still reads correctly, and act 3's
entire lesson is gone with nothing on screen to say so. A viewer that always
frames the scene is doing the helpful thing and the wrong thing.

The page therefore has a **scale lock**, on by default: one radius for every rung
(the largest), so the rungs sit in true proportion and HP35 really is a speck
against the filament. Unlock it to see the comfortable, dishonest version. Both
are one click apart deliberately — that is the comparison worth having.

**If Mol\* is adopted, this is the thing to write down.** It is not a bug and no
amount of care in the page prevents it; it has to be worked against on purpose,
every time relative scale is the point.

Two smaller stage-4 traps, both commented in the page:

- **Commit before framing.** After a visibility change the scene bounding sphere
  still describes the previous rung, and Mol\* derives the clipping planes from
  it — the filament vanished behind a radius of 10. `canvas3d.commit(true)`
  first. Fine at four clicks; not at 185 frames, which is why stage 3 computes
  its sphere by hand.
- **Choose the viewing direction per rung.** Inheriting the previous rung's
  angle pointed the camera straight down the filament's helical axis, so 40 nm
  of filament rendered as a small disc. The page looks along the structure's
  thinnest axis so the longest lies across the screen.
- **Hide the representation, not the structure.** Hiding a structure cell leaves
  its representations drawn; the previous rung ghosted through until visibility
  was moved to the repr ref.

**Not covered:** the headpiece rung (a residue-range selection, which tests
Mol\*'s selection language rather than anything structural) and the eight
AlphaFold arrangements from `villin.js`.

**Two more environment findings:**

- `viewportShowTrajectoryControls: false` is required. Loading a multi-model
  file makes Mol\* volunteer its own "Model 1 / 185" stepper over the stage — a
  second transport competing with ours. Like the viewport button cluster, it
  only appears once the data gives it a reason to.
- **Mol\* holds a WebGL context per instance, and browsers cap those.** Several
  open tabs of these pages wedged the browser until they were closed. Relevant
  for a classroom where students leave tabs open.

### Stage 1 result — passed, with one asterisk

`molstar/folding-molstar.html`. Measured in-page rather than asserted; the
readout is part of the page.

| | |
|---|---|
| Bundle + plugin init | **134 ms** |
| Structure load (2.78 MB, 185 models) | **~700 ms** |
| Frame set from our own JS | **yes** |
| Per-frame state commit | **12.6 ms avg** |
| Full 185-frame playback | **3.0 s wall — 61.7 fps** |
| Mol\*'s own UI in our stage | **none** (see asterisk) |

**The asterisk: "headless" is a CSS claim, not a configuration one.** Every
documented `layoutShow*` and `viewportShow*` option is set false, and the
viewport button cluster still renders over the top-right of the stage — Reset
Zoom, fit, "lay flat", screenshot, fullscreen, illumination, and a VR button.
No option removes it; `#molstar .msp-viewport-controls{display:none}` does.
One rule is a cheap price, but it means a Mol\* upgrade that renames that class
puts eight buttons back on a lesson, silently.

**Unexpected win: secondary structure is recomputed per frame.** Mol\* assigns
SS to each model independently, so the cartoon genuinely *becomes* helical as
the chain coils — the ribbon is doing the teaching, not just following the
atoms. Our renderer draws atoms and bonds and cannot do this. If Mol\* wins
anything outright so far, it is this.

**Notes for whoever picks up stage 2:**

- The trajectory's model cell is found by matching the transformer id string
  `ms-plugin.model-from-trajectory`. **Correction from stage 3:** the CDN build
  *does* expose the registry, at `molstar.lib.plugin.StateTransforms` — along
  with `lib.structure` (`StructureElement`, `Structure`), `lib.shape` and
  `lib.math.LinearAlgebra`. The string match still works and is left alone, but
  a typed path exists and no build step is needed to reach it.
- Frames are driven by
  `plugin.state.data.build().to(ref).update({modelIndex:i}).commit()`.
- **The camera is deliberately not choreographed.** It frames the extended
  chain once, so the folded protein ends up small — which is truthful, since it
  really is about four times smaller, but it is not a finished lesson. Camera
  work is stage 3, on purpose.
- **Rendering is async and lands after the commit resolves.** A screenshot taken
  immediately after `setFrame` can catch an empty stage and look like a
  rendering failure. It is not one.

Stage 1 is the gate: if Mol\* can only run as its full viewer application, it is
usable for `protein-lab`-style pages and disqualified for lesson pages, and the
evaluation stops there having cost almost nothing.

Do **not** build stages 3–4 ahead of order. That is most of the work and none of
the information.

## Stage 5 — `protein-lab` on hemoglobin — passed

`molstar/protein-molstar.html`. **A different question from stages 0–4**, run
because `protein-lab` is where Mol\* has an argument that `folding-lab` does
not: it is the only GPLv3 page in the repo, and it is GPLv3 *solely* because
ChemDoodle is vendored into it. Mol\* is MIT. `folding-lab` owns its renderer
and has no licence question at all.

**The lesson problem came first, and it is not a rendering problem.**
`protein-lab` carries levels 1–3 on lysozyme and then swaps to an antibody for
level 4. Molecule, file, palette and framing all change at once, so quaternary
reads as *a different protein* rather than the next level up. Hemoglobin fixes
it structurally: its own subunit is one of the four. Levels 1–3 run on the beta
chain; level 4 is that same chain, still in its own colour, with three more
switched on around it. **Step 4 loads nothing.**

**Step 1 draws those same residues UNFOLDED, and that is a correction, not a
flourish.** Primary structure is a *sequence* — an order, with no conformation.
Drawing folded coordinates for it (which this page did first, and which
`protein-lab.html` still does with lysozyme) quietly asserts that the shape is
part of level 1, the exact confusion the four levels exist to take apart.
Textbooks draw beads on a string for this reason and they are right to.

Twenty residues, not 146: the full chain extended is ~51 nm against the
tetramer's 7.1, so it could not share a frame with anything else here and the
scale lock would break on the first step. Twenty is the run step 2 coils, which
makes steps 1→2 one continuous claim — *the same residues, straight, then
helical* — in the same purple, with the camera not moving between them.

Measured, and it is the reason the compromise works at all: **the 20 residues
unrolled are 7.1 nm, and the whole tetramer is 7.1 nm wide.** The strand fills
the locked frame exactly. That is also a fact worth putting in front of a
student — folding is what makes a protein small.

Built with `FoldLib.extended()`, the same function that makes `folding-lab`'s
start state (real bond lengths and angles, the two rotatable dihedrals at beta
values, so it is a physically possible conformation rather than a drawn line).
It is still **generated, not observed**, and the legend says so — a sequence has
no shape to measure, which is the point being made, but this folder's standing
rule applies anyway. Side chains are carried deliberately: a bare backbone is
identical for every sequence in existence, so level 1 without them would be a
picture of the one part of a protein that carries no sequence information.
It loads as a **second structure**, not a component of the first, so no later
selection is ambiguous about whether it means built or deposited atoms.

Both changes were made together on purpose. Building the hemoglobin version on
ChemDoodle first would mean building it twice — the lesson needs a residue-range
selection (step 2), per-chain colours (step 4) and a driven camera, and none of
the three is expressible there.

| | ChemDoodle (`protein-lab.html`) | Mol\* (`protein-molstar.html`) |
|---|---|---|
| step switch | new canvas + re-parse + re-orient | **16–30 ms**, visibility only |
| levels 1–3 on one molecule | yes (restyle) | yes (visibility) |
| level 4 without a swap | **impossible** | yes |
| one helix isolated | **impossible** | residue-range component |
| level 1 shown with no conformation | **impossible** | a built strand as a 2nd structure |
| step 2 folds, cartoon appears as geometry coils | **impossible** | multi-MODEL + per-model SS |
| default click-to-focus removed | n/a | 4 behaviours disarmed |
| chain colours | **not settable** — the page reads them back out of the molecule (`chainLegend`, 40 lines) | a parameter |
| 3₁₀ helix drawn distinctly | **no style for it** | own SS type |
| resize | rebuild canvas, re-orient, re-fit | reframe, one call |
| page source | 20 KB | 33 KB |
| bundle | 468 KB vendored | ~3.4 MB CDN |
| licence | **GPLv3, and it infects the page** | MIT |

Page source came out **larger**, which fails the decision table's "smaller than
the current page" line — but the two pages no longer do the same thing (a
ghosted helix, a scale lock and a driven camera are all new), so that row is
not a like-for-like comparison any more. The bundle is 7× and also fails its
row. Everything else passes, and the licence row is the one that is not a
matter of degree.

### The four new findings, all of which cost time

- **`camera.setState` does not schedule a draw.** Outside an animation loop
  nothing repaints: the stage stays empty with a camera whose every number is
  provably correct, and it reads exactly like a failed structure load. Stages
  3–4 never hit this because they move the camera during playback, where the
  next frame draws anyway. A page whose camera only moves on a click must call
  `canvas3d.requestDraw()` itself.
- **Commit before framing — again, and worse here.** Straight after a
  visibility change (and on the very first frame) `canvas3d.boundingSphere` is
  0; Mol\* then clamps `radius` to a floor of **10** and derives the clipping
  planes from that, putting the whole molecule outside the frustum. Measured:
  bs 0, requested 35.3, got 10, blank stage. `await canvas3d.commit(true)`
  first. Fine at four clicks — it costs ~20 ms of the step switch.
- **`radius` is honoured downward and clamped upward** at the scene's bounding
  sphere. Asking 5 / 10 / 17.9 / 26.6 / 35.3 returned all five; asking 60
  returned 37.8. Because every representation is built at boot, that ceiling is
  the *tetramer's* from the first frame, so the scale lock is free. Anyone who
  "optimises" the components into being built per step moves the ceiling with
  the step and the lock silently stops locking.
- **MolScript from a string works, and fails silently twice.** The viewer
  bundle exposes no `MolScriptBuilder`, but `StructureComponent` accepts
  `{type:{name:'script',params:{language:'mol-script',expression}}}` with the
  expression as source text. Two traps, neither of which throws — the component
  resolves to `Null` and the stage is simply missing a helix:
  `(= (atom.auth_asym_id) "B")` selects **nothing** where `... B)` selects 1225
  atoms (bare symbols, never quoted strings); and `(core.logic.and [a b])`
  does **not** filter, it returns the unfiltered set (no array arguments).
  `core.rel.inRange` is not implemented in 5.11.0 and does throw. The page
  asserts every component's atom count for this reason.

Plus two smaller ones:

- **The paper CAN show through — it takes two flags, not one.**
  `transparentBackground: true` alone composites over the page *and* draws
  Mol\*'s own grey checkerboard behind the molecule to indicate the
  transparency, which lands on the stage looking like a broken texture and is
  easy to read as proof that transparency is unusable. (It was read that way
  here first, and the page spent a revision painting an opaque canvas the
  colour of `--paper`, with the dot pattern visibly stopping at the stage
  edge.) `checkeredTransparentBackground: false` is the other half. With both,
  the sandbox's paper runs under the molecule exactly as on every Three.js
  page in the repo.
- **Fog erases atoms under the scale lock.** `cameraFog` defaults to intensity
  15 and fogs toward the far clip plane, which Mol\* derives from `radius` — so
  with the radius describing the whole tetramer, the far end of a frame-sized
  object dissolves into the background. It ate the last two residues of step
  1's strand, which reads as the molecule being cut off rather than as depth.
  `cameraFog: {name:'off'}`.
- **`updateCellState` returns `undefined`, not a promise.** Visibility changes
  are fire-and-forget, applied on the state's own schedule, so a `commit(true)`
  issued immediately after can commit the *previous* visibility: the scene
  sphere is computed for the wrong set, the camera is aimed from it, and the
  redraw the change eventually triggers races a camera set from stale numbers.
  Symptom, seen twice: a step that renders nothing until something else forces
  a draw. Yield one macrotask first — **not `requestAnimationFrame`**, which is
  the obvious choice and is suspended in a backgrounded tab, so the step would
  never complete for a student who switched tabs and came back.
- **The WebGL context cap is not theoretical.** Three tabs of these pages open
  at once wedged the browser hard enough that a navigation timed out. In a
  classroom, students leave tabs open.

### The scale lock, again

Same trap as stage 4, and the fact that it recurred on a completely different
page is the evidence that it is a property of Mol\* rather than of one lesson.
Frame each step by its own extent and 20 residues fill the screen exactly as
574 do — every caption still true, the zoom-out that IS the lesson gone, and
nothing on screen to say so. The page locks one radius (the tetramer's) across
all four steps; the checkbox shows the comfortable version, which is worth
looking at once because it is so obviously *nicer*.

### Palette parity — stage 2, no longer skipped (for this page only)

**This changes what the page is, and the change was the right call.** Stages 1–4
left Mol\*'s defaults untouched so nobody could mistake tuning for capability.
That purity was worth less than it looked: these lessons are made of specific
interactions and animations, and a renderer that cannot carry them is
disqualified however good it looks. **A lesson prototype is the honest test** —
so stage 5 is one. Judge its looks by all means, but do not read "it looks like
ours" as evidence about Mol\*, because it was made to.

Colours and radii are **derived from `palette.js`**, not copied, exactly as
`attic/folding-lab.html` does it: `PALETTE.radii[el] / MolLib.SCALE` for the atoms and
`× 0.165` for the sticks. Retuning the house palette retunes this page. The
page loads `../palette.js` and `../molecules.js` for `PALETTE` and `SCALE` alone,
with no `mol-*.js` domain, so the registry stays empty — the same arrangement
`folding-lab` uses and CLAUDE.md documents.

Verified against `folding-lab`'s own numbers: C 0.447, N 0.474, O 0.500 Å,
stick 0.0738 Å.

- **Colours need no custom theme.** The built-in `element-symbol` theme accepts
  `colors: {name:'custom', params:{...}}` with a full **upper-case** element
  map, which is the upgrade-safe way round. Two of its params must be
  neutralised or the house hexes come out wrong: `lightness` defaults to **0.2**
  and darkens every atom, and `carbonColor` defaults to **chain-id**, which
  colours carbon by subunit and silently overrides `PALETTE.atoms.C`.
- **Radii DO need a custom size theme, and the reason is chemical.** The house
  radii run **O (0.95) > N (0.90) > C (0.85)**; van der Waals — all that
  `sizeTheme: 'physical'` offers — runs the other way, C (1.70) > N (1.55) >
  O (1.52). No scale factor turns one into the other. Both registries expose
  `.add()`, so a provider is straightforward.
- **`granularity` must be `'group'`, not `'element'`.** 'element' is the
  obvious choice for a per-atom size and fails with
  `Cannot read properties of undefined (reading 'dUsePalette')` thrown from
  inside the renderer — a message that names nothing leading back to the cause,
  and which leaves the representation cell in a permanent error state so every
  later update on it fails the same way. Every built-in per-atom theme uses
  `'group'`.
- **Iron is not in the house palette**, because until hemoglobin no lesson had
  a metal cofactor. The page adds `FE` locally, warm-dark so it is not confused
  with oxygen's red sitting one bond away in the haem. **If hemoglobin ships,
  Fe belongs in `palette.js`.**
- **The haems are element-coloured, not one flat rust**, and that is a science
  decision as much as a styling one: the iron is the point of a haem, and a
  uniformly-coloured haem hides the single atom the whole assembly exists to
  carry. They still read as *not protein* because they are drawn as atoms among
  ribbons — representation, not colour, is doing that work.
- **Consequence for step 1:** the extended strand is element-coloured, so it is
  no longer painted step 2's purple. An all-atom view is where this sandbox
  always shows elements, and level 1's claim is that the residues *differ* —
  which one flat colour hides. The step 1→2 link is carried by the residue
  range and the copy instead of by ink.
- **Cost, and it is visible:** the house stick ratio is thin, and under the
  scale lock (frame ⌀ 7.1 nm) it renders near the pixel floor. It is faithful —
  `folding-lab` draws the same ratio and looks thicker only because HP35 fills
  its frame at 2.7 nm. Thin sticks are what true scale costs here.

### Step 2 is an animation now, and this is the part that decides it

Clicking step 2 plays the 20 residues folding from the extended chain into the
helix, then cross-fades into the deposited cartoon. **120 frames over 5 s**, a
600 ms hold on the finished helix, then a ~350 ms alpha cross-fade — about 6 s
in all. Clicking step 2 again replays it, and the legend says so.

**Playback is clock-driven, not frame-driven**, and that is the fix for the
first version being over in about a second. A plain `for` loop makes the
duration a property of the machine; driving from `performance.now()` against
`FOLD_SECONDS` means it takes the same time everywhere and a slow machine drops
frames rather than running long — the right way round for a lesson. The two
knobs, `FOLD_FRAMES` (path resolution, costs page-load ms) and `FOLD_SECONDS`
(how long a student gets to watch), are the lesson's numbers, not the renderer's.

**Do not trust the `fold playback` readout from an automated harness.** It is
wall clock, and a backgrounded tab throttles `setTimeout` to ~1 s — which
stretched a 6 s animation to a measured 19.4 s and, earlier, made a 350 ms fade
look like one alpha step per second. Individually the alpha commits are
**1–8 ms**. Judge the pacing in a visible window.

**Mol\* has no folding method.** Worth stating plainly, because the division of
labour is the finding:

| | |
|---|---|
| ours | the conformational path, and the physics claim it makes |
| Mol\* | multi-MODEL playback, and **secondary structure recomputed per model** |

That second column is what makes "the helix dissolves in" free. We do not fade a
helix in on a timer and hope the coordinates agree — Mol\* re-assigns SS on every
model, so a cartoon on this trajectory becomes helical exactly when the geometry
does. Our own renderer draws atoms and bonds and cannot. Same finding stage 1
recorded on villin, reproduced on a second molecule.

**`FoldLib.Folder` was tried first and rejected on measurements.**

- 2HHB is **X-ray and carries no hydrogens**, so `FoldLib.hbonds()` finds zero
  backbone H-bonds and the relaxation has nothing to coil with. Placing amide
  H's geometrically fixed that — 16 bonds, 14 of them i→i+4, right for a
  20-residue helix — but:
- the solver's `SCHEDULE` is tuned for villin, and on a 20-mer it **overwound**:
  Cα(i)–Cα(i+4) came out **4.76 Å against the deposited 6.29**, with only 9 of
  16 H-bonds closing. Re-tuning it for a fragment would make `folding-lab`'s
  numbers depend on this page.

**So the path is a dihedral interpolation.** Every backbone φ/ψ/ω is measured on
the deposited residue; each frame lerps from an extended β conformation (φ −139,
ψ 135 — `folding.js`'s own start values, a real Ramachandran region rather than
a straight line) to the measured value and rebuilds by NeRF. Bond lengths and
angles come from the deposited structure and are **never interpolated**:

| assertion | measured |
|---|---|
| worst backbone bond-length error, all 60 frames | **0.000000 Å** |
| last frame vs deposited backbone | **0.00000 Å** |
| mean φ/ψ, first frame | −139 / 135 (β) |
| mean φ/ψ, last frame | **−65 / −37** (right-handed α) |

The last frame landing exactly on the deposited coordinates is what lets the
cross-fade be invisible — anything looser and the helix jumps at the swap.

This is a legitimate interpolation between two real conformations, and dihedrals
are the degrees of freedom a chain actually folds through. It is **not a folding
pathway**: real folding does not rotate every dihedral in lockstep. Same
epistemic status as `folding-lab`'s trajectory, and the page says so.

**THE SIGN-CONVENTION TRAP, and it is the nastiest thing in this folder.**
NeRF takes the true IUPAC dihedral; the textbook `atan2` form returns its
**negative**. Get it wrong in *both* the measurement and the build and the two
errors cancel exactly: the final frame lands on the deposited coordinates to
0.00000 Å, every geometric assertion passes, and **the entire animation is a
mirror image** — a left-handed helix reading φ +65 / ψ +37. It was caught only
by measuring φ/ψ back off the built frames, which is now asserted on both ends.
This is the same class of error `tools/check-handedness.js` exists for, and the
same lesson: a mirror preserves every distance, so distance checks cannot see it.

**Two more animation findings:**

- **Follow the molecule, or the middle of the animation walks off the stage.**
  The chain is rebuilt outward from its seeded first residue, so while it coils
  the far end sweeps a wide arc — the widest frame is 7.2 nm against a 7.1 nm
  locked frame. Aiming at the finished helix put frame 22 half off the top,
  which reads as a rendering fault. The camera tracks a per-frame sphere
  computed when the path is built: **radius untouched, so the scale lock still
  holds while it moves** — only the aim changes.
- **Camera per frame must not commit.** `setState` + `requestDraw` only. A
  `commit(true)` per frame is exactly what stage 3 measured at 40 ms and 23 fps.

### Not covered

Mol\*'s own secondary-
structure assignment is not compared against the file's HELIX records — the
helix ranges here come from `PDBLib.helices()`, but the cartoon's shapes are
Mol\*'s own opinion, and on a page about secondary structure that is a
comparison someone should actually make.

### Known caveat carried on the page

**β-globin has no β-sheet.** It is eight α-helices and turns, so the sheet gap
that `protein-lab.html`'s header admits for lysozyme is *not* fixed by changing
subject. Step 2 states it outright, because "β chain" and "β sheet" sitting on
one page unexplained is worse than the gap itself.

## Stage 6 — the control arm: the same hemoglobin, our renderer

`molstar/protein-inhouse.html`. **The comparison this folder is named after
finally has both sides.** Until now "ours" was an argument; this is a page.
Same file, same `PDBLib.orient` call, same chain colours, same house
ball-and-stick for the haems — Three.js + `scene.js` + `kit/ribbon.js`
instead of Mol\*, and nothing else different. No steps and no animation: the
four levels are `protein-molstar`'s job, and this arm answers only *can we draw
it, and what does it cost*.

Secondary structure is **our** `RibbonLib.dssp` over 2HHB's own N/CA/C/O, not
the file's HELIX records — deliberately, because Mol\* computes its own, and
feeding ours the answer key would not be a comparison.

| | in-house | Mol\* |
|---|---|---|
| first paint | **195 ms** | 305 ms init + 347 ms load |
| ribbon build (4 chains, 574 residues) | **76–94 ms** | n/a (its own pipeline) |
| triangles | 77,364 | not exposed |
| bundle | **0 KB** (modules already loaded) | ~3.4 MB CDN |
| page source | **18 KB** | 65 KB |
| extent, same method | 6.8 nm | 7.1 nm |
| DSSP vs the file's HELIX records | 458 H vs 448 · **92 % covered** | — |

The 92 % is the number to keep. DSSP legitimately clips helix ends by a residue
or two, so per-residue coverage is the fair measure and run-counting is not —
hemoglobin is a good test for exactly this reason, being 30 helices and almost
no sheet.

**What this arm owns outright**, and every one of these cost Mol\* work earlier
in this document:

- it draws into `scene.js`'s scene, so ribbons can mix with atoms, FX rings,
  hover raycasts and one shared camera. Mol\* brings its own canvas and cannot
  (`ribbon.js`'s header, "Two viewers means two canvases").
- nothing to disarm: no click-to-focus, no viewport button cluster needing a
  CSS rule that a version bump can rename, no WebGL context per instance.
- the paper shows through because the canvas is ours — no `transparentBackground`
  plus `checkeredTransparentBackground` pair to discover.
- no licence question, which for `protein-lab` is the whole argument on the
  other side.

**What it cannot do, and it is the one that matters:** reassign secondary
structure per frame. That is precisely what made `protein-molstar`'s step-2 fold
work — the cartoon becoming helical exactly when the geometry does. Our ribbon
takes an `ss` array as an argument, so animating a fold through it means calling
`dssp()` per frame (77 ms here, on 574 residues) and rebuilding the geometry
(76 ms) — ~150 ms a frame, against Mol\*'s ~25 ms including its own assignment.
On the 20-residue segment the lesson actually animates that gap would shrink a
lot, and **nobody has measured it** — which is the honest next experiment rather
than a conclusion.

So the shape of the answer is: **for a static structure our renderer wins on
every axis that was measured, and the case for Mol\* rests on the licence and on
per-frame secondary structure.** Whether that second one is worth 3.4 MB and a
viewer's worth of defaults is a lesson decision, and it now has numbers.

## Deciding it

Written down before building, so the conclusion cannot be retrofitted:

| Measure | Mol\* wins if |
|---|---|
| Bundle size / first paint | within ~2× of the current page |
| Playback frame rate | ≥ current, on a Chromebook |
| Cued H-bond dashes | expressible without fighting the state tree |
| Page source size | *smaller* than the current `attic/folding-lab.html` |
| Surface cost | better than the 2.615 s measured on Mol\*'s own villin demo |

**A tie means keep our renderer** — we already own it, and it carries no
licence question.

## What is here

```
molstar/
  folding-molstar.html           stage 1 — headless mount + frame driving
  folding-molstar-narrated.html  stage 3 — always-on H-bonds + camera
  folding-molstar-ladder.html    stage 4 — the four-rung zoom-out
  (protein-molstar.html)         stage 5 — DELETED; the evaluation is over and
                                 its control arm is hemoglobin/hemoglobin-inhouse.html
  protein-inhouse.html           stage 6 — the same molecule, OUR renderer
  tools/fold2pdb.js              1VII.fold.bin -> multi-MODEL PDB
  tools/ladder2pdb.js            actin.bin -> filament + coda PDB
  tools/fetch-hemoglobin.js      2HHB from RCSB, chain/haem counts verified
  tools/check-molstar.js         asserts the fold export changed nothing
  data/*.pdb                     generated or fetched, gitignored (~3.7 MB)
```

```bash
node molstar/tools/fold2pdb.js && node molstar/tools/ladder2pdb.js && \
  node molstar/tools/check-molstar.js
node molstar/tools/fetch-hemoglobin.js     # stage 5 only; needs the network
```

`fold2pdb.js` is worth keeping **even if Mol\* is rejected**:
`folding/data/1VII.fold.bin` is a private Float32 format that only `folding.js`
can read, and the only thing that currently checks it is the code that wrote it.
A PDB export opens the trajectory to VMD, PyMOL and ChimeraX — an outside
opinion on a file we otherwise grade ourselves.

**The generated PDB is gitignored.** At 2.78 MB it is 6× the `.bin` it came from
and holds not one new number, and this repo publishes from the working tree.
Regenerate it rather than committing it; `--stride N` thins it if a lighter file
is wanted.

## Mol\* facts, checked 2026-08-02

- **v5.11.0, MIT** (npm registry). MIT is the whole reason this evaluation is
  worth running: adopting it would let `protein-lab` stop being GPLv3.
- CDN, no build step:
  `https://cdn.jsdelivr.net/npm/molstar@5.11.0/build/viewer/molstar.js` and
  `.../molstar.css`. **Pin the version** — `@latest` in a committed page is a
  page that changes under you.
- The default UI can be switched off entirely. From Mol\*'s own
  `build/viewer/embedded.html`:

  ```js
  molstar.Viewer.create('app', {
    layoutIsExpanded: false, layoutShowControls: false,
    layoutShowRemoteState: false, layoutShowSequence: false,
    layoutShowLog: false, layoutShowLeftPanel: false,
    viewportShowExpand: false, viewportShowSelectionMode: false,
    viewportShowAnimation: false,
  }).then(viewer => viewer.loadStructureFromUrl(url, 'pdb'));
  ```

  `loadStructureFromUrl(url, 'pdb')` is the entry point for `data/1VII.fold.pdb`.
  That answers *half* of stage 1 — the chrome can be hidden. What it does not
  answer is whether the trajectory can be **driven** frame-by-frame from our own
  narration, which is the part that matters.
- `Viewer` is a convenience wrapper. Below it are `mol-plugin-ui` and the
  lower-level `mol-canvas3d`; if the wrapper proves too opinionated, that is the
  fallback, at the cost of a build step.

## Caveat that must reach any page built here

The exported trajectory is **solver output, not experimental data**. Only the
final frame corresponds to the deposited structure; every other frame is a
constrained relaxation with no experimental basis. The REMARK records in the
generated file say so, and any page that renders it owes the student the same
statement — `folding-lab` already makes it, and a comparison page that quietly
drops it would be teaching worse science with better graphics.
