/* =============================================================================
 *  dna/attach.js — where the sugar and the phosphate have to sit, measured
 * =============================================================================
 *  Step 2 of dna-lab builds a nucleotide out of three registered specs: a base
 *  from mol-nucleic.js, deoxyribose from mol-sugars.js, and phosphate. Two
 *  bonds get made, and each one needs a pose.
 *
 *  A pose here is SIX numbers, and every way of inventing them is a lie a
 *  student cannot see. Typing a rotation puts the glycosidic torsion wherever
 *  it landed. Building the bond from its length and the direction of the
 *  departing hydrogen fixes five of the six honestly and leaves the sixth — χ,
 *  the turn about the new bond — completely free; χ is the angle that decides
 *  whether the base sits over the sugar or away from it, and it is the whole
 *  difference between B-DNA and a shape no cell makes.
 *
 *  So it is not invented. dna/data/bdna.js already holds every heavy atom of
 *  1BNA by name — P, O5′, C5′, C4′, O4′, C3′, O3′, C2′, C1′ and the base —
 *  because bake-ladder.js baked the whole nucleotide, not just the rung. The
 *  pose is READ OUT of that record:
 *
 *    1. Fit the deposited base onto our base spec (both are the same molecule,
 *       so the ring atoms correspond by NAME). That gives the transform from
 *       1BNA's frame into this page's.
 *    2. Carry the deposited sugar through it. Those are the points our sugar
 *       has to land on.
 *    3. Fit our sugar onto them.
 *
 *  Then the same three steps again with the sugar as the anchor and the
 *  phosphate as the thing being placed. Every fit is Horn's quaternion method —
 *  closed form, no starting guess, no local minimum — so the page and a checker
 *  get the same answer to the last digit, and χ comes out at whatever the
 *  crystal says rather than whatever looked right.
 *
 *  WHAT IS FITTED ON IS THREE OR FOUR ATOMS, NOT THE WHOLE GROUP, and the
 *  reason is in SUGAR_ANCHOR below. Our deoxyribose is Skel-built: its ring
 *  C–O bonds are 1.54 Å where the crystal's are 1.43, and least-squares over
 *  the whole ring spreads that error into the bond being made. Anchoring on the
 *  atoms that define the bond leaves it where the record has it and lets our
 *  spec's own conformation absorb the difference — `rms` reports what that
 *  cost, about 0.1 Å.
 *
 *  WHAT THIS DOES NOT CLAIM is the pucker. 1BNA's sugar is C2′-endo and ours is
 *  whatever ringFuranose built. The claim is where the sugar sits and which way
 *  it faces; a page that needed the pucker itself would have to draw the
 *  deposited sugar, not this one.
 *
 *  Loaded after molecules.js and dna/data/bdna.js. No THREE: ångströms in,
 *  ångströms out, Node-loadable so check-dna.js runs it.
 * ========================================================================== */
(function(global){
  'use strict';

  // Read at CALL time, not at load: dna-lab.html loads the baked record after
  // its modules, and capturing here bound `undefined` for the whole session.
  const req = p => (typeof require==='function' ? require(p) : null);
  const record = () => global.BDNA || (req('./data/bdna.js'), global.BDNA);

  const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
  const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
  const mul=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];
  const mean=ps=>mul(ps.reduce(add,[0,0,0]), 1/ps.length);
  const mv=(R,v)=>[R[0]*v[0]+R[1]*v[1]+R[2]*v[2],
                   R[3]*v[0]+R[4]*v[1]+R[5]*v[2],
                   R[6]*v[0]+R[7]*v[1]+R[8]*v[2]];

  /* ---- Horn's absolute orientation ------------------------------------------
   * The rigid transform taking `from` onto `to`, least squares over all n. The
   * rotation is the eigenvector of a 4×4 symmetric matrix built from the
   * covariance, found by Jacobi sweeps — closed form in the sense that matters
   * here: no starting guess, no local minimum, same answer every run.
   *
   * Horn rather than Kabsch-by-SVD because a quaternion cannot come out
   * left-handed. An SVD fit needs the determinant correction, and forgetting it
   * returns a MIRRORED molecule that renders perfectly (MolecularGeometry.md
   * §1.3 — the failure this repo has already shipped once). */
  function fit(from, to){
    const cf = mean(from), ct = mean(to);
    const f = from.map(p=>sub(p,cf)), t = to.map(p=>sub(p,ct));
    // covariance
    const S = [0,0,0,0,0,0,0,0,0];
    for(let i=0;i<f.length;i++)
      for(let r=0;r<3;r++) for(let c=0;c<3;c++) S[r*3+c] += f[i][r]*t[i][c];
    const [xx,xy,xz,yx,yy,yz,zx,zy,zz] = S;
    const N = [
      [xx+yy+zz, yz-zy,     zx-xz,     xy-yx    ],
      [yz-zy,    xx-yy-zz,  xy+yx,     zx+xz    ],
      [zx-xz,    xy+yx,    -xx+yy-zz,  yz+zy    ],
      [xy-yx,    zx+xz,     yz+zy,    -xx-yy+zz ] ];
    const q = topEigenvector(N);
    const [w,x,y,z] = q;
    const R = [
      1-2*(y*y+z*z), 2*(x*y-w*z),   2*(x*z+w*y),
      2*(x*y+w*z),   1-2*(x*x+z*z), 2*(y*z-w*x),
      2*(x*z-w*y),   2*(y*z+w*x),   1-2*(x*x+y*y) ];
    const apply = p => add(mv(R, sub(p,cf)), ct);
    let e = 0;
    for(let i=0;i<from.length;i++){
      const d = sub(apply(from[i]), to[i]);
      e += d[0]*d[0]+d[1]*d[1]+d[2]*d[2];
    }
    return { R, apply, quat:[x,y,z,w], rms:Math.sqrt(e/from.length) };
  }

  // Largest-eigenvalue eigenvector of a symmetric 4×4, by cyclic Jacobi. Small
  // and fixed-size, so the sweep count is a constant rather than a tolerance.
  function topEigenvector(A){
    const a = A.map(r=>r.slice());
    let V = [[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1]];
    for(let sweep=0; sweep<24; sweep++){
      for(let p=0;p<3;p++) for(let q=p+1;q<4;q++){
        if(Math.abs(a[p][q]) < 1e-12) continue;
        const theta = (a[q][q]-a[p][p]) / (2*a[p][q]);
        const t = Math.sign(theta||1) / (Math.abs(theta) + Math.sqrt(theta*theta+1));
        const c = 1/Math.sqrt(t*t+1), s = t*c;
        for(let k=0;k<4;k++){
          const akp = a[k][p], akq = a[k][q];
          a[k][p] = c*akp - s*akq; a[k][q] = s*akp + c*akq;
        }
        for(let k=0;k<4;k++){
          const apk = a[p][k], aqk = a[q][k];
          a[p][k] = c*apk - s*aqk; a[q][k] = s*apk + c*aqk;
        }
        for(let k=0;k<4;k++){
          const vkp = V[k][p], vkq = V[k][q];
          V[k][p] = c*vkp - s*vkq; V[k][q] = s*vkp + c*vkq;
        }
      }
    }
    let best = 0;
    for(let i=1;i<4;i++) if(a[i][i] > a[best][best]) best = i;
    const v = [V[0][best],V[1][best],V[2][best],V[3][best]];
    const n = Math.hypot(...v);
    return v.map(x=>x/n);
  }

  /* ---- the deposited residue ------------------------------------------------
   * One nucleotide out of 1BNA, by letter, as a name→position map. The FIRST
   * occurrence is taken deliberately and not averaged: averaging twelve
   * residues over two strands would produce a sugar in no pucker at all, and a
   * mean of two conformations is not a conformation. */
  const LETTER = { adenine:'DA', thymine:'DT', guanine:'DG', cytosine:'DC' };

  function residue(key, need){
    const want = LETTER[key];
    if(!want) return null;
    for(const pair of record().pairs){
      const [a, b] = pair.seq.split('-');
      for(const [chain, letter] of [['A',a],['B',b]]){
        if(letter !== want) continue;
        const out = {};
        for(const name in pair.index)
          if(name.startsWith(chain+':'))
            out[name.slice(2)] = pair.atoms[pair.index[name]].p;
        // A strand's first residue carries no phosphate — it is the 5′ end, and
        // the record is right to have none. Keep looking rather than returning
        // a residue that is missing the atom being asked about.
        if((need || []).every(n => out[n])) return out;
      }
    }
    return null;
  }

  /* ---- which atoms correspond ------------------------------------------------
   * Our specs and the PDB use the same labels for the same atoms except for the
   * prime: mol-sugars.js writes C1 where a PDB writes C1'. Rather than rename a
   * spec that four other pages read, the prime is added here — the one place
   * that has to speak both. */
  const BASE_RING = {
    adenine:  ['N9','C8','N7','C5','C6','N1','C2','N3','C4'],
    guanine:  ['N9','C8','N7','C5','C6','N1','C2','N3','C4'],
    thymine:  ['N1','C2','N3','C4','C5','C6'],
    cytosine: ['N1','C2','N3','C4','C5','C6'],
  };
  /* THREE ATOMS, NOT THE WHOLE RING — and this is the load-bearing choice here.
   * Fitting all five ring atoms sounds more careful and is worse: our sugar's
   * ring C–O bonds are 1.54 Å where the crystal's are 1.43, so a least-squares
   * fit spreads that 0.11 Å around the ring and lands C1′ 1.25 Å from the
   * nitrogen — a glycosidic bond a fifth too short, drawn perfectly.
   *
   * The anomeric carbon and its two ring neighbours are exactly the atoms that
   * fix where the bond is and both angles it makes. Everything further round
   * the ring is our spec's own conformation, which this page is not claiming
   * anything about. Fit on those three and the bond comes out at 1.48 Å, which
   * is 1BNA's own N9–C1′ to the hundredth. Same reasoning for the ester: the
   * bridging oxygen and its two neighbours. */
  const SUGAR_ANCHOR = ['C1','O4','C2'];     // our names; +′ in the PDB
  const ESTER_ANCHOR = ['O5','C5','C4'];

  const at = (spec, name) => {
    const i = spec.names ? spec.names.indexOf(name) : -1;
    return i < 0 ? null : spec.atoms[i].pos;
  };

  /* Where `sugar` must sit for its C1′ to be bonded to `base`'s glycosidic
   * nitrogen, with the base at the origin of its own spec frame. Compose with
   * the base's live transform on the page — this is a relationship between two
   * molecules, not a place on stage. */
  function sugar(baseKey, baseSpec, sugarSpec){
    const dep = residue(baseKey);
    if(!dep) return { ok:false, why:'no '+baseKey+' in the baked record' };

    // 1BNA's frame → this base's frame, from the ring the two share.
    const ring = BASE_RING[baseKey].filter(n => at(baseSpec,n) && dep[n]);
    if(ring.length < 3) return { ok:false, why:'fewer than three shared ring atoms' };
    const toBase = fit(ring.map(n=>dep[n]), ring.map(n=>at(baseSpec,n)));

    // The deposited sugar, carried into it. These are the points to land on.
    const pairs = SUGAR_ANCHOR
      .map(n => ({ mine:at(sugarSpec,n), theirs:dep[n+'′'] || dep[n+"'"] }))
      .filter(p => p.mine && p.theirs);
    if(pairs.length < 3) return { ok:false, why:'fewer than three shared sugar atoms' };
    const f = fit(pairs.map(p=>p.mine), pairs.map(p=>toBase.apply(p.theirs)));

    return { ok:true, R:f.R, quat:f.quat, apply:f.apply, rms:f.rms,
             // `quat` + `pos` ARE the pose, in the anchor's own frame: a mesh
             // holding the spec's own coordinates and given these two
             // reproduces `apply` exactly. So the page never re-derives a
             // transform from transformed points, which is where a fit like
             // this usually loses its handedness.
             pos:f.apply([0,0,0]),
             // The bond this pose makes, so a caller can draw or check it.
             bond:{ from:glycosidicN(baseKey), to:'C1' },
             length:dist(at(baseSpec, glycosidicN(baseKey)), f.apply(at(sugarSpec,'C1'))) };
  }

  /* Where `phos` must sit for its P to be bonded to the sugar's O5′, with the
   * sugar in its OWN spec frame. The caller composes the sugar's pose onto it,
   * which is what keeps a phosphate attached to a sugar that has itself moved. */
  function phosphate(baseKey, sugarSpec, phosSpec){
    const dep = residue(baseKey, ['P','OP1','OP2']);
    if(!dep) return { ok:false, why:'no '+baseKey+' in the baked record' };
    const prime = n => dep[n+'′'] || dep[n+"'"];

    const anchor = ESTER_ANCHOR
      .map(n => ({ mine:at(sugarSpec,n), theirs:prime(n) }))
      .filter(p => p.mine && p.theirs);
    if(anchor.length < 3) return { ok:false, why:'fewer than three shared sugar atoms' };
    const toSugar = fit(anchor.map(p=>p.theirs), anchor.map(p=>p.mine));

    // The phosphate's three hydroxyls are equivalent, so the correspondence is a
    // choice — and NOT a free one. O1 is the hydroxyl mol-nucleic.js names as
    // reacting, so it takes the bridge, which in the record is the sugar's own
    // O5′. The other two then have to go on OP2 and OP1 IN THAT ORDER: a
    // phosphate is tetrahedral, and swapping them reflects it. That reflection
    // fits with an rms of 0.47 Å instead of 0.11 and puts the P–O5′ bond at
    // 1.50 Å instead of 1.57 — visible only as a slightly wrong number, which
    // is why the correspondence is written down rather than found by trying.
    const map = [ ['P','P'], ['O1','O5′'], ['O2','OP2'], ['O3','OP1'] ];
    const pairs = map
      .map(([mine, theirs]) => ({ mine:at(phosSpec,mine),
                                  theirs: theirs === 'O5′' ? prime('O5') : dep[theirs] }))
      .filter(p => p.mine && p.theirs);
    if(pairs.length < 3) return { ok:false, why:'fewer than three shared phosphate atoms' };
    const f = fit(pairs.map(p=>p.mine), pairs.map(p=>toSugar.apply(p.theirs)));

    return { ok:true, R:f.R, quat:f.quat, apply:f.apply, rms:f.rms,
             pos:f.apply([0,0,0]),
             bond:{ from:'O5', to:'P' },
             length:dist(at(sugarSpec,'O5'), f.apply(at(phosSpec,'P'))) };
  }

  /* ---- the phosphodiester bond ----------------------------------------------
   * Step 3's join, and the only one between two whole nucleotides: the 3′–OH of
   * one meets the 5′ phosphate of the next, a water leaves, and the backbone
   * gains a residue. Same method as the other two — the record already holds
   * every consecutive pair on both strands, so the pose is read, not composed
   * out of a rise and a twist.
   *
   * READING IT PER-RESIDUE RATHER THAN AS THE HELICAL STEP is the point. The
   * step transform (bdna.step) would place the next pair correctly and say
   * nothing about whether the backbone closes; here the two atoms that have to
   * meet are what the fit is anchored on, so `length` comes back as the bond it
   * actually made. A page can then quote it instead of asserting it.
   *
   * `atomsA` / `atomsB` are name→position maps in the CALLER's frame, PDB names
   * with their primes, because a page's assembled nucleotide has labels of its
   * own making and this module should not have to know them. */
  const LINK_ANCHOR = ['P', "O5'", "C5'"];   // the bond, and what fixes its angles

  function link(keyA, keyB, atomsA, atomsB){
    const pair = consecutive(LETTER[keyA], LETTER[keyB]);
    if(!pair) return { ok:false, why:`no ${keyA}→${keyB} step on either strand` };
    const [depA, depB] = pair;

    // 1BNA's frame → our nucleotide A's, anchored on the 3′ end and not on the
    // whole residue. Fitting all nine shared atoms is the tempting version and
    // it puts the bond at 4.5 Å: our sugar's pucker is its own, so a whole-
    // residue fit lands O3′ half an ångström out and the phosphate arrives
    // where the record says rather than where the oxygen is. SUGAR_ANCHOR's
    // argument, one join further along.
    const anchorA = ["O3'", "C3'", "C4'"]
      .map(n => ({ mine:atomsA[n], theirs:depA[n] || depA[prime(n)] }))
      .filter(x => x.mine && x.theirs);
    if(anchorA.length < 3) return { ok:false, why:'the 3′ end is not in both' };
    const toA = fit(anchorA.map(x=>x.theirs), anchorA.map(x=>x.mine));

    const pairs = LINK_ANCHOR
      .map(n => ({ mine:atomsB[n], theirs:depB[n] || depB[prime(n)] }))
      .filter(x => x.mine && x.theirs);
    if(pairs.length < 3) return { ok:false, why:'fewer than three shared atoms on B' };
    const f = fit(pairs.map(x=>x.mine), pairs.map(x=>toA.apply(x.theirs)));

    return { ok:true, quat:f.quat, pos:f.apply([0,0,0]), apply:f.apply, rms:f.rms,
             bond:{ from:"O3'", to:'P' },
             length:dist(atomsA["O3'"], f.apply(atomsB.P)) };
  }

  const prime = n => n.endsWith("'") ? n.slice(0,-1) + '′' : n + '′';

  /* Two residues that follow each other ALONG A STRAND, in that order. The
   * record's `links` are the phosphodiester bonds themselves, so this asks the
   * bonds rather than assuming pair i is followed by pair i+1 — which is true
   * on one strand and false on the other, and that reversal is the whole of
   * what antiparallel means. */
  function consecutive(a, b){
    const B = record();
    for(const l of B.links){
      const from = residueAt(B, l.from.pair, l.strand);
      const to   = residueAt(B, l.to.pair,   l.strand);
      if(!from || !to) continue;
      if(letterOf(B, l.from.pair, l.strand) !== a) continue;
      if(letterOf(B, l.to.pair,   l.strand) !== b) continue;
      if(!to.P) continue;                       // a 5′ end has no phosphate
      return [from, to];
    }
    return null;
  }
  const letterOf = (B, i, strand) => B.pairs[i].seq.split('-')[strand];

  /* IN THE DEPOSITED FRAME, not the pair's own. Every pair in the record holds
   * its atoms in a local frame plus an `origin`/`basis` that places it, because
   * step 4 twists the pairs by moving those placements. Two residues on one
   * strand belong to DIFFERENT pairs, so comparing their local coordinates
   * measures nothing: the phosphodiester bond came out at 5.2 Å, which is
   * roughly the answer for two residues stacked without any twist — a plausible
   * number, and the reason the mistake was not obvious. */
  function residueAt(B, i, strand){
    const pair = B.pairs[i], chain = strand === 0 ? 'A' : 'B', out = {};
    const b = pair.basis, o = pair.origin;
    for(const name in pair.index){
      if(!name.startsWith(chain + ':')) continue;
      const a = pair.atoms[pair.index[name]].p;
      out[name.slice(2)] = [
        o[0] + a[0]*b[0][0] + a[1]*b[1][0] + a[2]*b[2][0],
        o[1] + a[0]*b[0][1] + a[1]*b[1][1] + a[2]*b[2][1],
        o[2] + a[0]*b[0][2] + a[1]*b[1][2] + a[2]*b[2][2] ];
    }
    return Object.keys(out).length ? out : null;
  }

  const glycosidicN = key => (key==='adenine'||key==='guanine') ? 'N9' : 'N1';
  const dist = (a,b) => a && b ? Math.hypot(b[0]-a[0], b[1]-a[1], b[2]-a[2]) : null;

  // residueAt is exported for check-dna.js, which asserts that it reads a
  // residue in the DEPOSITED frame — the mistake that made the backbone bond
  // 5 Å and looked like a stretched bond rather than a wrong frame.
  const API = { sugar, phosphate, link, fit, residue, residueAt, glycosidicN };
  global.Attach = API;
  if(typeof module !== 'undefined' && module.exports) module.exports = { Attach:API };

})(typeof window !== 'undefined' ? window : globalThis);
