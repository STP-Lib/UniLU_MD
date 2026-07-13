[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Topic,

    [Parameter(Mandatory = $true)]
    [string]$Venue,

    [Parameter(Mandatory = $true)]
    [string]$Title,

    [ValidatePattern('^\d{6}$')]
    [string]$DateCode = (Get-Date).ToString('yyMMdd'),

    [string]$Organization = 'STP-Lib',

    [switch]$OpenCodespace
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$templateRoot = Split-Path -Parent $PSScriptRoot
$utf8NoBom = New-Object System.Text.UTF8Encoding -ArgumentList $false

function Normalize-Code([string]$Value) {
    $normalized = $Value.ToUpperInvariant() -replace '[^A-Z0-9]', ''
    if ([string]::IsNullOrWhiteSpace($normalized)) {
        throw 'Topic and venue short forms must contain letters or numbers.'
    }
    return $normalized
}

function Assert-LastExitCode([string]$Action) {
    if ($LASTEXITCODE -ne 0) {
        throw "$Action failed with exit code $LASTEXITCODE."
    }
}

function ConvertTo-ProjectJson([object]$Value) {
    $json = $Value | ConvertTo-Json -Depth 20
    return $json.Replace('\u0026', '&').Replace('\u0027', "'").Replace('\u003c', '<').Replace('\u003e', '>')
}

function Copy-TemplatePath([string]$RelativePath, [string]$DestinationRoot) {
    $source = Join-Path $templateRoot $RelativePath
    if (-not (Test-Path -LiteralPath $source)) {
        throw "Required template path is missing: $RelativePath"
    }

    $destination = Join-Path $DestinationRoot $RelativePath
    $item = Get-Item -LiteralPath $source
    if ($item.PSIsContainer) {
        New-Item -ItemType Directory -Force -Path $destination | Out-Null
        Get-ChildItem -LiteralPath $source -Force | Copy-Item -Destination $destination -Recurse -Force
    }
    else {
        $parent = Split-Path -Parent $destination
        New-Item -ItemType Directory -Force -Path $parent | Out-Null
        Copy-Item -LiteralPath $source -Destination $destination -Force
    }
}

$topicCode = Normalize-Code $Topic
$venueCode = Normalize-Code $Venue
$repoName = "${DateCode}_${topicCode}_${venueCode}"
if ($repoName -notmatch '^\d{6}_[A-Z0-9]+_[A-Z0-9]+$') {
    throw "Generated repository name '$repoName' does not satisfy YYMMDD_<TOPIC>_<VENUE>."
}

& gh auth status *> $null
Assert-LastExitCode 'GitHub authentication check'

$slug = "$Organization/$repoName"
$repositoriesJson = & gh repo list $Organization --limit 1000 --json name
Assert-LastExitCode 'Repository availability check'
$repositories = $repositoriesJson | ConvertFrom-Json
$repositoryExists = @($repositories | Where-Object { $_.name -eq $repoName }).Count -gt 0
if ($repositoryExists) {
    throw "Repository $slug already exists."
}

$template = 'STP-Lib/UniLU_MD'
$localRevision = (& git -C $templateRoot rev-parse HEAD).Trim()
Assert-LastExitCode 'Local template revision lookup'
$localChanges = @(& git -C $templateRoot status --porcelain --untracked-files=normal)
Assert-LastExitCode 'Local template status check'
if ($localChanges.Count -gt 0) {
    throw 'Private repository creation requires a clean canonical template worktree.'
}
$templateRevision = (& gh api "repos/$template/commits/main" --jq '.sha').Trim()
Assert-LastExitCode 'Template revision lookup'
if ($localRevision -ne $templateRevision) {
    throw "Local template revision $localRevision does not match $template main at $templateRevision. Synchronize and retry."
}

$tempBase = [IO.Path]::GetFullPath((Join-Path ([IO.Path]::GetTempPath()) 'unilu-md-presentations'))
New-Item -ItemType Directory -Force -Path $tempBase | Out-Null
$tempPath = [IO.Path]::GetFullPath((Join-Path $tempBase ([guid]::NewGuid().ToString('N'))))
if (-not $tempPath.StartsWith($tempBase, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Refusing to use a temporary path outside the expected base directory.'
}

try {
    New-Item -ItemType Directory -Force -Path $tempPath | Out-Null

    $presentationPaths = @(
        '.devcontainer',
        '.github/workflows',
        '.gitattributes',
        '.gitignore',
        '.markdownlint-cli2.jsonc',
        '.npmrc',
        '.prettierignore',
        '.prettierrc.json',
        'AGENTS.md',
        'LICENSE',
        'Open-Presentation.cmd',
        'Presentation-Workflow.cmd',
        'Publish-Presentation.cmd',
        'THIRD_PARTY_NOTICES.md',
        'content',
        'public',
        'scripts/build-pages.mjs',
        'scripts/check-deck.mjs',
        'scripts/deck-rules.mjs',
        'scripts/dev.mjs',
        'scripts/open-presentation.ps1',
        'scripts/publish-presentation.ps1',
        'scripts/run-slidev.mjs',
        'scripts/scratchpad.mjs',
        'scripts/slidev-runtime.mjs',
        'scripts/sync-theme.ps1',
        'scripts/visual-qa.mjs',
        'scripts/workflow.mjs',
        'setup',
        'slides.md',
        'tests/unit/deck-rules.test.ts',
        'tests/unit/scratchpad.test.ts',
        'tsconfig.json',
        'unilu-md.yaml'
    )
    foreach ($path in $presentationPaths) {
        Copy-TemplatePath -RelativePath $path -DestinationRoot $tempPath
    }

    $themePackage = Get-Content -LiteralPath (Join-Path $templateRoot 'theme/package.json') -Raw | ConvertFrom-Json
    $tarballName = "$($themePackage.name)-$($themePackage.version).tgz"
    $themeDestination = Join-Path $tempPath '.theme'
    New-Item -ItemType Directory -Force -Path $themeDestination | Out-Null
    & pnpm --dir (Join-Path $templateRoot 'theme') pack --pack-destination $themeDestination
    Assert-LastExitCode 'Theme packaging'
    $tarballPath = Join-Path $themeDestination $tarballName
    if (-not (Test-Path -LiteralPath $tarballPath)) {
        throw "Theme packaging did not create $tarballName."
    }

    $package = Get-Content -LiteralPath (Join-Path $templateRoot 'package.json') -Raw | ConvertFrom-Json
    $package.name = ($repoName.ToLowerInvariant() -replace '_', '-')
    $package.devDependencies.'slidev-theme-unilu' = "file:.theme/$tarballName"
    [IO.File]::WriteAllText(
        (Join-Path $tempPath 'package.json'),
        (ConvertTo-ProjectJson $package),
        $utf8NoBom
    )

    $workspace = @"
allowBuilds:
  playwright-chromium: true
minimumReleaseAgeExclude:
  - '@iconify-json/lucide@1.2.117'
"@
    [IO.File]::WriteAllText((Join-Path $tempPath 'pnpm-workspace.yaml'), $workspace, $utf8NoBom)

    $tsconfigPath = Join-Path $tempPath 'tsconfig.json'
    $tsconfig = Get-Content -LiteralPath $tsconfigPath -Raw
    $tsconfig = $tsconfig.Replace(
        '"include": ["setup/**/*.ts", "theme/**/*.ts", "theme/**/*.vue", "tests/**/*.ts"]',
        '"include": ["setup/**/*.ts", "tests/**/*.ts"]'
    )
    [IO.File]::WriteAllText($tsconfigPath, $tsconfig, $utf8NoBom)

    $markdownConfigPath = Join-Path $tempPath '.markdownlint-cli2.jsonc'
    $markdownConfig = Get-Content -LiteralPath $markdownConfigPath -Raw
    $markdownConfig = $markdownConfig.Replace(
        '"globs": ["README.md", "AGENTS.md", "unilu-slidev/**/*.md", "slide-deck-scratchpad/**/*.md"]',
        '"globs": ["README.md", "AGENTS.md"]'
    )
    [IO.File]::WriteAllText($markdownConfigPath, $markdownConfig, $utf8NoBom)

    $prettierIgnorePath = Join-Path $tempPath '.prettierignore'
    $prettierIgnore = Get-Content -LiteralPath $prettierIgnorePath -Raw
    $prettierIgnore = $prettierIgnore.Replace("unilu-slidev/references/FREQUENT_TASK_RECIPES.md`r`n", '')
    $prettierIgnore = $prettierIgnore.Replace("unilu-slidev/references/FREQUENT_TASK_RECIPES.md`n", '')
    [IO.File]::WriteAllText($prettierIgnorePath, $prettierIgnore, $utf8NoBom)

    $agentsPath = Join-Path $tempPath 'AGENTS.md'
    $agents = Get-Content -LiteralPath $agentsPath -Raw
    $agents = $agents.Replace(
        '- Use `unilu-slidev/SKILL.md` for all creation, migration, editing, review, export, and publication work in this repository.',
        '- Use the canonical UniLU Slidev skill at `C:\Codes\[STStyles]\UniLU_MD\unilu-slidev\SKILL.md` when available; otherwise consult `https://github.com/STP-Lib/UniLU_MD/tree/main/unilu-slidev`.'
    )
    $agents = $agents.Replace(
        '- Use `slide-deck-scratchpad/SKILL.md` for raw ideation, slide cards, layout or animation intent, and outline handoff. Keep `deck-scratchpad.md` -> `deck-outline.yaml` -> `slides.md` as the ownership boundary.',
        '- Use the companion scratchpad skill at `C:\Codes\[STStyles]\UniLU_MD\slide-deck-scratchpad\SKILL.md` when available; otherwise preserve the `deck-scratchpad.md` -> `deck-outline.yaml` -> `slides.md` boundary.'
    )
    [IO.File]::WriteAllText($agentsPath, $agents, $utf8NoBom)

    $metadataPath = Join-Path $tempPath 'unilu-md.yaml'
    $metadata = Get-Content -LiteralPath $metadataPath -Raw
    $safeTitle = $Title.Replace("'", "''")
    $metadata = $metadata -replace 'template_revision: development', "template_revision: $templateRevision"
    $metadata = $metadata -replace 'presentation_repository: STP-Lib/UniLU_MD', "presentation_repository: $slug"
    $metadata = $metadata -replace 'presentation_title: UniLU Slidev Reference Deck', "presentation_title: '$safeTitle'"
    [IO.File]::WriteAllText($metadataPath, $metadata, $utf8NoBom)

    $slidesPath = Join-Path $tempPath 'slides.md'
    $slides = Get-Content -LiteralPath $slidesPath -Raw
    $slides = $slides.Replace('title: UniLU Slidev Reference Deck', "title: '$safeTitle'")
    $slides = $slides.Replace('# UniLU Slidev Reference Deck', "# $Title")
    $slides = $slides.Replace('eventName: UniLU_MD', "eventName: $venueCode")
    [IO.File]::WriteAllText($slidesPath, $slides, $utf8NoBom)

    $outlinePath = Join-Path $tempPath 'content/deck-outline.yaml'
    $outline = Get-Content -LiteralPath $outlinePath -Raw
    $outline = $outline -replace '(?m)^title:\s*.*$', "title: '$safeTitle'"
    $outline = $outline -replace '(?m)^audience:\s*.*$', "audience: '$venueCode'"
    $outline = $outline.Replace('action_title: UniLU Slidev Reference Deck', "action_title: '$safeTitle'")
    [IO.File]::WriteAllText($outlinePath, $outline, $utf8NoBom)

    Push-Location -LiteralPath $tempPath
    try {
        & node scripts/scratchpad.mjs init --force --title $Title --audience $venueCode
        Assert-LastExitCode 'Scratchpad initialization'
    }
    finally {
        Pop-Location
    }

    $readme = @'
# {{TITLE}}

Private source repository for the **{{TITLE}}** presentation at **{{VENUE}}**. It uses the UniLU Slidev theme pinned to `{{REVISION}}`.

## Edit and Preview

Edit `slides.md`. Section and subsection metadata on content slides automatically populate the interactive outline.

```powershell
pnpm install
pnpm exec playwright install chromium
pnpm dev
```

Run `pnpm check` before sharing or exporting. Create a PDF backup with `pnpm export:clicks`.

## Control from a Phone

Connect the laptop and phone to the same Wi-Fi network, then run:

```powershell
pnpm dev -- --remote
```

The terminal prints the laptop audience URL, the compact phone-control URL at `/entry/`, and the full presenter URL at `/presenter/1`.

In a GitHub Codespace, run `pnpm dev:host`. The terminal prints the private forwarded audience and presenter links; the phone must be signed in to GitHub with access to this repository.

For a phone on another network, set `SLIDEV_REMOTE_PASS` and run `pnpm dev -- --remote --tunnel`. This creates a temporary public tunnel, so stop the server immediately after presenting.

## Theme and Publication

Refresh the pinned theme explicitly with `powershell -ExecutionPolicy Bypass -File scripts/sync-theme.ps1 -Ref <tag-or-commit>`, review the diff, and commit it.

Normal pushes keep the source private and do not publish a website. Run `Publish-Presentation.cmd` only after explicit approval for a public GitHub Pages release.
'@
    $readme = $readme.Replace('{{TITLE}}', $Title)
    $readme = $readme.Replace('{{VENUE}}', $venueCode)
    $readme = $readme.Replace('{{REVISION}}', $templateRevision)
    [IO.File]::WriteAllText((Join-Path $tempPath 'README.md'), $readme, $utf8NoBom)

    & pnpm --dir $tempPath install --lockfile-only
    Assert-LastExitCode 'Generated dependency lock'

    & pnpm --dir $templateRoot exec prettier --write `
        (Join-Path $tempPath 'package.json') `
        (Join-Path $tempPath 'pnpm-workspace.yaml') `
        $metadataPath `
        $slidesPath `
        (Join-Path $tempPath 'README.md') `
        $agentsPath `
        $tsconfigPath `
        $markdownConfigPath
    Assert-LastExitCode 'Generated presentation formatting'

    & git -C $tempPath init -b main
    Assert-LastExitCode 'Presentation repository initialization'
    & git -C $tempPath add --all
    Assert-LastExitCode 'Presentation staging'
    & git -C $tempPath commit -m "Initialize $repoName from UniLU_MD"
    Assert-LastExitCode 'Presentation initialization commit'

    Write-Host "Creating private presentation repository $slug..."
    & gh repo create $slug --private --source $tempPath --remote origin --push --description $Title
    Assert-LastExitCode 'Private repository creation and push'
}
finally {
    if (Test-Path -LiteralPath $tempPath) {
        $resolved = [IO.Path]::GetFullPath((Resolve-Path -LiteralPath $tempPath).Path)
        if (-not $resolved.StartsWith($tempBase, [StringComparison]::OrdinalIgnoreCase)) {
            throw "Refusing to remove unexpected path $resolved."
        }
        Remove-Item -LiteralPath $resolved -Recurse -Force
    }
}

& gh repo edit $slug --add-topic slidev --add-topic academic-presentation --add-topic unilu
Assert-LastExitCode 'Repository topic update'

$codespaceUrl = "https://codespaces.new/${slug}?quickstart=1"
Write-Host "Created $slug"
Write-Host "Private browser workspace: $codespaceUrl"
if ($OpenCodespace) {
    Start-Process $codespaceUrl
}
