---
name: unilu-slidev
description: Create, migrate, edit, review, preview, test, export, synchronize, or explicitly publish University of Luxembourg and SnT academic Slidev presentations built from STP-Lib/UniLU_MD. Use for slides.md, UniLU Slidev layouts/components, Beamer-to-Slidev migration, KaTeX equations, SVG figure workflows, private presentation repositories, Codespaces, visual QA, and manual GitHub Pages publication.
---

# UniLU Slidev

Build academically rigorous browser presentations while preserving the established UniLU/SnT theme and separating private progress pushes from public publication.

## Locate The Project

Canonical template: `https://github.com/STP-Lib/UniLU_MD`.

Prefer an existing local presentation repository. If operating on the template itself, use `C:\Codes\[STStyles]\UniLU_MD` when available. Before pulling, check `git status --short --branch`; fast-forward only a clean, non-diverged worktree. Never overwrite dirty user work.

## Route The Task

- New presentation repository: read `references/github-workflow.md`, then run `scripts/new-presentation.ps1` from the canonical template.
- Substantial writing or restructuring: read `references/content-guidelines.md` and draft `content/deck-outline.yaml` first.
- Layout implementation: read `references/slide-patterns.md` and `references/theme-contract.md`.
- Equations or TeX figures: read `references/latex-compatibility.md`.
- Beamer migration: read `references/migration-from-beamer.md` plus the relevant source deck.
- Publication, Codespaces, repository sync, or theme upgrade: read `references/github-workflow.md`.
- Familiar build or rendering issue: search `references/FREQUENT_TASK_RECIPES.md` with `python scripts/skill_memory.py search "<problem>"` before debugging again.

## Create

Use the repository script; it enforces private visibility and the required name:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/new-presentation.ps1 `
  -Topic QML -Venue QCNC -Title "Quantum Machine Learning"
```

Names must match `YYMMDD_<TOPIC>_<VENUE>`, for example `260713_QML_QCNC`. Repositories belong to `STP-Lib` and are private by default. Do not enable Pages during creation.

Generated repositories are lean presentation projects. They carry a packed, revision-pinned theme and required runtime, QA, assets, setup, and publication files; they do not duplicate canonical theme source, the generator, or this skill.

## Author

1. Establish audience, duration, central claim, section order, and evidence map in `content/deck-outline.yaml`.
2. Obtain user approval for a substantial outline before generating the full deck.
3. Edit `slides.md`; keep metadata in headmatter and one concise action-title H1 on each content slide.
4. Use `<v-clicks>`, `v-click`, and `v-after` for explanatory sequence. Keep element dimensions stable across states.
5. Add speaker notes as a final HTML comment. Never place secrets in notes.
6. Register sources in headmatter and cite the first source-defining slide and reproduced figures with `\cite{key}`; use DOI or arXiv links when available.
7. Apply the `humanizer` skill conservatively before final prose delivery: preserve notation, citations, scope, and scientific stance.

Do not invent citations, claims, results, affiliations, dates, or venue details.

## Edit With Slidev MCP

When a Slidev 52.17.0 server is running, prefer its structured MCP operations for listing, reading, inserting, updating, moving, or removing slides:

```text
HTTP:  http://localhost:3030/__mcp
stdio: pnpm slidev mcp slides.md
```

Keep the HTTP endpoint on localhost or a private Codespaces port. Direct Markdown edits remain the fallback.

## Preview And Verify

```powershell
pnpm install
pnpm exec playwright install chromium
pnpm dev
pnpm dev -- --remote
pnpm check
pnpm export:clicks
```

`pnpm check` is the delivery gate: formatting, Markdown lint, deck rules, tests, production build, and Playwright visual QA. Inspect `.artifacts/visual/` after layout changes. Verify desktop framing, click order, equations, figure sharpness, footer clearance, notes, and the exported backup PDF.

## Mathematics And Figures

- KaTeX-compatible equations stay as `$...$` or `$$...$$`.
- Reusable quantum and calculus macros live in `setup/katex.ts`; keep `throwOnError: true`.
- TikZ, quantikz, and PGFPlots compile to SVG. Retain `.tex`, data, command, source citation, and generated asset together.
- Never paste raw TikZ into `slides.md` or silently rasterize unsupported equations.

## Synchronize

Theme updates are explicit and test-gated:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/sync-theme.ps1 -Ref v1.0.0
```

Synchronization repacks the selected canonical theme, merges shared setup and required assets, updates the dependency lock and recorded revision, and runs the full quality gate. It does not copy theme source into the presentation. Review the diff before committing. An older presentation remains pinned until deliberately upgraded.

## Publish

Ordinary commits and pushes must never publish. Private browser review uses a GitHub Codespace.

Run `Publish-Presentation.cmd` only when the user explicitly requests public publication. The script warns that the site is public, requires `PUBLISH`, validates `STP-Lib` and the repository name, requires a clean synchronized branch, runs `pnpm check`, offers to push ahead commits, and dispatches the manual Pages workflow. Public builds use `--without-notes`.

Never invoke the Pages workflow merely to test it. A private repository does not make a normal GitHub Pages site private.

## Learn Verified Fixes

After a non-obvious issue is solved and verified:

```powershell
python unilu-slidev/scripts/skill_memory.py learn `
  --title "Short fix name" --problem "Observed failure" --fix "Verified remedy" `
  --use-when "Trigger condition" --command "pnpm check"
```

Record reproducible fixes only; redact credentials and project-sensitive data.
