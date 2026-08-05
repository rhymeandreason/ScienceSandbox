#!/usr/bin/env node
/* =====================================================================
 *  bake-residues.js — write residues.js: the twenty standard amino acid
 *  side chains, MEASURED off deposited structures rather than typed.
 *
 *  Run:  node tools/bake-residues.js        (writes ../residues.js)
 *        node tools/bake-residues.js --check   (compare, don't write)
 *
 *  WHY MEASURE INSTEAD OF TYPE. Ideal geometry for twenty side chains is
 *  about 250 numbers, and a typed table is 250 chances to be quietly
 *  wrong in a way no page can show you — a bond a tenth of an ångström
 *  long renders as a bond. Every atom here comes out of a structure this
 *  repo already commits, so the geometry is somebody's refined
 *  crystallography and the CONNECTIVITY is derived from that geometry by
 *  distance rather than asserted from memory. Nothing in this file knows
 *  what tryptophan looks like; it knows how to look.
 *
 *  A REPRESENTATIVE INSTANCE, NOT AN AVERAGE. Side chains are rotameric:
 *  leucine sits in a handful of distinct conformations, and averaging
 *  their coordinates produces a shape that is in none of them and whose
 *  bonds are short — the mean of two rotamers is a squashed side chain.
 *  So each type keeps ONE REAL INSTANCE, the medoid: the copy with the
 *  least summed deviation from all the others of its type. That is a
 *  conformation a real protein was actually in, which is the only kind
 *  worth showing.
 *
 *  SOURCES. 2HHB (human deoxyhaemoglobin, X-ray 1.74 Å) supplies
 *  nineteen types. It cannot supply the twentieth: haemoglobin's alpha
 *  and beta chains contain NO ISOLEUCINE — a real and slightly famous
 *  property of the molecule, not a gap in the file — so isoleucine comes
 *  from 9ZZI (actin, 2.06 Å), which this repo also commits. Each type
 *  records the structure it came from.
 *
 *  WHAT IS AND IS NOT HERE. Heavy atoms only, side chain only: the
 *  backbone N, CA, C, O belong to whatever chain the side chain is being
 *  grafted onto, and hydrogens would double the atom count for a page
 *  that is teaching which R group is which. CB is included — it is the
 *  first side-chain atom and the one every graft hangs from — and
 *  glycine correctly has nothing at all.
 *
 *  THE FRAME IS N-CA-C, the same one hemoglobin-lab.html's settle uses:
 *  origin at CA, x along CA->C, z out of the N-CA-C plane. Coordinates
 *  are stored in it, so grafting is one rigid transform and needs no
 *  torsion machinery — and NO SIGN CONVENTION TO GET WRONG, which is
 *  what a torsion-based table would have brought with it. Chirality is
 *  inherited from the deposited structure: every residue here is the L
 *  enantiomer because the crystal was, and check-residues.js measures
 *  that rather than trusting it.
 * ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const HERE = path.join(__dirname, '..');
const OUT = path.join(HERE, 'residues.js');

/* The twenty, and where each is measured from. Glycine is in the list and
   ends up with an empty side chain, which is the point of glycine. */
const SOURCES = [
  { file: 'hemoglobin/data/2HHB.pdb', id: '2HHB', note: 'human deoxyhaemoglobin, X-ray 1.74 A',
    types: ['ALA','ARG','ASN','ASP','CYS','GLN','GLU','GLY','HIS','LEU',
            'LYS','MET','PHE','PRO','SER','THR','TRP','TYR','VAL'] },
  { file: 'folding/data/9ZZI.pdb', id: '9ZZI', note: 'actin, X-ray 2.06 A',
    types: ['ILE'] },
];
const STANDARD = SOURCES.flatMap(s => s.types).sort();

const BACKBONE = new Set(['N', 'CA', 'C', 'O', 'OXT']);
/* A heavy-atom covalent bond is under 1.9 Å and nothing else is. Sulphur
   stretches that: C-S is 1.81 and the disulphide S-S 2.05, but no side
   chain contains an S-S within itself, so 1.95 separates bonded from
   merely adjacent with room to spare. Asserted in check-residues.js. */
const BOND_MAX = 1.95;

function parse(text) {
  const res = new Map();
  for (const line of text.split('\n')) {
    if (!line.startsWith('ATOM')) continue;
    const alt = line[16];
    if (alt !== ' ' && alt !== 'A') continue;      // one conformer only
    const name = line.slice(12, 16).trim();
    const type = line.slice(17, 20).trim();
    const key = line.slice(21, 27);                // chain + seq + icode
    if (!res.has(key)) res.set(key, { type, atoms: [] });
    const r = res.get(key);
    if (r.type !== type) continue;
    let el = line.slice(76, 78).trim();
    if (!el) el = name[0];
    r.atoms.push({ name, el,
      p: [+line.slice(30, 38), +line.slice(38, 46), +line.slice(46, 54)] });
  }
  return [...res.values()];
}

/* The residue's own frame, and its side chain written in it. */
const sub = (a, b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
const norm = a => { const n = Math.hypot(...a); return [a[0]/n, a[1]/n, a[2]/n]; };
const dist = (a, b) => Math.hypot(...sub(a, b));

function localize(r) {
  const get = n => r.atoms.find(a => a.name === n);
  const N = get('N'), CA = get('CA'), C = get('C');
  if (!N || !CA || !C) return null;
  const x = norm(sub(C.p, CA.p));
  const z = norm(cross(x, sub(N.p, CA.p)));
  const y = cross(z, x);
  const side = r.atoms.filter(a => !BACKBONE.has(a.name) && a.el !== 'H');
  return side.map(a => {
    const v = sub(a.p, CA.p);
    return { name: a.name, el: a.el, p: [dot(v, x), dot(v, y), dot(v, z)] };
  });
}

/* The medoid: the instance closest to all the others of its type. Compared
   atom by atom in the shared frame, which is already an alignment — the
   backbone the frame is built from is the same three atoms in every copy. */
function medoid(all) {
  const names = all[0].map(a => a.name).join(',');
  const same = all.filter(s => s.map(a => a.name).join(',') === names);
  if (!same.length) return null;
  let best = null, bestScore = Infinity;
  for (const a of same) {
    let score = 0;
    for (const b of same) {
      let sum = 0;
      for (let i = 0; i < a.length; i++) sum += dist(a[i].p, b[i].p) ** 2;
      score += Math.sqrt(sum / Math.max(1, a.length));
    }
    if (score < bestScore) { bestScore = score; best = a; }
  }
  return { atoms: best, n: same.length, spread: bestScore / same.length };
}

/* Bonds by distance, within the side chain and from CB back to the
   backbone CA. Proline's ring closes onto N, which falls out of the same
   test rather than being special-cased — CD sits 1.47 Å from it. */
function bondsOf(atoms) {
  const out = [];
  for (let i = 0; i < atoms.length; i++)
    for (let j = i + 1; j < atoms.length; j++)
      if (dist(atoms[i].p, atoms[j].p) < BOND_MAX) out.push([i, j]);
  return out;
}
/* Which side-chain atoms bond to a BACKBONE atom, and to which. CB always
   does (to CA, at the origin of the frame); proline's CD also reaches N. */
function anchorsOf(atoms, N) {
  const out = [];
  atoms.forEach((a, i) => {
    if (dist(a.p, [0, 0, 0]) < BOND_MAX) out.push([i, 'CA']);
    if (N && dist(a.p, N) < BOND_MAX) out.push([i, 'N']);
  });
  return out;
}

function build() {
  const table = {};
  for (const src of SOURCES) {
    const text = fs.readFileSync(path.join(HERE, src.file), 'utf8');
    const parsed = parse(text);
    for (const type of src.types) {
      const all = parsed.filter(r => r.type === type).map(localize).filter(Boolean);
      if (!all.length) throw new Error(`${type} not found in ${src.id}`);
      if (type === 'GLY') {                       // no side chain, by definition
        table[type] = { src: src.id, note: src.note, n: all.length,
                        atoms: [], bonds: [], anchors: [] };
        continue;
      }
      const m = medoid(all);
      if (!m) throw new Error(`${type}: no two instances share an atom list`);
      /* N in this frame, for proline's ring closure — measured off the same
         medoid's own residue rather than assumed. */
      const nLocal = (() => {
        const r = parsed.find(r => r.type === type && localize(r) &&
          localize(r).map(a => a.name).join(',') === m.atoms.map(a => a.name).join(','));
        if (!r) return null;
        const get = n => r.atoms.find(a => a.name === n);
        const CA = get('CA'), C = get('C'), N = get('N');
        const x = norm(sub(C.p, CA.p));
        const z = norm(cross(x, sub(N.p, CA.p)));
        const y = cross(z, x);
        const v = sub(N.p, CA.p);
        return [dot(v, x), dot(v, y), dot(v, z)];
      })();
      table[type] = {
        src: src.id, note: src.note, n: m.n, spread: m.spread,
        atoms: m.atoms.map(a => ({ name: a.name, el: a.el,
                                   p: a.p.map(v => +v.toFixed(3)) })),
        bonds: bondsOf(m.atoms),
        anchors: anchorsOf(m.atoms, nLocal),
      };
    }
  }
  return table;
}

/* ---- the emitted module ---- */
function emit(table) {
  const rows = STANDARD.map(t => {
    const r = table[t];
    const atoms = r.atoms.map(a => `['${a.name}','${a.el}',${a.p.join(',')}]`).join(', ');
    const bonds = r.bonds.map(b => `[${b.join(',')}]`).join(',');
    const anch = r.anchors.map(a => `[${a[0]},'${a[1]}']`).join(',');
    return `  ${t}: { src:'${r.src}', n:${r.n},\n` +
           `    atoms:[${atoms}],\n` +
           `    bonds:[${bonds}], anchors:[${anch}] },`;
  }).join('\n');

  return `/* =====================================================================
 *  residues.js — the twenty standard amino acid side chains.
 *
 *  GENERATED by tools/bake-residues.js. Do not edit: re-run the baker.
 *  tools/check-residues.js re-derives this file and fails if it is stale,
 *  and separately asserts the chemistry (L-configuration, ring closure,
 *  bond lengths, the textbook atom count of every type).
 *
 *  ResidueLib.SIDE[type] = { src, n, atoms, bonds, anchors }
 *    atoms    [name, element, x, y, z]  heavy atoms, side chain only
 *    bonds    [i, j] into atoms
 *    anchors  [i, 'CA'|'N'] where the side chain joins the backbone
 *    src      the structure it was measured from
 *    n        how many copies of this type that structure held
 *
 *  ResidueLib.graft(type, N, CA, C) -> [{name, el, p:[x,y,z]}]
 *    the side chain placed on one residue's backbone, in that backbone's
 *    own coordinates. Real ångströms — like folding/ and hemoglobin/, and
 *    unlike the MolLib specs, this never sees MolLib.SCALE.
 *
 *  COORDINATES ARE IN THE RESIDUE'S OWN N-CA-C FRAME: origin at CA, x
 *  along CA->C, z out of the N-CA-C plane. So a graft is one rigid
 *  transform, with no torsions and so no sign convention to invert — the
 *  handedness is inherited from the deposited structure it was measured
 *  from, and asserted by the checker.
 *
 *  EACH SIDE CHAIN IS ONE REAL CONFORMATION, the most typical copy in its
 *  source structure, NOT an average of them — see the baker's header for
 *  why an averaged rotamer is a shape no protein is ever in. It is one
 *  rotamer of several a real residue visits, so it is honest about
 *  CONNECTIVITY (which atoms, bonded how — the thing a lesson teaches)
 *  and representative, not canonical, about conformation.
 *
 *  Glycine is in the table with an empty atom list. That is not a gap: a
 *  hydrogen is all glycine has, and this file holds heavy atoms.
 * ===================================================================== */
(function (global) {
  'use strict';

  const SIDE = {
${rows}
  };

  /* Place a side chain on a backbone. N/CA/C are [x,y,z] in whatever
     coordinates the caller is working in; the result comes back in those
     same coordinates. */
  function graft(type, N, CA, C) {
    const r = SIDE[type];
    if (!r) throw new Error('residues.js has no side chain for ' + type);
    const sub = (a, b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
    const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
    const norm = a => { const n = Math.hypot(a[0], a[1], a[2]); return [a[0]/n, a[1]/n, a[2]/n]; };
    const x = norm(sub(C, CA));
    const z = norm(cross(x, sub(N, CA)));
    const y = cross(z, x);
    return r.atoms.map(([name, el, ax, ay, az]) => ({
      name, el,
      p: [CA[0] + x[0]*ax + y[0]*ay + z[0]*az,
          CA[1] + x[1]*ax + y[1]*ay + z[1]*az,
          CA[2] + x[2]*ax + y[2]*ay + z[2]*az],
    }));
  }

  const TYPES = Object.keys(SIDE);

  global.ResidueLib = { SIDE, TYPES, graft };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.ResidueLib;
})(typeof globalThis !== 'undefined' ? globalThis : this);
`;
}

const table = build();
const text = emit(table);

if (process.argv.includes('--check')) {
  const have = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (have !== text) {
    console.error('residues.js is STALE — re-run: node tools/bake-residues.js');
    process.exit(1);
  }
  console.log('residues.js is up to date');
} else {
  fs.writeFileSync(OUT, text);
  const n = STANDARD.length;
  const atoms = STANDARD.reduce((a, t) => a + table[t].atoms.length, 0);
  console.log(`wrote residues.js — ${n} types, ${atoms} side-chain heavy atoms`);
  for (const t of STANDARD)
    console.log(`  ${t}  ${String(table[t].atoms.length).padStart(2)} atoms  ` +
      `${String(table[t].bonds.length).padStart(2)} bonds  from ${table[t].src}` +
      (table[t].spread != null
        ? `  (${table[t].n} copies, spread ${table[t].spread.toFixed(2)} A)` : '  (no side chain)'));
}
