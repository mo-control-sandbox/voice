import { native } from '../gen/native';
import type { RecordingSessionController } from './RecordingSessionController';

/**
 * Manages the native floating overlay that appears during a recording session.
 *
 * Calls into the native RecordingOverlayService to show and hide the NSPanel
 * in response to state changes on the RecordingSessionController. The overlay
 * remains visible through both recording and processing so the user knows
 * the session is still active.
 */
export class RecordingOverlay {
  constructor(private readonly controller: RecordingSessionController) {}

  /**
   * Subscribes to recording state and wires up the native overlay.
   */
  initialize(): void {
    this.controller.onStateChange((state) => {
      if (state === 'recording') {
        void native.recordingOverlay.Show({ phase: 'recording' });
      } else if (state === 'processing') {
        void native.recordingOverlay.Show({ phase: 'processing' });
      } else {
        void native.recordingOverlay.Hide({});
      }
    });
  }
}
