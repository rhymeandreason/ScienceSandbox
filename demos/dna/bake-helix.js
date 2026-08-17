#!/usr/bin/env node
/* =============================================================================
 *  dna/bake-helix.js — the B-DNA parameters, measured off a real structure
 * =============================================================================
 *  Step 4 of the lesson builds a ladder and twists it into a helix. That needs
 *  numbers — rise, twist, propeller — and there are two ways to get them: type
 *  the ones everybody quotes, or measure them. This measures them, off the
 *  Drew–Dickerson dodecamer (PDB 1BNA, CGCGAATTCGCG), the structure B-DNA is
 *  usually pictured from.
 *
 *  WHY MEASURE WHAT IS IN EVERY TEXTBOOK. Because "3.4 Å and 36°" is a
 *  composite of fiber-diffraction averages, and a page that draws a helix from
 *  it while claiming to show a real molecule is quietly drawing an idealisation
 *  and calling it a structure. Measured numbers come with a spread, and the
 *  spread is itself worth knowing: B-DNA is not a machined screw.
 *
 *  WHAT IS AVERAGED, AND WHAT IS THROWN AWAY:
 *
 *  · The two TERMINAL base pairs at each end are dropped. Ends of a short
 *    duplex fray and stack against neighbouring molecules in the crystal;
 *    including them drags the average toward artefacts of this being a
 *    12-mer in a lattice rather than DNA.
 *  · Everything else is averaged across the ten remaining steps, and the
 *    standard deviation is reported alongside. A parameter whose spread is
 *    large is one the lesson should not draw as exact.
 *
 *  THE HELIX AXIS IS FITTED, NOT ASSUMED. Base-pair centres in B-DNA sit close
 *  to the axis, so the axis is the principal direction of those centres (a
 *  3-point PCA power iteration — no matrix library, this repo has none). The
 *  RMS of the centres about that line is reported: 1BNA is measurably bent,
 *  and a fit that pretended otherwise would hide it.
 *
 *  Output: dna/data/helix.json, with a `Do not edit` header and every number
 *  carrying its spread. check-dna.js re-reads it and fails on staleness.
 *
 *  Run:  node dna/bake-helix.js
 * ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'data', '1BNA.pdb');
const OUT = path.join(__dirname, 'data', 'helix.json');

/* ---- parse ------------------------------------------------------------- */
// Columns are fixed-width in the PDB format; splitting on whitespace breaks on
// the first structure with a four-character atom name butted against a residue.
function parse(text){
  const res = new Map();                       // "chain:seq" -> {chain,seq,name,atoms}
  for(const line of text.split('\n')){
    if(!line.startsWith('ATOM')) continue;
    const name  = line.slice(12,16).trim();
    const alt   = line.slice(16,17).trim();
    if(alt && alt !== 'A') continue;            // one altloc only
    const rname = line.slice(17,20).trim();
    const chain = line.slice(21,22).trim();
    const seq   = parseInt(line.slice(22,26), 10);
    const xyz   = [+line.slice(30,38), +line.slice(38,46), +line.slice(46,54)];
    const key = chain + ':' + seq;
    if(!res.has(key)) res.set(key, { chain, seq, name:rname, atoms:{} });
    res.get(key).atoms[name] = xyz;
  }
  return res;
}

/* ---- small vector helpers ---------------------------------------------- */
const sub = (a,b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
const add = (a,b) => [a[0]+b[0], a[1]+b[1], a[2]+b[2]];
const mul = (a,s) => [a[0]*s, a[1]*s, a[2]*s];
const dot = (a,b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const len = a => Math.hypot(a[0],a[1],a[2]);
const unit = a => { const l = len(a); return l > 1e-9 ? mul(a, 1/l) : [0,0,0]; };
const mean = xs => xs.reduce((s,v)=>s+v, 0) / xs.length;
const sd = xs => { const m = mean(xs);
  return Math.sqrt(xs.reduce((s,v)=>s+(v-m)*(v-m), 0) / xs.length); };
const deg = r => r * 180 / Math.PI;

// The atom the sugar attaches to, per base — the same choice dna-lab's ruler
// makes, so the two numbers are comparable.
const GLYCO = { DA:'N9', DG:'N9', DC:'N1', DT:'N1' };
// Ring atoms used for a base's plane. Six-ring only, which every base has, so
// purines and pyrimidines are treated identically.
const RING = ['N1','C2','N3','C4','C5','C6'];

function planeNormal(r){
  const pts = RING.map(n => r.atoms[n]).filter(Boolean);
  if(pts.length < 3) return null;
  // Newell's method: robust for a near-planar polygon, and needs no fitting.
  let n = [0,0,0];
  for(let i=0;i<pts.length;i++){
    const a = pts[i], b = pts[(i+1)%pts.length];
    n = add(n, [ (a[1]-b[1])*(a[2]+b[2]),
                 (a[2]-b[2])*(a[0]+b[0]),
                 (a[0]-b[0])*(a[1]+b[1]) ]);
  }
  return unit(n);
}

/* ---- pair up the two strands ------------------------------------------- */
// 1BNA is self-complementary: chain A residue i pairs with chain B residue
// (25 − i), the two strands running antiparallel. Verified below by distance
// rather than trusted — a mis-pairing would silently corrupt every number.
function pairs(res){
  const out = [];
  for(let i = 1; i <= 12; i++){
    const a = res.get('A:' + i), b = res.get('B:' + (25 - i));
    if(!a || !b) continue;
    const ga = a.atoms[GLYCO[a.name]], gb = b.atoms[GLYCO[b.name]];
    const c1a = a.atoms["C1'"], c1b = b.atoms["C1'"];
    if(!ga || !gb || !c1a || !c1b) continue;
    out.push({ i, a, b,
      glyco: len(sub(ga, gb)),
      c1c1:  len(sub(c1a, c1b)),
      origin: mul(add(c1a, c1b), 0.5),
      long:   unit(sub(c1b, c1a)),       // the pair's long axis, strand A → B
      normA:  planeNormal(a), normB:  planeNormal(b) });
  }
  return out;
}

/* ---- the helix axis, by power iteration -------------------------------- */
function axisOf(points){
  const c = mul(points.reduce(add, [0,0,0]), 1/points.length);
  const d = points.map(p => sub(p, c));
  let v = unit(sub(points[points.length-1], points[0]));   // sensible seed
  for(let it = 0; it < 200; it++){
    let n = [0,0,0];
    for(const x of d) n = add(n, mul(x, dot(x, v)));       // n = Σ x(xᵀv)
    const u = unit(n);
    if(len(sub(u, v)) < 1e-12) { v = u; break; }
    v = u;
  }
  // how far the centres stray from that line — 1BNA is bent, and this says so
  const rms = Math.sqrt(mean(d.map(x => {
    const along = dot(x, v); return dot(x,x) - along*along; })));
  return { origin:c, dir:v, rms };
}

/* ---- measure ------------------------------------------------------------ */
/* Exported so check-dna.js can re-measure and compare against the committed
 * JSON. A baked artefact whose checker holds its own copy of the answer agrees
 * with itself forever and with the structure never. */
function measure(){
const text = fs.readFileSync(SRC, 'utf8');
const res = parse(text);
const all = pairs(res);
if(all.length !== 12) throw new Error(`expected 12 base pairs, paired ${all.length}`);

// Sanity: a Watson–Crick pair's glycosidic nitrogens sit ~9 Å apart. Anything
// far off that means the strands were paired up wrongly.
for(const p of all)
  if(p.glyco < 8 || p.glyco > 10)
    throw new Error(`pair ${p.i}: N9–N1 is ${p.glyco.toFixed(2)} Å — strands mis-paired?`);

const INNER = all.slice(2, -2);                 // drop two frayed pairs per end
const ax = axisOf(INNER.map(p => p.origin));

const rise = [], twist = [], prop = [];
for(const p of INNER){
  // Propeller: the two bases of one pair are not coplanar. Signed angle
  // between their plane normals about the pair's own long axis.
  if(p.normA && p.normB){
    // flip B's normal to the same side, or every pair reads as ~180°
    const nb = dot(p.normA, p.normB) < 0 ? mul(p.normB, -1) : p.normB;
    const s = dot(cross(p.normA, nb), p.long);
    prop.push(deg(Math.atan2(s, dot(p.normA, nb))));
  }
}
for(let k = 0; k + 1 < INNER.length; k++){
  const p = INNER[k], q = INNER[k+1];
  rise.push(dot(sub(q.origin, p.origin), ax.dir));
  // Twist: turn of the long axis about the helix axis, measured in the plane
  // perpendicular to it.
  const flat = v => { const a = sub(v, mul(ax.dir, dot(v, ax.dir))); return unit(a); };
  const u1 = flat(p.long), u2 = flat(q.long);
  twist.push(deg(Math.atan2(dot(cross(u1,u2), ax.dir), dot(u1,u2))));
}

const stat = (xs, unit_) => ({ mean:+mean(xs).toFixed(3), sd:+sd(xs).toFixed(3),
                               min:+Math.min(...xs).toFixed(3),
                               max:+Math.max(...xs).toFixed(3),
                               n:xs.length, unit:unit_ });

const out = {
  _: 'Do not edit — generated by dna/bake-helix.js from dna/data/1BNA.pdb.',
  source: { pdb:'1BNA', title:'Structure of a B-DNA dodecamer',
            sequence:'CGCGAATTCGCG',
            note:'Interior 8 base pairs used; two at each end dropped as frayed.' },
  rise:      stat(rise, 'A'),
  twist:     stat(twist, 'deg'),
  propeller: stat(prop, 'deg'),
  glycoN:    stat(INNER.map(p => p.glyco), 'A'),
  c1c1:      stat(INNER.map(p => p.c1c1), 'A'),
  axis: { rmsOfCentres:+ax.rms.toFixed(3),
          note:'RMS of base-pair centres about the fitted line — 1BNA is bent.' },
  bpPerTurn: +(360 / mean(twist)).toFixed(2),
};

return out;
}

module.exports = { measure, OUT };

if(require.main === module){
  const out = measure();
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
  console.log(JSON.stringify(out, null, 2));
  console.log('\nwrote ' + path.relative(process.cwd(), OUT));
}
