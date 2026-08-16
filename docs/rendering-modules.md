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
