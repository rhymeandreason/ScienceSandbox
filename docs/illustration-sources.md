# Credible, reusable science sources

Where to get a text, a figure or an illustration we don't want to write or build
ourselves — vetted by someone with a name, and licensed so we can actually ship it
on GitHub Pages.

**The two questions, in order.** *Is it right?* then *may we use it?* A wrongly
licensed correct figure is a lawyer problem; a correctly licensed wrong figure is
a teaching problem. Prefer sources where a named author and a
primary structure/dataset stand behind the image. We prefer to use examples common for students, although sometimes we might show an interesting fact or real world tie-in to expand on what is in the the textbook.

## How to read a licence here

Licences below are **the site's general policy**, not a promise about any single
file. On every aggregator (Wikimedia, LibreTexts, NIGMS) the licence lives on the
*item*, and it varies. Always open the item's own credit line before using it.

What the clauses cost us:

| Clause | Means | Cost to us |
|---|---|---|
| **CC0 / public domain** | no conditions | free; credit anyway, it's good practice |
| **BY** | credit the author | trivial — one caption line |
| **NC** | non-commercial only | fine for a classroom site; a permanent restriction on that asset |
| **SA** | adaptations must carry the same licence | **viral, and only over the image**: cropping/relabelling makes a derivative that must stay SA. It does *not* reach our code — an `<img>` or `<iframe>` is not a derivative work |
| **ND** | no derivatives | avoid; we almost always relabel |

Record every borrowed asset's title, author, licence, source URL and any "licence
extras" in the page that uses it. That five-field block *is* the attribution.

---

## Primary text and curriculum scope

The spine, in the order they answer different questions. Especially take notice of what the common examples are in textbooks for things like molecules and proteins.

**College Board AP Biology CED** — <https://apcentral.collegeboard.org/courses/ap-biology>
The authority on **scope**, not content: four Big Ideas, Enduring Understandings,
Science Practices, and — most usefully here — explicit boundary statements saying
what is *out* of scope. When deciding how far a sim should go (why `folding-lab`
teaches the hydrophobic collapse but not structure prediction), this is what
adjudicates. Not CC; link, don't re-host.

**OpenStax *Biology for AP® Courses*** — <https://openstax.org/details/books/biology-ap-courses>
· CC BY 4.0 · **the primary textbook**
Written against the College Board framework, each section opened by its AP
learning objective. Attribution-only — every figure in it is reusable with a
credit line, no NC, no SA. Prefer this over *Biology 2e* for anything where AP
alignment matters.

**OpenStax *Biology 2e*, Pressbooks mirror** — <https://bccampusbiology.pressbooks.tru.ca/>
· CC BY 4.0 · the same publisher, better reading UX
The majors' intro-bio book, not AP-scoped, but largely overlapping prose and much
more pleasant to read: server-rendered, one chapter per URL, clean typography. 
**Also the version an agent can actually read** — openstax.org is a client-rendered
app that returns an empty shell to a plain fetch, while Pressbooks yields full
chapter text, TOC and licence metadata on the first request. So: read *Biology 2e*
here, take scope from the CED, and go to the AP title for its framework hooks.

*No Pressbooks port of the AP title was found (checked Aug 2026) — but CC BY plus
Pressbooks' native OpenStax import means one could be made; the TRU mirror above
was created exactly that way.*

**Michelle McCully, *Concepts in Biology*** — <https://lmu.pressbooks.pub/conceptsinbiology/>
· chapter CC BY-NC-SA 4.0, assets vary — see below
One instructor's course book, centred on structural biochemistry. Not a spine,
but the best **depth source** we've found on proteins, binding and molecular
interaction, and its 3D figures are individually licensed for reuse.

**Khan Academy AP Biology** — free, not CC
Exam scaffolding, and a good deal of its biology prose is adapted from OpenStax —
so it is often a compressed view of a fuller text we can already use. Fine for
review; don't treat it as a source.

---

## Structures and molecules

**RCSB PDB** — <https://www.rcsb.org> · coordinates are free of copyright
The structure files themselves carry no restriction; cite the PDB ID and the
primary paper. This is our first stop, and already how `folding-lab` works.

**PDB-101 / Molecule of the Month** (David Goodsell) — <https://pdb101.rcsb.org>
CC BY 4.0. Goodsell's watercolours of the crowded cell are the best "what scale
actually feels like" images in existence, and they are attribution-only. Directly
relevant to act 3's true-relative-size argument.

**AlphaFold DB** — <https://alphafold.ebi.ac.uk> · CC BY 4.0
Models and their images. Same caveat we already state on the page: a prediction's
confidence is not a measurement.

**PDBe / EMBL-EBI** — <https://www.ebi.ac.uk/pdbe/> · generally CC BY 4.0
Good static images and a solid secondary-structure/interaction viewer.

**PubChem** — <https://pubchem.ncbi.nlm.nih.gov> · US government, no copyright on
PubChem-generated content (individual depositor records may differ)
Already our source for `tools/sdf/`. Its 2D/3D depictions are reusable.

## General biology figures

**OpenStax Biology 2e / AP Biology** — <https://openstax.org> · CC BY 4.0
The single best match for this project: same audience, same syllabus,
attribution-only, professionally reviewed. Start here for anything textbook-shaped.

**Wikimedia Commons** — <https://commons.wikimedia.org> · **per file**, mixed
Enormous and genuinely useful, but the quality floor is low and the licence is
per file (CC0, BY, BY-SA, and some non-free fair-use that must never be reused).
Check the file page, not the article. Prefer files marked *Featured*/*Valued*, or
ones traceable to a named scientist. Treat an unsourced diagram as unverified.

**LibreTexts** — <https://bio.libretexts.org> · usually CC BY-NC-SA 4.0, varies
per page and per book
Each page footer states its own licence — some chapters are BY, some BY-NC-SA,
and remixed pages can be mixed within one page. Read the footer every time.

**Pressbooks open textbooks** — e.g. *Concepts in Biology* (Michelle McCully, LMU)
<https://lmu.pressbooks.pub/conceptsinbiology/> · chapter CC BY-NC-SA 4.0, but
**individual assets carry their own licence** — her 3D models are CC BY-NC 4.0,
authored, sourced to a PDB ID, and note "3D image made in PyMOL". This is the
model of good attribution metadata. Click *Rights of Use* on any H5P item to see
the real licence; the file-level field in the page JSON says only "Undisclosed"
and is misleading.

**NIGMS Image and Video Gallery** — <https://images.nigms.nih.gov> · per item,
many CC BY / CC BY-NC-SA
Research-grade micrographs and molecular renders, each credited to a lab.

**NCI Visuals Online** — <https://visualsonline.cancer.gov> · mostly US
government public domain
Clean medical/cell-biology illustration.

**Servier Medical Art** — <https://smart.servier.com> · CC BY 4.0
Thousands of consistent anatomical and cell components, built for remixing into
figures. Attribution-only, which makes it the safest kit for building our own
composites.

**PhyloPic** — <https://www.phylopic.org> · CC0 / BY, per item
Organism silhouettes at correct proportion — useful whenever a page needs "and
this is the animal".

## Pathways

**Reactome** — <https://reactome.org> · CC BY 4.0
Curated, citable pathway diagrams. Relevant to `glycolysis-lab` if we ever want a
cross-check against an authority.

**WikiPathways** — <https://www.wikipathways.org> · CC0
Community-curated, so verify — but the licence could not be simpler.

---

## Do not use without reading the fine print

**KEGG** — the pathway maps are widely reproduced and widely misused. Academic
web viewing is free; **redistribution and reuse of the map images require a
licence.** Don't embed them.

**BioRender** — a subscription tool, not a source. Its output is bound by its
terms and is not CC. Figures made in it cannot simply be lifted from papers.

**HHMI BioInteractive** — excellent and free for classroom use, but under its own
terms of use, *not* a CC licence. Fine to link; don't re-host.

**Journal figures generally** — a paper being open access says nothing about the
figure. Many OA papers are CC BY (reusable with credit); many are not. Check the
article's own licence statement, not the journal's brand.

---

## When to borrow at all

A borrowed illustration is a **photograph**: correct, static, and unable to answer
a follow-up. Our own pages earn their keep by being interrogable — `folding-lab`'s
hydrogen bonds are computed, asserted in `folding/tools/check-folding.js`, and
move. Nothing in a borrowed PNG or glTF can be wrong in a way our checkers would
notice.

So borrow for **context and scale** — the organism, the tissue, the crowded cell,
a structure that is background rather than subject. Build it ourselves when the
student is meant to *ask something of it*. MolecularGeometry.md §1.4's
prop/contrast/subject tiers are the same judgement: a prop may be borrowed, a
subject must be ours.
