# Mol\* evaluation — `folding-lab` rebuilt by someone else's renderer

**This folder is scratch, and is meant to be deleted.** Everything specific to
the evaluation lives here so it can be removed in one `rm -r` if Mol\* loses, or
promoted deliberately if it wins. Nothing outside this folder has been changed.
Same intent as `viewer-compare.html` (see `demos/RenderingLibraries.md`), which
is the precedent for an evaluation page that ships with its own delete
condition.

**Delete when:** `demos/RenderingLibraries.md` records a decision either way. A
kept-around evaluation with no verdict is worse than none, because the next
person cannot tell whether it was abandoned or is still authoritative.

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
| **2** | Match `PALETTE`, ball-and-stick proportions, cartoon style | skipped |
| **3** | H-bond dashes + camera choreography | **done — passed** |
| **4** | Act 3's multi-structure ladder at true relative scale | **done — passed, with the sharpest caveat of the evaluation** |

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

## Deciding it

Written down before building, so the conclusion cannot be retrofitted:

| Measure | Mol\* wins if |
|---|---|
| Bundle size / first paint | within ~2× of the current page |
| Playback frame rate | ≥ current, on a Chromebook |
| Cued H-bond dashes | expressible without fighting the state tree |
| Page source size | *smaller* than the current `folding-lab.html` |
| Surface cost | better than the 2.615 s measured on Mol\*'s own villin demo |

**A tie means keep our renderer** — we already own it, and it carries no
licence question.

## What is here

```
molstar/
  folding-molstar.html           stage 1 — headless mount + frame driving
  folding-molstar-narrated.html  stage 3 — always-on H-bonds + camera
  folding-molstar-ladder.html    stage 4 — the four-rung zoom-out
  tools/fold2pdb.js              1VII.fold.bin -> multi-MODEL PDB
  tools/ladder2pdb.js            actin.bin -> filament + coda PDB
  tools/check-molstar.js         asserts the fold export changed nothing
  data/*.pdb                     generated, gitignored (~3.3 MB total)
```

```bash
node molstar/tools/fold2pdb.js && node molstar/tools/ladder2pdb.js && \
  node molstar/tools/check-molstar.js
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
