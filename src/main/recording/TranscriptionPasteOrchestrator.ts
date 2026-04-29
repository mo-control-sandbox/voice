import type { Clipboard } from '../system/Clipboard';

/**
 * Applies paste policy for completed and streaming transcription updates.
 */
export class TranscriptionPasteOrchestrator {
  constructor(private readonly clipboard: Clipboard) {}

  /**
   * Cancels queued paste operations for an aborted session.
   */
  onSessionAborted(): void {
    this.clipboard.cancelPending();
  }

  /**
   * Pastes a completed transcription result.
   */
  onTranscriptionCompleted(text: string): void {
    void this.clipboard.execute(text);
  }

  /**
   * Pastes one streaming transcription chunk.
   */
  onPartialTranscription(text: string): void {
    void this.clipboard.execute(text);
  }
}
