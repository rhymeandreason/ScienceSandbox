#!/usr/bin/env node
/* =====================================================================
 *  bake-surface.js — haemoglobin's solvent-excluded surface, as a mesh.
 *
 *  2HHB -> hemoglobin/data/2HHB.surf.bin
 *
 *  The algorithm is tools/ses.js and its reasoning lives there. This
 *  file is the haemoglobin-specific half: which atoms count, what frame
 *  they go in, what each vertex remembers about the residue under it,
 *  and how the mesh is quantised.
 *
 * ---------------------------------------------------------------------
 *  WHY THIS IS BAKED AND NOT COMPUTED IN THE PAGE
 * ---------------------------------------------------------------------
 *  viewer-compare.html measured it: SES on this exact structure took
 *  3Dmol 5.7 s and Mol* 9.4 s, both of them tuned C-like JS doing the
 *  same grid construction. That is not a cost a lesson can pay while a
 *  student waits, and the structure is FIXED — sickle-lab's whole claim
 *  is that the fold does not move — so there is nothing to recompute.
 *  A baked mesh is not a compromise here; it is the honest object.
 *
 *  It does mean the surface cannot follow a MOVING chain, which rules
 *  it out for hemoglobin-lab's fold. A surface there could only ever be
 *  the final state, faded in after the chain lands.
 *
 * ---------------------------------------------------------------------
 *  THE FRAME. This is the trap bake-quaternary.js documents at length,
 *  and it applies identically here: hemoglobin-lab and its data files
 *  live in a frame that FoldLib.orient() solved from chain B, which is a
 *  property of the bake and not of the PDB. A surface baked in the
 *  crystal's own frame would be the right shape in the wrong orientation
 *  — a mesh floating beside its own ribbon, which reads as a bug in the
 *  surface code rather than as a missing rotation. So the rotation is
 *  re-derived here exactly the way that file does it.
 *
 * ---------------------------------------------------------------------
 *  WHICH ATOMS ARE THE MOLECULE
 * ---------------------------------------------------------------------
 *  Protein atoms, plus the four hemes. The heme is a prosthetic group —
 *  covalently held in the pocket and present in every copy of the
 *  molecule — so leaving it out would open four holes in the surface at
 *  exactly the sites the lesson cares about.
 *
 *  Waters are excluded, which is what makes this a SOLVENT-excluded
 *  surface rather than a surface around a protein-and-its-solvent blob:
 *  the probe IS the water, so ordered waters modelled by the
 *  crystallographers must not also be obstacles. 2HHB's two phosphates
 *  are excluded on the same ground — a bound ligand is not the protein,
 *  and this page is not making a claim about them.
 *
 *  No hydrogens: 2HHB is X-ray and deposits none. Heavy-atom SES is the
 *  universal default (every viewer in viewer-compare.html does the same)
 *  and Bondi's heavy-atom radii already absorb the attached H's, which
 *  is why they are larger than covalent radii.
 *
 * ---------------------------------------------------------------------
 *  WHAT A VERTEX REMEMBERS, AND WHY IT IS THE POINT
 * ---------------------------------------------------------------------
 *  Every vertex carries the index of the residue whose atom is nearest.
 *  That one uint16 per vertex — 5% of the file — is what turns the
 *  surface from decoration into a lesson. It lets the page paint
 *  hydrophobicity onto the skin (SickleLib.colour already owns the
 *  Kyte-Doolittle scale), and it makes the beta6 Glu->Val switch a
 *  COLOUR-ATTRIBUTE swap on unchanged geometry, which is precisely the
 *  scientific claim: the fold does not move, one patch of the surface
 *  stops liking water.
 *
 *  Nearest by SURFACE distance (|x - centre| - radius), not by centre
 *  distance. A sulphur's skin can be nearer than a neighbouring
 *  carbon's centre, and it is the skin the vertex is sitting on.
 *
 * ---------------------------------------------------------------------
 *  FILE FORMAT — magic, a JSON header, then four blocks
 * ---------------------------------------------------------------------
 *      'SES1'                       4 bytes
 *      headerLen                    uint32
 *      header                       JSON, zero-padded to a 4-byte edge
 *      position                     uint16 x 3 x nVert   (quantised)
 *      normal                       int8   x 4 x nVert   (3 + 1 pad)
 *      residue                      uint16 x nVert
 *      index                        uint16 or uint32 x 3 x nTri
 *
 *  The index block is the file — over half of it — so its width is
 *  chosen from the vertex count and recorded in the header as
 *  `indexBits`. 2HHB at 0.5 A needs 32 bits and at 0.7 A does not, and
 *  that single fact is most of the reason 0.7 is the default: it is the
 *  finest grid that still fits a uint16, so the step from 0.7 to 0.5
 *  costs 2.9x the bytes for 0.04 A of accuracy nothing can see through a
 *  translucent skin. Both widths are read the same way in the page,
 *  which is why this is worth doing rather than forcing 32 everywhere.
 *
 *  A JSON header rather than a fixed struct, for the reason
 *  bake-quaternary.js gives for using JSON outright: one decoder, and
 *  the metadata can grow without a second one falling out of step. The
 *  bulk stays binary because 5-figure vertex counts genuinely need it.
 *
 *  Positions are uint16 over the mesh's own bounding box, which puts the
 *  quantum at about 0.001 A — three orders below the grid's own error,
 *  so the quantisation is not the thing limiting accuracy. Normals are
 *  int8 and get renormalised on the GPU; the ~0.5 degree that costs is
 *  invisible on a translucent surface.
 *
 *  The 4-byte pad on the normal is not waste. Typed-array views into an
 *  ArrayBuffer must be aligned to their element size, so every block
 *  starting on a 4-byte edge is what lets the page make views with no
 *  copy at all.
 *
 *  Run:  node hemoglobin/tools/bake-surface.js [--spacing 0.5]
 * ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const SES = require('../../tools/ses.js');
const FoldLib = require('../../folding/folding.js');
const { extract } = require('./chain.js');
const { CHAIN } = require('./bake-hb.js');

const HERE = path.join(__dirname, '..');
const SRC = path.join(HERE, 'data', '2HHB.pdb');
const OUT = path.join(HERE, 'data', '2HHB.surf.bin');

/* Default 0.7 A, and it is a FILE SIZE decision as much as an accuracy
   one — see `indexBits` in the format notes above. tools/ses.js measures
   its own grid bias against an analytic sphere at ~0.13 x spacing, so
   this surface sits about 0.09 A proud of the true one: below 2HHB's own
   1.74 A resolution, and an order below the 1.4 A probe whose choice is
   the real modelling assumption here. Triangles go as spacing^-2, so
   halving the grid quadruples the file for accuracy no one can see. */
const SPACING = 0.7;

const KEEP_HET = new Set(['HEM']);        // see "which atoms are the molecule"

function rotation() {
  const parsed = FoldLib.parse(extract(fs.readFileSync(SRC, 'utf8'), CHAIN).text, {});
  FoldLib.orient(parsed);
  return parsed.orientation;              // rows of a det=+1 rotation matrix
}
const apply = (R, p) => R.map(ax => ax[0] * p[0] + ax[1] * p[1] + ax[2] * p[2]);

/* Every atom of the molecule, in the trajectory's frame, tagged with the
   residue it belongs to. Residues are numbered in file order, which is
   the order the page's own tables will use. */
function readAtoms(raw, R) {
  const atoms = [], residues = [];
  const seen = new Map();
  const skipped = new Map();

  for (const line of raw.split('\n')) {
    const het = line.startsWith('HETATM');
    if (!het && !line.startsWith('ATOM')) continue;
    const resName = line.slice(17, 20).trim();
    if (het && !KEEP_HET.has(resName)) {
      skipped.set(resName, (skipped.get(resName) || 0) + 1);
      continue;
    }
    /* Altlocs: take blank or 'A' only, else the surface is built around
       two copies of the same side chain at once. */
    const alt = line[16];
    if (alt !== ' ' && alt !== 'A') continue;

    const chain = line[21], num = +line.slice(22, 26);
    const key = chain + ':' + num + ':' + resName;
    let ri = seen.get(key);
    if (ri === undefined) {
      ri = residues.length;
      residues.push({ chain, num, name: resName, het });
      seen.set(key, ri);
    }
    const el = line.slice(76, 78).trim() || line.slice(12, 14).trim()[0];
    atoms.push({
      p: apply(R, [+line.slice(30, 38), +line.slice(38, 46), +line.slice(46, 54)]),
      r: SES.radiusOf(el),
      res: ri,
    });
  }
  if (residues.length > 65535) throw new Error('more residues than a uint16 can index');
  return { atoms, residues, skipped };
}

/* Nearest residue per vertex. A uniform bin grid rather than a k-d tree:
   the atoms are a solid blob at roughly constant density, which is the
   one case where bins are both simpler and faster. Bin edge is set from
   the largest radius so a single ring of neighbours always suffices. */
function tagResidues(mesh, atoms) {
  const B = 2 * (Math.max(...atoms.map(a => a.r)) + 2.0);
  const lo = [Infinity, Infinity, Infinity];
  for (const a of atoms) for (let c = 0; c < 3; c++) lo[c] = Math.min(lo[c], a.p[c]);
  const bins = new Map();
  const key = (i, j, k) => i + ',' + j + ',' + k;
  const cell = p => [0,1,2].map(c => Math.floor((p[c] - lo[c]) / B));
  for (const a of atoms) {
    const k = key(...cell(a.p));
    let b = bins.get(k); if (!b) bins.set(k, b = []);
    b.push(a);
  }

  const out = new Uint16Array(mesh.nVert);
  const P = mesh.position;
  for (let v = 0; v < mesh.nVert; v++) {
    const p = [P[v*3], P[v*3+1], P[v*3+2]];
    const [ci, cj, ck] = cell(p);
    let best = Infinity, bestRes = -1;
    for (let r = 1; r <= 3 && bestRes < 0; r++) {          // widen if empty
      for (let i = ci-r; i <= ci+r; i++)
      for (let j = cj-r; j <= cj+r; j++)
      for (let k = ck-r; k <= ck+r; k++) {
        const b = bins.get(key(i, j, k)); if (!b) continue;
        for (const a of b) {
          /* SURFACE distance, not centre distance — see the header. */
          const d = Math.hypot(p[0]-a.p[0], p[1]-a.p[1], p[2]-a.p[2]) - a.r;
          if (d < best) { best = d; bestRes = a.res; }
        }
      }
    }
    if (bestRes < 0) throw new Error('vertex with no atom within three bins');
    out[v] = bestRes;
  }
  return out;
}

function encode(mesh, resIdx, residues, meta) {
  const n = mesh.nVert, t = mesh.nTri;
  const P = mesh.position;

  /* Quantise over the mesh's own box, per axis. */
  const qmin = [Infinity, Infinity, Infinity], qmax = [-Infinity, -Infinity, -Infinity];
  for (let v = 0; v < n; v++) for (let c = 0; c < 3; c++) {
    if (P[v*3+c] < qmin[c]) qmin[c] = P[v*3+c];
    if (P[v*3+c] > qmax[c]) qmax[c] = P[v*3+c];
  }
  const qscale = qmax.map((hi, c) => (hi - qmin[c]) / 65535 || 1);

  const indexBits = n <= 65536 ? 16 : 32;
  const header = Object.assign({
    source: '2HHB',
    method: 'solvent-excluded surface, tools/ses.js (grid EDT + marching cubes)',
    nVert: n, nTri: t, indexBits,
    qmin, qscale,
    residues: residues.map(r => [r.chain, r.num, r.name]),
  }, meta);
  const hj = Buffer.from(JSON.stringify(header), 'utf8');
  const hpad = (4 - (hj.length % 4)) % 4;

  const off = { head: 8 + hj.length + hpad };
  off.pos = off.head;
  off.nrm = off.pos + n * 6;
  off.res = off.nrm + n * 4;
  off.idx = off.res + n * 2;
  const total = off.idx + t * 3 * (indexBits / 8);

  const buf = Buffer.alloc(total);
  buf.write('SES1', 0, 'ascii');
  buf.writeUInt32LE(hj.length, 4);
  hj.copy(buf, 8);

  const pos = new Uint16Array(buf.buffer, buf.byteOffset + off.pos, n * 3);
  for (let v = 0; v < n; v++) for (let c = 0; c < 3; c++)
    pos[v*3+c] = Math.round((P[v*3+c] - qmin[c]) / qscale[c]);

  const nrm = new Int8Array(buf.buffer, buf.byteOffset + off.nrm, n * 4);
  for (let v = 0; v < n; v++) for (let c = 0; c < 3; c++)
    nrm[v*4+c] = Math.max(-127, Math.min(127, Math.round(mesh.normal[v*3+c] * 127)));

  new Uint16Array(buf.buffer, buf.byteOffset + off.res, n).set(resIdx);
  const IA = indexBits === 16 ? Uint16Array : Uint32Array;
  new IA(buf.buffer, buf.byteOffset + off.idx, t * 3).set(mesh.index);
  return buf;
}

/* -------------------------------------------------------------------- */

function main() {
  const argSpacing = process.argv.indexOf('--spacing');
  const spacing = argSpacing > 0 ? +process.argv[argSpacing + 1] : SPACING;

  const raw = fs.readFileSync(SRC, 'utf8');
  const R = rotation();
  const { atoms, residues, skipped } = readAtoms(raw, R);
  console.log(`2HHB: ${atoms.length} atoms over ${residues.length} residues`);
  console.log(`      excluded: ${[...skipped].map(([k, v]) => `${k} x${v}`).join(', ') || 'none'}`);

  let t0 = Date.now();
  const mesh = SES.build(atoms, { spacing, probe: SES.PROBE });
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  const { volume, area } = SES.measure(mesh);
  const wt = SES.watertight(mesh);
  console.log(`      grid ${mesh.dims.join(' x ')} at ${spacing} A` +
              `  ->  ${mesh.nVert} verts, ${mesh.nTri} tris in ${secs}s`);
  console.log(`      area ${area.toFixed(0)} A^2, volume ${volume.toFixed(0)} A^3`);
  if (!wt.ok) throw new Error(`mesh is not closed: ${wt.bad} unpaired edges`);
  if (volume <= 0) throw new Error('mesh is inside out');

  const resIdx = tagResidues(mesh, atoms);
  const buf = encode(mesh, resIdx, residues, {
    spacing, probe: SES.PROBE, radii: 'Bondi 1964 (N: Rowland & Taylor 1996)',
    atoms: atoms.length, area: +area.toFixed(1), volume: +volume.toFixed(1),
    note: 'oriented by FoldLib.orient() from chain B, matching 2HHB-B.fold.bin',
  });
  fs.writeFileSync(OUT, buf);
  console.log(`      wrote ${path.relative(process.cwd(), OUT)}` +
              `  ${(buf.length / 1024).toFixed(0)} KB`);
}

if (require.main === module) main();
module.exports = { readAtoms, rotation, tagResidues, SPACING };
