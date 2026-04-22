import { MicOff } from 'lucide-react';
import type { SessionRecordProto } from '../../gen/history';
import { SessionItem } from './SessionItem';
import './SessionList.css';

interface SessionListProps {
  readonly sessions: SessionRecordProto[];
  readonly selectedId: string | null;
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
export function SessionList({ sessions, selectedId, onSelect, onDelete }: SessionListProps): React.JSX.Element {
  if (sessions.length === 0) {
    return (
      <div className="empty-history">
        <MicOff className="empty-history__icon" aria-hidden="true" />
        <span className="empty-history__title">No recordings yet</span>
        <span className="empty-history__hint">
          Press your shortcut key to start recording.
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
