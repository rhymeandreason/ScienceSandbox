# Building a science app

Interactive single-page apps that help students *build* understanding of one
science concept. Learn the patterns from the three starters — this is just the
map.

## Start here

- Read one starter end-to-end: `starters/cellular-respiration/index.html`
  (crafting), `starters/dna-rna/index.html` (3D + step-gating),
  `starters/bonding/index.html` (free-explore sandbox).
- Read `../kit/README.md` for the design system.

## Shape

- One `starters/<slug>/index.html`. Static, no build, no framework, no network
  calls. Vanilla HTML/CSS/JS (+ a CDN lib like Three.js only if it earns its keep).
- In `<head>`, load the kit before your own `<style>`/`<script>`:
  ```html
  <link rel="stylesheet" href="../../../kit/themes/stationery.css" />
  <link rel="stylesheet" href="../../../kit/kit.css" />
  <script src="../../../kit/kit.js"></script>
  ```

## Conventions

- Use kit chrome (`.title-card`, `.panel`+`.badge`, `.btn`, `.hint`, `.footer-note`,
  `toast`) and helpers (`$`, `$$`, `el`, `toast`, `replay`, `floatUp`). Don't
  redefine them.
- Style through theme tokens (`var(--ink)`, `var(--surface)`, `var(--font-hand)`…),
  never hard-coded colors/fonts, so themes keep working.
- Give the app its own tint by overriding a few tokens in `:root` (see the
  lavender/mint starters). Keep domain widgets (stations, atoms, helix) in the
  app's `<style>`.
- Name app-local `@keyframes` distinctly — the kit owns `nudge` and the `kit-*`
  animations.
- One concept, playable in a minute, with a clear goal and a win/complete state.
  Friendly, playful, correct: simplify numbers but keep the science right, and
  say so on screen when you simplify.

## Verify before done

Served from the repo root (so `../../../kit/…` resolves — `file://` is blocked):
```bash
python3 -m http.server 8000   # then open /apps/starters/<slug>/
```
Play the whole loop to the win state; check the console is clean.
