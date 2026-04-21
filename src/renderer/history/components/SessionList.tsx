import type { SessionRecordProto } from '../../gen/history';
import { SessionItem } from './SessionItem';

interface SessionListProps {
  readonly sessions: SessionRecordProto[];
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
  readonly onDelete: (id: string) => void;
}

/**
 * Scrollable list of transcription sessions.
 *
 * Keyboard contract (up/down navigation) is handled here so focus stays within
 * the listbox as the user arrows through items.
 */
export function SessionList({ sessions, selectedId, onSelect, onDelete }: SessionListProps): React.JSX.Element {
  if (sessions.length === 0) {
    return <p>No recordings yet.</p>;
  }

  return (
    <ul>
      {sessions.map((session) => (
        <SessionItem
          key={session.id}
          session={session}
          isSelected={session.id === selectedId}
          onSelect={onSelect}
          onDelete={onDelete}
        />
      ))}
    </ul>
  );
}
