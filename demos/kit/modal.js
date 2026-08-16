/* =============================================================================
 *  kit/modal.js — the card that covers the lesson
 * =============================================================================
 *  Every lesson grows side doors: the thing behind the ★, the whole list, the
 *  second simulation, the what-happens-next. Each is a dialog over the stage,
 *  and glycolysis-lab wrote the same eight lines four times to get one. They
 *  are eight lines nobody reads twice, which is exactly how three of the four
 *  copies came to be subtly wrong.
 *
 *  What the copies got wrong, and this owns:
 *
 *   · FOCUS COMES BACK. Every copy moved focus into the card and none returned
 *     it, so closing the ten-steps list dropped a keyboard user at the top of
 *     the document — the rail they were reading is now twelve tabs away. The
 *     opener is remembered on show and refocused on hide.
 *   · `aria-modal` IS A PROMISE. The markup already claimed the dialog traps
 *     focus; nothing did, so Tab walked out of the card and into the lesson
 *     underneath it, which is still there and still clickable. Tab and
 *     Shift-Tab wrap inside the card.
 *   · ONLY THE TOP CARD CLOSES. Four independent Esc listeners each swallowed
 *     the key on capture, so which one won was load order. They share a stack:
 *     Esc closes the topmost, and only that one.
 *   · A PAGE SHORTCUT IS NOT A DIALOG SHORTCUT. Only Esc was swallowed, so on
 *     glycolysis the arrow keys ran the pathway UNDER the open card — you came
 *     back to a step you never watched. `Modal.anyOpen()` is what a page's
 *     keydown guards on; the page decides, since only it knows which of its
 *     shortcuts are stage controls.
 *
 *  The page owns everything about CONTENT: what the card holds, when to build
 *  it, what closing costs. This owns opening, closing, focus and the stack.
 *
 *  MARKUP IS THE PAGE'S, and this reads it rather than generating it — a
 *  dialog's structure is where its accessible name and its layout live, and a
 *  module writing that is a module the page has to fight to style:
 *
 *    <div id="pfkmodal" class="modal" hidden>
 *      <div class="mback"></div>
 *      <div class="mcard" role="dialog" aria-modal="true" aria-labelledby="…">
 *        <button class="mclose" aria-label="Close">&times;</button>
 *        …
 *      </div>
 *    </div>
 *
 *  `.mback` and `.mclose` are optional; a card with neither is closed by Esc
 *  alone. Visibility is the `hidden` attribute, so `.modal[hidden]{display:none}`
 *  is the page's one required rule.
 *
 *  No THREE, no scene. Load anywhere. Exposes window.Modal.
 *
 *  Usage:
 *    const Pfk = Modal.create({el:'pfkmodal'});
 *    Pfk.show();
 *
 *    // built fresh per open — `show(arg)` passes its argument through
 *    const Mass = Modal.create({el:'massmodal',
 *      onShow:st=>{ sim=MassAction.create({host:box, scenarios:scen(st)}); sim.start(); },
 *      onHide:()=>{ if(sim) sim.stop(); }});
 *    Mass.show(currentStep);
 * ========================================================================== */
(function(global){
  'use strict';

  // Open cards, oldest first. Shared by every instance: "topmost" is only
  // meaningful across them, which is why one Esc listener serves all.
  const stack=[];

  // What Tab may land on inside a card. Deliberately not a live query cached at
  // create() — a card whose body is rebuilt per open (the ten-steps list) would
  // hold a stale list of nodes that are no longer in the document.
  const TABBABLE='a[href],button:not([disabled]),input:not([disabled]),'
                +'select:not([disabled]),textarea:not([disabled]),'
                +'[tabindex]:not([tabindex="-1"])';
  const tabbable=card=>Array.from(card.querySelectorAll(TABBABLE))
    // offsetParent is null for anything display:none — a hidden tab stop is one
    // the eye cannot follow, and the trap must not park focus there.
    .filter(n=>n.offsetParent!==null);

  // ONE LISTENER, ON CAPTURE, FOR ALL CARDS. Capture so the page's own keydown
  // does not see the key first; stopPropagation so it does not see it at all.
  addEventListener('keydown',e=>{
    if(!stack.length) return;
    const top=stack[stack.length-1];
    if(e.key==='Escape'){ e.stopPropagation(); top.hide(); return; }
    if(e.key!=='Tab') return;
    const items=tabbable(top.card);
    if(!items.length){ e.preventDefault(); return; }
    const first=items[0], last=items[items.length-1];
    // Wrap at the ends, and pull focus back in if it has escaped the card
    // (browser chrome, or a click on the page underneath).
    const here=document.activeElement;
    if(!top.card.contains(here)){ e.preventDefault(); (e.shiftKey?last:first).focus(); }
    else if(e.shiftKey && here===first){ e.preventDefault(); last.focus(); }
    else if(!e.shiftKey && here===last){ e.preventDefault(); first.focus(); }
  },true);

  function create(opts){
    const el = typeof opts.el==='string' ? document.getElementById(opts.el) : opts.el;
    if(!el) throw new Error('Modal.create: no element');
    const card = el.querySelector('.'+(opts.cardClass||'mcard')) || el;
    const onShow = opts.onShow || null;
    const onHide = opts.onHide || null;

    let open=false;
    // Who to give focus back to. Read at show, not at wire-up: the same card is
    // opened from the rail, from a note and from inside another card.
    let opener=null;

    const api={
      card,
      isOpen:()=>open,

      // `arg` is the page's, passed straight to onShow — the step a demo should
      // wear, the row a list should scroll to. Never inspected here.
      show(arg){
        if(open) return api;
        opener = document.activeElement;
        // BEFORE THE CARD IS SHOWN: a body built on open must be in place
        // before focus moves into it, or the first tab stop is one that is
        // about to be replaced.
        if(onShow) onShow(arg);
        el.hidden=false;
        open=true;
        stack.push(api);
        // The close button if there is one, else the card itself — which needs
        // a tabindex to receive focus, so give it one rather than leaving focus
        // outside a dialog claiming aria-modal.
        const close=el.querySelector('.'+(opts.closeClass||'mclose'));
        if(close) close.focus();
        else { if(!card.hasAttribute('tabindex')) card.setAttribute('tabindex','-1');
               card.focus(); }
        return api;
      },

      hide(){
        if(!open) return api;
        open=false;
        const i=stack.indexOf(api); if(i>=0) stack.splice(i,1);
        el.hidden=true;
        if(onHide) onHide();
        // Only if the opener is still in the document — a card opened from a
        // row that its own onShow then rebuilt has nowhere to go back to, and
        // focusing a detached node silently focuses <body>.
        if(opener && opener.isConnected && opener.focus) opener.focus();
        opener=null;
        return api;
      },
    };

    const back=el.querySelector('.'+(opts.backClass||'mback'));
    const close=el.querySelector('.'+(opts.closeClass||'mclose'));
    if(back) back.onclick=api.hide;
    if(close) close.onclick=api.hide;

    return api;
  }

  global.Modal={create, anyOpen:()=>stack.length>0};
})(window);
