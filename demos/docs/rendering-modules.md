<!-- KIND: recipe + reference — load when drawing a PROTEIN from deposited coordinates: which of tube / ribbon / surface a page wants, what each one costs, and the settled verdict on outside viewers. Not needed for a lesson that only draws molecules from specs. -->

# Rendering modules

**`hemoglobin/tube.js` — `TubeLib`**

Cα trace + secondary structure → a smooth tube: one continuous mesh per chain, wide through helices, thin through loops, helix collapsed onto its axis so there's no corkscrew. The multi-molecule representation — a tetramer is 4 draw calls instead of \~240. This is used as a simplified illustration style that is more abstract and less dense than the ribbon render.

* `chain(THREE, CA, ss, opts)` → parts `[{geo}]` (tube + 2 terminus caps, cap offsets baked into the geometry so the set shares one transform, which is what makes it instanceable)

* `triangles(nRes, opts)` → cost of a setting without building it

* `DEFAULTS` — the tuned constants, readable so pages don't retype them

* Real ångströms in, plain `BufferGeometry` out. No materials. THREE passed in.

**`folding/ribbon.js` — `RibbonLib`**

Cα trace + secondary structure → a cartoon: helices as flat twisted bands, strands as arrows, coil as a round tube. The dense, literal style — one geometry per chain, but far more triangles than `TubeLib`, which is the abstract counterpart to reach for when a page needs many chains at once.

* `build(THREE, points, ss, opts)` → `BufferGeometry`. Real ångströms in, no materials, THREE passed in — the page keeps materials, opacity and fading

* Secondary structure comes from the caller: `assign(n, first, ranges, code)` stamps deposited HELIX/SHEET ranges onto a per-residue array, `dssp(bb)` runs real H-bond DSSP on an N/CA/C/O backbone (`parseBackbone(pdbText)` extracts one), and `detect(points)` is a Cα-only geometric fallback. Prefer the deposited records; a helix `detect()` invents is a claim about the structure.

* `frames`, `smooth` and the tuning constants (`PROFILE`, `ARROW`, `SMOOTH_W`, `TENSION`) are exported for the test bench and for pages that need to retune rather than retype.

* The orientation frame uses the neighbour **bisector**, not a cross product — a binormal rotates the band a quarter turn and it reads as a corkscrew while every other number stays right. The file's header explains the failure at length; `folding/tools/check-folding.js` asserts it on an ideal helix.

**`hemoglobin/surface.js` — `SurfLib`**

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

A deposited PDB down to what a ribbon needs: `node tools/bake-trace.js <file.pdb> [chains]` writes `<file>.trace.json` beside it — per chain a Ca array, one ss letter per residue, and the record COUNT of helices and strands. Centred on the baked Ca, `centre` recording the vector removed so anything else baked from the same PDB can be brought into the frame.

* Secondary structure is READ from HELIX/SHEET, never detected. No records bakes as all coil and says `ssFrom:'none'`, so the card is visibly a worm rather than silently wrong.
* The helix COUNT is from the records, because adjacent helices merge into one run of `H`: 2HHB's eight per chain read as six. A caption saying "eight" has to say it from `helices`.
* 2HHB: 4 chains, 574 residues, 12 KB — against 453 KB of PDB, most of it atoms a ribbon discards.

**`tools/bake-card-surface.js`** (baker, not a module)

A card-tier SES: `node tools/bake-card-surface.js <file.pdb> [chains] [spacing]` → `<file>.card.surf.bin`. Same `encode` as `bake-surface.js`, required rather than copied, so `SurfLib` decodes both.

* 1.4 A against the lesson tier's 0.6. On 2HHB: 0.6 is 1.5 MB, 1.1 is 608 KB, 1.4 is 362 KB, 1.7 is 266 KB. 1.4 is where the shape is still the protein's and the file is small enough that a toggle answers rather than makes the reader wait.
* **The frame is READ from the trace file**, not re-derived. `2HHB.surf.bin` is in the frame `FoldLib.orient()` solved from chain B; a card's ribbon is in the crystal frame centred on its own Ca. A surface that is the right shape in the wrong orientation reads as a bug in the mesh rather than as a missing rotation.
