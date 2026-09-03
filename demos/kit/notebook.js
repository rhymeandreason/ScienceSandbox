/* =============================================================================
 *  kit/notebook.js — a component's named parts, and the notes it carries
 * =============================================================================
 *  A student asks "what are the two pumps?" and the honest answer is two
 *  callouts on the two proteins, not a paragraph in the panel. For that a
 *  page needs two things a raw scene does not give it: NAMES for the parts
 *  ("channel.K", "pump", "outside"), and something to say about each in the
 *  library's own voice. This is where a component keeps both.
 *
 *      const nb = Notebook.create({
 *        box,                                   // the kit/card-stage.js box
 *        anchors: { pump: () => point, ... },   // name → world point, or a function of none returning one
 *        library: { pump: { text:'a carrier, not a pore', card:'Two sentences.', offset:[-46,-30] } },
 *      });
 *      nb.note('pump');                         // the library's note, on the thing
 *      nb.note('pump', { text:'…', card:'…' }); // the page's own words, same anchor
 *      nb.note('outside', { text:'seawater' }); // a label with no card
 *      nb.notes(['channel.K', 'pump']);         // exactly these; [] or false clears
 *      nb.clear();  nb.list();                  // names, with the library text
 *      nb.step();                               // the mount calls this in afterFrame
 *
 *  It is lib/annotate.js under a name table. annotate.js owns how a callout
 *  looks and tracks; the component owns what its parts are called and what
 *  they mean; the page decides which to show. Anchors are FUNCTIONS by
 *  annotate.js's rule: a note on "the first Na⁺" rides the ion.
 *
 *  Load lib/annotate.js and css/annotate.css before a component that uses
 *  this. A page that never calls note() pays nothing: the layer is made on
 *  the first call.
 * ========================================================================== */
(function (global) {
  'use strict';

  function create({ box, anchors = {}, library = {} }) {
    let layer = null;
    const open = new Map();                  // name → annotate note
    const _p = new THREE.Vector3();
    function ensure() {
      if (layer) return layer;
      if (!global.Annot) throw new Error('notebook.js: load lib/annotate.js first');
      const host = box.canvas.parentElement;
      if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
      layer = global.Annot.create(THREE, host, box.camera, { mode: 'on' });
      return layer;
    }
    const anchorOf = name => {
      const a = anchors[name];
      if (!a) return null;
      /* A part that is not on stage right now (no pump in this layout, no
         Na⁺ yet) answers null; the note waits off screen instead of throwing
         inside annotate's step. */
      const f = typeof a === 'function' ? a : () => _p.copy(a);
      return () => f() || _p.set(0, 1e6, 0);
    };
    function note(name, over = {}) {
      const at = anchorOf(name);
      if (!at) { console.warn('notebook.js: no anchor named ' + name + '; have ' + Object.keys(anchors).join(', ')); return null; }
      const lib = library[name] || {};
      const spec = Object.assign({ text: name, offset: [34, -26] }, lib, over);
      if (open.has(name)) open.get(name).remove();
      const n = ensure().add({ text: spec.text, card: spec.card, offset: spec.offset, tone: spec.tone, at: () => at() });
      open.set(name, n);
      if (!box.running) box.draw();
      return n;
    }
    function unnote(name) { const n = open.get(name); if (n) { n.remove(); open.delete(name); } }
    function clear() { if (layer) layer.clear(); open.clear(); }
    function notes(names) {
      clear();
      if (names) for (const n of names) note(n);
    }
    const list = () => Object.keys(anchors).map(k => Object.assign({ name: k }, library[k] || {}));
    function step() { if (layer) layer.step(); }
    return { note, unnote, notes, clear, list, step, get layer() { return layer; } };
  }

  global.Notebook = { create };
})(typeof globalThis !== 'undefined' ? globalThis : this);
