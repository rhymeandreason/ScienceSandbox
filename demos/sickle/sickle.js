/* =====================================================================
 *  sickle.js — hydrophobicity, and what counts as a contact.
 *
 *  SickleLib = { KD, hydro, colour, score, apply, RELATIVE_TO }
 *
 *  Two things live here, and they are here rather than in the page for the
 *  same reason glycolysis-lab's mass-action constants are lifted out of its
 *  HTML: the page PUTS A NUMBER ON SCREEN, so the number needs a checker,
 *  and a checker that re-implements the scoring is checking its own
 *  arithmetic. sickle/tools/check-sickle.js requires THIS FILE.
 *
 *  ---------------------------------------------------------------- the scale
 *
 *  Kyte-Doolittle. It is the scale a Bio 101 student meets in their
 *  textbook, which is the whole reason to prefer it here — the page is not
 *  making a research claim about transfer free energies, it is colouring a
 *  surface so that "greasy" is visible. Isoleucine +4.5 down to arginine
 *  -4.5.
 *
 *  Glutamate is -3.5. Valine is +4.2. That 7.7-unit swing on ONE residue,
 *  with the backbone not moving, is the entire lesson.
 *
 *  ------------------------------------------------------------- the contact
 *
 *  A real docking score is buried solvent-accessible surface area, and the
 *  baker measures exactly that — once, offline, at the deposited pose (585
 *  A^2; see bake-sickle.js). It cannot run per frame, so what moves while
 *  the student drags is a CONTACT SCORE: every cross-tetramer pair of side
 *  chains within CUTOFF, weighted by how greasy both partners are.
 *
 *  It is a proxy, and the page must not print it in angstroms squared. What
 *  makes it honest is that it is reported RELATIVE to the same score at the
 *  deposited pose — so 100% means "you have found the contact the crystal
 *  found", and that denominator is a measurement rather than a tuned
 *  constant. check-sickle.js asserts the deposited pose is the maximum.
 *
 *  Greasy pairs only: max(0, kd) on both sides, so two charged residues
 *  meeting score nothing. That is the claim — nonpolar surface seeks
 *  nonpolar surface — and not a smoothing choice.
 *
 *  Clashes are subtracted, not forbidden. A student who shoves one tetramer
 *  through the other should watch the number fall.
 * ===================================================================== */
(function (global) {
  'use strict';

  /* Kyte & Doolittle 1982, J Mol Biol 157:105. */
  const KD = {
    ILE: 4.5, VAL: 4.2, LEU: 3.8, PHE: 2.8, CYS: 2.5, MET: 1.9, ALA: 1.8,
    GLY: -0.4, THR: -0.7, SER: -0.8, TRP: -0.9, TYR: -1.3, PRO: -1.6,
    HIS: -3.2, GLU: -3.5, GLN: -3.5, ASP: -3.5, ASN: -3.5, LYS: -3.9, ARG: -4.5,
  };

  /* ------------------------------------------------ the shape of a contact
   *
   *  TWO MISTAKES ARE BURIED HERE, both found by measuring against the real
   *  2HBS pose rather than by reasoning, and both worth leaving written down
   *  because each looked completely reasonable while it was wrong.
   *
   *  1. A score that simply RISES as two things get closer is maximised by
   *     driving them through each other. It preferred a 4 A slide that put
   *     Val6 2.9 A from Leu88 — closer than two carbons can be — and scored
   *     that fiction twice as high as the crystal. Hence OPT and HARD: contact
   *     peaks where van der Waals contact actually happens and goes NEGATIVE
   *     inside it.
   *
   *  2. Scoring on SIDE-CHAIN CENTROIDS — one sphere per residue, which is
   *     what the page draws — cannot be fixed by any choice of constants. Two
   *     residues whose centroids sit a comfortable 4.5 A apart can have their
   *     real atoms straight through each other, so the deposited pose came out
   *     not merely sub-maximal but not even a LOCAL maximum: a 0.05 rad twist
   *     beat it. What the page draws and what the page scores are therefore
   *     deliberately different resolutions, and that is not an optimisation.
   *
   *  On atoms, with this shape, the deposited pose is the maximum to within
   *  well under a percent over every rotation and translation searched — which
   *  is the resolution floor for a coarse score comparing a 2.05 A structure
   *  to a 1.74 A one. check-sickle.js re-runs that search and owns the
   *  tolerance; nothing here should be tuned to beat it.
   */
  const NONPOLAR = new Set(['C', 'S']);   // greasy elements; N and O are not
  const CUTOFF = 7.0;      // A, between atoms: beyond this, nothing
  const OPT    = 4.0;      // A, where two carbons touch — best score
  const HARD   = 3.2;      // A, inside this they overlap and the term turns negative
  const STERIC = 3.2;      // A, any pair of atoms this close is interpenetration...
  const STERIC_W = 3.0;    // ...and costs this much, in units of a good contact

  const hydro = name => (name in KD ? KD[name] : 0);

  /* Blue polar, orange nonpolar, bone in the middle — the page's --core
     orange is the same one every other lesson uses for "this is the part
     that does the chemistry". t is KD mapped to 0..1. */
  function colour(name) {
    const t = (hydro(name) + 4.5) / 9;
    const mix = (a, b, u) => a.map((v, i) => Math.round(v + (b[i] - v) * u));
    const POLAR = [63, 122, 189], MID = [222, 214, 200], GREASY = [194, 87, 27];
    const c = t < 0.5 ? mix(POLAR, MID, t * 2) : mix(MID, GREASY, (t - 0.5) * 2);
    return (c[0] << 16) | (c[1] << 8) | c[2];
  }

  const applyRT = (R, t, p) => [0, 1, 2].map(i =>
    R[i][0] * p[0] + R[i][1] * p[1] + R[i][2] * p[2] + t[i]);

  /* mutate(atoms, chain, type) -> atoms with residue 6's side chain replaced
     BACKBONE STAYS. The whole claim of the toggle is that the fold does not
     move, so N/CA/C/O are kept exactly as deposited and only the side chain
     is grafted — from residues.js, onto residue 6's own frame. Glutamate and
     valine therefore differ in nothing but the side chain, which is what the
     student is being asked to look at. */
  const BB = new Set(['N', 'CA', 'C', 'O']);
  function mutate(atoms, chain, type, frame, graft) {
    const side = graft(type, frame.N, frame.CA, frame.C);
    return atoms
      .filter(a => !(a.ch === chain && a.res === 6 && !BB.has(a.atom)))
      .concat(side.map(s => ({ ch: chain, res: 6, name: type,
                               atom: s.name, el: s.el, p: s.p })));
  }

  /* score(donor, acceptor, R, t) -> { raw, contacts, steric }
       donor/acceptor  [{atom, el, p}]  — INTERFACE atoms only, from the bake
       R, t            the donor copy's current pose

     Attraction only between nonpolar atoms; repulsion between ALL of them.
     That asymmetry is the physics and not a shortcut — sterics do not care
     whether an atom is polar, and an earlier version that let polar atoms
     interpenetrate for free was happily maximised by burying them. */
  function score(donor, acceptor, R, t) {
    let raw = 0, contacts = 0, steric = 0;
    const c2 = CUTOFF * CUTOFF, s2 = STERIC * STERIC;

    for (const d of donor) {
      const p = applyRT(R, t, d.p);
      const greasy = NONPOLAR.has(d.el);
      for (const a of acceptor) {
        const dx = p[0] - a.p[0], dy = p[1] - a.p[1], dz = p[2] - a.p[2];
        const r2 = dx * dx + dy * dy + dz * dz;
        if (r2 > c2) continue;
        if (r2 < s2) steric++;
        if (!greasy || !NONPOLAR.has(a.el)) continue;
        const r = Math.sqrt(r2);
        /* 0 at CUTOFF, 1 at OPT, 0 again at HARD, negative inside it. */
        const f = r >= OPT ? (CUTOFF - r) / (CUTOFF - OPT) : (r - HARD) / (OPT - HARD);
        raw += f;
        if (f > 0) contacts++;
      }
    }
    return { raw: raw - steric * STERIC_W, contacts, steric };
  }

  const lib = { KD, NONPOLAR, CUTOFF, OPT, HARD, STERIC, STERIC_W,
                hydro, colour, score, mutate, applyRT };

  if (typeof module !== 'undefined' && module.exports) module.exports = lib;
  else global.SickleLib = lib;
})(typeof window !== 'undefined' ? window : globalThis);
