import { dock } from '@mobrowser/api';
import type { BrowserWindow } from '@mobrowser/api';

/**
 * Centralises macOS Dock visibility for the application.
 *
 * Any window that should cause the Dock icon to appear while it is open
 * registers itself via track(). The icon is shown when the first tracked
 * window opens and hidden when the last one closes.
 */
export class DockManager {
  private openCount = 0;

  /**
   * Attaches shown/closed listeners to the window so it participates in
   * the shared Dock visibility count.
   *
   * Call this once per BrowserWindow instance, immediately after creation.
   */
  track(window: BrowserWindow): void {
    let isTrackedAsVisible = false;

    const markVisible = (): void => {
      if (isTrackedAsVisible) {
        return;
      }
      isTrackedAsVisible = true;
      this.openCount++;
      if (this.openCount === 1) {
        dock.show();
      }
    };

    const markHidden = (): void => {
      if (!isTrackedAsVisible) {
        return;
      }
      isTrackedAsVisible = false;
      this.openCount = Math.max(0, this.openCount - 1);
      if (this.openCount === 0) {
        dock.hide();
      }
    };

    if (window.isVisible) {
      markVisible();
    }

    window.on('shown', markVisible);
    window.on('hidden', markHidden);
    window.on('closed', markHidden);
  }
}
