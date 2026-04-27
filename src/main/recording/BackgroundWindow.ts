import { BrowserWindow, type RequestPermissionsParams } from '@mobrowser/api';
import { rendererWindowUrl } from '../RendererWindowUrl';

/**
 * Persistent hidden window that hosts the audio capture and transcription pipeline.
 *
 * Never shown to the user. Kept alive for the application lifetime so that the
 * microphone, model weights, and warm-up state persist across recording sessions.
 */
export class BackgroundWindow {
  /**
   * Creates the hidden window and wires up the microphone permission grant.
   */
  initialize(): void {
    this.createWindow();
  }

  private createWindow(): BrowserWindow {
    const win = new BrowserWindow({
      url: rendererWindowUrl('background'),
      activationIndependenceEnabled: true,
    });
    win.browser.handle('requestPermissions', (params: RequestPermissionsParams) => {
      if (params.permissionType === 'microphone' || params.permissionType === 'AudioCapture') {
        return Promise.resolve('grant');
      }
      return Promise.resolve('deny');
    });
    return win;
  }
}
