import type { SessionRecordProto } from '../../gen/history';

interface SessionItemProps {
  readonly session: SessionRecordProto;
  readonly isSelected: boolean;
  readonly onSelect: (id: string) => void;
  readonly onDelete: (id: string) => void;
}

/** Formats a Unix ms timestamp as "Apr 20, 2:34 PM". */
function formatDate(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Formats audio duration in seconds as m:ss or h:mm:ss. */
function formatDuration(seconds: number): string {
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${String(h)}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m)}:${String(s).padStart(2, '0')}`;
}

/** A single row in the history session list. */
export function SessionItem({ session, isSelected, onSelect, onDelete }: SessionItemProps): React.JSX.Element {
  function handleKeyDown(e: React.KeyboardEvent<HTMLButtonElement>): void {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      onDelete(session.id);
    }
  }

  const wordLabel = session.wordCount > 0
    ? `${String(session.wordCount)} words`
    : 'No transcript';

  return (
    <li>
      <button
        data-selected={isSelected}
        onClick={() => { onSelect(session.id); }}
        onKeyDown={handleKeyDown}
      >
        {formatDate(session.startedAt)} — {formatDuration(session.audioDurationSeconds)} — {session.transcriptionEngineLabel} — {wordLabel}
      </button>
    </li>
  );
}
