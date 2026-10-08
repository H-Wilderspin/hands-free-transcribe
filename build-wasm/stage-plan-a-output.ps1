# Copies the Plan-A build output into the app's public/sherpa/ directory.
#
# The build produces ONE combined module (vad-asr) containing ASR + VAD +
# (with our patch) the speaker-embedding APIs, plus the standalone
# speaker-diarization module we still use from the v1.13.7 release bundle.
#
# Usage: powershell -File stage-plan-a-output.ps1 <path-to-sherpa-onnx-src>
$ErrorActionPreference = 'Stop'
param([string]$Src = $(throw 'usage: stage-plan-a-output.ps1 <path-to-sherpa-onnx-src>'))

$built = Join-Path $Src 'build-wasm-simd-vad-asr\install\bin\wasm\vad-asr'
if (-not (Test-Path $built)) { throw "build output not found at $built — did build-plan-a.sh complete?" }

$out = Join-Path $PSScriptRoot '..\public\sherpa'
New-Item -ItemType Directory -Force $out | Out-Null

# The combined vad-asr module's files have the -vad-asr suffix in the build;
# our app expects the -asr names for ASR + embedding and -vad for VAD.
Copy-Item "$built\sherpa-onnx-wasm-main-vad-asr.js"   "$out\sherpa-onnx-wasm-main-asr.js"   -Force
Copy-Item "$built\sherpa-onnx-wasm-main-vad-asr.wasm" "$out\sherpa-onnx-wasm-main-asr.wasm" -Force
Copy-Item "$built\sherpa-onnx-wasm-main-vad-asr.data" "$out\sherpa-onnx-wasm-main-asr.data" -Force
Copy-Item "$built\sherpa-onnx-asr.js"                 "$out\sherpa-onnx-asr.js"             -Force
Copy-Item "$built\sherpa-onnx-vad.js"                 "$out\sherpa-onnx-vad.js"             -Force
# VAD glue points at the combined module too (vad works from the same wasm):
Copy-Item "$built\sherpa-onnx-wasm-main-vad-asr.js"   "$out\sherpa-onnx-wasm-main-vad.js"   -Force
Copy-Item "$built\sherpa-onnx-wasm-main-vad-asr.wasm" "$out\sherpa-onnx-wasm-main-vad.wasm" -Force
Copy-Item "$built\sherpa-onnx-wasm-main-vad-asr.data" "$out\sherpa-onnx-wasm-main-vad.data" -Force

Write-Host "Staged Plan-A artifacts into $out :"
Get-ChildItem $out -Filter '*asr*' | ForEach-Object { "  $($_.Name) ($([math]::Round($_.Length/1MB,2)) MB)" }
Write-Host "NOTE: sherpa-onnx-wasm-main-speaker-diarization.* still comes from the v1.13.7 release bundle (scripts/download-models.ps1)."
