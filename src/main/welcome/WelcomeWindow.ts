import { BrowserWindow, type RequestPermissionsParams } from '@mobrowser/api';
import type { DockManager } from '../system/DockManager';
import { rendererWindowUrl } from '../RendererWindowUrl';

/**
 * Manages the first-launch Welcome wizard as a singleton window.
 */
export class WelcomeWindow {
  private window: BrowserWindow | null = null;

  constructor(private readonly dockManager: DockManager) {}

  show(): void {
    if (this.window === null || this.window.isClosed) {
      this.window = new BrowserWindow({
        url: rendererWindowUrl('welcome'),
        size: { width: 680, height: 620 },
        minimumSize: { width: 680, height: 620 },
        title: 'Welcome to MoVoice',
        resizable: false,
      });
      this.window.browser.handle('requestPermissions', async (params: RequestPermissionsParams) => {
        if (params.permissionType === 'microphone' || params.permissionType === 'AudioCapture') return 'grant';
        return 'deny';
      });
      this.window.setWindowButtonVisible('zoom', false);
      this.window.centerWindow();
      this.dockManager.track(this.window);
    }

    if (this.window.isVisible) {
      this.window.focus();
    } else {
      this.window.show();
    }
  }
}
