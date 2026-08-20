/* =============================================================================
 *  ask/chat.js — the tutor drawer a lesson can open
 * =============================================================================
 *  Loaded after the lesson. DOM only: no THREE, no scene, no step logic. It
 *  cannot break a lesson, and its worst failure is a line of text in the panel.
 *
 *      Ask.chat({
 *        rail:    document.getElementById('side'),   // where it slides over
 *        lesson:  'water-lab',
 *        step:    () => cur,                         // read per turn
 *        act:     target => { ... },                 // only for targets at home
 *      });
 *
 *  THE TUTOR DOES NOT DRIVE THE PAGE. It returns a target and the drawer offers
 *  a button. A wrong aim then costs a click instead of yanking the scene away
 *  from what the student was watching, and the button is a pull back toward the
 *  model rather than another reason to keep typing.
 *
 *  `act` is the lesson's half and covers only its own targets. Anything on
 *  another lesson is a link, which needs nothing from the page, so the module
 *  handles it and the lesson never learns that other lessons exist.
 * ========================================================================== */
(function (global) {
  'use strict';

  const ENDPOINT = '/api/ask';
  const MAX_TURNS = 40;

  function chat(opts) {
    const rail = opts.rail;
    const slot = opts.slot || rail;      // where the launcher goes; the panel
    const act  = opts.act || (() => false);   // always covers the whole rail

    /* ---- launcher, in the rail ---- */
    const open = document.createElement('button');
    open.id = 'askopen';
    open.type = 'button';
    open.innerHTML = '<i class="ph-bold ph-chat-teardrop-dots"></i>'
      + '<span>Ask a question<span class="sub"> about what you are seeing</span></span>';
    slot.appendChild(open);

    /* ---- drawer ---- */
    const panel = document.createElement('div');
    panel.id = 'askchat';
    panel.innerHTML = `
      <header>
        <h2>Ask</h2>
        <span class="where"></span>
        <button id="askclose" type="button" aria-label="Close">&times;</button>
      </header>
      <div class="askthread"><p class="hello">Ask about anything on this page. I can point you at
        the part of the model or the control that answers it.</p></div>
      <form>
        <input type="text" maxlength="500" autocomplete="off" placeholder="Ask about this page…"
               aria-label="Ask a question about this lesson">
        <button type="submit">Ask</button>
      </form>`;
    rail.appendChild(panel);

    const thread = panel.querySelector('.askthread');
    const where  = panel.querySelector('.where');
    const form   = panel.querySelector('form');
    const input  = panel.querySelector('input');
    const send   = form.querySelector('button');

    const messages = [];
    const cited    = new Set();
    let busy = false;

    /* ---- open / close ---- */
    // One class, and it is the only thing that decides whether the drawer is
    // there. No `hidden` attribute to be overridden and no transition to be
    // interrupted mid-flight.
    function show() {
      panel.classList.add('on');
      open.classList.remove('waiting');
      where.textContent = opts.stepName ? opts.stepName() : '';
      input.focus();
    }
    function hide() { panel.classList.remove('on'); }

    open.addEventListener('click', show);
    panel.querySelector('#askclose').addEventListener('click', hide);
    // Esc closes the drawer and nothing else. A lesson's own key handling keeps
    // working because this only fires while the drawer is open.
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && panel.classList.contains('on')) { e.stopPropagation(); hide(); }
    }, true);

    /* ---- a turn ---- */
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const q = input.value.trim();
      if (!q || busy) return;
      input.value = '';

      if (messages.length >= MAX_TURNS) {
        messages.splice(0, 4);   // drop the oldest exchange rather than refuse
      }

      busy = true; send.disabled = true;
      messages.push({ role: 'user', content: q });
      say('you', q);
      const pending = say('tutor', 'Thinking…', 'wait');

      try {
        const res = await fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages,
            lesson: opts.lesson,
            step: opts.step ? opts.step() : undefined,
            cited: [...cited],
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'something went wrong');

        messages.push({ role: 'assistant', content: data.answer });
        pending.remove();
        answer(data);
      } catch (err) {
        pending.remove();
        say('tutor', err.message, 'err');
      } finally {
        busy = false; send.disabled = false;
        thread.scrollTop = thread.scrollHeight;
      }
    });

    function say(who, text, cls) {
      const hello = thread.querySelector('.hello');
      if (hello) hello.remove();
      const d = document.createElement('div');
      d.className = 'askturn ' + who;
      d.innerHTML = `<p class="who">${who === 'you' ? 'You' : 'Tutor'}</p>`;
      const p = document.createElement('p');
      p.className = 'say' + (cls ? ' ' + cls : '');
      p.textContent = text;
      d.appendChild(p);
      thread.appendChild(d);
      thread.scrollTop = thread.scrollHeight;
      return d;
    }

    function answer(data) {
      const d = say('tutor', data.answer);

      if (data.point) d.appendChild(pointButton(data.point));

      // Chapters not already shown, and not the one the point button already
      // goes to: "See it in Glycolysis" with "See Glycolysis" underneath says
      // the same thing twice, and the button says it better.
      const pointed = data.point && !data.point.home ? data.point.chapter : null;
      const others = (data.chapters || []).filter(c => !cited.has(c.id) && c.id !== pointed);
      if (others.length) {
        const see = document.createElement('p');
        see.className = 'asksee';
        see.appendChild(document.createTextNode('See '));
        others.forEach((c, i) => {
          if (i) see.appendChild(document.createTextNode(i === others.length - 1 ? ' and ' : ', '));
          if (c.page) {
            const a = document.createElement('a');
            a.href = '/' + c.page; a.textContent = c.chapter;
            see.appendChild(a);
          } else {
            const s = document.createElement('span');
            s.className = 'asksoon'; s.textContent = c.chapter;
            s.title = 'this lesson is not built yet';
            see.appendChild(s);
          }
        });
        d.appendChild(see);
      }
      for (const c of data.chapters || []) cited.add(c.id);
      thread.scrollTop = thread.scrollHeight;
    }

    function pointButton(p) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'askgo' + (p.home ? '' : ' away');
      b.innerHTML = p.home
        ? `<b>Show me</b><small>${esc(p.title || p.what)}</small>`
        : `<b>See it in ${esc(p.lessonTitle)} &rarr;</b><small>${esc(p.title)}</small>`;

      b.addEventListener('click', () => {
        if (!p.home) { location.href = p.href; return; }
        // Close first. The point of a Show me is to look at the model, and the
        // drawer is standing in front of half of it.
        hide();
        if (act(p) === false) say('tutor', 'I cannot show that one yet.', 'err');
      });
      return b;
    }

    const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

    return { show, hide, el: panel };
  }

  global.Ask = Object.assign(global.Ask || {}, { chat });
})(window);
