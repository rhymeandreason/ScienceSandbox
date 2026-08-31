/* embed.js — the lesson inside someone else's frame.
 *
 * A host that opens a lesson has already said what it is: the node graph puts
 * it in a modal with the lesson's name across the top, so the page's own title
 * would be the second one on screen. This adds `bare` to <html> when the page
 * is framed, and main.css hides anything the PAGE has marked `.chrome-title`.
 *
 * The page owns what bare means. This file only decides WHEN — the marking is
 * the lesson's, because only it knows which element is its name and which is a
 * control that has to survive (water-lab's #brand holds the step tabs too).
 *
 * Load it in the gap between </head> and <body>: the class has to be on the
 * element before the first paint, or a framed lesson flashes its own title on
 * the way in.
 *
 * `?chrome=bare` still forces it, for a host that is not an iframe and for
 * opening the bare view directly to look at it.
 */
(function () {
  var framed;
  // Cross-origin makes the comparison itself throw in some engines; a page that
  // cannot see its parent is framed by definition, so the catch is the answer.
  try { framed = window.self !== window.top; } catch (e) { framed = true; }
  if (framed || new URLSearchParams(location.search).get('chrome') === 'bare')
    document.documentElement.classList.add('bare');
})();
