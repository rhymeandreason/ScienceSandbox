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
const { MOLECULES } = require('../lib-node.js');

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

/* Smallest 5- and 6-membered cycles, same method check-molecules.js uses for
 * its axial/equatorial and glycosidic checks. */
function findRings(m) {
  const adj = adjacency(m), out = [], seen = new Set();
  for (const [i, j] of m.bonds) {
    const prev = new Map([[i, null]]);
    const q = [i];
    let done = false;
    while (q.length && !done) {
      const u = q.shift();
      for (const v of adj[u]) {
        if ((u === i && v === j) || (u === j && v === i)) continue;
        if (prev.has(v)) continue;
        prev.set(v, u);
        if (v === j) { done = true; break; }
        q.push(v);
      }
    }
    if (!prev.has(j)) continue;
    const path = [];
    for (let c = j; c !== null; c = prev.get(c)) path.push(c);
    if (path.length < 5 || path.length > 6) continue;
    const sig = [...path].sort((a, b) => a - b).join(',');
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push(path);
  }
  return out;
}

/* Sugars: carbohydrate numbering. C1 is the ANOMERIC carbon — the ring carbon
 * next to the ring oxygen that also carries an exocyclic O — then round the
 * ring away from that oxygen: C2, C3, C4, (C5). The ring O takes the number of
 * the last ring carbon (O5 in a pyranose, O4 in a furanose), the exocyclic
 * carbon hanging off it continues the count (C6 / C5), and every hydroxyl O
 * takes its carbon's number. So the names are derived from ring position and
 * the anomeric centre, never from array order.
 *
 * Disaccharides get an A/B suffix: A is the residue donating the anomeric
 * carbon to the glycosidic bond (the non-reducing end), B the one receiving
 * it. The bridging O belongs to A and is named once, as O1A.
 */
function nameSugar(key, m) {
  const adj = adjacency(m), el = i => m.atoms[i].el;
  const names = new Array(m.atoms.length).fill(null);
  const ringList = findRings(m);
  const inRing = new Set(ringList.flat());

  // residue A first when there are two, so its bridge O wins the naming
  const donor = m.glycosidic ? m.glycosidic.anomeric : null;
  const ordered = ringList.slice().sort((a, b) =>
    (b.includes(donor) ? 1 : 0) - (a.includes(donor) ? 1 : 0));
  const suffix = ordered.length > 1 ? ['A', 'B'] : [''];

  ordered.forEach((ring, r) => {
    const sfx = suffix[r] || '';
    const O = ring.find(i => el(i) === 'O');
    const carbons = ring.filter(i => i !== O);
    // anomeric: ring carbon beside the ring O that also bears an exocyclic O
    const anomeric = adj[O].filter(i => ring.includes(i))
      .find(c => adj[c].some(j => el(j) === 'O' && !ring.includes(j)));
    // walk the ring from C1, stepping away from the ring oxygen
    const order = [anomeric];
    let prev = O, cur = anomeric;
    while (order.length < carbons.length) {
      const nxt = adj[cur].find(j => ring.includes(j) && j !== prev && j !== O);
      order.push(nxt); prev = cur; cur = nxt;
    }
    order.forEach((c, n) => { names[c] = `C${n + 1}${sfx}`; });
    names[O] = `O${carbons.length}${sfx}`;
    // exocyclic carbon off the last ring carbon continues the numbering
    let tail = adj[order[order.length - 1]].find(j => el(j) === 'C' && !inRing.has(j));
    let n = carbons.length + 1;
    while (tail != null) {
      names[tail] = `C${n}${sfx}`;
      const o = adj[tail].find(j => el(j) === 'O' && !names[j]);
      if (o != null) names[o] = `O${n}${sfx}`;
      tail = adj[tail].find(j => el(j) === 'C' && !inRing.has(j) && !names[j]);
      n++;
    }
    // hydroxyl (and bridging) oxygens take their carbon's number
    order.forEach((c, k) => {
      const o = adj[c].find(j => el(j) === 'O' && !ring.includes(j) && !names[j]);
      if (o != null) names[o] = `O${k + 1}${sfx}`;
    });
  });
  nameHydrogens(m, names, adj, el);
  return names;
}

/* Nucleobases: standard purine / pyrimidine ring numbering.
 *
 * Purine is fixed by its fusion bond. C4 and C5 are the shared atoms, and they
 * are told apart by nitrogen count — C4 has two N neighbours (N3 and N9), C5
 * has one (N7). Everything else follows by walking each ring from there.
 *
 * Bare pyrimidine is SYMMETRIC (N1<->N3, C4<->C6), so which of the two
 * nitrogens is called N1 is arbitrary — the two labellings describe the same
 * chemistry. No graph invariant can separate automorphic atoms; that is what
 * symmetry means. The tie is broken by array order, so the names are stable
 * for a given spec but would mirror if this molecule were ever renumbered.
 * Harmless here, and worth knowing before `diff` leans on C4 vs C6.
 */
function nameBase(key, m) {
  const adj = adjacency(m), el = i => m.atoms[i].el;
  const names = new Array(m.atoms.length).fill(null);
  const ringList = findRings(m);
  const six = ringList.find(r => r.length === 6);
  const five = ringList.find(r => r.length === 5);

  if (five) {                                     // purine
    const fusion = six.filter(i => five.includes(i));
    const nCount = i => adj[i].filter(j => el(j) === 'N').length;
    const C4 = fusion.reduce((a, b) => (nCount(a) >= nCount(b) ? a : b));
    const C5 = fusion.find(i => i !== C4);
    names[C4] = 'C4'; names[C5] = 'C5';
    const N3 = adj[C4].find(i => six.includes(i) && el(i) === 'N');
    const N9 = adj[C4].find(i => five.includes(i) && el(i) === 'N');
    names[N3] = 'N3'; names[N9] = 'N9';
    const C2 = adj[N3].find(i => six.includes(i) && i !== C4);
    names[C2] = 'C2';
    const N1 = adj[C2].find(i => six.includes(i) && i !== N3);
    names[N1] = 'N1';
    names[adj[N1].find(i => six.includes(i) && i !== C2)] = 'C6';
    const C8 = adj[N9].find(i => five.includes(i) && i !== C4);
    names[C8] = 'C8';
    names[adj[C8].find(i => five.includes(i) && i !== N9)] = 'N7';
  } else {                                        // pyrimidine
    const Ns = six.filter(i => el(i) === 'N').sort((a, b) => a - b);
    const C2 = six.find(i => el(i) === 'C' && adj[i].filter(j => Ns.includes(j)).length === 2);
    names[C2] = 'C2';
    // Either N may be N1 (see the note above). Taking them in array order is
    // arbitrary but deterministic, and lands C4/C5 on the edge where a purine
    // fuses its second ring — so the two bases' names line up on the page.
    const [N1, N3] = Ns;
    names[N1] = 'N1'; names[N3] = 'N3';
    const C4 = adj[N3].find(i => six.includes(i) && i !== C2);
    names[C4] = 'C4';
    const C6 = adj[N1].find(i => six.includes(i) && i !== C2);
    names[C6] = 'C6';
    names[six.find(i => !names[i])] = 'C5';
  }
  nameHydrogens(m, names, adj, el);
  return names;
}

/* Hydrogens follow their heavy neighbour: H2 on C2, HO3 on O3, and a numbered
 * pair (H61/H62) where a carbon carries two. */
function nameHydrogens(m, names, adj, el) {
  const byParent = new Map();
  m.atoms.forEach((a, i) => {
    if (a.el !== 'H' || names[i]) return;
    const p = adj[i].find(j => el(j) !== 'H');
    if (!byParent.has(p)) byParent.set(p, []);
    byParent.get(p).push(i);
  });
  for (const [p, list] of byParent) {
    const pn = names[p] || '';
    const stem = el(p) === 'O' ? `HO${pn.slice(1)}` : `H${pn.slice(1)}`;
    list.forEach((i, n) => { names[i] = list.length > 1 ? `${stem}${n + 1}` : stem; });
  }
}

const NAMERS = { aminoacid: nameAminoAcid, lipid: nameLipid,
                 sugar: nameSugar, base: nameBase };

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
