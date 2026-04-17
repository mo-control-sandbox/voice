import { app, BrowserWindow } from '@mobrowser/api';

/**
 * Manages the Settings dialog as a singleton window.
 */
export class SettingsWindow {
  private window: BrowserWindow | null = null;

  /**
   * Opens the Settings window, or focuses it if already visible.
   */
  show(): void {
    if (this.window === null || this.window.isClosed) {
      this.window = new BrowserWindow({
        size: { width: 960, height: 660 },
        title: 'moVoice \u2014 Settings',
      });
      this.window.browser.loadUrl(new URL('settings/index.html', app.url).href);
    }
    if (this.window.isVisible) {
      this.window.focus();
    } else {
      this.window.show();
    }
  }
}
