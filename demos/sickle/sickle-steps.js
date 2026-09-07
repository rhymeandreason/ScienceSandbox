/* =============================================================================
 *  sickle/sickle-steps.js — sickle cell, as steps for the shell
 * =============================================================================
 *  Content only: what each step says and what it asks the stage to do through
 *  ctx. sickle-lab.html wires it, and its header says what ctx carries.
 *
 *  FOUR BEATS, ONE ARGUMENT: one base, one amino acid, one contact, one cell.
 *
 *      1  cell      BloodCell, whole — the toggle sickles it; the codon card
 *      2  protein   Proteinbox, skin — the two β6 spots, the toggle swaps HbA/HbS
 *      3  split     HbCrowd ×2 — HbA tumbles, HbS docks into a strand lying
 *                   across the frame; both pull back, then BloodCell ×2, cut
 *                   open, fade in over them
 *      4  split     BloodFlow ×2 — discs slip through, crescents catch and jam
 *
 *  Beats 3 and 4 have no panel. Two halves, one caption, Next. The toggle that
 *  drives 1 and 2 sits at the bottom of the room, the same place on both, and
 *  carries one state (ctx.variant) across them.
 *
 *  THE COPY IS SHORT ON PURPOSE. Each beat makes one claim and the scene makes
 *  it; the words say what to look at. Nothing here prints a residue count, a
 *  distance or a rate — the components carry those in state() for a page that
 *  wants them, and this one does not.
 *
 *  Exposes window.SickleSteps.
 * ========================================================================== */
(function (global) {
  'use strict';

  /* HBB, the first eight codons of the coding strand. The initiator methionine
     is numbered 0 because it is cleaved off, so the β chain a student meets
     starts at Val 1 and the glutamate that matters is Glu 6 — which is what
     every clinical description of this mutation calls it. */
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

  /* A STEP'S SUBSCRIPTIONS DIE WITH THE STEP. A readout left subscribed from
     the step before fires on the next step's first set(), looking for an
     element that is no longer in the panel. */
  const bind = (ctx, off) => { (ctx.state.off || (ctx.state.off = [])).push(off); };
  const leave = ctx => {
    (ctx.state.off || []).forEach(f => f());
    ctx.state.off = [];
    ctx.clearTimers();
    ctx.onToggle = null;
  };

  /* ---- 1 ------------------------------------------------------------- */

  const step1 = {
    eyebrow: 'One letter',
    title: 'A point mutation',
    body: `One base in the gene for the β chain of haemoglobin: an A becomes a T.
      That is the whole mutation.`,
    onExit: leave,
    onEnter(ctx) {
      ctx.split(false);
      ctx.toggle(true);
      const { cell } = ctx.use({ show: ['cell'], keep: ['protein'] });
      cell.set({ sickle: ctx.variant === 'HbS' ? 1 : 0 }, { snap: true });
      ctx.onToggle = v => cell.set({ sickle: v === 'HbS' ? 1 : 0 }, { seconds: 2.4 });

      /* The card: one codon, both states, the flow drawn downward. The verdict
         line is the module's and is left off — the claim of this beat is the
         size of the change, and the card shows it. */
      ctx.ui.controls(`
        <div id="codon"></div>
        <p class="hint-text">One base pair changes, so one amino acid changes.
          Flip the switch under the cell to see where that ends up.</p>`);
      ctx.ui.q('#codon').innerHTML = Codon.figure({
        dna: HBB, first: 0, at: AT, to: TO, view: 'card', verdict: false,
        title: 'normal', mutTitle: 'sickle', name: HBA.label, mutName: HBS.label,
      });
    },
  };

  /* ---- 2 ------------------------------------------------------------- */

  const step2 = {
    eyebrow: 'One amino acid',
    title: 'Glutamate becomes valine',
    body: `Same fold, same four chains. Only position 6 of each β chain is different.
      Glutamate carries a charge and sits happily in water. Valine is greasy, and on
      the outside of a protein it wants somewhere to hide.`,
    onExit: leave,
    onEnter(ctx) {
      ctx.split(false);
      ctx.toggle(true);
      const { protein } = ctx.use({ show: ['protein'], keep: ['cell'] });
      protein.show(ctx.variant);
      ctx.onToggle = v => protein.show(v);
      ctx.ui.controls(`<p class="hint-text">Drag to turn it. Flip the switch:
        nothing moves except the two marked spots.</p>`);
    },
  };

  /* ---- 3 ------------------------------------------------------------- */

  const step3 = {
    title: 'The greasy spot sticks',
    onExit: leave,
    onEnter(ctx) {
      ctx.toggle(false);
      ctx.split(true, { left: `Normal · ${HBA.label}`, right: `Sickle · ${HBS.label}` });
      const S = ctx.use({ show: ['crowdA', 'crowdS', 'cellA', 'cellS'] });

      const run = () => {
        ctx.clearTimers();
        ctx.fade('cellA', false); ctx.fade('cellS', false);
        S.cellA.stop(); S.cellS.stop();
        S.crowdA.start();
        S.crowdS.reset().start();
        ctx.caption(`Normal haemoglobin tumbles past itself. Sickle haemoglobin
          catches on the next molecule, and the next.`);
        ctx.after(1.6, () => S.crowdS.play());
      };
      bind(ctx, S.crowdS.on('done', () => {
        ctx.caption(`One contact, repeated, is a stiff rod. Seven rods twist together into a fibre.`);
        /* Both halves pull back before the handoff, so the cell arrives as
           the bigger thing the molecules were inside. */
        ctx.after(0.5, () => { S.crowdA.zoom(1.6, 2.4); S.crowdS.zoom(1.6, 2.4); });
        ctx.after(3.2, () => {
          S.cellA.start(); S.cellS.start();
          ctx.fade('cellA', true); ctx.fade('cellS', true);
          ctx.caption(`Inside the cell, the fibres push the membrane out into a crescent.`);
          ctx.after(1.4, () => { S.crowdA.stop(); S.crowdS.stop(); });
        });
      }));
      ctx.replay(run);
      run();
    },
  };

  /* ---- 4 ------------------------------------------------------------- */

  const step4 = {
    title: 'A stiff cell jams',
    onExit: leave,
    onEnter(ctx) {
      ctx.toggle(false);
      ctx.split(true, { left: 'Normal cells', right: 'Sickle cells' });
      const S = ctx.use({ show: ['flowA', 'flowS'] });
      const run = () => {
        ctx.clearTimers();
        S.flowA.reset(); S.flowS.reset();
        ctx.caption(`Round cells fold and slip through. Stiff cells catch, stick to
          each other, and block the vessel.`);
      };
      bind(ctx, S.flowS.on('blocked', () =>
        ctx.caption(`Blocked. Nothing behind it moves, and the tissue past it runs short of oxygen.`)));
      ctx.replay(run);
      run();
    },
  };

  global.SickleSteps = { steps: [step1, step2, step3, step4], HBB, AT, TO, HBA, HBS };
})(typeof globalThis !== 'undefined' ? globalThis : this);
