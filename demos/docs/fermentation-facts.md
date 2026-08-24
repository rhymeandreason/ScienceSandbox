<!-- KIND: rulebook (facts). Load whole when building or reviewing fermentation-lab.html. -->

# Fermentation facts

Confidence marks: **[D]** derived here, arithmetic shown. **[S]** sourced, link in the
row. **[R]** recalled, not derived and not sourced — treat as needing a check before it
reaches a caption.

Charge convention: at pH 7 pyruvate and lactate are the anions (pyruvate⁻ C₃H₃O₃⁻,
lactate⁻ C₃H₅O₃⁻). Textbook diagrams draw the acids. Atom counts below use the anions,
so an H that a textbook hides in "pyruvic acid" shows up here as a free H⁺.

## Steps

| branch | step | enzyme (EC) | substrate → product | C in/out | H in/out | O in/out | carriers | CO₂ out | ΔG°′ | reversible? | source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| lactate | L1 | lactate dehydrogenase (EC 1.1.1.27) | pyruvate⁻ + NADH + H⁺ → lactate⁻ + NAD⁺ | 3 → 3 | 3 + 1(H⁺) + 1(hydride from NADH) = 5 → 5 | 3 → 3 | NADH → NAD⁺ (1) | none | ≈ −26 kJ/mol **[D]** | **yes**, near equilibrium in vivo; direction set by the NADH/pyruvate ratio. LDH is the assay basis for cytosolic NAD⁺/NADH **[S]** | [PMC3343042](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3343042/) |
| ethanol | E1 | pyruvate decarboxylase (EC 4.1.1.1), TPP + Mg²⁺ | pyruvate⁻ + H⁺ → acetaldehyde + CO₂ | 3 → 2 + 1 | 3 + 1(H⁺) = 4 → 4 + 0 | 3 → 1 + 2 | none | **1** | ≈ −20 kJ/mol **[R]** | **no** (physiologically irreversible; a decarboxylation that vents its product as gas) | [LibreTexts 13.2](https://bio.libretexts.org/Bookshelves/Biochemistry/Fundamentals_of_Biochemistry_(Jakubowski_and_Flatt)/02:_Unit_II-_Bioenergetics_and_Metabolism/13:_Glycolysis_Gluconeogenesis_and_the_Pentose_Phosphate_Pathway/13.02:_Fates_of_Pyruvate_under_Anaerobic_Conditions-_Fermentation) |
| ethanol | E2 | alcohol dehydrogenase (EC 1.1.1.1), Zn²⁺ | acetaldehyde + NADH + H⁺ → ethanol | 2 → 2 | 4 + 1 + 1 = 6 → 6 | 1 → 1 | NADH → NAD⁺ (1) | none | ≈ −24 kJ/mol **[D]** | **yes** (liver ADH runs the ethanol → acetaldehyde direction) | same |

Carbon check, per pyruvate: lactate branch 3 → 3 ✓. Ethanol branch 3 → 1 (CO₂) + 2
(ethanol) ✓. Per glucose (2 pyruvate): lactate 6 → 6 ✓; ethanol 6 → 2 CO₂ + 4 C in two
ethanols ✓.

### ΔG°′ derivations **[D]**

From standard reduction potentials, ΔG°′ = −nFΔE°′, n = 2, F = 96.485 kJ·V⁻¹·mol⁻¹.

* NAD⁺/NADH E°′ = −0.320 V **[R]**
* pyruvate/lactate E°′ = −0.185 V **[R]** → ΔE°′ = +0.135 V → ΔG°′ = −26.1 kJ/mol
* acetaldehyde/ethanol E°′ = −0.197 V **[R]** → ΔE°′ = +0.123 V → ΔG°′ = −23.7 kJ/mol

The potentials are recalled, so the two ΔG values are only as good as those. They agree
with the −25 kJ/mol figure quoted for LDH at pH 7 **[S]** and disagree with a −15.7
kJ/mol figure returned by the same search; the discrepancy is unresolved, and **no ΔG
number should appear in page copy** — the sign and the word "downhill" is all the lesson
needs. **Flagged.**

Neither branch conserves any energy. No ATP, no GTP, no reduced carrier leaves either
branch. Everything glycolysis earned, glycolysis already earned.

## NAD⁺ balance

Per glucose. The only NAD⁺-consuming step in glycolysis is GAPDH (step 6), which runs
twice because the six-carbon sugar has split.

| | NAD⁺ consumed | NAD⁺ regenerated | net |
| --- | --- | --- | --- |
| glycolysis alone | 2 (GAPDH ×2) | 0 | **−2** |
| glycolysis + lactate fermentation | 2 | 2 (LDH ×2) | **0** |
| glycolysis + ethanol fermentation | 2 | 2 (ADH ×2; PDC regenerates nothing) | **0** |

A net of 0 is the whole pathway. Glycolysis does not run out of glucose, ADP or
phosphate first; it runs out of NAD⁺. Fermentation buys back exactly the two it spent,
which is why both branches carry exactly two redox steps per glucose and why the ethanol
branch needs a second step to do what lactate does in one.

### How long the pool lasts without it **[D]**

* Total cellular NAD⁺ in mammalian cells: **0.4–0.7 mM**, and 0.1–4 mM across
  estimates **[S]** — [Extraction and quantitation of NAD redox cofactors, PMC5737638](https://pmc.ncbi.nlm.nih.gov/articles/PMC5737638/)
* Cytosolic free NAD⁺/NADH ≈ **200–700** (Williamson's lactate/pyruvate method) **[S]** —
  [PMC3343042](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3343042/). So the cytosolic
  pool sits almost entirely as NAD⁺, and almost none of it is spare NADH.
* Peak glycolytic flux, human muscle, first 6 s of maximal exercise: pyruvate produced at
  **4.31 mmol·kg dry wt⁻¹·s⁻¹** **[S]** —
  [Parolin et al., Am J Physiol 1999](https://journals.physiology.org/doi/full/10.1152/ajpendo.1999.277.5.e890)

Conversion, and the step to flag: muscle dry weight is roughly 1/4.3 of wet weight
**[R]**, and cell water roughly 0.7 L per kg wet weight **[R]**.

    4.31 mmol·kg dw⁻¹·s⁻¹ ÷ 4.3  ≈ 1.0 mmol·kg wet⁻¹·s⁻¹
    1.0 ÷ 0.7 L water·kg wet⁻¹    ≈ 1.4 mmol·L⁻¹·s⁻¹ of pyruvate
    GAPDH makes 1 NADH per pyruvate → NAD⁺ drawn down at ≈ 1.4 mM/s
    pool ≈ 0.5 mM ÷ 1.4 mM/s      ≈ 0.35 s

**Under a second.** Round it to "a fraction of a second" in copy, not to a decimal —
the two conversion factors are recalled, so the honest precision is the order of
magnitude, not the digit. **Flagged: the 0.35 s is derived from two [R] conversions.**
The claim that survives regardless: the pool is smaller than one second of flux, so
NAD⁺ has to be recycled continuously rather than stockpiled.

## Lactate and muscle soreness

**False:** lactate (or "lactic acid buildup") causes the soreness felt 24–48 h after hard
exercise. Blood lactate returns to baseline within roughly 30–60 minutes of stopping,
long before soreness peaks. Downhill running produces marked DOMS with no lactate rise;
level running raises lactate and produces none **[S]** —
[Is Lactic Acid Related to DOMS?, PubMed 27409551](https://pubmed.ncbi.nlm.nih.gov/27409551/),
[Should We Void Lactate in the Pathophysiology of DOMS?, PMC9505902](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9505902/).

**True:** DOMS follows microscopic damage to muscle fibres and the inflammatory response
to it, worst after eccentric work **[S]** (same sources).

**Also true and worth the page's time:** lactate is not waste. It leaves the muscle, and
the liver rebuilds glucose from it (Cori cycle), or other tissues oxidise it after
converting it back to pyruvate. Lactate is a loan, not a landfill.

**Recommendation for the page:** address it in one line, once, at the point where lactate
appears, and phrase it as the correction rather than the myth ("the lactate leaves and
gets reused; the soreness two days later is torn fibres"). Do not set up the myth in
order to knock it down — repeating it is how it sticks. This also guards the page's real
claim: a student who thinks the interesting thing about the branch is the lactate has
already missed the point, whether they think it hurts or not.
