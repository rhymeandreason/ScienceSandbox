#!/usr/bin/env node
/* =====================================================================
 *  fetch-hemoglobin.js — pull 2HHB into molstar/data/.
 *
 *  2HHB is human deoxyhaemoglobin (Fermi & Perutz, 1.74 A): four chains —
 *  A/C alpha, B/D beta — and four haem groups, one per subunit. It is the
 *  candidate subject for a rebuilt protein-lab (see molstar/README.md).
 *
 *  WHY IT IS FETCHED AND NOT COMMITTED, unlike pdb/1LYZ.pdb and pdb/1IGT.pdb.
 *  Those two are vendored deliberately: a lesson must not stop working because
 *  a school's network blocks a domain. That argument applies to a LESSON. This
 *  is scratch, it is 443 KB, and molstar/ is meant to be deleted in one rm -r.
 *  If hemoglobin is adopted, this file moves to pdb/2HHB.pdb, gets committed
 *  for exactly the offline reason above, and this tool goes away.
 *
 *  The DOWNLOAD IS VERIFIED, not trusted: a truncated or error-page response
 *  that still parses as "some PDB" would silently become a lesson showing the
 *  wrong molecule. Chain composition and haem count are asserted here.
 *
 *  Run:  node molstar/tools/fetch-hemoglobin.js
 * ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

const ID = '2HHB';
const URL = `https://files.rcsb.org/download/${ID}.pdb`;
const OUT = path.join(__dirname, '..', 'data', `${ID}.pdb`);

// what the file has to contain to be the molecule we think it is
const EXPECT = {
  chains: { A: 141, B: 146, C: 141, D: 146 },   // alpha 141 residues, beta 146
  haems: 4,
};

function get(url, depth = 0) {
  return new Promise((resolve, reject) => {
    if (depth > 5) return reject(new Error('too many redirects'));
    https.get(url, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return resolve(get(res.headers.location, depth + 1));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`${url} -> HTTP ${res.statusCode}`));
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', d => body += d);
      res.on('end', () => resolve(body));
    }).on('error', reject);
  });
}

function audit(text) {
  const res = {};          // chain -> Set of residue ids
  let haems = 0;
  for (const l of text.split('\n')) {
    if (l.startsWith('ATOM')) {
      const ch = l.slice(21, 22);
      (res[ch] = res[ch] || new Set()).add(l.slice(22, 27));
    } else if (l.startsWith('HETATM') && l.slice(17, 20) === 'HEM' && l.slice(12, 16).trim() === 'FE') {
      haems++;              // count irons, not atoms — one Fe per haem
    }
  }
  const problems = [];
  for (const [ch, n] of Object.entries(EXPECT.chains)) {
    const got = res[ch] ? res[ch].size : 0;
    if (got !== n) problems.push(`chain ${ch}: ${got} residues, expected ${n}`);
  }
  const extra = Object.keys(res).filter(c => !(c in EXPECT.chains));
  if (extra.length) problems.push(`unexpected chains: ${extra.join(',')}`);
  if (haems !== EXPECT.haems) problems.push(`${haems} haem irons, expected ${EXPECT.haems}`);
  return { problems, haems, chains: Object.fromEntries(Object.entries(res).map(([k, v]) => [k, v.size])) };
}

(async () => {
  console.log(`fetching ${URL}`);
  const text = await get(URL);
  const a = audit(text);
  console.log('  chains  ' + JSON.stringify(a.chains));
  console.log('  haems   ' + a.haems);
  if (a.problems.length) {
    for (const p of a.problems) console.log('  FAIL  ' + p);
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, text);
  console.log(`  ok    ${(text.length / 1024).toFixed(0)} KB -> molstar/data/${ID}.pdb`);
})().catch(e => { console.error('FAILED: ' + e.message); process.exit(1); });
