#!/usr/bin/env node
/* =====================================================================
 *  prep.js — seven collagen depositions down to what the bench draws, plus
 *  the handful of facts its panel prints.
 *
 *  Run:  node proteins/collagen/tools/prep.js   (offline, no dependencies)
 *
 *  UNDER REVIEW. The candidates are the table below and NOT
 *  proteins/proteins.js, because everything in that file is a decision
 *  and none has been made yet — AddingAProtein.md step 4 is a human
 *  clicking through the bench and saying which of these earn a place.
 *  What survives moves into the registry's `variants` and this table
 *  becomes a `require` of it, the way rnase's did.
 *
 *  WHAT A VIEW IS. One JSON per structure, in bake-trace.js's shape —
 *  {order, chains:{first, nums, CA, ss, helices, strands}} — so
 *  kit/proteinbox.js draws it with no page-side parsing at all.
 *
 *  THE TRAP THIS PROTEIN CARRIES, and it is the reason bake-lib grew
 *  `modResidues`: HYDROXYPROLINE IS A HETATM. Collagen is Gly-X-Y with
 *  hydroxyproline in the Y position of most triplets, and a PDB deposits
 *  a modified residue as HETATM even though it is in the middle of the
 *  chain. An ATOM-only trace of 1CAG keeps 19 of 29 residues per chain
 *  and splines the ribbon over the holes; nothing about the picture says
 *  so. Every bake here passes the file's own MODRES set, so the residues
 *  the entry itself declares as modified count as chain.
 *
 *  SECONDARY STRUCTURE IS READ, NEVER DETECTED, and here that reads as a
 *  finding rather than a formality: NO COLLAGEN FILE CARRIES HELIX OR
 *  SHEET RECORDS. The polyproline II helix is not one of the two things
 *  those records describe, so every bake below comes out all coil and
 *  says so in `ssFrom`. The bench colours BY CHAIN for exactly that
 *  reason — with the ss palette the braid is one green rope.
 *
 *  NOT SUPERPOSED. These are seven different molecules — two synthetic
 *  homotrimers, a natural sequence, a whole type I heterotrimer and a
 *  chaperone complex — not six states of one thing, so there is nothing
 *  a fit would mean. Each opens on its own solved long axis instead, laid
 *  across the screen, which for a rod is the one thing about the frame
 *  that is never in doubt. See bake() on why that basis is taken even
 *  where `frameOf` declines to publish one.
 *
 *  SOURCES, for a re-run from scratch. data/src/ is 2.9 MB against the
 *  bakes it writes, and is gitignored:
 *
 *    for id in 1K6F 1BKV 1CAG 1Q7D 1DZI 3HR2 4AU3; do
 *      curl -o proteins/collagen/data/src/$id.pdb \
 *        https://files.rcsb.org/download/$id.pdb
 *    done
 *
 *  EVERY NUMBER THE PANEL PRINTS IS COUNTED HERE, off the file: the
 *  declared length from SEQRES, the ligands from HETATM, the model
 *  count, the chains. A number typed into the page is a claim nothing
 *  checks, and a re-bake falsifies it silently.
 * ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const Bake = require('../../bake-lib.js');
const Fold = require('../../../folding/folding.js');

const HERE = path.join(__dirname, '..');
const SRC = path.join(HERE, 'data', 'src');
const DATA = path.join(HERE, 'data');

/* THE CANDIDATES, and what each is meant to show. `chains` is what gets
   drawn; `strands` names them for the panel and decides the colour, which
   is a claim about which chains are the same molecule and which are not.
   Bake generously — a candidate that turns out to say nothing is what the
   review is for, and it is cheaper to look at one than to argue about it. */
const CANDIDATES = [
  { id: 'ppg10', source: { kind: 'rcsb', id: '1K6F' }, chains: 'A,B,C',
    purpose: 'the triple helix by itself, at 1.3 Å',
    /* Two triple helices in the asymmetric unit, A-C and D-F. One is the
       subject; the second would read as a second molecule in the picture. */
    strands: { A: 'chain 1', B: 'chain 2', C: 'chain 3' } },

  { id: 'natural', source: { kind: 'rcsb', id: '1BKV' }, chains: 'A,B,C',
    purpose: 'a real collagen sequence, with a stretch that has no proline',
    strands: { A: 'chain 1', B: 'chain 2', C: 'chain 3' } },

  { id: 'oi', source: { kind: 'rcsb', id: '1CAG' }, chains: 'A,B,C',
    purpose: 'one glycine replaced by alanine — the osteogenesis imperfecta '
           + 'substitution',
    strands: { A: 'chain 1', B: 'chain 2', C: 'chain 3' } },

  { id: 'integrin', source: { kind: 'rcsb', id: '1Q7D' }, chains: 'A,B,C',
    purpose: 'the GFOGER site, which is where a cell holds on',
    strands: { A: 'chain 1', B: 'chain 2', C: 'chain 3' } },

  { id: 'molecule', source: { kind: 'rcsb', id: '3HR2' }, chains: 'A,B,C',
    purpose: 'one whole type I molecule, 300 nm of it, as it sits in a fibril',
    /* A and C are α1(I), B is α2(I): two copies of one gene product and one
       of another, which is what a heterotrimer means and what the colour
       says here. The three synthetic peptides above are homotrimers and get
       three colours instead, because there the subject is the braid. */
    strands: { A: 'α1(I)', B: 'α2(I)', C: 'α1(I)' } },

  { id: 'grip', source: { kind: 'rcsb', id: '1DZI' }, chains: 'A,B,C,D',
    purpose: 'the same GFOGER peptide with the integrin actually holding it',
    /* THE PAIR WITH 1Q7D IS THE POINT: chains B, C, D here are the same
       21-mer construct 1Q7D deposits on its own, so the two entries are one
       peptide with and without the thing that grips it. The metal ion at the
       contact is deposited as cobalt standing in for the magnesium — it shows
       in the ligands row and it is where the collagen glutamate reaches. */
    helix: 'B,C,D',
    /* THE SITE IS THE MECHANISM, so it is drawn and not just counted in the
       ligands row. The ion is what the two proteins actually share: read its
       coordination off the file's own LINK records, never a distance cutoff —
       a cutoff wide enough for a 2.4 Å metal-oxygen contact also picks up
       every second-shell atom leaning that way. */
    pocket: { metal: 'CO' },
    strands: { A: 'integrin α2 I', B: 'chain 1', C: 'chain 2', D: 'chain 3' } },

  { id: 'chaperone', source: { kind: 'rcsb', id: '4AU3' }, chains: 'A,B,E,F,G',
    purpose: 'Hsp47, the chaperone that holds a finished helix together',
    /* Two Hsp47 (A, B) on one triple helix (E, F, G); the deposition holds a
       second copy of the same assembly on chains C, D and H-J. Counted off
       the CA distances rather than guessed: A and B are the two that touch
       this helix. */
    helix: 'E,F,G',
    strands: { A: 'Hsp47', B: 'Hsp47', E: 'chain 1', F: 'chain 2', G: 'chain 3' } },
];

/* ---- baking one candidate ------------------------------------------
 *
 *  Reading the file is proteins/bake-lib.js. What is left here is what
 *  makes this collagen's baker: the MODRES pass, and the meta block.
 */

function bake(v) {
  const raw = fs.readFileSync(path.join(SRC, v.source.id + '.pdb'), 'utf8');
  const text = v.model ? Bake.modelOne(raw) : raw;
  const only = v.chains ? new Set(v.chains.split(',')) : null;

  /* THE FILE'S OWN MODRES SET, not a list of names this repo keeps. It goes
     to caTrace so hydroxyproline counts as chain, and to ligands so it is
     not reported as thirty things bound to the molecule. */
  const mod = Bake.modResidues(text);

  const chains = Bake.caTrace(text, only, mod);
  if (!chains.size) throw new Error(v.id + ': no CA atoms on those chains');
  const R = Bake.ssRanges(text);

  const T = Bake.assemble(chains, R);

  const out = { source: v.source.id + '.pdb', ssFrom: Bake.ssFrom(R), centre: T.centre,
                order: T.order, chains: T.chains, radius: T.radius };

  /* THE FRAME IS TAKEN WHETHER OR NOT `worth` ASKED FOR IT, and collagen is
     the case that earns the exception. `frameOf` withholds a basis when two
     successive extents are within 15% of each other, which protects a
     globular domain whose axes are noise — but a triple helix is 86 Å by 8
     by 8, and what is ambiguous is only the ROLL about an axis that is not
     ambiguous at all. Left to `deposited`, 1K6F opens down its own length
     and draws as a dot.

     So the long axis is the field's convention here, the way a fibril's
     stacking direction is: a collagen figure is drawn along the helix. The
     first eigenvector IS that axis, and viewBasis has already forced the
     basis right-handed — assembling one by hand is what mirrors a protein
     into its enantiomer where no check can see it. The roll that the
     threshold was unsure about stays unsure, and stays harmless.

     SOLVED ON THE HELIX, NOT ON EVERYTHING DRAWN, which is why `helix` is a
     field a candidate can set. In a complex the biggest thing in the box is
     the partner: 1DZI's own longest axis is the I-domain's, and a frame
     solved over all four chains lays THAT across the screen and stands the
     collagen up at an angle to it. Then the view row would say "helix axis
     across" about a picture where it is not. The CENTRING still covers
     everything drawn — the picture is of the assembly — and only the frame
     is the subject's. */
  const all = [];
  const spine = [];
  const only2 = v.helix ? new Set(v.helix.split(',')) : null;
  for (const id of out.order)
    for (const p of out.chains[id].CA) {
      all.push(p);
      if (!only2 || only2.has(id)) spine.push(p);
    }
  const F = Bake.frameOf(all);
  const V = Fold.viewBasis(spine);

  /* X FROM THE HELIX, THE ROLL FROM EVERYTHING ELSE. Fixing the helix axis
     leaves one degree of freedom — how the structure is rolled about it — and
     for a bare peptide it does not matter. For a complex it decides whether
     the partner is BESIDE the helix or BEHIND it: Hsp47's two copies solved
     to 112 Å of depth and overlapped each other on screen. So the roll is
     chosen to lay the assembly in the screen plane, by taking the widest
     direction of everything drawn once the helix axis is projected out.
     basisFrom assembles it, because a basis put together by hand mirrors the
     protein half the time and nothing downstream can see it. */
  const X = V.R[0];
  const flat = all.map(p => {
    const d = X[0] * p[0] + X[1] * p[1] + X[2] * p[2];
    return [p[0] - d * X[0], p[1] - d * X[1], p[2] - d * X[2]];
  });
  const basis = Fold.basisFrom(Fold.viewBasis(flat).R[0], X);
  out.view = basis.map(ax => ax.map(v => Math.round(v * 100) / 100));
  /* Extents of EVERYTHING DRAWN, measured in the frame that was just chosen,
     so the row and the picture are the same box. frameOf's own extents are in
     its own basis, which for a complex is no longer the one on screen. */
  out.extents = extentsIn(basis, all);
  out.frame = v.helix ? 'helix axis across, solved on the helix'
                      : 'helix axis across';

  if (v.pocket) out.pocket = site(text, v.pocket.metal, T.centre);

  const decl = Bake.declared(text);
  out.meta = {
    entry: v.source.id, chainsDrawn: out.order.length,
    method: Bake.method(text), resolution: Bake.resolution(text),
    title: Bake.line1(text, 'TITLE'), models: Bake.models(raw),
    chainsInFile: Bake.chainCount(text),
    counts: out.order.map(id => ({ chain: id, modelled: out.chains[id].nums.length,
                                   declared: decl[id] === undefined ? null : decl[id] })),
    ss: Bake.disulfides(text, only),
    ligands: Bake.ligands(text, only, mod),
    /* WHAT THE MODRES PASS ACTUALLY BOUGHT, per chain, so the panel can say
       it and a reader can see the trap rather than take it on trust. */
    modified: modCounts(text, only, mod),
  };
  out.read = {
    method: Bake.method(text),
    chainsInFile: Bake.chainCount(text),
    residues: out.meta.counts.reduce((k, c) => k + c.modelled, 0),
    declared: out.meta.counts.every(c => c.declared !== null)
      ? out.meta.counts.reduce((k, c) => k + c.declared, 0) : null,
    ec: Bake.ecNumbers(text)[0] || null,
    baked: `col-${v.id}.json`,
  };
  return out;
}

/* ---- THE METAL SITE, off LINK records ----
 *
 *  A metal ion and everything the FILE says is coordinated to it, in
 *  setPocket's `{atoms:[{el,p}], bonds:[[i,j]]}` shape, centred by the same
 *  vector as the trace — a pocket centred on itself sits at the origin with
 *  the protein somewhere else, and that reads as a bug in the ribbon.
 *
 *  LINK IS THE RIGHT RECORD and a distance cutoff is the wrong instrument. The
 *  depositors state the coordination; measuring it again here would be this
 *  script deciding what counts as a bond, which is a claim about the structure
 *  rather than a reading of it. 1DZI states six: three from the integrin, two
 *  waters, and one from the collagen — and that last one is the whole picture.
 *
 *  The waters are kept. They are two of the six vertices, and dropping them
 *  would draw a four-coordinate metal, which is a different chemistry.
 */
function site(text, metal, centre) {
  const key = l => l.slice(12, 16).trim() + '|' + l.slice(17, 20).trim() + '|' +
                   l[21] + '|' + l.slice(22, 26).trim();
  const coords = new Map(), elem = new Map();
  for (const l of text.split('\n')) {
    if (!l.startsWith('ATOM') && !l.startsWith('HETATM')) continue;
    const k = key(l);
    if (coords.has(k)) continue;                 // first altloc only, as ever
    coords.set(k, Bake.xyz(l));
    elem.set(k, l.slice(76, 78).trim() || l.slice(12, 14).trim());
  }

  /* A LINK names two atoms in fixed columns: 12-26 and 42-56. */
  const side = (l, a) => l.slice(a, a + 4).trim() + '|' + l.slice(a + 5, a + 8).trim() +
                         '|' + l[a + 9] + '|' + l.slice(a + 10, a + 14).trim();
  const atoms = [], bonds = [], seen = new Map();
  let hub = null;
  const add = k => {
    if (seen.has(k)) return seen.get(k);
    const p = coords.get(k);
    if (!p) return -1;
    /* Element title-cased the way the palette keys it: CO the residue is
       cobalt, and 'CO' is not 'Co'. */
    const e = elem.get(k);
    const el = e.length > 1 ? e[0] + e.slice(1).toLowerCase() : e;
    const [atom, res, chain, num] = k.split('|');
    seen.set(k, atoms.length);
    atoms.push({ el, p: p.map((c, i) => Bake.r2(c - centre[i])),
                 /* WHO EACH VERTEX BELONGS TO, so a panel can say that one of
                    the six comes from the other molecule without a human
                    counting it off a figure. Chain rather than a name: which
                    chain is collagen is the candidate table's to say. */
                 of: { atom, res, chain, num: +num } });
    return atoms.length - 1;
  };

  for (const l of text.split('\n')) {
    if (!l.startsWith('LINK')) continue;
    const a = side(l, 12), b = side(l, 42);
    const which = a.split('|')[1] === metal ? [a, b]
                : b.split('|')[1] === metal ? [b, a] : null;
    if (!which) continue;
    if (hub === null) hub = add(which[0]);
    const j = add(which[1]);
    if (hub >= 0 && j >= 0) bonds.push([hub, j]);
  }
  return atoms.length ? { atoms, bonds } : null;
}

/* Half-extents doubled: the size of the drawn structure along each axis of a
   given basis. Bake.frameOf reports its own, but only in the basis it solved,
   and a complex is framed on its helix instead. */
function extentsIn(R, points) {
  return R.map(ax => {
    let lo = Infinity, hi = -Infinity;
    for (const p of points) {
      const v = ax[0] * p[0] + ax[1] * p[1] + ax[2] * p[2];
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    return Math.round((hi - lo) * 100) / 100;
  });
}

/* Modified residues actually drawn, by name — the count an ATOM-only trace
   would have dropped. Counted the same way ligands counts: keyed by chain and
   residue number, because one name appearing 240 times is 30 residues. */
function modCounts(text, only, mod) {
  const seen = new Set();
  for (const line of text.split('\n')) {
    if (!line.startsWith('HETATM')) continue;
    const name = line.slice(17, 20).trim();
    if (!mod.has(name)) continue;
    if (only && !only.has(line[21])) continue;
    seen.add(name + '|' + line[21] + line.slice(22, 27));
  }
  const n = new Map();
  for (const k of seen) n.set(k.split('|')[0], (n.get(k.split('|')[0]) || 0) + 1);
  return [...n].map(([name, k]) => ({ name, n: k }));
}

function main() {
  const index = [];
  for (const v of CANDIDATES) {
    const out = bake(v);
    const file = out.read.baked;
    const { read, ...bakeOut } = out;
    fs.writeFileSync(path.join(DATA, file), JSON.stringify(bakeOut));
    /* THE BENCH'S COPY OF THE CANDIDATE TABLE, written rather than typed
       twice. A page cannot require() this file, and the registry has no
       collagen entry yet to read it from — so the table above is the one
       source and this is its published form. It goes away at registration,
       when the bench reads ProteinLib like every other. */
    index.push({ id: v.id, purpose: v.purpose, source: v.source,
                 chains: v.chains, helix: v.helix || v.chains,
                 strands: v.strands, read });
    const kb = (fs.statSync(path.join(DATA, file)).size / 1024).toFixed(0);
    console.log(`${v.id.padEnd(10)} ${out.order.length} chain(s), ` +
      `${read.residues} residues` +
      (Bake.breaks(out) ? `, ${Bake.breaks(out)} break(s)` : '') +
      `, ss ${out.ssFrom}, ${out.extents.join(' × ')} Å, ` +
      `modified [${out.meta.modified.map(m => m.name + ' ×' + m.n).join(' ')}], ` +
      `ligands [${out.meta.ligands.join(' ')}], view ${out.frame}` +
      (out.pocket ? `, site ${out.pocket.atoms.length} atoms / ` +
                    `${out.pocket.bonds.length} links` : '') + `, ${kb} KB`);
  }
  fs.writeFileSync(path.join(DATA, 'candidates.json'), JSON.stringify(index, null, 1));
  console.log(`candidates.json  ${index.length} under review, nothing registered`);
}

if (require.main === module) main();
module.exports = { bake, CANDIDATES };
