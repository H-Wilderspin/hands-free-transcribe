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
2. Click **+** to enroll your voice: read the passage aloud. Once ≥15s of
   speech is captured (across ≥3 segments), the profile is saved automatically
   and a grey pill appears.
3. Close the panel, click **▶ listen**. Speak — your words appear in the
   transcript in your pill's color, prefixed `Me:`.
4. Voice commands (spoken):
   - **"Command clear"** — clear the transcript (brief toast confirms).
5. Pills: click a pill to toggle active/inactive (bright = on, dull = off).
   Deletion requires a double-click confirm (no accidental deletes).

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

- Single enrolled speaker expected; multi-speaker UI (colors, names) is
  scaffolded but not exposed.
- Speaker verification adds 1–3s latency per utterance (Plan B).
- Enrolled-but-silent detection (e.g. you stop speaking) is not shown.
