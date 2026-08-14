Summarize the key technical parts I need to build a folding UI from secondary structures for insulin and antifreeze proteins.

---

Both your targets are tiny — insulin is 51 residues, Type I AFP is 37, the insect β-helix AFPs are \~85 — so performance is a non-issue and naive implementations will work. The difficulty is all in representation.

## 1. Backbone builder (torsion space)

Your core primitive. Build Cartesian coordinates from internal coordinates using NeRF (natural extension reference frame): place each atom from the previous three plus a bond length, angle, and dihedral.

Fixed ideal geometry: N–CA 1.458 Å, CA–C 1.525 Å, C–N 1.329 Å; angles N-CA-C 111.2°, CA-C-N 116.2°, C-N-CA 121.7°; ω = 180°.

Ideal SSE torsions: α-helix (φ −57, ψ −47), antiparallel β (−139, 135), parallel β (−119, 113).

This is maybe 80 lines and it's the thing that guarantees every structure the player produces is chemically valid.

## 2. Kinematic tree

Rooted tree over residues; changing a torsion transforms everything downstream. Cache per-node transforms and invalidate only the affected subtree — that's what makes dragging feel instant.

**Insulin forces multi-chain support.** A (21 res) and B (30 res) are separate trees with no covalent path between them. They're held by three disulfides: A6–A11 intrachain, A7–B7 and A20–B19 interchain. So you need disulfides as constraint objects, not bonds in the tree: SG–SG 2.05 Å, CB–SG–SG ≈ 104°, χ3 near ±90°. Score them as restraints; let the two trees float independently otherwise.

## 3. Loop closure

**CCD (cyclic coordinate descent).** Iteratively rotate each loop torsion to minimize the distance between moving and target anchor atoms. \~100 lines, converges reliably for loops under \~12 residues. KIC is more elegant and much harder; skip it.

Cheap precheck before you even attempt closure: max span ≈ 3.3 Å × residue count. If the anchors are further apart than that, refuse the move and tell the player why. This is free to compute and it's your best teaching mechanic.

## 4. Scoring — incremental, centroid-level

Backbone atoms plus one pseudo-atom per sidechain, weighted by residue type. Spatial hash for neighbors; on any move, rescore only residues within cutoff of what moved.

Four terms carry insulin:

* **Steric** — soft sphere overlap, capped so it stays differentiable

* **Burial** — neighbor count per residue scored against a hydrophobicity scale (your "orange in" signal)

* **Backbone H-bond** — needed for helix/sheet definition

* **Disulfide restraint** — distance + geometry

## 5. Ice lattice term (AFP-specific, and the part nobody else has)

Hexagonal ice Ih: a = 4.52 Å, c = 7.36 Å, O–O = 2.76 Å. Generate oxygen positions for a chosen plane — basal (0001), primary prism (10-10), pyramidal — as a fixed periodic point set.

Score = registration quality between surface hydroxyl oxygens (Thr OG1 primarily, plus Ser/Tyr) and lattice positions, within a tolerance window. Six rigid DOF for the protein against the lattice, plus whatever surface geometry the player controls.

**Start AFPs with Type I** (winter flounder, 37 residues, single α-helix, Ala-rich with 11-residue Thr repeats). One helix means zero folding problem — the entire game becomes rotating the helix to present its Thr face to the ice. That isolates your new scoring term perfectly. Save the insect β-helices for later; they're 8-disulfide, 12-residue-coil structures that will fight your architecture.

Since you're treating the open question as the lesson: **implement two competing objectives as toggleable terms** — hydrogen-bond complementarity versus hydrophobic/clathrate surface matching. Let players see that the two hypotheses rank their designs differently. That's a more honest and more interesting lesson than any single score, and it costs you almost nothing to build.

## 6. Minimizer

Deterministic gradient descent in torsion space — L-BFGS is fine. Analytical gradients via chain rule down the tree, or numerical if you're impatient (your systems are small enough).

**Not MD.** No thermostat, no stochasticity. Same input must give the same output and the score must move monotonically, or players can't learn from their moves. This is the single most important design constraint and the easiest one to get wrong coming from an OpenMM mindset.

Keep OpenMM out of the interactive loop entirely. Use it offline for relaxation and sanity-checking, if at all.

## 7. Rendering and interaction

Custom in-house renderer.

Interaction surface: drag with IK, per-SSE rigid handles, user-placed restraints (bands), freeze, and a mutate palette. Decide explicitly what runs per-frame versus on mouse-release.

## Build order

1. Backbone builder + kinematic tree + render — no scoring

2. Steric + burial, incremental — the game becomes playable here

3. CCD + span precheck

4. Disulfides → insulin works

5. Ice lattice term → Type I AFP works

6. Rotamers and design (mutation) → insulin analogs become possible

Steps 1–3 are the real engine. Everything after is content.

---

Short summary of what we need to build hemoglobin/sickle cell.

### Data

* **2HHB** (deoxy T-state — the polymerizing form; don't use oxy)

* **2HBS** (deoxy HbS fiber structure — gives you the real Val6→pocket contact geometry to score against)

* Kyte-Doolittle or Eisenberg hydrophobicity scale

### Rendering

* Solvent-accessible surface, hydrophobicity-colored (blue polar / orange nonpolar — inherit Foldit's palette, it works)

* Cartoon toggle for chain context

* Mol\* handles both out of the box; no custom renderer needed at this stage

### Interaction

* Toggle β6: Glu ↔ Val (two states, precomputed — no rotamer sampling)

* Rigid-body drag + rotate of a second tetramer, 6 DOF

* Camera focused on the β6 region by default

### Scoring

* **Patch score**: buried nonpolar surface area at the interface

* **Complementarity**: Val6 sidechain centroid inside the acceptor pocket, distance-scored

* **Steric**: soft overlap penalty

* Live number, plus a visual — glow the patch when it's exposed, snap-highlight when docked

That's it. No kinematic tree, no loop closure, no minimizer, no force field.

### Pedagogy (the part that differentiates you)

* Explicit label: *the protein folds correctly* — sequence, fold, and structure are all fine

* Two-copy docking to show fibers propagate

* Optional: hydrophobicity readout at β6 as the number that changes

### Scope guard

Don't model fiber growth, don't model oxygen binding, don't let anyone fold anything. Load, mutate, look, dock.

**Student-friendly explanation:**

Your body makes hemoglobin, the protein that carries oxygen in your blood, from a recipe written in your DNA — and in sickle cell anemia, exactly one letter of that recipe is different. That one change swaps a single building block on the protein's surface: out goes a water-loving one, in comes a grease-loving one. The protein still folds into the right shape and still carries oxygen just fine. The problem is that grease-loving patch. Water is everywhere in your cells, and grease hates water, so the patch goes looking for somewhere to hide — and the only thing nearby with a matching greasy spot is another hemoglobin molecule. They stick. Then another sticks to that one, and another, until they've stacked into long stiff rods that stretch the round red blood cell into a curved sickle shape, which jams in narrow blood vessels and causes pain and damage. So the whole disease comes down to a single misplaced patch on a surface — the protein isn't broken, it's just sticky in one spot it shouldn't be.

---

I'm thinking of making a tool to interactively unfold hemoglobin. this is largely for the purpose of making a nice animation. but could that also be a good way to build gradually?

Unfolding as a build strategy is smarter than it sounds, for a reason that isn't the animation.

### Why it's genuinely good scaffolding

**You start from a correct structure, so every intermediate is scored against a known target.** Forward folding gives you a scoring function with no ground truth — you're asking "is this good?" with no way to check. Unfolding gives you RMSD-to-native for free at every frame. Your scoring function has an answer key while you're writing it.

**It exercises the same machinery in the safe direction.** Unfolding is torsion changes propagating through a kinematic tree — identical code to folding, but you can never fail. There's no loop closure problem, no search, no local minima. You build the tree, the NeRF builder, the incremental rescoring, and the render pipeline, and you debug all of them against a case where you always know what correct looks like.

**Then you reverse it and you have a game.** Record the unfold as a torsion trajectory. Play it backward and it's a folding animation. Stop partway, hand it to a player, and it's a puzzle with a guaranteed solution and a tunable difficulty knob — perturb 5 torsions for easy, 50 for hard. That's Foldit's "revisiting" puzzle format, and it's how you generate content without needing a research pipeline.

### The bonus you've just unlocked

**Rigid-body-on-a-string is exactly the topology representation.** Once helices are objects with position and orientation, the natural interaction isn't dragging atoms — it's dragging *helices*. Pick up helix E, move it, loops follow via IK.

That's a better manipulation interface than Foldit has, it's the representation Baker-lab blueprint design actually uses, and it means the unfolder and the folding game share a data model rather than just sharing code.

### Where it stops working

All-helical proteins only. β-sheets break this cleanly — a strand isn't independent, the sheet is the rigid body, and register is a discrete long-range constraint that doesn't fit "rigid bodies on a string" at all.

Which is fine. Myoglobin, hemoglobin, and Type I AFP are all-α. Insulin is all-α. You've got three targets and a build path before it matters, and by then you'll know whether the abstraction earned a second version.

### Data model

* Load PDB → assign helices (DSSP or use PDB HELIX records)

* Represent as: N rigid bodies (helix local coords + transform) + connector loops (φ/ψ arrays)

* Everything downstream operates on this, not on atom coordinates

### Core components

1. **NeRF builder** — internal coords → Cartesian. Fixed ideal bond lengths/angles, ω=180°. \~80 lines.

2. **Kinematic chain** — helix transforms derived from upstream loop torsions; cache and invalidate downstream only.

3. **Loop constraints** — Ramachandran clamp per residue type (Gly wide, Pro narrow); span check at 3.3 Å/residue.

4. **Sterics** — capsule per helix for broad phase (axis + \~5 Å radius), atom pairs only on capsule overlap.

5. **Trajectory recorder** — torsion arrays per keyframe, not XYZ. Scrubbable, reversible, reusable as puzzle states.

### Rendering

* In-house render

* Helices as cylinders — your physics objects and visual objects are already the same objects

### Interaction

* Drag a helix (6 DOF); loops follow

* Scrub the trajectory

* Play reversed = folding animation

### Known gotchas

* Let helix terminal residues flex, or accept \~1 Å RMSD on refold

* Stage the unfold (loops → packing → helices) if it's for teaching; linear interpolation looks wrong and teaches wrong

* Start single-chain (myoglobin), not hemoglobin

### Not needed yet

Minimizer, loop closure IK, force field, rotamers, design, OpenMM.

**Deliverable:** an animation tool. **What you actually have:** the folding engine's foundation, minus two components.

---

### 1. Better manipulation than Foldit

Foldit's tools are **residue-level**. Pull grabs a residue and drags; the chain follows through IK. Bands pin residues together. Wiggle minimizes over all torsions.

That's the right granularity for the problem Foldit was built for in 2008 — refining an approximately-correct model, where the moves that matter are local. But it means there's no way to say the thing a structural biologist actually thinks, which is *"helix E should pack against helix B, rotated about 20° from where it is."* In Foldit you approximate that with a band and a lot of wiggling, and you watch the helix deform in ways you didn't ask for while the minimizer finds its own path there.

With helices as first-class objects you get a handle for exactly that operation. Grab helix E, rotate it, translate it; loops absorb the change; the helix stays a helix because it's rigid by construction. The move you intend is the move you make.

**Where I'd hedge:** this is better for *topology-level* work — arranging a fold, packing a core, design. It's worse for refinement, where the interesting motion is precisely the local backbone deviation you've defined away. Foldit's residue tools aren't a design failure, they're tuned for a different task. You're not strictly improving on them; you're picking a different level of abstraction that's better suited to your targets and your audience.

**Blueprint alignment.** Rosetta blueprints specify folds as per-residue SS/torsion-bin strings; parametric design describes helical bundles with a few Crick parameters. Neither is literally rigid-bodies-on-a-string, but both treat SSE topology as the primary design object — so your representation maps cleanly onto theirs and can round-trip. Verify against the Rosetta blueprint docs before making this claim publicly.

**Shared data model.** The strongest of the three. Both tools operate on `{helix transforms, loop torsions}` — unfolding walks that state away from native, folding walks it back. Same program, two directions. Consequences:

* Every unfold trajectory is a puzzle set; difficulty is how far you unfolded. No hand-authoring.

* The trajectory is the answer key — enables partial scoring, hints, convergence measurement.

* Player solutions and animations are the same object; replay is free.

* One serialization format (\~60 floats) for undo, save, share, diff, and diff-against-native.

**The upshot:** build the unfolder first not as a warm-up, but because it produces your content pipeline as a side effect. The animation tool *is* the level editor.

---

---
