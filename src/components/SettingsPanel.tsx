import { useEffect, useRef, useState } from 'react';
import { useSpeakersStore } from '../state/speakersStore';
import { useSettingsStore } from '../state/settingsStore';
import { SpeakerPill } from './SpeakerPill';
import type { EnrollmentFlow, EnrollmentProgress } from '../flows/enrollment';
import type { MicCapture } from '../audio/capture';

export const READ_PASSAGE =
  'The rainbow passage begins here. When the sunlight strikes raindrops in the air, ' +
  'they act as a prism and form a rainbow. The rainbow is a division of white light ' +
  'into many beautiful colors. These take the shape of a long round arch, with its ' +
  'path high above, and its two ends apparently beyond the horizon. There is, ' +
  'according to legend, a boiling pot of gold at one end. People look, but no one ' +
  'ever finds it. When a man looks for something beyond his reach, his wife will ' +
  'often say he is on a fool\'s errand. He will never find that pot of gold, for the ' +
  'simple reason that the treasure is not there.';

interface Props {
  onStartEnrollment: () => Promise<EnrollmentFlow>;
  mic: MicCapture | null;
  engineError: string | null;
}

export function SettingsPanel({ onStartEnrollment, mic, engineError }: Props) {
  const panelOpen = useSettingsStore((s) => s.panelOpen);
  const togglePanel = useSettingsStore((s) => s.togglePanel);
  const levelMeter = useSettingsStore((s) => s.levelMeter);
  const setLevelMeter = useSettingsStore((s) => s.setLevelMeter);

  const profiles = useSpeakersStore((s) => s.profiles);

  const [flow, setFlow] = useState<EnrollmentFlow | null>(null);
  const [progress, setProgress] = useState<EnrollmentProgress>({
    phase: 'idle',
    seconds: 0,
    segments: 0,
  });

  useEffect(() => {
    if (!flow) return;
    flow.onProgress(setProgress);
  }, [flow]);

  // Level meter sampling
  const levelRef = useRef(0);
  useEffect(() => {
    if (!levelMeter) return;
    const t = window.setInterval(() => {
      levelRef.current = mic?.getLevel() ?? 0;
      const bar = document.getElementById('level-bar');
      if (bar) bar.style.width = `${Math.min(100, levelRef.current * 300)}%`;
    }, 100);
    return () => window.clearInterval(t);
  }, [levelMeter, mic]);

  const startEnrollment = async () => {
    const f = await onStartEnrollment();
    setFlow(f);
    void f.start();
  };

  const cancelEnrollment = () => {
    flow?.cancel();
    setFlow(null);
  };

  const enrolling = progress.phase !== 'idle';

  if (!panelOpen) return null;

  return (
    <div className="settings-panel">
      <div className="settings-header">
        <span>Settings</span>
        <button className="btn-close" onClick={togglePanel}>×</button>
      </div>

      {engineError && <div className="error-banner">{engineError}</div>}

      {enrolling ? (
        <div className="enroll-box">
          <div className="mic-indicator">
            <span className="pulse-dot" /> mic active
          </div>
          <p className="passage">{READ_PASSAGE}</p>
          <div className="progress-row">
            <div className="progress-track">
              <div
                className="progress-fill"
                style={{ width: `${Math.min(100, (progress.seconds / 15) * 100)}%` }}
              />
            </div>
            <span>
              {progress.seconds.toFixed(0)}s / 15s ({progress.segments} segments)
            </span>
          </div>
          <button className="btn" onClick={cancelEnrollment}>Cancel</button>
        </div>
      ) : (
        <>
          <div className="pills-row">
            {profiles.length === 0 ? (
              <span className="hint">No voice profiles yet.</span>
            ) : (
              profiles.map((p) => <SpeakerPill key={p.id} id={p.id} />)
            )}
          </div>
          <button className="btn-add" onClick={startEnrollment} title="Add a voice profile">
            +
          </button>
          <div className="meter-row">
            <label>
              <input
                type="checkbox"
                checked={levelMeter}
                onChange={(e) => setLevelMeter(e.target.checked)}
              />
              mic test (level meter)
            </label>
            {levelMeter && (
              <div className="meter-track">
                <div id="level-bar" className="meter-fill" />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
