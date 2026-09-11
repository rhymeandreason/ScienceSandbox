/* diagram-2d.js — the flat drawing under a 3D model.
 *
 * A second VIEW of a spec, never a second source of truth. One call picks the
 * projection the molecule's lesson needs and hands back a finished panel:
 *
 *     Diagram2D.draw(el, spec, opts)   -> true if something was drawn
 *
 * TWO RENDERERS, ONE VISUAL LANGUAGE. Sugars go to haworth.js, because their
 * whole lesson is which face an -OH sits on and a skeletal drawing can only
 * mumble that with a wedge. Everything else goes to SmilesDrawer, off the
 * `smiles` string tools/spec2smiles.js generates from the same spec. They share
 * INK and COLORS here so a Haworth ring and a skeleton read as one drawing
 * rather than two libraries.
 *
 * NOT `spec.flat2d`. That field is the RDKit depiction LAYOUT that
 * tools/bake-flat2d.js writes for molecule-viewer.html to slide 3D spheres
 * onto. Nothing here reads it.
 *
 * The page loads SmilesDrawer, not this file — a page that only draws sugars
 * should not pull a CDN library it never calls. Every entry point degrades to
 * `false` when its renderer is absent.
 */
(function (global) {
'use strict';

const SVG_NS = 'http://www.w3.org/2000/svg';

// Element colours for the flat views. Ink on paper, so these are the drawing's
// own palette rather than the --atom-* tokens the 3D spheres take.
const INK = '#2b2b2b';
const COLORS = { C: INK, O: '#b03a2e', N: '#2b6cb0', S: '#b8860b', H: '#6a6257' };
// The highlight disc. Grey, so it spotlights without competing with the
// element colours.
const HL = '#cfc7b6';
/* Haworth knocks a disc of PAPER out behind the ring oxygen, so this has to be
 * the colour actually behind the panel, not a lookalike: read `--paper` off the
 * element and keep the literal only for a caller with no stylesheet. */
const PAPER = '#f4ecdf';
function paperOf(el) {
  try {
    const v = getComputedStyle(el).getPropertyValue('--paper').trim();
    return v || PAPER;
  } catch (e) { return PAPER; }
}
// ONE font for every flat diagram, both renderers. system-ui so a formula's
// digits and an element symbol come from the same face the page's chrome uses,
// and SmilesDrawer measures its label boxes against the font it will draw in.
const FONT = "system-ui,-apple-system,'Segoe UI',sans-serif";

// The box a skeletal panel is fitted into. It is a BOX, not a size: the drawing
// keeps its own aspect inside it, so palmitate's 16-carbon chain gets the width
// it needs and an amino acid does not float in whitespace.
const MAX_W = 430, MAX_H = 140;

/* SmilesDrawer emits a SQUARE viewBox whatever width and height it was asked
 * for, so a long chain arrives letterboxed into a sliver of the panel. Re-fit
 * the viewBox to what was actually drawn, then size the element to that aspect
 * inside the box. Measured rather than assumed, since the extent depends on the
 * molecule and on how the layout engine folded it. */
function fitSvgToContent(svg, maxW, maxH) {
  let bb; try { bb = svg.getBBox(); } catch (e) { return; }
  if (!bb || !bb.width || !bb.height) return;
  const pad = 7, vw = bb.width + pad * 2, vh = bb.height + pad * 2;
  svg.setAttribute('viewBox', `${bb.x - pad} ${bb.y - pad} ${vw} ${vh}`);
  const s = Math.min(maxW / vw, maxH / vh);
  svg.setAttribute('width', Math.round(vw * s));
  svg.setAttribute('height', Math.round(vh * s));
}

/* Vertical mirror of a finished skeletal panel, with the glyphs kept upright.
 * SmilesDrawer chooses its own layout direction, and for palmitoleate it sends
 * the D9 kink DOWN while the hand-built coordinates send it UP — two views of
 * one molecule disagreeing about which way the chain bends is exactly the
 * confusion a contrast page exists to remove. The flat drawing is the view that
 * gives: the 3D coordinates are asserted geometry and are not moved to suit a
 * layout engine.
 *
 * Opt-in per spec (`flatFlipY`), never automatic, because a mirror is a
 * REFLECTION — only safe where there is no chirality to invert. It must never
 * reach an enantiomer pair, whose whole lesson is that the mirror image is a
 * different molecule.
 */
function flipSvgY(svg) {
  const vb = (svg.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
  if (vb.length !== 4 || !vb[3]) return;
  const axis = 2 * vb[1] + vb[3];        // mirror about the viewBox centre line
  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute('transform', `matrix(1,0,0,-1,0,${axis})`);
  while (svg.firstChild) g.appendChild(svg.firstChild);
  svg.appendChild(g);
  /* Un-mirror each label about its own anchor, so 'HO' does not read upside
   * down. Counter-flipping the <text> restores the ordinary frame for its whole
   * subtree, so tspan dy subscripts come back the right way up too. */
  g.querySelectorAll('text').forEach(t => {
    const y = parseFloat(t.getAttribute('y')) || 0;
    t.setAttribute('transform', `matrix(1,0,0,-1,0,${2 * y})`);
  });
}

/* Atom refs resolved the way the 3D view resolves them, then folded so every
 * entry lands on something a flat drawing actually draws: a hydrogen has no
 * glyph of its own there, it is part of its parent's -NH2 / -OH label. */
function highlight(spec, refs) {
  const idx = global.MolLib.resolveAtoms(spec, refs || []);
  const adj = spec.atoms.map(() => []);
  spec.bonds.forEach(([i, j]) => { adj[i].push(j); adj[j].push(i); });
  return new Set(idx.map(i => spec.atoms[i].el === 'H'
    ? adj[i].find(j => spec.atoms[j].el !== 'H') : i));
}

/* Which projection this spec's lesson needs, or null when neither can be drawn.
 * A sugar's is Haworth, which derives everything from the committed ring
 * numbering and so cannot run without `names`; the rest take the skeletal
 * drawing, which needs only the baked `smiles`. */
function mode(spec) {
  if (!spec) return null;
  if (spec.class === 'sugar' && spec.names) return 'haworth';
  return spec.smiles ? 'skeletal' : null;
}

function drawHaworth(el, spec, o) {
  if (typeof global.Haworth === 'undefined') return false;
  try {
    // A disaccharide is two rings wide and needs the room; one ring does not.
    el.innerHTML = global.Haworth.haworth(spec, {
      highlight: o.highlight || new Set(),
      showH: !!o.showH,
      width: o.width || (spec.glycosidic ? 344 : 184),
      height: o.height || 112,
      ink: INK, paper: o.paper || paperOf(el), font: FONT,
      highlightColour: o.accent, highlightFill: HL,
      colors: COLORS,
    });
  } catch (e) { return false; }
  return true;
}

/* The highlight rides in the SMILES string as atom-map class 1, which is what
 * SmilesDrawer keys on — so only whether to show it is decided here, never
 * which atoms. */
function drawSkeletal(el, spec, o) {
  if (!spec.smiles || typeof global.SmilesDrawer === 'undefined') return false;
  const SD = global.SmilesDrawer;
  const maxW = o.maxW || MAX_W, maxH = o.maxH || MAX_H;
  const svg = document.createElementNS(SVG_NS, 'svg');
  el.appendChild(svg);
  const on = !!(o.highlight && o.highlight.size);
  try {
    SD.parse(spec.smiles, tree => {
      new SD.SvgDrawer({
        width: maxW, height: maxH,
        bondThickness: 1.1, terminalCarbons: false, compactDrawing: false,
        fontFamily: FONT,
        themes: { light: Object.assign({}, COLORS,
          { BACKGROUND: '#00000000', BOND: INK }) },
      }).draw(tree, svg, 'light', null, false, on ? [[1, HL]] : []);
      fitSvgToContent(svg, maxW, maxH);
      if (spec.flatFlipY) flipSvgY(svg);
    }, () => { el.innerHTML = ''; });
  } catch (e) { el.innerHTML = ''; return false; }
  return true;
}

/* Draw `spec` into `el`, clearing whatever was there.
 *   highlight  Set of atom indices, from Diagram2D.highlight(); empty for none
 *   showH      draw C-H hydrogens (Haworth only; SMILES carries its own)
 *   accent     stroke colour for the highlight
 *   paper, width, height, maxW, maxH   override the defaults above
 * Returns false for a spec neither projection can draw — ask `mode(spec)`
 * first when a control's visibility depends on it. */
function draw(el, spec, opts) {
  const o = opts || {};
  el.innerHTML = '';
  const m = mode(spec);
  if (!m) return false;
  return m === 'haworth' ? drawHaworth(el, spec, o) : drawSkeletal(el, spec, o);
}

global.Diagram2D = { draw, highlight, mode, INK, COLORS, HL, PAPER, FONT, MAX_W, MAX_H };

})(typeof self !== 'undefined' ? self : this);
