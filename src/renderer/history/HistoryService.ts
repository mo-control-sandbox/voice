import { ipc } from '../gen/ipc';
import type { SessionListResponse, AudioDataResponse } from '../gen/history';
import { PolledChannel } from '../infra/ipc/PolledChannel';

const HISTORY_POLL_INTERVAL_MS = 1000;

/**
 * Application service for history workflows in the history window.
 *
 * Owns the use cases that the UI needs to read, delete, reveal, and observe stored sessions.
 */
export class HistoryService {
  private readonly historyChangedChannel = new PolledChannel<number, number>({
    intervalMs: HISTORY_POLL_INTERVAL_MS,
    poll: async () => {
      const response = await ipc.reverseIpcBridge.PollHistoryRevision({});
      return response.historyRevision;
    },
    getKey: (revision) => revision,
    skipFirst: true,
    logLabel: 'HistoryChangedChannel',
  });

  /** Returns all sessions available for history browsing. */
  async getSessions(): Promise<SessionListResponse> {
    return ipc.history.GetSessions({});
  }

  /**
   * Returns stored audio bytes for one session.
   *
   * The response is empty when audio persistence was disabled for that session.
   */
  async getAudioData(id: string): Promise<AudioDataResponse> {
    return ipc.history.GetAudioData({ id });
  }

  /** Permanently deletes a session and its associated files. */
  async deleteSession(id: string): Promise<void> {
    await ipc.history.DeleteSession({ id });
  }

  /** Opens the session folder in Finder. */
  revealSessionFolder(id: string): void {
    void ipc.history.RevealSessionFolder({ id });
  }

  /** Subscribes to notifications emitted when history data changes. */
  subscribeToHistoryChanges(handler: () => Promise<void>): () => void {
    return this.historyChangedChannel.subscribe(async () => handler());
  }
}
