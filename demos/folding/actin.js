/* =====================================================================
 *  actin.js — the last two rungs of folding-lab.html's zoom-out.
 *
 *  Page-specific, like folding.js and villin.js. Renders nothing, knows about
 *  no viewer, runs in Node so its claims can be checked. Real angstroms.
 *
 * ---------------------------------------------------------------------
 *  RUNG 4 — THE FILAMENT, AND WHY IT IS LONGER THAN THE FILE
 * ---------------------------------------------------------------------
 *  9ZZI is a cryo-EM structure of F-actin in the ADP state at 2.06 A, and it
 *  contains five subunits. Five subunits is 14 nm, barely bigger than villin,
 *  and does not read as a filament — a student sees a short stack, not the
 *  thing a microvillus is built from.
 *
 *  So the segment is extended by its OWN measured symmetry. F-actin is a
 *  helical polymer: every subunit sits on the previous one under a single
 *  screw operation, and that operation can be recovered from the deposited
 *  coordinates by superposing consecutive chains. Measured here:
 *
 *      A->B   rise 27.60 A   twist -166.61 deg
 *      B->C   rise 27.59 A   twist -166.58 deg
 *      C->D   rise 27.61 A   twist -166.62 deg
 *      D->E   rise 27.60 A   twist -166.60 deg
 *
 *  Four independent measurements agreeing to 0.024 A and 0.04 deg, and both
 *  numbers land on the textbook values for F-actin (~27.5 A, ~-166.7 deg).
 *  That agreement is the licence to repeat the operation: the extra subunits
 *  are not invented, they are where the helix the file itself describes puts
 *  them. It is what any viewer does when it builds a helical assembly.
 *
 *  Still worth being straight about: only five subunits were OBSERVED. The
 *  rest are symmetry copies, and folding/tools/check-folding.js pins rise and twist
 *  so they cannot drift into fiction.
 *
 *  13 subunits by default, because ~13 is one crossover repeat (~36 nm) — the
 *  length at which the two long-pitch strands visibly cross and the thing
 *  finally looks like the filament in a textbook.
 *
 * ---------------------------------------------------------------------
 *  RUNG 5 — THE MEASUREMENT THAT THE PREDICTION COULD NOT MAKE
 * ---------------------------------------------------------------------
 *  Act 3 leaves a real question open. AlphaFold's PAE says it cannot place
 *  villin's domains relative to each other, which is why that rung offers
 *  eight arrangements instead of one. A student could reasonably conclude
 *  that nobody knows. Somebody does: 9JUS is an X-ray structure at 2.7 A of
 *  nearly complete villin (823 of 826 residues) gripping an actin trimer, and
 *  it places every domain.
 *
 *  THE SPECIES CHANGES HERE AND THE PAGE MUST SAY SO. Every villin-actin
 *  structure in the PDB is from Paralvinella sulfincola, a deep-sea
 *  hydrothermal vent worm. There is no vertebrate one. So this rung is a
 *  different animal's villin — homologous, same architecture, same job, but
 *  not the chicken protein the rest of the page has been following, and not
 *  something to caption as "your villin". The actin is rabbit alpha-skeletal
 *  in one structure and worm in the other; actin is conserved to the point
 *  where that hardly matters, and villin is not.
 *
 *  What this rung is FOR is the contrast: a prediction that could not place
 *  the domains, beside an experiment that did. That is worth more to a
 *  student than one more step outward, and it is the honest end of a ladder
 *  built on a prediction.
 * ===================================================================== */
'use strict';

const ActinLib = (function () {

  const SUBUNITS = 13;           // one crossover repeat, ~36 nm
  const RISE_REF = 27.5;         // literature, angstroms
  const TWIST_REF = -166.7;      // literature, degrees

  /* ---------------- reading ---------------- */

  /* Ca only, per chain. These are 375-residue subunits and there are up to 13
     of them: all-atom would be ~38,000 spheres for a rung drawn as a tube. */
  function parseCA(pdbText, chains) {
    const want = chains ? new Set(chains.split('')) : null;
    const out = {};
    for (const l of pdbText.split('\n')) {
      if (!l.startsWith('ATOM') || l.slice(12, 16).trim() !== 'CA') continue;
      const c = l[21];
      if (want && !want.has(c)) continue;
      const p = [+l.slice(30, 38), +l.slice(38, 46), +l.slice(46, 54)];
      if (!p.every(Number.isFinite)) continue;
      (out[c] = out[c] || []).push({ res: parseInt(l.slice(22, 26), 10), p });
    }
    return out;
  }

  /* ---------------- the screw ---------------- */

  const sub = (a, b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
  const dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
  const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
  const norm = a => { const l = Math.hypot(...a) || 1; return a.map(x => x/l); };
  const apply = (R, p) => R.map(r => dot(r, p));

  /* Kabsch, returning { R, t } with q ~ R p + t. Uses a polar decomposition
     rather than a full SVD — the same routine folding-lab uses for seating the
     folded chain, and enough for a 375-point fit. */
  function fit(P, Q) {
    const n = P.length;
    const cP = [0,1,2].map(k => P.reduce((s,p) => s+p[k], 0)/n);
    const cQ = [0,1,2].map(k => Q.reduce((s,q) => s+q[k], 0)/n);
    const H = [[0,0,0],[0,0,0],[0,0,0]];
    for (let i = 0; i < n; i++) {
      const a = sub(P[i], cP), b = sub(Q[i], cQ);
      for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) H[x][y] += a[x]*b[y];
    }
    let R = H.map(r => r.slice());
    for (let it = 0; it < 96; it++) {
      const inv = invTranspose(R);
      if (!inv) break;
      R = R.map((row, i) => row.map((v, j) => 0.5*(v + inv[i][j])));
    }
    R = [[R[0][0],R[1][0],R[2][0]],[R[0][1],R[1][1],R[2][1]],[R[0][2],R[1][2],R[2][2]]];
    return { R, t: sub(cQ, apply(R, cP)) };
  }
  function invTranspose(M) {
    const d = M[0][0]*(M[1][1]*M[2][2]-M[1][2]*M[2][1])
            - M[0][1]*(M[1][0]*M[2][2]-M[1][2]*M[2][0])
            + M[0][2]*(M[1][0]*M[2][1]-M[1][1]*M[2][0]);
    if (Math.abs(d) < 1e-12) return null;
    const c = [[0,0,0],[0,0,0],[0,0,0]];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      const a=(i+1)%3, b=(i+2)%3, x=(j+1)%3, y=(j+2)%3;
      c[j][i] = (M[a][x]*M[b][y] - M[a][y]*M[b][x]) / d;
    }
    return [[c[0][0],c[1][0],c[2][0]],[c[0][1],c[1][1],c[2][1]],[c[0][2],c[1][2],c[2][2]]];
  }

  /* The rotation axis of a rotation matrix, from its antisymmetric part.
     Exact for anything that is not a half turn, which a 166 deg screw is not.
     Shared so that decode() can rebuild it rather than the format having to
     carry a vector derivable from data it already holds. */
  function axisOf(R) {
    return norm([R[2][1]-R[1][2], R[0][2]-R[2][0], R[1][0]-R[0][1]]);
  }

  /* screwOf(chainA, chainB) -> { R, t, rise, twist, axis }
     The rigid move taking one subunit onto the next, plus the rise and twist
     that move corresponds to — which are the numbers that can be checked
     against what F-actin is known to do. */
  function screwOf(A, B) {
    const keys = A.map(a => a.res).filter(r => B.some(b => b.res === r));
    const P = keys.map(r => A.find(a => a.res === r).p);
    const Q = keys.map(r => B.find(b => b.res === r).p);
    const { R, t } = fit(P, Q);

    const tr = Math.max(-1, Math.min(1, (R[0][0]+R[1][1]+R[2][2] - 1) / 2));
    const ang = Math.acos(tr) * 180 / Math.PI;
    // rotation axis: the eigenvector with eigenvalue 1, recovered from the
    // antisymmetric part (exact for any rotation that is not exactly 180 deg)
    let axis = axisOf(R);
    let rise = dot(axis, t);
    if (rise < 0) { axis = axis.map(v => -v); rise = -rise; }

    let ref = [1,0,0];
    ref = norm(sub(ref, axis.map(v => v*dot(axis, ref))));
    const rot = apply(R, ref);
    const sign = Math.sign(dot(axis, cross(ref, rot))) || 1;
    return { R, t, axis, rise, twist: sign * ang };
  }

  /* extend(subunit, screw, n) -> [[x,y,z], ...][] — n subunits along the helix.
     Applied cumulatively from the deposited subunit, so subunit 0 is exactly
     as observed and each later one is the screw applied k times. */
  function extend(subunit, screw, n) {
    const out = [];
    let R = [[1,0,0],[0,1,0],[0,0,1]], t = [0,0,0];
    for (let k = 0; k < (n || SUBUNITS); k++) {
      out.push(subunit.map(a => {
        const p = apply(R, a.p);
        return [p[0]+t[0], p[1]+t[1], p[2]+t[2]];
      }));
      const Rn = R.map((row, i) => [0,1,2].map(j =>
        screw.R[i][0]*R[0][j] + screw.R[i][1]*R[1][j] + screw.R[i][2]*R[2][j]));
      t = [0,1,2].map(i => dot(screw.R[i], t) + screw.t[i]);
      R = Rn;
    }
    return out;
  }

  /* ---------------- the baked file ---------------- */

  /* One subunit plus a screw is all the filament needs — the page rebuilds the
     other twelve. That keeps a 1.3 MB structure (and a 5 MB one for the
     complex) out of the browser entirely.

       'ACTN' | version | subunitLen | complexLen | villinLen | (pad)
       screw   Float32[12]   R (9) then t (3)
       rise/twist Float32[2]
       subunit Float32[subunitLen*3]     one actin protomer, Ca
       complex Float32[complexLen*3]     the actin trimer of 9JUS, Ca
       villin  Float32[villinLen*3]      9JUS's villin, Ca
  */
  const MAGIC = 0x4e544341;      // 'ACTN'
  const VERSION = 1;
  const HEADER = 24;

  function encode(m) {
    const S = m.subunit.length, C = m.complexActin.length, V = m.complexVillin.length;
    const buf = new ArrayBuffer(HEADER + 4*(12 + 2 + S*3 + C*3 + V*3));
    const dv = new DataView(buf);
    dv.setUint32(0, MAGIC, true); dv.setUint32(4, VERSION, true);
    dv.setUint32(8, S, true); dv.setUint32(12, C, true); dv.setUint32(16, V, true);
    const f = new Float32Array(buf, HEADER);
    f.set([].concat(...m.screw.R, m.screw.t), 0);
    f.set([m.screw.rise, m.screw.twist], 12);
    let o = 14;
    m.subunit.forEach((p, i) => f.set(p, o + i*3));            o += S*3;
    m.complexActin.forEach((p, i) => f.set(p, o + i*3));       o += C*3;
    m.complexVillin.forEach((p, i) => f.set(p, o + i*3));
    return buf;
  }

  function decode(buf) {
    const dv = new DataView(buf);
    if (dv.getUint32(0, true) !== MAGIC) throw new Error('not a baked actin file');
    const version = dv.getUint32(4, true);
    if (version !== VERSION) throw new Error(`actin file is version ${version}, expected ${VERSION}`);
    const S = dv.getUint32(8, true), C = dv.getUint32(12, true), V = dv.getUint32(16, true);
    const need = HEADER + 4*(12 + 2 + S*3 + C*3 + V*3);
    if (buf.byteLength !== need) throw new Error(`actin file truncated: ${buf.byteLength} of ${need}`);
    const f = new Float32Array(buf, HEADER);
    const R = [[f[0],f[1],f[2]],[f[3],f[4],f[5]],[f[6],f[7],f[8]]];
    /* Axis is derived, not stored: it is a function of R, and a file that
       carried both could disagree with itself. */
    let axis = axisOf(R);
    const t = [f[9],f[10],f[11]];
    if (dot(axis, t) < 0) axis = axis.map(v => -v);
    const screw = { R, t, rise: f[12], twist: f[13], axis };
    const grab = (o, n) => { const a = []; for (let i = 0; i < n; i++) a.push([f[o+i*3], f[o+i*3+1], f[o+i*3+2]]); return a; };
    let o = 14;
    const subunit = grab(o, S);            o += S*3;
    const complexActin = grab(o, C);       o += C*3;
    const complexVillin = grab(o, V);
    return { screw, subunit, complexActin, complexVillin, subunits: SUBUNITS };
  }

  return { parseCA, screwOf, extend, encode, decode, fit, axisOf,
           SUBUNITS, RISE_REF, TWIST_REF, _apply: apply };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = ActinLib;
