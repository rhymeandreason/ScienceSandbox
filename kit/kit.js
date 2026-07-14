/* =========================================================
   ScienceSandbox — kit.js
   Tiny shared helpers. Load as a normal (blocking) script in
   <head>, before an app's own inline script, so these globals
   exist when the app runs:
     <script src=".../kit/kit.js"></script>
   ========================================================= */

/* querySelector shorthands */
function $(sel, root = document) { return root.querySelector(sel); }
function $$(sel, root = document) { return [...root.querySelectorAll(sel)]; }

/* create an element: el('div', 'my-class', '<b>hi</b>') */
function el(tag, cls, html) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
}

/* transient message at the bottom of the screen; creates #toast if missing */
function toast(msg, ms = 1900) {
  let t = document.getElementById('toast');
  if (!t) { t = el('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), ms);
}

/* re-trigger a CSS animation class on an element (force reflow) */
function replay(node, cls) {
  node.classList.remove(cls);
  void node.offsetWidth;
  node.classList.add(cls);
}

/* a little label that floats up and fades out from (x, y) in the viewport */
function floatUp(x, y, html, cls = '') {
  const f = el('div', 'kit-floater ' + cls, html);
  Object.assign(f.style, {
    position: 'fixed', left: x + 'px', top: y + 'px',
    pointerEvents: 'none', zIndex: 60, fontWeight: 700,
    animation: 'kit-float 1s ease forwards',
  });
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 1000);
}
