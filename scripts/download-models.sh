#!/usr/bin/env bash
# Downloads sherpa-onnx WASM bundles from GitHub releases and stages them
# FLAT into public/sherpa/ (the engine workers importScripts('/sherpa/<file>')
# and the emscripten Module.locateFile resolves '/sherpa/<wasm|.data>').
#
# Bundles extract into versioned subdirectories; their contents (excluding the
# demo index.html/app-*.js, which our own app replaces) are copied up one level.
#
# Usage: bash scripts/download-models.sh
set -e

VERSION="v1.13.7"
BASE="https://github.com/k2-fsa/sherpa-onnx/releases/download/${VERSION}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/public/sherpa"
TMP="/tmp/hft-sherpa"

mkdir -p "$OUT" "$TMP"

# name -> release tarball
fetch_and_extract() {
  local file="$1"
  local tar="$TMP/$file"
  if [ ! -f "$tar" ]; then
    echo "Downloading $file ..."
    curl -SL -o "$tar" "$BASE/$file"
  fi
  echo "Extracting $file ..."
  tar -xjf "$tar" -C "$TMP"
}

fetch_and_extract "sherpa-onnx-wasm-simd-${VERSION}-en-asr-zipformer.tar.bz2"
fetch_and_extract "sherpa-onnx-wasm-simd-${VERSION}-vad.tar.bz2"
fetch_and_extract "sherpa-onnx-wasm-simd-${VERSION}-speaker-diarization.tar.bz2"

# Stage everything flat, skipping demo scaffolding (index.html, app-*.js).
for d in "$TMP"/sherpa-onnx-wasm-simd-*; do
  [ -d "$d" ] || continue
  for f in "$d"/*; do
    base="$(basename "$f")"
    case "$base" in
      index.html|app-*.js) continue ;;
    esac
    cp -f "$f" "$OUT/$base"
    echo "  staged $base ($(du -m "$f" | cut -f1) MB)"
  done
done

# Sanity check: the files the workers depend on must exist.
missing=""
for f in \
  sherpa-onnx-asr.js sherpa-onnx-wasm-main-asr.js sherpa-onnx-wasm-main-asr.wasm sherpa-onnx-wasm-main-asr.data \
  sherpa-onnx-vad.js sherpa-onnx-wasm-main-vad.js sherpa-onnx-wasm-main-vad.wasm sherpa-onnx-wasm-main-vad.data \
  sherpa-onnx-speaker-diarization.js sherpa-onnx-wasm-main-speaker-diarization.js \
  sherpa-onnx-wasm-main-speaker-diarization.wasm sherpa-onnx-wasm-main-speaker-diarization.data
do
  [ -f "$OUT/$f" ] || missing="$missing $f"
done
if [ -n "$missing" ]; then
  echo "MISSING after extraction:$missing"
  exit 1
fi

echo ""
echo "All required wasm artifacts staged in public/sherpa/."
