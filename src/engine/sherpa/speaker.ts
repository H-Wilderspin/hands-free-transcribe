// Speaker identification engine backed by the sherpa-onnx diarization worker
// (Plan B: same-voice oracle over [reference, segment]).

import type { EngineAssets, SpeakerEngine } from '../types';
import { EngineWorker } from './engineWorker';

export class SherpaDiarizationSpeakerEngine implements SpeakerEngine {
  private worker: EngineWorker | null = null;

  async init(_assets: EngineAssets): Promise<void> {
    this.worker = new EngineWorker('sd');
    await this.worker.call('init');
  }

  async embed(segment: Float32Array): Promise<Float32Array> {
    // Plan B: no raw embeddings available; placeholder for interface compat.
    return new Float32Array([segment.length]);
  }

  /**
   * True Plan B check: is this segment the same voice as the enrollment
   * reference audio? Returns pseudo-similarity in [0,1].
   */
  async verifyAgainstReference(segment: Float32Array, referenceSamples: Float32Array): Promise<number> {
    if (!this.worker) throw new Error('speaker engine not initialized');
    // Copy before transfer: the reference is reused on every call, and
    // transferring detaches the buffer in the caller's realm.
    const segCopy = segment.slice();
    const refCopy = referenceSamples.slice();
    const res = (await this.worker.call(
      'verify',
      { segment: segCopy, reference: refCopy },
      [segCopy.buffer, refCopy.buffer],
    )) as { score: number };
    return res.score;
  }

  verify(_embedding: Float32Array, _profileCentroid: Float32Array): number {
    // Plan B does not use centroids; the pipeline calls verifyAgainstReference.
    throw new Error('Plan B: use verifyAgainstReference(segment, referenceAudio)');
  }

  async close(): Promise<void> {
    if (this.worker) {
      await this.worker.call('close');
      this.worker.terminate();
      this.worker = null;
    }
  }
}
