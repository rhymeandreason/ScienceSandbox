/* name-atoms.js — propose a stable `names` array for a MolLib spec.
 *
 * WHY: every index-bearing field in molecules.js (`pep`, `groups`, `diff`,
 * `optH`, `stereo.axial`, `cis`, `glycosidic`) is a raw integer into `atoms`.
 * The file warns repeatedly that regenerating a spec "must not renumber them",
 * but nothing enforces it — a different BFS order in sdf2spec.js silently
 * repoints every one. Names are the fix: they say what they mean, and
 * check-molecules.js can assert that every reference resolves.
 *
 * Names are GENERATED ONCE and committed, not derived at load. The array is
 * positional and travels with `atoms` — regenerate both together, exactly the
 * PDB convention this borrows from.
 *
 * Run:  node tools/name-atoms.js [molecule ...]     (default: every aminoacid)
 */
const { MOLECULES } = require('../molecules.js').MolLib;

const GREEK = ['B', 'G', 'D', 'E', 'Z', 'H'];   // Cβ, Cγ, Cδ, Cε, Cζ, Cη

const adjacency = m => {
  const adj = m.atoms.map(() => []);
  m.bonds.forEach(([i, j]) => { adj[i].push(j); adj[j].push(i); });
  return adj;
};

/* Amino acids: PDB naming. The backbone slots are the fixed order documented
 * at the top of molecules.js's amino-acid section, so they are assigned
 * directly. The side chain is walked outward from Ca, one Greek letter per
 * bond of distance — which is precisely how PDB names are defined, so this
 * reproduces the real names (CB/CG/CD, OE1/NE2 on Gln, OE1/OE2 on Glu, OG on
 * Ser, SG on Cys) rather than inventing a parallel scheme.
 *
 * Proline is the documented exception: its N is secondary, so slot 2 holds Cd
 * instead of a second amino H (see proline's comment in molecules.js).
 */
function nameAminoAcid(key, m) {
  const adj = adjacency(m), el = i => m.atoms[i].el;
  const names = new Array(m.atoms.length).fill(null);
  const CA = 3;

  names[0] = 'N';
  names[3] = 'CA';
  // glycine's "side chain" is a second H on Ca, so it needs HA1/HA2 — a bare
  // HA would collide with slot 4. Every other residue has exactly one.
  const HA = adj[3].filter(j => el(j) === 'H');
  if (HA.length > 1) HA.forEach((j, n) => { names[j] = `HA${n + 1}`; });
  else names[4] = 'HA';
  names[5] = 'C';
  names[6] = 'O';
  names[7] = 'OXT';
  names[8] = 'HXT';
  // slot 1 is always an amino H; slot 2 is an amino H except on proline,
  // where the ring's Cd occupies it
  names[1] = 'H';
  if (el(2) === 'H') names[2] = 'H2';

  // distance from Ca through heavy atoms only -> Greek position
  const depth = new Array(m.atoms.length).fill(-1);
  depth[CA] = 0;
  const queue = [CA];
  while (queue.length) {
    const i = queue.shift();
    for (const j of adj[i]) {
      if (el(j) === 'H' || depth[j] !== -1) continue;
      if (j === 0 || j === 5) continue;          // don't walk into the backbone
      depth[j] = depth[i] + 1;
      queue.push(j);
    }
  }

  // heavy side-chain atoms: element + Greek letter. PDB numbers across the
  // POSITION, not per element — glutamine's Cd carries OE1 and NE2, not OE and
  // NE — so the counter runs over every heavy atom at that depth.
  const byPos = new Map();
  m.atoms.forEach((a, i) => {
    if (depth[i] < 1 || a.el === 'H' || names[i]) return;
    const g = GREEK[depth[i] - 1];
    if (!byPos.has(g)) byPos.set(g, []);
    byPos.get(g).push(i);
  });
  // Order WITHIN a position must come from chemistry, not from array order —
  // if the suffix tracked the index, regenerating the spec would renumber the
  // names too and they would be no more stable than the integers they replace.
  // Rank: double bond to the parent first, then heavier element, then more
  // bonds. That yields PDB's own choices (Gln OE1=carbonyl, NE2=amide N;
  // Glu OE1=carbonyl, OE2=hydroxyl, so HE2 lands on OE2 as PDB has it).
  const orderOf = (i, j) => (m.bonds.find(b =>
    (b[0] === i && b[1] === j) || (b[0] === j && b[1] === i)) || [])[2] || 1;
  const parentOf = i => adj[i].find(j => depth[j] === depth[i] - 1);
  const RANK = { O: 3, N: 2, S: 4, C: 1 };
  for (const [g, list] of byPos) {
    list.sort((a, b) =>
      orderOf(b, parentOf(b)) - orderOf(a, parentOf(a))
      || (RANK[el(b)] || 0) - (RANK[el(a)] || 0)
      || adj[b].length - adj[a].length);
    list.forEach((i, n) => {
      names[i] = list.length > 1 ? `${el(i)}${g}${n + 1}` : `${el(i)}${g}`;
    });
  }

  // hydrogens take their heavy neighbour's name with C/N/O/S swapped for H
  const hByParent = new Map();
  m.atoms.forEach((a, i) => {
    if (a.el !== 'H' || names[i]) return;
    const p = adj[i].find(j => el(j) !== 'H');
    if (!hByParent.has(p)) hByParent.set(p, []);
    hByParent.get(p).push(i);
  });
  for (const [p, list] of hByParent) {
    const stem = 'H' + (names[p] || '').slice(1);
    list.forEach((i, n) => { names[i] = list.length > 1 ? `${stem}${n + 1}` : stem; });
  }
  return names;
}

/* Lipids: a straight acyl chain. C1 is the carboxyl carbon, then out along the
 * chain; the carboxyl oxygens are O1 (=O) and O2 (-OH), matching fatty-acid
 * numbering. Hydrogens follow their carbon.
 */
function nameLipid(key, m) {
  const adj = adjacency(m), el = i => m.atoms[i].el;
  const names = new Array(m.atoms.length).fill(null);
  const C1 = m.atoms.findIndex((a, i) =>
    a.el === 'C' && adj[i].filter(j => el(j) === 'O').length === 2);
  const Os = adj[C1].filter(j => el(j) === 'O');
  names[C1] = 'C1';
  names[Os.find(j => adj[j].length === 1)] = 'O1';                  // =O
  const oh = Os.find(j => adj[j].some(k => el(k) === 'H'));
  names[oh] = 'O2';
  names[adj[oh].find(j => el(j) === 'H')] = 'HO2';

  let prev = C1, cur = adj[C1].find(j => el(j) === 'C'), n = 2;
  while (cur != null) {
    names[cur] = 'C' + n++;
    const nxt = adj[cur].find(j => el(j) === 'C' && j !== prev);
    prev = cur; cur = nxt;
  }
  const hByParent = new Map();
  m.atoms.forEach((a, i) => {
    if (a.el !== 'H' || names[i]) return;
    const p = adj[i].find(j => el(j) !== 'H');
    if (!hByParent.has(p)) hByParent.set(p, []);
    hByParent.get(p).push(i);
  });
  for (const [p, list] of hByParent) {
    const stem = 'H' + (names[p] || '').slice(1);
    list.forEach((i, k) => { names[i] = list.length > 1 ? `${stem}${k + 1}` : stem; });
  }
  return names;
}

const NAMERS = { aminoacid: nameAminoAcid, lipid: nameLipid };

const keys = process.argv.slice(2).length ? process.argv.slice(2)
  : Object.keys(MOLECULES).filter(k => MOLECULES[k].class === 'aminoacid');

for (const k of keys) {
  const m = MOLECULES[k];
  if (!m) { console.log(`${k}: not in the library`); continue; }
  const namer = NAMERS[m.class];
  if (!namer) { console.log(`${k}: no namer for class '${m.class}' yet`); continue; }
  const names = namer(k, m);
  const gaps = names.map((n, i) => n ? null : i).filter(i => i !== null);
  const dupes = names.filter((n, i) => n && names.indexOf(n) !== i);
  console.log(`\n== ${k} (${m.atoms.length} atoms)`
    + (gaps.length ? `  UNNAMED ${gaps.join(',')}` : '')
    + (dupes.length ? `  DUPLICATE ${[...new Set(dupes)].join(',')}` : ''));
  console.log('   ' + names.map((n, i) => `${i}:${m.atoms[i].el}=${n}`).join('  '));
  console.log(`      names:[${names.map(n => `'${n}'`).join(',')}],`);
}
