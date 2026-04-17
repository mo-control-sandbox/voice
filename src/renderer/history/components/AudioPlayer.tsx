import { useEffect, useRef, useState } from 'react';
import { ipc } from '../../gen/ipc';

interface AudioPlayerProps {
  readonly sessionId: string;
}

/**
 * Loads the audio for a session and renders an HTML audio element.
 *
 * Shows a "not saved" placeholder when the session has no associated audio.
 * A blob URL is created on mount and revoked on unmount to avoid leaks.
 */
export function AudioPlayer({ sessionId }: AudioPlayerProps): React.JSX.Element {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [notSaved, setNotSaved] = useState(false);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    void ipc.history.GetAudioData({ id: sessionId }).then((response) => {
      if (response.audioData.length === 0) {
        setNotSaved(true);
        return;
      }
      const blob = new Blob([new Uint8Array(response.audioData)], { type: 'audio/wav' });
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
  }, [sessionId]);

  if (notSaved) {
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
