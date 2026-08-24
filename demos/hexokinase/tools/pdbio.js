/* =====================================================================
 *  pdbio.js — read a deposited PDB into a Ca trace, and the linear
 *  algebra every tool in this folder measures with.
 *
 *  One reader for the folder. A format reader is the worst thing here to
 *  duplicate: a drifted copy does not crash, it returns numbers that are
 *  quietly wrong, and every claim this page makes is a number.
 *
 *  Superposition is Horn's quaternion method, not Kabsch-by-SVD: the
 *  optimal rotation falls out as the top eigenvector of a 4x4 symmetric
 *  matrix, which needs only Jacobi rotations, and the rotation ANGLE
 *  that the hinge measurement wants is then 2*acos(|w|) rather than
 *  something recovered from a matrix trace.
 *
 *  Real angstroms throughout. Nothing here knows about THREE or a scene.
 * ===================================================================== */
'use strict';

const AA3TO1 = {
  ALA: 'A', ARG: 'R', ASN: 'N', ASP: 'D', CYS: 'C', GLN: 'Q', GLU: 'E',
  GLY: 'G', HIS: 'H', ILE: 'I', LEU: 'L', LYS: 'K', MET: 'M', PHE: 'F',
  PRO: 'P', SER: 'S', THR: 'T', TRP: 'W', TYR: 'Y', VAL: 'V',
  MSE: 'M', SEC: 'U', PYL: 'O',
};

/* Ca trace of the first chain, one conformer only. Ligands are reported
 * but never enter the trace. */
function readCA(text) {
  const ca = [], het = new Map();
  let title = '', res = null, chain = null, unk = 0;
  for (const line of text.split('\n')) {
    const rec = line.slice(0, 6);
    if (rec === 'TITLE ') title += line.slice(10).trim() + ' ';
    else if (line.startsWith('REMARK   2 RESOLUTION.')) {
      const m = line.match(/([\d.]+)\s+ANGSTROM/);
      if (m) res = parseFloat(m[1]);
    } else if (rec === 'HET   ') {
      const id = line.slice(7, 10).trim();
      het.set(id, (het.get(id) || 0) + 1);
    } else if (rec === 'ATOM  ' || rec === 'HETATM') {
      if (line.slice(12, 16).trim() !== 'CA') continue;
      const alt = line[16];
      if (alt !== ' ' && alt !== 'A') continue;
      const name = line.slice(17, 20).trim();
      // UNK is a residue the depositors could not identify. It cannot be
      // aligned, so it is dropped -- but it is COUNTED, because dropping
      // it silently leaves a gap in the chain and a caller that never
      // hears about it will align straight across the hole.
      if (name === 'UNK') { unk++; continue; }
      if (!(name in AA3TO1)) continue;
      if (chain === null) chain = line[21];
      if (line[21] !== chain) continue;
      ca.push({
        n: parseInt(line.slice(22, 26), 10),
        res: name,
        aa: AA3TO1[name],
        x: parseFloat(line.slice(30, 38)),
        y: parseFloat(line.slice(38, 46)),
        z: parseFloat(line.slice(46, 54)),
      });
    }
  }
  return { title: title.trim(), res, chain, ca, het, unk, seq: ca.map(a => a.aa).join('') };
}

/* Secondary structure from the file's OWN HELIX and SHEET records, keyed
 * by residue number. Not computed from geometry: the depositors assigned
 * these against their density, and a page that says "eight helices"
 * should be counting theirs, not a guess made downstream. */
function readSS(text, chain) {
  const ss = new Map();
  for (const line of text.split('\n')) {
    const rec = line.slice(0, 6);
    let ch, lo, hi, kind;
    if (rec === 'HELIX ') {
      ch = line[19]; lo = parseInt(line.slice(21, 25), 10); hi = parseInt(line.slice(33, 37), 10); kind = 'H';
    } else if (rec === 'SHEET ') {
      ch = line[21]; lo = parseInt(line.slice(22, 26), 10); hi = parseInt(line.slice(33, 37), 10); kind = 'E';
    } else continue;
    if (chain && ch !== chain) continue;
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) continue;
    for (let n = lo; n <= hi; n++) ss.set(n, kind);
  }
  return ss;
}

/* Needleman-Wunsch, identity scoring. These two entries cannot be aligned
 * by a residue-number offset -- the older one was solved before the
 * sequence was right, so the offset is not constant along the chain. */
function align(a, b, { match = 1, mismatch = -1, gap = -2 } = {}) {
  const n = a.length, m = b.length;
  const S = new Int32Array((n + 1) * (m + 1));
  const P = new Uint8Array((n + 1) * (m + 1));   // 0 diag, 1 up, 2 left
  const at = (i, j) => i * (m + 1) + j;
  for (let i = 1; i <= n; i++) { S[at(i, 0)] = gap * i; P[at(i, 0)] = 1; }
  for (let j = 1; j <= m; j++) { S[at(0, j)] = gap * j; P[at(0, j)] = 2; }
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const d = S[at(i - 1, j - 1)] + (a[i - 1] === b[j - 1] ? match : mismatch);
      const u = S[at(i - 1, j)] + gap;
      const l = S[at(i, j - 1)] + gap;
      let best = d, p = 0;
      if (u > best) { best = u; p = 1; }
      if (l > best) { best = l; p = 2; }
      S[at(i, j)] = best; P[at(i, j)] = p;
    }
  }
  const pairs = [];
  let i = n, j = m;
  while (i > 0 || j > 0) {
    const p = P[at(i, j)];
    if (i > 0 && j > 0 && p === 0) { pairs.push([i - 1, j - 1]); i--; j--; }
    else if (i > 0 && p === 1) i--;
    else j--;
  }
  pairs.reverse();
  const ident = pairs.filter(([x, y]) => a[x] === b[y]).length;
  return { pairs, identity: ident / pairs.length, aligned: pairs.length };
}

const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y, z: p.z - q.z });

function centroid(pts) {
  let x = 0, y = 0, z = 0;
  for (const p of pts) { x += p.x; y += p.y; z += p.z; }
  return { x: x / pts.length, y: y / pts.length, z: z / pts.length };
}

/* Jacobi eigen-decomposition of a symmetric 4x4. Returns the eigenvector
 * of the largest eigenvalue. */
function topEigenvector4(Ain) {
  const A = Ain.map(r => r.slice());
  let V = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]];
  for (let sweep = 0; sweep < 64; sweep++) {
    let off = 0;
    for (let p = 0; p < 4; p++) for (let q = p + 1; q < 4; q++) off += A[p][q] * A[p][q];
    if (off < 1e-20) break;
    for (let p = 0; p < 4; p++) {
      for (let q = p + 1; q < 4; q++) {
        if (Math.abs(A[p][q]) < 1e-18) continue;
        const theta = (A[q][q] - A[p][p]) / (2 * A[p][q]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < 4; k++) {
          const akp = A[k][p], akq = A[k][q];
          A[k][p] = c * akp - s * akq;
          A[k][q] = s * akp + c * akq;
        }
        for (let k = 0; k < 4; k++) {
          const apk = A[p][k], aqk = A[q][k];
          A[p][k] = c * apk - s * aqk;
          A[q][k] = s * apk + c * aqk;
        }
        for (let k = 0; k < 4; k++) {
          const vkp = V[k][p], vkq = V[k][q];
          V[k][p] = c * vkp - s * vkq;
          V[k][q] = s * vkp + c * vkq;
        }
      }
    }
  }
  let best = 0;
  for (let k = 1; k < 4; k++) if (A[k][k] > A[best][best]) best = k;
  return [V[0][best], V[1][best], V[2][best], V[3][best]];
}

/* Optimal rigid superposition of `mob` onto `ref` (equal length, paired).
 * Returns the quaternion, the rotation angle in degrees, the translation
 * and the RMSD, plus apply() for any other point set. */
function superpose(mob, ref) {
  const cm = centroid(mob), cr = centroid(ref);
  const P = mob.map(p => sub(p, cm)), Q = ref.map(p => sub(p, cr));
  let Sxx = 0, Sxy = 0, Sxz = 0, Syx = 0, Syy = 0, Syz = 0, Szx = 0, Szy = 0, Szz = 0;
  for (let i = 0; i < P.length; i++) {
    const p = P[i], q = Q[i];
    Sxx += p.x * q.x; Sxy += p.x * q.y; Sxz += p.x * q.z;
    Syx += p.y * q.x; Syy += p.y * q.y; Syz += p.y * q.z;
    Szx += p.z * q.x; Szy += p.z * q.y; Szz += p.z * q.z;
  }
  const N = [
    [Sxx + Syy + Szz, Syz - Szy, Szx - Sxz, Sxy - Syx],
    [Syz - Szy, Sxx - Syy - Szz, Sxy + Syx, Szx + Sxz],
    [Szx - Sxz, Sxy + Syx, -Sxx + Syy - Szz, Syz + Szy],
    [Sxy - Syx, Szx + Sxz, Syz + Szy, -Sxx - Syy + Szz],
  ];
  let [w, x, y, z] = topEigenvector4(N);
  const norm = Math.hypot(w, x, y, z);
  w /= norm; x /= norm; y /= norm; z /= norm;
  const R = [
    [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
    [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
    [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
  ];
  const apply = pts => pts.map(p => {
    const d = sub(p, cm);
    return {
      ...p,
      x: R[0][0] * d.x + R[0][1] * d.y + R[0][2] * d.z + cr.x,
      y: R[1][0] * d.x + R[1][1] * d.y + R[1][2] * d.z + cr.y,
      z: R[2][0] * d.x + R[2][1] * d.y + R[2][2] * d.z + cr.z,
    };
  });
  const moved = apply(mob);
  let s = 0;
  for (let i = 0; i < moved.length; i++) {
    const d = sub(moved[i], ref[i]);
    s += d.x * d.x + d.y * d.y + d.z * d.z;
  }
  return {
    q: [w, x, y, z],
    angle: 2 * Math.acos(Math.min(1, Math.abs(w))) * 180 / Math.PI,
    axis: (() => { const n = Math.hypot(x, y, z); return n < 1e-9 ? [0, 0, 1] : [x / n, y / n, z / n]; })(),
    rmsd: Math.sqrt(s / moved.length),
    apply,
  };
}

const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z);

function rg(pts) {
  const c = centroid(pts);
  let s = 0;
  for (const p of pts) { const d = sub(p, c); s += d.x * d.x + d.y * d.y + d.z * d.z; }
  return Math.sqrt(s / pts.length);
}

module.exports = { AA3TO1, readCA, readSS, align, superpose, centroid, dist, rg };
