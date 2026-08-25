# Embedding and teacher annotations

Design notes, not yet built. Two features that share one delivery mechanism: a
lesson framed on someone else's page, and a lesson a teacher has written their
own notes onto. Both ride the query string.

---

## 1. Embedding

**The embed URL is its own surface.** Add `/embed/*` rewrites in `vercel.json`
beside the existing `/water`, `/glycolysis` ones — same file, different path —
so the public embed contract can change without touching the lesson path.

Framing is not blocked today (no `X-Frame-Options` anywhere), but make that a
decision rather than a default: set `frame-ancestors` on the embed paths.

**Customization is params to body classes, then pure CSS.** One boot script,
read once before first paint, copying `embed`, `text`, `chrome`, `step` onto
`document.body.dataset`. The existing layout already splits the two things a
teacher would want to switch off:

* **text off** — `#app-sidebar` collapses to `grid-template-columns: 1fr` and
  `#side` goes. The rail *is* the prose (`css/main.css:641`).
* **UI off** — hide the on-stage chrome (`#titleblock`, `#tempbar`, `#tray`,
  `#chips`) and a bare live model is left, which is what somebody wants next to
  their own slide text.
* **step=N** — deep-link to one moment of the lesson.

The lesson page is then just the no-params case.

### The two that will bite

**Height.** Every lab is `height:100vh`, which inside an iframe is the iframe's
height — so a teacher who pastes into Canvas gets whatever that platform
guesses. Ship the snippet with an aspect-ratio wrapper. Check that the
`max-width:920px` breakpoint fires on *iframe* width, not device width: a 700px
embed on a desktop should stack.

**The tutor must not mount in an embed.** `/api/ask` is cohort-key gated
(`api/ask.js:15`), so the risk is not anonymous spend — it is that a keyed
student URL pasted into an LMS leaks a class's bearer token to every viewer. A
drawer sliding over a teacher's slide is wrong anyway.

Guard *inside* `chat()`, not at the call sites: return `null` early and every
lesson inherits it. Both consumers already read it defensively
(`water-lab.html:1255`, `:1262`), so `null` short-circuits with no lesson-side
edit — and the module keeps its own rule that a lesson never learns embeds
exist. Guard the `?k` read too, or the first framed load persists a class key
into every student's browser on that domain.

**What counts as an embed:** `?embed=1` as the contract, plus
`window.self !== window.top` against a cross-origin top as the backstop for a
teacher who frames the plain `/water` URL and never reads the docs.
Same-origin framing stays allowed so the builder's own preview works.

### The wordmark

A small `kodolab.org` link in the corner, embeds only. It is redundant on our
own site.

**It sits outside the customization contract.** `text=` and `chrome=` govern the
lesson's UI; the wordmark is attribution, so it is not the teacher's to switch
off. Say so in the param docs — the first teacher who wants a clean screenshot
will go looking for the toggle.

* **`target="_blank"` is load-bearing, not a nicety.** Inside an iframe a plain
  link navigates *the iframe*: the teacher's Canvas page silently becomes our
  homepage where their simulation used to be, with no back button in sight.
  With `rel="noopener"`.
* **Point it at the lesson, not the homepage.** Whoever clicks is a student who
  just got interested in *that* model — send them to `/water` with the step
  preserved, where the rail prose they were not shown is waiting. `?from=embed`
  on the end is the only usage signal an iframe will ever give us.
* **It must not eat the mouse.** Same treatment as `#side` (`css/main.css:660`):
  `pointer-events:none` on the container, `auto` on the link, so a drag near the
  corner still orbits.
* **Bottom-right, `z-index: 7.5`-ish** — above the annot layer's 7, below
  `#side`'s 8. Top-left is `#titleblock` and the right is where the ask drawer
  slides, but the drawer does not mount in an embed, so that corner is
  uncontested exactly where this lives.

**Legible, not tasteful.** Attribution too quiet to read is not attribution. The
stage is light dotted paper, so a mid-grey wordmark reads as restrained on a
monitor and vanishes on a classroom projector with the lights on. Aim for small
and genuinely legible over full-contrast or hidden.

There is no wordmark component to reuse — "Kodolab" exists today only in
`<title>` and the `index.html:357` footer — so this is the first one.

### Skipped on purpose

LTI and oEmbed. LTI is OAuth, grade passback and per-LMS registration, and only
pays off for rosters and scores; oEmbed only helps if a platform refuses raw
HTML. Every target platform — Canvas, Schoology, Google Sites, Notion, Moodle —
accepts an iframe today.

---

## 2. Teacher annotations

`lib/annotate.js` already decides most of this.

**A click is not an anchor.** The module is emphatic that anchors are semantic:
*"NEVER capture the point at build time... a baked point comes adrift the moment
the thing it names does anything."* But a teacher annotating does the naive
thing and clicks a pixel, which is camera-dependent and wrong as soon as anyone
orbits.

So the feature reduces to one question: **how does a click become an atom?**
Raycast it. Each lab exposes one resolver —

```js
pick(x, y) → { id: 'HEM.FE.A', at: () => hemeFe() }
```

— and what persists is the id, never the coordinate. Rehydrate through the
lab's own lookup to get the `at()` function `notes.add()` already wants. A
teacher note is then indistinguishable from an authored one: it survives orbit,
zoom, step changes, and a model that folds while it is on screen. `card` gives
the label/why split for free.

**Do not reach for `atPx`.** It is right there and looks like the easy path,
and the module rules it out for exactly this case: a fixed-screen callout is a
caption with a leader line drawn on it.

### Three things "annotation" could mean

1. **Teacher replaces the prose** — their framing in the rail instead of ours.
   No anchoring problem at all, and possibly most of what teachers want. This
   is `text=` extended from off/on to *substitute*.
2. **Teacher pins callouts to the model** — the raycast design above. The most
   work, and the part worth more than a sticky note.
3. **Students annotate while working** — same mechanism, different persistence
   and lifetime. Out of scope until (2) exists.

(1) and (2) probably ship together: a teacher who reframes a lesson usually
wants to point at something too.

### Storage: the URL, capped around 12 notes

Decided. No accounts, no datastore, shareable by email, works in any iframe on
any platform.

**Version-stamp it: `?n=1:<payload>`.** Two characters, and it is the only
thing that lets the scheme change later without breaking links already sitting
in someone's syllabus. The URL is a storage format now, and teachers keep these
for years.

**Anchor ids become a public contract too.** Once a note says `HEM.FE.A`, that
string is load-bearing outside this repo. Rename an atom or rebuild a model and
the note vanishes, or lands on the wrong thing. Unknown anchors drop the note
quietly rather than throwing — and rebuilding a model now means checking
whether every saved link pointing into it was just orphaned.

**Budget.** Per note: step 1, anchor ~10, offset ~7, label ~30, card ~120 —
about 170 chars, so twelve is ~2,100 raw, and percent-encoded prose inflates
that toward 3,000. Over the ~2,000 worth staying under for LMS editors, email
clients and truncating proxies.

So compress: `CompressionStream('deflate-raw')` is native, no dependency.
Prose deflates ~3x, base64url gives back 1.33x, net ~2x — twelve full notes
land near 1,300 characters. It also stops the URL being a wall of text a
teacher tries to hand-edit. The alternative lever is dropping cards, not
lowering the note count, but cards are the good part.

Notes are **per-step**: the model changes between steps, so a note carries its
step or it points at an atom that is not on stage.

### The one security hole

`lib/annotate.js:200` sets the card body as HTML:

```js
c._b.innerHTML = note.card;
```

Label (`:275`) and card title (`:315`) are both `textContent` and fine. This one
line is the exception, and it is safe only while every card is authored here.
Once card text arrives from a URL, anyone can craft a link that runs script on
our origin against a student who was told it came from their teacher — on the
same origin as the tutor's cohort key in localStorage.

Fix: URL-sourced notes go through a path that sets `textContent`; `innerHTML`
stays reserved for lesson-authored specs. A two-tag allowlist for emphasis is a
deliberate later step, not something the format grants by default.

---

## 3. The authoring tool — open

Confirmed as wanted, not yet designed.

**Unresolved: placing a note fights orbiting the model.** The annot layer is
`pointer-events:none` precisely so a drag still orbits (trap 2 in the module
header), so click-to-place and drag-to-orbit collide. Leaning toward an armed
mode — press *add note*, the next click places one — rather than a modifier
chord no teacher will discover.

Still to decide:

* Field order, delimiters and offset/step encoding in the payload.
* Editing after placing: drag to reposition the label, edit text, delete,
  reorder.
* How a teacher gets the finished URL — copy button, presumably, alongside the
  embed snippet.
* Whether authoring lives in the lesson itself behind a param, or in the
  `/embed` builder page.

**The `/embed` builder page** is the distribution story either way: pick a lab,
toggle text/UI/step with a live preview, add notes, copy the iframe snippet.
That page is what makes this usable by a teacher who will never read any of the
above.
