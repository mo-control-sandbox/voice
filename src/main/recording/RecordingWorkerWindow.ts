import { BrowserWindow } from '@mobrowser/api';
import { rendererWindowUrl } from '../RendererWindowUrl';
import { attachPermissionHandler } from '../system/Permissions';

/**
 * Persistent hidden window that hosts the audio capture and transcription pipeline.
 *
 * Never shown to the user. Kept alive for the application lifetime so that the
 * microphone, model weights, and warm-up state persist across recording sessions.
 */
export class RecordingWorkerWindow {
  initialize(): void {
    this.createWindow();
  }

  private createWindow(): BrowserWindow {
    const win = new BrowserWindow({
      url: rendererWindowUrl('background'),
      activationIndependenceEnabled: true,
    });
    attachPermissionHandler(win);
    return win;
  }
}
