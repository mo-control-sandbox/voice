import { ipc } from '../../gen/ipc';

/**
 * IPC adapter for the history domain.
 *
 * Centralises all main-process calls related to session history so that
 * components in the history window do not import the IPC module directly.
 */
export class HistoryService {
  /** Returns all recorded sessions in reverse-chronological order. */
  async getSessions() {
    return ipc.history.GetSessions({});
  }

  /**
   * Returns the raw PCM bytes stored for a session.
   * The response audioData field is empty when audio was not saved.
   */
  async getAudioData(id: string) {
    return ipc.history.GetAudioData({ id });
  }

  /** Permanently deletes a session and its associated files. */
  async deleteSession(id: string): Promise<void> {
    await ipc.history.DeleteSession({ id });
  }

  /** Opens the audio file for a session in Finder. */
  revealAudioFile(id: string): void {
    void ipc.history.RevealAudioFile({ id });
  }

  /** Opens the transcript file for a session in Finder. */
  revealTranscriptFile(id: string): void {
    void ipc.history.RevealTranscriptFile({ id });
  }
}
