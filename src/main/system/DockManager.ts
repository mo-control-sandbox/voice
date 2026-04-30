import { app, dock } from '@mobrowser/api';
import type { BrowserWindow } from '@mobrowser/api';

/**
 * Shows the dock icon when at least one window of the application is visible.
 */
export class DockManager {
  initialize(): void {
    this.syncDockVisibility();
  }

  /**
   * Registers a window with DockManager so Dock visibility stays aligned with
   * whether any window is open.
   */
  track(window: BrowserWindow): void {
    if (window.isVisible) {
      throw new Error('DockManager.track() must be called before the window is shown.');
    }

    this.syncDockVisibility();

    window.on('shown', () => {
      this.syncDockVisibility();
    });
    window.on('hidden', () => {
      this.syncDockVisibility();
    });
    window.on('closed', () => {
      this.syncDockVisibility();
    });
  }

  /**
   * Synchronizes Dock visibility with the current set of visible application windows.
   */
  private syncDockVisibility(): void {
    const hasVisibleWindow = app.windows.some((window) => !window.isClosed && window.isVisible);
    if (hasVisibleWindow) {
      dock.show();
      return;
    }
    dock.hide();
  }
}
