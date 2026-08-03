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
| **ChemDoodle Web** | vendored in `vendor/chemdoodle/`, drives `protein-lab.html` | **remove** |
| **3Dmol.js** | evaluated in `viewer-compare.html`. A library NAME — there is no 3Dmol file in this repo and never was | **not adopted** |
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

- **ChemDoodle** colours a ribbon's two faces separately as a depth cue, with no
  way to say "this colour means α-helix." `protein-lab.html` flattens every
  colour pair to one value to stop students inventing a meaning for the second.
  It cannot colour a 3₁₀ helix at all — lysozyme has one at A 80–84, and the
  page can only name it in prose and admit the picture does not show it. Chain
  colours are not settable either: `chainLegend()` exists, with a 17-line
  comment, purely to read ChemDoodle's palette back OUT of the molecule so the
  key cannot contradict the picture.
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
`protein-lab.html` is the only GPLv3 page in this repo and is GPLv3 *solely*
because of that vendored copy. Removing it removes the obligation from the
project entirely. `vendor/chemdoodle/README.md` records the original accepted
trade-off; this file is where it stops being accepted.

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

## Status of the evaluation pages — all kept

Nothing here is scheduled for deletion. This is a prototype repo; the
evaluations are how the decision was reached and they are worth showing to
people. Each is now labelled **settled** rather than **pending**, which is the
distinction the old delete conditions actually cared about.

| | what it is now |
|---|---|
| `viewer-compare.html` | settled — ChemDoodle vs 3Dmol, the first comparison. Kept |
| `molstar/` | settled — six stages, the thorough one. `molstar/README.md` is the detail behind this file's summary. Kept |
| `molstar/protein-molstar.html` | the Mol\* lesson prototype. Kept as the "what a viewer buys you" exhibit |
| `molstar/protein-inhouse.html` | the control arm, and the template for the `protein-lab` rewrite. Kept |
| `vendor/chemdoodle/` | kept while `protein-lab.html` still loads it |
| `folding-lab-ribbon.html`, `folding/ribbon-test.html` | unrelated to this decision, and also kept — see `CLAUDE.md` |

**Read them as history, not as instructions.** Every one of those pages was
written to answer a question that is now answered here; where a page's own
header still argues for a renderer, this file overrides it.

## Consequences — what this decision obliges

1. **`protein-lab.html` is rewritten** on Three.js + `scene.js` +
   `folding/ribbon.js`. It is currently the only page loading ChemDoodle.
   `molstar/protein-inhouse.html` is most of the proof it will work — it already
   draws a whole tetramer with our DSSP, our palette and our haems. The rewrite
   also lets the page finally colour that 3₁₀ helix, which is the open item its
   own header flags.
2. **`CLAUDE.md`'s page table and module notes** stop describing `protein-lab`
   as a different kind of page that shares nothing but `pdb.js` and
   `sandbox.css`. After the rewrite it is an ordinary Three.js lesson that
   happens to read a deposited file — the same shape as `folding-lab`.
   `tools/check-pages.js` can then stop skipping it.

That is the whole list. Deleting `vendor/chemdoodle/`, `viewer-compare.html`
and `molstar/` belongs to the **production-repo move**, along with dropping the
scratch data and the bake tooling — not to this decision.

### The one thing to carry to that move

**`protein-lab.html` is GPLv3 for as long as it loads ChemDoodle**, and so is
anything built from it. That is fine here: this repo is open source and
publishes its own source from the working tree, which is what the GPL asks for.
It stops being automatically fine the moment the work is repackaged under a
different licence, or a page derived from it is shipped somewhere that does not
publish source. `vendor/chemdoodle/README.md` calls it a one-way door for a
reason — GPL'd pages cannot be relicensed permissively later without every
contributor agreeing.

So: no urgency, but do the rewrite **before** the production move rather than
after, so the question never has to be answered under deadline.

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
