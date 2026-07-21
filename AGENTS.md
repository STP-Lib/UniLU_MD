# UniLU Slidev Agent Instructions

- Use `unilu-slidev/SKILL.md` for all creation, migration, editing, review, export, and publication work in this repository.
- Use `slide-deck-scratchpad/SKILL.md` for raw ideation, slide cards, layout or animation intent, and outline handoff. Keep `deck-scratchpad.md` -> `deck-outline.yaml` -> `slides.md` as the ownership boundary.
- Iterate on the live preview (`pnpm draft` or `pnpm dev`), not by rebuilding. Prefer deterministic scripts for feedback: make targeted edits and read `pnpm check:deck` or the `draft` watcher line instead of re-rendering or re-reading the whole deck. Reserve `visual` and `full` for checkpoints.
- Keep presentation repositories private. Ordinary commits and pushes must never deploy GitHub Pages.
- Public deployment is allowed only after the user explicitly asks, through `Publish-Presentation.cmd` or the guarded manual workflow.
- Run `pnpm check` before delivery or publication.
- Preserve sources for TikZ, quantikz, and PGFPlots figures beside exported SVG or PNG artifacts.
- Do not invent citations, numerical results, affiliations, or publication claims.
