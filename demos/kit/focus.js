/* =============================================================================
 *  kit/focus.js — one way to say "look here"
 * =============================================================================
 *  Five pages, five spellings of the same sentence: dim the rest, light the
 *  chosen, maybe ring it. That is a TEACHING inconsistency before it is a code
 *  one — a student who learns on one page that ghosting means "not this part"
 *  should not have to relearn it on the next.
 *
 *  This is the vocabulary, one implementation:
 *    ghost   everything not chosen drops to 13% and stops writing depth
 *    lit     the chosen atoms emit their OWN colour, so the highlight never
 *            recolours chemistry — a lit oxygen is still red
 *    a bond is part of a group only when BOTH ends are. A bond with one end
 *    outside is the group's attachment to the rest of the molecule, and
 *    lighting it draws the boundary in the wrong place.
 *
 *  Works on any group built by Stage.buildMolecule (uses userData.atomMeshes /
 *  bondMeshes / pair), and degrades to a plain traverse for anything else — a
 *  ribbon, a tube, a surface — so a page can dim a whole chain the same way it
 *  dims an atom.
 *
 *  Loaded after scene.js. Exposes window.Focus.
 * ========================================================================== */
(function(global){
  'use strict';

  const GHOST=0.13;

  // Remember each mesh's own colour once, so a highlight can be undone exactly
  // rather than by guessing at the palette. Idempotent: safe to call again
  // after a page adds meshes to a group.
  function claim(obj){
    obj.traverse(o=>{
      if(!o.isMesh||!o.material) return;
      if(o.userData.baseColor==null) o.userData.baseColor=o.material.color.getHex();
      if(o.userData.baseOpacity==null) o.userData.baseOpacity=o.material.opacity;
    });
    return obj;
  }

  function paint(obj,{lit=false, ghost=false, glow=0.5}={}){
    if(!obj) return;
    obj.traverse(o=>{
      if(!o.isMesh||!o.material) return;
      const m=o.material;
      m.transparent=ghost;
      m.opacity=ghost?GHOST:(o.userData.baseOpacity!=null?o.userData.baseOpacity:1);
      // ghosts don't write depth: two dozen overlapping translucent spheres
      // sort against each other and the molecule turns into a muddy stack
      m.depthWrite=!ghost;
      if(m.emissive){
        m.emissive.setHex(lit?(o.userData.baseColor||0xffffff):0x000000);
        m.emissiveIntensity=lit?glow:0;
      }
    });
  }

  function create(opts={}){
    const glow=opts.glow!=null?opts.glow:0.5;
    const tracked=new Set();

    /* Focus a set of ATOM INDICES inside one built molecule.
     *   atoms  array of spec indices, or null/[] to clear this group
     *   opts   {dim:false} lights without ghosting the rest — for a molecule
     *          small enough that ghosting is louder than the lesson. */
    function atoms(g,idxs,o={}){
      if(!g||!g.userData||!g.userData.atomMeshes) return;
      claim(g); tracked.add(g);
      const set=new Set(idxs||[]);
      const dim=(o.dim!==false)&&set.size>0;
      g.userData.atomMeshes.forEach((m,i)=>{ if(m)
        paint(m,{lit:set.has(i), ghost:dim&&!set.has(i), glow:o.glow!=null?o.glow:glow}); });
      g.userData.bondMeshes.forEach(m=>{
        const on=m.userData.pair.every(p=>set.has(p));
        paint(m,{lit:on, ghost:dim&&!on, glow:o.glow!=null?o.glow:glow});
      });
    }

    /* Focus whole OBJECTS against each other — one chain of four, one monomer
     * of the gallery, one organelle of the cell. Same vocabulary, one level up:
     * `keep` is the object (or array) that stays solid. */
    function among(list,keep,o={}){
      const on=new Set([].concat(keep||[]));
      list.forEach(obj=>{ claim(obj); tracked.add(obj);
        paint(obj,{lit:o.lit===true&&on.has(obj), ghost:on.size>0&&!on.has(obj),
          glow:o.glow!=null?o.glow:glow}); });
    }

    // Everything back to solid, unlit. Cheap enough to call on every refresh,
    // which is what makes it safe: a page never has to remember what it dimmed.
    function clear(g){
      const list=g?[g]:[...tracked];
      list.forEach(obj=>paint(obj,{lit:false,ghost:false}));
      if(g) tracked.delete(g); else tracked.clear();
    }

    return { atoms, among, clear, claim, GHOST };
  }

  global.Focus={create, claim, paint, GHOST};
})(this);
