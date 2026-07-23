# Extended Notes — Salt, Freezing & the Eutectic

Deeper scientific notes for the salt/freezing behavior in `water-lab.html`
(step 5). These are edge cases and simplifications we consciously make — things
that are *more* subtle than the core rules in [`SCIENCE.md`](SCIENCE.md), kept
here so future changes don't accidentally "fix" a deliberate abstraction or
introduce a real inaccuracy.

---

## The eutectic point (−21 °C)

When salt water freezes, the growing ice lattice **rejects the ions** (brine
rejection — the sim models this by springing the ions out to just beyond the ice
surface). The excluded ions do **not** immediately recombine into solid salt.
Instead they stay **dissolved and individually hydrated in the leftover
concentrated brine** between ice crystals.

They only crystallize back together at the **eutectic point, −21.1 °C**, where
the remaining brine finally solidifies all at once into a mixture of ice + solid
**NaCl·2H₂O (hydrohalite)**. Above the eutectic there is always some liquid
brine; below it, everything is solid.

**Implications for the sim:**

- During ordinary freezing (warmer than −21 °C), Na⁺ and Cl⁻ should crowd into
  the brine region but remain **separate hydrated ions**, not a rejoined
  contact pair. A visible Na–Cl bond re-forming would only be correct at the
  eutectic.
- The freezing-point depression is **capped at 21 °C** in `saltShift()`
  (`dTf = min(1.86·molal, 21)`), which encodes the eutectic as the coldest a
  brine can stay liquid.

## Adding salt to already-frozen water (de-icing)

Dropping more salt onto ice should **melt it** — this is exactly how road salt
works. The salt dissolves into the thin surface brine film, and freezing-point
depression keeps that brine liquid below 0 °C, so it dissolves more ice.

- This works only **above the eutectic**. Below −21 °C salt can no longer melt
  ice (why road salt fails in extreme cold) — the crystal just sits inert.
- The sim captures this thermodynamically: more dissolved salt raises `dTf`,
  which lowers the freeze fraction `fz = clamp((8 − dTf − T)/8, 0, 1)`, so the
  ice melts. The melt is modeled **globally** (whole-cluster freeze fraction),
  not as a localized brine pocket spreading out from the crystal — a deliberate
  simplification.

## Screening & re-pairing (why hydrated ions stay apart)

Once an ion carries a hydration shell, water's dielectric (ε ≈ 78) plus the
shell's steric bulk cut the ion–ion attraction to a few percent. Fully hydrated
ions in dilute solution essentially **do not** re-form contact ion pairs — there
is only a small transient-pairing equilibrium. In the sim this is enforced
per-ion (`shellCount ≥ 3` → attraction screened + shells can't interpenetrate),
so solvated ions don't snap back to contact.

## Dissociation is mechanistic, not a count threshold

The Na⁺–Cl⁻ ionic bond breaks when a water molecule **wedges onto the bond
axis** between the ions (the real contact → solvent-separated ion-pair
transition), not when some coordination number is reached. The first bridging
water screens the pair and pries it apart.
