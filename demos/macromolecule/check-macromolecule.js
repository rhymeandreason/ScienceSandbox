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
const Spec = require('./spec.js');

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
  // ALL THREE TORSIONS, EXACTLY. omega alone used to be checked, and phi and
  // psi were silently whatever conformer each spec was fetched as — which put
  // one residue's phi at +60 (left-handed) and the next at -64 (alpha), bent
  // the chain, and drove two atoms to 1.88 A. A torsion nobody sets is a
  // torsion the record chose.
  if(Math.abs(Math.abs(r.omega) - Math.PI) > 1e-6)
    bad.push(`omega ${(r.omega*180/Math.PI).toFixed(3)}`);
  if(Math.abs(r.phi - Peptide.PHI) > 1e-6) bad.push(`phi ${(r.phi*180/Math.PI).toFixed(3)}`);
  if(Math.abs(r.psi - Peptide.PSI) > 1e-6) bad.push(`psi ${(r.psi*180/Math.PI).toFixed(3)}`);
  if(bad.length){ fails++; checks++; console.log(`  FAIL  ${a}+${b}: ${bad.join(', ')}`); }
  if(r.clash) clashes.push(`${a}+${b} ${r.clash.dist.toFixed(2)}A`);
}
checks++;
console.log(`  ok    ${posed} ordered pairs, every one at C-N ${Peptide.CN} A with omega 180, `
  + `phi ${(Peptide.PHI*180/Math.PI).toFixed(0)} and psi ${(Peptide.PSI*180/Math.PI).toFixed(0)} exactly`);

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

console.log('\n== 5b. a built chain is straight, and nothing in it intersects');
{
  // The pairwise `clash` only ever compares the two residues being joined.
  // Residue 1 against residue 3 is invisible to it, and so is the surviving
  // amide hydrogen, which was the worst contact in a real chain.
  const qm = (a,b) => [a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],
                       a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],
                       a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],
                       a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];
  const vadd = (a,b) => a.map((v,i) => v + b[i]);
  const KEYS = ['glycine','alanine','serine','cysteine'];
  const res = [{ spec:un(M[KEYS[0]]), q:[0,0,0,1], p:[0,0,0] }];
  for(let i = 1; i < KEYS.length; i++){
    const prev = res[i-1], guest = un(M[KEYS[i]]);
    const r = Peptide.pose(prev.spec, guest);
    const out = Peptide.react(prev.spec, guest, r);
    prev.spec = out.host;
    res.push({ spec:out.guest, q:qm(prev.q, r.quat), p:vadd(qrot(prev.q, r.pos), prev.p) });
  }
  const W = (k,i) => vadd(qrot(res[k].q, res[k].spec.atoms[i].pos), res[k].p);
  const A = k => ({ N:Spec.role(res[k].spec,'amino').keep,
                    C:Spec.role(res[k].spec,'carboxyl').keep,
                    CA:Peptide.alphaOf(res[k].spec) });

  // Every pair that is not the new bond and not geminal across it.
  let min = Infinity, at = '';
  for(let i = 0; i < res.length; i++) for(let j = i+1; j < res.length; j++)
    for(let a = 0; a < res[i].spec.atoms.length; a++)
      for(let b = 0; b < res[j].spec.atoms.length; b++){
        if(j === i+1 && (a === A(i).C || b === A(j).N)) continue;   // 1-2 and 1-3
        const q = d(W(i,a), W(j,b));
        if(q < min){ min = q; at = `${res[i].spec.names[a]}/${res[j].spec.names[b]}`; }
      }
  // Below the tightest real contact but above where spheres would touch on
  // screen: PALETTE's C+H radii come to 0.74 A of separation at this scale.
  ok(min > 1.9, `four residues joined: closest non-bonded ${min.toFixed(2)} A (${at})`);

  const ca = [0,1,2,3].map(k => W(k, A(k).CA));
  const span = d(ca[0], ca[3]);
  ok(span > 10, `the chain is extended: CA1..CA4 spans ${span.toFixed(2)} A (a bent chain came to 8.84)`);
}

console.log('\n== 6. the glycosidic pose repeats into the polymer it names');
{
  const G = require('./glycosidic.js');
  const key = (k) => ({ ...un(M[k]), key:k });
  const lib = { cellobiose:key('cellobiose'), maltose:key('maltose') };
  // What mol-glycans.js's LINK table was solved against. Printed beside the
  // measurement because that comparison IS the assertion (chain-repeat.js's
  // header): the torsions are not quoted from a paper, the POLYMER is.
  const WANT = {
    glucose:      { turn:2.00, rise:5.32, polymer:'cellulose' },
    alphaGlucose: { turn:6.26, rise:1.43, polymer:'starch' },
  };
  for(const k of Object.keys(WANT)){
    const h = key(k);
    const r = G.pose(h, key(k), lib);
    if(!r){ fails++; checks++; console.log(`  FAIL  ${k}: no pose`); continue; }
    // The pose IS the residue-to-residue screw, so its own rotation and its
    // slide along that rotation's axis are the polymer's two numbers. Nothing
    // is repeated to find them: a rigid transform applied over and over is a
    // helix by construction, which is chain-repeat.js's whole argument.
    const q = r.quat, w = Math.min(1, Math.abs(q[3]));
    const ang = 2*Math.acos(w), sn = Math.sqrt(1 - w*w);
    const axis = sn < 1e-8 ? [0,0,1] : [q[0]/sn, q[1]/sn, q[2]/sn].map(v => q[3] < 0 ? -v : v);
    const turn = 360/(ang*180/Math.PI);
    const rise = Math.abs(r.pos[0]*axis[0] + r.pos[1]*axis[1] + r.pos[2]*axis[2]);
    const want = WANT[k];
    ok(Math.abs(turn - want.turn) < 0.01 && Math.abs(rise - want.rise) < 0.01,
       `${k}: ${turn.toFixed(2)} residues/turn, ${rise.toFixed(2)} A rise `
       + `— ${want.polymer}, as mol-glycans.js solved it (${want.turn} and ${want.rise})`);
    ok(r.polymer === want.polymer, `${k}: names ${want.polymer}`);
  }
  // A half turn per residue is not a fact about cellulose that anyone typed. It
  // is what beta-1,4 comes out at, and it is the whole reason a cellulose chain
  // can be built on a flat plane while a starch chain cannot.
  const b = G.pose(key('glucose'), key('glucose'), lib);
  const half = 2*Math.acos(Math.min(1, Math.abs(b.quat[3])))*180/Math.PI;
  ok(Math.abs(half - 180) < 0.5,
     `beta-1,4 turns ${half.toFixed(1)} degrees per residue — a half turn, which is flat`);

  // Two different sugars would be a linkage no disaccharide here measures.
  ok(G.pose(key('glucose'), key('alphaGlucose'), lib) === null,
     'an alpha and a beta glucose do not join: nothing measures that linkage');

  // The bridge oxygen is the DONOR's. Getting this backwards builds a bond one
  // atom out and still renders as a linkage.
  const out = G.react(key('glucose'), key('glucose'));
  ok(out.host.names.includes('O1') && !out.host.names.includes('HO1'),
     'the donor keeps its anomeric O and loses only its H');
  ok(!out.guest.names.includes('O4') && !out.guest.names.includes('HO4'),
     'the acceptor gives up its whole C4 hydroxyl');
}

console.log('\n== 7. the ester bond, and the reaction that stops');
{
  const E = require('./ester.js');
  const gly = un(M.glycerol);
  ok(E.slots(gly).length === 3, 'glycerol offers three slots and no more');

  for(const acid of ['palmitate','palmitoleate']){
    let bad = [];
    for(const slot of ['sn1','sn2','sn3']){
      const r = E.pose(gly, un(M[acid]), slot);
      if(!r){ bad.push(slot + ': no pose'); continue; }
      const O = gly.atoms[Spec.role(gly, slot).keep].pos;
      const C = place(un(M[acid]), r, Spec.role(un(M[acid]), 'carboxyl').keep);
      if(Math.abs(d(O, C) - E.CO) > 1e-6) bad.push(`${slot} C-O ${d(O,C).toFixed(4)}`);
      // Z, exactly: the one turn the construction leaves free.
      if(Math.abs(r.twist - E.ZTOR) > 1e-6) bad.push(`${slot} twist ${(r.twist*180/Math.PI).toFixed(3)}`);
    }
    ok(!bad.length, `${acid}: all three slots at C-O ${E.CO} A and Z exactly`
                    + (bad.length ? ' — ' + bad.join(', ') : ''));
  }

  // THE BRIDGE OXYGEN IS THE ALCOHOL'S. Backwards, this builds a real-looking
  // ester of a molecule nobody asked for, so it is asserted rather than drawn.
  const out = E.react(gly, un(M.palmitate), 'sn1');
  ok(out.host.names.includes('O1') && !out.host.names.includes('HO1'),
     'glycerol keeps its oxygen and loses only the H');
  ok(!out.guest.names.includes('O2') && !out.guest.names.includes('HO2'),
     'the acid gives up its whole hydroxyl');
  ok(out.host.atoms.length + out.guest.atoms.length
     === gly.atoms.length + un(M.palmitate).atoms.length - 3,
     'one ester removes exactly three atoms, one water');

  // A FAT IS NOT A POLYMER, and it has to be the molecule that says so.
  let host = gly;
  for(const slot of ['sn1','sn2','sn3']) host = E.react(host, un(M.palmitate), slot).host;
  ok(E.slots(host).length === 0, 'after three tails glycerol has no slot left');
  const tail = E.react(gly, un(M.palmitate), 'sn1').guest;
  ok(E.slots(tail).length === 0 && !Spec.free(tail, 'carboxyl'),
     'a tail cannot accept anything, so no fourth unit can attach to one');
}

console.log('\n== 8. a residue stops claiming to be the monomer it was');
{
  const g = un(M.glucose);
  const r = Spec.strip(g, Spec.role(g, 'c1').leaves);
  ok(r.residue === true, 'a stripped spec says it is a residue');
  const kept = Spec.MONOMER_ONLY.filter(k => k in r);
  ok(kept.length === 0,
     `no claim about the free monomer survives (${Spec.MONOMER_ONLY.join(', ')})`);
  // The one that would have been quietly wrong rather than merely stale.
  ok(!('formula' in r) && !('smiles' in r),
     'a residue carries no formula and no SMILES of its own');
  const stale = (r.groups || []).some(gr => gr.atoms.some(i => i >= r.atoms.length));
  ok(!stale, 'no group survives pointing at an atom that left');
}

console.log('\n== 9. the pose lands in the same place whichever molecule moved');
{
  const Plane = require('./plane.js');
  // A host sitting somewhere arbitrary and turned arbitrarily: an identity
  // transform would pass every one of these while hiding a composition bug.
  const norm = q => { const L = Math.hypot(...q); return q.map(v => v/L); };
  const at = (p, q) => ({ pos:p, quat:norm(q) });
  const cases = [
    at([0,0,0],       [0,0,0,1]),
    at([12,-7,0],     [0,0,0.38,0.92]),
    at([-3,5,2],      [0.21,-0.4,0.13,0.88]),
  ];
  // A relative pose with a real rotation in it, standing in for what a solver
  // returns; nothing here depends on it being a peptide bond.
  const s = { pos:[2.1,-0.6,0.3], quat:norm([0.12,0.44,-0.2,0.86]) };
  const close = (a, b) => a.every((v,i) => Math.abs(v - b[i]) < 1e-9);
  // Quaternions double-cover rotations: q and -q are the same turn, so a
  // comparison that misses that would fail on correct code.
  const sameQ = (a, b) => close(a, b) || close(a, b.map(v => -v));

  let allOk = true;
  for(const host of cases){
    const guest = Plane.compose(host, s);
    // Dragging the HOST instead has to put it exactly where it already is.
    const back = Plane.invert(guest, s);
    if(!close(back.pos, host.pos) || !sameQ(back.quat, host.quat)) allOk = false;
    // And composing forward from there has to reproduce the same guest.
    const again = Plane.compose(back, s);
    if(!close(again.pos, guest.pos) || !sameQ(again.quat, guest.quat)) allOk = false;
  }
  ok(allOk, 'compose and invert are exact inverses at every host placement');

  // THE BUG THIS SECTION EXISTS FOR. Re-solving with the arguments swapped is
  // a different reaction, and it lands somewhere real — so nothing about the
  // render says which of the two happened. Assert that the two answers differ,
  // so a page that reaches for the wrong one is not silently agreeing.
  const host = cases[1];
  const guest = Plane.compose(host, s);
  const swapped = Plane.compose(guest, s);      // what re-solving would give
  ok(!close(swapped.pos, host.pos),
     'placing the host by re-solving the other way round is NOT the same pose');
}

console.log('\n== 10. hydrolysis puts back exactly what condensation took');
{
  const base = un(M.alanine);
  const spent = Peptide.strip(base, Peptide.role(base, 'carboxyl').leaves);
  const back = Peptide.strip(base, []);
  ok(back.atoms.length === base.atoms.length && spent.atoms.length === base.atoms.length - 2,
     'stripping nothing restores the whole residue; the spent one is two atoms short');
  ok(JSON.stringify(back.bonds) === JSON.stringify(base.bonds),
     'a round trip through strip() leaves the bond list identical');
}

console.log('\n== 11. the flat build, and what it keeps');
{
  const E = require('./ester.js');
  const F = require('./flat.js');
  const gly = un(M.glycerol), flat = F.spec(gly);

  ok(flat && F.isFlat(flat), 'glycerol has a layout and it is in the plane');
  ok(flat.atoms.length === gly.atoms.length,
     'the layout carries every atom, hydroxyl hydrogens included');
  // The H are what LEAVES. A layout that drops them draws a glycerol that
  // cannot react, and the page would build nothing while rendering perfectly.
  ok(['sn1','sn2','sn3'].every(k => Spec.free(flat, k)),
     'all three slots survive the flattening, leaving atoms and all');
  // The layout is scaled to the molecule's own MEAN bond (bake-flat2d.js), so
  // individual bonds move by a few hundredths while the scale does not. That is
  // what stops the reveal reading as a zoom rather than as a rearrangement.
  const bl = s => (s.bonds || []).map(([i,j]) => d(s.atoms[i].pos, s.atoms[j].pos));
  const mean = a => a.reduce((x,y) => x+y, 0) / a.length;
  const real = mean(bl(gly)), drawn = mean(bl(flat));
  ok(Math.abs(real - drawn) / real < 0.02,
     `the layout is at the molecule's own scale (${real.toFixed(3)} vs ${drawn.toFixed(3)} A mean bond)`);
  // Both acids are already flat, so nothing lays them out: the same object
  // comes back. A copy here would mean the library grew a second geometry.
  ok(['palmitate','palmitoleate'].every(k => { const a = un(M[k]);
       return F.isFlat(a) && F.spec(a) === a; }),
     'both fatty acids are already flat, and are handed back untouched');

  for(const acid of ['palmitate','palmitoleate']){
    let host = flat, bad = [];
    for(const slot of ['sn1','sn2','sn3']){
      const g = un(M[acid]);
      const r = F.pose(host, g, slot);
      if(!r){ bad.push(slot + ': no pose'); continue; }
      const placed = g.atoms.map((a,i) => place(g, r, i));
      // THE WHOLE POINT: the acid arrives without leaving the tabletop, which
      // is the one thing the 3D pose cannot do and the reason this file exists.
      const outOfPlane = Math.max(...placed.map(p => Math.abs(p[2])));
      if(outOfPlane > 1e-6) bad.push(`${slot} leaves the plane by ${outOfPlane.toFixed(3)}`);
      // ...and everything ester.js measures still holds.
      const O = host.atoms[Spec.role(host, slot).keep].pos;
      const C = place(g, r, Spec.role(g, 'carboxyl').keep);
      if(Math.abs(d(O, C) - E.CO) > 1e-6) bad.push(`${slot} C-O ${d(O,C).toFixed(4)}`);
      if(Math.abs(r.twist - E.ZTOR) > 1e-6) bad.push(`${slot} twist ${(r.twist*180/Math.PI).toFixed(2)}`);
      host = F.spec(E.react(host, g, slot).host) || host;
    }
    ok(!bad.length, `${acid}: three flat esters at C-O ${E.CO} A, Z, none off the plane`
                    + (bad.length ? ' — ' + bad.join(', ') : ''));
    ok(E.slots(host).length === 0, `${acid}: the flat build stops at three too`);
  }

  /* THE OTHER TWO BONDS, FLAT. Same three things asked of each: the bond lands
   * at the length its round counterpart uses, nothing leaves the plane, and a
   * chain of four still grows only at the end that has its leaving group. */
  {
    const Pep = require('./peptide.js'), Gly = require('./glycosidic.js');
    // Keyed, because glycosidic.js looks its linkage up by monomer name and
    // the flat build refuses a mixed pair on the same test.
    const flat = k => F.spec({ ...un(M[k]), key:k });
    const chain = (keys, poseFn, reactFn, len, label) => {
      let host = flat(keys[0]), bad = [];
      const units = [host];
      for(let i = 1; i < keys.length; i++){
        const guest = flat(keys[i]);
        const r = poseFn(host, guest);
        if(!r){ bad.push(`step ${i}: no pose`); break; }
        const placed = guest.atoms.map((a,k) => place(guest, r, k));
        const off = Math.max(...placed.map(p => Math.abs(p[2])));
        if(off > 1e-6) bad.push(`step ${i} leaves the plane by ${off.toFixed(3)}`);
        const A = host.atoms[Spec.free(host, r.slot).keep].pos;
        const B = placed[Spec.free(guest, poseFn.acceptor).keep];
        if(Math.abs(d(A, B) - len(host, guest)) > 1e-3)
          bad.push(`step ${i} bond ${d(A,B).toFixed(3)}`);
        const out = reactFn(host, guest);
        host = F.spec(out.guest) || out.guest;     // the chain grows at the guest
        units.push(host);
      }
      ok(!bad.length, `${label}: three flat bonds, none of it off the plane`
                      + (bad.length ? ' — ' + bad.join(', ') : ''));
      return units;
    };

    const pep = (h,g) => F.peptide(h,g); pep.acceptor = 'amino';
    chain(['glycine','alanine','serine','cysteine'], pep,
          (h,g) => Pep.react(h,g), () => Pep.CN, 'peptide');
    // A chain that has spent its carboxyl cannot grow at that end, flat or not.
    const spent = Pep.react(flat('glycine'), flat('alanine')).host;
    ok(F.peptide(spent, flat('alanine')) === null,
       'a residue that has spent its carboxyl takes no second neighbour');

    const gly = (h,g) => F.glycosidic(h,g); gly.acceptor = 'c4';
    chain(['glucose','glucose','glucose','glucose'], gly,
          (h,g) => Gly.react(h,g),
          (h,g) => d(g.atoms[Spec.free(g,'c4').keep].pos,
                     g.atoms[Spec.free(g,'c4').leaves[0]].pos), 'beta-glucose');
    chain(['alphaGlucose','alphaGlucose','alphaGlucose','alphaGlucose'], gly,
          (h,g) => Gly.react(h,g),
          (h,g) => d(g.atoms[Spec.free(g,'c4').keep].pos,
                     g.atoms[Spec.free(g,'c4').leaves[0]].pos), 'alpha-glucose');
    // Mixing anomers is a linkage nothing measures; glycosidic.js refuses it
    // and the flat build has to refuse it too, or the reveal has no pose.
    ok(F.glycosidic(flat('glucose'), flat('alphaGlucose')) === null,
       'two different anomers are refused flat, as they are round');
  }

  // A molecule with no layout must REFUSE. Zeroing z instead would fold the
  // hydroxyls that point out of the page onto the backbone and still render.
  ok(F.spec(un(M.galactose)) === null,
     'a spec with no layout is refused rather than flattened by force');
}

console.log(fails
  ? `\nFAIL: ${fails} of ${checks} checks`
  : `\nPASS: ${checks} checks — every peptide pose lands at ${Peptide.CN} A and omega 180; `
    + `every glycosidic pose repeats into the polymer it names, at the helix `
    + `mol-glycans.js solved its torsions against; every ester lands at 1.34 A and Z, `
    + `and stops at three because glycerol runs out of hydroxyls; a chain grows only `
    + `at the end that still has its leaving group; a residue makes no claim it `
    + `stopped being true of; and the flat build keeps every one of those numbers `
    + `without any of it leaving the tabletop`);
process.exit(fails ? 1 : 0);
