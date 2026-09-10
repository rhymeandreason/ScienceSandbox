#!/usr/bin/env node
/* =============================================================================
 *  macromolecule/check-nucleoside.js
 * =============================================================================
 *  The N-glycosidic bond is MEASURED off a deposited nucleotide rather than
 *  built from angles, so what this asserts is that the measurement still has
 *  something to measure. Three things, each of which would render perfectly:
 *
 *   1. THE REFERENCE AGREES ABOUT THE ATOM THAT LEAVES. A free base carries the
 *      ring proton the bond displaces and its nucleotide does not — adenine has
 *      H9, dATP's adenine has none. Two records, baked by different code,
 *      agreeing about exactly this reaction. If a re-bake gave the nucleotide
 *      that proton back, the pose would still solve and the bond would be drawn
 *      through an atom that is in the way.
 *   2. A PURINE BONDS THROUGH N9 AND A PYRIMIDINE THROUGH N1. Swap them and a
 *      pyrimidine finds no N9 at all, while a purine finds an N1 that is on the
 *      wrong ring and builds a nucleoside nobody has made.
 *   3. EVERY PAIR SHEDS ONE WATER, off the roles, and lands a bond at a real
 *      length. The sugar gives its whole anomeric hydroxyl, the base one proton.
 *
 *  `node macromolecule/check-nucleoside.js`, offline, no dependencies.
 * ========================================================================== */
'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '..');
let fails = 0;
const fail = m => { fails++; console.log(`  FAIL  ${m}`); };
const is = (c, m) => { if (c) console.log(`  ok    ${m}`); else fail(m); };

global.window = global;
const MolLib = require(path.join(ROOT, 'lib/lib-node.js'));
global.MolLib = MolLib.MolLib || MolLib;
const take = (f, n) => { const m = require(path.join(ROOT, f)); global[n] = m[n] || m; return global[n]; };
take('chain/frame.js', 'CondenseFrame');
const S = take('macromolecule/spec.js', 'MacroSpec');
take('macromolecule/glycosidic.js', 'Glycosidic');
const N = take('macromolecule/nucleoside.js', 'Nucleoside');
const M = global.MolLib.MOLECULES, SC = global.MolLib.SCALE;
const un = (sp, k) => Object.assign({}, sp, { key: k, view: null,
  atoms: sp.atoms.map(a => ({ el: a.el, pos: a.pos.map(v => v / SC) })) });
const lib = {}; ['dATP', 'dGTP', 'dTTP', 'dCTP'].forEach(k => { lib[k] = un(M[k], k); });

console.log('\n== 1. the reference disagrees with the free base about one atom, and it is the right one');
for (const [b, R] of Object.entries(N.REF)) {
  const base = M[b], nt = M[R.via];
  const role = S.role(base, 'glyco');
  const hName = base.names[role.leaves[0]];
  is(base.names.indexOf(hName) >= 0 && nt.names.indexOf(hName) < 0,
     `${b} carries ${hName} and ${R.via} does not — the proton the bond displaces`);
  is(nt.names.indexOf(R.n) >= 0 && base.names.indexOf(R.n) >= 0,
     `both carry ${R.n}, the nitrogen that bonds`);
}

console.log('\n== 2. a purine bonds through N9 and a pyrimidine through N1');
for (const [b, R] of Object.entries(N.REF)) {
  const wrong = R.kind === 'purine' ? 'N1' : 'N9';
  is(R.n === (R.kind === 'purine' ? 'N9' : 'N1'), `${b} (${R.kind}) bonds through ${R.n}`);
  /* A pyrimidine has no N9 at all, so the wrong table entry would fail loudly.
     A purine HAS an N1 — on the other ring — so that one would not, which is
     why the kind is declared rather than inferred. */
  if (R.kind === 'pyrimidine')
    is(M[b].names.indexOf(wrong) < 0, `${b} has no ${wrong} to be aimed at by mistake`);
  else
    is(M[b].names.indexOf(wrong) >= 0,
       `${b} does have an ${wrong}, on its other ring — so the kind must be declared, not guessed`);
}

console.log('\n== 3. every base condenses onto deoxyribose, shedding one water');
const sugar = un(M.deoxyribose, 'deoxyribose');
for (const b of Object.keys(N.REF)) {
  const base = un(M[b], b);
  const p = N.pose(sugar, base, lib);
  if (!p) { fail(`${b}: pose() returned nothing`); continue; }
  const c = {};
  S.role(sugar, 'c1').leaves.forEach(i => c[sugar.atoms[i].el] = (c[sugar.atoms[i].el] || 0) + 1);
  S.role(base, 'glyco').leaves.forEach(i => c[base.atoms[i].el] = (c[base.atoms[i].el] || 0) + 1);
  const sheds = Object.keys(c).sort().map(e => e + (c[e] > 1 ? c[e] : '')).join('');
  is(sheds === 'H2O', `${b} sheds ${sheds}`);
  /* A C–N single bond is about 1.47 A and this is read off the record, so the
     window is wide enough to pass a real measurement and narrow enough to fail
     a frame that has collapsed or been mis-matched. */
  is(p.length > 1.3 && p.length < 1.6, `${b}: ${p.link} measures ${p.length.toFixed(3)} A`);
}

console.log('\n== 4. a sugar with no base, and a base with no sugar, are refused');
is(!N.routeFor('glucose', 'adenine'), 'glucose is not a nucleoside sugar');
is(!N.routeFor('deoxyribose', 'glucose'), 'glucose is not a base');

if (fails) { console.log(`\nFAIL: ${fails} problem(s)\n`); process.exit(1); }
console.log('\nPASS: every base condenses onto deoxyribose through the nitrogen its '
  + 'kind uses, shedding one water, at a bond the deposited nucleotide measures.\n');
