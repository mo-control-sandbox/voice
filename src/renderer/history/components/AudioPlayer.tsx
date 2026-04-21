import { useEffect, useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';
import './AudioPlayer.css';

interface AudioPlayerProps {
  /*
   * Raw PCM bytes for the session audio.
   * null  = still loading.
   * empty = audio was not saved for this session.
   */
  readonly audioData: Uint8Array | null;
}

/** Formats seconds as m:ss (e.g. "3:07"). */
function formatTime(seconds: number): string {
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m)}:${String(s).padStart(2, '0')}`;
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
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
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
      audioRef.current?.pause();
      if (blobUrlRef.current !== null) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [audioData]);

  function handleAudioRef(el: HTMLAudioElement | null): void {
    if (el === null) return;
    audioRef.current = el;

    el.addEventListener('timeupdate', () => { setCurrentTime(el.currentTime); });
    el.addEventListener('durationchange', () => { setDuration(el.duration); });
    el.addEventListener('play',  () => { setIsPlaying(true);  });
    el.addEventListener('pause', () => { setIsPlaying(false); });
    el.addEventListener('ended', () => { setIsPlaying(false); setCurrentTime(0); });
  }

  function togglePlay(): void {
    const audio = audioRef.current;
    if (audio === null) return;
    if (isPlaying) { audio.pause(); } else { void audio.play(); }
  }

  function handleScrubberChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const audio = audioRef.current;
    if (audio === null) return;
    const time = Number(e.target.value);
    audio.currentTime = time;
    setCurrentTime(time);
  }

  /** Additional keyboard shortcuts while the scrubber is focused. */
  function handleScrubberKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    const audio = audioRef.current;
    if (audio === null) return;

    if (e.key === ' ') {
      e.preventDefault();
      togglePlay();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      audio.currentTime = Math.max(0, audio.currentTime - 5);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      audio.currentTime = Math.min(audio.duration, audio.currentTime + 5);
    } else if (e.key === 'Home') {
      e.preventDefault();
      audio.currentTime = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      audio.currentTime = audio.duration;
    }
  }

  if (audioData !== null && audioData.length === 0) {
    return <p className="audio-player--empty">Audio not saved for this session.</p>;
  }

  if (blobUrl === null) {
    return <p className="audio-player--empty">Loading audio…</p>;
  }

  const fillPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <>
      {/* Hidden <audio> element — all state driven via JS */}
      <audio
        ref={handleAudioRef}
        src={blobUrl}
        preload="metadata"
        aria-hidden="true"
      />

      <div className="audio-player" role="group" aria-label="Audio playback">
        {/* Play / Pause */}
        <button
          className="audio-player__play"
          onClick={togglePlay}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          disabled={duration === 0}
        >
          {isPlaying
            ? <Pause className="audio-player__play-icon" aria-hidden="true" />
            : <Play  className="audio-player__play-icon" aria-hidden="true" />}
        </button>

        {/* Elapsed */}
        <span className="audio-player__time" aria-hidden="true">
          {formatTime(currentTime)}
        </span>

        {/* Scrubber */}
        <div className="audio-player__scrubber">
          <input
            type="range"
            className="audio-player__range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={currentTime}
            onChange={handleScrubberChange}
            onKeyDown={handleScrubberKeyDown}
            aria-label="Seek"
            aria-valuemin={0}
            aria-valuemax={Math.floor(duration)}
            aria-valuenow={Math.floor(currentTime)}
            aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
          />
          <div className="audio-player__track" aria-hidden="true">
            <div
              className="audio-player__fill"
              style={{ width: `${String(fillPercent)}%` }}
            />
          </div>
        </div>

        {/* Total */}
        <span className="audio-player__time" aria-hidden="true">
          {formatTime(duration)}
        </span>
      </div>
    </>
  );
}
