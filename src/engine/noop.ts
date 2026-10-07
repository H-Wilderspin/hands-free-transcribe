import type { AsrEngine, AsrStream, AsrResult, SpeakerEngine, VadEngine, SpeechSegment } from './types';

// Mock engines for UI development without wasm/models. NoopASR produces fake
// partials so the transcript/pill/scrolling UI can be exercised end-to-end.

const FAKE_SENTENCES = [
  'this is a mock transcription for interface development',
  'the pill colors and scrolling can be verified without real speech',
  'command clear should still clear the fake transcript text',
];

let fakeIdx = 0;

export class NoopAsrEngine implements AsrEngine {
  async init(): Promise<void> {}

  createStream(): AsrStream {
    let accumulated = '';
    return {
      accept(samples: Float32Array) {
        // Every ~1.5s of audio, emit a fake sentence chunk.
        const seconds = samples.length / 16000;
        if (Math.random() < seconds / 1.5) {
          accumulated += (accumulated ? ' ' : '') + FAKE_SENTENCES[fakeIdx++ % FAKE_SENTENCES.length];
        }
      },
      poll(): Promise<AsrResult> {
        const words = accumulated.split(' ');
        if (words.length > 1 && Math.random() < 0.08) {
          const final = accumulated;
          accumulated = '';
          return Promise.resolve({ partial: '', final });
        }
        return Promise.resolve({ partial: accumulated, final: null });
      },
      reset() {
        accumulated = '';
      },
      close() {},
    };
  }
}

export class NoopSpeakerEngine implements SpeakerEngine {
  async init(): Promise<void> {}

  async embed(segment: Float32Array): Promise<Float32Array> {
    // Deterministic pseudo-embedding from the segment (mock only).
    let acc = 0;
    for (let i = 0; i < segment.length; i++) acc += segment[i];
    const v = new Float32Array(8);
    v[0] = acc;
    return v;
  }

  verify(): number {
    // Mock: cosine over the single accumulator dim, near-identical vectors => 1.
    return 0.9;
  }
}

export class NoopVadEngine implements VadEngine {
  private buf: Float32Array[] = [];

  async init(): Promise<void> {}

  accept(samples: Float32Array): Promise<void> {
    this.buf.push(samples.slice());
    return Promise.resolve();
  }

  drainSegments(): Promise<SpeechSegment[]> {
    if (this.buf.length === 0) return Promise.resolve([]);
    // Concatenate everything into one rolling segment (mock behavior).
    const total = this.buf.reduce((n, b) => n + b.length, 0);
    const out = new Float32Array(total);
    let off = 0;
    for (const b of this.buf) { out.set(b, off); off += b.length; }
    this.buf = [];
    return Promise.resolve([{ samples: out, startSample: 0 }]);
  }

  close(): Promise<void> {
    return Promise.resolve();
  }
}
