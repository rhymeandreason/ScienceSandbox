/* sdf2spec.js — PROTOTYPE: PubChem 3D SDF -> MolLib amino-acid spec.
 *
 * Demonstrates the three steps a real converter needs:
 *   1. parse   — atoms, bonds, and BOND ORDERS straight out of the SDF
 *   2. reindex — force the library's fixed amino-acid atom order, because
 *                `pep:{cC,oOH,hOH,nN,hN}` and aminoacid-lab.html index into it
 *   3. frame   — recentre on Ca, align backbone to +X / side chain to -Y,
 *                then apply ONE global scale so sticks clear the display radii
 */
const fs = require('fs');

const RADII = { O:0.95, H:0.55, C:0.85, N:0.90, S:1.05, P:1.00 };
const SCALE = 1.9;        // one global factor; preserves relative bond lengths
const MIN_GAP = 0.10;     // stick must protrude at least this much past the spheres

// ---- 1. parse --------------------------------------------------------
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
                 parseInt(l.slice(6,9),10) ]);   // <- bond ORDER, for free
  }
  return { atoms, bonds };
}

// ---- vector helpers --------------------------------------------------
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const len=a=>Math.sqrt(dot(a,a));
const norm=a=>{const n=len(a);return [a[0]/n,a[1]/n,a[2]/n];};
const angle=(a,b,c)=>{const u=norm(sub(a,b)),v=norm(sub(c,b));
  return Math.acos(Math.max(-1,Math.min(1,dot(u,v))))*180/Math.PI;};

// ---- 2. reindex to the library's fixed backbone order ----------------
// 0 N · 1 H · 2 H · 3 Ca · 4 H · 5 C · 6 O(=O) · 7 O(-OH) · 8 H · 9.. R
function reindex(m){
  const nb = i => m.bonds.filter(b=>b[0]===i||b[1]===i)
                         .map(b=>b[0]===i?b[1]:b[0]);
  const el = i => m.atoms[i].el;
  const N  = m.atoms.findIndex(a=>a.el==='N');
  // Ca: the carbon bonded to N that is NOT the carboxyl carbon
  const Ca = nb(N).find(i=>el(i)==='C' && nb(i).filter(j=>el(j)==='O').length===0);
  const Cc = nb(Ca).find(i=>el(i)==='C' && nb(i).filter(j=>el(j)==='O').length===2);
  const Os = nb(Cc).filter(i=>el(i)==='O');
  const Ocarbonyl = Os.find(i=>nb(i).length===1);          // =O has no H
  const Ohydroxyl = Os.find(i=>i!==Ocarbonyl);
  const Hoh = nb(Ohydroxyl).find(i=>el(i)==='H');
  const Hn  = nb(N).filter(i=>el(i)==='H');
  const Hca = nb(Ca).filter(i=>el(i)==='H');
  const R   = nb(Ca).find(i=>i!==N && i!==Cc && el(i)!=='H');

  const order = [N, Hn[0], Hn[1], Ca, Hca[0], Cc, Ocarbonyl, Ohydroxyl, Hoh];
  // side chain: R and everything hanging off it, breadth-first from Ca
  if(R!=null){
    const seen = new Set([...order, Ca]);
    const queue = [R];
    while(queue.length){
      const i = queue.shift();
      if(seen.has(i)) continue;
      seen.add(i); order.push(i);
      nb(i).forEach(j=>{ if(!seen.has(j)) queue.push(j); });
    }
  }
  // glycine's R is a plain H — it is Hca[1], appended last by convention
  if(R==null && Hca[1]!=null) order.push(Hca[1]);

  const map = new Map(order.map((old,neu)=>[old,neu]));
  return {
    atoms: order.map(i=>({ el:m.atoms[i].el, pos:m.atoms[i].pos })),
    bonds: m.bonds.filter(b=>map.has(b[0]) && map.has(b[1]))
                  .map(b=>[map.get(b[0]), map.get(b[1]), b[2]])
                  .sort((a,b)=>a[0]-b[0]||a[1]-b[1]),
  };
}

// ---- 3. reframe + scale ---------------------------------------------
function reframe(m){
  const P = m.atoms.map(a=>a.pos);
  const Ca = P[3], N = P[0], Cc = P[5], R = P[9] || P[4];
  // The basis MUST stay right-handed. Projecting onto an orthonormal (e1,e2,e3)
  // is a rotation and preserves chirality; negating a single output component to
  // aim the side chain at -Y is a REFLECTION, and silently turns every L-amino
  // acid into its D- mirror image. (It did exactly that, and nothing caught it:
  // bond lengths, every angle, and the render are all identical in a mirror.)
  // So flip the AXIS and rebuild e3 from it, keeping e3 = e1 x e2 throughout.
  const e1 = norm(sub(Cc, N));                       // backbone N->C  => +X
  let w = sub(R, Ca);
  w = sub(w, e1.map(c=>c*dot(w,e1)));
  const e2 = norm(w).map(c=>-c);                     // side chain     => -Y
  const e3 = cross(e1, e2);                          // right-handed by construction
  // optH: hydrogens the "show extra H" toggle may hide. Only NONPOLAR C-H
  // qualifies — an H on N/O/S is an H-bond DONOR and carries the lesson, so it
  // is never optional. Matches the H-omission policy in SCIENCE.md 12.
  const nb = i => m.bonds.filter(b=>b[0]===i||b[1]===i).map(b=>b[0]===i?b[1]:b[0]);
  const optH = m.atoms.map((a,i)=>
      (a.el==='H' && nb(i).every(j=>m.atoms[j].el==='C')) ? i : -1)
    .filter(i=>i>=0);
  return {
    atoms: m.atoms.map(a=>{
      const v = sub(a.pos, Ca);
      return { el:a.el, pos:[ dot(v,e1)*SCALE, dot(v,e2)*SCALE, dot(v,e3)*SCALE ]
                             .map(x=>+x.toFixed(3)) };
    }),
    bonds: m.bonds.map(b=>b[2]===1?[b[0],b[1]]:[b[0],b[1],b[2]]),
    optH,
  };
}

// ---- report ----------------------------------------------------------
function report(name, spec){
  console.log(`\n== ${name} (${spec.atoms.length} atoms, ${spec.bonds.length} bonds)`);
  let bad = 0, maxZ = 0;
  spec.atoms.forEach(a=>maxZ = Math.max(maxZ, Math.abs(a.pos[2])));
  spec.bonds.forEach(b=>{
    const [i,j] = b, L = len(sub(spec.atoms[i].pos, spec.atoms[j].pos));
    const need = (RADII[spec.atoms[i].el]||0.7) + (RADII[spec.atoms[j].el]||0.7);
    const gap = L - need;
    if(gap < MIN_GAP){ bad++;
      console.log(`   MERGE ${spec.atoms[i].el}${i}-${spec.atoms[j].el}${j}` +
                  ` len ${L.toFixed(3)} needs ${need.toFixed(2)} gap ${gap.toFixed(3)}`); }
  });
  const A = (i,j,k)=>angle(spec.atoms[i].pos, spec.atoms[j].pos, spec.atoms[k].pos).toFixed(1);
  console.log(`   angles  N-Ca-C ${A(0,3,5)}  Ca-C=O ${A(3,5,6)}  O=C-O ${A(6,5,7)}` +
              `  C-O-H ${A(5,7,8)}  N-Ca-H ${A(0,3,4)}`);
  console.log(`   optH    ${spec.optH.join(',')||'none'}`);
  console.log(`   doubles ${spec.bonds.filter(b=>b[2]===2).map(b=>b[0]+'='+b[1]).join(' ')||'none'}`);
  console.log(`   max |z| ${maxZ.toFixed(3)}  (current specs are all 0.000 — planar)`);
  console.log(`   ${bad} merging bond(s)`);
  return spec;
}

const out = {};
for(const name of process.argv.slice(2)){
  const spec = reframe(reindex(parseSDF(fs.readFileSync(`${name}.sdf`,'utf8'))));
  out[name] = report(name, spec);
}
fs.writeFileSync('generated-specs.json', JSON.stringify(out,null,2));
console.log('\nwrote generated-specs.json');
