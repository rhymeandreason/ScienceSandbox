## Animation rules for molecules

**The moving thing is a courier, not the atom**

* Every particle in flight needs a **real mesh at both ends**: shed the source atom as the hop starts, reveal a real atom at the destination on arrival. A glow that fades at a target leaves the molecule unchanged and reads as the atom having been *destroyed*.

* The test: *"where did the extra one come from?"* If the source atom is still sitting there while a copy flies away, the chemistry has two atoms where it has one. This defect recurred four times today — steps 1, 3, 6 (whole-step route) and 2.

* An atom that exists only *during* a reaction still belongs in the spec, hidden at build and revealed at its beat (`openH`on G6P's ring oxygen). Formula checking ignores hydrogen count — H is a drawing decision — so this is legal.

* Read positions **before** shedding or turning, and `.clone()` them. `atomWorld` on a shed atom gives you where it isn't.

**Species identity is the badge; motion is the grammar**

* Colour names the *class* of event (steel = hydrogen, orange = phosphate, green = carrier, violet = bond breaking). A colour that means "phosphate" firing on a beat where none moved is a false claim.

* The `+`/`−` badge names the *species*. Proton vs hydride is the distinction that does real work — it's why NAD⁺ is reduced at step 6 and by no other step.

* **Transfer vs departure is carried by motion, not by colour**: a transfer swells, arcs and settles onto a target; a departure snaps off the bond, holds visibly detached, then drifts out fading. A transfer can end by stopping because something caught it; a departure has to end by *becoming nothing*, or it reads as vanishing rather than leaving.

**Timing**

* **Slow enough to track.** 0.5 s over a bond length is a flash. \~900 ms reads as a journey.

* **Arc proportional to the trip, capped.** A fixed arc that's half the distance travelled makes the particle bulge up and come back — a flare, not a path.

* **Beats run in sequence, never stacked.** Three things at t=0 means the student sees only the largest. Worse, a hop whose target is moving underneath it lands where the target *was*.

* **Anchor downstream beats on the real landing moment**, not a constant that happens to have the right value. `FLY` stood in for "when the proton lands" only because the hop used to run at fx.js's default.

* **Two events in one step must differ in direction *and* order**, not speed alone. Once both are slow enough to follow, similar durations collapse them into one swap. Staggering the start also puts them in causal order — the hydride leaves, *then* the gap it left gets filled.

* Everything on the render loop (`kit/motion.js`), never `setTimeout` — a backgrounded tab must freeze, not fire its timers past you.

**Where the student is looking**

* **The state change must land on the beat that earns it.** Carriers flip when the transfer *arrives*, not when the step completes. `carrierGone` means "this instance has already moved" — set it at whichever end the transfer is visible from.

* **Ring what changed**, at the bond or junction, not on the biggest atom nearby — a ring on the phosphorus sits a bond length off the actual event and reads as decorating the atom.

* **Swap molecules at the least visible instant** — edge-on, mid-turn — so the seam between two specs falls where a rotamer's worth of difference can't be seen.

**Don't bend the chemistry for legibility**

* When a one-atom difference *is* the lesson, **orientation becomes load-bearing**. Ask the human to rotate the molecule so the atom faces the camera and set the view parameter; document the rotation as a constraint, or the next composition tweak silently undoes it.

* **Move the camera, not the atom.** GAPDH delivers its hydride to the pro-R face; toggling the more visible pro-S hydrogen would have been clearer and wrong. Check the stereochemistry *before* optimising for visibility.

* Pedagogical exaggerations stay explicit in comments — the C2→C1 hop is drawn as a direct transfer but really runs through the cis-enediol.

**Structural**

* **Per-lane and whole-step routes must call the same code.** They drifted three separate times today, each time telling a different story about the same reaction.

* Aim flights at a spec's own named atoms (`gly.open`, `gly.cleave`, `anchor`), never typed coordinates — a rebuilt spec leaves those behind.
