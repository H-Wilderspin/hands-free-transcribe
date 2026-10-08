#!/usr/bin/env bash
# Prepares model assets for the Plan-A wasm build: stages silero VAD + the
# streaming zipformer EN model into the sherpa-onnx source tree with the
# canonical filenames the build expects.
#
# Usage: bash prepare-build-assets.sh /path/to/sherpa-onnx-src
set -ex

SRC=${1:?usage: bash prepare-build-assets.sh /path/to/sherpa-onnx-src}
ASSETS="$SRC/wasm/vad-asr/assets"
mkdir -p "$ASSETS"

# 1. silero VAD (from the app repo's cached tarball, or fresh download)
if [ ! -f "$ASSETS/silero_vad.onnx" ]; then
  curl -SL -o "$ASSETS/silero_vad.onnx" \
    https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/silero_vad.onnx
fi

# 2. streaming zipformer EN model -> canonical names
ASR_TAR="/tmp/sherpa-onnx-streaming-zipformer-en-20M-2023-02-17.tar.bz2"
if [ ! -f "$ASR_TAR" ]; then
  curl -SL -o "$ASR_TAR" \
    https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-streaming-zipformer-en-20M-2023-02-17.tar.bz2
fi
tar -xjf "$ASR_TAR" -C "$ASSETS"

M="$ASSETS/sherpa-onnx-streaming-zipformer-en-20M-2023-02-17"
cp -f "$M/encoder-epoch-99-avg-1.int8.onnx" "$ASSETS/transducer-encoder.onnx"
cp -f "$M/decoder-epoch-99-avg-1.onnx"      "$ASSETS/transducer-decoder.onnx"
cp -f "$M/joiner-epoch-99-avg-1.int8.onnx"  "$ASSETS/transducer-joiner.onnx"
cp -f "$M/tokens.txt"                       "$ASSETS/tokens.txt"

echo "Assets staged in $ASSETS :"
ls -lh "$ASSETS"
