#!/usr/bin/env node
/* =====================================================================
 *  prep.js — five GFP candidates as ribbons with the chromophore inside.
 *
 *  Run:  node proteins/gfp/tools/prep.js      (offline, no dependencies)
 *
 *  UNDER REVIEW, so the view table is CANDIDATES below and nothing is in
 *  proteins/proteins.js yet. AddingAProtein.md step 5 moves it.
 *
 *  WHAT GFP IS, and therefore what a bake of it has to contain. Eleven
 *  strands make a barrel about 24 A across and 42 A tall; one helix runs
 *  up the axis inside it; and three residues of THAT helix — 65-67 —
 *  cyclise and oxidise on their own into the chromophore. Nothing is
 *  bound and no cofactor arrives: the protein makes its own dye out of
 *  its own backbone, and the barrel is what holds the dye rigid enough
 *  to fluoresce instead of dumping the energy as heat. So a bake that
 *  drew only the backbone would draw the can and leave out the reason
 *  anyone opened it — this one carries a `pocket` beside the trace, the
 *  way proteins/myoglobin/tools/prep.js does.
 *
 *  THE CHROMOPHORE IS THREE RESIDUES DEPOSITED AS ONE, and that is the
 *  trap in this protein. 1EMA, 2WUR and 1BFP write it as a single
 *  HETATM residue at 66 (CRO / GYS / IIC), so 65 and 67 do not exist as
 *  residues at all and an ordinary Ca trace jumps 64 -> 68. `nums` then
 *  says chain break and kit/proteinbox.js correctly snaps the ribbon in
 *  half — through the middle of the central helix, which is the one
 *  feature the barrel is wrapped around. The three backbone alpha
 *  carbons are all there under their own names (CA1, CA2, CA3), so this
 *  baker splices them back in as 65, 66, 67. 1GFL deposits the same
 *  three atoms as ATOM records under SER/TYR/GLY and needs nothing.
 *  After the splice all five files number identically, which is what
 *  makes the Ca fit and the RMSD below mean anything.
 *
 *  Consequently DECLARED is corrected the same way: a file that folds
 *  65-67 into one SEQRES entry declares 236 where 1GFL declares 238,
 *  and comparing 228 modelled against 236 declared would report a
 *  complete structure as missing eight residues.
 *
 *  MSE IS A SECOND MODIFIED RESIDUE, in 1EMA only — selenomethionine at
 *  78, 88, 153, 218, deposited as HETATM. `Bake.modResidues` reads the
 *  file's own MODRES set and caTrace takes it, so those four count as
 *  chain and stop being reported as four bound ligands.
 *
 *  NONE OF THESE IS THE WILD-TYPE PROTEIN, and only the file says so.
 *  Every entry here is engineered: 1GFL carries the Q80R cloning artifact
 *  that came with the original cDNA, 1EMA adds S65T, 2WUR is a folding
 *  variant (F64L, I167T, K238N) whose CHROMOPHORE-forming residues happen
 *  to be the wild-type Ser-Tyr-Gly, and 1BFP is Y66H plus Y145F. Calling
 *  2WUR "wild type" on the strength of its chromophore is the mistake this
 *  read exists to stop: the substitutions are counted off SEQADV, and the
 *  bench prints them rather than a word somebody chose. All four are
 *  fluorescent — three green, one blue.
 *
 *  EVERY VIEW IS SUPERPOSED ON 1EMA, on Ca, over the residues the two
 *  files share. The barrel is rigid and all five are the same protein
 *  under the same numbering, so the fit is a proper measurement rather
 *  than a convenience, and the backbone RMSD it returns is comparable
 *  across the set. Without it, five crystals are five arbitrary
 *  orientations and flipping between a green and a blue variant turns
 *  the whole molecule — a reader cannot tell one substituted residue
 *  from the crystallographer's choice of origin.
 *
 *  CONNECTIVITY IS DEPOSITED WHERE THERE IS ANY. The HETATM chromophores
 *  carry CONECT; 1GFL's does not, because it is written as three
 *  standard residues, and neither do the five side chains, which are
 *  ATOM records everywhere. Those fall back to a 1.9 A cutoff, which is
 *  longer than any C-C or C-N in a side chain and shorter than any
 *  non-bonded contact inside one — and it is applied only WITHIN a
 *  group, never between, so nothing invents a bond across the site.
 *
 *  SOURCES, for a re-run from scratch. The .pdb files are gitignored;
 *  data/ holds the bakes.
 *
 *    for id in 1EMA 1GFL 2WUR 1BFP; do
 *      curl -o proteins/gfp/data/src/$id.pdb \
 *        https://files.rcsb.org/download/$id.pdb
 *    done
 * ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const Bake = require('../../bake-lib.js');
const { kabsch, mul } = require('../../../sickle/tools/bake-sickle.js');

const HERE = path.join(__dirname, '..');
const SRC = path.join(HERE, 'data', 'src');
const DATA = path.join(HERE, 'data');

/* ---- THE CANDIDATES ---------------------------------------------------
 *
 *  Not proteins/proteins.js: nothing here has been reviewed. Each line is
 *  one question the bench is being built to answer.
 */
const REF = '1EMA';

const CANDIDATES = [
  { id: '1EMA', entry: '1EMA', chains: 'A', deflt: true,
    purpose: 'the canonical GFP: S65T, the bright mutant every fusion tag descends from' },
  { id: '2WUR', entry: '2WUR', chains: 'A',
    purpose: 'the sharpest look at a chromophore, at 0.90 A — in a folding variant, '
             + 'not in the wild-type protein' },
  { id: '1GFL', entry: '1GFL', chains: 'A',
    purpose: 'the jellyfish protein bar one cloning artifact: the chromophore '
             + 'written as three ordinary residues' },
  { id: '1GFL-dimer', entry: '1GFL', chains: 'A,B',
    purpose: 'the same file as its dimer — how the jellyfish protein actually sits' },
  { id: '1BFP', entry: '1BFP', chains: 'A',
    purpose: 'blue variant: Y66H, one residue swapped, and the colour changes' },
];

/* THE SITE. The chromophore, plus the five side chains that hold and tune
   it: Arg96 and Glu222 drive the cyclisation and sit on the imidazolinone,
   His148, Thr203 and Ser205 hydrogen-bond the phenol end. Numbering is the
   same in all five files, which is the point of the splice above. */
const SITE = [96, 148, 203, 205, 222];

/* The names a deposition gives the fused 65-67 residue. Each is one
   residue in the file and three in the protein. */
const CHROMO = new Set(['CRO', 'GYS', 'IIC']);
/* Where 1GFL writes it instead: three standard residues, cyclised in fact
   and not in the records. */
const CHROMO_NUMS = [65, 66, 67];

const r2 = Bake.r2, xyz = Bake.xyz;
const elOf = l => (l.slice(76, 78).trim() || l.slice(12, 14).trim()).toUpperCase();
const resNum = l => parseInt(l.slice(22, 26), 10);
const altOK = l => l[16] === ' ' || l[16] === 'A';

const read = id => fs.readFileSync(path.join(SRC, id + '.pdb'), 'utf8');

/* ---- the trace, with the chromophore put back ------------------------
 *
 *  caTrace with the file's MODRES set catches MSE, which has a CA. It
 *  cannot catch CRO/GYS/IIC, which has three (CA1, CA2, CA3) and none of
 *  them called CA — so they are spliced in as residues 65, 66, 67 and the
 *  chain is re-sorted by number. A file that already writes them as ATOM
 *  residues (1GFL) has them and this adds nothing.
 */
function trace(text, only, mod) {
  const chains = Bake.caTrace(text, only, mod);
  for (const line of text.split('\n')) {
    if (!line.startsWith('HETATM') || !altOK(line)) continue;
    if (!CHROMO.has(line.slice(17, 20).trim())) continue;
    const name = line.slice(12, 16).trim();
    const k = ['CA1', 'CA2', 'CA3'].indexOf(name);
    if (k < 0) continue;
    const id = line[21] === ' ' ? '_' : line[21];
    if (only && !only.has(id)) continue;
    const p = xyz(line);
    (chains.get(id) || []).push({ num: CHROMO_NUMS[k], x: p[0], y: p[1], z: p[2] });
  }
  for (const res of chains.values()) res.sort((a, b) => a.num - b.num);
  return chains;
}

/* SEQRES counts the fused residue once. Two more residues are declared in
   fact for every chain that folds them, and the completeness row is a
   comparison against the other files rather than against the record. */
function declaredFixed(text, only) {
  const decl = Bake.declared(text);
  const fused = text.split('\n').some(l => l.startsWith('HETATM') &&
    CHROMO.has(l.slice(17, 20).trim()) && l.slice(12, 16).trim() === 'CA2') ? 2 : 0;
  const out = {};
  for (const id of Object.keys(decl))
    if (!only || only.has(id)) out[id] = decl[id] + fused;
  return out;
}

/* WHICH THREE RESIDUES THIS CHROMOPHORE WAS MADE OF, read off the atoms that
   are there. The two substitutions that matter most on this bench are the two
   SEQADV cannot report: S65T and Y66H are INSIDE the fused residue, so the
   record says CHROMOPHORE and stops. The atoms do not — a threonine at 65
   leaves a methyl (CG1) that a serine has not, and a tyrosine at 66 leaves a
   phenol (OH) where a histidine leaves an imidazole (ND1/NE2). 67 is glycine
   in every GFP there is; it is printed from the same atoms rather than assumed,
   and comes back null if a file ever disagrees.

   THE FILE'S OWN NAME FOR THE RESIDUE SAYS THE SAME THING — CRO is the
   hydroxypropyl one, GYS the hydroxyethyl — but only for the codes the PDB has
   already minted, and it says it in IUPAC rather than in residues. */
function chromoFrom(atoms) {
  const has = n => atoms.some(a => a.name === n);
  if (!atoms.length) return null;
  /* 1GFL writes the three as themselves, so it can simply be read. The atom
     test below is for the files that fuse them and lose the names. */
  const nums = [...new Set(atoms.map(a => a.num))].sort((a, b) => a - b);
  if (nums.length === 3) return nums.map(n => {
    const r = atoms.find(a => a.num === n).res;
    return r[0] + r.slice(1).toLowerCase() + n;
  }).join('-');
  const one = has('CG1') ? 'Thr65' : has('OG1') || has('CB1') ? 'Ser65' : null;
  const two = has('OH') ? 'Tyr66' : has('NE2') || has('ND1') ? 'His66' : null;
  /* CA3 with nothing hanging off it: glycine. Anything else is a file this
     bench has not met, and it should say so rather than print the usual. */
  const three = has('CA3') && !has('CB3') ? 'Gly67' : null;
  return [one, two, three].every(Boolean) ? `${one}-${two}-${three}` : null;
}

/* THE SUBSTITUTIONS THE ENTRY DECLARES, off its own SEQADV records against
   UniProt P42212. Each comes back as `Q80R`, from the three fields the record
   already holds: what is in the file, at what number, and what the database
   has there. CHROMOPHORE rows are skipped — they say 65-67 became one residue,
   which is maturation and not a substitution — so what is left is exactly what
   somebody changed. Read, never typed: 2WUR was described as wild type here
   on the strength of its Ser-Tyr-Gly chromophore, and it carries four. */
const AA3 = { ALA:'A', ARG:'R', ASN:'N', ASP:'D', CYS:'C', GLN:'Q', GLU:'E',
              GLY:'G', HIS:'H', ILE:'I', LEU:'L', LYS:'K', MET:'M', PHE:'F',
              PRO:'P', SER:'S', THR:'T', TRP:'W', TYR:'Y', VAL:'V' };

function substitutions(text, chain) {
  const out = [];
  for (const line of text.split('\n')) {
    if (!line.startsWith('SEQADV') || line[16] !== chain) continue;
    const was = AA3[line.slice(39, 42).trim()], now = AA3[line.slice(12, 15).trim()];
    const num = parseInt(line.slice(43, 48), 10);
    if (!was || !now || !Number.isFinite(num)) continue;   /* CHROMOPHORE rows */
    out.push(`${was}${num}${now}`);
  }
  return out;
}

/* ---- the pocket ------------------------------------------------------
 *
 *  One chain's chromophore and the five side chains around it, as a flat
 *  atom list plus bonds, in the file's own coordinates. Centred by the
 *  caller with the SAME vector as the trace — a pocket centred on itself
 *  sits at the origin with the barrel somewhere else, and that reads as a
 *  bug in the ribbon rather than as a bug here.
 *
 *  Hydrogens are dropped. 2WUR is at 0.90 A and models them; nothing else
 *  does, and a chromophore that grows 14 atoms between two views would
 *  read as a difference in the molecule.
 */
function pocket(text, chain) {
  const lines = text.split('\n');
  const atoms = [], bySerial = new Map();
  const keep = (line, group) => {
    if (elOf(line) === 'H' || elOf(line) === 'D') return;
    bySerial.set(+line.slice(6, 11), atoms.length);
    atoms.push({ name: line.slice(12, 16).trim(), el: elOf(line),
                 res: line.slice(17, 20).trim(), num: resNum(line),
                 group, p: xyz(line) });
  };

  for (const line of lines) {
    const het = line.startsWith('HETATM'), atom = line.startsWith('ATOM');
    if ((!het && !atom) || line[21] !== chain || !altOK(line)) continue;
    const res = line.slice(17, 20).trim();
    const num = resNum(line);
    if (het && CHROMO.has(res)) { keep(line, 'chromophore'); continue; }
    if (!atom) continue;
    /* 1GFL's chromophore, written as SER 65 / TYR 66 / GLY 67. Whole
       residues, backbone included: the three are one conjugated system and
       cutting the backbone out of it would draw two thirds of a dye. */
    if (CHROMO_NUMS.includes(num)) { keep(line, 'chromophore'); continue; }
    if (!SITE.includes(num)) continue;
    /* Side chain only, CB kept as the stub that says which way the residue
       is attached. The backbone here is already drawn, as ribbon. */
    const name = line.slice(12, 16).trim();
    if (name === 'N' || name === 'C' || name === 'O') continue;
    keep(line, 'site');
  }
  if (!atoms.some(a => a.group === 'chromophore')) return null;

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

  /* WITHIN A RESIDUE, AND WITHIN THE CHROMOPHORE, BY DISTANCE — never
     between the site's side chains, where 1.9 A would start drawing the
     hydrogen bonds as covalent sticks. The chromophore is treated as one
     residue for this because in 1GFL it is three that are genuinely
     bonded to each other. */
  const near = (a, b) => Math.hypot(a.p[0] - b.p[0], a.p[1] - b.p[1], a.p[2] - b.p[2]);
  for (let i = 0; i < atoms.length; i++) {
    for (let j = i + 1; j < atoms.length; j++) {
      const A = atoms[i], B = atoms[j];
      if (A.group !== B.group) continue;
      if (A.group === 'site' && A.num !== B.num) continue;
      if (near(A, B) < 1.9) add(i, j);
    }
  }
  return { atoms, bonds };
}

/* ---- one candidate ---------------------------------------------------- */

function bake(v, ref) {
  const text = read(v.entry);
  const only = new Set(v.chains.split(','));
  const mod = Bake.modResidues(text);

  const chains = trace(text, only, mod);
  for (const id of only)
    if (!chains.has(id)) throw new Error(v.id + ': no CA on chain ' + id);
  const R = Bake.ssRanges(text);

  const site = pocket(text, v.chains.split(',')[0]);

  /* SUPERPOSE BEFORE CENTRING, in the crystal's own coordinates: the fit is
     a rotation about the reference's origin, and centring first would fit
     the two centroids to each other instead. Applied to every chain drawn
     and to the pocket alike — they are one object. */
  let fit = null;
  if (ref) {
    const P = [], Q = [];
    for (const r of chains.get(v.chains.split(',')[0])) {
      const q = ref.ca.get(r.num);
      if (q) { P.push([r.x, r.y, r.z]); Q.push(q); }
    }
    if (P.length >= 3) {
      const k = kabsch(P, Q);
      fit = { rmsd: k.rmsd, n: P.length };
      const put = p => mul(k.R, p).map((x, i) => x + k.t[i]);
      for (const res of chains.values())
        for (const r of res) { const p = put([r.x, r.y, r.z]); r.x = p[0]; r.y = p[1]; r.z = p[2]; }
      if (site) for (const a of site.atoms) a.p = put(a.p);
    }
  }

  /* ONE CENTRE FOR ALL FIVE — the reference's. Re-centring each view on its
     own centroid would slide back apart most of the fit just made, and the
     dimer's centroid is half a barrel away from the monomer's. */
  const c = ref ? ref.centre
    : (() => {
        let s = [0, 0, 0], n = 0;
        for (const res of chains.values())
          for (const r of res) { s[0] += r.x; s[1] += r.y; s[2] += r.z; n++; }
        return s.map(x => x / n);
      })();
  const shift = p => p.map((x, k) => r2(x - c[k]));

  const T = Bake.assemble(chains, R, c);

  const out = { source: v.entry + '.pdb', ssFrom: Bake.ssFrom(R), centre: T.centre,
                order: T.order, chains: T.chains, radius: T.radius };
  out.centreRaw = c;
  if (site) out.pocket = {
    atoms: site.atoms.map(a => ({ name: a.name, el: a.el, res: a.res, num: a.num,
                                  group: a.group, p: shift(a.p) })),
    bonds: site.bonds,
  };

  /* The extents are solved and printed — they are a measurement, and for a
     barrel 42 A tall against 24 A across they are the shape's own claim. No
     basis is chosen yet: `frameOf` writes one where the shape earns it, and
     a human replaces it from the bench's copy button at step 5. */
  const all = [];
  for (const id of out.order) for (const p of out.chains[id].CA) all.push(p);
  const F = Bake.frameOf(all);
  /* ONE BASIS, WORN BY ALL FIVE — the reference's. They share a frame after
     the fit, so a basis solved per view would turn the molecule on every
     switch and hide the one substituted residue inside the rotation. The
     EXTENTS stay each view's own: they are a measurement of that shape, and
     the dimer's are twice the monomer's. */
  const B = ref ? ref.basis : F;
  if (B.view) out.view = B.view;
  out.extents = F.extents;
  out.frame = B.frame;

  const decl = declaredFixed(text, only);
  const chromo = site ? site.atoms.filter(a => a.group === 'chromophore') : [];
  out.meta = {
    entry: v.entry, view: v.id, chain: v.chains,
    method: Bake.method(text), resolution: Bake.resolution(text),
    title: Bake.line1(text, 'TITLE'), models: Bake.models(text),
    chainsInFile: Bake.chainCount(text), chainsDrawn: out.order.length,
    counts: out.order.map(id => ({ chain: id, modelled: out.chains[id].nums.length,
                                   declared: decl[id] === undefined ? null : decl[id] })),
    helices: out.chains[out.order[0]].helices,
    strands: out.chains[out.order[0]].strands,
    ss: Bake.disulfides(text, only),
    /* The MODRES set is passed so the chromophore and the four
       selenomethionines are chain rather than cargo. What is left is what
       the crystal actually brought: 2WUR's ethanol and isopropanol. */
    ligands: Bake.ligands(text, only, mod),
    modres: [...mod].sort(),
    /* Against UniProt P42212, the entry's own comparison. An empty list would
       mean a file that declares itself unmodified; none of these does. */
    subs: substitutions(text, v.chains.split(',')[0]),
    /* Counted here, printed by the page. CRO is 22 heavy atoms, GYS the
       21 because the wild type has a serine at 65 where S65T put a threonine,
       and IIC 19 — Y66H swaps a phenol for a smaller imidazole, which is the
       whole of what turns this protein blue. */
    chromoRes: chromo.length
      ? [...new Set(chromo.map(a => a.res))].join('-') : null,
    chromoFrom: chromoFrom(chromo),
    chromoAtoms: chromo.length,
    chromoSplit: chromo.length ? new Set(chromo.map(a => a.num)).size : 0,
    site: SITE,
    fitOn: ref ? REF : null,
    fitAtoms: fit ? fit.n : null,
    fitRmsd: fit ? +fit.rmsd.toFixed(2) : null,
  };
  out.read = {
    method: Bake.method(text),
    chainsInFile: Bake.chainCount(text),
    residues: out.meta.counts.reduce((k, x) => k + x.modelled, 0),
    declared: out.meta.counts.every(x => x.declared !== null)
      ? out.meta.counts.reduce((k, x) => k + x.declared, 0) : null,
    ec: Bake.ecNumbers(text)[0] || null,
    baked: `gfp-${v.id}.json`,
  };
  return out;
}

function main() {
  const blocks = {};

  /* Two passes: the reference in its own frame and on its own centroid, then
     every other view fitted onto that already-centred copy. */
  const refCand = CANDIDATES.find(v => v.id === REF);
  const refOut = bake(refCand, null);
  const refChain = refCand.chains.split(',')[0];
  const ref = {
    centre: [0, 0, 0],
    basis: { view: refOut.view || null, frame: refOut.frame },
    ca: new Map(refOut.chains[refChain].nums
      .map((n, i) => [n, refOut.chains[refChain].CA[i]])),
  };

  for (const v of CANDIDATES) {
    const out = v.id === REF ? refOut : bake(v, ref);
    const { read: r, ...bakeOut } = out;
    fs.writeFileSync(path.join(DATA, r.baked), JSON.stringify(bakeOut));
    blocks[v.id] = { ...v, read: r };
    const m = out.meta, kb = (fs.statSync(path.join(DATA, r.baked)).size / 1024).toFixed(0);
    console.log(`${v.id.padEnd(11)} ${r.residues} of ${r.declared} residues` +
      (Bake.breaks(out) ? `, ${Bake.breaks(out)} break(s)` : ', no breaks') +
      `, ${m.strands} strands / ${m.helices} helices` +
      `, chromophore ${m.chromoRes} ${m.chromoAtoms} atoms as ${m.chromoSplit} residue(s)` +
      ` from ${m.chromoFrom}` +
      `, ligands [${m.ligands.join(' ') || '-'}]` +
      `, subs [${m.subs.join(' ') || 'none declared'}]` +
      `, ${out.extents.join(' × ')} A, view ${out.frame}, ` +
      (m.fitOn ? `fit on ${m.fitOn} ${m.fitRmsd} A over ${m.fitAtoms} Ca` : 'reference') +
      `, ${kb} KB`);
  }

  /* THE CANDIDATE TABLE, WRITTEN OUT FOR THE BENCH. Under review there is no
     registry entry to read, and a second copy of this list on the page is
     the thing that goes stale between a re-bake and a reload. */
  fs.writeFileSync(path.join(DATA, 'candidates.json'),
                   JSON.stringify({ ref: REF, order: CANDIDATES.map(v => v.id),
                                    variants: blocks }, null, 1));
  console.log(`candidates.json  ${CANDIDATES.length} candidates`);
}

if (require.main === module) main();
module.exports = { bake, pocket, trace, CANDIDATES };
