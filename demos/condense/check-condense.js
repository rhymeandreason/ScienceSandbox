/* =============================================================================
 *  condense/check-condense.js — the claims condense-lab.html rests on
 * =============================================================================
 *  Offline, dependency-free. Run from demos/:  node condense/check-condense.js
 *
 *  check-molecules.js already audits each `condense:` block on its own terms:
 *  the named atoms really are that group, the two halves shed exactly one
 *  water, the product's element counts are the reactants' minus it. All of that
 *  passes with the DONOR AND ACCEPTOR SWAPPED — an OH leaving one side and an H
 *  the other is O+H+H whichever way round it goes — and swapping them builds
 *  the linkage through the wrong oxygen while every count stays perfect. That
 *  error is what this file exists for, and it is not hypothetical: the first
 *  version of glucose's block had it.
 *
 *  Three claims, none of which any render could settle:
 *
 *    1. The reactant IS the product's residue, over the part of it that is
 *       RIGID. Pose a bench molecule on the product with `condense/frame.js`
 *       and every rigid atom must land exactly — not just the three the frame
 *       was built from. A fit that were merely close would let the page pose
 *       maltose and label it cellobiose.
 *
 *       Rigid means: every heavy atom except the ones that are free to turn.
 *       Three kinds are excluded, each derived rather than listed, so the
 *       exclusion cannot quietly grow to cover a real error:
 *         · hydroxyl hydrogens — an O–H rotamer is not a claim this page makes
 *         · the exocyclic C6 arm, named in the recipe as a rotor
 *         · when the reaction INVERTS, the anomeric carbon's two substituents,
 *           because that inversion is the whole difference between the two
 *           products. Those atoms are required to MOVE, and the checker fails
 *           if they do not: an α reaction that left C1 alone would be β wearing
 *           the wrong label, which is precisely the error nothing else catches.
 *    2. The linkage runs where the roles say. In the posed product, the donor's
 *       `keep` and the acceptor's `keep` must be BONDED to each other, and that
 *       bond must be the one the product's own `glycosidic:` block declares.
 *    3. The atoms that leave are gone from the product, and nothing else is.
 * ========================================================================== */
'use strict';

const F = require('./frame.js');
const { MOLECULES } = require('../lib-node.js');
// The recipe table is the page's, not a copy: read it out of the module rather
// than restating it here, so a recipe added to the lesson is a recipe checked.
const RECIPES = (() => {
  const src = require('fs').readFileSync(require('path').join(__dirname,'../condense-drag.js'),'utf8');
  const g = {};
  new Function('global', src.replace(/\}\)\(this\);\s*$/, '})(global);'))(g);
  return g.CondenseDrag.RECIPES;
})();

/* Ångströms. Not a fitting tolerance — a floating-point one. Ring atoms and
 * their substituent oxygens come out at 1e-15, because they are literally the
 * same numbers; the acceptor's H4 comes out at 0.006 because that builder
 * reaches the same axial slot by a different route through the same geometry.
 * Everything this file exists to catch is two orders of magnitude above that:
 * the anomeric inversion, the thing α and β differ by, moves an atom 4.4 Å. So
 * anything between 0.02 and 0.5 Å is a build that has genuinely drifted, and
 * failing there is the point. */
const EXACT = 0.02;
let fails = 0;
const fail = m => { fails++; console.log(`   FAIL: ${m}`); };
const nameIndex = spec => { const m={}; (spec.names||[]).forEach((n,i)=>{m[n]=i;}); return m; };
const roleOf = (spec,key) => (spec.condense.roles||[]).find(r=>r.key===key);

// Specs on disk are ångströms but `register()` has already scaled MOLECULES, so
// both sides here are display units and the comparison needs no conversion.
function posOf(spec,i){ const p=spec.atoms[i].pos; return [p[0],p[1],p[2]]; }

for (const [key,R] of Object.entries(RECIPES)) {
 for (const donor of R.donors) {
  console.log(`\n== ${key}: ${R.a} + ${donor.mol}`);
  const specA=MOLECULES[R.a], specB=MOLECULES[donor.mol];
  if(!specA||!specB){ fail(`recipe names a molecule that is not registered`); continue; }
  const roleA=roleOf(specA,R.acceptor), roleB=roleOf(specB,R.donor);
  if(!roleA||!roleB){ fail(`recipe names a role the spec does not declare`); continue; }

  // The recipe and the spec must name the same product. They are two sources
  // for one fact deliberately: the page reads the recipe, the chemistry lives
  // in the spec, and a card that named one product while building another is
  // exactly the failure that would look completely fine on screen.
  const declared=(specB.condense.makes||[]).find(x=>x.donor===R.donor && x.acceptor===R.acceptor);
  if(!declared) fail(`${donor.mol} declares no reaction ${R.donor}+${R.acceptor}`);
  else if(declared.product!==donor.product)
    fail(`the recipe says ${donor.mol} makes ${donor.product}, but the spec says ${declared.product}`);

  if(R.place!=='product'){
    // A schematic join. There is no product to measure against, and the spec
    // must SAY so rather than leave the key off — see the `product:null` note
    // in check-molecules.js.
    if(declared && declared.product!==null)
      fail(`recipe places by bond but ${donor.mol} names a product spec — pose it instead`);
    else if(R.bondLen==null)
      fail(`recipe '${key}' places by bond but declares no bondLen — the length of the `
         + `bond it draws would be a module default, which is how this card first drew `
         + `a peptide bond at an amine's 1.47 A instead of 1.33`);
    else console.log(`   OK: schematic join, no product spec, and the spec says so `
         + `(new bond ${R.bondLen} A, declared)`);
    continue;
  }

  {
    const prodKey=donor.product, config=declared&&declared.config;
    const prod=MOLECULES[prodKey];
    if(!prod){ fail(`product '${prodKey}' is not registered`); continue; }
    const pn=nameIndex(prod);
    let bad=0;

    /* The finished molecule is posed onto the product's DISPLAYED coordinates,
     * which means its `view:` is the angle the student ends up looking at. For
     * a disaccharide that angle is load-bearing: VIEW.disaccharide was swept for
     * near-coplanar ring planes because at other angles no single camera shows
     * both rings as chairs. A product that lost its view would still pose with
     * perfect geometry and read as a blob, which no other check here would see. */
    if(!prod.view)
      fail(`${prodKey} declares no \`view:\`, so the finished molecule would be `
         + `posed at its build origin's angle — for a two-ring sugar that is the `
         + `pose where one ring stops reading as a chair`);
    /* Whether this reagent inverts at the anomeric carbon is the SPEC's claim.
     * An α-glucose reaching maltose must NOT invert — it already is that
     * configuration — and a spec that claimed otherwise would be describing a
     * bond breaking that the animation never shows. */
    const inverts=!!(declared && declared.invert);

    // ---- 1. each reactant IS a residue of the product ---------------------
    const posed={};
    for(const which of ['a','b']){
      const spec = which==='a'?specA:specB;
      const ln=nameIndex(spec), suffix=R.residue[which];
      const tri=R.triad.map(t=>({p:pn[t+suffix], l:ln[t]}));
      if(tri.some(t=>t.p===undefined||t.l===undefined)){
        fail(`${prodKey}: a triad atom is missing from residue ${suffix} or from ${spec.name}`); bad++; continue;
      }
      const m=F.match(tri.map(t=>posOf(spec,t.l)), tri.map(t=>posOf(prod,t.p)));
      posed[which]={m,ln,suffix};

      // What is allowed to turn. Derived from the spec's own bonds, never a
      // list of names — see the header.
      const adj={};
      (spec.bonds||[]).forEach(([i,j])=>{ (adj[i]=adj[i]||[]).push(j); (adj[j]=adj[j]||[]).push(i); });
      const isHydroxylH = i => spec.atoms[i].el==='H'
        && (adj[i]||[]).some(k=>spec.atoms[k].el==='O');
      const rotor = new Set((R.rotors||[]).map(n=>ln[n]).filter(i=>i!==undefined));
      // The anomeric carbon's non-ring substituents: the atoms an inverting
      // reaction turns over. `keep` is the donor's anomeric O, and its carbon
      // is the ring atom it hangs from.
      const anomeric = new Set();
      if(which==='b' && inverts){
        const c = (adj[roleB.keep]||[]).find(k=>spec.atoms[k].el==='C');
        (adj[c]||[]).forEach(k=>{ if(spec.atoms[k].el!=='C') anomeric.add(k); });
      }

      let worst=0, worstAt=null, n=0, moved=0;
      for(const [nm,li] of Object.entries(ln)){
        const pi=pn[nm+suffix];
        if(pi===undefined) continue;                       // an atom this residue gave up
        const d=F.len(F.sub(F.apply(m,posOf(spec,li)), posOf(prod,pi)));
        if(anomeric.has(li)){ if(d>EXACT) moved++; continue; }
        if(isHydroxylH(li) || rotor.has(li)) continue;
        n++;
        if(d>worst){ worst=d; worstAt=nm; }
      }
      if(worst>EXACT){
        fail(`${prodKey} residue ${suffix}: ${spec.name} does not superpose — ${worstAt} off by ${worst.toFixed(4)} Å `
           + `(${n} rigid atoms). The bench molecule and the product residue are not the same build, `
           + `so posing one on the other would put a shape on screen that no spec vouches for.`);
        bad++; continue;
      }
      console.log(`   OK: ${spec.name} is ${prodKey} residue ${suffix} exactly `
        + `(${n} rigid atoms, max ${worst.toExponential(1)} Å)`);
      if(which==='b' && inverts){
        if(!moved){
          fail(`${prodKey} is declared ${config} and the reaction says it inverts, but the anomeric `
             + `substituents did not move — this is the other product wearing the wrong label`);
          bad++;
        } else console.log(`   OK: ${moved} anomeric substituent(s) inverted, as ${config} requires`);
      }
    }
    if(bad) continue;

    // ---- 2. the linkage runs between the two `keep` atoms -----------------
    const keepP = (which,idx) => {
      const {ln,suffix}=posed[which];
      const nm=Object.keys(ln).find(k=>ln[k]===idx);
      return { nm, pi:pn[nm+suffix] };
    };
    const kd=keepP('b',roleB.keep), ka=keepP('a',roleA.keep);
    if(kd.pi===undefined||ka.pi===undefined){
      fail(`${prodKey}: a role's kept atom (${kd.nm}/${ka.nm}) is not in the product — the roles are the wrong way round`);
      continue;
    }
    const bonded=(prod.bonds||[]).some(b=>(b[0]===kd.pi&&b[1]===ka.pi)||(b[1]===kd.pi&&b[0]===ka.pi));
    if(!bonded){
      fail(`${prodKey}: ${kd.nm} and ${ka.nm} are not bonded — the declared roles do not build this linkage`);
      continue;
    }
    const gly=prod.glycosidic;
    if(gly){
      if(gly.config!==config)
        fail(`${prodKey} is declared ${gly.config} but the recipe reaches it on the ${config} face`);
      else if(![gly.bridge,gly.anomeric,gly.partner].includes(kd.pi) ||
              ![gly.bridge,gly.anomeric,gly.partner].includes(ka.pi))
        fail(`${prodKey}: the new bond ${kd.nm}–${ka.nm} is not part of the declared glycosidic linkage`);
      else console.log(`   OK: ${kd.nm}–${ka.nm} is ${prodKey}'s declared ${gly.config}-${gly.link||'1→4'} linkage`);
    }

    // ---- 3. what left, left; nothing else did ----------------------------
    for(const [which,role] of [['b',roleB],['a',roleA]]){
      const {ln,suffix}=posed[which];
      const spec = which==='a'?specA:specB;
      const stillThere=role.leaves.filter(i=>{
        const nm=Object.keys(ln).find(k=>ln[k]===i);
        return nm!==undefined && pn[nm+suffix]!==undefined;
      });
      if(stillThere.length)
        fail(`${prodKey}: ${spec.name} residue ${suffix} still carries `
           + `${stillThere.map(i=>spec.names[i]).join(', ')}, which the reaction says left with the water`);
    }
  }
 }
}

console.log('');
if(fails){ console.log(`FAIL: ${fails} broken condensation claim(s)`); process.exit(1); }
console.log('PASS: every posed reactant is its product residue exactly; every declared '
  + 'linkage runs between the atoms the roles keep; every leaving atom is absent from the product');
