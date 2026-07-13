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

    [string]$DateText,

    [string]$Author = 'Shehbaz Tariq',

    [string]$EventName,

    [string]$EventFull,

    [string]$LocalRoot = 'C:\Codes\Presentations',

    [switch]$InitGit,

    [switch]$NoCache
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$templateRoot = Split-Path -Parent $PSScriptRoot
$utf8NoBom = New-Object System.Text.UTF8Encoding -ArgumentList $false
$timingStartedAt = [DateTime]::UtcNow
$workflowStopwatch = [Diagnostics.Stopwatch]::StartNew()
$timingSteps = [Collections.Generic.List[object]]::new()

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

function ConvertTo-YamlScalar([string]$Value) {
    return "'$($Value.Replace("'", "''"))'"
}

function Get-StringHash([string]$Value) {
    $sha = [Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [Text.Encoding]::UTF8.GetBytes($Value)
        return ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant()
    }
    finally {
        $sha.Dispose()
    }
}

function Get-FileHashHex([string]$Path) {
    $sha = [Security.Cryptography.SHA256]::Create()
    $stream = [IO.File]::OpenRead($Path)
    try {
        return ([BitConverter]::ToString($sha.ComputeHash($stream))).Replace('-', '').ToLowerInvariant()
    }
    finally {
        $stream.Dispose()
        $sha.Dispose()
    }
}

function Get-TreeHash([string]$Root) {
    $rootFull = [IO.Path]::GetFullPath($Root)
    $records = foreach ($file in (Get-ChildItem -LiteralPath $rootFull -Recurse -File -Force | Sort-Object FullName)) {
        $relative = $file.FullName.Substring($rootFull.Length).TrimStart([IO.Path]::DirectorySeparatorChar)
        $normalized = $relative.Replace('\', '/')
        if ($normalized -match '(^|/)(node_modules|\.git|\.artifacts)(/|$)') {
            continue
        }
        "${normalized}:$(Get-FileHashHex $file.FullName)"
    }
    return Get-StringHash ($records -join "`n")
}

function Test-CacheFile([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        return $false
    }
    return (Get-Item -LiteralPath $Path).Length -gt 0
}

function Copy-ToCacheAtomically([string]$Source, [string]$Destination) {
    $parent = Split-Path -Parent $Destination
    New-Item -ItemType Directory -Force -Path $parent | Out-Null
    $staging = "$Destination.$([guid]::NewGuid().ToString('N')).tmp"
    try {
        Copy-Item -LiteralPath $Source -Destination $staging -Force
        Move-Item -LiteralPath $staging -Destination $Destination -Force
    }
    finally {
        if (Test-Path -LiteralPath $staging) {
            Remove-Item -LiteralPath $staging -Force
        }
    }
}

function Invoke-TimedStep([string]$Name, [scriptblock]$Action) {
    $startedAt = [DateTime]::UtcNow
    $stopwatch = [Diagnostics.Stopwatch]::StartNew()
    $status = 'passed'
    Write-Host "[timer] $Name START"
    try {
        & $Action
    }
    catch {
        $status = 'failed'
        throw
    }
    finally {
        $stopwatch.Stop()
        $durationMs = [math]::Round($stopwatch.Elapsed.TotalMilliseconds, 3)
        $timingSteps.Add([pscustomobject]@{
                name = $Name
                status = $status
                startedAt = $startedAt.ToString('o')
                durationMs = $durationMs
            })
        Write-Host "[timer] $Name $($status.ToUpperInvariant()) $([math]::Round($durationMs / 1000, 3))s"
    }
}

function Write-TimingRecord([string]$ProjectPath, [string]$ProjectName, [string]$Status) {
    if ($workflowStopwatch.IsRunning) {
        $workflowStopwatch.Stop()
    }
    $record = [ordered]@{
        schemaVersion = 1
        mode = 'init'
        project = $ProjectName
        status = $Status
        startedAt = $timingStartedAt.ToString('o')
        finishedAt = [DateTime]::UtcNow.ToString('o')
        totalMs = [math]::Round($workflowStopwatch.Elapsed.TotalMilliseconds, 3)
        measurementScope = 'PowerShell script body excluding process launch and timing-record persistence'
        templateRevision = $templateRevision
        cacheEnabled = -not $NoCache.IsPresent
        steps = $timingSteps
    }

    Write-Host ''
    Write-Host "Timing summary: init $Status in $([math]::Round($workflowStopwatch.Elapsed.TotalSeconds, 3))s"
    $timingSteps | Select-Object name, status, @{ Name = 'seconds'; Expression = { [math]::Round($_.durationMs / 1000, 3) } } | Format-Table -AutoSize

    if ($Status -eq 'passed' -and (Test-Path -LiteralPath $ProjectPath)) {
        $timingDirectory = Join-Path $ProjectPath '.artifacts\timings'
        New-Item -ItemType Directory -Force -Path $timingDirectory | Out-Null
        $json = ($record | ConvertTo-Json -Depth 10) + "`n"
        $stamp = $timingStartedAt.ToString('yyyy-MM-ddTHHmmss-fffZ')
        [IO.File]::WriteAllText((Join-Path $timingDirectory "$stamp-init.json"), $json, $utf8NoBom)
        [IO.File]::WriteAllText((Join-Path $timingDirectory 'latest-init.json'), $json, $utf8NoBom)
    }
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
$projectName = "${DateCode}_${topicCode}_${venueCode}"
if ($projectName -notmatch '^\d{6}_[A-Z0-9]+_[A-Z0-9]+$') {
    throw "Generated project name '$projectName' does not satisfy YYMMDD_<TOPIC>_<VENUE>."
}

$localRootFull = [IO.Path]::GetFullPath($LocalRoot)
$destination = [IO.Path]::GetFullPath((Join-Path $localRootFull $projectName))
if (-not $destination.StartsWith($localRootFull, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Refusing to create a presentation outside LocalRoot.'
}
if (Test-Path -LiteralPath $destination) {
    throw "Destination already exists: $destination"
}

if ([string]::IsNullOrWhiteSpace($DateText)) {
    $parsedDate = [DateTime]::ParseExact($DateCode, 'yyMMdd', [Globalization.CultureInfo]::InvariantCulture)
    $DateText = $parsedDate.ToString('MMMM d, yyyy', [Globalization.CultureInfo]::InvariantCulture)
}
if ([string]::IsNullOrWhiteSpace($EventName)) {
    $EventName = $Venue
}
if ([string]::IsNullOrWhiteSpace($EventFull)) {
    $EventFull = $EventName
}

$templateRevision = 'local'
try {
    $templateRevision = (& git -C $templateRoot rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($templateRevision)) {
        $templateRevision = 'local'
    }
    elseif (& git -C $templateRoot status --porcelain --untracked-files=normal) {
        $templateRevision = "$templateRevision-dirty"
    }
}
catch {
    $templateRevision = 'local'
}

$completed = $false
try {
New-Item -ItemType Directory -Force -Path $destination | Out-Null

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
    'tests/unit/deck-rules.test.ts',
    'tests/unit/scratchpad.test.ts',
    'tsconfig.json'
)

Invoke-TimedStep 'copy-scaffold' {
    foreach ($path in $presentationPaths) {
        Copy-TemplatePath -RelativePath $path -DestinationRoot $destination
    }
}

$themePackage = Get-Content -LiteralPath (Join-Path $templateRoot 'theme/package.json') -Raw | ConvertFrom-Json
$tarballName = "$($themePackage.name)-$($themePackage.version).tgz"
$themeDestination = Join-Path $destination '.theme'
New-Item -ItemType Directory -Force -Path $themeDestination | Out-Null
$themeRoot = Join-Path $templateRoot 'theme'
$themeHash = Get-TreeHash $themeRoot
$cacheRoot = Join-Path $templateRoot '.artifacts\scaffold-cache'
$cachedThemeDirectory = Join-Path $cacheRoot "theme\$themeHash"
$cachedThemeTarball = Join-Path $cachedThemeDirectory $tarballName
if (-not $NoCache -and (Test-CacheFile $cachedThemeTarball)) {
    Invoke-TimedStep 'theme-cache-copy' {
        Copy-Item -LiteralPath $cachedThemeTarball -Destination (Join-Path $themeDestination $tarballName) -Force
    }
}
else {
    Invoke-TimedStep 'theme-pack' {
        & pnpm --dir $themeRoot pack --pack-destination $themeDestination
        Assert-LastExitCode 'Theme packaging'
        $packedTheme = Join-Path $themeDestination $tarballName
        if (-not (Test-CacheFile $packedTheme)) {
            throw "Theme package was not created: $packedTheme"
        }
        if (-not $NoCache) {
            Copy-ToCacheAtomically -Source $packedTheme -Destination $cachedThemeTarball
        }
    }
}
if (-not (Test-CacheFile (Join-Path $themeDestination $tarballName))) {
    throw "Generated theme package is missing: $tarballName"
}

$package = Get-Content -LiteralPath (Join-Path $templateRoot 'package.json') -Raw | ConvertFrom-Json
$package.name = ($projectName.ToLowerInvariant() -replace '_', '-')
$package.devDependencies.'slidev-theme-unilu' = "file:.theme/$tarballName"
[IO.File]::WriteAllText((Join-Path $destination 'package.json'), (ConvertTo-ProjectJson $package), $utf8NoBom)

$workspace = @"
allowBuilds:
  playwright-chromium: true
minimumReleaseAgeExclude:
  - '@iconify-json/lucide@1.2.117'
"@
[IO.File]::WriteAllText((Join-Path $destination 'pnpm-workspace.yaml'), $workspace, $utf8NoBom)

$tsconfigPath = Join-Path $destination 'tsconfig.json'
$tsconfig = Get-Content -LiteralPath $tsconfigPath -Raw
$tsconfig = $tsconfig.Replace(
    '"include": ["setup/**/*.ts", "theme/**/*.ts", "theme/**/*.vue", "tests/**/*.ts"]',
    '"include": ["setup/**/*.ts", "tests/**/*.ts"]'
)
[IO.File]::WriteAllText($tsconfigPath, $tsconfig, $utf8NoBom)

$markdownConfigPath = Join-Path $destination '.markdownlint-cli2.jsonc'
$markdownConfig = Get-Content -LiteralPath $markdownConfigPath -Raw
$markdownConfig = $markdownConfig.Replace(
    '"globs": ["README.md", "AGENTS.md", "unilu-slidev/**/*.md", "slide-deck-scratchpad/**/*.md"]',
    '"globs": ["README.md", "AGENTS.md"]'
)
[IO.File]::WriteAllText($markdownConfigPath, $markdownConfig, $utf8NoBom)

$prettierIgnorePath = Join-Path $destination '.prettierignore'
$prettierIgnore = Get-Content -LiteralPath $prettierIgnorePath -Raw
$prettierIgnore = $prettierIgnore.Replace("unilu-slidev/references/FREQUENT_TASK_RECIPES.md`r`n", '')
$prettierIgnore = $prettierIgnore.Replace("unilu-slidev/references/FREQUENT_TASK_RECIPES.md`n", '')
[IO.File]::WriteAllText($prettierIgnorePath, $prettierIgnore, $utf8NoBom)

$agentsPath = Join-Path $destination 'AGENTS.md'
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

$titleYaml = ConvertTo-YamlScalar $Title
$authorYaml = ConvertTo-YamlScalar $Author
$eventNameYaml = ConvertTo-YamlScalar $EventName
$eventFullYaml = ConvertTo-YamlScalar $EventFull
$dateYaml = ConvertTo-YamlScalar $DateText

$metadata = @"
schema_version: 1
template_repository: STP-Lib/UniLU_MD
template_revision: $templateRevision
presentation_repository: local/$projectName
presentation_title: $titleYaml
publication:
  visibility: local-source
  pages_enabled: false
  requires_explicit_confirmation: true
"@
[IO.File]::WriteAllText((Join-Path $destination 'unilu-md.yaml'), $metadata, $utf8NoBom)

$slides = @"
---
theme: unilu
title: $titleYaml
author: $authorYaml
institute: Interdisciplinary Centre for Security, Reliability and Trust (SnT), University of Luxembourg
eventName: $eventNameYaml
eventFull: $eventFullYaml
date: $dateYaml
contactEmail: shehbaz.tariq@uni.lu
contactWeb: www.uni.lu/snt
canvasWidth: 1600
aspectRatio: 16/9
colorSchema: light
transition: fade-out
drawings:
  persist: false
mcp: true
references: []
---

# $Title

<!--
Opening title slide. PRIVATE-NOTES-MUST-NOT-SHIP
-->

---
layout: outline
routeAlias: outline
---

---
layout: default
section: Discussion
subsection: Discussion points
---

# Discussion

<div
  class="h-72 flex items-center justify-center rounded-[6px] border-2 border-dashed border-[#b0bcd2] text-[#8a93a3]"
  style="background: rgba(176, 188, 210, 0.12)"
>
  Add discussion content here
</div>

---
layout: default
section: Next steps
subsection: Actions
---

# Next steps

<div
  class="h-72 flex items-center justify-center rounded-[6px] border-2 border-dashed border-[#b0bcd2] text-[#8a93a3]"
  style="background: rgba(176, 188, 210, 0.12)"
>
  Add actions, owners, and dates here
</div>

---
layout: closing
author: $authorYaml
contactEmail: shehbaz.tariq@uni.lu
contactWeb: www.uni.lu/snt
---
"@
[IO.File]::WriteAllText((Join-Path $destination 'slides.md'), $slides, $utf8NoBom)

New-Item -ItemType Directory -Force -Path (Join-Path $destination 'content') | Out-Null
$outline = @"
status: draft
approval: pending
title: $titleYaml
audience: $eventFullYaml
date: $dateYaml
author: $authorYaml
duration_minutes: null
slides:
  - number: 1
    purpose: Establish the seminar topic and speaker
    action_title: $titleYaml
    exhibit: title slide
    evidence: seminar metadata
    takeaway: The talk focuses on the stated topic.
  - number: 2
    purpose: Provide navigable section outline
    action_title: Outline
    exhibit: generated outline layout
    evidence: slide section metadata
    takeaway: The deck structure will be populated as sections are added.
  - number: 3
    purpose: Provide a starting slide for discussion
    action_title: Discussion
    exhibit: replaceable content canvas
    evidence: none
    takeaway: This slide is ready for the meeting discussion.
  - number: 4
    purpose: Record follow-up actions
    action_title: Next steps
    exhibit: replaceable content canvas
    evidence: none
    takeaway: This slide is ready for agreed actions and dates.
"@
[IO.File]::WriteAllText((Join-Path $destination 'content/deck-outline.yaml'), $outline, $utf8NoBom)

Invoke-TimedStep 'scratchpad-init' {
    Push-Location -LiteralPath $destination
    try {
        & node scripts/scratchpad.mjs init --title $Title --audience $EventFull
        Assert-LastExitCode 'Scratchpad initialization'
    }
    finally {
        Pop-Location
    }
}

$readme = @"
# $Title

Local source project for the **$Title** presentation for **$EventFull**.

- Local project: ``$destination``
- Main content: ``slides.md``
- Date: $DateText
- Author: $Author

## Edit and Preview

Edit ``slides.md``. The ``section`` and ``subsection`` fields on content slides automatically populate the interactive outline.

``````powershell
.\Presentation-Workflow.cmd build
pnpm dev
``````

Use ``.\Presentation-Workflow.cmd content`` while editing. Run ``.\Presentation-Workflow.cmd full`` before sharing or exporting. Create a PDF backup with ``pnpm export:clicks``.

## Theme and Publication

This deck uses a packed local UniLU Slidev theme. Normal editing is local-only unless a repository is created later.
"@
[IO.File]::WriteAllText((Join-Path $destination 'README.md'), $readme, $utf8NoBom)

$lockKeySource = (Get-Content -LiteralPath (Join-Path $templateRoot 'package.json') -Raw) + "`n" +
    (Get-Content -LiteralPath (Join-Path $templateRoot '.npmrc') -Raw) + "`n" + $workspace + "`n" + $themeHash
$lockKey = Get-StringHash $lockKeySource
$cachedLockDirectory = Join-Path $cacheRoot "lock\$lockKey"
$cachedLock = Join-Path $cachedLockDirectory 'pnpm-lock.yaml'
if (-not $NoCache -and (Test-CacheFile $cachedLock)) {
    Invoke-TimedStep 'dependency-lock-cache' {
        Copy-Item -LiteralPath $cachedLock -Destination (Join-Path $destination 'pnpm-lock.yaml') -Force
    }
}
else {
    Invoke-TimedStep 'dependency-lock' {
        & pnpm --dir $destination install --lockfile-only --prefer-offline
        Assert-LastExitCode 'Generated dependency lock'
        if (-not $NoCache) {
            Copy-ToCacheAtomically -Source (Join-Path $destination 'pnpm-lock.yaml') -Destination $cachedLock
        }
    }
}

Invoke-TimedStep 'format-scaffold' {
    & pnpm --dir $templateRoot exec prettier --write `
        (Join-Path $destination 'package.json') `
        (Join-Path $destination 'pnpm-workspace.yaml') `
        (Join-Path $destination 'unilu-md.yaml') `
        (Join-Path $destination 'slides.md') `
        (Join-Path $destination 'README.md') `
        (Join-Path $destination 'content/deck-outline.yaml') `
        $agentsPath `
        $tsconfigPath `
        $markdownConfigPath
    Assert-LastExitCode 'Generated presentation formatting'
}

if ($InitGit) {
    Invoke-TimedStep 'git-init' {
        & git -C $destination init -b main
        Assert-LastExitCode 'Local repository initialization'
    }
}

Write-Host "Created local presentation: $destination"
$completed = $true
}
finally {
    $status = if ($completed) { 'passed' } else { 'failed' }
    if (-not $completed -and (Test-Path -LiteralPath $destination)) {
        Remove-Item -LiteralPath $destination -Recurse -Force
    }
    Write-TimingRecord -ProjectPath $destination -ProjectName $projectName -Status $status
}
