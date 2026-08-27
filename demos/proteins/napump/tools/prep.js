#!/usr/bin/env node
/* =====================================================================
 *  prep.js — the sodium-potassium pump, both states, in the membrane's
 *  own frame.
 *
 *  Run:  node proteins/napump/tools/prep.js    (offline, no dependencies)
 *
 *  TWO STRUCTURES, ONE CYCLE. 7E1Z is E1 with three sodiums bound and the
 *  site open to the inside; 7E20 is E2 with two potassiums and the site
 *  open to the outside. The pump spends one ATP to go from the first to
 *  the second and back, and that is the lesson these two files can carry:
 *  the same protein, the same subunits, a different door open.
 *
 *  BAKED FROM THE OPM COPY, NOT THE DEPOSITION, and this is the whole
 *  reason the raw files are worth keeping. A membrane protein has a frame
 *  the field agrees on — the bilayer normal on z, the membrane centred on
 *  zero — and the deposition is in none of it. OPM solves that orientation
 *  and republishes the coordinates in it.
 *
 *  NOTHING IS SUPERPOSED, because both are already in that one frame, and
 *  a fit would trade the membrane for an arbitrary alignment of one state
 *  onto the other — which is the single comparison this pair is not about.
 *
 *  THE VIEW PUTS THE NORMAL UPRIGHT, which is the same kind of decision
 *  the prion baker makes for a fibril: the field draws a membrane protein
 *  standing in a horizontal bilayer, so the basis is solved from the axis
 *  rather than from the molecule's own extents. PCA would lay this thing
 *  on its side — it is wider across the cytoplasmic head than it is tall —
 *  and a pump on its side is a picture with the membrane edge-on and the
 *  inside and outside nowhere.
 *
 *  THE BILAYER RIDES ALONG. OPM states the half-thickness it solved in a
 *  REMARK — 15.3 Å for 7E1Z, 15.4 Å for 7E20 — and the bench draws the
 *  two leaflet planes from it, so a reader can see which part of the
 *  protein is IN the membrane rather than being told. Read from the
 *  remark rather than measured off the DUM atoms, because the remark is
 *  the number OPM reports and the dummies are its drawing of it.
 *
 *  DUM ATOMS ARE NOT PROTEIN. OPM appends thousands of them to mark the
 *  leaflet surfaces; they are HETATM, so a Cα trace never sees one, and
 *  the ligand reader skips them by name here.
 *
 *  SOURCES, for a re-run. The raw files are ~4 MB against the ~110 KB
 *  this bakes out of them, and they are committed because two tools read
 *  them — this one and `membrane/tools/bake-pump.js`:
 *
 *    https://files.rcsb.org/download/7E1Z.pdb     (the deposition)
 *    https://opm-assets.storage.googleapis.com/pdb/7e1z.pdb   (oriented)
 *    …and the same pair for 7E20.
 * ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const Bake = require('../../bake-lib.js');
const FoldLib = require('../../../folding/folding.js');
const IO = require('../../tools/registry-io.js');
const REG = require('../../proteins.js');

const HERE = path.join(__dirname, '..');
const SRC = path.join(HERE, 'data', 'src');
const DATA = path.join(HERE, 'data');
const ME = REG.byKey('napump');

/* OPM's own statement of the bilayer it solved, in ångströms from the
   middle to one leaflet. Null if the file is not an OPM copy, which is
   how a bench knows not to draw a membrane it does not have. */
function halfThickness(text) {
  const line = text.split('\n').find(l =>
    l.startsWith('REMARK') && l.includes('1/2 of bilayer thickness'));
  if (!line) return null;
  const m = line.match(/([\d.]+)\s*$/);
  return m ? +m[1] : null;
}

function bake(v) {
  /* The oriented copy is what is baked; the deposition beside it is kept
     for anything that needs the crystallographers' own frame. */
  const text = fs.readFileSync(path.join(SRC, `${v.source.id}-opm.pdb`), 'utf8');
  const chains = Bake.caTrace(text, null);
  if (!chains.size) throw new Error(v.id + ': no CA atoms');
  const R = Bake.ssRanges(text);

  /* Centred on the trace like every other bake — the box frames what it is
     given — and the membrane's own zero goes with it, so the leaflet planes
     the panel draws are shifted by the same amount. */
  const T = Bake.assemble(chains, R);

  const out = { source: `${v.source.id}-opm.pdb`, ssFrom: Bake.ssFrom(R),
                centre: T.centre, order: T.order, chains: T.chains,
                radius: T.radius };

  const all = [];
  for (const id of out.order) for (const p of out.chains[id].CA) all.push(p);
  const V = Bake.frameOf(all);
  out.extents = V.extents;
  /* Membrane normal upright, with the molecule's own longest axis as the hint
     that fixes the remaining spin about it. OPM put the normal on z, so that
     is the axis handed over — this script never solves which way is up, it
     reads it. */
  out.view = FoldLib.basisFrom([0, 0, 1], (V.view || [[1, 0, 0]])[0])
    .map(ax => ax.map(v => Math.round(v * 1e4) / 1e4));
  out.frame = 'membrane convention, on OPM\'s normal';

  const half = halfThickness(text);
  const decl = Bake.declared(text);
  out.meta = {
    entry: v.source.id,
    method: Bake.method(text), resolution: Bake.resolution(text),
    title: Bake.line1(text, 'TITLE'),
    chainsInFile: Bake.chainCount(text),
    counts: out.order.map(id => ({ chain: id, modelled: out.chains[id].nums.length,
                                   declared: decl[id] === undefined ? null : decl[id] })),
    /* The bilayer, in the bake's own centred coordinates: two planes at
       ±half around the membrane's middle, which the centring moved by
       `centre[1]`… except that OPM puts the normal on Z, so it is the Z
       component that shifts. A page drawing these has to use the same axis
       the file was oriented on, and that axis is Z by OPM's convention. */
    membrane: half === null ? null
      : { half, axis: 'z', mid: -T.centre[2] },
    /* What is bound in this state, minus OPM's bilayer dummies: three
       sodiums in E1, two potassiums in E2, and the magnesium that comes
       with the ATP either way. */
    ligands: Bake.ligands(text, null).filter(l => !l.startsWith('DUM')),
  };
  out.read = {
    method: out.meta.method,
    chainsInFile: out.meta.chainsInFile,
    residues: out.meta.counts.reduce((k, c) => k + c.modelled, 0),
    declared: out.meta.counts.every(c => c.declared !== null)
      ? out.meta.counts.reduce((k, c) => k + c.declared, 0) : null,
    ec: Bake.ecNumbers(text)[0] || null,
    baked: `pump-${v.id}.json`,
  };
  return out;
}

function main() {
  const blocks = {};
  for (const v of ME.variants) {
    const out = bake(v);
    const { read, ...bakeOut } = out;
    fs.writeFileSync(path.join(DATA, read.baked), JSON.stringify(bakeOut));
    blocks[v.id] = read;
    const kb = (fs.statSync(path.join(DATA, read.baked)).size / 1024).toFixed(0);
    const m = out.meta;
    console.log(`${v.id}  ${out.order.length} chains, ${read.residues} residues, ` +
      `ss ${out.ssFrom}, ${out.extents.join(' × ')} A, ` +
      `bilayer ±${m.membrane ? m.membrane.half : '?'} A, ` +
      `bound [${m.ligands.join(' ')}], ${kb} KB`);
  }
  const touched = IO.write('napump', blocks);
  console.log(`registry  proteins.js  ${touched.length} variants updated`);
}

if (require.main === module) main();
module.exports = { bake, halfThickness };
