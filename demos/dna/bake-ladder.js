#!/usr/bin/env node
/* =============================================================================
 *  dna/bake-ladder.js — a real helix, and the same molecule untwisted
 * =============================================================================
 *  Step 4's whole claim: the major and minor grooves are not decoration and not
 *  a drawing convention. They are what is LEFT OVER when a ladder is twisted.
 *  A student cannot see that from a picture of a helix, and cannot see it from
 *  a picture of a ladder; it needs one object in both states.
 *
 *  So this bakes exactly that — two poses of the SAME atoms:
 *
 *    · the HELIX pose, which is 1BNA as deposited, re-framed so the fitted
 *      helix axis is +Y and the molecule is centred;
 *    · the LADDER pose, the same base pairs with the twist taken out — each
 *      pair squared up to a common orientation and set on the axis at its own
 *      measured rise.
 *
 *  NOTHING IS INVENTED BETWEEN THEM. The ladder is not a drawing of a ladder;
 *  it is this dodecamer with one number set to zero.
 *
 *  ---------------------------------------------------------------------------
 *  WHY PER-PAIR RIGID TRANSFORMS AND NOT PER-ATOM INTERPOLATION
 *  ---------------------------------------------------------------------------
 *  Lerping every atom from its ladder position to its helix position is one
 *  line and looks almost right — and it is wrong in a way that matters here.
 *  Halfway through, every base is a squashed intermediate: bond lengths shrink,
 *  rings buckle, and the thing on screen is not a molecule at any frame but the
 *  first and last. Since the page is arguing that the SAME molecule is in both
 *  states, that is the one artefact it cannot afford.
 *
 *  Each base pair therefore gets its atoms in its OWN frame, plus two rigid
 *  placements. The page interpolates the placements — slerp the rotation, lerp
 *  the origin — so every pair is rigid and correct at every value of the
 *  slider, and only their arrangement changes. Which is the truth: twisting DNA
 *  does not deform the bases.
 *
 *  ---------------------------------------------------------------------------
 *  WHAT IS AND IS NOT IN THE BAKED FILE
 *  ---------------------------------------------------------------------------
 *  Heavy atoms only — 1BNA is a 1.9 Å X-ray structure and has no hydrogens to
 *  give. Saying so is better than inventing them. Bonds are derived by distance
 *  (nothing under 1.8 Å between heavy atoms is not a bond at this resolution)
 *  because the PDB carries no CONECT records for standard residues.
 *
 *  Output is a plain .js that assigns window.BDNA — not JSON. A generated
 *  script still loads with a <script> tag, so the repo's no-build contract
 *  holds; a runtime fetch would break it.
 *
 *  Run:  node dna/bake-ladder.js
 * ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'data', '1BNA.pdb');
const OUT = path.join(__dirname, 'data', 'bdna.js');

const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const mul=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const len=a=>Math.hypot(a[0],a[1],a[2]);
const unit=a=>{const l=len(a); return l>1e-9?mul(a,1/l):[0,0,0];};
const mean=xs=>xs.reduce((s,v)=>s+v,0)/xs.length;

const GLYCO = { DA:'N9', DG:'N9', DC:'N1', DT:'N1' };
const RING  = ['N1','C2','N3','C4','C5','C6'];
// Everything on the sugar or phosphate. The rest of a residue is the base.
const BACKBONE = new Set(["P","OP1","OP2","O1P","O2P","O5'","C5'","C4'","O4'",
                          "C3'","O3'","C2'","C1'","O2'"]);

function parse(text){
  const res = new Map();
  for(const line of text.split('\n')){
    if(!line.startsWith('ATOM')) continue;
    const alt = line.slice(16,17).trim(); if(alt && alt!=='A') continue;
    const name = line.slice(12,16).trim();
    const el   = (line.slice(76,78).trim() || name[0]).replace(/[0-9]/g,'');
    const chain= line.slice(21,22).trim();
    const seq  = parseInt(line.slice(22,26),10);
    const key  = chain+':'+seq;
    if(!res.has(key)) res.set(key,{ chain, seq, name:line.slice(17,20).trim(), atoms:[] });
    res.get(key).atoms.push({ name, el, pos:[+line.slice(30,38),+line.slice(38,46),+line.slice(46,54)] });
  }
  return res;
}
const atomOf = (r,n) => (r.atoms.find(a=>a.name===n)||{}).pos;

function planeNormal(r){
  const pts = RING.map(n=>atomOf(r,n)).filter(Boolean);
  if(pts.length<3) return null;
  let n=[0,0,0];
  for(let i=0;i<pts.length;i++){
    const a=pts[i], b=pts[(i+1)%pts.length];
    n=add(n,[(a[1]-b[1])*(a[2]+b[2]),(a[2]-b[2])*(a[0]+b[0]),(a[0]-b[0])*(a[1]+b[1])]);
  }
  return unit(n);
}

function axisOf(points){
  const c = mul(points.reduce(add,[0,0,0]), 1/points.length);
  const d = points.map(p=>sub(p,c));
  let v = unit(sub(points[points.length-1], points[0]));
  for(let i=0;i<200;i++){
    let n=[0,0,0]; for(const x of d) n=add(n,mul(x,dot(x,v)));
    const u=unit(n); if(len(sub(u,v))<1e-12){ v=u; break; } v=u;
  }
  return { centre:c, dir:v };
}

function bake(){
  const res = parse(fs.readFileSync(SRC,'utf8'));

  /* ---- pair the strands, and build each pair's own frame ---------------- */
  const raw = [];
  for(let i=1;i<=12;i++){
    const a=res.get('A:'+i), b=res.get('B:'+(25-i));
    if(!a||!b) throw new Error('missing residue for pair '+i);
    const c1a=atomOf(a,"C1'"), c1b=atomOf(b,"C1'");
    const ga=atomOf(a,GLYCO[a.name]), gb=atomOf(b,GLYCO[b.name]);
    if(!c1a||!c1b||!ga||!gb) throw new Error('pair '+i+' missing C1 or glycosidic N');
    const gly = len(sub(ga,gb));
    if(gly<8||gly>10) throw new Error(`pair ${i}: N9–N1 ${gly.toFixed(2)} Å — mis-paired?`);
    const na=planeNormal(a), nb=planeNormal(b);
    raw.push({ i, a, b, c1a, c1b, ga, gb,
      origin: mul(add(c1a,c1b),0.5),
      long:   unit(sub(c1b,c1a)),
      // pair normal: the two bases are propellered, so average them
      norm:   unit(add(na, dot(na,nb)<0 ? mul(nb,-1) : nb)) });
    // NOTE: this normal's SIGN is still arbitrary — see the fix-up below.
  }

  /* THE AXIS IS FITTED TO ALL TWELVE PAIRS — deliberately different from
   * bake-helix.js, which fits the interior eight.
   *
   * They want different things. bake-helix is MEASURING rise and twist, and
   * the frayed ends would bias those, so it drops them. This is PLACING every
   * pair that will be drawn, and an axis fitted only to the middle leaves the
   * ends of a bent dodecamer swinging 6.4 Å out from it — the molecule renders
   * banana-shaped and the wind drags the ends somewhere the eye reads as a
   * break in the duplex. Fitting all twelve puts the worst pair 3.3 Å out and
   * the spread is even end to end.
   *
   * The bend is real either way; this is a choice about which straight line to
   * measure it against, and the honest one for drawing is the line through
   * everything being drawn. */
  const inner = raw.slice(2,-2);          // still the interior for rise/twist
  const ax = axisOf(raw.map(p=>p.origin));
  /* Point the axis along the CHAIN, not along world +Y. The power iteration
   * returns ±the principal direction depending on its seed, and keying the
   * flip off the y component is a coincidence that held for one fit and broke
   * on the next: the all-twelve axis came back reversed relative to the
   * residue order, so rise and twist both went negative and the ladder built
   * itself upside down against its own helix. The invariant that actually
   * means something is that pair 0 sits at the bottom. */
  const Y = dot(sub(raw[raw.length-1].origin, raw[0].origin), ax.dir) < 0
    ? mul(ax.dir,-1) : ax.dir;
  const X0 = unit(sub(inner[0].long, mul(Y, dot(inner[0].long, Y))));
  const Z0 = cross(X0, Y);
  const toWorld = p => { const d = sub(p, ax.centre);
    return [dot(d,X0), dot(d,Y), dot(d,Z0)]; };

  /* GIVE EVERY PAIR THE SAME SENSE OF UP.
   *
   * planeNormal() returns whichever way the ring's winding order happens to
   * point, and that order differs between a purine and a pyrimidine — so the
   * twelve pair normals came out with their signs scattered (+,−,+,−,−,−,+,…).
   * Each frame is still a valid right-handed rotation, which is why the HELIX
   * pose renders correctly: a flipped frame flips the local coordinates in
   * exactly the way that cancels when they are placed back.
   *
   * The ladder is where it shows. Squaring every pair to a common orientation
   * puts the flipped half face-down between their neighbours, and the stack
   * reads as though sections of it spin through two turns. Anchoring the sign
   * to the helix axis costs one line and is the difference between a ladder
   * and a jumble. */
  for(const p of raw) if(dot(p.norm, Y) < 0) p.norm = mul(p.norm, -1);

  /* ---- each pair: local atoms + its placement in the helix -------------- */
  const rise = [], twist = [];
  for(let k=0;k+1<inner.length;k++){
    rise.push(dot(sub(inner[k+1].origin, inner[k].origin), Y));
    // turn of the pair's long axis about the helix axis, measured in the plane
    const flat = v => unit(sub(v, mul(Y, dot(v, Y))));
    const u1 = flat(inner[k].long), u2 = flat(inner[k+1].long);
    twist.push(Math.atan2(dot(cross(u1,u2), Y), dot(u1,u2)) * 180/Math.PI);
  }
  const RISE = mean(rise), TWIST = mean(twist);

  const pairs = raw.map((p, idx) => {
    // The pair's own orthonormal frame, in the re-framed (Y-up) coordinates.
    const o = toWorld(p.origin);
    const ex = unit(toWorld(add(p.origin, p.long)).map((v,j)=>v-o[j]));
    const ez = unit(toWorld(add(p.origin, p.norm)).map((v,j)=>v-o[j]));
    const ey = unit(cross(ez, ex));
    const exo = unit(cross(ey, ez));      // re-orthogonalise x against y,z

    const atoms = [], index = {};      // "A:O3'" -> position in `atoms`
    for(const [r, strand] of [[p.a,0],[p.b,1]]){
      for(const at of r.atoms){
        index[r.chain + ':' + at.name] = atoms.length;
        const w = sub(toWorld(at.pos), o);
        atoms.push({ el:at.el, strand,
          part: BACKBONE.has(at.name) ? 1 : 0,        // 1 = sugar/phosphate
          p:[+dot(w,exo).toFixed(3), +dot(w,ey).toFixed(3), +dot(w,ez).toFixed(3)] });
      }
    }
    // bonds within the pair, by distance — no CONECT records to read
    const bonds = [];
    for(let m=0;m<atoms.length;m++) for(let n=m+1;n<atoms.length;n++){
      const d = len(sub(atoms[m].p, atoms[n].p));
      if(d < 1.8) bonds.push([m,n]);
    }
    // basis as a row-major 3x3, so the page can build a quaternion from it
    return { i:idx, seq:p.a.name+'-'+p.b.name, index,
      origin:o.map(v=>+v.toFixed(3)),
      basis:[exo,ey,ez].map(v=>v.map(x=>+x.toFixed(6))),
      ladder:[0, +( (idx - (raw.length-1)/2) * RISE ).toFixed(3), 0],
      atoms, bonds };
  });

  /* ---- the phosphodiester bonds BETWEEN pairs (needs `pairs`) ----------- */
  // The backbone runs from one nucleotide's O3′ to the next one's P, which is a
  // bond between two different base pairs — so it cannot live inside either.
  // Without these the ladder falls apart into twelve floating rungs, and the
  // grooves (which are gaps BETWEEN backbone strands) have no edges.
  // BOTH STRANDS RUN 5′→3′ IN THEIR OWN DIRECTION, which is the whole point of
  // antiparallel — so the link is always O3′(n) → P(n+1) along the residue
  // numbering, for each chain separately. Walking chain B downward instead
  // (24→23, "following" chain A) puts O3′ next to the wrong phosphate: every
  // distance lands past the 2 Å cutoff and half the backbone silently vanishes.
  // Chain A is residues 1–12 and chain B is 13–24, with A:i paired to B:25−i,
  // so B:(13+k) belongs to base pair 11−k.
  const links = [];
  for(let k=0;k+1<12;k++){
    for(const [strand, ra, rb, pa, pb] of [
      [0, res.get('A:'+(k+1)),  res.get('A:'+(k+2)),  k,      k+1],
      [1, res.get('B:'+(13+k)), res.get('B:'+(14+k)), 11-k,   10-k]]){
      if(!ra||!rb) continue;
      const o3 = atomOf(ra,"O3'"), P = atomOf(rb,'P');
      if(!o3||!P) continue;
      const d = len(sub(o3,P));
      if(d > 2.0) throw new Error(
        `strand ${strand}: O3′→P is ${d.toFixed(2)} Å between residues — `
        + `the chain is being walked in the wrong direction`);
      links.push({ strand,
                   from:{ pair:pa, ai:pairs[pa].index[ra.chain + ":O3'"] },
                   to:  { pair:pb, ai:pairs[pb].index[rb.chain + ':P'] },
                   d:+d.toFixed(3) });
    }
  }

  return { rise:+RISE.toFixed(3), twistDeg:+TWIST.toFixed(2),
           n:pairs.length, links, pairs,
           source:'1BNA (Drew–Dickerson dodecamer), heavy atoms only' };
}

module.exports = { bake, OUT };

if(require.main === module){
  const d = bake();
  const head = '/* Do not edit — generated by dna/bake-ladder.js from dna/data/1BNA.pdb.\n'
    + ' * ' + d.source + '\n'
    + ' * ' + d.n + ' base pairs, mean rise ' + d.rise + ' Å.\n'
    + ' * Each pair carries its atoms in its OWN frame plus two placements:\n'
    + ' * `origin`+`basis` (the helix, as deposited) and `ladder` (untwisted).\n'
    + ' */\n';
  fs.writeFileSync(OUT, head + 'window.BDNA = ' + JSON.stringify(d) + ';\n');
  const kb = (fs.statSync(OUT).size/1024).toFixed(0);
  console.log(`${d.n} pairs, rise ${d.rise} Å, twist ${d.twistDeg}°, `
    + `${d.links.length} backbone links`);
  console.log(`atoms/pair: ${d.pairs.map(p=>p.atoms.length).join(',')}`);
  console.log(`wrote ${path.relative(process.cwd(), OUT)} (${kb} KB)`);
}
