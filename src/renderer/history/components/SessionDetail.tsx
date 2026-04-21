import { useEffect, useRef, useState } from 'react';
import type { SessionRecordProto } from '../../gen/history';
import { AudioPlayer } from './AudioPlayer';
import './SessionDetail.css';

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
    <>
      <div className="session-detail">
        {/* Transcript */}
        <section className="session-detail__section" aria-labelledby="transcript-heading">
          <span id="transcript-heading" className="session-detail__section-label">
            Transcript
          </span>
          {transcriptSaved ? (
            <p className="session-detail__transcript">{session.transcriptionText}</p>
          ) : (
            <p className="session-detail__transcript session-detail__transcript--empty">
              Transcript not saved for this session.
            </p>
          )}
        </section>

        {/* Audio */}
        <section className="session-detail__section" aria-labelledby="audio-heading">
          <span id="audio-heading" className="session-detail__section-label">
            Audio
          </span>
          <AudioPlayer audioData={audioData} />
        </section>

        {/* Metadata */}
        <section className="session-detail__section" aria-labelledby="details-heading">
          <span id="details-heading" className="session-detail__section-label">
            Details
          </span>
          <dl className="session-detail__meta">
            <dt className="session-detail__meta-label">Date</dt>
            <dd className="session-detail__meta-value">{formatDate(session.startedAt)}</dd>

            <dt className="session-detail__meta-label">Engine</dt>
            <dd className="session-detail__meta-value">{session.transcriptionEngineLabel}</dd>

            <dt className="session-detail__meta-label">Language</dt>
            <dd className="session-detail__meta-value">
              {session.detectedLanguage !== '' ? session.detectedLanguage : '—'}
            </dd>

            <dt className="session-detail__meta-label">Audio duration</dt>
            <dd className="session-detail__meta-value">
              {formatAudioDuration(session.audioDurationSeconds)}
            </dd>

            <dt className="session-detail__meta-label">Transcription time</dt>
            <dd className="session-detail__meta-value">
              {formatMs(session.transcriptionDurationMs)}
            </dd>

            <dt className="session-detail__meta-label">Words</dt>
            <dd className="session-detail__meta-value">{String(session.wordCount)}</dd>
          </dl>
        </section>

        {/* Actions */}
        <section className="session-detail__actions" aria-label="Session actions">
          <button
            className="session-detail__btn"
            data-btn="secondary"
            onClick={() => { onRevealAudio(session.id); }}
          >
            Reveal Audio in Finder
          </button>
          <button
            className="session-detail__btn"
            data-btn="secondary"
            onClick={() => { onRevealTranscript(session.id); }}
            disabled={!transcriptSaved}
          >
            Reveal Transcript in Finder
          </button>
          <button
            className="session-detail__btn"
            data-btn="destructive"
            onClick={() => { setConfirming(true); }}
          >
            Delete
          </button>
        </section>
      </div>

      {/* Delete confirmation dialog */}
      {confirming && (
        <div
          className="delete-confirm-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-confirm-heading"
          aria-describedby="delete-confirm-body"
          onKeyDown={handleDialogKeyDown}
        >
          <div className="delete-confirm">
            <h2 id="delete-confirm-heading" className="delete-confirm__heading">
              Delete this session?
            </h2>
            <p id="delete-confirm-body" className="delete-confirm__body">
              The transcript and audio file will be permanently removed. This
              cannot be undone.
            </p>
            <div className="delete-confirm__actions">
              <button
                ref={cancelRef}
                className="session-detail__btn"
                data-btn="secondary"
                onClick={() => { setConfirming(false); }}
              >
                Cancel
              </button>
              <button
                className="session-detail__btn"
                data-btn="destructive"
                onClick={() => { onDelete(session.id); }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
