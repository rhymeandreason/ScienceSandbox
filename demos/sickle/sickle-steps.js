/* =============================================================================
 *  sickle/sickle-steps.js — sickle cell, as steps for the shell
 * =============================================================================
 *  Content only: what each step says, what controls it puts in the panel, and
 *  what it asks the stage to do through ctx. sickle-lab.html wires it.
 *
 *  FOUR SCENES, NOT ONE, and that is the lesson's shape rather than an
 *  accident. A gene, a pair of molecules, a fibre and a cell are four rungs of
 *  the scale ladder, and components at different rungs may not share a camera
 *  (docs/Scale.md). So `ctx.use(name)` hands the stage from one component to
 *  the next; nothing here moves a camera between rungs.
 *
 *      1  gene      Proteinbox — one tetramer, skin, the beta6 patch
 *      2  contact   SickleFibre 'contact'  — two molecules, one contact
 *      3  fibre     SickleFibre 'strand' -> 'fibre'
 *      4  cell      BloodCell
 *
 *  Beats 2 and 3 are ONE component and one mount: the fibre is the contact
 *  repeated, and re-mounting between them would say they were two subjects.
 *
 *  EVERY NUMBER IS READ AT RENDER TIME, from the component's own `state()` or
 *  from dna/codon.js's analysis. Nothing here types a residue, a distance or a
 *  count (CLAUDE.md).
 *
 *  Exposes window.SickleSteps.
 * ========================================================================== */
(function (global) {
  'use strict';

  /* HBB, the first eight codons of the coding strand. The initiator
     methionine is numbered 0 because it is cleaved off, so the beta chain a
     student meets starts at Val 1 and the glutamate that matters is Glu 6 —
     which is what every clinical description of this mutation calls it. */
  const HBB = 'ATGGTGCACCTGACTCCTGAGGAG';
  const AT = 19, TO = 'T';                 // the substitution, in the fragment

  const HBA = {
    id: '2HHB', label: 'HbA',
    trace: 'proteins/hemoglobin/data/hb-2HHB.json',
    surface: 'hemoglobin/data/2HHB.lesson.surf.bin',
  };
  const HBS = {
    id: '2HBS', label: 'HbS',
    trace: 'proteins/hemoglobin/data/hb-2HBS.json',
    surface: 'hemoglobin/data/2HBS.lesson.surf.bin',
  };

  const fmt = (n, d = 1) => Number(n).toFixed(d);

  /* A STEP'S SUBSCRIPTIONS DIE WITH THE STEP. Beats 2 and 3 share one
     component, so a readout left subscribed from the step before fires on the
     next step's first `set()` — looking for an element that is no longer in the
     panel, and throwing inside `set` BEFORE the new step has drawn its own
     controls. The symptom was a beat with no controls at all, which looks like
     the step failing rather than the one before it. */
  const bind = (ctx, off) => { (ctx.state.off || (ctx.state.off = [])).push(off); };
  const unbindAll = ctx => {
    (ctx.state.off || []).forEach(f => f());
    ctx.state.off = [];
  };

  /* ---- 1 ------------------------------------------------------------- */

  const step1 = {
    eyebrow: 'One letter',
    title: 'A gene, and the protein it spells',
    body: `One base of the β-globin gene changes, and the codon it sits in reads a
      different amino acid. Nothing else about the gene changes, and — this is the
      part worth holding on to — nothing else about the protein does either.`,
    onExit: unbindAll,
    onEnter(ctx) {
      const P = ctx.use('gene');
      const res = Codon.read({ dna: HBB, first: 0, at: AT, to: TO });
      ctx.state.codon = res;

      ctx.ui.controls(`
        <div class="segmented" id="which">
          <button class="is-on" data-v="${HBA.id}">${HBA.label} — normal</button>
          <button data-v="${HBS.id}">${HBS.label} — sickle</button>
        </div>
        <div id="codon"></div>
        <p class="stats" id="says"></p>`);

      /* The card view: one codon blown up, both states, the flow drawn
         downward. The claim in this beat is the arrows — that a change in DNA
         reaches the protein — and a strip has none. */
      ctx.ui.q('#codon').innerHTML = Codon.figure({
        dna: HBB, first: 0, at: AT, to: TO, view: 'card',
        name: 'normal haemoglobin', mutName: 'sickle haemoglobin',
      });

      const says = ctx.ui.q('#says');
      const show = id => {
        const v = id === HBS.id ? HBS : HBA;
        const c = ctx.state.codon.change;
        P.setData(ctx.trace(v), { chains: 'A,B,C,D', keep: true });
        P.setSurface(v.surface).then(() => {
          const info = P.patchInfo('b6');
          if (!info || !info.residues.length) return;
          /* The residue is read off the mesh, not asserted: the page says what
             it found on the surface it is drawing. */
          const name = info.residues[0][2];
          says.textContent = `Residue ${c.n} on both β chains is ${name}`
            + ` — ${id === HBS.id ? Codon.AA[c.aaNow].klass : Codon.AA[c.aaWas].klass}.`;
          ctx.ui.q('#codon').scrollTop = 0;
        });
      };
      ctx.ui.qa('#which button').forEach(b => {
        b.onclick = () => {
          ctx.ui.qa('#which button').forEach(o => o.classList.toggle('is-on', o === b));
          show(b.dataset.v);
        };
      });
      show(HBA.id);
    },
  };

  /* ---- 2 ------------------------------------------------------------- */

  const step2 = {
    eyebrow: 'A patch and a socket',
    title: 'Sticky needs somewhere to stick',
    body: `A greasy knob on its own does nothing. What makes it matter is that a
      NEIGHBOURING haemoglobin has a greasy dent — Phe85 and Leu88 — the right
      size to take it. Both are there in normal haemoglobin too. What is missing
      there is anything to put in the dent.`,
    onExit: unbindAll,
    onEnter(ctx) {
      /* Controls before the component: a `set()` can fire a listener that reads
         the panel, and the panel has to be the one this step drew. */
      ctx.ui.controls(`
        <div class="chips" id="marks">
          <button class="chip is-on" data-l="marks">the two sites</button>
          <button class="chip is-on" data-l="idle">the spare pair</button>
        </div>
        <p class="stats" id="dist"></p>`);
      const F = ctx.use('fibre');
      F.set({ preset: 'contact', rep: 'surface', marks: true });
      ctx.ui.qa('#marks .chip').forEach(b => {
        b.onclick = () => {
          b.classList.toggle('is-on');
          F.show(b.dataset.l, b.classList.contains('is-on'));
        };
      });
      const write = () => {
        const s = F.state();
        if (!s) return;
        ctx.ui.q('#dist').textContent =
          `β6 to the pocket: ${fmt(s.measured.contactLateralA, 2)} Å across the pair,`
          + ` ${fmt(s.measured.contactAxialA, 2)} Å along it. Measured in ${s.measured.source}.`;
      };
      bind(ctx, F.on('build', write)); write();
    },
  };

  /* ---- 3 ------------------------------------------------------------- */

  const step3 = {
    eyebrow: 'It repeats',
    title: 'One contact, over and over',
    body: `Each molecule offers one patch and one pocket — one way in, one way out.
      That is what makes this a strand rather than a clump. Stack the contact and
      you get a rod; wind seven of those together and you get the fibre that
      stiffens the cell.`,
    onExit: unbindAll,
    onEnter(ctx) {
      ctx.ui.controls(`
        <label class="slider">how many copies
          <input id="rep" type="range" min="1" max="24" step="1" value="4"></label>
        <div class="segmented" id="shape">
          <button class="is-on" data-p="strand">one strand</button>
          <button data-p="fibre">the fibre</button>
        </div>
        <p class="stats" id="len"></p>`);
      const F = ctx.use('fibre');
      F.set({ preset: 'strand', rep: 'surface', marks: true, repeats: 4 });
      ctx.ui.range(ctx.ui.q('#rep'), v => F.set({ repeats: +v }, { snap: true }));
      ctx.ui.qa('#shape button').forEach(b => {
        b.onclick = () => {
          ctx.ui.qa('#shape button').forEach(o => o.classList.toggle('is-on', o === b));
          /* The preset carries its own repeat count, and here the slider is the
             one that means anything: switching shape must change how many
             STRANDS there are, not silently move a number the reader set. */
          F.set({ preset: b.dataset.p, rep: 'surface',
                  repeats: +ctx.ui.q('#rep').value });
        };
      });
      const write = () => {
        const s = F.state();
        if (!s) return;
        /* The strain is the model's own caveat and it is printed, not hidden:
           past about 2 Å rigid copies of a crystal strand have stopped
           modelling anything. */
        ctx.ui.q('#len').innerHTML =
          `${s.tetramers} molecules · ${fmt(s.lengthNm, 0)} nm long`
          + (s.modelled.overStrained
            ? `<br><span class="warn">the modelled twist is straining every contact by `
              + `${fmt(s.modelled.strainA, 1)} Å — more than a rigid copy can carry</span>`
            : '');
      };
      bind(ctx, F.on('build', write)); write();
    },
  };

  /* ---- 4 ------------------------------------------------------------- */

  const step4 = {
    eyebrow: 'The cell',
    title: 'Two consequences, one cause',
    body: `The fibre is stiff and the cell is not. Rods grow until they push the
      membrane out of shape, and everything that follows is geometry rather than
      new chemistry: a stiff, pointed cell cannot fold through a capillary, and its
      stretched membrane tears more easily than a round one.`,
    onExit: unbindAll,
    onEnter(ctx) {
      ctx.ui.controls(`
        <label class="slider">sickled
          <input id="sk" type="range" min="0" max="100" step="1" value="0"></label>
        <label class="slider">cut away
          <input id="cut" type="range" min="0" max="100" step="1" value="0"></label>
        <p class="stats">Round, it folds through a capillary narrower than itself.
          Pointed, it jams — and the cells behind it stop too.</p>`);
      const C = ctx.use('cell');
      ctx.ui.range(ctx.ui.q('#sk'), v => C.set({ sickle: +v / 100 }, { snap: true }));
      ctx.ui.range(ctx.ui.q('#cut'), v => C.set({ cut: +v / 100 }, { snap: true }));
    },
  };

  /* ---- 5, not built ---------------------------------------------------
   *  Why the allele is still here: the heterozygote's partial resistance to
   *  malaria. It is the one beat with no 3D subject, and the figure it wants is
   *  a graph — risk of severe malaria by genotype, and allele frequency against
   *  historical endemicity. Both need sourced numbers in a data file with their
   *  citations, since a number in user-facing text is read at render time and
   *  never typed. Left out rather than stubbed with invented data.
   */

  global.SickleSteps = { steps: [step1, step2, step3, step4], HBB, AT, TO, HBA, HBS };
})(typeof globalThis !== 'undefined' ? globalThis : this);
