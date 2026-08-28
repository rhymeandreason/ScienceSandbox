#!/usr/bin/env node
/* =============================================================================
 *  proteins/cif-lib.js — mmCIF in, PDB-shaped text out
 * =============================================================================
 *  Node only, offline, no dependencies. One job: hand `proteins/bake-lib.js` a
 *  file it already knows how to read.
 *
 *  WHY THIS EXISTS AT ALL. A deposition too big for the legacy format is not
 *  published in it — RCSB returns 404 for the .pdb and nothing else. Human ATP
 *  synthase is the case that forced this: 8H9S is 28 chains and 40,000 atoms,
 *  the whole machine at 2.53 A, and it is mmCIF or it is nothing. The same is
 *  true of most cryo-EM work large enough to be interesting, so this will not
 *  be the last protein to need it.
 *
 *  IT IS A TRANSLATION, NOT A SECOND PARSER, and that distinction is the whole
 *  design. Every rule about what a trace CONTAINS — one copy per residue,
 *  secondary structure read and never detected, ss indexed by residue number,
 *  `nums` beside `first` — lives in `bake-lib.js` and must keep living in
 *  exactly one place. A second reader would be a second set of those rules,
 *  drifting quietly, and the drift would show up as a ribbon that is subtly
 *  wrong in a way no page could report. So this file converts the RECORDS and
 *  decides nothing: it emits ATOM, HETATM, HELIX, SHEET, SSBOND, SEQRES,
 *  MODRES, CONECT, EXPDTA, REMARK 2 and COMPND, and `bake-lib.js` reads that
 *  text as if it had come off the wire.
 *
 *  WHAT IT REFUSES TO DO QUIETLY. Three things could silently produce a
 *  plausible wrong file, and each throws instead:
 *
 *    · A CHAIN ID WIDER THAN ONE CHARACTER. The PDB column is one character
 *      and mmCIF's is not. Truncating 'AA' and 'AB' to 'A' merges two chains
 *      into one, which parses fine and draws a ribbon splined between two
 *      molecules. Any entry with wide ids has to be handled deliberately.
 *    · MORE THAN 99,999 ATOMS. The serial column is five wide, and CONECT
 *      refers to it — an overflowed serial is connectivity pointing at the
 *      wrong atom.
 *    · NO ATOM RECORDS. An empty conversion that returns valid-looking text
 *      bakes an empty trace.
 *
 *  SECONDARY STRUCTURE COMES FROM `struct_conf` AND `struct_sheet_range`,
 *  which are the depositors' own assignment — the mmCIF spelling of HELIX and
 *  SHEET. The auth_ numbering is used throughout, never label_, because auth_
 *  is what the PDB records carried and what a paper quotes. An entry with
 *  neither category converts to a file with no HELIX or SHEET lines, which
 *  `bake-lib.js` reports as `ssFrom: 'none'` and bakes as visible coil — the
 *  same honest failure a records-free PDB gets, rather than a detector.
 *
 *  RESOLUTION IS LOOKED FOR IN THREE PLACES, because it lives in a different
 *  one per method: `refine.ls_d_res_high` for crystallography,
 *  `em_3d_reconstruction.resolution` for cryo-EM, and `reflns.d_resolution_high`
 *  where a refinement block is absent. Missing, it is simply not written, and
 *  `Bake.resolution` returns null rather than a number nobody measured.
 *
 *  Used by: proteins/atp-synthase/tools/prep.js, via `Bake.fromCif`.
 * ============================================================================= */
'use strict';

/* ---- tokens ------------------------------------------------------------
 *
 *  mmCIF values are whitespace-separated, except when they are single- or
 *  double-quoted, and except when they are a semicolon block spanning lines.
 *  A quote only closes a value when whitespace or end-of-line follows it —
 *  which is why `5'-ATP` is one token and not a runaway string.
 */
function* tokens(text) {
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/\r$/, '');

    /* A semicolon in column 1 opens a block that runs to the next one. */
    if (line.startsWith(';')) {
      let v = line.slice(1);
      while (++i < lines.length && !lines[i].startsWith(';')) v += '\n' + lines[i];
      yield { v: v.trim(), quoted: true };
      continue;
    }
    if (line.startsWith('#')) continue;

    let j = 0;
    while (j < line.length) {
      const ch = line[j];
      if (ch === ' ' || ch === '\t') { j++; continue; }
      if (ch === '#') break;                       // trailing comment
      if (ch === "'" || ch === '"') {
        let k = j + 1;
        for (;;) {
          k = line.indexOf(ch, k);
          if (k < 0) { k = line.length; break; }
          if (k + 1 >= line.length || line[k + 1] === ' ' || line[k + 1] === '\t') break;
          k++;
        }
        yield { v: line.slice(j + 1, k), quoted: true };
        j = k + 1;
        continue;
      }
      let k = j;
      while (k < line.length && line[k] !== ' ' && line[k] !== '\t') k++;
      yield { v: line.slice(j, k), quoted: false };
      j = k;
    }
  }
}

const isTag = t => !t.quoted && t.v.startsWith('_');
const isWord = (t, w) => !t.quoted && t.v.toLowerCase() === w;

/* Every item and every loop in the file, keyed by category. A loop becomes
   {tags, rows} with the category stripped off each tag, so a caller asks for
   `loop('atom_site').tags.indexOf('auth_asym_id')` and not for a full name. */
function parse(text) {
  const items = new Map(), loops = new Map();
  const T = [...tokens(text)];
  let i = 0;
  while (i < T.length) {
    const t = T[i];
    if (isWord(t, 'loop_')) {
      i++;
      const tags = [];
      while (i < T.length && isTag(T[i])) tags.push(T[i++].v);
      const rows = [];
      /* Values run until the next tag, the next loop_, or the next data_
         block. A quoted token that happens to read 'loop_' is a value, which
         is what the `quoted` flag is carried for. */
      while (i < T.length && !isTag(T[i]) &&
             !(!T[i].quoted && /^(loop_|data_|save_|stop_|global_)/i.test(T[i].v))) {
        const row = [];
        for (let k = 0; k < tags.length && i < T.length; k++) row.push(T[i++].v);
        rows.push(row);
      }
      if (tags.length) loops.set(tags[0].split('.')[0].slice(1),
                                 { tags: tags.map(x => x.split('.')[1]), rows });
      continue;
    }
    if (isTag(t)) { items.set(t.v.slice(1), i + 1 < T.length ? T[i + 1].v : ''); i += 2; continue; }
    i++;
  }
  return { items, loops };
}

/* A value that is present. mmCIF writes '?' for unknown and '.' for
   inapplicable, and both mean "do not print a number here". */
const has = v => v !== undefined && v !== null && v !== '?' && v !== '.' && v !== '';

/* Rows of one category as objects, whether the file wrote it as a loop or —
   because there was exactly one of them — as plain items. Both spellings are
   legal and an entry with a single helix uses the second. */
function rowsOf(cif, cat) {
  const L = cif.loops.get(cat);
  if (L) return L.rows.map(r => Object.fromEntries(L.tags.map((t, i) => [t, r[i]])));
  const one = {};
  let any = false;
  for (const [k, v] of cif.items) {
    if (!k.startsWith(cat + '.')) continue;
    one[k.slice(cat.length + 1)] = v;
    any = true;
  }
  return any ? [one] : [];
}

const item = (cif, key) => {
  if (cif.items.has(key)) return cif.items.get(key);
  const dot = key.lastIndexOf('.');
  const r = rowsOf(cif, key.slice(0, dot))[0];
  return r ? r[key.slice(dot + 1)] : undefined;
};

/* ---- writing PDB columns -----------------------------------------------
 *
 *  Built by writing into a padded buffer at explicit indices rather than with
 *  a format string, because the only thing that matters here is that a column
 *  lands where `bake-lib.js` slices for it, and an index is checkable against
 *  the format where a `%4s` in a run of them is not.
 */
function card(tag) {
  const buf = new Array(80).fill(' ');
  for (let i = 0; i < tag.length; i++) buf[i] = tag[i];
  const put = (at, s, width) => {
    s = String(s);
    if (width !== undefined) s = s.length > width ? s.slice(0, width) : s.padStart(width);
    for (let i = 0; i < s.length; i++) buf[at + i] = s[i];
  };
  put.text = (at, s) => { for (let i = 0; i < s.length; i++) buf[at + i] = s[i]; };
  put.done = () => buf.join('').replace(/\s+$/, '');
  return put;
}

const ok = v => (has(v) ? v : ' ');

/* An atom name is left-justified from column 14 unless the element is two
   letters, which starts in 13. Getting this wrong renames CA (alpha carbon)
   to a calcium and vice versa, and `caTrace` matches on the trimmed name, so
   the failure is a trace that comes back empty. */
function atomName(name, el) {
  if (name.length >= 4) return name;
  return (el.length === 2 ? name.padEnd(3) : ' ' + name.padEnd(3)).slice(0, 4);
}

/* ---- the conversion ---------------------------------------------------- */

function fromCif(text, opts) {
  const cif = parse(text);
  const O = opts || {};
  const out = [];

  /* -- what the entry is, for a file that has to stay self-describing ---- */

  const title = item(cif, 'struct.title');
  if (has(title)) out.push('TITLE     ' + title.replace(/\s+/g, ' '));

  const method = item(cif, 'exptl.method');
  if (has(method)) out.push('EXPDTA    ' + method.toUpperCase());

  /* Three homes for one number, by method. First one present wins, and the
     order is refinement before reconstruction because an entry carrying both
     was refined against the map and the refinement is the sharper claim. */
  const res = ['refine.ls_d_res_high', 'em_3d_reconstruction.resolution',
               'reflns.d_resolution_high']
    .map(k => item(cif, k)).find(has);
  if (has(res)) {
    const p = card('REMARK   2');
    p.text(11, 'RESOLUTION.');
    p(30, (+res).toFixed(2), 5);
    p.text(36, 'ANGSTROMS.');
    out.push(p.done());
  }

  /* -- atoms ------------------------------------------------------------- */

  const A = cif.loops.get('atom_site');
  if (!A) throw new Error('cif: no atom_site loop — nothing to convert');
  const col = {};
  A.tags.forEach((t, i) => { col[t] = i; });
  const need = ['group_PDB', 'type_symbol', 'label_atom_id', 'label_alt_id',
                'Cartn_x', 'Cartn_y', 'Cartn_z', 'auth_asym_id', 'auth_seq_id',
                'auth_comp_id'];
  for (const k of need)
    if (col[k] === undefined) throw new Error(`cif: atom_site has no ${k}`);

  /* MODEL 1 ONLY, decided here rather than left to `Bake.modelOne`: an mmCIF
     ensemble interleaves its models in one loop instead of separating them
     with ENDMDL, so there is no marker for that function to cut at. Baking
     twenty interleaved copies of one chain is the failure this prevents, and
     it is invisible until the render. */
  const mcol = col.pdbx_PDB_model_num;
  const model1 = mcol === undefined ? null : (A.rows.length ? A.rows[0][mcol] : null);

  /* Serial numbers are OURS, renumbered from 1, not the file's `id`. mmCIF
     ids are unbounded and the PDB column is five wide, so a large entry's own
     ids would overflow it — and CONECT points AT this column, which makes an
     overflowed serial into connectivity between the wrong two atoms. */
  const serialOf = new Map();
  const key = (ch, seq, ins, atom, alt) =>
    `${ch}|${seq}|${has(ins) ? ins : ''}|${atom}|${has(alt) ? alt : ''}`;

  let serial = 0;
  const chainIds = new Set();
  const atomLines = [];
  for (const row of A.rows) {
    if (model1 !== null && row[mcol] !== model1) continue;

    const chain = row[col.auth_asym_id];
    if (chain.length !== 1)
      throw new Error(`cif: auth_asym_id '${chain}' is ${chain.length} characters; ` +
        'the PDB chain column is one, and truncating merges two chains into one');
    chainIds.add(chain);

    if (++serial > 99999)
      throw new Error('cif: more than 99,999 atoms; the PDB serial column ' +
        'is five wide and CONECT refers to it');

    const el = (row[col.type_symbol] || '').toUpperCase();
    const name = row[col.label_atom_id].replace(/"/g, '');
    const alt = row[col.label_alt_id];
    const ins = col.pdbx_PDB_ins_code === undefined ? '.' : row[col.pdbx_PDB_ins_code];

    serialOf.set(key(chain, row[col.auth_seq_id], ins, name, alt), serial);

    const p = card(row[col.group_PDB] === 'HETATM' ? 'HETATM' : 'ATOM');
    p(6, serial, 5);
    p.text(12, atomName(name, el));
    p.text(16, ok(alt)[0]);
    p.text(17, row[col.auth_comp_id].padStart(3).slice(0, 3));
    p.text(21, chain);
    p(22, row[col.auth_seq_id], 4);
    p.text(26, ok(ins)[0]);
    p(30, (+row[col.Cartn_x]).toFixed(3), 8);
    p(38, (+row[col.Cartn_y]).toFixed(3), 8);
    p(46, (+row[col.Cartn_z]).toFixed(3), 8);
    p(54, has(row[col.occupancy]) ? (+row[col.occupancy]).toFixed(2) : '1.00', 6);
    p(60, has(row[col.B_iso_or_equiv]) ? (+row[col.B_iso_or_equiv]).toFixed(2) : '0.00', 6);
    p(76, el, 2);
    atomLines.push(p.done());
  }
  if (!serial) throw new Error('cif: atom_site loop has no rows for model 1');

  /* -- what the entry says its molecules are ----------------------------- */

  /* COMPND, rebuilt from the entity descriptions and the chains that actually
     carry each one. `Bake.chainsDeclared` and `Bake.ecNumbers` both read these
     lines, so an entry converted without them would come back claiming no
     chains and no reaction. */
  const entityChains = new Map();
  if (col.label_entity_id !== undefined) {
    for (const row of A.rows) {
      if (model1 !== null && row[mcol] !== model1) continue;
      const e = row[col.label_entity_id];
      if (!entityChains.has(e)) entityChains.set(e, new Set());
      entityChains.get(e).add(row[col.auth_asym_id]);
    }
  }
  const compnd = [];
  let molId = 0;
  for (const e of rowsOf(cif, 'entity')) {
    if (e.type && e.type !== 'polymer') continue;
    const chs = entityChains.get(e.id);
    if (!chs || !chs.size) continue;
    molId++;
    compnd.push(`MOL_ID: ${molId};`);
    if (has(e.pdbx_description))
      compnd.push(`MOLECULE: ${e.pdbx_description.replace(/\s+/g, ' ')};`);
    compnd.push(`CHAIN: ${[...chs].join(', ')};`);
    if (has(e.pdbx_ec)) compnd.push(`EC: ${e.pdbx_ec};`);
  }
  compnd.forEach((s, i) => {
    const p = card('COMPND');
    if (i) p(8, i + 1, 2);
    /* Column 11 on the first line and 12 on a continuation, exactly as RCSB
       writes it. Not cosmetic: `Bake.ecNumbers` matches on `\bEC:`, and a
       continuation number butted against the text gives `4EC:`, where there is
       no word boundary and the entry silently stops being an enzyme. */
    p.text(i ? 11 : 10, s);
    out.push(p.done());
  });

  /* SEQRES, off `pdbx_poly_seq_scheme` — the length the entry DECLARES each
     chain is, which is what completeness is measured against and is never the
     same question as how many residues were modelled. */
  const scheme = new Map();
  for (const r of rowsOf(cif, 'pdbx_poly_seq_scheme')) {
    const ch = r.pdb_strand_id;
    if (!ch || !chainIds.has(ch)) continue;
    if (!scheme.has(ch)) scheme.set(ch, []);
    scheme.get(ch).push(r.mon_id);
  }
  for (const [ch, seq] of scheme) {
    for (let i = 0; i < seq.length; i += 13) {
      const p = card('SEQRES');
      p(7, i / 13 + 1, 4);
      p.text(11, ch);
      p(13, seq.length, 4);
      seq.slice(i, i + 13).forEach((m, k) => p.text(19 + k * 4, m.padStart(3).slice(0, 3)));
      out.push(p.done());
    }
  }

  /* -- secondary structure, as deposited --------------------------------- */

  for (const h of rowsOf(cif, 'struct_conf')) {
    if (!/^HELX/i.test(h.conf_type_id || '')) continue;
    if (!has(h.beg_auth_asym_id)) continue;
    const p = card('HELIX');
    p.text(19, h.beg_auth_asym_id);
    p(21, h.beg_auth_seq_id, 4);
    p.text(31, h.end_auth_asym_id);
    p(33, h.end_auth_seq_id, 4);
    out.push(p.done());
  }
  for (const s of rowsOf(cif, 'struct_sheet_range')) {
    if (!has(s.beg_auth_asym_id)) continue;
    const p = card('SHEET');
    p.text(21, s.beg_auth_asym_id);
    p(22, s.beg_auth_seq_id, 4);
    p.text(32, s.end_auth_asym_id);
    p(33, s.end_auth_seq_id, 4);
    out.push(p.done());
  }

  /* -- modified residues -------------------------------------------------- */

  for (const m of rowsOf(cif, 'pdbx_struct_mod_residue')) {
    const p = card('MODRES');
    p.text(12, (m.auth_comp_id || m.label_comp_id || '').padStart(3).slice(0, 3));
    p.text(16, m.auth_asym_id || ' ');
    p(18, m.auth_seq_id || '', 4);
    out.push(p.done());
  }

  /* -- connectivity, deposited and never inferred ------------------------- */

  /* `struct_conn` is where an mmCIF puts what a PDB split between SSBOND and
     CONECT. A disulfide becomes SSBOND; everything else covalent or metallic
     becomes CONECT, so a baker drawing a pocket from a converted file gets
     the same deposited bonds it would from a .pdb — and does not fall back to
     a distance cutoff, which draws a porphyrin with its diagonals filled in. */
  const conn = rowsOf(cif, 'struct_conn');
  const conect = new Map();
  for (const c of conn) {
    const end = n => ({
      ch: c[`ptnr${n}_auth_asym_id`], seq: c[`ptnr${n}_auth_seq_id`],
      ins: c[`pdbx_ptnr${n}_PDB_ins_code`],
      atom: (c[`ptnr${n}_label_atom_id`] || '').replace(/"/g, ''),
      alt: c[`pdbx_ptnr${n}_label_alt_id`],
    });
    const a = end(1), b = end(2);
    const type = (c.conn_type_id || '').toLowerCase();

    if (type === 'disulf') {
      const p = card('SSBOND');
      p.text(15, a.ch); p(17, a.seq, 4);
      p.text(29, b.ch); p(31, b.seq, 4);
      out.push(p.done());
      continue;
    }
    if (type !== 'covale' && type !== 'metalc') continue;
    const i = serialOf.get(key(a.ch, a.seq, a.ins, a.atom, a.alt));
    const j = serialOf.get(key(b.ch, b.seq, b.ins, b.atom, b.alt));
    if (i === undefined || j === undefined) continue;
    if (!conect.has(i)) conect.set(i, new Set());
    if (!conect.has(j)) conect.set(j, new Set());
    conect.get(i).add(j);
    conect.get(j).add(i);
  }

  /* The bonds INSIDE a ligand, which struct_conn does not list — it records
     what connects one component to another, and takes the rest as read from
     the chemical dictionary the entry ships in `chem_comp_bond`. A pocket
     drawn without these is a scatter of unbonded spheres where a nucleotide
     should be. */
  const dict = new Map();
  for (const b of rowsOf(cif, 'chem_comp_bond')) {
    if (!dict.has(b.comp_id)) dict.set(b.comp_id, []);
    dict.get(b.comp_id).push([b.atom_id_1.replace(/"/g, ''), b.atom_id_2.replace(/"/g, '')]);
  }
  if (dict.size) {
    for (const row of A.rows) {
      if (model1 !== null && row[mcol] !== model1) continue;
      if (row[col.group_PDB] !== 'HETATM') continue;
      const comp = row[col.auth_comp_id];
      const pairs = dict.get(comp);
      if (!pairs) continue;
      const ch = row[col.auth_asym_id], seq = row[col.auth_seq_id];
      const ins = col.pdbx_PDB_ins_code === undefined ? '.' : row[col.pdbx_PDB_ins_code];
      const alt = row[col.label_alt_id];
      const me = row[col.label_atom_id].replace(/"/g, '');
      for (const [x, y] of pairs) {
        if (x !== me) continue;
        const i = serialOf.get(key(ch, seq, ins, x, alt));
        const j = serialOf.get(key(ch, seq, ins, y, alt));
        if (i === undefined || j === undefined) continue;
        if (!conect.has(i)) conect.set(i, new Set());
        if (!conect.has(j)) conect.set(j, new Set());
        conect.get(i).add(j);
        conect.get(j).add(i);
      }
    }
  }

  out.push(...atomLines);

  for (const [i, set] of [...conect].sort((a, b) => a[0] - b[0])) {
    const partners = [...set].sort((a, b) => a - b);
    for (let k = 0; k < partners.length; k += 4) {
      const p = card('CONECT');
      p(6, i, 5);
      partners.slice(k, k + 4).forEach((j, n) => p(11 + n * 5, j, 5));
      out.push(p.done());
    }
  }
  out.push('END');

  const text2 = out.filter(Boolean).join('\n') + '\n';
  if (O.report) O.report({
    atoms: serial, chains: chainIds.size,
    helices: rowsOf(cif, 'struct_conf').filter(h => /^HELX/i.test(h.conf_type_id || '')).length,
    strands: rowsOf(cif, 'struct_sheet_range').length,
    seqres: scheme.size, conect: conect.size,
    resolution: has(res) ? +res : null,
  });
  return text2;
}

module.exports = { fromCif, parse, rowsOf, item };
