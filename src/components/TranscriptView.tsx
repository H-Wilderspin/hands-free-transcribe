import { useEffect, useRef, useState } from 'react';
import { useTranscriptStore } from '../state/transcriptStore';
import { useSpeakersStore } from '../state/speakersStore';

export function TranscriptView() {
  const segments = useTranscriptStore((s) => s.segments);
  const partial = useTranscriptStore((s) => s.partial);
  const trimmed = useTranscriptStore((s) => s.trimmed);
  const profiles = useSpeakersStore((s) => s.profiles);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);

  // Auto-scroll: follow only when the user is at/near the bottom.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !atBottom) return;
    el.scrollTop = el.scrollHeight;
  }, [segments, partial, atBottom]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setAtBottom(nearBottom);
  };

  const jumpToLatest = () => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    setAtBottom(true);
  };

  const isEmpty = segments.length === 0 && !partial;

  return (
    <div className="transcript-wrap">
      <div className="transcript-scroll" ref={scrollRef} onScroll={onScroll}>
        {isEmpty ? (
          <div className="transcript-empty">Enable your voice profile in settings to begin</div>
        ) : (
          <>
            {trimmed && (
              <div className="trim-divider">— earlier text trimmed —</div>
            )}
            {segments.map((seg) => {
              const profile = profiles.find((p) => p.id === seg.speakerId);
              return (
                <p key={seg.id} style={{ color: profile?.color ?? '#9ca3af' }} className="line">
                  {seg.text}
                </p>
              );
            })}
            {partial && (
              <p className="line partial" style={{ color: '#6b7280' }}>
                {partial}
              </p>
            )}
          </>
        )}
      </div>
      {!atBottom && (
        <button className="jump-latest" onClick={jumpToLatest}>
          jump to latest ↓
        </button>
      )}
    </div>
  );
}
