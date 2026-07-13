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

function Normalize-Code([string]$Value) {
    $normalized = $Value.ToUpperInvariant() -replace '[^A-Z0-9]', ''
    if ([string]::IsNullOrWhiteSpace($normalized)) {
        throw "Topic and venue short forms must contain letters or numbers."
    }
    return $normalized
}

function Assert-LastExitCode([string]$Action) {
    if ($LASTEXITCODE -ne 0) {
        throw "$Action failed with exit code $LASTEXITCODE."
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

$template = "$Organization/UniLU_MD"
$templateRevision = (& gh api "repos/$template/commits/main" --jq '.sha').Trim()
Assert-LastExitCode 'Template revision lookup'

Write-Host "Creating private presentation repository $slug..."
& gh repo create $slug --private --template $template --description $Title
Assert-LastExitCode 'Repository creation'

$tempBase = [IO.Path]::GetFullPath((Join-Path ([IO.Path]::GetTempPath()) 'unilu-md-presentations'))
New-Item -ItemType Directory -Force -Path $tempBase | Out-Null
$tempPath = [IO.Path]::GetFullPath((Join-Path $tempBase ([guid]::NewGuid().ToString('N'))))
if (-not $tempPath.StartsWith($tempBase, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Refusing to use a temporary path outside the expected base directory.'
}

try {
    & git clone "https://github.com/$slug.git" $tempPath
    Assert-LastExitCode 'Presentation clone'

    $metadataPath = Join-Path $tempPath 'unilu-md.yaml'
    $metadata = Get-Content -LiteralPath $metadataPath -Raw
    $safeTitle = $Title.Replace("'", "''")
    $metadata = $metadata -replace 'template_revision: development', "template_revision: $templateRevision"
    $metadata = $metadata -replace 'presentation_repository: STP-Lib/UniLU_MD', "presentation_repository: $slug"
    $metadata = $metadata -replace 'presentation_title: UniLU Slidev Reference Deck', "presentation_title: '$safeTitle'"
    Set-Content -LiteralPath $metadataPath -Value $metadata -Encoding utf8

    $slidesPath = Join-Path $tempPath 'slides.md'
    $slides = Get-Content -LiteralPath $slidesPath -Raw
    $slides = $slides.Replace('title: UniLU Slidev Reference Deck', "title: '$safeTitle'")
    $slides = $slides.Replace('# UniLU Slidev Reference Deck', "# $Title")
    $slides = $slides.Replace('eventName: UniLU_MD', "eventName: $venueCode")
    Set-Content -LiteralPath $slidesPath -Value $slides -Encoding utf8

    & git -C $tempPath add unilu-md.yaml slides.md
    & git -C $tempPath commit -m "Initialize $repoName from UniLU_MD"
    Assert-LastExitCode 'Initialization commit'
    & git -C $tempPath push origin main
    Assert-LastExitCode 'Initialization push'
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

$codespaceUrl = "https://codespaces.new/$slug?quickstart=1"
Write-Host "Created $slug"
Write-Host "Private browser workspace: $codespaceUrl"
if ($OpenCodespace) {
    Start-Process $codespaceUrl
}
