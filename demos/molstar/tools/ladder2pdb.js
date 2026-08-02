#!/usr/bin/env node
/* =====================================================================
 *  ladder2pdb.js — the zoom-out ladder's big rungs, as PDB.
 *
 *  STAGE 4 of the Mol* evaluation. Rungs 0-2 are already PDB files on disk
 *  (1VII, the AlphaFold model), so only the two derived rungs need writing:
 *
 *    rung 3  the 13-subunit actin filament, built by repeating the screw
 *            ActinLib measured from 9ZZI itself
 *    rung 4  the coda — villin gripping an actin trimer (9JUS), Ca traces
 *
 *  Both come out of folding/data/actin.bin, which tools/bake-actin.js
 *  reduced from 6.1 MB of deposited coordinates to 27 KB. This does not
 *  re-derive anything: the screw, the protomer and the complex all come
 *  out of that file exactly as folding-lab.html reads them.
 *
 *  CA-ONLY, and that is not a shortcut being hidden. actin.bin stores Ca
 *  traces because rungs 3-4 exist to convey SIZE — at 40 nm a student
 *  cannot see a side chain, and the page says so. Any viewer will draw a
 *  backbone trace from this; none can draw detail that was never baked.
 *
 *  ONLY FIVE SUBUNITS WERE OBSERVED. Subunits 6-13 are symmetry copies
 *  placed by the screw. See actin.js's header for why that is licensed and
 *  folding/tools/check-folding.js for the assertion that pins it.
 *
 *  Run:  node molstar/tools/ladder2pdb.js       (offline, no dependencies)
 * ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const ActinLib = require('../../folding/actin.js');

const HERE = path.join(__dirname, '..');
const FOLD = path.join(HERE, '..', 'folding');
const BIN = path.join(FOLD, 'data', 'actin.bin');
const OUT_FIL = path.join(HERE, 'data', 'actin-filament.pdb');
const OUT_CODA = path.join(HERE, 'data', 'villin-actin-coda.pdb');

if (!fs.existsSync(BIN)) { console.error('missing folding/data/actin.bin'); process.exit(1); }

const raw = fs.readFileSync(BIN);
const d = ActinLib.decode(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));

/* decode() hands back bare [x,y,z]; extend() wants the {p} shape parseCA
   produces. Wrapping here rather than changing actin.js, which the lesson
   page depends on. */
const chains = ActinLib.extend(d.subunit.map(p => ({ p })), d.screw, ActinLib.SUBUNITS);

const pad = (s, n) => String(s).padStart(n);
const CHAIN_IDS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/* Ca-only backbone. ALA rather than GLY so a viewer that colours by residue
   type does not paint the whole filament as glycine, which would be a claim
   about the sequence that this file is not making. */
function caLine(serial, chainId, resSeq, xyz) {
  return 'ATOM  ' + pad(serial, 5) + '  CA  ALA ' + chainId + pad(resSeq, 4) + '    ' +
         pad(xyz[0].toFixed(3), 8) + pad(xyz[1].toFixed(3), 8) + pad(xyz[2].toFixed(3), 8) +
         '  1.00  0.00' + ' '.repeat(10) + ' C';
}

function write(file, header, groups) {
  const out = header.map(h => 'REMARK   1 ' + h);
  let serial = 0;
  groups.forEach((pts, gi) => {
    const id = CHAIN_IDS[gi % CHAIN_IDS.length];
    pts.forEach((p, i) => out.push(caLine(++serial, id, i + 1, p)));
    out.push('TER   ' + pad(++serial, 5) + '      ALA ' + id + pad(pts.length, 4));
  });
  out.push('END');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const text = out.join('\n') + '\n';
  fs.writeFileSync(file, text);
  return { atoms: serial, kb: text.length / 1024 };
}

const fil = write(OUT_FIL, [
  'F-ACTIN FILAMENT, CA TRACE — RUNG 4 OF folding-lab.html ZOOM-OUT',
  'FROM folding/data/actin.bin VIA molstar/tools/ladder2pdb.js',
  'DEPOSITED SOURCE: 9ZZI (CRYO-EM, 2.06 A) — FIVE SUBUNITS OBSERVED.',
  'CHAINS A-E CORRESPOND TO THE DEPOSITED SUBUNITS. CHAINS F-M ARE',
  'SYMMETRY COPIES PLACED BY THE HELICAL SCREW MEASURED FROM THE FILE',
  'ITSELF (RISE 27.60 A, TWIST -166.60 DEG). THEY ARE NOT OBSERVED.',
], chains);

/* The coda is two separate traces and must stay separate: the point of 9JUS
   is that villin and actin are DIFFERENT molecules in contact, and merging
   them into one chain would draw a covalent link that does not exist. */
const coda = write(OUT_CODA, [
  'VILLIN GRIPPING AN ACTIN TRIMER, CA TRACE — RUNG 5 (CODA)',
  'DEPOSITED SOURCE: 9JUS (X-RAY, 2.7 A). MEASURED, NOT PREDICTED.',
  'CHAIN A IS ACTIN; CHAIN B IS VILLIN — AND THAT VILLIN IS FROM A',
  'DEEP-SEA VENT WORM, BECAUSE NO VERTEBRATE VILLIN-ACTIN STRUCTURE',
  'EXISTS. THE SPECIES JUMP IS STATED ON THE PAGE AND ASSERTED IN',
  'folding/tools/check-folding.js.',
], [d.complexActin, d.complexVillin]);

const span = arr => {
  const z = arr.flat().map(p => p[2]);
  return Math.max(...z) - Math.min(...z);
};
console.log(`filament: ${ActinLib.SUBUNITS} subunits x ${chains[0].length} CA ` +
            `= ${fil.atoms} atoms, ${span(chains).toFixed(0)} A long (${fil.kb.toFixed(0)} KB)`);
console.log(`coda:     ${d.complexActin.length} actin + ${d.complexVillin.length} villin CA ` +
            `= ${coda.atoms} atoms (${coda.kb.toFixed(0)} KB)`);
