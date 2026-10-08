# Pre-download every FetchContent tarball referenced by sherpa-onnx's build
# into ~/Downloads (CMake checks $ENV{HOME}/Downloads first for each dep).
#
# Run AFTER cloning sherpa-onnx to <path> — pass the path as argument 1.
# Usage: powershell -File fetch-build-deps.ps1 <path-to-sherpa-onnx-src>
$ErrorActionPreference = 'Stop'
param([string]$Src = $(throw 'usage: fetch-build-deps.ps1 <path-to-sherpa-onnx-src>'))

$homeDownloads = Join-Path $env:USERPROFILE 'Downloads'
New-Item -ItemType Directory -Force $homeDownloads | Out-Null

$seen = @{}
$patterns = @(
  (Join-Path $Src 'cmake\*.cmake'),
  (Join-Path $Src 'wasm\*\CMakeLists.txt')
)
$files = $patterns | ForEach-Object { Get-ChildItem $_ -ErrorAction SilentlyContinue } | Sort-Object FullName -Unique

foreach ($f in $files) {
  $content = Get-Content $f.FullName -Raw
  $urlMatches = [regex]::Matches($content, '"(https://[^"\s]+?\.(?:tar\.gz|zip|tar\.bz2))"')
  foreach ($m in $urlMatches) {
    $url = $m.Groups[1].Value
    $hashM = [regex]::Match($content, 'SHA256=([a-f0-9]{64})')
    $expected = if ($hashM.Success) { $hashM.Groups[1].Value.ToLower() } else { $null }
    $fname = ($url -split '/')[-1]
    if ($seen[$fname]) { continue }
    $seen[$fname] = $true
    $dest = Join-Path $homeDownloads $fname
    if (Test-Path $dest) { Write-Host "have  $fname"; continue }
    Write-Host "fetch $fname"
    try {
      Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing -TimeoutSec 600
      if ($expected) {
        $h = (Get-FileHash $dest -Algorithm SHA256).Hash.ToLower()
        if ($h -ne $expected) {
          Write-Warning "HASH MISMATCH for ${fname}: got $h want $expected"
          Remove-Item $dest -Force
        } else { Write-Host "  hash ok" }
      }
    } catch {
      Write-Warning "FAILED ${fname}: $($_.Exception.Message)"
    }
  }
}
Write-Host "done - $($seen.Count) distinct deps processed"
