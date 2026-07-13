# Scratchpad handoff contract

## Artifact ownership

```text
content/deck-scratchpad.md          human-owned raw ideas and slide cards
content/deck-outline.proposed.yaml  generated proposal from approved cards
content/deck-outline.yaml           accepted plan maintained by the agent
slides.md                           UniLU Slidev implementation
```

Never treat the scratchpad and `slides.md` as competing sources of truth. Preserve raw thinking in the scratchpad, record accepted structure in the outline, and implement only the accepted structure in `slides.md`.

## Scratchpad sections

- `North star`: audience response, one-sentence argument, and questions the deck must answer.
- `Inbox`: unrestricted fragments, alternatives, references, and questions.
- `Parking lot`: useful ideas excluded from the current talk.
- `Slide cards`: structured candidates with stable IDs.

## Slide-card schema

Use this form:

```md
### [S010] Crosstalk creates correlated channel errors

- Status: candidate
- Kind: content
- Section: Model
- Subsection: Crosstalk mechanism
- Purpose: Explain why independent-channel assumptions fail
- Takeaway: Shared coupling creates correlated errors
- Layout: two-cols
- Placement: left-right
- Animation: sequence
- Exhibit: coupling-path diagram
- Evidence: to-check: qumimo-model
- Time: 60s

#### Left

Raw explanation, equation idea, or concise bullets.

#### Right

Diagram idea, comparison, figure reference, or visual analogy.

#### Animation beats

1. Establish the uncoupled channels.
2. Reveal the shared coupling path.
3. Show the correlated receiver errors.

#### Speaker notes

Narration ideas, caveats, open questions, and transitions.
```

## Allowed values

- Status: `raw`, `candidate`, `approved`, `parked`, `dropped`
- Kind: `content`, `backup`
- Layout: `auto`, `default`, `two-cols`, `figure`, `equation`, `blank`
- Placement: `full-width`, `left-right`, `figure`, `equation`, `overlay`
- Animation: `none`, `reveal`, `sequence`, `compare`, `accumulate`, `traverse`
- Evidence: `none`, `to-check: <source-key>`, or `verified: <source-key>`
- Time: a positive number of seconds such as `60s`

For `two-cols`, include both `#### Left` and `#### Right` and use `Placement: left-right`. For non-`none` animation, include `#### Animation beats` and describe semantic states rather than implementation syntax.

## Approval gate

An approved card needs section, subsection, purpose, takeaway, exhibit, layout, placement, animation, evidence, and time. Evidence must be verified or explicitly `none`. Approval means the idea is ready for outline review; it does not authorize invented prose, citations, or results.

After the proposed outline is accepted, merge it into `content/deck-outline.yaml`. Then map each stable card ID to its implemented slide so later updates remain targeted and manual refinements survive.

## Timing and content transfer

Set `duration_minutes`, `objective`, and `central_claim` before handoff. The generated plan assigns 10 seconds each to the cover, outline, and closing, then checks approved content cards against the remaining budget. Approved backup cards follow the closing slide and do not consume the live-talk budget.

The proposed outline embeds every non-empty card region under `content`, including left and right material, animation beats, and speaker notes. The downstream Slidev agent should still consult the scratchpad for rejected alternatives and unresolved context, but it does not need to reconstruct approved content from prose.
