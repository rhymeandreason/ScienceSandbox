# Testing — where we are, and what a real layout test would take

Status: **proposal, not built.** `check-molecules.js` is the only checker that
exists. This is the design for the second one, written down so the reasoning
survives until someone wants it.

---

## 1. Where we are today

| Checker | Covers | Runs |
|---|---|---|
| `check-molecules.js` | sphere overlap, bond angles, ring stereochemistry (`stereo`), ring topology (`topology`), L/D handedness (`chirality`) | `node check-molecules.js`, by hand |
| — | everything about **layout**: framing, spacing, rotation, captions | nothing |

There is no CI, no git hook and no `package.json` in the repo. Nothing runs
automatically, including `check-molecules.js`.

That split is not arbitrary. `check-molecules.js` exists because chemistry errors
are *invisible* — a molecule with the wrong stereochemistry renders beautifully.
Layout errors are the opposite: they are obvious the moment you look. The
question is whether anyone looks, at every pair, in every toggle state, at every
point in a rotation. Nobody does.

## 2. What actually goes wrong here

Every layout bug this project has shipped came from the same place: **a number
describing the molecule got out of step with how the molecule is actually
drawn.** From one session's work on `contrast-lab.html`:

| Bug | Why looking didn't catch it |
|---|---|
| Molecules cartwheeled instead of spinning | Looked fine in a screenshot. Only visible mid-rotation, and only if you watched the right frames. |
| Camera framed against `aspect = NaN` | A `ResizeObserver` fires while a grid item is 0px tall; the poisoned projection matrix survived until the next resize. Rendered fine most of the time. |
| Molecules clipped at the frame edge | Only at certain rotation angles, only at certain viewport aspects. |
| `Stage.measure` ignored `view` | Extents described a differently-oriented molecule. Surfaced as one caption overlapping one molecule on one page — the other two pages looked correct. |
| Notes overlapped the atom counts | Only for the longest note, in one of three pairs. |

Note the pattern: **each was a conditional failure** — one angle, one aspect
ratio, one pair, one toggle. That is exactly what a sweep catches and a
screenshot does not.

The `measure`/`view` bug is the sharpest argument. It shipped, was verified by a
coordinate-equivalence check that passed, and survived two commits — because the
check that would have caught it (the rotation sweep) was run manually and simply
wasn't re-run after that change.

## 3. The line between headless and browser

The browser is **not** the blocker. Most of the audit is arithmetic on positions,
radii and a frustum.

**Testable headless (no browser, no dependencies):**

- containment — every atom inside the frustum, swept through a full rotation, in
  both C–H states, at a deliberately conservative aspect;
- separation — the two halves of a pair never overlap while turning;
- spin axis — every atom's world *y* is constant through a turn (a tilted spin
  axis makes them bob; ribose was sweeping 11.3 units);
- centring — distance from each molecule's centre to its spin axis is 0;
- view equivalence — canonical coordinates plus the declared `view` reproduce the
  intended geometry;
- caption anchors — the *world-space* points captions hang from clear the model.

**Needs a real browser:**

- HTML overlay collisions (`.molnote` vs `#stats` vs `#lesson`) — these depend on
  text wrapping and font metrics, which only a layout engine knows;
- whether anything actually paints.

A headless browser (Playwright) would cover both, at the cost of `node_modules`
in a repo whose stated design is *no build step, no framework*. Not recommended
unless the DOM-collision class of bug starts recurring.

## 4. The two things blocking a headless test

**Blocker 1 — `scene.js` cannot load in node.** It builds geometry at module
scope:

```js
const Rsphere = new THREE.SphereGeometry(1,32,24);   // ReferenceError under node
```

*Fix:* extract `measure` / `frame` / `centerOf` into a dependency-free
`layout.js`, loaded by `scene.js` and requirable by node. This also means
replacing the `THREE.Quaternion` inside `measure()` with the explicit ZYX
rotation `Skel.rotate()` already uses — the same arithmetic, no THREE. The
module becomes pure numbers in, numbers out.

**Blocker 2 — the page's layout lives in an inline `<script>`.**
`PAIRS`, `GAP`, `LIFT`, `NAME_ROOM`, `NOTE_ROOM` and `posOf()` are unreachable
from node.

*Fix:* move them to `contrast-layout.js`, which the page loads as a normal script
and the test requires. This is the same move `molecules.js` already represents:
the data and the decisions become inspectable, and the HTML keeps only the
wiring.

Neither fix is invasive, and both leave the pages loading plain scripts in order,
exactly as now.

## 5. The proposed checker

`check-layout.js` — same shape as `check-molecules.js`: prints what it measured,
exits non-zero on failure.

```
for each page layout (contrast-lab, macromolecule-lab):
  for each selectable state (pair / monomer / compare):
    for each C–H toggle state:
      for theta in 0 .. 2π step 0.05:
        assert every atom is inside the frustum        (containment)
        assert the halves do not overlap               (separation)
        assert world y is unchanged from theta = 0     (upright spin axis)
      assert |centre − spin axis| == 0                 (centring)
      assert caption anchor points clear the model     (anchors)
```

Two design notes, both learned the hard way:

- **Sweep, don't sample.** Every bug above was conditional. A single-frame
  assertion would have passed on all of them.
- **Assert against a conservative aspect** (1.0, versus a real ~1.26). Narrower
  frustum, stricter test; if it passes there it passes on any wider viewport.

## 6. Running it automatically

Nothing runs automatically today, so this is a separate decision from writing the
test. Cheapest to heaviest:

| Option | Cost | Catch |
|---|---|---|
| **By hand** (status quo) | zero | only caught when someone remembers — which is how the `measure`/`view` bug survived two commits |
| **Local `pre-commit` hook** | zero deps; a few lines | not copied by `git clone`, so it protects one machine; `--no-verify` skips it |
| **GitHub Action on push** | zero deps (node is preinstalled on runners; these are plain scripts) | shared with everyone, no local setup, cannot be skipped by accident |

Recommended: a **GitHub Action** running both checkers —

```yaml
- run: node demos/check-molecules.js
- run: node demos/check-layout.js
```

— optionally with the local hook for faster feedback. The Action is the one that
matters, because the failure mode being defended against is *forgetting*, and a
hook you can bypass does not defend against that.

## 7. Deliberately not covered

- **Visual regression** (screenshot diffing). High maintenance, and it fails on
  every intentional change; the assertions above encode *why* a layout is correct
  rather than *what it looked like on Tuesday*.
- **The DOM overlay collisions**, per §3 — manual browser check until they
  recur often enough to justify the dependency.
- **The chemistry.** That is `check-molecules.js`'s job, and per `SCIENCE.md`
  a new chemical claim still ships with its assertion in the same commit.
