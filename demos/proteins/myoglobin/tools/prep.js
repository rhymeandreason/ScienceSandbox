#!/usr/bin/env node
/* =====================================================================
 *  prep.js — seven myoglobin views: the ribbon, and what is in the pocket.
 *
 *  Run:  node proteins/myoglobin/tools/prep.js    (offline, no dependencies)
 *
 *  WHY THIS BAKER IS NOT proteins/rnase/tools/prep.js. RNase A is a fold
 *  and a Ca trace says everything about it. Myoglobin is a POCKET: 153
 *  residues wrapped around one iron atom, and a bench that drew only the
 *  ribbon would draw the box and leave out what is in it. So each view
 *  carries a second object beside the trace — the heme, whatever is bound
 *  to its iron, and the two histidines that make the site — and the page
 *  draws that ball-and-stick in the box's own frame.
 *
 *  THE SEVEN, and each is one question:
 *
 *    1MBN  Kendrew's sperm whale myoglobin. The first protein structure
 *          ever solved, and the reason the rest of this repo is possible.
 *          Its iron carries a hydroxide: met, oxidised, not working.
 *    1BZP  deoxy at 1.15 A. Nothing bound. The empty site.
 *    1A6M  oxy at 1.0 A. O2 on the iron, bent, held by the distal His.
 *    1MBC  CO at 1.5 A. What carbon monoxide poisoning IS, in one file.
 *    1ABS  the same CO, photolysed at 20 K: the bond broken by light and
 *          the molecule stuck in a docking site 4 A away, not yet gone.
 *    1YMB  horse heart. Same job, same fold, a different animal.
 *    2HHB-B  one beta chain of haemoglobin, from the file hemoglobin/
 *          already committed. Same fold, four copies, and a job the
 *          monomer cannot do.
 *
 *  SECONDARY STRUCTURE IS READ off each file's HELIX records. Myoglobin
 *  is all helix and no sheet, which is a claim the file makes and this
 *  script repeats rather than deriving.
 *
 *  SOURCES, for a re-run from scratch. The raw files live in data/src/
 *  and are ~1.2 MB against the ~90 KB baked here; 2HHB is read from
 *  hemoglobin/data/ and not downloaded again.
 *
 *    for id in 1MBN 1BZP 1A6M 1MBC 1ABS 1YMB; do
 *      curl -o proteins/myoglobin/data/src/$id.pdb \
 *        https://files.rcsb.org/download/$id.pdb
 *    done
 *
 *  CONNECTIVITY IS DEPOSITED, NEVER INFERRED, for everything that comes
 *  off a HETATM: every one of these files CONECTs its heme, and a
 *  distance cutoff wide enough for the 2.0 A Fe-N coordination also
 *  catches 1,3 neighbours across the pyrroles and draws the ring with its
 *  diagonals filled in. The two histidines are ATOM records with no
 *  CONECT of their own, so their internal bonds are the one thing here
 *  solved by distance — inside a single residue, where there is nothing
 *  else close enough to be wrong about.
 * ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const FoldLib = require('../../../folding/folding.js');

const HERE = path.join(__dirname, '..');
const SRC = path.join(HERE, 'data', 'src');
const DATA = path.join(HERE, 'data');
const HB = path.join(HERE, '..', '..', 'hemoglobin', 'data', '2HHB.pdb');

/* `pocket` names the two histidines by residue number, because the
   numbering is the animal's and not a constant: sperm whale and horse put
   the proximal His at 93 and the distal at 64, haemoglobin's beta chain
   at 92 and 63. Getting this wrong draws a tryptophan and says histidine,
   which is exactly the kind of claim nothing downstream can check. */
const VIEWS = [
  { id: '1MBN', file: '1MBN.pdb', chains: 'A', pocket: { prox: 93, dist: 64 },
    kind: 'history',
    claim: 'Kendrew’s myoglobin: the first protein structure anyone ever saw.',
    prov: 'Sperm whale, X-ray at 2.0 A. The 1958 model was a 6 A blob that showed only the sausage of the chain; this is the refined coordinate set that came out of the same work. The iron carries a hydroxide — the protein has been oxidised and cannot bind O2 in this state.' },
  { id: '1BZP', file: '1BZP.pdb', chains: 'A', pocket: { prox: 93, dist: 64 },
    kind: 'empty',
    claim: 'Deoxy myoglobin: the site with nothing in it.',
    prov: 'Sperm whale, 1.15 A. The iron sits slightly out of the porphyrin plane, pulled towards the histidine below it. This is the state that is waiting.' },
  { id: '1A6M', file: '1A6M.pdb', chains: 'A', pocket: { prox: 93, dist: 64 },
    kind: 'working',
    claim: 'Oxygen bound: what myoglobin is for.',
    prov: 'Sperm whale, 1.0 A — among the sharpest protein structures there are. The O2 comes in at an angle and is held there by the distal histidine, which is why the site binds oxygen well and carbon monoxide less well than a bare iron would.' },
  { id: '1MBC', file: '1MBC.pdb', chains: 'A', pocket: { prox: 93, dist: 64 },
    kind: 'poison',
    claim: 'Carbon monoxide in the same place: poisoning, as a structure.',
    prov: 'Sperm whale, 1.5 A. CO binds this site far more tightly than O2 and does not let go, so the protein is full and useless. The distal histidine is what keeps the ratio from being far worse than it is.' },
  { id: '1ABS', file: '1ABS.pdb', chains: 'A', pocket: { prox: 93, dist: 64 },
    kind: 'caught',
    claim: 'The same CO, cut loose by light and frozen before it could leave.',
    prov: 'Sperm whale, 1.5 A at 20 kelvin. A laser broke the Fe-CO bond and the crystal was held cold enough that the CO stopped in a pocket beside the iron instead of escaping. A reaction intermediate, held still and measured.' },
  { id: '1YMB', file: '1YMB.pdb', chains: 'A', pocket: { prox: 93, dist: 64 },
    kind: 'species',
    claim: 'Horse heart myoglobin: another animal, the same answer.',
    prov: 'X-ray at 1.9 A. About a fifth of the sequence differs from the whale’s and the fold does not care. The residues that do not change are the ones lining the pocket.' },
  { id: '2HHB-B', file: HB, chains: 'B', pocket: { prox: 92, dist: 63 },
    kind: 'relative',
    claim: 'One beta chain of haemoglobin: the same fold, doing a job myoglobin cannot.',
    prov: 'Human, 1.74 A, read from the file hemoglobin-lab already uses. Myoglobin holds oxygen; haemoglobin passes it on, and the difference is not in this chain — it is in having four of them that talk to each other.' },
];

/* Everything the pocket is made of. HEM is the ring; the rest are the
   things that get bound to its iron across these seven files, and a view
   with none of them bound is the point of that view rather than a gap. */
const LIGANDS = new Set(['HEM', 'OXY', 'CMO', 'OH', 'CO', 'O2']);

/* ---- reading ---------------------------------------------------------- */

function ssRanges(text) {
  const H = [], E = [];
  for (const line of text.split('\n')) {
    if (line.startsWith('HELIX ')) {
      H.push({ chain: line[19], from: parseInt(line.slice(21, 25), 10),
               to: parseInt(line.slice(33, 37), 10) });
    } else if (line.startsWith('SHEET ')) {
      E.push({ chain: line[21], from: parseInt(line.slice(22, 26), 10),
               to: parseInt(line.slice(33, 37), 10) });
    }
  }
  return { H, E };
}

const r2 = v => Math.round(v * 100) / 100;
const xyz = l => [+l.slice(30, 38), +l.slice(38, 46), +l.slice(46, 54)];
const elOf = l => (l.slice(76, 78).trim() || l.slice(12, 14).trim()).toUpperCase();

function declared(text) {
  const out = {};
  for (const line of text.split('\n')) {
    if (!line.startsWith('SEQRES')) continue;
    const c = line[11] === ' ' ? '_' : line[11];
    if (!(c in out)) out[c] = parseInt(line.slice(13, 17), 10);
  }
  return out;
}

/* ---- the pocket ------------------------------------------------------- */

/* The heme, whatever is on its iron, and the two histidines that hold the
   site together — one chain's worth, as a flat atom list plus bonds.
   Returns null for a structure with no heme at all, which is a fact worth
   printing rather than an empty group.

   COORDINATES ARE NOT CENTRED HERE. They are centred with the trace, by
   the same vector, because the page draws both in one frame and a pocket
   centred on itself would sit at the origin with the protein around it
   somewhere else — the failure that reads as a bug in the ribbon. */
function pocket(text, chain, want) {
  const lines = text.split('\n');
  const atoms = [], bySerial = new Map();
  const keep = (line, group) => {
    const alt = line[16];
    if (alt !== ' ' && alt !== 'A') return;
    bySerial.set(+line.slice(6, 11), atoms.length);
    atoms.push({ name: line.slice(12, 16).trim(), el: elOf(line),
                 res: line.slice(17, 20).trim(), group, p: xyz(line) });
  };

  for (const line of lines) {
    if (line.startsWith('HETATM')) {
      if (line[21] !== chain) continue;
      const res = line.slice(17, 20).trim();
      if (!LIGANDS.has(res)) continue;
      keep(line, res === 'HEM' ? 'heme' : 'bound');
    } else if (line.startsWith('ATOM')) {
      if (line[21] !== chain) continue;
      const num = parseInt(line.slice(22, 26), 10);
      if (num !== want.prox && num !== want.dist) continue;
      /* Side chain only, and CB stays as the stub that says which way the
         residue is attached. A backbone drawn here would be four atoms of
         ball-and-stick sitting inside a ribbon that already draws them. */
      const name = line.slice(12, 16).trim();
      if (name === 'N' || name === 'C' || name === 'O') continue;
      keep(line, num === want.prox ? 'proximal' : 'distal');
    }
  }
  if (!atoms.some(a => a.group === 'heme')) return null;

  /* Deposited connectivity first, for every pair whose ends are both kept.
     Unlike the haemoglobin bake this KEEPS the cross-residue ones: the
     Fe-NE2 bond to the proximal histidine and the Fe-O bond to whatever is
     bound are the two most important sticks in the picture. */
  const bonds = [], seen = new Set();
  const add = (i, j) => {
    const lo = Math.min(i, j), hi = Math.max(i, j);
    if (lo === hi || seen.has(lo + ':' + hi)) return;
    seen.add(lo + ':' + hi); bonds.push([lo, hi]);
  };
  for (const line of lines) {
    if (!line.startsWith('CONECT')) continue;
    const a = bySerial.get(+line.slice(6, 11));
    if (a === undefined) continue;
    for (let c = 11; c + 5 <= line.length; c += 5) {
      const f = line.slice(c, c + 5).trim();
      if (!f) continue;
      const b = bySerial.get(+f);
      if (b !== undefined) add(a, b);
    }
  }

  /* The histidines have no CONECT records — they are ATOM lines — so their
     internal bonds come from distance, inside one residue where nothing
     else is near enough to be wrong about. 1.9 A is longer than any C-C or
     C-N in a side chain and shorter than the 2.0 A Fe-N it must not
     invent, which is why the Fe is excluded from this pass entirely. */
  const near = (a, b) => Math.hypot(a.p[0] - b.p[0], a.p[1] - b.p[1], a.p[2] - b.p[2]);
  for (let i = 0; i < atoms.length; i++) {
    for (let j = i + 1; j < atoms.length; j++) {
      const A = atoms[i], B = atoms[j];
      if (A.group !== B.group) continue;
      if (A.group !== 'proximal' && A.group !== 'distal') continue;
      if (near(A, B) < 1.9) add(i, j);
    }
  }
  return { atoms, bonds };
}

/* ---- one view --------------------------------------------------------- */

function bake(v) {
  const text = fs.readFileSync(v.file.includes(path.sep) ? v.file
                                                         : path.join(SRC, v.file), 'utf8');
  const chain = v.chains;
  const R = ssRanges(text);

  const res = [];
  for (const line of text.split('\n')) {
    if (!line.startsWith('ATOM')) continue;
    if (line.slice(12, 16).trim() !== 'CA') continue;
    const alt = line[16];
    if (alt !== ' ' && alt !== 'A') continue;
    if (line[21] !== chain) continue;
    res.push({ num: parseInt(line.slice(22, 26), 10), p: xyz(line) });
  }
  if (!res.length) throw new Error(v.id + ': no CA on chain ' + chain);

  const site = pocket(text, chain, v.pocket);

  /* ONE CENTRE FOR BOTH. The trace decides it — the ribbon is what the box
     frames — and the pocket is moved by the same vector so the iron stays
     where the protein put it. */
  const c = [0, 1, 2].map(k => res.reduce((s, r) => s + r.p[k], 0) / res.length);
  const shift = p => p.map((v2, k) => r2(v2 - c[k]));

  const ss = res.map(r => {
    for (const h of R.H) if (h.chain === chain && r.num >= h.from && r.num <= h.to) return 'H';
    for (const e of R.E) if (e.chain === chain && r.num >= e.from && r.num <= e.to) return 'E';
    return 'C';
  }).join('');

  const out = {
    source: path.basename(v.file), ssFrom: R.H.length || R.E.length ? 'deposited' : 'none',
    centre: c.map(r2), order: [chain], chains: {},
  };
  out.chains[chain] = {
    first: res[0].num, nums: res.map(r => r.num),
    helices: R.H.filter(h => h.chain === chain).length,
    strands: R.E.filter(e => e.chain === chain).length,
    CA: res.map(r => shift(r.p)), ss,
  };
  let radius = 0;
  for (const p of out.chains[chain].CA) radius = Math.max(radius, Math.hypot(...p));
  out.radius = r2(radius);

  if (site) out.pocket = {
    atoms: site.atoms.map(a => ({ name: a.name, el: a.el, res: a.res,
                                  group: a.group, p: shift(a.p) })),
    bonds: site.bonds,
  };

  /* Myoglobin is a globular bundle and its three extents are close enough
     that a solved basis would flip between rebakes — `worth:false`, no view
     written, and the bench opens in the deposited frame until a human turns
     it and pastes one in. Kept as a call rather than an assumption because
     the answer is the file's to give. */
  const V = FoldLib.viewBasis(out.chains[chain].CA);
  if (V.worth) out.view = V.R.map(ax => ax.map(r2));
  out.extents = V.ext.map(r2);
  out.frame = V.worth ? 'computed' : 'deposited';

  const decl = declared(text);
  const bound = site ? [...new Set(site.atoms.filter(a => a.group === 'bound')
                                             .map(a => a.res))] : [];
  out.meta = {
    entry: v.id.split('-')[0], view: v.id, kind: v.kind, claim: v.claim, prov: v.prov,
    chain,
    method: ((text.split('\n').find(l => l.startsWith('EXPDTA')) || '')
      .slice(10).trim() || 'unknown').toLowerCase(),
    counts: [{ chain, modelled: res.length,
               declared: decl[chain] === undefined ? null : decl[chain] }],
    /* Counted, not typed. It comes out 43 across all seven, which is the
       protoporphyrin IX plus its iron and is worth PRINTING rather than
       asserting: 1BZP writes 47 heme records, four of them a second
       position for atoms modelled twice, and the altloc rule is what turns
       that back into 43. A typed 43 would have hidden the question. */
    hemeAtoms: site ? site.atoms.filter(a => a.group === 'heme').length : 0,
    bound: bound.length ? bound : null,
    prox: v.pocket.prox, dist: v.pocket.dist,
  };
  return out;
}

function main() {
  const manifest = {};
  for (const v of VIEWS) {
    const out = bake(v);
    const file = `mb-${v.id}.json`;
    fs.writeFileSync(path.join(DATA, file), JSON.stringify(out));
    manifest[v.id] = Object.assign({ file, frame: out.frame, extents: out.extents },
                                   out.meta);
    const kb = (fs.statSync(path.join(DATA, file)).size / 1024).toFixed(0);
    console.log(`${v.id.padEnd(7)} ${out.meta.counts[0].modelled} residues, ` +
      `${out.chains[v.chains].helices} helices, ` +
      `heme ${out.meta.hemeAtoms} atoms, bound ${out.meta.bound || 'nothing'}, ` +
      `pocket ${out.pocket ? out.pocket.bonds.length + ' bonds' : 'none'}, ` +
      `view ${out.frame}, ${kb} KB`);
  }
  fs.writeFileSync(path.join(DATA, 'mb-views.json'),
                   JSON.stringify(manifest, null, 1) + '\n');
  console.log(`manifest mb-views.json  ${Object.keys(manifest).length} views`);
}

if (require.main === module) main();
module.exports = { pocket, bake };
