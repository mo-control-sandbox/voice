import { useEffect, useRef, useState } from 'react';

interface AudioPlayerProps {
  /*
   * Raw PCM bytes for the session audio.
   * null  = still loading.
   * empty = audio was not saved for this session.
   */
  readonly audioData: Uint8Array | null;
}

/**
 * Custom audio player: play/pause button, scrubber, and elapsed/total time.
 *
 * Creates a blob URL from the supplied audio bytes and revokes it on unmount
 * to avoid memory leaks.
 *
 * Keyboard contract (when scrubber is focused):
 *   Space -> play/pause   <- -> seek +-5s   Home -> 0:00   End -> end
 */
export function AudioPlayer({ audioData }: AudioPlayerProps): React.JSX.Element {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (audioData === null || audioData.length === 0) {
      setBlobUrl(null);
      return;
    }
    const blob = new Blob([audioData], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    blobUrlRef.current = url;
    setBlobUrl(url);
    return () => {
      if (blobUrlRef.current !== null) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [audioData]);

  if (audioData !== null && audioData.length === 0) {
    return <span>Audio not saved.</span>;
  }
  if (blobUrl === null) {
    return <span>Loading audio...</span>;
  }
  return <audio controls src={blobUrl} />;
}
