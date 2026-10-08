# Downloads sherpa-onnx WASM bundles from GitHub releases and stages them
# FLAT into public/sherpa/ (the engine workers importScripts('/sherpa/<file>')
# and the emscripten Module.locateFile resolves '/sherpa/<wasm|.data>').
#
# Bundles extract into versioned subdirectories; their contents (excluding the
# demo index.html/app-*.js, which our own app replaces) are copied up one level.
#
# Usage:  powershell -File scripts\download-models.ps1
# Output: public/sherpa/*.js, *.wasm, *.data

$ErrorActionPreference = 'Stop'
$Version = 'v1.13.7'
$Base = "https://github.com/k2-fsa/sherpa-onnx/releases/download/$Version"
$Out = Join-Path $PSScriptRoot '..\public\sherpa'
$Tmp = Join-Path $env:TEMP 'hft-sherpa'

New-Item -ItemType Directory -Force $Out, $Tmp | Out-Null

# name -> release tarball
$Bundles = [ordered]@{
  'asr' = "sherpa-onnx-wasm-simd-$Version-en-asr-zipformer.tar.bz2"
  'vad' = "sherpa-onnx-wasm-simd-$Version-vad.tar.bz2"
  'sd'  = "sherpa-onnx-wasm-simd-$Version-speaker-diarization.tar.bz2"
}

foreach ($kind in $Bundles.Keys) {
  $file = $Bundles[$kind]
  $tar = Join-Path $Tmp $file
  if (-not (Test-Path $tar)) {
    Write-Host "Downloading $file ..."
    Invoke-WebRequest -Uri "$Base/$file" -OutFile $tar -UseBasicParsing
  }
  Write-Host "Extracting $file ..."
  # Run tar with the CWD set to $Tmp so we pass a relative extraction dir —
  # Windows' Git Bash tar misparses absolute C:/ paths as remote hostnames.
  Push-Location $Tmp
  try {
    tar -xjf $file
  } finally {
    Pop-Location
  }
}

# Stage everything flat, skipping demo scaffolding (index.html, app-*.js).
Get-ChildItem -Path $Tmp -Directory -Filter 'sherpa-onnx-wasm-simd-*' | ForEach-Object {
  Get-ChildItem $_.FullName -File | Where-Object { $_.Name -notmatch '^(index\.html|app-.*\.js)$' } | ForEach-Object {
    Copy-Item $_.FullName (Join-Path $Out $_.Name) -Force
    Write-Host "  staged $($_.Name) ($([math]::Round($_.Length/1MB,2)) MB)"
  }
}

# Sanity check: the files the workers depend on must exist.
$required = @(
  'sherpa-onnx-asr.js', 'sherpa-onnx-wasm-main-asr.js', 'sherpa-onnx-wasm-main-asr.wasm', 'sherpa-onnx-wasm-main-asr.data',
  'sherpa-onnx-vad.js', 'sherpa-onnx-wasm-main-vad.js', 'sherpa-onnx-wasm-main-vad.wasm', 'sherpa-onnx-wasm-main-vad.data',
  'sherpa-onnx-speaker-diarization.js', 'sherpa-onnx-wasm-main-speaker-diarization.js',
  'sherpa-onnx-wasm-main-speaker-diarization.wasm', 'sherpa-onnx-wasm-main-speaker-diarization.data'
)
$missing = $required | Where-Object { -not (Test-Path (Join-Path $Out $_)) }
if ($missing) {
  throw "MISSING after extraction: $($missing -join ', ')"
}
Write-Host "`nAll required wasm artifacts staged in public/sherpa/."
