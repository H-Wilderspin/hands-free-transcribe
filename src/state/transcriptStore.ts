import { create } from 'zustand';

export interface TranscriptSegment {
  id: number;
  text: string;
  speakerId: string;
}

export interface TranscriptState {
  segments: TranscriptSegment[];
  partial: string; // in-flight partial text of the current utterance
  trimmed: boolean; // true when old segments were trimmed (divider shown)
  trimmedAt: number | null; // id of the last segment present before trim
}

interface Actions {
  addFinal(text: string, speakerId: string): void;
  setPartial(text: string, speakerId: string): void;
  clearPartial(): void;
  clear(): void;
}

const MAX_CHARS = 25000;
const TRIM_TO = 20000;

let nextId = 1;

export const useTranscriptStore = create<TranscriptState & Actions>((set) => ({
  segments: [],
  partial: '',
  trimmed: false,
  trimmedAt: null,

  addFinal(text: string, speakerId: string) {
    if (!text.trim()) return;
    set((state) => {
      const segments = [...state.segments, { id: nextId++, text, speakerId }];
      const totalChars = segments.reduce((n, s) => n + s.text.length, 0);
      let trimmed = state.trimmed;
      let trimmedAt = state.trimmedAt;
      if (totalChars > MAX_CHARS) {
        let removeCount = 0;
        let removed = 0;
        while (removeCount < segments.length - 1 && removed < totalChars - TRIM_TO) {
          removed += segments[removeCount].text.length;
          removeCount++;
        }
        const kept = segments.slice(removeCount);
        trimmed = true;
        trimmedAt = kept[0]?.id ?? null;
        return { segments: kept, trimmed, trimmedAt };
      }
      return { segments };
    });
  },

  setPartial(text: string, _speakerId: string) {
    set({ partial: text });
  },

  clearPartial() {
    set({ partial: '' });
  },

  clear() {
    set({ segments: [], partial: '', trimmed: false, trimmedAt: null });
  },
}));
