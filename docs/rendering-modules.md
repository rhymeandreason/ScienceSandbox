**`hemoglobin/tube.js` — `TubeLib`** 

Cα trace + secondary structure → a smooth tube: one continuous mesh per chain, wide through helices, thin through loops, helix collapsed onto its axis so there's no corkscrew. The multi-molecule representation — a tetramer is 4 draw calls instead of \~240. This is used as a simplified illustration style that is more abstract and less dense than the ribbon render.

* `chain(THREE, CA, ss, opts)` → parts `[{geo}]` (tube + 2 terminus caps, cap offsets baked into the geometry so the set shares one transform, which is what makes it instanceable)

* `triangles(nRes, opts)` → cost of a setting without building it

* `DEFAULTS` — the tuned constants, readable so pages don't retype them

* Real ångströms in, plain `BufferGeometry` out. No materials. THREE passed in.

**`hemoglobin/surface.js` — `SurfLib`** 

The browser half of the SES1 format written by `bake-surface.js`.

* `decode(THREE, arrayBuffer)` → `{geo, head, res, nVert, nTri}` — de-quantises positions, keeps normals as int8 interleaved

* `chainOf` / `numberOf` — per-vertex residue lookups, which is what lets a page paint one residue onto the skin

* The format itself stays specified in `bake-surface.js`'s header, next to the writer
