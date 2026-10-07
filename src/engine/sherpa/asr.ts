// Streaming ASR engine backed by the sherpa-onnx ASR worker.

import { type AsrEngine, type AsrStream, type AsrResult, type EngineAssets } from '../types';
import { EngineWorker } from './engineWorker';

export async function createSherpaAsrEngine(_assets: EngineAssets): Promise<AsrEngine> {
  const worker = new EngineWorker('asr');
  await worker.call('init');

  return {
    async init(): Promise<void> {},
    createStream(): AsrStream {
      let buffer: Float32Array[] = [];
      let closed = false;

      return {
        accept(samples: Float32Array) {
          if (closed) return;
          buffer.push(samples.slice());
        },
        async poll(): Promise<AsrResult> {
          if (closed) return { partial: '', final: null };
          if (buffer.length > 0) {
            const total = buffer.reduce((n, c) => n + c.length, 0);
            const merged = new Float32Array(total);
            let off = 0;
            for (const c of buffer) {
              merged.set(c, off);
              off += c.length;
            }
            buffer = [];
            await worker.call('accept', { samples: merged }, [merged.buffer]);
          }
          return (await worker.call('poll')) as AsrResult;
        },
        reset() {
          buffer = [];
          void worker.call('reset');
        },
        close() {
          closed = true;
          void worker.call('close');
        },
      };
    },
  };
}
