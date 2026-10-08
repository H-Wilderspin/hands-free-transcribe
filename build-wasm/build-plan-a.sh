#!/usr/bin/env bash
# Plan-A build: sherpa-onnx WASM (vad-asr) with speaker-embedding APIs exported.
#
# Prerequisites (one-time):
#   1. emsdk 4.0.23 installed + activated:
#        git clone https://github.com/emscripten-core/emsdk.git
#        cd emsdk && ./emsdk.bat install 4.0.23 && ./emsdk.bat activate 4.0.23
#        (from Git Bash: source emsdk_env.sh)
#   2. cmake >= 3.22 and ninja on PATH (winget install Kitware.CMake Ninja-build.Ninja)
#   3. Dependencies pre-fetched: run scripts/fetch-build-deps.ps1 from the app repo
#      (places verified tarballs in ~/Downloads; cmake finds them there)
#   4. Models staged into wasm/vad-asr/assets (see ../scripts/prepare-build-assets.ps1)
#
# Usage (from this directory):
#   bash build-plan-a.sh /path/to/sherpa-onnx-src
#
# Output: <sherpa-onnx-src>/build-wasm-simd-vad-asr/install/bin/wasm/vad-asr/
#   sherpa-onnx-wasm-main-asr.{js,wasm,data} + glue scripts
#   -> copy into the app's public/sherpa/ (see ../scripts/stage-plan-a-output.ps1)
set -ex

SRC=${1:?usage: bash build-plan-a.sh /path/to/sherpa-onnx-src}
cd "$SRC"

if [ x"$EMSCRIPTEN" == x"" ]; then
  if ! command -v emcc &> /dev/null; then
    echo "ERROR: emsdk not active. Run 'source /path/to/emsdk/emsdk_env.sh' first."
    exit 1
  fi
fi

cmake --version | head -1

mkdir -p build-wasm-simd-vad-asr
pushd build-wasm-simd-vad-asr

export SHERPA_ONNX_IS_USING_BUILD_WASM_SH=ON

cmake \
  -DCMAKE_INSTALL_PREFIX=./install \
  -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_TOOLCHAIN_FILE=$EMSCRIPTEN/cmake/Modules/Platform/Emscripten.cmake \
  -G Ninja \
  \
  -DSHERPA_ONNX_ENABLE_PYTHON=OFF \
  -DSHERPA_ONNX_ENABLE_TESTS=OFF \
  -DSHERPA_ONNX_ENABLE_CHECK=OFF \
  -DBUILD_SHARED_LIBS=OFF \
  -DSHERPA_ONNX_ENABLE_PORTAUDIO=OFF \
  -DSHERPA_ONNX_ENABLE_JNI=OFF \
  -DSHERPA_ONNX_ENABLE_TTS=OFF \
  -DSHERPA_ONNX_ENABLE_C_API=ON \
  -DSHERPA_ONNX_ENABLE_WEBSOCKET=OFF \
  -DSHERPA_ONNX_ENABLE_GPU=OFF \
  -DSHERPA_ONNX_ENABLE_WASM=ON \
  -DSHERPA_ONNX_ENABLE_WASM_VAD_ASR=ON \
  -DSHERPA_ONNX_ENABLE_BINARY=OFF \
  -DSHERPA_ONNX_LINK_LIBSTDCPP_STATICALLY=OFF \
  ..
ninja -j 4
ninja install

popd

# Shared JS wrappers (same as upstream build script)
cp -fv wasm/vad/sherpa-onnx-vad.js build-wasm-simd-vad-asr/install/bin/wasm/vad-asr/
cp -fv wasm/asr/sherpa-onnx-asr.js build-wasm-simd-vad-asr/install/bin/wasm/vad-asr/

echo ""
echo "BUILD OK. Artifacts in: $SRC/build-wasm-simd-vad-asr/install/bin/wasm/vad-asr/"
ls -lh build-wasm-simd-vad-asr/install/bin/wasm/vad-asr/
