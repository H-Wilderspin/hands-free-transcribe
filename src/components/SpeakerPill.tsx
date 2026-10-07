import { useState } from 'react';
import { useSpeakersStore } from '../state/speakersStore';

// High-contrast-on-dark palette (WCAG AA on #0b0e14; grey is the MVP default).
const PALETTE: Array<{ name: string; hex: string }> = [
  { name: 'grey', hex: '#9ca3af' },
  { name: 'amber', hex: '#fbbf24' },
  { name: 'green', hex: '#4ade80' },
  { name: 'cyan', hex: '#22d3ee' },
  { name: 'blue', hex: '#60a5fa' },
  { name: 'violet', hex: '#a78bfa' },
  { name: 'pink', hex: '#f472b6' },
  { name: 'red', hex: '#f87171' },
];

export function SpeakerPill({ id }: { id: string }) {
  const profile = useSpeakersStore((s) => s.profiles.find((p) => p.id === id));
  const toggleActive = useSpeakersStore((s) => s.toggleActive);
  const renameProfile = useSpeakersStore((s) => s.renameProfile);
  const setProfileColor = useSpeakersStore((s) => s.setProfileColor);

  const [editing, setEditing] = useState(false);
  const [armed, setArmed] = useState(false);
  const [draftName, setDraftName] = useState('');

  if (!profile) return null;

  const onDelete = () => {
    if (!armed) {
      setArmed(true);
      window.setTimeout(() => setArmed(false), 3000); // auto-disarm: no accidental deletes
      return;
    }
    useSpeakersStore.getState().removeProfile(id);
  };

  const commitRename = () => {
    const name = draftName.trim();
    if (name) renameProfile(id, name);
    setEditing(false);
  };

  return (
    <div
      className={`pill ${profile.active ? 'pill-active' : 'pill-inactive'}`}
      style={{ background: profile.color, color: '#111' }}
    >
      <button
        className="pill-toggle"
        title={profile.active ? 'Active — click to deactivate' : 'Inactive — click to activate'}
        onClick={() => toggleActive(id)}
      >
        {profile.name || 'Me'}
      </button>
      <button
        className="pill-edit"
        title="Edit name / color"
        onClick={() => {
          setDraftName(profile.name ?? '');
          setEditing(!editing);
        }}
      >
        ✎
      </button>
      <button
        className={`pill-delete ${armed ? 'armed' : ''}`}
        title={armed ? 'Click again to confirm deletion' : 'Delete (click twice)'}
        onClick={onDelete}
      >
        ×
      </button>

      {editing && (
        <div className="pill-editor" onClick={(e) => e.stopPropagation()}>
          <input
            className="pill-name-input"
            value={draftName}
            placeholder="Name (e.g. Michael)"
            autoFocus
            onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') setEditing(false);
            }}
          />
          <div className="palette-row">
            {PALETTE.map((c) => (
              <button
                key={c.hex}
                className={`swatch ${profile.color === c.hex ? 'selected' : ''}`}
                style={{ background: c.hex }}
                title={c.name}
                onClick={() => {
                  setProfileColor(id, c.hex);
                  setEditing(false);
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
