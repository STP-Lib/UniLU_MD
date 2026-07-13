[CmdletBinding()]
param(
    [switch]$ConfirmPublic,
    [switch]$PushAhead,
    [switch]$NoOpen
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Assert-Native([string]$Action) {
    if ($LASTEXITCODE -ne 0) {
        throw "$Action failed with exit code $LASTEXITCODE."
    }
}

Write-Warning 'PUBLICATION WARNING: this action creates or updates a PUBLIC GitHub Pages website.'
Write-Warning 'A private source repository does not make the resulting Pages site private.'
if (-not $ConfirmPublic) {
    $confirmation = Read-Host 'Type PUBLISH to continue'
    if ($confirmation -cne 'PUBLISH') {
        throw 'Publication cancelled.'
    }
}

$root = (& git rev-parse --show-toplevel).Trim()
Assert-Native 'Git repository lookup'
Set-Location -LiteralPath $root

& gh auth status *> $null
Assert-Native 'GitHub authentication check'

$remote = (& git remote get-url origin).Trim()
Assert-Native 'Origin lookup'
if ($remote -notmatch 'github\.com[:/](?<owner>[^/]+)/(?<repo>[^/]+?)(?:\.git)?$') {
    throw "Cannot parse GitHub owner and repository from origin '$remote'."
}
$owner = $Matches.owner
$repo = $Matches.repo
if ($owner -cne 'STP-Lib') {
    throw "Publication is restricted to STP-Lib; origin owner is '$owner'."
}
if ($repo -notmatch '^\d{6}_[A-Z0-9]+_[A-Z0-9]+$') {
    throw "Repository '$repo' must match YYMMDD_<TOPIC>_<VENUE>."
}
$slug = "$owner/$repo"

if (& git status --porcelain) {
    throw 'Worktree is not clean. Commit or discard changes before publication.'
}

$workflowPath = Join-Path $root '.github\workflows\pages.yml'
$workflow = Get-Content -LiteralPath $workflowPath -Raw
if ($workflow -notmatch 'workflow_dispatch\s*:') {
    throw 'Pages workflow is missing workflow_dispatch.'
}
if ($workflow -match '(?m)^\s*push\s*:') {
    throw 'Pages workflow contains a forbidden push trigger.'
}

$branch = (& git branch --show-current).Trim()
if (-not $branch) {
    throw 'Detached HEAD cannot be published.'
}
& git fetch --prune origin $branch
Assert-Native 'Remote fetch'
& git rev-parse --verify "origin/$branch" *> $null
Assert-Native 'Remote branch lookup'

$counts = ((& git rev-list --left-right --count "HEAD...origin/$branch").Trim() -split '\s+')
Assert-Native 'Branch synchronization check'
$ahead = [int]$counts[0]
$behind = [int]$counts[1]
if ($behind -gt 0) {
    throw "Local branch is behind or diverged from origin ($ahead ahead, $behind behind). Synchronize first."
}

Write-Host 'Running the full local quality gate...'
& pnpm check
Assert-Native 'pnpm check'

if ($ahead -gt 0) {
    $shouldPush = $PushAhead
    if (-not $shouldPush) {
        $pushConfirmation = Read-Host "Branch is $ahead commit(s) ahead. Type PUSH to push before publication"
        $shouldPush = $pushConfirmation -ceq 'PUSH'
    }
    if (-not $shouldPush) {
        throw 'Publication requires the reviewed local commit to be on GitHub.'
    }
    & git push origin $branch
    Assert-Native 'Git push'
}

$headSha = (& git rev-parse HEAD).Trim()
$started = [DateTimeOffset]::UtcNow
& gh api "repos/$slug/pages" *> $null
if ($LASTEXITCODE -ne 0) {
    & gh api -X POST "repos/$slug/pages" -f build_type=workflow *> $null
    Assert-Native 'GitHub Pages enablement'
}
else {
    & gh api -X PUT "repos/$slug/pages" -f build_type=workflow *> $null
    Assert-Native 'GitHub Pages workflow configuration'
}

& gh workflow run pages.yml --repo $slug --ref $branch -f confirm_public=PUBLISH
Assert-Native 'Pages workflow dispatch'

$runId = $null
for ($attempt = 0; $attempt -lt 30 -and -not $runId; $attempt++) {
    Start-Sleep -Seconds 2
    $runs = & gh run list --repo $slug --workflow pages.yml --event workflow_dispatch --limit 10 `
        --json databaseId,createdAt,headSha | ConvertFrom-Json
    Assert-Native 'Workflow run lookup'
    $match = $runs | Where-Object {
        $_.headSha -eq $headSha -and [DateTimeOffset]$_.createdAt -ge $started.AddMinutes(-1)
    } | Select-Object -First 1
    if ($match) {
        $runId = $match.databaseId
    }
}
if (-not $runId) {
    throw 'The dispatched Pages workflow run could not be located.'
}

& gh run watch $runId --repo $slug --exit-status
Assert-Native 'Pages deployment'
$pagesUrl = (& gh api "repos/$slug/pages" --jq '.html_url').Trim()
Assert-Native 'Pages URL lookup'
Write-Host "Published: $pagesUrl"
if (-not $NoOpen) {
    Start-Process $pagesUrl
}
