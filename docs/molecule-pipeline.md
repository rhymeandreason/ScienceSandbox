# How a molecule gets into the library

`molecules.js` grew one app at a time, and so did the ways of getting geometry
into it. **Five** paths exist and only some can be re-run. This doc is the audit
and the plan. Companion to
[rendering-modules.md](rendering-modules.md), which settles what *draws* a
molecule; this one is about where the numbers come from.

Until item 1 shipped, nothing in a spec recorded its path — which is how the
survey below came to list four rather than five, and how two constructed
molecules spent the sweep being measured against a record they were never derived
from. Every spec now carries `src:{path:…}` and `check-molecules.js` fails one
that doesn't.

## How accurate does this need to be?

Read this before adding rigour anywhere below. **These are Bio 101 lessons, not a
structural biology pipeline.**

The failure that matters is **a wrong lesson** — a mirrored sugar, a mislabelled
atom, a diagram showing α where the text says β. The failure that doesn't is a
bond half a degree off a diffraction result. Every molecule here is a textbook
fact rendered legibly, at stylised radii already far from real, on a page whose
job is to make one difference visible.

So the checks that earn their keep catch **internal disagreement** — geometry
against its own declaration, `smiles` against `atoms`, a doc against the code.
Cheap, offline, and they catch what reaches a student. Reaching outside for a
measured structure is a tiebreaker for the rare claim our own checks structurally
cannot settle (item 6), and almost never the right next move.

The plan below is therefore mostly about **not losing work** — provenance,
reproducibility, one way in — rather than precision. That's the part that scales.

## The five paths

**`MolecularGeometry.md` §1.2 defines them and says which to choose** — that's the
canonical list, and the one an author reads while adding a molecule. Repeated
here only as the index this doc's verdicts hang off:

| Path | `src.path` | Population |
|---|---|---|
| 1 · hand-written coordinates | `hand` | the solvation set (family A) |
| 2 · PubChem SDF → converter | `pubchem` | the amino acids, `amp` (family B) |
| 3 · built in code from VSEPR | `skel` | every glycolysis intermediate, every contrast sugar and base |
| 4 · derived from another spec | `mirror` | `dAlanine` |
| 5 · constructed by hand from literals | `built` | `palmitate`, `palmitoleate` |

The survey's real finding: **paths 2, 3 and 5 are all family B and look identical
in the file**, but one is measured and two are constructed differently, and they
fail differently. `src:` is now that distinction.

### What can be re-run today

| Path | Reproducible? | Why |
|---|---|---|
| 3 (Skel-built) | **Yes**, completely | the code *is* the source |
| 4 (mirrored) | **Yes**, completely | four lines of transform |
| 2 (PubChem SDF) | **Mostly, now** | item 2 committed the inputs: 5 of 7 rebuild exactly, `proline` needs its hand reindex, `glutamine`/`glutamate` have no published source any more |
| 1 (hand-written) | N/A | the numbers are their own source; no per-number reasoning recorded |
| 5 (built from literals) | N/A | same, but `src.method` records the construction in one line |

So the molecules *measured against reality* are exactly the ones we can't
re-derive, and the ones we regenerate perfectly have no external reference at
all. Items 1 and 2 address the first half. The second half mostly doesn't need
addressing — see the calibration note above and item 6.

The checking story is otherwise good: each spec carries up to three descriptions
of the same molecule — coordinates, `names`, `smiles` — and `check-molecules.js`
audits their agreement plus every declared stereo/topology/chirality claim, with
no runtime dependency. `tools/spec2smiles.js` regenerates `smiles` so it can't
drift. The gap is that nothing plays that role for path-2 coordinates.

## Should this be a database?

No, and the file's size invites the question every few months.

| | |
|---|---|
| 1,694 lines / 100 KB | 37 specs, **539 atoms total** |
| all geometry flattened to JSON | **36 KB** |
| literal coordinate lines | 194 — **11%** of the file |
| comment lines | 668 — **39%** of the file |
| specs that don't exist until the file *runs* | **16 of 37** |

- **Sixteen of thirty-seven aren't data** — they're constructed by `Skel` at load.
  A generator can't live in a table; storing them freezes the generator's output
  and destroys the one property that makes path 3 the best-provenanced thing here.
  A database would turn the most reproducible molecules into the least.
- **Thirty-nine percent of the file is reasoning, and the reasoning is the
  product.** JSON has no comments, a database has no diff. A claim ships with its
  assertion, which only works while the prose sits next to what it describes.
- **Scale is nowhere near the threshold** — 539 atoms, 36 KB, no build step, and
  no query workload: pages address molecules by name, already O(1).

The real costs are that one 1,694-line file is hard to navigate and that all
eight pages load all 37 specs (`water-lab.html` paid for 13 sugars it never
shows). Both are fixed by splitting files (item 3), not by moving the data. The
answer at any size is **per-domain files plus a manifest** — committed, diffable,
greppable. The filesystem is the right amount of database for 36 KB and stays so
at 150.

## What this plan is for: the curriculum expansion

**The remaining curriculum is counted.** The gap to full Bio 101 coverage is
**~27 molecules**, **~34** counting everything flagged — roughly doubling a
library of 37. The big absences: no positively charged amino acid side chain at
all (so no salt bridge, no pH-dependent charge), no ATP or ADP despite `amp`, no
nucleotides or base pairs behind the existing purine/pyrimidine contrast, and
nothing to esterify `palmitate` onto, so the membrane lesson has no molecule.

That total settles the database question for good, and it lands **unevenly across
the paths**. Nucleobases, sucrose, fructose, glycerol and the base pairs are path
3 — the code is the source, they need nothing from this plan. But six amino
acids, ATP, ADP, NAD⁺/NADH, FAD/FADH₂, acetyl-CoA, cholesterol, chlorophyll a and
the phospholipid — **fifteen molecules — go through path 2**, the one path item 0
proves can't be regenerated five times in nine. They're also its worst cases: ATP
and ADP build on `amp`, whose deprotonation was one of the five apparent
failures, and the large cofactors make hydrogen-stripping unavoidable.

**An agent adds each entry.** This inverts the case for item 4 and strengthens
items 1 and 2. Item 4 argues that "three manual steps and a README" doesn't
scale — a claim about *human effort per molecule*, and an agent running three
terminal steps doesn't tire at molecule twenty. What agent authoring does not fix
is item 0's actual finding: every failure was an **unrecorded judgement call**
(strip the nonpolar hydrogens, deprotonate to the anion, accept whatever rotamer
the record served). An agent is *more* exposed to that — it makes the call
correctly and invisibly, and carries nothing between sessions, so the agent
adding ATP can't learn what the agent that added AMP decided. The gap is
provenance, not ergonomics.

## The plan

**Do items 1, 2, 3, 5 before the expansion; add item 8. Item 4 isn't worth
building; items 6 and 7 stay put.** Numbering is unchanged from the original
draft because six places cite it.

| Item | Verdict | Why |
|---|---|---|
| 1 · provenance in the spec | **DONE** | all 37 specs carry `src:`; checker enforces it |
| 2 · commit the SDFs | **DONE** | 8 files in `tools/sdf/`; 5 of 7 rebuild exactly |
| 3 · extract the builder **+ split per-domain** | **DONE** | 7 files; all 37 specs byte-identical; water-lab loads 10 not 37 |
| 4 · one entry point | **skip** | solves human labour an agent doesn't spend |
| 5 · close the mirror gap | **DONE** | found every sugar was the L-enantiomer; fixed |
| 6 · measured structures | **unchanged — record and move on** | the doc argues itself out of this |
| 7 · un-bake the display scale | **DONE for family B** | specs store real Å; family A still last-or-never |
| 8 · make the checkers unskippable | **DONE** | pre-commit hook, 3 offline checkers, 4 negative tests |

Items 1–6 are additive and safe; item 7 can break working physics.

### 0. The reproducibility sweep — run 2026-07-30, and it failed

Every path-2 spec was re-fetched from PubChem, re-converted and compared against
what's committed. **Four of nine reproduce** — *both numbers wrong; the
correction below and item 2 make it five of seven.*

**This is about regenerating, not rendering.** Every spec below is correct and
every page works; `check-molecules.js` passes on all of them. The sweep measures
whether a committed spec could be *rebuilt* from its source today.

| Spec | Can it be regenerated? |
|---|---|
| `glycine`, `alanine`, `serine`, `cysteine` | **yes, exactly** — 0.000 delta; bonds identical up to endpoint order |
| `proline` | **no** — the converter throws on it |
| `glutamine`, `glutamate` | no — side-chain rotamer differs, and the source conformer is no longer published |
| ~~`palmitate`, `palmitoleate`~~ | **not path 2 at all — see the correction** |
| ~~`amp`~~ | **overturned — reproduces exactly.** See item 2 |

> **Correction, made while implementing item 1.** The fatty acids don't belong in
> this table. Their comments in `molecules.js` and `tools/README.md` both say
> plainly they were **constructed** — idealised all-anti zigzag at 109.5°,
> united-atom, written in as literals — never PubChem conversions. The sweep
> fetched a record they weren't derived from, found 32 hydrogens against 1, and
> recorded that as a stripping step. There was none: a united-atom spec has one
> hydrogen because that's what united-atom *means*.
>
> They now carry `src:{path:'built'}`. The misreading was available because
> §1.2 enumerated three geometry sources when five existed, so "constructed from
> literals" had no category and fell into the nearest one. It now lists all five.
>
> **So the real result is 4 of 7 path-2 specs reproducing, not 4 of 9** — better
> than recorded, one fewer failure mode. The `strip` field survives, but on
> current evidence only `amp` may need it.

The four that reproduce are exactly the four `tools/README.md` documents. Every
other spec took an extra step between record and file:

- **`proline` breaks the converter's unstated precondition.** `reindex` assumes
  backbone order `0 N · 1 H · 2 H · 3 Ca` — two hydrogens on the amino nitrogen.
  Proline's is secondary, so slot 2 has nothing to fill it and `sdf2spec.js`
  throws a `TypeError`. It's the one proteinogenic amino acid the converter can't
  take, which is also, not coincidentally, what `contrast-lab.html` teaches about
  it. The committed spec is fine and is the **best-annotated of the nine**: CID
  145742, reindexed *by hand*, then put through `reframe()` alone. A documented
  manual workaround, not an undocumented step.
- **`glutamine` and `glutamate` differ by a rotamer, not noise.** Deviation
  climbs monotonically outward from the backbone: N 0.5, CG 1.5, CD 2.3, NE2 5.3,
  terminal H 7.1. The backbone reproduces; the flexible tail doesn't. **A CID
  alone does not identify a conformer** — `PUBCHEM_CONFORMER_ID` is the field to
  pin for anything with a rotatable side chain.
- **`amp` was NOT post-processed** (settled by item 2; the spec's comment was
  right). It's committed as the dianion because the record supplies the dianion:
  CID 15938965 rebuilds it to 0.0000. The sweep queried the *name* `AMP`, got CID
  6083 (neutral acid, two extra H), and read the difference as stripping. **The
  lesson is about identifiers, not hydrogens:** a name query pins neither a
  stereocentre nor a charge state.

None of this is drift and none is a bug on a page. The gap is that for five of
nine, the transformation from record to spec existed only in whoever ran it —
which is what makes the sweep worth repeating after any converter change.

### 1. Record provenance *and* transformation in the spec — DONE

All 37 specs carry `src:`, and `check-molecules.js` fails one without.
Coverage: `hand` 10 · `pubchem` 8 · `skel` 16 · `built` 2 · `mirror` 1.

Three things came out differently from the sketch:

- **Five paths, not four.** `built` is a real category the original survey folded
  into path 2. Finding it produced item 0's correction.
- **`skel` is stamped, not written.** `Skel.prototype.spec` defaults
  `src:{path:'skel'}`, so all 16 are labelled without anyone deciding to, and so
  will the next one. A field that needs remembering goes stale; this one can't.
- **A three-value rule was necessary.** Present / `null` / absent mean decided,
  *deliberately never pinned*, and not applicable. `conformer:null` on all 8
  pubchem specs is load-bearing — an active claim that item 0's rotamer failure
  applies. The checker tests `'conformer' in src`, not truthiness, so a null
  can't be tidied into an absence.

The audit is **unconditional** — unlike `stereo:` or `chirality:`, a spec can't
decline it. The design sketch is kept only because items 2 and 4 cite its fields:

```javascript
src:{ path:'pubchem', cid:5961, conformer:'0000174900000002',
      record:'3d', strip:'nonpolar-H', charge:-1, fetched:'2026-07-30' }
src:{ path:'skel' }                    // built by the code below it
src:{ path:'mirror', of:'alanine' }
src:{ path:'hand' }
```

`conformer`, `strip` and `charge` are the three the sweep proves load-bearing.
The CID must be the **anomer- or stereo-specific** record: PubChem's generic
`glucose` (CID 5793) reports an undefined stereocentre and leaves the anomeric
carbon unmarked in its SMILES. β-D-glucopyranose is CID 64689, α is 79025.

### 2. Commit the SDF inputs — DONE

Eight files, 36 KB, in `demos/tools/sdf/`, with a README carrying the per-file
table and a `.gitignore` for converter outputs. Every `path:'pubchem'` spec names
its input in `src.sdf`, and `check-molecules.js` fails if it's missing.

Re-running the sweep with the records in hand changed two verdicts:

| | before | after |
|---|---|---|
| `glycine`, `alanine`, `serine`, `cysteine` | exact | exact — confirmed |
| `amp` | "deprotonated, unrecorded" | **exact** — wrong CID had been fetched |
| `proline` | converter throws | throws — confirmed, `regen:'manual'` |
| `glutamine`, `glutamate` | "rotamer differs" | **worse: source gone**, `regen:'lost'` |

**`glutamine` and `glutamate` cannot be pinned at all.** All ten published
conformers of each CID were fetched and converted; none reproduces the committed
spec (best |Δ| 6.357 and 5.827). PubChem regenerates conformer sets and the
originals are gone, so `conformer:` stays null — not unpinned, but with nothing
left to pin to. The committed `.sdf` is the closest available record, explicitly
not a reproduction, and **the specs are now their own source**. Both carry a
warning not to refresh them: the amide's edge-on presentation is a property of
the lost conformer, and the contrast lesson depends on it.

That case sharpens the argument for this item: committing inputs isn't only about
re-running a converter, it's about the window closing. Two specs fell out of that
window before anything was committed and nothing here would have noticed.

### 3. Extract the builder, then split the specs per domain — DONE

`molecules.js` went from 1,861 lines holding everything to a 250-line core
holding no specs:

| File | Lines | |
|---|---|---|
| `molecules.js` | ~250 | PALETTE, SCALE, VIEW, the empty registry, the DOMAINS manifest |
| `skel.js` | ~346 | the builder: Skel, GL/AR, ring and chain scaffolds |
| `mol-solvation.js` | ~157 | family A, needs no builder |
| `mol-monomers.js` | ~356 | family B, PubChem + literals, needs no builder |
| `mol-glycolysis.js` | ~222 | needs skel.js |
| `mol-contrast.js` | ~675 | needs skel.js and mol-monomers.js |
| `lib-node.js` | ~30 | loads everything for the checkers, by walking DOMAINS |

**All 37 specs are byte-identical afterwards, in the same key order** — verified
by deep-comparing against the pre-split file. No coordinate moved.
`water-lab.html` went from 37 specs to 10, and **four of eight pages no longer
load the builder at all**. A page's script tags are now the statement of what it
shows.

**The manifest is `MolLib.DOMAINS`.** Four Node consumers each needed the full
library, and four hand-maintained copies of a load order is exactly the
enumeration failure this repo keeps hitting. They all go through `lib-node.js`,
which walks the manifest; adding a domain means editing one list, and
`check-docs.js` asserts every name in it is a real file.

**The split falsified a documented invariant.** `tests/aminoacid-lab.html` builds
`MOLECULES.water` for every dehydration it shows, so a family-A water (O–H 1.55)
sat among family-B residues that would draw it at 1.84 — **~16% short** — while
`molecules.js` asserted the opposite. It survived because the dependency was
invisible: every page loaded every spec, so nothing distinguished "uses water"
from "happens to have water in scope". Splitting forced the page to name
`mol-solvation.js` in its script tags and the exception fell out of the first
load-check. **The split doesn't just reduce payload, it makes cross-domain
dependencies say their own names.** (Left unfixed at the time — rescaling water
means re-tuning the solvation engine — and later retired by item 7's
`mol-small.js`.)

Two rules the original plan set, both still binding:

- **Keep the manifest a committed, greppable index, not a loader that fetches.**
  Every source in this doc is a build-time input and none is ever a page
  dependency. Pages address molecules by name, and that keeps working unchanged.
- **An enumeration change invalidates docs mechanically.** `CLAUDE.md`'s module
  index and per-page script table both enumerate what a page loads, and
  `tools/check-docs.js` audits the table against the real `<script>` tags — it
  fails until they match. SCIENCE.md §1.5's family table needs a human. All three
  in the same commit.

Note `check-docs.js` reads `demos/` only, so **this doc is not audited by it** —
worth knowing when reading any plan here.

### 4. One entry point — designed, then declined

**Not being built.** Kept because someone will propose it again.

The design: a single `add-molecule` tool that fetches, converts, runs
`check-molecules.js` and emits the spec with `src:` filled, **wrapping** the two
converters rather than replacing them (the amino-acid reindexing contract is real
and worth keeping separate).

What killed it is its premise, that "three manual steps and a README" doesn't
scale — a cost in human attention per molecule, and the molecules are added by an
agent that pays it without complaint. Meanwhile the failures it was meant to
prevent are all recording failures, and `src:` records them for a fraction of the
work: a field an agent fills in, not a pipeline it has to be routed through.
**Item 1 captures the decisions, item 4 would have automated them**, and only the
first is load-bearing.

Two pieces worth salvaging:

- **The proline wall.** A `TypeError` out of `reindex` is a bad failure mode
  whether or not a tool wraps it. None of the six amino acids the expansion adds
  is a secondary amine, so it won't bite this round; fix it when a second
  secondary-amine residue is actually wanted. Supporting it, or refusing with a
  message pointing at proline's comment, are both fine.
- **A generating tool must write to a file it owns outright, which humans never
  edit.** Programmatically editing a hand-authored source file is a codegen
  problem nobody wants. The underscore convention `demos/` used for
  `_generated-specs.json` and `_old-specs.json` (deleted with `_compare.html`)
  is the precedent, and
  `check-docs.js` already excludes `_`-prefixed files. Item 3b doesn't achieve
  this on its own — its files are all hand-authored.

Had it been built, item 0's sweep would have been its requirements list: the
three steps done by hand and unrecorded — **conformer pinning**, **hydrogen
stripping**, **protonation state** — plus the **secondary-amine backbone**, which
is recorded but only in prose.

### 5. Close the mirror gap — DONE, and it was not hypothetical

Generating `smiles` for the sugars was meant to be a cheap belt-and-braces
assertion. On the first run, every Skel-built sugar came back as **the exact
mirror of its reference**: L-glucose, L-galactose, L-ribose, L-deoxyribose and
both disaccharides. The library had been shipping the wrong enantiomer of every
sugar it teaches.

**The control makes it conclusive.** Six `path:'pubchem'` specs run through the
identical spec → molblock → RDKit path match their references exactly, `dAlanine`
included — it comes back D, so the path reads both handednesses. And
`beta-D-glucopyranose` resolves to CID 64689, the same record item 1
independently names as the right anomer-specific reference.

**Why four checks all passed is in `MolecularGeometry.md` §1.3**, which is where
the rule now lives — a relative assertion cannot catch a global mirror. The
original item here called the Haworth anchoring convention "the only thing
standing between a mirrored spec and a diagram that renders beautifully and
teaches the wrong sugar". That was exactly right, and it had already happened.

**The fix needed two different changes, which is the technical lesson.**

| | root cause | fix |
|---|---|---|
| pyranoses | chair pucker phase inverted relative to ring traversal | one sign in `ringPyranose` |
| furanoses | UP/DOWN face tags inverted | swap the tags in `mol-contrast.js` |

Flipping the *furanose* frame the way the pyranose was flipped does **nothing**:
`equatorial()` is normal-sign-independent, so reversing traversal genuinely
mirrors a pyranose, but `face()` is sign-dependent, so reversing it flips the
normal and every substituent follows. Don't assume the two ring builders behave
alike.

**Blast radius, measured.** Every sugar coordinate moved. The Haworth 2D output
is **byte-identical** — the anchor was already forcing the right answer — so
`contrast-lab`'s diagrams are untouched and only the 3D models changed.
`check-molecules.js` still passes every stereo, topology, glycosidic and cis
claim, and `beta-maltose`/`beta-cellobiose` both match, confirming the α/β
distinction survived.

**`tools/check-handedness.js` is the record** (MolecularGeometry.md §1.3 for what
it does and when to run it). This also settles the doubt item 6 reserved for
furanose face assignment.

*Route chosen, from two candidates:* generate `smiles` for sugars too (a
one-condition change in `spec2smiles.js`, since RDKit's round-trip distinguishes
`[C@H]` from `[C@@H]` — exactly what `faces` lacks) rather than extending the
signed-volume chirality check to a sugar's configurational carbon. Less code, a
second independent witness, and it scales with the expansion's new furanoses for
free. Don't spend the chirality check on top.

### 6. Reach for a measured structure only when a claim is genuinely in doubt

Path 3 is perfectly reproducible and unvalidated against anything external, and
`check-molecules.js` can only prove geometry matches what a spec *declares*. That
gap is real, and usually not worth closing: the declarations come from textbook
stereochemistry nobody disputes — galactose differs from glucose at C4 in every
source there is. What could plausibly go wrong is our *builder* disagreeing with
our *declaration*, which `check-molecules.js` already catches. Diffraction data
adjudicates a question nobody is asking.

So this is a **tiebreaker for a specific doubt**, not a validation pass. The
short list:

- **Furanose pucker and face assignment.** `{faces}` is relative-only by
  construction, ribose and deoxyribose carry no absolute claim, and a
  five-membered ring is too flat for axial/equatorial to mean much. (Item 5's
  cheaper SMILES route settled this first.)
- **A new molecule whose conformation is the lesson** and which no textbook
  figure pins down.

Everything else rests on `check-molecules.js` plus a human looking at the
Haworth.

`tools/cod-check.js` exists for when the bar is met. Run once, 2026-07-30:
`glucose` matches COD 2101292 on all five substituents (torsions within 9.6°),
`galactose` matches COD 2101291 on C4, the axial –OH that is the whole lesson
(within 3.4°). Those answers are known — **record them in `validated:{}` and move
on.**

The tool's header carries the reference-selection traps, which are the expensive
part and why this is a human job: predicted structures filed as measurements,
name searches that miss the structure you want, high-pressure series in ordinary
results, and an anomeric carbon that disagrees whenever the crystal is the other
anomer. Read it before trusting a new COD id. **It's deliberately not wired into
any check** — a crystal structure can't go stale, a network call inside a guard
is a liability, and choosing the reference needs judgement.

### 7. Un-bake the display scale — DONE for family B

Written as "collapse the two scale families", whose cost was that `water-lab` and
`molecule-lab` tune a solvation engine around `HL=1.55`. That cost is unchanged —
but it only applies to family A, and item 3 put family A in its own file, so the
tractable and risky halves are no longer the same change.

**What shipped.** Family-B specs store real ångströms: a spec declares
`units:'angstrom'` and `register()` multiplies by `SCALE` once as it joins the
registry; `units:'scene'` is left alone. `check-molecules.js` requires the field.

| | before | after |
|---|---|---|
| `skel` (16) | `GL.CC = 1.54*SCALE` | `GL.CC = 1.54`; `skel.js` has **no dependencies at all** |
| `pubchem` (8), `built` (2) | literals pre-multiplied by 1.9 | literals are ångströms |
| `mirror` (1) | — | `units:'scene'`: derived from an already-registered spec |
| `hand` (10) | — | `units:'scene'`, untouched |

The display scale is now **one number in one place**, moving 26 specs together;
it used to be multiplied into eleven sets of literals plus two tables.

**Applied at registration, not render** — deliberately. `Stage.buildMolecule`
isn't the only reader: `glycolysis-lab`, `contrast-lab` and
`haworth.js` index `spec.atoms[i].pos` directly and compare against
`PALETTE.radii`, which are scene units. Scaling at render would leave all of them
comparing ångströms to scene units. Registration is the seam every consumer is
downstream of.

**Verification.** The mechanical conversion moved runtime geometry by 1.5e-9
scene units (float round-trip only). The five specs that regenerate exactly were
then **reseated from their converters' full-precision output** rather than kept
as divided-down values, moving geometry by up to 0.001 Å — the source data's
resolution limit, ~0.07% of a bond, far under the 0.03 merged-sphere threshold.
Worth doing: `regen:'exact'` is now literally true, verified at 0.00e+0 against
the committed `.sdf`. Haworth output byte-identical; all four checkers pass.

**The converters were part of the change.** `sdf2spec.js` and
`sdf2spec-generic.js` no longer multiply by 1.9 — they emit ångströms, so output
pastes straight into a spec. Left unfixed, they'd have silently produced 1.9×
specs for the ~15 `pubchem` molecules the expansion adds.

**A family-B page can now show a small molecule, which was the actual need.**
`mol-small.js` carries water, ammonia, methane, CO₂ and ethanol from measured
lengths in real ångströms; it defines the same keys as `mol-solvation.js` and
`register()` throws if both load. That retired the `aminoacid-lab` water item 3
recorded as a known exception — **without touching the solvation engine**. The
expensive fix was never the only one, just the only one visible while the two
waters had to be the same object.

**Family A is still not converted, and "not yet" misreads it.** Family A is not
ångströms awaiting a multiply: each length was picked to clear its own display
radii, varying *within* a molecule (ethanol: C–C 1.19×, C–O 1.33×, O–H 1.61×).
No factor turns it into real geometry. Converting means *changing the geometry*
and re-tuning `EQ`, `MIN`, `hbThreshold` and the ice lattice. Still last, or
never.

### 8. Make the checkers unskippable — DONE

`.githooks/pre-commit` runs the three offline checkers — `check-molecules.js`,
`check-docs.js`, `check-pages.js` — on any commit touching `demos/`. `npm i`
installs it via `core.hooksPath` (the `prepare` script); `npm run hooks`
re-installs by hand.

Four negative tests, each blocking a commit that would previously have landed: a
stripped `src:`, a page missing a domain file, an untabled `<script>` tag, and —
the subtle one — a page and the script table changed *consistently* while still
leaving the page short a molecule it names. Only `check-pages.js` sees that last
one, and it's the failure mode item 3 introduced.

Three deliberate limits, written into the hook header:

- **It doesn't run `check-handedness.js`.** Network plus a dev dependency in a
  commit path is a liability. It stays a hand-run audit.
- **It checks the working tree, not the staged content.** The honest 95% answer;
  the alternative is a temp checkout on every commit.
- **`--no-verify` still works.** The goal is that nobody *forgets*, not that
  nobody can decide.

The doc-side half shipped too: CLAUDE.md's "Adding a new page" step 2 states
SCIENCE.md §1.4 rule 2 as non-optional, with the sugar mirror as the reason.

Be clear about what this buys. The hook enforces that declared claims hold — it
can't make anyone declare one. A spec asserting nothing passes vacuously. That
gap is structural, and item 5 is the proof of how expensive it gets: four checks
passed for months on molecules that were the wrong enantiomer, because none was
looking at absolute handedness. **Enforcement raises the floor, not the ceiling.**

### The constraint that spans items 3, 4 and 7

**Regeneration must not renumber atoms.** `names`, `groups`, `gly`, `pep`,
`optH`, `contrast.diff` and `haworth.js` all address atoms positionally or by
name. A uniform rescale is safe; `sdf2spec.js`'s reindex step is the hazard. Any
regeneration path preserves atom order or updates every contract in the same
commit.

Item 3b inherits a weaker form: **moving a spec between files must not renumber
it or change the name a page looks it up by.** The split is a pure relocation. If
it's tempting to tidy an atom order while a spec is already moving, don't — two
changes in one diff, only one of them mechanical.

## What we are deliberately not doing

**MolView's model.** Its source is worth reading — it stores no geometry at all.
Every structure is fetched at runtime as raw text (PubChem PUG-REST, RCSB, the
Crystallography Open Database), held as one string plus a `"MOL"`/`"PDB"`/`"CIF"`
tag, and handed unparsed to whichever engine is loaded. Its 2D and 3D panes are
never derived from each other — the sketcher round-trips through SMILES and asks
the server for new 3D coordinates.

Right for a general-purpose viewer with a search box; wrong here. We need
geometry a check can audit *before* it ships, stylised radii that force real
decisions about bond length, and pages that work offline from the working tree.
Committed specs are the point, not a limitation.

This is about *when* a source is read, not *which* are allowed. Item 6 queries
the same COD at runtime — but once, at a terminal, with only the verdict
committed. **Every source in this doc is a build-time input; none is ever a page
dependency.**
