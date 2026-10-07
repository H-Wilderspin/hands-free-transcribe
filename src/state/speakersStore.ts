import { create } from 'zustand';
import type { SpeakerProfile } from '../engine/types';

export interface SpeakersState {
  profiles: SpeakerProfile[];
  addProfile(p: SpeakerProfile): void;
  toggleActive(id: string): void;
  removeProfile(id: string): void;
  setProfiles(profiles: SpeakerProfile[]): void;
}

export const useSpeakersStore = create<SpeakersState>((set) => ({
  profiles: [],

  addProfile(p) {
    set((state) => ({ profiles: [...state.profiles, p] }));
  },

  toggleActive(id) {
    set((state) => ({
      profiles: state.profiles.map((p) => (p.id === id ? { ...p, active: !p.active } : p)),
    }));
  },

  removeProfile(id) {
    set((state) => ({ profiles: state.profiles.filter((p) => p.id !== id) }));
  },

  setProfiles(profiles) {
    set({ profiles });
  },
}));
