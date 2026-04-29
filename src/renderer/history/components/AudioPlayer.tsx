import { useEffect, useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';
import './AudioPlayer.css';

interface AudioPlayerProps {
  /*
   * Raw WAV bytes for the session audio.
   * null  = still loading from IPC.
   * empty = audio was not saved for this session.
   */
  readonly audioData: Uint8Array | null;
}

/** Formats seconds as m:ss with zero-padded seconds. Returns "--:--" for non-finite input. */
function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return '--:--';
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m)}:${String(s).padStart(2, '0')}`;
}

/**
 * Custom audio player with play/pause, scrubber, and time display.
 *
 * Creates a blob URL from the supplied audio bytes and revokes it on unmount.
 * The scrubber uses an invisible range input over a visual fill bar -- this
 * keeps the scrubber keyboard-accessible while allowing full styling control.
 *
 * Keyboard contract (when scrubber is focused):
 *   ArrowLeft / ArrowRight -- seek -/+5 s
 *   Home                   -- seek to 0:00
 *   End                    -- seek to end
 */
export function AudioPlayer({ audioData }: AudioPlayerProps): React.JSX.Element {
  const audioRef   = useRef<HTMLAudioElement>(null);
  const blobUrlRef = useRef<string | null>(null);
  const [blobUrl, setBlobUrl]       = useState<string | null>(null);
  const [isPlaying, setIsPlaying]     = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration]       = useState(0);
  const [isUnplayable, setIsUnplayable] = useState(false);

  useEffect(() => {
    if (audioData === null || audioData.length === 0) {
      setBlobUrl(null);
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      setIsUnplayable(false);
      return;
    }
    setIsUnplayable(false);
    // Copy into a plain ArrayBuffer so Blob constructor gets the concrete type it requires.
    const view = new Uint8Array(audioData.byteLength);
    view.set(audioData);
    const blob = new Blob([view], { type: 'audio/wav' });
    const url  = URL.createObjectURL(blob);
    blobUrlRef.current = url;
    setBlobUrl(url);
    return () => {
      if (blobUrlRef.current !== null) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [audioData]);

  function togglePlayback(): void {
    const audio = audioRef.current;
    if (audio === null) return;
    if (isPlaying) {
      audio.pause();
    } else {
      void audio.play();
    }
  }

  function handleScrubberChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const audio = audioRef.current;
    if (audio === null) return;
    const time = parseFloat(e.target.value);
    audio.currentTime = time;
    setCurrentTime(time);
  }

  function handleScrubberKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    const audio = audioRef.current;
    if (audio === null) return;
    if (e.key === 'ArrowLeft')  { audio.currentTime = Math.max(0, audio.currentTime - 5); e.preventDefault(); }
    if (e.key === 'ArrowRight') { audio.currentTime = Math.min(duration, audio.currentTime + 5); e.preventDefault(); }
    if (e.key === 'Home')       { audio.currentTime = 0; e.preventDefault(); }
    if (e.key === 'End')        { audio.currentTime = duration; e.preventDefault(); }
  }

  const isNotSaved    = audioData !== null && audioData.length === 0;
  const isUnavailable = isNotSaved || isUnplayable;
  const isDisabled    = blobUrl === null || isUnplayable;
  const progress      = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="audio-player">
      {/* Hidden audio element -- drives all playback state. */}
      {blobUrl !== null && (
        <audio
          ref={audioRef}
          src={blobUrl}
          onPlay={() => { setIsPlaying(true); }}
          onPause={() => { setIsPlaying(false); }}
          onEnded={() => { setIsPlaying(false); setCurrentTime(0); }}
          onTimeUpdate={() => { setCurrentTime(audioRef.current?.currentTime ?? 0); }}
          onLoadedMetadata={() => {
            const d = audioRef.current?.duration ?? 0;
            if (Number.isFinite(d)) { setDuration(d); } else { setIsUnplayable(true); }
          }}
          onError={() => { setIsUnplayable(true); }}
        />
      )}

      <button
        type="button"
        className="audio-player__play"
        onClick={togglePlayback}
        aria-label={isPlaying ? 'Pause' : 'Play'}
        disabled={isDisabled}
      >
        {isPlaying
          ? <Pause className="audio-player__play-icon" aria-hidden="true" />
          : <Play  className="audio-player__play-icon" aria-hidden="true" />
        }
      </button>

      <span className="audio-player__time">{formatTime(currentTime)}</span>

      {isUnavailable
        ? <span className="audio-player__unavailable">{isUnplayable ? 'Audio unavailable' : 'Audio not saved'}</span>
        : (
          <div className="audio-player__scrubber">
            <input
              type="range"
              className="audio-player__range"
              min={0}
              max={duration || 0}
              step={0.01}
              value={currentTime}
              aria-label="Seek"
              disabled={isDisabled}
              onChange={handleScrubberChange}
              onKeyDown={handleScrubberKeyDown}
            />
            <div className="audio-player__track">
              <div className="audio-player__fill" style={{ width: `${String(progress)}%` }} />
            </div>
          </div>
        )
      }

      <span className="audio-player__time">{formatTime(duration)}</span>
    </div>
  );
}
