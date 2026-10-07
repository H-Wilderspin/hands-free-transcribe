// Engine interfaces — the seam between the UI/pipeline layer and the
// sherpa-onnx backend. Backends: sherpa/* (real) and noop (UI dev mocks).

export const SAMPLE_RATE = 16000;
export const VAD_WINDOW_SIZE = 512; // samples per VAD window (32ms @ 16kHz)

export interface EngineAssets {
  // URLs (or paths) of wasm glue + models; resolved by the loader.
  wasmDir: string;
}

export interface SpeechSegment {
  samples: Float32Array; // 16kHz mono
  startSample: number;    // absolute position in the capture timeline
}

// --- ASR ------------------------------------------------------------------

export interface AsrResult {
  partial: string;
  final: string | null; // set once when an endpoint is hit; consumed by caller
}

export interface AsrStream {
  /** Buffer audio (16kHz mono f32); flushed to the engine on poll(). */
  accept(samples: Float32Array): void;
  /** Flush buffered audio, decode, and return current partial/final state. */
  poll(): Promise<AsrResult>;
  reset(): void;
  close(): void;
}

export interface AsrEngine {
  init(assets: EngineAssets): Promise<void>;
  createStream(): AsrStream;
}

// --- Speaker identification -------------------------------------------------

export interface SpeakerProfile {
  id: string;
  name: string; // display name; default "Me" for the first profile
  color: string; // transcript text color; default grey
  active: boolean; // inactive => matched but filtered from display
  createdAt: number;
}

export interface SpeakerEngine {
  init(assets: EngineAssets): Promise<void>;
  /** Embed a speech segment (or reference audio) into a speaker vector. */
  embed(segment: Float32Array): Promise<Float32Array>;
  /** Cosine similarity of `embedding` against a stored voiceprint centroid. */
  verify(embedding: Float32Array, profileCentroid: Float32Array): number;
  /** Release engine resources (optional — mock engines may not need it). */
  close?(): Promise<void>;
}

// --- VAD --------------------------------------------------------------------

export interface VadEngine {
  init(assets: EngineAssets): Promise<void>;
  /** Feed raw mic samples (any length); buffered to VAD windows internally. */
  accept(samples: Float32Array): Promise<void>;
  /** Drain completed speech segments since the last call. */
  drainSegments(): Promise<SpeechSegment[]>;
  close(): Promise<void>;
}
