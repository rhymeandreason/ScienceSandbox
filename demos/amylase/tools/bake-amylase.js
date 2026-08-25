#!/usr/bin/env node
/* =====================================================================
 *  bake-amylase.js — 1OSE -> amylase/data/1OSE.surf.bin + amylase.json
 *
 *  Porcine pancreatic alpha-amylase with acarbose in the site. What the
 *  page needs off this file that a browser should not compute:
 *
 *    · the solvent-excluded surface of the PROTEIN ALONE. The ligand is
 *      excluded on purpose — the claim the page makes is about the shape
 *      of the empty trough, and a surface built around the sugar closes
 *      over it and shows a smooth flank instead.
 *    · the ligand and the two ions as coordinates plus bonds, since the
 *      page draws them as sticks and nothing here reads a CIF.
 *    · the trough measurements, so no number on the page is typed.
 *
 *  The mesh format and its writer are hemoglobin/tools/bake-surface.js,
 *  reused whole. What this file adds is the atom FILTER (below) and the
 *  measurement.
 *
 *  THE FRAME is the protein's own, minus the centroid of its CA atoms.
 *  The page reads that centroid out of amylase.json and subtracts it from
 *  the ribbon and the ligand it parses from the same PDB, so all three
 *  land in one frame without the PDB being rewritten. No rotation: which
 *  way the trough faces the camera is a page decision, and it is one the
 *  human picks by eye.
 *
 *  Run:  node amylase/tools/bake-amylase.js [--spacing 0.7]
 * ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const SES = require('../../tools/ses.js');
const { readAtoms, tagResidues, encode } = require('../../hemoglobin/tools/bake-surface.js');

const DATA = path.join(__dirname, '..', 'data');
const SRC = path.join(DATA, '1OSE.pdb');
const OUT_SURF = path.join(DATA, '1OSE.surf.bin');
const OUT_JSON = path.join(DATA, 'amylase.json');

const SPACING = 0.7;                 // one 495-residue chain: hemoglobin's grid
const CONTACT = 4.0;                 // heavy-atom contact, the usual cut

/* The ligand, in the order the LINK records chain it: BGC 1 - AC1 2 -
   GLC 3 - AC1 4, one pseudo-tetrasaccharide lying along the site. BGC A
   996 is a LONE glucose on the far side of the molecule and is not part
   of it; keeping it would put a fifth "subsite" in the measurement. */
const LIG = [['B',1],['B',2],['B',3],['B',4]];

/* THE THREE THAT DO THE CHEMISTRY, in 1OSE's own numbering. This is the one
   fact on the page that is not measurable from the coordinates — which
   residue attacks and which protonates comes from the enzymology, not from
   where atoms are. So it is declared here, and everything ABOUT them is then
   measured: check-amylase.js holds the names against the file, requires all
   three to be in the site's contact set, and requires each to be close enough
   to the sugar to reach it. A typo in a number would otherwise mark an
   innocent residue and nothing would complain.
   Porcine pancreatic α-amylase, the standard retaining double-displacement:
   Asp197 attacks C1, Glu233 protonates the leaving oxygen, Asp300 holds the
   substrate through both steps. */
const CATALYTIC = [
  { num: 197, name: 'ASP', role: 'attacks the sugar' },
  { num: 233, name: 'GLU', role: 'hands over a hydrogen' },
  { num: 300, name: 'ASP', role: 'holds it steady' },
];
/* The end of the side chain, which is the part that reaches the bond — an
   Asp/Glu carboxyl. A residue's centroid would sit half a side chain back. */
const TIP = { ASP: ['OD1','OD2'], GLU: ['OE1','OE2'] };
const IONS = [['A',500],['A',498]];
const isIn = (list, ch, n) => list.some(([c,k]) => c===ch && k===n);

const dist = (a,b) => Math.hypot(a[0]-b[0], a[1]-b[1], a[2]-b[2]);

/* Every heavy atom, tagged. Hydrogens are absent from a 2.3 A structure
   anyway; the filter is written out so it does not depend on that. */
function parse(raw) {
  const out = [];
  for (const line of raw.split('\n')) {
    if (!line.startsWith('ATOM') && !line.startsWith('HETATM')) continue;
    const alt = line[16];
    if (alt !== ' ' && alt !== 'A') continue;
    const name = line.slice(17,20).trim(), chain = line[21], num = +line.slice(22,26);
    const el = (line.slice(76,78).trim() || line.slice(12,14).trim()[0]).toUpperCase();
    if (el === 'H') continue;
    out.push({ name, chain, num, el, atom: line.slice(12,16).trim(),
               p: [+line.slice(30,38), +line.slice(38,46), +line.slice(46,54)],
               het: line.startsWith('HETATM') });
  }
  return out;
}

/* The text the surface is built from: protein only, with PCA promoted to
   ATOM. PCA is residue 1 — pyroglutamate, a modified N-terminus and part
   of the chain — and bake-surface.js drops HETATM it does not recognise,
   which would leave a hole in the skin where the chain starts. */
function proteinPDB(raw) {
  const keep = [];
  for (const line of raw.split('\n')) {
    if (line.startsWith('ATOM')) { keep.push(line); continue; }
    if (!line.startsWith('HETATM')) continue;
    if (line.slice(17,20).trim() === 'PCA') keep.push('ATOM  ' + line.slice(6));
  }
  return keep.join('\n');
}

/* Sugar bonds by distance. Every bond in this ligand is C-C, C-O or C-N
   and all of them sit under 1.65 A, while the shortest NON-bonded pair
   across a ring is over 2.1 A, so a single cut separates them cleanly.
   The assertion that it did is the ring count in check-amylase.js. */
function bonds(atoms) {
  const out = [];
  for (let i = 0; i < atoms.length; i++)
    for (let j = i+1; j < atoms.length; j++)
      if (dist(atoms[i].p, atoms[j].p) < 1.75) out.push([i, j]);
  return out;
}

function main() {
  const argS = process.argv.indexOf('--spacing');
  const spacing = argS > 0 ? +process.argv[argS+1] : SPACING;

  const raw = fs.readFileSync(SRC, 'utf8');
  const all = parse(raw);

  const prot = all.filter(a => !a.het || a.name === 'PCA');
  const ca = prot.filter(a => a.atom === 'CA' && a.el === 'C');
  const centre = [0,1,2].map(c => ca.reduce((s,a) => s + a.p[c], 0) / ca.length);
  const sub = p => [p[0]-centre[0], p[1]-centre[1], p[2]-centre[2]];

  const lig = all.filter(a => isIn(LIG, a.chain, a.num));
  const ions = all.filter(a => isIn(IONS, a.chain, a.num));
  if (lig.length !== 42+11+24-0 && lig.length < 60)
    throw new Error(`ligand came out ${lig.length} atoms — check the LIG table`);

  /* ---- the measurements the page prints ---- */
  const units = LIG.map(([ch,n]) => {
    const at = lig.filter(a => a.chain===ch && a.num===n);
    const contacts = new Set();
    for (const s of at) for (const p of prot)
      if (dist(s.p, p.p) <= CONTACT) contacts.add(p.chain + p.num + ':' + p.name);
    return { chain: ch, num: n, name: at[0].name, atoms: at.length,
             contacts: [...contacts].sort() };
  });
  let span = 0;
  for (let i = 0; i < lig.length; i++) for (let j = i+1; j < lig.length; j++)
    span = Math.max(span, dist(lig[i].p, lig[j].p));
  const union = new Set(units.flatMap(u => u.contacts));
  /* Adjacent subsites: how much of one unit's contact set the next one
     shares. This is the number that says track rather than pocket. */
  const shared = [];
  for (let i = 0; i+1 < units.length; i++) {
    const a = new Set(units[i].contacts), b = units[i+1].contacts;
    const both = b.filter(r => a.has(r)).length;
    /* Both denominators, because they answer different questions and a
       page that prints one had better not be read as the other: `of` is
       how much of the SMALLER set the two share, `jaccard` is the share
       of everything either one touches. */
    shared.push({ both, of: Math.min(a.size, b.length),
                  jaccard: +(both / new Set([...a, ...b]).size).toFixed(3) });
  }
  const nearest = ions.map(io => ({
    el: io.el, chain: io.chain, num: io.num,
    toLigand: +Math.min(...lig.map(l => dist(io.p, l.p))).toFixed(2),
  }));
  const residueCount = new Set(prot.map(a => a.chain + a.num)).size;

  const catalytic = CATALYTIC.map(c => {
    const at = prot.filter(a => a.chain === 'A' && a.num === c.num);
    if (!at.length) throw new Error(`no residue A${c.num}`);
    const found = at[0].name;
    if (found !== c.name)
      throw new Error(`A${c.num} is ${found}, not the ${c.name} the table claims`);
    const tip = at.filter(a => TIP[c.name].includes(a.atom));
    if (tip.length !== 2) throw new Error(`A${c.num} is missing its carboxyl oxygens`);
    const p = [0,1,2].map(k => tip.reduce((s2,a) => s2 + a.p[k], 0) / tip.length);
    return { num: c.num, name: c.name, role: c.role,
             p: sub(p).map(v => +v.toFixed(3)),
             toLigand: +Math.min(...lig.map(l => dist(p, l.p))).toFixed(2) };
  });

  const J = {
    source: '1OSE', note: 'porcine pancreatic alpha-amylase + acarbose, 2.3 A',
    baker: 'amylase/tools/bake-amylase.js',
    centre: centre.map(v => +v.toFixed(4)),
    residues: residueCount,
    ligand: {
      residues: units.map(u => ({ name: u.name, num: u.num, atoms: u.atoms,
                                  contacts: u.contacts.length })),
      atoms: lig.map(a => ({ el: a.el, atom: a.atom, res: a.name, num: a.num,
                             p: sub(a.p).map(v => +v.toFixed(3)) })),
      bonds: bonds(lig),
    },
    ions: ions.map(a => ({ el: a.el, num: a.num, p: sub(a.p).map(v => +v.toFixed(3)) })),
    trough: {
      span: +span.toFixed(2),
      subsites: units.length,
      contactUnion: union.size,
      contactUnionResidues: [...union].sort(),
      adjacentOverlap: shared,
      contactCut: CONTACT,
    },
    ionDistances: nearest,
    catalytic,
  };

  /* ---- the surface ---- */
  const I = [[1,0,0],[0,1,0],[0,0,1]];
  const { atoms, residues, skipped } = readAtoms(proteinPDB(raw), I);
  for (const a of atoms) a.p = sub(a.p);
  console.log(`1OSE: ${atoms.length} protein atoms over ${residues.length} residues`);
  console.log(`      excluded from the skin: ` +
              `${[...skipped].map(([k,v]) => `${k} x${v}`).join(', ') || 'none'}`);

  const t0 = Date.now();
  const mesh = SES.build(atoms, { spacing, probe: SES.PROBE });
  const { volume, area } = SES.measure(mesh);
  const wt = SES.watertight(mesh);
  console.log(`      grid ${mesh.dims.join(' x ')} at ${spacing} A -> ` +
              `${mesh.nVert} verts, ${mesh.nTri} tris in ` +
              `${((Date.now()-t0)/1000).toFixed(1)}s`);
  console.log(`      area ${area.toFixed(0)} A^2, volume ${volume.toFixed(0)} A^3`);
  if (!wt.ok) throw new Error(`mesh is not closed: ${wt.bad} unpaired edges`);
  if (volume <= 0) throw new Error('mesh is inside out');

  const buf = encode(mesh, tagResidues(mesh, atoms), residues, {
    source: '1OSE', spacing, probe: SES.PROBE,
    atoms: atoms.length, area: +area.toFixed(1), volume: +volume.toFixed(1),
    centre: J.centre,
    note: 'protein only, ligand and ions excluded; centred on the CA centroid',
  });
  fs.writeFileSync(OUT_SURF, buf);
  fs.writeFileSync(OUT_JSON, JSON.stringify(J, null, 2));
  console.log(`      trough span ${J.trough.span} A over ${J.trough.subsites} subsites, ` +
              `${J.trough.contactUnion} residues of ${residueCount}`);
  console.log(`      adjacent overlap ` +
              `${J.trough.adjacentOverlap.map(s => `${s.both}/${s.of}`).join(', ')}` +
              ` residues shared`);
  console.log(`      ${nearest.map(n => `${n.el} ${n.toLigand} A`).join(', ')} from the sugar`);
  console.log(`      catalytic: ` +
              `${catalytic.map(c => `${c.name}${c.num} ${c.toLigand} A`).join(', ')}`);
  console.log(`      wrote 1OSE.surf.bin ${(buf.length/1024).toFixed(0)} KB, amylase.json`);
}

if (require.main === module) main();
