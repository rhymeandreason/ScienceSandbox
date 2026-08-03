/* =====================================================================
 *  hbfold.js — read the baked hemoglobin fold.
 *
 *  HbFold.decode(arrayBuffer) -> {
 *    R, K, B, first,        residues, keyframes, H-bonds, first residue number
 *    ss     ['C','H',...]   one per residue, from 2HHB's own HELIX records
 *    bonds  [{from,to}]     the two residue numbers each H-bond joins
 *    native [[x,y,z]]       the DEPOSITED Ca trace, for reference
 *    ts     [t]             0..1, one per keyframe
 *    at(t)  -> { CA, O, H, formed }
 *  }
 *
 *  Real angstroms throughout — this page never sees MolLib.SCALE, the same
 *  arrangement folding/folding.js and folding/ribbon.js use.
 *
 *  WHY THE FILE HOLDS SO LITTLE. A backbone is four atoms per residue and a
 *  fold trajectory of all of them is 1.6 MB. This page draws a RIBBON, which
 *  needs one point per residue, plus dashes, which need two points each. So
 *  the bake keeps 146 Ca + 103 O + 103 H per keyframe and drops the rest —
 *  every atom missing here is an atom nothing draws. hemoglobin/tools/bake-hb.js
 *  writes it; its header carries the format and the reasoning, and its own
 *  decode() must stay in step with this one. THEY ARE TWO COPIES OF ONE
 *  FORMAT and check-hb.js is what keeps them honest: it decodes the
 *  committed file through bake-hb.js and asserts the geometry that comes
 *  back is the geometry that went in.
 *
 *  Loaded by hemoglobin/hemoglobin-lab.html. No dependencies, not even THREE
 *  — it returns plain arrays and lets the page decide what a point is.
 * ===================================================================== */
'use strict';

const HbFold = (() => {

  const MAGIC = 0x48424631;      // 'HBF1'
  const pad4 = n => (n + 3) & ~3;

  function decode(buffer) {
    const dv = new DataView(buffer instanceof ArrayBuffer ? buffer : buffer.buffer);
    let p = 0;
    if (dv.getUint32(p, true) !== MAGIC)
      throw new Error('not a baked hemoglobin fold (bad magic)');
    p += 4;
    const version = dv.getUint16(p, true); p += 2;
    if (version !== 1)
      throw new Error('fold file is version ' + version + ', this reader is version 1');
    const R = dv.getUint16(p, true); p += 2;
    const K = dv.getUint16(p, true); p += 2;
    const B = dv.getUint16(p, true); p += 2;
    const first = dv.getUint16(p, true); p += 2;
    p += 2;                                            // reserved
    const lo = [dv.getFloat32(p, true), dv.getFloat32(p + 4, true),
                dv.getFloat32(p + 8, true)]; p += 12;
    const scale = dv.getFloat32(p, true); p += 4;

    const ss = [];
    for (let i = 0; i < R; i++) ss.push('CHE'[dv.getUint8(p + i)] || 'C');
    p += pad4(R);

    const bonds = [];
    for (let i = 0; i < B; i++)
      bonds.push({ from: dv.getUint16(p + i * 4, true),
                   to:   dv.getUint16(p + i * 4 + 2, true) });
    p += pad4(B * 4);

    const native = [];
    for (let i = 0; i < R; i++) {
      native.push([dv.getFloat32(p, true), dv.getFloat32(p + 4, true),
                   dv.getFloat32(p + 8, true)]);
      p += 12;
    }

    const ts = [];
    for (let i = 0; i < K; i++) { ts.push(dv.getFloat32(p, true)); p += 4; }

    /* Keyframes stay as int16 in the buffer and are dequantised on demand.
       Expanding all of them to Float32 up front would be 185 x 352 x 3
       floats resident for a trajectory the page reads two keyframes of at a
       time; the multiply is cheaper than the memory. */
    const pts = R + B + B;
    const frames = [], formed = [];
    for (let f = 0; f < K; f++) {
      frames.push(new Int16Array(dv.buffer, dv.byteOffset + p, pts * 3));
      p += pad4(pts * 3 * 2);
      formed.push(new Uint8Array(dv.buffer, dv.byteOffset + p, B));
      p += pad4(B);
    }

    /* Scratch, reused across calls: at() runs once per rendered frame and
       must not allocate 352 arrays each time. */
    const outCA = [], outO = [], outH = [], outF = new Float32Array(B);
    for (let i = 0; i < R; i++) outCA.push([0, 0, 0]);
    for (let i = 0; i < B; i++) { outO.push([0, 0, 0]); outH.push([0, 0, 0]); }

    /* at(t) -> the chain at t in 0..1, linearly interpolated between the two
       nearest keyframes. Playback reads stored coordinates; NOTHING here
       runs physics, which is what makes scrubbing instant.

       THE KEYFRAMES ARE NOT EVENLY SPACED IN t, so the index cannot be
       t*(K-1). The bake snaps every 6th of 1100 solver steps and then snaps
       the last step whatever its index, which leaves 184 frames a uniform
       6/1100 apart and a final one only 2/1100 after its predecessor. Under
       the uniform assumption the two disagree by a growing fraction of a
       keyframe — 0.67 of one by the end of the fold, which measured 1.13 A
       of position error in the middle of the collapse. Small enough to look
       fine and large enough to be wrong, so the times are searched. */
    let cursor = 0;
    function at(t) {
      t = Math.max(0, Math.min(1, t));
      /* Playback walks forward, so start from where we were; scrubbing
         backward or jumping resets. Cheaper than a binary search in the
         common case and correct in every case. */
      if (ts[cursor] > t) cursor = 0;
      while (cursor < K - 2 && ts[cursor + 1] <= t) cursor++;
      const k0 = cursor, k1 = Math.min(K - 1, k0 + 1);
      const span = ts[k1] - ts[k0];
      const u = span > 1e-9 ? (t - ts[k0]) / span : 0;
      const A = frames[k0], Bf = frames[k1];
      const put = (dst, base) => {
        for (let i = 0; i < dst.length; i++)
          for (let k = 0; k < 3; k++) {
            const j = (base + i) * 3 + k;
            const a = (A[j] + 32767) * scale + lo[k];
            const b = (Bf[j] + 32767) * scale + lo[k];
            dst[i][k] = a + (b - a) * u;
          }
      };
      put(outCA, 0);
      put(outO, R);
      put(outH, R + B);
      const fa = formed[k0], fb = formed[k1];
      for (let i = 0; i < B; i++)
        outF[i] = (fa[i] + (fb[i] - fa[i]) * u) / 255;
      return { CA: outCA, O: outO, H: outH, formed: outF };
    }

    return { version, R, K, B, first, ss, bonds, native, ts, at };
  }

  return { decode, MAGIC };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = HbFold;
