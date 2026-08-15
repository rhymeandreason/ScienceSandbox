# tools/catalog/ — the molecule catalog, resolved

`molecule-catalog.csv` is the survey of every molecule the lessons may need:
265 rows across the eight AP Bio units, each with its unit, topic, category,
render tier, priority and a teaching note. Exported from the working
spreadsheet (`AP_Bio_3D_Molecule_Catalog - Molecules`), then resolved here.

**Committed for `tools/sdf/`'s reason.** It is a build-time input, never a page
dependency — no HTML loads it and nothing fetches at runtime — and it cannot be
cheaply re-derived: the three columns this repo added cost ~400 PubChem requests
and a human ruling on 21 rows. It spent its first day in the repo's
`resources/`, which is `.gitignore`d, so those answers existed in one working
tree and nowhere else.

`resources/` stays the drop zone for a fresh spreadsheet export. Copy one in
over this file, re-run the resolver, then `--verify`.

## The three resolved columns

Written by `tools/resolve-catalog.js`; see its header for the reasoning.

| column | means |
| --- | --- |
| `CID` | the PubChem compound this row means. **Fetch by this, never by name** — `tools/sdf/README.md` carries the case where a name lookup went wrong |
| `Has 3D` | whether `record_type=3d` has a conformer. `no` means hand-write or Skel-build it; PubChem has nothing to give |
| `Stereo` | `pinned (n)` if PubChem reports no undefined stereocentres, else `n UNDEFINED` |

Blank `CID` means the row needs a human — see `resolution-report.txt`, which
lists every candidate for an ambiguous name.

## Where the rows stand

<!-- ENUM: re-run tools/resolve-catalog.js and update these five numbers. -->

| | rows |
| --- | --- |
| ready to build — CID, a 3D conformer, every stereocentre pinned | 115 |
| no 3D conformer — hand-write or Skel-build | 19 |
| an undefined stereocentre — name the isomer you mean | 14 |
| ambiguous — several CIDs, needs a chemistry call | 5 |
| unresolvable by name | 2 |

The remaining 99 rows of the 265 are `Source: PDB` and take the `folding/` path,
not the MolLib one — no `mol-*.js`, no `flat2d`, no `smiles`.

## Two things the resolution found

Both are the trap `tools/sdf/README.md` states in one line — *a bare name pins
neither a stereocentre nor a charge state* — and both would have rendered
perfectly while being the wrong molecule.

**An unambiguous CID can still be an unpinned stereoisomer.** `glucose` resolves
to exactly one CID, 5793, and that record leaves the anomeric centre undefined.
It is the CID `tools/check-handedness.js` names as proving nothing. Thirteen
other rows are the same shape.

**And to the wrong charge state.** `--verify` compares the catalog against the
`src.cid` values already committed in `mol-*.js` and disagreed on two: this
catalog's ATP and AMP are the neutral free acids (5957, 6083), while the specs
here ship the physiological anions (5461108, charge −4; 15938965, charge −2).
`mol-glycolysis.js` says ATP's charge *is* the lesson, so that difference is not
cosmetic. **Unresolved** — someone has to decide which the lessons want.
