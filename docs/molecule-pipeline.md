# How a molecule gets into the library

`molecules.js` grew one app at a time, and so did the ways of getting geometry
into it. There are **five** different paths a spec can have taken, and only some
of them can be re-run. This doc is the audit and the plan to fix it.

Until item 1 shipped, nothing in a spec recorded which path it took — which is
how the survey below came to list four paths rather than five, and how two
constructed molecules spent the sweep being measured against a database record
they were never derived from. Every spec now carries `src:{path:…}` and
`check-molecules.js` fails one that does not.

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

## The five paths, as they actually exist

**1. Hand-written coordinates.** `water`, `nacl`, `kcl`, `ethanol`, `ammonia`,
`methane`, `co2`, `carbonic`, `bicarbonate`, `hydronium` — the solvation set.
Each bond length was chosen individually to clear its two display radii, so the
implied scale runs ~1.2–1.6× and varies *within* a molecule. This is the "family
A" the header comment in `molecules.js` warns about.

**2. PubChem SDF → converter.** `tools/sdf2spec.js` for the amino acids (it
forces the library's fixed backbone order, because `pep:{…}` and
`aminoacid-lab.html` index into it), `tools/sdf2spec-generic.js` for everything
else that keeps the record's own atom order. Real ångströms × one global
`SCALE` of 1.9 — "family B". Used for the amino acids and `amp`. (This
originally also listed `palmitate` and `palmitoleate`; it was wrong — they are
path 5. See the correction in item 0.)

**3. Built in code from idealised geometry.** The `Skel` builder plus the `GL`
and `AR` bond-length tables construct the molecule from VSEPR angles at load
time. This covers **every glycolysis intermediate and every contrast sugar and
base** — `glucose`, `galactose`, `ribose`, `deoxyribose`, `maltose`,
`cellobiose`, `purine`, `pyrimidine`, `g6p` through `pyruvate`. These never
touched PubChem.

**4. Derived from another spec, in file.** `dAlanine` is `alanine` with one
coordinate component negated — a reflection, computed at load time.

**5. Constructed by hand from literals.** `palmitate` and `palmitoleate`: an
idealised all-anti zigzag at a real 109.5°, united-atom, worked out once and
written in as numbers. Family B, but neither measured like path 2 nor
regenerable like path 3 — the comment above each spec is the only account of how
the coordinates were reached, which is why `src.path:'built'` requires a
`method:` string.

The important thing this survey turned up: **paths 2, 3 and 5 are all "family B"
and look identical in the file**, but one is measured and two are constructed in
different ways. Nothing in a spec distinguished them, and they fail differently.
`src:` is now that distinction.

## What can be re-run today

| Path | Reproducible? | Why |
|---|---|---|
| 3 (Skel-built) | **Yes**, completely | the code *is* the source; re-running the file regenerates the coordinates |
| 4 (mirrored) | **Yes**, completely | same — it is four lines of transform |
| 2 (PubChem SDF) | **Mostly, now** | item 2 committed the inputs to `demos/tools/sdf/`: 5 of 7 rebuild exactly, `proline` needs its hand reindex, and `glutamine`/`glutamate` no longer have a published source at all |
| 1 (hand-written) | N/A | hand-authored numbers are their own source, but no per-number reasoning is recorded |
| 5 (built from literals) | N/A | same — but `src.method` now at least records the construction in one line |

So the molecules whose geometry is *measured against reality* are exactly the
ones we cannot re-derive or re-check, and the ones we can regenerate perfectly
are the ones with no external reference at all. Items 1 and 2 address the first
half — and are the ones the AP Bio expansion makes urgent, since it routes ~15
new molecules straight down path 2. The second half mostly does not need
addressing — see the calibration note above and item 6.

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
shows. Both are addressed by splitting files (item 3 below), not by changing
where the data lives.

The answer at any size is **per-domain files plus a manifest**, loaded by the
pages that need them — committed, diffable, greppable. The filesystem is the
right amount of database for 36 KB, and it stays the right amount at 150. That
split is now item 3, scheduled rather than deferred; the section below says why
the trigger arrived earlier than the 150-molecule threshold this doc used to
name.

## What this plan is now for: the AP Bio expansion

The plan below was written against a library that grows a molecule at a time,
when a page needs one. Two facts have since changed what is worth building.

**First, the remaining curriculum is now counted.** Auditing the library against
the AP Bio units, the gap to full coverage is **~27 molecules** for the
curriculum-complete set and **~34** counting everything flagged — roughly
doubling a library of 37. The big absences: no positively charged amino acid
side chain at all (so no salt bridge, no pH-dependent charge), no ATP or ADP
despite `amp` being present, no nucleotides or base pairs behind the existing
purine/pyrimidine ring contrast, and nothing to esterify `palmitate` onto, so the
membrane lesson has no molecule.

That total is small enough to settle the database question for good — see above —
and large enough to change which items here pay for themselves. It also lands
**unevenly across the four paths**. The nucleobases, sucrose, fructose, glycerol
and the base pairs are all path 3: the code is the source, they are already the
best-provenanced things here, and they need nothing from this plan. But the six
amino acids, ATP, ADP, NAD⁺/NADH, FAD/FADH₂, acetyl-CoA, cholesterol,
chlorophyll a and the phospholipid — call it **fifteen molecules — go through
path 2**, the one path item 0 proves cannot be regenerated five times in nine.

They are also its worst cases. ATP and ADP build directly on `amp`, whose
undocumented deprotonation is one of the five failures; the large cofactors make
hydrogen-stripping unavoidable rather than optional. Adding them as things stand
takes a 5-of-9 failure rate and roughly triples the population it applies to.

**Second, an agent adds each entry.** Every molecule in the recent expansion was
written into `molecules.js` by an AI agent working from `tools/README.md` and the
surrounding comments. This inverts the case for item 4 and strengthens the case
for items 1 and 2.

Item 4 argues that "three manual steps and a README" does not scale. That is a
claim about *human effort per molecule*, and an agent running three terminal
steps does not tire at molecule twenty — the labour it saves is not being spent.
What agent authoring does not fix is item 0's actual finding: every one of the
five failures was an **unrecorded judgement call** — strip the nonpolar
hydrogens, deprotonate to the anion, accept whatever rotamer the record served.
An agent is *more* exposed to that than a person, not less. It makes the call
correctly and invisibly, and it carries nothing between sessions, so the agent
adding ATP has no way to learn what the agent that added AMP decided. The gap is
provenance, not ergonomics. Item 0's diagnosis was right; item 4 aimed one step
past it.

## The plan

**Do items 1, 2, 3 and 5 before the expansion; add item 8. Item 4 is not worth
building; items 6 and 7 stay where they are.** The rationale for each verdict
sits with its item. Numbering is unchanged from the original draft because six
places in this doc cite it.

| Item | Verdict | Why |
|---|---|---|
| 1 · provenance in the spec | **DONE** | all 37 specs carry `src:`; checker enforces it |
| 2 · commit the SDFs | **DONE** | 8 files in `tools/sdf/`; 5 of 7 rebuild exactly |
| 3 · extract the builder **+ split per-domain** | **DONE** | 7 files; all 37 specs byte-identical; water-lab loads 10 not 37 |
| 4 · one entry point | **skip** | solves human labour that an agent does not spend |
| 5 · close the mirror gap | **DONE** | found every sugar was the L-enantiomer; fixed |
| 6 · measured structures | **unchanged — record and move on** | the doc already argues itself out of this |
| 7 · un-bake the display scale | **DONE for family B** | specs store real Å; family A still last-or-never |
| 8 · make the checkers unskippable | **DONE** | pre-commit hook, 3 offline checkers, 4 negative tests |

Within that, items 1–6 remain additive and safe; item 7 can break working physics.

### 0. The reproducibility sweep — run 2026-07-30, and it failed

Before designing anything, every path-2 spec was re-fetched from PubChem and
re-converted, then compared against what is committed. **Four of nine
reproduce.** *(Both numbers were wrong — the correction below and item 2 make it
five of seven.)* The results are the reason item 1 looks the way it does.

**This is about regenerating, not about rendering.** Every spec below is correct
and every page works — `check-molecules.js` passes on all of them. What the sweep
measures is whether a committed spec could be *rebuilt* from its source today.
The converters are Node tools run at a terminal; no page loads one.

| Spec | Can it be regenerated? |
|---|---|
| `glycine`, `alanine`, `serine`, `cysteine` | **yes, exactly** — 0.000 coordinate delta; bonds identical up to endpoint order |
| `proline` | **no** — the converter throws on it |
| `glutamine`, `glutamate` | no — side-chain rotamer differs, and item 2 found the source conformer is no longer published at all |
| ~~`palmitate`, `palmitoleate`~~ | **not path 2 at all — see the correction below** |
| ~~`amp`~~ | **overturned — reproduces exactly.** See item 2 |

> **Correction, made while implementing item 1.** The two fatty acids do not
> belong in this table. Their own comments in `molecules.js`, and
> `tools/README.md`'s list of what each converter was used for, both say plainly
> that they were **constructed** — an idealised all-anti zigzag at a real
> 109.5°, united-atom, written in as literals — and were never PubChem
> conversions. The sweep fetched a record they were not derived from, found 32
> hydrogens against 1, and recorded that as a stripping step. There was no
> stripping step: a united-atom spec has one hydrogen because that is what
> united-atom *means*.
>
> They now carry `src:{path:'built'}`. The reason the misreading was available
> is that SCIENCE.md §1.2 enumerated three geometry sources when five existed,
> so "constructed from literals" had no category to be filed under and fell into
> the nearest one. §1.2 now lists all five.
>
> **So the real sweep result is 4 of 7 path-2 specs reproducing, not 4 of 9** —
> better than recorded, and with one fewer distinct failure mode. The `strip`
> field in item 1 survives this correction, but on current evidence only `amp`
> may need it, and see that spec's own note for why even that is unsettled.

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
- **`amp` was NOT post-processed** — settled by item 2, and the spec's own
  comment was right all along. It is committed as the dianion because the record
  supplies the dianion: CID 15938965 rebuilds it to 0.0000. This sweep queried
  the *name* `AMP`, got CID 6083 (the neutral acid, two extra H on the phosphate
  oxygens), and read the difference as a stripping step. **The lesson is about
  identifiers, not about hydrogens:** a name query pins neither a stereocentre
  nor a charge state. ~~The fatty acids had their nonpolar hydrogens
  stripped~~ — withdrawn; see the correction above.

None of this is drift or rot, and nothing here is a bug on a page — the specs are
right and the lessons render correctly. The gap is that for five of the nine, the
transformation from record to spec exists only in whoever ran it (proline
excepted, which wrote it down). That is what makes the sweep worth repeating
after any change to the converters.

### 1. Record provenance *and* transformation in the spec — DONE

**Shipped.** All 37 specs carry `src:`, and `check-molecules.js` now fails any
spec without one. Coverage as built: `hand` 10 · `pubchem` 8 · `skel` 16 ·
`built` 2 · `mirror` 1.

Three things came out differently from the sketch below:

- **Five paths, not four.** `built` — constructed from hand-derived literals,
  neither typed per-bond nor produced by `Skel` — is a real category that the
  original survey folded into path 2. Finding that is what produced the
  correction in item 0.
- **`skel` is stamped, not written.** `Skel.prototype.spec` defaults
  `src:{path:'skel'}`, so all 16 constructed specs are labelled without anyone
  deciding to, and so will the next one. A field that needs remembering is a
  field that goes stale; this one cannot.
- **A three-value rule turned out to be necessary.** Present / `null` / absent
  mean three different things — decided, *deliberately never pinned*, and not
  applicable. `conformer:null` on all 8 pubchem specs is the load-bearing case:
  it is an active claim that item 0's rotamer failure applies. The checker
  tests `'conformer' in src` rather than truthiness so a null cannot be tidied
  into an absence.

The audit is **unconditional** — unlike `stereo:` or `chirality:`, a spec cannot
decline it. By this doc's own rule (CLAUDE.md, "when a checker lands, retire the
prose it replaces") that means the argument for *why* provenance matters can now
live in one line rather than a war story: the checker fires without being read.
The design sketch below is kept only because items 2 and 4 refer to its fields.

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

### 2. Commit the SDF inputs — DONE

**Shipped.** Eight files, 36 KB, in `demos/tools/sdf/`, with a README carrying
the per-file table and a `.gitignore` for the converter outputs. Every
`path:'pubchem'` spec now names its input in `src.sdf`, and
`check-molecules.js` fails if that file is missing.

It did not close path 2's gap on its own, and the ways it fell short are the
result worth keeping:

**Re-running the sweep with the records in hand changed two verdicts.**

| | before | after |
|---|---|---|
| `glycine`, `alanine`, `serine`, `cysteine` | exact | exact — confirmed |
| `amp` | "deprotonated, unrecorded" | **exact** — wrong CID had been fetched |
| `proline` | converter throws | throws — confirmed, `regen:'manual'` |
| `glutamine`, `glutamate` | "rotamer differs" | **worse: source gone**, `regen:'lost'` |

So **5 of 7 rebuild exactly**, not 4 of 9 as originally recorded — the fatty
acids were never path 2 (item 0 correction) and `amp` was a fetch error, not a
post-processing step.

**`amp` is settled, and the answer was the spec's.** Its comment always said the
record supplied the dianion. The sweep had queried the NAME `AMP`, which returns
CID 6083 — the neutral acid, 37 atoms, two extra H on the phosphate oxygens —
and read the difference as stripping. The real source is CID 15938965,
`adenosine 5'-monophosphate(2-)`, which rebuilds the spec to 0.0000. **A name
query pins neither a stereocentre nor a charge state**, which generalises the
anomer warning in item 1 below: the charge state is *in* the CID.

**`glutamine` and `glutamate` cannot be pinned at all.** All ten published
conformers of each CID were fetched and converted; none reproduces the committed
spec (best |Δ| 6.357 and 5.827). PubChem regenerates conformer sets and the
originals are no longer published, so `conformer:` stays null for these two —
not because nobody pinned it, but because there is nothing left to pin it to.
The committed `.sdf` is the closest available record, explicitly not a
reproduction, and **the specs are now their own source**. Both carry a warning
not to refresh them: the amide's edge-on presentation is a property of the lost
conformer, and the contrast lesson depends on it.

That last case is the argument for item 2 restated more sharply than the
original one-liner. Committing inputs is not only about being able to re-run a
converter — it is about the window closing. Two specs fell out of that window
before anything was committed, and nothing in this repo would have noticed.

### 3. Extract the builder, then split the specs per domain — DONE

**Shipped, both halves.** `molecules.js` went from 1,861 lines holding
everything to a 250-line core holding no specs at all:

| File | Lines | |
|---|---|---|
| `molecules.js` | ~250 | PALETTE, SCALE, VIEW, the empty registry, the DOMAINS manifest |
| `skel.js` | ~346 | the builder: Skel, GL/AR, ring and chain scaffolds |
| `mol-solvation.js` | ~157 | family A, needs no builder |
| `mol-monomers.js` | ~356 | family B, PubChem + literals, needs no builder |
| `mol-glycolysis.js` | ~222 | needs skel.js |
| `mol-contrast.js` | ~675 | needs skel.js and mol-monomers.js |
| `lib-node.js` | ~30 | loads everything for the checkers, by walking DOMAINS |

**All 37 specs are byte-identical afterwards, in the same key order** — checked
by loading the pre-split file alongside the split one and deep-comparing. No
coordinate moved.

The payoff is per-page: `water-lab.html` went from loading 37 specs to 10, and
**four of eight pages no longer load the builder at all**. A page's script tags
are now the statement of what it shows.

Two things worth recording:

**The manifest is real, and it is `MolLib.DOMAINS`.** Four Node consumers
(`check-molecules.js`, `spec2smiles.js`, `name-atoms.js`, `cod-check.js`) each
needed the full library, and four hand-maintained copies of a load order is
precisely the enumeration failure this repo keeps hitting. They all go through
`lib-node.js`, which walks the manifest. Adding a domain file means editing one
list, and `check-docs.js` asserts every name in it is a real file.

**The split falsified a documented invariant.** See below.

---

The original plan for this item, kept for the reasoning:

Two mechanical moves, in that order, and **both belong before the expansion
starts** rather than after.

**3a. `Skel` out into `skel.js`.** The builder plus the `GL` and `AR`
bond-length tables is about 212 lines that has nothing to do with any particular
molecule — a library sitting inside a data file, an eighth of the file's bulk.
Pulling it out makes it independently testable, which item 5 wants anyway (the
stereo work runs straight through `ringNormal` / `equatorial`). It also draws the
line this doc is really about: the builder is *code*, the specs are *data plus
reasoning*, and they have different rules for changing.

The expansion sharpens the timing beyond the original argument. Several
additions — chlorophyll's porphyrin, cholesterol's fused ring system, the
phospholipid — are larger than anything `Skel` has built, so the helpers will
need extending. Doing that while 34 specs land in the same 1,694-line file means
every builder change and every spec addition collide in one diff. Split first;
it is the cheapest it will ever be.

**3b. Per-domain spec files plus a manifest.** The database section above settles
that the filesystem is the right store. What it deferred to ~150 molecules was
the *split*, on the grounds that no page's unused payload had become a
measurable cost. At 37 → ~74 specs the file roughly doubles and `water-lab.html`
starts paying for chlorophyll, so bring it forward — not because the payload is
yet painful, but because splitting 74 hand-authored specs is strictly more work
than splitting 37, and the domain boundaries are about to be drawn by what gets
added anyway.

The boundaries the library already has, which are the ones to cut along: the
solvation set (path 1, family A, and the only specs the water pages want), the
monomers, the glycolysis pathway, and the contrast pairs. Cofactors and
nucleotides are new domains the expansion creates.

Keep the manifest a committed, greppable index — not a loader that fetches. Every
source in this doc is a build-time input and none is ever a page dependency; that
rule applies to our own files too. Pages address molecules by name today, and
that must keep working unchanged across the split.

**What it turned up: one page has been mixing scale families all along.**
`aminoacid-lab.html` builds `MOLECULES.water` for every dehydration it shows,
so a family-A water (O–H 1.55) has been sitting among family-B residues that
would draw it at 1.84 — **about 16% short**. The header of `molecules.js`
asserted the opposite ("every page satisfies this"), naming that page as pure
family B.

It survived because the dependency was invisible: every page loaded every spec,
so nothing distinguished "uses water" from "happens to have water in scope".
Splitting the library forced `aminoacid-lab.html` to name `mol-solvation.js` in
its script tags, and the exception fell out of the first load-check. That is the
argument for 3b restated — **the split does not just reduce payload, it makes
cross-domain dependencies say their own names**.

Left unfixed on purpose: rescaling water means re-tuning the solvation engine
(item 7), and the released water is a transient nobody measures. Now recorded in
`molecules.js` and SCIENCE.md §1.5 as a known exception rather than asserted
away.

**This is an enumeration change, so it invalidates docs mechanically.**
`CLAUDE.md`'s module index and per-page script table both enumerate what a page
loads, and `tools/check-docs.js` audits the script table against the real
`<script>` tags — it will fail until the table matches. `SCIENCE.md` §1.5's
family table is the one that needs a human. Update all three in the same commit,
per CLAUDE.md's rule.

Note that `check-docs.js` reads `demos/` only, so **this doc is not audited by
it** — the file names above are proposals and nothing checks that they ever get
built. That asymmetry is worth knowing when reading any plan here.

### 4. One entry point — designed, then declined

**Not being built.** Kept in full because the reasoning is the useful part, and
because someone will propose it again the next time the library grows.

The design: a single `add-molecule` tool that fetches, converts, runs
`check-molecules.js`, and emits the spec with `src:` already filled, **wrapping**
the two existing converters rather than replacing them — the amino-acid
reindexing contract is real and worth keeping separate.

What killed it is the premise in its last line, that "three manual steps and a
README" does not scale. That is a cost in human attention per molecule, and the
molecules are being added by an agent that pays it without complaint. Meanwhile
the failures the tool was meant to prevent are all recording failures, and
`src:` (item 1) records them for a fraction of the work — a field an agent fills
in, not a pipeline it has to be routed through.

The one piece worth salvaging is the proline wall below: a `TypeError` out of
`reindex` is a bad failure mode whether or not a tool wraps it. None of the six
amino acids the expansion adds is a secondary amine, so it will not bite during
this round. Fix it when a second secondary-amine residue is actually wanted.

Had it been built, the sweep in item 0 would have been its requirements list. It
would have had to own the three steps currently done by hand and unrecorded —
**conformer pinning**, **hydrogen stripping**, and **protonation state** — plus
the fourth that *is* recorded but only in prose: the **secondary-amine
backbone**, where proline's ring nitrogen breaks `reindex`'s fixed order.
Supporting it or refusing it with a message pointing at proline's comment in
`molecules.js` are both fine; a `TypeError` out of `reindex` is not. Nothing is
broken today — proline's spec is committed and correct.

Those first three are exactly what `src:` now records instead. That is the
substitution: **item 1 captures the decisions, item 4 would have automated
them**, and only the first is load-bearing.

One design note worth keeping if this is ever revived: **a generating tool must
write to a file it owns outright, which humans never edit.** Programmatically
editing a hand-authored source file is a codegen problem nobody wants; the
underscore-prefixed convention already in `demos/` (`_generated-specs.json`,
`_old-specs.json`) is the precedent, and `tools/check-docs.js` already excludes
`_`-prefixed files from the sources it audits. The generated and hand-authored
halves stay separable by inspection — the distinction the four paths above have
been missing all along. Item 3b's split does not achieve this on its own; its
files are all hand-authored.

### 5. Close the mirror gap — DONE, and it was not hypothetical

**Shipped, and it found the bug it was written to find.** Generating `smiles`
for the sugars was supposed to be a cheap belt-and-braces assertion. On the
first run, every Skel-built sugar came back as **the exact mirror of its
reference**: L-glucose, L-galactose, L-ribose, L-deoxyribose, and both
disaccharides. The library had been shipping the wrong enantiomer of every
sugar it teaches.

**The control is what makes it conclusive.** Six `path:'pubchem'` specs run
through the identical spec → molblock → RDKit path match their references
exactly, `dAlanine` included — it comes back D, so the path reads both
handednesses correctly. And `beta-D-glucopyranose` resolves to CID 64689, the
same record item 1 independently names as the right anomer-specific reference.

**Why four checks all passed.** `stereo:{axial}`/`{faces}` assert relative
patterns; `cod-check.js` compares torsions and ring-plane tilt, also relative;
`haworth.js` *anchors* the ring normal to the D convention rather than reading
it, so the 2D diagrams drew correct D-sugars from mirrored coordinates; and
bond lengths, angles and the render are identical between enantiomers by
definition. Item 5 said the Haworth convention was "the only thing standing
between a mirrored spec and a diagram that renders beautifully and teaches the
wrong sugar". That was exactly right, and it had already happened.

**The fix needed two different changes, which is the technical lesson.**

| | root cause | fix |
|---|---|---|
| pyranoses | chair pucker phase inverted relative to ring traversal | one sign in `ringPyranose` |
| furanoses | UP/DOWN face tags inverted | swap the tags in `mol-contrast.js` |

Flipping the *furanose* ring frame the way the pyranose was flipped does
**nothing at all**: `equatorial()` is normal-sign-independent, so reversing the
traversal genuinely mirrors a pyranose, but `face()` is sign-dependent, so
reversing it flips the normal and every substituent follows. Do not assume the
two ring builders behave alike.

**Blast radius, measured.** Every sugar coordinate moved. The Haworth 2D output
is **byte-identical** before and after — the anchor was already forcing the
right answer — so `contrast-lab`'s diagrams are untouched and only the 3D
models changed. `check-molecules.js` still passes every stereo, topology,
glycosidic and cis claim, and `beta-maltose`/`beta-cellobiose` both match, which
confirms the α/β distinction survived.

**`tools/check-handedness.js` is new and is now the record.** Deliberately not
wired into `check-molecules.js`: it needs the network and a dev-only
dependency, the same reasoning that keeps `cod-check.js` out. Run it after
touching a ring builder.

This also settles the doubt item 6 reserved for furanose face assignment — the
absolute question is now answerable offline-ish and cheaply, and the answer is
recorded per spec rather than argued about.

---

The original plan for this item, kept because the reasoning held up:

### 5b. The alternatives, as originally weighed

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

**Take the one-condition route and stop there.** The expansion adds sugars and —
via the nucleotides — more furanoses, so the mirror gap widens with every one of
them. But it widens along exactly the axis the SMILES round-trip already covers,
so a one-condition change in `tools/spec2smiles.js` scales with the additions for
free. Do not spend the extended chirality check on top of it.

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

### 7. Un-bake the display scale — DONE for family B

**Shipped, and it turned out to be two separable jobs rather than one.** The
item was written as "collapse the two scale families", and its cost was that
`water-lab` and `molecule-lab` tune a whole solvation engine around
`HL=1.55`. That cost is real and unchanged — but it only applies to family A,
and item 3 put family A in its own file. The tractable half and the risky half
are no longer the same change.

**What shipped.** Family-B specs now STORE REAL ÅNGSTRÖMS. A spec declares
`units:'angstrom'` and `MolLib.register()` multiplies by `SCALE` once, as it
joins the registry. `units:'scene'` means the numbers are already display units
and are left alone. `check-molecules.js` requires the field.

| | before | after |
|---|---|---|
| `skel` (16) | `GL.CC = 1.54*SCALE` | `GL.CC = 1.54`; `skel.js` has **no dependencies at all** |
| `pubchem` (8), `built` (2) | literals pre-multiplied by 1.9 | literals are ångströms |
| `mirror` (1) | — | `units:'scene'`: derived from an already-registered spec |
| `hand` (10) | — | `units:'scene'`, untouched |

The display scale is now **one number in one place**, and 26 specs move
together when it changes. It used to be a constant multiplied into eleven sets
of literals plus two tables.

**Applied at registration, not at render** — deliberately. `Stage.buildMolecule`
is not the only reader: `glycolysis-lab`, `contrast-lab`, `_compare` and
`haworth.js` all index `spec.atoms[i].pos` directly and compare it against
`PALETTE.radii`, which are scene units. Scaling at render would have left every
one of those comparing ångströms to scene units. Registration is the one seam
every consumer is downstream of.

**Verification.** The mechanical conversion moved runtime geometry by 1.5e-9
scene units (float round-trip only). Then the five specs that regenerate
exactly were **reseated from their converters' full-precision output** rather
than kept as divided-down values, which moves geometry by up to 0.001 Å — the
resolution limit of the source data, ~0.07% of a bond, far under the 0.03
merged-sphere threshold. That was worth doing: `regen:'exact'` is now literally
true, verified at 0.00e+0 against the committed `.sdf`. The Haworth 2D output
is byte-identical, and all four checkers pass.

**The converters were part of the change.** `sdf2spec.js` and
`sdf2spec-generic.js` no longer multiply by 1.9 — they emit ångströms, so their
output pastes straight into a spec. Left unfixed, they would have silently
produced 1.9× specs for the ~15 `pubchem` molecules the AP Bio expansion adds.

**A family-B page can now show a small molecule, which was the actual need.**
`mol-small.js` carries water, ammonia, methane, CO₂ and ethanol built from
measured lengths in real ångströms. It defines the same keys as
`mol-solvation.js` and `register()` throws if both load, so a page picks one.
That retired the `aminoacid-lab` water this doc recorded under item 3 as a known
exception — ~15% short among its residues — **without touching the solvation
engine at all**. The expensive fix was never the only one; it was just the only
one visible while the two waters had to be the same object.

**Family A is still not converted, and "not yet" is the wrong way to read it.**
Family A is not ångströms awaiting a multiply: its lengths were each picked
individually to clear their own display radii, varying *within* a molecule
(ethanol: C–C 1.19×, C–O 1.33×, O–H 1.61×). There is no factor that turns it
into real geometry. Converting it means *changing the geometry* and re-tuning
`EQ`, `MIN`, `hbThreshold` and the ice lattice — which also remains the only
way to fix the `aminoacid-lab` water noted in item 3. Still last, or never.

---

The original framing of this item:

### 7b. Collapse the two scale families — last, or never

Store true ångströms and apply the display scale at render time. That would
retire the "a single page may only show molecules from ONE family" invariant,
which today is enforced by a comment and by nobody having broken it lately.

The cost is real: `water-lab.html` and `molecule-lab.html` hard-code `HL=1.55`
and tune their entire solvation engine around it — `EQ`, `MIN`, `hbThreshold`,
the ice lattice spacing. Rescaling water means re-tuning that physics. This is
the only item on the list that can break something that currently works.

### 8. Make the checkers unskippable — DONE

**Shipped.** `.githooks/pre-commit` runs the three offline checkers —
`check-molecules.js`, `check-docs.js`, `check-pages.js` — on any commit that
touches `demos/`. `npm i` installs it by pointing `core.hooksPath` at
`.githooks/` (the `prepare` script); `npm run hooks` re-installs by hand.

Four negative tests, each blocking a commit that would previously have landed:
a stripped `src:`, a page missing a domain file, an untabled `<script>` tag,
and — the subtle one — a page and the script table changed *consistently* while
still leaving the page short a molecule it names. That last case is the one only
`check-pages.js` sees, and it is the failure mode item 3 introduced.

Three deliberate limits, all written into the hook header:

- **It does not run `check-handedness.js`.** Network plus a dev dependency in a
  commit path is a liability — the same reasoning that keeps `cod-check.js` out.
  It is also the only check that catches a global mirror, so it stays a hand-run
  audit after touching a ring builder.
- **It checks the working tree, not the staged content.** A partially-staged
  commit is checked as what is on disk. That is the honest 95% answer; the
  alternative is a temp checkout on every commit.
- **`--no-verify` still works.** The goal is that nobody *forgets*, not that
  nobody can decide.

The doc-side half shipped too: CLAUDE.md's "Adding a new page" step 2 now states
SCIENCE.md §1.4 rule 2 as non-optional, with the sugar mirror as the reason it is
not advisory.

Worth being clear about what this buys. The hook enforces that declared claims
hold — it cannot make anyone declare one. `check-molecules.js` audits a spec
that opts in, and a spec asserting nothing passes vacuously. That gap is
structural, and item 5 is the proof of how expensive it gets: four checks passed
for months on molecules that were the wrong enantiomer, because not one of them
was looking at absolute handedness. Enforcement raises the floor. It does not
raise the ceiling.

---

The original argument for this item:

Nothing runs automatically here — no CI, no git hook — so
`check-molecules.js` and `tools/check-docs.js` are both hand-run. SCIENCE.md
§1.4 rule 2, that a chemical claim ships with its assertion in the same commit,
is enforced by attention alone.

That was tolerable at one molecule per page. It is not tolerable at ~34 added by
an agent that may or may not remember to run either checker, on claims — the
first charged side chains, the first base pairs, the first fused ring systems —
that are precisely the ones a merged-sphere or bad-stereo failure would reach a
student through.

Either a `pre-commit` hook running both, or a hard non-optional line in
`demos/CLAUDE.md`'s "Adding a new page" step 2. A hook is stronger; the doc line
is weaker but costs nothing and cannot itself break a commit. This is a smaller
change than any other item here and probably prevents more bad lessons than all
of them.

Note what it does *not* cover: `check-molecules.js` only audits claims a spec
**declares**. Running it religiously on a spec that declares nothing proves
nothing — which is the argument for declaring, made at length in §1.3.

### The constraint that spans items 3, 4 and 7

**Regeneration must not renumber atoms.** `names`, `groups`, `gly`, `pep`,
`optH`, `contrast.diff`, and now `haworth.js` all address atoms positionally or
by name. A uniform rescale is safe for all of them; the reindex step in
`sdf2spec.js` is the actual hazard. Any regeneration path has to preserve atom
order or update every contract in the same commit.

Item 3b inherits a weaker form of the same rule: **moving a spec between files
must not renumber it, and must not change the name a page looks it up by.** The
split is a pure relocation. If it is tempting to tidy an atom order while a spec
is already being moved, don't — that is two changes in one diff, and only one of
them is mechanical.

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
