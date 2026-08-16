/* =====================================================================
 *  pdb.js — plumbing for pages that render deposited PDB structures.
 *
 *  NO PAGE LOADS THIS TODAY, and that is deliberate. Its consumers were
 *  protein-lab.html — deleted along with the vendored ChemDoodle because that
 *  library is GPLv3, and on the chemdoodle-archive branch — and
 *  viewer-compare.html, which is back but now carries its own orientPDB()
 *  rather than loading this. It is kept because the non-GPL
 *  protein-lab rewrite starts here — the orientation below is the part that
 *  was hard and is renderer-independent — and tools/check-pdb.js still asserts
 *  it against pdb/*.pdb every commit, so it cannot rot while it waits.
 *
 *  The ChemDoodle and 3Dmol behaviour described below is therefore history:
 *  read it as WHY this code exists, not as what it currently talks to.
 *
 *  This is the PDB-page equivalent of what scene.js does for the Three.js
 *  lessons: the parts every structure page needs and none of the lesson.
 *  It renders nothing and knows about no viewer library — it takes PDB text
 *  and gives back PDB text, so the same orientation can be handed to
 *  ChemDoodle, to 3Dmol, or to a checker.
 *
 *  Two jobs, both things the viewers get wrong or cannot do:
 *
 *  1. ORIENT.  No viewer reorients anything — ChemDoodle centres, 3Dmol fits
 *     a bounding box, and both then show the coordinates as deposited, which
 *     is an accident of crystallography rather than a chosen view. We rotate
 *     onto the principal axes of the backbone instead, which is repeatable
 *     and structure-independent: CLAUDE.md's "never hand-tune a camera" rule,
 *     applied to molecules nobody here authored.
 *
 *     `mode:'axis'` points the long axis AT the camera. For a channel that
 *     axis is the pore axis, so this is the view the transport lessons want.
 *
 *     HANDEDNESS: an eigenvector's sign is arbitrary, so the basis comes out
 *     left-handed about half the time, and a left-handed rotation MIRRORS the
 *     structure. Measured on three test files, two needed the flip. A mirrored
 *     protein is the failure MolecularGeometry.md §1.3 says internal checks are
 *     blind to, so `orient()` guards det = +1 and `tools/check-pdb.js` asserts
 *     chirality survives — with a signed volume, because distances do not
 *     distinguish a mirror.
 *
 *  2. READ WHAT ss THROWS AWAY.  Viewers collapse secondary structure to
 *     helix/sheet/coil. The file says more: the HELIX record's class column
 *     separates alpha from 3-10 from pi. `helices()` returns it so a lesson
 *     can colour honestly.
 *
 *  Coordinates here are real angstroms and stay that way — this file never
 *  sees SCALE. It is not part of the MolLib registry and no mol-*.js touches it.
 * ===================================================================== */
'use strict';

const PDBLib = (function () {

  const isAtom = l => l.startsWith('ATOM') || l.startsWith('HETATM');
  const xyz = l => [+l.slice(30, 38), +l.slice(38, 46), +l.slice(46, 54)];

  /* Jacobi rotation for a symmetric 3x3. Returns eigenvalues descending.
     Small and exact enough here; a general solver would be more code than
     the three-by-three case deserves. */
  function jacobiEigen(A) {
    A = A.map(r => r.slice());
    const V = [[1,0,0],[0,1,0],[0,0,1]];
    for (let sweep = 0; sweep < 24; sweep++) {
      if (A[0][1]**2 + A[0][2]**2 + A[1][2]**2 < 1e-14) break;
      for (const [p, q] of [[0,1],[0,2],[1,2]]) {
        if (Math.abs(A[p][q]) < 1e-15) continue;
        const theta = (A[q][q] - A[p][p]) / (2 * A[p][q]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta*theta + 1));
        const c = 1 / Math.sqrt(t*t + 1), s = t * c;
        for (let k = 0; k < 3; k++) { const a = A[k][p], b = A[k][q]; A[k][p] = c*a - s*b; A[k][q] = s*a + c*b; }
        for (let k = 0; k < 3; k++) { const a = A[p][k], b = A[q][k]; A[p][k] = c*a - s*b; A[q][k] = s*a + c*b; }
        for (let k = 0; k < 3; k++) { const a = V[k][p], b = V[k][q]; V[k][p] = c*a - s*b; V[k][q] = s*a + c*b; }
      }
    }
    return [0,1,2].map(i => ({ val: A[i][i], vec: [V[0][i], V[1][i], V[2][i]] }))
                  .sort((a, b) => b.val - a.val);
  }

  const det3 = m =>
      m[0][0]*(m[1][1]*m[2][2] - m[1][2]*m[2][1])
    - m[0][1]*(m[1][0]*m[2][2] - m[1][2]*m[2][0])
    + m[0][2]*(m[1][0]*m[2][1] - m[1][1]*m[2][0]);

  /* orient(pdbText, {mode, long}) -> pdbText
       'pca'       widest face to the camera; `long:'x'` (default) or `long:'y'`
                   chooses which screen axis the molecule's long axis lies along
       'axis'      long axis at the camera (looking down a channel's pore)
       'deposited' unchanged

     WHY `long` EXISTS. ChemDoodle fits its camera from the vertical field of
     view alone — no aspect term (`x = t / (tan(fov/2)/0.8)`) — so anything wider
     than the viewport is clipped, and `long:'x'` is the worst case for a narrow
     stage. `long:'y'` always fits, because the vertical extent is exactly what
     the fit solves for. A caller that knows its aspect ratio should pick.
     This is CLAUDE.md's "never hand-tune a camera", pushed into the one place
     we control when the viewer's own framing is not aspect-aware.
     Only the coordinate columns are rewritten; HELIX/SHEET/SEQRES and the rest
     of the file pass through untouched. */
  function orient(pdb, opts) {
    const mode = (opts && opts.mode) || 'pca';
    if (mode === 'deposited') return pdb;

    const lines = pdb.split('\n');
    const all = [], ref = [];
    for (const l of lines) {
      if (!isAtom(l)) continue;
      const p = xyz(l);
      if (!p.every(Number.isFinite)) continue;
      all.push(p);
      const name = l.slice(12, 16).trim();
      // backbone only — side chains would weight the axes by how bulky residues are
      if (name === 'CA' || name === 'P') ref.push(p);
    }
    const pts = ref.length > 10 ? ref : all;
    if (pts.length < 3) return pdb;

    const n = pts.length;
    const c = [0,1,2].map(i => pts.reduce((s, p) => s + p[i], 0) / n);
    const C = [[0,0,0],[0,0,0],[0,0,0]];
    for (const p of pts)
      for (let i = 0; i < 3; i++)
        for (let j = 0; j < 3; j++) C[i][j] += (p[i]-c[i]) * (p[j]-c[j]) / n;

    const e = jacobiEigen(C).map(x => x.vec);
    // rows of R become screen x, y, z
    let R = mode === 'axis' ? [e[1], e[2], e[0]]
          : (opts && opts.long === 'y') ? [e[1], e[0], e[2]]
          : [e[0], e[1], e[2]];
    if (det3(R) < 0) R = [R[0], R[1], R[2].map(v => -v)];   // never mirror — see header

    const f = v => v.toFixed(3).padStart(8).slice(0, 8);
    return lines.map(l => {
      if (!isAtom(l)) return l;
      const p = xyz(l);
      if (!p.every(Number.isFinite)) return l;
      const d = [p[0]-c[0], p[1]-c[1], p[2]-c[2]];
      const q = R.map(ax => ax[0]*d[0] + ax[1]*d[1] + ax[2]*d[2]);
      return l.slice(0, 30) + f(q[0]) + f(q[1]) + f(q[2]) + l.slice(54);
    }).join('\n');
  }

  /* helices(pdbText) -> { alpha, three10, pi }, each { chainId: ["5-15", ...] }
     HELIX is fixed-column (PDB v3.3): 20 initChainID, 22-25 initSeqNum,
     34-37 endSeqNum, 39-40 helixClass (1 = right-handed alpha, 3 = pi, 5 = 3-10).
     Columns are 1-indexed in the spec, hence the -1 in every slice. */
  function helices(pdb) {
    const out = { alpha: {}, three10: {}, pi: {} };
    for (const line of pdb.split('\n')) {
      if (!line.startsWith('HELIX ')) continue;
      const cls = parseInt(line.slice(38, 40), 10);
      const bucket = cls === 5 ? out.three10 : cls === 3 ? out.pi : out.alpha;
      const chain = line.slice(19, 20).trim() || line.slice(31, 32).trim();
      const start = parseInt(line.slice(21, 25), 10);
      const end   = parseInt(line.slice(33, 37), 10);
      if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
      (bucket[chain] = bucket[chain] || []).push(`${start}-${end}`);
    }
    return out;
  }

  /* Counts for a page that wants to state what it is showing. */
  function summary(pdb) {
    const chains = new Set();
    let atoms = 0, residues = new Set(), het = 0;
    for (const l of pdb.split('\n')) {
      if (!isAtom(l)) continue;
      atoms++;
      if (l.startsWith('HETATM')) { het++; continue; }
      const ch = l.slice(21, 22);
      chains.add(ch);
      residues.add(ch + l.slice(22, 27));
    }
    return { atoms, het, chains: [...chains].filter(c => c.trim()), residues: residues.size };
  }

  return { orient, helices, summary, _jacobiEigen: jacobiEigen, _det3: det3 };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = PDBLib;
