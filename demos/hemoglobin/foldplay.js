/* =====================================================================
 *  foldplay.js — FoldPlay: the fold, as a ribbon that means something.
 *
 *  HbFold.decode gives coordinates and a formation number per H-bond.
 *  Turning those into a RIBBON is where the page's central claim lives,
 *  and it is one rule:
 *
 *    THE RIBBON MUST NOT SHOW A HELIX BEFORE ITS BONDS EXIST.
 *
 *  A residue is drawn helical when a formed H-bond spans it, AND only
 *  where the deposited records say a helix belongs — so this can reveal
 *  the crystal's answer early or late, and can never invent a helix the
 *  structure does not have. Pass the deposited assignment straight to
 *  RibbonLib instead and the extended chain at t=0 comes out with eight
 *  wide blue bands already in it: level 2 finished before level 1 has
 *  been read, contradicting the caption under it.
 *
 *  IT LIVES HERE BECAUSE TWO SURFACES NOW PLAY THIS. hemoglobin-lab is
 *  one; a card on the door map is the other, and a card is exactly the
 *  place a second copy would drift unwatched — it would still look like
 *  a fold, just one asserting something the lesson does not.
 *
 *  Real angstroms in, plain geometry out, THREE passed in. No materials
 *  and no camera: the same contract RibbonLib and TubeLib keep.
 *
 *  WHAT IS NOT HERE. The lab's level 1 is an extended chain blended into
 *  the trajectory, rebuilt through rigid per-residue frames. That is a
 *  mechanism for the story that page tells, not a property of the fold,
 *  and it stays there — `ssFor` takes whatever coordinates the caller
 *  arrived at.
 * ===================================================================== */
(function (global) {
  'use strict';

  /* covers(fold) -> for each residue, the bonds whose span contains it.
     A bond from residue a to b covers a..b, which for the i->i+3 and
     i->i+4 bonds that are 97% of this chain is the turn of spiral that
     bond is holding shut. Built once per trajectory. */
  function covers(fold) {
    const out = Array.from({ length: fold.R }, () => []);
    fold.bonds.forEach((b, k) => {
      const lo = Math.min(b.from, b.to) - fold.first;
      const hi = Math.max(b.from, b.to) - fold.first;
      for (let i = Math.max(0, lo); i <= Math.min(fold.R - 1, hi); i++) out[i].push(k);
    });
    return out;
  }

  /* ssFor(fold, cov, formed, out) -> the per-residue letters at this
     instant. `out` is reused: this runs every frame and the array is the
     same length every time. 0.5 is the threshold on a bond's formation,
     which is itself measured on the live coordinates at bake time. */
  function ssFor(fold, cov, formed, out) {
    const ss = out || [];
    for (let i = 0; i < fold.R; i++) {
      if (fold.ss[i] !== 'H') { ss[i] = fold.ss[i]; continue; }
      let held = 0;
      for (const k of cov[i]) held = Math.max(held, formed[k]);
      ss[i] = held > 0.5 ? 'H' : 'C';
    }
    return ss;
  }

  /* create(THREE, fold, opts) -> a player owning ONE mesh.

       seek(t)    rebuild at t in 0..1
       tick(dt)   advance by dt seconds and rebuild; loops
       mesh       for the caller to add, position and light
       dispose()  the last geometry

     `sub` is RibbonLib's, and a card wants it far below the lesson's 6:
     the rebuild is per frame and its cost is the triangle count.

     dispose() before every rebuild is NOT optional. The geometry's
     triangle count depends on the path, so there is no fixed buffer to
     update, and a frame that does not release the old one leaks it on
     the GPU — the page dies after a minute. */
  function create(THREE, fold, opts) {
    const o = opts || {};
    const cov = covers(fold);
    const mat = o.material || new THREE.MeshStandardMaterial({
      color: 0x8aa0c8, roughness: 0.55, metalness: 0.05, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat);
    const build = { sub: o.sub == null ? 6 : o.sub };
    const V = [];
    let ss = [];
    let t = o.start == null ? 0 : o.start;
    const speed = o.speed == null ? 0.12 : o.speed;   // fraction of the fold per second
    const rate = o.rate == null ? 24 : o.rate;        // rebuilds per second; 0 = every tick
    let due = 0;

    function seek(tt) {
      t = Math.max(0, Math.min(1, tt));
      const s = fold.at(t);
      for (let i = 0; i < fold.R; i++) {
        V[i] = V[i] || new THREE.Vector3();
        V[i].set(s.CA[i][0], s.CA[i][1], s.CA[i][2]);
      }
      ss = ssFor(fold, cov, s.formed, ss);
      mesh.geometry.dispose();
      mesh.geometry = RibbonLib.build(THREE, V.slice(0, fold.R), ss, build);
      return t;
    }

    seek(t);
    return {
      mesh, seek, covers: cov,
      get t() { return t; },
      /* Loops, with a hold at each end: a fold that snaps back to a
         straight chain the instant it lands never shows what it made.

         REBUILT AT ITS OWN RATE, not at the display's. The cost of a frame
         here is RibbonLib.build's spline work, not the triangles it emits —
         measured at 7.9ms for a 2.5k-triangle card ribbon, half a 60fps
         budget for one card among four. A protein folding is a slow event
         and 24 rebuilds a second is more than it needs; `rate: 0` restores
         one per tick for a caller that is scrubbing rather than playing. */
      tick(dt) {
        const hold = o.hold == null ? 1.2 : o.hold;
        t += dt * speed;
        if (t > 1 + hold * speed) t = 0;
        due += dt;
        if (rate > 0 && due < 1 / rate) return;
        due = 0;
        seek(Math.min(1, t));
      },
      dispose() { mesh.geometry.dispose(); },
    };
  }

  global.FoldPlay = { covers, ssFor, create };
})(this);
