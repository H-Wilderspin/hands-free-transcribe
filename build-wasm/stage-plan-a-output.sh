#!/usr/bin/env bash
# Copies the Plan-A build output into the app's public/sherpa/ directory.
#
# The build produces ONE combined module (vad-asr) containing ASR + VAD +
# (with our patch) the speaker-embedding APIs, plus the standalone
# speaker-diarization module we still use from the v1.13.7 release bundle.
#
# Usage: bash stage-plan-a-output.sh /path/to/sherpa-onnx-src
set -ex

SRC=${1:?usage: bash stage-plan-a-output.sh /path/to/sherpa-onnx-src}
BUILT="$SRC/build-wasm-simd-vad-asr/install/bin/wasm/vad-asr"
[ -d "$BUILT" ] || { echo "build output not found at $BUILT - did build-plan-a.sh complete?"; exit 1; }

OUT="$(cd "$(dirname "$0")/.." && pwd)/public/sherpa"
mkdir -p "$OUT"

# The combined vad-asr module's files have the -vad-asr suffix in the build;
# our app expects the -asr names for ASR + embedding and -vad for VAD.
cp -f "$BUILT/sherpa-onnx-wasm-main-vad-asr.js"   "$OUT/sherpa-onnx-wasm-main-asr.js"
cp -f "$BUILT/sherpa-onnx-wasm-main-vad-asr.wasm" "$OUT/sherpa-onnx-wasm-main-asr.wasm"
cp -f "$BUILT/sherpa-onnx-wasm-main-vad-asr.data" "$OUT/sherpa-onnx-wasm-main-asr.data"
cp -f "$BUILT/sherpa-onnx-asr.js"                 "$OUT/sherpa-onnx-asr.js"
cp -f "$BUILT/sherpa-onnx-vad.js"                 "$OUT/sherpa-onnx-vad.js"
# VAD glue points at the combined module too (vad works from the same wasm):
cp -f "$BUILT/sherpa-onnx-wasm-main-vad-asr.js"   "$OUT/sherpa-onnx-wasm-main-vad.js"
cp -f "$BUILT/sherpa-onnx-wasm-main-vad-asr.wasm" "$OUT/sherpa-onnx-wasm-main-vad.wasm"
cp -f "$BUILT/sherpa-onnx-wasm-main-vad-asr.data" "$OUT/sherpa-onnx-wasm-main-vad.data"

echo "Staged Plan-A artifacts into $OUT :"
ls -lh "$OUT" | grep -E 'asr|vad'
echo "NOTE: sherpa-onnx-wasm-main-speaker-diarization.* still comes from the v1.13.7 release bundle (download-models.ps1)."
