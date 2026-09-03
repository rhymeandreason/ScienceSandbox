#!/usr/bin/env node
/* =====================================================================
 *  check-cell.js — the arithmetic behind cell.js, and the shortcuts it
 *  must not have taken
 *
 *  WHY THIS EXISTS. Every number this module prints looks reasonable
 *  whatever it is. A cell that reports 4πr² for its area is right for a
 *  sphere and silently wrong for every other shape on the page — and the
 *  page is ABOUT the other shapes. Three failures, all of which render
 *  perfectly:
 *
 *    1. THE SUBSTITUTION. Someone replaces the triangle sum with the
 *       closed form for the shape it is supposed to be. The sphere case
 *       agrees to twelve digits, the disc and the villous cell report the
 *       sphere's answer, and the entire lesson — that shape moves these
 *       numbers independently of size — quietly evaporates.
 *    2. THE SHORTCUT. Depth is taken as half the shortest axis instead of
 *       searched for. Right for a sphere, right for a rod, and wrong by
 *       1.9× for the red cell, the one shape here whose whole point is
 *       that its cytoplasm sits nearer the outside than its size implies.
 *    3. THE FLIP. The mesh winding reverses. It renders identically once
 *       both faces are drawn, and the divergence-theorem volume comes back
 *       negative — which nothing downstream inspects the sign of.
 *
 *  AND THE FIXTURES HAVE TO EARN IT. Modules.md: an ideal case is usually
 *  symmetric in exactly the way that makes the assertion meaningless. A
 *  sphere cannot distinguish a searched depth from a shortcut, and a rod
 *  cannot either — a prolate spheroid's inscribed sphere IS half its short
 *  axis, sitting at the origin. Only the dimpled disc separates them, so
 *  each assertion here prints the precondition that makes it non-vacuous
 *  beside itself, and that precondition is asserted too.
 *
 *  Run:  node cell/check-cell.js
 * ===================================================================== */
'use strict';
const path = require('path');
const { Cell } = require(path.join(__dirname, 'cell.js'));

let fails = 0, checks = 0;
function ok(cond, what, detail){
  checks++;
  if(cond) console.log(`  ok    ${what}${detail ? '   ' + detail : ''}`);
  else { fails++; console.log(`  FAIL  ${what}${detail ? '   ' + detail : ''}`); }
}
const rel = (a,b) => Math.abs(a-b)/Math.abs(b);
const f = (x,n) => x.toFixed(n==null?3:n);

const SPHERE_V = 4/3*Math.PI*125;

console.log('a cell as a scaling object — cell.js\n');

/* ---- 1. the measurement is a measurement ------------------------------ */
console.log('1. area and volume come off the triangles');
{
  const P = Cell.resolve({ radius:5 });
  const g = Cell.measure(Cell.mesh(P));
  const aWant = 4*Math.PI*25, vWant = SPHERE_V;

  ok(g.volume > 0, 'volume is positive — the mesh is wound outwards',
     `${f(g.volume,2)} µm³`);
  ok(rel(g.area, aWant) < 1e-3, 'sphere area matches the closed form',
     `${f(g.area,3)} vs ${f(aWant,3)} µm²`);
  ok(rel(g.volume, vWant) < 1e-3, 'sphere volume matches the closed form',
     `${f(g.volume,3)} vs ${f(vWant,3)} µm³`);

  /* THE ANTI-VACUITY LINE. A triangulated sphere is inscribed in the real
   * one, so a triangle sum MUST land slightly under the closed form. Exact
   * agreement is not a better result, it is the signature of the closed form
   * having been used instead. */
  const eA = (aWant - g.area)/aWant, eV = (vWant - g.volume)/vWant;
  ok(eA > 1e-6 && eA < 1e-3,
     'and it is genuinely discretised, not the closed form in disguise',
     `area falls ${(eA*1e6).toFixed(0)} ppm under the smooth sphere, inside it as a polyhedron must be`);
  ok(eV > 1e-6 && eV < 2e-3, 'same for the volume sum',
     `${(eV*1e6).toFixed(0)} ppm under`);

  ok(Math.abs(g.fold - 1) < 2e-3, 'a sphere sits at the isoperimetric floor',
     `fold ${f(g.fold,5)}`);
  ok(rel(g.sv, 3/5) < 2e-3, 'S/V is 3/R for a sphere', `${f(g.sv,4)} vs 0.6000`);
}

/* ---- 2. shape moves area with volume pinned --------------------------- */
console.log('\n2. shape moves the numbers — which a closed form could not');
{
  const V = SPHERE_V;
  const cases = [
    ['sphere',      Cell.resolve({ radius:5, volume:V })],
    ['rod ×3',      Cell.resolve({ radius:5, aspect:3,    volume:V })],
    ['disc ×0.25',  Cell.resolve({ radius:5, aspect:0.25, volume:V })],
    ['villous',     Cell.resolve({ radius:5, villi:{},    volume:V })],
    ['red cell',    Cell.resolve({ radius:5, aspect:0.32, dimple:0.62, volume:V })],
  ].map(([n,P]) => [n, P, Cell.measure(Cell.mesh(P))]);

  cases.forEach(([n,P,g]) => ok(rel(g.volume, V) < 1e-6,
    `${n}: volume normalised onto the target`, `${f(g.volume,4)} µm³`));

  /* The isoperimetric inequality is the one law that must hold for every
   * member of the family. A `fold` below 1 is not a small error, it is proof
   * the area sum and the volume sum disagree about what surface they are on. */
  cases.forEach(([n,P,g]) => ok(g.fold >= 1 - 2e-3,
    `${n}: no shape beats the sphere`, `fold ${f(g.fold,3)}`));

  const base = cases[0][2].area;
  cases.slice(1).forEach(([n,P,g]) => ok(g.area > base*1.05,
    `${n}: carries measurably more membrane than the bag would`,
    `${f(g.area,1)} vs ${f(base,1)} µm² — a closed form for a sphere would have said ${f(base,1)}`));
}

/* ---- 3. depth is searched for ----------------------------------------- */
console.log('\n3. depth is a search, and the fixture proves it');
{
  const P = Cell.resolve({ radius:5 });
  const d = Cell.depth(P);
  ok(Math.abs(d.depth - 5) < d.error + 1e-3, 'sphere: the deepest point is the centre',
     `${f(d.depth,5)} ± ${d.error.toExponential(1)} µm`);
  ok(d.error < 0.01, 'and the reported error bar is small enough to trust the digits',
     `ε ${f(d.eps,3)} µm of sample spacing → ε²/8d = ${d.error.toExponential(2)} µm`);

  /* THE FIXTURE THAT SEPARATES A SEARCH FROM A SHORTCUT. A red cell's
   * thinnest axis runs through the dimple at the centre; its deepest
   * cytoplasm is out in the rim. Half the shortest axis is wrong here by
   * about 1.9×, and it is wrong for a sphere and for a rod by nothing at
   * all — which is why neither of those can stand in for this test. */
  const R = Cell.resolve({ radius:3.9, aspect:0.32, dimple:0.62 });
  const dr = Cell.depth(R);
  const halfThin = Cell.radiusAt(R, 0, 1, 0);          // pole, through the dimple
  const offAxis = Math.hypot(dr.point[0], dr.point[2]);

  ok(halfThin < 0.6, 'and the fixture is genuinely dimpled',
     `half-thickness at the centre is ${f(halfThin,3)} µm, wants < 0.6`);
  ok(offAxis > 0.5, 'and its deepest point is genuinely off the axis',
     `${f(offAxis,3)} µm out from the centre, wants > 0.5 — a shortcut would have answered at the origin`);
  ok(dr.depth > halfThin*1.5, 'red cell: the search finds the rim, not the dimple',
     `${f(dr.depth,3)} µm vs the ${f(halfThin,3)} µm a half-the-shortest-axis shortcut returns`);

  /* The error bar has to be honest, not decorative: a coarser cloud must
   * land inside the bound the fine one advertises. */
  const fine = Cell.depth(P, { n:8000 });
  const coarse = Cell.depth(P, { n:600 });
  ok(Math.abs(coarse.depth - fine.depth) <= coarse.error + 1e-3,
     'a coarse cloud lands inside the error bar it prints',
     `coarse ${f(coarse.depth,4)} ± ${coarse.error.toExponential(1)}, fine ${f(fine.depth,4)}`);
  ok(coarse.error > fine.error*2, 'and the bar is genuinely tighter when the cloud is denser',
     `${coarse.error.toExponential(2)} → ${fine.error.toExponential(2)} µm`);
}

/* ---- 4. the claim the module exists to make --------------------------- */
console.log('\n4. folding buys surface, and buys no depth');
{
  const V = SPHERE_V;
  const plain = Cell.resolve({ radius:5, volume:V });
  const villous = Cell.resolve({ radius:5, villi:{}, volume:V });
  const gp = Cell.measure(Cell.mesh(plain)), gv = Cell.measure(Cell.mesh(villous));
  const dp = Cell.depth(plain), dv = Cell.depth(villous);

  const areaX = gv.area/gp.area, depthX = dv.depth/dp.depth;
  ok(areaX > 1.3, 'the villi are genuinely doing something',
     `surface ×${f(areaX,2)} at the same volume — without this the next line is vacuous`);
  ok(rel(gv.volume, gp.volume) < 1e-6, 'and they cost no volume',
     `${f(gv.volume,4)} vs ${f(gp.volume,4)} µm³`);
  ok(depthX > 0.85, 'while the deepest cytoplasm is no closer to the outside',
     `depth ×${f(depthX,3)} — surface ×${f(areaX,2)} bought that, and nothing more`);

  /* The other half of the same claim, said the other way: SHAPE does move
   * depth, so the two levers are not interchangeable. */
  const disc = Cell.resolve({ radius:5, aspect:0.25, volume:V });
  const dd = Cell.depth(disc);
  ok(dd.depth < dp.depth*0.5, 'whereas flattening moves it a great deal',
     `${f(dd.depth,3)} vs ${f(dp.depth,3)} µm — ×${f(dd.depth/dp.depth,3)}`);
}

/* ---- 4b. the cap, which is what makes it a gut cell rather than a
 *      lymphocyte ---------------------------------------------------------- */
console.log('\n4b. a capped cell is villous on ONE face');
{
  const CAP = Math.PI/3;
  const bare = Cell.resolve({ radius:5 });
  const capped = Cell.resolve({ radius:5, villi:{ count:64, height:0.3, cap:CAP } });
  const w = capped.villi.width;

  /* `count` has to mean fingers DRAWN, not fingers generated. Building the
   * whole sphere and discarding what falls outside would leave a slider
   * reading 64 showing about sixteen, at whatever density the discard
   * happened to leave. */
  const ax = Cell.villusAxes(64, CAP);
  ok(ax.length === 64, 'the cap holds the count the caller asked for',
     `${ax.length} axes`);
  const furthest = Math.max(...ax.map(a => Math.acos(Math.min(1,a[1]))));
  ok(furthest <= CAP + 1e-9, 'and every one of them is inside it',
     `furthest ${f(furthest*180/Math.PI,1)}° of a ${f(CAP*180/Math.PI,0)}° cap`);

  /* The polarity claim itself, measured on the surface rather than on the
   * axis list: past the cap plus one finger's width the cell is exactly the
   * bare ellipsoid again. */
  let maxIn = 0, maxOut = 0;
  for(let j=0;j<=200;j++){
    const th = Math.PI*j/200, st=Math.sin(th), ct=Math.cos(th);
    for(let i=0;i<40;i++){
      const ph = 2*Math.PI*i/40;
      const dx=st*Math.cos(ph), dy=ct, dz=st*Math.sin(ph);
      const e = Cell.radiusAt(capped,dx,dy,dz) - Cell.radiusAt(bare,dx,dy,dz);
      if(th <= CAP) maxIn = Math.max(maxIn, e);
      if(th >  CAP + w) maxOut = Math.max(maxOut, Math.abs(e));
    }
  }
  ok(maxIn > 0.3, 'the capped face is genuinely covered — without this the next line is vacuous',
     `fingers stand ${f(maxIn,2)} µm proud inside the cap`);
  ok(maxOut < 1e-12, 'and past the cap the surface is the bare ellipsoid, to the last bit',
     `largest departure ${maxOut.toExponential(1)} µm`);

  /* Packing: a tighter cap at the same count means less room each, so the
   * derived width has to shrink or the fingers merge into a dome and the
   * area gain quietly turns into a bigger cell. */
  const wide = Cell.villusWidth(64, Math.PI), tight = Cell.villusWidth(64, Math.PI/5);
  ok(tight < wide*0.5, 'a tighter cap derives slimmer fingers',
     `${f(wide,3)} → ${f(tight,3)} rad at 64 across π → π/5`);
  const spacing = Math.sqrt(2*Math.PI*(1-Math.cos(CAP))/64);
  ok(w < spacing/2, 'and a finger is narrower than half the spacing, so neighbours do not merge',
     `width ${f(w,3)} against ${f(spacing,3)} rad of mean spacing`);
}

/* ---- 5. one generating function, and the mesh is on it ---------------- */
console.log('\n5. the mesh, the cloud and inside() are the same surface');
{
  const P = Cell.resolve({ radius:5, aspect:1.7, dimple:0.3, villi:{count:24} });
  const m = Cell.mesh(P);
  let worst = 0;
  for(let i=0;i<m.pos.length;i+=3){
    const x=m.pos[i], y=m.pos[i+1], z=m.pos[i+2];
    const L = Math.hypot(x,y,z);
    if(L < 1e-9) continue;
    worst = Math.max(worst, Math.abs(L - Cell.radiusAt(P, x/L, y/L, z/L)));
  }
  ok(worst < 1e-9, 'every mesh vertex lies on radiusAt()', `worst ${worst.toExponential(1)} µm`);

  let bad = 0, tested = 0;
  for(let i=0;i<m.pos.length;i+=333*3){
    const x=m.pos[i], y=m.pos[i+1], z=m.pos[i+2];
    tested++;
    if(!Cell.inside(P, x*0.98, y*0.98, z*0.98)) bad++;
    if( Cell.inside(P, x*1.02, y*1.02, z*1.02)) bad++;
  }
  ok(tested > 10 && bad === 0, 'inside() agrees with it on both sides',
     `${tested} vertices, each probed at 0.98× and 1.02×`);

  /* Star-shapedness is what makes inside() exact and cheap. If radiusAt ever
   * returns ≤ 0 the origin has left the body and inside() starts lying
   * quietly — the dimple is the knob that could do it. */
  const D9 = Cell.resolve({ radius:5, aspect:0.2, dimple:0.9 });
  let minR = Infinity;
  for(let j=0;j<=60;j++) for(let i=0;i<60;i++){
    const th=Math.PI*j/60, ph=2*Math.PI*i/60;
    minR = Math.min(minR, Cell.radiusAt(D9, Math.sin(th)*Math.cos(ph),
                                            Math.cos(th), Math.sin(th)*Math.sin(ph)));
  }
  ok(minR > 0, 'the body stays star-shaped at the deepest dimple in range',
     `min radius ${f(minR,4)} µm at dimple 0.9, aspect 0.2`);
}

/* ---- 6. the number the red cell is FOR ---------------------------------- */
console.log('\n6. what a shape is worth, as a pure ratio');
{
  /* No diffusion coefficient and no time: distance alone, which is the only
   * part of it this module owns. A page that wants seconds writes x²/6D
   * itself — putting D in here would have made a shape module about
   * diffusion, which is how it grew a heat map and a cutaway the first
   * time round. */
  const R = Cell.resolve({ radius:3.9, aspect:0.32, dimple:0.62 });
  const g = Cell.measure(Cell.mesh(R));
  const dr = Cell.depth(R).depth;
  ok(g.sphereRadius/dr > 2,
     'a red cell keeps its cytoplasm far nearer the outside than a bag of the same volume',
     `deepest ${f(dr,3)} µm against ${f(g.sphereRadius,3)} µm — ×${f(g.sphereRadius/dr,2)} closer`);
  ok(g.fold > 1.2, 'and it pays for that in membrane, not in volume',
     `fold ${f(g.fold,2)} at ${f(g.volume,1)} µm³`);

  const listed = Cell.CELLS.map(c => c.radius);
  ok(listed.every((r,i) => i===0 || r > listed[i-1]),
     'the reference cells are in size order', `${listed.join(' · ')} µm`);
  ok(Cell.CELLS.every(c => !/[0-9]/.test(c.note)),
     'and no reference note types a number the table already measures');
}

/* ---- 7. the scaling law, read off measurements ------------------------ */
console.log('\n7. V outruns S, measured twice rather than argued once');
{
  const a = Cell.measure(Cell.mesh(Cell.resolve({ radius:5 })));
  const b = Cell.measure(Cell.mesh(Cell.resolve({ radius:10 })));
  ok(rel(b.volume/a.volume, 8) < 2e-3, 'double the radius, eight times the volume',
     `×${f(b.volume/a.volume,4)}`);
  ok(rel(b.area/a.area, 4) < 2e-3, 'and four times the surface', `×${f(b.area/a.area,4)}`);
  ok(rel(b.sv/a.sv, 0.5) < 2e-3, 'so half the surface per unit of cytoplasm',
     `S/V ${f(a.sv,3)} → ${f(b.sv,3)} µm⁻¹`);
}

console.log(`\n${checks - fails}/${checks} passed`);
process.exit(fails ? 1 : 0);
