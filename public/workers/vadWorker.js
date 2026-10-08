// VAD worker: boots the vendored sherpa-onnx VAD wasm and serves
// accept/drain/close requests. Buffers mic chunks into exact 512-sample
// windows (silero requirement) and returns completed speech segments.
//
// Classic worker. Loaded from /sherpa/workers/.

'use strict';

importScripts('/sherpa/sherpa-onnx-vad.js');

let mod = null;
let vad = null;

let windowBuf = new Float32Array(512);
let windowFill = 0;

function handle(msg) {
  const { id, type } = msg;
  try {
    switch (type) {
      case 'init': {
        self.Module = {
          locateFile: (p) => '/sherpa/' + p,
          print: (t) => console.log('[sherpa-vad]', t),
          printErr: (t) => console.warn('[sherpa-vad]', t),
          onRuntimeInitialized: () => {
            vad = createVad(self.Module, {
              sileroVad: {
                model: '/silero_vad.onnx',
                threshold: 0.5,
                minSilenceDuration: 0.5,
                minSpeechDuration: 0.25,
                maxSpeechDuration: 20,
                windowSize: 512,
              },
              sampleRate: 16000,
              numThreads: 1,
              provider: 'cpu',
              debug: 0,
              bufferSizeInSeconds: 30,
            });
            postMessage({ id, ok: true, payload: { ready: true } });
          },
        };
        importScripts('/sherpa/sherpa-onnx-wasm-main-vad.js');
        mod = self.Module;
        return; // completes via onRuntimeInitialized
      }
      case 'accept': {
        if (!vad) throw new Error('VAD not initialized');
        const samples = msg.payload.samples;
        let offset = 0;
        while (offset < samples.length) {
          const take = Math.min(512 - windowFill, samples.length - offset);
          windowBuf.set(samples.subarray(offset, offset + take), windowFill);
          windowFill += take;
          offset += take;
          if (windowFill === 512) {
            vad.acceptWaveform(windowBuf);
            windowBuf = new Float32Array(512);
            windowFill = 0;
          }
        }
        postMessage({ id, ok: true, payload: {} });
        break;
      }
      case 'drain': {
        if (!vad) throw new Error('VAD not initialized');
        const segments = [];
        const transfer = [];
        while (!vad.isEmpty()) {
          const seg = vad.front();
          vad.pop();
          segments.push({ samples: seg.samples, start: seg.start });
          transfer.push(seg.samples.buffer);
        }
        postMessage({ id, ok: true, payload: { segments } }, transfer);
        break;
      }
      case 'close': {
        if (vad) {
          vad.free();
          vad = null;
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

self.onmessage = (e) => handle(e.data);
