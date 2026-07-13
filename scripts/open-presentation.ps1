[CmdletBinding()]
param([int]$Port = 3030)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $root

while (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) {
    $Port++
}

$artifactDir = Join-Path $root '.artifacts'
New-Item -ItemType Directory -Force -Path $artifactDir | Out-Null
$stdout = Join-Path $artifactDir 'slidev.stdout.log'
$stderr = Join-Path $artifactDir 'slidev.stderr.log'
$pnpm = (Get-Command pnpm.cmd -ErrorAction Stop).Source
$process = Start-Process -FilePath $pnpm `
    -ArgumentList @('exec', 'slidev', 'slides.md', '--port', "$Port") `
    -WorkingDirectory $root -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput $stdout -RedirectStandardError $stderr
Set-Content -LiteralPath (Join-Path $root '.slidev.pid') -Value $process.Id -Encoding ascii

$url = "http://localhost:$Port"
for ($attempt = 0; $attempt -lt 60; $attempt++) {
    try {
        $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2
        if ($response.StatusCode -eq 200) {
            Start-Process $url
            Write-Host "Slidev is running at $url (PID $($process.Id))."
            exit 0
        }
    }
    catch {
        Start-Sleep -Milliseconds 500
    }
}

throw "Slidev did not start. Inspect $stderr."
