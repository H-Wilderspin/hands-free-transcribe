# Plan-A WASM build (custom sherpa-onnx with speaker-embedding APIs)

This builds a custom sherpa-onnx WebAssembly module that exports the
`SpeakerEmbeddingExtractor` APIs — the prebuilt upstream bundles don't
export them (verified in `wasm/wasm-common.cmake`). With these APIs the app
can compute real voiceprints in the browser: enrollment becomes a ~200ms
embedding computation and live speaker verification ~50–100ms per segment,
replacing the Plan-B diarization oracle (~1–3s per segment, re-processing
the whole reference audio every time).

## What's in here

| File | Purpose |
|---|---|
| `vad-asr-cmake.patch` | Adds the 14 embedding APIs to the vad-asr module's export list |
| `wasm-common.patch` | Same addition for the shared export list (kept for completeness) |
| `prepare-build-assets.ps1` | Downloads + stages model files with canonical names |
| `build-plan-a.sh` | Runs cmake+ninja against emsdk |
| `stage-plan-a-output.ps1` | Copies build output into the app's `public/sherpa/` |

## One-time setup on a build machine

```powershell
# 1. emsdk (the exact version matters — sherpa-onnx pins 4.0.23)
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk
.\emsdk.bat install 4.0.23
.\emsdk.bat activate 4.0.23
cd ..

# 2. cmake + ninja (or use portable zips from GitHub releases)
winget install Kitware.CMake Ninja-build.Ninja

# 3. dependency tarballs (hash-verified, cached to ~/Downloads)
powershell -File ..\scripts\fetch-build-deps.ps1
```

## Per-build flow

```bash
# clone sherpa-onnx (any recent master; v1.13.x era is fine)
git clone --depth 1 https://github.com/k2-fsa/sherpa-onnx.git
cd sherpa-onnx
git apply <path-to-app-repo>\build-wasm\vad-asr-cmake.patch

# stage model assets (from the app repo)
powershell -File ..\build-wasm\prepare-build-assets.ps1 .

# build (from Git Bash, with emsdk env sourced)
source <emsdk-path>\emsdk_env.sh
EMSCRIPTEN=<emsdk-path>\upstream\emscripten bash <app-repo>\build-wasm\build-plan-a.sh .

# stage the output into the app
cd ..
powershell -File build-wasm\stage-plan-a-output.ps1 sherpa-onnx
```

## Verification

After staging, run the app's smoke tests — the embedding worker boots the
custom module and extracts an embedding from synthetic audio:

```
node tests\embed-smoke.mjs
```

Then re-run the app: enrollment should be near-instant and live
transcription latency should drop to ~1s per utterance.

## Known issues (this machine, 2026-10-08)

- Building on the corporate laptop fails at CMake's `file(RENAME)` during
  dependency extraction — "Access is denied" from endpoint security locking
  freshly extracted files. Workaround: build on the other laptop.
- Dependency tarballs are fetched to `~/Downloads` where CMake's
  `possible_file_locations` checks first; names must match what each
  `.cmake` file expects (see `fetch-build-deps.ps1`).
