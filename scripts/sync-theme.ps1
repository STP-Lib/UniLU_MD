[CmdletBinding()]
param([string]$Ref = 'main')

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $root
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
    & git clone --depth 1 --branch $Ref https://github.com/STP-Lib/UniLU_MD.git $tempPath
    if ($LASTEXITCODE -ne 0) { throw "Unable to clone UniLU_MD ref '$Ref'." }
    foreach ($path in @('theme', 'setup')) {
        $source = Join-Path $tempPath $path
        if (Test-Path -LiteralPath $source) {
            Copy-Item -LiteralPath $source -Destination $root -Recurse -Force
        }
    }
    & pnpm install --frozen-lockfile
    if ($LASTEXITCODE -ne 0) { throw 'Dependency synchronization failed.' }
    & pnpm check
    if ($LASTEXITCODE -ne 0) { throw 'The synchronized theme did not pass pnpm check.' }
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

Write-Host "Theme synchronized from STP-Lib/UniLU_MD@$Ref. Review and commit the resulting changes."
