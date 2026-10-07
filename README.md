# Hands-free Transcribe

Real-time, fully on-device voice-to-text with speaker identification.
No cloud services, no subscriptions — everything runs locally in your browser
(soon: as an Android app via Capacitor).

## Status

Web app MVP working in the browser (Chrome/Edge on Windows). Android build
requires JDK 17 + Android SDK (see `docs/android-notes.md`).

## Quick start

```powershell
npm install
powershell -File scripts\download-models.ps1   # one-time: fetch wasm + models (~215MB)
npm run dev
```

Open http://localhost:5173, allow mic access when prompted.

## Usage

1. Click **⚙** to open the settings panel.
2. Click **+** to enroll a voice: read the passage aloud. Once ≥15s of
   speech is captured (across ≥3 segments), the profile is saved automatically
   and a pill appears. First profile: grey "Me". Later ones: auto-named
   `Speaker N` with an auto-assigned palette color.
3. Close the panel, click **▶ listen**. Speak — enrolled voices appear in the
   transcript in their pill's color, prefixed `Name:`.
4. Voice commands (spoken, always evaluated, never rendered as text):
   - **"Command clear"** — clear the transcript
   - **"Command pause"** — pause rendering (mic stays hot; commands still work)
   - **"Command resume"** — resume rendering
5. Pills:
   - **Click the pill** to toggle active/inactive (bright = on, dull = off)
   - **✎** opens the editor: rename (e.g. `Michael`) + pick from an
     8-color high-contrast palette; transcript text follows the color
   - **×** deletes — requires two clicks within 3s (no accidental deletes)
6. Mic test: tick **mic test** for a live level meter (hardware check only).

## Privacy

- Audio never leaves the device.
- Voice signatures (enrollment audio) are stored in IndexedDB on this device only.
- Transcript text is session-only (cleared on refresh, 25k char cap, 60-min idle clear).

## Tech notes

- **sherpa-onnx** WASM (Apache-2.0): streaming zipformer EN ASR, silero VAD,
  and — for speaker ID (Plan B) — the offline speaker-diarization module used
  as a same-voice oracle. The prebuilt browser WASM does not export
  speaker-embedding APIs, so enrollment audio is stored and segments are
  verified by re-running diarization over `[reference, segment]` with 2
  clusters. Plan A (custom wasm build exposing embedding APIs) is the
  intended future upgrade.
- React 19 + TypeScript + Vite; zustand for state; IndexedDB (idb-keyval) for
  speaker persistence.
- Mic capture: getUserMedia + ScriptProcessorNode @16kHz mono (sherpa demo
  pattern; AudioWorklet migration is a contained refactor behind
  `MicCapture`).

## Known MVP limitations

- Speaker verification adds 1–3s latency per utterance (Plan B oracle).
- Plan A (custom wasm build exposing real speaker-embedding APIs) is the
  intended upgrade — see `docs/` and the architecture notes in `src/engine/`.
- Android build: see `docs/android-notes.md` (needs JDK 17 + Android SDK; and
  `@capacitor/*` allowlisted in the npm registry — see `docs/android-notes.md`).

## Setup on a new machine

```powershell
npm install
powershell -File scripts\download-models.ps1   # ~250MB wasm + models, one-time
npm run dev
```

Tests (need the dev server running):

```powershell
node tests\vad-smoke.mjs
node tests\asr-smoke.mjs   # downloads/loads the 182MB ASR model
node tests\sd-smoke.mjs
node tests\ui-e2e.mjs      # pill edit/persist/delete flows
```
