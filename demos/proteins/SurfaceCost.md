<!-- KIND: argument — load when deciding how a protein's surface reaches a page, or when a new protein is about to need a card. Numbers measured 2026-08-27 on 2HHB and 1OSE; re-measure before acting on them. Not needed to draw a surface that already bakes: that is docs/rendering-modules.md. -->

# What a molecular surface actually costs

Written after `tests/question-composer.html` raised the question a page with
many protein cards asks: is the SES too heavy to put on more than one card at
a time, and should students get a coarser one than scientists?

**Short answer: no, and no.** The card tier is already the only tier a student
meets, 128 KB of it, fetched on a click. Nothing needs to get coarser. The
interesting finding is elsewhere, in the last section.

## The tiers, and who is actually on them

| file | Å | disk | fetched by | student path? |
| --- | --- | --- | --- | --- |
| `hemoglobin/data/2HHB.card.surf.bin` | 1.4 | 362 KB | question-composer, via `lib/mapcontent.js` | yes |
| `hemoglobin/data/2HHB.surf.bin` | 0.7 | 1.5 MB | `hemoglobin/surface-test.html` | no |
| `hemoglobin/data/2HBS-T1.surf.bin` | 0.7 | 1.5 MB | `hemoglobin/surface-test.html` | no |
| `sickle/data/2HBS-T1.surf.bin` | 1.1 | 603 KB | `sickle/fibre-test.html` | not yet |
| `amylase/data/1OSE.surf.bin` | 0.7 | 1.1 MB | `amylase/amylase-test.html`, `check-amylase.js` | not yet |

`membrane/data/7E1Z.surf.bin` and `7E20.surf.bin` were a sixth and seventh
row. `membrane/clip-test.html` was the only page that ever fetched them and it
is deleted, so they went with it. `bake-pump.js` rebuilds them from the PDBs if
the pump ever wants a real surface again.

Both remaining "not yet" rows have queued lessons in `LESSONS-ROADMAP.md`, so
neither is a candidate for withholding from the deploy the way `*.pdb` is.

## Why the card tier does not need to go coarser

`kit/proteinbox.js` spends it carefully already, and this is the part worth not
re-deriving: the surface is fetched **on the toggle click, not on reveal**, and
`sesOwner` lets exactly one card hold a decoded mesh. Opening a second drops the
first. N cards cost one fetch, not N.

Measured down the range on 2HHB, each bake about 0.3s:

| 1.4 Å | 1.7 Å | 2.0 Å | 2.4 Å |
| --- | --- | --- | --- |
| 362 KB, 22k tris | 266 KB, 22k tris | 190 KB, 15k tris | 132 KB, 10k tris |

Going coarser saves ~170 KB once, on a click, and flattens the lobes at exactly
the size where the reader is asking a shape question. `tools/bake-card-surface.js`
already argues 1.4 for this reason and the measurement agrees with it.

**Vercel already brotlis the bakes.** Verified live against
`www.kodolab.org`: `content-encoding: br` on the card file. 362 KB on disk is
128 KB to a student, so compression is not a lever anyone still needs to pull.

## The premise that turned out to be wrong

The bake exists because a browser surface was assumed to be expensive. It is
not. `SES.build` on the whole 2HHB tetramer, in Node:

| spacing | time | verts |
| --- | --- | --- |
| 1.4 Å | 0.24 s | 15,078 |
| 0.7 Å | 0.37 s | 63,950 |

`tools/ses.js`'s header cites 3Dmol at 5.7 s and Mol* at 9.4 s on 2HHB. Those
are **those viewers' numbers**, from `viewer-compare.html`, not this algorithm's.
Ours is sub-second. There is no heavy offline stage left to split out, so the
idea of baking a scalar field and marching cubes in the browser saves an amount
of time that does not exist.

## The artefact worth switching to, when there are enough proteins

Ship the atoms, not the mesh, and build the surface in a Worker at runtime.

| per protein, on the wire (brotli) | |
| --- | --- |
| card mesh, `*.card.surf.bin` | 128 KB |
| the PDB itself | 72 KB |
| **quantised atom block** (4,556 atoms, xyz uint16 + radius byte, 8 B each) | **30 KB** |

30 KB against 128 KB, and one file serves *every* resolution: coarse for the
thumbnail, fine when the reader zooms, with no second bake and no card-vs-lesson
tier to keep in step. It also erases the current friction that a new protein
card needs `bake-trace.js` **and** `bake-card-surface.js` before it can exist.
That friction is why `2HHB` is today the only structure that can be a card at
all: `bake-card-surface.js` reads a `.trace.json` for its frame, and no other
structure has one.

Note this is still a bake, just a tiny one. It does not deploy the PDB, so
`.vercelignore`'s reasoning about deposited structures being the pin stays
intact.

### What it costs

* 0.37 s in Node is likely 0.6 to 1.5 s in Safari. It has to run in a Worker or
  it freezes the whole card grid mid-scroll.
* `tools/ses.js` is `module.exports`-only. It needs the dual-global wrapper
  `hemoglobin/surface.js` already uses.
* The EDT allocates several MB of typed arrays at 0.7 Å. Fine in a Worker,
  worth knowing before it is a surprise.
* Residue tagging moves browser-side too. `SurfLib.chainOf` / `numberOf` is what
  paints the β6 patch on `surface-test.html`, and that is not free.
* **The invariant that gets weaker.** The bake is currently what guarantees HbA
  and HbS were built on the same grid, and `surface-test.html` asserts it out
  loud because a mismatched grid reads as the mutation. Building at runtime
  turns a property two committed files have into one two code paths have to
  keep agreeing on.

### When to do it

Not at one protein. The composer today fetches a single 128 KB mesh on a click
and drops it when another card wants one, so there is no problem on the page to
solve. **Revisit when four or five proteins have cards**, which is the point the
atom block is plainly the better artefact and the per-protein bake friction is
being paid over and over.
