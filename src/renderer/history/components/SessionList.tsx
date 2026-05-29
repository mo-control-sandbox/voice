import { ScrollText } from 'lucide-react';
import type { SessionRecordProto } from '@/gen/history.ts';
import { formatShortcutLabel } from '@/utils/shortcutDisplay.ts';
import { SessionItem } from './SessionItem';
import './SessionList.css';

interface SessionListProps {
  readonly sessions: SessionRecordProto[];
  readonly selectedId: string | null;
  readonly shortcutKey: string;
  readonly onSelect: (id: string) => void;
  readonly onDelete: (id: string) => void;
}

/**
 * Scrollable list of transcription sessions.
 *
 * Renders an empty state when there are no sessions. Keyboard navigation
 * (up/down arrow keys) is handled at the listbox level so focus moves
 * between items without leaving the list.
 */
export function SessionList({
  sessions,
  selectedId,
  shortcutKey,
  onSelect,
  onDelete,
}: SessionListProps): React.JSX.Element {
  if (sessions.length === 0) {
    const shortcutLabel = formatShortcutLabel(shortcutKey);
    const shortcutText = shortcutLabel === '' ? 'your shortcut key' : shortcutLabel;

    return (
      <div className="empty-history">
        <ScrollText className="empty-history__icon" aria-hidden="true" strokeWidth={1} />
        <span className="empty-history__title">No recordings yet</span>
        <span className="empty-history__hint">
          Press <span className="empty-history__shortcut">{shortcutText}</span><br/>to start recording.
        </span>
      </div>
    );
  }

  return (
    <ul
      className="session-list"
      role="listbox"
      aria-label="Recording history"
    >
      {sessions.map((session) => (
        <li key={session.id} className="session-list__item" role="option" aria-selected={session.id === selectedId}>
          <SessionItem
            session={session}
            isSelected={session.id === selectedId}
            onSelect={onSelect}
            onDelete={onDelete}
          />
        </li>
      ))}
    </ul>
  );
}
