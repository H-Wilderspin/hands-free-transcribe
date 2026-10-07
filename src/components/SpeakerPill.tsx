import { useState } from 'react';
import { useSpeakersStore } from '../state/speakersStore';

export function SpeakerPill({ id }: { id: string }) {
  const profile = useSpeakersStore((s) => s.profiles.find((p) => p.id === id));
  const toggleActive = useSpeakersStore((s) => s.toggleActive);
  const [armDelete, setArmDelete] = useState(false);

  if (!profile) return null;

  const onDelete = () => {
    if (!armDelete) {
      setArmDelete(true);
      // Auto-disarm after 3s so it never stays armed by accident.
      window.setTimeout(() => setArmDelete(false), 3000);
      return;
    }
    useSpeakersStore.getState().removeProfile(id);
  };

  return (
    <div
      className={`pill ${profile.active ? 'pill-active' : 'pill-inactive'}`}
      style={{ background: profile.color }}
    >
      <button
        className="pill-toggle"
        title={profile.active ? 'Active — click to deactivate' : 'Inactive — click to activate'}
        onClick={() => toggleActive(id)}
      >
        {profile.name || 'Me'}
      </button>
      <button
        className={`pill-delete ${armDelete ? 'armed' : ''}`}
        title={armDelete ? 'Click again to confirm deletion' : 'Delete (click twice)'}
        onClick={onDelete}
      >
        ×
      </button>
    </div>
  );
}
