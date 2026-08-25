/* =============================================================================
 *  amylase/fit.js — put a built sugar chain where acarbose is, and measure
 * =============================================================================
 *  Plain arrays: no THREE, no MolLib. Browser global `AmylaseFit` and a Node
 *  export, so amylase/tools/check-fit.js measures with the code the page draws
 *  with. Ångströms throughout — the caller divides by MolLib.SCALE on the way
 *  in.
 *
 *  THE QUESTION IT ANSWERS. chain/glucose-chains-test.html builds starch and
 *  cellulose out of one measured linkage each. amylase-test.html has the trough
 *  those chains would have to lie in. Nobody has put one in the other, so
 *  "α-1,4 fits, β-1,4 does not" is a told fact. This makes it a measured one.
 *
 *  WHY ACARBOSE IS THE RULER. Docking is a search with a scoring function and
 *  this repo has neither. It does not need them: 1OSE already contains a chain
 *  lying in the site, so the pose is DEPOSITED rather than searched. Three
 *  glycosidic oxygens along that ligand are three points, three points fix a
 *  rigid body, and the same three atoms exist in any 1,4-linked glucan. So each
 *  chain is placed by superposing its own bridging oxygens onto acarbose's.
 *  Nothing is fitted to make a chain look bad or good; both get the same rule.
 *
 *  AND ACARBOSE IS ALSO THE CONTROL. Scored against itself the ligand gives the
 *  clash numbers of a molecule that demonstrably fits — a crystal structure's
 *  own contacts. Without that row the other two numbers are unreadable: no one
 *  knows whether 40 contacts under 3 Å is a lot.
 *
 *  WHAT IS AND IS NOT CLAIMED. The chains are RIGID and so is the protein: real
 *  ones flex, and an enzyme that closes on its substrate is the subject of half
 *  this repo. A clash here therefore means "this shape cannot lie in this trough
 *  as built", not "this molecule can never be a substrate". The direction of the
 *  result is the finding; the magnitude is a model's.
 *
 *  Every chain is tried in BOTH directions and at EVERY position along itself,
 *  and the best-scoring placement is what gets reported. Anything less would let
 *  an arbitrary choice of starting residue produce the answer.
 * ========================================================================== */
(function(global){
  'use strict';

  const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
  const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
  const centroid=P=>[0,1,2].map(c=>P.reduce((s,p)=>s+p[c],0)/P.length);

  /* ---- Kabsch, by Jacobi eigen-decomposition of a 3x3 ------------------- *
   * Three points is the smallest case that has a rotation at all, and the
   * usual SVD is more machinery than that needs. H = Σ (a-ā)(b-b̄)ᵀ; the
   * rotation is B Aᵀ built from the eigenvectors of HᵀH, with the reflection
   * case caught by the determinant. */
  function eig3(M){
    /* Jacobi rotations on a symmetric 3x3. Converges in a handful of sweeps
       and needs no library. */
    let a=M.map(r=>r.slice());
    let V=[[1,0,0],[0,1,0],[0,0,1]];
    for(let sweep=0; sweep<24; sweep++){
      let off=0;
      for(let p=0;p<3;p++) for(let q=p+1;q<3;q++) off+=a[p][q]*a[p][q];
      if(off<1e-20) break;
      for(let p=0;p<3;p++) for(let q=p+1;q<3;q++){
        if(Math.abs(a[p][q])<1e-18) continue;
        const theta=(a[q][q]-a[p][p])/(2*a[p][q]);
        const t=Math.sign(theta||1)/(Math.abs(theta)+Math.sqrt(theta*theta+1));
        const c=1/Math.sqrt(t*t+1), s=t*c;
        for(let k=0;k<3;k++){
          const akp=a[k][p], akq=a[k][q];
          a[k][p]=c*akp-s*akq; a[k][q]=s*akp+c*akq;
        }
        for(let k=0;k<3;k++){
          const apk=a[p][k], aqk=a[q][k];
          a[p][k]=c*apk-s*aqk; a[q][k]=s*apk+c*aqk;
        }
        for(let k=0;k<3;k++){
          const vkp=V[k][p], vkq=V[k][q];
          V[k][p]=c*vkp-s*vkq; V[k][q]=s*vkp+c*vkq;
        }
      }
    }
    return { values:[a[0][0],a[1][1],a[2][2]], vectors:V };   // vectors in COLUMNS
  }
  const mul=(A,B)=>A.map(r=>[0,1,2].map(j=>r[0]*B[0][j]+r[1]*B[1][j]+r[2]*B[2][j]));
  const T=A=>[0,1,2].map(i=>[A[0][i],A[1][i],A[2][i]]);
  const det=A=>A[0][0]*(A[1][1]*A[2][2]-A[1][2]*A[2][1])
             -A[0][1]*(A[1][0]*A[2][2]-A[1][2]*A[2][0])
             +A[0][2]*(A[1][0]*A[2][1]-A[1][1]*A[2][0]);

  /* The rigid move taking points `from` onto points `to`, least squares.
     Returns { R, t, rmsd } with p -> R p + t. */
  function kabsch(from, to){
    const ca=centroid(from), cb=centroid(to);
    const A=from.map(p=>sub(p,ca)), B=to.map(p=>sub(p,cb));
    const H=[[0,0,0],[0,0,0],[0,0,0]];
    for(let k=0;k<A.length;k++)
      for(let i=0;i<3;i++) for(let j=0;j<3;j++) H[i][j]+=A[k][i]*B[k][j];

    /* R = V Uᵀ with U from HHᵀ and V from HᵀH, matched by singular value.
       Doing it through eigenvectors means the two sets can come out with
       independent signs, so each column of V is re-derived from H and U
       rather than taken from its own decomposition — that is what keeps
       the pairing right without a full SVD. */
    const HtH=mul(T(H),H);
    const e=eig3(HtH);
    const order=[0,1,2].sort((i,j)=>e.values[j]-e.values[i]);
    const v=order.map(i=>[e.vectors[0][i],e.vectors[1][i],e.vectors[2][i]]);
    const s=order.map(i=>Math.sqrt(Math.max(0,e.values[i])));
    const u=v.map((vi,k)=>{
      const Hv=[0,1,2].map(r=>dot(H[r],vi));
      const n=Math.hypot(...Hv);
      return n>1e-9 ? Hv.map(x=>x/n) : null;
    });
    /* A degenerate third direction (three collinear-ish points) is filled by
       the cross product, which is also what forces a proper rotation. */
    const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
    if(!u[2]) u[2]=cross(u[0],u[1]);
    if(!v[2]) v[2]=cross(v[0],v[1]);
    let R=[0,1,2].map(i=>[0,1,2].map(j=>
      u[0][i]*v[0][j] + u[1][i]*v[1][j] + u[2][i]*v[2][j]));
    /* R currently maps `to`'s frame onto `from`'s; we want the other way. */
    R=T(R);
    if(det(R)<0){
      const u2=u[2].map(x=>-x);
      R=T([0,1,2].map(i=>[0,1,2].map(j=>
        u[0][i]*v[0][j] + u[1][i]*v[1][j] + u2[i]*v[2][j])));
    }
    const apply=p=>[0,1,2].map(i=>dot(R[i],p));
    const t=sub(cb, apply(ca));
    const moved=from.map(p=>[0,1,2].map(i=>dot(R[i],p)+t[i]));
    const rmsd=Math.sqrt(moved.reduce((s2,p,i)=>s2+dist(p,to[i])**2,0)/moved.length);
    return { R, t, rmsd, apply:p=>[0,1,2].map(i=>dot(R[i],p)+t[i]) };
  }

  /* ---- clash ------------------------------------------------------------ *
   * A uniform bin grid over the protein, the same shape of index as
   * hemoglobin/tools/bake-surface.js's residue tagging and for the same
   * reason: the atoms are a blob at roughly constant density.
   *
   * `severe` is the number that decides the question — 2.2 Å between two
   * heavy atom CENTRES is inside any pair's van der Waals contact, hydrogen
   * bond or not, so it is an overlap no rotamer explains away. `close` at
   * 3.0 Å is contact rather than clash, and a fitting molecule has plenty. */
  const SEVERE=2.2, CLOSE=3.0;

  function index(protein, cell){
    const bins=new Map(), key=(i,j,k)=>i+','+j+','+k;
    for(const a of protein){
      const k=key(...a.p.map(v=>Math.floor(v/cell)));
      let b=bins.get(k); if(!b) bins.set(k,b=[]);
      b.push(a);
    }
    return { bins, cell, key };
  }
  function nearest(grid, p){
    const [ci,cj,ck]=p.map(v=>Math.floor(v/grid.cell));
    let best=Infinity, at=null;
    for(let i=ci-1;i<=ci+1;i++) for(let j=cj-1;j<=cj+1;j++) for(let k=ck-1;k<=ck+1;k++){
      const b=grid.bins.get(grid.key(i,j,k)); if(!b) continue;
      for(const a of b){ const d=dist(p,a.p); if(d<best){ best=d; at=a; } }
    }
    return { d:best, atom:at };
  }
  /* points: heavy atoms of the placed molecule. Returns the counts plus the
     worst single overlap, which is what a reader wants to see named. */
  function clash(points, grid){
    let severe=0, close=0, min=Infinity, worst=null, depth=0;
    for(const p of points){
      const { d, atom }=nearest(grid, p);
      if(d<CLOSE) close++;
      if(d<SEVERE){ severe++; depth+=SEVERE-d; }
      if(d<min){ min=d; worst=atom; }
    }
    return { severe, close, min:+min.toFixed(2), depth:+depth.toFixed(2),
             worst: worst && `${worst.name}${worst.num} ${worst.atom}`,
             atoms:points.length, cuts:{ severe:SEVERE, close:CLOSE } };
  }

  /* ---- placing a chain --------------------------------------------------- *
   * chain: { residues:[[ [x,y,z] … ] …], bridge, heavy:[[i…] …] } in Ångströms —
   *   `bridge` is the index of the glycosidic oxygen within a residue, and
   *   `heavy` is per-residue because the ends differ from the middle: every
   *   residue but the first has its free C4 hydroxyl replaced by the previous
   *   linkage, and counting an atom that is not there would invent a clash.
   * anchors: the three bridging oxygens of acarbose, in order along it.
   *
   * Every window of three consecutive bridges, forwards and backwards. The
   * backwards pass is not paranoia: a 1,4-glucan is directional, acarbose
   * names its bridging oxygen from the other end of the linkage than these
   * specs do, and which way round a chain lies in the trough is exactly the
   * kind of thing that should be searched rather than assumed.
   */
  function place(chain, anchors, grid){
    const n=chain.residues.length;
    const bridges=chain.residues.map(r=>r[chain.bridge]);
    let best=null;
    for(const dir of [1,-1]){
      /* INTERIOR WINDOWS ONLY. A window at either end of the built chain
         has a residue missing on one side, so its flank score would be
         counted over fewer atoms than the other chain's and the two rows
         would not be comparable. There is nothing at the end of a real
         starch granule the site cares about either. */
      for(let s=1; s+3<n; s++){
        const idx=[s,s+1,s+2];
        const from=(dir===1?idx:idx.slice().reverse()).map(i=>bridges[i]);
        const fit=kabsch(from, anchors);
        const moved=chain.residues.map(r=>r.map(p=>fit.apply(p)));
        /* TWO SCORES, because they answer two different questions and one
           number cannot carry both. The WINDOW is the four residues the
           three anchors span — the piece that is actually in the site, and
           the only piece a four-subsite trough has an opinion about. The
           TAIL is everything else, and its clash is the second half of the
           argument: a chain that fits the site but drives its own
           continuation through the protein is not a substrate either. */
        const win=new Set(dir===1 ? [s,s+1,s+2,s+3] : [s,s+1,s+2,s-1]);
        const pick=keep=>{
          const out=[];
          moved.forEach((r,ri)=>{ if(keep(ri)) for(const i of chain.heavy[ri]) out.push(r[i]); });
          return out;
        };
        const cand={ dir, start:s, rmsd:+fit.rmsd.toFixed(3), moved,
                     R:fit.R, t:fit.t, window:[...win].filter(i=>i>=0&&i<n).sort((a,b)=>a-b),
                     clash:clash(pick(()=>true), grid),
                     site:clash(pick(i=>win.has(i)), grid),
                     flank:clash(pick(i=>!win.has(i) && (win.has(i-1)||win.has(i+1))), grid),
                     tail:clash(pick(i=>!win.has(i)), grid) };
        /* Ranked on the SITE first and the anchor fit second: a placement
           that lands the three oxygens beautifully by driving the window
           through a helix is not the better pose. The tail is reported,
           never optimised — choosing a pose by how tidily the far end of a
           twelve-mer happens to miss the protein would be scoring the
           length of the chain we chose to build. */
        if(!best || cand.site.severe<best.site.severe
                 || (cand.site.severe===best.site.severe && cand.rmsd<best.rmsd))
          best=cand;
      }
    }
    return best;
  }

  const API={ kabsch, clash, place, index, nearest, SEVERE, CLOSE };
  if(typeof module!=='undefined' && module.exports) module.exports=API;
  else global.AmylaseFit=API;
})(this);
