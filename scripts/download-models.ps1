# Downloads sherpa-onnx WASM bundles and standalone models from GitHub releases.
# All artifacts are public (Apache-2.0); no HuggingFace access required.
#
# Usage:  powershell -File scripts\download-models.ps1
# Output: public/sherpa/  (wasm js+wasm files, preloaded model trees)

$ErrorActionPreference = 'Stop'
$Version = 'v1.13.7'
$Base = "https://github.com/k2-fsa/sherpa-onnx/releases/download/$Version"
$Out = Join-Path $PSScriptRoot '..\public\sherpa'

New-Item -ItemType Directory -Force $Out | Out-Null

function Download-And-Extract([string]$Name, [string]$File, [string]$DestSubdir) {
  $tar = Join-Path $env:TEMP $File
  if (-not (Test-Path $tar)) {
    Write-Host "Downloading $File ..."
    Invoke-WebRequest -Uri "$Base/$File" -OutFile $tar -UseBasicParsing
  }
  Write-Host "Extracting $File -> $DestSubdir ..."
  New-Item -ItemType Directory -Force (Join-Path $Out $DestSubdir) | Out-Null
  # tar on Windows 11 supports .tar.bz2 natively
  tar -xjf $tar -C (Join-Path $Out $DestSubdir)
}

# 1. ASR bundle: wasm + preloaded streaming zipformer EN model
Download-And-Extract 'asr' "sherpa-onnx-wasm-simd-$Version-en-asr-zipformer.tar.bz2" 'asr'

# 2. VAD bundle: wasm + silero model
Download-And-Extract 'vad' "sherpa-onnx-wasm-simd-$Version-vad.tar.bz2" 'vad'

# 3. Speaker diarization bundle (Plan B oracle): wasm + segmentation/embedding models
Download-And-Extract 'sd' "sherpa-onnx-wasm-simd-$Version-speaker-diarization.tar.bz2" 'speaker-diarization'

Write-Host 'Done. Contents of public/sherpa:'
Get-ChildItem -Recurse $Out | ForEach-Object { $_.FullName }
