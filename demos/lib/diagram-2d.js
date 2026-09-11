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

/* ---- Lewis structures -----------------------------------------------------
 * The projection for a molecule too small to have a skeleton. Skeletal notation
 * draws BONDS and infers the atoms at their vertices, so a molecule with one
 * heavy atom draws as nothing at all: methane is a single unlabelled vertex,
 * water a lone O floating beside a formula that already said H₂O. These are
 * also the molecules where a Lewis structure carries the whole lesson — water's
 * two lone pairs and the bend they force is what makes it a solvent.
 *
 * THE LAYOUT IS TOPOLOGICAL, and deliberately not the spec's own coordinates.
 * Haworth projects real geometry because a sugar's lesson IS which face an -OH
 * sits on; a Lewis structure is a bookkeeping diagram for electrons, drawn on
 * the page's own axes since Lewis. Projecting a tetrahedron would draw methane
 * as a squashed Y and claim an angle the drawing does not mean. What IS read
 * from the spec is everything the diagram asserts: which atoms, which bonds,
 * their orders, and the formal charge each atom carries.
 *
 * Only a STAR fits this layout — one central atom, everything else terminal on
 * it. Anything larger has a skeleton and belongs in the skeletal drawing, so
 * `star()` returning null is what keeps the two from competing.
 */

// Valence electrons, for the main-group elements a spec can hold. A lone pair
// count is V - formal charge - bonds, halved, which is the same arithmetic as
// the formal-charge rule read the other way round.
const VALENCE = { H:1, B:3, C:4, N:5, O:6, F:7, Si:4, P:5, S:6, Cl:7, Br:7, I:7 };

const LEWIS_BOND = 46;    // px, centre to centre
const LEWIS_GAP = 13;     // px of clear space around a label
const LEWIS_PAIR_R = 15;  // px from centre to a lone pair
const LEWIS_DOT = 1.9;    // px, one electron

/* The central atom, and its neighbours in spec order, or null when the molecule
 * is not a star. A two-atom molecule has no centre to find and either atom
 * serves, so it is answered directly. */
function star(spec) {
  const n = spec.atoms.length;
  if (n < 2) return null;
  const deg = spec.atoms.map(() => 0);
  spec.bonds.forEach(([i, j]) => { deg[i]++; deg[j]++; });
  if (n === 2) return { c: 0, ring: [1] };
  const c = deg.indexOf(Math.max(...deg));
  if (deg[c] !== n - 1) return null;
  if (deg.some((d, i) => i !== c && d !== 1)) return null;
  return { c, ring: spec.atoms.map((a, i) => i).filter(i => i !== c) };
}

function bondOrders(spec) {
  const t = spec.atoms.map(() => 0);
  spec.bonds.forEach(b => { const o = b[2] || 1; t[b[0]] += o; t[b[1]] += o; });
  return t;
}

/* Lone pairs on one atom. An element the table does not know gets none rather
 * than a guess — a wrong pair count is a chemical claim, a missing one is a
 * visibly incomplete drawing. */
function lonePairs(spec, i, orders) {
  const V = VALENCE[spec.atoms[i].el];
  if (V === undefined) return 0;
  const free = V - (spec.atoms[i].q || 0) - orders[i];
  return free > 0 ? Math.floor(free / 2) : 0;
}

/* THE ONE PLACEMENT RULE, for every atom in the drawing. An atom's electron
 * domains — its bonds and its lone pairs, a double bond counting once — divide
 * the circle evenly, one slot each. That is the count VSEPR itself works from,
 * and dividing a circle evenly is the whole reason a Lewis structure comes out
 * symmetric: it is a property of the construction, not one to be checked
 * afterwards.
 *
 * `anchor` is the direction slot `index` points, which is all that differs
 * between the two callers. A central atom anchors its LONE PAIRS upward, so
 * water comes out bent with its pairs above rather than as a straight H-O-H. A
 * terminal atom has no such freedom: its one bond already points at the centre,
 * so that bond is the anchor and the pairs take the slots after it.
 *
 * Two rules is what drew O₂ lopsided. The central atom divided its circle while
 * terminal atoms fanned their pairs around the continuation of the bond, which
 * bunched both to one side; nothing made the two agree, so they did not.
 */
function domains(n, anchor, index) {
  const step = 2 * Math.PI / n;
  const out = [];
  for (let k = 0; k < n; k++) out.push(anchor + (k - index) * step);
  return out;
}

/* The central atom: pairs first, then bonds, with the pair block centred
 * upward. With no pair to place the first slot is straight up, so methane's
 * four bonds land on the compass points rather than on the diagonals. */
function slots(nBonds, nPairs) {
  // With no pair to anchor, slot 0 itself goes up.
  const a = domains(nBonds + nPairs || 1, Math.PI / 2, nPairs ? (nPairs - 1) / 2 : 0);
  return { pairs: a.slice(0, nPairs), bonds: a.slice(nPairs) };
}

/* A terminal atom: slot 0 is the bond it already has, pointing back at the
 * centre, and its pairs take the rest. An oxygen's two therefore sit 120° off
 * its bond, the same angle three domains take anywhere else. */
function fan(toward, n) {
  return domains(n + 1, toward, 0).slice(1);
}

// Two dots straddling `dir`, drawn perpendicular to it.
function pairDots(x, y, dir, ink) {
  const px = -Math.sin(dir) * 3.4, py = Math.cos(dir) * 3.4;
  const cx = x + Math.cos(dir) * LEWIS_PAIR_R, cy = y + Math.sin(dir) * LEWIS_PAIR_R;
  return `<circle cx="${(cx + px).toFixed(1)}" cy="${(cy + py).toFixed(1)}" r="${LEWIS_DOT}" fill="${ink}"/>`
       + `<circle cx="${(cx - px).toFixed(1)}" cy="${(cy - py).toFixed(1)}" r="${LEWIS_DOT}" fill="${ink}"/>`;
}

/* A bond drawn as `order` parallel lines, both ends pulled back clear of the
 * labels they run between. */
function sticks(ax, ay, bx, by, order, ink) {
  const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len, px = -uy, py = ux;
  const x0 = ax + ux * LEWIS_GAP, y0 = ay + uy * LEWIS_GAP;
  const x1 = bx - ux * LEWIS_GAP, y1 = by - uy * LEWIS_GAP;
  const out = [];
  for (let k = 0; k < order; k++) {
    const off = (k - (order - 1) / 2) * 3.4;
    out.push(`<line x1="${(x0 + px * off).toFixed(1)}" y1="${(y0 + py * off).toFixed(1)}" `
           + `x2="${(x1 + px * off).toFixed(1)}" y2="${(y1 + py * off).toFixed(1)}" `
           + `stroke="${ink}" stroke-width="1.4" stroke-linecap="round"/>`);
  }
  return out.join('');
}

/* Whether a Lewis structure can be drawn HONESTLY. Every atom must have a known
 * valence and an EVEN number of non-bonding electrons — because an odd count
 * means the drawing would have to show an unpaired electron, and in this
 * library that is never a radical, it is a UNITED ATOM. Acetaldehyde's methyl
 * is one carbon sphere standing for CH₃ (MolecularGeometry.md §1.3b); drawn as
 * Lewis it would come out as a carbon wearing one bond and a lone pair, which
 * is a chemical claim the spec never made. It draws as a skeleton instead,
 * where a bare vertex is exactly what the notation means. */
function canLewis(spec) {
  const orders = bondOrders(spec);
  return spec.atoms.every((a, i) => {
    const V = VALENCE[a.el];
    if (V === undefined) return false;
    const free = V - (a.q || 0) - orders[i];
    return free >= 0 && free % 2 === 0;
  });
}

function drawLewis(el, spec, o) {
  const st = star(spec);
  if (!st) return false;
  const orders = bondOrders(spec);
  const ink = INK, colors = COLORS;
  const order = (i, j) => {
    const b = spec.bonds.find(b => (b[0] === i && b[1] === j) || (b[0] === j && b[1] === i));
    return b ? (b[2] || 1) : 1;
  };

  const cPairs = lonePairs(spec, st.c, orders);
  const S = slots(st.ring.length, cPairs);
  const pos = new Map([[st.c, [0, 0]]]);
  st.ring.forEach((i, k) => {
    const a = S.bonds[k];
    pos.set(i, [Math.cos(a) * LEWIS_BOND, Math.sin(a) * LEWIS_BOND]);
  });

  const body = [];
  for (const i of st.ring) {
    const [x, y] = pos.get(i);
    body.push(sticks(0, 0, x, y, order(st.c, i), ink));
  }
  // the central atom's pairs, then each terminal atom's
  for (const a of S.pairs) body.push(pairDots(0, 0, a, ink));
  for (const i of st.ring) {
    const [x, y] = pos.get(i);
    const toward = Math.atan2(-y, -x);          // back down its own bond
    for (const a of fan(toward, lonePairs(spec, i, orders))) body.push(pairDots(x, y, a, ink));
  }
  // labels last, over a knockout disc so a bond does not run through them
  const paper = o.paper || paperOf(el);
  for (const [i, [x, y]] of pos) {
    const a = spec.atoms[i];
    body.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${LEWIS_GAP - 2}" fill="${paper}"/>`);
    body.push(`<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" `
      + `dominant-baseline="central" font-size="15" fill="${colors[a.el] || ink}">${a.el}</text>`);
    if (a.q) body.push(`<text x="${(x + 11).toFixed(1)}" y="${(y - 9).toFixed(1)}" `
      + `text-anchor="middle" dominant-baseline="central" font-size="10.5" fill="${ink}">`
      + `${Math.abs(a.q) > 1 ? Math.abs(a.q) : ''}${a.q > 0 ? '+' : '−'}</text>`);
  }

  // The viewBox is measured off the furthest thing drawn, lone pairs included,
  // so a molecule is never clipped by a box sized for its atoms alone.
  const reach = LEWIS_BOND + LEWIS_PAIR_R + 8;
  const box = o.maxW && o.maxH ? Math.min(o.maxW, o.maxH) : 170;
  el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" `
    + `viewBox="${-reach} ${-reach} ${reach * 2} ${reach * 2}" `
    + `width="${box}" height="${box}" font-family="${FONT}">${body.join('')}</svg>`;
  return true;
}

/* Which projection this spec's lesson needs, or null when none can be drawn.
 * A sugar's is Haworth, which derives everything from the committed ring
 * numbering and so cannot run without `names`; a molecule with no skeleton to
 * draw takes a Lewis structure; the rest take the skeletal drawing, which needs
 * only the baked `smiles`. */
function mode(spec) {
  if (!spec) return null;
  if (spec.class === 'sugar' && spec.names) return 'haworth';
  // One heavy atom means no skeleton at all, and two or three means a bare
  // stick with the electrons left out — CO₂'s lesson is the four lone pairs a
  // skeletal drawing does not draw. A star this small is a Lewis structure.
  const heavy = spec.atoms.filter(a => a.el !== 'H').length;
  if (heavy <= 3 && star(spec) && canLewis(spec)) return 'lewis';
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
  if (m === 'haworth') return drawHaworth(el, spec, o);
  if (m === 'lewis') return drawLewis(el, spec, o);
  return drawSkeletal(el, spec, o);
}

global.Diagram2D = { draw, highlight, mode, lonePairs, INK, COLORS, HL, PAPER, FONT, MAX_W, MAX_H };

})(typeof self !== 'undefined' ? self : this);
