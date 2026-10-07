// Live transcription pipeline: mic → VAD → speaker verify → ASR → transcript.
//
// With Plan B (diarization oracle), verification runs per completed VAD
// segment BEFORE transcription, so non-enrolled audio never reaches ASR.
//
// The ASR stream is a persistent streaming recognizer fed continuously from
// the mic (true word-level partials). Verification gates which committed
// segments are rendered.

import type { SpeakerEngine, VadEngine, AsrEngine, SpeechSegment } from '../engine/types';
import type { MicCapture } from '../audio/capture';
import { tryRunCommand } from '../commands/commandRegistry';
import { showToast } from '../components/toast';
import { useTranscriptStore } from '../state/transcriptStore';
import { useSettingsStore } from '../state/settingsStore';
import type { StoredSpeakerProfile } from '../db/speakerProfileRepo';

const SHOW_ALL = new URLSearchParams(window.location.search).has('showAll');
const IDLE_CLEAR_MS = 60 * 60 * 1000; // 60-min idle auto-clear (plan: session limits)

export interface LivePipelineDeps {
  mic: MicCapture;
  vad: () => Promise<VadEngine>;
  asr: () => Promise<AsrEngine>;
  speaker: () => Promise<SpeakerEngine>;
  getProfiles: () => StoredSpeakerProfile[];
}

export class LivePipeline {
  private deps: LivePipelineDeps;
  private running = false;
  private vad: VadEngine | null = null;
  private asrStream: Awaited<ReturnType<AsrEngine['createStream']>> | null = null;
  private pollTimer: number | null = null;
  private lastSpeechAt = Date.now();

  constructor(deps: LivePipelineDeps) {
    this.deps = deps;
  }

  get isRunning(): boolean {
    return this.running;
  }

  async start(): Promise<void> {
    if (this.running) return;

    const vad = await this.deps.vad();
    this.vad = vad;
    const asrEngine = await this.deps.asr();
    this.asrStream = asrEngine.createStream();

    await this.deps.mic.start((samples) => {
      void vad.accept(samples).then(() => vad.drainSegments()).then((segments) => {
        for (const seg of segments) {
          void this.handleSegment(seg);
        }
      });
    });

    this.running = true;
    useSettingsStore.getState().setMicHot(true);

    // Periodic ASR poll: pulls audio into the recognizer and updates partials.
    this.pollTimer = window.setInterval(() => {
      void this.pollOnce();
    }, 100);
  }

  private async pollOnce(): Promise<void> {
    if (!this.asrStream || !this.running) return;
    try {
      const { partial, final } = await this.asrStream.poll();
      if (final !== null) {
        this.lastSpeechAt = Date.now();
        this.commitFinal(final);
      } else if (partial) {
        this.lastSpeechAt = Date.now();
        useTranscriptStore.getState().setPartial(partial, this.currentSpeakerId() ?? '');
      }
      // 60-min idle auto-clear (session-only transcript).
      if (Date.now() - this.lastSpeechAt > IDLE_CLEAR_MS) {
        useTranscriptStore.getState().clear();
        this.lastSpeechAt = Date.now();
      }
    } catch (err) {
      console.warn('[pipeline] poll error', err);
    }
  }

  /** Commit a final utterance: intercept commands, else append as transcript. */
  private commitFinal(final: string): void {
    if (tryRunCommand(final)) {
      showToast(`✓ command executed: "${final.trim()}"`);
      useTranscriptStore.getState().clearPartial();
      return;
    }
    const profiles = this.deps.getProfiles();
    const active = profiles.find((p) => p.active);
    const prefix = active?.name ? `${active.name}: ` : '';
    useTranscriptStore.getState().addFinal(prefix + final, active?.id ?? '');
    useTranscriptStore.getState().clearPartial();
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    if (this.pollTimer !== null) {
      window.clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.asrStream?.close();
    this.asrStream = null;
    void this.vad?.close();
    this.vad = null;
    this.deps.mic.stop();
    useSettingsStore.getState().setMicHot(false);
  }

  private async handleSegment(seg: SpeechSegment): Promise<void> {
    if (!this.running) return;

    const profiles = this.deps.getProfiles();
    if (profiles.length === 0) return;

    // Plan B verify: compare against each active profile's reference audio.
    const speakerEngine = await this.deps.speaker();
    let bestId: string | null = null;
    let bestScore = 0;

    for (const p of profiles) {
      if (!p.referenceSamples || p.referenceSamples.length === 0) continue;
      const engine = speakerEngine as SpeakerEngine & {
        verifyAgainstReference?(segment: Float32Array, ref: Float32Array): Promise<number>;
      };
      if (typeof engine.verifyAgainstReference !== 'function') continue;
      const score = await engine.verifyAgainstReference(seg.samples, p.referenceSamples);
      if (score > bestScore) {
        bestScore = score;
        bestId = p.id;
      }
    }

    const matched = bestId !== null && bestScore >= 1;

    if (!matched) {
      if (SHOW_ALL) {
        // Debug mode: render unknown speech grey/italic.
        useTranscriptStore.getState().addFinal(`[unknown]: ${await this.transcribe(seg)}`, 'unknown');
      }
      return; // silently ignore (spec)
    }

    const profile = profiles.find((p) => p.id === bestId)!;
    if (!profile.active) return; // inactive pill => not shown

    const text = await this.transcribe(seg);
    if (text) {
      this.commitSegmentText(text, profile);
    }
  }

  private async transcribe(seg: SpeechSegment): Promise<string> {
    // Offline decode of the whole segment in its own stream (Plan B latency
    // model: verification already ran; transcription is one decode pass).
    const asrEngine = await this.deps.asr();
    const stream = asrEngine.createStream();
    stream.accept(seg.samples);
    let partial = '';
    let final: string | null = null;
    for (let i = 0; i < 5; i++) {
      const r = await stream.poll();
      partial = r.partial || partial;
      if (r.final !== null) {
        final = r.final;
        break;
      }
    }
    stream.close();
    return final ?? partial;
  }

  private commitSegmentText(text: string, profile: StoredSpeakerProfile): void {
    if (tryRunCommand(text)) {
      showToast(`✓ command executed: "${text.trim()}"`);
      return;
    }
    const prefix = profile.name ? `${profile.name}: ` : '';
    useTranscriptStore.getState().addFinal(prefix + text, profile.id);
    useTranscriptStore.getState().clearPartial();
  }

  private currentSpeakerId(): string | null {
    const profiles = this.deps.getProfiles();
    const active = profiles.find((p) => p.active);
    return active?.id ?? null;
  }
}
