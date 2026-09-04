<!-- KIND: rulebook. Load whole before building or restyling any page a student lands on. Not needed for a bench, which is chrome nobody grades. `Modules.md` says which stylesheets to link; this says what to put inside the page once they are linked. -->

# The page shell

Every public page is the same blocks in the same order, so moving between them
feels like turning a page rather than opening another site. Copy this.

```html
<link rel="stylesheet" href="css/kodo.css">   <!-- the only sheet a plain page needs -->
...
<body class="kodo">
<div class="page">

  <nav class="sitenav">
    <a class="mark" href="/">kodo<em>lab</em><span class="dot">.</span></a>
    <span class="crumb">proteins</span>
  </nav>

  <header class="pagehead">
    <h1>proteins</h1>
    <p class="deck">One line of prose about this page.</p>
  </header>

  <main> ... </main>

  <footer class="sitefoot"> ... </footer>

</div>
</body>
```

`body.kodo` is the opt-in. A lesson is a full-bleed `#app` and must never take a
document's paper rhythm, which is why it is a class and not `body`.

---

## 1. The wordmark

**Never retype the letters.** The mark is this, exactly, on every page:

```html
<a class="mark" href="/">kodo<em>lab</em><span class="dot">.</span></a>
```

The `<em>` and the `.dot` span are load-bearing: they are what colour `lab` green
and the full stop orange. A page that writes `kodolab.` as plain text renders a
monochrome logo, which looks deliberate and is not. On the homepage the mark is
the `<h1>`; everywhere else it is an `<a>` to `/`.

**One size.** `.mark` is `1.35rem` on every page in the repo. There is exactly
one exception and it says so out loud:

| | where | what it is |
| --- | --- | --- |
| `.mark` | every page | 1.35rem, in the nav bar |
| `.mark.hero` | the homepage, and nothing else | `clamp(2.8rem, 9vw, 5.5rem)`, in the masthead |
| `.sitenav.floating` | a full-window app (the node graph) | the same bar, fixed over the canvas |

**This is the rule with the worst failure mode in the repo.** Four pages each
spelled the mark out in their own `<style>` at three different sizes, and no
single page looked wrong. It is only visible when a reader moves between two of
them, which is the one thing nobody does while building one.

## 2. The bar and the masthead

`.crumb` says where this page sits. A `<span>` when the page **is** that place,
an `<a>` when it is a level up. Same size either way, so the bar keeps its shape.
It is the way back: a page that also prints its own "← all proteins" link is
saying it twice.

`.pagehead` carries the page's own name and closes with the 2px rule, which is
the one heavy line in the system and means "this page's name stops here".

| class | for |
| --- | --- |
| `.pagehead h1` | the name, lowercase geometric |
| `.pagehead h1.proper` | a proper noun that keeps its capital (a protein is called Myoglobin) |
| `.pagehead .deck` | the sentence under the name, serif |
| `.pagehead .meta` | a count or a date on the right, micro-cap, tabular |
| `.pagehead .tagline` | the homepage's line of prose on the right |
| `.pagehead.open` | no rule, for a reading page whose deck runs into the first section |

Inside `main`: `.lede` is one line saying what the reader is looking at a
collection of. `.sechead` is a section head (`h2` + `.rule` + an optional
`.count` or `.more`).

**The page's action is `.cta`**, and `.cta--ghost` is the second answer where a
page offers one. It is usually an `<a>`. Do not reach for `.pill` here: a pill
is an instrument standing on a model's paper, a solid body with a side and a
shadow, and on a document it reads as a sticker. Which shape a control takes is
decided by what it is lying on, not by how important it is. Every shape is drawn
live in `design-system.html`.

## 3. What a page does not get to set

Paper, gutter, measure, masthead rhythm and the two accents belong to
`kodo.css`. A page that restates one has forked it, silently, until somebody
compares two pages side by side.

| token | what it is |
| --- | --- |
| `--page-max` | the measure. The only one a page routinely overrides: the homepage sets 1080px |
| `--page-gutter` | the side padding. `.page` reads it, so a full-bleed child undoes it with one negative margin rather than guessing the clamp |
| `--page-top` · `--head-gap` · `--page-gap` | nav to window, rule to content, grid gutter |
| `--mark-size` | set by `.mark` and `.mark.hero`. Nothing else touches it |

**Never type a colour.** `--surface-page` · `--surface-card` · `--surface-stage`
(the warmer ground a molecule is drawn on) · `--border-hair` · `--border-strong`
· `--text-strong` / `-body` / `-dim` / `-muted` · `--accent` · `--spark`. Atom
and bond colours are published from `palette.js` as `--atom-*` / `--bond-*` at
load, so a caption and the sphere it names cannot drift.

**Two sans faces, split by job.** `--font-display` is the geometric one: the
wordmark, a masthead, a micro-cap, a numeral a page reads out. `--font-ui` is
system-ui and is what everything is actually **read** in, because a display face
sets a paragraph badly and its 600 at 13px is a black bar. `--font-editorial` is
Literata, for prose in a card and for a deck.

**One heading device.** Every label is a micro-cap through `--cap-lg` (names a
whole thing) or `--cap-sm` (labels a part of the chrome). Same face, tracking,
weight and colour; the size is the entire hierarchy. A page that picks its own
tracking has invented a third treatment.

---

## Where the truth lives

`css/kodo.css` §6.5 is the shell itself, and its header carries the reasoning.
`design-system.html` draws every token on the stage's own paper, reading each
swatch's own computed value, so it cannot claim a colour the token does not
hold. **Nothing above restates a value on purpose**: a hex typed into a doc is a
claim nothing checks.

`css/main.css` is the frozen bench sheet, the sketchbook look, kept because
sixty test pages are drawn in it and none of them is a page a student lands on.
Nothing new links it.

## The pages on this shell

`index.html` (the homepage, and the only `.mark.hero`) · `proteins/index.html` ·
`proteins/myoglobin/myoglobin.html` · `nodegraph/nodegraph.html` (the
`.sitenav.floating` case). Copy the closest one.
