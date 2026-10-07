// Enrollment flow: capture the user reading a passage, accumulate ≥15s of
// speech across ≥3 VAD segments, then auto-save a voiceprint under the hood.

import type { SpeakerEngine, VadEngine } from '../engine/types';
import type { MicCapture } from '../audio/capture';
import { saveProfile } from '../db/speakerProfileRepo';
import { useSpeakersStore } from '../state/speakersStore';
import { useSettingsStore } from '../state/settingsStore';
import type { StoredSpeakerProfile } from '../db/speakerProfileRepo';

export const ENROLL_TARGET_SECONDS = 15;
export const ENROLL_MIN_SEGMENTS = 3;

export type EnrollmentPhase =
  | 'idle'
  | 'capturing' // mic on, passage shown, accumulating
  | 'finalizing'; // computing + saving profile

export interface EnrollmentProgress {
  phase: EnrollmentPhase;
  seconds: number; // accumulated speech seconds
  segments: number; // accumulated VAD segments
}

type Listener = (p: EnrollmentProgress) => void;

export class EnrollmentFlow {
  private listener: Listener | null = null;
  private speechSeconds = 0;
  private segCount = 0;
  private referenceChunks: Float32Array[] = [];
  private phase: EnrollmentPhase = 'idle';

  private makeVad: () => Promise<VadEngine>;
  private makeSpeaker: () => Promise<SpeakerEngine>;
  private mic: MicCapture;

  constructor(
    makeVad: () => Promise<VadEngine>,
    makeSpeaker: () => Promise<SpeakerEngine>,
    mic: MicCapture,
  ) {
    this.makeVad = makeVad;
    this.makeSpeaker = makeSpeaker;
    this.mic = mic;
  }

  onProgress(listener: Listener): void {
    this.listener = listener;
  }

  private emit(): void {
    this.listener?.({
      phase: this.phase,
      seconds: this.speechSeconds,
      segments: this.segCount,
    });
  }

  get isRunning(): boolean {
    return this.phase !== 'idle';
  }

  async start(): Promise<void> {
    if (this.phase !== 'idle') return;
    this.phase = 'capturing';
    this.speechSeconds = 0;
    this.segCount = 0;
    this.referenceChunks = [];

    try {
      const vad = await this.makeVad();
      await this.makeSpeaker(); // warm engine (worker boot)
      await this.mic.start((samples) => {
        void vad
          .accept(samples)
          .then(() => vad.drainSegments())
          .then((segments) => {
            for (const seg of segments) {
              this.onSpeechSegment(seg.samples);
            }
          });
      });
      useSettingsStore.getState().setMicHot(true);
      this.emit();
    } catch (err) {
      this.phase = 'idle';
      useSettingsStore.getState().setMicHot(false);
      throw err;
    }
  }

  private onSpeechSegment(samples: Float32Array): void {
    if (this.phase !== 'capturing') return;
    const dur = samples.length / 16000;
    if (dur < 0.3) return;

    this.speechSeconds += dur;
    this.segCount += 1;
    this.referenceChunks.push(samples);
    this.emit();

    if (this.speechSeconds >= ENROLL_TARGET_SECONDS && this.segCount >= ENROLL_MIN_SEGMENTS) {
      void this.finalize();
    }
  }

  private async finalize(): Promise<void> {
    this.phase = 'finalizing';
    this.emit();

    // Stop capture.
    this.mic.stop();
    useSettingsStore.getState().setMicHot(false);

    // Concatenate the reference audio.
    const total = this.referenceChunks.reduce((n, c) => n + c.length, 0);
    const reference = new Float32Array(total);
    let off = 0;
    for (const c of this.referenceChunks) {
      reference.set(c, off);
      off += c.length;
    }

    const profile: StoredSpeakerProfile = {
      id: `sp-${Date.now()}`,
      name: 'Me',
      color: '#9ca3af', // default grey pill
      active: true,
      createdAt: Date.now(),
      referenceSamples: reference,
    };

    await saveProfile(profile);
    useSpeakersStore.getState().addProfile(profile);

    this.phase = 'idle';
    this.emit();
  }

  /** User-initiated abort (e.g. closing the panel mid-enrollment). */
  cancel(): void {
    if (this.phase === 'idle') return;
    this.mic.stop();
    this.phase = 'idle';
    useSettingsStore.getState().setMicHot(false);
    this.emit();
  }
}
