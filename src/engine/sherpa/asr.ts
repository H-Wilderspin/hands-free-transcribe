// Streaming ASR engine backed by the sherpa-onnx ASR worker.
//
// The worker supports multiple named streams; the live pipeline holds a
// persistent stream (for word-level partials) while per-segment decodes use
// short-lived uniquely-named streams.

import { type AsrEngine, type AsrStream, type AsrResult, type EngineAssets } from '../types';
import { EngineWorker } from './engineWorker';

let streamCounter = 0;

export async function createSherpaAsrEngine(_assets: EngineAssets): Promise<AsrEngine> {
  const worker = new EngineWorker('asr');
  await worker.call('init');

  return {
    async init(): Promise<void> {},
    createStream(): AsrStream {
      const name = `s${++streamCounter}`;
      let buffer: Float32Array[] = [];
      let closed = false;
      void worker.call('createStream', { name });

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
            await worker.call('accept', { name, samples: merged }, [merged.buffer]);
          }
          return (await worker.call('poll', { name })) as AsrResult;
        },
        reset() {
          buffer = [];
          void worker.call('reset', { name });
        },
        close() {
          closed = true;
          void worker.call('close', { name });
        },
      };
    },
    async close(): Promise<void> {
      await worker.call('closeAll').catch(() => undefined);
      worker.terminate();
    },
  };
}
