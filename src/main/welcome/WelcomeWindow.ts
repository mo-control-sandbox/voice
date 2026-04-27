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
        title: 'MoVoice Initial Configuration',
        resizable: false,
        windowTitleVisible: true,
        windowTitlebarVisible: true,
        windowButtonVisible: {
          close: true,
          minimize: false,
          maximize: false,
          zoom: false,
        },
      });
      this.window.browser.handle('requestPermissions', (params: RequestPermissionsParams) => {
        if (params.permissionType === 'microphone' || params.permissionType === 'AudioCapture') {
          return Promise.resolve('grant');
        }
        return Promise.resolve('deny');
      });
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
