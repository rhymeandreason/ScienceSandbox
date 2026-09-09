/* =====================================================================
 *  mol-small.js — the small molecules AT TRUE SCALE (family B)
 * =====================================================================
 *  Water, ammonia, methane, O₂, CO₂, ethanol and carbonic acid: measured bond
 *  lengths in real ångströms, scaled by register() like every other family-B
 *  spec. These are PROPS — a water to put beside an amino acid, a methane to
 *  put beside a fatty acid — and they are comparable to every other family-B
 *  molecule and to each other.
 *
 *  THE SMALL MOLECULES USED TO EXIST TWICE, and the reason is worth keeping
 *  even though the other copy is gone. attic/solvation/mol-solvation.js was
 *  family A: every bond length hand-picked to clear its own display radii,
 *  water's O–H 1.55 against radii summing to 1.50. Those were the SOLVATION
 *  ENGINE'S PARTICLES, not a picture of a molecule, and the engine was tuned
 *  around them — so the file could not follow the rest of the library to real
 *  ångströms, and moved to attic/ with molecule-lab.html, its last page.
 *  A family-A water was a tuned parameter; a family-B water is a picture.
 *  Different objects that shared a name, which is why the two defined the same
 *  KEYS and only one could be right on a page.
 *
 *  It is safe to run the solvation engine on THESE — water/watersim.js builds
 *  its water from its own HL and reads no spec at all. What is not safe is
 *  assuming a spec's numbers are ångströms without checking `units`: the
 *  atticked file carries `units:'scene'`, and register() leaves those alone.
 *
 *  The salts are not here. `nacl`/`kcl` carry no coordinates — only
 *  dissociation records — so they are scale-free and belong to no family.
 *  watersim.js keeps the one it dissolves in its own SALTS table, and the
 *  bonding builder its own in IonicDrag.RECIPES.
 *
 *  Sources: spectroscopic/microwave equilibrium geometries, the values any
 *  textbook quotes. Each is named against its spec below. Angles are the real
 *  ones, which is the half family A already got right — what changes here is
 *  that the LENGTHS are real too, so the proportions between two molecules on
 *  screen mean something.
 * ===================================================================== */
(function(global){
  'use strict';
  const SELFNAME = 'mol-small.js';
  // Registry from molecules.js. Domain files only ever ADD to it.
  const Lib = global.MolLib
    || (typeof require === 'function' ? require('./molecules.js').MolLib : null);
  if (!Lib) throw new Error(SELFNAME + ': molecules.js must be loaded first');
  const { MOLECULES, VIEW, register } = Lib;

  register({
    water: {
      name:'Water', formula:'H₂O', class:'solvent',
      // O–H 0.9572 Å, H–O–H 104.474° — the standard spectroscopic geometry.
      // Family A draws this same angle with a 1.55 O–H; here it is 0.9572,
      // which register() turns into 1.819 scene units against radii summing to
      // 1.50. Both clear their spheres; only this one is to scale.
      atoms:[ {el:'O',pos:[0,0,0]},
              {el:'H',pos:[0.7567,-0.5862,0]},
              {el:'H',pos:[-0.7567,-0.5862,0]} ],
      bonds:[ [0,1],[0,2] ],
      sites:{ donors:[{atom:1},{atom:2}], acceptors:[{atom:0, lonePairs:2}] },
      units:'angstrom',
      src:{path:'hand', note:'spectroscopic r(O-H)=0.9572, HOH=104.474'},
    },
    ammonia: {
      name:'Ammonia', formula:'NH₃', class:'polar',
      // N–H 1.012 Å, H–N–H 106.67°. Trigonal pyramidal, lone pair up (+y).
      // The polar angle is SOLVED from the real H–N–H rather than assumed
      // tetrahedral — ammonia is measurably flatter than 109.5°, and that
      // narrowing is the lone pair pushing the bonds together.
      atoms:[ {el:'N',pos:[0,0,0]},
              {el:'H',pos:[0.9373,-0.3815,0]},
              {el:'H',pos:[-0.4687,-0.3815,0.8118]},
              {el:'H',pos:[-0.4687,-0.3815,-0.8118]} ],
      bonds:[ [0,1],[0,2],[0,3] ],
      sites:{ donors:[{atom:1},{atom:2},{atom:3}], acceptors:[{atom:0, lonePairs:1}] },
      units:'angstrom',
      src:{path:'hand', note:'r(N-H)=1.012, HNH=106.67'},
    },
    methane: {
      name:'Methane', formula:'CH₄', class:'nonpolar',
      // C–H 1.087 Å, exactly tetrahedral (symmetry requires it).
      atoms:[ {el:'C',pos:[0,0,0]},
              {el:'H',pos:[0.6276,0.6276,0.6276]}, {el:'H',pos:[0.6276,-0.6276,-0.6276]},
              {el:'H',pos:[-0.6276,0.6276,-0.6276]}, {el:'H',pos:[-0.6276,-0.6276,0.6276]} ],
      bonds:[ [0,1],[0,2],[0,3],[0,4] ],
      sites:{ donors:[], acceptors:[] },
      hydrophobic:[0,1,2,3,4],
      units:'angstrom',
      src:{path:'hand', note:'r(C-H)=1.087, tetrahedral by symmetry'},
    },
    o2: {
      name:'Oxygen', formula:'O₂', class:'nonpolar',
      // O=O 1.208 Å — the spectroscopic bond length, and a double bond by the
      // usual Lewis count (the real ground state is a triplet with two unpaired
      // electrons, which no drawing in this repo is trying to say).
      //
      // THE NONPOLAR REFERENCE. Two identical atoms means no electronegativity
      // difference, no dipole, and nothing for water to H-bond to — see
      // attic/solvation/mol-solvation.js's copy for why it carries NO acceptors despite being
      // oxygen. In family B it also carries the size argument the membrane
      // lesson runs on: radiusOf puts it at about half of glucose, and that
      // gap plus the missing charge is the whole of "why O₂ crosses and
      // glucose doesn't".
      atoms:[ {el:'O',pos:[0.604,0,0]}, {el:'O',pos:[-0.604,0,0]} ],
      bonds:[ [0,1,2] ],
      sites:{ donors:[], acceptors:[] },
      hydrophobic:[0,1],
      units:'angstrom',
      src:{path:'hand', note:'r(O=O)=1.208, homonuclear so linear and nonpolar'},
    },
    co2: {
      name:'Carbon dioxide', formula:'CO₂', class:'nonpolar',
      // C=O 1.160 Å, linear. Symmetric, so the two dipoles cancel and the
      // MOLECULE has no net dipole — but each O still carries δ− and two lone
      // pairs, which is why CO₂ is far more soluble than O₂ or CH₄.
      // `class` is 'nonpolar' here, not the solvation file's 'reactive':
      // nothing on a family-B page runs the CO₂ → carbonic chain, and claiming
      // a reaction this file cannot perform would be a lie in the data.
      atoms:[ {el:'C',pos:[0,0,0]}, {el:'O',pos:[1.16,0,0]}, {el:'O',pos:[-1.16,0,0]} ],
      bonds:[ [0,1,2],[0,2,2] ],
      sites:{ donors:[], acceptors:[{atom:1, lonePairs:2},{atom:2, lonePairs:2}] },
      units:'angstrom',
      src:{path:'hand', note:'r(C=O)=1.160, linear by symmetry'},
    },
    carbonic: {
      name:'Carbonic acid', formula:'H₂CO₃', class:'polar',
      // C=O 1.203 Å, C–O(H) 1.340 Å, O–H 0.961 Å; O=C–O 125.2°, O–C–O 109.6°,
      // C–O–H 106.3°. The syn-syn (C2v) conformer, which is the gas-phase
      // minimum. The three angles at carbon sum to 360.0° — the sp2 centre is
      // planar, and check-molecules.js holds it there.
      //   THE POINT OF HAVING IT: one molecule carrying both kinds of oxygen,
      // so a carbonyl's lone pairs can be read against a hydroxyl's. The C=O
      // has two pairs in the sp2 plane and no H of its own; each C–O–H has two
      // and donates one. `lobes-test` panel B is that comparison.
      //   NO `ionizesTo`: bicarbonate is family A's, and the CO₂ → carbonic →
      // bicarbonate chain is molecule-lab's. Same argument as co2's `class`
      // above — this file does not claim a reaction it cannot perform.
      atoms:[ {el:'C',pos:[0,0.0855,0]},          // 0 sp2 carbon
              {el:'O',pos:[0,1.2885,0]},          // 1 carbonyl O (=O)
              {el:'O',pos:[1.095,-0.687,0]},      // 2 hydroxyl O
              {el:'O',pos:[-1.095,-0.687,0]},     // 3 hydroxyl O
              {el:'H',pos:[1.8471,-0.0887,0]},    // 4 acidic H on atom 2
              {el:'H',pos:[-1.8471,-0.0887,0]} ], // 5 acidic H on atom 3
      bonds:[ [0,1,2],[0,2],[0,3],[2,4],[3,5] ],
      sites:{ donors:[{atom:4},{atom:5}],
              acceptors:[{atom:1, lonePairs:2},{atom:2, lonePairs:2},{atom:3, lonePairs:2}] },
      units:'angstrom',
      src:{path:'hand', note:'syn-syn C2v: r(C=O)=1.203, r(C-O)=1.340, r(O-H)=0.961, OCO=125.2/109.6, COH=106.3'},
    },
    ethanol: {
      name:'Ethanol', formula:'C₂H₅OH', class:'polar',
      // C–C 1.512, C–O 1.431, O–H 0.971 Å; C–C–O 107.8°, C–O–H 105.4°.
      // All-atom, unlike the family-A version's united-atom methyls: at true
      // scale the H's fit, and the point of this spec is comparability.
      // Origin is the heavy-atom centroid, so it spins about its middle.
      atoms:[ {el:'C',pos:[-1.1538,-0.4542,0]},        // 0 methyl C
              {el:'C',pos:[0.3582,-0.4542,0]},         // 1 methylene C
              {el:'O',pos:[0.7956,0.9083,0]},          // 2 hydroxyl O
              {el:'H',pos:[1.7658,0.8677,0]},          // 3 hydroxyl H (donor)
              {el:'H',pos:[-0.79,-1.4816,0]},          // 4 methyl H
              {el:'H',pos:[-0.79,0.0596,0.8898]},      // 5 methyl H
              {el:'H',pos:[-0.79,0.0596,-0.8898]},     // 6 methyl H
              {el:'H',pos:[0.7288,-0.9625,0.8901]},    // 7 methylene H
              {el:'H',pos:[0.7288,-0.9625,-0.8901]} ], // 8 methylene H
      bonds:[ [0,1],[1,2],[2,3],[0,4],[0,5],[0,6],[1,7],[1,8] ],
      sites:{ donors:[{atom:3}], acceptors:[{atom:2, lonePairs:2}] },
      hydrophobic:[0,1,4,5,6,7,8],
      units:'angstrom',
      src:{path:'hand', note:'r(C-C)=1.512, r(C-O)=1.431, r(O-H)=0.971, CCO=107.8, COH=105.4'},
    },
  }, SELFNAME);
})(this);
