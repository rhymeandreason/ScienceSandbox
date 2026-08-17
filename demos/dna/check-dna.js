#!/usr/bin/env node
/* =====================================================================
 *  check-dna.js — the assertions behind dna/pairing.js
 *
 *  WHY THIS EXISTS. dna-lab draws a conclusion — these two bases pair,
 *  those two do not — from geometry this module solves. A wrong answer
 *  does not look wrong: two bases sit together, dashed lines appear, and
 *  the page states a bond count with complete confidence. Every failure
 *  this file guards against shipped at some point during the build and
 *  none of them was visible on screen.
 *
 *  THE SYMMETRY CHECK IS THE IMPORTANT ONE. Pairing is a relationship
 *  between two molecules, so solving it from A must give the same answer
 *  as solving it from B. It did not: picking each acceptor's lone pair by
 *  "whichever points furthest from the centroid" chose the wrong ear on a
 *  carbonyl oxygen, so C→G found two bonds and a 1.5 Å clash while G→C
 *  found three and none. On the page that read as guanine swinging 30°
 *  into a worse pose when the student dragged it — the same pair, two
 *  answers, depending on which base happened to be held still.
 *
 *  Run:  node dna/check-dna.js
 * ===================================================================== */
'use strict';
const path = require('path');
const MolLib = require(path.join(__dirname, '..', 'lib-node.js'));
const { Pairing } = require(path.join(__dirname, 'pairing.js'));

const S = MolLib.SCALE, M = MolLib.MOLECULES;
// pairing.js answers in the units it is given, and registered specs have had
// SCALE applied. Unscale so the ångström constants inside it mean what they say.
const un = s => ({ ...s, atoms: s.atoms.map(a => ({ el:a.el, pos:a.pos.map(v => v/S) })) });
const solve = (a, b) => Pairing.pairing(un(M[a]), un(M[b]));

let fails = 0, checks = 0;
const ok = (cond, msg) => { checks++; if(!cond){ fails++; console.log('  FAIL  ' + msg); } };
const head = t => console.log('\n' + t + '\n' + '-'.repeat(t.length));

/* ---- the two pairs, and the counts that are the lesson ---------------- */
head('the pairs that hold');
for(const [a, b, want] of [['adenine','thymine',2], ['guanine','cytosine',3]]){
  const r = solve(a, b);
  ok(r.ok, `${a}–${b} solves`);
  ok(r.asked === want,
     `${a}–${b} declares ${want} hydrogen bonds (got ${r.asked})`);
  ok(r.count === want,
     `${a}–${b}: kit/hbond.js FINDS all ${want} in the solved pose (got ${r.count})`);
  ok(r.clash == null,
     `${a}–${b} has no non-bonded contact under 3.4 Å (got ${r.clash})`);
  // A pose that only fits by compromising is not the pose.
  ok(r.rms < 0.3, `${a}–${b} fit is tight (rms ${r.rms.toFixed(3)} Å)`);
}

/* ---- and the four that do not ----------------------------------------- */
head('the combinations that do not');
for(const [a, b] of [['adenine','guanine'], ['adenine','cytosine'],
                     ['guanine','thymine'], ['thymine','cytosine']]){
  const r = solve(a, b);
  const refused = !r.ok || r.count < 2 || r.clash != null;
  ok(refused, `${a}–${b} is refused (found ${r.count}, clash ${r.clash})`);
}

/* ---- SYMMETRY: the same pair from either side ------------------------- */
head('pairing is a relationship, not a direction');
// For a pair that HOLDS, both directions must agree on everything the page
// shows — this is the guard on the bug that made guanine swing.
for(const [a, b] of [['adenine','thymine'], ['guanine','cytosine']]){
  const f = solve(a, b), r = solve(b, a);
  ok(f.count === r.count,
     `${a}/${b}: same bond count either way (${f.count} vs ${r.count})`);
  ok((f.clash == null) === (r.clash == null),
     `${a}/${b}: same verdict on clash either way (${f.clash} vs ${r.clash})`);
  // Independent fits, so not bit-identical; they must agree on the chemistry
  // and closely on the geometry.
  ok(Math.abs(f.rms - r.rms) < 0.1,
     `${a}/${b}: fits agree (rms ${f.rms.toFixed(3)} vs ${r.rms.toFixed(3)})`);
}

// For a pair that does NOT hold, only the VERDICT has to be symmetric. The
// pose behind it is a compromise with rings driven through each other, and
// how many stray bonds survive in that wreck is not a claim worth asserting —
// A–G comes out with one incidental bond one way round and none the other.
for(const [a, b] of [['adenine','guanine'], ['adenine','cytosine'],
                     ['guanine','thymine'], ['thymine','cytosine']]){
  const held = x => x.ok && x.count >= 2 && x.clash == null;
  ok(held(solve(a,b)) === held(solve(b,a)),
     `${a}/${b}: refused from both sides, not just one`);
}

/* ---- the pairs are the same width ------------------------------------- */
head('a rung is a rung');
{
  // Not the C1′–C1′ claim — there are no sugars in step 1 — but the two real
  // pairs must at least come out comparable, and a purine–purine must not.
  const at = solve('adenine','thymine').span;
  const gc = solve('guanine','cytosine').span;
  ok(Math.abs(at - gc) < 1.0,
     `A–T and G–C span within 1 Å of each other (${at.toFixed(2)} vs ${gc.toFixed(2)})`);
}

/* =====================================================================
 *  THE BAKED B-DNA PARAMETERS
 * =====================================================================
 *  dna/data/helix.json is measured off 1BNA by dna/bake-helix.js and will feed
 *  the ladder in step 4. Two things can go wrong with a baked artefact and
 *  neither is visible in the page that plays it: it goes STALE against the
 *  structure it claims to come from, and it drifts out of the range that makes
 *  it B-DNA at all. Both are checked here.
 * ===================================================================== */
head('baked B-DNA parameters (1BNA)');
{
  const fs = require('fs');
  const { measure, OUT } = require(path.join(__dirname, 'bake-helix.js'));
  const fresh = measure();
  const baked = JSON.parse(fs.readFileSync(OUT, 'utf8'));
  ok(JSON.stringify(fresh) === JSON.stringify(baked),
     'dna/data/helix.json is what bake-helix.js produces now (re-run it)');

  // Ranges, against the published description of B-DNA. Wide on purpose: this
  // is one crystal dodecamer, and the point is to catch a broken measurement,
  // not to re-assert the textbook to three figures.
  const band = (v, lo, hi, what) =>
    ok(v >= lo && v <= hi, `${what} is ${v} — outside the B-DNA range ${lo}–${hi}`);
  band(baked.rise.mean, 3.2, 3.7, 'rise');
  band(baked.twist.mean, 30, 38, 'twist');
  band(baked.bpPerTurn, 9.5, 11.5, 'base pairs per turn');
  band(Math.abs(baked.propeller.mean), 5, 25, 'propeller twist magnitude');
  band(baked.c1c1.mean, 10.0, 10.9, "C1'–C1'");
  // Propeller has a SIGN, and it is negative for right-handed B-DNA. A build
  // that lost it would draw a plausible helix twisted the wrong way.
  ok(baked.propeller.mean < 0, 'propeller twist is negative (right-handed B-DNA)');

  /* THE CROSS-CHECK: our idealised pair against the real one. dna/pairing.js
   * solves a pair from declared donors and acceptors with every hydrogen bond
   * at the same target length and both bases exactly coplanar. The real thing
   * is neither. This measures the cost of that idealisation instead of letting
   * it go unnoticed — and it is the number step 4 will have to reconcile, since
   * a ladder built from our pairs will be slightly wider than B-DNA's. */
  for(const [pur, pyr] of [['adenine','thymine'], ['guanine','cytosine']]){
    const r = solve(pur, pyr);
    const A = un(M[pur]).atoms[M[pur].names.indexOf('N9')].pos;
    const B = r.moved.atoms[M[pyr].names.indexOf('N1')].pos;
    const d = Math.hypot(A[0]-B[0], A[1]-B[1], A[2]-B[2]);
    const off = d - baked.glycoN.mean;
    ok(Math.abs(off) < 0.6,
       `${pur}–${pyr} N9–N1 is ${d.toFixed(2)} Å vs 1BNA's ${baked.glycoN.mean} `
       + `(${off > 0 ? '+' : ''}${off.toFixed(2)} Å) — the idealisation has drifted`);
  }
}

console.log(`\n${checks - fails}/${checks} checks passed`);
if(fails){ console.log(`${fails} FAILED`); process.exit(1); }
