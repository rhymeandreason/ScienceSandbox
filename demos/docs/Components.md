<!-- KIND: reference — the whole of what a page GENERATED from the component library may use. Written to be handed to a model as its only context, so it is complete on its own and says nothing twice. -->

# Components

A generated app is one HTML file. It loads the shared library from `demos/`, mounts one or two components into boxes, wires controls to `set()` and readouts to `state()`, and says in prose what the student is looking at. It writes no Three.js and no physics. If the request needs something no component offers, say so instead of inventing it.

## The page

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>short name</title>
<link rel="stylesheet" href="../css/main.css">
<link rel="stylesheet" href="../css/sandbox.css">
<style> /* page-specific rules only */ </style>
</head>
<body>
<div id="app-sidebar">
  <div id="stage"></div>          <!-- the component's box: it fills this -->
  <div id="side">                 <!-- title, claim, controls, readouts -->
    <h1 style="font-size:17px">title</h1>
    <p class="note" id="claim"></p>
    <div class="grp"><div class="hd">controls</div> ... </div>
    <div class="grp"><div class="hd">readouts</div><table class="rd" id="rd"></table></div>
  </div>
</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script src="../lib/palette.js"></script>
<script src="../lib/tokens-from-palette.js"></script>
<script src="../lib/molecules.js"></script>
<script src="../lib/mol-small.js"></script>        <!-- water, O2, CO2, small gases -->
<script src="../lib/mol-solvation.js"></script>    <!-- WaterSim only: its water and salts -->
<script src="../lib/scene.js"></script>
<script src="../lib/atomkit.js"></script>          <!-- Membrane only -->
<script src="../kit/card-stage.js"></script>
<!-- then the component(s), then the page script -->
</body>
</html>
```

Paths are relative to the file, which lives one folder below `demos/`. Load a component's scripts in the order its section gives. Everything is a global; there are no modules and no build.

The shell classes in `sandbox.css`: `.grp` is a control group, `.hd` its heading, `p.note` small prose, `table.rd` a two-column readout table. Style anything else in the page's own `<style>`. Never type an atom or bond colour; the palette publishes them as CSS custom properties `--atom-O`, `--atom-H`, `--atom-Na`, `--bond-covalent`, `--bond-hbond`, and a caption naming an atom uses its token.

## Contract every component shares

```js
const c = X.mount(el, params);   // builds a canvas inside el and starts running
c.set({ ...params });            // change any param live; returns c
c.state();                       // the latest reading, a plain object; null before the first frame
c.on('frame', s => ...);         // every tick, with the reading; returns an unsubscribe function
c.start(); c.stop();             // pause keeps the last picture on screen
c.pump(dt);                      // one step and one draw by hand; for tests
c.destroy();                     // gives the WebGL context back
c.sim; c.box;                    // the layers under it, for a page that outgrows the params
```

A backgrounded tab freezes the sim; nothing runs on timers. Readouts belong in the `frame` handler, never in their own loop. A number the page shows comes from `state()`, never typed.

## WaterSim — liquid water and what follows from hydrogen bonds

```html
<script src="../water/watersim.js"></script>
<script src="../water/watersim-mount.js"></script>
```

```js
const w = WaterSim.mount(el, {
  nWater: 16,          // molecules, 1..60
  salt: null,          // 'nacl' or null
  nSalt: 0,            // crystal PAIRS, 0..8. Lowering it clears and re-drops
  temperature: null,   // °C, -25..110; null is room temperature with the continuum off
  freeze: false,       // may cooling build ice
  hbonds: true,        // draw the dashed network
  still: false,        // no thermal jiggle (one molecule under inspection)
  cam: { theta:0.5, phi:1.15, r:26 },   // first mount only
});
```

What it models, and the numbers `state()` returns every frame:

| field | meaning |
| --- | --- |
| `nWater`, `nIons` | counts on stage (ions are Na⁺ and Cl⁻ separately) |
| `hbondCount` | hydrogen bonds this frame. A water takes at most four |
| `fz` | 0 liquid to 1 ice. Ice is the real hexagonal lattice and takes MORE room |
| `warm`, `kinetic` | 0..1 warmth and the extra jiggle it buys |
| `escaping` | molecules leaving as vapour this frame; boiling is at 100 °C plus `dTb` |
| `dTf`, `dTb` | freezing-point depression and boiling-point elevation from dissolved salt, °C |
| `molal` | free particles per kg of water |
| `hbScale` | how strong the H-bond network is at this temperature and freeze fraction |

Events: `frame` (state) · `dissociate` (na, cl, at) when water wedges a salt pair apart · `saltchange` when the phase-change points move. The freezing point in the readout is `-dTf`, the boiling point `100 + dTb`.

Good for: temperature, phase change, why ice floats, salt dissolving, colligative properties. Not for: anything the water is in (no container, no membrane, no surface).

## Membrane — a bilayer, its proteins, and what crosses

```html
<script src="../membrane/parts.js"></script>
<script src="../membrane/pump.js"></script>
<script src="../membrane/membrane.js"></script>
```

```js
const m = Membrane.mount(el, {
  proteins: { K:{ x:-36 }, CL:null, pump:{ x:36 } },  // which machines stand in the sheet, and where (±x, world units; keep |x| ≤ 60 and pores 70 apart)
  potential: 'nernst',   // 'off': pores conduct forever · 'fixed': E_K, E_Cl constant · 'nernst': from the live counts
  E: { K:-90, CL:-75 },  // mV, used by 'fixed'
  pumpAuto: true,        // the pump re-arms itself; false waits for m.spend()
  pumpOn: true,
  shells: false,         // hydration shells drawn, and shed at a channel's filter
  cut: true,             // proteins cut open so the lumen shows
});
```

Outside is +y (top), inside is −y (bottom). The sheet is an oily bilayer: water and small gases cross it, ions do not. A K⁺ channel admits K⁺ by hydration (Na⁺ is smaller and still refused, because it holds its water too tightly). A Cl⁻ channel admits by charge. The Na⁺/K⁺ pump carries 3 Na⁺ out and 2 K⁺ in per ATP, never open at both ends. With the potential on, every K⁺ leaving builds the voltage that stops the leak.

Populating it. The box starts empty. Say what is dissolved on each side and the module keeps the stage matching it:

```js
m.set({ contents: {
  inside:  { water:46, K:20, NA:4, A:8 },     // kind: 'water' | 'o2' | 'co2' | 'NA' | 'K' | 'CL' | 'A' (an impermeant anion)
  outside: { water:26, NA:26, CL:26 },
} });
m.reset();                       // zero the counters after a change of scene
m.spend();                       // one ATP, one pump turn; false if a turn is running or no Na⁺ inside
```

Changing `contents` adds and removes only the difference, by current side, so a water that already crossed stays crossed. **The budget is 220 particles on stage in total**; past it nothing more is added. Keep the same particle count per side and fewer free waters where the solute is; that is what makes osmosis a headcount rather than a pull. About 78 particles a side reads well: 78 water on the fresh side, and on a salty side 26 water with 26 Na⁺ and 26 Cl⁻.

For one molecule placed by hand there is `m.add(kind, opts)` with `opts.x, .y, .z`, and `m.scatter(kind, n, side, opts)` with side 1 outside, −1 inside.

Defaults do the right thing: ions walk slower and are blocked by the bilayer, water and gases cross it and keep out of the pores, a K⁺ or Cl⁻ ion uses a channel of its kind when one stands in the sheet, and the anions stay deep inside. `opts` on `add`/`scatter` can override: `conducts:'K'`, `seeks:true` (tries the channel and is refused, what Na⁺ does), `speed:[lo,hi]`, `blocked:false`.

`state()`:

| field | meaning |
| --- | --- |
| `t` | sim seconds |
| `counts[kind].inside / .outside` | every kind on stage, by side |
| `crossings.up / .down`, `netRecent` | water through the bilayer: lifetime, and a recent net that decays to 0 at equilibrium (positive means leaving the cell) |
| `mV`, `equilibrium.K`, `equilibrium.CL` | membrane potential and each ion's equilibrium potential |
| `crossed.K`, `crossed.CL` | net charge through each channel |
| `atpSpent`, `pumpRunning`, `pumpPhase`, `pumpT` | the pump's ledger and where it is in its cycle |

Events: `frame` (state, dt) · `cross` (traveller, dir) through the bilayer · `conduct` (traveller, dir) through a channel · `turn` (n) a pump turn starting · `turned` (n) one finishing.

Good for: diffusion, osmosis and tonicity, selectivity, the resting potential, active transport and its cost, a cell in a changed environment. Not for: a specific real protein's shape, receptors, vesicles, anything at whole-cell scale.

## A chart

Draw one as an inline SVG from a series the page collects in its `frame` handler, one sample a second, over a fixed window. A `<path>` per line, `viewBox="0 0 300 110"`, `preserveAspectRatio="none"`, and the y-axis labelled with the same number the series is bounded by. No chart library.

## Copy

A tutor for a college Bio 101 student. Concise, no repetition, one claim per paragraph, in bold, that the picture is showing right now. Prefer a question the student can answer by touching a control. No em dashes.
