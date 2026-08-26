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

**`tools/bake-trace.js`** (baker, not a module)

A deposited PDB down to what a ribbon needs: `node tools/bake-trace.js <file.pdb> [chains]` writes `<file>.trace.json` beside it — per chain a Ca array, one ss letter per residue, and the record COUNT of helices and strands. Centred on the baked Ca, `centre` recording the vector removed so anything else baked from the same PDB can be brought into the frame.

* Secondary structure is READ from HELIX/SHEET, never detected. No records bakes as all coil and says `ssFrom:'none'`, so the card is visibly a worm rather than silently wrong.
* The helix COUNT is from the records, because adjacent helices merge into one run of `H`: 2HHB's eight per chain read as six. A caption saying "eight" has to say it from `helices`.
* 2HHB: 4 chains, 574 residues, 12 KB — against 453 KB of PDB, most of it atoms a ribbon discards.
