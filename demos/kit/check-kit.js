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
const MolLib=require(path.join(__dirname,'..','lib-node.js'));
const {MolGraph}=require(path.join(__dirname,'molgraph.js'));
const {Motion}=require(path.join(__dirname,'motion.js'));
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

Promise.all(pending).then(()=>{
  console.log(`\n${checks-fails}/${checks} checks passed`);
  if(fails){ console.log(`${fails} FAILED`); process.exit(1); }
});
