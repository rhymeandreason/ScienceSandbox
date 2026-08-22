#!/usr/bin/env node
/* =====================================================================
 *  check-energy.js — what the free-energy figures claim.
 *
 *  WHY THIS EXISTS. Every one of these failures draws a perfectly plausible
 *  picture, which is why none of them is visible from the page:
 *
 *    1. THE AXIS HAS NO SCALE, so a height is a SIGN and never a magnitude. A
 *       number on the figure — a tick, a ΔG, a kJ — turns an unsourced drawing
 *       into a quantitative claim, and a pathway page has no per-step value to
 *       source it from. This is the module's one rule and the easiest to break
 *       by adding something helpful.
 *    2. THE SHAPES SAY WHAT THEY MEAN. `up` has to end BELOW where it started
 *       once coupled, or the figure says the step still does not go. `shallow`
 *       has to be shallow. `pull` must NOT end below its start — nothing was
 *       spent, the product was removed, and drawing it as a drop teaches the
 *       wrong mechanism for the one step that has it.
 *    3. EVERY TONE HAS A COLOUR. This one has already happened: the flavin's
 *       `f` had no rule, so the coupled trace stroked `none` and step 6 drew
 *       its dashed "on its own" line and nothing else — which reads as one
 *       steeper step, not as a missing trace.
 *    4. THE HOSTS ONLY PASS FLAGS THE MODULE KNOWS. A typo'd flag falls through
 *       to the plain shape silently, and a plain shape is a real drop: the step
 *       renders as a confident claim nobody made.
 *
 *  Run:  node energy/check-energy.js
 * ===================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const HERE = __dirname, DEMOS = path.join(HERE, '..');
const E   = require(path.join(HERE, 'energy.js'));
const src = fs.readFileSync(path.join(HERE, 'energy.js'), 'utf8');
const css = fs.readFileSync(path.join(HERE, 'energy.css'), 'utf8');
const { levels, curve, solo, pair, tabs, Y, BARRIER } = E;

let fails = 0, checks = 0;
function ok(cond, what, detail) {
  checks++;
  if (cond) console.log(`  ok    ${what}${detail ? '   ' + detail : ''}`);
  else { fails++; console.log(`  FAIL  ${what}${detail ? '   ' + detail : ''}`); }
}
// y grows DOWNWARD and free energy grows upward, so "lower" is a larger y.
const lower = (a, b) => a > b;

console.log('free-energy figures — energy/energy.js\n');

/* ---- 1. the shapes say what they mean --------------------------------- */
console.log('the four shapes');
{
  const up = levels({ up:true });
  ok(!lower(up.endAlone, up.start),
     'up: on its own it ends ABOVE where it started — the step does not go', 
     `${up.start} → ${up.endAlone}`);
  ok(lower(up.endWith, up.start),
     'up: coupled, it ends BELOW where it started — now it does', 
     `${up.start} → ${up.endWith}`);

  const down = levels({});
  ok(lower(down.endAlone, down.start), 'plain: a real drop');
  ok(lower(down.endWith, down.start) && !lower(down.endWith, down.endAlone),
     'plain: coupled it still falls, but not as far — the difference is what was banked',
     `${down.endAlone} alone vs ${down.endWith} coupled`);

  const sh = levels({ shallow:true });
  ok(lower(sh.endAlone, sh.start) && (sh.endAlone - sh.start) < (down.endAlone - down.start),
     'shallow: downhill, and less far than a plain step — the slope IS the claim',
     `${sh.endAlone-sh.start}px vs ${down.endAlone-down.start}px`);
  ok(Math.abs((sh.start + sh.endAlone)/2 - Y.mid) < 1e-9,
     'shallow: centred on the middle, not hung off the top — on an unscaled axis'
     + ' only slope reads, and a small drop starting high reads as position');

  const pull = levels({ up:true, pull:'x' });
  ok(!lower(pull.endWith, pull.start),
     'pull: the product is removed, nothing is spent — so it does NOT end below its start',
     `${pull.start} → ${pull.endWith}`);
  ok(lower(pull.endWith, pull.endAlone),
     'pull: it still gets further than the reaction alone does');
}

/* ---- 2. there is always a barrier, and it is above everything ---------- */
console.log('\nthe barrier');
{
  const SHAPES = [{}, {up:true}, {shallow:true}, {up:true,pull:'x'}];
  const highest = L => Math.min(L.start, L.endAlone, L.endWith);
  ok(SHAPES.every(c => { const L = levels(c); return highest(L) - L.barrier < highest(L); }),
     'every shape climbs before it falls — a reaction with no barrier is a reaction'
     + ' the mass-action modal cannot be talking about');
  ok(levels({ barrier: 40 }).barrier === 40 && levels({}).barrier === BARRIER,
     'the barrier is an INPUT with a shared default — the enzymes lesson moves it'
     + ' while pinning the ends, which is the opposite of what a pathway does');
  const at = levels({ at:{ start:10, endAlone:20, endWith:30 } });
  ok(at.start === 10 && at.endWith === 30,
     '`at` overrides the levels outright, for a host none of the flags describe');
}

/* ---- the two traces share one transition state ------------------------ */
/* DELIBERATE, and the assertion is here because it looks like a bug. The two
 * traces ARE different reactions and their real barriers differ — but the axis
 * carries no scale, so two humps of different heights make a claim about RATE,
 * and coupling changes neither barrier. The approximation is named in
 * energy.js's header; this stops a tidy-up replacing it with a false claim. */
console.log('\nthe shared climb');
{
  const peaksOf = svg => [...svg.matchAll(/126,(-?[\d.]+)/g)].map(m => +m[1]);
  const startsOf = svg => [...svg.matchAll(/M34,(-?[\d.]+)/g)].map(m => +m[1]);
  for (const [name, c] of [['plain',{}], ['up',{up:true}], ['shallow',{shallow:true}],
                           ['pull',{up:true,pull:'x'}]]) {
    const svg = curve({ ...c, from:'A', to:'B', pullName:'OAA' });
    const [p1, p2] = peaksOf(svg), [s1, s2] = startsOf(svg);
    ok(p1 === p2, `${name}: both traces climb through ONE peak`, `${p1} / ${p2}`);
    ok(s1 === s2, `${name}: both traces leave the same start — the only thing that`
       + ' differs between the two readings is where the reaction ENDS');
  }
  const L = levels({ up:true });
  const peak = peaksOf(curve({ up:true, from:'A', to:'B' }))[0];
  ok(peak < Math.min(L.start, L.endAlone, L.endWith),
     'the peak is above the HIGHEST end, so even an uphill step climbs before it falls');

  /* THE ONE FIGURE ALLOWED TWO HUMPS, and it inverts the argument rather than
   * escaping it: the ends are pinned, so the heights are a claim about rate and
   * a true one. It has to be ASKED for, and a pathway may not ask. */
  const enz = { from:'S', to:'P', barrier:10, barrierAlone:24,
                at:{ start:Y.hi, endAlone:Y.lo, endWith:Y.lo } };
  const [pw, pa] = peaksOf(curve(enz));
  ok(pw !== pa, '`barrierAlone`: the two traces peak separately — the barrier IS the claim',
     `${pw} / ${pa}`);
  ok(pa < pw, 'the uncatalysed trace has the HIGHER hump');
  const Le = levels(enz);
  ok(Le.endAlone === Le.endWith && Le.start === Y.hi,
     'and the ends do not move — an enzyme changes neither ΔG, so a figure that'
     + ' let the second barrier drag an end would teach the opposite');
  ok(peaksOf(curve({ ...enz, barrierAlone:undefined }))[0]
     === peaksOf(curve({ ...enz, barrierAlone:undefined }))[1],
     'omit it and the two traces are back to one peak');
  ok(curve({ ...enz, aloneLabel:'' }).match(/class="et /g).length === 1,
     'a blank label draws no text — the enzyme figure names the reaction once,'
     + ' not once per barrier');
}

/* ---- the two labels never collide ------------------------------------- */
/* A `shallow` step's ends are 10px apart at a 10px font, so labels stacked
 * above them sit on top of each other and neither reads. The lower one drops
 * under its own trace, which also keeps a `pull` step's phrase off the trace it
 * names. Measured, because the shapes are what produce the collision. */
console.log('\nthe labels');
{
  const LINE = 10;                       // .et is 10px in energy.css
  const at = svg => [...svg.matchAll(/class="et \w+"\s+x="266" y="([\d.]+)"/g)]
                      .map(m => +m[1]);
  for (const [name, c] of [['plain',{}], ['up',{up:true}], ['shallow',{shallow:true}],
                           ['pull',{up:true,pull:'x'}]]) {
    const ys = at(curve({ ...c, from:'A', to:'B', pullName:'OAA' }));
    ok(ys.length === 2 && Math.abs(ys[0] - ys[1]) >= LINE + 3,
       `${name}: the two labels clear each other`, `${ys.join(' and ')}`);
    ok(ys.every(y => y > 20 && y <= 145),
       `${name}: both labels stay on the card`);
  }
  const L = levels({ shallow:true });
  const ys = at(curve({ shallow:true, from:'A', to:'B' }));
  ok(Math.max(...ys) > Math.max(L.endAlone, L.endWith),
     'the lower label sits BELOW the trace it names — above it there is no room'
     + ' between two ends this close');
}

/* ---- 3. THE AXIS HAS NO SCALE ----------------------------------------- */
/* The rule the whole module exists under. Checked on the OUTPUT, not the
 * source, because the way this breaks is a host passing a number through. */
console.log('\nno magnitudes');
{
  const c = { up:true, cin:'ATP', cout:'ADP', tone:'p', from:'glucose', to:'G6P' };
  const drawings = [curve(c), pair(c), solo({ from:'A', to:'B' }),
                    solo({ from:'A', to:'B', drop:true })];
  const labels = drawings.flatMap(d =>
    [...d.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g)].map(m => m[1].replace(/<[^>]*>/g, '')));
  // A digit is not the test — G6P and FADH₂ are names. A QUANTITY is: a bare
  // number, or a number carrying a unit or a sign.
  const quantity = t => /^[+-]?[\d.]+$/.test(t.trim())
                     || /[+-]?\s*[\d.]+\s*(kJ|kcal|mol|%|°|nm|kT)/i.test(t);
  ok(!labels.some(quantity),
     'no drawn label is a quantity — the figure states a direction, never a value',
     labels.join(' · '));
  ok(!/(kJ|kcal|ΔG|\bmol\b)/.test(drawings.join('')),
     'no ΔG, no kJ, no mol — published magnitudes are coupling/coupling.js\'s subject,'
     + ' on its own audited axis');
  ok(!/class="tick"|stroke-dasharray:2/.test(css) && /axl|axh/.test(css),
     'the axis is a line and an arrowhead, with no ticks to read a value off');
}

/* ---- 4. ΔG IS WHETHER, NEVER HOW FAST --------------------------------- */
/* massaction.js's whole subject, and the fastest way to undo it here is a
 * caption calling a downhill reaction "fast". A prose failure nothing else in
 * this repo can catch. */
{
  const prose = src.replace(/massaction[^\n]*/g, '');
  ok(!/\b(fast|faster|quick|slow|slower|rate of)\b/i.test(prose),
     'nothing here calls a downhill reaction fast — the barrier says how fast,'
     + ' and that is the other module');
}

/* ---- 5. every tone a host uses has a colour --------------------------- */
/* The flavin bug: `tone:'f'` with no rule strokes the coupled trace `none`, and
 * a figure missing one of its two traces looks like a figure with one trace. */
console.log('\ntones');
const PAGES = ['glycolysis-lab.html', 'krebs-lab.html'];
const pageSrc = Object.fromEntries(
  PAGES.map(p => [p, fs.readFileSync(path.join(DEMOS, p), 'utf8')]));
{
  const used = new Set();
  for (const p of PAGES)
    for (const m of pageSrc[p].matchAll(/couple:\s*\{[^}]*tone:\s*'(\w+)'/g)) used.add(m[1]);
  ok(used.size > 0, 'the pathway pages declare tones', [...used].join(' '));
  for (const t of used) {
    ok(new RegExp(`\\.cpl\\.${t} \\.rc\\.with\\{stroke:`).test(css)
       && new RegExp(`\\.cpl\\.${t} \\.cl\\{stroke:`).test(css),
       `tone '${t}' colours BOTH figures — an uncoloured trace strokes none and disappears`);
  }
}

/* ---- 6. the hosts pass only flags the module reads --------------------- */
/* A typo'd flag falls through to the plain shape, which is a real drop — the
 * step then renders a confident claim nobody made. */
console.log('\nthe hosts');
{
  const KNOWN = new Set(['up','shallow','pull','cin','cout','tone','plus','barrier','at',
                         'aloneLabel','withLabel']);
  for (const p of PAGES) {
    const bad = new Set();
    for (const m of pageSrc[p].matchAll(/couple:\s*\{([^}]*)\}/g))
      for (const k of m[1].matchAll(/(\w+)\s*:/g)) if (!KNOWN.has(k[1])) bad.add(k[1]);
    ok(bad.size === 0, `${p} passes only flags energy.js reads`,
       bad.size ? `unknown: ${[...bad].join(', ')}` : '');
    ok(/energy\/energy\.js/.test(pageSrc[p]) && /energy\/energy\.css/.test(pageSrc[p]),
       `${p} loads the module and its stylesheet`);
    ok(!/function\s+(coupleCurve|coupleFig|soloCurve)\s*\(/.test(pageSrc[p]),
       `${p} keeps no copy of the drawing — one figure, one place`);
    ok(!/barrierAlone/.test(pageSrc[p]),
       `${p} declares no second barrier — two humps on a pathway step would say`
       + ' coupling changed the rate, and it changes neither barrier');
  }
}

/* ---- 7. the tab strip names both views -------------------------------- */
{
  const strip = tabs('curve');
  ok(/data-figtab="curve"[^>]*class="on"/.test(strip) && /data-figtab="pair"/.test(strip),
     'the strip offers both views and marks the live one');
}

console.log('');
if (fails) { console.log(`FAIL: ${fails} of ${checks} checks failed.`); process.exit(1); }
console.log(`PASS: ${checks} checks — the free-energy figures claim a direction and nothing more.`);
