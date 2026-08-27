#!/usr/bin/env node
/* =====================================================================
 *  prep.js — six collagen depositions down to what the bench draws, plus
 *  the handful of facts its panel prints.
 *
 *  Run:  node proteins/collagen/tools/prep.js   (offline, no dependencies)
 *
 *  REVIEWED AND REGISTERED. The candidates were a table at the top of this
 *  file while a human clicked through the bench; six of the seven survived
 *  and now live in proteins/proteins.js like every other protein's, which
 *  this file reads. The seventh, 1BKV, is named in the comment beside them
 *  — a bench records what was kept, and the one reason worth keeping is
 *  the one that was not obvious.
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
 *  NOT SUPERPOSED. These are six different molecules — three synthetic
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
 *    for id in 1K6F 3B0S 1CAG 1DZI 3HR2 4AU3; do
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

/* THE RULER, read once and lazily — on first use rather than at load, because
   the tables it reads are consts further down the file. Null when 3HR2 is not
   in data/src, and then every candidate reports no placement rather than a
   wrong one. */
let RULER;
const rulerOnce = () => RULER === undefined ? (RULER = ruler(SRC)) : RULER;

/* THE VIEW TABLE IS proteins/proteins.js. Collagen was registered at the end
   of its review, so what each entry is, which chains are drawn, which of them
   are the COLLAGEN, and what each strand is called all live there with every
   other protein's; this file turns that into files under data/ and writes the
   counted half back. `said` is the human's and is read here; `read` is this
   script's and is written at the end of main().

   1BKV IS NOT IN THE LIST, and the comment beside the registry's variants is
   why: it was the only natural short sequence on the bench and it was dropped
   in review, because the width that was supposed to show its imino-poor middle
   splaying measured out as one frayed chain terminus. */
const REG = require('../../proteins.js');
const IO = require('../../tools/registry-io.js');
const ME = REG.byKey('collagen');
const CANDIDATES = ME.variants;

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
  /* The longer name only where it is a DISTINCTION: every variant names its
     helix chains now, and saying "solved on the helix" about a view whose
     every chain is helix would be noise. It earns the words when the file
     holds something that is not collagen. */
  out.frame = v.helix && v.helix !== v.chains
    ? 'helix axis across, solved on the helix' : 'helix axis across';

  /* AT MOST ONE POCKET PER VIEW, and that is a decision rather than a limit of
     the box: a pocket is what the view is ABOUT up close, and two of them is
     two subjects. The grip draws its metal, the peptides draw their
     hydroxyls, and 1DZI has 18 hydroxyprolines that it deliberately does not
     draw — on that view they are not the point. */
  /* THE RULER DOES NOT LOCATE ITSELF. Matching 3HR2 against 3HR2 finds the
     whole chain and then has to pick which of its own two chains "won", which
     is an arbitrary answer to a question nobody asked. It reports what it IS
     instead, including where helix numbering starts in it — the offset every
     other placement is quoted through. */
  const rule = rulerOnce();
  out.place = v.source.id === '3HR2'
    ? (rule ? { ruler: true, offset: rule[0].offset, start: rule[0].offset + 1,
                chains: rule.map(x => x.name) } : null)
    : placeOn(text, out.order, rule);

  if (v.pocket && v.pocket.metal) out.pocket = site(text, v.pocket.metal, T.centre);
  else if (v.pocket && v.pocket.hydroxyl) out.pocket = hydroxyls(text, only, T.centre);

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

/* ---- WHERE A FRAGMENT SITS ON THE WHOLE MOLECULE ----
 *
 *  Six of the seven entries here are short peptides, and a reader looking at
 *  seven collagen structures will reasonably assume they are seven pieces of
 *  one thing. Most of them are not pieces of anything: `(Pro-Pro-Gly)10`
 *  occurs in no collagen gene, and a designed peptide's 1-30 numbering is
 *  construct-local and means nothing outside its own file.
 *
 *  So each candidate is SEQUENCE-MATCHED against 3HR2, the one entry here that
 *  is a whole molecule, and either lands somewhere or does not. Matched, never
 *  typed: a position typed into a page is a claim nothing checks, and this one
 *  is checkable by construction.
 *
 *  THE NUMBERING TRAP, and it is the reason this is worth doing at all.
 *  Collagen positions are quoted from the start of the TRIPLE-HELICAL DOMAIN —
 *  every Gly349Ser in the osteogenesis imperfecta literature is in that frame.
 *  3HR2 numbers from its N-TELOPEPTIDE instead (Gln1 Met2 Ser3 Tyr4), so its
 *  own residue numbers run ahead of every number in a paper. The offset is
 *  found here rather than assumed, by looking for where Gly-X-Y actually
 *  starts, and both numbers are reported: a page that printed only the file's
 *  would be quietly off by that much forever.
 *
 *  GFOGER is the check. It comes out at helix 502-507, which is where the
 *  literature puts it in α1(I), and the file residues are 518-523.
 */
const ONE = { ALA:'A', ARG:'R', ASN:'N', ASP:'D', CYS:'C', GLN:'Q', GLU:'E',
  GLY:'G', HIS:'H', ILE:'I', LEU:'L', LYS:'K', MET:'M', PHE:'F', PRO:'P',
  SER:'S', THR:'T', TRP:'W', TYR:'Y', VAL:'V', HYP:'O', LYZ:'K' };

/* Modelled residues of one chain, as letters plus the numbers they were
   modelled under — so a match can be reported in the file's own frame. */
function chainSeq(text, ch) {
  const seq = [], nums = [];
  for (const l of text.split('\n')) {
    if (!l.startsWith('ATOM') && !l.startsWith('HETATM')) continue;
    if (l.slice(12, 16).trim() !== 'CA') continue;
    const alt = l[16];
    if (alt !== ' ' && alt !== 'A') continue;
    if (l[21] !== ch) continue;
    seq.push(ONE[l.slice(17, 20).trim()] || 'x');
    nums.push(parseInt(l.slice(22, 26), 10));
  }
  return { seq: seq.join(''), nums };
}

/* WHERE Gly-X-Y STARTS, found rather than assumed: the first position with ten
   consecutive triplets whose first residue is glycine. A telopeptide has no
   such run, so this lands on the helix and nowhere else. Returns the index, or
   -1 where there is no helical domain to find. */
function helixStart(seq) {
  for (let i = 0; i + 30 <= seq.length; i++) {
    let ok = true;
    for (let k = 0; k < 10 && ok; k++) if (seq[i + k * 3] !== 'G') ok = false;
    if (ok) return i;
  }
  return -1;
}

/* The ruler: 3HR2's two chain kinds, read once. Null when that file is not in
   data/src — placement is then unavailable rather than wrong, and every
   candidate reports `null` for it. */
function ruler(srcDir) {
  const f = path.join(srcDir, '3HR2.pdb');
  if (!fs.existsSync(f)) return null;
  const text = fs.readFileSync(f, 'utf8');
  /* A and C are α1(I) and B is α2(I) — read off the COMPND block rather than
     assumed, since which chain is which is the entry's statement. */
  const out = [];
  for (const [ch, name] of [['A', 'α1(I)'], ['B', 'α2(I)']]) {
    const c = chainSeq(text, ch);
    const h = helixStart(c.seq);
    out.push({ ch, name, seq: c.seq, nums: c.nums,
               /* Helix residue 1 is the first Gly of the helical domain, so a
                  file number maps to helix number by subtracting everything
                  before it. */
               offset: h < 0 ? null : c.nums[h] - 1 });
  }
  return out;
}

/* Where a candidate's chains land on the ruler, or null.
 *
 *  THE LONGEST STRETCH THAT OCCURS EXACTLY ONCE, not the whole chain. Whole-
 *  chain matching finds only 3HR2 itself: 1DZI's peptide is
 *  GPOGPOGFOGERGPOGPOGPO, a construct built AROUND a real site with synthetic
 *  scaffolding either side, and that whole string is in no gene. What is in a
 *  gene is the core, and the core is what a reader wants located.
 *
 *  UNIQUENESS IS NOT ENOUGH, and collagen is the worst case for finding that
 *  out. It is a repeat, so a long run of (Pro-Hyp-Gly) can happen to occur
 *  exactly once and still locate nothing — `(Gly-Pro-Hyp)9` matched fourteen
 *  residues of the C-terminal repeat and reported a position that is pure
 *  coincidence. Worse, LONGEST loses to a coincidence too: matching 1DZI on
 *  length picked a nine-residue `OGERGPOGP` in a different site over the six
 *  of `GFOGER`, and put the integrin's grip 440 residues from where it is.
 *
 *  SO THE SCORE IS INFORMATIVE RESIDUES, not length. Gly, Pro, Hyp and Ala are
 *  the repeat's own alphabet and locate nothing; everything else is what makes
 *  one stretch of collagen different from another. A match needs two of them,
 *  and among candidates the most informative wins with length only breaking
 *  ties. `GFOGER` carries three — F, E, R — and lands on 518, where it is.
 *  A designed repeat carries none and correctly comes back null.
 */
const REPEAT = new Set(['G', 'P', 'O', 'A']);
const informative = sub => [...sub].filter(c => !REPEAT.has(c)).length;
function placeOn(text, chains, R) {
  if (!R) return null;
  let best = null;
  const better = (a, b) => !b || a.info > b.info ||
                           (a.info === b.info && a.matched > b.matched);
  for (const ch of chains) {
    const c = chainSeq(text, ch);
    for (const ref of R) {
      for (let L = c.seq.length; L >= 6; L--) {
        for (let a = 0; a + L <= c.seq.length; a++) {
          const sub = c.seq.slice(a, a + L);
          const info = informative(sub);
          if (info < 2) continue;
          const i = ref.seq.indexOf(sub);
          if (i < 0 || ref.seq.indexOf(sub, i + 1) >= 0) continue;
          const from = ref.nums[i], to = ref.nums[i + L - 1];
          const hit = { on: '3HR2', chain: ref.ch, of: ref.name, from, to,
                        helix: ref.offset === null ? null
                             : [from - ref.offset, to - ref.offset],
                        offset: ref.offset, matched: L, info, seq: sub,
                        /* Whether the WHOLE drawn chain landed or only a core
                           of it — the difference between a fragment of
                           collagen and a construct built around one. */
                        whole: L === c.seq.length };
          if (better(hit, best)) best = hit;
        }
      }
    }
  }
  return best;
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
  return atoms.length ? { kind: 'metal', atoms, bonds } : null;
}

/* ---- THE 4-HYDROXYLS, off HYP and CONECT ----
 *
 *  Every hydroxyproline's OD1 — the oxygen prolyl 4-hydroxylase puts there —
 *  with the ring carbon it hangs off, so it reads as attached rather than
 *  floating beside the ribbon.
 *
 *  WHY THIS IS WORTH DRAWING. It is one atom per residue and it is the whole
 *  of the vitamin C story: the enzyme that adds it needs an iron that
 *  ascorbate keeps reduced, and without the oxygen the helix melts below body
 *  temperature. A `hydroxylated` row can print 30 and a reader still has no
 *  idea where they are. Beside (Pro-Pro-Gly)10, which has none, the two
 *  pictures make the claim by themselves.
 *
 *  THE BOND COMES OFF CONECT, not a cutoff — the same rule the metal site
 *  follows. A modified residue's connectivity is stated in the file, and
 *  measuring it again here would be this script deciding what a bond is.
 *
 *  Returns null where there are none, which is the honest answer for a
 *  synthetic (Pro-Pro-Gly) peptide and not a failure to find any.
 */
function hydroxyls(text, only, centre) {
  const lines = text.split('\n');
  const bySerial = new Map();
  for (const l of lines)
    if (l.startsWith('ATOM') || l.startsWith('HETATM'))
      bySerial.set(parseInt(l.slice(6, 11), 10), l);

  /* serial -> the serials CONECT says it is bonded to. */
  const conect = new Map();
  for (const l of lines) {
    if (!l.startsWith('CONECT')) continue;
    const a = parseInt(l.slice(6, 11), 10);
    const rest = [];
    for (let i = 11; i + 5 <= l.length; i += 5) {
      const n = parseInt(l.slice(i, i + 5), 10);
      if (!isNaN(n)) rest.push(n);
    }
    if (!conect.has(a)) conect.set(a, []);
    conect.get(a).push(...rest);
  }

  const res = l => l.slice(17, 20).trim() + '|' + l[21] + '|' + l.slice(22, 27);
  const atoms = [], bonds = [];
  for (const [serial, l] of bySerial) {
    if (l.slice(17, 20).trim() !== 'HYP') continue;
    if (l.slice(12, 16).trim() !== 'OD1') continue;
    if (only && !only.has(l[21])) continue;
    const alt = l[16];
    if (alt !== ' ' && alt !== 'A') continue;

    /* The ring carbon, named by the file rather than by this script: whatever
       CONECT bonds this oxygen to WITHIN THE SAME RESIDUE. */
    const mine = res(l);
    const partner = (conect.get(serial) || [])
      .map(n => bySerial.get(n))
      .find(x => x && res(x) === mine);
    if (!partner) continue;

    const i = atoms.length;
    for (const line of [l, partner])
      atoms.push({ el: (line.slice(76, 78).trim() || line.slice(12, 14).trim()),
                   p: Bake.xyz(line).map((c, k) => Bake.r2(c - centre[k])) });
    bonds.push([i, i + 1]);
  }
  return atoms.length ? { kind: 'hydroxyl', atoms, bonds } : null;
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
  const blocks = {};
  for (const v of CANDIDATES) {
    const out = bake(v);
    const file = out.read.baked;
    const { read, ...bakeOut } = out;
    fs.writeFileSync(path.join(DATA, file), JSON.stringify(bakeOut));
    blocks[v.id] = read;
    const kb = (fs.statSync(path.join(DATA, file)).size / 1024).toFixed(0);
    console.log(`${v.id.padEnd(10)} ${out.order.length} chain(s), ` +
      `${read.residues} residues` +
      (Bake.breaks(out) ? `, ${Bake.breaks(out)} break(s)` : '') +
      `, ss ${out.ssFrom}, ${out.extents.join(' × ')} Å, ` +
      `modified [${out.meta.modified.map(m => m.name + ' ×' + m.n).join(' ')}], ` +
      `ligands [${out.meta.ligands.join(' ')}], view ${out.frame}` +
      (out.pocket ? `, ${out.pocket.kind} ${out.pocket.atoms.length} atoms / ` +
                    `${out.pocket.bonds.length} bonds`
                  : v.pocket ? ', no pocket found' : '') + `, ${kb} KB`);
  }
  /* The counted half goes back into proteins.js, where the bench and the
     gallery card read it. The said half of that file is untouched. */
  const touched = IO.write('collagen', blocks);
  console.log(`registry  proteins.js  ${touched.length} variants updated`);
}

if (require.main === module) main();
module.exports = { bake, CANDIDATES };
