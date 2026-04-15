import { Notification } from '@mobrowser/api';
import type { Notifier } from '../domain/RecordingSessionController';

/**
 * Surfaces user-visible system notifications for error conditions that arise
 * during the recording pipeline.
 */
export class NotificationService implements Notifier {
  microphonePermissionDenied(): void {
    new Notification({
      title: 'Microphone access required',
      body: 'moVoice needs microphone access to record. Open System Settings → Privacy → Microphone to grant it.',
    }).show();
  }

  pasteAccessibilityDenied(): void {
    new Notification({
      title: 'Accessibility access required',
      body: 'Transcription was copied to the clipboard but could not be pasted. Open System Settings → Privacy → Accessibility to grant access.',
    }).show();
  }
}
