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
 *  (hemoglobin/surface-test.html is the page the format was developed in,
 *  and it switched over the moment it had to load two surfaces.)
 *
 *  Real angstroms out. No materials, no scene — the page owns those. What it
 *  DOES own beyond the format is the arithmetic over a decoded surface that
 *  every caller would otherwise write again: which vertices a residue owns
 *  (`colors`), and which triangles a patch is (`triangles` / `patchGeo`).
 *  Both are pure and both are checked in kit/check-kit.js.
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

  /* ------------------------------------------------------------------ *
   *  PAINTING, and MARKING. Two different things, and the reason they are
   *  two is a limit of one mesh having one material.
   * ------------------------------------------------------------------ *
   *  colors() is per-residue colour splatted per vertex — a recolour is one
   *  Float32Array and no rebuild, which is what lets a page change what the
   *  skin SAYS while proving the molecule did not move.
   *
   *  triangles() is the other half: a subset of the index, for a patch that
   *  needs its own material. A residue-sized mark on a tetramer is a few
   *  pixels across, so it cannot be a tint at the skin's own opacity — the
   *  skin wants to be faint enough to see the ribbon through, a marker wants
   *  to be solid, and those are opposite demands on one number. Per-vertex
   *  alpha cannot fix it either: it only ever MULTIPLIES the material's, so
   *  the patch could be made fainter than the skin and never bolder.
   *
   *  Both are pure — arrays in, arrays out, no THREE — so kit/check-kit.js
   *  runs them.
   */

  /* fn(chain, num, name, i) -> [r,g,b] in 0..1, or null for `fallback`.
     One call per RESIDUE, then splatted: 578 lookups rather than 64 000. */
  function colors(S, fn, fallback) {
    const back = fallback || [1, 1, 1];
    const table = S.head.residues.map((r, i) => fn(r[0], r[1], r[2], i) || back);
    const col = new Float32Array(S.nVert * 3);
    for (let v = 0; v < S.nVert; v++) {
      const c = table[S.res[v]];
      col[v * 3] = c[0]; col[v * 3 + 1] = c[1]; col[v * 3 + 2] = c[2];
    }
    return col;
  }

  /* Triangles ALL THREE of whose vertices sit on a residue the predicate
     accepts. "Any vertex" would drag in every triangle straddling the
     boundary and puff the patch out over its neighbours by a whole triangle
     in each direction — on a mark this small that is most of its apparent
     size, and it would make the patch look bigger than the residue is.
     All-three under-draws by a hair instead, which is the honest direction
     to err, and kit/check-kit.js asserts the two differ on its fixture so
     the rule cannot be quietly relaxed. */
  function triangles(S, pred) {
    const want = S.head.residues.map((r, i) => pred(r[0], r[1], r[2], i) ? 1 : 0);
    const src = S.geo ? S.geo.getIndex().array : S.index;
    const keep = [];
    for (let t = 0; t < src.length; t += 3)
      if (want[S.res[src[t]]] && want[S.res[src[t + 1]]] && want[S.res[src[t + 2]]])
        keep.push(src[t], src[t + 1], src[t + 2]);
    return keep;
  }

  /* The residues a predicate actually matched, so a page prints the name it
     found rather than the name it expected. A patch that comes back empty is
     the interesting case — buried, mis-tagged, or the wrong chain letters —
     and it is silent on screen. */
  const residues = (S, pred) =>
    S.head.residues.filter((r, i) => pred(r[0], r[1], r[2], i));

  /* A second mesh over the same buffers: SAME position and normal attribute
     objects, its own index, so three uploads each buffer once and both meshes
     draw out of it. A few hundred triangles out of 128 000. */
  function patchGeo(THREE, S, pred) {
    const keep = triangles(S, pred);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', S.geo.getAttribute('position'));
    geo.setAttribute('normal', S.geo.getAttribute('normal'));
    geo.setIndex(keep);
    geo.computeBoundingSphere();
    return { geo, tris: keep.length / 3, residues: residues(S, pred) };
  }

  global.SurfLib = { decode, chainOf, numberOf, colors, triangles, residues, patchGeo };
})(typeof window !== 'undefined' ? window : globalThis);

if (typeof module !== 'undefined' && module.exports) module.exports = globalThis.SurfLib;
