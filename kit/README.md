# ScienceSandbox Kit

The shared design system for ScienceSandbox interactives — a **theme** (design
tokens + page surface), **component chrome** (`kit.css`), and a few **JS helpers**
(`kit.js`). Extracted from the three starter apps so every interactive shares one
look and feel.

## Using the kit in an app

In `<head>`, load a theme, then `kit.css`, then `kit.js`:

```html
<link rel="stylesheet" href="../../../kit/themes/stationery.css" />
<link rel="stylesheet" href="../../../kit/kit.css" />
<script src="../../../kit/kit.js"></script>
```

(Path is relative to the app; from `apps/starters/<app>/index.html` the repo root
is three levels up. Serve the repo from its root so `../../../kit/…` resolves.)

`kit.js` must be a **blocking** script in `<head>` (no `defer`) so its globals
exist before the app's inline `<script>` at the end of `<body>` runs.

## What's in it

**Theme tokens** (CSS variables, see `themes/stationery.css`):
`--font-display`, `--font-hand`, `--paper`, `--paper-line`, `--surface`, `--ink`,
`--ink-soft`, `--tape`, `--stitch`, `--accent`, `--radius`, `--radius-sm`,
`--card-shadow`, `--press-shadow`, `--wrap-max`.

**Components** (`kit.css`): `.wrap` layout, `.title-tape` header, `.panel` + `.badge`,
`.btn` (`.ghost`, `.go`), `.k-chip`, `.hint`, `.footer-note`, `#toast`.

**Animations**: `nudge` (shared, used by `.btn.go`) plus `kit-*` utilities that
won't clash with app-local keyframes: `.kit-pop`, `.kit-cardin`, `.kit-shake`,
`.kit-snap`, and the `kit-float` keyframe (used by `floatUp()`).

**JS helpers** (`kit.js`): `$`, `$$`, `el`, `toast`, `replay`, `floatUp`.

## Per-app tint

Keep the shared structure but give an app its own color identity by overriding a
few tokens in the app's own `<style>`:

```css
:root {
  --paper: #f3f0fb;  --paper-line: #ddd6ef;  --surface: #fffdf9;
  --tape: #c9b8f0;   --stitch: #cfc6e6;      --accent: #ece4fb;
}
```

App-specific widgets (a crafting station, a Lewis-dot atom, the 3D helix) stay in
each app's `<style>` and may reference these tokens.

## Adding a new theme

Copy `themes/stationery.css` to e.g. `themes/chalkboard.css`, change the `@import`
fonts, the `:root` token values, and the `body` surface. Point an app at the new
theme file instead — `kit.css` and all component markup are unchanged. Component
chrome currently carries a stationery flavor (dashed borders, washi tape); a
radically different theme can override specific component rules after `kit.css`.
