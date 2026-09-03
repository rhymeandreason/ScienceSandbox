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
<!-- Leaf needs only three.min.js, palette.js, tokens-from-palette.js, molecules.js, scene.js and card-stage.js -->
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

Every `mount` also takes `viewOffset`, a function of the canvas size returning the pixel shift that centres the scene in the room a panel leaves. On the step-through shell pass `viewOffset: shell.viewOffset`; on the sidebar page leave it out.

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

Changing `contents` adds and removes only the difference, by current side, so a water that already crossed stays crossed. **The budget is 220 particles on stage, of which at most 110 ions**; past it nothing more is added. Keep the same particle count per side and fewer free waters where the solute is; that is what makes osmosis a headcount rather than a pull. About 78 particles a side reads well: 78 water on the fresh side, and on a salty side 26 water with 26 Na⁺ and 26 Cl⁻.

For one molecule placed by hand there is `m.add(kind, opts)` with `opts.x, .y, .z`, and `m.scatter(kind, n, side, opts)` with side 1 outside, −1 inside.

Defaults do the right thing: ions walk slower and are blocked by the bilayer, water and gases cross it and keep out of the pores, a K⁺ or Cl⁻ ion uses a channel of its kind when one stands in the sheet, and the anions stay deep inside. `opts` on `add`/`scatter` can override: `conducts:'K'`, `seeks:true` (tries the channel and is refused, what Na⁺ does), `speed:[lo,hi]`, `blocked:false`.

`state()`:

| field | meaning |
| --- | --- |
| `t` | sim seconds |
| `counts[kind].inside / .outside` | every kind on stage, by side |
| `net` | `'entering'`, `'leaving'` or `'balanced'`: the verdict to print for water. It is read off the free-water headcount per side, which is what osmosis is, so it is right from the first frame |
| `crossings.up / .down`, `netRecent` | what actually happened: lifetime crossings each way, and a recent net that decays to 0 at equilibrium (positive means leaving the cell). Noisy for the first half minute at this crowd size, so print it as a count, not a direction |
| `mV`, `equilibrium.K`, `equilibrium.CL` | membrane potential and each ion's equilibrium potential |
| `crossed.K`, `crossed.CL` | net charge through each channel |
| `atpSpent`, `pumpRunning`, `pumpPhase`, `pumpT` | the pump's ledger and where it is in its cycle |

Events: `frame` (state, dt) · `cross` (traveller, dir) through the bilayer · `conduct` (traveller, dir) through a channel · `turn` (n) a pump turn starting · `turned` (n) one finishing.

Good for: diffusion, osmosis and tonicity, selectivity, the resting potential, active transport and its cost, a cell in a changed environment. Not for: a specific real protein's shape, receptors, vesicles, anything at whole-cell scale.

## Leaf — a leaf in cross-section, tissue by tissue

```html
<script src="../leaf/leaf.js"></script>
```

```js
const L = Leaf.mount(el, {
  explode: 0,          // 0..1, the layers lifted apart
  seed: 1337,          // any integer; a new seed is a new leaf
  isolate: null,       // a layer name kept opaque while the rest fade
  autoRotate: false,
  layers: { cuticle:0.12, upperEpi:0.7, palisade:2.4, spongy:2.6, lowerEpi:0.7 },  // heights; changing one rebuilds
});
```

Layer names, bottom to top: `lowerEpi` (with stomata), `spongy` (air spaces, cells with chloroplasts), `bundle` (the vein: xylem above, phloem below), `palisade` (columns packed with chloroplasts, where most photosynthesis happens), `upperEpi` with the waxy cuticle on top. Hovering a layer lights it and clicking isolates it; the page can do the same with `set({isolate})`. Nothing here is measured: the proportions are a textbook diagram's, and the page should say so if it makes a claim about size.

`state()`: `explode`, `seed`, `isolate`, `hovered`, and `layers` as a list of `{name, y, height}`. Events: `frame` (state) · `hover` (name or null) · `select` (name or null).

Good for: leaf anatomy, where gas exchange and photosynthesis happen, what a vein is, structure and function of each tissue. Not for: a single cell's interior, or any process; nothing moves in it.

## Tree — a tree, the air around it, and where its mass came from

```html
<script src="../lib/geo.js"></script>          <!-- before card-stage.js -->
<script src="../tree/tree.js"></script>
```

```js
const T = Tree.mount(el, {
  growth: 1,            // 0..1 of the oak; 1 is a 25 m tree
  daylight: 1,          // 0..1, tweened; below 0.5 the page hears 'night'
  treeOpacity: 1,       // the oak ghosts so the piles can be read
  potScene: false,      // Van Helmont's willow in its pot instead of the oak
  flows: { co2:0, o2:0, h2o:0, minerals:0, ambient:0 },   // each 0..1
  piles: null,          // 'dry' | 'fresh' takes the tree apart by origin: air, water, soil
  saplingGrowth: 1,
  pos: [21, 9.5, 28], target: [0, 6.5, 0],   // first camera
});
T.flyTo([5.2, 3.6, 7], [0, 2.3, 0], 1.6);    // a camera flight; a drag cancels it
```

The organism scale, and choreography rather than physics: CO₂ drifts into the canopy, O₂ leaves it, water and minerals climb the trunk, and the piles show the lesson's shares of dry mass (about 93% from CO₂, 6% from water's hydrogen, 1% minerals). `Tree.PILES` holds those numbers for a legend. `state()` returns the params at their current values. Events: `frame` (state, dt) · `night` (bool), which a page uses to switch the shell's theme.

Good for: where a plant's mass comes from, photosynthesis as traffic, Van Helmont's experiment, scale of carbon stored in a tree. Not for: a leaf's interior (that is Leaf), or any molecule.

## The step-through shell

For an app with a sequence of steps, use the shell instead of the sidebar page. It is the same look every generated lesson takes: a full-window scene, a glass panel with eyebrow, title, body and controls, Back and Next, progress dots.

```html
<link rel="stylesheet" href="../css/kodo.css">
<link rel="stylesheet" href="../css/lesson-shell.css">
...
<script src="../kit/lesson-shell.js"></script>
```

```js
const shell = LessonShell.create({
  brand: 'The Mass of a Tree',
  hint: 'Drag to orbit · Scroll to zoom',
  ctx: { state: {} },                        // handed to every step; the shell adds ui and goTo
  steps: [{
    eyebrow: 'Start here', title: 'Where does a tree’s mass come from?',
    body: '<p>...</p>',                       // or a function of ctx
    nextLabel: 'Test it',
    camera: { pos: [21, 9.5, 28], target: [0, 6.5, 0] },
    onEnter(ctx) { ctx.ui.controls('<button class="btn secondary" id="go">Go</button>'); ctx.ui.q('#go').onclick = ...; },
    onExit(ctx) {},
  }],
  onStep(step) { if (step.camera) T.flyTo(step.camera.pos, step.camera.target); },
});
const T = Tree.mount(shell.stage, { viewOffset: shell.viewOffset });
T.on('night', on => shell.theme('is-night', on));
shell.goTo(0);
```

`ctx.ui` inside a step: `controls(html)` fills the slot, `q(sel)` and `qa(sel)` find inside it, `show(el)` and `hide(el)`, `setNext(label, visible)`, and `range(input, onChange)`, which paints a slider's track and fires once with its value. The panel's own classes, all styled: `.choices > .choice`, `.callout`, `.slider` with `.slider-head`, `.label`, `.value`, `.stats > .stat` with `.stat-label`, `.stat-value`, `.stat-sub`, `.chips > .chip`, `.switch` with `.track`, `.seg`, `.legend`, `.equation`, `.btn.primary | .secondary | .ghost`, and `.is-hidden`. `shell.viewOffset` is what every mount takes to centre its scene beside the panel. The shell knows nothing about the scene; the camera named by a step is flown in `onStep`.

## A chart

Draw one as an inline SVG from a series the page collects in its `frame` handler, one sample a second, over a fixed window. A `<path>` per line, `viewBox="0 0 300 110"`, `preserveAspectRatio="none"`, and the y-axis labelled with the same number the series is bounded by. No chart library.

## Copy

A tutor for a college Bio 101 student. Concise, no repetition, one claim per paragraph, in bold, that the picture is showing right now. Prefer a question the student can answer by touching a control. No em dashes.
