import { useEffect, useRef, useState } from 'react';
import { FolderOpen } from 'lucide-react';
import type { SessionRecordProto } from '../../gen/history';
import { AudioPlayer } from './AudioPlayer';
import './SessionDetail.css';

interface SessionDetailProps {
  readonly session: SessionRecordProto;
  readonly audioData: Uint8Array | null;
  readonly onDelete: (id: string) => void;
  readonly onOpenInFinder: (id: string) => void;
}

/** Formats a Unix ms timestamp as a long readable string. */
function formatDate(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    dateStyle: 'long',
    timeStyle: 'short',
  });
}

/** Formats milliseconds as a human-readable duration. */
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
 * Delete requires confirmation via an inline overlay. All IPC-backed actions
 * are delegated to the provided callbacks.
 */
export function SessionDetail({
  session,
  audioData,
  onDelete,
  onOpenInFinder,
}: SessionDetailProps): React.JSX.Element {
  const [confirming, setConfirming] = useState(false);
  const cancelRef  = useRef<HTMLButtonElement>(null);
  const transcriptSaved = session.transcriptionText !== '';

  // Reset confirmation state when the selected session changes.
  useEffect(() => {
    setConfirming(false);
  }, [session.id]);

  // Focus the cancel button when the confirmation dialog opens.
  useEffect(() => {
    if (confirming) cancelRef.current?.focus();
  }, [confirming]);

  function handleDialogKeyDown(e: React.KeyboardEvent<HTMLDivElement>): void {
    if (e.key === 'Escape') setConfirming(false);
  }

  return (
    <div className="session-detail">
      {/* Transcript */}
      <section className="session-detail__section">
        <span className="session-detail__section-label">Transcript</span>
        <p
          className={[
            'session-detail__transcript',
            transcriptSaved ? '' : 'session-detail__transcript--empty',
          ].join(' ')}
        >
          {transcriptSaved ? session.transcriptionText : 'Transcript not saved'}
        </p>
      </section>

      {/* Audio player */}
      <section className="session-detail__section">
        <span className="session-detail__section-label">Audio</span>
        <AudioPlayer audioData={audioData} />
      </section>

      {/* Metadata */}
      <section className="session-detail__section">
        <span className="session-detail__section-label">Details</span>
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
          <dd className="session-detail__meta-value">{formatAudioDuration(session.audioDurationSeconds)}</dd>

          <dt className="session-detail__meta-label">Transcription time</dt>
          <dd className="session-detail__meta-value">{formatMs(session.transcriptionDurationMs)}</dd>

          <dt className="session-detail__meta-label">Words</dt>
          <dd className="session-detail__meta-value">{String(session.wordCount)}</dd>
        </dl>
      </section>

      {/* Actions */}
      <div className="session-detail__actions">
        <button
          type="button"
          className="session-detail__btn"
          data-btn="secondary"
          onClick={() => { onOpenInFinder(session.id); }}
        >
          <FolderOpen className="session-detail__btn-icon" aria-hidden="true" />
          Open in Finder
        </button>
        <button
          type="button"
          className="session-detail__btn"
          data-btn="destructive"
          onClick={() => { setConfirming(true); }}
        >
          Delete
        </button>
      </div>

      {/* Delete confirmation overlay */}
      {confirming && (
        <div
          className="delete-confirm-backdrop"
          onKeyDown={handleDialogKeyDown}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-confirm-heading"
        >
          <div className="delete-confirm">
            <h2 id="delete-confirm-heading" className="delete-confirm__heading">
              Delete this recording?
            </h2>
            <p className="delete-confirm__body">
              The audio file and transcript will be permanently removed. This cannot be undone.
            </p>
            <div className="delete-confirm__actions">
              <button
                ref={cancelRef}
                type="button"
                className="session-detail__btn"
                data-btn="secondary"
                onClick={() => { setConfirming(false); }}
              >
                Cancel
              </button>
              <button
                type="button"
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
    </div>
  );
}
