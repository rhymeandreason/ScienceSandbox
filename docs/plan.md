# ScienceSandbox — "Lovable for Science Apps"

## Context

A web platform where AP Bio/Chem students take starter interactive apps (cellular respiration, DNA/RNA, ionic/covalent bonding), remix them by chatting with a coding agent, and share the result with a link. The sandbox creates a safe creative space for students to build understanding by building apps. Mary authors the starter apps directly with Claude Code; students remix only (no from-scratch in MVP).

## Approach: build the starter apps FIRST, then architect the MVP

We are deliberately building the 3 starter apps as plain standalone files **before** designing the platform. This is design research, not just content: the starter apps determine the real answers to architecture questions instead of us guessing at them. From building them we learn:
- The actual file shape of an app (single `index.html` vs html/js/css split vs modules) → drives editor + agent file tools.
- What repeats across all three → the reusable "science kit" (design tokens, animation helpers, art assets, drag/drop, particles) gets **extracted from real apps**, not designed up front.
- Recurring interaction patterns (drag-to-combine, step-through-stages, before/after toggle, sliders) → the vocabulary the agent reuses when remixing.
- Typical app size/complexity → validates that IndexedDB snapshots + in-memory files are sufficient.

**Order:** Build app #1 (cellular respiration) fully, then PAUSE and review together before #2 and #3 — the first app teaches the most and prevents triplicating a pattern we'd regret.

## Phase 1 — Starter apps (current focus, no platform, no AI)

Plain static files, no framework, no build step. Runnable by opening `index.html`.

```
apps/starters/
  cellular-respiration/   # build first, then pause for review
  dna-rna/
  bonding/
```

- **Stack:** vanilla HTML/JS/Canvas (or SVG). Easiest for the agent to edit reliably later and for students to read.
- **Cellular respiration framing:** crafting game — drag inputs (glucose, O₂) through stages (glycolysis → Krebs → electron transport chain) to craft outputs (ATP, CO₂, H₂O). Game-like but an interactive, not a full game.
- Target viewport ~1366×768 (Chromebook).
- After #1: extract a first-pass `kit/` (tokens + helpers + assets) from what the app actually needed.

## Phase 2 — MVP platform (architecture TBD after starter-app review)

Deferred until the starters exist. Decisions already made with Mary that still hold:
- Web-based (not desktop); students often on Chromebooks; sharing is a link anyway.
- Students remix starters via an agent; no from-scratch in MVP (Mary-only later).
- Lean runtime: sandboxed iframe (`srcdoc`) + CodeMirror. No WebContainers, no npm, no dev server.
- Sharing = hosted static snapshot at a unique URL; view-only + "Remix" button.
- Versioning = lightweight visible history ("snapshots" timeline, restore); real git under the hood deferred.

### Open decisions (do NOT block Phase 1 — the starters contain no AI)
- **AI provider:** matters less than expected. All frontier models handle small vanilla-JS edits well. Real axes: **cost** (Gemini Flash / small OpenAI models cheapest; cost scales per student) and billing (all are pay-per-token API — a personal ChatGPT/Claude *subscription* can't legitimately be fanned out to a classroom via API; Codex/Claude Code subscription auth is single-user, not multi-tenant). **Decision: pick on cost/comfort, keep it swappable behind a thin proxy interface; A/B later.**
- **Agent harness:** do NOT need a general harness like Claude Code. Apps are tiny with a narrow edit surface, so a **minimal custom edit loop** (system prompt + `read_file`/`write_file`/`str_replace` tools over the in-memory project + streaming to the browser) is likely ~a day of work and gives full control over constraints (vanilla-JS only, use-the-kit, tone-for-minors). SDK agent loops assume a real filesystem/shell we don't need. Revisit after seeing app complexity.
- **Community / sharing model:** how much do students see each other's work? Three options, from safest to riskiest:
  - **A. Class-scoped gallery (leaning recommendation).** Teacher creates a class (join code); shared projects are visible and remixable only within that class. Delivers the community + real-audience feel inside a consent-able, trusted boundary; no public exposure, minimal moderation. Needs a lightweight class/teacher concept (currently deferred).
  - **B. Curated showcase.** Students submit; Mary or a teacher approves what appears publicly. A public gallery of good work with full control over what's shown; cost is manual review.
  - **C. Full public community + usernames.** Max reach/network effects, but turns us into a content-moderation host for minors (reporting/takedown, propagation via remix), makes usernames our first PII, flips the model to public-by-default, and many districts forbid open social features. Not for MVP.
  - **If usernames at all:** make them non-identifying by design (generated handles like `curious-mitochondria-7`, or first-name-only — no free-text that invites real names/socials) and scope them to the class, not globally searchable. Shared snapshots are public content — surface "don't put personal info in your app" in the share UI regardless of option.

## Verification (Phase 1)
- Open each starter's `index.html` directly in a browser; play through the full interaction at Chromebook viewport size.
- Confirm apps are self-contained (no server, no network) and readable.

## Privacy & data minimization (13+ students)

Users are high-school students (13+), so COPPA (under-13) does not apply — no verifiable parental-consent machinery needed. But FERPA and state student-privacy laws (e.g. CA SOPIPA and ~40 similar) have no age floor: they trigger on the *school context*, so once a teacher adopts this, student work + prompts may count as education records with data-minimization / no-sale / no-targeted-ad duties. The safest and lowest-effort posture is to collect almost nothing.

**Target: no accounts, no names, no emails.** An anonymous capability-URL model (possession of the link = access) covers the whole MVP:
- **Project identity:** random opaque ID in the URL (`/p/x7f3k`); the share link *is* the ID. No login, no user profiles.
- **Persistence:** IndexedDB locally; anonymous server snapshot keyed by the random ID.
- **Agent proxy is the privacy chokepoint:** forward prompt + files to the LLM with *no* identity attached. Don't log prompt/response bodies (or purge after a short TTL). Rate-limit via ephemeral/hashed-IP tokens, not persistent per-student tracking.
- **LLM provider tier:** treat **no-training-on-data + short-retention** as a hard filter (not just cost), noted alongside the cost axis in the AI-provider open decision above. Standard commercial API ToS (13+/18+) already fit high-school users.
- **Sharing caveat:** shared snapshots are effectively public — unlisted ≠ private. Students may embed personal info in an app; surface this in the share UI.

## MVP success metrics — instrument these in the build

The pilot's core question: **does chat-remixing a science app build understanding, and will teachers reassign it?** Some answers are qualitative (observation, teacher interview, explanation rubrics) and are gathered by hand — see the non-loggable items below. The rest are **measurable events to log from day one**, kept consistent with the privacy plan: emit **anonymized, class-scoped interaction events** keyed by the random project/session ID — **never prompt/response bodies, never student identity**.

**Loggable events (fold into the build now):**
- `project_opened` — starter id, timestamp → adoption, sessions started.
- `prompt_sent` — session id, starter id (NO body) → attempts per session, engagement depth.
- `agent_result` — `ok` | `error`, latency ms, token count → **edit success rate**, **latency**, **cost per session**.
- `app_broke` — app failed to render after an agent edit → the worst failure mode; track rate.
- `reset_to_starter` — student escaped a broken/stuck state → frustration signal.
- `remix_succeeded` — student kept an edit and continued → **task completion** (≥1 working remix).
- `time_to_first_success` — ms from first prompt to first `remix_succeeded` → onboarding friction.
- `share_created` / `share_opened` / `remix_of_share` — sharing + organic spread (weak MVP signal, strong if it happens).
- `session_end` — duration, prompt count → session shape (read as engagement, not success).

**Derived metrics + target signals:** edit success rate ≥~85%; task completion ≥80% of students; time-to-first-success in single-digit minutes; agent latency under ~10–15s on a Chromebook; app-broke and reset rates rare; cost per active student-session tracked (drives the AI-provider decision above).

**NOT loggable — gather by hand during the pilot:** explanation quality (0–2 rubric: wrong / mechanical / conceptual — the North Star), pre/post concept check, scientific correctness of agent edits (spot-check), guardrail violations, and the primary adoption metrics: *teacher would-assign-again* and *ran without you* (Stage 3).

**Go / no-go, decided before testing:** strong-go = students reach conceptual explanations + teacher would reassign + edit success high; fixable = learning works but agent/usability rough; rethink = fun but can't explain the science, or teacher won't reassign (fun ≠ learning).

## Deferred (out of MVP)
Accounts, teacher features, from-scratch mode for others, real git remotes, React/Bento shell redesign, class billing model, content moderation beyond system-prompt guardrails + rate limits.
