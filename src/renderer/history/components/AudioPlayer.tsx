import { useEffect, useRef, useState } from 'react';
import { ipc } from '../../gen/ipc';

interface AudioPlayerProps {
  readonly sessionId: string;
  readonly disabled: boolean;
}

/**
 * Loads the audio for a session and renders an HTML audio element.
 *
 * When `disabled` is true the player is rendered but non-functional,
 * indicating that no audio was saved for the session (§4.15).
 *
 * A blob URL is created on mount and revoked on unmount to avoid leaks.
 */
export function AudioPlayer({ sessionId, disabled }: AudioPlayerProps): React.JSX.Element {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (disabled) return;

    void ipc.history.GetAudioData({ id: sessionId }).then((response) => {
      const blob = new Blob([response.audioData], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      blobUrlRef.current = url;
      setBlobUrl(url);
    });

    return () => {
      if (blobUrlRef.current !== null) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [sessionId, disabled]);

  if (disabled) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Audio not saved for this session.</span>
      </div>
    );
  }

  if (blobUrl === null) {
    return <p className="text-sm text-muted-foreground">Loading audio…</p>;
  }

  return (
    <audio
      controls
      src={blobUrl}
      className="w-full"
    />
  );
}
