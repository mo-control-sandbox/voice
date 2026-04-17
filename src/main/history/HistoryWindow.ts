import { app, BrowserWindow } from '@mobrowser/api';

/**
 * Manages the History dialog as a singleton window.
 */
export class HistoryWindow {
  private window: BrowserWindow | null = null;

  /**
   * Opens the History window, or focuses it if already visible.
   */
  show(): void {
    if (this.window === null || this.window.isClosed) {
      this.window = new BrowserWindow({
        size: { width: 800, height: 600 },
        title: 'moVoice \u2014 History',
      });
      this.window.browser.loadUrl(new URL('history/index.html', app.url).href);
    }
    if (this.window.isVisible) {
      this.window.focus();
    } else {
      this.window.show();
    }
  }
}
