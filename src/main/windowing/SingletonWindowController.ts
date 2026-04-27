import type { BrowserWindow } from '@mobrowser/api';

/**
 * Owns singleton window reuse so each caller can expose a stable show intent.
 */
export class SingletonWindowController {
  private window: BrowserWindow | null = null;

  constructor(private readonly createWindow: () => BrowserWindow) {}

  /**
   * Ensures a single window instance exists and brings it to the foreground.
   */
  show(): void {
    const window = this.getOrCreateWindow();
    if (window.isVisible) {
      window.focus();
      return;
    }
    window.show();
  }

  /**
   * Returns the current window instance, creating a new one when needed.
   */
  private getOrCreateWindow(): BrowserWindow {
    if (this.window === null || this.window.isClosed) {
      this.window = this.createWindow();
    }
    return this.window;
  }
}
