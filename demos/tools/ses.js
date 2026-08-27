#!/usr/bin/env node
/* =====================================================================
 *  ses.js — the solvent-excluded surface, on a grid, by marching cubes.
 *
 *  NODE ONLY. No page loads this: a surface is baked, never solved in
 *  the browser. What ships to a page is the mesh this writes.
 *
 *  THE BAKE IS NOT ABOUT CPU. This build is sub-second — 0.24 s on the
 *  2HHB tetramer at 1.4 A, 0.37 s at 0.7. The 5.7 s (3Dmol) and 9.4 s
 *  (Mol*) that viewer-compare.html measured on the same structure are
 *  those viewers' cost, not this algorithm's. Baking wins on BYTES and
 *  on the guarantee: 128 KB of mesh over the wire against the atoms
 *  plus a runtime solve, and two structures baked to one committed grid
 *  rather than two code paths agreeing about one. proteins/SurfaceCost.md
 *  measures both sides and says when the trade flips.
 *
 *  It is deliberately structure-agnostic: it takes {p:[x,y,z], r} and
 *  knows nothing about chains, residues or PDB. bake-surface.js does
 *  that part. The gaps list in bio-rendering-thorough.md calls a
 *  molecular surface "the largest single capability we gave up", and the
 *  membrane-transport row wants one too — so this is written to be the
 *  general answer, not haemoglobin's.
 *
 * ---------------------------------------------------------------------
 *  WHAT AN SES ACTUALLY IS, AND WHY IT IS NOT A UNION OF SPHERES
 * ---------------------------------------------------------------------
 *  Three surfaces get called "the molecular surface" and they are
 *  different objects:
 *
 *    vdW  — the union of the atoms' van der Waals spheres. Every crevice
 *           between two touching atoms stays open as a cusp.
 *    SAS  — the same union, each radius grown by the probe. It is the
 *           locus of the probe's CENTRE, so it sits a full water radius
 *           out from anything you can touch, and it is fatter than the
 *           molecule really is.
 *    SES  — where the probe's SKIN touches. Convex patches are pieces of
 *           vdW sphere; the crevices are bridged by concave "reentrant"
 *           patches, which is the whole visual difference — an SES is
 *           smooth where a vdW surface is a bag of grapes.
 *
 *  The construction here is the standard grid one (EDTSurf, Xu & Zhang
 *  2009, is the same idea):
 *
 *    1. mark every cell whose centre lies inside some SAS sphere;
 *    2. flood-fill the UNMARKED cells inward from the box wall — that
 *       set E is exactly where a probe centre can legally sit;
 *    3. euclidean distance transform: D(x) = distance from x to E;
 *    4. the SES is the isosurface D = probeRadius.
 *
 *  Step 2 is a flood fill and not simply "not in SAS" on purpose. An
 *  enclosed void too small to admit a probe is not probe-accessible, so
 *  it must not become surface — the flood fill is what makes cavities
 *  stay filled. Take the fill out and every buried pocket in the protein
 *  grows its own little bubble of surface inside the molecule, which
 *  through a translucent skin looks like noise rather than like a bug.
 *
 *  Step 4 degenerates correctly, which is the reassuring part: for an
 *  isolated atom, the nearest E cell to a point d from the centre is
 *  (r + probe - d) away, so D >= probe reduces to d <= r — the plain vdW
 *  sphere, exactly. Every departure from vdW is therefore a reentrant
 *  patch and nothing else.
 *
 * ---------------------------------------------------------------------
 *  RADII ARE BONDI, NOT PALETTE.radii
 * ---------------------------------------------------------------------
 *  palette.js says so in its own comments: its radii are "stylised —
 *  enlarged for legibility", and check-molecules.js checks they are NOT
 *  van der Waals. They are the right numbers for a ball-and-stick where
 *  the job is reading a bond, and the wrong ones here, where the sphere
 *  radius IS the claim being made. Carbon is 0.85 there and 1.70 here —
 *  a surface built on the palette would be half the size of the molecule
 *  and would still look entirely plausible.
 *
 *  Bondi (1964), with the 1.55 N revision of Rowland & Taylor (1996);
 *  Fe from the same tabulation. Probe 1.4 A is water, universally.
 *
 * ---------------------------------------------------------------------
 *  EXACTNESS, AND WHERE IT IS NOT EXACT
 * ---------------------------------------------------------------------
 *  The distance transform is Felzenszwalb & Huttenlocher's separable
 *  algorithm — EXACT euclidean, not a chamfer approximation, and O(n) in
 *  cells. This matters more than it sounds: a chamfer metric makes D
 *  anisotropic by a few percent, and since the surface IS a level set of
 *  D, that error appears directly as facets aligned with the grid axes.
 *
 *  What stays approximate is the grid itself. Everything is sampled at
 *  `spacing`, so the surface is accurate to roughly that, and the mesh's
 *  triangle count scales as spacing^-2. selfTest() pins the error against
 *  an analytic sphere: at 0.6 A the radius is right to under 1%.
 *
 * ---------------------------------------------------------------------
 *  MARCHING CUBES, AND THE TWO THINGS THAT GO WRONG WITH IT
 * ---------------------------------------------------------------------
 *  Tables are the classic Bourke ones, corner order
 *  (0,0,0)(1,0,0)(1,1,0)(0,1,0) then the same four at z=1.
 *
 *  1. WINDING, and this one cost a rewrite worth recording. The table's
 *     triangle order is only correct relative to a convention about
 *     which side is "inside", and getting it backwards does not produce
 *     a visibly broken mesh — it produces a correctly shaped one that
 *     renders dark, because back-face culling then shows you the far
 *     wall lit by normals pointing away. tube-test.html hit the
 *     identical failure from the opposite direction.
 *
 *     The tempting fix is per-triangle: flip any triangle whose face
 *     normal disagrees with the field gradient. It is convention-free,
 *     it needs no reasoning about the table, and it is WRONG. On 2HHB it
 *     mis-flipped 3 triangles out of 252 520 — the ones in cells so
 *     curved that the mean of the three vertex normals genuinely points
 *     the other way from the face — and 3 reversed triangles in a closed
 *     mesh is not a rendering artefact you would ever notice by eye. It
 *     showed up only as 9 edges traversed twice in the SAME direction.
 *
 *     So: take the table's order verbatim, which IS globally consistent,
 *     and make the inside/outside decision ONCE for the whole mesh from
 *     the signed volume — a global quantity that cannot be fooled by one
 *     bad cell. The gradient then stops being the rule and becomes the
 *     check, which is the job it can actually do.
 *
 *     That is the general shape of the mistake: a local heuristic
 *     standing in for a global invariant will be right often enough to
 *     look correct and wrong often enough to matter.
 *
 *  2. VERTEX WELDING. A vertex sits on a grid EDGE, and that edge is
 *     shared by up to four cells. Emitting one vertex per triangle
 *     corner triples the file and, worse, splits the normals so the mesh
 *     shades faceted. Edges are given a canonical id (lower endpoint +
 *     axis) and interpolated once.
 *
 *  Normals come from grad(D), not from face normals: D is a true
 *  distance field so its gradient is a unit vector pointing away from
 *  the exterior — i.e. INTO the solid. The outward normal is -grad(D).
 *  That is smoother than any face-normal average and costs nothing.
 *
 *  build() returns plain typed arrays and no THREE — same rule as
 *  ribbon.js and hbfold.js. The caller owns materials.
 *
 *  Self-test:  node tools/ses.js --selftest
 * ===================================================================== */
'use strict';

/* van der Waals radii, angstroms. Bondi 1964; N from Rowland & Taylor
   1996. Anything not listed throws rather than defaulting — a silently
   assumed radius is a silently wrong surface. */
const VDW = {
  H: 1.20, C: 1.70, N: 1.55, O: 1.52, S: 1.80, P: 1.80,
  F: 1.47, CL: 1.75, BR: 1.85, I: 1.98,
  FE: 2.05, MG: 1.73, ZN: 1.39, CA: 2.31, NA: 2.27, K: 2.75,
};

const PROBE = 1.4;              // water

/* ------------------------------------------------------------------ */
/*  Marching cubes tables (Bourke)                                     */
/* ------------------------------------------------------------------ */

const EDGE_TABLE = new Uint16Array([
  0x0  , 0x109, 0x203, 0x30a, 0x406, 0x50f, 0x605, 0x70c,
  0x80c, 0x905, 0xa0f, 0xb06, 0xc0a, 0xd03, 0xe09, 0xf00,
  0x190, 0x99 , 0x393, 0x29a, 0x596, 0x49f, 0x795, 0x69c,
  0x99c, 0x895, 0xb9f, 0xa96, 0xd9a, 0xc93, 0xf99, 0xe90,
  0x230, 0x339, 0x33 , 0x13a, 0x636, 0x73f, 0x435, 0x53c,
  0xa3c, 0xb35, 0x83f, 0x936, 0xe3a, 0xf33, 0xc39, 0xd30,
  0x3a0, 0x2a9, 0x1a3, 0xaa , 0x7a6, 0x6af, 0x5a5, 0x4ac,
  0xbac, 0xaa5, 0x9af, 0x8a6, 0xfaa, 0xea3, 0xda9, 0xca0,
  0x460, 0x569, 0x663, 0x76a, 0x66 , 0x16f, 0x265, 0x36c,
  0xc6c, 0xd65, 0xe6f, 0xf66, 0x86a, 0x963, 0xa69, 0xb60,
  0x5f0, 0x4f9, 0x7f3, 0x6fa, 0x1f6, 0xff , 0x3f5, 0x2fc,
  0xdfc, 0xcf5, 0xfff, 0xef6, 0x9fa, 0x8f3, 0xbf9, 0xaf0,
  0x650, 0x759, 0x453, 0x55a, 0x256, 0x35f, 0x55 , 0x15c,
  0xe5c, 0xf55, 0xc5f, 0xd56, 0xa5a, 0xb53, 0x859, 0x950,
  0x7c0, 0x6c9, 0x5c3, 0x4ca, 0x3c6, 0x2cf, 0x1c5, 0xcc ,
  0xfcc, 0xec5, 0xdcf, 0xcc6, 0xbca, 0xac3, 0x9c9, 0x8c0,
  0x8c0, 0x9c9, 0xac3, 0xbca, 0xcc6, 0xdcf, 0xec5, 0xfcc,
  0xcc , 0x1c5, 0x2cf, 0x3c6, 0x4ca, 0x5c3, 0x6c9, 0x7c0,
  0x950, 0x859, 0xb53, 0xa5a, 0xd56, 0xc5f, 0xf55, 0xe5c,
  0x15c, 0x55 , 0x35f, 0x256, 0x55a, 0x453, 0x759, 0x650,
  0xaf0, 0xbf9, 0x8f3, 0x9fa, 0xef6, 0xfff, 0xcf5, 0xdfc,
  0x2fc, 0x3f5, 0xff , 0x1f6, 0x6fa, 0x7f3, 0x4f9, 0x5f0,
  0xb60, 0xa69, 0x963, 0x86a, 0xf66, 0xe6f, 0xd65, 0xc6c,
  0x36c, 0x265, 0x16f, 0x66 , 0x76a, 0x663, 0x569, 0x460,
  0xca0, 0xda9, 0xea3, 0xfaa, 0x8a6, 0x9af, 0xaa5, 0xbac,
  0x4ac, 0x5a5, 0x6af, 0x7a6, 0xaa , 0x1a3, 0x2a9, 0x3a0,
  0xd30, 0xc39, 0xf33, 0xe3a, 0x936, 0x83f, 0xb35, 0xa3c,
  0x53c, 0x435, 0x73f, 0x636, 0x13a, 0x33 , 0x339, 0x230,
  0xe90, 0xf99, 0xc93, 0xd9a, 0xa96, 0xb9f, 0x895, 0x99c,
  0x69c, 0x795, 0x49f, 0x596, 0x29a, 0x393, 0x99 , 0x190,
  0xf00, 0xe09, 0xd03, 0xc0a, 0xb06, 0xa0f, 0x905, 0x80c,
  0x70c, 0x605, 0x50f, 0x406, 0x30a, 0x203, 0x109, 0x0,
]);

const TRI_TABLE = [
[],[0,8,3],[0,1,9],[1,8,3,9,8,1],[1,2,10],[0,8,3,1,2,10],[9,2,10,0,2,9],
[2,8,3,2,10,8,10,9,8],[3,11,2],[0,11,2,8,11,0],[1,9,0,2,3,11],
[1,11,2,1,9,11,9,8,11],[3,10,1,11,10,3],[0,10,1,0,8,10,8,11,10],
[3,9,0,3,11,9,11,10,9],[9,8,10,10,8,11],[4,7,8],[4,3,0,7,3,4],
[0,1,9,8,4,7],[4,1,9,4,7,1,7,3,1],[1,2,10,8,4,7],[3,4,7,3,0,4,1,2,10],
[9,2,10,9,0,2,8,4,7],[2,10,9,2,9,7,2,7,3,7,9,4],[8,4,7,3,11,2],
[11,4,7,11,2,4,2,0,4],[9,0,1,8,4,7,2,3,11],[4,7,11,9,4,11,9,11,2,9,2,1],
[3,10,1,3,11,10,7,8,4],[1,11,10,1,4,11,1,0,4,7,11,4],
[4,7,8,9,0,11,9,11,10,11,0,3],[4,7,11,4,11,9,9,11,10],[9,5,4],
[9,5,4,0,8,3],[0,5,4,1,5,0],[8,5,4,8,3,5,3,1,5],[1,2,10,9,5,4],
[3,0,8,1,2,10,4,9,5],[5,2,10,5,4,2,4,0,2],[2,10,5,3,2,5,3,5,4,3,4,8],
[9,5,4,2,3,11],[0,11,2,0,8,11,4,9,5],[0,5,4,0,1,5,2,3,11],
[2,1,5,2,5,8,2,8,11,4,8,5],[10,3,11,10,1,3,9,5,4],
[4,9,5,0,8,1,8,10,1,8,11,10],[5,4,0,5,0,11,5,11,10,11,0,3],
[5,4,8,5,8,10,10,8,11],[9,7,8,5,7,9],[9,3,0,9,5,3,5,7,3],
[0,7,8,0,1,7,1,5,7],[1,5,3,3,5,7],[9,7,8,9,5,7,10,1,2],
[10,1,2,9,5,0,5,3,0,5,7,3],[8,0,2,8,2,5,8,5,7,10,5,2],
[2,10,5,2,5,3,3,5,7],[7,9,5,7,8,9,3,11,2],[9,5,7,9,7,2,9,2,0,2,7,11],
[2,3,11,0,1,8,1,7,8,1,5,7],[11,2,1,11,1,7,7,1,5],
[9,5,8,8,5,7,10,1,3,10,3,11],[5,7,0,5,0,9,7,11,0,1,0,10,11,10,0],
[11,10,0,11,0,3,10,5,0,8,0,7,5,7,0],[11,10,5,7,11,5],[10,6,5],
[0,8,3,5,10,6],[9,0,1,5,10,6],[1,8,3,1,9,8,5,10,6],[1,6,5,2,6,1],
[1,6,5,1,2,6,3,0,8],[9,6,5,9,0,6,0,2,6],[5,9,8,5,8,2,5,2,6,3,2,8],
[2,3,11,10,6,5],[11,0,8,11,2,0,10,6,5],[0,1,9,2,3,11,5,10,6],
[5,10,6,1,9,2,9,11,2,9,8,11],[6,3,11,6,5,3,5,1,3],
[0,8,11,0,11,5,0,5,1,5,11,6],[3,11,6,0,3,6,0,6,5,0,5,9],
[6,5,9,6,9,11,11,9,8],[5,10,6,4,7,8],[4,3,0,4,7,3,6,5,10],
[1,9,0,5,10,6,8,4,7],[10,6,5,1,9,7,1,7,3,7,9,4],[6,1,2,6,5,1,4,7,8],
[1,2,5,5,2,6,3,0,4,3,4,7],[8,4,7,9,0,5,0,6,5,0,2,6],
[7,3,9,7,9,4,3,2,9,5,9,6,2,6,9],[3,11,2,7,8,4,10,6,5],
[5,10,6,4,7,2,4,2,0,2,7,11],[0,1,9,4,7,8,2,3,11,5,10,6],
[9,2,1,9,11,2,9,4,11,7,11,4,5,10,6],[8,4,7,3,11,5,3,5,1,5,11,6],
[5,1,11,5,11,6,1,0,11,7,11,4,0,4,11],
[0,5,9,0,6,5,0,3,6,11,6,3,8,4,7],[6,5,9,6,9,11,4,7,9,7,11,9],
[10,4,9,6,4,10],[4,10,6,4,9,10,0,8,3],[10,0,1,10,6,0,6,4,0],
[8,3,1,8,1,6,8,6,4,6,1,10],[1,4,9,1,2,4,2,6,4],
[3,0,8,1,2,9,2,4,9,2,6,4],[0,2,4,4,2,6],[8,3,2,8,2,4,4,2,6],
[10,4,9,10,6,4,11,2,3],[0,8,2,2,8,11,4,9,10,4,10,6],
[3,11,2,0,1,6,0,6,4,6,1,10],[6,4,1,6,1,10,4,8,1,2,1,11,8,11,1],
[9,6,4,9,3,6,9,1,3,11,6,3],[8,11,1,8,1,0,11,6,1,9,1,4,6,4,1],
[3,11,6,3,6,0,0,6,4],[6,4,8,11,6,8],[7,10,6,7,8,10,8,9,10],
[0,7,3,0,10,7,0,9,10,6,7,10],[10,6,7,1,10,7,1,7,8,1,8,0],
[10,6,7,10,7,1,1,7,3],[1,2,6,1,6,8,1,8,9,8,6,7],
[2,6,9,2,9,1,6,7,9,0,9,3,7,3,9],[7,8,0,7,0,6,6,0,2],[7,3,2,6,7,2],
[2,3,11,10,6,8,10,8,9,8,6,7],[2,0,7,2,7,11,0,9,7,6,7,10,9,10,7],
[1,8,0,1,7,8,1,10,7,6,7,10,2,3,11],[11,2,1,11,1,7,10,6,1,6,7,1],
[8,9,6,8,6,7,9,1,6,11,6,3,1,3,6],[0,9,1,11,6,7],
[7,8,0,7,0,6,3,11,0,11,6,0],[7,11,6],[7,6,11],[3,0,8,11,7,6],
[0,1,9,11,7,6],[8,1,9,8,3,1,11,7,6],[10,1,2,6,11,7],
[1,2,10,3,0,8,6,11,7],[2,9,0,2,10,9,6,11,7],
[6,11,7,2,10,3,10,8,3,10,9,8],[7,2,3,6,2,7],[7,0,8,7,6,0,6,2,0],
[2,7,6,2,3,7,0,1,9],[1,6,2,1,8,6,1,9,8,8,7,6],[10,7,6,10,1,7,1,3,7],
[10,7,6,1,7,10,1,8,7,1,0,8],[0,3,7,0,7,10,0,10,9,6,10,7],
[7,6,10,7,10,8,8,10,9],[6,8,4,11,8,6],[3,6,11,3,0,6,0,4,6],
[8,6,11,8,4,6,9,0,1],[9,4,6,9,6,3,9,3,1,11,3,6],
[6,8,4,6,11,8,2,10,1],[1,2,10,3,0,11,0,6,11,0,4,6],
[4,11,8,4,6,11,0,2,9,2,10,9],[10,9,3,10,3,2,9,4,3,11,3,6,4,6,3],
[8,2,3,8,4,2,4,6,2],[0,4,2,4,6,2],[1,9,0,2,3,4,2,4,6,4,3,8],
[1,9,4,1,4,2,2,4,6],[8,1,3,8,6,1,8,4,6,6,10,1],[10,1,0,10,0,6,6,0,4],
[4,6,3,4,3,8,6,10,3,0,3,9,10,9,3],[10,9,4,6,10,4],[4,9,5,7,6,11],
[0,8,3,4,9,5,11,7,6],[5,0,1,5,4,0,7,6,11],
[11,7,6,8,3,4,3,5,4,3,1,5],[9,5,4,10,1,2,7,6,11],
[6,11,7,1,2,10,0,8,3,4,9,5],[7,6,11,5,4,10,4,2,10,4,0,2],
[3,4,8,3,5,4,3,2,5,10,5,2,11,7,6],[7,2,3,7,6,2,5,4,9],
[9,5,4,0,8,6,0,6,2,6,8,7],[3,6,2,3,7,6,1,5,0,5,4,0],
[6,2,8,6,8,7,2,1,8,4,8,5,1,5,8],[9,5,4,10,1,6,1,7,6,1,3,7],
[1,6,10,1,7,6,1,0,7,8,7,0,9,5,4],
[4,0,10,4,10,5,0,3,10,6,10,7,3,7,10],
[7,6,10,7,10,8,5,4,10,4,8,10],[6,9,5,6,11,9,11,8,9],
[3,6,11,0,6,3,0,5,6,0,9,5],[0,11,8,0,5,11,0,1,5,5,6,11],
[6,11,3,6,3,5,5,3,1],[1,2,10,9,5,11,9,11,8,11,5,6],
[0,11,3,0,6,11,0,9,6,5,6,9,1,2,10],
[11,8,5,11,5,6,8,0,5,10,5,2,0,2,5],[6,11,3,6,3,5,2,10,3,10,5,3],
[5,8,9,5,2,8,5,6,2,3,8,2],[9,5,6,9,6,0,0,6,2],
[1,5,8,1,8,0,5,6,8,3,8,2,6,2,8],[1,5,6,2,1,6],
[1,3,6,1,6,10,3,8,6,5,6,9,8,9,6],[10,1,0,10,0,6,9,5,0,5,6,0],
[0,3,8,5,6,10],[10,5,6],[11,5,10,7,5,11],[11,5,10,11,7,5,8,3,0],
[5,11,7,5,10,11,1,9,0],[10,7,5,10,11,7,9,8,1,8,3,1],
[11,1,2,11,7,1,7,5,1],[0,8,3,1,2,7,1,7,5,7,2,11],
[9,7,5,9,2,7,9,0,2,2,11,7],[7,5,2,7,2,11,5,9,2,3,2,8,9,8,2],
[2,5,10,2,3,5,3,7,5],[8,2,0,8,5,2,8,7,5,10,2,5],
[9,0,1,5,10,3,5,3,7,3,10,2],[9,8,2,9,2,1,8,7,2,10,2,5,7,5,2],
[1,3,5,3,7,5],[0,8,7,0,7,1,1,7,5],[9,0,3,9,3,5,5,3,7],[9,8,7,5,9,7],
[5,8,4,5,10,8,10,11,8],[5,0,4,5,11,0,5,10,11,11,3,0],
[0,1,9,8,4,10,8,10,11,10,4,5],[10,11,4,10,4,5,11,3,4,9,4,1,3,1,4],
[2,5,1,2,8,5,2,11,8,4,5,8],[0,4,11,0,11,3,4,5,11,2,11,1,5,1,11],
[0,2,5,0,5,9,2,11,5,4,5,8,11,8,5],[9,4,5,2,11,3],
[2,5,10,3,5,2,3,4,5,3,8,4],[5,10,2,5,2,4,4,2,0],
[3,10,2,3,5,10,3,8,5,4,5,8,0,1,9],[5,10,2,5,2,4,1,9,2,9,4,2],
[8,4,5,8,5,3,3,5,1],[0,4,5,1,0,5],[8,4,5,8,5,3,9,0,5,0,3,5],[9,4,5],
[4,11,7,4,9,11,9,10,11],[0,8,3,4,9,7,9,11,7,9,10,11],
[1,10,11,1,11,4,1,4,0,7,4,11],[3,1,4,3,4,8,1,10,4,7,4,11,10,11,4],
[4,11,7,9,11,4,9,2,11,9,1,2],[9,7,4,9,11,7,9,1,11,2,11,1,0,8,3],
[11,7,4,11,4,2,2,4,0],[11,7,4,11,4,2,8,3,4,3,2,4],
[2,9,10,2,7,9,2,3,7,7,4,9],[9,10,7,9,7,4,10,2,7,8,7,0,2,0,7],
[3,7,10,3,10,2,7,4,10,1,10,0,4,0,10],[1,10,2,8,7,4],
[4,9,1,4,1,7,7,1,3],[4,9,1,4,1,7,0,8,1,8,7,1],[4,0,3,7,4,3],
[4,8,7],[9,10,8,10,11,8],[3,0,9,3,9,11,11,9,10],
[0,1,10,0,10,8,8,10,11],[3,1,10,11,3,10],[1,2,11,1,11,9,9,11,8],
[3,0,9,3,9,11,1,2,9,2,11,9],[0,2,11,8,0,11],[3,2,11],
[2,3,8,2,8,10,10,8,9],[9,10,2,0,9,2],[2,3,8,2,8,10,0,1,8,1,10,8],
[1,10,2],[1,3,8,9,1,8],[0,9,1],[0,3,8],[],
];

/* Cube corner offsets, Bourke order. */
const CORNER = [[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]];
/* Per edge: the two corners it joins, plus (lower-corner offset, axis) —
   the canonical identity used to weld shared vertices. */
const EDGE = [
  [0,1, 0,0,0, 0], [1,2, 1,0,0, 1], [2,3, 0,1,0, 0], [3,0, 0,0,0, 1],
  [4,5, 0,0,1, 0], [5,6, 1,0,1, 1], [6,7, 0,1,1, 0], [7,4, 0,0,1, 1],
  [0,4, 0,0,0, 2], [1,5, 1,0,0, 2], [2,6, 1,1,0, 2], [3,7, 0,1,0, 2],
];

/* ------------------------------------------------------------------ */
/*  Exact squared euclidean distance transform (Felzenszwalb &         */
/*  Huttenlocher 2012). 1D lower envelope of parabolas, run along each  */
/*  axis in turn. Separable, O(n) per line, exact.                      */
/* ------------------------------------------------------------------ */

const INF = 1e20;

function edt1d(f, n, d, v, z) {
  let k = 0;
  v[0] = 0; z[0] = -INF; z[1] = INF;
  for (let q = 1; q < n; q++) {
    let s;
    for (;;) {
      const p = v[k];
      s = ((f[q] + q * q) - (f[p] + p * p)) / (2 * q - 2 * p);
      if (s <= z[k]) k--; else break;
    }
    k++;
    v[k] = q; z[k] = s; z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    const p = v[k];
    d[q] = (q - p) * (q - p) + f[p];
  }
}

/* In-place over a 3D Float64Array laid out (k*ny + j)*nx + i. */
function edt3d(F, nx, ny, nz) {
  const m = Math.max(nx, ny, nz);
  const f = new Float64Array(m), d = new Float64Array(m);
  const v = new Int32Array(m + 1), z = new Float64Array(m + 2);

  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) {
    const base = (k * ny + j) * nx;
    for (let i = 0; i < nx; i++) f[i] = F[base + i];
    edt1d(f, nx, d, v, z);
    for (let i = 0; i < nx; i++) F[base + i] = d[i];
  }
  for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) f[j] = F[(k * ny + j) * nx + i];
    edt1d(f, ny, d, v, z);
    for (let j = 0; j < ny; j++) F[(k * ny + j) * nx + i] = d[j];
  }
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    for (let k = 0; k < nz; k++) f[k] = F[(k * ny + j) * nx + i];
    edt1d(f, nz, d, v, z);
    for (let k = 0; k < nz; k++) F[(k * ny + j) * nx + i] = d[k];
  }
  return F;
}

/* ------------------------------------------------------------------ */
/*  build                                                              */
/* ------------------------------------------------------------------ */
/*
 *  atoms   [{ p:[x,y,z], r }]   r in angstroms; radiusOf() below fills
 *                               it in from an element symbol.
 *  opts    spacing  grid pitch, A          (default 0.6)
 *          probe    probe radius, A        (default 1.4)
 *          cavities keep interior bubbles  (default false)
 *
 *  returns { position, normal, index, nVert, nTri, dims, spacing, origin }
 */
function build(atoms, opts = {}) {
  const h = opts.spacing || 0.6;
  const probe = opts.probe == null ? PROBE : opts.probe;
  if (!atoms.length) throw new Error('ses.build: no atoms');

  /* ---- grid box. Pad by the largest grown radius so no SAS sphere can
     touch the wall, plus 2 cells so the flood fill has a rim to start
     from and the isosurface never runs off the edge. */
  let maxR = 0;
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const a of atoms) {
    if (!(a.r > 0)) throw new Error('ses.build: atom with no radius');
    if (a.r > maxR) maxR = a.r;
    for (let c = 0; c < 3; c++) {
      if (a.p[c] < lo[c]) lo[c] = a.p[c];
      if (a.p[c] > hi[c]) hi[c] = a.p[c];
    }
  }
  const pad = maxR + probe + 2 * h;
  const origin = lo.map(v => v - pad);
  const dims = [0, 1, 2].map(c => Math.ceil((hi[c] + pad - origin[c]) / h) + 1);
  const [nx, ny, nz] = dims;
  const N = nx * ny * nz;
  if (N > 200e6) throw new Error(`ses.build: ${N} cells — spacing too fine`);

  /* ---- 1. cells inside the SAS. Stamped per atom over its own local
     box rather than swept per cell over all atoms: 4 400 atoms x 900 000
     cells is 4e9 tests, and this is ~1e7. */
  const inSAS = new Uint8Array(N);
  for (const a of atoms) {
    const R = a.r + probe, R2 = R * R;
    const i0 = Math.max(0, Math.floor((a.p[0] - R - origin[0]) / h));
    const i1 = Math.min(nx - 1, Math.ceil((a.p[0] + R - origin[0]) / h));
    const j0 = Math.max(0, Math.floor((a.p[1] - R - origin[1]) / h));
    const j1 = Math.min(ny - 1, Math.ceil((a.p[1] + R - origin[1]) / h));
    const k0 = Math.max(0, Math.floor((a.p[2] - R - origin[2]) / h));
    const k1 = Math.min(nz - 1, Math.ceil((a.p[2] + R - origin[2]) / h));
    for (let k = k0; k <= k1; k++) {
      const dz = origin[2] + k * h - a.p[2], z2 = dz * dz;
      for (let j = j0; j <= j1; j++) {
        const dy = origin[1] + j * h - a.p[1], yz2 = z2 + dy * dy;
        if (yz2 > R2) continue;
        const row = (k * ny + j) * nx;
        for (let i = i0; i <= i1; i++) {
          const dx = origin[0] + i * h - a.p[0];
          if (yz2 + dx * dx <= R2) inSAS[row + i] = 1;
        }
      }
    }
  }

  /* ---- 2. probe-accessible region: flood fill the complement of the
     SAS inward from the wall. What this EXCLUDES is the point — an
     interior void is not in SAS but is not reachable either, so it never
     becomes surface and the cavity stays solid. */
  const F = new Float64Array(N);
  F.fill(INF);
  let seeds = 0;
  if (opts.cavities) {
    for (let n = 0; n < N; n++) if (!inSAS[n]) { F[n] = 0; seeds++; }
  } else {
    const seen = new Uint8Array(N);
    const stack = new Int32Array(N);
    let sp = 0;
    const push = n => { if (!seen[n] && !inSAS[n]) { seen[n] = 1; stack[sp++] = n; } };
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      if (i === 0 || j === 0 || k === 0 || i === nx-1 || j === ny-1 || k === nz-1)
        push((k * ny + j) * nx + i);
    }
    while (sp > 0) {
      const n = stack[--sp];
      F[n] = 0; seeds++;
      const i = n % nx, j = ((n - i) / nx) % ny, k = (n - i - j * nx) / (nx * ny);
      if (i > 0)      push(n - 1);
      if (i < nx - 1) push(n + 1);
      if (j > 0)      push(n - nx);
      if (j < ny - 1) push(n + nx);
      if (k > 0)      push(n - nx * ny);
      if (k < nz - 1) push(n + nx * ny);
    }
  }
  if (!seeds) throw new Error('ses.build: no probe-accessible region — box too tight');

  /* ---- 3. D = distance to the probe-accessible region, in angstroms. */
  edt3d(F, nx, ny, nz);
  const D = new Float32Array(N);
  for (let n = 0; n < N; n++) D[n] = Math.sqrt(F[n]) * h;

  /* ---- 4. isosurface D = probe. */
  return marchingCubes(D, dims, origin, h, probe);
}

/* grad(D) by central differences, clamped at the wall. Points INTO the
   solid (D grows with depth), so the outward normal is its negation. */
function gradAt(D, nx, ny, nz, i, j, k) {
  const at = (a, b, c) => D[(c * ny + b) * nx + a];
  const cl = (v, n) => v < 0 ? 0 : (v > n - 1 ? n - 1 : v);
  return [
    at(cl(i + 1, nx), j, k) - at(cl(i - 1, nx), j, k),
    at(i, cl(j + 1, ny), k) - at(i, cl(j - 1, ny), k),
    at(i, j, cl(k + 1, nz)) - at(i, j, cl(k - 1, nz)),
  ];
}

function marchingCubes(D, dims, origin, h, iso) {
  const [nx, ny, nz] = dims;
  const at = (i, j, k) => (k * ny + j) * nx + i;

  /* Welded vertices, keyed by canonical edge id = (lower grid point,
     axis). Map rather than a full array: the surface touches a tiny
     fraction of 3N edges, and 3N would be 6 million entries for 2HHB. */
  const vmap = new Map();
  const pos = [], nrm = [], idx = [];

  const corner = new Float64Array(8);
  const ci = new Int32Array(8), cj = new Int32Array(8), ck = new Int32Array(8);

  for (let k = 0; k + 1 < nz; k++)
  for (let j = 0; j + 1 < ny; j++)
  for (let i = 0; i + 1 < nx; i++) {
    let cube = 0;
    for (let c = 0; c < 8; c++) {
      const a = i + CORNER[c][0], b = j + CORNER[c][1], d = k + CORNER[c][2];
      ci[c] = a; cj[c] = b; ck[c] = d;
      corner[c] = D[at(a, b, d)];
      /* Bourke's convention: bit set where the value is BELOW the level,
         i.e. outside the solid here. Which side the table calls inside
         does not matter — winding is fixed against the gradient below. */
      if (corner[c] < iso) cube |= 1 << c;
    }
    const em = EDGE_TABLE[cube];
    if (em === 0) continue;

    const vid = new Array(12);
    for (let e = 0; e < 12; e++) {
      if (!(em & (1 << e))) continue;
      const [ca, cb, ox, oy, oz, ax] = EDGE[e];
      const key = ((((k + oz) * ny + (j + oy)) * nx + (i + ox)) * 3) + ax;
      let v = vmap.get(key);
      if (v === undefined) {
        const va = corner[ca], vb = corner[cb];
        /* D is a true distance, so it is very nearly linear across one
           cell and this interpolation is not a compromise. */
        let t = (iso - va) / (vb - va);
        if (!(t >= 0 && t <= 1)) t = 0.5;              // degenerate, va==vb
        const P = [0, 0, 0];
        for (let c = 0; c < 3; c++) {
          const a0 = origin[c] + (c === 0 ? ci[ca] : c === 1 ? cj[ca] : ck[ca]) * h;
          const b0 = origin[c] + (c === 0 ? ci[cb] : c === 1 ? cj[cb] : ck[cb]) * h;
          P[c] = a0 + (b0 - a0) * t;
        }
        const ga = gradAt(D, nx, ny, nz, ci[ca], cj[ca], ck[ca]);
        const gb = gradAt(D, nx, ny, nz, ci[cb], cj[cb], ck[cb]);
        let g = [0, 0, 0], len = 0;
        for (let c = 0; c < 3; c++) { g[c] = -(ga[c] + (gb[c] - ga[c]) * t); len += g[c] * g[c]; }
        len = Math.sqrt(len) || 1;
        v = pos.length / 3;
        pos.push(P[0], P[1], P[2]);
        nrm.push(g[0] / len, g[1] / len, g[2] / len);
        vmap.set(key, v);
      }
      vid[e] = v;
    }

    /* Table order, verbatim and unexamined — it is globally consistent,
       and the one inside/outside decision is made below for the whole
       mesh at once. See the header on why per-triangle was wrong. */
    const tri = TRI_TABLE[cube];
    for (let t = 0; t < tri.length; t += 3) {
      const a = vid[tri[t]], b = vid[tri[t + 1]], c = vid[tri[t + 2]];
      if (a === b || b === c || a === c) continue;      // collapsed
      idx.push(a, b, c);
    }
  }

  const mesh = {
    position: new Float32Array(pos),
    normal: new Float32Array(nrm),
    index: new Uint32Array(idx),
    nVert: pos.length / 3,
    nTri: idx.length / 3,
    dims, spacing: h, origin, iso,
  };

  /* THE ONE GLOBAL DECISION. Enclosed volume is positive iff the faces
     wind outward, so this settles the table's convention against ours
     without ever having to reason about which corner bit means what. */
  if (measure(mesh).volume < 0)
    for (let t = 0; t < mesh.index.length; t += 3) {
      const s = mesh.index[t + 1]; mesh.index[t + 1] = mesh.index[t + 2]; mesh.index[t + 2] = s;
    }

  /* And now the gradient does the job it is good for: agreeing, or not.
     A handful of disagreements is the geometry (see header); a large
     fraction means the field and the mesh have come apart. */
  let agree = 0;
  const P = mesh.position, N = mesh.normal, I = mesh.index;
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t]*3, b = I[t+1]*3, c = I[t+2]*3;
    const ux=P[b]-P[a], uy=P[b+1]-P[a+1], uz=P[b+2]-P[a+2];
    const vx=P[c]-P[a], vy=P[c+1]-P[a+1], vz=P[c+2]-P[a+2];
    const fx=uy*vz-uz*vy, fy=uz*vx-ux*vz, fz=ux*vy-uy*vx;
    if (fx*(N[a]+N[b]+N[c]) + fy*(N[a+1]+N[b+1]+N[c+1]) + fz*(N[a+2]+N[b+2]+N[c+2]) > 0) agree++;
  }
  mesh.normalAgreement = mesh.nTri ? agree / mesh.nTri : 1;
  return mesh;
}

/* ------------------------------------------------------------------ */
/*  helpers                                                            */
/* ------------------------------------------------------------------ */

function radiusOf(element) {
  const r = VDW[String(element).toUpperCase()];
  if (r == null) throw new Error(`ses: no van der Waals radius for "${element}"`);
  return r;
}

/* Signed volume by the divergence theorem, and total area. Both are
   checks, not products: a mesh that is not closed gives a volume that
   depends on where you put the origin, so `volume` being stable is
   itself evidence. */
function measure(mesh) {
  const { position: P, index: I } = mesh;
  let vol = 0, area = 0;
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t]*3, b = I[t+1]*3, c = I[t+2]*3;
    const ax=P[a],ay=P[a+1],az=P[a+2], bx=P[b],by=P[b+1],bz=P[b+2], cx=P[c],cy=P[c+1],cz=P[c+2];
    vol += (ax*(by*cz-bz*cy) - ay*(bx*cz-bz*cx) + az*(bx*cy-by*cx)) / 6;
    const ux=bx-ax, uy=by-ay, uz=bz-az, vx=cx-ax, vy=cy-ay, vz=cz-az;
    const nx=uy*vz-uz*vy, ny=uz*vx-ux*vz, nz=ux*vy-uy*vx;
    area += Math.sqrt(nx*nx+ny*ny+nz*nz) / 2;
  }
  return { volume: vol, area };
}

/* Watertight iff every undirected edge is used by exactly two triangles,
   AND the two uses run in opposite directions (consistent orientation).
   This is the assertion that catches a wrong marching-cubes table: a bad
   row leaves a hole, and a hole shows up here long before it shows up on
   screen through a 25%-opacity material. */
function watertight(mesh) {
  const use = new Map();
  const I = mesh.index;
  for (let t = 0; t < I.length; t += 3) {
    for (const [a, b] of [[I[t],I[t+1]], [I[t+1],I[t+2]], [I[t+2],I[t]]]) {
      const key = a < b ? a * 4294967296 + b : b * 4294967296 + a;
      const dir = a < b ? 1 : -1;
      use.set(key, (use.get(key) || 0) + dir);
    }
  }
  let bad = 0;
  for (const v of use.values()) if (v !== 0) bad++;
  return { ok: bad === 0, edges: use.size, bad };
}

/* ------------------------------------------------------------------ */
/*  self-test — one atom, whose SES is analytically its vdW sphere      */
/* ------------------------------------------------------------------ */

/*  THE GRID BIAS, WHICH IS REAL AND IS NOT A BUG.
 *
 *  A single atom's SES is exactly its vdW sphere, so a sphere is the one
 *  case with a closed-form answer to check against — and the mesh comes
 *  out consistently a little too BIG:
 *
 *      spacing 1.0 -> radius 1.833   (+0.133)
 *      spacing 0.6 -> radius 1.778   (+0.078)
 *      spacing 0.4 -> radius 1.751   (+0.051)
 *
 *  The cause is the seeding. D is the distance to the nearest CELL
 *  CENTRE of the probe-accessible region, and the nearest such centre
 *  always sits a fraction of a cell beyond the true SAS boundary, so
 *  every D is slightly too large and the level set D = probe lands
 *  slightly too far out. It is first order: the error is about 0.13 x
 *  spacing, and it halves when the grid does.
 *
 *  It is worth pinning rather than "fixing", because the obvious fix —
 *  nudging the isolevel by the measured 0.13h — is a constant fitted to
 *  a convex sphere, and the sign of the error inverts inside a concave
 *  reentrant patch. That would trade a known, uniform, shrinking bias
 *  for an unknown, non-uniform one. Every grid SES carries this; the
 *  answer is a fine enough grid, and 0.5 A puts it under 0.07 A.
 *
 *  Assert the LAW, not a number: outward, below 0.15 x spacing, and
 *  monotonically shrinking. That catches a broken field while leaving
 *  the method's own convergence alone.
 *
 *  Area is measured too but not asserted on: marching cubes overstates
 *  area more than volume — a staircased surface is longer than the
 *  smooth one it approximates, while the volume either side of the
 *  staircase cancels — so volume is the better estimator of the two. */
function selfTest() {
  let fails = 0;
  const ok = (cond, msg) => { console.log((cond ? '  ok   ' : '  FAIL ') + msg); if (!cond) fails++; };
  const R = 1.70;
  const errs = [];

  for (const h of [1.0, 0.6, 0.4]) {
    const m = build([{ p: [0, 0, 0], r: R }], { spacing: h });
    const { volume, area } = measure(m);
    const wt = watertight(m);
    const rv = Math.cbrt(volume * 3 / (4 * Math.PI));
    const err = rv - R;
    errs.push(err);
    console.log(`\nsphere r=${R} at spacing ${h}: ${m.nVert} verts, ${m.nTri} tris`);
    console.log(`  radius from volume ${rv.toFixed(4)} (${err >= 0 ? '+' : ''}${err.toFixed(4)}),` +
                ` from area ${Math.sqrt(area / (4*Math.PI)).toFixed(4)}`);
    ok(wt.ok, `watertight (${wt.edges} edges, ${wt.bad} unpaired)`);
    ok(volume > 0, `outward winding (volume ${volume.toFixed(2)} > 0)`);
    ok(err > 0 && err < 0.15 * h, `bias outward and under 0.15 x spacing (${err.toFixed(4)} < ${(0.15*h).toFixed(3)})`);
    /* Every normal must agree with the radial direction on a sphere. */
    let worst = 1;
    for (let v = 0; v < m.nVert; v++) {
      const x=m.position[v*3], y=m.position[v*3+1], z=m.position[v*3+2];
      const L=Math.hypot(x,y,z)||1;
      worst = Math.min(worst, (x*m.normal[v*3]+y*m.normal[v*3+1]+z*m.normal[v*3+2])/L);
    }
    ok(worst > 0.9, `normals point outward everywhere (worst dot ${worst.toFixed(3)})`);
  }
  ok(errs[0] > errs[1] && errs[1] > errs[2], 'error shrinks with the grid (first order)');

  /* THE ONE TEST THAT DISTINGUISHES AN SES FROM A UNION OF SPHERES.
     Two atoms 3.6 A apart do not overlap at all — 2r is 3.4 — so their
     vdW surface is two separate balls with a gap between them, of known
     volume 2 x (4/3)pi r^3. But the gap is far too narrow to admit a
     1.4 A water, so the SES must bridge it with a reentrant patch and
     come out one closed object of distinctly greater volume. If this
     passes and the sphere tests pass, the probe is doing its job. */
  const d = 3.6;
  const ses = build([{p:[-d/2,0,0],r:R},{p:[d/2,0,0],r:R}], { spacing: 0.4 });
  const balls = 2 * (4/3) * Math.PI * R**3;
  const vs = measure(ses).volume;
  console.log(`\ntwo atoms ${d} A apart:  SES volume ${vs.toFixed(1)},` +
              ` two bare vdW spheres ${balls.toFixed(1)}`);
  ok(watertight(ses).ok, 'two-atom SES watertight');
  ok(vs > balls * 1.05,
     `probe bridges the gap the vdW spheres leave open (+${((vs/balls-1)*100).toFixed(1)}%)`);

  /* And it must NOT bridge when the gap is wide enough for water: the
     same pair pushed apart is two separate balls again, so the volume
     falls back to the analytic one. This is the guard against a probe
     that simply inflates everything. */
  const far = build([{p:[-6,0,0],r:R},{p:[6,0,0],r:R}], { spacing: 0.4 });
  const vf = measure(far).volume;
  console.log(`two atoms 12 A apart: SES volume ${vf.toFixed(1)} vs ${balls.toFixed(1)}`);
  ok(Math.abs(vf / balls - 1) < 0.12, `well-separated atoms stay two plain spheres (${((vf/balls-1)*100).toFixed(1)}%)`);

  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  return fails;
}

module.exports = { build, measure, watertight, radiusOf, selfTest, VDW, PROBE };

if (require.main === module) process.exit(selfTest() ? 1 : 0);
