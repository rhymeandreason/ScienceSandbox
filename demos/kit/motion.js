/* =============================================================================
 *  kit/motion.js — one clock for every animated thing on a page
 * =============================================================================
 *  Every lesson here grew its own timing: `later(fn,ms)` + a `timers[]` array +
 *  a `cancelTimers()` that half-works, plus a hand-written ease at each call
 *  site (glycolysis: 32, hemoglobin: 27). Three problems come with that, and
 *  they are the same three every time.
 *
 *   1. setTimeout runs on WALL CLOCK; the animation it drives runs on
 *      requestAnimationFrame. A backgrounded tab pauses one and not the other,
 *      so the page comes back with its timers already fired and its tweens
 *      halfway — the model in a pose no step of the lesson describes.
 *   2. Cancelling is per-page and therefore partial. The timers get cleared;
 *      the `t+=0.02` counters inside the loop do not, so a rewind lands on a
 *      molecule still sliding to where it was going.
 *   3. A step you cannot SEEK is a step you cannot scrub, rewind or screenshot.
 *      Lessons want all three, so each one rebuilds the state by hand.
 *
 *  So: no wall clock, no page-local counters. Beats live on a timeline with
 *  absolute times, the render loop advances it, and cancelling drops the whole
 *  thing at once.
 *
 *  Loaded as a classic script; exposes window.Motion (and module.exports for
 *  the checker — this file is pure arithmetic and has no THREE dependency).
 *
 *  Usage:
 *    const M = Motion.create();
 *    M.tween({dur:.6, ease:'outCubic', onUpdate:t=>g.position.y=lerp(a,b,t)});
 *    const tl = M.seq([
 *      {dur:.5, onUpdate:t=>...},                    // runs at 0
 *      {call:()=>FXi.spawnRing(p)},                  // fires when 0.5 is reached
 *      {dur:.8, ease:'inOutCubic', onUpdate:t=>...}, // runs at 0.5
 *      {at:0.2, dur:.4, onUpdate:t=>...},            // absolute: overlaps beat 1
 *    ], {tag:'step3'});
 *    M.step(dt);                                     // from the render loop
 *    M.cancel('step3');                              // or M.cancel() for all
 * ========================================================================== */
(function(global){
  'use strict';

  /* ---- easings ----
   * Named, not typed at the call site. A page that writes `t*t*(3-2*t)` inline
   * four times has four chances to write it differently, and the difference is
   * invisible in review and obvious on screen. */
  const clamp01=t=>t<0?0:t>1?1:t;
  const EASE={
    linear:   t=>t,
    inQuad:   t=>t*t,
    outQuad:  t=>t*(2-t),
    inOutQuad:t=>t<.5?2*t*t:-1+(4-2*t)*t,
    inCubic:  t=>t*t*t,
    outCubic: t=>1-Math.pow(1-t,3),
    inOutCubic:t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2,
    smooth:   t=>t*t*(3-2*t),
    // A settle: overshoots ~10% then comes back. For something ARRIVING —
    // a phosphate landing, a chain docking. Never for something LEAVING, where
    // the overshoot reads as the molecule changing its mind.
    outBack:  t=>{ const c=1.70158; return 1+(c+1)*Math.pow(t-1,3)+c*Math.pow(t-1,2); },
    // Symmetric 0→1→0. For a pulse that must end where it started, so a
    // cancelled highlight cannot strand a mesh mid-glow.
    pulse:    t=>Math.sin(Math.PI*t),
  };
  const easeFn=e=>typeof e==='function'?e:(EASE[e]||EASE.smooth);

  function create(){
    let beats=[];        // {t0,t1,ease,onUpdate,onDone,call,tag,done,tl}
    let clock=0;         // seconds since create(); only ever advanced by step()
    let paused=false;

    /* One beat. `dur:0` (or a `call`) makes it an instant — fired the first
     * time the clock reaches its time, exactly once, edge-triggered. */
    function push(b, tag, base){
      const at=(b.at!=null?b.at:0)+base;
      const beat={ t0:clock+at, t1:clock+at+(b.dur||0),
        ease:easeFn(b.ease), onUpdate:b.onUpdate||null, onDone:b.onDone||null,
        call:b.call||null, tag:tag||b.tag||null, started:false, done:false };
      beats.push(beat);
      return beat;
    }

    function tween(b){ const beat=push(b, b.tag, 0); return handleFor([beat]); }
    function after(sec, fn, tag){ return tween({at:sec, dur:0, call:fn, tag}); }

    /* A sequence. A beat with no `at` starts when the previous one ENDS; a beat
     * with `at` is placed absolutely, which is how two things overlap. That
     * mix is deliberate: most beats are "and then", and writing `at:` for every
     * one of them turns a re-timed animation into an arithmetic exercise where
     * every later number has to move. */
    function seq(list, opts={}){
      const tag=opts.tag||null, base=opts.at||0;
      let cursor=base, made=[];
      list.forEach(b=>{
        const at=(b.at!=null?b.at:cursor);
        const beat=push(Object.assign({},b,{at}), tag, 0);
        made.push(beat);
        if(b.at==null) cursor=at+(b.dur||0);
        else cursor=Math.max(cursor, at+(b.dur||0));
      });
      return handleFor(made, cursor-base);
    }

    function handleFor(made, dur){
      const t0=Math.min(...made.map(b=>b.t0));
      return {
        duration: dur!=null?dur:Math.max(...made.map(b=>b.t1))-t0,
        get done(){ return made.every(b=>b.done); },
        cancel(){ made.forEach(b=>{ b.done=true; }); prune(); },
        /* SEEK — put everything at time `t` without playing to it. `onUpdate`
         * beats are applied (they are pure functions of t, so this is exact);
         * `call` beats are NOT fired, because they are side effects — a scrub
         * that re-spawns four rings is worse than one that spawns none. A page
         * that needs the side effect on a rewind re-runs the step. */
        seek(t){
          made.forEach(b=>{
            if(!b.onUpdate) return;
            const span=b.t1-b.t0, local=t-(b.t0-t0);
            const u=span>0?clamp01(local/span):(local>=0?1:0);
            b.onUpdate(b.ease(u), u);
          });
        },
      };
    }

    function prune(){ if(beats.some(b=>b.done)) beats=beats.filter(b=>!b.done); }

    /* Advance. `dt` comes from the render loop, so a paused tab freezes the
     * whole timeline rather than skipping it — and a lesson can slow everything
     * down for a screenshot by passing a smaller dt, with nothing to change at
     * any call site. dt is CLAMPED: an alt-tab of 40 s otherwise arrives as one
     * 40-second frame and every pending beat completes in it. */
    function step(dt){
      if(paused) return;
      clock += Math.min(dt==null?1/60:dt, 0.1);
      let fired=false;
      // Snapshot: a `call` beat may schedule more beats, and those must not run
      // in the same frame that created them (they'd see a clock that has not
      // advanced since, i.e. instantly).
      const now=beats.slice();
      for(const b of now){
        if(b.done) continue;
        if(clock<b.t0) continue;
        const span=b.t1-b.t0;
        const u=span>0?clamp01((clock-b.t0)/span):1;
        if(b.onUpdate) b.onUpdate(b.ease(u), u);
        if(!b.started){ b.started=true; if(b.call) b.call(); fired=true; }
        if(u>=1){ b.done=true; fired=true; if(b.onDone) b.onDone(); }
      }
      if(fired) prune();
    }

    /* Cancel. With no tag, everything — which is what a page's restart() wants
     * and what its hand-rolled version never quite achieved. Cancelled beats do
     * NOT get a final onUpdate(1): a cancel means "stop", and snapping the
     * molecule to the end pose of an abandoned animation is how a rewind ends
     * up showing the state it was rewinding from. */
    function cancel(tag){
      if(tag==null) beats=[];
      else beats=beats.filter(b=>b.tag!==tag);
    }

    return {
      tween, seq, after, step, cancel,
      get busy(){ return beats.length>0; },
      busyWith(tag){ return beats.some(b=>b.tag===tag); },
      get time(){ return clock; },
      pause(b){ paused=b!==false; },
      EASE,
    };
  }

  const API={create, EASE, easeFn, clamp01};
  global.Motion=API;
  if(typeof module==='object' && module.exports) module.exports={Motion:API};
})(typeof globalThis!=='undefined'?globalThis:this);
