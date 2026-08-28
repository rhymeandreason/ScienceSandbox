<!-- KIND: recipe + reference — load when drawing a PROTEIN from deposited coordinates: which of tube / ribbon / surface a page wants, what each one costs, and the settled verdict on outside viewers. Not needed for a lesson that only draws molecules from specs. -->

# Rendering modules

**All four renderers live in `kit/`** — `molbox.js`, `proteinbox.js`, `tube.js`, `ribbon.js` — with `surface.js` beside them for the baked skin. They were scattered across `hemoglobin/` and `folding/` for as long as one lesson was the only caller of each; a module named for the page that happened to want it first reads as that page's private code, and the next page copies it instead. `hemoglobin/foldplay.js` is the one that stayed put, because a trajectory played as a ribbon is haemoglobin's own act rather than a way of drawing.

A bench stays with its subject, not always with its module: `kit/ribbon-test.html` moved here, `hemoglobin/tube-test.html` did not, since it loads `hbfold.js` and fetches 2HHB's bakes.

**`kit/molbox.js` — `Molbox`**

Use this to draw macromolecules on the page unless you need animations.

**`kit/proteinbox.js` — `Proteinbox`**

`Use this to draw Proteins unless the human gives you a reason not to. `Its own CardStage scene, ortho by default, real angstroms. 

```
Proteinbox.create({ mount, trace | data, chains, view, colors, sub, orbit, surface, fold })
```

Three things it can show, and only the first is free: the 12 KB trace on create, a \~360 KB SES and an \~830 KB trajectory on the click that asks for them. Omit `surface` and there is no toggle; omit `fold` and there is no play button. Returns card-stage's box (so a pool's acquire / snapshot / destroy work unchanged) plus `drop()`, `setData(t)`, `setPocket(p)` and `rep`.

* **`data:` is `trace:` already parsed** — the same object, no fetch. **It does not read PDB and must not learn to**: parsing decides which altloc, which chain, and whether secondary structure is read or detected, and a page that owns a protein already owns those decisions. What is shared is the box — the scene, the camera, the framing and the turn — so a page whose coordinates arrive as anything else parses them itself and hands over chains. `proteins/prion/prion-test.html` builds the object straight off a PDB with `proteins/prion/prion.js`.

* **`setData(t)` redraws without replacing the box**, so a reader who turned the molecule keeps that view across a switch. A page comparing several structures wants one box re-fed, not one box per structure: the alternative costs a WebGL context each and snaps the camera back on every click.

* **The ribbon breaks where the chain breaks**, on `nums` from the trace. A chain carrying only `first` is treated as contiguous, which is the honest reading of a file that does not say otherwise — and why `bake-trace.js` now writes them.

* **`view:` is a 3x3 basis saying which way the structure should face**, applied to the chain group so the camera stays the reader's — the same split `scene.js` makes for a molecule spec's `view`. A trace carries its own when the bake solved one. **The box seeds a canonical camera on the FIRST data only**: "shortest axis into the screen" means nothing looked at obliquely, and a card's default camera stands off at an angle. After that the camera is the reader's, and a switch must not snap away the turn they just made.

* **`sub:` is samples per residue, default 6.** A card is a thumbnail with a triangle budget; at full height 6 shows as faceting wherever the chain turns hard — the ends of arrows and tight loops read chunky, which is the spline showing rather than the protein. `RibbonLib`'s own default is 10 and that is what a stage wants.

* **`colors:`** overrides the ss palette: one number for flat, or `{C,H,E}` for some of it. Omit it and every protein in the repo is drawn the same way, which is the default for a reason. A page overrides only when colour is carrying a claim of its own (prion: healthy fold against disease fold).

* **`setPocket({atoms, bonds})` is the few atoms drawn INSIDE the ribbon** — a heme, what is bound to its iron, the one or two side chains a bench is about. Ball-and-stick is the exception a group of \~40 atoms earns: it is a shape you can read at 10 Å across, which 150 residues of the same treatment is not, and it is how every published figure draws a porphyrin. **The proportions are the module's** (`BALL`, `FE_BALL`, `STICK`): smaller balls and more than twice the house stick width, because the subject is the group's shape seen from across a 40 Å protein and at that distance the house width is about a pixel. Judge them at a whole-protein framing, never zoomed in. Sticks are SPLIT, each half in its atom's colour — deposited coordinates have no spec and often no hydrogens, so the bond does more of the work of saying what the atoms are. It draws in the chain group, so a heme wears the same `view` as the protein; it does not widen the framing radius, because a pocket is inside the protein by definition; and it clears with the ribbon on every `setData`. Returns `{group, materials}` so a lesson can fade or tint it without the box growing an opinion about timing. **What is IN the pocket is the baker's decision, never the box's** — the same refusal it makes about parsing. `proteins/myoglobin/` is the worked example; `hemoglobin-lab.html` still draws its heme by hand, and is the one place the two conventions have not yet met.

* **One decoded surface across every box**, for the same reason contexts are rationed: the LRU rations contexts, not what a page hangs off one. A box that loses its surface falls back to the ribbon it never removed.

* **`orbit:false` by default** — a drag belongs to the page, not to the molecule; a canvas that spins under the pointer leaves no way back to the framing the card was composed with.

* **It reads every library by its BARE name.** `kit/ribbon.js` publishes `const RibbonLib` at script top level, which is script scope and never a property of window, so `global.RibbonLib` is undefined — and only at the moment a card tries to draw. Load it after every library it reads.

* Look is `kit/proteinbox.css` (`.pbox-rep`, `.pbox-play`); the page decides WHEN they are reachable, because only the page knows how big its card is on screen.

**`kit/tube.js` — `TubeLib`**

Cα trace + secondary structure → a smooth tube: one continuous mesh per chain, wide through helices, thin through loops, helix collapsed onto its axis so there's no corkscrew. The multi-molecule representation — a tetramer is 4 draw calls instead of \~240. This is used as a simplified illustration style that is more abstract and less dense than the ribbon render.

* `chain(THREE, CA, ss, opts)` → parts `[{geo}]` (tube + 2 terminus caps, cap offsets baked into the geometry so the set shares one transform, which is what makes it instanceable)

* `triangles(nRes, opts)` → cost of a setting without building it

* `DEFAULTS` — the tuned constants, readable so pages don't retype them

* Real ångströms in, plain `BufferGeometry` out. No materials. THREE passed in.

**`kit/ribbon.js` — `RibbonLib`**

Cα trace + secondary structure → a cartoon: helices as flat twisted bands, strands as arrows, coil as a round tube. The dense, literal style — one geometry per chain, but far more triangles than `TubeLib`, which is the abstract counterpart to reach for when a page needs many chains at once.

* `build(THREE, points, ss, opts)` → `BufferGeometry`. Real ångströms in, no materials, THREE passed in — the page keeps materials, opacity and fading

* Secondary structure comes from the caller: `assign(n, first, ranges, code)` stamps deposited HELIX/SHEET ranges onto a per-residue array, `dssp(bb)` runs real H-bond DSSP on an N/CA/C/O backbone (`parseBackbone(pdbText)` extracts one), and `detect(points)` is a Cα-only geometric fallback. Prefer the deposited records; a helix `detect()` invents is a claim about the structure.

* `frames`, `smooth` and the tuning constants (`PROFILE`, `ARROW`, `SMOOTH_W`, `TENSION`) are exported for the test bench and for pages that need to retune rather than retype.

* The orientation frame uses the neighbour **bisector**, not a cross product — a binormal rotates the band a quarter turn and it reads as a corkscrew while every other number stays right. The file's header explains the failure at length; `folding/tools/check-folding.js` asserts it on an ideal helix.

**`kit/surface.js` — `SurfLib`**

The browser half of the SES1 format written by `bake-surface.js`.

* `decode(THREE, arrayBuffer)` → `{geo, head, res, nVert, nTri}` — de-quantises positions, keeps normals as int8 interleaved

* `chainOf` / `numberOf` — per-vertex residue lookups, which is what lets a page paint one residue onto the skin

* The format itself stays specified in `bake-surface.js`'s header, next to the writer

**`hemoglobin/foldplay.js` — `FoldPlay`**

A trajectory from `HbFold.decode`, played as a ribbon that means something. It owns one rule, and the rule is the reason it is a module: **the ribbon must not show a helix before its bonds exist.** A residue is drawn helical when a formed H-bond spans it, and only where the deposited records say a helix belongs — so the assignment can arrive early or late but can never invent a helix the structure does not have. Pass the deposited `ss` to `RibbonLib` on every frame instead and the extended chain at t=0 comes out with eight wide blue bands in it: level 2 finished before level 1 has been read.

* `covers(fold)` — per residue, the bonds whose span contains it. Once per trajectory.
* `ssFor(fold, cov, formed, out)` — the letters at this instant. `out` is reused; this runs every frame.
* `create(THREE, fold, opts)` → `{ mesh, seek(t), tick(dt), dispose() }`. `opts.rate` is REBUILDS PER SECOND (24 default), not frames: the cost of a frame is `RibbonLib.build`'s spline work, measured at 7.9ms for a 2.5k-triangle card ribbon and 2.5ms once rebuilds are on their own clock. `rate: 0` for a caller that is scrubbing rather than playing.
* `dispose()` before every rebuild is not optional — the triangle count depends on the path, so there is no fixed buffer to update, and a frame that does not release the old geometry leaks it on the GPU.

**Two consumers, which is why it exists**: `hemoglobin-lab.html` (act 2) and door-map's protein card. What stays in the lesson is its level 1 — an extended chain blended into the trajectory through rigid per-residue frames — because that is a mechanism for the story that page tells, not a property of the fold.

**`tools/bake-trace.js`** (baker, not a module)

A deposited PDB down to what a ribbon needs: `node tools/bake-trace.js <file.pdb> [chains]` writes `<file>.trace.json` beside it — per chain a Ca array, every residue NUMBER, one ss letter per residue, and the record COUNT of helices and strands. Centred on the baked Ca, `centre` recording the vector removed so anything else baked from the same PDB can be brought into the frame.

* **`view` is solved, not typed, and only when the shape earns it.** A deposited frame is a crystal or an EM box, so there is nothing in it worth preserving; `FoldLib.viewBasis` turns the structure onto its own axes, longest across the frame and shortest into the screen. It reports `worth:false` for a globular domain, whose three extents are too close to tell apart and whose basis would flip between rebakes — no `view` is written, and a human picks one. 2HHB declines; a fibril rung does not. **The handedness guard is the point of having one solver**: an eigenvector's sign is arbitrary, and a left-handed basis mirrors the protein into its enantiomer, which no internal check can see.
* **A structure with a known axis takes a convention instead**, via `FoldLib.basisFrom(up, hint)` — a fibril upright, a membrane protein on its normal. `proteins/prion/prion-test.html` measures a fibril's axis off consecutive rung centroids, which is what PCA cannot do there: the longest direction in 6LNI's box is the 75 Å between two protofibrils, a fact about the deposition rather than about the fibril.
* **`nums` is what makes a chain break drawable.** A trace carrying only `first` describes the chain as contiguous, so an unmodelled loop reads as a chain that simply skips and the ribbon splines a smooth band across coordinates nobody measured — indistinguishable from data at ribbon width. 7LNA orders 95-227 and models nothing for 194-196, which is what this exists for; the baker prints the break count.
* Secondary structure is READ from HELIX/SHEET, never detected. No records bakes as all coil and says `ssFrom:'none'`, so the card is visibly a worm rather than silently wrong.
* The helix COUNT is from the records, because adjacent helices merge into one run of `H`: 2HHB's eight per chain read as six. A caption saying "eight" has to say it from `helices`.
* 2HHB: 4 chains, 574 residues, 12 KB — against 453 KB of PDB, most of it atoms a ribbon discards.

**`tools/bake-card-surface.js`** (baker, not a module)

A card-tier SES: `node tools/bake-card-surface.js <file.pdb> [chains] [spacing]` → `<file>.card.surf.bin`. Same `encode` as `bake-surface.js`, required rather than copied, so `SurfLib` decodes both.

* 1.4 A against the lesson tier's 0.6. On 2HHB: 0.6 is 1.5 MB, 1.1 is 608 KB, 1.4 is 362 KB, 1.7 is 266 KB. 1.4 is where the shape is still the protein's and the file is small enough that a toggle answers rather than makes the reader wait.
* **The frame is READ from the trace file**, not re-derived. `2HHB.surf.bin` is in the frame `FoldLib.orient()` solved from chain B; a card's ribbon is in the crystal frame centred on its own Ca. A surface that is the right shape in the wrong orientation reads as a bug in the mesh rather than as a missing rotation.
