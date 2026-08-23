/* =============================================================================
 *  kit/enzyme-blob.js — the enzyme behind the substrate
 * =============================================================================
 *  A translucent blob sitting behind the molecule a step acts on, one per
 *  substrate. Glycolysis and the citric-acid cycle both draw it, fermentation
 *  and the electron transport chain will, and it had been copied between the
 *  first two — which is how the copy in `krebs-lab` still carried every bug the
 *  original had already had fixed.
 *
 *  DELIBERATELY NOT A PROTEIN, which is what the name says. No structure is
 *  drawn: the shape is one path, the same one for every enzyme, and it makes no
 *  claim about fold, size or active site. A drawn protein at this scale would be
 *  wrong in all three. (`hemoglobin-lab` is where a real one gets drawn.)
 *
 *  WHAT THIS OWNS: the elements, the measurement, and where the blob sits.
 *  WHAT IT DOES NOT: which molecule an enzyme is on, how many blobs there are,
 *  what the enzyme is called. Those are chemistry, and the page answers them by
 *  handing `update()` the groups themselves — never a lane index, so this module
 *  never learns what a lane is.
 *
 *  Four things here look like detail and are not. Each one shipped as a bug.
 *
 *   · MEASURED IN THE CAMERA'S BASIS, not in world x/y. The camera orbits, so a
 *     ring drawn edge-on is shorter on screen than it is in y, and a molecule
 *     with real depth reads narrower than it measures. The basis is orthonormal,
 *     so the centre reconstructs exactly.
 *   · SPHERES, NOT POINTS. An atom is drawn a radius wide, and these molecules
 *     run from a phosphate to a hydrogen, so atom centres alone put the middle
 *     in the wrong place and stop a radius short at the fat end.
 *   · A CIRCLE, not a box round the two longest axes. The blob is drawn round
 *     and these molecules run diagonally, so a square sized off the taller axis
 *     leaves the phosphate tail hanging out of a corner while the opposite side
 *     is empty blob. The circumscribing radius is the one number that cannot let
 *     an atom out on any bearing. `EnzymeBlob.circle` is that arithmetic alone, with
 *     no scene in it, so `kit/check-kit.js` asserts the same code a page draws
 *     with.
 *   · MEASURED EVERY FRAME, NEVER FROZEN. Pinning the blob when its molecule
 *     lands sounds right — the substrate moves inside the enzyme, not the other
 *     way round — and it is how this went wrong repeatedly: whatever is still
 *     travelling at the moment of the freeze (a camera easing to a new fit, a
 *     product settling onto its own centring, a beat that committed on the wall
 *     clock because the tab was hidden) is baked in and never corrected, so the
 *     same step sits differently depending on the route that reached it. A live
 *     measurement cannot drift from the molecule, because it is the molecule.
 *     `o.pin` is the one exception and it belongs to the CALLER (see below).
 *
 *  THE CHROME IS THE PAGE'S STYLESHEET, as it is for kit/hotspot.js: `.enzblob`
 *  and `.enzwob` live in `pathways.css`, next to the lane plates and the bond
 *  hotspots, because a lesson that wants a different enzyme colour is restyling
 *  its stage and not forking this. Two rules there are load-bearing and this
 *  module depends on them: the element is placed by its CORNER (no centring
 *  transform), and the sway rides `.enzwob`. Layout must not share the
 *  `transform` property with an animation — an engine that composes a CSS
 *  animation onto the base transform rather than replacing it then applies the
 *  centring twice and paints the shape half a box off its own footprint. Safari
 *  does; Chrome does not, so the box an inspector draws is right in both and
 *  only the ink moves, differently at every moment of a 9s cycle.
 *
 *  Loaded after scene.js. Exposes window.EnzymeBlob (and module.exports for the
 *  checker — `circle` is pure arithmetic and needs no THREE).
 * ========================================================================== */
(function(global){
  'use strict';

  // The blob. One path, shared by every lesson — see the header on why there is
  // exactly one and why it is not a protein.
  const SVG='<svg viewBox="0 0 531 528" xmlns="http://www.w3.org/2000/svg">'
    +'<path d="M14.0403 187.57C-36.6082 307.163 59.7274 415.385 144.526 478.781'
    +'C237.618 537.923 347.243 542.481 400.031 499.359C466.016 445.457 540.795 '
    +'289.771 529.943 198.244C512.779 53.4757 415.879 9.91198 323.366 0.81307'
    +'C225.413 -8.82082 64.6887 67.9781 14.0403 187.57Z" fill="#46B2E5" '
    +'fill-opacity="0.45"/></svg>';

  const DEF={
    // HOW MUCH BIGGER THAN THE MOLECULE. 1 = the circle that exactly contains
    // every sphere the molecule draws, so the cushion is equal on every bearing.
    // An enzyme really is far bigger than its substrate, but a blob that says so
    // fills the stage and buries the molecule the lesson is following, so this
    // is a hold, not a scale claim.
    // MOST OF IT IS SPENT BEFORE IT IS SEEN: the drawn outline is not the box.
    // It pulls in to .92 of the half-side at its narrowest bearing and the sway
    // squeezes that to .86, so 1.4 leaves about 1.2 of clear blob round the
    // worst case. Retune against the most VERTICAL molecule a lesson shows —
    // dihydroxyacetone phosphate is glycolysis's — never a compact one, which
    // has slack on that bearing anyway.
    k:1.4,
    // Per frame, chasing a target this same loop recomputes. A step moves the
    // target for real reasons (a phosphate lands, a product settles) and chasing
    // it frame for frame reads as the blob twitching; this lags it into a drift.
    ease:0.18,
    minR:0.6,          // world units: a one-atom subject still gets a blob
    cls:'enzblob',
    svg:SVG,
  };

  /* ---- the arithmetic, with no scene in it ----
   * Points are {u,v,r} in ONE plane — the camera's, by the time they get here.
   * Returns the centre of the surface bounding box and the radius that reaches
   * the farthest sphere's far side from it, or null for nothing to enclose.
   *
   * NOT the minimal enclosing circle, and the difference is deliberate: the
   * bounding-box centre is what the eye reads as the middle of a drawing, and a
   * true circumcentre slides toward whichever end is bulkier, so a molecule with
   * a phosphate on one end sits visibly off-centre in a blob that is technically
   * tighter. The radius is still measured FROM that centre, so nothing escapes.
   */
  function circle(pts){
    if(!pts || !pts.length) return null;
    let u0=Infinity,u1=-Infinity,v0=Infinity,v1=-Infinity;
    for(const p of pts){
      const r=p.r||0;
      if(p.u-r<u0) u0=p.u-r;   if(p.u+r>u1) u1=p.u+r;
      if(p.v-r<v0) v0=p.v-r;   if(p.v+r>v1) v1=p.v+r;
    }
    const u=(u0+u1)/2, v=(v0+v1)/2;
    let R=0;
    for(const p of pts) R=Math.max(R, Math.hypot(p.u-u, p.v-v)+(p.r||0));
    return {u, v, r:R};
  }

  function create(opts){
    const o=Object.assign({}, DEF, opts);
    const THREE=global.THREE;
    const camera=o.camera, canvas=o.canvas, host=o.host;
    const Rt=new THREE.Vector3(), Up=new THREE.Vector3(), Fw=new THREE.Vector3();
    const P=new THREE.Vector3(), Q=new THREE.Vector3(), S=new THREE.Vector3();

    /* One blob's subject, measured. `set` is the groups it covers — more than
     * one only where a single enzyme holds a molecule that is about to become
     * two, which is the case `pin` exists for. */
    function measure(set){
      const pts=[];
      let f0=Infinity, f1=-Infinity;
      for(const g of set){
        const meshes=g && g.userData && g.userData.atomMeshes;
        if(!meshes) continue;
        for(const m of meshes){
          if(!m || !m.visible) continue;
          m.getWorldPosition(P);
          const r=m.getWorldScale(S).x;   // a unit sphere, scaled to its radius
          const f=P.dot(Fw);
          pts.push({u:P.dot(Rt), v:P.dot(Up), r});
          if(f<f0) f0=f; if(f>f1) f1=f;
        }
      }
      const c=circle(pts);
      if(!c) return null;
      // back into the world, exactly: the basis is orthonormal
      return { c:new THREE.Vector3().addScaledVector(Rt,c.u)
                                    .addScaledVector(Up,c.v)
                                    .addScaledVector(Fw,(f0+f1)/2),
               d:2*Math.max(c.r, o.minR) };
    }

    /* Called from the host's afterFrame, with the groups each blob is on.
     *   sets — array of arrays of molecule groups; one entry per blob
     *   o.key — anything that identifies "this is a different subject now".
     *           On a change the blob SNAPS rather than easing, because easing
     *           across a step flies it over the stage.
     *   o.pin — hold the measurement taken now, and stop measuring. The caller's
     *           decision, because the one case that wants it is chemistry: an
     *           enzyme that takes one molecule and lets go of two must stay put
     *           while they leave, or it reads as the enzyme following them out.
     *           Cleared by any key change.
     */
    function update(sets, opt){
      sets=sets||[];
      opt=opt||{};
      // Elements are rebuilt only when the COUNT changes — rebuilding restarts
      // the CSS sway, and a blob whose drift restarts every frame is a flicker.
      if(host.children.length!==sets.length)
        host.innerHTML=sets.map(()=>
          `<div class="${o.cls}"><div class="enzwob">${o.svg}</div></div>`).join('');
      if(host.dataset.on!==String(opt.key)){
        host.dataset.on=String(opt.key);
        for(const el of host.children){ el._pin=null; el._at=null; }
      }
      const w=canvas.clientWidth, h=canvas.clientHeight;
      if(!w || !h) return;
      camera.updateMatrixWorld();
      camera.matrixWorld.extractBasis(Rt, Up, Fw);
      // A PROJECTION IS IN THE CANVAS'S PIXELS and a blob is positioned in the
      // host's. The two boxes are the same only while the canvas fills the host,
      // which nothing enforces — so take the difference rather than assume zero.
      const cb=canvas.getBoundingClientRect(), hb=host.getBoundingClientRect();
      const dx=cb.left-hb.left, dy=cb.top-hb.top;

      sets.forEach((set,i)=>{
        const el=host.children[i];
        if(!el) return;
        // A PIN ONCE TAKEN STANDS until the key changes. `o.pin` says "take one
        // now if you have not" — the caller can only recognise the right moment
        // (the whole molecule on its mark, before it becomes two), and by the
        // frame after, the thing it wanted pinned no longer exists to measure.
        let pin=el._pin || measure(set);
        if(!pin) return;
        if(opt.pin && !el._pin) el._pin=pin;
        // PIXELS PER WORLD UNIT, measured by projecting a unit step across the
        // frame rather than read off an ortho frustum: the same arithmetic then
        // holds for a perspective camera, where the scale is a function of depth
        // and the subject's own depth is the only right one to ask at.
        P.copy(pin.c).project(camera);
        Q.copy(pin.c).addScaledVector(Rt,1).project(camera);
        const pxPerWorld=Math.abs(Q.x-P.x)*0.5*w;
        const want=[ dx+(P.x*0.5+0.5)*w, dy+(-P.y*0.5+0.5)*h, pin.d*pxPerWorld*o.k ];
        // SNAPPED ON A NEW SUBJECT, eased within one: a blob with no previous
        // position takes its target whole.
        const at=el._at||want;
        el._at=[ at[0]+(want[0]-at[0])*o.ease,
                 at[1]+(want[1]-at[1])*o.ease,
                 at[2]+(want[2]-at[2])*o.ease ];
        // THE CORNER. The centring is arithmetic, never a transform — see the
        // header, and `.enzblob` in pathways.css.
        el.style.left  =(el._at[0]-el._at[2]/2).toFixed(1)+'px';
        el.style.top   =(el._at[1]-el._at[2]/2).toFixed(1)+'px';
        el.style.width =el.style.height=el._at[2].toFixed(1)+'px';
      });
    }

    function clear(){ host.innerHTML=''; host.dataset.on=''; }

    return { update, clear, measure };
  }

  const API={create, circle, SVG, DEFAULTS:DEF};
  global.EnzymeBlob=API;
  if(typeof module!=='undefined' && module.exports) module.exports=API;
})(typeof globalThis!=='undefined'?globalThis:this);
