import { useEffect, useState } from 'react';
import type { SessionRecordProto } from '../gen/history';
import { SessionList } from './components/SessionList';
import { SessionDetail } from './components/SessionDetail';
import { reverseIpcBridge } from '../ipc/ReverseIpcBridge';
import { HistorySignalService } from '../ipc/SignalService';
import { HistoryService } from './services/HistoryService';

const historyService = new HistoryService();

/**
 * Root component for the History window.
 *
 * Owns all IPC for the history feature via HistoryService. Fetches the session
 * list on mount and re-fetches on every main-side history revision increment
 * delivered via the ReverseIpcBridge. Fetches audio data whenever the selected
 * session changes.
 */
export function HistoryApp(): React.JSX.Element {
  const [sessions, setSessions] = useState<SessionRecordProto[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [audioData, setAudioData] = useState<Uint8Array | null>(null);

  async function fetchSessions(): Promise<void> {
    const response = await historyService.getSessions();
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch audio bytes whenever the selected session changes.
  useEffect(() => {
    if (selectedId === null) {
      setAudioData(null);
      return;
    }
    setAudioData(null);
    void historyService.getAudioData(selectedId).then((response) => {
      setAudioData(new Uint8Array(response.audioData));
    });
  }, [selectedId]);

  function handleDelete(id: string): void {
    void historyService.deleteSession(id).then(() => {
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (selectedId === id) setSelectedId(null);
    });
  }

  function handleRevealAudio(id: string): void {
    historyService.revealAudioFile(id);
  }

  function handleRevealTranscript(id: string): void {
    historyService.revealTranscriptFile(id);
  }

  const selectedSession = sessions.find((s) => s.id === selectedId) ?? null;

  return (
    <div>
      <div>
        <SessionList
          sessions={sessions}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onDelete={setSelectedId}
        />
      </div>
      <div>
        {selectedSession !== null ? (
          <SessionDetail
            session={selectedSession}
            audioData={audioData}
            onDelete={handleDelete}
            onRevealAudio={handleRevealAudio}
            onRevealTranscript={handleRevealTranscript}
          />
        ) : (
          <p>{sessions.length > 0 ? 'Select a session.' : ''}</p>
        )}
      </div>
    </div>
  );
}
