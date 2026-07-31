## Keeping the docs true

These docs are the only record of *why* a constant, geometry, or module
boundary is what it is, so a stale one actively misleads. Every doc error this
project has shipped was the same shape — **an enumeration that grew a new
member and wasn't updated.** Most of those are now caught automatically:

```bash
node tools/check-docs.js && node tools/check-pages.js
```

`check-docs.js` audits the per-page script table, file references, and `§n`
references against the filesystem and `SCIENCE.md`'s real headings. A file a
doc names *on purpose* that doesn't exist (`engine.js`, TESTING.md's
proposals) goes in the script's `KNOWN_ABSENT` map so it's asserted absent
instead of flagged missing. `check-pages.js` runs each page's scripts in a
fresh context and fails if it names a molecule its `mol-*.js` set doesn't
provide — `check-docs.js` proves the table matches the tags, this proves the
tags are *enough*.

Neither can check whether prose is *true* — that's on the reader:

> **If your change adds a member to a set, find every enumeration of that set
> and update it in the same commit.** A doc claim gets asserted the same way a
> chemical claim does (§1.4, rule 2): in the commit that makes it true.

**The enumerations, and what invalidates each.** ✓ = `check-docs.js` catches it,
so you do not have to remember; the unmarked rows are the ones that need you.

| Enumeration | Goes stale when you… | |
|---|---|---|
| `CLAUDE.md` → per-page script table | change any page's `<script>` tags | ✓ |
| a page's `mol-*.js` set vs the molecules it names | use a new molecule on a page | ✓ |
| `MolLib.DOMAINS` manifest | add a `mol-*.js` domain file | ✓ (paths) |
| `CLAUDE.md` → `SCIENCE.md` section index | add a `## n.` section to `SCIENCE.md` | ✓ |
| any doc's file references | rename or delete a file | ✓ |
| `CLAUDE.md` → Pages table | add or repurpose a `*-lab.html` | |
| `CLAUDE.md` → module index table | add a module, or add/rename an exported entry point | |
| `SCIENCE.md` §1.2 | add a geometry source or converter | |
| `SCIENCE.md` §1.4 declaration table | teach `check-molecules.js` a new claim type | |
| `SCIENCE.md` §1.4 contrast table | build one of the unbuilt pairs (flip its Built column) | |
| `SCIENCE.md` §1.5 family table | add a spec, or change `SCALE` / the `GL` constants | |
| `SCIENCE.md` §9 effect + colour tables | add an `fx.js` primitive or wire an effect to a new event | |
| `check-molecules.js` header | add a claim type or a new audit | |
| `MolLib.VIEW` table | add a shared viewing angle | |

**Checklist for the unchecked ones:** new page → Pages table (+ a `##`
`SCIENCE.md` section only if it constrains shared code or another page —
page-internal decisions go in a header comment instead). New molecule → §1.4
(tier, claim) + §1.5 (family) + the assertion, same commit — §1.4 rule 2 isn't
optional. New claim type in `check-molecules.js` → §1.4's table *and* the
script's header; they've drifted apart once already. Changed a constant with a
reason → the reason lives in the doc, not the commit message.

**Delete rather than hedge**, and **retire a story once it is solidly fixed and we have a path forward** A rule that no longer holds gets removed, not softened; a bug that's now
mechanically caught (merged spheres, doc/file mismatches) gets its war story
cut to a one-line rule, since the checker is the better documentation. A bug that's only caught when someone opts in (`stereo:`,
`chirality:` — §1.4) keeps its story, because the prose is what argues for
opting in. Anything still unenforced (scale families, *cis*/*trans*, whether
prose is true) keeps its story as the only defence. History earns space only
when a decision was reversed and the reversal isn't otherwise obvious (§1.5 is
the model).

Where a fact belongs follows from **which edit invalidates it**: one file → a
comment in that file; several → a doc, never both — the `stereo:` vocabulary
drifted precisely because it lived in two places. And write for an agent, not
a newcomer: skip prose that restates what the code already shows; spend words
on intent, rejected alternatives, and cross-file invariants instead.

