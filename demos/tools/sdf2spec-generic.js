/* sdf2spec-generic.js — PubChem 3D SDF -> MolLib spec, for molecules that are
 * NOT amino acids.
 *
 * `sdf2spec.js` exists to force the library's fixed amino-acid backbone order,
 * because `pep:{cC,oOH,hOH,nN,hN}` and tests/aminoacid-lab.html index into it. A sugar
 * or a nucleotide has no such contract, so this converter keeps the SDF's own
 * atom order and only does the two steps that are universal:
 *
 *   1. parse   — atoms, bonds and BOND ORDERS out of the SDF (same as sdf2spec)
 *   2. reframe — recentre, orient, and apply ONE global scale so the sticks
 *                clear this project's enlarged display radii
 *
 * Orientation: if the molecule has a 5- or 6-ring, the ring's mean plane becomes
 * XY (its normal -> +Z), so a pyranose lands face-on and the axial/equatorial
 * pattern that `check-molecules.js` audits is the thing you see. Otherwise the
 * longest atom-pair axis becomes +X.
 *
 * As in sdf2spec.js, the basis MUST stay right-handed (e3 = e1 x e2). Negating a
 * single output component is a REFLECTION: it turns D-glucose into L-glucose
 * while leaving every bond length, every angle and the render identical.
 *
 *   node sdf2spec-generic.js beta-D-glucopyranose
 *   # -> generated-specs-generic.json
 */
const fs = require('fs');

const RADII = { O:0.95, H:0.55, C:0.85, N:0.90, S:1.05, P:1.00 };
const MIN_GAP = 0.10;

// ---- 1. parse (identical to sdf2spec.js) -----------------------------
function parseSDF(text){
  const L = text.split('\n');
  const nA = parseInt(L[3].slice(0,3),10), nB = parseInt(L[3].slice(3,6),10);
  const atoms = [], bonds = [];
  for(let i=0;i<nA;i++){
    const l = L[4+i];
    atoms.push({ el:l.slice(31,34).trim(),
                 pos:[+l.slice(0,10), +l.slice(10,20), +l.slice(20,30)] });
  }
  for(let i=0;i<nB;i++){
    const l = L[4+nA+i];
    bonds.push([ parseInt(l.slice(0,3),10)-1, parseInt(l.slice(3,6),10)-1,
                 parseInt(l.slice(6,9),10) ]);
  }
  return { atoms, bonds };
}

// ---- vector helpers --------------------------------------------------
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const len=a=>Math.sqrt(dot(a,a));
const norm=a=>{const n=len(a)||1;return [a[0]/n,a[1]/n,a[2]/n];};

// smallest 5-/6-cycle in the bond graph — same routine as check-molecules.js,
// so what we orient on is what that script later audits
function findRing(atomCount, bonds){
  const adj = Array.from({length:atomCount},()=>[]);
  bonds.forEach(([i,j])=>{adj[i].push(j); adj[j].push(i);});
  for(const [i,j] of bonds){
    const prev = new Map([[i,null]]); const queue=[i]; let done=false;
    while(queue.length && !done){
      const u=queue.shift();
      for(const v of adj[u]){
        if((u===i&&v===j)||(u===j&&v===i)) continue;
        if(prev.has(v)) continue;
        prev.set(v,u);
        if(v===j){done=true;break;}
        queue.push(v);
      }
    }
    if(!prev.has(j)) continue;
    const path=[]; for(let c=j;c!==null;c=prev.get(c)) path.push(c);
    if(path.length===5 || path.length===6) return path;
  }
  return null;
}

// ---- 2. reframe + scale ---------------------------------------------
function reframe(m){
  const P = m.atoms.map(a=>a.pos);
  const heavy = m.atoms.map((a,i)=>i).filter(i=>m.atoms[i].el!=='H');
  const ctr = heavy.reduce((s,i)=>add(s,P[i]),[0,0,0]).map(c=>c/heavy.length);

  const ring = findRing(m.atoms.length, m.bonds);
  let e1, e2, e3;
  if(ring){
    // ring mean-plane normal -> +Z, summed over edges so a puckered chair still
    // gives a stable axis rather than one triangle's normal
    const rc = ring.reduce((s,i)=>add(s,P[i]),[0,0,0]).map(c=>c/ring.length);
    let n=[0,0,0];
    for(let k=0;k<ring.length;k++)
      n = add(n, cross(sub(P[ring[k]],rc), sub(P[ring[(k+1)%ring.length]],rc)));
    e3 = norm(n);
    let w = sub(P[ring[0]], rc);                    // first ring atom -> +X
    w = sub(w, e3.map(c=>c*dot(w,e3)));
    e1 = norm(w);
    e2 = cross(e3, e1);                             // right-handed: e3 = e1 x e2
  } else {
    // no ring: longest heavy-atom axis -> +X, widest perpendicular spread -> +Y
    let best=[0,0,0], bd=-1;
    for(const i of heavy) for(const j of heavy){
      const d=len(sub(P[i],P[j])); if(d>bd){bd=d; best=sub(P[j],P[i]);}
    }
    e1 = norm(best);
    let w=[0,0,0], bw=-1;
    for(const i of heavy){
      let v = sub(P[i], ctr); v = sub(v, e1.map(c=>c*dot(v,e1)));
      if(len(v)>bw){bw=len(v); w=v;}
    }
    e2 = norm(w);
    e3 = cross(e1, e2);
  }

  // optH: nonpolar C–H only. An H on N/O/S/P is an H-bond donor and carries the
  // lesson, so it is never optional (same policy as sdf2spec.js).
  const nb = i => m.bonds.filter(b=>b[0]===i||b[1]===i).map(b=>b[0]===i?b[1]:b[0]);
  const optH = m.atoms.map((a,i)=>
      (a.el==='H' && nb(i).every(j=>m.atoms[j].el==='C')) ? i : -1)
    .filter(i=>i>=0);

  return {
    atoms: m.atoms.map(a=>{
      const v = sub(a.pos, ctr);
      return { el:a.el, pos:[dot(v,e1), dot(v,e2), dot(v,e3)]
                            .map(x=>+x.toFixed(3)) };
    }),
    bonds: m.bonds.map(b=>b[2]===1?[b[0],b[1]]:[b[0],b[1],b[2]]),
    optH,
  };
}

// ---- report ----------------------------------------------------------
function report(name, spec){
  console.log(`\n== ${name} (${spec.atoms.length} atoms, ${spec.bonds.length} bonds)`);
  let bad = 0;
  spec.bonds.forEach(([i,j])=>{
    const L = len(sub(spec.atoms[i].pos, spec.atoms[j].pos));
    const need = (RADII[spec.atoms[i].el]||0.7) + (RADII[spec.atoms[j].el]||0.7);
    if(L - need < MIN_GAP){ bad++;
      console.log(`   MERGE ${spec.atoms[i].el}${i}-${spec.atoms[j].el}${j}` +
                  ` len ${L.toFixed(3)} needs ${need.toFixed(2)} gap ${(L-need).toFixed(3)}`); }
  });
  console.log(`   optH    ${spec.optH.join(',')||'none'}`);
  console.log(`   doubles ${spec.bonds.filter(b=>b[2]===2).map(b=>b[0]+'='+b[1]).join(' ')||'none'}`);
  console.log(`   ${bad} merging bond(s) — run ../check-molecules.js after pasting in`);
  return spec;
}

const out = {};
for(const name of process.argv.slice(2)){
  out[name] = report(name, reframe(parseSDF(fs.readFileSync(`${name}.sdf`,'utf8'))));
}
fs.writeFileSync('generated-specs-generic.json', JSON.stringify(out,null,2));
console.log('\nwrote generated-specs-generic.json');
