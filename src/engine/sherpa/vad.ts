// VAD engine backed by the sherpa-onnx VAD worker.

import { VAD_WINDOW_SIZE, type VadEngine, type SpeechSegment, type EngineAssets } from '../types';
import { EngineWorker } from './engineWorker';

export async function createSherpaVadEngine(_assets: EngineAssets): Promise<VadEngine> {
  const worker = new EngineWorker('vad');
  await worker.call('init');

  let windowBuf = new Float32Array(VAD_WINDOW_SIZE);
  let windowFill = 0;

  return {
    async init(): Promise<void> {},
    async accept(samples: Float32Array): Promise<void> {
      // Buffer to exact 512-sample windows before sending (silero requires it).
      let offset = 0;
      const ready: Float32Array[] = [];
      while (offset < samples.length) {
        const take = Math.min(VAD_WINDOW_SIZE - windowFill, samples.length - offset);
        windowBuf.set(samples.subarray(offset, offset + take), windowFill);
        windowFill += take;
        offset += take;
        if (windowFill === VAD_WINDOW_SIZE) {
          ready.push(windowBuf.slice());
          windowBuf = new Float32Array(VAD_WINDOW_SIZE);
          windowFill = 0;
        }
      }
      if (ready.length > 0) {
        const merged = concatFloat32(ready);
        await worker.call('accept', { samples: merged }, [merged.buffer]);
      }
    },
    async drainSegments(): Promise<SpeechSegment[]> {
      const res = (await worker.call('drain')) as { segments: SpeechSegment[] };
      return res.segments;
    },
    async close(): Promise<void> {
      await worker.call('close');
      worker.terminate();
    },
  };
}

function concatFloat32(chunks: Float32Array[]): Float32Array {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Float32Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}
