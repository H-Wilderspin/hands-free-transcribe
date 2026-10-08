// Speaker-diarization worker (Plan B oracle): boots the vendored
// speaker-diarization wasm and serves verify(segment, reference) requests.
//
// Classic worker. Loaded from /sherpa/workers/.

'use strict';

importScripts('/sherpa/sherpa-onnx-speaker-diarization.js');

let mod = null;
let sd = null;

function handle(msg) {
  const { id, type } = msg;
  try {
    switch (type) {
      case 'init': {
        self.Module = {
          locateFile: (p) => '/sherpa/' + p,
          print: (t) => console.log('[sherpa-sd]', t),
          printErr: (t) => console.warn('[sherpa-sd]', t),
          onRuntimeInitialized: () => {
            sd = createOfflineSpeakerDiarization(self.Module, {
              segmentation: {
                pyannote: { model: '/segmentation.onnx', windowShiftRatio: 0.1 },
                numThreads: 1,
                debug: 0,
                provider: 'cpu',
              },
              embedding: {
                model: '/embedding.onnx',
                numThreads: 1,
                debug: 0,
                provider: 'cpu',
              },
              clustering: { numClusters: 2, threshold: 0.5 },
              minDurationOn: 0.3,
              minDurationOff: 0.5,
            });
            postMessage({ id, ok: true, payload: { ready: true } });
          },
        };
        importScripts('/sherpa/sherpa-onnx-wasm-main-speaker-diarization.js');
        mod = self.Module;
        return; // completes via onRuntimeInitialized
      }
      case 'verify': {
        if (!sd) throw new Error('diarization engine not initialized');
        const { segment, reference } = msg.payload;
        const score = computeSameSpeakerScore(sd, segment, reference);
        postMessage({ id, ok: true, payload: { score } });
        break;
      }
      case 'close': {
        if (sd) {
          sd.free();
          sd = null;
        }
        postMessage({ id, ok: true, payload: {} });
        break;
      }
      default:
        throw new Error(`unknown message type: ${type}`);
    }
  } catch (err) {
    postMessage({ id, ok: false, error: err instanceof Error ? err.message : String(err) });
  }
}

function computeSameSpeakerScore(sd, segment, reference) {
  const refDur = reference.length / 16000;
  const segDur = segment.length / 16000;
  if (segDur < 0.5) return 0;

  const combined = new Float32Array(reference.length + segment.length);
  combined.set(reference, 0);
  combined.set(segment, reference.length);

  const segments = sd.process(combined);

  // Label covering most of the reference window = the enrolled voice.
  const labelVotes = new Map();
  for (const s of segments) {
    const overlap = Math.max(0, Math.min(s.end, refDur) - Math.min(s.start, refDur));
    if (overlap > 0) labelVotes.set(s.speaker, (labelVotes.get(s.speaker) ?? 0) + overlap);
  }
  if (labelVotes.size === 0) return 0;

  let refLabel = -1;
  let refVotes = 0;
  for (const [label, votes] of labelVotes) {
    if (votes > refVotes) {
      refLabel = label;
      refVotes = votes;
    }
  }
  const refCoverage = refVotes / refDur;
  if (refCoverage < 0.5) return 0;

  let segVotes = 0;
  for (const s of segments) {
    if (s.speaker !== refLabel) continue;
    const overlap = Math.max(0, Math.min(s.end, refDur + segDur) - refDur);
    if (overlap > 0) segVotes += overlap;
  }
  const segCoverage = segVotes / segDur;
  return segCoverage >= 0.6 ? 1 : segCoverage > 0.3 ? 0.5 : 0;
}

self.onmessage = (e) => handle(e.data);
