import type { SessionRecordProto } from '../../gen/history';

interface SessionItemProps {
  readonly session: SessionRecordProto;
  readonly isSelected: boolean;
  readonly onSelect: (id: string) => void;
}

/** Formats a Unix millisecond timestamp to a locale date+time string. */
function formatDate(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Formats audio duration in seconds as mm:ss or h:mm:ss. */
function formatDuration(seconds: number): string {
  const totalSec = Math.round(seconds);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${String(h)}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m)}:${String(s).padStart(2, '0')}`;
}

/** A single row in the session list sidebar. */
export function SessionItem({ session, isSelected, onSelect }: SessionItemProps): React.JSX.Element {
  return (
    <li>
      <button
        onClick={() => { onSelect(session.id); }}
        className={[
          'w-full text-left px-4 py-3 flex flex-col gap-1 transition-colors focus:outline-none',
          isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/50',
        ].join(' ')}
      >
        <span className="text-xs text-muted-foreground">{formatDate(session.startedAt)}</span>
        <span className="text-sm font-medium">
          {session.wordCount > 0 ? `${String(session.wordCount)} words` : 'No transcript'}
        </span>
        <span className="text-xs text-muted-foreground">
          {formatDuration(session.audioDurationSeconds)}
        </span>
      </button>
    </li>
  );
}
