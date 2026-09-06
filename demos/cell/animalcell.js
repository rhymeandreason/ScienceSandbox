/* =============================================================================
 *  cell/animalcell.js — an animal cell cut open, with its organelles, as one box
 * =============================================================================
 *  The textbook cut cell: a bowl of cytoplasm, cut on a wavy line, with a
 *  nucleus, mitochondria, ER, Golgi, centrioles and vesicles standing in it.
 *  r128 and kit/card-stage.js, no build step.
 *
 *      AnimalCell.create(THREE, root, camera, opts)   the model: root is yours
 *      AnimalCell.mount(el, params)                   one box, one handle
 *
 *  LOAD cell/organelles.js FIRST. The four organelles a plant cell has too
 *  — nucleus, mitochondrion, Golgi, rough ER — are built there and are the
 *  same objects in both cells, because they are the same organelles. What
 *  is left here is what only an animal cell has (the bowl, the centrosome,
 *  the lysosomes) and, mostly, WHERE EVERYTHING SITS. That split is the
 *  file: arrangement is this cell's, geometry is shared.
 *
 *  ONE SEEDED STREAM, IN CALL ORDER. The kit's random is consumed by the
 *  builders and by this file's placement in the order they are called, so
 *  inserting a call in the middle reshuffles every organelle after it. A
 *  changed layout from an unrelated edit means a call moved.
 *
 *  mount adds hover (an organelle brightens) and click (the camera flies to
 *  it; double-click flies home). flyTo/home are in Stage's
 *  own theta/phi/r. The camera never moves on its own — see mount.
 *
 *  PROP TIER, AND NOT A SCALE. Nothing here is measured and the scene unit
 *  is not a micrometre: organelle sizes are a diagram's, chosen so every
 *  one reads from the home view. A page must not put a number beside it.
 *
 * ========================================================================== */
(function (global) {
  'use strict';

  const PI = Math.PI;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);


  /* ---- the model ----------------------------------------------------- */

  const DEFAULTS = { seed: 1234, tilt: 0.32 };

  function create(THREE, root, camera, opts = {}) {
    const P = Object.assign({}, DEFAULTS, opts);
    if (!global.CellOrganelles) throw new Error('cell/animalcell.js: load cell/organelles.js first');
    /* The nucleus, mitochondrion, Golgi and ER are cell/organelles.js's, and
       the plant cell builds the same four from the same kit. What is left in
       this file is what only an animal cell has — the bowl, the centrosome,
       the lysosomes — and where everything sits. */
    const K = global.CellOrganelles.kit(THREE, { seed: P.seed });
    const { buildShell, displace } = global.CellOrganelles;
    const { rand, rr, noise, col, mat, bilayerOf, ORG } = K;
    const V3 = THREE.Vector3;
    const organelles = [], occupied = [];      // occupied: spheres the speckles avoid
    const register = (obj, name) => { obj.userData.organelle = name; organelles.push(obj); return obj; };
    const dirUW = (u, w) => new V3(Math.sin(w) * Math.cos(u), -Math.cos(w), Math.sin(w) * Math.sin(u));

    const cell = new THREE.Group();
    cell.rotation.x = P.tilt;                   // the opening leans toward the reader
    root.add(cell);

    /* cell body: a flattened, noise-deformed sphere cut on a wavy line */
    const R = 10, TH = 0.55, YS = 0.72;
    const cellRadius = d => R * (1 + 0.055 * noise.fbm(d.x * 1.4 + 3.1, d.y * 1.4 + 1.7, d.z * 1.4, 3)
      + 0.05 * noise.noise3(d.x * 0.6 + 9, d.y * 0.6, d.z * 0.6));
    const innerR = d => cellRadius(d) - TH;
    const cellS = (u, w) => { const d = dirUW(u, w); const p = d.clone().multiplyScalar(cellRadius(d)); p.y *= YS; return p; };
    const cellCut = u => PI * 0.56 + 0.06 * Math.sin(2 * u + 1) + 0.035 * Math.sin(5 * u + 2.3)
      + 0.05 * noise.noise3(Math.cos(u) * 1.5, Math.sin(u) * 1.5, 2);
    {
      const g = buildShell(THREE, {
        S: cellS, uRange: [0, 2 * PI], wRange: u => [0, cellCut(u)], uSeg: 200, uPeriodic: true,
        thickness: TH, segs: { outer: 70, rim: 24, inner: 70 },
        // The lip is a bilayer: two head bands over a paler tail core. 24 rim
        // rows because the bands are a seventh of the lip each and 12 rows
        // draws them as one step.
        colors: bilayerOf(ORG.plasma),
      });
      const mesh = new THREE.Mesh(g, mat({ vertexColors: true, roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.25, emissive: '#3a0008', emissiveIntensity: 0.3 }));
      cell.add(mesh);
    }
    const unsq = p => new V3(p.x, p.y / YS, p.z);
    const insideCell = (p, margin = 0) => { const q = unsq(p); return q.length() < innerR(q.clone().normalize()) - margin; };
    const clampToCell = (p, margin) => {
      const q = unsq(p), lim = innerR(q.clone().normalize()) - margin;
      if (q.length() > lim) { q.setLength(lim); p.set(q.x, q.y * YS, q.z); }
      return p;
    };
    const floorY = (x, z) => {
      let y = -(R - TH);
      for (let i = 0; i < 4; i++) { const ri = innerR(new V3(x, y, z).normalize()); y = -Math.sqrt(Math.max(0.01, ri * ri - x * x - z * z)); }
      return y * YS;
    };

    /* nucleus, from the kit; this file only says where it sits */
    const nucleus = K.nucleus({ R: 3.6, thickness: 0.22, chromatin: 3, pores: 60 });
    nucleus.position.set(1.6, -2.3, -1.4);
    nucleus.rotation.set(0.55, 0.25, 0);
    cell.add(register(nucleus, 'nucleus'));
    const Rn = nucleus.userData.surface.R, nucleolus = nucleus.userData.parts.nucleolus;
    const nucPos = nucleus.position.clone();

    /* mitochondria: the kit's, five of them, laid out on the floor of the bowl */
    for (const t of [
      { x: -3.0, z: 4.6, ry: 0.35, rx: 0.25 }, { x: 2.4, z: 5.2, ry: -0.6, rx: 0.3 }, { x: 6.2, z: 2.4, ry: 1.25, rx: 0.2 },
      { x: -6.3, z: -3.6, ry: 0.95, rx: 0.15 }, { x: 6.8, z: -3.2, ry: -1.1, rx: 0.1 },
    ]) {
      /* Drawn about twice its size against this nucleus, deliberately: a
         mitochondrion is 1 to 2 microns long to a nucleus's six, and at
         that ratio it is too small here to read as anything. Declared in
         SCALE at the foot of the file. */
      const m = register(K.mitochondrion({ r: 0.55, L: 0.95, thickness: 0.09 }), 'mitochondrion');
      m.position.set(t.x, Math.max(floorY(t.x, t.z) + 0.8, -4.2 + rr(-0.6, 0.6)), t.z);
      m.rotation.set(t.rx, t.ry, 0);
      cell.add(m);
      occupied.push({ p: m.position.clone(), r: 1.6 });
    }

    /* Golgi: the kit's. One perinuclear ribbon, which is the animal
       arrangement; a plant cell scatters many of the same stack. */
    {
      const g = K.golgi({ cisternae: 7, vesicles: 8 });
      g.position.set(-6.2, -3.4, 0.6);
      g.rotation.set(0.15, 0.35, -1.45);
      cell.add(register(g, 'golgi'));
      occupied.push({ p: g.position.clone(), r: 2.6 });
    }

    /* rough ER: the kit's, wrapping this nucleus and stopped by this membrane */
    const er = K.roughER({
      Rn, center: nucPos, y0: -3.3,
      arcs: [{ a0: -0.38 * PI, a1: 0.58 * PI, count: 4 }, { a0: 0.80 * PI, a1: 1.22 * PI, count: 3 }],
      clamp: p => clampToCell(p, 0.7),
    });
    const riboPositions = er.ribosomes;
    cell.add(register(er.group, 'er'));

    /* centrosome: two centrioles of nine triplets, microtubules out */
    {
      const c = new THREE.Group();
      const cm = mat({ color: ORG.centrosome.outer, roughness: 0.5, clearcoat: 0.3 });
      const tube = new THREE.CylinderGeometry(0.035, 0.035, 0.85, 8);
      const centriole = () => {
        const g = new THREE.Group();
        for (let i = 0; i < 9; i++) for (let j = 0; j < 3; j++) {
          const m = new THREE.Mesh(tube, cm), a = (i / 9) * 2 * PI + j * 0.16, ra = 0.2 + j * 0.06;
          m.position.set(Math.cos(a) * ra, 0, Math.sin(a) * ra);
          g.add(m);
        }
        return g;
      };
      const c2 = centriole();
      c2.rotation.z = PI / 2;
      c2.position.set(0.45, -0.6, 0.1);
      c.add(centriole(), c2);
      const mtMat = mat({ color: ORG.centrosome.microtubule, roughness: 0.55, clearcoat: 0.1 });
      for (let i = 0; i < 6; i++) {
        const dir = new V3(rr(-1, 0.4), rr(-0.8, 0.2), rr(-0.3, 1)).normalize(), len = rr(1.6, 3.2);
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, len, 6), mtMat);
        m.position.copy(dir).multiplyScalar(len / 2 + 0.4);
        m.quaternion.setFromUnitVectors(new V3(0, 1, 0), dir);
        c.add(m);
      }
      c.position.set(-3.3, -2.2, -4.6);
      c.rotation.set(0.4, 0.3, 0.5);
      cell.add(register(c, 'centrosome'));
      occupied.push({ p: c.position.clone(), r: 1.6 });
    }

    /* vesicles, lysosomes, peroxisomes: spheres that keep out of everything */
    {
      const palette = [
        /* Vesicles are a MIXED BAG on purpose — they come off the Golgi, the
           ER and the membrane and are heading anywhere — so two of these
           borrow a parent's colour and the rest are peroxisome oranges and
           endosome blue, which nothing else on the page draws. */
        { c: '#f08a3c', e: '#ff5a00', ei: 0.25 }, { c: '#f5a25a' }, { c: ORG.lysosome.outer }, { c: '#6fa1dc' },
        { c: ORG.golgi.vesicle }, { c: '#f6c453', e: '#ff9a00', ei: 0.2 }, { c: ORG.lysosome.inner },
      ];
      const placed = [];
      for (let count = 0, tries = 0; count < 18 && tries < 4000; tries++) {
        const d = new V3(rr(-1, 1), rr(-1, -0.15), rr(-1, 1)).normalize();
        const p = d.multiplyScalar(innerR(d) * rr(0.35, 0.92)), rad = rr(0.22, 0.5);
        if (p.y > 0.4 || !insideCell(p, rad + 0.3)) continue;
        if (p.distanceTo(nucPos) < Rn + 0.9 + rad) continue;
        if (placed.some(q => q.distanceTo(p) < 1.4 + rad)) continue;
        if (occupied.some(o => o.p.distanceTo(p) < o.r + rad + 0.3)) continue;
        placed.push(p);
        const pal = palette[Math.floor(rand() * palette.length)], seedK = count;
        const geo = displace(new THREE.SphereGeometry(rad, 32, 24), (x, y, z) => {
          const k = 1 + 0.05 * noise.noise3(x * 4 + seedK, y * 4, z * 4); return [x * k, y * k, z * k];
        });
        const m = new THREE.Mesh(geo, mat({ color: pal.c, emissive: pal.e || '#000000', emissiveIntensity: pal.ei || 0, roughness: 0.35, clearcoat: 0.7 }));
        m.position.copy(p);
        cell.add(register(m, 'vesicle'));
        occupied.push({ p: p.clone(), r: rad + 0.1 });
        count++;
      }
    }

    /* free ribosomes: one instanced mesh for the cytoplasm speckle and the ER's studs */
    {
      const N = 1500;
      const inst = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 6, 5),
        new THREE.MeshStandardMaterial({ color: col(ORG.er.ribosome), roughness: 0.6 }), N + riboPositions.length);
      const dummy = new THREE.Object3D();
      let i = 0;
      for (let tries = 0; i < N && tries < N * 10; tries++) {
        const d = new V3(rr(-1, 1), rr(-1, 1), rr(-1, 1)).normalize();
        const p = d.multiplyScalar(innerR(d) * Math.cbrt(rand()) * 0.97);
        if (p.y > 0.8 || !insideCell(p, 0.1)) continue;
        if (p.distanceTo(nucPos) < Rn + 0.25) continue;
        if (occupied.some(o => o.p.distanceTo(p) < o.r)) continue;
        dummy.position.copy(p); dummy.scale.setScalar(rr(0.6, 1.4)); dummy.updateMatrix();
        inst.setMatrixAt(i++, dummy.matrix);
      }
      for (const q of riboPositions) { dummy.position.copy(q); dummy.scale.setScalar(1.15); dummy.updateMatrix(); inst.setMatrixAt(i++, dummy.matrix); }
      inst.count = i;
      cell.add(inst);
    }

    /* ---- hover, and the per-frame motion ---- */
    const raycaster = new THREE.Raycaster();
    const rootOf = o => { while (o && !o.userData.organelle) o = o.parent; return o; };
    let hovered = null;
    const setHighlight = (org, on) => org.traverse(o => {
      if (!o.isMesh || !o.material || !o.material.emissive) return;
      const m = o.material;
      if (!m.userData.baseEmissive) { m.userData.baseEmissive = m.emissive.clone(); m.userData.baseIntensity = m.emissiveIntensity; }
      if (on) { m.emissive.set(0xffffff); m.emissiveIntensity = 0.13; }
      else { m.emissive.copy(m.userData.baseEmissive); m.emissiveIntensity = m.userData.baseIntensity; }
    });
    // ndc is {x,y} in clip space or null; returns the organelle root under it.
    function pick(ndc) {
      if (!ndc) return null;
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(organelles, true);
      return hits.length ? rootOf(hits[0].object) : null;
    }
    function hover(ndc) {
      const r = pick(ndc);
      if (r === hovered) return hovered;
      if (hovered) setHighlight(hovered, false);
      hovered = r;
      if (hovered) setHighlight(hovered, true);
      return hovered;
    }
    const MTOC = new V3(-3.3, -2.2, -4.6);        // the centrosome, from its placement above

    /* ---- ambient motion, with a solve ----
       NOT THE PLANT CELL'S MOTION. cell/plantcell.js circulates its whole
       cytoplasm, because cyclosis is actin and myosin hauling the cytosol
       round a central vacuole, and this cell has neither. What an animal
       cell's organelles do is jiggle in place and get carried along
       microtubules, which radiate from the centrosome — so this is a wander
       for everything and, for the vesicles, a run in and out along the line
       to the MTOC. Copying the orbit across would have looked the same and
       claimed something false.

       THE SOLVE IS WHAT MAKES THE MOTION VISIBLE. Without one the amplitude
       has to stay under a tenth of a unit or organelles pass through each
       other, and a tenth of a unit in a cell ten across is nothing to look
       at. With it they push apart, so the wander can be big enough to see.
       Same three terms as the plant cell's — a spring to a drifting seed,
       repulsion, a wall — but in THREE dimensions, because this cell is a
       bowl with organelles at many depths rather than a plane. That is also
       why it can be this loose: spheres in a volume pack far more easily
       than discs on a plane, and this cell is about a quarter full. */
    const BODY = { mitochondrion: 1.6, golgi: 2.2, centrosome: 1.4, vesicle: 0.6 };
    const bodies = organelles
      .filter(o => o.userData.organelle !== 'nucleus' && o.userData.organelle !== 'er')
      .map(o => ({
        o, seed: o.position.clone(), p: o.position.clone(), v: new V3(), f: new V3(),
        r: BODY[o.userData.organelle] || 1.2, w: 1,
        run: o.userData.organelle === 'vesicle'
          ? o.position.clone().sub(MTOC).normalize().multiplyScalar(rr(1.4, 2.6)) : null,
        ph: [rr(0, 2 * PI), rr(0, 2 * PI), rr(0, 2 * PI)],
        sp: [rr(0.10, 0.18), rr(0.13, 0.22), rr(0.11, 0.20)],
        amp: rr(0.45, 0.85), runSp: rr(0.05, 0.10), runPh: rr(0, 2 * PI),
        spin: rr(-0.09, 0.09), spinBase: o.rotation.y,
      }));
    // The nucleus takes part as an immovable body: everything else has to
    // get out of its way, and it is far too big to be shoved by a vesicle.
    bodies.push({ o: null, p: nucPos.clone(), seed: nucPos.clone(), v: new V3(), f: new V3(), r: Rn + 0.4, w: 0, run: null });

    const target = new V3(), d3 = new V3();
    function solve(dt) {
      const KS = 14, KR = 260, DAMP = 6, CEIL = -0.4;
      for (const b of bodies) {
        if (b.w === 0) continue;
        target.copy(b.seed);
        target.x += Math.sin(t * b.sp[0] + b.ph[0]) * b.amp;
        target.y += Math.sin(t * b.sp[1] + b.ph[1]) * b.amp * 0.6;
        target.z += Math.sin(t * b.sp[2] + b.ph[2]) * b.amp;
        if (b.run) target.addScaledVector(b.run, Math.sin(t * b.runSp + b.runPh));
        b.f.subVectors(target, b.p).multiplyScalar(KS);
      }
      for (const A of bodies) {
        if (A.w === 0) continue;
        for (const B of bodies) {
          if (A === B) continue;
          d3.subVectors(A.p, B.p);
          const dist = d3.length() || 1e-4, ov = A.r + B.r - dist;
          if (ov <= 0) continue;
          A.f.addScaledVector(d3.divideScalar(dist), KR * ov * (B.w === 0 ? 1.6 : 1));
        }
      }
      const damp = Math.max(0, 1 - DAMP * dt);
      for (const b of bodies) {
        if (b.w === 0) continue;
        b.v.addScaledVector(b.f, b.w * dt).multiplyScalar(damp);
        b.p.addScaledVector(b.v, dt);
        // the shell, and the cut: nothing may rise above the opening
        clampToCell(b.p, b.r);
        if (b.p.y > CEIL - b.r * 0.5) { b.p.y = CEIL - b.r * 0.5; if (b.v.y > 0) b.v.y = 0; }
        b.o.position.copy(b.p);
        b.o.rotation.y = b.spinBase + b.spin * Math.sin(t * 0.07 + b.ph[0]);
      }
    }

    let t = 0;
    function step(dt) {
      t += dt;
      solve(dt);
      nucleolus.material.emissiveIntensity = 0.4 + 0.12 * Math.sin(t * 1.3);
    }

    // World-space bounding sphere of an organelle, for a camera flight.
    function bounds(org) {
      root.updateMatrixWorld(true);
      return new THREE.Box3().setFromObject(org).getBoundingSphere(new THREE.Sphere());
    }

    return { group: cell, organelles, step, pick, hover, bounds, get hovered() { return hovered; } };
  }

  /* ---- one box ------------------------------------------------------- */

  const HOME = { pos: [2, 13, 28], target: [0, -1.5, 0] };

  function mount(el, params = {}) {
    if (!global.CardStage) throw new Error('cell/animalcell.js: load kit/card-stage.js first');
    const THREE = global.THREE, V3 = THREE.Vector3;
    const orbitOf = (pos, target) => {
      const v = new V3().fromArray(pos).sub(new V3().fromArray(target)), r = v.length();
      return { r, phi: Math.acos(clamp(v.y / r, -1, 1)), theta: Math.atan2(v.x, v.z) };
    };
    const home = { pos: params.pos || HOME.pos, target: params.target || HOME.target };
    /* NO IDLE TURNTABLE. The cell has its own motion, and a scene that also
       rotates on its own fights it: the reader cannot tell which of the two
       they are watching, and a drift they did not ask for makes a still
       organelle look like it is moving. Same call as cell/plantcell.js. */
    let sim = null;
    const box = global.CardStage.create({
      mount: el,
      cam: orbitOf(home.pos, home.target),
      stage: Object.assign({ phiMin: 0.15, phiMax: 2.9, rMin: 3, rMax: 70 }, params.stage || {}),
      step: dt => { if (!sim) return; flyStep(dt); sim.step(dt); sim.hover(ndc); },
      viewOffset: params.viewOffset,
    });
    box.cam.target.fromArray(home.target);
    // Soft, shadowless, and fixed. Stage's lights ride the camera, which on a
    // slowly turning cell slides the highlight across every organelle at once;
    // these are dimmed to a wrap and the modelling is done by world-fixed lights
    // instead. No shadow map: a cut bowl casts a hard bar across its own floor,
    // and darkening one organelle because another sits above it is a depth cue
    // that says nothing true about the cell.
    box.renderer.outputEncoding = THREE.sRGBEncoding;
    for (const o of box.camera.children) if (o.isLight) o.intensity *= 0.25;
    for (const o of box.scene.children) if (o.isAmbientLight) o.intensity = 0.22;
    // Sky above, warm bounce off the paper below: the ambient occlusion the
    // scene no longer gets from shadows, as a gradient over each sphere.
    // TOTAL INTENSITY IS THE THING TO WATCH with no shadows and four lights.
    // Over about 1.4 across the rig, small pale parts — a crista top, a
    // vesicle — clip to white and every organelle under a certain size stops
    // having a colour. Raise one light here and lower another.
    box.scene.add(new THREE.HemisphereLight(0xf4f8ff, 0xe8cbb8, 0.55));
    const key = new THREE.DirectionalLight(0xfff4ea, 0.55);
    key.position.set(14, 22, 16);
    box.scene.add(key, key.target);
    const fill = new THREE.DirectionalLight(0xdbe6ff, 0.25);
    fill.position.set(-14, 6, -10);
    box.scene.add(fill, fill.target);
    // Rim from behind and below, so an organelle's silhouette survives against
    // the one behind it now that nothing separates them by contact shadow.
    const rim = new THREE.DirectionalLight(0xffffff, 0.2);
    rim.position.set(-2, -8, -16);
    box.scene.add(rim, rim.target);

    /* camera flights, in Stage's turntable terms (as tree.js) */
    const fly = { active: false, t: 0, dur: 1.4, a: null, b: null, t0: new V3(), t1: new V3() };
    function flyTo(pos, target, dur = 1.4) {
      const c = box.cam;
      fly.a = { theta: c.theta, phi: c.phi, r: c.r }; fly.t0.copy(c.target);
      fly.b = orbitOf(pos, target); fly.t1.fromArray(target);
      let d = fly.b.theta - fly.a.theta;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      fly.b.theta = fly.a.theta + d;
      fly.t = 0; fly.dur = dur; fly.active = true;
    }
    function flyStep(dt) {
      if (!fly.active) return;
      fly.t += dt / fly.dur;
      const k = easeInOut(Math.min(fly.t, 1)), c = box.cam;
      c.theta = lerp(fly.a.theta, fly.b.theta, k);
      c.phi = lerp(fly.a.phi, fly.b.phi, k);
      c.r = lerp(fly.a.r, fly.b.r, k);
      c.target.lerpVectors(fly.t0, fly.t1, k);
      if (fly.t >= 1) fly.active = false;
    }
    const goHome = () => flyTo(home.pos, home.target);
    function focusOn(org) {
      const s = sim.bounds(org), dist = Math.max(s.radius * 2.6, 3.5);
      const dir = box.camera.position.clone().sub(s.center).normalize();
      flyTo(s.center.clone().addScaledVector(dir, dist).toArray(), s.center.toArray());
    }
    // A slow turn that yields to the reader for five seconds after any touch.

    /* pointer: hover lights, a still click on an organelle flies, a drag is Stage's; background does nothing */
    let ndc = null, down = null;
    const canvas = box.canvas;
    const toNdc = e => {
      const r = canvas.getBoundingClientRect();
      return { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -((e.clientY - r.top) / r.height) * 2 + 1 };
    };
    canvas.addEventListener('pointermove', e => { ndc = toNdc(e); canvas.style.cursor = sim && sim.pick(ndc) ? 'pointer' : 'grab'; });
    canvas.addEventListener('pointerleave', () => { ndc = null; });
    canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; fly.active = false; });
    canvas.addEventListener('pointerup', e => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
      const hit = sim.pick(toNdc(e));
      if (hit) focusOn(hit);
    });
    canvas.addEventListener('dblclick', goHome);

    sim = create(THREE, box.root, box.camera, params);
    box.pump();
    return {
      sim, box, flyTo, home: goHome, focusOn,
      start: box.start, stop: box.stop, pump: box.pump,
      destroy: box.destroy,
    };
  }

  global.AnimalCell = { create, mount, DEFAULTS, HOME };
  /* Scale (kit/scale.js, docs/Scale.md). PROP TIER AND NOT A SCALE, as the
     header says: unit is null, so nothing may print a length off this render.
     How big a cell really is belongs on the library card as prose. Ribosomes
     cannot be drawn beside a nucleus at their own size; that factor is the
     declared exaggeration. */
  global.AnimalCell.SCALE = { rung: 'cell', form: 'single', unit: null, exag: { ribosome: 30, mitochondrion: 2 }, down: {} };
})(typeof globalThis !== 'undefined' ? globalThis : this);
