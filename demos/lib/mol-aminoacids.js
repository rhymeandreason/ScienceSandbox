/* =====================================================================
 *  mol-aminoacids.js — the amino acids (family B, real ångströms)
 * =====================================================================
 *  Eight of the twenty, and the pairs among them are the point: L- against
 *  D-alanine is handedness, glycine against proline is a free amino nitrogen
 *  against a ring-closed one, glutamine against glutamate is an amide against
 *  an acid. Each says so in its own `contrast:` block, which is where a
 *  contrast has always lived — it was never a property a FILE had to carry.
 *
 *  NO BUILDER. Every spec here is a PubChem 3D conformer fetched by CID and
 *  converted by tools/sdf2spec.js, plus one mirror (D-alanine) taken from the
 *  L- form beside it. So this file needs skel.js for nothing, and a page that
 *  wants residues no longer pays to parse a ring builder to get them.
 *
 *  ORDER MATTERS INSIDE THIS FILE. D-alanine is built by reflecting `alanine`,
 *  which register() has already scaled, so alanine has to be registered first.
 *  That dependency used to cross a file boundary — the old mol-contrast.js reaching
 *  into mol-monomers.js — and the DOMAINS list carried a note about it. Both
 *  halves live here now, so the ordering is local and visible.
 *
 *  THE FIXED BACKBONE ORDER is documented at the top of the register block
 *  below and is load-bearing: `pep:{cC,oOH,hOH,nN,hN}` indexes into it,
 *  molecules.js derives each spec's `condense:` roles from that, and
 *  check-molecules.js gates its L-handedness assertion on the same block.
 *  Regenerating a spec must not renumber it.
 * ===================================================================== */
(function(global){
  'use strict';
  const SELFNAME = 'mol-aminoacids.js';
  // Registry from molecules.js. Domain files only ever ADD to it.
  const Lib = global.MolLib
    || (typeof require === 'function' ? require('./molecules.js').MolLib : null);
  if (!Lib) throw new Error(SELFNAME + ': molecules.js must be loaded first');
  const { MOLECULES, VIEW, register } = Lib;

  const AA = {};
  register({
    // ---- amino acids ----------------------------------------------------
    // Shared backbone, laid out left→right so a chain grows along +X:
    //   amino end (−X)  H₂N–Cα–COOH  carboxyl end (+X)
    //   0 N   1 H   2 H       (amino group; an H leaves in condensation)
    //   3 Cα  4 H              (α-carbon; 4 is the backbone H)
    //   5 C   6 O(=O)  7 O(–OH)  8 H   (carboxyl; the –OH, atoms 7+8, leaves)
    //   9…    side chain (R), bonded to Cα (atom 3), splayed −Y
    // `pep` names the atoms the peptide-bond reaction acts on:
    //   cC carboxyl carbon · oOH/hOH the leaving hydroxyl · nN amino N · hN amino H's.
    // check-molecules.js gates its L-handedness assertion on this block, so a
    // spec that drops it stops being checked without failing anything.
    // Only the ANGLES/topology carry the lesson; bond lengths are stylised as
    // elsewhere (must exceed the two display radii so the stick shows).
    // Zwitterion form is skipped on purpose — the neutral –NH₂/–COOH makes the
    // "lose a water" bookkeeping legible; note this is a display simplification.
    // Handedness: life builds proteins from L-amino acids only (the D- mirror
    // images exist but ribosomes don't use them), so every chiral residue
    // declares `chirality:'L'` and check-molecules.js verifies the signed
    // volume over CIP priorities. optH lists only nonpolar C–H — an H on
    // N/O/S is never in it, since those are the H-bond donors and the leaving
    // groups a peptide bond consumes, and hiding them would hide the lesson.
    // ---- generated from PubChem 3D records (see tools/sdf2spec.js) --------
    // Coordinates are REAL conformers: correct angles (Ca is tetrahedral, ~110°,
    // not the 180° the old hand-written specs drew) and genuinely non-planar,
    // unlike the flat z=0 layouts elsewhere in this file. One global 1.9x scale
    // is applied so every stick clears the enlarged display radii — relative
    // bond lengths stay truthful, which the old per-pair guesses did not.
    // Bond ORDERS come straight from the SDF bond block, so the carboxyl C=O
    // is tagged [i,j,2] without anyone having to notice it by hand.
    // Re-generate rather than hand-editing these numbers.
    glycine: {
      // Laid out flat for macromolecule-builder.html's build stage:
      // the chain is assembled in the diagram and revealed in 3D.
      flat:true,
      flat2d:[[-1.799,-0.346],[-0.6,-1.039],[0.6,-0.346],[0.6,1.039],[1.799,-1.039]],
      name:'Glycine', formula:'C₂H₅NO₂', class:'aminoacid', res:'Gly', side:'–H',
      // Re-verified 2026-07-30 against the committed sdf/glycine.sdf: 0.000
      // coordinate delta, bonds identical. `query` is kept because it records how
      // this was originally asked for; `cid` is what now identifies it.
      units:'angstrom',
      src:{path:'pubchem', cid:750, query:'glycine', record:'3d',
           conformer:'000002EE00000001', sdf:'glycine.sdf',
           tool:'sdf2spec', regen:'exact', fetched:'2026-07-30'},
      atoms:[ {el:'N',pos:[-1.171,0.496,0.705]},
              {el:'H',pos:[-1.155,1.515,0.734]},
              {el:'H',pos:[-1.155,0.179,1.673]},
              {el:'C',pos:[0,0,0]},
              {el:'H',pos:[-0.003,0.371,-1.029]},
              {el:'C',pos:[1.232,0.496,0.705]},
              {el:'O',pos:[1.207,1.203,1.705]},
              {el:'O',pos:[2.382,0.113,0.094]},
              {el:'H',pos:[3.175,0.46,0.556]},
              {el:'H',pos:[-0.001,-1.093,0]} ],
      names:['N','H','H2','CA','HA1','C','O','OXT','HXT','HA2'],
      smiles:'O=C(O)C[NH2:1]',
      bonds:[ [0,1],[0,2],[0,3],[3,4],[3,5],[3,9],[5,6,2],[5,7],[7,8] ],
      optH:[4,9],   // nonpolar C–H, hidden by the lab’s H toggle
      // glycine is ACHIRAL: its side chain is an H, so Ca has two identical
      // substituents and there is no L/D to assert.
      pep:{ cC:5, oOH:7, hOH:8, nN:0, hN:[1,2] },
      // contrast-lab.html: glycine is the free-N-H reference half of the
      // glycine-proline pair (see proline's own contrast block below for
      // why alanine couldn't take this slot — it's already D-alanine's
      // partner). Glycine has the plainest possible side chain, so the only
      // thing left to contrast is the backbone nitrogen itself.
      contrast:{ pair:'glycine-proline', partner:'proline',
        differs:'free vs ring-closed amino N',
        lesson:'why gluten resists digestion',
        diff:['N','H','H2'],
        note:'Glycine has no side chain to speak of — just an H — so its backbone '
           + 'nitrogen carries two ordinary N–H bonds and the chain stays free to '
           + 'straighten, which is the shape a digestive protease needs to grip. '
           + 'Proline’s side chain bonds back into that nitrogen and takes away '
           + 'both.' },
    },
    alanine: {
      // Laid out flat for macromolecule-builder.html's build stage:
      // the chain is assembled in the diagram and revealed in 3D.
      flat:true,
      flat2d:[[-0.613,1.77],[-0.613,0.354],[0.613,-0.354],[0.613,-1.77],[1.839,0.354],[-1.839,-0.354]],
      name:'Alanine', formula:'C₃H₇NO₂', class:'aminoacid', res:'Ala', side:'–CH₃',
      // The name 'alanine' resolves to CID 5950, which is L-alanine — the right
      // one, but by PubChem's choice rather than ours. Now pinned to the CID, and
      // chirality:'L' below is the assertion that would catch it if that ever moved.
      units:'angstrom',
      src:{path:'pubchem', cid:5950, query:'alanine', record:'3d',
           conformer:'0000173E00000001', sdf:'alanine.sdf',
           tool:'sdf2spec', regen:'exact', fetched:'2026-07-30'},
      atoms:[ {el:'N',pos:[-1.172,0.515,-0.705]},
              {el:'H',pos:[-2.019,0.195,-0.236]},
              {el:'H',pos:[-1.211,0.123,-1.646]},
              {el:'C',pos:[0,0,0]},
              {el:'H',pos:[-0.004,0.393,1.022]},
              {el:'C',pos:[1.237,0.515,-0.705]},
              {el:'O',pos:[1.262,1.206,-1.713]},
              {el:'O',pos:[2.357,0.112,-0.05]},
              {el:'H',pos:[3.173,0.438,-0.486]},
              {el:'C',pos:[-0.028,-1.522,0]},
              {el:'H',pos:[0.814,-1.93,0.57]},
              {el:'H',pos:[-0.949,-1.901,0.458]},
              {el:'H',pos:[0.04,-1.928,-1.016]} ],
      names:['N','H','H2','CA','HA','C','O','OXT','HXT','CB','HB1','HB2','HB3'],
      smiles:'O=[C:1](O)[C@H:1]([CH3:1])[NH2:1]',
      bonds:[ [0,1],[0,2],[0,3],[3,4],[3,5],[3,9],[5,6,2],[5,7],[7,8],[9,10],[9,11],[9,12] ],
      optH:[4,10,11,12],   // nonpolar C–H, hidden by the lab’s H toggle
      chirality:'L',   // asserted by check-molecules.js — life is homochiral
      // contrast-lab.html: alanine is the L (reference) half of the L-/D-alanine
      // pair. Every atom position differs from D-alanine (a true mirror image,
      // not a rotation), so there is no single distinguishing atom the way
      // galactose's C4 is one — `diff` instead marks the whole stereocentre:
      // Cα and its four substituents, the group whose spatial arrangement is
      // the entire lesson.
      contrast:{ pair:'alanine-D-alanine', partner:'dAlanine',
        differs:'handedness',
        lesson:'why life is homochiral',
        diff:['CA','N','HA','C','CB'],
        note:'Every ribosome on Earth builds proteins from L-amino acids only. '
           + 'The choice of L over D looks like an early accident — but once '
           + 'translation locked onto one hand, every enzyme that reads a '
           + 'protein chain came to expect it, and a D-residue jams the machinery.' },
      pep:{ cC:5, oOH:7, hOH:8, nN:0, hN:[1,2] },
      // No `condense:` here: molecules.js derives one from `pep` above for every
      // amino acid, so the atoms the peptide bond acts on are stated once. The
      // same two half-reactions glucose declares, on a different pair of groups
      // — same O + H + H, same one bond made. That the sugar and the amino acid
      // need one table and not two is the claim: dehydration synthesis is one
      // reaction.
      // alanine is the PROTEIN monomer of the four-class set, so it carries the
      // same `groups` index map the other three do. Indices are the fixed
      // backbone order (see above) — regenerating this spec must not renumber them.
      mono:'protein',
      groups:[
        { key:'amino', label:'Amino group', formula:'–NH₂', atoms:[0,1,2],
          note:'The nitrogen end. Every amino acid has one, and it is where the next residue attaches.' },
        { key:'carboxyl', label:'Carboxyl group', formula:'–COOH', atoms:[5,6,7,8],
          note:'The acid end. Its –OH is what leaves as water when a peptide bond forms.' },
        { key:'alpha', label:'α-carbon', formula:'Cα', atoms:[3,4],
          note:'One carbon carrying all four: amino, carboxyl, an H, and the side chain. Four different groups means it is chiral — and life uses only the L form.' },
        { key:'side', label:'Side chain', formula:'R = –CH₃', atoms:[9,10,11,12],
          note:'The only part that differs between the twenty amino acids. Everything a protein does traces back to which R groups sit where.' },
      ],
    },
    serine: {
      // Laid out flat for macromolecule-builder.html's build stage:
      // the chain is assembled in the diagram and revealed in 3D.
      flat:true,
      flat2d:[[0,1.773],[0,0.355],[1.228,-0.355],[1.228,-1.773],[2.457,0.355],[-1.228,-0.355],[-2.457,0.355]],
      name:'Serine', formula:'C₃H₇NO₃', class:'aminoacid', res:'Ser', side:'–CH₂OH',
      units:'angstrom',
      src:{path:'pubchem', cid:5951, query:'serine', record:'3d',
           conformer:'0000173F00000001', sdf:'serine.sdf',
           tool:'sdf2spec', regen:'exact', fetched:'2026-07-30'},
      atoms:[ {el:'N',pos:[-1.166,0.514,-0.716]},
              {el:'H',pos:[-1.164,0.181,-1.679]},
              {el:'H',pos:[-1.128,1.532,-0.758]},
              {el:'C',pos:[0,0,0]},
              {el:'H',pos:[-0.007,0.394,1.022]},
              {el:'C',pos:[1.234,0.514,-0.716]},
              {el:'O',pos:[1.339,0.727,-1.915]},
              {el:'O',pos:[2.249,0.71,0.167]},
              {el:'H',pos:[3.06,1.04,-0.276]},
              {el:'C',pos:[-0.025,-1.526,0]},
              {el:'O',pos:[1.112,-2.017,0.703]},
              {el:'H',pos:[-0.926,-1.914,0.486]},
              {el:'H',pos:[0.019,-1.931,-1.017]},
              {el:'H',pos:[1.062,-1.677,1.613]} ],
      names:['N','H','H2','CA','HA','C','O','OXT','HXT','CB','OG','HB1','HB2','HG'],
      bonds:[ [0,1],[0,2],[0,3],[3,4],[3,5],[3,9],[5,6,2],[5,7],[7,8],[9,10],[9,11],[9,12],[10,13] ],
      optH:[4,11,12],   // nonpolar C–H, hidden by the lab’s H toggle
      chirality:'L',   // asserted by check-molecules.js — life is homochiral
      pep:{ cC:5, oOH:7, hOH:8, nN:0, hN:[1,2] },
    },
    cysteine: {
      // Laid out flat for macromolecule-builder.html's build stage:
      // the chain is assembled in the diagram and revealed in 3D.
      flat:true,
      flat2d:[[0,1.858],[0,0.372],[1.287,-0.372],[1.287,-1.858],[2.574,0.372],[-1.287,-0.372],[-2.574,0.372]],
      name:'Cysteine', formula:'C₃H₇NO₂S', class:'aminoacid', res:'Cys', side:'–CH₂SH',
      units:'angstrom',
      src:{path:'pubchem', cid:5862, query:'cysteine', record:'3d',
           conformer:'000016E600000001', sdf:'cysteine.sdf',
           tool:'sdf2spec', regen:'exact', fetched:'2026-07-30'},
      atoms:[ {el:'N',pos:[-1.17,0.537,-0.698]},
              {el:'H',pos:[-1.187,1.552,-0.604]},
              {el:'H',pos:[-2.02,0.197,-0.251]},
              {el:'C',pos:[0,0,0]},
              {el:'H',pos:[-0.016,0.37,1.033]},
              {el:'C',pos:[1.235,0.537,-0.698]},
              {el:'O',pos:[1.522,0.272,-1.86]},
              {el:'O',pos:[2.017,1.314,0.094]},
              {el:'H',pos:[2.815,1.632,-0.38]},
              {el:'C',pos:[-0.047,-1.529,0]},
              {el:'S',pos:[1.403,-2.255,0.831]},
              {el:'H',pos:[-0.944,-1.884,0.519]},
              {el:'H',pos:[-0.073,-1.924,-1.022]},
              {el:'H',pos:[2.316,-1.87,-0.073]} ],
      names:['N','H','H2','CA','HA','C','O','OXT','HXT','CB','SG','HB1','HB2','HG'],
      bonds:[ [0,1],[0,2],[0,3],[3,4],[3,5],[3,9],[5,6,2],[5,7],[7,8],[9,10],[9,11],[9,12],[10,13] ],
      optH:[4,11,12],   // nonpolar C–H, hidden by the lab’s H toggle
      chirality:'L',   // asserted by check-molecules.js — life is homochiral
      pep:{ cC:5, oOH:7, hOH:8, nN:0, hN:[1,2] },
    },
  }, SELFNAME);

  {
    // — D-alanine: the exact mirror image of `alanine` above, not a rotation.
    // Negating one coordinate component is a reflection (determinant -1), which
    // flips every CIP-priority signed volume without touching a single bond
    // length or angle — the same trick check-molecules.js's comment on the
    // chirality check describes ("negated one output component"). Z is chosen
    // arbitrarily; any single axis works.
    const mirror=p=>[p[0],p[1],-p[2]];
    AA.dAlanine={ name:'D-Alanine', formula:'C₃H₇NO₂', class:'aminoacid',
      // Reflection of `alanine` (determinant -1), computed at load time, so it
      // inherits alanine's provenance and cannot drift from it.
      // Mirrors MOLECULES.alanine, which register() has already scaled — so
      // these coordinates are scene units, not Angstroms. Scaling again would
      // double it.
      units:'scene',
      src:{path:'mirror', of:'alanine', axis:'z'},
      res:'D-Ala', side:'–CH₃',
      atoms:MOLECULES.alanine.atoms.map(a=>({ el:a.el, pos:mirror(a.pos) })),
      names:['N','H','H2','CA','HA','C','O','OXT','HXT','CB','HB1','HB2','HB3'],
      smiles:'O=[C:1](O)[C@@H:1]([CH3:1])[NH2:1]',
      bonds:MOLECULES.alanine.bonds.map(b=>b.slice()),
      optH:MOLECULES.alanine.optH.slice(),
      chirality:'D',   // asserted by check-molecules.js — the mirror life doesn't use
      pep:{ cC:5, oOH:7, hOH:8, nN:0, hN:[1,2] },
      contrast:{ pair:'alanine-D-alanine', partner:'alanine',
        differs:'handedness',
        lesson:'why life is homochiral',
        diff:['CA','N','HA','C','CB'],
        note:'Same four groups on Cα as L-alanine — amino, carboxyl, H, methyl — '
           + 'just mirrored. Bacteria use D-alanine to cross-link cell walls, and it '
           + 'turns up in a few peptide antibiotics, but no ribosome on Earth reads it.' } };
  }
  {
    // — proline: the one amino acid whose side chain bonds BACK to its own
    //   backbone nitrogen, closing a 5-membered ring (N-Ca-Cb-Cg-Cd-N). Every
    //   other residue's backbone follows the fixed order this file documents
    //   at the top of the amino-acid section (0 N, 1 H, 2 H, 3 Ca, …) because
    //   the amino N carries TWO hydrogens — a primary amine. Proline's N is
    //   secondary (one H, one ring bond), so slot 2 — normally the second
    //   amino H — holds Cδ instead, and Cδ's own two hydrogens land at the
    //   tail (15, 16). `pep.hN` is therefore a ONE-element array, not two:
    //   documentation of the difference, not a page hookup. Anything reading
    //   hN must read the whole array; proline is the spec that punishes hN[1].
    //
    //   Real PubChem 3D conformer (CID 145742, L-proline), reindexed by hand
    //   into the above order and run through sdf2spec.js's own reframe()
    //   (recentre on Ca, backbone N->C -> +X, side chain -> -Y, the same
    //   1.9x SCALE). check-molecules.js's
    //   chirality check (CA_IDX 3, R_IDX 9 — both land on the right atoms
    //   under this reindexing) confirms the geometry is L, as it must be:
    //   ribosomes only ever build with proline's one hand.
    //
    //   contrast-lab.html: paired with glycine, not alanine — alanine's
    //   `contrast` slot is already spoken for by D-alanine, and glycine (no
    //   side chain beyond H) makes the cleaner point anyway: even the
    //   plainest possible amino acid still has a free N-H. Proline does not.
    AA.proline={ name:'Proline', formula:'C₅H₉NO₂', class:'aminoacid', res:'Pro', side:'ring to N',
      // The one spec whose extra step was written down. reindex:'by-hand' is
      // load-bearing: sdf2spec.js THROWS on proline (its reindex assumes two H
      // on the amino N), so only reframe() was used. Anything that regenerates
      // this must reproduce the hand reindex or hit the same TypeError.
      // The .sdf is committed and the conformer pinned, but `regen:'manual'` is
      // the honest ceiling: sdf2spec.js still throws on this record (verified
      // again 2026-07-30), so the committed file documents the SOURCE without
      // making the spec re-derivable. Reproducing it means repeating the hand
      // reindex described above.
      units:'angstrom',
      src:{path:'pubchem', cid:145742, record:'3d',
           conformer:'0002394E00000001', sdf:'proline.sdf',
           tool:'sdf2spec:reframe-only', reindex:'by-hand',
           regen:'manual', fetched:'2026-07-30'},
      atoms:[ {el:'N',pos:[-1.1784,0.4747,-0.7253]},
              {el:'H',pos:[-1.0163,1.3679,-1.1863]},
              {el:'C',pos:[-1.5289,-0.5705,-1.6816]},
              {el:'C',pos:[0,0,0]},
              {el:'H',pos:[0.0111,0.4184,1.0116]},
              {el:'C',pos:[1.2216,0.4747,-0.7253]},
              {el:'O',pos:[1.2147,1.1511,-1.7432]},
              {el:'O',pos:[2.3458,0.0489,-0.0989]},
              {el:'H',pos:[3.1579,0.3484,-0.5605]},
              {el:'C',pos:[-0.1026,-1.5216,0]},
              {el:'H',pos:[-0.2768,-1.9095,1.01]},
              {el:'H',pos:[0.7958,-2.0095,-0.3947]},
              {el:'C',pos:[-1.2979,-1.8411,-0.89]},
              {el:'H',pos:[-1.1132,-2.7058,-1.5347]},
              {el:'H',pos:[-2.1726,-2.0658,-0.2668]},
              {el:'H',pos:[-0.8747,-0.5332,-2.56]},
              {el:'H',pos:[-2.5658,-0.4789,-2.0168]} ],
      names:['N','H','CD','CA','HA','C','O','OXT','HXT','CB','HB1','HB2','CG','HG1','HG2','HD1','HD2'],
      smiles:'O=C(O)[C@@H]1CC[CH2:1][NH:1]1',
      bonds:[ [0,1],[0,2],[0,3],[2,15],[2,16],[3,4],[3,5],[3,9],
              [5,6,2],[5,7],[7,8],[9,10],[9,11],[9,12],[12,2],[12,13],[12,14] ],
      optH:[4,10,11,13,14,15,16],   // nonpolar C–H, hidden by the lab's H toggle
      chirality:'L',   // asserted by check-molecules.js — life is homochiral
      pep:{ cC:5, oOH:7, hOH:8, nN:0, hN:[1] },   // one amino H, not two — see note above
      contrast:{ pair:'glycine-proline', partner:'glycine',
        differs:'ring-closed vs free amino N',
        lesson:'why gluten resists digestion',
        diff:['N','H','CD'],
        note:'Every other amino acid’s backbone nitrogen carries a free N–H, and the '
           + 'chain around it can flex into the extended shape a protease has to '
           + 'grip. Proline’s side chain bonds back into that nitrogen: no free N–H, '
           + 'and a stiff kink the enzyme cannot accommodate. Gliadin is unusually '
           + 'proline-rich, so those bonds pass through your gut uncut.' } };
  }
  {
    // — glutamine / glutamic acid: the second half of the gluten story. The edit
    //   is at the tip of the side chain only — amide –NH2 becomes –OH, so an N
    //   is replaced by an O and one H drops (C5H10N2O3 -> C5H9NO4). The lab's
    //   `ask` calls this "one atom" because the swap is what you SEE; the lost H
    //   is one of the two amide H's and is not separately visible.
    //
    //   Tissue transglutaminase (tTG) deamidates a glutamine side chain: the
    //   terminal amide –NH2 becomes an –OH, neutral becomes negative at gut pH.
    //   That single swap is what turns an undigested gliadin fragment into
    //   something HLA-DQ2/DQ8 binds tightly enough to trigger a T-cell response
    //   — see the `contrast` notes below. The proline pair explains why the
    //   fragment survives the gut at all; this pair explains why the survivor
    //   becomes an antigen.
    //
    //   Both are real PubChem 3D conformers (CID 5961 L-glutamine, CID 33032
    //   L-glutamic acid) run through tools/sdf2spec.js — no hand reindexing,
    //   unlike proline, though glutamine did force the backbone-N fix in that
    //   tool's reindex(): it is the first residue here with TWO nitrogens, and
    //   the SDF lists the side-chain amide N first.
    //
    //   The two carry the same ELEMENT in the same slot all the way to index 16
    //   (backbone 0-8, then Cb 9, Cg 10, its H 11/12, Cd 13, its H 14/15), and
    //   diverge only at the tail: glutamine 16 O(=), 17 N, 18/19 amide H;
    //   glutamic acid 16 O(-H), 17 O(=), 18 hydroxyl H. That alignment is an
    //   indexing convenience, not the visual effect — it keeps `diff` and `pep`
    //   reading the same slots on both, nothing more. What the eye actually
    //   responds to is the pose, set further down. Same slots also does NOT mean
    //   same coordinates: these are two independent conformers whose positions
    //   differ from index 1 on. `diff` marks only the group that changes — the
    //   carbonyl O is common to both, and highlighting it would overstate the
    //   edit.
    //
    //   VIEW TUNING: both are then rotated about X — the backbone axis reframe()
    //   already fixed — by +18.00° (Gln) and +17.75° (Glu). Straight out of the
    //   converter the side chain curled toward the camera and Cb/Cg drew as one
    //   blob with the terminal group hidden behind them; each angle is the one
    //   that flattened that molecule's heavy atoms best. Rotation about a fixed
    //   axis is chirality-preserving, so check-molecules.js still reads both as
    //   L; only the pose changes, never a length or an angle. Constrained to the
    //   root that keeps the side chain pointing -Y: the other z-minimum is ~180°
    //   away and would flip one chain up and the other down.
    //
    //   Then the terminal group is turned about the Cg-Cd bond (atoms 10->13) by
    //   -84.75° (Gln) and -89.50° (Glu). That bond is a freely rotating single
    //   bond, so this picks a different SIDE-CHAIN ROTAMER — a conformation the
    //   real residue samples constantly — rather than editing any length or
    //   angle. It is the one change here that is not a pure view transform, and
    //   it earns its place: in the PubChem rotamer the amide sits edge-on to the
    //   camera and the N hides behind the carbonyl O, which is precisely the
    //   atom the whole pair exists to show. After the turn every non-bonded pair
    //   of heavy atoms clears by at least 0.50 in screen XY.
    //
    //   Both angles are additionally constrained to put the carbonyl O on the
    //   RIGHT and the group that actually differs (Gln's –NH2, Glu's –OH) on the
    //   LEFT, so the eye lands on the same spot in either panel and sees one
    //   substitution. This is what makes the pair read as one molecule edited;
    //   unconstrained, the two best-scoring rotamers splay opposite ways.
    //
    //   Drawn NEUTRAL (side chain as –COOH, not –COO–), matching every other
    //   amino acid in this file and `palmitate`'s 'Palmitic acid' naming. The
    //   lesson is the amide->acid swap; the ionisation that follows from it is
    //   named in the note rather than drawn.
    AA.glutamine={ name:'Glutamine', formula:'C₅H₁₀N₂O₃', class:'aminoacid', res:'Gln', side:'–CH₂CH₂CONH₂',
      // conformer:null is the ACTIVE claim here, and 2026-07-30 made it worse
      // rather than better. ALL TEN currently-published conformers of CID 5961
      // were fetched and converted; none reproduces this spec (best |Δ| 6.357,
      // default record 7.056). The deviation climbs outward from the backbone
      // (N 0.5 → NE2 5.3 → terminal H 7.1): the backbone reproduces, the
      // flexible tail does not, and the tail is where this spec's lesson lives.
      //
      // So the source geometry is LOST — PubChem regenerates conformer sets, and
      // whichever one this came from is no longer published. sdf/glutamine.sdf is
      // committed as the closest available record, NOT as a reproduction; that is
      // what regen:'lost' means. THIS SPEC IS NOW ITS OWN SOURCE. Do not
      // 'refresh' it from PubChem — you would silently swap the rotamer, and the
      // amide's edge-on presentation that the contrast lesson depends on is a
      // property of THIS conformer.
      units:'angstrom',
      src:{path:'pubchem', cid:5961, record:'3d', conformer:null,
           sdf:'glutamine.sdf', tool:'sdf2spec', regen:'lost',
           fetched:'2026-07-30'},
      atoms:[ {el:'N',pos:[-1.1737,0.3363,-0.8058]},
              {el:'H',pos:[-1.1547,-0.1737,-1.6879]},
              {el:'H',pos:[-1.1516,1.3258,-1.0495]},
              {el:'C',pos:[0,0,0]},
              {el:'H',pos:[-0.0021,0.6584,0.8768]},
              {el:'C',pos:[1.2416,0.3363,-0.8058]},
              {el:'O',pos:[1.2516,0.7332,-1.9637]},
              {el:'O',pos:[2.38,0.1637,-0.0837]},
              {el:'H',pos:[3.1805,0.3879,-0.6042]},
              {el:'C',pos:[-0.0384,-1.4621,0.4753]},
              {el:'C',pos:[-0.1305,-2.53,-0.6211]},
              {el:'H',pos:[0.85,-1.6674,1.0868]},
              {el:'H',pos:[-0.8968,-1.5805,1.1505]},
              {el:'C',pos:[-0.2784,-3.9421,-0.0963]},
              {el:'H',pos:[-0.9963,-2.34,-1.2658]},
              {el:'H',pos:[0.7663,-2.4937,-1.2511]},
              {el:'O',pos:[0.69,-4.6295,0.2174]},
              {el:'N',pos:[-1.5826,-4.3758,-0.0279]},
              {el:'H',pos:[-2.3637,-3.7879,-0.3]},
              {el:'H',pos:[-1.8063,-5.3079,0.3032]} ],
      names:['N','H','H2','CA','HA','C','O','OXT','HXT','CB','CG','HB1','HB2','CD','HG1','HG2','OE1','NE2','HE21','HE22'],
      smiles:'N[C@@H](CCC(=O)[NH2:1])C(=O)O',
      bonds:[ [0,1],[0,2],[0,3],[3,4],[3,5],[3,9],[5,6,2],[5,7],[7,8],
              [9,10],[9,11],[9,12],[10,13],[10,14],[10,15],[13,16,2],[13,17],[17,18],[17,19] ],
      optH:[4,11,12,14,15],   // nonpolar C–H; the amide N–H at 18/19 are donors, never optional
      chirality:'L',   // asserted by check-molecules.js — life is homochiral
      pep:{ cC:5, oOH:7, hOH:8, nN:0, hN:[1,2] },
      contrast:{ pair:'glutamine-glutamate', partner:'glutamate',
        differs:'side-chain amide vs acid',
        lesson:'how gluten becomes an antigen',
        diff:['NE2','HE21','HE22'],
        note:'Gliadin is glutamine-rich as well as proline-rich. This side chain '
           + 'ends in an amide — neutral, and nothing your immune system objects to. '
           + 'An enzyme in your gut wall swaps that –NH₂ for an –OH.' } };
    AA.glutamate={ name:'Glutamic acid', formula:'C₅H₉NO₄', class:'aminoacid', res:'Glu', side:'–CH₂CH₂COOH',
      // Same as glutamine, and checked the same way: all ten published
      // conformers of CID 33032 fetched and converted 2026-07-30, none
      // reproducing this spec (best |Δ| 5.827). Note these two are INDEPENDENT
      // conformers, not one spec edited into the other, which is why their
      // shared atoms do not share coordinates — and why losing the source hits
      // them separately. This spec is now its own source; see glutamine.
      units:'angstrom',
      src:{path:'pubchem', cid:33032, record:'3d', conformer:null,
           sdf:'glutamate.sdf', tool:'sdf2spec', regen:'lost',
           fetched:'2026-07-30'},
      atoms:[ {el:'N',pos:[-1.1711,0.3311,-0.8089]},
              {el:'H',pos:[-1.1858,1.3332,-0.9974]},
              {el:'H',pos:[-2.0195,0.1284,-0.2821]},
              {el:'C',pos:[0,0,0]},
              {el:'H',pos:[-0.0047,0.6579,0.8768]},
              {el:'C',pos:[1.2416,0.3311,-0.8089]},
              {el:'O',pos:[1.2495,0.7226,-1.9695]},
              {el:'O',pos:[2.3805,0.1411,-0.0926]},
              {el:'H',pos:[3.1821,0.3532,-0.6168]},
              {el:'C',pos:[-0.0132,-1.4647,0.4689]},
              {el:'C',pos:[0.1268,-2.5258,-0.6263]},
              {el:'H',pos:[-0.9363,-1.6532,1.0337]},
              {el:'H',pos:[0.8032,-1.6047,1.1905]},
              {el:'C',pos:[0.2042,-3.9379,-0.1021]},
              {el:'H',pos:[-0.73,-2.4705,-1.3058]},
              {el:'H',pos:[1.0421,-2.3463,-1.2011]},
              {el:'O',pos:[-1.0042,-4.5553,-0.0789]},
              {el:'O',pos:[1.24,-4.4716,0.2742]},
              {el:'H',pos:[-0.9411,-5.47,0.2695]} ],
      names:['N','H','H2','CA','HA','C','O','OXT','HXT','CB','CG','HB1','HB2','CD','HG1','HG2','OE2','OE1','HE2'],
      smiles:'N[C@@H](CCC(=O)[OH:1])C(=O)O',
      bonds:[ [0,1],[0,2],[0,3],[3,4],[3,5],[3,9],[5,6,2],[5,7],[7,8],
              [9,10],[9,11],[9,12],[10,13],[10,14],[10,15],[13,16],[13,17,2],[16,18] ],
      optH:[4,11,12,14,15],   // nonpolar C–H; the hydroxyl H at 18 is a donor, never optional
      chirality:'L',   // asserted by check-molecules.js — life is homochiral
      pep:{ cC:5, oOH:7, hOH:8, nN:0, hN:[1,2] },
      contrast:{ pair:'glutamine-glutamate', partner:'glutamine',
        differs:'side-chain acid vs amide',
        lesson:'how gluten becomes an antigen',
        diff:['OE2','HE2'],
        note:'The same residue after that swap: an oxygen where the amide nitrogen '
           + 'was, giving up its H and leaving the side chain negative. The immune '
           + 'receptor nearly everyone with celiac disease carries grips exactly this '
           + 'charge — and ignores the neutral version.' } };
  }
  register(AA, SELFNAME);
})(this);
