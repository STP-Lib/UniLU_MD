# UniLU_MD

`UniLU_MD` is the canonical Slidev template and Codex skill for University of Luxembourg and SnT academic presentations. It ports the visual contract and writing practices from `UniLU_PPT` to a browser-native, Markdown-first workflow.

## Local use

Prerequisites: Node 20.12 or newer and pnpm 11.10.0.

```powershell
pnpm install
pnpm exec playwright install chromium
```

## Fast authoring loop

This is the iteration loop. Start it once and leave it running:

```powershell
pnpm draft   # live preview (hot reload) + deterministic deck check on every save
pnpm dev     # live preview only
```

Then just edit `slides.md`. Slidev runs on Vite, so every save hot-reloads the
affected slide in the browser with no rebuild. `pnpm draft` also reruns the
deck-rules contract check on each save and prints a compact pass or fail line, so
you get instant structural feedback without launching the full quality gate. You
never build to see a change; building is only for the final static output.

The loop is token-efficient on purpose: seeing a change costs zero tokens (the
browser hot-reloads), and validating one costs a few (a deterministic script
prints a short report). Prefer it over re-rendering or re-reading the deck.

## Pre-commit and delivery gates

The timed gates below are for checkpoints, not for watching a change land. Run
the narrowest one that matches your edit, and always run `full` (or `pnpm check`)
before you commit, export, or publish:

```powershell
.\Presentation-Workflow.cmd content  # prose or speaker-note edits: format + deck rules
.\Presentation-Workflow.cmd visual   # layout, click, equation, figure, or asset edits
.\Presentation-Workflow.cmd build    # reuse an unchanged verified production build
.\Presentation-Workflow.cmd full     # fresh build plus full delivery QA
.\Presentation-Workflow.cmd report   # show recent workflow durations
```

`build` reuses an unchanged verified production build, `content` formats and checks local deck content, and `full` always rebuilds before visual QA. Timing records are stored under `.artifacts/timings/`; Node totals include process startup but exclude the final timing-file write. Export a backup PDF with `pnpm export:clicks`.

## New presentation

Create a local-only presentation without GitHub:

```powershell
.\New-Local-Presentation.cmd `
  -Topic QRC -Venue SIGCOM -Title "Quantum Reservoir Computing" `
  -LocalRoot C:\Codes\Presentations
```

The local generator times each scaffold step and reuses source-hashed theme and lock caches. It also creates `content/deck-scratchpad.md` for lightweight ideation.

Run `New-Presentation.cmd` or:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/new-presentation.ps1 `
  -Topic QML -Venue QCNC -Title "Quantum Machine Learning"
```

The script creates a private repository under `STP-Lib` named `YYMMDD_<TOPIC>_<VENUE>`, records the template revision, and can open a private GitHub Codespace. Example: `260713_QML_QCNC`.

Generated repositories contain presentation content, runtime and QA scripts, required assets, and a packed revision-pinned theme. They do not copy the canonical `theme/` source, generator, or `unilu-slidev/` skill. Each repository receives a README for its own title, venue, editing, remote-control, testing, and publication workflow.

## Phone remote

For a laptop and phone on the same Wi-Fi network:

```powershell
pnpm dev -- --remote
```

The launcher prints an audience URL, a compact phone-control URL at `/entry/`, and a full presenter URL at `/presenter/1`. In a GitHub Codespace, run `pnpm dev:host`; it prints the authenticated forwarded URLs instead. Port 3030 stays private, so the phone must be signed in to GitHub with access to the presentation repository.

For devices on different networks, set `SLIDEV_REMOTE_PASS` and run `pnpm dev -- --remote --tunnel`. The resulting tunnel is temporary and public.

## Publication safety

Commits and pushes do not publish the presentation. `.github/workflows/pages.yml` has a manual trigger only and requires the value `PUBLISH`.

Public publication is the final step. Run `Publish-Presentation.cmd` only after the local presentation has been reviewed and finalized. The script warns that the resulting website is public, validates the organization and repository name, requires a clean synchronized worktree, runs `pnpm check`, and dispatches the guarded Pages workflow. Public builds exclude speaker notes.

Private browser review uses GitHub Codespaces. A private repository does not make a normal GitHub Pages site private.

## Skills

The `slide-deck-scratchpad/` skill owns raw ideas and the approved outline handoff. The `unilu-slidev/` skill owns `slides.md`, layout implementation, rendering, QA, export, and publication.
