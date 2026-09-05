/* =============================================================================
 *  dna/codon.js — one base changes, and everything downstream of it is derived
 * =============================================================================
 *  A 2D figure, no canvas and no loop: a short stretch of gene drawn as aligned
 *  rows — coding strand, template strand, mRNA, protein — with one substitution
 *  marked, and the consequence WORKED OUT rather than captioned.
 *
 *  WHY IT IS A MODULE AND NOT A PICTURE IN A PAGE. The sickle lesson's first
 *  beat is GAG→GTG. The mutation lessons that come after it are the same four
 *  rows with a different letter moved, and the whole point of each is that the
 *  outcome is not chosen: a silent change and a nonsense change differ by which
 *  codon they landed in, not by what the author decided to say about them. A
 *  page that types "missense" beside its own diagram can type it beside a
 *  silent change too, and nothing on screen would object. Here the verdict, the
 *  amino acids, the template strand and the mRNA all come out of the genetic
 *  code and the sequence, so the only thing a lesson supplies is a gene and an
 *  edit.
 *
 *  Modules.md's test — would two lessons disagree about it? — is a flat no for
 *  every line in this file. The standard genetic code is not any lesson's claim.
 *
 *  ---- THE ROWS, AND THE ONE THAT IS USUALLY DRAWN WRONG --------------------
 *
 *  The template row is the complement of the coding row COLUMN BY COLUMN, and
 *  it is labelled 3′→5′ for that reason. The two strands are antiparallel, so
 *  the template read in its own 5′→3′ direction is the reverse complement — but
 *  a figure that prints the reverse complement under the coding strand has
 *  silently un-aligned its own columns, and then the base under the mutated one
 *  is not its partner. Aligned columns and honest end labels is the only
 *  combination that is both.
 *
 *  mRNA is the coding strand with U for T, which is what makes the coding
 *  strand worth drawing at all: the template is the strand polymerase reads,
 *  and the coding strand is the one the message looks like.
 *
 *  ---- WHAT IT DOES NOT OWN ------------------------------------------------
 *
 *  Reading frame: sequences arrive already in frame, and `first` only says what
 *  NUMBER to print under the first codon. Indels are out — a frameshift redraws
 *  every codon downstream and wants a different figure, not a wider one.
 *  Transcription and splicing are not modelled; this is a gene fragment, not a
 *  pre-mRNA, and a lesson that needs introns needs its own row.
 *
 *  ---- COLOUR ---------------------------------------------------------------
 *
 *  Bases take --base-A/T/G/C/U, published from palette.js at load, so a letter
 *  here is the colour of the same base in dna-structure's helix. Amino acids
 *  are NOT coloured on a scale of their own: charge takes the site's --hot and
 *  --cold, which already mean positive and negative everywhere else, and the
 *  two uncharged classes stay ink. sickle/sickle.js's Kyte-Doolittle colouring
 *  is a different job — a continuous surface property on a real structure —
 *  and the two should not be made to look like one vocabulary.
 *
 *  Loads as a plain script, no THREE, no scene. Needs codon.css, and
 *  tokens-from-palette.js for the base colours. Node-loadable, which is how
 *  check-codon.js runs THIS rather than a copy of it.
 *  See codon-test.html for the smallest working host.
 * ========================================================================== */
'use strict';

(function (root) {

/* ---- THE STANDARD GENETIC CODE ------------------------------------------
 * NCBI translation table 1, in its canonical packed form: the 64 codons in
 * TCAG order on each of the three positions, and one letter for each. Packed
 * rather than written out as 64 lines because a table typed by hand is a table
 * with a typo in it, and this form is checkable against a published string.
 * check-codon.js spot-checks named codons and asserts the degeneracy counts,
 * which is what would catch an off-by-one in the unpacking.
 */
const ORDER = 'TCAG';
const PACKED = 'FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG';
const CODE = {};
for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++)
  CODE[ORDER[i] + ORDER[j] + ORDER[k]] = PACKED[i * 16 + j * 4 + k];

/* Side-chain class in the four buckets a Bio 101 course uses. Glycine, cysteine
 * and tryptophan sit on boundaries every textbook draws slightly differently;
 * they are placed the common way and none of them carries a lesson here. */
const AA = {
  F:{three:'Phe',name:'phenylalanine',klass:'nonpolar'},
  L:{three:'Leu',name:'leucine',      klass:'nonpolar'},
  I:{three:'Ile',name:'isoleucine',   klass:'nonpolar'},
  M:{three:'Met',name:'methionine',   klass:'nonpolar'},
  V:{three:'Val',name:'valine',       klass:'nonpolar'},
  A:{three:'Ala',name:'alanine',      klass:'nonpolar'},
  G:{three:'Gly',name:'glycine',      klass:'nonpolar'},
  P:{three:'Pro',name:'proline',      klass:'nonpolar'},
  W:{three:'Trp',name:'tryptophan',   klass:'nonpolar'},
  S:{three:'Ser',name:'serine',       klass:'polar'},
  T:{three:'Thr',name:'threonine',    klass:'polar'},
  C:{three:'Cys',name:'cysteine',     klass:'polar'},
  Y:{three:'Tyr',name:'tyrosine',     klass:'polar'},
  N:{three:'Asn',name:'asparagine',   klass:'polar'},
  Q:{three:'Gln',name:'glutamine',    klass:'polar'},
  D:{three:'Asp',name:'aspartate',    klass:'acidic'},
  E:{three:'Glu',name:'glutamate',    klass:'acidic'},
  K:{three:'Lys',name:'lysine',       klass:'basic'},
  R:{three:'Arg',name:'arginine',     klass:'basic'},
  H:{three:'His',name:'histidine',    klass:'basic'},
  '*':{three:'Stop',name:'stop',      klass:'stop'},
};

const COMP = { A:'T', T:'A', G:'C', C:'G' };
const complement  = b => COMP[b] || 'N';
const template    = s => [...s].map(complement).join('');   // column by column; see header
const transcribe  = s => s.replace(/T/g, 'U');

/* Every codon in a fragment, with the number a page prints under it. `first` is
 * the number of the FIRST codon, so a host numbers in whatever convention its
 * protein uses — HBB's mature chain starts at 1 with the initiator Met at 0,
 * because that methionine is cleaved off and never appears in the β chain. */
function translate(dna, first) {
  const out = [];
  for (let i = 0; i + 3 <= dna.length; i += 3) {
    const codon = dna.slice(i, i + 3);
    out.push({ codon, aa: CODE[codon] || '?', at: i, n: (first ?? 1) + out.length });
  }
  return out;
}

const mutate = (dna, at, to) => dna.slice(0, at) + to + dna.slice(at + 1);

/* THE VERDICT IS MEASURED, NOT DECLARED. Four outcomes, and which one it is
 * falls out of the two amino acids alone. `stop-lost` is here because it is the
 * one a page would otherwise call missense: the codon does change what is made,
 * and the change is not a swap. */
function effect(before, after) {
  if (before === after) return 'silent';
  if (after === '*')    return 'nonsense';
  if (before === '*')   return 'stop-lost';
  return 'missense';
}

/* ---- READ ---------------------------------------------------------------
 * One analysis object, and everything drawn or printed comes off it. A host
 * that wants the sentence without the figure calls this and nothing else.
 */
function read(cfg) {
  const dna = cfg.dna.toUpperCase();
  const first = cfg.first ?? 1;
  const codons = translate(dna, first);
  const res = { dna, first, codons, template: template(dna), mrna: transcribe(dna),
                protein: codons.map(c => c.aa).join('') };
  if (cfg.at == null) return res;

  const at = cfg.at, to = (cfg.to || '').toUpperCase();
  const from = dna[at];
  const ci = Math.floor(at / 3);
  const mutDna = mutate(dna, at, to);
  const wt = codons[ci], mut = translate(mutDna, first)[ci];
  res.change = {
    at, from, to, within: at % 3,          // 1st, 2nd or 3rd position of its codon
    codonIndex: ci, n: wt.n,
    was: wt.codon, now: mut.codon,
    aaWas: wt.aa,  aaNow: mut.aa,
    effect: effect(wt.aa, mut.aa),
    // The class swap is the whole sickle argument, so it is a field rather than
    // something a caption asserts. Null when nothing about the class moved.
    klassWas: AA[wt.aa].klass, klassNow: AA[mut.aa].klass,
  };
  res.mutant = read({ ...cfg, dna: mutDna, at: null });
  return res;
}

/* ---- THE FIGURE ---------------------------------------------------------
 * One CSS grid, one column per base, so every row lines up by construction
 * rather than by a width somebody tuned. The amino-acid cells span three.
 *
 * HTML rather than SVG on purpose: these are letters in columns, an SVG would
 * have to place each one, and text in an SVG cannot be selected, copied or
 * read by a screen reader as a sequence.
 */
const ROWS = ['dna', 'template', 'mrna', 'protein'];
const LABEL = {
  dna:      ["DNA <em>coding</em>",   "5′", "3′"],
  template: ["DNA <em>template</em>", "3′", "5′"],
  mrna:     ["mRNA",                  "5′", "3′"],
  protein:  ["protein",               "N",  "C"],
};

// A base cell. `hit` is the substituted column, carried down every row it
// appears in so the eye follows one column rather than hunting for a second
// highlight.
const baseCell = (b, i, hit, ci) =>
  `<span class="cb b-${b}${i === hit ? ' hit' : ''}" data-cdn="${ci % 2}">${b}</span>`;

function row(kind, res, hit) {
  const [name, l, r] = LABEL[kind];
  // A stop ends the chain, so what follows it is drawn but not made. Faded
  // rather than dropped: the codons are still there in the gene, and a nonsense
  // mutation's whole claim is that the message runs out before the gene does.
  let stopped = false;
  const cells = kind === 'protein'
    ? res.codons.map(c => {
        const a = AA[c.aa];
        const on = hit != null && Math.floor(hit / 3) === (c.at / 3);
        const past = stopped;
        if (a.klass === 'stop') stopped = true;
        return `<span class="ca${on ? ' hit' : ''}${past ? ' past' : ''}"
          data-klass="${a.klass}" data-cdn="${(c.at / 3) % 2}"
          title="${past ? 'never made — the chain stopped above' : a.name + ' — ' + a.klass}"
          ><b>${a.three}</b><i>${c.n}</i></span>`;
      }).join('')
    : [...res[kind === 'dna' ? 'dna' : kind]]
        .map((b, i) => baseCell(b, i, hit, Math.floor(i / 3))).join('');
  return `<div class="crow" data-row="${kind}">
    <span class="clab">${name}</span><span class="cend">${l}</span>
    ${cells}<span class="cend">${r}</span></div>`;
}

/* `rows` picks which of the four to draw. A beat that has not introduced
 * transcription yet draws ['dna','protein'] and the figure is still true. */
function strip(cfg) {
  const res = cfg.res || read(cfg);
  const rows = cfg.rows || ROWS;
  const hit = cfg.hit ?? (res.change ? res.change.at : null);
  const n = res.dna.length;
  return `<div class="cdn" style="--n:${n}"${cfg.title ? ` data-title="${cfg.title}"` : ''}>
    ${cfg.title ? `<div class="ctitle">${cfg.title}</div>` : ''}
    ${rows.map(k => row(k, res, hit)).join('')}
  </div>`;
}

/* ---- THE SENTENCE -------------------------------------------------------
 * Composed from `read`'s fields, never typed. The class clause appears only
 * when the class actually moved, so a conservative substitution does not get a
 * sentence implying it changed the chemistry.
 */
function verdict(res) {
  const c = res.change;
  if (!c) return '';
  const one = `<b>${c.from}→${c.to}</b> at base ${c.at + 1}, the
    ${['first','second','third'][c.within]} letter of codon ${c.n}`;
  if (c.effect === 'silent')
    return `${one}. ${c.was}→${c.now} still reads ${AA[c.aaWas].three}. <b>Silent</b> —
      the third letter of a codon is the one the code most often ignores.`;
  if (c.effect === 'nonsense')
    return `${one}. ${c.was}→${c.now} is a stop. <b>Nonsense</b> — the chain ends here,
      and everything after it is never made.`;
  const swap = `${AA[c.aaWas].three} → ${AA[c.aaNow].three}`;
  const klass = c.klassWas === c.klassNow
    ? `both ${c.klassWas}`
    : `<b>${c.klassWas} → ${c.klassNow}</b>`;
  return `${one}. ${c.was}→${c.now}: ${swap}, ${klass}. <b>${c.effect === 'stop-lost'
    ? 'Stop lost' : 'Missense'}</b> — one residue in the whole chain is different.`;
}

/* Before and after, stacked, sharing a column grid. Every view owns this
 * decision itself rather than being wrapped in a comparison from outside: what
 * two states look like side by side is a different layout in each of the three,
 * and only the view knows which. */
function strips(cfg) {
  const res = cfg.res || read(cfg);
  const rows = cfg.rows || ROWS;
  if (!res.change) return strip({ res, rows, title: cfg.title });
  const hit = res.change.at;
  return strip({ res, rows, hit, title: cfg.title || 'normal' })
       + strip({ res: res.mutant, rows, hit, title: cfg.mutTitle || 'mutant' });
}

/* ---- VIEW 2: THE CODON CARD --------------------------------------------
 * One codon, blown up, with the flow drawn downward: both DNA strands, the
 * mRNA copy, the residue. Normal and mutant stand side by side sharing one
 * label column, so the figure is one object and the eye compares across it
 * rather than between two pictures.
 *
 * WHY IT IS A SEPARATE VIEW AND NOT THE STRIP WITH ITS ENDS TRIMMED. The strip
 * argues that one column of a gene changed. This argues that a change in DNA
 * REACHES the protein, which is a claim about the arrows, and a strip has no
 * arrows to make it with. A page showing this one has usually already shown
 * where the codon sits — `chain` is what shows that.
 *
 * `focus` picks the codon; it defaults to the one the mutation is in, which is
 * the only codon a card without a `focus` could be about.
 */
const ARROW = `<svg class="ccar" viewBox="0 0 14 26" aria-hidden="true">
  <path class="s" d="M7,2 V15"/><path class="h" d="M7,24 l6,-9 h-12 z"/></svg>`;

const lets = (str, hit, cls) => [...str]
  .map((b, j) => `<span class="cb b-${b}${j === hit ? ' hit' : ''} ${cls || ''}">${b}</span>`)
  .join('');

function card(cfg) {
  const res = cfg.res || read(cfg);
  const ci = cfg.focus ?? (res.change ? res.change.codonIndex : 0);
  // Only mark a letter when the mutation is in the codon on show. A card
  // focused elsewhere is a normal codon and must not wear a ring.
  const hit = (res.change && res.change.codonIndex === ci) ? res.change.within : -1;
  const cols = res.change
    ? [[res, cfg.title || 'normal', cfg.name || ''],
       [res.mutant, cfg.mutTitle || 'mutation', cfg.mutName || '']]
    : [[res, cfg.title || '', cfg.name || '']];

  const seg = r => r.dna.slice(ci * 3, ci * 3 + 3);
  const cell = (inner, k) => `<div class="ccell ${k}">${inner}</div>`;
  const strand = (str, l, r) =>
    `<div class="cstr"><span class="cend">${l}</span>${lets(str, hit)}<span class="cend">${r}</span></div>`;

  const rowOf = fn => cols.map(c => fn(...c)).join('');
  const arrows = `<div class="cclab"></div>` + cols.map(() => `<div class="ccell">${ARROW}</div>`).join('');

  return `<div class="ccard" style="--cols:${cols.length}">
    <div class="cclab"></div>${rowOf((r, t) => `<div class="cchead">${t}</div>`)}
    <div class="cclab">DNA</div>
    ${rowOf(r => cell(strand(seg(r), '5′', '3′') + strand(template(seg(r)), '3′', '5′'), 'dna'))}
    ${arrows}
    <div class="cclab">mRNA</div>
    ${rowOf(r => cell(strand(transcribe(seg(r)), '5′', '3′'), 'mrna'))}
    ${arrows}
    <div class="cclab">protein</div>
    ${rowOf(r => { const c = r.codons[ci], a = AA[c.aa];
      return cell(`<span class="cchip" data-klass="${a.klass}"
        title="${a.name} — ${a.klass}"><b>${a.three}</b><i>${c.n}</i></span>`, 'aa'); })}
    <div class="cclab"></div>${rowOf((r, t, name) => `<div class="ccname">${name}</div>`)}
  </div>`;
}

/* ---- VIEW 3: THE WHOLE GENE --------------------------------------------
 * The chain a card is one codon of. Letters do not survive thirty codons, so
 * the bases become the thing they are — paired rungs, in their own colours —
 * and the residues stay legible as chips underneath. Wild type over mutant.
 *
 * EACH CODON IS ONE COLUMN CONTAINING ITS OWN RUNGS AND ITS OWN CHIP, so the
 * chip cannot slide out of register with the bases it is made from. The strip
 * aligns by grid; this aligns by containment; both are structural, because a
 * figure whose rows line up because somebody matched two widths stops lining up
 * the first time a residue is called Trp.
 *
 * LETTERS ONLY ON THE FOCUSED CODON. That is what makes the view scale: a gene
 * long enough to need this view is long enough that lettering all of it is a
 * grey band, and the one codon under discussion is the only one being read.
 */
function band(r, title, ci, hit, cfg) {
  const groups = r.codons.map(c => {
    const on = c.at / 3 === ci;
    const seg = r.dna.slice(c.at, c.at + 3);
    const a = AA[c.aa];
    const rungs = [...seg].map((b, j) =>
      `<i class="crung${on && j === hit ? ' hit' : ''}"><s class="b-${b}"></s><s class="b-${complement(b)}"></s></i>`
    ).join('');
    const letters = cfg.letters === false ? ''
      : `<div class="clets">${on ? lets(seg, hit, 'sm') : ''}</div>`;
    return `<span class="cgrp${on ? ' on' : ''}">
      <span class="crungs">${rungs}</span>${letters}
      <span class="cchip" data-klass="${a.klass}" title="${a.name} — ${a.klass}"
        ><b>${a.three}</b><i>${c.n}</i></span></span>`;
  }).join('');
  return `<div class="cbandwrap">
    ${title ? `<div class="cchead">${title}</div>` : ''}
    <div class="cband"><span class="cend">5′</span>${groups}<span class="cend">3′</span></div>
  </div>`;
}

function chain(cfg) {
  const res = cfg.res || read(cfg);
  const ci = cfg.focus ?? (res.change ? res.change.codonIndex : -1);
  const hit = (res.change && res.change.codonIndex === ci) ? res.change.within : -1;
  const cols = res.change
    ? [[res, cfg.title || 'wild type'], [res.mutant, cfg.mutTitle || 'mutant']]
    : [[res, cfg.title || '']];
  return `<div class="cchain">
    ${cols.map(([r, t]) => band(r, t, ci, hit, cfg)).join('')}
  </div>`;
}

/* ---- THE ONE ENTRY POINT ------------------------------------------------
 * A host names a view rather than a function, so a lesson step can carry
 * `view:'card'` in the same table as its text and a page never branches. The
 * verdict is appended by whichever view asked for it, not by the view code, so
 * a figure sitting beside prose that already says it is not made to say it
 * twice.
 */
const VIEWS = { strip: strips, card, chain };
function figure(cfg) {
  const res = cfg.res || read(cfg);
  const draw = VIEWS[cfg.view || 'strip'];
  if (!draw) throw new Error(`codon: no view '${cfg.view}' — ${Object.keys(VIEWS)}`);
  const body = draw({ ...cfg, res });
  return res.change && cfg.verdict !== false
    ? `<div class="cfig">${body}<p class="cverdict">${verdict(res)}</p></div>`
    : `<div class="cfig">${body}</div>`;
}

root.Codon = { CODE, AA, COMP, ORDER, PACKED, ROWS, VIEWS,
               complement, template, transcribe, translate, mutate, effect,
               read, verdict, figure, strip, strips, card, chain };

})(typeof window !== 'undefined' ? window : globalThis);

if (typeof module !== 'undefined' && module.exports) module.exports = globalThis.Codon;
