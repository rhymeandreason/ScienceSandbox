/* =============================================================================
 *  leaf/leaf.js — a leaf in cross-section, built from a seed
 * =============================================================================
 *  Five tissue layers on a block: lower epidermis with stomata, spongy
 *  mesophyll with a vascular bundle through it, palisade mesophyll, upper
 *  epidermis, cuticle. Every cell is placed by a seeded generator, so the
 *  same seed is the same leaf and "regenerate" is a new seed.
 *
 *  This is the cell-and-tissue scale of the component library, and the first
 *  that is not a molecule: nothing here is measured, the proportions are a
 *  textbook diagram's, and it says so. Prop tier.
 *
 *      Leaf.create(THREE, root, camera, opts)     the model: root is yours
 *      Leaf.mount(el, params)                     one box, one handle
 *
 *  Params, all live through set():
 *      explode     0..1, the layers lifted apart
 *      seed        integer; changing it rebuilds
 *      isolate     a layer name to keep opaque while the rest fade, or null
 *      autoRotate  the block turns slowly
 *      layers      heights in scene units: {cuticle, upperEpi, palisade,
 *                  spongy, lowerEpi}; changing one rebuilds
 *      width, depth   the block, x and z
 *
 *  Layer names, bottom to top: lowerEpi · spongy · bundle · palisade ·
 *  upperEpi. The bundle explodes with the spongy layer it runs through.
 *
 *  state(): {explode, seed, isolate, hovered, layers:[{name, y, height}]}
 *  Events: 'hover' (name | null) · 'select' (name | null) · 'frame' (state)
 *
 *  Three r128 has no CapsuleGeometry and no RoundedBoxGeometry in the global
 *  build; lib/geo.js carries both, so load it first.
 * ========================================================================== */
(function (global) {
  'use strict';

  const DEFAULTS = {
    explode: 0, seed: 1337, isolate: null, autoRotate: false,
    layers: { cuticle: 0.12, upperEpi: 0.7, palisade: 2.4, spongy: 2.6, lowerEpi: 0.7 },
    width: 14, depth: 7,
  };
  const ORDER = ['lowerEpi', 'bundle', 'spongy', 'palisade', 'upperEpi'];

  const capsule = (T, ...a) => global.Geo.capsule(T, ...a);
  const roundedBox = (T, ...a) => global.Geo.roundedBox(T, ...a);

  function create(THREE, root, camera, opts = {}) {
    const P = Object.assign({}, DEFAULTS, opts);
    P.layers = Object.assign({}, DEFAULTS.layers, opts.layers || {});
    const listeners = {};
    const emit = (ev, ...a) => (listeners[ev] || []).forEach(fn => fn(...a));

    let seed = P.seed >>> 0;
    const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const rrange = (a, b) => a + (b - a) * rand();

    /* One material set PER LAYER, so isolating the upper epidermis cannot dim
       the lower one through a shared material. */
    function mats() {
      const mat = (color, o = {}) => new THREE.MeshPhysicalMaterial(Object.assign(
        { color, roughness: 0.55, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.5 }, o));
      return {
        epiWall: mat(0xe6e9b3, { roughness: 0.45 }),
        epiCell: mat(0xc9d878, { roughness: 0.4, clearcoat: 0.5 }),
        cuticle: mat(0xd6dfa2, { transparent: true, opacity: 0.55, roughness: 0.15, clearcoat: 1 }),
        palisade: mat(0xd6b93a, { roughness: 0.5 }),
        palisadeBand: mat(0x6f8a2c, { roughness: 0.6 }),
        spongy: mat(0x7fa23a, { roughness: 0.65 }),
        spongyDark: mat(0x5d7f2a, { roughness: 0.7 }),
        chloro: mat(0x3f6b1e, { roughness: 0.6 }),
        sheath: mat(0x6f8cad, { roughness: 0.4, clearcoat: 0.6 }),
        sheathInner: mat(0x4a6482, { roughness: 0.5 }),
        xylem: mat(0xf0a020, { roughness: 0.35, clearcoat: 0.7 }),
        phloem: mat(0xe8c75a, { roughness: 0.45 }),
        guard: mat(0x8fb040, { roughness: 0.4, clearcoat: 0.6 }),
      };
    }
    const shadow = m => { m.castShadow = true; m.receiveShadow = true; return m; };

    const block = new THREE.Group();
    root.add(block);
    const layers = {};
    let Y = {}, W = P.width, D = P.depth, bundle = null;

    function layer(name, baseY) {
      const g = new THREE.Group();
      g.userData.name = name; g.userData.baseY = baseY; g.userData.M = mats();
      layers[name] = g; block.add(g);
      return g;
    }

    function buildEpidermis(g, y, h, top) {
      const M = g.userData.M;
      const cellW = 0.85, cellD = 0.85;
      const nx = Math.round(W / cellW), nz = Math.round(D / cellD);
      const wall = roundedBox(THREE, cellW * 0.96, h, cellD * 0.96, 3, 0.16);
      const inner = roundedBox(THREE, cellW * 0.7, h * 0.62, cellD * 0.7, 3, 0.14);
      const wallMesh = new THREE.InstancedMesh(wall, M.epiWall, nx * nz);
      const innerMesh = new THREE.InstancedMesh(inner, M.epiCell, nx * nz);
      const dummy = new THREE.Object3D();
      let i = 0;
      for (let ix = 0; ix < nx; ix++) for (let iz = 0; iz < nz; iz++) {
        const x = -W / 2 + (ix + 0.5) * cellW + rrange(-0.04, 0.04);
        const z = -D / 2 + (iz + 0.5) * cellD + rrange(-0.04, 0.04);
        const wave = Math.sin(x * 0.55) * 0.12 * (top ? 1 : 0.6);
        dummy.position.set(x, y + h / 2 + wave, z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, rrange(0.92, 1.06), 1);
        dummy.updateMatrix();
        wallMesh.setMatrixAt(i, dummy.matrix);
        innerMesh.setMatrixAt(i, dummy.matrix);
        i++;
      }
      g.add(shadow(wallMesh), shadow(innerMesh));
      if (top) {
        const cut = new THREE.Mesh(roundedBox(THREE, W + 0.2, P.layers.cuticle, D + 0.2, 2, 0.05), M.cuticle);
        cut.position.set(0, y + h + P.layers.cuticle / 2 + 0.06, 0);
        g.add(cut);
      } else {
        /* Stomata: two guard cells, a pore between. Real density is a few
           hundred per mm²; this is enough to read as a pattern. */
        const guardGeo = capsule(THREE, 0.14, 0.42, 6, 14);
        const count = Math.round(W * D * 0.14);
        for (let s = 0; s < count; s++) {
          const st = new THREE.Group();
          st.position.set(rrange(-W / 2 + 0.6, W / 2 - 0.6), y - 0.02, rrange(-D / 2 + 0.6, D / 2 - 0.6));
          st.rotation.y = rrange(0, Math.PI);
          for (const side of [-1, 1]) {
            const gm = shadow(new THREE.Mesh(guardGeo, M.guard));
            gm.rotation.z = Math.PI / 2; gm.rotation.x = side * 0.15;
            gm.position.z = side * 0.17; gm.scale.set(1, 1, 1.15);
            st.add(gm);
          }
          g.add(st);
        }
      }
    }

    function buildPalisade(g, y, h) {
      const M = g.userData.M;
      const r = 0.28, sx = 0.66, sz = 0.66;
      const nx = Math.floor(W / sx), nz = Math.floor(D / sz);
      const geo = capsule(THREE, r, h - 2 * r, 4, 12);
      const bandGeo = new THREE.TorusGeometry(r * 0.98, 0.045, 6, 18);
      const mesh = new THREE.InstancedMesh(geo, M.palisade, nx * nz);
      const per = 5;
      const bands = new THREE.InstancedMesh(bandGeo, M.palisadeBand, nx * nz * per);
      const dummy = new THREE.Object3D();
      let i = 0, b = 0;
      for (let ix = 0; ix < nx; ix++) for (let iz = 0; iz < nz; iz++) {
        const x = -W / 2 + (ix + 0.5) * sx + (iz % 2 ? sx * 0.25 : 0) + rrange(-0.05, 0.05);
        const z = -D / 2 + (iz + 0.5) * sz + rrange(-0.05, 0.05);
        if (x > W / 2 - r) continue;
        const hh = h * rrange(0.9, 1.0), tilt = rrange(-0.05, 0.05);
        dummy.position.set(x, y + h / 2, z);
        dummy.rotation.set(tilt, 0, rrange(-0.05, 0.05));
        dummy.scale.set(rrange(0.9, 1.05), hh / h, rrange(0.9, 1.05));
        dummy.updateMatrix();
        mesh.setMatrixAt(i++, dummy.matrix);
        for (let k = 0; k < per; k++) {
          const t = (k + 0.5) / per + rrange(-0.05, 0.05);
          dummy.position.set(x, y + r + (hh - 2 * r) * t, z);
          dummy.rotation.set(Math.PI / 2 + tilt, 0, 0);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          bands.setMatrixAt(b++, dummy.matrix);
        }
      }
      mesh.count = i; bands.count = b;
      g.add(shadow(mesh), shadow(bands));
    }

    function buildSpongy(g, y, h) {
      const M = g.userData.M;
      const cellGeo = new THREE.SphereGeometry(1, 14, 10);
      const chloroGeo = new THREE.SphereGeometry(0.075, 6, 5);
      const placed = [];
      for (let a = 0; a < 9000; a++) {
        const rx = rrange(0.3, 0.6), ry = rrange(0.24, 0.42), rz = rrange(0.3, 0.6);
        const x = rrange(-W / 2 + rx, W / 2 - rx), z = rrange(-D / 2 + rz, D / 2 - rz);
        const yy = rrange(y + ry * 0.9, y + h - ry * 0.9);
        if (Math.hypot(x - bundle.x, yy - bundle.y) < bundle.r + Math.max(rx, ry) * 0.9) continue;
        let ok = true;
        for (const p of placed) {
          const ddx = p.x - x, ddy = p.y - yy, ddz = p.z - z;
          const minD = (p.r + Math.max(rx, rz)) * 0.62;
          if (ddx * ddx + ddy * ddy + ddz * ddz < minD * minD) { ok = false; break; }
        }
        if (ok) placed.push({ x, y: yy, z, r: Math.max(rx, rz), rx, ry, rz });
      }
      const cells = new THREE.InstancedMesh(cellGeo, M.spongy, placed.length);
      const dark = new THREE.InstancedMesh(cellGeo, M.spongyDark, placed.length);
      const chloro = new THREE.InstancedMesh(chloroGeo, M.chloro, placed.length * 8);
      const dummy = new THREE.Object3D();
      let ci = 0, di = 0, ch = 0;
      for (const p of placed) {
        dummy.position.set(p.x, p.y, p.z);
        dummy.rotation.set(rrange(0, 3), rrange(0, 3), rrange(0, 3));
        dummy.scale.set(p.rx, p.ry, p.rz);
        dummy.updateMatrix();
        if (rand() < 0.35) dark.setMatrixAt(di++, dummy.matrix); else cells.setMatrixAt(ci++, dummy.matrix);
        for (let k = 0; k < 8; k++) {
          const th = rrange(0, Math.PI * 2), ph = Math.acos(rrange(-1, 1));
          dummy.position.set(p.x + p.rx * 0.95 * Math.sin(ph) * Math.cos(th),
                             p.y + p.ry * 0.95 * Math.cos(ph),
                             p.z + p.rz * 0.95 * Math.sin(ph) * Math.sin(th));
          dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          chloro.setMatrixAt(ch++, dummy.matrix);
        }
      }
      cells.count = ci; dark.count = di; chloro.count = ch;
      g.add(shadow(cells), shadow(dark), shadow(chloro));
    }

    function buildBundle(g) {
      const M = g.userData.M;
      const len = D + 0.3;
      const sheath = shadow(new THREE.Mesh(new THREE.CylinderGeometry(bundle.r, bundle.r, len, 40, 1), M.sheath));
      sheath.rotation.x = Math.PI / 2; sheath.position.set(bundle.x, bundle.y, 0);
      g.add(sheath);
      const bumpGeo = new THREE.SphereGeometry(0.16, 8, 6);
      const n = 26, rows = Math.round(len / 0.32);
      const bumps = new THREE.InstancedMesh(bumpGeo, M.sheathInner, n * rows);
      const dummy = new THREE.Object3D();
      let bi = 0;
      for (let rw = 0; rw < rows; rw++) for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + (rw % 2) * (Math.PI / n);
        dummy.position.set(bundle.x + Math.cos(a) * bundle.r, bundle.y + Math.sin(a) * bundle.r, -len / 2 + (rw + 0.5) * 0.32);
        dummy.scale.set(1, 1, 1.2); dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        bumps.setMatrixAt(bi++, dummy.matrix);
      }
      g.add(shadow(bumps));
      const core = new THREE.Mesh(new THREE.CylinderGeometry(bundle.r * 0.8, bundle.r * 0.8, len + 0.02, 40, 1), M.sheathInner);
      core.rotation.x = Math.PI / 2; core.position.set(bundle.x, bundle.y, 0);
      g.add(core);
      /* Xylem above, phloem below, as in a leaf vein: xylem faces the upper
         side. Hex-packed tubes, the xylem's wider. */
      const tubeGeo = new THREE.CylinderGeometry(1, 1, len + 0.06, 10, 1);
      const xy = [], ph = [], rr = bundle.r * 0.8, step = 0.19;
      for (let j = -8; j <= 8; j++) for (let i = -8; i <= 8; i++) {
        const px = (i + (j % 2 ? 0.5 : 0)) * step, py = j * step * 0.87, d = Math.hypot(px, py);
        if (py > 0.1) { if (d < rr - 0.12) xy.push([px, py, step * 0.5 * rrange(0.85, 1)]); }
        else if (py < -0.05) { if (d < rr - 0.12) ph.push([px, py, step * 0.36 * rrange(0.8, 1)]); }
      }
      const xylem = new THREE.InstancedMesh(tubeGeo, M.xylem, xy.length);
      const phloem = new THREE.InstancedMesh(tubeGeo, M.phloem, ph.length);
      const fill = (mesh, arr) => arr.forEach(([px, py, r], idx) => {
        dummy.position.set(bundle.x + px, bundle.y + py, 0);
        dummy.rotation.set(Math.PI / 2, 0, 0); dummy.scale.set(r, 1, r);
        dummy.updateMatrix();
        mesh.setMatrixAt(idx, dummy.matrix);
      });
      fill(xylem, xy); fill(phloem, ph);
      g.add(shadow(xylem), shadow(phloem));
    }

    function dispose(g) {
      g.traverse(o => { if (o.isMesh) { o.geometry.dispose(); } });
      for (const k in g.userData.M) g.userData.M[k].dispose();
    }

    function build() {
      for (const k in layers) { block.remove(layers[k]); dispose(layers[k]); delete layers[k]; }
      seed = P.seed >>> 0;
      W = P.width; D = P.depth;
      const H = P.layers;
      Y = { lowerEpi: 0 };
      Y.spongy = Y.lowerEpi + H.lowerEpi;
      Y.palisade = Y.spongy + H.spongy;
      Y.upperEpi = Y.palisade + H.palisade;
      Y.cuticle = Y.upperEpi + H.upperEpi;
      bundle = { x: 2.2, y: Y.spongy + H.spongy * 0.5, r: Math.min(1.15, H.spongy * 0.44) };
      buildEpidermis(layer('upperEpi', Y.upperEpi), Y.upperEpi, H.upperEpi, true);
      buildPalisade(layer('palisade', Y.palisade), Y.palisade, H.palisade);
      buildSpongy(layer('spongy', Y.spongy), Y.spongy, H.spongy);
      buildBundle(layer('bundle', Y.spongy));
      buildEpidermis(layer('lowerEpi', Y.lowerEpi), Y.lowerEpi, H.lowerEpi, false);
      applyExplode(); applyIsolate(); applyHighlight();
    }

    function applyExplode() {
      ORDER.forEach((n, i) => {
        const g = layers[n]; if (!g) return;
        g.position.y = P.explode * (n === 'bundle' ? 2 : i) * 1.6;
      });
    }
    function applyIsolate() {
      for (const n in layers) {
        const dim = !!P.isolate && n !== P.isolate;
        const M = layers[n].userData.M;
        for (const k in M) {
          const mm = M[k];
          if (mm.userData.baseOpacity == null) { mm.userData.baseOpacity = mm.opacity; mm.userData.baseTransparent = mm.transparent; }
          mm.transparent = dim ? true : mm.userData.baseTransparent;
          mm.opacity = dim ? 0.12 : mm.userData.baseOpacity;
          mm.depthWrite = !dim;
        }
      }
    }
    let hovered = null;
    function applyHighlight() {
      for (const n in layers) {
        const M = layers[n].userData.M;
        for (const k in M) M[k].emissive.setHex(n === hovered ? 0x223311 : 0x000000);
      }
    }

    /* Height of the whole block, for a caller framing it. */
    const height = () => Y.cuticle + P.layers.cuticle + P.explode * 4 * 1.6;

    /* ---- pointing ---- */
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2(-2, -2);
    function layerOf(obj) { let o = obj; while (o && !o.userData.name) o = o.parent; return o ? o.userData.name : null; }
    function point(ndcX, ndcY) { pointer.set(ndcX, ndcY); }
    function pick() {
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(block.children, true);
      const name = hits.length ? layerOf(hits[0].object) : null;
      if (name !== hovered) { hovered = name; applyHighlight(); emit('hover', hovered); }
      return hovered;
    }
    function select() {
      const next = hovered && P.isolate !== hovered ? hovered : null;
      set({ isolate: next });
      emit('select', next);
      return next;
    }

    function step(dt) {
      if (P.autoRotate) block.rotation.y += dt * 0.25;
      pick();
      const s = state();
      emit('frame', s, dt);
      return s;
    }
    function state() {
      return { explode: P.explode, seed: P.seed, isolate: P.isolate, hovered,
        layers: ORDER.map(n => ({ name: n, y: (Y[n === 'bundle' ? 'spongy' : n] || 0) + (layers[n] ? layers[n].position.y : 0),
                                  height: n === 'bundle' ? bundle.r * 2 : P.layers[n] })) };
    }
    function set(next) {
      const rebuild = next.seed != null && next.seed !== P.seed
        || next.layers || next.width != null || next.depth != null;
      if (next.layers) P.layers = Object.assign({}, P.layers, next.layers);
      for (const k of Object.keys(next)) if (k !== 'layers') P[k] = next[k];
      if (rebuild) build();
      else { if (next.explode != null) applyExplode(); if ('isolate' in next) applyIsolate(); }
    }
    function on(ev, fn) {
      (listeners[ev] || (listeners[ev] = [])).push(fn);
      return () => { const i = listeners[ev].indexOf(fn); if (i >= 0) listeners[ev].splice(i, 1); };
    }

    build();
    return { step, state, set, on, point, pick, select, height, block, layers, params: () => P, ORDER };
  }

  /* ---- one box ----
     Shadows and a hemisphere light are added here because Stage.create's
     studio lights ride on the camera and cast none, and a leaf read as a
     tissue block needs the layers to shade each other. */
  function mount(el, params = {}) {
    if (!global.CardStage) throw new Error('leaf.js: load kit/card-stage.js first');
    if (!global.Geo) throw new Error('leaf.js: load lib/geo.js first');
    let leaf = null, last = null;
    const box = global.CardStage.create({
      mount: el,
      cam: params.cam || { theta: 0.65, phi: 1.15, r: 24 },
      stage: Object.assign({ phiMax: 1.72, rMin: 8, rMax: 60 }, params.stage || {}),
      step: dt => { if (leaf) last = leaf.step(dt); },
    });
    const r = box.renderer;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    box.scene.add(new THREE.HemisphereLight(0xdfe9d0, 0x6b7a4a, 0.45));
    const key = new THREE.DirectionalLight(0xfff4e0, 0.9);
    key.position.set(12, 18, 10);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -14; key.shadow.camera.right = 14;
    key.shadow.camera.top = 14; key.shadow.camera.bottom = -14;
    key.shadow.bias = -0.0004;
    box.scene.add(key);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: 0.18 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.6; ground.receiveShadow = true;
    box.root.add(ground);

    leaf = create(THREE, box.root, box.camera, params);
    const frame = () => { box.cam.target.set(0, leaf.height() / 2, 0); box.applyCam(); };
    frame();

    /* Pointer in the canvas's own frame: a box is rarely the whole window. */
    const cv = box.canvas;
    const onMove = e => { const b = cv.getBoundingClientRect();
      leaf.point(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1); };
    const onLeave = () => leaf.point(-2, -2);
    const onClick = () => { if (leaf.pick()) leaf.select(); };
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerleave', onLeave);
    cv.addEventListener('click', onClick);
    leaf.on('hover', n => { cv.style.cursor = n ? 'pointer' : ''; });
    box.pump();

    return {
      sim: leaf, box,
      set(next) { leaf.set(next); if (next.explode != null || next.layers) frame(); return this; },
      state: () => last || leaf.state(),
      on: leaf.on,
      start: box.start, stop: box.stop, pump: box.pump,
      destroy() {
        cv.removeEventListener('pointermove', onMove);
        cv.removeEventListener('pointerleave', onLeave);
        cv.removeEventListener('click', onClick);
        box.destroy();
      },
    };
  }

  global.Leaf = { create, mount, DEFAULTS, ORDER };
})(typeof globalThis !== 'undefined' ? globalThis : this);
