# Rendering libraries for proteins and macromolecules

Decided 2026-08-01, from the side-by-side in `viewer-compare.html`. That page is
the evidence, not documentation of it — keep it until the first real protein
page ships, then delete it.

This concerns **PDB-scale structures only** (proteins, nucleic acids, complexes).
Everything already in the sandbox — the hand-built specs in `mol-*.js`, drawn by
`scene.js` on Three.js — is unaffected and stays as it is.

## The decision

**ChemDoodle Web is the default. 3Dmol.js is the exception, used where it does
something ChemDoodle cannot.**

This is a split, not a winner. The two libraries lost to each other on different
axes, and neither margin was big enough to justify giving up the other's
strength.

### Why ChemDoodle is the default

Its cartoon simply looks better, and on a page whose whole job is to make a fold
legible to a 16-year-old, that is not a cosmetic preference. Its ribbon is thin
and flat where 3Dmol's is glossy plastic.

Its livelier default palette turned out to be **less** informative than it looks,
though, and the mistake is worth recording so nobody repeats it. ChemDoodle
colours the two *faces* of the ribbon differently — `proteins_primaryColor` /
`secondaryColor` for loops, `ribbonCartoonHelixPrimaryColor` / `SecondaryColor`
for helices. The red/yellow loops and green/purple helices are one depth cue, not
four structural categories. **ChemDoodle cannot distinguish a 3-10 helix at all**;
it has no style for one. A page that wants colour to carry meaning should flatten
each pair to a single value, as `protein-lab.html` does.

We tried to close the gap on the 3Dmol side and mostly failed:

- Thickening and rounding the ribbon (`thickness`, `width`, `style:'oval'`) made
  it visibly worse — bloated tubes, and the beta-strand edges disappeared. Reverted.
- The palette can be matched, and was: purple helix, tan sheet, yellow coil.
- 3-10 helices can be recovered, and were, but only by parsing the PDB `HELIX`
  record's class column by hand — 3Dmol's `atom.ss` is just `h`/`s`/`c`. See
  `PDBLib.helices()` in `pdb.js`. **This is a 3Dmol advantage, not a ChemDoodle
  one** — 3Dmol can be made to show 3-10 helices honestly and ChemDoodle cannot,
  which is a small point in the exception column above.
- The **gloss cannot be fixed.** 3Dmol exposes no per-material specular or
  shininess. The only levers are viewer-wide `setViewStyle` effects (ink outline,
  ambient occlusion), which change the look rather than flattening the lighting.
- ChemDoodle's two-tone loops — a different colour on each face of the ribbon,
  as a depth cue — are **out of reach entirely.** 3Dmol gives one colour per segment.

### Where 3Dmol wins, and therefore gets used

1. **Molecular surfaces.** ChemDoodle Web has none. Not a setting — no renderer.
   This is the whole membrane-transport unit: a channel has to look like a *hole*.
   Test structures: `2POR` (beta-barrel), `1BL8` (KcsA selectivity filter),
   `1J4N` (aquaporin).
2. **Nucleic acids.** 3Dmol's stick representation shows base pairing; the DNA
   reads better there than under ChemDoodle's ribbon. `1BNA`.
3. **Speed, if it ever becomes the constraint.** Measured on 1LYZ (1102 atoms):
   3Dmol 35–90 ms vs ChemDoodle 103–148 ms. On 1IGT (12 956 atoms): 368 ms vs
   779 ms. Consistently ~2x, but both are fast enough at these sizes that it
   changed nothing about the decision.

## Which style for which lesson

| Lesson | Style | Why |
|---|---|---|
| Protein structure levels (1LYZ, 1IGT) | Cartoon, by secondary structure | The coils and arrows *are* the concept |
| Quaternary structure (1IGT, 1AON, ribosome) | Cartoon, by chain | Colour is the argument: one colour per subunit |
| Channels and transport (1J4N, 1BL8, 2POR, GLUT1) | **Surface** + ligand in sticks | Shape and fit. A cartoon of a channel doesn't look like a hole |
| Cofactors and ligands (3CYT heme, 1ATN ATP) | Cartoon protein, sticks for the ligand | Keeps the ligand legible against the fold |
| DNA (1BNA) | **Sticks**, or cartoon + sticks on the bases | Base pairing has to be visible |

Avoid space-filling spheres for whole proteins: at that size it is an
undifferentiated blob, and it is the representation students most often mistake
for "what a protein really looks like."

## Licensing — settled, but not free

ChemDoodle Web is **GPLv3** (or a paid commercial licence). Shipping JS to a
browser is distribution, so the obligation is real: pages using it are GPLv3, and
the source must stay available. This repo publishes from the working tree and any
remix of it is meant to stay open anyway, so the copyleft costs us nothing we
wanted — but it is a one-way door. **GPL'd pages can never be relicensed
permissive without every contributor's agreement.**

Three.js (MIT) and 3Dmol.js (BSD-3) both combine with GPLv3 without conflict.

**ChemDoodle has no npm or CDN release.** `viewer-compare.html` loads the copy
iChemLabs serves for their own demo site, which is fine for an evaluation and is
not a shipping pattern — it uses their bandwidth and can vanish under us. Any
real page must vendor the distribution from web.chemdoodle.com into this repo,
with its licence file, and that vendored copy becomes ours to update.

## Open questions

- **1AON (GroEL/GroES, ~58k atoms) was never run.** It is the honest test of
  whether either library works on a school Chromebook, and nothing here should be
  taken as evidence about large complexes until it is.
- **Surface cost is unmeasured in the classroom case.** 3CYT (1743 atoms) took
  ~2 s to compute a surface on a developer laptop. A Chromebook will be several
  times worse, and surfaces are exactly what the transport lessons need. If it
  proves too slow, the fallback is precomputing rather than switching libraries.
- **Two viewers means two canvases.** Neither library shares a scene with
  `scene.js` — each brings its own WebGL context and camera. A page mixing a
  protein with hand-built molecules is a real integration, not a script tag.
  Using *both* libraries on one page is worse still; don't, without a reason.
