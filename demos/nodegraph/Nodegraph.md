**Summary of how the baked placement is determined**

The whole placement is computed once at load from the data, in this order — no randomness, so the same map every session:

**X — explanatory order** (`layerOf`):

1. Every directed edge type declares an ordering or stays silent. FORWARD types (`prerequisite-of`, `causes`, `determines`, `produces`, `part-of`, `contains`, `lowers`, …) put the source left of the target; containment is two of those and they point opposite ways — `part-of` builds, so the part reads first, while `contains` zooms in, so the whole does; BACKWARD types (`consumes`, `destroys`, `explained-by`, `instance-of`) invert that — an instance comes after its class. `contrasts-with`, `describes`, `answers` impose nothing, and `instance-of` into a theme is exempt.

2. **Longest-path layering** over those constraints: a node's layer is one more than the deepest constraint feeding it; unconstrained sources sit at 0. A cycle would be a data bug and warns.

3. **Pull-right pass**: a node with no upstream constraint (a disulfide bridge, a gene sequence) is pulled to one column before its first *independently anchored* consequence — ignoring followers whose only constraint is the node itself, which was circular — then layers re-propagate so the followers move too.

4. Nodes with **no ordering edges at all** (induced-fit, the theme) take the mean of their neighbours' layers.

5. Authored **`nudge`** shifts apply last (hydrolysis +2, a display hint until respiration gives it real rightward edges).

6. Layer × 430px = x target.

**Y — the scale ladder**: levels 1–10 become horizontal bands, ecosystem at top; bands nothing occupies stay thin. A leveled node (or `occursAt`/`emergesAt`) targets its band's centre; levelless concepts settle at the mean of their neighbours' y, iterated six passes. Specimens carry level 2, so they sit on the macromolecule shelf.

**Questions**: anchored to their rank-1 answer (earliest layer among ties) — 0.7 columns left of it, same y.

**Then the relax**, which only resolves overlap: x pinned hard to the column (0.12), y pulled to the target (questions 0.07, leveled 0.05, concepts 0.015), pairwise repulsion with a hard shove on actual overlap, a weak y-alignment along edges, and a deterministic per-index jitter to break stacked ties the same way every load. Dragging pins a card out of it permanently.

So: edge types make the x-axis, the ladder makes the y-axis, physics only does spacing.
