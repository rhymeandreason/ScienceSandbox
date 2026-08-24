/* KIND: bench. Load when a change to the water or the wall has to be judged.
 *
 * NOTHING ON THIS PAGE CAN BE JUDGED FROM ONE RUN, and that is measured rather
 * than assumed: identical settings, 1500 steps from Reset, gave 4.9 A of rise
 * on one run and 13.3 on the next. The pore lands wetted or unwetted and which
 * one is chance — the bistability note by K_COH says so about the contact
 * angle, and it is just as true of the fill. Every constant on this page that
 * was set by a single measurement was set by reading that coin toss as a value.
 *
 * So this runs one configuration N times and reports the DISTRIBUTION: median
 * and range, plus the one bit that separates the two basins — whether the pore
 * wetted at all. A median over six runs is a number; an instant of one is not.
 *
 *     await Bench.run({steps:1500, repeats:6})
 *     await Bench.sweep('K_WET', [0.004,0.006,0.008],
 *                       v => { K_WET = v*A }, {steps:1500, repeats:6})
 *
 * It drives step() itself and parks the render loop while it does, so a
 * backgrounded tab — where requestAnimationFrame never fires — still runs.
 * Sweeps take a setter closure rather than a variable name for the same reason
 * KNOBS does: the constants are script lexicals, and the closure is the only
 * honest way to reach one.
 */
"use strict";
window.Bench = (function(){

/* The film is anything within a water's reach of a face. Six angstroms is the
   wall field's own realised range, so this bin is "held by the wall" rather
   than an arbitrary slice. */
const FILM_A = 6;
/* Wetted or not, off `climb at wall`. The two basins sit near 17 A and near 4,
   so anything above this is the wetted one. One bit, deliberately: the angle is
   the quantity that cannot be trusted from a single run, which is the point. */
const WETTED_CLIMB_A = 10;

const med = a => { const s=a.slice().sort((x,y)=>x-y);
  return s.length ? s[s.length>>1] : null; };
const r2 = v => v==null ? null : Math.round(v*100)/100;

/* The liquid's own structure, so a change that buys rise by wrecking the water
   cannot pass unnoticed. Nearest neighbour and coordination are the two the
   density work was judged on; bonds a molecule is the one still short. */
function structure(){
  let nn=0, nnN=0, coord=0, live=0;
  for(let i=0;i<nW;i++){
    if(GONE[i]||SPENT[i]) continue;
    live++;
    let best=Infinity, c=0;
    for(let q=0;q<nbrN[i];q++){
      const j=nbr[i*NBR_MAX+q];
      if(GONE[j]) continue;
      const d=Math.hypot(PX[3*j]-PX[3*i], PX[3*j+1]-PX[3*i+1], PX[3*j+2]-PX[3*i+2])/A;
      if(d<best) best=d;
      if(d<3.4) c++;
    }
    if(best<Infinity){ nn+=best; nnN++; }
    coord+=c;
  }
  return { live,
    nearest: nnN ? nn/nnN : null,            // real water 2.76 A
    coord:   live ? coord/live : null,       // real water ~4.5
    bonds:   live ? 2*hbCount/live : null }; // real water 3.6
}

/* THE ACCEPTANCE TEST FOR THE WALL, not the rise number.
 *
 * Lambda IS the pressure here and it is positive under tension. A capillary
 * being drawn up is a GRADIENT: hardest at the meniscus, easing downward, and
 * about zero at the mouth, because a bath sits at ambient and not in tension.
 * So the test is not "positive everywhere" — that was the first version of this
 * and it can never pass, since the reservoir makes the band it feeds dense by
 * feeding it. Measured: lambda at the base is negative at every wall setting
 * tried, film or no film.
 *
 * The defect is a TROUGH. The default wall reads +1.95 at the front, -0.93
 * halfway down and -0.38 at the mouth: a compression pit between a front that
 * is pulling and a base that is being fed. Nothing transmits across a pit, and
 * the middle of that column is not attached to either end. So what is measured
 * is how far the worst interior band falls below the line drawn between the two
 * ends — zero for a clean gradient, large for a decoupled column. */
function tension(){
  const bands=[];
  for(let lo=0; lo<90; lo+=12){
    let sf=0,nf=0,sb=0,nb=0;
    for(let i=0;i<nW;i++){
      if(GONE[i]||SPENT[i]||nbrN[i]<4) continue;
      const y=(PX[3*i+1]-FLOOR)/A;
      if(y<lo||y>=lo+12) continue;
      if((GAP/2-Math.abs(PX[3*i]))/A < FILM_A){ sf+=lam[i]; nf++; }
      else { sb+=lam[i]; nb++; }
    }
    if(nf+nb>=8) bands.push({ y:lo, film:nf?sf/nf:null, body:nb?sb/nb:null, n:nf+nb });
  }
  if(bands.length<3) return { base:null, front:null, sag:null, coupled:false, bands:[] };
  const all = b => b.body!=null ? b.body : b.film;
  const base=all(bands[0]), front=all(bands[bands.length-1]), last=bands.length-1;
  /* How far the worst interior band falls below the straight line from the
     mouth to the meniscus. A clean gradient sags nothing; the pit sags by
     whatever the pit is deep. */
  let sag=0;
  for(let k=1;k<last;k++){
    const line=base+(front-base)*k/last;
    const d=line-all(bands[k]);
    if(d>sag) sag=d;
  }
  /* A fifth of the head is the tolerance: below that the column is a gradient
     with noise on it, above it there is a pit and the middle is attached to
     neither end. */
  return { base, front, sag, coupled: sag < 0.2*Math.max(0.5, front-base), bands };
}

/* How much of the column is film with no body between the walls. This is the
   runaway film as a length rather than as a picture: at the default wall field
   it runs 20 A above the last water that spans the pore. */
function filmOnly(){
  let h=0;
  for(let lo=0; lo<100; lo+=4){
    let f=0,b=0;
    for(let i=0;i<nW;i++){
      if(GONE[i]||SPENT[i]) continue;
      const y=(PX[3*i+1]-FLOOR)/A;
      if(y<lo||y>=lo+4) continue;
      if((GAP/2-Math.abs(PX[3*i]))/A < FILM_A) f++; else b++;
    }
    if(f>0 && b===0) h+=4;
  }
  return h;
}

/* `front` IS READ MID-CHANNEL, so it moves when the surface SHAPE moves and not
   only when water arrives. Flattening a meniscus raises it by the whole climb
   at the wall without a molecule entering the pore — measured, the solver sweep
   showed the front climbing 7.9 A to 17.5 while the water count went up seven
   per cent and the wall top FELL. So `live` and `wallTop` are reported beside
   it: whenever the shape is also in play, the count is the fill and the front
   is not. */
function snapshot(){
  const mid=topAt(0), wall=topAt(16), s=structure(), t=tension();
  return { front:mid, wallTop:wall, climb:(wall==null||mid==null)?null:wall-mid,
           angle:contactAngle(), filmOnly:filmOnly(),
           lamBase:t.base, lamFront:t.front, sag:t.sag, coupled:t.coupled,
           nearest:s.nearest, coord:s.coord, bonds:s.bonds, live:s.live };
}

/* YIELDED THROUGH A MessageChannel, NOT setTimeout. A hidden tab gets Chrome's
   intensive throttling after a few minutes and its timers drop to one a MINUTE,
   which turned a twelve-run sweep into twelve minutes of waiting between five
   seconds of work. A message port is a macrotask the throttle does not touch,
   so the event loop still breathes — the console stays answerable mid-sweep —
   and the pause costs nothing.

   The yield goes BETWEEN runs, never inside one: a run has to be one
   uninterrupted stretch of steps or the page's own loop can interleave. */
const breathe = (function(){
  const ch=new MessageChannel(); let waiting=[];
  ch.port1.onmessage=()=>{ const w=waiting; waiting=[]; w.forEach(r=>r()); };
  return ()=>new Promise(r=>{ waiting.push(r); ch.port2.postMessage(0); });
})();

/* One run, blocking. */
function once(steps){
  resetRun();
  const t0=performance.now(), f0=topAt(0);
  for(let k=0;k<steps;k++){ step(); supply(); evaporate(); }
  const s=snapshot();
  s.rise = (s.front==null||f0==null) ? null : s.front-f0;
  s.wetted = s.climb!=null && s.climb>WETTED_CLIMB_A;
  s.msPerStep = (performance.now()-t0)/steps;
  return s;
}

const KEYS=['rise','wallTop','climb','angle','filmOnly','lamBase','lamFront','sag',
            'nearest','coord','bonds','live','msPerStep'];

function summarise(rows){
  const out={ repeats:rows.length,
    wettedFraction: rows.filter(r=>r.wetted).length/rows.length,
    coupledFraction: rows.filter(r=>r.coupled).length/rows.length };
  for(const k of KEYS){
    const v=rows.map(r=>r[k]).filter(x=>x!=null);
    if(!v.length){ out[k]=null; continue; }
    /* Median and range, never a mean. The distribution is bimodal near the
       wetting threshold, and a mean of two basins is a value neither run had. */
    out[k]=r2(med(v));
    out[k+'_range']=[r2(Math.min(...v)), r2(Math.max(...v))];
  }
  return out;
}

/* Known state, and restored afterwards. A bench that inherits whatever the
   sliders were left on is measuring the last person's session. */
function enter(o){
  const was={ SPEED, FEED, EVAP_RATE };
  SPEED=0;                                  // park the render loop's stepping
  FEED = o.feed!==undefined ? o.feed : true;
  EVAP_RATE = o.evaporation!==undefined ? o.evaporation : 0;
  return was;
}
function leave(was){ SPEED=was.SPEED; FEED=was.FEED; EVAP_RATE=was.EVAP_RATE; }

async function run(o){
  o=o||{};
  const steps=o.steps||1500, repeats=o.repeats||6;
  const was=enter(o), rows=[];
  try{
    for(let r=0;r<repeats;r++){
      rows.push(once(steps));
      if(o.log!==false) console.log(`  run ${r+1}/${repeats}`, r2(rows[r].rise), 'A',
        rows[r].wetted?'wetted':'dry');
      await breathe();
    }
  } finally { leave(was); }
  const sum=summarise(rows);
  sum.steps=steps;
  if(o.log!==false) console.table([sum]);
  return { rows, summary:sum };
}

async function sweep(label, values, apply, o){
  o=o||{};
  const table=[];
  for(const v of values){
    apply(v);
    const { summary }=await run(Object.assign({}, o, { log:false }));
    table.push(Object.assign({ [label]:v }, summary));
    console.log(label, v, '->', r2(summary.rise), 'A rise,',
      Math.round(summary.wettedFraction*100)+'% wetted');
  }
  console.table(table);
  return table;
}

return { run, sweep, once, snapshot, structure, tension, filmOnly,
         FILM_A, WETTED_CLIMB_A };
})();
