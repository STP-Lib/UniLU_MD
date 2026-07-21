---
name: unilu-slidev
description: Create, migrate, edit, review, preview, test, export, synchronize, or explicitly publish University of Luxembourg and SnT academic Slidev presentations built from STP-Lib/UniLU_MD. Use for slides.md, UniLU Slidev layouts/components, interactive Plotly/Vue figures, Beamer-to-Slidev migration, KaTeX equations, SVG figure workflows, private presentation repositories, Codespaces, visual QA, and manual GitHub Pages publication.
---

# UniLU Slidev

Build academically rigorous browser presentations while preserving the established UniLU/SnT theme and separating private progress pushes from public publication.

## Locate the project

Canonical template: `https://github.com/STP-Lib/UniLU_MD`.

Prefer an existing local presentation repository. If operating on the template itself, use `C:\Codes\[STStyles]\UniLU_MD` when available. Before pulling, check `git status --short --branch`; fast-forward only a clean, non-diverged worktree. Never overwrite dirty user work.

## Route the task

- Raw ideas, narrative exploration, slide cards, or a scratchpad handoff: use the companion `slide-deck-scratchpad` skill first; return here only after the outline is proposed or approved.
- New local-only presentation: run `scripts/new-local-presentation.ps1` from the canonical template. Use this when the user gives a local directory or does not ask for a GitHub repository.
- New private GitHub presentation repository: read `references/github-workflow.md`, then run `scripts/new-presentation.ps1` from the canonical template.
- Substantial writing or restructuring: read `references/content-guidelines.md` and draft `content/deck-outline.yaml` first.
- Layout implementation: locate the relevant heading in `references/slide-patterns.md` with `rg -n "^## |<layout-or-pattern>"`, then read that section and `references/theme-contract.md`.
- Interactive data figure: read `references/interactive-plots.md`. Prefer precomputed data with Plotly.js/Vue unless an interaction must run new Python computation or access live or private data.
- Equations or TeX figures: read `references/latex-compatibility.md`.
- Beamer migration: read `references/migration-from-beamer.md` plus the relevant source deck.
- Publication, Codespaces, repository sync, or theme upgrade: read `references/github-workflow.md`.
- Familiar build or rendering issue: search `references/FREQUENT_TASK_RECIPES.md` with `python scripts/skill_memory.py search "<problem>"` before debugging again.

## Create

Use the local script for deterministic local scaffolding. It copies only required source files, packs the theme, writes a minimal starter deck, and never copies `node_modules`, `dist`, `.artifacts`, or an existing presentation directory wholesale:

```powershell
.\New-Local-Presentation.cmd `
  -Topic QRC -Venue SIGCOM -Title "Time-Series Forecasting with Quantum Reservoir Computing" `
  -DateCode 260724 -DateText "July 24, 2026" -EventName "QRC seminar" `
  -LocalRoot C:\Codes\Presentations -InitGit
```

The generator times scaffold copy, theme packaging, lock creation, formatting, and Git setup. It caches the packed theme and standalone lock by source hash. Pass `-NoCache` only for a cold benchmark.

Use the repository script only when a private GitHub repository is required; it enforces private visibility and the required name:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/new-presentation.ps1 `
  -Topic QML -Venue QCNC -Title "Quantum Machine Learning"
```

Names must match `YYMMDD_<TOPIC>_<VENUE>`, for example `260713_QML_QCNC`. Repositories belong to `STP-Lib` and are private by default. Do not enable Pages during creation.

Generated repositories are lean presentation projects. They carry a packed, revision-pinned theme and required runtime, QA, assets, setup, and publication files; they do not duplicate canonical theme source, the generator, or this skill.

## Iterate efficiently

The authoring loop is the live preview, not a gate. Start it once and edit `slides.md`:

```powershell
pnpm draft   # live hot-reload preview + deterministic deck-rules check on every save
pnpm dev     # live hot-reload preview only
```

Slidev runs on Vite, so each save hot-reloads the affected slide with no rebuild. `pnpm draft` additionally reruns the contract check on save and prints a compact pass or fail line. Never build to see a change; build only for the final static output.

Prefer deterministic scripts for feedback, to keep iteration token-efficient. Seeing a change costs zero tokens because the browser hot-reloads; validating one should cost a few, from a script that prints a short report, not from re-rendering or re-reading the deck. Concretely: make targeted `slides.md` edits, read `pnpm check:deck` (or the `draft` watcher line) for structure, use the Slidev MCP for structured slide operations, and reserve `visual`/`full` for checkpoints. Do not screenshot or re-read the whole deck to confirm a routine edit.

Use the narrowest timed gate only at checkpoints, not to watch a change land:

```powershell
.\Presentation-Workflow.cmd content  # format content and run deck rules
.\Presentation-Workflow.cmd visual   # add browser QA after rendering-sensitive edits
.\Presentation-Workflow.cmd build    # install if needed; reuse an unchanged verified build
.\Presentation-Workflow.cmd full     # fresh build plus full delivery QA
.\Presentation-Workflow.cmd report   # show recent workflow durations
```

Run the `content` mode for prose and speaker-note edits that do not change structure or layout. Run `visual` after metadata, outline, layout, click, equation, figure, or asset edits. Always run `full` or `pnpm check` before delivery, export, synchronization, or publication. Timed workflows write machine-readable records under `.artifacts/timings/`; report the latest total and any cache hit or escalation. On non-Windows systems, run the equivalent `node scripts/workflow.mjs <mode>` command.

Before every push, require the full gate to pass on the exact commit being pushed. Never push a known failing deck. Fix inherited scaffold or baseline defects at the canonical source, update the affected deck, and rerun the gate instead of bypassing CI.

## Author

1. Establish audience, duration, central claim, section order, and evidence map in `content/deck-outline.yaml`.
2. Obtain user approval for a substantial outline before generating the full deck.
3. Edit `slides.md`; keep metadata in headmatter and one concise action-title H1 on each content slide.
4. Use `<v-clicks>`, `v-click`, and `v-after` for explanatory sequence. Keep element dimensions stable across states.
5. Add speaker notes as a final HTML comment. Never place secrets in notes.
6. Register sources in headmatter and cite the first source-defining slide and reproduced figures with `\cite{key}`; use DOI or arXiv links when available.
7. Apply the `humanizer` skill conservatively before final prose delivery: preserve notation, citations, scope, and scientific stance.

Do not invent citations, claims, results, affiliations, dates, or venue details.

## Edit with Slidev MCP

When a Slidev 52.17.0 server is running, prefer its structured MCP operations for listing, reading, inserting, updating, moving, or removing slides:

```text
HTTP:  http://localhost:3030/__mcp
stdio: pnpm slidev mcp slides.md
```

Keep the HTTP endpoint on localhost or a private Codespaces port. Direct Markdown edits remain the fallback.

## Preview and verify

```powershell
.\Presentation-Workflow.cmd build
pnpm dev
pnpm dev -- --remote
pnpm check
pnpm export:clicks
```

`pnpm check` is the delivery gate: formatting, Markdown lint, deck rules, tests, a fresh production build, and Playwright visual QA against that build. Inspect `.artifacts/visual/` after layout changes. Verify desktop framing, click order, equations, figure sharpness, footer clearance, notes, and the exported backup PDF.

## Mathematics and figures

- KaTeX-compatible equations stay as `$...$` or `$$...$$`.
- Reusable quantum and calculus macros live in `setup/katex.ts`; keep `throwOnError: true`.
- TikZ, quantikz, and PGFPlots compile to SVG. Retain `.tex`, data, command, source citation, and generated asset together.
- Never paste raw TikZ into `slides.md` or silently rasterize unsupported equations.

## Interactive plots

Use precomputed Plotly.js/Vue as the default for hover, zoom, trace selection, client-side filtering, sliders over stored results, and animation. Keep the Python generator and data provenance with the figure sources, bundle Plotly locally, and provide a static export fallback. Do not add a Python backend when the browser can perform the requested interaction from stored data.

Use a separate Python service only when an interaction must recompute a simulation, run inference, query live or private data, or would require an impractical number of precomputed states. GitHub Pages cannot host that service. Browser interactivity does not survive PDF export.

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

## Learn verified fixes

After a non-obvious issue is solved and verified:

```powershell
python unilu-slidev/scripts/skill_memory.py learn `
  --title "Short fix name" --problem "Observed failure" --fix "Verified remedy" `
  --use-when "Trigger condition" --command "pnpm check"
```

Record reproducible fixes only; redact credentials and project-sensitive data.
