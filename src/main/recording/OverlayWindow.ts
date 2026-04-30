import { native } from '../gen/native';
import type { RecordingSessionController } from './RecordingSessionController';

/**
 * Native overlay window shown while a recording session is active.
 */
export class OverlayWindow {
  constructor(private readonly controller: RecordingSessionController) {}

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
