#!/usr/bin/env node
/* =====================================================================
 *  triage.js — screen a candidate deposition before anything is baked.
 *
 *  Run:  node proteins/tools/triage.js 1IG8 3B8A
 *        node proteins/tools/triage.js 1EHZ --long
 *
 *  ANSWERS THE SCREENING QUESTIONS IN AddingAProtein.md, off the records
 *  rather than off a reading. Every one of them — a nucleic chain, an
 *  assembly deposited as MODELS, a partner chain, a HETATM in the site, a
 *  MODRES, missing HELIX/SHEET, a fragment — is a record grep, and a grep
 *  cannot skim. The one question left over is whether the shape says
 *  anything, which is what triage.html is for.
 *
 *  THE PARSING IS bake-lib's. A second reader of the same records is a
 *  second altloc rule and a second answer about what counts as a chain,
 *  and the two would disagree first on the file that mattered.
 *
 *  IT ALSO SAYS WHAT IS NEW ABOUT A CANDIDATE, not only what is in it. The
 *  conditions below are cheap to read off a file; what they COST depends
 *  entirely on whether anything here has met one before, and a structure that
 *  is the first test of three things fails as three things at once with none
 *  of them diagnosable. That is the whole argument for the order the nucleic
 *  entries were built in — 1BNA, then 1EHZ, then 1ZAA, then 1AOI, each adding
 *  exactly one — and 1AOI first would have been chainKinds on a mixed file, a
 *  nucleic branch in the box, and chain breaks, together.
 *
 *  THE PRECEDENTS ARE READ OFF THE COMMITTED BAKES, never listed here. A list
 *  is a second source and would go stale the day an entry lands; the bakes are
 *  the fact, and `precedents()` asks them.
 *
 *  Files cache to tools/.cache/, which the root .gitignore's *.pdb covers.
 * ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const Bake = require('../bake-lib.js');

const CACHE = path.join(__dirname, '.cache');

/* mmCIF-only entries 404 here, which is the answer rather than a failure:
   every record this file reads is a PDB record. */
const URL = id => `https://files.rcsb.org/download/${id.toUpperCase()}.pdb`;

function fetchPdb(id) {
  const hit = path.join(CACHE, id.toUpperCase() + '.pdb');
  if (fs.existsSync(hit)) return Promise.resolve(fs.readFileSync(hit, 'utf8'));
  fs.mkdirSync(CACHE, { recursive: true });
  return new Promise((resolve, reject) => {
    https.get(URL(id), res => {
      if (res.statusCode === 404) { res.resume(); return reject(new Error('404')); }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
      let text = '';
      res.setEncoding('utf8');
      res.on('data', d => { text += d; });
      res.on('end', () => { fs.writeFileSync(hit, text); resolve(text); });
    }).on('error', reject);
  });
}

/* Residues with coordinates per chain, and the gaps between them. The gap
   count is the `nums` invariant made visible before it can ship: a chain with
   breaks drawn without them splines a smooth tube across the hole. */
function modelled(text) {
  const kinds = Bake.chainKinds(text);
  const mod = Bake.modResidues(text);
  /* EACH READER GETS ONLY THE CHAINS IT IS FOR. caTrace reports the nucleic
     chains it had to drop, which is right for a baker and is noise here —
     triage has already said chain I is DNA in the row above. */
  const ids = k => new Set([...kinds].filter(([, v]) => v === k).map(([i]) => i));
  const aa = Bake.caTrace(text, ids('aa'), mod);
  const na = Bake.naTrace(text, ids('na'), mod);
  const out = new Map();
  for (const [id, kind] of kinds) {
    const res = kind === 'na' ? (na.get(id) || []) : (aa.get(id) || []);
    const nums = res.map(r => r.num);
    const gaps = nums.filter((v, i, a) => i && v !== a[i - 1] + 1).length;
    out.set(id, { kind, n: nums.length, gaps,
                  from: nums[0], to: nums[nums.length - 1] });
  }
  return out;
}

/* BIOMOLECULE 1's copy count, off REMARK 350. This is the one screening
   question the downloaded file does not answer by what it CONTAINS: the
   asymmetric unit is a twenty-fourth of ferritin and renders as a perfectly
   good four-helix bundle. The BIOMT rows say how many copies the authors say
   there are, so the gap between that and the chains present is visible before
   a bake rather than after a render. */
function assembly(text) {
  const lines = text.split('\n').filter(l => l.startsWith('REMARK 350'));
  const start = lines.findIndex(l => /BIOMOLECULE:\s*1\s*$/.test(l));
  if (start < 0) return null;
  const end = lines.findIndex((l, i) => i > start && /BIOMOLECULE:/.test(l));
  const block = lines.slice(start, end < 0 ? lines.length : end);
  const copies = block.filter(l => /BIOMT1/.test(l)).length;
  const said = (block.find(l => /BIOLOGICAL UNIT:/.test(l)) || '')
    .split('BIOLOGICAL UNIT:')[1];
  return { copies, said: said ? said.trim().toLowerCase() : null };
}

/* WHAT THE REPO HAS ALREADY DRAWN, asked of every committed bake through the
   two registries. Only the conditions a BAKE can answer are derived here — a
   condition nothing on disk records is left unknown rather than guessed at,
   because a wrong "already covered" is the one answer that would send someone
   at the expensive candidate first. */
function precedents() {
  const seen = new Set();
  const idx = [];
  for (const [mod, key] of [['../proteins.js', 'PROTEINS'],
                            ['../nucleic-acids.js', 'STRUCTURES']]) {
    try { idx.push(...require(path.join(__dirname, mod))[key]); }
    catch (e) { /* a registry that will not load is not a claim about coverage */ }
  }
  for (const e of idx) for (const v of e.variants || []) {
    const f = v.read && v.read.baked
      && path.join(__dirname, '..', '..', e.dir, 'data', v.read.baked);
    if (!f || !fs.existsSync(f)) continue;
    let t; try { t = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (x) { continue; }
    if (!t.order || !t.chains) continue;
    const na = t.order.filter(id => t.chains[id].kind === 'na');
    const aa = t.order.filter(id => (t.chains[id].kind || 'aa') === 'aa');
    if (na.length) seen.add('nucleic');
    if (na.length && aa.length) seen.add('mixed');
    if (aa.length > 1) seen.add('multi-protein');
    for (const id of t.order) {
      const c = t.chains[id];
      if (c.mods && c.mods.length) seen.add('modres');
      /* SPLIT BY POLYMER, because the two `runs()` that honour a break are
         different functions in different modules: kit/proteinbox.js's has
         split protein chains for a long time, kit/nucleic.js's has never
         split a strand. Reporting one condition would have said "covered"
         for the half that is not. */
      const n = c.nums || [];
      const kind = c.kind === 'na' ? 'nucleic chain break' : 'chain break';
      for (let i = 1; i < n.length; i++)
        if (n[i] !== n[i - 1] + 1) { seen.add(kind); break; }
    }
  }
  return seen;
}
const DRAWN = precedents();

function report(id, text, opts) {
  const one = Bake.modelOne(text);
  const nModels = Bake.models(text);
  const dec = Bake.declared(text);
  const mods = Bake.modResidues(text);
  const ss = Bake.ssRanges(text);
  const ligs = Bake.ligands(text, null, mods);
  const ec = Bake.ecNumbers(text);
  const res = Bake.resolution(text);

  const all = modelled(text);          // every model, merged
  const first = modelled(one);         // what a default bake would see

  const flags = [];
  const line = [];

  line.push(`${id.toUpperCase()}  ${Bake.method(text)}` +
            (res ? `  ${res.toFixed(2)} A` : '') +
            (nModels ? `  ${nModels} models` : ''));
  const title = Bake.line1(text, 'TITLE');
  if (title) line.push('  ' + title.toLowerCase());

  /* THE ASSEMBLY TRAP, SHOWN AS A DIFFERENCE. Chain counts alone cannot
     distinguish an NMR ensemble from an assembly deposited as models, but
     "24 models, 1 chain each, 24 chains merged" says which it is at a
     glance — and says what taking the default would have cost. */
  const chainsAll = [...all.keys()], chainsOne = [...first.keys()];
  /* MORE CHAINS MERGED THAN MODEL 1 HOLDS is what separates an assembly
     deposited as models from an NMR ensemble — the ensemble is the SAME chain
     thirty-two times, so merging it reports one chain of 3968 residues at
     3200% of SEQRES. Which of the two it is decides what the table below can
     honestly count. */
  const assemblyModels = nModels > 1 && chainsAll.length > chainsOne.length;
  if (nModels > 1) {
    line.push(`  models: model 1 holds ${chainsOne.length} chain` +
              `${chainsOne.length === 1 ? '' : 's'}, all ${nModels} merge to ` +
              `${chainsAll.length}`);
    flags.push(assemblyModels
      ? `ASSEMBLY AS MODELS — modelOne bakes ${chainsOne.length} of ` +
        `${chainsAll.length} chains; merge them chain-aware`
      : 'NMR ensemble — model 1 is the right read');
  }

  line.push('  chains:');
  const src = assemblyModels ? all : first;
  for (const [cid, c] of src) {
    const d = dec[cid];
    const pct = d ? Math.round(100 * c.n / d) : null;
    line.push(`    ${cid}  ${c.kind}  ${c.n} res` +
              (d ? ` of ${d} declared (${pct}%)` : ' (no SEQRES)') +
              (c.n ? `  ${c.from}-${c.to}` : '') +
              (c.gaps ? `  ${c.gaps} break${c.gaps === 1 ? '' : 's'}` : ''));
  }

  const conds = new Set();
  const na = [...src].filter(([, c]) => c.kind === 'na').map(([k]) => k);
  if (na.length) conds.add('nucleic');
  if (na.length && [...src].some(([, c]) => c.kind === 'aa')) conds.add('mixed');
  for (const [, c] of src)
    if (c.gaps) conds.add(c.kind === 'na' ? 'nucleic chain break' : 'chain break');
  if (mods.size) conds.add('modres');
  if (na.length) flags.push(
    `NUCLEIC chain${na.length === 1 ? '' : 's'} ${na.join(',')} — ` +
    'bake with naTrace/assembleNA, not caTrace. Worked examples: ' +
    'proteins/dna, trna, zif268, nucleosome');

  const aa = [...src].filter(([, c]) => c.kind === 'aa');
  if (aa.length > 1) conds.add('multi-protein');
  if (aa.length > 1) flags.push(
    `${aa.length} PROTEIN CHAINS — say which is the subject; solve the frame ` +
    'on that one, not on everything drawn');

  const bio = assembly(text);
  if (bio && bio.copies > 1) {
    line.push(`  assembly 1: ${bio.copies} copies of ` +
              `${chainsOne.join(',')}${bio.said ? `  (${bio.said})` : ''}`);
    if (bio.copies > chainsAll.length / Math.max(1, chainsOne.length)) flags.push(
      `ASYMMETRIC UNIT IS 1/${bio.copies} OF THE ASSEMBLY — this download is ` +
      `not the biological unit. Bake ${id.toUpperCase()}.pdb1, which deposits ` +
      'the copies as MODELS, and merge them chain-aware');
  }

  line.push(`  ss: ${ss.H.length} HELIX, ${ss.E.length} SHEET` +
            `   ssbond: ${Bake.disulfides(text, null).length}`);
  /* Only a protein chain is missing something when there are no records.
     Polyproline II and a duplex are neither helix nor sheet by the PDB's
     vocabulary, so flagging a nucleic entry here would be noise every time. */
  if (aa.length && !ss.H.length && !ss.E.length) flags.push(
    'NO HELIX/SHEET RECORDS — ss cannot be read, so colour by chain');

  line.push(`  het: ${ligs.length ? ligs.join(', ') : 'none'}`);
  if (ligs.length) flags.push('LIGAND/METAL present — decide if it is the subject');

  if (mods.size) {
    line.push(`  modres: ${[...mods].join(', ')}`);
    flags.push(`MODRES ${[...mods].join(',')} — pass modResidues to caTrace ` +
               'and ligands, or the trace drops them');
  }

  const frag = [...src].filter(([cid, c]) => dec[cid] && c.n < dec[cid] * 0.9);
  if (frag.length) flags.push(
    `FRAGMENT/CONSTRUCT — chain${frag.length === 1 ? '' : 's'} ` +
    `${frag.map(([k]) => k).join(',')} under 90% of SEQRES; say where it sits`);

  if (ec.length) line.push(`  ec: ${ec.join(', ')}`);

  console.log(line.join('\n'));
  console.log(flags.length
    ? flags.map(f => '  ! ' + f).join('\n')
    : '  > default path: chain A, ss from the file, ship');

  /* WHAT IS NEW HERE, which is a different question from what is in the file.
     One new condition is a normal build; two or more means this candidate is
     the first test of several things at once, and when they fail they fail
     together. Take a cheaper entry that adds one of them first — the whole
     point is that the expensive structure then becomes a content decision. */
  const fresh = [...conds].filter(c => !DRAWN.has(c));
  const known = [...conds].filter(c => DRAWN.has(c));
  if (conds.size) {
    if (known.length) console.log('  = already drawn here: ' + known.join(', '));
    if (fresh.length === 1)
      console.log('  + NEW HERE: ' + fresh[0] + ' — nothing on disk has met it');
    else if (fresh.length > 1)
      console.log('  + NEW HERE: ' + fresh.join(', ') + ' — ' + fresh.length
        + ' at once. Find a smaller candidate that adds ONE of them first, or '
        + 'a failure is ' + fresh.length + ' failures with none diagnosable.');
  }
  if (opts.long) console.log('  file: ' + path.join(CACHE, id.toUpperCase() + '.pdb'));
  console.log('');
}

async function main() {
  const args = process.argv.slice(2);
  const opts = { long: args.includes('--long') };
  const ids = args.filter(a => !a.startsWith('-'));
  if (!ids.length) {
    console.error('usage: node proteins/tools/triage.js <PDB ID> [<PDB ID>...] [--long]');
    process.exit(1);
  }
  for (const id of ids) {
    try {
      report(id, await fetchPdb(id), opts);
    } catch (e) {
      if (e.message === '404') {
        console.log(`${id.toUpperCase()}\n  ! NO LEGACY .pdb — mmCIF only. ` +
          'Every record read here is a PDB record, so this ends the recipe ' +
          'rather than complicating it. Say so and stop.\n');
      } else {
        console.log(`${id.toUpperCase()}\n  ! ${e.message}\n`);
      }
    }
  }
}

main();
