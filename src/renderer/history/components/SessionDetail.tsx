import { useEffect, useRef, useState } from 'react';
import type { SessionRecordProto } from '../../gen/history';
import { AudioPlayer } from './AudioPlayer';

interface SessionDetailProps {
  readonly session: SessionRecordProto;
  readonly audioData: Uint8Array | null;
  /** Called with the session id when the user confirms deletion. */
  readonly onDelete: (id: string) => void;
  /** Called when the user requests to reveal the audio file in Finder. */
  readonly onRevealAudio: (id: string) => void;
  /** Called when the user requests to reveal the transcript file in Finder. */
  readonly onRevealTranscript: (id: string) => void;
}

/** Formats a Unix ms timestamp as a long readable string. */
function formatDate(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    dateStyle: 'long',
    timeStyle: 'short',
  });
}

/** Formats milliseconds as a readable duration string. */
function formatMs(ms: number): string {
  if (ms < 1000) return `${String(Math.round(ms))} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

/** Formats audio duration in seconds as m:ss. */
function formatAudioDuration(seconds: number): string {
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m)}:${String(s).padStart(2, '0')}`;
}

/**
 * Detailed view of a selected history session.
 *
 * Shows transcript, audio player, session metadata, and action buttons.
 * Delete requires confirmation via an inline dialog. All IPC-backed actions
 * are delegated to the provided callbacks.
 */
export function SessionDetail({
  session,
  audioData,
  onDelete,
  onRevealAudio,
  onRevealTranscript,
}: SessionDetailProps): React.JSX.Element {
  const [confirming, setConfirming] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const transcriptSaved = session.transcriptionText !== '';

  // Reset confirmation state when the selected session changes.
  useEffect(() => {
    setConfirming(false);
  }, [session.id]);

  // Trap focus inside the confirmation dialog while it is open.
  useEffect(() => {
    if (confirming) {
      cancelRef.current?.focus();
    }
  }, [confirming]);

  function handleDialogKeyDown(e: React.KeyboardEvent<HTMLDivElement>): void {
    if (e.key === 'Escape') setConfirming(false);
  }

  return (
    <div>
      <p>{transcriptSaved ? session.transcriptionText : 'Transcript not saved.'}</p>

      <AudioPlayer audioData={audioData} />

      <p>Date: {formatDate(session.startedAt)}</p>
      <p>Engine: {session.transcriptionEngineLabel}</p>
      <p>Language: {session.detectedLanguage !== '' ? session.detectedLanguage : '—'}</p>
      <p>Audio duration: {formatAudioDuration(session.audioDurationSeconds)}</p>
      <p>Transcription time: {formatMs(session.transcriptionDurationMs)}</p>
      <p>Words: {String(session.wordCount)}</p>

      <button onClick={() => { onRevealAudio(session.id); }}>Reveal Audio</button>
      <button onClick={() => { onRevealTranscript(session.id); }} disabled={!transcriptSaved}>Reveal Transcript</button>
      <button onClick={() => { setConfirming(true); }}>Delete</button>

      {confirming && (
        <div onKeyDown={handleDialogKeyDown}>
          <p>Delete this session?</p>
          <button ref={cancelRef} onClick={() => { setConfirming(false); }}>Cancel</button>
          <button onClick={() => { onDelete(session.id); }}>Delete</button>
        </div>
      )}
    </div>
  );
}
