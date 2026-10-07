import { create } from 'zustand';
import { updateProfile, deleteProfile } from '../db/speakerProfileRepo';
import type { StoredSpeakerProfile } from '../db/speakerProfileRepo';

export interface SpeakersState {
  profiles: StoredSpeakerProfile[];
  addProfile(p: StoredSpeakerProfile): void;
  toggleActive(id: string): void;
  removeProfile(id: string): void;
  renameProfile(id: string, name: string): void;
  setProfileColor(id: string, color: string): void;
  setProfiles(profiles: StoredSpeakerProfile[]): void;
}

// Persist helpers — each mutator keeps IndexedDB in sync so a reload
// preserves names/colors/active flags (the app has no other save trigger).

export const useSpeakersStore = create<SpeakersState>((set) => ({
  profiles: [],

  addProfile(p) {
    set((state) => ({ profiles: [...state.profiles, p] }));
  },

  toggleActive(id) {
    set((state) => {
      const profiles = state.profiles.map((p) => (p.id === id ? { ...p, active: !p.active } : p));
      const p = profiles.find((x) => x.id === id);
      if (p) void updateProfile(id, { active: p.active });
      return { profiles };
    });
  },

  removeProfile(id) {
    set((state) => ({ profiles: state.profiles.filter((p) => p.id !== id) }));
    void deleteProfile(id);
  },

  renameProfile(id, name) {
    set((state) => ({
      profiles: state.profiles.map((p) => (p.id === id ? { ...p, name } : p)),
    }));
    void updateProfile(id, { name });
  },

  setProfileColor(id, color) {
    set((state) => ({
      profiles: state.profiles.map((p) => (p.id === id ? { ...p, color } : p)),
    }));
    void updateProfile(id, { color });
  },

  setProfiles(profiles) {
    set({ profiles });
  },
}));
