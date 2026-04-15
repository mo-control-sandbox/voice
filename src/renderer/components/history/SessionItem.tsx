import type { JSX } from 'react';
import type { SessionRecordProto } from '@/gen/history';
import { cn } from '@/lib/utils';

/** Maximum number of characters shown as the transcript excerpt. */
const EXCERPT_MAX_CHARS = 80;

interface SessionItemProps {
  readonly session: SessionRecordProto
  readonly isSelected: boolean
  readonly onSelect: () => void
}

/** Formats a Unix-ms timestamp as a locale date/time string. */
function formatTimestamp(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Returns a truncated excerpt of the transcript text. */
function excerpt(text: string): string {
  if (text.length <= EXCERPT_MAX_CHARS) return text;
  return `${text.slice(0, EXCERPT_MAX_CHARS).trimEnd()}…`;
}

/**
 * A single row in the session list showing timestamp, target app, and a
 * short excerpt of the transcribed text.
 */
export function SessionItem({ session, isSelected, onSelect }: SessionItemProps): JSX.Element {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full text-left px-4 py-3 border-b border-border transition-colors',
        isSelected
          ? 'bg-accent text-accent-foreground'
          : 'hover:bg-muted/50',
      )}
    >
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <span className="text-xs font-medium text-foreground truncate">
          {session.targetAppName !== '' ? session.targetAppName : 'Unknown app'}
        </span>
        <span className="text-xs text-muted-foreground flex-shrink-0">
          {formatTimestamp(session.timestamp)}
        </span>
      </div>
      <p className="text-xs text-muted-foreground leading-snug line-clamp-2">
        {session.transcriptionText !== '' ? excerpt(session.transcriptionText) : '(empty)'}
      </p>
    </button>
  );
}
