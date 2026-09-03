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
 *  EVERY VIEW IS SUPERPOSED ON 1BZP, and it has to be. Seven files are
 *  seven crystals, so seven arbitrary orientations: flipping between them
 *  in one camera made the whole molecule jump, and a reader comparing an
 *  empty site with an occupied one cannot tell a real change from the
 *  crystallographer's choice of origin. The fit is Kabsch on the HEME,
 *  matched by atom name — not on the Ca trace, because the trace cannot
 *  match haemoglobin's beta chain to a whale's myoglobin (different
 *  numbering, different length) and because the pocket is what this bench
 *  is about: aligning on the ring puts the iron in the same place in every
 *  view, so what moves on screen is what actually moved.
 *
 *  The Ca RMSD against the reference is measured too and printed in the
 *  panel, but only where the numbering is comparable — the whale and horse
 *  files share it, haemoglobin does not, and a number computed across that
 *  gap would be a fabricated comparison rather than a poor one.
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
const Bake = require('../../bake-lib.js');
const { kabsch, mul } = Bake;

const HERE = path.join(__dirname, '..');
const SRC = path.join(HERE, 'data', 'src');
const DATA = path.join(HERE, 'data');

/* THE VIEW TABLE IS proteins/proteins.js, with every other protein's. What
   this file still owns is what a myoglobin bake IS: the pocket, the
   superposition, and the two numbers only those can give.

   The histidines come from the registry per variant, because the numbering is
   the animal's and not a constant — whale and horse put the proximal at 93 and
   the distal at 64, haemoglobin's beta chain at 92 and 63. Getting it wrong
   draws a tryptophan and calls it a histidine.

   Not 1BVC for an apo view, if one is ever wanted: it is apomyoglobin with
   biliverdin sitting in the pocket, which is not an empty pocket. */
const REG = require('../../proteins.js');
const IO = require('../../tools/registry-io.js');
const ME = REG.byKey('myoglobin');
const VIEWS = ME.variants;
const REF = ME.fit.on;

/* Everything the pocket is made of. HEM is the ring; the rest are the
   things that get bound to its iron across these seven files, and a view
   with none of them bound is the point of that view rather than a gap. */
const LIGANDS = new Set(['HEM', 'OXY', 'CMO', 'OH', 'CO', 'O2']);

/* ---- reading ----------------------------------------------------------

   The deposition is read by proteins/bake-lib.js — the altloc rule, the ss
   ranges, SEQRES, the centring and the frame. Only `xyz` is borrowed
   directly, because the pocket reads HETATM lines the trace never sees. */

const r2 = Bake.r2, xyz = Bake.xyz;
const elOf = l => (l.slice(76, 78).trim() || l.slice(12, 14).trim()).toUpperCase();

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

/* THE REFERENCE FRAME is the registry's `fit.on` — deoxy, because it is the
   state every other view is a change FROM, and because choosing an occupied
   one would put that file's ligand at the origin of the comparison it is
   supposed to be one side of. The registry also carries the hand-picked
   `view.basis`, which covers all seven precisely because they are fitted into
   one frame first. */

/* Matched pairs, by name, between two atom lists. Names are unique inside a
   heme, which is what makes this a match and not a guess; anything present
   in one file and not the other simply drops out, and the count is printed
   so a fit made on too few atoms is visible rather than silent. */
function matchByName(a, b) {
  const idx = new Map(b.map(x => [x.name, x.p]));
  const P = [], Q = [];
  for (const x of a) {
    const q = idx.get(x.name);
    if (q) { P.push(x.p); Q.push(q); }
  }
  return { P, Q };
}

function bake(v, ref) {
  const text = fs.readFileSync(v.source.kind === 'repo'
    ? path.join(HERE, '..', '..', v.source.path)
    : path.join(SRC, v.source.id + '.pdb'), 'utf8');
  const chain = v.chains;
  const R = Bake.ssRanges(text);

  const traced = Bake.caTrace(text, new Set([chain]));
  if (!traced.size) throw new Error(v.id + ': no CA on chain ' + chain);
  /* Back into the {num, p} shape the superposition below moves, because the
     fit happens BEFORE the trace is assembled and centred. */
  const res = traced.get(chain).map(r => ({ num: r.num, p: [r.x, r.y, r.z] }));

  const site = pocket(text, chain, v.pocket);

  /* SUPERPOSE BEFORE CENTRING, in the crystal's own coordinates, because
     the fit is a rotation about the reference's origin and centring first
     would fit the two structures' centroids to each other instead. Applied
     to the trace and the pocket alike — they are one object. */
  let fit = null;
  if (ref && site) {
    const heme = x => x.filter(a => a.group === 'heme');
    const { P, Q } = matchByName(heme(site.atoms), heme(ref.atoms));
    if (P.length >= 3) {
      const k = kabsch(P, Q);
      fit = { rmsd: k.rmsd, n: P.length };
      const put = p => mul(k.R, p).map((x, i) => x + k.t[i]);
      for (const a of site.atoms) a.p = put(a.p);
      for (const r of res) r.p = put(r.p);
    }
  }

  /* ONE CENTRE FOR BOTH, AND ONE CENTRE FOR ALL SEVEN. The trace decides
     it — the ribbon is what the box frames — and the pocket is moved by the
     same vector so the iron stays where the protein put it. The REFERENCE's
     centre is what every superposed view then uses: centring each on its own
     centroid would undo most of the fit that was just made, sliding the
     structures back apart by the half-ångström their centroids differ by. */
  const c = ref ? ref.centre
    : [0, 1, 2].map(k => res.reduce((s, r) => s + r.p[k], 0) / res.length);
  const shift = p => p.map((v2, k) => r2(v2 - c[k]));

  /* The centre is passed in rather than left to bake-lib to solve, because
     the pocket has to be moved by the SAME vector and it needs the unrounded
     one — the trace's own copy is rounded to 0.01 A on the way out. */
  const T = Bake.assemble(new Map([[chain, res.map(r => ({ num: r.num, x: r.p[0],
                                                           y: r.p[1], z: r.p[2] }))]]),
                          R, c);

  const out = {
    source: v.source.id + '.pdb', ssFrom: Bake.ssFrom(R),
    centre: T.centre, order: T.order, chains: T.chains,
  };
  out.radius = T.radius;

  /* Kept for the next view to fit against: the reference's pocket in its
     own coordinates, and the centre every view will be moved by. */
  out.centreRaw = c;
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
  /* The extents are still solved — they are a measurement of the shape and
     the panel prints them — but the basis is the hand-picked one above,
     overriding whatever `frameOf` would or would not have written. A solved
     basis for a bundle this round would flip between rebakes, and seven views
     each flipping independently is the jumping this page just stopped. */
  const F = Bake.frameOf(out.chains[chain].CA);
  const V = Bake.viewFor(ME, F);
  out.view = V.view;
  out.extents = F.extents;
  out.frame = V.frame;

  const decl = Bake.declared(text);
  const bound = site ? [...new Set(site.atoms.filter(a => a.group === 'bound')
                                             .map(a => a.res))] : [];
  out.meta = {
    entry: v.source.id, view: v.id, chain,
    method: Bake.method(text), resolution: Bake.resolution(text),
    title: Bake.line1(text, 'TITLE'), chainsInFile: Bake.chainCount(text),
    deposited: Bake.deposited(text),
    helices: out.chains[chain].helices, strands: out.chains[chain].strands,
    counts: [{ chain, modelled: res.length,
               declared: decl[chain] === undefined ? null : decl[chain] }],
    /* Counted, not typed. It comes out 43 across all seven, which is worth
       PRINTING rather than asserting: 1BZP writes 47 heme records, four of
       them a second position for atoms modelled twice, and the altloc rule is
       what turns that back into 43. */
    hemeAtoms: site ? site.atoms.filter(a => a.group === 'heme').length : 0,
    bound: bound.length ? bound : null,
    prox: v.pocket.prox, dist: v.pocket.dist,
    fitOn: ref ? REF : null,
    fitAtoms: fit ? fit.n : null,
    fitRmsd: fit ? +fit.rmsd.toFixed(3) : null,
    caRmsd: null,
  };
  /* The protein's own difference from the reference, once both are in one
     frame. Only where the numbering means the same thing: the whale and
     horse files number from the same alignment, haemoglobin's beta chain
     does not, and residue 45 of one is not residue 45 of the other. Rather
     than compute a number across that gap and print it as a comparison,
     this stays null and the panel says the fit was on the heme alone. */
  if (ref && ref.prox === v.pocket.prox) {
    let sd = 0, n = 0;
    out.chains[chain].nums.forEach((num, i) => {
      const q = ref.ca.get(num);
      if (!q) return;
      const p = out.chains[chain].CA[i];
      sd += (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
      n++;
    });
    if (n) out.meta.caRmsd = +Math.sqrt(sd / n).toFixed(2);
  }

  /* THE REGISTRY'S HALF is five fields: what the collection is indexed and
     compared on. The rest — resolution, the fit residuals, the pocket counts
     — is a fact about THIS structure and rides in the bake beside the
     coordinates it describes, where a reader of one structure looks. */
  out.read = {
    method: Bake.method(text),
    chainsInFile: Bake.chainCount(text),
    residues: out.meta.counts[0].modelled,
    declared: out.meta.counts[0].declared,
    /* Null for every myoglobin view: it carries oxygen and catalyses nothing,
       which is a fact worth having in the index rather than an absence. */
    ec: Bake.ecNumbers(text)[0] || null,
    baked: `mb-${v.id}.json`,
  };
  return out;
}

function main() {
  const blocks = {};

  /* TWO PASSES. The reference is baked first, in its own frame and centred on
     its own trace; every other view is then fitted onto that ALREADY CENTRED
     copy, so the fit and the centring are one step. */
  const refView = VIEWS.find(v => v.id === REF);
  const refOut = bake(refView, null);
  const ref = {
    atoms: refOut.pocket.atoms, centre: [0, 0, 0], prox: refView.pocket.prox,
    ca: new Map(refOut.chains[refView.chains].nums
      .map((n, i) => [n, refOut.chains[refView.chains].CA[i]])),
  };

  for (const v of VIEWS) {
    const out = v.id === REF ? refOut : bake(v, ref);
    const { read, ...bakeOut } = out;
    fs.writeFileSync(path.join(DATA, read.baked), JSON.stringify(bakeOut));
    blocks[v.id] = read;
    const m = out.meta, kb = (fs.statSync(path.join(DATA, read.baked)).size / 1024).toFixed(0);
    console.log(`${v.id.padEnd(7)} ${read.residues} residues, ${m.helices} helices, ` +
      `heme ${m.hemeAtoms} atoms, bound ${m.bound || 'nothing'}, ` +
      `pocket ${out.pocket ? out.pocket.bonds.length + ' bonds' : 'none'}, ` +
      (m.fitOn ? `fit on ${m.fitOn} ${m.fitRmsd} A over ${m.fitAtoms} heme atoms` +
        (m.caRmsd === null ? ', Ca not comparable' : `, Ca ${m.caRmsd} A`)
        : 'reference frame') + `, ${kb} KB`);
  }
  const touched = IO.write('myoglobin', blocks);
  console.log(`registry proteins.js  ${touched.length} variants updated`);
}

if (require.main === module) main();
module.exports = { pocket, bake };
