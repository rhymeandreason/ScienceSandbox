#!/usr/bin/env node
/* =====================================================================
 *  check-codon.js — the assertions behind dna/codon.js
 *
 *  WHY THIS EXISTS. The strip states a verdict — silent, missense,
 *  nonsense — with complete confidence, and every way of getting it wrong
 *  renders perfectly: an unpacking that transposes two positions of the
 *  genetic code still prints a plausible three-letter residue under every
 *  codon, and a template row built as the reverse complement still lines
 *  up as four tidy rows. Neither is visible on screen. Both are here.
 *
 *  THE VACUITY TRAP IN THIS FILE is that most sequences are their own
 *  worst test case. A palindromic fragment has the same template read
 *  either way, so it cannot tell a column-by-column complement from a
 *  reversed one; a codon of three identical letters cannot tell position
 *  1 from position 3. So each of those assertions prints the precondition
 *  that makes it mean something, and fails the day a fixture is tidied
 *  into a symmetric one.
 *
 *  Run:  node dna/check-codon.js
 * ===================================================================== */
'use strict';
const C = require('./codon.js');

let fails = 0, checks = 0;
const ok = (cond, msg) => {
  checks++;
  if (!cond) { fails++; console.log('  FAIL  ' + msg); }
};
const note = msg => console.log('        · ' + msg);
const head = t => console.log('\n' + t);

/* ---- 1. the code table ------------------------------------------------ */
head('the standard genetic code');
const codons = Object.keys(C.CODE);
ok(codons.length === 64, `64 codons, got ${codons.length}`);
ok(new Set(codons).size === 64, 'every codon distinct');
ok(codons.every(k => /^[ACGT]{3}$/.test(k)), 'every key a DNA triplet');
ok(new Set(Object.values(C.CODE)).size === 21, '20 amino acids and one stop symbol');
ok(Object.values(C.CODE).every(a => C.AA[a]), 'every letter has a name and a class');

// Spot checks. The last four are mid-table on purpose: a first/third position
// swap in the unpacking leaves ATG and the stops alone and shows up here.
for (const [k, want] of Object.entries({
  ATG:'M', TGG:'W', TAA:'*', TAG:'*', TGA:'*', TTT:'F', GGG:'G',
  GAG:'E', GTG:'V', CAT:'H', ACG:'T', AGA:'R', TCA:'S', CTA:'L',
})) ok(C.CODE[k] === want, `${k} is ${want}, got ${C.CODE[k]}`);
// and the reason those spot checks are not vacuous: position order matters
ok(C.CODE['ATG'] !== C.CODE['GTA'] && C.CODE['CAT'] !== C.CODE['TAC'],
   'and the table is order-sensitive');
note(`ATG=${C.CODE.ATG} vs GTA=${C.CODE.GTA}, CAT=${C.CODE.CAT} vs TAC=${C.CODE.TAC}`
   + ' — a transposed unpacking would make these agree');

/* Degeneracy is the strongest single test of the whole table: it is a
 * fingerprint of the standard code, and no plausible mis-unpacking preserves
 * all of it. */
const count = {};
for (const a of Object.values(C.CODE)) count[a] = (count[a] || 0) + 1;
for (const [a, n] of Object.entries({
  L:6, S:6, R:6, A:4, G:4, P:4, T:4, V:4, '*':3, M:1, W:1,
  I:3, F:2, Y:2, H:2, Q:2, N:2, K:2, D:2, E:2, C:2,
})) ok(count[a] === n, `${a} has ${n} codons, got ${count[a]}`);

/* ---- 2. the two strands ---------------------------------------------- */
head('the strands');
const SEQ = 'ATGGTGCACCTGACTCCTGAGGAG';
const tpl = C.template(SEQ);
ok(tpl.length === SEQ.length, 'template is the same length, so the columns align');
ok(C.template(tpl) === SEQ, 'complementing twice returns the coding strand');
ok([...SEQ].every((b, i) => C.COMP[b] === tpl[i]), 'and it is column by column');

// The one that a palindrome cannot test. Print the precondition.
const revcomp = [...tpl].reverse().join('');
ok(tpl !== revcomp, 'the template row is NOT the reverse complement');
note(`and the fixture is genuinely non-palindromic · ${tpl.slice(0,8)}… vs `
   + `${revcomp.slice(0,8)}… — equal here would make the check vacuous`);

const mrna = C.transcribe(SEQ);
ok(!mrna.includes('T') && mrna.includes('U'), 'mRNA carries U and no T');
ok(mrna.length === SEQ.length, 'and the same length');
ok([...SEQ].filter(b => b === 'T').length === [...mrna].filter(b => b === 'U').length,
   'one U per T, nothing else touched');
note(`and the fixture contains T at all · ${[...SEQ].filter(b=>b==='T').length} of them`);

/* ---- 3. the sickle case ---------------------------------------------- */
head('HBB codon 6 — the whole of the sickle lesson\'s first beat');
const s = C.read({ dna: SEQ, first: 0, at: 19, to: 'T' });
const ch = s.change;
ok(ch.was === 'GAG' && ch.now === 'GTG', `GAG→GTG, got ${ch.was}→${ch.now}`);
ok(ch.n === 6, `it is codon 6 of the mature chain, got ${ch.n}`);
ok(ch.within === 1, 'and the second letter of that codon');
ok(ch.aaWas === 'E' && ch.aaNow === 'V', `Glu→Val, got ${ch.aaWas}→${ch.aaNow}`);
ok(ch.klassWas === 'acidic' && ch.klassNow === 'nonpolar',
   `acidic→nonpolar, got ${ch.klassWas}→${ch.klassNow}`);
ok(ch.effect === 'missense', `missense, got ${ch.effect}`);
ok(s.protein === 'MVHLTPEE', `the normal fragment is MVHLTPEE, got ${s.protein}`);
ok(s.mutant.protein === 'MVHLTPVE', `the mutant is MVHLTPVE, got ${s.mutant.protein}`);
// Only the one residue moves. A fit that quietly reframed would fail here.
ok([...s.protein].filter((a, i) => a !== s.mutant.protein[i]).length === 1,
   'and exactly one residue in the fragment differs');

/* ---- 4. the other three outcomes ------------------------------------- */
head('the verdict is measured, not chosen');
const cases = [
  [11, 'A', 'silent',    'CTG', 'CTA', 'L'],
  [18, 'T', 'nonsense',  'GAG', 'TAG', '*'],
  [19, 'T', 'missense',  'GAG', 'GTG', 'V'],
];
for (const [at, to, want, was, now, aa] of cases) {
  const r = C.read({ dna: SEQ, first: 0, at, to }).change;
  ok(r.effect === want, `base ${at+1} ${r.from}→${to} is ${want}, got ${r.effect}`);
  ok(r.was === was && r.now === now && r.aaNow === aa,
     `  and ${was}→${now} reads ${aa}, got ${r.was}→${r.now} = ${r.aaNow}`);
}
// stop-lost has no home in this fragment, so it gets its own.
ok(C.read({ dna: 'TAAGGG', at: 1, to: 'C' }).change.effect === 'stop-lost',
   'TAA→TCA is stop-lost, not missense');

/* THE WOBBLE CLAIM. verdict() tells the student the third letter is the one the
 * code most often ignores, so the strip is asserting something about the code
 * itself. Count it rather than believe it. */
const silentAt = [0, 0, 0];
for (const k of codons) for (let p = 0; p < 3; p++) for (const b of 'ACGT') {
  if (b === k[p]) continue;
  const alt = k.slice(0, p) + b + k.slice(p + 1);
  if (C.CODE[alt] === C.CODE[k]) silentAt[p]++;
}
ok(silentAt[2] > silentAt[0] && silentAt[0] > silentAt[1],
   'third-position changes are silent most often, second-position least');
note(`silent substitutions by position · 1st ${silentAt[0]} · 2nd ${silentAt[1]} `
   + `· 3rd ${silentAt[2]} — the sentence verdict() prints`);
// Second position is 2 rather than 0, and the two are TAA↔TGA: stop staying
// stop. No CODON CHANGING AN AMINO ACID is silent at position 2, which is the
// claim, and counting the residue swaps rather than the symbols says so.
ok(silentAt[1] === 2, 'the only second-position silent changes are stop↔stop');
note('and they are TAA↔TGA · no substitution that makes a residue is silent there');

/* ---- 5. the drawing --------------------------------------------------- */
head('the figure');
const html = C.strip({ dna: SEQ, first: 0, at: 19, to: 'T' });
const n = m => (html.match(m) || []).length;
ok(html.includes(`--n:${SEQ.length}`), 'the grid declares one column per base');
ok(n(/class="cb[ "]/g) === SEQ.length * 3, // dna, template, mrna
   `three base rows of ${SEQ.length}, got ${n(/class="cb[ "]/g)} cells`);
ok(n(/class="ca/g) === SEQ.length / 3, `${SEQ.length/3} amino-acid cells`);
ok(n(/cb.*?hit/g) === 3, 'the substituted column is marked in all three base rows');
ok(n(/ca hit/g) === 1, 'and in exactly one amino-acid cell');
// The marked residue must be the one the change is in, not the first or last.
const cells = html.match(/<span class="ca[^]*?<\/span>/g);
ok(/hit/.test(cells[6]) && !/hit/.test(cells[5]) && !/hit/.test(cells[7]),
   'and it is codon index 6, the one the base sits in');
note('and the fixture\'s mutation is mid-fragment · index 6 of 8, so an off-by-one'
   + ' at either end could not pass');
// End labels: the template row is drawn 3′→5′, which is what makes the
// column-by-column complement honest rather than a mistake.
ok(/data-row="template">\s*<span class="clab">[^]*?<\/span><span class="cend">3′/.test(html),
   'the template row is labelled 3′ at the left');

// A nonsense change must not draw the residues after its stop as though they
// were made. This is the one place the figure could contradict its own verdict.
// The MUTANT half of the pair is where the stop is; strip's own res is the
// wild type, which has no stop and would pass this vacuously.
const stopRes = C.read({ dna: SEQ, first: 0, at: 18, to: 'T' });
ok(!stopRes.protein.includes('*') && stopRes.mutant.protein.includes('*'),
   'and the stop is in the mutant only');
const stopHtml = C.strip({ res: stopRes.mutant }).match(/<span class="ca[^]*?<\/span>/g);
ok(!/past/.test(stopHtml[6]) && /past/.test(stopHtml[7]),
   'the codon after a stop is drawn as never made, and the stop itself is not');
ok(!C.strip({ dna: SEQ, first: 0 }).includes('past'),
   'and a fragment with no stop in it fades nothing');
note('and the fixture has a codon AFTER the stop · index 7 of 8, so a strip that'
   + ' ended at the stop could not pass');

const v = C.verdict(C.read({ dna: SEQ, first: 0, at: 11, to: 'A' }));
ok(/Silent/.test(v) && !/Missense/.test(v), 'a silent change is not called missense');
ok(!C.verdict(C.read({ dna: SEQ, first: 0, at: 19, to: 'T' })).includes('both'),
   'and a class that moved is not reported as unchanged');


/* ---- 6. the other two views ------------------------------------------ */
head('the card and the chain');
const SIC = { dna: SEQ, first: 0, at: 19, to: 'T' };
const cardHtml = C.card({ res: s });
// A card is ONE codon of each state, so six letters of DNA and two residues.
ok((cardHtml.match(/class="cb /g) || []).length === 3 * 3 * 2,
   'the card draws two strands and an mRNA copy of one codon, per state');
ok((cardHtml.match(/class="cchip"/g) || []).length === 2, 'and one residue per state');
ok(/Glu/.test(cardHtml) && /Val/.test(cardHtml), 'Glu on the left, Val on the right');
ok((cardHtml.match(/cb b-\w hit/g) || []).length === 6,
   'the changed column is ringed in all three rows of both states');
// A card focused on another codon is a normal codon and must wear no ring.
const away = C.card({ res: s, focus: 3 });
ok(!/hit/.test(away), 'a card focused off the mutation rings nothing');
ok(/Leu/.test(away) && !/Val/.test(away), 'and shows the codon it was asked for');
note(`and the two focuses differ · codon ${s.change.codonIndex} vs 3 — equal here`
   + ' would make the pair of checks one check');
// The card must transcribe its own segment rather than the whole gene.
const seg = SEQ.slice(19 - 1, 19 + 2);
ok(cardHtml.includes(C.transcribe(seg).split('').map(b => `>${b}<`).join('').slice(0, 2)),
   'the mRNA row is the transcript of the codon on show');

const chainHtml = C.chain({ res: s });
ok((chainHtml.match(/class="cgrp/g) || []).length === s.codons.length * 2,
   'the chain draws every codon of both states');
ok((chainHtml.match(/cgrp on/g) || []).length === 2, 'and boxes exactly one in each');
ok((chainHtml.match(/<i class="crung/g) || []).length === SEQ.length * 2,
   'one rung per base, both states');
// Letters only on the focused codon: three per state, not the whole gene.
ok((chainHtml.match(/b-\w( hit)? sm/g) || []).length === 6,
   'only the focused codon is lettered — three letters, both states');
ok(!C.chain({ res: s, letters: false }).includes('sm'), 'and letters:false turns those off');
// A rung carries the base AND its partner, which is the claim that makes it a
// rung rather than a bar. A palindromic codon could not tell the two apart.
ok(/<s class="b-G"><\/s><s class="b-C">/.test(chainHtml),
   'a rung is the base over its complement');

for (const v of Object.keys(C.VIEWS))
  ok(C.figure({ ...SIC, view: v }).includes('cverdict'), `figure('${v}') carries the verdict`);
ok(!C.figure({ ...SIC, view: 'card', verdict: false }).includes('cverdict'),
   'and verdict:false drops it');
ok(!C.figure({ dna: SEQ, first: 0, view: 'chain' }).includes('cverdict'),
   'a figure with no mutation has no verdict to carry');
let threw = false;
try { C.figure({ ...SIC, view: 'nope' }); } catch (e) { threw = true; }
ok(threw, 'an unknown view throws rather than drawing nothing');

console.log(`\n${fails ? 'FAILED' : 'ok'} — ${checks - fails}/${checks} checks passed`);
process.exit(fails ? 1 : 0);
