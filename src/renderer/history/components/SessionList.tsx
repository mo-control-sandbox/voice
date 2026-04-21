import { useRef } from 'react';
import { Mic } from 'lucide-react';
import type { SessionRecordProto } from '../../gen/history';
import { SessionItem } from './SessionItem';
import './SessionList.css';

interface SessionListProps {
  readonly sessions: SessionRecordProto[];
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
  readonly onDelete: (id: string) => void;
}

/** Empty state shown when no sessions exist yet. */
function EmptyHistory(): React.JSX.Element {
  return (
    <div className="empty-history">
      <Mic className="empty-history__icon" aria-hidden="true" />
      <span className="empty-history__title">No recordings yet</span>
      <p className="empty-history__hint">
        Press your shortcut key to make your first recording.
      </p>
    </div>
  );
}

/**
 * Scrollable list of transcription sessions.
 *
 * Keyboard contract (↑/↓ navigation) is handled here so focus stays within
 * the listbox as the user arrows through items.
 */
export function SessionList({ sessions, selectedId, onSelect, onDelete }: SessionListProps): React.JSX.Element {
  const listRef = useRef<HTMLUListElement>(null);

  if (sessions.length === 0) {
    return <EmptyHistory />;
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLUListElement>): void {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();

    const items = Array.from(
      listRef.current?.querySelectorAll<HTMLButtonElement>('.session-item') ?? [],
    );
    if (items.length === 0) return;

    const focused = document.activeElement as HTMLButtonElement;
    const idx = items.indexOf(focused);

    if (e.key === 'ArrowDown') {
      items[Math.min(idx + 1, items.length - 1)]?.focus();
    } else {
      items[Math.max(idx - 1, 0)]?.focus();
    }
  }

  return (
    <ul
      ref={listRef}
      className="session-list"
      role="listbox"
      aria-label="Recording sessions"
      aria-multiselectable="false"
      onKeyDown={handleKeyDown}
    >
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
