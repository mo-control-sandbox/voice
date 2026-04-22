import { ipc } from '../../gen/ipc';
import type { SessionListResponse, AudioDataResponse } from '../../gen/history';

/**
 * IPC adapter for the history domain.
 *
 * Centralises all main-process calls related to session history so that
 * components in the history window do not import the IPC module directly.
 */
export class HistoryService {
  /** Returns all recorded sessions in reverse-chronological order. */
  async getSessions(): Promise<SessionListResponse> {
    return ipc.history.GetSessions({});
  }

  /**
   * Returns the raw PCM bytes stored for a session.
   * The response audioData field is empty when audio was not saved.
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
}
