/* haworth.js — Haworth projection of a sugar spec, derived from its geometry.
 *
 * WHY NOT A DEPICTION LIBRARY: a general 2D layout engine draws a flat ring
 * with wedge/hash bonds. That is chemically correct and pedagogically wrong for
 * these pairs — glucose vs galactose IS the face of one –OH, and Haworth is the
 * convention that says it in one glance. Every sugar lesson in contrast-lab.html
 * reduces to a single arrow flipping: C4's –OH for glucose/galactose, C1A's for
 * maltose/cellobiose, C2's whole substituent for ribose/deoxyribose.
 *
 * WHAT IT NEEDS FROM THE SPEC, all of it already there and already checked:
 *   · the ring          — smallest 5/6 cycle, same finder check-molecules.js uses
 *   · ring numbering    — the committed `names` (C1…C5, O5 / O4)
 *   · substituent faces — sign of (substituent - ringAtom) . ringNormal
 * Nothing is hand-placed, so a regenerated spec redraws correctly, and this
 * never goes through SMILES — sidestepping the rooted-SMILES stereo bug that
 * flips ring anomeric centres.
 *
 * Lives beside molecules.js rather than in tools/ because contrast-lab.html
 * loads it at runtime — tools/ is for things that only ever run at a terminal.
 * Same dual wrapper molecules.js uses: `this` is window in the browser and
 * module.exports under CommonJS, so the page and the checker share one file.
 */
(function (global) {
'use strict';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1],
                         a[2] * b[0] - a[0] * b[2],
                         a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = v => { const l = Math.hypot(...v) || 1; return v.map(x => x / l); };

function adjacency(m) {
  const adj = m.atoms.map(() => []);
  m.bonds.forEach(([i, j]) => { adj[i].push(j); adj[j].push(i); });
  return adj;
}

/* Smallest 5- and 6-membered cycles — the same routine check-molecules.js runs
 * for its axial/equatorial and glycosidic checks. */
function findRings(m) {
  const adj = adjacency(m), out = [], seen = new Set();
  for (const [i, j] of m.bonds) {
    const prev = new Map([[i, null]]), q = [i];
    let done = false;
    while (q.length && !done) {
      const u = q.shift();
      for (const v of adj[u]) {
        if ((u === i && v === j) || (u === j && v === i)) continue;
        if (prev.has(v)) continue;
        prev.set(v, u);
        if (v === j) { done = true; break; }
        q.push(v);
      }
    }
    if (!prev.has(j)) continue;
    const path = [];
    for (let c = j; c !== null; c = prev.get(c)) path.push(c);
    if (path.length < 5 || path.length > 6) continue;
    const sig = [...path].sort((a, b) => a - b).join(',');
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push(path);
  }
  return out;
}

/* Which side of the ring each substituent sits on.
 *
 * NOTE (item 5): this anchoring is why a mirrored spec drew a correct diagram
 * for so long. Every Skel-built sugar was the L-enantiomer, and because the
 * anchor FORCES the D convention rather than reading it, these projections came
 * out right anyway — the 2D output is byte-identical before and after the
 * geometry fix. That is the intended behaviour of an anchor, and it is also
 * exactly why the 2D view could never have revealed the bug. Absolute
 * handedness is checked by tools/check-handedness.js, not here.
 *
 * The ring normal's sign is arbitrary — it flips with traversal direction — so
 * it is ANCHORED, not trusted: in a D-sugar the exocyclic carbon on the last
 * ring carbon (C6 of a pyranose, C5 of a furanose) is drawn UP by convention,
 * so the normal is flipped until that holds. Without this the whole projection
 * could come out mirrored while every relative face stayed correct, which is
 * exactly the kind of error that renders plausibly and teaches the wrong sugar.
 */
function faces(m, ring, names) {
  const adj = adjacency(m);
  const P = i => m.atoms[i].pos;
  const centre = [0, 1, 2].map(k => ring.reduce((s, i) => s + P(i)[k], 0) / ring.length);
  let n = [0, 0, 0];
  for (let k = 0; k < ring.length; k++) {
    const c = cross(sub(P(ring[k]), centre), sub(P(ring[(k + 1) % ring.length]), centre));
    n = [n[0] + c[0], n[1] + c[1], n[2] + c[2]];
  }
  n = unit(n);

  const inRing = new Set(ring);
  const side = (from, to) => dot(sub(P(to), P(from)), n);

  // anchor: the exocyclic C on the highest-numbered ring carbon points up
  const ringCs = ring.filter(i => m.atoms[i].el === 'C');
  const last = ringCs[ringCs.length - 1];
  const exo = adj[last].find(j => m.atoms[j].el === 'C' && !inRing.has(j));
  if (exo != null && side(last, exo) < 0) n = n.map(x => -x);

  const out = new Map();
  for (const i of ringCs) {
    for (const j of adj[i]) {
      if (inRing.has(j)) continue;
      out.set(j, { on: i, up: side(i, j) > 0, name: names[j], el: m.atoms[j].el });
    }
  }
  return { faces: out, ring, ringCs };
}

/* ---- geometry of the standard Haworth picture -------------------------
 * A ring drawn edge-on from slightly above: back edge high, front edge low,
 * ring O at the BACK RIGHT and C1 at the RIGHT, which is what puts the anomeric
 * carbon where a reader expects it. Substituents leave straight up or straight
 * down — that verticality IS the convention, and it is why one flipped -OH
 * reads instantly.
 *
 * Vertices are listed in ring order starting at C1, so the first three bonds
 * (C1-C2, C2-C3, C3-C4) are always the near side and always the bold ones.
 */
const PYRANOSE = [                       // C1, C2, C3, C4, C5, O5
  { x: 170, y: 60 }, { x: 132, y: 84 }, { x: 58, y: 84 },
  { x: 20, y: 60 }, { x: 58, y: 36 }, { x: 132, y: 36 },
];
const FURANOSE = [                       // C1, C2, C3, C4, O4
  { x: 152, y: 64 }, { x: 118, y: 92 }, { x: 50, y: 92 },
  { x: 16, y: 64 }, { x: 84, y: 34 },
];
const FRONT_BONDS = 3;                   // the first three are the near side
const RING_STEP = 232;                   // x offset between residues of a disaccharide

function ringLayout(size) { return size === 6 ? PYRANOSE : FURANOSE; }

/* The oxygen of a glycosidic bond: bonded to ring carbons in TWO different
 * rings. It belongs to neither ring's substituent list — drawn as a dangling
 * -OH on both (as the first draft did) it reads as two separate sugars rather
 * than one disaccharide. */
function bridgeOxygen(m, rings) {
  if (rings.length < 2) return null;
  const adj = adjacency(m);
  const ringOf = new Map();
  rings.forEach((r, k) => r.forEach(i => ringOf.set(i, k)));
  for (let j = 0; j < m.atoms.length; j++) {
    if (m.atoms[j].el !== 'O' || ringOf.has(j)) continue;
    const touch = adj[j].filter(i => ringOf.has(i)).map(i => ringOf.get(i));
    if (new Set(touch).size === 2) return { o: j, ends: adj[j].filter(i => ringOf.has(i)) };
  }
  return null;
}

/* Build the SVG for one ring plus its substituents. */
function drawRing(m, info, opts, xOff, skip) {
  const { faces: F, ring, ringCs } = info;
  const pts = ringLayout(ring.length);
  const O = ring.find(i => m.atoms[i].el === 'O');
  const ordered = [...ringCs, O];        // C1 first, ring O last — matches the template
  const pos = new Map(ordered.map((i, k) => [i, { x: pts[k].x + xOff, y: pts[k].y }]));

  const S = [];
  const hi = opts.highlight || new Set();
  const col = el => opts.colors[el] || opts.colors.C;

  // ring bonds — the first three are the near side and carry the perspective
  for (let k = 0; k < ordered.length; k++) {
    const pa = pos.get(ordered[k]), pb = pos.get(ordered[(k + 1) % ordered.length]);
    S.push(`<line x1="${pa.x}" y1="${pa.y}" x2="${pb.x}" y2="${pb.y}" `
      + `stroke="${opts.ink}" stroke-width="${k < FRONT_BONDS ? 3.6 : 1.4}" `
      + `stroke-linecap="round"/>`);
  }
  // ring oxygen label over a knockout so the bonds stop cleanly behind it
  const po = pos.get(O);
  S.push(`<circle cx="${po.x}" cy="${po.y}" r="8.5" fill="${opts.paper}"/>`);
  S.push(`<text x="${po.x}" y="${po.y}" text-anchor="middle" dominant-baseline="central" `
    + `font-size="13.5" fill="${col('O')}">O</text>`);

  for (const [j, f] of F) {
    if (skip && skip.has(j)) continue;                        // the glycosidic O
    if (m.atoms[j].el === 'H' && !opts.showH && !hi.has(j)) continue;
    const p = pos.get(f.on), dy = f.up ? -23 : 23, on = hi.has(j);
    S.push(`<line x1="${p.x}" y1="${p.y}" x2="${p.x}" y2="${p.y + dy}" `
      + `stroke="${on ? opts.highlightColour : opts.ink}" `
      + `stroke-width="${on ? 2.8 : 1.4}" stroke-linecap="round"/>`);
    const label = f.name.startsWith('O') ? 'OH'
                : f.name.startsWith('C') ? 'CH₂OH'
                : m.atoms[j].el;
    const ly = p.y + dy + (f.up ? -7 : 12);
    if (on) S.push(`<ellipse cx="${p.x}" cy="${ly - 4}" rx="${label.length * 4.4 + 6}" ry="10.5" `
      + `fill="${opts.highlightFill}"/>`);
    S.push(`<text x="${p.x}" y="${ly}" text-anchor="middle" font-size="12.5" `
      + `fill="${col(m.atoms[j].el)}">${label}</text>`);
  }
  return { svg: S.join(''), pos };
}

/* The glycosidic bond itself: C1 of one residue, out to the bridging O, across
 * to C4 of the other. The O sits BELOW the join for an alpha linkage and above
 * for a beta one, which is the whole maltose/cellobiose lesson — so its height
 * comes from the same face calculation as every other substituent. */
function drawBridge(m, bridge, infos, positions, opts) {
  const { o, ends } = bridge;
  const hi = opts.highlight || new Set();
  const on = hi.has(o);
  const col = on ? opts.highlightColour : opts.ink;
  const pts = ends.map(e => positions.find(p => p.has(e)).get(e));
  // face of the O relative to the residue that donated its anomeric carbon
  const donor = infos.find(inf => inf.faces.has(o));
  const up = donor ? donor.faces.get(o).up : false;
  const mid = { x: (pts[0].x + pts[1].x) / 2, y: Math.max(pts[0].y, pts[1].y) + (up ? -26 : 26) };
  const S = [];
  if (on) S.push(`<ellipse cx="${mid.x}" cy="${mid.y}" rx="13" ry="10.5" fill="${opts.highlightFill}"/>`);
  for (const p of pts)
    S.push(`<line x1="${p.x}" y1="${p.y}" x2="${mid.x}" y2="${mid.y}" `
      + `stroke="${col}" stroke-width="${on ? 2.8 : 1.4}" stroke-linecap="round"/>`);
  S.push(`<circle cx="${mid.x}" cy="${mid.y}" r="8.5" fill="${on ? opts.highlightFill : opts.paper}"/>`);
  S.push(`<text x="${mid.x}" y="${mid.y}" text-anchor="middle" dominant-baseline="central" `
    + `font-size="13.5" fill="${opts.colors.O}">O</text>`);
  return S.join('');
}

/* Public entry: spec -> SVG string. */
function haworth(m, options) {
  const opts = Object.assign({
    width: 340, height: 150, ink: '#222', paper: '#fff', showH: false,
    highlight: new Set(), highlightColour: '#8a6a3a', highlightFill: '#dcd8d0',
    colors: { C: '#222', O: '#c0392b', N: '#2b6cb0', H: '#666' },
  }, options || {});
  let rings = findRings(m);
  if (!rings.length) throw new Error(`${m.name}: no 5- or 6-membered ring to project`);
  // the residue donating its anomeric carbon to the linkage is drawn on the
  // LEFT, so maltose and cellobiose read left-to-right the way they are named
  if (m.glycosidic) {
    const donor = m.glycosidic.anomeric;
    rings = rings.slice().sort((a, b) => (b.includes(donor) ? 1 : 0) - (a.includes(donor) ? 1 : 0));
  }
  const bridge = bridgeOxygen(m, rings);
  const skip = bridge ? new Set([bridge.o]) : null;
  const infos = rings.map(r => faces(m, r, m.names));
  const drawn = infos.map((inf, k) => drawRing(m, inf, opts, k * RING_STEP, skip));
  let body = drawn.map(d => d.svg).join('');
  if (bridge) body += drawBridge(m, bridge, infos, drawn.map(d => d.pos), opts);

  const w = 190 + (rings.length - 1) * RING_STEP;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-18 -4 ${w + 36} 136" `
    + `width="${opts.width}" height="${opts.height}" `
    + `font-family="'Zilla Slab',Georgia,serif">${body}</svg>`;
}

global.Haworth = { haworth, findRings, faces };
})(this);
