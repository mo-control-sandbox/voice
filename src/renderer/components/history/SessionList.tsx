import type { JSX } from 'react';
import type { SessionRecordProto } from '@/gen/history';
import { SessionItem } from './SessionItem';

interface SessionListProps {
  readonly sessions: SessionRecordProto[]
  readonly selectedId: string | null
  readonly onSelect: (id: string) => void
}

/**
 * Scrollable list of recording sessions ordered newest-first.
 */
export function SessionList({ sessions, selectedId, onSelect }: SessionListProps): JSX.Element {
  const sorted = [...sessions].sort((a, b) => b.timestamp - a.timestamp);

  if (sorted.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground p-6 text-center">
        No recordings yet. Start recording with your global shortcut.
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full">
      {sorted.map((session) => (
        <SessionItem
          key={session.id}
          session={session}
          isSelected={session.id === selectedId}
          onSelect={() => { onSelect(session.id); }}
        />
      ))}
    </div>
  );
}
