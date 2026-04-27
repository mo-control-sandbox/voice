import type { RecordingState } from './RecordingSessionController';
import type { Clipboard } from '../system/Clipboard';
import type { FocusRestorer } from '../system/FocusRestorer';

/**
 * Applies focus and paste policy for completed and streaming transcription updates.
 */
export class TranscriptionPasteOrchestrator {
  /**
   * Tracks whether streaming flow already attempted one focus restore.
   */
  private streamingFocusRestored = false;

  constructor(
    private readonly focusRestorer: FocusRestorer,
    private readonly clipboard: Clipboard,
  ) {}

  /**
   * Updates internal runtime state for the latest recording state.
   */
  onSessionStateChanged(state: RecordingState): void {
    if (state === 'recording') {
      this.streamingFocusRestored = false;
    }

    if (state === 'idle') {
      this.focusRestorer.clear();
    }
  }

  /**
   * Pastes a completed transcription using restore-first behavior.
   */
  onTranscriptionCompleted(text: string): void {
    void (async () => {
      const outcome = await this.focusRestorer.restore();
      if (outcome !== 'self_focus') {
        void this.clipboard.execute(text);
        return;
      }

      this.clipboard.copyOnly(text);
      this.focusRestorer.watchAndPaste(async () => {
        await this.clipboard.execute(text);
      });
    })();
  }

  /**
   * Pastes one streaming transcription chunk and restores focus once.
   */
  onPartialTranscription(text: string): void {
    void (async () => {
      if (!this.streamingFocusRestored) {
        this.streamingFocusRestored = true;
        await this.focusRestorer.restore();
      }

      void this.clipboard.execute(text);
    })();
  }
}
