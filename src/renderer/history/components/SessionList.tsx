import type { SessionRecordProto } from '../../gen/history';
import { SessionItem } from './SessionItem';

interface SessionListProps {
  readonly sessions: SessionRecordProto[];
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
}

/** Renders the chronological list of transcription sessions in the left panel. */
export function SessionList({ sessions, selectedId, onSelect }: SessionListProps): React.JSX.Element {
  if (sessions.length === 0) {
    return (
      <div className="p-4 text-sm text-muted-foreground">No sessions yet.</div>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {sessions.map((session) => (
        <SessionItem
          key={session.id}
          session={session}
          isSelected={session.id === selectedId}
          onSelect={onSelect}
        />
      ))}
    </ul>
  );
}
