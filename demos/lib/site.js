/* =============================================================================
 *  lib/site.js — the chrome every page shares, in one file
 * =============================================================================
 *  Loaded absolutely, once, by every public page:
 *
 *      <script defer src="/demos/lib/site.js"></script>
 *
 *  Absolute because a featured page sets <base href="/demos/"> and a protein
 *  bench sits three folders down; a relative src resolves differently in each.
 *
 *  It owns what is true of the whole site and nothing about any one page:
 *  analytics, and the right-hand half of the document shell's foot. Anything
 *  site-wide added later belongs here rather than in 30 files.
 *
 *  Only body.kodo gets a foot. A lesson on body.lshell-page is a full-window
 *  scene with no bottom edge to hang one from, and Design.md forbids a second
 *  masthead over it; the privacy notice is reached from the homepage and the
 *  collection pages instead.
 *
 *  A page whose foot is entirely its own writes data-own on it and is skipped.
 */
(function () {
  'use strict';

  // Vercel Web Analytics. Cookieless and no personal data, so no consent
  // banner. The path is served by Vercel's edge, so it 404s under the local
  // dev server and that console line is expected.
  var s = document.createElement('script');
  s.defer = true;
  s.src = '/_vercel/insights/script.js';
  document.head.appendChild(s);

  var SITE = '<span>open source <span class="sep">·</span> CC-BY-NC' +
             ' <span class="sep">·</span> <a href="/privacy">privacy</a></span>';

  function foot() {
    if (!document.body.classList.contains('kodo')) return;

    var f = document.querySelector('.sitefoot');
    if (f && f.hasAttribute('data-own')) return;

    if (!f) {
      f = document.createElement('footer');
      f.className = 'sitefoot';
      (document.querySelector('.page') || document.body).appendChild(f);
    }
    // The page owns the left span, this owns the right. A foot with nothing of
    // its own still needs the left slot, or flex pushes the site line left.
    if (!f.children.length) f.appendChild(document.createElement('span'));
    f.insertAdjacentHTML('beforeend', SITE);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', foot);
  } else foot();
})();
