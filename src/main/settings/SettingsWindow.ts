import { BrowserWindow, type RequestPermissionsParams } from '@mobrowser/api';
import type { DockManager } from '../system/DockManager';
import { rendererWindowUrl } from '../RendererWindowUrl';

/**
 * Manages the Settings dialog as a singleton window.
 */
export class SettingsWindow {
  private window: BrowserWindow | null = null;

  constructor(private readonly dockManager: DockManager) {}

  /**
   * Opens the Settings window, or focuses it if already visible.
   */
  show(): void {
    if (this.window === null || this.window.isClosed) {
      this.window = new BrowserWindow({
        url: rendererWindowUrl('settings'),
        size: { width: 960, height: 700 },
        minimumSize: { width: 960, height: 700 },
        title: 'Settings',
        resizable: false
      });
      this.window.browser.handle('requestPermissions', (params: RequestPermissionsParams) => {
        if (params.permissionType === 'microphone' || params.permissionType === 'AudioCapture') {
          return Promise.resolve('grant');
        }
        return Promise.resolve('deny');
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
