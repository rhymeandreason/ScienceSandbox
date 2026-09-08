/* =============================================================================
 *  kit/sandbox-shell.js — one scene, every control at once
 * =============================================================================
 *  The second template a generated app can be built on. A step-through paces a
 *  student through an argument; a sandbox hands them the thing and gets out of
 *  the way. "Let me play with tonicity" is a sandbox, and writing it as a
 *  one-step lesson puts a Next button on a page with nowhere to go and buries
 *  the controls under a paragraph that was written to be read once.
 *
 *  It is kit/lesson-shell.js with `chrome:'none'` and a single step. That is
 *  the whole implementation, and it is deliberate: the panel, ctx, ui,
 *  viewOffset and theme are the shell's, so `ctx.q` means the same thing here
 *  as in a lesson and every component's section in the reference stays true
 *  whichever template a page chose. A template that needed its own ctx would
 *  fork the reference, which costs more than any layout is worth.
 *
 *  WHAT A SANDBOX OWES THE STUDENT, and the reason this is not just a flag:
 *  the copy is one short paragraph that says what they are looking at, and
 *  every control is visible without scrolling. A sandbox with eight sliders is
 *  a control panel nobody reads. Three or four, each one a question.
 * ========================================================================== */
(function (global) {
  'use strict';

  function create(opts = {}) {
    const shell = global.LessonShell.create({
      brand: opts.brand,
      hint: opts.hint,
      host: opts.host,
      ctx: opts.ctx || {},
      chrome: 'none',
      steps: [{
        eyebrow: opts.eyebrow || '',
        title: opts.title || '',
        body: opts.body || '',
        /* The step's onEnter, so a sandbox wires its controls exactly the way
           a lesson step does: fill the slot, then find inside it. */
        onEnter(ctx) {
          if (opts.controls) ctx.controls(opts.controls);
          if (opts.onReady) opts.onReady(ctx);
        },
      }],
    });
    /* NOT started here. `onReady` wires controls to a component the page
       mounts after this call, so the page ends with `shell.goTo(0)` exactly as
       a lesson does: one rule, whichever template it chose. */
    return shell;
  }

  global.Sandbox = { create };
})(typeof globalThis !== 'undefined' ? globalThis : this);
