# Plan-A WASM build (custom sherpa-onnx with speaker-embedding APIs)

This builds a custom sherpa-onnx WebAssembly module that exports the
`SpeakerEmbeddingExtractor` APIs — the prebuilt upstream bundles don't
export them (verified in `wasm/wasm-common.cmake`). With these APIs the app
can compute real voiceprints in the browser: enrollment becomes a ~200ms
embedding computation and live speaker verification ~50–100ms per segment,
replacing the Plan-B diarization oracle (~1–3s per segment, re-processing
the whole reference audio every time).

All commands below are **bash** (Git Bash on Windows).

## What's in here

| File | Purpose |
|---|---|
| `vad-asr-cmake.patch` | Adds the 14 embedding APIs to the vad-asr module's export list |
| `wasm-common.patch` | Same addition for the shared export list (kept for completeness) |
| `prepare-build-assets.sh` | Downloads + stages model files with canonical names |
| `fetch-build-deps.sh` | Pre-fetches + hash-verifies all dependency tarballs to `~/Downloads` |
| `build-plan-a.sh` | Runs cmake+ninja against emsdk |
| `stage-plan-a-output.sh` | Copies build output into the app's `public/sherpa/` |

## One-time setup on a build machine

```bash
# 1. emsdk (the exact version matters — sherpa-onnx pins 4.0.23)
#    Put it OUTSIDE the project; anywhere is fine, e.g. C:/Users/hazel.wilderspin/source/emsdk
git clone https://github.com/emscripten-core/emsdk.git C:/Users/hazel.wilderspin/source/emsdk
cd C:/Users/hazel.wilderspin/source/emsdk
./emsdk.bat install 4.0.23          # or: ./emsdk install 4.0.23 in Git Bash
./emsdk.bat activate 4.0.23
source ./emsdk_env.sh               # makes EMSCRIPTEN + emcc available

# 2. cmake + ninja (Git Bash)
winget install Kitware.CMake Ninja-build.Ninja
# ...or download portable zips from GitHub releases and add their bin/ to PATH

# 3. Suggested workspace layout (all outside the app repo):
#   C:/Users/hazel.wilderspin/source/emsdk          <- emsdk
#   C:/Users/hazel.wilderspin/source/sherpa-onnx    <- source clone
#   C:/Users/hazel.wilderspin/source/hands-free-transcribe  <- the app (git clone)
```

## Per-build flow

```bash
cd C:/Users/hazel.wilderspin/source
git clone --depth 1 https://github.com/k2-fsa/sherpa-onnx.git
cd sherpa-onnx

# apply the export-list patch
git apply C:/Users/hazel.wilderspin/source/hands-free-transcribe/build-wasm/vad-asr-cmake.patch

# stage model assets + prefetch dependency tarballs
bash C:/Users/hazel.wilderspin/source/hands-free-transcribe/build-wasm/prepare-build-assets.sh .
bash C:/Users/hazel.wilderspin/source/hands-free-transcribe/build-wasm/fetch-build-deps.sh .

# build (emsdk env must be sourced — re-run `source C:/Users/hazel.wilderspin/source/emsdk/emsdk_env.sh`
# in each new shell)
export EMSCRIPTEN=C:/Users/hazel.wilderspin/source/emsdk/upstream/emscripten
bash C:/Users/hazel.wilderspin/source/hands-free-transcribe/build-wasm/build-plan-a.sh .

# stage the built artifacts into the app
cd C:/Users/hazel.wilderspin/source/hands-free-transcribe
bash build-wasm/stage-plan-a-output.sh ../sherpa-onnx
```

## Verification

After staging, run the app's smoke tests — the embedding worker boots the
custom module and extracts an embedding from synthetic audio:

```bash
cd C:/Users/hazel.wilderspin/source/hands-free-transcribe
npm run dev            # in one shell
node tests/embed-smoke.mjs   # in another
```

Then re-run the app: enrollment should be near-instant and live
transcription latency should drop to ~1s per utterance.

## Known issues (this machine, 2026-10-08)

- Building on the corporate laptop fails at CMake's `file(RENAME)` during
  dependency extraction — "Access is denied" from endpoint security locking
  freshly extracted files. Workaround: build on the other laptop.
- Dependency tarballs are fetched to `~/Downloads` where CMake's
  `possible_file_locations` checks first; names must match what each
  `.cmake` file expects (see `fetch-build-deps.sh`).
- If CMake extraction still fails on a given dep, extract the tarball
  manually into `build-wasm-simd-vad-asr/_deps/` and pass
  `-DFETCHCONTENT_SOURCE_DIR_<DEP_UPPER>=<path>` to cmake.
