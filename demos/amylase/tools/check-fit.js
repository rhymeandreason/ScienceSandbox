#!/usr/bin/env node
/* =====================================================================
 *  check-fit.js — does the α-1,4 chain lie in the trough, and does β-1,4?
 *
 *  The measurement amylase-test.html prints, run offline against the same
 *  amylase/fit.js the page draws with. Acarbose scored against its own
 *  crystal pose is the control row: it is the number that says what
 *  "fits" looks like in these units.
 *
 *  Run:  node amylase/tools/check-fit.js
 * ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const CR = require('../../lib/chain-repeat.js');
const { MOLECULES, SCALE } = require('../../lib/lib-node.js');
const Fit = require('../fit.js');

const DATA = path.join(__dirname, '..', 'data');
const J = JSON.parse(fs.readFileSync(path.join(DATA, 'amylase.json'), 'utf8'));
const PDB = fs.readFileSync(path.join(DATA, '1OSE.pdb'), 'utf8');

const TRIAD = ['O5','C1','C4'];
const N = 12;
const SUBJECTS = [
  { key:'maltose',    label:'starch    α-1,4' },
  { key:'cellobiose', label:'cellulose β-1,4' },
];

/* The protein, in the JSON's frame — heavy atoms, altloc A or blank. */
function protein() {
  const out = [];
  for (const line of PDB.split('\n')) {
    if (!line.startsWith('ATOM') && !(line.startsWith('HETATM') &&
        line.slice(17,20).trim() === 'PCA')) continue;
    const alt = line[16];
    if (alt !== ' ' && alt !== 'A') continue;
    const el = (line.slice(76,78).trim() || line.slice(12,14).trim()[0]).toUpperCase();
    if (el === 'H') continue;
    out.push({ name: line.slice(17,20).trim(), num: +line.slice(22,26),
               atom: line.slice(12,16).trim(),
               p: [+line.slice(30,38) - J.centre[0],
                   +line.slice(38,46) - J.centre[1],
                   +line.slice(46,54) - J.centre[2]] });
  }
  return out;
}

/* Acarbose's three glycosidic oxygens, in order along the ligand: the O4 of
   units 1, 2 and 3, each bonded to the next unit's C1 (the file's own LINK
   records). Three points, which is what fixes a rigid body. */
function anchors() {
  return [1,2,3].map(num => {
    const a = J.ligand.atoms.find(x => x.num === num && x.atom === 'O4');
    if (!a) throw new Error(`no O4 on ligand residue ${num}`);
    return a.p;
  });
}

/* A polymer built from one measured linkage, in Ångströms. */
function build(key) {
  const spec = MOLECULES[key];
  const screw = CR.screwOf(spec, TRIAD, 'A', 'B');
  const c = CR.extend(spec, screw, N, 'A');
  const iO4 = c.index('O4'), iHO4 = c.index('HO4'), iO1 = c.index('O1');
  const residues = c.residues.map(r => r.map(p => p.map(v => v / SCALE)));
  /* Every residue but the first loses the free C4 hydroxyl — the previous
     linkage is there instead. glucose-chains-test.html draws it that way,
     and a clash counted on an atom that is not in the polymer is invented. */
  const heavy = residues.map((r, n) => {
    const drop = new Set(n === 0 ? [] : [iO4, iHO4]);
    return c.el.map((e, i) => (e !== 'H' && !drop.has(i)) ? i : -1).filter(i => i >= 0);
  });
  return { chain: { residues, bridge: iO1, heavy }, screw, spec };
}

function main() {
  const P = protein();
  const grid = Fit.index(P, 6);
  const A = anchors();

  console.log(`\n  ${P.length} protein heavy atoms · anchors are acarbose's ` +
              `three glycosidic oxygens\n`);

  /* THE CONTROL. The ligand in its deposited pose, scored by the same
     function — no superposition, because it is already where it belongs. */
  const lig = J.ligand.atoms.map(a => a.p);
  const ctrl = Fit.clash(lig, grid);
  const row = (label, atoms, severe, close, min, extra) =>
    console.log(`  ${label.padEnd(20)} ${String(atoms).padStart(3)} atoms   ` +
                `severe ${String(severe).padStart(3)}   under 3 Å ${String(close).padStart(3)}   ` +
                `min ${min.toFixed(2)} Å   ${extra}`);
  row('acarbose  crystal', ctrl.atoms, ctrl.severe, ctrl.close, ctrl.min, 'the control');

  const results = { control: ctrl, chains: {} };
  for (const s of SUBJECTS) {
    const { chain, screw } = build(s.key);
    const best = Fit.place(chain, A, grid);
    row(s.label + '  in site', best.site.atoms, best.site.severe, best.site.close,
        best.site.min, `anchors ${best.rmsd.toFixed(2)} Å rmsd, worst ${best.site.worst}`);
    row(s.label + '  next unit', best.flank.atoms, best.flank.severe, best.flank.close,
        best.flank.min, 'the residues either side of the window');
    row(s.label + '  the rest', best.tail.atoms, best.tail.severe, best.tail.close,
        best.tail.min, `${best.window.length} residues in the trough, ` +
        `${N - best.window.length} spiralling off`);
    results.chains[s.key] = {
      label: s.label, rmsd: best.rmsd, start: best.start, dir: best.dir,
      window: best.window,
      perTurn: +screw.perTurn.toFixed(2), rise: +(screw.rise/SCALE).toFixed(2),
      site: best.site, flank: best.flank, tail: best.tail, all: best.clash,
    };
  }

  console.log('');
  let bad = 0;
  const ok = (cond, msg) => { console.log(`  ${cond?'ok  ':'FAIL'}  ${msg}`); if(!cond) bad++; };
  const st = results.chains.maltose, ce = results.chains.cellobiose;

  ok(ctrl.severe === 0,
     `the deposited ligand has no severe overlap — the yardstick is sound`);
  ok(st.rmsd < 1.5,
     `the α-1,4 chain's own bridging oxygens land on acarbose's ` +
     `(${st.rmsd.toFixed(2)} Å rmsd): the same three atoms are in the same places`);
  ok(ce.site.severe >= st.site.severe,
     `in the site itself, β-1,4 overlaps the protein on ${ce.site.severe} atoms ` +
     `against α-1,4's ${st.site.severe}`);
  ok(ce.flank.severe >= st.flank.severe,
     `and on the residues either side of it: ${ce.flank.severe} against ` +
     `α-1,4's ${st.flank.severe}`);
  ok(ce.site.min < st.site.min,
     `its worst overlap in the site is deeper: ${ce.site.min} Å against ` +
     `${st.site.min} Å between heavy-atom centres`);

  fs.writeFileSync(path.join(DATA, 'fit.json'), JSON.stringify(results, null, 2));
  console.log(bad ? `\nFAIL: ${bad} check(s)\n` : `\nPASS: wrote data/fit.json\n`);
  process.exit(bad ? 1 : 0);
}
main();
