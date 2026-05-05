import { useEffect, useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';
import { formatPlayerClock } from '../dateTime';
import { HistoryService } from '../HistoryService';
import { HistoryAudioBlobLoader } from '../audio/HistoryAudioBlobLoader';
import './AudioPlayer.css';

interface AudioPlayerProps {
  /**
   * Session identifier whose persisted audio should be loaded.
   */
  readonly sessionId: string;
}

const historyService = new HistoryService();

/**
 * Custom audio player with play/pause, scrubber, and time display.
 */
export function AudioPlayer({ sessionId }: AudioPlayerProps): React.JSX.Element {
  const audioRef = useRef<HTMLAudioElement>(null);
  const loaderRef = useRef<HistoryAudioBlobLoader | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isUnplayable, setIsUnplayable] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasSavedAudio, setHasSavedAudio] = useState(true);

  useEffect(() => {
    loaderRef.current ??= new HistoryAudioBlobLoader(historyService);
    return () => {
      loaderRef.current?.dispose();
      loaderRef.current = null;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const previousUrl = blobUrlRef.current;
    if (previousUrl !== null) {
      URL.revokeObjectURL(previousUrl);
      blobUrlRef.current = null;
    }
    setBlobUrl(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setIsUnplayable(false);
    setHasSavedAudio(true);
    setIsLoading(true);

    const loader = loaderRef.current;
    if (loader === null) {
      setIsLoading(false);
      setHasSavedAudio(false);
      return () => {
        controller.abort();
      };
    }

    void loader.loadSessionAudioBlobUrl(sessionId, controller.signal).then((url) => {
      if (controller.signal.aborted) return;
      if (url === null) {
        setHasSavedAudio(false);
        setIsLoading(false);
        return;
      }
      blobUrlRef.current = url;
      setBlobUrl(url);
      setIsLoading(false);
    });

    return () => {
      controller.abort();
    };
  }, [sessionId]);

  useEffect(() => () => {
    if (blobUrlRef.current !== null) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }, []);

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

  const isUnavailable = !isLoading && (!hasSavedAudio || isUnplayable);
  const isDisabled = blobUrl === null || isUnplayable || isLoading;
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="audio-player">
      {blobUrl !== null && (
        <audio
          ref={audioRef}
          src={blobUrl}
          onPlay={() => { setIsPlaying(true); }}
          onPause={() => { setIsPlaying(false); }}
          onEnded={() => { setIsPlaying(false); setCurrentTime(0); }}
          onTimeUpdate={() => { setCurrentTime(audioRef.current?.currentTime ?? 0); }}
          onLoadedMetadata={() => {
            const loadedDuration = audioRef.current?.duration ?? 0;
            if (Number.isFinite(loadedDuration)) {
              setDuration(loadedDuration);
            } else {
              setIsUnplayable(true);
            }
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
          : <Play className="audio-player__play-icon" aria-hidden="true" />
        }
      </button>

      <span className="audio-player__time">{formatPlayerClock(currentTime)}</span>

      {isLoading
        ? <span className="audio-player__unavailable">Loading audio...</span>
        : isUnavailable
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
            />
            <div className="audio-player__track">
              <div className="audio-player__fill" style={{ width: `${String(progress)}%` }} />
            </div>
          </div>
        )
      }

      <span className="audio-player__time">{formatPlayerClock(duration)}</span>
    </div>
  );
}
