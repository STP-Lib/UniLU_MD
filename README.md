# UniLU_MD

`UniLU_MD` is the canonical Slidev template and Codex skill for University of Luxembourg and SnT academic presentations. It ports the visual contract and writing practices from `UniLU_PPT` to a browser-native, Markdown-first workflow.

## Local Use

Prerequisites: Node 20.12 or newer and pnpm 11.10.0.

```powershell
pnpm install
pnpm exec playwright install chromium
pnpm dev
```

Run the complete quality gate with `pnpm check`. Export a backup PDF with `pnpm export:clicks`.

## New Presentation

Run `New-Presentation.cmd` or:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/new-presentation.ps1 `
  -Topic QML -Venue QCNC -Title "Quantum Machine Learning"
```

The script creates a private repository under `STP-Lib` named `YYMMDD_<TOPIC>_<VENUE>`, records the template revision, and can open a private GitHub Codespace. Example: `260713_QML_QCNC`.

## Publication Safety

Commits and pushes do not publish the presentation. `.github/workflows/pages.yml` has a manual trigger only and requires the value `PUBLISH`.

Public publication is the final step. Run `Publish-Presentation.cmd` only after the local presentation has been reviewed and finalized. The script warns that the resulting website is public, validates the organization and repository name, requires a clean synchronized worktree, runs `pnpm check`, and dispatches the guarded Pages workflow. Public builds exclude speaker notes.

Private browser review uses GitHub Codespaces. A private repository does not make a normal GitHub Pages site private.

## Skill

The reusable Codex skill is in `unilu-slidev/`. Its detailed references cover content design, layouts, LaTeX compatibility, Beamer migration, GitHub workflow, and visual QA.
