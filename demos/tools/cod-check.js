#!/usr/bin/env node
/* =====================================================================
 *  cod-check.js — audit a Skel-built sugar against a MEASURED structure
 *
 *  Run:  node tools/cod-check.js glucose 2101292.cif
 *
 *  Fetch a reference first (see REFERENCES below for ids that are known good):
 *    curl -o 2101292.cif https://www.crystallography.net/cod/cif/2/10/12/2101292.cif
 *
 * ---------------------------------------------------------------------
 *  THIS IS NOT PART OF THE PIPELINE, AND SHOULD NOT BECOME PART OF IT.
 * ---------------------------------------------------------------------
 *  check-molecules.js and check-docs.js are GUARDS: offline, instant, no
 *  dependencies, run on every change, and they catch drift. This is an AUDIT:
 *  run once per molecule, deliberately, by a human who then commits the verdict
 *  into that spec's `validated:{}`. Three reasons it stays that way.
 *
 *  1. The answer cannot go stale. A 1995 diffraction result will not be
 *     different next week, and Skel-built geometry is regenerated
 *     deterministically from GL/AR. Once recorded, re-deriving the same fact on
 *     every run proves nothing.
 *  2. A network call inside a guard is a liability. Every other check in this
 *     repo runs with no network and no install. Wiring COD in means a check
 *     that fails for reasons unrelated to the change being tested.
 *  3. THE HARD PART IS NOT AUTOMATABLE. Picking the right reference needs
 *     judgement this script cannot supply — see the traps below. A version of
 *     this pointed at an unvetted id gives a confident wrong answer, which is
 *     worse than no answer.
 *
 *  What IS durable is the `validated:{ db, id, why, match, date }` record left
 *  in the spec. That carries the finding forward without carrying the
 *  dependency.
 *
 * ---------------------------------------------------------------------
 *  WHY THE COMPARISON IS SCALE-FREE
 * ---------------------------------------------------------------------
 *  Our specs are idealised and multiplied by SCALE (1.9), so coordinate RMSD
 *  against ångström crystal data is meaningless. Only three things are compared,
 *  and all three survive both the scaling and the crystal packing:
 *    · which ring each substituent hangs off, and its tilt from the ring plane
 *      (axial vs equatorial — the thing `stereo:` actually claims)
 *    · which FACE it sits on, relative to an anchored ring normal
 *    · the endocyclic torsions (ring pucker)
 *
 * ---------------------------------------------------------------------
 *  TRAPS, ALL MET IN PRACTICE ON 2026-07-30
 * ---------------------------------------------------------------------
 *  · THE ANOMERIC CARBON WILL OFTEN DISAGREE, AND THAT IS NOT A FAILURE.
 *    C1 is α or β depending on which anomer crystallised. Our glucose and
 *    galactose are both β; the best galactose reference is α. This script
 *    reports the anomeric position SEPARATELY for that reason — a raw mismatch
 *    count manufactures alarms about correct specs.
 *  · NAME SEARCH DOES NOT FIND THE STRUCTURE YOU WANT. COD 2101292 is
 *    β-D-glucopyranose and carries no `chemname` at all. Pull everything for a
 *    formula and classify by geometry instead:
 *      https://www.crystallography.net/cod/result?formula=C6%20H12%20O6&format=csv
 *  · SOME COD ENTRIES ARE PREDICTIONS. 2101261/2101262 come from "Attempted
 *    prediction of the crystal structures of six monosaccharides" — validating
 *    against those defeats the point, and only the title says so.
 *  · A FORCE FIELD IN THE TITLE IS NOT DISQUALIFYING. 2101291/2101292 sit in a
 *    GROMOS paper, but the field only assisted refinement of real 95 K data,
 *    and it touched H positions — which heavy-atom comparison ignores anyway.
 *  · HIGH-PRESSURE SERIES HIDE IN ORDINARY RESULTS, and the pressure is in
 *    `diffrpressure`, not the `cellpressure` field you reach for first.
 * ===================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

/* Vetted references. An id here has been read, not just found — the `why` is the
 * expensive part and the reason this table exists at all. */
const REFERENCES = {
  glucose:   { id:2101292, why:'β-D-glucopyranose, 95 K, R=0.048 — matches our anomer' },
  galactose: { id:2101291, why:'α-D-galactose, 95 K, R=0.059 — ANOMER DIFFERS from our β spec; '
                             + 'C4 is still decisive and C1 is expected to disagree' },
};

const sub   = (a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const cross = (a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot   = (a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const unit  = v=>{const l=Math.hypot(...v)||1;return v.map(x=>x/l);};
const DEG   = 180/Math.PI;

/* ---- CIF -> Cartesian ------------------------------------------------
 * Fractional coordinates times the general triclinic cell matrix. Written out
 * in full rather than assuming 90° angles: most sugars are orthorhombic or
 * monoclinic, and silently mis-transforming a monoclinic cell would skew every
 * angle by the cell's beta. */
function readCIF(file){
  const txt = fs.readFileSync(file,'utf8');
  const num = k => { const m = txt.match(new RegExp('^'+k+'\\s+([-\\d.]+)','m'));
                     return m ? +m[1] : null; };
  const a=num('_cell_length_a'), b=num('_cell_length_b'), c=num('_cell_length_c');
  if(a===null||b===null||c===null) throw new Error(`${file}: no cell parameters`);
  const al=num('_cell_angle_alpha')/DEG, be=num('_cell_angle_beta')/DEG, ga=num('_cell_angle_gamma')/DEG;
  const cA=Math.cos(al), cB=Math.cos(be), cG=Math.cos(ga), sG=Math.sin(ga);
  const vol=Math.sqrt(1-cA*cA-cB*cB-cG*cG+2*cA*cB*cG);
  const M=[[a, b*cG, c*cB],
           [0, b*sG, c*(cA-cB*cG)/sG],
           [0, 0,    c*vol/sG]];

  const lines = txt.split('\n');
  let i = lines.findIndex(l=>l.trim()==='_atom_site_label');
  if(i<0) throw new Error(`${file}: no _atom_site loop`);
  const tags=[];
  while(lines[i] && lines[i].trim().startsWith('_')) tags.push(lines[i++].trim());
  const ix = t => tags.indexOf(t);
  const [fx,fy,fz,lb,ty] = ['_atom_site_fract_x','_atom_site_fract_y','_atom_site_fract_z',
                            '_atom_site_label','_atom_site_type_symbol'].map(ix);
  if(fx<0||fy<0||fz<0) throw new Error(`${file}: atom_site loop has no fractional coordinates`);

  const strip = s => parseFloat(s.replace(/\(\d+\)/,''));   // 0.5172(5) -> 0.5172
  const atoms = {};
  for(; lines[i]!==undefined; i++){
    const t = lines[i].trim();
    if(!t || t==='loop_' || t.startsWith('_') || t.startsWith('#')) break;
    const f = t.split(/\s+/);
    if(f.length < tags.length) break;
    const p = [strip(f[fx]),strip(f[fy]),strip(f[fz])];
    atoms[f[lb]] = { el: ty>=0 ? f[ty] : f[lb].replace(/[^A-Za-z]/g,''),
                     pos:[ M[0][0]*p[0]+M[0][1]*p[1]+M[0][2]*p[2],
                                        M[1][1]*p[1]+M[1][2]*p[2],
                                                     M[2][2]*p[2] ] };
  }
  return atoms;
}

/* A spec is already Cartesian; `names` is the contract that lets both sides be
 * addressed the same way. Without it there is nothing to line up. */
function fromSpec(m,key){
  if(!m.names) throw new Error(`${key}: spec has no \`names\`, nothing to match on`);
  const o={};
  m.names.forEach((n,i)=>{ o[n]={ el:m.atoms[i].el, pos:m.atoms[i].pos }; });
  return o;
}

/* The pyranose/furanose ring, by label. Both sides use sugar numbering, so the
 * ring is C1..Cn plus the ring oxygen — O5 for a pyranose, O4 for a furanose. */
function findRing(at){
  for(const [n,ox] of [[5,'O5'],[4,'O4']]){
    const carbons=[]; for(let k=1;k<=n;k++) carbons.push('C'+k);
    if(carbons.every(c=>at[c]) && at[ox]) return { ring:[...carbons,ox], size:n+1, ox };
  }
  return null;
}

function analyse(at,label){
  const R = findRing(at);
  if(!R){ console.log(`   ${label}: no pyranose or furanose ring found`); return null; }
  const P = R.ring.map(n=>at[n].pos);
  const cen = [0,1,2].map(k=>P.reduce((s,p)=>s+p[k],0)/P.length);

  // Best-fit plane normal, summed around the ring so no single triplet dominates.
  let N=[0,0,0];
  for(let i=0;i<P.length;i++){
    const c = cross(sub(P[i],cen), sub(P[(i+1)%P.length],cen));
    N=[N[0]+c[0],N[1]+c[1],N[2]+c[2]];
  }
  N = unit(N);

  // The normal's sign is arbitrary — it flips with traversal direction — so it is
  // ANCHORED, not trusted: the exocyclic carbon on the last ring carbon is drawn
  // up by D-sugar convention. haworth.js anchors the same way, for the same reason.
  const lastC = 'C'+(R.size-1), exo = 'C'+R.size;
  if(at[exo] && at[lastC] && dot(unit(sub(at[exo].pos,at[lastC].pos)),N)<0) N=N.map(x=>-x);

  const rows=[];
  for(let k=1;k<=R.size-1;k++){
    const c='C'+k;
    const s = k===R.size-1 ? exo : 'O'+k;      // ring carbons carry -OH; the last carries -CH2OH
    if(!at[c]||!at[s]) continue;
    const d = dot(unit(sub(at[s].pos,at[c].pos)), N);
    const tilt = Math.abs(Math.asin(Math.max(-1,Math.min(1,d)))*DEG);
    rows.push({ c, s, tilt, face: d>=0?'up':'down', kind: tilt>45?'axial':'equatorial',
                anomeric: k===1 });
  }

  const tor=[];
  for(let i=0;i<P.length;i++){
    const q=[P[i],P[(i+1)%P.length],P[(i+2)%P.length],P[(i+3)%P.length]];
    const b1=sub(q[1],q[0]), b2=sub(q[2],q[1]), b3=sub(q[3],q[2]);
    const n1=cross(b1,b2), n2=cross(b2,b3);
    tor.push(Math.atan2(dot(cross(n1,unit(b2)),n2), dot(n1,n2))*DEG);
  }

  console.log(`\n== ${label}   (${R.size===6?'pyranose':'furanose'}: ${R.ring.join('-')})`);
  rows.forEach(r=>console.log('   '+(r.c+'->'+r.s).padEnd(10),
    (r.tilt.toFixed(1)+'°').padStart(6), ' ', r.face.padEnd(5), r.kind,
    r.anomeric?'   <- anomeric':''));
  console.log('   ring torsions:', tor.map(t=>t.toFixed(0).padStart(4)).join(' '));
  return { rows, tor };
}

/* ---- main -----------------------------------------------------------*/
const [key,cif] = process.argv.slice(2);
if(!key || !cif){
  console.log('usage: node tools/cod-check.js <spec-name> <file.cif>\n');
  console.log('vetted references:');
  for(const [k,v] of Object.entries(REFERENCES))
    console.log(`  ${k.padEnd(11)} COD ${v.id}  ${v.why}`);
  process.exit(1);
}
const MOLECULES = require(path.join(__dirname,'..','lib', 'lib-node.js')).MOLECULES;
const spec = MOLECULES[key];
if(!spec){ console.log(`no spec named ${key}`); process.exit(1); }
if(REFERENCES[key]) console.log(`reference note: ${REFERENCES[key].why}`);

const measured = analyse(readCIF(cif), `measured — ${path.basename(cif)}`);
const ours     = analyse(fromSpec(spec,key), `our ${key} (Skel-built)`);
if(!measured || !ours) process.exit(1);

/* The verdict splits the anomeric carbon out. Everything else is a claim about
 * the sugar's identity and must match; C1 is a claim about which anomer
 * crystallised, and the reference is frequently the other one. */
console.log('\n-- verdict');
let bad=0, anomerDiffers=false;
for(const r of ours.rows){
  const m = measured.rows.find(x=>x.c===r.c);
  if(!m){ console.log(`   ${r.c}: not present in the reference`); continue; }
  const same = m.kind===r.kind && m.face===r.face;
  if(r.anomeric && !same) anomerDiffers=true; else if(!same) bad++;
  console.log('   '+(r.c+'->'+r.s).padEnd(10),
    (m.kind+'/'+m.face).padEnd(18),'vs',(r.kind+'/'+r.face).padEnd(18),
    same ? 'ok' : (r.anomeric ? 'differs (anomer)' : 'MISMATCH'));
}
const dt = ours.tor.map((t,i)=>Math.abs(Math.abs(t)-Math.abs(measured.tor[i])));
console.log('   max |torsion| difference:', Math.max(...dt).toFixed(1)+'°');

if(anomerDiffers) console.log('\n   NOTE: the anomeric carbon differs — the reference is the other\n'
  + '   anomer. Expected, and not a defect. Confirm against the CIF\'s own title\n'
  + '   before treating it as anything else.');
if(bad){
  console.log(`\nFAIL: ${bad} non-anomeric substituent(s) disagree with the measured structure`);
  process.exit(1);
}
console.log('\nPASS: every non-anomeric substituent matches the measured structure in kind and face');
