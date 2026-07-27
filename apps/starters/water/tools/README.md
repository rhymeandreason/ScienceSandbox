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
