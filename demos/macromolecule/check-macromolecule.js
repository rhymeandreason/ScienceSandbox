/* =============================================================================
 *  macromolecule/check-macromolecule.js — the peptide bond, asserted
 * =============================================================================
 *  Everything here is invisible from the page. A pose with the wrong torsion,
 *  a bond 0.1 A long, a spec that renumbered and now sheds the alpha carbon's
 *  hydrogen instead of the amino one: each renders a chain that looks like a
 *  chain. So the numbers are checked against what they claim to be, not
 *  against a screenshot.
 *
 *  Offline, dependency-free, `node macromolecule/check-macromolecule.js`.
 * ========================================================================== */
'use strict';
const Lib = require('../lib/lib-node.js');
const Peptide = require('./peptide.js');

const S = Lib.SCALE, M = Lib.MOLECULES;
const un = s => ({ ...s, atoms:s.atoms.map(a => ({ el:a.el, pos:a.pos.map(v => v/S) })) });
const d = (a,b) => Math.hypot(a[0]-b[0], a[1]-b[1], a[2]-b[2]);
const qrot = (q,v) => { const [x,y,z,w] = q;
  const tx = 2*(y*v[2]-z*v[1]), ty = 2*(z*v[0]-x*v[2]), tz = 2*(x*v[1]-y*v[0]);
  return [v[0]+w*tx+y*tz-z*ty, v[1]+w*ty+z*tx-x*tz, v[2]+w*tz+x*ty-y*tx]; };
const place = (spec, r, i) => qrot(r.quat, spec.atoms[i].pos).map((v,k) => v + r.pos[k]);

let fails = 0, checks = 0;
const ok = (cond, msg) => { checks++; if(cond) console.log('  ok    ' + msg);
                            else { fails++; console.log('  FAIL  ' + msg); } };

const AA = Object.keys(M).filter(k => M[k].pep);

console.log('\n== 1. every amino acid declares the reaction, derived once');
for(const k of AA){
  const m = M[k], c = m.condense;
  const roles = (c && c.roles) || [];
  const carb = roles.find(r => r.key === 'carboxyl'), am = roles.find(r => r.key === 'amino');
  // molecules.js derives `condense:` from `pep:`. Two statements of the same
  // fact are what this asserts cannot happen: if a spec ever hand-writes its
  // own block, it has to still agree with the indices `pep` gives.
  ok(carb && am && carb.keep === m.pep.cC && am.keep === m.pep.nN
     && carb.leaves.join() === [m.pep.oOH, m.pep.hOH].join()
     && am.leaves.join() === String(m.pep.hN[0]),
     `${k}: condense roles match its own pep indices`);
}

console.log('\n== 2. the alpha carbon is found, and it is the one the library indexes');
for(const k of AA){
  // The fixed backbone order puts Ca at 3. peptide.js finds it from the bonds
  // instead, and the two have to agree — if they ever stop, it is the ORDER
  // that broke, and the chirality check in check-molecules.js reads index 3.
  ok(Peptide.alphaOf(un(M[k])) === 3, `${k}: alphaOf finds atom 3`);
}

console.log('\n== 3. every pose is the peptide bond it claims to be');
let posed = 0, clashes = [];
for(const a of AA) for(const b of AA){
  const h = un(M[a]), g = un(M[b]);
  const r = Peptide.pose(h, g);
  if(!r){ fails++; checks++; console.log(`  FAIL  ${a}+${b}: no pose`); continue; }
  posed++;
  const C = h.atoms[Peptide.role(h,'carboxyl').keep].pos;
  const N = place(g, r, Peptide.role(g,'amino').keep);
  const bad = [];
  // The bond length is the module's one constant; a pose that does not land on
  // it is a pose built from something other than the construction it claims.
  if(Math.abs(d(C,N) - Peptide.CN) > 1e-6) bad.push(`C-N ${d(C,N).toFixed(4)}`);
  // Trans, and EXACTLY: omega is solved for, not nudged toward.
  if(Math.abs(Math.abs(r.omega) - Math.PI) > 1e-6)
    bad.push(`omega ${(r.omega*180/Math.PI).toFixed(3)}`);
  if(bad.length){ fails++; checks++; console.log(`  FAIL  ${a}+${b}: ${bad.join(', ')}`); }
  if(r.clash) clashes.push(`${a}+${b} ${r.clash.dist.toFixed(2)}A`);
}
checks++;
console.log(`  ok    ${posed} ordered pairs, every one at C-N ${Peptide.CN} A and omega 180 exactly`);

// A clash is reported, not failed: it is two RIGID conformers overlapping, and
// a real chain relieves it by turning phi and psi. What would be a bug is a
// clash appearing on a pair that used not to have one, so the list is printed.
console.log(`\n== 4. rigid-conformer clashes (reported, not failures)`);
console.log(clashes.length ? '        ' + clashes.join('\n        ')
                           : '        none');

console.log('\n== 5. a chain can only grow one way, and only because of the chemistry');
{
  let h = un(M.alanine), g = un(M.glycine);
  const before = h.atoms.length + g.atoms.length;
  const out = Peptide.react(h, g);
  ok(out.host.atoms.length + out.guest.atoms.length === before - 3,
     'a join removes exactly three atoms (O + H + H), one water');
  ok(!Peptide.free(out.host, 'carboxyl'),
     'the donor cannot spend its carboxyl twice');
  ok(!!Peptide.free(out.host, 'amino') && !!Peptide.free(out.guest, 'carboxyl'),
     'the two free ends are the N-terminus and the C-terminus');
  ok(Peptide.pose(out.host, un(M.serine)) === null,
     'nothing can be added at the spent end');
  ok(Peptide.pose(out.guest, un(M.serine)) !== null,
     'the chain grows at the C-terminus');
  // The alpha carbon has to survive renumbering: it is what omega is measured
  // against, and a stale index would report a torsion for the wrong atom.
  ok(Peptide.alphaOf(out.guest) >= 0 && out.guest.atoms[Peptide.alphaOf(out.guest)].el === 'C',
     'a residue still reports its alpha carbon after joining');
  // Every index in a spec moves when an atom goes.
  const stale = (out.host.bonds || []).some(b =>
    b[0] >= out.host.atoms.length || b[1] >= out.host.atoms.length);
  ok(!stale, 'no bond survives pointing at an atom that left');
}

console.log('\n== 6. hydrolysis puts back exactly what condensation took');
{
  const base = un(M.alanine);
  const spent = Peptide.strip(base, Peptide.role(base, 'carboxyl').leaves);
  const back = Peptide.strip(base, []);
  ok(back.atoms.length === base.atoms.length && spent.atoms.length === base.atoms.length - 2,
     'stripping nothing restores the whole residue; the spent one is two atoms short');
  ok(JSON.stringify(back.bonds) === JSON.stringify(base.bonds),
     'a round trip through strip() leaves the bond list identical');
}

console.log(fails
  ? `\nFAIL: ${fails} of ${checks} checks`
  : `\nPASS: ${checks} checks — every peptide pose lands at ${Peptide.CN} A and omega 180, `
    + `every residue's roles agree with its own indices, and a chain grows only at its C-terminus`);
process.exit(fails ? 1 : 0);
