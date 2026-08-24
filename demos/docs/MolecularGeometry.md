<!-- KIND: rulebook — load §1 before adding or converting a molecule spec. §1.4 sets the fidelity tier a molecule owes, and requires an assertion in the same commit. -->

## 1. Molecular geometry

### 1.1 Angles and shape

- **Bond angle is 104.5°**, not 90° or 120° — used verbatim in the 3D builder and
  the 2D diagrams.
- Water is **bent / V-shaped**, never linear.
- O is drawn **clearly larger than H** (more electrons, larger vdW radius).
- O–H lengths are stylized (enlarged for legibility), but the *angle* and *bent
  shape* stay correct. Say so in a comment rather than implying to-scale.

### 1.2 Where geometry comes from

**Five sources, and every spec names its own in `src:{path:…}`** —
`check-molecules.js` fails a spec that doesn't. `molecules.js`'s provenance note
defines the field and its present/null/absent rule; this section is about which
source to *choose*. The question isn't how "complex" a molecule looks, but
whether its shape follows from **one or two known constants** or **emerges from
many coupled constraints**.

1. **Hand-written** (`'hand'`) — small molecules defined by a known angle, whose
   comments double as teaching material: water (104.5°), methane (109.5°),
   ammonia (~107°), CO₂ (linear), the small ions. Verifiably right today — don't
   churn them, and don't trade their annotated layout for a coordinate block.
2. **Generated from a real record** (`'pubchem'`; `tools/sdf2spec.js`) —
   branching skeletons, conformational freedom, or more coordinates than you'd
   type. The amino acids. The cost is real: unreadable numbers carrying a
   "regenerate, don't hand-edit" warning, so pay it only where hand placement
   would drift. Inputs are committed in `tools/sdf/`, so it re-runs offline — but
   re-running isn't reproducing: `proline` needs a hand reindex and two specs
   have no published source any more (`src.regen` records which). Ask for a
   record by **CID**, never by name — a name pins neither stereocentre nor charge
   state.
3. **Generated from VSEPR** (`'skel'`; `Skel` in `skel.js`) — the glycolysis
   intermediates. First-principles, so it also covers charged species PubChem has
   no 3D conformer for (bicarbonate, pyruvate, HPO₄²⁻), and it produces the flat
   Fischer-projection layout the lesson wants. Don't "upgrade" these to PubChem —
   it's a downgrade. `Skel.prototype.spec` stamps `src` itself.
4. **Constructed by hand from literals** (`'built'`) — the fatty acids. Neither
   typed per-bond like (1) nor derived by a builder like (3): a geometry worked
   out once against real angles, verified, then written in as numbers. Use it when
   the lesson is a *topology* a real conformer would obscure — floppy palmitate
   renders as spaghetti, while "long nonpolar tail, one small polar head" reads
   as an idealised zigzag (§1.6). Requires a `method:` in `src`, the only record
   of how the numbers were reached.
5. **Mirrored from another spec** (`'mirror'`) — `dAlanine` only. Computed at
   load, so it inherits its partner's provenance. A reflection is a determinant
   −1 transform: negating one component is intended here and a *bug* anywhere
   else (§1.3).

This list said "three sources" long after five existed, and the gap cost
something: `palmitate` and `palmitoleate` had no category to be constructed
*into*, so they were filed as PubChem conversions, and docs/molecule-pipeline.md
item 0 then read their hydrogen count as evidence of a stripping step that never
happened. An enumeration that quietly excludes a real member doesn't stay
harmless.

Whatever the source, run `check-molecules.js`.

### 1.3 Stereochemistry is the error nothing else catches

**Bond lengths, angles and the render can all be perfect while the molecule is a
different substance.** Only an explicit stereo audit sees it, so a spec
**declares** what it expects and `check-molecules.js` fails on disagreement:

```js
stereo:'all-equatorial',   // β-D-glucopyranose — asserted, not assumed
```

Glucose shipped wrong this way — substituents alternating axial/equatorial, and
at C5 not even D-. All-equatorial is what makes glucose the most stable of the 16
aldohexoses and much of why the pathway is built around it, so it's a chemical
claim and gets asserted like one.

**A real record is no guarantee — your transform can destroy what you fetched it
for.** PubChem supplied L-amino acids; the converter shipped D, because its
reframe negated one output component of an orthonormal basis — a **reflection**,
not a rotation. A mirror preserves every length, angle and pixel, so the specs
were committed, reviewed and rendered before a signed-volume check caught it.
Keep the basis right-handed (`e3 = e1 × e2`), flip the *axis* rather than the
output, and let `chirality:'L'` assert it.

**`Skel` has no general chirality model.** All-equatorial works only because it's
expressible as a geometric rule ("pick the slot most perpendicular to the ring
axis"). A sugar needing a *specific* mixed pattern — galactose differs from
glucose at one carbon — must come from a real record, not a face-naming
convention invented on the spot.

**A RELATIVE assertion cannot catch a GLOBAL MIRROR, and every sugar here was
one.** `ringPyranose` laid its chair pucker down in the wrong phase relative to
the ring traversal, so **every Skel-built sugar was the L-enantiomer** —
glucose, galactose, ribose, deoxyribose and both disaccharides. They shipped,
rendered and taught. Four checks were satisfied the whole time and none of them
*could* have failed:

- `stereo:'all-equatorial'`, `{axial}` and `{faces}` assert **relative** patterns.
  The ring normal's sign falls out of traversal order, so flipping every
  substituent at once leaves the pattern intact.
- `cod-check.js` compares ring-plane tilt and torsions — also relative.
- `haworth.js` **anchors** the normal to the D convention rather than reading it,
  so the 2D diagrams drew correct D-sugars from mirrored coordinates; its output
  is byte-identical before and after the fix.
- Lengths, angles and the render are identical between enantiomers by definition.

> **A mirror is invisible from the inside** — internal consistency is exactly
> what it preserves. Catching one needs an ABSOLUTE external reference, which is
> `tools/check-handedness.js`: it compares each spec's generated `smiles` against
> a stereo-specific PubChem record, with a control group of specs that came
> *from* PubChem so a failure indicts the geometry, not the exporter.

The two sugar families needed **different fixes**: `equatorial()` is
normal-sign-independent, so flipping the pyranose frame genuinely mirrors the
molecule; `face()` is sign-dependent, so flipping the furanose frame does nothing
and the UP/DOWN tags had to be swapped instead. Mirroring a ring builder: verify,
don't assume the two behave alike.

### 1.3b `formula` and `charge`

`formula` is the string under the molecule's name on screen, so it is read as a
fact rather than as a picture. Give it alongside **`charge:`** (an integer; `0`
counts and must be written) whenever the spec has one, and keep the two saying
the same thing — `check-molecules.js` FAILs a formula whose trailing charge
disagrees with `charge:`, and a formula that states a charge on a spec that
declares none.

`charge` is what any on-screen ± badge reads, so the field is the single source
of truth and the formula is checked against it, not the other way round.

**Hydrogen is not checked and cannot be.** These pages draw no C–H, so a spec's
H count is a drawing decision while the formula's is a chemical one. The heavy
elements *are* checked against the spec's atoms. This is the gap that let every
phosphorylated glycolysis intermediate ship carrying the **neutral acid's**
hydrogen count with an anionic charge attached — `C₆H₁₃O₉P²⁻` for a 2− anion
that is `C₆H₁₁O₉P²⁻`. Write the anion you are drawing, not the acid.

### 1.4 Adding a molecule: how much fidelity does it owe?

Fidelity is not a global dial. Every geometry bug shipped here had one shape —
the spec was right about everything **except the feature the lesson depended
on**. The carboxyl C=O buried inside its spheres; the α-carbon drawn linear; the
glucose ring a different sugar. So ask what claim the molecule makes:

**Tier 1 — Prop.** In a scene, never compared against a sibling (water in a
membrane diagram, methane as "the nonpolar one"). Hand-write it; correct shape
and polarity is enough.

**Tier 2 — Contrast.** Shown *against* a near-identical molecule where one
feature is the whole point. That feature must be exactly right **and asserted by
`check-molecules.js`**. Most of the Bio 101 curriculum lives here:

<!-- ENUM: flip the Built column when a pair ships; add a row for a new contrast. -->
| Contrast | Differs by | The lesson | Built |
|---|---|---|---|
| starch vs cellulose | α- vs β-1,4 linkage | why we can't digest wood | ✓ `glycosidic` |
| saturated vs unsaturated fat | one C=C, *cis* | why butter is solid and oil is not | ✓ `cis` |
| ribose vs deoxyribose | one –OH at 2′ | why DNA is the stable archive | ✓ `stereo:{faces}` |
| glucose vs galactose | one –OH orientation | why galactosemia is a disease | ✓ `stereo:{axial}` |
| L- vs D-amino acids | handedness | why life is homochiral | ✓ `chirality` |
| purine vs pyrimidine | two rings vs one | why A–T and G–C are equal width | ✓ `topology` |
| succinate vs fumarate | one C=C, *trans* | why the cycle's one oxidation makes FADH₂, not NADH | ✓ `cis` |

The first six are `contrast-lab.html`; succinate/fumarate is the first contrast
that is *not*, which is worth noticing — a contrast pair does not need a page
that draws them side by side, only a lesson whose point rests on the one
feature. Here that is a whole step of the citric-acid cycle. Three of the
originals are worth reading before adding another:

- **L-/D-alanine needed no new assertion.** `chirality` was already generic over
  both hands (`actual = vol>0?'L':'D'`) — it exists to catch a reflection
  slipping into an L-only build, not to assume L. D-alanine is that spec's
  coordinates mirrored, the same trick a bad SDF converter produces by accident.
- **Saturated/unsaturated needed a genuinely new one**, `cis:{atoms,value}`,
  because cis and trans C=C share the same bond length and the same ~120°
  flanking angles; only the torsion differs. `palmitoleate`'s bend was worked out
  by hand and verified against the dihedral formula before being baked in.
- **Starch vs cellulose shipped as rule 2 requires**: the new `glycosidic:`
  assertion in the same commit as the molecules. It was never blocked on
  geometry, only on being checkable.

Three things about that last pair generalize:

**It renders as `maltose` and `cellobiose`, not starch and cellulose** — rule 1.
Coil-versus-ribbon is *emergent* over hundreds of repeats (WaterSim.md §3's
discipline, applied to a polymer), and two rings don't earn the polymer's name.
What the pair does render exactly is the linkage, which is the whole lesson.

**Both share one linkage conformation, deliberately.** A disaccharide's φ/ψ are
floppy, so per §1.6 the pose is schematic and not asserted — which makes it a
knob, and a per-molecule knob would put part of the visible difference outside
the chemistry. One slot-and-spin pair for both means every on-screen difference
traces back to the one axial/equatorial choice at C1.

**A pose can pass every check and still be unpresentable — that's a geometry bug,
not a camera one.** The shared pose was first chosen for maximum clearance, which
left the ring planes near *perpendicular*: all checks passed, and no camera angle
showed both rings as chairs, so the second residue rendered as a blob and no
amount of `VIEW.disaccharide` tuning fixed it. It's now swept for **near-coplanar
ring planes** (0.87 of parallel), which is also the extended shape the real
disaccharides take; clearance drops to 0.64, still far above the checker's floor
of 0. Generally: for a multi-ring spec, *presentability is a property of the
conformation* and the checker can't see it. Reach for the view table only once
the geometry admits a good view.

**How a distinguishing feature gets declared.** One of these goes on the spec,
and `check-molecules.js` fails if the geometry disagrees:

<!-- ENUM: a new claim type goes here AND in check-molecules.js's header, same commit. -->
| Declaration | Means | Used by |
|---|---|---|
| `stereo:'all-equatorial'` | every ring substituent equatorial | glucose |
| `stereo:{axial:[i,…]}` | exactly these ring atoms are axial, all others equatorial | galactose (C4) |
| `stereo:{faces:{i:'a',…}}` | which ring atoms' substituents share a face — checked as a *relative* pattern, since the ring normal's sign is arbitrary | ribose, deoxyribose |
| `topology:{rings:[…],fused:true,linear}` | ring count, ring sizes, that a bicycle shares an edge, and — with `linear` — that three or more fused rings run in a ROW rather than bending, checked as collinear ring centroids (pass an atom list to scope it to one ring system). `fused` alone cannot tell anthracene from phenanthrene | purine, pyrimidine; `linear` on FAD/FADH₂ |
| `chirality:'L'` | signed volume over CIP priorities | the amino acids |
| `cis:{atoms:[i,j,k,l],value}` | i-j-k-l dihedral about the j-k (C=C) bond is ~0° if `value` is true, ~180° if false | palmitoleate |
| `tautomer:{nh:[…]}` | exactly these ring nitrogens carry a hydrogen — the fetched free-base tautomer is not always DNA's | the four nucleobases |
| `wc:{partner,bonds:[{self,role,partnerAtom}]}` | the Watson–Crick edge: each donor/acceptor and the partner atom it meets, checked to be reciprocal and role-swapped on the partner spec | the four nucleobases |
| `chiral:[{at,priority,hand}]` | the four substituents at a stereocentre, named in CIP order 1→4, and the hand that order implies — a signed volume, checked with a guard that priority 4 really is opposite the other three. The *ranking* is the spec's to state (CIP needs a substituent-tree walk the checker does not do); the *geometry* is the checker's | malate, isocitrate |
| `glycosidic:{anomeric,bridge,partner,config,link}` | the bridging O joins one ring's anomeric carbon to carbon 4 of *another* ring, and the bond leaving the anomeric carbon is axial (`'alpha'`) or equatorial (`'beta'`) | maltose, cellobiose |

`{faces}` deliberately cannot catch a *global* mirror — flip every substituent and
the relative pattern is unchanged, so L-ribose would pass as D-. No page makes a
D/L claim about a sugar yet; the moment one does, it needs its own assertion.

Every one of those is a stereochemistry or bond-order claim — the class that
renders beautifully while being wrong.

**Tier 3 — Subject.** The structure *is* the lesson (DNA's helix, an active
site). Derive it from a real record.

Rules that follow:

1. **Name honesty.** If the distinguishing feature isn't rendered correctly,
   don't use the name that implies it. Call it "a sugar", not "glucose".
2. **A claim ships with its assertion, in the same commit.** A new claim type
   means extending `check-molecules.js` as part of adding the molecule — never as
   a follow-up.
3. **Source it by §1.2.**
4. **Anything a lab manipulates needs an index map** (`pep`, `gly`) — reactions
   address atoms by position and a reindex silently breaks them.

### 1.5 Bond-length scale families — a page may only show one

Display radii in `PALETTE` are stylised and **large**, so no spec can use true
ångströms: a bond must exceed the sum of its two atoms' radii or the spheres
swallow the stick. `check-molecules.js` enforces that and nothing more — *how* a
spec satisfies it is the trap. Two families:

<!-- ENUM: update when a spec is added, or SCALE / the GL constants change. -->
| Family | Specs | Rule | Implied scale |
|---|---|---|---|
| **A. hand-written** | everything in `mol-solvation.js` — water, ethanol, ammonia, methane, CO₂, carbonic, bicarbonate, hydronium, the two salts | each length picked to clear its own radii | ~1.2–1.6×, **varies within a molecule** |
| **B. derived** | everything in `mol-monomers.js`, `mol-pathways.js`, `mol-contrast.js`, `mol-compare.js` — amino acids, palmitate, AMP, glucose + all glycolysis intermediates, every contrast-pair spec | **stored in real Å** (`units:'angstrom'`); `register()` applies the display scale once | **1.9×**, relative lengths truthful |

Families line up with the domain files, so **a page's script tags show which
families it mixes**. That's the only mechanical signal — nothing fails a build.

Family B stores real ångströms: a spec declares `units:'angstrom'` and
`register()` multiplies by `SCALE` once; `units:'scene'` means already-display
units, left alone. `check-molecules.js` requires the field, because getting it
wrong is a silent 1.9× — big enough to see, small enough to look like styling.
Two consequences:

- **The display scale is one number in one place.** Changing `SCALE` moves all 26
  family-B specs together. `skel.js` no longer knows `SCALE` exists.
- **Scale is applied at registration, not render.** `Stage.buildMolecule` isn't
  the only reader — `glycolysis-lab`, `contrast-lab` and `haworth.js`
  index `spec.atoms[i].pos` directly and compare against `PALETTE.radii`, which
  are scene units.

Family A is **not** "ångströms not yet converted". It isn't expressible as any
molecule times any single factor — that's what makes it family A — so un-baking
it is a geometry change, not a units change, and means re-tuning the solvation
engine. `water-lab.html` and `molecule-lab.html` hard-code `HL=1.55` and tune
`EQ`, `MIN`, `hbThreshold` and the ice lattice around it.

**Which is why the small molecules exist twice.** `mol-small.js` carries water,
ammonia, methane, CO₂ and ethanol from measured lengths as family B;
`mol-solvation.js` keeps the family-A versions.

| page needs | load |
|---|---|
| solvation physics (H-bonds, ice, dissolving) | `mol-solvation.js` |
| a small molecule **beside** an amino acid, sugar or lipid | `mol-small.js` |

They define the same keys deliberately and `register()` throws if both load, so
choosing wrong fails loudly instead of rendering 15% off. This is the one place
the "one molecule, not two" rule is broken on purpose: **a family-A water is a
tuned parameter of a physics engine; a family-B water is a picture of a water
molecule.** Different objects sharing a name. Nothing scale-free is duplicated —
`nacl` and `kcl` carry no coordinates, only dissociation records.

**The rule: one page, one family.** Only family B is comparable
molecule-to-molecule, so only family B may make a size claim.

**Known residual, measured:** `ringPyranose()` builds a *regular* hexagon, so a
pyranose's ring C–O is as long as its ring C–C. Against the real PubChem
β-D-glucopyranose record: ring 3.13 Å wide vs 2.90, heavy-atom span 6.78 Å vs
6.26 — **+8%**, inherited from the ring and consistent throughout. Left alone
deliberately; closing it means a ring builder with alternating bond lengths,
which is a rewrite, not a constant.

**Don't measure size across hydrogens — heavy atoms only.** An –OH rotamer is
arbitrary in a static model, so a size figure depending on one measures the
builder, not the molecule. Macromolecule-lab's first "Å across" put glucose at
8.3 Å against a real 6.45, because the widest pair was two hydroxyl *hydrogens*:
`Skel.outwardAt` splays every free substituent away from the centroid at once,
which no real molecule does.

A page that must show a solvation molecule next to a derived one is a new
problem — solve it in `molecules.js`, not on the page.

### 1.6 Derive when shape carries the lesson; schematize when topology does

Both are legitimate; the failure is doing one while claiming the other.

Real coordinates are right when the *shape* is the point — a chair ring, a
tetrahedral centre, a helix. They're **wrong** when the lesson is topology: a
phospholipid's real conformer is floppy and renders as spaghetti, and the lesson
is "polar head, nonpolar tails", so build it schematically **on purpose** and say
so in the comment — exactly as §1.2's open-chain Fischer intermediates are
deliberate. Bilayers and polymers also need instancing rather than N built
groups, and should be validated at the monomer, not the assembly.

The declaration vocabulary is in §1.4, whose contrast table has no unbuilt rows.
The two most recent additions were both cases where the render couldn't settle
the question: `cis:{atoms,value}` and `glycosidic:{…,config}`.
