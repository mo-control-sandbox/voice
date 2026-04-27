import type { RecordingSessionController } from './RecordingSessionController';
import type { TranscriptionPasteOrchestrator } from './TranscriptionPasteOrchestrator';

/**
 * Wires recording runtime events to orchestrators and UI refresh hooks.
 */
export class RecordingRuntimeCoordinator {
  /**
   * Prevents duplicate listener registration during startup.
   */
  private initialized = false;

  constructor(
    private readonly controller: RecordingSessionController,
    private readonly transcriptionPasteOrchestrator: TranscriptionPasteOrchestrator,
    private readonly onStateChange: () => void,
  ) {}

  /**
   * Registers runtime listeners once for recording state and transcription events.
   */
  initialize(): void {
    if (this.initialized) return;
    this.initialized = true;

    this.controller.onStateChange(() => {
      this.onStateChange();
    });

    this.controller.onTranscriptionCompleted((text) => {
      this.transcriptionPasteOrchestrator.onTranscriptionCompleted(text);
    });

    this.controller.onPartialTranscription((text) => {
      this.transcriptionPasteOrchestrator.onPartialTranscription(text);
    });
  }
}
