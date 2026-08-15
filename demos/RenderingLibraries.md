# Rendering libraries — the decision, and why

**Verdict, 2026-08-02: we draw proteins ourselves.** Three.js + `scene.js` +
`folding/ribbon.js`. ChemDoodle Web is dropped. Mol\* is not adopted. No
third-party molecular viewer ships in this repo.

This file is the record eight other files point at. Several of them were built
with a delete condition worded "delete when RenderingLibraries.md records a
decision either way" — because a kept-around evaluation with no verdict is
worse than none: the next person cannot tell whether it was abandoned or is
still authoritative.

**The verdict is now recorded, and nothing is being deleted.** This is a
prototype repo, the evaluations are the working it out, and they are meant to be
shown to people. What those delete conditions were really protecting against is
*ambiguity*, and a recorded decision fixes that on its own. So they are
downgraded from "delete" to "settled — kept as reference", and this file is what
they point at to say so. See **Status of the evaluation pages**, below.

The deletions happen at the **move to a production repo**, not here.

---

## What was actually compared

Three renderers, on real pages, against the same structures.

| | what it is | status |
|---|---|---|
| **ChemDoodle Web** | was vendored in `vendor/chemdoodle/`, drove `protein-lab.html` | **removed** — both deleted, see below |
| **3Dmol.js** | evaluated in `viewer-compare.html`, itself now deleted. A library NAME — there was never a 3Dmol file in this repo | **not adopted** |
| **Mol\*** | evaluated over six stages in `molstar/` | **not adopted** |
| **ours** | `folding/ribbon.js` + `scene.js`, already shipping in `folding-lab.html` | **adopted** |

The Mol\* evaluation is the thorough one and `molstar/README.md` holds its
measurements in full. The short version is below.

---

## The four reasons

### 1. Two viewers means two canvases

This is the structural argument and it decided the question before performance
was measured. **Every third-party viewer brings its own WebGL context, its own
camera and its own canvas.** None of them can draw into `scene.js`'s scene.

That is fatal here, because our lessons are not pictures of molecules — they
are molecules with things happening to them. `folding-lab` crossfades atoms
into tubes, raycasts for hover, and carries one shared camera through a
four-rung zoom ladder. `aminoacid-lab` fires FX rings at a reaction site.
Adopting a viewer for the ribbon would mean a second canvas stacked on the
first and every one of those interactions living on the wrong side of it.

A ribbon is not worth losing that, and a ribbon is ~1,000 lines
(`folding/ribbon.js`). This reasoning is quoted in that file's own header.

### 2. It is ours to change, and the lessons need changing

The evaluations kept running into the same wall from opposite directions:

- **ChemDoodle** coloured a ribbon's two faces separately as a depth cue, with no
  way to say "this colour means α-helix." `protein-lab.html` flattened every
  colour pair to one value to stop students inventing a meaning for the second.
  It could not colour a 3₁₀ helix at all — lysozyme has one at A 80–84, and the
  page could only name it in prose and admit the picture did not show it. Chain
  colours were not settable either: `chainLegend()` existed, with a 17-line
  comment, purely to read ChemDoodle's palette back OUT of the molecule so the
  key could not contradict the picture. (Both pages are on `chemdoodle-archive`
  if you want to see any of this rather than take its word for it.)
- **Mol\*** is far more configurable, and still had to be talked out of its
  defaults at every step: four click and hover behaviours disarmed by emptying
  their bindings, a viewport button cluster removable only by a CSS rule that a
  version bump can rename, a custom size theme registered because the house
  radii run O > N > C and van der Waals runs the other way, two flags to make
  the paper show through, fog switched off because it ate the end of a molecule.

Ours has no defaults to fight. Colour, radius, opacity, twist and arrowheads are
parameters we chose, and a lesson that needs a new one adds it.

### 3. Licence

**ChemDoodle Web is GPLv3, and loading it makes the page GPLv3.**
`protein-lab.html` was the only GPLv3 page in this repo, and was GPLv3 *solely*
because of that vendored copy. **It and the vendored library have been deleted,
so the obligation is off the project entirely — nothing here is GPL now.** The
vendored `README.md` recorded the original accepted trade-off; this file is
where it stopped being accepted, and the deletion is where it ended.

Mol\* is MIT, so adoption would also have cleared the licence — that was the
single strongest argument for it, and it is now moot, because the in-house path
clears it too and wins on the other three counts.

### 4. Size and speed, measured

Our stack, on 2HHB — human deoxyhaemoglobin, four chains, 574 residues, four
haems — in `molstar/protein-inhouse.html`:

| | raw | gzipped |
|---|---|---|
| `palette.js` · `molecules.js` · `scene.js` · `pdb.js` · `folding/ribbon.js` | 98.9 KB | **36.4 KB** |
| Three.js r128, from a CDN | — | 118 KB |
| **total** | | **≈ 158 KB** |

against **ChemDoodle 424 KB** vendored and **Mol\* ~3.4 MB** from a CDN.

**The number that actually matters is the marginal one: ~19 KB gzipped.** Every
Three.js lesson already loads `scene.js`, `palette.js`, `molecules.js` and
Three.js, so adding a protein page to this sandbox costs `folding/ribbon.js`
and nothing else — about 1/22nd of ChemDoodle, which replaces none of it.

Timings, whole tetramer, first paint **195–590 ms** depending on how warm the
tab is: parse + orient 16–55 ms, our DSSP 70–245 ms, ribbon build 76–256 ms.
Every one of those is our code, one-time per structure, and optimisable if it
ever matters. Mol\* was 305 ms of plugin init plus 347 ms of structure load
before drawing anything.

Deposited structure files are far larger than any of this — 2HHB is 443 KB —
and that cost is identical whichever renderer draws it, so it is not an input to
this decision.

---

## What we give up, stated plainly

**Secondary structure recomputed per frame.** Mol\* re-assigns SS on every model
of a trajectory, so a cartoon *becomes* helical exactly when the coordinates do.
That is genuinely something we cannot do today: `RibbonLib.build` takes an `ss`
array as an argument, so animating a fold through it means calling
`RibbonLib.dssp` and rebuilding the geometry every frame — ~150 ms on the full
tetramer against Mol\*'s ~25 ms.

Two things keep this from being decisive. The lesson that needs it animates a
**20-residue segment**, not 574, and nobody has measured it at that size — the
gap should shrink by more than an order of magnitude. And `folding-lab` already
plays a fold without it, by baking the trajectory ahead of time
(`folding/data/1VII.fold.bin`), which is the same answer at a different point in
the pipeline: precompute the assignment per keyframe.

**If a lesson ever genuinely needs live per-frame SS and precomputation will not
do, reopen this file.** That is the one finding that could overturn the verdict,
and it should not be quietly forgotten because the decision went the other way.

---

## Status of the evaluation pages

The Mol\* evaluation is kept: this is a prototype repo, the evaluations are how
the decision was reached, and they are worth showing to people. Each is labelled
**settled** rather than **pending**, which is the distinction the old delete
conditions actually cared about.

**The ChemDoodle pages are the exception, and they are gone.** They were not
deleted for being settled — every settled page below survives — but because the
library they loaded is GPLv3 and the only way to stop that licence applying is
to stop shipping it. That is a licence action, not an editorial one.

| | what it is now |
|---|---|
| `vendor/chemdoodle/` | **deleted.** GPLv3, and the sole reason any page here was |
| `protein-lab.html` | **deleted** with it — it was the only page loading ChemDoodle. Not being rewritten: `hemoglobin-lab.html` supersedes it |
| `viewer-compare.html` | **deleted** with it — the ChemDoodle vs 3Dmol comparison; it loaded the library too |
| ↳ all three | intact on the local `chemdoodle-archive` branch, and in history. Nothing was lost, only unshipped |
| `molstar/` | settled — six stages, the thorough one. `molstar/README.md` is the detail behind this file's summary. Kept |
| `molstar/protein-molstar.html` | the Mol\* lesson prototype. Kept as the "what a viewer buys you" exhibit |
| `molstar/protein-inhouse.html` | the control arm, and the template for the `protein-lab` rewrite. Kept |
| `pdb.js`, `pdb/*.pdb`, `tools/check-pdb.js` | **still live.** No lesson loads `pdb.js`, but `molstar/protein-inhouse.html` and `molstar/protein-molstar.html` both call `PDBLib.orient()` at runtime, and `check-pdb.js` is the only test of its mirror guard. Do not delete it as orphaned code |
| `folding-lab-ribbon.html`, `folding/ribbon-test.html` | unrelated to this decision, and also kept — see `CLAUDE.md` |

**Read them as history, not as instructions.** Every one of those pages was
written to answer a question that is now answered here; where a page's own
header still argues for a renderer, this file overrides it.

## Consequences — what this decision obliges

1. **The ChemDoodle pages are deleted** — done, see the table above. This
   discharges the licence obligation rather than deferring it: **no page in this
   repo is GPLv3 any more.**
2. **`protein-lab.html` is NOT rewritten.** This was going to be the one open
   item; it is closed instead, because `hemoglobin-lab.html` already teaches
   the four levels — and teaches them better, on a single molecule, where the
   old page needed lysozyme for 1–3 and an antibody for 4 and a swap in
   between. Nothing is missing from the curriculum, so nothing is owed here.
   (`molstar/protein-inhouse.html` remains the proof that a tetramer renders
   fine on our own stack, if a future lesson wants one.)
3. **`CLAUDE.md`'s page table and module notes** stop describing `protein-lab`
   as a different kind of page that shares nothing but `pdb.js` and
   `sandbox.css` — done. Should a future lesson ever need a deposited
   structure, write it as an ordinary Three.js page in the shape of
   `folding-lab` / `hemoglobin-lab`; do not reintroduce a viewer abstraction.

Deleting `molstar/` belongs to the **production-repo move**, along with dropping
the scratch data and the bake tooling — not to this decision.

### Why this was not deferred to that move

**Anything that loads ChemDoodle is GPLv3, and so is anything built from it.**
That was fine here: this repo is open source and publishes its own source from
the working tree, which is what the GPL asks for. It stops being automatically
fine the moment the work is repackaged under a different licence, or a page
derived from it is shipped somewhere that does not publish source.
ChemDoodle's own vendored README called it a one-way door for a reason — GPL'd
pages cannot be relicensed permissively later without every contributor
agreeing. Removing the library before that door mattered is why the question
never has to be answered under deadline.

---

## Findings worth keeping from the evaluations

Kept here because the folders holding them are scheduled for deletion, and
because each one cost real time to find.

- **A mirror preserves every distance.** Building a fold path by interpolating
  dihedrals, we measured the dihedral with one sign convention and rebuilt with
  the opposite. The two errors cancelled exactly: the final frame reproduced the
  deposited coordinates to 0.00000 Å, every geometric assertion passed, and the
  entire animation was a left-handed mirror image. Caught only by measuring
  φ/ψ back off the built frames. Same class of error `tools/check-handedness.js`
  exists for, and the same lesson — distance checks are blind to handedness by
  construction.
- **A viewer that always frames the scene is doing the helpful thing and the
  wrong thing.** Any renderer that fits the camera to its contents will draw a
  20-residue helix and a whole tetramer at the same size on screen, with every
  caption still true and the relative-scale lesson silently gone. Our own
  `Stage.frame` has the same property. Where relative scale is the point, one
  radius must be pinned across every view, deliberately.
- **`Box3.getBoundingSphere` returns the sphere around the box** — its
  half-diagonal — which reported 9.7 nm for a molecule whose true extent is
  7.1 nm. For anything that has to agree with another measurement, use centroid
  plus maximum distance over a stated atom set.
- **`requestAnimationFrame` is suspended in a backgrounded tab.** A naive fps
  counter reports `0 fps` for a perfectly healthy page, and an automated
  screenshot reads a paused tab as a dead renderer. This wasted time three
  separate times during the Mol\* evaluation; it is also why `CLAUDE.md` warns
  against trusting a single screenshot.
- **Amide hydrogens are absent from X-ray structures.** 2HHB has none, so any
  H-bond calculation over it finds zero until they are placed geometrically.
  `folding/folding.js`'s solver works on 1VII because NMR structures carry them.
- **A solver tuned for one molecule is not a general solver.** `FoldLib.Folder`,
  which folds villin correctly, overwound a 20-residue fragment: Cα(i)–Cα(i+4)
  came out 4.76 Å against a deposited 6.29. Re-tuning it for the fragment would
  have made `folding-lab`'s numbers depend on an unrelated page.
