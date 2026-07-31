## 1. Molecular geometry

### 1.1 Angles and shape

- **Bond angle is 104.5°**, not 90° or 120°. The H–O–H angle is used verbatim in
  the 3D molecule builder and the 2D diagrams.
- Water is **bent / V-shaped** — never draw it linear.
- **Relative atom sizes:** O is drawn larger than H (O has more electrons / larger
  van der Waals radius). Keep O clearly bigger than H.
- O–H bond lengths in the model are stylized (enlarged for legibility), but the
  *angle* and *bent shape* must stay correct. If a length is exaggerated, say so
  in a comment rather than implying it's to scale.

### 1.2 Where geometry comes from

**Five sources, and every spec names its own in `src:{path:…}`** —
`check-molecules.js` fails a spec that does not. The provenance note at the top
of `molecules.js` defines the field and its three-value rule (present / null /
absent); this section is about which source to *choose*. That choice is not
about how "complex" a molecule looks: the question is whether its shape follows
from **one or two known constants** or **emerges from many coupled
constraints**.

This list said "three sources" for a long time while five existed, and the gap
had a cost. `palmitate` and `palmitoleate` are constructed, but with no listed
category to be constructed *into*, they were filed as PubChem conversions —
and docs/molecule-pipeline.md item 0 then read their united-atom hydrogen count
(32 in the record, 1 committed) as evidence of a stripping step that never
happened. An enumeration that quietly excludes a real member does not stay
harmless.

1. **Hand-written** (`src.path:'hand'`) — small molecules defined by a known angle, where the spec
   doubles as teaching material in its comments. Water (104.5°), methane (109.5°),
   ammonia (~107°), CO₂ (linear), the small ions. These are verifiably right today;
   don't churn them, and don't trade their readable annotated layout for an opaque
   coordinate block.
2. **Generated from a real record** (`src.path:'pubchem'`; `tools/sdf2spec.js`,
   PubChem 3D) — branching
   skeletons, conformational freedom, or more than a handful of coordinates to
   type. The amino acids. The cost is real: generated specs are unreadable numbers
   carrying a "regenerate, don't hand-edit" warning, so only pay it when hand
   placement would actually drift. Its inputs are committed in `tools/sdf/`, so
   it can be re-run offline — but re-running is not the same as reproducing:
   `proline` needs a hand reindex and two specs no longer have a published
   source at all. `src.regen` records which. Ask for a record by **CID**, never
   by name: a name pins neither a stereocentre nor a charge state.
3. **Generated from VSEPR** (`src.path:'skel'`; `Skel` in `skel.js`) — the glycolysis
   intermediates. First-principles derivation rather than a database, so it also
   covers the charged species PubChem has no 3D conformer for (bicarbonate,
   pyruvate, HPO₄²⁻), and it produces the deliberate flat Fischer-projection
   layout the lesson wants. Don't "upgrade" these to PubChem — it's a downgrade.
   `Skel.prototype.spec` stamps `src` itself, so this path stays labelled
   without anyone remembering to.
4. **Constructed by hand from literals** (`src.path:'built'`) — the fatty acids.
   Neither typed per-bond like (1) nor derived by a builder like (3): a geometry
   worked out once against real angles, verified, then written in as numbers.
   Reach for this when the lesson is a *topology* a real conformer would obscure
   — a floppy palmitate renders as spaghetti, and "long nonpolar tail, one small
   polar head" reads far better as an idealised zigzag (§1.6). Requires a
   `method:` in `src`, because that string is the only record of how the numbers
   were arrived at.
5. **Mirrored from another spec** (`src.path:'mirror'`) — `dAlanine` only.
   Computed at load, so it inherits its partner's provenance and cannot drift
   from it. Note a reflection is a determinant −1 transform; negating one
   component is the intended operation here and a *bug* anywhere else (§1.3).

Whatever the source, run `check-molecules.js`.

### 1.3 Stereochemistry is the error nothing else catches

**Bond lengths, bond angles and the render can all be perfect while the molecule
is a different substance.** Nothing but an explicit stereo audit sees it, so a
spec **declares** what it expects and `check-molecules.js` fails if the geometry
disagrees:

```js
stereo:'all-equatorial',   // β-D-glucopyranose — asserted, not assumed
```

Glucose shipped wrong this way — substituents alternating axial/equatorial, not
glucose, and at C5 not even D-. All-equatorial is what makes glucose the most
stable of the 16 aldohexoses and much of why the pathway is built around it, so
it is a chemical claim and gets asserted like one.

**A real record is not a guarantee — your transform can destroy what you fetched
it for.** PubChem supplied L-amino acids; the converter shipped D, because its
reframe negated one output component of an orthonormal basis, which is a
**reflection**, not a rotation. A mirror preserves every bond length, every
angle and the render, so the specs were committed, reviewed and rendered before
a signed-volume check found it. Keep the basis right-handed (`e3 = e1 × e2`),
flip the *axis* rather than the output, and let `chirality:'L'` assert it.

**`Skel` has no general chirality model.** All-equatorial works only because it
is expressible as a geometric rule ("pick the slot most perpendicular to the
ring axis"). A sugar needing a *specific* mixed pattern — galactose differs from
glucose at one carbon — must come from a real record, not from a face-naming
convention invented on the spot.

**A RELATIVE assertion cannot catch a GLOBAL MIRROR, and every sugar here was
one.** This is the third incident of this shape and by far the longest-lived:
`ringPyranose` laid its chair pucker down in the wrong phase relative to the
ring traversal, so **every Skel-built sugar in this library was the
L-enantiomer** — L-glucose, L-galactose, L-ribose, L-deoxyribose and both
disaccharides. They shipped, rendered, and taught.

Four checks were satisfied the whole time, and none of them *could* have failed:

- `stereo:'all-equatorial'`, `{axial}` and `{faces}` assert **relative**
  patterns. The ring normal's sign falls out of traversal order, so flipping
  every substituent at once leaves the declared pattern intact.
- `cod-check.js` compares ring-plane tilt and torsions — also relative. It
  "validated" glucose against a crystal structure and could not have seen this.
- `haworth.js` **anchors** the normal to the D convention rather than reading
  it, so the 2D diagrams drew correct D-sugars from mirrored coordinates. Their
  output is byte-identical before and after the fix.
- Bond lengths, bond angles and the render are identical between enantiomers by
  definition.

> **A mirror is invisible from the inside.** Internal consistency is precisely
> what it preserves. Catching one needs an ABSOLUTE external reference, which is
> what `tools/check-handedness.js` is for: it compares each spec's generated
> `smiles` against a stereo-specific PubChem record, and carries a control group
> of specs that came *from* PubChem so a failure indicts the geometry rather
> than the exporter.

The two sugar families needed **different fixes**, for a reason worth keeping:
`equatorial()` is normal-sign-independent, so flipping the pyranose ring frame
genuinely mirrors the molecule; `face()` is sign-dependent, so flipping the
furanose frame does nothing at all and the UP/DOWN tags had to be swapped
instead. If you mirror a ring builder, verify the result rather than assuming
the two behave alike.

### 1.4 Adding a molecule: how much fidelity does it owe?

Fidelity is not a global dial. Every geometry bug this project has shipped had
the same shape — the spec was right about everything **except the one feature the
lesson depended on**. The carboxyl C=O was buried inside its spheres; the
α-carbon was drawn linear; the glucose ring was a different sugar. So before
adding a molecule, ask what claim it is making, and classify it:

**Tier 1 — Prop.** Appears in a scene, never compared against a sibling. Water in
a membrane diagram, methane as "the nonpolar one". Hand-write it; correct shape
and polarity is enough.

**Tier 2 — Contrast.** Shown *against* a near-identical molecule where one
feature is the entire point. That feature must be exactly right **and asserted by
`check-molecules.js`**. Most of the AP Bio curriculum lives here:

<!-- ENUM: flip the Built column when a pair ships; add a row for a new contrast. -->
| Contrast | Differs by | The lesson | Built |
|---|---|---|---|
| starch vs cellulose | α- vs β-1,4 linkage | why we can't digest wood | ✓ `glycosidic` |
| saturated vs unsaturated fat | one C=C, *cis* | why butter is solid and oil is not | ✓ `cis` |
| ribose vs deoxyribose | one –OH at 2′ | why DNA is the stable archive | ✓ `stereo:{faces}` |
| glucose vs galactose | one –OH orientation | why galactosemia is a disease | ✓ `stereo:{axial}` |
| L- vs D-amino acids | handedness | why life is homochiral | ✓ `chirality` |
| purine vs pyrimidine | two rings vs one | why A–T and G–C are equal width | ✓ `topology` |

All six pairs are `contrast-lab.html`. L-/D-alanine needed no new
assertion type to join them — `chirality` was already generic over both hands
(`actual = vol>0?'L':'D'`), since it exists to catch a reflection slipping into
an L-only build, not to assume the answer is always L. D-alanine is that spec's
coordinates mirrored (one component negated), same trick a bad SDF converter
would produce by accident.

Saturated/unsaturated fat needed a genuinely new declaration — `cis:{atoms:
[i,j,k,l], value}` — because a cis and a trans double bond share the same C=C
length and the same ~120° flanking angles; only the torsion about the C=C
differs, and nothing above that check could see it. `palmitoleate`'s bend was
worked out by hand (a same-side vs. alternating turn at the two sp2 vertices)
and verified against the dihedral formula before being baked in as literals —
the same process as a `VIEW` tuning pass, just for a whole spec instead of an
orientation.

Starch vs cellulose was the last row, and it shipped the way rule 2 below says
it had to: with a **new assertion type**, `glycosidic:`, added in the same commit
as the molecules. It was never blocked on geometry — it was blocked on being
checkable.

Two things about how it shipped are worth keeping:

**It is rendered as `maltose` and `cellobiose`, not as starch and cellulose** —
rule 1. Coil-versus-ribbon is an *emergent* property of hundreds of repeats
(WaterSim.md §3's discipline applied to a polymer), and two rings do not earn the polymer's
name. What the pair does render exactly is the linkage, which is the entire
lesson: maltose is starch's repeat, cellobiose is cellulose's.

**Both share one linkage conformation, deliberately.** A disaccharide's φ/ψ are
floppy, so per §1.6 the pose is a schematic and is *not* asserted — which makes
it a knob, and a knob tuned per-molecule would put part of the visible difference
outside the chemistry. So one slot-and-spin pair is used for both. Each alone
would sit roomier; sharing means every difference on screen traces back to the
one axial/equatorial choice at C1.

**A pose can satisfy every check and still be unpresentable, and that is a
geometry bug, not a camera one.** The shared pose was first chosen for maximum
clearance, which left the two ring planes near *perpendicular*. Every check
passed — no overlaps, correct configuration — and no viewing angle exists that
shows both rings as chairs from one camera, so the second residue rendered as a
blob and several rounds of tuning `VIEW.disaccharide` could not fix it. It is
now swept for **near-coplanar ring planes** (0.87 of parallel), which is also the
extended shape the real disaccharides take; clearance drops to 0.64, still far
above the checker's floor of 0. The general rule: for a multi-ring spec,
*presentability is a property of the conformation*, and the checker cannot see
it — §1.5's "no page may mix families" has the same shape. Reach for the view
table only once the geometry admits a good view.

**How a distinguishing feature gets declared.** One of these goes on the spec,
and `check-molecules.js` fails if the geometry disagrees:

<!-- ENUM: a new claim type goes here AND in check-molecules.js's header, same commit. -->
| Declaration | Means | Used by |
|---|---|---|
| `stereo:'all-equatorial'` | every ring substituent equatorial | glucose |
| `stereo:{axial:[i,…]}` | exactly these ring atoms are axial, all others equatorial | galactose (C4) |
| `stereo:{faces:{i:'a',…}}` | which ring atoms' substituents share a face — checked as a *relative* pattern, since the ring normal's sign is arbitrary | ribose, deoxyribose |
| `topology:{rings:[…],fused:true}` | ring count, ring sizes, and that a bicycle shares an edge | purine, pyrimidine |
| `chirality:'L'` | signed volume over CIP priorities | the amino acids |
| `cis:{atoms:[i,j,k,l],value}` | i-j-k-l dihedral about the j-k (C=C) bond is ~0° if `value` is true, ~180° if false | palmitoleate |
| `glycosidic:{anomeric,bridge,partner,config,link}` | the bridging O joins the anomeric carbon of one ring to carbon 4 of *another* ring, and the bond leaving the anomeric carbon is axial (`'alpha'`) or equatorial (`'beta'`) | maltose, cellobiose |

`{faces}` deliberately cannot catch a *global* mirror (flip every substituent and
the relative pattern is unchanged, so L-ribose would pass as D-). No page makes a
D/L claim about a sugar yet; the moment one does, that claim needs its own
assertion rather than leaning on this one.

Every one of those is a stereochemistry or bond-order claim — the class that
renders beautifully while being wrong.

**Tier 3 — Subject.** The structure *is* the lesson (DNA's helix, an enzyme's
active site). Derive it from a real record.

Rules that follow:

1. **Name honesty.** If the distinguishing feature is not rendered correctly,
   do not use the name that implies it. Call it "a sugar", not "glucose".
2. **A claim ships with its assertion, in the same commit.** `stereo:` exists so
   a chemical claim fails a check rather than relying on someone noticing. A new
   claim type means extending `check-molecules.js` as part of adding the
   molecule — never as a follow-up.
3. **Source it by the three-way rule above** (hand-write / PubChem / `Skel`).
4. **Anything a lab manipulates needs an index map** (`pep`, `gly`), because
   reactions address atoms by position and a reindex silently breaks them.

### 1.5 Bond-length scale families — a page may only show one

Display radii in `PALETTE` are stylised and **large**, so no spec can use true
ångströms: a bond must exceed the sum of its two atoms' radii or the spheres
swallow the stick. `check-molecules.js` enforces exactly that, and nothing more.

*How* a spec satisfies it is not uniform across this project, and that is the
trap. There are two families:

<!-- ENUM: update when a spec is added, or SCALE / the GL constants change. -->
| Family | Specs | Rule | Implied scale |
|---|---|---|---|
| **A. hand-written** | everything in `mol-solvation.js` — water, ethanol, ammonia, methane, CO₂, carbonic, bicarbonate, hydronium, and the two salts | each length picked to clear its own radii | ~1.2–1.6×, **varies within a molecule** |
| **B. derived** | everything in `mol-monomers.js`, `mol-glycolysis.js` and `mol-contrast.js` — amino acids, palmitate, AMP, glucose + all glycolysis intermediates, every contrast-pair spec (incl. the two disaccharides) | **stored in real Å** (`units:'angstrom'`); `register()` applies the display scale once | **1.9×**, relative lengths truthful |

Since item 3 the families line up with the domain files, so **a page's script
tags now show which families it is mixing**. That is the only mechanical signal
there is — nothing fails a build.

**Since item 7, family B stores real ångströms.** A spec declares
`units:'angstrom'` and `MolLib.register()` multiplies by `SCALE` once as it is
registered; `units:'scene'` means the numbers are already display units and are
left alone. `check-molecules.js` requires the field, because getting it wrong is
a silent 1.9× — big enough to see, small enough to look like a styling choice.

Two consequences worth knowing:

- **The display scale is now one number in one place.** Changing `SCALE` moves
  all 26 family-B specs together, including the eleven that used to have it
  multiplied into their literals. `skel.js` no longer knows `SCALE` exists.
- **The scale is applied at registration, not at render.** `Stage.buildMolecule`
  is not the only reader — `glycolysis-lab`, `contrast-lab`, `_compare` and
  `haworth.js` all index `spec.atoms[i].pos` directly and compare it against
  `PALETTE.radii`, which are scene units. Scaling at render would leave every
  one of those comparing ångströms against scene units.

Family A is **not** "ångströms not yet converted". It is not expressible as any
molecule times any single factor — that is what makes it family A — so
un-baking it is not a units change but a geometry change, and it still means
re-tuning the solvation engine.

**Which is why the small molecules exist twice.** `mol-small.js` carries water,
ammonia, methane, CO₂ and ethanol built from measured lengths, in real
ångströms, as family B. `mol-solvation.js` keeps the family-A versions. A page
loads one or the other:

| page needs | load |
|---|---|
| solvation physics (H-bonds, ice, dissolving) | `mol-solvation.js` |
| a small molecule **beside** an amino acid, sugar or lipid | `mol-small.js` |

They define the same keys deliberately, and `register()` throws if both load, so
choosing wrong is a loud failure rather than a molecule that is quietly 15% off.

This is the one place the project's "one molecule, not two" rule is broken on
purpose, so the reason is worth stating: **a family-A water is a tuned parameter
of a physics engine and a family-B water is a picture of a water molecule.**
Changing the first re-tunes `EQ`, `MIN`, `hbThreshold` and the ice lattice;
changing the second changes a picture. They are different objects that happen to
share a name. What is *not* duplicated is anything scale-free — `nacl` and
`kcl` carry no coordinates at all, only dissociation records, so they belong to
no family and are reusable as they are.

Family A cannot be normalised, and should not be. `water-lab.html` and
`molecule-lab.html` hard-code `HL=1.55` and tune the whole solvation engine
around that scale — `EQ`, `MIN`, `hbThreshold`, the ice lattice `iceBond`.
Rescaling water means re-tuning that physics (item 7 in
docs/molecule-pipeline.md, the one item that can break something working).

**The rule: one page, one family.** Only family B is comparable
molecule-to-molecule, so only family B may make a size claim.

**Known residual, measured:** `ringPyranose()` builds a *regular* hexagon, so a
pyranose's ring C–O comes out as long as its ring C–C. Against the real PubChem
β-D-glucopyranose record that leaves the ring 3.13 Å wide vs 2.90, and the
heavy-atom span 6.78 Å vs 6.26 — **+8%**, inherited from the ring and consistent
throughout. Left alone deliberately; closing it means a ring builder with
alternating bond lengths, which is a rewrite, not a constant.

**Do not measure size across hydrogens — heavy atoms only.** An –OH rotamer is
arbitrary in any static model, so a size figure that depends on one measures the
builder, not the molecule. Macromolecule-lab's first "Å across" readout took the
widest pair over *all* atoms and put glucose at 8.3 Å against a real 6.45: the
widest pair was two hydroxyl *hydrogens*, because `Skel.outwardAt` splays every
free substituent away from the centroid at once and a real molecule's hydroxyls
never all point outward together.

If you add a page that must show a solvation molecule next to a derived one,
that is a new problem — solve it in `molecules.js`, not on the page.

### 1.6 Derive when shape carries the lesson; schematize when topology does

Both are legitimate, and the failure is doing one while claiming the other.

Real coordinates are right when the *shape* is the point — a chair ring, a
tetrahedral centre, a helix. They are **wrong** when the lesson is topology.
A phospholipid's real conformer is floppy and renders as spaghetti; the lesson is
"polar head, nonpolar tails", so build it schematically **on purpose** and say so
in the comment, exactly as the open-chain Fischer-projection intermediates in §1.2
(source 3, `Skel`) are deliberate. Bilayers and polymers additionally need
instancing rather than N built groups, and should be validated at the monomer,
not the assembly.

The declaration vocabulary is in §1.4, and its contrast table now has no unbuilt
rows. The two most recent additions were both cases where the render could not
settle the question: `cis:{atoms,value}` (palmitoleate) and
`glycosidic:{…,config}` (maltose/cellobiose).
