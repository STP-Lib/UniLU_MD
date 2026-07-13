[CmdletBinding()]
param([string]$Ref = 'main')

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$root = Split-Path -Parent $PSScriptRoot
$utf8NoBom = New-Object System.Text.UTF8Encoding -ArgumentList $false
Set-Location -LiteralPath $root

function Assert-Native([string]$Action) {
    if ($LASTEXITCODE -ne 0) {
        throw "$Action failed with exit code $LASTEXITCODE."
    }
}

function Merge-Directory([string]$Source, [string]$Destination) {
    New-Item -ItemType Directory -Force -Path $Destination | Out-Null
    Get-ChildItem -LiteralPath $Source -Force | Copy-Item -Destination $Destination -Recurse -Force
}

if (Test-Path -LiteralPath (Join-Path $root 'theme')) {
    throw 'This command updates a presentation repository, not the canonical UniLU_MD source.'
}
if (-not (Test-Path -LiteralPath (Join-Path $root 'unilu-md.yaml'))) {
    throw 'This directory is not a UniLU_MD presentation repository.'
}
if (& git status --porcelain) {
    throw 'Theme synchronization requires a clean worktree.'
}

$tempBase = [IO.Path]::GetFullPath((Join-Path ([IO.Path]::GetTempPath()) 'unilu-md-theme-sync'))
New-Item -ItemType Directory -Force -Path $tempBase | Out-Null
$tempPath = [IO.Path]::GetFullPath((Join-Path $tempBase ([guid]::NewGuid().ToString('N'))))
if (-not $tempPath.StartsWith($tempBase, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Unexpected temporary path.'
}

try {
    New-Item -ItemType Directory -Force -Path $tempPath | Out-Null
    & git -C $tempPath init
    Assert-Native 'Temporary repository initialization'
    & git -C $tempPath remote add origin https://github.com/STP-Lib/UniLU_MD.git
    Assert-Native 'Template remote setup'
    & git -C $tempPath fetch --depth 1 origin $Ref
    Assert-Native "Template ref fetch for '$Ref'"
    & git -C $tempPath checkout --detach FETCH_HEAD
    Assert-Native 'Template checkout'
    $revision = (& git -C $tempPath rev-parse HEAD).Trim()
    Assert-Native 'Template revision lookup'

    $themePackagePath = Join-Path $tempPath 'theme/package.json'
    $themePackage = Get-Content -LiteralPath $themePackagePath -Raw | ConvertFrom-Json
    $tarballName = "$($themePackage.name)-$($themePackage.version).tgz"
    $packDestination = Join-Path $tempPath '.packed-theme'
    New-Item -ItemType Directory -Force -Path $packDestination | Out-Null
    & pnpm --dir (Join-Path $tempPath 'theme') pack --pack-destination $packDestination
    Assert-Native 'Theme packaging'
    $packedTheme = Join-Path $packDestination $tarballName
    if (-not (Test-Path -LiteralPath $packedTheme)) {
        throw "Theme packaging did not create $tarballName."
    }

    $themeDestination = Join-Path $root '.theme'
    New-Item -ItemType Directory -Force -Path $themeDestination | Out-Null
    Get-ChildItem -LiteralPath $themeDestination -Filter 'slidev-theme-unilu-*.tgz' -File | ForEach-Object {
        Remove-Item -LiteralPath $_.FullName -Force
    }
    Copy-Item -LiteralPath $packedTheme -Destination (Join-Path $themeDestination $tarballName) -Force

    Merge-Directory -Source (Join-Path $tempPath 'setup') -Destination (Join-Path $root 'setup')
    Merge-Directory -Source (Join-Path $tempPath 'public/assets') -Destination (Join-Path $root 'public/assets')
    Merge-Directory -Source (Join-Path $tempPath 'public/fonts') -Destination (Join-Path $root 'public/fonts')

    $packagePath = Join-Path $root 'package.json'
    $package = Get-Content -LiteralPath $packagePath -Raw | ConvertFrom-Json
    $package.devDependencies.'slidev-theme-unilu' = "file:.theme/$tarballName"
    [IO.File]::WriteAllText($packagePath, ($package | ConvertTo-Json -Depth 20), $utf8NoBom)

    $metadataPath = Join-Path $root 'unilu-md.yaml'
    $metadata = Get-Content -LiteralPath $metadataPath -Raw
    $metadata = $metadata -replace '(?m)^template_revision:\s*.+$', "template_revision: $revision"
    [IO.File]::WriteAllText($metadataPath, $metadata, $utf8NoBom)

    & pnpm exec prettier --write package.json unilu-md.yaml
    Assert-Native 'Synchronized file formatting'
    & pnpm install --lockfile-only
    Assert-Native 'Dependency lock update'
    & pnpm install --frozen-lockfile
    Assert-Native 'Dependency synchronization'
    & pnpm check
    Assert-Native 'Synchronized presentation quality gate'
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

Write-Host "Theme synchronized from STP-Lib/UniLU_MD@$revision. Review and commit the changes."
