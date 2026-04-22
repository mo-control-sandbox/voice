import { app, BrowserWindow } from '@mobrowser/api';
import type { DockManager } from '../system/DockManager';

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
        size: { width: 960, height: 700 },
        minimumSize: { width: 960, height: 700 },
        title: 'Settings',
        resizable: false
      });
      this.window.setWindowButtonVisible('zoom', false);
      this.window.browser.loadUrl(new URL('settings/index.html', app.url).href);
      this.dockManager.track(this.window);
    }
    if (this.window.isVisible) {
      this.window.focus();
    } else {
      this.window.show();
    }
  }
}
