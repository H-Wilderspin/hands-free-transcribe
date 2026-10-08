// ASR worker: boots the vendored sherpa-onnx ASR wasm and serves
// createStream/accept/poll/reset/close requests. Supports multiple named
// streams: the live pipeline holds a persistent stream while per-segment
// decodes use their own short-lived streams.
//
// Classic worker (importScripts-capable). Loaded from /workers/.

'use strict';

importScripts('/sherpa/sherpa-onnx-asr.js');

let mod = null;
let recognizer = null;
const streams = new Map(); // name -> sherpa stream

function handle(msg) {
  const { id, type, payload } = msg;
  const name = payload?.name ?? 'default';
  try {
    switch (type) {
      case 'init': {
        self.Module = {
          locateFile: (p) => '/sherpa/' + p,
          print: (t) => console.log('[sherpa-asr]', t),
          printErr: (t) => console.warn('[sherpa-asr]', t),
          onRuntimeInitialized: () => {
            recognizer = createOnlineRecognizer(self.Module, {
              featConfig: { sampleRate: 16000, featureDim: 80 },
              modelConfig: {
                transducer: {
                  encoder: './encoder.onnx',
                  decoder: './decoder.onnx',
                  joiner: './joiner.onnx',
                },
                tokens: './tokens.txt',
                numThreads: 1,
                provider: 'cpu',
                debug: 0,
                modelType: '',
                modelingUnit: 'cjkchar',
                bpeVocab: '',
              },
              decodingMethod: 'greedy_search',
              maxActivePaths: 4,
              enableEndpoint: 1,
              rule1MinTrailingSilence: 2.4,
              rule2MinTrailingSilence: 1.2,
              rule3MinUtteranceLength: 20,
              hotwordsFile: '',
              hotwordsScore: 1.5,
              ctcFstDecoderConfig: { graph: '', maxActive: 3000 },
              ruleFsts: '',
              ruleFars: '',
            });
            postMessage({ id, ok: true, payload: { ready: true } });
          },
        };
        importScripts('/sherpa/sherpa-onnx-wasm-main-asr.js');
        mod = self.Module;
        return; // completes via onRuntimeInitialized
      }
      case 'createStream': {
        if (!recognizer) throw new Error('ASR engine not initialized');
        const old = streams.get(name);
        if (old) {
          try { old.free(); } catch { /* already freed */ }
        }
        streams.set(name, recognizer.createStream());
        postMessage({ id, ok: true, payload: {} });
        break;
      }
      case 'accept': {
        const stream = streams.get(name);
        if (!stream) throw new Error(`no active stream: ${name}`);
        stream.acceptWaveform(16000, payload.samples);
        while (recognizer.isReady(stream)) recognizer.decode(stream);
        postMessage({ id, ok: true, payload: {} });
        break;
      }
      case 'poll': {
        const stream = streams.get(name);
        if (!stream) throw new Error(`no active stream: ${name}`);
        const text = recognizer.getResult(stream).text;
        if (recognizer.isEndpoint(stream)) {
          recognizer.reset(stream);
          postMessage({ id, ok: true, payload: { partial: '', final: text.length > 0 ? text : null } });
        } else {
          postMessage({ id, ok: true, payload: { partial: text, final: null } });
        }
        break;
      }
      case 'reset': {
        const stream = streams.get(name);
        if (!stream) throw new Error(`no active stream: ${name}`);
        recognizer.reset(stream);
        postMessage({ id, ok: true, payload: {} });
        break;
      }
      case 'close': {
        const stream = streams.get(name);
        if (stream) {
          stream.free();
          streams.delete(name);
        }
        postMessage({ id, ok: true, payload: {} });
        break;
      }
      case 'closeAll': {
        for (const [n, s] of streams) {
          try { s.free(); } catch { /* already freed */ }
          streams.delete(n);
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
