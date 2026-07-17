# Game design brainstorm — "what kind of game explains this concept?"

A living doc. The goal of Phase 1 isn't to cover the syllabus — it's to find
the *forms of play* that actually build understanding, so the kit and the remix
agent get a real vocabulary. Add, argue, cross out. Nothing here is locked.

## The test every design should pass

> **Can you win without understanding? Can you understand without winning?**

If either is "yes," it's a visualizer with a score bolted on, not a teaching
game. The concept should *be* the win condition: the rule we want students to
learn is the one they must exploit to succeed. Someone who's internalized the
idea wins; someone who hasn't visibly fails — and wants to retry.

A softer companion question: **where's the gap between wanting and getting?** A
game needs a goal the player can't reach without doing the thing we care about.
A slider that snaps to the answer has no gap.

## Honest read on the current starters

Keep these — but let's call them what they are, so we choose the form
deliberately next time instead of defaulting to "slider + readout."

| App | What it really is | Notes |
|---|---|---|
| cellular respiration | **game** (crafting) | You need the recipe → understanding gates success. |
| bonding | **game-ish** (discovery/collection) | Goal is "collect them all"; the octet rule is the mechanic. |
| enzyme lab | **visualizer** + thin challenge | You dial the slider until the label matches; no understanding required to "win." Excellent explainer though. |
| tonicity | **visualizer** + thin challenge | Same: drag until it says the target word. Great at showing the contrast (animal vs plant). |
| mitosis vs meiosis | **guided tour** | Zero player agency. Perfectly fine — some concepts want a tour — but not a game. |

Takeaway: our default has been the *lab bench* (adjust a control, watch a
readout). Good visualizers, weak games. Widen the pool.

## Menu: learning goal → game form

Different kinds of understanding want different game forms.

| Learning goal | Game archetype | AP Bio concept that fits |
|---|---|---|
| Causal relationship (X changes Y) | tuning / "dial it in" | enzyme, water potential |
| Mechanism / process | crafting, assembly line | cellular respiration, protein synthesis |
| Classification / pattern | sort, swipe, card-match | macromolecules, mutation types, "is this hypertonic?" |
| Sequence / dependency | build-a-pathway, ordering | signal transduction, transcription steps |
| Emergence / populations | god-game, tycoon, agent sim | natural selection, Hardy-Weinberg |
| Tradeoffs / constraints | resource management, puzzle | ATP budgeting, homeostasis |
| Prediction under a rule | predict-then-reveal, betting | genetics crosses, allele frequencies |
| Consequence tracing (backward) | detective / diagnosis | "why did this cell die?" |
| Spatial / structural | manipulation, rotation | DNA 3D, membrane assembly |

## Candidate game briefs

Each brief: **goal · core loop · fail state · what you must understand to win.**
These are for reacting to, not committing to.

### 1. "Why did this cell die?" — diagnosis game
- **Goal:** figure out what killed/sickened a cell from clues.
- **Loop:** inspect symptoms → run a test (change a condition, look at structure) → form a hypothesis → confirm.
- **Fail state:** wrong diagnosis; the "patient" record shows what actually happened.
- **Must understand:** backward reasoning from effect to cause. Naturally *combines* units (osmosis + enzyme + mutation), so one game covers several topics. Hardest, most transferable skill.

### 2. Natural selection as a god-game
- **Goal:** steer a population toward a trait (or just survive a changing world).
- **Loop:** set a pressure (predator, climate) → run generations → **predict** next gen's makeup → see if you were right.
- **Fail state:** population crashes / your prediction is off.
- **Must understand:** selection as a consequence, allele vs genotype frequency. The Hardy-Weinberg math becomes something you *feel* first, then formalize.

### 3. Protein synthesis as a factory line (Overcooked-for-DNA)
- **Goal:** fill protein "orders" under mild time pressure.
- **Loop:** order arrives → transcribe DNA→mRNA → translate codons→amino acids → ship.
- **Fail state:** wrong amino acid / too slow; order rejected.
- **Must understand:** the transcription→translation pipeline and codon reading, as *fluency* rather than chart-lookup.

### 4. Osmosis as a survival/tycoon loop
- **Goal:** keep a paramecium (or plant cell) alive across changing ponds.
- **Loop:** pond changes tonicity → you respond (pump water, move) → survive → next pond.
- **Fail state:** cell bursts or shrivels — a fail state you actually care about.
- **Must understand:** same physics as the current tonicity app, but now with real stakes and a loop instead of a one-shot slider. Could be the tonicity app's "game mode."

### 5. Signal transduction as a relay / pinball
- **Goal:** get the signal from receptor to cellular response.
- **Loop:** wire/aim the cascade → release the signal → it propagates (or doesn't).
- **Fail state:** broken or out-of-order chain → no response.
- **Must understand:** the steps happen in a dependent order; a missing relay stops everything. "Order matters" *is* the mechanic.

## Where we're leaning (revisit)

- Don't lock enzyme/tonicity — keep them as our **explainer** reference point.
- Deliberately prototype **one genuinely different genre** next (diagnosis and
  god-game are the biggest departures from what we have) to see how far the kit
  stretches and to stress-test the eventual platform.
- Open question: how much game vs. how much explainer does a *remixable* starter
  want? A tight game may be harder for students to remix than a loose sandbox.

## Deep dive: mitosis vs meiosis

We already have a **guided tour** for this (the current starter). These are
options for a real *game* version. The two concepts worth spending the game's
difficulty budget on — because they're where students actually struggle:
- **separate pairs vs. separate chromatids** (anaphase I vs. anaphase II/mitosis)
- **crossing over → genetic variation**

### Options
1. **Phase sequencer (drag-and-drop).** Scrambled phase cards + chromosome
   placement. Mitosis in one lane, meiosis in two lanes side by side so the extra
   division is visually obvious. Instant feedback, timed → leaderboard.
   *Win-condition read:* strong if placement (not just card order) is graded —
   you can't fluke chromosome positions.
2. **Cell Division Tycoon (incremental).** Manage a tissue that must grow
   (mitosis) and make gametes (meiosis); wrong division for the goal fails the
   level. Chromosome number is a tracked resource.
   *Read:* uniquely targets *purpose* (growth vs. reproduction), which the others
   ignore. Bigger build.
3. **Chromosome puzzle / matcher.** Match homologous pairs, then choose to
   *separate pairs* (meiosis I) vs. *separate chromatids* (mitosis / meiosis II).
   *Read:* hits the #1 misconception head-on. The choice IS the concept. High
   bang-for-buck.
4. **Error-hunt / spot-the-mistake.** Animated division with a planted flaw (no
   duplication, sisters split in meiosis I, nondisjunction); player clicks + names
   it. Teaches consequences (aneuploidy, Down syndrome tie-in).
   *Read:* excellent *assessment*; tests understanding without letting you fluke it.
5. **Build-a-Gamete with crossing over.** Walk a diploid cell through meiosis,
   physically swap segments at crossing over; end screen counts unique gametes.
   *Read:* the only one that makes *variation* tangible. Pairs naturally with #3.
6. **Battle / card duel (2-player).** Sequence phases to advance; sabotage cards
   hit your opponent. Competitive hook but heaviest build; multiplayer scope.
7. **Side-by-side comparison sandbox.** Two synced cells + a time scrubber.
   Explorable, not a game — basically our current tour with a scrub bar. Good as
   *practice mode* before a *quiz mode*.

### Decision axes
- **Solo vs. multiplayer** — solo is far simpler and enough for a classroom.
- **Assessment vs. exploration** — teacher-usable scores, or a sandbox?
- **How hard the concepts lean in** — biggest payoff is *separate pairs vs.
  chromatids* (#3) and *crossing over → variation* (#5).

### Current pick (refined)
Merge #1 + #3, **but** make the sequencer about *chromosome configurations, not
card names* — ordering named phases teaches the least valuable thing (rote name
order) while feeling game-like. Every step should force a conceptual choice, not
name-recall. Then fold in #4 as the quiz half: **learn mode (mover) + quiz mode
(error-hunt)**, which also answers the teacher-assessment question without a
bolted-on scoring system. Crossing over (#5) is the stretch. Full brief below.

---

## PRE-BUILD BRIEF — "Division Lab" (working title)

Status: spec for review, not built. One `apps/starters/<slug>/index.html`,
vanilla + kit, same conventions as the other starters.

### One-liner
Drive a cell through division by putting the chromosomes in the right
configuration at each step — then prove you get it by catching planted errors.

### Why this design (the test)
- **Can't win without understanding:** success is graded on *chromosome
  positions/choices*, not clickable card order. The pairs-vs-chromatids decision
  is unfakeable.
- **Where's the gap:** the cell won't advance until the configuration is correct;
  a wrong move visibly fails (and, in quiz mode, is the whole point).
- Targets the two real struggles head-on: **separate pairs (anaphase I) vs.
  separate chromatids (mitosis / anaphase II)**, and later **crossing over →
  variation**.

### Modes
- **Learn mode (core):** guided, forgiving. Step the cell through division; at each
  stage the player sets the chromosome configuration. Wrong → gentle correction +
  why. Mitosis and meiosis as selectable modes (meiosis is longer / two rounds).
- **Quiz mode (assessment):** an animated division runs with a planted flaw
  (no duplication / sisters split in meiosis I / nondisjunction); player clicks the
  error and names it from a short list. Scored, teacher-usable. This is #4.
- **Stretch:** crossing-over step (#5) in learn mode — swap segments, end screen
  counts genetically unique gametes → connects to variation.

### Core loop (learn mode)
1. Start: diploid cell, 2n = 4 (two homologous pairs; maternal/paternal colors) —
   reuse the chromosome art from the current tour app.
2. Prompt for the current stage: "Set up **metaphase** — where do the chromosomes
   go?" Player drags/places (or picks from 2–3 configuration options).
3. Check: correct → cell advances with a satisfying snap + one-line why. Wrong →
   it doesn't move; show the misconception ("those are sister chromatids, not
   homologs — in meiosis I the *pairs* separate").
4. Repeat to the end; end screen: mitosis → 2 identical diploid; meiosis → 4 unique
   haploid.

### The critical interactions (don't dilute these)
- **Anaphase decision:** the player explicitly chooses to *separate homolog pairs*
  vs. *separate sister chromatids*. Same prompt in mitosis vs. meiosis I → opposite
  correct answers. This one screen is the reason the app exists.
- **Metaphase alignment:** single file (mitosis) vs. paired at the plate
  (meiosis I). Placement is graded, not just "next."

### Fail states
- Learn: can't advance on a wrong config (soft fail + explanation).
- Quiz: misidentifying the error scores the round and reveals what actually went
  wrong and its consequence (e.g., nondisjunction → aneuploidy / Down syndrome
  tie-in).

### Scope / cuts
- **In:** learn mode (mitosis + meiosis), quiz mode (error-hunt), score readout.
- **Stretch:** crossing over + unique-gamete counter.
- **Out (for now):** multiplayer/duel (#6), tycoon/purpose framing (#2 — great
  *second* game later), leaderboards, timers.

### Reuse / kit notes
- Chromosome glyphs (X vs. single, recombinant tips) already exist in the current
  mitosis-vs-meiosis tour — lift them. Likely promote to a kit helper if this ships.
- Needs a **drag-to-place / snap-to-slot** interaction we don't have yet — this is
  the new pattern this app contributes to the kit vocabulary.
- Config-based data (stages, valid chromosome positions) is very remixable: a
  student could change organism / chromosome number / add pairs.

### Decisions
- **Configuration = drag-to-place.** ✓ Decided. Drag the chromosomes into
  position (snap-to-slot), not pick-from-options — it teaches more and makes the
  pairs-vs-chromatids choice a physical action. Needs to stay Chromebook-friendly:
  generous snap targets, pointer events (mouse + touch), no tiny hit areas.

### Open questions
- Is quiz mode v1, or a fast-follow after learn mode proves out?
  → **Decided: learn mode first**, quiz (error-hunt) is the fast-follow.

## Parking lot (unsorted ideas)

- "You are the molecule" first-person: be a water molecule / RNA polymerase.
- Tinder-swipe classifier: quick "hyper/hypo/iso?" or "which macromolecule?" reps.
- Tower defense = immune system (pathogens vs defenses).
- Escape room that chains several concepts for a unit review.
- Homeostasis as a balancing/physics game (keep the ball centered).
