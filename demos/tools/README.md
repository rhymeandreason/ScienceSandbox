# tools/sdf2spec.js

Converts a PubChem 3D record into a `MolLib` amino-acid spec, so the geometry in
`molecules.js` is derived rather than hand-guessed.

```bash
cd tools
curl -o glycine.sdf "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/glycine/SDF?record_type=3d"
node sdf2spec.js glycine alanine serine cysteine   # -> generated-specs.json
```

What it does, and why each step exists:

- **parse** — atoms, bonds, and BOND ORDERS from the SDF. The order column is
  what tags the carboxyl `C=O` as `[i,j,2]`; nobody has to spot it by hand.
- **reindex** — forces the library's fixed backbone order
  (`0 N · 1 H · 2 H · 3 Ca · 4 H · 5 C · 6 O(=O) · 7 O(–OH) · 8 H · 9.. R`),
  because `pep:{cC,oOH,hOH,nN,hN}` and `aminoacid-lab.html` index into it.
  A converter that reshuffled indices would silently break the peptide reaction.
- **reframe** — recentre on Ca, backbone N→C to +X, side chain to −Y, then apply
  ONE global `SCALE` (1.9). Display radii in this project are enlarged for
  legibility, so true Ångström coordinates bury every stick inside its spheres —
  a uniform scale clears them while keeping relative bond lengths truthful.
- **optH** — flags nonpolar C–H for the lab's "show C–H hydrogens" toggle.
  H on N/O/S is never flagged: those are the H-bond donors.

`check-molecules.js` (one directory up) validates the result — it reports every
bond whose spheres merge, plus all bond angles.

Caveats: `record_type=3d` often has no conformer for charged species
(bicarbonate, pyruvate, HPO₄²⁻), so those stay hand-written. Output is genuinely
non-planar, unlike the flat z=0 layouts elsewhere in `molecules.js`.

---

# tools/sdf2spec-generic.js

The same converter for molecules that are **not** amino acids. `sdf2spec.js`
exists mostly to force the library's fixed backbone order, because
`pep:{cC,oOH,hOH,nN,hN}` and `aminoacid-lab.html` index into it; a sugar or a
nucleotide has no such contract, so this one keeps the SDF's own atom order.

```bash
cd tools
curl -o beta-D-glucopyranose.sdf "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/beta-D-glucopyranose/SDF?record_type=3d"
node sdf2spec-generic.js beta-D-glucopyranose   # -> generated-specs-generic.json
```

Differences from `sdf2spec.js`:

- **no reindex** — atom order is the record's. Anything a page addresses by
  index (a `groups` map, a reaction site) must be read off the OUTPUT.
- **orientation** — if there is a 5-/6-ring, its mean plane becomes XY, so a
  pyranose lands face-on and the axial/equatorial pattern `check-molecules.js`
  audits is the thing you actually see. Otherwise the longest heavy-atom axis
  becomes +X.
- same global `SCALE` (1.9), same `optH` policy, same right-handed basis rule —
  negating one output component is a reflection and silently mirrors the
  molecule (see the comment in `sdf2spec.js`).

Used for `amp` in `molecules.js`.

## `dev-server.js` — local development only

```bash
node tools/dev-server.js             # default 8817; if busy, walks up to a free port
node tools/dev-server.js 9000        # explicit port; if busy, says what holds it and stops
```

Static file server with live reload. A CSS-only change swaps the stylesheet in
place (the page keeps its state); anything else reloads. Everything is served
`no-store`, which matters more than it sounds — python's `http.server` sends no
cache headers, so a browser will reuse a stale `scene.js` for a whole session and
a correct fix looks broken.

It injects its reload client into HTML **responses**, never into the files. The
repo deploys to GitHub Pages from the working tree, so the published pages must
stay exactly what is committed. `python3 -m http.server` to see what ships.
