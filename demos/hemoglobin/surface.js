/* =====================================================================
 *  surface.js — SurfLib: the browser half of the SES1 file format.
 *
 *  The other half is hemoglobin/tools/bake-surface.js, which writes it, and
 *  tools/ses.js, which computes the mesh. This is only the decoder — the
 *  reader has to match the writer byte for byte, so the two want to be
 *  looked at together, and the writer's header comment is where the format
 *  is actually specified.
 *
 *  WHY A MODULE. The decoder started inline in surface-test.html. The
 *  moment a second page wanted a baked surface, an inline copy would have
 *  been a second thing to keep in step with the writer — and this repo has
 *  already paid that bill once, with a tube whose winding fix reached one
 *  copy and not the other. A format reader is the worst possible thing to
 *  duplicate: a drifted copy does not crash, it draws something subtly
 *  wrong.
 *
 *  (hemoglobin/surface-test.html still has the original inline decoder. It
 *  is the page the format was developed in; switching it over is a
 *  mechanical change nobody has needed yet.)
 *
 *  Real angstroms out. No materials, no scene — the page owns those.
 * ===================================================================== */
(function (global) {
  'use strict';

  /* decode(THREE, arrayBuffer) -> { geo, head, res, nVert, nTri }

     `geo` carries position and normal. `res` is a per-vertex index into
     head.residues, each entry [chain, num, name] — which is what lets a
     page paint one residue onto the skin without knowing any geometry. */
  function decode(THREE, buf) {
    const dv = new DataView(buf);
    const magic = String.fromCharCode(dv.getUint8(0), dv.getUint8(1),
                                      dv.getUint8(2), dv.getUint8(3));
    if (magic !== 'SES1') throw new Error('not an SES1 file');

    const hlen = dv.getUint32(4, true);
    const head = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 8, hlen)));
    const n = head.nVert, t = head.nTri;

    let off = 8 + hlen + ((4 - (hlen % 4)) % 4);
    const qpos = new Uint16Array(buf, off, n * 3);       off += n * 6;
    const qnrm = new Int8Array(buf, off, n * 4);         off += n * 4;
    const res  = new Uint16Array(buf, off, n);           off += n * 2;
    const index = head.indexBits === 16
      ? new Uint16Array(buf, off, t * 3)
      : new Uint32Array(buf, off, t * 3);

    /* De-quantise positions into real angstroms. Normals stay int8 and are
       handed to the GPU normalized — three renormalises them, so the ~0.5
       degree of quantisation never becomes a visible facet. */
    const position = new Float32Array(n * 3);
    for (let v = 0; v < n; v++) for (let c = 0; c < 3; c++)
      position[v * 3 + c] = head.qmin[c] + qpos[v * 3 + c] * head.qscale[c];

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(position, 3));
    /* The normal block is stride-4 (the writer pads it for alignment), so
       the attribute steps 4 bytes and reads 3 — an interleaved view, not a
       copy. `true` is the normalized flag: the GPU turns int8 -127..127
       back into -1..1 and the shader renormalises. */
    geo.setAttribute('normal', new THREE.InterleavedBufferAttribute(
      new THREE.InterleavedBuffer(qnrm, 4), 3, 0, true));
    geo.setIndex(new THREE.BufferAttribute(index, 1));
    geo.computeBoundingSphere();

    return { geo, head, res, nVert: n, nTri: t };
  }

  /* chainOf / residueOf — the two lookups a page actually wants from `res`,
     so it never has to know that head.residues is an array of triples. */
  const chainOf = (S, v) => S.head.residues[S.res[v]][0];
  const numberOf = (S, v) => S.head.residues[S.res[v]][1];

  global.SurfLib = { decode, chainOf, numberOf };
})(typeof window !== 'undefined' ? window : globalThis);
