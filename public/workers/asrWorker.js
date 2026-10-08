// ASR worker: boots the vendored sherpa-onnx ASR wasm and serves
// createStream/accept/poll/reset/close requests. One stream at a time.
//
// Classic worker (importScripts-capable). Loaded from /sherpa/workers/.

'use strict';

importScripts('/sherpa/sherpa-onnx-asr.js');

let mod = null;
let recognizer = null;
let stream = null;

function handle(msg) {
  const { id, type } = msg;
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
        if (stream) {
          try { stream.free(); } catch { /* already freed */ }
        }
        stream = recognizer.createStream();
        postMessage({ id, ok: true, payload: {} });
        break;
      }
      case 'accept': {
        if (!stream) throw new Error('no active stream');
        stream.acceptWaveform(16000, msg.payload.samples);
        while (recognizer.isReady(stream)) recognizer.decode(stream);
        postMessage({ id, ok: true, payload: {} });
        break;
      }
      case 'poll': {
        if (!stream) throw new Error('no active stream');
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
        if (!stream) throw new Error('no active stream');
        recognizer.reset(stream);
        postMessage({ id, ok: true, payload: {} });
        break;
      }
      case 'close': {
        if (stream) {
          stream.free();
          stream = null;
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
