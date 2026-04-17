import { useEffect, useState } from 'react';
import { ipc } from '../gen/ipc';
import type { SessionRecordProto } from '../gen/history';
import { SessionList } from './components/SessionList';
import { SessionDetail } from './components/SessionDetail';
import { reverseIpcBridge } from '../ipc/ReverseIpcBridge';
import { HistorySignalService } from '../ipc/SignalService';

/**
 * Root component for the History window.
 *
 * Fetches the session list on mount and re-fetches whenever the main-side
 * history revision increments, delivered via MainSignalBus.
 */
export function HistoryApp(): React.JSX.Element {
  const [sessions, setSessions] = useState<SessionRecordProto[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  async function fetchSessions(): Promise<void> {
    const response = await ipc.history.GetSessions({});
    setSessions(response.sessions);
  }

  useEffect(() => {
    void fetchSessions();

    return reverseIpcBridge.registerService(
      HistorySignalService({
        async onHistoryRevisionChanged() {
          await fetchSessions();
        },
      }),
    );
  }, []);

  function handleDelete(id: string): void {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  const selectedSession = sessions.find((s) => s.id === selectedId) ?? null;

  return (
    <div className="flex h-screen bg-background text-foreground">
      <aside className="w-72 shrink-0 border-r border-border overflow-y-auto">
        <SessionList
          sessions={sessions}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </aside>
      <main className="flex-1 overflow-y-auto p-6">
        {selectedSession !== null ? (
          <SessionDetail session={selectedSession} onDelete={handleDelete} />
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">
              {sessions.length === 0
                ? 'No recorded sessions yet.'
                : 'Select a session to view details.'}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
