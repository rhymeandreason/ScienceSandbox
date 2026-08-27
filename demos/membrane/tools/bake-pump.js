#!/usr/bin/env node
/* =====================================================================
 *  bake-pump.js — the sodium pump's two ends, as two surfaces in ONE frame.
 *
 *  7E1Z -> membrane/data/7E1Z.surf.bin      E1.3Na, inward-open
 *  7E20 -> membrane/data/7E20.surf.bin      E2.2K,  outward-open
 *
 *  The algorithm is tools/ses.js and its reasoning lives there; the
 *  format is hemoglobin/tools/bake-surface.js and is specified in that
 *  file's header, next to the writer that owns it. This file is the
 *  pump-specific half, and it makes exactly three decisions.
 *
 * ---------------------------------------------------------------------
 *  DECISION 1: THE IONS ARE NOT PART OF THE SURFACE
 * ---------------------------------------------------------------------
 *  This is the one that would quietly ruin the lesson. 7E1Z has 4 Na and
 *  a Mg; 7E20 has 3 K and a Mg. They sit in the binding sites — which is
 *  to say, they sit exactly where the cavity the student is meant to
 *  look into is. Feed them to the SES and the probe cannot enter, the
 *  cavity closes around them, and the surface says the site is SOLID.
 *  The page would then draw an ion sphere inside a pocket that the
 *  surface claims is filled: two objects occupying one space, and the
 *  student's correct reading of that image is that we do not know what
 *  we are drawing.
 *
 *  So the ions are cargo, not structure. They come out of the surface
 *  and are handed to the page as coordinates, in the same frame, to be
 *  drawn as the molecules they are.
 *
 *  Everything else HETATM goes too, and for a weaker but sufficient
 *  reason: the cholesterol hemisuccinate and phosphatidylcholine are the
 *  nanodisc the protein was solved in, not the protein, and the NAG is a
 *  glycan stub. A surface built around the lipids would be a surface
 *  around the detergent belt — a fat collar at exactly the membrane
 *  height, which is where this lesson draws its own bilayer.
 *
 * ---------------------------------------------------------------------
 *  DECISION 2: ONE FRAME, AND IT IS THE MEMBRANE'S — LITERALLY
 * ---------------------------------------------------------------------
 *  Two surfaces baked in their own deposited frames are two objects in
 *  arbitrary orientations. Cross-fade them and the protein appears to
 *  tumble; the student reads "it spun", which is the one thing that did
 *  NOT happen. And a deposited frame has no idea where the bilayer is,
 *  so the pump lands on its side — which is how the first bake rendered,
 *  and it was unreadable against every textbook picture of a membrane
 *  protein ever drawn.
 *
 *  TWO SEPARATE PROBLEMS, TWO SEPARATE SOURCES.
 *
 *  Where is the membrane?  OPM (Orientations of Proteins in Membranes,
 *  Lomize et al.), which solves bilayer position by minimising transfer
 *  energy in an anisotropic solvent model and republishes the structure
 *  already rotated: normal on z, leaflets marked by DUM atoms, half
 *  thickness in a REMARK. 7E1Z gives 15.3 A and 7E20 gives 15.4 A —
 *  independently computed, agreeing to 0.1 A, which is the cross-check
 *  that makes it trustworthy rather than merely convenient.
 *
 *  The nanodisc lipids in the deposited files were tried first and are
 *  NOT good enough: 264 atoms of cholesterol hemisuccinate at scattered
 *  ordered sites give a widest/thinnest ratio of only 2.2 and no
 *  two-leaflet profile along the normal. They are a sparse belt, not a
 *  modelled bilayer. Do not be tempted back to them.
 *
 *  Which way is up?  The beta subunit's big domain is extracellular by
 *  definition, and it sits at mean z +36 with 2026 atoms beyond the
 *  outer leaflet, while the alpha headpiece sits at mean z -36. Both
 *  structures agree. So +z is outside, -z is cytoplasm, and this is read
 *  off the structure rather than assumed from OPM's convention.
 *
 *  Then z is rotated onto +Y, because the page is a scene and up is y:
 *  outside is up, cytoplasm is down, exactly as every membrane diagram
 *  a student has ever seen draws it.
 *
 *  Relating the two STATES is still a fit, and still not a whole-molecule
 *  one: fitting all 976 shared CA splits the difference across a 99 deg
 *  domain tilt, so everything moves a little and nothing is still. The
 *  headpiece swings against a membrane domain that is held in the
 *  bilayer, so ITERATED CORE FITTING finds what genuinely does not move.
 *  What it converges on is PRINTED rather than assumed — and it lands on
 *  M7-M10 plus both accessory subunits, which is the membrane anchor,
 *  agreeing with OPM without having been told about it.
 *
 * ---------------------------------------------------------------------
 *  DECISION 3: SPACING, AND WHY IT IS NOT 0.7
 * ---------------------------------------------------------------------
 *  hemoglobin's bake defaults to 0.7 A because that is the finest grid
 *  whose vertex count still fits a uint16 index, and stepping to 0.5
 *  costs 2.9x the bytes. This molecule is bigger than haemoglobin and
 *  will blow past uint16 at any spacing worth using, so that particular
 *  bargain is already lost and the format simply writes uint32 indices.
 *  Freed of it, 0.7 is kept anyway: ses.js's grid bias is ~0.13 x
 *  spacing, so ~0.09 A, which is far below 7E1Z's own 3.2 A resolution.
 *  A finer grid here would be resolving detail the STRUCTURE does not
 *  have, and paying for it by the square.
 *
 *  Run:  node membrane/tools/bake-pump.js [--spacing 0.7]
 * ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const SES = require('../../tools/ses.js');
const ActinLib = require('../../folding/actin.js');   // fit() — Kabsch, shared not copied

const HERE = path.join(__dirname, '..');
const DATA = path.join(HERE, 'data');

/* THE PDBs MOVED. Both structures are the sodium pump, and the pump became a
   protein the repo HOLDS rather than one this lesson borrowed: they live in
   `proteins/napump/data/src/` now, indexed in `proteins/proteins.js` with a
   bench of their own. This baker still reads them from there — same files,
   same four names — and writes its surfaces here, because a surface cut for
   this lesson's camera is this lesson's artefact and not the collection's. */
const SRC = path.join(HERE, '..', 'proteins', 'napump', 'data', 'src');

/* The OPM re-releases, not the deposited files: same atoms, rigidly
   rotated so the bilayer normal is z. The deposited PDBs stay beside them
   as provenance and are what a re-download would check against. */
const REF = '7E1Z';                 // E1.3Na — the frame everything lands in
const MOV = '7E20';                 // E2.2K
const srcOf = id => id + '-opm.pdb';

/* z (OPM's normal) onto +Y (the scene's up). A -90 deg turn about x:
   (x,y,z) -> (x, z, -y). det = +1, so no molecule is mirrored — which
   MolecularGeometry.md 1.3 would otherwise have something to say about. */
const UP = p => [p[0], p[2], -p[1]];

const SPACING = 0.7;

/* The cargo. Named by PDB residue name, which for a bare ion is the
   element. MG is catalytic rather than transported, but it is still an
   ion sitting in a site and still must not be welded into the skin. */
const CARGO = new Set(['NA', 'K', 'MG']);

/* ---- parsing ------------------------------------------------------- */

function parse(id) {
  const raw = fs.readFileSync(path.join(SRC, srcOf(id)), 'utf8');
  const atoms = [], residues = [], cargo = [], ca = new Map();
  const seen = new Map(), dropped = new Map();
  let half = null;

  for (const line of raw.split('\n')) {
    /* OPM states the bilayer it solved in a REMARK. Read it rather than
       measuring the DUM atoms: the remark is the number OPM reports, and
       a number the page prints must come from where the fact lives. */
    if (line.startsWith('REMARK') && line.includes('1/2 of bilayer'))
      half = parseFloat(line.slice(40));

    const het = line.startsWith('HETATM');
    if (!het && !line.startsWith('ATOM')) continue;

    const resName = line.slice(17, 20).trim();
    /* Straight into scene orientation: everything downstream — the fit,
       the SES, the cargo, the plane the page cuts with — is then in one
       frame with up as up, and nothing has to remember to convert. */
    const p = UP([+line.slice(30, 38), +line.slice(38, 46), +line.slice(46, 54)]);

    if (het) {
      /* DUM is OPM's bilayer marker, not an atom. It must never reach
         the SES — a plane of dummy atoms would bake a slab. */
      if (resName === 'DUM') continue;
      if (CARGO.has(resName)) cargo.push({ name: resName, p, chain: line[21] });
      else dropped.set(resName, (dropped.get(resName) || 0) + 1);
      continue;                                       // see DECISION 1
    }

    /* Altlocs: blank or 'A' only, else the surface is built around two
       copies of one side chain at once. */
    const alt = line[16];
    if (alt !== ' ' && alt !== 'A') continue;

    const chain = line[21], num = +line.slice(22, 26);
    const key = chain + ':' + num;
    let ri = seen.get(key);
    if (ri === undefined) {
      ri = residues.length;
      residues.push({ chain, num, name: resName });
      seen.set(key, ri);
    }
    const el = line.slice(76, 78).trim() || line.slice(12, 14).trim()[0];
    atoms.push({ p, r: SES.radiusOf(el), res: ri });

    if (line.slice(12, 16).trim() === 'CA') ca.set(key, p);
  }
  if (half == null) throw new Error(`${id}: no bilayer REMARK in ${srcOf(id)} — ` +
                                    `is this an OPM re-release or the deposited file?`);
  return { id, atoms, residues, cargo, ca, dropped, half };
}

/* Sidedness, checked rather than assumed. The beta ectodomain is
   extracellular by definition, so it must end up ABOVE the bilayer once
   z is on +y; the alpha headpiece must end up below. If these ever come
   out the other way round the whole lesson is upside down, and every
   caption about "out" and "in" silently inverts. */
function checkSides(S) {
  const meanY = ch => {
    const v = S.atoms.filter(a => S.residues[a.res].chain === ch).map(a => a.p[1]);
    return v.reduce((s, y) => s + y, 0) / v.length;
  };
  const beta = meanY('B'), alpha = meanY('A');
  if (!(beta > S.half && alpha < -S.half))
    throw new Error(`${S.id}: sidedness wrong — beta ectodomain at y ${beta.toFixed(0)}, ` +
                    `alpha headpiece at y ${alpha.toFixed(0)}, bilayer +-${S.half}. ` +
                    `Outside must be +y.`);
  return { beta, alpha };
}

/* ---- the common frame ---------------------------------------------- */

/* Iterated core fit, by PROGRESSIVE TRIMMING rather than by a fixed
   cutoff — and the difference is the whole function.

   A fixed cutoff cannot bootstrap. The first fit is the global one, which
   is bad by construction (it averages a 99 degree domain tilt across the
   whole molecule), so under it almost NOTHING is within 1.5 A and the
   first trim throws the core away along with the moving parts. The
   earlier version of this then hit its own "too few points" guard,
   fell back to the global fit, and reported a 1302-residue core with a
   9.99 A RMSD — a contradiction on the face of it, printed without
   complaint, and baked into two surfaces.

   So each round keeps the best `frac` of the current set instead. That
   is a rank statistic: it cannot overshoot, because it always keeps
   something, and it walks the frame downhill toward whichever
   substructure is genuinely rigid. Only once it has converged is the
   fixed cutoff applied, as a REPORT of what the core turned out to be.

   The guard now throws. A bad frame is not a thing to continue past. */
function coreFit(ref, mov, cut) {
  const shared = [...ref.ca.keys()].filter(k => mov.ca.has(k));
  const all = shared.length;
  const FRAC = 0.75, ROUNDS = 14, FLOOR = 120;

  let keys = shared.slice();
  let R = null, t = null, dev = null;

  const devsUnder = (R, t) => {
    const d = new Map();
    for (const k of shared) {
      const q = apply(R, t, mov.ca.get(k)), r = ref.ca.get(k);
      d.set(k, Math.hypot(q[0]-r[0], q[1]-r[1], q[2]-r[2]));
    }
    return d;
  };

  for (let round = 0; round < ROUNDS; round++) {
    ({ R, t } = ActinLib.fit(keys.map(k => mov.ca.get(k)),
                            keys.map(k => ref.ca.get(k))));
    /* Score EVERY shared residue, not just the current core — a residue
       trimmed early must be able to return once the frame improves. */
    dev = devsUnder(R, t);

    const ranked = shared.slice().sort((a, b) => dev.get(a) - dev.get(b));
    const want = Math.max(FLOOR, Math.floor(keys.length * FRAC));
    if (want >= keys.length) break;                 // converged: nothing left to drop
    keys = ranked.slice(0, want);
  }

  /* Final frame from the converged set, then the core is REPORTED as
     whatever is actually within `cut` of it. */
  ({ R, t } = ActinLib.fit(keys.map(k => mov.ca.get(k)),
                          keys.map(k => ref.ca.get(k))));
  dev = devsUnder(R, t);
  const core = shared.filter(k => dev.get(k) <= cut);

  if (core.length < FLOOR)
    throw new Error(`core fit found only ${core.length} residues within ${cut} A. ` +
                    `These two structures have no rigid substructure in common, ` +
                    `which for two states of one construct means something is wrong ` +
                    `with the parse, not with the biology.`);

  const rms = Math.sqrt(core.reduce((s, k) => s + dev.get(k)**2, 0) / core.length);
  if (rms > cut)
    throw new Error(`core RMSD ${rms.toFixed(2)} A exceeds the ${cut} A cutoff it was ` +
                    `selected by — the fit did not converge.`);

  return { R, t, core, dev, all, rms };
}

const apply = (R, t, p) => [0,1,2].map(i =>
  R[i][0]*p[0] + R[i][1]*p[1] + R[i][2]*p[2] + t[i]);

/* Contiguous runs of residue numbers, per chain — the readable form of a
   core. "A 76-130, A 760-1010" is checkable against where the TM helices
   are; a list of 600 numbers is not. */
function runs(keys, minRun) {
  const byChain = new Map();
  for (const k of keys) {
    const [ch, n] = k.split(':');
    if (!byChain.has(ch)) byChain.set(ch, []);
    byChain.get(ch).push(+n);
  }
  const out = [];
  for (const [ch, nums] of [...byChain].sort()) {
    nums.sort((a, b) => a - b);
    let s = nums[0], p = nums[0];
    for (let i = 1; i <= nums.length; i++) {
      const n = nums[i];
      if (n !== p + 1) {
        if (p - s + 1 >= minRun) out.push(`${ch} ${s}-${p}`);
        s = n;
      }
      p = n;
    }
  }
  return out;
}

/* ---- encode (SES1, the format bake-surface.js specifies) ------------ */

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
    for (let r = 1; r <= 3 && bestRes < 0; r++) {
      for (let i = ci-r; i <= ci+r; i++)
      for (let j = cj-r; j <= cj+r; j++)
      for (let k = ck-r; k <= ck+r; k++) {
        const b = bins.get(key(i, j, k)); if (!b) continue;
        for (const a of b) {
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
  const n = mesh.nVert, t = mesh.nTri, P = mesh.position;
  const qmin = [Infinity, Infinity, Infinity], qmax = [-Infinity, -Infinity, -Infinity];
  for (let v = 0; v < n; v++) for (let c = 0; c < 3; c++) {
    if (P[v*3+c] < qmin[c]) qmin[c] = P[v*3+c];
    if (P[v*3+c] > qmax[c]) qmax[c] = P[v*3+c];
  }
  const qscale = qmax.map((hi, c) => (hi - qmin[c]) / 65535 || 1);
  const indexBits = n <= 65536 ? 16 : 32;

  const header = Object.assign({
    method: 'solvent-excluded surface, tools/ses.js (grid EDT + marching cubes)',
    nVert: n, nTri: t, indexBits, qmin, qscale,
    residues: residues.map(r => [r.chain, r.num, r.name]),
  }, meta);
  const hj = Buffer.from(JSON.stringify(header), 'utf8');
  const hpad = (4 - (hj.length % 4)) % 4;

  const off = { head: 8 + hj.length + hpad };
  off.pos = off.head;
  off.nrm = off.pos + n * 6;
  off.res = off.nrm + n * 4;
  off.idx = off.res + n * 2;

  const buf = Buffer.alloc(off.idx + t * 3 * (indexBits / 8));
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
  const i = process.argv.indexOf('--spacing');
  const spacing = i > 0 ? +process.argv[i + 1] : SPACING;

  const ref = parse(REF), mov = parse(MOV);
  for (const S of [ref, mov]) {
    const sides = checkSides(S);
    console.log(`${S.id}: ${S.atoms.length} atoms over ${S.residues.length} residues, ` +
                `${S.cargo.length} ions (${S.cargo.map(c => c.name).join(' ')})\n` +
                `      not surface: ${[...S.dropped].map(([k,v]) => `${k} x${v}`).join(', ') || 'none'}\n` +
                `      bilayer +-${S.half} A (OPM); beta ectodomain y ${sides.beta.toFixed(0)} (out), ` +
                `alpha headpiece y ${sides.alpha.toFixed(0)} (in)`);
  }

  /* ---- the common frame ---- */
  const CUT = 1.5;                  // A. A residue further than this has moved.
  const F = coreFit(ref, mov, CUT);
  const moved = [...F.dev.values()].filter(d => d > CUT).length;

  console.log(`\ncommon frame: fitted ${MOV} onto ${REF} over an iterated core`);
  console.log(`      core ${F.core.length}/${F.all} CA at <= ${CUT} A, RMSD ${F.rms.toFixed(2)} A`);
  console.log(`      ${moved} residues moved further and were excluded`);
  console.log(`      core runs (>=8 residues):`);
  for (const r of runs(F.core, 8)) console.log(`        ${r}`);
  const big = [...F.dev.entries()].sort((a,b) => b[1]-a[1])[0];
  console.log(`      largest displacement: ${big[0]} at ${big[1].toFixed(1)} A`);

  /* Move MOV's atoms and ions into REF's frame. REF itself is untouched:
     it IS the frame, so it keeps deposited coordinates and anything else
     baked later can be brought to it the same way. */
  for (const a of mov.atoms) a.p = apply(F.R, F.t, a.p);
  for (const c of mov.cargo) c.p = apply(F.R, F.t, c.p);

  /* ---- bake ---- */
  const ions = {};
  for (const S of [ref, mov]) {
    console.log(`\n${S.id}: building SES at ${spacing} A ...`);
    const t0 = Date.now();
    const mesh = SES.build(S.atoms, { spacing, probe: SES.PROBE });
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    const { volume, area } = SES.measure(mesh);
    const wt = SES.watertight(mesh);
    console.log(`      grid ${mesh.dims.join(' x ')}  ->  ${mesh.nVert} verts, ${mesh.nTri} tris in ${secs}s`);
    console.log(`      area ${area.toFixed(0)} A^2, volume ${volume.toFixed(0)} A^3`);
    console.log(`      watertight: ${wt.ok ? 'yes' : 'NO — ' + wt.bad + ' bad edges'}`);
    if (!wt.ok) throw new Error(`${S.id}: mesh is not closed; clip.js caps by parity and needs it closed`);

    const resIdx = tagResidues(mesh, S.atoms);
    const buf = encode(mesh, resIdx, S.residues, {
      source: S.id,
      state: S.id === REF ? 'E1.3Na (inward-open)' : 'E2.2K (outward-open)',
      frame: `OPM-oriented, bilayer normal on +y, outside up` +
             (S.id === REF ? '' : `; fitted onto ${REF} over ${F.core.length} core CA`),
      /* The page draws its membrane from THIS, never from a typed 30. */
      membraneHalf: S.half,
      spacing, probe: SES.PROBE,
      cargo: S.cargo.map(c => [c.name, c.p.map(v => +v.toFixed(3))]),
    });
    const out = path.join(DATA, S.id + '.surf.bin');
    fs.writeFileSync(out, buf);
    console.log(`      wrote ${path.relative(HERE, out)}  ${(buf.length/1048576).toFixed(2)} MB`);
    ions[S.id] = S.cargo;
  }

  /* The ions are in the header of each file, but say it here too — this
     is the number the lesson's own text will have to agree with. */
  console.log('\ncargo, in the common frame:');
  for (const id of [REF, MOV])
    console.log(`      ${id}: ${ions[id].map(c => c.name).join(', ')}`);
}

/* Guarded, because this baker WRITES on run: two 5.8 MB surfaces, several
   minutes of SES. An unguarded call fires on `require`, so anything that
   imports this file for one of its readers — a checker, another baker —
   pays for a full bake and leaves the output behind. */
if (require.main === module) main();
