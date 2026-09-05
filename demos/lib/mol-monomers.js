/* =====================================================================
 *  mol-monomers.js — AMP, and nothing else yet
 * =====================================================================
 *  This file used to hold "one representative monomer per class" — a grouping
 *  by what a gallery page wanted to show, not by how a molecule is built. The
 *  amino acids went to mol-aminoacids.js and palmitate to mol-lipids.js, which
 *  is where their classes live.
 *
 *  AMP IS THE LAST OCCUPANT, and it is here because it has nowhere better yet:
 *  docs/molecules-wishlist.md puts it in mol-carriers.js, beside ATP, ADP and
 *  NADH. That file does not exist — building it means moving ATP and NADH out
 *  of mol-pathways.js and FAD and CoA out of mol-krebs.js, which touches four
 *  lesson pages. When it is built, this file goes with it.
 *
 *  So: do not add anything here. A one-spec file named for a category nobody
 *  files by is a place things get lost.
 * ===================================================================== */
(function(global){
  'use strict';
  const SELFNAME = 'mol-monomers.js';
  // Registry from molecules.js. Domain files only ever ADD to it.
  const Lib = global.MolLib
    || (typeof require === 'function' ? require('./molecules.js').MolLib : null);
  if (!Lib) throw new Error(SELFNAME + ': molecules.js must be loaded first');
  const { MOLECULES, VIEW, register } = Lib;

  register({
    amp: {
      name:'Adenosine monophosphate', formula:'C₁₀H₁₂N₅O₇P²⁻', charge:-2, class:'nucleotide', mono:'nucleic acid',
      // SETTLED 2026-07-30, and the comment above was right: the record supplies
      // the dianion. CID 15938965 is adenosine 5'-monophosphate(2-), and it
      // regenerates this spec EXACTLY (0.0000 delta, bonds identical). There was
      // no deprotonation step, so there is no `strip`.
      //
      // The trap that produced the wrong story: querying the NAME 'AMP' returns
      // CID 6083, the neutral acid — 37 atoms, two extra H sitting on the
      // phosphate oxygens, and a different conformer besides. The item 0 sweep
      // fetched that, read 14 H against 12, and inferred a stripping step that
      // never happened. Never identify this spec by name; the CID IS the charge
      // state, which is exactly the hazard molecule-pipeline.md item 1 warns
      // about for anomers.
      units:'angstrom',
      src:{path:'pubchem', cid:15938965, record:'3d',
           conformer:'00F3359500000005', sdf:'amp.sdf',
           tool:'sdf2spec-generic', charge:-2, regen:'exact', fetched:'2026-07-30'},
      atoms:[ {el:'P',pos:[-3.378,-2.614,-2.18]},
              {el:'O',pos:[-1.085,-0.715,0.99]},
              {el:'O',pos:[-0.702,2.833,1.42]},
              {el:'O',pos:[-2.613,1.339,2.646]},
              {el:'O',pos:[-2.892,-2.005,-0.722]},
              {el:'O',pos:[-3.154,-4.116,-2.036]},
              {el:'O',pos:[-2.463,-1.946,-3.202]},
              {el:'O',pos:[-4.847,-2.214,-2.296]},
              {el:'N',pos:[0.967,0.322,0.403]},
              {el:'N',pos:[2.33,-0.269,-1.262]},
              {el:'N',pos:[2.542,1.499,1.829]},
              {el:'N',pos:[4.782,1.509,0.861]},
              {el:'N',pos:[5.279,0.469,-1.237]},
              {el:'C',pos:[-1.123,1.644,0.784]},
              {el:'C',pos:[-2.497,1.186,1.231]},
              {el:'C',pos:[-0.263,0.453,1.18]},
              {el:'C',pos:[-2.468,-0.303,0.899]},
              {el:'C',pos:[-2.968,-0.607,-0.506]},
              {el:'C',pos:[2.202,0.807,0.732]},
              {el:'C',pos:[1.097,-0.317,-0.804]},
              {el:'C',pos:[3.031,0.43,-0.312]},
              {el:'C',pos:[4.367,0.808,-0.222]},
              {el:'C',pos:[3.857,1.807,1.805]},
              {el:'H',pos:[-1.108,1.802,-0.301]},
              {el:'H',pos:[-3.314,1.744,0.766]},
              {el:'H',pos:[0.031,0.485,2.236]},
              {el:'H',pos:[-3.023,-0.903,1.629]},
              {el:'H',pos:[-2.349,-0.109,-1.26]},
              {el:'H',pos:[-4.006,-0.278,-0.623]},
              {el:'H',pos:[-0.768,2.699,2.381]},
              {el:'H',pos:[-3.484,0.994,2.905]},
              {el:'H',pos:[0.264,-0.793,-1.304]},
              {el:'H',pos:[4.223,2.369,2.657]},
              {el:'H',pos:[4.973,-0.054,-2.045]},
              {el:'H',pos:[6.245,0.755,-1.148]} ],
      bonds:[ [0,4],[0,5],[0,6],[0,7,2],[1,15],[1,16],[2,13],[2,29],[3,14],[3,30],
              [4,17],[8,15],[8,18],[8,19],[9,19,2],[9,20],[10,18,2],[10,22],[11,21],
              [11,22,2],[12,21],[12,33],[12,34],[13,14],[13,15],[13,23],[14,16],
              [14,24],[15,25],[16,17],[16,26],[17,27],[17,28],[18,20],[19,31],
              [20,21,2],[22,32] ],
      optH:[23,24,25,26,27,28,31,32],   // nonpolar C–H; the O–H / N–H are never optional
      groups:[
        { key:'phosphate', label:'Phosphate', formula:'–PO₄', atoms:[0,4,5,6,7],
          note:'Negatively charged, and the piece that links one nucleotide to the next — the sugar–phosphate backbone.' },
        { key:'sugar', label:'Five-carbon sugar', formula:'ribose', atoms:[1,13,14,15,16,17],
          note:'A furanose: five-membered, unlike glucose’s six. Every nucleotide is phosphate + this sugar + a base.' },
        { key:'twooh', label:'The 2′–OH', formula:'–OH', atoms:[2,29],
          note:'This single hydroxyl is the whole difference between RNA and DNA. Remove it (deoxyribose) and the strand becomes far harder to break — which is why DNA is the archive.' },
        { key:'base', label:'Nitrogenous base', formula:'adenine', atoms:[8,9,10,11,12,18,19,20,21,22],
          note:'Two fused rings — a purine. The base is the letter; the phosphate and sugar are just the tape it is written on.' },
      ],
    },
  }, SELFNAME);
})(this);
