# Chemistry rendering: which libraries, for which job

As we build more interactives we need molecules in the usual variety of formats —
3D ball-and-stick, flat 2D skeletal diagrams, and typeset chemical equations.
This doc records the recommendation and, more importantly, the reasoning, so we
don't re-litigate it every time a new lesson needs a new format.

Two candidates prompted the question: [Kekule.js](https://partridgejiang.github.io/Kekule.js/)
and [3Dmol.js](https://3dmol.csb.pitt.edu/doc/).

## The conclusion

**Don't adopt one big chemistry library. Split by job.** Kekule and 3Dmol are
both real, capable projects, but neither covers all three needs, and each
charges us something for the parts we don't need. The three formats are
genuinely different problems with different best tools.

| Need | Tool | Where it lives |
|---|---|---|
| Equations, charges, arrows | KaTeX + mhchem | runtime, all pages |
| 2D skeletal structures | SmilesDrawer (→ RDKit.js if it disappoints) | runtime, new `mol2d.js` module |
| 3D small molecules | our Three.js + `MolLib` | unchanged |
| 3D macromolecules | 3Dmol.js | later, own page only |
| Accurate 3D coordinates | PubChem / RDKit-Python | build-time script, output committed |
| Student *builds* a molecule | **nothing — custom `builder.js`** | see §Why the editor is the wrong genre |

## 1. Chemical equations → mhchem

Not a chemistry-library problem at all. **KaTeX plus the `mhchem` extension**
renders `\ce{CO2 + H2O <=> H2CO3 <=> H+ + HCO3^-}` properly — equilibrium
arrows, charges, states, stoichiometry, subscripts. Two script tags, no build
step, small. (MathJax has mhchem built in if we'd rather go that way.)

Highest-value, lowest-risk addition, and `molecule-lab.html`'s carbonic-acid
text needs it *today* — it's currently faking chemistry notation with HTML.

## 2. 2D structure diagrams → SmilesDrawer first

- **SmilesDrawer** — one script tag, no dependencies, small. Draws to canvas or
  SVG from a SMILES string, and exposes bond length / colour options, so it can
  be tuned toward the sketchbook look. For glycolysis intermediates and
  amino-acid skeletons this is almost exactly the tool.
- **RDKit.js** — real cheminformatics compiled to WASM. Better layouts,
  aromaticity handling, and substructure highlighting (nice for "highlight the
  phosphate that just moved"). Emits styleable SVG. Cost: multi-MB WASM
  download and an async init. Worth it only if SmilesDrawer's layouts
  disappoint, or when we want highlighting.
- **Kekule.js** — genuinely capable: 2D renderer *and* a structure editor, plus
  its own 3D view. But it's a large framework with its own widget system and
  CSS, it wants to own DOM regions, and it's less actively maintained than
  RDKit. **Skip it.** We initially kept it as the front-runner for "student
  draws a molecule" — see §*Why the editor is the wrong genre* below for why
  that turned out to be wrong.

## 3. 3D → keep our own Three.js renderer

3Dmol.js is excellent, but it creates and owns its own WebGL canvas. Adopting
it means running a second renderer alongside `Stage.create` and losing the
things that make these pages ours:

- cel outlines and toon shading
- the `FX` ring / glow / proton-hop system
- hydration `userData` that the solvation physics reads
- the `MolLib.PALETTE` radii that keep spheres from intersecting

That's a rewrite of our visual identity, not an extension of it.

3Dmol earns its place in exactly one case: **macromolecules**. If a lesson ever
shows a real enzyme, a membrane channel, or DNA from a PDB file, hand-authoring
specs is hopeless and 3Dmol's cartoon/ribbon styles are the right call. Bring
it in then as a *second paradigm on its own page* — which is consistent with
[the "share the plumbing, not the physics" principle](../SCIENCE.md) — never as
a replacement for `scene.js`.

## Why the editor is the wrong genre

We looked at Kekule's live editor demo
([Composer tutorial example](https://partridgejiang.github.io/Kekule.js/documents/tutorial/examples/composer.html)
— a working editor: bond/atom/ring/charge/arrow tools, and a `Get Molecules`
button that returns a machine-readable structure from the drawing). Verdict
after actually using it: **not what we want, and the reason generalizes.**

Composer is a **chemist's notation tool**. It assumes skeletal convention is
already known — implicit carbons, zig-zag chains, click-a-bond-again to cycle
single→double→triple, R-groups. Its purpose is to let someone who *already
knows chemistry* write it down faster. That's backwards for a student learning
what a molecule is: the notation is precisely the thing they don't have yet.

The thing we actually want is **drag elements in and snap them together** —
drag an O, drag two H, they join and you get water. Different genre entirely.
It teaches **valence and bonding capacity through the interaction**: you can't
attach a third H to oxygen because oxygen has no room. The rule isn't
explained, it's enforced. That passes the test in
[game-design-brainstorm.md](game-design-brainstorm.md) — you can't succeed
without understanding.

**No library does this.** Kekule, RDKit, SmilesDrawer are all built for
notation and analysis, i.e. for people who already know chemistry. A
pedagogical construction toy with snap-together valence rules is a **custom
interaction** and it's ours to write. Fine, because the hard parts already
exist: `Stage.buildMolecule`/`atom`/`bond` renders it, `MolLib.PALETTE` has
colours and radii for all nine elements we use, `FX.popGlow`/`spawnRing` gives
the bond-forming feedback, and `aminoacid-lab.html` already does
assembly-by-joining once.

### The missing piece is one line

Valence — bonding capacity — added to `PALETTE`. This is the whole ruleset:

```javascript
valence: { H:1, O:2, N:3, C:4, S:2, P:5, Na:0, Cl:1, K:0 },
```

A bond is legal only if both atoms have a free slot. That single check is what
makes the toy teach. `Na`/`K` at 0 is deliberate: they don't share, they hand
the electron over — so the ionic-vs-covalent distinction falls out of the same
rule rather than needing its own special case.

### Where the real work is: feedback, not chemistry

1. **Snap targets** — render open valence slots as faint ghost spheres at
   correct bond angles (104.5° for water) so geometry teaches too.
2. **Rejection** — an illegal bond must say *why* ("oxygen has no room left"),
   not silently fail.
3. **Recognition** — when the assembly matches a `MolLib.MOLECULES` entry, name
   it: "you made water." `MOLECULES` is already the answer key.

Planned as `builder.js` + `molecule-builder.html` — a draggable element
palette, valence-checked snapping, recognition against `MOLECULES`. Reuses
`Stage` and `FX` unchanged, adds one line to `PALETTE`, zero dependencies.
(`molecules.js:5` has referenced an "upcoming molecule-builder.html" all along.)

## The piece to prioritize: a data pipeline, not a runtime library

The real scaling bottleneck isn't rendering — it's **hand-writing
`MolLib.MOLECULES` coordinates**. Fix that offline rather than at runtime.

Fetch a 3D structure for essentially any named compound from PubChem PUG-REST.
No library, no API key:

```bash
curl -o g6p.sdf "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/glucose-6-phosphate/SDF?record_type=3d"
```

Then a small Node or Python script converts SDF → our `MolLib` spec format, and
we **commit the resulting JSON**. For anything PubChem lacks, RDKit (Python) or
Open Babel can generate and energy-minimize coordinates.

Payoff: scientifically accurate geometry, zero runtime dependency, no change to
how pages load, and our existing renderer keeps doing the drawing.

**Correction worth recording:** Kekule ships a
[3D Structure Generator demo](https://partridgejiang.github.io/Kekule.js/demos/index.html)
that generates 3D structure from a 2D connection table by force-field
calculation *entirely client-side*. So coordinate generation doesn't strictly
have to be build-time. It still should be for us — committed JSON costs nothing
at load and lets us hand-check geometry against the no-intersecting-spheres
rule — but Kekule covers more ground than first credited.

Also on that demos index: **Reaction Exercise**, a client-side organic
chemistry exam that scores student-drawn answers with no server. Worth a look
if a lesson ever asks students to produce a product structure.

## Caveats

- SmilesDrawer and KaTeX both ship their own default typography and colour, so
  each needs CSS work to sit comfortably next to `sandbox.css`'s cream-paper
  look. Budget for that; don't expect a drop-in match.
- Bundle sizes and current CDN versions above are **unverified** — pin exact
  versions when actually wiring anything up.

## Suggested first steps

1. **mhchem** into `molecule-lab.html`'s carbonic-acid text — it's currently
   faking notation in HTML. Small, immediate, visible.
2. **SDF → `MolLib` converter** for one glycolysis intermediate, to prove the
   build-time pipeline.
3. **`builder.js`** — the drag-to-assemble page. Biggest new lesson, and the
   only item here that needs design work rather than plumbing.

Note that none of the three requires adopting a chemistry framework. The
libraries worth taking are small and narrow (mhchem, SmilesDrawer); the
ambitious one (Kekule) we're declining on purpose.
