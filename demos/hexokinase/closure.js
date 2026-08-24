/* =====================================================================
 *  closure.js — the browser half of the HXM2 trajectory format.
 *
 *  The other half is hexokinase/tools/bake-closure.js, which writes it.
 *  A reader has to match its writer byte for byte, so the two want to be
 *  read together, and the writer's header is where the format and the
 *  science are specified.
 *
 *  Closure.decode(arrayBuffer) -> {
 *    F, N              frames, residues
 *    resNum [n]        residue number, per residue
 *    lobe   [0|1|2]    0 = hinge or terminus, 1 = large lobe, 2 = small
 *    ss     'HHHCEE…'  from 1IG8's own HELIX/SHEET records
 *    frame(f) -> [[x,y,z], …]        one baked keyframe
 *    at(t)   -> [[x,y,z], …]         t in 0..1, lerped between keyframes
 *  }
 *
 *  Real angstroms out. No THREE, no materials, no scene -- the page owns
 *  those, the same arrangement SurfLib and TubeLib use.
 *
 *  at() LERPS BETWEEN KEYFRAMES, and that is safe only because the frames
 *  are dense and the path is already smooth: 41 frames over an 11 A swing
 *  is a quarter of an angstrom between neighbours, well under the
 *  tolerance check-closure.js holds the backbone to. Interpolating
 *  between two DISTANT conformations is the thing the baker exists to
 *  avoid; interpolating between adjacent frames of its output is not the
 *  same operation. Do not thin the frame count without re-running the
 *  checker.
 * ===================================================================== */
(function (global) {
  'use strict';

  const MAGIC = 'HXM2';

  function decode(arrayBuffer) {
    const dv = new DataView(arrayBuffer);
    let o = 0;
    let magic = '';
    for (; o < 4; o++) magic += String.fromCharCode(dv.getUint8(o));
    if (magic !== MAGIC) throw new Error(`closure.js: expected ${MAGIC}, got "${magic}"`);

    const F = dv.getUint16(o, true); o += 2;
    const N = dv.getUint16(o, true); o += 2;

    const resNum = new Uint16Array(N);
    for (let i = 0; i < N; i++, o += 2) resNum[i] = dv.getUint16(o, true);
    const lobe = new Uint8Array(N);
    for (let i = 0; i < N; i++, o += 1) lobe[i] = dv.getUint8(o);
    let ss = '';
    for (let i = 0; i < N; i++, o += 1) ss += String.fromCharCode(dv.getUint8(o));

    const want = o + F * N * 12;
    if (arrayBuffer.byteLength !== want)
      throw new Error(`closure.js: length ${arrayBuffer.byteLength}, header implies ${want}`);

    const coords = new Float32Array(arrayBuffer, o, F * N * 3);

    const frame = f => {
      const base = f * N * 3, out = new Array(N);
      for (let i = 0; i < N; i++)
        out[i] = [coords[base + i * 3], coords[base + i * 3 + 1], coords[base + i * 3 + 2]];
      return out;
    };

    function at(t) {
      const u = Math.max(0, Math.min(1, t)) * (F - 1);
      const a = Math.floor(u), b = Math.min(F - 1, a + 1), m = u - a;
      if (m === 0) return frame(a);
      const ba = a * N * 3, bb = b * N * 3, out = new Array(N);
      for (let i = 0; i < N; i++) {
        const p = ba + i * 3, q = bb + i * 3;
        out[i] = [
          coords[p] + (coords[q] - coords[p]) * m,
          coords[p + 1] + (coords[q + 1] - coords[p + 1]) * m,
          coords[p + 2] + (coords[q + 2] - coords[p + 2]) * m,
        ];
      }
      return out;
    }

    return { F, N, resNum, lobe, ss, frame, at };
  }

  global.Closure = { decode, MAGIC };
})(typeof window !== 'undefined' ? window : globalThis);
