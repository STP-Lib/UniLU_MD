# GitHub Workflow

## Repositories

- Template and skill: public `STP-Lib/UniLU_MD`.
- Presentations: private `STP-Lib/YYMMDD_<TOPIC>_<VENUE>`.
- Example: `STP-Lib/260713_QML_QCNC`.

Create a presentation with `scripts/new-presentation.ps1`. It assembles a lean repository containing presentation content, required runtime and QA files, shared assets, and a packed revision-pinned theme. It records the template commit, initializes the title, creates and pushes the private repository, applies topics, and optionally opens a private Codespace. It does not copy `theme/`, `unilu-slidev/`, or the repository generator into the presentation.

## Private Browser Review

Use `https://codespaces.new/STP-Lib/<repo>?quickstart=1`. Port 3030 is private in `.devcontainer/devcontainer.json`. Start the deck with `pnpm dev:host`. The launcher prints the forwarded audience, compact `/entry/` remote, and full `/presenter/1` links. A phone can use either control link after signing in to a GitHub account that has repository access.

For local same-Wi-Fi control, run `pnpm dev -- --remote`. For different networks, set `SLIDEV_REMOTE_PASS` and add `--tunnel` explicitly; this creates a temporary public tunnel.

Local agents may use a transient clone, but the GitHub repository remains the presentation source of truth. Never expose the Slidev MCP endpoint on a public port.

## Progress Pushes

Commit and push whenever useful, but require `Presentation-Workflow.cmd full` or `pnpm check` to pass on the exact commit first. Never push a known failing deck. CI may run on push, but `.github/workflows/pages.yml` has no `push` trigger, so progress pushes cannot deploy the site.

The repository generator runs the same full gate before it creates the private GitHub repository. Generated decks must not inherit the canonical reference deck's visual baselines; presentation-specific baselines are added only after deliberate visual approval.

## Public Publication

A normal GitHub Pages site is public even when its repository is private. Publication requires a separate user decision.

`Publish-Presentation.cmd` calls `scripts/publish-presentation.ps1` and enforces:

1. Public-site warning and exact typed `PUBLISH` confirmation.
2. Owner `STP-Lib` and repository name regex `^\d{6}_[A-Z0-9]+_[A-Z0-9]+$`.
3. Clean worktree and no behind/diverged remote state.
4. `pnpm check`.
5. Explicit push offer when the branch is ahead.
6. Manual Pages workflow dispatch with confirmation input.
7. Public build with `--without-notes`.
8. Deployment wait, Pages URL lookup, and browser launch.

The workflow repeats the owner, name, and `PUBLISH` checks so a direct click in GitHub cannot bypass the policy. Never dispatch it for testing unless the user has approved a real public release.

## Theme Updates

Use `scripts/sync-theme.ps1 -Ref <tag-or-commit>`. It requires a clean worktree, packs the selected canonical theme, merges shared setup and assets, updates the theme dependency, lockfile, and recorded revision, and runs the full check. Theme source and the canonical skill remain outside the presentation. Review and commit the diff explicitly.
