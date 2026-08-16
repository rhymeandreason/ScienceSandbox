#!/usr/bin/env node
/* =====================================================================
 *  check-lobes.js — the geometry and the chemistry behind lobes.js
 *
 *  WHY THIS EXISTS. A lone pair has no coordinates to compare against, so
 *  nothing about a wrong ear looks wrong. It is a plausible translucent
 *  teardrop pointing somewhere, and the two ways it goes wrong are both
 *  invisible on screen:
 *
 *    1. THE FRAME. Water's two pairs straddle the H−O−H plane; the easy
 *       version of the same code leaves them IN it, which draws a flat
 *       molecule with four coplanar domains and quietly deletes the reason
 *       ice is tetrahedral. On a still frame the two pictures are hard to
 *       tell apart.
 *    2. THE COUNT. The electron sum is blind to π systems, so adenine's
 *       exocyclic amino nitrogen comes out with a lone pair and gets drawn
 *       as an ACCEPTOR. It is a donor. That single ear is base pairing
 *       backwards, and it is the failure this module is most likely to ship
 *       once a DNA page starts calling it.
 *
 *  Plus the guard: an atom whose electron count does not come out whole
 *  must return null, not a rounded guess. Phosphate is the live case.
 *
 *  Run:  node lobes/check-lobes.js
 * ===================================================================== */
'use strict';
const path = require('path');
const HERE = __dirname;
const { MOLECULES } = require(path.join(HERE, '..', 'lib-node.js'));
const { Lobes } = require(path.join(HERE, 'lobes.js'));
const { MolGraph: MG } = require(path.join(HERE, '..', 'kit', 'molgraph.js'));

let fails = 0, checks = 0;
function ok(cond, what, detail) {
  checks++;
  if (cond) console.log(`  ok    ${what}${detail ? '   ' + detail : ''}`);
  else { fails++; console.log(`  FAIL  ${what}${detail ? '   ' + detail : ''}`); }
}
const near = (a, b, tol) => Math.abs(a - b) <= tol;

const sub = (a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const dot = (a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const len = a=>Math.sqrt(dot(a,a));
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit = a=>{const l=len(a);return [a[0]/l,a[1]/l,a[2]/l];};
const deg  = (a,b)=>Math.acos(Math.max(-1,Math.min(1,dot(unit(a),unit(b)))))*180/Math.PI;
const bondVec=(spec,i,j)=>sub(spec.atoms[j].pos, spec.atoms[i].pos);

// mol-solvation's water is family A (display units); the spec used here for a
// geometry claim only ever supplies DIRECTIONS, so the family does not matter.
const water = MOLECULES.water;

console.log('lone-pair geometry — lobes.js\n');

/* ---- 1. water: the shape the whole H-bond lesson rests on -------------- */
console.log('1. water — two ears, straddling the plane');
{
  const r = Lobes.at(water, 0);
  ok(r.pairs === 2, 'oxygen has two lone pairs', `got ${r.pairs}`);
  ok(r.domains === 4, 'four electron domains', `got ${r.domains}`);
  ok(r.dirs.length === 2, 'two directions come back');
  ok(!r.conjugated, 'and both are available — water accepts');

  const [a, b] = r.dirs;
  ok(near(len(a), 1, 1e-9) && near(len(b), 1, 1e-9), 'directions are unit vectors');
  ok(near(deg(a, b), 109.4712, 0.01), 'the two ears are the tetrahedral angle apart',
     `${deg(a, b).toFixed(3)}°`);

  /* THE CLAIM THAT MATTERS. Out of the H−O−H plane, symmetrically. In-plane
   * ears would put all four domains in one plane — a flat water, and no
   * tetrahedral ice. */
  const n = unit(cross(bondVec(water,0,1), bondVec(water,0,2)));
  const ca = dot(a, n), cb = dot(b, n);
  ok(Math.abs(ca) > 0.5, 'ear 1 is well out of the H−O−H plane', `n·d = ${ca.toFixed(3)}`);
  ok(near(ca, -cb, 1e-9), 'the two straddle it symmetrically');
  ok(near(Math.abs(ca), Math.sin(109.4712/2*Math.PI/180), 1e-6),
     'each sits half the tetrahedral angle off the plane');

  // and they point AWAY from the hydrogens, which is the direction a donor comes from
  [1,2].forEach(h => r.dirs.forEach((d,k)=>
    ok(deg(d, bondVec(water,0,h)) > 90,
       `ear ${k+1} points away from H${h}`, `${deg(d,bondVec(water,0,h)).toFixed(1)}°`)));

  ok(Lobes.capacity(water) === 2, 'water accepts exactly two H-bonds',
     `capacity ${Lobes.capacity(water)}`);
  // …and the spec already said so, independently. Two derivations, one answer.
  ok(water.sites.acceptors[0].lonePairs === 2,
     'which is what the spec\'s own acceptor record says');
}

/* ---- 2. the rest of the molecule gets nothing -------------------------- */
console.log('\n2. everything with no pair to draw draws none');
{
  ok(Lobes.at(water, 1).dirs.length === 0, 'hydrogen has no lone pair');
  const eth = MOLECULES.ethanol;
  const hydroxylO = eth.atoms.findIndex(a => a.el === 'O');
  ok(Lobes.at(eth, hydroxylO).pairs === 2, 'ethanol\'s hydroxyl O has two');
  ok(!Lobes.at(eth, hydroxylO).conjugated, 'and they are available');
  eth.atoms.forEach((a, i) => {
    if (a.el === 'C') checks++, (Lobes.at(eth, i).dirs.length === 0)
      || (fails++, console.log(`  FAIL  carbon ${i} drew a lone pair`));
  });
  console.log(`  ok    every carbon in ethanol draws none`);
  ok(Lobes.at(MOLECULES.methane, 0).pairs === 0, 'methane\'s carbon has none');
}

/* ---- 3. ammonia: one ear, and it is the dative site -------------------- */
console.log('\n3. ammonia — the one pair a proton lands in');
{
  const nh3 = MOLECULES.ammonia;
  const n = nh3.atoms.findIndex(a => a.el === 'N');
  const r = Lobes.at(nh3, n);
  ok(r.pairs === 1 && r.dirs.length === 1, 'nitrogen has exactly one');
  ok(r.domains === 4, 'four domains — pyramidal, not planar');
  const hs = MG.neighbors(nh3, n);
  hs.forEach(h => ok(deg(r.dirs[0], bondVec(nh3, n, h)) > 100,
    `it points away from H${h}`, `${deg(r.dirs[0], bondVec(nh3,n,h)).toFixed(1)}°`));
  // SCIENCE.md §3: NH₃ + H⁺ is a dative bond. The proton arrives along this ear.
  ok(near(deg(r.dirs[0], hs.reduce((s,h)=>{
       const v = unit(bondVec(nh3,n,h)); return [s[0]+v[0],s[1]+v[1],s[2]+v[2]];
     },[0,0,0])), 180, 1e-6),
     'and it is exactly opposite the three N−H\'s together');
}

/* ---- 4. a carbonyl oxygen is sp², and its ears stay in the plane ------- */
console.log('\n4. carbonyl oxygen — two ears, both in the sp² plane');
{
  const spec = MOLECULES.carbonic;                      // H₂CO₃: one C=O, two −OH
  const c = spec.atoms.findIndex(a => a.el === 'C');
  const dbl = MG.neighbors(spec, c).find(j =>
    spec.atoms[j].el === 'O' && MG.bondOrder(spec, c, j) === 2);
  ok(dbl != null, 'found the C=O oxygen', `atom ${dbl}`);
  const r = Lobes.at(spec, dbl);
  ok(r.pairs === 2, 'it has two pairs');
  ok(r.domains === 3, 'three domains, not four — a double bond is ONE domain',
     `got ${r.domains}`);
  ok(!r.conjugated, 'its own π is not a reason to mute it — this O accepts');
  ok(near(deg(r.dirs[0], r.dirs[1]), 120, 0.01), 'the ears are 120° apart',
     `${deg(r.dirs[0], r.dirs[1]).toFixed(2)}°`);

  /* The claim: they lie in the plane of the carbon's substituents, which is
   * where a donor approaches from. Rotated out of it they point at the π
   * cloud — a different and wrong story about what an H-bond is. */
  const subs = MG.neighbors(spec, c).filter(j => j !== dbl);
  const nrm = unit(cross(sub(spec.atoms[subs[0]].pos, spec.atoms[c].pos),
                         sub(spec.atoms[subs[1]].pos, spec.atoms[c].pos)));
  r.dirs.forEach((d, k) => ok(Math.abs(dot(d, nrm)) < 0.02,
    `ear ${k+1} lies in the sp² plane`, `n·d = ${dot(d, nrm).toFixed(4)}`));
  r.dirs.forEach((d, k) => ok(near(deg(d, bondVec(spec, dbl, c)), 120, 0.01),
    `ear ${k+1} is 120° off the C=O axis`));
}

/* ---- 5. THE DNA CASE — adenine, where the count alone gets it wrong ---- */
console.log('\n5. adenine (in AMP) — which nitrogens accept, and which do not');
{
  const amp = MOLECULES.amp;
  /* Named by CONNECTIVITY, not by index, so a re-baked spec cannot silently
   * repoint these at other atoms. Ring N's carrying a double bond are the
   * acceptors; the two σ-only N's are not. */
  const ringN = amp.atoms.map((a,i)=>i).filter(i =>
    amp.atoms[i].el === 'N' && MG.neighbors(amp,i).some(j=>MG.bondOrder(amp,i,j)>1));
  const sigmaN = amp.atoms.map((a,i)=>i).filter(i =>
    amp.atoms[i].el === 'N' && !MG.neighbors(amp,i).some(j=>MG.bondOrder(amp,i,j)>1));
  ok(ringN.length === 3, 'three ring nitrogens carry a double bond', `${ringN}`);
  ok(sigmaN.length === 2, 'two are σ-only: the glycosidic N9 and the amino N6',
     `${sigmaN}`);

  ringN.forEach(i => {
    const r = Lobes.at(amp, i);
    ok(r.pairs === 1 && r.dirs.length === 1, `N${i} has one lone pair`);
    ok(!r.conjugated, `N${i} is an ACCEPTOR — its pair is in the ring plane`);
    // in-plane: perpendicular to the local ring normal
    const nb = MG.neighbors(amp, i);
    const nrm = unit(cross(bondVec(amp,i,nb[0]), bondVec(amp,i,nb[1])));
    ok(Math.abs(dot(r.dirs[0], nrm)) < 0.05, `N${i}'s ear lies in the ring plane`,
       `n·d = ${dot(r.dirs[0], nrm).toFixed(4)}`);
  });

  sigmaN.forEach(i => {
    const r = Lobes.at(amp, i);
    ok(r.pairs === 1, `N${i} counts one pair by the electron sum`);
    ok(r.conjugated === true,
       `…and N${i} is FLAGGED conjugated — drawn muted, never as an acceptor`);
    /* Both of adenine's σ-only nitrogens are flat, so both come back as the
     * π orbital: the electrons are visibly lying in the ring. For N6 that is
     * the base-pairing fact — the amino group DONATES its hydrogen to
     * thymine's O4, and has nothing to accept with. */
    ok(r.pi === true, `N${i} is planar, so its pair is drawn as the p orbital`);
  });

  /* The headline number. An adenine that counted its amino nitrogen would
   * claim four acceptor sites; base pairing uses N1 as the acceptor and the
   * N6 amino as the DONOR, so the count has to exclude it. */
  const baseIdx = amp.groups.find(g => g.key === 'base').atoms;
  const baseCap = baseIdx.reduce((s,i) => {
    const r = Lobes.at(amp, i); return s + (r.conjugated ? 0 : r.dirs.length);
  }, 0);
  ok(baseCap === 3, 'adenine offers three acceptor lone pairs, not five',
     `got ${baseCap}`);
}

/* ---- 5b. a flat N−H in a ring: the pair is the π orbital --------------- */
console.log('\n5b. purine\'s N9−H — flat, so the pair lies perpendicular to the ring');
{
  const pur = MOLECULES.purine;
  // the ring N carrying a hydrogen and no double bond: N9−H, the donor
  const i = pur.atoms.map((a,k)=>k).find(k => pur.atoms[k].el === 'N'
    && MG.hydrogens(pur, k).length === 1
    && !MG.neighbors(pur, k).some(j => MG.bondOrder(pur, k, j) > 1));
  ok(i != null, 'found N9−H', `atom ${i}`);
  const r = Lobes.at(pur, i);
  ok(r.pairs === 1, 'one pair by the electron sum');
  ok(r.pi === true, 'and it is the p orbital — flagged pi, not a σ ear');
  ok(r.dirs.length === 2, 'drawn as two lobes, above and below',
     'ONE pair — dirs.length is not a pair count here');
  ok(r.conjugated === true, 'so it never counts as an acceptor');
  /* THE REGRESSION. This atom is planar but not evenly so — the fused ring
   * skews it, leaving Σb̂ at 0.18, which the first version of this module
   * normalised into a lone pair lying exactly along the N−H bond. Planarity
   * is the test, not the residual's size. */
  MG.neighbors(pur, i).forEach(j => r.dirs.forEach((d, k) =>
    ok(near(deg(d, bondVec(pur, i, j)), 90, 1.5),
       `lobe ${k+1} is perpendicular to the bond to ${j}`,
       `${deg(d, bondVec(pur, i, j)).toFixed(1)}°`)));
}

/* ---- 6. the guard: an ambiguous count refuses to draw ------------------ */
console.log('\n6. phosphate — the count does not come out whole, so nothing is drawn');
{
  const amp = MOLECULES.amp;
  const p = amp.atoms.findIndex(a => a.el === 'P');
  const terminal = MG.neighbors(amp, p).filter(j =>
    amp.atoms[j].el === 'O' && MG.neighbors(amp, j).length === 1
                            && MG.bondOrder(amp, p, j) === 1);
  ok(terminal.length > 0, 'AMP has bare phosphate oxygens', `${terminal}`);
  terminal.forEach(i => {
    const r = Lobes.at(amp, i);
    ok(r.pairs === null, `O${i} returns null rather than a rounded guess`);
    ok(/[Dd]eclare lonePairs/.test(r.reason || ''), `O${i} says why, and what to do`,
       r.reason);
  });
  /* WHY it comes out fractional, and why that is the right answer: the −2 is
   * delocalised over these oxygens and SCIENCE.md §3 draws every P–O as a
   * single stick for exactly that reason. Ears here would assert a
   * localisation the rest of the repo refuses to draw. */
  ok(amp.charge === -2, 'the charge is on the molecule, not on an atom',
     'so no per-atom formal charge rescues the sum — by design');
}

/* ---- 7. nothing points at a bond, anywhere in the library -------------- */
console.log('\n7. across every spec: no ear points at a bonded neighbour');
{
  let worst = 180, worstAt = '', n = 0;
  Object.entries(MOLECULES).forEach(([key, spec]) => {
    if (!spec.atoms || !spec.bonds) return;
    spec.atoms.forEach((a, i) => {
      const r = Lobes.at(spec, i);
      r.dirs.forEach(d => {
        n++;
        MG.neighbors(spec, i).forEach(j => {
          const ang = deg(d, bondVec(spec, i, j));
          if (ang < worst) { worst = ang; worstAt = `${key} atom ${i}→${j}`; }
        });
      });
    });
  });
  ok(n > 40, 'the sweep actually looked at something', `${n} lobes`);
  /* 80°, not 89°: NADH's carboxamide nitrogen is a measured conformer and is
   * very slightly pyramidalised, so its p lobes miss perpendicular by three
   * degrees. That is the molecule, not the module. The bar exists to catch a
   * lobe lying ALONG a bond — the purine N9−H failure — and 80° catches that
   * with room to spare. */
  ok(worst > 80, 'the closest any lobe comes to a bond is still well clear',
     `${worst.toFixed(1)}° at ${worstAt}`);
}

console.log('');
if (fails) {
  console.log(`FAIL: ${fails} of ${checks} checks failed.`);
  process.exit(1);
}
console.log(`PASS: ${checks} checks — the lobes point where the chemistry says.`);
