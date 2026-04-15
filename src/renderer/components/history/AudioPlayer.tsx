import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import { MicOff } from 'lucide-react';
import { ipc } from '@/gen/ipc';

interface AudioPlayerProps {
  /** Session ID of the recording to play. */
  readonly sessionId: string
  /** True when no audio was saved for this session. */
  readonly disabled: boolean
}

/**
 * Compact audio player for a recorded session.
 *
 * When not disabled, fetches the `file://` URL from the main process on mount
 * and renders a native `<audio controls>` element. When disabled, renders the
 * element grayed out with a "no audio saved" label overlay.
 */
export function AudioPlayer({ sessionId, disabled }: AudioPlayerProps): JSX.Element {
  const [audioUrl, setAudioUrl] = useState<string>('');

  useEffect(() => {
    if (disabled) return;
    ipc.history.GetAudioUrl({ sessionId })
      .then((response) => { setAudioUrl(response.value); })
      .catch((err: unknown) => { console.error('[AudioPlayer] GetAudioUrl error:', err); });
  }, [sessionId, disabled]);

  return (
    <div className="relative">
      <audio
        controls
        src={audioUrl !== '' ? audioUrl : undefined}
        className={`w-full h-10 ${disabled ? 'opacity-40 pointer-events-none' : ''}`}
      />
      {disabled && (
        <div className="absolute inset-0 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <MicOff className="w-3.5 h-3.5" />
          No audio saved
        </div>
      )}
    </div>
  );
}
