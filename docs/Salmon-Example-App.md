Read `docs/Components.md` first, since it is the whole API, and `docs/AddingAPage.md` for the repo's page conventions. Then these, which are the things only this session knows:

**Where and what**

* Build `membrane/salmon-lab.html` on the shell, copied from `tests/gen-salmon-q2-test.html`. Status prototype, a card in admin.html under Membrane, not under Generated apps.

* Use only the public handle: `Membrane.mount`, `set`, `state`, `note`, `notes`, `show`, `showPanel`, `flyTo` is Tree's only. Reaching into `m.sim` is allowed but each reach is a finding: note it, because it means the component or the reference is missing something a generated page will also need.

* Layout for an honest gill cell: `NA`, `K`, `pump`, `AQP`. The layout spaces them itself, so give x by order only.

* Contents by the headcount rule: the same particle count per side, fewer free waters where the salt is. The bench's numbers are a tested starting point: inside water 46, K 20, Na 4, A 8; seawater water 26, Na 26, Cl 26; river water 74, Na 2, Cl 2.

**Copy and notes**

* Open on a question, not a statement. Body under two short paragraphs per step, one claim in bold that the picture is showing right now. No em dashes.

* Answer with the scene. Each step turns on the two or three notes that are its subject with `notes([...])`, and clears them on exit. Use `showPanel(m, { notes: [...], layers: [...] })` per step with a deliberate pick, never the bare default.

* Print numbers from `state()`, never typed: water per side, `net`, ATP spent, the potential. `net` is the headcount's verdict and is right from the first frame; `netRecent` is noise for half a minute, so if it appears, it appears as a count.

* Keep `timeScale` at 1 unless a step needs a long run, and say so in the step if it changes.

**Science to hold to**

* The cell does not change its own blood. The inside is the same in every scene; only the outside changes. That is the point of the lesson and what makes the gill's work visible.

* The pump's direction never reverses. In the river, the salmon's problem is salt loss and water gain, and this component shows the water side honestly and the salt side only as a leak. If the step wants to claim active salt uptake in freshwater, say in one sentence that the gill does it with other transporters not drawn here. Do not fake it.

* Urine and drinking are kidney and gut facts, not on stage. Stat tiles are fine for them, with a line saying they are off screen.

**When it is done**

* Add three or four lines to the Membrane section of Components.md saying what the example does that a generated page should copy: default notes per step, the framing, copy length. Do not paste the page into the reference.

* Tell me the request wording you consider it the answer to. That becomes the eval I rerun after every reference change, diffed against your page.

One thing to expect in the browser: a backgrounded pane never runs the loop, so drive the page with `m.pump(1/60)` from the console when checking a step, and test in Safari for the look.

**Recent Add: concentration in units** 

**How it works.** Mount with `units: 'mM'` and give `contents` in millimolar, leaving water out. The module draws one particle per 20 mM and fills each side with water up to 78 particles, so the headcount rule holds without the page doing arithmetic. `state().concentration[kind].inside / .outside` reads the counts back in mM, so a page prints a molarity it never typed.
