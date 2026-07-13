---
name: slide-deck-scratchpad
description: Brainstorm, capture, organize, refine, and approve academic presentation ideas in a lightweight Markdown scratchpad before Slidev implementation. Use for raw slide thoughts, narrative exploration, slide-card planning, left/right placement, animation intent, evidence tracking, talk timing, deck-outline handoff, or requests to turn a presentation scratchpad into slides.md through the UniLU Slidev workflow.
---

# Slide Deck Scratchpad

Keep ideation fast and separate from rendering. Treat `content/deck-scratchpad.md` as the human-owned source for raw thinking, `content/deck-outline.yaml` as the approved plan, and `slides.md` as an implementation owned by the `unilu-slidev` skill.

## Route the task

- Start a scratchpad: run `node scripts/scratchpad.mjs init --title "<title>" --audience "<audience>"`.
- Capture or brainstorm: write freely in `## Inbox`; do not run a Slidev build.
- Shape slide ideas: read `references/handoff-contract.md`, then create or revise stable-ID cards.
- Validate cards: run `node scripts/scratchpad.mjs check`.
- Propose an outline: mark selected cards `Status: approved`, verify their evidence, then run `node scripts/scratchpad.mjs handoff`.
- Generate or update `slides.md`: invoke the canonical `unilu-slidev` skill with the scratchpad and `content/deck-outline.proposed.yaml`. Preserve manually refined slides and show the planned mapping before substantial replacement.

## Brainstorm

Keep the inbox unconstrained. Preserve fragments, alternatives, questions, figure ideas, equations, transitions, and rejected directions until the user decides what matters.

Turn only promising ideas into slide cards. Give each card a stable ID such as `S010`; never renumber IDs merely because slide order changes. Express placement semantically (`full-width`, `left-right`, `figure`, `equation`, or `overlay`) and describe animation as explanatory beats. Do not write raw `<v-click>` syntax during ideation.

Do not invent citations, results, affiliations, or claims. Record evidence as `to-check: <key>` until verified. An approved card must use `verified: <key>` or explicitly state `none`.

## Approve and hand off

Use `raw`, `candidate`, `approved`, `parked`, and `dropped` as card states. Promote only approved cards. The handoff command writes `content/deck-outline.proposed.yaml`; it never overwrites the accepted outline or `slides.md` unless the user explicitly directs that merge.

Before handoff, set the audience, duration, objective, and central claim in the scratchpad frontmatter. Confirm the selected cards, section order, unresolved evidence, and intended audience response. The proposed outline carries card regions, animation beats, speaker notes, and a 30-second allowance for the cover, outline, and closing. Apply the `humanizer` skill conservatively to final action titles and visible prose.

## Validate efficiently

Use the narrowest gate that matches the current artifact:

```powershell
node scripts/scratchpad.mjs check          # scratchpad only; no build
node scripts/scratchpad.mjs handoff        # approved cards to proposed outline
.\Presentation-Workflow.cmd content        # after prose-only slides.md edits
.\Presentation-Workflow.cmd visual         # layout, animation, equation, figure, or asset edits
.\Presentation-Workflow.cmd full           # final delivery gate
```

The scratchpad commands write timing records under `.artifacts/timings/`. Report validation errors, approved-card count, active and approved duration, and elapsed time.
