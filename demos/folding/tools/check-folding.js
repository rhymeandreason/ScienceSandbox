#!/usr/bin/env node
/* =====================================================================
 *  check-folding.js — every claim folding-lab.html makes out loud.
 *
 *  Lives beside the code and data it audits. These assertions used to sit at
 *  the foot of tools/check-pdb.js, which had grown three jobs: pdb.js's
 *  orientation, folding-lab's chemistry, and the staleness of three baked
 *  files. Splitting them puts check-pdb.js back on its one subject and keeps
 *  everything belonging to this page in one place.
 *
 *  The claims are unusually easy to get wrong in a direction nobody notices,
 *  because a prediction renders exactly as confidently as a structure does and
 *  a stale trajectory animates exactly as smoothly as a fresh one.
 *
 *  Run:  node folding/tools/check-folding.js      (offline, no dependencies)
 * ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

/* Hoisted, unlike folding.js/villin.js/actin.js below, which are required
   inside blocks guarded on their data files existing. ribbon.js reads no
   data of its own and is now needed by both the villin section and the
   ribbon section. */
const Ribbon = require('../ribbon.js');

const HERE = path.join(__dirname, '..');          // demos/folding
const DATA = path.join(HERE, 'data');
const ROOT = path.join(HERE, '..');               // demos
let failures = 0;

const fail = (what, msg) => { console.log(`  FAIL  ${what}: ${msg}`); failures++; };
const ok   = msg => console.log(`  ok    ${msg}`);

const VII = path.join(DATA, '1VII.pdb');
const AFMODEL = path.join(DATA, 'AF-P02640-villin.pdb');
const POSES = path.join(DATA, 'AF-P02640-villin.poses.bin');
const FIL = path.join(DATA, '9ZZI.pdb'), CPX = path.join(DATA, '9JUS.pdb');
const ABIN = path.join(DATA, 'actin.bin');

/* =====================================================================
 *  folding-lab.html — the claims folding.js makes about 1VII.
 *
 *  MolecularGeometry.md §1.4 rule 2: a chemical claim ships with the
 *  assertion that checks it. folding-lab.html makes four, and all four are
 *  things a student is told in so many words, so none of them may drift
 *  silently if the H-bond cutoffs or the solver are ever retuned.
 * ===================================================================== */
if (fs.existsSync(VII)) {
  console.log('\n1VII — the fold:');
  const FoldLib = require('../folding.js');
  const parsed = FoldLib.parse(fs.readFileSync(VII, 'utf8'), { sideChains: [47, 51, 58] });
  const hb = FoldLib.hbonds(parsed);

  // CLAIM 1 — "12 of the 14 are exactly this i->i+4 grip" (side panel)
  const i4 = hb.filter(b => b.sep === 4).length;
  if (hb.length !== 14) fail('1VII h-bonds', `expected 14 backbone H-bonds, found ${hb.length}`);
  else if (i4 !== 12)   fail('1VII i+4', `expected 12 i+4 H-bonds, found ${i4}`);
  else ok(`14 backbone H-bonds, ${i4} of them i->i+4 — the helix rule the page teaches`);

  // CLAIM 2 — "not one of them runs between helices" (act 2's whole premise).
  // A tertiary contact would show up as a large sequence separation; every
  // bond being local is exactly what makes act 2 need a different mechanism.
  const maxSep = Math.max(...hb.map(b => Math.abs(b.sep)));
  if (maxSep > 4) fail('1VII locality',
    `an H-bond spans ${maxSep} residues — act 2 claims none is tertiary`);
  else ok(`every H-bond is local (max separation ${maxSep}) — none packs the helices`);

  // CLAIM 3 — the start state is genuinely extended, so act 1 shows a real
  // collapse rather than a nudge
  const E = FoldLib.extended(parsed), v = FoldLib._v3;
  const ca = parsed.residues.map(r => r.atoms.CA).filter(x => x != null);
  const span = v.dist(E[ca[0]], E[ca[ca.length - 1]]);
  const nativeSpan = v.dist(parsed.nodes[ca[0]].native, parsed.nodes[ca[ca.length - 1]].native);
  if (span < 100) fail('1VII extended', `start state only ${span.toFixed(1)} A end-to-end`);
  else ok(`starts ${span.toFixed(0)} A end-to-end, folds to ${nativeSpan.toFixed(1)} A`);

  // CLAIM 4 — the fold actually arrives. If this drifts, the animation ends
  // on something that is not the deposited structure and the page is lying.
  const folder = FoldLib.Folder(parsed);
  const fresh = folder.bake(FoldLib.BAKE.frames, FoldLib.BAKE.keep);
  const rmsd = folder.rmsd(), formed = folder.formation().filter(x => x > 0.5).length;
  if (rmsd > 1.0)        fail('1VII fold', `ends ${rmsd.toFixed(2)} A from the deposited structure`);
  else if (formed !== 14) fail('1VII fold', `only ${formed}/14 H-bonds formed at the end`);
  else ok(`fold lands ${rmsd.toFixed(2)} A RMSD from deposited, all 14 H-bonds formed`);

  /* CLAIM 5 — the atoms still fit on their bonds.
     folding-lab draws in real angstroms and takes its display radii from the
     house palette, divided by SCALE. That keeps its ball-and-stick proportions
     identical to every other page — but it also means a change to
     PALETTE.radii silently changes THIS page's geometry, and check-molecules
     cannot catch it because this page has no spec in the registry. So apply
     check-molecules' own rule here: two bonded spheres must not merge, or the
     stick between them is buried inside the atoms and the bond renders as
     nothing. */
  const LIB = require(path.join(ROOT, 'lib-node.js'));
  const RAD = Object.fromEntries(['C','N','O','H']
    .map(e => [e, LIB.PALETTE.radii[e] / LIB.SCALE]));
  const I = FoldLib.IDEAL;
  const BONDED = [['N','H',I.N_H], ['C','O',I.C_O], ['C','N',I.C_N],
                  ['N','C',I.N_CA], ['C','C',I.CA_C]];
  let merged = null, tightest = Infinity;
  for (const [a, b, L] of BONDED) {
    const clear = L - (RAD[a] + RAD[b]);
    if (clear < tightest) { tightest = clear; }
    if (clear <= 0) merged = `${a}-${b} at ${L.toFixed(3)} A vs radii summing ${(RAD[a]+RAD[b]).toFixed(3)}`;
  }
  if (merged) fail('1VII radii', `bonded spheres merge — ${merged}; the stick renders as nothing`);
  else ok(`display radii clear every backbone bond (tightest ${tightest.toFixed(3)} A, N-H)`);

  /* CLAIM 6 — the COMMITTED trajectory is the one this solver produces.
     folding-lab.html no longer folds anything: it plays folding/data/1VII.fold.bin.
     That file is only trustworthy while it matches the code, and nothing
     about a stale one looks wrong — it animates a perfectly plausible fold
     that the current solver would never generate. Compared byte-for-byte,
     which is exact because the format stores the solver's own Float32s. */
  const BIN = path.join(DATA, '1VII.fold.bin');
  if (!fs.existsSync(BIN)) {
    fail('1VII baked fold', 'folding/data/1VII.fold.bin is missing — run: node folding/tools/bake-fold.js');
  } else {
    const onDisk = fs.readFileSync(BIN);
    const expect = Buffer.from(FoldLib.encode(fresh));
    if (!onDisk.equals(expect)) {
      const why = onDisk.length !== expect.length
        ? `different size — ${onDisk.length} bytes on disk vs ${expect.length} fresh`
        : `same size, different contents — first differs at byte ${
            [...onDisk].findIndex((b, i) => b !== expect[i])}`;
      fail('1VII baked fold',
        `folding/data/1VII.fold.bin does not match this solver (${why}) — re-run: node folding/tools/bake-fold.js`);
    }
    else ok(`baked trajectory on disk matches a fresh bake exactly (${(onDisk.length/1024).toFixed(0)} KB)`);
  }
}

/* =====================================================================
 *  folding-lab act 3 — villin, and what an AlphaFold model may be said to be.
 *
 *  The claims here are unusually easy to get wrong in a direction nobody
 *  notices, because a prediction renders exactly as confidently as a
 *  structure does. These assertions pin the ones the page makes out loud.
 * ===================================================================== */
if (fs.existsSync(AFMODEL)) {
  console.log('\nvillin — act 3:');
  const Villin = require('../villin.js');
  const model = Villin.parseCA(fs.readFileSync(AFMODEL, 'utf8'));

  // CLAIM 1 — "the chain you folded is the last 36 residues of villin"
  const AA3 = { ALA:'A',ARG:'R',ASN:'N',ASP:'D',CYS:'C',GLN:'Q',GLU:'E',GLY:'G',HIS:'H',
                ILE:'I',LEU:'L',LYS:'K',MET:'M',PHE:'F',PRO:'P',SER:'S',THR:'T',TRP:'W',TYR:'Y',VAL:'V' };
  const seqOf = f => {
    const d = {};
    for (const l of fs.readFileSync(f, 'utf8').split('\n'))
      if (l.startsWith('ATOM') && l.slice(12,16).trim() === 'CA')
        d[+l.slice(22,26)] = AA3[l.slice(17,20).trim()] || 'X';
    return d;
  };
  const af = seqOf(AFMODEL), vii = seqOf(VII);
  const afSeq = Object.keys(af).map(Number).sort((a,b)=>a-b).map(k=>af[k]).join('');
  const viiSeq = Object.keys(vii).map(Number).sort((a,b)=>a-b).map(k=>vii[k]).join('');
  const window = afSeq.slice(Villin.HP35.start - 1, Villin.HP35.end);
  const same = [...window].filter((c, i) => c === viiSeq[i]).length;
  if (window.length !== viiSeq.length)
    fail('villin HP35', `length mismatch: ${window.length} vs ${viiSeq.length}`);
  else if (same < 35)
    fail('villin HP35', `only ${same}/36 residues match 1VII at ${Villin.HP35.start}-${Villin.HP35.end}`);
  else ok(`1VII is villin ${Villin.HP35.start}-${Villin.HP35.end}: ${same}/36 identical ` +
          `(the one difference is the construct's initiator Met)`);

  // CLAIM 2 — the domain split is villin's real architecture, from PAE alone
  const paeFile = path.join(DATA, 'AF-P02640-F1-pae_v6.json');
  if (!fs.existsSync(paeFile)) {
    fail('villin domains', 'folding/data/AF-P02640-F1-pae_v6.json is missing');
  } else {
    const rawPae = JSON.parse(fs.readFileSync(paeFile, 'utf8'));
    const pae = (Array.isArray(rawPae) ? rawPae[0] : rawPae).predicted_aligned_error;
    const domains = Villin.segment(pae);
    const hpDom = domains.filter(([s, e]) => s <= Villin.HP35.start && e >= Villin.HP35.end);
    if (domains.length < 7)
      fail('villin domains', `PAE gave ${domains.length} rigid bodies; villin has six gelsolin repeats plus a headpiece`);
    else if (hpDom.length !== 1)
      fail('villin domains', 'HP35 is not contained in exactly one rigid body');
    else ok(`PAE alone yields ${domains.length} rigid bodies, HP35 inside one of them ` +
            `(${hpDom[0][0]}-${hpDom[0][1]}) — villin's known architecture, not hand-typed`);

    // CLAIM 3 — the generated arrangements are honest polypeptides
    if (fs.existsSync(POSES)) {
      const raw = fs.readFileSync(POSES);
      const m = Villin.decode(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
      const idx = new Map([...m.nums].map((r, i) => [r, i]));
      const at = k => { const a = m.poses[k]; return i => [a[i*3], a[i*3+1], a[i*3+2]]; };
      const dist = (a, b) => Math.hypot(a[0]-b[0], a[1]-b[1], a[2]-b[2]);

      // domains must be moved, never deformed
      let rigidErr = 0;
      for (let k = 1; k < m.count; k++) {
        const A = at(0), B = at(k);
        for (const [s, e] of m.domains) {
          const ii = [];
          for (let r = s; r <= e; r++) { const i = idx.get(r); if (i != null) ii.push(i); }
          for (let x = 0; x < ii.length; x += 7)
            for (let y = x + 7; y < ii.length; y += 13)
              rigidErr = Math.max(rigidErr, Math.abs(dist(A(ii[x]), A(ii[y])) - dist(B(ii[x]), B(ii[y]))));
        }
      }
      // the chain must stay a chain: no bond may leave the model's own range
      const refL = Villin.bondLengths(model.ca, model.nums);
      let lo = Infinity, hi = 0;
      for (const l of refL) if (l) { lo = Math.min(lo, l); hi = Math.max(hi, l); }
      let outside = 0;
      for (let k = 0; k < m.count; k++) {
        const A = at(k);
        for (let i = 0; i + 1 < m.residues; i++) {
          if (m.nums[i+1] !== m.nums[i] + 1) continue;
          const L = dist(A(i), A(i+1));
          if (L < lo - 1e-3 || L > hi + 1e-3) outside++;
        }
      }
      if (rigidErr > 0.01)
        fail('villin poses', `a domain was deformed by ${rigidErr.toFixed(3)} A — only linkers may change`);
      else if (outside)
        fail('villin poses', `${outside} backbone bonds fall outside the model's own ${lo.toFixed(2)}-${hi.toFixed(2)} A range`);
      else ok(`${m.count} arrangements: domains rigid (max ${rigidErr.toFixed(5)} A), ` +
              `every bond inside the model's own ${lo.toFixed(2)}-${hi.toFixed(2)} A range`);

      // and they must actually differ, or the buttons are a lie
      const hp = [];
      for (let r = Villin.HP35.start; r <= Villin.HP35.end; r++) { const i = idx.get(r); if (i != null) hp.push(i); }
      const cent = k => { const A = at(k), s = [0,0,0];
        hp.forEach(i => { const p = A(i); s[0]+=p[0]; s[1]+=p[1]; s[2]+=p[2]; });
        return s.map(x => x / hp.length); };
      let minMove = Infinity;
      for (let a = 0; a < m.count; a++)
        for (let b = a + 1; b < m.count; b++) minMove = Math.min(minMove, dist(cent(a), cent(b)));
      if (minMove < 5)
        fail('villin poses', `two arrangements put the headpiece only ${minMove.toFixed(1)} A apart — buttons would show the same picture`);
      else ok(`every pair of arrangements moves HP35 at least ${minMove.toFixed(1)} A — all eight are distinct`);

      /* CLAIM 3b — the secondary structure the ribbon draws is DSSP's, and
         DSSP here agrees with an experiment where one exists.

         The page now draws all 826 residues as a cartoon, and every helix
         and strand in it is computed rather than deposited, because
         AlphaFold DB ships no HELIX or SHEET records. That makes the
         implementation itself load-bearing: a wrong DSSP would draw
         confident secondary structure that is simply not there, in the same
         ink as HP35's measured helices.

         1VII is the one place the computation can be checked against an
         experiment. It is villin 791-826, so run this DSSP over the
         deposited file and compare to its own HELIX records. Recall is
         allowed to fall short — depositors habitually extend a HELIX record
         a residue or two past where the H-bond pattern really holds, and
         over the whole of 9ZZI this implementation matches 97% of what it
         calls helix while missing 135 record residues at helix ENDS against
         only 15 anywhere in a middle. Precision is the property worth
         pinning: almost everything it calls a helix should be one. */
      const vii = fs.readFileSync(VII, 'utf8');
      const rec = new Set();
      for (const l of vii.split('\n'))
        if (l.startsWith('HELIX'))
          for (let r = +l.slice(21, 25); r <= +l.slice(33, 37); r++) rec.add(r);
      const bbV = Ribbon.parseBackbone(vii);
      const ssV = Ribbon.dssp(bbV);
      let called = 0, agreed = 0;
      ssV.forEach((c, i) => { if (c === 'H') { called++; if (rec.has(bbV.nums[i])) agreed++; } });
      const prec = called ? agreed / called : 0;
      if (!called)
        fail('dssp', 'this DSSP finds no helix at all in 1VII, which is three helices of deposited record');
      else if (prec < 0.90)
        fail('dssp', `only ${(100*prec).toFixed(0)}% of the helix this DSSP finds in 1VII is inside its ` +
             `deposited HELIX records (${agreed}/${called}) — it is inventing secondary structure`);
      else
        ok(`DSSP agrees with 1VII's HELIX records: ${agreed}/${called} of the helix it finds is deposited ` +
           `(${(100*prec).toFixed(0)}%) — the same algorithm then runs on the AlphaFold model`);

      /* And the SS on disk must be what this DSSP produces from the model,
         for the same reason the arrangements must: a stale byte per residue
         draws a helix in the wrong place and nothing about the picture says
         so. Folded into the byte-for-byte comparison below via encode(). */
      const bbM = Ribbon.parseBackbone(fs.readFileSync(AFMODEL, 'utf8'));
      const ssByNum = new Map();
      Ribbon.dssp(bbM).forEach((c, i) => ssByNum.set(bbM.nums[i], c));
      const ssM = Array.from(model.nums, nu => ssByNum.get(nu) || 'C');
      const onDiskSS = Array.from(m.ss).join('');
      if (onDiskSS !== ssM.join(''))
        fail('villin ss', 'the secondary structure in the poses file is not what this DSSP produces ' +
             '— re-run: node folding/tools/bake-villin.js');
      else {
        const pc = c => (100 * ssM.filter(x => x === c).length / ssM.length).toFixed(0);
        ok(`baked secondary structure matches a fresh DSSP (${pc('H')}% helix, ${pc('E')}% strand, ${pc('C')}% coil)`);
      }

      // CLAIM 4 — the committed arrangements are the ones this code produces
      const fresh = Buffer.from(Villin.encode({
        nums: model.nums, plddt: model.plddt, domains,
        poses: Villin.poses(model, domains), ss: ssM }));
      if (!raw.equals(fresh))
        fail('villin poses', 'folding/data/AF-P02640-villin.poses.bin does not match this generator — re-run: node folding/tools/bake-villin.js');
      else ok(`baked arrangements on disk match a fresh bake exactly (${(raw.length/1024).toFixed(0)} KB)`);
    } else {
      fail('villin poses', 'folding/data/AF-P02640-villin.poses.bin is missing — run: node folding/tools/bake-villin.js');
    }
  }
}

/* =====================================================================
 *  folding-lab rungs 4-5 — the filament, and the measured complex.
 * ===================================================================== */
if (fs.existsSync(FIL) && fs.existsSync(CPX)) {
  console.log('\nactin — rungs 4-5:');
  const Actin = require('../actin.js');
  const fil = Actin.parseCA(fs.readFileSync(FIL, 'utf8'), 'ABCDE');
  const order = Object.keys(fil).sort();
  const screws = [];
  for (let i = 0; i + 1 < order.length; i++)
    screws.push(Actin.screwOf(fil[order[i]], fil[order[i + 1]]));

  // CLAIM 1 — the helix we extend by is F-actin's, not one we chose
  const rises = screws.map(s => s.rise), twists = screws.map(s => s.twist);
  const rise = rises.reduce((a, b) => a + b) / rises.length;
  const twist = twists.reduce((a, b) => a + b) / twists.length;
  const spreadR = Math.max(...rises) - Math.min(...rises);
  const spreadT = Math.max(...twists) - Math.min(...twists);
  if (Math.abs(rise - Actin.RISE_REF) > 1.0 || Math.abs(twist - Actin.TWIST_REF) > 1.5)
    fail('actin helix', `rise ${rise.toFixed(2)}/twist ${twist.toFixed(2)} is not F-actin ` +
      `(expected ~${Actin.RISE_REF} / ~${Actin.TWIST_REF})`);
  else if (spreadR > 0.05 || spreadT > 0.2)
    fail('actin helix', `subunit steps disagree (rise spread ${spreadR.toFixed(3)}, twist ${spreadT.toFixed(3)}) — not a clean helical polymer`);
  else ok(`helical symmetry measured from the file: rise ${rise.toFixed(2)} A, twist ${twist.toFixed(2)} deg, ` +
          `${screws.length} steps agreeing to ${spreadR.toFixed(3)} A`);

  /* CLAIM 2 — THE ONE THAT MATTERS. The page shows 13 subunits where only 5
     were observed. Applying the screw k times must land on the deposited
     chains, or the extra subunits are fiction rather than symmetry. */
  const gen = Actin.extend(fil[order[0]], screws[0], order.length);
  let worst = 0;
  order.forEach((c, k) => {
    const dep = fil[c].map(a => a.p);
    let s2 = 0;
    for (let i = 0; i < dep.length; i++) {
      const d = Math.hypot(dep[i][0]-gen[k][i][0], dep[i][1]-gen[k][i][1], dep[i][2]-gen[k][i][2]);
      s2 += d * d;
    }
    worst = Math.max(worst, Math.sqrt(s2 / dep.length));
  });
  if (worst > 0.1)
    fail('actin extension', `a symmetry copy misses its deposited chain by ${worst.toFixed(3)} A — the extra subunits are not where the helix puts them`);
  else ok(`repeating the screw reproduces every deposited subunit (worst ${worst.toFixed(3)} A RMSD) — the extension is symmetry, not invention`);

  // CLAIM 3 — the rendered filament is the width F-actin actually is
  const all = Actin.extend(fil[order[0]], screws[0], Actin.SUBUNITS).flat();
  const lo = [1e9,1e9,1e9], hi = [-1e9,-1e9,-1e9];
  all.forEach(p => { for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]); } });
  const ext = [0,1,2].map(k => hi[k] - lo[k]).sort((a, b) => a - b);
  const widthNm = ext[0] / 10, lenNm = ext[2] / 10;
  if (widthNm < 6 || widthNm > 11)
    fail('actin width', `filament is ${widthNm.toFixed(1)} nm across; F-actin is 7-9`);
  else ok(`${Actin.SUBUNITS} subunits = ${lenNm.toFixed(0)} nm long, ${widthNm.toFixed(1)} nm wide (F-actin is 7-9 nm)`);

  /* CLAIM 4 — the species caveat is warranted. Every villin-actin structure
     is from a vent worm, and the page says so. If a vertebrate one ever
     replaces this file, that note becomes wrong and should be revisited
     rather than left standing. */
  const AA3 = { ALA:'A',ARG:'R',ASN:'N',ASP:'D',CYS:'C',GLN:'Q',GLU:'E',GLY:'G',HIS:'H',
                ILE:'I',LEU:'L',LYS:'K',MET:'M',PHE:'F',PRO:'P',SER:'S',THR:'T',TRP:'W',TYR:'Y',VAL:'V' };
  const seqOfChain = (file, ch) => {
    const d = {};
    for (const l of fs.readFileSync(file, 'utf8').split('\n'))
      if (l.startsWith('ATOM') && l[21] === ch && l.slice(12,16).trim() === 'CA')
        d[+l.slice(22,26)] = AA3[l.slice(17,20).trim()] || 'X';
    return Object.keys(d).map(Number).sort((a,b)=>a-b).map(k => d[k]).join('');
  };
  const wormV = seqOfChain(CPX, 'v');
  const chickV = fs.existsSync(AFMODEL) ? seqOfChain(AFMODEL, 'A') : '';
  if (chickV) {
    const n = Math.min(wormV.length, chickV.length);
    let same = 0;
    for (let i = 0; i < n; i++) if (wormV[i] === chickV[i]) same++;
    const pct = same / n * 100;
    /* Ungapped, position-by-position. That makes it a fine DIFFERENCE
       detector and a poor homology measure — the two are genuinely homologous
       and this number badly understates that, so it must not be quoted as an
       identity. All it establishes is that they are not the same sequence,
       which is what the caveat rests on. */
    if (pct > 90)
      fail('villin species', `9JUS villin matches the chicken model position-for-position (${pct.toFixed(0)}%) — the page's "different animal" note may no longer be right`);
    else ok(`9JUS villin is not the chicken sequence (ungapped match ${pct.toFixed(0)}%, a difference test not a homology measure) — species caveat warranted`);
  }

  // CLAIM 5 — the committed reduction matches this code
  if (!fs.existsSync(ABIN)) {
    fail('actin bake', 'folding/data/actin.bin is missing — run: node folding/tools/bake-actin.js');
  } else {
    const cpx = Actin.parseCA(fs.readFileSync(CPX, 'utf8'), 'fgpv');
    const fresh = Buffer.from(Actin.encode({
      screw: Object.assign({}, screws[0], { rise, twist }),
      subunit: fil[order[0]].map(a => a.p),
      complexActin: ['f','g','p'].flatMap(c => (cpx[c] || []).map(a => a.p)),
      complexVillin: (cpx.v || []).map(a => a.p) }));
    const onDisk = fs.readFileSync(ABIN);
    if (!onDisk.equals(fresh))
      fail('actin bake', 'folding/data/actin.bin does not match this code — re-run: node folding/tools/bake-actin.js');
    else ok(`baked actin on disk matches a fresh bake exactly (${(onDisk.length/1024).toFixed(0)} KB from 6.1 MB)`);
  }
}

/* CLAIM 6 — ribbon.js's helices are 1VII's, not an invention.
   folding-lab-ribbon.html draws HP35 as a ribbon whose helices come from
   RibbonLib.HP35_HELICES, hard-coded in villin numbering because act 3
   renders from villin.js's Ca trace and never loads 1VII. That constant is
   a claim about a deposited file, so it is checked against it: the HELIX
   records, shifted by the same +750 that maps 1VII 41 onto villin 791.
   Without this, a ribbon could confidently draw helices the structure does
   not have and nothing would notice. */
{
  const Villin = require('../villin.js');
  const recs = fs.readFileSync(VII, 'utf8').split('\n')
    .filter(l => l.startsWith('HELIX'))
    .map(l => [parseInt(l.slice(21, 25), 10), parseInt(l.slice(33, 37), 10)]);
  const want = recs.map(([a, b]) => [a + Ribbon.HP35_OFFSET, b + Ribbon.HP35_OFFSET]);
  const got = Ribbon.HP35_HELICES;
  const same = want.length === got.length &&
    want.every(([a, b], i) => got[i][0] === a && got[i][1] === b);
  if (!recs.length)
    fail('ribbon helices', '1VII.pdb has no HELIX records to check RibbonLib.HP35_HELICES against');
  else if (!same)
    fail('ribbon helices',
         `RibbonLib.HP35_HELICES is ${JSON.stringify(got)} but 1VII's HELIX records ` +
         `shifted by +${Ribbon.HP35_OFFSET} give ${JSON.stringify(want)}`);
  else
    ok(`ribbon helices match 1VII's ${recs.length} HELIX records (+${Ribbon.HP35_OFFSET} to villin numbering)`);

  /* Guide-point smoothing must stay between "does nothing" and "collapses
     the helix onto its axis". Both failure modes are invisible in a diff
     and obvious only on screen, and one of them shipped once: 2 passes at
     0.45 took an ideal helix from 2.30 A off-axis to 0.51 A, which is the
     flat "rocket" style rather than a coil. Measured against an ideal
     alpha helix — 100 deg per residue, 1.5 A rise, 2.3 A radius — because
     that is the geometry the retention arithmetic is derived for. */
  {
    const P = [];
    for (let i = 0; i < 24; i++) {
      const a = i * 100 * Math.PI / 180;
      P.push([2.3 * Math.cos(a), 2.3 * Math.sin(a), i * 1.5]);
    }
    const ss = new Array(24).fill('H');
    /* build()'s default weight. Kept here as one constant because three
       assertions below use it, and a default that drifts away from the
       geometry they measure would leave all three passing about a setting
       no page uses. */
    const SMOOTH_W = 0.20;
    const radius = arr => arr.slice(4, 20)
      .reduce((s, p) => s + Math.hypot(p[0], p[1]), 0) / 16;
    const before = radius(P), after = radius(Ribbon.smooth(P, ss, 1, SMOOTH_W));
    const keep = after / before;
    if (keep < 0.40)
      fail('ribbon smoothing', `collapses the helix to ${(keep*100).toFixed(0)}% of its radius ` +
           `(${after.toFixed(2)} A) — that is the flat "rocket" style, not a coil`);
    else if (keep > 0.80)
      fail('ribbon smoothing', `only removes ${((1-keep)*100).toFixed(0)}% of the helix radius — ` +
           `too weak to stop the per-residue lurch`);
    else
      ok(`ribbon smoothing keeps ${(keep*100).toFixed(0)}% of an ideal helix's radius ` +
         `(${before.toFixed(2)} -> ${after.toFixed(2)} A) — regularised, not collapsed`);

    /* Coil must come through untouched: a loop's wiggle is its shape. */
    const coil = Ribbon.smooth(P, new Array(24).fill("C"), 1, SMOOTH_W);
    const moved = Math.max(...P.map((p, i) =>
      Math.hypot(p[0]-coil[i][0], p[1]-coil[i][1], p[2]-coil[i][2])));
    if (moved > 1e-9) fail('ribbon smoothing', `moves coil residues by up to ${moved.toFixed(3)} A`);
    else ok('coil guide points are left exactly where they are');

    /* CLAIM 6b — the ribbon lies ON the helix's cylinder, not edge-first.

       ribbon.js puts the band's WIDTH along frames()'s `t x n` and its
       thickness along `n`, so `n` is the flat face's normal and it must
       point radially — at the helix axis. Then the width runs along the
       axis and the band wraps the cylinder, which is what a cartoon helix
       looks like in every viewer that draws one.

       THIS SHIPPED WRONG AND LOOKED MERELY UGLY. frames() built `n` as
       (a-b) x (c-b), which is the binormal, not the radius: perpendicular
       to the osculating plane rather than lying in it. On an ideal helix
       that is 0.00 radial and 0.83 axial — the whole ribbon rotated a
       quarter turn about its own path, winding edge-first as a corkscrew
       ramp. Nothing else was wrong, which is why it read as a styling
       problem and drew two rounds of tuning the widths instead.

       The two dot products below are the entire difference between the
       correct frame and that one, so they are cheap insurance against a
       `+` being "simplified" back into a `x`. The width axis cannot reach
       1.0: `side` is perpendicular to the tangent, and an alpha helix's
       tangent is tilted ~34 deg off circumferential by its own rise, so
       the band leans by the pitch angle. That lean is real. */
    const cross3 = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
    const unit = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0]/l, a[1]/l, a[2]/l]; };
    const F = Ribbon.frames(P, Ribbon.smooth(P, ss, 1, SMOOTH_W), ss);
    let radial = 0, axial = 0, m = 0;
    for (let i = 4; i < 20; i++, m++) {
      const rad = unit([P[i][0], P[i][1], 0]);          // outward, helix on z
      radial += Math.abs(F[i].n[0]*rad[0] + F[i].n[1]*rad[1] + F[i].n[2]*rad[2]);
      axial  += Math.abs(unit(cross3(F[i].t, F[i].n))[2]);
    }
    radial /= m; axial /= m;
    if (radial < 0.95)
      fail('ribbon frame', `the flat face's normal is only ${radial.toFixed(2)} radial on an ideal ` +
           `helix — the band is not lying on the cylinder. A binormal (a cross product of the two ` +
           `Ca vectors) instead of the bisector scores 0.00 here and winds the ribbon edge-first`);
    else if (axial < 0.55)
      fail('ribbon frame', `the band's width axis is only ${axial.toFixed(2)} along the helix axis — ` +
           `it should lean off it by the pitch angle and no more`);
    else
      ok(`ribbon lies on the helix cylinder: face normal ${radial.toFixed(2)} radial, ` +
         `width axis ${axial.toFixed(2)} along the axis (the rest is the pitch lean)`);

    /* CLAIM 6e — a beta strand lies flat and does not roll.

       The mirror of the helix test above, and the reason it exists is that
       the two want OPPOSITE treatment from the same line of code. A helix's
       frame must be free to turn 100 degrees per residue; a strand's must
       not turn at all. Pinning only one of them is what let this file ship
       first with the guard on everywhere (helices in cups) and then with it
       off everywhere (strands rolling along their own length).

       A strand is PLEATED — Ca alternating ~0.9 A either side of its mean
       plane — so the raw bisector genuinely reverses every residue, exactly
       180 degrees. Two things have to hold for the band to read flat: the
       smoothing must annihilate the pleat (|1 - 2w| = 0 at w = 0.5), and
       the frame must not inherit its alternation. */
    {
      const Pe = [], sse = [];
      for (let i = 0; i < 14; i++) { Pe.push([3.3*i, 0, (i % 2 ? 1 : -1) * 0.9]); sse.push('E'); }
      const flat = Ribbon.smooth(Pe, sse, 1, Ribbon.SMOOTH_W);
      const pleat = Math.max(...flat.slice(2, 12).map(p => Math.abs(p[2])));
      if (pleat > 0.05)
        fail('ribbon strand', `smoothing leaves ${pleat.toFixed(2)} A of the 0.90 A pleat — the band ` +
             `will read as a row of bumps rather than a flat strand (needs w = 0.5 for E, ` +
             `not the helix's ${Ribbon.SMOOTH_W.H})`);
      else {
        const Fe = Ribbon.frames(Pe, flat, sse);
        let worst = 0;
        for (let i = 3; i < 11; i++) {
          const d = Fe[i].n[0]*Fe[i+1].n[0] + Fe[i].n[1]*Fe[i+1].n[1] + Fe[i].n[2]*Fe[i+1].n[2];
          worst = Math.max(worst, Math.acos(Math.max(-1, Math.min(1, d))) * 180 / Math.PI);
        }
        if (worst > 25)
          fail('ribbon strand', `a strand's frame turns up to ${worst.toFixed(0)} deg per residue — ` +
               `near 180 means the pleat's alternating bisector is being inherited and the band ` +
               `rolls along its length. Sign continuity must run on E (it must NOT on H)`);
        else
          ok(`beta strand lies flat: pleat smoothed to ${pleat.toFixed(2)} A, frame turns at most ` +
             `${worst.toFixed(0)} deg per residue — no roll`);
      }
    }

    /* CLAIM 6d — a beta strand is still an arrow.

       Only the constants, not the geometry: build() needs THREE and this
       checker runs in bare Node, so the shape itself was verified in the
       browser (body flat at 1.60, a step to 2.45 on the last residue, then
       a straight taper to the point). What can be asserted here is the
       ordering that makes an arrow possible at all, and it is exactly what
       a well-meaning simplification would break — the strand shipped once
       with no arrowhead and E only 1.23x H, which is invisible on screen
       and left a sheet reading as a pile of loose bands.

       The arrowhead is not decoration: it is the only thing on a cartoon
       that says which way a strand RUNS, which is what makes a sheet
       parallel or antiparallel. */
    const PR = Ribbon.PROFILE, A = Ribbon.ARROW;
    if (!A || !(A.head > 0))
      fail('ribbon arrow', 'RibbonLib.ARROW is gone — beta strands have no arrowhead, so a sheet ' +
           'shows neither its direction nor which bands are strands');
    else if (!(A.head > PR.E[0] * 1.3))
      fail('ribbon arrow', `arrow head ${A.head} is not meaningfully wider than the strand body ` +
           `${PR.E[0]} — the barb will not read as a point`);
    /* Was `A.tip < PR.C[0] * 1.5`, i.e. under 0.48, which a tip of 0.30
       passed while still cutting a 0.6 A stub across the end of a 4.9 A
       barb — visibly a snipped-off arrow. A point is a point: the only
       defensible number here is zero, give or take rounding. */
    else if (!(A.tip <= 0.02))
      fail('ribbon arrow', `arrow tip is ${A.tip} A, not a point — that leaves a ${(A.tip*2).toFixed(2)} A ` +
           `stub across the end of a ${(A.head*2).toFixed(2)} A barb, which reads as a blunt flag`);
    else if (!(PR.E[0] > PR.H[0]))
      fail('ribbon arrow', `strand body ${PR.E[0]} is not wider than a helix ${PR.H[0]}`);
    /* ARROW.length is in ANGSTROMS along the curve, not residues, and that
       distinction is the whole point of it. Sized in residues the head came
       out a different physical size on every strand — longest on exactly
       the strands whose ends curve most, because the spline stretches
       through a turn — which is what made some of them read as long darts.
       An arrowhead is a glyph and should be one size everywhere. The ratio
       to the barb is what keeps it looking like an arrow rather than a
       needle or a spade. */
    else if (!(A.length > 0))
      fail('ribbon arrow', 'ARROW.length is gone — a head sized in residues is a different ' +
           'physical size on every strand, longest where the strand curves most');
    else if (!(A.length > A.head * 1.8 && A.length < A.head * 4))
      fail('ribbon arrow', `arrow head is ${A.length} A long against a ${(A.head*2).toFixed(2)} A barb ` +
           `— outside the 1.8x-4x half-barb range that reads as an arrowhead`);
    else
      ok(`beta strands are arrows: body ${PR.E[0]} vs helix ${PR.H[0]}, barb ${A.head} ` +
         `(${(A.head/PR.E[0]).toFixed(1)}x the body), tapering to ${A.tip}`);

    /* CLAIM 6c — the frame ROTATES around the helix, it does not alternate.

       The two dot products above are averages of absolute values, so they
       are blind to a frame that flips sign every residue: |n . radial| is
       1.00 whether the normal points in or out. That is exactly the state
       ribbon.js shipped in. frames() carried the usual sign-continuity
       guard, `if (dot(n, prev) < 0) n = -n`, which assumes a frame turns
       less than 90 degrees per step and so treats any reversal as spurious.
       An alpha helix turns 100 degrees per residue. The guard fired on
       every one, the frame alternated instead of rotating, and each turn of
       the band flared open and shut like a cone.

       So measure the SIGNED step directly: consecutive frames must differ
       by the helix's own 100 degrees. A reinstated flip gives 180 - 100 =
       80 and fails here, which is the only number that separates the two. */
    let worst = 0;
    for (let i = 5; i < 19; i++) {
      const d = F[i].n[0]*F[i+1].n[0] + F[i].n[1]*F[i+1].n[1] + F[i].n[2]*F[i+1].n[2];
      const deg = Math.acos(Math.max(-1, Math.min(1, d))) * 180 / Math.PI;
      worst = Math.max(worst, Math.abs(deg - 100));
    }
    if (worst > 5)
      fail('ribbon frame', `consecutive frames differ by up to ${(100+worst).toFixed(0)} deg on an ` +
           `ideal helix instead of its own 100 deg — the frame is alternating, not rotating. ` +
           `80 deg means a sign-continuity flip is back in frames()`);
    else
      ok(`the frame rotates with the helix — 100 deg per residue (worst error ${worst.toFixed(1)} deg), not alternating`);
  }

  /* And the offset itself: 1VII's first residue must be villin's HP35 start. */
  const firstRes = fs.readFileSync(VII, 'utf8').split('\n')
    .find(l => l.startsWith('ATOM'));
  const lo = parseInt(firstRes.slice(22, 26), 10);
  if (lo + Ribbon.HP35_OFFSET !== Villin.HP35.start)
    fail('ribbon offset', `1VII starts at ${lo}; +${Ribbon.HP35_OFFSET} gives ` +
         `${lo + Ribbon.HP35_OFFSET}, but VillinLib.HP35.start is ${Villin.HP35.start}`);
  else ok(`1VII residue ${lo} maps onto villin ${Villin.HP35.start} under the same offset`);
}


if (failures) { console.log(`\nFAIL: ${failures} assertion(s) failed`); process.exit(1); }
console.log('\nPASS: folding-lab\'s chemistry, its predictions and its three baked files all check out');
