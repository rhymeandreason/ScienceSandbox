This unit is mostly a reuse test. If chemiosmosis, redox, ETC, and membrane compartments genuinely generalize, photosynthesis costs you about a dozen new nodes. If they don't, you'll find out cheaply — which was the argument for putting it here.

## 1. Anchoring questions

* Where does the mass of a tree come from?

* Why are plants green?

* Why do leaves change colour in autumn?

* If plants make sugar, why do they also need mitochondria?

* Why do plants close their stomata in heat, and what does it cost them?

* Where does the oxygen you're breathing come from?

The first is the best question in the unit. Almost everyone says soil. It's air — carbon dioxide, fixed into sugar. That single misconception justifies the whole unit's framing.

## 2. Reuse audit first

Before adding nodes, check what already exists:

| Needed | Status |
| --- | --- |
| Chemiosmosis | Built (respiration) — `instance-of` from light reactions |
| ETC | Built — new carriers, same mechanism |
| Redox | Built (chemistry) — direction reversed |
| Proton gradient across membrane | Built (cell/membrane) |
| ATP synthase | Built — same enzyme, different membrane |
| NADPH | New, but `analogous-to` NADH |
| Thylakoid membrane | New instance of a known type |
| Enzyme catalysis (Rubisco) | Built (proteins) |
| Chloroplast | Built (cell/membrane) |

Nine dependencies, seven already present. That ratio is the unit's whole justification for going second.

## 3. The spine

Same modelling decision as respiration — the stages aren't the spine, the carriers are:

```
Light ──> Photosystems ──> excited electrons
                              ↓
        Water split ──> replaces lost electrons, releases O₂
                              ↓
                      ETC ──> proton gradient ──> ATP
                              ↓
                           NADPH
                              ↓
              Calvin Cycle: CO₂ + ATP + NADPH ──> G3P ──> glucose

```

Light reactions produce the currency; the Calvin cycle spends it. That's the whole unit, and it's the same "load carriers, then cash them in" shape as respiration — which is exactly the transfer you want the reader to notice.

## 4. New nodes (\~16)

**Light** — Light Energy · Wavelength/Spectrum · Pigment · Chlorophyll · Accessory Pigments · Photosystem I & II · Photolysis **Structure** — Chloroplast (exists) · Thylakoid · Grana · Stroma **Carbon** — Calvin Cycle · Carbon Fixation · Rubisco · G3P **Adaptations** — Stomata · Photorespiration · C4/CAM *(rank 2)*

## 5. Key edges

| From | Type | To | Rank |
| --- | --- | --- | --- |
| Photosynthesis | contrasts-with | Cellular Respiration | 1 |
| Light Reactions | instance-of | Chemiosmosis | 1 |
| Photolysis | produces | O₂, electrons, H⁺ | 1 |
| NADPH | analogous-to | NADH | 1 |
| Calvin Cycle | consumes | ATP, NADPH, CO₂ | 1 |
| Rubisco | instance-of | Enzyme | 1 |
| Thylakoid | instance-of | Membrane Compartment | 1 |
| Chlorophyll | absorbs | red + blue, reflects green | 1 |
| Photosynthesis | instance-of | Energy Flow (Theme) | 1 |
| Stomata | trade-off | CO₂ intake vs water loss | 2 |

## 6. The reciprocal pair

This is the structural move that a graph enables and a syllabus can't. Model respiration and photosynthesis as one system viewed twice, not as chapters 8 and 9:

|  | Photosynthesis | Respiration |
| --- | --- | --- |
| Direction | Reduces CO₂ | Oxidizes glucose |
| Energy | Light in | Released as ATP |
| Carrier | NADPH | NADH |
| Membrane | Thylakoid | Inner mitochondrial |
| Electron source | Water | Glucose |
| Electron sink | CO₂ | Oxygen |
| Gradient | H⁺ into thylakoid lumen | H⁺ into intermembrane space |

Every row is a `contrasts-with` edge at rank 1. A reader who traverses this table has effectively learned both units as one idea, and the second one comes nearly free.

## 7. Misconception edges

| Wrong model | Edge |
| --- | --- |
| Tree mass comes from soil | `Carbon Fixation` — it's atmospheric CO₂ |
| Plants respire only at night | `Photosynthesis` →`co-occurs-with`→ `Respiration` — both run constantly; plants have mitochondria |
| Plants "breathe in CO₂ and out O₂" as an exchange | `Photolysis` — the O₂ comes from split *water*, not from the CO₂ |
| Chlorophyll uses green light | `Pigment` — green is what's *reflected*; it's the wasted wavelength |
| Autumn leaves turn colour | `Accessory Pigments` — carotenoids were always there; chlorophyll degraded and stopped masking them |
| The Calvin cycle is "the dark reactions" | `Calvin Cycle` — runs in daylight, just doesn't need photons directly |

The oxygen-source one is worth an isotope-tracer content piece, since it's a case where the misconception is entirely reasonable and only an experiment settles it.

## 8. Content set (\~18)

**Core:**

* **Absorption spectrum overlay** — chlorophyll absorption plotted against photosynthetic rate. Two curves matching is the argument, and it answers "why green" visually.

* **Van Helmont's willow** — the classic mass-balance experiment, as `evidence-for` carbon fixation. Cheap, historical, and it directly kills the soil misconception.

* **Isotope tracer** — labelled H₂¹⁸O vs C¹⁸O₂, showing which one the O₂ comes from. Reuses your Isotope chemistry node.

* **Side-by-side chemiosmosis** — mitochondrion and chloroplast animations running in parallel, same mechanism, relabelled. This is the reuse payoff made visible.

* **Chloroplast structure** (viewer/diagram) — thylakoid stacks, stroma, showing the compartment that makes the gradient possible.

* **Rubisco** (protein viewer, SES) — the most abundant protein on Earth, and notably inefficient. Connects enzyme structure to global carbon flux.

* **Leaf cross-section micrograph** — stomata, mesophyll, air spaces. Exercises tissue level on the scale ladder.

* **Stomatal trade-off simulator** — open for CO₂, lose water; adjust temperature and watch the plant choose.

**Assessment:** trace a carbon atom from air to glucose; trace an oxygen atom from water to atmosphere; predict output under altered light wavelengths; explain why a plant in the dark still consumes O₂.

## 9. Outbound bridges

* `Photosynthesis` → **Energy Flow / Trophic Levels** (ecology)

* `Chloroplast` → **Endosymbiosis** (already built — closes cleanly)

* `Glucose` → **Cellular Respiration** (the loop closes)

* `C4/CAM` → **Adaptation / Natural Selection** (evolution)

* `Carbon Fixation` → **Carbon Cycle** (ecology)

## 10. Ranking caution

The predictable error here is heavier than usual. A model will rank the Calvin cycle intermediates high — RuBP, 3-PGA, G3P, the regeneration steps — for exactly the reason it over-ranked the Krebs intermediates. Same failure, same cause: named molecules and diagram real estate.

Nothing downstream in Bio 101 routes through 3-PGA. Meanwhile `Photolysis` gets two sentences in most textbooks and is load-bearing for the entire oxygen story, the electron replacement problem, and one of the unit's biggest misconceptions.

If your generated ranks put Calvin intermediates above photolysis, the rubric prompt is still measuring prominence rather than explanatory load — and this unit is a good regression test for that, since you already know what the right answer looks like from respiration.
