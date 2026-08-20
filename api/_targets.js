/* =============================================================================
 *  _targets.js — what the tutor is allowed to point at, per lesson
 * =============================================================================
 *  The same trick as the chapter catalog, one level in. A target id goes into
 *  the response schema as an enum, so the tutor can pick one or pick none and
 *  cannot invent a third thing. The page owns what an id then does; nothing
 *  here knows about Focus, Hotspot or the camera.
 *
 *  `what` is written for the model, not for a student. It is what a question's
 *  wording has to match against, so it says what the thing IS and what it does,
 *  in the words a beginner would use.
 *
 *  Two kinds of claim in here are checked by `demos/ask/check-ask.js`:
 *  a `ui` target names a DOM id that must exist in the lesson, and a `step`
 *  target names a title that must appear in it. Both are how a renamed control
 *  or a re-ordered step turns into a failing check instead of a tutor
 *  confidently pointing at nothing.
 * ========================================================================== */
'use strict';

const LESSONS = {
  'water-lab': {
    title: 'Structure of Water',
    page: 'demos/water-lab.html',
    chapter: 'water',
    targets: [
      // Steps. The student can be sent to one, and the tutor should prefer this
      // over explaining a thing the lesson already animates.
      { id: 'step-polar',   kind: 'step', step: 0, title: 'A Polar Molecule',
        what: 'the step showing one water molecule, its V shape, the 104.5 degree angle, and why oxygen pulls the shared electrons' },
      { id: 'step-hbond',   kind: 'step', step: 1, title: 'Hydrogen Bonds',
        what: 'the step where more water molecules are added and hydrogen bonds link the positive hydrogens to the negative oxygens' },
      { id: 'step-heat',    kind: 'step', step: 2, title: 'Specific Heat',
        what: 'the step about heating water, where energy goes into breaking hydrogen bonds before the temperature rises' },
      { id: 'step-ice',     kind: 'step', step: 3, title: 'Why Ice Floats',
        what: 'the step where cooling locks the molecules into the open hexagonal ice lattice, so ice is less dense than liquid water' },
      { id: 'step-solvent', kind: 'step', step: 4, title: 'The Universal Solvent',
        what: 'the step where salt dissolves, each ion gathering a shell of about six water molecules' },

      // Controls. `el` is the id the lesson already gives the element.
      { id: 'temp-slider',  kind: 'ui', el: 'trange',
        what: 'the temperature slider, which heats the water toward boiling or cools it toward ice' },
      { id: 'add-salt',     kind: 'ui', el: 'addsalt',
        what: 'the button that drops salt into the water so it dissolves into sodium and chloride ions' },
      { id: 'add-water',    kind: 'ui', el: 'addwater',
        what: 'the button that adds another water molecule to the scene' },

      // Molecules. Resolved by the page against what is actually on screen, so
      // there is nothing to keep in step here.
      { id: 'a-hydrogen-bond', kind: 'atoms',
        what: 'a single hydrogen bond between two water molecules, the weak attraction between a positive hydrogen and a negative oxygen' },
      { id: 'the-charges',     kind: 'atoms',
        what: 'the partial charges on one molecule, the slightly negative oxygen and the two slightly positive hydrogens' },
      { id: 'hydration-shell', kind: 'atoms',
        what: 'the shell of water molecules surrounding a dissolved ion, turned so their opposite charge faces inward' },
    ],
  },
};

const forLesson = id => LESSONS[id] || null;
const ids       = lesson => (forLesson(lesson)?.targets || []).map(t => t.id);
const byId      = (lesson, id) => (forLesson(lesson)?.targets || []).find(t => t.id === id) || null;

module.exports = { LESSONS, forLesson, ids, byId };
