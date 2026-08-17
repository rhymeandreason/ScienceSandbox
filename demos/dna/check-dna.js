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

/* =====================================================================
 *  THE LADDER AND THE HELIX ARE THE SAME MOLECULE
 * =====================================================================
 *  Step 4's argument only works if the untwisted pose is this dodecamer with
 *  one number set to zero — not a drawing of a ladder. Three things have to
 *  hold, and none of them is visible on screen: the helix pose must reproduce
 *  the parameters measured independently by bake-helix.js, the ladder pose
 *  must differ from it in twist ALONE, and every base pair must be rigid
 *  between them.
 * ===================================================================== */
head('the ladder is the helix, untwisted');
{
  const fs = require('fs');
  const { bake, OUT:LOUT } = require(path.join(__dirname, 'bake-ladder.js'));
  const fresh = bake();
  // The baked file is a browser script that assigns window.BDNA — that is the
  // whole point of baking to .js rather than JSON (no runtime fetch, no build
  // step). Give it the global it expects and load it as the page would.
  global.window = global.window || {};
  require(path.join(__dirname, 'data', 'bdna.js'));
  const D = global.window.BDNA;
  ok(JSON.stringify(fresh) === JSON.stringify(D),
     'dna/data/bdna.js is what bake-ladder.js produces now (re-run it)');

  const sub2=(a,b)=>a.map((v,i)=>v-b[i]);
  const len2=a=>Math.hypot(...a);
  const dot2=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
  const cross2=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const unit2=a=>{const l=len2(a); return a.map(v=>v/l);};
  const helixAt = (p,q) => p.origin.map((o,i) =>
    o + q[0]*p.basis[0][i] + q[1]*p.basis[1][i] + q[2]*p.basis[2][i]);
  const ladderAt = (p,q) => [p.ladder[0]+q[0], p.ladder[1]+q[1], p.ladder[2]+q[2]];

  const measure = pose => {
    const O = D.pairs.map(p => pose(p,[0,0,0]));
    const X = D.pairs.map(p => unit2(sub2(pose(p,[1,0,0]), pose(p,[0,0,0]))));
    const Y = [0,1,0], rise = [], tw = [];
    for(let k = 2; k + 1 < D.pairs.length - 2; k++){
      rise.push(dot2(sub2(O[k+1],O[k]), Y));
      const flat = v => unit2(sub2(v, Y.map(y => y*dot2(v,Y))));
      const u1 = flat(X[k]), u2 = flat(X[k+1]);
      tw.push(Math.atan2(dot2(cross2(u1,u2),Y), dot2(u1,u2)) * 180/Math.PI);
    }
    const m = x => x.reduce((s,v)=>s+v,0)/x.length;
    return { rise:m(rise), twist:m(tw),
             offAxis:Math.max(...O.map(o => Math.hypot(o[0], o[2]))) };
  };

  const h = measure(helixAt), l = measure(ladderAt);
  // The helix pose is a re-framing of the deposited coordinates, so it must
  // still measure like the deposited coordinates did.
  const helixJson = JSON.parse(fs.readFileSync(
    path.join(__dirname, 'data', 'helix.json'), 'utf8'));
  ok(Math.abs(h.twist - helixJson.twist.mean) < 0.5,
     `helix pose twist ${h.twist.toFixed(2)}° matches bake-helix's `
     + `${helixJson.twist.mean}° (independent measurement)`);
  ok(Math.abs(h.rise - helixJson.rise.mean) < 0.05,
     `helix pose rise ${h.rise.toFixed(3)} Å matches ${helixJson.rise.mean}`);

  // …and the ladder differs in TWIST ONLY.
  ok(Math.abs(l.twist) < 0.01, `ladder has no twist left (${l.twist.toFixed(3)}°)`);
  ok(Math.abs(l.rise - h.rise) < 1e-6,
     `ladder keeps the helix's rise exactly (${l.rise.toFixed(3)} vs ${h.rise.toFixed(3)})`);
  ok(l.offAxis < 1e-6, `ladder is straight — no pair off the axis (${l.offAxis.toFixed(4)} Å)`);
  ok(h.offAxis > 3, `the helix is NOT straight (${h.offAxis.toFixed(2)} Å) — poses differ`);

  // RIGIDITY. If any bond changes length between the poses, the page is
  // deforming molecules to make its point rather than rearranging them.
  let worst = 0;
  for(const p of D.pairs) for(const [m,n] of p.bonds){
    const dh = len2(sub2(helixAt(p,p.atoms[m].p),  helixAt(p,p.atoms[n].p)));
    const dl = len2(sub2(ladderAt(p,p.atoms[m].p), ladderAt(p,p.atoms[n].p)));
    worst = Math.max(worst, Math.abs(dh - dl));
  }
  // Tolerance is set by the bake, not by the maths: coordinates are stored to
  // 0.001 Å and basis vectors to 1e-6, so the two placements agree to about a
  // microångström. Anything larger means a pair is being deformed, not moved.
  ok(worst < 1e-4,
     `every bond is the same length in both poses (worst ${worst.toExponential(1)} Å)`);

  /* EVERY PAIR MUST FACE THE SAME WAY. planeNormal() takes its sign from the
   * ring's winding order, which differs between purines and pyrimidines, so
   * the twelve normals came out scattered (+,−,+,−,−,−,+,…). The helix pose
   * hides it completely — a flipped frame flips the local coordinates in the
   * way that cancels — and the LADDER puts the flipped half face-down between
   * their neighbours, which reads as sections spinning through two turns.
   * Nothing about that is visible in the numbers the other checks look at. */
  ok(D.pairs.every(p => p.basis[2][1] > 0.5),
     "every base pair normal points along the helix axis, not against it: "
     + D.pairs.map(p => p.basis[2][1].toFixed(2)).join(' '));
  // …and the long axes wind steadily rather than jumping about.
  {
    let prev = null, worst = 0;
    for(const p of D.pairs){
      let b = Math.atan2(p.basis[0][2], p.basis[0][0]) * 180/Math.PI;
      if(prev !== null){
        let step = b - prev;
        while(step >  180) step -= 360;
        while(step < -180) step += 360;
        worst = Math.max(worst, Math.abs(Math.abs(step) - 34));
      }
      prev = b;
    }
    ok(worst < 15, `every step turns by roughly the mean twist (worst deviation ${worst.toFixed(1)}°)`);
  }

  // The backbone has to survive as a connected strand, or the "grooves are
  // gaps between the rails" claim has no rails.
  // 11 steps x 2 strands. Anything less means a chain was walked in the wrong
  // direction and half the backbone quietly went missing.
  ok(D.links.length === 22,
     `both strands linked pair to pair: 22 phosphodiester bonds (got ${D.links.length})`);
  ok(D.links.filter(l => l.strand === 0).length === 11 &&
     D.links.filter(l => l.strand === 1).length === 11,
     'each strand contributes 11 of them');
}

console.log(`\n${checks - fails}/${checks} checks passed`);
if(fails){ console.log(`${fails} FAILED`); process.exit(1); }
