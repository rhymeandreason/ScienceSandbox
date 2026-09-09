/* =============================================================================
 *  build/app-edit.js — the text editor, running inside the app's own sandbox
 * =============================================================================
 *  Loaded on demand by the relay in `apps-client.js` when the builder turns
 *  the mode on, and never otherwise: an app being read costs nothing for a
 *  feature only its editor uses. It runs on the app's opaque origin, so it
 *  can reach the app's DOM and nothing of the builder's.
 *
 *  A TEXT IS EDITABLE IF IT ROUND-TRIPS TO THE SOURCE, and that test is the
 *  whole design. Every word a generated page shows is a JS string literal in
 *  its source — `eyebrow`, `title`, the `body` HTML, a `stat-label` inside a
 *  `ctx.ui.controls` template. Find the node's text in the source exactly
 *  once and the edit is a `{find, replace}` pair, which is the format the
 *  builder already applies. Find it zero times or twice and the node is not
 *  editable, no pencil, no caret: it is offered for SELECTION instead, and
 *  goes to the model as a reference on the next request.
 *
 *  The test refuses the right things without being told to. A readout painted
 *  from data each frame (`netEl.textContent = s.net`) is not in the source, so
 *  it cannot be typed over — which is the rule CLAUDE.md states about numbers
 *  in user-facing text, arrived at from the other end. A callout's label comes
 *  from the component's own library, so it selects rather than edits.
 *
 *  WHAT MAKES A REPLACEMENT SAFE is the context of the match, read from where
 *  it landed rather than guessed. Inside a `<script>` the text sits in a
 *  string literal, so a quote, a backslash or a `${` has to be escaped; all
 *  three quote characters are escaped whatever the literal's own delimiter is,
 *  since `\"` inside a single-quoted string is a legal identity escape and
 *  knowing the delimiter would mean lexing the script. Where the enclosing
 *  literal holds markup — `body`, a `controls` template — the text is going
 *  through innerHTML, so `<`, `>` and `&` become entities; where it does not,
 *  it is going through textContent and a typed `<` must stay a `<`. The
 *  server syntax-checks the spliced page before it stores it, so a case this
 *  gets wrong is a rejected save and not a broken app.
 *
 *  CLICKS STILL DO WHAT THE PAGE DOES. Editing does not take the page over:
 *  a click on outlined text edits or selects it, but text inside a control (a
 *  Next button, a tab) keeps its own click and offers a badge instead, so the
 *  student can walk the steps and edit each one's copy without leaving.
 * ========================================================================== */
(function () {
  'use strict';
  if (window.__ssEdit) { window.__ssEdit.rearm(); return; }

  var src = '';            // the page as stored; what a find must match
  var on = false;
  var pending = [];        // { find, replace, text } committed but not saved
  var spans = [];          // live editable spans, rebuilt whenever the page redraws
  var order = [];          // every located text, in document order, for anchors
  var scripts = [];        // [start, end) of each inline script's content
  var observer = null;
  var redraw = null;

  var post = function (m) { try { parent.postMessage(m, '*'); } catch (e) {} };

  /* ---- source lookup ---------------------------------------------------- */

  /* How a text may be written in the source. Tried in this order; the one
   * that finds it is the one that writes the replacement back. */
  var FORMS = [
    { id: 'raw',  enc: function (t) { return t; } },
    { id: 'html', enc: entity },
    { id: 'js',   enc: jsEsc },
  ];
  function entity(t) { return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function jsEsc(t) { return t.replace(/([\\'"`])/g, '\\$1').replace(/\$\{/g, '\\${').replace(/\r?\n/g, '\\n'); }

  function scanScripts() {
    scripts = [];
    var re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi, m;
    while ((m = re.exec(src))) {
      if (/\ssrc=/i.test(m[1])) continue;
      var start = m.index + m[0].indexOf(m[2], m[1].length);
      scripts.push([start, start + m[2].length]);
    }
  }
  function inScript(i) {
    for (var k = 0; k < scripts.length; k++) if (i >= scripts[k][0] && i < scripts[k][1]) return true;
    return false;
  }

  /* Whether the literal around the match holds markup, which is what decides
   * innerHTML from textContent. The window is the nearest unescaped quote
   * either side: in `title: 'Dynamic Equilibrium'` that is the title alone,
   * and in a body string it is a stretch of the markup, which is the answer
   * either way. Bounded, because an unquoted stretch would otherwise run to
   * the end of the file. */
  function markupAround(i, len) {
    var a = i, b = i + len, lo = Math.max(0, i - 1500), hi = Math.min(src.length, b + 1500);
    while (a > lo && !(/['"`]/.test(src[a - 1]) && src[a - 2] !== '\\')) a--;
    while (b < hi && !(/['"`]/.test(src[b]) && src[b - 1] !== '\\')) b++;
    return /<[a-zA-Z/!]/.test(src.slice(a, b));
  }

  /* A match has to be the WHOLE authored passage, not a run inside one, which
   * is what the boundary either side says: a quote means the string literal is
   * this text and nothing else, a tag bracket means the same for a stretch of
   * markup. Both false positives the bench found were substrings — the shell's
   * own `Back` button matching inside `nextLabel: 'Back to Start'`, and a
   * chart's `20` tick matching inside `Math.round(mM / 20)`. Editing either
   * would have changed something the student never pointed at, and the second
   * would have changed the physics. */
  var BOUND = /['"`<>]/;
  function bounded(i, len) {
    return (i === 0 || BOUND.test(src[i - 1])) && (i + len >= src.length || BOUND.test(src[i + len]));
  }

  /* The text's one place in the source, or WHY there isn't one. The reason is
   * carried rather than discarded because a passage that cannot be typed over
   * is the case a student needs told: the panel says which of these it hit.
   * Uniqueness is counted over the raw source, unbounded matches included,
   * because the server applies the pair with the same exactly-once rule and
   * cannot see this one. */
  function locate(text) {
    for (var k = 0; k < FORMS.length; k++) {
      var find = FORMS[k].enc(text);
      var i = src.indexOf(find);
      if (i < 0) continue;
      var n = src.split(find).length - 1;
      if (n > 1) return { why: 'dupe', n: n };
      if (!bounded(i, find.length)) return { why: 'partial' };
      var script = inScript(i);
      if (FORMS[k].id === 'js' && !script) return { why: 'partial' };
      return { find: find, script: script, markup: markupAround(i, find.length) };
    }
    return { why: 'absent' };
  }

  function encode(text, hit) {
    var s = text;
    if (!hit.script || hit.markup) s = entity(s);
    if (hit.script) s = jsEsc(s);
    return s;
  }

  /* WHAT A PASSAGE IS WORTH WRITING BACK. Text is encoded for its context;
   * `strong` and `em` are kept as tags, and everything else an editable node
   * has picked up — a paste, a browser's own wrapper — is flattened to its
   * words. The whitelist is the filter: nothing reaches the file that this
   * does not name, so `contenteditable` does not have to be trusted. */
  var INLINE = { STRONG: 'strong', B: 'strong', EM: 'em', I: 'em' };
  function serialize(el, hit) {
    var out = '';
    for (var n = el.firstChild; n; n = n.nextSibling) {
      var tag = n.nodeType === 1 ? INLINE[n.tagName] : null;
      if (tag && hit.markup) out += '<' + tag + '>' + encode(n.textContent, hit) + '</' + tag + '>';
      else out += encode(n.textContent == null ? n.nodeValue : n.textContent, hit);
    }
    return out;
  }

  /* ---- a paragraph, in the source ----------------------------------------
   * A role is a class on the <p>, so the pair for one spans the whole element
   * and not just the words inside it. The bounds are read off the SOURCE and
   * not off `outerHTML`: the browser's serialization normalises quoting and
   * attribute order, and a find that has been through it stops matching the
   * file it came from. The text inside is unique, so the region is too. */
  function region(hit) {
    var i = src.indexOf(hit.find);
    if (i < 0) return null;
    /* Back to the paragraph's own opening tag, not to the nearest `<`: a
     * passage that follows a `<strong>` is preceded by `</strong>`, and the
     * first version of this read that as the enclosing tag and gave up. */
    var open = src.lastIndexOf('<p', i);
    if (open < 0 || !/[\s>]/.test(src[open + 2] || '')) return null;
    var shut = src.indexOf('>', open);
    var end = src.indexOf('</p>', i);
    if (shut < 0 || end < 0 || end > i + 4000) return null;
    if (src.lastIndexOf('</p>', i) > open) return null;        // not the same paragraph
    var attrs = src.slice(open + 2, shut);
    var cls = /class\s*=\s*\\?(["'])([^"']*)\\?\1/.exec(attrs);
    return { start: open, end: end + 4, attrs: attrs, cls: cls ? cls[2] : '',
             find: src.slice(open, end + 4) };
  }

  var ROLES = { lead: 1, callout: 1, foot: 1 };

  /* ---- what is on the page ---------------------------------------------- */

  var SKIP = /^(script|style|noscript|title|option)$/i;
  var CONTROL = 'button, a, label, input, select, summary, [role="button"], [role="tab"]';

  function texts() {
    var out = [];
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var p = n.parentElement;
        if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        if (!p || SKIP.test(p.tagName) || p.closest('.ssx-ui')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    var n;
    while ((n = w.nextNode())) out.push(n);
    return out;
  }

  /* The whitespace at the edges belongs to the source, not to the sentence:
   * the student edits the words and the indentation is put back around them. */
  function split(v) {
    var m = /^(\s*)([\s\S]*?)(\s*)$/.exec(v);
    return { lead: m[1], core: m[2], trail: m[3] };
  }

  /* ---- the mode --------------------------------------------------------- */

  function paint() {
    spans = []; order = [];
    var list = texts();
    for (var k = 0; k < list.length; k++) {
      var node = list[k], parts = split(node.nodeValue), hit = locate(node.nodeValue);
      var el = node.parentElement;
      if (!hit.why) {
        /* A pending edit is re-applied here: the page repaints its panel from
         * the source strings on every step change, so an unsaved change would
         * otherwise vanish the moment the student walked to the next step. */
        var held = find(hit.find);
        var span = document.createElement('span');
        span.setAttribute('data-ssx', 'e');
        span.textContent = held ? held.text : parts.core;
        node.parentNode.insertBefore(document.createTextNode(parts.lead), node);
        node.parentNode.insertBefore(span, node);
        node.nodeValue = parts.trail;
        var rec = { span: span, hit: hit, lead: parts.lead, trail: parts.trail, text: span.textContent };
        rec.body = serialize(span, hit);
        span._ssx = rec;
        spans.push(rec);
        order.push(span.textContent);
        restore(span, hit);
      } else if (el) {
        mark(el, hit, order.length ? order[order.length - 1] : '');
      }
    }
    post({ type: 'app-edit-ready', editable: spans.length, pending: pending.length });
  }

  /* A named part is selected whole. `data-note` is the library saying this
   * thing has a name the model can act on, and the label inside it is not
   * separately meaningful — nor separately clickable, since a callout's own
   * leader and label are pointer-events: none. */
  function mark(el, hit, anchor) {
    var host = el.closest('[data-note]') || el;
    if (host.hasAttribute('data-ssx')) return host;
    host.setAttribute('data-ssx', host.closest(CONTROL) ? 'sc' : 's');
    if (anchor != null) host._ssxAnchor = anchor;
    host._ssxWhy = { code: hit.why, n: hit.n || 0, where: where(host) };
    return host;
  }

  /* Whether an element holds words of its own, which is what the walker asks
   * of a text node and what a click has to ask of whatever it landed on. */
  function owns(el) {
    for (var n = el.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 3 && n.nodeValue.trim()) return n;
    }
    return null;
  }

  /* WHICH LAYER DREW IT, as a word the builder turns into a sentence: the copy
   * belongs on the page a student is reading, not in here. `data-note` and the
   * shell's own class names are the library saying whose text this is. */
  function where(el) {
    if (el.closest('[data-note]')) return 'note';
    if (el.closest('.show-panel')) return 'chips';
    if (el.closest('.lshell-nav, .lshell-count, .lshell-progress, .lshell-topbar')) return 'chrome';
    if (el.ownerSVGElement || el.tagName === 'svg') return 'chart';
    return '';
  }

  /* A ROLE OUTLIVES THE PARAGRAPH IT WAS PUT ON. The panel is rebuilt from the
   * page's own strings on every step change, so the element carrying a role is
   * thrown away and a fresh one takes its place; the role is held against the
   * source region instead, which is the one name for it that does not change,
   * and put back on whatever element is now standing in that spot. */
  var regions = {};
  function restore(span, hit) {
    if (!hit.markup) return;
    var p = span.closest('p');
    if (!p || p._ssxRegion) return;
    var reg = region(hit);
    var held = reg && regions[reg.find];
    if (!held) return;
    p._ssxRegion = reg;
    p._ssxRole = held.role; p._ssxGone = held.gone; p._ssxAfter = held.after;
    if (held.role) p.className = held.role;
    if (held.gone) p.style.display = 'none';
    else if (held.after && !p.nextElementSibling) {
      var add = document.createElement('p');
      add.textContent = 'A new line.';
      p.parentNode.insertBefore(add, p.nextSibling);
    }
  }

  function find(f) { for (var i = 0; i < pending.length; i++) if (pending[i].find === f) return pending[i]; return null; }

  function unpaint() {
    document.querySelectorAll('[data-ssx]').forEach(function (el) {
      if (el.getAttribute('data-ssx') !== 'e') { el.removeAttribute('data-ssx'); el._ssxAnchor = null; return; }
      el.replaceWith(document.createTextNode(el.textContent));
    });
    document.body.normalize();
    spans = []; order = [];
  }

  /* One pair per passage, whatever was typed into it. Banked while the caret
   * is still in it as well as when it leaves: the page redraws its panel
   * whenever the student walks a step, and an edit that only existed in the
   * DOM would go with it. */
  function bank(rec, keep) {
    var text = rec.span.textContent, body = serialize(rec.span, rec.hit);
    if (!keep) rec.span.removeAttribute('contenteditable');
    /* A paragraph carrying a role is written back whole, so a change to its
     * words rebuilds that pair rather than adding a second one inside it. */
    var para = blockOf(rec.span);
    if (para) { reblock(para); return; }
    if (body === rec.body) return;
    rec.text = text; rec.body = body;
    var pair = { find: rec.hit.find, replace: rec.lead + body + rec.trail, text: text };
    var had = find(rec.hit.find);
    if (had) { had.replace = pair.replace; had.text = text; }
    else pending.push(pair);
    post({ type: 'app-edit-dirty', count: pending.length });
  }

  /* ---- roles --------------------------------------------------------------
   * Two kinds. `strong` and `em` are a wrapper around the SELECTION and stay
   * inside the passage's own pair, which is why they are offered only where
   * the enclosing literal is markup: a title goes through textContent and a
   * tag in one would show as a tag. The rest are a class on the paragraph, or
   * the paragraph itself going away, and each is one pair spanning the <p>. */

  /* The paragraph this span sits in, if it already has a pending pair. */
  function blockOf(el) {
    var p = el.closest && el.closest('p');
    if (!p || !p._ssxRegion) return null;
    return p;
  }

  /* Rebuild a paragraph's pair from what is on the page now. The find never
   * changes — it is the region as the FILE has it — so re-applying a role or
   * retyping the words updates one pair rather than stacking overlaps. */
  function reblock(p) {
    var reg = p._ssxRegion, hit = { script: reg.script, markup: true };
    var role = p._ssxRole || '';
    var body = '';
    for (var n = p.firstChild; n; n = n.nextSibling) {
      var tag = n.nodeType === 1 ? INLINE[n.tagName] : null;
      if (tag) body += '<' + tag + '>' + encode(n.textContent, hit) + '</' + tag + '>';
      else body += encode(n.textContent == null ? n.nodeValue : n.textContent, hit);
    }
    /* The tag goes into the same string literal the words do, so its own
     * quotes are escaped the way theirs are. `\"` inside a single-quoted
     * literal is an identity escape, so this is right whichever it is. */
    var open = role ? '<p class="' + role + '">' : '<p>';
    if (reg.script) open = jsEsc(open);
    var pair = find(reg.find) || (pending.push({ find: reg.find }), pending[pending.length - 1]);
    pair.replace = p._ssxGone ? '' : open + body + '</p>' + (p._ssxAfter || '');
    regions[reg.find] = { role: role, gone: !!p._ssxGone, after: p._ssxAfter || '' };
    post({ type: 'app-edit-dirty', count: pending.length });
  }

  /* Everything inside this paragraph is now written by its own pair, so any
   * pair for a passage within it is dropped: two edits over one stretch of
   * the file cannot both apply. */
  function claim(p, reg) {
    p._ssxRegion = reg;
    regions[reg.find] = { role: p._ssxRole || '', gone: !!p._ssxGone, after: p._ssxAfter || '' };
    pending = pending.filter(function (e) { return e.find === reg.find || reg.find.indexOf(e.find) < 0; });
  }

  function role(name) {
    var sel = getSelection(), node = sel.anchorNode;
    var span = node && (node.nodeType === 1 ? node : node.parentElement);
    span = span && span.closest('[data-ssx="e"]');
    if (!span) return;
    var rec = span._ssx;
    if (name === 'strong' || name === 'em') {
      if (!rec || !rec.hit.markup || sel.isCollapsed) return;
      var r = sel.getRangeAt(0);
      if (!span.contains(r.commonAncestorContainer)) return;
      var w = document.createElement(name === 'strong' ? 'strong' : 'em');
      try { r.surroundContents(w); } catch (e) { return; }   // a range across a tag boundary
      sel.removeAllRanges();
      bank(rec, true);
      report(span);
      return;
    }
    var p = span.closest('p');
    if (!p) return;
    var reg = p._ssxRegion || region(rec.hit);
    if (!reg) return;
    reg.script = rec.hit.script;
    claim(p, reg);
    if (name === 'delete') { p._ssxGone = true; p.style.display = 'none'; }
    else if (name === 'after') {
      var add = document.createElement('p');
      add.textContent = 'A new line.';
      p.parentNode.insertBefore(add, p.nextSibling);
      p._ssxAfter = '<p>A new line.</p>';
    } else {
      p._ssxRole = ROLES[name] ? name : '';
      p.className = p._ssxRole;
    }
    reblock(p);
    report(span);
  }

  /* What the caret is in, so the builder can offer only the roles that apply
   * to it. Sent on every focus and after every role. */
  function report(span) {
    var rec = span && span._ssx;
    if (!rec) { post({ type: 'app-edit-focus', on: false }); return; }
    var p = span.closest('p');
    post({ type: 'app-edit-focus', on: true, markup: !!rec.hit.markup,
           block: !!(p && (p._ssxRegion || region(rec.hit))),
           role: (p && p._ssxRole) || (p && ROLES[p.className] ? p.className : ''),
           text: (span.textContent || '').slice(0, 60) });
  }

  function edit(span) {
    var rec = span._ssx;
    if (!rec) return;
    /* Not `plaintext-only`: a role puts a <strong> inside, and the serializer
     * is what keeps anything else out, so the caret does not have to. */
    span.setAttribute('contenteditable', 'true');
    span.focus();
    var r = document.createRange(); r.selectNodeContents(span);
    var sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
    report(span);
    span.onblur = function () { bank(rec); report(null); };
    span.oninput = function () { clearTimeout(span._t); span._t = setTimeout(function () { bank(rec, true); }, 400); };
    span.onkeydown = function (e) {
      if (e.key === 'Enter') { e.preventDefault(); span.blur(); }
      if (e.key === 'Escape') { e.preventDefault(); span.textContent = rec.text; span.blur(); }
      e.stopPropagation();
    };
  }

  function select(el) {
    var note = el.closest('[data-note]');
    post({ type: 'app-select', pill: {
      text: (el.textContent || '').trim().slice(0, 120),
      tag: el.tagName.toLowerCase(),
      cls: (el.getAttribute('class') || '').slice(0, 80),
      note: note ? note.getAttribute('data-note') : '',
      anchor: String(el._ssxAnchor || '').slice(0, 160),
      step: (document.querySelector('.lshell-count') || {}).textContent || '',
      why: el._ssxWhy || { code: 'absent', n: 0, where: where(el) },
    } });
    el.setAttribute('data-ssx-hit', '1');
    setTimeout(function () { el.removeAttribute('data-ssx-hit'); }, 600);
  }

  function onClick(e) {
    if (!on) return;
    var b = e.target.closest ? e.target.closest('.ssx-badge') : null;
    if (b && b._ssxFor) {
      e.preventDefault(); e.stopPropagation();
      var t = b._ssxFor;
      t.getAttribute('data-ssx') === 'e' ? edit(t) : select(t);
      return;
    }
    var span = e.target.closest ? e.target.closest('[data-ssx="e"]') : null;
    if (span) {
      if (span.hasAttribute('contenteditable') || span.closest(CONTROL)) return;
      e.preventDefault(); e.stopPropagation();
      edit(span);
      return;
    }
    var pick = e.target.closest ? e.target.closest('[data-ssx="s"]') : null;
    /* A READOUT IS FILLED IN AFTER THE PAINT — the stat that says `--` until
     * the sim's first frame holds no words when the outlines go on, so it is
     * never marked and a repaint would not catch it either, since what
     * changed is a text node and not an element. A click is the cheap moment
     * to ask again, and it costs nothing when nothing new has appeared. */
    if (!pick && e.target.nodeType === 1 && owns(e.target) && !e.target.closest('[data-ssx], .ssx-ui')) {
      var late = locate(owns(e.target).nodeValue);
      /* Only the uneditable case. Text that turns out to round-trip is left
       * for the next repaint to wrap, rather than half-wired for a caret. */
      if (late.why) {
        pick = mark(e.target, late, null);
        if (pick.getAttribute('data-ssx') !== 's') pick = null;
      }
    }
    if (pick && !pick.closest(CONTROL)) { e.preventDefault(); e.stopPropagation(); select(pick); }
  }

  /* ONE BADGE, on whatever is under the pointer, and it is the way in to
   * everything. A plain click is a shortcut that only works where the page
   * does not want the click itself: text in a button, and a callout's label,
   * cannot take one, so an affordance that appeared only sometimes would be
   * the one missing wherever it was needed. */
  var badge = null;
  function onMove(e) {
    if (!on) return;
    var el = e.target.closest ? e.target.closest('[data-ssx]') : null;
    if (!el) { if (badge) badge.style.display = 'none'; return; }
    if (!badge) {
      badge = document.createElement('button');
      badge.className = 'ssx-badge ssx-ui'; badge.type = 'button';
      document.body.appendChild(badge);
    }
    var r = el.getBoundingClientRect();
    badge._ssxFor = el;
    badge.textContent = el.getAttribute('data-ssx') === 'e' ? '\u270e' : '+';
    badge.style.display = 'block';
    badge.style.left = (r.left - 9) + 'px';
    badge.style.top = (r.top - 9) + 'px';
  }

  var CSS = '[data-ssx]{outline:1px dashed rgba(60,110,220,.55);outline-offset:2px;border-radius:2px;cursor:text}'
    + '[data-ssx="s"],[data-ssx="sc"]{outline-style:solid;outline-color:rgba(60,110,220,.28);cursor:cell}'
    + '[data-ssx]:hover{outline-color:rgba(60,110,220,.95);background:rgba(60,110,220,.07)}'
    + '[data-ssx="e"][contenteditable]{outline:2px solid rgba(60,110,220,.95);background:rgba(60,110,220,.09)}'
    + '[data-ssx-hit]{background:rgba(60,110,220,.3)!important;transition:background .4s}'
    + '.ssx-badge{position:fixed;z-index:2147483647;width:18px;height:18px;padding:0;line-height:16px;'
    + 'font-size:11px;border-radius:9px;border:1px solid #fff;background:rgb(60,110,220);color:#fff;cursor:pointer;display:none}';

  function arm(html) {
    src = String(html || '');
    scanScripts();
    if (!document.getElementById('ssx-css')) {
      var s = document.createElement('style'); s.id = 'ssx-css'; s.className = 'ssx-ui'; s.textContent = CSS;
      document.head.appendChild(s);
    }
    on = true;
    paint();
    /* The panel is rebuilt on every step change, so the outlines are too.
     * Debounced, because a running scene mutates its own DOM every frame. */
    /* WHAT COUNTS AS THE PAGE REDRAWING is a span of ours coming off the
     * document, which is what a step change does to the panel. Repainting on
     * any mutation instead takes the caret out mid-sentence, since typing is
     * a mutation and so is a running scene's own DOM, every frame. Nothing is
     * repainted while a caret is in one either way. */
    if (!observer) {
      observer = new MutationObserver(function (records) {
        if (!on || document.activeElement && document.activeElement.hasAttribute('contenteditable')) return;
        var stale = spans.some(function (r) { return !r.span.isConnected; });
        if (!stale) stale = records.some(function (m) {
          return [].some.call(m.addedNodes, function (n) { return n.nodeType === 1 && n.textContent.trim(); });
        });
        if (!stale) return;
        clearTimeout(redraw);
        redraw = setTimeout(function () {
          if (!on || document.activeElement && document.activeElement.hasAttribute('contenteditable')) return;
          /* Deaf while repainting. Painting is itself a childList mutation
           * that adds elements holding text, so an observer left listening
           * reads its own work as another redraw and never stops. */
          observer.disconnect();
          unpaint(); paint();
          observer.takeRecords();
          observe();
        }, 300);
      });
    }
    observe();
  }

  function observe() { observer.observe(document.body, { childList: true, subtree: true, characterData: true }); }

  function disarm() {
    on = false;
    clearTimeout(redraw);
    if (observer) observer.disconnect();
    if (badge) badge.style.display = 'none';
    unpaint();
  }

  addEventListener('message', function (e) {
    var d = e.data;
    if (!d || d.type !== 'app-edit') return;
    if (d.role) role(d.role);
    else if (d.on) arm(d.html);
    else if (d.save) {
      document.activeElement && document.activeElement.blur();
      post({ type: 'app-edit-edits', edits: pending.map(function (p) { return { find: p.find, replace: p.replace }; }) });
    } else if (d.done) { pending = []; regions = {}; disarm(); }
    else disarm();
  });

  document.addEventListener('click', onClick, true);
  document.addEventListener('pointermove', onMove, true);

  window.__ssEdit = { rearm: function () { post({ type: 'app-edit-ready', editable: spans.length, pending: pending.length }); } };
  post({ type: 'app-edit-loaded' });
})();
