import { app, BrowserWindow } from '@mobrowser/api';
import type { DockManager } from './system/DockManager';

/**
 * Manages the About dialog as a singleton window.
 */
export class AboutWindow {
  private window: BrowserWindow | null = null;

  constructor(private readonly dockManager: DockManager) {}

  show(): void {
    if (this.window === null || this.window.isClosed) {
      this.window = new BrowserWindow({
        size: { width: 400, height: 300 },
        minimumSize: { width: 400, height: 300 },
        title: 'About moVoice',
        windowTitlebarVisible: true,
        resizable: false
      });
      this.window.setWindowButtonVisible('zoom', false);
      this.dockManager.track(this.window);
    }
    this.window.browser.loadUrl(new URL('about/index.html', app.url).href);

    if (this.window.isVisible) {
      this.window.focus();
    } else {
      this.window.show();
    }
  }
}
