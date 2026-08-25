#!/usr/bin/env node
/* =====================================================================
 *  check-water.js — the phase-change points water-lab.html prints
 *
 *    node tools/check-water.js
 *
 *  water-lab's solvent step renders "freezes −13°C · boils 104°C" as text,
 *  and those numbers come out of watersim.js's `thermo()`. A typed number is
 *  a claim nothing checks; these are computed, so what has to be checked is
 *  the computation. Every assertion below is a colligative fact a Bio 101
 *  student is asked to accept from the screen:
 *
 *    · pure water freezes at 0°C and boils at 100°C
 *    · dissolved salt depresses the freezing point (ΔTf = Kf·m, Kf = 1.86)
 *      and elevates the boiling point, in proportion to PARTICLE count —
 *      NaCl gives two, which is why it beats sugar per gram
 *    · the depression floors at the −21°C NaCl/water eutectic, because below
 *      that no amount of salt keeps brine liquid
 *    · salt water is less frozen than pure water at the same temperature
 *
 *  `thermo()` is deliberately reachable without THREE and without a scene so
 *  this file can be offline, dependency-free, and run on every commit.
 * ===================================================================== */
const {thermo} = require('../water/watersim.js');

let fails = 0;
function check(label, ok, got) {
  if (ok) { console.log(`  ok    ${label}`); return; }
  fails++; console.log(`  FAIL  ${label}${got === undefined ? '' : ` — got ${got}`}`);
}
// molality m → the particle count thermo() wants, for a given number of waters
const particles = (m, nWater) => m * nWater * 0.018;

console.log('\n== pure water');
let p = thermo({temperature:0, tempEnabled:true, freezeEnabled:true});
check('freezes at 0°C', p.dTf === 0 && p.fz === 1, `dTf=${p.dTf} fz=${p.fz}`);
check('boils at 100°C', p.dTb === 0, `dTb=${p.dTb}`);
check('liquid at 22°C', thermo({temperature:22, tempEnabled:true, freezeEnabled:true}).fz === 0);
check('not boiling at 99°C', thermo({temperature:99, tempEnabled:true}).evapProb === 0);
check('boiling at 100°C', thermo({temperature:100, tempEnabled:true}).evapProb > 0);

console.log('\n== dissolved salt moves both points');
const N = 100;
p = thermo({nWater:N, nParticles:particles(1, N)});
check('1 m: ΔTf = 1.86°C (Kf·m)', Math.abs(p.dTf - 1.86) < 0.01, p.dTf.toFixed(3));
check('1 m: ΔTb = 0.51°C (Kb·m)', Math.abs(p.dTb - 0.512) < 0.01, p.dTb.toFixed(3));
const p2 = thermo({nWater:N, nParticles:particles(2, N)});
check('depression scales with concentration', Math.abs(p2.dTf - 2*p.dTf) < 0.01);
check('boiling point rises as freezing point falls', p2.dTb > p.dTb);

console.log('\n== the eutectic floors it');
const sat = thermo({nWater:N, nParticles:particles(40, N)});
check('ΔTf caps at the −21°C NaCl eutectic', sat.dTf === 21, sat.dTf);

console.log('\n== what the student is asked to SEE');
// Salt on an icy road, which is the whole reason the lesson has a salt step:
// at one temperature, one beaker is ice and the other is still liquid. Tested
// AT 0°C rather than below it — the freeze ramp saturates a few degrees down,
// and a claim that both are "fully frozen" would pass while saying nothing.
const pure  = thermo({temperature:0, tempEnabled:true, freezeEnabled:true});
const brine = thermo({temperature:0, tempEnabled:true, freezeEnabled:true,
                      nWater:N, nParticles:particles(2, N)});
check('at 0°C pure water is frozen', pure.fz === 1, pure.fz.toFixed(2));
check('at 0°C brine is not', brine.fz === 0, brine.fz.toFixed(2));
check('freezing needs the freeze toggle', thermo({temperature:-40, tempEnabled:true}).fz === 0);
check('temperature does nothing until enabled',
      thermo({temperature:-40, freezeEnabled:true}).fz === 0);

console.log(fails
  ? `\nFAIL: ${fails} phase-change claim(s) no longer hold\n`
  : '\nPASS: freezing and boiling points, colligative shift, and the eutectic cap all hold\n');
process.exit(fails ? 1 : 0);
