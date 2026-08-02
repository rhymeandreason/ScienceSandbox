#!/usr/bin/env node
/* =====================================================================
 *  bake-actin.js — reduce two large structures to the little the page needs.
 *
 *  9ZZI is 1.3 MB and 9JUS is 5 MB. Between them a student would download
 *  6.3 MB to see two rungs drawn as Ca tubes. Almost all of that is side
 *  chains the page never draws, and four more copies of a subunit that the
 *  filament's own screw operation can regenerate exactly.
 *
 *  So this keeps: ONE actin protomer, the screw that stacks it, and the Ca
 *  traces of 9JUS's villin and its actin trimer. Everything else is dropped.
 *
 *  Writes folding/data/actin.bin. Re-run after any change to actin.js's parsing or
 *  screw derivation; folding/tools/check-folding.js compares against a fresh bake.
 *
 *  Inputs, both committed, both from RCSB:
 *    folding/data/9ZZI.pdb   F-actin, ADP state, cryo-EM 2.06 A, 5 subunits
 *    folding/data/9JUS.pdb   villin bound to an actin trimer, X-ray 2.7 A
 *
 *  Run:  node folding/tools/bake-actin.js        (offline, no dependencies)
 * ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const Actin = require('../actin.js');

const HERE = path.join(__dirname, '..');   // demos/folding
const FIL = path.join(HERE, 'data/9ZZI.pdb');
const CPX = path.join(HERE, 'data/9JUS.pdb');
const OUT = path.join(HERE, 'data/actin.bin');

for (const f of [FIL, CPX])
  if (!fs.existsSync(f)) { console.error('missing ' + path.relative(HERE, f)); process.exit(1); }

const t0 = Date.now();

/* ---- the filament ---- */
const fil = Actin.parseCA(fs.readFileSync(FIL, 'utf8'), 'ABCDE');
const order = Object.keys(fil).sort();
const screws = [];
for (let i = 0; i + 1 < order.length; i++)
  screws.push(Actin.screwOf(fil[order[i]], fil[order[i + 1]]));

console.log(`filament ${path.basename(FIL)}: ${order.length} deposited subunits, ${fil[order[0]].length} Ca each`);
screws.forEach((s, i) =>
  console.log(`  ${order[i]}->${order[i+1]}   rise ${s.rise.toFixed(2)} A   twist ${s.twist.toFixed(2)} deg`));
const rise = screws.reduce((s, x) => s + x.rise, 0) / screws.length;
const twist = screws.reduce((s, x) => s + x.twist, 0) / screws.length;
console.log(`  mean rise ${rise.toFixed(2)} A (lit ~${Actin.RISE_REF}), ` +
            `twist ${twist.toFixed(2)} deg (lit ~${Actin.TWIST_REF})`);
console.log(`  extending to ${Actin.SUBUNITS} subunits = ` +
            `${(rise * (Actin.SUBUNITS - 1) / 10).toFixed(0)} nm, one crossover repeat`);

/* The first step is the one used, not an average of the four: it is a single
   measured operation rather than a blend, and the four agree to 0.024 A
   anyway, so averaging would buy nothing and cost exactness. */
const screw = Object.assign({}, screws[0], { rise, twist });

/* ---- the complex ---- */
/* 9JUS holds two copies of (actin trimer + villin). One is enough; chains
   f/g/p and v are the first. */
const cpx = Actin.parseCA(fs.readFileSync(CPX, 'utf8'), 'fgpv');
const complexActin = ['f','g','p'].flatMap(c => (cpx[c] || []).map(a => a.p));
const complexVillin = (cpx.v || []).map(a => a.p);
console.log(`complex ${path.basename(CPX)}: villin ${complexVillin.length} Ca, ` +
            `actin trimer ${complexActin.length} Ca`);

const buf = Buffer.from(Actin.encode({
  screw, subunit: fil[order[0]].map(a => a.p), complexActin, complexVillin }));
fs.writeFileSync(OUT, buf);
console.log(`\nbaked in ${Date.now() - t0} ms`);
console.log(`  wrote ${path.relative(HERE, OUT)} (${(buf.length / 1024).toFixed(0)} KB, ` +
            `from ${((fs.statSync(FIL).size + fs.statSync(CPX).size) / 1048576).toFixed(1)} MB of input)`);
