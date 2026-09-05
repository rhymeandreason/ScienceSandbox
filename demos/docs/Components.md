<!-- KIND: reference — the whole of what a page GENERATED from the component library may use. Written to be handed to a model as its only context, so it is complete on its own and says nothing twice. -->

# Components

A generated app is one HTML file. It loads the shared library from `demos/`, mounts one or two components into boxes, wires controls to `set()` and readouts to `state()`, and says in prose what the student is looking at. It writes no Three.js and no physics. If the request needs something no component offers, say so instead of inventing it.

## The page

Every app is a step-through lesson on the shell: a full-window scene, a glass panel with eyebrow, title, body and controls, Back and Next, progress dots. One page, one shell, one or more components mounted in `shell.stage`. There is no other layout.

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>short name</title>
<link rel="stylesheet" href="../css/kodo.css">
<link rel="stylesheet" href="../css/lesson-shell.css">
<style> /* page-specific rules only, and as few as possible */ </style>
</head>
<body>

<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script src="../lib/palette.js"></script>
<script src="../lib/tokens-from-palette.js"></script>
<script src="../lib/molecules.js"></script>
<script src="../lib/mol-small.js"></script>        <!-- water, O2, CO2, small gases -->
<script src="../lib/mol-solvation.js"></script>    <!-- WaterSim only: its water and salts -->
<script src="../lib/scene.js"></script>
<script src="../lib/atomkit.js"></script>          <!-- Membrane only -->
<!-- Leaf and Tree need only three.min.js, palette.js, tokens-from-palette.js, molecules.js, scene.js, lib/geo.js and card-stage.js -->
<script src="../lib/annotate.js"></script>
<script src="../kit/card-stage.js"></script>
<!-- then the component(s), in the order their sections give -->
<script src="../kit/lesson-shell.js"></script>
<script>
  // the shell, the mount(s), shell.goTo(0): see "The step-through shell"
</script>
</body>
</html>
```

Paths are relative to the file, which lives one folder below `demos/`. Load a component's scripts in the order its section gives. Everything is a global; there are no modules and no build. The shell owns the DOM: no markup goes in the body, the panel is filled per step, and the scene is whatever is mounted in `shell.stage`.

Never type an atom or bond colour; the palette publishes them as CSS custom properties `--atom-O`, `--atom-H`, `--atom-Na`, `--bond-covalent`, `--bond-hbond`, and a caption naming an atom uses its token.

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

Every `mount` takes `viewOffset: shell.viewOffset`, the function that centres the scene in the room the panel leaves. Always pass it.

### Movement: set() glides

**A param a step sets is a move the student watches, so `set()` animates it.** You write the destination and the component takes the time it needs: `L.set({ aperture: 0 })` closes the stomata over about a second, it does not teleport them shut. Do not tween it yourself, and never reach for `setTimeout` — a backgrounded tab fires timers while the picture is frozen, and the student comes back to a scene that moved without them.

**A param the student is DRAGGING has to track the thumb**, so a slider passes `snap`:

```js
ui.range(ui.q('#aperture'), v => L.set({ aperture: v }, { snap: true }));
```

Not everything can glide. A param that rebuilds the geometry — a new seed, a layer's thickness — snaps whatever you pass, because a leaf dissolving into a different leaf is not a transition. Each component's section says which of its params move.

To play one on a timeline rather than a control, set the destination when the step opens and let it run; if a step needs several movements in sequence, give each its own step. A component's animation is a property of the component, not a script the page writes.

### Notes: pointing at the scene

Every component has named parts, and a callout can be pinned to any of them. **A question about a thing on stage is answered with a note on that thing**, in the library's words, plus at most one sentence of copy. Not a paragraph.

```js
c.note('pump');                                   // the library's callout, on the pump: a short label, a two-sentence card on click
c.note('pump', { text:'Na⁺/K⁺ pump', card:'…' }); // your own words, same anchor
c.note('outside', { text:'seawater' });           // a bare label
c.notes(['channel.K', 'pump']);                   // exactly these, clearing the rest; c.notes(false) clears
c.anchors();                                      // the names this component has, with their library text
```

Notes follow their part as it moves and as the camera turns. Show two or three at once, never ten. A step that changes subject should `notes(false)` first. Each component's section lists its anchor names.

**A note on a part facing away fades out.** A component says which way a part faces, and the callout goes with it as the model turns: pointing at a stoma from above would put a label on a surface the student is looking at the back of. It happens on its own, so a step may point at anything and trust the model. The chip stays pressed while the note is faded, because the student asked for it — the view below is how they get back to it.

**Some parts also come with a view.** A callout on something facing away from the camera is a label the student cannot check against the thing, so a component may declare a camera pose per part and `c.lookAt('stoma')` flies to it. The show panel does this on its own when a chip turns a note on; a step that places a note itself should call it too. Only the parts that need one have one — a part already in frame does not move the camera — and `c.views()` says which.

### Layers: showing and hiding

Every component declares what can be switched off without stopping the sim: a hidden water still crosses and still counts.

```js
c.layers();                 // [{name, label, on}]
c.show('shells', true);     // one layer; returns c
c.palette();                // [{name, color}] what the colours mean, for a legend
```

### The show panel

The chips for point at and show, plus the colour legend, in one call. **Use this instead of writing your own buttons for notes or layers.**

```js
ctx.ui.showPanel(c, { notes: ['pump'], layers: ['water'] });  // on the step: into the step's controls
CardStage.showPanel(container, c, { layers: ['water'] });     // into any element
```

**Name what the step offers, or you get no chips.** There is no default set: `showPanel(c)` with no `notes` and no `layers` draws the legend and nothing else. A step about the pump offers the pump; two or three chips is a step, seven is a menu. A part not on stage never appears.

`only` picks any of `'notes'`, `'layers'`, `'legend'` when a step wants fewer rows than it named. A question like "what is the purple thing?" is answered by the legend and one note; "can I see it without the water?" by the layers chips.

A backgrounded tab freezes the sim; nothing runs on timers. Readouts belong in the `frame` handler, never in their own loop. A number the page shows comes from `state()`, never typed.

## Scale: which components may share a scene

Every component declares a **rung** (how big) and a **form** (how many). `kit/scale.js` holds the ladder and `docs/Scale.md` is the argument; `tools/check-scale.js` fails a commit where a section here and the code disagree.

```
molecules · macromolecule · membrane · organelle · cell · tissue · organ · organism · population
```

**Same rung may share a scene. Different rungs may not.** Two components at one rung go in one box; crossing a rung is a handoff between two boxes, never a camera move. A cell is about 20 µm and a bilayer about 5 nm, so a page that mounts both in one scene is wrong however good it looks.

**Form is orthogonal, and bulk plus single at the same rung is the normal scene.** A solute molecule in bulk water. A chloroplast in bulk mesophyll. Reach for that pattern rather than a second box.

| Component | rung | form |
| --- | --- | --- |
| WaterSim | molecules | bulk |
| Proteinbox | macromolecule | single |
| Membrane | membrane | bulk |
| Leaf | tissue | bulk |
| Tree | organism | single |

Nothing is at the `organelle`, `organ` or `population` rung yet. **A size a page prints must come from `state()`, and most of these components have no scale to print one from.** Where a real size matters, say it as a fact about the real thing ("a red blood cell is about 8 µm across"), never as a measurement of the picture.

## WaterSim — liquid water and what follows from hydrogen bonds

**Scale**: molecules, bulk. The liquid and any solute spec are the same rung, which is why a solute goes in this box rather than beside it. The render is not measurable: no page prints a distance off it.

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

Anchors for `note()`: `water` (one molecule), `O` and `H` (its atoms, with the partial charges), and with salt on stage `Na` and `Cl`. Layers for `show()`: `hbonds`, `ions`.

Good for: temperature, phase change, why ice floats, salt dissolving, colligative properties. Not for: anything the water is in (no container, no membrane, no surface).

## Membrane — a bilayer, its proteins, and what crosses

**Scale**: membrane, bulk. One scene unit is about an angstrom. Everything crossing is drawn 5x oversize against the sheet, so a size read off a travelling ion is that exaggeration, not a measurement.

```html
<script src="../membrane/parts.js"></script>
<script src="../membrane/pump.js"></script>
<script src="../membrane/chemiosmosis.js"></script>
<script src="../membrane/membrane.js"></script>
```

```js
const m = Membrane.mount(el, {
  proteins: { K:{ x:-36 }, CL:null, NA:null, AQP:null, pump:{ x:36 },   // which machines stand in the sheet, and where (±x, world units, |x| ≤ 110). Too close and the layout spreads them itself, keeping your order
              complex:null, synthase:null, leak:null },                 // the chemiosmotic three, below
  context: 'plasma',     // 'plasma' | 'mitochondrion' | 'thylakoid': renames the two sides and repaints the lipid
  potential: 'nernst',   // 'off': pores conduct forever · 'fixed': E_K, E_Cl constant · 'nernst': from the live counts
  E: { K:-90, CL:-75 },  // mV, used by 'fixed'
  pumpAuto: true,        // the pump re-arms itself; false waits for m.spend()
  pumpOn: true,
  timeScale: 1,          // sim seconds per real second; 2 or 3 to speed it up
  shells: false,         // hydration shells drawn, and shed at a channel's filter
  cut: true,             // proteins cut open so the lumen shows
});
```

Outside is +y (top), inside is −y (bottom). The sheet is an oily bilayer: water and small gases cross it, ions do not. A K⁺ channel admits K⁺ by hydration (Na⁺ is smaller and still refused, because it holds its water too tightly). A Cl⁻ channel admits by charge. A Na⁺ leak channel (`NA`) lets sodium in down its gradient, which is what gives the pump work to do. An aquaporin (`AQP`) passes water in single file and nothing charged, so water crosses fast where one stands; it still seeps through the lipid on its own. The Na⁺/K⁺ pump carries 3 Na⁺ out and 2 K⁺ in per ATP, never open at both ends. With the potential on, every K⁺ leaving builds the voltage that stops the leak. A cell that is honest about seawater has `NA`, `K` and `pump`; an osmosis lesson at the kidney has `AQP`. **This is one patch of one membrane.** A cell in a tissue has two faces with different proteins, and a lesson about a gill, a gut or a kidney should say which face this is, usually the one touching the environment, and that the blood is on the other side of the cell, not on the other side of this membrane.

### Chemiosmosis: the same membrane in an organelle

Respiration and photosynthesis are this picture with one parameter flipped.

```js
const m = Membrane.mount(el, {
  context: 'mitochondrion',   // or 'thylakoid': renames the two sides, tints the lipid
  fuel: 'light',              // 'NADH' | 'FADH2' | 'light' | null (nothing driving it)
  fuelRate: 1,                // 0..1: a light dimmer, or an oxygen switch
  proteins: { complex:{ x:-80 }, synthase:{ x:40 }, leak:null },
  contents: { inside:{ water:30, H:22 }, outside:{ water:30, H:22 } },   // 'H' is a proton
  potential: 'nernst',
});
```

`complex` burns fuel to carry protons **inside → outside only**, on a six-phase cycle it visibly turns through. `synthase` is a turbine, not a pump: protons come back down through it and the rotor turns, and it cannot run uphill, so with the gradient gone it stops. `leak` is an uncoupler's hole — protons home without making ATP, and the fuel all comes out as heat. The complexes slow as the force they pump against rises and stall near `state().pmfStall`: respiratory control.

**THE SIM ALWAYS DRAWS THE PUMPED-INTO SIDE ON TOP, and in a thylakoid that is the lumen.** A real chloroplast has the lumen inside and the stroma around it, so the sentence you are about to write — "the outer stroma and the inner lumen" — is true of the plant and backwards on this screen. Say which side protons are pumped *to*, not which is inner. `state().sides.inside` and `.outside` are the two names; a card that types them instead will eventually call a matrix "inside the cell".

A step that asks **what the gradient IS** gets `state().pH`, `.dpH`, `.pmf` in a stat tile. A step that asks **where the energy WENT** gets `state().atpMade` against `.protonsThroughSynthase` and `.protonsLeaked` — the ledger only means something as a comparison. A step that asks **what the machine is DOING** gets `state().complexLabel`, which names the beat of the cycle it is on. Do not caption a machine from the step's own prose while it is mid-turn; the label is what it is actually doing.

Ratios come from `state().stoichiometry` and `.complexStoichiometry`, never typed: the rotor is what decides them.

Populating it. The box starts empty. Say what is dissolved on each side and the module keeps the stage matching it:

```js
m.set({ contents: {
  inside:  { water:46, K:20, NA:4, A:8 },     // kind: 'water' | 'o2' | 'co2' | 'NA' | 'K' | 'CL' | 'A' (an impermeant anion)
  outside: { water:26, NA:26, CL:26 },
} });                            // 'H' is a proton, for a chemiosmosis scene
m.reset();                       // zero the counters after a change of scene
m.spend();                       // one ATP, one pump turn; false if a turn is running or no Na⁺ inside
```

Or in millimolar, which is how a page should say it: `units: 'mM'` in the mount params, then `contents: { inside: { K:140, NA:12 }, outside: { NA:470, CL:550 } }` and the module turns it into counts, one particle per 20 mM, with water filling each side. Leave water out; the module fills it. `state().concentration[kind].inside / .outside` reads back in mM, so print that rather than typing a molarity. Blood is about 150 mM Na⁺, seawater 470, a river under 1.

Changing `contents` adds and removes only the difference, by current side, so a water that already crossed stays crossed. **The budget is 220 particles on stage, of which at most 110 ions**; past it nothing more is added. Keep the same particle count per side and fewer free waters where the solute is; that is what makes osmosis a headcount rather than a pull. About 78 particles a side reads well: 78 water on the fresh side, and on a salty side 26 water with 26 Na⁺ and 26 Cl⁻.

For one molecule placed by hand there is `m.add(kind, opts)` with `opts.x, .y, .z`, and `m.scatter(kind, n, side, opts)` with side 1 outside, −1 inside.

Defaults do the right thing: ions walk slower and are blocked by the bilayer, water and gases cross it and keep out of the pores, a K⁺ or Cl⁻ ion uses a channel of its kind when one stands in the sheet, and the anions stay deep inside. `opts` on `add`/`scatter` can override: `conducts:'K'`, `seeks:true` (tries the channel and is refused, what Na⁺ does), `speed:[lo,hi]`, `blocked:false`.

`state()`:

| field | meaning |
| --- | --- |
| `t` | sim seconds |
| `counts[kind].inside / .outside` | every kind on stage, by side |
| `concentration[kind].inside / .outside`, `mMPerParticle` | the same in mM, one particle per `mMPerParticle` (20); print this, never a typed molarity |
| `net` | `'entering'`, `'leaving'` or `'balanced'`: the verdict to print for water. It is read off the free-water headcount per side, which is what osmosis is, so it is right from the first frame |
| `crossings.up / .down`, `netRecent` | what actually happened: lifetime crossings each way, and a recent net that decays to 0 at equilibrium (positive means leaving the cell). Noisy for the first half minute at this crowd size, so print it as a count, not a direction |
| `mV`, `equilibrium.K`, `equilibrium.CL` | membrane potential and each ion's equilibrium potential |
| `crossed.K`, `crossed.CL`, `crossed.NA`, `crossed.water` | net transits through each channel, signed outward |
| `atpSpent`, `pumpRunning`, `pumpPhase`, `pumpT` | the pump's ledger and where it is in its cycle |
| `context`, `sides.inside / .outside` | what to call the two compartments here; print these rather than "inside the cell" |
| `pH.inside / .outside`, `dpH`, `pmf` | the proton gradient: pH per side, the difference, and the proton-motive force in mV (positive means protons want to come back in) |
| `atpMade`, `rotorTurns`, `protonsThroughSynthase`, `protonsLeaked`, `complexTurns` | the proton circuit's ledger, every entry counted rather than declared |
| `stoichiometry.protonsPerTurn / .atpPerTurn / .protonsPerATP` | what the rotor is actually keeping to. Print it; do not type a ratio |
| `fuel`, `fuelRate`, `pmfStall` | the fuel, the rate after back-pressure has slowed it, and the pmf at which the complexes stall |
| `complexPhase`, `complexLabel`, `complexCaption`, `complexT` | where the complex is in its six-phase cycle, and the words for that beat |

Events: `frame` (state, dt) · `cross` (traveller, dir) through the bilayer · `conduct` (traveller, dir) through a channel · `turn` (n) a pump turn starting · `turned` (n) one finishing · `pumped` (n) one proton thrown out by the complex · `atp` (n) the synthase completing one.

Anchors for `note()`: `channel.K`, `channel.CL`, `channel.NA`, `aquaporin`, `pump`, `complex`, `synthase`, `leak` (each only when that protein is in the layout), `heads` and `tails` (the bilayer's two halves), `outside`, `inside`, and one molecule of each kind on stage: `water`, `NA`, `K`, `CL`, `A`, `H`. The `outside` and `inside` cards are rewritten by the context, so they name the matrix or the stroma without the page saying so. "What are the two proteins?" is `m.notes(['channel.K', 'pump'])`.

Layers for `show()`: `water`, `ions`, `badges` (the charge signs), `shells`, `cut` (proteins cut open), `membrane`.

Good for: diffusion, osmosis and tonicity, selectivity, the resting potential, active transport and its cost, a cell in a changed environment, chemiosmosis in either organelle, uncouplers and why they make heat. Not for: a specific real protein's shape, receptors, vesicles, anything at whole-cell scale.

## Proteinbox — a real protein, from the library

**Scale**: macromolecule, single. One scene unit is one angstrom, from a lab's own coordinates, and nothing is exaggerated. This is the one component a page may print a real distance off.

```html
<link rel="stylesheet" href="../kit/proteinbox.css">
...
<script src="../folding/folding.js"></script>
<script src="../kit/ribbon.js"></script>
<script src="../kit/nucleic.js"></script>
<script src="../kit/surface.js"></script>
<script src="../kit/card-stage.js"></script>
<script src="../kit/proteinbox.js"></script>
<script src="../proteins/proteins.js"></script>
```

```js
const P = Proteinbox.mount(el, {
  protein: 'hemoglobin',   // a key from the list below
  variant: undefined,      // a PDB id the registry holds for it; omit for the default
  rep: 'ribbon',           // 'ribbon' | 'surface' | 'fold'; the last two only where state().available says so
  colors: undefined,       // omit: helices, sheets and loops in the library's palette. {byChain:{A:0x..., B:0x...}} to tell chains apart
});
```

These are deposited structures drawn at real ångströms from files this repo baked, so a page can make measured claims about them, and `state()` carries the facts to print: `name`, `does`, `blurb`, `variant`, `species`, `purpose`, `method` (how it was solved), `residues`, `chains`, `rep`, and `available` for surface and fold. Never type a residue count or a method; read them. `set({protein})` fetches and redraws in the same box. Drag turns the molecule.

Proteins: `atp-synthase`, `napump` (the sodium-potassium pump), `prion`, `amylase`, `hexokinase`, `chymotrypsin`, `hemoglobin`, `collagen`, `rnase`, `insulin`, `myoglobin`, `gfp`, `ferritin`, `rubisco`, `lysozyme`, `antibody`. Through the registry nearly all of them are ribbon only; ask `state().available` before offering a surface or fold control, and do not promise one in the copy. Events: `rep` (name) when the representation changes · `load` (state) when a swapped protein has drawn.

Good for: what a protein looks like, primary to quaternary structure, comparing two proteins side by side in two boxes, enzymes and their shape. Not for: animation of function (nothing here moves except hemoglobin's fold), or any protein not in the list.

## Leaf — a leaf in cross-section, tissue by tissue

**Scale**: tissue, bulk. Layer heights and `width` / `depth` are scene units, not micrometres. Proportions are a diagram's: no page prints a thickness off it.

```html
<script src="../lib/geo.js"></script>          <!-- before card-stage.js -->
<script src="../leaf/leaf.js"></script>
```

```js
const L = Leaf.mount(el, {
  explode: 0,          // 0..1, the layers lifted apart
  seed: 1337,          // any integer; a new seed is a new leaf
  isolate: null,       // a layer name kept opaque while the rest fade
  autoRotate: false,
  aperture: 1,         // 0..1, the stomata shut to open
  flows: { co2:0, o2:0, vapour:0, sap:0 },   // each 0..1; gases are gated by aperture
  layers: { cuticle:0.12, upperEpi:0.7, palisade:2.4, spongy:2.6, lowerEpi:0.7 },  // heights; changing one rebuilds
});
```

Layer names, bottom to top: `lowerEpi` (with stomata), `spongy` (air spaces, cells with chloroplasts), `bundle` (the vein: xylem above, phloem below), `palisade` (columns packed with chloroplasts, where most photosynthesis happens), `upperEpi` with the waxy cuticle on top. Hovering a layer lights it and clicking isolates it; the page can do the same with `set({isolate})`. Nothing here is measured: the proportions are a textbook diagram's, and the page should say so if it makes a claim about size.

`aperture` opens and closes every stoma at once: turgid guard cells bow apart and a pore appears between them, drained they meet and it shuts. It is the thing in this component that a lesson moves, so a step about water loss or gas exchange sets it and turns the leaf over to watch, which the camera allows. The underside is where the stomata are.

`flows` is the traffic, and it is what the leaf is FOR: `co2` in, `o2` out, `vapour` out, and `sap` arriving along the vein. Sap and vapour are one journey: water runs down the xylem, turns off into the air spaces, and leaves as vapour through a stoma, so a step about transpiration turns both on. They are drawn as real molecules with their atoms — linear O=C=O, bent water — so the exchange reads as chemistry rather than as two colours of dot, and the same shapes a student met in a molecule lesson turn up here. **The three that pass a pore are multiplied by `aperture`**, so shutting the stomata stops the gas exchange and leaves the sap running; that trade is the lesson, and a step about drought or water loss is one `set({aperture})` with the flows on. Their molecules are drawn about 53,000× oversize (`Leaf.SCALE.exag`), which a page reads from there rather than typing; nothing else in the component is exaggerated.

Glides: `aperture`, `explode`, and the fade `isolate` puts on everything else. Snaps: `seed`, `layers`, `width`, `depth`, all of which rebuild.

`state()`: `explode`, `seed`, `isolate`, `aperture`, `hovered`, and `layers` as a list of `{name, y, height}`. Events: `frame` (state) · `hover` (name or null) · `select` (name or null).

Anchors for `note()`: `upperEpi`, `cuticle`, `palisade`, `spongy`, `bundle`, `lowerEpi`, `stoma`. Each carries the library's two-sentence card on what that tissue does. `stoma` and `lowerEpi` carry a view as well: pointing at either turns the leaf over, because the stomata are underneath, and their callouts fade out if the student turns it back.

Layers for `show()`: the five tissues by the same names, plus `chloroplasts`, `cuticle`, and the four flows (`co2`, `o2`, `vapour`, `sap`), which a chip turns fully on or off — a step wanting a half-open stream sets `flows` instead.

Good for: leaf anatomy, gas exchange, transpiration, what a vein carries, structure and function of each tissue, and the trade a stoma makes between CO₂ in and water out. Not for: a single cell's interior, light or a day/night cycle, or comparing one kind of leaf with another — the stomata are always on the underside at one density.

## Tree — a tree, the air around it, and where its mass came from

**Scale**: organism, single. The person beside it is how this scene answers size, by comparison rather than by a number. The mass shares in `Tree.PILES` are the numbers it owns.

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

Anchors for `note()`: `trunk`, `canopy`, `leaves`, `roots`, `soil`, `sun`, `person`, `air`, and with `potScene` on, `pot` and `willow`.

Layers for `show()`: the flows `co2`, `o2`, `h2o`, `minerals`, `ambient`, and `piles`, `person`, `sun`.

Good for: where a plant's mass comes from, photosynthesis as traffic, Van Helmont's experiment, scale of carbon stored in a tree. Not for: a leaf's interior (that is Leaf), or any molecule.

## The step-through shell

The shell is the page. Every app is a sequence of steps, even one step: the scene fills the window, the panel carries the copy and the controls, and the student moves with Back and Next.

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

## Graph — a chart of measurements, or of a running sim

**Scale**: none. A graph is not in the world; its axes carry their own units.

```html
<link rel="stylesheet" href="../graph/graph.css">
<script src="https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@observablehq/plot@0.6.16/dist/plot.umd.min.js"></script>
<script src="../graph/graph.js"></script>
```

Never draw a chart by hand. A graph goes in the panel, not on the stage: mount it
in `onEnter` from `ctx.ui.q()`, destroy it in `onExit`.

```js
Graph.mount(el, {
  kind: 'scatter',       // scatter | line | bar | histogram | box
  data: rows,            // plain objects; Graph.csv(text) parses a CSV into them
  x: { field: 'temp', label: 'Temperature', unit: 'C' },   // the axis writes "Temperature (C)"
  y: { field: 'rate', label: 'Reaction rate', unit: 'umol/min' },
  color: 'group',        // a field to split into series, with a legend
  error: 'sd',           // 'sd' | 'sem' | a field of plus/minus values
  fit: 'linear', ci: 0.95, xIntercept: true,
  ref: [{ x: 37, label: 'body temp' }],
  caption: 'one sentence about what the marks are',
});
```

A live trace off a running component is one line. The signal carries its own
label, unit and y range, so no page types a maximum:

```js
Graph.mount(el, { live: { span: 120 }, height: 130 }).follow(m, 'water');
```

`Membrane.SIGNALS`: `water`, `sodium`, `potassium`, `protons` — each side, two
lines named by context · `voltage` mV · `dpH` · `pmf` mV · `atp` cumulative.

**A step that asks how something CHANGES gets a trace; a step that asks what
something IS gets a `.stat` and a number.** Net water flow, a gradient
building, ATP accumulating: a stat reading "balanced" is a word for a shape the
student could have watched.

`state()` is `{n, rows, series, x, y, fit:{slope, intercept, r2, xIntercept}}`,
and a number the page prints about a graph is read from it. Two quantities on
one x share one axis, normalized to percent of maximum: there is no second
y-axis.

## Copy

A tutor for a college Bio 101 student. Concise, no repetition, one claim per paragraph, in bold, that the picture is showing right now. Prefer a question the student can answer by touching a control. No em dashes.

**Show, do not tell.** When a student asks what something is, put a note on it, in the step where they asked. When they ask what happens if, add a control that does it, or a step that shows it. When they ask to see or hide something, it is a layer. A note names the part it is on, not the whole scene. Add a paragraph only when none of those is possible. A panel body stays under two short paragraphs, and an edit that would push it past that replaces text rather than adding it. When something asked for is beyond the components, say so in one sentence in the page rather than faking it.
