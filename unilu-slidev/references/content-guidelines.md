# Academic Content Guidelines

## Outline Gate

For a substantial deck, specify each planned slide as: number, purpose, action title, exhibit, evidence, and takeaway. Confirm audience, venue, duration, and desired technical depth. Do not generate the full deck until the outline is accepted.

## Narrative

- Build one argument, not a paper transcript.
- Use a claim or takeaway as the title of each content slide.
- Let the title sequence tell the talk when read alone.
- Give one principal exhibit to each result slide.
- Move derivations, robustness checks, and secondary tables to backup slides or notes.

## Density

- Prefer three to five short visible points.
- Split a slide before reducing body type or entering the footer safe band.
- Use `<CompactBlock>` for one concise constraint, definition, or implication.
- Keep tables sparse enough to compare values without zooming.
- Highlight no more than one or two terms or values on a slide.

## Figures

- Remove plot titles, panel headings, and subtitles that repeat the slide title or caption; use that space to enlarge the evidence.
- Keep scientific panel labels such as `(a)` and `(b)` when the narration or caption refers to them.
- Put experimental conditions, dataset details, and method labels in the slide caption, legend, or notes as appropriate.
- Preserve readable axes, units, uncertainty, and a useful alternative-text description.
- Retain source code, data provenance, and citations for every reproduced or generated figure.

## Citations

- Cite the first slide that depends on a source and every reproduced figure.
- Register each source once in headmatter and cite it with `\cite{key}`; never type superscript numbers manually.
- Show author/year, title, and DOI or arXiv link where available.
- Do not repeat the same footer on every explanatory slide.
- Never invent or infer a DOI; verify it from the paper or trusted metadata.

## Notes And Animation

- Put speaker notes in the final HTML comment on the slide.
- Use `[click]` markers only when notes must track reveals.
- Prefer `<v-clicks>`, `v-click`, and `v-after`; use motion only to explain sequence, traversal, accumulation, or convergence.
- Keep the deck intelligible with animation disabled and verify backward navigation.

## Final Review

Check scientific claims, notation, units, citations, title sequence, timing, contrast, footer clearance, and exported PDF. Apply the `humanizer` skill conservatively to final prose without changing technical meaning.
