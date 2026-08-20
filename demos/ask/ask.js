/* =============================================================================
 *  ask/ask.js — the science question box
 * =============================================================================
 *  DOM only. No THREE, no scene, no lesson state. A lesson mounts it and it can
 *  fail without taking the stage down with it: every error path ends in a line
 *  of text in the box.
 *
 *      Ask.mount(document.querySelector('#ask'));
 *
 *  The box knows nothing about the chapters. `/api/ask` returns each citation
 *  already resolved to a title and a page, so the catalog exists once, on the
 *  server, and a renamed lesson cannot leave a stale name rendered here.
 * ========================================================================== */
(function (global) {
  'use strict';

  const MAX_CHARS = 500;   // matches api/_tutor.js; the counter is the only reason the page needs it

  function mount(root, opts) {
    const o = opts || {};
    const endpoint = o.endpoint || '/api/ask';

    root.classList.add('ask');
    root.innerHTML = `
      <form class="ask-form">
        <input class="ask-input" type="text" maxlength="${MAX_CHARS}" autocomplete="off"
               placeholder="Ask a biology question…" aria-label="Ask a biology question">
        <button class="ask-go" type="submit">Ask</button>
      </form>
      <div class="ask-out" aria-live="polite"></div>`;

    const form  = root.querySelector('.ask-form');
    const input = root.querySelector('.ask-input');
    const go    = root.querySelector('.ask-go');
    const out   = root.querySelector('.ask-out');

    let busy = false;

    form.addEventListener('submit', async ev => {
      ev.preventDefault();
      const question = input.value.trim();
      if (!question || busy) return;

      busy = true; go.disabled = true;
      out.className = 'ask-out ask-waiting';
      out.textContent = 'Thinking…';

      try {
        // `provider` is only honoured by a server that opted into it; a lesson
        // never sets it, and the bench does.
        const body = { question };
        if (o.provider) body.provider = o.provider();

        const res  = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'something went wrong');
        render(out, data);
        if (o.onAnswer) o.onAnswer(question, data);
      } catch (err) {
        out.className = 'ask-out ask-error';
        out.textContent = err.message;
      } finally {
        busy = false; go.disabled = false;
      }
    });

    return { focus: () => input.focus(), el: root };
  }

  function render(out, data) {
    out.className = 'ask-out';
    out.textContent = '';

    const p = document.createElement('p');
    p.className = 'ask-answer';
    p.textContent = data.answer;
    out.appendChild(p);

    if (!data.chapters || !data.chapters.length) return;

    // "See" plus the chapters, built from what came back. A chapter with no page
    // yet is named and not linked, because a link that 404s teaches the student
    // that the box is broken.
    const see = document.createElement('p');
    see.className = 'ask-see';
    see.appendChild(document.createTextNode('See '));
    data.chapters.forEach((c, i) => {
      if (i) see.appendChild(document.createTextNode(i === data.chapters.length - 1 ? ' and ' : ', '));
      if (c.page) {
        const a = document.createElement('a');
        a.href = '/' + c.page;
        a.textContent = c.chapter;
        see.appendChild(a);
      } else {
        const s = document.createElement('span');
        s.className = 'ask-soon';
        s.textContent = c.chapter;
        s.title = 'this lesson is not built yet';
        see.appendChild(s);
      }
    });
    out.appendChild(see);
  }

  global.Ask = { mount, MAX_CHARS };
})(window);
