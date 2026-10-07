import { useEffect, useRef, useState } from 'react';
import { TranscriptView } from './components/TranscriptView';
import { SettingsPanel } from './components/SettingsPanel';
import { useSettingsStore } from './state/settingsStore';
import { useTranscriptStore } from './state/transcriptStore';
import { registerCommand } from './commands/commandRegistry';
import { loadProfiles } from './db/speakerProfileRepo';
import { useSpeakersStore } from './state/speakersStore';
import type { StoredSpeakerProfile } from './db/speakerProfileRepo';
import { MicCaptureImpl, type MicCapture } from './audio/capture';
import { EnrollmentFlow } from './flows/enrollment';
import { LivePipeline } from './pipelines/livePipeline';

const USE_REAL_ENGINES = true; // flip to false for UI-only dev with mocks

export default function App() {
  const togglePanel = useSettingsStore((s) => s.togglePanel);

  const [engineError, setEngineError] = useState<string | null>(null);
  const [enginesReady, setEnginesReady] = useState(false);

  const micRef = useRef<MicCapture | null>(null);
  const enrollmentRef = useRef<EnrollmentFlow | null>(null);
  const pipelineRef = useRef<LivePipeline | null>(null);

  const micHot = useSettingsStore((s) => s.micHot);

  // Wire the "command clear" voice command.
  useEffect(() => {
    registerCommand({
      phrase: 'clear',
      aliases: ['clear the text', 'clear screen'],
      run: () => useTranscriptStore.getState().clear(),
    });
  }, []);

  // Load persisted speaker profiles.
  useEffect(() => {
    void (async () => {
      const profiles = await loadProfiles();
      useSpeakersStore.getState().setProfiles(profiles);
    })();
  }, []);

  // Initialize engines (deferred: only needed once profiles exist or user acts).
  useEffect(() => {
    if (!USE_REAL_ENGINES) {
      setEnginesReady(true);
      return;
    }
    // Engines are heavy (80+ MB); boot lazily on first use, not at startup.
    setEnginesReady(true); // UI shell is usable immediately
  }, []);

  const toggleListening = async () => {
    const store = useSettingsStore.getState();
    if (pipelineRef.current?.isRunning) {
      pipelineRef.current.stop();
      return;
    }
    try {
      if (!micRef.current) micRef.current = new MicCaptureImpl();
      if (!pipelineRef.current) {
        pipelineRef.current = await createLivePipeline();
      }
      await pipelineRef.current.start();
      store.setView('transcript');
    } catch (err) {
      setEngineError(err instanceof Error ? err.message : String(err));
    }
  };

  const startEnrollment = async (): Promise<EnrollmentFlow> => {
    if (!micRef.current) micRef.current = new MicCaptureImpl();
    const mic = micRef.current;
    const flow = new EnrollmentFlow(
      async () => {
        const { createSherpaVadEngine } = await import('./engine/sherpa/vad');
        return createSherpaVadEngine({ wasmDir: '/sherpa' });
      },
      async () => {
        const { SherpaDiarizationSpeakerEngine } = await import('./engine/sherpa/speaker');
        const e = new SherpaDiarizationSpeakerEngine();
        await e.init({ wasmDir: '/sherpa' });
        return e;
      },
      mic,
    );
    enrollmentRef.current = flow;
    return flow;
  };

  const createLivePipeline = async (): Promise<LivePipeline> => {
    const mic = micRef.current ?? new MicCaptureImpl();
    micRef.current = mic;
    return new LivePipeline({
      mic,
      vad: async () => {
        const { createSherpaVadEngine } = await import('./engine/sherpa/vad');
        return createSherpaVadEngine({ wasmDir: '/sherpa' });
      },
      asr: async () => {
        const { createSherpaAsrEngine } = await import('./engine/sherpa/asr');
        return createSherpaAsrEngine({ wasmDir: '/sherpa' });
      },
      speaker: async () => {
        const { SherpaDiarizationSpeakerEngine } = await import('./engine/sherpa/speaker');
        const e = new SherpaDiarizationSpeakerEngine();
        await e.init({ wasmDir: '/sherpa' });
        return e;
      },
      getProfiles: () => useSpeakersStore.getState().profiles as StoredSpeakerProfile[],
    });
  };

  return (
    <div className="app-shell">
      <div className="top-bar">
        <button
          className="listen-toggle"
          onClick={toggleListening}
          title={pipelineRef.current?.isRunning ? 'Stop listening' : 'Start listening'}
        >
          {micHot ? '■ stop' : '▶ listen'}
        </button>
        <span className={`mic-indicator-pill ${micHot ? 'on' : ''}`}>
          <span className={`pulse-dot ${micHot ? 'on' : ''}`} />
        </span>
        <button className="settings-btn" onClick={togglePanel} title="Settings">
          ⚙
        </button>
        {enginesReady ? null : <span className="loading-note">loading engines…</span>}
      </div>

      <TranscriptView />

      <SettingsPanel
        onStartEnrollment={startEnrollment}
        mic={micRef.current}
        engineError={engineError}
      />
    </div>
  );
}
