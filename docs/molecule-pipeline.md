# How a molecule gets into the library

`molecules.js` grew one app at a time, and so did the ways of getting geometry
into it. There are now **four** different paths a spec can have taken, nothing in
a spec records which one it took, and only some of them can be re-run. This doc
is the audit and the plan to fix it.

It is the companion to
[chemistry-rendering-libraries.md](chemistry-rendering-libraries.md), which
settles what *draws* a molecule. This one is about where the numbers come from.

## How accurate does this actually need to be?

Read this before adding rigour anywhere below. **These are AP Biology lessons,
not a structural biology pipeline**, and the two want different things.

The failure that matters here is **a wrong lesson** — a mirrored sugar, a
mislabelled atom, a diagram that shows α where the text says β. The failure that
does *not* matter is a bond half a degree off a diffraction result. Every
molecule in this library is a textbook fact rendered legibly, at stylised radii
that are already far from real, on a page whose job is to make one difference
visible.

So the checks that earn their keep are the ones catching **internal
disagreement** — geometry against its own declaration, `smiles` against `atoms`,
a doc against the code. Those are cheap, offline, and they catch the errors that
actually reach a student. Reaching outside for a measured structure is a
tiebreaker for the rare claim our own checks structurally cannot settle, and
almost never the right next move. Item 6 says where that line falls.

The plan below is therefore mostly about **not losing work** — provenance,
reproducibility, one way in — rather than about precision. That is the part that
scales to more apps.

## The four paths, as they actually exist

**1. Hand-written coordinates.** `water`, `nacl`, `kcl`, `ethanol`, `ammonia`,
`methane`, `co2`, `carbonic`, `bicarbonate`, `hydronium` — the solvation set.
Each bond length was chosen individually to clear its two display radii, so the
implied scale runs ~1.2–1.6× and varies *within* a molecule. This is the "family
A" the header comment in `molecules.js` warns about.

**2. PubChem SDF → converter.** `tools/sdf2spec.js` for the amino acids (it
forces the library's fixed backbone order, because `pep:{…}` and
`aminoacid-lab.html` index into it), `tools/sdf2spec-generic.js` for everything
else that keeps the record's own atom order. Real ångströms × one global
`SCALE` of 1.9 — "family B". Used for the amino acids, `palmitate`,
`palmitoleate`, `amp`.

**3. Built in code from idealised geometry.** The `Skel` builder plus the `GL`
and `AR` bond-length tables construct the molecule from VSEPR angles at load
time. This covers **every glycolysis intermediate and every contrast sugar and
base** — `glucose`, `galactose`, `ribose`, `deoxyribose`, `maltose`,
`cellobiose`, `purine`, `pyrimidine`, `g6p` through `pyruvate`. These never
touched PubChem.

**4. Derived from another spec, in file.** `dAlanine` is `alanine` with one
coordinate component negated — a reflection, computed at load time.

The important thing this survey turned up: **paths 2 and 3 are both "family B"
and look identical in the file**, but one is measured and one is constructed.
Nothing in a spec distinguishes them, and they fail in different ways.

## What can be re-run today

| Path | Reproducible? | Why |
|---|---|---|
| 3 (Skel-built) | **Yes**, completely | the code *is* the source; re-running the file regenerates the coordinates |
| 4 (mirrored) | **Yes**, completely | same — it is four lines of transform |
| 2 (PubChem SDF) | **No** | both converters read `${name}.sdf` from the working directory, and no `.sdf` is committed anywhere. Re-fetching does not rescue it either — see item 0: only 4 of 9 reproduce |
| 1 (hand-written) | N/A | hand-authored numbers are their own source, but no per-number reasoning is recorded |

So the molecules whose geometry is *measured against reality* are exactly the
ones we cannot re-derive or re-check, and the ones we can regenerate perfectly
are the ones with no external reference at all. Items 1–4 address the first half.
The second half mostly does not need addressing — see the calibration note above
and item 6.

Set against that, the checking story is now genuinely good. Each spec carries up
to three descriptions of the same molecule — coordinates, `names`, `smiles` — and
`check-molecules.js` audits their agreement plus every declared
stereo/topology/chirality claim, with no runtime dependency.
`tools/spec2smiles.js` regenerates `smiles` from the spec so it cannot drift.
The gap is that nothing plays that role for the path-2 coordinates.

## Should this be a database?

No, and the reasons are worth writing down because the file's size invites the
question every few months.

What `molecules.js` actually holds, measured:

| | |
|---|---|
| 1,694 lines / 100 KB | 37 specs, **539 atoms in total** |
| all geometry flattened to JSON | **36 KB** |
| literal coordinate lines | 194 — **11%** of the file |
| comment lines | 668 — **39%** of the file |
| specs that do not exist until the file *runs* | **16 of 37** |

**Sixteen of the thirty-seven molecules are not data.** They are constructed from
VSEPR angles by `Skel` at load time. A generator cannot live in a table; storing
them would mean freezing the generator's output, which destroys the one property
that makes those specs the best-provenanced in the library — path 3 is fully
reproducible *because the code is the source*. A database would turn the most
reproducible molecules here into the least.

**Thirty-nine percent of the file is reasoning, and the reasoning is the
product.** JSON has no comments and a database has no diff. This repo's rule is
that a claim ships with its assertion; that only works while the prose sits next
to the thing it describes. A data store either strands it or splits it into a
second layer that drifts — the failure `tools/check-docs.js` exists to catch.

**Scale is nowhere near the threshold.** 539 atoms, 36 KB of geometry, no build
step. And there is no query workload: pages address molecules by name, which is
already an O(1) lookup.

The real costs are that one 1,694-line file is hard to navigate, and that all
eight pages load all 37 specs — `water-lab.html` pays for 13 sugars it never
shows. Both are addressed by splitting files (items 3 and 4 below), not by
changing where the data lives.

**Revisit only if** a single page's unused payload becomes a measurable cost, or
the library passes roughly 150 molecules. Even then the answer is per-domain
files plus a manifest, loaded by the pages that need them — committed, diffable,
greppable. The filesystem is the right amount of database for 36 KB.

## The plan

Ordered by value per unit of risk. Items 1–6 are additive and safe; item 7 can
break working physics and may never be worth doing.

### 0. The reproducibility sweep — run 2026-07-30, and it failed

Before designing anything, every path-2 spec was re-fetched from PubChem and
re-converted, then compared against what is committed. **Four of nine
reproduce.** The results are the reason item 1 looks the way it does.

**This is about regenerating, not about rendering.** Every spec below is correct
and every page works — `check-molecules.js` passes on all of them. What the sweep
measures is whether a committed spec could be *rebuilt* from its source today.
The converters are Node tools run at a terminal; no page loads one.

| Spec | Can it be regenerated? |
|---|---|
| `glycine`, `alanine`, `serine`, `cysteine` | **yes, exactly** — 0.000 coordinate delta; bonds identical up to endpoint order |
| `proline` | **no** — the converter throws on it |
| `glutamine`, `glutamate` | no — side-chain rotamer differs |
| `palmitate`, `palmitoleate` | no — fetched has 32 H, committed has 1 |
| `amp` | no — fetched has 14 H, committed has 12 |

The four that reproduce are exactly the four `tools/README.md` documents. Every
other spec took an extra step between the record and the file:

- **`proline` breaks the converter's unstated precondition.** `reindex` assumes
  the backbone order `0 N · 1 H · 2 H · 3 Ca`, i.e. two hydrogens on the amino
  nitrogen. Proline's is secondary — one H, one bond into its own side-chain ring
  — so slot 2 has nothing to fill it and `sdf2spec.js` throws a `TypeError`. It
  is the one proteinogenic amino acid the amino-acid converter cannot take, which
  is also, not coincidentally, the fact `contrast-lab.html` teaches about it.

  The committed spec is nevertheless fine, and is the **best-annotated of the
  nine**: `molecules.js` records that it came from CID 145742, was reindexed *by
  hand* into the fixed order, and was then put through `sdf2spec.js`'s `reframe()`
  alone. So this one is not an undocumented step — it is a documented manual
  workaround. What it costs is that the tool in item 4 will hit the same wall the
  moment anyone regenerates proline or adds another secondary-amine residue.
- **`glutamine` and `glutamate` differ by a rotamer, not by noise.** The
  deviation climbs monotonically outward from the backbone: N 0.5, CG 1.5,
  CD 2.3, NE2 5.3, terminal H 7.1. The backbone reproduces; the flexible tail
  does not. **A CID alone does not identify a conformer** — PubChem 3D records
  carry `PUBCHEM_CONFORMER_ID`, and for anything with a rotatable side chain
  that is the field that has to be pinned.
- **`palmitate`, `palmitoleate` and `amp` were post-processed.** The fatty acids
  had their nonpolar hydrogens stripped (32 H down to the single acid H); `amp`
  was deprotonated to the anion its own `note:` describes. Both are correct
  decisions. Neither is written down anywhere.

None of this is drift or rot, and nothing here is a bug on a page — the specs are
right and the lessons render correctly. The gap is that for five of the nine, the
transformation from record to spec exists only in whoever ran it (proline
excepted, which wrote it down). That is what makes the sweep worth repeating
after any change to the converters.

### 1. Record provenance *and* transformation in the spec

A `src:` field on every molecule. The sweep above shows it cannot just name a
database row — it has to describe what happened to it:

```javascript
src:{ path:'pubchem', cid:5961, conformer:'0000174900000002',
      record:'3d', strip:'nonpolar-H', charge:-1, fetched:'2026-07-30' }
src:{ path:'skel' }                    // built by the code below it
src:{ path:'mirror', of:'alanine' }
src:{ path:'hand' }
```

`conformer`, `strip` and `charge` are the three fields the sweep proves are
load-bearing; without them five of nine specs cannot be regenerated even in
principle. This is also the precondition for auditing path 2 at all.

The CID must be the **anomer- or stereo-specific** record: PubChem's generic
`glucose` (CID 5793) reports one undefined stereocentre and its SMILES leaves the
anomeric carbon unmarked, which would silently describe a different molecule than
the spec claims. β-D-glucopyranose is CID 64689, α is 79025.

### 2. Commit the SDF inputs

Roughly ten small text files. No new tooling, and it closes path 2's gap on its
own — the coordinates become checkable against the record they came from. Do
this with item 1 or before it.

### 3. Extract the builder into its own module

`Skel` plus the `GL` and `AR` bond-length tables is about 212 lines of code that
has nothing to do with any particular molecule. It is a library sitting inside a
data file, and it is an eighth of the file's bulk.

Pulling it out as `skel.js` makes it independently testable, which item 5 wants
anyway — the stereo work runs straight through `ringNormal` / `equatorial`. It
also draws the line this doc is really about: the builder is *code*, the specs
are *data plus reasoning*, and they have different rules for changing.

Low risk, mechanical, and it should happen before the tool in item 4 starts
writing specs.

### 4. One entry point, and it owns its output

A single `add-molecule` tool that fetches, converts, runs `check-molecules.js`,
and emits the spec with `src:` already filled. It should **wrap** the two
existing converters, not replace them — the amino-acid reindexing contract is
real and worth keeping separate.

The sweep in item 0 is its requirements list. The tool has to own the three steps
that are currently done by hand and unrecorded — **conformer pinning**,
**hydrogen stripping**, and **protonation state** — plus the fourth that *is*
recorded but only in prose: the **secondary-amine backbone**, where proline's
ring nitrogen breaks `reindex`'s fixed order. Supporting it or refusing it with a
message pointing at proline's comment in `molecules.js` are both fine; a
`TypeError` out of `reindex` is not. Nothing is broken today — proline's spec is
committed and correct — but this is the first wall the one-way-in tool hits.

**The tool writes to a file it owns outright, which humans never edit.**
Programmatically editing a 1,694-line hand-authored source file is a codegen
problem nobody wants; the underscore-prefixed convention already in `demos/`
(`_generated-specs.json`, `_old-specs.json`) is the precedent, and
`tools/check-docs.js` already excludes `_`-prefixed files from the sources it
audits. This keeps the generated and the hand-authored halves of the library
separable by inspection — the distinction the four paths above have been missing
all along.

Today the end-to-end method is three manual steps and a README; that is the
thing that does not scale to more apps.

### 5. Close the mirror gap

`check-molecules.js` states plainly that `stereo:{faces:…}` is a relative
pattern only and **cannot catch a global mirror** — it names `ribose` and
`deoxyribose`. Those two carry no absolute-configuration claim; `chirality:` is
asserted only on the amino acids.

This matters more now that `haworth.js` projects the 2D diagram from the same
geometry. Its ring-normal anchoring convention (the D-sugar exocyclic carbon is
drawn up) is currently the only thing standing between a mirrored spec and a
diagram that renders beautifully and teaches the wrong sugar.

Two independent ways to close it; either is enough:

- **Generate `smiles` for the sugars too.** Never drawn — Haworth handles those —
  but committed purely as a checked assertion. RDKit's round-trip distinguishes
  `[C@H]` from `[C@@H]`, which is exactly the discrimination `faces` lacks.
  `tools/spec2smiles.js` currently skips `class:'sugar'`, so this is a
  one-condition change.
- **Extend the signed-volume chirality check** to a sugar's configurational
  carbon, the way `chirality:'L'` already works for amino acids.

The first is less code and adds a second independent witness; prefer it. Item 6
offers a third route, and the only one that settles handedness against a
measurement rather than by internal consistency.

### 6. Reach for a measured structure only when a claim is genuinely in doubt

Path 3 is perfectly reproducible and unvalidated against anything external, and
`check-molecules.js` can only prove the geometry matches what a spec *declares*.
That gap is real. It is also, for this project, usually not worth closing.

**These are AP Biology lessons.** The declarations come from textbook
stereochemistry that is not in dispute — galactose differs from glucose at C4 in
every source there is. What could plausibly go wrong is our *builder* disagreeing
with our *declaration*, and `check-molecules.js` already catches exactly that.
Diffraction data adjudicates a question nobody is asking.

So this is a **tiebreaker for a specific kind of doubt**, not a validation pass
over the library. Reach for it when the textbook does not settle the point and
our own checks structurally cannot — which is a short list:

- **Furanose pucker and face assignment.** `stereo:{faces:…}` is relative-only by
  construction, ribose and deoxyribose carry no absolute-configuration claim, and
  a five-membered ring is too flat for axial/equatorial to mean much. This is the
  one place where a measurement earns its keep — and even here, the cheaper
  SMILES route in item 5 may settle it first.
- **A new molecule whose conformation is the lesson** and which no textbook
  figure pins down.

Everything else — including the glucose/galactose pair — should rest on
`check-molecules.js` plus a human looking at the Haworth.

`tools/cod-check.js` exists for when that bar is met. It was run once, on
2026-07-30: `glucose` matches COD 2101292 on all five substituents (torsions
within 9.6°), and `galactose` matches COD 2101291 on C4, the axial –OH that is
the whole lesson (torsions within 3.4°). Those two answers are now known and do
not need re-deriving. **Record them in `validated:{}` and move on.**

The tool's header carries the reference-selection traps, which are the expensive
part and the reason this is a human job: predicted structures filed as
measurements, name searches that miss the structure you want, high-pressure
series in ordinary results, and an anomeric carbon that will disagree whenever
the crystal is the other anomer. Read it before trusting a new COD id.

**It is deliberately not wired into any check.** A crystal structure cannot go
stale, a network call inside a guard is a liability, and choosing the reference
needs judgement a script cannot supply.

### 7. Collapse the two scale families — last, or never

Store true ångströms and apply the display scale at render time. That would
retire the "a single page may only show molecules from ONE family" invariant,
which today is enforced by a comment and by nobody having broken it lately.

The cost is real: `water-lab.html` and `molecule-lab.html` hard-code `HL=1.55`
and tune their entire solvation engine around it — `EQ`, `MIN`, `hbThreshold`,
the ice lattice spacing. Rescaling water means re-tuning that physics. This is
the only item on the list that can break something that currently works.

### The constraint that spans items 4 and 7

**Regeneration must not renumber atoms.** `names`, `groups`, `gly`, `pep`,
`optH`, `contrast.diff`, and now `haworth.js` all address atoms positionally or
by name. A uniform rescale is safe for all of them; the reindex step in
`sdf2spec.js` is the actual hazard. Any regeneration path has to preserve atom
order or update every contract in the same commit.

## What we are deliberately not doing

**MolView's model.** Its source is worth reading — it stores no geometry at all.
Every structure is fetched at runtime as raw text (PubChem PUG-REST for small
molecules, RCSB for macromolecules, the Crystallography Open Database for
crystals), held as a single string plus a `"MOL"`/`"PDB"`/`"CIF"` tag, and handed
unparsed to whichever engine is loaded. Its 2D and 3D panes are never derived
from each other — the sketcher round-trips through a SMILES string and asks the
server for new 3D coordinates.

That is the right architecture for a general-purpose viewer with a search box,
and the wrong one here. We need geometry a check can audit *before* it ships,
stylised radii that force real decisions about bond length, and pages that work
offline from the working tree. Committed specs are the point, not a limitation.
Recorded because it is the obvious alternative and someone will propose it.

Note this is about *when* a source is read, not *which* sources are allowed.
Item 6 reaches for the same Crystallography Open Database MolView queries at
runtime — but once, at a terminal, with only the verdict committed. Every source
in this doc is a build-time input; none is ever a page dependency.
