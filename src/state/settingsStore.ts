import { create } from 'zustand';

export type AppView = 'transcript' | 'enrollment';

interface SettingsState {
  panelOpen: boolean;
  view: AppView;
  micHot: boolean; // true whenever capture is running (enrollment or live)
  levelMeter: boolean; // mic test mode on/off
  togglePanel(): void;
  setView(v: AppView): void;
  setMicHot(hot: boolean): void;
  setLevelMeter(on: boolean): void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  panelOpen: false,
  view: 'transcript',
  micHot: false,
  levelMeter: false,
  togglePanel() {
    set((s) => ({ panelOpen: !s.panelOpen }));
  },
  setView(v) {
    set({ view: v });
  },
  setMicHot(hot) {
    set({ micHot: hot });
  },
  setLevelMeter(on) {
    set({ levelMeter: on });
  },
}));
