import { useEffect, useState } from 'react';
import type { SessionRecordProto } from '../gen/history';
import { SessionList } from './components/SessionList';
import { SessionDetail } from './components/SessionDetail';
import { HistoryService } from './HistoryService';
import './HistoryApp.css';

const historyService = new HistoryService();

interface HistoryAppProps {
  readonly embedded?: boolean;
}

/**
 * Root component for the History window.
 */
export function HistoryApp({ embedded = false }: HistoryAppProps = {}): React.JSX.Element {
  const [sessions, setSessions] = useState<SessionRecordProto[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  async function fetchSessions(): Promise<void> {
    const response = await historyService.getSessions();
    setSessions(response.sessions);
  }

  useEffect(() => {
    void fetchSessions();

    return historyService.subscribeToHistoryChanges(async () => {
      await fetchSessions();
    });
  }, []);

  function handleDelete(id: string): void {
    void historyService.deleteSession(id).then(() => {
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (selectedId === id) setSelectedId(null);
    });
  }

  const selectedSession = sessions.find((s) => s.id === selectedId) ?? null;

  return (
    <div className={`history-app ${embedded ? 'history-app--embedded' : ''}`}>
      <div className="history-app__list-pane">
        <div className="history-app__list-pane-inner">
          <SessionList
            sessions={sessions}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onDelete={handleDelete}
          />
        </div>
      </div>

      <div className="history-app__detail-pane">
        {selectedSession !== null ? (
          <SessionDetail
            session={selectedSession}
            onDelete={handleDelete}
            onOpenInFinder={(id) => { historyService.revealSessionFolder(id); }}
          />
        ) : (
          <div className="history-app__placeholder">
            <p className="history-app__placeholder-text">
              {sessions.length > 0 ? 'Select a recording to view details' : ''}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
