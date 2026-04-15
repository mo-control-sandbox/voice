import type { JSX } from 'react';
import { Trash2, FolderOpen } from 'lucide-react';
import type { SessionRecordProto } from '@/gen/history';
import { ipc } from '@/gen/ipc';
import { Button } from '@/components/ui/button';
import { AudioPlayer } from './AudioPlayer';

interface SessionDetailProps {
  readonly session: SessionRecordProto
  readonly onDeleted: () => void
}

/** Formats seconds as m:ss (e.g. "1:05"). */
function formatAudioDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m)}:${String(s).padStart(2, '0')}`;
}

/** Formats a transcription duration in milliseconds as a human-readable string. */
function formatTranscriptionDuration(ms: number): string {
  if (ms < 1000) return `${String(Math.round(ms))} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

/** Formats a Unix-ms timestamp as a full locale date/time string. */
function formatTimestamp(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
}

interface MetaRowProps {
  readonly label: string
  readonly value: string
}

function MetaRow({ label, value }: MetaRowProps): JSX.Element {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-xs text-muted-foreground w-32 flex-shrink-0">{label}</span>
      <span className="text-xs text-foreground">{value}</span>
    </div>
  );
}

/**
 * Full detail view for a selected recording session: transcript text,
 * audio player, metadata, and actions.
 */
export function SessionDetail({ session, onDeleted }: SessionDetailProps): JSX.Element {
  const handleDelete = (): void => {
    ipc.history.DeleteSession({ sessionId: session.id })
      .then(onDeleted)
      .catch((err: unknown) => { console.error('[SessionDetail] Delete error:', err); });
  };

  const handleRevealAudio = (): void => {
    void ipc.history.RevealAudioFile({ sessionId: session.id });
  };

  const handleRevealTranscript = (): void => {
    void ipc.history.RevealTranscriptFile({ sessionId: session.id });
  };

  const languageLabel = session.language !== '' ? session.language : 'Auto';
  const detectedLabel = session.detectedLanguage !== '' ? session.detectedLanguage : '—';

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Transcript */}
      <div className="flex-1 overflow-y-auto p-5">
        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap select-text">
          {session.transcriptionText !== '' ? session.transcriptionText : '(empty transcript)'}
        </p>
      </div>

      {/* Audio player */}
      <div className="px-5 py-3 border-t border-border">
        <AudioPlayer sessionId={session.id} disabled={!session.audioSaved} />
      </div>

      {/* Metadata */}
      <div className="px-5 py-3 border-t border-border space-y-1.5">
        <MetaRow label="Recorded"      value={formatTimestamp(session.timestamp)} />
        <MetaRow label="App"           value={session.targetAppName !== '' ? session.targetAppName : '—'} />
        <MetaRow label="Model"         value={session.modelId} />
        <MetaRow label="Audio"         value={formatAudioDuration(session.audioDurationSeconds)} />
        <MetaRow label="Transcription" value={formatTranscriptionDuration(session.transcriptionDurationMs)} />
        <MetaRow label="Language"      value={languageLabel} />
        <MetaRow label="Detected"      value={detectedLabel} />
      </div>

      {/* Actions */}
      <div className="px-5 py-3 border-t border-border flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={!session.audioSaved}
          onClick={handleRevealAudio}
        >
          <FolderOpen className="w-3.5 h-3.5 mr-1.5" />
          Reveal audio
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!session.transcriptSaved}
          onClick={handleRevealTranscript}
        >
          <FolderOpen className="w-3.5 h-3.5 mr-1.5" />
          Reveal transcript
        </Button>
        <div className="flex-1" />
        <Button variant="destructive" size="sm" onClick={handleDelete}>
          <Trash2 className="w-3.5 h-3.5 mr-1.5" />
          Delete
        </Button>
      </div>
    </div>
  );
}
