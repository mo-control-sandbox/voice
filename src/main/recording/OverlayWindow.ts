import { native } from '../gen/native';
import type { RecordingStatus } from './RecordingSessionController';

/**
 * Native overlay window shown while a recording session is active.
 */
export class OverlayWindow {
  initialize(): void {}

  update(status: RecordingStatus): void {
    if (status === 'recording') {
      void native.recordingOverlay.Show({ phase: 'recording' });
    } else if (status === 'processing') {
      void native.recordingOverlay.Show({ phase: 'processing' });
    } else {
      void native.recordingOverlay.Hide({});
    }
  }
}
