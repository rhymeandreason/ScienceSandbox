/* =============================================================================
 *  chain-repeat.js — one linkage, repeated, becomes a polymer's shape
 * =============================================================================
 *  Plain arrays: no THREE, no Stage. Browser global `ChainRepeat` and a Node
 *  export. Needs condense/frame.js for the rigid match.
 *
 *  WHAT THIS IS FOR. contrast-lab draws maltose beside cellobiose and the specs
 *  themselves say why that is as far as it goes: a polymer's coil-versus-ribbon
 *  shape is emergent from many repeats, and two repeats do not earn the
 *  polymer's name. So the student is told starch curls and cellulose does not,
 *  and has to take it. This makes the claim watchable — nothing is typed about
 *  helices, and no chain shape is designed. One transform is MEASURED off the
 *  real disaccharide (the rigid move that carries its first residue onto its
 *  second) and then applied again and again. Whatever falls out is what that
 *  linkage does.
 *
 *  THE SCREW IS THE WHOLE IDEA, and it is the same move folding/actin.js makes
 *  to stack a filament: any rigid transform is a rotation about some axis plus a
 *  slide along it. Repeat it and you necessarily get a helix — a straight ribbon
 *  is just the special case where the rotation is half a turn. So `cellulose is
 *  flat` and `starch coils` are not two behaviours, they are one transform with
 *  two different rotation angles, and the angle comes from where the glycosidic
 *  bond points.
 *
 *  WHAT IS AND IS NOT CLAIMED. The linkage CONFIGURATION is checked geometry —
 *  maltose and cellobiose carry `glycosidic:` blocks that check-molecules.js
 *  audits. The two torsions about that linkage are NOT: mol-contrast.js declares
 *  them a deliberate schematic, swept for a readable pose, because a real
 *  disaccharide's φ/ψ are floppy in solution. A chain built by repeating them
 *  inherits exactly that status.
 *
 *  So: the DIRECTION the chain takes is real, because it follows from the
 *  axial/equatorial choice the specs do assert. The PITCH is not — do not print
 *  a residues-per-turn figure next to a textbook one and imply they should
 *  match. `screwOf` returns the numbers this geometry gives; a page showing them
 *  owes the reader that sentence.
 *
 *  Usage:
 *    const s = ChainRepeat.screwOf(MOLECULES.maltose, ['O5','C1','C4'], 'A','B');
 *    ChainRepeat.extend(spec, s, 12, 'A');   // → residue coordinate sets
 * ========================================================================== */
(function(global){
  'use strict';

  const F = global.CondenseFrame
    || (typeof require==='function' ? require('./condense/frame.js') : null);

  const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
  const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const len=a=>Math.sqrt(dot(a,a));
  const unit=a=>{ const l=len(a); return l?[a[0]/l,a[1]/l,a[2]/l]:[0,0,0]; };

  const nameIndex = spec => { const m={}; (spec.names||[]).forEach((n,i)=>{m[n]=i;}); return m; };

  /* The rigid move carrying residue `sufA` onto residue `sufB`, plus the screw
   * it describes: how far round, and how far along, one repeat goes. */
  function screwOf(spec, triad, sufA, sufB){
    if(!F) throw new Error('chain-repeat: condense/frame.js must be loaded first');
    const n=nameIndex(spec);
    const pos=i=>{ const p=spec.atoms[i].pos; return [p[0],p[1],p[2]]; };
    const from=triad.map(t=>{ const i=n[t+sufA];
      if(i===undefined) throw new Error(`chain-repeat: no atom ${t+sufA}`); return pos(i); });
    const to=triad.map(t=>{ const i=n[t+sufB];
      if(i===undefined) throw new Error(`chain-repeat: no atom ${t+sufB}`); return pos(i); });
    const m=F.match(from,to);

    // p -> R p + d, which is the form the screw parameters come out of
    const R=m.r, d=sub(m.t, [dot(R[0],m.o), dot(R[1],m.o), dot(R[2],m.o)]);
    const tr=R[0][0]+R[1][1]+R[2][2];
    const ang=Math.acos(Math.max(-1,Math.min(1,(tr-1)/2)));
    /* The rotation axis. The antisymmetric part gives it cheaply — EXCEPT at
     * half a turn, where that part is identically zero and the formula returns
     * nothing. That is not a corner case here: a two-fold ribbon is exactly
     * 180° per residue, so cellulose, the one linkage whose answer is known in
     * advance, is precisely where the cheap formula fails. It failed silently
     * too, handing back an arbitrary axis and therefore a meaningless rise.
     *
     * Near π, use the symmetric part instead: R + I = 2·aaᵀ there, so any
     * non-zero column of it is parallel to the axis. Take the largest, which is
     * the best-conditioned one. */
    let axis;
    if(Math.PI - ang > 1e-4){
      axis=unit([R[2][1]-R[1][2], R[0][2]-R[2][0], R[1][0]-R[0][1]]);
    } else {
      const M=[[R[0][0]+1,R[0][1],R[0][2]],
               [R[1][0],R[1][1]+1,R[1][2]],
               [R[2][0],R[2][1],R[2][2]+1]];
      let k=0;
      for(let i=1;i<3;i++) if(M[i][i]>M[k][k]) k=i;
      axis=unit([M[0][k],M[1][k],M[2][k]]);
    }
    if(!len(axis)) axis=[0,0,1];
    const rise=dot(d,axis);
    return { m, angle:ang*180/Math.PI, rise:Math.abs(rise), axis,
             perTurn: ang>1e-6 ? 360/(ang*180/Math.PI) : Infinity };
  }

  /* n residues, each the previous one moved by the same transform. The atoms
   * are residue `suf`'s own, so every copy is the real residue geometry and
   * only its placement is derived. */
  function extend(spec, screw, count, suf){
    const n=nameIndex(spec);
    const idx=[], names=[];
    (spec.names||[]).forEach((nm,i)=>{
      if(nm.endsWith(suf)){ idx.push(i); names.push(nm.slice(0,-suf.length)); }
    });
    /* A residue is selected by name SUFFIX, so an atom that carries its residue
     * tag anywhere else is silently not in the chain. That is not hypothetical:
     * C6's hydrogens were once named H6A1/H6A2, so every chain drawn from these
     * specs was missing two atoms per residue — invisible, because they are
     * optional-H and the page hid them by default. Fail loudly instead. */
    const stray=(spec.names||[]).filter(nm=>!nm.endsWith(suf) && nm.includes(suf));
    if(stray.length)
      throw new Error(`chain-repeat: ${stray.join(', ')} carry residue tag '${suf}' `
        + `but do not end with it, so they would be dropped from the chain. `
        + `Name them <atom>${suf}.`);
    let cur=idx.map(i=>{ const p=spec.atoms[i].pos; return [p[0],p[1],p[2]]; });
    const out=[];
    for(let k=0;k<count;k++){
      out.push(cur.map(p=>[p[0],p[1],p[2]]));
      cur=cur.map(p=>F.apply(screw.m,p));
    }
    // bonds inside one residue, in the residue's own local numbering
    const local={}; idx.forEach((g,l)=>{ local[g]=l; });
    const bonds=(spec.bonds||[])
      .filter(b=>local[b[0]]!==undefined && local[b[1]]!==undefined)
      .map(b=>[local[b[0]], local[b[1]], b[2]||1]);
    const el=idx.map(i=>spec.atoms[i].el);
    /* The spec's own optional-H set, carried into the residue's local numbering.
     * Derived from `optH` rather than from "an H bonded to a C", because that is
     * where the decision lives: scene.js's contract is that an H on N/O/S is
     * never in it, and a page that re-derived the set could quietly start hiding
     * a hydroxyl's hydrogen. */
    const opt=new Set(spec.optH||[]);
    const optH=idx.map((g,l)=>opt.has(g)?l:-1).filter(l=>l>=0);
    return { residues:out, names, el, bonds, optH, index:nm=>names.indexOf(nm) };
  }

  const API={ screwOf, extend };
  if(typeof module!=='undefined' && module.exports) module.exports=API;
  else global.ChainRepeat=API;
})(this);
