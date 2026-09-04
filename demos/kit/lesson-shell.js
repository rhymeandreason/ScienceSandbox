/* =============================================================================
 *  kit/lesson-shell.js — the step-through shell a generated app runs in
 * =============================================================================
 *  A full-window scene with a glass panel over it: eyebrow, title, body,
 *  a controls slot the step fills, Back and Next, progress dots in the top
 *  bar, arrow keys. The tree prototype's UI, made the one shell every
 *  user-generated app takes so they all read as one product.
 *
 *      const shell = LessonShell.create({
 *        brand: 'The Mass of a Tree',
 *        hint:  'Drag to orbit · Scroll to zoom',
 *        steps: [{ eyebrow, title, body, nextLabel, camera, onEnter(ctx), onExit(ctx) }, ...],
 *        ctx:   {},                       // handed to every step; the shell adds `ui` and `goTo`
 *        onStep: (step, i) => {},         // after the panel is filled, before onEnter
 *      });
 *      Component.mount(shell.stage, ...)  // the scene goes in shell.stage
 *      shell.goTo(0);
 *
 *  It owns the DOM and the step index and nothing about the scene: the
 *  camera flight a step names in `camera` is the page's to fly, in onStep,
 *  because the shell does not know which component is behind the glass.
 *  `shell.viewOffset` is the function every component's mount takes to
 *  centre its scene in the room the panel leaves. The stage also carries
 *  `keepOut`, the panel's rect, which lib/annotate.js reads on its own so a
 *  callout behind the glass typesets to the free side.
 *
 *  ctx.ui, for steps:
 *      controls(html)  fill the slot · q(sel) / qa(sel) inside it · show(el) /
 *      hide(el) · setNext(label, visible) · range(input, onChange) paints the
 *      track and fires once with the current value · showPanel(component,
 *      {only:['notes','layers','legend']}) appends the component's own chips
 *
 *  Chrome is css/lesson-shell.css; `body.lshell-page` is set here. A step's
 *  `body` may be a function of ctx, for copy that depends on what the
 *  student did earlier.
 * ========================================================================== */
(function (global) {
  'use strict';

  function create(opts = {}) {
    const steps = opts.steps || [];
    const host = opts.host || document.body;
    document.body.classList.add('lshell-page');

    const el = document.createElement('div');
    el.className = 'lshell';
    el.innerHTML = `
      <div class="lshell-stage"></div>
      <header class="lshell-topbar">
        <div class="lshell-brand"></div>
        <nav class="lshell-progress" aria-label="Lesson progress"></nav>
      </header>
      <aside class="lshell-panel">
        <div class="lshell-scroll">
          <p class="eyebrow"></p>
          <h1 class="title"></h1>
          <div class="body"></div>
          <div class="controls"></div>
        </div>
        <nav class="lshell-nav">
          <button class="btn ghost" type="button">Back</button>
          <span class="lshell-count"></span>
          <button class="btn primary" type="button">Next</button>
        </nav>
      </aside>
      <div class="lshell-hint"></div>`;
    host.appendChild(el);
    const $ = sel => el.querySelector(sel);
    const els = {
      stage: $('.lshell-stage'), brand: $('.lshell-brand'), progress: $('.lshell-progress'),
      panel: $('.lshell-panel'), scroll: $('.lshell-scroll'),
      eyebrow: $('.eyebrow'), title: $('.title'), body: $('.body'), controls: $('.controls'),
      back: $('.lshell-nav .ghost'), next: $('.lshell-nav .primary'), count: $('.lshell-count'),
      hint: $('.lshell-hint'),
    };
    els.brand.textContent = opts.brand || '';
    /* On the stage element too, so CardStage finds it without being told —
       and the panel's rect with it, so lib/annotate.js keeps its labels out
       from under the glass without any component knowing there is a panel. */
    els.stage.viewOffset = () => shellApi.viewOffset();
    els.stage.keepOut = () => els.panel.getBoundingClientRect();
    els.hint.textContent = opts.hint || '';
    els.hint.hidden = !opts.hint;

    const ui = {
      controls(html) { els.controls.innerHTML = html; },
      q(sel) { return els.controls.querySelector(sel); },
      qa(sel) { return [...els.controls.querySelectorAll(sel)]; },
      show(e) { if (!e) return; e.classList.remove('is-hidden'); e.classList.add('rise'); },
      hide(e) { if (e) e.classList.add('is-hidden'); },
      setNext(label, visible = true) { els.next.textContent = label; els.next.classList.toggle('is-hidden', !visible); },
      /* The component's own "point at / show / colours" chips, appended to
         the controls slot. kit/card-stage.js draws it; this only places it. */
      showPanel(c, opts) { return global.CardStage.showPanel(els.controls, c, opts); },
      range(input, onChange) {
        const paint = () => input.style.setProperty('--p', `${((input.value - input.min) / (input.max - input.min)) * 100}%`);
        input.addEventListener('input', () => { paint(); onChange(+input.value); });
        paint();
        onChange(+input.value);
      },
    };
    const ctx = Object.assign(opts.ctx || {}, { ui, goTo: i => goTo(i) });

    let current = -1;
    steps.forEach((s, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', `Step ${i + 1}: ${s.title}`);
      b.addEventListener('click', () => goTo(i));
      els.progress.appendChild(b);
    });

    function goTo(i) {
      if (i < 0 || i >= steps.length || i === current) return;
      if (current >= 0 && steps[current].onExit) steps[current].onExit(ctx);
      current = i;
      const step = steps[i];
      els.scroll.classList.remove('swap');
      void els.scroll.offsetWidth;               // restart the entrance animation
      els.scroll.classList.add('swap');
      els.scroll.scrollTop = 0;
      els.eyebrow.textContent = step.eyebrow || '';
      els.title.textContent = step.title || '';
      els.body.innerHTML = typeof step.body === 'function' ? step.body(ctx) : (step.body || '');
      els.controls.innerHTML = '';
      ui.setNext(step.nextLabel || 'Next', i < steps.length - 1);
      els.back.disabled = i === 0;
      els.count.textContent = `${i + 1} / ${steps.length}`;
      [...els.progress.children].forEach((b, k) => {
        b.classList.toggle('is-current', k === i);
        b.classList.toggle('is-done', k < i);
      });
      if (opts.onStep) opts.onStep(step, i, ctx);
      if (step.onEnter) step.onEnter(ctx);
    }
    els.next.addEventListener('click', () => goTo(current + 1));
    els.back.addEventListener('click', () => goTo(current - 1));
    const onKey = e => {
      if (e.target.matches('input, textarea, select')) return;
      if (e.key === 'ArrowRight') { if (!els.next.classList.contains('is-hidden')) goTo(current + 1); }
      if (e.key === 'ArrowLeft') goTo(current - 1);
    };
    window.addEventListener('keydown', onKey);
    els.stage.addEventListener('pointerdown', () => els.hint.classList.add('is-faded'));

    const shellApi = {
      el, stage: els.stage, panel: els.panel, ui, ctx, steps,
      goTo, get current() { return current; },
      panelRect: () => els.panel.getBoundingClientRect(),
      narrow: () => window.innerWidth <= 760,
      /* Hand this to any component's mount as `viewOffset`: half the panel's
         width on a laptop, half its height when it docks to the bottom. */
      viewOffset() {
        const r = els.panel.getBoundingClientRect();
        return window.innerWidth <= 760 ? { x: 0, y: Math.round(r.height / 2) } : { x: -Math.round(r.right / 2), y: 0 };
      },
      theme(name, on) { document.body.classList.toggle(name, !!on); },
      destroy() { window.removeEventListener('keydown', onKey); el.remove(); document.body.classList.remove('lshell-page'); },
    };
    return shellApi;
  }

  global.LessonShell = { create };
})(typeof globalThis !== 'undefined' ? globalThis : this);
