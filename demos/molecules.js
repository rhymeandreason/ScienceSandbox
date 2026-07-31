/* =====================================================================
 *  molecules.js — shared molecule library + colour palette
 *  Loaded as a classic script (Three r128 global style) BEFORE the page's
 *  main script. Exposes window.MolLib for both water-lab.html and the
 *  upcoming molecule-builder.html, so colours and geometry stay identical
 *  across pages.
 *
 *  PALETTE is the single source of truth for atom + bond colours.
 *  MOLECULES will hold the declarative specs (geometry + charge sites +
 *  solute class) that drive buildMolecule() and the solvation physics.
 *
 * ---------------------------------------------------------------------
 *  BOND-LENGTH SCALE FAMILIES — read this before putting two molecules
 *  from different sections on the same screen.
 * ---------------------------------------------------------------------
 *  There is ONE hard rule, and check-molecules.js enforces it: a bond must
 *  be longer than the sum of its two atoms' display radii, or the spheres
 *  swallow the stick and the molecule renders as a blob. Display radii here
 *  are stylised and LARGE, so no spec can use true ångströms.
 *
 *  How each section satisfies that rule is NOT the same, and that is the
 *  trap. Two families live in this file:
 *
 *    A. HAND-WRITTEN (water, ethanol, ammonia, methane, CO₂, carbonic,
 *       bicarbonate, hydronium — the solvation pages).
 *       Each length was chosen individually to clear its radii. Water's O–H
 *       is 1.55 against radii summing to 1.50. Implied scale runs ~1.2–1.6×
 *       and varies WITHIN a molecule (ethanol: C–C 1.19×, C–O 1.33×,
 *       O–H 1.61×). There is no proportionality claim, and there cannot be
 *       one: water-lab.html and molecule-lab.html hard-code HL=1.55 and tune
 *       their entire solvation engine around it (EQ, MIN, hbThreshold, the
 *       ice lattice spacing). Rescaling water means re-tuning that physics.
 *       Do not touch this family to make some other page tidy.
 *       These specs carry `units:'scene'` — the numbers ARE display units and
 *       register() leaves them alone. Family A is not "ångströms not yet
 *       converted": it is not expressible as any molecule × any single factor,
 *       which is exactly why item 7 could un-bake family B and not this.
 *
 *    B. DERIVED (the amino acids, palmitate, amp, and everything the Skel
 *       builder makes — glucose and the glycolysis intermediates).
 *       These specs STORE REAL ÅNGSTRÖMS (`units:'angstrom'`) and register()
 *       multiplies by SCALE = 1.9 once, on the way in. Relative lengths are
 *       truthful, so these molecules are comparable to each other — and the
 *       file now says what a chemist would say.
 *
 *  THE RULE: a page should show molecules from ONE family. Mixing them means
 *  two molecules side by side at different scales, with nothing on screen
 *  saying so.
 *
 *  This was learned the expensive way. The Skel table (GL, in skel.js) used to
 *  be family A while the amino acids were family B; nothing showed it, because
 *  no page mixed them. macromolecule-lab.html then put Skel glucose beside
 *  PubChem alanine and AMP under the words "true relative size", and glucose
 *  was ~0.7× everything around it. GL is now family B.
 *
 *  HOW A FAMILY-B PAGE SHOWS A SMALL MOLECULE: load mol-small.js, not
 *  mol-solvation.js. It carries water, ammonia, methane, CO₂ and ethanol built
 *  from MEASURED lengths in real ångströms, so they sit correctly beside an
 *  amino acid or a sugar. mol-solvation.js keeps the family-A versions, which
 *  are the solvation engine's tuned particles and are not to scale.
 *
 *  The two files define the SAME KEYS on purpose, and register() throws if both
 *  load — so picking the wrong one is a loud failure rather than a molecule
 *  that is quietly 15% wrong.
 *
 *  This is what fixed the exception found when item 3 split this file:
 *  aminoacid-lab.html draws a real water for every dehydration, and was getting
 *  the family-A one — a 1.55 O–H among residues drawn at 1.84, about 15%
 *  short. Nobody could see it while every page loaded every spec. It now loads
 *  mol-small.js and the released water is exactly to scale, with no change to
 *  the solvation engine at all.
 *
 *  The salts are not duplicated: nacl/kcl carry no coordinates, only
 *  dissociation records, so they are scale-free and belong to no family.
 * ===================================================================== */
(function(global){
  'use strict';


  // ---- colours (hex ints) ---------------------------------------------
  // Atom colours double as the swatches in water-lab's Debug ▸ Colours tab;
  // editing PALETTE.atoms live keeps every molecule on the page consistent.
  const PALETTE = {
    atoms: {
      O:  0xd6362e,   // oxygen   — red
      H:  0xb9c2d0,   // hydrogen — pale steel
      Na: 0x9a3fe0,   // sodium   — violet
      Cl: 0x1fa968,   // chloride — green
      K:  0x0054C0,   // potassium — blue (distinct from Na)
      C:  0x3a3a3a,   // carbon   — charcoal
      N:  0x3f6ae0,   // nitrogen — blue
      S:  0xe0b93a,   // sulfur   — goldenrod (cysteine / methionine)
      P:  0xe07b1f,   // phosphorus — orange (CPK). Deliberately the warmest atom
                      // in the palette: in glycolysis the phosphate IS the energy
                      // currency, so every P a student sees is "something ATP paid
                      // for or will be paid back". No other lesson uses P, so it
                      // can't be confused with sulfur's goldenrod.
    },
    bonds: {
      covalent:  0xb3a892,   // covalent stick — muted stone on cream
      hbond:     0x0042aa,   // hydrogen bond  — deep blue
      iondipole: 0xd9791e,   // ion–dipole bond — deep amber
      peptide:   0x6a5acd,   // peptide (amide C–N) bond — slate violet, so the
                             // newly-formed backbone link reads distinct from the
                             // ordinary covalent sticks within each residue
    },
    // default display radii (scene units, stylised — enlarged for legibility)
    radii: { O:0.95, H:0.55, C:0.85, N:0.90, S:1.05, Na:0.70, Cl:1.24, K:0.85, P:1.00 },
  };

  // ---- molecule library ----------------------------------------------
  // Each entry:
  //   name, formula
  //   class    — 'solvent' | 'ionic' | 'polar' | 'nonpolar'
  //   atoms    — [{el, pos:[x,y,z]}]  local positions. These are family A
  //              (hand-written, per-bond, matching water's exaggerated O–H) —
  //              see the scale-families note at the top of this file.
  //   bonds    — [[i,j], …]  indices into atoms
  //   sites    — { donors:[{atom}], acceptors:[{atom, lonePairs}] }
  //              donor = a δ+ H that can point into water; acceptor = a
  //              lone-pair-bearing atom water's H can point at. Drives the
  //              H-bond engine for molecular (polar) solutes.
  //   dissociates — ionic only: [{ion, charge, radius}] produced on dissolving
  //   hydrophobic — indices of nonpolar atoms (tail), for the exclusion lesson
  //   src      — WHERE THE COORDINATES CAME FROM, and what was done to them.
  //              See the provenance note below.
  //
  // Geometry notes: united-atom where a group is nonpolar filler (ethanol's
  // CH3/CH2 are single C spheres); explicit H's where they carry the lesson.
  //
  // ---------------------------------------------------------------------
  //  PROVENANCE — `src:` on every spec (docs/molecule-pipeline.md item 1)
  // ---------------------------------------------------------------------
  //  Four different paths produce geometry in this file and, until this field
  //  existed, nothing in a spec recorded which one it took. Two of them
  //  ('pubchem' and 'skel') even produce the same bond-length family, so they
  //  are indistinguishable by inspection while failing in completely different
  //  ways. `src.path` is the discriminator:
  //
  //    'hand'    — coordinates typed by a person, each bond length chosen to
  //                clear its two display radii. Family A. Its own source.
  //    'pubchem' — a real measured 3D record through one of the converters in
  //                tools/. Family B. The ONLY path that cannot be re-run from
  //                this repo alone (no .sdf is committed yet — item 2).
  //    'skel'    — constructed at load time from idealised VSEPR angles by the
  //                Skel builder below. Family B. Fully reproducible, because
  //                the code IS the source. Defaulted by Skel.prototype.spec,
  //                so a new Skel molecule is labelled without anyone deciding.
  //    'built'   — constructed, but from literals worked out once by hand
  //                rather than by Skel. Family B. Reproducible only in the
  //                sense that the comment above the spec explains the
  //                construction; nothing re-derives it.
  //    'mirror'  — reflected from another spec in this file at load time.
  //
  //  THE THREE-VALUE RULE, which is the point of the field:
  //
  //    a field PRESENT   — this decision was made, and here it is.
  //    a field NULL      — this decision was never pinned. Regenerating may
  //                        silently produce a different molecule.
  //    a field ABSENT    — not applicable to this path.
  //
  //  `conformer:null` is therefore a claim, not a gap: it says the sweep in
  //  molecule-pipeline.md item 0 applies to this spec — a CID alone does not
  //  identify a conformer, so anything with a rotatable side chain may come
  //  back different. Do not "tidy" a null into an absence.
  //
  //  Fields for path 'pubchem': `cid` or `query` (how the record was asked
  //  for — a bare NAME is weaker than a CID and is recorded as such, because
  //  a name pins neither a stereocentre nor a CHARGE STATE; see `amp` for what
  //  that one cost), `record` (the record_type), `conformer`
  //  (PUBCHEM_CONFORMER_ID), `tool` (which converter), `sdf` (the committed
  //  input in tools/sdf/), `regen` (below), `reindex` if the fixed backbone
  //  order was imposed by hand, `strip`/`charge` for post-processing,
  //  `fetched` when the date is known.
  //
  //  `regen` — HOW COMPLETELY the committed .sdf rebuilds this spec. A recorded
  //  verdict from a real run, not something re-derived at load:
  //    'exact'  — the .sdf regenerates these coordinates to 0.000.
  //    'manual' — the .sdf is the true source, but a hand step sits in the
  //               middle, so it does not rebuild on its own [proline].
  //    'lost'   — NO published record reproduces this spec any more. The
  //               committed .sdf is the closest available, NOT a reproduction,
  //               and THE SPEC IS NOW THE SOURCE. Refreshing one of these from
  //               PubChem silently swaps a conformer [glutamine, glutamate].
  //  tools/sdf/README.md has the per-file table and the two cautionary cases.
  // The derived-family scale factor. It lives HERE rather than in skel.js
  // because it is a property of the library, not of the builder: the PubChem
  // converters apply the same 1.9 (tools/sdf2spec.js), so monomer pages that
  // never load a builder still need it. skel.js reads it back off MolLib to
  // define GL and AR. Exported so Stage.measure() can divide it out and report
  // real ångströms — pages used to hard-code 1.9, which silently becomes wrong
  // the day this constant moves.
  const SCALE = 1.9;

  // Presentation views: which way a molecule should FACE, in radians [x,y,z],
  // applied by Stage.buildMolecule rather than baked into the coordinates. A
  // spec's atom positions stay canonical, so check-molecules.js measures the
  // molecule and not a camera angle, and two specs can share one view by name
  // instead of by copying three constants and a comment.
  // ENUM: a new shared angle goes here, not inline in a spec — CLAUDE.md
  // "Keeping the docs true" lists this table as one that goes stale silently.
  const VIEW = {
    // The 3/4 chair. Every pyranose on every page uses this, which is what makes
    // glucose look the same in glycolysis-lab, macromolecule-lab and contrast-lab.
    // Tuned +28° x / -24.4° y off an earlier [1.05, 0.45, -0.2] pass.
    pyranose:[1.5387, 0.0241, -0.2],
    // Tuned -30.5° y off an earlier [-0.89, -2.723, -1.257] pass.
    furanose:[-0.89, -3.2553, -1.257],
    // Two pyranose rings across a glycosidic link (maltose/cellobiose).
    disaccharide:[-1.3828, -0.1882, -1.0656],
    // Flat aromatics are built in the xz-plane, so they need turning face-on.
    // Tuned -6.5° x / -20.8° y off an earlier [-Math.PI/2, 0.35, 0] pass.
    flatRing:[-1.6842, -0.013, 0],
  };

  // The registry. Domain files (mol-*.js) register into this; molecules.js on
  // its own deliberately holds NO specs. Which files a page loads is what
  // decides which molecules exist on it — see CLAUDE.md's script table.
  const MOLECULES = {};

  /* ---- units, and where the display scale is applied ------------------
   * A spec's coordinates ON DISK are REAL ÅNGSTRÖMS (`units:'angstrom'`).
   * They are multiplied by SCALE exactly once, here, as the spec is
   * registered. So the FILE is honest and instrument-comparable, while
   * everything downstream still sees the stylised scene units it always has.
   *
   * The display scale is applied at REGISTRATION rather than at render, and
   * that is deliberate: `Stage.buildMolecule` is not the only reader.
   * glycolysis-lab, contrast-lab, _compare and haworth.js all index
   * `spec.atoms[i].pos` directly and compare it against PALETTE.radii, which
   * are scene units. Scaling at render would leave every one of those
   * comparing ångströms to scene units — a class of bug that renders as
   * "everything is suddenly tiny" in some places and not others.
   *
   * `units:'scene'` means the numbers are already display-scale and must NOT
   * be touched. Two groups carry it:
   *   · the family-A solvation set, whose lengths were each hand-picked to
   *     clear their display radii and are not a real molecule × any factor
   *     (SCIENCE.md §1.5). Converting those is a separate, riskier job —
   *     it means re-tuning the solvation engine.
   *   · specs DERIVED from an already-registered spec (dAlanine mirrors
   *     alanine), which are therefore already scaled.
   *
   * Scaling is idempotent: a spec is stamped once and never re-scaled, so a
   * double registration cannot silently double a molecule's size.
   */
  function register(specs){
    for(const [key, spec] of Object.entries(specs)){
      if(!spec.units) throw new Error(
        `molecules.js: ${key} has no \`units\` — 'angstrom' (real, scaled here) `
        + `or 'scene' (already display-scale). See the units note in molecules.js.`);
      if(spec.units === 'angstrom' && !spec._scaled && spec.atoms){
        for(const a of spec.atoms) a.pos = [a.pos[0]*SCALE, a.pos[1]*SCALE, a.pos[2]*SCALE];
        spec._scaled = true;
      }
      // Two domain files claiming the same name is never intentional, and
      // letting the last one silently win is how a page draws a molecule from
      // a family it did not mean to load. mol-solvation.js and mol-small.js
      // deliberately define the SAME keys at different scales, so this is what
      // stands between "wrong file in the script tags" and "everything looks
      // fine but the water is 16% small".
      if(MOLECULES[key] && MOLECULES[key] !== spec) throw new Error(
        `molecules.js: '${key}' is already registered — two domain files define `
        + `it. Check the page's <script> tags: mol-solvation.js (family A, the `
        + `solvation engine's particles) and mol-small.js (family B, to scale) `
        + `both define the small molecules and must never load together.`);
      MOLECULES[key] = spec;
    }
    return MOLECULES;
  }

  // THE MANIFEST: every domain file, in dependency order. A page loads the
  // subset it needs (that is the point of the split); anything wanting the
  // WHOLE library walks this list rather than hard-coding one — lib-node.js is
  // the only such consumer today, and it exists so that adding a domain file
  // does not mean remembering four checkers.
  //   ENUM: a new mol-*.js goes here AND in CLAUDE.md's script table.
  //   tools/check-docs.js asserts every name below is a real file.
  // Order matters: mol-contrast.js mirrors alanine out of mol-monomers.js.
  const DOMAINS = [
    'mol-solvation.js',    // family A — needs no builder
    'mol-monomers.js',     // family B, PubChem + literals — needs no builder
    'mol-glycolysis.js',   // needs skel.js
    'mol-contrast.js',     // needs skel.js AND mol-monomers.js
  ];

  // Files that REPLACE one of the above rather than adding to it. They define
  // the same keys at a different scale, so register() throws if both load —
  // which is the point. Anything walking the library for checking has to load
  // an alternate SEPARATELY (see lib-node.js), never alongside what it swaps.
  //   ENUM: a new either/or domain file goes here, not in DOMAINS.
  const DOMAIN_ALTERNATES = [
    { file:'mol-small.js', replaces:'mol-solvation.js' },
  ];

  /* ---------- atom references by name ----------
   * Specs carry an optional `names` array: one PDB-style label per atom, in
   * the same order as `atoms`. Fields that point AT atoms may then use those
   * labels instead of raw integers — `diff:['NE2','HE21','HE22']` says what it
   * selects, where `diff:[17,18,19]` says only where it currently lands.
   *
   * The problem this solves is real and already documented all over this file:
   * seven fields (`pep`, `groups`, `diff`, `optH`, `stereo.axial`, `cis`,
   * `glycosidic`) index into `atoms`, and the comments keep warning that
   * regenerating a spec "must not renumber them" — with nothing enforcing it.
   * A different BFS order in sdf2spec.js silently repoints every one of them.
   * Named references survive that, and check-molecules.js fails loudly on a
   * name that does not resolve.
   *
   * `names` is generated once by tools/name-atoms.js and committed, not derived
   * at load. It is positional and travels with `atoms`: regenerate the two
   * together. The suffixes come from chemistry (bond order, then element), not
   * from array position, so a reordered spec yields the SAME names — which is
   * the whole point.
   *
   * Integers still work everywhere, so specs migrate one at a time.
   */
  function atomIndex(spec, ref){
    if(typeof ref === 'number') return ref;
    const i = spec.names ? spec.names.indexOf(ref) : -1;
    if(i < 0) throw new Error(`atom '${ref}' is not in ${spec.name||'this spec'}`
      + (spec.names ? '' : " (spec has no `names` array yet)"));
    return i;
  }
  const resolveAtoms = (spec, refs) => (refs||[]).map(r => atomIndex(spec, r));

  // SCALE is exported so Stage.measure() can divide it back out and report real
  // angstroms. Pages used to hard-code 1.9 to do that, which silently becomes
  // wrong the day this constant moves.
  global.MolLib = { PALETTE, MOLECULES, SCALE, VIEW, DOMAINS, DOMAIN_ALTERNATES, register, atomIndex, resolveAtoms };
})(this);
