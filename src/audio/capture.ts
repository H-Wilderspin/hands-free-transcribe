// Mic capture: getUserMedia → 16kHz mono Float32 chunks via ScriptProcessor
// (matches the sherpa-onnx browser demos; AudioWorklet migration later behind
// the same interface).

import { SAMPLE_RATE } from '../engine/types';

export interface MicCapture {
  /** Starts capture; calls onChunk with 16k mono Float32 chunks. */
  start(onChunk: (samples: Float32Array) => void): Promise<void>;
  /** Disconnects the processing node but keeps the stream (fast restart). */
  pause(): void;
  /** Reconnects after pause(). */
  resume(): void;
  /** Fully stops: tears down nodes, stream, and AudioContext. */
  stop(): void;
  /** Current RMS level in [0,1] — for the settings-panel level meter. */
  getLevel(): number;
  readonly active: boolean;
}

export class MicPermissionError extends Error {}

export class MicCaptureImpl implements MicCapture {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private level = 0;
  private chunkHandler: ((samples: Float32Array) => void) | null = null;

  async start(onChunk: (samples: Float32Array) => void): Promise<void> {
    this.chunkHandler = onChunk;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
    } catch (err) {
      throw new MicPermissionError(
        err instanceof Error ? `Mic access denied or unavailable: ${err.message}` : 'Mic access denied',
      );
    }

    this.ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
    await this.ctx.resume().catch(() => undefined);

    this.source = this.ctx.createMediaStreamSource(this.stream);
    this.processor = this.ctx.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (e) => {
      const input = e.inputBuffer.getChannelData(0);
      const samples = new Float32Array(input);

      // RMS level for the meter
      let sum = 0;
      for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
      this.level = Math.sqrt(sum / samples.length);

      this.chunkHandler?.(samples);
    };

    this.source.connect(this.processor);
    // ScriptProcessor requires a destination connection to pump; use a zero-gain
    // node to avoid echo/feedback.
    const sink = this.ctx.createGain();
    sink.gain.value = 0;
    this.processor.connect(sink);
    sink.connect(this.ctx.destination);
  }

  pause(): void {
    if (this.processor && this.source) {
      this.processor.disconnect();
      this.source.disconnect();
    }
  }

  resume(): void {
    if (this.processor && this.source && this.ctx) {
      const sink = this.ctx.createGain();
      sink.gain.value = 0;
      this.processor.disconnect();
      this.source.disconnect();
      this.source.connect(this.processor);
      this.processor.connect(sink);
      sink.connect(this.ctx.destination);
    }
  }

  stop(): void {
    this.processor?.disconnect();
    this.source?.disconnect();
    this.stream?.getTracks().forEach(t => t.stop());
    void this.ctx?.close();
    this.processor = null;
    this.source = null;
    this.stream = null;
    this.ctx = null;
    this.level = 0;
    this.chunkHandler = null;
  }

  getLevel(): number {
    return this.level;
  }

  get active(): boolean {
    return this.ctx !== null;
  }
}
