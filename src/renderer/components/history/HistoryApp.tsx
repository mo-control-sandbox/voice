import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import type { SessionRecordProto } from '@/gen/history';
import { ipc } from '@/gen/ipc';
import { SessionList } from './SessionList';
import { SessionDetail } from './SessionDetail';

/**
 * History window root component.
 *
 * Fetches all session records on mount and renders a master-detail layout:
 * the session list on the left and the selected session's detail on the right.
 */
export function HistoryApp(): JSX.Element {
  const [sessions, setSessions] = useState<SessionRecordProto[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fetchSessions = (): void => {
    ipc.history.GetSessions({})
      .then((response) => {
        setSessions(response.sessions);
      })
      .catch((err: unknown) => { console.error('[HistoryApp] GetSessions error:', err); });
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleDeleted = (): void => {
    setSelectedId(null);
    fetchSessions();
  };

  const selectedSession = sessions.find((s) => s.id === selectedId) ?? null;

  return (
    <div className="flex h-full bg-background show-animation">
      {/* Session list */}
      <div className="w-72 flex-shrink-0 border-r border-border">
        <div className="px-4 py-3 border-b border-border">
          <p className="text-sm font-semibold text-foreground">History</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {sessions.length === 0
              ? 'No recordings'
              : `${String(sessions.length)} recording${sessions.length === 1 ? '' : 's'}`}
          </p>
        </div>
        <SessionList
          sessions={sessions}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </div>

      {/* Detail panel */}
      <div className="flex-1 overflow-hidden">
        {selectedSession !== null ? (
          <SessionDetail
            session={selectedSession}
            onDeleted={handleDeleted}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            Select a recording to view details.
          </div>
        )}
      </div>
    </div>
  );
}
