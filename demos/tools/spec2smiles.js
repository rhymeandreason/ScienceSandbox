/* spec2smiles.js — generate the `smiles` string for a non-sugar contrast spec.
 *
 * contrast-lab.html draws the flat structure of a sugar with haworth.js and
 * everything else with SmilesDrawer, which takes SMILES. That string is NOT
 * hand-written: hand-writing it would put a second, unchecked description of
 * the molecule next to `atoms`/`bonds`, free to drift from them — the exact
 * problem the `names` work removed for `diff`. It is generated from the spec.
 *
 * Pipeline: spec -> heavy-atom molblock -> RDKit -> canonical SMILES.
 *   · HEAVY ATOMS ONLY, because a skeletal drawing gives H no glyph of its own.
 *   · CANONICAL, never rooted. RDKit's rootedAtAtom output does not round-trip
 *     for ring stereocentres — it silently returns the wrong anomer (verified
 *     on glucose/galactose, with `canonical` either true or false). Canonical
 *     round-trips for all 16 contrast specs, which this tool re-checks.
 *   · The HIGHLIGHT travels in the V2000 atom-atom map field, set from
 *     `contrast.diff`, so RDKit emits `[N:1]` and SmilesDrawer's
 *     highlight_atoms can key on class 1. Nothing is pasted into the string.
 *
 * RDKit is a DEV dependency and never ships: this runs at a terminal, the
 * output is committed, and the page loads only SmilesDrawer.
 *
 *   npm i @rdkit/rdkit && node tools/spec2smiles.js
 */
const { MOLECULES } = require('../lib-node.js');

const pad = (s, w) => String(s).padStart(w);

/* A hydrogen in `diff` has no glyph in a skeletal drawing — it is part of its
 * parent's -NH2 / -OH label — so it must light up the heavy atom it hangs on. */
function heavyDiff(m, map) {
  const adj = m.atoms.map(() => []);
  m.bonds.forEach(([i, j]) => { adj[i].push(j); adj[j].push(i); });
  const out = new Set();
  for (const ref of (m.contrast && m.contrast.diff) || []) {
    const i = typeof ref === 'number' ? ref : m.names.indexOf(ref);
    out.add(m.atoms[i].el === 'H' ? adj[i].find(j => m.atoms[j].el !== 'H') : i);
  }
  return new Set([...out].map(i => map.get(i)).filter(x => x !== undefined));
}

/* V2000 with the atom-atom map field (columns 61-63) set on the diff atoms.
 * Column placement is asserted by the caller: RDKit emitting `:1` on exactly
 * the expected atoms is the proof it landed in the right field. */
function molblock(name, m, mapped) {
  const keep = m.atoms.map((a, i) => i).filter(i => m.atoms[i].el !== 'H');
  const map = new Map(keep.map((i, n) => [i, n]));
  const bonds = m.bonds.filter(b => map.has(b[0]) && map.has(b[1]))
                       .map(b => [map.get(b[0]), map.get(b[1]), b[2] || 1]);
  let s = `${name}\n  ScienceSandbox\n\n`
        + `${pad(keep.length, 3)}${pad(bonds.length, 3)}  0  0  1  0  0  0  0  0999 V2000\n`;
  keep.forEach((i, n) => {
    const a = m.atoms[i];
    s += `${pad(a.pos[0].toFixed(4), 10)}${pad(a.pos[1].toFixed(4), 10)}`
       + `${pad(a.pos[2].toFixed(4), 10)} ${a.el.padEnd(3)} 0  0  0  0  0  0  0  0  0`
       + `${pad(mapped && mapped.has(n) ? 1 : 0, 3)}  0  0\n`;
  });
  for (const b of bonds) s += `${pad(b[0] + 1, 3)}${pad(b[1] + 1, 3)}${pad(b[2], 3)}  0\n`;
  return { mb: s + 'M  END\n', map, heavy: keep.length };
}

require('@rdkit/rdkit')().then(RDKit => {
  const rows = [];
  let bad = 0;
  for (const [key, m] of Object.entries(MOLECULES)) {
    // Sugars are NOT drawn from this string — haworth.js draws them from the
    // geometry. They are generated anyway, as a committed ASSERTION:
    // `stereo:{faces}` can only check a RELATIVE pattern, because the ring
    // normal's sign is arbitrary, so it cannot catch a global mirror — flip
    // every substituent at once and L-ribose passes as D-. RDKit's canonical
    // SMILES distinguishes [C@H] from [C@@H], which is exactly the
    // discrimination `faces` lacks. See molecule-pipeline.md item 5.
    if (!m.contrast) continue;
    if (!m.names) { console.log(`${key}: no \`names\` yet — skipped`); bad++; continue; }

    const probe = molblock(key, m, null);
    const d = heavyDiff(m, probe.map);
    const { mb, heavy } = molblock(key, m, d);

    const mapped = RDKit.get_mol(mb);
    const plain = RDKit.get_mol(probe.mb);
    const smiles = mapped.get_smiles();

    // 1. the map must have landed on exactly the intended atoms
    const marks = (smiles.match(/:1[\]]/g) || []).length;
    // 2. stripping the map must give back the plain molecule — proves the map
    //    field changed metadata only, not the structure
    const stripped = RDKit.get_mol(smiles.replace(/:1(?=])/g, '')).get_smiles();
    const same = stripped === plain.get_smiles();
    // 3. and the plain form must survive its own round trip
    const trip = RDKit.get_mol(plain.get_smiles()).get_smiles() === plain.get_smiles();

    const ok = marks === d.size && same && trip;
    if (!ok) bad++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${key.padEnd(13)} ${heavy} heavy, `
      + `${d.size} marked${marks !== d.size ? ` but ${marks} in string` : ''}`
      + `${same ? '' : ', STRIP CHANGES MOLECULE'}${trip ? '' : ', NO ROUND TRIP'}`);
    console.log(`     ${smiles}`);
    // cis/trans bonds are written with / and \ — the backslash has to survive
    // being pasted into a JS string literal (palmitoleate's Δ9 has one)
    rows.push(`      smiles:'${smiles.replace(/\\/g, '\\\\')}',`);
    mapped.delete(); plain.delete();
  }
  console.log(`\n${rows.length} generated, ${bad} failing\n`);
  rows.forEach(r => console.log(r));
}).catch(e => console.log('ERR', e.message));
