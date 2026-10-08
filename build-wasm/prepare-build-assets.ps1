# Prepares model assets for the Plan-A wasm build: stages silero VAD + the
# streaming zipformer EN model into the sherpa-onnx source tree with the
# canonical filenames the build expects.
#
# Usage: powershell -File prepare-build-assets.ps1 <path-to-sherpa-onnx-src>
$ErrorActionPreference = 'Stop'
param([string]$Src = $(throw 'usage: prepare-build-assets.ps1 <path-to-sherpa-onnx-src>'))

$assets = Join-Path $Src 'wasm\vad-asr\assets'
New-Item -ItemType Directory -Force $assets | Out-Null

# 1. silero VAD (from the app repo's cached tarball, or fresh download)
$vadDest = Join-Path $assets 'silero_vad.onnx'
if (-not (Test-Path $vadDest)) {
  Invoke-WebRequest -Uri 'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/silero_vad.onnx' -OutFile $vadDest -UseBasicParsing
}

# 2. streaming zipformer EN model -> canonical names
$asrTar = Join-Path $env:TEMP 'sherpa-onnx-streaming-zipformer-en-20M-2023-02-17.tar.bz2'
if (-not (Test-Path $asrTar)) {
  Invoke-WebRequest -Uri 'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-streaming-zipformer-en-20M-2023-02-17.tar.bz2' -OutFile $asrTar -UseBasicParsing
}
Push-Location $assets
tar -xjf $asrTar
$m = Join-Path $assets 'sherpa-onnx-streaming-zipformer-en-20M-2023-02-17'
Copy-Item "$m\encoder-epoch-99-avg-1.int8.onnx" "$assets\transducer-encoder.onnx" -Force
Copy-Item "$m\decoder-epoch-99-avg-1.onnx"     "$assets\transducer-decoder.onnx" -Force
Copy-Item "$m\joiner-epoch-99-avg-1.int8.onnx" "$assets\transducer-joiner.onnx" -Force
Copy-Item "$m\tokens.txt"                      "$assets\tokens.txt" -Force
Pop-Location

Write-Host "Assets staged in $assets :"
Get-ChildItem $assets | ForEach-Object { "  $($_.Name)" }
