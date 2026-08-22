/* =============================================================================
 *  chain/check-chain.js — a linkage still builds the polymer it claims
 * =============================================================================
 *  Offline, dependency-free. Run from demos/:  node chain/check-chain.js
 *
 *  maltose and cellobiose carry torsions that were SOLVED rather than typed:
 *  tools/solve-linkage.js searched φ/ψ for the pair whose repeat reproduces a
 *  published helix, and `helix:` on each spec records which one. That makes the
 *  torsion a derived field, and a derived field goes stale — the same trap
 *  tools/bake-flat2d.js's output has a checker for.
 *
 *  Nothing about a stale torsion is visible. The disaccharide still renders
 *  correctly from every angle, still passes its `glycosidic:` and `stereo:`
 *  claims, still has the right formula. It is only wrong two hundred residues
 *  later, on a page nobody has built yet.
 *
 *  So: repeat the linkage, measure the screw, hold it to what the spec declares.
 * ========================================================================== */
'use strict';

const CR = require('../chain-repeat.js');
const { MOLECULES, SCALE } = require('../lib-node.js');

const TRIAD = ['O5','C1','C4'];
const TURN_TOL = 0.15;      // fraction; 6.26 against a stated 6 is the real fit
const RISE_TOL = 0.15;
let fails = 0;
const fail = m => { fails++; console.log(`   FAIL: ${m}`); };

const subjects = Object.entries(MOLECULES).filter(([, s]) => s && s.helix);
if (!subjects.length) { console.log('FAIL: no spec declares `helix:`'); process.exit(1); }

for (const [key, spec] of subjects) {
  console.log(`\n== ${key} → ${spec.helix.polymer}`);
  const h = spec.helix;
  let screw;
  try { screw = CR.screwOf(spec, TRIAD, 'A', 'B'); }
  catch (e) { fail(`cannot measure the linkage: ${e.message}`); continue; }

  const rise = screw.rise / SCALE;      // MOLECULES is scaled; helix: is in Å
  const dTurn = Math.abs(screw.perTurn - h.perTurn) / h.perTurn;
  const dRise = Math.abs(rise - h.rise) / h.rise;

  if (dTurn > TURN_TOL)
    fail(`repeats to ${screw.perTurn.toFixed(2)} residues/turn, but declares `
       + `${h.perTurn} (${h.src}). The torsions no longer build this polymer.`);
  else if (dRise > RISE_TOL)
    fail(`rises ${rise.toFixed(2)} Å per residue, but declares ${h.rise} Å (${h.src}).`);
  else
    console.log(`   OK: ${screw.perTurn.toFixed(2)} residues/turn, ${rise.toFixed(2)} Å rise `
      + `— declares ${h.perTurn} and ${h.rise}`);

  /* EXERCISE THE PATH THE PAGE USES. Measuring the screw alone leaves extend()
   * unrun, and that is where residues are selected by name — the step that once
   * silently dropped C6's two hydrogens from every chain because they were named
   * H6A1 rather than H61A. A checker that only measures would have passed it,
   * and did. */
  let a, b;
  try { a = CR.extend(spec, screw, 3, 'A'); b = CR.extend(spec, screw, 1, 'B'); }
  catch (e) { fail(e.message); continue; }
  if (a.names.length + b.names.length !== spec.atoms.length)
    fail(`residues A and B hold ${a.names.length}+${b.names.length} atoms, but the spec has `
       + `${spec.atoms.length}. Some atom belongs to neither, so the chain is missing it.`);
  else
    console.log(`   OK: residues partition all ${spec.atoms.length} atoms `
      + `(${a.names.length}+${b.names.length}), ${a.optH.length} optional-H per residue`);

  /* The two must not converge. If a future edit gave both sugars one pose again
   * they could each drift toward the other and still pass above; what the pair
   * exists to show is that these linkages build DIFFERENT chains. */
  const other = subjects.find(([k]) => k !== key);
  if (other) {
    const o = CR.screwOf(other[1], TRIAD, 'A', 'B');
    if (Math.abs(o.perTurn - screw.perTurn) / Math.max(o.perTurn, screw.perTurn) < 0.2)
      fail(`${key} and ${other[0]} repeat to nearly the same helix `
         + `(${screw.perTurn.toFixed(2)} vs ${o.perTurn.toFixed(2)}). A shared pose is how `
         + `starch stopped coiling before; the pair exists to differ.`);
  }
}

console.log('');
if (fails) { console.log(`FAIL: ${fails} broken chain claim(s)`); process.exit(1); }
console.log('PASS: every declared linkage still repeats into the polymer it names, '
  + 'and the two do not build the same chain');
