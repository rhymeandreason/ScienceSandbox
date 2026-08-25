/* =====================================================================
 *  mol-small.js — the small molecules AT TRUE SCALE (family B)
 * =====================================================================
 *  The same substances as mol-solvation.js, and deliberately NOT the same
 *  specs. Load exactly one of the two.
 *
 *    mol-solvation.js   family A. Each bond length hand-picked to clear its own
 *                       display radii; water's O–H is 1.55 against radii
 *                       summing to 1.50. water-lab and molecule-lab hard-code
 *                       HL=1.55 and tune EQ, MIN, hbThreshold and the ice
 *                       lattice around it. These are the SOLVATION ENGINE'S
 *                       PARTICLES, and they are not to scale.
 *
 *    mol-small.js       family B. Measured bond lengths in real ångströms,
 *                       scaled by register() like every other family-B spec.
 *                       These are PROPS: a water to put beside an amino acid,
 *                       a methane to put beside a fatty acid. They are
 *                       comparable to every other family-B molecule and to
 *                       each other.
 *
 *  WHY BOTH EXIST, given that this project's rule is one molecule per library
 *  ("one glucose, not two"): these are not two copies of one thing. A family-A
 *  water is a tuned parameter of a physics engine — changing it re-tunes the
 *  engine. A family-B water is a picture of a water molecule. They answer
 *  different questions, and for this PAIR only one can be right on a given page
 *  — not because of the general family rule, which is per scene (see
 *  MolecularGeometry.md §1.5), but because these two define the same KEYS, so
 *  whichever loads last wins for every stage at once.
 *  Duplicating the SUBSTANCE is the cost; the alternative was every page that
 *  merely draws a water having to either re-tune solvation or show a molecule
 *  16% too small, which is what tests/aminoacid-lab.html did until this file existed.
 *
 *  `register()` throws if both files load, so the mistake is loud.
 *
 *  DO NOT run the solvation engine on these. Its constants assume family A;
 *  hand it a to-scale water and the H-bond thresholds are all wrong.
 *
 *  The salts are NOT duplicated here. `nacl`/`kcl` carry no coordinates at all
 *  — only dissociation records — so they are scale-free and mol-solvation.js's
 *  versions are already reusable anywhere. A molecule with no geometry has no
 *  family.
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
      // mol-solvation.js's copy for why it carries NO acceptors despite being
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
