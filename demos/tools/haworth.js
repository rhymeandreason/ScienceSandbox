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
 */
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
 * A pyranose is drawn as a flattened hexagon seen edge-on: back edge short and
 * high, front edge long and low, ring O at the back right, C1 at the right.
 * Bold front bonds carry the perspective. Substituents leave straight up or
 * straight down — that verticality IS the convention, and it is why one flipped
 * -OH reads instantly.
 */
const PYRANOSE = [                        // C1..C5, O5 — clockwise from the right
  { x: 152, y: 62 }, { x: 112, y: 78 }, { x: 44, y: 78 },
  { x: 14, y: 62 }, { x: 54, y: 44 }, { x: 122, y: 44 },
];
const FURANOSE = [
  { x: 140, y: 66 }, { x: 104, y: 84 }, { x: 46, y: 84 },
  { x: 16, y: 60 }, { x: 78, y: 40 },
];
const FRONT = { pyranose: [[1, 2], [2, 3]], furanose: [[1, 2], [2, 3]] };

function ringLayout(size) { return size === 6 ? PYRANOSE : FURANOSE; }

/* Build the SVG for one ring plus its substituents. */
function drawRing(m, info, names, opts, xOff) {
  const { faces: F, ring, ringCs } = info;
  const kind = ring.length === 6 ? 'pyranose' : 'furanose';
  const pts = ringLayout(ring.length);
  // order the ring so C1 is first and the ring O last, matching the template
  const O = ring.find(i => m.atoms[i].el === 'O');
  const ordered = [...ringCs, O];
  const pos = new Map(ordered.map((i, k) => [i, { x: pts[k].x + xOff, y: pts[k].y }]));

  const S = [];
  const hi = opts.highlight || new Set();
  const col = el => opts.colors[el] || opts.colors.C;
  const HL = opts.highlightColour;

  // ring bonds, front two bold for the edge-on perspective
  for (let k = 0; k < ordered.length; k++) {
    const a = ordered[k], b = ordered[(k + 1) % ordered.length];
    const pa = pos.get(a), pb = pos.get(b);
    const bold = FRONT[kind].some(([p, q]) => (p === k || q === k) && k < ordered.length - 1);
    S.push(`<line x1="${pa.x}" y1="${pa.y}" x2="${pb.x}" y2="${pb.y}" `
      + `stroke="${opts.ink}" stroke-width="${bold ? 3.4 : 1.4}" stroke-linecap="round"/>`);
  }
  // ring oxygen label sits on the vertex, over a knockout so the bonds stop cleanly
  const po = pos.get(O);
  S.push(`<circle cx="${po.x}" cy="${po.y}" r="8" fill="${opts.paper}"/>`);
  S.push(`<text x="${po.x}" y="${po.y}" text-anchor="middle" dominant-baseline="central" `
    + `font-size="13" fill="${col('O')}">O</text>`);

  // substituents: straight up or straight down
  for (const [j, f] of F) {
    if (m.atoms[j].el === 'H' && !opts.showH && !hi.has(j)) continue;
    const p = pos.get(f.on);
    const dy = f.up ? -22 : 22;
    const on = hi.has(j);
    S.push(`<line x1="${p.x}" y1="${p.y}" x2="${p.x}" y2="${p.y + dy}" `
      + `stroke="${on ? HL : opts.ink}" stroke-width="${on ? 2.6 : 1.4}" stroke-linecap="round"/>`);
    const label = f.name.startsWith('O') ? 'OH'
                : f.name.startsWith('C') ? 'CH₂OH'
                : m.atoms[j].el;
    const ly = p.y + dy + (f.up ? -7 : 11);
    if (on) S.push(`<ellipse cx="${p.x}" cy="${ly - 3}" rx="${label.length * 4.6 + 5}" ry="10" `
      + `fill="${opts.highlightFill}"/>`);
    S.push(`<text x="${p.x}" y="${ly}" text-anchor="middle" font-size="12.5" `
      + `fill="${col(m.atoms[j].el)}">${label}</text>`);
  }
  return S.join('');
}

/* Public entry: spec -> SVG string. */
function haworth(m, options) {
  const opts = Object.assign({
    width: 340, height: 150, ink: '#222', paper: '#fff', showH: false,
    highlight: new Set(), highlightColour: '#8a6a3a', highlightFill: '#dcd8d0',
    colors: { C: '#222', O: '#c0392b', N: '#2b6cb0', H: '#666' },
  }, options || {});
  const rings = findRings(m);
  if (!rings.length) throw new Error(`${m.name}: no 5- or 6-membered ring to project`);
  const body = rings
    .map((r, k) => drawRing(m, faces(m, r, m.names), m.names, opts, k * 186))
    .join('');
  const w = 176 + (rings.length - 1) * 186;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-14 8 ${w + 28} 116" `
    + `width="${opts.width}" height="${opts.height}" `
    + `font-family="'Zilla Slab',Georgia,serif">${body}</svg>`;
}

module.exports = { haworth, findRings, faces };
