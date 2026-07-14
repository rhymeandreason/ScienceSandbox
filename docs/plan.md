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

## Verification (Phase 1)
- Open each starter's `index.html` directly in a browser; play through the full interaction at Chromebook viewport size.
- Confirm apps are self-contained (no server, no network) and readable.

## Deferred (out of MVP)
Accounts, teacher features, from-scratch mode for others, real git remotes, React/Bento shell redesign, class billing model, content moderation beyond system-prompt guardrails + rate limits.
