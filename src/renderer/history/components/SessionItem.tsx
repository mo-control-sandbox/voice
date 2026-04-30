import type { SessionRecordProto } from '../../gen/history';
import { formatHistoryShortDateTime, formatMinutesAndSeconds } from '../dateTime';
import './SessionItem.css';

interface SessionItemProps {
  readonly session: SessionRecordProto;
  readonly isSelected: boolean;
  readonly onSelect: (id: string) => void;
  readonly onDelete: (id: string) => void;
}

/** A single row in the history session list. */
export function SessionItem({ session, isSelected, onSelect, onDelete }: SessionItemProps): React.JSX.Element {
  const wordLabel = session.wordCount > 0
    ? `${String(session.wordCount)} words`
    : 'No transcript';

  function handleKeyDown(e: React.KeyboardEvent<HTMLButtonElement>): void {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      onDelete(session.id);
    }
  }

  return (
    <button
      type="button"
      className="session-item"
      aria-selected={isSelected}
      onClick={() => { onSelect(session.id); }}
      onKeyDown={handleKeyDown}
    >
      <div className="session-item__body">
        <div className="session-item__row">
          <span className="session-item__date">{formatHistoryShortDateTime(session.startedAt)}</span>
          <span className="session-item__duration">{formatMinutesAndSeconds(session.audioDurationSeconds)}</span>
        </div>
        <div className="session-item__meta">
          <span className="session-item__engine">{session.transcriptionEngineLabel}</span>
          <span className="session-item__words">{wordLabel}</span>
        </div>
      </div>
    </button>
  );
}
