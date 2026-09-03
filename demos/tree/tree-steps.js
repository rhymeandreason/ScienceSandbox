/* =============================================================================
 *  tree/tree-steps.js — the mass-of-a-tree lesson, as steps for the shell
 * =============================================================================
 *  Content only: what each step says, what controls it puts in the panel,
 *  and what it asks the scene to do through ctx. The scene is tree/tree.js
 *  behind kit/lesson-shell.js; tree-lab.html wires the two and hands the
 *  steps this ctx:
 *
 *      ui, state, goTo          the shell's
 *      tree, sapling, flows, piles, tweens, setDaylight, setTreeOpacity,
 *      showPotScene, flowsOff   the Tree sim's
 *      flyTo                    the Tree mount's
 *
 *  The one measured claim is step 6's allometry, cited where it is used.
 *  Exposes window.TreeSteps.
 * ========================================================================== */
(function (global) {
  'use strict';
  const { CATS, SHARES, PCT } = global.Tree.PILES;
  const easeOut = global.Tree.easeOut;

  const fmtInt = n => Math.round(n).toLocaleString('en-US');
  const lbOz = lb => { const oz = Math.round(lb * 16), l = Math.floor(oz / 16), o = oz % 16; return o ? `${l} lb ${o} oz` : `${l} lb`; };
  const kgFrom = (lb, d = 1) => `${(lb * 0.45359).toFixed(d)} kg`;
  const mass = kg => (kg < 1000 ? `${fmtInt(kg)} kg` : `${(kg / 1000).toFixed(kg < 10000 ? 1 : 0)} t`);

  /* Forestry model, step 6: height saturates with diameter; dry mass after
     Chave et al. 2014 with wood density 0.6 g/cm³. */
  const heightFor = D => 1.3 + 30 * (1 - Math.exp(-D / 40));
  const dryMassFor = D => 0.0673 * Math.pow(0.6 * D * D * heightFor(D), 0.976);
  const REF_D = 60;

  const legendHtml = mode => CATS.map(c => `
    <div class="legend-row">
      <span class="legend-name"><i style="--c:${c.css}"></i>${c.name}</span>
      <span class="bar"><i style="--c:${c.css};--w:${SHARES[mode][c.key]}%"></i></span>
      <span class="legend-pct">${PCT[mode][c.key]}</span>
    </div>`).join('');

  const GUESS_TEXT = {
    'The soil': 'You guessed <strong>the soil</strong>, and most people do. The soil holds the tree up and hands it water and a pinch of minerals, but it gives up almost none of its own mass.',
    'Water': 'You guessed <strong>water</strong>, just as Van Helmont did. Water does contribute: the hydrogen in wood came from it. But that is only a few percent of the dry mass.',
    'The air': 'You guessed <strong>the air</strong>. Correct, and unusual: most people say the soil.',
    'Sunlight': 'You guessed <strong>sunlight</strong>. Light powers the construction, but it weighs nothing. It supplies the energy, not the material.',
  };

  const steps = [
    {
      id: 'question', eyebrow: 'Start here', title: 'Where does a tree’s mass come from?',
      body: `<p>This oak is about 25 metres tall. Its trunk, branches and roots hold roughly two tonnes of dry wood, and the tree built every gram of it from ingredients it found nearby.</p>
             <p>Before we look, take a guess. Where did <em>most</em> of that material come from?</p>`,
      camera: { pos: [21, 9.5, 28], target: [0, 6.5, 0] },
      nextLabel: 'Test it',
      onEnter(ctx) {
        const { ui, state } = ctx;
        ctx.showPotScene(false); ctx.setDaylight(1); ctx.flowsOff(); ctx.piles.gather(); ctx.setTreeOpacity(1);
        ui.controls(`
          <div class="choices" role="group" aria-label="Your guess">
            ${['The soil', 'Water', 'The air', 'Sunlight'].map(c => `<button class="choice" type="button" data-choice="${c}">${c}</button>`).join('')}
          </div>
          <div class="callout is-hidden" id="guess-note"></div>`);
        ui.setNext('Test it', !!state.guess);
        const note = ui.q('#guess-note');
        const paint = () => ui.qa('.choice').forEach(b => b.classList.toggle('is-selected', b.dataset.choice === state.guess));
        if (state.guess) { paint(); note.innerHTML = `Noted: <strong>${state.guess.toLowerCase()}</strong>. Let’s put it to the test.`; ui.show(note); }
        ui.qa('.choice').forEach(b => b.addEventListener('click', () => {
          state.guess = b.dataset.choice; paint();
          note.innerHTML = `Noted: <strong>${state.guess.toLowerCase()}</strong>. Let’s put it to the test.`;
          ui.show(note); ui.setNext('Test it', true);
        }));
        if (!state.grown) {
          state.grown = true;
          ctx.tweens.to(0.02, 1, 3.4, g => ctx.tree.setGrowth(g), { ease: easeOut, key: 'grow' });
        } else ctx.tree.setGrowth(1);
      },
    },
    {
      id: 'helmont', eyebrow: 'An experiment, 1640s', title: 'Van Helmont weighs a willow.',
      body: `<p>Jan Baptist van Helmont planted a five-pound willow in a pot holding 200 pounds of oven-dried soil. For five years he gave it nothing but rainwater, and covered the pot so no dust could settle in.</p>
             <p>Drag through the years.</p>`,
      camera: { pos: [5.2, 3.6, 7], target: [0, 2.3, 0] },
      onEnter(ctx) {
        const { ui, state } = ctx;
        ctx.showPotScene(true); ctx.setDaylight(1); ctx.flowsOff();
        ui.controls(`
          <div class="slider">
            <div class="slider-head"><span class="label">Year</span><span class="value" id="yr-val">0</span></div>
            <input type="range" id="yr" min="0" max="5" step="0.05" value="${state.year}" aria-label="Year">
          </div>
          <div class="stats">
            <div class="stat"><span class="stat-label">Willow</span><span class="stat-value" id="tree-lb"></span><span class="stat-sub" id="tree-kg"></span></div>
            <div class="stat"><span class="stat-label">Soil</span><span class="stat-value" id="soil-lb"></span><span class="stat-sub" id="soil-kg"></span></div>
          </div>
          <button class="btn secondary is-hidden" type="button" id="weigh">Weigh the soil again</button>
          <div class="callout is-hidden" id="helmont-note">
            <strong>The willow gained 164 pounds (74 kg).</strong> The soil lost about two ounces (57 g). Whatever the tree is made of, it did not come out of the soil.
          </div>`);
        ui.setNext('Next');
        const weigh = ui.q('#weigh'), note = ui.q('#helmont-note');
        ui.range(ui.q('#yr'), y => {
          state.year = y;
          const f = y / 5, treeLb = 5 + 164.19 * Math.pow(f, 1.4), soilLb = 200 - 0.125 * f;
          ui.q('#yr-val').textContent = y.toFixed(1);
          ui.q('#tree-lb').textContent = lbOz(treeLb); ui.q('#tree-kg').textContent = kgFrom(treeLb);
          ui.q('#soil-lb').textContent = lbOz(soilLb); ui.q('#soil-kg').textContent = kgFrom(soilLb, 2);
          ctx.sapling.setGrowth(0.5 + 0.5 * Math.pow(f, 0.8));
          if (f >= 0.99 && weigh.classList.contains('is-hidden') && note.classList.contains('is-hidden')) ui.show(weigh);
        });
        weigh.addEventListener('click', () => { ui.hide(weigh); ui.show(note); ui.setNext('So where, then?'); });
      },
    },
    {
      id: 'water', eyebrow: 'A reasonable mistake', title: 'His answer: water.',
      body: `<p>Van Helmont had added only water, so he concluded that the willow was made of water. It was a fair inference for 1640. Nobody yet knew that air was a mixture of gases, or that a gas could weigh anything at all.</p>
             <p>The missing ingredient was in the one place he had not thought to look.</p>`,
      camera: { pos: [8, 4.8, 10.5], target: [0, 2.8, 0] },
      onEnter(ctx) {
        const { ui } = ctx;
        ctx.showPotScene(true); ctx.sapling.setGrowth(1);
        ui.controls(`
          <button class="btn secondary" type="button" id="show-air">Look at the air</button>
          <div class="callout is-hidden" id="air-note">
            Air is about 0.04% carbon dioxide, roughly <strong>0.8 grams in every cubic metre</strong>. It is invisible, but it is not nothing, and a leafy tree passes an enormous amount of it every day.
          </div>`);
        ui.q('#show-air').addEventListener('click', () => {
          ctx.flows.ambient.setIntensity(1);
          ui.hide(ui.q('#show-air')); ui.show(ui.q('#air-note')); ui.setNext('How it gets in');
        });
      },
      onExit(ctx) { ctx.flows.ambient.setIntensity(0); },
    },
    {
      id: 'photosynthesis', eyebrow: 'Photosynthesis', title: 'The tree is built from air.',
      body: `<p>In sunlight, leaves take in carbon dioxide from the air and water sent up from the roots. They pull both apart and reassemble the atoms into sugar. The sugar becomes cellulose and lignin: wood. The leftover oxygen is released.</p>
             <p>Switch on the flows to watch the traffic.</p>`,
      camera: { pos: [14, 11, 19], target: [0, 8, 0] },
      onEnter(ctx) {
        const { ui, state, flows } = ctx;
        ctx.showPotScene(false); ctx.tree.setGrowth(1); ctx.setTreeOpacity(1); ctx.piles.gather();
        ui.controls(`
          <div class="row">
            <label class="switch"><input type="checkbox" id="sun" ${state.sunOn ? 'checked' : ''}><span class="track"></span><span>Sunlight</span></label>
          </div>
          <div class="chips">
            <button class="chip" type="button" data-flow="co2"><i style="--c:var(--air)"></i>CO₂ in</button>
            <button class="chip" type="button" data-flow="h2o"><i style="--c:var(--water)"></i>Water up</button>
            <button class="chip" type="button" data-flow="o2"><i style="--c:var(--o2)"></i>O₂ out</button>
          </div>
          <p class="hint-text" id="flow-hint">Turn on all three flows to see the recipe.</p>
          <div class="equation is-hidden" id="eq">
            <div class="eq-line"><span class="t-air">6 CO₂</span> + <span class="t-water">6 H₂O</span> <span class="arrow">→</span> <span class="t-sugar">C₆H₁₂O₆</span> + <span class="t-o2">6 O₂</span></div>
            <div class="eq-caption">carbon dioxide + water, with light energy, become sugar + oxygen</div>
          </div>
          <div class="callout night is-hidden" id="dark-note">No light, no building. In the dark the tree only respires: it burns a little sugar and gives some CO₂ back.</div>`);
        const sunEl = ui.q('#sun');
        const apply = () => {
          const on = state.sunOn;
          flows.co2.setIntensity(on && state.flows.co2 ? 1 : 0);
          flows.o2.setIntensity(on && state.flows.o2 ? 1 : 0);
          flows.h2o.setIntensity(state.flows.h2o ? (on ? 1 : 0.35) : 0);
          flows.minerals.setIntensity(state.flows.h2o ? (on ? 1 : 0.35) : 0);
          ui.qa('.chip').forEach(c => c.classList.toggle('is-on', state.flows[c.dataset.flow]));
          const all = state.flows.co2 && state.flows.h2o && state.flows.o2;
          if (all && ui.q('#eq').classList.contains('is-hidden')) { ui.hide(ui.q('#flow-hint')); ui.show(ui.q('#eq')); }
          ui.q('#dark-note').classList.toggle('is-hidden', on);
        };
        sunEl.addEventListener('change', () => { state.sunOn = sunEl.checked; ctx.setDaylight(state.sunOn ? 1 : 0); apply(); });
        ui.qa('.chip').forEach(c => c.addEventListener('click', () => { state.flows[c.dataset.flow] = !state.flows[c.dataset.flow]; apply(); }));
        ctx.setDaylight(state.sunOn ? 1 : 0);
        apply();
      },
      onExit(ctx) { ctx.flowsOff(); ctx.state.sunOn = true; ctx.setDaylight(1); },
    },
    {
      id: 'apart', eyebrow: 'Accounting', title: 'Take the tree apart.',
      body: `<p>Dry a piece of wood and weigh what is left. About half of it is carbon. Nearly all the rest is oxygen and hydrogen. The minerals that came from the soil, the obvious answer, add up to about one percent.</p>
             <p>Trace each part back to where it entered the tree.</p>`,
      camera: { pos: [1, 8.5, 34], target: [0, 4.5, 6] },
      cameraPortrait: { pos: [0, 15, 32], target: [0, 0.5, 9] },
      onEnter(ctx) {
        const { ui, piles } = ctx;
        ctx.showPotScene(false); ctx.flowsOff(); ctx.tree.setGrowth(1);
        const NOTES = {
          dry: '<strong>About 93% of the dry mass arrived as carbon dioxide.</strong> Most of the rest is hydrogen from water. The soil supplied about 1%, as minerals.',
          fresh: '<strong>A living tree is roughly half water by weight.</strong> Count that, and water’s share jumps. But the soil’s share stays below 1%. It was never the building material.',
        };
        ui.controls(`
          <button class="btn secondary" type="button" id="apart">Take it apart</button>
          <div class="seg is-hidden" id="mode" role="group" aria-label="Weigh as">
            <button type="button" data-mode="dry" class="is-on">Dry wood</button><button type="button" data-mode="fresh">Living tree</button>
          </div>
          <div class="legend is-hidden" id="legend">${legendHtml('dry')}</div>
          <div class="callout is-hidden" id="apart-note">${NOTES.dry}</div>`);
        const setMode = m => {
          piles.explode(m);
          ui.q('#legend').innerHTML = legendHtml(m);
          ui.q('#apart-note').innerHTML = NOTES[m];
          ui.qa('#mode button').forEach(b => b.classList.toggle('is-on', b.dataset.mode === m));
        };
        ui.q('#apart').addEventListener('click', () => {
          ui.hide(ui.q('#apart')); ctx.setTreeOpacity(0.12, 1.2); setMode('dry');
          ui.show(ui.q('#legend')); ui.show(ui.q('#mode')); ui.show(ui.q('#apart-note'));
          ui.setNext('Scale it up');
        });
        ui.qa('#mode button').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
      },
      onExit(ctx) { ctx.piles.gather(); ctx.setTreeOpacity(1, 1.2); },
    },
    {
      id: 'scale', eyebrow: 'Scale it up', title: 'How much air is in a tree?',
      body: `<p>A tree’s dry mass tracks the diameter of its trunk closely enough that foresters estimate stored carbon without felling anything. The figure beside the trunk is 1.8 metres tall.</p>
             <p>Change the trunk and watch the numbers.</p>`,
      camera: { pos: [26, 12, 33], target: [0, 7.5, 0] },
      onEnter(ctx) {
        const { ui, state } = ctx;
        ctx.showPotScene(false); ctx.flowsOff();
        ui.controls(`
          <div class="slider">
            <div class="slider-head"><span class="label">Trunk diameter</span><span class="value" id="d-val"></span></div>
            <input type="range" id="d" min="10" max="120" step="1" value="${state.diameter}" aria-label="Trunk diameter in centimetres">
          </div>
          <div class="stats">
            <div class="stat"><span class="stat-label">Height</span><span class="stat-value" id="h"></span><span class="stat-sub">approx.</span></div>
            <div class="stat"><span class="stat-label">Dry mass</span><span class="stat-value" id="m"></span><span class="stat-sub">wood, dried</span></div>
            <div class="stat accent"><span class="stat-label">CO₂ taken from air</span><span class="stat-value" id="co2"></span><span class="stat-sub">over its lifetime</span></div>
            <div class="stat"><span class="stat-label">Same as driving</span><span class="stat-value" id="km"></span><span class="stat-sub">in a petrol car</span></div>
          </div>
          <p class="foot">Allometry after Chave et al. (2014) with wood density 0.6 g/cm³. Carbon taken as 50% of dry mass; CO₂ is 44/12 times the carbon. Car at 170 g CO₂ per km.</p>`);
        ui.range(ui.q('#d'), D => {
          state.diameter = D;
          const H = heightFor(D), M = dryMassFor(D), co2 = M * 0.5 * (44 / 12);
          ui.q('#d-val').textContent = `${D} cm`;
          ui.q('#h').textContent = `${H.toFixed(0)} m`;
          ui.q('#m').textContent = mass(M);
          ui.q('#co2').textContent = mass(co2);
          ui.q('#km').textContent = `${fmtInt(Math.round(co2 / 0.17 / 100) * 100)} km`;
          ctx.tree.setGrowth(H / heightFor(REF_D));
        });
      },
      onExit(ctx) { ctx.tree.setGrowth(1); },
    },
    {
      id: 'recap', eyebrow: 'Recap', title: 'Trees are made of air.',
      body: ctx => `<p>${GUESS_TEXT[ctx.state.guess] || 'You did not guess. Most people say the soil.'}</p>
        <p>The soil anchors the tree and supplies its water and a pinch of minerals, but almost none of its mass. Sunlight powers the building, but weighs nothing. The material itself, the carbon and most of the oxygen, was pulled out of thin air, one molecule of CO₂ at a time.</p>`,
      camera: { pos: [20, 9.5, 26], target: [0, 6.5, 0] },
      onEnter(ctx) {
        const { ui, flows } = ctx;
        ctx.showPotScene(false); ctx.setDaylight(1); ctx.tree.setGrowth(1); ctx.setTreeOpacity(1); ctx.piles.gather();
        flows.co2.setIntensity(0.8); flows.o2.setIntensity(0.6); flows.h2o.setIntensity(0.6); flows.minerals.setIntensity(0.6);
        ui.controls(`
          <div class="legend">${legendHtml('dry')}</div>
          <p class="foot">Shares of dry mass. Numbers are rounded; real trees vary by species.</p>
          <button class="btn ghost" type="button" id="restart" style="align-self:flex-start">Start again</button>`);
        ui.q('#restart').addEventListener('click', () => { ctx.state.guess = null; ctx.goTo(0); });
      },
      onExit(ctx) { ctx.flowsOff(); },
    },
  ];

  global.TreeSteps = { steps, heightFor, dryMassFor };
})(typeof globalThis !== 'undefined' ? globalThis : this);
