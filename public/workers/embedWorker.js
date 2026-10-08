// Embedding worker: boots the vendored sherpa-onnx ASR wasm (custom Plan-A
// build) and serves embed(segment) requests using the exported
// SpeakerEmbeddingExtractor APIs. Fast (~50-100ms per segment vs the
// diarization oracle's 1-3s).
//
// Classic worker. Loaded from /workers/.

'use strict';

importScripts('/sherpa/sherpa-onnx-asr.js');

let mod = null;
let extractor = null;
let embedDim = 0;

function handle(msg) {
  const { id, type, payload } = msg;
  try {
    switch (type) {
      case 'init': {
        self.Module = {
          locateFile: (p) => '/sherpa/' + p,
          print: (t) => console.log('[sherpa-embed]', t),
          printErr: (t) => console.warn('[sherpa-embed]', t),
          onRuntimeInitialized: () => {
            const mod = self.Module;
            const cfgPtr = mod.SherpaOnnxCreateSpeakerEmbeddingExtractorConfig
              ? null : null; // config struct is created via the JS helper below
            // The C API expects a SherpaOnnxSpeakerEmbeddingExtractorConfig
            // struct: { model: char*, numThreads: int32, debug: int32, provider: char* }
            const modelPath = stringToPtr(mod, '/embedding.onnx');
            const provider = stringToPtr(mod, 'cpu');
            const structLen = 4 * 4; // ptr + int + int + ptr
            const cfg = mod._malloc(structLen);
            mod.setValue(cfg + 0, modelPath, 'i8*');
            mod.setValue(cfg + 4, 1, 'i32'); // numThreads
            mod.setValue(cfg + 8, 0, 'i32'); // debug
            mod.setValue(cfg + 12, provider, 'i8*');

            extractor = mod._SherpaOnnxCreateSpeakerEmbeddingExtractor(cfg);
            embedDim = mod._SherpaOnnxSpeakerEmbeddingExtractorDim(extractor);

            mod._free(cfg);
            mod._free(modelPath.ptr);
            mod._free(provider.ptr);

            if (!extractor) throw new Error('failed to create speaker embedding extractor');
            postMessage({ id, ok: true, payload: { ready: true, dim: embedDim } });
          },
        };
        importScripts('/sherpa/sherpa-onnx-wasm-main-asr.js');
        mod = self.Module;
        return; // completes via onRuntimeInitialized
      }
      case 'embed': {
        if (!extractor) throw new Error('embedding extractor not initialized');
        const mod = self.Module;
        const samples = payload.samples;
        const stream = mod._SherpaOnnxSpeakerEmbeddingExtractorCreateStream(extractor);
        const ptr = mod._malloc(samples.length * 4);
        mod.HEAPF32.set(samples, ptr / 4);
        mod._SherpaOnnxOnlineStreamAcceptWaveform(stream, 16000, ptr, samples.length);
        mod._free(ptr);
        mod._SherpaOnnxOnlineStreamInputFinished(stream);

        if (!mod._SherpaOnnxSpeakerEmbeddingExtractorIsReady(extractor, stream)) {
          mod._SherpaOnnxDestroyOnlineStream(stream);
          postMessage({ id, ok: true, payload: { embedding: null, reason: 'not enough audio' } });
          return;
        }

        const embPtr = mod._SherpaOnnxSpeakerEmbeddingExtractorComputeEmbedding(extractor, stream);
        const embedding = new Float32Array(embedDim);
        for (let i = 0; i < embedDim; i++) embedding[i] = mod.HEAPF32[embPtr / 4 + i];
        mod._SherpaOnnxSpeakerEmbeddingExtractorDestroyEmbedding(embPtr);
        mod._SherpaOnnxDestroyOnlineStream(stream);

        postMessage({ id, ok: true, payload: { embedding } }, [embedding.buffer]);
        break;
      }
      case 'close': {
        if (extractor) {
          mod._SherpaOnnxDestroySpeakerEmbeddingExtractor(extractor);
          extractor = null;
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

function stringToPtr(mod, s) {
  const len = mod.lengthBytesUTF8(s) + 1;
  const ptr = mod._malloc(len);
  mod.stringToUTF8(s, ptr, len);
  return { ptr, len };
}

self.onmessage = (e) => handle(e.data);
