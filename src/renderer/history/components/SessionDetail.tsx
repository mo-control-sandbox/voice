import { ipc } from '../../gen/ipc';
import type { SessionRecordProto } from '../../gen/history';
import { AudioPlayer } from './AudioPlayer';

interface SessionDetailProps {
  readonly session: SessionRecordProto;
  /** Called after the session is successfully deleted. */
  readonly onDelete: (id: string) => void;
}

/** Formats a Unix millisecond timestamp to a readable date/time string. */
function formatDate(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    dateStyle: 'long',
    timeStyle: 'short',
  });
}

/** Formats a duration in milliseconds as a human-readable string. */
function formatMs(ms: number): string {
  if (ms < 1000) return `${String(Math.round(ms))} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

/** Formats audio duration in seconds as mm:ss. */
function formatAudioDuration(seconds: number): string {
  const totalSec = Math.round(seconds);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m)}:${String(s).padStart(2, '0')}`;
}

/**
 * Detailed view of a selected history session, shown in the right panel.
 *
 * Displays the full transcript (or a redacted placeholder), an audio player,
 * session metadata, and action buttons.
 */
export function SessionDetail({ session, onDelete }: SessionDetailProps): React.JSX.Element {
  const transcriptSaved = session.transcriptionText !== '';

  async function handleDelete(): Promise<void> {
    await ipc.history.DeleteSession({ id: session.id });
    onDelete(session.id);
  }

  function handleRevealAudio(): void {
    void ipc.history.RevealAudioFile({ id: session.id });
  }

  function handleRevealTranscript(): void {
    void ipc.history.RevealTranscriptFile({ id: session.id });
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      {/* Transcript */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          Transcript
        </h2>
        {transcriptSaved ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap rounded-lg border border-border bg-muted/30 p-4">
            {session.transcriptionText}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground italic rounded-lg border border-border bg-muted/30 p-4">
            Transcript not saved for this session.
          </p>
        )}
      </section>

      {/* Audio player */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          Audio
        </h2>
        <AudioPlayer sessionId={session.id} />
      </section>

      {/* Metadata */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          Details
        </h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Date</dt>
          <dd>{formatDate(session.startedAt)}</dd>

          <dt className="text-muted-foreground">Engine</dt>
          <dd>{session.transcriptionEngineLabel}</dd>

          <dt className="text-muted-foreground">Language</dt>
          <dd>{session.detectedLanguage !== '' ? session.detectedLanguage : '—'}</dd>

          <dt className="text-muted-foreground">Audio duration</dt>
          <dd>{formatAudioDuration(session.audioDurationSeconds)}</dd>

          <dt className="text-muted-foreground">Transcription time</dt>
          <dd>{formatMs(session.transcriptionDurationMs)}</dd>

          <dt className="text-muted-foreground">Words</dt>
          <dd>{String(session.wordCount)}</dd>
        </dl>
      </section>

      {/* Actions */}
      <section className="flex flex-wrap gap-2">
        <button
          onClick={handleRevealAudio}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm hover:bg-muted transition-colors"
        >
          Reveal Audio in Finder
        </button>
        <button
          onClick={handleRevealTranscript}
          disabled={!transcriptSaved}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Reveal Transcript in Finder
        </button>
        <button
          onClick={() => { void handleDelete(); }}
          className="rounded-md border border-destructive/40 bg-background px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
        >
          Delete
        </button>
      </section>
    </div>
  );
}
