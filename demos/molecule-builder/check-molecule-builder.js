/* =============================================================================
 *  molecule-builder/check-molecule-builder.js — assert what the box claims
 * =============================================================================
 *  node molecule-builder/check-molecule-builder.js   (offline, no dependencies)
 *
 *  Two failures, both of which ship looking fine:
 *
 *   1. A RECIPE THAT ROUTES TO THE WRONG MECHANIC. The name is the only thing
 *      that decides whether a page gets CovalentDrag or IonicDrag. A name in
 *      neither module is a crash, and a name in both is worse — it runs, and it
 *      teaches the wrong chemistry. So the builder's IONIC map has to be exactly
 *      the ionic module's recipe list, no more and no less.
 *
 *   2. AN ATOM DEALT OUTSIDE THE FRAME. The builder is ORTHOGRAPHIC, so what is
 *      on screen is the frustum and nothing else — an atom past its edge is not
 *      small, it is absent. The frame is sized by the width its content needs
 *      (W_ONE / W_IONS / W_TWO), and those numbers are only right as long as no
 *      recipe deals an atom further out. Change a `start` in either drag module
 *      and the atom silently leaves the box in any panel narrower than the
 *      lesson page, which is every embedded one. So measure the constants
 *      against each recipe's OWN dealt positions rather than trusting them.
 *
 *  Both are read out of the source rather than re-typed here: a checker holding
 *  its own copy of the starts would pass a change it should have caught. The
 *  drag modules are browser IIFEs that export nothing, so the tables are lifted
 *  by parse — the same move hemoglobin's checker makes on its page.
 * ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const DEMOS = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(DEMOS, p), 'utf8');
const MolLib = require(path.join(DEMOS, 'lib/lib-node.js'));
const RADII = MolLib.PALETTE.radii;
// atomkit draws a valence cloud at 1.85x the display radius, and a cloud that
// runs off the edge reads exactly as badly as a clipped sphere
const CLOUD = 1.85;

let fails = 0, checks = 0;
function ok(what){ checks++; console.log('  ok    ' + what); }
function fail(what){ fails++; console.log('  FAIL  ' + what); }
function assert(cond, what){ cond ? ok(what) : fail(what); }

/* ---- lifting the tables ------------------------------------------------
 * Brace-matched from `const NAME = {` so a nested object or a comment holding a
 * brace cannot end the block early. */
function block(src, name){
  const at = src.indexOf('const ' + name + ' = {');
  if (at < 0) throw new Error('no ' + name + ' in source');
  let i = src.indexOf('{', at), depth = 0;
  for (let j = i; j < src.length; j++){
    if (src[j] === '{') depth++;
    else if (src[j] === '}' && --depth === 0) return src.slice(i, j+1);
  }
  throw new Error('unterminated ' + name);
}
// top-level keys of a lifted block: `  name: {` at the block's own first level
function keysOf(text){
  const keys = [];
  let depth = 0;
  const re = /([A-Za-z_$][\w$]*)\s*:\s*\{|\{|\}/g;
  let m;
  while ((m = re.exec(text))){
    if (m[1]){ if (depth === 1) keys.push(m[1]); depth++; }
    else if (m[0] === '{') depth++;
    else depth--;
  }
  return keys;
}
function sectionOf(text, key){
  const at = text.search(new RegExp('(^|[\\s{,])' + key + '\\s*:\\s*\\{'));
  if (at < 0) return null;
  let i = text.indexOf('{', at), depth = 0;
  for (let j = i; j < text.length; j++){
    if (text[j] === '{') depth++;
    else if (text[j] === '}' && --depth === 0) return text.slice(i, j+1);
  }
  return null;
}
const numbers = s => (s.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
// every [x,y,z] triple in an array literal named `field`
function triples(text, field){
  const at = text.indexOf(field + ':');
  if (at < 0) return [];
  const open = text.indexOf('[', at);
  let depth = 0, end = open;
  for (let j = open; j < text.length; j++){
    if (text[j] === '[') depth++;
    else if (text[j] === ']' && --depth === 0){ end = j; break; }
  }
  return (text.slice(open, end+1).match(/\[\s*-?[\d.]+\s*,[^\[\]]*\]/g) || [])
    .map(numbers).filter(a => a.length === 3);
}
const constOf = (src, name) => {
  const m = src.match(new RegExp('const\\s+[^;]*\\b' + name + '\\s*=\\s*(-?[\\d.]+)'));
  return m ? Number(m[1]) : null;
};

const covSrc  = read('lib/covalent-drag.js');
const ionSrc  = read('lib/ionic-drag.js');
const boxSrc  = read('molecule-builder/molecule-builder.js');

/* ---- 1. every recipe routes to exactly one mechanic ---- */
console.log('\n== 1. recipe routing');
const covRecipes = keysOf(block(covSrc, 'RECIPES'));
const ionRecipes = keysOf(block(ionSrc, 'RECIPES'));
const routed = keysOf(block(boxSrc, 'IONIC')).length
  ? keysOf(block(boxSrc, 'IONIC'))
  : (block(boxSrc, 'IONIC').match(/([A-Za-z_$][\w$]*)\s*:/g) || [])
      .map(s => s.replace(/\s*:$/, ''));

const both = covRecipes.filter(r => ionRecipes.includes(r));
assert(both.length === 0,
  'no recipe is defined by both drag modules' + (both.length ? ' — ' + both.join(', ') : ''));

const missing = ionRecipes.filter(r => !routed.includes(r));
assert(missing.length === 0,
  'every ionic recipe is routed to IonicDrag' + (missing.length ? ' — ' + missing.join(', ') + ' would silently get the covalent mechanic' : ''));

const stray = routed.filter(r => !ionRecipes.includes(r));
assert(stray.length === 0,
  'nothing is routed to IonicDrag that it does not define' + (stray.length ? ' — ' + stray.join(', ') : ''));
console.log('        covalent: ' + covRecipes.join(' ') + '\n        ionic:    ' + ionRecipes.join(' '));

/* ---- 2. the frame is wide enough for what each recipe deals ---- */
console.log('\n== 2. every dealt atom is inside the frame');
const W_ONE  = constOf(boxSrc, 'W_ONE');
const W_IONS = constOf(boxSrc, 'W_IONS');
const W_TWO  = constOf(boxSrc, 'W_TWO');
assert([W_ONE, W_IONS, W_TWO].every(n => typeof n === 'number' && n > 0),
  'the three frame widths are readable from the module');

// the half-width a recipe needs: its furthest dealt atom, plus that atom's own
// drawn extent. The core sits at the origin and never out-reaches a ligand.
function needed(starts, el){
  const r = (RADII[el] || 0.7) * CLOUD;
  return Math.max(...starts.map(p => Math.abs(p[0]))) + r;
}

const covBlock = block(covSrc, 'RECIPES');
covRecipes.forEach(name => {
  const sec = sectionOf(covBlock, name);
  const st = triples(sec, 'start');
  const lig = (sec.match(/ligand\s*:\s*'(\w+)'/) || [])[1];
  if (!st.length || !lig) return fail(name + ': could not read its start positions');
  const need = needed(st, lig);
  assert(need <= W_ONE,
    name + ': deals to ' + need.toFixed(2) + ', frame carries ' + W_ONE.toFixed(2));
});

const ionBlock = block(ionSrc, 'RECIPES');
const startBlock = block(ionSrc, 'STARTS');
ionRecipes.forEach(name => {
  const sec = sectionOf(ionBlock, name);
  const n = Number((sec.match(/\bn\s*:\s*(\d+)/) || [])[1]);
  const metal = (sec.match(/metal\s*:\s*'(\w+)'/) || [])[1];
  const nonmetal = (sec.match(/nonmetal\s*:\s*'(\w+)'/) || [])[1];
  const layout = sectionOf(startBlock, String(n)) || startBlock.split(String(n) + ':')[1];
  const nons = triples(layout, 'nons');
  const met = triples(layout, 'metal').concat(
    (numbers((layout.match(/metal\s*:\s*\[[^\]]*\]/) || [''])[0]).length === 3
      ? [numbers((layout.match(/metal\s*:\s*\[[^\]]*\]/) || [''])[0])] : []));
  if (!nons.length || !met.length) return fail(name + ': could not read its start positions');
  const need = Math.max(needed(nons, nonmetal), needed(met, metal));
  assert(need <= W_IONS,
    name + ': deals to ' + need.toFixed(2) + ', frame carries ' + W_IONS.toFixed(2));
});

/* The reagent stages deal a SECOND molecule at the edge of the frame, so it is
 * not already inside the reaction when the student arrives. It is placed by the
 * page's own water code rather than by a `start`, so this asserts the ordering
 * the widening depends on rather than re-deriving the position. */
assert(W_TWO > W_ONE && W_TWO > W_IONS,
  'the two-molecule frame is wider than both one-molecule frames');

console.log('');
if (fails){
  console.log('FAIL: ' + fails + ' of ' + checks + ' checks');
  process.exit(1);
}
console.log('PASS: every recipe routes to exactly one mechanic, and every atom '
  + 'either drag module deals is inside the frame the builder opens with');
