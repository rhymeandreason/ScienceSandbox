#!/usr/bin/env node
/* =====================================================================
 *  check-kit.js — the assertions behind kit/motion.js and kit/molgraph.js
 *
 *  WHY THIS EXISTS. These two modules answer questions the page then ANIMATES,
 *  and a wrong answer looks like a design choice: a phosphoryl group that
 *  takes the bridging oxygen with it flies off with one atom too many, and
 *  nothing on screen says so. MolecularGeometry.md §1.4 rule 2 in its general
 *  form — a claim ships with the assertion that checks it.
 *
 *  Both modules are deliberately free of THREE and of the DOM, so this
 *  REQUIRES them and runs the real code against the real specs (through
 *  lib-node.js, so every domain file is loaded, not a hand-picked subset).
 *  Nothing here reimplements them: a checker holding its own copy of the
 *  answer agrees with itself forever and with the page never.
 *
 *  kit/stagekit.js and kit/focus.js are NOT checked here — they are THREE and
 *  DOM all the way down, and every claim they make is a visual one. That is
 *  the human's job in the browser (CLAUDE.md), and kit/kit-test.html is the
 *  bench for it.
 *
 *  Run:  node kit/check-kit.js
 * ===================================================================== */
'use strict';
const path=require('path');
const MolLib=require(path.join(__dirname,'..','lib', 'lib-node.js'));
const {MolGraph}=require(path.join(__dirname,'molgraph.js'));
const {Motion}=require(path.join(__dirname,'motion.js'));
const {HBond}=require(path.join(__dirname,'hbond.js'));
const {Lobes}=require(path.join(__dirname,'..','lobes','lobes.js'));
const {circle:enzCircle}=require(path.join(__dirname,'enzyme-blob.js'));
const M=MolLib.MOLECULES;

let fails=0, checks=0;
const ok=(cond,msg)=>{ checks++; if(!cond){ fails++; console.log('  FAIL  '+msg); } };
const near=(a,b,tol,msg)=>ok(Math.abs(a-b)<=tol, `${msg}  (got ${(+a).toFixed(3)}, want ${b}±${tol})`);
const head=t=>console.log('\n'+t+'\n'+'-'.repeat(t.length));
// The wall-clock assertions cannot be synchronous — the thing being checked is
// that a beat fires with no render loop running.
const pending=[];

/* =====================================================================
 *  MOTION — the timeline
 * ===================================================================== */
head('motion.js');
{
  const m=Motion.create();
  let v=0, calls=0, doneAt=null;
  m.seq([
    {dur:1, ease:'linear', onUpdate:t=>v=t},
    {call:()=>calls++},
    {dur:1, ease:'linear', onUpdate:t=>v=1+t, onDone:()=>doneAt=m.time},
  ],{tag:'a'});

  const run=n=>{ for(let i=0;i<n;i++) m.step(1/60); };
  run(30); near(v,0.5,0.02,'halfway through beat 1');
  ok(calls===0,'the call beat has not fired yet');
  run(31); ok(calls===1,'call beat fires exactly once, on arrival');
  run(60); near(v,2,0.02,'beat 3 finished');
  ok(doneAt!=null,'onDone fired');
  run(10); ok(calls===1,'call beat does not re-fire');
  ok(!m.busy,'timeline empties itself when every beat is done');

  // Cancel is total, and does NOT snap to the end pose — the bug every page's
  // hand-rolled cancelTimers() had, where a rewind landed on the state it was
  // rewinding away from.
  // (stepped a frame at a time: step() clamps dt, so one big call is not the
  // same thing as playing to that time — which is the clamp's whole job.)
  const frames=(m,n)=>{ for(let i=0;i<n;i++) m.step(1/60); };
  const m2=Motion.create(); let w=0;
  m2.seq([{dur:1, ease:'linear', onUpdate:t=>w=t}],{tag:'b'});
  frames(m2,30); near(w,0.5,0.02,'cancel test: halfway');
  m2.cancel('b'); frames(m2,60);
  near(w,0.5,0.02,'cancel leaves the value where it was, does not complete it');
  ok(!m2.busy,'cancel by tag empties the timeline');

  // A tag cancels only its own beats.
  const m3=Motion.create(); let x=0,y=0;
  m3.tween({dur:1, ease:'linear', onUpdate:t=>x=t, tag:'x'});
  m3.tween({dur:1, ease:'linear', onUpdate:t=>y=t, tag:'y'});
  frames(m3,30); m3.cancel('x'); frames(m3,31);
  near(x,0.5,0.02,'cancelled tag froze'); near(y,1,0.02,'other tag ran on');

  // dt CLAMP. An alt-tab arrives as one enormous frame; without the clamp every
  // pending beat completes inside it and the student comes back to a finished
  // animation they never saw.
  const m4=Motion.create(); let z=0;
  m4.seq([{dur:1, ease:'linear', onUpdate:t=>z=t}]);
  m4.step(40); ok(z<1,'a 40-second frame does not complete a 1-second tween');

  // SEEK applies values without firing side effects.
  const m5=Motion.create(); let s=0, side=0;
  const tl5=m5.seq([{dur:2, ease:'linear', onUpdate:t=>s=t},{call:()=>side++}]);
  tl5.seek(1); near(s,0.5,0.001,'seek applies the tween exactly');
  ok(side===0,'seek does not fire call beats');
  near(tl5.duration,2,0.001,'sequence duration is the sum of its beats');

  /* THE TWO CLOCKS. A `call` beat is a commit: it rides the wall clock as well
   * as the render loop, so a step finishes in a tab nobody is watching instead
   * of leaving the lesson stuck `busy` with no way out but a reload. These run
   * with NO step() at all — the render loop is exactly what a hidden tab does
   * not have. */
  const wall=ms=>new Promise(r=>setTimeout(r,ms));
  {
    const m=Motion.create(); let committed=false, painted=0;
    m.seq([
      {dur:.05, onUpdate:()=>painted++},
      {call:()=>committed=true},
    ],{tag:'hidden'});
    pending.push(wall(120).then(()=>{
      ok(committed,'a call beat fires with no render loop at all (hidden tab)');
      ok(painted===0,'…and no interpolation ran: pixels are not owed to a hidden tab');
      // The played clock caught up to the beat, so a tween scheduled around it
      // agrees with the state rather than resuming its slide.
      ok(m.time>=0.05,'the timeline fast-forwards to the beat the timer fired');
    }));

    // commit:false is the opt-out for a purely cosmetic call.
    const m2=Motion.create(); let cosmetic=false;
    m2.seq([{at:.05, call:()=>cosmetic=true, commit:false}]);
    pending.push(wall(120).then(()=>
      ok(!cosmetic,'commit:false stays on the render loop and does not fire unseen')));

    // …and cancel kills the wall-clock half too, or an abandoned step commits
    // on top of the fresh one a second later.
    const m3=Motion.create(); let zombie=false;
    m3.seq([{at:.05, call:()=>zombie=true}],{tag:'z'});
    m3.cancel('z');
    pending.push(wall(120).then(()=>
      ok(!zombie,'cancel clears the wall-clock timer, not just the beat')));
  }

  // Easings: every named one must start at 0 and land on 1 (pulse is the
  // declared exception — it exists to return to where it started).
  Object.entries(Motion.EASE).forEach(([k,f])=>{
    if(k==='pulse'){ near(f(0),0,1e-9,'pulse starts at 0'); near(f(1),0,1e-9,'pulse ends at 0'); return; }
    near(f(0),0,1e-9,`ease ${k} starts at 0`);
    near(f(1),1,1e-9,`ease ${k} ends at 1`);
  });
}

/* =====================================================================
 *  MOLGRAPH — chemistry questions
 * ===================================================================== */
head('molgraph.js — connectivity');
{
  const w=M.water;
  ok(MolGraph.degree(w,0)===2,'water: O has two neighbours');
  ok(MolGraph.hydrogens(w,0).length===2,'water: both are hydrogens');
  near(MolGraph.angle(w,1,0,2),104.5,2.5,'water H–O–H angle');
}
{
  // Glucose: the ring is found, and it is six-membered (pyranose) with one
  // oxygen in it. This is the check that catches a spec drawn as a furanose.
  const g=M.glucose, rs=MolGraph.rings(g);
  ok(rs.length>=1,'glucose has a ring');
  const ring=rs[0];
  ok(ring.length===6,`glucose ring is six-membered (got ${ring.length})`);
  ok(ring.filter(i=>g.atoms[i].el==='O').length===1,'pyranose ring has exactly one oxygen');
  // Five hydroxyls on the open pyranose (C1,C2,C3,C4 + the C6 primary).
  const oh=MolGraph.findGroups(g,'hydroxyl');
  ok(oh.length===5,`glucose has five hydroxyls (got ${oh.length})`);
  // and they are SPREAD — the reason macromolecule-lab refuses to ring them.
  ok(MolGraph.spread(g, oh.flatMap(x=>x.atoms))>3,
     'glucose hydroxyls are spread around the ring, not a compact site');
}
{
  const a=M.alanine;
  ok(MolGraph.findGroups(a,'carboxyl').length===1,'alanine has one carboxyl');
  ok(MolGraph.findGroups(a,'amine').length===1,'alanine has one amino group');
  ok(MolGraph.findGroups(a,'methyl').length===1,'alanine side chain is one methyl');
}
{
  const p=M.palmitate;
  ok(MolGraph.rings(p).length===0,'palmitate has no rings');
  ok(MolGraph.findGroups(p,'carboxyl').length===1,'palmitate has one carboxyl head');
}

head('molgraph.js — phosphate transfer');
{
  // The claim glycolysis animates: the phosphoryl group that FLIES is P plus
  // its terminal oxygens. The bridging oxygen stays on the sugar — it was the
  // sugar's oxygen before the transfer and it is still the sugar's after.
  const g6p=M.g6p||M.G6P;
  ok(!!g6p,'g6p spec exists');
  if(g6p){
    const p=g6p.atoms.findIndex(a=>a.el==='P');
    ok(p>=0,'g6p has a phosphorus');
    const ph=MolGraph.phosphoryl(g6p,p);
    ok(ph.terminal.length===3,`three terminal oxygens on the phosphate (got ${ph.terminal.length})`);
    ok(ph.bridge.length===1,`one bridging oxygen (got ${ph.bridge.length})`);
    ok(!ph.atoms.includes(ph.bridge[0]),'the bridging oxygen does NOT travel with the group');
    // and the group is a real fragment: cutting the bridge bond separates it.
    const leaves=MolGraph.side(g6p,p,ph.bridge[0]);
    ok(leaves && ph.terminal.every(o=>leaves.includes(o)),
       'cutting P–O(bridge) detaches exactly the phosphoryl side');
    ok(leaves && !leaves.includes(ph.bridge[0]),'…and leaves the bridge behind');
  }
}
{
  /* leavingBond — what a hotspot points at. The lesson names the ATOM ("the H
   * NAD⁺ takes", "the phosphate handed to ADP"); the bond is derived, so it
   * cannot go stale against the atom the way a second typed index would. */
  const g6p=M.g6p||M.G6P;
  if(g6p){
    const p=g6p.atoms.findIndex(a=>a.el==='P');
    const bond=MolGraph.leavingBond(g6p,p);
    const br=MolGraph.bridging(g6p,p,'O')[0];
    ok(bond && bond[1]===br, 'a phosphorus leaves by its BRIDGING oxygen, not a terminal one');
    // an H has exactly one bond, so the bond it leaves by is unambiguous
    const h=g6p.atoms.findIndex(a=>a.el==='H');
    const hb=MolGraph.leavingBond(g6p,h);
    ok(hb && MolGraph.neighbors(g6p,h).length===1 && hb[1]===MolGraph.neighbors(g6p,h)[0],
       'a hydrogen leaves by its single bond');
    // and an atom with no unambiguous single bond gives NULL — never a target
    // at the origin, which would be a clickable spot floating in the scene
    const ringC=MolGraph.rings(g6p)[0].find(i=>g6p.atoms[i].el==='C');
    ok(MolGraph.leavingBond(g6p,ringC)===null,
       'an atom with more than one heavy bond has no leaving bond (null, not [0,0])');
  }
}
{
  // side() must refuse a ring bond rather than answering "nothing leaves".
  const g=M.glucose, ring=MolGraph.rings(g)[0];
  const [i,j]=[ring[0],ring[1]];
  ok(MolGraph.side(g,i,j)===null,'side() returns null across a ring bond');
}

head('molgraph.js — stereochemistry sign');
{
  // torsion() is signed, and the sign is what tells an L residue from a D one.
  // Mirroring a spec must flip it; a caller that takes Math.abs has thrown the
  // stereochemistry away, so this is the assertion that says so out loud.
  const a=M.alanine;
  const N=a.atoms.findIndex(x=>x.el==='N');
  const CA=MolGraph.heavyNeighbors(a,N).find(i=>a.atoms[i].el==='C');
  const nb=MolGraph.heavyNeighbors(a,CA).filter(i=>i!==N);
  if(nb.length>=2){
    const t=MolGraph.torsion(a,N,CA,nb[0],nb[1]);
    const mirror={atoms:a.atoms.map(x=>({el:x.el,pos:[-x.pos[0],x.pos[1],x.pos[2]]})),bonds:a.bonds};
    const tm=MolGraph.torsion(mirror,N,CA,nb[0],nb[1]);
    near(tm,-t,0.01,'mirroring a spec flips the torsion sign');
    ok(Math.abs(t)>1,'the torsion is not ~0 (a flat centre would prove nothing)');
  }
}

/* =====================================================================
 *  HBOND — the matching half
 * =====================================================================
 *  GEOMETRY IS CHECKED AGAINST HAND-BUILT ÅNGSTRÖM SPECS, not registered
 *  ones. register() has already applied SCALE (1.9), so a registered water's
 *  O–H is not 0.96 and a distance cutoff quoted in ångströms would be
 *  meaningless against it. hbond.js answers in whatever units went in — same
 *  contract as molgraph — and the way to assert that honestly is to feed it
 *  units we control. The one registered spec used below is `amp`, for a claim
 *  that has no length in it at all.
 * ===================================================================== */
head('hbond.js — sites and the two geometric gates');
{
  // A water, in ångströms, at the origin: O at 0, two H at 104.5°.
  const th=104.5*Math.PI/180, r=0.9572;
  const waterAt=(x,y,z,flip)=>{
    const o=[x,y,z], s=flip?-1:1;
    return { atoms:[{el:'O',pos:o},
                    {el:'H',pos:[x+s*r*Math.sin(th/2), y+s*r*Math.cos(th/2), z]},
                    {el:'H',pos:[x-s*r*Math.sin(th/2), y+s*r*Math.cos(th/2), z]}],
             bonds:[[0,1],[0,2]] };
  };

  const w=waterAt(0,0,0);
  const s=HBond.sites(w,{owner:'w'});
  ok(s.donors.length===2,'water has two donors (both its hydrogens)');
  ok(s.acceptors.length===1,'water has one acceptor (the oxygen)');
  ok(s.acceptors[0].capacity===2,
     `the oxygen accepts exactly two — one per lone pair (got ${s.acceptors[0].capacity})`);

  // A second water placed ALONG one of the first's lone pairs, turned so one
  // O–H points back down it. Both facts are needed and neither is decorative:
  // sitting the partner nearby is not enough (the lobe gate refuses a bond
  // into the back of the oxygen), and sitting it in the right place without
  // turning it is not enough either (D–H···A comes out at 0.32, and the
  // linearity gate refuses that). Between them they are the geometry — which
  // is the reason ice is tetrahedral and open, and the reason a flat diagram
  // of this arrangement cannot be drawn correctly.
  const a=waterAt(0,0,0);
  const L=Lobes.at(a,0).dirs[0];
  const b=(()=>{
    const O=L.map(v=>v*2.8);                       // donor oxygen, out along the ear
    const back=L.map(v=>-v);                       // and one O–H pointing back at it
    const ax=(()=>{ const p=[L[1],-L[0],0], n=Math.hypot(p[0],p[1]); return [p[0]/n,p[1]/n,0]; })();
    const c=Math.cos(th), s=Math.sin(th);          // second H at 104.5° (Rodrigues)
    const kd=ax[0]*back[0]+ax[1]*back[1]+ax[2]*back[2];
    const h2=back.map((v,i)=>v*c + (ax[(i+1)%3]*back[(i+2)%3]-ax[(i+2)%3]*back[(i+1)%3])*s + ax[i]*kd*(1-c));
    return { atoms:[{el:'O',pos:O},
                    {el:'H',pos:O.map((v,i)=>v+back[i]*r)},
                    {el:'H',pos:O.map((v,i)=>v+h2[i]*r)}],
             bonds:[[0,1],[0,2]] };
  })();
  const sa=HBond.sites(a,{owner:'a'}), sb=HBond.sites(b,{owner:'b'});
  const pairs=HBond.find(sa.donors.concat(sb.donors),
                         sa.acceptors.concat(sb.acceptors));
  ok(pairs.length===1,`two facing waters share exactly one H-bond (got ${pairs.length})`);
  ok(pairs[0].donor.owner==='b' && pairs[0].acceptor.owner==='a',
     'the bond runs from the lower water\'s H to the upper water\'s lone pair');

  // The distance gate. Pull them apart past maxDist and the bond goes.
  const far=HBond.sites(waterAt(0,-9,0),{owner:'f'});
  ok(HBond.find(sa.donors.concat(far.donors),
                sa.acceptors.concat(far.acceptors)).length===0,
     'no H-bond at 9 Å — the distance gate');

  // The linearity gate, on raw sites so nothing else is in play: a hydrogen
  // 2.0 Å from the acceptor, well inside maxDist, but bonded to a root that
  // puts D–H pointing away from it. A distance-only criterion bonds this —
  // and that is the textbook's dotted line pointing nowhere.
  const acc=sa.acceptors[0];
  const turned=[{ h:[0,-2.0,0], root:[0,-1.04,0], owner:'x' }];   // O above its H: D–H points away
  ok(HBond.find(turned,[acc],{minLobe:-2}).length===0,
     'a hydrogen turned away makes no bond at a bonding distance');
  ok(HBond.find([{h:[0,-2.0,0],root:[0,-2.96,0],owner:'x'}],[acc],{minLobe:-2}).length===1,
     'the same hydrogen turned toward it does — linearity is the only difference');
}

head('hbond.js — capacity is spent, not ignored');
{
  // Three donors converging on one oxygen. It has two lone pairs, so the
  // third gets nothing — the count on screen in water-lab is this rule.
  const acc={ p:[0,0,0], owner:'acc', capacity:2,
              dirs:[[0,1,0.4],[0,1,-0.4]] };
  const donor=(x,y,z)=>({ h:[x,y,z], root:[x*1.6,y*1.6,z*1.6], owner:'d'+x+y+z });
  const ds=[donor(0,2,0.8), donor(0,2,-0.8), donor(0.3,2,0)];
  const got=HBond.find(ds,[acc],{onePerPair:false});
  ok(got.length===2,`an oxygen with two lone pairs takes two bonds, not three (got ${got.length})`);
  ok(got[0].lobe!==got[1].lobe,'the two bonds land on different lone pairs');

  // onePerPair: same owner on every donor, so all three are one pair of
  // owners and only the first may bond.
  const same=ds.map(d=>Object.assign({},d,{owner:'same'}));
  ok(HBond.find(same,[acc]).length===1,
     'onePerPair caps a single pair of molecules at one shared H-bond');
  ok(HBond.find(same,[acc],{onePerPair:false}).length===2,
     'onePerPair:false lets one pair share two — the base-pair case');
}

head('hbond.js — the conjugation trap (the DNA claim)');
{
  // THE ASSERTION THIS MODULE EXISTS FOR. Adenine's exocyclic amino nitrogen
  // scores one lone pair by the electron sum, but that pair is delocalised
  // into the ring: the group DONATES and does not accept. If this ever comes
  // back as an acceptor with capacity, the A–T pairing a lesson draws is
  // backwards, and nothing on screen would say so.  `amp` carries adenine.
  const amp=M.amp;
  const aminoN=amp.atoms.findIndex((x,i)=>
    x.el==='N' && MolGraph.neighbors(amp,i).filter(j=>amp.atoms[j].el==='H').length===2);
  ok(aminoN>=0,'found adenine\'s exocyclic amino nitrogen in amp');
  if(aminoN>=0){
    const {acceptors,donors}=HBond.sites(amp,{owner:'amp'});
    const site=acceptors.find(a=>a.id===aminoN);
    ok(!!site && site.conjugated===true,'the amino nitrogen is flagged conjugated');
    ok(!site || site.capacity===0,
       `the amino nitrogen accepts nothing (got capacity ${site&&site.capacity})`);
    ok(donors.some(d=>d.rootId===aminoN),
       'and it still DONATES — both of its hydrogens are donors');

    // The ring nitrogen adenine actually accepts on (N1) must survive, or the
    // guard above has been implemented as "nitrogen never accepts".
    ok(acceptors.some(a=>a.el==='N' && a.capacity>0),
       'a ring nitrogen still accepts — the flag is per-atom, not per-element');
  }
}

head('hbond.js — the lone pair scores, it does not veto');
{
  /* THE CORRECTION THIS SECTION EXISTS TO HOLD. An earlier version refused
   * any approach more than 60° off a lone pair. Donor-side linearity is a
   * strong preference; acceptor-side lone-pair directionality is not — the
   * structural surveys find H-bonds spread broadly around an acceptor, and
   * the ears are a modelling choice besides. So a badly-aimed bond is still a
   * bond, and `align` is how a page can DRAW it as the poor bond it is. */
  const acc={ p:[0,0,0], owner:'acc', capacity:2,
              dirs:[[0,1,0.4],[0,1,-0.4]] };
  const at=(deg)=>{ const a=deg*Math.PI/180;                 // swing off the ear
    const h=[Math.sin(a)*2, Math.cos(a)*2, 0];
    return { h, root:h.map(v=>v*1.48), owner:'d' };          // D–H aimed at the acceptor
  };
  const one=(deg,opts)=>HBond.find([at(deg)],[acc],opts);

  ok(one(0).length===1,'straight down the ear: bonded');
  ok(one(70).length===1,'70° off the ear is STILL A BOND — the cone is not a gate');
  const r70=HBond.explain(at(70),acc);
  ok(r70.align!=null && r70.align<HBond.explain(at(0),acc).align,
     'and it reports a worse alignment than the on-axis one');

  // What still fails is arriving behind the ears, where the acceptor's own
  // bonds are — the part of the directionality that is not subtle.
  ok(one(170).length===0,'coming in behind the lone pairs: refused');

  // The strict cone remains available for a page that has to say no.
  ok(one(70,{minLobe:0.5}).length===0,'minLobe:0.5 restores the 60° cone opt-in');
  ok(HBond.DEFAULTS.minLobe===0,'…and it is NOT the default');
}

head('hbond.js — matching order');
{
  // Two donors, two acceptors, arranged so donor-order takes the pairing that
  // blocks the second donor and best-order does not. The default must be the
  // donor-order answer: water-lab is featured, its H-bond count is on screen,
  // and a silently better matcher there is a regression that reads as a
  // physics bug.
  const A={ p:[0,0,0], owner:'A', capacity:1 };
  const B={ p:[0,6,0], owner:'B', capacity:1 };
  const d1={ h:[0,2.0,0], root:[0,2.9,0], owner:'1' };   // near A, and only A
  const d2={ h:[0,2.2,0], root:[0,3.1,0], owner:'2' };   // near A too, far from B
  ok(HBond.find([d2,d1],[A,B],{onePerPair:false}).length===1,
     'donor order: the first donor takes the only acceptor in range');
  const best=HBond.find([d2,d1],[A,B],{onePerPair:false,order:'best'});
  ok(best.length===1 && best[0].donor===d1,
     'best order: the closer donor wins the contested acceptor');
  ok(HBond.DEFAULTS.order==='donor',
     'the default order is donor — behaviour-preserving for water-lab');
}

/* =====================================================================
 *  kit/enzyme-blob.js — the one piece of it that is arithmetic
 * =====================================================================
 *  The rest of that module is THREE and the DOM and belongs to the human in the
 *  browser. `circle` is not: it decides where the blob's middle is and how big
 *  it has to be, and both ways it fails are silent. A radius measured off the
 *  taller axis lets a diagonal molecule's phosphate tail hang out of a corner —
 *  it looks like a design choice. A centre taken off atom POINTS instead of
 *  their surfaces sits toward whichever end carries the small atoms, which
 *  looks like the placement drifting.
 * ===================================================================== */
{
  head('enzyme-blob.js — the blob\'s circle');

  ok(enzCircle([])===null && enzCircle(null)===null,
     'nothing to enclose returns null rather than a circle at the origin');

  // one atom is its own circle
  const one=enzCircle([{u:3,v:-2,r:0.8}]);
  near(one.u,3,1e-9,'a single sphere centres on itself');
  near(one.r,0.8,1e-9,'…and its radius is the sphere\'s');

  // SURFACES, NOT POINTS. A big atom at one end and a small one at the other:
  // the centre must move toward the big one, which is what the eye reads as the
  // middle of the drawing.
  const lop=enzCircle([{u:0,v:0,r:2},{u:10,v:0,r:0.5}]);
  ok(lop.u<5, 'the centre is taken off the surfaces, so it leans to the fat end');
  near(lop.u,(-2+10.5)/2,1e-9,'…exactly the middle of the surface extent');

  // EVERY SPHERE IS INSIDE. The property that matters, asserted as a property
  // rather than as a number: nothing may stick out on any bearing.
  const encloses=pts=>{ const c=enzCircle(pts);
    return pts.every(p=>Math.hypot(p.u-c.u,p.v-c.v)+p.r<=c.r+1e-9); };
  ok(encloses([{u:0,v:0,r:1},{u:0,v:9,r:1},{u:2,v:4,r:1.4}]),
     'a vertical molecule is enclosed');
  ok(encloses([{u:0,v:0,r:1},{u:7,v:7,r:1.6},{u:-3,v:2,r:0.5}]),
     'a diagonal one is enclosed — the case a box round the two axes loses');

  // …AND A DIAGONAL NEEDS MORE THAN ITS TALLER AXIS. This is the bug: sizing
  // off max(width,height) is smaller than the reach to a corner, so the corner
  // atom is outside the blob while the opposite side is empty.
  const diag=[{u:0,v:0,r:1},{u:8,v:8,r:1}];
  const c=enzCircle(diag);
  const byTallerAxis=Math.max(8+2,8+2)/2;      // what the old code used
  ok(c.r>byTallerAxis,
     'a diagonal molecule needs a bigger radius than half its taller axis');

  // A LONE PAIR OF EQUAL SPHERES: the circle is the segment plus the radius,
  // which pins the arithmetic against a value that can be worked out by hand.
  const pair=enzCircle([{u:0,v:0,r:1},{u:0,v:4,r:1}]);
  near(pair.v,2,1e-9,'two equal spheres centre between them');
  near(pair.r,3,1e-9,'…and the radius reaches the far side of each');
}

Promise.all(pending).then(()=>{
  console.log(`\n${checks-fails}/${checks} checks passed`);
  if(fails){ console.log(`${fails} FAILED`); process.exit(1); }
});
